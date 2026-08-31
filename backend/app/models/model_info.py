from typing import Literal
from pydantic import BaseModel, Field


ModelProvider = Literal["api", "local"]
ModelStatus = Literal["available", "near_limit", "cooling_down", "exhausted", "unlimited", "offline"]


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: ModelProvider
    provider_name: str
    description: str
    context_window: int
    max_output_tokens: int
    tpm_limit: int | None = None
    tpd_limit: int | None = None
    used_tpm_tokens: int = 0
    remaining_tpm_tokens: int | None = None
    used_today_tokens: int = 0
    remaining_daily_tokens: int | None = None
    percentage_remaining: float = 100.0
    status: ModelStatus = "available"
    status_message: str = "Ready"
    is_active: bool = False
    speed_rating: str = "Fast"
    section: str = "other"
    section_name: str = "Other"
    recommended_for: list[str] = Field(default_factory=list)


class ModelListResponse(BaseModel):
    active_model: str
    active_provider: ModelProvider
    models: list[ModelInfo]
    total_tokens_used_today: int = 0


class ModelSelectRequest(BaseModel):
    model_id: str
    provider: ModelProvider = "api"
