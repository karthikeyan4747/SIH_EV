# EV Frontend Workspace

React + TypeScript web application providing an enterprise workspace for Content DNA synthesis, interactive Semantic Lineage Graph visualization, Source Integrity conflict review, reference template cloning, and multi-format deliverable presentation.

---

## 1. Setup and Installation

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Package Manager**: `npm`, `pnpm`, or `yarn`

### Local Environment Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment configuration
cp .env.example .env
```

### Environment Configuration

Configure `frontend/.env`:

```env
# Backend API Base URL (Render deployment or local server)
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Start Development Server

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

### Production Build & Linting

```bash
npm run lint
npm run build
```

---

## 2. Key Workspace Capabilities

- **Multi-Source Ingestion**: Ingest raw text, `.txt`, `.pdf`, `.docx`, images, URLs, and YouTube transcripts with live progress indicators.
- **Reference Template-Based Generation**: Upload corporate reference layouts (`.docx`, `.pdf`, or screenshots) to clone their structural hierarchy and synthesize brand-aligned documents grounded strictly in Content DNA.
- **Prompt-Guided Output Generation**: Direct the synthesis engine with natural language prompts (e.g., custom slide counts, specific audience focus, or executive perspectives).
- **Interactive Semantic Lineage Graph**: 2D SVG canvas displaying directional relationship edges connecting raw sources, extracted evidence, Content DNA nodes, and generated deliverables with smooth panning, zooming, and node inspection.
- **Source Integrity Review Panel**: Deterministically detects cross-source factual contradictions, isolates functional single-valued conflicts from multi-valued lists, and purges rejected claims from Content DNA upon resolution.
- **Content DNA Editor & Version Rollback**: Full section-by-section editing with deep recursive merges, automated version history snapshots, and 1-click version restoration.
- **Interactive 16:9 Presentation Deck Viewer**: In-browser PowerPoint viewer with slide navigation, presenter speaker notes, and portaled fullscreen view.
- **Multi-Format Native Exporters**: 1-click downloads for custom-slide PowerPoint (`.pptx`), styled Word (`.docx`), print-ready PDF, Markdown, and plain text.
- **Client-Side State Rehydration**: Automatically mirrors workspace data to `localStorage` and syncs with backend storage (`PUT /api/v1/transformations/{id}`) to withstand ephemeral cloud server restarts.

---

## 3. Production Deployment

### Container Deployment (Docker + Nginx)

The frontend includes a multi-stage `Dockerfile` and optimized `nginx.conf`:

```bash
# Build the image with backend API URL
docker build --build-arg VITE_API_BASE_URL=https://sih-ev-backend.onrender.com -t sih-ev-frontend .

# Run container on port 80 (or 5173)
docker run --rm -p 5173:80 sih-ev-frontend
```

### Cloud Deployment (Vercel)

The repository is pre-configured with `vercel.json`:
1. Connect the repository to Vercel.
2. Select Root Directory as `frontend`.
3. Set Framework Preset to `Vite`.
4. Add environment variable:
   ```env
   VITE_API_BASE_URL=https://sih-ev-backend.onrender.com
   ```
5. Deploy. The pre-configured SPA rewrites ensure client-side routing works on hard refreshes.
