import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'

// ── Countries & States ────────────────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria',
  'Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia',
  'Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland',
  'France','Germany','Ghana','Greece','Hungary','India','Indonesia',
  'Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya',
  'Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria',
  'Norway','Pakistan','Philippines','Poland','Portugal','Romania',
  'Russia','Saudi Arabia','Singapore','South Africa','South Korea',
  'Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand',
  'Turkey','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Vietnam',
]

const STATES_BY_COUNTRY = {
  'United States': [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
    'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
    'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota',
    'Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York',
    'North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
    'Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
    'West Virginia','Wisconsin','Wyoming',
  ],
  'India': [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya',
    'Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
    'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
    'West Bengal','Delhi','Jammu & Kashmir','Ladakh',
  ],
  'Australia': [
    'New South Wales','Victoria','Queensland','Western Australia',
    'South Australia','Tasmania','Australian Capital Territory',
    'Northern Territory',
  ],
  'Canada': [
    'Alberta','British Columbia','Manitoba','New Brunswick',
    'Newfoundland and Labrador','Northwest Territories','Nova Scotia',
    'Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon',
  ],
  'United Kingdom': ['England','Scotland','Wales','Northern Ireland'],
  'Germany': [
    'Baden-Württemberg','Bavaria','Berlin','Brandenburg','Bremen',
    'Hamburg','Hesse','Lower Saxony','Mecklenburg-Vorpommern',
    'North Rhine-Westphalia','Rhineland-Palatinate','Saarland',
    'Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia',
  ],
}

// ── Master config (vendors / products / storage) ──────────────────────────────
const MASTERS = {
  vendors: {
    label: 'Supplier Master',
    table: 'vendors_master',
    color: 'text-purple-600 bg-purple-50',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    fields: [
      { key: 'name', label: 'Supplier Name', required: true, placeholder: 'e.g. Global Supplies Inc' },
    ],
    columns: [
      { label: 'Supplier Name', key: 'name' },
      { label: 'Added', key: 'created_at', format: 'date' },
    ],
  },
  products: {
    label: 'Product Master',
    table: 'products_master',
    color: 'text-emerald-600 bg-emerald-50',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    fields: [
      { key: 'name',         label: 'Product Name',  required: true,  placeholder: 'e.g. Paracetamol 500mg' },
      { key: 'ndc_ma_code',  label: 'NDC / MA Code', required: false, placeholder: 'e.g. NDC 12345-678' },
      { key: 'manufacturer', label: 'Manufacturer',  required: false, placeholder: 'e.g. Bayer AG' },
    ],
    columns: [
      { label: 'Product Name',  key: 'name' },
      { label: 'NDC / MA Code', key: 'ndc_ma_code' },
      { label: 'Manufacturer',  key: 'manufacturer' },
      { label: 'Added',         key: 'created_at', format: 'date' },
    ],
  },
  storage: {
    label: 'Storage Master',
    table: 'storage_master',
    color: 'text-amber-600 bg-amber-50',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    fields: [
      { key: 'name',     label: 'Storage Name', required: true,  placeholder: 'e.g. Warehouse A' },
      { key: 'location', label: 'Location',     required: false, placeholder: 'e.g. Amsterdam, NL' },
    ],
    columns: [
      { label: 'Storage Name', key: 'name' },
      { label: 'Location',     key: 'location' },
      { label: 'Added',        key: 'created_at', format: 'date' },
    ],
  },
}

const TABS = [
  {
    key: 'customers', label: 'Customer Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  },
  {
    key: 'vendors', label: 'Supplier Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  {
    key: 'products', label: 'Product Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  },
  {
    key: 'storage', label: 'Storage Master',
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  },
]

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
      {toast.type === 'success'
        ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
      {toast.message}
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ displayName, masterLabel, onConfirm, onCancel }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onCancel])
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Delete Entry</h3>
        <p className="text-gray-500 text-sm text-center mb-6">
          Remove <span className="font-semibold text-gray-800">{displayName}</span> from {masterLabel}?
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

// ── Shared field components ───────────────────────────────────────────────────
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

const selectCls = err =>
  `w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition bg-white
   ${err ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'}`

// ── Remarks tooltip (portal) ─────────────────────────────────────────────────
function RemarksCell({ text }) {
  const [tooltip, setTooltip] = useState(null)

  if (!text) return <span style={{ color: '#cbd5e1' }}>—</span>

  function handleMouseEnter(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ top: rect.bottom + 8, left: rect.left })
  }

  return (
    <>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
        style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default', maxWidth: 160 }}
      >
        {text}
      </span>
      {tooltip && createPortal(
        <div style={{
          position: 'fixed',
          top: tooltip.top,
          left: tooltip.left,
          zIndex: 99999,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px',
          maxWidth: 300,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          fontSize: 13,
          color: '#374151',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          pointerEvents: 'none',
        }}>
          {text}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Customer Section ──────────────────────────────────────────────────────────
const EMPTY_CUSTOMER = {
  name: '',
  address1: '', address2: '',
  country: '', state: '', postal_code: '',
  website: '',
  contact1_name: '', contact1_email: '', contact1_phone: '',
  contact2_name: '', contact2_email: '', contact2_phone: '',
  contact3_name: '', contact3_email: '', contact3_phone: '',
  approved_date: '',
  remarks: '',
}

function CustomerSection({ company, showToast }) {
  const [entries, setEntries]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_CUSTOMER)
  const [freeTextState, setFreeTextState] = useState(false)
  const [errors, setErrors]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]           = useState('')
  const firstInputRef                 = useRef(null)

  useEffect(() => { fetchEntries() }, [company])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('customers_master').select('*').eq('company', company).order('name')
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_CUSTOMER); setErrors({}); setFreeTextState(false) }

  function openAdd() { setEditing(null); setForm(EMPTY_CUSTOMER); setErrors({}); setFreeTextState(false); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    const presets = STATES_BY_COUNTRY[entry.country] || []
    setFreeTextState(!!(entry.state && !presets.includes(entry.state)))
    setForm(Object.fromEntries(Object.keys(EMPTY_CUSTOMER).map(k => [k, entry[k] || ''])))
    setErrors({})
    setShowForm(true)
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function handleCountryChange(val) {
    setForm(prev => ({ ...prev, country: val, state: '' }))
    setFreeTextState(false)
    setErrors(prev => ({ ...prev, country: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name?.trim()) e.name = 'Customer name is required'
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      const { error } = await supabase.from('customers_master').update(payload).eq('id', editing.id)
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      showToast('Customer updated')
    } else {
      const { error } = await supabase.from('customers_master').insert([payload])
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      showToast('Customer added')
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    await supabase.from('customers_master').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.name?.toLowerCase().includes(q) ||
      e.country?.toLowerCase().includes(q) ||
      e.state?.toLowerCase().includes(q) ||
      e.contact1_name?.toLowerCase().includes(q) ||
      e.contact1_email?.toLowerCase().includes(q)
    )
  })

  const hasPresetStates = !!(STATES_BY_COUNTRY[form.country]?.length)

  return (
    <div className="space-y-4">
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel="Customer Master"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-blue-600 bg-blue-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Customer Master</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Entry
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600 bg-blue-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? 'No customers yet' : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '1100px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {/* Frozen column */}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Customer Name
                  </th>
                  {['Address 1','Address 2','Country','State','Postal Code','Website','Contact 1 Name','Contact 1 Email','Contact 1 Phone','Contact 2 Name','Contact 2 Email','Contact 2 Phone','Contact 3 Name','Contact 3 Email','Contact 3 Phone','Approved Date','Remarks'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50">{h}</th>
                  ))}
                  {/* Frozen Actions column */}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', right: 0, zIndex: 2, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-blue-50/30 transition group">
                    {/* Frozen customer name cell */}
                    <td className="px-5 py-3.5 bg-white group-hover:bg-blue-50"
                        style={{ position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
                    {/* Scrollable columns */}
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.address1 || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.address2 || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.country || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.state || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.postal_code || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {entry.website
                        ? <a href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs max-w-[140px] block truncate">
                            {entry.website}
                          </a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact1_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact2_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact2_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact2_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact3_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact3_email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.contact3_phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.approved_date)}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px]">
                      <RemarksCell text={entry.remarks} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap bg-white group-hover:bg-blue-50"
                        style={{ position: 'sticky', right: 0, zIndex: 1, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(entry)}
                          className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelete(entry)}
                          className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Customer' : 'New Customer'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Customer Master</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Customer Name */}
              <Field label="Customer Name *" error={errors.name}>
                <input
                  ref={firstInputRef}
                  className={inputCls(!!errors.name)}
                  value={form.name}
                  placeholder="e.g. Pharma Corp Ltd"
                  onChange={e => setField('name', e.target.value)}
                />
              </Field>

              {/* Address */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address Line 1">
                  <input className={inputCls(false)} value={form.address1} placeholder="Street address"
                    onChange={e => setField('address1', e.target.value)} />
                </Field>
                <Field label="Address Line 2">
                  <input className={inputCls(false)} value={form.address2} placeholder="Suite, floor, etc."
                    onChange={e => setField('address2', e.target.value)} />
                </Field>
              </div>

              {/* Country / State / Postal */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Country">
                  <select className={selectCls(false)} value={form.country} onChange={e => handleCountryChange(e.target.value)}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="State / Province">
                  <div className="flex gap-2">
                    {hasPresetStates && !freeTextState ? (
                      <select className={`${selectCls(false)} flex-1`} value={form.state} onChange={e => setField('state', e.target.value)}>
                        <option value="">Select state…</option>
                        {STATES_BY_COUNTRY[form.country].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input className={`${inputCls(false)} flex-1`} value={form.state} placeholder="Enter state…"
                        onChange={e => setField('state', e.target.value)} />
                    )}
                    {hasPresetStates && (
                      <button
                        type="button"
                        title={freeTextState ? 'Switch to dropdown' : 'Switch to free text'}
                        onClick={() => { setFreeTextState(p => !p); setField('state', '') }}
                        className="px-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition text-sm"
                      >✎</button>
                    )}
                  </div>
                </Field>
                <Field label="Postal Code">
                  <input className={inputCls(false)} value={form.postal_code} placeholder="e.g. 10001"
                    onChange={e => setField('postal_code', e.target.value)} />
                </Field>
              </div>

              {/* Website */}
              <Field label="Website">
                <input className={inputCls(false)} value={form.website} placeholder="e.g. www.example.com"
                  onChange={e => setField('website', e.target.value)} />
              </Field>

              {/* Contact blocks */}
              {[1, 2, 3].map(n => (
                <div key={n} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact {n}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Name">
                      <input className={inputCls(false)} value={form[`contact${n}_name`]} placeholder="Full name"
                        onChange={e => setField(`contact${n}_name`, e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input type="email" className={inputCls(false)} value={form[`contact${n}_email`]} placeholder="email@example.com"
                        onChange={e => setField(`contact${n}_email`, e.target.value)} />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" className={inputCls(false)} value={form[`contact${n}_phone`]} placeholder="+1 555 000 0000"
                        onChange={e => setField(`contact${n}_phone`, e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}

              {/* Approved Date */}
              <Field label="Approved Date">
                <input type="date" className={inputCls(false)} value={form.approved_date}
                  onChange={e => setField('approved_date', e.target.value)} />
              </Field>

              {/* Remarks */}
              <Field label="Remarks">
                <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.remarks}
                  placeholder="Any additional notes…"
                  onChange={e => setField('remarks', e.target.value)} />
              </Field>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 shrink-0">
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

// ── Generic Master Section (vendors / products / storage) ─────────────────────
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

  function emptyForm() { return cfg.fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}) }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm()); setErrors({}) }
  function openAdd()   { setEditing(null); setForm(emptyForm()); setErrors({}); setShowForm(true) }

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
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel={cfg.label}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>{cfg.icon}</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{cfg.label}</h2>
            <p className="text-gray-400 text-xs">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} for {company}</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 [&_svg]:w-8 [&_svg]:h-8 ${cfg.color}`}>{cfg.icon}</div>
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
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </button>
                      <button onClick={() => setConfirmDelete(entry)}
                        className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
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

  function showToast(msg, type) { setToast({ message: msg, type: type || 'success' }) }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="max-w-screen-xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Masters</h1>
          <p className="text-gray-400 text-sm mt-0.5">{company}</p>
        </div>

        {/* Tab Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
                ${activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Active Section */}
        {activeTab === 'customers'
          ? <CustomerSection key="customers" company={company} showToast={showToast} />
          : <MasterSection key={activeTab} masterKey={activeTab} company={company} showToast={showToast} />
        }

      </div>
    </div>
  )
}
