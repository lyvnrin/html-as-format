---
name: transcript-to-html
description: Transforms meeting transcripts, PDFs, PPTs, or other source documents into a polished, responsive, on-brand HTML page — with a working theme switcher, dark mode, and a one-click PDF export button built in. Use this skill whenever the user uploads or pastes a transcript, document, or deck and asks for HTML output, a "knowledge management" style page, meeting notes, a write-up, a case study, or anything described as "storytelling," "engaging," "polished," or "easy to skim." Also trigger when the user asks to turn notes/a recording/a document into something shareable, presentable, or web-ready. Two output formats are available — meeting notes (action-oriented, structured) and case-study/narrative (timeline, pull quotes, key moments) — and this skill auto-detects which fits the source content, while always respecting an explicit user preference if one is stated. This skill also supports a two-step pipeline mode: extract content to a structured JSON schema first, then pass that JSON to a separate renderer skill (render-timeline, render-bubble, etc.) for alternative output formats.
---

# Transcript / Document → HTML

Turns raw source material (meeting transcripts, PDFs, PPTs, pasted notes) into a polished, responsive HTML page using one of two pre-built templates. Both templates share the same interactive chrome: a 5-colour theme picker, dark mode toggle, and a "Download PDF" button that exports the content (not the toolbar) as a real PDF client-side.

This skill can also operate in **extraction-only mode** — outputting a structured JSON file instead of HTML, for use as input to a separate renderer skill. See Step 2b.

## Step 1: Get the source content

- If the user uploaded a file (.pdf, .pptx, .docx, etc.), read it first. Check `/mnt/skills/public/pdf-reading/SKILL.md` or `/mnt/skills/public/pptx/SKILL.md` as appropriate for extraction guidance — don't guess at a PDF/PPT's content without actually reading it.
- If the user pasted a transcript or notes directly into chat, that's your source — no extraction needed.
- If the source is large (long transcript, multi-section deck), read/skim the whole thing before drafting. Don't start writing the HTML from a partial read.

## Step 2: Pick the output format

Two templates are available in `assets/`:

| Template | File | Best for |
|---|---|---|
| **Meeting notes** | `assets/meeting-notes-template.html` | Meeting transcripts, standups, decision logs — anything with attendees, discussion points, and action items/owners/due dates |
| **Case study** | `assets/case-study-template.html` | Narrative source material — project retrospectives, interview transcripts, event recaps, research summaries, anything with a beginning/middle/end or a sequence of moments worth telling as a story |

**Auto-detect by default:**
- Has named attendees + discrete discussion points + clear action items with owners → **meeting notes**
- Has a narrative arc, notable quotes, a sequence of events/decisions over time, or no clear "owner per task" structure → **case study**
- If genuinely ambiguous, default to meeting notes (it's the more common case) but mention your choice in one line so the user can redirect you.

**Always override auto-detection if the user states a preference** — e.g. "make this a case study," "I want the timeline format," "just do meeting notes." Don't ask permission to switch; just use what they asked for.

## Step 2b: Extraction-only mode (pipeline use)

If the user asks to **extract to JSON** or a renderer skill is the intended downstream consumer, skip Steps 2–4 and output a structured JSON file instead of HTML.

Extract everything available from the source — don't make assumptions about what a renderer will need:

```json
{
  "source": {
    "filename": "",
    "type": "pptx",
    "slide_count": 0,
    "extracted_at": ""
  },
  "meta": {
    "title": "",
    "subtitle": "",
    "author": "",
    "date": "",
    "topic": "",
    "summary": ""
  },
  "slides": [
    {
      "index": 1,
      "heading": "",
      "subheading": "",
      "body": [],
      "bullets": [],
      "speaker_notes": "",
      "key_stat": "",
      "image_description": "",
      "layout_hint": ""
    }
  ],
  "themes": [],
  "key_moments": [],
  "glossary": []
}
```

**Field notes:**
- `body` vs `bullets` — keep separate; some slides are prose-heavy, some are bullet-heavy; renderers pick whichever fits
- `image_description` — describe any visuals on the slide in plain language; images don't transfer so this gives renderers something to work with
- `layout_hint` — Claude's read on the slide type: `"title"`, `"section-divider"`, `"content"`, `"data"`, `"closing"` etc.
- `themes` — top-level topics identified across the whole deck, useful for bubble/node renderers
- `key_moments` — Claude's pick of the 3–5 most significant slides by index, useful for renderers that surface standouts
- `glossary` — any domain-specific terms worth surfacing, leave empty array if none

Save the JSON to `/mnt/user-data/outputs/extracted-content.json` and present it. The downstream renderer skill will consume this file.

## Step 3: Fill the template

1. Read the chosen template file from `assets/` in full.
2. Copy it to your working directory, then fill every `{{PLACEHOLDER}}`.
3. **Duplicate repeatable blocks** as needed — both templates have HTML comments marking exactly which `<div>` blocks to copy for additional attendees, discussion points, action items, timeline entries, or moment cards. Don't leave placeholder scaffolding unfilled or delete sections the source content doesn't need (e.g. if there's no clear pull quote, write a strong representative line yourself rather than leaving it empty — but never fabricate a quote and attribute it to a real named speaker; paraphrase instead and drop the quotation marks if you're not using their literal words).
4. Avatar colours: keep them **hardcoded per-person** (not tied to `--accent`) so people stay visually distinct regardless of which theme is selected — see the existing colour-coding pattern in a filled example if one exists in the conversation, otherwise pick distinct hues per person (e.g. `#2b5be0`, `#1a7a4a`, `#7c5cbf`, `#b5650a`, `#6b46c1`...).
5. Default `data-theme` on `<body>` is `"blue"` — change it if the user has a stated colour preference, otherwise leave it and let them switch live in the toolbar.

## Step 4: Writing the content itself

This isn't just a fill-in-the-blanks exercise — the copy quality matters as much as the layout:

- **Summaries/deks**: tight, specific, no filler. State the actual goal/outcome, not "this meeting was about...".
- **Discussion points / narrative paragraphs**: written in third person, past tense, attributed to the right speaker. Paraphrase — never invent dialogue or put words in someone's mouth that they didn't say.
- **Action items**: lead with a strong verb, keep the detail line concrete (what, not just that something needs doing).
- **Pull quotes** (case-study format): pick or paraphrase the single most striking, specific line from the source. Skip generic statements.
- **Timeline/moment titles**: short and scannable — a reader skimming just the bold titles should get the gist.
- Check `/mnt/skills/user/anti-ai-writing-style/SKILL.md` if it's present — apply it to any prose you write here (deks, narrative paragraphs, summaries) so it doesn't read with default LLM rhythm.

## Step 5: Validate before delivering

Both templates load `html2pdf.js` from a CDN and run inline JS for the toolbar. Before presenting the file:

1. Confirm every `{{PLACEHOLDER}}` has been replaced — grep for `{{` in the final file; anything left is a bug.
2. Validate the inline `<script>` block parses (extract it and run `node --check` on it) — a single stray unescaped quote inside a JS string will break the entire page silently.
3. Save to `/mnt/user-data/outputs/` and use `present_files`.

## Notes on extending

- Both templates share an identical "chrome" (theme tokens, toolbar CSS/HTML, dark mode + theme-switcher + PDF-export JS). If you build a third format later, copy that shared chrome verbatim from either template rather than rewriting it, so all formats stay visually and behaviorally consistent.
- If the user asks for a brand-new theme colour, add a new `[data-theme="name"]` CSS block (4 hex values: `--accent`, `--accent-soft`, `--accent-dark`, `--accent-dark-soft`) and a matching `<button class="theme-dot" data-t="name">` in the toolbar — do this in both template files if it should be a permanent addition, or just the one in use if it's one-off.
- For alternative output formats (timeline, bubble map, scrollytelling etc.), use extraction-only mode (Step 2b) to produce the JSON, then pass it to the appropriate renderer skill (`render-timeline`, `render-bubble`, etc.). The renderer skills each have their own SKILL.md and template assets.
