from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from pydantic import ValidationError

from app.core.config import settings
from app.models.content import ContentDNA, RawContent
from app.models.content_update import ContentDNAUpdate
from app.models.transformation import (
    ConflictResolution,
    DNAVersion,
    OutputGenerateRequest,
    SearchResponse,
    SearchResult,
    SourceIntegrity,
    Structure,
    StructureCreateRequest,
    StructureReferenceRequest,
    StructureSection,
    TextSourceAddRequest,
    Transformation,
    TransformationCreateRequest,
    TransformationListResponse,
    TransformationRenameRequest,
    URLSourceAddRequest,
    UnsupportedSourceRequest,
    WorkflowTemplate,
)

from app.services.content_dna import ContentDNAService
from app.services.ingestion import (
    IngestionError,
    PDFIngestionProvider,
    TXTIngestionProvider,
    TextIngestionProvider,
    URLIngestionProvider,
    UnsupportedIngestionProvider,
    DOCXIngestionProvider,
    YouTubeIngestionProvider,
    ImageIngestionProvider,
    AudioIngestionProvider,
    VideoIngestionProvider,
)

from app.services.llm import LLMProviderError
from app.services.output_generation import OutputGenerationService
from app.services.structure_extraction import (
    StructureExtractionError,
    StructureExtractionService,
)
from app.services.storage import (
    LocalTransformationStorage,
    TransformationNotFoundError,
)
from app.services.workflows import (
    get_workflow_templates,
    save_custom_workflow,
)
from app.services.source_integrity import (
    SourceIntegrityError,
    SourceIntegrityService,
)


router = APIRouter(
    prefix="/api/v1/transformations",
    tags=["transformations"],
)


# ============================================================
# DEPENDENCIES / HELPERS
# ============================================================


def _storage(request: Request) -> LocalTransformationStorage:
    return request.app.state.transformation_storage


def _dna_service(request: Request) -> ContentDNAService:
    return request.app.state.content_dna_service


def _outputs(request: Request) -> OutputGenerationService:
    return request.app.state.output_generation_service


def _structure_extractor(
    request: Request,
) -> StructureExtractionService:
    return request.app.state.structure_extraction_service


def _get_transformation(
    transformation_id: str,
    request: Request,
) -> Transformation:
    try:
        return _storage(request).get(transformation_id)
    except TransformationNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="Transformation not found",
        ) from exc


def _apply_first_source_title(
    transformation: Transformation,
    source: RawContent,
) -> Transformation:
    if (
        transformation.title == "Untitled Transformation"
        and source.title
    ):
        return transformation.model_copy(
            update={"title": source.title}
        )

    return transformation


def _merge_updates(existing: dict, updates: dict) -> dict:
    merged = existing.copy()

    for field, value in updates.items():
        if (
            isinstance(value, dict)
            and isinstance(merged.get(field), dict)
        ):
            merged[field] = _merge_updates(
                merged[field],
                value,
            )
        else:
            merged[field] = value

    return merged


def _recompute_dna(
    transformation: Transformation,
    request: Request,
) -> ContentDNA | None:
    supported_sources = [
        source
        for source in transformation.sources
        if source.metadata.get("status") != "unsupported"
        and source.text.strip()
    ]

    if not supported_sources:
        return None

    try:
        if len(supported_sources) == 1:
            return _dna_service(request).extract(
                supported_sources[0]
            )

        return _dna_service(request).extract_from_sources(
            supported_sources
        )

    except LLMProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


def _save_dna_version(
    transformation: Transformation,
    note: str,
) -> Transformation:
    if transformation.content_dna is None:
        return transformation

    next_version = len(transformation.versions) + 1

    return transformation.model_copy(
        update={
            "versions": [
                *transformation.versions,
                DNAVersion(
                    version=next_version,
                    content_dna=transformation.content_dna,
                    note=note,
                ),
            ],
        }
    )


# ============================================================
# APPLY SOURCE-INTEGRITY RESOLUTION TO CONTENT DNA
# ============================================================


def apply_resolution_to_dna(
    dna: ContentDNA,
    claim_key: str,
    final_value: str,
) -> ContentDNA:
    """
    Apply a resolved source-integrity claim to the
    appropriate Content DNA dimension.
    """

    facts = dna.facts
    findings = dna.findings
    entities = dna.entities

    # --------------------------------------------------------
    # Overall winner / major conclusion
    # --------------------------------------------------------

    if claim_key in {
        "declared_overall_winner",
        "overall_winner",
        "winner",
    }:
        text = f"Overall winner: {final_value}"

        existing = [
            item
            for item in findings.key_findings
            if not item.lower().startswith(
                "overall winner:"
            )
        ]

        updated_findings = findings.model_copy(
            update={
                "key_findings": [
                    *existing,
                    text,
                ]
            }
        )

        return dna.model_copy(
            update={
                "findings": updated_findings,
            }
        )

    # --------------------------------------------------------
    # Input types
    # --------------------------------------------------------

    if claim_key in {
        "supports_input_types",
        "supported_input_types",
        "input_types",
    }:
        text = (
            f"Supported input types: {final_value}"
        )

        existing = [
            item
            for item in facts.claims
            if not item.lower().startswith(
                "supported input types:"
            )
        ]

        updated_facts = facts.model_copy(
            update={
                "claims": [
                    *existing,
                    text,
                ]
            }
        )

        return dna.model_copy(
            update={
                "facts": updated_facts,
            }
        )

    # --------------------------------------------------------
    # LLM inference modes
    # --------------------------------------------------------

    if claim_key in {
        "supports_llm_inference",
        "llm_inference_modes",
        "inference_modes",
    }:
        text = (
            f"LLM inference modes: {final_value}"
        )

        existing = [
            item
            for item in facts.claims
            if not item.lower().startswith(
                "llm inference modes:"
            )
        ]

        updated_facts = facts.model_copy(
            update={
                "claims": [
                    *existing,
                    text,
                ]
            }
        )

        return dna.model_copy(
            update={
                "facts": updated_facts,
            }
        )

    # --------------------------------------------------------
    # Cloud LLM provider
    # --------------------------------------------------------

    if claim_key in {
        "uses_cloud_llm_provider",
        "cloud_llm_provider",
    }:
        text = (
            f"Cloud LLM provider: {final_value}"
        )

        existing_claims = [
            item
            for item in facts.claims
            if not item.lower().startswith(
                "cloud llm provider:"
            )
        ]

        updated_facts = facts.model_copy(
            update={
                "claims": [
                    *existing_claims,
                    text,
                ]
            }
        )

        existing_technologies = list(
            entities.technologies
        )

        if final_value not in existing_technologies:
            existing_technologies.append(
                final_value
            )

        updated_entities = entities.model_copy(
            update={
                "technologies": existing_technologies,
            }
        )

        return dna.model_copy(
            update={
                "facts": updated_facts,
                "entities": updated_entities,
            }
        )

    # --------------------------------------------------------
    # Local LLM technology
    # --------------------------------------------------------

    if claim_key in {
        "uses_local_llm_technology",
        "local_llm_technology",
        "local_llm",
    }:
        text = (
            f"Local LLM technology: {final_value}"
        )

        existing_claims = [
            item
            for item in facts.claims
            if not item.lower().startswith(
                "local llm technology:"
            )
        ]

        updated_facts = facts.model_copy(
            update={
                "claims": [
                    *existing_claims,
                    text,
                ]
            }
        )

        existing_technologies = list(
            entities.technologies
        )

        if final_value not in existing_technologies:
            existing_technologies.append(
                final_value
            )

        updated_entities = entities.model_copy(
            update={
                "technologies": existing_technologies,
            }
        )

        return dna.model_copy(
            update={
                "facts": updated_facts,
                "entities": updated_entities,
            }
        )

    # --------------------------------------------------------
    # Fallback
    # --------------------------------------------------------

    text = (
        f"{claim_key.replace('_', ' ').capitalize()}: "
        f"{final_value}"
    )

    existing = list(facts.claims)

    existing = [
        item
        for item in existing
        if not item.lower().startswith(
            f"{claim_key.replace('_', ' ').lower()}:"
        )
    ]

    updated_facts = facts.model_copy(
        update={
            "claims": [
                *existing,
                text,
            ]
        }
    )

    return dna.model_copy(
        update={
            "facts": updated_facts,
        }
    )


# ============================================================
# TRANSFORMATION COLLECTION
# ============================================================


@router.get(
    "",
    response_model=TransformationListResponse,
)
def list_transformations(
    request: Request,
) -> TransformationListResponse:
    return TransformationListResponse(
        transformations=_storage(request).list()
    )


@router.post(
    "",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
def create_transformation(
    payload: TransformationCreateRequest,
    request: Request,
) -> Transformation:
    transformation = Transformation(
        id=str(uuid4()),
        title=payload.title.strip()
        or "Untitled Transformation",
    )

    return _storage(request).save(transformation)


# ============================================================
# WORKFLOWS
# IMPORTANT: STATIC /workflows ROUTES MUST COME BEFORE
# /{transformation_id} ROUTES.
# ============================================================


@router.get(
    "/workflows",
    response_model=list[WorkflowTemplate],
)
def list_workflows() -> list[WorkflowTemplate]:
    return get_workflow_templates()


@router.post(
    "/workflows",
    response_model=WorkflowTemplate,
    status_code=status.HTTP_201_CREATED,
)
def create_workflow(
    payload: WorkflowTemplate,
) -> WorkflowTemplate:
    return save_custom_workflow(payload)


# ============================================================
# SINGLE TRANSFORMATION
# ============================================================


@router.get(
    "/{transformation_id}",
    response_model=Transformation,
)
def get_transformation(
    transformation_id: str,
    request: Request,
) -> Transformation:
    return _get_transformation(
        transformation_id,
        request,
    )


@router.delete(
    "/{transformation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transformation(
    transformation_id: str,
    request: Request,
) -> None:
    try:
        _storage(request).delete(transformation_id)
    except TransformationNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="Transformation not found",
        ) from exc


@router.patch(
    "/{transformation_id}/title",
    response_model=Transformation,
)
def rename_transformation(
    transformation_id: str,
    payload: TransformationRenameRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    return _storage(request).save(
        transformation.model_copy(
            update={
                "title": payload.title.strip(),
            }
        )
    )


# ============================================================
# TEXT SOURCE
# ============================================================


@router.post(
    "/{transformation_id}/sources/text",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
def add_text_source(
    transformation_id: str,
    payload: TextSourceAddRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    try:
        source = TextIngestionProvider().ingest(
            str(uuid4()),
            payload.title,
            payload.text,
        )
    except IngestionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    updated = transformation.model_copy(
        update={
            "sources": [
                *transformation.sources,
                source,
            ],
            "status": "processing",
        }
    )

    updated = _apply_first_source_title(
        updated,
        source,
    )

    content_dna = _recompute_dna(
        updated,
        request,
    )

    updated = updated.model_copy(
        update={
            "content_dna": content_dna,
            "status": "ready"
            if content_dna
            else "empty",
        }
    )

    if content_dna is not None:
        updated = _save_dna_version(
            updated,
            "Generated from text source",
        )

    return _storage(request).save(updated)


# ============================================================
# FILE SOURCE
# ============================================================


@router.post(
    "/{transformation_id}/sources/file",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
async def add_file_source(
    transformation_id: str,
    request: Request,
    file: UploadFile = File(...),
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

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
            detail="Uploaded file is too large",
        )

    try:
        if suffix == "txt":
            provider = TXTIngestionProvider()

        elif suffix == "pdf":
            provider = PDFIngestionProvider()

        elif suffix == "docx":
            provider = DOCXIngestionProvider()

        elif suffix in {
            "png",
            "jpg",
            "jpeg",
            "webp",
        }:
            provider = ImageIngestionProvider()

        elif suffix in {
            "mp3",
            "wav",
            "m4a",
            "aac",
            "ogg",
            "flac",
            "wma",
        }:
            provider = AudioIngestionProvider()

        else:
            provider = VideoIngestionProvider()

        source = provider.ingest(
            str(uuid4()),
            filename,
            content,
        )

    except IngestionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    updated = transformation.model_copy(
        update={
            "sources": [
                *transformation.sources,
                source,
            ],
            "status": "processing",
        }
    )

    updated = _apply_first_source_title(
        updated,
        source,
    )

    content_dna = _recompute_dna(
        updated,
        request,
    )

    updated = updated.model_copy(
        update={
            "content_dna": content_dna,
            "status": "ready"
            if content_dna
            else "empty",
        }
    )

    if content_dna is not None:
        updated = _save_dna_version(
            updated,
            f"Generated after adding {filename}",
        )

    return _storage(request).save(updated)


# ============================================================
# URL / YOUTUBE SOURCE
# ============================================================


@router.post(
    "/{transformation_id}/sources/url",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
def add_url_source(
    transformation_id: str,
    payload: URLSourceAddRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    try:
        url_lower = payload.url.lower()

        if (
            "youtube.com" in url_lower
            or "youtu.be" in url_lower
        ):
            source = YouTubeIngestionProvider().ingest(
                str(uuid4()),
                payload.title,
                payload.url,
            )
        else:
            source = URLIngestionProvider().ingest(
                str(uuid4()),
                payload.title,
                payload.url,
            )

    except IngestionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    updated = transformation.model_copy(
        update={
            "sources": [
                *transformation.sources,
                source,
            ],
            "status": "processing",
        }
    )

    updated = _apply_first_source_title(
        updated,
        source,
    )

    content_dna = _recompute_dna(
        updated,
        request,
    )

    updated = updated.model_copy(
        update={
            "content_dna": content_dna,
            "status": "ready"
            if content_dna
            else "empty",
        }
    )

    if content_dna is not None:
        updated = _save_dna_version(
            updated,
            "Generated after adding URL source",
        )

    return _storage(request).save(updated)


# ============================================================
# UNSUPPORTED SOURCE
# ============================================================


@router.post(
    "/{transformation_id}/sources/unsupported",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
def add_unsupported_source(
    transformation_id: str,
    payload: UnsupportedSourceRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    source = UnsupportedIngestionProvider().ingest(
        str(uuid4()),
        payload.source_type,
        payload.title,
        payload.note,
    )

    updated = transformation.model_copy(
        update={
            "sources": [
                *transformation.sources,
                source,
            ],
        }
    )

    updated = _apply_first_source_title(
        updated,
        source,
    )

    return _storage(request).save(updated)


# ============================================================
# REMOVE SOURCE
# ============================================================


@router.delete(
    "/{transformation_id}/sources/{source_id}",
    response_model=Transformation,
)
def remove_source(
    transformation_id: str,
    source_id: str,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    sources = [
        source
        for source in transformation.sources
        if source.source_id != source_id
    ]

    if len(sources) == len(
        transformation.sources
    ):
        raise HTTPException(
            status_code=404,
            detail="Source not found",
        )

    updated = transformation.model_copy(
        update={
            "sources": sources,
            "status": "processing",
        }
    )

    content_dna = (
        _recompute_dna(
            updated,
            request,
        )
        if sources
        else None
    )

    updated = updated.model_copy(
        update={
            "content_dna": content_dna,
            "status": "ready"
            if content_dna
            else "empty",
        }
    )

    if content_dna is not None:
        updated = _save_dna_version(
            updated,
            "Regenerated after removing source",
        )

    return _storage(request).save(updated)


# ============================================================
# CONTENT DNA PATCH
# ============================================================


@router.patch(
    "/{transformation_id}/content-dna",
    response_model=Transformation,
)
def patch_transformation_dna(
    transformation_id: str,
    update: ContentDNAUpdate,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    current = (
        transformation.content_dna
        or ContentDNA()
    )

    merged_data = _merge_updates(
        current.model_dump(),
        update.model_dump(exclude_unset=True),
    )

    try:
        merged_content_dna = ContentDNA.model_validate(
            merged_data
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid Content DNA update",
        ) from exc

    updated = transformation.model_copy(
        update={
            "content_dna": merged_content_dna,
            "status": "ready",
        }
    )

    updated = _save_dna_version(
        updated,
        "Saved DNA edit",
    )

    return _storage(request).save(updated)


# ============================================================
# CONFLICT RESOLUTION
# ============================================================


@router.post(
    "/{transformation_id}/integrity/conflicts/{conflict_id}/resolve",
    response_model=Transformation,
)
def resolve_transformation_conflict(
    transformation_id: str,
    conflict_id: str,
    resolution: ConflictResolution,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    integrity = transformation.source_integrity

    conflict = next(
        (
            item
            for item in integrity.conflicts
            if item.conflict_id == conflict_id
        ),
        None,
    )

    if conflict is None:
        raise HTTPException(
            status_code=404,
            detail="Conflict not found",
        )

    claim_map = {
        claim.claim_id: claim
        for claim in integrity.claims
    }

    selected_claim = None

    if resolution.selected_claim_id:
        selected_claim = claim_map.get(
            resolution.selected_claim_id
        )

        if selected_claim is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Selected claim does not belong "
                    "to this conflict"
                ),
            )

        if (
            resolution.selected_claim_id
            not in conflict.claim_ids
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Selected claim does not belong "
                    "to this conflict"
                ),
            )

    # --------------------------------------------------------
    # Determine final value
    # --------------------------------------------------------

    if resolution.decision in {
        "accept_source_a",
        "accept_source_b",
    }:
        if selected_claim is None:
            raise HTTPException(
                status_code=400,
                detail="A claim must be selected",
            )

        final_value = str(
            selected_claim.value
        )

    elif resolution.decision == "custom_value":
        if not resolution.final_value:
            raise HTTPException(
                status_code=400,
                detail="Custom value is required",
            )

        final_value = str(
            resolution.final_value
        )

    elif resolution.decision == "retain_both":
        conflict_claims = [
            claim_map[claim_id]
            for claim_id in conflict.claim_ids
            if claim_id in claim_map
        ]

        final_value = "; ".join(
            str(claim.value)
            for claim in conflict_claims
        )

    else:
        # mark_unresolved
        final_value = None

    # --------------------------------------------------------
    # Update conflict status
    # --------------------------------------------------------

    updated_conflicts = []

    for item in integrity.conflicts:
        if item.conflict_id == conflict_id:
            updated_conflicts.append(
                item.model_copy(
                    update={
                        "status": (
                            "resolved"
                            if resolution.decision
                            != "mark_unresolved"
                            else "unresolved"
                        )
                    }
                )
            )
        else:
            updated_conflicts.append(item)

    # --------------------------------------------------------
    # Store resolution
    # --------------------------------------------------------

    updated_resolutions = [
        *integrity.resolutions,
        resolution,
    ]

    updated_integrity = integrity.model_copy(
        update={
            "conflicts": updated_conflicts,
            "resolutions": updated_resolutions,
        }
    )

    # --------------------------------------------------------
    # Apply resolved value to Content DNA
    # --------------------------------------------------------

    updated_dna = transformation.content_dna

    if (
        final_value is not None
        and updated_dna is not None
    ):
        updated_dna = apply_resolution_to_dna(
            updated_dna,
            conflict.claim_key,
            final_value,
        )

    # --------------------------------------------------------
    # Save transformation
    # --------------------------------------------------------

    updated = transformation.model_copy(
        update={
            "source_integrity": updated_integrity,
            "content_dna": updated_dna,
            "status": (
                "ready"
                if updated_dna is not None
                else transformation.status
            ),
        }
    )

    updated = _save_dna_version(
        updated,
        f"Resolved source conflict: "
        f"{conflict.claim_key}",
    )

    return _storage(request).save(updated)


# ============================================================
# CUSTOM STRUCTURE
# ============================================================


@router.post(
    "/{transformation_id}/structures",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
def create_structure(
    transformation_id: str,
    payload: StructureCreateRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    structure = Structure(
        id=str(uuid4()),
        name=payload.name.strip(),
        type=payload.type,
        source="custom",
        sections=[
            StructureSection(
                id=str(uuid4()),
                name=section.name.strip(),
                description=section.description,
                order=index,
            )
            for index, section in enumerate(
                payload.sections,
                start=1,
            )
        ],
    )

    return _storage(request).save(
        transformation.model_copy(
            update={
                "structures": [
                    *transformation.structures,
                    structure,
                ],
            }
        )
    )


# ============================================================
# REFERENCE STRUCTURE
# ============================================================


@router.post(
    "/{transformation_id}/structures/reference",
    response_model=Transformation,
    status_code=status.HTTP_201_CREATED,
)
def create_reference_structure(
    transformation_id: str,
    payload: StructureReferenceRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    source = next(
        (
            item
            for item in transformation.sources
            if item.source_id
            == payload.reference_source_id
        ),
        None,
    )

    if source is None:
        raise HTTPException(
            status_code=404,
            detail="Reference source not found",
        )

    try:
        structure = _structure_extractor(
            request
        ).from_source(
            source,
            payload.name,
        )

    except StructureExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    return _storage(request).save(
        transformation.model_copy(
            update={
                "structures": [
                    *transformation.structures,
                    structure,
                ],
            }
        )
    )


# ============================================================
# GENERATE OUTPUTS
# ============================================================


@router.post(
    "/{transformation_id}/outputs",
    response_model=Transformation,
)
def generate_outputs(
    transformation_id: str,
    payload: OutputGenerateRequest,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    if transformation.content_dna is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Generate Content DNA before "
                "creating outputs"
            ),
        )

    dna_version = (
        len(transformation.versions) or 1
    )

    try:
        artifacts = [
            _outputs(request).generate(
                transformation.id,
                transformation.content_dna,
                output_type,
                dna_version,
                generation_config=payload.generation_config,
            )
            for output_type in payload.types
        ]

    except LLMProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    structure_map = {
        structure.id: structure
        for structure in transformation.structures
    }

    for structure_id in payload.structure_ids:
        structure = structure_map.get(
            structure_id
        )

        if structure is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Structure not found: "
                    f"{structure_id}"
                ),
            )

        artifacts.append(
            _outputs(request).generate_from_structure(
                transformation.id,
                transformation.content_dna,
                structure,
                dna_version,
            )
        )

    return _storage(request).save(
        transformation.model_copy(
            update={
                "outputs": [
                    *transformation.outputs,
                    *artifacts,
                ],
            }
        )
    )


# ============================================================
# RESTORE DNA VERSION
# ============================================================


@router.post(
    "/{transformation_id}/versions/{version}/restore",
    response_model=Transformation,
)
def restore_version(
    transformation_id: str,
    version: int,
    request: Request,
) -> Transformation:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    match = next(
        (
            item
            for item in transformation.versions
            if item.version == version
        ),
        None,
    )

    if match is None:
        raise HTTPException(
            status_code=404,
            detail="DNA version not found",
        )

    updated = transformation.model_copy(
        update={
            "content_dna": match.content_dna,
            "status": "ready",
        }
    )

    updated = _save_dna_version(
        updated,
        f"Restored DNA v{version}",
    )

    return _storage(request).save(updated)


# ============================================================
# SEARCH
# ============================================================


@router.get(
    "/{transformation_id}/search",
    response_model=SearchResponse,
)
def search_transformation(
    transformation_id: str,
    q: str,
    request: Request,
) -> SearchResponse:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    needle = q.strip().lower()

    if not needle:
        return SearchResponse(
            query=q,
            results=[],
        )

    results: list[SearchResult] = []

    # --------------------------------------------------------
    # Sources
    # --------------------------------------------------------

    for source in transformation.sources:
        haystack = (
            f"{source.title}\n"
            f"{source.text}"
        )

        if needle in haystack.lower():
            results.append(
                SearchResult(
                    category="source",
                    label=source.title,
                    excerpt=source.text[:180],
                )
            )

    # --------------------------------------------------------
    # Content DNA
    # --------------------------------------------------------

    if transformation.content_dna is not None:
        for section, value in (
            transformation.content_dna
            .model_dump()
            .items()
        ):
            text = str(value)

            if needle in text.lower():
                results.append(
                    SearchResult(
                        category="dna",
                        label=section,
                        excerpt=text[:180],
                    )
                )

    # --------------------------------------------------------
    # Outputs
    # --------------------------------------------------------

    for artifact in transformation.outputs:
        if needle in artifact.content.lower():
            results.append(
                SearchResult(
                    category="output",
                    label=artifact.type,
                    excerpt=artifact.content[:180],
                )
            )

    return SearchResponse(
        query=q,
        results=results[:25],
    )


# ============================================================
# SOURCE INTEGRITY ANALYSIS
# ============================================================


@router.post(
    "/{transformation_id}/integrity",
    response_model=SourceIntegrity,
)
def analyze_source_integrity(
    transformation_id: str,
    request: Request,
) -> SourceIntegrity:
    transformation = _get_transformation(
        transformation_id,
        request,
    )

    if not transformation.sources:
        raise HTTPException(
            status_code=400,
            detail="Transformation has no sources to analyze",
        )

    try:
        service = SourceIntegrityService(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )

        result = service.analyze(
            transformation.sources
        )

        updated = transformation.model_copy(
            update={"source_integrity": result}
        )
        _storage(request).save(updated)

        return result

    except SourceIntegrityError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc