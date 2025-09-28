/* eslint-env node */
import { Potrace } from 'potrace'
import { imageSize } from 'image-size'

const POTRACE_OPTIONS = {
  turdSize: 0,
  alphaMax: 1,
  optCurve: true,
  optTolerance: 0.2,
  threshold: Potrace.THRESHOLD_AUTO,
  turnPolicy: Potrace.TURNPOLICY_MINORITY,
  blackOnWhite: true,
  color: '#000000',
  background: '#ffffff',
  flat: false,
}

async function traceWithPotrace(buffer) {
  return new Promise((resolve, reject) => {
    Potrace.trace(buffer, POTRACE_OPTIONS, (error, svg) => {
      if (error) {
        reject(error)
      } else {
        resolve(svg)
      }
    })
  })
}

function normalizeSvg(svg, width, height) {
  if (!svg) {
    return svg
  }

  const viewBoxAttr = `viewBox="0 0 ${width} ${height}"`
  const widthAttr = `width="${width}"`
  const heightAttr = `height="${height}"`

  let output = svg

  if (width && /width="[^"]*"/.test(output)) {
    output = output.replace(/width="[^"]*"/, widthAttr)
  } else if (width) {
    output = output.replace('<svg', `<svg ${widthAttr}`)
  }

  if (height && /height="[^"]*"/.test(output)) {
    output = output.replace(/height="[^"]*"/, heightAttr)
  } else if (height) {
    output = output.replace('<svg', `<svg ${heightAttr}`)
  }

  if (width && height) {
    if (/viewBox="[^"]*"/.test(output)) {
      output = output.replace(/viewBox="[^"]*"/, viewBoxAttr)
    } else {
      output = output.replace('<svg', `<svg ${viewBoxAttr}`)
    }
  }

  // Ensure xmlns is present for downstream parsing
  if (!/xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(output)) {
    output = output.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  return output
}

export async function vectorizeWithPotrace({ base64 }) {
  const buffer = Buffer.from(base64, 'base64')

  if (!buffer || buffer.length === 0) {
    throw Object.assign(new Error('Empty image payload for Potrace vectorization'), { status: 400 })
  }

  let dimensions
  try {
    dimensions = imageSize(buffer)
  } catch {
    dimensions = null
  }

  const svg = await traceWithPotrace(buffer)
  if (!svg) {
    throw Object.assign(new Error('Potrace failed to return SVG content'), { status: 502 })
  }

  if (!dimensions?.width || !dimensions?.height) {
    return svg.trim()
  }

  return normalizeSvg(svg, dimensions.width, dimensions.height).trim()
}
