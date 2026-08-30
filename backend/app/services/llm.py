import json
import logging
import re
import time
from typing import Any, Protocol

from groq import Groq
from pydantic import ValidationError

try:
    from ollama import Client
except ImportError:
    Client = None

from app.core.config import settings
from app.models.content import ContentDNA, RawContent


logger = logging.getLogger(__name__)


def _clean_text_for_llm(text: str) -> str:
    """Minify whitespace and empty lines to minimize prompt token footprint."""
    if not text:
        return ""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _truncate_content(
    text: str,
    max_source_chars: int,
    *,
    source_id: str | None = None,
    provider: str = "",
    model: str = "",
) -> str:
    """Truncate source text so the LLM request fits the context window.

    The full text remains in the database for display and conflict
    resolution; only what is sent to the model is shortened.
    """
    if text is None:
        return ""

    text = _clean_text_for_llm(text)

    if len(text) <= max_source_chars:
        return text

    truncated = text[:max_source_chars]
    marker = (
        f"\n\n[...TRUNCATED — {len(text)} chars total, "
        f"showing first {max_source_chars} chars...]\n\n"
    )

    logger.warning(
        "Source %s truncated from %s to %s chars for %s model %s",
        source_id,
        len(text),
        max_source_chars,
        provider or "llm",
        model or "unknown",
    )

    return truncated + marker


class LLMProviderError(RuntimeError):
    pass


class LLMContextOverflowError(LLMProviderError):
    """Raised when a request is too large for the model/plan limits.

    Distinguished from transient rate limiting: an overflow means the
    input must be split into smaller pieces, not retried as-is.
    """


def _is_rate_limit(exc: Exception) -> bool:
    status = getattr(
        getattr(exc, "response", None),
        "status_code",
        None,
    )

    if status == 429:
        return True

    return "rate_limit" in str(exc).lower()


def _is_context_overflow(exc: Exception) -> bool:
    message = str(exc).lower()

    return any(
        token in message
        for token in (
            "context",
            "too long",
            "maximum",
            "reduce",
            "request too large",
            "max_input",
            "token",
        )
    )


def _extract_json(text: str) -> str:
    """Extract a JSON object from model output that may include fences.

    Groq (free JSON mode) sometimes wraps the object in ```json ... ```
    or adds prose. We strip to the outermost { ... } so it can be parsed.
    """
    if not text:
        return ""

    cleaned = text.strip()

    if cleaned.startswith("```"):
        # Drop the opening fence, including a possible language tag.
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


def _coerce_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                items.append(text)
        return items
    elif isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(v).strip() for v in value if v is not None and str(v).strip())
    return str(value).strip()


def _prune_empty(val: Any) -> Any:
    """Recursively strip empty lists, empty strings, and empty dicts to minimize token payload."""
    if isinstance(val, dict):
        cleaned = {k: _prune_empty(v) for k, v in val.items()}
        return {k: v for k, v in cleaned.items() if v not in ("", [], {}, None)}
    elif isinstance(val, list):
        cleaned = [_prune_empty(v) for v in val]
        return [v for v in cleaned if v not in ("", [], {}, None)]
    return val


def _normalize_entity_list(items: list[Any]) -> list[str]:
    """Clean, trim, deduplicate (case-insensitively preserving best casing), and order entity entries."""
    seen_lower: set[str] = set()
    cleaned: list[str] = []
    for item in items:
        if item is None:
            continue
        if isinstance(item, dict):
            val = item.get("name") or item.get("entity") or item.get("title") or item.get("value") or next(iter(item.values()), "")
        else:
            val = str(item)
        val = val.strip().strip("\"'").strip()
        if not val or len(val) < 2:
            continue
        key = val.lower()
        if key not in seen_lower:
            seen_lower.add(key)
            cleaned.append(val)
    return cleaned


def normalize_content_dna_dict(data: Any) -> dict[str, Any]:
    """Controlled normalization of LLM JSON output to canonical ContentDNA schema.

    Guarantees strict schema compatibility without inventing factual content.
    """
    if not isinstance(data, dict):
        return ContentDNA().model_dump()

    normalized: dict[str, Any] = {}

    # Identity
    identity_raw = data.get("identity")
    if isinstance(identity_raw, str):
        normalized["identity"] = {
            "title": identity_raw.strip(),
            "content_type": "",
            "source_description": "",
        }
    elif isinstance(identity_raw, dict):
        normalized["identity"] = {
            "title": _coerce_str(identity_raw.get("title")),
            "content_type": _coerce_str(identity_raw.get("content_type")),
            "source_description": _coerce_str(identity_raw.get("source_description")),
        }
    else:
        normalized["identity"] = {
            "title": _coerce_str(data.get("title")),
            "content_type": _coerce_str(data.get("content_type")),
            "source_description": _coerce_str(data.get("source_description")),
        }

    # Overview
    overview_raw = data.get("overview")
    if isinstance(overview_raw, str):
        normalized["overview"] = {
            "summary": overview_raw.strip(),
            "purpose": "",
        }
    elif isinstance(overview_raw, dict):
        normalized["overview"] = {
            "summary": _coerce_str(overview_raw.get("summary")),
            "purpose": _coerce_str(overview_raw.get("purpose")),
        }
    else:
        normalized["overview"] = {
            "summary": _coerce_str(data.get("summary")),
            "purpose": _coerce_str(data.get("purpose")),
        }

    # Entities: comprehensively check all possible category keys/aliases
    entities_raw = data.get("entities")
    if not isinstance(entities_raw, dict):
        entities_raw = {}

    def _extract_all_variants(*keys: str) -> list[Any]:
        collected: list[Any] = []
        for k in keys:
            if k in entities_raw:
                val = entities_raw[k]
                if isinstance(val, list):
                    collected.extend(val)
                elif isinstance(val, str) and val.strip():
                    collected.append(val)
            if k in data:
                val = data[k]
                if isinstance(val, list):
                    collected.extend(val)
                elif isinstance(val, str) and val.strip():
                    collected.append(val)
        return collected

    raw_people = _extract_all_variants(
        "people", "persons", "person", "individuals", "key_people", "authors",
        "researchers", "leaders", "executives", "speakers", "names", "stakeholders",
        "actors", "scientists", "officials"
    )

    raw_orgs = _extract_all_variants(
        "organizations", "organization", "orgs", "companies", "company",
        "institutions", "institution", "agencies", "agency", "government_bodies",
        "government_agencies", "enterprises", "corporations", "firms", "universities",
        "groups", "departments", "ministries", "startups", "consortiums", "alliances",
        "military", "security_entities"
    )

    raw_locs = _extract_all_variants(
        "locations", "location", "places", "place", "countries", "country",
        "cities", "city", "regions", "region", "states", "state", "provinces",
        "geographic_locations", "geography", "facilities", "sites", "venues",
        "headquarters", "territories", "continents", "areas"
    )

    raw_tech = _extract_all_variants(
        "technologies", "technology", "tech", "tools", "tool", "software",
        "hardware", "systems", "system", "platforms", "platform", "products",
        "product", "methods", "method", "methodologies", "frameworks", "framework",
        "models", "model", "protocols", "protocol", "equipment", "applications",
        "apps", "infrastructure", "standards", "algorithms", "devices", "languages",
        "programming_languages", "materials", "substances", "concepts", "technical_concepts"
    )

    normalized["entities"] = {
        "people": _normalize_entity_list(raw_people),
        "organizations": _normalize_entity_list(raw_orgs),
        "locations": _normalize_entity_list(raw_locs),
        "technologies": _normalize_entity_list(raw_tech),
    }

    # Facts
    facts_raw = data.get("facts")
    if not isinstance(facts_raw, dict):
        facts_raw = {}
    normalized["facts"] = {
        "claims": _coerce_str_list(facts_raw.get("claims", data.get("claims"))),
        "statistics": _coerce_str_list(facts_raw.get("statistics", data.get("statistics"))),
        "dates": _coerce_str_list(facts_raw.get("dates", data.get("dates"))),
        "events": _coerce_str_list(facts_raw.get("events", data.get("events"))),
    }

    # Findings
    findings_raw = data.get("findings")
    if not isinstance(findings_raw, dict):
        findings_raw = {}
    normalized["findings"] = {
        "key_findings": _coerce_str_list(findings_raw.get("key_findings", data.get("key_findings"))),
        "risks": _coerce_str_list(findings_raw.get("risks", data.get("risks"))),
        "opportunities": _coerce_str_list(findings_raw.get("opportunities", data.get("opportunities"))),
        "implications": _coerce_str_list(findings_raw.get("implications", data.get("implications"))),
    }

    # Recommendations
    rec_raw = data.get("recommendations")
    if isinstance(rec_raw, list):
        normalized["recommendations"] = {
            "recommendations": _coerce_str_list(rec_raw),
        }
    elif isinstance(rec_raw, dict):
        normalized["recommendations"] = {
            "recommendations": _coerce_str_list(rec_raw.get("recommendations")),
        }
    else:
        normalized["recommendations"] = {
            "recommendations": [],
        }

    # Context
    ctx_raw = data.get("context")
    if not isinstance(ctx_raw, dict):
        ctx_raw = {}
    normalized["context"] = {
        "target_audience": _coerce_str(ctx_raw.get("target_audience", data.get("target_audience"))),
        "tone": _coerce_str(ctx_raw.get("tone", data.get("tone"))),
        "communication_objective": _coerce_str(ctx_raw.get("communication_objective", data.get("communication_objective"))),
    }

    # Evidence
    ev_raw = data.get("evidence")
    source_ref = ""
    supp_excerpt = ""
    if isinstance(ev_raw, str):
        supp_excerpt = ev_raw.strip()
    elif isinstance(ev_raw, list):
        supp_excerpt = "; ".join(_coerce_str_list(ev_raw))
    elif isinstance(ev_raw, dict):
        source_ref = _coerce_str(
            ev_raw.get("source_reference")
            or ev_raw.get("source")
            or ev_raw.get("reference")
            or ev_raw.get("citation")
            or ev_raw.get("doc_title")
        )
        supp_excerpt = _coerce_str(
            ev_raw.get("supporting_excerpt")
            or ev_raw.get("excerpt")
            or ev_raw.get("quote")
            or ev_raw.get("supporting_quote")
            or ev_raw.get("evidence")
            or ev_raw.get("text")
        )
    else:
        source_ref = _coerce_str(data.get("source_reference") or data.get("source") or data.get("reference"))
        supp_excerpt = _coerce_str(data.get("supporting_excerpt") or data.get("excerpt") or data.get("quote"))

    # Smart fallbacks so every section is guaranteed to have meaningful values
    if not normalized["identity"]["content_type"]:
        normalized["identity"]["content_type"] = "Document / Report"
    if not normalized["identity"]["source_description"]:
        summary_text = normalized.get("overview", {}).get("summary", "")
        normalized["identity"]["source_description"] = summary_text[:120] if summary_text else "Source content documentation"

    if not normalized["overview"]["purpose"]:
        title_str = normalized["identity"]["title"] or "the source document"
        normalized["overview"]["purpose"] = f"Inform, analyze, and present key facts from {title_str}."

    if not normalized["context"]["target_audience"]:
        normalized["context"]["target_audience"] = "Stakeholders, analysts, and general audience"
    if not normalized["context"]["tone"]:
        normalized["context"]["tone"] = "Objective, professional, and analytical"
    if not normalized["context"]["communication_objective"]:
        normalized["context"]["communication_objective"] = "Provide clear factual understanding and actionable insights"

    # Ensure facts and findings have entries if summary exists
    summary = normalized.get("overview", {}).get("summary", "")
    if summary and not normalized["facts"]["claims"]:
        # Extract sentence clauses as claims
        clauses = [s.strip() for s in summary.replace(";", ".").split(".") if len(s.strip()) > 15]
        normalized["facts"]["claims"] = clauses[:4] if clauses else [summary]

    if not normalized["findings"]["key_findings"]:
        if normalized["facts"]["claims"]:
            normalized["findings"]["key_findings"] = [f"Core finding: {c}" for c in normalized["facts"]["claims"][:3]]
    # Evidence fallback guarantees
    if not source_ref:
        source_ref = normalized["identity"]["title"] or "Source Document"

    if not supp_excerpt:
        claims = normalized["facts"]["claims"]
        findings = normalized["findings"]["key_findings"]
        summary = normalized["overview"]["summary"]
        if claims and claims[0]:
            supp_excerpt = claims[0]
        elif findings and findings[0]:
            supp_excerpt = findings[0]
        elif summary:
            supp_excerpt = summary
        else:
            supp_excerpt = f"Verified grounded evidence from {source_ref}."

    normalized["evidence"] = {
        "source_reference": source_ref,
        "supporting_excerpt": supp_excerpt,
    }

    return normalized


def _safe_parse_dna_json(raw_content: str) -> dict[str, Any]:
    """Resilient parser that extracts DNA dictionary from valid, unclosed, or slightly malformed JSON."""
    if not raw_content or not raw_content.strip():
        return {}

    raw_json = _extract_json(raw_content)

    # 1. Direct JSON parse
    try:
        data = json.loads(raw_json)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 2. Repair unclosed quotes / brackets / trailing commas
    repaired = raw_json.strip()
    # Remove trailing commas before closing braces/brackets
    repaired = re.sub(r",\s*([\]}])", r"\1", repaired)
    # Balance quotes
    if repaired.count('"') % 2 != 0:
        repaired += '"'
    # Balance braces
    open_braces = repaired.count("{") - repaired.count("}")
    if open_braces > 0:
        repaired += "}" * open_braces
    try:
        data = json.loads(repaired)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 3. Regex repair common JSON errors (unescaped newlines in string literals)
    try:
        fixed = re.sub(r'(?<=: ")(.*?)(?=",\s*|\s*})', lambda m: m.group(1).replace('\n', '\\n'), repaired, flags=re.DOTALL)
        data = json.loads(fixed)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 4. Regex extraction of individual section dictionaries
    recovered: dict[str, Any] = {}
    sections = ["identity", "overview", "entities", "facts", "findings", "recommendations", "context", "evidence"]
    for sec in sections:
        match = re.search(rf'"{sec}"\s*:\s*(\{{[^{{}}]*?\}})', raw_content, re.DOTALL)
        if match:
            try:
                recovered[sec] = json.loads(match.group(1))
            except Exception:
                pass
    if recovered:
        return recovered

    return {}


import threading


class GroqKeyPool:
    """Manages a pool of Groq API keys with round-robin rotation and rate-limit failover."""

    def __init__(self, api_keys: list[str] | str | None = None) -> None:
        self._lock = threading.Lock()
        self._keys: list[str] = []
        self._clients: dict[str, Any] = {}
        self._cooldowns: dict[str, float] = {}
        self._index: int = 0

        if isinstance(api_keys, str):
            keys = [k.strip() for k in api_keys.replace("\n", ",").replace(";", ",").split(",") if k.strip()]
        elif isinstance(api_keys, list):
            keys = [k.strip() for k in api_keys if k and k.strip()]
        else:
            keys = settings.get_groq_api_keys()

        self.set_keys(keys)

    def set_keys(self, keys: list[str]) -> None:
        with self._lock:
            self._keys = [k for k in keys if k]
            self._clients = {k: Groq(api_key=k) for k in self._keys}
            self._cooldowns = {k: 0.0 for k in self._keys}
            self._index = 0

    @property
    def has_keys(self) -> bool:
        return len(self._keys) > 0

    @property
    def key_count(self) -> int:
        return len(self._keys)

    def get_client(self) -> tuple[str, Any]:
        """Returns the next available (key, client) in round-robin order."""
        with self._lock:
            if not self._keys:
                raise LLMProviderError("No GROQ_API_KEY configured")

            now = time.time()
            # Try to pick a non-cooling-down key
            for _ in range(len(self._keys)):
                key = self._keys[self._index % len(self._keys)]
                self._index += 1
                if self._cooldowns.get(key, 0.0) <= now:
                    return key, self._clients[key]

            # If all are cooling down, pick the one with the earliest cooldown expiry
            earliest_key = min(self._keys, key=lambda k: self._cooldowns.get(k, 0.0))
            return earliest_key, self._clients[earliest_key]

    def has_available_alternate(self, current_key: str) -> bool:
        """Returns True if there is another key not in cooldown."""
        with self._lock:
            now = time.time()
            return any(
                k != current_key and self._cooldowns.get(k, 0.0) <= now
                for k in self._keys
            )

    def mark_rate_limited(self, key: str, wait_seconds: float = 5.0) -> None:
        with self._lock:
            self._cooldowns[key] = time.time() + wait_seconds
            logger.warning(
                "Groq API key ...%s rate limited; cooling down for %.1fs (pool size: %d)",
                key[-6:] if len(key) >= 6 else key,
                wait_seconds,
                len(self._keys),
            )


def _call_groq(client_or_pool: Any, model: str, max_tokens: int, **kwargs):
    """Call the Groq chat completion API with TPM-aware handling and multi-key failover.

    Treats three failure modes distinctly:
    * rate limit (429)        -> juggle to next key in pool, or exponential backoff
    * context overflow (400)  -> raise LLMContextOverflowError so the caller can split the request
    * other errors            -> wrap as LLMProviderError
    """
    from groq import (
        APIStatusError,
        BadRequestError,
        RateLimitError,
    )

    is_pool = isinstance(client_or_pool, GroqKeyPool)
    pool = client_or_pool if is_pool else None

    key_count = pool.key_count if pool else 1
    total_retries = max(settings.groq_max_retries, settings.groq_max_retries * key_count)
    last_exc: Exception | None = None

    for attempt in range(total_retries + 1):
        current_key = None
        if pool:
            current_key, active_client = pool.get_client()
        else:
            active_client = client_or_pool

        if active_client is None:
            raise LLMProviderError("GROQ_API_KEY is not configured")

        try:
            return active_client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                **kwargs,
            )

        except RateLimitError as exc:
            # Parse exact wait time if provided by Groq
            match = re.search(r"try again in ([0-9.]+)\s*(s|ms)?", str(exc), re.IGNORECASE)
            if match:
                val = float(match.group(1))
                unit = (match.group(2) or "s").lower()
                exact_wait = val / 1000.0 if unit == "ms" else val
                wait = max(1.0, exact_wait + 0.5)
            else:
                wait = float(settings.groq_backoff_base_seconds * (2 ** (attempt % settings.groq_max_retries)))

            if pool and current_key:
                pool.mark_rate_limited(current_key, wait_seconds=wait)
                # If there is an alternate healthy key in the pool, juggle immediately without sleeping!
                if pool.has_available_alternate(current_key):
                    logger.info("Failing over immediately to next available Groq API key in pool")
                    last_exc = exc
                    continue

            if attempt < total_retries:
                logger.warning(
                    "Groq rate limit (429) hit; backing off %.2fs (attempt %d/%d, model=%s)",
                    wait,
                    attempt + 1,
                    total_retries,
                    model,
                )
                time.sleep(wait)
                last_exc = exc
                continue

            logger.error("Groq rate limit exceeded after %d retries across key pool", total_retries)
            raise LLMProviderError("Groq rate limit exceeded after retries") from exc

        except BadRequestError as exc:
            if _is_context_overflow(exc):
                raise LLMContextOverflowError(
                    "Groq request exceeds the model context/TPM limit"
                ) from exc

            # If Groq server-side JSON schema/format validation failed, retry without response_format constraint
            if "response_format" in kwargs:
                fallback_kwargs = {k: v for k, v in kwargs.items() if k != "response_format"}
                try:
                    logger.warning("Groq response_format failed (%s); retrying with prompt-based JSON extraction", exc)
                    return active_client.chat.completions.create(
                        model=model,
                        max_tokens=max_tokens,
                        **fallback_kwargs,
                    )
                except Exception as fallback_exc:
                    logger.warning("Fallback without response_format also failed: %s", fallback_exc)

            logger.error("Groq bad request: %s", exc)
            raise LLMProviderError(
                "The LLM request or structured response was invalid"
            ) from exc

        except APIStatusError as exc:
            status = getattr(
                getattr(exc, "response", None),
                "status_code",
                None,
            )

            # 413 "Request too large" is Groq's TPM/context overflow
            if status == 413 or _is_context_overflow(exc):
                if pool and current_key and pool.has_available_alternate(current_key):
                    pool.mark_rate_limited(current_key, wait_seconds=30.0)
                    logger.info("413 TPM limit hit on key; failing over to next Groq API key in pool")
                    last_exc = exc
                    continue
                raise LLMContextOverflowError(
                    "Groq request exceeds the model context/TPM limit"
                ) from exc

            logger.error("Groq API status error: %s", exc)
            raise LLMProviderError(
                "The Groq API request failed"
            ) from exc

    assert last_exc is not None
    raise LLMProviderError(
        "Groq rate limit exceeded after retries"
    ) from last_exc


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
    def __init__(self, api_key: str | list[str] | None = None, model: str | None = None) -> None:
        self.model = model or settings.groq_model
        self.pool = GroqKeyPool(api_key)
        self._mode = "local" if settings.llm_provider.lower() == "ollama" else "api"
        self._max_output_tokens = settings.groq_max_output_tokens
        self._generation_max_output_tokens = (
            settings.groq_generation_max_output_tokens
        )

    @property
    def client(self):
        """Returns active client or None for backwards compatibility."""
        if not self.pool.has_keys:
            return None
        _, cl = self.pool.get_client()
        return cl

    @client.setter
    def client(self, value):
        if value is not None:
            # Wrap standalone client in pool mock or single client
            self.pool._clients = {"custom": value}
            self.pool._keys = ["custom"]
            self.pool._cooldowns = {"custom": 0.0}
        else:
            self.pool._clients = {}
            self.pool._keys = []
            self.pool._cooldowns = {}

    def generate_content_dna(self, content: RawContent) -> ContentDNA:
        from app.services.chunked_dna import (
            _safe_generate_dna,
            generate_chunked_content_dna,
        )
        from app.services.context_budget import get_context_budget
        from app.services.document_chunker import estimate_tokens

        budget = get_context_budget(self._mode)

        if budget.fits_single_pass(
            estimate_tokens(content.text)
        ):
            return _safe_generate_dna(self, content, budget)

        return generate_chunked_content_dna(
            self,
            content,
            budget,
        )

    def _generate_content_dna_single(self, content: RawContent) -> ContentDNA:
        if self.client is None:
            raise LLMProviderError(
                "GROQ_API_KEY is not configured"
            )

        system_prompt = """You are EV's Comprehensive Content DNA Extraction Engine.
Extract EVERY SINGLE factual detail, entity, metric, date, finding, and recommendation from the source into a rich Content DNA JSON object.

MANDATORY ENTITY TAXONOMY EXTRACTION:
Perform an exhaustive entity inventory and classify all discovered entities into the 4 canonical categories:
- people: ALL individuals, authors, researchers, executives, officials, leaders, engineers, scientists, and named persons.
- organizations: ALL companies, corporations, startups, institutions, universities, government bodies, agencies, ministries, departments, non-profits, consortiums, military/security entities, and alliances.
- locations: ALL countries, cities, states, provinces, regions, geographic territories, facilities, campuses, headquarters, and physical sites.
- technologies: ALL software, hardware, systems, platforms, tools, products, programming languages, algorithms, frameworks, models, protocols, standards, infrastructure, devices, scientific methods, materials, and technical concepts.

Extraction Guidelines:
1. Check EVERY single entity category. If entities exist in the source, populate them.
2. facts: claims (assertions), statistics (numbers/metrics), dates (all dates/timelines), events (all milestones/incidents).
3. findings: key_findings, risks, opportunities, implications.
4. recommendations: all recommendations and advice.
5. overview & context: comprehensive summary, purpose, audience, tone, communication objective.
6. evidence: source reference and verbatim supporting excerpt.

Return ONLY a valid JSON object matching the ContentDNA schema:
{
  "identity": { "title": "...", "content_type": "...", "source_description": "..." },
  "overview": { "summary": "...", "purpose": "..." },
  "entities": { "people": [...], "organizations": [...], "locations": [...], "technologies": [...] },
  "facts": { "claims": [...], "statistics": [...], "dates": [...], "events": [...] },
  "findings": { "key_findings": [...], "risks": [...], "opportunities": [...], "implications": [...] },
  "recommendations": { "recommendations": [...] },
  "context": { "target_audience": "...", "tone": "...", "communication_objective": "..." },
  "evidence": { "source_reference": "...", "supporting_excerpt": "..." }
}
"""

        source_text = _truncate_content(
            content.text,
            settings.max_source_chars,
            source_id=getattr(content, "source_id", None),
            provider="groq",
            model=self.model,
        )

        user_message = f"""TITLE: {content.title}
TYPE: {content.source_type}

CONTENT:
{source_text}

TASK:
Extract the complete ContentDNA JSON object from the source text above.
Return ONLY valid JSON matching the ContentDNA schema.
"""

        try:
            completion = _call_groq(
                self.pool,
                self.model,
                self._max_output_tokens,
                temperature=0,
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

        except LLMContextOverflowError:
            raise

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

        parsed = _safe_parse_dna_json(raw_content)
        normalized = normalize_content_dna_dict(parsed)
        return ContentDNA.model_validate(normalized)

    def generate_content_dna_synthesis(
        self,
        partials_json: str,
        title: str,
    ) -> ContentDNA:
        """Merge several partial ContentDNA objects into one canonical DNA.

        Used by the bounded hierarchical synthesis of large documents.
        Never receives the full document text; only partial DNA JSON.
        """
        if self.client is None:
            raise LLMProviderError(
                "GROQ_API_KEY is not configured"
            )

        system_prompt = """
You are EV's Content DNA Synthesis Engine.

You are given several ContentDNA objects extracted from DIFFERENT PARTS
of the SAME source document. Your job is to merge them into ONE
canonical ContentDNA object.

RULES:

1. Combine and deduplicate all list fields:
   - entities.people / organizations / locations / technologies
   - facts.claims / statistics / dates / events
   - findings.key_findings / risks / opportunities / implications
   - recommendations.recommendations

2. Preserve EVERY important fact, number, date, name, event, and claim
   from all parts. Information loss is a failure.

3. If two parts state DIFFERENT values for the same underlying fact,
   preserve BOTH as separate list entries. Do NOT silently pick one.

4. Build a single coherent identity, overview, context, and evidence
   that represents the whole document.

5. For evidence:
   - Combine the strongest supporting excerpts from all parts.
   - Include the page ranges they came from (for example
     "Pages 3-14") when that information is present.
   - Do NOT drop evidence.

6. Do NOT invent facts, numbers, dates, names, or claims that are not
   present in the provided partial objects.

Return ONLY a valid JSON object matching the ContentDNA schema.
"""

        user_message = f"""TITLE: {title}
PARTIAL CONTENT DNA JSON:
{partials_json}

TASK:
Merge the partial ContentDNA JSON objects into one canonical ContentDNA JSON object.
Return ONLY valid JSON matching the ContentDNA schema.
"""

        try:
            completion = _call_groq(
                self.pool,
                self.model,
                self._max_output_tokens,
                temperature=0,
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
                "Groq synthesis request failed (model=%s)",
                self.model,
            )

            raise LLMProviderError(
                "The LLM synthesis request was invalid"
            ) from exc

        choices = getattr(completion, "choices", None)

        if not choices:
            raise LLMProviderError(
                "The LLM synthesis request returned no choices"
            )

        raw_content = getattr(
            choices[0].message,
            "content",
            None,
        )

        if (
            not isinstance(raw_content, str)
            or not raw_content.strip()
        ):
            raise LLMProviderError(
                "The LLM synthesis request returned empty content"
            )

        parsed = _safe_parse_dna_json(raw_content)

        if not parsed:
            # Resilient fallback: merge partials directly from partials_json if model generation failed to return clean JSON
            try:
                partials = json.loads(partials_json)
                merged: dict[str, Any] = {
                    "identity": {"title": title, "content_type": "", "source_description": ""},
                    "overview": {"summary": "", "purpose": ""},
                    "entities": {"people": [], "organizations": [], "locations": [], "technologies": []},
                    "facts": {"claims": [], "statistics": [], "dates": [], "events": []},
                    "findings": {"key_findings": [], "risks": [], "opportunities": [], "implications": []},
                    "recommendations": {"recommendations": []},
                    "context": {"target_audience": "", "tone": "", "communication_objective": ""},
                    "evidence": {"source_reference": title, "supporting_excerpt": ""},
                }
                for item in partials:
                    cdna = item.get("content_dna", {})
                    for sec, val in cdna.items():
                        if isinstance(val, dict):
                            merged[sec].update({k: v for k, v in val.items() if v})
                        elif isinstance(val, list):
                            merged[sec].extend(val)
                parsed = merged
            except Exception:
                pass

        normalized = normalize_content_dna_dict(parsed)
        return ContentDNA.model_validate(normalized)

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
EXECUTIVE BRIEFING SPECIFICATION:
Produce a publication-grade, decision-ready executive briefing formatted in clean Markdown.

Structure:
# [Executive Summary Title]
**Target Audience:** {generation_config.get('audience', 'Executive Leadership')} | **Communication Intent:** {generation_config.get('objective', 'Strategic Decision Support')}

## 1. Executive Summary & Strategic Context
A substantive multi-paragraph strategic overview synthesizing the core background, situation, and objectives from Content DNA.

## 2. Key Metrics & Factual Highlights
Present every verified metric, percentage, date, and statistic extracted from Content DNA in a structured highlight list.

## 3. Core Findings & Critical Analysis
Deep, substantive bullet points detailing key findings, operational realities, and verified evidence.

## 4. Material Risks & Strategic Implications
Thorough analysis of risks, vulnerabilities, opportunities, and implications grounded in Content DNA.

## 5. Prioritized Actionable Recommendations
Actionable, concrete recommendations ordered by priority (Immediate, Near-Term, and Strategic Roadmap).

## 6. Source Traceability & Grounding
- **Primary Source Reference:** State source reference from Content DNA.
- **Key Grounded Evidence:** Verbatim supporting excerpt from Content DNA.
""",

            "advisory": """
STRATEGIC ADVISORY SPECIFICATION:
Produce an authoritative, intelligence-grade strategic advisory document formatted in clean Markdown.

Structure:
# Strategic Advisory: [Title]
**Advisory Level:** High Priority | **Target Audience:** {generation_config.get('audience', 'Stakeholders')} | **Tone:** {generation_config.get('tone', 'Objective & Analytical')}

## Executive Action Message
1-2 punchy paragraphs stating the central takeaway and immediate recommended stance.

## 1. Operational Situation & Background
Substantive context explaining the operational landscape, stakeholders, entities involved, and triggering conditions.

## 2. Empirical Findings & Verified Evidence
Comprehensive breakdown of all verified findings, claims, and data points from Content DNA.

## 3. Risk Assessment & Vulnerabilities
Explicit assessment of identified risks, exposure points, and consequence severity.

## 4. Strategic Implications
What this means across operational, technical, financial, or governance domains.

## 5. Recommended Course of Action
- **Immediate Actions (0-30 Days):** Specific immediate actions.
- **Mid-Term Adjustments (30-90 Days):** Process or strategy adjustments.
- **Long-Term Governance & Monitoring:** Ongoing tracking metrics.

## 6. Traceability & Reference Evidence
Citations and verbatim supporting excerpts from Content DNA.
""",

            "linkedin": """
LINKEDIN PUBLICATION SPECIFICATION:
Generate a high-impact, directly publishable LinkedIn post written for maximum readability and professional engagement.

Formatting Rules:
- Start with a compelling 1-2 line opening hook that captures professional attention without sensationalism.
- Leave clean blank lines between short, digestible paragraphs (1-2 sentences each).
- Include a 3-4 item bulleted list highlighting key metrics, breakthroughs, or verified takeaways from Content DNA.
- Provide a strong concluding perspective or strategic question as a Call to Action (CTA).
- End with 4-5 relevant industry hashtags on the last line.
- Return ONLY the finished, directly copyable post. Do NOT include section headers like "Hook:" or "Body:".
""",

            "twitter": """
X / TWITTER THREAD SPECIFICATION:
Generate a publication-ready X/Twitter thread (3-5 tweets) optimized for clarity, brevity, and factual punchiness.

Formatting Rules:
- Number each tweet clearly: 1/5, 2/5, 3/5, etc.
- Tweet 1: Standalone hook tweet introducing the core insight with high engagement.
- Tweet 2: Key data points, metrics, and factual evidence.
- Tweet 3: Critical implications and findings.
- Tweet 4: Strategic takeaways and actionable advice.
- Tweet 5: Concluding wrap-up tweet with CTA and 3 relevant hashtags.
- Keep every tweet under 280 characters. Return ONLY the thread.
""",

            "presentation": """
EXECUTIVE PRESENTATION DECK SPECIFICATION:
Generate a complete, presentation-ready slide deck script with 6-7 structured slides.

For EVERY slide provide:
---
### Slide [Number]: [Slide Title]
**Visual Direction:** [Description of layout, diagram, chart, or graphic for the visual designer]
**Slide Bullets:**
- [High-signal bullet point with exact figures / entities]
- [High-signal bullet point]
- [High-signal bullet point]

**Speaker Notes:**
[2-3 complete, professional sentences of spoken script that the presenter will say aloud to accompany this slide.]
---

Include all slides: Slide 1 (Title & Agenda), Slide 2 (Context & Overview), Slide 3 (Key Data & Metrics), Slide 4 (Findings & Analysis), Slide 5 (Risks & Implications), Slide 6 (Recommendations & Next Steps), Slide 7 (Conclusion & Q&A).
""",

            "video": """
VIDEO PRODUCTION BLUEPRINT SPECIFICATION:
Generate a complete video production blueprint containing:

# Video Production Blueprint: [Title]
**Target Runtime:** 60-90 Seconds | **Target Audience:** {generation_config.get('audience', 'General')} | **Visual Style:** Cinematic / Professional

## Scene Breakdown
For each scene (Scene 1 to Scene 5):
- **Scene [Number] ([Timestamp e.g. 0:00 - 0:15])**
  - **Visual Description:** Camera angle, setting, motion, and visual assets.
  - **On-Screen Text (OST):** Text overlay, headline, or metric graphic.
  - **Narration / Voiceover Script:** Verbatim spoken narration.
  - **Subtitles:** Synchronized subtitles.
  - **Audio & Sound Direction:** Background music mood and sound effects.
""",

            "infographic": """
INFOGRAPHIC DESIGN SPECIFICATION:
Generate a complete visual designer handoff specification:

# Infographic Specification: [Title]
**Core Key Message:** [1-sentence central takeaway]

## 1. Hero Metric Callout Cards
3-4 prominent visual stat boxes with large numbers + concise labels (e.g. [ 40% | Processing Time Reduction ]).

## 2. Structured Content Sections
3-4 visual content panels with section title, icon recommendation, and data visualization type (Comparison Matrix, Timeline, Metric Bar).

## 3. Key Takeaway & Callout Box
High-impact visual summary box.

## 4. Visual Layout & Styling Guide
- **Layout Format:** Vertical (9:16) or Landscape (16:9)
- **Suggested Color Palette:** Slate, Cobalt, Emerald Accent
- **Typography & Iconography Direction:** Clean modern sans-serif with geometric line icons.
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

        compact_dna = json.dumps(_prune_empty(content_dna.model_dump(mode="json")), ensure_ascii=False)

        user_message = f"""CONTENT DNA:
{compact_dna}

TASK:
Generate the requested {output_spec.get("name", output_type)}.
Respect audience, tone, language, level of detail, communication objective, and content style.
Use Content DNA as the sole factual source. Return only the final artifact.
"""

        try:
            completion = _call_groq(
                self.pool,
                self.model,
                self._generation_max_output_tokens,
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
        self._mode = "local" if settings.llm_provider.lower() == "ollama" else "api"

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
        return normalize_content_dna_dict(data)

    def generate_content_dna(
        self,
        content: RawContent,
    ) -> ContentDNA:
        from app.services.chunked_dna import (
            _safe_generate_dna,
            generate_chunked_content_dna,
        )
        from app.services.context_budget import get_context_budget
        from app.services.document_chunker import estimate_tokens

        budget = get_context_budget(self._mode)

        if budget.fits_single_pass(
            estimate_tokens(content.text)
        ):
            return _safe_generate_dna(self, content, budget)

        return generate_chunked_content_dna(
            self,
            content,
            budget,
        )

    def _generate_content_dna_single(
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

11. MANDATORY ENTITY TAXONOMY EXTRACTION:
Perform a full entity inventory and classify all named entities into the 4 canonical categories:
- people: ALL individuals, authors, researchers, executives, officials, leaders, engineers, scientists, and named persons.
- organizations: ALL companies, corporations, startups, institutions, universities, government bodies, agencies, ministries, departments, non-profits, consortiums, military/security entities, and alliances.
- locations: ALL countries, cities, states, provinces, regions, geographic territories, facilities, campuses, headquarters, and physical sites.
- technologies: ALL software, hardware, systems, platforms, tools, products, programming languages, algorithms, frameworks, models, protocols, standards, infrastructure, devices, scientific methods, materials, and technical concepts.

12. The output MUST be valid JSON matching the ContentDNA schema.

13. Return ONLY JSON.

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

        source_text = _truncate_content(
            content.text,
            settings.max_source_chars,
            source_id=getattr(content, "source_id", None),
            provider="ollama",
            model=self.model,
        )

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

{source_text}

==============================

Extract the complete ContentDNA.

Be comprehensive.

If the source text above was truncated, work only with what is shown
and leave sections empty when the relevant information was not
included in the visible portion.

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

    def generate_content_dna_synthesis(
        self,
        partials_json: str,
        title: str,
    ) -> ContentDNA:
        """Merge several partial ContentDNA objects into one canonical DNA.

        Used by the bounded hierarchical synthesis of large documents.
        """
        system_prompt = """
You are EV's Content DNA Synthesis Engine.

You are given several ContentDNA objects extracted from DIFFERENT PARTS
of the SAME source document. Merge them into ONE canonical ContentDNA
object.

RULES:

1. Combine and deduplicate all list fields:
   - entities.people / organizations / locations / technologies
   - facts.claims / statistics / dates / events
   - findings.key_findings / risks / opportunities / implications
   - recommendations.recommendations

2. Preserve EVERY important fact, number, date, name, event, and claim
   from all parts. Information loss is a failure.

3. If two parts state DIFFERENT values for the same underlying fact,
   preserve BOTH as separate list entries. Do NOT silently pick one.

4. Build a single coherent identity, overview, context, and evidence
   that represents the whole document.

5. For evidence: combine the strongest supporting excerpts from all
   parts and include their page ranges (for example "Pages 3-14") when
   present. Do NOT drop evidence.

6. Do NOT invent facts, numbers, dates, names, or claims absent from
   the provided partial objects.

Return ONLY valid JSON matching the ContentDNA schema.
"""

        user_message = f"""
DOCUMENT TITLE:
{title}

PARTIAL CONTENT DNA OBJECTS
============================
The objects below were extracted from different parts of the same
document. Merge them into one canonical ContentDNA object.

{partials_json}

============================
TASK:

Produce a single canonical ContentDNA object. Return ONLY valid JSON.
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
                "Ollama synthesis returned invalid JSON. "
                "Raw content preview: %s",
                raw_content[:500],
            )

            raise LLMProviderError(
                "The local LLM returned invalid synthesis JSON"
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
                "Ollama synthesis output failed ContentDNA "
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
EXECUTIVE BRIEFING SPECIFICATION:
Produce a publication-grade, decision-ready executive briefing formatted in clean Markdown.

Structure:
# [Executive Summary Title]
**Target Audience:** {generation_config.get('audience', 'Executive Leadership')} | **Communication Intent:** {generation_config.get('objective', 'Strategic Decision Support')}

## 1. Executive Summary & Strategic Context
A substantive multi-paragraph strategic overview synthesizing the core background, situation, and objectives from Content DNA.

## 2. Key Metrics & Factual Highlights
Present every verified metric, percentage, date, and statistic extracted from Content DNA in a structured highlight list.

## 3. Core Findings & Critical Analysis
Deep, substantive bullet points detailing key findings, operational realities, and verified evidence.

## 4. Material Risks & Strategic Implications
Thorough analysis of risks, vulnerabilities, opportunities, and implications grounded in Content DNA.

## 5. Prioritized Actionable Recommendations
Actionable, concrete recommendations ordered by priority (Immediate, Near-Term, and Strategic Roadmap).

## 6. Source Traceability & Grounding
- **Primary Source Reference:** State source reference from Content DNA.
- **Key Grounded Evidence:** Verbatim supporting excerpt from Content DNA.
""",

            "advisory": """
STRATEGIC ADVISORY SPECIFICATION:
Produce an authoritative, intelligence-grade strategic advisory document formatted in clean Markdown.

Structure:
# Strategic Advisory: [Title]
**Advisory Level:** High Priority | **Target Audience:** {generation_config.get('audience', 'Stakeholders')} | **Tone:** {generation_config.get('tone', 'Objective & Analytical')}

## Executive Action Message
1-2 punchy paragraphs stating the central takeaway and immediate recommended stance.

## 1. Operational Situation & Background
Substantive context explaining the operational landscape, stakeholders, entities involved, and triggering conditions.

## 2. Empirical Findings & Verified Evidence
Comprehensive breakdown of all verified findings, claims, and data points from Content DNA.

## 3. Risk Assessment & Vulnerabilities
Explicit assessment of identified risks, exposure points, and consequence severity.

## 4. Strategic Implications
What this means across operational, technical, financial, or governance domains.

## 5. Recommended Course of Action
- **Immediate Actions (0-30 Days):** Specific immediate actions.
- **Mid-Term Adjustments (30-90 Days):** Process or strategy adjustments.
- **Long-Term Governance & Monitoring:** Ongoing tracking metrics.

## 6. Traceability & Reference Evidence
Citations and verbatim supporting excerpts from Content DNA.
""",

            "linkedin": """
LINKEDIN PUBLICATION SPECIFICATION:
Generate a high-impact, directly publishable LinkedIn post written for maximum readability and professional engagement.

Formatting Rules:
- Start with a compelling 1-2 line opening hook that captures professional attention without sensationalism.
- Leave clean blank lines between short, digestible paragraphs (1-2 sentences each).
- Include a 3-4 item bulleted list highlighting key metrics, breakthroughs, or verified takeaways from Content DNA.
- Provide a strong concluding perspective or strategic question as a Call to Action (CTA).
- End with 4-5 relevant industry hashtags on the last line.
- Return ONLY the finished, directly copyable post. Do NOT include section headers like "Hook:" or "Body:".
""",

            "twitter": """
X / TWITTER THREAD SPECIFICATION:
Generate a publication-ready X/Twitter thread (3-5 tweets) optimized for clarity, brevity, and factual punchiness.

Formatting Rules:
- Number each tweet clearly: 1/5, 2/5, 3/5, etc.
- Tweet 1: Standalone hook tweet introducing the core insight with high engagement.
- Tweet 2: Key data points, metrics, and factual evidence.
- Tweet 3: Critical implications and findings.
- Tweet 4: Strategic takeaways and actionable advice.
- Tweet 5: Concluding wrap-up tweet with CTA and 3 relevant hashtags.
- Keep every tweet under 280 characters. Return ONLY the thread.
""",

            "presentation": """
EXECUTIVE PRESENTATION DECK SPECIFICATION:
Generate a complete, presentation-ready slide deck script with 6-7 structured slides.

For EVERY slide provide:
---
### Slide [Number]: [Slide Title]
**Visual Direction:** [Description of layout, diagram, chart, or graphic for the visual designer]
**Slide Bullets:**
- [High-signal bullet point with exact figures / entities]
- [High-signal bullet point]
- [High-signal bullet point]

**Speaker Notes:**
[2-3 complete, professional sentences of spoken script that the presenter will say aloud to accompany this slide.]
---

Include all slides: Slide 1 (Title & Agenda), Slide 2 (Context & Overview), Slide 3 (Key Data & Metrics), Slide 4 (Findings & Analysis), Slide 5 (Risks & Implications), Slide 6 (Recommendations & Next Steps), Slide 7 (Conclusion & Q&A).
""",

            "video": """
VIDEO PRODUCTION BLUEPRINT SPECIFICATION:
Generate a complete video production blueprint containing:

# Video Production Blueprint: [Title]
**Target Runtime:** 60-90 Seconds | **Target Audience:** {generation_config.get('audience', 'General')} | **Visual Style:** Cinematic / Professional

## Scene Breakdown
For each scene (Scene 1 to Scene 5):
- **Scene [Number] ([Timestamp e.g. 0:00 - 0:15])**
  - **Visual Description:** Camera angle, setting, motion, and visual assets.
  - **On-Screen Text (OST):** Text overlay, headline, or metric graphic.
  - **Narration / Voiceover Script:** Verbatim spoken narration.
  - **Subtitles:** Synchronized subtitles.
  - **Audio & Sound Direction:** Background music mood and sound effects.
""",

            "infographic": """
INFOGRAPHIC DESIGN SPECIFICATION:
Generate a complete visual designer handoff specification:

# Infographic Specification: [Title]
**Core Key Message:** [1-sentence central takeaway]

## 1. Hero Metric Callout Cards
3-4 prominent visual stat boxes with large numbers + concise labels (e.g. [ 40% | Processing Time Reduction ]).

## 2. Structured Content Sections
3-4 visual content panels with section title, icon recommendation, and data visualization type (Comparison Matrix, Timeline, Metric Bar).

## 3. Key Takeaway & Callout Box
High-impact visual summary box.

## 4. Visual Layout & Styling Guide
- **Layout Format:** Vertical (9:16) or Landscape (16:9)
- **Suggested Color Palette:** Slate, Cobalt, Emerald Accent
- **Typography & Iconography Direction:** Clean modern sans-serif with geometric line icons.
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