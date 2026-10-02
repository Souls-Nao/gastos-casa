import { money } from '../core/format.js';
import { deleteRow, insertRow, listRows, nextOrder, updateRow } from './crud.js';

export const PRICE_MODES = {
  unit: { label: 'Precio de cada unidad', formula: 'importe = cantidad × precio' },
  total: { label: 'Precio total de lo comprado', formula: 'importe = precio' },
};

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function listUnits() {
  return listRows('units', 'sort_order', 'name');
}

export async function createUnit(values) {
  return insertRow('units', { ...values, sort_order: nextOrder(await listUnits()) });
}

export function updateUnit(id, values) {
  return updateRow('units', id, values);
}

export function deleteUnit(id) {
  return deleteRow('units', id);
}

export function sameUnit(a, b) {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

export function unitRule(units, name) {
  const unit = units.find((row) => sameUnit(row.name, name));
  return { mode: unit?.price_mode ?? 'unit', base: unit?.base_unit ?? unit?.name ?? name, factor: unit?.base_factor ?? 1 };
}

export function itemAmount(item) {
  if (item.price_mode === 'total') return item.unit_price || 0;
  return round((item.quantity || 0) * (item.unit_price || 0));
}

export function itemSummary(item) {
  return item.price_mode === 'total' || item.unit_price == null
    ? `${item.quantity} ${item.unit}`
    : `${item.quantity} ${item.unit} × ${money(item.unit_price)}`;
}

export function priceFor(rate, quantity, rule) {
  if (rule.mode === 'unit') return round(rate / rule.factor);
  return quantity > 0 ? round(quantity / rule.factor * rate) : null;
}

export function itemPricing(units, item) {
  let rule = { ...unitRule(units, item.unit), mode: item.price_mode ?? 'unit' };
  let rate = null;

  function measure() {
    if (item.unit_price == null) rate = null;
    else if (rule.mode === 'unit') rate = item.unit_price * rule.factor;
    else rate = item.quantity > 0 ? item.unit_price / (item.quantity / rule.factor) : null;
  }

  measure();
  return {
    get rule() {
      return rule;
    },
    get rate() {
      return rate;
    },
    priceChanged: measure,
    quantityChanged() {
      if (rule.mode === 'total' && rate != null) item.unit_price = priceFor(rate, item.quantity, rule);
    },
    unitChanged() {
      const next = unitRule(units, item.unit);
      const comparable = rate != null && sameUnit(next.base, rule.base);
      rule = next;
      item.price_mode = rule.mode;
      if (comparable) item.unit_price = priceFor(rate, item.quantity, rule);
      else measure();
    },
    useProduct(product) {
      item.unit = product.unit;
      rule = unitRule(units, item.unit);
      item.price_mode = rule.mode;
      if (rule.mode === 'total' && item.quantity === 1 && product.last_quantity && sameUnit(product.last_unit, product.unit)) {
        item.quantity = product.last_quantity;
      }
      if (product.last_price != null && sameUnit(rule.base, product.ref_unit)) {
        rate = product.last_price;
        item.unit_price = priceFor(rate, item.quantity, rule);
      } else {
        measure();
      }
    },
  };
}
