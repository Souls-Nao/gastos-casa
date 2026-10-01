import { h } from '../core/dom.js';
import { tabs } from '../ui/tabs.js';
import month from './payments/month.js';
import msi from './payments/msi.js';
import recurring from './payments/recurring.js';

const TABS = [
  { value: 'mes', label: 'Pagos del mes', render: month },
  { value: 'fijos', label: 'Gastos fijos', render: recurring },
  { value: 'msi', label: 'Meses sin intereses', render: msi },
];

export default function payments(root, { query }) {
  const current = TABS.find((tab) => tab.value === query.get('tab')) ?? TABS[0];
  const panel = h('div', { class: 'view' });
  root.append(
    tabs(TABS.map((tab) => ({ ...tab, href: `#/pagos?tab=${tab.value}` })), current.value),
    panel);
  return current.render(panel);
}
