const moneyFormat = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
const pad = (value) => String(value).padStart(2, '0');

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromISO(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function money(value) {
  return moneyFormat.format(Number(value) || 0);
}

export function todayISO() {
  return toISO(new Date());
}

export function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso, count) {
  const date = fromISO(monthStart(iso));
  date.setMonth(date.getMonth() + count);
  return toISO(date);
}

export function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function monthLabel(iso) {
  const text = monthFormat.format(fromISO(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}
