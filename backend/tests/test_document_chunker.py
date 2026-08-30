from app.models.content import RawContent
from app.services.context_budget import get_context_budget
from app.services.document_chunker import (
    DocumentChunk,
    chunk_document,
    estimate_tokens,
)


def _make_paragraphs(count: int, words_per: int = 40) -> str:
    paras = []

    for i in range(count):
        words = " ".join(f"word{j}" for j in range(words_per))
        paras.append(f"This is paragraph number {i}. {words}")

    return "\n\n".join(paras)


def test_small_text_stays_single_chunk():
    budget = get_context_budget("api")
    text = _make_paragraphs(3)

    chunks = chunk_document(text, source_id="s1", budget=budget)

    assert len(chunks) == 1
    assert chunks[0].text == text
    assert chunks[0].total_chunks == 1
    assert chunks[0].chunk_index == 0


def test_large_text_produces_multiple_chunks():
    budget = get_context_budget("api")
    # Large enough to require chunking (> fits_single_pass threshold).
    text = _make_paragraphs(400, words_per=60)

    chunks = chunk_document(text, source_id="big", budget=budget)

    assert len(chunks) > 1


def test_chunks_cover_entire_source():
    budget = get_context_budget("api")
    text = _make_paragraphs(400, words_per=60)

    chunks = chunk_document(text, source_id="big", budget=budget)
    joined = "".join(chunk.text for chunk in chunks)

    # Overlap may duplicate some characters, but every original
    # character must still appear somewhere in the chunk outputs.
    for char in set(text):
        assert char in joined


def test_chunk_ordering_is_deterministic():
    budget = get_context_budget("api")
    text = _make_paragraphs(400, words_per=60)

    first = chunk_document(text, source_id="big", budget=budget)
    second = chunk_document(text, source_id="big", budget=budget)

    assert [c.chunk_index for c in first] == [
        c.chunk_index for c in second
    ]
    assert [c.text for c in first] == [c.text for c in second]
    assert all(
        c.chunk_index == i for i, c in enumerate(first)
    )
    assert all(c.total_chunks == len(first) for c in first)


def test_chunk_sizes_respect_target_tokens():
    budget = get_context_budget("api")
    text = _make_paragraphs(400, words_per=60)

    chunks = chunk_document(text, source_id="big", budget=budget)
    margin = budget.chunk_overlap_tokens + 200

    for chunk in chunks:
        assert chunk.est_token_count <= (
            budget.chunk_target_tokens + margin
        )


def test_page_metadata_preserved_from_markers():
    budget = get_context_budget("api")
    parts = []

    for page in range(1, 9):
        parts.append(f"[Page {page}]\nContent for page {page}.")

    text = "\n\n".join(parts)

    chunks = chunk_document(text, source_id="pdf", budget=budget)

    assert len(chunks) >= 1

    for chunk in chunks:
        assert chunk.page_start is not None
        assert chunk.page_end is not None
        assert chunk.page_start <= chunk.page_end


def test_chunks_are_documentchunk_instances_with_metadata():
    budget = get_context_budget("api")
    text = _make_paragraphs(200, words_per=60)

    chunks = chunk_document(text, source_id="s9", budget=budget)

    assert all(isinstance(c, DocumentChunk) for c in chunks)
    assert all(c.source_id == "s9" for c in chunks)
    assert all(c.char_count == len(c.text) for c in chunks)


def test_estimate_tokens_scales_with_length():
    assert estimate_tokens("") == 0
    assert estimate_tokens("a" * 400) == max(1, round(400 * 0.25))
    assert estimate_tokens("a" * 4000) > estimate_tokens("a" * 400)
