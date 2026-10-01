import { h } from '../core/dom.js';

let host = null;

export function toast(message, tone = 'info') {
  host ??= document.body.appendChild(h('div', { class: 'toasts', popover: 'manual', role: 'status' }));
  if (host.showPopover) {
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  }
  const item = h('div', { class: 'toast', 'data-tone': tone }, message);
  host.append(item);
  setTimeout(() => item.remove(), 4500);
}
