import { useMemo, useState } from 'react'
import FurnitureInventorySection from './components/FurnitureInventorySection'
import LayoutDesignerSection from './components/LayoutDesignerSection'
import SharingSection from './components/SharingSection'
import TimelineSection from './components/TimelineSection'
import './App.css'

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
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
  const [layoutState, setLayoutState] = useState({ floorPlan: null, scale: null })

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

  function handleLayoutChange(partial) {
    setLayoutState((prev) => {
      const next = { ...prev, ...partial }

      if (Object.prototype.hasOwnProperty.call(partial, 'floorPlan')) {
        if (!partial.floorPlan) {
          next.floorPlan = null
          next.scale = null
        } else if (partial.floorPlan !== prev.floorPlan) {
          next.floorPlan = partial.floorPlan
          next.scale = null
        }
      }

      return next
    })
  }

  const upcomingMoveDate = useMemo(() => {
    const dates = timelineEvents.map((item) => new Date(item.date).getTime()).filter((time) => !Number.isNaN(time))
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
          onLayoutChange={handleLayoutChange}
        />
        <SharingSection layoutState={layoutState} />
      </main>
    </div>
  )
}

export default App
