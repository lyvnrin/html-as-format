# HaF: Architecture

## System overview

HaF is a two-part app: a React frontend and an Express backend. A user uploads a file and picks an output format in the frontend; the backend extracts structured content from the file, optionally captions any embedded images, then produces a self-contained HTML page through one of three renderers. Each renderer is its own self-contained "skill" folder, so the set of available formats is discovered at server startup rather than hardcoded.

## Architecture diagram

![HaF architecture diagram](assets/architecture-diagram.png)

Full system map, extraction schema, renderer comparison, and skill anatomy.

## Pipeline stages

### Frontend (React 19 + Vite)

The frontend handles file upload and format selection. The format picker calls `GET /api/formats` on mount to get the list of renderers the backend currently has available, rather than a hardcoded list; formats with curated metadata get a bespoke card, anything else falls back to a generic one. While a generation request is in flight, the Generate button's label swaps to "Generating…" and a Cancel button appears alongside it.

### Extraction (`parseFile.js`)

Extraction produces a JSON array of slide objects. Each object has this shape:

```
{
  slide: number,
  heading: string,
  body: string[],
  images: [
    { base64: string, mime_type: string }
  ]
}
```

`.pptx` files are read directly (JSZip plus a regex-based XML reader, guarded against zip bombs). `.txt` files are read as-is. `.pdf` files go through a separate path (`extractPdf.js`): `pdf-parse` pulls raw text and images, then one Claude Sonnet call, prompted with the full contents of `skills/extract-pdf/SKILL.md`, structures that text into the same slide-shaped JSON.

### VLM captioning (`captionImages.js`)

Every extracted image is sent to Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), which returns a short caption describing what the image shows in a business context. This step runs on the output of every extraction path; if a document has no images, no captioning calls are made. Captions are attached to the image objects and feed into the next stage as context, even for renderers that never embed the source image.

### Content structuring and rendering

At this point the pipeline differs by format:

- **Timeline** makes one Claude Sonnet tool call (`extractTimelineContent`) that turns the captioned slides into a small structured JSON: headings, short glance labels, key stats, and the most significant moments. A plain JS function (`renderTimelineHtml`) then stamps that JSON into `skills/render-timeline/assets/timeline-template.html`.
- **Bubble Map** makes one Claude Sonnet tool call (`identifyThemes`) that groups the slides into 3-8 themes. `renderBubble` stamps the slides and themes into `skills/render-bubble/assets/bubble-template.html`.
- **Gallery** makes no LLM call at this stage. `renderGallery` groups each slide's body into stat, step, and prose blocks with regex and word-count heuristics, and stamps one card per image into `skills/render-gallery/assets/gallery-template.html`.

In all three cases the output is a single, complete HTML file with no external dependency at view time.

## Skill anatomy

Every renderer lives in its own `skills/render-<format>/` folder. Two files matter to the pipeline:

- `SKILL.md`: a design-rationale document (layout rules, card types, interaction behaviour, and what was tried and rejected) for whoever edits that renderer's template or render function next. It is not sent to Claude at request time. `skills/extract-pdf/SKILL.md` is the one exception: its full text is injected into the PDF-structuring prompt described above.
- A template file whose name ends in `template.html` (in practice `assets/<format>-template.html` for the three shipped renderers), containing the HTML scaffold, shared chrome, and CSS/JS, with placeholders the render function fills in.

At startup, the backend scans `skills/` for folders named `render-*` that contain both a `SKILL.md` and a `*template.html` file, and exposes that list via `GET /api/formats`. A new renderer becomes available to the frontend as soon as its folder meets that shape, with no backend code changes required. `skills/render-starter/` is a scaffold with the same two-file shape, kept out of discovery by name so it doesn't appear as a real format.

## Renderer comparison

| | Best suited for | Input requirements | VLM captioning | Layout | Output |
|---|---|---|---|---|---|
| Timeline | Sequential, text-heavy decks | Text; images captioned for context but never embedded | Runs when images are present | Vertical, alternating left/right cards | Self-contained HTML |
| Gallery | Image-heavy presentations | Text and images | Runs when images are present | Masonry grid with a detail panel | Self-contained HTML |
| Bubble Map | Exploratory, topic-heavy content | Text; images shown as thumbnails around an expanded bubble | Runs when images are present | Non-linear thematic clustering via a force-relaxation packer | Self-contained HTML |

## Shared chrome

All three templates bake in the same chrome: a dark/light mode toggle. Each template ships one fixed accent colour that mirrors the generator app's own palette; there is no runtime colour picker in the generated output.

## API integration

The backend calls the Anthropic API at three points, all reading `ANTHROPIC_API_KEY` from the environment (see `DEPLOYMENT.md` for configuration):

1. PDF extraction: `extractPdf.js` calls Claude Sonnet (`claude-sonnet-4-6`), only for `.pdf` uploads.
2. Image captioning: `captionImages.js` calls Claude Haiku 4.5, once per extracted image.
3. Content structuring at render time: `extractTimelineContent` and `identifyThemes` both call Claude Sonnet (`claude-sonnet-4-6`); Gallery does not call the API at this stage.

## Version control

The project is a single GitHub repository. Documentation lives in `docs/`, with descriptive filenames and no numbering scheme.
