/* ===========================================================================
   persist/liberar — «Liberar espacio» (§9.4, A1): los PDF del almacén que no
   usa ninguna obra, para borrarlos a mano tras confirmar. Nada se borra solo.

   Un PDF está «en uso» si lo nombra (`huellasEnUso`):
     · la obra en pantalla de esta pestaña (en memoria, aún sin guardar);
     · otra pestaña, en memoria o en su historial (se les pregunta por un
       `BroadcastChannel` y se esperan 500 ms);
     · cualquier obra guardada: de `ObraMeta.huellas` si es de esa misma meta;
       si no, de su sobre, en crudo si hace falta. Una obra que no se puede
       leer DETIENE la limpieza («limpieza detenida»).
   Lo que solo nombra el historial de Deshacer de ESTA pestaña (un plano quitado
   cuya alta sigue en `past`) va aparte: «Liberar ya», con su aviso.

   Nunca se ofrece un PDF tocado (adjuntado, reenlazado o restaurado) hace
   menos de 24 h. Borrar toma el Web Lock `concreta.planos` en exclusivo,
   vuelve a mirar las referencias y borra solo si la marca `sinReferenciaDesde`
   es la que se vio al listar (adjuntarlo entretanto la quita).
   =========================================================================== */
import { huellasEnCrudo, huellasEnUso, planoLegible } from '../core/planoDatos';
import type { PlanoMeta } from '../core/types';
import { useObraStore } from '../store';
import { usePlanoUiStore } from '../store/planoUiStore';
import { huellasDelHistorial } from '../store/temporal';
import { loadRaw, obraKey, obraKeys } from './persist';
import { CANDADO_PLANOS, borrarSinReferencia, sincronizarMarcas } from './planos';
import { huellasDeObraGuardada, reconcile, type ObraIndex } from './registry';
import { conCandado } from './tabLock';

const DIA = 86_400_000;
const CANAL = 'concreta.planos';
/** Lo que se espera la respuesta de las demás pestañas. */
export const ESPERA_PESTANAS_MS = 500;

/** Un PDF que se puede liberar. `marca`: su `sinReferenciaDesde` al listarlo. */
export interface PdfSinUso {
  huella: string;
  tamano: number;
  tocadoEn: string;
  marca: string;
  /** Nombre del fichero, si se sabe. */
  nombre: string | null;
}

/** Uno que solo guarda el historial de Deshacer de esta pestaña. */
export interface PdfDelHistorial extends PdfSinUso {
  /** Líneas de la obra en pantalla medidas sobre él (su capa). */
  lineas: number;
}

export type Busqueda =
  | { kind: 'detenida'; motivo: string }
  | { kind: 'ok'; libres: PdfSinUso[]; historial: PdfDelHistorial[]; recientes: number };

export type Liberacion =
  | { kind: 'detenida'; motivo: string }
  /** `conservados`: se volvieron a usar entre listar y borrar. */
  | { kind: 'ok'; liberados: number; bytes: number; conservados: number };

/* ---- las demás pestañas --------------------------------------------------------- */

interface CanalLike {
  postMessage(m: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
  close(): void;
}
type Mensaje = { t: 'pregunta'; id: string; de?: string } | { t: 'respuesta'; id: string; huellas: unknown };

/** Esta pestaña: su propio oyente no contesta a sus preguntas (su historial
 *  contaría como «otra pestaña lo usa» y «Liberar ya» no saldría nunca). */
const ESTA_PESTANA = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let crearCanal: () => CanalLike | null = () =>
  typeof BroadcastChannel === 'function' ? (new BroadcastChannel(CANAL) as unknown as CanalLike) : null;
let oyente: CanalLike | null = null;

/** Lo que usa esta pestaña: la obra en memoria y las dos pilas del historial. */
function huellasDeEstaPestana(): { memoria: Set<string>; historial: Set<string> } {
  return { memoria: new Set(huellasEnUso(useObraStore.getState())), historial: huellasDelHistorial() };
}

/** Contesta a las preguntas de otras pestañas (se instala al arrancar). */
export function escucharPreguntasDeHuellas(): void {
  if (oyente) return;
  oyente = crearCanal();
  if (!oyente) return;
  const canal = oyente;
  canal.onmessage = (e) => {
    const m = e.data as Mensaje | null;
    if (m?.t !== 'pregunta' || m.de === ESTA_PESTANA) return;
    const { memoria, historial } = huellasDeEstaPestana();
    canal.postMessage({ t: 'respuesta', id: m.id, huellas: [...memoria, ...historial] });
  };
}

/** Pregunta a las demás pestañas qué huellas usan y espera `esperaMs`. */
async function preguntarOtrasPestanas(esperaMs: number): Promise<Set<string>> {
  const out = new Set<string>();
  const canal = crearCanal();
  if (!canal) return out;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  canal.onmessage = (e) => {
    const m = e.data as Mensaje | null;
    if (m?.t !== 'respuesta' || m.id !== id || !Array.isArray(m.huellas)) return;
    for (const h of m.huellas) if (typeof h === 'string') out.add(h);
  };
  canal.postMessage({ t: 'pregunta', id, de: ESTA_PESTANA });
  await new Promise((r) => setTimeout(r, esperaMs));
  canal.close();
  return out;
}

/* ---- referencias ---------------------------------------------------------------- */

type Referencias = { enUso: Set<string>; historial: Set<string> } | { detenida: string };

const detenida = (que: string) => ({
  detenida: `Limpieza detenida: no se pudo leer ${que}. Para no borrar un PDF que use, no se borra nada.`,
});

async function referencias(esperaMs: number): Promise<Referencias> {
  const { memoria, historial } = huellasDeEstaPestana();
  const enUso = new Set(memoria);
  for (const h of await preguntarOtrasPestanas(esperaMs)) enUso.add(h);
  let idx: ObraIndex;
  try {
    idx = await reconcile();
  } catch {
    return detenida('la lista de obras');
  }
  for (const m of idx.obras) {
    const hs = await huellasDeObraGuardada(m);
    if (!hs) return detenida(`la obra «${m.name}»`);
    for (const h of hs) enUso.add(h);
  }
  // Sobres que el índice no lista (huérfanos dañados que se conservan para
  // recuperarlos): en crudo.
  try {
    const listadas = new Set(idx.obras.map((m) => obraKey(m.id)));
    for (const k of await obraKeys()) if (!listadas.has(k)) for (const h of huellasEnCrudo(await loadRaw(k))) enUso.add(h);
  } catch {
    return detenida('una obra guardada');
  }
  return { enUso, historial };
}

/* ---- buscar y liberar -------------------------------------------------------------- */

/**
 * Los PDF que ninguna obra usa (marcándolos) y los que solo guarda el historial
 * de esta pestaña. Los de menos de 24 h no se ofrecen: se cuentan en `recientes`.
 */
export async function buscarPdfSinUso(opts: { ahora?: number; esperaMs?: number } = {}): Promise<Busqueda> {
  const ahora = opts.ahora ?? Date.now();
  const r = await referencias(opts.esperaMs ?? ESPERA_PESTANAS_MS);
  if ('detenida' in r) return { kind: 'detenida', motivo: r.detenida };
  const metas = await sincronizarMarcas(r.enUso, new Date(ahora).toISOString());
  const estado = useObraStore.getState();
  const planos = estado.planos.filter((p): p is PlanoMeta => planoLegible(p));
  const libres: PdfSinUso[] = [];
  const historial: PdfDelHistorial[] = [];
  let recientes = 0;
  for (const [huella, m] of metas) {
    if (r.enUso.has(huella) || !m.sinReferenciaDesde) continue;
    if (!(Date.parse(m.tocadoEn) <= ahora - DIA)) {
      recientes++; // también un `tocadoEn` ilegible: nunca de menos
      continue;
    }
    const pdf: PdfSinUso = {
      huella,
      tamano: m.tamano,
      tocadoEn: m.tocadoEn,
      marca: m.sinReferenciaDesde,
      nombre: m.nombre ?? planos.find((p) => p.huella === huella)?.archivo ?? null,
    };
    if (!r.historial.has(huella)) libres.push(pdf);
    else {
      let lineas = 0;
      for (const ps of Object.values(estado.partidas))
        for (const p of ps) for (const l of p.med) if ((l.origen as { huella?: unknown } | undefined)?.huella === huella) lineas++;
      historial.push({ ...pdf, lineas });
    }
  }
  const porTamano = (a: PdfSinUso, b: PdfSinUso) => b.tamano - a.tamano;
  return { kind: 'ok', libres: libres.sort(porTamano), historial: historial.sort(porTamano), recientes };
}

/**
 * Borra los PDF elegidos. Con el candado exclusivo, vuelve a mirar las
 * referencias: uno que se volvió a usar (o cuya marca cambió) se conserva. Los
 * de `delHistorial` se borran aunque el historial de esta pestaña los nombre:
 * el usuario aceptó que Deshacer ya no recupere su capa.
 */
export function liberarPdf(
  elegidos: readonly { huella: string; marca: string; tamano: number; delHistorial?: boolean }[],
  opts: { esperaMs?: number } = {},
): Promise<Liberacion> {
  return conCandado(CANDADO_PLANOS, 'exclusive', async (): Promise<Liberacion> => {
    const r = await referencias(opts.esperaMs ?? ESPERA_PESTANAS_MS);
    if ('detenida' in r) return { kind: 'detenida', motivo: r.detenida };
    let liberados = 0;
    let bytes = 0;
    let conservados = 0;
    for (const p of elegidos) {
      const usado = r.enUso.has(p.huella) || (r.historial.has(p.huella) && !p.delHistorial);
      if (!usado && (await borrarSinReferencia(p.huella, p.marca))) {
        liberados++;
        bytes += p.tamano;
        usePlanoUiStore.getState().setDisponible(p.huella, false);
      } else conservados++;
    }
    return { kind: 'ok', liberados, bytes, conservados };
  });
}

/** Tests: otro canal entre pestañas (`null` = sin BroadcastChannel). */
export function __setCanalForTests(f: (() => CanalLike | null) | null): void {
  oyente?.close();
  oyente = null;
  crearCanal = f ?? (() => (typeof BroadcastChannel === 'function' ? (new BroadcastChannel(CANAL) as unknown as CanalLike) : null));
}
