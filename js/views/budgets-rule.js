import { h } from '../core/dom.js';
import { money, normalize } from '../core/format.js';
import { budgetStatus } from '../data/budgets.js';
import { updateCategory } from '../data/categories.js';
import { statusMeter } from '../ui/budget-bars.js';
import { field, selectInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { confirmRemoval, openFormModal } from '../ui/modal.js';

const NEED_WORDS = ['super', 'despensa', 'limpieza', 'hogar', 'servicio', 'transporte', 'salud', 'escuela'];
const GROUPS = [
  { value: 'need', label: 'Necesidad' },
  { value: 'want', label: 'Gusto' },
  { value: '', label: 'No contar' },
];

function guess(category) {
  const key = normalize(category.name);
  return NEED_WORDS.some((word) => key.includes(word)) ? 'need' : 'want';
}

function line(label, actual, target, income, status, done) {
  const share = income ? Math.round(actual / income * 100) : 0;
  return h('div', { class: 'quincena' },
    h('span', { class: 'row__title' }, label, done ? h('span', { class: 'tag tag--good' }, 'Meta cumplida') : null,
      status === 'over' ? h('span', { class: 'tag tag--danger' }, 'Arriba de la meta') : null),
    h('span', { class: 'money' }, `${money(actual)} de ${money(target)} · ${share}% de tus ingresos`),
    statusMeter(actual, target, status));
}

export function ruleCard({ categories, spentOf, summary, reload }) {
  const active = categories.some((category) => category.rule_group);

  function configure() {
    const selects = new Map(categories.map((category) => [category,
      selectInput(GROUPS, active ? category.rule_group ?? '' : guess(category))]));
    openFormModal({
      title: 'Regla 50/30/20',
      body: [
        h('p', { class: 'field__hint' }, 'Indica si cada categoría es una necesidad (lo indispensable) o un gusto. El ahorro se toma de lo que guardas en metas y reserva.'),
        [...selects].map(([category, select]) => field(category.name, select)),
      ],
      async onSubmit() {
        await Promise.all([...selects]
          .filter(([category, select]) => (category.rule_group ?? '') !== select.value)
          .map(([category, select]) => updateCategory(category, { rule_group: select.value || null })));
        await reload();
      },
      remove: active && {
        label: 'Quitar la regla',
        async run() {
          if (!await confirmRemoval('Regla 50/30/20', 'Se borra la clasificación de tus categorías; tus gastos y presupuestos no cambian.')) return false;
          await Promise.all(categories.filter((category) => category.rule_group).map((category) => updateCategory(category, { rule_group: null })));
          await reload();
          return true;
        },
      },
    });
  }

  if (!active) {
    return h('section', { class: 'card plan' },
      h('div', { class: 'plan__header' },
        h('h2', { class: 'section-title' }, 'Regla 50/30/20'),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: configure }, 'Activar')),
      h('p', { class: 'toolbar__hint' }, 'Opcional: reparte tus ingresos en 50% para necesidades, 30% para gustos y 20% para ahorro, y compara con lo que realmente pasó.'));
  }

  const income = summary.incomes;
  const total = (group) => categories.filter((category) => category.rule_group === group).reduce((sum, category) => sum + spentOf(category), 0);
  const saved = summary.savings_in + summary.reserve_in;
  const needs = total('need');
  const wants = total('want');
  return h('section', { class: 'card plan' },
    h('div', { class: 'plan__header' },
      h('h2', { class: 'section-title' }, 'Regla 50/30/20'),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: configure }, icon('pencil', 18), 'Configurar')),
    income
      ? [
        line('Necesidades (50%)', needs, income * 0.5, income, budgetStatus(needs, income * 0.5)),
        line('Gustos (30%)', wants, income * 0.3, income, budgetStatus(wants, income * 0.3)),
        line('Ahorro (20%)', saved, income * 0.2, income, 'ok', saved >= income * 0.2),
      ]
      : h('p', { class: 'toolbar__hint' }, 'Registra los ingresos del mes para calcular la regla.'));
}
