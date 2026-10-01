import { h } from '../core/dom.js';

export function categorySelect(tree, value, { fallback, placeholder = 'Elige categoría', required = true } = {}) {
  const select = h('select', { class: 'field__input', required },
    h('option', { value: '', disabled: required }, placeholder),
    tree.map((category) => h('optgroup', { label: category.name },
      h('option', { value: category.id }, category.children.length ? `${category.name} (general)` : category.name),
      category.children.map((child) => h('option', { value: child.id }, child.name)))),
    fallback ? h('option', { value: fallback.id }, fallback.name) : null);
  select.value = value ?? '';
  return select;
}
