from uuid import uuid4

from app.models.content import ContentDNA
from app.models.transformation import Artifact, Structure
from app.services.llm import LLMProvider

OUTPUT_SPECS = {
    "executive_summary": {
        "name": "Executive Summary",
        "description": "A concise executive briefing.",
        "structure": [
            "Title",
            "Executive Summary",
            "Key Findings",
            "Implications",
            "Recommendations",
        ],
    },

    "advisory": {
        "name": "Advisory",
        "description": "A structured advisory document.",
        "structure": [
            "Title",
            "Executive Message",
            "Situation",
            "Key Findings",
            "Risks",
            "Implications",
            "Recommendations",
            "References",
        ],
    },

    "linkedin": {
        "name": "LinkedIn Post",
        "description": "A professional LinkedIn post.",
        "structure": [
            "Hook",
            "Body",
            "Call to Action",
            "Hashtags",
        ],
    },

    "twitter": {
        "name": "X / Twitter Post",
        "description": (
            "A publication-ready X post or thread optimized for clarity, "
            "brevity, engagement, and source-grounded communication."
        ),
        "structure": [
            "Hook",
            "Post or Thread",
            "Hashtags",
        ],
    },

    "presentation": {
        "name": "Presentation",
        "description": (
            "A structured presentation with slides and speaker notes."
        ),
        "structure": [
            "Title Slide",
            "Context",
            "Key Findings",
            "Evidence",
            "Implications",
            "Recommendations",
            "Conclusion",
        ],
    },

    "video": {
        "name": "Video",
        "description": (
            "A complete video production package containing a script, "
            "storyboard, scene descriptions, narration, subtitles, "
            "and visual recommendations."
        ),
        "structure": [
            "Title",
            "Objective",
            "Script",
            "Storyboard",
            "Scene Descriptions",
            "Narration",
            "Subtitles",
            "Visual Recommendations",
        ],
    },

    "infographic": {
        "name": "Infographic",
        "description": (
            "A complete infographic content package containing concise "
            "messaging, key facts, statistics, visual hierarchy, "
            "callouts, and layout recommendations."
        ),
        "structure": [
            "Title",
            "Key Message",
            "Sections",
            "Statistics",
            "Callouts",
            "Visual Hierarchy",
            "Layout Recommendation",
        ],
    },
}


class OutputGenerationService:
    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    def generate(self, transformation_id: str, content_dna: ContentDNA, output_type: str, dna_version: int,prompt: str | None = None, generation_config: dict | None = None,) -> Artifact:

        if output_type not in OUTPUT_SPECS:
            raise ValueError(f"Unsupported output type: {output_type}")

        output_spec = OUTPUT_SPECS[output_type]

        content = self.llm_provider.generate_output(
        content_dna=content_dna,
        output_type=output_type,
        output_spec=output_spec,
        user_prompt=prompt,
        generation_config=generation_config,
        )
       
        return Artifact(
            id=str(uuid4()),
            transformation_id=transformation_id,
            type=output_type,
            structure_id=output_type,
            dna_version=dna_version,
            content=content,
        )

    def generate_from_structure(
        self,
        transformation_id: str,
        content_dna: ContentDNA,
        structure: Structure,
        dna_version: int,
    ) -> Artifact:
        sections = []
        for section in sorted(structure.sections, key=lambda item: item.order):
            sections.append(
                f"## {section.name}\n"
                f"{self._section_body(section.name, content_dna, section.description)}"
            )
        return Artifact(
            id=str(uuid4()),
            transformation_id=transformation_id,
            type="custom_structure",
            structure_id=structure.id,
            dna_version=dna_version,
            content=f"# {structure.name}\n\n" + "\n\n".join(sections),
        )

    def generate_from_template(
        self,
        transformation_id: str,
        content_dna: ContentDNA,
        blueprint: dict,
        dna_version: int,
        template_name: str | None = None,
        prompt: str | None = None,
        generation_config: dict | None = None,
    ) -> Artifact:
        name = template_name or blueprint.get("title") or "Cloned Template Deliverable"
        content = self.llm_provider.generate_output_from_template(
            content_dna=content_dna,
            blueprint=blueprint,
            user_prompt=prompt,
            generation_config=generation_config,
        )

        return Artifact(
            id=str(uuid4()),
            transformation_id=transformation_id,
            type="template_clone",
            structure_id=name,
            dna_version=dna_version,
            content=content,
            metadata={"template_name": name},
        )

    def _executive_summary(self, dna: ContentDNA) -> str:
        findings = "\n".join(f"- {item}" for item in dna.findings.key_findings[:6])
        facts = "\n".join(f"- {item}" for item in dna.facts.claims[:6])
        return (
            f"# {dna.identity.title or 'Executive Summary'}\n\n"
            f"{dna.overview.summary}\n\n"
            f"## Key Findings\n{findings or '- No key findings identified.'}\n\n"
            f"## Source-Grounded Facts\n{facts or '- No claims identified.'}"
        )

    def _advisory(self, dna: ContentDNA) -> str:
        risks = "\n".join(f"- {item}" for item in dna.findings.risks[:6])
        recommendations = "\n".join(f"- {item}" for item in dna.recommendations.recommendations[:6])
        return (
            f"# Advisory: {dna.identity.title or 'Untitled'}\n\n"
            f"Purpose: {dna.overview.purpose or 'Not specified in source.'}\n\n"
            f"## Risks\n{risks or '- No source-grounded risks identified.'}\n\n"
            f"## Recommendations\n{recommendations or '- No explicit source recommendations identified.'}"
        )

    def _linkedin(self, dna: ContentDNA) -> str:
        lead = dna.overview.summary or dna.identity.source_description or dna.identity.title
        takeaways = "\n".join(f"- {item}" for item in (dna.findings.key_findings or dna.facts.claims)[:4])
        return f"{lead}\n\nKey takeaways:\n{takeaways or '- No takeaways identified.'}\n\n#AI #ContentTransformation"

    def _presentation(self, dna: ContentDNA) -> str:
        bullets = dna.findings.key_findings or dna.facts.claims or dna.facts.events
        bullet_text = "\n".join(f"  - {item}" for item in bullets[:5]) or "  - No source-grounded bullets identified."
        return (
            f"Slide 1: {dna.identity.title or 'Transformation Brief'}\n"
            f"  - {dna.overview.summary or 'Summary unavailable.'}\n\n"
            f"Slide 2: Important Evidence\n"
            f"  - {dna.evidence.supporting_excerpt or 'No supporting excerpt identified.'}\n\n"
            f"Slide 3: Findings\n{bullet_text}"
        )

    def _section_body(self, section_name: str, dna: ContentDNA, description: str) -> str:
        key = section_name.lower()
        if "background" in key or "context" in key:
            return dna.overview.summary or dna.context.communication_objective or description
        if "analysis" in key or "finding" in key:
            return "\n".join(f"- {item}" for item in (dna.findings.key_findings or dna.facts.claims)[:5]) or description
        if "recommend" in key or "action" in key:
            return "\n".join(f"- {item}" for item in dna.recommendations.recommendations[:5]) or "No explicit recommendations identified."
        if "evidence" in key or "reference" in key:
            return dna.evidence.supporting_excerpt or "No supporting excerpt identified."
        return description or dna.overview.summary or dna.identity.source_description or "No source-grounded content available."
