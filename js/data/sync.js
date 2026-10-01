import { emit } from '../core/events.js';
import { isNetworkError, listOperations, putOperation, removeOperation } from '../core/offline.js';
import { getState } from '../core/store.js';
import { rpc } from '../core/supabase.js';
import { deleteRow } from './crud.js';
import { ensureMonth } from './months.js';
import { deleteTicketWithPhoto, uploadTicketPhoto } from './photos.js';

const executors = {
  save_ticket: (payload) => rpc('save_ticket', { p: payload }),
  delete_ticket: deleteTicketWithPhoto,
  upload_photo: uploadTicketPhoto,
  save_list: (payload) => rpc('save_shopping_list', { p: payload }),
  delete_list: (payload) => deleteRow('shopping_lists', payload.id),
};

let syncing = false;

export async function announce() {
  const operations = await listOperations();
  emit('sync:status', {
    online: navigator.onLine,
    syncing,
    pending: operations.length,
    failed: operations.filter((operation) => operation.error).length,
  });
}

export async function enqueue(key, type, payload) {
  await putOperation({ key, type, payload, queued_at: Date.now(), error: null });
  await announce();
}

export async function dropPending(key) {
  await removeOperation(key);
  await announce();
}

export function pendingOperations() {
  return listOperations();
}

export async function flush() {
  if (syncing || !navigator.onLine || !getState().user) {
    await announce();
    return;
  }
  syncing = true;
  await announce();
  let sent = 0;
  let rejected = 0;
  for (const operation of await listOperations()) {
    try {
      await executors[operation.type](operation.payload);
      await removeOperation(operation.key);
      sent++;
    } catch (error) {
      if (isNetworkError(error)) break;
      await putOperation({ ...operation, error: error.message });
      rejected++;
    }
  }
  syncing = false;
  if (sent) {
    await ensureMonth(getState().month);
    emit('sync:sent', sent);
  }
  if (sent || rejected) emit('data:changed');
  await announce();
}

window.addEventListener('online', flush);
window.addEventListener('offline', announce);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') flush();
});
