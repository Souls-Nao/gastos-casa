import { daysBetween } from '../core/format.js';
import { cachedRead } from '../core/offline.js';
import { getState } from '../core/store.js';
import { rpc } from '../core/supabase.js';
import { deleteRow, insertRow, listRows, updateRow } from './crud.js';
import { ensureMonth } from './months.js';

export const OBLIGATION_KINDS = {
  card: { label: 'Tarjeta', icon: 'credit-card' },
  msi: { label: 'Meses sin intereses', icon: 'calendar-clock' },
  recurring: { label: 'Gasto fijo', icon: 'repeat' },
  custom: { label: 'Pago único', icon: 'receipt' },
};

export const FREQUENCIES = {
  monthly: { label: 'Cada mes', months: 1 },
  bimonthly: { label: 'Cada 2 meses', months: 2 },
  quarterly: { label: 'Cada 3 meses', months: 3 },
  semiannual: { label: 'Cada 6 meses', months: 6 },
  yearly: { label: 'Cada año', months: 12 },
};

export function listObligations(month) {
  return cachedRead(`obligations:${month}`, () => rpc('month_obligations', { p_month: month }));
}

export function dueState(obligation, today) {
  if (obligation.pending <= 0) return { state: 'paid' };
  if (!obligation.due_date) return { state: 'open' };
  const days = daysBetween(today, obligation.due_date);
  if (days < 0) return { state: 'overdue', days };
  return { state: days <= 5 ? 'soon' : 'open', days };
}

export function dueText(days) {
  if (days === 0) return 'hoy';
  return days === 1 ? 'mañana' : `en ${days} días`;
}

export function createsExpense(obligation) {
  return (obligation.kind === 'recurring' || obligation.kind === 'custom') && Boolean(obligation.category_id);
}

export function payObligation(payment) {
  return rpc('pay_obligation', { p: payment });
}

export function undoPayment(id) {
  return rpc('undo_payment', { p_payment: id });
}

export function createObligation(values) {
  return insertRow('obligations', { ...values, kind: 'custom', manual: true });
}

export function updateObligation(id, values) {
  return updateRow('obligations', id, { ...values, manual: true });
}

export function deleteObligation(id) {
  return deleteRow('obligations', id);
}

export async function useAutomaticAmount(id) {
  await updateRow('obligations', id, { manual: false });
  await ensureMonth(getState().month);
}

export function listRecurring() {
  return listRows('recurring_expenses', 'name');
}

export async function saveRecurring(values) {
  await rpc('save_recurring', { p: values });
  await ensureMonth(getState().month);
}

export function deleteRecurring(id) {
  return rpc('delete_recurring', { p_id: id });
}

export function listMsiPlans() {
  return listRows('msi_plans', 'first_month', 'description');
}

export async function saveMsiPlan(values) {
  await rpc('save_msi_plan', { p: values });
  await ensureMonth(getState().month);
}

export function deleteMsiPlan(id) {
  return deleteRow('msi_plans', id);
}
