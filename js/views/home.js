import { h } from '../core/dom.js';
import { tabs } from '../ui/tabs.js';
import day from './dashboard/day.js';
import general from './dashboard/general.js';
import month from './dashboard/month.js';

const TABS = [
  { value: 'general', label: 'General', render: general },
  { value: 'dia', label: 'Día', render: day },
  { value: 'mes', label: 'Mes', render: month },
];

export default function home(root, { query }) {
  const current = TABS.find((tab) => tab.value === query.get('vista')) ?? TABS[0];
  const panel = h('div', { class: 'view' });
  root.append(
    tabs(TABS.map((tab) => ({ ...tab, href: `#/?vista=${tab.value}` })), current.value),
    panel);
  return current.render(panel, query);
}
