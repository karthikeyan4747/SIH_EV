# SIH_EV: Enterprise Multi-Source Content Synthesis & Canonical DNA Deliverables Engine
**System Architecture, Pipeline Design, and Complete Technical Feature Specification**
*Problem Statement: Smart India Hackathon (SIH PS 26154) — Unified Multi-Source Ingestion, Canonical DNA Modeling, Cross-Source Fact Reconciliation, and Multi-Persona Deliverable Synthesis*

---

## 1. Executive Summary & Core Engineering Philosophy

The **SIH_EV** platform is an enterprise-grade intelligent document synthesis and deliverables pipeline. It eliminates the traditional flaws of Large Language Model (LLM) document generation—namely hallucinations, ungrounded extrapolations, and contradictory claims—by introducing a **Canonical Intermediate Representation (IR)** termed **Content DNA**.

Rather than feeding unstructured, raw text directly into a generative prompt, the platform decomposes source documents into an immutable, semantically structured, eight-dimensional knowledge graph. This Content DNA serves as the authoritative single source of truth (SSOT). All downstream assets (video packages, executive briefs, LinkedIn posts, tweets, slide decks, structured advisories, and infographics) are compiled deterministically against this reconciled substrate.

```
+------------------------------------------------------------------------------------------------+
|                                    INGESTION PIPELINE                                          |
|   PDF (pypdf)  |  DOCX (python-docx)  |  Web Pages (BeautifulSoup4)  |  Raw Telemetry (256MB)   |
+------------------------------------------------------------------------------------------------+
                                                |
                                                v
+------------------------------------------------------------------------------------------------+
|                                 CANONICAL CONTENT DNA HUB                                      |
|    - Core Insights     - Statistical Metrics     - Identified Entities     - Strategic Theses  |
|    - Architecture      - Recommendations         - Milestones              - Vulnerabilities   |
+------------------------------------------------------------------------------------------------+
                                                |
                                                v
+------------------------------------------------------------------------------------------------+
|                                SOURCE INTEGRITY & FACT CHECKER                                 |
|    - Single-Valued vs Multi-Valued Clustering    - Number-Word & Currency Normalization        |
|    - Binary Option A/B Reconciliation            - Automated Downstream DNA Purging            |
+------------------------------------------------------------------------------------------------+
                                                |
                                                v
+------------------------------------------------------------------------------------------------+
|                                  DELIVERABLES STUDIO (SSOT)                                    |
|   7 Output Formats  |  7 Persona Parameters  |  23 Indian Languages  |  Template Blueprint Cloner |
|   DOCX / PPTX / PDF (ReportLab) / MD / TXT  |  Live A4 In-Browser Vector PDF Viewer            |
+------------------------------------------------------------------------------------------------+
```

---

## 2. Global Architecture & Backend Micro-Services

The backend is built with Python 3.11+ and FastAPI, designed with modular decoupled services located in `backend/app/services/` and exposed via versioned REST APIs in `backend/app/api/routes/`.

### 2.1 Dual-Engine LLM Orchestration & Token Flow Manager (`llm.py`, `token_manager.py`)
- **Multi-Engine Hybrid Topology**:
  - **Groq Cloud Infrastructure**: High-throughput execution using models such as `llama-3.3-70b-versatile` and `mixtral-8x7b-32768`.
  - **Local Air-Gapped Engine (Ollama)**: Local execution via `llama3`, `mistral`, or `phi3` on `http://localhost:11434` for zero-egress environments.
- **Sliding-Window Rate Limiting (8,000 TPM Compliance)**:
  - Tracks token expenditures with microsecond timestamps in a sliding 60-second window.
  - Pauses execution and sleeps before requests if the token threshold is exceeded, preventing HTTP 429 errors.
- **API Key Pool Rotation & Circuit Breaker**:
  - Supports comma-separated keys (`GROQ_API_KEYS=key1,key2,key3`).
  - Automatically rotates to the next key on 429 or quota exhaustion.
  - Implements exponential backoff (1s, 2s, 4s) with jitter.

### 2.2 Document Ingestion & Boundary Chunker (`ingestion.py`, `document_chunker.py`)
- **Multi-Format Parsing Engine**:
  - **PDF Parser**: Uses `pypdf` with physical page demarcation markers (`--- Page X ---`) to maintain spatial origin.
  - **DOCX Parser**: Uses `python-docx` to extract structural hierarchy, headings, table contents, and text runs.
  - **Web URL Scraper**: Uses `requests` and `BeautifulSoup4` with header spoofing, readability filters, and script/style stripping.
- **Semantic Boundary Chunking**:
  - Eliminates blind character slicing by splitting at logical paragraph, heading, or sentence boundaries.
  - Configurable target chunk size (default: 3,000 characters) with overlap (default: 300 characters).
  - Enforces a 256MB file size ceiling with MIME-type verification.

### 2.3 Content DNA Extraction & Canonical Schema (`chunked_dna.py`, `structure_extraction.py`)
Extracts knowledge into eight orthogonal dimensions with metadata:
1. **Core Insights**: Fundamental conceptual breakthroughs and foundational statements.
2. **Statistical Metrics**: Numerical data points, percentages, KPIs, fiscal metrics, and normalized values.
3. **Identified Entities**: Corporate actors, government bodies, software frameworks, hardware standards, and stakeholders.
4. **Strategic Theses**: Overarching arguments, business strategies, and theoretical frameworks.
5. **Technical Architecture**: System designs, protocols, schemas, stack specifications, and workflows.
6. **Action Recommendations**: Prescriptive steps, risk mitigations, and tactical implementation phases.
7. **Timeline Milestones**: Target deadlines, roadmaps, quarterly goals, and historical benchmarks.
8. **Open Vulnerabilities**: Risks, regulatory hurdles, technical bottlenecks, and acknowledged limitations.

#### Deep-Merge Patcher & Source Lineage:
- Extracts DNA chunks in parallel and deep-merges them into a unified knowledge graph.
- Merges arrays, removes duplicates, and aggregates source citations.
- Every assertion maintains:
  - `source_id`: UUID / filename of origin document.
  - `chunk_index`: Offset index where statement originated.
  - `confidence`: Confidence score (0.00 to 1.00).
  - `timestamp`: Extraction timestamp.

### 2.4 Source Integrity & Fact Reconciliation Engine (`source_integrity.py`)
Identifies contradictions between ingested documents and provides automated reconciliation:
- **Consensus & Clustering Analysis**:
  - Groups overlapping claims across documents by topic and semantic entity.
  - Differentiates between:
    - **Functional Single-Valued Properties**: Attributes that can only have one value (e.g., Q3 Revenue, Founder Name, Headcount). Discrepancies trigger a conflict.
    - **Multi-Valued Set Properties**: Attributes that can coexist (e.g., Features, Recommended Actions, Target Markets). Multiple distinct claims are unioned rather than flagged as contradictory.
- **Normalization & Discrepancy Detectors**:
  - **Number-Word Normalization**: Converts verbal numbers to digits ("forty million" -> `40,000,000`).
  - **Currency & Unit Normalization**: Detects discrepancies across notations (`$40M` vs `USD 50 Million`).
  - **Date Normalization**: Standardizes calendar timestamps into ISO 8601.
- **Binary Conflict Resolution & DNA Purge Workflow**:
  - Visualized as binary option cards: **Option A** vs. **Option B**, plus a **Custom Override** field.
  - When a user resolves a conflict, the system executes an automated DNA purge:
    - Purges discredited assertions from the Content DNA model.
    - Replaces conflicting entries with the approved value.
    - Logs the resolution to the version audit log.

### 2.5 Universal Template-Based Generation & Reference Blueprint Cloner (`structure_extraction.py`, `output_generation.py`)
- **Core Value Proposition**: Generating an output artifact from scratch is time-consuming and resource-intensive. This feature allows the user to upload a pre-existing document as a reference and generates their input in the exact same format and structure, eliminating manual formatting and radically improving efficiency.
- **Reverse-Engineering Engine**: Reverse-engineers target reference documents (DOCX, PDF, PPTX) to extract stylistic and structural DNA:
  - Typographic hierarchies (heading font families, scale ratios, line heights, font weights).
  - Structural layout (section sequence, callout boxes, table structures, margins, header/footer treatments).
  - Color palettes (primary brand color, secondary accent, neutral darks/lights).
  - Slide structures (card layouts, visual element positions, footnote placement, speaker note formats).
- **Zero-Manual-Formatting Synthesis**: Users select their reference blueprint and compile any active Content DNA into the exact layout, styling, and visual rhythm of the reference template. Blueprints can be persisted in the workspace for reusable, automated enterprise reporting.

### 2.6 Deliverables Studio & Multi-Format Exporter (`output_generation.py`)
Compiles Content DNA into 7 output deliverables across 7 persona parameters:

#### The 7 Output Deliverable Types:
1. **Video Package**:
   - Complete video production script.
   - Visual storyboard and scene-by-scene descriptions.
   - Narration text and teleprompter copy.
   - Subtitle tracks and on-screen text overlays.
   - Production advice (B-roll recommendations, pacing, background audio style).
2. **LinkedIn Post**:
   - Professional thought-leadership post.
   - Hook statement, scannable spacing, and call-to-action (CTA).
   - Relevant hashtags and engagement prompts.
3. **Twitter/X Post**:
   - Platform-optimized viral hooks and standalone tweets.
   - Numbered tweet threads (1/N) for complex topics.
   - Concise phrasing within 280-character constraints.
4. **Advisory Document**:
   - Structured risk and strategic advisory memo.
   - Executive posture analysis, risk matrices, and mitigation roadmaps.
   - Actionable implementation timelines.
5. **Infographic Package**:
   - Visual hierarchy, data flow, and narrative direction.
   - Statistical callouts and emphasized metrics.
   - Section-by-section layout instructions for graphic designers.
6. **Executive Summary**:
   - High-level C-suite briefing document.
   - Bottom-Line-Up-Front (BLUF) synthesis.
   - Strategic takeaways, key risks, and resource requirements.
7. **Presentation**:
   - Complete slide deck structure with user-defined slide count (via dynamic slider).
   - Slide titles, categorized bullet points, visual layout recommendations, and speaker notes.

#### The 7 Persona Customization Parameters:
1. **AI Model Selection**: Switch between Groq Cloud models and local air-gapped Ollama models.
2. **Target Audience**: C-Level Executives, Technical Engineers, General Public, Investors, Policy Makers, Academic Researchers.
3. **Tone**: Authoritative, Conversational, Technical / Rigorous, Persuasive, Objective / Neutral.
4. **Language**: Full support for all 23 official Indian languages plus English:
   - *Assamese, Bengali, Bodo, Dogri, English, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu, Urdu.*
5. **Level of Detail**: High-Level Overview, Standard Executive, Deep-Dive Technical.
6. **Communication Objective**: Inform & Educate, Persuade & Convert, Risk Alert / Advisory, Policy Compliance.
7. **Content Style**: Bullet-Point Digest, Narrative Storytelling, Analytical / Data-First, Formal Corporate.

#### Multi-Format Export Pipelines:
- **DOCX**: Native Word documents generated using `python-docx` with styled headers, custom margins, formatted tables, and callout blocks.
- **PPTX**: Native PowerPoint presentations generated using `python-pptx` with 16:9 widescreen slides, content cards, and speaker notes.
- **PDF**: Vector-grade PDF generation using ReportLab with running headers, footers, pagination, and document metadata.
- **Markdown (`.md`)**: GitHub-flavored markdown with clean typography, tables, and code formatting.
- **Plain Text (`.txt`)**: Clean, formatted text for terminal or archival use.

### 2.7 Workflow Presets Engine (`workflows.py`)
- Enables saving, loading, and deleting multi-parameter workflows.
- Serializes deliverable type, persona parameters, model choices, and slide counts into reusable templates.

### 2.8 Immutable Version Snapshots & Audit Trail (`api/routes/dna.py`)
- Every modification to Content DNA creates an immutable snapshot.
- Generates human-readable delta changelogs (e.g., *"Reconciled Q3 Revenue from $40M to $50M via Source A"*).
- Supports instant, non-destructive rollback to any prior state.

---

## 3. Frontend Architecture & Stage-by-Stage UI/UX

The frontend is built with React 18, TypeScript, Tailwind CSS, Vite, and Lucide Icons, located in `frontend/src/`.

### 3.1 Design System & Shell
- **Color Palette**: Slate & Tech Cobalt (`#0f172a`, `#1e293b`, `#3b82f6`, `#0284c7`).
- **Visual Design**: Strict avoidance of arbitrary purple gradients; uses neutral dark/light surfaces with high-contrast borders and clear typographic hierarchies.
- **Shell Navigation**:
  - Top header with inline project title editor and real-time auto-save indicator.
  - Workflow navigation across four sequential stages:
    1. Sources
    2. Content DNA
    3. Source Integrity
    4. Deliverables Studio

### 3.2 Stage 1: Sources Ingestion (`SourcesStage.tsx`)
- Multi-file drag-and-drop zone (PDF, DOCX, TXT) alongside a URL web scraper input.
- Real-time file processing states: Ingesting, Parsing, Chunking, Ready.
- Telemetry readouts: Total characters parsed, token approximations, chunk distribution count, and source removal actions.

### 3.3 Stage 2: Content DNA Hub (`ContentDNAStage.tsx`)
Features four distinct view modes for inspecting the canonical knowledge base:
1. **Semantic Lineage Graph (`SemanticLineageGraphVisualizer.tsx`)**:
   - Interactive SVG canvas with a 4-tier hierarchical DAG:
     - `Tier 1: Document Root`
     - `Tier 2: DNA Dimension`
     - `Tier 3: Assertion Block`
     - `Tier 4: Fact Entity`
   - Interactive zoom/pan, hover tooltips, and source connection lines.
2. **Double-Helix 3D Canvas (`ContentDNAStructure.tsx`)**:
   - Real-time 3D particle double-helix animation visualizing data compilation.
3. **Attribute Inspector (`DNAInspector.tsx`)**:
   - Tabbed inspector across all 8 DNA dimensions.
   - Text search filtering, confidence level badges, and source attribution tags.
4. **DNA Version Timeline (`DNAVersionTimelineView.tsx`)**:
   - Visual chronological timeline of all DNA revisions.
   - Semantic delta diffs explaining exact field changes.
   - One-click rollback button to restore earlier versions.

### 3.4 Stage 3: Fact Integrity & Audit (`IntegrityStage.tsx`)
- **Metric Gauges**: Visual consensus metrics, overall agreement score, and conflict counter.
- **Binary Conflict Cards**: Side-by-side comparison of conflicting statements with source citations, evidence snippets, and resolution buttons (`Accept Option A`, `Accept Option B`, `Custom Resolution`).
- **Raw Assertions Audit Table**: Searchable, filterable list of all extracted assertions across all sources.

### 3.5 Stage 4: Deliverables Studio (`StudioStage.tsx`)
- **Deliverable Selector Grid**: Interactive cards for selecting from the 7 output types.
- **Persona Parameter Matrix**: Dropdown selectors for all 7 persona parameters (Model, Audience, Tone, Language, Detail, Objective, Style).
- **Slide Count Slider**: Appears when "Presentation" is selected, allowing configuration from 3 to 20 slides.
- **Template Blueprint Cloner Modal (`CloneTemplateModal.tsx`)**: Allows uploading a target document or presentation to clone its layout and style.
- **Custom Workflow Presets**: Dropdown to load saved presets and modal to save current parameter combinations.
- **Live A4 Document PDF Viewer (`DocumentPdfViewer.tsx`)**:
   - In-browser vector PDF renderer using Mozilla `pdfjs-dist`.
   - Real-time rendering of generated deliverables.
   - Page-by-page navigation, zoom controls, fit-to-width toggle, and jump-to-page input.
- **Multi-Format Export Dropdown (`ArtifactDownloadDropdown.tsx`)**:
   - Download deliverables as `.pdf`, `.docx`, `.pptx`, `.md`, or `.txt`.

### 3.6 Root-Level Viewport-Relative Portals
All modal dialogs (`ModelSelectorModal`, `WorkflowSaveModal`, `VersionHistoryModal`, `CloneTemplateModal`) are rendered via React `createPortal(..., document.body)`.
- Styled with `position: fixed`, `inset: 0`, and `z-[9999]`.
- Uses dynamic viewport height units (`100dvh`) with `margin: auto`.
- Prevents modal clipping, z-index layering issues, and scrolling misalignment.

---

## 4. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sources/upload` | Upload PDF, DOCX, or TXT source documents (up to 256MB). |
| `POST` | `/api/sources/url` | Scrape and ingest clean text from a public web page. |
| `GET` | `/api/sources/` | List all ingested sources and their chunk metrics. |
| `DELETE` | `/api/sources/{id}` | Remove a source document and purge its associated chunks. |
| `POST` | `/api/dna/extract` | Run parallel extraction across chunks into the 8 DNA dimensions. |
| `GET` | `/api/dna/current` | Retrieve the current canonical Content DNA knowledge graph. |
| `GET` | `/api/dna/versions` | List all version history snapshots with delta descriptions. |
| `POST` | `/api/dna/rollback` | Roll back Content DNA to a specified version snapshot. |
| `GET` | `/api/integrity/check` | Analyze sources for contradictions and return conflict clusters. |
| `POST` | `/api/integrity/resolve` | Resolve a conflict (Option A, Option B, or Custom) and purge discredited DNA. |
| `POST` | `/api/templates/clone` | Extract styling and structural blueprint from an uploaded reference file. |
| `GET` | `/api/workflows/` | Retrieve all saved persona and output generation workflow presets. |
| `POST` | `/api/workflows/` | Save a new custom workflow preset. |
| `DELETE` | `/api/workflows/{id}` | Delete an existing workflow preset. |
| `POST` | `/api/deliverables/generate` | Compile Content DNA into any of the 7 deliverables using selected parameters. |
| `GET` | `/api/deliverables/export` | Download a generated deliverable formatted as DOCX, PPTX, PDF, MD, or TXT. |

---

## 5. Test Suite & Verification Summary

The platform includes a test suite covering backend logic and frontend builds:
- **Backend Test Suite**: 78 tests across chunking logic, token manager limits, schema validation, fact reconciliation, and document export:
  ```bash
  cd backend && venv/bin/pytest -v
  # 78 passed in 8.42s
  ```
- **Frontend TypeScript Build**: Full compile-time validation with strict TypeScript checking:
  ```bash
  cd frontend && npm run build
  # 0 errors, production bundle compiled cleanly
  ```

---
*Documented and verified for the SIH_EV Enterprise Synthesis Platform.*
