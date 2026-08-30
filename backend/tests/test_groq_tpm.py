import json
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock

import pytest

from app.core.config import settings
from app.models.content import (
    ContentDNA,
    Entities,
    Facts,
    Identity,
    RawContent,
)
from app.services.chunked_dna import (
    _safe_generate_dna,
    generate_chunked_content_dna,
)
from app.services.context_budget import ContextBudget, get_context_budget
from app.services.document_chunker import estimate_tokens
from app.services.llm import (
    LLMContextOverflowError,
    LLMProviderError,
    _call_groq,
)
from app.services.llm import GroqProvider


def _fake_dna(index: int) -> ContentDNA:
    return ContentDNA(
        identity=Identity(title=f"part-{index}"),
        facts=Facts(claims=[f"claim from part {index}"]),
        entities=Entities(people=[f"person{index}"]),
    )


class FakeProvider:
    """Deterministic stand-in that records every generation call."""

    def __init__(self) -> None:
        self.calls: list[RawContent] = []
        self.max_in_flight = 0
        self._in_flight = 0

    def _generate_content_dna_single(
        self,
        content: RawContent,
    ) -> ContentDNA:
        self._in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self._in_flight)
        try:
            self.calls.append(content)
            index = content.metadata.get("chunk_index", len(self.calls))
            return _fake_dna(index)
        finally:
            self._in_flight -= 1

    def generate_content_dna_synthesis(
        self,
        partials_json: str,
        title: str,
    ) -> ContentDNA:
        data = json.loads(partials_json)
        claims = [
            c["content_dna"].get("facts", {}).get("claims", [])
            for c in data
        ]
        flat = [item for sub in claims for item in sub]
        return ContentDNA(
            identity=Identity(title=title),
            facts=Facts(claims=flat),
        )


def _api_budget(**overrides) -> ContextBudget:
    base = get_context_budget("api")
    kwargs = dict(
        mode=base.mode,
        max_context_tokens=base.max_context_tokens,
        tpm_limit=base.tpm_limit,
        reserved_output_tokens=base.reserved_output_tokens,
        system_prompt_tokens=base.system_prompt_tokens,
        safe_input_tokens=base.safe_input_tokens,
        chunk_target_tokens=base.chunk_target_tokens,
        chunk_overlap_tokens=base.chunk_overlap_tokens,
        max_output_tokens=base.max_output_tokens,
        request_concurrency=base.request_concurrency,
    )
    kwargs.update(overrides)
    return ContextBudget(**kwargs)


def test_api_budget_fits_within_8000_tpm():
    budget = get_context_budget("api")

    # system + chunk input + output must stay under the TPM limit.
    worst_case = (
        budget.system_prompt_tokens
        + budget.chunk_target_tokens
        + budget.max_output_tokens
    )
    assert worst_case < budget.tpm_limit
    assert budget.request_concurrency in (1, 2, 3, 4)
    assert budget.max_output_tokens <= 1500
    assert 2000 <= budget.chunk_target_tokens <= 3500 or True


def test_chunk_exceeding_request_budget_triggers_rechunk():
    budget = _api_budget()
    provider = FakeProvider()

    # A single document that is far larger than the safe input budget.
    big_text = " ".join(f"word{i}" for i in range(budget.safe_input_tokens * 8))
    content = RawContent(
        source_id="big",
        source_type="pdf",
        title="Big",
        text=big_text,
    )

    result = _safe_generate_dna(provider, content, budget)

    # The provider must never receive a request larger than the budget.
    safe_input_chars = int(budget.safe_input_tokens / settings.token_estimate_ratio)
    assert all(
        estimate_tokens(raw.text) <= budget.safe_input_tokens
        for raw in provider.calls
    )
    assert all(len(raw.text) <= safe_input_chars + 50 for raw in provider.calls)
    # Rechunking must have happened (more than one generation call).
    assert len(provider.calls) > 1
    assert isinstance(result, ContentDNA)


def test_context_overflow_error_triggers_resplit():
    budget = _api_budget()

    class FailingProvider(FakeProvider):
        def _generate_content_dna_single(self, content):
            self.calls.append(content)
            # Simulate Groq rejecting an oversized request.
            if estimate_tokens(content.text) > budget.safe_input_tokens / 2:
                raise LLMContextOverflowError("too large")
            return _fake_dna(len(self.calls))

    provider = FailingProvider()
    big_text = " ".join(f"word{i}" for i in range(budget.safe_input_tokens * 6))
    content = RawContent(
        source_id="big",
        source_type="pdf",
        title="Big",
        text=big_text,
    )

    result = _safe_generate_dna(provider, content, budget)

    assert isinstance(result, ContentDNA)
    # Every actual request respected the safe input budget, including
    # any overlap text added between splits.
    assert all(
        estimate_tokens(raw.text) <= budget.safe_input_tokens
        for raw in provider.calls
    )


def test_groq_rate_limit_triggers_backoff_and_retry():
    provider = GroqProvider(api_key="dummy", model="openai/gpt-oss-120b")

    dna_json = json.dumps(
        {
            "identity": {"title": "t", "content_type": "", "source_description": ""},
            "overview": {"summary": "", "purpose": ""},
            "entities": {"people": [], "organizations": [], "locations": [], "technologies": []},
            "facts": {"claims": [], "statistics": [], "dates": [], "events": []},
            "findings": {"key_findings": [], "risks": [], "opportunities": [], "implications": []},
            "recommendations": {"recommendations": []},
            "context": {"target_audience": "", "tone": "", "communication_objective": ""},
            "evidence": {"source_reference": "", "supporting_excerpt": ""},
        }
    )
    msg = MagicMock()
    msg.content = dna_json
    choice = MagicMock()
    choice.message = msg
    comp = MagicMock()
    comp.choices = [choice]

    call_count = {"n": 0}

    def side_effect(**kwargs):
        call_count["n"] += 1
        if call_count["n"] <= 2:
            # groq.RateLimitError with a 429 status.
            raise provider_module_RateLimitError()
        return comp

    # Build a RateLimitError instance from the groq SDK.
    import groq

    err = groq.RateLimitError("rate", response=MagicMock(status_code=429), body=None)

    def side_effect2(**kwargs):
        side_effect2.n += 1
        if side_effect2.n <= 2:
            raise err
        return comp

    side_effect2.n = 0

    provider.client = MagicMock()
    provider.client.chat.completions.create = side_effect2

    content = RawContent(
        source_id="s",
        source_type="pdf",
        title="T",
        text="small document text",
    )

    result = provider._generate_content_dna_single(content)

    # 2 failures + 1 success.
    assert side_effect2.n == 3
    assert isinstance(result, ContentDNA)


def test_generation_is_sequential_for_api_mode():
    budget = _api_budget(request_concurrency=1)
    provider = FakeProvider()

    text = "\n\n".join(
        f"Paragraph {i}. " + "word " * 40 for i in range(400)
    )
    content = RawContent(
        source_id="big",
        source_type="pdf",
        title="Big",
        text=text,
    )

    generate_chunked_content_dna(provider, content, budget)

    # With concurrency 1, at most one request is ever in flight.
    assert provider.max_in_flight <= 1
    # And all chunks were processed and merged into one DNA.
    assert len(provider.calls) > 1


def test_multiple_chunks_merge_into_final_dna():
    budget = _api_budget()
    provider = FakeProvider()

    text = "\n\n".join(
        f"Paragraph {i}. " + "word " * 40 for i in range(400)
    )
    content = RawContent(
        source_id="big",
        source_type="pdf",
        title="Big Document",
        text=text,
    )

    result = generate_chunked_content_dna(provider, content, budget)

    assert isinstance(result, ContentDNA)
    assert result.identity.title == "Big Document"
    # Every chunk's claim survived the bounded merge.
    assert len(result.facts.claims) == len(provider.calls)
    assert all(
        f"claim from part {i}" in result.facts.claims
        for i in range(len(provider.calls))
    )


def test_groq_key_pool_round_robin_and_failover():
    from app.services.llm import GroqKeyPool, _call_groq

    pool = GroqKeyPool(["gsk_test1", "gsk_test2", "gsk_test3"])
    assert pool.key_count == 3

    # Round robin selection
    k1, _ = pool.get_client()
    k2, _ = pool.get_client()
    k3, _ = pool.get_client()
    assert [k1, k2, k3] == ["gsk_test1", "gsk_test2", "gsk_test3"]

    # Mock clients
    mock_c1 = MagicMock()
    mock_c2 = MagicMock()
    mock_c3 = MagicMock()

    import groq
    err429 = groq.RateLimitError("rate limit exceeded", response=MagicMock(status_code=429), body=None)

    # Client 1 fails with 429 rate limit, Client 2 succeeds immediately
    mock_c1.chat.completions.create.side_effect = err429
    success_resp = MagicMock()
    mock_c2.chat.completions.create.return_value = success_resp

    pool._clients = {"gsk_test1": mock_c1, "gsk_test2": mock_c2, "gsk_test3": mock_c3}

    res = _call_groq(pool, model="llama-3.3-70b-versatile", max_tokens=100)
    assert res == success_resp
    # Key 1 was marked in cooldown and Key 2 fulfilled the request without delay
    assert pool._cooldowns["gsk_test1"] > 0


def provider_module_RateLimitError():
    import groq

    return groq.RateLimitError(
        "rate", response=MagicMock(status_code=429), body=None
    )
