import { h } from '../core/dom.js';
import { addMonths, money, monthLabel, monthStart, normalize, nowTime, todayISO } from '../core/format.js';
import { readLocal, removeLocal, writeLocal } from '../core/local.js';
import { navigate } from '../core/router.js';
import { categoryTree, listCategories } from '../data/categories.js';
import { listPaymentMethods } from '../data/payment-methods.js';
import { listProducts } from '../data/products.js';
import { createStore, listStores } from '../data/stores.js';
import { deleteTicket, getTicket, saveTicket } from '../data/tickets.js';
import { listUnits } from '../data/units.js';
import { autocomplete } from '../ui/autocomplete.js';
import { categorySelect } from '../ui/category-select.js';
import { field, selectInput, textInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { iconButton } from '../ui/list-row.js';
import { confirmRemoval, openFormModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

const DRAFT_KEY = 'gastos:ticket-draft';
const METHOD_KEY = 'gastos:last-payment-method';
const NEW_STORE = 'new';
const MSI_MONTHS = [3, 6, 9, 12, 15, 18, 24, 36, 48];

function newItem() {
  return { id: crypto.randomUUID(), name: '', category_id: null, quantity: 1, unit: 'pza', unit_price: null };
}

function isBlank(item) {
  return !item.name.trim() && item.unit_price == null;
}

function itemAmount(item) {
  return Math.round(((item.quantity || 0) * (item.unit_price || 0) + Number.EPSILON) * 100) / 100;
}

function firstPaymentMonth(date, method) {
  if (!method?.closing_day) return addMonths(date, 1);
  const afterClosing = Number(date.slice(8, 10)) > method.closing_day;
  const paidSameMonth = (method.due_day ?? 0) > method.closing_day;
  return addMonths(date, (afterClosing ? 1 : 0) + (paidSameMonth ? 0 : 1));
}

function numberOrNull(value) {
  return value === '' || Number.isNaN(Number(value)) ? null : Number(value);
}

export default async function ticket(root, { params, query }) {
  const [stores, methods, categories, units, products] = await Promise.all([
    listStores(), listPaymentMethods(), listCategories(), listUnits(), listProducts(),
  ]);
  const editing = Boolean(params.id);
  const repeatId = query.get('repetir');
  const tree = categoryTree(categories.filter((category) => !category.hidden), 'expense')
    .map((category) => ({ ...category, children: category.children.filter((child) => !child.hidden) }));
  const visibleCategories = new Set(tree.flatMap((category) => [category.id, ...category.children.map((child) => child.id)]));
  const visibleMethods = methods.filter((method) => !method.hidden);
  const catalog = products.map((product) => ({ ...product, key: normalize(product.name) }));
  const draft = editing || repeatId ? null : readLocal(DRAFT_KEY);
  let restored = false;
  let state;

  if (editing) {
    state = await getTicket(params.id);
  } else if (repeatId) {
    const source = await getTicket(repeatId);
    state = {
      ...source,
      id: crypto.randomUUID(),
      purchased_on: todayISO(),
      purchased_at: nowTime(),
      discount: 0,
      note: '',
      msi: null,
      items: source.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    };
  } else if (draft?.items?.some((item) => !isBlank(item))) {
    state = draft;
    restored = true;
  } else {
    const last = readLocal(METHOD_KEY);
    state = {
      id: crypto.randomUUID(),
      purchased_on: todayISO(),
      purchased_at: nowTime(),
      store_id: null,
      payment_method_id: (visibleMethods.find((method) => method.id === last) ?? visibleMethods[0])?.id ?? null,
      discount: 0,
      note: '',
      items: [newItem()],
      msi: null,
    };
  }

  if (!stores.some((row) => row.id === state.store_id)) state.store_id = null;
  if (!methods.some((row) => row.id === state.payment_method_id)) state.payment_method_id = null;
  for (const item of state.items) {
    if (!categories.some((row) => row.id === item.category_id)) item.category_id = null;
  }

  const itemList = h('div', { class: 'ticket__items' });
  const subtotalText = h('span', { class: 'money' });
  const totalText = h('strong', { class: 'ticket__total money' });
  const msiHint = h('p', { class: 'field__hint' });
  const save = h('button', { class: 'btn btn--primary', type: 'submit' }, editing ? 'Guardar cambios' : 'Guardar ticket');

  function currentMethod() {
    return methods.find((method) => method.id === state.payment_method_id);
  }

  function totals() {
    const subtotal = state.items.reduce((sum, item) => sum + itemAmount(item), 0);
    return { subtotal, total: Math.max(subtotal - (state.discount || 0), 0) };
  }

  function refresh() {
    const { subtotal, total } = totals();
    subtotalText.textContent = money(subtotal);
    totalText.textContent = money(total);
    if (state.msi) {
      const last = addMonths(state.msi.first_month, state.msi.months - 1);
      msiHint.textContent = `${state.msi.months} pagos de ${money(total / state.msi.months)}, de ${monthLabel(state.msi.first_month)} a ${monthLabel(last)}.`;
    }
    if (!editing) writeLocal(DRAFT_KEY, state);
  }

  function suggestions(text) {
    const key = normalize(text);
    if (!key) return [];
    const starts = catalog.filter((product) => product.key.startsWith(key));
    const contains = catalog.filter((product) => !product.key.startsWith(key) && product.key.includes(key));
    return [...starts, ...contains].slice(0, 6);
  }

  function unitOptions(current) {
    const names = units.filter((unit) => !unit.hidden).map((unit) => unit.name);
    if (!names.includes(current)) names.push(current);
    return names.map((name) => ({ value: name, label: name }));
  }

  function categoryFallback(id) {
    const category = id && !visibleCategories.has(id) && categories.find((row) => row.id === id);
    return category ? { id: category.id, name: `${category.name} (oculta)` } : null;
  }

  function itemRow(item) {
    const name = textInput({ required: true, maxLength: 80, autocomplete: 'off', enterKeyHint: 'next', placeholder: 'Leche, pan, luz…', value: item.name });
    const quantity = textInput({ type: 'number', inputMode: 'decimal', min: '0.001', step: 'any', required: true, value: item.quantity ?? '' });
    const unit = selectInput(unitOptions(item.unit), item.unit);
    const price = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', required: true, placeholder: '0.00', value: item.unit_price ?? '' });
    const category = categorySelect(tree, item.category_id, categoryFallback(item.category_id));
    const amount = h('strong', { class: 'ticket-item__amount money' }, money(itemAmount(item)));

    function update() {
      amount.textContent = money(itemAmount(item));
      refresh();
    }

    function applyProduct(product) {
      item.name = product.name;
      name.value = product.name;
      if (visibleCategories.has(product.category_id)) {
        item.category_id = product.category_id;
        category.value = product.category_id;
      }
      if (![...unit.options].some((option) => option.value === product.unit)) unit.append(h('option', { value: product.unit }, product.unit));
      item.unit = product.unit;
      unit.value = product.unit;
      if (product.last_price != null) {
        item.unit_price = Number(product.last_price);
        price.value = item.unit_price;
      }
      update();
      price.focus();
      price.select();
    }

    name.addEventListener('input', () => {
      item.name = name.value;
      refresh();
    });
    name.addEventListener('change', () => {
      const match = catalog.find((product) => product.key === normalize(name.value));
      if (match && item.unit_price == null && !item.category_id) applyProduct(match);
    });
    quantity.addEventListener('input', () => {
      item.quantity = numberOrNull(quantity.value);
      update();
    });
    unit.addEventListener('change', () => {
      item.unit = unit.value;
      refresh();
    });
    price.addEventListener('input', () => {
      item.unit_price = numberOrNull(price.value);
      update();
    });
    category.addEventListener('change', () => {
      item.category_id = category.value;
      refresh();
    });

    const row = h('div', { class: 'ticket-item card' },
      h('div', { class: 'ticket-item__name' },
        field('Artículo', autocomplete(name, {
          search: suggestions,
          render: (product) => [
            h('span', { class: 'autocomplete__name' }, product.name),
            product.last_price != null ? h('span', { class: 'autocomplete__meta money' }, `${money(product.last_price)} / ${product.unit}`) : null,
          ],
          onSelect: applyProduct,
        }))),
      h('div', { class: 'ticket-item__remove' },
        iconButton('trash-2', 'Quitar artículo', () => {
          state.items = state.items.filter((other) => other !== item);
          if (!state.items.length) state.items.push(newItem());
          renderItems();
          refresh();
        })),
      h('div', { class: 'ticket-item__quantity' }, field('Cantidad', quantity)),
      h('div', { class: 'ticket-item__unit' }, field('Unidad', unit)),
      h('div', { class: 'ticket-item__price' }, field('Precio', price)),
      h('div', { class: 'ticket-item__category' }, field('Categoría', category)),
      h('div', { class: 'ticket-item__total' }, h('span', { class: 'field__label' }, 'Importe'), amount));
    row.focusName = () => name.focus();
    return row;
  }

  function renderItems() {
    itemList.replaceChildren(...state.items.map(itemRow));
  }

  function addItem() {
    const item = newItem();
    state.items.push(item);
    const row = itemRow(item);
    itemList.append(row);
    row.focusName();
    refresh();
  }

  const date = textInput({ type: 'date', required: true, value: state.purchased_on });
  const time = textInput({ type: 'time', value: state.purchased_at ?? '' });

  function storeOptions() {
    const shown = stores.filter((store) => !store.hidden || store.id === state.store_id);
    return [
      { value: '', label: 'Sin tienda' },
      ...shown.map((store) => ({ value: store.id, label: store.name })),
      { value: NEW_STORE, label: '+ Nueva tienda…' },
    ];
  }

  const store = selectInput(storeOptions(), state.store_id);
  store.addEventListener('change', () => {
    if (store.value !== NEW_STORE) {
      state.store_id = store.value || null;
      refresh();
      return;
    }
    store.value = state.store_id ?? '';
    const name = textInput({ required: true, maxLength: 60, autofocus: true });
    openFormModal({
      title: 'Nueva tienda',
      body: field('Nombre', name),
      async onSubmit() {
        const created = await createStore(name.value.trim());
        stores.push(created);
        state.store_id = created.id;
        store.replaceChildren(...storeOptions().map((option) => h('option', { value: option.value }, option.label)));
        store.value = created.id;
        refresh();
      },
    });
  });

  const method = selectInput([
    ...(state.payment_method_id ? [] : [{ value: '', label: 'Sin método' }]),
    ...methods
      .filter((row) => !row.hidden || row.id === state.payment_method_id)
      .map((row) => ({ value: row.id, label: row.name })),
  ], state.payment_method_id);

  const msiToggle = h('input', { type: 'checkbox', checked: Boolean(state.msi) });
  const msiMonths = selectInput(
    [...new Set([...MSI_MONTHS, state.msi?.months ?? 6])].sort((a, b) => a - b).map((months) => ({ value: months, label: `${months} meses` })),
    state.msi?.months ?? 6);
  const msiFirst = h('select', { class: 'field__input' });
  const msiFields = h('div', { class: 'form__pair' }, field('Plazo', msiMonths), field('Primer pago', msiFirst));
  const msiBox = h('div', { class: 'form__section' },
    h('label', { class: 'check' }, msiToggle, h('span', null, 'A meses sin intereses')),
    msiFields,
    msiHint);

  function syncMsi() {
    const credit = currentMethod()?.type === 'credit';
    if (!credit) {
      state.msi = null;
      msiToggle.checked = false;
    }
    msiBox.hidden = !credit;
    msiFields.hidden = !state.msi;
    msiHint.hidden = !state.msi;
    if (state.msi) {
      const base = monthStart(state.purchased_on);
      const options = [...new Set([0, 1, 2, 3].map((offset) => addMonths(base, offset)).concat(state.msi.first_month))].sort();
      msiFirst.replaceChildren(...options.map((month) => h('option', { value: month }, monthLabel(month))));
      msiFirst.value = state.msi.first_month;
    }
    refresh();
  }

  date.addEventListener('change', () => {
    if (!date.value) return;
    state.purchased_on = date.value;
    if (state.msi) state.msi.first_month = firstPaymentMonth(state.purchased_on, currentMethod());
    syncMsi();
  });
  time.addEventListener('change', () => {
    state.purchased_at = time.value || null;
    refresh();
  });
  method.addEventListener('change', () => {
    state.payment_method_id = method.value || null;
    if (state.msi) state.msi.first_month = firstPaymentMonth(state.purchased_on, currentMethod());
    syncMsi();
  });
  msiToggle.addEventListener('change', () => {
    state.msi = msiToggle.checked
      ? { months: Number(msiMonths.value), first_month: firstPaymentMonth(state.purchased_on, currentMethod()) }
      : null;
    syncMsi();
  });
  msiMonths.addEventListener('change', () => {
    state.msi.months = Number(msiMonths.value);
    refresh();
  });
  msiFirst.addEventListener('change', () => {
    state.msi.first_month = msiFirst.value;
    refresh();
  });

  const discount = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', placeholder: '0.00', value: state.discount || '' });
  discount.addEventListener('input', () => {
    state.discount = numberOrNull(discount.value) ?? 0;
    refresh();
  });
  const note = h('textarea', { class: 'field__input', rows: 2, maxLength: 300, value: state.note });
  note.addEventListener('input', () => {
    state.note = note.value;
    refresh();
  });

  async function submit(event) {
    event.preventDefault();
    const filled = state.items.filter((item) => !isBlank(item));
    if (filled.length && filled.length !== state.items.length) {
      state.items = filled;
      renderItems();
    }
    if (!form.reportValidity()) return;
    const { subtotal, total } = totals();
    if (state.discount > subtotal) {
      toast('El descuento no puede ser mayor que el subtotal.', 'error');
      return;
    }
    if (state.msi && total <= 0) {
      toast('Una compra a meses necesita un total mayor a cero.', 'error');
      return;
    }
    save.disabled = true;
    try {
      const sent = await saveTicket({ ...state, items: state.items.map((item) => ({ ...item, name: item.name.trim() })) });
      if (state.payment_method_id) writeLocal(METHOD_KEY, state.payment_method_id);
      if (!editing) removeLocal(DRAFT_KEY);
      toast(sent
        ? `Ticket guardado: ${money(total)}`
        : `Sin conexión: el ticket de ${money(total)} quedó guardado en este dispositivo y se enviará solo al volver internet.`);
      navigate('/');
    } catch (error) {
      toast(`No se pudo guardar: ${error.message}`, 'error');
      save.disabled = false;
    }
  }

  const form = h('form', {
    class: 'ticket',
    noValidate: true,
    onsubmit: submit,
    onkeydown(event) {
      if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
      event.preventDefault();
      if (itemList.contains(event.target)) addItem();
    },
  },
  restored ? h('div', { class: 'notice' },
    h('span', null, 'Recuperamos el ticket que no terminaste de guardar.'),
    h('button', {
      class: 'btn btn--ghost',
      type: 'button',
      onclick() {
        removeLocal(DRAFT_KEY);
        root.replaceChildren();
        ticket(root, { params, query });
      },
    }, 'Descartar')) : null,
  editing ? h('div', { class: 'toolbar' },
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => navigate(`/ticket?repetir=${state.id}`) },
      icon('copy', 18), 'Repetir compra'),
    h('button', {
      class: 'btn btn--danger-outline',
      type: 'button',
      async onclick() {
        const place = stores.find((row) => row.id === state.store_id)?.name;
        if (!await confirmRemoval(place ? `Ticket de ${place}` : 'Ticket', 'Se borrará con todos sus artículos.')) return;
        try {
          const sent = await deleteTicket(state.id);
          toast(sent ? 'Ticket eliminado.' : 'Sin conexión: el ticket se eliminará al volver internet.');
          navigate('/');
        } catch (error) {
          toast(`No se pudo eliminar: ${error.message}`, 'error');
        }
      },
    }, icon('trash-2', 18), 'Eliminar')) : null,
  h('section', { class: 'card ticket__header' },
    field('Fecha', date),
    field('Hora', time),
    field('Tienda', store),
    field('Método de pago', method),
    msiBox),
  itemList,
  h('button', { class: 'btn btn--ghost ticket__add', type: 'button', onclick: addItem }, icon('plus', 18), 'Agregar artículo'),
  h('section', { class: 'card ticket__summary' },
    h('div', { class: 'ticket__line' }, h('span', null, 'Subtotal'), subtotalText),
    field('Descuento', discount),
    field('Nota', note)),
  h('div', { class: 'ticket__bar' },
    h('div', { class: 'ticket__bar-total' }, h('span', { class: 'field__label' }, 'Total'), totalText),
    save));

  root.append(form);
  renderItems();
  syncMsi();
}
