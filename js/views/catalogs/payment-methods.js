import { h } from '../../core/dom.js';
import { money } from '../../core/format.js';
import {
  PAYMENT_TYPES, createPaymentMethod, deletePaymentMethod, listPaymentMethods, paymentMethodUsage, updatePaymentMethod,
} from '../../data/payment-methods.js';
import { categoryIcon } from '../../ui/category-icon.js';
import { field, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { hideButton, iconButton, listRow } from '../../ui/list-row.js';
import { confirmRemoval, openFormModal, openModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';

function describe(method) {
  const parts = [PAYMENT_TYPES[method.type].label];
  if (method.type === 'credit') {
    if (method.closing_day) parts.push(`Corte día ${method.closing_day}`);
    if (method.due_day) parts.push(`Pago día ${method.due_day}`);
    if (method.credit_limit) parts.push(`Límite ${money(method.credit_limit)}`);
  }
  return parts.join(' · ');
}

function dayInput(value) {
  return textInput({ type: 'number', inputMode: 'numeric', min: 1, max: 31, step: 1, value: value ?? '' });
}

export default async function paymentMethods(root) {
  const rows = h('div', { class: 'list' });

  async function load() {
    const methods = await listPaymentMethods();
    rows.replaceChildren(...methods.map((method) => listRow({
      leading: categoryIcon({ icon: PAYMENT_TYPES[method.type].icon, color: method.color }),
      title: method.name,
      subtitle: describe(method),
      hidden: method.hidden && 'Oculto',
      actions: [hideButton(method, () => toggle(method)), iconButton('pencil', 'Editar', () => edit(method))],
    })));
  }

  async function toggle(method) {
    try {
      await updatePaymentMethod(method.id, { hidden: !method.hidden });
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function edit(method) {
    const name = textInput({ required: true, maxLength: 60, autofocus: true, value: method?.name ?? '' });
    const type = h('select', { class: 'field__input' },
      Object.entries(PAYMENT_TYPES).map(([value, { label }]) => h('option', { value }, label)));
    type.value = method?.type ?? 'debit';
    const closing = dayInput(method?.closing_day);
    const due = dayInput(method?.due_day);
    const limit = textInput({ type: 'number', inputMode: 'decimal', min: 0, step: 0.01, value: method?.credit_limit ?? '' });
    const card = h('div', { class: 'form__section' },
      h('div', { class: 'form__pair' },
        field('Día de corte', closing),
        field('Día de pago', due)),
      field('Límite de crédito', limit, 'Opcional. Con el día de corte, la app calcula cuánto pagar cada mes.'));
    const sync = () => {
      card.hidden = type.value !== 'credit';
    };
    type.addEventListener('change', sync);
    sync();

    openFormModal({
      title: method ? 'Editar método de pago' : 'Nuevo método de pago',
      body: [field('Nombre', name), field('Tipo', type), card],
      async onSubmit() {
        const credit = type.value === 'credit';
        const values = {
          name: name.value.trim(),
          type: type.value,
          closing_day: credit && closing.value ? Number(closing.value) : null,
          due_day: credit && due.value ? Number(due.value) : null,
          credit_limit: credit && limit.value ? Number(limit.value) : null,
        };
        if (method) await updatePaymentMethod(method.id, values);
        else await createPaymentMethod(values);
        await load();
      },
      remove: method && {
        label: 'Eliminar método de pago',
        async run() {
          const count = await paymentMethodUsage(method.id);
          if (count) {
            openModal({
              title: 'No se puede eliminar',
              body: h('p', null, `«${method.name}» ya tiene movimientos registrados (${count}). Eliminarlo cambiaría las cuentas de esos meses; si ya no lo usas, ocúltalo.`),
              actions: [{ label: 'Entendido', value: 'ok', variant: 'primary' }],
            });
            return false;
          }
          if (!await confirmRemoval(method.name, 'No tiene movimientos registrados.')) return false;
          await deletePaymentMethod(method.id);
          await load();
          return true;
        },
      },
    });
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('p', { class: 'toolbar__hint' }, 'En las tarjetas de crédito indica el día de corte y el de pago.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), 'Nuevo método')),
    rows);
  await load();
}
