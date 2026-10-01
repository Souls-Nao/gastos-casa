import { h } from '../core/dom.js';
import { tabs } from '../ui/tabs.js';

const TABS = [
  { value: 'categorias', label: 'Categorías', load: () => import('./catalogs/categories.js') },
  { value: 'tiendas', label: 'Tiendas', load: () => import('./catalogs/stores.js') },
  { value: 'pagos', label: 'Métodos de pago', load: () => import('./catalogs/payment-methods.js') },
  { value: 'unidades', label: 'Unidades', load: () => import('./catalogs/units.js') },
];

export default async function catalogs(root, { query }) {
  const current = TABS.find((tab) => tab.value === query.get('tab')) ?? TABS[0];
  const panel = h('div', { class: 'view' });
  root.append(
    tabs(TABS.map((tab) => ({ ...tab, href: `#/catalogos?tab=${tab.value}` })), current.value),
    panel);
  const module = await current.load();
  await module.default(panel, query);
}
