import { deleteRow, insertRow, listRows, updateRow, usageCount } from './crud.js';

export function listStores() {
  return listRows('stores', 'name');
}

export function createStore(name) {
  return insertRow('stores', { name });
}

export function updateStore(id, values) {
  return updateRow('stores', id, values);
}

export function storeUsage(id) {
  return usageCount('stores', id);
}

export function deleteStore(id) {
  return deleteRow('stores', id);
}
