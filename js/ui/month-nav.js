import { h } from '../core/dom.js';
import { monthLabel } from '../core/format.js';
import { icon } from './icon.js';

export function createMonthNav(onShift) {
  const label = h('h2', { class: 'month-nav__label' });
  const element = h('div', { class: 'month-nav' },
    h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Mes anterior', onclick: () => onShift(-1) }, icon('chevron-left')),
    label,
    h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => onShift(1) }, icon('chevron-right')),
  );
  return {
    element,
    setMonth(month) {
      label.textContent = monthLabel(month);
    },
  };
}
