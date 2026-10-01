import { supabase, configured } from './core/supabase.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const login = $('login');
const session = $('session');
const checks = $('checks');

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function setStatus(text, tone = 'info') {
  status.textContent = text;
  status.dataset.tone = tone;
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addCheck(label, value) {
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value;
  checks.append(dt, dd);
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function count(table) {
  const { count: total, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return total;
}

async function showSession(user) {
  login.hidden = true;
  session.hidden = false;
  checks.replaceChildren();
  setStatus(`Sesión iniciada: ${user.email}`, 'ok');
  try {
    await rpc('seed_defaults');
    await rpc('ensure_month', { p_month: today() });
    const [categories, methods, stores, summary] = await Promise.all([
      count('categories'),
      count('payment_methods'),
      count('stores'),
      rpc('month_summary', { p_month: today() }),
    ]);
    addCheck('Categorías', categories);
    addCheck('Métodos de pago', methods);
    addCheck('Tiendas', stores);
    addCheck('Disponible del mes', money.format(summary.available));
  } catch (error) {
    setStatus(`La base de datos respondió con un error: ${error.message}`, 'error');
  }
}

function showLogin() {
  session.hidden = true;
  login.hidden = false;
  setStatus('Conexión lista. Inicia sesión.', 'info');
}

async function render() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return setStatus(`No se pudo conectar: ${error.message}`, 'error');
  if (data.session) await showSession(data.session.user);
  else showLogin();
}

login.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  setStatus('Entrando…', 'info');
  const { error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
  });
  button.disabled = false;
  if (error) {
    const wrong = error.code === 'invalid_credentials';
    return setStatus(wrong ? 'Correo o contraseña incorrectos.' : `No se pudo entrar: ${error.message}`, 'error');
  }
  login.reset();
  await render();
});

$('logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin();
});

if (configured) render();
else setStatus('Falta configurar la conexión con Supabase (js/config.js).', 'error');
