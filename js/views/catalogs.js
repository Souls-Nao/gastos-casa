import { h } from '../core/dom.js';
import { tabs } from '../ui/tabs.js';
import categories from './catalogs/categories.js';
import paymentMethods from './catalogs/payment-methods.js';
import stores from './catalogs/stores.js';
import units from './catalogs/units.js';

const TABS = [
  { value: 'categorias', label: 'Categorías', render: categories },
  { value: 'tiendas', label: 'Tiendas', render: stores },
  { value: 'pagos', label: 'Métodos de pago', render: paymentMethods },
  { value: 'unidades', label: 'Unidades', render: units },
];

export default async function catalogs(root, { query }) {
  const current = TABS.find((tab) => tab.value === query.get('tab')) ?? TABS[0];
  const panel = h('div', { class: 'view' });
  root.append(
    tabs(TABS.map((tab) => ({ ...tab, href: `#/catalogos?tab=${tab.value}` })), current.value),
    panel);
  await current.render(panel, query);
}
