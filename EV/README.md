# EV: GenAI Content Transformation Platform

EV transforms source material into structured, editable Content DNA and then generates communication artifacts from that canonical representation.

## Architecture

- `backend/`: FastAPI application with Pydantic schemas, ingestion providers, Content DNA extraction, transformation storage, output generation, and API routes.
- `frontend/`: Vite React app with the transformation workspace, source intake, DNA network/editor, output panel, version history, and settings/navigation shell.
- Storage is local JSON by default for hackathon deployment simplicity. Backend credentials stay server-side.

## Content DNA

Content DNA is the canonical object between inputs and outputs:

- `identity`
- `overview`
- `entities`
- `facts`
- `findings`
- `recommendations`
- `context`
- `evidence`

Partial DNA edits are merged server-side so changing one nested field does not erase unrelated sections.

## Features

- Isolated transformations with history.
- Clean `New Transformation` creation.
- Text, TXT, PDF, and URL source processing.
- DOCX, PPTX, YouTube, image, video, and audio source records with honest unavailable states.
- Multi-source aggregation into one transformation context.
- Interactive 2D Content DNA network and section editor.
- DNA version history on source processing and saved edits.
- Artifact generation from Content DNA for executive summary, advisory, LinkedIn, and presentation drafts.
- Lightweight transformation search API.

## Environment

Copy `.env.example` to `.env` for backend configuration. Do not place real API keys in frontend files.

Required for LLM extraction:

```bash
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
```

Frontend API URL:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs are available at `http://127.0.0.1:8000/docs`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Testing

```bash
cd backend
pytest
```

```bash
cd frontend
npm run build
```

## Production Notes

- Configure `ALLOWED_ORIGINS` for deployed frontend domains.
- Keep LLM and publishing credentials server-side.
- Local JSON storage is suitable for demos; replace it with a database for multi-user production.
- URL extraction is basic readable HTML/plain-text fetching.
- Media, Office document, YouTube transcript, publishing, and multimodal adapters are modeled but unavailable unless provider-specific services are added.
