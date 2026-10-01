import { h } from '../core/dom.js';
import { downloadFile, toCSV } from '../core/download.js';
import { formatDate, todayISO } from '../core/format.js';
import { clearOffline } from '../core/offline.js';
import { buildWorkbook } from '../core/xlsx.js';
import { backupData, exportSheets, restoreData } from '../data/exports.js';
import { pendingOperations } from '../data/sync.js';
import { field, textInput } from '../ui/field.js';
import { icon } from '../ui/icon.js';
import { confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

function backupFile(backup) {
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export default function data(root) {
  const today = todayISO();
  const from = textInput({ type: 'date', required: true, value: `${today.slice(0, 4)}-01-01` });
  const to = textInput({ type: 'date', required: true, value: today });
  const file = h('input', { class: 'visually-hidden', type: 'file', accept: 'application/json,.json' });

  async function run(button, task) {
    button.disabled = true;
    try {
      await task();
    } catch (error) {
      toast(error.message, 'error');
    }
    button.disabled = false;
  }

  async function exportAs(kind) {
    if (!from.value || !to.value || from.value > to.value) throw new Error('Revisa las fechas: "desde" debe ser anterior a "hasta".');
    const sheets = await exportSheets(from.value, to.value);
    const name = `gastos-casa_${from.value}_a_${to.value}`;
    if (kind === 'xlsx') downloadFile(`${name}.xlsx`, buildWorkbook(sheets));
    else downloadFile(`${name}.csv`, toCSV(sheets[0].rows));
    toast(`Archivo descargado: ${sheets[0].rows.length - 1} artículos de tickets.`);
  }

  async function restore(source) {
    let backup;
    try {
      backup = JSON.parse(await source.text());
    } catch {
      backup = null;
    }
    if (backup?.app !== 'gastos-casa' || typeof backup.tables !== 'object') throw new Error('Ese archivo no es un respaldo de Gastos de Casa.');
    if ((await pendingOperations()).length) throw new Error('Hay cambios sin enviar. Conéctate y espera a que se envíen antes de restaurar.');
    const confirmed = await confirmDialog({
      title: 'Restaurar respaldo',
      message: `Se reemplazarán TODOS los datos actuales por los del respaldo del ${formatDate(backup.exported_at.slice(0, 10))} (${backup.tables.tickets?.length ?? 0} tickets). Antes se descarga un respaldo de lo que hay ahora, por si necesitas volver.`,
      confirmLabel: 'Reemplazar todo',
      danger: true,
    });
    if (!confirmed) return;
    downloadFile(`respaldo-antes-de-restaurar_${today}.json`, backupFile(await backupData()));
    await restoreData(backup);
    await clearOffline();
    toast('Respaldo restaurado. Recargando…');
    setTimeout(() => location.reload(), 1200);
  }

  const excel = h('button', { class: 'btn btn--primary', type: 'button', onclick: () => run(excel, () => exportAs('xlsx')) },
    icon('file-spreadsheet', 18), 'Descargar Excel');
  const csv = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => run(csv, () => exportAs('csv')) },
    icon('download', 18), 'Descargar CSV');
  const save = h('button', {
    class: 'btn btn--primary',
    type: 'button',
    onclick: () => run(save, async () => {
      downloadFile(`respaldo-gastos-casa_${today}.json`, backupFile(await backupData()));
      toast('Respaldo descargado. Guárdalo en un lugar seguro.');
    }),
  }, icon('download', 18), 'Descargar respaldo');
  const load = h('label', { class: 'btn btn--danger-outline' }, file, icon('upload', 18), 'Restaurar desde un respaldo');

  file.addEventListener('change', async () => {
    const [source] = file.files;
    file.value = '';
    if (!source) return;
    try {
      await restore(source);
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  root.append(
    h('section', { class: 'card plan' },
      h('h2', { class: 'section-title' }, 'Exportar a Excel o CSV'),
      h('p', { class: 'toolbar__hint' }, 'El archivo de Excel trae cuatro hojas: gastos por artículo, ingresos, pagos y ahorro. El CSV trae solo los gastos por artículo.'),
      h('div', { class: 'form__pair' }, field('Desde', from), field('Hasta', to)),
      h('div', { class: 'data__actions' }, excel, csv)),
    h('section', { class: 'card plan' },
      h('h2', { class: 'section-title' }, 'Respaldo completo'),
      h('p', { class: 'toolbar__hint' }, 'Supabase gratuito no hace respaldos automáticos. Descarga uno de vez en cuando: incluye todo menos las fotos de los tickets.'),
      h('div', { class: 'data__actions' }, save, load),
      h('p', { class: 'field__hint' }, 'Restaurar borra lo que hay y deja exactamente lo que tenía el respaldo.')));
}
