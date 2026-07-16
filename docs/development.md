# Development

## 1. Extraction Skill

Not a standalone skill: a mode inside transcript-to-html (Step 2b)

Rather than building a separate extraction skill, extraction-only mode lives inside transcript-to-html/SKILL.md. When triggered (user asks to extract to JSON, or a renderer skill is the intended downstream consumer), it skips the HTML-writing steps and outputs a structured JSON object instead:

```
{
  "source": { "filename", "type", "slide_count", "extracted_at" },
  "meta": { "title", "subtitle", "author", "date", "topic", "summary" },
  "slides": [{ "index", "heading", "subheading", "body", "bullets", "speaker_notes", "key_stat", "image_description", "layout_hint" }],
  "themes": [],
  "key_moments": [],
  "glossary": []
}
```

This JSON is the contract between the extraction step and every renderer skill — render-timeline is the first consumer.

## 2. Renderer Skills

#### 2.1 render-timeline

Renders a structured JSON artefact (produced by the transcript-to-html extraction skill) as an interactive horizontal timeline HTML page. Each slide or section becomes a node on the timeline — tap or click to expand full content. Designed for both Pace Port touchscreen display and shareable HTML links.

### 2.2 render-gallery

### 2.3 render-bubble

## 3. Frontend

- `DropZone` → upload a .pdf / .pptx / .txt
- `FormatPicker` → six formats defined (formats.js), each with a cover illustration; only Timeline is active: true today — the rest (meeting notes, case study, bubble map, research brief, project update) are UI stubs with no backend wiring yet
- Submits file + chosen format to the Express server (`/api/generate`), which runs the extract → render pipeline and returns the finished HTML

On the in-app skill sync — that's a manual step on your end (copying these SKILL.md/template files into wherever your Claude.ai skill manager points), I don't have access to that surface from here. Happy to diff the repo skills against whatever you currently have there if you paste them in.

## 4. Server / Pipeline

The server is the glue between the frontend upload and the two skills — it doesn't contain any format logic itself, just file parsing and two sequential Claude calls.

- `parseFile.js` — turns the uploaded buffer into plain text before it ever reaches Claude:
  - .pdf → pdf-parse
  - .pptx → unzipped with `JSZip`, text runs pulled straight out of each slide `.xml`
  - .txt → read as-is
- `/api/generate` (single route, moulter memory storage, 25MB cap):
  a. Parse the uploaded file to raw text
  b. Extract: read transcript-to-html/SKILL.md, run it against the raw text in extraction-only mode (Step 2b), get back the structured JSON
  c. Render: read render-timeline/SKILL.md + timeline-template.html, run it against that JSON, get back the final HTML
  d. Return { html } to the frontend
- Both calls hit the same model (claude-sonnet-4-6).
	- The skill markdown + template are just stuffed into the prompt as text, no tool use or file system access on Claude's end; the server reads the files and the model never sees more than what's pasted into the prompt
- Format is currently hard-gated to "timeline". 
	- Any other value 400s, since no other renderer skill exists yet to plug in
- API key loaded from a root-level .env (`gitignored`, never committed)

This is the seam where adding a new format actually lands: a new renderer skill + template gets added to Step 3 of the pipeline, and the `format !== 'timeline' check in server/index.js `gets a new branch.
