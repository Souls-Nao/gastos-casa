import { h } from '../core/dom.js';
import { formatDate, money, monthLabel } from '../core/format.js';
import { navigate } from '../core/router.js';
import { listCategories } from '../data/categories.js';
import { listPaymentMethods } from '../data/payment-methods.js';
import { listStores } from '../data/stores.js';
import { getTicket, itemAmount, ticketTotals } from '../data/tickets.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

function line(label, value, strong = false) {
  return h('div', { class: strong ? 'detail__line detail__line--strong' : 'detail__line' },
    h('span', null, label),
    h('span', { class: 'money' }, value));
}

export async function openTicketDetail(id) {
  let ticket;
  let stores;
  let methods;
  let categories;
  try {
    [ticket, stores, methods, categories] = await Promise.all([getTicket(id), listStores(), listPaymentMethods(), listCategories()]);
  } catch (error) {
    toast(`No se pudo abrir el ticket: ${error.message}`, 'error');
    return;
  }
  const name = (rows, key) => rows.find((row) => row.id === key)?.name;
  const { subtotal, total } = ticketTotals(ticket);
  const facts = [
    [formatDate(ticket.purchased_on), ticket.purchased_at].filter(Boolean).join(' · '),
    name(methods, ticket.payment_method_id) ?? 'Sin método de pago',
    ticket.msi ? `${ticket.msi.months} meses sin intereses desde ${monthLabel(ticket.msi.first_month).toLowerCase()}` : null,
  ].filter(Boolean);

  openModal({
    title: name(stores, ticket.store_id) ?? 'Sin tienda',
    body: h('div', { class: 'detail' },
      h('p', { class: 'detail__facts' }, facts.join(' · ')),
      h('ul', { class: 'detail__items' },
        ticket.items.map((item) => h('li', { class: 'detail__item' },
          h('div', { class: 'row__text' },
            h('span', { class: 'row__title' }, item.name),
            h('span', { class: 'row__subtitle' },
              `${item.quantity} ${item.unit} × ${money(item.unit_price)} · ${name(categories, item.category_id) ?? 'Sin categoría'}`)),
          h('strong', { class: 'money' }, money(itemAmount(item)))))),
      ticket.discount ? [line('Subtotal', money(subtotal)), line('Descuento', `−${money(ticket.discount)}`)] : null,
      line('Total', money(total), true),
      ticket.note ? h('p', { class: 'detail__note' }, ticket.note) : null),
    actions: [
      { label: 'Repetir compra', value: `/ticket?repetir=${ticket.id}` },
      { label: 'Editar', value: `/ticket/${ticket.id}`, variant: 'primary' },
    ],
    onClose(path) {
      if (path) navigate(path);
    },
  });
}
