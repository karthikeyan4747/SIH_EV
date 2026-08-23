from app.models.content import ContentDNA, RawContent
from app.services.llm import LLMProvider


class ContentDNAService:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    def extract(self, content: RawContent) -> ContentDNA:
        return self.provider.generate_content_dna(content)

    def extract_from_sources(self, sources: list[RawContent]) -> ContentDNA:
        combined_text = "\n\n".join(
            f"### SOURCE {index}: {source.title} ({source.source_type})\n"
            f"Source ID: {source.source_id}\n"
            f"{source.text}"
            for index, source in enumerate(sources, start=1)
            if source.text.strip()
        )
        combined = RawContent(
            source_id="combined",
            source_type="text",
            title="Combined transformation context",
            text=combined_text,
            metadata={"source_count": len(sources), "source_ids": [source.source_id for source in sources]},
        )
        return self.extract(combined)
