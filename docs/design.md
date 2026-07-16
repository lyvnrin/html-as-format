# Design

## 1. Architecture

Moving away from a single, monolithic skill and towards a two-layer architecture.

### Layer 1: Extraction Skill
Parses the source document (PPT, PDF, transcript) once and outputs a clean, structured intermediate format — slide headings, content per section, key points, metadata. Format-agnostic and reusable of what view the user picks.

### Layer 2: Render Skills
Each renderer takes the extracted output, so if a consultant wants to change the view, they don't re-parse the document. Instead, the extracted content just gets passed to a different renderer.

## 2 Frontend Flow

Upload doc → extraction skill parses content → user picks a view → renderer skill outputs HTML
- If a user dislikes the view, frontend passes the same extracted content to a different renderer, so no re-parsing is needed.

## 3. Render Format Variations

- Timeline - an interactive vertical timeline with expandable detail
- Gallery - an interactive masonry grid of expandable photo cards
- Bubble Map - an interactive, clustered map for non-linear exloration 
