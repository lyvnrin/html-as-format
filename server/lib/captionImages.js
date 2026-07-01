import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

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

async function captionImage(image) {
  const anthropic = getClient()
  const response = await anthropic.messages.create({
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
  })

  return response.content
    .map((block) => block.text || '')
    .join('')
    .trim()
}

export async function captionImages(slides) {
  for (const slide of slides) {
    for (const image of slide.images) {
      if (!image.base64) continue

      try {
        image.caption = await captionImage(image)
      } catch (err) {
        console.warn(`Caption generation failed for slide ${slide.slide}:`, err.message)
        image.caption = ''
      }
    }
  }

  return slides
}
