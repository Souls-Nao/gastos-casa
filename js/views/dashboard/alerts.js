import { h } from '../../core/dom.js';
import { formatDate, money, monthLabel } from '../../core/format.js';
import { budgetStatus } from '../../data/budgets.js';
import { dueState, dueText } from '../../data/payments.js';
import { icon } from '../../ui/icon.js';

function alert(tone, symbol, text, href) {
  return h('a', { class: 'alert', 'data-tone': tone, href }, icon(symbol, 18), h('span', null, text), icon('chevron-right', 16));
}

export function buildAlerts({ today, plan, projected, overview, categories, obligations, openMonths }) {
  const alerts = [];
  const rows = new Map(overview.rows.map((row) => [row.category_id, row]));

  for (const obligation of obligations) {
    const { state, days } = dueState(obligation, today);
    if (state === 'overdue') {
      alerts.push(alert('danger', 'triangle-alert',
        `${obligation.name} venció el ${formatDate(obligation.due_date)}: faltan ${money(obligation.pending)}.`, '#/pagos'));
    } else if (state === 'soon') {
      alerts.push(alert('warning', 'calendar-clock', `${obligation.name} vence ${dueText(days)}: ${money(obligation.pending)}.`, '#/pagos'));
    }
  }

  for (const category of categories.filter((row) => row.kind === 'expense' && !row.parent_id)) {
    const row = rows.get(category.id);
    const status = row ? budgetStatus(row.spent, row.budget) : 'none';
    if (status === 'over') {
      alerts.push(alert('danger', 'triangle-alert',
        `${category.name}: te pasaste del presupuesto por ${money(row.spent - row.budget)}.`, '#/presupuestos'));
    } else if (status === 'near') {
      alerts.push(alert('warning', 'gauge',
        `${category.name}: llevas ${Math.floor(row.spent / row.budget * 100)}% del presupuesto.`, '#/presupuestos'));
    }
  }

  if (plan && projected > plan) {
    alerts.push(alert('warning', 'trending-up',
      `A este ritmo terminarás el mes con ${money(projected)} gastados, ${money(projected - plan)} más que tu plan.`, '#/presupuestos'));
  }

  for (const entry of openMonths) {
    alerts.push(alert('info', 'archive',
      `${monthLabel(entry.month)} ya terminó: ciérralo para pasar ${money(entry.leftover)} a la Reserva.`, '#/ahorro?tab=reserva'));
  }
  return alerts;
}
