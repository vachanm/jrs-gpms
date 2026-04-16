import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Inquiries from './Inquiries'
import Masters from './Masters'
import { supabase } from './supabase'

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
  const [page, setPage]                   = useState('login')
  const [activePage, setActivePage]       = useState('dashboard')
  const [currentUser, setCurrentUser]     = useState(null)
  const [selectedCompany, setSelectedCompany] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)

  if (page === 'login') {
    return (
      <LoginPage
        onLogin={(user, company) => {
          setCurrentUser(user)
          setSelectedCompany(company)
          setPage('dashboard')
        }}
      />
    )
  }

  return (
    <>
      <Dashboard
        activePage={activePage}
        setActivePage={setActivePage}
        currentUser={currentUser}
        selectedCompany={selectedCompany}
        onCompanyChange={setSelectedCompany}
        onLogout={() => { setPage('login'); setCurrentUser(null); setSelectedCompany('') }}
        onChangePassword={() => setShowChangePassword(true)}
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
function LoginPage({ onLogin }) {
  const [selectedCompany, setSelectedCompany] = useState('')
  const [users, setUsers]         = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    supabase.from('users').select('id, name, role').order('name').then(({ data }) => setUsers(data || []))
  }, [])

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

  const selectStyle = {
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

          {/* Company Selector */}
          <div className="mb-4">
            <label className="block text-blue-200 text-sm font-medium mb-1.5">Company</label>
            <select
              value={selectedCompany}
              onChange={e => { setSelectedCompany(e.target.value); setError('') }}
              className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ ...selectStyle, color: selectedCompany ? 'white' : 'rgba(255,255,255,0.4)' }}
            >
              <option value="" disabled style={{ background: '#0f1f3d' }}>Select company...</option>
              {COMPANIES.map(c => (
                <option key={c} value={c} style={{ background: '#0f1f3d', color: 'white' }}>{c}</option>
              ))}
            </select>
          </div>

          {/* User Account Selector */}
          <div className="mb-4">
            <label className="block text-blue-200 text-sm font-medium mb-1.5">User Account</label>
            <select
              value={selectedUser}
              onChange={e => { setSelectedUser(e.target.value); setError('') }}
              className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ ...selectStyle, color: selectedUser ? 'white' : 'rgba(255,255,255,0.4)' }}
            >
              <option value="" disabled style={{ background: '#0f1f3d' }}>Select your account...</option>
              {users.map(u => (
                <option key={u.id} value={u.name} style={{ background: '#0f1f3d', color: 'white' }}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-blue-200 text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={selectStyle}
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
            style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p className="text-center text-blue-500 text-xs mt-6">
          21 CFR Part 11 compliant · Electronic Signatures Required · All actions are audited
        </p>
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
          <div className="text-green-600 text-center py-4 font-medium">✅ Password changed successfully!</div>
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
function CompanyBadge({ selectedCompany, onCompanyChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const badgeRef        = useRef(null)

  const tag = selectedCompany.includes('India') ? 'INDIA'
    : selectedCompany.includes('BV') ? 'BV' : 'INC'

  function handleOpen(e) {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const rect = badgeRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={badgeRef}
        onClick={handleOpen}
        className="flex items-center gap-1 cursor-pointer"
        style={{
          background: 'rgba(74,222,128,0.2)',
          color: '#4ade80',
          border: '1px solid rgba(74,222,128,0.3)',
          fontSize: '9px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        {tag}
        <svg style={{ width: 8, height: 8, opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            background: 'rgba(15,31,61,0.97)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            minWidth: '220px',
            padding: '4px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}
        >
          {COMPANIES.map(c => (
            <button
              key={c}
              onClick={() => { onCompanyChange(c); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'white',
                background: c === selectedCompany ? 'rgba(255,255,255,0.1)' : 'transparent',
                cursor: 'pointer',
                border: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (c !== selectedCompany) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { if (c !== selectedCompany) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ flex: 1 }}>{c}</span>
              {c === selectedCompany && (
                <svg style={{ width: 12, height: 12, color: '#4ade80', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function Dashboard({ activePage, setActivePage, currentUser, selectedCompany, onCompanyChange, onLogout, onChangePassword }) {
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inquiries', label: 'Inquiries' },
    { id: 'masters',   label: 'Masters'   },
    { id: 'erp',       label: 'ERP'       },
    { id: 'wms',       label: 'WMS'       },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f1f3d 100%)' }}>

      {/* ── Navbar wrapper ── */}
      <div style={{ padding: '8px 16px' }}>
        <div
          className="flex items-center gap-2"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '6px 16px',
            height: '48px',
          }}
        >
          {/* ── Logo area ── */}
          <div className="flex items-center gap-2 mr-4 shrink-0">
            <img src="/logoo-removebg-preview.png" alt="JRS" style={{ height: '26px', objectFit: 'contain' }} />
            <span className="font-bold text-white text-sm">GPMS</span>
            <CompanyBadge selectedCompany={selectedCompany} onCompanyChange={onCompanyChange} />
          </div>

          {/* ── Nav items ── */}
          <div className="flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                style={activePage === item.id ? {
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  fontSize: '13px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (activePage !== item.id) {
                    e.currentTarget.style.color = 'white'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  }
                }}
                onMouseLeave={e => {
                  if (activePage !== item.id) {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* ── User area ── */}
          <div className="ml-auto relative shrink-0">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: '#1d4ed8' }}>
                {currentUser?.name?.charAt(0)}
              </div>
              <div className="text-left">
                <p className="leading-none font-medium" style={{ color: 'white', fontSize: '12px' }}>{currentUser?.name}</p>
                <p className="leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>{currentUser?.role}</p>
              </div>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="rgba(255,255,255,0.4)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl w-48 py-1 z-50 border border-gray-100">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-800">{currentUser?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedCompany}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); onChangePassword() }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Change Password
                </button>
                <div className="mx-3 border-t border-gray-100" />
                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ background: '#f1f5f9', borderRadius: '12px 12px 0 0', minHeight: 'calc(100vh - 64px)', marginTop: '0' }}>
        {activePage === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-1 text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Welcome back, {currentUser?.name}!</p>
            <p className="text-sm text-gray-400 mt-1">{selectedCompany}</p>
          </div>
        )}
        {activePage === 'inquiries' && <Inquiries company={selectedCompany} currentUser={currentUser} />}
        {activePage === 'masters'   && <Masters   company={selectedCompany} />}
        {activePage === 'erp' && (
          <div className="p-8"><h1 className="text-2xl font-bold mb-2 text-gray-900">ERP</h1><p className="text-gray-500">Coming soon...</p></div>
        )}
        {activePage === 'wms' && (
          <div className="p-8"><h1 className="text-2xl font-bold mb-2 text-gray-900">WMS</h1><p className="text-gray-500">Coming soon...</p></div>
        )}
      </div>
    </div>
  )
}

export default App
