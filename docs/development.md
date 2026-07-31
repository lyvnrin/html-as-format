# Development

## 1. Formats

Three formats are live in `formats.js`, all `active: true`:

- **Timeline:** vertical timeline with expandable detail. `contentType: 'text'`
- **Magazine:** masonry grid of expandable photo cards. `contentType: 'image'`
- **Bubble map:** clustered, non-linear map. `contentType: 'both'`

`contentType` drives which pipeline path runs on the server. Magazine and bubble map need the actual embedded images, not just text descriptions, so they skip the generic extraction schema and consume the raw slide array straight out of the pptx parser (see Skills below). The frontend also uses `contentType` for the "Is your source file: Text-heavy / Image-heavy / Both" filter in `FormatPicker`, which highlights the recommended format for whatever the user uploaded.

## 2. Extraction layer

Two extractors live in `server/lib/`, both plain code with no model call. Their job is to get source documents into the shared slide schema before anything touches Claude.

### parseFile.js (pptx + txt)

Dispatches by file extension. `.txt` files are returned as-is. `.pptx` files get unzipped with `JSZip` and each slide's XML is regexed directly for headings, body text, and images:

```js
if (/<p:ph[^>]*\btype="(title|ctrTitle)"/.test(shape)) {
  heading = paragraphs.join(' ')
} else {
  body.push(...paragraphs)
}
```

Images are resolved through each slide's `.rels` file, read out of the zip as buffers, and base64-encoded. No model call needed here since PowerPoint XML is already structured.

Output shape per slide: `{ slide, heading, body[], images[] }` where each image is `{ base64, mime_type, caption: '' }`. The empty caption gets filled by the VLM step next.

### extractPdf.js (pdf)

PDFs are messier than PPTX since there's no guaranteed structure. This module uses `pdf-parse` to pull text, images, and page dimensions per page, then runs a heuristic to catch scanned/image-only PDFs before wasting a model call:

```js
function isScanned(textResult) {
  const totalChars = textResult.pages.reduce((sum, p) => sum + p.text.trim().length, 0)
  return totalChars < textResult.pages.length * 5
}
```

Under ~5 characters per page on average almost always means there's no real text layer. OCR isn't supported, so it errors out with a clear message instead of sending garbage to Claude.

If the PDF has text, the page content goes to Claude with the `extract-pdf` skill prompt (see below), which returns structured JSON matching the same `{ slide, heading, body[], images[] }` schema. Images extracted by `pdf-parse` are then re-attached to the right sections by matching page numbers.

### captionImages.js (VLM step)

Runs after either extractor. Iterates through every slide's `images[]` array and sends each one to `claude-sonnet-4-6` as a vision call with a short prompt asking for a factual 1-2 sentence business-context caption. Captions are written back into each image object's `caption` field in place.

Processing is sequential (one image at a time, not batched) since the Anthropic API rate limits concurrent vision calls. The whole function accepts an `AbortSignal` and checks it between images, so if the client disconnects mid-generation the server stops burning API calls immediately.

```js
export async function captionImages(slides, { signal } = {}) {
  for (const slide of slides) {
    for (const image of slide.images) {
      if (signal?.aborted) return slides
      // ... caption via vision call, write to image.caption
    }
  }
  return slides
}
```

If captioning fails for a single image (network blip, content filter), it logs a warning and sets `caption` to an empty string rather than killing the whole pipeline.

## 3. Skills

Five skills live under `/skills/`, each a `SKILL.md` read into a prompt at request time. Full prose isn't reproduced here; these carry a lot of hard-won prompt-engineering detail (rejected approaches, exact constraints, guard rails against common Claude mistakes) that's closer to source code than documentation. Duplicating it here would just mean every skill tweak needs a doc edit too.

### transcript-to-html

Generic extractor. Extraction-only mode (Step 2b in the skill) turns raw source text into a structured JSON contract:

```json
{
  "source": { "filename", "type", "slide_count", "extracted_at" },
  "meta": { "title", "subtitle", "author", "date", "topic", "summary" },
  "slides": [{ "index", "heading", "subheading", "body", "bullets",
               "speaker_notes", "key_stat", "image_description", "layout_hint" }],
  "themes": [], "key_moments": [], "glossary": []
}
```

`image_description` is text-only, so the real image never survives this schema. That's why magazine and bubble map bypass it entirely.

### extract-pdf

Instruction set for Claude to structure raw PDF page text into sections. The actual binary parsing (text extraction, image extraction, scanned-PDF detection) happens in `extractPdf.js` before the skill is invoked. The skill's job is the editorial layer: identifying section boundaries, deciding what counts as a heading vs body text, handling multi-column layouts and tables, and splitting long sections so renderers don't get single slides with walls of text.

### render-timeline / render-magazine / render-bubble

One renderer skill per format, each paired with an HTML template under `assets/`. Timeline consumes the generic JSON schema from `transcript-to-html`. Magazine and bubble both consume the raw enriched slide array from `parseFile → captionImages`, shaped `{ slide, heading, body[], images[] }`, since they need real image data.

Key implementation detail for image handling in magazine and bubble: Claude never sees the raw base64 data. The server replaces each image with a placeholder token (`__IMAGE_SLIDE_<n>__` for magazine, `__IMAGE_SLIDE_<slide>_<n>__` for bubble), Claude writes those tokens into the HTML, and a post-processing step in the server string-replaces each token with the real `data:` URI. This keeps the prompt size manageable and avoids Claude mangling base64 strings.

Bubble map's layout is worth a note since none of it is hand-placed. Each bubble is sized `sqrt(contentWeight)` so *area* (not diameter) tracks how much content a slide carries. The whole cluster is packed with a seeded force-relaxation simulation (random jitter, then ~400 rounds of "pull toward centroid, push apart on overlap") rather than a grid or ring, so it reads as organically clustered instead of mechanically spread out.

Skill files don't auto-sync anywhere; copying `SKILL.md` and template files into the Claude.ai skill manager is still a manual step.

## 4. Frontend

React + Vite, one page. `DropZone` handles upload, `FormatPicker` and `FormatCard` handle choosing a format (each with its own SVG cover illustration), and `App.jsx` wires the two together and calls the API.

Styling is CSS Modules per component plus a shared palette in `index.css`:

- Warm paper background (`--paper #faf9f6`)
- Dark ink text (`--ink #15171c`)
- One blue accent (`--accent #2b5be0`)
- `Inter` for body copy
- `JetBrains Mono` for anything code-like

Deployed to Vercel, but frontend-only. It previews the UI without needing localhost running. API calls use relative paths (`/api/...`), so there's no backend behind that deployment; actually generating a page still needs the Express server running locally.

## 5. Server / API

Express, three routes. They're separate (rather than one route with a format parameter) because magazine and bubble need the raw slide array while timeline needs the intermediate JSON:

- `POST /api/generate` — timeline. Format field is hard-gated; anything other than `'timeline'` returns a 400.
- `POST /api/render-magazine`
- `POST /api/render-bubble`

All three follow the same shape: `multer` (memory storage, 25MB cap) receives the file. `parseFile.js` dispatches by extension (`.pdf` → `extractPdf`, `.pptx` → the JSZip slide parser, `.txt` → read as-is). If the output is a slide array (not plain text), images get captioned via `captionImages.js`. Then the relevant skill + template are pasted into a prompt as plain text, Claude returns HTML, and the server sends it back as `{ html }`.

No tool use or file access on Claude's end. The server does all the reading; the model only ever sees what's included in the prompt.

Every async step in the pipeline (captioning, extraction, rendering) receives an `AbortSignal` created from the HTTP request. If the client disconnects or cancels, the signal fires and each step bails out at its next checkpoint rather than running to completion. This matters because a full pipeline run (caption 6 images + render) can take 30-60 seconds of API calls, and there's no reason to finish if nobody's waiting for the result.

API key loaded from a root-level `.env` (gitignored, never committed). All model calls use `claude-sonnet-4-6`.