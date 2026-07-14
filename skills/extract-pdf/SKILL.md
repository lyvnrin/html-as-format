---
name: extract-pdf
description: Extracts structured slide-like JSON from a PDF file — text content, section headings, and embedded images — in the same schema produced by parseFile.js for PPT input. Output feeds directly into any renderer skill. Use when the source file is a .pdf rather than a .pptx.
---

# extract-pdf

Takes a PDF file and produces the same structured JSON schema that `parseFile.js` outputs for PPT files. The output drops straight into any renderer skill (timeline, bubble, gallery) without modification.

## Step 1: Detect PDF type

Two meaningfully different cases — handle them differently:

**Slide-export PDF** (exported from PowerPoint or Keynote):
- Fixed aspect ratio pages (roughly 4:3 or 16:9)
- Sparse text per page, often a short heading + a few bullets
- 1 page = 1 slide. Don't merge or split.

**Document PDF** (report, brief, research paper):
- Portrait pages, dense text, paragraph structure
- No natural 1:1 page-to-slide mapping
- Group by section headings instead — each heading + its following body content becomes one "slide" object.

If genuinely ambiguous, treat as document PDF and note it.

## Step 2: Extract content

For each section/slide, extract:

- **heading**: the most prominent short line at the top of the section. For document PDFs, this is the section heading. For slide-export PDFs, this is the slide title. If no clear heading exists, derive a 3–6 word label from the first substantive sentence.
- **body[]**: array of strings. Each paragraph or bullet point is a separate string. Don't merge everything into one block — keep the array granular so renderers can lay it out properly.
- **images[]**: any embedded raster images, base64-encoded with `mime_type`. If a page is image-only with no extractable text, include the image and leave `heading` and `body` minimal or derived from context.

**Heading detection rules for document PDFs:**
- Short line (under ~60 chars), followed by a paragraph break
- All-caps or title-case lines that don't end in punctuation
- Lines that appear visually larger (if font metadata is available)
- When in doubt, prefer more sections over fewer — it's easier for a renderer to group than to split

## Step 3: Handle edge cases

| Situation | What to do |
|---|---|
| Scanned PDF (no text layer) | Flag it clearly: tell the user the PDF appears to be image-based and can't be extracted without OCR. Don't attempt to guess content. |
| Tables | Flatten to structured strings: `"Column A: value, Column B: value"` per row. Don't skip tables — they're usually important content. |
| Multi-column layout | Read left column top-to-bottom, then right column. Don't interleave. |
| Page with only an image | Include the image in `images[]`, set `heading` to null, `body` to `[]`. The VLM captioning step will handle it. |
| Very long sections (5+ paragraphs under one heading) | Split into two slide objects with the same heading, suffixed `(cont.)` on the second. |
| Cover page / title page | Include as slide 1 — heading = document title, body = subtitle/date/author if present. |

## Step 4: Output schema

Output a JSON array matching the parseFile.js schema exactly:

```json
[
  {
    "slide": 1,
    "heading": "Section or slide title",
    "body": [
      "First paragraph or bullet",
      "Second paragraph or bullet"
    ],
    "images": [
      {
        "base64": "...",
        "mime_type": "image/png"
      }
    ]
  }
]
```

- `slide` is 1-indexed, sequential, never skipped
- `heading` is string or null
- `body` is always an array, never a single string
- `images` is always an array, empty `[]` if none

## Step 5: Hand off to captionImages

If any slide object contains images, flag that the `captionImages.js` VLM step should run next — same as the PPT pipeline. The extraction skill doesn't caption; it just extracts.

## Step 6: Validate before saving

1. Every slide object has `slide`, `heading`, `body`, `images` — no missing keys
2. No slide has `body` as a plain string — must be an array
3. `slide` values are sequential with no gaps
4. Save as `extracted-content.json` to the working directory
