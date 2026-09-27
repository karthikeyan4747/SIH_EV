# EV Backend Engine

Production-ready FastAPI backend service powering the Content DNA extraction, deterministic source integrity verification, multi-format template cloning, and grounded deliverable generation engines.

---

## 1. Setup and Installation

### Prerequisites

- **Python**: 3.12 or higher
- **FFmpeg**: Required for audio/video source transcription (`brew install ffmpeg` on macOS, `sudo apt-get install ffmpeg` on Linux)
- **pip** package manager

### Local Environment Setup

```bash
# 1. Create virtual environment
python3 -m venv .venv

# 2. Activate virtual environment
# macOS / Linux:
source .venv/bin/activate
# Windows (PowerShell):
# .venv\Scripts\Activate.ps1

# 3. Upgrade pip and install requirements
pip install --upgrade pip
pip install -r requirements.txt

# 4. Copy environment configuration
cp .env.example .env
```

### Environment Configuration

Configure `backend/.env`:

```env
# LLM Provider ("groq" or "ollama")
LLM_PROVIDER=groq

# Groq Cloud Configuration (Multiple keys comma-separated for automatic round-robin pooling)
GROQ_API_KEY=gsk_your_primary_key_here
GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_TPM_LIMIT=8000

# Ollama / Air-Gapped Local Inference (Used when LLM_PROVIDER=ollama)
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b

# Server & Network Configuration
PORT=8000
ALLOWED_ORIGINS=*
MAX_UPLOAD_SIZE_BYTES=268435456
```

### Start Development Server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **API Base URL**: `http://127.0.0.1:8000`
- **Interactive Swagger UI**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

### Run Automated Tests

The test suite covers schema validation, chunking algorithms, multi-key rate limiters, deterministic conflict detection, and document parsers:

```bash
pytest -v
```

---

## 2. Architecture & Service Layer

- `app/api/routes/`: REST API controllers for transformations, multi-format source ingestion, Content DNA mutations, conflict resolutions, deliverable generation, and template cloning.
- `app/models/`: Strongly-typed Pydantic V2 schemas for `ContentDNA`, `Claim`, `Conflict`, `Deliverable`, and `Transformation`.
- `app/services/`:
  - `source_integrity.py`: Atomic factual claim extraction, canonical predicate taxonomies, functional vs multi-valued attribute differentiation, and automatic DNA conflict sanitization.
  - `output_generation.py`: Deterministic and prompt-steered synthesis grounded exclusively in Content DNA.
  - `template_cloner.py`: PDF, DOCX, and vision-based image layout blueprint extraction and grounded deliverable population.
  - `document_chunker.py`: Semantic page-aware document partitioner with token budget constraints.
  - `llm.py`: Multi-key Groq pooling, 8,000 TPM rate limiting, sliding window token estimator, exponential backoff, and local Ollama integration.
  - `storage.py`: Local JSON persistence with automatic seed loading from `app/data/seed_transformations.json` and client state sync (`PUT /api/v1/transformations/{id}`).

---

## 3. Production Deployment

### Docker Container

```bash
docker build -t sih-ev-backend .
docker run --rm -p 8000:8000 --env-file .env sih-ev-backend
```

### Cloud Deployment (Render)

The repository includes a ready-to-deploy `render.yaml` specification:
1. Connect this repository to Render as a Web Service.
2. Set Root Directory to `backend`.
3. Set Build Command to `pip install -r requirements.txt`.
4. Set Start Command to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. Provide your `GROQ_API_KEY` (or multiple `GROQ_API_KEYS`) in the environment variables.
