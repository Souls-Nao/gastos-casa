import { h } from '../core/dom.js';
import { dayLabel, money } from '../core/format.js';
import { getDayDetail } from '../data/calendar.js';
import { listCategories } from '../data/categories.js';
import { categoryBreakdown } from '../data/dashboard.js';
import { itemSummary } from '../data/units.js';
import { categoryIcon } from '../ui/category-icon.js';
import { ticketRow } from '../ui/ticket-row.js';
import { openTicketDetail } from './ticket-detail.js';

export async function dayDetail(day) {
  const [tickets, categories] = await Promise.all([getDayDetail(day), listCategories()]);
  const items = tickets.flatMap((ticket) => ticket.ticket_items);
  const total = tickets.reduce((sum, ticket) => sum + ticket.total, 0);
  const header = h('div', { class: 'day__header' },
    h('div', null,
      h('h2', { class: 'section-title' }, dayLabel(day)),
      h('span', { class: 'row__subtitle' }, tickets.length
        ? (tickets.length === 1 ? '1 ticket' : `${tickets.length} tickets`)
        : 'Sin compras este día')),
    h('strong', { class: 'day__total money' }, money(total)));
  if (!tickets.length) return { total, nodes: [header] };

  return {
    total,
    nodes: [
      header,
      h('h3', { class: 'detail__heading' }, 'Por categoría'),
      h('div', { class: 'list' }, categoryBreakdown(items, categories).map((group) => h('div', { class: 'day__category' },
        h('div', { class: 'row row--padded' },
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
      h('ul', { class: 'detail__items card day__items' }, items.map((item) => h('li', { class: 'detail__item' },
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' }, item.name),
          h('span', { class: 'row__subtitle' },
            `${itemSummary(item)} · ${categories.find((category) => category.id === item.category_id)?.name ?? 'Sin categoría'}`)),
        h('strong', { class: 'money' }, money(item.amount))))),
    ],
  };
}
