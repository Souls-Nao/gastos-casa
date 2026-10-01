import { h } from '../core/dom.js';
import { on } from '../core/events.js';
import { addMonths, dayLabel, money, monthStart, todayISO } from '../core/format.js';
import { getState, watch } from '../core/store.js';
import { getDailyTotals, getDayDetail } from '../data/calendar.js';
import { listCategories } from '../data/categories.js';
import { selectMonth } from '../data/months.js';
import { createCalendar } from '../ui/calendar.js';
import { categoryIcon } from '../ui/category-icon.js';
import { createMonthNav } from '../ui/month-nav.js';
import { ticketRow } from '../ui/ticket-row.js';
import { toast } from '../ui/toast.js';
import { openTicketDetail } from './ticket-detail.js';

const NO_CATEGORY = { id: null, name: 'Sin categoría', icon: 'circle-help', color: '#7D8794' };

function countLabel(count) {
  return count === 1 ? '1 ticket' : `${count} tickets`;
}

function breakdown(tickets, categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map();
  for (const item of tickets.flatMap((ticket) => ticket.ticket_items)) {
    const category = byId.get(item.category_id);
    const parent = (category?.parent_id ? byId.get(category.parent_id) : category) ?? NO_CATEGORY;
    const group = groups.get(parent.id) ?? { category: parent, total: 0, children: new Map() };
    group.total += item.net_amount;
    if (category?.parent_id) group.children.set(category.name, (group.children.get(category.name) ?? 0) + item.net_amount);
    groups.set(parent.id, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
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
    const [tickets, categories] = await Promise.all([getDayDetail(day), listCategories()]);
    if (day !== selected) return;
    const total = tickets.reduce((sum, ticket) => sum + ticket.total, 0);
    const groups = breakdown(tickets, categories);
    detail.replaceChildren(
      h('div', { class: 'day__header' },
        h('div', null,
          h('h2', { class: 'section-title' }, dayLabel(day)),
          h('span', { class: 'row__subtitle' }, tickets.length ? countLabel(tickets.length) : 'Sin compras este día')),
        h('strong', { class: 'day__total money' }, money(total))),
      ...(tickets.length ? [
        h('h3', { class: 'detail__heading' }, 'Por categoría'),
        h('div', { class: 'list' }, groups.map((group) => h('div', { class: 'day__category' },
          h('div', { class: 'row' },
            categoryIcon(group.category, 36),
            h('div', { class: 'row__text' },
              h('span', { class: 'row__title' }, group.category.name),
              h('span', { class: 'meter' },
                h('span', { class: 'meter__fill', style: `width:${Math.max(group.total / total * 100, 2)}%;background:${group.category.color}` }))),
            h('strong', { class: 'money' }, money(group.total))),
          [...group.children].map(([name, amount]) => h('div', { class: 'day__sub' },
            h('span', null, name), h('span', { class: 'money' }, money(amount))))))),
        h('h3', { class: 'detail__heading' }, 'Tickets'),
        h('div', { class: 'list' }, tickets.map((ticket) => ticketRow(ticket, openTicketDetail))),
        h('h3', { class: 'detail__heading' }, 'Artículos'),
        h('ul', { class: 'detail__items card day__items' },
          tickets.flatMap((ticket) => ticket.ticket_items).map((item) => h('li', { class: 'detail__item' },
            h('div', { class: 'row__text' },
              h('span', { class: 'row__title' }, item.name),
              h('span', { class: 'row__subtitle' },
                `${item.quantity} ${item.unit} × ${money(item.unit_price)} · ${categories.find((category) => category.id === item.category_id)?.name ?? 'Sin categoría'}`)),
            h('strong', { class: 'money' }, money(item.amount))))),
      ] : []));
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
