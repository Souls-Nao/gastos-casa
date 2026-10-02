import { monthStart, todayISO } from '../core/format.js';
import { cachedRead } from '../core/offline.js';
import { rpc, supabase, unwrap } from '../core/supabase.js';
import { deleteRow, insertRow } from './crud.js';

export const POCKETS = {
  cash: { label: 'Efectivo', icon: 'banknote' },
  bank: { label: 'Tarjeta', icon: 'credit-card' },
};

export const MOVE_KINDS = {
  withdrawal: { label: 'Retiro de cajero', icon: 'banknote-arrow-down', from: 'bank', to: 'cash' },
  deposit: { label: 'Depósito a la tarjeta', icon: 'banknote-arrow-up', from: 'cash', to: 'bank' },
  adjustment: { label: 'Ajuste de saldo', icon: 'scale' },
};

export function getMoneyOverview() {
  return cachedRead('money', () => rpc('money_overview', { p_month: monthStart(todayISO()) }));
}

export function listPocketMoves() {
  return cachedRead('pocket-moves', async () => unwrap(await supabase.from('pocket_moves')
    .select('id, moved_on, from_pocket, to_pocket, amount, note')
    .order('moved_on', { ascending: false })
    .order('created_at', { ascending: false })));
}

export function moveKind(move) {
  if (!move.from_pocket || !move.to_pocket) return 'adjustment';
  return move.to_pocket === 'cash' ? 'withdrawal' : 'deposit';
}

export function addTransfer(kind, values) {
  return insertRow('pocket_moves', { ...values, from_pocket: MOVE_KINDS[kind].from, to_pocket: MOVE_KINDS[kind].to });
}

export function adjustPocket(adjustment) {
  return rpc('adjust_pocket', { p: adjustment });
}

export function deletePocketMove(id) {
  return deleteRow('pocket_moves', id);
}
