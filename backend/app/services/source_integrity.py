import json
import logging
import re
from collections import defaultdict
from typing import Any

from groq import Groq
from pydantic import BaseModel, ValidationError

try:
    from ollama import Client as OllamaClient
except ImportError:
    OllamaClient = None

from app.core.config import settings
from app.models.content import RawContent
from app.models.transformation import (
    Claim,
    ClaimEvidence,
    Conflict,
    SourceIntegrity,
)
from app.services.context_budget import get_context_budget
from app.services.document_chunker import (
    chunk_document,
    estimate_tokens,
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


def _extract_json(text: str) -> str:
    if not text:
        return ""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned
        cleaned = cleaned.lstrip("`").lstrip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip()
    if cleaned.endswith("```"):
        cleaned = cleaned[: cleaned.rfind("```")].rstrip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start : end + 1]
    return cleaned


def _safe_parse_claim_json(raw_content: str) -> list[_ExtractedClaim]:
    """Resilient claim parser that handles valid, unclosed, or partially truncated JSON."""
    if not raw_content or not raw_content.strip():
        return []

    raw_json = _extract_json(raw_content)

    # Attempt 1: Direct JSON parsing
    try:
        data = json.loads(raw_json)
        if isinstance(data, dict) and "claims" in data and isinstance(data["claims"], list):
            parsed = _ClaimExtractionResponse.model_validate(data)
            return parsed.claims
        elif isinstance(data, list):
            return [_ExtractedClaim.model_validate(c) for c in data if isinstance(c, dict)]
    except Exception:
        pass

    # Attempt 2: Auto-repair unclosed strings/brackets
    repaired = raw_json.strip()
    if repaired.count('"') % 2 != 0:
        repaired += '"'
    if "]" not in repaired:
        repaired += "]"
    if not repaired.endswith("}"):
        repaired += "}"
    try:
        data = json.loads(repaired)
        if isinstance(data, dict) and "claims" in data and isinstance(data["claims"], list):
            return _ClaimExtractionResponse.model_validate(data).claims
    except Exception:
        pass

    # Attempt 3: Regex match individual claim objects {"claim_key": ...}
    claims: list[_ExtractedClaim] = []
    blocks = re.findall(r'\{[^{}]*?"claim_key"[^{}]*?\}', raw_content, re.DOTALL)
    for block in blocks:
        try:
            item = json.loads(block)
            claims.append(_ExtractedClaim.model_validate(item))
        except Exception:
            continue

    return claims


class SourceIntegrityService:
    """
    Extract, normalize, group, and compare claims across multiple sources.

    Responsibilities:
        1. Extract source-grounded claims with the LLM.
        2. Generate deterministic canonical semantic claim keys.
        3. Group semantically equivalent claims across sources.
        4. Normalize multi-type values (numbers, dates, locations, booleans, status).
        5. Detect genuine multi-source contradictions while avoiding false positives.
        6. Produce deduplicated, human-readable IntegrityConflict records.
    """

    def __init__(
        self,
        api_key: str = "",
        model: str = "",
        mode: str = "",
        ollama_host: str = "",
        ollama_model: str = "",
    ) -> None:
        self.mode = (mode or ("local" if settings.llm_provider.lower() == "ollama" else "api")).lower()
        if self.mode == "local":
            self.model = model or ollama_model or settings.ollama_model
            self.ollama_host = ollama_host or settings.ollama_host
            self.ollama_client = OllamaClient(host=self.ollama_host) if OllamaClient is not None else None
            self.pool = None
            self.client = None
        else:
            self.model = model or settings.groq_model
            from app.services.llm import GroqKeyPool
            self.pool = GroqKeyPool(api_key or settings.get_groq_api_keys())
            self.client = self.pool if self.pool.has_keys else None
            self.ollama_client = None

    # ============================================================
    # PUBLIC API
    # ============================================================

    def analyze(
        self,
        sources: list[RawContent],
    ) -> SourceIntegrity:
        if not sources:
            return SourceIntegrity()

        if self.mode == "local" and self.ollama_client is None:
            raise SourceIntegrityError(
                "The local Ollama client is not installed or configured"
            )
        if self.mode == "api" and self.client is None:
            raise SourceIntegrityError(
                "GROQ_API_KEY is not configured"
            )

        budget = get_context_budget(self.mode)
        expanded_sources: list[RawContent] = []

        for source in sources:
            if not source.text.strip():
                continue

            if budget.fits_single_pass(
                estimate_tokens(source.text)
            ):
                expanded_sources.append(source)
                continue

            for chunk in chunk_document(
                source.text,
                source_id=source.source_id,
                metadata=source.metadata,
                budget=budget,
            ):
                expanded_sources.append(
                    RawContent(
                        source_id=(
                            f"{source.source_id}"
                            f":chunk{chunk.chunk_index + 1}"
                        ),
                        source_type=source.source_type,
                        title=source.title,
                        text=chunk.text,
                        metadata={
                            **source.metadata,
                            "page": chunk.page_start,
                            "section": (
                                f"chunk "
                                f"{chunk.chunk_index + 1}"
                                f"/{chunk.total_chunks}"
                            ),
                            "chunk_id": chunk.chunk_id,
                        },
                    )
                )

        all_claims: list[Claim] = []

        for source in expanded_sources:
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

Extract key factual claims from the source. The source is the only authority.
Do not invent facts. Do not combine unrelated statements.

For each claim, output:
- claim_key: A normalized semantic property name (e.g. "employee_count", "launch_year", "headquarters", "revenue", "loss", "incident_location", "status", "battery_capacity").
- subject: The specific entity, project, person, or incident the claim is about (e.g. "Project X", "Company Y", "NASA", "Artemis I", "The incident").
- predicate: The property or action relationship (e.g. "launched_in", "employs", "headquartered_in", "occurred_in", "reported_revenue", "has_status").
- value: The exact extracted value or measurement (e.g. "2022", "500", "Chennai", "active", "true", "$10M", "14").
- unit: The unit of measurement if applicable (e.g. "employees", "people", "USD", "INR", "kWh", "%").
- time: Specific year or timeframe if explicitly part of context (e.g. "2022", "2024").
- location: Specific city, state, or country if explicitly part of context (e.g. "Chennai", "Bengaluru").
- scope: Specific scope if applicable.
- supporting_excerpt: Direct verbatim quote from the text supporting this claim.
- source_reference: Source title or document name.

Rules:
1. Normalize claim_key to snake_case (e.g. "employee_count", "launch_year").
2. Extract specific, verifiable factual statements (numbers, dates, locations, status, outcomes).
3. Do not include the value itself in the claim_key or predicate.
4. Keep exact numbers, dates, and locations.

Return JSON format:
{
  "claims": [
    {
      "claim_key": "employee_count",
      "subject": "Company X",
      "predicate": "employs",
      "value": "500",
      "unit": "employees",
      "time": "",
      "location": "",
      "scope": "",
      "supporting_excerpt": "Company X employs 500 people.",
      "source_reference": "Document A"
    }
  ]
}
"""

        user_prompt = f"""
SOURCE DOCUMENT:
Title: {source.title}
Source Type: {source.source_type}

CONTENT:
{source.text}

Extract all factual claims in valid JSON:
"""

        if self.mode == "local":
            try:
                response = self.ollama_client.chat(
                    model=self.model,
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
                    options={"temperature": 0.0},
                )
                raw_content = response["message"]["content"]
            except Exception as exc:
                logger.exception("Ollama claim extraction failed: %s", exc)
                raise SourceIntegrityError(f"Claim extraction failed: {exc}") from exc
        else:
            try:
                from app.services.llm import _call_groq
                completion = _call_groq(
                    self.pool,
                    self.model,
                    max_tokens=4096,
                    temperature=0.0,
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
                raw_content = completion.choices[0].message.content
            except Exception as exc:
                logger.exception("Groq claim extraction failed: %s", exc)
                raise SourceIntegrityError(f"Claim extraction failed: {exc}") from exc

        if not isinstance(raw_content, str) or not raw_content.strip():
            raise SourceIntegrityError("Claim extraction returned empty content")

        return _safe_parse_claim_json(raw_content)

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
            page=self._extract_page(source.metadata),
            section=str(source.metadata.get("section", "")),
            timestamp=self._extract_timestamp(source.metadata),
            frame=str(source.metadata.get("frame", "")),
        )

        source_status = "supported" if excerpt else "uncertain"

        # If claim_key was empty, infer from predicate or subject
        claim_key = self._clean(extracted.claim_key) or self._clean(extracted.predicate) or "fact"

        return Claim(
            claim_id=f"claim-{source.source_id[:8]}-{index + 1:03d}",
            claim_key=claim_key,
            subject=self._clean(extracted.subject),
            predicate=self._clean(extracted.predicate),
            value=self._clean(extracted.value),
            unit=self._clean(extracted.unit),
            time=self._clean(extracted.time),
            location=self._clean(extracted.location),
            scope=self._clean(extracted.scope),
            source_ids=[source.source_id],
            evidence=[evidence],
            status=source_status,
        )

    # ============================================================
    # DETERMINISTIC CANONICAL KEY GENERATION
    # ============================================================

    def _canonical_predicate(
        self,
        predicate: str,
        claim_key: str = "",
    ) -> str:
        text = f"{self._normalize_text(claim_key)} {self._normalize_text(predicate)}".strip()

        # Workforce & Employees
        if any(w in text for w in ("employee", "workforce", "staff", "headcount", "personnel", "workers", "employ")):
            return "employee_count"

        # Launch & Release Dates
        if any(w in text for w in ("launch", "released", "release date", "debut")):
            return "launch_date"

        # Founding & Establishment
        if any(w in text for w in ("founded", "founding", "established", "started in", "created in")):
            return "founding_date"

        # Headquarters & Office Location
        if any(w in text for w in ("headquarter", "headquarters", "based in", "main office", "hq")):
            return "headquarters"

        # Occurrence & Incident Location
        if any(w in text for w in ("occurred", "happened", "took place", "location of incident", "incident location")):
            return "incident_location"

        # Revenue & Financial Turnover
        if any(w in text for w in ("revenue", "turnover", "annual sales", "total sales")):
            return "revenue"

        # Loss & Financial Damage
        if any(w in text for w in ("loss", "damage", "losses", "financial loss")):
            return "reported_losses"

        # Security Incidents & Breaches
        if any(w in text for w in ("security incident", "breach", "cyber attack", "outage", "incidents reported")):
            return "reported_security_incidents"

        # Organizations Affected
        if any(w in text for w in ("affected", "impacted", "disrupted", "hit")):
            if not any(w in text for w in ("loss", "financial", "revenue")):
                return "affected_organizations"

        # Hackathon / SIH Victory
        if any(w in text for w in ("hackathon", "sih", "problem statement", "won victory", "won")):
            return "hackathon_win"

        # Status & State
        if any(w in text for w in ("status", "condition", "state", "active status")):
            return "status"

        # Feature Enabled
        if any(w in text for w in ("feature", "enabled", "capability", "functionality")):
            return "feature_enabled"

        # Fallback to normalized predicate
        norm_pred = self._normalize_predicate(predicate)
        norm_key = self._normalize_text(claim_key)
        return norm_key if norm_key and norm_key not in ("fact", "claim") else (norm_pred or "fact")

    def _canonical_subject(
        self,
        subject: str,
    ) -> str:
        clean = self._normalize_text(subject)
        # Strip leading articles
        clean = re.sub(r"^(?:the|a|an)\s+", "", clean).strip()
        # Canonical entity aliases
        aliases = {
            "entity": "organization",
            "entities": "organization",
            "org": "organization",
            "orgs": "organization",
            "organizations": "organization",
            "company": "organization",
            "companies": "organization",
            "institution": "organization",
            "institutions": "organization",
            "enterprise": "organization",
            "corporation": "organization",
            "firm": "organization",
            "people": "person",
            "persons": "person",
            "user": "person",
            "users": "person",
            "customer": "person",
            "customers": "person",
            "employee": "person",
            "employees": "person",
            "incident": "incident",
            "event": "incident",
            "the incident": "incident",
        }
        return aliases.get(clean, clean)

    def _canonical_claim_key(
        self,
        claim: Claim,
    ) -> str:
        """
        Build a deterministic canonical key representing the logical property of an entity.
        Format: {normalized_subject}|{canonical_predicate}[|{time}][|{location}]
        """
        subject = self._canonical_subject(claim.subject) or "unknown"
        predicate = self._canonical_predicate(claim.predicate, claim.claim_key)

        # Include temporal qualification if explicitly part of context and not the value itself
        time_part = ""
        norm_time = self._normalize_text(claim.time)
        norm_val = self._normalize_text(claim.value)
        if norm_time and norm_time != norm_val and norm_time not in norm_val:
            time_part = f"|{norm_time}"

        # Include geographic qualification if explicitly part of context and not the value itself
        loc_part = ""
        norm_loc = self._normalize_text(claim.location)
        if norm_loc and norm_loc != norm_val and norm_loc not in norm_val and predicate != "incident_location" and predicate != "headquarters":
            loc_part = f"|{norm_loc}"

        return f"{subject}|{predicate}{time_part}{loc_part}"

    # ============================================================
    # MULTI-TYPE VALUE NORMALIZATION & EQUIVALENCE
    # ============================================================

    def _normalize_value_for_comparison(
        self,
        claim: Claim,
    ) -> tuple[str, Any]:
        """
        Normalize claim value into a typed representation for deterministic equivalence & conflict detection.
        Returns: (type_tag, normalized_canonical_value)
        """
        val_str = claim.value.strip().lower()

        # 1. Booleans
        bool_map_true = {"true", "yes", "enabled", "active", "passed", "success", "1"}
        bool_map_false = {"false", "no", "disabled", "inactive", "failed", "failure", "0"}
        if val_str in bool_map_true:
            return ("boolean", True)
        if val_str in bool_map_false:
            return ("boolean", False)

        # 2. Locations / Geographic entities
        location_aliases = {
            "usa": "united states",
            "u.s.": "united states",
            "u.s.a.": "united states",
            "united states": "united states",
            "united states of america": "united states",
            "uk": "united kingdom",
            "u.k.": "united kingdom",
            "united kingdom": "united kingdom",
            "britain": "united kingdom",
            "great britain": "united kingdom",
            "bengaluru": "bengaluru",
            "bangalore": "bengaluru",
            "chennai": "chennai",
            "madras": "chennai",
            "mumbai": "mumbai",
            "bombay": "mumbai",
            "kolkata": "kolkata",
            "calcutta": "kolkata",
            "new delhi": "delhi",
            "delhi": "delhi",
        }
        clean_loc = self._normalize_text(val_str)
        if clean_loc in location_aliases:
            return ("location", location_aliases[clean_loc])

        # 3. Percentages
        pct_match = re.search(r"[-+]?\d+(?:\.\d+)?\s*(?:%|percent|pct)", val_str)
        if pct_match or "%" in val_str or "%" in claim.unit:
            num = re.search(r"[-+]?\d+(?:\.\d+)?", val_str)
            if num:
                return ("percentage", float(num.group(0)))

        # 4. Numbers & Quantities
        # Convert word numbers
        number_words = {
            "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
            "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
            "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
            "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
            "eighteen": "18", "nineteen": "19", "twenty": "20", "thirty": "30",
            "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70",
            "eighty": "80", "ninety": "90", "hundred": "100",
        }
        for word, number in number_words.items():
            val_str = re.sub(rf"\b{word}\b", number, val_str)

        val_str = val_str.replace(",", "")

        # Detect currency
        currency = ""
        if "$" in val_str or "usd" in val_str or "dollar" in val_str or "$" in claim.unit:
            currency = "USD"
        elif "₹" in val_str or "inr" in val_str or "rupee" in val_str or "rs" in val_str or "₹" in claim.unit:
            currency = "INR"
        elif "€" in val_str or "eur" in val_str or "euro" in val_str:
            currency = "EUR"
        elif "£" in val_str or "gbp" in val_str or "pound" in val_str:
            currency = "GBP"

        # Standardize attached scale suffixes: e.g. 10m -> 10 million, 10k -> 10 thousand
        val_str = re.sub(r"(?<=\d)\s*m\b", " million", val_str)
        val_str = re.sub(r"(?<=\d)\s*b\b", " billion", val_str)
        val_str = re.sub(r"(?<=\d)\s*k\b", " thousand", val_str)
        val_str = re.sub(r"(?<=\d)\s*cr\b", " crore", val_str)
        val_str = re.sub(r"(?<=\d)\s*l\b", " lakh", val_str)

        # Check numeric scales
        scale = 1.0
        if re.search(r"\b(?:billion|b)\b", val_str):
            scale = 1_000_000_000.0
        elif re.search(r"\b(?:million|m)\b", val_str):
            scale = 1_000_000.0
        elif re.search(r"\b(?:crore|crores)\b", val_str):
            scale = 10_000_000.0
        elif re.search(r"\b(?:lakh|lakhs)\b", val_str):
            scale = 100_000.0
        elif re.search(r"\b(?:thousand|k)\b", val_str):
            scale = 1_000.0

        num_match = re.search(r"[-+]?\d+(?:\.\d+)?", val_str)
        if num_match:
            try:
                base_num = float(num_match.group(0))
                final_val = base_num * scale
                unit_label = currency or self._canonical_subject(claim.unit)
                return ("number", (final_val, unit_label))
            except ValueError:
                pass

        # 5. Default Clean Text String
        return ("string", self._normalize_text(claim.value))

    def _values_are_incompatible(
        self,
        claim_a: Claim,
        claim_b: Claim,
    ) -> bool:
        """
        Deterministic comparison of two claim values.
        Returns True if they are genuinely contradictory, False if equivalent / corroborating.
        """
        type_a, val_a = self._normalize_value_for_comparison(claim_a)
        type_b, val_b = self._normalize_value_for_comparison(claim_b)

        # Both numbers / currencies / quantities
        if type_a == "number" and type_b == "number":
            num_a, unit_a = val_a
            num_b, unit_b = val_b

            if unit_a and unit_b and unit_a != unit_b:
                if not self._units_compatible(unit_a, unit_b):
                    return False  # Different measurement domains

            # Check exact equality or minor rounding tolerance if approximate
            is_approx = any(
                term in (claim_a.value + " " + claim_b.value).lower()
                for term in ("approx", "around", "about", "nearly", "roughly")
            )
            if is_approx and num_a > 0 and num_b > 0:
                diff_pct = abs(num_a - num_b) / max(num_a, num_b)
                if diff_pct <= 0.05:  # Within 5% tolerance for approximate figures
                    return False

            return num_a != num_b

        # Both percentages
        if type_a == "percentage" and type_b == "percentage":
            return abs(val_a - val_b) > 0.01

        # Both booleans
        if type_a == "boolean" and type_b == "boolean":
            return val_a != val_b

        # Both locations
        if type_a == "location" and type_b == "location":
            return val_a != val_b

        # Text strings
        if type_a == "string" and type_b == "string":
            if val_a == val_b:
                return False
            if val_a in val_b or val_b in val_a:
                return False
            return True

        return str(val_a) != str(val_b)

    # ============================================================
    # DETERMINISTIC MULTI-SOURCE CONFLICT DETECTION
    # ============================================================

    def _compare_claims(
        self,
        claims: list[Claim],
    ) -> list[Conflict]:
        """
        Deterministic, robust multi-source conflict detection.
        Groups claims by canonical key, compares values across sources,
        and generates deduplicated IntegrityConflict objects.
        """
        groups: dict[str, list[Claim]] = defaultdict(list)

        for claim in claims:
            key = self._canonical_claim_key(claim)
            groups[key].append(claim)

        conflicts: list[Conflict] = []
        handled_claim_ids: set[str] = set()

        # Pass 1: Canonical Key Groups
        for canonical_key, group_claims in groups.items():
            if len(group_claims) < 2:
                continue

            # Identify distinct sources
            source_map: dict[str, list[Claim]] = defaultdict(list)
            for c in group_claims:
                for sid in c.source_ids:
                    source_map[sid].append(c)

            # Group claims by normalized value
            value_groups: dict[Any, list[Claim]] = defaultdict(list)
            for c in group_claims:
                typed_val = self._normalize_value_for_comparison(c)
                value_groups[typed_val].append(c)

            # If all values are identical
            if len(value_groups) == 1:
                for c in group_claims:
                    if c.status != "conflict":
                        c.status = "corroborated"
                continue

            # Check if any pairs of value groups are truly incompatible
            distinct_vals = list(value_groups.keys())
            has_contradiction = False
            for i in range(len(distinct_vals)):
                for j in range(i + 1, len(distinct_vals)):
                    sample_a = value_groups[distinct_vals[i]][0]
                    sample_b = value_groups[distinct_vals[j]][0]
                    if self._values_are_incompatible(sample_a, sample_b):
                        has_contradiction = True
                        break
                if has_contradiction:
                    break

            if not has_contradiction:
                for c in group_claims:
                    if c.status != "conflict":
                        c.status = "corroborated"
                continue

            # A multi-source contradiction exists!
            competing_claims = group_claims
            conflict_id = f"conflict-{len(conflicts) + 1:03d}"

            description = self._build_conflict_description(competing_claims)
            reason = self._build_conflict_reason(competing_claims)

            logger.debug(
                "CONFLICT DETECTED: key=%s, claims=%s",
                canonical_key,
                [c.claim_id for c in competing_claims],
            )

            conflicts.append(
                Conflict(
                    conflict_id=conflict_id,
                    claim_key=canonical_key,
                    claim_ids=[c.claim_id for c in competing_claims],
                    description=description,
                    reason=reason,
                    status="unresolved",
                )
            )

            for c in competing_claims:
                c.status = "conflict"
                handled_claim_ids.add(c.claim_id)

        # Pass 2: Cross-group comparison for unaligned keys across DIFFERENT sources
        unhandled_claims = [c for c in claims if c.claim_id not in handled_claim_ids]
        for i in range(len(unhandled_claims)):
            for j in range(i + 1, len(unhandled_claims)):
                c_a = unhandled_claims[i]
                c_b = unhandled_claims[j]

                # Only compare across different sources
                if set(c_a.source_ids) == set(c_b.source_ids) and len(c_a.source_ids) == 1:
                    continue

                if self._claims_are_comparable(c_a, c_b):
                    if self._values_are_incompatible(c_a, c_b):
                        conflict_id = f"conflict-{len(conflicts) + 1:03d}"
                        canonical_key = self._canonical_claim_key(c_a)
                        competing = [c_a, c_b]
                        conflicts.append(
                            Conflict(
                                conflict_id=conflict_id,
                                claim_key=canonical_key,
                                claim_ids=[c_a.claim_id, c_b.claim_id],
                                description=self._build_conflict_description(competing),
                                reason=self._build_conflict_reason(competing),
                                status="unresolved",
                            )
                        )
                        c_a.status = "conflict"
                        c_b.status = "conflict"
                        handled_claim_ids.add(c_a.claim_id)
                        handled_claim_ids.add(c_b.claim_id)
                    else:
                        if c_a.status != "conflict":
                            c_a.status = "corroborated"
                        if c_b.status != "conflict":
                            c_b.status = "corroborated"

        return conflicts

    def _claims_are_comparable(
        self,
        claim_a: Claim,
        claim_b: Claim,
    ) -> bool:
        """Determines if two claims discuss the same underlying property."""
        if not self._contexts_compatible(claim_a, claim_b):
            return False

        if not self._units_compatible(claim_a.unit, claim_b.unit):
            return False

        # Check subject compatibility FIRST
        sub_a = self._canonical_subject(claim_a.subject)
        sub_b = self._canonical_subject(claim_b.subject)
        if sub_a != sub_b:
            generic = {"organization", "person", "entity", "incident", "unknown", ""}
            if not (sub_a in generic and sub_b in generic):
                return False

        # Direct claim key match
        if claim_a.claim_key and claim_a.claim_key == claim_b.claim_key:
            return True

        # Canonical key match
        canonical_a = self._canonical_claim_key(claim_a)
        canonical_b = self._canonical_claim_key(claim_b)
        if canonical_a and canonical_a == canonical_b:
            return True

        pred_a = self._canonical_predicate(claim_a.predicate, claim_a.claim_key)
        pred_b = self._canonical_predicate(claim_b.predicate, claim_b.claim_key)
        if pred_a == pred_b or self._predicates_related(claim_a.predicate, claim_b.predicate):
            return True

        return False

    def _contexts_compatible(
        self,
        claim_a: Claim,
        claim_b: Claim,
    ) -> bool:
        context_pairs = [
            (claim_a.time, claim_b.time),
            (claim_a.location, claim_b.location),
            (claim_a.scope, claim_b.scope),
        ]

        for value_a, value_b in context_pairs:
            normalized_a = self._normalize_text(value_a)
            normalized_b = self._normalize_text(value_b)

            if not normalized_a and not normalized_b:
                continue
            if not normalized_a or not normalized_b:
                continue
            if normalized_a != normalized_b:
                return False

        return True

    def _normalize_text(
        self,
        value: str,
    ) -> str:
        value = value.strip().lower()
        value = re.sub(r"[^a-z0-9]+", " ", value)
        return re.sub(r"\s+", " ", value).strip()

    def _normalize_subject(
        self,
        value: str,
    ) -> str:
        return self._canonical_subject(value)

    def _normalize_predicate(
        self,
        value: str,
    ) -> str:
        return self._normalize_text(value)

    def _predicates_related(
        self,
        predicate_a: str,
        predicate_b: str,
    ) -> bool:
        norm_a = self._canonical_predicate(predicate_a)
        norm_b = self._canonical_predicate(predicate_b)
        return norm_a == norm_b or norm_a in norm_b or norm_b in norm_a

    def _units_compatible(
        self,
        unit_a: str,
        unit_b: str,
    ) -> bool:
        norm_a = self._normalize_text(unit_a)
        norm_b = self._normalize_text(unit_b)

        if not norm_a or not norm_b:
            return True

        currency_map = {
            "$": "usd", "usd": "usd", "dollar": "usd", "dollars": "usd",
            "₹": "inr", "inr": "inr", "rupee": "inr", "rupees": "inr", "rs": "inr",
            "€": "eur", "eur": "eur", "euro": "eur", "euros": "eur",
            "£": "gbp", "gbp": "gbp", "pound": "gbp", "pounds": "gbp",
        }
        curr_a = currency_map.get(norm_a, norm_a)
        curr_b = currency_map.get(norm_b, norm_b)
        if curr_a in ("usd", "inr", "eur", "gbp") or curr_b in ("usd", "inr", "eur", "gbp"):
            return curr_a == curr_b

        time_map = {
            "hr": "hour", "hrs": "hour", "hour": "hour", "hours": "hour",
            "min": "minute", "mins": "minute", "minute": "minute", "minutes": "minute",
            "sec": "second", "secs": "second", "second": "second", "seconds": "second",
            "day": "day", "days": "day", "mo": "month", "month": "month", "months": "month",
            "yr": "year", "yrs": "year", "year": "year", "years": "year",
        }
        time_a = time_map.get(norm_a, norm_a)
        time_b = time_map.get(norm_b, norm_b)
        if time_a in ("hour", "minute", "second", "day", "month", "year") or time_b in ("hour", "minute", "second", "day", "month", "year"):
            return time_a == time_b

        people_map = {"employee": "person", "employees": "person", "people": "person", "workers": "person", "users": "person", "members": "person"}
        p_a = people_map.get(norm_a, norm_a)
        p_b = people_map.get(norm_b, norm_b)
        if p_a == "person" and p_b == "person":
            return True

        return norm_a == norm_b

    def _normalize_value(
        self,
        value: str,
    ) -> str:
        """Helper to return normalized clean string value."""
        type_tag, val = self._normalize_value_for_comparison(
            Claim(
                claim_id="tmp",
                claim_key="",
                subject="",
                predicate="",
                value=value,
            )
        )
        return str(val)

    # ============================================================
    # EVIDENCE & CITATIONS
    # ============================================================

    def _validate_excerpt(
        self,
        source_text: str,
        excerpt: str,
    ) -> str:
        excerpt = excerpt.strip()
        if not excerpt:
            return ""

        norm_src = self._normalize_text(source_text)
        norm_exc = self._normalize_text(excerpt)
        if norm_exc and norm_exc in norm_src:
            return excerpt

        words = [w for w in norm_exc.split() if len(w) > 2]
        if len(words) >= 4:
            matched = sum(1 for w in words if w in norm_src)
            if matched >= max(4, int(len(words) * 0.65)):
                return excerpt

        return ""

    def _default_source_reference(
        self,
        source: RawContent,
    ) -> str:
        filename = str(source.metadata.get("filename", "")).strip()
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
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    def _extract_timestamp(
        self,
        metadata: dict[str, Any],
    ) -> str:
        for key in ("timestamp", "start_timestamp", "start_time"):
            val = metadata.get(key)
            if val is not None:
                return str(val)
        return ""

    # ============================================================
    # HUMAN-READABLE DESCRIPTIONS
    # ============================================================

    def _human_claim_key(
        self,
        claim: Claim,
    ) -> str:
        subject = claim.subject.strip()
        pred = claim.predicate.replace("_", " ").strip()
        return f"{subject} {pred}".strip()

    def _claim_source_label(
        self,
        claim: Claim,
    ) -> str:
        if claim.evidence and claim.evidence[0].source_reference:
            return claim.evidence[0].source_reference
        if claim.source_ids:
            return claim.source_ids[0]
        return "Source"

    def _build_conflict_description(
        self,
        claims: list[Claim],
    ) -> str:
        subject = claims[0].subject.strip() or "Entity"
        pred = self._canonical_predicate(claims[0].predicate, claims[0].claim_key).replace("_", " ")

        parts: list[str] = []
        for c in claims:
            label = self._claim_source_label(c)
            parts.append(f"{label} reports '{c.value}'")

        joined = ", while ".join(parts)
        return f"{subject} {pred} differs: {joined}."

    def _build_conflict_reason(
        self,
        claims: list[Claim],
    ) -> str:
        parts: list[str] = []
        for c in claims:
            label = self._claim_source_label(c)
            unit_str = f" {c.unit}" if c.unit else ""
            parts.append(f"{label} states '{c.value}{unit_str}'")

        reason = "Contradictory assertions detected between sources: " + "; ".join(parts) + "."
        return reason

    def _clean(
        self,
        value: str,
    ) -> str:
        return value.strip()
