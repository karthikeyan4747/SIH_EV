from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SourceType = Literal["text", "txt", "pdf", "docx", "pptx", "url", "youtube", "image", "video", "audio"]


class RawContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str
    source_type: SourceType
    title: str
    text: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class Identity(BaseModel):
    title: str = ""
    content_type: str = ""
    source_description: str = ""


class Overview(BaseModel):
    summary: str = ""
    purpose: str = ""


class Entities(BaseModel):
    people: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class Facts(BaseModel):
    claims: list[str] = Field(default_factory=list)
    statistics: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    events: list[str] = Field(default_factory=list)


class Findings(BaseModel):
    key_findings: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    implications: list[str] = Field(default_factory=list)


class Recommendations(BaseModel):
    recommendations: list[str] = Field(default_factory=list)


class Context(BaseModel):
    target_audience: str = ""
    tone: str = ""
    communication_objective: str = ""


class Evidence(BaseModel):
    source_reference: str = ""
    supporting_excerpt: str = ""


class ContentDNA(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identity: Identity = Field(default_factory=Identity)
    overview: Overview = Field(default_factory=Overview)
    entities: Entities = Field(default_factory=Entities)
    facts: Facts = Field(default_factory=Facts)
    findings: Findings = Field(default_factory=Findings)
    recommendations: Recommendations = Field(default_factory=Recommendations)
    context: Context = Field(default_factory=Context)
    evidence: Evidence = Field(default_factory=Evidence)
