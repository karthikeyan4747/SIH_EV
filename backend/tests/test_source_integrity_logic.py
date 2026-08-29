from app.models.transformation import Claim
from app.services.source_integrity import SourceIntegrityService


def make_claim(
    claim_id: str,
    claim_key: str,
    subject: str,
    predicate: str,
    value: str,
    unit: str = "",
    time: str = "22 April 2026",
    location: str = "",
) -> Claim:
    return Claim(
        claim_id=claim_id,
        claim_key=claim_key,
        subject=subject,
        predicate=predicate,
        value=value,
        unit=unit,
        time=time,
        location=location,
        scope="",
        source_ids=[claim_id],
        evidence=[],
    )


def test_word_numbers_are_normalized_for_corroboration() -> None:
    service = SourceIntegrityService(api_key="", model="")

    claims = [
        make_claim(
            "claim-a",
            "affected_organizations",
            "organizations",
            "affected_by_incident",
            "fourteen",
            "organizations",
        ),
        make_claim(
            "claim-b",
            "affected_organizations",
            "entities",
            "impacted_by_incident",
            "14",
            "entities",
        ),
    ]

    conflicts = service._compare_claims(claims)

    assert conflicts == []
    assert {claim.status for claim in claims} == {"corroborated"}


def test_conflict_detected_across_different_claim_keys() -> None:
    service = SourceIntegrityService(api_key="", model="")

    claims = [
        make_claim(
            "claim-a",
            "organizations_affected",
            "organizations",
            "affected_by_incident",
            "fourteen",
            "organizations",
        ),
        make_claim(
            "claim-b",
            "impacted_entities_count",
            "entities",
            "impacted_by_incident",
            "seventeen",
            "entities",
        ),
    ]

    conflicts = service._compare_claims(claims)

    assert len(conflicts) == 1
    assert conflicts[0].claim_ids == ["claim-a", "claim-b"]
    assert {claim.status for claim in claims} == {"conflict"}


def test_different_units_do_not_conflict() -> None:
    service = SourceIntegrityService(api_key="", model="")

    claims = [
        make_claim(
            "claim-a",
            "affected_organizations",
            "organizations",
            "affected_by_incident",
            "fourteen",
            "organizations",
        ),
        make_claim(
            "claim-b",
            "reported_security_incidents",
            "incidents",
            "reported",
            "seventeen",
            "incidents",
        ),
    ]

    conflicts = service._compare_claims(claims)

    assert conflicts == []
    assert {claim.status for claim in claims} == {"supported"}
