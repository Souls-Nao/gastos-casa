import { h } from '../core/dom.js';
import { icon } from './icon.js';

export function openModal({ title, body, actions = [] }) {
  const dialog = h('dialog', { class: 'modal' });
  const close = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Cerrar', onclick: () => dialog.close() }, icon('x'));
  const buttons = actions.map(({ label, value, variant = 'ghost' }) =>
    h('button', { class: `btn btn--${variant}`, type: 'button', onclick: () => dialog.close(value) }, label));
  dialog.append(
    h('header', { class: 'modal__header' }, h('h2', { class: 'modal__title' }, title), close),
    h('div', { class: 'modal__body' }, body),
    buttons.length ? h('footer', { class: 'modal__footer' }, buttons) : null,
  );
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function confirmDialog({ title, message, confirmLabel = 'Aceptar', danger = false }) {
  return new Promise((resolve) => {
    const dialog = openModal({
      title,
      body: h('p', null, message),
      actions: [
        { label: 'Cancelar', value: 'cancel' },
        { label: confirmLabel, value: 'confirm', variant: danger ? 'danger' : 'primary' },
      ],
    });
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'));
  });
}
