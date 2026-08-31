import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.token_manager import TokenQuotaTracker, token_manager


@pytest.fixture
def client():
    return TestClient(app)


def test_get_available_models(client: TestClient):
    response = client.get("/api/v1/model-mode/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert len(data["models"]) >= 5
    assert "active_model" in data
    assert "active_provider" in data

    # Verify model details
    qwen = next((m for m in data["models"] if m["id"] == "qwen/qwen3.8-27b"), None)
    assert qwen is not None
    assert qwen["name"] == "Qwen 3.8 27B"
    assert qwen["provider"] == "api"
    assert qwen["tpd_limit"] == 500000
    assert qwen["remaining_daily_tokens"] is not None

    local_model = next((m for m in data["models"] if m["id"] == "qwen3:8b"), None)
    assert local_model is not None
    assert local_model["provider"] == "local"
    assert local_model["status"] == "unlimited"


def test_select_model(client: TestClient):
    # Select OpenAI GPT OSS 120B
    response = client.post(
        "/api/v1/model-mode/select",
        json={"model_id": "openai/gpt-oss-120b", "provider": "api"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["active_model"] == "openai/gpt-oss-120b"
    assert data["active_provider"] == "api"

    gpt = next((m for m in data["models"] if m["id"] == "openai/gpt-oss-120b"), None)
    assert gpt is not None
    assert gpt["is_active"] is True

    # Select Local Model
    response = client.post(
        "/api/v1/model-mode/select",
        json={"model_id": "qwen3:8b", "provider": "local"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["active_model"] == "qwen3:8b"
    assert data["active_provider"] == "local"


def test_toggle_mode(client: TestClient):
    # Toggle to API
    client.post(
        "/api/v1/model-mode/select",
        json={"model_id": "qwen/qwen3.8-27b", "provider": "api"},
    )

    response = client.post("/api/v1/model-mode/toggle")
    assert response.status_code == 200
    assert response.json()["mode"] == "local"

    response = client.post("/api/v1/model-mode/toggle")
    assert response.status_code == 200
    assert response.json()["mode"] == "api"


def test_token_quota_tracker_usage():
    tracker = TokenQuotaTracker()

    model_id = "groq/compound-mini"
    initial_info = tracker.get_model_info(model_id)
    assert initial_info.remaining_daily_tokens == 500000
    assert initial_info.percentage_remaining == 100.0

    # Record 50,000 tokens
    tracker.record_usage(model_id, total_tokens=50000, prompt_tokens=30000, completion_tokens=20000)

    updated_info = tracker.get_model_info(model_id)
    assert updated_info.used_today_tokens == 50000
    assert updated_info.remaining_daily_tokens == 450000
    assert updated_info.percentage_remaining == 90.0
    assert updated_info.status == "available"


def test_token_quota_tracker_exhaustion():
    tracker = TokenQuotaTracker()
    model_id = "groq/compound"

    tracker.record_rate_limit(model_id, is_tpd=True)
    info = tracker.get_model_info(model_id)
    assert info.status == "exhausted"
    assert info.remaining_daily_tokens == 0
    assert info.percentage_remaining == 0.0
