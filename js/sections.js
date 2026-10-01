const pending = () => import('./views/pending.js');
const ticket = () => import('./views/ticket.js');

export const sections = [
  { path: '/', label: 'Inicio', icon: 'layout-dashboard', tab: 1, view: () => import('./views/home.js') },
  { path: '/ticket', label: 'Nuevo ticket', short: 'Ticket', icon: 'plus', tab: 3, primary: true, view: ticket },
  { path: '/ticket/:id', label: 'Editar ticket', icon: 'receipt-text', parent: '/ticket', hidden: true, view: ticket },
  { path: '/historial', label: 'Historial', icon: 'receipt-text', view: () => import('./views/history.js') },
  { path: '/calendario', label: 'Calendario', icon: 'calendar-days', tab: 2, view: () => import('./views/calendar.js') },
  { path: '/ingresos', label: 'Ingresos', icon: 'wallet', view: () => import('./views/incomes.js') },
  { path: '/presupuestos', label: 'Presupuestos', icon: 'chart-pie', block: 10, view: pending },
  { path: '/pagos', label: 'Pagos del mes', icon: 'credit-card', block: 11, view: pending },
  { path: '/ahorro', label: 'Ahorro y reserva', icon: 'piggy-bank', block: 12, view: pending },
  { path: '/lista', label: 'Lista de compras', short: 'Lista', icon: 'list-checks', tab: 4, block: 14, view: pending },
  { path: '/catalogos', label: 'Catálogos', icon: 'tags', view: () => import('./views/catalogs.js') },
  { path: '/mas', label: 'Más', icon: 'ellipsis', tab: 5, mobileOnly: true, view: () => import('./views/more.js') },
];
