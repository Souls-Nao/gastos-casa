import { todayISO } from '../core/format.js';
import { cachedRead } from '../core/offline.js';
import { rpc } from '../core/supabase.js';
import { NO_CATEGORY } from './categories.js';

export function getTrend(months) {
  return cachedRead(`trend:${months}`, () => rpc('monthly_trend', { p_months: months, p_until: todayISO() }));
}

export function categoryBreakdown(items, categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map();
  for (const item of items) {
    const category = byId.get(item.category_id);
    const parent = (category?.parent_id ? byId.get(category.parent_id) : category) ?? NO_CATEGORY;
    const group = groups.get(parent.id) ?? { category: parent, total: 0, children: new Map() };
    group.total += item.net_amount;
    if (category?.parent_id) group.children.set(category.name, (group.children.get(category.name) ?? 0) + item.net_amount);
    groups.set(parent.id, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}
