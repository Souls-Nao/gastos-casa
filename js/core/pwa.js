const CDN = 'https://cdn.jsdelivr.net/';
const CHECK_INTERVAL = 60000;
const UPDATE_KEY = 'gastos:update';
let installPrompt = null;
let lastCheck = 0;
let published = 0;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
});

export function canInstall() {
  return Boolean(installPrompt);
}

export async function install() {
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
}

export function needsManualInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return !standalone && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}

export async function updateAvailable() {
  if (Date.now() - lastCheck > CHECK_INTERVAL) {
    lastCheck = Date.now();
    try {
      const response = await fetch('index.html', { method: 'HEAD', cache: 'no-store' });
      published = Date.parse(response.headers.get('last-modified')) || 0;
    } catch {
      return false;
    }
  }
  return published - Date.parse(document.lastModified) > 1000 && sessionStorage.getItem(UPDATE_KEY) !== String(published);
}

export function applyUpdate() {
  sessionStorage.setItem(UPDATE_KEY, String(published));
  location.reload();
}

export async function cacheLoadedFiles() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const urls = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map((entry) => entry.name)]
    .filter((url) => url.startsWith(location.origin) || url.startsWith(CDN));
  registration.active.postMessage({ type: 'cache', urls: [...new Set(urls)] });
}
