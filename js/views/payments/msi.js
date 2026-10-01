import { h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { addMonths, money, monthLabel, monthsBetween } from '../../core/format.js';
import { getState, watch } from '../../core/store.js';
import { categoryTree, listCategories } from '../../data/categories.js';
import { selectMonth } from '../../data/months.js';
import { listPaymentMethods } from '../../data/payment-methods.js';
import { deleteMsiPlan, listMsiPlans, saveMsiPlan } from '../../data/payments.js';
import { statusMeter } from '../../ui/budget-bars.js';
import { categorySelect } from '../../ui/category-select.js';
import { field, selectInput, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { confirmRemoval, openFormModal } from '../../ui/modal.js';
import { createMonthNav } from '../../ui/month-nav.js';
import { toast } from '../../ui/toast.js';
import { openTicketDetail } from '../ticket-detail.js';

export default function msi(root) {
  const summary = h('p', { class: 'history__summary' });
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

  const reload = () => load(getState().month);

  function edit(plan) {
    const current = getState().month;
    const description = textInput({ required: true, maxLength: 80, autofocus: !plan, placeholder: 'Pantalla, refrigerador…', value: plan?.description ?? '' });
    const total = textInput({ type: 'number', inputMode: 'decimal', min: '0.01', step: '0.01', required: true, placeholder: '0.00', value: plan?.total_amount ?? '' });
    const months = textInput({ type: 'number', inputMode: 'numeric', min: '2', max: '60', step: '1', required: true, value: plan?.months ?? 12 });
    const options = Array.from({ length: 64 }, (_, index) => addMonths(current, index - 59));
    const first = selectInput(
      [...new Set([...options, plan?.first_month ?? current])].sort().map((month) => ({ value: month, label: monthLabel(month) })),
      plan?.first_month ?? current);
    const card = selectInput([
      { value: '', label: 'Sin tarjeta' },
      ...methods.filter((row) => row.type === 'credit' && (!row.hidden || row.id === plan?.payment_method_id)).map((row) => ({ value: row.id, label: row.name })),
    ], plan?.payment_method_id ?? methods.find((row) => row.type === 'credit' && !row.hidden)?.id);
    const category = categorySelect(
      categoryTree(categories.filter((row) => !row.hidden || row.id === plan?.category_id), 'expense'), plan?.category_id);

    openFormModal({
      title: plan ? 'Editar compra a meses' : 'Agregar compra a meses',
      body: [
        field('Descripción', description),
        h('div', { class: 'form__pair' }, field('Monto total', total), field('Número de meses', months)),
        h('div', { class: 'form__pair' }, field('Primer pago', first), field('Tarjeta', card)),
        field('Categoría', category, 'Cada mensualidad cuenta como gasto de esta categoría.'),
      ],
      async onSubmit() {
        await saveMsiPlan({
          id: plan?.id ?? crypto.randomUUID(),
          description: description.value.trim(),
          total_amount: Number(total.value),
          months: Number(months.value),
          first_month: first.value,
          payment_method_id: card.value || null,
          category_id: category.value,
        });
        await reload();
      },
      remove: plan && {
        label: 'Eliminar compra a meses',
        async run() {
          if (!await confirmRemoval(plan.description, 'Se quitan sus mensualidades de todos los meses, incluidos los pagos ya registrados.')) return false;
          await deleteMsiPlan(plan.id);
          await reload();
          return true;
        },
      },
    });
  }

  async function load(month) {
    nav.setMonth(month);
    try {
      const [plans, categoryRows, methodRows] = await Promise.all([listMsiPlans(), listCategories(), listPaymentMethods()]);
      if (month !== getState().month) return;
      categories = categoryRows;
      methods = methodRows;
      const open = plans
        .map((plan) => ({ plan, index: monthsBetween(plan.first_month, month) + 1, monthly: plan.total_amount / plan.months }))
        .filter((entry) => entry.index <= entry.plan.months);
      const due = open.filter((entry) => entry.index >= 1);
      summary.replaceChildren(
        h('span', null, due.length === 1 ? '1 mensualidad este mes' : `${due.length} mensualidades este mes`),
        h('strong', { class: 'money' }, money(due.reduce((sum, entry) => sum + entry.monthly, 0))));

      list.replaceChildren(...(open.length ? open.map(({ plan, index, monthly }) => {
        const started = index >= 1;
        const left = plan.months - Math.max(index, 0);
        return h('button', {
          class: 'list__item',
          type: 'button',
          onclick: () => (plan.ticket_id ? openTicketDetail(plan.ticket_id) : edit(plan)),
        },
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' },
            plan.description,
            h('span', { class: 'tag' }, started ? `${index} de ${plan.months}` : `Empieza en ${monthLabel(plan.first_month).toLowerCase()}`)),
          h('span', { class: 'row__subtitle' }, [
            methods.find((row) => row.id === plan.payment_method_id)?.name,
            `${money(monthly)} al mes`,
            left ? `faltan ${left === 1 ? '1 pago' : `${left} pagos`} (${money(monthly * left)})` : 'último pago',
            `termina en ${monthLabel(addMonths(plan.first_month, plan.months - 1)).toLowerCase()}`,
          ].filter(Boolean).join(' · ')),
          statusMeter(Math.max(index, 0), plan.months, 'ok')),
        h('strong', { class: 'money' }, money(plan.total_amount)));
      }) : [h('p', { class: 'list__empty' }, 'No hay compras a meses activas en este mes.')]));
    } catch (error) {
      toast(`No se pudieron cargar las compras a meses: ${error.message}`, 'error');
    }
  }

  root.append(
    nav.element,
    h('div', { class: 'toolbar' },
      h('p', { class: 'toolbar__hint' }, 'Las compras nuevas a meses se capturan en el ticket. Aquí puedes agregar las que ya venías pagando.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), 'Agregar')),
    summary,
    list);
  reload();
  const stopMonth = watch('month', load);
  const stopData = on('data:changed', reload);
  return () => {
    stopMonth();
    stopData();
  };
}
