# GenAI Content Transformation Platform Backend

This is the FastAPI backend for SIH Problem Statement 26154. It accepts direct text, TXT files, and PDF files, normalizes them into immutable `RawContent`, and extracts editable, validated Content DNA through Groq's `openai/gpt-oss-120b` model.

## Requirements

- Python 3.12+

## Local setup

From this directory:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GROQ_API_KEY` in `.env` to your own Groq API key. The key is read from the environment and must not be committed.

Start the development server:

```powershell
uvicorn app.main:app --reload
```

The interactive API documentation is available at <http://127.0.0.1:8000/docs>.

The source endpoints are:

- `POST /api/v1/sources/text` - create a source from JSON text
- `POST /api/v1/sources/file` - upload a `.txt` or `.pdf` file
- `GET /api/v1/sources/{source_id}` - retrieve immutable source data and current DNA
- `GET /api/v1/sources/{source_id}/content-dna` - retrieve current DNA
- `PUT /api/v1/sources/{source_id}/content-dna` - replace DNA with a validated object
- `PATCH /api/v1/sources/{source_id}/content-dna` - partially update DNA while preserving omitted fields

The health endpoint is <http://127.0.0.1:8000/health> and returns:

```json
{"status": "ok"}
```

## Docker

Build the image:

```powershell
docker build -t content-transformation-backend .
```

Run it:

```powershell
docker run --rm -p 8000:8000 content-transformation-backend
```

To use another port inside the container, provide `PORT`:

```powershell
docker run --rm -e PORT=8080 -p 8080:8080 content-transformation-backend
```

## Tests

Run the tests from `EV/backend` with:

```powershell
python -m pytest -q
```

The test suite uses a fake LLM provider and never makes a real Groq API call.
