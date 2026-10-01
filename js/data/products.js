import { cachedRead } from '../core/offline.js';
import { supabase, unwrap } from '../core/supabase.js';

export function listProducts() {
  return cachedRead('products', async () => unwrap(await supabase.from('v_product_stats')
    .select('*')
    .eq('hidden', false)
    .gt('times_bought', 0)
    .order('times_bought', { ascending: false })
    .order('name')));
}

export function getProductHistory(id) {
  return cachedRead(`product-history:${id}`, async () => unwrap(await supabase.from('v_item_history')
    .select('ticket_id, purchased_on, quantity, unit, unit_price, amount, store_id')
    .eq('product_id', id)
    .order('purchased_on')
    .order('purchased_at')));
}
