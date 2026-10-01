const moneyFormat = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const wholeFormat = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
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

export function wholeMoney(value) {
  return wholeFormat.format(value);
}

export function compactMoney(value) {
  return value >= 10000 ? `$${(value / 1000).toFixed(1)}k` : wholeMoney(value);
}

export function dayLabel(iso) {
  const text = dayFormat.format(fromISO(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function weekdayIndex(iso) {
  return (fromISO(iso).getDay() + 6) % 7;
}

export function todayISO() {
  return toISO(new Date());
}

export function nowTime() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso, count) {
  const date = fromISO(monthStart(iso));
  date.setMonth(date.getMonth() + count);
  return toISO(date);
}

export function addDays(iso, count) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + count);
  return toISO(date);
}

export function monthsBetween(from, to) {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
}

export function daysBetween(from, to) {
  return Math.round((fromISO(to) - fromISO(from)) / 86400000);
}

export function monthEnd(iso) {
  const date = fromISO(addMonths(iso, 1));
  date.setDate(0);
  return toISO(date);
}

export function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function dateToTime(iso) {
  return fromISO(iso).getTime();
}

export function timeToISO(time) {
  return toISO(new Date(time));
}

export function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function monthLabel(iso) {
  const text = monthFormat.format(fromISO(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}
