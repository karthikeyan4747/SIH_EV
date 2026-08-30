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
    assert "fourteen" in conflicts[0].reason or "Numerical discrepancy" in conflicts[0].reason or "Contradictory" in conflicts[0].reason
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


def test_numeric_conflict() -> None:
    """
    Test 1: Numeric conflict
    Source A: Company X has 500 employees.
    Source B: Company X has 750 employees.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "has employees", "500", "employees"),
        make_claim("c2", "employee_count", "Company X", "has employees", "750", "employees"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert conflicts[0].status == "unresolved"
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}
    assert claims[0].status == "conflict"
    assert claims[1].status == "conflict"


def test_same_value_corroboration() -> None:
    """
    Test 2: Same value (corroboration)
    Source A: Company X has 500 employees.
    Source B: Company X has 500 employees.
    Expected: 0 conflicts, corroborated
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "has employees", "500", "employees"),
        make_claim("c2", "employee_count", "Company X", "employs", "500", "people"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0
    assert claims[0].status == "corroborated"
    assert claims[1].status == "corroborated"


def test_different_years_no_conflict() -> None:
    """
    Test 3: Different years
    Source A: Company X had 500 employees in 2022.
    Source B: Company X had 750 employees in 2024.
    Expected: 0 conflicts
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "had employees", "500", "employees", time="2022"),
        make_claim("c2", "employee_count", "Company X", "had employees", "750", "employees", time="2024"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0


def test_same_year_conflict() -> None:
    """
    Test 4: Same year conflict
    Source A: Company X had 500 employees in 2024.
    Source B: Company X had 750 employees in 2024.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "had employees", "500", "employees", time="2024"),
        make_claim("c2", "employee_count", "Company X", "had employees", "750", "employees", time="2024"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_different_subjects_no_conflict() -> None:
    """
    Test 5: Different subjects
    Company X has 500 employees.
    Company Y has 750 employees.
    Expected: 0 conflicts
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "employs", "500", "employees"),
        make_claim("c2", "employee_count", "Company Y", "employs", "750", "employees"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0


def test_location_conflict() -> None:
    """
    Test 6: Location conflict
    Source A: Company X is headquartered in Chennai.
    Source B: Company X is headquartered in Bengaluru.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "headquarters", "Company X", "headquartered in", "Chennai"),
        make_claim("c2", "headquarters", "Company X", "based in", "Bengaluru"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_equivalent_wording_no_conflict() -> None:
    """
    Test 7: Equivalent wording
    Source A: Company X employs 500 people.
    Source B: Company X has a workforce of 500 employees.
    Expected: 0 conflicts
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "employs", "500", "people"),
        make_claim("c2", "employee_count", "Company X", "workforce size", "500", "employees"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0
    assert claims[0].status == "corroborated"


def test_three_sources_deduplicated_conflict() -> None:
    """
    Test 8: Three sources with 1 logical conflict
    A -> 500
    B -> 750
    C -> 750
    Expected: 1 logical conflict involving all 3 claims
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "employs", "500", "employees"),
        make_claim("c2", "employee_count", "Company X", "employs", "750", "employees"),
        make_claim("c3", "employee_count", "Company X", "employs", "750", "employees"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2", "c3"}


def test_launch_year_conflict() -> None:
    """
    Test 9: Launch year conflict
    Source A: Project X was launched in 2022.
    Source B: Project X was launched in 2024.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "launch_year", "Project X", "was launched in", "2022"),
        make_claim("c2", "launch_year", "Project X", "was launched in", "2024"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_incident_location_conflict() -> None:
    """
    Test 10: Incident location conflict
    Source A: The incident occurred in Chennai.
    Source B: The incident occurred in Bengaluru.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "incident_location", "The incident", "occurred in", "Chennai"),
        make_claim("c2", "incident_location", "The incident", "occurred in", "Bengaluru"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_status_and_boolean_conflict() -> None:
    """
    Test 11: Boolean & Status conflicts
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "status", "System Alpha", "status", "active"),
        make_claim("c2", "status", "System Alpha", "status", "inactive"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_empty_conflicts_on_consistent_dataset() -> None:
    """
    Test 12: Empty conflicts on consistent dataset
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "revenue", "Company X", "revenue", "$10M", "USD"),
        make_claim("c2", "revenue", "Company X", "annual revenue", "10 million USD", "USD"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0
    assert claims[0].status == "corroborated"
