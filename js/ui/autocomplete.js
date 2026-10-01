import { h } from '../core/dom.js';

export function autocomplete(input, { search, render, onSelect }) {
  const list = h('ul', { class: 'autocomplete__list', role: 'listbox', hidden: true });
  let results = [];
  let active = -1;

  function close() {
    list.hidden = true;
    active = -1;
  }

  function choose(index) {
    const item = results[index];
    close();
    onSelect(item);
  }

  function mark() {
    [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
  }

  function update() {
    results = search(input.value);
    if (!results.length) {
      close();
      return;
    }
    list.replaceChildren(...results.map((item, index) => h('li', {
      class: 'autocomplete__item',
      role: 'option',
      onpointerdown(event) {
        event.preventDefault();
        choose(index);
      },
    }, render(item))));
    list.hidden = false;
    active = -1;
  }

  input.addEventListener('input', update);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (list.hidden) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (active < 0) active = step > 0 ? 0 : results.length - 1;
      else active = (active + step + results.length) % results.length;
      mark();
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      event.stopPropagation();
      choose(active);
    } else if (event.key === 'Escape') {
      close();
    }
  });

  return h('div', { class: 'autocomplete' }, input, list);
}
