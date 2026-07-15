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
const GALLERY_SKILL = fs.readFileSync(
  path.join(ROOT, 'skills/render-gallery/SKILL.md'),
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

async function extractToJson(fileContent) {
  const sourceText = Array.isArray(fileContent)
    ? JSON.stringify(stripImageData(fileContent), null, 2)
    : fileContent

  const prompt = `${TRANSCRIPT_SKILL}

---

Source document content:

${sourceText}

---

Follow the extraction-only mode (Step 2b) instructions above. Output ONLY the JSON object described by the schema — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.map((block) => block.text || '').join('')
  return JSON.parse(stripCodeFence(text))
}

async function renderTimeline(extractedJson) {
  const prompt = `${TIMELINE_SKILL}

---

Here is the HTML template referenced as assets/timeline-template.html:

${TIMELINE_TEMPLATE}

---

Here is the extracted JSON content to render (output of the transcript-to-html extraction step):

${JSON.stringify(extractedJson, null, 2)}

---

Follow the SKILL.md instructions above to fill the template with this content. Output ONLY the complete, final HTML document — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.map((block) => block.text || '').join('')
  return stripCodeFence(text)
}

function imagePlaceholder(slideNumber) {
  return `__IMAGE_SLIDE_${slideNumber}__`
}

function buildGalleryPromptSlides(slides) {
  return slides.map((slide) => ({
    slide: slide.slide,
    heading: slide.heading,
    body: slide.body,
    image:
      slide.images && slide.images.length > 0
        ? { placeholder: imagePlaceholder(slide.slide), caption: slide.images[0].caption }
        : null,
  }))
}

function embedGalleryImages(html, slides) {
  return slides.reduce((output, slide) => {
    const image = slide.images && slide.images[0]
    if (!image) return output
    const dataUri = `data:${image.mime_type};base64,${image.base64}`
    return output.split(imagePlaceholder(slide.slide)).join(dataUri)
  }, html)
}

async function renderGallery(slides) {
  const promptSlides = buildGalleryPromptSlides(slides)

  const prompt = `${GALLERY_SKILL}

---

Here is the HTML template referenced as assets/gallery-template.html:

${GALLERY_TEMPLATE}

---

Here is the enriched slide content to render (output of parseFile → captionImages, with image data replaced by placeholder tokens):

${JSON.stringify(promptSlides, null, 2)}

---

Follow the SKILL.md instructions above to fill the template with this content. Output ONLY the complete, final HTML document — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.map((block) => block.text || '').join('')
  return embedGalleryImages(stripCodeFence(text), slides)
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

async function renderBubble(slides) {
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

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 32000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.map((block) => block.text || '').join('')
  return embedBubbleImages(stripCodeFence(text), slides)
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

  try {
    const fileContent = await parseFile(file.buffer, file.originalname)
    const captionedContent = Array.isArray(fileContent)
      ? await captionImages(fileContent)
      : fileContent
    const extractedJson = await extractToJson(captionedContent)
    const html = await renderTimeline(extractedJson)
    res.json({ html })
  } catch (err) {
    console.error('Generation failed:', err)
    res.status(500).json({ error: err.message || 'Generation failed.' })
  }
})

app.post('/api/render-gallery', upload.single('file'), async (req, res) => {
  const { file } = req

  if (!file) {
    return res.status(400).json({ error: 'file is required.' })
  }

  try {
    const fileContent = await parseFile(file.buffer, file.originalname)
    const captionedContent = Array.isArray(fileContent)
      ? await captionImages(fileContent)
      : fileContent
    const html = await renderGallery(captionedContent)
    res.json({ html })
  } catch (err) {
    console.error('Gallery render failed:', err)
    res.status(500).json({ error: err.message || 'Gallery render failed.' })
  }
})

app.post('/api/render-bubble', upload.single('file'), async (req, res) => {
  const { file } = req

  if (!file) {
    return res.status(400).json({ error: 'file is required.' })
  }

  try {
    const fileContent = await parseFile(file.buffer, file.originalname)
    const captionedContent = Array.isArray(fileContent)
      ? await captionImages(fileContent)
      : fileContent
    const html = await renderBubble(captionedContent)
    res.json({ html })
  } catch (err) {
    console.error('Bubble render failed:', err)
    res.status(500).json({ error: err.message || 'Bubble render failed.' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
