import { fill, h } from '../core/dom.js';
import { money, normalize } from '../core/format.js';
import { navigate } from '../core/router.js';
import { categoryTree, listCategories } from '../data/categories.js';
import { listProducts } from '../data/products.js';
import { deleteShoppingList, listShoppingLists, listTotals, saveShoppingList } from '../data/shopping.js';
import { listStores } from '../data/stores.js';
import { listUnits } from '../data/units.js';
import { autocomplete } from '../ui/autocomplete.js';
import { categorySelect } from '../ui/category-select.js';
import { field, selectInput, textInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { iconButton } from '../ui/list-row.js';
import { confirmRemoval, openFormModal, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

const SAVE_DELAY = 600;

function amount(item) {
  return (item.quantity || 0) * (item.unit_price || 0);
}

function describe(item) {
  return item.unit_price == null
    ? `${item.quantity} ${item.unit} · sin precio`
    : `${item.quantity} ${item.unit} × ${money(item.unit_price)}`;
}

export default async function shopping(root, { query }) {
  const [stores, categories, units, products] = await Promise.all([listStores(), listCategories(), listUnits(), listProducts()]);
  const tree = categoryTree(categories.filter((category) => !category.hidden), 'expense')
    .map((category) => ({ ...category, children: category.children.filter((child) => !child.hidden) }));
  const visible = new Set(tree.flatMap((category) => [category.id, ...category.children.map((child) => child.id)]));
  const catalog = products.map((product) => ({ ...product, key: normalize(product.name) }));
  const content = h('div', { class: 'view' });
  let lists = await listShoppingLists();
  let current = lists.find((list) => list.id === query.get('id')) ?? lists[0] ?? null;
  let expanded = null;
  let timer = null;

  for (const list of lists) {
    for (const item of list.items) {
      if (item.category_id && !categories.some((category) => category.id === item.category_id)) item.category_id = null;
    }
  }

  async function save() {
    clearTimeout(timer);
    timer = null;
    if (!current) return;
    try {
      await saveShoppingList(current);
    } catch (error) {
      toast(`No se pudo guardar la lista: ${error.message}`, 'error');
    }
  }

  function changed() {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY);
  }

  async function open(list) {
    if (timer) await save();
    current = list;
    expanded = null;
    history.replaceState(null, '', list ? `#/lista?id=${list.id}` : '#/lista');
    render();
  }

  function suggestions(text) {
    const key = normalize(text);
    if (!key) return [];
    const starts = catalog.filter((product) => product.key.startsWith(key));
    const contains = catalog.filter((product) => !product.key.startsWith(key) && product.key.includes(key));
    return [...starts, ...contains].slice(0, 6);
  }

  function addItem(name, known) {
    const key = normalize(name);
    if (!key) return;
    const product = known ?? catalog.find((entry) => entry.key === key);
    const existing = current.items.find((item) => normalize(item.name) === key);
    if (existing) {
      existing.quantity += 1;
      existing.checked = false;
    } else {
      current.items.push({
        id: crypto.randomUUID(),
        name: product?.name ?? name.trim(),
        category_id: visible.has(product?.category_id) ? product.category_id : null,
        quantity: 1,
        unit: product?.unit ?? 'pza',
        unit_price: product?.last_price ?? null,
        checked: false,
      });
    }
    changed();
    render();
  }

  function editList(list) {
    const name = textInput({ maxLength: 60, autofocus: !list, placeholder: 'Súper de la semana', value: list?.name ?? '' });
    const store = selectInput([
      { value: '', label: 'Sin tienda' },
      ...stores.filter((row) => !row.hidden || row.id === list?.store_id).map((row) => ({ value: row.id, label: row.name })),
    ], list?.store_id);
    openFormModal({
      title: list ? 'Editar lista' : 'Nueva lista',
      body: [field('Nombre', name, 'Si lo dejas vacío se usa el nombre de la tienda.'), field('Tienda', store)],
      async onSubmit() {
        const title = name.value.trim() || stores.find((row) => row.id === store.value)?.name || 'Lista de compras';
        if (list) {
          Object.assign(list, { name: title, store_id: store.value || null });
          await save();
          render();
          return;
        }
        const created = { id: crypto.randomUUID(), name: title, store_id: store.value || null, status: 'open', ticket_id: null, items: [] };
        lists.push(created);
        await open(created);
        await save();
      },
      remove: list && {
        label: 'Eliminar lista',
        async run() {
          if (!await confirmRemoval(list.name, list.items.length ? 'Se borra con todos sus artículos.' : 'Se borra la lista.')) return false;
          clearTimeout(timer);
          timer = null;
          await deleteShoppingList(list.id);
          lists = lists.filter((entry) => entry !== list);
          await open(lists[0] ?? null);
          return true;
        },
      },
    });
  }

  function pickFromHistory() {
    const search = textInput({ type: 'search', placeholder: 'Buscar producto', autocomplete: 'off' });
    const results = h('div', { class: 'list' });
    const show = () => {
      const key = normalize(search.value);
      const rows = catalog.filter((product) => product.key.includes(key)).slice(0, 40);
      fill(results, rows.length ? rows.map((product) => {
        const inList = current.items.find((item) => normalize(item.name) === product.key);
        return h('button', {
          class: 'list__item',
          type: 'button',
          onclick() {
            addItem(product.name, product);
            show();
          },
        },
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' }, product.name, inList ? h('span', { class: 'tag tag--good' }, `En la lista: ${inList.quantity}`) : null),
          h('span', { class: 'row__subtitle' }, `${money(product.last_price)} / ${product.unit} · ${product.times_bought === 1 ? '1 compra' : `${product.times_bought} compras`}`)),
        icon('plus', 20));
      }) : h('p', { class: 'list__empty' }, catalog.length ? 'Ningún producto coincide.' : 'Todavía no hay productos en tu historial.'));
    };
    search.addEventListener('input', show);
    show();
    openModal({ title: 'Agregar desde el historial', body: h('div', { class: 'detail' }, search, results) });
  }

  function itemRow(item, totals) {
    const subtitle = h('span', { class: 'row__subtitle' }, describe(item));
    const total = h('strong', { class: 'money' }, item.unit_price == null ? '—' : money(amount(item)));
    const check = h('input', { type: 'checkbox', checked: item.checked, 'aria-label': `Marcar ${item.name}` });
    check.addEventListener('change', () => {
      item.checked = check.checked;
      changed();
      render();
    });

    function update() {
      subtitle.textContent = describe(item);
      total.textContent = item.unit_price == null ? '—' : money(amount(item));
      totals();
      changed();
    }

    function editor() {
      const quantity = textInput({ type: 'number', inputMode: 'decimal', min: '0.001', step: 'any', value: item.quantity });
      const names = units.filter((unit) => !unit.hidden).map((unit) => unit.name);
      const unit = selectInput([...new Set([...names, item.unit])].map((name) => ({ value: name, label: name })), item.unit);
      const price = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', placeholder: '0.00', value: item.unit_price ?? '' });
      const category = categorySelect(tree, visible.has(item.category_id) ? item.category_id : null, { placeholder: 'Sin categoría', required: false });
      quantity.addEventListener('input', () => {
        item.quantity = Number(quantity.value) > 0 ? Number(quantity.value) : 1;
        update();
      });
      unit.addEventListener('change', () => {
        item.unit = unit.value;
        update();
      });
      price.addEventListener('input', () => {
        item.unit_price = price.value === '' ? null : Number(price.value);
        update();
      });
      category.addEventListener('change', () => {
        item.category_id = category.value || null;
        changed();
      });
      return h('div', { class: 'shop-item__editor' },
        field('Cantidad', quantity), field('Unidad', unit), field('Precio', price),
        h('div', { class: 'shop-item__category' }, field('Categoría', category)),
        iconButton('trash-2', 'Quitar de la lista', () => {
          current.items = current.items.filter((other) => other !== item);
          changed();
          render();
        }));
    }

    return h('div', { class: item.checked ? 'shop-item shop-item--checked' : 'shop-item' },
      h('label', { class: 'shop-item__check' }, check),
      h('button', {
        class: 'shop-item__main',
        type: 'button',
        'aria-expanded': String(expanded === item.id),
        onclick() {
          expanded = expanded === item.id ? null : item.id;
          render();
        },
      }, h('div', { class: 'row__text' }, h('span', { class: 'row__title' }, item.name), subtitle), total),
      expanded === item.id ? editor() : null);
  }

  function render() {
    if (!current) {
      fill(content,
        h('div', { class: 'list__empty card' },
          h('p', null, 'Arma tu lista antes de ir a la tienda y conviértela en ticket al terminar.'),
          h('button', { class: 'btn btn--primary shop__create', type: 'button', onclick: () => editList(null) }, icon('plus', 18), 'Crear lista')));
      return;
    }

    const input = textInput({ maxLength: 80, autocomplete: 'off', enterKeyHint: 'done', placeholder: 'Agregar artículo…' });
    const cart = h('span', { class: 'field__label' });
    const estimate = h('strong', { class: 'ticket__total money' });
    const convert = h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
      await save();
      navigate(`/ticket?lista=${current.id}`);
    } });

    function totals() {
      const sums = listTotals(current);
      cart.textContent = sums.checked ? `En el carrito: ${money(sums.inCart)} · estimado` : 'Total estimado';
      estimate.textContent = money(sums.estimated);
      convert.textContent = sums.checked ? `Convertir ${sums.checked} en ticket` : 'Convertir en ticket';
      convert.disabled = !current.items.length;
    }

    const store = stores.find((row) => row.id === current.store_id)?.name;
    const pending = current.items.filter((item) => !item.checked);
    const done = current.items.filter((item) => item.checked);

    fill(content,
      h('div', { class: 'tabs' },
        lists.map((list) => h('button', {
          class: 'tabs__item',
          type: 'button',
          'aria-current': list === current ? 'page' : null,
          onclick: () => open(list),
        }, list.name)),
        h('button', { class: 'tabs__item', type: 'button', onclick: () => editList(null) }, icon('plus', 16), 'Nueva lista')),
      h('div', { class: 'plan__header' },
        h('div', null,
          h('h2', { class: 'section-title' }, current.name),
          h('span', { class: 'row__subtitle' }, [store, current.items.length === 1 ? '1 artículo' : `${current.items.length} artículos`].filter(Boolean).join(' · '))),
        iconButton('pencil', 'Editar lista', () => editList(current))),
      h('form', {
        class: 'shop__add',
        onsubmit(event) {
          event.preventDefault();
          addItem(input.value);
          content.querySelector('.shop__add input').focus();
        },
      },
      autocomplete(input, {
        search: suggestions,
        render: (product) => [
          h('span', { class: 'autocomplete__name' }, product.name),
          h('span', { class: 'autocomplete__meta money' }, `${money(product.last_price)} / ${product.unit}`),
        ],
        onSelect: (product) => addItem(product.name, product),
      }),
      h('button', { class: 'btn btn--primary', type: 'submit', 'aria-label': 'Agregar a la lista' }, icon('plus', 20))),
      h('button', { class: 'btn btn--ghost shop__history', type: 'button', onclick: pickFromHistory }, icon('history', 18), 'Agregar desde el historial'),
      current.items.length
        ? h('div', { class: 'list' }, [...pending, ...done].map((item) => itemRow(item, totals)))
        : h('p', { class: 'list__empty card' }, 'La lista está vacía. Escribe un artículo o agrégalo desde el historial.'),
      h('div', { class: 'ticket__bar' },
        h('div', { class: 'ticket__bar-total' }, cart, estimate),
        convert));
    totals();
  }

  root.append(content);
  render();
  return () => {
    if (timer) save();
  };
}
