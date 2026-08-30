import json

from app.models.content import (
    ContentDNA,
    Entities,
    Facts,
    Identity,
    RawContent,
)
from app.services.chunked_dna import generate_chunked_content_dna
from app.services.context_budget import get_context_budget
from app.core.config import settings


class FakeProvider:
    """Deterministic stand-in for a real LLM provider.

    It records how many chunk-level and synthesis calls were made and
    combines the (page-aware) partial DNAs without any network access.
    """

    def __init__(self) -> None:
        self.dna_calls = 0
        self.synth_calls = 0

    def _generate_content_dna_single(
        self,
        content: RawContent,
    ) -> ContentDNA:
        self.dna_calls += 1
        index = content.metadata.get("chunk_index", 0)

        return ContentDNA(
            identity=Identity(title=content.title),
            facts=Facts(claims=[f"claim from part {index + 1}"]),
            entities=Entities(people=[f"person{index + 1}"]),
        )

    def generate_content_dna_synthesis(
        self,
        partials_json: str,
        title: str,
    ) -> ContentDNA:
        self.synth_calls += 1
        data = json.loads(partials_json)

        claims: list[str] = []
        people: list[str] = []

        for entry in data:
            dna = entry["content_dna"]
            claims.extend(dna.get("facts", {}).get("claims", []))
            people.extend(dna.get("entities", {}).get("people", []))

        return ContentDNA(
            identity=Identity(title=title),
            facts=Facts(claims=claims),
            entities=Entities(people=people),
        )


def _big_text(paragraphs: int = 400, words_per: int = 60) -> str:
    paras = []

    for i in range(paragraphs):
        words = " ".join(f"word{j}" for j in range(words_per))
        paras.append(f"This is paragraph number {i}. {words}")

    return "\n\n".join(paras)


def _big_text_with_pages(pages: int = 20, words_per: int = 60) -> str:
    parts = []

    for page in range(1, pages + 1):
        words = " ".join(f"word{j}" for j in range(words_per))
        parts.append(f"[Page {page}]\nContent on page {page}. {words}")

    return "\n\n".join(parts)


def test_chunked_pipeline_returns_canonical_dna():
    budget = get_context_budget("api")
    provider = FakeProvider()
    content = RawContent(
        source_id="s1",
        source_type="pdf",
        title="Big Document",
        text=_big_text(),
    )

    result = generate_chunked_content_dna(provider, content, budget)

    assert isinstance(result, ContentDNA)
    assert result.identity.title == "Big Document"
    # Every chunk's unique claim must survive into the final DNA.
    assert all(
        f"claim from part {i + 1}" in result.facts.claims
        for i in range(provider.dna_calls)
    )


def test_chunked_pipeline_invokes_bounded_synthesis():
    budget = get_context_budget("api")
    provider = FakeProvider()
    content = RawContent(
        source_id="s2",
        source_type="pdf",
        title="Big Document",
        text=_big_text(paragraphs=600, words_per=70),
    )

    result = generate_chunked_content_dna(provider, content, budget)

    # Multiple chunks were processed.
    assert provider.dna_calls > 1
    # At least one synthesis (group merge) happened; it never collapses
    # all chunks in a single request because dna_calls stays > synth.
    assert provider.synth_calls >= 1
    assert provider.dna_calls > provider.synth_calls
    assert isinstance(result, ContentDNA)


def test_synthesis_payload_carries_page_ranges():
    budget = get_context_budget("api")
    provider = FakeProvider()
    content = RawContent(
        source_id="s3",
        source_type="pdf",
        title="Paged Document",
        text=_big_text_with_pages(pages=40, words_per=500),
    )

    # Patch synthesis to inspect the payload page metadata.
    captured = {}

    original = provider.generate_content_dna_synthesis

    def spy(partials_json, title):
        captured["payload"] = json.loads(partials_json)
        return original(partials_json, title)

    provider.generate_content_dna_synthesis = spy

    generate_chunked_content_dna(provider, content, budget)

    assert captured
    flat_pages = [
        (entry.get("page_start"), entry.get("page_end"))
        for entry in captured["payload"]
    ]
    # At least one entry carries page information.
    assert any(
        start is not None or end is not None
        for start, end in flat_pages
    )


def test_small_document_is_not_chunked():
    budget = get_context_budget("api")
    provider = FakeProvider()
    content = RawContent(
        source_id="s4",
        source_type="text",
        title="Small",
        text="A short document that fits in one request.",
    )

    result = generate_chunked_content_dna(provider, content, budget)

    assert provider.dna_calls == 1
    assert provider.synth_calls == 0
    assert isinstance(result, ContentDNA)
