import { h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { formatDate, money, monthLabel, monthStart, todayISO } from '../../core/format.js';
import {
  addGoalMovement, deleteGoal, deleteGoalMovement, listGoalMovements, listGoals, monthlyQuota, saveGoal,
} from '../../data/savings.js';
import { statusMeter } from '../../ui/budget-bars.js';
import { categoryIcon } from '../../ui/category-icon.js';
import { field, fieldGroup, selectInput, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { iconButton } from '../../ui/list-row.js';
import { confirmRemoval, openFormModal } from '../../ui/modal.js';
import { colorPicker, iconPicker } from '../../ui/pickers.js';
import { toast } from '../../ui/toast.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function moneyInput(props) {
  return textInput({ type: 'number', inputMode: 'decimal', min: '0.01', step: '0.01', required: true, placeholder: '0.00', ...props });
}

function tile(label, value) {
  return h('div', { class: 'mini-stat' }, h('span', { class: 'mini-stat__label' }, label), h('strong', { class: 'money' }, value));
}

export default function goals(root) {
  const content = h('div', { class: 'view' });
  const current = monthStart(todayISO());

  async function load() {
    try {
      render(await listGoals());
    } catch (error) {
      toast(`No se pudieron cargar las metas: ${error.message}`, 'error');
    }
  }

  function move(goal, sign) {
    const amount = moneyInput({ autofocus: true, max: sign < 0 ? goal.saved : null });
    const date = textInput({ type: 'date', required: true, value: todayISO() });
    const note = textInput({ maxLength: 120 });
    openFormModal({
      title: sign > 0 ? `Guardar en ${goal.name}` : `Retirar de ${goal.name}`,
      submitLabel: sign > 0 ? 'Guardar' : 'Retirar',
      body: [
        field('Monto', amount, sign > 0
          ? `Este mes te toca guardar ${money(monthlyQuota(goal))} y llevas ${money(goal.saved_this_month)}.`
          : `Tienes ${money(goal.saved)} guardados en esta meta.`),
        field('Fecha', date),
        field('Nota', note, 'Opcional.'),
        h('p', { class: 'field__hint' }, sign > 0 ? 'Lo que guardas se aparta de tu disponible; el dinero sigue en tu efectivo o tarjeta.' : 'Lo que retiras regresa a tu disponible.'),
      ],
      async onSubmit() {
        await addGoalMovement({
          id: crypto.randomUUID(),
          goal_id: goal.id,
          amount: sign * Number(amount.value),
          moved_on: date.value,
          note: note.value.trim() || null,
        });
        await load();
      },
    });
  }

  async function edit(goal) {
    let movements = [];
    if (goal) {
      try {
        movements = await listGoalMovements(goal.id);
      } catch (error) {
        toast(error.message, 'error');
        return;
      }
    }
    const target = goal?.target_month ?? `${Number(current.slice(0, 4)) + 1}${current.slice(4)}`;
    const name = textInput({ required: true, maxLength: 60, autofocus: !goal, placeholder: 'Vacaciones, enganche, fondo de emergencia…', value: goal?.name ?? '' });
    const amount = moneyInput({ value: goal?.target_amount ?? '' });
    const month = selectInput(MONTHS.map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label })), target.slice(5, 7));
    const firstYear = Math.min(Number(current.slice(0, 4)), Number(target.slice(0, 4)));
    const year = selectInput(Array.from({ length: 21 }, (_, index) => ({ value: firstYear + index, label: String(firstYear + index) })), target.slice(0, 4));
    const color = colorPicker(goal?.color ?? '#4F6BD8');
    const symbol = iconPicker(goal?.icon ?? 'piggy-bank');
    const archived = h('input', { type: 'checkbox', checked: goal?.archived ?? false });

    const modal = openFormModal({
      title: goal ? 'Editar meta' : 'Nueva meta de ahorro',
      body: [
        field('Nombre', name),
        field('¿Cuánto quieres juntar?', amount),
        h('div', { class: 'form__pair' }, field('Para el mes de', month), field('Año', year)),
        fieldGroup('Color', color.element),
        fieldGroup('Icono', symbol.element),
        goal ? h('label', { class: 'check' }, archived, h('span', null, 'Archivar (ya no aparece en la cuota del mes)')) : null,
        movements.length ? h('div', { class: 'detail' },
          h('h3', { class: 'detail__heading' }, 'Movimientos'),
          h('ul', { class: 'detail__items' }, movements.map((movement) => h('li', { class: 'detail__item' },
            h('div', { class: 'row__text' },
              h('span', { class: 'row__title' }, formatDate(movement.moved_on)),
              h('span', { class: 'row__subtitle' }, movement.note ?? (movement.amount > 0 ? 'Depósito' : 'Retiro'))),
            h('strong', { class: 'money' }, `${movement.amount > 0 ? '+' : '−'}${money(Math.abs(movement.amount))}`),
            iconButton('trash-2', 'Eliminar este movimiento', async () => {
              if (!await confirmRemoval(`Movimiento de ${money(Math.abs(movement.amount))}`, 'Cambiará lo ahorrado en la meta y tu disponible.')) return;
              try {
                await deleteGoalMovement(movement.id);
                modal.close();
                await load();
              } catch (error) {
                toast(error.message, 'error');
              }
            }))))) : null,
      ],
      async onSubmit() {
        const targetMonth = `${year.value}-${month.value}-01`;
        const startMonth = goal?.start_month ?? current;
        if (targetMonth < startMonth) throw new Error('La fecha límite no puede ser anterior al inicio de la meta.');
        await saveGoal({
          id: goal?.id ?? crypto.randomUUID(),
          name: name.value.trim(),
          target_amount: Number(amount.value),
          start_month: startMonth,
          target_month: targetMonth,
          color: color.value,
          icon: symbol.value,
          archived: archived.checked,
        });
        await load();
      },
      remove: goal && {
        label: 'Eliminar meta',
        async run() {
          const detail = goal.saved
            ? `Se borran sus movimientos y los ${money(goal.saved)} guardados vuelven a contarse como disponible. Si solo quieres dejar de verla, archívala.`
            : 'Se borra la meta.';
          if (!await confirmRemoval(goal.name, detail)) return false;
          await deleteGoal(goal.id);
          await load();
          return true;
        },
      },
    });
  }

  function card(goal) {
    const done = goal.remaining <= 0;
    const late = !done && goal.target_month < current;
    const quota = monthlyQuota(goal);
    return h('article', { class: goal.archived ? 'card obligation row--hidden' : 'card obligation' },
      h('div', { class: 'row' },
        categoryIcon(goal),
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' },
            goal.name,
            done ? h('span', { class: 'tag tag--good' }, 'Cumplida') : null,
            late ? h('span', { class: 'tag tag--warning' }, 'Fecha vencida') : null,
            goal.archived ? h('span', { class: 'tag' }, 'Archivada') : null),
          h('span', { class: 'row__subtitle' }, `${money(goal.target_amount)} para ${monthLabel(goal.target_month).toLowerCase()}`)),
        h('div', { class: 'row__actions' }, iconButton('pencil', 'Editar meta y ver movimientos', () => edit(goal)))),
      statusMeter(goal.saved, goal.target_amount, 'ok'),
      h('span', { class: 'money' }, done
        ? `${money(goal.saved)} guardados`
        : `${money(goal.saved)} de ${money(goal.target_amount)} · faltan ${money(goal.remaining)}`),
      done || goal.archived ? null : h('div', { class: 'quincena' },
        h('span', { class: 'quincena__label' }, goal.months_left === 1 ? 'Cuota de este mes (último mes)' : `Cuota de este mes (quedan ${goal.months_left} meses)`),
        h('span', { class: 'money' }, `${money(Math.max(goal.saved_this_month, 0))} de ${money(quota)}`),
        statusMeter(Math.max(goal.saved_this_month, 0), quota, 'ok')),
      h('div', { class: 'goal__actions' },
        goal.saved > 0 ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => move(goal, -1) }, 'Retirar') : null,
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => move(goal, 1) }, icon('plus', 18), 'Guardar')));
  }

  function render(rows) {
    const active = rows.filter((goal) => !goal.archived);
    const pending = active.filter((goal) => goal.remaining > 0);
    content.replaceChildren(
      h('section', { class: 'card plan' },
        h('div', { class: 'mini-stats goal__stats' },
          tile('Ahorrado en total', money(rows.reduce((sum, goal) => sum + goal.saved, 0))),
          tile('Guardado este mes', money(active.reduce((sum, goal) => sum + goal.saved_this_month, 0))),
          tile('Cuota del mes', money(pending.reduce((sum, goal) => sum + monthlyQuota(goal), 0))))),
      h('div', { class: 'toolbar' },
        h('p', { class: 'toolbar__hint' }, 'La cuota es lo que hay que guardar cada mes para llegar a tiempo; se recalcula sola.'),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), 'Nueva meta')),
      ...(rows.length ? rows.map(card) : [h('p', { class: 'list__empty' }, 'Crea tu primera meta: cuánto quieres juntar y para cuándo.')]));
  }

  root.append(content);
  load();
  return on('data:changed', load);
}
