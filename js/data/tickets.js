import { cachedRead, isNetworkError, withTimeout } from '../core/offline.js';
import { getState } from '../core/store.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';
import { deleteRow } from './crud.js';
import { ensureMonth } from './months.js';
import { listPaymentMethods } from './payment-methods.js';
import { listStores } from './stores.js';
import { dropPending, enqueue, pendingOperations } from './sync.js';

const pendingKey = (id) => `ticket:${id}`;

function ticketTotal(ticket) {
  const subtotal = ticket.items.reduce((sum, item) => sum + Math.round((item.quantity * item.unit_price + Number.EPSILON) * 100) / 100, 0);
  return Math.max(subtotal - (ticket.discount || 0), 0);
}

export async function getTicket(id) {
  const pending = (await pendingOperations()).find((operation) => operation.key === pendingKey(id) && operation.type === 'save_ticket');
  if (pending) return pending.payload;
  const record = await cachedRead(`ticket:${id}`, async () => unwrap(await supabase.from('tickets')
    .select('id, purchased_on, purchased_at, store_id, payment_method_id, discount, note, ticket_items(id, name, category_id, quantity, unit, unit_price), msi_plans(months, first_month)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'ticket_items' })
    .single()));
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
  const [rows, operations] = await Promise.all([
    cachedRead(`tickets:${from}:${to}:${limit}`, async () => unwrap(await supabase.from('tickets')
      .select('id, purchased_on, total, stores(name), payment_methods(name), ticket_items(name), msi_plans(months)')
      .gte('purchased_on', from)
      .lte('purchased_on', to)
      .order('purchased_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit))),
    pendingOperations(),
  ]);
  const pending = new Set(operations.map((operation) => operation.key));
  return rows.filter((row) => !pending.has(pendingKey(row.id)));
}

export async function listPendingTickets() {
  const operations = (await pendingOperations()).filter((operation) => operation.type === 'save_ticket');
  if (!operations.length) return [];
  const [stores, methods] = await Promise.all([listStores(), listPaymentMethods()]);
  return operations.map(({ payload, error }) => ({
    id: payload.id,
    purchased_on: payload.purchased_on,
    total: ticketTotal(payload),
    stores: stores.find((store) => store.id === payload.store_id) ?? null,
    payment_methods: methods.find((method) => method.id === payload.payment_method_id) ?? null,
    ticket_items: payload.items,
    msi_plans: payload.msi,
    pending: error ? 'No se pudo enviar' : 'Pendiente de enviar',
  }));
}

export async function saveTicket(ticket) {
  try {
    await withTimeout(rpc('save_ticket', { p: ticket }));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueue(pendingKey(ticket.id), 'save_ticket', ticket);
    return false;
  }
  await dropPending(pendingKey(ticket.id));
  await ensureMonth(getState().month);
  return true;
}

export async function deleteTicket(id) {
  try {
    await withTimeout(deleteRow('tickets', id));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueue(pendingKey(id), 'delete_ticket', { id });
    return false;
  }
  await dropPending(pendingKey(id));
  await ensureMonth(getState().month);
  return true;
}
