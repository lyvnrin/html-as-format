---
name: render-magazine
description: Renders the enriched slide JSON produced by the pptx image-extraction + captioning pipeline (parseFile → captionImages) as a Pinterest-style masonry image grid. Each slide becomes a card — an image-led card with a bold heading overlay and a small caption label, or a solid accent-coloured tile with a white heading if the slide has no image. Clicking a card opens a full-detail overlay with the image and complete text side-by-side. Shares the same interactive chrome as all other renderers: 5-colour theme picker, dark mode toggle, Download PDF button. Use this skill when the user asks for a magazine layout, a photo/image grid, a Pinterest-style board, or a visual/scannable alternative to a slide-by-slide format.
---

# render-magazine

Takes the enriched slide array produced by the pptx image pipeline (`parseFile` → `captionImages`) and renders it as a masonry grid of cards, one per slide.

**Unlike the other renderer skills, this one does not consume the generic `transcript-to-html` extraction schema.** That schema only carries a text `image_description` field — the actual image never survives it. This format needs the real embedded image, so it must be given the raw enriched slide array directly: one object per slide, shaped `{ slide, heading, body[], images[] }`, where each entry in `images[]` is `{ base64, mime_type, caption }`.

## Step 1: Read the enriched slide data

- Input is the array output by `captionImages(await parsePptx(...))`.
- Fields per slide: `slide` (number), `heading` (string), `body` (string array), `images` (array, empty if none).
- If a slide has more than one image, use only the first — one visual per card.
- Do not fabricate headings, body text, or captions beyond what's given. If `body` is empty, omit the bullet list rather than inventing content.

## Step 2: Build the masonry grid

Use `assets/magazine-template.html`. Copy it to your working directory and fill all `{{PLACEHOLDER}}` blocks.

- One `.card` per slide inside `#grid`, laid out with CSS `column-count` (see template). Don't switch this to CSS grid/flexbox — the varied card heights from differing image aspect ratios and text lengths are what makes it read as a photo board rather than a rigid grid.
- **Image card** (slide has an image), Pinterest-style: a plain image (no text overlaid on top of it) with a short bold title strip directly below it, in the card's own background — this is the `heading`, not the VLM-generated `caption`. The `caption` is descriptive and often runs long; it does not belong on the compact card, only in the detail panel (Step 3). Use the `CARD BLOCK: IMAGE VARIANT` comment block as the template.
- **Solid card** (no image): a full-bleed tile in `var(--accent)` with the heading centred in bold white text. Use the `CARD BLOCK: SOLID VARIANT` comment block.
- Each `.card` also carries a hidden `.card-detail` block with the full content for that slide (used by the detail panel — see Step 3). Don't skip filling this even though it's hidden.

**Image placeholders — critical:** never inline actual base64 image data yourself. For any slide with an image, set every `<img>` `src` for that slide (both in the card face and in its `.card-detail`) to the exact literal token `__IMAGE_SLIDE_<n>__`, where `<n>` is that slide's `slide` number — nothing else, no surrounding text. A code step after your output does a plain string substitution of each token for the real `data:` URI. Inventing a URL, guessing a filename, or altering the token in any way breaks the image silently.

## Step 3: Detail panel

- Clicking anywhere on a `.card` opens `#overlay`: a full-screen dark scrim with `backdrop-filter: blur(...)` behind a centred `#panel`.
- The panel is populated by cloning that card's `.card-detail` content into `#panel` — this is already wired in the template's JS, don't rewrite the click-handling logic, just make sure every card has a correctly filled `.card-detail`.
- Panel layout is side-by-side: image (or, for solid cards, the accent tile) on the left, heading + full body list + caption on the right.
- Clicking the overlay background (not the panel itself) dismisses it. Only one panel open at a time.

## Step 4: Chrome

Copy the toolbar HTML/CSS/JS verbatim from the existing templates (`timeline-template.html` or either `transcript-to-html` template) — do not rewrite it. 5-colour theme picker (blue, green, purple, orange, **red** — blue is the default; note this format uses red instead of the pink used elsewhere, that's intentional). Dark mode toggle. Download PDF button targets `#grid`, not the whole page (the toolbar shouldn't appear in the exported PDF).

Scrollbars are hidden everywhere on every renderer (the global `* { scrollbar-width: none; ... } *::-webkit-scrollbar { display: none; }` rule right after the box-sizing reset) — scrolling still works, there's just no visible track/thumb. Keep this rule intact.

## Step 5: Validate before delivering

1. Grep for any remaining `{{` strings — anything left is a bug.
2. Confirm every slide with an image has exactly two `__IMAGE_SLIDE_<n>__` tokens (one in the card face, one in `.card-detail`) — a missing or mismatched token means an image silently fails to render.
3. Run `node --check` on the inline `<script>` block.
