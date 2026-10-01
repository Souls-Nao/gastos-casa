import { h } from '../core/dom.js';
import { emit } from '../core/events.js';
import { getState } from '../core/store.js';
import { sections } from '../sections.js';
import { icon } from '../ui/icon.js';

export default function more(root) {
  root.append(
    h('nav', { class: 'list', 'aria-label': 'Más secciones' },
      sections.filter((section) => !section.tab).map((section) =>
        h('a', { class: 'list__item', href: `#${section.path}` },
          icon(section.icon),
          h('span', { class: 'list__text' }, section.label),
          icon('chevron-right', 18)))),
    h('section', { class: 'card account' },
      h('span', { class: 'account__label' }, 'Sesión iniciada como'),
      h('strong', { class: 'account__email' }, getState().user.email),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => emit('auth:logout') },
        icon('log-out', 18), 'Cerrar sesión')),
  );
}
