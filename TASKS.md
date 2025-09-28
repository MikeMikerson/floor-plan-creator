# MoveWise Implementation Task List

## My Move Timeline
- [ ] Persist timeline events locally (AsyncStorage / IndexedDB abstraction for web prototype)
- [ ] Support editing event names, dates, and notes inline with validation states
- [ ] Implement drag-to-reorder and chronological grouping UI
- [ ] Add contextual reminders and countdown surfaces for approaching deadlines

## Furniture Inventory
- [ ] Persist furniture catalog locally with schema validation
- [ ] Allow photo attachments per item for easy identification
- [ ] Surface dimension conflicts (e.g., width/length missing or invalid)
- [ ] Export inventory data for use in layout designer and external tools

## Home Layout Designer
- [x] Build zoomable 2D canvas with pan/zoom gestures and grid snapping
- [x] Convert raster floor plan to movable SVG fragments for rapid rearrangement
- [x] Implement drag-and-drop from inventory drawer onto canvas
- [x] Render furniture rectangles at accurate scale using inches-per-pixel factor
- [x] Enable rotation controls and keyboard nudging for precise placement
- [x] Apply room-based color coding and legend display
- [x] Detect overlaps within same room category and provide real-time warnings
- [x] Support undo/redo history for canvas actions
- [x] Autosave canvas state (floor plan, scale, furniture positions) locally
- [x] Add reset workflow with confirmation dialog to clear canvas

## Export & Sharing
- [ ] Generate clean canvas snapshot without UI chrome
- [ ] Compose share payload with promotional copy and deep link placeholders
- [ ] Integrate native sharing sheet via React Native bridge wrappers
- [ ] Log share analytics events for growth tracking

## Cross-Cutting
- [ ] Establish global state management (Context + reducers or Zustand) for timeline, inventory, and layout
- [ ] Add responsive layout adjustments for tablet and small screen breakpoints
- [ ] Implement onboarding checklist guiding first-time users through core setup
- [ ] Define accessibility interactions (focus states, ARIA labels) for all interactive controls
- [ ] Create unit/integration tests covering critical workflows
