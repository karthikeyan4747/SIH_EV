from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.sources import router as sources_router
from app.api.routes.transformations import router as transformations_router
from app.core.config import settings
from app.services.content_dna import ContentDNAService
from app.services.llm import GroqProvider,OllamaProvider
from app.services.output_generation import OutputGenerationService
from app.services.structure_extraction import StructureExtractionService
from app.services.storage import LocalJSONStorage, LocalTransformationStorage

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
	CORSMiddleware,
	allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()],
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(sources_router)
app.include_router(transformations_router)
app.state.settings = settings
app.state.storage = LocalJSONStorage(settings.storage_path)
app.state.transformation_storage = LocalTransformationStorage(settings.transformation_storage_path)

if settings.llm_provider.lower() == "ollama":
    provider = OllamaProvider(
        host=settings.ollama_host,
        model=settings.ollama_model,
    )
else:
    provider = GroqProvider(
        settings.groq_api_key,
        settings.groq_model,
    )

app.state.content_dna_service = ContentDNAService(
    provider
)

app.state.output_generation_service = OutputGenerationService(
    provider
)

app.state.structure_extraction_service = StructureExtractionService()