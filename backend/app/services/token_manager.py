import datetime
import logging
import threading
import time
from collections import defaultdict, deque
from typing import Any

from app.models.model_info import ModelInfo, ModelListResponse, ModelProvider, ModelStatus


logger = logging.getLogger(__name__)


# Standard Model Registry Specs
# Standard Model Registry Specs
MODEL_REGISTRY: dict[str, dict[str, Any]] = {
    # OpenAI Section
    "openai/gpt-oss-120b": {
        "name": "GPT OSS 120B",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "openai",
        "section_name": "OpenAI",
        "description": "Ultra-large scale 120B open-weights model for high-fidelity nuanced outputs.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": 8000,
        "tpd_limit": 200000,
        "speed_rating": "Fast (~90 t/s)",
        "recommended_for": ["High-Signal Synthesis", "Detailed Briefs", "Research Papers"],
    },
    "openai/gpt-oss-20b": {
        "name": "GPT OSS 20B",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "openai",
        "section_name": "OpenAI",
        "description": "Balanced 20B open-weights model with high concurrency and reliability.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": 10000,
        "tpd_limit": 300000,
        "speed_rating": "Very Fast (~180 t/s)",
        "recommended_for": ["Reliable Failover", "Structured Outlines", "Audio Scripts"],
    },

    # Qwen Section
    "qwen/qwen3.8-27b": {
        "name": "Qwen 3.8 27B",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "qwen_deepseek",
        "section_name": "Qwen",
        "description": "High-capability reasoning and instruction-following model with 27B parameters.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": 6000,
        "tpd_limit": 500000,
        "speed_rating": "Very Fast (~150 t/s)",
        "recommended_for": ["Content DNA Extraction", "In-depth Articles", "Executive Memos"],
    },
    "qwen/qwen3.6-27b": {
        "name": "Qwen 3.6 27B",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "qwen_deepseek",
        "section_name": "Qwen",
        "description": "Deep thinking and reasoning model for structured multi-document synthesis.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": 6000,
        "tpd_limit": 500000,
        "speed_rating": "Very Fast (~140 t/s)",
        "recommended_for": ["Deep Reasoning", "Fact Verification", "Technical Reports"],
    },

    # Groq Compound Architecture Section
    "groq/compound": {
        "name": "Groq Compound",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "compound",
        "section_name": "Groq Compound",
        "description": "Groq's multi-expert compound architecture designed for complex reasoning tasks.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": 8000,
        "tpd_limit": 300000,
        "speed_rating": "Fast (~120 t/s)",
        "recommended_for": ["Multi-expert Synthesis", "Complex Logic", "Structured Data"],
    },
    "groq/compound-mini": {
        "name": "Groq Compound Mini",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "compound",
        "section_name": "Groq Compound",
        "description": "Lightweight ultra-fast compound model for high-throughput extraction and summaries.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": 15000,
        "tpd_limit": 500000,
        "speed_rating": "Ultra Fast (~280 t/s)",
        "recommended_for": ["Fast Summaries", "Tweets & Social Posts", "Quick Ingestion"],
    },
    "allam-2-7b": {
        "name": "ALLaM 2 7B",
        "provider": "api",
        "provider_name": "Groq Cloud",
        "section": "compound",
        "section_name": "Groq Compound",
        "description": "High-performance multilingual 7B foundation model with rapid generation.",
        "context_window": 8192,
        "max_output_tokens": 4096,
        "tpm_limit": 12000,
        "tpd_limit": 500000,
        "speed_rating": "Ultra Fast (~260 t/s)",
        "recommended_for": ["Multilingual Content", "Quick Translations", "Educational Cards"],
    },

    # Local Ollama Section
    "qwen3:8b": {
        "name": "Local Qwen 8B",
        "provider": "local",
        "provider_name": "Ollama Local",
        "section": "local",
        "section_name": "Local (Ollama)",
        "description": "Runs 100% locally on your machine via Ollama with zero cloud API usage.",
        "context_window": 32768,
        "max_output_tokens": 4096,
        "tpm_limit": None,
        "tpd_limit": None,
        "speed_rating": "Hardware Dependent",
        "recommended_for": ["Offline Work", "Sensitive Data", "Zero-Cost Execution"],
    },
}


class TokenQuotaTracker:
    """Thread-safe live token telemetry and quota tracker for all AI models."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # model -> deque of (timestamp, tokens) for 60s sliding window
        self._tpm_history: dict[str, deque[tuple[float, int]]] = defaultdict(deque)
        # model -> date_string -> int (cumulative tokens used today)
        self._daily_usage: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # model -> cooldown_until_timestamp
        self._cooldowns: dict[str, float] = {}
        # model -> exhausted_until_date
        self._exhausted_dates: dict[str, str] = {}
        # active selection
        self._active_api_model = "qwen/qwen3.8-27b"
        self._active_local_model = "qwen3:8b"
        self._active_provider: ModelProvider = "api"

    def _get_today_str(self) -> str:
        return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    def record_usage(
        self,
        model: str,
        total_tokens: int,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> None:
        if not model or total_tokens <= 0:
            return

        with self._lock:
            now = time.time()
            today = self._get_today_str()

            # Record in 60s TPM sliding window
            self._tpm_history[model].append((now, total_tokens))

            # Clean expired window entries older than 60 seconds
            while self._tpm_history[model] and self._tpm_history[model][0][0] < now - 60.0:
                self._tpm_history[model].popleft()

            # Record in daily cumulative usage
            self._daily_usage[model][today] += total_tokens

            logger.info(
                "Model %s recorded %d tokens (prompt: %d, comp: %d). Daily total: %d",
                model,
                total_tokens,
                prompt_tokens,
                completion_tokens,
                self._daily_usage[model][today],
            )

    def record_rate_limit(
        self,
        model: str,
        is_tpd: bool = False,
        retry_after: float = 30.0,
    ) -> None:
        with self._lock:
            now = time.time()
            today = self._get_today_str()

            if is_tpd:
                self._exhausted_dates[model] = today
                spec = MODEL_REGISTRY.get(model, {})
                tpd = spec.get("tpd_limit") or 100000
                self._daily_usage[model][today] = max(self._daily_usage[model][today], tpd)
                logger.warning("Model %s marked daily exhausted for %s", model, today)
            else:
                self._cooldowns[model] = now + retry_after
                logger.warning("Model %s in TPM cooldown for %.1fs", model, retry_after)

    def get_active_model(self) -> str:
        with self._lock:
            if self._active_provider == "api":
                return self._active_api_model
            return self._active_local_model

    def get_active_provider(self) -> ModelProvider:
        with self._lock:
            return self._active_provider

    def set_active_model(self, model_id: str, provider: ModelProvider = "api") -> str:
        with self._lock:
            if model_id in MODEL_REGISTRY:
                detected_provider = MODEL_REGISTRY[model_id]["provider"]
                self._active_provider = detected_provider
                if detected_provider == "api":
                    self._active_api_model = model_id
                else:
                    self._active_local_model = model_id
                return model_id
            else:
                if provider == "api":
                    self._active_api_model = model_id
                else:
                    self._active_local_model = model_id
                self._active_provider = provider
                return model_id

    def set_active_provider(self, provider: ModelProvider) -> None:
        with self._lock:
            self._active_provider = provider

    def get_model_info(self, model_id: str) -> ModelInfo:
        with self._lock:
            return self._build_model_info(model_id)

    def _build_model_info(self, model_id: str) -> ModelInfo:
        now = time.time()
        today = self._get_today_str()

        spec = MODEL_REGISTRY.get(
            model_id,
            {
                "name": model_id.split("/")[-1].replace("-", " ").title(),
                "provider": "api",
                "provider_name": "Groq Cloud",
                "description": "General purpose generative language model.",
                "context_window": 32768,
                "max_output_tokens": 4096,
                "tpm_limit": 6000,
                "tpd_limit": 100000,
                "speed_rating": "Fast",
                "recommended_for": [],
            },
        )

        provider: ModelProvider = spec["provider"]
        tpm_limit: int | None = spec.get("tpm_limit")
        tpd_limit: int | None = spec.get("tpd_limit")

        # Clean TPM window
        while self._tpm_history[model_id] and self._tpm_history[model_id][0][0] < now - 60.0:
            self._tpm_history[model_id].popleft()

        used_tpm = sum(entry[1] for entry in self._tpm_history[model_id])
        used_today = self._daily_usage[model_id].get(today, 0)

        remaining_tpm = max(0, tpm_limit - used_tpm) if tpm_limit is not None else None
        remaining_daily = max(0, tpd_limit - used_today) if tpd_limit is not None else None

        # Determine status
        status: ModelStatus = "available"
        status_message = "Ready for inference"

        cooldown_until = self._cooldowns.get(model_id, 0.0)
        is_exhausted = self._exhausted_dates.get(model_id) == today

        if provider == "local":
            status = "unlimited"
            status_message = "Unlimited local hardware tokens"
            pct_remaining = 100.0
        elif is_exhausted or (tpd_limit and remaining_daily == 0):
            status = "exhausted"
            status_message = "Daily quota reached. Resets at midnight UTC"
            pct_remaining = 0.0
        elif cooldown_until > now:
            remaining_cool = int(cooldown_until - now)
            status = "cooling_down"
            status_message = f"Rate limit cooldown ({remaining_cool}s left)"
            pct_remaining = (
                max(0.0, round((remaining_daily / tpd_limit) * 100.0, 1))
                if tpd_limit
                else 100.0
            )
        elif tpd_limit and remaining_daily is not None:
            pct_remaining = max(0.0, round((remaining_daily / tpd_limit) * 100.0, 1))
            if pct_remaining < 15.0:
                status = "near_limit"
                status_message = f"Low daily quota ({remaining_daily:,} tokens left)"
            else:
                status = "available"
                status_message = f"{remaining_daily:,} tokens available"
        else:
            pct_remaining = 100.0
            status = "available"
            status_message = "Available"

        is_active = (
            (provider == "api" and self._active_provider == "api" and self._active_api_model == model_id)
            or (provider == "local" and self._active_provider == "local" and self._active_local_model == model_id)
        )

        return ModelInfo(
            id=model_id,
            name=spec["name"],
            provider=provider,
            provider_name=spec["provider_name"],
            description=spec["description"],
            context_window=spec["context_window"],
            max_output_tokens=spec["max_output_tokens"],
            tpm_limit=tpm_limit,
            tpd_limit=tpd_limit,
            used_tpm_tokens=used_tpm,
            remaining_tpm_tokens=remaining_tpm,
            used_today_tokens=used_today,
            remaining_daily_tokens=remaining_daily,
            percentage_remaining=pct_remaining,
            status=status,
            status_message=status_message,
            is_active=is_active,
            speed_rating=spec.get("speed_rating", "Fast"),
            section=spec.get("section", "other"),
            section_name=spec.get("section_name", "Other"),
            recommended_for=spec.get("recommended_for", []),
        )

    def get_all_quotas(self) -> ModelListResponse:
        with self._lock:
            models_list = [
                self._build_model_info(mid)
                for mid in MODEL_REGISTRY.keys()
            ]

            active_model = self._active_api_model if self._active_provider == "api" else self._active_local_model
            today = self._get_today_str()
            total_today = sum(self._daily_usage[m].get(today, 0) for m in MODEL_REGISTRY.keys())

            return ModelListResponse(
                active_model=active_model,
                active_provider=self._active_provider,
                models=models_list,
                total_tokens_used_today=total_today,
            )


# Global singleton instance
token_manager = TokenQuotaTracker()
