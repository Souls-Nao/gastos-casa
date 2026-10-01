import { createElement, icons } from 'https://cdn.jsdelivr.net/npm/lucide@1.49.0/+esm';

function pascal(name) {
  return name.replace(/(^|-)([a-z0-9])/g, (_, dash, char) => char.toUpperCase());
}

export function icon(name, size = 20) {
  return createElement(icons[pascal(name)] ?? icons.Circle, { width: size, height: size, 'aria-hidden': 'true' });
}
