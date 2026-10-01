import { h } from '../core/dom.js';
import { emit } from '../core/events.js';
import { icon } from './icon.js';

function link(section, className, content) {
  return h('a', { class: className, href: `#${section.path}`, 'data-path': section.path }, content);
}

export function createShell({ sections, email, date }) {
  const menu = sections.filter((section) => !section.mobileOnly && !section.hidden)
    .sort((a, b) => Boolean(b.primary) - Boolean(a.primary));
  const tabs = sections.filter((section) => section.tab).sort((a, b) => a.tab - b.tab);
  const title = h('h1', { class: 'topbar__title' });
  const outlet = h('main', { class: 'outlet' });

  const sidebar = h('aside', { class: 'sidebar' },
    h('div', { class: 'brand' },
      h('img', { class: 'brand__logo', src: 'assets/icons/icon.svg', alt: '', width: 36, height: 36 }),
      h('span', { class: 'brand__name' }, 'Gastos de Casa')),
    h('nav', { class: 'nav', 'aria-label': 'Secciones' },
      menu.map((section) => link(section, section.primary ? 'btn btn--primary nav__primary' : 'nav__link',
        [icon(section.icon), h('span', null, section.label)]))),
    h('div', { class: 'sidebar__footer' },
      h('span', { class: 'sidebar__user', title: email }, email),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => emit('auth:logout') },
        icon('log-out', 18), 'Cerrar sesión')),
  );

  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Navegación principal' },
    tabs.map((section) => link(section, section.primary ? 'tabbar__link tabbar__link--primary' : 'tabbar__link', [
      section.primary ? h('span', { class: 'tabbar__bubble' }, icon(section.icon, 26)) : icon(section.icon, 22),
      h('span', null, section.short ?? section.label),
    ])));

  const element = h('div', { class: 'shell' },
    sidebar,
    h('div', { class: 'main' },
      h('header', { class: 'topbar' }, title, h('span', { class: 'topbar__date' }, date)),
      outlet),
    tabbar,
  );

  const more = tabs.find((section) => section.mobileOnly);

  function mark(nav, path) {
    for (const anchor of nav.querySelectorAll('[data-path]')) {
      if (anchor.dataset.path === path) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  }

  function setActive(section) {
    title.textContent = section.label;
    document.title = `${section.label} · Gastos de Casa`;
    const active = section.parent ?? section.path;
    mark(sidebar, active);
    mark(tabbar, tabs.some((tab) => tab.path === active) ? active : more.path);
  }

  return { element, outlet, setActive };
}
