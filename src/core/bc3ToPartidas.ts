/* ===========================================================================
   core/bc3ToPartidas — Importar UNA partida desde un .bc3 (export FIE BDC de CYPE).
   ---------------------------------------------------------------------------
   Un export FIE BDC del Generador de Precios CYPE es un .bc3 con UNA partida
   (su descomposición + recursos). Esta capa lo adapta a `RefCopyItem[]` para
   enrutarlo por el pipeline de copia de Referencia (requestCopyRefPartidas →
   applyCopy): inserta la partida en el presupuesto SIN reemplazar la obra.
   Reutiliza `bc3ToObra` (charset, recorrido, CI del ~K, recálculo de precio desde
   el descompuesto, marca precioManual) y APLANA solo las partidas hoja; descarta
   capítulos y rates (GG/BI/IVA del ~K) — el destino conserva los suyos.
   =========================================================================== */
import { bc3ToObra, Bc3ImportError, type Bc3ImportResult, type Bc3Report } from './bc3import';
import { descompUnit } from './banco';
import { round2 } from './money';
import { hydrateItem, type RefCopyItem } from './refdata';
import type { Item } from './types';

export interface Bc3PartidasResult {
  items: RefCopyItem[];
  report?: Bc3Report;
  /** Mensaje accionable si no se extrajo ninguna partida (sin partidas, estructura
   *  no reconocible, o error de parseo). La UI lo muestra como aviso, no como crash. */
  error?: string;
}

/** Etiqueta de procedencia para la partida importada (`baseSource`). */
function sourceLabel(report: Bc3Report): string {
  const prog = report.program?.trim();
  if (prog && /cype/i.test(prog)) return 'CYPE GP (.bc3)';
  if (prog) return `${prog.slice(0, 40)} (.bc3)`;
  return 'Importado .bc3';
}

/**
 * `bc3ToObra` PLIEGA el CI global del ~K en el precio unitario (convención Presto:
 * la línea «Costes indirectos» se añade al descompuesto). El Generador de Precios
 * CYPE muestra el precio SIN ese CI (REC010 = 902,50 €): el CI es un coeficiente de
 * PROYECTO, no del precio de la partida. Para que el importado cuadre con CYPE y el
 * CI quede VISIBLE sin mezclarse (decisión del usuario), se quita esa única línea
 * (code `%CI`, la que añade `applyCostesIndirectos`) y se recalcula el precio = costes
 * directos (incluida la línea «%» de complementarios del banco, que sí es directo). El
 * % del ~K viaja aparte en `ciPct` (badge). Sin ~K CI (ciPct 0) es un no-op.
 */
function stripGlobalCI(items: Item[], recursos: Parameters<typeof descompUnit>[1], ciPct: number): { items: Item[]; precio: number } {
  const kept = ciPct > 0 ? items.filter((it) => !(it.type === '%CI' && it.code === '%CI')) : items;
  return { items: kept, precio: round2(descompUnit(kept, recursos)) };
}

/**
 * Adapta los bytes de un .bc3 a `RefCopyItem[]` listos para `requestCopyRefPartidas`.
 * Normalmente devuelve 1 partida (caso CYPE); soporta N partidas hoja sin coste
 * extra (la UI avisa si N>1, porque se vuelcan planas, sin su estructura). Nunca
 * lanza: los fallos vuelven en `error`.
 */
export function bc3ToRefCopyItems(bytes: Uint8Array): Bc3PartidasResult {
  let parsed;
  try {
    parsed = bc3ToObra(bytes);
  } catch (e) {
    if (e instanceof Bc3ImportError) {
      return { items: [], error: 'El archivo .bc3 no contiene ninguna partida importable.' };
    }
    return { items: [], error: e instanceof Error ? e.message : 'No se pudo leer el archivo .bc3.' };
  }
  return refCopyItemsFromObra(parsed);
}

/**
 * Transforma (barato, hilo principal) el resultado YA parseado de `bc3ToObra`
 * (el worker hace el parseo pesado) en `RefCopyItem[]`. Separado de
 * `bc3ToRefCopyItems` para que la UI reutilice el worker existente.
 */
export function refCopyItemsFromObra({ data, report }: Bc3ImportResult): Bc3PartidasResult {
  const sourceName = sourceLabel(report);
  const ciPct = report.ciPct > 0 ? report.ciPct : undefined;
  const items: RefCopyItem[] = [];
  for (const chId of Object.keys(data.partidas)) {
    for (const p of data.partidas[chId] ?? []) {
      const { items: rawItems, precio } = stripGlobalCI(p.items, data.recursos, report.ciPct);
      items.push({
        sourceName,
        partida: {
          id: p.id,
          pos: p.pos,
          code: p.code,
          title: p.title,
          ud: p.ud,
          // Precio = costes directos (sin el CI global del ~K), como muestra CYPE.
          precio,
          mainType: p.mainType,
          desc: p.desc,
          // Precio de base congelado (autoridad): applyCopy lo respeta y el sync de
          // recursos no lo colapsa al fusionar un recurso colisionante a otro precio.
          precioManual: true,
          // CI del ~K, para el badge por partida (decisión: CI de origen visible).
          ciPct,
          // Hidrata desc/ud/precio desde el banco parseado (lo que lee detectCollisions).
          items: rawItems.map((it) => hydrateItem(it, data.recursos)),
        },
      });
    }
  }

  if (items.length === 0) {
    return { items, report, error: 'El archivo .bc3 no contiene ninguna partida importable.' };
  }
  return { items, report };
}
