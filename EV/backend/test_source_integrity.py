from app.core.config import settings
from app.models.content import RawContent
from app.services.source_integrity import SourceIntegrityService
from app.models.content import RawContent
from app.models.transformation import (
    Claim,
    ClaimEvidence,
)

def make_service() -> SourceIntegrityService:
    return SourceIntegrityService(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
    )


def print_claims(result) -> None:
    print(f"\nClaims: {len(result.claims)}")
    print(f"Conflicts: {len(result.conflicts)}")

    for claim in result.claims:
        print(
            f"\n[{claim.status.upper()}]"
            f"\n  ID: {claim.claim_id}"
            f"\n  Claim Key: {claim.claim_key}"
            f"\n  Subject: {claim.subject}"
            f"\n  Predicate: {claim.predicate}"
            f"\n  Value: {claim.value}"
            f"\n  Unit: {claim.unit}"
            f"\n  Time: {claim.time}"
            f"\n  Location: {claim.location}"
            f"\n  Scope: {claim.scope}"
            f"\n  Sources: {claim.source_ids}"
        )

        for evidence in claim.evidence:
            print(
                f"  Evidence:"
                f"\n    Reference: {evidence.source_reference}"
                f"\n    Excerpt: {evidence.supporting_excerpt}"
            )

    for conflict in result.conflicts:
        print(
            f"\n⚠ CONFLICT"
            f"\n  ID: {conflict.conflict_id}"
            f"\n  Claim: {conflict.claim_key}"
            f"\n  Description: {conflict.description}"
            f"\n  Claim IDs: {conflict.claim_ids}"
            f"\n  Status: {conflict.status}"
        )


def test_corroboration(service: SourceIntegrityService) -> None:
    print("\n" + "=" * 70)
    print("TEST 1 — SAME FACT, DIFFERENT WORDING")
    print("=" * 70)

    source_a = RawContent(
        source_id="source_a",
        source_type="text",
        title="Report A",
        text=(
            "The incident affected fourteen organizations "
            "across the region on 22 April 2026."
        ),
        metadata={},
    )

    source_b = RawContent(
        source_id="source_b",
        source_type="text",
        title="Report B",
        text=(
            "On 22 April 2026, fourteen entities were impacted "
            "by the incident."
        ),
        metadata={},
    )

    result = service.analyze(
        [source_a, source_b]
    )

    print_claims(result)

    if result.conflicts:
        raise AssertionError(
            "TEST 1 FAILED: corroborating sources "
            "were treated as conflicting."
        )

    if not any(
        claim.status == "corroborated"
        for claim in result.claims
    ):
        raise AssertionError(
            "TEST 1 FAILED: no claim was marked corroborated."
        )

    print("\n✅ TEST 1 PASSED")


def test_conflict(service: SourceIntegrityService) -> None:
    print("\n" + "=" * 70)
    print("TEST 2 — GENUINE CONFLICT")
    print("=" * 70)

    source_a = RawContent(
        source_id="source_c",
        source_type="text",
        title="Report C",
        text=(
            "The incident affected fourteen organizations "
            "on 22 April 2026."
        ),
        metadata={},
    )

    source_b = RawContent(
        source_id="source_d",
        source_type="text",
        title="Report D",
        text=(
            "The incident affected seventeen organizations "
            "on 22 April 2026."
        ),
        metadata={},
    )

    result = service.analyze(
        [source_a, source_b]
    )

    print_claims(result)

    if not result.conflicts:
        raise AssertionError(
            "TEST 2 FAILED: genuine conflict "
            "was not detected."
        )

    if not any(
        claim.status == "conflict"
        for claim in result.claims
    ):
        raise AssertionError(
            "TEST 2 FAILED: conflicting claims "
            "were not marked."
        )

    print("\n✅ TEST 2 PASSED")


def test_different_time(service: SourceIntegrityService) -> None:
    print("\n" + "=" * 70)
    print("TEST 3 — DIFFERENT TIME")
    print("=" * 70)

    source_a = RawContent(
        source_id="source_e",
        source_type="text",
        title="Initial Report",
        text=(
            "Fourteen organizations were affected "
            "on 22 April 2026."
        ),
        metadata={},
    )

    source_b = RawContent(
        source_id="source_f",
        source_type="text",
        title="Follow-up Report",
        text=(
            "Seventeen organizations were affected "
            "by 30 April 2026."
        ),
        metadata={},
    )

    result = service.analyze(
        [source_a, source_b]
    )

    print_claims(result)

    if result.conflicts:
        raise AssertionError(
            "TEST 3 FAILED: claims from different "
            "time periods were treated as conflicting."
        )

    print("\n✅ TEST 3 PASSED")

def test_different_location(service: SourceIntegrityService) -> None:
    print("\n" + "=" * 70)
    print("TEST 4 — DIFFERENT LOCATION")
    print("=" * 70)

    # ------------------------------------------------------------
    # PART A
    # Different locations should NOT be treated as a conflict.
    # ------------------------------------------------------------

    source_a = RawContent(
        source_id="source_g",
        source_type="text",
        title="National Report",
        text=(
            "Across the entire country, "
            "fourteen organizations were affected "
            "by the incident on 22 April 2026."
        ),
        metadata={},
    )

    source_b = RawContent(
        source_id="source_h",
        source_type="text",
        title="Tamil Nadu Report",
        text=(
            "Within Tamil Nadu, "
            "seventeen organizations were affected "
            "by the incident on 22 April 2026."
        ),
        metadata={},
    )

    result_a = service.analyze(
        [source_a, source_b]
    )

    print("\n--- PART A: DIFFERENT LOCATIONS ---")
    print_claims(result_a)

    if result_a.conflicts:
        raise AssertionError(
            "TEST 4A FAILED: claims from different "
            "locations were treated as a conflict."
        )

    print("\n✅ TEST 4A PASSED")

    # ------------------------------------------------------------
    # PART B
    # Same location + different values SHOULD conflict.
    # ------------------------------------------------------------

    source_c = RawContent(
        source_id="source_i",
        source_type="text",
        title="Tamil Nadu Report A",
        text=(
            "Within Tamil Nadu, "
            "fourteen organizations were affected "
            "by the incident on 22 April 2026."
        ),
        metadata={},
    )

    source_d = RawContent(
        source_id="source_j",
        source_type="text",
        title="Tamil Nadu Report B",
        text=(
            "Within Tamil Nadu, "
            "seventeen organizations were affected "
            "by the incident on 22 April 2026."
        ),
        metadata={},
    )

    result_b = service.analyze(
        [source_c, source_d]
    )

    print("\n--- PART B: SAME LOCATION ---")
    print_claims(result_b)

    if not result_b.conflicts:
        raise AssertionError(
            "TEST 4B FAILED: different values "
            "for the same location were not "
            "detected as a conflict."
        )

    print("\n✅ TEST 4B PASSED")

def test_evidence_traceability() -> None:
    print("\n" + "=" * 70)
    print("TEST 5 — EVIDENCE TRACEABILITY")
    print("=" * 70)

    claim = Claim(
        claim_id="claim-test-001",
        claim_key="affected_organizations",
        subject="organizations",
        predicate="affected_by_incident",
        value="14",
        unit="organizations",
        time="22 April 2026",
        location="Tamil Nadu",
        scope="",
        source_ids=["report_a"],
        evidence=[
            ClaimEvidence(
                source_id="report_a",
                source_reference="Incident Report A",
                supporting_excerpt=(
                    "The incident affected fourteen organizations "
                    "in Tamil Nadu on 22 April 2026."
                ),
                page=12,
                section="Incident Impact",
                timestamp="",
                frame="",
            )
        ],
        status="supported",
    )

    # ------------------------------------------------------------
    # Verify claim identity
    # ------------------------------------------------------------

    assert claim.claim_id == "claim-test-001"

    assert (
        claim.claim_key
        == "affected_organizations"
    )

    # ------------------------------------------------------------
    # Verify source linkage
    # ------------------------------------------------------------

    assert claim.source_ids == [
        "report_a"
    ]

    assert len(claim.evidence) == 1

    evidence = claim.evidence[0]

    assert evidence.source_id == "report_a"

    assert (
        evidence.source_reference
        == "Incident Report A"
    )

    # ------------------------------------------------------------
    # Verify exact supporting evidence
    # ------------------------------------------------------------

    assert (
        evidence.supporting_excerpt
        == (
            "The incident affected fourteen organizations "
            "in Tamil Nadu on 22 April 2026."
        )
    )

    # ------------------------------------------------------------
    # Verify source location metadata
    # ------------------------------------------------------------

    assert evidence.page == 12

    assert (
        evidence.section
        == "Incident Impact"
    )

    print("\nClaim:")
    print(
        f"  {claim.subject} = {claim.value}"
    )

    print("\nEvidence:")
    print(
        f"  Source: {evidence.source_reference}"
    )
    print(
        f"  Page: {evidence.page}"
    )
    print(
        f"  Section: {evidence.section}"
    )
    print(
        f"  Excerpt: {evidence.supporting_excerpt}"
    )

    print("\n✅ TEST 5 PASSED")

def main() -> None:
    print("\n" + "=" * 70)
    print("EV SOURCE INTEGRITY ENGINE TEST")
    print("=" * 70)

    if not settings.groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY is empty. Check your .env file."
        )

    print(
        f"Model: {settings.groq_model}"
    )

    service = make_service()

    test_corroboration(service)
    test_conflict(service)
    test_different_time(service)
    test_different_location(service)
    test_evidence_traceability()

    print("\n" + "=" * 70)
    print("✅ ALL SOURCE INTEGRITY TESTS PASSED")
    print("=" * 70)


if __name__ == "__main__":
    main()