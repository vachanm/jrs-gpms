import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import { logActivity } from './auditLogger'
import { generateEstimatePDF } from './EstimateModal'

const STATUS_OPTIONS = ['Draft', 'Sent', 'Accepted', 'Rejected']

const STATUS_STYLES = {
  Draft:    'bg-gray-100 text-gray-600 border-gray-200',
  Sent:     'bg-blue-100 text-blue-700 border-blue-200',
  Accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-100 text-red-600 border-red-200',
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

function formatCurrency(amount, currency) {
  if (!amount && amount !== 0) return '—'
  return `${currency || 'USD'} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function applySortRows(rows, field, dir) {
  return [...rows].sort((a, b) => {
    const av = a[field] ?? ''
    const bv = b[field] ?? ''
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

export default function Estimates({ company, currentUser }) {
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [downloading, setDownloading]   = useState(null)
  const [deletingId, setDeletingId]     = useState(null)
  const [openStatusId, setOpenStatusId] = useState(null)
  const [statusDropPos, setStatusDropPos] = useState(null)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir]     = useState('desc')
  const statusBtnRefs = useRef({})

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  async function fetchEstimates() {
    setLoading(true)
    const { data } = await supabase
      .from('estimates')
      .select('*')
      .eq('company', company)
      .order('created_at', { ascending: false })
    setEstimates(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchEstimates() }, [company])

  async function handleDownload(est) {
    if (!est.estimate_data) return
    setDownloading(est.id)
    try {
      const data = typeof est.estimate_data === 'string'
        ? JSON.parse(est.estimate_data)
        : est.estimate_data
      await generateEstimatePDF(data)
    } catch (e) {
      console.error('PDF re-generation failed:', e)
    } finally {
      setDownloading(null)
    }
  }

  async function handleStatusChange(id, newStatus) {
    setOpenStatusId(null)
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
    await supabase.from('estimates').update({ status: newStatus }).eq('id', id)
    logActivity({ actor: currentUser, company, module: 'Estimates', action: 'status_changed', recordId: id, details: { to: newStatus } })
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this estimate? This cannot be undone.')) return
    setDeletingId(id)
    await supabase.from('estimates').delete().eq('id', id)
    setEstimates(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
    logActivity({ actor: currentUser, company, module: 'Estimates', action: 'deleted', recordId: id })
  }

  const filtered = applySortRows(
    estimates.filter(e => {
      const matchStatus = statusFilter === 'All' || e.status === statusFilter
      const q = search.toLowerCase()
      const matchSearch = !q ||
        (e.estimate_number || '').toLowerCase().includes(q) ||
        (e.customer_name  || '').toLowerCase().includes(q) ||
        (e.sales_rep      || '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    }),
    sortField, sortDir
  )

  const counts = {
    total:    estimates.length,
    draft:    estimates.filter(e => e.status === 'Draft').length,
    sent:     estimates.filter(e => e.status === 'Sent').length,
    accepted: estimates.filter(e => e.status === 'Accepted').length,
    rejected: estimates.filter(e => e.status === 'Rejected').length,
  }

  const statCards = [
    { label: 'Total',    value: counts.total,    color: '#1e3a8a', bg: '#eff6ff' },
    { label: 'Draft',    value: counts.draft,    color: '#374151', bg: '#f9fafb' },
    { label: 'Sent',     value: counts.sent,     color: '#1d4ed8', bg: '#dbeafe' },
    { label: 'Accepted', value: counts.accepted, color: '#065f46', bg: '#d1fae5' },
    { label: 'Rejected', value: counts.rejected, color: '#991b1b', bg: '#fee2e2' },
  ]

  return (
    <div className="p-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
        <p className="text-gray-500 text-sm mt-0.5">All generated estimates for {company}</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {statCards.map(card => (
          <div key={card.label} className="rounded-xl p-4 border border-gray-200 bg-white shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by estimate #, customer…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {['All', ...STATUS_OPTIONS].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={fetchEstimates}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition bg-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading estimates…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 text-sm">No estimates found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto rounded-2xl" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}
                    onClick={() => toggleSort('estimate_number')}>
                  Estimate # <SortIcon field="estimate_number" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}
                    onClick={() => toggleSort('created_at')}>
                  Date <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}
                    onClick={() => toggleSort('customer_name')}>
                  Customer <SortIcon field="customer_name" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}
                    onClick={() => toggleSort('sales_rep')}>
                  Sales Rep <SortIcon field="sales_rep" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}
                    onClick={() => toggleSort('total_amount')}>
                  Total <SortIcon field="total_amount" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}
                    onClick={() => toggleSort('status')}>
                  Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50"
                    style={{ position: 'sticky', top: 0, zIndex: 2 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((est, idx) => (
                <tr key={est.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30 transition`}>
                  <td className="px-5 py-3.5 font-semibold text-gray-800 font-mono text-xs">
                    {est.estimate_number}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{formatDate(est.date)}</td>
                  <td className="px-4 py-3.5 text-gray-700 font-medium">{est.customer_name || '—'}</td>
                  <td className="px-4 py-3.5 text-gray-600">{est.sales_rep || '—'}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                    {formatCurrency(est.total_amount, est.currency)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      ref={el => { statusBtnRefs.current[est.id] = el }}
                      onClick={() => {
                        if (openStatusId === est.id) {
                          setOpenStatusId(null)
                        } else {
                          const rect = statusBtnRefs.current[est.id]?.getBoundingClientRect()
                          setStatusDropPos(rect ? { top: rect.bottom + 4, left: rect.left + rect.width / 2 } : null)
                          setOpenStatusId(est.id)
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${STATUS_STYLES[est.status] || STATUS_STYLES.Draft}`}
                    >
                      {est.status || 'Draft'}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(est)}
                        disabled={downloading === est.id || !est.estimate_data}
                        title="Download PDF"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {downloading === est.id ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        PDF
                      </button>
                      <button
                        onClick={() => handleDelete(est.id)}
                        disabled={deletingId === est.id}
                        title="Delete"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Status dropdown portal */}
      {openStatusId && statusDropPos && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpenStatusId(null)} />
          <div
            style={{ position: 'fixed', top: statusDropPos.top, left: statusDropPos.left, transform: 'translateX(-50%)', zIndex: 1000 }}
            className="bg-white rounded-xl shadow-2xl border border-gray-100 py-1 w-32"
          >
            {STATUS_OPTIONS.map(s => {
              const est = estimates.find(e => e.id === openStatusId)
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(openStatusId, s)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition ${est?.status === s ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
