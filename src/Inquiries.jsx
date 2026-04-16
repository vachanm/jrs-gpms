import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES   = ['Active', 'Inactive', 'Lead', 'Prospect']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR']
const CURRENCY_SYMBOL = { USD: '$', EUR: '€', GBP: '£', INR: '₹' }

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
      <span>{toast.type === 'success' ? '✓' : '✕'}</span>
      {toast.message}
    </div>
  )
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

// ── Sort Icon ─────────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }) {
  const active = sortField === field
  return (
    <span className="ml-1 inline-flex flex-col gap-[1px]">
      <svg className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16z" /></svg>
      <svg className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4z" /></svg>
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
function MasterSelect({ value, onChange, options, placeholder, onAddNew, addLabel, err }) {
  return (
    <select
      className={inputCls(err)}
      value={value}
      onChange={e => {
        if (e.target.value === '__ADD_NEW__') { onChange(value); onAddNew() }
        else onChange(e.target.value)
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.name}>{opt.name}</option>
      ))}
      <option value="__ADD_NEW__">＋ {addLabel}</option>
    </select>
  )
}

// ── Quick Add Modal (add to master tables on the fly) ─────────────────────────
function QuickAddModal({ type, company, onSave, onClose }) {
  const [name, setName]         = useState('')
  const [ndcCode, setNdcCode]   = useState('')
  const [mfr, setMfr]           = useState('')
  const [saving, setSaving]     = useState(false)

  const config = {
    customer: { table: 'customers_master', label: 'Customer',  icon: '👥' },
    vendor:   { table: 'vendors_master',   label: 'Vendor',    icon: '🏭' },
    product:  { table: 'products_master',  label: 'Product',   icon: '💊' },
  }[type]

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const row = { name: name.trim(), company }
    if (type === 'product') { row.ndc_ma_code = ndcCode.trim(); row.manufacturer = mfr.trim() }
    const { data } = await supabase.from(config.table).insert([row]).select().single()
    setSaving(false)
    onSave(data)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-base">{config.icon} Add New {config.label}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-xl">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label={`${config.label} Name *`}>
            <input autoFocus className={inputCls(false)} value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder={`Enter ${config.label.toLowerCase()} name`} />
          </Field>
          {type === 'product' && (
            <>
              <Field label="NDC / MA Code">
                <input className={inputCls(false)} value={ndcCode} onChange={e => setNdcCode(e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Manufacturer">
                <input className={inputCls(false)} value={mfr} onChange={e => setMfr(e.target.value)} placeholder="Optional" />
              </Field>
            </>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()}
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
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-xl">×</button>
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
              <p className="text-4xl mb-3">⚠️</p>
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
                        ? <span className="ml-2 text-emerald-600 font-normal normal-case">✓ auto-detected</span>
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
                            ? <span className="text-red-600 font-medium">✕ Skip</span>
                            : row._warnings.length
                              ? <span className="text-amber-600 font-medium">⚠ Warn</span>
                              : <span className="text-emerald-600 font-medium">✓ OK</span>}
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

// ── Main Inquiries Component ──────────────────────────────────────────────────
export default function Inquiries({ company, currentUser }) {
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
  const [toast, setToast]           = useState(null)
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
    const payload = {
      ...form, company,
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
    showToast(editing ? 'Inquiry updated' : 'Inquiry added')
    closeForm()
    await fetchAll()
  }

  async function handleDelete() {
    const { error } = await supabase.from('inquiries').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Inquiry deleted')
    await fetchAll()
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
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

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = inquiries
    .filter(c => {
      const q = search.toLowerCase()
      const match = !q || c.customer?.toLowerCase().includes(q) || c.product?.toLowerCase().includes(q) || c.supplier?.toLowerCase().includes(q)
      return match && (statusFilter === 'All' || c.status === statusFilter)
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
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {confirmDelete && (
        <DeleteModal item={confirmDelete} label="Inquiry" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}

      {importFile && (
        <ImportModal file={importFile} company={company} onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`Imported ${count} inquiries`); fetchAll() }} />
      )}

      {quickAdd && (
        <QuickAddModal type={quickAdd.type} company={company}
          onSave={handleQuickAddSave} onClose={() => setQuickAdd(null)} />
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f); e.target.value = '' }} />

      <div className="max-w-screen-xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
            <p className="text-gray-400 text-sm mt-0.5">{company}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Excel / CSV
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
          <StatCard label="Total Inquiries" value={stats.total}     accent="bg-blue-50"    icon="📋" />
          <StatCard label="Active"          value={stats.active}    accent="bg-emerald-50" icon="✅" />
          <StatCard label="Leads"           value={stats.leads}     accent="bg-amber-50"   icon="🎯" />
          <StatCard label="Prospects"       value={stats.prospects} accent="bg-purple-50"  icon="🔍" />
        </div>

        {/* ── Search & Filter ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, product or supplier…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>}
          </div>
          <div className="flex gap-2 flex-wrap">
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
            <p className="text-4xl mb-3">{inquiries.length === 0 ? '📋' : '🔍'}</p>
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
                className="text-xs"
                style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}
              >
                <thead>
                  <tr>
                    {/* ── Frozen Left: Customer header ── */}
                    <th
                      onClick={() => toggleSort('customer')}
                      className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap border-b border-r border-gray-100 bg-gray-50"
                      style={{ position: 'sticky', top: 0, left: 0, zIndex: 30, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                    >
                      Customer <SortIcon field="customer" sortField={sortField} sortDir={sortDir} />
                    </th>

                    {/* ── Scrollable headers ── */}
                    {[
                      { label: 'Acct Manager',    field: 'account_manager'  },
                      { label: 'Status',          field: 'status'           },
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
                      { label: 'Date Added',      field: 'date_added'       },
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

                    {/* ── Frozen Right: Actions header ── */}
                    <th
                      className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-l border-gray-100 bg-gray-50"
                      style={{ position: 'sticky', top: 0, right: 0, zIndex: 30, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}
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
                        className="group border-b border-gray-50 hover:bg-blue-50 transition-colors"
                      >
                        {/* ── Frozen Left: Customer cell ── */}
                        <td
                          className="px-3 py-2 bg-white group-hover:bg-blue-50 border-r border-gray-100 transition-colors"
                          style={{ position: 'sticky', left: 0, zIndex: 20, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                        >
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                              {inq.customer?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-900 whitespace-nowrap">{inq.customer}</span>
                          </div>
                        </td>

                        {/* ── Scrollable data cells ── */}
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {inq.account_manager || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[inq.status] || STATUS_STYLE.Inactive}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inq.status] || STATUS_DOT.Inactive}`} />
                            {inq.status}
                          </span>
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
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {formatDate(inq.date_added)}
                        </td>

                        {/* ── Frozen Right: Actions cell ── */}
                        <td
                          className="px-3 py-2 bg-white group-hover:bg-blue-50 border-l border-gray-100 transition-colors"
                          style={{ position: 'sticky', right: 0, zIndex: 20, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}
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
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-xl">×</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">

                {/* ── Customer Info ── */}
                <SectionLabel>Customer Info</SectionLabel>

                <Field label="Customer *" error={errors.customer}>
                  <MasterSelect value={form.customer} err={!!errors.customer}
                    onChange={v => { setForm(f => ({ ...f, customer: v })); setErrors(e => ({ ...e, customer: '' })) }}
                    options={masterCustomers} placeholder="Select customer…"
                    onAddNew={() => setQuickAdd({ type: 'customer' })} addLabel="Add New Customer" />
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
                    <input className={inputCls(false)} value={form.sourcing_country} placeholder="e.g. India, Germany…"
                      onChange={e => setForm(f => ({ ...f, sourcing_country: e.target.value }))} />
                  </Field>
                </div>

                {/* ── Product Info ── */}
                <SectionLabel>Product Info</SectionLabel>

                <div className="col-span-2">
                  <Field label="Product">
                    <MasterSelect value={form.product} err={false}
                      onChange={handleProductChange}
                      options={masterProducts} placeholder="Select product…"
                      onAddNew={() => setQuickAdd({ type: 'product' })} addLabel="Add New Product" />
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
                      options={masterVendors} placeholder="Select supplier…"
                      onAddNew={() => setQuickAdd({ type: 'vendor' })} addLabel="Add New Vendor" />
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
