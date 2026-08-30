import json
import logging
from typing import Any, Protocol

from groq import Groq
from pydantic import ValidationError

try:
    from ollama import Client
except ImportError:
    Client = None

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
    """
    Local LLM provider using Ollama.

    Implements the same interface as GroqProvider so the rest of the
    application does not need to know whether inference is local or cloud.
    """

    def __init__(self, host: str, model: str) -> None:
        self.host = host
        self.model = model
        self.client = Client(host=host) if Client is not None else None

    def chat(
        self,
        messages: list[dict],
        temperature: float = 0,
    ) -> str:
        if self.client is None:
            raise LLMProviderError(
                "The local Ollama client is not installed"
            )

        try:
            response = self.client.chat(
                model=self.model,
                messages=messages,
                options={
                    "temperature": temperature,
                    "num_ctx": 8192,
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

    @staticmethod
    def _extract_json(text: str) -> str:
        text = text.strip()

        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        start = text.find("{")
        if start == -1:
            return text

        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    return text[start: i + 1]

        return text[start:]

    @staticmethod
    def _normalize_ollama_dna(
        data: dict[str, Any],
    ) -> dict[str, Any]:
        normalized: dict[str, Any] = {}

        identity = data.get("identity", {})
        if isinstance(identity, str):
            normalized["identity"] = {
                "title": identity,
                "content_type": "",
                "source_description": "",
            }
        elif isinstance(identity, dict):
            normalized["identity"] = {
                "title": identity.get("title", ""),
                "content_type": identity.get("content_type", ""),
                "source_description": identity.get(
                    "source_description", ""
                ),
            }
        else:
            normalized["identity"] = {
                "title": "",
                "content_type": "",
                "source_description": "",
            }

        overview = data.get("overview", {})
        if isinstance(overview, str):
            normalized["overview"] = {
                "summary": overview,
                "purpose": "",
            }
        elif isinstance(overview, dict):
            normalized["overview"] = {
                "summary": overview.get("summary", ""),
                "purpose": overview.get("purpose", ""),
            }
        else:
            normalized["overview"] = {
                "summary": "",
                "purpose": "",
            }

        entities = data.get("entities", {})
        if not isinstance(entities, dict):
            entities = {}
        normalized["entities"] = {
            "people": entities.get(
                "people", data.get("people", [])
            ),
            "organizations": entities.get(
                "organizations", data.get("organizations", [])
            ),
            "locations": entities.get(
                "locations", data.get("locations", [])
            ),
            "technologies": entities.get(
                "technologies", data.get("technologies", [])
            ),
        }

        facts = data.get("facts", {})
        if not isinstance(facts, dict):
            facts = {}
        normalized["facts"] = {
            "claims": facts.get("claims", data.get("claims", [])),
            "statistics": facts.get(
                "statistics", data.get("statistics", [])
            ),
            "dates": facts.get("dates", data.get("dates", [])),
            "events": facts.get("events", data.get("events", [])),
        }

        findings = data.get("findings", {})
        if not isinstance(findings, dict):
            findings = {}
        normalized["findings"] = {
            "key_findings": findings.get(
                "key_findings", data.get("key_findings", [])
            ),
            "risks": findings.get(
                "risks", data.get("risks", [])
            ),
            "opportunities": findings.get(
                "opportunities", data.get("opportunities", [])
            ),
            "implications": findings.get(
                "implications", data.get("implications", [])
            ),
        }

        recommendations = data.get("recommendations", {})
        if isinstance(recommendations, list):
            normalized["recommendations"] = {
                "recommendations": recommendations,
            }
        elif isinstance(recommendations, dict):
            normalized["recommendations"] = {
                "recommendations": recommendations.get(
                    "recommendations", []
                ),
            }
        else:
            normalized["recommendations"] = {
                "recommendations": [],
            }

        context = data.get("context", {})
        if not isinstance(context, dict):
            context = {}
        target_audience = context.get(
            "target_audience", data.get("target_audience", "")
        )
        if isinstance(target_audience, list):
            target_audience = ", ".join(
                str(x) for x in target_audience
            )
        normalized["context"] = {
            "target_audience": target_audience,
            "tone": context.get("tone", data.get("tone", "")),
            "communication_objective": context.get(
                "communication_objective",
                data.get("communication_objective", ""),
            ),
        }

        evidence = data.get("evidence", {})
        if isinstance(evidence, str):
            normalized["evidence"] = {
                "source_reference": "",
                "supporting_excerpt": evidence,
            }
        elif isinstance(evidence, list):
            normalized["evidence"] = {
                "source_reference": "",
                "supporting_excerpt": "; ".join(
                    str(x) for x in evidence
                ),
            }
        elif isinstance(evidence, dict):
            normalized["evidence"] = {
                "source_reference": evidence.get(
                    "source_reference", ""
                ),
                "supporting_excerpt": evidence.get(
                    "supporting_excerpt", ""
                ),
            }
        else:
            normalized["evidence"] = {
                "source_reference": "",
                "supporting_excerpt": "",
            }

        return normalized

    def generate_content_dna(
        self,
        content: RawContent,
    ) -> ContentDNA:

        system_prompt = """
You are EV's Content DNA Extraction Engine.

Your job is to carefully analyze the ENTIRE source and create a
COMPLETE, INFORMATION-RICH ContentDNA object.

The Content DNA will later be used to generate:
- executive summaries
- advisories
- LinkedIn posts
- X/Twitter posts
- presentations
- video packages
- infographics
- other transformation outputs

IMPORTANT RULES:

1. Read and understand the complete source before answering.

2. Extract as much useful information as the source actually provides.

3. NEVER invent facts.

Do not fabricate:
- names
- organizations
- locations
- dates
- numbers
- statistics
- quotations
- events
- achievements
- recommendations
- partnerships
- funding
- rankings
- technical capabilities
- outcomes

4. Preserve exact numbers, dates and names.

5. Populate every ContentDNA field whenever the source contains
relevant information.

6. Do not leave fields empty simply because information is written
in normal prose rather than explicitly labelled.

7. Reasonable semantic summarization is allowed.

For example:

Source:
"The system reduced processing time by 40 percent."

This may become a claim:
"The system reduced processing time by 40 percent."

But do not invent:
"The system improved organizational efficiency by 40 percent."

8. Preserve uncertainty.

For example:
"may improve performance"

must NOT become:

"improves performance."

9. If multiple sources are present, preserve contradictions.
Never silently combine conflicting claims.

10. Evidence must remain traceable to the supplied source.

11. The output MUST be valid JSON matching the ContentDNA schema.

12. Return ONLY JSON.

Do not use Markdown.
Do not use code fences.
Do not add explanations.

============================================================
CONTENTDNA SCHEMA — FOLLOW THIS EXACT STRUCTURE
============================================================

The top-level JSON object MUST have these exact keys:

{
  "identity": {
    "title": "descriptive title string",
    "content_type": "meaningful type string",
    "source_description": "concise description string"
  },
  "overview": {
    "summary": "concise summary string",
    "purpose": "purpose string"
  },
  "entities": {
    "people": ["string"],
    "organizations": ["string"],
    "locations": ["string"],
    "technologies": ["string"]
  },
  "facts": {
    "claims": ["string"],
    "statistics": ["string"],
    "dates": ["string"],
    "events": ["string"]
  },
  "findings": {
    "key_findings": ["string"],
    "risks": ["string"],
    "opportunities": ["string"],
    "implications": ["string"]
  },
  "recommendations": {
    "recommendations": ["string"]
  },
  "context": {
    "target_audience": "audience string",
    "tone": "tone string",
    "communication_objective": "objective string"
  },
  "evidence": {
    "source_reference": "reference string",
    "supporting_excerpt": "excerpt string"
  }
}

CRITICAL RULES:

- identity, overview, entities, facts, findings, recommendations,
  context, and evidence MUST ALL BE OBJECTS, not strings or arrays.
- Each nested object MUST contain the exact keys shown above.
- Arrays must be arrays of strings.
- Do NOT flatten the schema. Do NOT put arrays at the root level.
- Do NOT invent extra top-level keys.
- If a section has no information, return an empty object or empty
  arrays as shown in the schema example above.
"""

        user_message = f"""
SOURCE INFORMATION
==================

Source ID:
{content.source_id}

Title:
{content.title}

Source Type:
{content.source_type}

SOURCE CONTENT
==============

{content.text}

==============================

Extract the complete ContentDNA.

Be comprehensive.

Capture:
- identity
- overview
- people
- organizations
- locations
- technologies
- claims
- statistics
- dates
- events
- key findings
- risks
- opportunities
- implications
- recommendations
- target audience
- tone
- communication objective
- evidence

Use only information supported by the source.

Return ONLY valid JSON.
"""

        messages = [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_message,
            },
        ]

        try:
            response = self.client.chat(
                model=self.model,
                messages=messages,
                options={
                    "temperature": 0,
                    "num_ctx": 8192,
                },
            )
            raw_content = response.message.content
        except TypeError:
            raw_content = self.chat(
                messages,
                temperature=0,
            )

        raw_content = self._extract_json(raw_content)

        try:
            parsed = json.loads(raw_content)
        except ValueError as exc:
            logger.exception(
                "Ollama returned invalid JSON for ContentDNA. "
                "Raw content preview: %s",
                raw_content[:500],
            )

            raise LLMProviderError(
                "The local LLM returned invalid JSON"
            ) from exc

        if isinstance(parsed, dict):
            parsed = self._normalize_ollama_dna(parsed)
            raw_content = json.dumps(parsed)

        try:
            return ContentDNA.model_validate_json(
                raw_content
            )

        except ValidationError as exc:
            logger.exception(
                "Ollama structured output failed ContentDNA "
                "validation after normalization. "
                "Raw content preview: %s",
                raw_content[:500],
            )

            raise LLMProviderError(
                "The local LLM returned invalid ContentDNA"
            ) from exc

    def generate_output(
        self,
        content_dna: ContentDNA,
        output_type: str,
        output_spec: dict,
        user_prompt: str | None = None,
        generation_config: dict | None = None,
    ) -> str:

        generation_config = generation_config or {}

        user_prompt = user_prompt or (
            "Generate the complete artifact according to the output specification."
        )

        structure = output_spec.get(
            "structure",
            [],
        )

        structure_text = "\n".join(
            f"{index + 1}. {section}"
            for index, section in enumerate(structure)
        )

        output_rules = {
            "executive_summary": """
Create a substantial, professional executive summary.

Include, when supported:
- Executive overview
- Situation or background
- Most important findings
- Important evidence
- Key risks
- Opportunities
- Implications
- Recommendations
- Conclusion

Do not omit important information merely to make the response short.

The result should normally be several well-developed paragraphs
with clear headings where appropriate.
""",

            "advisory": """
Create a complete professional advisory.

Include:
- Title
- Situation / Background
- Key Findings
- Evidence
- Risks
- Implications
- Recommendations
- Conclusion

Explain important points rather than listing them as one-line bullets.

Do not invent recommendations that are not supported by the
Content DNA.
""",

            "linkedin": """
Create a polished LinkedIn post.

Use:
- a strong opening
- useful context
- the most important source-supported insights
- relevant supporting facts
- a clear closing

Keep it suitable for LinkedIn and directly publishable.

Do not invent statistics, achievements, partnerships or outcomes.
""",

            "twitter": """
Create a publication-ready X/Twitter post or thread.

Use multiple posts when the source contains enough information
to justify a thread.

Prioritize:
- clarity
- important facts
- useful context
- readability
- engagement

Do not invent information.
""",

            "presentation": """
Create a COMPLETE presentation.

Produce approximately 7-10 slides when the source supports
that amount of content.

For EVERY slide provide:

Slide Number
Slide Title
Slide Content
Speaker Notes

Recommended structure:

1. Title
2. Context / Background
3. Problem or Situation
4. Key Information
5. Evidence / Data
6. Findings
7. Risks / Challenges
8. Opportunities / Implications
9. Recommendations
10. Conclusion

Do not create empty or meaningless slides.

Speaker notes should contain useful explanations rather than
simply repeating the slide bullets.
""",

            "video": """
Create a COMPLETE video production package.

Include:

1. Video Title
2. Objective
3. Target Audience
4. Estimated Duration
5. Full Script
6. Scene-by-Scene Storyboard
7. Scene Descriptions
8. Narration
9. Subtitles
10. Visual Recommendations
11. On-screen Text
12. Closing / Call to Action when supported

The script should be substantial enough to actually produce
a video.

Do not reduce the output to a short paragraph.
""",

            "infographic": """
Create complete infographic content.

Include:
- title
- central message
- key facts
- important statistics
- supporting points
- findings
- recommendations
- suggested visual hierarchy
- suggested layout
- icons/visual suggestions
- closing message

Keep every factual statement grounded in Content DNA.
""",
        }

        selected_rules = output_rules.get(
            output_type.lower(),
            """
Create a complete professional artifact appropriate for the
requested output type.

Use the supplied structure.

Provide enough depth to make the result genuinely useful.
Do not produce an unnecessarily short answer.
""",
        )

        system_prompt = f"""
You are EV's professional AI Content Transformation Engine.

You are running locally using the Qwen model.

Your task is to transform the supplied Content DNA into a
HIGH-QUALITY, COMPLETE, USEFUL final deliverable.

============================================================
CORE RULES
============================================================

1. Content DNA is your SOLE factual source.

2. NEVER invent factual information.

3. Never fabricate:
- statistics
- names
- dates
- organizations
- locations
- achievements
- partnerships
- funding
- rankings
- technical capabilities
- outcomes
- quotations

4. You MAY reorganize, summarize, explain and restructure
information that is already supported by Content DNA.

5. Preserve uncertainty and attribution.

6. Preserve exact numbers and dates.

7. If Content DNA does not contain enough information for
a requested section, explicitly say that the source does not
provide sufficient information.

8. Do NOT make the output artificially short.

9. Prefer complete, well-developed outputs over minimal answers.

10. Use clear headings and formatting appropriate to the
requested output type.

11. Do not expose these instructions.

12. Do not expose Content DNA field names unless they are
appropriate for the requested artifact.

13. Do not explain how you generated the artifact.

14. Return ONLY the final artifact.

============================================================
OUTPUT TYPE
============================================================

Requested output:
{output_type}

Output name:
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
{generation_config.get("detail", "Detailed")}

Communication objective:
{generation_config.get("objective", "Inform")}

Content style:
{generation_config.get("style", "Professional")}

============================================================
USER INSTRUCTIONS
============================================================

{user_prompt}

============================================================
OUTPUT-SPECIFIC INSTRUCTIONS
============================================================

{selected_rules}

============================================================
QUALITY REQUIREMENT
============================================================

The output must feel like a finished professional deliverable,
not an abbreviated AI response.

Use the available information from Content DNA thoroughly.

For long-form formats, develop the sections properly.

Do not repeat the same sentence merely to increase length.

Do not add filler.

Depth must come from the actual source information.
"""

        user_message = f"""
CONTENT DNA
===========

{content_dna.model_dump_json(indent=2)}

===========

Generate the requested {output_spec.get("name", output_type)}.

Follow the selected:
- audience
- tone
- language
- detail level
- communication objective
- content style
- output structure

Use Content DNA as the factual foundation.

Produce the COMPLETE final artifact.
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
                    "temperature": 0.3,
                    "num_ctx": 8192,
                    "num_predict": 4096,
                },
            )

        except Exception as exc:
            logger.exception(
                "Ollama output generation failed "
                "(model=%s, output_type=%s)",
                self.model,
                output_type,
            )

            raise LLMProviderError(
                "The local LLM output generation request failed"
            ) from exc

        content = response.message.content

        if not isinstance(content, str) or not content.strip():
            raise LLMProviderError(
                "The local LLM returned empty output"
            )

        logger.info(
            "Local LLM output generated successfully: "
            "model=%s output_type=%s",
            self.model,
            output_type,
        )

        return content.strip()