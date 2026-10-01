let config = null;
let table = [];
let cleanup = null;
let token = 0;

function compile(route) {
  const keys = [];
  const pattern = route.path.replace(/:[^/]+/g, (key) => {
    keys.push(key.slice(1));
    return '([^/]+)';
  });
  return { route, keys, regex: new RegExp(`^${pattern}$`) };
}

function match(path) {
  for (const { route, keys, regex } of table) {
    const found = regex.exec(path);
    if (found) {
      const params = Object.fromEntries(keys.map((key, index) => [key, decodeURIComponent(found[index + 1])]));
      return { route, params };
    }
  }
  return null;
}

async function render() {
  const current = ++token;
  const [path, search = ''] = (location.hash.slice(1) || '/').split('?');
  const found = match(path);
  if (!found) {
    location.replace('#/');
    return;
  }
  cleanup?.();
  cleanup = null;
  const root = document.createElement('div');
  root.className = 'view';
  config.outlet.replaceChildren(root);
  window.scrollTo(0, 0);
  config.onNavigate(found.route);
  try {
    const module = await found.route.view();
    if (current !== token) return;
    const result = await module.default(root, { route: found.route, params: found.params, query: new URLSearchParams(search) });
    if (typeof result !== 'function') return;
    if (current === token) cleanup = result;
    else result();
  } catch (error) {
    if (current === token) config.onError(error, root);
  }
}

export function startRouter(options) {
  config = options;
  table = options.routes.map(compile);
  window.addEventListener('hashchange', render);
  render();
}

export function stopRouter() {
  if (!config) return;
  window.removeEventListener('hashchange', render);
  token++;
  cleanup?.();
  cleanup = null;
  config = null;
}
