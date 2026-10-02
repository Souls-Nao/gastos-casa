import { cachedRead, isNetworkError, withTimeout } from '../core/offline.js';
import { getState } from '../core/store.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';
import { ensureMonth } from './months.js';
import { listPaymentMethods } from './payment-methods.js';
import { deleteTicketWithPhoto, removeTicketPhoto, uploadTicketPhoto } from './photos.js';
import { listStores } from './stores.js';
import { dropPending, enqueue, pendingOperations } from './sync.js';
import { itemAmount } from './units.js';

const pendingKey = (id) => `ticket:${id}`;
const photoKey = (id) => `photo:${id}`;

export function ticketTotals(ticket) {
  const subtotal = ticket.items.reduce((sum, item) => sum + itemAmount(item), 0);
  return { subtotal, total: Math.max(subtotal - (ticket.discount || 0), 0) };
}

export async function getTicket(id) {
  const pending = (await pendingOperations()).find((operation) => operation.key === pendingKey(id) && operation.type === 'save_ticket');
  if (pending) return pending.payload;
  const record = await cachedRead(`ticket:${id}`, async () => unwrap(await supabase.from('tickets')
    .select('id, purchased_on, purchased_at, store_id, payment_method_id, discount, note, photo_path, ticket_items(id, name, category_id, quantity, unit, unit_price, price_mode), msi_plans(months, first_month)')
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
    photo_path: record.photo_path,
    items: record.ticket_items,
    msi: plan ? { months: plan.months, first_month: plan.first_month } : null,
  };
}

export async function listTickets(filters) {
  const [found, operations] = await Promise.all([
    cachedRead(`tickets:${JSON.stringify(filters)}`, () => rpc('search_tickets', { p: filters })),
    pendingOperations(),
  ]);
  const pending = new Set(operations.map((operation) => operation.key));
  return { ...found, rows: found.rows.filter((row) => !pending.has(pendingKey(row.id))) };
}

export async function listPendingTickets() {
  const operations = (await pendingOperations()).filter((operation) => operation.type === 'save_ticket');
  if (!operations.length) return [];
  const [stores, methods] = await Promise.all([listStores(), listPaymentMethods()]);
  return operations.map(({ payload, error }) => ({
    id: payload.id,
    purchased_on: payload.purchased_on,
    total: ticketTotals(payload).total,
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

export async function deleteTicket(ticket) {
  const payload = { id: ticket.id, photo_path: ticket.photo_path };
  await dropPending(photoKey(ticket.id));
  try {
    await withTimeout(deleteTicketWithPhoto(payload));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueue(pendingKey(ticket.id), 'delete_ticket', payload);
    return false;
  }
  await dropPending(pendingKey(ticket.id));
  await ensureMonth(getState().month);
  return true;
}

export async function saveTicketPhoto(ticket, blob) {
  const payload = { id: ticket.id, blob, previousPath: ticket.photo_path };
  try {
    await withTimeout(uploadTicketPhoto(payload));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueue(photoKey(ticket.id), 'upload_photo', payload);
    return false;
  }
  await dropPending(photoKey(ticket.id));
  return true;
}

export async function clearTicketPhoto(ticket) {
  await dropPending(photoKey(ticket.id));
  if (ticket.photo_path) await removeTicketPhoto(ticket.id, ticket.photo_path);
}
