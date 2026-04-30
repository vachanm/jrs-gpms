import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'
import EstimateModal from './EstimateModal'
import { logActivity } from './auditLogger'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES   = ['Active', 'Inactive', 'Lead', 'Prospect']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR']
const CURRENCY_SYMBOL = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }

const PRODUCT_COUNTRIES = [
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

const MATERIAL_TYPES = [
  { label: 'Product',                 code: 'PR' },
  { label: 'Equipment',               code: 'EQ' },
  { label: 'Ancillary',               code: 'AN' },
  { label: 'Labels',                  code: 'LB' },
  { label: 'Bulk',                    code: 'BK' },
  { label: 'Services',                code: 'SR' },
  { label: 'Package',                 code: 'PK' },
  { label: 'Cartons',                 code: 'CT' },
  { label: 'Logistics',               code: 'LG' },
  { label: 'Asset',                   code: 'AS' },
  { label: 'Warehouse',               code: 'WH' },
  { label: 'Clinical Trial Material', code: 'TM' },
]

const UNITS_OF_MEASUREMENT = [
  { label: 'Each',             code: 'each' },
  { label: 'Syringe',         code: 'Syr'  },
  { label: 'Ampoules',        code: 'amps' },
  { label: 'Vials',           code: 'vial' },
  { label: 'Prefilled Syringe', code: 'PFS' },
  { label: 'Prefilled PEN',   code: 'PFP'  },
  { label: 'Cartridge',       code: 'Cart' },
  { label: 'Packs',           code: 'pack' },
]

const EMPTY_FORM = {
  customer: '', account_manager: '', status: 'Lead',
  date_added: new Date().toISOString().split('T')[0],
  sourcing_country: '', product: '', ndc_ma_code: '', manufacturer: '',
  quantity: '', currency: 'USD', quote_price: '', purchase_price: '', supplier: '',
}

const STATUS_STYLE = {
  Active:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Inactive: 'bg-gray-100   text-gray-500   border border-gray-200',
  Lead:     'bg-amber-50   text-amber-700   border border-amber-200',
  Prospect: 'bg-blue-50    text-blue-700    border border-blue-200',
}
const STATUS_DOT = {
  Active: 'bg-emerald-500', Inactive: 'bg-gray-400',
  Lead: 'bg-amber-500', Prospect: 'bg-blue-500',
}

const FIELD_ALIASES = {
  customer:        ['customer', 'customer name', 'client', 'client name'],
  account_manager: ['account manager', 'manager', 'handling manager', 'am'],
  status:          ['status', 'stage'],
  date_added:      ['date added', 'date', 'inquiry date'],
  sourcing_country:['sourcing country', 'country', 'origin'],
  product:         ['product', 'product name', 'item'],
  ndc_ma_code:     ['ndc', 'ma code', 'ndc/ma', 'national code', 'ndc ma code'],
  manufacturer:    ['manufacturer', 'mfr', 'brand'],
  quantity:        ['quantity', 'qty', 'units'],
  currency:        ['currency', 'cur'],
  quote_price:     ['quote price', 'price', 'sell price', 'quoted price'],
  purchase_price:  ['purchase price', 'cost', 'buy price', 'cost price'],
  supplier:        ['supplier', 'vendor', 'source'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcMargin(quotePrice, purchasePrice) {
  const q = parseFloat(quotePrice)
  const p = parseFloat(purchasePrice)
  if (!q || q === 0 || isNaN(q) || isNaN(p)) return null
  return ((q - p) / q * 100).toFixed(1)
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
    const day = String(d.getDate()).padStart(2, '0')
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
    return `${day}/${mon}/${d.getFullYear()}`
  } catch { return iso }
}

function autoDetectMapping(headers) {
  const map = {}
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const idx = lower.indexOf(alias)
      if (idx !== -1) { map[field] = headers[idx]; break }
    }
  }
  return map
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 3500)
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

// ── Copy Toast (bottom-center, 2 sec) ─────────────────────────────────────────
function CopyToast({ show }) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-none select-none bg-gray-900 text-white">
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Quote table copied!
    </div>
  )
}

// ── Copy quote helper (accepts array of inquiries) ────────────────────────────
const SYM = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }
const TD  = 'style="border:1px solid #ccc;padding:6px;"'
const TH  = 'style="border:1px solid #ccc;padding:6px;text-align:left;background-color:#f2f2f2;font-weight:bold;"'

async function copyQuoteToClipboard(rows) {
  const list = Array.isArray(rows) ? rows : [rows]

  const bodyHtml = list.map((inq, i) => {
    const sym   = SYM[inq.currency] || ''
    const price = inq.quote_price != null ? `${sym}${Number(inq.quote_price).toLocaleString()}` : ''
    return `<tr>
      <td ${TD}>${i + 1}</td>
      <td ${TD}>${inq.product      || ''}</td>
      <td ${TD}>${inq.ndc_ma_code  || ''}</td>
      <td ${TD}>${inq.manufacturer || ''}</td>
      <td ${TD}>${inq.quantity     != null ? inq.quantity : ''}</td>
      <td ${TD}>${inq.currency     || ''}</td>
      <td ${TD}>${price}</td>
    </tr>`
  }).join('\n')

  const html = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
  <thead>
    <tr>
      <th ${TH}>Sr. No</th>
      <th ${TH}>Product</th>
      <th ${TH}>NDC/MA</th>
      <th ${TH}>Manufacturer</th>
      <th ${TH}>Qty</th>
      <th ${TH}>Currency</th>
      <th ${TH}>Quote Price</th>
    </tr>
  </thead>
  <tbody>
${bodyHtml}
  </tbody>
</table>`

  const plainRows = list.map((inq, i) => {
    const sym   = SYM[inq.currency] || ''
    const price = inq.quote_price != null ? `${sym}${Number(inq.quote_price).toLocaleString()}` : ''
    return [i + 1, inq.product || '', inq.ndc_ma_code || '', inq.manufacturer || '',
            inq.quantity != null ? inq.quantity : '', inq.currency || '', price].join('\t')
  })
  const plain = [
    ['Sr. No', 'Product', 'NDC/MA', 'Manufacturer', 'Qty', 'Currency', 'Quote Price'].join('\t'),
    ...plainRows,
  ].join('\n')

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html':  new Blob([html],  { type: 'text/html'  }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    }),
  ])
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({ item, label, onConfirm, onCancel }) {
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
        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Delete {label}</h3>
        <p className="text-gray-500 text-sm text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-gray-800">{item?.customer || item?.name}</span>?
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

// ── Delete All Modal ──────────────────────────────────────────────────────────
function DeleteAllModal({ currentUser, count, onConfirm, onCancel }) {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setVerifying(true)
    const { data } = await supabase.from('users').select('id').eq('id', currentUser.id).eq('password', password).single()
    setVerifying(false)
    if (!data) { setError('Incorrect password. Please try again.'); return }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Delete All Inquiries</h3>
        <p className="text-gray-500 text-sm text-center mb-1">
          You are about to permanently delete <span className="font-semibold text-red-600">{count} inquiries</span>.
        </p>
        <p className="text-gray-400 text-xs text-center mb-5">This action cannot be undone. Enter your password to confirm.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={!password || verifying}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition">
              {verifying ? 'Verifying…' : 'Delete All'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Sort Icon ─────────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }) {
  const active = sortField === field
  return (
    <span className="ml-1 inline-flex flex-col gap-[1px]">
      <svg className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16z" /></svg>
      <svg className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4z" /></svg>
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  )
}

// ── Field Wrapper ─────────────────────────────────────────────────────────────
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

// ── Master Select (dropdown with + Add New) ───────────────────────────────────
function MasterSelect({ value, onChange, options, placeholder, err }) {
  return (
    <select
      className={inputCls(err)}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.name}>{opt.name}</option>
      ))}
    </select>
  )
}

// ── Quick Add Modal (add to master tables on the fly) ─────────────────────────
function QuickAddModal({ type, company, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', manufacturer: '', material_type: '', country_of_origin: '',
    ndc_ma_code: '', hsn_code: '', unit_of_measurement: '',
    pack_size: '', pack_dimension: '', pack_weight: '', remarks: '',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const config = {
    customer: { table: 'customers_master', label: 'Customer', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    vendor:   { table: 'vendors_master',   label: 'Vendor',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    product:  { table: 'products_master',  label: 'Product',  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> },
  }[type]

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const row = { ...form, name: form.name.trim(), company }
    if (type === 'product') {
      const mt = MATERIAL_TYPES.find(m => m.label === form.material_type)
      const mtCode = mt ? mt.code : 'PR'
      const coCode = form.country_of_origin ? form.country_of_origin.slice(0, 2).toUpperCase() : 'XX'
      const { data: existing } = await supabase.from('products_master').select('product_code').eq('company', company)
      const prefix = `${mtCode}-${coCode}-`
      const nums = (existing || [])
        .map(r => r.product_code)
        .filter(c => c && c.startsWith(prefix))
        .map(c => parseInt(c.replace(prefix, ''), 10))
        .filter(n => !isNaN(n))
      row.product_code = `${prefix}${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, '0')}`
    }
    if (type === 'customer') {
      const { data: existing } = await supabase.from('customers_master').select('customer_code').eq('company', company)
      const nums = (existing || []).map(r => r.customer_code).filter(c => c && /^CUS-\d+$/.test(c)).map(c => parseInt(c.replace('CUS-', ''), 10))
      row.customer_code = `CUS-${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, '0')}`
      row.is_approved = false
    }
    const { data, error } = await supabase.from(config.table).insert([row]).select().single()
    setSaving(false)
    if (error) { alert(`Failed to save: ${error.message}`); return }
    onSave(data)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5">{config.icon}<span>Add New {config.label}</span></h3>
            {type === 'product' && <p className="text-xs text-gray-400 mt-0.5">Saved to Product Master automatically</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {/* Row 1: Name + Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label={`${config.label} Name *`}>
                <input autoFocus className={inputCls(false)} value={form.name}
                  onChange={set('name')}
                  onKeyDown={e => { if (e.key === 'Enter' && type !== 'product') save() }}
                  placeholder={`Enter ${config.label.toLowerCase()} name`} />
              </Field>
            </div>
            {type === 'product' && (
              <Field label="Product Code">
                <input className={`${inputCls(false)} bg-gray-50 text-gray-400 font-mono text-xs`}
                  value="Auto-generated" readOnly disabled />
              </Field>
            )}
          </div>
          {type === 'product' && (
            <>
              {/* Row 2: Manufacturer + Material Type */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Manufacturer">
                  <input className={inputCls(false)} value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Bayer AG" />
                </Field>
                <Field label="Material Type">
                  <select className={inputCls(false)} value={form.material_type} onChange={set('material_type')}>
                    <option value="">Select type…</option>
                    {MATERIAL_TYPES.map(m => <option key={m.code} value={m.label}>{m.label} ({m.code})</option>)}
                  </select>
                </Field>
              </div>
              {/* Row 3: Country + NDC */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country of Origin">
                  <select className={inputCls(false)} value={form.country_of_origin} onChange={set('country_of_origin')}>
                    <option value="">Select country…</option>
                    {PRODUCT_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="NDC / MA Product Code">
                  <input className={inputCls(false)} value={form.ndc_ma_code} onChange={set('ndc_ma_code')} placeholder="e.g. NDC 12345-678" />
                </Field>
              </div>
              {/* Row 4: HSN + UOM */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="HSN Code">
                  <input className={inputCls(false)} value={form.hsn_code} onChange={set('hsn_code')} placeholder="e.g. 30049099" />
                </Field>
                <Field label="Unit of Measurement">
                  <select className={inputCls(false)} value={form.unit_of_measurement} onChange={set('unit_of_measurement')}>
                    <option value="">Select unit…</option>
                    {UNITS_OF_MEASUREMENT.map(u => <option key={u.code} value={u.code}>{u.label} ({u.code})</option>)}
                  </select>
                </Field>
              </div>
              {/* Row 5: Pack Size + Dimension + Weight */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Pack Size">
                  <input className={inputCls(false)} value={form.pack_size} onChange={set('pack_size')} placeholder="e.g. 10×10 blister" />
                </Field>
                <Field label="Pack Dimension">
                  <input className={inputCls(false)} value={form.pack_dimension} onChange={set('pack_dimension')} placeholder="e.g. 100×50×30 mm" />
                </Field>
                <Field label="Pack Weight">
                  <input className={inputCls(false)} value={form.pack_weight} onChange={set('pack_weight')} placeholder="e.g. 250g" />
                </Field>
              </div>
              {/* Row 6: Remarks */}
              <Field label="Remarks">
                <textarea className={`${inputCls(false)} resize-none`} rows={2}
                  value={form.remarks} onChange={set('remarks')} placeholder="Any additional notes…" />
              </Field>
            </>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Save & Select'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ file, company, onClose, onImported }) {
  const [step, setStep]           = useState('parsing')
  const [headers, setHeaders]     = useState([])
  const [rawRows, setRawRows]     = useState([])
  const [mapping, setMapping]     = useState({})
  const [preview, setPreview]     = useState([])
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    async function parse() {
      try {
        const buf  = await file.arrayBuffer()
        const wb   = XLSX.read(buf, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (json.length < 2) { setParseError('File appears to be empty.'); setStep('error'); return }
        const rawHeaders = json[0].map(h => String(h).trim()).filter(Boolean)
        const dataRows = json.slice(1)
          .map(row => { const o = {}; rawHeaders.forEach((h, i) => { o[h] = String(row[i] ?? '').trim() }); return o })
          .filter(r => Object.values(r).some(v => v !== ''))
        if (!dataRows.length) { setParseError('No data rows found.'); setStep('error'); return }
        setHeaders(rawHeaders); setRawRows(dataRows); setMapping(autoDetectMapping(rawHeaders)); setStep('map')
      } catch { setParseError('Could not read file. Ensure it is a valid .xlsx or .csv.'); setStep('error') }
    }
    parse()
  }, [file])

  function buildPreview() {
    return rawRows.map(row => {
      const d = {}
      Object.keys(FIELD_ALIASES).forEach(k => { d[k] = String(row[mapping[k]] || '').trim() })
      const errors = [], warnings = []
      if (!d.customer) errors.push('Customer is required')
      if (d.status && !STATUSES.includes(d.status)) { warnings.push(`Unknown status → Active`); d.status = 'Active' }
      else if (!d.status) d.status = 'Lead'
      if (!CURRENCIES.includes(d.currency)) d.currency = 'USD'
      d.company = company
      return { ...d, _errors: errors, _warnings: warnings, _ok: errors.length === 0 }
    })
  }

  const NUMERIC_FIELDS = ['quantity', 'quote_price', 'purchase_price']

  // Excel stores dates as serial numbers (days since 1900-01-01).
  // Convert them to YYYY-MM-DD strings; also handles regular date strings.
  function toDateString(val) {
    if (!val) return null
    const n = Number(val)
    if (!isNaN(n) && n > 1000) {
      // Excel serial → JS Date (subtract 25569 days to get Unix epoch days)
      const d = new Date(Math.round((n - 25569) * 86400 * 1000))
      return d.toISOString().split('T')[0]
    }
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }

  async function doImport() {
    setImportError('')
    const toInsert = preview
      .filter(r => r._ok)
      .map(({ _errors, _warnings, _ok, ...rest }) => {
        const row = { ...rest }
        // Convert empty strings to null for numeric columns
        NUMERIC_FIELDS.forEach(f => { row[f] = row[f] !== '' ? parseFloat(row[f]) || null : null })
        // Convert Excel serial dates or plain strings to YYYY-MM-DD
        row.date_added = toDateString(row.date_added)
        return row
      })
    setImporting(true)
    const { error } = await supabase.from('inquiries').insert(toInsert)
    setImporting(false)
    if (error) {
      setImportError(error.message)
      return
    }
    onImported(toInsert.length)
  }

  const okCount   = preview.filter(r => r._ok).length
  const warnCount = preview.filter(r => r._ok && r._warnings.length > 0).length
  const errCount  = preview.filter(r => !r._ok).length

  const IMPORT_FIELDS = Object.keys(FIELD_ALIASES)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import from Excel / CSV</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {step === 'map' && `${rawRows.length} rows found — map your columns`}
              {step === 'preview' && 'Review before importing'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-400 text-sm">Reading file…</p>
            </div>
          )}
          {step === 'error' && (
            <div className="text-center py-16">
              <div className="flex justify-center mb-3">
                <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800 mb-1">Could not read file</p>
              <p className="text-gray-400 text-sm">{parseError}</p>
            </div>
          )}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                <strong>{rawRows.length}</strong> rows detected. Map your file's columns to Inquiry fields. Fields marked auto-detected were matched automatically.
              </div>
              <div className="grid grid-cols-2 gap-4">
                {IMPORT_FIELDS.map(key => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      {key.replace(/_/g, ' ')}
                      {key === 'customer' && <span className="text-red-500 ml-1">*</span>}
                      {mapping[key]
                        ? <span className="ml-2 text-emerald-600 font-normal normal-case inline-flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            auto-detected
                          </span>
                        : <span className="ml-2 text-amber-500 font-normal normal-case">— not detected</span>}
                    </label>
                    <select className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      value={mapping[key] || ''}
                      onChange={e => setMapping({ ...mapping, [key]: e.target.value || undefined })}>
                      <option value="">— skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{okCount - warnCount} ready
                </span>
                {warnCount > 0 && <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{warnCount} with warnings
                </span>}
                {errCount > 0 && <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{errCount} will be skipped
                </span>}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Status', 'Customer', 'Product', 'Supplier', 'Currency', 'Quote', 'Purchase', 'Issues'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i} className={!row._ok ? 'bg-red-50/60' : row._warnings.length ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2.5">
                          {!row._ok
                            ? <span className="text-red-600 font-medium flex items-center gap-1">
                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Skip
                              </span>
                            : row._warnings.length
                              ? <span className="text-amber-600 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>Warn
                                </span>
                              : <span className="text-emerald-600 font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>OK
                                </span>}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{row.customer || <span className="text-red-400 italic">missing</span>}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.product || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.supplier || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.currency}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.quote_price || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.purchase_price || '—'}</td>
                        <td className="px-3 py-2.5">
                          {[...row._errors, ...row._warnings].map((m, j) => (
                            <p key={j} className={row._errors.includes(m) ? 'text-red-500' : 'text-amber-600'}>{m}</p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-4 border-t border-gray-100 shrink-0 space-y-3">
          {importError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <span className="font-semibold">Import failed: </span>{importError}
            </div>
          )}
          <div className="flex gap-3">
            {step === 'map' && (
              <>
                <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                <button onClick={() => { setPreview(buildPreview()); setStep('preview') }} disabled={!mapping.customer}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition">
                  {!mapping.customer ? 'Map the Customer column first' : `Preview ${rawRows.length} rows →`}
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button onClick={() => { setStep('map'); setImportError('') }} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">← Back</button>
                <button onClick={onClose} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
                <button onClick={doImport} disabled={importing || okCount === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {importing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {importing ? 'Importing…' : okCount === 0 ? 'No valid rows' : `Import ${okCount} inquir${okCount !== 1 ? 'ies' : 'y'}`}
                </button>
              </>
            )}
            {(step === 'parsing' || step === 'error') && (
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section Divider ───────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-2">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ── Date Range Filter ─────────────────────────────────────────────────────────
function DateRangeFilter({ startDate, endDate, onApply, onClear }) {
  const [open, setOpen]   = useState(false)
  const [s, setS]         = useState(startDate || '')
  const [e, setE]         = useState(endDate   || '')
  const ref               = useRef(null)
  const active            = !!(startDate || endDate)

  useEffect(() => {
    function handler(ev) { if (ref.current && !ref.current.contains(ev.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function apply() { onApply(s, e); setOpen(false) }
  function clear()  { setS(''); setE(''); onClear(); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition
          ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Date
        {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-100 rounded-2xl shadow-xl z-[80] p-4 w-64">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter by Date Added</p>
          <div className="space-y-2.5 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" value={s} onChange={ev => setS(ev.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" value={e} onChange={ev => setE(ev.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={clear} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition">Clear</button>
            <button onClick={apply} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-medium transition">Apply</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline Status Dropdown ────────────────────────────────────────────────────
// ── Status portal dropdown (rendered into document.body to escape overflow) ────
function StatusPortalDropdown({ pos, currentStatus, onPick, onClose }) {
  const dropRef = useRef(null)

  useEffect(() => {
    function onMouseDown(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) onClose()
    }
    function onScroll() { onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  const OPTION_STYLE = {
    Active:   'text-emerald-700 hover:bg-emerald-50',
    Inactive: 'text-gray-500   hover:bg-gray-50',
    Lead:     'text-amber-700  hover:bg-amber-50',
    Prospect: 'text-blue-700   hover:bg-blue-50',
  }

  return createPortal(
    <div
      ref={dropRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
      className="bg-white border border-gray-100 rounded-xl shadow-2xl py-1 w-32"
    >
      {STATUSES.map(s => (
        <button
          key={s}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
          onClick={() => onPick(s)}
          className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 transition-colors ${OPTION_STYLE[s]} ${s === currentStatus ? 'font-bold' : ''}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
          {s}
          {s === currentStatus && <svg className="ml-auto w-3 h-3 opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
        </button>
      ))}
    </div>,
    document.body
  )
}

// ── Inline status badge with portal dropdown ──────────────────────────────────
function InlineStatusBadge({ inq, onStatusChange, currentUser, company }) {
  const [open, setOpen]     = useState(false)
  const [pos, setPos]       = useState({ top: 0, left: 0 })
  const [saving, setSaving] = useState(false)
  const [flash, setFlash]   = useState(false)
  const btnRef              = useRef(null)

  function handleOpen(e) {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const rect = btnRef.current.getBoundingClientRect()
    const dropH = STATUSES.length * 32 + 8
    const top   = rect.bottom + dropH > window.innerHeight ? rect.top - dropH : rect.bottom + 4
    setPos({ top, left: rect.left })
    setOpen(true)
  }

  async function handlePick(status) {
    setOpen(false)
    if (status === inq.status) return
    const oldStatus = inq.status
    setSaving(true)
    await supabase.from('inquiries').update({ status }).eq('id', inq.id)
    setSaving(false)
    setFlash(true)
    setTimeout(() => setFlash(false), 1200)
    onStatusChange(inq.id, status)
    logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'status_changed', recordId: inq.id, recordLabel: inq.customer, details: { from: oldStatus, to: status } })
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={saving}
        title="Click to change status"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-all
          ${flash ? 'ring-2 ring-emerald-400 scale-105' : ''}
          ${STATUS_STYLE[inq.status] || STATUS_STYLE.Inactive}`}
      >
        {saving
          ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          : flash
            ? <svg className="w-2.5 h-2.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[inq.status] || STATUS_DOT.Inactive}`} />}
        {inq.status}
        <svg className="w-2.5 h-2.5 opacity-40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <StatusPortalDropdown
          pos={pos}
          currentStatus={inq.status}
          onPick={handlePick}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// ── Report Modal ──────────────────────────────────────────────────────────────
const REPORT_TYPES = ['All Inquiries', 'By Customer', 'By Product', 'By Status', 'By Account Manager', 'By Date Range']
const REPORT_COLS  = [
  { label: 'Customer',       key: 'customer'        },
  { label: 'Acct Manager',   key: 'account_manager' },
  { label: 'Status',         key: 'status'          },
  { label: 'Date Added',     key: 'date_added'      },
  { label: 'Country',        key: 'sourcing_country'},
  { label: 'Product',        key: 'product'         },
  { label: 'NDC/MA',         key: 'ndc_ma_code'     },
  { label: 'Manufacturer',   key: 'manufacturer'    },
  { label: 'Qty',            key: 'quantity'        },
  { label: 'Currency',       key: 'currency'        },
  { label: 'Quote Price',    key: 'quote_price'     },
  { label: 'Purchase Price', key: 'purchase_price'  },
  { label: 'Supplier',       key: 'supplier'        },
  { label: 'Margin %',       key: '_margin'         },
]

function ReportModal({ inquiries, company, masterCustomers, masterProducts, users, onClose }) {
  const [reportType,  setReportType]  = useState('All Inquiries')
  const [filterValue, setFilterValue] = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,     setEndDate]     = useState('')
  const [format,      setFormat]      = useState('pdf')
  const [generating,  setGenerating]  = useState(false)

  useEffect(() => { setFilterValue('') }, [reportType])

  function getRows() {
    let rows = [...inquiries]
    if (reportType === 'By Customer'         && filterValue) rows = rows.filter(r => r.customer        === filterValue)
    if (reportType === 'By Product'          && filterValue) rows = rows.filter(r => r.product         === filterValue)
    if (reportType === 'By Status'           && filterValue) rows = rows.filter(r => r.status          === filterValue)
    if (reportType === 'By Account Manager'  && filterValue) rows = rows.filter(r => r.account_manager === filterValue)
    if (startDate) rows = rows.filter(r => r.date_added && r.date_added >= startDate)
    if (endDate)   rows = rows.filter(r => r.date_added && r.date_added <= endDate)
    return rows.map(r => ({
      ...r,
      _margin: calcMargin(r.quote_price, r.purchase_price) != null
        ? `${calcMargin(r.quote_price, r.purchase_price)}%` : '—',
      date_added: formatDate(r.date_added),
    }))
  }

  const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '-')
  const dateTag     = new Date().toISOString().split('T')[0]
  const typeTag     = reportType.replace(/\s+/g, '-')

  async function generate() {
    setGenerating(true)
    const rows = getRows()
    const headers = REPORT_COLS.map(c => c.label)
    const body    = rows.map(r => REPORT_COLS.map(c => {
      const v = r[c.key]
      return v != null && v !== '' ? String(v) : '—'
    }))

    if (format === 'excel') {
      const wsData = [headers, ...body]
      const ws     = XLSX.utils.aoa_to_sheet(wsData)
      // Bold headers + auto column widths
      const colWidths = headers.map((h, i) => ({
        wch: Math.max(h.length, ...body.map(row => (row[i] || '').length)) + 2
      }))
      ws['!cols'] = colWidths
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
        if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'F2F2F2' } } }
      }
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Inquiries')
      XLSX.writeFile(wb, `JRS-${safeCompany}-Inquiries-${typeTag}-${dateTag}.xlsx`)
    } else {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const titleY = 36
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(company, 40, titleY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Inquiries Report — ${reportType}`, 40, titleY + 14)
      doc.text(`Generated: ${new Date().toLocaleString()}  ·  ${rows.length} records`, 40, titleY + 26)
      doc.setTextColor(0)
      autoTable(doc, {
        head: [headers],
        body,
        startY: titleY + 40,
        styles: { fontSize: 7, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
      })
      doc.save(`JRS-${safeCompany}-Inquiries-${typeTag}-${dateTag}.pdf`)
    }
    setGenerating(false)
    onClose()
  }

  const filterOptions = {
    'By Customer':        masterCustomers.map(c => c.name),
    'By Product':         masterProducts.map(p => p.name),
    'By Status':          STATUSES,
    'By Account Manager': users.map(u => u.name),
  }
  const needsFilter = filterOptions[reportType]
  const previewCount = getRows().length

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Generate Report</h2>
            <p className="text-gray-400 text-xs mt-0.5">{company}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Report type */}
          <Field label="Report Type">
            <select className={inputCls(false)} value={reportType} onChange={e => setReportType(e.target.value)}>
              {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>

          {/* Dynamic filter */}
          {needsFilter && (
            <Field label="Filter Value">
              <select className={inputCls(false)} value={filterValue} onChange={e => setFilterValue(e.target.value)}>
                <option value="">— All —</option>
                {filterOptions[reportType].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Date (optional)">
              <input type="date" className={inputCls(false)} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Field>
            <Field label="To Date (optional)">
              <input type="date" className={inputCls(false)} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Field>
          </div>

          {/* Format */}
          <Field label="Format">
            <div className="flex gap-3">
              <button onClick={() => setFormat('pdf')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition flex items-center justify-center gap-1.5
                  ${format === 'pdf' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </button>
              <button onClick={() => setFormat('excel')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition flex items-center justify-center gap-1.5
                  ${format === 'excel' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
                </svg>
                Excel
              </button>
            </div>
          </Field>

          <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{previewCount}</span> records will be included
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5 pt-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={generate} disabled={generating || previewCount === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
            {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {generating ? 'Generating…' : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Inquiries Component ──────────────────────────────────────────────────
export default function Inquiries({ company, currentUser, prefillCustomer, onClearPrefill }) {
  const [inquiries, setInquiries]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [errors, setErrors]         = useState({})
  const [saving, setSaving]         = useState(false)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortField, setSortField]   = useState('created_at')
  const [sortDir, setSortDir]       = useState('desc')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [toast, setToast]           = useState(null)
  const [copyToast, setCopyToast]   = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dateStart, setDateStart]   = useState('')
  const [dateEnd, setDateEnd]       = useState('')
  const [showReport, setShowReport] = useState(false)
  const [showEstimate, setShowEstimate] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [quickAdd, setQuickAdd]     = useState(null) // { type: 'customer'|'vendor'|'product' }

  // Master data
  const [masterCustomers, setMasterCustomers] = useState([])
  const [masterProducts, setMasterProducts]   = useState([])
  const [masterVendors, setMasterVendors]     = useState([])
  const [users, setUsers]                     = useState([])

  const fileInputRef = useRef(null)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => { fetchAll() }, [company])

  async function fetchAll() {
    setLoading(true)
    const [inq, cust, prod, vend, usr] = await Promise.all([
      supabase.from('inquiries').select('*').eq('company', company).order('created_at', { ascending: false }),
      supabase.from('customers_master').select('*').eq('company', company).order('name'),
      supabase.from('products_master').select('*').eq('company', company).order('name'),
      supabase.from('vendors_master').select('*').eq('company', company).order('name'),
      supabase.from('users').select('id, name').order('name'),
    ])
    if (inq.error) {
      showToast(`Could not load inquiries: ${inq.error.message}`, 'error')
    }
    setInquiries(inq.data || [])
    setMasterCustomers(cust.data || [])
    setMasterProducts(prod.data || [])
    setMasterVendors(vend.data || [])
    setUsers(usr.data || [])
    setLoading(false)
  }

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])

  // ── Form helpers ───────────────────────────────────────────────────────────
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); setErrors({}) }

  function openAdd() {
    setEditing(null); setForm({ ...EMPTY_FORM, date_added: new Date().toISOString().split('T')[0] }); setErrors({}); setShowForm(true)
  }

  useEffect(() => {
    if (!prefillCustomer?.customer) return
    setEditing(null)
    setForm({ ...EMPTY_FORM, customer: prefillCustomer.customer, date_added: new Date().toISOString().split('T')[0] })
    setErrors({})
    setShowForm(true)
    onClearPrefill()
  }, [prefillCustomer])

  function openEdit(inq) {
    setEditing(inq)
    setForm({
      customer: inq.customer || '', account_manager: inq.account_manager || '',
      status: inq.status || 'Lead', date_added: inq.date_added || '',
      sourcing_country: inq.sourcing_country || '', product: inq.product || '',
      ndc_ma_code: inq.ndc_ma_code || '', manufacturer: inq.manufacturer || '',
      quantity: inq.quantity ?? '', currency: inq.currency || 'USD',
      quote_price: inq.quote_price ?? '', purchase_price: inq.purchase_price ?? '',
      supplier: inq.supplier || '',
    })
    setErrors({}); setShowForm(true)
  }

  function handleProductChange(productName) {
    const prod = masterProducts.find(p => p.name === productName)
    setForm(f => ({
      ...f,
      product: productName,
      ndc_ma_code:  prod?.ndc_ma_code  || f.ndc_ma_code,
      manufacturer: prod?.manufacturer || f.manufacturer,
    }))
  }

  function validate() {
    const e = {}
    if (!form.customer.trim()) e.customer = 'Customer is required'
    return e
  }

  async function saveInquiry() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const autoStatus = form.status === 'Lead' && parseFloat(form.quote_price) > 0
      ? 'Active' : form.status

    const payload = {
      ...form, company,
      status:         autoStatus,
      quantity:       form.quantity       || null,
      quote_price:    form.quote_price    || null,
      purchase_price: form.purchase_price || null,
    }
    let opError
    if (editing) {
      const { error } = await supabase.from('inquiries').update(payload).eq('id', editing.id)
      opError = error
    } else {
      const { error } = await supabase.from('inquiries').insert([payload])
      opError = error
    }
    setSaving(false)
    if (opError) {
      showToast(opError.message || 'Save failed — check Supabase table/RLS settings', 'error')
      return
    }
    if (editing) {
      logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'edited', recordId: editing.id, recordLabel: form.customer, details: { fields_changed: Object.keys(form).filter(k => String(form[k]) !== String(editing[k])) } })
    } else {
      logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'created', recordLabel: form.customer, details: { product: form.product, status: payload.status } })
    }
    showToast(editing ? 'Inquiry updated' : 'Inquiry added')
    closeForm()
    await fetchAll()
  }

  async function handleDelete() {
    const { error } = await supabase.from('inquiries').delete().eq('id', confirmDelete.id)
    if (error) { setConfirmDelete(null); showToast(error.message, 'error'); return }
    logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'deleted', recordId: confirmDelete.id, recordLabel: confirmDelete.customer })
    setConfirmDelete(null)
    showToast('Inquiry deleted')
    await fetchAll()
  }

  async function handleDeleteAll() {
    setShowDeleteAll(false)
    const count = inquiries.length
    const { error } = await supabase.from('inquiries').delete().eq('company', company)
    if (error) { showToast(error.message, 'error'); return }
    logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'deleted_all', details: { count } })
    showToast('All inquiries deleted')
    await fetchAll()
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const activeIds = filtered.filter(r => r.status === 'Active').map(r => r.id)
    if (activeIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(activeIds))
    }
  }

  async function copySelected() {
    const rows = filtered.filter(r => selectedIds.has(r.id) && r.status === 'Active')
    if (!rows.length) return
    await copyQuoteToClipboard(rows)
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2000)
    setSelectedIds(new Set())
  }

  // ── Quick-add callback ─────────────────────────────────────────────────────
  async function handleQuickAddSave(newEntry) {
    const { type } = quickAdd
    setQuickAdd(null)
    if (type === 'customer') {
      setMasterCustomers(prev => [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, customer: newEntry.name }))
    } else if (type === 'vendor') {
      setMasterVendors(prev => [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, supplier: newEntry.name }))
    } else if (type === 'product') {
      setMasterProducts(prev => [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, product: newEntry.name, ndc_ma_code: newEntry.ndc_ma_code || f.ndc_ma_code, manufacturer: newEntry.manufacturer || f.manufacturer }))
    }
  }

  // ── Escape to close form ───────────────────────────────────────────────────
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm && !quickAdd) closeForm() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [showForm, quickAdd])

  // ── Computed margin ────────────────────────────────────────────────────────
  const liveMargin = useMemo(() => calcMargin(form.quote_price, form.purchase_price), [form.quote_price, form.purchase_price])

  // ── Inline status update (no modal) ───────────────────────────────────────
  function handleInlineStatusChange(id, newStatus) {
    setInquiries(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = inquiries
    .filter(c => {
      const q = search.toLowerCase()
      const match = !q || c.customer?.toLowerCase().includes(q) || c.product?.toLowerCase().includes(q) || c.supplier?.toLowerCase().includes(q)
      const statusMatch = statusFilter === 'All' || c.status === statusFilter
      const dateMatch = (!dateStart || (c.date_added && c.date_added >= dateStart))
                     && (!dateEnd   || (c.date_added && c.date_added <= dateEnd))
      return match && statusMatch && dateMatch
    })
    .sort((a, b) => {
      const av = (a[sortField] ?? '').toString()
      const bv = (b[sortField] ?? '').toString()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  const stats = {
    total:    inquiries.length,
    active:   inquiries.filter(c => c.status === 'Active').length,
    leads:    inquiries.filter(c => c.status === 'Lead').length,
    prospects: inquiries.filter(c => c.status === 'Prospect').length,
  }

  const SORT_COLS = [
    { label: 'Customer',  field: 'customer'       },
    { label: 'Product',   field: 'product'        },
    { label: 'Supplier',  field: 'supplier'       },
    { label: 'Status',    field: 'status'         },
    { label: 'Acct Mgr',  field: 'account_manager'},
    { label: 'Quote',     field: 'quote_price'    },
    { label: 'Margin',    field: 'quote_price'    },  // derived
    { label: 'Date',      field: 'date_added'     },
  ]

  return (
    <div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <CopyToast show={copyToast} />

      {/* ── Floating selection action bar ── */}
      {selectedIds.size > 0 && (() => {
        const activeCount = filtered.filter(r => selectedIds.has(r.id) && r.status === 'Active').length
        return (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-white text-sm font-medium whitespace-nowrap">
              {selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            {activeCount > 0
              ? <span className="text-emerald-400 text-xs whitespace-nowrap">({activeCount} Active)</span>
              : <span className="text-amber-400 text-xs whitespace-nowrap">(no Active rows)</span>}
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={copySelected}
              disabled={activeCount === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-xl transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Quote Table{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            <button
              onClick={() => setShowEstimate(true)}
              disabled={activeCount === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-xl transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Generate Estimate{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-white/50 hover:text-white text-sm px-2 py-1.5 rounded-xl hover:bg-white/10 transition"
            >
              Clear
            </button>
          </div>
        )
      })()}

      {confirmDelete && (
        <DeleteModal item={confirmDelete} label="Inquiry" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}

      {showDeleteAll && (
        <DeleteAllModal
          currentUser={currentUser}
          count={inquiries.length}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAll(false)}
        />
      )}

      {importFile && (
        <ImportModal file={importFile} company={company} onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`Imported ${count} inquiries`); logActivity({ actor: currentUser, company, module: 'Inquiries', action: 'imported', details: { count } }); fetchAll() }} />
      )}

      {quickAdd && (
        <QuickAddModal type={quickAdd.type} company={company}
          onSave={handleQuickAddSave} onClose={() => setQuickAdd(null)} />
      )}

      {showReport && (
        <ReportModal
          inquiries={inquiries}
          company={company}
          masterCustomers={masterCustomers}
          masterProducts={masterProducts}
          users={users}
          onClose={() => setShowReport(false)}
        />
      )}

      {showEstimate && (
        <EstimateModal
          open={showEstimate}
          onClose={() => setShowEstimate(false)}
          selectedInquiries={filtered.filter(r => selectedIds.has(r.id) && r.status === 'Active')}
          currentUser={currentUser}
          company={company}
          masterCustomers={masterCustomers}
          masterProducts={masterProducts}
        />
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f); e.target.value = '' }} />

      <div className="space-y-6 p-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
            <p className="text-gray-400 text-sm mt-0.5">{company}</p>
          </div>
          <div className="flex items-center gap-2" style={{ paddingRight: 52 }}>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Excel / CSV
            </button>
            <button onClick={() => setShowReport(true)}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate Report
            </button>
            <button onClick={() => setShowDeleteAll(true)}
              className="flex items-center gap-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete All
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Inquiry
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Inquiries" value={stats.total}     accent="bg-blue-50 text-blue-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
          <StatCard label="Active"          value={stats.active}    accent="bg-emerald-50 text-emerald-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard label="Leads"           value={stats.leads}     accent="bg-amber-50 text-amber-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
          <StatCard label="Prospects"       value={stats.prospects} accent="bg-purple-50 text-purple-600"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>} />
        </div>

        {/* ── Search & Filter ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, product or supplier…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <DateRangeFilter
              startDate={dateStart}
              endDate={dateEnd}
              onApply={(s, e) => { setDateStart(s); setDateEnd(e) }}
              onClear={() => { setDateStart(''); setDateEnd('') }}
            />
            {['All', ...STATUSES].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-2.5 rounded-xl text-sm font-medium border transition
                  ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading inquiries…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="flex justify-center mb-3">
              {inquiries.length === 0
                ? <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                : <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
            </div>
            <p className="text-gray-800 font-medium">{inquiries.length === 0 ? 'No inquiries yet' : 'No results found'}</p>
            <p className="text-gray-400 text-sm mt-1">{inquiries.length === 0 ? 'Click "Add Inquiry" to get started.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            {/* row count */}
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium">
                {filtered.length} of {inquiries.length} inquir{inquiries.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>

            {/*
              Scroll container: overflow-x handles horizontal scroll for all the columns,
              overflow-y + max-height enables vertical scroll with sticky headers.
              borderCollapse:'separate' is required — 'collapse' breaks position:sticky.
            */}
            <div
              className="overflow-x-auto overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 26rem)' }}
            >
              <table
                className="text-sm"
                style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}
              >
                <thead>
                  <tr>
                    {/* ── Frozen Left: Customer header (select-all checkbox embedded) ── */}
                    <th
                      className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide select-none whitespace-nowrap border-b border-r border-gray-100 bg-gray-50"
                      style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                    >
                      <div className="flex items-center gap-2">
                        {(() => {
                          const activeFiltered = filtered.filter(r => r.status === 'Active')
                          const allSelected = activeFiltered.length > 0 && activeFiltered.every(r => selectedIds.has(r.id))
                          const someSelected = activeFiltered.some(r => selectedIds.has(r.id))
                          return activeFiltered.length > 0 ? (
                            <input
                              type="checkbox"
                              title="Select all Active"
                              className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer shrink-0"
                              checked={allSelected}
                              ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                              onChange={toggleSelectAll}
                            />
                          ) : null
                        })()}
                        <span className="cursor-pointer hover:text-blue-600" onClick={() => toggleSort('customer')}>
                          Customer <SortIcon field="customer" sortField={sortField} sortDir={sortDir} />
                        </span>
                      </div>
                    </th>

                    {/* ── Scrollable headers ── */}
                    {[
                      { label: 'Date Added',      field: 'date_added'       },
                      { label: 'Acct Manager',    field: 'account_manager'  },
                      { label: 'Country',         field: 'sourcing_country' },
                      { label: 'Product',         field: 'product'          },
                      { label: 'NDC / MA Code',   field: 'ndc_ma_code'      },
                      { label: 'Manufacturer',    field: 'manufacturer'     },
                      { label: 'Qty',             field: 'quantity'         },
                      { label: 'Cur',             field: 'currency'         },
                      { label: 'Quote Price',     field: 'quote_price'      },
                      { label: 'Purchase Price',  field: 'purchase_price'   },
                      { label: 'Supplier',        field: 'supplier'         },
                      { label: 'Margin %',        field: 'quote_price'      },
                    ].map(({ label, field }) => (
                      <th
                        key={label}
                        onClick={() => toggleSort(field)}
                        className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap border-b border-gray-100 bg-gray-50"
                        style={{ position: 'sticky', top: 0, zIndex: 10 }}
                      >
                        {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                      </th>
                    ))}

                    {/* ── Frozen Right: Status header ── */}
                    <th
                      onClick={() => toggleSort('status')}
                      className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap border-b border-l border-gray-100 bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 130, zIndex: 30 }}
                    >
                      Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                    </th>

                    {/* ── Frozen Right: Actions header ── */}
                    <th
                      className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-l border-gray-100 bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 0, zIndex: 30, width: 130, minWidth: 130, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(inq => {
                    const margin = calcMargin(inq.quote_price, inq.purchase_price)
                    const sym = CURRENCY_SYMBOL[inq.currency] || ''
                    return (
                      <tr
                        key={inq.id}
                        className={`group border-b border-gray-50 transition-colors ${selectedIds.has(inq.id) ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                      >
                        {/* ── Frozen Left: Customer cell (checkbox only for Active) ── */}
                        <td
                          className={`px-3 py-2 border-r border-gray-100 transition-colors ${selectedIds.has(inq.id) ? 'bg-blue-50' : 'bg-white group-hover:bg-blue-50'}`}
                          style={{ position: 'sticky', left: 0, zIndex: 20, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                        >
                          <div className="flex items-center gap-2 min-w-[140px]">
                            {inq.status === 'Active' && (
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer shrink-0"
                                checked={selectedIds.has(inq.id)}
                                onChange={() => toggleSelect(inq.id)}
                              />
                            )}
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                              {inq.customer?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-900 whitespace-nowrap">{inq.customer}</span>
                          </div>
                        </td>

                        {/* ── Scrollable data cells ── */}
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {formatDate(inq.date_added)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inq.account_manager || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inq.sourcing_country || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[150px]">
                          <span className="block truncate">{inq.product || <span className="text-gray-300">—</span>}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inq.ndc_ma_code || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inq.manufacturer || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-right whitespace-nowrap">
                          {inq.quantity != null ? inq.quantity : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {inq.currency || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-right whitespace-nowrap">
                          {inq.quote_price != null
                            ? `${sym}${Number(inq.quote_price).toLocaleString()}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-right whitespace-nowrap">
                          {inq.purchase_price != null
                            ? `${sym}${Number(inq.purchase_price).toLocaleString()}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inq.supplier || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {margin !== null
                            ? <span className={`font-bold ${parseFloat(margin) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{margin}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* ── Frozen Right: Status cell ── */}
                        <td
                          className={`px-3 py-2 border-l border-gray-100 transition-colors ${selectedIds.has(inq.id) ? 'bg-blue-50' : 'bg-white group-hover:bg-blue-50'}`}
                          style={{ position: 'sticky', right: 130, zIndex: 20 }}
                        >
                          <InlineStatusBadge inq={inq} onStatusChange={handleInlineStatusChange} currentUser={currentUser} company={company} />
                        </td>

                        {/* ── Frozen Right: Actions cell ── */}
                        <td
                          className={`px-3 py-2 border-l border-gray-100 transition-colors ${selectedIds.has(inq.id) ? 'bg-blue-50' : 'bg-white group-hover:bg-blue-50'}`}
                          style={{ position: 'sticky', right: 0, zIndex: 20, width: 130, minWidth: 130, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}
                        >
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <button
                              onClick={() => openEdit(inq)}
                              className="flex items-center gap-1 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDelete(inq)}
                              className="flex items-center gap-1 text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Inquiry' : 'New Inquiry'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">{company}</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">

                {/* ── Customer Info ── */}
                <SectionLabel>Customer Info</SectionLabel>

                <Field label="Customer *" error={errors.customer}>
                  <MasterSelect value={form.customer} err={!!errors.customer}
                    onChange={v => { setForm(f => ({ ...f, customer: v })); setErrors(e => ({ ...e, customer: '' })) }}
                    options={masterCustomers} placeholder="Select customer…" />
                </Field>

                <Field label="Account Manager">
                  <select className={inputCls(false)} value={form.account_manager}
                    onChange={e => setForm(f => ({ ...f, account_manager: e.target.value }))}>
                    <option value="">Select…</option>
                    {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </Field>

                <Field label="Status">
                  <select className={inputCls(false)} value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>

                <Field label="Date Added">
                  <input type="date" className={inputCls(false)} value={form.date_added}
                    onChange={e => setForm(f => ({ ...f, date_added: e.target.value }))} />
                </Field>

                <div className="col-span-2">
                  <Field label="Sourcing Country">
                    <select className={inputCls(false)} value={form.sourcing_country}
                      onChange={e => setForm(f => ({ ...f, sourcing_country: e.target.value }))}>
                      <option value="">Select country…</option>
                      {[
                        'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh',
                        'Belgium','Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia',
                        'Croatia','Czech Republic','Denmark','Egypt','Estonia','Ethiopia','Finland',
                        'France','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq',
                        'Ireland','Israel','Italy','Japan','Jordan','Kazakhstan','Kenya','Latvia',
                        'Lithuania','Malaysia','Mexico','Morocco','Myanmar','Netherlands','New Zealand',
                        'Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania',
                        'Russia','Saudi Arabia','Serbia','Singapore','Slovakia','Slovenia','South Africa',
                        'South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand',
                        'Turkey','Ukraine','United Arab Emirates','United Kingdom','United States',
                        'Venezuela','Vietnam','Other',
                      ].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>

                {/* ── Product Info ── */}
                <SectionLabel>Product Info</SectionLabel>

                <div className="col-span-2">
                  <Field label="Product">
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <MasterSelect value={form.product} err={false}
                          onChange={handleProductChange}
                          options={form.sourcing_country ? masterProducts.filter(p => p.country_of_origin === form.sourcing_country) : masterProducts}
                          placeholder={form.sourcing_country ? `Products from ${form.sourcing_country}…` : 'Select product…'} />
                      </div>
                      <button type="button" onClick={() => setQuickAdd({ type: 'product' })}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-medium transition whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New
                      </button>
                    </div>
                  </Field>
                </div>

                <Field label="NDC / MA Code">
                  <input className={inputCls(false)} value={form.ndc_ma_code} placeholder="Auto-filled from product"
                    onChange={e => setForm(f => ({ ...f, ndc_ma_code: e.target.value }))} />
                </Field>

                <Field label="Manufacturer">
                  <input className={inputCls(false)} value={form.manufacturer} placeholder="Auto-filled from product"
                    onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
                </Field>

                <div className="col-span-2">
                  <Field label="Quantity">
                    <input type="number" min="0" className={inputCls(false)} value={form.quantity} placeholder="0"
                      onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  </Field>
                </div>

                {/* ── Financial ── */}
                <SectionLabel>Financial</SectionLabel>

                <Field label="Currency">
                  <select className={inputCls(false)} value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="Quote Price">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{CURRENCY_SYMBOL[form.currency]}</span>
                    <input type="number" min="0" step="0.01"
                      className={`${inputCls(false)} pl-7`} value={form.quote_price} placeholder="0.00"
                      onChange={e => setForm(f => ({ ...f, quote_price: e.target.value }))} />
                  </div>
                </Field>

                <Field label="Purchase Price">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{CURRENCY_SYMBOL[form.currency]}</span>
                    <input type="number" min="0" step="0.01"
                      className={`${inputCls(false)} pl-7`} value={form.purchase_price} placeholder="0.00"
                      onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
                  </div>
                </Field>

                <Field label="Margin %">
                  <div className={`${inputCls(false)} bg-gray-50 cursor-not-allowed flex items-center justify-between`}>
                    {liveMargin !== null
                      ? <span className={`font-bold ${parseFloat(liveMargin) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{liveMargin}%</span>
                      : <span className="text-gray-400 text-xs">Auto-calculated</span>}
                  </div>
                </Field>

                {/* ── Supplier ── */}
                <SectionLabel>Supplier</SectionLabel>

                <div className="col-span-2">
                  <Field label="Supplier">
                    <MasterSelect value={form.supplier} err={false}
                      onChange={v => setForm(f => ({ ...f, supplier: v }))}
                      options={masterVendors} placeholder="Select supplier…" />
                  </Field>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 shrink-0">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveInquiry} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Update Inquiry' : 'Save Inquiry'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
