import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── Master config ─────────────────────────────────────────────────────────────
const MASTERS = {
  customers: {
    label: 'Customer Master',
    table: 'customers_master',
    icon:  '👥',
    fields: [
      { key: 'name', label: 'Customer Name', required: true, placeholder: 'e.g. Pharma Corp Ltd' },
    ],
    columns: [
      { label: 'Customer Name', key: 'name'       },
      { label: 'Added',         key: 'created_at', format: 'date' },
    ],
  },
  vendors: {
    label: 'Vendor Master',
    table: 'vendors_master',
    icon:  '🏭',
    fields: [
      { key: 'name', label: 'Vendor Name', required: true, placeholder: 'e.g. Global Supplies Inc' },
    ],
    columns: [
      { label: 'Vendor Name', key: 'name'       },
      { label: 'Added',       key: 'created_at', format: 'date' },
    ],
  },
  products: {
    label: 'Product Master',
    table: 'products_master',
    icon:  '💊',
    fields: [
      { key: 'name',         label: 'Product Name',   required: true, placeholder: 'e.g. Paracetamol 500mg' },
      { key: 'ndc_ma_code',  label: 'NDC / MA Code',  required: false, placeholder: 'e.g. NDC 12345-678' },
      { key: 'manufacturer', label: 'Manufacturer',   required: false, placeholder: 'e.g. Bayer AG' },
    ],
    columns: [
      { label: 'Product Name',  key: 'name'         },
      { label: 'NDC / MA Code', key: 'ndc_ma_code'  },
      { label: 'Manufacturer',  key: 'manufacturer' },
      { label: 'Added',         key: 'created_at',   format: 'date' },
    ],
  },
  storage: {
    label: 'Storage Master',
    table: 'storage_master',
    icon:  '🏪',
    fields: [
      { key: 'name',     label: 'Storage Name', required: true, placeholder: 'e.g. Warehouse A' },
      { key: 'location', label: 'Location',     required: false, placeholder: 'e.g. Amsterdam, NL' },
    ],
    columns: [
      { label: 'Storage Name', key: 'name'       },
      { label: 'Location',     key: 'location'   },
      { label: 'Added',        key: 'created_at', format: 'date' },
    ],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])
  if (!toast) return null
  return (
    <div className={`fixed top-5 right-5 z-[200] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-none select-none
      ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      <span>{toast.type === 'success' ? '✓' : '✕'}</span>
      {toast.message}
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ entry, masterLabel, onConfirm, onCancel }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onCancel])
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Delete Entry</h3>
        <p className="text-gray-500 text-sm text-center mb-6">
          Remove <span className="font-semibold text-gray-800">{entry?.name}</span> from {masterLabel}?
          <br />This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium transition">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputCls = err =>
  `w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition
   ${err ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'}`

// ── Master Section (generic CRUD for one master type) ─────────────────────────
function MasterSection({ masterKey, company, showToast }) {
  const cfg = MASTERS[masterKey]
  const [entries, setEntries]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState({})
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]       = useState('')
  const firstInputRef             = useRef(null)

  useEffect(() => { fetchEntries() }, [company, masterKey])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase.from(cfg.table).select('*').eq('company', company).order('name')
    setEntries(data || [])
    setLoading(false)
  }

  function emptyForm() {
    return cfg.fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm()); setErrors({}) }

  function openAdd() { setEditing(null); setForm(emptyForm()); setErrors({}); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    setForm(cfg.fields.reduce((acc, f) => ({ ...acc, [f.key]: entry[f.key] || '' }), {}))
    setErrors({}); setShowForm(true)
  }

  function validate() {
    const e = {}
    cfg.fields.filter(f => f.required).forEach(f => {
      if (!form[f.key]?.trim()) e[f.key] = `${f.label} is required`
    })
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      await supabase.from(cfg.table).update(payload).eq('id', editing.id)
      showToast(`${cfg.label.split(' ')[0]} updated`)
    } else {
      await supabase.from(cfg.table).insert([payload])
      showToast(`${cfg.label.split(' ')[0]} added`)
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    await supabase.from(cfg.table).delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    return !q || cfg.fields.some(f => e[f.key]?.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-4">
      {confirmDelete && (
        <DeleteModal entry={confirmDelete} masterLabel={cfg.label}
          onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{cfg.label}</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Entry
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${cfg.label.toLowerCase()}…`}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-3xl mb-3">{cfg.icon}</p>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? `No ${cfg.label.toLowerCase()} yet` : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {cfg.columns.map(col => (
                  <th key={col.key} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.label}</th>
                ))}
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-blue-50/30 transition group">
                  {cfg.columns.map((col, i) => (
                    <td key={col.key} className="px-5 py-3.5">
                      {i === 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {entry.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{entry[col.key]}</span>
                        </div>
                      ) : col.format === 'date' ? (
                        <span className="text-gray-400 text-xs">{formatDate(entry[col.key])}</span>
                      ) : (
                        <span className="text-gray-600">{entry[col.key] || <span className="text-gray-300">—</span>}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(entry)}
                        className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button onClick={() => setConfirmDelete(entry)}
                        className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Entry' : `New ${cfg.label.split(' ')[0]}`}</h2>
                <p className="text-gray-400 text-xs mt-0.5">{cfg.label}</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-xl transition">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {cfg.fields.map((f, i) => (
                <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`} error={errors[f.key]}>
                  <input
                    ref={i === 0 ? firstInputRef : null}
                    className={inputCls(!!errors[f.key])}
                    value={form[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => { setForm(prev => ({ ...prev, [f.key]: e.target.value })); setErrors(prev => ({ ...prev, [f.key]: '' })) }}
                    onKeyDown={e => e.key === 'Enter' && i === cfg.fields.length - 1 && save()}
                  />
                </Field>
              ))}
            </div>

            <div className="flex gap-3 px-6 pb-5">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Masters Component ────────────────────────────────────────────────────
export default function Masters({ company }) {
  const [activeTab, setActiveTab] = useState('customers')
  const [toast, setToast]         = useState(null)

  const TABS = Object.entries(MASTERS).map(([key, cfg]) => ({ key, label: cfg.label, icon: cfg.icon }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="max-w-screen-xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Masters</h1>
          <p className="text-gray-400 text-sm mt-0.5">{company}</p>
        </div>

        {/* ── Tab Bar ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
                ${activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Active Section ── */}
        <MasterSection
          key={activeTab}
          masterKey={activeTab}
          company={company}
          showToast={(msg, type) => setToast({ message: msg, type: type || 'success' })}
        />

      </div>
    </div>
  )
}
