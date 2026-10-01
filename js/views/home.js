import { h } from '../core/dom.js';
import { addMonths, money, monthEnd } from '../core/format.js';
import { getState, watch } from '../core/store.js';
import { getMonthSummary, selectMonth } from '../data/months.js';
import { listTickets } from '../data/tickets.js';
import { createMonthNav } from '../ui/month-nav.js';
import { ticketRow } from '../ui/ticket-row.js';
import { toast } from '../ui/toast.js';

function stat(label, value, hint, featured = false) {
  return h('article', { class: featured ? 'stat stat--featured' : 'stat' },
    h('span', { class: 'stat__label' }, label),
    h('strong', { class: 'stat__value money' }, money(value)),
    h('span', { class: 'stat__hint' }, hint));
}

export default function home(root) {
  const stats = h('section', { class: 'stats' });
  const tickets = h('div', { class: 'list' });
  const nav = createMonthNav(async (step) => {
    try {
      await selectMonth(addMonths(getState().month, step));
    } catch (error) {
      toast(`No se pudo abrir el mes: ${error.message}`, 'error');
    }
  });

  async function load(month) {
    nav.setMonth(month);
    stats.setAttribute('aria-busy', 'true');
    try {
      const [summary, recent] = await Promise.all([
        getMonthSummary(month),
        listTickets({ from: month, to: monthEnd(month), limit: 10 }),
      ]);
      if (month !== getState().month) return;
      stats.replaceChildren(
        stat('Disponible', summary.available, 'Lo que queda hoy', true),
        stat('Libre después de compromisos', summary.free_after_commitments, 'Disponible menos pagos pendientes'),
        stat('Gastado en el mes', summary.spent, `${summary.tickets} tickets`),
        stat('Ingresos', summary.incomes, 'Recibido en el mes'),
        stat('Por pagar', summary.obligations_pending, `Pagado ${money(summary.obligations_paid)}`),
        stat('Presupuesto del mes', summary.total_budget, `Asignado ${money(summary.budgeted)}`),
      );
      tickets.replaceChildren(...(recent.length
        ? recent.map(ticketRow)
        : [h('p', { class: 'list__empty' }, 'Todavía no hay tickets en este mes.')]));
    } catch (error) {
      toast(`No se pudo cargar el resumen: ${error.message}`, 'error');
    }
    if (month === getState().month) stats.removeAttribute('aria-busy');
  }

  root.append(
    nav.element,
    stats,
    h('section', { class: 'view' }, h('h2', { class: 'section-title' }, 'Últimos tickets del mes'), tickets));
  load(getState().month);
  return watch('month', load);
}
