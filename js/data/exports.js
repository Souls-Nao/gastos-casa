import { formatDate } from '../core/format.js';
import { rpc } from '../core/supabase.js';
import { OBLIGATION_KINDS } from './payments.js';

const time = (value) => value?.slice(0, 5) ?? '';

export async function exportSheets(from, to) {
  const data = await rpc('export_rows', { p_from: from, p_to: to });
  return [
    {
      name: 'Gastos',
      rows: [
        ['Fecha', 'Hora', 'Tienda', 'Método de pago', 'Artículo', 'Categoría', 'Subcategoría', 'Cantidad', 'Unidad',
          'Precio unitario', 'Importe', 'Descuento del ticket', 'Total del ticket', 'Meses sin intereses', 'Nota'],
        ...data.items.map((row) => [formatDate(row.date), time(row.time), row.store, row.method, row.item, row.category, row.subcategory,
          row.quantity, row.unit, row.unit_price, row.amount, row.ticket_discount, row.ticket_total, row.msi_months, row.note]),
      ],
    },
    {
      name: 'Ingresos',
      rows: [
        ['Fecha', 'Monto', 'Categoría', 'Recibido en', 'Descripción'],
        ...data.incomes.map((row) => [formatDate(row.date), row.amount, row.category, row.method, row.description]),
      ],
    },
    {
      name: 'Pagos',
      rows: [
        ['Fecha', 'Concepto', 'Tipo', 'Monto', 'Pagado con', 'Nota'],
        ...data.payments.map((row) => [formatDate(row.date), row.name, OBLIGATION_KINDS[row.kind].label, row.amount, row.method, row.note]),
      ],
    },
    {
      name: 'Ahorro y reserva',
      rows: [
        ['Fecha', 'Tipo', 'Meta', 'Monto', 'Nota'],
        ...data.savings.map((row) => [formatDate(row.date), row.kind === 'goal' ? 'Meta de ahorro' : 'Reserva', row.name, row.amount, row.note]),
      ],
    },
  ];
}

export function backupData() {
  return rpc('backup_data');
}

export function restoreData(backup) {
  return rpc('restore_data', { p: backup });
}
