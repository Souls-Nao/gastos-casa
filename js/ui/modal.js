import { h } from '../core/dom.js';
import { icon } from './icon.js';

export function openModal({ title, body, actions = [] }) {
  const close = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Cerrar', onclick: () => dialog.close() }, icon('x'));
  const buttons = actions.map(({ label, value, variant = 'ghost' }) =>
    h('button', { class: `btn btn--${variant}`, type: 'button', onclick: () => dialog.close(value) }, label));
  const dialog = h('dialog', { class: 'modal' },
    h('header', { class: 'modal__header' }, h('h2', { class: 'modal__title' }, title), close),
    h('div', { class: 'modal__body' }, body),
    buttons.length ? h('footer', { class: 'modal__footer' }, buttons) : null);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function openFormModal({ title, body, submitLabel = 'Guardar', onSubmit }) {
  const error = h('p', { class: 'form__error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, submitLabel);
  const form = h('form', {
    class: 'form',
    async onsubmit(event) {
      event.preventDefault();
      submit.disabled = true;
      error.hidden = true;
      try {
        await onSubmit();
        dialog.close();
      } catch (failure) {
        error.textContent = failure.message;
        error.hidden = false;
        submit.disabled = false;
      }
    },
  },
  body,
  error,
  h('div', { class: 'form__actions' },
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => dialog.close() }, 'Cancelar'),
    submit));
  const dialog = openModal({ title, body: form });
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
