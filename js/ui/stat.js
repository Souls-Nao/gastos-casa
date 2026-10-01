import { h } from '../core/dom.js';
import { icon } from './icon.js';

export function statTile({ label, value, hint, featured = false }) {
  return h('article', { class: featured ? 'stat stat--featured' : 'stat' },
    h('span', { class: 'stat__label' }, label),
    h('strong', { class: 'stat__value money' }, value),
    h('span', { class: 'stat__hint' }, hint));
}

export function deltaBadge(current, previous) {
  if (!previous) return null;
  const change = (current - previous) / previous * 100;
  const up = change > 0;
  if (Math.abs(change) < 0.5) return h('span', { class: 'delta' }, 'Igual');
  return h('span', { class: up ? 'delta delta--up' : 'delta delta--down' },
    icon(up ? 'arrow-up' : 'arrow-down', 14), `${Math.abs(change).toFixed(0)}%`);
}
