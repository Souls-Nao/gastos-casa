import { supabase, unwrap } from '../core/supabase.js';

function translate(error) {
  return error.code === '23505' ? new Error('Ya existe un registro con ese nombre.') : error;
}

export async function listRows(table, ...orderBy) {
  let query = supabase.from(table).select('*');
  for (const column of orderBy) query = query.order(column);
  return unwrap(await query);
}

export async function insertRow(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select().single();
  if (error) throw translate(error);
  return data;
}

export async function updateRow(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single();
  if (error) throw translate(error);
  return data;
}

export function nextOrder(rows) {
  return rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
}
