import { h } from '../../core/dom.js';
import { money } from '../../core/format.js';
import { PRICE_MODES, createUnit, deleteUnit, listUnits, sameUnit, updateUnit } from '../../data/units.js';
import { field, selectInput, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { hideButton, iconButton, listRow } from '../../ui/list-row.js';
import { confirmRemoval, openFormModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';

const SAMPLE_QUANTITY = 200;
const SAMPLE_PRICE = 200;

function describe(unit) {
  const rule = unit.price_mode === 'total' ? 'El precio es el total de lo comprado' : 'Importe = cantidad × precio';
  return unit.base_unit ? `${rule} · ${unit.base_factor} ${unit.name} = 1 ${unit.base_unit}` : rule;
}

export default async function units(root) {
  const rows = h('div', { class: 'list' });
  let items = [];

  async function load() {
    items = await listUnits();
    rows.replaceChildren(...items.map((unit) => listRow({
      title: unit.name,
      subtitle: describe(unit),
      hidden: unit.hidden && 'Oculta',
      actions: [hideButton(unit, () => toggle(unit)), iconButton('pencil', 'Editar', () => edit(unit))],
    })));
  }

  async function toggle(unit) {
    try {
      await updateUnit(unit.id, { hidden: !unit.hidden });
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function edit(unit) {
    const name = textInput({ required: true, maxLength: 20, autofocus: true, value: unit?.name ?? '' });
    const mode = selectInput([
      ...(unit ? [] : [{ value: '', label: 'Elige cómo se calcula…' }]),
      ...Object.entries(PRICE_MODES).map(([value, { label, formula }]) => ({ value, label: `${label} (${formula})` })),
    ], unit?.price_mode ?? '', { required: true });
    const base = selectInput([
      { value: '', label: 'Sin equivalencia' },
      ...items.filter((row) => !row.base_unit && row.id !== unit?.id).map((row) => ({ value: row.name, label: row.name })),
    ], items.find((row) => sameUnit(row.name, unit?.base_unit))?.name ?? '');
    const factor = textInput({ type: 'number', inputMode: 'decimal', min: '0.000001', step: 'any', placeholder: '1000', value: unit?.base_factor ?? '' });
    const factorLabel = document.createTextNode('');
    const factorField = field(factorLabel, factor);
    const example = h('p', { class: 'notice' });

    function refresh() {
      const label = name.value.trim() || 'unidades';
      const amount = Number(factor.value) > 0 ? Number(factor.value) : null;
      factorField.hidden = !base.value;
      factor.required = Boolean(base.value);
      factorLabel.textContent = `¿Cuántos ${label} hay en 1 ${base.value}?`;
      example.hidden = !mode.value;
      if (mode.value === 'total') {
        example.textContent = `Ejemplo: ${SAMPLE_QUANTITY} ${label} por ${money(SAMPLE_PRICE)} → importe ${money(SAMPLE_PRICE)}`
          + (base.value && amount ? `, sale a ${money(SAMPLE_PRICE / (SAMPLE_QUANTITY / amount))} por ${base.value}.` : '.');
      } else {
        example.textContent = `Ejemplo: 2 ${label} a ${money(15)} → importe ${money(30)}`
          + (base.value && amount ? `, sale a ${money(15 * amount)} por ${base.value}.` : '.');
      }
    }

    for (const control of [name, mode, base, factor]) control.addEventListener('input', refresh);
    refresh();

    openFormModal({
      title: unit ? 'Editar unidad' : 'Nueva unidad',
      body: [
        field('Nombre', name),
        field('¿Cómo se captura el precio?', mode, 'Gramos y mililitros suelen llevar el precio total; piezas, latas o kilos, el precio de cada uno.'),
        field('Para comparar precios, equivale a', base, 'Opcional. Sirve para ver a cuánto sale el kilo o el litro.'),
        factorField,
        example,
      ],
      async onSubmit() {
        const values = {
          name: name.value.trim(),
          price_mode: mode.value,
          base_unit: base.value || null,
          base_factor: base.value ? Number(factor.value) : null,
        };
        if (unit) await updateUnit(unit.id, values);
        else await createUnit(values);
        await load();
      },
      remove: unit && {
        label: 'Eliminar unidad',
        async run() {
          if (!await confirmRemoval(unit.name, 'Los artículos ya capturados conservan su unidad y su importe.')) return false;
          await deleteUnit(unit.id);
          await load();
          return true;
        },
      },
    });
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('p', { class: 'toolbar__hint' }, 'Cada unidad define cómo se calcula el importe de un artículo y cómo se comparan sus precios.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), 'Nueva unidad')),
    rows);
  await load();
}
