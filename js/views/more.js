import { h } from '../core/dom.js';
import { emit } from '../core/events.js';
import { needsManualInstall } from '../core/pwa.js';
import { getState } from '../core/store.js';
import { sections } from '../sections.js';
import { icon } from '../ui/icon.js';
import { installButton } from '../ui/install-button.js';

export default function more(root) {
  root.append(
    h('nav', { class: 'list', 'aria-label': 'Más secciones' },
      sections.filter((section) => !section.tab && !section.hidden).map((section) =>
        h('a', { class: 'list__item', href: `#${section.path}` },
          icon(section.icon),
          h('span', { class: 'list__text' }, section.label),
          icon('chevron-right', 18)))),
    h('section', { class: 'card account' },
      h('span', { class: 'account__label' }, 'Sesión iniciada como'),
      h('strong', { class: 'account__email' }, getState().user.email),
      installButton(),
      needsManualInstall()
        ? h('p', { class: 'field__hint' }, 'Para instalarla en iPhone: abre esta página en Safari, toca Compartir y elige "Agregar a inicio".')
        : null,
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => emit('auth:logout') },
        icon('log-out', 18), 'Cerrar sesión')),
  );
}
