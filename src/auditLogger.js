import { supabase } from './supabase'

const ADMIN_USERS = ['Mahendra Sannappa', 'Pratik Shah', 'Sanket Patel', 'Sachin Shah']

export async function logActivity({ actor, company, module, action, recordId, recordLabel, details }) {
  try {
    if (!actor?.name || ADMIN_USERS.includes(actor.name)) return
    await supabase.from('audit_logs').insert([{
      actor_name:   actor.name,
      actor_role:   actor.role || 'employee',
      company:      company || 'Unknown',
      module,
      action,
      record_id:    recordId ? String(recordId) : null,
      record_label: recordLabel || null,
      details:      details || {},
    }])
  } catch (_) {
    // never block the main flow
  }
}
