import { getState } from '../core/store.js';
import { deleteRow, insertRow, listRows, nextOrder, updateRow, usageCount } from './crud.js';
import { ensureMonth } from './months.js';

export const PAYMENT_TYPES = {
  cash: { label: 'Efectivo', icon: 'banknote' },
  debit: { label: 'Débito', icon: 'credit-card' },
  credit: { label: 'Crédito', icon: 'credit-card' },
  transfer: { label: 'Transferencia', icon: 'arrow-left-right' },
  voucher: { label: 'Vales', icon: 'ticket' },
};

export function listPaymentMethods() {
  return listRows('payment_methods', 'sort_order', 'name');
}

export async function createPaymentMethod(values) {
  const saved = await insertRow('payment_methods', { ...values, sort_order: nextOrder(await listPaymentMethods()) });
  await ensureMonth(getState().month);
  return saved;
}

export async function updatePaymentMethod(id, values) {
  const saved = await updateRow('payment_methods', id, values);
  await ensureMonth(getState().month);
  return saved;
}

export function paymentMethodUsage(id) {
  return usageCount('payment_methods', id);
}

export async function deletePaymentMethod(id) {
  await deleteRow('payment_methods', id);
  await ensureMonth(getState().month);
}
