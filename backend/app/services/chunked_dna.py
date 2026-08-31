import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from math import ceil

from app.core.config import settings
from app.models.content import ContentDNA, RawContent
from app.services.context_budget import ContextBudget
from app.services.document_chunker import (
    DocumentChunk,
    chunk_document,
    estimate_tokens,
)
from app.services.llm import (
    LLMContextOverflowError,
    LLMProvider,
    LLMProviderError,
)


logger = logging.getLogger(__name__)


@dataclass
class _MergeItem:
    """A ContentDNA plus the page range it was extracted from.

    Page ranges are aggregated as chunks are merged so the final
    synthesis knows the complete evidence coverage of the document.
    """

    dna: ContentDNA
    page_start: int | None
    page_end: int | None

    @property
    def merged_page_label(self) -> str:
        if self.page_start is None and self.page_end is None:
            return ""

        if self.page_start == self.page_end:
            return f"Page {self.page_start}"

        return f"Pages {self.page_start}-{self.page_end}"


def _build_chunk_raw_contents(
    content: RawContent,
    chunks: list[DocumentChunk],
) -> list[RawContent]:
    raws: list[RawContent] = []

    for chunk in chunks:
        raws.append(
            RawContent(
                source_id=(
                    f"{content.source_id}:chunk{chunk.chunk_index + 1}"
                ),
                source_type=content.source_type,
                title=content.title,
                text=chunk.text,
                metadata={
                    **content.metadata,
                    "chunk_id": chunk.chunk_id,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                    "page_start": chunk.page_start,
                    "page_end": chunk.page_end,
                },
            )
        )

    return raws


def _safe_generate_dna(
    provider: LLMProvider,
    content: RawContent,
    budget: ContextBudget,
) -> ContentDNA:
    """Generate ContentDNA for one (sub-)document, rechunking if needed.

    If the input still exceeds the safe request budget (or Groq reports
    a context overflow despite budgeting), the text is split in half and
    the two halves are generated and merged. This guarantees no request
    is sent that obviously exceeds the configured TPM/context limit.
    """
    est_input = estimate_tokens(content.text)

    logger.info(
        "Chunk request budget: source_id=%s "
        "estimated_input_tokens=%d estimated_output_tokens=%d "
        "estimated_total_tokens=%d groq_tpm_budget=%d",
        content.source_id,
        est_input,
        budget.max_output_tokens,
        est_input
        + budget.system_prompt_tokens
        + budget.max_output_tokens,
        budget.tpm_limit,
    )

    if est_input > budget.safe_input_tokens:
        logger.warning(
            "Chunk input %d exceeds safe budget %d; re-splitting "
            "source_id=%s",
            est_input,
            budget.safe_input_tokens,
            content.source_id,
        )
        return _resplit_and_merge(provider, content, budget)

    try:
        return provider._generate_content_dna_single(content)
    except LLMContextOverflowError:
        logger.warning(
            "Groq reported context overflow despite budgeting; "
            "re-splitting source_id=%s",
            content.source_id,
        )
        return _resplit_and_merge(provider, content, budget)


def _resplit_and_merge(
    provider: LLMProvider,
    content: RawContent,
    budget: ContextBudget,
) -> ContentDNA:
    if len(content.text.strip()) < 300:
        logger.warning(
            "Text snippet for source_id=%s is too small to split further (%d chars)",
            content.source_id,
            len(content.text),
        )
        return ContentDNA()

    half = max(1, len(content.text) // 2)
    left = content.model_copy(update={"text": content.text[:half]})
    right = content.model_copy(update={"text": content.text[half:]})

    left_dna = _safe_generate_dna(provider, left, budget)
    right_dna = _safe_generate_dna(provider, right, budget)

    return merge_dnas(
        provider,
        budget,
        content.title,
        [left_dna, right_dna],
    )


def merge_dnas(
    provider: LLMProvider,
    budget: ContextBudget,
    title: str,
    dnas: list[ContentDNA],
) -> ContentDNA:
    """Merge several ContentDNA objects into one via synthesis."""
    items = [
        _MergeItem(dna=dna, page_start=None, page_end=None)
        for dna in dnas
    ]

    return _synthesize_group(provider, items, budget, title).dna


def _generate_with_retries(
    provider: LLMProvider,
    raw: RawContent,
    chunk_index: int,
    total: int,
    budget: ContextBudget,
) -> ContentDNA:
    last_error: Exception | None = None

    for attempt in range(1, settings.max_chunk_retries + 1):
        try:
            return _safe_generate_dna(provider, raw, budget)
        except LLMProviderError as exc:
            # LLMContextOverflowError is handled inside _safe_generate_dna
            # by re-splitting; only other provider errors reach here.
            last_error = exc
            logger.warning(
                "Chunk %d/%d attempt %d failed: %s",
                chunk_index + 1,
                total,
                attempt,
                exc,
            )

    assert last_error is not None
    raise last_error


def _generate_chunk_partials(
    provider: LLMProvider,
    raws: list[RawContent],
    budget: ContextBudget,
) -> list[_MergeItem]:
    total = len(raws)

    def _process(index: int) -> tuple[int, _MergeItem]:
        logger.info("Processing chunk %d/%d", index + 1, total)

        dna = _generate_with_retries(
            provider,
            raws[index],
            index,
            total,
            budget,
        )

        logger.info("Chunk %d/%d completed", index + 1, total)

        meta = raws[index].metadata
        page_start = meta.get("page_start")
        page_end = meta.get("page_end")

        if isinstance(page_start, str) and page_start.isdigit():
            page_start = int(page_start)
        if isinstance(page_end, str) and page_end.isdigit():
            page_end = int(page_end)

        return index, _MergeItem(
            dna=dna,
            page_start=page_start,
            page_end=page_end,
        )

    results: list[tuple[int, _MergeItem]]

    workers = budget.request_concurrency or 1

    if workers > 1:
        workers = min(workers, total)

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [
                executor.submit(_process, index)
                for index in range(total)
            ]
            results = [future.result() for future in as_completed(futures)]
    else:
        # Sequential and deterministic (default for API/Groq TPM mode and
        # for local/Ollama hardware limits).
        results = [_process(index) for index in range(total)]

    results.sort(key=lambda item: item[0])

    return [item for _, item in results]


def _prune_empty(val: Any) -> Any:
    """Recursively strip empty lists, empty strings, and empty dicts to minimize token payload."""
    if isinstance(val, dict):
        cleaned = {k: _prune_empty(v) for k, v in val.items()}
        return {k: v for k, v in cleaned.items() if v not in ("", [], {}, None)}
    elif isinstance(val, list):
        cleaned = [_prune_empty(v) for v in val]
        return [v for v in cleaned if v not in ("", [], {}, None)]
    return val


def _compact_partials(group: list[_MergeItem]) -> str:
    """Build a compact JSON payload of partial ContentDNA objects.

    Each entry carries the page range it was extracted from so the
    synthesis step can preserve evidence traceability.
    """
    payload: list[dict] = []

    for item in group:
        payload.append(
            {
                "page_start": item.page_start,
                "page_end": item.page_end,
                "content_dna": _prune_empty(item.dna.model_dump(mode="json")),
            }
        )

    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _aggregate_pages(
    group: list[_MergeItem],
) -> tuple[int | None, int | None]:
    starts = [item.page_start for item in group if item.page_start]
    ends = [item.page_end for item in group if item.page_end]

    page_start = min(starts) if starts else None
    page_end = max(ends) if ends else None

    return page_start, page_end


def _union_dna(base_dna: ContentDNA, group: list[_MergeItem]) -> ContentDNA:
    """Ensures every single extracted entity, fact, finding, and recommendation from all chunks is preserved."""
    def _dedup_list(items: list[str]) -> list[str]:
        seen = set()
        out = []
        for it in items:
            cleaned = str(it).strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                out.append(cleaned)
        return out

    from app.models.content import Entities, Facts, Findings, Recommendations
    from app.services.llm import _normalize_entity_list

    all_people = list(base_dna.entities.people)
    all_orgs = list(base_dna.entities.organizations)
    all_locs = list(base_dna.entities.locations)
    all_techs = list(base_dna.entities.technologies)

    all_claims = list(base_dna.facts.claims)
    all_stats = list(base_dna.facts.statistics)
    all_dates = list(base_dna.facts.dates)
    all_events = list(base_dna.facts.events)

    all_findings = list(base_dna.findings.key_findings)
    all_risks = list(base_dna.findings.risks)
    all_opps = list(base_dna.findings.opportunities)
    all_impls = list(base_dna.findings.implications)

    all_recs = list(base_dna.recommendations.recommendations)

    for item in group:
        d = item.dna
        all_people.extend(d.entities.people)
        all_orgs.extend(d.entities.organizations)
        all_locs.extend(d.entities.locations)
        all_techs.extend(d.entities.technologies)

        all_claims.extend(d.facts.claims)
        all_stats.extend(d.facts.statistics)
        all_dates.extend(d.facts.dates)
        all_events.extend(d.facts.events)

        all_findings.extend(d.findings.key_findings)
        all_risks.extend(d.findings.risks)
        all_opps.extend(d.findings.opportunities)
        all_impls.extend(d.findings.implications)

        all_recs.extend(d.recommendations.recommendations)

    from app.models.content import Evidence

    # Preserve strongest evidence
    ev_ref = base_dna.evidence.source_reference
    ev_excerpt = base_dna.evidence.supporting_excerpt
    if not ev_excerpt:
        for item in group:
            if item.dna.evidence.supporting_excerpt:
                ev_excerpt = item.dna.evidence.supporting_excerpt
                if not ev_ref and item.dna.evidence.source_reference:
                    ev_ref = item.dna.evidence.source_reference
                break

    return base_dna.model_copy(
        update={
            "entities": Entities(
                people=_normalize_entity_list(all_people),
                organizations=_normalize_entity_list(all_orgs),
                locations=_normalize_entity_list(all_locs),
                technologies=_normalize_entity_list(all_techs),
            ),
            "facts": Facts(
                claims=_dedup_list(all_claims),
                statistics=_dedup_list(all_stats),
                dates=_dedup_list(all_dates),
                events=_dedup_list(all_events),
            ),
            "findings": Findings(
                key_findings=_dedup_list(all_findings),
                risks=_dedup_list(all_risks),
                opportunities=_dedup_list(all_opps),
                implications=_dedup_list(all_impls),
            ),
            "recommendations": Recommendations(
                recommendations=_dedup_list(all_recs),
            ),
            "evidence": Evidence(
                source_reference=ev_ref or base_dna.identity.title or "Source Document",
                supporting_excerpt=ev_excerpt or (all_claims[0] if all_claims else (base_dna.overview.summary or "Supporting source evidence")),
            ),
        }
    )


def _synthesize_group(
    provider: LLMProvider,
    group: list[_MergeItem],
    budget: ContextBudget,
    title: str,
) -> _MergeItem:
    if not group:
        return _MergeItem(dna=ContentDNA(), page_start=None, page_end=None)

    if len(group) == 1:
        return group[0]

    payload = _compact_partials(group)
    payload_tokens = estimate_tokens(payload)

    logger.info(
        "Synthesis group: items=%d estimated_input_tokens=%d "
        "estimated_output_tokens=%d groq_tpm_budget=%d",
        len(group),
        payload_tokens,
        budget.max_output_tokens,
        budget.tpm_limit,
    )

    page_start, page_end = _aggregate_pages(group)
    available = budget.safe_input_tokens - 300

    if payload_tokens <= available:
        try:
            dna = provider.generate_content_dna_synthesis(payload, title)
            dna = _union_dna(dna, group)
        except Exception as exc:
            logger.warning(
                "LLM synthesis call failed (%s); using deterministic union merge",
                exc,
            )
            dna = _union_dna(group[0].dna, group)
    else:
        # Deterministic union merge directly from extracted partials when payload exceeds request budget
        logger.info(
            "Synthesis payload (%d tokens) exceeds budget (%d tokens); using deterministic union merge",
            payload_tokens,
            available,
        )
        dna = _union_dna(group[0].dna, group)

    return _MergeItem(
        dna=dna,
        page_start=page_start,
        page_end=page_end,
    )


def _merge_partials(
    provider: LLMProvider,
    items: list[_MergeItem],
    budget: ContextBudget,
    title: str,
) -> ContentDNA:
    """Bounded hierarchical merge of chunk-level ContentDNA objects.

    Chunks are combined in fixed-size groups; each group is synthesized
    into one partial DNA. The process repeats until a single canonical
    ContentDNA remains. No step ever sends all chunks into one request.
    """
    group_size = max(1, settings.merge_group_size)
    current = list(items)

    while len(current) > 1:
        groups = [
            current[start : start + group_size]
            for start in range(0, len(current), group_size)
        ]
        logger.info(
            "Synthesizing %d chunk results into %d group(s)",
            len(current),
            len(groups),
        )

        workers = min(len(groups), budget.request_concurrency or settings.chunk_workers or 1)

        if workers > 1 and len(groups) > 1:
            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = [
                    executor.submit(_synthesize_group, provider, grp, budget, title)
                    for grp in groups
                ]
                next_level = [f.result() for f in futures]
        else:
            next_level = [
                _synthesize_group(provider, grp, budget, title)
                for grp in groups
            ]

        current = next_level

    return current[0].dna


def generate_chunked_content_dna(
    provider: LLMProvider,
    content: RawContent,
    budget: ContextBudget,
) -> ContentDNA:
    """Process a large document by chunking, then bounded synthesis."""
    chunks = chunk_document(
        content.text,
        source_id=content.source_id,
        metadata=content.metadata,
        budget=budget,
    )

    total = len(chunks)

    logger.info(
        "Processing large document: %d chunks (source_id=%s, mode=%s)",
        total,
        content.source_id,
        budget.mode,
    )

    raws = _build_chunk_raw_contents(content, chunks)

    items = _generate_chunk_partials(provider, raws, budget)

    if not items:
        raise LLMProviderError(
            "No ContentDNA could be generated from any document chunk"
        )

    final = _merge_partials(provider, items, budget, content.title)

    logger.info(
        "Large document processing completed: %d chunks merged "
        "(source_id=%s)",
        total,
        content.source_id,
    )

    return final
