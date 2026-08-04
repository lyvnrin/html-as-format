import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const CAPTION_CONCURRENCY = 5

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

async function captionImage(image, signal) {
  const anthropic = getClient()
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
                media_type: image.mime_type,
                data: image.base64,
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
