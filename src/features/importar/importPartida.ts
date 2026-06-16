/* ===========================================================================
   features/importar/importPartida — importar UNA partida (.bc3 FIE BDC de CYPE)
   al presupuesto SIN reemplazar la obra. Funciones sueltas (no hook): las usan
   tanto el drop sobre el presupuesto (App) como el botón «Importar partida». El
   parseo pesado va por el worker (`parseBc3`); el aplanado es barato (hilo
   principal). El feedback va por el toast global; las colisiones de recurso las
   resuelve el `ConflictModal` existente (vía `pendingCopy`).
   =========================================================================== */
import { Bc3ImportError } from '../../core/bc3import';
import { refCopyItemsFromObra } from '../../core/bc3ToPartidas';
import { copyTargetOf, selectCopyContra, useObraStore, useToastStore } from '../../store';
import { parseBc3 } from './parseBc3';

/** Destino de inserción; `null` = capítulo/sub activo (lo resuelve el store). */
type Target = { chId: string; subId: string | null } | null;

/** ¿El fichero parece un .bc3? (la detección fina la hace el parser). */
export function isBc3File(file: File | null | undefined): boolean {
  return !!file && /\.bc3$/i.test(file.name);
}

function readBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().then((b) => new Uint8Array(b));
  }
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => rej(fr.error ?? new Error('No se pudo leer el archivo.'));
    fr.readAsArrayBuffer(file);
  });
}

// Guarda de reentrada: evita dobles importaciones (doble clic, doble drop) que
// abrirían dos modales de colisión a la vez.
let importing = false;

/** Importa la(s) partida(s) de un .bc3 al destino (o al capítulo activo). */
export async function importPartidaFromFile(file: File, target: Target = null): Promise<void> {
  if (importing) return;
  importing = true;
  const toast = useToastStore.getState().show;
  try {
    const bytes = await readBytes(file);
    const result = await parseBc3(bytes); // worker: la UI no se congela
    const { items, error } = refCopyItemsFromObra(result);
    if (error || items.length === 0) {
      toast(error ?? 'El .bc3 no contiene ninguna partida importable.');
      return;
    }
    // Resuelve el destino REAL (capítulo/sub activo si target es null) para poder
    // localizar la partida insertada y saltar a ella tras la copia.
    const st = useObraStore.getState();
    const tgt = target ?? copyTargetOf(st.chapters, st.active);
    const idsBefore = new Set((st.partidas[tgt.chId] ?? []).map((p) => p.id));

    // Soltar un .bc3 en Certificaciones lo importa como contradictorio (igual que
    // copiar de Referencia); en Presupuesto, partida normal. La vista manda.
    st.requestCopyRefPartidas(items, target, selectCopyContra(st));

    const after = useObraStore.getState();
    if (after.pendingCopy) {
      // Con colisión la inserción la confirma el ConflictModal; no se revela aún.
      toast('Partida importada: resuelve las colisiones de recursos.');
      return;
    }
    const fresh = (after.partidas[tgt.chId] ?? []).find((p) => !idsBefore.has(p.id));
    if (fresh) after.revealPartida(fresh.id, tgt.chId, fresh.sub ?? null); // salta + pulso
    const extra = items.length > 1 ? ` (+${items.length - 1} más, sin su estructura)` : '';
    toast(`Partida importada: ${items[0]!.partida.code}${extra}.`);
  } catch (e) {
    toast(
      e instanceof Bc3ImportError
        ? 'El .bc3 no contiene ninguna partida importable.'
        : 'No se pudo leer el archivo .bc3.',
    );
  } finally {
    importing = false;
  }
}

/**
 * Procesa un drop sobre el presupuesto, con el fichero y los `types` del
 * `DataTransfer` ya capturados de forma SÍNCRONA por el llamante (el evento de
 * drag no sobrevive al import dinámico). Un .bc3 se importa; otro fichero o un
 * ENLACE (arrastrar el icono FIE BDC desde el navegador, que solo entrega la URL
 * y choca con CORS) muestran un aviso accionable.
 */
export function processBudgetDrop(file: File | undefined, types: string[], target: Target = null): void {
  if (file) {
    if (isBc3File(file)) void importPartidaFromFile(file, target);
    else useToastStore.getState().show('Solo se importan archivos .bc3.');
    return;
  }
  if (types.includes('text/uri-list') || types.includes('text/plain')) {
    useToastStore
      .getState()
      .show(
        'Arrastrar el enlace no funciona en la versión web. Descarga el .bc3 (icono FIE BDC) y arrástralo, o usa «Importar partida».',
      );
  }
}
