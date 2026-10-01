import { onAuthChange, signOut } from './core/auth.js';
import { h } from './core/dom.js';
import { on } from './core/events.js';
import { formatDate, monthStart, todayISO } from './core/format.js';
import { clearOffline } from './core/offline.js';
import { cacheLoadedFiles, registerServiceWorker } from './core/pwa.js';
import { startRouter, stopRouter } from './core/router.js';
import { setState } from './core/store.js';
import { seedDefaults } from './data/account.js';
import { listCategories } from './data/categories.js';
import { ensureMonth } from './data/months.js';
import { listPaymentMethods } from './data/payment-methods.js';
import { listProducts } from './data/products.js';
import { listStores } from './data/stores.js';
import { flush, pendingOperations } from './data/sync.js';
import { listUnits } from './data/units.js';
import { sections } from './sections.js';
import { confirmDialog } from './ui/modal.js';
import { createShell } from './ui/shell.js';
import { toast } from './ui/toast.js';
import login from './views/login.js';

const app = document.getElementById('app');
let currentUserId;
let shell = null;

async function prepareOffline() {
  await Promise.allSettled([
    ...sections.map((section) => section.view()),
    listStores(), listPaymentMethods(), listCategories(), listUnits(), listProducts(),
  ]);
  await cacheLoadedFiles();
}

async function enter(user) {
  const today = todayISO();
  setState({ user, month: monthStart(today) });
  try {
    await seedDefaults();
    await ensureMonth(today);
  } catch (error) {
    toast(`No se pudo preparar el mes: ${error.message}`, 'error');
  }
  if (currentUserId !== user.id) return;
  shell = createShell({ sections, email: user.email, date: formatDate(today) });
  app.replaceChildren(shell.element);
  startRouter({
    routes: sections,
    outlet: shell.outlet,
    onNavigate: shell.setActive,
    onError(error, root) {
      root.replaceChildren(h('p', { class: 'empty__text' }, 'No se pudo abrir esta sección.'));
      toast(error.message, 'error');
    },
  });
  flush();
  if (navigator.onLine) prepareOffline();
}

function leave() {
  stopRouter();
  shell = null;
  setState({ user: null, month: null });
  document.title = 'Gastos de Casa';
  login(app);
}

onAuthChange((user) => {
  const id = user?.id ?? null;
  if (id === currentUserId) return;
  currentUserId = id;
  if (user) enter(user);
  else leave();
});

on('sync:status', (status) => shell?.setStatus(status));

on('sync:sent', (count) => {
  toast(count === 1 ? 'Se envió 1 cambio pendiente.' : `Se enviaron ${count} cambios pendientes.`);
});

on('auth:logout', async () => {
  const pending = (await pendingOperations()).length;
  const confirmed = await confirmDialog({
    title: 'Cerrar sesión',
    message: pending
      ? `Hay ${pending === 1 ? '1 cambio' : `${pending} cambios`} sin enviar que se perderán si cierras sesión ahora.`
      : 'Tendrás que volver a escribir el correo y la contraseña en este dispositivo.',
    confirmLabel: 'Cerrar sesión',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await signOut();
    await clearOffline();
    toast('Sesión cerrada.');
  } catch (error) {
    toast(`No se pudo cerrar la sesión: ${error.message}`, 'error');
  }
});

registerServiceWorker();
