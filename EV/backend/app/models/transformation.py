from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.models.content import ContentDNA, RawContent


TransformationStatus = Literal["empty", "processing", "ready", "error"]
ArtifactStatus = Literal["draft", "generated", "error"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StructureSection(BaseModel):
    id: str
    name: str
    description: str = ""
    order: int = 0


class Structure(BaseModel):
    id: str
    name: str
    type: str
    sections: list[StructureSection] = Field(default_factory=list)
    source: Literal["built_in", "custom", "reference"] = "custom"
    reference_source_id: str = ""
    status: Literal["ready", "unsupported", "error"] = "ready"
    note: str = ""


class Artifact(BaseModel):
    id: str
    transformation_id: str
    type: str
    structure_id: str = ""
    dna_version: int
    status: ArtifactStatus = "generated"
    content: str = ""
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)


class DNAVersion(BaseModel):
    version: int
    content_dna: ContentDNA
    note: str = ""
    created_at: str = Field(default_factory=utc_now)


class WorkflowTemplate(BaseModel):
    id: str
    name: str
    description: str = ""
    output_types: list[
        Literal[
            "executive_summary",
            "advisory",
            "linkedin",
            "twitter",
            "presentation",
            "video",
            "infographic",
        ]
    ] = Field(default_factory=list)
    generation_config: dict = Field(default_factory=dict)


class WorkflowConfig(BaseModel):
    workflow_id: str = "custom"
    workflow_name: str = "Custom Workflow"
    output_types: list[
        Literal[
            "executive_summary",
            "advisory",
            "linkedin",
            "twitter",
            "presentation",
            "video",
            "infographic",
        ]
    ] = Field(default_factory=list)
    generation_config: dict = Field(default_factory=dict)

class Transformation(BaseModel):
    id: str
    title: str = "Untitled Transformation"
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    sources: list[RawContent] = Field(default_factory=list)
    content_dna: ContentDNA | None = None
    outputs: list[Artifact] = Field(default_factory=list)
    structures: list[Structure] = Field(default_factory=list)
    versions: list[DNAVersion] = Field(default_factory=list)
    status: TransformationStatus = "empty"


class TransformationCreateRequest(BaseModel):
    title: str = "Untitled Transformation"


class TransformationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class TransformationListResponse(BaseModel):
    transformations: list[Transformation]


class TextSourceAddRequest(BaseModel):
    title: str = "Untitled source"
    text: str = Field(min_length=1)


class URLSourceAddRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    title: str = "URL source"


class UnsupportedSourceRequest(BaseModel):
    source_type: Literal["docx", "pptx", "youtube", "image", "video", "audio"]
    title: str = "Unsupported source"
    note: str = ""

class OutputGenerateRequest(BaseModel):
    types: list[Literal[
        "executive_summary",
        "advisory",
        "linkedin",
        "twitter",
        "presentation",
        "video",
        "infographic",
    ]] = Field(min_length=1)

    structure_ids: list[str] = Field(default_factory=list)

    generation_config: dict = Field(default_factory=dict)
class StructureSectionInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    order: int = 0


class StructureCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = "custom"
    source: Literal["custom"] = "custom"
    sections: list[StructureSectionInput] = Field(min_length=1)


class StructureReferenceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    reference_source_id: str = Field(min_length=1)


class SearchResult(BaseModel):
    category: str
    label: str
    excerpt: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
