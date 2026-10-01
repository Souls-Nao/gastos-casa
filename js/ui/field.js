import { h } from '../core/dom.js';

export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field__label' }, label),
    control,
    hint ? h('span', { class: 'field__hint' }, hint) : null);
}

export function fieldGroup(label, control) {
  return h('div', { class: 'field', role: 'group', 'aria-label': label },
    h('span', { class: 'field__label' }, label),
    control);
}

export function textInput(props) {
  return h('input', { class: 'field__input', type: 'text', ...props });
}
