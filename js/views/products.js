import { fill, h } from '../core/dom.js';
import { dateToTime, formatDate, money, normalize, timeToISO, todayISO } from '../core/format.js';
import { categoryTree, listCategories } from '../data/categories.js';
import {
  addProductPrice, createProduct, deleteProduct, deleteProductPrice, getProductPrices, listAllProducts, updateProduct,
} from '../data/products.js';
import { listStores } from '../data/stores.js';
import { listUnits, priceFor, sameUnit, unitRule } from '../data/units.js';
import { categorySelect } from '../ui/category-select.js';
import { lineChart } from '../ui/chart.js';
import { field, selectInput, textInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { iconButton } from '../ui/list-row.js';
import { confirmRemoval, openFormModal, openModal } from '../ui/modal.js';
import { deltaBadge } from '../ui/stat.js';
import { toast } from '../ui/toast.js';

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

function priceText(product) {
  return product.last_price == null ? 'Sin precio' : `${money(product.last_price)} por ${product.ref_unit}`;
}

function storeStats(purchases, stores) {
  const groups = new Map();
  for (const entry of purchases) {
    const group = groups.get(entry.store_id) ?? { name: stores.find((store) => store.id === entry.store_id)?.name ?? 'Sin tienda', prices: [] };
    group.prices.push(entry.price);
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

export default async function products(root) {
  const [stores, units, categories] = await Promise.all([listStores(), listUnits(), listCategories()]);
  const tree = categoryTree(categories.filter((category) => !category.hidden), 'expense')
    .map((category) => ({ ...category, children: category.children.filter((child) => !child.hidden) }));
  const visible = new Set(tree.flatMap((category) => [category.id, ...category.children.map((child) => child.id)]));
  const search = textInput({ type: 'search', placeholder: 'Leche, pan, luz…', autocomplete: 'off' });
  const sort = selectInput(Object.entries(SORTS).map(([value, { label }]) => ({ value, label })), 'times');
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn btn--ghost history__more', type: 'button', hidden: true }, 'Ver más');
  let all = [];
  let shown = PAGE;

  const storeName = (id) => stores.find((store) => store.id === id)?.name;
  const unitNames = (current) => [...new Set([...units.filter((unit) => !unit.hidden).map((unit) => unit.name), current].filter(Boolean))];

  async function load() {
    all = (await listAllProducts()).map((product) => ({ ...product, key: normalize(product.name) }));
    render();
  }

  async function reopen(id) {
    await load();
    const fresh = all.find((product) => product.id === id);
    if (fresh) openDetail(fresh);
  }

  function editProduct(product) {
    const name = textInput({ required: true, maxLength: 80, autofocus: !product, value: product?.name ?? '' });
    const category = categorySelect(tree, visible.has(product?.category_id) ? product.category_id : null, { placeholder: 'Sin categoría', required: false });
    const unit = selectInput(unitNames(product?.unit).map((value) => ({ value, label: value })), product?.unit ?? 'pza');
    const price = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', placeholder: '0.00' });
    const priceLabel = document.createTextNode('');
    const hidden = h('input', { type: 'checkbox', checked: Boolean(product?.hidden) });
    const label = () => {
      priceLabel.textContent = `Precio por ${unitRule(units, unit.value).base} (opcional)`;
    };
    unit.addEventListener('change', label);
    label();

    openFormModal({
      title: product ? 'Editar producto' : 'Nuevo producto',
      body: [
        field('Nombre', name),
        h('div', { class: 'form__pair' }, field('Categoría', category), field('Unidad en que se compra', unit)),
        product ? h('label', { class: 'check' }, hidden, h('span', null, 'Ocultar: no aparece al capturar tickets ni listas')) : field(priceLabel, price),
        product?.times_bought ? h('p', { class: 'field__hint' }, 'Ya tiene compras: se puede ocultar, pero no eliminar, para conservar su historial.') : null,
      ],
      async onSubmit() {
        const values = { name: name.value.trim(), category_id: category.value || null, unit: unit.value };
        if (product) {
          await updateProduct(product.id, { ...values, hidden: hidden.checked });
        } else {
          const created = await createProduct(values);
          if (price.value !== '') {
            await addProductPrice({ product_id: created.id, noted_on: todayISO(), price: Number(price.value), unit: unitRule(units, unit.value).base });
          }
        }
        await load();
      },
      remove: product && !product.times_bought && {
        label: 'Eliminar producto',
        async run() {
          if (!await confirmRemoval(product.name, 'Se borra del catálogo junto con los precios que le anotaste.')) return false;
          await deleteProduct(product.id);
          await load();
          return true;
        },
      },
    });
  }

  function updatePrice(product) {
    const price = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', required: true, autofocus: true, placeholder: '0.00' });
    const date = textInput({ type: 'date', required: true, value: todayISO() });
    const store = selectInput([
      { value: '', label: 'Sin tienda' },
      ...stores.filter((row) => !row.hidden).map((row) => ({ value: row.id, label: row.name })),
    ], '');
    const note = textInput({ maxLength: 120 });
    openFormModal({
      title: `Precio de ${product.name}`,
      body: [
        field(`Precio por ${product.ref_unit}`, price, product.last_price == null ? 'Todavía no tiene precio.' : `Precio actual: ${priceText(product)}.`),
        h('div', { class: 'form__pair' }, field('Fecha', date), field('Tienda', store)),
        field('Nota', note, 'Opcional.'),
      ],
      async onSubmit() {
        await addProductPrice({
          product_id: product.id,
          noted_on: date.value,
          price: Number(price.value),
          unit: product.ref_unit,
          store_id: store.value || null,
          note: note.value.trim() || null,
        });
        await reopen(product.id);
      },
    });
  }

  function calculator(product) {
    const options = unitNames(product.unit).filter((name) => sameUnit(unitRule(units, name).base, product.ref_unit));
    const repeat = product.last_quantity && sameUnit(product.last_unit, product.unit);
    const quantity = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: 'any', value: repeat ? product.last_quantity : 1, 'aria-label': 'Cantidad' });
    const unit = selectInput(options.map((value) => ({ value, label: value })),
      options.find((name) => sameUnit(name, repeat ? product.unit : product.ref_unit)) ?? options[0], { 'aria-label': 'Unidad' });
    const result = h('strong', { class: 'calc__result money' });
    const refresh = () => {
      const amount = Number(quantity.value) > 0
        ? priceFor(product.last_price, Number(quantity.value), { ...unitRule(units, unit.value), mode: 'total' })
        : null;
      result.textContent = amount == null ? '—' : money(amount);
    };
    quantity.addEventListener('input', refresh);
    unit.addEventListener('change', refresh);
    refresh();
    return h('div', { class: 'calc' }, quantity, unit, h('span', { class: 'calc__equals' }, 'costaría'), result);
  }

  async function openDetail(product) {
    let prices;
    try {
      prices = await getProductPrices(product.id);
    } catch (error) {
      toast(`No se pudo abrir el producto: ${error.message}`, 'error');
      return;
    }
    const comparable = prices.filter((entry) => sameUnit(entry.unit, product.ref_unit));
    const byStore = storeStats(comparable.filter((entry) => entry.source === 'purchase'), stores);
    const chart = comparable.length > 1
      ? lineChart({
        label: `Precio de ${product.name} en el tiempo`,
        points: comparable.map((entry) => ({ x: dateToTime(entry.noted_on), y: entry.price })),
        formatX: (time) => formatDate(timeToISO(time)),
        formatY: (value) => money(value),
      })
      : null;

    const modal = openModal({
      title: product.name,
      body: h('div', { class: 'detail' },
        h('p', { class: 'detail__facts' }, [
          `Precio por ${product.ref_unit}`,
          product.times_bought ? `${timesLabel(product.times_bought)} · gastado ${money(product.total_spent)}` : 'Sin compras todavía',
        ].join(' · ')),
        h('div', { class: 'mini-stats' },
          tile('Actual', product.last_price == null ? '—' : money(product.last_price)),
          tile('Promedio', product.avg_price == null ? '—' : money(product.avg_price)),
          tile('Mínimo', product.min_price == null ? '—' : money(product.min_price)),
          tile('Máximo', product.max_price == null ? '—' : money(product.max_price))),
        product.last_price == null ? null : [
          h('h3', { class: 'detail__heading' }, '¿Cuánto costaría?'),
          calculator(product),
        ],
        h('h3', { class: 'detail__heading' }, 'Cambios de precio'),
        chart?.element ?? h('p', { class: 'detail__facts' }, 'Con un solo precio todavía no hay tendencia.'),
        h('ul', { class: 'detail__items' },
          [...prices].reverse().map((entry) => {
            const previous = comparable[comparable.indexOf(entry) - 1];
            const origin = entry.source === 'purchase'
              ? `Compra: ${entry.quantity} ${entry.bought_unit} por ${money(entry.amount)}`
              : 'Actualizado a mano';
            return h('li', { class: 'detail__item' },
              h('div', { class: 'row__text' },
                h('span', { class: 'row__title' }, `${money(entry.price)} por ${entry.unit}`, previous ? deltaBadge(entry.price, previous.price) : null),
                h('span', { class: 'row__subtitle' },
                  [formatDate(entry.noted_on), origin, storeName(entry.store_id), entry.note].filter(Boolean).join(' · '))),
              entry.source === 'manual' ? iconButton('trash-2', 'Eliminar este precio', async () => {
                if (!await confirmRemoval(`Precio de ${money(entry.price)}`, 'Se quita del historial de este producto.')) return;
                try {
                  await deleteProductPrice(entry.id);
                  modal.close();
                  await reopen(product.id);
                } catch (error) {
                  toast(error.message, 'error');
                }
              }) : null);
          })),
        byStore.length ? [
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
        ] : null),
      actions: [
        { label: 'Editar', value: 'edit' },
        { label: 'Actualizar precio', value: 'price', variant: 'primary' },
      ],
      onClose(action) {
        chart?.destroy();
        if (action === 'edit') editProduct(product);
        if (action === 'price') updatePrice(product);
      },
    });
  }

  function render() {
    const key = normalize(search.value);
    const { measure } = SORTS[sort.value];
    const rows = all.filter((product) => product.key.includes(key));
    if (sort.value === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else if (sort.value === 'recent') rows.sort((a, b) => (b.last_bought_on ?? '').localeCompare(a.last_bought_on ?? ''));
    else rows.sort((a, b) => measure(b) - measure(a));

    fill(list, rows.length ? rows.slice(0, shown).map((product) =>
      h('button', { class: 'list__item product', type: 'button', onclick: () => openDetail(product) },
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' }, product.name, product.hidden ? h('span', { class: 'tag' }, 'Oculto') : null),
          h('span', { class: 'row__subtitle' }, product.times_bought
            ? `${timesLabel(product.times_bought)} · gastado ${money(product.total_spent)} · última ${formatDate(product.last_bought_on)}`
            : 'Sin compras todavía')),
        h('div', { class: 'product__price' },
          h('strong', { class: 'money' }, product.last_price == null ? '—' : money(product.last_price)),
          h('span', { class: 'row__subtitle' }, `por ${product.ref_unit}`))))
      : h('p', { class: 'list__empty' }, all.length ? 'Ningún producto coincide con la búsqueda.' : 'Aquí aparecerán los productos de tus tickets.'));
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
    h('div', { class: 'toolbar' },
      h('p', { class: 'toolbar__hint' }, 'El precio de cada producto se actualiza solo con cada compra, o a mano cuando cambie.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => editProduct(null) }, icon('plus', 18), 'Nuevo producto')),
    h('div', { class: 'card products__controls' }, field('Buscar producto', search), field('Ordenar por', sort)),
    list,
    more);
  await load();
}
