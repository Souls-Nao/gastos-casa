import { h } from '../core/dom.js';
import { icon } from './icon.js';

export function openModal({ title, body, actions = [], onClose }) {
  let closed = false;

  function close(value) {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose?.(value);
  }

  const buttons = actions.map(({ label, value, variant = 'ghost' }) =>
    h('button', { class: `btn btn--${variant}`, type: 'button', onclick: () => close(value) }, label));
  const dialog = h('dialog', { class: 'modal' },
    h('header', { class: 'modal__header' },
      h('h2', { class: 'modal__title' }, title),
      h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Cerrar', onclick: () => close() }, icon('x'))),
    h('div', { class: 'modal__body' }, body),
    buttons.length ? h('footer', { class: 'modal__footer' }, buttons) : null);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => close());
  document.body.append(dialog);
  dialog.showModal();
  return { close };
}

export function openFormModal({ title, body, submitLabel = 'Guardar', onSubmit, remove }) {
  const error = h('p', { class: 'form__error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, submitLabel);

  async function attempt(task) {
    submit.disabled = true;
    error.hidden = true;
    try {
      if (await task()) modal.close();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    }
    submit.disabled = false;
  }

  const form = h('form', {
    class: 'form',
    onsubmit(event) {
      event.preventDefault();
      attempt(async () => {
        await onSubmit();
        return true;
      });
    },
  },
  body,
  remove ? h('button', { class: 'btn btn--danger-outline form__remove', type: 'button', onclick: () => attempt(remove.run) },
    icon('trash-2', 18), remove.label) : null,
  error,
  h('div', { class: 'form__actions' },
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => modal.close() }, 'Cancelar'),
    submit));
  const modal = openModal({ title, body: form });
  return modal;
}

export function confirmDialog({ title, message, confirmLabel = 'Aceptar', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: h('p', null, message),
      actions: [
        { label: 'Cancelar', value: 'cancel' },
        { label: confirmLabel, value: 'confirm', variant: danger ? 'danger' : 'primary' },
      ],
      onClose: (value) => resolve(value === 'confirm'),
    });
  });
}

export function confirmRemoval(name, detail) {
  return confirmDialog({
    title: `Eliminar «${name}»`,
    message: `${detail} Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
}
