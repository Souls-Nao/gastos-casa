import { h } from '../core/dom.js';
import { icon } from './icon.js';

export function listRow({ leading, title, subtitle, hidden, actions }) {
  return h('div', { class: hidden ? 'row row--hidden' : 'row' },
    leading,
    h('div', { class: 'row__text' },
      h('span', { class: 'row__title' }, title, hidden ? h('span', { class: 'tag' }, hidden) : null),
      subtitle ? h('span', { class: 'row__subtitle' }, subtitle) : null),
    h('div', { class: 'row__actions' }, actions));
}

export function iconButton(name, label, onclick, disabled = false) {
  return h('button', { class: 'btn btn--icon', type: 'button', title: label, 'aria-label': label, disabled, onclick }, icon(name));
}

export function hideButton(item, onclick) {
  return iconButton(item.hidden ? 'eye-off' : 'eye', item.hidden ? 'Mostrar' : 'Ocultar', onclick);
}
