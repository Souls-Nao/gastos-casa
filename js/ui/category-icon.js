import { h } from '../core/dom.js';
import { icon } from './icon.js';

export function categoryIcon(category, size = 40) {
  return h('span', { class: 'category-icon', style: `--category:${category.color ?? '#7D8794'};--size:${size}px` },
    icon(category.icon ?? 'tag', Math.round(size * 0.55)));
}
