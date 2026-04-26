import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ── Task storage (user-scoped, not company-dependent) ─────────────────────────
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
  if (done) return { label: `📅 ${formatDate(dueDate)}`, colorClass: 'text-gray-400' }
  if (dueDate < today) return { label: `⚠ Overdue · ${formatDate(dueDate)}`, colorClass: 'text-red-500' }
  if (dueDate === today) return { label: '📅 Due today', colorClass: 'text-amber-600' }
  return { label: `📅 ${formatDate(dueDate)}`, colorClass: 'text-blue-500' }
}

const PRIORITY_STYLE = {
  high:   'bg-red-50 text-red-600 border border-red-200',
  medium: 'bg-amber-50 text-amber-600 border border-amber-200',
  low:    'bg-emerald-50 text-emerald-600 border border-emerald-200',
}
const PRIORITY_DOT = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' }

// ── Tasks Card ────────────────────────────────────────────────────────────────
function TasksCard({ currentUser }) {
  const [tasks, setTasks]           = useState(() => loadTasks(currentUser.id))
  const [input, setInput]           = useState('')
  const [priority, setPriority]     = useState('medium')
  const [dueDate, setDueDate]       = useState('')
  const [filter, setFilter]         = useState('all')
  const [editId, setEditId]         = useState(null)
  const [editText, setEditText]     = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const inputRef        = useRef(null)
  const dueDateRef      = useRef(null)
  const editDueDateRef  = useRef(null)
  const suppressBlurRef = useRef(false)

  function persist(next) {
    setTasks(next)
    saveTasks(currentUser.id, next)
  }

  function addTask() {
    const text = input.trim()
    if (!text) return
    persist([{ id: Date.now().toString(), text, done: false, priority, createdAt: new Date().toISOString(), dueDate: dueDate || null }, ...tasks])
    setInput('')
    setDueDate('')
    inputRef.current?.focus()
  }

  function toggleDone(id) {
    persist(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function deleteTask(id) {
    persist(tasks.filter(t => t.id !== id))
  }

  function clearDone() {
    persist(tasks.filter(t => !t.done))
  }

  function startEdit(task) {
    setEditId(task.id)
    setEditText(task.text)
    setEditDueDate(task.dueDate || '')
  }

  function saveEdit(id) {
    const text = editText.trim()
    if (!text) { setEditId(null); return }
    persist(tasks.map(t => t.id === id ? { ...t, text, dueDate: editDueDate || null } : t))
    setEditId(null)
    setEditDueDate('')
  }

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'pending' ? !t.done : t.done
  )
  const doneCount    = tasks.filter(t => t.done).length
  const pendingCount = tasks.filter(t => !t.done).length

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ minHeight: '440px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">My Tasks</h2>
            <p className="text-xs text-gray-400">
              {pendingCount} pending · {doneCount} done
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[['all', 'All'], ['pending', 'Pending'], ['done', 'Done']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filter === val ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add task input */}
      <div className="flex gap-2 px-5 py-3 border-b border-gray-50">
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shrink-0">
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>

        {/* Due date picker */}
        <input ref={dueDateRef} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="sr-only" tabIndex={-1} />
        <div
          onClick={() => dueDateRef.current?.showPicker?.()}
          className={`shrink-0 flex items-center gap-1.5 border rounded-lg px-2.5 py-2 text-xs cursor-pointer transition whitespace-nowrap ${
            dueDate ? 'border-blue-300 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-white'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {dueDate ? formatDate(dueDate) : 'Due date'}
          {dueDate && (
            <span onClick={e => { e.stopPropagation(); setDueDate('') }}
              className="ml-0.5 text-blue-400 hover:text-blue-700 font-bold leading-none">×</span>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a task… press Enter to save"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-gray-300"
        />
        <button onClick={addTask}
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">{filter === 'done' ? 'No completed tasks' : filter === 'pending' ? 'Nothing pending!' : 'No tasks yet'}</p>
          </div>
        )}

        {filtered.map(task => (
          <div key={task.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition group ${
              task.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
            }`}>
            {/* Checkbox */}
            <button onClick={() => toggleDone(task.id)}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                task.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-blue-400'
              }`}>
              {task.done && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Priority dot */}
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />

            {/* Text */}
            <div className="flex-1 min-w-0">
              {editId === task.id ? (
                <div>
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(task.id); if (e.key === 'Escape') setEditId(null) }}
                    onBlur={() => { if (!suppressBlurRef.current) saveEdit(task.id); suppressBlurRef.current = false }}
                    className="w-full text-sm border-b border-blue-400 focus:outline-none bg-transparent"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <input ref={editDueDateRef} type="date" value={editDueDate}
                      onChange={e => setEditDueDate(e.target.value)} className="sr-only" tabIndex={-1} />
                    <div
                      onMouseDown={() => { suppressBlurRef.current = true }}
                      onClick={() => editDueDateRef.current?.showPicker?.()}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer px-1.5 py-0.5 rounded border transition ${
                        editDueDate ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 hover:border-gray-300 bg-gray-50'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {editDueDate ? formatDate(editDueDate) : 'Set due date'}
                    </div>
                    {editDueDate && (
                      <button
                        onMouseDown={() => { suppressBlurRef.current = true }}
                        onClick={() => setEditDueDate('')}
                        className="text-[10px] text-gray-400 hover:text-red-500 transition"
                      >Remove</button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <span className={`text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.text}
                  </span>
                  {task.dueDate && (
                    <p className={`text-[10px] mt-0.5 font-medium ${dueDateStatus(task.dueDate, task.done).colorClass}`}>
                      {dueDateStatus(task.dueDate, task.done).label}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Priority badge */}
            <span className={`hidden sm:inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${PRIORITY_STYLE[task.priority]}`}>
              {task.priority}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
              {!task.done && (
                <button onClick={() => startEdit(task)}
                  className="p-1 text-gray-400 hover:text-blue-500 rounded transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button onClick={() => deleteTask(task.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7M4 7h16m-5 0V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {doneCount > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 mr-4">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 mr-3">{Math.round((doneCount / tasks.length) * 100)}%</span>
          <button onClick={clearDone} className="text-xs text-gray-400 hover:text-red-500 transition whitespace-nowrap">
            Clear done ({doneCount})
          </button>
        </div>
      )}
    </div>
  )
}

// ── Module Summary Card ───────────────────────────────────────────────────────
function TrendBadge({ count }) {
  if (count == null) return null
  if (count === 0) return <span className="text-[10px] text-gray-400 font-medium">no change this week</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
      +{count} this week
    </span>
  )
}

function ModuleCard({ title, icon, iconBg, stats, onNavigate, comingSoon, loading, trend }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            {!comingSoon && !loading && <TrendBadge count={trend} />}
          </div>
        </div>
        {comingSoon ? (
          <span className="text-[10px] font-semibold px-2 py-1 bg-gray-100 text-gray-400 rounded-full uppercase tracking-wide">
            Soon
          </span>
        ) : (
          onNavigate && (
            <button onClick={onNavigate}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition shrink-0">
              Open
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        )}
      </div>

      <div className="px-5 pb-5 flex-1">
        {comingSoon ? (
          <div className="flex flex-col items-center justify-center py-6 text-gray-300">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-400">Coming Soon</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-1">
            {stats.map(({ label, value, accent }) => (
              <div key={label} className={`rounded-xl p-3 ${accent || 'bg-gray-50'}`}>
                <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Greeting helper ───────────────────────────────────────────────────────────
function greeting(name) {
  const h = new Date().getHours()
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${salutation}, ${name.split(' ')[0]}`
}

// ── Main Dashboard Page ───────────────────────────────────────────────────────
export default function DashboardPage({ currentUser, company, setActivePage }) {
  const [inquiryStats, setInquiryStats]   = useState(null)
  const [masterStats, setMasterStats]     = useState(null)
  const [estimateStats, setEstimateStats] = useState(null)
  const [loadingInquiries, setLoadingInquiries] = useState(true)
  const [loadingMasters, setLoadingMasters]     = useState(true)
  const [loadingEstimates, setLoadingEstimates] = useState(true)

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting(currentUser.name)} 👋</h1>
        <p className="text-gray-400 text-sm mt-0.5">{today} · {tz} · {company}</p>
      </div>

      {/* Top row: Tasks + Quick overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks — spans 2 cols */}
        <div className="lg:col-span-2">
          <TasksCard currentUser={currentUser} />
        </div>

        {/* Inquiry quick-stat */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Inquiry Snapshot</h3>
                <p className="text-xs text-gray-400">{company.split(' ').slice(-1)[0]}</p>
              </div>
            </div>
            {loadingInquiries ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Total', value: inquiryStats?.total ?? 0, bar: 1, color: 'bg-blue-500' },
                  { label: 'Active', value: inquiryStats?.active ?? 0, bar: inquiryStats?.total ? inquiryStats.active / inquiryStats.total : 0, color: 'bg-emerald-500' },
                  { label: 'Leads', value: inquiryStats?.leads ?? 0, bar: inquiryStats?.total ? inquiryStats.leads / inquiryStats.total : 0, color: 'bg-amber-500' },
                  { label: 'Prospects', value: inquiryStats?.prospects ?? 0, bar: inquiryStats?.total ? inquiryStats.prospects / inquiryStats.total : 0, color: 'bg-purple-500' },
                ].map(({ label, value, bar, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-800">{value}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.round(bar * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setActivePage('inquiries')}
              className="mt-4 w-full text-xs text-blue-600 hover:text-blue-700 font-medium text-center transition">
              View all inquiries →
            </button>
          </div>
        </div>
      </div>

      {/* Module summary cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Module Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Inquiries */}
          <ModuleCard
            title="Inquiries"
            iconBg="bg-blue-50"
            loading={loadingInquiries}
            trend={inquiryStats?.thisWeek}
            onNavigate={() => setActivePage('inquiries')}
            icon={
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            }
            stats={[
              { label: 'Total', value: inquiryStats?.total, accent: 'bg-blue-50' },
              { label: 'Active', value: inquiryStats?.active, accent: 'bg-emerald-50' },
              { label: 'Leads', value: inquiryStats?.leads, accent: 'bg-amber-50' },
              { label: 'Prospects', value: inquiryStats?.prospects, accent: 'bg-purple-50' },
            ]}
          />

          {/* Masters */}
          <ModuleCard
            title="Masters"
            iconBg="bg-indigo-50"
            loading={loadingMasters}
            trend={masterStats?.thisWeek}
            onNavigate={() => setActivePage('masters')}
            icon={
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            }
            stats={[
              { label: 'Customers', value: masterStats?.customers, accent: 'bg-blue-50' },
              { label: 'Vendors', value: masterStats?.vendors, accent: 'bg-indigo-50' },
              { label: 'Products', value: masterStats?.products, accent: 'bg-violet-50' },
              { label: 'Storage', value: masterStats?.storage, accent: 'bg-slate-50' },
            ]}
          />

          {/* ERP / Estimates */}
          <ModuleCard
            title="ERP · Estimates"
            iconBg="bg-teal-50"
            loading={loadingEstimates}
            trend={estimateStats?.thisWeek}
            onNavigate={() => setActivePage('erp-estimates')}
            icon={
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            stats={[
              { label: 'Total', value: estimateStats?.total, accent: 'bg-teal-50' },
              { label: 'Draft', value: estimateStats?.draft, accent: 'bg-gray-50' },
              { label: 'Sent', value: estimateStats?.sent, accent: 'bg-blue-50' },
              { label: 'Accepted', value: estimateStats?.accepted, accent: 'bg-emerald-50' },
            ]}
          />

          {/* WMS */}
          <ModuleCard
            title="WMS"
            iconBg="bg-orange-50"
            comingSoon
            icon={
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
              </svg>
            }
            stats={[]}
          />

        </div>
      </div>
    </div>
  )
}
