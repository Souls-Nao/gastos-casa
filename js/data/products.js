import { supabase, unwrap } from '../core/supabase.js';

export async function listProducts() {
  return unwrap(await supabase.from('v_product_stats')
    .select('id, name, category_id, unit, last_price, times_bought')
    .eq('hidden', false)
    .order('times_bought', { ascending: false })
    .order('name'));
}
