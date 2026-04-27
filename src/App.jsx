import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Inquiries from './Inquiries'
import Masters from './Masters'
import Estimates from './Estimates'
import DashboardPage from './Dashboard'
import AdminModule from './Admin'
import { supabase } from './supabase'

const ADMIN_USERS = ['Mahendra Sannappa', 'Pratik Shah', 'Sanket Patel', 'Sachin Shah']

const COMPANIES = [
  'Jupiter Research Services Inc',
  'Jupiter Research Services BV',
  'Jupiter Research Services India',
]

function Particles() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      o: Math.random() * 0.5 + 0.1,
      isGreen: Math.random() > 0.5,
    }))
    let animId
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.isGreen ? `rgba(74,222,128,${p.o})` : `rgba(147,197,253,${p.o})`
        ctx.fill()
        p.x += p.dx; p.y += p.dy
        if (p.x < 0 || p.x > canvas.width)  p.dx *= -1
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

function App() {
  const [activePage, setActivePage]       = useState('dashboard')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [pendingCount, setPendingCount]   = useState(0)

  // Restore session from localStorage on first load
  const savedUser    = (() => { try { return JSON.parse(localStorage.getItem('jrs_user'))    } catch { return null } })()
  const savedCompany = (() => { try { return JSON.parse(localStorage.getItem('jrs_company')) } catch { return null } })()
  const savedTheme   = (() => { try { return localStorage.getItem('jrs_theme') || 'light' } catch { return 'light' } })()

  const [currentUser, setCurrentUser]         = useState(savedUser)
  const [selectedCompany, setSelectedCompany] = useState(savedCompany || '')
  const [theme, setTheme]                     = useState(savedTheme)
  const [notifications, setNotifications]     = useState([])

  const isAdmin = ADMIN_USERS.includes(currentUser?.name)

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('jrs_theme', next)
  }

  const isLoggedIn = !!(currentUser && selectedCompany)

  async function handleLogin(user, company) {
    localStorage.setItem('jrs_user',    JSON.stringify(user))
    localStorage.setItem('jrs_company', JSON.stringify(company))
    setCurrentUser(user)
    setSelectedCompany(company)
    if (!ADMIN_USERS.includes(user.name)) {
      try {
        await supabase.from('audit_logs').insert([{
          actor_name: user.name,
          actor_role: user.role || 'employee',
          company,
          module: 'Session',
          action: 'login',
          details: { company },
        }])
      } catch { void 0 }
    }
  }

  async function handleLogout() {
    if (currentUser && !ADMIN_USERS.includes(currentUser.name)) {
      try {
        await supabase.from('audit_logs').insert([{
          actor_name: currentUser.name,
          actor_role: currentUser.role || 'employee',
          company: selectedCompany,
          module: 'Session',
          action: 'logout',
          details: {},
        }])
      } catch { void 0 }
    }
    localStorage.removeItem('jrs_user')
    localStorage.removeItem('jrs_company')
    setCurrentUser(null)
    setSelectedCompany('')
  }

  // Poll pending approval count for admins
  useEffect(() => {
    if (!isLoggedIn || !isAdmin || !selectedCompany) return
    async function fetchPending() {
      const { count } = await supabase
        .from('customers_master')
        .select('id', { count: 'exact', head: true })
        .eq('company', selectedCompany)
        .eq('pending_approval', true)
      setPendingCount(count || 0)
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [isLoggedIn, isAdmin, selectedCompany])

  // Notifications: fetch + realtime
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.name) return
    async function fetchNotifications() {
      const { data } = await supabase.from('notifications')
        .select('*').eq('recipient_name', currentUser.name)
        .order('created_at', { ascending: false }).limit(50)
      setNotifications(data || [])
    }
    fetchNotifications()
    const channel = supabase.channel(`notifs-${currentUser.name}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_name=eq.${currentUser.name}` },
        payload => setNotifications(prev => [payload.new, ...prev]))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [isLoggedIn, currentUser?.name])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markAllRead() {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id)
    if (!unread.length) return
    await supabase.from('notifications').update({ is_read: true }).in('id', unread)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function markOneRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  // Auto-logout after 10 minutes of inactivity
  useEffect(() => {
    if (!isLoggedIn) return
    const TIMEOUT = 10 * 60 * 1000
    let timer = setTimeout(handleLogout, TIMEOUT)
    const reset = () => { clearTimeout(timer); timer = setTimeout(handleLogout, TIMEOUT) }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <>
      <Dashboard
        activePage={activePage}
        setActivePage={setActivePage}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        selectedCompany={selectedCompany}
        onCompanyChange={company => {
          localStorage.setItem('jrs_company', JSON.stringify(company))
          setSelectedCompany(company)
        }}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
        theme={theme}
        toggleTheme={toggleTheme}
        isAdmin={isAdmin}
        pendingCount={pendingCount}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={markAllRead}
        onMarkOneRead={markOneRead}
      />
      {showChangePassword && (
        <ChangePasswordModal
          currentUser={currentUser}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </>
  )
}

// ── Login Page ────────────────────────────────────────────────────────────────
const COMPANY_LABELS = [
  { value: 'Jupiter Research Services Inc',    label: 'Inc',    sub: 'North America' },
  { value: 'Jupiter Research Services BV',     label: 'BV',     sub: 'Europe'        },
  { value: 'Jupiter Research Services India',  label: 'India',  sub: 'Asia Pacific'  },
]

function LoginPage({ onLogin }) {
  const [selectedCompany, setSelectedCompany] = useState('')
  const [users, setUsers]         = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [showUserDrop, setShowUserDrop] = useState(false)
  const userDropRef = useRef(null)

  useEffect(() => {
    supabase.from('users').select('id, name, role').order('name').then(({ data }) => setUsers(data || []))
  }, [])

  useEffect(() => {
    if (!showUserDrop) return
    const fn = e => { if (userDropRef.current && !userDropRef.current.contains(e.target)) setShowUserDrop(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showUserDrop])

  useEffect(() => {
    if (!showUserDrop) return
    const fn = e => { if (e.key === 'Escape') setShowUserDrop(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showUserDrop])

  const selectedUserObj = users.find(u => u.name === selectedUser)

  async function handleLogin() {
    if (!selectedCompany)  return setError('Please select a company.')
    if (!selectedUser)     return setError('Please select your account.')
    if (!password)         return setError('Please enter your password.')
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('users').select('*').eq('name', selectedUser).eq('password', password).single()
    setLoading(false)
    if (error || !data) { setError('Incorrect password. Please try again.'); return }
    onLogin(data, selectedCompany)
  }

  const fieldStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f1f3d 50%, #0d1b35 100%)' }}>
      <Particles />
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logoo-removebg-preview.png" alt="Jupiter Research Services"
              style={{ height: '80px', objectFit: 'contain' }} />
          </div>
          <h1 className="text-white text-2xl font-bold">Jupiter Research Services</h1>
          <p className="text-blue-300 text-sm mt-1">Global Project Management System</p>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
          <h2 className="text-white text-2xl font-bold mb-1">Sign In</h2>
          <p className="text-blue-300 text-sm mb-6">Select your company and account to continue.</p>

          {/* Company Cards */}
          <div className="mb-5">
            <label className="block text-blue-200 text-sm font-medium mb-2">Company</label>
            <div className="grid grid-cols-3 gap-2">
              {COMPANY_LABELS.map(c => {
                const active = selectedCompany === c.value
                return (
                  <button key={c.value} type="button"
                    onClick={() => { setSelectedCompany(c.value); setError('') }}
                    className="rounded-xl py-3 px-2 text-center transition-all duration-150 cursor-pointer"
                    style={{
                      background: active ? 'rgba(43,125,233,0.25)' : 'rgba(255,255,255,0.06)',
                      border: active ? '1px solid rgba(43,125,233,0.6)' : '1px solid rgba(255,255,255,0.1)',
                      boxShadow: active ? '0 0 0 2px rgba(43,125,233,0.2)' : 'none',
                    }}>
                    <div className="text-white font-semibold text-sm">{c.label}</div>
                    <div className="text-blue-400 text-xs mt-0.5">{c.sub}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* User Account Selector */}
          <div className="mb-4" style={{ position: 'relative' }} ref={userDropRef}>
            <label className="block text-blue-200 text-sm font-medium mb-1.5">User Account</label>
            <button
              type="button"
              onClick={() => setShowUserDrop(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '10px 14px', borderRadius: 8,
                background: showUserDrop ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
                border: showUserDrop ? '1px solid rgba(43,125,233,0.6)' : '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: showUserDrop ? '0 0 0 3px rgba(43,125,233,0.18)' : 'none',
              }}
            >
              {selectedUserObj ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 11, fontWeight: 700,
                  }}>
                    {selectedUserObj.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: 'white', fontSize: 13, fontWeight: 500, margin: 0 }}>{selectedUserObj.name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>{selectedUserObj.role}</p>
                  </div>
                </div>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>Select your account…</span>
              )}
              <svg style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)', flexShrink: 0, transition: 'transform 0.2s', transform: showUserDrop ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserDrop && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
                background: '#0d1b35', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: 4,
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                maxHeight: 240, overflowY: 'auto',
              }}>
                {users.map(u => {
                  const active = selectedUser === u.name
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUser(u.name); setShowUserDrop(false); setError('') }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 10px', borderRadius: 7,
                        background: active ? 'rgba(43,125,233,0.18)' : 'transparent',
                        border: 'none', cursor: 'pointer', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: active ? 'linear-gradient(135deg, #2B7DE9, #3b82f6)' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 11, fontWeight: 700,
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <p style={{ color: active ? 'white' : 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: active ? 600 : 400, margin: 0 }}>{u.name}</p>
                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, margin: 0 }}>{u.role}</p>
                      </div>
                      {active && (
                        <svg style={{ width: 13, height: 13, color: '#2B7DE9', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-blue-200 text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={fieldStyle}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-200 transition-colors">
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.96 9.96 0 015.43 1.6M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button onClick={handleLogin} disabled={loading}
            className="w-full text-white py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
            style={{
              background: 'linear-gradient(90deg, #2B7DE9, #28A865)',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-blue-500/50 text-xs mt-5">
            21 CFR Part 11 compliant · Electronic Signatures Required · All actions are audited
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ currentUser, onClose }) {
  const [currentPwd, setCurrentPwd]   = useState('')
  const [newPwd, setNewPwd]           = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)
  const [loading, setLoading]         = useState(false)

  async function handleChange() {
    if (!currentPwd || !newPwd || !confirmPwd) return setError('All fields are required.')
    if (newPwd !== confirmPwd) return setError('New passwords do not match.')
    if (newPwd.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true); setError('')
    const { data } = await supabase.from('users').select('*').eq('id', currentUser.id).eq('password', currentPwd).single()
    if (!data) { setLoading(false); return setError('Current password is incorrect.') }
    await supabase.from('users').update({ password: newPwd }).eq('id', currentUser.id)
    setLoading(false); setSuccess(true)
    setTimeout(() => onClose(), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-xl font-bold mb-1">Change Password</h2>
        <p className="text-gray-500 text-sm mb-4">Update your password, {currentUser.name}</p>
        {success ? (
          <div className="text-green-600 text-center py-4 font-medium flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Password changed successfully!
          </div>
        ) : (
          <>
            {[['Current Password', currentPwd, setCurrentPwd], ['New Password', newPwd, setNewPwd], ['Confirm New Password', confirmPwd, setConfirmPwd]].map(([label, val, setter]) => (
              <div key={label} className="mb-3">
                <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                <input type="password" value={val} onChange={e => { setter(e.target.value); setError('') }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={handleChange} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
              <button onClick={onClose} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Feedback Widget ───────────────────────────────────────────────────────────
const FEEDBACK_CATS = ['💡 Feature', '🐛 Bug', '💬 General']

function FeedbackWidget({ currentUser, company, theme }) {
  const [open, setOpen]         = useState(false)
  const [category, setCategory] = useState('💬 General')
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const fn = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => {
    if (!open) return
    const fn = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  async function handleSubmit() {
    if (!message.trim()) return
    setSending(true)
    await supabase.from('feedback').insert({
      user_name: currentUser?.name,
      user_id:   currentUser?.id,
      company,
      category,
      message:   message.trim(),
    })
    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setOpen(false); setMessage(''); setCategory('💬 General') }, 2500)
  }

  const dark = theme === 'dark'

  const panel = open && (
    <div style={{
      position: 'absolute', bottom: 52, right: 0,
      width: 308,
      background: dark ? '#0d1b35' : '#ffffff',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
      borderRadius: 18,
      boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
      overflow: 'hidden',
    }}>
      {sent ? (
        <div style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(40,168,101,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg style={{ width: 22, height: 22, color: '#28A865' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p style={{ fontWeight: 700, fontSize: 14, color: dark ? '#f1f5f9' : '#111827', margin: 0 }}>Got it, thanks!</p>
          <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.45)' : '#9ca3af', margin: '4px 0 0' }}>Your feedback has been sent.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'}` }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: dark ? '#f1f5f9' : '#111827', margin: 0 }}>Feedback & Ideas</p>
            <p style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af', margin: '3px 0 0' }}>
              Feature requests, bugs, or just ask — we read everything!
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Category pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {FEEDBACK_CATS.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.12s',
                  background: category === c ? '#2B7DE9' : dark ? 'rgba(255,255,255,0.07)' : '#f3f4f6',
                  color: category === c ? 'white' : dark ? 'rgba(255,255,255,0.6)' : '#6b7280',
                  border: category === c ? '1px solid #2B7DE9' : `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              autoFocus
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              placeholder="What's on your mind?"
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}`,
                borderRadius: 12, padding: '10px 12px',
                fontSize: 13, resize: 'none',
                background: dark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                color: dark ? '#f1f5f9' : '#111827',
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = '#2B7DE9'}
              onBlur={e => e.target.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'}
            />

            {/* Footer row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>
                {currentUser?.name} · {company?.split(' ').pop()}
              </span>
              <button onClick={handleSubmit} disabled={!message.trim() || sending}
                style={{
                  background: '#2B7DE9', color: 'white',
                  border: 'none', borderRadius: 10,
                  padding: '7px 16px', fontSize: 12, fontWeight: 600,
                  cursor: message.trim() && !sending ? 'pointer' : 'not-allowed',
                  opacity: !message.trim() || sending ? 0.45 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'opacity 0.15s',
                }}>
                {sending && <span style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,0.25)' : '#d1d5db', margin: 0, textAlign: 'right' }}>
              ⌘ + Enter to send
            </p>
          </div>
        </>
      )}
    </div>
  )

  return createPortal(
    <div ref={wrapRef} style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 99999 }}>
      {panel}
      <button
        onClick={() => setOpen(v => !v)}
        title="Feedback & Ideas"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: open ? '#2B7DE9' : '#0a1628',
          border: '1.5px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(0,0,0,0.28)',
          transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? (
          <svg style={{ width: 15, height: 15, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg style={{ width: 16, height: 16, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </div>,
    document.body
  )
}

// ── Sidebar nav button ────────────────────────────────────────────────────────
function SidebarNavBtn({ label, icon, comingSoon, active, collapsed, indent, onClick, badge }) {
  return (
    <button
      onClick={comingSoon ? undefined : onClick}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: collapsed ? '9px 0' : indent ? '7px 10px 7px 30px' : '9px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        border: 'none',
        cursor: comingSoon ? 'default' : 'pointer',
        background: active ? 'rgba(43,125,233,0.18)' : 'transparent',
        color: active ? 'white' : 'rgba(255,255,255,0.5)',
        fontSize: indent ? 12 : 13,
        fontWeight: active ? 500 : 400,
        transition: 'background 0.15s, color 0.15s',
        marginBottom: 1,
        textAlign: 'left',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!active && !comingSoon) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'white' : 'rgba(255,255,255,0.5)' } }}
    >
      <span style={{ flexShrink: 0, display: 'flex', position: 'relative' }}>
        {icon}
        {badge && collapsed && (
          <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white' }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
          {badge && (
            <span style={{ fontSize: 10, background: '#f97316', color: 'white', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {badge}
            </span>
          )}
          {comingSoon && (
            <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', padding: '2px 5px', borderRadius: 4, fontWeight: 600, letterSpacing: '0.06em' }}>
              SOON
            </span>
          )}
        </>
      )}
    </button>
  )
}

// ── My Profile Modal ──────────────────────────────────────────────────────────
function MyProfileModal({ currentUser, selectedCompany, onClose, onNameUpdate }) {
  const [name, setName]       = useState(currentUser.name)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return setError('Name cannot be empty.')
    if (trimmed === currentUser.name) { onClose(); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('users').update({ name: trimmed }).eq('id', currentUser.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    // Persist updated name in localStorage
    const updated = { ...currentUser, name: trimmed }
    localStorage.setItem('jrs_user', JSON.stringify(updated))
    onNameUpdate(updated)
    setSuccess(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">My Profile</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-6 space-y-5">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              {name.charAt(0).toUpperCase()}
            </div>
          </div>
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          {/* Role + Company badges */}
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {currentUser.role}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              {selectedCompany}
            </span>
          </div>
          {error   && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-emerald-600 text-sm font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Profile updated!
          </p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || success}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ activePage, setActivePage, currentUser, setCurrentUser, selectedCompany, onCompanyChange, onLogout, onChangePassword, theme, toggleTheme, isAdmin, pendingCount, notifications, unreadCount, onMarkAllRead, onMarkOneRead }) {
  const [collapsed, setCollapsed]             = useState(false)
  const [inquiryPrefill, setInquiryPrefill]   = useState(null)
  const [showProfile, setShowProfile]         = useState(false)
  const [showUserMenu, setShowUserMenu]       = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)
  const [erpOpen, setErpOpen]                 = useState(activePage.startsWith('erp-'))
  const [mastersOpen, setMastersOpen]         = useState(activePage.startsWith('masters-') || activePage === 'masters')
  const [showCompanyPicker, setShowCompanyPicker] = useState(false)
  const [companyPickerPos, setCompanyPickerPos] = useState(null)
  const userMenuRef       = useRef(null)
  const companyRef        = useRef(null)
  const companyBtnRef     = useRef(null)
  const companyDropRef    = useRef(null)
  const sidebarRef        = useRef(null)

  // Collapse sidebar when clicking outside it (on main content)
  useEffect(() => {
    if (collapsed) return
    function handleClickOutside(e) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setCollapsed(true)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [collapsed])

  useEffect(() => {
    if (!showUserMenu) return
    const fn = e => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showUserMenu])

  useEffect(() => {
    if (!showCompanyPicker) return
    const fn = e => {
      if (
        companyRef.current && !companyRef.current.contains(e.target) &&
        companyDropRef.current && !companyDropRef.current.contains(e.target)
      ) setShowCompanyPicker(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showCompanyPicker])

  useEffect(() => {
    if (!showNotifications) return
    const fn = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showNotifications])

  const companyShort = selectedCompany.includes('India') ? 'Jupiter R.S. India'
    : selectedCompany.includes('BV') ? 'Jupiter R.S. BV' : 'Jupiter R.S. Inc'
  const companyTag = selectedCompany.includes('India') ? 'INDIA'
    : selectedCompany.includes('BV') ? 'BV' : 'INC'

  const W = collapsed ? 64 : 220

  const NAV_ITEMS = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
    },
    {
      id: 'inquiries', label: 'Inquiries',
      icon: <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    },
    {
      id: 'wms', label: 'WMS', comingSoon: true,
      icon: <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" /></svg>,
    },
    ...(isAdmin ? [{
      id: 'admin', label: 'Admin',
      icon: <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
      badge: pendingCount > 0 ? pendingCount : null,
    }] : []),
  ]

  const ERP_SUB = [
    {
      id: 'erp-estimates', label: 'Estimates',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
  ]

  const MASTERS_SUB = [
    {
      id: 'masters-company', label: 'Company Master',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    },
    {
      id: 'masters-customers', label: 'Customer Master',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      id: 'masters-vendors', label: 'Supplier Master',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
    },
    {
      id: 'masters-products', label: 'Product Master',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    },
    {
      id: 'masters-storage', label: 'Storage Master',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    },
  ]

  const erpActive = activePage.startsWith('erp-')
  const mastersActive = activePage.startsWith('masters-') || activePage === 'masters'

  return (
    <div data-theme={theme} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        onClick={e => { if (collapsed && !e.target.closest('button, a, input, select')) setCollapsed(false) }}
        style={{
          width: W, minWidth: W, maxWidth: W,
          background: '#0a1628',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.22s ease, min-width 0.22s ease, max-width 0.22s ease',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
          flexShrink: 0,
          cursor: collapsed ? 'pointer' : 'default',
        }}>

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '15px 0' : '15px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          minHeight: 58,
        }}>
          <img src="/logoo-removebg-preview.png" alt="JRS" style={{ height: 26, objectFit: 'contain', flexShrink: 0 }} />
          {!collapsed && <span style={{ color: 'white', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>GPMS</span>}
        </div>

        {/* Company switcher */}
        <div style={{ padding: collapsed ? '8px 6px' : '8px', position: 'relative' }} ref={companyRef}>
          <button
            ref={companyBtnRef}
            onClick={() => {
              const rect = companyBtnRef.current?.getBoundingClientRect()
              if (rect) setCompanyPickerPos({ top: rect.bottom + 4, left: rect.left })
              setShowCompanyPicker(v => !v)
            }}
            title={collapsed ? selectedCompany : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '7px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: showCompanyPicker ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28A865', flexShrink: 0 }} />
            {!collapsed && (
              <>
                <span style={{ fontSize: 11, color: '#28A865', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                  {companyShort}
                </span>
                <svg style={{ width: 11, height: 11, color: 'rgba(74,222,128,0.6)', flexShrink: 0, transition: 'transform 0.2s', transform: showCompanyPicker ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
            {collapsed && (
              <span style={{ fontSize: 9, color: '#28A865', fontWeight: 700, letterSpacing: '0.04em' }}>{companyTag}</span>
            )}
          </button>

          {showCompanyPicker && companyPickerPos && createPortal(
            <div ref={companyDropRef} style={{
              position: 'fixed',
              top: companyPickerPos.top,
              left: companyPickerPos.left,
              zIndex: 99999,
              background: '#0d1b35',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, minWidth: 240, padding: 4,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            }}>
              {COMPANIES.map(c => (
                <button key={c} onClick={() => { onCompanyChange(c); setShowCompanyPicker(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    background: c === selectedCompany ? 'rgba(74,222,128,0.1)' : 'transparent',
                    border: 'none', cursor: 'pointer', color: 'white', fontSize: 12, textAlign: 'left',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (c !== selectedCompany) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { if (c !== selectedCompany) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ flex: 1 }}>{c}</span>
                  {c === selectedCompany && (
                    <svg style={{ width: 12, height: 12, color: '#28A865' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>

          {NAV_ITEMS.map(item => (
            <SidebarNavBtn
              key={item.id}
              {...item}
              active={activePage === item.id}
              collapsed={collapsed}
              onClick={() => setActivePage(item.id)}
            />
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />

          {/* ERP parent */}
          <button
            onClick={() => collapsed ? setActivePage('erp-estimates') : setErpOpen(v => !v)}
            title={collapsed ? 'ERP' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: collapsed ? '9px 0' : '9px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: erpActive ? 'rgba(43,125,233,0.18)' : 'transparent',
              color: erpActive ? 'white' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: erpActive ? 500 : 400,
              transition: 'background 0.15s, color 0.15s', marginBottom: 1,
            }}
            onMouseEnter={e => { if (!erpActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white' } }}
            onMouseLeave={e => { if (!erpActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' } }}
          >
            <svg style={{ width: 17, height: 17, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {!collapsed && (
              <>
                <span style={{ flex: 1 }}>ERP</span>
                <svg style={{ width: 11, height: 11, transition: 'transform 0.2s', transform: erpOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {/* ERP sub-items */}
          {!collapsed && erpOpen && ERP_SUB.map(item => (
            <SidebarNavBtn
              key={item.id}
              {...item}
              active={activePage === item.id}
              collapsed={false}
              indent
              onClick={() => setActivePage(item.id)}
            />
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />

          {/* Masters parent */}
          <button
            onClick={() => collapsed ? setActivePage('masters-customers') : setMastersOpen(v => !v)}
            title={collapsed ? 'Masters' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: collapsed ? '9px 0' : '9px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: mastersActive ? 'rgba(43,125,233,0.18)' : 'transparent',
              color: mastersActive ? 'white' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: mastersActive ? 500 : 400,
              transition: 'background 0.15s, color 0.15s', marginBottom: 1,
            }}
            onMouseEnter={e => { if (!mastersActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white' } }}
            onMouseLeave={e => { if (!mastersActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' } }}
          >
            <svg style={{ width: 17, height: 17, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            {!collapsed && (
              <>
                <span style={{ flex: 1 }}>Masters</span>
                <svg style={{ width: 11, height: 11, transition: 'transform 0.2s', transform: mastersOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>

          {/* Masters sub-items */}
          {!collapsed && mastersOpen && MASTERS_SUB.map(item => (
            <SidebarNavBtn
              key={item.id}
              {...item}
              active={activePage === item.id}
              collapsed={false}
              indent
              onClick={() => setActivePage(item.id)}
            />
          ))}
        </nav>

        {/* Bottom: user + collapse toggle */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px' }}>

          {/* User menu */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              title={collapsed ? currentUser?.name : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: collapsed ? '8px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: showUserMenu ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!showUserMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {currentUser?.name?.charAt(0)}
              </div>
              {!collapsed && (
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: 12, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.name}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>{currentUser?.role}</p>
                </div>
              )}
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute', bottom: '100%',
                left: collapsed ? 70 : 0,
                marginBottom: 8,
                background: 'white', borderRadius: 12,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb', width: 204, overflow: 'hidden', zIndex: 9999,
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>{currentUser?.name}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{companyShort}</p>
                </div>
                {[
                  { label: 'My Profile', onClick: () => { setShowUserMenu(false); setShowProfile(true) },
                    icon: <svg style={{ width: 14, height: 14, color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
                  { label: 'Change Password', onClick: () => { setShowUserMenu(false); onChangePassword() },
                    icon: <svg style={{ width: 14, height: 14, color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> },
                ].map(({ label, onClick, icon }) => (
                  <button key={label} onClick={onClick} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '9px 14px', background: 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left',
                    transition: 'background 0.12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {icon}{label}
                  </button>
                ))}
                <div style={{ margin: '0 12px', borderTop: '1px solid #f3f4f6' }} />
                <button onClick={onLogout} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 14px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '7px 0',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.25)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
          >
            {theme === 'dark' ? (
              /* Sun */
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              /* Moon */
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '7px 0', marginTop: 4,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'rgba(255,255,255,0.25)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
          >
            <svg style={{ width: 14, height: 14, transition: 'transform 0.22s', transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: theme === 'dark' ? '#070e1b' : '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
        {activePage === 'dashboard'     && <DashboardPage currentUser={currentUser} company={selectedCompany} setActivePage={setActivePage} />}
        {activePage === 'inquiries'     && <Inquiries company={selectedCompany} currentUser={currentUser} prefillCustomer={inquiryPrefill} onClearPrefill={() => setInquiryPrefill(null)} />}
        {(activePage === 'masters' || activePage.startsWith('masters-')) && <Masters company={selectedCompany} currentUser={currentUser} isAdmin={isAdmin} initialTab={activePage.startsWith('masters-') ? activePage.slice(8) : 'customers'} onAddInquiry={(customerName) => { setInquiryPrefill({ customer: customerName }); setActivePage('inquiries') }} />}
        {activePage === 'admin'         && isAdmin && <AdminModule company={selectedCompany} currentUser={currentUser} />}
        {activePage === 'erp-estimates' && <Estimates company={selectedCompany} currentUser={currentUser} />}
        {activePage === 'wms' && (
          <div style={{ padding: 32 }}>
            <h1 className="text-gray-900" style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>WMS</h1>
            <p className="text-gray-500">Coming soon…</p>
          </div>
        )}
      </main>

      {showProfile && (
        <MyProfileModal currentUser={currentUser} selectedCompany={selectedCompany}
          onClose={() => setShowProfile(false)} onNameUpdate={setCurrentUser} />
      )}

      <FeedbackWidget currentUser={currentUser} company={selectedCompany} theme={theme} />

      {/* ── Notification Bell ── */}
      <div ref={notifRef} style={{ position: 'fixed', top: 14, right: 16, zIndex: 10000 }}>
        <button
          onClick={() => setShowNotifications(v => !v)}
          style={{
            position: 'relative',
            width: 36, height: 36,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: showNotifications ? 'rgba(255,255,255,0.15)' : 'rgba(10,22,40,0.85)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.8)',
            transition: 'background 0.15s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={e => { if (!showNotifications) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
          onMouseLeave={e => { if (!showNotifications) e.currentTarget.style.background = 'rgba(10,22,40,0.85)' }}
          title="Notifications"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#ef4444', color: 'white',
              fontSize: 9, fontWeight: 700,
              minWidth: 16, height: 16, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
              border: '1.5px solid white',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <div style={{
            position: 'absolute', top: 44, right: 0,
            width: 320,
            background: 'white',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  No notifications yet
                </div>
              ) : notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => onMarkOneRead(n.id)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #f9fafb',
                    background: n.is_read ? 'white' : '#eff6ff',
                    cursor: n.is_read ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    transition: 'background 0.12s',
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: n.is_read ? '#d1d5db' : '#3b82f6',
                    flexShrink: 0, marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: '#111827', margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
