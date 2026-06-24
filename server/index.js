import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'
import { parseFile } from './lib/parseFile.js'

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

const MODEL = 'claude-sonnet-4-6'

function stripCodeFence(text) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/)
  return match ? match[1].trim() : trimmed
}

async function extractToJson(fileContent) {
  const prompt = `${TRANSCRIPT_SKILL}

---

Source document content:

${fileContent}

---

Follow the extraction-only mode (Step 2b) instructions above. Output ONLY the JSON object described by the schema — no markdown code fences, no commentary, no surrounding text.`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
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
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content.map((block) => block.text || '').join('')
  return stripCodeFence(text)
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
    const extractedJson = await extractToJson(fileContent)
    const html = await renderTimeline(extractedJson)
    res.json({ html })
  } catch (err) {
    console.error('Generation failed:', err)
    res.status(500).json({ error: err.message || 'Generation failed.' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
