---
name: render-timeline
description: Renders a structured JSON artefact (produced by the transcript-to-html extraction skill) as an interactive centred-track timeline HTML page that fills the whole screen — a vertical line with dots down the middle, generously spaced so only ~2-3 are visible at a time, and you freely scroll the page itself (not a boxed sub-widget) to see more. Content revealed to the left or right of whichever dot you click. Minimal header, no footer, no Prev/Next buttons. Designed for both Pace Port touchscreen display and shareable HTML links. Use this skill when the user asks for a timeline view, a chronological layout, or wants to step through a deck slide-by-slide in a visual, non-linear way.
---

# render-timeline

Takes the structured JSON output from the `transcript-to-html` extraction step and renders it as a centred vertical timeline that occupies the whole page. A single line runs down the middle with one dot per slide, each dot carrying a small always-visible index + short label + stat. Clicking a dot (or its label) reveals that slide's full content — heading, subheading, body, bullets — in a block that appears to the left or right of the dot, alternating per node. Clicking an open node's dot again closes it.

**Scrolling is the plain browser page scroll — never a boxed sub-widget.** `.tl-node` has generous vertical padding (`62px 0`) so that, given typical viewport heights, only ~2-3 nodes are visible on screen at once — but that's achieved purely through spacing, not by capping `.tl-track`'s height or giving it its own `overflow-y`. **A nested `overflow-y: auto` scroll container for the track was built and explicitly rejected** — it read as a cramped widget boxed into part of the screen, not a timeline that fills it. Don't reintroduce a height cap / `overflow-y` on the track or any wrapper around it. If "only a few nodes visible at a time" ever needs revisiting, adjust `.tl-node`'s padding — don't reach for a scroll container.

**There is no Prev/Next control, and none should be added.** This was tried twice (once fixed-position, once in-flow) and rejected both times. Scrolling the page and clicking dots are the only navigation. Don't reintroduce a stepping button "for convenience," and don't add keyboard Prev/Next either — same rejected concept.

**There is no footer.** An earlier version rendered `meta.subtitle`/`date`/`summary`/`author` as a line at the bottom of the page; this was rejected too. Don't add a footer element back in. If those fields need to go somewhere, ask first rather than reintroducing a bottom bar by default.

**Why this shape, and what not to bring back:** every earlier version of this skill broke the same way — something tried to size the "click to reveal" content using hand-computed fractions of the viewport or rail (`calc(50vh - Npx)`, a rail-height budget, a fixed/absolute-positioned floating panel, a boxed scroll container). This version has none of that. Each node is one row of a normal CSS grid (`1fr 190px 1fr` — side / dot / side); a node's detail block is placed in the left or right column purely via a `.side-left`/`.side-right` class on the row driving `grid-column`, and it is `display: none` until that node is active, then just `display: block` at its natural content height. **No `position: fixed`/`absolute`, `vh`-based `calc()`, or `overflow-y: auto` sizing anywhere in the track or its content, ever** — if a future request wants sizing changed, do it with normal CSS (padding, `max-width`, grid track sizing), not viewport-fraction math or a scroll box.

The centre column is `190px`, not a token width like `60px` — the always-visible label needs real room to wrap onto two lines at a normal font size (`.tl-node-label` is `max-width: 170px`). A column too narrow for the label forces one-word-per-line wrapping, which is its own kind of broken layout even though nothing overflows or squeezes; if you resize the centre column, keep `.tl-node-label`'s `max-width` a bit smaller than the column so it isn't flush against the detail columns on either side.

**The header must stay tiny.** It is an eyebrow label and a title, nothing else — no subtitle paragraph, no meta row. This is deliberate: the interactive timeline is what this skill is for, and a header block that can balloon with a long subtitle/summary paragraph was flagged explicitly as eating space that belongs to the timeline. Do not let the header grow past roughly two lines regardless of how long the title text is (the title's `font-size` is already modest — `clamp(20px, 2.6vw, 27px)` — don't enlarge it into a splash headline).

Shares the same interactive chrome as all other renderers: 5-colour theme picker, dark mode toggle, Download PDF button.

## Step 1: Read the extracted JSON

- The input is `extracted-content.json` (or the path the user provides).
- Read it in full before building anything.
- Key fields used by this renderer:
  - `meta.title` — the one-line header title. That's the only `meta.*` field this renderer currently uses.
  - `slides[]` — one timeline node per slide; use `heading`, `subheading`, `body`, `bullets`, `key_stat`
  - `key_moments[]` — array of slide indices to visually flag as highlights (outlined dot)
- `meta.subtitle`, `meta.date`, `meta.summary`, `meta.author`, and `image_description` all exist in the schema but **none of them render anywhere in this template** — the header footer was removed by explicit request and images were declined earlier in this skill's history (see the top of this file). Don't add any of them back into a header, footer, or elsewhere without being asked, and if asked, say up front that `image_description` is a text-only field (never an actual image) unless the separate pptx image-extraction pipeline `render-magazine` uses is wired in instead.

## Step 2: Build the timeline

Use `assets/timeline-template.html`. Copy it to your working directory and fill all `{{PLACEHOLDER}}` blocks.

The template ships dark by default (`data-mode="dark"` on `<body>`) — keep it that way unless the user asks for a light default. The visual language is editorial and restrained (serif type for the title/index labels/headings via `--font-serif`, a thin solid centre line, accent colour used sparingly for the active dot/label). Don't add heavy glow/blur effects back in.

**Node structure (per slide) — one `.tl-node` row, detail block inline (no template/clone, no shared panel):**
- Each `.tl-node` is a 3-column grid row containing (in this DOM order, regardless of side) the detail block (`.tl-node-detail`, holding `key_stat`, full `heading`, `subheading`, `body`, `bullets`) and the centre column (`.tl-node-center`, holding the dot button, index number, short `heading`-derived label, and `key_stat` again — this is the always-visible glance content).
- Alternate `class="side-left"` / `class="side-right"` on successive `.tl-node` divs (first node = `side-left`) — this is what routes that node's `.tl-node-detail` into the left or right grid column via CSS, not by physically moving markup. Because the detail content lives inside its own node and is just shown/hidden in place — never cloned into a shared element elsewhere on the page — there is no code path for one node's click to reveal a different node's (or the page header's) content.
- `key_moments` slides: add `highlight` as an extra class on `.tl-node` — outlines that node's dot in the accent colour.
- Every `{{NODE_N_*}}` placeholder must be filled from that same slide's own fields (`slides[N-1]`) — never reuse `meta.title` as a stand-in for a node's own heading/subheading/body.

**Layout rules:**
- `.tl-track` is a plain block container (`position: relative; max-width: 980px; margin: 0 auto`) — no height cap, no `overflow-y`. Nodes are its children in document order. The `::before` pseudo-element draws the centre line the full natural height of the track (this only works correctly because nothing clips `.tl-track`; see the note above about the rejected scroll-box version, where the same line got clipped to a fixed window instead of running the full list).
- `.tl-node`'s `padding: 62px 0` is what spaces nodes out enough that only ~2-3 fit in a typical viewport at once — this is a spacing choice, not a scrolling mechanism. The page itself just scrolls normally past that point.
- Each `.tl-node`'s height is whatever its content needs — closed nodes are short (just the centre column), the open node is taller (detail block plus centre column, whichever is taller). Opening one node cannot affect any other node's size or position; there is no shared height budget between them.
- Below 760px, `.tl-node` switches to `display: block` (falls out of the grid), which alone reorders everything into a simple stacked list: centre content on top (as a horizontal row — dot then label), detail content below it, full width, when active. The centre line hides on mobile. Don't try to preserve the left/right alternation below 760px; it doesn't fit a phone-width screen.
- Only one node open at a time — selecting a new node closes whichever was open. Clicking an open node's dot again closes it (no node forced open).
- Touch: tap a dot or its label to open/close that node. Scroll the page (drag) to reveal more nodes — this is the OS/browser's native scroll, not a custom widget.

**Pace Port considerations:**
- Dots should be generously sized (min 44px effective tap target — the dot's clickable area plus its label are both large enough already; don't shrink them for a kiosk build).
- Detail body text min 15.5px by default; bump to 17px+ if adapting specifically for a kiosk viewed from a few feet away.
- Avoid hover-only interactions; everything must work on tap, including the page's own scroll.

## Step 3: Chrome

Copy the toolbar HTML and JS verbatim from the existing templates — do not rewrite it. The toolbar includes the theme picker, dark mode toggle, and PDF export button. It must behave identically to the other renderers.

Scrollbars are hidden everywhere on every renderer (the global `* { scrollbar-width: none; ... } *::-webkit-scrollbar { display: none; }` rule right after the box-sizing reset) — scrolling still works, there's just no visible track/thumb. Keep this rule intact. This template has no internal scrolling region of its own — the whole page is the scroll surface — so there is no scrollbar exception to carve out here; a visible custom scrollbar on a boxed track was tried and explicitly rejected alongside the boxed-scroll approach itself. Don't add one back.

The PDF export targets `#doc` (the whole document). The `@media print` rule forces every `.tl-node-detail` to `display: block !important` regardless of open/closed state, so a PDF export captures every node's full content.

## Step 4: Writing the content

- `heading` gets shortened to a 4–6 word glance label for `.tl-node-label` in the centre column — write a short version if the original is long. The full, unshortened `heading` goes in `.tl-node-detail`'s `.detail-heading` and is what actually shows when you click the node.
- `body` and `bullets` go inside `.tl-node-detail`. If a slide has both, render body paragraphs first, then bullets.
- Never invent content not present in the JSON. If a field is empty, omit it — don't write filler.
- Do not render `image_description`, or `meta.subtitle`/`date`/`summary`/`author` (see Step 1) unless explicitly asked.

## Step 5: Validate before delivering

1. Grep for any remaining `{{` strings — anything left is a bug.
2. Run `node --check` on the inline `<script>` block.
3. Save to `/mnt/user-data/outputs/` and use `present_files`.
