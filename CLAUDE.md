# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

## Architecture

**jrs-gpms** is a React SPA (Global Project Management System) for Jupiter Research Services, using Vite + Tailwind CSS v4 on the frontend and Supabase (PostgreSQL BaaS) as the backend.

### Key Files

- `src/App.jsx` — Application shell; owns all auth state, navigation state, and renders all major UI sections inline (Login, Dashboard, modals). The `Particles` canvas animation is also defined here.
- `src/components/CRM.jsx` — Full customer CRUD: lists, add/edit modal, delete. Reads/writes the `customers` Supabase table.
- `src/supabase.js` — Supabase client singleton, initialized from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Navigation Flow

`App.jsx` uses a simple `currentPage` state string (`'login'`, `'dashboard'`, `'crm'`, `'erp'`, `'wms'`) — no React Router routes are active yet even though the package is installed.

### Supabase Tables

| Table | Key Columns |
|-------|------------|
| `users` | `id`, `name`, `role`, `password` (plain-text) |
| `customers` | `id`, `name`, `email`, `phone`, `company`, `status`, `notes`, `created_at` |

Authentication is manual: fetch all users, match name + password in JS. ERP and WMS modules are placeholders.

### Environment Variables

Create a `.env` file (not committed) with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
Vite exposes these via `import.meta.env`.

### Styling

Tailwind CSS v4 is wired through `@tailwindcss/vite` — no `tailwind.config.js` needed. The design uses glass-morphism cards, dark/blue gradients, and an animated particle canvas background on the login screen.
