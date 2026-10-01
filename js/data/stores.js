import { insertRow, listRows, updateRow } from './crud.js';

export function listStores() {
  return listRows('stores', 'name');
}

export function createStore(name) {
  return insertRow('stores', { name });
}

export function updateStore(id, values) {
  return updateRow('stores', id, values);
}
