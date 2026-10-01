import { monthStart, todayISO } from '../core/format.js';
import { cachedRead } from '../core/offline.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';
import { deleteRow, insertRow } from './crud.js';
import { getMonthSummary } from './months.js';

export function listGoals() {
  return cachedRead('goals', async () => unwrap(await supabase.from('v_savings_goals')
    .select('*')
    .order('archived')
    .order('target_month')
    .order('name')));
}

export function monthlyQuota(goal) {
  return Math.round((goal.remaining + Math.max(goal.saved_this_month, 0)) / goal.months_left * 100) / 100;
}

export async function saveGoal(goal) {
  return unwrap(await supabase.from('savings_goals').upsert(goal).select().single());
}

export function deleteGoal(id) {
  return deleteRow('savings_goals', id);
}

export function listGoalMovements(goalId) {
  return cachedRead(`goal-movements:${goalId}`, async () => unwrap(await supabase.from('savings_movements')
    .select('id, moved_on, amount, note')
    .eq('goal_id', goalId)
    .order('moved_on', { ascending: false })
    .order('created_at', { ascending: false })));
}

export function addGoalMovement(movement) {
  return insertRow('savings_movements', movement);
}

export function deleteGoalMovement(id) {
  return deleteRow('savings_movements', id);
}

export function listReserveMovements() {
  return cachedRead('reserve', async () => unwrap(await supabase.from('reserve_movements')
    .select('id, moved_on, month, amount, kind, note')
    .order('moved_on', { ascending: false })
    .order('created_at', { ascending: false })));
}

export function addReserveMovement(movement) {
  return insertRow('reserve_movements', { ...movement, month: monthStart(movement.moved_on), kind: 'manual' });
}

export function deleteReserveMovement(id) {
  return deleteRow('reserve_movements', id);
}

export async function listOpenMonths() {
  const plans = await cachedRead('open-months', async () => unwrap(await supabase.from('month_plans')
    .select('month')
    .is('closed_at', null)
    .lt('month', monthStart(todayISO()))
    .order('month')));
  return Promise.all(plans.map(async ({ month }) => ({ month, leftover: (await getMonthSummary(month)).available })));
}

export function closeMonth(month) {
  return rpc('close_month', { p_month: month });
}

export function reopenMonth(month) {
  return rpc('reopen_month', { p_month: month });
}
