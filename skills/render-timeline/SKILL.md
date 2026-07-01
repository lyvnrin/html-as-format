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

The template ships as a cinematic dark-glass design by default (`data-mode="dark"` on `<body>`) — keep it that way unless the user asks for a light default. Don't flatten it back to a plain light document.

**Node structure (per slide) — single `.node` block, no separate panel list:**
- Each `.node` contains the dot button, a `.node-content` wrapper with `.node-panel` (hidden until expanded) and `.node-summary` (always visible: `heading` as the short label + `key_stat` if present).
- Alternate `class="above"` / `class="below"` on successive `.node` divs (first node = `above`, second = `below`, etc.) — this is what makes nodes pop alternately above and below the centre line.
- `key_moments` slides: add `highlight` as an extra class (e.g. `class="node above highlight"`) — renders a glowing ring on the dot.
- Expanded panel content: `subheading`, `body` paragraphs, `bullets` list, `image_description` as an italicised caption.

**Layout rules:**
- The timeline rail breaks out to full viewport width (`100vw`) regardless of the centred `#doc` column the header/title sit in — this is built for presenting on a big screen, not a narrow article layout. Don't wrap it back inside the centred column.
- The connector line sits at the vertical centre of the timeline rail; nodes alternate popping up above it and down below it as you move along the rail.
- Horizontal scroll-snap is `mandatory` — swiping/scrolling moves decisively one node at a time, like stepping through slides. Only the centred node is at full scale/opacity; neighbours are dimmed and slightly scaled down. Don't remove `scroll-snap-type`/`scroll-snap-align`/the centred-tracking JS.
- Nodes fade/scale/rise into view via `IntersectionObserver` as they enter the visible rail — don't pre-render them fully visible; the reveal-on-scroll is part of the intended feel.
- On small screens (< 640px) it falls back to a single-column vertical stacked layout (no alternating).
- Expanded node's dot scales up and glows; its panel renders inline right next to the dot, not in a separate page section.
- Max one node expanded at a time — clicking a second node closes the first.
- Keyboard nav: Left/Right arrows move between nodes; Enter/Space expands/collapses.
- Touch: swipe horizontally to scroll, tap node to expand.

**Pace Port considerations:**
- Node dots should be generously sized (min 44px tap target).
- Expanded content panel should be large enough to read from a few feet away — body text min 17px when adapting for a kiosk; the bundled defaults are sized for desktop/laptop reading distance.
- Avoid hover-only interactions; everything must work on tap.

## Step 3: Chrome

Copy the toolbar HTML and JS verbatim from the existing templates — do not rewrite it. The toolbar includes the theme picker, dark mode toggle, and PDF export button. It must behave identically to the other renderers.

Scrollbars are hidden everywhere on every renderer (the global `* { scrollbar-width: none; ... } *::-webkit-scrollbar { display: none; }` rule right after the box-sizing reset) — scrolling still works, there's just no visible track/thumb. Keep this rule intact.

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
