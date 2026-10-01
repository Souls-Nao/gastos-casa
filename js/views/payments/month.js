import { h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { addMonths, formatDate, money, monthStart, todayISO } from '../../core/format.js';
import { getState, watch } from '../../core/store.js';
import { categoryTree, listCategories } from '../../data/categories.js';
import { selectMonth } from '../../data/months.js';
import { listPaymentMethods } from '../../data/payment-methods.js';
import {
  OBLIGATION_KINDS, createObligation, createsExpense, deleteObligation, dueState, dueText, listObligations, payObligation,
  undoPayment, updateObligation, useAutomaticAmount,
} from '../../data/payments.js';
import { statusMeter } from '../../ui/budget-bars.js';
import { categoryIcon } from '../../ui/category-icon.js';
import { categorySelect } from '../../ui/category-select.js';
import { field, selectInput, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { iconButton } from '../../ui/list-row.js';
import { confirmRemoval, openFormModal } from '../../ui/modal.js';
import { createMonthNav } from '../../ui/month-nav.js';
import { toast } from '../../ui/toast.js';

function moneyInput(props) {
  return textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', placeholder: '0.00', ...props });
}

function dueTag(obligation, today) {
  const { state, days } = dueState(obligation, today);
  if (state === 'paid') return h('span', { class: 'tag tag--good' }, 'Pagado');
  if (state === 'overdue') return h('span', { class: 'tag tag--danger' }, 'Vencido');
  if (state === 'soon') return h('span', { class: 'tag tag--warning' }, `Vence ${dueText(days)}`);
  return null;
}

export default function month(root) {
  const content = h('div', { class: 'view' });
  let obligations = [];
  let methods = [];
  let categories = [];

  const nav = createMonthNav(async (step) => {
    try {
      await selectMonth(addMonths(getState().month, step));
    } catch (error) {
      toast(`No se pudo abrir el mes: ${error.message}`, 'error');
    }
  });

  const reload = () => load(getState().month);
  const categoryOf = (obligation) => categories.find((category) => category.id === obligation.category_id);
  const methodName = (id) => methods.find((method) => method.id === id)?.name ?? 'Sin método';

  function pay(obligation) {
    const expense = createsExpense(obligation);
    const allowed = methods.filter((method) => !method.hidden && (expense || method.type !== 'credit'));
    const amount = moneyInput({ min: '0.01', required: true, autofocus: true, value: obligation.pending || '' });
    const date = textInput({ type: 'date', required: true, value: todayISO() });
    const method = selectInput(
      allowed.map((row) => ({ value: row.id, label: row.name })),
      (allowed.find((row) => row.id === obligation.payment_method_id) ?? allowed[0])?.id,
      { required: true });
    const note = textInput({ maxLength: 120 });
    openFormModal({
      title: `Pagar ${obligation.name}`,
      submitLabel: 'Registrar pago',
      body: [
        field('Monto pagado', amount),
        h('div', { class: 'form__pair' }, field('Fecha', date), field('Pagado con', method)),
        field('Nota', note, 'Opcional.'),
        h('p', { class: 'field__hint' }, expense
          ? `Se registra como gasto en ${categoryOf(obligation)?.name ?? 'su categoría'} y aparece en el historial.`
          : 'Este pago baja tu disponible; no se cuenta otra vez como gasto.'),
      ],
      async onSubmit() {
        await payObligation({
          id: crypto.randomUUID(),
          obligation_id: obligation.id,
          amount: Number(amount.value),
          paid_on: date.value,
          payment_method_id: method.value || null,
          note: note.value,
        });
        toast(`Pago registrado: ${money(Number(amount.value))}`);
        await reload();
      },
    });
  }

  function detail(obligation) {
    const custom = !obligation || obligation.kind === 'custom';
    const locked = obligation?.kind === 'msi';
    const selected = getState().month;
    const name = textInput({ required: true, maxLength: 80, autofocus: !obligation, value: obligation?.name ?? '' });
    const amount = moneyInput({ required: true, disabled: locked, value: obligation?.amount ?? '' });
    const due = textInput({ type: 'date', disabled: locked, value: obligation?.due_date ?? (monthStart(todayISO()) === selected ? todayISO() : selected) });
    const category = categorySelect(categoryTree(categories.filter((row) => !row.hidden || row.id === obligation?.category_id), 'expense'),
      obligation?.category_id, { placeholder: 'Sin categoría (no cuenta como gasto)', required: false });

    const modal = openFormModal({
      title: obligation ? obligation.name : 'Nuevo pago único',
      body: [
        custom ? field('Nombre', name) : null,
        h('div', { class: 'form__pair' }, field('Monto de este mes', amount), field('Vence', due)),
        custom ? field('Categoría', category, 'Con categoría, al pagarlo se registra como gasto.') : null,
        locked ? h('p', { class: 'field__hint' }, 'El monto viene del plan a meses sin intereses.') : null,
        obligation?.kind === 'recurring' ? h('p', { class: 'field__hint' }, 'Este cambio solo aplica a este mes. Para los siguientes, edita el gasto fijo.') : null,
        obligation?.kind === 'card' && obligation.manual ? h('button', {
          class: 'btn btn--ghost form__extra',
          type: 'button',
          async onclick() {
            try {
              await useAutomaticAmount(obligation.id);
              modal.close();
              await reload();
            } catch (error) {
              toast(error.message, 'error');
            }
          },
        }, icon('refresh-cw', 18), 'Usar el monto automático del corte') : null,
        obligation?.payments.length ? h('div', { class: 'detail' },
          h('h3', { class: 'detail__heading' }, 'Pagos registrados'),
          h('ul', { class: 'detail__items' }, obligation.payments.map((payment) => h('li', { class: 'detail__item' },
            h('div', { class: 'row__text' },
              h('span', { class: 'row__title' }, formatDate(payment.paid_on)),
              h('span', { class: 'row__subtitle' }, [methodName(payment.payment_method_id), payment.note].filter(Boolean).join(' · '))),
            h('strong', { class: 'money' }, money(payment.amount)),
            iconButton('trash-2', 'Eliminar este pago', async () => {
              const consequence = payment.ticket_id
                ? 'También se borra el gasto que generó en el historial.'
                : 'El disponible del mes subirá por ese monto.';
              if (!await confirmRemoval(`Pago de ${money(payment.amount)}`, consequence)) return;
              try {
                await undoPayment(payment.id);
                modal.close();
                await reload();
              } catch (error) {
                toast(error.message, 'error');
              }
            }))))) : null,
      ],
      async onSubmit() {
        if (locked) return;
        const values = { amount: Number(amount.value), due_date: due.value || null };
        if (custom) Object.assign(values, { name: name.value.trim(), category_id: category.value || null });
        if (obligation) await updateObligation(obligation.id, values);
        else await createObligation({ ...values, id: crypto.randomUUID(), month: selected });
        await reload();
      },
      remove: obligation?.kind === 'custom' && {
        label: 'Eliminar pago único',
        async run() {
          const consequence = obligation.payments.length
            ? 'Se borran sus pagos registrados; los gastos que generaron se conservan en el historial.'
            : 'Dejará de aparecer en los pagos del mes.';
          if (!await confirmRemoval(obligation.name, consequence)) return false;
          await deleteObligation(obligation.id);
          await reload();
          return true;
        },
      },
    });
  }

  function render() {
    const today = todayISO();
    const total = obligations.reduce((sum, obligation) => sum + obligation.amount, 0);
    const paid = obligations.reduce((sum, obligation) => sum + Math.min(obligation.paid, obligation.amount), 0);
    const pending = obligations.reduce((sum, obligation) => sum + obligation.pending, 0);

    content.replaceChildren(
      h('section', { class: 'card plan' },
        h('div', { class: 'day__header' },
          h('div', null,
            h('h2', { class: 'section-title' }, 'Este mes hay que pagar'),
            h('span', { class: 'row__subtitle money' }, `Pagado ${money(paid)} · pendiente ${money(pending)}`)),
          h('strong', { class: 'day__total money' }, money(total))),
        statusMeter(paid, total, 'ok')),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => detail(null) }, icon('plus', 18), 'Pago único')),
      ...(obligations.length ? obligations.map((obligation) => {
        const kind = OBLIGATION_KINDS[obligation.kind];
        return h('article', { class: 'card obligation' },
          h('div', { class: 'row' },
            categoryIcon({ icon: kind.icon, color: categoryOf(obligation)?.color }),
            h('div', { class: 'row__text' },
              h('span', { class: 'row__title' }, obligation.name, dueTag(obligation, today)),
              h('span', { class: 'row__subtitle' },
                [kind.label, obligation.due_date ? `vence ${formatDate(obligation.due_date)}` : null].filter(Boolean).join(' · '))),
            h('div', { class: 'row__actions' }, iconButton('pencil', 'Detalle y pagos', () => detail(obligation)))),
          statusMeter(obligation.paid, Math.max(obligation.amount, obligation.paid), 'ok'),
          h('div', { class: 'obligation__footer' },
            h('span', { class: 'money' }, `${money(obligation.paid)} de ${money(obligation.amount)}`),
            obligation.pending > 0
              ? h('button', { class: 'btn btn--primary', type: 'button', onclick: () => pay(obligation) }, 'Pagar')
              : null));
      }) : [h('p', { class: 'list__empty' }, 'No hay pagos para este mes. Agrega tus gastos fijos o un pago único.')]));
  }

  async function load(selected) {
    nav.setMonth(selected);
    try {
      const [rows, methodRows, categoryRows] = await Promise.all([listObligations(selected), listPaymentMethods(), listCategories()]);
      if (selected !== getState().month) return;
      obligations = rows;
      methods = methodRows;
      categories = categoryRows;
      render();
    } catch (error) {
      toast(`No se pudieron cargar los pagos: ${error.message}`, 'error');
    }
  }

  root.append(nav.element, content);
  reload();
  const stopMonth = watch('month', load);
  const stopData = on('data:changed', reload);
  return () => {
    stopMonth();
    stopData();
  };
}
