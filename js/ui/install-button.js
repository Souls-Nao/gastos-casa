import { h } from '../core/dom.js';
import { canInstall, install } from '../core/pwa.js';
import { icon } from './icon.js';

export function installButton() {
  if (!canInstall()) return null;
  const button = h('button', {
    class: 'btn btn--ghost',
    type: 'button',
    async onclick() {
      await install();
      button.remove();
    },
  }, icon('download', 18), 'Instalar la app');
  return button;
}
