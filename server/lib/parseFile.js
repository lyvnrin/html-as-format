import JSZip from 'jszip'
import path from 'node:path'
import { extractPdf } from './extractPdf.js'

const IMAGE_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
}

function slideNumber(slidePath) {
  const match = slidePath.match(/slide(\d+)\.xml$/)
  return match ? Number(match[1]) : 0
}

function mimeTypeForPath(mediaPath) {
  const ext = mediaPath.split('.').pop().toLowerCase()
  return IMAGE_MIME_TYPES[ext] || 'application/octet-stream'
}

function parseRelationships(relsXml) {
  const map = new Map()
  for (const m of relsXml.matchAll(/<Relationship\s+Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    map.set(m[1], m[2])
  }
  return map
}

function extractHeadingAndBody(xml) {
  const shapes = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || []
  const shapeData = shapes.map((shape) => ({
    paragraphs: (shape.match(/<a:p>[\s\S]*?<\/a:p>/g) || [])
      .map((p) => Array.from(p.matchAll(/<a:t>([^<]*)<\/a:t>/g), (m) => m[1]).join(''))
      .filter((text) => text.trim().length > 0),
    isTitle: /<p:ph[^>]*\btype="(title|ctrTitle)"/.test(shape),
  }))

  const explicitTitle = shapeData.find((s) => s.isTitle && s.paragraphs.length > 0)
  if (explicitTitle) {
    return {
      heading: explicitTitle.paragraphs.join(' '),
      body: shapeData.filter((s) => s !== explicitTitle).flatMap((s) => s.paragraphs),
    }
  }

  // No shape explicitly marked as the title placeholder (common in decks built
  // by tools that omit the type="title" attribute) — fall back to the first
  // paragraph of the first non-empty shape, which is the title in the vast
  // majority of real-world slides.
  const firstWithText = shapeData.find((s) => s.paragraphs.length > 0)
  if (!firstWithText) return { heading: '', body: [] }

  const [heading, ...restOfFirstShape] = firstWithText.paragraphs
  return {
    heading,
    body: [
      ...restOfFirstShape,
      ...shapeData.filter((s) => s !== firstWithText).flatMap((s) => s.paragraphs),
    ],
  }
}

async function extractImages(xml, zip, slidePath) {
  const picBlocks = xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) || []
  if (picBlocks.length === 0) return []

  const relsPath = slidePath.replace(/^ppt\/slides\//, 'ppt/slides/_rels/') + '.rels'
  const relsFile = zip.files[relsPath]
  if (!relsFile) return []

  const relsXml = await relsFile.async('string')
  const relMap = parseRelationships(relsXml)

  const images = []
  for (const pic of picBlocks) {
    const embedMatch = pic.match(/<a:blip[^>]*r:embed="(rId\d+)"/)
    if (!embedMatch) continue

    const target = relMap.get(embedMatch[1])
    if (!target) continue

    const mediaPath = path.posix.normalize(path.posix.join('ppt/slides', target))
    const mediaFile = zip.files[mediaPath]
    if (!mediaFile) continue

    const buffer = await mediaFile.async('nodebuffer')
    images.push({
      base64: buffer.toString('base64'),
      mime_type: mimeTypeForPath(mediaPath),
      caption: '',
    })
  }
  return images
}

async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const slidePaths = Object.keys(zip.files)
    .filter((filePath) => /^ppt\/slides\/slide\d+\.xml$/.test(filePath))
    .sort((a, b) => slideNumber(a) - slideNumber(b))

  return Promise.all(
    slidePaths.map(async (slidePath, i) => {
      const xml = await zip.files[slidePath].async('string')
      const { heading, body } = extractHeadingAndBody(xml)
      const images = await extractImages(xml, zip, slidePath)
      return { slide: i + 1, heading, body, images }
    }),
  )
}

export async function parseFile(buffer, filename) {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.pdf')) {
    return extractPdf(buffer)
  }
  if (lower.endsWith('.pptx')) {
    return parsePptx(buffer)
  }
  if (lower.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported file type: ${filename}`)
}
