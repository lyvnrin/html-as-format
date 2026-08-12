# HTML as a Format

Turn a PowerPoint, PDF, or transcript into a polished, interactive HTML page. Drop a file in, pick an output format, get back a standalone page with theming, dark mode, and PDF export built in — ready to share as a link or display on a Pace Port touchscreen.

## How it works

The pipeline has two layers, kept deliberately separate so renderers stay reusable:

1. **Extraction** — `parseFile.js` cracks open the uploaded file (JSZip for `.pptx`, `pdf-parse` for PDFs, plain read for `.txt`) and returns structured per-slide JSON: heading, body paragraphs, and embedded images as base64 blobs.
2. **Captioning** — `captionImages.js` sends each extracted image to Claude's vision model, which returns a business-context caption describing what the image actually shows (not just "a bar chart" but what the bars represent).
3. **Rendering** — the enriched slide array is handed to a renderer skill. Each skill is a `SKILL.md` instruction set paired with an HTML template containing `{{PLACEHOLDER}}` blocks. The server reads both files, sends them to Claude along with the slide data, and Claude fills the template. The result is a single self-contained HTML file.

This is a skills-based architecture rather than a hand-coded generator — the rendering logic lives in natural language instructions that Claude follows, not in procedural code that builds HTML strings. Adding a new output format means writing a new skill and template, not a new code path.

## Output formats

Three renderers are active:

- **Timeline:** interactive vertical timeline, one node per slide, alternating left/right with expandable detail panels. Best for sequential decks where slide order carries meaning. Uses a standalone lean extraction call (text-only, no images).
- **Magazine:** Pinterest-style masonry grid of image cards and solid accent tiles. Click a card to open a detail overlay with the full slide content. Best for image-heavy decks. Consumes the raw enriched slide array directly because it needs real embedded images.
- **Bubble Map:** organically clustered bubble map where every slide is a parent bubble sized by content weight. Click to expand child bubbles (one per body paragraph, one per image). Best for exploring themes and relationships non-linearly. Also consumes the raw enriched slide array.

All renderers share the same interactive chrome: a 5-colour theme picker (blue default), dark/light mode toggle, and a working PDF export button.

## Project layout

```
assets/              shared static assets
docs/                project documentation (overview, research, design, development)
frontend/            React + Vite — drop zone, format picker, output viewer
server/              Express API — file parsing, image captioning, Claude orchestration
  lib/
    parseFile.js       .pptx/.pdf/.txt → structured JSON (JSZip, pdf-parse)
    captionImages.js   image blobs → VLM-generated captions via Claude
  index.js             API routes, skill/template loading, renderer dispatch
skills/              rendering logic — each skill is a SKILL.md + HTML template
  render-timeline/       timeline renderer
  render-magazine/       magazine renderer
  render-bubble/         bubble map renderer
```

## Running locally

You need Node.js and an Anthropic API key.

```bash
# from the repo root
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

npm install
npm run dev
```

This starts the Express server on `localhost:3001` and the Vite dev server on `localhost:5173`. Open the frontend, upload a `.pptx`, `.pdf`, or `.txt` file, pick a format, and it comes back as a rendered HTML page.

## Adding a new format

1. Write a `skills/render-<name>/SKILL.md` describing how to fill the template from the extracted data.
2. Add a matching `assets/<name>-template.html` — copy the shared chrome (theme picker, dark mode, PDF export) from an existing template.
3. Add an API route in `server/index.js`.
4. Set `active: true` for that format in `frontend/src/formats.js`.

See any existing renderer skill for the pattern.

## Tech stack

- **Frontend:** React 19, Vite
- **Server:** Express, Multer (file uploads), JSZip (PPTX parsing), pdf-parse
- **Generation:** Anthropic API via `@anthropic-ai/sdk` (Claude Sonnet 4.6)