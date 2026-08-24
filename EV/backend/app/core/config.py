from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GenAI Content Transformation Platform"
    app_version: str = "0.1.0"
    port: int = 8000

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    max_upload_size_bytes: int = 10 * 1024 * 1024

    storage_path: str = "data/sources.json"
    transformation_storage_path: str = "data/transformations.json"

    allowed_origins: str = (
        "http://127.0.0.1:5173,http://localhost:5173"
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