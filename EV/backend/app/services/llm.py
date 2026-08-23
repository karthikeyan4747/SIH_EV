import logging
from typing import Any, Protocol

from groq import Groq
from pydantic import ValidationError

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
            raise LLMProviderError("GROQ_API_KEY is not configured")

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
                        "content": (
                            "You are extracting Content DNA, the canonical structured "
                            "understanding of a source. Content DNA is not merely a summary: "
                            "downstream systems will rely on it to generate executive summaries, "
                            "advisories, presentations, infographics, videos and social media outputs.\n\n"

                            "SOURCE GROUNDING:\n"
                            "- Use only information supported by the source.\n"
                            "- Never invent facts, names, statistics, dates, events, organizations, "
                            "recommendations or conclusions. Do not use outside knowledge.\n"
                            "- If information is unavailable, use an empty string or empty list.\n\n"

                            "COMPLETENESS AND FACTS:\n"
                            "- Extract as much useful information as the source supports; do not "
                            "over-compress it.\n"
                            "- Preserve exact numbers, percentages, measurements, dates, names and terminology.\n"
                            "- Do not alter numerical values. Distinguish factual claims from interpretations.\n\n"

                            "EXTRACTION GUIDANCE:\n"
                            "- Extract relevant people, organizations, locations and technologies.\n"
                            "- Extract important claims, statistics, dates and events.\n"
                            "- Extract source-grounded key findings, risks, opportunities and implications. "
                            "Do not invent speculative risks or opportunities.\n"
                            "- Extract recommendations explicitly present in the source. If none exist, "
                            "return an empty list; do not invent recommendations.\n"
                            "- Extract target audience, tone and communication objective only when supported "
                            "by the source; do not guess.\n"
                            "- For important claims and findings, include concise supporting excerpts where "
                            "possible. For PDFs, preserve useful page references when available.\n"
                            "- Preserve an explicit source title. If there is no title but the subject is "
                            "clear, create a concise descriptive title based only on the source.\n\n"

                            "OUTPUT RULES:\n"
                            "- Return only the structured ContentDNA object.\n"
                            "- Return no Markdown, code fences, explanations, commentary, or text before "
                            "or after the object."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Extract complete ContentDNA as a JSON object from the following source. "
                            "The existing structured output contract is the source of truth for the object shape.\n\n"
                            f"SOURCE TITLE:\n{content.title}\n\n"
                            f"SOURCE TYPE:\n{content.source_type}\n\n"
                            "SOURCE CONTENT:\n"
                            "----------------\n"
                            f"{content.text}\n"
                            "----------------\n"
                        ),
                    },
                ],
            )
        except Exception as exc:
            logger.exception(
                "Groq API/model request failed (model=%s)",
                self.model,
            )
            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            ) from exc

        choices = getattr(completion, "choices", None)
        has_choices = bool(choices)
        raw_content: Any = None

        if has_choices:
            message = getattr(choices[0], "message", None)
            raw_content = getattr(message, "content", None)

        logger.info("LLM CALL COMPLETED")
        logger.info(
            "LLM response object type: %s",
            type(completion).__name__,
        )
        logger.info(
            "LLM response is None: %s",
            completion is None,
        )
        logger.info(
            "LLM response contains choices: %s",
            has_choices,
        )
        logger.info(
            "LLM raw message content: %r",
            raw_content,
        )

        try:
            if completion is None or not has_choices:
                raise LLMProviderError(
                    "The LLM request or structured response was invalid"
                )

            if not isinstance(raw_content, str) or not raw_content.strip():
                raise LLMProviderError(
                    "The LLM request or structured response was invalid"
                )

            return ContentDNA.model_validate_json(raw_content)

        except ValidationError as exc:
            error_types = {error.get("type") for error in exc.errors()}

            if "json_invalid" in error_types:
                logger.exception(
                    "Groq structured output was not valid JSON"
                )
            else:
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

        except Exception as exc:
            logger.exception(
                "Groq structured response parsing failed"
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

        structure = output_spec.get("structure", [])

        structure_text = "\n".join(
            f"{index + 1}. {section}"
            for index, section in enumerate(structure)
        )

        system_prompt = f"""
You are EV's Content Transformation Engine.

Your task is to transform the provided Content DNA into a
high-quality {output_spec.get("name", output_type)}.

CONTENT DNA IS THE SOURCE OF TRUTH.

SOURCE-GROUNDING RULES:

- Use only information contained in the Content DNA.
- Never invent facts, names, organizations, statistics, dates,
  events, recommendations, quotations, or evidence.
- Do not use outside knowledge.
- Do not turn assumptions into facts.
- If information required for the requested artifact is unavailable,
  clearly state that it is unavailable rather than fabricating it.
- Preserve important numbers, dates, terminology, and named entities.
- Keep claims faithful to the source.
- Do not add generic filler simply to make the artifact longer.

OUTPUT REQUIREMENTS:

- Output type: {output_spec.get("name", output_type)}
- Description: {output_spec.get("description", "")}

REQUIRED STRUCTURE:

{structure_text}

GENERATION SETTINGS:

{generation_config}

USER INSTRUCTIONS:

{user_prompt}

The generated artifact must follow the requested structure and
generation settings while remaining completely grounded in the
Content DNA.

IMPORTANT OUTPUT RULES:

The required structure is an INTERNAL GENERATION BLUEPRINT.
Use it to organize the artifact, but do not expose internal
generation instructions or unnecessary metadata.

The final artifact must be directly usable by the operator.

GROUNDING HAS PRIORITY OVER COMPLETENESS:
- Never add information that is not supported by the Content DNA.
- Never upgrade an approximate statement into a precise statement.
  For example, "thousands" must remain "thousands"; do not convert
  it into "over 10,000" or another invented number.
- Never infer achievements, capabilities, opportunities, funding,
  partnerships, rankings, impact, or future outcomes unless they
  are explicitly supported by the Content DNA.
- Never create recommendations when the Content DNA contains no
  explicit recommendations.
- If the requested section has no source-supported information,
  state that no source-supported information was provided.
- Do not use general world knowledge to fill missing information.

FORMATTING:
- Do not use Markdown formatting such as **bold**, *italics*,
  # headings, blockquotes, or Markdown lists unless the requested
  output format explicitly requires Markdown.
- Do not surround ordinary labels or phrases with asterisks.
- Use clean readable text.
- Do not expose internal field names or generation instructions.

EXECUTIVE SUMMARY:
- Produce a polished, concise executive summary.
- Use simple readable section headings when useful.
- Do not expose the internal generation blueprint.

ADVISORY:
- Produce a complete professional advisory.
- Use appropriate document headings.
- Risks, findings, implications, and recommendations must be
  source-grounded.
- If no recommendations exist in the Content DNA, write:
  "No explicit recommendations were provided in the source."
- NEVER create recommendations based on what you think stakeholders
  should do.

LINKEDIN:
- Return only the finished LinkedIn post.
- Do not output labels such as Hook, Body, Call to Action, or Hashtags.
- The result must be directly copyable and publishable.
- Hashtags may be included when appropriate.

PRESENTATION:
- Produce the complete presentation requested by the output
  specification.
- Clearly separate slides.
- Include slide titles and slide content.
- Include speaker notes for every slide.
- Speaker notes are part of the requested deliverable.
- Do not expose the internal generation blueprint.
- Do not invent information in speaker notes.
- Preserve source wording when presenting evidence or quotations.

FINAL OUTPUT:
Return only the requested artifact.
Do not explain how it was generated.
Do not add commentary before or after the artifact.
OUTPUT-SPECIFIC PRESENTATION RULES:

EXECUTIVE SUMMARY:
- Return a polished, ready-to-use executive summary.
- Do not expose internal generation instructions.
- Section headings may be used when they improve readability.
- Do not add commentary about how the summary was generated.

ADVISORY:
- Return the complete, ready-to-use advisory.
- Use appropriate professional headings where required for an
  advisory document.
- Do not expose internal generation instructions.
- Do not add commentary about the generation process.

LINKEDIN:
- Return ONLY the finished LinkedIn post.
- Do NOT output labels such as "Hook", "Body", "Call to Action",
  or "Hashtags".
- Do NOT explain how the post was generated.
- The result must be directly copyable and publishable.

PRESENTATION:
- Return the complete presentation content.
- Clearly separate slides so the presentation can be converted
  into actual slides.
- Include speaker notes for each slide.
- Include appropriate slide titles and slide content.
- Do NOT expose internal generation instructions.
- Speaker notes are part of the requested presentation deliverable
  and therefore MUST be included.

The output must contain only the requested deliverable.
Do not return JSON.
Do not return code fences.
Do not explain your reasoning.


"""

        user_message = f"""
CONTENT DNA
====================

{content_dna.model_dump_json(indent=2)}

====================

Generate the requested {output_spec.get("name", output_type)}.
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

        choices = getattr(completion, "choices", None)

        if not choices:
            raise LLMProviderError(
                "The LLM output generation returned no choices"
            )

        message = getattr(choices[0], "message", None)
        raw_content = getattr(message, "content", None)

        if not isinstance(raw_content, str) or not raw_content.strip():
            raise LLMProviderError(
                "The LLM output generation returned empty content"
            )

        logger.info(
            "LLM output generated successfully: output_type=%s",
            output_type,
        )

        return raw_content.strip()