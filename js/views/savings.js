import { h } from '../core/dom.js';
import { tabs } from '../ui/tabs.js';
import goals from './savings/goals.js';
import reserve from './savings/reserve.js';

const TABS = [
  { value: 'metas', label: 'Metas de ahorro', render: goals },
  { value: 'reserva', label: 'Reserva', render: reserve },
];

export default function savings(root, { query }) {
  const current = TABS.find((tab) => tab.value === query.get('tab')) ?? TABS[0];
  const panel = h('div', { class: 'view' });
  root.append(
    tabs(TABS.map((tab) => ({ ...tab, href: `#/ahorro?tab=${tab.value}` })), current.value),
    panel);
  return current.render(panel);
}
