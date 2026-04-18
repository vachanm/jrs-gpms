import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Inquiries from './Inquiries'
import Masters from './Masters'
import Estimates from './Estimates'
import DashboardPage from './Dashboard'
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
  const [activePage, setActivePage]       = useState('dashboard')
  const [showChangePassword, setShowChangePassword] = useState(false)

  // Restore session from localStorage on first load
  const savedUser    = (() => { try { return JSON.parse(localStorage.getItem('jrs_user'))    } catch { return null } })()
  const savedCompany = (() => { try { return JSON.parse(localStorage.getItem('jrs_company')) } catch { return null } })()

  const [currentUser, setCurrentUser]         = useState(savedUser)
  const [selectedCompany, setSelectedCompany] = useState(savedCompany || '')

  const isLoggedIn = !!(currentUser && selectedCompany)

  function handleLogin(user, company) {
    localStorage.setItem('jrs_user',    JSON.stringify(user))
    localStorage.setItem('jrs_company', JSON.stringify(company))
    setCurrentUser(user)
    setSelectedCompany(company)
  }

  function handleLogout() {
    localStorage.removeItem('jrs_user')
    localStorage.removeItem('jrs_company')
    setCurrentUser(null)
    setSelectedCompany('')
  }

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

// ── Sidebar nav button ────────────────────────────────────────────────────────
function SidebarNavBtn({ label, icon, comingSoon, active, collapsed, indent, onClick }) {
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
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? 'white' : 'rgba(255,255,255,0.5)',
        fontSize: indent ? 12 : 13,
        fontWeight: active ? 500 : 400,
        transition: 'background 0.15s, color 0.15s',
        marginBottom: 1,
        textAlign: 'left',
      }}
      onMouseEnter={e => { if (!active && !comingSoon) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'white' : 'rgba(255,255,255,0.5)' } }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
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

function Dashboard({ activePage, setActivePage, currentUser, setCurrentUser, selectedCompany, onCompanyChange, onLogout, onChangePassword }) {
  const [collapsed, setCollapsed]             = useState(false)
  const [showProfile, setShowProfile]         = useState(false)
  const [showUserMenu, setShowUserMenu]       = useState(false)
  const [erpOpen, setErpOpen]                 = useState(activePage.startsWith('erp-'))
  const [showCompanyPicker, setShowCompanyPicker] = useState(false)
  const userMenuRef   = useRef(null)
  const companyRef    = useRef(null)

  useEffect(() => {
    if (!showUserMenu) return
    const fn = e => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showUserMenu])

  useEffect(() => {
    if (!showCompanyPicker) return
    const fn = e => { if (companyRef.current && !companyRef.current.contains(e.target)) setShowCompanyPicker(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showCompanyPicker])

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
      id: 'masters', label: 'Masters',
      icon: <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    },
    {
      id: 'wms', label: 'WMS', comingSoon: true,
      icon: <svg style={{ width: 17, height: 17 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" /></svg>,
    },
  ]

  const ERP_SUB = [
    {
      id: 'erp-estimates', label: 'Estimates',
      icon: <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
  ]

  const erpActive = activePage.startsWith('erp-')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: W, minWidth: W, maxWidth: W,
        background: '#0a1628',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.22s ease, min-width 0.22s ease, max-width 0.22s ease',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
        flexShrink: 0,
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
            onClick={() => setShowCompanyPicker(v => !v)}
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
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
            {!collapsed && (
              <>
                <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                  {companyShort}
                </span>
                <svg style={{ width: 11, height: 11, color: 'rgba(74,222,128,0.6)', flexShrink: 0, transition: 'transform 0.2s', transform: showCompanyPicker ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
            {collapsed && (
              <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, letterSpacing: '0.04em' }}>{companyTag}</span>
            )}
          </button>

          {showCompanyPicker && (
            <div style={{
              position: 'absolute',
              top: '100%', left: collapsed ? 70 : 8,
              zIndex: 9999,
              background: '#0d1b35',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, minWidth: 230, padding: 4,
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
                    <svg style={{ width: 12, height: 12, color: '#4ade80' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
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
              background: erpActive ? 'rgba(255,255,255,0.12)' : 'transparent',
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
      <main style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
        {activePage === 'dashboard'     && <DashboardPage currentUser={currentUser} company={selectedCompany} setActivePage={setActivePage} />}
        {activePage === 'inquiries'     && <Inquiries company={selectedCompany} currentUser={currentUser} />}
        {activePage === 'masters'       && <Masters company={selectedCompany} />}
        {activePage === 'erp-estimates' && <Estimates company={selectedCompany} currentUser={currentUser} />}
        {activePage === 'wms' && (
          <div style={{ padding: 32 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>WMS</h1>
            <p style={{ color: '#6b7280' }}>Coming soon…</p>
          </div>
        )}
      </main>

      {showProfile && (
        <MyProfileModal currentUser={currentUser} selectedCompany={selectedCompany}
          onClose={() => setShowProfile(false)} onNameUpdate={setCurrentUser} />
      )}
    </div>
  )
}

export default App
