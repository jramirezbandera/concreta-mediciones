/* ===========================================================================
   ai/snapshot — foto compacta de la obra para el bloque VOLÁTIL del prompt.
   ---------------------------------------------------------------------------
   Texto (no JSON: más denso en tokens y más legible para el modelo) con un
   PRESUPUESTO de tokens y degradación ANUNCIADA (decisión de la revisión de
   rendimiento, Issue 8):
     · si la obra cabe  → árbol completo + partidas en resumen
     · si NO cabe       → árbol de capítulos con subtotales + detalle SOLO del
                          capítulo activo, y el texto DECLARA que va recortado.

   El objetivo son obras pequeñas/medianas, así que el caso normal cabe entero y
   el recorte solo aparece cuando estorba. Función PURA y testeable: recibe un
   subconjunto estructural del estado, no el store.
   =========================================================================== */
import { fmtEur, fmtNum, scaleCents, toEur, type Cents } from '../core/money';
import { partidaCantidad, partidaImporte } from '../core/medicion';
import { findNode } from '../core/tree';
import type { Chapter, Partida, Cert, SubChapter } from '../core/types';

/** Subconjunto del estado que necesita el snapshot (el store lo satisface). */
export interface ObraSnapshotInput {
  obra: { denominacion?: string; localidad?: string };
  chapters: Chapter[];
  partidas: Record<string, Partida[]>;
  certs: Cert[];
  rates: { coefK?: number; iva?: number; gg?: number; bi?: number; ci?: number };
  view: string;
  active: string; // id de capítulo/sub activo (o sentinel "toda la obra")
  openPartidaId: string | null;
  curCert: number;
}

/** Techo del bloque volátil (~8k tokens ≈ 4 chars/token). Margen bajo el límite. */
export const SNAPSHOT_CHAR_BUDGET = 28_000;

const VIEW_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto',
  certificaciones: 'Certificaciones',
  resumen: 'Resumen',
  import: 'Importar',
};

function eur(c: Cents): string {
  return fmtEur(toEur(c));
}

/** Partidas de un contenedor (capítulo si subId es null, o subcapítulo). */
function partidasOf(all: Partida[], subId: string | null): Partida[] {
  return all.filter((p) => (subId ? p.sub === subId : !p.sub));
}

/** Línea de una partida: pos, código, título, cantidad, precio, importe y, si la
 *  cert en curso la tiene, lo certificado a origen y su %. */
function partidaLine(p: Partida, coefK: number, certData: Record<string, number> | null): string {
  const cant = partidaCantidad(p);
  const imp = eur(partidaImporte(p, coefK));
  let line = `${p.pos} ${p.code} · ${p.title || '(sin título)'} | ${fmtNum(cant)} ${p.ud} × ${fmtEur(
    p.precio,
  )} = ${imp}`;
  const cert = certData?.[p.id];
  if (cert !== undefined && cert > 0) {
    const pct = cant > 0 ? Math.round((cert / cant) * 100) : 0;
    line += ` | certificado ${fmtNum(cert)} ${p.ud} (${pct}%)`;
  }
  return line;
}

/** Suma del importe (PEM) de todas las partidas de un capítulo. */
function chapterPem(all: Partida[], coefK: number): Cents {
  return all.reduce((s, p) => s + partidaImporte(p, coefK), 0);
}

/** Emite un contenedor (capítulo o sub) y su subárbol; `withPartidas` controla si
 *  se listan las partidas o solo la cabecera con subtotal (modo degradado). */
function emitContainer(
  out: string[],
  node: Chapter | SubChapter,
  isChapter: boolean,
  chapterPartidas: Partida[],
  coefK: number,
  certData: Record<string, number> | null,
  depth: number,
  withPartidas: boolean,
): void {
  const indent = '  '.repeat(depth);
  const own = partidasOf(chapterPartidas, isChapter ? null : node.id);
  if (isChapter) {
    out.push(`${indent}# ${node.code} ${node.title} (PEM ${eur(chapterPem(chapterPartidas, coefK))})`);
  } else {
    out.push(`${indent}## ${node.code} ${node.title}`);
  }
  if (withPartidas) {
    for (const p of own) out.push(`${indent}  ${partidaLine(p, coefK, certData)}`);
  } else if (own.length > 0) {
    out.push(`${indent}  (${own.length} partidas — detalle omitido)`);
  }
  for (const sub of node.children ?? []) {
    emitContainer(out, sub, false, chapterPartidas, coefK, certData, depth + 1, withPartidas);
  }
}

export interface ObraSnapshot {
  text: string;
  /** true si se recortó el detalle por presupuesto de tokens. */
  truncated: boolean;
}

/**
 * Construye el snapshot. `totalCents` (total con IVA, si el llamante lo tiene) se
 * incluye en la cabecera; el PEM se calcula aquí.
 */
export function buildObraSnapshot(input: ObraSnapshotInput, totalCents?: Cents): ObraSnapshot {
  const coefK = input.rates.coefK ?? 1;
  const cur = input.certs[input.curCert];
  const certData = cur ? cur.data : null;

  // PEM global = Σ subtotales de capítulo (costes directos) + los indirectos de
  // obra, si los hay: el asistente tiene que ver el MISMO PEM que la hoja Resumen.
  const cd = input.chapters.reduce(
    (s, ch) => s + chapterPem(input.partidas[ch.id] ?? [], coefK),
    0,
  );
  const pem = cd + scaleCents(cd, input.rates.ci ?? 0);

  // --- cabecera + contexto (siempre) ---
  const head: string[] = [];
  const obraName = input.obra.denominacion?.trim() || '(obra sin nombre)';
  head.push(`OBRA: ${obraName}${input.obra.localidad ? ` · ${input.obra.localidad}` : ''}`);
  const partidaCount = input.chapters.reduce((n, ch) => n + (input.partidas[ch.id]?.length ?? 0), 0);
  head.push(
    `TOTALES: ${input.chapters.length} capítulos, ${partidaCount} partidas · PEM ${eur(pem)}` +
      (totalCents !== undefined ? ` · total con IVA ${eur(totalCents)}` : ''),
  );
  const rateBits: string[] = [];
  if (input.rates.iva !== undefined) rateBits.push(`IVA ${Math.round(input.rates.iva * 100)}%`);
  if (input.rates.gg !== undefined) rateBits.push(`GG ${Math.round(input.rates.gg * 100)}%`);
  if (input.rates.bi !== undefined) rateBits.push(`BI ${Math.round(input.rates.bi * 100)}%`);
  if (input.rates.ci) rateBits.push(`CI ${fmtNum(input.rates.ci * 100, 1)}%`);
  if (coefK !== 1) rateBits.push(`coef. K ${fmtNum(coefK, 4)}`);
  if (rateBits.length) head.push(`TASAS: ${rateBits.join(' · ')}`);

  // Contexto de UI (para resolver "esta partida", "este capítulo", "esta cert").
  const found = findNode(input.chapters, input.active);
  const activeLabel = found
    ? `${found.node.code} ${found.node.title}`
    : 'toda la obra';
  const ctx: string[] = [`Vista actual: ${VIEW_LABEL[input.view] ?? input.view}`, `Contenedor activo: ${activeLabel}`];
  if (input.openPartidaId) {
    const openP = input.chapters
      .flatMap((ch) => input.partidas[ch.id] ?? [])
      .find((p) => p.id === input.openPartidaId);
    if (openP) ctx.push(`Partida abierta: ${openP.pos} ${openP.code} ${openP.title}`);
  }
  if (cur) {
    ctx.push(`Certificación en curso: nº ${cur.num} (${cur.period || 'sin periodo'})`);
  }
  head.push(`CONTEXTO — ${ctx.join(' · ')}`);

  // --- estructura completa ---
  const buildBody = (withPartidas: boolean, onlyChapterId?: string): string[] => {
    const body: string[] = ['', 'ESTRUCTURA Y PARTIDAS:'];
    for (const ch of input.chapters) {
      const detail = withPartidas || ch.id === onlyChapterId;
      emitContainer(body, ch, true, input.partidas[ch.id] ?? [], coefK, certData, 0, detail);
    }
    return body;
  };

  const full = [...head, ...buildBody(true)].join('\n');
  if (full.length <= SNAPSHOT_CHAR_BUDGET) {
    return { text: full, truncated: false };
  }

  // --- degradado: solo el capítulo activo lleva detalle de partidas ---
  const activeChapterId = found?.chapter.id;
  const note =
    'NOTA: la obra es grande; se listan los capítulos con su subtotal, pero solo se detallan ' +
    'las partidas del capítulo activo. Pide "detalla el capítulo N" para ver otro.';
  const degraded = [...head, '', note, ...buildBody(false, activeChapterId)].join('\n');
  return { text: degraded, truncated: true };
}
