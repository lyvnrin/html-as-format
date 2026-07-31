# Overview

## 1. Problem Statement

Consultants get handed a lot of source material (meeting transcripts, slide decks, PDFs) and have to sit through all of it just to dig out the useful bits. Most of it isn't relevant to what's needed in the moment, and it eats time. The goal is to take that raw material and turn it into a clean, shareable HTML page, quick enough to skim that people don't have to read a whole transcript just to catch up on what happened.

Output pages are designed for two contexts: shared as standalone HTML links between colleagues, and displayed on Pace Port touchscreens in client-facing spaces.

## 2. Requirements & Scope

**Input:** transcripts, PPTs, PDFs, plain text.

**Output:** a self-contained, interactive HTML page with theming (5-colour picker), dark/light mode, and a working PDF export button. One file, no external dependencies, opens in any browser.

**Format selection:** three renderer formats are available (timeline, magazine, bubble map). The user picks one via a format picker in the frontend. The UI offers a "text-heavy / image-heavy / both" filter that highlights the recommended format based on what was uploaded. Auto-detecting format from the source content itself isn't built yet; it's a manual choice for now.

**Content safety:** source material may include real internal TCS content. The tool should flag if anything looks like it shouldn't be pasted into a general-purpose chat tool.

**Writing standards:** paraphrase, never invent quotes or attribute dialogue to real people. Summaries should be tight and specific, no filler. Default to corporate/neutral tone since output may be shown to colleagues or stakeholders.

## 3. Current Status

Working MVP. Three formats are live: timeline (text-heavy sequential decks), magazine (image-heavy decks as a masonry grid), and bubble map (non-linear thematic exploration). The full pipeline runs locally: upload a `.pptx`, `.pdf`, or `.txt` file, pick a format, get back a rendered HTML page.

Frontend is deployed to Vercel as a UI preview, but that's frontend-only. There's no backend behind it, so actual generation still requires the Express server running on localhost.

## 4. Next Up

- [ ] Bubble map: fix image captions
- [ ] Magazine: revisit which image gets picked per slide (currently just the first one found)
- [ ] Timeline: fonts and overall visual polish
- [ ] Handle larger source files without hitting token/size limits

## 5. See Also

- `assets/architecture-diagrams.png` for pipeline and skill anatomy diagrams
- `design.md` for architecture decisions, renderer interaction patterns, and chrome design
- `development.md` for skills, extraction pipeline, server/API, and frontend details
- `research.md` for background research and comparisons