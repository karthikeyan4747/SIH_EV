# EV: Enterprise Content Transformation Platform

EV is an enterprise-grade content transformation platform designed to ingest multi-format unstructured sources, synthesize a deterministic and editable canonical knowledge layer called **Content DNA**, verify cross-source factual integrity, and generate publication-ready deliverables with strict source traceability.

---

## 1. Setup and Installation

### Prerequisites

- **Python**: Version 3.12 or higher
- **Node.js**: Version 18.0.0 or higher
- **Package Manager**: `npm`, `pnpm`, or `yarn`
- **Optional**: [Ollama](https://ollama.ai/) (for local air-gapped LLM inference) or a [Groq API Key](https://console.groq.com/) (for cloud inference)

---

### Quickstart Guide

#### 1. Clone the Repository

```bash
git clone https://github.com/karthikeyan4747/SIH_EV.git
cd SIH_EV
```

#### 2. Backend Setup

From the repository root:

```bash
cd backend

# Create and activate a virtual environment
# On macOS / Linux:
python3 -m venv .venv
source .venv/bin/activate

# On Windows (PowerShell):
# python -m venv .venv
# .venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env` with your preferred configuration:

```env
# Inference Mode: "api" (Groq Cloud) or "local" (Ollama)
LLM_MODE=api

# Groq Configuration (Required if LLM_MODE=api)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# Ollama Configuration (Required if LLM_MODE=local)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:latest

# Server Configuration
HOST=127.0.0.1
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Start the FastAPI application:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend server will run at `http://127.0.0.1:8000`.
Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

#### 3. Frontend Setup

In a new terminal window, navigate to the frontend directory:

```bash
cd frontend

# Install dependencies
npm install

# Configure frontend environment variables
cp .env.example .env
```

Ensure `frontend/.env` contains the backend API endpoint:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the Vite development server:

```bash
npm run dev
```

The frontend application will be accessible at `http://127.0.0.1:5173`.

---

### Running Automated Tests

#### Backend Test Suite (Pytest)

The backend test suite verifies schema validation, chunking pipelines, TPM rate limiters, deterministic conflict clustering, multi-valued attribute handling, and format generation:

```bash
cd backend
pytest -v
```

#### Frontend Type Checking and Production Build

```bash
cd frontend
npm run lint
npm run build
```

---

### Docker Deployment

To build and run the backend inside a Docker container:

```bash
cd backend
docker build -t sih-ev-backend .
docker run --rm -p 8000:8000 --env-file .env sih-ev-backend
```

---

## 2. Platform Architecture

The system operates on an intermediate canonical representation model. Rather than passing raw source text directly to downstream generative prompts (which leads to hallucination and loss of traceability), all inputs are ingested, validated, and normalized into **Content DNA** before artifact synthesis occurs.

```
[Raw Sources]
  ├── Text / Plain Text (.txt)
  ├── PDF Documents (.pdf)
  ├── Word Documents (.docx)
  ├── Document Layout Images / Screenshots
  └── Web URLs
          │
          ▼
[Ingestion & Chunking Pipeline]
  ├── Token-Aware Semantic Boundary Chunker
  ├── Rate-Budgeted Key-Pool Dispatcher
  └── Evidence & Excerpt Normalizer
          │
          ▼
[Source Integrity & Verification Engine]
  ├── Atomic Claim Extractor
  ├── Canonical Predicate Taxonomy
  ├── Functional vs Multi-Valued Property Classifier
  └── Binary Conflict Resolver
          │
          ▼
[Content DNA Canonical Knowledge Layer]
  ├── Identity & Overview
  ├── Verified Entities
  ├── Atomic Facts & Evidence Links
  ├── Structured Findings & Risks
  └── Strategic Recommendations
          │
          ├── [Interactive Semantic Lineage Graph]
          ├── [Structured Content DNA Editor]
          │
          ▼
[Grounded Output Generation Engine]
  ├── Format Cloning & Template Parser
  ├── Multi-Channel Deliverables (Executive Summary, Briefing, Social)
  └── Multi-Format Export (Native .docx, Styled PDF, Markdown, TXT)
```

---

## 3. Core Subsystems and Technical Capabilities

### 1. Content DNA System

Content DNA is the central schema and single source of truth for every transformation workspace. It is structured into validated sub-schemas:

- **Identity**: Title, domain category, classification level, target audience, and primary tone.
- **Overview**: Executive summary, purpose statement, problem context, and scope boundaries.
- **Entities**: Discovered organizations, individuals, geographic locations, dates, and domain concepts with cross-alias normalization.
- **Facts**: Core claims, empirical metrics, statistical data points, and temporal chronologies tied to verbatim evidence quotes.
- **Findings**: Synthesis of high-level discoveries, identified risks, technical challenges, and key takeaways.
- **Recommendations**: Actionable strategic initiatives, prioritized milestones, and operational proposals.
- **Evidence**: Traceable citations linking claims directly to source IDs, page numbers, timestamps, and verbatim excerpts.

Partial updates via `PATCH /api/v1/transformations/{id}/content-dna` perform deep recursive merges, ensuring that manual edits to a specific section preserve all other sections and provenance links.

---

### 2. Source Integrity and Conflict Detection Engine

When multiple sources provide contradictory assertions, EV isolates and flags direct factual contradictions for user resolution:

- **Strict Functional Predicate Matching**: Differentiates single-valued properties (where different values represent a factual conflict, such as headcount, founding date, revenue, headquarters, or parent identities) from independent distinct attributes (such as email address vs GitHub profile).
- **Multi-Valued Set Property Recognition**: Recognizes list-based attributes (skills, technologies, spoken/programming languages, certifications, product features, tags, and partner networks). Entities having multiple distinct skills (e.g., Python and React) are treated as complementary members of a set rather than false-positive contradictions.
- **Deterministic Clustered Comparison**: Compares normalized typed representations across numbers, currencies (with multi-unit conversion), temporal dates, calendar days, percentages, and booleans.
- **Strict Binary Conflict Generation**: Consolidates multi-source variations into clean two-option records (`Option A` vs `Option B`) with exact page citations and excerpts.
- **Automated Content DNA Sanitization**: Resolving a conflict automatically excises the rejected assertion from all Content DNA sections (facts, findings, summary, and entities) and re-synchronizes downstream outputs.

---

### 3. Interactive Semantic Lineage Graph

The frontend includes an interactive 2D graph visualizer rendered via SVG canvas:

- **Node Hierarchies**: Distinguishes Source files, Raw Excerpts, Content DNA Sections, and Output Deliverables with distinct color palettes and badge counts.
- **Visual Traceability**: Displays exact directional relationship edges showing how source evidence flows into synthesized DNA and final artifacts.
- **Viewport Controls**: Supports smooth mouse drag panning, contextual scroll zooming (activated on canvas focus), category filtering, node inspection drawers, and full-screen expansion.

---

### 4. Layout Blueprint Cloning and Document Export

Users can upload an existing reference document or image to clone its exact layout structure:

- **Multi-Format Blueprint Extraction**:
  - **PDF (`.pdf`)**: Extracts headings, subheadings, numbered hierarchies, and tabular boundaries via `pypdf`.
  - **Word (`.docx`)**: Analyzes Word heading styles (`Heading 1`, `Heading 2`), paragraph structures, bullet lists, and tables via `python-docx`.
  - **Image / Screenshot**: Utilizes multimodal vision models to extract visual layout hierarchies and structural blocks.
- **Grounded Content Synthesis**: Populates the extracted blueprint layout exclusively with data from the active Content DNA workspace.
- **Native Document Export Engine**:
  - **Microsoft Word (`.docx`)**: Exports clean, fully formatted Word documents with embedded typography, shaded table headers, callout boxes, and list formatting.
  - **Styled PDF**: Generates paginated documents with print stylesheets preventing awkward table splits.
  - **Markdown & Plain Text**: Exports clean GitHub Flavored Markdown and plain text.

---

### 5. Dual-Engine LLM Support & Groq TPM Optimization

The backend features an enterprise-grade LLM execution manager:

- **Groq Cloud Execution**: Employs an 8,000 Tokens-Per-Minute (TPM) budget manager with sliding-window token estimation, sequential queue dispatching, exponential backoff on HTTP 429 status codes, and multi-key round-robin pooling.
- **Document Chunking Engine**: Automatically partitions large documents exceeding context budgets into sequential chunks, preserving page markers and section metadata before synthesizing a unified Content DNA.
- **Air-Gapped Local Inference**: Supports local execution through Ollama for zero-network-egress environments.

---

## 4. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `POST` | `/api/v1/transformations` | Create a new transformation workspace |
| `GET` | `/api/v1/transformations` | List all transformations (supports query search) |
| `GET` | `/api/v1/transformations/{id}` | Retrieve transformation workspace, DNA, and sources |
| `DELETE` | `/api/v1/transformations/{id}` | Delete a transformation workspace |
| `POST` | `/api/v1/transformations/{id}/sources/text` | Ingest raw text source |
| `POST` | `/api/v1/transformations/{id}/sources/file` | Ingest `.txt` or `.pdf` source file |
| `POST` | `/api/v1/transformations/{id}/sources/url` | Fetch and ingest content from a URL |
| `PATCH` | `/api/v1/transformations/{id}/content-dna` | Partially update Content DNA sections |
| `POST` | `/api/v1/transformations/{id}/integrity/conflicts/{cid}/resolve` | Resolve a factual conflict and update DNA |
| `POST` | `/api/v1/transformations/{id}/outputs/generate` | Generate downstream communication artifacts |
| `POST` | `/api/v1/transformations/{id}/generate-from-template` | Generate an artifact matching a reference template |

---

## 5. Directory Structure

```
SIH_EV/
├── README.md                           # Main project documentation
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/                 # FastAPI router endpoints
│   │   ├── core/                       # App configuration and logging
│   │   ├── models/                     # Pydantic schemas (Content DNA, Claims, Deliverables)
│   │   └── services/                   # LLM, chunking, integrity, and template engines
│   ├── tests/                          # Automated Pytest suite (78 test cases)
│   ├── requirements.txt                # Python backend dependencies
│   ├── Dockerfile                      # Backend container configuration
│   └── .env.example                    # Backend environment template
└── frontend/
    ├── src/
    │   ├── components/                 # React UI components (Workspace, Graph, Integrity)
    │   ├── lib/                        # API client and document export utilities
    │   └── types/                      # TypeScript interface declarations
    ├── package.json                    # Frontend package manifest
    ├── vite.config.ts                  # Vite build configuration
    └── .env.example                    # Frontend environment template
```

---

## 6. License and Compliance

This project is developed for the Smart India Hackathon (Problem Statement 26154). Distributed under the MIT License.
