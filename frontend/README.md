# EV Frontend Workspace

EV is a professional content transformation workspace. This frontend currently supports source intake, Semantic Lineage Graph construction & review, Source Integrity verification, and section-level editing. Output generation and verified artifact export are fully supported.

## Run locally

From `EV/frontend`:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

The backend must be running separately from `EV/backend`:

```powershell
uvicorn app.main:app --reload
```

## Environment

`VITE_API_BASE_URL` is the public backend URL used by the API client. It defaults to `http://127.0.0.1:8000` when omitted. The frontend never contains or accepts Groq keys.

## Current workflows

- Paste one or multiple text sources and construct the Semantic Lineage Graph.
- Select multiple TXT or PDF files and construct the Semantic Lineage Graph.
- Review the immutable source beside structured Semantic Lineage Graph nodes.
- Inspect and resolve factual discrepancies via Source Integrity.
- Edit semantic sections using partial `PATCH` requests.
- Synchronize outputs across graph revisions.
- Retry or dismiss network and backend errors without exposing tracebacks.

Use the sidebar collapse control on desktop or the menu button on smaller screens.

## Validation

```powershell
npm run lint
npm run build
```

For an end-to-end check, start both servers, paste a source in the intake screen, generate the Semantic Lineage Graph, and edit a section. Confirm the top-right state changes through `Saving...` to `Synced`, then refresh the source through the backend to verify persistence.
