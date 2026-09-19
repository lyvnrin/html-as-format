# HaF: Project Brief

## Problem statement

Consultants receive research and meeting content as dense slide decks and transcripts. These formats are slow to digest and hard to skim, especially under time pressure before a client call. The organisation needs a way to surface the key content in a format that's fast to read on any device, including large Pace Port touchscreens.

## What HaF does

HaF takes a source document (a `.pptx`, `.pdf`, or `.txt` transcript) and extracts structured content per slide using the Anthropic API. Extracted images are optionally captioned by a VLM step, so their content feeds back into generation even for renderers that never embed the image itself. The structured content is then piped through a renderer skill, which produces a self-contained, interactive HTML page: no server dependency at view time, no build step, just a file that opens and works anywhere.

## Output formats

HaF ships three renderers, each suited to a different shape of source material:

- **Timeline**: a vertical timeline, one card per slide, alternating left and right with expandable detail panels. Best for sequential, text-heavy decks where slide order carries meaning.
- **Gallery**: a masonry grid of image cards with a detail panel. Best for image-heavy presentations.
- **Bubble Map**: a non-linear, thematically clustered map, laid out with a force-relaxation circle packer for an organic, graph-view feel. Best for exploratory, topic-heavy content where the relationships between ideas matter more than their order.

A format picker in the app highlights the recommended renderer for whatever file is dropped, without forcing that choice.

## Shared chrome

All three output formats share the same interactive chrome: a dark/light mode toggle. Each template ships one fixed accent colour that mirrors the generator app's own palette; there is no runtime colour picker in the generated output.

## Target audience and surfaces

Consultants, viewing generated pages on laptops, phones, and Pace Port touchscreens.

## Team context

I built HaF during a summer 2026 internship on TCS's AI & Smart Technology team at 22 Bishopsgate, London. I was responsible for the architecture, planning, and concept translation, and implemented it using Claude Code.

## Use cases

- A consultant receives a 40-slide strategy deck the night before a client call and needs the highlights fast, without reading the whole thing slide by slide.
- A team lead wants a meeting's notes formatted and shareable with the wider team, rather than forwarding a raw transcript.
- A researcher is exploring cross-cutting themes in an image-heavy report and wants to move between related ideas non-linearly rather than page by page.

## Tools to develop in the future

- **PDF export**: a working Download PDF button on generated pages. It was previously wired up via html2pdf.js but has since been removed; re-adding it properly (page breaks, print-friendly layout per renderer) is future work.
- **OCR for scanned PDFs**: image-only PDFs with no text layer are currently rejected outright at extraction time. Supporting them would need an OCR step ahead of the existing text-structuring call.
- **A real accent colour picker**: each generated page currently ships one fixed accent colour baked into its template at generation time, with no way to change it after the fact. A genuine runtime colour picker in the output pages is not yet implemented.
