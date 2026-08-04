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

const TRANSCRIPT_SKILL = fs.readFileSync(
  path.join(ROOT, 'skills/transcript-to-html/SKILL.md'),
  'utf-8',
)
const TIMELINE_SKILL = fs.readFileSync(
  path.join(ROOT, 'skills/render-timeline/SKILL.md'),
  'utf-8',
)
const TIMELINE_TEMPLATE = fs.readFileSync(
  path.join(ROOT, 'skills/render-timeline/assets/timeline-template.html'),
  'utf-8',
)
const GALLERY_TEMPLATE = fs.readFileSync(
  path.join(ROOT, 'skills/render-gallery/assets/gallery-template.html'),
  'utf-8',
)
const BUBBLE_SKILL = fs.readFileSync(
  path.join(ROOT, 'skills/render-bubble/SKILL.md'),
  'utf-8',
)
const BUBBLE_TEMPLATE = fs.readFileSync(
  path.join(ROOT, 'skills/render-bubble/assets/bubble-template.html'),
  'utf-8',
)

const MODEL = 'claude-sonnet-4-6'

function stripCodeFence(text) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/)
  return match ? match[1].trim() : trimmed
}

function stripImageData(slides) {
  return slides.map((slide) => ({
    slide: slide.slide,
    heading: slide.heading,
    body: slide.body,
    image_captions: (slide.images || []).map((image) => image.caption).filter(Boolean),
  }))
}

async function extractToJson(fileContent, { signal } = {}) {
  const sourceText = Array.isArray(fileContent)
    ? JSON.stringify(stripImageData(fileContent), null, 2)
    : fileContent

  const prompt = `${TRANSCRIPT_SKILL}

---

Source document content:

${sourceText}

---

Follow the extraction-only mode (Step 2b) instructions above. Output ONLY the JSON object described by the schema — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  )

  const text = response.content.map((block) => block.text || '').join('')
  return JSON.parse(stripCodeFence(text))
}

async function renderTimeline(extractedJson, { signal } = {}) {
  const prompt = `${TIMELINE_SKILL}

---

Here is the HTML template referenced as assets/timeline-template.html:

${TIMELINE_TEMPLATE}

---

Here is the extracted JSON content to render (output of the transcript-to-html extraction step):

${JSON.stringify(extractedJson, null, 2)}

---

Follow the SKILL.md instructions above to fill the template with this content. Output ONLY the complete, final HTML document — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  )

  const text = response.content.map((block) => block.text || '').join('')
  return stripCodeFence(text)
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
  const captionHtml = captionText
    ? `\n            <p class="panel-caption">${escapeHtml(captionText)}</p>`
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

function bubbleImagePlaceholder(slideNumber, imageIndex) {
  return `__IMAGE_SLIDE_${slideNumber}_${imageIndex}__`
}

function buildBubblePromptSlides(slides) {
  return slides.map((slide) => ({
    slide: slide.slide,
    heading: slide.heading,
    body: slide.body,
    images: (slide.images || []).map((image, i) => ({
      placeholder: bubbleImagePlaceholder(slide.slide, i + 1),
      caption: image.caption,
    })),
  }))
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

async function renderBubble(slides, { signal } = {}) {
  const promptSlides = buildBubblePromptSlides(slides)

  const prompt = `${BUBBLE_SKILL}

---

Here is the HTML template referenced as assets/bubble-template.html:

${BUBBLE_TEMPLATE}

---

Here is the enriched slide content to render (output of parseFile → captionImages, with image data replaced by placeholder tokens):

${JSON.stringify(promptSlides, null, 2)}

---

Follow the SKILL.md instructions above: identify themes for these slides (Step 2), then fill the template's {{BUBBLE_TITLE}}, {{BUBBLE_SUBTITLE}}, {{AUTHOR}}, and {{BUBBLE_DATA}} placeholders (Step 5). Output ONLY the complete, final HTML document — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 32000,
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  )

  const text = response.content.map((block) => block.text || '').join('')
  return embedBubbleImages(stripCodeFence(text), slides)
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
    const extractedJson = await extractToJson(captionedContent, { signal })
    const html = await renderTimeline(extractedJson, { signal })

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
    const html = await renderBubble(captionedContent, { signal })

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
