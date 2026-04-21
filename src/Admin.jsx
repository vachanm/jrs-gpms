import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
    const day = String(d.getDate()).padStart(2, '0')
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
    return `${day}/${mon}/${d.getFullYear()}`
  } catch { return iso }
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

export default function AdminModule({ company }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [detail, setDetail]     = useState(null)
  const [toast, setToast]       = useState(null)

  function showToast(msg, type) { setToast({ message: msg, type: type || 'success' }) }

  useEffect(() => { fetchRequests() }, [company])

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

  async function handleApprove(req) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('customers_master')
      .update({ pending_approval: false, is_approved: true, approved_date: today })
      .eq('id', req.id)
    if (error) { showToast('Approval failed: ' + error.message, 'error'); return }
    showToast(`${req.name} approved`)
    fetchRequests()
  }

  async function handleReject(req) {
    const { error } = await supabase
      .from('customers_master')
      .delete()
      .eq('id', req.id)
    if (error) { showToast('Reject failed: ' + error.message, 'error'); return }
    showToast(`${req.name} rejected and removed`, 'error')
    fetchRequests()
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

      {/* Approval Requests Card */}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Customer Name', 'Customer Code', 'Country', 'Contact 1', 'Email 1', 'Submitted By', 'Submitted On', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
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
    </div>
  )
}
