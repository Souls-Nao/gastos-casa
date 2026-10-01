import { cachedRead } from '../core/offline.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';

export function listRows(table, ...orderBy) {
  return cachedRead(`rows:${table}`, async () => {
    let query = supabase.from(table).select('*');
    for (const column of orderBy) query = query.order(column);
    return unwrap(await query);
  });
}

export async function insertRow(table, values) {
  return unwrap(await supabase.from(table).insert(values).select().single());
}

export async function updateRow(table, id, values) {
  return unwrap(await supabase.from(table).update(values).eq('id', id).select().single());
}

export async function deleteRow(table, id) {
  unwrap(await supabase.from(table).delete().eq('id', id));
}

export function usageCount(table, id) {
  return rpc('catalog_usage', { p_table: table, p_id: id });
}

export function nextOrder(rows) {
  return rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
}
