import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── Task storage ──────────────────────────────────────────────────────────────
function loadTasks(userId) {
  try { return JSON.parse(localStorage.getItem(`jrs_tasks_${userId}`)) || [] }
  catch { return [] }
}
function saveTasks(userId, tasks) {
  localStorage.setItem(`jrs_tasks_${userId}`, JSON.stringify(tasks))
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const day = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${day}/${mon}/${d.getFullYear()}`
}

function dueDateStatus(dueDate, done) {
  const today = new Date().toISOString().split('T')[0]
  if (done) return { label: formatDate(dueDate), colorClass: 'text-gray-400' }
  if (dueDate < today) return { label: `Overdue · ${formatDate(dueDate)}`, colorClass: 'text-red-500' }
  if (dueDate === today) return { label: 'Due today', colorClass: 'text-amber-600' }
  return { label: formatDate(dueDate), colorClass: 'text-blue-500' }
}

const PRIORITY_DOT = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-emerald-500' }
const PRIORITY_STYLE = {
  high:   'bg-red-50 text-red-600 border border-red-200',
  medium: 'bg-amber-50 text-amber-600 border border-amber-200',
  low:    'bg-emerald-50 text-emerald-600 border border-emerald-200',
}

// ── Greeting ──────────────────────────────────────────────────────────────────
function greeting(name) {
  const h = new Date().getHours()
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${salutation}, ${name.split(' ')[0]}`
}

// ── KPI Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, iconBg, iconColor, thisWeek, onClick, loading }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5 flex items-center gap-4 text-left hover:shadow-md hover:border-gray-200 transition-all w-full group">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <svg className={`w-6 h-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="mt-1 w-8 h-7 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
        )}
        {!loading && thisWeek != null && thisWeek > 0 && (
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">+{thisWeek} this week</p>
        )}
      </div>
    </button>
  )
}

// ── Inquiry Pipeline ──────────────────────────────────────────────────────────
function PipelinePanel({ stats, loading, onNavigate }) {
  const total = stats?.total || 0
  const stages = [
    { label: 'Leads',     value: stats?.leads     ?? 0, color: 'bg-amber-500',  ring: 'border-amber-400',  text: 'text-amber-600',  light: 'bg-amber-50' },
    { label: 'Prospects', value: stats?.prospects  ?? 0, color: 'bg-purple-500', ring: 'border-purple-400', text: 'text-purple-600', light: 'bg-purple-50' },
    { label: 'Active',    value: stats?.active     ?? 0, color: 'bg-emerald-500',ring: 'border-emerald-400',text: 'text-emerald-600',light: 'bg-emerald-50' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-50">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Inquiry Pipeline</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? 'Loading…' : `${total} total inquiries`}
          </p>
        </div>
        <button onClick={onNavigate}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition">
          View all
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-5 py-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Funnel stages */}
            <div className="flex items-center gap-2">
              {stages.map((s, i) => (
                <div key={s.label} className="flex items-center flex-1 gap-2">
                  <div className={`flex-1 rounded-xl px-4 py-5 flex flex-col items-center text-center border-2 ${s.ring} ${s.light}`}>
                    <p className={`text-4xl font-extrabold ${s.text}`}>{s.value}</p>
                    <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
                    {total > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {Math.round((s.value / total) * 100)}%
                      </p>
                    )}
                  </div>
                  {i < stages.length - 1 && (
                    <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* Progress bar breakdown */}
            {total > 0 && (
              <div className="mt-5">
                <div className="flex rounded-full overflow-hidden h-2 bg-gray-100">
                  {stages.map(s => (
                    <div key={s.label}
                      className={`${s.color} h-full transition-all`}
                      style={{ width: `${(s.value / total) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex gap-4 mt-2">
                  {stages.map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full inline-block ${s.color}`} />
                      <span className="text-[11px] text-gray-500">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Compact Tasks ─────────────────────────────────────────────────────────────
function TasksCard({ currentUser }) {
  const [tasks, setTasks]             = useState(() => loadTasks(currentUser.id))
  const [input, setInput]             = useState('')
  const [priority, setPriority]       = useState('medium')
  const [dueDate, setDueDate]         = useState('')
  const [filter, setFilter]           = useState('all')
  const [editId, setEditId]           = useState(null)
  const [editText, setEditText]       = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const inputRef       = useRef(null)
  const dueDateRef     = useRef(null)
  const editDueDateRef = useRef(null)
  const suppressBlur   = useRef(false)

  function persist(next) { setTasks(next); saveTasks(currentUser.id, next) }
  function addTask() {
    const text = input.trim()
    if (!text) return
    persist([{ id: Date.now().toString(), text, done: false, priority, createdAt: new Date().toISOString(), dueDate: dueDate || null }, ...tasks])
    setInput(''); setDueDate('')
    inputRef.current?.focus()
  }
  function toggleDone(id) { persist(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)) }
  function deleteTask(id) { persist(tasks.filter(t => t.id !== id)) }
  function clearDone()    { persist(tasks.filter(t => !t.done)) }
  function startEdit(task) { setEditId(task.id); setEditText(task.text); setEditDueDate(task.dueDate || '') }
  function saveEdit(id) {
    const text = editText.trim()
    if (!text) { setEditId(null); return }
    persist(tasks.map(t => t.id === id ? { ...t, text, dueDate: editDueDate || null } : t))
    setEditId(null); setEditDueDate('')
  }

  const filtered     = tasks.filter(t => filter === 'all' ? true : filter === 'pending' ? !t.done : t.done)
  const doneCount    = tasks.filter(t => t.done).length
  const pendingCount = tasks.filter(t => !t.done).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50">
        <div>
          <h2 className="text-sm font-bold text-gray-900">My Tasks</h2>
          <p className="text-xs text-gray-400 mt-0.5">{pendingCount} pending · {doneCount} done</p>
        </div>
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {[['all','All'],['pending','Pending'],['done','Done']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filter === val ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add input */}
      <div className="flex gap-2 px-4 py-3 border-b border-gray-50">
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shrink-0">
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Med</option>
          <option value="low">🟢 Low</option>
        </select>

        <input ref={dueDateRef} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="sr-only" tabIndex={-1} />
        <div onClick={() => dueDateRef.current?.showPicker?.()}
          className={`shrink-0 flex items-center gap-1 border rounded-lg px-2 py-1.5 text-xs cursor-pointer transition ${
            dueDate ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {dueDate ? formatDate(dueDate) : 'Date'}
          {dueDate && <span onClick={e => { e.stopPropagation(); setDueDate('') }} className="ml-1 text-blue-400 hover:text-blue-700 font-bold">×</span>}
        </div>

        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a task…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-gray-300 min-w-0" />
        <button onClick={addTask}
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition flex items-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1" style={{ maxHeight: '320px' }}>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-xs">{filter === 'done' ? 'No completed tasks' : filter === 'pending' ? 'Nothing pending!' : 'No tasks yet'}</p>
          </div>
        )}
        {filtered.map(task => (
          <div key={task.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition group ${
              task.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
            }`}>
            <button onClick={() => toggleDone(task.id)}
              className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                task.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-blue-400'
              }`}
              style={{ width: 18, height: 18 }}>
              {task.done && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
            <div className="flex-1 min-w-0">
              {editId === task.id ? (
                <div>
                  <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(task.id); if (e.key === 'Escape') setEditId(null) }}
                    onBlur={() => { if (!suppressBlur.current) saveEdit(task.id); suppressBlur.current = false }}
                    className="w-full text-sm border-b border-blue-400 focus:outline-none bg-transparent" />
                  <div className="flex items-center gap-2 mt-1">
                    <input ref={editDueDateRef} type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="sr-only" tabIndex={-1} />
                    <div onMouseDown={() => { suppressBlur.current = true }}
                      onClick={() => editDueDateRef.current?.showPicker?.()}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer px-1.5 py-0.5 rounded border transition ${
                        editDueDate ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-gray-50'
                      }`}>
                      {editDueDate ? formatDate(editDueDate) : 'Set due date'}
                    </div>
                    {editDueDate && (
                      <button onMouseDown={() => { suppressBlur.current = true }} onClick={() => setEditDueDate('')}
                        className="text-[10px] text-gray-400 hover:text-red-500 transition">Remove</button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <span className={`text-sm truncate block ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.text}</span>
                  {task.dueDate && (
                    <p className={`text-[10px] mt-0.5 font-medium ${dueDateStatus(task.dueDate, task.done).colorClass}`}>
                      {dueDateStatus(task.dueDate, task.done).label}
                    </p>
                  )}
                </>
              )}
            </div>
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium capitalize hidden sm:inline-flex ${PRIORITY_STYLE[task.priority]}`}>
              {task.priority}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
              {!task.done && (
                <button onClick={() => startEdit(task)} className="p-1 text-gray-400 hover:text-blue-500 rounded">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button onClick={() => deleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7M4 7h16m-5 0V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer progress */}
      {doneCount > 0 && (
        <div className="px-4 py-3 border-t border-gray-50 flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }} />
          </div>
          <span className="text-xs text-gray-400">{Math.round((doneCount / tasks.length) * 100)}%</span>
          <button onClick={clearDone} className="text-xs text-gray-400 hover:text-red-500 transition whitespace-nowrap">
            Clear done
          </button>
        </div>
      )}
    </div>
  )
}

// ── Module Quick-Nav ──────────────────────────────────────────────────────────
function QuickNavCard({ title, icon, iconBg, iconColor, stat, statLabel, onNavigate, comingSoon }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-4 ${comingSoon ? 'opacity-70' : 'hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group'}`}
      onClick={!comingSoon ? onNavigate : undefined}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <svg className={`w-5 h-5 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {comingSoon ? (
          <p className="text-xs text-gray-400">Coming soon</p>
        ) : stat != null ? (
          <p className="text-xs text-gray-400">{stat} {statLabel}</p>
        ) : (
          <div className="w-10 h-3 bg-gray-100 rounded animate-pulse mt-0.5" />
        )}
      </div>
      {comingSoon ? (
        <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full uppercase tracking-wide shrink-0">Soon</span>
      ) : (
        <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage({ currentUser, company, setActivePage }) {
  const [inquiryStats, setInquiryStats]   = useState(null)
  const [masterStats, setMasterStats]     = useState(null)
  const [estimateStats, setEstimateStats] = useState(null)
  const [loadingInquiries, setLoadingInquiries] = useState(true)
  const [loadingMasters, setLoadingMasters]     = useState(true)
  const [loadingEstimates, setLoadingEstimates] = useState(true)

  const weekAgo    = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoISO = weekAgo.toISOString()

  useEffect(() => {
    setLoadingInquiries(true)
    supabase.from('inquiries').select('status, created_at').eq('company', company).then(({ data }) => {
      if (!data) { setInquiryStats(null); setLoadingInquiries(false); return }
      setInquiryStats({
        total:     data.length,
        active:    data.filter(r => r.status === 'Active').length,
        leads:     data.filter(r => r.status === 'Lead').length,
        prospects: data.filter(r => r.status === 'Prospect').length,
        thisWeek:  data.filter(r => r.created_at >= weekAgoISO).length,
      })
      setLoadingInquiries(false)
    })
  }, [company])

  useEffect(() => {
    setLoadingMasters(true)
    Promise.all([
      supabase.from('customers_master').select('created_at').eq('company', company),
      supabase.from('vendors_master').select('created_at').eq('company', company),
      supabase.from('products_master').select('created_at').eq('company', company),
      supabase.from('storage_master').select('created_at').eq('company', company),
    ]).then(([c, v, p, s]) => {
      const week = r => (r.data || []).filter(x => x.created_at >= weekAgoISO).length
      setMasterStats({
        customers: (c.data || []).length,
        vendors:   (v.data || []).length,
        products:  (p.data || []).length,
        storage:   (s.data || []).length,
        thisWeek:  week(c) + week(v) + week(p) + week(s),
      })
      setLoadingMasters(false)
    })
  }, [company])

  useEffect(() => {
    setLoadingEstimates(true)
    supabase.from('estimates').select('status, created_at').eq('company', company).then(({ data }) => {
      if (!data) { setEstimateStats(null); setLoadingEstimates(false); return }
      setEstimateStats({
        total:    data.length,
        draft:    data.filter(e => e.status === 'Draft').length,
        sent:     data.filter(e => e.status === 'Sent').length,
        accepted: data.filter(e => e.status === 'Accepted').length,
        thisWeek: data.filter(e => e.created_at >= weekAgoISO).length,
      })
      setLoadingEstimates(false)
    })
  }, [company])

  const now   = new Date()
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const tz    = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()

  return (
    <div className="p-6 space-y-5">

      {/* Greeting */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting(currentUser.name)}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today} · {tz} · {company.split(' ').slice(-1)[0]}</p>
        </div>
      </div>

      {/* KPI stat row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Inquiries"
          value={inquiryStats?.total}
          loading={loadingInquiries}
          thisWeek={inquiryStats?.thisWeek}
          onClick={() => setActivePage('inquiries')}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
        />
        <StatCard
          label="Active Inquiries"
          value={inquiryStats?.active}
          loading={loadingInquiries}
          onClick={() => setActivePage('inquiries')}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
        />
        <StatCard
          label="Estimates"
          value={estimateStats?.total}
          loading={loadingEstimates}
          thisWeek={estimateStats?.thisWeek}
          onClick={() => setActivePage('erp-estimates')}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
        />
        <StatCard
          label="Customers"
          value={masterStats?.customers}
          loading={loadingMasters}
          onClick={() => setActivePage('masters-customers')}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />}
        />
      </div>

      {/* Pipeline + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" style={{ minHeight: '340px' }}>
        <div className="lg:col-span-3">
          <PipelinePanel
            stats={inquiryStats}
            loading={loadingInquiries}
            onNavigate={() => setActivePage('inquiries')}
          />
        </div>
        <div className="lg:col-span-2">
          <TasksCard currentUser={currentUser} />
        </div>
      </div>

      {/* Module quick-nav */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Modules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <QuickNavCard
            title="Inquiries"
            iconBg="bg-blue-50" iconColor="text-blue-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
            stat={inquiryStats?.total}
            statLabel="total"
            onNavigate={() => setActivePage('inquiries')}
          />
          <QuickNavCard
            title="Masters"
            iconBg="bg-indigo-50" iconColor="text-indigo-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />}
            stat={masterStats?.customers != null ? `${masterStats.customers} customers · ${masterStats.vendors} suppliers` : null}
            statLabel=""
            onNavigate={() => setActivePage('masters')}
          />
          <QuickNavCard
            title="ERP · Estimates"
            iconBg="bg-teal-50" iconColor="text-teal-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
            stat={estimateStats?.total}
            statLabel={`total · ${estimateStats?.draft ?? '—'} draft`}
            onNavigate={() => setActivePage('erp-estimates')}
          />
          <QuickNavCard
            title="WMS"
            iconBg="bg-orange-50" iconColor="text-orange-500"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />}
            comingSoon
          />
        </div>
      </div>

    </div>
  )
}
