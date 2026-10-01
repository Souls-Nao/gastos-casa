import { h } from '../core/dom.js';
import { on } from '../core/events.js';
import { addMonths, formatDate, money, monthLabel, monthStart, todayISO } from '../core/format.js';
import { getState, watch } from '../core/store.js';
import { listCategories } from '../data/categories.js';
import { deleteIncome, listIncomes, saveIncome } from '../data/incomes.js';
import { selectMonth } from '../data/months.js';
import { listPaymentMethods } from '../data/payment-methods.js';
import { categoryIcon } from '../ui/category-icon.js';
import { field, selectInput, textInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { confirmRemoval, openFormModal } from '../ui/modal.js';
import { createMonthNav } from '../ui/month-nav.js';
import { toast } from '../ui/toast.js';

const NO_CATEGORY = { id: null, name: 'Sin categoría', icon: 'circle-help', color: '#7D8794' };

export default function incomes(root) {
  const summary = h('p', { class: 'history__summary' });
  const byCategory = h('div', { class: 'list' });
  const list = h('div', { class: 'list' });
  let categories = [];
  let methods = [];

  const nav = createMonthNav(async (step) => {
    try {
      await selectMonth(addMonths(getState().month, step));
    } catch (error) {
      toast(`No se pudo abrir el mes: ${error.message}`, 'error');
    }
  });

  function categoryOf(income) {
    return categories.find((category) => category.id === income.category_id) ?? NO_CATEGORY;
  }

  function edit(income) {
    const month = getState().month;
    const amount = textInput({ type: 'number', inputMode: 'decimal', min: '0.01', step: '0.01', required: true, autofocus: !income, placeholder: '0.00', value: income?.amount ?? '' });
    const date = textInput({ type: 'date', required: true, value: income?.received_on ?? (monthStart(todayISO()) === month ? todayISO() : month) });
    const category = selectInput(
      categories
        .filter((row) => row.kind === 'income' && (!row.hidden || row.id === income?.category_id))
        .map((row) => ({ value: row.id, label: row.name })),
      income?.category_id ?? categories.find((row) => row.kind === 'income' && !row.hidden)?.id,
      { required: true });
    const method = selectInput([
      { value: '', label: 'Sin especificar' },
      ...methods
        .filter((row) => (row.type !== 'credit' && !row.hidden) || row.id === income?.payment_method_id)
        .map((row) => ({ value: row.id, label: row.name })),
    ], income?.payment_method_id);
    const description = textInput({ maxLength: 80, placeholder: 'Quincena, venta, apoyo…', value: income?.description ?? '' });

    openFormModal({
      title: income ? 'Editar ingreso' : 'Nuevo ingreso',
      body: [
        field('Monto', amount),
        h('div', { class: 'form__pair' }, field('Fecha', date), field('Categoría', category)),
        field('Recibido en', method),
        field('Descripción', description, 'Opcional.'),
      ],
      async onSubmit() {
        const saved = await saveIncome({
          id: income?.id ?? crypto.randomUUID(),
          amount: Number(amount.value),
          received_on: date.value,
          category_id: category.value || null,
          payment_method_id: method.value || null,
          description: description.value.trim() || null,
        });
        if (monthStart(saved.received_on) !== getState().month) {
          toast(`Ingreso guardado en ${monthLabel(saved.received_on).toLowerCase()}.`);
        }
        await load(getState().month);
      },
      remove: income && {
        label: 'Eliminar ingreso',
        async run() {
          const name = income.description ?? categoryOf(income).name;
          if (!await confirmRemoval(name, `El disponible del mes bajará ${money(income.amount)}.`)) return false;
          await deleteIncome(income.id);
          await load(getState().month);
          return true;
        },
      },
    });
  }

  async function load(month) {
    nav.setMonth(month);
    try {
      const [rows, categoryRows, methodRows] = await Promise.all([listIncomes(month), listCategories(), listPaymentMethods()]);
      if (month !== getState().month) return;
      categories = categoryRows;
      methods = methodRows;
      const total = rows.reduce((sum, income) => sum + income.amount, 0);
      summary.replaceChildren(
        h('span', null, rows.length === 1 ? '1 ingreso' : `${rows.length} ingresos`),
        h('strong', { class: 'money' }, money(total)));

      const groups = new Map();
      for (const income of rows) {
        const category = categoryOf(income);
        groups.set(category, (groups.get(category) ?? 0) + income.amount);
      }
      byCategory.hidden = groups.size < 2;
      byCategory.replaceChildren(...[...groups].sort((a, b) => b[1] - a[1]).map(([category, amount]) => h('div', { class: 'row row--padded' },
        categoryIcon(category, 36),
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' }, category.name),
          h('span', { class: 'meter' },
            h('span', { class: 'meter__fill', style: `width:${Math.max(amount / total * 100, 2)}%;background:${category.color}` }))),
        h('strong', { class: 'money' }, money(amount)))));

      list.replaceChildren(...(rows.length ? rows.map((income) => {
        const category = categoryOf(income);
        const method = methods.find((row) => row.id === income.payment_method_id)?.name;
        return h('button', { class: 'list__item', type: 'button', onclick: () => edit(income) },
          categoryIcon(category, 36),
          h('div', { class: 'row__text' },
            h('span', { class: 'row__title' }, income.description ?? category.name),
            h('span', { class: 'row__subtitle' },
              [formatDate(income.received_on), income.description ? category.name : null, method].filter(Boolean).join(' · '))),
          h('strong', { class: 'money' }, money(income.amount)));
      }) : [h('p', { class: 'list__empty' }, 'Todavía no hay ingresos en este mes.')]));
    } catch (error) {
      toast(`No se pudieron cargar los ingresos: ${error.message}`, 'error');
    }
  }

  root.append(
    nav.element,
    h('div', { class: 'toolbar' },
      h('a', { class: 'btn btn--ghost', href: '#/catalogos?tab=categorias&kind=income' }, icon('tags', 18), 'Categorías'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), 'Nuevo ingreso')),
    summary,
    byCategory,
    list);
  load(getState().month);
  const stopMonth = watch('month', load);
  const stopData = on('data:changed', () => load(getState().month));
  return () => {
    stopMonth();
    stopData();
  };
}
