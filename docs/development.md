# Development

## 1. Formats

Three formats are live in `formats.js`, all `active: true`:

- **Timeline** — vertical timeline with expandable detail. `contentType: 'text'`
- **Gallery** — masonry grid of expandable photo cards. `contentType: 'image'`
- **Bubble map** — clustered, non-linear map. `contentType: 'both'`

`contentType` isn't cosmetic — gallery and bubble map need the actual embedded images, not just text descriptions of them, so they skip the generic extraction schema entirely and consume the raw slide array straight out of the pptx parser instead (see Skills below).

## 2. Skills

Five skills live under `/skills`, each a `SKILL.md` read into a prompt at request time. Full prose isn't reproduced here — these carry a lot of hard-won prompt-engineering detail (rejected approaches, exact constraints) that's closer to source than documentation, and duplicating it here just means every skill tweak needs a doc edit too. What each does, and where the real thing lives:

### transcript-to-html
Generic extractor + timeline renderer. Extraction-only mode (Step 2b) turns raw source text into the shared JSON contract:
```json
{
  "source": { "filename", "type", "slide_count", "extracted_at" },
  "meta": { "title", "subtitle", "author", "date", "topic", "summary" },
  "slides": [{ "index", "heading", "subheading", "body", "bullets", "speaker_notes", "key_stat", "image_description", "layout_hint" }],
  "themes": [], "key_moments": [], "glossary": []
}
```
`image_description` is text-only — the real image never survives this schema, which is why gallery and bubble map bypass it.

### extract-pdf
Structures raw PDF page text into sections. The actual parsing happens in `server/lib/extractPdf.js` via the `pdf-parse` npm package (not Python) — pulls text, images, and page dimensions per page, then a heuristic decides whether there's anything worth sending to Claude at all:
```js
function isScanned(textResult) {
  const totalChars = textResult.pages.reduce((sum, p) => sum + p.text.trim().length, 0)
  return totalChars < textResult.pages.length * 5
}
```
Under ~5 characters/page on average almost always means the PDF is scanned/image-only with no real text layer — OCR isn't supported, so it errors out instead of sending garbage. Otherwise, the page text goes to Claude with the extract-pdf skill prompt to get structured JSON back, and images get re-attached afterward by matching page numbers.

### pptx parsing (not a skill — plain code)
No model call needed here since PowerPoint XML is already structured. `server/lib/parseFile.js` unzips the `.pptx` with `JSZip` and regexes each slide's XML directly for headings and body text:
```js
if (/<p:ph[^>]*\btype="(title|ctrTitle)"/.test(shape)) {
  heading = paragraphs.join(' ')
} else {
  body.push(...paragraphs)
}
```
Images are pulled the same way — resolved through each slide's `.rels` file, read out of the zip, and base64-encoded — before anything reaches Claude.

### render-timeline / render-gallery / render-bubble
One renderer skill per format, each paired with an HTML template under `assets/`. Timeline consumes the generic JSON schema above. Gallery and bubble both consume the raw enriched slide array from `parseFile → captionImages` instead — `{ slide, heading, body[], images[] }` — since they need the real image data, not a text description of it.

Bubble map's layout is worth a note since none of it is hand-placed: each bubble is sized `sqrt(contentWeight)` so *area* (not diameter) tracks how much content a slide has, then the whole cluster is packed with a seeded force-relaxation simulation — random jitter, then ~400 rounds of "pull toward centroid, push apart on overlap" — rather than a grid or ring, so it reads as organically clustered instead of mechanically spread out.

Skill files don't auto-sync anywhere — copying `SKILL.md`/template files into the Claude.ai skill manager is still a manual step on your end.

## 3. Frontend

React + Vite, one page. `DropZone` handles upload, `FormatPicker`/`FormatCard` handle choosing a format (each with its own cover illustration), `App.jsx` wires the two together and calls the API.

Styling is CSS Modules per component plus a shared palette in `index.css` — warm paper background (`--paper #faf9f6`), dark ink text (`--ink #15171c`), one blue accent (`--accent #2b5be0`), `Inter` for body copy and `JetBrains Mono` for anything code-like. Editorial feel, not app-chrome.

Deployed to Vercel, but frontend-only — just to preview the UI without needing localhost running. API calls are relative paths (`/api/...`), so there's no backend behind that deployment yet; actually generating a page still needs the Express server running locally.

## 4. Server / API

Express, three routes — one per format, since gallery and bubble need the raw slide array while timeline needs the generic JSON:

- `POST /api/generate` — timeline only, format is hard-gated (anything else 400s)
- `POST /api/render-gallery`
- `POST /api/render-bubble`

All three follow the same shape: `multer` (memory storage, 25MB cap) receives the file → `parseFile.js` dispatches by extension (`.pdf` → extract-pdf, `.pptx` → the JSZip slide parser, `.txt` → read as-is) → any images get captioned via a vision call (`captionImages.js`) → the relevant skill + template get stuffed into a prompt as plain text → the model's HTML comes back and gets returned as `{ html }`. No tool use or file access on Claude's end — the server does all the reading, the model only ever sees what's pasted into the prompt.

API key loaded from a root-level `.env` (gitignored, never committed). Both extraction and render calls hit the same model (`claude-sonnet-4-6`).
