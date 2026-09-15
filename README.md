# HTML as a Format

Turn a PowerPoint, PDF, or transcript into a polished, interactive HTML page. Drop a file in, pick an output format, get back a standalone page with dark mode and a full generation history — ready to share as a link or display on a Pace Port touchscreen.

## How it works

The pipeline has three stages. Only the two steps that genuinely need judgment (understanding a document's structure, grouping slides into themes) call Claude — everything else is deterministic code, so most renderers are fast and don't pay for a model call.

1. **Extraction** — `parseFile.js` cracks open the uploaded file: JSZip + a regex-based XML reader for `.pptx` (guarded against zip bombs — it rejects an archive whose entries would decompress past 500MB before touching any entry's bytes), a plain read for `.txt`. `.pdf` goes through `extractPdf.js` instead: `pdf-parse` pulls per-page text/images, then one Claude call — prompted with the full `skills/extract-pdf/SKILL.md` instructions — structures that text into the same slide-shaped JSON the PPTX path produces. A scanned/image-only PDF with no text layer is rejected outright (OCR isn't supported). Either path returns structured per-slide JSON: heading, body paragraphs, and embedded images as base64 blobs.
2. **Captioning** — `captionImages.js` sends each extracted image (downscaled to 1024px and re-encoded via `sharp`, 5 at a time) to Claude Haiku 4.5, which returns a business-context caption describing what the image actually shows. This runs for every format, including Timeline, since captions feed extraction as text context even where the renderer never embeds the image itself.
3. **Rendering** — each of the three formats fills a hand-authored HTML template (`skills/render-<name>/assets/<name>-template.html`) with `{{PLACEHOLDER}}` blocks:
   - **Timeline** makes one Claude Sonnet 4.6 tool call (`extractTimelineContent`) to turn the slides into a small structured JSON — headings, short glance labels, key stats, the 3-5 most significant moments — then a plain JS function stamps that JSON into the template. No images are embedded.
   - **Gallery** makes no LLM call at all beyond the shared captioning step. `renderGallery` groups each slide's body into stat/step/prose blocks with regex heuristics and stamps one card per image (or a solid accent tile if the slide has none) into the template.
   - **Bubble Map** makes one Claude Sonnet 4.6 tool call (`identifyThemes`) to group slides into 3-8 themes — used only to organize the data, with no visual representation in the output — then `renderBubble` stamps the resulting JSON into the template.

   Each `skills/render-<name>/SKILL.md` is a design-rationale doc for whoever edits that template or render function next — what shape was tried, what was rejected, and why — rather than something sent to Claude at request time. `extract-pdf`'s `SKILL.md` is the one exception: its full text is injected into the PDF-structuring prompt above.

## Output formats

- **Timeline:** interactive vertical timeline, one node per slide, alternating left/right with expandable detail panels. Best for sequential decks where slide order carries meaning.
- **Gallery:** masonry grid (CSS columns) of image cards and solid accent tiles, one card per image. Click a card to open a detail overlay with the full slide content side-by-side. Best for image-heavy decks.
- **Bubble Map:** organically clustered bubble map where every slide is its own bubble, sized by content weight. Click a bubble to grow it in place and reveal its full content; images bloom out as thumbnail circles around it. Has an additional "Connections" toggle for showing/hiding thematic links. Best for exploring themes non-linearly rather than slide-by-slide.

The frontend's format picker also offers a "text-heavy / image-heavy / both" filter that highlights the recommended format for whatever file was dropped, without forcing that choice.

All three output pages share the same chrome: a floating title/author/count panel, a dark/light mode toggle, and a Download PDF button — the PDF button is currently wired up but visually and functionally disabled (`opacity: 0.4; pointer-events: none`) across all three templates, kept in place for when that feature comes back. There is no runtime accent-colour picker in the generated pages; each template ships one fixed accent that mirrors the generator app's own blue.

## Generation history

Every generate click is logged to a local SQLite database (`server/data/generation_logs.db`, gitignored, created on first run via `node:sqlite`) — format, source filename, timing, and the full rendered HTML. The frontend's "Past Editions" tab lists, searches, re-downloads, and deletes these past runs, independent of whatever's currently in the drop zone.

## Design

- **Fonts:** the generator app itself (`frontend/`) uses `PT Serif` for headings/titles (weights 400/700, plus italic) and `IBM Plex Sans` for body/UI text (weights 400/500/600, plus italic 400), both loaded from Google Fonts. The **generated output templates** still use `Source Serif 4` for their own headings — they don't share the app's font tokens, just its colour palette (see below).
- **Palette:** cream, blue, and gold, defined as CSS custom properties in `frontend/src/index.css` — `--paper` `#fafaf6` (cream bg), `--ink` `#2f2f2d` (text), `--accent-light` `#a8cbe8` / `--accent` `#2e6db4` / `--accent-deep` `#1e5a96` (blue scale), and `--gold` `#b86e3a`. Swapped for dark-mode equivalents on `body[data-theme]`.

  The **output templates** (Timeline/Gallery/Bubble Map) mirror this same paper/ink/accent scheme rather than choosing their own — see the palette comment at the top of each template. Dark mode is the default surface there; light mode overrides the `--bg`/`--text` tokens on `body[data-mode="light"]`.

## Project layout

```
assets/              shared static assets (architecture diagrams, notes)
docs/                project documentation (overview, research, design, development)
frontend/            React + Vite app
  src/
    App.jsx            drop zone → format picker → generate/download, plus the Past Editions tab
    components/         DropZone, FormatPicker, FormatCard, PastEditions, Grainient (WebGL background)
    covers/             per-format cover illustrations shown on each FormatCard
    formats.js          the three format definitions (id, contentType, Cover, previewUrl)
    apiHeaders.js       attaches the x-app-token auth header to every /api request
  public/demos/         static pre-rendered previews used by each format card's "Preview" link
server/              Express API — file parsing, image captioning, Claude orchestration
  lib/
    parseFile.js       .pptx/.txt → structured JSON (JSZip, zip-bomb guarded)
    extractPdf.js       .pdf → structured JSON (pdf-parse + one Claude call)
    captionImages.js    image blobs → VLM-generated captions via Claude Haiku
    db.js               SQLite-backed generation history (node:sqlite)
  db/schema.sql          generation_logs table definition
  index.js               API routes, auth/CORS/rate-limit middleware, renderer dispatch
skills/              extraction/rendering design docs, paired with their HTML templates
  extract-pdf/            PDF structuring instructions (actually sent to Claude, see above)
  render-timeline/        timeline renderer template + design rationale
  render-gallery/         gallery renderer template + design rationale
  render-bubble/          bubble map renderer template + design rationale
scripts/
  generate-demo-previews.mjs   fills the real templates with sample content → frontend/public/demos/
```

## Running locally

Requires Node.js 22.5+ (the generation-history store uses the built-in `node:sqlite` module) and an Anthropic API key.

```bash
# from the repo root
cat <<EOF > .env
ANTHROPIC_API_KEY=sk-ant-...
APP_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ALLOWED_ORIGIN=http://localhost:5173
EOF

echo "VITE_APP_TOKEN=$(grep APP_SECRET .env | cut -d= -f2)" > frontend/.env.local

npm install
npm run dev
```

This starts the Express server on `localhost:3001` and the Vite dev server on `localhost:5173`. Open the frontend, upload a `.pptx`, `.pdf`, or `.txt` file, pick a format, and it comes back as a rendered HTML page — downloaded automatically and saved to Past Editions.

Env vars, all set on the server side except the last:
- `ANTHROPIC_API_KEY` — required, all model calls use it.
- `APP_SECRET` — required; every `/api/*` request must send it as the `x-app-token` header, checked with a constant-time comparison. The server refuses to start without it.
- `ALLOWED_ORIGIN` — comma-separated list of origins allowed by CORS. Defaults to `http://localhost:5173`; set it to your deployed frontend's origin(s) if you host this beyond localhost.
- `HOST` — interface the server binds to. Defaults to `127.0.0.1` (loopback only); only widen this if you deliberately need it reachable from outside the host.
- `VITE_APP_TOKEN` (in `frontend/.env.local`) — must match `APP_SECRET`; this is what the frontend sends as `x-app-token`.

## Limits & abuse protection

- **Upload size:** 75MB per file, enforced both client-side and by Multer's `fileSize` limit server-side.
- **Zip-bomb guard:** a `.pptx`'s total decompressed size is checked against its zip headers before any entry is decompressed; anything over 500MB is rejected.
- **Rate limiting:** the three generation endpoints (`/api/generate`, `/api/render-gallery`, `/api/render-bubble`) are capped at 30 requests / 15 min per IP; all `/api/*` routes (including the Past Editions list/read/delete endpoints) share a lighter 300 requests / 15 min cap.
- **Security headers & CORS:** `helmet` sets standard hardening headers; `cors` restricts requests to the `ALLOWED_ORIGIN` allowlist.

## Adding a new format

1. Hand-author `assets/<name>-template.html` under `skills/render-<name>/assets/` — copy the shared chrome (deck-info panel, dark/light toggle, PDF button markup) from an existing template, and use `{{PLACEHOLDER}}` tokens for the content that'll be stamped in.
2. Write `skills/render-<name>/SKILL.md` documenting the template's design decisions and any rejected approaches, for whoever edits it next.
3. Add a `render<Name>` function in `server/index.js` that fills those placeholders from the slide data — pure code, following the pattern in `renderGallery`/`renderTimelineHtml`/`renderBubble`. Only reach for a Claude tool call (like `extractTimelineContent` or `identifyThemes`) if the step genuinely needs semantic judgment a regex can't make.
4. Add a `POST /api/render-<name>` route in `server/index.js`, wired through `startGenerationLog`/`finishGenerationLog` like the existing routes.
5. Add the format to `frontend/src/formats.js` (id, label, description, `contentType`, a `Cover` component from `frontend/src/covers/`, `previewUrl`) with `active: true`.
6. Regenerate its static preview: `node scripts/generate-demo-previews.mjs`.

## Tech stack

- **Frontend:** React 19, Vite, CSS Modules, `ogl` (WebGL) for the animated grain background
- **Server:** Express, Multer (file uploads), JSZip (PPTX parsing), `pdf-parse`, `sharp` (image downscaling), `helmet`, `express-rate-limit`, `node:sqlite` (generation history)
- **Generation:** Anthropic API via `@anthropic-ai/sdk` — Claude Sonnet 4.6 for extraction/theme-grouping tool calls, Claude Haiku 4.5 for image captioning
