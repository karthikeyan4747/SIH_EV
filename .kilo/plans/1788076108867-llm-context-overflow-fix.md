# Fix LLM Context Overflow for Large Documents

## Problem

Large source documents (especially PDFs) cause `generate_content_dna` to fail with:
- **Groq:** `Please reduce the length of the messages or completion` (400 Bad Request)
- **Ollama:** likely silent truncation or failure at 8192 token context

Root cause: no content-length guard exists anywhere in the pipeline. The very long system prompt + large extracted text exceeds provider context windows.

## Goal

Gracefully handle large documents without breaking existing API/Groq mode or the Ollama schema normalization fix. Preserve full text in the database for display; only truncate what is sent to the LLM.

## Design Decisions

### 1. Where to truncate
**Decision:** Truncate inside `backend/app/services/llm.py`, in both `GroqProvider` and `OllamaProvider`, immediately before constructing prompts.

**Rationale:** 
- The full `content.text` is still needed for frontend display, conflict resolution, and provenance
- Truncation is an LLM-runtime concern, not an ingestion concern
- Keeps the change localized and provider-specific

### 2. How to measure and truncate
**Decision:** Add a `_truncate_content(text: str) -> str` static method on `OllamaProvider` (and mirror in `GroqProvider` or extract to a shared module).

- Use a configurable `max_source_chars` (default: `50_000` chars ≈ 12,500 tokens)
- If `len(text) > max_source_chars`, truncate to `max_source_chars` and append a clear marker:
  ```
  \n\n[...CONTENT TRUNCATED — {original_length} characters total, showing first {max_source_chars} characters...]\n\n```
- The truncation marker is included in the prompt so the LLM knows the input is partial

**Why characters instead of tokens:** Token counting requires an extra dependency (tiktoken) or provider API call. A 4:1 char-to-token ratio is a safe conservative estimate for English text.

### 3. Config
**Decision:** Add `max_source_chars: int = 50_000` to `backend/app/core/config.py` under `Settings`.

- Environment-overridable via `.env`
- Default chosen to fit comfortably inside Groq + Ollama context windows after the long system prompt

### 4. Prompt updates
**Decision:** Add a single line to both provider system prompts instructing the LLM to work with whatever source text is provided, even if truncated.

**Rationale:** The LLM should not assume it saw the full document. It should extract DNA from what is visible and leave sections empty if the relevant information was in the truncated portion.

### 5. Logging
**Decision:** Log a warning when truncation occurs:
```
Source {source_id} truncated from {original_length} to {max_source_chars} chars for {provider} model {model}
```

## Files to change

| File | Change |
|------|--------|
| `backend/app/core/config.py` | Add `max_source_chars: int = 50_000` |
| `backend/app/services/llm.py` | Add `_truncate_content()` static method; call it in both `GroqProvider.generate_content_dna` and `OllamaProvider.generate_content_dna` before prompt construction; add truncation notice to system prompts; log truncation events |

## What stays unchanged
- `ContentDNA` Pydantic model (already fixed)
- `_normalize_ollama_dna()` (already working)
- `_extract_json()` (already working)
- All ingestion providers (PDF, DOCX, etc.)
- Frontend code
- Max upload size (already 100 MB)

## Validation steps

1. **Small text source in local mode** — should work, no truncation
2. **Normal PDF (few pages) in local mode** — should work, no truncation
3. **Large PDF (30 MB / many pages) in local mode** — should succeed with truncation warning in logs
4. **Large source in API/Groq mode** — should succeed where it previously 500'd
5. **Existing ContentDNA display** — unchanged (full text still in DB)
6. **Conflict/integrity functionality** — unchanged (works on stored DNA, not raw text)
7. **Backend tests** — run `./venv/bin/python -m pytest tests/ -v`
8. **Frontend typecheck** — run `npx tsc --noEmit`

## Remaining limitation

Even with truncation, very large documents will lose information from the tail. This is an inherent LLM context-window limitation. A future improvement would be chunked extraction (split document → extract DNA per chunk → merge), but that is out of scope for this fix and requires more extensive changes to `ContentDNA` merging logic.
