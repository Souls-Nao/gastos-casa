import { h } from '../../core/dom.js';
import { categoryTree, createCategory, listCategories, reorderCategories, updateCategory } from '../../data/categories.js';
import { nextOrder } from '../../data/crud.js';
import { categoryIcon } from '../../ui/category-icon.js';
import { field, fieldGroup, textInput } from '../../ui/field.js';
import { icon } from '../../ui/icon.js';
import { hideButton, iconButton, listRow } from '../../ui/list-row.js';
import { openFormModal } from '../../ui/modal.js';
import { colorPicker, iconPicker } from '../../ui/pickers.js';
import { tabs } from '../../ui/tabs.js';
import { toast } from '../../ui/toast.js';

const KINDS = [
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
];

function countLabel(count) {
  return count === 1 ? '1 subcategoría' : `${count} subcategorías`;
}

export default async function categories(root, query) {
  const kind = query.get('kind') === 'income' ? 'income' : 'expense';
  const open = new Set();
  const list = h('div', { class: 'category-list' });
  let tree = [];
  let sorting = false;

  async function load() {
    tree = categoryTree(await listCategories(), kind);
    render();
  }

  async function run(task) {
    try {
      await task();
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function move(siblings, index, step) {
    const ordered = [...siblings];
    [ordered[index], ordered[index + step]] = [ordered[index + step], ordered[index]];
    run(() => reorderCategories(ordered));
  }

  function actions(item, siblings, parent) {
    if (sorting) {
      const index = siblings.indexOf(item);
      return [
        iconButton('arrow-up', 'Subir', () => move(siblings, index, -1), index === 0),
        iconButton('arrow-down', 'Bajar', () => move(siblings, index, 1), index === siblings.length - 1),
      ];
    }
    return [
      hideButton(item, () => run(() => updateCategory(item, { hidden: !item.hidden }))),
      iconButton('pencil', 'Editar', () => (parent ? editSubcategory(parent, item) : editCategory(item))),
    ];
  }

  function nameInput(item) {
    return textInput({ required: true, maxLength: 60, autofocus: true, value: item?.name ?? '' });
  }

  function editCategory(item) {
    const name = nameInput(item);
    const color = colorPicker(item?.color ?? undefined);
    const symbol = iconPicker(item?.icon ?? undefined);
    openFormModal({
      title: item ? 'Editar categoría' : 'Nueva categoría',
      body: [field('Nombre', name), fieldGroup('Color', color.element), fieldGroup('Icono', symbol.element)],
      async onSubmit() {
        const values = { name: name.value.trim(), color: color.value, icon: symbol.value };
        if (item) await updateCategory(item, values);
        else await createCategory({ ...values, kind, sort_order: nextOrder(tree) });
        await load();
      },
    });
  }

  function editSubcategory(parent, item) {
    const name = nameInput(item);
    openFormModal({
      title: item ? 'Editar subcategoría' : `Nueva subcategoría de ${parent.name}`,
      body: field('Nombre', name),
      async onSubmit() {
        const value = name.value.trim();
        if (item) await updateCategory(item, { name: value });
        else {
          await createCategory({
            name: value,
            parent_id: parent.id,
            kind: parent.kind,
            color: parent.color,
            sort_order: nextOrder(parent.children),
          });
        }
        open.add(parent.id);
        await load();
      },
    });
  }

  function render() {
    list.replaceChildren(...tree.map((category) => {
      const details = h('details', {
        class: 'category card',
        open: open.has(category.id),
        ontoggle() {
          if (details.open) open.add(category.id);
          else open.delete(category.id);
        },
      },
      h('summary', { class: 'category__summary' },
        icon('chevron-right', 18),
        listRow({
          leading: categoryIcon(category),
          title: category.name,
          subtitle: countLabel(category.children.length),
          hidden: category.hidden && 'Oculta',
          actions: actions(category, tree),
        })),
      h('div', { class: 'category__children' },
        category.children.map((child) => listRow({
          title: child.name,
          hidden: child.hidden && 'Oculta',
          actions: actions(child, category.children, category),
        })),
        h('button', { class: 'btn btn--ghost category__add', type: 'button', onclick: () => editSubcategory(category, null) },
          icon('plus', 18), 'Agregar subcategoría')));
      return details;
    }));
  }

  const sortButton = h('button', {
    class: 'btn btn--ghost',
    type: 'button',
    'aria-pressed': 'false',
    onclick() {
      sorting = !sorting;
      sortButton.setAttribute('aria-pressed', String(sorting));
      render();
    },
  }, icon('arrow-up-down', 18), 'Ordenar');

  root.append(
    tabs(KINDS.map((item) => ({ ...item, href: `#/catalogos?tab=categorias&kind=${item.value}` })), kind),
    h('div', { class: 'toolbar' },
      sortButton,
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => editCategory(null) }, icon('plus', 18), 'Nueva categoría')),
    list);
  await load();
}
