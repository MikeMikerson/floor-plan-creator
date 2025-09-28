import { useEffect, useMemo, useRef, useState } from 'react'

const VECTOR_API_BASE = import.meta.env.VITE_VECTOR_API_BASE_URL ?? ''
const RESOLVED_VECTOR_API_BASE = (() => {
  if (VECTOR_API_BASE) {
    return VECTOR_API_BASE
  }
  if (typeof window === 'undefined') {
    return ''
  }

  const { protocol, hostname } = window.location
  const defaultPort = 4000
  return `${protocol}//${hostname}:${defaultPort}`
})()
const DEFAULT_VECTOR_PROVIDER = import.meta.env.VITE_VECTOR_PROVIDER ?? 'potrace'

const referenceObjects = [
  { id: 'door', label: 'Standard Door', inches: 36 },
  { id: 'queen-bed', label: 'Queen Bed (width)', inches: 60 },
  { id: 'sofa', label: 'Full Sofa (length)', inches: 84 },
]

const GRID_INCHES = 6
const DEFAULT_PIXELS_PER_INCH = 2

const ROOM_COLOR_PRESETS = {
  'Living Room': '#38bdf8',
  Bedroom: '#a855f7',
  Kitchen: '#fb923c',
  Bathroom: '#0ea5e9',
  Office: '#22c55e',
  Outdoor: '#059669',
  Miscellaneous: '#64748b',
}

const FALLBACK_ROOM_COLORS = ['#2563eb', '#f97316', '#14b8a6', '#6366f1', '#facc15', '#ec4899']

function clampZoom(value) {
  const zoom = Number(value)
  if (Number.isNaN(zoom) || !Number.isFinite(zoom)) {
    return 1
  }
  return Math.min(4, Math.max(0.25, zoom))
}

function snapToGrid(value, gridSize) {
  if (!gridSize || gridSize <= 0) {
    return value
  }
  return Math.round(value / gridSize) * gridSize
}

function parseSvgNumber(value) {
  if (typeof value !== 'string') {
    return null
  }
  const parsed = Number(value.replace(/px$/i, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function parseViewBoxAttr(attr) {
  if (!attr || typeof attr !== 'string') {
    return null
  }
  const tokens = attr.trim().split(/\s+/)
  if (tokens.length < 4) {
    return null
  }
  const numbers = tokens.map((token) => Number(token)).filter((token) => Number.isFinite(token))
  return numbers.length === 4 ? numbers : null
}

function createFragmentsFromSvg(svgString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.querySelector('svg')

  if (!svgElement) {
    throw new Error('SVG output missing root <svg> element')
  }

  const widthValue = parseSvgNumber(svgElement.getAttribute('width'))
  const heightValue = parseSvgNumber(svgElement.getAttribute('height'))
  const viewBox = parseViewBoxAttr(svgElement.getAttribute('viewBox'))

  const pathNodes = Array.from(svgElement.querySelectorAll('path'))
  if (pathNodes.length === 0) {
    throw new Error('SVG response did not contain any <path> elements')
  }

  const fragmentMap = new Map()

  pathNodes.forEach((pathNode, index) => {
    const rawFragmentId = pathNode.getAttribute('data-fragment-id') || pathNode.getAttribute('id') || ''
    const fragmentKey = rawFragmentId.trim() || `fragment-${index}`
    const existing = fragmentMap.get(fragmentKey)
    const fragment = existing || {
      id: `${fragmentKey}-${Date.now().toString(36)}-${index}`,
      translation: { x: 0, y: 0 },
      paths: [],
      sourceId: fragmentKey,
    }

    const fillOpacityAttr = pathNode.getAttribute('fill-opacity') ?? pathNode.getAttribute('opacity')
    const fillOpacity = fillOpacityAttr ? Number(fillOpacityAttr) : undefined

    fragment.paths.push({
      id: `${fragment.id}-path-${fragment.paths.length}`,
      d: pathNode.getAttribute('d') ?? '',
      fill: pathNode.getAttribute('fill') ?? '#000000',
      stroke: pathNode.getAttribute('stroke') ?? 'none',
      fillOpacity: Number.isFinite(fillOpacity) ? fillOpacity : undefined,
      transform: pathNode.getAttribute('transform') || undefined,
    })

    if (!existing) {
      fragmentMap.set(fragmentKey, fragment)
    }
  })

  const fragments = Array.from(fragmentMap.values()).map((fragment) => {
    if (fragment.paths.length === 0) {
      return null
    }
    const [primaryPath] = fragment.paths
    return {
      id: fragment.id,
      translation: fragment.translation,
      paths: fragment.paths,
      d: primaryPath.d,
      fill: primaryPath.fill,
      stroke: primaryPath.stroke,
      fillOpacity: primaryPath.fillOpacity,
    }
  }).filter(Boolean)

  if (fragments.length === 0) {
    throw new Error('SVG response did not include valid path data')
  }

  return {
    width: widthValue,
    height: heightValue,
    viewBox,
    fragments,
  }
}

function createVectorPlanFromSvg(svgString, metadata) {
  const parsed = createFragmentsFromSvg(svgString)
  const width = parsed.width ?? metadata?.width ?? null
  const height = parsed.height ?? metadata?.height ?? null

  return {
    width,
    height,
    viewBox: parsed.viewBox,
    fragments: parsed.fragments,
    rawSvg: svgString,
    provider: metadata?.provider ?? null,
    source: 'ai',
    generatedAt: Date.now(),
  }
}

function calculateBoundingBox(item) {
  const { position, widthPx, lengthPx, rotation } = item
  const halfWidth = widthPx / 2
  const halfLength = lengthPx / 2
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  const corners = [
    { x: -halfWidth, y: -halfLength },
    { x: halfWidth, y: -halfLength },
    { x: halfWidth, y: halfLength },
    { x: -halfWidth, y: halfLength },
  ].map((point) => ({
    x: position.x + point.x * cos - point.y * sin,
    y: position.y + point.x * sin + point.y * cos,
  }))

  const xs = corners.map((point) => point.x)
  const ys = corners.map((point) => point.y)

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function boxesOverlap(boxA, boxB) {
  if (!boxA || !boxB) {
    return false
  }

  const separated =
    boxA.maxX < boxB.minX ||
    boxA.minX > boxB.maxX ||
    boxA.maxY < boxB.minY ||
    boxA.minY > boxB.maxY

  return !separated
}

function getRoomColor(room, palette) {
  if (!room) {
    return palette.get('Miscellaneous') ?? '#64748b'
  }
  return palette.get(room) ?? palette.get('Miscellaneous') ?? '#64748b'
}

function LayoutDesignerSection({
  inventory,
  layoutState,
  onCommitLayout,
  onUndoLayout,
  onRedoLayout,
  canUndo,
  canRedo,
  isHydrated,
}) {
  const [scaleForm, setScaleForm] = useState({
    referenceId: layoutState.scale?.referenceId ?? referenceObjects[0].id,
    pixelMeasure: layoutState.scale?.pixelMeasure ? String(layoutState.scale.pixelMeasure) : '',
  })
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [selectedFragmentId, setSelectedFragmentId] = useState(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [viewport, setViewport] = useState(layoutState.viewport)
  const [interaction, setInteraction] = useState(null)
  const [vectorizing, setVectorizing] = useState(false)
  const [vectorError, setVectorError] = useState(null)
  const [showVectorPlan, setShowVectorPlan] = useState(Boolean(layoutState.vectorPlan))
  const [vectorProvider, setVectorProvider] = useState(layoutState.vectorPlan?.provider ?? DEFAULT_VECTOR_PROVIDER)

  const canvasRef = useRef(null)
  const viewportCommitTimer = useRef(null)

  const inventoryMap = useMemo(() => {
    return new Map(inventory.map((item) => [item.id, item]))
  }, [inventory])

  const roomPalette = useMemo(() => {
    const palette = new Map(Object.entries(ROOM_COLOR_PRESETS))
    const rooms = [...new Set(inventory.map((item) => item.room))]

    let fallbackIndex = 0
    rooms.forEach((room) => {
      if (!palette.has(room)) {
        const color = FALLBACK_ROOM_COLORS[fallbackIndex % FALLBACK_ROOM_COLORS.length]
        palette.set(room, color)
        fallbackIndex += 1
      }
    })

    if (!palette.has('Miscellaneous')) {
      palette.set('Miscellaneous', '#64748b')
    }

    return palette
  }, [inventory])

  const paletteEntries = useMemo(() => Array.from(roomPalette.entries()), [roomPalette])

  const pixelsPerInch = layoutState.scale ? 1 / layoutState.scale.inchesPerPixel : DEFAULT_PIXELS_PER_INCH
  const gridSizePx = layoutState.scale ? Math.max(8, GRID_INCHES * pixelsPerInch) : 32

  useEffect(() => {
    setScaleForm({
      referenceId: layoutState.scale?.referenceId ?? referenceObjects[0].id,
      pixelMeasure: layoutState.scale?.pixelMeasure ? String(layoutState.scale.pixelMeasure) : '',
    })
  }, [layoutState.scale])

  useEffect(() => {
    setViewport(layoutState.viewport)
  }, [layoutState.viewport])

  useEffect(() => {
    if (selectedItemId && !layoutState.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null)
    }
  }, [layoutState.items, selectedItemId])

  useEffect(() => {
    if (selectedFragmentId && !layoutState.vectorPlan?.fragments.some((fragment) => fragment.id === selectedFragmentId)) {
      setSelectedFragmentId(null)
    }
  }, [layoutState.vectorPlan, selectedFragmentId])

  useEffect(() => {
    return () => {
      if (viewportCommitTimer.current) {
        clearTimeout(viewportCommitTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!layoutState.vectorPlan) {
      setShowVectorPlan(false)
      setVectorizing(false)
      setVectorError(null)
    }
  }, [layoutState.vectorPlan])

  useEffect(() => {
    if (layoutState.vectorPlan?.provider) {
      setVectorProvider(layoutState.vectorPlan.provider)
    }
  }, [layoutState.vectorPlan?.provider])

  const baseWidth = layoutState.floorPlan?.width ?? 1200
  const baseHeight = layoutState.floorPlan?.height ?? 800

  const renderItems = useMemo(() => {
    return layoutState.items.map((item) => {
      const isMoving = interaction?.type === 'move-item' && interaction.itemId === item.id
      const isRotating = interaction?.type === 'rotate-item' && interaction.itemId === item.id

      const position = isMoving && interaction.previewPosition ? interaction.previewPosition : item.position
      const rotation = isRotating && typeof interaction.previewRotation === 'number' ? interaction.previewRotation : item.rotation

      const widthPx = Math.max(24, item.widthInches * pixelsPerInch)
      const lengthPx = Math.max(24, item.lengthInches * pixelsPerInch)
      const boundingBox = calculateBoundingBox({ position, widthPx, lengthPx, rotation })

      return {
        ...item,
        position,
        rotation,
        widthPx,
        lengthPx,
        boundingBox,
        color: getRoomColor(item.room, roomPalette),
      }
    })
  }, [layoutState.items, interaction, pixelsPerInch, roomPalette])

  const collisionIds = useMemo(() => {
    const ids = new Set()

    for (let i = 0; i < renderItems.length; i += 1) {
      for (let j = i + 1; j < renderItems.length; j += 1) {
        const first = renderItems[i]
        const second = renderItems[j]

        if (first.room !== second.room) {
          continue
        }

        if (boxesOverlap(first.boundingBox, second.boundingBox)) {
          ids.add(first.id)
          ids.add(second.id)
        }
      }
    }

    return ids
  }, [renderItems])

  const renderFragments = useMemo(() => {
    if (!layoutState.vectorPlan || !layoutState.vectorPlan.fragments) {
      return []
    }

    return layoutState.vectorPlan.fragments.map((fragment) => {
      const isMoving = interaction?.type === 'move-fragment' && interaction.fragmentId === fragment.id
      const translation = isMoving && interaction.previewTranslation ? interaction.previewTranslation : fragment.translation

      const normalizedPaths = Array.isArray(fragment.paths) && fragment.paths.length > 0
        ? fragment.paths.map((path, index) => ({
            id: path.id ?? `${fragment.id}-path-${index}`,
            d: path.d ?? '',
            fill: path.fill ?? fragment.fill ?? '#000000',
            stroke: path.stroke ?? fragment.stroke ?? 'none',
            fillOpacity:
              typeof path.fillOpacity === 'number'
                ? path.fillOpacity
                : typeof fragment.fillOpacity === 'number'
                  ? fragment.fillOpacity
                  : undefined,
            transform: path.transform ?? undefined,
          }))
        : [
            {
              id: `${fragment.id}-path-0`,
              d: fragment.d ?? '',
              fill: fragment.fill ?? '#000000',
              stroke: fragment.stroke ?? 'none',
              fillOpacity: typeof fragment.fillOpacity === 'number' ? fragment.fillOpacity : undefined,
              transform: undefined,
            },
          ]

      return {
        ...fragment,
        translation,
        paths: normalizedPaths,
      }
    })
  }, [interaction, layoutState.vectorPlan])

  const selectedItem = useMemo(() => {
    return renderItems.find((item) => item.id === selectedItemId) ?? null
  }, [renderItems, selectedItemId])

  const selectedFragment = useMemo(() => {
    return renderFragments.find((fragment) => fragment.id === selectedFragmentId) ?? null
  }, [renderFragments, selectedFragmentId])

  function focusCanvas() {
    if (canvasRef.current) {
      canvasRef.current.focus()
    }
  }

  function scheduleViewportCommit(nextViewport) {
    setViewport(nextViewport)

    if (viewportCommitTimer.current) {
      clearTimeout(viewportCommitTimer.current)
    }

    viewportCommitTimer.current = setTimeout(() => {
      onCommitLayout((current) => ({
        ...current,
        viewport: {
          x: Math.round(nextViewport.x),
          y: Math.round(nextViewport.y),
          zoom: clampZoom(nextViewport.zoom),
        },
      }))
    }, 150)
  }

  function handleInventoryDragStart(event, item) {
    if (!layoutState.scale) {
      return
    }

    const payload = JSON.stringify({ type: 'inventory-item', id: item.id })
    event.dataTransfer.setData('application/json', payload)
    event.dataTransfer.effectAllowed = 'copy'
  }

  function getCanvasCoordinates(clientX, clientY) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return { x: 0, y: 0 }
    }

    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top

    const canvasX = (offsetX - viewport.x) / viewport.zoom
    const canvasY = (offsetY - viewport.y) / viewport.zoom

    return { x: canvasX, y: canvasY }
  }

  function handleCanvasDrop(event) {
    event.preventDefault()

    if (!layoutState.scale) {
      return
    }

    try {
      const data = event.dataTransfer.getData('application/json')
      if (!data) {
        return
      }
      const parsed = JSON.parse(data)
      if (parsed.type !== 'inventory-item') {
        return
      }
      const source = inventoryMap.get(parsed.id)
      if (!source) {
        return
      }

      const dropPoint = getCanvasCoordinates(event.clientX, event.clientY)
      const snappedPoint = {
        x: snapToGrid(dropPoint.x, gridSizePx / 2),
        y: snapToGrid(dropPoint.y, gridSizePx / 2),
      }

      const newItem = {
        id: `placement-${Math.random().toString(36).slice(2, 10)}`,
        inventoryId: source.id,
        name: source.name,
        room: source.room,
        widthInches: source.width,
        lengthInches: source.length,
        rotation: 0,
        position: snappedPoint,
      }

      onCommitLayout((current) => ({
        ...current,
        items: [...current.items, newItem],
      }))
      setSelectedItemId(newItem.id)
      setSelectedFragmentId(null)
      focusCanvas()
    } catch (error) {
      console.warn('Failed to drop item on canvas', error)
    }
  }

  function handleCanvasDragOver(event) {
    if (!layoutState.scale) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleFloorPlanChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') {
        return
      }

      const image = new Image()
      image.onload = () => {
        onCommitLayout((current) => ({
          ...current,
          floorPlan: {
            name: file.name,
            dataUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
            aspectRatio:
              image.naturalWidth && image.naturalHeight
                ? image.naturalWidth / image.naturalHeight
                : null,
          },
          scale: null,
          items: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          vectorPlan: null,
        }))
        setVectorizing(false)
        setVectorError(null)
        setSelectedFragmentId(null)
        setShowVectorPlan(false)
      }
      image.onerror = () => {
        console.warn('Unable to load floor plan preview image')
      }
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  function handleScaleSubmit(event) {
    event.preventDefault()
    const reference = referenceObjects.find((item) => item.id === scaleForm.referenceId)
    const pixels = Number(scaleForm.pixelMeasure)

    if (!reference || Number.isNaN(pixels) || pixels <= 0) {
      return
    }

    const inchesPerPixel = reference.inches / pixels

    onCommitLayout((current) => ({
      ...current,
      scale: {
        referenceId: reference.id,
        referenceInches: reference.inches,
        pixelMeasure: pixels,
        inchesPerPixel,
      },
    }))
  }

  async function handleVectorizeFloorPlan() {
    if (!layoutState.floorPlan?.dataUrl) {
      return
    }

    setVectorizing(true)
    setVectorError(null)

    try {
      const baseUrl = RESOLVED_VECTOR_API_BASE ? RESOLVED_VECTOR_API_BASE.replace(/\/$/, '') : ''
      const requestUrl = `${baseUrl}/api/vectorize`

      const overrideParts = []
      if (layoutState.floorPlan.name) {
        overrideParts.push(`Source file name: ${layoutState.floorPlan.name}.`)
      }
      if (layoutState.floorPlan.width) {
        overrideParts.push(`Source image width: ${layoutState.floorPlan.width}px.`)
      }
      if (layoutState.floorPlan.height) {
        overrideParts.push(`Source image height: ${layoutState.floorPlan.height}px.`)
      }
      if (layoutState.floorPlan.aspectRatio) {
        overrideParts.push(`Aspect ratio: ${layoutState.floorPlan.aspectRatio.toFixed(6)}.`)
      }
      if (layoutState.scale?.inchesPerPixel) {
        const dpi = 1 / layoutState.scale.inchesPerPixel
        overrideParts.push(`Approximate pixels per inch: ${dpi.toFixed(4)}.`)
      }
      overrideParts.push(
        'Reproduce every wall, fixture, label, hatch, and furniture outline exactly as seen, matching colours, stroke weights, and spacing.',
      )
      overrideParts.push(
        'Convert any text or dimension callouts to <path> glyph outlines grouped under <g data-fragment-id="annotation"> elements to allow precise repositioning.',
      )
      overrideParts.push(
        'Include <defs> patterns for 20-unit and 100-unit grids plus CSS classes (.bg, .bg-100, .wall, .room, .label, .fixture, .door, .sliding, .drag-hint, .draggable, .pin) that are referenced throughout the SVG, matching the provided sample format.',
      )
      overrideParts.push(
        'Structure each room or fixture cluster as <g class="draggable" data-fragment-id="..." transform="translate(x,y)"> with interior <path> elements representing walls, fixtures, and labels.',
      )
      overrideParts.push('Return only the raw <svg>...</svg> markup string with no JSON, markdown, or commentary.')

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl: layoutState.floorPlan.dataUrl,
          provider: vectorProvider,
          instructionOverrides: overrideParts.join(' '),
        }),
      })

      if (!response.ok) {
        let message = `Vectorization request failed (${response.status})`
        try {
          const errorPayload = await response.json()
          if (errorPayload?.error) {
            message = errorPayload.error
          }
        } catch (parseError) {
          console.warn('Unable to parse vectorization error payload', parseError)
        }
        throw new Error(message)
      }

      const payload = await response.json()
      if (!payload || typeof payload.svg !== 'string') {
        throw new Error('AI response missing SVG content')
      }

      const vectorPlan = createVectorPlanFromSvg(payload.svg, {
        width: layoutState.floorPlan.width,
        height: layoutState.floorPlan.height,
        provider: vectorProvider,
      })

      onCommitLayout((current) => ({
        ...current,
        vectorPlan,
      }))

      setShowVectorPlan(true)
      setSelectedFragmentId(null)
      focusCanvas()
    } catch (error) {
      console.warn('Vectorization failed', error)
      setVectorError(error instanceof Error ? error.message : 'Vectorization failed')
    } finally {
      setVectorizing(false)
    }
  }

  function beginPan(event) {
    if (event.button !== 0) {
      return
    }
    const pointerId = event.pointerId
    setInteraction({
      type: 'pan-canvas',
      pointerId,
      originClient: { x: event.clientX, y: event.clientY },
      startViewport: viewport,
    })
    focusCanvas()
    event.currentTarget.setPointerCapture(pointerId)
  }

  function beginMoveItem(event, item) {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    const pointerId = event.pointerId
    setSelectedItemId(item.id)
    setSelectedFragmentId(null)
    setInteraction({
      type: 'move-item',
      pointerId,
      itemId: item.id,
      originClient: { x: event.clientX, y: event.clientY },
      startPosition: item.position,
      previewPosition: item.position,
    })
    focusCanvas()
    event.currentTarget.setPointerCapture(pointerId)
  }

  function beginRotateItem(event, item) {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    const pointerId = event.pointerId
    setSelectedItemId(item.id)
    setSelectedFragmentId(null)
    setInteraction({
      type: 'rotate-item',
      pointerId,
      itemId: item.id,
      initialRotation: item.rotation,
      previewRotation: item.rotation,
    })
    focusCanvas()
    event.currentTarget.setPointerCapture(pointerId)
  }

  function beginMoveFragment(event, fragment) {
    if (event.button !== 0) {
      return
    }
    event.stopPropagation()
    const pointerId = event.pointerId
    setSelectedFragmentId(fragment.id)
    setSelectedItemId(null)
    setInteraction({
      type: 'move-fragment',
      pointerId,
      fragmentId: fragment.id,
      originClient: { x: event.clientX, y: event.clientY },
      startTranslation: fragment.translation,
      previewTranslation: fragment.translation,
    })
    focusCanvas()
    event.currentTarget.setPointerCapture(pointerId)
  }

  function handlePointerMove(event) {
    if (!interaction || event.pointerId !== interaction.pointerId) {
      return
    }

    if (interaction.type === 'pan-canvas') {
      const deltaX = event.clientX - interaction.originClient.x
      const deltaY = event.clientY - interaction.originClient.y
      const nextViewport = {
        x: interaction.startViewport.x + deltaX,
        y: interaction.startViewport.y + deltaY,
        zoom: interaction.startViewport.zoom,
      }
      setViewport(nextViewport)
      return
    }

    if (interaction.type === 'move-item') {
      const deltaX = (event.clientX - interaction.originClient.x) / viewport.zoom
      const deltaY = (event.clientY - interaction.originClient.y) / viewport.zoom
      const nextPosition = {
        x: snapToGrid(interaction.startPosition.x + deltaX, gridSizePx / 2),
        y: snapToGrid(interaction.startPosition.y + deltaY, gridSizePx / 2),
      }
      setInteraction((prev) => (prev ? { ...prev, previewPosition: nextPosition } : prev))
      return
    }

    if (interaction.type === 'move-fragment') {
      const deltaX = (event.clientX - interaction.originClient.x) / viewport.zoom
      const deltaY = (event.clientY - interaction.originClient.y) / viewport.zoom
      const nextTranslation = {
        x: snapToGrid(interaction.startTranslation.x + deltaX, gridSizePx / 2),
        y: snapToGrid(interaction.startTranslation.y + deltaY, gridSizePx / 2),
      }
      setInteraction((prev) => (prev ? { ...prev, previewTranslation: nextTranslation } : prev))
      return
    }

    if (interaction.type === 'rotate-item') {
      const point = getCanvasCoordinates(event.clientX, event.clientY)
      const currentItem = renderItems.find((item) => item.id === interaction.itemId)
      if (!currentItem) {
        return
      }
      const angle = Math.atan2(point.y - currentItem.position.y, point.x - currentItem.position.x)
      let degrees = (angle * 180) / Math.PI
      degrees = (degrees + 450) % 360
      const snapped = Math.round(degrees / 5) * 5
      setInteraction((prev) => (prev ? { ...prev, previewRotation: snapped } : prev))
    }
  }

  function handlePointerUp(event) {
    if (!interaction || event.pointerId !== interaction.pointerId) {
      return
    }

    if (interaction.type === 'pan-canvas') {
      scheduleViewportCommit(viewport)
    }

    try {
      event.currentTarget.releasePointerCapture(interaction.pointerId)
    } catch {
      // ignore release errors
    }

    if (interaction.type === 'move-item') {
      const finalPosition = interaction.previewPosition ?? interaction.startPosition
      onCommitLayout((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === interaction.itemId ? { ...item, position: finalPosition } : item,
        ),
      }))
    }

    if (interaction.type === 'move-fragment') {
      const finalTranslation = interaction.previewTranslation ?? interaction.startTranslation
      onCommitLayout((current) => {
        if (!current.vectorPlan) {
          return current
        }
        return {
          ...current,
          vectorPlan: {
            ...current.vectorPlan,
            fragments: current.vectorPlan.fragments.map((fragment) =>
              fragment.id === interaction.fragmentId ? { ...fragment, translation: finalTranslation } : fragment,
            ),
          },
        }
      })
    }

    if (interaction.type === 'rotate-item') {
      const finalRotation = interaction.previewRotation ?? interaction.initialRotation
      onCommitLayout((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === interaction.itemId ? { ...item, rotation: finalRotation } : item,
        ),
      }))
    }

    setInteraction(null)
  }

  function handleWheel(event) {
    event.preventDefault()
    const direction = event.deltaY > 0 ? -1 : 1
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    const canvasX = (offsetX - viewport.x) / viewport.zoom
    const canvasY = (offsetY - viewport.y) / viewport.zoom

    const zoomFactor = direction > 0 ? 1.1 : 0.9
    const nextZoom = clampZoom(viewport.zoom * zoomFactor)

    const nextViewport = {
      zoom: nextZoom,
      x: offsetX - canvasX * nextZoom,
      y: offsetY - canvasY * nextZoom,
    }

    scheduleViewportCommit(nextViewport)
  }

  function handleCanvasKeyDown(event) {
    if (selectedFragment) {
      const movementStep = event.shiftKey ? gridSizePx / 2 : gridSizePx
      const fineStep = event.altKey ? 1 : movementStep
      let deltaX = 0
      let deltaY = 0

      switch (event.key) {
        case 'ArrowUp':
          deltaY = -fineStep
          break
        case 'ArrowDown':
          deltaY = fineStep
          break
        case 'ArrowLeft':
          deltaX = -fineStep
          break
        case 'ArrowRight':
          deltaX = fineStep
          break
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          onCommitLayout((current) => {
            if (!current.vectorPlan) {
              return current
            }
            const nextFragments = current.vectorPlan.fragments.filter((fragment) => fragment.id !== selectedFragment.id)
            return {
              ...current,
              vectorPlan: nextFragments.length
                ? { ...current.vectorPlan, fragments: nextFragments }
                : null,
            }
          })
          setSelectedFragmentId(null)
          return
        default:
          return
      }

      event.preventDefault()
      const nextTranslation = {
        x: snapToGrid(selectedFragment.translation.x + deltaX / viewport.zoom, gridSizePx / 2),
        y: snapToGrid(selectedFragment.translation.y + deltaY / viewport.zoom, gridSizePx / 2),
      }
      onCommitLayout((current) => {
        if (!current.vectorPlan) {
          return current
        }
        return {
          ...current,
          vectorPlan: {
            ...current.vectorPlan,
            fragments: current.vectorPlan.fragments.map((fragment) =>
              fragment.id === selectedFragment.id ? { ...fragment, translation: nextTranslation } : fragment,
            ),
          },
        }
      })
      return
    }

    if (!selectedItem) {
      return
    }

    const movementStep = event.shiftKey ? gridSizePx / 2 : gridSizePx
    const fineStep = event.altKey ? 1 : movementStep

    let deltaX = 0
    let deltaY = 0
    let rotationDelta = 0

    switch (event.key) {
      case 'ArrowUp':
        deltaY = -fineStep
        break
      case 'ArrowDown':
        deltaY = fineStep
        break
      case 'ArrowLeft':
        deltaX = -fineStep
        break
      case 'ArrowRight':
        deltaX = fineStep
        break
      case 'r':
        rotationDelta = event.shiftKey ? -5 : 5
        break
      case 'R':
        rotationDelta = 5
        break
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        onCommitLayout((current) => ({
          ...current,
          items: current.items.filter((item) => item.id !== selectedItem.id),
        }))
        setSelectedItemId(null)
        return
      default:
        return
    }

    event.preventDefault()

    if (rotationDelta) {
      const nextRotation = (selectedItem.rotation + rotationDelta + 360) % 360
      onCommitLayout((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === selectedItem.id ? { ...item, rotation: nextRotation } : item,
        ),
      }))
      return
    }

    if (deltaX || deltaY) {
      const nextPosition = {
        x: snapToGrid(selectedItem.position.x + deltaX / viewport.zoom, gridSizePx / 2),
        y: snapToGrid(selectedItem.position.y + deltaY / viewport.zoom, gridSizePx / 2),
      }
      onCommitLayout((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === selectedItem.id ? { ...item, position: nextPosition } : item,
        ),
      }))
    }
  }

  function handleInspectorChange(property, value) {
    if (!selectedItem) {
      return
    }

    onCommitLayout((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== selectedItem.id) {
          return item
        }
        if (property === 'rotation') {
          return { ...item, rotation: Number(value) % 360 }
        }
        if (property === 'room') {
          return { ...item, room: value }
        }
        return item
      }),
    }))
  }

  function resetFragmentPosition(fragment) {
    onCommitLayout((current) => {
      if (!current.vectorPlan) {
        return current
      }
      return {
        ...current,
        vectorPlan: {
          ...current.vectorPlan,
          fragments: current.vectorPlan.fragments.map((entry) =>
            entry.id === fragment.id ? { ...entry, translation: { x: 0, y: 0 } } : entry,
          ),
        },
      }
    })
  }

  function handleResetLayout() {
    onCommitLayout(() => ({
      floorPlan: null,
      scale: null,
      items: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      vectorPlan: null,
    }))
    setSelectedItemId(null)
    setSelectedFragmentId(null)
    setShowResetDialog(false)
    setVectorizing(false)
    setVectorError(null)
  }

  const scaleDetails = useMemo(() => {
    if (!layoutState.scale) {
      return null
    }
    const reference = referenceObjects.find((option) => option.id === layoutState.scale.referenceId)
    const pixelsPerInchValue = layoutState.scale.inchesPerPixel > 0 ? 1 / layoutState.scale.inchesPerPixel : null

    return {
      referenceLabel: reference?.label ?? 'Custom reference',
      pixelsPerInch: pixelsPerInchValue,
      inchesPerPixel: layoutState.scale.inchesPerPixel,
    }
  }, [layoutState.scale])

  const showRasterFloorPlan = Boolean(layoutState.floorPlan?.dataUrl) && (!layoutState.vectorPlan || !showVectorPlan)

  return (
    <section className="panel" aria-labelledby="layout-title">
      <div className="panel-header layout-header">
        <div>
          <h2 id="layout-title">Home Layout Designer</h2>
          <p className="panel-subtitle">
            Upload your floor plan, set the canvas scale, then drag furniture or vectorized plan pieces to perfect the layout.
          </p>
        </div>
        <div className="layout-toolbar" role="toolbar" aria-label="Layout actions">
          <button type="button" className="button ghost" onClick={onUndoLayout} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="button ghost" onClick={onRedoLayout} disabled={!canRedo}>
            Redo
          </button>
          <button type="button" className="button warning" onClick={() => setShowResetDialog(true)}>
            Reset layout
          </button>
        </div>
      </div>

      <div className="layout-designer-grid">
        <div className="layout-setup">
          <div>
            <h3>1. Floor plan</h3>
            <label className="file-upload" htmlFor="floor-plan-input">
              <span>Upload image</span>
              <input
                id="floor-plan-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFloorPlanChange}
              />
            </label>
            {layoutState.floorPlan ? (
              <div className="floor-plan-meta">
                <p className="meta-title">Selected floor plan</p>
                <p>{layoutState.floorPlan.name}</p>
                <p>
                  {layoutState.floorPlan.width} px × {layoutState.floorPlan.height} px
                </p>
              </div>
            ) : (
              <p className="empty-state small">
                No file yet. The designer will display your floor plan preview within the canvas once uploaded.
              </p>
            )}

            {layoutState.floorPlan && (
              <div className="vectorize-controls">
                <label className="form-field" htmlFor="vector-provider-select">
                  <span>AI provider</span>
                  <select
                    id="vector-provider-select"
                    value={vectorProvider}
                    onChange={(event) => setVectorProvider(event.target.value)}
                  >
                    <option value="potrace">High fidelity (Potrace)</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="button primary"
                  disabled={vectorizing}
                  onClick={handleVectorizeFloorPlan}
                >
                  {vectorizing ? 'Generating SVG…' : 'Convert floor plan to movable SVG'}
                </button>
                {vectorError && <p className="vectorize-error">{vectorError}</p>}
                {layoutState.vectorPlan && (
                  <div className="vectorize-status">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={showVectorPlan}
                        onChange={(event) => setShowVectorPlan(event.target.checked)}
                      />
                      <span>Show vector overlay</span>
                    </label>
                    <p>SVG fragments: {layoutState.vectorPlan.fragments.length}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3>2. Set the scale</h3>
            <form className="form" onSubmit={handleScaleSubmit}>
              <label className="form-field" htmlFor="reference-select">
                <span>Reference object</span>
                <select
                  id="reference-select"
                  value={scaleForm.referenceId}
                  onChange={(event) =>
                    setScaleForm((prev) => ({ ...prev, referenceId: event.target.value }))
                  }
                >
                  {referenceObjects.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field" htmlFor="pixel-measure-input">
                <span>Measured size (pixels)</span>
                <input
                  id="pixel-measure-input"
                  type="number"
                  min="1"
                  value={scaleForm.pixelMeasure}
                  onChange={(event) =>
                    setScaleForm((prev) => ({ ...prev, pixelMeasure: event.target.value }))
                  }
                  required
                />
              </label>

              <div className="form-actions">
                <button type="submit" className="button primary" disabled={!layoutState.floorPlan}>
                  Calculate scale
                </button>
              </div>
            </form>
            {scaleDetails ? (
              <div className="scale-meta">
                <p className="meta-title">Scale ready</p>
                <p>{scaleDetails.referenceLabel}</p>
                <p>{scaleDetails.pixelsPerInch?.toFixed(2)} px = 1 in</p>
              </div>
            ) : (
              <p className="empty-state small">
                Provide a pixel measurement above to establish the canvas scale. Furniture uses these measurements to size
                correctly.
              </p>
            )}
          </div>
        </div>

        <div className="layout-workspace">
          <h3>3. Arrange furniture & vectors</h3>
          {!layoutState.scale && (
            <p className="empty-state small">
              Set the floor plan scale to enable dragging items into the canvas. Accurate scaling ensures each piece fits
              in real life.
            </p>
          )}

          <div
            ref={canvasRef}
            className="layout-canvas"
            tabIndex={0}
            onPointerDown={beginPan}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onKeyDown={handleCanvasKeyDown}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            role="application"
            aria-label="Floor plan layout canvas"
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${baseWidth} ${baseHeight}`}
              className="layout-canvas-svg"
            >
              <defs>
                <pattern
                  id="layout-grid"
                  width={gridSizePx}
                  height={gridSizePx}
                  patternUnits="userSpaceOnUse"
                >
                  <path d={`M ${gridSizePx} 0 L 0 0 0 ${gridSizePx}`} fill="none" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />
                </pattern>
              </defs>

              <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
                <rect x="0" y="0" width={baseWidth} height={baseHeight} fill="url(#layout-grid)" />

                {showRasterFloorPlan && layoutState.floorPlan?.dataUrl && (
                  <image
                    href={layoutState.floorPlan.dataUrl}
                    width={baseWidth}
                    height={baseHeight}
                    preserveAspectRatio="xMidYMid slice"
                    opacity="0.75"
                  />
                )}

                {showVectorPlan && renderFragments.length > 0 && (
                  <g className="layout-fragment-group">
                    {renderFragments.map((fragment) => {
                      const isSelected = fragment.id === selectedFragmentId
                      return (
                        <g
                          key={fragment.id}
                          className="layout-fragment"
                          transform={`translate(${fragment.translation.x} ${fragment.translation.y})`}
                          onPointerDown={(event) => beginMoveFragment(event, fragment)}
                        >
                          {fragment.paths.map((path) => (
                            <path
                              key={path.id}
                              className={isSelected ? 'layout-fragment-path selected' : 'layout-fragment-path'}
                              d={path.d}
                              fill={path.fill}
                              fillOpacity={
                                typeof path.fillOpacity === 'number'
                                  ? path.fillOpacity
                                  : typeof fragment.fillOpacity === 'number'
                                    ? fragment.fillOpacity
                                    : 0.95
                              }
                              stroke={path.stroke ?? fragment.stroke ?? 'none'}
                              transform={path.transform ?? undefined}
                            />
                          ))}
                        </g>
                      )
                    })}
                  </g>
                )}

                {renderItems.map((item) => {
                  const isSelected = item.id === selectedItemId
                  const hasCollision = collisionIds.has(item.id)
                  const fillColor = hasCollision ? '#ef4444' : item.color
                  const halfWidth = item.widthPx / 2
                  const halfLength = item.lengthPx / 2

                  return (
                    <g
                      key={item.id}
                      className="layout-item"
                      transform={`translate(${item.position.x} ${item.position.y}) rotate(${item.rotation})`}
                    >
                      <rect
                        className={isSelected ? 'layout-item-rect selected' : 'layout-item-rect'}
                        x={-halfWidth}
                        y={-halfLength}
                        width={item.widthPx}
                        height={item.lengthPx}
                        rx="6"
                        ry="6"
                        fill={fillColor}
                        fillOpacity="0.78"
                        stroke={isSelected ? '#0f172a' : 'rgba(15, 23, 42, 0.35)'}
                        strokeWidth={isSelected ? 3 : 1}
                        onPointerDown={(event) => beginMoveItem(event, item)}
                      />
                      <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#0f172a"
                        fontSize={Math.max(12, (item.widthPx + item.lengthPx) / 28)}
                        fontWeight="600"
                        pointerEvents="none"
                      >
                        {item.name}
                      </text>
                      {isSelected && (
                        <circle
                          className="layout-rotate-handle"
                          cx={0}
                          cy={-halfLength - 28}
                          r={12}
                          fill="#1d4ed8"
                          stroke="#f8fafc"
                          strokeWidth="3"
                          onPointerDown={(event) => beginRotateItem(event, item)}
                        />
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
        </div>

        <div className="layout-sidebar">
          <h3>4. Inventory</h3>
          <p className="panel-subtitle">
            Drag furniture into the canvas. Items stay grouped by room for easy scanning.
          </p>

          <div className="layout-inventory-list">
            {inventory.length === 0 ? (
              <p className="empty-state small">Inventory is empty. Add furniture to populate the designer.</p>
            ) : (
              Object.entries(
                inventory.reduce((groups, item) => {
                  const key = item.room || 'Miscellaneous'
                  if (!groups[key]) {
                    groups[key] = []
                  }
                  groups[key].push(item)
                  return groups
                }, {}),
              ).map(([room, items]) => (
                <details className="inventory-group" key={room} open>
                  <summary>{room}</summary>
                  <ul className="inventory-items">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="inventory-item"
                        draggable={Boolean(layoutState.scale)}
                        onDragStart={(event) => handleInventoryDragStart(event, item)}
                      >
                        <div>
                          <p className="inventory-item-name">{item.name}</p>
                          <p className="inventory-item-meta">
                            {item.width}" W × {item.length}" L
                          </p>
                        </div>
                        <span className="inventory-chip" style={{ backgroundColor: getRoomColor(room, roomPalette) }}>
                          {room}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            )}
          </div>

          <div className="layout-legend">
            <p className="legend-title">Canvas legend</p>
            <ul>
              {paletteEntries.map(([room, color]) => (
                <li key={room}>
                  <span className="legend-swatch" style={{ backgroundColor: color }} />
                  <span>{room}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="layout-inspector">
            <h4>Selection</h4>
            {selectedFragment ? (
              <div className="inspector-card">
                <p className="inspector-title">SVG fragment</p>
                <p className="inspector-meta">Fill: {selectedFragment.fill}</p>
                <p className="inspector-meta">
                  Offset: {selectedFragment.translation.x}px, {selectedFragment.translation.y}px
                </p>
                <div className="form-actions">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => resetFragmentPosition(selectedFragment)}
                  >
                    Reset position
                  </button>
                  <button
                    type="button"
                    className="button warning"
                    onClick={() => {
                      onCommitLayout((current) => {
                        if (!current.vectorPlan) {
                          return current
                        }
                        const nextFragments = current.vectorPlan.fragments.filter((fragment) => fragment.id !== selectedFragment.id)
                        return {
                          ...current,
                          vectorPlan: nextFragments.length
                            ? { ...current.vectorPlan, fragments: nextFragments }
                            : null,
                        }
                      })
                      setSelectedFragmentId(null)
                    }}
                  >
                    Remove fragment
                  </button>
                </div>
              </div>
            ) : selectedItem ? (
              <div className="inspector-card">
                <p className="inspector-title">{selectedItem.name}</p>
                <p className="inspector-meta">
                  {selectedItem.widthInches}" × {selectedItem.lengthInches}" · {selectedItem.room}
                </p>

                <label className="form-field" htmlFor="inspector-rotation">
                  <span>Rotation</span>
                  <input
                    id="inspector-rotation"
                    type="range"
                    min="0"
                    max="355"
                    step="5"
                    value={selectedItem.rotation}
                    onChange={(event) => handleInspectorChange('rotation', Number(event.target.value))}
                  />
                  <div className="inspector-rotation-value">{selectedItem.rotation}°</div>
                </label>

                <label className="form-field" htmlFor="inspector-room">
                  <span>Room</span>
                  <select
                    id="inspector-room"
                    value={selectedItem.room}
                    onChange={(event) => handleInspectorChange('room', event.target.value)}
                  >
                    {[...roomPalette.keys()].map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-actions">
                  <button
                    type="button"
                    className="button warning"
                    onClick={() => {
                      onCommitLayout((current) => ({
                        ...current,
                        items: current.items.filter((item) => item.id !== selectedItem.id),
                      }))
                      setSelectedItemId(null)
                    }}
                  >
                    Remove from canvas
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty-state small">Select a furniture item or SVG fragment in the canvas to adjust it here.</p>
            )}
          </div>
        </div>
      </div>

      {showResetDialog && (
        <div className="layout-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="layout-reset-card">
            <h4 id="reset-title">Clear layout?</h4>
            <p>This will remove the uploaded floor plan, generated SVG fragments, and all furniture placements from the canvas.</p>
            <div className="form-actions">
              <button type="button" className="button ghost" onClick={() => setShowResetDialog(false)}>
                Cancel
              </button>
              <button type="button" className="button warning" onClick={handleResetLayout}>
                Clear layout
              </button>
            </div>
          </div>
        </div>
      )}

      {!isHydrated && <p className="layout-loading">Loading saved layout…</p>}
    </section>
  )
}

export default LayoutDesignerSection
