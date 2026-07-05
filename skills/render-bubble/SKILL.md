---
name: render-bubble
description: Renders the enriched slide JSON produced by the pptx image-extraction + captioning pipeline (parseFile → captionImages) as an interactive three-level bubble map — theme clusters, satellite slides, and image sub-bubbles. Like render-magazine, this consumes the raw enriched slide array directly (not the generic transcript-to-html extraction schema) because it needs real embedded images. Clicking a satellite expands it in place to reveal heading/body text and, if the slide has images, a mini cluster of image sub-bubbles; clicking one of those reveals the full-size image and caption. Shares the same interactive chrome as all other renderers: 5-colour theme picker, dark mode toggle, Download PDF button. Use this skill when the user asks for a bubble map, a cluster/node map, a mind-map-style layout, a thematic overview of a deck, or an exploratory non-linear alternative to a slide-by-slide format.
---

# render-bubble

Takes the enriched slide array produced by the pptx image pipeline (`parseFile` → `captionImages`) and renders it as a three-level bubble map: **theme bubbles** (clusters of slides) → **satellites** (individual slides, orbiting their theme) → **image sub-bubbles** (one per image on an expanded slide).

**Like render-magazine, this does not consume the generic `transcript-to-html` extraction schema.** That schema's `image_description` is text-only — the actual image never survives it. This format needs the real embedded image, so it must be given the raw enriched slide array directly: one object per slide, shaped `{ slide, heading, body[], images[] }`, where each entry in `images[]` is `{ base64, mime_type, caption }`.

**Unlike timeline/magazine, this renderer is data-driven, not markup-duplicated.** Instead of copy-pasting a `.node`/`.card` HTML block per item, you fill a single JSON blob describing themes → slides → images, and the template's JS computes every bubble's size and position at load time. This is deliberate — the radial math (Step 3) depends on how many themes/slides/images exist, which isn't known until you've read the deck, so it has to run generically at runtime rather than being hand-placed per item. Don't hand-write `.theme-bubble` / `.satellite` / `.subbubble` DOM yourself — the only thing you author is the JSON.

## Step 1: Read the enriched slide data

- Input is the array output by `captionImages(await parsePptx(...))`.
- Fields per slide: `slide` (number), `heading` (string), `body` (string array), `images` (array, empty if none).
- Read every slide before grouping into themes (Step 2) — don't theme-cluster from a partial read.
- Do not fabricate headings, body text, or captions beyond what's given. If `body` is empty, omit it rather than inventing content.

## Step 2: Identify themes

The input has no theme field — you assign one. Read all slide headings and body text, then group slides into a small number of logical themes/sections:

- Aim for roughly 3–8 themes for a typical 10–40 slide deck — fewer if the deck is short, more only if it's genuinely sprawling. Avoid two failure modes: one giant theme containing everything (defeats the point of clustering) and a theme per slide (same problem, no clustering happened).
- Every slide belongs to exactly one theme.
- If the deck has explicit section-divider slides (a slide that's just a big title with little/no body), treat those as a strong signal for where one theme ends and the next begins.
- Theme names: short (2–4 words), drawn from the actual content — e.g. "Market Landscape", "Product Roadmap" — never generic filler like "Section 1".
- Preserve original slide order within each theme; preserve theme order as first-encountered in the deck.

## Step 3: The radial math

The template's JS (`layoutBubbles()` in the `<script>` block) does all positioning generically from the data you provide — you never compute a pixel position yourself. This section documents how it works so you know why bubbles never overlap, and where the tunable constants live if a particular deck needs a different density.

**Core primitive — packing N circles evenly on a ring (`ringRadius()` in the script):**

Given N circles with radii `r_1..r_N` spaced evenly by angle (`2π/N` apart) around a ring of radius `R`, the distance between adjacent circle centers is `d = 2·R·sin(π/N)`. To keep two adjacent circles from overlapping, `d` must be at least `r_i + r_{i+1} + gap`. Solving for `R` per adjacent pair (including the wrap-around pair) and taking the max across all pairs gives the smallest ring radius that guarantees no two circles on that ring touch. N=1 is a special case — that one circle just sits out at a fixed offset from the ring center, no ring math needed. Circles are order-optimized before packing (largest/smallest interleaved via `orderForPacking()`) so two big circles never land next to each other and force a larger-than-necessary ring — this is a tightness optimization, not a correctness requirement.

**Level 1 — theme bubbles:**
- Diameter is area-proportional to slide count: `d = THEME_MIN_D + (THEME_MAX_D - THEME_MIN_D) * sqrt(count / maxCount)`, where `maxCount` is the largest theme's slide count. A theme with 4x the slides of another gets ~2x the diameter (matching area, not linear diameter) — the standard bubble-chart convention, so relative size reads accurately at a glance.
- Themes are packed on a single outer ring around the canvas center using `ringRadius()` — **but the radius fed in per theme isn't just its own bubble radius.** It's that theme's *effective cluster radius*: its own radius, plus however far its satellites orbit out (Level 2), plus the satellite radius itself. This is what stops one theme's satellite ring from colliding with the theme bubble next to it — see Level 2.
- If there's only one theme, it just sits at the canvas center — no ring needed.

**Level 2 — satellites (slides within a theme):**
- Each satellite is a fixed-size circle (`SATELLITE_D`) — not sized by any value, every slide is an equally-weighted node.
- Satellites for a given theme are packed on their own ring around that theme's bubble center, using `ringRadius()` with `r_i = SATELLITE_D/2` for every satellite in that theme.
- The orbit radius is `max(ringRadius(...), themeRadius + SATELLITE_D/2 + PARENT_GAP)` — the second term guarantees satellites clear their own parent bubble even when there are too few of them for mutual spacing alone to require a large ring (e.g. a theme with only 2 slides).
- This orbit radius + `SATELLITE_D/2` is exactly the "effective cluster radius" fed into Level 1's theme-ring packing — so a theme with many satellites orbiting far out automatically pushes its neighboring theme bubbles further away too. No theme's satellite ring can ever reach into an adjacent theme's space.

**Level 3 — image sub-bubbles (on an expanded satellite):**
- Same `ringRadius()` primitive, `r_i = SUBBUBBLE_D/2` for every image on that slide, orbiting the satellite's own center (which does not move when it expands — see Step 4).
- Pre-computed at layout time alongside everything else (not created on click) but kept `hidden` until that satellite expands — this is why the math is safe: the satellite's center is fixed from the start, expansion only changes its own size/shape, never its position.
- Only one satellite is ever expanded at a time (see Step 4), so a sub-bubble ring never has to worry about colliding with another theme's cluster.
- If a slide has multiple images, every image gets its own sub-bubble in this ring — never paginate or collapse multiple images into one sub-bubble.
- The expanded satellite panel is a rounded *rectangle*, not a circle, and can end up taller than wide if a slide has a lot of body text (up to 440px wide, 520px tall). `EXPANDED_RADIUS` is computed as the half-diagonal of the panel's largest possible size (clamped to the viewport), not a flat guess — so sub-bubbles clear the panel's actual corner even in the worst case, not just its width.

**Tunable constants** (top of the `<script>` block — change here if a specific deck needs different density, don't hardcode alternate values inline elsewhere):
```js
THEME_MIN_D = 120, THEME_MAX_D = 280, THEME_GAP = 28
SATELLITE_D = 64, SATELLITE_GAP = 16, PARENT_GAP = 20
SUBBUBBLE_D = 56, SUBBUBBLE_GAP = 14, SUBBUBBLE_PARENT_GAP = 18
```

## Step 4: Click / expand behaviour

- **Collapsed state:** theme bubbles show their name + slide count. Each satellite is rendered as **two separate elements sharing the same center point**: a small fixed-size `.satellite-dot` (just a slide number, plus a short cosmetic 3–5 word label floating below it) and a `.satellite-panel` card that exists in the DOM the whole time but sits scaled-down and invisible until expanded. This mirrors render-timeline's `.node-dot-btn` / `.node-panel` split exactly, and it's a deliberate correction: an earlier version tried to make *one* element be both the tiny circular dot and the multi-paragraph text panel by animating its width/height/border-radius, which read as "text crammed inside a bubble" in practice — a flex-centered, `overflow:hidden` circle fighting to also lay out wrapped paragraphs never looks right. Never go back to that single-element approach. The cosmetic label isn't part of the collision math, so in a dense theme neighboring labels may sit close together; that's an accepted tradeoff for keeping the packing math tractable.
- **Click a satellite's dot → its panel expands in place.** The panel is concentric with the dot (same `--cx`/`--cy`), so visually it reads as "the dot grew into this," but mechanically it's just the panel scaling from `0.82` to `1` and fading in (`transform`/`opacity`, both cheap to animate) while the dot underneath gets an `expanded` style (fills with `--accent`) and drops behind the panel's z-index. No dimension or shape is ever animated on the same element that holds the text.
- **Dim, don't reflow:** every other theme bubble and every other satellite dot gets a `dimmed` class (reduced opacity) — nothing else moves or repositions. This was the deliberate choice over push-apart reflow: it avoids a layout recalculation (and a second wave of overlap math) firing on every click. The expanded satellite's own parent theme bubble gets an `active` class instead of `dimmed`, so it stays visible as context.
- **If the expanded slide has images:** its pre-built sub-bubble cluster (Level 3) un-hides in a ring around the now-expanded panel. Each sub-bubble is the same dot+panel pair pattern at a smaller scale: the dot shows the image as a round cropped thumbnail (`object-fit: cover`), no caption yet — that's sub-sub-bubble territory.
- **Click an image sub-bubble → its panel expands too**, same treatment (dims its sibling sub-bubble dots only, leaves the parent satellite panel and theme bubble untouched), showing the **full, uncropped image plus its caption**. This is still a bubble — a card that grows out of a dot, not a lightbox/modal — consistent with "bubble map at every level, not a slideshow."
- **Collapsing:** click the dot again (toggles closed), click the panel's small `✕` close button, or click empty canvas background — all three collapse whatever's open. Clicking *inside* an expanded panel anywhere else (its heading, body text, image, caption) does nothing — it deliberately does not toggle-close on a generic click, so reading or selecting text doesn't slam the panel shut. Max one satellite expanded at a time; expanding a new one (or a different theme's satellite) auto-collapses whichever was open, including any expanded image sub-bubble beneath it.
- **Motion:** cinematic-glass easing to match render-timeline/render-magazine — `cubic-bezier(.2,.8,.2,1)` for the panel's scale-in, plain `ease` for opacity, soft `--accent-glow` box-shadows on hover/expand. Don't switch this to bouncy/elastic easing — the goal is that all three renderers feel like one product. Don't reintroduce width/height/border-radius transitions on the dot or panel — scale + opacity is both cheaper and the thing that actually avoids the "text in a bubble" failure mode.

## Step 5: Fill the template

Use `assets/bubble-template.html`. Copy it to your working directory.

1. Fill `{{BUBBLE_TITLE}}`, `{{BUBBLE_SUBTITLE}}`, `{{AUTHOR}}`.
2. Build the theme/slide/image structure from Steps 1–2 and replace the entire `{{BUBBLE_DATA}}` token (inside the `<script type="application/json" id="bubble-data">` tag) with one JSON object — no markdown fencing, no surrounding commentary:
   ```json
   {
     "themes": [
       {
         "name": "Theme Name",
         "slides": [
           {
             "index": 3,
             "heading": "...",
             "body": ["...", "..."],
             "images": [{ "src": "__IMAGE_SLIDE_3_1__", "caption": "..." }]
           }
         ]
       }
     ]
   }
   ```
3. **Image placeholders — critical, same rule as render-magazine:** never inline actual base64 data yourself. For every image on every slide, set its `src` to the exact literal token `__IMAGE_SLIDE_<slide>_<n>__` (`<slide>` = that slide's number, `<n>` = 1-based index of the image within that slide's `images[]`, so a slide with 2 images gets `__IMAGE_SLIDE_5_1__` and `__IMAGE_SLIDE_5_2__`). A code step after your output does a plain string substitution of each token for the real `data:` URI. Don't invent a filename or alter the token in any way.
4. `body` may be an array of multiple strings — join them as separate paragraphs in the panel, don't collapse to one run-on paragraph.

## Step 6: Chrome

Copy the toolbar HTML/CSS/JS verbatim from the existing templates — do not rewrite it. 5-colour theme picker (blue, green, purple, orange, **red** — same palette as render-magazine, blue is the default). Dark mode toggle. Download PDF button targets `#canvas` (the full bubble map at its actual computed size), not `#canvas-wrap` (the scrollable viewport) or the whole page — targeting the wrapper would only capture whatever's currently scrolled into view.

Scrollbars are hidden everywhere on every renderer (the global `* { scrollbar-width: none; ... } *::-webkit-scrollbar { display: none; }` rule right after the box-sizing reset) — scrolling still works, there's just no visible track/thumb. The canvas also supports click-and-drag panning (see the template's `mousedown`/`mousemove` handlers) since a big bubble map with invisible scrollbars needs an obvious way to explore it — don't remove that.

## Step 7: Validate before delivering

1. Grep for any remaining `{{` strings — anything left is a bug.
2. Confirm `{{BUBBLE_DATA}}` was replaced with valid JSON (e.g. pipe it through `node -e "JSON.parse(require('fs').readFileSync(0,'utf-8'))"`) — a syntax error here means the whole map fails to render.
3. Confirm no slide `heading`, `body` entry, or image `caption` contains the literal substring `</script` — that would terminate the data blob's script tag early and break the page. (Content this specific should never occur from a VLM caption or slide text, but check.)
4. Confirm every image across every slide has a correctly-numbered `__IMAGE_SLIDE_<slide>_<n>__` token and that no two images share a token.
5. Run `node --check` on the inline `<script>` block.

## Notes on extending

- If a fourth level of drill-down is ever needed, follow the same pattern: fixed-size sub-bubbles, `ringRadius()` for spacing, a separate dot+panel pair (never one element morphing shape) with scale/opacity expand and dim-siblings. Don't introduce a different interaction model for one level.
- `ringRadius()` and the tunable constants are the only things that should change if bubble density needs adjusting for a particular deck — don't add one-off inline overrides elsewhere in the script.
