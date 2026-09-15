# Development

Consultants get handed a lot of source material (transcripts, decks, PDFs) and have to sit through all of it to dig out the useful bits. This tool turns that raw material into a clean, skimmable HTML page — shared as a standalone link, or shown on a Pace Port touchscreen in client-facing spaces. See `README.md` for setup, the current feature set, and security/rate-limit specifics (not duplicated here).

**Guidelines that shape the extraction/rendering prompts:** never invent quotes or attribute dialogue to real people — paraphrase. Keep summaries tight and specific, no filler, defaulting to a corporate/neutral tone since output may reach colleagues or stakeholders. Source material may include real internal content, so nothing extracted should be dressed up or embellished beyond what's actually on the page.

## 1. Formats

Three formats are live in `frontend/src/formats.js`, all `active: true`:

- **Timeline** — vertical timeline with expandable detail. `contentType: 'text'`
- **Gallery** — masonry grid of expandable photo cards. `contentType: 'image'`
- **Bubble map** — clustered, non-linear map. `contentType: 'both'`

`contentType` only drives the frontend's "Is your source file: Text-heavy / Image-heavy / Both" filter in `FormatPicker` — it doesn't gate anything server-side. All three routes accept any parsed source; Gallery and Bubble Map just happen to need real embedded images to be useful.

## 2. Extraction layer

Two extractors live in `server/lib/`, both plain code with no model call — their job is to get source documents into the shared slide schema before anything touches Claude.

### parseFile.js (pptx + txt)

Dispatches by file extension. `.txt` files are returned as a raw string. `.pptx` files are unzipped with `JSZip`; each slide's XML is regexed directly for headings, body text, and images — no model call needed since PowerPoint XML is already structured:

```js
if (/<p:ph[^>]*\btype="(title|ctrTitle)"/.test(shape)) {
  heading = paragraphs.join(' ')
} else {
  body.push(...paragraphs)
}
```

Before any entry is decompressed, the sum of each zip entry's declared uncompressed size is checked against a 500MB cap (available straight from the zip headers via `JSZip.loadAsync`) — a zip-bomb guard against a small upload that would otherwise blow up server memory.

Images are resolved through each slide's `.rels` file, read out of the zip as buffers, and base64-encoded. Output shape per slide: `{ slide, heading, body[], images[] }`, each image `{ base64, mime_type, caption: '' }` — the empty caption gets filled by the captioning step next.

### extractPdf.js (pdf)

PDFs are messier than PPTX since there's no guaranteed structure. `pdf-parse`'s `PDFParse` class pulls text, images, and page dimensions per page (sequentially — its worker can't service concurrent calls on one instance), then a heuristic catches scanned/image-only PDFs before wasting a model call:

```js
function isScanned(textResult) {
  const totalChars = textResult.pages.reduce((sum, p) => sum + p.text.trim().length, 0)
  return totalChars < textResult.pages.length * 5
}
```

Under ~5 characters per page on average almost always means there's no real text layer; OCR isn't supported, so it errors out with a clear message instead of sending garbage to Claude.

If the PDF has text, the per-page text goes to Claude Sonnet 4.6 with the full `skills/extract-pdf/SKILL.md` prompt (see §5), which returns JSON matching the same `{ heading, body[], pages[] }` shape (plus a `pages` array of source page numbers per section, used to re-attach `pdf-parse`'s own extracted images to the right section afterward).

## 3. Captioning (VLM step)

`captionImages.js` runs after either extractor, for every format — even Timeline, which never embeds the image itself but still uses the caption as text context during extraction. Each image is downscaled to fit 1024px and re-encoded as JPEG via `sharp` before being sent to Claude Haiku 4.5 for a short factual business-context caption; the original full-resolution `image.base64` is left untouched for the final HTML output.

Up to 5 images are captioned concurrently (`runWithConcurrency`), not sequentially — a queue of `{slide, image}` jobs is drained by a fixed pool of workers. The function accepts an `AbortSignal` and checks it before starting each job, so a client disconnect stops new API calls immediately. If captioning fails for a single image (network blip, content filter), it logs a warning and leaves `caption` as an empty string rather than failing the whole pipeline.

## 4. Rendering

Each format fills a hand-authored HTML template (`skills/render-<name>/assets/<name>-template.html`, `{{PLACEHOLDER}}` tokens) — but **Claude does not write the HTML**. Only the two steps that need real judgment go through the model; stamping the result into the template is plain code:

- **Timeline** — one forced-tool-use call to Claude Sonnet 4.6 (`extractTimelineContent`) turns the slides (image binary stripped out, captions kept as text) into a small JSON schema: title, per-slide heading/short-label/subheading/body/bullets/key_stat, and the 3-5 most significant `key_moments`. `renderTimelineHtml` then stamps that JSON into the template — no images are ever embedded.
- **Gallery** — no LLM call at all beyond the shared captioning step. `renderGallery` groups each slide's flat `body[]` array into typed blocks (stat / steps / prose) with regex heuristics (`isStatValue`, `isStepLabel`, `tryConsumeStep`/`tryConsumeStatRun`) and builds one card per image (`galleryImageCardHtml`) or a solid accent tile if the slide has none (`gallerySolidCardHtml`).
- **Bubble Map** — one forced-tool-use call to Claude Sonnet 4.6 (`identifyThemes`) groups slides into 3-8 themes; themes only organize the data (no visual representation in the output). `renderBubble` then stamps a JSON data blob into the template's inline `<script>` (guarded against `</script` breaking out of the tag).

Gallery and Bubble Map both need the real embedded image, not a description of it — the server never sends base64 through a prompt for these. Instead it drops a placeholder token per image (`__IMAGE_SLIDE_<n>_<i>__`) straight into the generated HTML, then does a plain string substitution (`embedGalleryImages` / `embedBubbleImages`) to swap each token for the real `data:` URI after rendering.

## 5. Skills

Skill docs under `/skills/` are no longer uniformly "read into a prompt at request time" — that's true for exactly one of them now:

- **`extract-pdf`** — the only skill still injected into a live Claude prompt. Its job is the editorial layer for PDF structuring: identifying section boundaries, heading vs. body text, multi-column layouts and tables, splitting long sections.
- **`render-timeline` / `render-gallery` / `render-bubble`** — now design-rationale docs, not model input. Each records what shape was tried and rejected for that template (rigid grids vs. organic clustering, card vs. no-card detail panels, etc.) so a future edit to the template or its `render<Name>` function in `server/index.js` doesn't drift back into a rejected pattern. Full prose isn't reproduced here; it's closer to source-code comments than documentation.

Skill files don't auto-sync anywhere; copying `SKILL.md`/template files into the Claude.ai skill manager (for `extract-pdf`) is still a manual step.

## 6. Frontend

React + Vite, one page (`App.jsx`) with two tabs:

- **Generation** — `DropZone` (upload, 75MB client-side cap mirroring the server's) → `FormatPicker`/`FormatCard` (content-type filter pills, per-format `Cover` illustration, a "Preview" link to a static demo under `frontend/public/demos/`) → Generate, which downloads the returned HTML client-side and is logged server-side in the same request.
- **Past Editions** (`PastEditions.jsx`) — lists prior generations from `GET /api/editions`, filters client-side by filename/format, re-downloads via `GET /api/editions/:id`, deletes one or all.

`Grainient.jsx` renders an animated grain-gradient background via WebGL (`ogl`) behind the whole page. `apiHeaders.js` attaches `x-app-token` (from `VITE_APP_TOKEN`) to every `/api` fetch. Styling is CSS Modules per component plus shared palette/font tokens in `index.css` — see the README's Design section for current values, not duplicated here.

The frontend is also deployed to Vercel as a UI-only preview — no backend behind it, so it previews layout/interaction but can't actually generate a page. Real generation still needs the Express server running (locally, or wherever it's hosted) and `VITE_APP_TOKEN`/`ALLOWED_ORIGIN` pointed at each other.

## 7. Server / API

Express app in `server/index.js`. Middleware order: `helmet()` → `cors()` restricted to `ALLOWED_ORIGIN` → `requireAppToken` (timing-safe `x-app-token` check on all `/api/*`) → a general rate limiter on all `/api/*` → a stricter limiter added on top of just the three generation routes.

Routes:
- `POST /api/generate` — Timeline; `format` is hard-gated to `'timeline'`, anything else 400s.
- `POST /api/render-gallery`
- `POST /api/render-bubble`
- `GET /api/editions`, `GET /api/editions/:id`, `DELETE /api/editions/:id`, `DELETE /api/editions` — Past Editions, backed by `server/lib/db.js` (SQLite via the built-in `node:sqlite`, schema in `server/db/schema.sql`). General rate limit only, no per-route limiter.

Every generation route follows the same shape: `multer` (memory storage) receives the file → `parseFile` → `captionImages` if the result is a slide array → the format's own step (extraction/theme-grouping tool call + render function) → `res.json({ html })`. The whole thing is wrapped in `startGenerationLog`/`finishGenerationLog`, so every attempt — completed, cancelled, or failed — lands a row in `generation_logs`, and completed ones store the full `html_content` for Past Editions to serve back later.

`abortSignalForRequest` ties an `AbortController` to the HTTP response's `close` event, so a client disconnect or Cancel click aborts the in-flight Anthropic call(s) at their next checkpoint rather than running to completion — a full pipeline run (captioning several images + a tool-use call) can take real time, and there's no reason to finish paying for it if nobody's waiting.

API key loaded from a root-level `.env` (gitignored). Sonnet 4.6 handles extraction/theme-grouping tool calls; Haiku 4.5 handles image captioning. See the README for the full env var list, upload/rate-limit numbers, and the zip-bomb guard — this doc doesn't repeat those.

## See also

- `docs/design.md` — architecture rationale and renderer interaction design. **Predates this rewrite** — still describes the old "Claude fills the whole template" model and calls Gallery "Magazine"; useful for historical context on layout decisions, not as a current spec.
- `docs/research.md` — background research and format comparisons.
- `assets/architecture-diagrams.png` — pipeline and skill anatomy diagrams (also predates the current rendering split).
