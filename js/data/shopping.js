import { cachedRead, isNetworkError, withTimeout } from '../core/offline.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';
import { deleteRow } from './crud.js';
import { dropPending, enqueue, pendingOperations } from './sync.js';

const pendingKey = (id) => `list:${id}`;

export async function listShoppingLists() {
  const [rows, operations] = await Promise.all([
    cachedRead('shopping-lists', async () => unwrap(await supabase.from('shopping_lists')
      .select('id, name, store_id, status, ticket_id, shopping_list_items(id, name, category_id, quantity, unit, unit_price, checked)')
      .eq('status', 'open')
      .order('created_at')
      .order('sort_order', { referencedTable: 'shopping_list_items' }))),
    pendingOperations(),
  ]);
  const lists = new Map(rows.map(({ shopping_list_items: items, ...list }) => [list.id, { ...list, items }]));
  for (const { type, payload } of operations) {
    if (type === 'delete_list' || (type === 'save_list' && payload.status !== 'open')) lists.delete(payload.id);
    else if (type === 'save_list') lists.set(payload.id, payload);
  }
  return [...lists.values()];
}

export async function saveShoppingList(list) {
  try {
    await withTimeout(rpc('save_shopping_list', { p: list }));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueue(pendingKey(list.id), 'save_list', list);
    return false;
  }
  await dropPending(pendingKey(list.id));
  return true;
}

export async function deleteShoppingList(id) {
  try {
    await withTimeout(deleteRow('shopping_lists', id));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueue(pendingKey(id), 'delete_list', { id });
    return false;
  }
  await dropPending(pendingKey(id));
  return true;
}

export function listTotals(list) {
  const amount = (item) => Math.round((item.quantity || 0) * (item.unit_price || 0) * 100) / 100;
  return {
    estimated: list.items.reduce((sum, item) => sum + amount(item), 0),
    inCart: list.items.filter((item) => item.checked).reduce((sum, item) => sum + amount(item), 0),
    checked: list.items.filter((item) => item.checked).length,
  };
}

export function itemsToBuy(list) {
  const checked = list.items.filter((item) => item.checked);
  return checked.length ? checked : list.items;
}

export function finishShoppingList(list, bought, ticketId) {
  const remaining = list.items.filter((item) => !bought.includes(item));
  return saveShoppingList(remaining.length
    ? { ...list, items: remaining }
    : { ...list, status: 'done', ticket_id: ticketId });
}
