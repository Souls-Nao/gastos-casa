import { cachedRead } from '../core/offline.js';
import { rpc } from '../core/supabase.js';

export function getDailyTotals(month) {
  return cachedRead(`daily:${month}`, () => rpc('daily_totals', { p_month: month }));
}

export function getDayDetail(day) {
  return cachedRead(`day:${day}`, () => rpc('day_detail', { p_day: day }));
}
