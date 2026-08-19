#!/usr/bin/env node
// Fills the three real templates (skills/render-*/assets/*-template.html) with
// hand-authored sample content and writes the result into
// frontend/public/demos/, so the "Preview" link on each format card in the
// landing page has a fixed, always-available URL to open — independent of
// whatever the current user has actually generated.
//
// Rendering logic (escapeHtml, node/card markup, body-block detection) is
// duplicated from server/index.js rather than imported from it, since that
// file's top-level code starts an Express server and reads .env on import.
// Re-run this script after editing a template or wanting to refresh the
// sample content: `node scripts/generate-demo-previews.mjs`.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'frontend/public/demos')

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fillPlaceholder(html, token, value) {
  return html.split(token).join(value)
}

// Small solid-color SVG data URI, so demo "photos" are self-contained (no
// network fetch) instead of needing real embedded images. Width/height vary
// per slide below — the gallery template sizes .card-image at width:100%
// with no fixed aspect-ratio, so it's the image's own intrinsic dimensions
// that give the CSS-columns masonry grid its varied card heights.
function placeholderImage(hex, label, width = 640, height = 480) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${hex}"/><text x="50%" y="50%" font-family="sans-serif" font-size="28" fill="rgba(255,255,255,0.85)" text-anchor="middle" dominant-baseline="middle">${escapeHtml(
    label,
  )}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

// --- Timeline ---

function timelineNodeHtml(slide, index, isHighlight) {
  const side = index % 2 === 1 ? 'side-left' : 'side-right'
  const displayIndex = String(index).padStart(2, '0')
  const heading = escapeHtml(slide.heading)
  const label = escapeHtml(slide.label || slide.heading)
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

const TIMELINE_SLIDES = [
  {
    heading: 'Founding',
    label: 'Founding',
    key_stat: '2019',
    subheading: 'Three engineers, one whiteboard',
    body: ['Started as a weekend project to turn slide decks into something people would actually read.'],
  },
  {
    heading: 'First 1,000 users',
    label: 'First users',
    key_stat: '1,000',
    body: ['Word of mouth carried the first cohort — mostly teams tired of PDF exports nobody opened.'],
    bullets: ['Zero marketing spend', 'Entirely inbound', '40% weekly return rate'],
  },
  {
    heading: 'Series A',
    label: 'Series A',
    key_stat: '$8M',
    subheading: 'Led by a seed investor doubling down',
    body: ['Funding went straight into the rendering engine — the part users actually judge the product by.'],
  },
  {
    heading: 'Rebuilt the renderer',
    label: 'Renderer rebuild',
    key_stat: 'v2',
    body: ['Rewrote the HTML generation pipeline to ship a single self-contained file, no build step, nothing to host.'],
  },
  {
    heading: 'Today',
    label: 'Today',
    key_stat: '50,000+',
    subheading: 'Documents rendered and counting',
    body: ['Three formats, one upload flow, still no server required to view the output.'],
  },
]

function renderTimelineDemo(template) {
  const keyMoments = new Set([2, 5])
  const nodesHtml = TIMELINE_SLIDES.map((slide, i) => timelineNodeHtml(slide, i + 1, keyMoments.has(i + 1))).join(
    '\n\n',
  )
  let html = template
  html = fillPlaceholder(html, '{{TIMELINE_TITLE}}', 'Company Timeline (sample)')
  html = fillPlaceholder(html, '{{TIMELINE_SUBTITLE}}', `${TIMELINE_SLIDES.length} slides`)
  html = fillPlaceholder(html, '{{AUTHOR}}', 'Preview sample')
  html = fillPlaceholder(html, '{{TIMELINE_NODES}}', nodesHtml)
  return html
}

// --- Gallery ---

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
function tryConsumeStep(body, i) {
  let idx = i
  if (idx < body.length && /^\d{1,3}$/.test(body[idx].trim())) idx += 1
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

function galleryImageCardHtml(slide, imageSrc, index, isPrimary) {
  const heading = escapeHtml(slide.heading)
  const bodyHtml = isPrimary ? galleryBodyBlocksHtml(slide.body) : ''
  const captionText = isPrimary ? slide.caption : slide.heading
  const captionHtml = captionText
    ? `\n            <details class="panel-caption-toggle">
              <summary>Show image description</summary>
              <p class="panel-caption">${escapeHtml(captionText)}</p>
            </details>`
    : ''

  return `      <div class="card" data-index="${index}">
        <div class="card-face">
          <div class="card-image-wrap">
            <img class="card-image" src="${imageSrc}" alt="${heading}">
          </div>
          <div class="card-title">${heading}</div>
        </div>
        <div class="card-detail" hidden>
          <div class="panel-media"><img src="${imageSrc}" alt="${heading}"></div>
          <div class="panel-content">
            <h2>${heading}</h2>
            ${bodyHtml}${captionHtml}
          </div>
        </div>
      </div>`
}

function gallerySolidCardHtml(slide, index) {
  const heading = escapeHtml(slide.heading)
  const bodyHtml = galleryBodyBlocksHtml(slide.body)

  return `      <div class="card" data-index="${index}">
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

// Deliberately spans a wide range of image aspect ratios (and a couple of
// image-less "solid" cards) so the CSS-columns masonry grid visibly packs
// cards of different heights, rather than a uniform 4:3 grid.
const GALLERY_SLIDES = [
  {
    heading: 'Basecamp',
    caption: 'Sunrise over the ridge from base camp, tents in the foreground.',
    color: '#3b6ea5',
    width: 640,
    height: 480,
    body: ['4,200m', 'Elevation', 'The first stretch is mostly flat — save your legs for what comes after.'],
  },
  {
    heading: 'Gear check',
    solid: true,
    color: '#54607a',
    body: [
      '01',
      'Layer up',
      'Base, mid, and a hard shell — temperature swings fast above 3,000m.',
      '02',
      'Test your boots',
      'Break them in on shorter hikes before the trip, not on day one.',
      '03',
      'Pack light',
      'Everything you bring, you carry — for the whole ascent.',
    ],
  },
  {
    heading: 'The switchbacks',
    caption: 'Zig-zag trail cut into the scree slope.',
    color: '#7a8b5a',
    width: 640,
    height: 800,
    body: [
      '01',
      'Warm up',
      'Fifteen minutes of easy walking to find your rhythm.',
      'Push',
      'Ninety minutes of steady switchbacks — this is the grind.',
    ],
  },
  {
    heading: 'Wildlife spotted',
    caption: 'A mountain goat watching the trail from a rocky outcrop.',
    color: '#8a9a4f',
    width: 640,
    height: 360,
  },
  {
    heading: 'Ridge camp',
    caption: 'Camp perched on the exposed ridge line at dusk.',
    color: '#b5793b',
    width: 480,
    height: 640,
    body: ['Wind picks up fast above the treeline — the ridge camp is where most people put their shell on for good.'],
  },
  {
    heading: 'Conditions',
    solid: true,
    color: '#3b6ea5',
    // Stat values must match the app's detection pattern (digits, optionally
    // with one trailing %/B/M/K letter) — units that don't fit go in the
    // label instead, same convention the real Summit/Basecamp stats below use.
    body: ['12', '°C overnight low', '40', 'km/h peak gust', '15%', 'Visibility'],
  },
  {
    heading: 'Summit',
    caption: 'First light hitting the summit marker.',
    color: '#a54a4a',
    width: 640,
    height: 640,
    body: ['5,895m', 'Summit', '8', 'Hours from ridge camp'],
  },
  {
    heading: 'Descent',
    caption: 'Looking back down the switchbacks at midday, clouds rolling in below.',
    color: '#6a7d8f',
    width: 800,
    height: 450,
    body: [
      'The way down is harder on the knees than the way up was on the lungs — take it slower than feels necessary.',
    ],
  },
  {
    heading: 'Trail closures',
    caption: 'Rockslide debris across the lower trail, roped off.',
    color: '#9a6b3b',
    width: 480,
    height: 800,
    body: [
      'The lower trail closes seasonally after spring thaw loosens the scree above it — check conditions before you commit to the standard route.',
    ],
  },
]

function renderGalleryDemo(template) {
  const cardsHtml = GALLERY_SLIDES.map((slide, i) =>
    slide.solid
      ? gallerySolidCardHtml(slide, i + 1)
      : galleryImageCardHtml(slide, placeholderImage(slide.color, slide.heading, slide.width, slide.height), i + 1, true),
  ).join('\n\n')
  let html = template
  html = fillPlaceholder(html, '{{GALLERY_TITLE}}', 'Trip Report (sample)')
  html = fillPlaceholder(html, '{{GALLERY_SUBTITLE}}', `${GALLERY_SLIDES.length} slides`)
  html = fillPlaceholder(html, '{{AUTHOR}}', 'Preview sample')
  html = fillPlaceholder(html, '{{GALLERY_CARDS}}', cardsHtml)
  return html
}

// --- Bubble map ---

const BUBBLE_THEMES = [
  {
    name: 'Market',
    slides: [
      { index: 1, heading: 'Problem', body: ['Teams export decks to PDF and nobody opens them again.'] },
      {
        index: 2,
        heading: 'Market size',
        body: ['$4.2B', 'Document tooling spend, 2025'],
        images: [{ src: placeholderImage('#3b6ea5', 'Market'), caption: 'Market sizing chart, source: internal research.' }],
      },
    ],
  },
  {
    name: 'Product',
    slides: [
      { index: 3, heading: 'Three formats', body: ['Timeline, Gallery, and Bubble map cover most source decks.'] },
      { index: 4, heading: 'No build step', body: ['Everything ships as one self-contained HTML file.'] },
      { index: 5, heading: 'Under the hood', body: ['Extraction, then deterministic rendering — the model only groups content, never lays out pixels.'] },
    ],
  },
  {
    name: 'Traction',
    slides: [
      {
        index: 6,
        heading: 'Growth',
        body: ['50,000+', 'Documents rendered'],
        images: [{ src: placeholderImage('#7a8b5a', 'Growth'), caption: 'Monthly render volume, last 12 months.' }],
      },
      { index: 7, heading: "What's next", body: ['More formats, and a way to compare two editions side by side.'] },
    ],
  },
]

function renderBubbleDemo(template) {
  const bubbleData = { themes: BUBBLE_THEMES }
  const dataJson = JSON.stringify(bubbleData).split('</script').join('<\\/script')
  let html = template
  html = fillPlaceholder(html, '{{BUBBLE_TITLE}}', 'Pitch Deck (sample)')
  html = fillPlaceholder(html, '{{BUBBLE_SUBTITLE}}', `${BUBBLE_THEMES.reduce((n, t) => n + t.slides.length, 0)} slides`)
  html = fillPlaceholder(html, '{{AUTHOR}}', 'Preview sample')
  html = fillPlaceholder(html, '{{BUBBLE_DATA}}', dataJson)
  return html
}

// --- Run ---

fs.mkdirSync(OUT_DIR, { recursive: true })

const jobs = [
  ['skills/render-timeline/assets/timeline-template.html', renderTimelineDemo, 'timeline.html'],
  ['skills/render-gallery/assets/gallery-template.html', renderGalleryDemo, 'gallery.html'],
  ['skills/render-bubble/assets/bubble-template.html', renderBubbleDemo, 'bubble-map.html'],
]

for (const [templatePath, render, outName] of jobs) {
  const template = fs.readFileSync(path.join(ROOT, templatePath), 'utf-8')
  const html = render(template)
  fs.writeFileSync(path.join(OUT_DIR, outName), html)
  console.log(`wrote frontend/public/demos/${outName}`)
}
