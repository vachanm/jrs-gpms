import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { logActivity } from './auditLogger'

const ADMIN_USERS = ['Mahendra Sannappa', 'Pratik Shah', 'Sanket Patel', 'Sachin Shah']

const ACTION_LABELS = {
  created:                'Created',
  edited:                 'Edited',
  deleted:                'Deleted',
  deleted_all:            'Deleted All',
  imported:               'Imported',
  status_changed:         'Status Changed',
  login:                  'Logged In',
  logout:                 'Logged Out',
  submitted_for_approval: 'Submitted for Approval',
  generated_estimate:     'Generated Estimate',
  backup_created:         'Backup Downloaded',
}

const MODULE_COLORS = {
  'Inquiries':       'bg-blue-50 text-blue-700',
  'Customer Master': 'bg-purple-50 text-purple-700',
  'Vendors Master':  'bg-orange-50 text-orange-700',
  'Supplier Master': 'bg-orange-50 text-orange-700',
  'Products Master': 'bg-pink-50 text-pink-700',
  'Product Master':  'bg-pink-50 text-pink-700',
  'Storage Master':  'bg-yellow-50 text-yellow-700',
  'Estimates':       'bg-emerald-50 text-emerald-700',
  'Session':         'bg-gray-100 text-gray-600',
  'System':          'bg-teal-50 text-teal-700',
}

const ACTION_COLORS = {
  created:                'text-emerald-600',
  edited:                 'text-blue-600',
  deleted:                'text-red-500',
  deleted_all:            'text-red-600 font-semibold',
  imported:               'text-indigo-600',
  status_changed:         'text-amber-600',
  login:                  'text-gray-500',
  logout:                 'text-gray-500',
  submitted_for_approval: 'text-orange-600',
  generated_estimate:     'text-purple-600',
  backup_created:         'text-teal-600',
}

const PAGE_SIZE = 50

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
    const day = String(d.getDate()).padStart(2, '0')
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
    return `${day}/${mon}/${d.getFullYear()}`
  } catch { return iso }
}

function formatLogDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

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

function DetailModal({ request, onClose, onApprove, onReject }) {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleApprove() {
    setLoading(true)
    await onApprove(request)
    setLoading(false)
    onClose()
  }

  async function handleReject() {
    setLoading(true)
    await onReject(request)
    setLoading(false)
    onClose()
  }

  const fields = [
    ['Customer Name', request.name],
    ['Customer Code', request.customer_code],
    ['Country', request.country],
    ['State', request.state],
    ['Postal Code', request.postal_code],
    ['Website', request.website],
    ['Bill To Address', request.bill_to_address],
    ['Ship To Address', request.ship_to_address],
    ['Contact 1 Name', request.contact1_name],
    ['Contact 1 Email', request.contact1_email],
    ['Contact 1 Phone', request.contact1_phone],
    ['Contact 2 Name', request.contact2_name],
    ['Contact 2 Email', request.contact2_email],
    ['Remarks', request.remarks],
    ['Submitted By', request.submitted_by],
    ['Submitted On', formatDate(request.created_at)],
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Approval Request</h2>
            <p className="text-gray-400 text-xs mt-0.5">Customer Master — review before approving</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {fields.filter(([, val]) => val).map(([label, val]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm text-gray-800">{val}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Close</button>
          <button onClick={handleReject} disabled={loading}
            className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-xl text-sm font-medium transition">
            Reject
          </button>
          <button onClick={handleApprove} disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
            {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Processing…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Activity Log Tab ──────────────────────────────────────────────────────────
function ActivityLog() {
  const [logs, setLogs]               = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logPage, setLogPage]         = useState(1)
  const [totalLogs, setTotalLogs]     = useState(0)
  const [newActivityCount, setNewActivityCount] = useState(0)
  const [expandedLogId, setExpandedLogId]       = useState(null)
  const [refreshTick, setRefreshTick]           = useState(0)
  const [statsRefreshTick, setStatsRefreshTick] = useState(0)

  const [filterEmployee,  setFilterEmployee]  = useState('all')
  const [filterModule,    setFilterModule]    = useState('all')
  const [filterAction,    setFilterAction]    = useState('all')
  const [filterCompany,   setFilterCompany]   = useState('all')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd,   setFilterDateEnd]   = useState('')
  const [filterSearch,    setFilterSearch]    = useState('')
  const [employeeList,    setEmployeeList]    = useState([])
  const [logStats,        setLogStats]        = useState({ todayCount: 0, weekCount: 0, mostActiveEmployee: null, weekDeletions: 0 })

  // Load employee list once
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('users').select('name').order('name')
      setEmployeeList((data || []).map(u => u.name))
    }
    load()
  }, [])

  // Load stats (re-runs on statsRefreshTick)
  useEffect(() => {
    async function loadStats() {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - 7)
      const [{ data: todayLogs }, { data: weekLogs }] = await Promise.all([
        supabase.from('audit_logs').select('actor_name').gte('created_at', todayStart.toISOString()),
        supabase.from('audit_logs').select('actor_name, action').gte('created_at', weekStart.toISOString()),
      ])
      const todayCount    = todayLogs?.length || 0
      const weekCount     = weekLogs?.length  || 0
      const weekDeletions = weekLogs?.filter(l => l.action === 'deleted' || l.action === 'deleted_all').length || 0
      const freq = {}
      todayLogs?.forEach(l => { freq[l.actor_name] = (freq[l.actor_name] || 0) + 1 })
      const mostActive = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || null
      setLogStats({ todayCount, weekCount, mostActiveEmployee: mostActive, weekDeletions })
    }
    loadStats()
  }, [statsRefreshTick])

  // Load logs when any filter, page, or refreshTick changes
  useEffect(() => {
    async function loadLogs() {
      setLoadingLogs(true)
      let q = supabase.from('audit_logs').select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((logPage - 1) * PAGE_SIZE, logPage * PAGE_SIZE - 1)
      if (filterEmployee !== 'all') q = q.eq('actor_name', filterEmployee)
      if (filterModule   !== 'all') q = q.eq('module', filterModule)
      if (filterAction   !== 'all') q = q.eq('action', filterAction)
      if (filterCompany  !== 'all') q = q.eq('company', filterCompany)
      if (filterDateStart) q = q.gte('created_at', filterDateStart)
      if (filterDateEnd)   q = q.lte('created_at', filterDateEnd + 'T23:59:59')
      if (filterSearch)    q = q.or(`actor_name.ilike.%${filterSearch}%,record_label.ilike.%${filterSearch}%`)
      const { data, count } = await q
      setLogs(data || [])
      setTotalLogs(count || 0)
      setLoadingLogs(false)
    }
    loadLogs()
  }, [logPage, filterEmployee, filterModule, filterAction, filterCompany, filterDateStart, filterDateEnd, filterSearch, refreshTick])

  // Realtime subscription — setState calls are inside the .on() callback, not in the effect body
  useEffect(() => {
    const channel = supabase.channel('audit-logs-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, payload => {
        setLogPage(p => {
          if (p === 1) {
            setLogs(prev => [payload.new, ...prev.slice(0, PAGE_SIZE - 1)])
            setTotalLogs(t => t + 1)
          } else {
            setNewActivityCount(c => c + 1)
          }
          return p
        })
        setStatsRefreshTick(t => t + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function changeFilter(setter) {
    return (val) => { setter(val); setLogPage(1) }
  }

  function clearFilters() {
    setFilterEmployee('all'); setFilterModule('all'); setFilterAction('all')
    setFilterCompany('all'); setFilterDateStart(''); setFilterDateEnd(''); setFilterSearch('')
    setLogPage(1)
  }

  function handleNewActivityClick() {
    setNewActivityCount(0)
    setLogPage(1)
    setRefreshTick(t => t + 1)
  }

  function exportToExcel() {
    const rows = logs.map(l => ({
      Timestamp:  formatLogDate(l.created_at),
      Employee:   l.actor_name,
      Role:       l.actor_role,
      Company:    l.company,
      Module:     l.module,
      Action:     ACTION_LABELS[l.action] || l.action,
      Record:     l.record_label || '',
      Details:    JSON.stringify(l.details),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Log')
    XLSX.writeFile(wb, `activity-log-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function renderDetails(details) {
    if (!details || Object.keys(details).length === 0) return null
    const items = []
    if (details.fields_changed?.length) items.push(['Fields changed', details.fields_changed.join(', ')])
    if (details.from !== undefined && details.to !== undefined) items.push(['Status', `${details.from} → ${details.to}`])
    else if (details.to !== undefined) items.push(['New status', details.to])
    if (details.count !== undefined)          items.push(['Records', String(details.count)])
    if (details.company)                      items.push(['Company', details.company])
    if (details.inquiry_count !== undefined)  items.push(['Inquiries included', String(details.inquiry_count)])
    if (details.customer)                     items.push(['Customer', details.customer])
    if (details.product)                      items.push(['Product', details.product])
    if (details.status)                       items.push(['Status', details.status])
    const handled = new Set(['fields_changed','from','to','count','company','inquiry_count','customer','product','status'])
    Object.entries(details).forEach(([k, v]) => {
      if (!handled.has(k)) {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        items.push([label, String(v)])
      }
    })
    return items.length > 0 ? items : null
  }

  const totalPages = Math.ceil(totalLogs / PAGE_SIZE)
  const startRow   = totalLogs === 0 ? 0 : (logPage - 1) * PAGE_SIZE + 1
  const endRow     = Math.min(logPage * PAGE_SIZE, totalLogs)
  const { todayCount, weekCount, mostActiveEmployee, weekDeletions } = logStats

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Actions Today</p>
            <p className="text-xl font-bold text-gray-900">{todayCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Actions This Week</p>
            <p className="text-xl font-bold text-gray-900">{weekCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Most Active Today</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {mostActiveEmployee ? `${mostActiveEmployee[0]} (${mostActiveEmployee[1]})` : '—'}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${weekDeletions > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Deletions This Week</p>
            <p className={`text-xl font-bold ${weekDeletions > 0 ? 'text-red-500' : 'text-gray-900'}`}>{weekDeletions}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={filterSearch} onChange={e => changeFilter(setFilterSearch)(e.target.value)}
              placeholder="Search by employee or record…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <select value={filterEmployee} onChange={e => changeFilter(setFilterEmployee)(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">All Employees</option>
            {employeeList.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={filterModule} onChange={e => changeFilter(setFilterModule)(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">All Modules</option>
            {['Inquiries','Customer Master','Vendors Master','Products Master','Storage Master','Estimates','Session'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={filterAction} onChange={e => changeFilter(setFilterAction)(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-3 items-center">
          <select value={filterCompany} onChange={e => changeFilter(setFilterCompany)(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">All Companies</option>
            <option value="Jupiter Research Services Inc">Jupiter Research Services Inc</option>
            <option value="Jupiter Research Services BV">Jupiter Research Services BV</option>
            <option value="Jupiter Research Services India">Jupiter Research Services India</option>
          </select>
          <input type="date" value={filterDateStart} onChange={e => changeFilter(setFilterDateStart)(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <input type="date" value={filterDateEnd} onChange={e => changeFilter(setFilterDateEnd)(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <button onClick={clearFilters}
            className="border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-medium transition">
            Clear Filters
          </button>
          <div className="flex-1" />
          <button onClick={exportToExcel}
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {newActivityCount > 0 && (
          <div className="px-5 pt-4">
            <button onClick={handleNewActivityClick}
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-blue-700 transition">
              {newActivityCount} new activit{newActivityCount === 1 ? 'y' : 'ies'} — click to refresh
            </button>
          </div>
        )}

        {loadingLogs ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading activity log…</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-300 bg-gray-50">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-800 font-medium">No activity found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Timestamp', 'Employee', 'Module', 'Action', 'Record', 'Details'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                        style={{ position: 'sticky', top: 0, zIndex: 2 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.flatMap(log => {
                  const isExpanded = expandedLogId === log.id
                  const details    = renderDetails(log.details)
                  const rows = [
                    <tr key={log.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatLogDate(log.created_at)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{log.actor_name}</span>
                        <span className="bg-gray-100 text-gray-500 text-xs rounded-full px-2 py-0.5 ml-1">{log.actor_role}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${MODULE_COLORS[log.module] || 'bg-gray-100 text-gray-600'}`}>
                          {log.module}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 text-sm ${ACTION_COLORS[log.action] || 'text-gray-700'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs max-w-[180px] truncate" title={log.record_label || ''}>
                        {log.record_label || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {details && details.length > 0 ? (
                          <button onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-gray-400 hover:text-blue-600 transition p-1 rounded-lg hover:bg-blue-50">
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ]
                  if (isExpanded && details && details.length > 0) {
                    rows.push(
                      <tr key={`${log.id}-exp`} className="bg-blue-50/40 border-b border-blue-100">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="flex flex-wrap gap-4">
                            {details.map(([label, value]) => (
                              <span key={label} className="text-xs text-gray-600">
                                <span className="font-medium text-gray-800">{label}:</span> {value}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalLogs > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {startRow}–{endRow} of {totalLogs} records
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                className="border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl text-sm font-medium transition">
                Prev
              </button>
              <span className="text-sm text-gray-500">Page {logPage} of {totalPages || 1}</span>
              <button onClick={() => setLogPage(p => Math.min(totalPages, p + 1))} disabled={logPage >= totalPages}
                className="border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl text-sm font-medium transition">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BackupTab ─────────────────────────────────────────────────────────────────
function BackupTab({ company, currentUser }) {
  const [counts, setCounts]           = useState({ inquiries: 0, customers: 0, vendors: 0, products: 0, storage: 0, estimates: 0, audit_logs: 0 })
  const [loading, setLoading]         = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [lastBackup, setLastBackup]   = useState(() => localStorage.getItem(`jrs_last_backup_${company}`) || null)

  useEffect(() => {
    setLastBackup(localStorage.getItem(`jrs_last_backup_${company}`) || null)
    async function fetchCounts() {
      setLoading(true)
      const [inq, cust, vend, prod, stor, est, logs] = await Promise.all([
        supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('company', company),
        supabase.from('customers_master').select('*', { count: 'exact', head: true }).eq('company', company),
        supabase.from('vendors_master').select('*', { count: 'exact', head: true }).eq('company', company),
        supabase.from('products_master').select('*', { count: 'exact', head: true }).eq('company', company),
        supabase.from('storage_master').select('*', { count: 'exact', head: true }).eq('company', company),
        supabase.from('estimates').select('*', { count: 'exact', head: true }).eq('company', company),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
      ])
      setCounts({
        inquiries:  inq.count  || 0,
        customers:  cust.count || 0,
        vendors:    vend.count || 0,
        products:   prod.count || 0,
        storage:    stor.count || 0,
        estimates:  est.count  || 0,
        audit_logs: logs.count || 0,
      })
      setLoading(false)
    }
    fetchCounts()
  }, [company])

  async function handleDownload() {
    setDownloading(true)
    const [inq, cust, vend, prod, stor, est, logs] = await Promise.all([
      supabase.from('inquiries').select('*').eq('company', company),
      supabase.from('customers_master').select('*').eq('company', company),
      supabase.from('vendors_master').select('*').eq('company', company),
      supabase.from('products_master').select('*').eq('company', company),
      supabase.from('storage_master').select('*').eq('company', company),
      supabase.from('estimates').select('*').eq('company', company),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }),
    ])
    const wb = XLSX.utils.book_new()
    const sheets = [
      ['Inquiries',    inq.data],
      ['Customers',    cust.data],
      ['Vendors',      vend.data],
      ['Products',     prod.data],
      ['Storage',      stor.data],
      ['Estimates',    est.data],
      ['Activity Log', logs.data],
    ]
    for (const [name, rows] of sheets) {
      if (rows?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
    }
    const dateTag     = new Date().toISOString().split('T')[0]
    const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '-')
    XLSX.writeFile(wb, `JRS-Backup-${safeCompany}-${dateTag}.xlsx`)
    const now = new Date().toISOString()
    localStorage.setItem(`jrs_last_backup_${company}`, now)
    setLastBackup(now)
    logActivity({ actor: currentUser, company, module: 'System', action: 'backup_created', details: { tables: sheets.map(([n]) => n) } })
    setDownloading(false)
  }

  const tableCards = [
    { label: 'Inquiries',    key: 'inquiries',  color: 'bg-blue-50 text-blue-600' },
    { label: 'Customers',    key: 'customers',  color: 'bg-purple-50 text-purple-600' },
    { label: 'Vendors',      key: 'vendors',    color: 'bg-orange-50 text-orange-600' },
    { label: 'Products',     key: 'products',   color: 'bg-pink-50 text-pink-600' },
    { label: 'Storage',      key: 'storage',    color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Estimates',    key: 'estimates',  color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Activity Log', key: 'audit_logs', color: 'bg-teal-50 text-teal-600' },
  ]

  function formatLastBackup(iso) {
    if (!iso) return 'Never'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="space-y-5">
      {/* Info card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Data Backup</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Download a full snapshot of all data for <span className="font-medium text-gray-600">{company}</span> as a multi-sheet Excel file.
            </p>
          </div>
        </div>
      </div>

      {/* Record count cards */}
      <div className="grid grid-cols-4 gap-4">
        {tableCards.map(({ label, key, color }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 4v16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? <span className="inline-block w-6 h-4 bg-gray-100 rounded animate-pulse" /> : counts[key].toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Download section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Last backup</p>
          <p className="text-sm text-gray-400 mt-0.5">{formatLastBackup(lastBackup)}</p>
        </div>
        <button onClick={handleDownload} disabled={downloading || loading}
          className="flex items-center gap-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
          {downloading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
          {downloading ? 'Preparing…' : 'Download Backup (.xlsx)'}
        </button>
      </div>
    </div>
  )
}

// ── AdminModule ───────────────────────────────────────────────────────────────
export default function AdminModule({ company, currentUser }) {
  const [activeTab, setActiveTab] = useState('approvals')
  const [requests, setRequests]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [detail, setDetail]               = useState(null)
  const [toast, setToast]                 = useState(null)
  const [approvalRefreshKey, setApprovalRefreshKey] = useState(0)

  function showToast(msg, type) { setToast({ message: msg, type: type || 'success' }) }
  function refreshApprovals() { setApprovalRefreshKey(k => k + 1) }

  useEffect(() => {
    async function fetchRequests() {
      setLoading(true)
      const { data } = await supabase
        .from('customers_master')
        .select('*')
        .eq('company', company)
        .eq('pending_approval', true)
        .order('created_at', { ascending: false })
      setRequests(data || [])
      setLoading(false)
    }
    fetchRequests()
  }, [company, approvalRefreshKey])

  async function handleApprove(req) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('customers_master')
      .update({ pending_approval: false, is_approved: true, approved_date: today })
      .eq('id', req.id)
    if (error) { showToast('Approval failed: ' + error.message, 'error'); return }
    logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'edited', recordLabel: req.name, details: { status: 'approved', submitted_by: req.submitted_by || '' } })
    if (req.submitted_by) {
      await supabase.from('notifications').insert({
        recipient_name: req.submitted_by,
        message: `Your customer "${req.name}" has been approved`,
        company: req.company,
      })
    }
    showToast(`${req.name} approved`)
    refreshApprovals()
  }

  async function handleReject(req) {
    const { error } = await supabase
      .from('customers_master')
      .delete()
      .eq('id', req.id)
    if (error) { showToast('Reject failed: ' + error.message, 'error'); return }
    logActivity({ actor: currentUser, company, module: 'Customer Master', action: 'deleted', recordLabel: req.name, details: { status: 'rejected', submitted_by: req.submitted_by || '' } })
    if (req.submitted_by) {
      await supabase.from('notifications').insert({
        recipient_name: req.submitted_by,
        message: `Your customer "${req.name}" was not approved`,
        company: req.company,
      })
    }
    showToast(`${req.name} rejected and removed`, 'error')
    refreshApprovals()
  }

  return (
    <div className="p-6 space-y-6">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {detail && (
        <DetailModal
          request={detail}
          onClose={() => setDetail(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-gray-400 text-sm mt-0.5">{company}</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
        <button onClick={() => setActiveTab('approvals')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
            ${activeTab === 'approvals' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Pending Approvals
          {requests.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold">
              {requests.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
            ${activeTab === 'activity' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Activity Log
        </button>
        <button onClick={() => setActiveTab('backup')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
            ${activeTab === 'backup' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Backup
        </button>
      </div>

      {/* Tab: Pending Approvals */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Pending Approval Requests</h2>
              {requests.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold">
                  {requests.length}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">Customer Master submissions awaiting review</span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading…</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600 bg-emerald-50">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-800 font-medium">All clear!</p>
              <p className="text-gray-400 text-sm mt-1">No pending approval requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Customer Name', 'Customer Code', 'Country', 'Contact 1', 'Email 1', 'Submitted By', 'Submitted On', 'Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50"
                          style={{ position: 'sticky', top: 0, zIndex: 2 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map(req => (
                    <tr key={req.id} className="hover:bg-orange-50/30 transition group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {req.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="font-semibold text-gray-900 whitespace-nowrap">{req.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {req.customer_code || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{req.country || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{req.contact1_name || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">{req.contact1_email || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                          {req.submitted_by || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(req.created_at)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetail(req)}
                            className="text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            View
                          </button>
                          <button onClick={async () => { await handleApprove(req) }}
                            className="text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            Approve
                          </button>
                          <button onClick={async () => { await handleReject(req) }}
                            className="text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition">
                            Reject
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
      )}

      {/* Tab: Activity Log */}
      {activeTab === 'activity' && <ActivityLog />}

      {/* Tab: Backup */}
      {activeTab === 'backup' && <BackupTab company={company} currentUser={currentUser} />}
    </div>
  )
}
