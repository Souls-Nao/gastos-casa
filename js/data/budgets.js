import { cachedRead } from '../core/offline.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';

export function getBudgetOverview(month) {
  return cachedRead(`budgets:${month}`, () => rpc('budget_overview', { p_month: month }));
}

export function budgetStatus(spent, budget) {
  if (!budget) return 'none';
  if (spent >= budget) return 'over';
  return spent >= budget * 0.8 ? 'near' : 'ok';
}

export function setBudget(month, categoryId, amount, firstHalf = null) {
  return rpc('set_budget', { p_month: month, p_category: categoryId, p_amount: amount, p_q1: firstHalf });
}

export async function saveMonthPlan(month, values) {
  unwrap(await supabase.from('month_plans').update(values).eq('month', month));
}
