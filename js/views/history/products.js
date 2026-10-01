import { h } from '../../core/dom.js';
import { dateToTime, formatDate, money, normalize, timeToISO } from '../../core/format.js';
import { getProductHistory, listProducts } from '../../data/products.js';
import { listStores } from '../../data/stores.js';
import { lineChart } from '../../ui/chart.js';
import { field, selectInput, textInput } from '../../ui/field.js';
import { openModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';

const PAGE = 60;
const SORTS = {
  times: { label: 'Más comprados', measure: (product) => product.times_bought },
  spent: { label: 'Mayor gasto', measure: (product) => product.total_spent },
  recent: { label: 'Compra más reciente' },
  name: { label: 'Nombre' },
};

function timesLabel(count) {
  return count === 1 ? '1 compra' : `${count} compras`;
}

function tile(label, value) {
  return h('div', { class: 'mini-stat' }, h('span', { class: 'mini-stat__label' }, label), h('strong', { class: 'money' }, value));
}

function storeStats(history, stores) {
  const groups = new Map();
  for (const entry of history) {
    const group = groups.get(entry.store_id) ?? { name: stores.find((store) => store.id === entry.store_id)?.name ?? 'Sin tienda', prices: [] };
    group.prices.push(entry.unit_price);
    groups.set(entry.store_id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      name: group.name,
      times: group.prices.length,
      average: group.prices.reduce((sum, price) => sum + price, 0) / group.prices.length,
      last: group.prices.at(-1),
    }))
    .sort((a, b) => a.average - b.average);
}

async function openProductDetail(product) {
  let history;
  let stores;
  try {
    [history, stores] = await Promise.all([getProductHistory(product.id), listStores()]);
  } catch (error) {
    toast(`No se pudo abrir el producto: ${error.message}`, 'error');
    return;
  }
  const byStore = storeStats(history, stores);
  const chart = history.length > 1
    ? lineChart({
      label: `Precio de ${product.name} en el tiempo`,
      points: history.map((entry) => ({ x: dateToTime(entry.purchased_on), y: entry.unit_price })),
      formatX: (time) => formatDate(timeToISO(time)),
      formatY: (value) => money(value),
    })
    : null;

  openModal({
    title: product.name,
    body: h('div', { class: 'detail' },
      h('div', { class: 'mini-stats' },
        tile('Último', money(product.last_price)),
        tile('Promedio', money(product.avg_price)),
        tile('Mínimo', money(product.min_price)),
        tile('Máximo', money(product.max_price))),
      h('h3', { class: 'detail__heading' }, `Precio por ${product.unit}`),
      chart?.element ?? h('p', { class: 'detail__facts' }, 'Con una sola compra todavía no hay tendencia de precio.'),
      h('h3', { class: 'detail__heading' }, 'Por tienda'),
      h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', null, 'Tienda'), h('th', { class: 'table__number' }, 'Compras'),
          h('th', { class: 'table__number' }, 'Promedio'), h('th', { class: 'table__number' }, 'Último'))),
        h('tbody', null, byStore.map((store, index) => h('tr', null,
          h('td', null, store.name, index === 0 && byStore.length > 1 ? h('span', { class: 'tag tag--good' }, 'Más barato') : null),
          h('td', { class: 'table__number' }, String(store.times)),
          h('td', { class: 'table__number' }, money(store.average)),
          h('td', { class: 'table__number' }, money(store.last)))))),
      h('h3', { class: 'detail__heading' }, 'Compras'),
      h('ul', { class: 'detail__items' },
        [...history].reverse().map((entry) => h('li', { class: 'detail__item' },
          h('div', { class: 'row__text' },
            h('span', { class: 'row__title' }, formatDate(entry.purchased_on)),
            h('span', { class: 'row__subtitle' },
              `${entry.quantity} ${entry.unit} × ${money(entry.unit_price)} · ${stores.find((store) => store.id === entry.store_id)?.name ?? 'Sin tienda'}`)),
          h('strong', { class: 'money' }, money(entry.amount)))))),
    onClose: () => chart?.destroy(),
  });
}

export default async function products(root) {
  const all = (await listProducts()).map((product) => ({ ...product, key: normalize(product.name) }));
  const search = textInput({ type: 'search', placeholder: 'Leche, pan, luz…', autocomplete: 'off' });
  const sort = selectInput(Object.entries(SORTS).map(([value, { label }]) => ({ value, label })), 'times');
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn btn--ghost history__more', type: 'button', hidden: true }, 'Ver más');
  let shown = PAGE;

  function render() {
    const key = normalize(search.value);
    const { measure } = SORTS[sort.value];
    const rows = all.filter((product) => product.key.includes(key));
    if (sort.value === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else if (sort.value === 'recent') rows.sort((a, b) => b.last_bought_on.localeCompare(a.last_bought_on));
    else rows.sort((a, b) => measure(b) - measure(a));
    const top = measure ? Math.max(...rows.map(measure), 0) : 0;

    list.replaceChildren(...(rows.length ? rows.slice(0, shown).map((product) =>
      h('button', { class: 'list__item product', type: 'button', onclick: () => openProductDetail(product) },
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' }, product.name),
          h('span', { class: 'row__subtitle' },
            `${timesLabel(product.times_bought)} · último ${money(product.last_price)} / ${product.unit} · ${formatDate(product.last_bought_on)}`),
          top ? h('span', { class: 'meter' }, h('span', { class: 'meter__fill', style: `width:${Math.max(measure(product) / top * 100, 2)}%` })) : null),
        h('strong', { class: 'money' }, money(product.total_spent))))
      : [h('p', { class: 'list__empty' }, all.length ? 'Ningún producto coincide con la búsqueda.' : 'Aquí aparecerán los productos de tus tickets.')]));
    more.hidden = rows.length <= shown;
  }

  search.addEventListener('input', () => {
    shown = PAGE;
    render();
  });
  sort.addEventListener('change', render);
  more.addEventListener('click', () => {
    shown += PAGE;
    render();
  });

  root.append(
    h('div', { class: 'card products__controls' }, field('Buscar producto', search), field('Ordenar por', sort)),
    list,
    more);
  render();
}
