import logging
import re
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.core.config import settings


logger = logging.getLogger(__name__)


PAGE_MARKER_RE = re.compile(r"\[Page\s+(\d+)\]")


class DocumentChunk(BaseModel):
    """A single processed portion of a source document.

    Chunks preserve traceability metadata so downstream evidence,
    claims, and conflicts can reference the original location.
    """

    model_config = ConfigDict(extra="forbid")

    chunk_id: str
    source_id: str
    chunk_index: int
    total_chunks: int
    page_start: int | None = None
    page_end: int | None = None
    text: str
    char_count: int
    est_token_count: int


def estimate_tokens(text: str, ratio: float | None = None) -> int:
    """Conservative token estimate from character count.

    An exact tokenizer is not available for both Ollama and Groq, so we
    use a configurable chars:token ratio (default 0.25 => 4 chars/token)
    which is conservative for English text.
    """
    if not text:
        return 0

    ratio = settings.token_estimate_ratio if ratio is None else ratio

    return max(1, round(len(text) * ratio))


def _split_paragraphs(text: str) -> list[str]:
    """Split text into paragraph units on blank lines."""
    raw_units = re.split(r"\n\s*\n", text)
    units: list[str] = []

    for unit in raw_units:
        unit = unit.strip()

        if not unit:
            continue

        units.append(unit)

    return units


def _split_sentences(paragraph: str) -> list[str]:
    """Split a paragraph into sentence-ish units at sentence boundaries."""
    parts = re.split(r"(?<=[.!?])\s+|\n", paragraph)

    return [part.strip() for part in parts if part.strip()]


def _split_by_chars(text: str, target_tokens: int, ratio: float) -> list[str]:
    """Hard fallback: split a unit that still exceeds the target by tokens.

    Splits on whitespace so words are never cut, staying under the target.
    """
    max_chars = max(1, int(target_tokens / ratio))
    words = text.split()
    chunks: list[str] = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()

        if len(candidate) > max_chars and current:
            chunks.append(current)
            current = word
        else:
            current = candidate

    if current:
        chunks.append(current)

    return chunks


def _to_units(text: str, target_tokens: int, ratio: float) -> list[str]:
    """Break the document into granular units not exceeding the target."""
    units: list[str] = []

    for paragraph in _split_paragraphs(text):
        if estimate_tokens(paragraph, ratio) <= target_tokens:
            units.append(paragraph)
            continue

        sentences = _split_sentences(paragraph)

        for sentence in sentences:
            if estimate_tokens(sentence, ratio) <= target_tokens:
                units.append(sentence)
                continue

            units.extend(
                _split_by_chars(sentence, target_tokens, ratio)
            )

    return units


def _detect_pages(chunk_text: str) -> tuple[int | None, int | None]:
    numbers = [
        int(match)
        for match in PAGE_MARKER_RE.findall(chunk_text)
    ]

    if not numbers:
        return None, None

    return min(numbers), max(numbers)


def _apply_overlap(
    chunks_text: list[str],
    overlap_tokens: int,
    ratio: float,
) -> list[str]:
    """Prepend a small continuity tail from the previous chunk.

    Overlap helps the model avoid cutting a table or list exactly at a
    boundary. The original text is never discarded; overlap only adds a
    little context to the start of the next chunk.
    """
    if overlap_tokens <= 0 or len(chunks_text) < 2:
        return chunks_text

    overlap_chars = max(1, int(overlap_tokens / ratio))
    result: list[str] = [chunks_text[0]]

    for index in range(1, len(chunks_text)):
        tail = chunks_text[index - 1][-overlap_chars:]
        result.append(f"{tail}\n\n{chunks_text[index]}")

    return result


def chunk_document(
    text: str,
    *,
    source_id: str = "",
    metadata: dict[str, Any] | None = None,
    budget: Any = None,
    token_ratio: float | None = None,
) -> list[DocumentChunk]:
    """Split a source document into token-aware, structurally-bounded chunks.

    Boundary priority: paragraph -> sentence -> safe character boundary.
    Page markers of the form ``[Page N]`` (produced by the PDF ingestion
    pipeline) are detected so each chunk records its page range. Small
    documents that already fit the context window are returned as a single
    chunk so existing behavior is preserved.
    """
    text = text or ""

    if not text.strip():
        return []

    from app.services.context_budget import ContextBudget

    budget = budget or ContextBudget(
        mode="api",
        max_context_tokens=128_000,
        reserved_output_tokens=settings.api_reserved_output_tokens,
        system_prompt_tokens=settings.llm_system_prompt_tokens,
        safe_input_tokens=24_000,
        chunk_target_tokens=settings.chunk_target_tokens_api,
        chunk_overlap_tokens=settings.chunk_overlap_tokens,
    )

    ratio = settings.token_estimate_ratio if token_ratio is None else token_ratio
    target_tokens = budget.chunk_target_tokens
    est_total = estimate_tokens(text, ratio)

    # Small documents: keep the existing single-pass behavior.
    if est_total <= target_tokens:
        page_start, page_end = _detect_pages(text)

        return [
            DocumentChunk(
                chunk_id=f"{source_id or 'src'}-chunk-0001",
                source_id=source_id,
                chunk_index=0,
                total_chunks=1,
                page_start=page_start,
                page_end=page_end,
                text=text,
                char_count=len(text),
                est_token_count=est_total,
            )
        ]

    units = _to_units(text, target_tokens, ratio)

    chunks_text: list[str] = []
    current = ""

    for unit in units:
        candidate = f"{current}\n\n{unit}" if current else unit

        if current and estimate_tokens(candidate, ratio) > target_tokens:
            chunks_text.append(current)
            current = unit
        else:
            current = candidate

    if current.strip():
        chunks_text.append(current)

    chunks_text = _apply_overlap(
        chunks_text,
        budget.chunk_overlap_tokens,
        ratio,
    )

    total = len(chunks_text)
    chunks: list[DocumentChunk] = []

    for index, chunk_text in enumerate(chunks_text):
        page_start, page_end = _detect_pages(chunk_text)

        chunks.append(
            DocumentChunk(
                chunk_id=f"{source_id or 'src'}-chunk-{index + 1:04d}",
                source_id=source_id,
                chunk_index=index,
                total_chunks=total,
                page_start=page_start,
                page_end=page_end,
                text=chunk_text,
                char_count=len(chunk_text),
                est_token_count=estimate_tokens(chunk_text, ratio),
            )
        )

    return chunks
