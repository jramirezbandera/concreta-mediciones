/* ===========================================================================
   ai/snapshot — foto compacta de la obra para el bloque VOLÁTIL del prompt.
   ---------------------------------------------------------------------------
   Texto (no JSON: más denso en tokens y más legible para el modelo) con un
   PRESUPUESTO de tokens y degradación ANUNCIADA (decisión de la revisión de
   rendimiento, Issue 8):
     · si la obra cabe  → árbol completo, partidas y SUS LÍNEAS DE MEDICIÓN
     · si no cabe       → se van soltando lastre en este orden: medición de todas
                          las partidas → medición del capítulo activo → medición
                          de la partida abierta → detalle de partidas del
                          capítulo activo. Cada escalón DECLARA lo que falta.

   Las líneas de medición viajan porque son el dato que el asistente necesita
   para trabajar de verdad: leer una medición para derivar otra («cuenta los
   micros de la 1.1 y hazme la medición de la 1.3»), corregir una línea por su
   índice o explicar de dónde sale una cantidad. Sin ellas solo veía el total y
   tenía que pedirle al usuario que le dictara lo que ya está en pantalla.

   El objetivo son obras pequeñas/medianas, así que el caso normal cabe entero y
   el recorte solo aparece cuando estorba. Función PURA y testeable: recibe un
   subconjunto estructural del estado, no el store.
   =========================================================================== */
import { fmtEur, fmtNum, scaleCents, toEur, type Cents } from '../core/money';
import { lineParcial, partidaCantidad, partidaImporte } from '../core/medicion';
import { findNode } from '../core/tree';
import type { Chapter, MedLine, Partida, Cert, SubChapter } from '../core/types';

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

/** Cuánto detalle de medición entra en el cuerpo (escalones de degradación). */
export type MedDetail = 'todas' | 'activo' | 'abierta';

/** Dimensión tal cual está guardada (hasta 4 dec, sin ceros de relleno ni
 *  separador de miles) y con coma decimal. Fiel al dato, no al formato de
 *  pantalla: la tabla muestra 2 decimales y un 0,125 se vería «0,13». */
function dimNum(v: number): string {
  return String(Math.round(v * 1e4) / 1e4).replace('.', ',');
}

/** Una línea de medición, numerada con el ÍNDICE 1-based que usan las ops
 *  `editar_linea`/`borrar_linea`. Las dimensiones vacías NO se emiten (la regla
 *  del prompt ya dice que una dimensión ausente cuenta como 1), así que lo que
 *  se lee es exactamente lo que multiplica. */
function medLine(l: MedLine, i: number): string {
  const dims = (
    [
      ['uds', l.uds],
      ['largo', l.largo],
      ['ancho', l.ancho],
      ['alto', l.alto],
    ] as const
  )
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k} ${dimNum(Number(v))}`);
  const cuerpo = dims.length ? dims.join(' × ') : 'sin dimensiones';
  const com = l.comment?.trim();
  return `med #${i + 1}${com ? ` «${com}»` : ''}: ${cuerpo} = ${fmtNum(lineParcial(l))}`;
}

/** Línea de una partida: pos, código, título, cantidad, precio, importe y, si la
 *  cert en curso la tiene, lo certificado a origen y su %. Cuando la medición no
 *  se detalla, la línea lo DICE (si no, la ausencia de líneas se confundiría con
 *  una partida de cantidad fija y el modelo usaría `set_cantidad`). */
function partidaLine(
  p: Partida,
  coefK: number,
  certData: Record<string, number> | null,
  medVisible: boolean,
): string {
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
  if (!medVisible && p.med.length > 0) {
    line += ` | ${p.med.length} líneas de medición (detalle omitido)`;
  }
  return line;
}

/** Suma del importe (PEM) de todas las partidas de un capítulo. */
function chapterPem(all: Partida[], coefK: number): Cents {
  return all.reduce((s, p) => s + partidaImporte(p, coefK), 0);
}

/** Lo que necesita el emisor para decidir CUÁNTO detalle lleva cada partida. */
interface EmitCtx {
  coefK: number;
  certData: Record<string, number> | null;
  med: MedDetail;
  openPartidaId: string | null;
  activeChapterId?: string;
}

/** ¿Se detallan las líneas de esta partida? La partida ABIERTA siempre las lleva
 *  (es la que el usuario tiene delante cuando dice «esta partida»); el resto,
 *  según el escalón de degradación que haya cabido. */
function conMedicion(p: Partida, chapterId: string, ctx: EmitCtx): boolean {
  if (p.med.length === 0) return false;
  if (ctx.med === 'todas' || p.id === ctx.openPartidaId) return true;
  return ctx.med === 'activo' && chapterId === ctx.activeChapterId;
}

/** Emite un contenedor (capítulo o sub) y su subárbol; `withPartidas` controla si
 *  se listan las partidas o solo la cabecera con subtotal (modo degradado). */
function emitContainer(
  out: string[],
  node: Chapter | SubChapter,
  isChapter: boolean,
  chapterId: string,
  chapterPartidas: Partida[],
  ctx: EmitCtx,
  depth: number,
  withPartidas: boolean,
): void {
  const indent = '  '.repeat(depth);
  const own = partidasOf(chapterPartidas, isChapter ? null : node.id);
  if (isChapter) {
    out.push(
      `${indent}# ${node.code} ${node.title} (PEM ${eur(chapterPem(chapterPartidas, ctx.coefK))})`,
    );
  } else {
    out.push(`${indent}## ${node.code} ${node.title}`);
  }
  if (withPartidas) {
    for (const p of own) {
      const conMed = conMedicion(p, chapterId, ctx);
      out.push(`${indent}  ${partidaLine(p, ctx.coefK, ctx.certData, conMed)}`);
      if (conMed) for (const [i, l] of p.med.entries()) out.push(`${indent}    ${medLine(l, i)}`);
    }
  } else if (own.length > 0) {
    out.push(`${indent}  (${own.length} partidas — detalle omitido)`);
  }
  for (const sub of node.children ?? []) {
    emitContainer(out, sub, false, chapterId, chapterPartidas, ctx, depth + 1, withPartidas);
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

  // --- estructura ---
  const activeChapterId = found?.chapter.id;
  const buildBody = (withPartidas: boolean, med: MedDetail, onlyChapterId?: string): string[] => {
    const emitCtx: EmitCtx = {
      coefK,
      certData,
      med,
      openPartidaId: input.openPartidaId,
      activeChapterId,
    };
    const body: string[] = ['', 'ESTRUCTURA Y PARTIDAS:'];
    for (const ch of input.chapters) {
      const detail = withPartidas || ch.id === onlyChapterId;
      emitContainer(body, ch, true, ch.id, input.partidas[ch.id] ?? [], emitCtx, 0, detail);
    }
    return body;
  };

  /* Escalones de degradación, de más a menos detalle: gana el primero que quepa,
     y si no cabe ni el último se manda igual (más vale recortado que nada). Cada
     escalón por debajo del primero declara QUÉ falta y CÓMO conseguirlo, porque
     el modelo no puede pedir más datos: solo puede decírselo al usuario. */
  const FALTA_MEDICION =
    ' De las demás tienes el total y cuántas líneas tiene cada una, pero no su contenido: si' +
    ' necesitas verlo, pide al usuario que abra esa partida y te lo vuelva a preguntar.' +
    ' No inventes ni deduzcas líneas que no estén aquí.';
  const escalones: { withPartidas: boolean; med: MedDetail; only?: string; nota?: string }[] = [
    { withPartidas: true, med: 'todas' },
    {
      withPartidas: true,
      med: 'activo',
      nota:
        'NOTA: la obra es grande; solo se detallan las líneas de medición del capítulo activo y' +
        ' de la partida abierta.' + FALTA_MEDICION,
    },
    {
      withPartidas: true,
      med: 'abierta',
      nota:
        'NOTA: la obra es grande; solo se detallan las líneas de medición de la partida abierta.' +
        FALTA_MEDICION,
    },
    {
      withPartidas: false,
      med: 'abierta',
      only: activeChapterId,
      nota:
        'NOTA: la obra es grande; se listan los capítulos con su subtotal, pero solo se detallan' +
        ' las partidas del capítulo activo (y las líneas de medición de la partida abierta).' +
        ' Pide "detalla el capítulo N" para ver otro.' + FALTA_MEDICION,
    },
  ];

  for (const [i, e] of escalones.entries()) {
    const cuerpo = buildBody(e.withPartidas, e.med, e.only);
    const text = [...head, ...(e.nota ? ['', e.nota] : []), ...cuerpo].join('\n');
    if (text.length <= SNAPSHOT_CHAR_BUDGET || i === escalones.length - 1) {
      return { text, truncated: i > 0 };
    }
  }
  // Inalcanzable (el último escalón siempre devuelve), pero el tipo lo pide.
  return { text: head.join('\n'), truncated: true };
}
