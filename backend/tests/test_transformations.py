from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.content import ContentDNA, RawContent
from app.services.storage import LocalTransformationStorage


class FakeProvider:
    def generate_content_dna(self, content: RawContent) -> ContentDNA:
        text = content.text
        entities = {"organizations": [], "people": [], "locations": [], "technologies": []}
        if "Pathenova" in text:
            entities["organizations"] = ["Team Pathenova"]
        return ContentDNA(
            identity={"title": content.title, "content_type": content.source_type, "source_description": "Test source"},
            overview={"summary": text[:80], "purpose": "Testing"},
            entities=entities,
            facts={"claims": [text[:80]], "events": ["Team Pathenova won SIH"] if "Pathenova" in text else []},
            findings={"key_findings": ["Win identified"] if "won SIH" in text else ["Source processed"]},
            context={"target_audience": "Judges", "tone": "Formal", "communication_objective": "Inform"},
            evidence={"source_reference": content.source_id, "supporting_excerpt": text[:80]},
        )


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    app.state.transformation_storage = LocalTransformationStorage(str(tmp_path / "transformations.json"))
    app.state.content_dna_service.provider = FakeProvider()
    return TestClient(app)


def test_transformation_isolation_and_partial_dna_regression(client: TestClient) -> None:
    transformation_a = client.post("/api/v1/transformations", json={"title": "A"}).json()
    a_id = transformation_a["id"]
    a_after_source = client.post(
        f"/api/v1/transformations/{a_id}/sources/text",
        json={"title": "SIH Victory", "text": "Team Pathenova won SIH."},
    ).json()
    assert a_after_source["sources"][0]["text"] == "Team Pathenova won SIH."

    edited = client.patch(
        f"/api/v1/transformations/{a_id}/content-dna",
        json={"overview": {"summary": "Edited summary."}},
    ).json()
    dna = edited["content_dna"]
    assert dna["overview"]["summary"] == "Edited summary."
    assert dna["identity"]["title"] == "SIH Victory"
    assert dna["entities"]["organizations"] == ["Team Pathenova"]
    assert dna["facts"]["claims"]
    assert dna["findings"]["key_findings"]
    assert dna["context"]["tone"] == "Formal"
    assert dna["evidence"]["supporting_excerpt"]

    transformation_b = client.post("/api/v1/transformations", json={"title": "B"}).json()
    assert transformation_b["sources"] == []
    assert transformation_b["content_dna"] is None
    b_id = transformation_b["id"]
    b_after_source = client.post(
        f"/api/v1/transformations/{b_id}/sources/text",
        json={"title": "Unrelated", "text": "A separate cybersecurity analysis."},
    ).json()
    assert "Pathenova" not in str(b_after_source)

    restored_a = client.get(f"/api/v1/transformations/{a_id}").json()
    assert restored_a["content_dna"]["overview"]["summary"] == "Edited summary."
    assert restored_a["sources"][0]["text"] == "Team Pathenova won SIH."


def test_outputs_are_tied_to_dna_version(client: TestClient) -> None:
    transformation = client.post("/api/v1/transformations", json={"title": "Outputs"}).json()
    created = client.post(
        f"/api/v1/transformations/{transformation['id']}/sources/text",
        json={"title": "Brief", "text": "Team Pathenova won SIH."},
    ).json()

    generated = client.post(
        f"/api/v1/transformations/{created['id']}/outputs",
        json={"types": ["executive_summary", "linkedin"]},
    )

    assert generated.status_code == 200
    body = generated.json()
    assert len(body["outputs"]) == 2
    assert body["outputs"][0]["dna_version"] == len(body["versions"])


def test_unsupported_source_does_not_fake_dna(client: TestClient) -> None:
    transformation = client.post("/api/v1/transformations", json={"title": "Media"}).json()
    updated = client.post(
        f"/api/v1/transformations/{transformation['id']}/sources/unsupported",
        json={"source_type": "video", "title": "Demo video"},
    ).json()

    assert updated["sources"][0]["metadata"]["status"] == "unsupported"
    assert updated["content_dna"] is None
