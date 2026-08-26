from typing import Optional

from pydantic import BaseModel, ConfigDict


class OptionalModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IdentityUpdate(OptionalModel):
    title: Optional[str] = None
    content_type: Optional[str] = None
    source_description: Optional[str] = None


class OverviewUpdate(OptionalModel):
    summary: Optional[str] = None
    purpose: Optional[str] = None


class EntitiesUpdate(OptionalModel):
    people: Optional[list[str]] = None
    organizations: Optional[list[str]] = None
    locations: Optional[list[str]] = None
    technologies: Optional[list[str]] = None


class FactsUpdate(OptionalModel):
    claims: Optional[list[str]] = None
    statistics: Optional[list[str]] = None
    dates: Optional[list[str]] = None
    events: Optional[list[str]] = None


class FindingsUpdate(OptionalModel):
    key_findings: Optional[list[str]] = None
    risks: Optional[list[str]] = None
    opportunities: Optional[list[str]] = None
    implications: Optional[list[str]] = None


class RecommendationsUpdate(OptionalModel):
    recommendations: Optional[list[str]] = None


class ContextUpdate(OptionalModel):
    target_audience: Optional[str] = None
    tone: Optional[str] = None
    communication_objective: Optional[str] = None


class EvidenceUpdate(OptionalModel):
    source_reference: Optional[str] = None
    supporting_excerpt: Optional[str] = None


class ContentDNAUpdate(OptionalModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "overview": {
                    "summary": "Updated summary",
                }
            }
        },
    )

    identity: Optional[IdentityUpdate] = None
    overview: Optional[OverviewUpdate] = None
    entities: Optional[EntitiesUpdate] = None
    facts: Optional[FactsUpdate] = None
    findings: Optional[FindingsUpdate] = None
    recommendations: Optional[RecommendationsUpdate] = None
    context: Optional[ContextUpdate] = None
    evidence: Optional[EvidenceUpdate] = None
