import { createStore, listStores, updateStore } from '../../data/stores.js';
import { nameList } from './name-list.js';

export default function stores(root) {
  return nameList(root, {
    list: listStores,
    create: createStore,
    update: updateStore,
    addLabel: 'Nueva tienda',
    editLabel: 'Editar tienda',
    hiddenLabel: 'Oculta',
    hint: 'Las tiendas ocultas no aparecen al capturar un ticket.',
  });
}
