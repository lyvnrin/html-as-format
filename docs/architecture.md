# Architecture Overview

## Stack

- **Frontend** — React 19 + Vite, single page (`frontend/`). Deployed to Vercel as a UI-only preview (no backend there — see `development.md` §6).
- **Server** — Node.js + Express, one process (`server/index.js`). Runs locally (or wherever someone starts it manually); binds to `127.0.0.1` by default, nothing production-hosted yet.
- **Generation** — Anthropic API (`@anthropic-ai/sdk`): Claude Sonnet 4.6 for extraction/theme-grouping tool calls, Claude Haiku 4.5 for image captioning.
- **Storage** — one local SQLite file (`server/data/generation_logs.db`, via the built-in `node:sqlite`) for generation history. Nothing else persists: no user accounts, no other database, uploaded files never touch disk (see below).

## Request flow

```
Browser (React app)
  │  fetch('/api/render-<format>' | '/api/generate', { headers: { x-app-token } })
  ▼
Express server (server/index.js)
  │  requireAppToken  — timing-safe compare against APP_SECRET
  │  generalLimiter, then generateLimiter on the three generation routes
  │  multer            — file received into memory, never written to disk
  ▼
parseFile.js  or  extractPdf.js
  │  .pptx/.txt: pure code (JSZip + regex), zip-bomb guarded, no Claude call
  │  .pdf: pdf-parse + ONE Claude Sonnet call (structures raw page text)
  ▼
captionImages.js
  │  every embedded image → Claude Haiku (vision), 5 concurrent, downscaled via sharp
  ▼
render<Name>  (server/index.js)
  │  Timeline:    ONE Claude Sonnet tool call (extractTimelineContent), then plain JS
  │  Gallery:     plain JS only, no further Claude call
  │  Bubble Map:  ONE Claude Sonnet tool call (identifyThemes), then plain JS
  ▼
db.js (SQLite)
  │  startGenerationLog / finishGenerationLog — logs every attempt;
  │  successful ones store the full rendered HTML as html_content
  ▼
res.json({ html })
  ▼
Browser
  │  downloads the HTML as a file (Blob + <a download>)
  └  "Past Editions" tab reads history back separately via GET /api/editions*
```

Gallery and Bubble Map skip a raw-base64 round trip through the model entirely: the server drops an image placeholder token (`__IMAGE_SLIDE_<n>_<i>__`) into the HTML it builds and does a plain string substitution afterward to swap each token for the real `data:` URI. Claude never sees image bytes for those two formats — only for the captioning step, where it has to.

See `docs/development.md` for what each piece does in more detail; this doc is the map, not the manual.

## Where API keys live

| Key | Lives in | Read by | Reaches the browser? |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | root `.env` (gitignored) | `server/index.js`, `server/lib/extractPdf.js`, `server/lib/captionImages.js` — each constructs its own `Anthropic` client from it | **No** — server-side only |
| `APP_SECRET` | root `.env` (gitignored) | `server/index.js`'s `requireAppToken` middleware | No — but see below |
| `VITE_APP_TOKEN` | `frontend/.env.local` (gitignored), must equal `APP_SECRET` | Vite build, via `apiHeaders.js` | **Yes** — Vite bakes it into the built client JS bundle |

`VITE_APP_TOKEN` and `APP_SECRET` are the same value by convention (the README's setup script derives one from the other), but they're read from two different files by two different processes. Once the frontend is built, that token is visible in the shipped JS — see `docs/security.md` §1 for what that means in practice.

No key of any kind is ever written into `generation_logs.db` or logged to the console.

## External calls

The only outbound network calls the server makes are to `api.anthropic.com`. Per generation request, that's:

- 0–1 calls to structure a PDF (`extractPdf.js`, only for `.pdf` input)
- 0–N calls to caption images (`captionImages.js`, N = number of embedded images, always runs when there are any)
- 0–1 calls to extract Timeline's structured JSON, or group Bubble Map's themes (exactly one of these two, depending on format; Gallery makes none)

Everything else — parsing PPTX/TXT, grouping a Gallery card's body into blocks, stamping any format's JSON into its template — is local code with no network access. Google Fonts is loaded by the *browser* directly (both the frontend app and every generated output page), not by the server.

## Data at rest

- **`server/data/generation_logs.db`** — the only server-side persistent store. Schema in `server/db/schema.sql`: one row per generation attempt (format, source filename, timestamps, status, and — on success — the complete rendered HTML in `html_content`). This is where extracted document content actually lives once a generation completes; see `docs/security.md` §3.
- **Uploaded files** — held in memory only (`multer.memoryStorage()`) for the duration of a single request. Never written to disk, never logged.
