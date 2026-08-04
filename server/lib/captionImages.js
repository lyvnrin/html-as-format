import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

const MODEL = 'claude-sonnet-4-6'
const CAPTION_CONCURRENCY = 5
const CAPTION_MAX_DIMENSION = 1024

const CAPTION_PROMPT =
  'Write a concise 1-2 sentence factual caption describing what this image shows, ' +
  'in a business/consulting context. Output only the caption text, no preamble or commentary.'

let client

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

// Only shrinks the copy sent to the captioning model — image.base64 (the
// original, full-resolution data) is left untouched for the final HTML output.
async function downscaleForCaption(image) {
  if (image.mime_type === 'image/svg+xml') return image

  try {
    const resized = await sharp(Buffer.from(image.base64, 'base64'))
      .resize({
        width: CAPTION_MAX_DIMENSION,
        height: CAPTION_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer()

    return { base64: resized.toString('base64'), mime_type: 'image/jpeg' }
  } catch {
    return image
  }
}

async function captionImage(image, signal) {
  const anthropic = getClient()
  const captionSource = await downscaleForCaption(image)
  const response = await anthropic.messages.create(
    {
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: captionSource.mime_type,
                data: captionSource.base64,
              },
            },
            { type: 'text', text: CAPTION_PROMPT },
          ],
        },
      ],
    },
    { signal },
  )

  return response.content
    .map((block) => block.text || '')
    .join('')
    .trim()
}

async function runWithConcurrency(items, limit, worker) {
  let cursor = 0

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext))
}

export async function captionImages(slides, { signal } = {}) {
  const jobs = slides.flatMap((slide) => slide.images.map((image) => ({ slide, image })))

  await runWithConcurrency(jobs, CAPTION_CONCURRENCY, async ({ slide, image }) => {
    if (signal?.aborted) return
    if (!image.base64) return

    try {
      image.caption = await captionImage(image, signal)
    } catch (err) {
      if (signal?.aborted) return
      console.warn(`Caption generation failed for slide ${slide.slide}:`, err.message)
      image.caption = ''
    }
  })

  return slides
}
