import { supabase, unwrap } from '../core/supabase.js';
import { insertRow, listRows, updateRow } from './crud.js';

export function listCategories() {
  return listRows('categories', 'sort_order', 'name');
}

export function categoryTree(rows, kind) {
  return rows
    .filter((row) => row.kind === kind && !row.parent_id)
    .map((row) => ({ ...row, children: rows.filter((child) => child.parent_id === row.id) }));
}

export function createCategory(values) {
  return insertRow('categories', values);
}

export async function updateCategory(category, values) {
  const saved = await updateRow('categories', category.id, values);
  if (!category.parent_id && values.color && values.color !== category.color) {
    unwrap(await supabase.from('categories').update({ color: values.color }).eq('parent_id', category.id));
  }
  return saved;
}

export async function reorderCategories(ordered) {
  await Promise.all(ordered.map((category, index) =>
    category.sort_order === index + 1 ? null : updateRow('categories', category.id, { sort_order: index + 1 })));
}
