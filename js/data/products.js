import { cachedRead } from '../core/offline.js';
import { supabase, unwrap } from '../core/supabase.js';
import { deleteRow, insertRow, updateRow } from './crud.js';

export function listAllProducts() {
  return cachedRead('products', async () => unwrap(await supabase.from('v_product_stats')
    .select('*')
    .order('times_bought', { ascending: false })
    .order('name')));
}

export async function listProducts() {
  return (await listAllProducts()).filter((product) => !product.hidden);
}

export function getProductPrices(id) {
  return cachedRead(`product-prices:${id}`, async () => unwrap(await supabase.from('v_product_prices')
    .select('id, noted_on, price, unit, store_id, source, quantity, bought_unit, amount, note')
    .eq('product_id', id)
    .order('noted_on')
    .order('created_at')));
}

export function createProduct(values) {
  return insertRow('products', values);
}

export function updateProduct(id, values) {
  return updateRow('products', id, values);
}

export function deleteProduct(id) {
  return deleteRow('products', id);
}

export function addProductPrice(values) {
  return insertRow('product_prices', values);
}

export function deleteProductPrice(id) {
  return deleteRow('product_prices', id);
}
