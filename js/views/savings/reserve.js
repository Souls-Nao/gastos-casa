import { h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { formatDate, money, monthLabel, todayISO } from '../../core/format.js';
import {
  addReserveMovement, closeMonth, deleteReserveMovement, listOpenMonths, listReserveMovements, reopenMonth,
} from '../../data/savings.js';
import { field, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { iconButton } from '../../ui/list-row.js';
import { confirmDialog, confirmRemoval, openFormModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';

export default function reserve(root) {
  const content = h('div', { class: 'view' });

  async function act(task) {
    try {
      await task();
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function move(sign, balance) {
    const amount = textInput({ type: 'number', inputMode: 'decimal', min: '0.01', step: '0.01', required: true, autofocus: true, placeholder: '0.00' });
    const date = textInput({ type: 'date', required: true, value: todayISO() });
    const note = textInput({ maxLength: 120 });
    openFormModal({
      title: sign > 0 ? 'Guardar en la reserva' : 'Usar de la reserva',
      submitLabel: sign > 0 ? 'Guardar' : 'Usar',
      body: [
        field('Monto', amount, sign > 0 ? 'Se aparta de tu disponible; el dinero sigue en tu efectivo o tarjeta.' : `Regresa a tu disponible. La reserva tiene ${money(balance)}.`),
        field('Fecha', date),
        field('Nota', note, 'Opcional.'),
      ],
      async onSubmit() {
        await addReserveMovement({
          id: crypto.randomUUID(),
          amount: sign * Number(amount.value),
          moved_on: date.value,
          note: note.value.trim() || null,
        });
        await load();
      },
    });
  }

  async function close({ month, leftover }) {
    const label = monthLabel(month).toLowerCase();
    const confirmed = await confirmDialog({
      title: `Cerrar ${label}`,
      message: leftover > 0
        ? `Sobraron ${money(leftover)} en ${label}. Al cerrar el mes pasan a la Reserva.`
        : leftover < 0
          ? `En ${label} se gastaron ${money(-leftover)} de más. Al cerrar el mes se descuentan de la Reserva.`
          : `En ${label} no sobró ni faltó dinero. El mes solo se marca como cerrado.`,
      confirmLabel: 'Cerrar mes',
    });
    if (confirmed) await act(() => closeMonth(month));
  }

  function movementRow(movement) {
    const closing = movement.kind === 'month_close';
    return h('div', { class: 'row' },
      h('div', { class: 'row__text' },
        h('span', { class: 'row__title' }, closing ? `Cierre de ${monthLabel(movement.month).toLowerCase()}` : movement.note ?? (movement.amount > 0 ? 'Depósito' : 'Retiro')),
        h('span', { class: 'row__subtitle' }, formatDate(movement.moved_on))),
      h('strong', { class: 'money' }, `${movement.amount > 0 ? '+' : '−'}${money(Math.abs(movement.amount))}`),
      h('div', { class: 'row__actions' }, closing
        ? iconButton('undo-2', 'Reabrir este mes', async () => {
          const confirmed = await confirmDialog({
            title: `Reabrir ${monthLabel(movement.month).toLowerCase()}`,
            message: `Los ${money(Math.abs(movement.amount))} de ese cierre salen de la Reserva y el mes vuelve a quedar abierto.`,
            confirmLabel: 'Reabrir mes',
          });
          if (confirmed) await act(() => reopenMonth(movement.month));
        })
        : iconButton('trash-2', 'Eliminar este movimiento', async () => {
          if (await confirmRemoval(`Movimiento de ${money(Math.abs(movement.amount))}`, 'Cambiará el saldo de la reserva y tu disponible.')) {
            await act(() => deleteReserveMovement(movement.id));
          }
        })));
  }

  async function load() {
    try {
      const [movements, open] = await Promise.all([listReserveMovements(), listOpenMonths()]);
      const balance = movements.reduce((sum, movement) => sum + movement.amount, 0);
      content.replaceChildren(
        h('section', { class: 'card plan' },
          h('div', { class: 'day__header' },
            h('div', null,
              h('h2', { class: 'section-title' }, 'Saldo de la reserva'),
              h('span', { class: 'row__subtitle' }, 'Lo que sobra de cada mes y lo que guardes aparte.')),
            h('strong', { class: 'day__total money' }, money(balance))),
          h('div', { class: 'goal__actions' },
            balance > 0 ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => move(-1, balance) }, 'Usar') : null,
            h('button', { class: 'btn btn--primary', type: 'button', onclick: () => move(1, balance) }, icon('plus', 18), 'Guardar'))),
        ...open.map((entry) => h('div', { class: 'notice' },
          h('span', null, `${monthLabel(entry.month)} ya terminó: ${entry.leftover >= 0 ? 'sobraron' : 'faltaron'} ${money(Math.abs(entry.leftover))}.`),
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => close(entry) }, 'Cerrar mes'))),
        h('h2', { class: 'section-title' }, 'Movimientos'),
        h('div', { class: 'list' }, movements.length
          ? movements.map(movementRow)
          : h('p', { class: 'list__empty' }, 'Todavía no hay movimientos en la reserva.')));
    } catch (error) {
      toast(`No se pudo cargar la reserva: ${error.message}`, 'error');
    }
  }

  root.append(content);
  load();
  return on('data:changed', load);
}
