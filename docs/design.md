# Design

## Architecture

The project uses a two-layer architecture that separates extraction from rendering. This was a deliberate move away from a single monolithic skill that would parse and render in one pass.

**Layer 1: Extraction.** Parses the source document (PPT, PDF, transcript) once and outputs a clean, structured intermediate format: slide headings, body content per section, key points, metadata, and embedded images as base64 blobs. This layer is format-agnostic — it doesn't know or care which renderer will consume the output.

**Layer 2: Render skills.** Each renderer takes the extracted output and produces a self-contained HTML page. If a consultant dislikes the view, the frontend passes the same extracted content to a different renderer without re-parsing the document.

### Why skills-based, not hand-coded

Each renderer is a SKILL.md (natural language instructions) paired with an HTML template containing `{{PLACEHOLDER}}` blocks. The server reads both files, sends them to Claude along with the slide data, and Claude fills the template. The rendering logic lives in instructions that Claude follows, not in procedural code that builds HTML strings.

This means adding a new output format is writing a new skill and template, not a new code path. It also means the rendering step can make editorial judgements — shortening a heading for a glance label, grouping slides into themes, picking which moments to highlight — that would be hard to encode procedurally.

### Two data paths

Not all renderers consume the same input shape:

- **Timeline** goes through its own standalone lean extraction call (`extractTimelineContent`) first, which produces a small structured JSON schema (title, slides with headings/body/bullets/key stat, key moments). This schema is text-only, which works because Timeline doesn't display images.
- **Magazine and Bubble Map** skip the extraction schema and consume the raw enriched slide array directly (`parseFile` → `captionImages` output), because they need the real embedded images as base64 data. The extraction schema's text-only `image_description` field isn't enough for formats that actually render photos.

## Frontend flow

Upload document → `parseFile` extracts structured slide JSON → `captionImages` adds VLM-generated captions to any embedded images → user picks a format → the appropriate renderer skill produces HTML → the page renders in the output viewer.

If a user wants a different view, the frontend passes the same extracted content to a different renderer. No re-upload, no re-parsing.

## Shared chrome

Every renderer ships with the same interactive toolbar, copied verbatim between templates so they stay visually and behaviourally consistent:

- **Theme picker** — five colour options (blue default, green, purple, orange, plus pink or red depending on the renderer). Each theme is a set of four CSS custom properties (`--accent`, `--accent-soft`, `--accent-dark`, `--accent-dark-soft`) on a `[data-theme]` attribute. Adding a new colour means adding one CSS block and one dot button.
- **Dark/light mode toggle** — flips `data-mode` on `<body>`, transitions background and text colours smoothly.
- **PDF export** — client-side via html2canvas + jsPDF. Each renderer targets a specific DOM element for export (the content area, not the toolbar), so the settings panel doesn't appear in the PDF. Timeline forces all detail panels open in the print stylesheet so the PDF captures everything.

Scrollbars are hidden globally across all renderers (CSS `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) — scrolling still works, there's just no visible track. This is intentional for the clean internal-tooling aesthetic.

## Renderer designs

### Timeline

Interactive vertical timeline with alternating left/right detail panels. Each slide becomes a node on a centre rail: a dot, an index number, and a short heading label are always visible. Clicking a node expands its detail panel inline (heading, subheading, body, bullets, key stat). Nodes flagged as key moments get an accent-coloured outline on their dot.

Each node's detail panel lives inside its own `.tl-node` element and is shown/hidden in place — nothing is cloned or shared between nodes, so one node's click can never reveal another node's data.

The visual language is editorial and restrained: serif type for the title and index labels, a thin solid centre line, accent colour used sparingly for the active dot and label.

### Magazine

Pinterest-style masonry grid using CSS `column-count` (not CSS grid or flexbox — the varied card heights from differing image aspect ratios and text lengths are what makes it read as a photo board rather than a rigid grid).

Two card types: image cards (photo with a bold heading strip below it) and solid accent tiles (for slides with no image). Clicking any card opens a full-screen overlay with a centred detail panel — image on the left, full content on the right. The detail content is pre-filled in a hidden `.card-detail` block inside each card and cloned into the overlay on click, so there's no fetch or delay.

Image handling uses a placeholder token system: Claude writes `__IMAGE_SLIDE_<n>__` tokens in the template, and a post-processing step in the server does a string substitution to swap each token for the real `data:` URI. Claude never sees or handles the raw base64 data directly.

### Bubble Map

Organically clustered bubble map where every slide is a parent bubble, sized proportionally to its content weight (area-proportional scaling via square root of content count — so visual area is proportional to data without exaggerating differences).

Clicking a slide bubble reveals its content as child bubbles: one small circle per body paragraph and one thumbnail circle per image, nestled around the parent. Every other slide bubble dims and clears out of the way to make room.

Key design constraints, each the result of a specific iteration that was tried and rejected:

- **Everything is a circle, no rectangles anywhere.** Two earlier versions used rectangular cards for expanded content — one centred on the dot, one anchored to the bubble's edge. Both read as "a modal appeared" regardless of anchoring, because the rectangle shape itself is what reads as a popup. The fix was making content itself a small bubble.
- **Colour encodes depth, not theme.** One hue (the currently selected accent from the theme picker), two shades: dark for every parent bubble, light for every child. Earlier versions tried per-theme colours and a legend — rejected because a legend for something that isn't interactive is dead weight, and colour is better spent signalling parent-vs-child at a glance.
- **Themes have no visual role.** Themes group slides in the JSON and matter for authoring (a well-chosen grouping helps Claude reason about the deck), but nothing about a theme reaches the rendered page. An earlier version made themes the top-level packed bubbles with slides orbiting on a fixed-radius ring — this produced huge gaps between clusters and was rejected.
- **Deterministic geometry, not physics simulation.** Bubble positions are seeded with deterministic pseudo-random jitter (`seededRandom()`) and relaxed into a non-overlapping arrangement, rather than placed on a grid or evenly spaced on a ring. Both of those approaches are collision-free but read as mechanical. The relaxation runs once at load time; CSS spring easing on `left`/`top` transitions supplies the organic motion when bubbles displace each other on click.
- **Two motion curves for two layers.** Bubbles nudging each other aside use `--spring-ease` (cubic-bezier with overshoot) for an organic, slightly wobbly settle. Everything else (opacity fades, image zooms, chrome transitions) uses a calm ease. Keeping these distinct is what makes "bubble physics" and "UI chrome" read as intentional layers.

## Motion language

All three renderers share a consistent cinematic glass easing for chrome transitions (settings panel, theme switching, mode toggle). Renderer-specific motion is kept distinct per format — the bubble map's spring physics, the timeline's smooth panel reveals, the magazine's overlay fade — but they all feel like they belong to the same family of internal tooling rather than three different products.