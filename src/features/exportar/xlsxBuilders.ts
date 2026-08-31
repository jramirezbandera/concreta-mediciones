/* ===========================================================================
   features/exportar/xlsxBuilders — filas XLSX desde `core/listado` (F7.2).
   ---------------------------------------------------------------------------
   PURO (sin la librería en runtime: solo type-imports → no entra al bundle).
   POLÍTICA NUMÉRICA EXPLÍCITA (eng-review F7): cantidades, precios e importes
   van como CELDAS NUMÉRICAS (`type: Number`) con formato `#,##0.00` (Excel lo
   pinta es-ES: 1.234,56), NUNCA strings preformateados. Los importes llegan en
   céntimos (enteros exactos) y se convierten a euros con `toEur` justo al
   emitir la celda.

   POLÍTICA DE FÓRMULAS (F7.2b): todo importe DERIVADO se emite como FÓRMULA
   (`type: 'Formula'`), no como número muerto — importe = ROUND(cant·precio,2),
   cantidad = Σ parciales, subtotales/PEM/resumen encadenados por referencia —
   para que la hoja recalcule al editarla. Reglas:
     · La fórmula va SIN «=» inicial (OOXML la guarda desnuda en `<f>`) y en
       sintaxis en-US (funciones en inglés, coma de argumentos, punto decimal):
       Excel/LibreOffice la muestran localizadas (ROUND → REDONDEAR).
     · ROUND(x,2) replica `round2`/`importeCents` (half away from zero): la
       hoja reproduce los céntimos del motor. El precio se emite con su valor
       EXACTO (`precioExacto`, sin round2) mostrado a 2 dec: con K ≠ 1 los
       importes salen del precio sin cuantizar (como en la app y el PDF).
     · Subtotales de grupo/capítulo = SUBTOTAL(9,rango): los SUBTOTAL anidados
       se excluyen solos, así los grupos jerárquicos no cuentan doble.
   =========================================================================== */
import type { CellObject, Row } from 'write-excel-file/browser';
import type {
  CertListado,
  Firma,
  ObraMeta,
  PresupuestoListado,
  ResumenListado,
} from '../../core/listado';
import type { MedLineListado } from '../../core/listado';
import { firmaLugarFecha } from '../../core/listado';
import { toEur, type Cents } from '../../core/money';
import { docFileName } from './fileName';

/** Formato Excel de dinero/cantidades: 2 dec + miles (es-ES: 1.234,56). */
export const FMT_NUM = '#,##0.00';
/** Formato Excel de porcentaje ya expresado 0–100 (50,0%). */
export const FMT_PCT = '#,##0.0"%"';

const GRIS = '#64748b';
const BANDA = '#eef1f6';

/** Documento XLSX listo para `writeXlsxFile` (una hoja). */
export interface XlsxDoc {
  fileName: string;
  sheet: string;
  /** Orientación de página al imprimir (la inyecta el feature de impresión). */
  orientation: 'portrait' | 'landscape';
  columns: { width?: number }[];
  rows: Row[];
}

/* ---- celdas ---------------------------------------------------------------- */

function txt(value: string, over: Partial<CellObject> = {}): CellObject {
  return { value, type: String, ...over };
}

/** Celda de dinero: euros NUMÉRICOS desde céntimos (política numérica F7.2). */
function eur(c: Cents, over: Partial<CellObject> = {}): CellObject {
  return { value: toEur(c), type: Number, format: FMT_NUM, align: 'right', ...over };
}

/** Celda numérica de cantidad (medición/rendimiento/ejecutada). */
function num(value: number, over: Partial<CellObject> = {}): CellObject {
  return { value, type: Number, format: FMT_NUM, align: 'right', ...over };
}

/** Celda de FÓRMULA con el mismo aspecto que `eur`/`num` (política F7.2b). */
function fx(expr: string, over: Partial<CellObject> = {}): CellObject {
  return { value: expr, type: 'Formula', format: FMT_NUM, align: 'right', ...over };
}

function bold(cell: CellObject): CellObject {
  return { ...cell, fontWeight: 'bold' };
}

/** Tasa (fracción) como literal de fórmula: punto decimal y sin ruido float
 *  (0.13+0.06 → "0.19", no "0.19000000000000003"). */
function rateLit(rate: number): string {
  return String(Math.round(rate * 1e9) / 1e9);
}

/** Nombre de archivo .xlsx (sanitizado en `fileName.ts`, compartido con DOCX). */
export function xlsxFileName(titulo: string, denominacion: string): string {
  return docFileName(titulo, denominacion, 'xlsx');
}

/** ISO → dd/mm/aaaa ('' si falta/inválida). */
function fechaCorta(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES');
}

/** Cabecera compartida del documento (contrato de metadatos §4, como el PDF). */
function metaRows(titulo: string, meta: ObraMeta, extra: [string, string][] = []): Row[] {
  const pares: [string, string][] = [
    ['Expediente', meta.expediente],
    ['Promotor', meta.promotor],
    ['Constructora', meta.constructora],
    ...extra,
  ].filter((p): p is [string, string] => Boolean(p[1]));
  const dir = [meta.direccion, [meta.localidad, meta.provincia].filter(Boolean).join(' · ')]
    .filter(Boolean)
    .join(' · ');
  return [
    [txt(titulo.toUpperCase(), { textColor: GRIS, fontSize: 9 })],
    [txt(meta.denominacion || 'Obra sin denominación', { fontWeight: 'bold', fontSize: 14 })],
    ...(dir ? [[txt(dir, { textColor: GRIS })]] : []),
    ...pares.map((p): Row => [txt(p[0], { fontWeight: 'bold', fontSize: 9 }), txt(p[1], { columnSpan: 3 }), null, null]),
    [],
  ];
}

/**
 * Pie de firma por rol al final de la hoja (spacer + línea «En [lugar], a
 * [fecha]» + un bloque apilado por firmante). Vacío si no hay firmantes. En una
 * hoja de cálculo las firmas van apiladas (no en columnas como en el PDF/DOCX).
 */
function firmaRows(firma: Firma): Row[] {
  if (firma.firmantes.length === 0) return [];
  const rows: Row[] = [[], []];
  const lf = firmaLugarFecha(firma);
  if (lf) rows.push([txt(lf, { textColor: GRIS })], []);
  for (const f of firma.firmantes) {
    rows.push([txt(f.rol.toUpperCase(), { textColor: GRIS, fontSize: 9, fontWeight: 'bold' })]);
    rows.push([txt(f.nombre, { fontWeight: 'bold' })]);
    if (f.sub) rows.push([txt(f.sub, { textColor: GRIS, fontSize: 9 })]);
    rows.push([]);
  }
  return rows;
}

/* ---- Presupuesto y mediciones ---------------------------------------------- */

function medLabel(l: MedLineListado): string {
  const dims = l.dims
    .filter((v) => v !== '' && v != null)
    .map((v) => String(v).replace('.', ','))
    .join(' × ');
  const comment = l.comment || 'Sin comentario';
  return dims ? `${comment} — ${dims}` : comment;
}

/** Sangría de cabecera de grupo por profundidad (NBSP: Excel no la recorta). */
function sangria(depth: number): string {
  return '   '.repeat(Math.max(0, depth - 1));
}

export function buildPresupuestoXlsx(data: PresupuestoListado, meta: ObraMeta, firma: Firma): XlsxDoc {
  const rows: Row[] = metaRows('Presupuesto y mediciones', meta);
  const header: Row = [
    txt('Nº', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Código', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Descripción', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Ud.', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Cantidad', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
    txt('Precio', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
    txt('Importe', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
  ];
  /** Filas «Total capítulo» (col G): la fórmula del PEM las suma. */
  const totalesCap: number[] = [];
  for (const c of data.capitulos) {
    // La cabecera del capítulo repite el total: misma fórmula, se rellena al
    // cerrar el bloque (aún no se conoce dónde acaba).
    const capTotal = bold(fx(''));
    rows.push([
      txt(c.code, { fontWeight: 'bold' }),
      txt(c.title, { fontWeight: 'bold', columnSpan: 5 }),
      null,
      null,
      null,
      null,
      capTotal,
    ]);
    rows.push(header);
    const inicio = rows.length + 1; // primera fila de contenido del capítulo
    /** Cabeceras de grupo pendientes de rango: en PRE-ORDEN, el subárbol de
     *  cada una termina donde empieza el siguiente grupo de profundidad ≤. */
    const gruposAbiertos: { cell: CellObject; row: number; depth: number }[] = [];
    for (const g of c.grupos) {
      if (g.sub) {
        const cell = fx('', { textColor: GRIS });
        gruposAbiertos.push({ cell, row: rows.length + 1, depth: g.depth });
        rows.push([
          txt(sangria(g.depth) + g.sub.code, { textColor: GRIS, fontWeight: 'bold' }),
          txt(g.sub.title.toUpperCase(), { textColor: GRIS, fontWeight: 'bold', columnSpan: 5 }),
          null,
          null,
          null,
          null,
          cell,
        ]);
      }
      for (const r of g.rows) {
        const fila = rows.length + 1;
        // Las líneas de medición van DEBAJO (tras la descripción, si la hay):
        // la cantidad de la partida es su Σ, como `medTotal`.
        const medInicio = fila + (r.desc ? 2 : 1);
        const cantidad = r.med.length
          ? fx(`ROUND(SUM(E${medInicio}:E${medInicio + r.med.length - 1}),2)`)
          : num(r.cantidad);
        rows.push([
          txt(r.pos),
          txt(r.code),
          txt(r.title, { wrap: true }),
          txt(r.ud),
          cantidad,
          num(r.precioExacto),
          fx(`ROUND(E${fila}*F${fila},2)`),
        ]);
        if (r.desc) {
          rows.push([null, null, txt(r.desc, { textColor: GRIS, fontSize: 9, wrap: true, columnSpan: 5 }), null, null, null, null]);
        }
        for (const l of r.med) {
          rows.push([
            null,
            null,
            txt(medLabel(l), { textColor: GRIS, fontSize: 9, indent: 1 }),
            null,
            num(l.parcial, { textColor: GRIS, fontSize: 9 }),
            null,
            null,
          ]);
        }
      }
    }
    const fin = rows.length; // última fila de contenido del capítulo
    for (const [i, h] of gruposAbiertos.entries()) {
      const cierre = gruposAbiertos.slice(i + 1).find((x) => x.depth <= h.depth);
      h.cell.value = `SUBTOTAL(9,G${h.row + 1}:G${cierre ? cierre.row - 1 : fin})`;
    }
    const capExpr = `SUBTOTAL(9,G${inicio}:G${fin})`;
    capTotal.value = capExpr;
    totalesCap.push(rows.length + 1);
    rows.push([
      null,
      null,
      txt(`Total capítulo ${c.code} · ${c.title}`, { fontWeight: 'bold', columnSpan: 4 }),
      null,
      null,
      null,
      bold(fx(capExpr, { topBorderStyle: 'thin' })),
    ]);
    rows.push([]);
  }
  rows.push([
    null,
    null,
    txt('Presupuesto de Ejecución Material (PEM)', { fontWeight: 'bold', columnSpan: 4 }),
    null,
    null,
    null,
    totalesCap.length
      ? bold(fx(totalesCap.map((n) => `G${n}`).join('+'), { topBorderStyle: 'medium' }))
      : bold(eur(data.pem, { topBorderStyle: 'medium' })),
  ]);
  rows.push(...firmaRows(firma));
  return {
    fileName: xlsxFileName('Presupuesto y mediciones', meta.denominacion),
    sheet: 'Presupuesto',
    orientation: 'portrait',
    columns: [{ width: 9 }, { width: 12 }, { width: 56 }, { width: 6 }, { width: 11 }, { width: 11 }, { width: 13 }],
    rows,
  };
}

/* ---- Resumen de presupuesto ------------------------------------------------ */

export function buildResumenXlsx(data: ResumenListado, meta: ObraMeta, firma: Firma): XlsxDoc {
  const rows: Row[] = metaRows('Resumen de presupuesto', meta);
  rows.push([
    txt('Nº', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt('Capítulo', { fontWeight: 'bold', backgroundColor: BANDA }),
    txt(data.ci > 0 ? '% s/ C.D.' : '% s/ PEM', {
      fontWeight: 'bold',
      backgroundColor: BANDA,
      align: 'right',
    }),
    txt('Importe', { fontWeight: 'bold', backgroundColor: BANDA, align: 'right' }),
  ]);
  // Filas de capítulo (una por capítulo) y, tras una fila en blanco, la cadena
  // [CD → CI →] PEM → GG → BI → PEC → IVA → total: posiciones deterministas, se
  // calculan aquí para que los % y la cadena se refieran entre sí por fórmula.
  // Con CI de obra la Σ de capítulos son los costes DIRECTOS y el PEM los suma
  // con los indirectos, así que la cadena estrena dos filas por delante.
  const inicio = rows.length + 1;
  const n = data.rows.length;
  const conCI = data.ci > 0;
  const cdRow = inicio + n + 1; // Σ capítulos (el PEM mismo si no hay CI)
  const ciRow = cdRow + 1;
  const pemRow = conCI ? cdRow + 2 : cdRow;
  const [ggRow, biRow, pecRow, ivaRow] = [pemRow + 1, pemRow + 2, pemRow + 3, pemRow + 4];
  for (const [i, r] of data.rows.entries()) {
    rows.push([
      txt(r.code),
      txt(r.title, { wrap: true }),
      // El peso del capítulo es sobre la Σ de capítulos: así la columna cierra
      // en 100 % también cuando la obra lleva indirectos aparte.
      fx(`IF(D${cdRow}=0,0,D${inicio + i}/D${cdRow}*100)`, { format: FMT_PCT, textColor: GRIS }),
      eur(r.importe),
    ]);
  }
  rows.push([]);
  const linea = (
    label: string,
    cell: CellObject,
    opts: { rate?: number; strong?: boolean; cierre?: boolean } = {},
  ): Row => [
    null,
    txt(label, { fontWeight: opts.strong ? 'bold' : undefined }),
    opts.rate != null
      ? { value: opts.rate * 100, type: Number, format: FMT_PCT, align: 'right', textColor: GRIS }
      : null,
    // El total de licitación cierra con regla gruesa (es el fin del documento);
    // los hitos intermedios (PEM, PEC), con regla fina.
    opts.strong || opts.cierre
      ? bold({ ...cell, topBorderStyle: opts.cierre ? 'medium' : 'thin' })
      : cell,
  ];
  const sumaCaps = n ? fx(`SUM(D${inicio}:D${inicio + n - 1})`) : eur(data.cd);
  if (conCI) {
    rows.push(linea('Costes directos (suma de capítulos)', sumaCaps, { strong: true }));
    // El CI lee su % de la celda de al lado, como GG/BI: cambiarlo en la hoja
    // recalcula el PEM y toda la cadena.
    rows.push(linea('Costes indirectos', fx(`ROUND(D${cdRow}*C${ciRow}/100,2)`), { rate: data.rates.ci }));
    rows.push(
      linea('Presupuesto de Ejecución Material (PEM)', fx(`D${cdRow}+D${ciRow}`), { strong: true }),
    );
  } else {
    rows.push(linea('Presupuesto de Ejecución Material (PEM)', sumaCaps, { strong: true }));
  }
  // GG/BI/IVA leen su % de la celda de al lado (col C, expresado 0–100):
  // cambiarlo en la hoja recalcula la cadena entera.
  rows.push(linea('Gastos generales', fx(`ROUND(D${pemRow}*C${ggRow}/100,2)`), { rate: data.rates.gg }));
  rows.push(linea('Beneficio industrial', fx(`ROUND(D${pemRow}*C${biRow}/100,2)`), { rate: data.rates.bi }));
  rows.push(
    linea('Presupuesto de Ejecución por Contrata (s/ IVA)', fx(`D${pemRow}+D${ggRow}+D${biRow}`), {
      strong: true,
    }),
  );
  rows.push(linea('IVA', fx(`ROUND(D${pecRow}*C${ivaRow}/100,2)`), { rate: data.rates.iva }));
  const totalRow = rows.length + 1;
  rows.push(
    linea('Presupuesto base de licitación', fx(`D${pecRow}+D${ivaRow}`), { strong: true, cierre: true }),
  );
  // Fórmula legal de cierre (el PDF y el Word la escriben en letras). Aquí va
  // como FÓRMULA de texto sobre la celda del total: la hoja es viva —si se
  // retoca un %, el pie sigue diciendo la cantidad correcta— y por eso la cifra
  // va en números, que sí se pueden recalcular.
  rows.push([]);
  rows.push([
    {
      value: `"Asciende el presupuesto base de licitación a la expresada cantidad de "&TEXT(D${totalRow},"${FMT_NUM}")&" euros."`,
      type: 'Formula',
      textColor: GRIS,
      fontSize: 9,
      columnSpan: 4,
    },
    null,
    null,
    null,
  ]);
  rows.push(...firmaRows(firma));
  return {
    fileName: xlsxFileName('Resumen de presupuesto', meta.denominacion),
    sheet: 'Resumen',
    orientation: 'portrait',
    columns: [{ width: 9 }, { width: 48 }, { width: 10 }, { width: 14 }],
    rows,
  };
}

/* ---- Certificación ----------------------------------------------------------- */

export function buildCertXlsx(data: CertListado, meta: ObraMeta, firma: Firma): XlsxDoc {
  const congelados = fechaCorta(data.snapshotAt);
  const extra: [string, string][] = [
    ['Periodo', data.period],
    ['Precios a fecha', congelados],
  ];
  const rows: Row[] = metaRows(`Certificación de obra nº ${data.num}`, meta, extra);
  const header: Row = [
    'Nº',
    'Código',
    'Descripción',
    'Ud.',
    'Ofertada',
    'Ejecutada',
    '%',
    'Precio',
    'A origen',
    'Anterior',
    'Esta cert.',
  ].map((h, i) =>
    txt(h, { fontWeight: 'bold', backgroundColor: BANDA, align: i >= 4 ? 'right' : 'left' }),
  );
  /** Filas «Total capítulo»: certPEM (col I) y PEM anterior (col J) las suman. */
  const totalesCap: number[] = [];
  for (const c of data.capitulos) {
    // Totales de la cabecera del capítulo: misma fórmula que su fila de total,
    // se rellenan al cerrar el bloque.
    const cab = { i: bold(fx('')), j: bold(fx('')), k: bold(fx('')) };
    rows.push([
      txt(c.code, { fontWeight: 'bold' }),
      txt(c.title, { fontWeight: 'bold', columnSpan: 7 }),
      null,
      null,
      null,
      null,
      null,
      null,
      cab.i,
      cab.j,
      cab.k,
    ]);
    rows.push(header);
    const inicio = rows.length + 1; // primera fila de contenido del capítulo
    for (const g of c.grupos) {
      if (g.sub) {
        rows.push([
          txt(sangria(g.depth) + g.sub.code, { textColor: GRIS, fontWeight: 'bold' }),
          txt(g.sub.title.toUpperCase(), { textColor: GRIS, fontWeight: 'bold', columnSpan: 10 }),
          ...Array<null>(9).fill(null),
        ]);
      }
      for (const r of g.rows) {
        const fila = rows.length + 1;
        rows.push([
          txt(r.pos),
          txt(r.code),
          txt(r.title, { wrap: true }),
          txt(r.ud),
          num(r.ofertada),
          num(r.ejecutada),
          fx(`IF(E${fila}=0,0,F${fila}/E${fila}*100)`, { format: FMT_PCT, textColor: GRIS }),
          num(r.precioExacto),
          fx(`ROUND(F${fila}*H${fila},2)`),
          // «Anterior» no es derivable de esta hoja (viene de la cert N−1).
          eur(r.anterior),
          fx(`I${fila}-J${fila}`),
        ]);
      }
    }
    for (const e of c.extras) {
      const fila = rows.length + 1;
      rows.push([
        txt(e.pos),
        txt('P.C.', { textColor: '#b45309', fontWeight: 'bold' }),
        txt(e.title || 'Precio contradictorio', { wrap: true }),
        txt(e.ud),
        null,
        num(e.cantidad),
        null,
        num(e.precio),
        fx(`ROUND(F${fila}*H${fila},2)`),
        eur(e.anterior),
        fx(`I${fila}-J${fila}`),
      ]);
    }
    const fin = rows.length; // última fila de contenido del capítulo
    const st = (col: string) => `SUBTOTAL(9,${col}${inicio}:${col}${fin})`;
    cab.i.value = st('I');
    cab.j.value = st('J');
    cab.k.value = st('K');
    totalesCap.push(rows.length + 1);
    rows.push([
      null,
      null,
      txt(`Total capítulo ${c.code}`, { fontWeight: 'bold', columnSpan: 6 }),
      ...Array<null>(5).fill(null),
      bold(fx(st('I'), { topBorderStyle: 'thin' })),
      bold(fx(st('J'), { topBorderStyle: 'thin' })),
      bold(fx(st('K'), { topBorderStyle: 'thin' })),
    ]);
    rows.push([]);
  }
  // Resumen económico (col K): cadena de fórmulas que replica `certTotals` —
  // PEM certificado (Σ capítulos, col I) → GG+BI → PEC a origen → menos el PEC
  // anterior (Σ col J + sus GG+BI, misma fórmula que pecOrigen, auditoría B-03)
  // → esta cert → retención/ajustes → base → IVA → líquido.
  const t = data.totals;
  const ggbi = rateLit(data.rates.gg + data.rates.bi);
  const sumI = totalesCap.map((n) => `I${n}`).join('+');
  const sumJ = totalesCap.map((n) => `J${n}`).join('+');
  const hayCaps = totalesCap.length > 0;
  const fila = (label: string, cell: CellObject, strong = false): Row => [
    ...Array<null>(7).fill(null),
    txt(label, { fontWeight: strong ? 'bold' : undefined, columnSpan: 3 }),
    null,
    null,
    strong ? bold({ ...cell, topBorderStyle: 'thin' }) : cell,
  ];
  // Con CI de obra, la Σ de capítulos son los costes DIRECTOS certificados y el
  // PEM los suma con los indirectos (mismo % que el presupuesto): dos filas más
  // por delante, encadenadas por fórmula como el resto de la hoja.
  const conCI = t.ciOrigen > 0;
  const ciLit = rateLit(data.rates.ci);
  const cdRow = rows.length + 1;
  if (conCI) {
    rows.push(fila('Costes directos a origen', hayCaps ? fx(sumI) : eur(t.certCD)));
    rows.push(fila('Costes indirectos', fx(`ROUND(K${cdRow}*${ciLit},2)`)));
  }
  const pemRow = rows.length + 1;
  rows.push(
    fila(
      'Ejecución material a origen',
      conCI ? fx(`K${cdRow}+K${cdRow + 1}`) : hayCaps ? fx(sumI) : eur(t.certPEM),
      true,
    ),
  );
  const ggbiRow = rows.length + 1;
  rows.push(fila('Gastos generales y B.I.', fx(`ROUND(K${pemRow}*${ggbi},2)`)));
  const pecRow = rows.length + 1;
  rows.push(fila('Ejecución por contrata a origen', fx(`K${pemRow}+K${ggbiRow}`)));
  const prevRow = rows.length + 1;
  // MISMA cadena que el PEC a origen (auditoría B-03): CI sobre la Σ anterior y
  // GG+BI sobre ese PEM, cada redondeo aparte — si no, la línea «Certificado
  // anterior» no reproduce el PEC que se facturó en la cert N−1.
  const prevPem = conCI ? `((${sumJ})+ROUND((${sumJ})*${ciLit},2))` : `(${sumJ})`;
  rows.push(
    fila(
      'Certificado anterior',
      hayCaps ? fx(`-(${prevPem}+ROUND(${prevPem}*${ggbi},2))`) : eur(-t.pecPrev),
    ),
  );
  const estaRow = rows.length + 1;
  rows.push(fila('Esta certificación', fx(`K${pecRow}+K${prevRow}`), true));
  // Retención solo si la obra la tiene (>0): sin ella no se emite una línea de 0.
  if (data.retencion > 0)
    rows.push(
      fila(
        `Retención (${(data.retencion * 100).toLocaleString('es-ES')}%)`,
        fx(`-ROUND(K${estaRow}*${rateLit(data.retencion)},2)`),
      ),
    );
  for (const a of t.ajustesRows)
    rows.push(
      fila(
        a.label || 'Ajuste',
        // Un ajuste % se valora sobre «esta certificación» → fórmula; uno fijo
        // es un valor suelto (no depende de nada de la hoja).
        a.tipo === 'pct'
          ? fx(`${a.signo < 0 ? '-' : ''}ROUND(K${estaRow}*${rateLit(a.valor)},2)`)
          : eur(a.signo * a.importe),
      ),
    );
  const baseRow = rows.length + 1;
  // base = esta cert − retención + ajustes: todo lo emitido desde `estaRow`.
  rows.push(fila('Base imponible', fx(`SUM(K${estaRow}:K${rows.length})`)));
  const ivaRow = rows.length + 1;
  rows.push(fila('IVA', fx(`ROUND(K${baseRow}*${rateLit(data.rates.iva)},2)`)));
  rows.push(fila('Líquido a abonar', fx(`K${baseRow}+K${ivaRow}`), true));
  // Informativa (garantía retenida acumulada): bajo el líquido, sin negrita ni
  // borde. `null` = la obra no ha tenido retención → no se emite la línea.
  // Cross-cert: no es derivable de esta hoja, va como valor.
  if (data.retenidoAcumulado != null)
    rows.push(fila('Retenido acumulado (garantía)', eur(data.retenidoAcumulado)));
  rows.push(...firmaRows(firma));
  return {
    fileName: xlsxFileName(`Certificación nº ${data.num}`, meta.denominacion),
    sheet: `Certificación ${data.num}`,
    orientation: 'landscape',
    columns: [
      { width: 9 },
      { width: 12 },
      { width: 42 },
      { width: 6 },
      { width: 10 },
      { width: 10 },
      { width: 8 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ],
    rows,
  };
}
