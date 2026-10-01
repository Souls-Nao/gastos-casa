import { h } from '../core/dom.js';

export function tabs(items, current) {
  return h('nav', { class: 'tabs' },
    items.map((item) => h('a', {
      class: 'tabs__item',
      href: item.href,
      'aria-current': item.value === current ? 'page' : null,
    }, item.label)));
}
