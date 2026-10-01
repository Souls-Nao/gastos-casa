import { signIn } from '../core/auth.js';
import { h } from '../core/dom.js';
import { field, textInput } from '../ui/field.js';

export default function login(root) {
  const email = textInput({ type: 'email', autocomplete: 'username', required: true });
  const password = textInput({ type: 'password', autocomplete: 'current-password', required: true });
  const message = h('p', { class: 'form__error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, 'Entrar');

  async function onsubmit(event) {
    event.preventDefault();
    submit.disabled = true;
    message.hidden = true;
    try {
      await signIn(email.value.trim(), password.value);
    } catch (error) {
      message.textContent = error.code === 'invalid_credentials'
        ? 'Correo o contraseña incorrectos.'
        : `No se pudo entrar: ${error.message}`;
      message.hidden = false;
      submit.disabled = false;
    }
  }

  root.replaceChildren(
    h('main', { class: 'login' },
      h('form', { class: 'login__card card', onsubmit },
        h('img', { class: 'login__logo', src: 'assets/icons/icon.svg', alt: '', width: 64, height: 64 }),
        h('h1', { class: 'login__title' }, 'Gastos de Casa'),
        h('p', { class: 'login__hint' }, 'Entra con la cuenta de la casa.'),
        field('Correo', email),
        field('Contraseña', password),
        message,
        submit)));
}
