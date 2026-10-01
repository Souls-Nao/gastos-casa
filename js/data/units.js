import { insertRow, listRows, nextOrder, updateRow } from './crud.js';

export function listUnits() {
  return listRows('units', 'sort_order', 'name');
}

export async function createUnit(name) {
  return insertRow('units', { name, sort_order: nextOrder(await listUnits()) });
}

export function updateUnit(id, values) {
  return updateRow('units', id, values);
}
