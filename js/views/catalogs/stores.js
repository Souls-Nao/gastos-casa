import { createStore, deleteStore, listStores, storeUsage, updateStore } from '../../data/stores.js';
import { nameList } from './name-list.js';

export default function stores(root) {
  return nameList(root, {
    list: listStores,
    create: createStore,
    update: updateStore,
    remove: deleteStore,
    async removalDetail(store) {
      const count = await storeUsage(store.id);
      return count ? `Tickets que quedarán sin tienda: ${count}.` : 'No se ha usado en ningún ticket.';
    },
    addLabel: 'Nueva tienda',
    editLabel: 'Editar tienda',
    removeLabel: 'Eliminar tienda',
    hiddenLabel: 'Oculta',
    hint: 'Las tiendas ocultas no aparecen al capturar un ticket.',
  });
}
