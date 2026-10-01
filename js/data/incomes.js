import { monthEnd } from '../core/format.js';
import { cachedRead } from '../core/offline.js';
import { supabase, unwrap } from '../core/supabase.js';
import { deleteRow } from './crud.js';

export function listIncomes(month) {
  return cachedRead(`incomes:${month}`, async () => unwrap(await supabase.from('incomes')
    .select('id, received_on, amount, category_id, payment_method_id, description')
    .gte('received_on', month)
    .lte('received_on', monthEnd(month))
    .order('received_on', { ascending: false })
    .order('created_at', { ascending: false })));
}

export async function saveIncome(income) {
  return unwrap(await supabase.from('incomes').upsert(income).select().single());
}

export function deleteIncome(id) {
  return deleteRow('incomes', id);
}
