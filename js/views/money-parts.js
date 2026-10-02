import { h } from '../core/dom.js';
import { money, todayISO } from '../core/format.js';
import { MOVE_KINDS, POCKETS, addTransfer, adjustPocket } from '../data/money.js';
import { field, selectInput, textInput } from '../ui/field.js';
import { openFormModal } from '../ui/modal.js';
import { statTile } from '../ui/stat.js';
import { toast } from '../ui/toast.js';

export function moneyTiles(overview) {
  const aside = overview.savings + overview.reserve;
  return [
    statTile({
      label: 'Disponible',
      value: money(overview.available),
      hint: aside ? `Efectivo y tarjeta, sin los ${money(aside)} de ahorro y reserva` : 'Efectivo más tarjeta',
      featured: true,
    }),
    statTile({
      label: 'En efectivo',
      value: money(overview.cash),
      hint: overview.cash < 0 ? 'En negativo: ¿falta registrar un retiro?' : 'Lo que hay en la cartera',
    }),
    statTile({
      label: 'En tarjeta',
      value: money(overview.bank),
      hint: overview.bank < 0 ? 'En negativo: revisa y ajusta el saldo' : 'Lo que hay en la cuenta',
    }),
    statTile({
      label: 'Libre después de pagos',
      value: money(overview.free),
      hint: overview.pending ? `Faltan por pagar ${money(overview.pending)} este mes` : 'Sin pagos pendientes este mes',
    }),
  ];
}

export function openTransfer(kind, overview, onDone) {
  const { label, from, to } = MOVE_KINDS[kind];
  const amount = textInput({ type: 'number', inputMode: 'decimal', min: '0.01', step: '0.01', required: true, autofocus: true, placeholder: '0.00' });
  const date = textInput({ type: 'date', required: true, value: todayISO() });
  const note = textInput({ maxLength: 120 });
  openFormModal({
    title: label,
    submitLabel: 'Registrar',
    body: [
      field('Monto', amount,
        `Pasa de ${POCKETS[from].label.toLowerCase()} a ${POCKETS[to].label.toLowerCase()}. No es un gasto: tu disponible no cambia. En ${POCKETS[from].label.toLowerCase()} hay ${money(overview[from])}.`),
      field('Fecha', date),
      field('Nota', note, 'Opcional.'),
      kind === 'withdrawal'
        ? h('p', { class: 'field__hint' }, 'Si el cajero cobró comisión, regístrala aparte como un ticket pagado con la tarjeta.')
        : null,
    ],
    async onSubmit() {
      await addTransfer(kind, {
        id: crypto.randomUUID(),
        amount: Number(amount.value),
        moved_on: date.value,
        note: note.value.trim() || null,
      });
      toast(`${label}: ${money(Number(amount.value))}`);
      await onDone();
    },
  });
}

export function openAdjust(overview, onDone) {
  const pocket = selectInput(Object.entries(POCKETS).map(([value, { label }]) => ({ value, label })), 'cash');
  const balance = textInput({ type: 'number', inputMode: 'decimal', step: '0.01', required: true, autofocus: true, placeholder: '0.00' });
  const hint = document.createTextNode('');
  const note = textInput({ maxLength: 120 });
  const describe = () => {
    hint.textContent = `La app calcula ${money(overview[pocket.value])}. Escribe lo que hay en realidad; la diferencia se guarda como ajuste.`;
  };
  pocket.addEventListener('change', describe);
  describe();
  openFormModal({
    title: 'Ajustar saldo',
    submitLabel: 'Ajustar',
    body: [
      field('¿Qué saldo quieres ajustar?', pocket),
      field('Saldo real', balance, hint),
      field('Nota', note, 'Opcional.'),
    ],
    async onSubmit() {
      const difference = await adjustPocket({
        id: crypto.randomUUID(),
        pocket: pocket.value,
        balance: Number(balance.value),
        moved_on: todayISO(),
        note: note.value.trim() || null,
      });
      toast(difference
        ? `Saldo de ${POCKETS[pocket.value].label.toLowerCase()} ajustado: ${difference > 0 ? '+' : '−'}${money(Math.abs(difference))}`
        : 'El saldo ya coincidía; no se cambió nada.');
      await onDone();
    },
  });
}
