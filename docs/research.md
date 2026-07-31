# Research

Notes and rationale, not a spec. See `overview.md` for the problem/scope and `design.md` for decisions that landed.

## 1. Why HTML as the output format

The core argument: HTML is the most portable, device-agnostic document format available. PDFs are fixed-layout and don't adapt to screen size. PPTs require specific software and are designed for presenting, not reading. HTML renders natively in any browser on any device, can be responsive, interactive, and styled for different reading contexts.

This matters because the output needs to work in two very different contexts: a consultant skimming on a laptop before a meeting, and a Pace Port touchscreen in a client-facing space. A single HTML file handles both without any viewer software or format conversion. It's also self-contained (inline CSS/JS, no external dependencies), so it can be shared as a link or saved locally.

Google's open knowledge format work explores similar ideas around making knowledge assets more shareable and less locked to specific tools.

- https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing

## 2. Render format rationale

Three formats were chosen to cover different source material shapes. The original plan was five, but three covers the meaningful variation without spreading effort too thin. Each format suits a different reading mode:

**Timeline** — for sequential content where slide order carries meaning (project retrospectives, phased plans, chronological narratives). The reader steps through in order but can jump to any point. Chose a vertical centre-rail layout with alternating left/right detail panels; horizontal timelines were considered but don't scale well when node count varies.

**Magazine** — for image-heavy decks where the visuals are the point (portfolio pieces, research with charts/photos, design reviews). Masonry grid using CSS `column-count` so varied card heights feel like a photo board, not a rigid table. The Pinterest model is the reference here: cards are scannable at a glance, click to expand for detail.

**Bubble map** — for non-linear exploration where relationships between ideas matter more than sequence (research decks, topic-heavy presentations, strategy documents). Organic circle packing rather than a tree or mind-map, because the input doesn't have a natural hierarchy. Sized by content weight using area-proportional scaling (square root), packed with deterministic force-relaxation rather than a grid.

- https://claudeai.dev/blog/claude-code-html-artifacts/

## 3. Skills-based architecture

The system uses a "skills" pattern rather than hand-coded generators. Each skill is a SKILL.md (natural language instructions) plus an HTML template with placeholder blocks, consumed by an LLM call at render time. The alternative was writing a code-based HTML builder per format.

Reasons for the skills approach:

- Rendering involves editorial judgement (shortening headings, grouping slides into themes, choosing highlights) that's hard to encode procedurally. Natural language instructions handle this naturally.
- Adding a new format means writing a new skill and template, not a new code path. The server dispatch logic stays the same.
- Skills are version-controlled markdown files, easy to iterate on and review. Changes to how a renderer behaves are text edits, not code changes.
- The same skill files double as documentation of the renderer's behaviour, constraints, and rejected approaches.

Tradeoff: output quality depends on model reliability, and generation takes 10-30 seconds per render. But for internal tooling where the alternative is a consultant spending 20 minutes reading a raw transcript, the latency is acceptable.

## 4. Frontend styling references

Palette and typography choices for the frontend (not the rendered HTML output, which has its own theming system):

- Warm paper background (`#faf9f6`) rather than pure white, to feel less clinical
- `Inter` for body copy, `JetBrains Mono` for code-adjacent elements (step numbers, format labels)
- Single blue accent (`#2b5be0`) carried through from the default renderer theme
- CSS Modules per component, no global utility framework

The rendered HTML pages use a separate system-font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`) to keep the output lightweight and self-contained without requiring font downloads.