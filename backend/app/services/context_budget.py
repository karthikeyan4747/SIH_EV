from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class ContextBudget:
    """Model-aware, TPM-aware context budget.

    All values are in tokens. For API/Groq mode the hard constraint is
    the per-minute token limit (TPM), not the model context window, so
    ``safe_input_tokens`` is the maximum USER-input tokens allowed in a
    single request after reserving room for the (large) system prompt
    and the completion.

    ``fits_single_pass`` and ``synthesis_safe_input_tokens`` both compare
    against ``safe_input_tokens`` because it already accounts for the
    system prompt and output reservation.
    """

    mode: str
    max_context_tokens: int
    tpm_limit: int
    reserved_output_tokens: int
    system_prompt_tokens: int
    safe_input_tokens: int
    chunk_target_tokens: int
    chunk_overlap_tokens: int
    max_output_tokens: int
    request_concurrency: int

    def fits_single_pass(self, est_tokens: int) -> bool:
        """True when the whole document fits one request's input budget."""
        return est_tokens <= self.safe_input_tokens

    @property
    def synthesis_safe_input_tokens(self) -> int:
        return self.safe_input_tokens


def _mode_for_provider() -> str:
    return "local" if settings.llm_provider.lower() == "ollama" else "api"


def get_context_budget(mode: str | None = None) -> ContextBudget:
    """Centralized, model- and plan-aware context budget.

    Local/Ollama (qwen3:8b, num_ctx=8192) and API/Groq (gpt-oss-120b on
    the free 8k-TPM plan) have very different limits. Groq's limit is the
    TPM, so the chunk input is derived from:

        safe_input = tpm_limit - max_output_tokens - system_prompt_tokens
    """
    mode = (mode or _mode_for_provider()).lower()

    system = settings.llm_system_prompt_tokens

    if mode == "local":
        output = settings.ollama_reserved_output_tokens
        safe_input = max(500, 8192 - system - output)

        return ContextBudget(
            mode="local",
            max_context_tokens=8192,
            tpm_limit=8192,
            reserved_output_tokens=output,
            system_prompt_tokens=system,
            safe_input_tokens=safe_input,
            chunk_target_tokens=max(
                500,
                min(settings.chunk_target_tokens_local, safe_input - 300),
            ),
            chunk_overlap_tokens=settings.chunk_overlap_tokens,
            max_output_tokens=output,
            request_concurrency=1,
        )

    tpm = settings.groq_tpm_limit
    output = settings.groq_max_output_tokens
    safe_input = max(500, tpm - output - system)

    return ContextBudget(
        mode="api",
        max_context_tokens=128_000,
        tpm_limit=tpm,
        reserved_output_tokens=output,
        system_prompt_tokens=system,
        safe_input_tokens=safe_input,
        chunk_target_tokens=max(
            500,
            min(settings.chunk_target_tokens_api, safe_input),
        ),
        chunk_overlap_tokens=settings.chunk_overlap_tokens,
        max_output_tokens=output,
        request_concurrency=settings.groq_request_concurrency,
    )
