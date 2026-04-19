import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
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
      { label: 'Supplier Name', key: 'name', sortable: 'name' },
      { label: 'Added', key: 'created_at', format: 'date', sortable: 'created_at' },
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
      { label: 'Product Name',  key: 'name',        sortable: 'name' },
      { label: 'NDC / MA Code', key: 'ndc_ma_code' },
      { label: 'Manufacturer',  key: 'manufacturer' },
      { label: 'Added',         key: 'created_at',  format: 'date', sortable: 'created_at' },
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
      { label: 'Storage Name', key: 'name',       sortable: 'name' },
      { label: 'Location',     key: 'location' },
      { label: 'Added',        key: 'created_at', format: 'date', sortable: 'created_at' },
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

function applySortRows(rows, field, dir) {
  return [...rows].sort((a, b) => {
    const av = a[field] ?? ''
    const bv = b[field] ?? ''
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

function SortIcon({ field, sortField, sortDir }) {
  const active = sortField === field
  return (
    <span className="ml-1 inline-flex flex-col gap-[1px] align-middle">
      <svg className={`w-3 h-3 ${active && sortDir === 'asc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16z" /></svg>
      <svg className={`w-3 h-3 ${active && sortDir === 'desc' ? 'text-blue-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4z" /></svg>
    </span>
  )
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

// ── Code generators ───────────────────────────────────────────────────────────
async function generateCustomerCode(company) {
  const { data } = await supabase.from('customers_master').select('customer_code').eq('company', company)
  const nums = (data || []).map(r => r.customer_code).filter(c => c && /^CUS-\d+$/.test(c)).map(c => parseInt(c.replace('CUS-', ''), 10))
  return `CUS-${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, '0')}`
}

async function generateProductCode(company) {
  const { data } = await supabase.from('products_master').select('product_code').eq('company', company)
  const nums = (data || []).map(r => r.product_code).filter(c => c && /^PRD-\d+$/.test(c)).map(c => parseInt(c.replace('PRD-', ''), 10))
  return `PRD-${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, '0')}`
}

// ── Approval Badge (inline dropdown) ─────────────────────────────────────────
function ApprovalBadge({ entry, onToggle }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const fn = e => {
      if (
        ref.current && !ref.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  function handleOpen() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(v => !v)
  }

  async function select(val) {
    setOpen(false)
    if (val === entry.is_approved) return
    setLoading(true)
    await onToggle(entry.id, val)
    setLoading(false)
  }

  const approved = entry.is_approved

  return (
    <div ref={ref} style={{ display: 'inline-block' }}>
      <button
        onClick={handleOpen}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer select-none transition
          ${approved ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'}`}
      >
        {loading
          ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          : <span className={`w-1.5 h-1.5 rounded-full ${approved ? 'bg-emerald-500' : 'bg-amber-500'}`} />}
        {approved ? 'Approved' : 'Unapproved'}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 140,
            overflow: 'hidden',
          }}
        >
          {[
            { val: true,  label: 'Approved',   cls: 'text-emerald-700 bg-emerald-50', dot: 'bg-emerald-500' },
            { val: false, label: 'Unapproved', cls: 'text-amber-700 bg-amber-50',   dot: 'bg-amber-500'   },
          ].map(({ val, label, cls, dot }) => (
            <button
              key={String(val)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(val)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition hover:opacity-80 ${val === approved ? cls : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${val === approved ? dot : 'bg-gray-300'}`} />
              {label}
              {val === approved && (
                <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Customer Section ──────────────────────────────────────────────────────────
const EMPTY_CUSTOMER = {
  name: '',
  customer_code: '',
  bill_to_address: '',
  ship_to_address: '',
  country: '', state: '', postal_code: '',
  website: '',
  contact1_name: '', contact1_email: '', contact1_phone: '',
  contact2_name: '', contact2_email: '', contact2_phone: '',
  contact3_name: '', contact3_email: '', contact3_phone: '',
  is_approved: false,
  approved_date: '',
  remarks: '',
}

// ── Master Import Config ──────────────────────────────────────────────────────
const MASTER_IMPORT_CONFIG = {
  customers_master: {
    label: 'Customer', codeField: 'customer_code', codePrefix: 'CUS',
    fields: [
      { key: 'name',            label: 'Name',             required: true,  aliases: ['name', 'customer name', 'company name', 'customer'] },
      { key: 'bill_to_address', label: 'Bill To Address',  required: false, aliases: ['bill to address', 'billing address', 'bill to', 'bill address'] },
      { key: 'ship_to_address', label: 'Ship To Address',  required: false, aliases: ['ship to address', 'shipping address', 'ship to', 'ship address'] },
      { key: 'country',         label: 'Country',          required: false, aliases: ['country'] },
      { key: 'state',           label: 'State',            required: false, aliases: ['state', 'province'] },
      { key: 'postal_code',     label: 'Postal Code',      required: false, aliases: ['postal code', 'zip', 'postcode', 'zip code'] },
      { key: 'website',         label: 'Website',          required: false, aliases: ['website', 'web', 'url'] },
      { key: 'contact1_name',   label: 'Contact 1 Name',   required: false, aliases: ['contact 1 name', 'contact name', 'primary contact'] },
      { key: 'contact1_email',  label: 'Contact 1 Email',  required: false, aliases: ['contact 1 email', 'email', 'contact email', 'primary email'] },
      { key: 'contact1_phone',  label: 'Contact 1 Phone',  required: false, aliases: ['contact 1 phone', 'phone', 'contact phone', 'primary phone'] },
      { key: 'contact2_name',   label: 'Contact 2 Name',   required: false, aliases: ['contact 2 name', 'secondary contact'] },
      { key: 'contact2_email',  label: 'Contact 2 Email',  required: false, aliases: ['contact 2 email', 'secondary email'] },
      { key: 'contact2_phone',  label: 'Contact 2 Phone',  required: false, aliases: ['contact 2 phone', 'secondary phone'] },
      { key: 'contact3_name',   label: 'Contact 3 Name',   required: false, aliases: ['contact 3 name'] },
      { key: 'contact3_email',  label: 'Contact 3 Email',  required: false, aliases: ['contact 3 email'] },
      { key: 'contact3_phone',  label: 'Contact 3 Phone',  required: false, aliases: ['contact 3 phone'] },
      { key: 'approved_date',   label: 'Approved Date',    required: false, aliases: ['approved date', 'approval date'] },
      { key: 'remarks',         label: 'Remarks',          required: false, aliases: ['remarks', 'notes', 'comments'] },
    ],
  },
  vendors_master: {
    label: 'Supplier', codeField: null,
    fields: [
      { key: 'name',           label: 'Name',             required: true,  aliases: ['name', 'supplier name', 'vendor name', 'vendor', 'supplier'] },
      { key: 'address1',       label: 'Address 1',        required: false, aliases: ['address 1', 'address', 'addr 1', 'addr1'] },
      { key: 'address2',       label: 'Address 2',        required: false, aliases: ['address 2', 'addr 2', 'addr2'] },
      { key: 'country',        label: 'Country',          required: false, aliases: ['country'] },
      { key: 'state',          label: 'State',            required: false, aliases: ['state', 'province'] },
      { key: 'postal_code',    label: 'Postal Code',      required: false, aliases: ['postal code', 'zip', 'postcode'] },
      { key: 'website',        label: 'Website',          required: false, aliases: ['website', 'web', 'url'] },
      { key: 'contact1_name',  label: 'Contact 1 Name',   required: false, aliases: ['contact 1 name', 'contact name', 'primary contact'] },
      { key: 'contact1_email', label: 'Contact 1 Email',  required: false, aliases: ['contact 1 email', 'email', 'contact email'] },
      { key: 'contact1_phone', label: 'Contact 1 Phone',  required: false, aliases: ['contact 1 phone', 'phone', 'contact phone'] },
      { key: 'contact2_name',  label: 'Contact 2 Name',   required: false, aliases: ['contact 2 name', 'secondary contact'] },
      { key: 'contact2_email', label: 'Contact 2 Email',  required: false, aliases: ['contact 2 email', 'secondary email'] },
      { key: 'contact2_phone', label: 'Contact 2 Phone',  required: false, aliases: ['contact 2 phone', 'secondary phone'] },
      { key: 'contact3_name',  label: 'Contact 3 Name',   required: false, aliases: ['contact 3 name'] },
      { key: 'contact3_email', label: 'Contact 3 Email',  required: false, aliases: ['contact 3 email'] },
      { key: 'contact3_phone', label: 'Contact 3 Phone',  required: false, aliases: ['contact 3 phone'] },
      { key: 'approved_date',  label: 'Approved Date',    required: false, aliases: ['approved date', 'approval date'] },
      { key: 'valid_through',  label: 'Valid Through',    required: false, aliases: ['valid through', 'valid till', 'expiry', 'expiry date'] },
      { key: 'license_number', label: 'License Number',   required: false, aliases: ['license number', 'license no', 'licence no', 'licence number'] },
      { key: 'remarks',        label: 'Remarks',          required: false, aliases: ['remarks', 'notes'] },
    ],
  },
  products_master: {
    label: 'Product', codeField: 'product_code', codePrefix: 'PRD',
    fields: [
      { key: 'name',              label: 'Name',              required: true,  aliases: ['name', 'product name', 'item name', 'product', 'item'] },
      { key: 'pack_size',         label: 'Pack Size',         required: false, aliases: ['pack size', 'pack', 'packaging', 'size'] },
      { key: 'ndc_ma_code',       label: 'NDC / MA Code',     required: false, aliases: ['ndc ma code', 'ndc', 'ma code', 'ndc/ma', 'national code'] },
      { key: 'country_of_origin', label: 'Country of Origin', required: false, aliases: ['country of origin', 'origin', 'country', 'source country'] },
      { key: 'remarks',           label: 'Remarks',           required: false, aliases: ['remarks', 'notes'] },
    ],
  },
  storage_master: {
    label: 'Storage Location', codeField: null,
    fields: [
      { key: 'name',     label: 'Name',     required: true,  aliases: ['name', 'storage name', 'location name', 'storage'] },
      { key: 'location', label: 'Location', required: false, aliases: ['location', 'address', 'site'] },
    ],
  },
}

// ── Master Import Modal ───────────────────────────────────────────────────────
function MasterImportModal({ file, tableKey, company, onClose, onImported }) {
  const cfg = MASTER_IMPORT_CONFIG[tableKey]
  const [step, setStep]               = useState('parsing')
  const [headers, setHeaders]         = useState([])
  const [rawRows, setRawRows]         = useState([])
  const [mapping, setMapping]         = useState({})
  const [preview, setPreview]         = useState([])
  const [importing, setImporting]     = useState(false)
  const [parseError, setParseError]   = useState('')
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
        const lh = rawHeaders.map(h => h.toLowerCase().trim())
        const autoMap = {}
        cfg.fields.forEach(f => {
          for (const alias of f.aliases) {
            const idx = lh.indexOf(alias)
            if (idx !== -1) { autoMap[f.key] = rawHeaders[idx]; break }
          }
        })
        setHeaders(rawHeaders); setRawRows(dataRows); setMapping(autoMap); setStep('map')
      } catch { setParseError('Could not read file. Ensure it is a valid .xlsx or .csv.'); setStep('error') }
    }
    parse()
  }, [file])

  function toDateString(val) {
    if (!val) return null
    const n = Number(val)
    if (!isNaN(n) && n > 1000) {
      const d = new Date(Math.round((n - 25569) * 86400 * 1000))
      return d.toISOString().split('T')[0]
    }
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }

  const DATE_FIELDS = ['approved_date', 'valid_through']

  function buildPreview() {
    return rawRows.map(row => {
      const d = {}
      cfg.fields.forEach(f => { d[f.key] = String(row[mapping[f.key]] || '').trim() })
      const errors = []
      if (!d.name) errors.push('Name is required')
      return { ...d, _errors: errors, _ok: errors.length === 0 }
    })
  }

  async function doImport() {
    setImportError('')
    let toInsert = preview
      .filter(r => r._ok)
      .map(({ _errors, _ok, ...rest }) => {
        const row = { ...rest, company }
        DATE_FIELDS.forEach(f => { if (f in row) row[f] = toDateString(row[f]) || null })
        Object.keys(row).forEach(k => { if (row[k] === '') row[k] = null })
        return row
      })

    if (cfg.codeField) {
      const { data: existing } = await supabase.from(tableKey).select(cfg.codeField).eq('company', company)
      const rx = new RegExp(`^${cfg.codePrefix}-\\d+$`)
      const nums = (existing || []).map(r => r[cfg.codeField]).filter(c => c && rx.test(c)).map(c => parseInt(c.replace(`${cfg.codePrefix}-`, ''), 10))
      let next = nums.length > 0 ? Math.max(...nums) + 1 : 1
      toInsert = toInsert.map(row => ({ ...row, [cfg.codeField]: `${cfg.codePrefix}-${String(next++).padStart(3, '0')}` }))
    }

    setImporting(true)
    const { error } = await supabase.from(tableKey).insert(toInsert)
    setImporting(false)
    if (error) { setImportError(error.message); return }
    onImported(toInsert.length)
  }

  const okCount  = preview.filter(r => r._ok).length
  const errCount = preview.filter(r => !r._ok).length
  const extraCols = cfg.fields.filter(f => f.key !== 'name').slice(0, 2)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import {cfg.label}s from Excel / CSV</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {step === 'map'     && `${rawRows.length} rows found — map your columns`}
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
              <svg className="w-12 h-12 text-amber-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="font-semibold text-gray-800 mb-1">Could not read file</p>
              <p className="text-gray-400 text-sm">{parseError}</p>
            </div>
          )}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                <strong>{rawRows.length}</strong> rows detected. Map your file's columns to {cfg.label} fields. Fields marked auto-detected were matched automatically.
              </div>
              <div className="grid grid-cols-2 gap-4">
                {cfg.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                      {f.label}
                      {f.required && <span className="text-red-500 ml-1">*</span>}
                      {mapping[f.key]
                        ? <span className="ml-2 text-emerald-600 font-normal normal-case inline-flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            auto-detected
                          </span>
                        : <span className="ml-2 text-amber-500 font-normal normal-case">— not detected</span>}
                    </label>
                    <select className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      value={mapping[f.key] || ''}
                      onChange={e => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
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
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{okCount} ready
                </span>
                {errCount > 0 && <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{errCount} will be skipped
                </span>}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Status', 'Name', ...extraCols.map(f => f.label), 'Issues'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i} className={!row._ok ? 'bg-red-50/60' : ''}>
                        <td className="px-3 py-2.5">
                          {!row._ok
                            ? <span className="text-red-600 font-medium flex items-center gap-1"><svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Skip</span>
                            : <span className="text-emerald-600 font-medium flex items-center gap-1"><svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>OK</span>}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-800">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                        {extraCols.map(f => <td key={f.key} className="px-3 py-2.5 text-gray-500">{row[f.key] || '—'}</td>)}
                        <td className="px-3 py-2.5">{row._errors.map((m, j) => <p key={j} className="text-red-500">{m}</p>)}</td>
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
                <button onClick={() => { setPreview(buildPreview()); setStep('preview') }} disabled={!mapping.name}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition">
                  {!mapping.name ? 'Map the Name column first' : `Preview ${rawRows.length} rows →`}
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
                  {importing ? 'Importing…' : okCount === 0 ? 'No valid rows' : `Import ${okCount} ${cfg.label}${okCount !== 1 ? 's' : ''}`}
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
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [sortField, setSortField]     = useState('created_at')
  const [sortDir, setSortDir]         = useState('desc')
  const [importFile, setImportFile]   = useState(null)
  const firstInputRef                 = useRef(null)
  const importFileRef                 = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

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
      .from('customers_master').select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_CUSTOMER); setErrors({}); setFreeTextState(false) }

  function openAdd() { setEditing(null); setForm(EMPTY_CUSTOMER); setErrors({}); setFreeTextState(false); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    const presets = STATES_BY_COUNTRY[entry.country] || []
    setFreeTextState(!!(entry.state && !presets.includes(entry.state)))
    const f = Object.fromEntries(Object.keys(EMPTY_CUSTOMER).map(k => [k, entry[k] ?? '']))
    f.is_approved = !!entry.is_approved
    setForm(f)
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
      if (!payload.customer_code) payload.customer_code = await generateCustomerCode(company)
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

  const filtered = applySortRows(
    entries.filter(e => {
      if (approvalFilter === 'approved' && !e.is_approved) return false
      if (approvalFilter === 'unapproved' && e.is_approved) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.name?.toLowerCase().includes(q) ||
        e.customer_code?.toLowerCase().includes(q) ||
        e.country?.toLowerCase().includes(q) ||
        e.state?.toLowerCase().includes(q) ||
        e.contact1_name?.toLowerCase().includes(q) ||
        e.contact1_email?.toLowerCase().includes(q)
      )
    }),
    sortField, sortDir
  )

  const hasPresetStates = !!(STATES_BY_COUNTRY[form.country]?.length)

  return (
    <div className="space-y-4">
      {importFile && (
        <MasterImportModal file={importFile} tableKey="customers_master" company={company}
          onClose={() => setImportFile(null)}
          onImported={count => { setImportFile(null); showToast(`${count} customer${count !== 1 ? 's' : ''} imported`); fetchEntries() }} />
      )}
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
        <div className="flex items-center gap-2">
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) { setImportFile(e.target.files[0]); e.target.value = '' } }} />
          <button onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Entry
          </button>
        </div>
      </div>

      {/* Approval filter + search */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0">
          {[['all','All'],['approved','Approved'],['unapproved','Unapproved']].map(([v,l]) => (
            <button key={v} onClick={() => setApprovalFilter(v)}
              className={`px-3.5 py-2 text-xs font-medium transition ${approvalFilter === v ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
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
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '1200px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 cursor-pointer select-none hover:text-gray-700"
                      style={{ position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                      onClick={() => toggleSort('name')}>
                    Customer Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {[
                    { label: 'Code',           field: 'customer_code' },
                    { label: 'Bill To Address',field: null },
                    { label: 'Ship To Address',field: null },
                    { label: 'Country',        field: 'country' },
                    { label: 'State',          field: null },
                    { label: 'Postal Code',    field: null },
                    { label: 'Website',        field: null },
                    { label: 'Contact 1 Name', field: null },
                    { label: 'Contact 1 Email',field: null },
                    { label: 'Contact 1 Phone',field: null },
                    { label: 'Contact 2 Name', field: null },
                    { label: 'Contact 2 Email',field: null },
                    { label: 'Contact 2 Phone',field: null },
                    { label: 'Contact 3 Name', field: null },
                    { label: 'Contact 3 Email',field: null },
                    { label: 'Contact 3 Phone',field: null },
                    { label: 'Approved Date',  field: 'approved_date' },
                    { label: 'Added',          field: 'created_at' },
                    { label: 'Remarks',        field: null },
                  ].map(({ label, field }) => (
                    <th key={label}
                      className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 ${field ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}
                      onClick={field ? () => toggleSort(field) : undefined}>
                      {label}{field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', right: 140, zIndex: 2, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.04)' }}>
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', right: 0, zIndex: 2, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-blue-50/30 transition group">
                    <td className="px-5 py-3.5 bg-white group-hover:bg-blue-50"
                        style={{ position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {entry.customer_code || <span className="text-gray-300 font-sans font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[180px]"><RemarksCell text={entry.bill_to_address} /></td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[180px]"><RemarksCell text={entry.ship_to_address} /></td>
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
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px]">
                      <RemarksCell text={entry.remarks} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap bg-white group-hover:bg-blue-50"
                        style={{ position: 'sticky', right: 140, zIndex: 1, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.04)' }}>
                      <ApprovalBadge entry={entry} onToggle={async (id, val) => {
                        await supabase.from('customers_master').update({ is_approved: val }).eq('id', id)
                        fetchEntries()
                      }} />
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
              {/* Customer Name + Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Customer Name *" error={errors.name}>
                    <input
                      ref={firstInputRef}
                      className={inputCls(!!errors.name)}
                      value={form.name}
                      placeholder="e.g. Pharma Corp Ltd"
                      onChange={e => setField('name', e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Customer Code">
                  <input className={`${inputCls(false)} bg-gray-50 text-gray-500 font-mono`}
                    value={editing ? (form.customer_code || '—') : 'Auto-generated'}
                    readOnly disabled />
                </Field>
              </div>

              {/* Approval status */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Approval Status</p>
                  <p className="text-xs text-gray-400 mt-0.5">Mark customer as approved for order processing</p>
                </div>
                <button type="button"
                  onClick={() => setField('is_approved', !form.is_approved)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_approved ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_approved ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bill To Address">
                  <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.bill_to_address}
                    placeholder="Full billing address"
                    onChange={e => setField('bill_to_address', e.target.value)} />
                </Field>
                <Field label="Ship To Address">
                  <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.ship_to_address}
                    placeholder="Full shipping address"
                    onChange={e => setField('ship_to_address', e.target.value)} />
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

// ── Supplier Section ──────────────────────────────────────────────────────────
const EMPTY_SUPPLIER = {
  name: '',
  address1: '', address2: '',
  country: '', state: '', postal_code: '',
  website: '',
  contact1_name: '', contact1_email: '', contact1_phone: '',
  contact2_name: '', contact2_email: '', contact2_phone: '',
  contact3_name: '', contact3_email: '', contact3_phone: '',
  approved_date: '', valid_through: '',
  license_number: '',
  remarks: '',
}

function SupplierSection({ company, showToast }) {
  const [entries, setEntries]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [editing, setEditing]             = useState(null)
  const [form, setForm]                   = useState(EMPTY_SUPPLIER)
  const [freeTextState, setFreeTextState] = useState(false)
  const [errors, setErrors]               = useState({})
  const [saving, setSaving]               = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]               = useState('')
  const [sortField, setSortField]         = useState('created_at')
  const [sortDir, setSortDir]             = useState('desc')
  const firstInputRef                     = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

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
      .from('vendors_master').select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_SUPPLIER); setErrors({}); setFreeTextState(false) }
  function openAdd()   { setEditing(null); setForm(EMPTY_SUPPLIER); setErrors({}); setFreeTextState(false); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    const presets = STATES_BY_COUNTRY[entry.country] || []
    setFreeTextState(!!(entry.state && !presets.includes(entry.state)))
    setForm(Object.fromEntries(Object.keys(EMPTY_SUPPLIER).map(k => [k, entry[k] || ''])))
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
    if (!form.name?.trim()) e.name = 'Supplier name is required'
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      const { error } = await supabase.from('vendors_master').update(payload).eq('id', editing.id)
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      showToast('Supplier updated')
    } else {
      const { error } = await supabase.from('vendors_master').insert([payload])
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      showToast('Supplier added')
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    await supabase.from('vendors_master').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = applySortRows(
    entries.filter(e => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.name?.toLowerCase().includes(q) ||
        e.country?.toLowerCase().includes(q) ||
        e.state?.toLowerCase().includes(q) ||
        e.contact1_name?.toLowerCase().includes(q) ||
        e.contact1_email?.toLowerCase().includes(q) ||
        e.license_number?.toLowerCase().includes(q)
      )
    }),
    sortField, sortDir
  )

  const hasPresetStates = !!(STATES_BY_COUNTRY[form.country]?.length)

  return (
    <div className="space-y-4">
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel="Supplier Master"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-purple-600 bg-purple-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Supplier Master</h2>
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
          placeholder="Search suppliers…"
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
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-purple-600 bg-purple-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? 'No suppliers yet' : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '1200px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 cursor-pointer select-none"
                      style={{ position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                      onClick={() => toggleSort('name')}>
                    Supplier Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {[
                    { label: 'Address 1',      field: null },
                    { label: 'Address 2',      field: null },
                    { label: 'Country',        field: 'country' },
                    { label: 'State',          field: null },
                    { label: 'Postal Code',    field: null },
                    { label: 'Website',        field: null },
                    { label: 'Contact 1 Name', field: null },
                    { label: 'Contact 1 Email',field: null },
                    { label: 'Contact 1 Phone',field: null },
                    { label: 'Contact 2 Name', field: null },
                    { label: 'Contact 2 Email',field: null },
                    { label: 'Contact 2 Phone',field: null },
                    { label: 'Contact 3 Name', field: null },
                    { label: 'Contact 3 Email',field: null },
                    { label: 'Contact 3 Phone',field: null },
                    { label: 'Approved Date',  field: 'approved_date' },
                    { label: 'Valid Through',  field: 'valid_through' },
                    { label: 'License No.',    field: null },
                    { label: 'Remarks',        field: null },
                    { label: 'Added',          field: 'created_at' },
                  ].map(({ label, field }) => (
                    <th key={label}
                        className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50${field ? ' cursor-pointer select-none' : ''}`}
                        onClick={field ? () => toggleSort(field) : undefined}>
                      {label}{field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', right: 0, zIndex: 2, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-purple-50/30 transition group">
                    <td className="px-5 py-3.5 bg-white group-hover:bg-purple-50/40"
                        style={{ position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
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
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.valid_through)}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{entry.license_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px]">
                      <RemarksCell text={entry.remarks} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap bg-white group-hover:bg-purple-50/40"
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
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Supplier Master</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Supplier Name */}
              <Field label="Supplier Name *" error={errors.name}>
                <input
                  ref={firstInputRef}
                  className={inputCls(!!errors.name)}
                  value={form.name}
                  placeholder="e.g. Global Supplies Inc"
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

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Approved Date">
                  <input type="date" className={inputCls(false)} value={form.approved_date}
                    onChange={e => setField('approved_date', e.target.value)} />
                </Field>
                <Field label="Valid Through">
                  <input type="date" className={inputCls(false)} value={form.valid_through}
                    onChange={e => setField('valid_through', e.target.value)} />
                </Field>
              </div>

              {/* License Number */}
              <Field label="License Number">
                <input className={inputCls(false)} value={form.license_number} placeholder="e.g. LIC-2024-00123"
                  onChange={e => setField('license_number', e.target.value)} />
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

// ── Product Section ───────────────────────────────────────────────────────────
const EMPTY_PRODUCT = {
  name: '',
  product_code: '',
  pack_size: '',
  ndc_ma_code: '',
  country_of_origin: '',
  remarks: '',
}

function ProductSection({ company, showToast }) {
  const [entries, setEntries]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(EMPTY_PRODUCT)
  const [errors, setErrors]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch]           = useState('')
  const [sortField, setSortField]     = useState('created_at')
  const [sortDir, setSortDir]         = useState('desc')
  const firstInputRef                 = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

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
      .from('products_master').select('*').eq('company', company).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY_PRODUCT); setErrors({}) }
  function openAdd()   { setEditing(null); setForm(EMPTY_PRODUCT); setErrors({}); setShowForm(true) }

  function openEdit(entry) {
    setEditing(entry)
    setForm(Object.fromEntries(Object.keys(EMPTY_PRODUCT).map(k => [k, entry[k] || ''])))
    setErrors({})
    setShowForm(true)
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.name?.trim()) e.name = 'Product name is required'
    return e
  }

  async function save() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = { ...form, company }
    if (editing) {
      const { error } = await supabase.from('products_master').update(payload).eq('id', editing.id)
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      showToast('Product updated')
    } else {
      if (!payload.product_code) payload.product_code = await generateProductCode(company)
      const { error } = await supabase.from('products_master').insert([payload])
      if (error) { showToast(error.message, 'error'); setSaving(false); return }
      showToast('Product added')
    }
    setSaving(false); closeForm(); fetchEntries()
  }

  async function handleDelete() {
    await supabase.from('products_master').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Entry deleted'); fetchEntries()
  }

  const filtered = applySortRows(
    entries.filter(e => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.name?.toLowerCase().includes(q) ||
        e.pack_size?.toLowerCase().includes(q) ||
        e.ndc_ma_code?.toLowerCase().includes(q) ||
        e.country_of_origin?.toLowerCase().includes(q)
      )
    }),
    sortField, sortDir
  )

  return (
    <div className="space-y-4">
      {confirmDelete && (
        <DeleteModal
          displayName={confirmDelete.name}
          masterLabel="Product Master"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-emerald-600 bg-emerald-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Product Master</h2>
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
          placeholder="Search products…"
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
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600 bg-emerald-50">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <p className="text-gray-800 font-medium">{entries.length === 0 ? 'No products yet' : 'No results found'}</p>
          <p className="text-gray-400 text-sm mt-1">{entries.length === 0 ? 'Click "Add Entry" to get started.' : 'Try adjusting your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 font-medium">{filtered.length} of {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '900px', width: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 cursor-pointer select-none"
                      style={{ position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}
                      onClick={() => toggleSort('name')}>
                    Product Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {[
                    { label: 'Code',              field: 'product_code' },
                    { label: 'Pack Size',          field: null },
                    { label: 'NDC / MA Code',      field: null },
                    { label: 'Country of Origin',  field: 'country_of_origin' },
                    { label: 'Remarks',            field: null },
                    { label: 'Added',              field: 'created_at' },
                  ].map(({ label, field }) => (
                    <th key={label}
                        className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50${field ? ' cursor-pointer select-none' : ''}`}
                        onClick={field ? () => toggleSort(field) : undefined}>
                      {label}{field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                    </th>
                  ))}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                      style={{ position: 'sticky', right: 0, zIndex: 2, boxShadow: '-2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-emerald-50/30 transition group">
                    <td className="px-5 py-3.5 bg-white group-hover:bg-emerald-50/40"
                        style={{ position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {entry.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{entry.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {entry.product_code || <span className="text-gray-300 font-sans font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.pack_size || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.ndc_ma_code || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{entry.country_of_origin || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs max-w-[160px]">
                      <RemarksCell text={entry.remarks} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap bg-white group-hover:bg-emerald-50/40"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Product' : 'New Product'}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Product Master</p>
              </div>
              <button onClick={closeForm} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Field label="Product Name *" error={errors.name}>
                    <input
                      ref={firstInputRef}
                      className={inputCls(!!errors.name)}
                      value={form.name}
                      placeholder="e.g. Paracetamol 500mg"
                      onChange={e => setField('name', e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Product Code">
                  <input className={`${inputCls(false)} bg-gray-50 text-gray-500 font-mono`}
                    value={editing ? (form.product_code || '—') : 'Auto-generated'}
                    readOnly disabled />
                </Field>
              </div>

              <Field label="Pack Size">
                <input className={inputCls(false)} value={form.pack_size} placeholder="e.g. 10×10 blister"
                  onChange={e => setField('pack_size', e.target.value)} />
              </Field>

              <Field label="NDC / MA Product Code">
                <input className={inputCls(false)} value={form.ndc_ma_code} placeholder="e.g. NDC 12345-678"
                  onChange={e => setField('ndc_ma_code', e.target.value)} />
              </Field>

              <Field label="Country of Origin">
                <select className={selectCls(false)} value={form.country_of_origin}
                  onChange={e => setField('country_of_origin', e.target.value)}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Remarks">
                <textarea className={`${inputCls(false)} resize-none`} rows={3} value={form.remarks}
                  placeholder="Any additional notes…"
                  onChange={e => setField('remarks', e.target.value)} />
              </Field>
            </div>

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
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir]     = useState('desc')
  const firstInputRef             = useRef(null)

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

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
    const { data } = await supabase.from(cfg.table).select('*').eq('company', company).order('created_at', { ascending: false })
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

  const filtered = applySortRows(
    entries.filter(e => {
      const q = search.toLowerCase()
      return !q || cfg.fields.some(f => e[f.key]?.toLowerCase().includes(q))
    }),
    sortField, sortDir
  )

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
                  <th key={col.key}
                      className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide${col.sortable ? ' cursor-pointer select-none' : ''}`}
                      onClick={col.sortable ? () => toggleSort(col.sortable) : undefined}>
                    {col.label}{col.sortable && <SortIcon field={col.sortable} sortField={sortField} sortDir={sortDir} />}
                  </th>
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
    <div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-6 space-y-6">

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
          : activeTab === 'vendors'
            ? <SupplierSection key="vendors" company={company} showToast={showToast} />
            : activeTab === 'products'
              ? <ProductSection key="products" company={company} showToast={showToast} />
              : <MasterSection key={activeTab} masterKey={activeTab} company={company} showToast={showToast} />
        }

      </div>
    </div>
  )
}
