import { fill, h } from '../core/dom.js';
import { on } from '../core/events.js';
import { formatDate, money } from '../core/format.js';
import { MOVE_KINDS, POCKETS, deletePocketMove, getMoneyOverview, listPocketMoves, moveKind } from '../data/money.js';
import { icon } from '../ui/icon.js';
import { iconButton } from '../ui/list-row.js';
import { confirmRemoval } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { moneyTiles, openAdjust, openTransfer } from './money-parts.js';

function minus(value) {
  return `${value < 0 ? '+' : '−'}${money(Math.abs(value))}`;
}

function line(label, value, strong) {
  return h('div', { class: strong ? 'detail__line detail__line--strong' : 'detail__line' },
    h('span', null, label), h('span', { class: 'money' }, value));
}

export default function moneyView(root) {
  const content = h('div', { class: 'view' });

  function moveRow(move) {
    const kind = moveKind(move);
    const adjusted = move.to_pocket ?? move.from_pocket;
    const title = kind === 'adjustment' ? `${MOVE_KINDS[kind].label} · ${POCKETS[adjusted].label}` : MOVE_KINDS[kind].label;
    const sign = kind !== 'adjustment' ? '' : move.to_pocket ? '+' : '−';
    return h('div', { class: 'row' },
      icon(MOVE_KINDS[kind].icon),
      h('div', { class: 'row__text' },
        h('span', { class: 'row__title' }, title),
        h('span', { class: 'row__subtitle' }, [formatDate(move.moved_on), move.note].filter(Boolean).join(' · '))),
      h('strong', { class: 'money' }, `${sign}${money(move.amount)}`),
      h('div', { class: 'row__actions' }, iconButton('trash-2', 'Eliminar este movimiento', async () => {
        const detail = kind === 'adjustment'
          ? `El saldo de ${POCKETS[adjusted].label.toLowerCase()} y tu disponible cambiarán ${money(move.amount)}.`
          : `Los ${money(move.amount)} regresan a ${POCKETS[move.from_pocket].label.toLowerCase()}.`;
        if (!await confirmRemoval(`${title} de ${money(move.amount)}`, detail)) return;
        try {
          await deletePocketMove(move.id);
          await load();
        } catch (error) {
          toast(error.message, 'error');
        }
      })));
  }

  async function load() {
    try {
      const [overview, moves] = await Promise.all([getMoneyOverview(), listPocketMoves()]);
      fill(content,
        h('section', { class: 'stats stats--money' }, moneyTiles(overview)),
        overview.cash < 0 ? h('div', { class: 'notice notice--warning' },
          icon('triangle-alert', 18),
          h('span', null, `El efectivo está en ${money(overview.cash)}. Casi siempre es un retiro de cajero sin registrar, o falta ajustar el saldo.`)) : null,
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => openAdjust(overview, load) }, icon('scale', 18), 'Ajustar saldo'),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => openTransfer('deposit', overview, load) },
            icon(MOVE_KINDS.deposit.icon, 18), 'Depósito'),
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openTransfer('withdrawal', overview, load) },
            icon(MOVE_KINDS.withdrawal.icon, 18), 'Retiro de cajero')),
        h('section', { class: 'card plan' },
          h('h2', { class: 'section-title' }, 'Cómo se calcula'),
          h('div', { class: 'detail' },
            line('En efectivo', money(overview.cash)),
            line('En tarjeta', money(overview.bank)),
            overview.reserve ? line('Menos la reserva', minus(overview.reserve)) : null,
            overview.savings ? line('Menos lo ahorrado en metas', minus(overview.savings)) : null,
            line('Disponible', money(overview.available), true),
            line('Menos lo que falta por pagar este mes', minus(overview.pending)),
            line('Libre después de pagos', money(overview.free), true)),
          h('p', { class: 'field__hint' },
            'Cada ingreso, ticket y pago mueve el efectivo o la tarjeta según su método de pago. Lo comprado con tarjeta de crédito no baja ninguno hasta que pagas la tarjeta.')),
        h('h2', { class: 'section-title' }, 'Movimientos entre efectivo y tarjeta'),
        h('div', { class: 'list' }, moves.length
          ? moves.map(moveRow)
          : h('p', { class: 'list__empty' }, 'Aquí aparecerán los retiros de cajero, depósitos y ajustes de saldo.')));
    } catch (error) {
      toast(`No se pudo cargar tu dinero: ${error.message}`, 'error');
    }
  }

  root.append(content);
  load();
  return on('data:changed', load);
}
