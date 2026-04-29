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
- `src/App.jsx` (~1,377 lines) — Application shell. Owns auth state (`currentUser`, `selectedCompany`), navigation (`activePage`), theme toggle, per-user notifications (realtime via Supabase channel), admin pending-approval badge, auto-logout after 10 minutes of inactivity, and a `FeedbackWidget` that writes to the `feedback` table. Contains `LoginPage`, the `Dashboard` layout wrapper (sidebar + topbar), and all modal overlays. Session is persisted in `localStorage` under `jrs_user`, `jrs_company`, `jrs_theme`.
- `src/Dashboard.jsx` (~583 lines) — Landing page after login. Shows summary stat cards (fetches from multiple tables) and a personal task widget whose data is stored in `localStorage` keyed by `jrs_tasks_<userId>` (not in Supabase).
- `src/Inquiries.jsx` (~1,963 lines) — RFQ/inquiry management. Full CRUD, inline status editing via portal dropdown, bulk selection, Excel/CSV import with auto-column detection, PDF/Excel export, and report generation. Calls `logActivity` for all mutations.
- `src/Masters.jsx` (~3,761 lines) — Master data management. Tabbed CRUD for five masters (Company, Customers, Suppliers, Products, Storage) via a generic `MasterSection` component. Non-admin users submit new customers as `pending_approval=true`; admins approve/reject via `Admin.jsx`. Auto-generates record codes using prefixes from the `code_formats` table.
- `src/Admin.jsx` (~885 lines) — Admin-only panel with three tabs: **Pending Approvals** (approve/reject customer submissions), **Activity Log** (reads `audit_logs` table, filterable by user/module/action), and **Backup** (downloads a full data backup as Excel). Also defines `ADMIN_USERS` (duplicated from `App.jsx`).
- `src/auditLogger.js` — Thin utility that writes a row to the `audit_logs` Supabase table. Called by Inquiries, Masters, Estimates, and App on every create/edit/delete/import/login.
- `src/Estimates.jsx` (~345 lines) — Estimate/quote list view under the ERP sub-nav. CRUD + PDF download.
- `src/EstimateModal.jsx` (~1,030 lines) — Estimate create/edit form and PDF generator (`generateEstimatePDF`). Contains `COMPANY_CONFIG` with company-specific bank details and addresses for Inc / BV / India.
- `src/CRM.jsx` (~798 lines) — Customer relationship management. Present in the codebase but **not wired into the current navigation**; `activePage` never resolves to `'crm'`.
- `src/supabase.js` — Supabase client singleton (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### Navigation Flow

`App.jsx` renders pages conditionally on `activePage` string state. Active values:

| `activePage` | Component rendered |
|---|---|
| `'dashboard'` | `DashboardPage` |
| `'inquiries'` | `Inquiries` |
| `'masters'` or `'masters-*'` | `Masters` (with `initialTab` derived from suffix) |
| `'admin'` | `AdminModule` (only if `isAdmin`) |
| `'erp-estimates'` | `Estimates` |
| `'wms'` | Placeholder UI |

Masters sub-pages: `masters-company`, `masters-customers`, `masters-vendors`, `masters-products`, `masters-storage`. The ERP sub-nav is a collapsible group; `erp-estimates` is currently the only ERP child. No React Router is wired up.

### Authentication & Authorization

`LoginPage` fetches all rows from `users`, lets the user pick a company (hard-coded `COMPANIES` array: `Jupiter Research Services Inc/BV/India`), select an account, and enter a password. Auth is a direct Supabase query matching `name` + `password` (stored plaintext).

Admin access is gated by a hard-coded `ADMIN_USERS` array (defined in both `App.jsx` and `Admin.jsx`):
```js
const ADMIN_USERS = ['Mahendra Sannappa', 'Pratik Shah', 'Sanket Patel', 'Sachin Shah']
```
`isAdmin` controls rendering of the Admin nav item, the pending-approval badge, and the `AdminModule`.

### Supabase Tables

All tables have RLS **disabled** — multi-tenancy is enforced in application code via `.eq('company', company)` on every query. The full schema (with `ALTER TABLE` migration statements for columns added after initial creation) is in `database_setup.sql`.

| Table | Notable Columns |
|-------|----------------|
| `users` | `id`, `name`, `role`, `password` (plaintext) |
| `inquiries` | `customer`, `account_manager`, `status`, `date_added`, `sourcing_country`, `product`, `ndc_ma_code`, `manufacturer`, `quantity`, `currency`, `quote_price`, `purchase_price`, `supplier`, `company` |
| `customers_master` | `name`, `customer_code`, `country`, `state`, `postal_code`, `website`, `bill_to_*`, `ship_to_*`, `contact[1-3]_*`, `is_approved`, `pending_approval`, `submitted_by`, `company` |
| `vendors_master` | `name`, `address1/2`, `contact[1-3]_*`, `approved_date`, `valid_through`, `license_number`, `company` |
| `products_master` | `name`, `product_code`, `pack_size`, `ndc_ma_code`, `country_of_origin`, `company` |
| `storage_master` | `name`, `location`, `company` |
| `estimates` | Estimate/quote records used by `Estimates.jsx` and `EstimateModal.jsx` |
| `notifications` | `recipient_name`, `is_read`, `created_at` — written by Admin approve/reject; read with realtime subscription in `App.jsx` |
| `audit_logs` | `actor_name`, `actor_role`, `company`, `module`, `action`, `record_id`, `record_label`, `details` — written via `auditLogger.js`; read in `Admin.jsx` Activity Log tab |
| `code_formats` | `type` (customer/supplier/product), `country`, `prefix`, `company` — used by `Masters.jsx` to auto-generate record codes |
| `company_master` | Company-level settings; managed via the Company Master tab in `Masters.jsx` (not filtered by company) |
| `feedback` | Written by `FeedbackWidget` in `App.jsx` |
| `attachments` | File attachments (referenced in source) |

### State Management Patterns

No context providers or external state libraries. All state is local `useState` + prop drilling. Key patterns:

- `useEffect` with `[company]` dependency to refetch data on company switch
- `useEffect` + `document.addEventListener('mousedown', ...)` for click-outside-to-close dropdowns (always cleaned up in return)
- `useEffect` + `window.addEventListener('keydown', ...)` for Escape-to-close modals
- `useMemo` for derived values (e.g., live margin calculation in Inquiries)
- `useRef` for DOM targeting (portal positioning, focus management)
- Portal dropdowns (`createPortal` into `document.body`) for status pickers that need to escape overflow-hidden containers

### Import/Export Dependencies

- `xlsx` — Excel/CSV parsing (import) and workbook generation (export)
- `jspdf` + `jspdf-autotable` — PDF report generation (estimates and inquiry reports)

### Styling

Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`. All styles are inline Tailwind classes. Dynamic values use inline `style={}`. Design language: dark navy/blue gradients (`#0a1628`, `#0f1f3d`) for the shell, light `#f1f5f9` content area, glass-morphism cards with `backdrop-blur`. Icons are inline SVG — `lucide-react` is installed but unused.

Light/dark theme is toggled at the `Dashboard` wrapper level via `theme` prop; individual page components receive `theme` and apply conditional class names.

### Environment Variables

Create a `.env` file (not committed):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Supabase

`dev` and `main` share the same single Supabase project. Run any schema changes (new tables, columns, indexes) directly in the Supabase SQL Editor. No migrations file is maintained.
