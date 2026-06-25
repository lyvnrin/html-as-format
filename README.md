# HTML as a Format

Turn a transcript, PDF, or PPTX into a polished, interactive HTML page instead of a flat document. Drop a file in, pick an output format, get back a standalone HTML file with theming, dark mode, and PDF export baked in.

Right now the pipeline is:

1. Upload a `.pdf`, `.pptx`, or `.txt` file
2. The server extracts the raw text/slide content
3. Claude turns that into structured JSON (title, slides, key moments, themes, etc.)
4. Claude renders the JSON into a format-specific HTML template

## What works today

- **Timeline** — the only active format. Renders the source as an interactive horizontal timeline, one node per slide/section, with expandable panels.

The other formats (meeting notes, case study, bubble map, research brief, project update) are stubbed out in the frontend's format picker but not wired up on the backend yet — selecting them won't do anything until a renderer skill exists for each.

## Project layout

```
frontend/        React + Vite app — drop zone, format picker, output viewer
server/          Express API — file parsing + Claude orchestration
skills/          SKILL.md + HTML templates Claude follows to extract and render content
  transcript-to-html/   extracts source content into a structured JSON schema
  render-timeline/      renders that JSON as the timeline HTML page
```

The `skills/` folder is the actual "format" logic — each skill is a markdown instruction set plus an HTML template with `{{PLACEHOLDER}}` blocks. The server reads these files and feeds them to Claude along with the uploaded document.

## Running it locally

You'll need an Anthropic API key.

```bash
# from the repo root
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

npm install
npm run dev
```

This starts the server (`localhost:3001`) and the Vite dev server (`localhost:5173`) together. Open the frontend, drop in a PDF/PPTX/TXT file, pick "Timeline," and it'll come back as a rendered HTML page.

## Adding a new format

1. Write a `skills/render-<name>/SKILL.md` describing how to fill the template from the extracted JSON (see `render-timeline` for the pattern).
2. Add a matching `assets/<name>-template.html` — copy the shared chrome (theme picker, dark mode, PDF export) from an existing template rather than rewriting it.
3. Wire it up in `server/index.js` next to the `timeline` branch.
4. Flip `active: true` for that format in `frontend/src/formats.js`.

## Tech stack

- Frontend: React 19, Vite
- Server: Express, Multer (uploads), `pdf-parse` + JSZip (PPTX text extraction)
- Generation: Claude (`@anthropic-ai/sdk`)
