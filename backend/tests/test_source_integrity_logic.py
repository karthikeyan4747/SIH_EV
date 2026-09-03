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
    Test 8: Three sources with 1 logical binary conflict between 2 distinct values (500 vs 750)
    A -> 500
    B -> 750
    C -> 750
    Expected: 1 conflict with strictly 2 competing values (c1: 500 vs c2: 750)
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "employs", "500", "employees"),
        make_claim("c2", "employee_count", "Company X", "employs", "750", "employees"),
        make_claim("c3", "employee_count", "Company X", "employs", "750", "employees"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    # Exactly 2 competing claims representing the 2 distinct conflicting values
    assert len(conflicts[0].claim_ids) == 2
    assert conflicts[0].claim_ids == ["c1", "c2"]
    assert claims[0].status == "conflict"
    assert claims[1].status == "conflict"
    assert claims[2].status == "conflict"


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


def test_semantic_competition_conflict() -> None:
    """
    Test 13: Semantic competition conflict
    Source A: Pathenova won SIH 2026.
    Source B: Pathenova was shortlisted for SIH 2026.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "competition_outcome", "Pathenova", "won", "winner", time="SIH 2026"),
        make_claim("c2", "competition_outcome", "Pathenova", "was shortlisted for", "shortlisted", time="SIH 2026"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}
    assert claims[0].status == "conflict"
    assert claims[1].status == "conflict"


def test_completion_date_conflict() -> None:
    """
    Test 14: Completion date conflict
    Source A: Project completed in 2024.
    Source B: Project completed in 2025.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "completion_date", "Project Alpha", "was completed in", "2024"),
        make_claim("c2", "completion_date", "Project Alpha", "finished in", "2025"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_numeric_conflict_50_vs_55() -> None:
    """
    Test 15: Numeric discrepancy 50 vs 55 employees
    Source A: Organization has 50 employees.
    Source B: Organization employs approximately 55 people.
    Expected: 1 conflict
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "The Organization", "has", "50", "employees"),
        make_claim("c2", "employee_count", "The Organization", "employs", "55", "people"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_numeric_corroboration_1000() -> None:
    """
    Test 16: Formatted vs unformatted number corroboration (1,000 == 1000)
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "employee_count", "Company X", "employees", "1,000", "employees"),
        make_claim("c2", "employee_count", "Company X", "workforce", "1000", "people"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0
    assert claims[0].status == "corroborated"
    assert claims[1].status == "corroborated"


def test_budget_crore_conflict() -> None:
    """
    Test 17: Financial budget conflict in crores (10 crore vs 12 crore)
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "budget", "Project Horizon", "budget was", "₹10 crore", "INR"),
        make_claim("c2", "budget", "Project Horizon", "total cost", "₹12 crore", "INR"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_entity_alias_usa_united_states() -> None:
    """
    Test 18: Entity alias matching (USA vs United States)
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "headquarters", "USA", "location", "Washington"),
        make_claim("c2", "headquarters", "United States", "location", "Washington"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 0
    assert claims[0].status == "corroborated"


def test_calendar_date_day_conflict() -> None:
    """
    Test 19: Incident date conflict (14 March vs 16 March)
    """
    service = SourceIntegrityService(api_key="", model="")
    claims = [
        make_claim("c1", "incident_date", "The incident", "occurred on", "14 March"),
        make_claim("c2", "incident_date", "The incident", "took place on", "16 March"),
    ]
    conflicts = service._compare_claims(claims)
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {"c1", "c2"}


def test_conflict_resolution_endpoint() -> None:
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. Create a transformation
    t_res = client.post("/api/v1/transformations", json={"title": "Conflict Test Workspace"})
    assert t_res.status_code == 201
    tid = t_res.json()["id"]

    # 2. Add two conflicting sources
    client.post(
        f"/api/v1/transformations/{tid}/sources/text",
        json={"title": "Source A", "text": "The project was launched in 2024."},
    )
    client.post(
        f"/api/v1/transformations/{tid}/sources/text",
        json={"title": "Source B", "text": "The project was launched in 2025."},
    )

    t_data = client.get(f"/api/v1/transformations/{tid}").json()
    integrity = t_data.get("source_integrity", {})
    conflicts = integrity.get("conflicts", [])

    if conflicts:
        conflict_id = conflicts[0]["conflict_id"]
        # Resolve by selecting first claim
        resolve_res = client.post(
            f"/api/v1/transformations/{tid}/integrity/conflicts/{conflict_id}/resolve",
            json={"decision": "accept_source_a", "selected_claim_id": conflicts[0]["claim_ids"][0]},
        )
        assert resolve_res.status_code == 200

        # Resolving already-resolved conflict or by claim_key should not 404
        retry_res = client.post(
            f"/api/v1/transformations/{tid}/integrity/conflicts/{conflict_id}/resolve",
            json={"decision": "accept_source_a", "selected_claim_id": conflicts[0]["claim_ids"][0]},
        )
        assert retry_res.status_code == 200


def test_large_document_many_pages_conflict_has_only_two_options() -> None:
    """
    Test 21: When 30 pages/chunks extract repetitive claims with 2 competing values
    (e.g., 20 chunks say 'overall winner' and 10 chunks say 'shortlisted'),
    the conflict detector consolidates repetitive mentions and produces
    STRICTLY 1 conflict with EXACTLY 2 options (Option A vs Option B).
    """
    service = SourceIntegrityService(api_key="", model="")

    # Simulate 30 claims extracted across 30 pages
    claims = []
    # 20 mentions of "overall winner" across pages 1..20
    for page in range(1, 21):
        claims.append(
            make_claim(
                claim_id=f"chunk-{page}",
                claim_key="hackathon_award_status",
                subject="Pathenova",
                predicate="was awarded",
                value="overall winner",
                unit="",
                time="2026",
            )
        )
    # 10 mentions of "shortlisted among top teams" across pages 21..30
    for page in range(21, 31):
        claims.append(
            make_claim(
                claim_id=f"chunk-{page}",
                claim_key="hackathon_award_status",
                subject="Pathenova",
                predicate="was awarded",
                value="shortlisted among top teams",
                unit="",
                time="2026",
            )
        )

    # 1. Consolidate repetitive claims across 30 pages
    consolidated = service._consolidate_equivalent_claims(claims)
    # 30 raw claims should be consolidated into exactly 2 unique factual assertions
    assert len(consolidated) == 2

    # 2. Compare claims
    conflicts = service._compare_claims(consolidated)

    # Must produce strictly 1 conflict record
    assert len(conflicts) == 1

    # That conflict must contain STRICTLY 2 competing claim IDs (Option A vs Option B)
    assert len(conflicts[0].claim_ids) == 2
    assert set(conflicts[0].claim_ids) == {consolidated[0].claim_id, consolidated[1].claim_id}


def test_conflict_resolution_removes_wrong_data_from_content_dna() -> None:
    """
    Test 22: When a conflict is resolved (e.g. accepting Option A 'overall winner' over Option B 'shortlisted'),
    the rejected wrong data ('shortlisted') is thoroughly excised from Content DNA
    (facts, findings, overview, entities) and replaced with the authoritative value.
    """
    from app.api.routes.transformations import apply_resolution_to_dna
    from app.models.content import ContentDNA, Facts, Findings, Entities, Overview

    initial_dna = ContentDNA(
        facts=Facts(
            claims=[
                "Pathenova was shortlisted among top teams in SIH 2026.",
                "Team developed an automated synthesis platform.",
            ],
            statistics=["8 Lakh INR initial funding"],
            dates=["Slated for December 2026"],
        ),
        findings=Findings(
            key_findings=[
                "Pathenova was shortlisted but not declared overall winner.",
            ],
            risks=["Grant of 8 Lakh INR may not suffice."],
        ),
        overview=Overview(
            summary="Pathenova was shortlisted in SIH 2026 with 8 Lakh INR funding.",
            purpose="Content synthesis tool.",
        ),
        entities=Entities(
            locations=["Chennai"],
            organizations=["Pathenova"],
        ),
    )

    selected_claim = make_claim(
        claim_id="c1",
        claim_key="hackathon_award_status",
        subject="Pathenova",
        predicate="was declared",
        value="Overall Winner",
        unit="",
    )
    rejected_claim = make_claim(
        claim_id="c2",
        claim_key="hackathon_award_status",
        subject="Pathenova",
        predicate="was declared",
        value="shortlisted among top teams",
        unit="",
    )

    # 1. Resolve award status
    updated_dna = apply_resolution_to_dna(
        dna=initial_dna,
        claim_key="hackathon_award_status",
        final_value="Overall Winner",
        selected_claim=selected_claim,
        rejected_claims=[rejected_claim],
    )

    # Assert that "shortlisted" has been completely removed from facts & findings
    for claim in updated_dna.facts.claims:
        assert "shortlisted" not in claim.lower()
    for finding in updated_dna.findings.key_findings:
        assert "shortlisted" not in finding.lower()

    # Assert that "Overall Winner" is present in facts and findings
    assert any("overall winner" in c.lower() for c in updated_dna.facts.claims)
    assert any("overall winner" in f.lower() for f in updated_dna.findings.key_findings)

    # Assert summary was updated
    assert "shortlisted" not in updated_dna.overview.summary.lower()
    assert "overall winner" in updated_dna.overview.summary.lower()


def test_cross_source_direct_contradictions_detected() -> None:
    """
    Test 23: Direct contradictions across multiple distinct sources
    (such as headquarters location, launch date, employee count, and revenue)
    are all reliably detected even when one source uses generic entity terms
    ('The company', 'The project') and natural-language predicate synonyms.
    """
    service = SourceIntegrityService(mode="api")

    # Source 1 claims
    c1 = make_claim(
        "s1_hq",
        "headquarters",
        "Nexar Dynamics",
        "headquartered in",
        "Bengaluru",
    )
    c2 = make_claim(
        "s1_launch",
        "launch_date",
        "Nexar Dynamics",
        "launched in",
        "March 2024",
    )
    c3 = make_claim(
        "s1_emp",
        "employee_count",
        "Nexar Dynamics",
        "employs",
        "450",
        "employees",
    )
    c4 = make_claim(
        "s1_rev",
        "revenue",
        "Nexar Dynamics",
        "reported annual recurring revenue of",
        "$18 million",
        "USD",
    )

    # Source 2 conflicting claims (using generic subject 'The company' and different wording)
    c5 = make_claim(
        "s2_hq",
        "location",
        "The company",
        "based in",
        "Chennai",
    )
    c6 = make_claim(
        "s2_launch",
        "debut_date",
        "The company",
        "debuted in",
        "November 2025",
    )
    c7 = make_claim(
        "s2_emp",
        "team_size",
        "The company",
        "operates with an active team of",
        "250",
        "employees",
    )
    c8 = make_claim(
        "s2_rev",
        "annual_turnover",
        "The company",
        "generated in revenue",
        "$10 million",
        "USD",
    )

    conflicts = service._compare_claims([c1, c2, c3, c4, c5, c6, c7, c8])

    # Assert all 4 distinct contradictions are detected
    assert len(conflicts) == 4

    claim_id_pairs = [set(c.claim_ids) for c in conflicts]
    # Check headquarters conflict
    assert {"s1_hq", "s2_hq"} in claim_id_pairs
    # Check launch date conflict
    assert {"s1_launch", "s2_launch"} in claim_id_pairs
    # Check employee count conflict
    assert {"s1_emp", "s2_emp"} in claim_id_pairs
    # Check revenue conflict
    assert {"s1_rev", "s2_rev"} in claim_id_pairs


def test_parental_and_relational_contradictions_detected() -> None:
    """
    Test 24: When two sources make conflicting claims about a relationship
    (e.g., 'Vani is Karthikeyan's mom' vs 'bala is Karthikeyan's mom'),
    the relational inversion normalizes them to canonical subject 'Karthikeyan',
    predicate 'mother', and flags the conflict between 'Vani' and 'bala'.
    """
    from app.services.source_integrity import _ExtractedClaim
    from app.models.content import RawContent

    service = SourceIntegrityService(mode="api")

    s1 = RawContent(
        source_id="src_vani",
        source_type="text",
        title="Source 1",
        text="vani is Karthikeyan's mom",
    )
    s2 = RawContent(
        source_id="src_bala",
        source_type="text",
        title="Source 2",
        text="bala is Karthikeyan's mom",
    )

    extracted_1 = _ExtractedClaim(
        claim_key="parent_relationship",
        subject="Vani",
        predicate="is_mother_of",
        value="Karthikeyan",
        supporting_excerpt="vani is Karthikeyan's mom",
    )
    extracted_2 = _ExtractedClaim(
        claim_key="parent_relationship",
        subject="bala",
        predicate="is_mother_of",
        value="Karthikeyan",
        supporting_excerpt="bala is Karthikeyan's mom",
    )

    claim_1 = service._build_claim(s1, extracted_1, 0)
    claim_2 = service._build_claim(s2, extracted_2, 1)

    # Check canonical inversion
    assert claim_1.subject.lower() == "karthikeyan"
    assert claim_1.value.lower() == "vani"
    assert claim_2.subject.lower() == "karthikeyan"
    assert claim_2.value.lower() == "bala"

    conflicts = service._compare_claims([claim_1, claim_2])
    assert len(conflicts) == 1
    assert set(conflicts[0].claim_ids) == {claim_1.claim_id, claim_2.claim_id}
    assert "vani" in conflicts[0].description.lower()
    assert "bala" in conflicts[0].description.lower()


def test_content_dna_direct_contradiction_detection() -> None:
    """
    Test 25: Source Integrity directly leverages Content DNA's synthesized
    facts.claims and findings.key_findings to detect contradictions across sources.
    """
    import json
    from unittest.mock import patch
    from app.models.content import ContentDNA, Facts, Findings, RawContent

    service = SourceIntegrityService(mode="api")

    s1 = RawContent(
        source_id="src-1",
        source_type="text",
        title="Source 1",
        text="Vani is Karthikeyan's mom.",
    )
    s2 = RawContent(
        source_id="src-2",
        source_type="text",
        title="Source 2",
        text="Bala is Karthikeyan's mom.",
    )

    dna = ContentDNA(
        facts=Facts(
            claims=[
                "Vani is Karthikeyan's mom.",
                "Bala is Karthikeyan's mom.",
            ]
        ),
        findings=Findings(
            key_findings=[
                "There is a direct contradiction between Source 1 and Source 2 regarding the identity of Karthikeyan's mother."
            ]
        ),
    )

    mock_llm_json = json.dumps({
        "conflicts": [
            {
                "claim_a": "Vani is Karthikeyan's mom.",
                "claim_b": "Bala is Karthikeyan's mom.",
                "claim_key": "mother_identity",
                "description": "Contradictory assertions detected between sources: Source 1 states 'Vani is Karthikeyan's mom'; Source 2 states 'Bala is Karthikeyan's mom'.",
                "reason": "Competing maternal parent identities asserted for Karthikeyan.",
            }
        ]
    })

    class FakeChoice:
        class FakeMsg:
            content = mock_llm_json
        message = FakeMsg()

    class FakeCompletion:
        choices = [FakeChoice()]

    with patch("app.services.llm._call_groq", return_value=FakeCompletion()):
        result = service.analyze([s1, s2], content_dna=dna)

    assert len(result.conflicts) >= 1
    conflict = result.conflicts[0]
    assert len(conflict.claim_ids) == 2
    assert "vani" in conflict.description.lower()
    assert "bala" in conflict.description.lower()







