import json
import logging
import re
from collections import defaultdict
from typing import Any

from groq import Groq
from pydantic import BaseModel, ValidationError

from app.models.content import RawContent
from app.models.transformation import (
    Claim,
    ClaimEvidence,
    Conflict,
    SourceIntegrity,
)


logger = logging.getLogger(__name__)


class SourceIntegrityError(RuntimeError):
    pass


class _ExtractedClaim(BaseModel):
    claim_key: str

    subject: str
    predicate: str
    value: str
    unit: str = ""
    time: str = ""
    location: str = ""
    scope: str = ""

    supporting_excerpt: str = ""
    source_reference: str = ""


class _ClaimExtractionResponse(BaseModel):
    claims: list[_ExtractedClaim]


class SourceIntegrityService:
    """
    Extract, normalize, group, and compare claims across multiple sources.

    V1 responsibilities:
        1. Extract source-grounded claims with the LLM.
        2. Normalize claim identity.
        3. Group semantically equivalent claims.
        4. Detect corroboration and genuine conflicts.
        5. Attach source-level evidence.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
    ) -> None:
        self.model = model
        self.client = Groq(api_key=api_key) if api_key else None

    # ============================================================
    # PUBLIC API
    # ============================================================

    def analyze(
        self,
        sources: list[RawContent],
    ) -> SourceIntegrity:
        if not sources:
            return SourceIntegrity()

        if self.client is None:
            raise SourceIntegrityError(
                "GROQ_API_KEY is not configured"
            )

        all_claims: list[Claim] = []

        for source in sources:
            if not source.text.strip():
                continue

            extracted = self._extract_claims(source)

            for index, item in enumerate(extracted):
                claim = self._build_claim(
                    source=source,
                    extracted=item,
                    index=index,
                )

                all_claims.append(claim)

        if not all_claims:
            return SourceIntegrity()

        conflicts = self._compare_claims(all_claims)

        return SourceIntegrity(
            claims=all_claims,
            conflicts=conflicts,
            resolutions=[],
        )

    # ============================================================
    # CLAIM EXTRACTION
    # ============================================================

    def _extract_claims(
        self,
        source: RawContent,
    ) -> list[_ExtractedClaim]:
        system_prompt = """
You are the claim extraction engine of EV's Source Integrity Engine.

Your task is to extract important factual claims from ONE source.

The source is the only authority.

Do not use outside knowledge.
Do not invent facts.
Do not combine unrelated facts.
Do not infer unsupported information.

For every claim, identify:

claim_key
subject
predicate
value
unit
time
location
scope
supporting_excerpt
source_reference

claim_key is the semantic concept represented by the claim.

Use the same claim_key when different sources describe the same
underlying fact using different wording.

Examples:

"Fourteen organizations were affected."
claim_key = "affected_organizations"

"The incident impacted 14 entities."
claim_key = "affected_organizations"

"17 organizations reported disruption."
claim_key = "affected_organizations"

But:

"17 security incidents were reported."
claim_key = "reported_security_incidents"

"₹2.4 crore in losses were reported."
claim_key = "reported_losses"

Rules for claim_key:

- lowercase
- snake_case
- short and semantic
- do not include the numerical value
- do not include the date
- do not include the source name
- do not include the location
- represent the underlying claim concept

IMPORTANT:

1. Extract claims that can be compared across multiple sources.

2. Normalize wording semantically.

Example:

"Fourteen organizations were affected."

and:

"The incident impacted 14 entities."

should produce approximately:

subject = "organizations"
predicate = "affected_by_incident"
value = "14"
unit = "organizations"

3. Preserve important context.

For example:

"14 organizations were affected in Tamil Nadu in April 2026."

must preserve:

location = "Tamil Nadu"
time = "April 2026"

4. Do not combine claims with different scopes.

5. Do not combine claims describing different measurements.

For example:

"14 organizations were affected."

and:

"17 incidents were reported."

are not the same claim.

6. Recommendations, opinions, hypotheses, and vague statements should
only be extracted when they are presented as meaningful source claims.

7. supporting_excerpt MUST be a DIRECT excerpt from the source.

Do not fabricate quotations.

8. source_reference should identify where the evidence comes from
when the source provides that information.

9. Keep exact numbers, dates, identifiers, names, and units.

10. Extract important claims rather than every sentence.

Return JSON matching:

{
  "claims": [
    {
      "claim_key": "affected_organizations",
      "subject": "organizations",
      "predicate": "affected_by_incident",
      "value": "14",
      "unit": "organizations",
      "time": "22 April 2026",
      "location": "",
      "scope": "",
      "supporting_excerpt": "...",
      "source_reference": "..."
    }
  ]
}
"""

        user_prompt = f"""
SOURCE

Title:
{source.title}

Source type:
{source.source_type}

Source ID:
{source.source_id}

Content:
------------------------------
{source.text}
------------------------------

Extract the important source-grounded claims.

Return ONLY valid JSON.
"""

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                temperature=0,
                response_format={
                    "type": "json_object",
                },
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
            )

        except Exception as exc:
            logger.exception(
                "Source integrity claim extraction failed "
                "(source_id=%s, model=%s)",
                source.source_id,
                self.model,
            )

            raise SourceIntegrityError(
                "Unable to extract claims from source"
            ) from exc

        choices = getattr(
            completion,
            "choices",
            None,
        )

        if not choices:
            raise SourceIntegrityError(
                "Claim extraction returned no choices"
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
            raise SourceIntegrityError(
                "Claim extraction returned empty content"
            )

        try:
            data = json.loads(raw_content)

            parsed = _ClaimExtractionResponse.model_validate(
                data
            )

            return parsed.claims

        except (
            json.JSONDecodeError,
            ValidationError,
        ) as exc:
            logger.exception(
                "Invalid claim extraction response "
                "(source_id=%s)",
                source.source_id,
            )

            raise SourceIntegrityError(
                "Claim extraction returned invalid JSON"
            ) from exc

    # ============================================================
    # CLAIM BUILDING
    # ============================================================

    def _build_claim(
        self,
        source: RawContent,
        extracted: _ExtractedClaim,
        index: int,
    ) -> Claim:
        excerpt = self._validate_excerpt(
            source.text,
            extracted.supporting_excerpt,
        )

        source_reference = (
            extracted.source_reference.strip()
            or self._default_source_reference(source)
        )

        evidence = ClaimEvidence(
            source_id=source.source_id,
            source_reference=source_reference,
            supporting_excerpt=excerpt,
            page=self._extract_page(
                source.metadata
            ),
            section=str(
                source.metadata.get(
                    "section",
                    "",
                )
            ),
            timestamp=self._extract_timestamp(
                source.metadata
            ),
            frame=str(
                source.metadata.get(
                    "frame",
                    "",
                )
            ),
        )

        source_status = (
            "supported"
            if excerpt
            else "uncertain"
        )

        return Claim(
            claim_id=(
                f"claim-{source.source_id[:8]}-"
                f"{index + 1:03d}"
            ),
            claim_key=self._clean(
                extracted.claim_key
            ),
            subject=self._clean(
                extracted.subject
            ),
            predicate=self._clean(
                extracted.predicate
            ),
            value=self._clean(
                extracted.value
            ),
            unit=self._clean(
                extracted.unit
            ),
            time=self._clean(
                extracted.time
            ),
            location=self._clean(
                extracted.location
            ),
            scope=self._clean(
                extracted.scope
            ),
            source_ids=[
                source.source_id,
            ],
            evidence=[
                evidence,
            ],
            status=source_status,
        )

    # ============================================================
    # GROUPING + CONFLICT DETECTION
    # ============================================================

    def _compare_claims(
        self,
        claims: list[Claim],
    ) -> list[Conflict]:
        """
        Compare claims using semantic identity and compatible context.

        Empty context means "not specified", NOT "different".

        Examples:

            22 April + region
            22 April + empty location
                -> compatible

            22 April
            30 April
                -> not compatible

            Tamil Nadu
            Kerala
                -> not compatible

            national
            regional
                -> not compatible
        """

        groups: dict[str, list[Claim]] = defaultdict(list)

        for claim in claims:
            canonical_key = self._canonical_claim_key(
                claim
            )

            groups[canonical_key].append(claim)

        conflicts: list[Conflict] = []

        for canonical_key, group in groups.items():

            if len(group) < 2:
                continue

            # ----------------------------------------------------
            # Compare every pair of claims with compatible context.
            # ----------------------------------------------------

            compared_pairs: set[
                tuple[str, str]
            ] = set()

            for i in range(len(group)):

                for j in range(
                    i + 1,
                    len(group),
                ):
                    claim_a = group[i]
                    claim_b = group[j]

                    if not self._contexts_compatible(
                        claim_a,
                        claim_b,
                    ):
                        continue

                    pair_key = tuple(
                        sorted(
                            [
                                claim_a.claim_id,
                                claim_b.claim_id,
                            ]
                        )
                    )

                    if pair_key in compared_pairs:
                        continue

                    compared_pairs.add(pair_key)

                    value_a = self._normalize_value(
                        claim_a.value
                    )

                    value_b = self._normalize_value(
                        claim_b.value
                    )

                    # ------------------------------------------------
                    # SAME VALUE → CORROBORATED
                    # ------------------------------------------------

                    if (
                        value_a
                        and value_b
                        and value_a == value_b
                    ):
                        claim_a.status = "corroborated"
                        claim_b.status = "corroborated"

                        continue

                    # ------------------------------------------------
                    # DIFFERENT VALUE → CONFLICT
                    # ------------------------------------------------

                    if (
                        value_a
                        and value_b
                        and value_a != value_b
                    ):
                        description = (
                            "Conflicting values detected for "
                            f"{self._human_claim_key(claim_a)}: "
                            f"{self._claim_source_label(claim_a)}: "
                            f"{claim_a.value}; "
                            f"{self._claim_source_label(claim_b)}: "
                            f"{claim_b.value}"
                        )

                        conflicts.append(
                            Conflict(
                                conflict_id=(
                                    f"conflict-"
                                    f"{len(conflicts) + 1:03d}"
                                ),
                                claim_key=canonical_key,
                                claim_ids=[
                                    claim_a.claim_id,
                                    claim_b.claim_id,
                                ],
                                description=description,
                                status="unresolved",
                            )
                        )

                        claim_a.status = "conflict"
                        claim_b.status = "conflict"

        return conflicts

    def _contexts_compatible(
        self,
        claim_a: Claim,
        claim_b: Claim,
    ) -> bool:
        """
        Determine whether two claims refer to a compatible context.

        Empty values are treated as unknown / unspecified and therefore
        do not prevent comparison.

        A conflict only requires the explicitly stated context to agree.
        """

        context_pairs = [
            (
                claim_a.time,
                claim_b.time,
            ),
            (
                claim_a.location,
                claim_b.location,
            ),
            (
                claim_a.scope,
                claim_b.scope,
            ),
        ]

        for value_a, value_b in context_pairs:

            normalized_a = self._normalize_text(
                value_a
            )

            normalized_b = self._normalize_text(
                value_b
            )

            # Neither source specified this context.
            if not normalized_a and not normalized_b:
                continue

            # One source specified it and the other did not.
            # Unknown is compatible with known.
            if not normalized_a or not normalized_b:
                continue

            # Both explicitly specified it.
            # Different values mean different context.
            if normalized_a != normalized_b:
                return False

        return True

    # ============================================================
    # NORMALIZATION
    # ============================================================
    def _canonical_claim_key(
            self,
            claim: Claim,
        ) -> str:
            """
            Build a stable semantic identity for a claim.

            The LLM's claim_key is useful, but it is NOT trusted as the
            sole identity because different sources may describe the same
            fact using different keys.

            We therefore normalize:
                subject
                predicate
                common semantic aliases
                selected claim-key aliases
            """

            subject = self._normalize_text(
                claim.subject
            )

            predicate = self._normalize_text(
                claim.predicate
            )

            claim_key = self._normalize_text(
                claim.claim_key
            )

            # ------------------------------------------------------------
            # SUBJECT ALIASES
            # ------------------------------------------------------------

            subject_aliases = {
                "entity": "organization",
                "entities": "organization",
                "org": "organization",
                "orgs": "organization",
                "organizations": "organization",

                "institution": "organization",
                "institutions": "organization",

                "company": "organization",
                "companies": "organization",
            }

            # ------------------------------------------------------------
            # PREDICATE ALIASES
            # ------------------------------------------------------------

            predicate_aliases = {
                "impacted by incident": "affected by incident",
                "impacted by": "affected by incident",
                "affected by": "affected by incident",
                "affected by incident": "affected by incident",

                "impacted": "affected",
                "was impacted": "affected",
            }

            subject = subject_aliases.get(
                subject,
                subject,
            )

            predicate = predicate_aliases.get(
                predicate,
                predicate,
            )

            # ------------------------------------------------------------
            # CLAIM-KEY ALIASES
            #
            # These are deliberately conservative.
            # Do NOT turn unrelated concepts into the same claim.
            # ------------------------------------------------------------

            claim_key_aliases = {
                # SIH / hackathon victory
                "won sih problem statement": "hackathon_win",
                "won hackathon": "hackathon_win",
                "hackathon victory": "hackathon_win",
                "hackathon win": "hackathon_win",
                "sih victory": "hackathon_win",
                "sih win": "hackathon_win",
                "won sih": "hackathon_win",

                # Organization impact
                "affected organizations": "affected_organizations",
                "affected organization": "affected_organizations",
                "impacted organizations": "affected_organizations",
                "impacted organization": "affected_organizations",
                "impacted entities": "affected_organizations",

                # Reported incidents
                "reported incidents": "reported_security_incidents",
                "reported security incidents": "reported_security_incidents",
                "security incidents reported": "reported_security_incidents",

                # Losses
                "reported loss": "reported_losses",
                "reported losses": "reported_losses",
                "financial losses": "reported_losses",
            }

            normalized_claim_key = claim_key_aliases.get(
                claim_key,
                claim_key,
            )

            # ------------------------------------------------------------
            # Strong semantic identity rules
            # ------------------------------------------------------------

            if (
                normalized_claim_key == "hackathon_win"
                or (
                    "hackathon" in claim_key
                    and any(
                        word in claim_key
                        for word in (
                            "win",
                            "won",
                            "victory",
                        )
                    )
                )
            ):
                return "hackathon_win"

            if normalized_claim_key == "affected_organizations":
                return "affected_by_incident_organization"

            if normalized_claim_key == "reported_security_incidents":
                return "reported_security_incidents"

            if normalized_claim_key == "reported_losses":
                return "reported_losses"

            # ------------------------------------------------------------
            # Generic subject + predicate identity
            # ------------------------------------------------------------

            return (
                f"{predicate}_{subject}"
            )

    def _claim_group_key(
        self,
        claim: Claim,
    ) -> str:
        return self._canonical_claim_key(
            claim
        )

    def _normalize_text(
        self,
        value: str,
    ) -> str:
        value = value.strip().lower()

        value = re.sub(
            r"[^a-z0-9]+",
            " ",
            value,
        )

        value = re.sub(
            r"\s+",
            " ",
            value,
        )

        return value.strip()

    def _normalize_value(
        self,
        value: str,
    ) -> str:
        value = value.strip().lower()

        # Normalize commas in numbers:
        # 17,304 -> 17304
        value = value.replace(",", "")

        value = re.sub(
            r"\s+",
            " ",
            value,
        )

        value = re.sub(
            r"₹\s+",
            "₹",
            value,
        )

        return value.strip()

    # ============================================================
    # EVIDENCE
    # ============================================================

    def _validate_excerpt(
        self,
        source_text: str,
        excerpt: str,
    ) -> str:
        excerpt = excerpt.strip()

        if not excerpt:
            return ""

        normalized_source = self._normalize_for_match(
            source_text
        )

        normalized_excerpt = self._normalize_for_match(
            excerpt
        )

        if (
            normalized_excerpt
            and normalized_excerpt in normalized_source
        ):
            return excerpt

        words = [
            word
            for word in re.findall(
                r"\b[\w₹$%.-]+\b",
                excerpt.lower(),
            )
            if len(word) > 2
        ]

        if len(words) >= 5:
            source_lower = source_text.lower()

            matched_words = [
                word
                for word in words
                if word in source_lower
            ]

            if (
                len(matched_words)
                >= max(
                    5,
                    int(len(words) * 0.7),
                )
            ):
                return excerpt

        logger.warning(
            "Claim evidence excerpt could not be verified "
            "against source text"
        )

        return ""

    def _normalize_for_match(
        self,
        value: str,
    ) -> str:
        return re.sub(
            r"\s+",
            " ",
            value.strip().lower(),
        )

    def _default_source_reference(
        self,
        source: RawContent,
    ) -> str:
        filename = str(
            source.metadata.get(
                "filename",
                "",
            )
        ).strip()

        if filename:
            return filename

        return source.title or source.source_type

    def _extract_page(
        self,
        metadata: dict[str, Any],
    ) -> int | None:
        value = metadata.get("page")

        if isinstance(value, int):
            return value

        if (
            isinstance(value, str)
            and value.isdigit()
        ):
            return int(value)

        return None

    def _extract_timestamp(
        self,
        metadata: dict[str, Any],
    ) -> str:
        for key in (
            "timestamp",
            "start_timestamp",
            "start_time",
        ):
            value = metadata.get(key)

            if value is not None:
                return str(value)

        return ""

    # ============================================================
    # DISPLAY HELPERS
    # ============================================================

    def _human_claim_key(
        self,
        claim: Claim,
    ) -> str:
        subject = claim.subject.strip()

        if claim.unit:
            return subject

        return (
            f"{subject} "
            f"{claim.predicate.replace('_', ' ')}"
        ).strip()

    def _claim_source_label(
        self,
        claim: Claim,
    ) -> str:
        if claim.evidence:
            return claim.evidence[0].source_reference

        if claim.source_ids:
            return claim.source_ids[0]

        return "Unknown source"

    def _build_conflict_description(
        self,
        claims: list[Claim],
    ) -> str:
        parts = []

        for claim in claims:
            source_label = (
                claim.evidence[0].source_reference
                if claim.evidence
                else (
                    claim.source_ids[0]
                    if claim.source_ids
                    else "Unknown source"
                )
            )

            parts.append(
                f"{source_label}: {claim.value}"
            )

        return (
            "Conflicting values detected for "
            f"{self._human_claim_key(claims[0])}: "
            + "; ".join(parts)
        )

    def _clean(
        self,
        value: str,
    ) -> str:
        return value.strip()