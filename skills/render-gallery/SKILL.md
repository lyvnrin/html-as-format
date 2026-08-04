---
name: render-gallery
description: Renders the enriched slide JSON produced by the pptx image-extraction + captioning pipeline (parseFile → captionImages) as a Pinterest-style masonry image grid. Each slide becomes a card — an image-led card with a bold heading overlay and a small caption label, or a solid accent-coloured tile with a white heading if the slide has no image. Clicking a card opens a full-detail overlay with the image and complete text side-by-side. Shares the same interactive chrome as all other renderers: 5-colour theme picker, dark mode toggle, Download PDF button. Use this skill when the user asks for a gallery layout, a photo/image grid, a Pinterest-style board, or a visual/scannable alternative to a slide-by-slide format.
---

# render-gallery

Takes the enriched slide array produced by the pptx image pipeline (`parseFile` → `captionImages`) and renders it as a masonry grid of cards, one per image.

**Unlike the other renderer skills, this one does not consume the generic `transcript-to-html` extraction schema.** That schema only carries a text `image_description` field — the actual image never survives it. This format needs the real embedded image, so it must be given the raw enriched slide array directly: one object per slide, shaped `{ slide, heading, body[], images[] }`, where each entry in `images[]` is `{ base64, mime_type, caption }`.

## Step 1: Read the enriched slide data

- Input is the array output by `captionImages(await parsePptx(...))`.
- Fields per slide: `slide` (number), `heading` (string), `body` (string array), `images` (array, empty if none).
- A slide with multiple images gets one card per image, not just its first — see `galleryCardsForSlide`. The first image carries the slide's full body list and its own VLM caption; every additional image reuses the same heading, skips the body list (avoids repeating the same text across cards), and uses the slide's heading as its caption instead of a separate VLM caption.
- Do not fabricate headings, body text, or captions beyond what's given. If `body` is empty, the detail panel simply has no content blocks.

## Step 2: Build the masonry grid

**This step is code, not an LLM fill-in-template pass.** `server/index.js` (`galleryCardsForSlide`, `renderGallery`) builds the `#grid` markup directly from the enriched slide array and stamps it into `assets/gallery-template.html`'s single `{{GALLERY_CARDS}}` token — there is no per-card LLM call. This section documents the visual contract that code implements, so a human editing the card-building functions or the template knows what rules to preserve.

- One `.card` per image inside `#grid` (a slide with N images produces N cards), laid out with CSS `column-count` (see template). Don't switch this to CSS grid/flexbox — the varied card heights from differing image aspect ratios and text lengths are what makes it read as a photo board rather than a rigid grid.
- **Image card** (slide has an image), Pinterest-style: a plain image (no text overlaid on top of it) with a short bold title strip directly below it, in the card's own background — this is the `heading`, not the VLM-generated `caption`. The `caption` is descriptive and often runs long; it does not belong on the compact card, only in the detail panel (Step 3).
- **Solid card** (no image): a full-bleed tile in `var(--accent)` with the heading centred in bold white text.
- Each `.card` also carries a hidden `.card-detail` block with the full content for that slide (used by the detail panel — see Step 3).

**Image placeholders — critical:** never inline actual base64 image data. Every `<img>` `src` (both in the card face and in its `.card-detail`) is set to the exact literal token `__IMAGE_SLIDE_<n>_<i>__`, where `<n>` is that slide's `slide` number and `<i>` is the 1-based index of that image within the slide's `images[]`. `embedGalleryImages` does a plain string substitution of each token for the real `data:` URI afterward.

## Step 3: Detail panel

- Clicking anywhere on a `.card` opens `#overlay`: a full-screen dark scrim with `backdrop-filter: blur(...)` behind a centred `#panel`.
- The panel is populated by cloning that card's `.card-detail` content into `#panel` — this is already wired in the template's JS, don't rewrite the click-handling logic, just make sure every card has a correctly filled `.card-detail`.
- Panel layout is side-by-side: image (or, for solid cards, the accent tile) on the left, heading + content blocks + caption on the right.
- Clicking the overlay background (not the panel itself) dismisses it. Only one panel open at a time.

**Body content is rendered as typed blocks, not a bullet list.** `galleryBodyBlocksHtml` (`server/index.js`) groups a slide's flat `body[]` array into three block types via deterministic regex/word-count heuristics — no LLM call, kept in code specifically to preserve gallery generation's near-instant render time (see the note on Step 2 above):

- **`.block-stat`** — a standalone number, percentage, or currency value (`"38%"`, `"$4.2B"`, matched by `isStatValue`), with the following entry consumed as its label whenever that entry isn't itself a stat value. Consecutive stat pairs are grouped into one `.block-stat` grid (`grid-template-columns: 1fr 1fr`), each pair wrapped in its own `.stat-item`.
- **`.block-steps`** — a repeating `[short label, description]` pattern (e.g. `"Discovery"` / `"Customer encounters the brand via search, social, or word of mouth."`), matched by `isStepLabel`. A bare leading number entry (`"01"`) immediately before a label is consumed and discarded — steps are always auto-numbered from 01 on render, not read from the data. Renders as a compact list (`.step` rows: `.step-num` / `.step-label` / `.step-desc`), no bullets.
- **`.block-prose`** — anything else (full sentences); consecutive prose lines are grouped into one block of `<p>` tags.

`groupBodyIntoBlocks` tries a step-run match first, then a stat-run, falling back to prose. **This ordering intentionally differs from a strict "check stat first" reading of the rules above:** a bare `"01"` entry matches the stat pattern too, so if stats were checked first it would get swallowed as a lone stat value (with the following label wrongly consumed as its stat-label) instead of being read as a step marker — breaking decks that lead each step with a plain number. Checking steps first is what makes `"01"` / `"Discovery"` / description resolve correctly as a step. A lone `"38%"` with no following label/description still falls through to stats correctly either way. If you need to retune the detection (e.g. a deck's step labels run longer than 6 words), adjust `isStepLabel`/`isStatValue` — don't reintroduce a flat bullet fallback for content that fails all three checks; it already falls through to `.block-prose`.

## Step 4: Chrome

Copy the toolbar HTML/CSS/JS verbatim from the existing templates (`timeline-template.html` or either `transcript-to-html` template) — do not rewrite it. 5-colour theme picker (blue, green, purple, orange, **red** — blue is the default; note this format uses red instead of the pink used elsewhere, that's intentional). Dark mode toggle. Download PDF button targets `#grid`, not the whole page (the toolbar shouldn't appear in the exported PDF).

Scrollbars are hidden everywhere on every renderer (the global `* { scrollbar-width: none; ... } *::-webkit-scrollbar { display: none; }` rule right after the box-sizing reset) — scrolling still works, there's just no visible track/thumb. Keep this rule intact.

## Step 5: Validate before delivering

1. Grep for any remaining `{{` strings — anything left is a bug.
2. Confirm every image has exactly two `__IMAGE_SLIDE_<n>_<i>__` tokens (one in the card face, one in `.card-detail`) — a missing or mismatched token means an image silently fails to render.
3. Run `node --check` on the inline `<script>` block.
