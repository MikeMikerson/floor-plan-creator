# MoveWise Floor Plan Helper

This repository contains the React 18 prototype for the MoveWise mobile experience. The current build now includes a fully interactive "Home Layout Designer" that lets teams validate the PRD flows end-to-end: upload and scale floor plans, drag furniture from the inventory, arrange items with grid snapping, and review collision warnings before moving day.

## Scripts

- `npm install` – install dependencies
- `npm run server` – start the vectorization API bridge (Express)
- `npm run dev` – start the Vite dev server
- `npm run dev:full` – run the server and Vite concurrently
- `npm run build` – create a production build
- `npm run lint` – run ESLint across the project

## Project Structure

- `src/App.jsx` – application shell coordinating feature state and persistence
- `src/components` – feature-specific UI components and helper sections
- `src/App.css` and `src/index.css` – global and layout styling
- `TASKS.md` – implementation backlog covering remaining PRD functionality

## Layout Designer Highlights

- Upload a floor plan image, establish real-world scale with common reference objects, and autosave the setup locally
- Convert the raster floor plan into movable SVG fragments using OpenAI or Google Gemini so walls and fixtures can be rearranged alongside furniture
- Zoom, pan, and snap to a flexible grid while arranging furniture placed from the inventory via drag-and-drop
- Rotate items with on-canvas handles or keyboard shortcuts, colour-code by room, and surface same-room collisions in real time
- Manage history with undo/redo controls and reset the entire layout (including floor plan, vector fragments, and scale) through a confirmation dialog

## Next Steps

Focus on the remaining backlog items in `TASKS.md`, including persistence for timeline/inventory, the export/share flow, onboarding guidance, and automated testing.

## Environment

Create a `.env` file in the project root (or export the variables in your shell) before starting the server:

```
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
# Optional overrides
# OPENAI_VISION_MODEL=gpt-4.1-mini
# GEMINI_VISION_MODEL=gemini-2.5-flash
# CLIENT_ORIGIN=http://localhost:5173
```

The front-end reads `VITE_VECTOR_API_BASE_URL` and `VITE_VECTOR_PROVIDER` to target a remote server or default provider when needed.
