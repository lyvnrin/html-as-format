# HaF: Deployment Guide

This guide takes you from a clean machine to a running local instance.

## Prerequisites

- Node.js 22.5 or later. The generation-history store uses the built-in `node:sqlite` module, which requires this version.
- npm (ships with Node).
- Git.
- An Anthropic API key with access to `claude-sonnet-4-6`.

## Clone and install

Clone the repo and install dependencies. This project has no npm workspaces set up, so install the root, frontend, and server packages separately:

```bash
git clone https://github.com/your-org/haf.git
cd haf

npm install
npm install --prefix frontend
npm install --prefix server
```

## Environment configuration

Create a `.env` file in the repo root:

```bash
cat <<EOF > .env
ANTHROPIC_API_KEY=sk-ant-...
APP_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ALLOWED_ORIGIN=http://localhost:5173
EOF
```

- `ANTHROPIC_API_KEY`: required. Used for all model calls (extraction, captioning, and rendering).
- `APP_SECRET`: required. The server refuses to start without it. Every `/api/*` request must send this value as the `x-app-token` header.
- `ALLOWED_ORIGIN`: optional, comma-separated list of origins allowed by CORS. Defaults to `http://localhost:5173`.
- `HOST`: optional, interface the server binds to. Defaults to `127.0.0.1` (loopback only).
- `PORT`: optional, port the server listens on. Defaults to `3001`.

The frontend needs its own copy of `APP_SECRET` to authenticate its requests. Create `frontend/.env.local`:

```bash
echo "VITE_APP_TOKEN=$(grep APP_SECRET .env | cut -d= -f2)" > frontend/.env.local
```

- `VITE_APP_TOKEN`: required by the frontend. Must match `APP_SECRET` exactly, or every API request will be rejected.

## Running locally

Start both the backend and frontend dev servers from the repo root:

```bash
npm run dev
```

This runs the Express server on `http://localhost:3001` and the Vite dev server on `http://localhost:5173`. Open `http://localhost:5173` in your browser.

To run them separately instead:

```bash
npm run dev --prefix server     # Express on :3001
npm run dev --prefix frontend   # Vite on :5173
```

## Building for production

The frontend has a build step:

```bash
npm run build --prefix frontend
```

This produces a static bundle in `frontend/dist`. The backend does not currently serve this bundle; it only exposes the `/api/*` routes. There is no production build step for the backend itself; run it with `node server/index.js` (or `npm start --prefix server`). For a production deployment, put a static file server or reverse proxy in front of `frontend/dist` and point it at the Express server for `/api/*`. Until that's set up, the dev server (`npm run dev`) is the primary way to run this project.

## Adding a custom renderer format

New renderer formats are auto-discovered; no backend code changes are needed.

1. Create a new folder under `skills/` named `render-{your-format-name}/`.
2. Add two files inside it:
   - `SKILL.md`: layout rules, card types, and interaction behaviour for your format. This documents the design decisions behind your template for whoever edits it next.
   - A template file whose name ends in `template.html` (for example `assets/{your-format-name}-template.html`, matching the pattern the existing renderers use). This is the HTML scaffold, including the shared chrome (dark/light mode toggle and the PDF export button).
3. Restart the server. It scans `skills/` on startup for folders named `render-*` that contain both a `SKILL.md` and a `*template.html` file; a folder missing either file is skipped. Your new format then appears in the frontend's format picker automatically, via `GET /api/formats`.

The extraction JSON schema (documented in `ARCHITECTURE.md`) is the same regardless of format, so a new renderer receives the same slide data as the existing ones.

## Troubleshooting

- **Server exits immediately on start**: `APP_SECRET` is not set in `.env`. Set it and restart.
- **API calls fail with an authentication or model error**: check `ANTHROPIC_API_KEY` is set and has access to `claude-sonnet-4-6`.
- **Frontend requests are rejected**: `VITE_APP_TOKEN` in `frontend/.env.local` doesn't match `APP_SECRET` in `.env`.
- **`node:sqlite` import error on server start**: your Node version is older than 22.5. Upgrade Node.
- **Port already in use**: something else is bound to `3001` or `5173`. Stop it, or set `PORT` in `.env` for the backend, or pass `--port` to Vite for the frontend.
- **New renderer not appearing in the format picker**: confirm the folder is named `render-{format}` under `skills/`, confirm it contains both a `SKILL.md` and a file ending in `template.html`, then restart the server.
