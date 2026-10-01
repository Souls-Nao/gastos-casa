import { h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { money, monthEnd } from '../../core/format.js';
import { navigate } from '../../core/router.js';
import { getState } from '../../core/store.js';
import { categoryTree, listCategories } from '../../data/categories.js';
import { listPaymentMethods } from '../../data/payment-methods.js';
import { listStores } from '../../data/stores.js';
import { listTickets } from '../../data/tickets.js';
import { categorySelect } from '../../ui/category-select.js';
import { field, selectInput, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { ticketRow } from '../../ui/ticket-row.js';
import { toast } from '../../ui/toast.js';
import { openTicketDetail } from '../ticket-detail.js';

const PAGE = 50;

function options(rows, all) {
  return [{ value: '', label: all }, ...rows.map((row) => ({ value: row.id, label: row.name }))];
}

export default async function tickets(root, query) {
  const month = getState().month;
  const filters = {
    from: query.has('desde') ? query.get('desde') : month,
    to: query.has('hasta') ? query.get('hasta') : monthEnd(month),
    category_id: query.get('categoria') ?? '',
    store_id: query.get('tienda') ?? '',
    payment_method_id: query.get('metodo') ?? '',
    text: query.get('q') ?? '',
  };
  const [stores, methods, categories] = await Promise.all([listStores(), listPaymentMethods(), listCategories()]);
  const active = ['category_id', 'store_id', 'payment_method_id', 'text'].filter((key) => filters[key]).length
    + (query.has('desde') || query.has('hasta') ? 1 : 0);

  const from = textInput({ type: 'date', value: filters.from });
  const to = textInput({ type: 'date', value: filters.to });
  const category = categorySelect(categoryTree(categories, 'expense'), filters.category_id, { placeholder: 'Todas las categorías', required: false });
  const store = selectInput(options(stores, 'Todas las tiendas'), filters.store_id);
  const method = selectInput(options(methods, 'Todos los métodos'), filters.payment_method_id);
  const text = textInput({ type: 'search', placeholder: 'Artículo, tienda o nota', enterKeyHint: 'search', value: filters.text });

  function apply() {
    const params = new URLSearchParams({ desde: from.value, hasta: to.value });
    if (category.value) params.set('categoria', category.value);
    if (store.value) params.set('tienda', store.value);
    if (method.value) params.set('metodo', method.value);
    if (text.value.trim()) params.set('q', text.value.trim());
    navigate(`/historial?${params}`);
  }

  for (const control of [from, to, category, store, method]) control.addEventListener('change', apply);

  const summary = h('p', { class: 'history__summary' });
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn btn--ghost history__more', type: 'button', hidden: true, onclick: () => loadPage() }, 'Ver más');
  let offset = 0;

  async function loadPage() {
    try {
      const found = await listTickets({ ...filters, limit: PAGE, offset });
      if (offset === 0) {
        summary.replaceChildren(
          h('span', null, found.count === 1 ? '1 ticket' : `${found.count} tickets`),
          h('strong', { class: 'money' }, money(found.total)));
        list.replaceChildren(...(found.count ? [] : [h('p', { class: 'list__empty' }, 'No hay tickets con estos filtros.')]));
      }
      list.append(...found.rows.map((ticket) => ticketRow(ticket, openTicketDetail)));
      offset += PAGE;
      more.hidden = offset >= found.count;
    } catch (error) {
      toast(`No se pudieron cargar los tickets: ${error.message}`, 'error');
    }
  }

  root.append(
    h('details', { class: 'card filters', open: active > 0 || innerWidth >= 900 },
      h('summary', { class: 'filters__summary' },
        icon('sliders-horizontal', 18),
        h('span', null, 'Filtros'),
        active ? h('span', { class: 'tag' }, String(active)) : null),
      h('form', {
        class: 'filters__form',
        onsubmit(event) {
          event.preventDefault();
          apply();
        },
      },
      field('Desde', from),
      field('Hasta', to),
      field('Categoría', category),
      field('Tienda', store),
      field('Método de pago', method),
      field('Buscar', text),
      h('div', { class: 'filters__actions' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => navigate('/historial') }, 'Limpiar'),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Buscar')))),
    summary,
    list,
    more);

  await loadPage();
  return on('data:changed', () => {
    offset = 0;
    loadPage();
  });
}
