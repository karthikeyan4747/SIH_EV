# EV: Enterprise Content Transformation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.12+](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)
[![Node.js: 18+](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Containers-Docker%20Compose-2496ED.svg)](https://www.docker.com/)

EV is an enterprise content transformation platform designed to ingest multi-format unstructured sources, synthesize a deterministic and editable canonical knowledge layer called **Content DNA**, detect and resolve cross-source factual contradictions, and generate brand-aligned, publication-ready deliverables with strict source provenance and blueprint layout cloning.

Developed for the Smart India Hackathon (Problem Statement 26154).

---

## Table of Contents

1. [Key Innovations & Novel Architecture](#key-innovations--novel-architecture)
2. [Platform Architecture](#platform-architecture)
3. [Core Subsystems](#core-subsystems)
4. [Deployment & Quickstart](#deployment--quickstart)
   - [Option 1: Production Cloud Deployment (Render + Vercel)](#option-1-production-cloud-deployment-render--vercel)
   - [Option 2: Containerized Deployment (Docker Compose)](#option-2-containerized-deployment-docker-compose)
   - [Option 3: Local Bare-Metal Setup](#option-3-local-bare-metal-setup)
5. [Environment Variables Reference](#environment-variables-reference)
6. [REST API Documentation](#rest-api-documentation)
7. [Automated Verification & Testing](#automated-verification--testing)
8. [Directory Structure](#directory-structure)
9. [License](#license)

---

## Key Innovations & Novel Architecture

Traditional generative AI workflows pass raw unstructured source text directly into large language model (LLM) prompts. This direct ingestion causes significant issues in enterprise environments:
- **Hallucination & Drift**: The model extrapolates beyond factual boundaries because it lacks an explicit factual schema.
- **Lost Lineage**: Generated reports cannot trace specific sentences back to the source document, page, or timestamp.
- **Unchecked Contradictions**: When two input documents disagree (e.g., conflicting revenue figures or dates), models either silently invent a number or hallucinate an arbitrary reconciliation.
- **Rigid Output Templates**: Generic generators output plain markdown rather than adhering to established corporate document templates or slide layouts.

EV resolves these challenges through six architectural pillars:

### 1. Intermediate Canonical Knowledge Layer (Content DNA)
Rather than translating sources directly into deliverables, EV normalizes all ingested data into **Content DNA**—a strongly-typed, schema-validated knowledge structure comprising:
- **Identity & Classification**: Title, domain taxonomy, security classification, tone, and audience.
- **Executive Overview**: Problem statements, purpose boundaries, and synthesized executive abstracts.
- **Normalized Entities**: Discovered organizations, key personnel, locations, dates, and domain concepts with deduplication.
- **Atomic Facts**: Empirical metrics, statistical points, financial figures, and chronologies linked to verbatim quotes.
- **Structured Findings & Strategic Recommendations**: Synthesized technical risks, competitive insights, and prioritized action items.
- **Evidence Provenance**: Exact source IDs, page numbers, timestamps, and confidence scores.

> **Why Content DNA Prevents Hallucination**: Downstream synthesis prompts are restricted to querying the validated Content DNA knowledge graph. The LLM is provided explicit atomic facts rather than ambiguous prose, eliminating ungrounded claims.

### 2. Reference Template-Based Generation (Layout Blueprint Cloning)
The core novelty of the generation engine is **Layout Blueprint Cloning**:
- Users upload any existing document format—such as a corporate Word document (`.docx`), a formatted PDF (`.pdf`), or a screenshot/image of an executive slide.
- EV extracts the visual and hierarchical structure (header typography, column layouts, table structures, callout callouts, and slide themes) via multi-modal vision and structural parsers.
- The engine then synthesizes an entirely new deliverable that matches the uploaded blueprint's styling while populating it exclusively with facts from the active workspace's Content DNA.

### 3. Prompt-Steered Synthesis
In addition to source ingestion, users can provide direct natural language steering prompts during generation. For example:
- *"Extract only the CEO's perspective from the quarterly meeting transcript."*
- *"Generate a 5-slide pitch deck focusing strictly on the battery thermal management risks."*
- *"Condense the technical findings into a concise LinkedIn announcement."*

### 4. Deterministic Source Integrity & Conflict Detection Engine
When multiple source documents contradict each other, EV deterministically isolates the disagreement:
- **Functional vs. Multi-Valued Property Classification**: Differentiates single-valued attributes (where differing values constitute an irreconcilable conflict, such as CEO, founding date, or total revenue) from multi-valued attributes (such as programming languages, product features, or partner lists) where distinct values are complementary set members.
- **Strict Binary Conflict Formulation**: Presents discrepancies as clean `Option A` vs. `Option B` cards with exact document excerpts and page citations.
- **Automated Content DNA Sanitization**: Resolving a conflict (by choosing Source A, Source B, retaining both, or providing a custom value) automatically excises the rejected assertion across all Content DNA sections (summary, facts, findings, and entities).

### 5. Multi-Layer DNA Versioning & 1-Click Rollback
Every modification—whether an ingested source, a manual field edit, or a conflict resolution—creates a new immutable DNA version snapshot. Users can review historical diffs and restore any previous version with a single click.

### 6. Multi-Format Native Export & 16:9 Presentation Deck Viewer
- **Custom-Slide PowerPoint (`.pptx`)**: Generates true 16:9 widescreen presentation decks matching user-specified slide counts, complete with slide titles, bullet points, speaker notes, and presentation themes.
- **Native Microsoft Word (`.docx`)**: Exports structured documents with embedded styles, callouts, tables, and headers.
- **Print-Ready PDF**: Rendered with print stylesheets preventing broken tables or awkward page breaks.
- **Interactive Fullscreen Presentation Deck Viewer**: In-browser presentation viewer supporting keyboard navigation, presenter notes, and portaled fullscreen mode.

---

## Platform Architecture

```
[Unstructured Multi-Format Inputs]
  ├── PDF Documents (.pdf)
  ├── Word Documents (.docx)
  ├── Text Files (.txt) & Raw Paste
  ├── Web URLs & YouTube Transcripts
  └── Reference Document / Image Blueprints
                 │
                 ▼
[Ingestion & Chunking Pipeline]
  ├── Token-Aware Semantic Boundary Chunker
  ├── Sliding-Window Token Estimator
  └── Multi-Key Groq Rate-Limiting Dispatcher (8,000 TPM)
                 │
                 ▼
[Source Integrity & Verification Engine]
  ├── Atomic Claim & Predicate Extraction
  ├── Functional vs Multi-Valued Classifier
  └── Deterministic Binary Conflict Resolver
                 │
                 ▼
[Content DNA Canonical Layer] ◄── [DNA Version Snapshots & Rollback]
  ├── Identity & Executive Overview
  ├── Entity Normalization
  ├── Atomic Facts & Verbatim Evidence Quotes
  ├── Findings, Risks & Strategic Recommendations
  └── Interactive Lineage Graph Visualizer
                 │
                 ▼
[Blueprint Cloning & Grounded Generation]
  ├── Reference Template Layout Parser (PDF / DOCX / Vision)
  ├── Prompt-Steered Synthesis Engine
  └── Multi-Channel Deliverable Generators
                 │
                 ▼
[Publication Deliverables]
  ├── Custom-Slide PowerPoint (.pptx)
  ├── Native Microsoft Word (.docx)
  ├── Print-Ready Styled PDF
  └── Markdown & Plain Text
```

---

## Core Subsystems

### 1. Content DNA System
- **Single Source of Truth**: All deliverables are synthesized from this intermediate schema.
- **Recursive Merging**: `PATCH /api/v1/transformations/{id}/content-dna` safely merges user edits into specific sub-sections without overwriting existing provenance data.
- **Local Persistence & Seed Resilience**: The backend auto-seeds demonstration workspaces on startup and supports client-side state rehydration (`PUT /api/v1/transformations/{id}`) to withstand ephemeral cloud restarts.

### 2. Multi-Key Groq TPM Rate Limiter & Fallback Engine
- Free-tier cloud deployments operate within strict rate limits (e.g., 8,000 Tokens Per Minute).
- EV incorporates a sliding-window token tracker that queues requests, computes approximate token footprints, and rotates keys round-robin across `GROQ_API_KEYS`.
- On HTTP 429 status codes, exponential backoff with jitter prevents cascading failures.
- Air-gapped environments can switch `LLM_PROVIDER=ollama` to run entirely offline with local models such as `qwen3:8b`.

### 3. Interactive Lineage Graph
- Built with an interactive 2D SVG canvas.
- Dynamically renders relationship edges connecting raw sources to extracted evidence, Content DNA nodes, and generated deliverables.
- Features smooth viewport panning, focus-based scroll zooming, node filtering, and detailed inspection drawers.

---

## Deployment & Quickstart

### Option 1: Production Cloud Deployment (Render + Vercel)

This architecture hosts the FastAPI backend on **Render** (as a Docker Web Service or Python native service) and the React frontend on **Vercel**.

#### Step 1: Deploy Backend to Render

1. Log in to the [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository (`SIH_EV`).
3. Set the following configuration:
   - **Name**: `sih-ev-backend`
   - **Region**: `Oregon (US West)` or preferred region
   - **Root Directory**: `backend`
   - **Environment**: `Python` (or `Docker` using `backend/Dockerfile`)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, configure:
   ```env
   PYTHON_VERSION=3.11.9
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GROQ_API_KEYS=gsk_key1,gsk_key2,gsk_key3
   GROQ_MODEL=qwen/qwen3.8-27b
   ALLOWED_ORIGINS=*
   ```
5. Click **Create Web Service**. Once deployed, copy your service URL (e.g., `https://sih-ev-backend.onrender.com`).
6. Verify deployment by visiting `https://sih-ev-backend.onrender.com/health` (should return `{"status":"ok"}`).

#### Step 2: Deploy Frontend to Vercel

1. Log in to the [Vercel Dashboard](https://vercel.com/) and click **Add New...** -> **Project**.
2. Import the `SIH_EV` repository.
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   ```env
   VITE_API_BASE_URL=https://sih-ev-backend.onrender.com
   ```
5. Click **Deploy**. Vercel will build the frontend and provide your live production URL (e.g., `https://sih-ev.vercel.app`).

> **Note**: Both `vercel.json` (at root) and `frontend/vercel.json` are pre-configured with SPA route rewrites (`/(.*) -> /index.html`) so refreshing on deep URLs works seamlessly.

---

### Option 2: Containerized Deployment (Docker Compose)

Launch the entire stack (FastAPI backend + Nginx frontend) with a single command:

#### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose installed.

#### Quickstart

1. Clone the repository:
   ```bash
   git clone https://github.com/karthikeyan4747/SIH_EV.git
   cd SIH_EV
   ```

2. Create an environment file `.env` at the project root (or set keys directly):
   ```env
   LLM_PROVIDER=groq
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=qwen/qwen3.8-27b
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. Build and start the containers:
   ```bash
   docker compose up --build
   ```

4. Access the applications:
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Healthcheck**: [http://localhost:8000/health](http://localhost:8000/health)

To run in the background:
```bash
docker compose up -d
```

To stop containers:
```bash
docker compose down
```

---

### Option 3: Local Bare-Metal Setup

#### Prerequisites
- **Python**: Version 3.12 or higher
- **Node.js**: Version 18.0.0 or higher (`npm` / `pnpm`)
- **FFmpeg**: Required for audio/video source transcription (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Ubuntu)

#### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env`:
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

#### 2. Frontend Setup

In a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Ensure `frontend/.env` points to your backend:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the Vite development server:
```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | string | `groq` | Inference backend: `groq` (cloud) or `ollama` (air-gapped local). |
| `GROQ_API_KEY` | string | `""` | Primary Groq API key for cloud inference. |
| `GROQ_API_KEYS` | string | `""` | Comma-separated list of Groq API keys for automated round-robin pooling. |
| `GROQ_MODEL` | string | `qwen/qwen3.8-27b` | Primary Groq model identifier (e.g. `llama-3.3-70b-versatile`). |
| `GROQ_TPM_LIMIT` | integer | `8000` | Tokens-Per-Minute rate limiter threshold per key. |
| `OLLAMA_HOST` | string | `http://127.0.0.1:11434` | Ollama daemon endpoint for local offline inference. |
| `OLLAMA_MODEL` | string | `qwen3:8b` | Ollama model tag for local inference. |
| `PORT` | integer | `8000` | HTTP port for the FastAPI application. |
| `ALLOWED_ORIGINS` | string | `*` | Comma-separated list of allowed CORS origins or `*`. |
| `MAX_UPLOAD_SIZE_BYTES` | integer | `268435456` | Maximum file upload size in bytes (default: 256MB). |

### Frontend (`frontend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | string | `http://127.0.0.1:8000` | Target URL for backend REST API requests. |

---

## REST API Documentation

The backend exposes an OpenAPI 3.0 specification at `/docs`. Below is the complete catalog of endpoints:

### Health & Monitoring
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check; returns status, active provider, and version. |

### Transformation Workspaces
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/transformations` | List all transformations (supports query search and sorting). |
| `POST` | `/api/v1/transformations` | Create a new transformation workspace. |
| `GET` | `/api/v1/transformations/{id}` | Retrieve complete workspace state, Content DNA, sources, and outputs. |
| `PUT` | `/api/v1/transformations/{id}` | Rehydrate/sync transformation from client state (crucial for ephemeral restarts). |
| `PATCH` | `/api/v1/transformations/{id}/title` | Rename transformation workspace. |
| `DELETE` | `/api/v1/transformations/{id}` | Idempotently delete a transformation workspace. |
| `GET` | `/api/v1/transformations/{id}/search` | Semantic search across sources, Content DNA fields, and deliverables. |

### Source Ingestion
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/transformations/{id}/sources/text` | Ingest raw text or meeting transcript. |
| `POST` | `/api/v1/transformations/{id}/sources/file` | Upload and ingest documents (`.pdf`, `.docx`, `.txt`), images, audio, or video. |
| `POST` | `/api/v1/transformations/{id}/sources/url` | Scrape public web page or extract YouTube video transcript. |
| `POST` | `/api/v1/transformations/{id}/sources/unsupported` | Register a placeholder record for unsupported or physical sources. |
| `DELETE` | `/api/v1/transformations/{id}/sources/{source_id}` | Remove a source file and automatically recalculate Content DNA and integrity. |

### Content DNA & Integrity
| Method | Endpoint | Description |
|---|---|---|
| `PATCH` | `/api/v1/transformations/{id}/content-dna` | Perform deep recursive merge of user edits into Content DNA. |
| `POST` | `/api/v1/transformations/{id}/versions/{version}/restore` | Rollback Content DNA to a prior snapshot version. |
| `POST` | `/api/v1/transformations/{id}/integrity` | Run source integrity verification and factual conflict analysis. |
| `POST` | `/api/v1/transformations/{id}/integrity/conflicts/{cid}/resolve` | Resolve a factual conflict; automatically purges rejected assertions from DNA. |

### Deliverable Generation & Template Cloning
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/transformations/{id}/outputs` | Generate standard deliverables (executive summary, slide deck, briefing, social). |
| `POST` | `/api/v1/transformations/{id}/generate-from-template` | Extract layout blueprint from uploaded reference (`.pdf`/`.docx`/image) and synthesize output. |
| `DELETE` | `/api/v1/transformations/{id}/outputs/{output_id}` | Remove a generated deliverable. |
| `POST` | `/api/v1/transformations/{id}/structures` | Register a custom output outline structure. |
| `POST` | `/api/v1/transformations/{id}/structures/reference` | Extract structural outline from an ingested reference source. |
| `GET` | `/api/v1/transformations/workflows` | List pre-packaged workflow templates. |
| `POST` | `/api/v1/transformations/workflows` | Save a new custom workflow template. |

---

## Automated Verification & Testing

### Backend Test Suite
The backend is covered by 78 unit and integration tests verifying schema validation, chunking algorithms, multi-key rate limiters, deterministic conflict detection, and document parsers:

```bash
cd backend
source .venv/bin/activate
pytest -v
```

### Frontend Type Checking & Production Build
The frontend codebase enforces strict TypeScript type safety:

```bash
cd frontend
npm run lint
npm run build
```

---

## Directory Structure

```
SIH_EV/
├── README.md                           # Master project documentation
├── docker-compose.yml                  # Unified multi-container Docker Compose spec
├── render.yaml                         # Render Infrastructure-as-Code blueprint
├── vercel.json                         # Root Vercel SPA routing configuration
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/                 # FastAPI route controllers
│   │   ├── core/                       # Configuration, settings, and logging
│   │   ├── data/
│   │   │   └── seed_transformations.json # Initial demo workspace seed data
│   │   ├── models/                     # Pydantic schemas (Content DNA, Claims, Deliverables)
│   │   └── services/                   # LLM engine, chunking, integrity, and cloner
│   ├── tests/                          # Pytest automated test suite (78 tests)
│   ├── requirements.txt                # Python backend dependencies
│   ├── Dockerfile                      # Production container configuration
│   └── .env.example                    # Backend environment variable template
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── graph/                  # Interactive 2D Lineage Graph visualizer
    │   │   ├── integrity/              # Source Integrity & Conflict resolution UI
    │   │   ├── stages/                 # Pipeline stages (Ingestion, Studio, Deliverables)
    │   │   └── workspace/              # Content DNA editor, PPTX & PDF viewers
    │   ├── lib/
    │   │   ├── api/                    # Typed API client with auto rehydration
    │   │   └── export/                 # PPTX, DOCX, and PDF export handlers
    │   └── types/                      # TypeScript domain definitions
    ├── nginx.conf                      # Nginx production configuration with SPA fallback
    ├── Dockerfile                      # Multi-stage Docker build configuration
    ├── package.json                    # Node dependencies and build scripts
    ├── vite.config.ts                  # Vite build configuration
    └── .env.example                    # Frontend environment variable template
```

---

## License

This project is licensed under the [MIT License](LICENSE).
