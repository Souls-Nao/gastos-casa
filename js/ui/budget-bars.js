import { h } from '../core/dom.js';

export function budgetBars({ spent, budget, previous, status, label }) {
  const scale = Math.max(spent, budget ?? 0, previous, 1);
  const width = (value) => `${Math.min(value / scale * 100, 100)}%`;
  return h('div', { class: 'bars', role: 'img', 'aria-label': label },
    h('div', { class: 'bars__track' },
      h('span', { class: 'bars__fill', 'data-status': status, style: `width:${width(spent)}` }),
      budget ? h('span', { class: 'bars__limit', style: `left:${width(budget)}` }) : null),
    h('div', { class: 'bars__track bars__track--previous' },
      h('span', { class: 'bars__fill bars__fill--previous', style: `width:${width(previous)}` })));
}

export function barsLegend() {
  return h('div', { class: 'legend', 'aria-hidden': 'true' },
    h('span', { class: 'legend__item' }, h('span', { class: 'legend__swatch' }), 'Gastado'),
    h('span', { class: 'legend__item' }, h('span', { class: 'legend__swatch legend__swatch--previous' }), 'Mes anterior'),
    h('span', { class: 'legend__item' }, h('span', { class: 'legend__limit' }), 'Presupuesto'));
}

export function statusMeter(value, total, status) {
  return h('span', { class: 'meter' },
    h('span', { class: 'meter__fill', 'data-status': status, style: `width:${total ? Math.min(value / total * 100, 100) : 0}%` }));
}
