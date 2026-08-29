from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services.content_dna import ContentDNAService
from app.services.llm import GroqProvider, OllamaProvider
from app.services.output_generation import OutputGenerationService


ModelMode = Literal["local", "api"]

router = APIRouter(prefix="/api/v1/model-mode", tags=["model-mode"])


class ModelModeResponse(BaseModel):
    mode: ModelMode
    label: str


def _provider_for_mode(request: Request, mode: ModelMode):
    settings = request.app.state.settings

    if mode == "api":
        return GroqProvider(settings.groq_api_key, settings.groq_model)

    return OllamaProvider(settings.ollama_host, settings.ollama_model)


def _response(mode: ModelMode) -> ModelModeResponse:
    return ModelModeResponse(
        mode=mode,
        label="API model" if mode == "api" else "Local model",
    )


@router.get("/", response_model=ModelModeResponse)
def get_model_mode(request: Request) -> ModelModeResponse:
    mode = getattr(request.app.state, "llm_provider_mode", "local")
    return _response("api" if mode == "api" else "local")


@router.post("/toggle", response_model=ModelModeResponse)
def toggle_model_mode(request: Request) -> ModelModeResponse:
    current = getattr(request.app.state, "llm_provider_mode", "local")
    next_mode: ModelMode = "local" if current == "api" else "api"
    provider = _provider_for_mode(request, next_mode)

    request.app.state.llm_provider_mode = next_mode
    request.app.state.content_dna_service = ContentDNAService(provider)
    request.app.state.output_generation_service = OutputGenerationService(provider)

    return _response(next_mode)
