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
- Reproduce the raster input with maximum fidelity: walls, structural cores, doors, windows, stairs, furniture, labels, dimension strings, hatching, and shading must match the source exactly.
- Keep stroke colours, fills, opacities, and relative line weights identical to the bitmap. Where the image includes text, trace the glyph outlines as vector paths instead of using <text> nodes or substituting fonts.
- Structure the output so each logical element is wrapped in a <g data-fragment-id="..."> group. Use separate groups for walls, fixtures, furniture, annotations, and decorative fill layers to support downstream drag behaviour.
- Emit only <path> elements inside each group (no <rect>, <circle>, <polygon>, or <text>) so the application can transform fragments uniformly. Convert all primitives and text glyphs to precise path data.
- Maintain the original aspect ratio, include explicit width and height attributes, and set a matching viewBox (e.g. viewBox="0 0 <width> <height>"). Use absolute coordinates and snap to integers where possible to prevent cumulative drift.
- Provide a <defs> block containing grid patterns (20-unit and 100-unit), and <style> rules defining classes such as .bg, .wall, .room, .label, .fixture, .door, .sliding, .drag-hint, .draggable, and .pin, then reuse those classes across the generated paths to mirror the reference output.
- Wrap each logical room, fixture cluster, or annotation in <g class="draggable" data-fragment-id="..." transform="translate(x,y)"> groups so the downstream UI can move them together.
- Do not include <script> tags or other embedded JavaScript. The output must consist solely of SVG geometry, defs, and styles.
- Avoid raster <image> tags, bitmap filters, external references, or data URIs. Return only the raw SVG markup text beginning with <svg ...> and ending with </svg>. Do not wrap the SVG in JSON.`

export async function vectorizeWithGemini({ mimeType, base64, instructionOverrides }) {
  const gemini = getClient()
  const instructions = instructionOverrides ? `${BASE_INSTRUCTIONS}\n${instructionOverrides}` : BASE_INSTRUCTIONS

  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'text/plain',
      temperature: 0,
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

  const trimmed = outputText.trim()

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed.svg === 'string') {
        return parsed.svg
      }
    } catch (error) {
      console.warn('Gemini JSON parse failed, attempting raw SVG fallback', error)
    }
  }

  const svgIndex = trimmed.indexOf('<svg')
  const lastIndex = trimmed.lastIndexOf('</svg>')
  if (svgIndex !== -1 && lastIndex !== -1) {
    return trimmed.slice(svgIndex, lastIndex + '</svg>'.length)
  }

  throw Object.assign(new Error('Gemini response did not contain SVG markup'), { status: 502 })
}
