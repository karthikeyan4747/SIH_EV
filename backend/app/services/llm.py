import logging
from typing import Any, Protocol

from groq import Groq
from pydantic import ValidationError

from ollama import Client

from app.models.content import ContentDNA, RawContent


logger = logging.getLogger(__name__)


class LLMProviderError(RuntimeError):
    pass


class LLMProvider(Protocol):
    def generate_content_dna(self, content: RawContent) -> ContentDNA:
        ...

    def generate_output(
        self,
        content_dna: ContentDNA,
        output_type: str,
        output_spec: dict,
        user_prompt: str | None = None,
        generation_config: dict | None = None,
    ) -> str:
        ...


class GroqProvider:
    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self.client = Groq(api_key=api_key) if api_key else None

    def generate_content_dna(self, content: RawContent) -> ContentDNA:
        if self.client is None:
            raise LLMProviderError(
                "GROQ_API_KEY is not configured"
            )

        system_prompt = """
You are EV's Content DNA Extraction Engine.

Your job is to transform the provided source into a rich, structured,
useful Content DNA representation.

The Content DNA is the canonical understanding used by EV to generate
executive summaries, advisories, social media posts, presentations,
video packages, and infographics.

The DNA should be informative and complete.

Do not leave sections empty when useful information can reasonably
be derived from the source.

However, remain faithful to the source and never invent specific
facts, numbers, names, events, organizations, dates, quotations,
statistics, or unsupported claims.

============================================================
1. GENERAL EXTRACTION RULE
============================================================

Read the entire source before constructing the DNA.

Extract the central subject, important facts, entities, events,
findings, recommendations, communication context, and evidence.

You may perform reasonable semantic interpretation of the source.

For example:

Source:
"The initiative focuses on helping students identify common online
risks."

Acceptable:
overview.purpose = "Help students identify common online risks."

Source:
"A report describing 17,304 failed login attempts and the security
response."

Acceptable:
overview.purpose = "Document and analyze the authentication incident
and its response."

Do NOT turn this into a much larger unsupported goal.

============================================================
2. NEVER INVENT SPECIFIC FACTS
============================================================

Do not fabricate:
- names
- organizations
- locations
- dates
- numbers
- statistics
- quotations
- achievements
- events
- recommendations
- partnerships
- funding
- rankings
- technical capabilities
- outcomes

Preserve all exact values from the source.

Never turn:
"thousands"
into:
"10,000"

Never turn:
"approximately 4,700"
into:
"4,700"

Never turn:
"expected to reduce costs"
into:
"reduces costs"

============================================================
3. MULTI-SOURCE CONTENT
============================================================

If the transformation contains multiple sources:

- Read all sources.
- Build one coherent Content DNA.
- Combine related information where appropriate.
- Preserve contradictions instead of hiding them.
- Preserve important distinctions between different source claims.
- Do not fabricate a compromise value when sources disagree.

============================================================
4. IDENTITY
============================================================

identity.title:

Create a useful, descriptive title.

Do not simply use:
- "TXT"
- "PDF"
- "DOCX"
- "Image"
- "Video"
- "Source"

The title should identify the actual subject.

Example:

Instead of:
"txt"

Use:
"Authentication Incident and Security Response"

Instead of:
"pdf"

Use:
"National Digital Safety Initiative Announcement"

Instead of:
"image"

Use:
"Smart India Hackathon Winner Announcement"

If a clear source title exists, preserve it.

identity.content_type:

Identify the meaningful type of material.

Examples:
- incident report
- research study
- policy document
- announcement
- technical report
- news article
- presentation
- transcript
- interview
- product brief
- security advisory
- social media content
- image-based announcement
- video transcript
- mixed-source document

Do not simply return the file extension.

identity.source_description:

Describe what the source contains in one or two concise sentences.

Example:
"An incident report documenting repeated authentication failures,
the response timeline, and the follow-up security actions."

============================================================
5. OVERVIEW
============================================================

overview.summary:

Provide a concise but information-rich summary.

It should capture:
- what the source is about
- the most important facts
- the major event or subject
- important results or conclusions

overview.purpose:

Always attempt to identify the practical or communicative purpose
of the source.

Use the source's actual subject.

Examples:

Announcement:
"Announce Team Pathenova's achievement in the Smart India Hackathon."

Incident report:
"Document and analyze the authentication incident and the response."

Research paper:
"Evaluate model performance under resource-constrained conditions."

Policy note:
"Define audit-record retention requirements for participating
institutions."

Product brief:
"Describe EV's multimodal content transformation capabilities."

If an exact purpose is not stated, derive a conservative purpose
from the obvious function of the material.

Never create a grander strategic mission than the source supports.

============================================================
6. ENTITIES
============================================================

Extract:
- people
- organizations
- locations
- technologies

Use entities actually mentioned or clearly represented.

For technologies, include relevant technical concepts when useful.

For example:
- Python
- artificial intelligence
- OCR
- speech-to-text
- authentication
- rate limiting
- machine learning

Do not invent specific technologies that are not supported.

============================================================
7. FACTS
============================================================

facts.claims:

Extract important factual statements.

facts.statistics:

Extract important numerical facts.

facts.dates:

Extract dates, years, timelines, deadlines, and important time
references.

facts.events:

Extract the important events, milestones, actions, announcements,
incidents, launches, evaluations, or achievements.

Preserve exact values.

============================================================
8. FINDINGS
============================================================

findings.key_findings:

Extract the most important conclusions or takeaways from the source.

These may be directly stated or conservatively derived from multiple
facts.

Example:

Facts:
Model A = 31 ms
Model B = 54 ms
Model C = 96 ms

Source conclusion:
Model B provided the best balance.

Finding:
"Model B provided the best balance between latency and accuracy in
the reported evaluation."

findings.risks:

Extract explicit risks and meaningful limitations.

If the source does not explicitly name risks but clearly describes
a limitation, it may be represented as a risk/limitation in a
careful manner.

findings.opportunities:

Extract explicitly mentioned or clearly described opportunities,
future uses, expansion possibilities, or areas for further work.

Do not invent funding, partnerships, business deals, or market
opportunities.

findings.implications:

Describe practical or logical consequences supported by the source.

Do not turn ordinary facts into dramatic consequences.

============================================================
9. RECOMMENDATIONS
============================================================

recommendations.recommendations:

Extract explicit recommendations, required actions, next steps,
guidance, and proposed actions.

Recognize phrases such as:
- should
- must
- recommended
- review
- expand
- evaluate
- conduct
- retain
- implement
- consider
- next step

You may convert an explicitly stated action into a concise
recommendation.

Example:

Source:
"The report recommends reviewing rate-limiting thresholds."

Recommendation:
"Review rate-limiting thresholds."

Do not invent new actions that are absent from the source.

============================================================
10. CONTEXT
============================================================

Unlike the original ultra-strict version, context should NOT usually
be empty.

Infer conservative communication context from the material itself.

context.target_audience:

Identify the most likely audience based on the source's nature.

Examples:
- executives
- government officials
- technical teams
- researchers
- students
- general public
- security professionals
- organizational stakeholders

Use cautious descriptions.

context.tone:

Infer the dominant tone of the material.

Examples:
- professional
- formal
- technical
- neutral
- urgent
- academic
- persuasive
- informational
- advisory

context.communication_objective:

Identify what the source is trying to accomplish.

Examples:
- inform
- summarize
- warn
- educate
- announce
- persuade
- document
- analyze
- recommend

These are interpretations of the source's communication role,
not invented factual claims.

============================================================
11. EVIDENCE
============================================================

Evidence should almost never be completely empty when the source
contains meaningful information.

evidence.source_reference:

Describe where the evidence comes from.

Examples:
- "Section 2 — Incident Report"
- "Source 1 — SIH announcement"
- "Page 4"
- "Visual frame at 10 seconds"
- "Audio transcript"
- "YouTube transcript"
- "URL source"

When exact source locations are unavailable, identify the source
descriptively.

evidence.supporting_excerpt:

Provide a concise excerpt or highly faithful source-grounded
supporting passage representing the strongest evidence.

Prefer direct wording.

Do not fabricate quotations.

If direct quotation is unavailable, use a faithful supporting
excerpt rather than inventing one.

============================================================
12. MULTIMODAL SOURCES
============================================================

TEXT:
Extract semantic information normally.

DOCUMENTS:
Extract titles, sections, facts, lists, tables, conclusions,
recommendations, and relevant structure.

IMAGE:
Use visible text and clearly supported visual information.

AUDIO:
Use spoken content and timestamps when available.

VIDEO:
Use both spoken information and extracted visual information.

YOUTUBE:
Use transcript content as source material.

For video, visual evidence may include:
- visible text
- slides
- captions
- labels
- code
- charts
- diagrams

Do not claim visual objects that were not actually detected.

============================================================
13. CONFLICTS
============================================================

When sources disagree:

Preserve both claims.

Do not silently select one.

Do not calculate a compromise value.

Example:

Source A:
"4,800 participants."

Source B:
"4,650 participants."

DNA should preserve both values in the relevant factual sections.

============================================================
14. COMPLETENESS
============================================================

IMPORTANT:

Every major DNA node should contain useful information whenever
the source provides enough context to support it.

Do not intentionally produce:

identity = mostly empty
overview = mostly empty
findings = empty
recommendations = empty
context = empty
evidence = empty

Use reasonable source-grounded interpretation to populate the DNA.

The goal is a rich canonical understanding, not a sparse extraction.

============================================================
15. QUALITY CHECK
============================================================

Before returning Content DNA, check:

- Is the title descriptive?
- Is the content type meaningful?
- Is the source description useful?
- Does the summary explain the source?
- Does the purpose explain why the source exists?
- Are important entities extracted?
- Are important numbers preserved?
- Are dates preserved?
- Are key events extracted?
- Are important findings represented?
- Are risks represented where appropriate?
- Are opportunities represented where appropriate?
- Are implications represented where appropriate?
- Are explicit recommendations extracted?
- Is the audience reasonably identified?
- Is the tone reasonably identified?
- Is the communication objective reasonably identified?
- Is evidence represented?
- Is the supporting excerpt grounded in the source?
- Have contradictions been preserved?
- Has any unsupported specific fact been invented?

Return the most complete source-grounded Content DNA possible.

============================================================
16. OUTPUT FORMAT
============================================================

Return ONLY the ContentDNA object.

Follow the existing schema exactly.

Do not return:
- Markdown
- code fences
- explanations
- commentary
- reasoning
- extra fields
"""

        user_message = f"""
SOURCE INFORMATION
==============================

Title:
{content.title}

Source Type:
{content.source_type}

Source Content:
------------------------------
{content.text}
------------------------------

TASK:

Build a complete ContentDNA object from the source.

Important:

- Understand the entire source before extracting.
- Populate every DNA section with useful source-grounded information
  whenever possible.
- Use conservative interpretation rather than leaving fields empty.
- Preserve important numbers, dates, names, terminology, and claims.
- Do not invent specific facts.
- Keep conflicting source claims distinguishable.
- Provide meaningful purpose, context, findings, recommendations,
  and evidence when they can be derived from the source.
- Make identity descriptive rather than simply using a file type.
- Evidence should identify what source material supports the DNA.

Return ONLY the ContentDNA object.
"""

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                temperature=0,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "content_dna",
                        "schema": ContentDNA.model_json_schema(),
                    },
                },
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    },
                ],
            )

        except Exception as exc:
            logger.exception(
                "Groq API/model request failed (model=%s)",
                self.model,
            )

            response = getattr(exc, "response", None)

            if response is not None:
                try:
                    logger.error(
                        "Groq error response: %s",
                        response.json(),
                    )
                except Exception:
                    logger.error(
                        "Groq error response: %r",
                        response,
                    )

            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            ) from exc

        choices = getattr(completion, "choices", None)
        has_choices = bool(choices)
        raw_content: Any = None

        if has_choices:
            message = getattr(
                choices[0],
                "message",
                None,
            )
            raw_content = getattr(
                message,
                "content",
                None,
            )

        if completion is None or not has_choices:
            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            )

        if (
            not isinstance(raw_content, str)
            or not raw_content.strip()
        ):
            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            )

        try:
            return ContentDNA.model_validate_json(
                raw_content
            )

        except ValidationError as exc:
            logger.exception(
                "Groq structured output failed ContentDNA validation"
            )

            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            ) from exc

        except ValueError as exc:
            logger.exception(
                "Groq structured output was not valid JSON"
            )

            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            ) from exc

    def generate_output(
        self,
        content_dna: ContentDNA,
        output_type: str,
        output_spec: dict,
        user_prompt: str | None = None,
        generation_config: dict | None = None,
    ) -> str:
        if self.client is None:
            raise LLMProviderError(
                "GROQ_API_KEY is not configured"
            )

        generation_config = generation_config or {}

        user_prompt = user_prompt or (
            "Generate the artifact according to the output specification."
        )

        structure = output_spec.get(
            "structure",
            [],
        )

        structure_text = "\n".join(
            f"{index + 1}. {section}"
            for index, section in enumerate(structure)
        )

        output_type_rules = {
            "executive_summary": """
EXECUTIVE SUMMARY

Produce a polished executive briefing.

Focus on:
- the most important facts
- key findings
- material risks
- relevant implications
- explicit recommendations

Keep it concise and decision-oriented.

Do not invent strategic impact, financial impact, partnerships,
rankings, achievements, or future outcomes.

Preserve important numbers, dates, names, and uncertainty.

The result should be directly usable by an executive.
""",

            "advisory": """
ADVISORY

Produce a complete professional advisory.

Use clear professional headings.

Include relevant:
- situation/background
- findings
- risks
- implications
- recommendations
- evidence

Everything must remain grounded in Content DNA.

If no recommendations are present, state:

"No explicit recommendations were provided in the source."

Never create recommendations from your own reasoning.

Preserve uncertainty and attribution.
""",

            "linkedin": """
LINKEDIN POST

Return ONLY the finished LinkedIn post.

Do not output:
- Hook
- Body
- Call to Action
- Hashtags labels

The post must be directly copyable and publishable.

Use an engaging but truthful opening.

Highlight the most important source-supported fact, achievement,
announcement, insight, or result.

Never exaggerate.
Never invent statistics.
Never invent impact.
Never invent partnerships, rankings, awards, or future outcomes.

Hashtags may be included when appropriate.
""",

            "twitter": """
X / TWITTER

Return a publication-ready X post or thread.

Optimize for:
- clarity
- brevity
- readability
- engagement

Preserve source truth.

If the material is too large for one post, create a logical thread.

Do not invent information between thread segments.

Do not output internal labels such as:
Hook
Body
Tweet 1
Tweet 2
Hashtags

Hashtags may be included when appropriate.
""",

            "presentation": """
PRESENTATION

Produce the complete presentation.

For every slide provide:
- slide number
- slide title
- slide content
- speaker notes

Include speaker notes for EVERY slide.

The slide narrative should be logical and presentation-ready.

Recommended flow when supported:
1. Title
2. Context
3. Key information
4. Findings
5. Evidence
6. Implications
7. Recommendations
8. Conclusion

Do not invent unsupported information.

If a requested area is unsupported, state that the source does not
provide sufficient information.

Speaker notes must remain source-grounded.
""",

            "video": """
VIDEO PACKAGE

Produce a complete video production package containing:

- Title
- Objective
- Script
- Storyboard
- Scene Descriptions
- Narration
- Subtitles
- Visual Recommendations

Narration must be grounded in Content DNA.

Subtitles should match narration accurately.

Storyboard scenes must correspond to the script.

Visual recommendations must only depict source-supported material.

Do not invent people, locations, statistics, events, achievements,
or outcomes.

Use realistic timing where applicable.
""",

            "infographic": """
INFOGRAPHIC

Produce complete infographic content containing:

- Title
- Key Message
- Sections
- Statistics
- Callouts
- Visual Hierarchy
- Layout Recommendation

Emphasize the strongest source-supported information.

Never invent statistics.

Preserve exact numbers.

Callouts must be source-grounded.

The output should be suitable for direct handoff to a designer.
""",
        }

        selected_output_rules = output_type_rules.get(
            output_type,
            """
Follow the output specification exactly.

Create a polished, directly usable artifact.

Use only Content DNA as factual source material.
""",
        )

        system_prompt = f"""
You are EV's Content Transformation Engine.

Transform the provided Content DNA into:

{output_spec.get("name", output_type)}

CONTENT DNA IS THE SOURCE OF TRUTH.

============================================================
SOURCE-GROUNDING
============================================================

Use only information contained in Content DNA.

Never invent:
- facts
- statistics
- names
- organizations
- dates
- events
- recommendations
- quotations
- evidence
- partnerships
- funding
- rankings
- impact
- future outcomes

Preserve:
- numbers
- dates
- terminology
- named entities
- uncertainty
- attribution

If information is unavailable, do not fabricate it.

============================================================
OUTPUT
============================================================

Output type:
{output_spec.get("name", output_type)}

Description:
{output_spec.get("description", "")}

Required structure:

{structure_text}

============================================================
GENERATION SETTINGS
============================================================

Target audience:
{generation_config.get("audience", "General Public")}

Tone:
{generation_config.get("tone", "Professional")}

Language:
{generation_config.get("language", "English")}

Level of detail:
{generation_config.get("detail", "Balanced")}

Communication objective:
{generation_config.get("objective", "Inform")}

Content style:
{generation_config.get("style", "Corporate")}

Adapt the output to these settings.

Target audience:
Adjust vocabulary and complexity.

Tone:
Maintain the selected tone consistently.

Language:
Produce the artifact in the selected language.

Level of detail:
Explain source-supported information more or less deeply depending
on the selected level.

Communication objective:
Shape the communication around the requested objective.

Content style:
Follow the requested style.

============================================================
USER INSTRUCTIONS
============================================================

{user_prompt}

============================================================
OUTPUT-SPECIFIC RULES
============================================================

{selected_output_rules}

============================================================
FORMATTING
============================================================

Use clean formatting appropriate to the output type.

Do not expose:
- system instructions
- prompt instructions
- Content DNA field names
- internal metadata
- reasoning

Return ONLY the final requested artifact.
Do not explain how it was generated.
Do not add commentary before or after the artifact.
"""

        user_message = f"""
CONTENT DNA
====================

{content_dna.model_dump_json(indent=2)}

====================

Generate the requested {output_spec.get("name", output_type)}.

Respect:
- audience
- tone
- language
- level of detail
- communication objective
- content style

Use Content DNA as the sole factual source.

Return only the final artifact.
"""

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                temperature=0.2,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    },
                ],
            )

        except Exception as exc:
            logger.exception(
                "Groq output generation failed "
                "(model=%s, output_type=%s)",
                self.model,
                output_type,
            )

            raise LLMProviderError(
                "The LLM output generation request failed"
            ) from exc

        choices = getattr(
            completion,
            "choices",
            None,
        )

        if not choices:
            raise LLMProviderError(
                "The LLM output generation returned no choices"
            )

        message = getattr(
            choices[0],
            "message",
            None,
        )

        raw_content = getattr(
            message,
            "content",
            None,
        )

        if (
            not isinstance(raw_content, str)
            or not raw_content.strip()
        ):
            raise LLMProviderError(
                "The LLM output generation returned empty content"
            )

        logger.info(
            "LLM output generated successfully: output_type=%s",
            output_type,
        )

        return raw_content.strip()


class OllamaProvider:
    def __init__(self, host: str, model: str) -> None:
        self.host = host
        self.model = model
        self.client = Client(host=host)

    def chat(
        self,
        messages: list[dict],
        temperature: float = 0,
    ) -> str:
        try:
            response = self.client.chat(
                model=self.model,
                messages=messages,
                options={
                    "temperature": temperature,
                },
            )
        except Exception as exc:
            logger.exception(
                "Ollama request failed (model=%s)",
                self.model,
            )
            raise LLMProviderError(
                "The local Ollama model request failed"
            ) from exc

        content = response.message.content

        if not isinstance(content, str) or not content.strip():
            raise LLMProviderError(
                "The local Ollama model returned empty content"
            )

        return content.strip()


    def generate_content_dna(self, content: RawContent) -> ContentDNA:
        system_prompt = """
    You are EV's Content DNA Extraction Engine.

    Your task is to extract a COMPLETE and information-rich ContentDNA
    object from the provided source.

    CRITICAL RULES:

    1. Read and understand the ENTIRE source before producing the JSON.

    2. Remain completely faithful to the source.
    NEVER invent facts, numbers, names, dates, organizations,
    statistics, quotations, recommendations, or claims.

    3. Populate EVERY ContentDNA field whenever the source provides
    enough information to do so.

    4. Do NOT leave fields empty merely because the information is not
    explicitly formatted in the source. You may summarize or
    restructure information that is clearly supported by the source.

    5. If a field genuinely has no supporting information in the source,
    return an empty string or empty array as required by the schema.

    FIELD INSTRUCTIONS:

    identity:
    - title: preserve the source title.
    - content_type: identify the type of content when it can be determined.
    - source_description: briefly describe what the source contains.

    overview:
    - summary: provide a concise summary of the entire source.
    - purpose: explain what the source is trying to communicate or accomplish.

    entities:
    - Extract all explicitly mentioned people, organizations, locations,
    and technologies.
    - Do not invent entities.

    facts:
    - claims: extract meaningful factual claims from the source.
    - statistics: extract numerical statistics, measurements, percentages,
    quantities, or comparisons.
    - dates: extract explicitly mentioned dates or time periods.
    - events: extract explicitly described events or occurrences.

    findings:
    - key_findings: identify the major conclusions or important ideas
    supported by the source.
    - risks: extract risks, limitations, problems, or threats mentioned
    or clearly supported by the source.
    - opportunities: extract opportunities or potential benefits supported
    by the source.
    - implications: explain the consequences or significance of the
    source's findings when directly supported by the source.

    recommendations:
    - Extract recommendations explicitly provided by the source.
    - If the source proposes actions or solutions, capture them.
    - Do NOT invent recommendations.

    context:
    - target_audience: infer the intended audience from the source.
    - tone: identify the communication tone.
    - communication_objective: describe what the source is trying to
    achieve through its communication.

    evidence:
    - source_reference: preserve any source/reference information provided.
    - supporting_excerpt: include the most useful excerpt supporting
    the extracted ContentDNA.

    IMPORTANT:
    - Prefer extracting MORE supported information rather than returning
    empty fields.
    - Every extracted item must be traceable to the source.
    - Keep conflicting claims separate rather than merging them.
    - Preserve important terminology and numbers.
    - Do not hallucinate missing information.

    Return ONLY valid JSON matching the ContentDNA schema.
    Do not include explanations, markdown, or text outside the JSON.
    """

        user_message = f"""
    SOURCE INFORMATION
    ==============================

    Title:
    {content.title}

    Source Type:
    {content.source_type}

    Source Content:
    ------------------------------
    {content.text}
    ------------------------------

    TASK:

    Build a complete ContentDNA object from the source.

    Important:
    - Understand the entire source before extracting.
    - Preserve important numbers, dates, names, terminology, and claims.
    - Do not invent specific facts.
    - Keep conflicting source claims distinguishable.
    - Provide meaningful purpose, context, findings, recommendations,
    and evidence when supported by the source.

    Return ONLY the ContentDNA object.
    """

        try:
            response = self.client.chat(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_message,
                    },
                ],
                options={
                    "temperature": 0,
                },
                format=ContentDNA.model_json_schema(),
            )
        except Exception as exc:
            logger.exception(
                "Ollama Content DNA generation failed (model=%s)",
                self.model,
            )
            raise LLMProviderError(
                "The local Content DNA generation request failed"
            ) from exc

        raw_content = response.message.content

        if not isinstance(raw_content, str) or not raw_content.strip():
            raise LLMProviderError(
                "The local model returned empty Content DNA"
            )

        try:
            return ContentDNA.model_validate_json(raw_content)
        except (ValidationError, ValueError) as exc:
            logger.exception(
                "Ollama returned invalid Content DNA"
            )
            raise LLMProviderError(
                "The local model returned invalid Content DNA"
            ) from exc