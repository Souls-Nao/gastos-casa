import { fill, h } from '../core/dom.js';
import { on } from '../core/events.js';
import { addMonths, money, monthLabel } from '../core/format.js';
import { getState, watch } from '../core/store.js';
import { budgetStatus, getBudgetOverview, saveMonthPlan, setBudget } from '../data/budgets.js';
import { categoryTree, listCategories } from '../data/categories.js';
import { getMonthSummary, selectMonth } from '../data/months.js';
import { barsLegend, budgetBars, statusMeter } from '../ui/budget-bars.js';
import { categoryIcon } from '../ui/category-icon.js';
import { field, selectInput, textInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { iconButton } from '../ui/list-row.js';
import { confirmRemoval, openFormModal } from '../ui/modal.js';
import { createMonthNav } from '../ui/month-nav.js';
import { toast } from '../ui/toast.js';
import { ruleCard } from './budgets-rule.js';

const EMPTY = { budget: null, q1_budget: null, spent: 0, spent_q1: 0, previous: 0, average: 0 };
const DEFAULT_PLAN = { total_budget: 0, opening_balance: 0, split_mode: 'month' };

function moneyInput(value) {
  return textInput({ type: 'number', inputMode: 'decimal', min: '0', step: '0.01', placeholder: '0.00', value: value || '' });
}

function statusTag(spent, budget) {
  const status = budgetStatus(spent, budget);
  if (status === 'over') return h('span', { class: 'tag tag--danger' }, 'Excedido');
  if (status === 'near') return h('span', { class: 'tag tag--warning' }, `${Math.floor(spent / budget * 100)}% usado`);
  return null;
}

function amountsText(spent, budget) {
  if (!budget) return `${money(spent)} gastado · sin presupuesto`;
  return spent > budget
    ? `${money(spent)} de ${money(budget)} · excedido por ${money(spent - budget)}`
    : `${money(spent)} de ${money(budget)} · quedan ${money(budget - spent)}`;
}

export default function budgets(root) {
  const content = h('div', { class: 'view' });
  const open = new Set();
  let plan = DEFAULT_PLAN;
  let rows = new Map();
  let tree = [];
  let uncategorized = 0;
  let summary = { incomes: 0, savings_in: 0, reserve_in: 0 };

  const nav = createMonthNav(async (step) => {
    try {
      await selectMonth(addMonths(getState().month, step));
    } catch (error) {
      toast(`No se pudo abrir el mes: ${error.message}`, 'error');
    }
  });

  const rowOf = (category) => rows.get(category.id) ?? EMPTY;
  const biweekly = () => plan.split_mode === 'biweekly';
  const firstHalf = (row) => row.q1_budget ?? row.budget / 2;

  function editPlan(assigned) {
    const total = moneyInput(plan.total_budget);
    const opening = textInput({ type: 'number', inputMode: 'decimal', step: '0.01', placeholder: '0.00', value: plan.opening_balance || '' });
    const mode = selectInput([
      { value: 'month', label: 'Todo el mes' },
      { value: 'biweekly', label: 'Por quincenas' },
    ], plan.split_mode);
    openFormModal({
      title: `Plan de ${monthLabel(getState().month).toLowerCase()}`,
      body: [
        field('Total a usar en el mes', total, `Las categorías tienen asignado ${money(assigned)}.`),
        field('Saldo inicial', opening, 'Dinero con el que empiezas el mes. Se suma al disponible.'),
        field('Ver los presupuestos', mode, 'Por quincenas separa cada presupuesto en días 1 al 15 y 16 a fin de mes.'),
      ],
      async onSubmit() {
        await saveMonthPlan(getState().month, {
          total_budget: Number(total.value) || 0,
          opening_balance: Number(opening.value) || 0,
          split_mode: mode.value,
        });
        await load(getState().month);
      },
    });
  }

  function editBudget(category, parent) {
    const row = rowOf(category);
    const split = biweekly();
    const first = moneyInput(split && row.budget ? firstHalf(row) : row.budget);
    const second = moneyInput(row.budget ? row.budget - firstHalf(row) : null);
    const amount = () => (split ? (Number(first.value) || 0) + (Number(second.value) || 0) : Number(first.value) || 0);
    const children = (category.children ?? []).reduce((sum, child) => sum + (rowOf(child).budget ?? 0), 0);
    first.autofocus = true;

    openFormModal({
      title: `Presupuesto de ${category.name}`,
      body: [
        split
          ? h('div', { class: 'form__pair' }, field('1ª quincena (día 1 al 15)', first), field('2ª quincena (16 a fin de mes)', second))
          : field('Presupuesto del mes', first),
        h('div', { class: 'detail' },
          h('div', { class: 'detail__line' }, h('span', null, 'Gastado este mes'), h('span', { class: 'money' }, money(row.spent))),
          h('div', { class: 'detail__line' }, h('span', null, 'Mes anterior'), h('span', { class: 'money' }, money(row.previous))),
          h('div', { class: 'detail__line' }, h('span', null, 'Promedio de los últimos meses'), h('span', { class: 'money' }, money(row.average)))),
        row.average ? h('button', {
          class: 'btn btn--ghost form__extra',
          type: 'button',
          onclick() {
            const suggestion = Math.ceil(row.average);
            first.value = split ? suggestion / 2 : suggestion;
            second.value = suggestion / 2;
          },
        }, icon('lightbulb', 18), `Usar la sugerencia de ${money(Math.ceil(row.average))}`) : null,
        children ? h('p', { class: 'field__hint' }, `Sus subcategorías tienen asignado ${money(children)}; el presupuesto no puede ser menor.`) : null,
      ],
      async onSubmit() {
        if (amount() <= 0) throw new Error('Escribe un monto mayor a cero, o usa "Quitar presupuesto".');
        const raised = await setBudget(getState().month, category.id, amount(), split ? Number(first.value) || 0 : null);
        if (raised) toast(`El presupuesto de ${(parent ?? category).name} quedó en ${money(raised)} para cubrir sus subcategorías.`);
        await load(getState().month);
      },
      remove: row.budget && {
        label: 'Quitar presupuesto',
        async run() {
          const detail = children ? 'También se quitan los presupuestos de sus subcategorías.' : 'La categoría quedará sin límite este mes.';
          if (!await confirmRemoval(`Presupuesto de ${category.name}`, detail)) return false;
          await setBudget(getState().month, category.id, 0);
          await load(getState().month);
          return true;
        },
      },
    });
  }

  function quincenas(row) {
    const q1 = firstHalf(row);
    const q2 = row.budget - q1;
    const spent2 = row.spent - row.spent_q1;
    return h('div', { class: 'quincenas' },
      h('div', { class: 'quincena' },
        h('span', { class: 'quincena__label' }, '1ª quincena'),
        h('span', { class: 'money' }, `${money(row.spent_q1)} de ${money(q1)}`),
        statusMeter(row.spent_q1, q1, budgetStatus(row.spent_q1, q1))),
      h('div', { class: 'quincena' },
        h('span', { class: 'quincena__label' }, '2ª quincena'),
        h('span', { class: 'money' }, `${money(spent2)} de ${money(q2)}`),
        statusMeter(spent2, q2, budgetStatus(spent2, q2))));
  }

  function block(category, parent) {
    const row = rowOf(category);
    return h('div', { class: parent ? 'budget budget--child' : 'budget' },
      h('div', { class: 'row' },
        parent ? null : categoryIcon(category),
        h('div', { class: 'row__text' },
          h('span', { class: 'row__title' },
            category.name,
            statusTag(row.spent, row.budget),
            row.previous && row.spent > row.previous ? h('span', { class: 'tag' }, 'Arriba del mes anterior') : null),
          h('span', { class: 'row__subtitle money' }, amountsText(row.spent, row.budget))),
        h('div', { class: 'row__actions' },
          iconButton('pencil', row.budget ? 'Editar presupuesto' : 'Asignar presupuesto', () => editBudget(category, parent)))),
      budgetBars({
        spent: row.spent,
        budget: row.budget,
        previous: row.previous,
        status: budgetStatus(row.spent, row.budget),
        label: `${category.name}: gastado ${money(row.spent)}, presupuesto ${money(row.budget ?? 0)}, mes anterior ${money(row.previous)}`,
      }),
      h('span', { class: 'budget__previous money' }, `Mes anterior: ${money(row.previous)}`),
      biweekly() && row.budget ? quincenas(row) : null);
  }

  function render() {
    const month = getState().month;
    const top = tree.map(rowOf);
    const spent = top.reduce((sum, row) => sum + row.spent, 0) + uncategorized;
    const previous = top.reduce((sum, row) => sum + row.previous, 0);
    const assigned = top.reduce((sum, row) => sum + (row.budget ?? 0), 0);
    const unassigned = plan.total_budget - assigned;
    const alerts = tree
      .map((category) => ({ category, row: rowOf(category), status: budgetStatus(rowOf(category).spent, rowOf(category).budget) }))
      .filter((entry) => entry.status === 'over' || entry.status === 'near');

    fill(content,
      h('section', { class: 'card plan' },
        h('div', { class: 'plan__header' },
          h('h2', { class: 'section-title' }, `Plan de ${monthLabel(month).toLowerCase()}`),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => editPlan(assigned) }, icon('pencil', 18), 'Editar plan')),
        h('div', { class: 'mini-stats plan__stats' },
          h('div', { class: 'mini-stat' }, h('span', { class: 'mini-stat__label' }, 'Total a usar'), h('strong', { class: 'money' }, money(plan.total_budget))),
          h('div', { class: 'mini-stat' }, h('span', { class: 'mini-stat__label' }, 'Asignado a categorías'), h('strong', { class: 'money' }, money(assigned))),
          h('div', { class: 'mini-stat' }, h('span', { class: 'mini-stat__label' }, 'Saldo inicial'), h('strong', { class: 'money' }, money(plan.opening_balance))),
          h('div', { class: 'mini-stat' }, h('span', { class: 'mini-stat__label' }, 'Presupuestos'), h('strong', null, biweekly() ? 'Por quincenas' : 'Todo el mes'))),
        h('span', { class: 'row__title' }, statusTag(spent, plan.total_budget), h('span', { class: 'money' }, amountsText(spent, plan.total_budget))),
        budgetBars({
          spent,
          budget: plan.total_budget,
          previous,
          status: budgetStatus(spent, plan.total_budget),
          label: `Total del mes: gastado ${money(spent)}, plan ${money(plan.total_budget)}, mes anterior ${money(previous)}`,
        }),
        h('span', { class: 'budget__previous money' }, `Mes anterior: ${money(previous)}`),
        plan.total_budget && unassigned ? h('p', { class: 'field__hint' }, unassigned > 0
          ? `Quedan ${money(unassigned)} del plan sin asignar a una categoría.`
          : `Las categorías suman ${money(-unassigned)} más que el total del plan.`) : null),
      ruleCard({ categories: tree, spentOf: (category) => rowOf(category).spent, summary, reload: () => load(getState().month) }),
      alerts.length ? h('div', { class: 'notice notice--warning' },
        icon('triangle-alert', 18),
        h('span', null, `${alerts.length === 1 ? '1 categoría en alerta' : `${alerts.length} categorías en alerta`}: ${alerts.map((entry) =>
          `${entry.category.name} (${entry.status === 'over' ? 'excedida' : `${Math.floor(entry.row.spent / entry.row.budget * 100)}%`})`).join(', ')}.`)) : null,
      barsLegend(),
      ...tree.map((category) => h('article', { class: 'card budget-card' },
        block(category),
        category.children.length ? h('details', {
          class: 'budget__children',
          open: open.has(category.id),
          ontoggle(event) {
            if (event.target.open) open.add(category.id);
            else open.delete(category.id);
          },
        },
        h('summary', { class: 'budget__toggle' }, icon('chevron-right', 16),
          category.children.length === 1 ? '1 subcategoría' : `${category.children.length} subcategorías`),
        category.children.map((child) => block(child, category))) : null)),
      uncategorized ? h('p', { class: 'field__hint' }, `Además hay ${money(uncategorized)} gastados en artículos sin categoría.`) : null);
  }

  async function load(month) {
    nav.setMonth(month);
    try {
      const [overview, categories, monthSummary] = await Promise.all([getBudgetOverview(month), listCategories(), getMonthSummary(month)]);
      if (month !== getState().month) return;
      plan = overview.plan ?? DEFAULT_PLAN;
      rows = new Map(overview.rows.map((row) => [row.category_id, row]));
      uncategorized = overview.uncategorized;
      summary = monthSummary;
      const relevant = (category) => {
        const row = rowOf(category);
        return !category.hidden || row.budget || row.spent || row.previous;
      };
      tree = categoryTree(categories, 'expense')
        .filter(relevant)
        .map((category) => ({ ...category, children: category.children.filter(relevant) }));
      render();
    } catch (error) {
      toast(`No se pudieron cargar los presupuestos: ${error.message}`, 'error');
    }
  }

  root.append(nav.element, content);
  load(getState().month);
  const stopMonth = watch('month', load);
  const stopData = on('data:changed', () => load(getState().month));
  return () => {
    stopMonth();
    stopData();
  };
}
