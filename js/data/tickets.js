import { getState } from '../core/store.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';
import { deleteRow } from './crud.js';
import { ensureMonth } from './months.js';

export async function getTicket(id) {
  const record = unwrap(await supabase.from('tickets')
    .select('id, purchased_on, purchased_at, store_id, payment_method_id, discount, note, ticket_items(id, name, category_id, quantity, unit, unit_price), msi_plans(months, first_month)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'ticket_items' })
    .single());
  const plan = [record.msi_plans].flat()[0];
  return {
    id: record.id,
    purchased_on: record.purchased_on,
    purchased_at: record.purchased_at?.slice(0, 5) ?? null,
    store_id: record.store_id,
    payment_method_id: record.payment_method_id,
    discount: record.discount,
    note: record.note ?? '',
    items: record.ticket_items,
    msi: plan ? { months: plan.months, first_month: plan.first_month } : null,
  };
}

export async function listTickets({ from, to, limit }) {
  return unwrap(await supabase.from('tickets')
    .select('id, purchased_on, total, stores(name), payment_methods(name), ticket_items(name), msi_plans(months)')
    .gte('purchased_on', from)
    .lte('purchased_on', to)
    .order('purchased_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit));
}

export async function saveTicket(ticket) {
  await rpc('save_ticket', { p: ticket });
  await ensureMonth(getState().month);
}

export async function deleteTicket(id) {
  await deleteRow('tickets', id);
  await ensureMonth(getState().month);
}
