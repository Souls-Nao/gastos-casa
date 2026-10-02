const ticket = () => import('./views/ticket.js');

export const sections = [
  { path: '/', label: 'Inicio', icon: 'layout-dashboard', tab: 1, view: () => import('./views/home.js') },
  { path: '/ticket', label: 'Nuevo ticket', short: 'Ticket', icon: 'plus', tab: 3, primary: true, view: ticket },
  { path: '/ticket/:id', label: 'Editar ticket', icon: 'receipt-text', parent: '/ticket', hidden: true, view: ticket },
  { path: '/historial', label: 'Historial', icon: 'receipt-text', view: () => import('./views/history.js') },
  { path: '/calendario', label: 'Calendario', icon: 'calendar-days', tab: 2, view: () => import('./views/calendar.js') },
  { path: '/ingresos', label: 'Ingresos', icon: 'wallet', view: () => import('./views/incomes.js') },
  { path: '/dinero', label: 'Efectivo y tarjeta', icon: 'banknote', view: () => import('./views/money.js') },
  { path: '/presupuestos', label: 'Presupuestos', icon: 'chart-pie', view: () => import('./views/budgets.js') },
  { path: '/pagos', label: 'Pagos del mes', icon: 'credit-card', view: () => import('./views/payments.js') },
  { path: '/ahorro', label: 'Ahorro y reserva', icon: 'piggy-bank', view: () => import('./views/savings.js') },
  { path: '/lista', label: 'Lista de compras', short: 'Lista', icon: 'list-checks', tab: 4, view: () => import('./views/shopping.js') },
  { path: '/catalogos', label: 'Catálogos', icon: 'tags', view: () => import('./views/catalogs.js') },
  { path: '/datos', label: 'Datos y respaldo', icon: 'database', view: () => import('./views/data.js') },
  { path: '/mas', label: 'Más', icon: 'ellipsis', tab: 5, mobileOnly: true, view: () => import('./views/more.js') },
];
