import { h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { money, monthEnd, monthLabel, monthStart, todayISO, wholeMoney } from '../../core/format.js';
import { getBudgetOverview } from '../../data/budgets.js';
import { listCategories } from '../../data/categories.js';
import { getTrend } from '../../data/dashboard.js';
import { MOVE_KINDS, getMoneyOverview } from '../../data/money.js';
import { getMonthSummary } from '../../data/months.js';
import { listObligations } from '../../data/payments.js';
import { listProducts } from '../../data/products.js';
import { listOpenMonths } from '../../data/savings.js';
import { trendChart } from '../../ui/chart.js';
import { icon } from '../../ui/icon.js';
import { deltaBadge, statTile } from '../../ui/stat.js';
import { toast } from '../../ui/toast.js';
import { moneyTiles, openTransfer } from '../money-parts.js';
import { buildAlerts } from './alerts.js';

const MONTHS = 12;
const MIN_MONTHS = 6;
const FIRST_PROJECTION_DAY = 5;

function shortMonth(month) {
  return `${monthLabel(month).slice(0, 3)} ${month.slice(2, 4)}`;
}

export default function general(root) {
  const content = h('div', { class: 'view' });
  let chart = null;

  async function load() {
    const today = todayISO();
    const month = monthStart(today);
    try {
      const [summary, overview, categories, obligations, openMonths, history, products, wallet] = await Promise.all([
        getMonthSummary(month), getBudgetOverview(month), listCategories(), listObligations(month), listOpenMonths(),
        getTrend(MONTHS), listProducts(), getMoneyOverview(),
      ]);
      const day = Number(today.slice(8, 10));
      const days = Number(monthEnd(month).slice(8, 10));
      const plan = summary.total_budget || summary.budgeted;
      const projected = day >= FIRST_PROJECTION_DAY ? summary.spent / day * days : null;
      const previous = history.at(-2)?.spent ?? 0;
      const firstUsed = history.findIndex((entry) => entry.spent || entry.incomes);
      const trend = history.slice(Math.max(Math.min(firstUsed < 0 ? MONTHS : firstUsed, MONTHS - MIN_MONTHS), 0));
      const alerts = buildAlerts({ today, plan, projected, overview, categories, obligations, openMonths, wallet });
      const top = products.slice(0, 5);
      const most = Math.max(...top.map((product) => product.times_bought), 1);

      chart?.destroy();
      chart = trendChart({
        label: 'Ingresos y gastos por mes',
        labels: trend.map((entry) => shortMonth(entry.month)),
        series: [
          { label: 'Ingresos', data: trend.map((entry) => entry.incomes) },
          { label: 'Gastado', data: trend.map((entry) => entry.spent) },
        ],
        formatY: money,
        formatTick: wholeMoney,
      });

      content.replaceChildren(
        h('div', { class: 'plan__header' },
          h('h2', { class: 'section-title' }, 'Tu dinero'),
          h('div', { class: 'toolbar' },
            h('a', { class: 'btn btn--ghost', href: '#/dinero' }, 'Ver detalle'),
            h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => openTransfer('withdrawal', wallet, load) },
              icon(MOVE_KINDS.withdrawal.icon, 18), 'Retiro de cajero'))),
        h('section', { class: 'stats stats--money' }, moneyTiles(wallet)),
        h('h2', { class: 'section-title' }, monthLabel(month)),
        h('section', { class: 'stats' },
          statTile({
            label: 'Gastado en el mes',
            value: money(summary.spent),
            hint: previous ? [deltaBadge(summary.spent, previous), ` vs. ${money(previous)} del mes anterior`] : `${summary.tickets} tickets`,
          }),
          statTile({ label: 'Ingresos del mes', value: money(summary.incomes), hint: 'Lo recibido en efectivo y en tarjeta' }),
          statTile({
            label: 'Presupuesto restante',
            value: plan ? money(plan - summary.spent) : '—',
            hint: plan ? `De ${money(plan)} planeados` : 'Define tu plan en Presupuestos',
          }),
          statTile({ label: 'Por pagar', value: money(summary.obligations_pending), hint: `Pagado ${money(summary.obligations_paid)} de ${money(summary.obligations_total)}` }),
          statTile({
            label: 'Ahorrado este mes',
            value: money(summary.savings_in),
            hint: `En metas ${money(wallet.savings)} · reserva ${money(wallet.reserve)}`,
          }),
          statTile(projected == null
            ? { label: 'Proyección de fin de mes', value: '—', hint: `Se calcula a partir del día ${FIRST_PROJECTION_DAY} del mes` }
            : {
              label: 'Proyección de fin de mes',
              value: money(projected),
              hint: plan
                ? `${money(Math.abs(plan - projected))} ${projected > plan ? 'arriba' : 'abajo'} del plan, al ritmo actual`
                : 'Gasto estimado al ritmo actual',
            })),
        h('section', { class: 'view' },
          h('h2', { class: 'section-title' }, 'Alertas'),
          alerts.length
            ? h('div', { class: 'list' }, alerts)
            : h('p', { class: 'list__empty card' }, 'Todo en orden: sin pagos por vencer ni presupuestos en riesgo.')),
        h('section', { class: 'card trend' },
          h('div', { class: 'plan__header' },
            h('h2', { class: 'section-title' }, `Últimos ${trend.length} meses`),
            h('div', { class: 'legend', 'aria-hidden': 'true' },
              h('span', { class: 'legend__item' }, h('span', { class: 'legend__line' }), 'Ingresos'),
              h('span', { class: 'legend__item' }, h('span', { class: 'legend__line legend__line--second' }), 'Gastado'))),
          chart.element,
          h('details', { class: 'trend__table' },
            h('summary', { class: 'budget__toggle' }, 'Ver los números'),
            h('table', { class: 'table' },
              h('thead', null, h('tr', null,
                h('th', null, 'Mes'), h('th', { class: 'table__number' }, 'Ingresos'),
                h('th', { class: 'table__number' }, 'Gastado'), h('th', { class: 'table__number' }, 'Diferencia'))),
              h('tbody', null, [...trend].reverse().map((entry) => h('tr', null,
                h('td', null, monthLabel(entry.month)),
                h('td', { class: 'table__number' }, money(entry.incomes)),
                h('td', { class: 'table__number' }, money(entry.spent)),
                h('td', { class: 'table__number' }, money(entry.incomes - entry.spent)))))))),
        h('section', { class: 'view' },
          h('div', { class: 'plan__header' },
            h('h2', { class: 'section-title' }, 'Productos más comprados'),
            h('a', { class: 'btn btn--ghost', href: '#/historial?tab=productos' }, 'Ver todos')),
          h('div', { class: 'list' }, top.length ? top.map((product) => h('div', { class: 'row row--padded' },
            h('div', { class: 'row__text' },
              h('span', { class: 'row__title' }, product.name),
              h('span', { class: 'row__subtitle' },
                `${product.times_bought === 1 ? '1 compra' : `${product.times_bought} compras`} · último ${money(product.last_price)} / ${product.unit}`),
              h('span', { class: 'meter' }, h('span', { class: 'meter__fill', style: `width:${product.times_bought / most * 100}%` }))),
            h('strong', { class: 'money' }, money(product.total_spent))))
            : h('p', { class: 'list__empty' }, 'Aquí aparecerán los productos que más compras.'))));
    } catch (error) {
      toast(`No se pudo cargar el resumen: ${error.message}`, 'error');
    }
  }

  root.append(content);
  load();
  const stop = on('data:changed', load);
  return () => {
    stop();
    chart?.destroy();
  };
}
