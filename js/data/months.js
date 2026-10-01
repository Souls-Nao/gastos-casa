import { cachedRead, isNetworkError } from '../core/offline.js';
import { setState } from '../core/store.js';
import { rpc } from '../core/supabase.js';

export async function ensureMonth(month) {
  try {
    await rpc('ensure_month', { p_month: month });
  } catch (error) {
    if (!isNetworkError(error)) throw error;
  }
}

export function getMonthSummary(month) {
  return cachedRead(`summary:${month}`, () => rpc('month_summary', { p_month: month }));
}

export async function selectMonth(month) {
  await ensureMonth(month);
  setState({ month });
}
