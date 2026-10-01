import { createUnit, deleteUnit, listUnits, updateUnit } from '../../data/units.js';
import { nameList } from './name-list.js';

export default function units(root) {
  return nameList(root, {
    list: listUnits,
    create: createUnit,
    update: updateUnit,
    remove: deleteUnit,
    removalDetail: () => 'Los artículos ya capturados conservan su unidad.',
    addLabel: 'Nueva unidad',
    editLabel: 'Editar unidad',
    removeLabel: 'Eliminar unidad',
    hiddenLabel: 'Oculta',
    hint: 'Unidades para la cantidad de cada artículo (pza, kg, L…).',
  });
}
