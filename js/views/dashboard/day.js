import { fill, h } from '../../core/dom.js';
import { on } from '../../core/events.js';
import { addDays, daysBetween, money, monthEnd, monthStart, todayISO } from '../../core/format.js';
import { getMonthSummary } from '../../data/months.js';
import { icon } from '../../ui/icon.js';
import { iconButton } from '../../ui/list-row.js';
import { statTile } from '../../ui/stat.js';
import { toast } from '../../ui/toast.js';
import { dayDetail } from '../day-detail.js';

export default function day(root, query) {
  const content = h('div', { class: 'view' });
  let selected = query.get('dia') ?? todayISO();

  function go(target) {
    selected = target;
    history.replaceState(null, '', `#/?vista=dia&dia=${target}`);
    load();
  }

  async function load() {
    const current = selected;
    const today = todayISO();
    try {
      const [{ nodes, total }, summary] = await Promise.all([dayDetail(current), getMonthSummary(monthStart(current))]);
      if (current !== selected) return;
      const plan = summary.total_budget || summary.budgeted;
      const left = daysBetween(current, monthEnd(current)) + 1;
      const [header, ...rest] = nodes;
      fill(content,
        h('div', { class: 'month-nav' },
          iconButton('chevron-left', 'Día anterior', () => go(addDays(current, -1))),
          header,
          iconButton('chevron-right', 'Día siguiente', () => go(addDays(current, 1)))),
        current === today ? null : h('button', { class: 'btn btn--ghost day__today', type: 'button', onclick: () => go(today) },
          icon('calendar-days', 18), 'Ir a hoy'),
        h('section', { class: 'stats' },
          statTile({ label: 'Gastado en el día', value: money(total), hint: `Del mes: ${money(summary.spent)}`, featured: true }),
          statTile(current === today && plan
            ? {
              label: 'Puedes gastar por día',
              value: money(Math.max(plan - summary.spent, 0) / left),
              hint: `Quedan ${money(Math.max(plan - summary.spent, 0))} del plan y ${left === 1 ? '1 día' : `${left} días`}`,
            }
            : { label: 'Disponible del mes', value: money(summary.available), hint: 'Lo que queda en el mes de este día' })),
        ...rest);
    } catch (error) {
      toast(`No se pudo cargar el día: ${error.message}`, 'error');
    }
  }

  root.append(content);
  load();
  return on('data:changed', load);
}
