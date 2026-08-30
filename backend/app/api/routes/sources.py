from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from pydantic import ValidationError

from app.models.content import ContentDNA
from app.models.content_update import ContentDNAUpdate
from app.models.source import SourceCreatedResponse, SourceResponse, TextSourceRequest
from app.services.content_dna import ContentDNAService
from app.services.ingestion import (
    AudioIngestionProvider,
    DOCXIngestionProvider,
    ImageIngestionProvider,
    IngestionError,
    PDFIngestionProvider,
    TXTIngestionProvider,
    VideoIngestionProvider,
)
from app.services.llm import LLMProviderError
from app.services.storage import LocalJSONStorage, SourceNotFoundError, SourceRecord

router = APIRouter(prefix="/api/v1/sources", tags=["sources"])


def _storage(request: Request) -> LocalJSONStorage:
    return request.app.state.storage


def _dna_service(request: Request) -> ContentDNAService:
    return request.app.state.content_dna_service


def _create_source(request: Request, raw_content) -> SourceCreatedResponse:
    try:
        content_dna = _dna_service(request).extract(raw_content)
        _storage(request).save(SourceRecord(source=raw_content, content_dna=content_dna))
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail="Source could not be stored") from exc
    return SourceCreatedResponse(
        source_id=raw_content.source_id,
        source_type=raw_content.source_type,
        content_dna=content_dna,
    )


@router.post("/text", response_model=SourceCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_text_source(payload: TextSourceRequest, request: Request) -> SourceCreatedResponse:
    try:
        raw_content = TXTIngestionProvider().ingest(
            str(uuid4()),
            payload.title,
            payload.text.encode("utf-8"),
        )
    except IngestionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _create_source(request, raw_content)


@router.post(
    "/file",
    response_model=SourceCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_file_source(
    request: Request,
    file: UploadFile = File(...),
) -> SourceCreatedResponse:
    filename = file.filename or ""
    suffix = (
        filename.lower().rsplit(".", 1)[-1]
        if "." in filename
        else ""
    )

    if suffix not in {
        "txt",
        "pdf",
        "docx",
        "png",
        "jpg",
        "jpeg",
        "webp",
        "mp3",
        "wav",
        "m4a",
        "aac",
        "ogg",
        "flac",
        "wma",
        "mp4",
        "mov",
        "mkv",
        "webm",
        "avi",
    }:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type",
        )

    content = await file.read()

    if (
        len(content)
        > request.app.state.settings.max_upload_size_bytes
    ):
        raise HTTPException(
            status_code=413,
            detail="File is too large. Maximum supported file size is 256 MB.",
        )

    try:
        if suffix == "txt":
            provider = TXTIngestionProvider()
        elif suffix == "pdf":
            provider = PDFIngestionProvider()
        elif suffix == "docx":
            provider = DOCXIngestionProvider()
        elif suffix in {"png", "jpg", "jpeg", "webp"}:
            provider = ImageIngestionProvider()
        elif suffix in {"mp3", "wav", "m4a", "aac", "ogg", "flac", "wma"}:
            provider = AudioIngestionProvider()
        else:
            provider = VideoIngestionProvider()

        raw_content = provider.ingest(
            str(uuid4()),
            filename,
            content,
        )

    except IngestionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    return _create_source(request, raw_content)


@router.get("/{source_id}", response_model=SourceResponse)
def get_source(source_id: str, request: Request) -> SourceResponse:
    try:
        return SourceResponse(**_storage(request).get(source_id).model_dump())
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Source not found") from exc


@router.get("/{source_id}/content-dna", response_model=ContentDNA)
def get_content_dna(source_id: str, request: Request) -> ContentDNA:
    try:
        return _storage(request).get(source_id).content_dna
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Source not found") from exc


@router.put("/{source_id}/content-dna", response_model=ContentDNA)
def update_content_dna(source_id: str, content_dna: ContentDNA, request: Request) -> ContentDNA:
    try:
        record = _storage(request).get(source_id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Source not found") from exc
    updated_record = SourceRecord(source=record.source, content_dna=content_dna)
    try:
        _storage(request).save(updated_record)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail="Content DNA could not be stored") from exc
    return content_dna


def _merge_updates(existing: dict, updates: dict) -> dict:
    merged = existing.copy()
    for field, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(field), dict):
            merged[field] = _merge_updates(merged[field], value)
        else:
            merged[field] = value
    return merged


@router.patch("/{source_id}/content-dna", response_model=ContentDNA)
def patch_content_dna(source_id: str, update: ContentDNAUpdate, request: Request) -> ContentDNA:
    try:
        record = _storage(request).get(source_id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Source not found") from exc

    merged_data = _merge_updates(
        record.content_dna.model_dump(),
        update.model_dump(exclude_unset=True),
    )
    try:
        merged_content_dna = ContentDNA.model_validate(merged_data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid Content DNA update") from exc

    try:
        _storage(request).save(SourceRecord(source=record.source, content_dna=merged_content_dna))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail="Content DNA could not be stored") from exc
    return merged_content_dna
