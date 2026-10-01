import { h } from '../core/dom.js';
import { icon } from '../ui/icon.js';

export default function pending(root, { route }) {
  root.append(
    h('div', { class: 'empty' },
      icon(route.icon, 44),
      h('h2', { class: 'empty__title' }, route.label),
      h('p', { class: 'empty__text' }, `Esta sección todavía está en construcción. Llega en el bloque ${route.block}.`)));
}
