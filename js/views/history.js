import { h } from '../core/dom.js';
import { tabs } from '../ui/tabs.js';
import products from './history/products.js';
import tickets from './history/tickets.js';

const TABS = [
  { value: 'tickets', label: 'Tickets', render: tickets },
  { value: 'productos', label: 'Productos', render: products },
];

export default function history(root, { query }) {
  const current = TABS.find((tab) => tab.value === query.get('tab')) ?? TABS[0];
  const panel = h('div', { class: 'view' });
  root.append(
    tabs(TABS.map((tab) => ({ ...tab, href: `#/historial?tab=${tab.value}` })), current.value),
    panel);
  return current.render(panel, query);
}
