import { h } from '../../core/dom.js';
import { addMonths, money, monthLabel, monthStart, todayISO } from '../../core/format.js';
import { categoryTree, listCategories } from '../../data/categories.js';
import { listPaymentMethods } from '../../data/payment-methods.js';
import { FREQUENCIES, deleteRecurring, listRecurring, saveRecurring } from '../../data/payments.js';
import { categoryIcon } from '../../ui/category-icon.js';
import { categorySelect } from '../../ui/category-select.js';
import { field, selectInput, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { confirmRemoval, openFormModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';

function nextMonth(item, from) {
  let month = item.start_month;
  while (month < from) month = addMonths(month, FREQUENCIES[item.frequency].months);
  return month;
}

export default async function recurring(root) {
  const current = monthStart(todayISO());
  const list = h('div', { class: 'list' });
  let categories = [];
  let methods = [];

  function edit(item) {
    const name = textInput({ required: true, maxLength: 80, autofocus: !item, placeholder: 'Luz, internet, colegiatura…', value: item?.name ?? '' });
    const amount = textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', required: true, placeholder: '0.00', value: item?.amount ?? '' });
    const category = categorySelect(
      categoryTree(categories.filter((row) => !row.hidden || row.id === item?.category_id), 'expense'), item?.category_id);
    const frequency = selectInput(
      Object.entries(FREQUENCIES).map(([value, { label }]) => ({ value, label })), item?.frequency ?? 'monthly');
    const day = textInput({ type: 'number', inputMode: 'numeric', min: '1', max: '31', step: '1', required: true, value: item?.due_day ?? '' });
    const months = Array.from({ length: 24 }, (_, index) => addMonths(current, index - 11));
    const start = selectInput(
      [...new Set([...months, item?.start_month ?? current])].sort().map((month) => ({ value: month, label: monthLabel(month) })),
      item?.start_month ?? current);
    const method = selectInput([
      { value: '', label: 'Sin definir' },
      ...methods.filter((row) => !row.hidden || row.id === item?.payment_method_id).map((row) => ({ value: row.id, label: row.name })),
    ], item?.payment_method_id);
    const active = h('input', { type: 'checkbox', checked: item?.active ?? true });

    openFormModal({
      title: item ? 'Editar gasto fijo' : 'Nuevo gasto fijo',
      body: [
        field('Nombre', name),
        h('div', { class: 'form__pair' }, field('Monto aproximado', amount), field('Día de vencimiento', day)),
        field('Categoría', category),
        h('div', { class: 'form__pair' }, field('Frecuencia', frequency), field('Primer mes', start)),
        field('Se paga con', method, 'Opcional. Se propone al registrar el pago.'),
        item ? h('label', { class: 'check' }, active, h('span', null, 'Activo')) : null,
      ],
      async onSubmit() {
        await saveRecurring({
          id: item?.id ?? crypto.randomUUID(),
          name: name.value.trim(),
          amount: Number(amount.value),
          category_id: category.value,
          frequency: frequency.value,
          due_day: Number(day.value),
          start_month: start.value,
          payment_method_id: method.value || null,
          active: active.checked,
        });
        await load();
      },
      remove: item && {
        label: 'Eliminar gasto fijo',
        async run() {
          if (!await confirmRemoval(item.name, 'Ya no se generará en los meses siguientes. Los pagos que ya registraste se conservan.')) return false;
          await deleteRecurring(item.id);
          await load();
          return true;
        },
      },
    });
  }

  async function load() {
    const [items, categoryRows, methodRows] = await Promise.all([listRecurring(), listCategories(), listPaymentMethods()]);
    categories = categoryRows;
    methods = methodRows;
    list.replaceChildren(...(items.length ? items.map((item) => {
      const category = categories.find((row) => row.id === item.category_id);
      return h('button', { class: item.active ? 'list__item' : 'list__item row--hidden', type: 'button', onclick: () => edit(item) },
        categoryIcon({ icon: category?.icon ?? 'repeat', color: category?.color }, 36),
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' }, item.name, item.active ? null : h('span', { class: 'tag' }, 'Pausado')),
          h('span', { class: 'row__subtitle' },
            `${FREQUENCIES[item.frequency].label} · día ${item.due_day} · próximo en ${monthLabel(nextMonth(item, current)).toLowerCase()}`)),
        h('strong', { class: 'money' }, money(item.amount)));
    }) : [h('p', { class: 'list__empty' }, 'Agrega aquí lo que pagas cada cierto tiempo: luz, agua, internet, colegiaturas…')]));
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('p', { class: 'toolbar__hint' }, 'Cada gasto fijo aparece solo en los pagos del mes que le toca.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), 'Nuevo gasto fijo')),
    list);
  try {
    await load();
  } catch (error) {
    toast(`No se pudieron cargar los gastos fijos: ${error.message}`, 'error');
  }
}
