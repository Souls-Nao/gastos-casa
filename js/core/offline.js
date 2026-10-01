const TIMEOUT = 8000;
let opening = null;

export class OfflineError extends Error {
  constructor() {
    super('Sin conexión a internet.');
    this.offline = true;
  }
}

export function isNetworkError(error) {
  return Boolean(error?.offline) || !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(error?.message ?? '');
}

function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('gastos', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('cache');
      request.result.createObjectStore('outbox', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

async function run(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => setTimeout(() => reject(new OfflineError()), TIMEOUT)),
  ]);
}

export async function cachedRead(key, fetcher) {
  try {
    if (!navigator.onLine) throw new OfflineError();
    const value = await withTimeout(fetcher());
    await run('cache', 'readwrite', (store) => store.put(value, key));
    return value;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const cached = await run('cache', 'readonly', (store) => store.get(key));
    if (cached === undefined) throw new Error('Sin conexión y esta información aún no se ha guardado en el dispositivo.');
    return cached;
  }
}

export function putOperation(operation) {
  return run('outbox', 'readwrite', (store) => store.put(operation));
}

export function removeOperation(key) {
  return run('outbox', 'readwrite', (store) => store.delete(key));
}

export async function listOperations() {
  const operations = await run('outbox', 'readonly', (store) => store.getAll());
  return operations.sort((a, b) => a.queued_at - b.queued_at);
}

export async function clearOffline() {
  await run('cache', 'readwrite', (store) => store.clear());
  await run('outbox', 'readwrite', (store) => store.clear());
}
