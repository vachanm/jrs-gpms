import { useState, useEffect, useRef } from 'react'
import CRM from './CRM'

const USERS = [
  { name: 'Devang Shah', role: 'Board Members / Management' },
  { name: 'Malathi Karkala', role: 'Board Members / Management' },
  { name: 'Pratik Shah', role: 'Managing Director' },
  { name: 'Mahendra Sannappa', role: 'Director – Clinical Trial Supply' },
  { name: 'Arundhati Yadav', role: 'Assistant Manager – Finance' },
  { name: 'Sachin Shah', role: 'Global Head – Quality Assurance' },
  { name: 'Mayur Patni', role: 'Manager – Operations and IT' },
  { name: 'Ved Nasit', role: 'Clinical Trial Specialist' },
  { name: 'Krishna Parikh', role: 'Operations Associate' },
  { name: 'Sanket Patel', role: 'Procurement Manager' },
  { name: 'Margi Shah', role: 'Manager – Quality Assurance' },
  { name: 'Divya Gadhiya', role: 'Quality Associate – Clinical Trial Supply' },
  { name: 'Jinay Patel', role: 'Clinical Trial Specialist' },
  { name: 'Drashti Savaliya', role: 'Clinical Trial Specialist' },
  { name: 'Aryan Jiyani', role: 'Clinical Trial Specialist' },
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
    }))
    let animId
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(147,197,253,${p.o})`
        ctx.fill()
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
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
  const [page, setPage] = useState('login')
  const [activePage, setActivePage] = useState('dashboard')
  const [currentUser, setCurrentUser] = useState(null)

  if (page === 'login') {
    return <LoginPage onLogin={(user) => { setCurrentUser(user); setPage('dashboard') }} />
  }

  return <Dashboard activePage={activePage} setActivePage={setActivePage} currentUser={currentUser} onLogout={() => setPage('login')} />
}

function LoginPage({ onLogin }) {
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleLogin() {
    if (!selectedUser) return setError('Please select your account.')
    if (!password) return setError('Please enter your password.')
    setLoading(true)
    setTimeout(() => {
      const user = USERS.find(u => u.name === selectedUser)
      setLoading(false)
      onLogin(user)
    }, 800)
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f1f3d 50%, #0d1b35 100%)' }}>
      <Particles />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 text-white font-bold text-xl px-4 py-2 rounded-xl">JRS</div>
          </div>
          <h1 className="text-white text-2xl font-bold">Jupiter Research Services</h1>
          <p className="text-blue-300 text-sm mt-1">Global Project Management System</p>
          <p className="text-blue-400 text-xs mt-1">GMP-Compliant Pharmaceutical ERP / CRM / WMS</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
          <h2 className="text-white text-2xl font-bold mb-1">Sign In</h2>
          <p className="text-blue-300 text-sm mb-6">Select your account and enter your password.</p>

          <div className="mb-4">
            <label className="block text-blue-200 text-sm font-medium mb-1.5">User Account</label>
            <select
              value={selectedUser}
              onChange={e => { setSelectedUser(e.target.value); setError('') }}
              className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: selectedUser ? 'white' : 'rgba(255,255,255,0.4)' }}
            >
              <option value="" disabled style={{ background: '#0f1f3d' }}>Select your account...</option>
              {USERS.map(u => (
                <option key={u.name} value={u.name} style={{ background: '#0f1f3d', color: 'white' }}>
                  {u.name} — {u.role}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-blue-200 text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
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

function Dashboard({ activePage, setActivePage, currentUser, onLogout }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'crm', label: 'CRM' },
    { id: 'erp', label: 'ERP' },
    { id: 'wms', label: 'WMS' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-700 text-white px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2 mr-4">
          <div className="bg-blue-500 text-white font-bold text-sm px-2 py-0.5 rounded">JRS</div>
          <span className="font-bold">GPMS</span>
        </div>
        {navItems.map(item => (
          <span
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`cursor-pointer px-3 py-1 rounded transition ${activePage === item.id ? 'bg-blue-500' : 'hover:text-blue-200'}`}
          >
            {item.label}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {currentUser && (
            <div className="text-right">
              <p className="text-sm font-medium">{currentUser.name}</p>
              <p className="text-xs text-blue-300">{currentUser.role}</p>
            </div>
          )}
          <button onClick={onLogout} className="text-blue-300 hover:text-white text-sm border border-blue-500 px-3 py-1 rounded transition">
            Sign Out
          </button>
        </div>
      </nav>

      <div>
        {activePage === 'dashboard' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-500">Welcome back, {currentUser?.name}!</p>
          </div>
        )}
        {activePage === 'crm' && <CRM />}
        {activePage === 'erp' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">ERP</h1>
            <p className="text-gray-500">Coming soon...</p>
          </div>
        )}
        {activePage === 'wms' && (
          <div className="p-8">
            <h1 className="text-2xl font-bold mb-2">WMS</h1>
            <p className="text-gray-500">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App