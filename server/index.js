/* eslint-env node */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { vectorizeWithOpenAI } from './providers/openai.js'
import { vectorizeWithGemini } from './providers/gemini.js'

const PORT = process.env.PORT || 4000
const DEFAULT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL provided')
  }

  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) {
    throw new Error('Unsupported data URL format')
  }

  const [, mimeType, base64] = match
  if (!base64) {
    throw new Error('Missing base64 payload in data URL')
  }

  return { mimeType, base64 }
}

const app = express()

app.use(
  cors({
    origin: DEFAULT_ORIGIN,
    credentials: true,
  }),
)

app.use(
  express.json({
    limit: process.env.REQUEST_SIZE_LIMIT || '20mb',
  }),
)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/vectorize', async (req, res) => {
  try {
    const { imageDataUrl, provider = 'openai', instructionOverrides } = req.body || {}

    if (!imageDataUrl) {
      return res.status(400).json({ error: 'imageDataUrl is required' })
    }

    const { mimeType, base64 } = parseDataUrl(imageDataUrl)

    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image data URLs are supported' })
    }

    const payload = {
      mimeType,
      base64,
      instructionOverrides,
    }

    let svg

    if (provider === 'gemini') {
      svg = await vectorizeWithGemini(payload)
    } else {
      svg = await vectorizeWithOpenAI(payload)
    }

    if (!svg) {
      return res.status(502).json({ error: 'No SVG returned from AI provider' })
    }

    res.json({ svg })
  } catch (error) {
    const status = error.status || 500
    res.status(status).json({
      error: error.message || 'Vectorization failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
})

app.listen(PORT, () => {
  console.log(`Vectorization server listening on port ${PORT}`)
})
