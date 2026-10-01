import { h } from '../core/dom.js';
import { icon } from './icon.js';

const COLORS = [
  '#2E9E6B', '#7FA83A', '#2C9FB0', '#3FB5E0', '#4F6BD8', '#8657C9', '#C25A9A', '#E58FB0',
  '#D9486B', '#B5523B', '#E0663A', '#E0A526', '#9A7448', '#6D4C41', '#00897B', '#7D8794',
];

const ICONS = [
  'tag', 'shopping-cart', 'shopping-basket', 'apple', 'carrot', 'beef', 'fish', 'egg', 'milk', 'croissant',
  'sandwich', 'cup-soda', 'beer', 'wine', 'candy', 'cookie', 'ice-cream-cone', 'popcorn', 'snowflake', 'coffee',
  'utensils', 'pizza', 'soup', 'bike', 'spray-can', 'bath', 'washing-machine', 'sofa', 'bed', 'refrigerator',
  'wrench', 'hammer', 'lightbulb', 'house', 'key-round', 'zap', 'droplets', 'flame', 'wifi', 'smartphone',
  'tv', 'laptop', 'headphones', 'car', 'fuel', 'bus', 'train-front', 'car-taxi-front', 'square-parking', 'plane',
  'truck', 'heart-pulse', 'pill', 'stethoscope', 'microscope', 'glasses', 'dumbbell', 'graduation-cap', 'school', 'backpack',
  'book-open', 'notebook-pen', 'printer', 'shirt', 'footprints', 'watch', 'paw-print', 'dog', 'cat', 'bone',
  'party-popper', 'clapperboard', 'gamepad-2', 'music', 'camera', 'palette', 'trees', 'sparkles', 'scissors', 'flower-2',
  'gift', 'cake', 'hand-heart', 'church', 'baby', 'heart', 'star', 'umbrella', 'package', 'leaf',
  'coins', 'banknote', 'credit-card', 'piggy-bank', 'receipt', 'landmark', 'briefcase', 'store', 'hand-coins', 'circle-plus',
  'circle-help', 'triangle-alert',
];

function radioGrid(name, className, options, value, render) {
  const all = options.includes(value) ? options : [value, ...options];
  const element = h('div', { class: className },
    all.map((option) => h('label', { class: `${className}__item`, title: option },
      h('input', { class: 'visually-hidden', type: 'radio', name, value: option, checked: option === value }),
      render(option))));
  return {
    element,
    get value() {
      return element.querySelector('input:checked').value;
    },
  };
}

export function colorPicker(value = COLORS[0]) {
  return radioGrid('color', 'swatches', COLORS, value, (color) => h('span', { class: 'swatches__dot', style: `background:${color}` }));
}

export function iconPicker(value = ICONS[0]) {
  return radioGrid('icon', 'icon-grid', ICONS, value, (name) => icon(name, 22));
}
