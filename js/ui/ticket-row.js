import { h } from '../core/dom.js';
import { formatDate, money } from '../core/format.js';

function itemsSummary(items) {
  const names = items.slice(0, 2).map((item) => item.name).join(', ');
  return items.length > 2 ? `${names} y ${items.length - 2} más` : names;
}

export function ticketRow(ticket) {
  const plan = [ticket.msi_plans].flat()[0];
  return h('a', { class: 'list__item', href: `#/ticket/${ticket.id}` },
    h('div', { class: 'row__text' },
      h('span', { class: 'row__title' },
        ticket.stores?.name ?? 'Sin tienda',
        plan ? h('span', { class: 'tag' }, `${plan.months} MSI`) : null),
      h('span', { class: 'row__subtitle' },
        [formatDate(ticket.purchased_on), itemsSummary(ticket.ticket_items), ticket.payment_methods?.name].filter(Boolean).join(' · '))),
    h('strong', { class: 'money' }, money(ticket.total)));
}
