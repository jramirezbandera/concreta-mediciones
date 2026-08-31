/* ===========================================================================
   features/importar/importPartida — importar partidas (.bc3 FIE BDC de CYPE) al
   presupuesto SIN reemplazar la obra. Funciones sueltas (no hook): las usan
   tanto el drop sobre el presupuesto (App) como el botón «Importar partida». El
   parseo pesado va por el worker (`parseBc3`); el aplanado es barato (hilo
   principal). El feedback va por el toast global; las colisiones de recurso las
   resuelve el `ConflictModal` existente (vía `pendingCopy`).

   VARIOS ARCHIVOS A LA VEZ: el Generador de Precios de CYPE descarga UNA partida
   por .bc3, así que preparar un capítulo son 10-15 descargas. Se parsean todos y
   se vuelcan en UNA sola llamada a `requestCopyRefPartidas`: un único preflight
   de colisión (un modal, no doce) y una única inserción.
   =========================================================================== */
import { Bc3ImportError } from '../../core/bc3import';
import { refCopyItemsFromObra } from '../../core/bc3ToPartidas';
import type { RefCopyItem } from '../../core/refdata';
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

/** Parsea UN .bc3 a items de copia. `null` = el archivo no aportó ninguna partida
 *  (vacío, ilegible o sin partidas): el lote lo cuenta como fallido y sigue. */
async function itemsOf(file: File): Promise<RefCopyItem[] | null> {
  try {
    const bytes = await readBytes(file);
    const result = await parseBc3(bytes); // worker: la UI no se congela
    const { items, error } = refCopyItemsFromObra(result);
    return error || items.length === 0 ? null : items;
  } catch {
    // Un archivo roto en medio del lote no debe abortar los demás (Bc3ImportError
    // o fallo de lectura); se reporta al final por su nombre.
    return null;
  }
}

/** Cola de los avisos de archivos que no aportaron nada (nombres, topados). */
function failedSuffix(failed: string[]): string {
  if (failed.length === 0) return '';
  const shown = failed.slice(0, 3).join(', ');
  const more = failed.length > 3 ? ` y ${failed.length - 3} más` : '';
  return ` · Sin partidas: ${shown}${more}.`;
}

/**
 * Importa las partidas de UNO O VARIOS .bc3 al destino (o al capítulo activo).
 * Los archivos se parsean en serie (cada uno abre su worker) y se vuelcan JUNTOS:
 * un solo preflight de colisión y una sola inserción, sea 1 archivo o 12.
 */
export async function importPartidasFromFiles(
  files: readonly File[],
  target: Target = null,
): Promise<void> {
  if (importing) return;
  const toast = useToastStore.getState().show;
  const bc3s = files.filter(isBc3File);
  if (bc3s.length === 0) {
    if (files.length > 0) toast('Solo se importan archivos .bc3.');
    return;
  }
  importing = true;
  try {
    // Con varios archivos el parseo tarda (12 × worker): avisa de que va en marcha
    // para que el silencio no se lea como «no ha hecho nada».
    if (bc3s.length > 1) toast(`Importando ${bc3s.length} archivos .bc3…`);

    const items: RefCopyItem[] = [];
    const failed: string[] = [];
    let okFiles = 0;
    for (const f of bc3s) {
      const got = await itemsOf(f);
      if (got) {
        items.push(...got);
        okFiles += 1;
      } else failed.push(f.name);
    }
    if (items.length === 0) {
      toast(
        bc3s.length === 1
          ? 'El .bc3 no contiene ninguna partida importable.'
          : `Ninguno de los ${bc3s.length} archivos contiene partidas importables.`,
      );
      return;
    }

    // Resuelve el destino REAL (capítulo/sub activo si target es null) para poder
    // localizar la primera partida insertada y saltar a ella tras la copia.
    const st = useObraStore.getState();
    const tgt = target ?? copyTargetOf(st.chapters, st.active);
    const idsBefore = new Set((st.partidas[tgt.chId] ?? []).map((p) => p.id));

    // Soltar un .bc3 en Certificaciones lo importa como contradictorio (igual que
    // copiar de Referencia); en Presupuesto, partida normal. La vista manda.
    // UNA sola llamada con TODO el lote: `detectCollisions` dedupe por código, así
    // que los recursos que comparten los 12 archivos abren un único modal.
    st.requestCopyRefPartidas(items, target, selectCopyContra(st));

    // Texto del recuento: con un solo archivo se conserva el mensaje de siempre.
    const many = okFiles > 1;
    const head = many
      ? `${items.length} partidas importadas de ${okFiles} archivos`
      : `Partida importada: ${items[0]!.partida.code}${
          items.length > 1 ? ` (+${items.length - 1} más, sin su estructura)` : ''
        }`;

    const after = useObraStore.getState();
    if (after.pendingCopy) {
      // Con colisión la inserción la confirma el ConflictModal; no se revela aún.
      toast(`${head}: resuelve las colisiones de recursos.${failedSuffix(failed)}`);
      return;
    }
    const fresh = (after.partidas[tgt.chId] ?? []).find((p) => !idsBefore.has(p.id));
    if (fresh) after.revealPartida(fresh.id, tgt.chId, fresh.sub ?? null); // salta + pulso
    toast(`${head}.${failedSuffix(failed)}`);
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

/** Importa la(s) partida(s) de UN .bc3 (azúcar sobre `importPartidasFromFiles`). */
export function importPartidaFromFile(file: File, target: Target = null): Promise<void> {
  return importPartidasFromFiles([file], target);
}

/**
 * Procesa un drop sobre el presupuesto, con los ficheros y los `types` del
 * `DataTransfer` ya capturados de forma SÍNCRONA por el llamante (el evento de
 * drag no sobrevive al import dinámico). Los .bc3 se importan TODOS de una vez;
 * si no cae ninguno, otro fichero o un ENLACE (arrastrar el icono FIE BDC desde
 * el navegador, que solo entrega la URL y choca con CORS) avisan de forma
 * accionable. Soltar una mezcla importa los .bc3 e ignora el resto.
 */
export function processBudgetDrop(
  files: readonly File[],
  types: string[],
  target: Target = null,
): void {
  if (files.length > 0) {
    void importPartidasFromFiles(files, target);
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
