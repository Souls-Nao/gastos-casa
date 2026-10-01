import { h } from '../../core/dom.js';
import { field, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { hideButton, iconButton, listRow } from '../../ui/list-row.js';
import { openFormModal } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';

export async function nameList(root, { list, create, update, addLabel, editLabel, hiddenLabel, hint }) {
  const rows = h('div', { class: 'list' });

  async function load() {
    const items = await list();
    rows.replaceChildren(...items.map((item) => listRow({
      title: item.name,
      hidden: item.hidden && hiddenLabel,
      actions: [hideButton(item, () => toggle(item)), iconButton('pencil', 'Editar', () => edit(item))],
    })));
  }

  async function toggle(item) {
    try {
      await update(item.id, { hidden: !item.hidden });
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function edit(item) {
    const name = textInput({ required: true, maxLength: 60, autofocus: true, value: item?.name ?? '' });
    openFormModal({
      title: item ? editLabel : addLabel,
      body: field('Nombre', name),
      async onSubmit() {
        const value = name.value.trim();
        if (item) await update(item.id, { name: value });
        else await create(value);
        await load();
      },
    });
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('p', { class: 'toolbar__hint' }, hint),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => edit(null) }, icon('plus', 18), addLabel)),
    rows);
  await load();
}
