# Overview

## 1. Problem Statement

Consultants get handed a ton of source material — meeting transcripts, decks, PDFs — and have to sit through all of it just to dig out the useful bits. Most of what's in there isn't even relevant to what's needed in the moment, and it eats a lot of time. The goal is something that takes that raw material and turns it into a clean, shareable HTML page.

It's an artefact quick enough to skim so people don't have to read a whole transcript just to catch up on key happenings.

## 2. Requirements & Scope

Takes in transcripts, PPTs, PDFs as source input:
- Auto-detects whether the content fits a specific format — timeline, gallery, or bubble map. But lets the user override if they want a different variation
- Flags if source material has internal TCS content that shouldn't be pasted into a general chat tool

## 3. Current Status

Working MVP, three formats live (timeline, gallery, bubble map). Frontend has a preview deployed on Vercel, but that's UI-only — actual generation still needs the Express server running locally. Auto-detecting format from content (§2) isn't built yet; format is a manual pick via `FormatPicker` for now.

## 4. Next Up

- [ ] Bubble map: fix image captions
- [ ] Gallery: revisit which image gets picked per slide (currently just the first one found)
- [ ] Timeline: pass on fonts and overall visual look
- [ ] Handle larger source files without hitting token/size limits

## 5. See Also

- `assets/archictures-diagrams.png` - diagram image assets
- `design.md` — architecture and frontend flow
- `development.md` — skills, server/API, and implementation details
