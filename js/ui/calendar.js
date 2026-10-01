import { h } from '../core/dom.js';
import { compactMoney, dayLabel, money, monthEnd, weekdayIndex } from '../core/format.js';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const LEVELS = 4;

export function createCalendar(onSelect) {
  const grid = h('div', { class: 'calendar__grid' });
  const element = h('div', { class: 'calendar card' },
    h('div', { class: 'calendar__weekdays', 'aria-hidden': 'true' }, WEEKDAYS.map((day) => h('span', null, day))),
    grid,
    h('div', { class: 'calendar__legend', 'aria-hidden': 'true' },
      h('span', null, 'Menos'),
      Array.from({ length: LEVELS }, (_, index) => h('span', { class: 'calendar__swatch', 'data-level': index + 1 })),
      h('span', null, 'Más')));

  function render({ month, totals, selected, today }) {
    const days = Number(monthEnd(month).slice(8, 10));
    const ranked = [...new Set([...totals.values()].map((entry) => entry.total).filter(Boolean))].sort((a, b) => a - b);
    const cells = Array.from({ length: weekdayIndex(month) }, () => h('span', { class: 'calendar__blank' }));
    for (let number = 1; number <= days; number++) {
      const day = `${month.slice(0, 8)}${String(number).padStart(2, '0')}`;
      const entry = totals.get(day);
      cells.push(h('button', {
        class: 'calendar__day',
        type: 'button',
        'data-level': entry?.total ? Math.ceil((ranked.indexOf(entry.total) + 1) / ranked.length * LEVELS) : null,
        'aria-pressed': String(day === selected),
        'aria-current': day === today ? 'date' : null,
        'aria-label': entry
          ? `${dayLabel(day)}: ${money(entry.total)}, ${entry.tickets === 1 ? '1 ticket' : `${entry.tickets} tickets`}`
          : `${dayLabel(day)}: sin compras`,
        onclick: () => onSelect(day),
      },
      h('span', { class: 'calendar__number' }, String(number)),
      entry ? h('span', { class: 'calendar__total money' }, compactMoney(entry.total)) : null));
    }
    grid.replaceChildren(...cells);
  }

  return { element, render };
}
