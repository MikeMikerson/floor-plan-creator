/* eslint-env node */
import OpenAI from 'openai'

const MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-5'

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

const BASE_INSTRUCTIONS = `You are an architectural vectorization assistant that converts floor plan images into interactive, draggable SVG layouts. Create a functional floor plan where each room/area can be moved independently.

CRITICAL: You must analyze the floor plan image and create separate draggable room blocks, each represented as vector paths with proper data attributes for the frontend to parse.

REQUIRED SVG STRUCTURE:
\`\`\`xml
<svg viewBox="0 0 1200 800" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid20" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0H0V20" fill="none" stroke="#e5e5e5" stroke-width="1"/>
    </pattern>
    <pattern id="grid100" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="none" stroke="#cccccc" stroke-width="1"/>
    </pattern>
    <style>
      .bg { fill: url(#grid20); }
      .bg-100 { fill: url(#grid100); }
      .wall { stroke: #111; stroke-width: 12; fill: none; stroke-linecap: square; }
      .room { fill: #fafafa; stroke: #555; stroke-width: 2; }
      .label { font: 18px/1.2 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; fill:#222; }
      .fixture { fill:#f0f0f0; stroke:#888; stroke-width:2; }
      .door { stroke:#111; stroke-width:4; fill:none; }
      .sliding { stroke:#111; stroke-width:4; }
      .draggable { cursor: move; }
      .pin { fill:#fff; stroke:#aaa; stroke-width:2; }
    </style>
  </defs>

  <!-- Background grid -->
  <rect x="0" y="0" width="1200" height="800" class="bg"/>
  <rect x="0" y="0" width="1200" height="800" class="bg-100" opacity="0.5"/>

  <!-- Each room MUST be a separate <path> element with data-fragment-id -->
  <!-- Example structure for each room: -->
  <path data-fragment-id="living-room" d="M100,100 L500,100 L500,300 L100,300 Z" fill="#fafafa" stroke="#555" stroke-width="2"/>
  <path data-fragment-id="bedroom" d="M600,100 L900,100 L900,250 L600,250 Z" fill="#fafafa" stroke="#555" stroke-width="2"/>
  <path data-fragment-id="kitchen" d="M100,350 L400,350 L400,500 L100,500 Z" fill="#fafafa" stroke="#555" stroke-width="2"/>
  <!-- Add more rooms as needed -->
</svg>
\`\`\`

ROOM ANALYSIS & VECTORIZATION PROCESS:
1. Analyze the input floor plan image to identify distinct rooms and spaces
2. Identify these typical room types: Living Room, Kitchen, Bedrooms, Bathrooms, Closets, Balconies, Entry/Hallway, Dining Room, etc.
3. For each room, create a rectangular or polygonal <path> element that approximates the room's shape and position
4. Each room <path> MUST have:
   - data-fragment-id="room-name" (use lowercase with hyphens, e.g., "living-room", "master-bedroom")
   - Appropriate fill color (#fafafa for rooms)
   - Stroke and stroke-width for borders
   - Path data (d attribute) that defines the room boundaries

PATH CREATION RULES:
- Use <path> elements with simple rectangular or polygonal shapes for each room
- Room paths should be positioned to approximate their location in the original floor plan
- Scale room sizes proportionally within the 1200x800 viewBox
- Leave reasonable spacing between room blocks so they don't overlap
- Each path's d attribute should use absolute coordinates (M, L, Z commands)

ROOM IDENTIFICATION GUIDELINES:
- Living Room: Usually the largest open space
- Kitchen: Often has fixtures/counters, typically rectangular
- Bedrooms: Private rooms, usually rectangular
- Bathrooms: Small rooms with fixtures (toilet, tub/shower)
- Dining Room: Open space often adjacent to kitchen
- Entry/Hallway: Transitional spaces
- Closets: Small storage spaces
- Balcony/Patio: Outdoor spaces

POSITIONING & SIZING:
- Analyze the spatial relationships in the original image
- Maintain relative sizes (larger rooms should be larger paths)
- Position rooms logically within the 1200x800 space
- Leave 20-40px spacing between room blocks for clarity
- Ensure no room paths overlap initially

FILL COLORS & STYLING:
- Standard rooms: fill="#fafafa" stroke="#555" stroke-width="2"
- Bathrooms: fill="#e0f2fe" (light blue tint)
- Kitchen: fill="#fef3c7" (light yellow tint)
- Bedrooms: fill="#f3e8ff" (light purple tint)
- Outdoor spaces: fill="#f0fdf4" (light green tint)

OUTPUT REQUIREMENTS:
- Return ONLY the complete SVG markup (no JSON, markdown, or explanatory text)
- Include the full <defs> section with patterns and styles
- Each room must be a separate <path> element with unique data-fragment-id
- Use simple geometric shapes that approximate the room layout from the image
- Ensure all paths use absolute coordinates and are properly closed with Z command`

export async function vectorizeWithOpenAI({ mimeType, base64, instructionOverrides }) {
  const openai = getClient()
  const combinedInstructions = instructionOverrides ? `${BASE_INSTRUCTIONS}\n${instructionOverrides}` : BASE_INSTRUCTIONS

  const imageUrl = `data:${mimeType};base64,${base64}`

  const response = await openai.responses.create({
    model: MODEL,
    max_output_tokens: 100000,
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

  const trimmed = output.trim()

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed.svg === 'string') {
        return parsed.svg
      }
    } catch (error) {
      // fall through to raw SVG detection
      console.warn('OpenAI JSON parse failed, attempting raw SVG fallback', error)
    }
  }

  const svgIndex = trimmed.indexOf('<svg')
  const lastIndex = trimmed.lastIndexOf('</svg>')
  if (svgIndex !== -1 && lastIndex !== -1) {
    return trimmed.slice(svgIndex, lastIndex + '</svg>'.length)
  }

  throw Object.assign(new Error('OpenAI response did not contain SVG markup'), { status: 502 })
}
