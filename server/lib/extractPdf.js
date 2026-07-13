import { PDFParse } from 'pdf-parse'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

const EXTRACT_PDF_SKILL = fs.readFileSync(
  path.join(ROOT, 'skills/extract-pdf/SKILL.md'),
  'utf-8',
)

const MODEL = 'claude-sonnet-4-6'

let client

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

function stripCodeFence(text) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/)
  return match ? match[1].trim() : trimmed
}

async function loadPdfPageData(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    // pdf-parse's worker can't service concurrent calls on one instance
    // (Promise.all here throws DataCloneError) — run them sequentially.
    const textResult = await parser.getText()
    const imageResult = await parser.getImage({ imageBuffer: false, imageDataUrl: true })
    const infoResult = await parser.getInfo({ parsePageInfo: true })
    return { textResult, imageResult, infoResult }
  } finally {
    await parser.destroy()
  }
}

function isScanned(textResult) {
  if (textResult.pages.length === 0) return false
  const totalChars = textResult.pages.reduce((sum, p) => sum + p.text.trim().length, 0)
  return totalChars < textResult.pages.length * 5
}

function dataUrlToImage(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
  return match ? { mime_type: match[1], base64: match[2] } : null
}

function buildPagePrompt(textResult, infoResult) {
  const dimsByPage = new Map(infoResult.pages.map((p) => [p.pageNumber, p]))
  return textResult.pages
    .map((p) => {
      const dims = dimsByPage.get(p.num)
      const dimNote = dims ? ` (${Math.round(dims.width)}x${Math.round(dims.height)}pt)` : ''
      return `--- PAGE ${p.num}${dimNote} ---\n${p.text.trim()}`
    })
    .join('\n\n')
}

async function structureContent(textResult, infoResult) {
  const anthropic = getClient()

  const prompt = `${EXTRACT_PDF_SKILL}

---

Raw per-page text extracted from the PDF (page dimensions noted where known; table cells are tab-separated):

${buildPagePrompt(textResult, infoResult)}

---

Follow the extract-pdf instructions above to produce the JSON array described in Step 4, with one difference: omit the "images" field entirely (images are attached separately from extracted binary data, not by you) and instead include a "pages" field on every object — an array of the 1-indexed source page numbers that contributed to that section. This is used downstream to attach the right extracted images to each section.

Output ONLY the JSON array — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.map((block) => block.text || '').join('')
  return JSON.parse(stripCodeFence(text))
}

function attachImages(sections, imageResult) {
  return sections.map(({ pages, ...section }) => {
    const pageNumbers = new Set(pages || [])
    const images = imageResult.pages
      .filter((p) => pageNumbers.has(p.pageNumber))
      .flatMap((p) => p.images)
      .map((image) => {
        const parsed = dataUrlToImage(image.dataUrl)
        return parsed ? { base64: parsed.base64, mime_type: parsed.mime_type, caption: '' } : null
      })
      .filter(Boolean)

    return { ...section, images }
  })
}

export async function extractPdf(buffer) {
  const { textResult, imageResult, infoResult } = await loadPdfPageData(buffer)

  if (isScanned(textResult)) {
    throw new Error(
      'This PDF appears to be scanned or image-based with no extractable text layer. ' +
        'OCR would be required to pull out its content, which this pipeline does not support.',
    )
  }

  const sections = await structureContent(textResult, infoResult)
  return attachImages(sections, imageResult)
}
