import { supabase } from './supabase'

export async function logActivity({ actor, company, module, action, recordId, recordLabel, details }) {
  try {
    if (!actor?.name) return
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
