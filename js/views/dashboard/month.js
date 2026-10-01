import { fill, h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { addMonths, money, monthEnd, normalize } from '../../core/format.js';
import { getState, watch } from '../../core/store.js';
import { getBudgetOverview } from '../../data/budgets.js';
import { categoryTree, listCategories } from '../../data/categories.js';
import { getMonthSummary, selectMonth } from '../../data/months.js';
import { listPendingTickets, listTickets } from '../../data/tickets.js';
import { categoryIcon } from '../../ui/category-icon.js';
import { donutChart } from '../../ui/chart.js';
import { createMonthNav } from '../../ui/month-nav.js';
import { deltaBadge, statTile } from '../../ui/stat.js';
import { ticketRow } from '../../ui/ticket-row.js';
import { toast } from '../../ui/toast.js';
import { openTicketDetail } from '../ticket-detail.js';

const SEGMENTS = 5;
const OTHER_COLOR = '#7D8794';
const EMPTY = { spent: 0, previous: 0 };

export default function month(root) {
  const content = h('div', { class: 'view' });
  let chart = null;

  const nav = createMonthNav(async (step) => {
    try {
      await selectMonth(addMonths(getState().month, step));
    } catch (error) {
      toast(`No se pudo abrir el mes: ${error.message}`, 'error');
    }
  });

  function versus(row) {
    return h('span', { class: 'row__subtitle' },
      row.previous ? [deltaBadge(row.spent, row.previous), ` vs. ${money(row.previous)} del mes anterior`] : 'Sin gasto el mes anterior');
  }

  async function load(selected) {
    nav.setMonth(selected);
    try {
      const [summary, overview, categories, recent, pending] = await Promise.all([
        getMonthSummary(selected), getBudgetOverview(selected), listCategories(),
        listTickets({ from: selected, to: monthEnd(selected), limit: 10 }), listPendingTickets(),
      ]);
      if (selected !== getState().month) return;
      const rows = new Map(overview.rows.map((row) => [row.category_id, row]));
      const rowOf = (category) => rows.get(category.id) ?? EMPTY;
      const groups = categoryTree(categories, 'expense')
        .map((category) => ({ category, row: rowOf(category) }))
        .filter((group) => group.row.spent || group.row.previous)
        .sort((a, b) => b.row.spent - a.row.spent);
      const spent = groups.reduce((sum, group) => sum + group.row.spent, 0) + overview.uncategorized;
      const previous = groups.reduce((sum, group) => sum + group.row.previous, 0);
      const shown = groups.filter((group) => group.row.spent).slice(0, SEGMENTS);
      const rest = spent - shown.reduce((sum, group) => sum + group.row.spent, 0);
      const details = new Map();
      const small = groups.find((group) => normalize(group.category.name).includes('hormiga'));
      const tickets = [...pending, ...recent.rows];

      chart?.destroy();
      chart = spent ? donutChart({
        label: 'Gasto del mes por categoría',
        segments: [
          ...shown.map((group) => ({ label: group.category.name, value: group.row.spent, color: group.category.color })),
          ...(rest > 0.005 ? [{ label: 'Otras', value: rest, color: OTHER_COLOR }] : []),
        ],
        formatValue: (value) => `${money(value)} (${Math.round(value / spent * 100)}%)`,
        center: [h('span', { class: 'chart__label' }, 'Gastado'), h('strong', { class: 'money' }, money(spent))],
        onSelect(index) {
          const target = details.get(shown[index]?.category.id);
          if (!target) return;
          target.open = true;
          target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        },
      }) : null;

      fill(content,
        h('section', { class: 'stats' },
          statTile({
            label: 'Gastado en el mes',
            value: money(summary.spent),
            hint: previous ? [deltaBadge(summary.spent, previous), ` vs. ${money(previous)} del mes anterior`] : `${summary.tickets} tickets`,
            featured: true,
          }),
          statTile({ label: 'Ingresos', value: money(summary.incomes), hint: 'Recibido en el mes' }),
          statTile({ label: 'Disponible', value: money(summary.available), hint: `Libre después de compromisos: ${money(summary.free_after_commitments)}` }),
          statTile({ label: 'Por pagar', value: money(summary.obligations_pending), hint: `Pagado ${money(summary.obligations_paid)}` })),
        h('section', { class: 'card donut' },
          h('h2', { class: 'section-title' }, 'En qué se fue el dinero'),
          chart ? chart.element : h('p', { class: 'list__empty' }, 'Todavía no hay gastos en este mes.'),
          h('div', { class: 'donut__legend' }, groups.map(({ category, row }) => {
            const element = h('details', { class: 'donut__group' },
              h('summary', { class: 'donut__summary' },
                categoryIcon(category, 32),
                h('div', { class: 'row__text' },
                  h('span', { class: 'row__title' }, category.name),
                  versus(row)),
                h('div', { class: 'donut__amount' },
                  h('strong', { class: 'money' }, money(row.spent)),
                  h('span', { class: 'row__subtitle' }, spent ? `${Math.round(row.spent / spent * 100)}%` : '0%'))),
              category.children
                .map((child) => ({ child, row: rowOf(child) }))
                .filter((entry) => entry.row.spent || entry.row.previous)
                .sort((a, b) => b.row.spent - a.row.spent)
                .map((entry) => h('div', { class: 'donut__sub' },
                  h('div', { class: 'row__text' }, h('span', null, entry.child.name), versus(entry.row)),
                  h('span', { class: 'money' }, money(entry.row.spent)))));
            details.set(category.id, element);
            return element;
          }),
          overview.uncategorized ? h('p', { class: 'field__hint' }, `Además hay ${money(overview.uncategorized)} en artículos sin categoría.`) : null)),
        small ? h('section', { class: 'card plan' },
          h('div', { class: 'day__header' },
            h('div', null,
              h('h2', { class: 'section-title' }, 'Gastos hormiga'),
              versus(small.row)),
            h('strong', { class: 'day__total money' }, money(small.row.spent))),
          h('p', { class: 'field__hint' }, spent
            ? `Son el ${Math.round(small.row.spent / spent * 100)}% de lo gastado en el mes. Al año, a este ritmo, serían ${money(small.row.spent * 12)}.`
            : 'Pequeñas compras que se van sumando sin sentirlo.')) : null,
        h('section', { class: 'view' },
          h('div', { class: 'plan__header' },
            h('h2', { class: 'section-title' }, 'Últimos tickets del mes'),
            h('a', { class: 'btn btn--ghost', href: '#/historial' }, 'Ver todos')),
          h('div', { class: 'list' }, tickets.length
            ? tickets.map((ticket) => ticketRow(ticket, openTicketDetail))
            : h('p', { class: 'list__empty' }, 'Todavía no hay tickets en este mes.'))));
    } catch (error) {
      toast(`No se pudo cargar el mes: ${error.message}`, 'error');
    }
  }

  root.append(nav.element, content);
  load(getState().month);
  const stopMonth = watch('month', load);
  const stopData = on('data:changed', () => load(getState().month));
  return () => {
    stopMonth();
    stopData();
    chart?.destroy();
  };
}
