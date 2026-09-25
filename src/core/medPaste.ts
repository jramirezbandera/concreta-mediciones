/* ===========================================================================
   core/medPaste — operación PREPARADA de pegar líneas de medición, y las
   reglas puras de orden que comparten el store y la UI (reordenar, subir/bajar
   un bloque, dónde se inserta).

   Una sola estructura alimenta el diálogo de revisión Y la acción de store, así
   la vista previa (cantidad e importe antes → después) nunca diverge de lo que
   se aplica:

     copiar ─► clipboardStore.medLines (instantánea + procedencia)
                     │
     pegar ─► prepararPegado(destino, líneas, origen, ancla)
                     │   · líneas finales (kg/m del perfil del comentario)
                     │   · compatibilidad de formas (rótulo, fuera, ud)
                     │   · cantidad e importe del destino antes → después
                     ▼
              ¿compatible? ── sí ──► insertMedLines(…, prep.lines, prep.afterId)
                     │ no                     │  (revalida dentro del set:
                     ▼                        │   partida viva; si no, 'no-partida')
              MedPasteReview ── «Pegar tal cual» ──┘
                     │ «Cancelar»
                     ▼
                 nada cambia

     cortar → pegar ─► prepararMovimiento(origen vivo, ids, destino, ancla)
                     │   · contenido ACTUAL de las líneas (lo editado viaja)
                     │   · misma partida: reordena conservando ids (ancla
                     │     traducida al orden original; sin cambio = no-op)
                     │   · otra partida: ids nuevos + formas + certificadas
                     │   · faltantes (líneas del corte que ya no existen)
                     ▼
              ¿revisión? ── no ──► moveMedLinesTo(…, expect)  (un solo set;
                     │ sí                       'stale' si los vivos cambiaron)
                     ▼
              MedPasteReview ── «Mover N líneas» / «Mover las M restantes» /
                                «Pegar la copia guardada»

   El dato vive siempre en las cuatro casillas (uds · largo · ancho · alto);
   «Medir por» solo las rotula. Por eso pegar copia casilla a casilla y, si el
   destino las rotula de otra forma, lo dice ANTES de tocar el dinero.
   =========================================================================== */
import { blank, medTotal, partidaImporte } from './medicion';
import { MED_SLOTS, medFormaDef, pesoDesdeComentario } from './medForma';
import type { Cents } from './money';
import type { Cert, MedDim, MedForma, MedLine, Partida } from './types';

/** Rótulos de siempre, para una casilla con datos que la forma no usa. */
const GENERICOS = ['Uds', 'Longitud', 'Anchura', 'Altura'];

/** Rótulo de una casilla en una forma; `fuera` si la forma no la usa. */
export function rotuloCasilla(forma: MedForma, slot: MedDim): { label: string; fuera: boolean } {
  const i = MED_SLOTS.indexOf(slot);
  const { cols } = medFormaDef(forma);
  return { label: cols[i] ?? GENERICOS[i]!, fuera: i >= cols.length };
}

/** Unidad comparable: minúsculas, sin punto final, `m2`→`m²`, `m3`→`m³`, `ml`→`m`. */
export function normalizarUd(ud: string): string {
  const u = ud.trim().toLowerCase().replace(/\.$/, '');
  if (u === 'm2') return 'm²';
  if (u === 'm3') return 'm³';
  if (u === 'ml') return 'm';
  return u;
}

/**
 * Copia PROFUNDA de una línea lista para su partida destino: `expr` clonado y,
 * si el destino mide por Peso, el kg/m del perfil que nombre el comentario. El
 * id se conserva; el store le da uno nuevo al insertarla. Es el helper único de
 * construcción de líneas (`addMedLines` e `insertMedLines` pasan por aquí).
 */
export function lineaParaDestino(line: MedLine, forma: MedForma): MedLine {
  const out: MedLine = {
    id: line.id,
    comment: line.comment ?? '',
    uds: line.uds ?? '',
    largo: line.largo ?? '',
    ancho: line.ancho ?? '',
    alto: line.alto ?? '',
  };
  if (line.expr && Object.keys(line.expr).length > 0) out.expr = { ...line.expr };
  const cambio = pesoDesdeComentario(forma, out);
  if (cambio) {
    out[cambio.slot] = cambio.value;
    (out.expr ??= {})[cambio.slot] = cambio.expr;
  }
  return out;
}

/** Una casilla con datos cuyo significado cambia al pegar. */
export interface CambioCasilla {
  slot: MedDim;
  /** Rótulo en el origen («kg/m»). */
  de: string;
  /** Rótulo en el destino («Anchura»). */
  a: string;
  /** La forma destino no usa esa casilla (queda como columna «fuera»). */
  fuera: boolean;
}

export interface Compatibilidad {
  compatible: boolean;
  cambios: CambioCasilla[];
  /** La unidad normalizada difiere (m → m²). */
  udCambia: boolean;
}

/**
 * ¿Se pueden pegar estas líneas en el destino sin reinterpretar cifras? Es
 * INCOMPATIBLE si (a) una casilla con datos cambia de rótulo, (b) una casilla
 * con datos cae fuera de las columnas del destino, o (c) la ud normalizada
 * difiere. Sin origen (texto ajeno) solo se evalúa (b).
 */
export function compatibilidad(
  lines: readonly MedLine[],
  origen: { forma: MedForma; ud: string } | null,
  destino: { forma: MedForma; ud: string },
): Compatibilidad {
  const cambios: CambioCasilla[] = [];
  for (const slot of MED_SLOTS) {
    if (!lines.some((l) => !blank(l[slot]))) continue;
    const dst = rotuloCasilla(destino.forma, slot);
    const src = origen ? rotuloCasilla(origen.forma, slot) : null;
    if (dst.fuera) {
      cambios.push({ slot, de: src?.label ?? dst.label, a: dst.label, fuera: true });
    } else if (src && src.label !== dst.label) {
      cambios.push({ slot, de: src.label, a: dst.label, fuera: false });
    }
  }
  const udCambia = !!origen && normalizarUd(origen.ud) !== normalizarUd(destino.ud);
  return { compatible: cambios.length === 0 && !udCambia, cambios, udCambia };
}

/** Cantidad e importe de una partida en un momento dado. */
export interface ResumenCantidad {
  cantidad: number;
  importe: Cents;
  /** La cantidad es la FIJA (partida sin líneas). */
  fija: boolean;
}

/** Cantidad (Σ medición o fija) e importe de una partida. */
export function resumenCantidad(p: Partida, coefK: number): ResumenCantidad {
  const fija = p.med.length === 0;
  return {
    cantidad: fija ? (p.cantidad ?? 0) : medTotal(p.med),
    importe: partidaImporte(p, coefK),
    fija,
  };
}

/** Índice donde se insertan líneas «detrás de `afterId`». `null` o un id que no
 *  está = al final. */
export function indiceInsercion(med: readonly MedLine[], afterId: string | null): number {
  if (afterId == null) return med.length;
  const i = med.findIndex((l) => l.id === afterId);
  return i < 0 ? med.length : i + 1;
}

/** Datos de la partida de origen que enseña el diálogo. */
export interface OrigenPegado {
  code: string;
  forma: MedForma;
  ud: string;
}

/** Un cortado que se pega: se MUEVEN las líneas vivas del origen. */
export interface MovimientoPreparado {
  srcChapterId: string;
  srcPartidaId: string;
  srcCode: string;
  srcUd: string;
  /** Ids del corte que siguen existiendo, en su orden de origen. */
  lineIds: string[];
  /** Cuántas líneas del corte ya no existen. */
  faltan: number;
  mismaPartida: boolean;
  /** Misma partida y el orden no cambia: no hay nada que hacer. */
  noop: boolean;
  /** Certificadas de entre las que se mueven a OTRA partida (y en qué nº). */
  certLineIds: string[];
  certNums: number[];
  srcAntes: ResumenCantidad;
  srcDespues: ResumenCantidad;
}

export interface PegadoPreparado {
  destino: {
    chapterId: string;
    partidaId: string;
    code: string;
    forma: MedForma;
    ud: string;
  };
  origen: OrigenPegado | null;
  /** Ancla RESUELTA: id existente en el destino, o `null` = al final. */
  afterId: string | null;
  /** Líneas tal como quedarán (kg/m del perfil aplicado); ids aún de origen. */
  lines: MedLine[];
  compat: Compatibilidad;
  antes: ResumenCantidad;
  despues: ResumenCantidad;
  /** Presente si se mueven líneas cortadas (en vez de pegar copias). */
  mover?: MovimientoPreparado;
  /** Se pega la instantánea guardada al cortar porque ninguna línea sigue viva. */
  copiaGuardada?: boolean;
}

/**
 * Prepara un pegado: resuelve el ancla, construye las líneas finales, evalúa la
 * compatibilidad y calcula cantidad e importe del destino antes → después.
 * O(n·4). No toca el store.
 */
export function prepararPegado(args: {
  destino: Partida;
  chapterId: string;
  destinoForma: MedForma;
  lines: readonly MedLine[];
  origen: OrigenPegado | null;
  afterId: string | null;
  coefK: number;
}): PegadoPreparado {
  const { destino, destinoForma, coefK } = args;
  const afterId =
    args.afterId != null && destino.med.some((l) => l.id === args.afterId) ? args.afterId : null;
  const lines = args.lines.map((l) => lineaParaDestino(l, destinoForma));
  const at = indiceInsercion(destino.med, afterId);
  const med = [...destino.med.slice(0, at), ...lines, ...destino.med.slice(at)];
  return {
    destino: {
      chapterId: args.chapterId,
      partidaId: destino.id,
      code: destino.code,
      forma: destinoForma,
      ud: destino.ud,
    },
    origen: args.origen,
    afterId,
    lines,
    compat: compatibilidad(lines, args.origen, { forma: destinoForma, ud: destino.ud }),
    antes: resumenCantidad(destino, coefK),
    despues: resumenCantidad({ ...destino, med }, coefK),
  };
}

/**
 * Prepara MOVER líneas cortadas (Cortar → Pegar) de `src` a `destino`, con su
 * contenido ACTUAL (lo editado tras cortar viaja). En la misma partida conserva
 * los ids y solo reordena (el ancla se traduce al orden original, ver
 * `ordenTrasMoverBloque`); a otra partida van con ids nuevos, así que se
 * evalúan forma de medir y certificadas. Si no queda ninguna viva, `lines`
 * queda vacío y la UI ofrece pegar la copia guardada.
 */
export function prepararMovimiento(args: {
  src: Partida;
  srcChapterId: string;
  srcForma: MedForma;
  lineIds: readonly string[];
  destino: Partida;
  chapterId: string;
  destinoForma: MedForma;
  afterId: string | null;
  certs: readonly Cert[];
  coefK: number;
}): PegadoPreparado {
  const { src, destino, destinoForma, coefK } = args;
  const want = new Set(args.lineIds);
  const vivas = src.med.filter((l) => want.has(l.id));
  const ids = vivas.map((l) => l.id);
  const misma = src.id === destino.id;
  const srcAntes = resumenCantidad(src, coefK);
  const base = {
    destino: {
      chapterId: args.chapterId,
      partidaId: destino.id,
      code: destino.code,
      forma: destinoForma,
      ud: destino.ud,
    },
    origen: { code: src.code, forma: args.srcForma, ud: src.ud },
  };
  const mover = (over: Partial<MovimientoPreparado>): MovimientoPreparado => ({
    srcChapterId: args.srcChapterId,
    srcPartidaId: src.id,
    srcCode: src.code,
    srcUd: src.ud,
    lineIds: ids,
    faltan: args.lineIds.length - ids.length,
    mismaPartida: misma,
    noop: false,
    certLineIds: [],
    certNums: [],
    srcAntes,
    srcDespues: srcAntes,
    ...over,
  });

  if (misma) {
    const order = ordenTrasMoverBloque(
      src.med.map((l) => l.id),
      ids,
      args.afterId,
    );
    const r = resumenCantidad(destino, coefK);
    return {
      ...base,
      afterId: args.afterId,
      lines: vivas,
      compat: { compatible: true, cambios: [], udCambia: false },
      antes: r,
      despues: r,
      mover: mover({ noop: ids.length > 0 && !order }),
    };
  }

  const afterId =
    args.afterId != null && destino.med.some((l) => l.id === args.afterId) ? args.afterId : null;
  const lines = vivas.map((l) => lineaParaDestino(l, destinoForma));
  const at = indiceInsercion(destino.med, afterId);
  const med = [...destino.med.slice(0, at), ...lines, ...destino.med.slice(at)];
  const cert = lineasCertificadas(args.certs, src.id, ids);
  return {
    ...base,
    afterId,
    lines,
    compat: compatibilidad(lines, { forma: args.srcForma, ud: src.ud }, { forma: destinoForma, ud: destino.ud }),
    antes: resumenCantidad(destino, coefK),
    despues: resumenCantidad({ ...destino, med }, coefK),
    mover: mover({
      certLineIds: cert.lineIds,
      certNums: cert.certNums,
      srcDespues: resumenCantidad({ ...src, med: src.med.filter((l) => !want.has(l.id)) }, coefK),
    }),
  };
}

/** ¿Hay algo que el usuario deba confirmar antes de aplicar este pegado? */
export function necesitaRevision(prep: PegadoPreparado): boolean {
  if (prep.copiaGuardada || !prep.compat.compatible) return true;
  const m = prep.mover;
  return !!m && (m.faltan > 0 || (!m.mismaPartida && m.certLineIds.length > 0));
}

/**
 * Líneas certificadas: su id tiene `lineQty > 0` en alguna certificación de la
 * obra. Devuelve cuáles (en el orden pedido) y en qué certificaciones (nº). Una
 * partida certificada A MANO (sin `lineQty`) no cuenta: su cantidad no depende
 * de las líneas, así que borrarlas no le quita nada.
 */
export function lineasCertificadas(
  certs: readonly Cert[],
  partidaId: string,
  lineIds: readonly string[],
): { lineIds: string[]; certNums: number[] } {
  const hit = new Set<string>();
  const nums = new Set<number>();
  for (const c of certs) {
    const q = c.lineQty?.[partidaId];
    if (!q) continue;
    for (const id of lineIds) {
      if ((q[id] ?? 0) > 0) {
        hit.add(id);
        nums.add(c.num);
      }
    }
  }
  return {
    lineIds: lineIds.filter((id) => hit.has(id)),
    certNums: [...nums].sort((a, b) => a - b),
  };
}

/* ---- reglas de orden (ids en orden de lista) ------------------------------- */

/** Orden tras sacar `lineId` y ponerlo delante de `beforeId` (`null` = al
 *  final). `null` si no cambia nada o algún id no existe. */
export function ordenTrasMover(
  ids: readonly string[],
  lineId: string,
  beforeId: string | null,
): string[] | null {
  if (lineId === beforeId || !ids.includes(lineId)) return null;
  if (beforeId != null && !ids.includes(beforeId)) return null;
  const rest = ids.filter((id) => id !== lineId);
  const at = beforeId == null ? rest.length : rest.indexOf(beforeId);
  const out = [...rest.slice(0, at), lineId, ...rest.slice(at)];
  return out.every((id, i) => id === ids[i]) ? null : out;
}

/**
 * Orden tras MOVER un bloque (un cortado pegado en su propia partida) detrás
 * de `afterId` (`null` = al final). El bloque conserva su orden relativo. Si el
 * ancla es una de las líneas que se mueven, se traduce sobre el orden ORIGINAL
 * a la anterior más cercana que se queda; si no hay ninguna, al principio.
 * `null` si el orden no cambia (no-op: no consume el cortado).
 */
export function ordenTrasMoverBloque(
  ids: readonly string[],
  moving: readonly string[],
  afterId: string | null,
): string[] | null {
  const mov = new Set(moving.filter((id) => ids.includes(id)));
  if (mov.size === 0) return null;
  let anchor: string | null | 'start' = afterId;
  if (anchor != null && mov.has(anchor)) {
    const i = ids.indexOf(anchor);
    anchor = 'start';
    for (let j = i - 1; j >= 0; j--) {
      if (!mov.has(ids[j]!)) {
        anchor = ids[j]!;
        break;
      }
    }
  }
  if (anchor != null && anchor !== 'start' && !ids.includes(anchor)) anchor = null;
  const rest = ids.filter((id) => !mov.has(id));
  const block = ids.filter((id) => mov.has(id));
  const at = anchor == null ? rest.length : anchor === 'start' ? 0 : rest.indexOf(anchor) + 1;
  const out = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  return out.every((id, i) => id === ids[i]) ? null : out;
}

/**
 * Orden tras subir (-1) o bajar (+1) una posición cada línea de `moving`. Con
 * una selección no contigua cada línea salta a su vecina no seleccionada; si
 * cualquiera de ellas toca el borde en esa dirección, el bloque entero se
 * detiene (`null`), para no deshacer la forma de la selección.
 */
export function ordenTrasDesplazar(
  ids: readonly string[],
  moving: readonly string[],
  delta: -1 | 1,
): string[] | null {
  const sel = new Set(moving.filter((id) => ids.includes(id)));
  if (sel.size === 0) return null;
  const edge = delta < 0 ? ids[0] : ids[ids.length - 1];
  if (edge != null && sel.has(edge)) return null;
  const out = [...ids];
  if (delta < 0) {
    for (let i = 1; i < out.length; i++) {
      if (sel.has(out[i]!) && !sel.has(out[i - 1]!)) [out[i - 1], out[i]] = [out[i]!, out[i - 1]!];
    }
  } else {
    for (let i = out.length - 2; i >= 0; i--) {
      if (sel.has(out[i]!) && !sel.has(out[i + 1]!)) [out[i], out[i + 1]] = [out[i + 1]!, out[i]!];
    }
  }
  return out;
}
