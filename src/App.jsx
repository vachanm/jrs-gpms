import { useState, useEffect, useRef } from 'react'
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
function Dashboard({ activePage, setActivePage, currentUser, selectedCompany, onLogout, onChangePassword }) {
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard'  },
    { id: 'inquiries',  label: 'Inquiries'  },
    { id: 'masters',    label: 'Masters'    },
    { id: 'erp',        label: 'ERP'        },
    { id: 'wms',        label: 'WMS'        },
  ]

  // Company badge color
  const companyTag = selectedCompany.includes('India') ? 'India'
    : selectedCompany.includes('BV') ? 'BV' : 'Inc'
  const tagColor = companyTag === 'India' ? 'bg-orange-500'
    : companyTag === 'BV' ? 'bg-purple-500' : 'bg-blue-400'

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-700 text-white px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2 mr-4">
          <img src="/logoo-removebg-preview.png" alt="JRS" style={{ height: '30px', objectFit: 'contain' }} />
          <div>
            <span className="font-bold text-sm">GPMS</span>
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-semibold ${tagColor}`}>{companyTag}</span>
          </div>
        </div>

        {navItems.map(item => (
          <span key={item.id} onClick={() => setActivePage(item.id)}
            className={`cursor-pointer px-3 py-1 rounded transition text-sm ${activePage === item.id ? 'bg-blue-500' : 'hover:text-blue-200'}`}>
            {item.label}
          </span>
        ))}

        <div className="ml-auto relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
              {currentUser?.name?.charAt(0)}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
              <p className="text-xs text-blue-300 leading-none mt-0.5">{currentUser?.role}</p>
            </div>
            <span className="text-blue-300 text-xs ml-1">▼</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg w-48 py-1 z-50">
              <button onClick={() => { setShowUserMenu(false); onChangePassword() }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                🔒 Change Password
              </button>
              <hr className="my-1" />
              <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>

      <div>
        {activePage === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
            <p className="text-gray-500">Welcome back, {currentUser?.name}!</p>
            <p className="text-sm text-gray-400 mt-1">{selectedCompany}</p>
          </div>
        )}
        {activePage === 'inquiries' && <Inquiries company={selectedCompany} currentUser={currentUser} />}
        {activePage === 'masters'   && <Masters   company={selectedCompany} />}
        {activePage === 'erp' && (
          <div className="p-8"><h1 className="text-2xl font-bold mb-2">ERP</h1><p className="text-gray-500">Coming soon...</p></div>
        )}
        {activePage === 'wms' && (
          <div className="p-8"><h1 className="text-2xl font-bold mb-2">WMS</h1><p className="text-gray-500">Coming soon...</p></div>
        )}
      </div>
    </div>
  )
}

export default App
