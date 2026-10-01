import { rpc } from '../core/supabase.js';
import { setState } from '../core/store.js';

export function ensureMonth(month) {
  return rpc('ensure_month', { p_month: month });
}

export function getMonthSummary(month) {
  return rpc('month_summary', { p_month: month });
}

export async function selectMonth(month) {
  await ensureMonth(month);
  setState({ month });
}
