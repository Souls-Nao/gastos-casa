import { h } from '../core/dom.js';
import { on } from '../core/events.js';
import { addMonths, money, monthStart, todayISO } from '../core/format.js';
import { getState, watch } from '../core/store.js';
import { getDailyTotals } from '../data/calendar.js';
import { selectMonth } from '../data/months.js';
import { createCalendar } from '../ui/calendar.js';
import { createMonthNav } from '../ui/month-nav.js';
import { toast } from '../ui/toast.js';
import { dayDetail } from './day-detail.js';

function countLabel(count) {
  return count === 1 ? '1 ticket' : `${count} tickets`;
}

export default function calendar(root, { query }) {
  const today = todayISO();
  const summary = h('p', { class: 'history__summary' });
  const detail = h('section', { class: 'view day' });
  let selected = query.get('dia');

  const nav = createMonthNav(async (step) => {
    try {
      await selectMonth(addMonths(getState().month, step));
    } catch (error) {
      toast(`No se pudo abrir el mes: ${error.message}`, 'error');
    }
  });

  const grid = createCalendar((day) => {
    selected = day;
    history.replaceState(null, '', `#/calendario?dia=${day}`);
    load(getState().month);
  });

  async function showDay(day) {
    const { nodes } = await dayDetail(day);
    if (day === selected) detail.replaceChildren(...nodes);
  }

  async function load(month) {
    nav.setMonth(month);
    if (selected && monthStart(selected) !== month) selected = null;
    selected ??= monthStart(today) === month ? today : null;
    try {
      const rows = await getDailyTotals(month);
      if (month !== getState().month) return;
      const totals = new Map(rows.map((row) => [row.day, row]));
      summary.replaceChildren(
        h('span', null, countLabel(rows.reduce((sum, row) => sum + row.tickets, 0))),
        h('strong', { class: 'money' }, money(rows.reduce((sum, row) => sum + row.total, 0))));
      grid.render({ month, totals, selected, today });
      if (selected) await showDay(selected);
      else detail.replaceChildren(h('p', { class: 'list__empty' }, 'Toca un día para ver qué se compró.'));
    } catch (error) {
      toast(`No se pudo cargar el calendario: ${error.message}`, 'error');
    }
  }

  root.append(h('div', { class: 'calendar-view' },
    h('div', { class: 'view' }, nav.element, summary, grid.element),
    detail));
  load(getState().month);
  const stopMonth = watch('month', load);
  const stopData = on('data:changed', () => load(getState().month));
  return () => {
    stopMonth();
    stopData();
  };
}
