import { useEffect, useMemo, useReducer, useState } from 'react'
import FurnitureInventorySection from './components/FurnitureInventorySection'
import LayoutDesignerSection from './components/LayoutDesignerSection'
import SharingSection from './components/SharingSection'
import TimelineSection from './components/TimelineSection'
import './App.css'

const LAYOUT_STORAGE_KEY = 'movewise-layout-state-v1'
const MAX_HISTORY = 50

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
}

function clampZoom(value) {
  const zoom = Number(value)
  if (Number.isNaN(zoom) || !Number.isFinite(zoom)) {
    return 1
  }
  return Math.min(4, Math.max(0.25, zoom))
}

function createDefaultLayoutState() {
  return {
    floorPlan: null,
    scale: null,
    items: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

function sanitizeLayoutItem(raw) {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const position = raw.position && typeof raw.position === 'object' ? raw.position : {}

  return {
    id: raw.id ?? createId('placement'),
    inventoryId: raw.inventoryId ?? null,
    name: raw.name ?? 'Furniture',
    room: raw.room ?? 'Miscellaneous',
    widthInches: Number(raw.widthInches) || 0,
    lengthInches: Number(raw.lengthInches) || 0,
    rotation: Number(raw.rotation) || 0,
    position: {
      x: Number(position.x) || 0,
      y: Number(position.y) || 0,
    },
  }
}

function sanitizeLayoutState(raw) {
  const base = createDefaultLayoutState()

  if (!raw || typeof raw !== 'object') {
    return base
  }

  if (raw.floorPlan && typeof raw.floorPlan === 'object' && raw.floorPlan.dataUrl) {
    base.floorPlan = {
      name: raw.floorPlan.name ?? 'Floor plan',
      dataUrl: raw.floorPlan.dataUrl,
      width: Number(raw.floorPlan.width) || null,
      height: Number(raw.floorPlan.height) || null,
      aspectRatio: typeof raw.floorPlan.aspectRatio === 'number' ? raw.floorPlan.aspectRatio : null,
    }
  }

  if (raw.scale && typeof raw.scale === 'object' && Number(raw.scale.inchesPerPixel) > 0) {
    base.scale = {
      referenceId: raw.scale.referenceId ?? null,
      referenceInches: Number(raw.scale.referenceInches) || null,
      pixelMeasure: Number(raw.scale.pixelMeasure) || null,
      inchesPerPixel: Number(raw.scale.inchesPerPixel),
    }
  }

  if (Array.isArray(raw.items)) {
    base.items = raw.items.map((item) => sanitizeLayoutItem(item)).filter(Boolean)
  }

  if (raw.viewport && typeof raw.viewport === 'object') {
    base.viewport = {
      x: Number(raw.viewport.x) || 0,
      y: Number(raw.viewport.y) || 0,
      zoom: clampZoom(raw.viewport.zoom),
    }
  }

  return base
}

const initialLayoutMachine = {
  past: [],
  present: createDefaultLayoutState(),
  future: [],
  hydrated: false,
}

function layoutReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      const next = sanitizeLayoutState(action.payload)
      return {
        past: [],
        present: next,
        future: [],
        hydrated: true,
      }
    }
    case 'APPLY': {
      const next = sanitizeLayoutState(action.payload)
      const past = [...state.past, state.present]
      const trimmedPast = past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past

      if (JSON.stringify(next) === JSON.stringify(state.present)) {
        return state
      }

      return {
        past: trimmedPast,
        present: next,
        future: [],
        hydrated: true,
      }
    }
    case 'UNDO': {
      if (state.past.length === 0) {
        return state
      }

      const previous = state.past[state.past.length - 1]
      const updatedPast = state.past.slice(0, -1)

      return {
        past: updatedPast,
        present: previous,
        future: [state.present, ...state.future],
        hydrated: state.hydrated,
      }
    }
    case 'REDO': {
      if (state.future.length === 0) {
        return state
      }

      const [next, ...rest] = state.future

      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        hydrated: state.hydrated,
      }
    }
    default:
      return state
  }
}

const initialEvents = [
  {
    id: createId('evt'),
    title: 'Schedule movers',
    date: '2025-07-12',
    notes: 'Confirm availability and insurance details.',
  },
  {
    id: createId('evt'),
    title: 'Change utilities',
    date: '2025-07-20',
    notes: 'Submit start dates for electricity, gas, and internet.',
  },
]

const initialFurniture = [
  {
    id: createId('fur'),
    name: 'Sectional Sofa',
    width: 112,
    length: 84,
    room: 'Living Room',
  },
  {
    id: createId('fur'),
    name: 'Queen Bed',
    width: 60,
    length: 80,
    room: 'Bedroom',
  },
]

function App() {
  const [timelineEvents, setTimelineEvents] = useState(initialEvents)
  const [furnitureItems, setFurnitureItems] = useState(initialFurniture)
  const [layoutMachine, dispatchLayout] = useReducer(layoutReducer, initialLayoutMachine)
  const layoutState = layoutMachine.present

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        dispatchLayout({ type: 'HYDRATE', payload: parsed })
        return
      }
    } catch (error) {
      console.warn('Failed to hydrate layout state', error)
    }

    dispatchLayout({ type: 'HYDRATE', payload: createDefaultLayoutState() })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !layoutMachine.hydrated) {
      return
    }

    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutState))
    } catch (error) {
      console.warn('Failed to persist layout state', error)
    }
  }, [layoutState, layoutMachine.hydrated])

  function commitLayoutState(updater) {
    if (typeof updater === 'function') {
      dispatchLayout({ type: 'APPLY', payload: updater(layoutState) })
    } else {
      dispatchLayout({ type: 'APPLY', payload: updater })
    }
  }

  function undoLayout() {
    dispatchLayout({ type: 'UNDO' })
  }

  function redoLayout() {
    dispatchLayout({ type: 'REDO' })
  }

  function addTimelineEvent(data) {
    setTimelineEvents((prev) => [...prev, { id: createId('evt'), ...data }])
  }

  function updateTimelineEvent(id, updates) {
    setTimelineEvents((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  function deleteTimelineEvent(id) {
    setTimelineEvents((prev) => prev.filter((item) => item.id !== id))
  }

  function addFurnitureItem(data) {
    setFurnitureItems((prev) => [...prev, { id: createId('fur'), ...data }])
  }

  function updateFurnitureItem(id, updates) {
    setFurnitureItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  function deleteFurnitureItem(id) {
    setFurnitureItems((prev) => prev.filter((item) => item.id !== id))
  }

  const upcomingMoveDate = useMemo(() => {
    const dates = timelineEvents
      .map((item) => new Date(item.date).getTime())
      .filter((time) => !Number.isNaN(time))
    if (dates.length === 0) {
      return null
    }
    return new Date(Math.min(...dates))
  }, [timelineEvents])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-tagline">MoveWise mobile companion</p>
          <h1>Take control of your move</h1>
          <p className="app-subtitle">
            Organize tasks, log furniture dimensions, and plan your layout before moving day arrives.
          </p>
        </div>
        {upcomingMoveDate && (
          <div className="app-badge" aria-live="polite">
            <span>Next deadline</span>
            <strong>{upcomingMoveDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</strong>
          </div>
        )}
      </header>

      <main className="content-grid">
        <TimelineSection
          events={timelineEvents}
          onAddEvent={addTimelineEvent}
          onDeleteEvent={deleteTimelineEvent}
          onUpdateEvent={updateTimelineEvent}
        />
        <FurnitureInventorySection
          items={furnitureItems}
          onAddItem={addFurnitureItem}
          onDeleteItem={deleteFurnitureItem}
          onUpdateItem={updateFurnitureItem}
        />
        <LayoutDesignerSection
          inventory={furnitureItems}
          layoutState={layoutState}
          onCommitLayout={commitLayoutState}
          onUndoLayout={undoLayout}
          onRedoLayout={redoLayout}
          canUndo={layoutMachine.past.length > 0}
          canRedo={layoutMachine.future.length > 0}
          isHydrated={layoutMachine.hydrated}
        />
        <SharingSection layoutState={layoutState} />
      </main>
    </div>
  )
}

export default App
