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

No test suite is configured.

## Architecture

**jrs-gpms** is a React SPA (Global Project Management System) for Jupiter Research Services. Stack: Vite + React 19 + Tailwind CSS v4 + Supabase (PostgreSQL BaaS). No TypeScript, no state management library, no React Router (installed but unused).

### Key Source Files

- `src/main.jsx` — Entry point; mounts `<App>` into `#root`.
- `src/App.jsx` — Application shell. Owns auth state (`currentUser`, `company`), navigation state (`activePage`), session persistence via `localStorage`, and renders all top-level UI: `LoginPage`, `Dashboard`, navbar, company switcher, profile/password modals, and the animated particle canvas on login.
- `src/Inquiries.jsx` — RFQ/inquiry management (~1,700 lines). Full CRUD, inline status editing via portal dropdown, bulk selection, Excel/CSV import with auto-column detection, PDF/Excel export, and 6 report types.
- `src/Masters.jsx` — Master data management. Tabbed CRUD for four masters (customers, vendors, products, storage locations) via a generic reusable `MasterSection` component.
- `src/CRM.jsx` — Alternative customer management (~800 lines). CRUD with bulk Excel/CSV import (column mapping wizard), stat cards, status/search filtering.
- `src/supabase.js` — Supabase client singleton (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### Navigation Flow

`App.jsx` conditionally renders pages based on `activePage` string state: `'dashboard'` | `'inquiries'` | `'masters'` | `'crm'` | `'erp'` | `'wms'`. ERP and WMS are placeholders. No React Router is wired up.

### Authentication

`LoginPage` fetches all rows from `users`, lets the user pick a company (hard-coded list: Inc / BV / India), select an account, and enter a password. Auth is a direct Supabase query matching `name` + `password` (stored plaintext). On success, `currentUser` and `company` are written to `localStorage` and restored on App mount.

### Supabase Tables

All tables have RLS **disabled** — multi-tenancy is enforced in application code via `.eq('company', company)` on every query.

| Table | Key Columns |
|-------|-------------|
| `users` | `id`, `name`, `role`, `password` (plaintext) |
| `inquiries` | `id`, `customer`, `account_manager`, `status`, `date_added`, `sourcing_country`, `product`, `ndc_ma_code`, `manufacturer`, `quantity`, `currency`, `quote_price`, `purchase_price`, `supplier`, `company`, `created_at` |
| `customers_master` | `id`, `name`, `company`, `created_at` |
| `vendors_master` | `id`, `name`, `company`, `created_at` |
| `products_master` | `id`, `name`, `ndc_ma_code`, `manufacturer`, `company`, `created_at` |
| `storage_master` | `id`, `name`, `location`, `company`, `created_at` |

`database_setup.sql` at the project root contains the full schema with indexes.

### State Management Patterns

No context providers or external state libraries. All state is local `useState` + prop drilling. Key patterns used throughout:

- `useEffect` with `[company]` dependency to refetch data on company switch
- `useEffect` with `document.addEventListener('mousedown', ...)` for click-outside-to-close dropdowns (always cleaned up in return)
- `useEffect` with `window.addEventListener('keydown', ...)` for Escape-to-close modals
- `useMemo` for derived values (e.g., live margin calculation in Inquiries)
- `useRef` for DOM targeting (portal positioning, focus management)

### Import/Export Dependencies

- `xlsx` — Excel/CSV parsing (import) and workbook generation (export)
- `jspdf` + `jspdf-autotable` — PDF report generation

### Styling

Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`. All styles are inline Tailwind classes. Dynamic values use inline `style={}`. Design language: dark navy/blue gradients (`#0a1628`, `#0f1f3d`) for the shell, light `#f1f5f9` content area, glass-morphism cards with backdrop blur. Icons are inline SVG, not from lucide-react (which is installed but unused).

### Environment Variables

Create a `.env` file (not committed):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
