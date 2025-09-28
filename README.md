# MoveWise Floor Plan Helper

This repository contains the React 18 prototype for the MoveWise mobile experience. The current build focuses on scaffolding the four core feature areas outlined in the PRD: move timeline management, furniture inventory, layout planning, and export/share preparation.

## Scripts

- `npm install` – install dependencies
- `npm run dev` – start the Vite dev server
- `npm run build` – create a production build
- `npm run lint` – run ESLint across the project

## Project Structure

- `src/App.jsx` – application shell binding the feature placeholders together
- `src/components` – feature-specific UI components and helper sections
- `src/App.css` and `src/index.css` – global and layout styling
- `TASKS.md` – implementation backlog covering remaining PRD functionality

## Next Steps

Follow the items in `TASKS.md` to flesh out persistence, the interactive canvas, and sharing flows. The scaffold was designed so each feature can evolve independently while sharing state through the top-level app.
