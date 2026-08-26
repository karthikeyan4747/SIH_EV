from pydantic import BaseModel, Field

from app.models.content import ContentDNA, RawContent


class TextSourceRequest(BaseModel):
    title: str = "Untitled source"
    text: str = Field(min_length=1)


class SourceCreatedResponse(BaseModel):
    source_id: str
    source_type: str
    content_dna: ContentDNA


class SourceResponse(BaseModel):
    source: RawContent
    content_dna: ContentDNA
