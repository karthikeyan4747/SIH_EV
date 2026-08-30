from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.content import ContentDNA, RawContent
from app.services.ingestion import IngestionError, PDFIngestionProvider, TXTIngestionProvider
from app.services.storage import LocalJSONStorage


class FakeProvider:
    def generate_content_dna(self, content: RawContent) -> ContentDNA:
        return ContentDNA(
            identity={"title": content.title, "content_type": content.source_type},
            overview={"summary": content.text[:80]},
            evidence={"source_reference": content.source_id, "supporting_excerpt": content.text[:80]},
        )


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    app.state.storage = LocalJSONStorage(str(tmp_path / "sources.json"))
    app.state.content_dna_service.provider = FakeProvider()
    return TestClient(app)


def test_text_source_and_patch_preserves_original(client: TestClient) -> None:
    response = client.post("/api/v1/sources/text", json={"title": "Report", "text": "50 incidents detected."})
    assert response.status_code == 201
    source_id = response.json()["source_id"]

    updated = client.patch(
        f"/api/v1/sources/{source_id}/content-dna",
        json={"overview": {"summary": "Updated summary"}},
    )
    assert updated.status_code == 200
    assert updated.json()["overview"] == {"summary": "Updated summary", "purpose": ""}
    assert updated.json()["identity"]["title"] == "Report"
    assert client.get(f"/api/v1/sources/{source_id}").json()["source"]["text"] == "50 incidents detected."


def test_put_remains_full_replacement(client: TestClient) -> None:
    response = client.post("/api/v1/sources/text", json={"title": "Report", "text": "Source text."})
    source_id = response.json()["source_id"]
    replacement = ContentDNA.model_validate({"overview": {"summary": "Replacement"}})

    updated = client.put(f"/api/v1/sources/{source_id}/content-dna", json=replacement.model_dump())

    assert updated.status_code == 200
    assert updated.json()["overview"]["summary"] == "Replacement"
    assert updated.json()["identity"]["title"] == ""


def test_patch_list_field_replaces_only_that_list(client: TestClient) -> None:
    response = client.post("/api/v1/sources/text", json={"title": "Report", "text": "Source text."})
    source_id = response.json()["source_id"]

    updated = client.patch(
        f"/api/v1/sources/{source_id}/content-dna",
        json={"facts": {"statistics": ["75 incidents"]}},
    )

    assert updated.status_code == 200
    assert updated.json()["facts"]["statistics"] == ["75 incidents"]
    assert updated.json()["facts"]["claims"] == []


def test_empty_patch_is_a_no_op(client: TestClient) -> None:
    response = client.post("/api/v1/sources/text", json={"title": "Report", "text": "Source text."})
    source_id = response.json()["source_id"]
    before = client.get(f"/api/v1/sources/{source_id}/content-dna").json()

    updated = client.patch(f"/api/v1/sources/{source_id}/content-dna", json={})

    assert updated.status_code == 200
    assert updated.json() == before


def test_invalid_patch_and_missing_source(client: TestClient) -> None:
    invalid = client.patch("/api/v1/sources/missing/content-dna", json={"unknown": "value"})
    assert invalid.status_code == 422

    missing = client.patch("/api/v1/sources/missing/content-dna", json={})
    assert missing.status_code == 404


def test_txt_source(client: TestClient) -> None:
    response = client.post(
        "/api/v1/sources/file",
        files={"file": ("notes.txt", "TXT source text".encode(), "text/plain")},
    )
    assert response.status_code == 201
    source = client.get(f"/api/v1/sources/{response.json()['source_id']}").json()["source"]
    assert source["source_type"] == "txt"
    assert source["text"] == "TXT source text"


def test_pdf_source_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakePage:
        def extract_text(self) -> str:
            return "PDF source text"

    class FakeReader:
        pages = [FakePage(), FakePage()]

    monkeypatch.setattr("app.services.ingestion.PdfReader", lambda _: FakeReader())
    content = PDFIngestionProvider().ingest("pdf-id", "report.pdf", b"pdf")
    assert content.source_type == "pdf"
    assert content.metadata == {"filename": "report.pdf", "page_count": 2}
    assert "[Page 1]" in content.text


def test_invalid_file_and_empty_input_rejected(client: TestClient) -> None:
    assert client.post("/api/v1/sources/text", json={"title": "Empty", "text": " "}).status_code == 422
    assert client.post("/api/v1/sources/file", files={"file": ("program.exe", b"data")}).status_code == 415
    with pytest.raises(IngestionError):
        TXTIngestionProvider().ingest("id", "bad.txt", b"\xff")


def test_file_exceeding_256mb_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Set a small test limit or test with mock
    app.state.settings.max_upload_size_bytes = 100
    response = client.post(
        "/api/v1/sources/file",
        files={"file": ("test.txt", b"x" * 200, "text/plain")},
    )
    assert response.status_code == 413
    assert "256 MB" in response.json()["detail"]
    # Restore standard setting
    app.state.settings.max_upload_size_bytes = 256 * 1024 * 1024


def test_content_dna_validation() -> None:
    dna = ContentDNA.model_validate({"facts": {"statistics": ["50 incidents"]}})
    assert dna.facts.statistics == ["50 incidents"]
    with pytest.raises(ValueError):
        ContentDNA.model_validate({"unknown": "field"})
