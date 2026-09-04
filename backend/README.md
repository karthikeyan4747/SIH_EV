# EV Backend Application

FastAPI backend service powering the Content DNA extraction, deterministic source integrity verification, multi-format template cloning, and grounded deliverable generation engines.

---

## 1. Setup and Installation

### Prerequisites

- Python 3.12 or higher
- `pip` package manager

### Local Environment Setup

```bash
# 1. Create virtual environment
python3 -m venv .venv

# 2. Activate virtual environment
# macOS / Linux:
source .venv/bin/activate
# Windows:
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
# Inference Mode: "api" (Groq Cloud) or "local" (Ollama)
LLM_MODE=api

# Groq Configuration (for LLM_MODE=api)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# Ollama Configuration (for LLM_MODE=local)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:latest

# Server
HOST=127.0.0.1
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Start Development Server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

### Run Automated Tests

```bash
pytest -v
```

---

## 2. Core Modules

- `app/api/routes/`: REST API endpoints for transformations, sources, Content DNA mutations, conflict resolutions, deliverable generation, and template cloning.
- `app/models/`: Pydantic V2 models for `ContentDNA`, `Claim`, `Conflict`, `Deliverable`, and `Transformation`.
- `app/services/`:
  - `source_integrity.py`: Atomic factual claim extraction, deterministic predicate clustering, functional vs multi-valued attribute differentiation, and conflict sanitization.
  - `output_generation.py`: Deterministic and LLM-grounded artifact synthesis.
  - `template_cloner.py`: PDF, DOCX, and image layout blueprint extraction and grounded deliverable population.
  - `document_chunker.py`: Semantic page-aware document partitioner with token budget constraints.
  - `llm.py`: Multi-key Groq pooling, 8,000 TPM rate limiting, exponential backoff, and Ollama integration.

---

## 3. Docker Deployment

```bash
docker build -t content-transformation-backend .
docker run --rm -p 8000:8000 --env-file .env content-transformation-backend
```

