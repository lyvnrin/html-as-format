---
name: render-timeline
description: Renders a lean, purpose-built JSON extraction (produced by `extractTimelineContent` in `server/index.js`, one small LLM call per deck) as an interactive centred-track timeline HTML page that fills the whole screen — a vertical line with dots down the middle, generously spaced so only ~2-3 are visible at a time, and you freely scroll the page itself (not a boxed sub-widget) to see more. Content revealed to the left or right of whichever dot you click. Minimal header, no footer, no Prev/Next buttons. Designed for both Pace Port touchscreen display and shareable HTML links. Use this skill when the user asks for a timeline view, a chronological layout, or wants to step through a deck slide-by-slide in a visual, non-linear way.
---

# render-timeline

Takes the JSON produced by `extractTimelineContent` (Step 1) and renders it as a centred vertical timeline that occupies the whole page — the actual markup build (Step 2) is plain code, not a second LLM pass. A single line runs down the middle with one dot per slide, each dot carrying a small always-visible index + short label + stat. Clicking a dot (or its label) reveals that slide's full content — heading, subheading, body, bullets — in a block that appears to the left or right of the dot, alternating per node. Clicking an open node's dot again closes it.

**Scrolling is the plain browser page scroll — never a boxed sub-widget.** `.tl-node` has generous vertical padding (`62px 0`) so that, given typical viewport heights, only ~2-3 nodes are visible on screen at once — but that's achieved purely through spacing, not by capping `.tl-track`'s height or giving it its own `overflow-y`. **A nested `overflow-y: auto` scroll container for the track was built and explicitly rejected** — it read as a cramped widget boxed into part of the screen, not a timeline that fills it. Don't reintroduce a height cap / `overflow-y` on the track or any wrapper around it. If "only a few nodes visible at a time" ever needs revisiting, adjust `.tl-node`'s padding — don't reach for a scroll container.

**There is no Prev/Next control, and none should be added.** This was tried twice (once fixed-position, once in-flow) and rejected both times. Scrolling the page and clicking dots are the only navigation. Don't reintroduce a stepping button "for convenience," and don't add keyboard Prev/Next either — same rejected concept.

**There is no footer.** An earlier version rendered `meta.subtitle`/`date`/`summary`/`author` as a line at the bottom of the page; this was rejected too. Don't add a footer element back in. If those fields need to go somewhere, ask first rather than reintroducing a bottom bar by default.

**Why this shape, and what not to bring back:** every earlier version of this skill broke the same way — something tried to size the "click to reveal" content using hand-computed fractions of the viewport or rail (`calc(50vh - Npx)`, a rail-height budget, a fixed/absolute-positioned floating panel, a boxed scroll container). This version has none of that. Each node is a 3-child flex row (`display: flex; align-items: center` — side slot / dot column / side slot); a node's detail block is rendered directly into the left or right slot by `timelineNodeHtml` in `server/index.js` (the other slot renders empty), and it is `display: none` until that node is active, then just `display: block` at its natural content height. **No `position: fixed`/`absolute`, `vh`-based `calc()`, or `overflow-y: auto` sizing anywhere in the track or its content, ever** — if a future request wants sizing changed, do it with normal CSS (padding, `max-width`, flex sizing), not viewport-fraction math or a scroll box. (The one exception is the dot itself, absolutely positioned within its own small fixed-footprint `.tl-node-center` box via constant pixel margins — safe because the dot's own size never changes, unlike the track/card sizing this rule is really about.)

The centre column is `210px`, not a token width like `60px` — the always-visible label needs real room to wrap onto two lines at a normal font size (`.tl-node-label` is `max-width: 190px`). A column too narrow for the label forces one-word-per-line wrapping, which is its own kind of broken layout even though nothing overflows or squeezes; if you resize the centre column, keep `.tl-node-label`'s `max-width` a bit smaller than the column so it isn't flush against the detail columns on either side. The dot is `18px` and `.tl-node-center`'s `min-height` is a formula derived from the dot's size plus the index/label/stat stack beneath it (see the comment above `.tl-node-center` in the template) — if you resize the dot or that text, update the formula's constants to match, not just the dot/font-size declarations.

**The header must stay tiny.** It is an eyebrow label and a title, nothing else — no subtitle paragraph, no meta row. This is deliberate: the interactive timeline is what this skill is for, and a header block that can balloon with a long subtitle/summary paragraph was flagged explicitly as eating space that belongs to the timeline. Do not let the header grow past roughly two lines regardless of how long the title text is (the title's `font-size` is already modest — `clamp(20px, 2.6vw, 27px)` — don't enlarge it into a splash headline).

Shares the same interactive chrome as all other renderers: 5-colour theme picker, dark mode toggle, Download PDF button.

## Step 1: Extraction

**Extraction is a standalone, lean LLM call (`extractTimelineContent` in `server/index.js`), not part of the same pass that fills the template.** It's the one piece of this renderer that still needs a model — shortening a heading to a glance `label`, picking a `key_stat`, and choosing `key_moments` all need real reading comprehension — but the call returns nothing except this small JSON, never the template's HTML/CSS/JS:

```json
{
  "title": "",
  "slides": [
    {
      "heading": "",
      "label": "",
      "subheading": "",
      "body": [],
      "bullets": [],
      "key_stat": ""
    }
  ],
  "key_moments": [1, 4, 7]
}
```

- `label` is new versus the generic extraction schema: a 4-6 word paraphrase of `heading` for the always-visible glance label (see Step 4). `heading` itself stays full-length for the detail block.
- `key_moments` is an array of 1-based slide positions (matching `slides[]` order), not the generic schema's separately-indexed field.
- Omit `subheading`/`body`/`bullets`/`key_stat` per slide rather than inventing content when the source doesn't have it.
- Read the entire source before extracting — don't extract from a partial read.

## Step 2: Build the timeline

**This step is code, not an LLM fill-in-template pass.** `server/index.js` (`timelineNodeHtml`, `renderTimelineHtml`) takes Step 1's JSON and builds the `.tl-node` markup directly, then stamps it plus `{{TIMELINE_TITLE}}`/`{{AUTHOR}}` into `assets/timeline-template.html`'s single `{{TIMELINE_NODES}}` token — there is no per-deck LLM call for this part. This section documents the markup contract that code implements, so a human editing `renderTimelineHtml` or the template knows what shape to preserve.

The template ships light by default (`data-mode="light"` on `<body>`) — keep it that way unless the user asks for a dark default. The visual language is editorial and restrained (serif type for the title/index labels/headings via `--font-serif`, a thin solid centre line, accent colour used sparingly for the active dot/label). Don't add heavy glow/blur effects back in.

**Node structure (per slide) — one `.tl-node` row, detail block inline (no template/clone, no shared panel):**
- Each `.tl-node` is a 3-child flex row — a side slot (`.tl-node-slot`), the centre column (`.tl-node-center`, holding the dot button and `.tl-node-meta`: index number, short `heading`-derived label, and `key_stat` again — this is the always-visible glance content), then another side slot. DOM order is always `[slot][center][slot]`; whichever slot the detail block (`.tl-node-detail`, holding `key_stat`, full `heading`, `subheading`, `body`, `bullets`) is rendered into is what determines left/right — the other slot is left genuinely empty.
- Alternate `class="side-left"` / `class="side-right"` on successive `.tl-node` divs (first node = `side-left`) — `timelineNodeHtml` uses this to decide which slot gets the detail block; the slot's own `justify-content` (`flex-end` for the first slot, `flex-start` for the last) hugs the card against the dot. Because the detail content lives inside its own node and is just shown/hidden in place — never cloned into a shared element elsewhere on the page — there is no code path for one node's click to reveal a different node's (or the page header's) content.
- `key_moments` slides: `highlight` is added as an extra class on `.tl-node` — outlines that node's dot in the accent colour.
- Every node's content comes from that same slide's own fields — never `title` (the document-level field) standing in for a node's own heading/subheading/body.

**Layout rules:**
- `.tl-track` is a plain block container (`position: relative; max-width: 980px; margin: 0 auto`) — no height cap, no `overflow-y`. Nodes are its children in document order. The `::before` pseudo-element draws the centre line the full natural height of the track (this only works correctly because nothing clips `.tl-track`; see the note above about the rejected scroll-box version, where the same line got clipped to a fixed window instead of running the full list).
- `.tl-node`'s `padding: 62px 0` is what spaces nodes out enough that only ~2-3 fit in a typical viewport at once — this is a spacing choice, not a scrolling mechanism. The page itself just scrolls normally past that point.
- Each `.tl-node`'s height is whatever its content needs — closed nodes are short (just the centre column), the open node is taller (detail block plus centre column, whichever is taller). Opening one node cannot affect any other node's size or position; there is no shared height budget between them.
- Below 760px, `.tl-node` switches from `flex-direction: row` to `flex-direction: column` and the dot/meta drop their absolute positioning back to normal flow, which together reorder everything into a simple stacked list: centre content on top (as a horizontal row — dot then label), detail content below it, full width, when active. The centre line hides on mobile. Don't try to preserve the left/right alternation below 760px; it doesn't fit a phone-width screen.
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

- `label` (Step 1's extraction output) is the 4–6 word glance version shown in `.tl-node-label` in the centre column; the full, unshortened `heading` goes in `.tl-node-detail`'s `.detail-heading` and is what actually shows when you click the node.
- `body` and `bullets` go inside `.tl-node-detail`. If a slide has both, render body paragraphs first, then bullets (`renderTimelineHtml` does this ordering).
- Never invent content not present in the extracted JSON — code renders exactly the fields Step 1 produced, omitting whichever are absent.
- No `image_description`, subtitle, date, summary, or author render anywhere in this template (see the top of this file) — extraction doesn't need to produce them for this renderer.

## Step 5: Validate before delivering

1. Grep for any remaining `{{` strings — anything left is a bug.
2. Run `node --check` on the inline `<script>` block.
3. Save to `/mnt/user-data/outputs/` and use `present_files`.
