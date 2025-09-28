/* eslint-env node */
import genai from '@google/genai'

const { GoogleGenerativeAI } = genai

const MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash'

let client = null

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { status: 500 })
    }
    client = new GoogleGenerativeAI({ apiKey })
  }
  return client
}

const BASE_INSTRUCTIONS = `You are an architectural assistant that converts raster floor plans into layered SVG markup suitable for editing.
- Reproduce walls, fixtures, labels, and furniture with precise vector paths.
- Structure output so each logical element is wrapped in a <g data-fragment-id="..."> group for downstream drag behaviour.
- Emit only <path> elements inside each group (no <rect>, <circle>, or <polygon>) so downstream code can move the fragments easily.
- Maintain the original aspect ratio and include viewBox, width, and height attributes.
- Use absolute coordinates and consistent stroke widths. Avoid bitmap filters and external references.
- Return JSON: { "svg": "<svg ...>" } with valid XML.`

const responseSchema = {
  type: 'OBJECT',
  properties: {
    svg: {
      type: 'STRING',
      description: 'Standalone SVG markup that replicates the floor plan',
      required: true,
    },
  },
}

export async function vectorizeWithGemini({ mimeType, base64, instructionOverrides }) {
  const gemini = getClient()
  const instructions = instructionOverrides ? `${BASE_INSTRUCTIONS}\n${instructionOverrides}` : BASE_INSTRUCTIONS

  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1,
      topP: 0.8,
    },
  })

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: instructions },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
  })

  const outputText = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!outputText) {
    throw Object.assign(new Error('Gemini did not return SVG content'), { status: 502 })
  }

  try {
    const parsed = JSON.parse(outputText)
    if (!parsed.svg) {
      throw new Error('Missing svg property in Gemini response')
    }
    return parsed.svg
  } catch (error) {
    throw Object.assign(new Error('Invalid JSON returned from Gemini'), { status: 502, cause: error })
  }
}
