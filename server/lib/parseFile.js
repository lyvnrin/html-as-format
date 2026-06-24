import { PDFParse } from 'pdf-parse'
import JSZip from 'jszip'

function slideNumber(path) {
  const match = path.match(/slide(\d+)\.xml$/)
  return match ? Number(match[1]) : 0
}

function extractTextRuns(xml) {
  const matches = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)
  return Array.from(matches, (m) => m[1]).join(' ')
}

async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b))

  const slideTexts = await Promise.all(
    slidePaths.map(async (path) => {
      const xml = await zip.files[path].async('string')
      return extractTextRuns(xml)
    }),
  )

  return slideTexts
    .map((text, i) => `Slide ${i + 1}:\n${text}`)
    .join('\n\n')
}

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text
}

export async function parseFile(buffer, filename) {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.pdf')) {
    return parsePdf(buffer)
  }
  if (lower.endsWith('.pptx')) {
    return parsePptx(buffer)
  }
  if (lower.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported file type: ${filename}`)
}
