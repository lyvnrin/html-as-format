---
name: render-starter
description: Scaffold reference for building a new skills/render-<name>/ renderer. Not a live renderer — excluded from auto-discovery by name (see server/index.js's discoverRenderFormats) so it never shows up in the format picker. Copy this folder to skills/render-<name>/ and fill it in.
---

# render-starter

This is a starting point, not a renderer — `render-starter` is filtered out of `/api/formats` by name alone, regardless of whether it has a `template.html`. To add a real renderer:

1. Copy this folder to `skills/render-<name>/`.
2. Fill in the sections below and delete the placeholder notes.
3. Add a `render<Name>` function in `server/index.js` that fills `template.html`'s placeholders from the slide data.

Once `SKILL.md` and a `template.html` (any file ending in `template.html`, at any depth in the folder — the existing renderers keep theirs under `assets/`) both exist in a `render-<name>` folder, `<name>` appears in `GET /api/formats` on the next server restart — no other code changes needed for it to appear in the picker. Wiring an actual generation endpoint for it is a separate step (see step 3 above and the existing `renderGallery`/`renderTimelineHtml`/`renderBubble` functions for the pattern).

## Step 1: Input data shape

Describe the JSON this renderer consumes — the output of `parseFile` (+ `captionImages`, if images matter here), or a further-extracted shape like `extractTimelineContent`'s. State per-field whether it's required or omitted-if-absent, and never fabricate a field the source doesn't have.

```json
{
  "slide": 0,
  "heading": "",
  "body": [],
  "images": []
}
```

## Step 2: Card/node type definitions

Name every distinct visual unit this renderer produces from a slide (e.g. "image card", "solid card", "timeline node") and, for each one:
- what triggers that type (e.g. "slide has no images" → solid card)
- what fields of the input it reads
- what it renders when a field is absent (never invent placeholder content)

## Step 3: Build the markup

State plainly whether building the markup is plain code (preferred — see `renderGallery`, `renderTimelineHtml`, `renderBubble` in `server/index.js`) or needs a Claude call. Only reach for a Claude tool call when a step needs real semantic judgment (grouping into themes, paraphrasing a label) that regex/heuristics can't make — everything else should be deterministic code for speed and cost.

List every `{{PLACEHOLDER}}` token this renderer's `renderX` function stamps into `template.html`, and what each one holds.

## Step 4: Chrome

Copy the shared chrome verbatim from an existing template (`skills/render-gallery/assets/gallery-template.html` is a good reference) — don't rewrite it:
- deck-info panel (title / author / count) inside the settings panel
- dark/light mode toggle
- Download PDF button (currently wired but visually/functionally disabled — `opacity: 0.4; pointer-events: none` — across every renderer; keep it that way unless asked otherwise)
- the global hide-scrollbar rule (`* { scrollbar-width: none; ... }`)

This starter's own `template.html` already has this chrome in place, wired to a single generic `#content` container — replace that container with this renderer's actual layout.
