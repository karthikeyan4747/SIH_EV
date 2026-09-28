# EV Transformation Workspace: Standalone Judge Evaluation Demo

An exact, 100% standalone replica of the EV Transformation application pre-loaded with authentic Next-Gen Solid-State Battery engineering data.

Designed specifically for jury presentations and evaluation:
* **Zero Backend Dependency**: Runs entirely in the client browser with an in-memory and local storage state engine.
* **Zero Latency & Zero Downtime Risk**: No external API keys, no Groq rate-limiting (HTTP 429), and zero server cold-start delays.
* **Exact Cockpit Design**: Identical Obsidian and Cobalt layout, 4-stage stepper, telemetry, typography, and controls as the production application.
* **Rigorous Engineering Dataset**: Real automotive specifications (800V SiC inverters, ceramic solid-state electrolytes, 12.4-minute charging, 310 vs 285 Wh/kg conflict).
* **Zero Em Dashes**: Strictly formatted without em dashes throughout all content and code.

---

## Quick Start

### Option 1: Local Development Server
```bash
# Navigate to the demo directory
cd demo-app

# Launch the Vite development server (starts on http://localhost:5173)
npm run dev
```

### Option 2: Production Preview
```bash
# Build and preview production assets
cd demo-app
npm run build
npm run preview
```

### Option 3: Deploy as a Static Site
The `demo-app/dist` folder contains static HTML, CSS, and JS bundles that can be deployed instantly to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

---

## Interactive Features for Judges

### 1. Stage 01: Sources & Upload
* **7 Multimodal Inputs**: Pre-loaded with PDF, DOCX, TXT, URL, Video Telemetry, SEM Microstructural Imagery, and Executive Audio Debrief.
* **Add Sources Live**: Judges can click to add custom text, URLs, or upload files with instant local processing and feedback.

### 2. Stage 02: Content DNA & Semantic Lineage
* **Semantic Lineage Graph**: Dynamic SVG DAG tracing raw source evidence to 8 semantic dimensions, integrity claims, and deliverable outputs. Includes pan, zoom, category filtering, and attribute selection.
* **Double-Helix Model**: 3D-styled complementary visualizer contrasting source evidence against canonical synthesized DNA.
* **Attribute Inspector**: Real-time field editor and JSON patcher allowing live modification of core claims, facts, and recommendations.
* **DNA Versions Timeline**: 4 immutable historical snapshots with live rollback and restoration capability.

### 3. Stage 03: Fact Integrity & Audit
* **Automated Cross-Source Audit**: Corroborated facts (12.4 min fast charging, $84/kWh pack cost) and supported facts (99.2% SiC inverter efficiency, 65 G deceleration tolerance).
* **Live Conflict Resolution**: Discrepancy between internal laboratory prototype energy density (310 Wh/kg) and supplier production audit (285 Wh/kg).
* **Interactive Resolution Panel**: Judges can select Source A, Source B, or enter a custom value. Resolving updates the claims, excises disputed numbers from DNA, and records a new version snapshot in the audit log.

### 4. Stage 04: Deliverables Studio
* **Interactive 16:9 Slide Deck Viewer**: 5 executive presentation slides with keyboard navigation (Space, Arrow keys), visual directions, and toggleable speaker notes.
* **Engineering Systems Whitepaper**: Full-length technical specification with structured tables, powertrain telemetry, and thermal regulation data.
* **Reference Blueprint Layout Cloning**: Upload any reference document or image to clone its layout hierarchy, section structures, and formatting.
* **Prompt Steering**: Enter custom directives to steer deliverable generation in real time.
* **Multi-Format Client-Side Downloads**: Instant exports to PDF, Word (.docx), PowerPoint (.ppt), Markdown (.md), HTML (.html), and Plain Text (.txt).
* **Model Telemetry & Selector**: Live token quotas (TPM/TPD), speed ratings (842 tok/s), and real-time model switching across Llama 3.3 70B, Llama 3.1 8B, and DeepSeek R1.
