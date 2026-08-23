import re
from uuid import uuid4

from app.models.content import RawContent
from app.models.transformation import Structure, StructureSection


class StructureExtractionError(ValueError):
    pass


class StructureExtractionService:
    supported_types = {"text", "txt", "pdf", "url"}

    def from_source(self, source: RawContent, name: str) -> Structure:
        if source.source_type not in self.supported_types:
            raise StructureExtractionError(f"{source.source_type.upper()} sources cannot yet be structurally parsed")

        sections = self._extract_sections(source.text)
        if not sections:
            raise StructureExtractionError("No structural pattern could be extracted from the selected reference")

        return Structure(
            id=str(uuid4()),
            name=name.strip() or f"{source.title} Structure",
            type="reference",
            source="reference",
            reference_source_id=source.source_id,
            sections=sections,
        )

    def _extract_sections(self, text: str) -> list[StructureSection]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        heading_candidates = [
            line for line in lines
            if re.match(r"^(\d+[\.\)]\s+|[A-Z][A-Za-z0-9 /&,-]{2,60}$|#+\s+)", line)
        ]
        normalized = []
        for line in heading_candidates[:8]:
            clean = re.sub(r"^(#+\s*|\d+[\.\)]\s*)", "", line).strip(" -:")
            if clean and clean.lower() not in {item.lower() for item in normalized}:
                normalized.append(clean)

        if not normalized:
            fallback = ["Introduction", "Background", "Analysis", "Recommendations"]
            normalized = fallback[: min(4, max(2, len(lines) // 8 or 4))]

        return [
            StructureSection(
                id=str(uuid4()),
                name=name,
                description=f"Cover {name.lower()} based on the reference pattern.",
                order=index,
            )
            for index, name in enumerate(normalized, start=1)
        ]
