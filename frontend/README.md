# EV Frontend Workspace

React + TypeScript web application providing an interactive transformation workspace, Semantic Lineage Graph visualizer, Source Integrity conflict review, Content DNA editor, and multi-format deliverable exporter.

---

## 1. Setup and Installation

### Prerequisites

- Node.js 18.0.0 or higher
- `npm`, `pnpm`, or `yarn`

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
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Start Development Server

```bash
npm run dev
```

Open the local server URL, typically `http://127.0.0.1:5173`.

### Production Build and Validation

```bash
npm run lint
npm run build
```

---

## 2. Key Workspace Features

- **Multi-Source Ingestion**: Ingest raw text, `.txt`, `.pdf`, `.docx`, layout images, or URLs.
- **Semantic Lineage Graph Visualizer**: 2D force-directed canvas displaying lineage links connecting raw sources, extracted evidence, Content DNA nodes, and generated deliverables.
- **Source Integrity Review**: Visual review panel for detecting, inspecting, and resolving factual discrepancies across multiple documents.
- **Section-Level DNA Editing**: Edit any Content DNA section with non-destructive server-side synchronization.
- **Format Cloning & Custom Generator**: Upload reference template formats (`.pdf`, `.docx`, image screenshots) to extract structure and generate custom deliverables.
- **Direct Multi-Format Export**: 1-click downloads for Native Microsoft Word (`.docx`), styled PDF, Markdown, and plain text.

