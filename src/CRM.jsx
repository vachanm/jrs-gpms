import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function CRM() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', status: 'Active', notes: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  async function saveCustomer() {
    if (!form.name) return alert('Name is required')
    if (editingCustomer) {
      await supabase.from('customers').update(form).eq('id', editingCustomer.id)
    } else {
      await supabase.from('customers').insert([form])
    }
    setShowForm(false)
    setEditingCustomer(null)
    setForm({ name: '', email: '', phone: '', company: '', status: 'Active', notes: '' })
    fetchCustomers()
  }

  async function deleteCustomer(id) {
    if (!confirm('Delete this customer?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  function editCustomer(customer) {
    setEditingCustomer(customer)
    setForm({ name: customer.name || '', email: customer.email || '', phone: customer.phone || '', company: customer.company || '', status: customer.status || 'Active', notes: customer.notes || '' })
    setShowForm(true)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500">Manage your customer relationships</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingCustomer(null); setForm({ name: '', email: '', phone: '', company: '', status: 'Active', notes: '' }) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Customer
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[['name', 'Name *'], ['email', 'Email'], ['phone', 'Phone'], ['company', 'Company']].map(([key, label]) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-600">{label}</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={label}
                  />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Lead</option>
                  <option>Prospect</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Notes</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveCustomer} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium">
                {editingCustomer ? 'Update' : 'Save Customer'}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 border py-2 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading customers...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No customers yet. Add your first one!</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Company', 'Email', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-sm font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.company || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.status === 'Active' ? 'bg-green-100 text-green-700' :
                      c.status === 'Lead' ? 'bg-yellow-100 text-yellow-700' :
                      c.status === 'Prospect' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => editCustomer(c)} className="text-blue-600 hover:underline text-sm mr-3">Edit</button>
                    <button onClick={() => deleteCustomer(c.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}