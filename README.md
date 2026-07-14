# HTML as a Format

Turn a PDF or PPTX into a polished, interactive HTML page instead of a flat document. Drop a file in, pick an output format, get back a standalone HTML file with theming, dark mode, and PDF export baked in.

The pipeline:

1. Upload a `.pdf` or `.pptx` file
2. The server extracts the raw text, slide content, and embedded images
3. Claude structures that into JSON and captions any images
4. Claude renders the JSON into a format-specific HTML template — Timeline, Gallery, or Bubble map

## Project layout

```
frontend/
server/
skills/
  transcript-to-html/
  extract-pdf/
  render-timeline/
  render-gallery/
  render-bubble/
```

The `skills/` folder is the actual "format" logic — each skill is a markdown instruction set plus an HTML template with `{{PLACEHOLDER}}` blocks that the server feeds to Claude alongside the uploaded document.

## Running it locally

You'll need an Anthropic API key.

```bash
# from the repo root
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

npm install
npm run dev
```

This starts the server (`localhost:3001`) and the Vite dev server (`localhost:5173`) together. Open the frontend, drop in a PDF or PPTX file, pick a format, and it'll come back as a rendered HTML page.

## Adding a new format

1. Write a `skills/render-<name>/SKILL.md` describing how to fill the template from the extracted content (see `render-timeline` for the pattern).
2. Add a matching `assets/<name>-template.html` — copy the shared chrome (theme picker, dark mode, PDF export) from an existing template rather than rewriting it.
3. Wire it up as a dedicated route in `server/index.js` (see `/api/render-gallery` or `/api/render-bubble` for the pattern).
4. Add a `Cover` SVG component under `frontend/src/covers/` and register the format in `frontend/src/formats.js`.

## Tech stack

- Frontend: React 19, Vite
- Server: Express, Multer (uploads), `pdf-parse` (PDF text + image extraction), JSZip (PPTX parsing)
- Generation: Claude (`@anthropic-ai/sdk`) — structuring, image captioning, and HTML rendering
