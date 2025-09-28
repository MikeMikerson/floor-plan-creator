# MoveWise Floor Plan Helper

This repository contains the React 18 prototype for the MoveWise mobile experience. The current build now includes a fully interactive "Home Layout Designer" that lets teams validate the PRD flows end-to-end: upload and scale floor plans, drag furniture from the inventory, arrange items with grid snapping, and review collision warnings before moving day.

## Scripts

- `npm install` – install dependencies
- `npm run dev` – start the Vite dev server
- `npm run build` – create a production build
- `npm run lint` – run ESLint across the project

## Project Structure

- `src/App.jsx` – application shell coordinating feature state and persistence
- `src/components` – feature-specific UI components and helper sections
- `src/App.css` and `src/index.css` – global and layout styling
- `TASKS.md` – implementation backlog covering remaining PRD functionality

## Layout Designer Highlights

- Upload a floor plan image, establish real-world scale with common reference objects, and autosave the setup locally
- Zoom, pan, and snap to a flexible grid while arranging furniture placed from the inventory via drag-and-drop
- Rotate items with on-canvas handles or keyboard shortcuts, colour-code by room, and surface same-room collisions in real time
- Manage history with undo/redo controls and reset the entire layout (including floor plan and scale) through a confirmation dialog

## Next Steps

Focus on the remaining backlog items in `TASKS.md`, including persistence for timeline/inventory, the export/share flow, onboarding guidance, and automated testing.
