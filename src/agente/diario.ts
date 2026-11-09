/* ===========================================================================
   agente/diario — cada lote del agente, para repetirlo sobre otra versión.
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md D4, F4)

   Tras escribir un lote, el MCP deja en `.mediciones/diario/` una ENTRADA:

     · de qué versión del fichero partió y cuál dejó (`antes`, `despues`: la
       `huellaTexto` de cada texto, que la app calcula igual);
     · quién la hizo (`autor`: la sesión del MCP, su cliente y su carpeta);
     · sus operaciones ANCLADAS (`agente/anclas`) y los ids que salieron.

   La app, si tenía cambios sin llevar a la carpeta cuando el fichero cambió,
   busca la CADENA de entradas que va de la versión que tenía en común con la
   carpeta a la que hay ahora, y la REPITE sobre lo suyo (`repetirCadena`), en
   una tienda aparte. Con los mismos ids, lo que creó el agente se llama igual
   en las dos: el agente puede seguir nombrándolo por su id.

   Puro: sin Node ni navegador. Escribirlo es de `agente/fichero` (Node) y
   leerlo, de `persist/carpeta` (la app).
   =========================================================================== */
import type { ObraData } from '../store';
import { tiendaAparte, toSerializable } from '../store';
import { desanclar } from './anclas';
import { aplicarLote, type PasoLote } from './motor';
import { leerOperaciones } from './operaciones';

/** Versión del formato de una entrada del diario. */
export const VERSION_DIARIO = 1;
/** Entradas que se guardan (las más viejas se borran). */
export const ENTRADAS_DIARIO = 60;

/** Quién hizo un lote: una sesión del agente. */
export interface Autor {
  /** Id de la sesión (un proceso del MCP, o una llamada de la CLI). */
  sesion: string;
  /** El cliente («claude-code 2.1.231», «cli»…), si se sabe. */
  cliente?: string;
  /** La carpeta desde la que trabaja esa sesión. */
  carpeta?: string;
}

export interface EntradaDiario {
  version: typeof VERSION_DIARIO;
  /** Nombre del fichero de la obra (sin carpeta): una carpeta puede tener varias. */
  fichero: string;
  fecha: string;
  autor: Autor;
  /** La versión del MCP que la escribió. */
  mcp?: string;
  /** `huellaTexto` del fichero que leyó y del que dejó. */
  antes: string;
  despues: string;
  /** Lo que se ha hecho, en una línea («+1 partida · +3 líneas»). */
  resumen?: string;
  pasos: PasoLote[];
}

/** Nombre del fichero de una entrada: se ordena por fecha. */
export function nombreEntrada(e: EntradaDiario): string {
  const fecha = e.fecha.replace(/[:.]/g, '-');
  return `${fecha}-${e.autor.sesion.replace(/[^a-zA-Z0-9-]/g, '')}-${e.despues.slice(0, 8)}.json`;
}

const esTexto = (x: unknown): x is string => typeof x === 'string';
const esLista = (x: unknown): x is unknown[] => Array.isArray(x);

/** Lee una entrada del diario; null si no lo es (o es de un formato que no se conoce). */
export function leerEntrada(texto: string): EntradaDiario | null {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null || o.version !== VERSION_DIARIO) return null;
  if (!esTexto(o.fichero) || !esTexto(o.antes) || !esTexto(o.despues) || !esTexto(o.fecha))
    return null;
  if (!esLista(o.pasos)) return null;
  const autor = o.autor as Autor | undefined;
  if (!autor || !esTexto(autor.sesion)) return null;
  // Las operaciones se validan otra vez, como las de un agente: el fichero es de fuera.
  const l = leerOperaciones(o.pasos.map((p) => (p as { op?: unknown })?.op));
  if (!l.ok) return null;
  const pasos: PasoLote[] = [];
  for (const [i, p0] of o.pasos.entries()) {
    const p = p0 as { lineas?: unknown; ids?: unknown };
    const ids = esLista(p.ids) && p.ids.every(esTexto) ? p.ids : [];
    const lineas = esLista(p.lineas) && p.lineas.every(esTexto) ? p.lineas : undefined;
    pasos.push({ op: l.ops[i]!, ids, ...(lineas ? { lineas } : {}) });
  }
  return {
    version: VERSION_DIARIO,
    fichero: o.fichero,
    fecha: o.fecha,
    autor: {
      sesion: autor.sesion,
      ...(esTexto(autor.cliente) ? { cliente: autor.cliente } : {}),
      ...(esTexto(autor.carpeta) ? { carpeta: autor.carpeta } : {}),
    },
    ...(esTexto(o.mcp) ? { mcp: o.mcp } : {}),
    antes: o.antes,
    despues: o.despues,
    ...(esTexto(o.resumen) ? { resumen: o.resumen } : {}),
    pasos,
  };
}

/**
 * Las entradas que llevan del fichero con huella `desde` al de huella `hasta`,
 * en orden; null si no hay una cadena completa (el fichero lo cambió alguien
 * que no deja diario: otra app, una edición a mano, un MCP viejo).
 */
export function cadena(
  entradas: readonly EntradaDiario[],
  desde: string,
  hasta: string,
): EntradaDiario[] | null {
  const por = new Map<string, EntradaDiario>();
  // Con dos entradas desde la misma versión (no debería pasar: el sello lo
  // impide), la más reciente.
  for (const e of [...entradas].sort((a, b) => a.fecha.localeCompare(b.fecha))) por.set(e.antes, e);
  const r: EntradaDiario[] = [];
  let h = desde;
  const vistas = new Set<string>();
  while (h !== hasta) {
    const e = por.get(h);
    if (!e || vistas.has(h)) return null;
    vistas.add(h);
    r.push(e);
    h = e.despues;
  }
  return r;
}

export type Repeticion =
  | { ok: true; data: ObraData }
  | {
      ok: false;
      /** Por qué no se pudo: para el diálogo de conflicto. */
      motivo: string;
    };

/**
 * Repite la cadena de lotes sobre `data` (la obra del técnico), en una tienda
 * aparte. Todo o nada: si una operación no se puede aplicar, no se devuelve nada.
 */
export function repetirCadena(data: ObraData, entradas: readonly EntradaDiario[]): Repeticion {
  const t = tiendaAparte(data);
  for (const e of entradas) {
    for (const paso of e.pasos) {
      const d = desanclar(t.getState(), paso);
      if (!d.ok) return { ok: false, motivo: d.motivo };
      const r = aplicarLote(t, [d.op], { ids: [paso.ids] });
      if (!r.ok) {
        const f = r.recibos.at(-1);
        return {
          ok: false,
          motivo: `${f?.label ?? paso.op.op}: ${f?.reason ?? 'no se pudo aplicar'}`,
        };
      }
    }
  }
  return { ok: true, data: toSerializable(t.getState()) };
}

/** Quién hizo una cadena, para el aviso: «Claude», o «Claude (2 sesiones)». */
export function autoria(entradas: readonly EntradaDiario[]): string {
  const sesiones = new Set(entradas.map((e) => e.autor.sesion));
  return sesiones.size > 1 ? `Claude (${sesiones.size} sesiones)` : 'Claude';
}
