/* eslint-env node */
import OpenAI from 'openai'

const MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini'

let client = null

function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw Object.assign(new Error('OPENAI_API_KEY is not configured'), { status: 500 })
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

const BASE_INSTRUCTIONS = `You are an architectural vectorization assistant.
- Analyze the provided raster floor plan and recreate it as accurate SVG markup.
- Match the dimensions, proportions, wall thicknesses, windows, doors, text labels, and furniture outlines as closely as possible.
- Use <svg> output sized to the source image; keep paths grouped logically to support drag-and-drop of rooms or furniture.
- Represent each visually distinct element with a dedicated <path> element (no <rect>, <circle>, or <polygon>), grouping related paths with <g data-fragment-id="..."> wrappers.
- Snap coordinates to integers when possible and preserve fill colors or stroke weights similar to the input.
- Return strictly valid, minified SVG with viewBox, width, height, and no external references.
- Output JSON following this schema: { "svg": "<svg ...>" }.
- Do not include markdown fences or commentary.`

const responseSchema = {
  name: 'vector_svg_output',
  schema: {
    type: 'object',
    properties: {
      svg: {
        type: 'string',
        description: 'Complete standalone SVG markup replicating the floor plan',
      },
    },
    required: ['svg'],
    additionalProperties: false,
  },
}

export async function vectorizeWithOpenAI({ mimeType, base64, instructionOverrides }) {
  const openai = getClient()
  const combinedInstructions = instructionOverrides ? `${BASE_INSTRUCTIONS}\n${instructionOverrides}` : BASE_INSTRUCTIONS

  const imageUrl = `data:${mimeType};base64,${base64}`

  const response = await openai.responses.create({
    model: MODEL,
    max_output_tokens: 4096,
    response_format: { type: 'json_schema', json_schema: responseSchema },
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: combinedInstructions },
          {
            type: 'input_image',
            image_url: imageUrl,
            detail: 'high',
          },
        ],
      },
    ],
  })

  const output = response.output?.[0]?.content?.[0]?.text || response.output_text
  if (!output) {
    throw Object.assign(new Error('OpenAI did not return SVG content'), { status: 502 })
  }

  try {
    const parsed = JSON.parse(output)
    return parsed.svg
  } catch (error) {
    throw Object.assign(new Error('Invalid JSON returned from OpenAI'), { status: 502, cause: error })
  }
}
