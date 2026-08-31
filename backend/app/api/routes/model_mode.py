from typing import Literal

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from app.models.model_info import ModelListResponse, ModelSelectRequest
from app.services.content_dna import ContentDNAService
from app.services.llm import GroqProvider, OllamaProvider
from app.services.output_generation import OutputGenerationService
from app.services.token_manager import token_manager, MODEL_REGISTRY


ModelMode = Literal["local", "api"]

router = APIRouter(prefix="/api/v1/model-mode", tags=["model-mode"])


class ModelModeResponse(BaseModel):
    mode: ModelMode
    label: str
    active_model: str | None = None


def _provider_for_model(request: Request, model_id: str, mode: ModelMode):
    settings = request.app.state.settings

    if mode == "api":
        return GroqProvider(settings.groq_api_key, model_id)

    return OllamaProvider(settings.ollama_host, model_id)


def _response(mode: ModelMode, active_model: str | None = None) -> ModelModeResponse:
    return ModelModeResponse(
        mode=mode,
        label="API model" if mode == "api" else "Local model",
        active_model=active_model or token_manager.get_active_model(),
    )


@router.get("/", response_model=ModelModeResponse)
def get_model_mode(request: Request) -> ModelModeResponse:
    mode = getattr(request.app.state, "llm_provider_mode", "api")
    return _response("api" if mode == "api" else "local", token_manager.get_active_model())


@router.get("/models", response_model=ModelListResponse)
def get_available_models(request: Request) -> ModelListResponse:
    """Returns all available models with live token telemetry and quota status."""
    return token_manager.get_all_quotas()


@router.post("/select", response_model=ModelListResponse)
def select_active_model(payload: ModelSelectRequest, request: Request) -> ModelListResponse:
    """Select and activate a specific model (Groq Cloud or Ollama Local)."""
    model_id = payload.model_id
    provider = payload.provider

    if model_id not in MODEL_REGISTRY:
        # Check if custom model
        pass

    token_manager.set_active_model(model_id, provider=provider)
    request.app.state.llm_provider_mode = provider

    # Instantiate provider with chosen model
    new_provider = _provider_for_model(request, model_id, provider)
    request.app.state.content_dna_service = ContentDNAService(new_provider)
    request.app.state.output_generation_service = OutputGenerationService(new_provider)

    return token_manager.get_all_quotas()


@router.post("/toggle", response_model=ModelModeResponse)
def toggle_model_mode(request: Request) -> ModelModeResponse:
    current = getattr(request.app.state, "llm_provider_mode", "api")
    next_mode: ModelMode = "local" if current == "api" else "api"

    token_manager.set_active_provider(next_mode)
    active_model = token_manager.get_active_model()
    provider = _provider_for_model(request, active_model, next_mode)

    request.app.state.llm_provider_mode = next_mode
    request.app.state.content_dna_service = ContentDNAService(provider)
    request.app.state.output_generation_service = OutputGenerationService(provider)

    return _response(next_mode, active_model)
