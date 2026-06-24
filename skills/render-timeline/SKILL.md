---
name: render-timeline
description: Renders a structured JSON artefact (produced by the transcript-to-html extraction skill) as an interactive horizontal timeline HTML page. Each slide or section becomes a node on the timeline — tap or click to expand full content. Designed for both Pace Port touchscreen display and shareable HTML links. Use this skill when the user asks for a timeline view, a chronological layout, or wants to step through a deck slide-by-slide in a visual, non-linear way.
---

# render-timeline

Takes the structured JSON output from the `transcript-to-html` extraction step and renders it as an interactive horizontal timeline. Each node represents one slide. Nodes are tappable — clicking expands the full slide content inline. Navigation is free (drag/scroll the timeline) or linear (arrow keys / nav buttons).

Shares the same interactive chrome as all other renderers: 5-colour theme picker, dark mode toggle, Download PDF button.

## Step 1: Read the extracted JSON

- The input is `extracted-content.json` (or the path the user provides).
- Read it in full before building anything.
- Key fields used by this renderer:
  - `meta.title`, `meta.subtitle`, `meta.date`, `meta.summary` — page header
  - `slides[]` — one timeline node per slide; use `heading`, `subheading`, `body`, `bullets`, `key_stat`, `layout_hint`
  - `key_moments[]` — array of slide indices to visually flag as highlights on the timeline
  - `meta.author` — footer attribution

## Step 2: Build the timeline

Use `assets/timeline-template.html`. Copy it to your working directory and fill all `{{PLACEHOLDER}}` blocks.

**Node structure (per slide):**
- At rest: node dot + slide index number + `heading` as label (+ `key_stat` if present, shown beneath heading in muted type)
- Expanded (on tap/click): `subheading`, `body` paragraphs, `bullets` list, `image_description` shown as an italicised caption
- `key_moments` slides: render with a distinct highlight ring on the node dot — these are the standout slides

**Layout rules:**
- Horizontal scrolling timeline as the base. On small screens (< 640px) fall back to vertical stacked layout.
- Connector line runs through all nodes. Nodes sit above the line.
- Active/expanded node shifts upward slightly and shows an accent-coloured ring.
- Max one node expanded at a time — clicking a second node closes the first.
- Keyboard nav: Left/Right arrows move between nodes; Enter/Space expands/collapses.
- Touch: swipe horizontally to scroll, tap node to expand.

**Pace Port considerations:**
- Node dots should be generously sized (min 44px tap target).
- Expanded content panel should be large enough to read from a few feet away — body text min 17px.
- Avoid hover-only interactions; everything must work on tap.

## Step 3: Chrome

Copy the toolbar HTML and JS verbatim from the existing templates — do not rewrite it. The toolbar includes the theme picker, dark mode toggle, and PDF export button. It must behave identically to the other renderers.

The PDF export targets `#doc` (the timeline wrapper div), not the whole page.

## Step 4: Writing the content

- Node labels (`heading`) should be short enough to read at a glance on the timeline — if the original heading is long, write a shortened version (4–6 words) for the node label and use the full heading inside the expanded panel.
- `body` and `bullets` go inside the expanded panel. If a slide has both, render body paragraphs first, then bullets.
- Never invent content not present in the JSON. If a field is empty, omit it — don't write filler.
- `image_description` renders as an italic caption line at the bottom of the expanded panel: *[Visual: description]*

## Step 5: Validate before delivering

1. Grep for any remaining `{{` strings — anything left is a bug.
2. Run `node --check` on the inline `<script>` block.
3. Save to `/mnt/user-data/outputs/` and use `present_files`.
