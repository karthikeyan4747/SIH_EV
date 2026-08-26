# EV Frontend Workspace

EV is a professional content transformation workspace. This frontend currently supports source intake, Content DNA review, and section-level editing. Output generation, publishing, voice commands, and authentication are intentionally not implemented.

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

- Paste one or multiple text sources and generate Content DNA for each.
- Select multiple TXT or PDF files and generate Content DNA for each.
- Review the immutable source beside structured Content DNA.
- Edit sections using partial `PATCH` requests.
- Retry or dismiss network and backend errors without exposing tracebacks.

Use the sidebar collapse control on desktop or the menu button on smaller screens. Future navigation is visibly disabled and does not perform fake actions.

## Validation

```powershell
npm run lint
npm run build
```

For an end-to-end check, start both servers, paste a source in the intake screen, generate DNA, and edit a section. Confirm the top-right state changes through `Saving...` to `Synced`, then refresh the source through the backend to verify persistence.
