from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GenAI Content Transformation Platform"
    app_version: str = "0.1.0"
    port: int = 8000

    groq_api_key: str = ""
    groq_api_keys: str = ""
    groq_model: str = "qwen/qwen3.8-27b"

    def get_groq_api_keys(self) -> list[str]:
        raw_keys: list[str] = []
        if self.groq_api_keys:
            raw_keys.extend(self.groq_api_keys.replace("\n", ",").replace(";", ",").split(","))
        if self.groq_api_key:
            raw_keys.extend(self.groq_api_key.replace("\n", ",").replace(";", ",").split(","))

        seen = set()
        keys: list[str] = []
        for k in raw_keys:
            cleaned = k.strip().strip("\"'")
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                keys.append(cleaned)
        return keys

    llm_provider: str = "groq"

    ollama_host: str = "http://127.0.0.1:11434"

    ollama_model: str = "qwen3:8b"

    max_source_chars: int = 1_500_000

    # ---- Large-document chunking ----
    # Conservative character:token ratio (English ~4 chars/token).
    token_estimate_ratio: float = 0.25
    # Target tokens per chunk sized for maximum speed (9-10 pages per request).
    chunk_target_tokens_api: int = 3800
    chunk_target_tokens_local: int = 4000
    chunk_overlap_tokens: int = 100
    # How many partial ContentDNA objects are merged per synthesis call.
    merge_group_size: int = 8
    # Bounded retries for transient LLM failures on a chunk/synthesis.
    max_chunk_retries: int = 3
    # Controlled concurrency for chunk processing (API mode only).
    chunk_workers: int = 1
    # Reserved token budgets used by the centralized context calculator.
    llm_system_prompt_tokens: int = 300
    api_reserved_output_tokens: int = 800
    ollama_reserved_output_tokens: int = 1200

    # ---- Groq / API mode TPM budgeting ----
    # 6000 TPM is Groq's free-tier per-minute limit.
    groq_tpm_limit: int = 6000
    groq_chunk_input_tokens: int = 3800
    groq_max_output_tokens: int = 800
    groq_request_concurrency: int = 1
    groq_generation_max_output_tokens: int = 2000
    groq_max_retries: int = 5
    groq_backoff_base_seconds: int = 2

    max_upload_size_bytes: int = 256 * 1024 * 1024

    storage_path: str = "data/sources.json"
    transformation_storage_path: str = "data/transformations.json"

    allowed_origins: str = (
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:5174,http://localhost:5174,"
        "http://127.0.0.1:5175,http://localhost:5175,"
        "http://127.0.0.1:5176,http://localhost:5176,"
        "http://127.0.0.1:5177,http://localhost:5177,"
        "http://127.0.0.1:5178,http://localhost:5178,"
        "http://127.0.0.1:5179,http://localhost:5179,"
        "http://localhost:5500,"
        "https://ev-sih.vercel.app/"
        "http://localhost:5500"
    )

    ffmpeg_path: str = (
        r"C:\Users\Karthikeyan K\AppData\Local\Microsoft\WinGet"
        r"\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\ffmpeg-9.0-full_build\bin\ffmpeg.exe"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
