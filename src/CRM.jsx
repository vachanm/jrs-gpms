import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

const STATUSES = ['Active', 'Inactive', 'Lead', 'Prospect']
const EMPTY_FORM = { name: '', email: '', phone: '', company: '', status: 'Active', notes: '' }

const CRM_FIELDS = [
  { key: 'name',    label: 'Name'    },
  { key: 'email',   label: 'Email'   },
  { key: 'phone',   label: 'Phone'   },
  { key: 'company', label: 'Company' },
  { key: 'status',  label: 'Status'  },
  { key: 'notes',   label: 'Notes'   },
]

// Aliases used for auto-detecting column headers from any Excel/CSV
const FIELD_ALIASES = {
  name:    ['name', 'full name', 'customer name', 'client name', 'customer', 'client', 'contact', 'contact name'],
  email:   ['email', 'email address', 'e-mail', 'mail'],
  phone:   ['phone', 'phone number', 'mobile', 'mobile number', 'cell', 'telephone', 'tel'],
  company: ['company', 'company name', 'organization', 'organisation', 'firm', 'business'],
  status:  ['status', 'customer status', 'type', 'stage'],
  notes:   ['notes', 'note', 'comments', 'comment', 'remarks', 'description', 'additional info'],
}

const STATUS_STYLE = {
  Active:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Inactive: 'bg-gray-100   text-gray-500   border border-gray-200',
  Lead:     'bg-amber-50   text-amber-700   border border-amber-200',
  Prospect: 'bg-blue-50    text-blue-700    border border-blue-200',
}
const STATUS_DOT = {
  Active: 'bg-emerald-500', Inactive: 'bg-gray-400', Lead: 'bg-amber-500', Prospect: 'bg-blue-500',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function buildPreviewRows(rawRows, mapping) {
  return rawRows.map(row => {
    const data = {
      name:    String(row[mapping.name]    || '').trim(),
      email:   String(row[mapping.email]   || '').trim(),
      phone:   String(row[mapping.phone]   || '').trim(),
      company: String(row[mapping.company] || '').trim(),
      status:  String(row[mapping.status]  || '').trim(),
      notes:   String(row[mapping.notes]   || '').trim(),
    }
    const errors = [], warnings = []
    if (!data.name) errors.push('Name is required')
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) warnings.push('Invalid email format')
    if (data.status && !STATUSES.includes(data.status)) {
      warnings.push(`Unknown status "${data.status}" → defaulting to Active`)
      data.status = 'Active'
    } else if (!data.status) {
      data.status = 'Active'
    }
    return { ...data, _errors: errors, _warnings: warnings, _ok: errors.length === 0 }
  })
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
      <span className="text-base">{toast.type === 'success' ? '✓' : '✕'}</span>
      {toast.message}
    </div>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({ customer, onConfirm, onCancel }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
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
        <h3 className="text-lg font-bold text-center text-gray-900 mb-1">Delete Customer</h3>
        <p className="text-gray-500 text-sm text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-800">{customer?.name}</span>?
          <br />This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium transition">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }) {
  const active = sortField === field
  return (
    <span className="ml-1 inline-flex flex-col gap-[1px]">
      <svg className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16z" /></svg>
      <svg className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4z" /></svg>
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
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

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ file, onClose, onImported }) {
  const [step, setStep]       = useState('parsing')   // parsing | map | preview
  const [headers, setHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    async function parse() {
      try {
        const buf = await file.arrayBuffer()
        const wb  = XLSX.read(buf, { type: 'array' })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (json.length < 2) { setParseError('The file appears to be empty.'); setStep('error'); return }

        const rawHeaders = json[0].map(h => String(h).trim()).filter(Boolean)
        if (!rawHeaders.length) { setParseError('Could not read column headers from the first row.'); setStep('error'); return }

        const dataRows = json.slice(1)
          .map(row => {
            const obj = {}
            rawHeaders.forEach((h, i) => { obj[h] = String(row[i] ?? '').trim() })
            return obj
          })
          .filter(row => Object.values(row).some(v => v !== ''))

        if (!dataRows.length) { setParseError('No data rows found after the header row.'); setStep('error'); return }

        setHeaders(rawHeaders)
        setRawRows(dataRows)
        setMapping(autoDetectMapping(rawHeaders))
        setStep('map')
      } catch {
        setParseError('Could not read the file. Make sure it is a valid .xlsx or .csv file.')
        setStep('error')
      }
    }
    parse()
  }, [file])

  function goToPreview() {
    setPreview(buildPreviewRows(rawRows, mapping))
    setStep('preview')
  }

  async function doImport() {
    const toInsert = preview
      .filter(r => r._ok)
      .map(({ _errors, _warnings, _ok, ...rest }) => rest)
    setImporting(true)
    await supabase.from('customers').insert(toInsert)
    setImporting(false)
    onImported(toInsert.length)
  }

  const okCount   = preview.filter(r => r._ok).length
  const warnCount = preview.filter(r => r._ok && r._warnings.length > 0).length
  const errCount  = preview.filter(r => !r._ok).length

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import from Excel / CSV</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {step === 'map'     && `${rawRows.length} rows found in "${file.name}"`}
              {step === 'preview' && `Review rows before importing`}
              {step === 'parsing' && 'Reading your file…'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-xl">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Parsing */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-gray-400 text-sm">Reading file…</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-4xl mb-3">⚠️</p>
              <p className="font-semibold text-gray-800 mb-1">Could not read file</p>
              <p className="text-gray-400 text-sm max-w-xs">{parseError}</p>
            </div>
          )}

          {/* Step 1 — Column mapping */}
          {step === 'map' && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                We detected <strong>{rawRows.length}</strong> data rows. Map your file's columns to CRM fields below. Columns we couldn't auto-detect are marked.
              </div>

              <div className="grid grid-cols-2 gap-4">
                {CRM_FIELDS.map(({ key, label }) => {
                  const detected = mapping[key]
                  return (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                        {label}
                        {key === 'name' && <span className="text-red-500 ml-1">*</span>}
                        {detected
                          ? <span className="ml-2 text-emerald-600 font-normal normal-case">✓ auto-detected</span>
                          : <span className="ml-2 text-amber-500 font-normal normal-case">— not detected</span>}
                      </label>
                      <select
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        value={mapping[key] || ''}
                        onChange={e => setMapping({ ...mapping, [key]: e.target.value || undefined })}
                      >
                        <option value="">— skip this field —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>

              {/* Sample preview */}
              {rawRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">First row preview</p>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 font-mono space-y-1">
                    {CRM_FIELDS.map(({ key, label }) => mapping[key] && (
                      <div key={key} className="flex gap-2">
                        <span className="text-gray-400 w-16 shrink-0">{label}:</span>
                        <span className="text-gray-800">{rawRows[0][mapping[key]] || <span className="text-gray-300 italic">empty</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {okCount - warnCount} ready
                </span>
                {warnCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {warnCount} with warnings (will still import)
                  </span>
                )}
                {errCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {errCount} will be skipped
                  </span>
                )}
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Customer Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i} className={`${!row._ok ? 'bg-red-50/60' : row._warnings.length ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-3 py-2.5">
                          {!row._ok
                            ? <span className="inline-flex items-center gap-1 text-red-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Skip</span>
                            : row._warnings.length
                              ? <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Warn</span>
                              : <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />OK</span>
                          }
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.email || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500">{row.company || '—'}</td>
                        <td className="px-3 py-2.5">
                          {row.status && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[row.status] || STATUS_STYLE.Inactive}`}>
                              {row.status}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {[...row._errors, ...row._warnings].map((msg, j) => (
                            <p key={j} className={`${row._errors.includes(msg) ? 'text-red-500' : 'text-amber-600'}`}>{msg}</p>
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

        {/* Footer */}
        <div className="px-6 pb-5 pt-4 border-t border-gray-100 shrink-0 flex gap-3">
          {step === 'map' && (
            <>
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={goToPreview}
                disabled={!mapping.name}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition"
              >
                {!mapping.name ? 'Map the Name column to continue' : `Preview ${rawRows.length} rows →`}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('map')} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">← Back</button>
              <button onClick={onClose} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={doImport}
                disabled={importing || okCount === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {importing && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {importing ? 'Importing…' : okCount === 0 ? 'No valid rows to import' : `Import ${okCount} customer${okCount !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
          {(step === 'parsing' || step === 'error') && (
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Close</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main CRM ──────────────────────────────────────────────────────────────────
export default function CRM() {
  const [customers, setCustomers]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [errors, setErrors]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortField, setSortField]     = useState('created_at')
  const [sortDir, setSortDir]         = useState('desc')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast]             = useState(null)
  const [importFile, setImportFile]   = useState(null)

  const firstInputRef = useRef(null)
  const fileInputRef  = useRef(null)

  useEffect(() => { fetchCustomers() }, [])

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 60)
  }, [showForm])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape' && showForm) closeForm() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showForm])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])

  function closeForm() {
    setShowForm(false); setEditingCustomer(null); setForm(EMPTY_FORM); setErrors({})
  }

  function openAdd() {
    setEditingCustomer(null); setForm(EMPTY_FORM); setErrors({}); setShowForm(true)
  }

  function openEdit(c) {
    setEditingCustomer(c)
    setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '', company: c.company || '', status: c.status || 'Active', notes: c.notes || '' })
    setErrors({})
    setShowForm(true)
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address'
    if (form.phone && !/^[\d\s+\-()\/.]{6,20}$/.test(form.phone)) e.phone = 'Invalid phone number'
    return e
  }

  async function saveCustomer() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    if (editingCustomer) {
      await supabase.from('customers').update(form).eq('id', editingCustomer.id)
      showToast('Customer updated successfully')
    } else {
      await supabase.from('customers').insert([form])
      showToast('Customer added successfully')
    }
    setSaving(false)
    closeForm()
    fetchCustomers()
  }

  async function handleDelete() {
    await supabase.from('customers').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    showToast('Customer deleted')
    fetchCustomers()
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
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

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) setImportFile(file)
    e.target.value = ''
  }

  function handleImported(count) {
    setImportFile(null)
    showToast(`Successfully imported ${count} customer${count !== 1 ? 's' : ''}`)
    fetchCustomers()
  }

  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'All' || c.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      const av = (a[sortField] || '').toString()
      const bv = (b[sortField] || '').toString()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

  const stats = {
    total:    customers.length,
    active:   customers.filter(c => c.status === 'Active').length,
    leads:    customers.filter(c => c.status === 'Lead').length,
    prospects: customers.filter(c => c.status === 'Prospect').length,
  }

  const SORT_COLS = [
    { label: 'Name',    field: 'name'       },
    { label: 'Company', field: 'company'    },
    { label: 'Email',   field: 'email'      },
    { label: 'Phone',   field: 'phone'      },
    { label: 'Status',  field: 'status'     },
    { label: 'Added',   field: 'created_at' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {confirmDelete && (
        <DeleteModal customer={confirmDelete} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}

      {importFile && (
        <ImportModal file={importFile} onClose={() => setImportFile(null)} onImported={handleImported} />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
            <p className="text-gray-400 text-sm mt-0.5">Track and manage your customer relationships</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Excel / CSV
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Customer
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Customers" value={stats.total}     accent="bg-blue-50"    icon="👥" />
          <StatCard label="Active"          value={stats.active}    accent="bg-emerald-50" icon="✅" />
          <StatCard label="Leads"           value={stats.leads}     accent="bg-amber-50"   icon="🎯" />
          <StatCard label="Prospects"       value={stats.prospects} accent="bg-purple-50"  icon="🔍" />
        </div>

        {/* ── Search & filter bar ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, company or email…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            )}
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
            <p className="text-gray-400 text-sm">Loading customers…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <p className="text-4xl mb-3">{customers.length === 0 ? '👥' : '🔍'}</p>
            <p className="text-gray-800 font-medium">{customers.length === 0 ? 'No customers yet' : 'No results found'}</p>
            <p className="text-gray-400 text-sm mt-1">
              {customers.length === 0
                ? 'Click "Add Customer" or import from Excel to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium">
                {filtered.length} of {customers.length} customer{customers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {SORT_COLS.map(({ label, field }) => (
                      <th key={field} onClick={() => toggleSort(field)}
                        className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap">
                        {label}<SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                      </th>
                    ))}
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {c.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{c.company || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-gray-600">{c.email   || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-gray-600">{c.phone   || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[c.status] || STATUS_STYLE.Inactive}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status] || STATUS_DOT.Inactive}`} />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => openEdit(c)}
                            className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button onClick={() => setConfirmDelete(c)}
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
          </div>
        )}
      </div>

      {/* ── Add / Edit modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">{editingCustomer ? `Editing ${editingCustomer.name}` : 'Fill in the details below'}</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Full Name *" error={errors.name}>
                    <input ref={firstInputRef} className={inputCls(errors.name)} value={form.name}
                      onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }) }}
                      placeholder="e.g. Acme Corp" />
                  </Field>
                </div>
                <Field label="Email" error={errors.email}>
                  <input className={inputCls(errors.email)} value={form.email} type="email"
                    onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }) }}
                    placeholder="email@example.com" />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <input className={inputCls(errors.phone)} value={form.phone} type="tel"
                    onChange={e => { setForm({ ...form, phone: e.target.value }); setErrors({ ...errors, phone: '' }) }}
                    placeholder="+1 555 000 0000" />
                </Field>
                <Field label="Company">
                  <input className={inputCls(false)} value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                    placeholder="Company name" />
                </Field>
                <Field label="Status">
                  <select className={inputCls(false)} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="Notes">
                    <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Any additional notes…" />
                  </Field>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={closeForm} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={saveCustomer} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : editingCustomer ? 'Update Customer' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
