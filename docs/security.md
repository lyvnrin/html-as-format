# Security Notes

Nothing described here is running in production today — the server only runs locally (or wherever someone manually starts it), and the Vercel deployment is frontend-only with no backend behind it (see `architecture.md`). This is a pre-production checklist, not a review of a live, already-exposed system.

## Already in place

- **Auth** — every `/api/*` route requires an `x-app-token` header matching `APP_SECRET`, compared with `crypto.timingSafeEqual` (`server/index.js`) — guards against timing attacks and casual unauthenticated access.
- **Headers/CORS** — `helmet()` sets baseline hardening headers; `cors()` restricts browser-origin requests to the `ALLOWED_ORIGIN` allowlist.
- **Input limits** — 75MB upload cap (Multer), a 500MB pre-decompression zip-bomb guard on `.pptx` (checked from zip headers before any entry is decompressed), and `express-rate-limit` on both the generation endpoints (30 req / 15 min) and all `/api/*` routes generally (300 req / 15 min).
- **Output escaping** — every piece of extracted text stamped into a generated page (headings, body, bullets, captions, stats) goes through `escapeHtml()` first; the Bubble Map's inline JSON data blob is additionally guarded against a literal `</script` breaking out of its `<script>` tag.
- **Bind address** — the server defaults to `127.0.0.1` (`HOST` env var), not `0.0.0.0` — not reachable from outside the host unless someone deliberately widens it.

## Needs attention before production

### 1. `APP_SECRET` isn't actually secret once the frontend ships

`VITE_APP_TOKEN` is a Vite env var — it gets compiled directly into the client-side JS bundle at build time. Anyone who opens devtools on the deployed frontend (or just reads the bundled JS) can read it. In its current form, `x-app-token` functions as "keep casual/scripted traffic off the API," not "keep out anyone who isn't authorized" — and the server having no other identity check means it can't tell the difference between the real frontend and anyone who copied that token out of it. Don't treat "the request carries the token" as proof of who's calling.

If real access control is a requirement, that means per-user auth (session/JWT tied to an actual identity — SSO, most likely) in front of or instead of the current shared static token.

### 2. No per-user identity anywhere

There are no user accounts, and — per #1 — the one token everyone shares is effectively public once the frontend is deployed. Past Editions has no ownership concept: anyone holding the token can list, download, or delete *anyone else's* generated history via `/api/editions*`. If more than one person or team is meant to use this, that's a real gap.

### 3. Generation history persists extracted content indefinitely, unencrypted

`server/data/generation_logs.db` stores the complete rendered HTML — i.e. the full extracted transcript/deck content, verbatim — for every successful generation, forever, with no retention window and no encryption at rest. Given source material may include real internal or confidential content, this SQLite file is the most sensitive thing in the system, and today it's just a plaintext file on disk with no expiry.

Before production: decide a retention policy (a cleanup job, or a mode that logs metadata only and skips storing `html_content`), and make sure wherever `server/data/` lives is itself access-controlled and ideally encrypted at rest.

### 4. Extracted content leaves the org boundary to Anthropic's API

Every embedded image goes to Claude for captioning; every PDF's text goes to Claude for structuring; every deck's content goes to Claude for Timeline extraction or Bubble Map theme grouping. That's inherent to how this tool works, but two things follow: confirm your organization's actual data-processing/retention terms with Anthropic cover this use case rather than assuming — check the current agreement, since terms and defaults can change. And there's currently no content-sensitivity screening anywhere in the pipeline — anything dropped into the upload box gets sent, unfiltered. If some source material is too sensitive to leave the building at all, that gate doesn't exist yet.

### 5. Rate limiting is in-memory and per-process

`express-rate-limit`'s default store lives in the Node process's own memory. That's fine for one long-running process; deployed as multiple instances or serverless functions, each instance keeps its own independent counter — the real effective limit multiplies by instance count, and resets on every cold start. If horizontal scaling is part of the production plan, the limiter needs a shared store (e.g. Redis) or the numbers above are closer to decorative than enforced.

### 6. No TLS termination in the app itself

Express serves plain HTTP; nothing in this codebase handles HTTPS. Normal for local dev, but it means whatever hosts this in production (reverse proxy, platform load balancer, etc.) has to be the thing terminating TLS — worth calling out explicitly so it isn't silently assumed to already be covered.

### 7. `.env` / token rotation

`.env` and `frontend/.env.local` are both gitignored, which is correct, but there's no rotation story for `APP_SECRET` beyond generating a new value and updating both files by hand. Because of #1, rotation cadence matters more here than for a typical server secret: anyone who captured the token from a previous frontend build keeps working access until it's actually rotated, not just until they'd "normally" lose access.

## Not a concern today, but worth protecting going forward

- `ANTHROPIC_API_KEY` never reaches the browser — it's read server-side only, each of `server/index.js`, `server/lib/extractPdf.js`, and `server/lib/captionImages.js` constructing its own `Anthropic` client from it. That boundary is solid as-is; just make sure no future change (e.g. a client-side "call Claude directly" experiment) ends up putting it in a `VITE_`-prefixed variable, which would ship it straight into the bundle like `APP_SECRET`.
- Multer uses memory storage, so raw uploaded files are never written to disk — only what gets *derived* from them (the extracted/rendered content in `generation_logs.db`, see #3) persists.
