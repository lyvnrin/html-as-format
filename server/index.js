import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'
import { parseFile } from './lib/parseFile.js'
import { captionImages } from './lib/captionImages.js'
import { startGenerationLog, finishGenerationLog } from './lib/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(ROOT, '.env') })

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIMELINE_TEMPLATE = fs.readFileSync(
  path.join(ROOT, 'skills/render-timeline/assets/timeline-template.html'),
  'utf-8',
)
const GALLERY_TEMPLATE = fs.readFileSync(
  path.join(ROOT, 'skills/render-gallery/assets/gallery-template.html'),
  'utf-8',
)
const BUBBLE_TEMPLATE = fs.readFileSync(
  path.join(ROOT, 'skills/render-bubble/assets/bubble-template.html'),
  'utf-8',
)

const MODEL = 'claude-sonnet-4-6'

// Forcing a tool call instead of asking for freeform JSON in the response
// text means the API itself parses/validates the JSON (via the tool's
// input_schema) rather than a hand-rolled JSON.parse on raw model text,
// which broke on unescaped characters (quotes, newlines) inside extracted
// prose in practice.
const TIMELINE_EXTRACTION_TOOL = {
  name: 'submit_timeline_content',
  description: 'Submit the extracted timeline content.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      slides: {
        type: 'array',
        description:
          'A native JSON array of slide objects — never a JSON-encoded string. Each item is an object, not text.',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            label: { type: 'string' },
            subheading: { type: 'string' },
            body: { type: 'array', items: { type: 'string' } },
            bullets: { type: 'array', items: { type: 'string' } },
            key_stat: { type: 'string' },
          },
          required: ['heading', 'label'],
        },
      },
      key_moments: { type: 'array', items: { type: 'integer' } },
    },
    required: ['title', 'slides', 'key_moments'],
  },
}

const THEME_GROUPING_TOOL = {
  name: 'submit_theme_groupings',
  description: 'Submit the theme groupings for the given slides.',
  input_schema: {
    type: 'object',
    properties: {
      themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slides: { type: 'array', items: { type: 'integer' } },
          },
          required: ['name', 'slides'],
        },
      },
    },
    required: ['themes'],
  },
}

function stripImageData(slides) {
  return slides.map((slide) => ({
    slide: slide.slide,
    heading: slide.heading,
    body: slide.body,
    image_captions: (slide.images || []).map((image) => image.caption).filter(Boolean),
  }))
}

// Writing per-node content (shortening a heading to a glance label, picking
// out a key_stat, choosing the 3-5 key_moments) needs real reading
// comprehension, so extraction still goes through the model — but it only
// ever returns the small structured JSON below, never the ~1000-line
// template's HTML/CSS/JS boilerplate. Stamping that JSON into the template
// (renderTimelineHtml, further down) is pure data shaping and runs as code,
// the same way render-gallery and render-bubble dropped their full-HTML LLM
// calls.
async function extractTimelineContent(fileContent, { signal } = {}) {
  const sourceText = Array.isArray(fileContent)
    ? JSON.stringify(stripImageData(fileContent), null, 2)
    : fileContent

  const prompt = `Extract structured content from the following source document so it can be rendered as a vertical timeline, one node per slide/section.

For each slide/section produce:
- "heading": the full original heading/title text
- "label": a short 4-6 word paraphrase of the heading for a compact glance label — write a shorter version only if the original is long, otherwise reuse it as-is
- "subheading": a one-line subheading, omit the key entirely if the source has none
- "body": array of body paragraph strings (prose), omit the key entirely if none
- "bullets": array of bullet point strings, omit the key entirely if none
- "key_stat": a single standout number/stat from this slide/section if one clearly exists, omit the key entirely otherwise

Also produce:
- "title": a short one-line document title
- "key_moments": the 1-based indices (matching slide/section order) of the 3-5 most significant nodes, fewer if the source is short

Rules:
- Never invent content not present in the source — leave a key out rather than fabricating it.
- Preserve source order.
- Read the entire source before extracting — don't extract from a partial read.
- If a slide is essentially a pull quote (a standalone quoted line, often with a speaker attribution), don't wrap it in literal quotation marks — put the words themselves in "heading" or "body" and the speaker attribution as a separate short "body" entry. Never place a literal " character inside any text field.
- "slides" must be submitted as a real, native JSON array of objects in the tool call — never as a JSON-encoded string.

Source document content:

${sourceText}`

  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      tools: [TIMELINE_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: TIMELINE_EXTRACTION_TOOL.name },
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  )

  if (response.stop_reason === 'max_tokens') {
    console.error('extractTimelineContent: response hit max_tokens, extraction may be truncated')
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use')
  return toolUse.input
}

function galleryImagePlaceholder(slideNumber, imageIndex) {
  return `__IMAGE_SLIDE_${slideNumber}_${imageIndex}__`
}

function embedGalleryImages(html, slides) {
  return slides.reduce((output, slide) => {
    const images = slide.images || []
    return images.reduce((out, image, i) => {
      const dataUri = `data:${image.mime_type};base64,${image.base64}`
      return out.split(galleryImagePlaceholder(slide.slide, i + 1)).join(dataUri)
    }, output)
  }, html)
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// --- Body content block detection ---
// Groups a slide's flat body[] array into typed content blocks (stat / steps
// / prose) so the detail panel renders each kind of content appropriately,
// instead of a single uniform bullet list. Detection is deterministic
// (regex/word-count heuristics), not an LLM call — see SKILL.md for why.

function isStatValue(line) {
  return /^\$?[\d,.]+[%BbMmKk]?$/.test(line.trim())
}

function isStepLabel(line) {
  const trimmed = line.trim()
  if (isStatValue(trimmed)) return false
  if (trimmed.startsWith('**')) return true
  const wordCount = trimmed.split(/\s+/).length
  return wordCount < 6 && !/[.!?]$/.test(trimmed)
}

function stripBold(line) {
  return line.trim().replace(/^\*\*|\*\*$/g, '')
}

// A step unit is [label, description]. Rule order below checks steps before
// stats — spec lists Stat first, but real decks carry a bare step-number
// entry ("01") ahead of the label ("Discovery"); under strict stat-first
// order that number gets swallowed as a lone stat instead of a step marker,
// which breaks the "01 Discovery / 02 Consideration" acceptance case. The
// leading number (if present) is discarded here since steps are
// auto-numbered from 01 on render anyway.
function tryConsumeStep(body, i) {
  let idx = i
  if (idx < body.length && /^\d{1,3}$/.test(body[idx].trim())) {
    idx += 1
  }
  if (idx >= body.length || !isStepLabel(body[idx])) return null
  const label = stripBold(body[idx])
  idx += 1
  if (idx >= body.length || isStatValue(body[idx]) || isStepLabel(body[idx])) return null
  const description = body[idx]
  idx += 1
  return { label, description, next: idx }
}

function tryConsumeStepRun(body, i) {
  const items = []
  let idx = i
  while (idx < body.length) {
    const step = tryConsumeStep(body, idx)
    if (!step) break
    items.push(step)
    idx = step.next
  }
  return items.length > 0 ? { items, next: idx } : null
}

// One or more [value, label] pairs — the next entry is consumed as the
// label whenever it doesn't itself match the stat pattern.
function tryConsumeStatRun(body, i) {
  const items = []
  let idx = i
  while (idx < body.length && isStatValue(body[idx])) {
    const value = body[idx].trim()
    idx += 1
    let label = ''
    if (idx < body.length && !isStatValue(body[idx])) {
      label = body[idx]
      idx += 1
    }
    items.push({ value, label })
  }
  return items.length > 0 ? { items, next: idx } : null
}

function groupBodyIntoBlocks(body) {
  const blocks = []
  let i = 0
  while (i < body.length) {
    const stepRun = tryConsumeStepRun(body, i)
    if (stepRun) {
      blocks.push({ type: 'steps', items: stepRun.items })
      i = stepRun.next
      continue
    }
    const statRun = tryConsumeStatRun(body, i)
    if (statRun) {
      blocks.push({ type: 'stats', items: statRun.items })
      i = statRun.next
      continue
    }
    const last = blocks[blocks.length - 1]
    if (last && last.type === 'prose') {
      last.items.push(body[i])
    } else {
      blocks.push({ type: 'prose', items: [body[i]] })
    }
    i += 1
  }
  return blocks
}

function renderStatBlock(items) {
  const statItems = items
    .map(
      ({ value, label }) => `  <div class="stat-item">
    <div class="stat-value">${escapeHtml(value)}</div>
    <div class="stat-label">${escapeHtml(label)}</div>
  </div>`,
    )
    .join('\n')
  return `<div class="block-stat">\n${statItems}\n</div>`
}

function renderStepsBlock(items) {
  const steps = items
    .map(({ label, description }, i) => {
      const num = String(i + 1).padStart(2, '0')
      return `  <div class="step">
    <span class="step-num">${num}</span>
    <span class="step-label">${escapeHtml(label)}</span>
    <span class="step-desc">${escapeHtml(description)}</span>
  </div>`
    })
    .join('\n')
  return `<div class="block-steps">\n${steps}\n</div>`
}

function renderProseBlock(items) {
  const paragraphs = items.map((line) => `  <p>${escapeHtml(line)}</p>`).join('\n')
  return `<div class="block-prose">\n${paragraphs}\n</div>`
}

function galleryBodyBlocksHtml(body) {
  if (!body || body.length === 0) return ''
  return groupBodyIntoBlocks(body)
    .map((block) => {
      if (block.type === 'stats') return renderStatBlock(block.items)
      if (block.type === 'steps') return renderStepsBlock(block.items)
      return renderProseBlock(block.items)
    })
    .join('\n')
}

// One card per image. The first image on a slide carries the slide's full
// content (body bullets + its own VLM caption); additional images on the
// same slide get a lighter card — same heading, no repeated body text, and
// the slide's heading used as the caption instead of duplicating content.
function galleryImageCardHtml(slide, image, imageIndex, isPrimary) {
  const heading = escapeHtml(slide.heading || `Slide ${slide.slide}`)
  const placeholder = galleryImagePlaceholder(slide.slide, imageIndex)
  const bodyHtml = isPrimary ? galleryBodyBlocksHtml(slide.body) : ''
  const captionText = isPrimary ? image.caption : slide.heading
  // <details>/<summary> rather than a JS-driven toggle: the overlay panel
  // clones this markup wholesale via cloneNode(true) (see the click handler
  // in the template's <script>), which drops any addEventListener a custom
  // button would need — <details> needs no listener, so it keeps working
  // post-clone for free, and is keyboard-operable without extra work.
  const captionHtml = captionText
    ? `\n            <details class="panel-caption-toggle">
              <summary>Show image description</summary>
              <p class="panel-caption">${escapeHtml(captionText)}</p>
            </details>`
    : ''

  return `      <div class="card" data-index="${slide.slide}-${imageIndex}">
        <div class="card-face">
          <div class="card-image-wrap">
            <img class="card-image" src="${placeholder}" alt="${heading}">
          </div>
          <div class="card-title">${heading}</div>
        </div>
        <div class="card-detail" hidden>
          <div class="panel-media"><img src="${placeholder}" alt="${heading}"></div>
          <div class="panel-content">
            <h2>${heading}</h2>
            ${bodyHtml}${captionHtml}
          </div>
        </div>
      </div>`
}

function gallerySolidCardHtml(slide) {
  const heading = escapeHtml(slide.heading || `Slide ${slide.slide}`)
  const bodyHtml = galleryBodyBlocksHtml(slide.body)

  return `      <div class="card" data-index="${slide.slide}">
        <div class="card-face card-solid">
          <div class="card-heading-solid">${heading}</div>
        </div>
        <div class="card-detail" hidden>
          <div class="panel-media"><div class="card-heading-solid">${heading}</div></div>
          <div class="panel-content">
            <h2>${heading}</h2>
            ${bodyHtml}
          </div>
        </div>
      </div>`
}

function galleryCardsForSlide(slide) {
  const images = slide.images || []
  if (images.length === 0) return [gallerySolidCardHtml(slide)]
  return images.map((image, i) => galleryImageCardHtml(slide, image, i + 1, i === 0))
}

function titleFromFilename(filename) {
  const base = filename.replace(/\.[^/.]+$/, '')
  return base
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function fillPlaceholder(html, token, value) {
  return html.split(token).join(value)
}

function renderGallery(slides, filename) {
  const cardsHtml = slides.flatMap(galleryCardsForSlide).join('\n\n')
  const title = escapeHtml(slides[0]?.heading || titleFromFilename(filename))
  const subtitle = `${slides.length} slide${slides.length === 1 ? '' : 's'}`

  let html = GALLERY_TEMPLATE
  html = fillPlaceholder(html, '{{GALLERY_TITLE}}', title)
  html = fillPlaceholder(html, '{{GALLERY_SUBTITLE}}', subtitle)
  html = fillPlaceholder(html, '{{AUTHOR}}', '')
  html = fillPlaceholder(html, '{{GALLERY_CARDS}}', cardsHtml)

  return embedGalleryImages(html, slides)
}

function timelineNodeHtml(slide, index, isHighlight) {
  const side = index % 2 === 1 ? 'side-left' : 'side-right'
  const displayIndex = String(index).padStart(2, '0')
  const heading = escapeHtml(slide.heading || `Slide ${index}`)
  const label = escapeHtml(slide.label || slide.heading || `Slide ${index}`)
  const keyStat = slide.key_stat ? escapeHtml(slide.key_stat) : ''
  const subheadingHtml = slide.subheading
    ? `\n          <p class="detail-subheading">${escapeHtml(slide.subheading)}</p>`
    : ''
  const bodyHtml = (slide.body || [])
    .map((p) => `<p class="detail-body">${escapeHtml(p)}</p>`)
    .join('\n          ')
  const bulletsHtml =
    slide.bullets && slide.bullets.length > 0
      ? `\n          <ul class="detail-bullets">\n            ${slide.bullets
          .map((b) => `<li>${escapeHtml(b)}</li>`)
          .join('\n            ')}\n          </ul>`
      : ''

  const cardHtml = `<div class="tl-node-detail">
          <div class="detail-stat">${keyStat}</div>
          <h2 class="detail-heading">${heading}</h2>${subheadingHtml}
          ${bodyHtml}${bulletsHtml}
        </div>`

  // DOM order is always [slot][center][slot] — which slot gets the card
  // (the other renders empty) is what drives the left/right side, via each
  // slot's justify-content in the template's CSS. See timeline-template.html.
  const leftSlot = side === 'side-left' ? cardHtml : ''
  const rightSlot = side === 'side-right' ? cardHtml : ''

  return `      <div class="tl-node ${side}${isHighlight ? ' highlight' : ''}" data-index="${index}">
        <div class="tl-node-slot">${leftSlot}</div>
        <div class="tl-node-center">
          <button class="tl-dot" aria-label="Open node ${index}" aria-expanded="false"></button>
          <div class="tl-node-meta">
            <span class="tl-node-index">${displayIndex}</span>
            <button class="tl-node-label">${label}</button>
            <span class="tl-node-stat">${keyStat}</span>
          </div>
        </div>
        <div class="tl-node-slot">${rightSlot}</div>
      </div>`
}

// The tool's input_schema declares "slides"/"key_moments" as arrays, but
// isn't a hard runtime guarantee — normalize defensively rather than
// crashing outright if the model ever emits an object keyed by index instead.
function toArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : toArray(parsed)
    } catch (err) {
      console.error('toArray: failed to parse stringified array:', err.message)
      return []
    }
  }
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

function renderTimelineHtml(extracted, filename) {
  const slides = toArray(extracted.slides)
  const keyMoments = new Set(toArray(extracted.key_moments))
  const nodesHtml = slides
    .map((slide, i) => timelineNodeHtml(slide, i + 1, keyMoments.has(i + 1)))
    .join('\n\n')
  const title = escapeHtml(extracted.title || titleFromFilename(filename))

  let html = TIMELINE_TEMPLATE
  html = fillPlaceholder(html, '{{TIMELINE_TITLE}}', title)
  html = fillPlaceholder(html, '{{AUTHOR}}', '')
  html = fillPlaceholder(html, '{{TIMELINE_NODES}}', nodesHtml)
  return html
}

function bubbleImagePlaceholder(slideNumber, imageIndex) {
  return `__IMAGE_SLIDE_${slideNumber}_${imageIndex}__`
}

function embedBubbleImages(html, slides) {
  return slides.reduce((output, slide) => {
    return (slide.images || []).reduce((out, image, i) => {
      const token = bubbleImagePlaceholder(slide.slide, i + 1)
      const dataUri = `data:${image.mime_type};base64,${image.base64}`
      return out.split(token).join(dataUri)
    }, output)
  }, html)
}

// Grouping slides into themes needs real semantic understanding (a section
// break, a topic shift) that can't be inferred mechanically, so this is the
// one piece of bubble rendering that still needs the LLM. Everything else
// (Step 5 of the skill — building the JSON blob and filling the template) is
// pure data shaping and runs as plain code below, the same way render-gallery
// dropped its LLM call entirely.
async function identifyThemes(slides, { signal } = {}) {
  const slideSummaries = slides.map((slide) => ({
    slide: slide.slide,
    heading: slide.heading,
    body: slide.body,
  }))

  const prompt = `Group the following presentation slides into 3-8 logical themes/sections based on their heading and body content.

Rules:
- Every slide belongs to exactly one theme.
- Preserve original slide order within each theme; preserve theme order as first-encountered in the deck.
- If the deck has explicit section-divider slides (a slide that's just a big title with little/no body), treat those as a strong signal for where one theme ends and the next begins.
- Theme names: short (2-4 words), drawn from the actual content — never generic filler like "Section 1".
- Aim for roughly 3-8 themes for a typical 10-40 slide deck — fewer if the deck is short, more only if it's genuinely sprawling.

Slides:
${JSON.stringify(slideSummaries, null, 2)}`

  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 2048,
      tools: [THEME_GROUPING_TOOL],
      tool_choice: { type: 'tool', name: THEME_GROUPING_TOOL.name },
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  )

  const toolUse = response.content.find((block) => block.type === 'tool_use')
  return toolUse.input.themes
}

function bubbleSlideData(slide) {
  const entry = { index: slide.slide, heading: slide.heading }
  if (slide.body && slide.body.length > 0) entry.body = slide.body
  const images = slide.images || []
  if (images.length > 0) {
    entry.images = images.map((image, i) => ({
      src: bubbleImagePlaceholder(slide.slide, i + 1),
      caption: image.caption,
    }))
  }
  return entry
}

function renderBubble(slides, filename, themes) {
  const slidesByNumber = new Map(slides.map((slide) => [slide.slide, slide]))
  const bubbleData = {
    themes: themes.map((theme) => ({
      name: theme.name,
      slides: theme.slides
        .map((slideNumber) => slidesByNumber.get(slideNumber))
        .filter(Boolean)
        .map(bubbleSlideData),
    })),
  }

  const title = escapeHtml(slides[0]?.heading || titleFromFilename(filename))
  const subtitle = `${slides.length} slide${slides.length === 1 ? '' : 's'}`
  // Guard the JSON payload against `</script` prematurely closing the
  // data blob's <script> tag (see render-bubble SKILL.md Step 7).
  const dataJson = JSON.stringify(bubbleData).split('</script').join('<\\/script')

  let html = BUBBLE_TEMPLATE
  html = fillPlaceholder(html, '{{BUBBLE_TITLE}}', title)
  html = fillPlaceholder(html, '{{BUBBLE_SUBTITLE}}', subtitle)
  html = fillPlaceholder(html, '{{AUTHOR}}', '')
  html = fillPlaceholder(html, '{{BUBBLE_DATA}}', dataJson)

  return embedBubbleImages(html, slides)
}

function abortSignalForRequest(req, res) {
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  return controller.signal
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const app = express()
app.use(cors())

app.post('/api/generate', upload.single('file'), async (req, res) => {
  const { file } = req
  const { format } = req.body || {}

  if (!file || !format) {
    return res.status(400).json({ error: 'file and format are required.' })
  }

  if (format !== 'timeline') {
    return res.status(400).json({ error: `Unsupported format: ${format}` })
  }

  const signal = abortSignalForRequest(req, res)
  const log = startGenerationLog({ format, filename: file.originalname })

  try {
    const fileContent = await parseFile(file.buffer, file.originalname)
    const captionedContent = Array.isArray(fileContent)
      ? await captionImages(fileContent, { signal })
      : fileContent
    const extracted = await extractTimelineContent(captionedContent, { signal })
    if (!Array.isArray(extracted?.slides)) {
      console.error('extractTimelineContent returned non-array slides:', JSON.stringify(extracted).slice(0, 2000))
    }
    const html = renderTimelineHtml(extracted, file.originalname)

    if (signal.aborted) {
      finishGenerationLog(log, 'cancelled')
      return
    }
    finishGenerationLog(log, 'completed')
    res.json({ html })
  } catch (err) {
    if (signal.aborted) {
      finishGenerationLog(log, 'cancelled')
      return
    }
    console.error('Generation failed:', err)
    finishGenerationLog(log, 'failed')
    res.status(500).json({ error: err.message || 'Generation failed.' })
  }
})

app.post('/api/render-gallery', upload.single('file'), async (req, res) => {
  const { file } = req

  if (!file) {
    return res.status(400).json({ error: 'file is required.' })
  }

  const signal = abortSignalForRequest(req, res)
  const log = startGenerationLog({ format: 'gallery', filename: file.originalname })

  try {
    const fileContent = await parseFile(file.buffer, file.originalname)
    const captionedContent = Array.isArray(fileContent)
      ? await captionImages(fileContent, { signal })
      : fileContent
    const html = renderGallery(captionedContent, file.originalname)

    if (signal.aborted) {
      finishGenerationLog(log, 'cancelled')
      return
    }
    finishGenerationLog(log, 'completed')
    res.json({ html })
  } catch (err) {
    if (signal.aborted) {
      finishGenerationLog(log, 'cancelled')
      return
    }
    console.error('Gallery render failed:', err)
    finishGenerationLog(log, 'failed')
    res.status(500).json({ error: err.message || 'Gallery render failed.' })
  }
})

app.post('/api/render-bubble', upload.single('file'), async (req, res) => {
  const { file } = req

  if (!file) {
    return res.status(400).json({ error: 'file is required.' })
  }

  const signal = abortSignalForRequest(req, res)
  const log = startGenerationLog({ format: 'bubble-map', filename: file.originalname })

  try {
    const fileContent = await parseFile(file.buffer, file.originalname)
    const captionedContent = Array.isArray(fileContent)
      ? await captionImages(fileContent, { signal })
      : fileContent
    const themes = await identifyThemes(captionedContent, { signal })
    const html = renderBubble(captionedContent, file.originalname, themes)

    if (signal.aborted) {
      finishGenerationLog(log, 'cancelled')
      return
    }
    finishGenerationLog(log, 'completed')
    res.json({ html })
  } catch (err) {
    if (signal.aborted) {
      finishGenerationLog(log, 'cancelled')
      return
    }
    console.error('Bubble render failed:', err)
    finishGenerationLog(log, 'failed')
    res.status(500).json({ error: err.message || 'Bubble render failed.' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
