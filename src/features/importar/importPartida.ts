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

   OBRA EN BLANCO: soltar el .bc3 de una obra COMPLETA sobre una obra sin
   capítulos la carga entera, como la vista Importar (no hay nada que reemplazar,
   así que sin confirmación). Con capítulos, el drop sigue siendo de partidas.
   =========================================================================== */
import { Bc3ImportError, type Bc3ImportResult } from '../../core/bc3import';
import { refCopyItemsFromObra } from '../../core/bc3ToPartidas';
import { fmtCents } from '../../core/money';
import type { Obra } from '../../core/types';
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

/** Parsea UN .bc3 (worker: la UI no se congela). */
async function parseFile(file: File): Promise<Bc3ImportResult> {
  return parseBc3(await readBytes(file));
}

/** Parsea UN .bc3 a items de copia (o reusa su parseo si ya se hizo). `null` = el
 *  archivo no aportó ninguna partida (vacío, ilegible o sin partidas): el lote lo
 *  cuenta como fallido y sigue. */
async function itemsOf(file: File, parsed?: Bc3ImportResult): Promise<RefCopyItem[] | null> {
  try {
    const result = parsed ?? (await parseFile(file));
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
  const bc3s = files.filter(isBc3File);
  if (bc3s.length === 0) {
    if (files.length > 0) useToastStore.getState().show('Solo se importan archivos .bc3.');
    return;
  }
  importing = true;
  try {
    await importarLote(bc3s, target);
  } finally {
    importing = false;
  }
}

/** Cuerpo de `importPartidasFromFiles` (sin la guarda de reentrada, que pone el
 *  llamante). `parsed` reusa los parseos ya hechos (el drop en obra en blanco ya
 *  parseó el archivo para ver si era una obra completa). */
async function importarLote(
  bc3s: readonly File[],
  target: Target,
  parsed?: ReadonlyMap<File, Bc3ImportResult>,
): Promise<void> {
  const toast = useToastStore.getState().show;
  try {
    // Con varios archivos el parseo tarda (12 × worker): avisa de que va en marcha
    // para que el silencio no se lea como «no ha hecho nada».
    if (bc3s.length > 1) toast(`Importando ${bc3s.length} archivos .bc3…`);

    const items: RefCopyItem[] = [];
    const failed: string[] = [];
    let okFiles = 0;
    for (const f of bc3s) {
      const got = await itemsOf(f, parsed?.get(f));
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
  }
}

/** Importa la(s) partida(s) de UN .bc3 (azúcar sobre `importPartidasFromFiles`). */
export function importPartidaFromFile(file: File, target: Target = null): Promise<void> {
  return importPartidasFromFiles([file], target);
}

/** ¿El .bc3 es una obra completa? La descarga del Generador de Precios de CYPE
 *  trae UNA sola partida (con su capítulo de clasificación): eso es una partida. */
export function esObraCompleta(r: Bc3ImportResult): boolean {
  return r.report.partidas > 1;
}

/** Nombre que pone `blankObraData` si no se escribe uno: no cuenta como puesto. */
const NOMBRE_POR_DEFECTO = 'Obra nueva';

/** ¿El dato de la obra en blanco tiene contenido que el .bc3 no debe pisar? */
function tieneValor(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return v != null;
}

/** Datos de la obra: los que el usuario ya rellenó (el nombre que le puso al
 *  crearla, la dirección…) mandan; el resto sale del .bc3. */
function fusionarDatosObra(actual: Obra, delBc3: Obra): Obra {
  const obra: Obra = { ...delBc3 };
  for (const [k, v] of Object.entries(actual)) if (tieneValor(v)) obra[k] = v;
  if (actual.denominacion.trim() === NOMBRE_POR_DEFECTO) obra.denominacion = delBc3.denominacion;
  return obra;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Carga el .bc3 como LA obra (en blanco): lo mismo que «Cargar al presupuesto»
 *  de la vista Importar, conservando lo que el .bc3 no trae y la obra en blanco
 *  ya puede tener (datos de la obra, planos subidos, estudio de residuos). */
function cargarEnObraEnBlanco(result: Bc3ImportResult, fileName: string): void {
  const st = useObraStore.getState();
  const data = {
    ...result.data,
    obra: fusionarDatosObra(st.obra, result.data.obra),
    planos: st.planos,
    estudioRcd: st.estudioRcd,
  };
  st.loadObra(data); // salta a Presupuesto (y limpia el toast anterior)

  const r = result.report;
  // Mismo umbral que el gate de PEM de la vista Importar (1 €, redondeo).
  const desvio = r.deltaCents != null && Math.abs(r.deltaCents) >= 100;
  const resumen = `Obra importada de ${fileName}: ${plural(r.chapters, 'capítulo', 'capítulos')} · ${plural(
    r.partidas,
    'partida',
    'partidas',
  )} · PEM ${fmtCents(r.pemCents)}`;
  useToastStore
    .getState()
    .show(
      desvio
        ? `${resumen}. Desviación de PEM de ${fmtCents(r.deltaCents!)} respecto al archivo: revísalo.`
        : `${resumen}.`,
      undefined,
      desvio ? { tone: 'warn' } : undefined,
    );
}

/** Drop de UN .bc3 sobre una obra en blanco: si es una obra completa se carga
 *  entera; si es una partida (CYPE), sigue el camino de siempre sin reparsear. */
async function importarEnObraEnBlanco(file: File, target: Target): Promise<void> {
  if (importing) return;
  importing = true;
  try {
    let parsed: Bc3ImportResult;
    try {
      parsed = await parseFile(file);
    } catch (e) {
      useToastStore
        .getState()
        .show(e instanceof Bc3ImportError ? e.message : 'No se pudo leer el archivo .bc3.', undefined, {
          tone: 'error',
        });
      return;
    }
    // Se vuelve a mirar tras el parseo (asíncrono): pudo añadirse un capítulo.
    if (esObraCompleta(parsed) && useObraStore.getState().chapters.length === 0) {
      cargarEnObraEnBlanco(parsed, file.name);
      return;
    }
    await importarLote([file], target, new Map([[file, parsed]]));
  } finally {
    importing = false;
  }
}

/**
 * Procesa un drop sobre el presupuesto, con los ficheros y los `types` del
 * `DataTransfer` ya capturados de forma SÍNCRONA por el llamante (el evento de
 * drag no sobrevive al import dinámico). Los .bc3 se importan TODOS de una vez;
 * si no cae ninguno, otro fichero o un ENLACE (arrastrar el icono FIE BDC desde
 * el navegador, que solo entrega la URL y choca con CORS) avisan de forma
 * accionable. Soltar una mezcla importa los .bc3 e ignora el resto. Sobre una
 * obra en blanco, UN .bc3 de obra completa se carga entero (ver cabecera).
 */
export function processBudgetDrop(
  files: readonly File[],
  types: string[],
  target: Target = null,
): void {
  if (files.length > 0) {
    const bc3s = files.filter(isBc3File);
    if (bc3s.length === 1 && useObraStore.getState().chapters.length === 0) {
      void importarEnObraEnBlanco(bc3s[0]!, target);
      return;
    }
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
