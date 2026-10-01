import { createUnit, listUnits, updateUnit } from '../../data/units.js';
import { nameList } from './name-list.js';

export default function units(root) {
  return nameList(root, {
    list: listUnits,
    create: createUnit,
    update: updateUnit,
    addLabel: 'Nueva unidad',
    editLabel: 'Editar unidad',
    hiddenLabel: 'Oculta',
    hint: 'Unidades para la cantidad de cada artículo (pza, kg, L…).',
  });
}
