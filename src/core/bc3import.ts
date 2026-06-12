/* ===========================================================================
   core/bc3import — Importación de obras FIEBDC-3 (.bc3) a `ObraData`.
   ---------------------------------------------------------------------------
   Producción del spike `spike/import/bc3-to-prototype.mjs` (validado contra
   .bc3 reales de Presto: PEM cuadra al céntimo salvo el redondeo del precio
   unitario). Diferencias respecto al spike:
     · Decodifica con `TextDecoder` del navegador (no `iconv-lite`/Node): soporta
       windows-1252 (ANSI), utf-8, iso-8859-1; cp850/cp437 caen a windows-1252.
     · NO pre-multiplica los precios por el coeficiente K: el K es una TASA del
       modelo (`rates.coefK`) que el motor aplica al calcular (igual que el resto
       de la app). Así el precio importado es la BASE y el PEM = Σ(cant·precio·K).
     · Marca `precioManual` donde el precio del .bc3 ≠ descompuesto (autoridad de
       la fuente), igual que `seedObraData`.
   El mapeo de estructura usa la DESCOMPOSICIÓN como verdad: raíz → capítulos →
   subcapítulos (N NIVELES) → partidas → recursos. Un nodo es contenedor
   (capítulo/sub) si tiene mediciones de hijos (~M, obras) O si su código lleva
   el marcador «#» de capítulo FIEBDC (bancos de precios, que no traen ~M).
   Cada contenedor del .bc3 se conserva en su nivel (SubChapter recursivo).
   BC3 es un GRAFO: un contenedor referenciado desde varios padres se CLONA en
   cada rama (ids propios por ruta, recursos compartidos por código) — como lo
   presenta Arquímedes; solo los ciclos reales (un ancestro de la propia rama)
   se cortan, con aviso.
   =========================================================================== */
import { BC3, type BC3Document, type ConceptNode } from '../vendor/bc3';
import { descompUnit } from './banco';
import { round2, toCents, type Cents } from './money';
import { pem as pemOf } from './totales';
import { DEFAULT_OBRA, DEFAULT_RATES } from './seed';
import type { Banco, Cert, Chapter, Item, MedLine, Obra, PartidasMap, Rates, ResourceType, SubChapter } from './types';

/**
 * Payload de dominio importado (sin `schemaVersion`; lo estampa el store al
 * cargarlo). Espeja `ObraData` sin acoplar `core` al store.
 */
export interface ImportedObra {
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  certs: Cert[];
  rates: Rates;
  obra: Obra;
}

export interface Bc3Report {
  /** Charset realmente usado para decodificar. */
  charset: string;
  /** Charset declarado en el ~V (si lo hay). */
  declaredCharset?: string;
  program?: string;
  version?: string;
  chapters: number;
  partidas: number;
  recursos: number;
  /** Partidas a las que se importó el detalle de medición (líneas). */
  medVisible: number;
  /** Coeficiente K global (1 si no hay ~K). */
  coefK: number;
  /** PEM calculado por el motor (céntimos). */
  pemCents: Cents;
  /** Precio de la raíz del .bc3 = PEM objetivo (céntimos), si existe. */
  rootPriceCents: Cents | null;
  /** pemCents − rootPriceCents (desviación de redondeo), si hay raíz. */
  deltaCents: Cents | null;
  diagnostics: { info: number; warn: number; error: number };
  /** Avisos no fatales (charset no soportado, sin ~K, etc.). */
  warnings: string[];
}

export interface Bc3ImportResult {
  data: ImportedObra;
  report: Bc3Report;
}

/** Error de importación con los diagnostics del parser para depurar. */
export class Bc3ImportError extends Error {
  constructor(
    message: string,
    readonly diagnostics: string[] = [],
  ) {
    super(message);
    this.name = 'Bc3ImportError';
  }
}

/* ---- decodificación de charset (navegador) -------------------------------- */
const CHARSET_LABEL: Record<string, string> = {
  ANSI: 'windows-1252',
  '1252': 'windows-1252',
  'WINDOWS-1252': 'windows-1252',
  'UTF-8': 'utf-8',
  UTF8: 'utf-8',
  'ISO-8859-1': 'iso-8859-1',
  LATIN1: 'iso-8859-1',
};

function decodeWith(bytes: Uint8Array, label: string): string | null {
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return null;
  }
}

/* ---- réplica de la medición del prototipo (dim vacía/0 = factor 1) --------- */
const dim = (x: number | undefined): number | '' =>
  x == null || Number.isNaN(x) || x === 0 ? '' : x;
const factor = (x: number | '' | undefined): number =>
  x === '' || x == null || Number.isNaN(Number(x)) ? 1 : Number(x);
const lineParcial = (l: { uds: number | ''; largo: number | ''; ancho: number | ''; alto: number | '' }): number =>
  round2(factor(l.uds) * factor(l.largo) * factor(l.ancho) * factor(l.alto));

/** Tipo de recurso del concepto: '%' → %CI; 1→MO, 2→MQ; resto → MAT. */
function badgeOf(code: string, type: number | undefined): ResourceType {
  if (code.startsWith('%')) return '%CI';
  if (type === 1) return 'MO';
  if (type === 2) return 'MQ';
  return 'MAT';
}

/* ---- parseo + selección de charset ---------------------------------------- */
function parseDocument(bytes: Uint8Array, warnings: string[]): { doc: BC3Document; charset: string; declared?: string } {
  let enc = 'windows-1252';
  let text = decodeWith(bytes, enc) ?? new TextDecoder().decode(bytes);
  let parsed = BC3.parse(text, { mode: 'lenient' });
  const declared = parsed.document?.metadata?.charset;
  const mapped = declared ? CHARSET_LABEL[declared.toUpperCase()] : undefined;
  if (declared && !mapped) warnings.push(`Charset «${declared}» no soportado por el navegador; se usa windows-1252.`);
  if (mapped && mapped !== enc) {
    const retext = decodeWith(bytes, mapped);
    if (retext != null) {
      enc = mapped;
      text = retext;
      parsed = BC3.parse(text, { mode: 'lenient' });
    }
  }
  if (!parsed.document) {
    const errs = parsed.diagnostics.filter((d) => d.level === 'error').slice(0, 20).map((d) => d.message);
    throw new Bc3ImportError('No se pudo parsear el archivo .bc3.', errs);
  }
  // Los diagnostics no-info del parser van a warnings: un hijo referenciado en
  // ~D sin ~C se DESCARTA del árbol (partida perdida) y el usuario debe verlo.
  const issues = parsed.diagnostics.filter((d) => d.level !== 'info').map((d) => d.message);
  const MAX_ISSUES = 8;
  for (const msg of issues.slice(0, MAX_ISSUES)) warnings.push(`Aviso del parser: ${msg}`);
  if (issues.length > MAX_ISSUES) warnings.push(`… y ${issues.length - MAX_ISSUES} avisos más del parser.`);
  return { doc: parsed.document, charset: enc, declared };
}

/* ---- tasas del registro ~K -------------------------------------------------
   El campo 1 del ~K es CI\GG\BI\BAJA\IVA (la librería solo lo expone en `raw`).
   El «coeficiente K» del modelo es el CI (costes indirectos): escala los
   precios base, igual que hacen Presto/Arquímedes al presentarlos — validado
   contra `obra ejemplo.bc3` (PEM cuadra con la raíz) y el BCCA (14,42 € =
   12,76 × 1,13). GG/BI/IVA se importan a `rates` solo si vienen > 0 (un 0 en
   bancos suele significar «no definido»). La BAJA no se aplica (el modelo no
   la contempla): si viene, se avisa para que el usuario sepa que el PEM no
   cuadrará con el objetivo de adjudicación. */
function ratesFromK(doc: BC3Document, warnings: string[]): Rates {
  const raw = doc.coefficients?.raw ?? '';
  const parts = raw.replace(/\r?\n/g, '').split('|');
  const sub = (parts[2] ?? '').split('\\');
  const num = (s: string | undefined): number | null => {
    const v = parseFloat(s ?? '');
    return Number.isFinite(v) ? v : null;
  };
  const ci = num(sub[0]);
  const gg = num(sub[1]);
  const bi = num(sub[2]);
  const baja = num(sub[3]);
  const iva = num(sub[4]);
  if (baja != null && baja !== 0)
    warnings.push(`El ~K declara una baja del ${baja}% que el modelo no aplica al PEM.`);
  return {
    ...DEFAULT_RATES,
    coefK: ci != null && ci !== 0 ? Math.round((1 + ci / 100) * 1e6) / 1e6 : 1,
    ...(gg != null && gg > 0 ? { gg: gg / 100 } : {}),
    ...(bi != null && bi > 0 ? { bi: bi / 100 } : {}),
    ...(iva != null && iva > 0 ? { iva: iva / 100 } : {}),
  };
}

/* ===========================================================================
   Mapeo principal
   =========================================================================== */
export function bc3ToObra(bytes: Uint8Array): Bc3ImportResult {
  const warnings: string[] = [];
  const { doc, charset, declared } = parseDocument(bytes, warnings);

  // Tipos de concepto: type 1/2/3 = recurso (MO/MQ/MAT); 0 = estructural.
  const typeByCode = new Map<string, number>();
  for (const [code, node] of doc.conceptsByCode) {
    const t = node.concept.type;
    if (t != null) typeByCode.set(code, t);
  }

  // Contenedor: tiene mediciones de hijos (obras) o lleva el marcador FIEBDC
  // de capítulo/raíz «#»/«##» en el código original (bancos de precios sin ~M).
  const isContainer = (node: ConceptNode): boolean =>
    node.measurements.length > 0 || node.concept.code.endsWith('#');
  const isSectionLine = (d: { units?: number; length?: number; latitude?: number; height?: number }): boolean =>
    d.units == null && d.length == null && d.latitude == null && d.height == null;
  // Líneas auxiliares del ~M que no son medición: 1/2 = subtotales, 3 = fórmula
  // (la librería no evalúa fórmulas; su `partial` saldría 1 y corrompería la suma).
  const isAuxLine = (t: string | undefined): boolean => t === '1' || t === '2' || t === '3';

  // FIEBDC: CANTIDAD = FACTOR × RENDIMIENTO; los campos VACÍOS valen 1 (el
  // BCCA trae rendimiento 0 explícito y debe quedarse en 0). La librería no
  // valida los números (puede entregar NaN) → un no-finito cuenta como ausente.
  const fin = (x: number | undefined): number | null =>
    x != null && Number.isFinite(x) ? x : null;
  const cantidadDe = (d: { factor?: number; performance?: number }): number =>
    (fin(d.factor) ?? 1) * (fin(d.performance) ?? 1);

  const chapters: Chapter[] = [];
  const partidas: PartidasMap = {};
  const recursos: Banco = {};
  let medVisible = 0;
  let medSeq = 0;
  let cyclesSkipped = 0;
  const containersSeen = new Set<string>(); // codeNorm de contenedores ya emitidos
  const containersReused = new Set<string>(); // referenciados desde >1 rama (clonados)

  /** Registra un recurso en el banco sin pisar el primero visto (homónimos). */
  function registerRecurso(code: string, type: ResourceType, node: ConceptNode | undefined): void {
    if (type === '%CI' || recursos[code]) return;
    recursos[code] = {
      type,
      desc: node?.concept.summary ?? '',
      ud: node?.concept.unit ?? '',
      precio: node?.concept.prices?.[0] ?? 0,
    };
  }

  /**
   * Recorre la descomposición de un contenedor y emite sus partidas. Cada
   * contenedor hijo crea un SubChapter EN SU NIVEL (recursivo, N niveles)
   * colgado de `parent` (el capítulo o el sub actual); las partidas se
   * etiquetan con su contenedor INMEDIATO (`sub`).
   * `counts` numera `pos` por grupo (contenedor inmediato), como `renumberChapter`.
   * `path` (codeNorms de los ANCESTROS de esta rama) corta SOLO los ciclos
   * reales (A→B→A), que recursarían hasta reventar la pila (la librería no
   * protege ciclos); un contenedor reutilizado desde OTRA rama no es un ciclo:
   * se CLONA con ids propios (BC3 es un grafo; el árbol exige una copia por
   * referencia, como lo muestra Arquímedes) y se anota para el aviso.
   */
  function collectPartidas(
    container: ConceptNode,
    ch: Chapter,
    parent: Chapter | SubChapter,
    counts: Record<string, number>,
    path: Set<string>,
  ): void {
    const sub: SubChapter | null = parent === ch ? null : (parent as SubChapter);
    // Alineación ~M↔hijo por el campo POSICIÓN (1-based dentro de la descompo-
    // sición del padre): la librería pierde el código del hijo del ~M y las
    // cuelga del padre en orden de archivo, así que alinear por índice se
    // desplaza en cuanto un hijo no tiene ~M (y puede colgar la medición de
    // OTRA partida si las cantidades coinciden). Primero-visto gana: los ~N de
    // certificación caen al MISMO array y no deben pisar al ~M.
    const measByPos = new Map<number, ConceptNode['measurements'][number]>();
    container.measurements.forEach((m, i) => {
      const last = [...m.positions].reverse().find((s) => s.trim() !== '');
      const p = last != null ? Number.parseInt(last, 10) : i + 1;
      const pos = Number.isInteger(p) && p >= 1 ? p : i + 1;
      if (!measByPos.has(pos)) measByPos.set(pos, m);
    });
    container.decompositions.forEach((d, i) => {
      const child = doc.getConcept(d.childCode);
      if (!child) return;
      if (isContainer(child)) {
        const norm = child.concept.codeNorm;
        if (path.has(norm)) {
          cyclesSkipped += 1; // ciclo real: el concepto es ancestro de su propia rama
          return;
        }
        if (containersSeen.has(norm)) containersReused.add(norm);
        else containersSeen.add(norm);
        const k = (parent.children ??= []).length + 1;
        const next: SubChapter = {
          id: `${parent.id}.${String(k).padStart(2, '0')}`,
          code: `${parent.code}.${k}`,
          title: (child.concept.summary || d.childCode).slice(0, 120),
        };
        parent.children.push(next);
        path.add(norm);
        collectPartidas(child, ch, next, counts, path);
        path.delete(norm);
        return;
      }
      const list = partidas[ch.id]!;
      const qty = round2(cantidadDe(d));
      const precio = child.concept.prices?.[0] ?? 0;
      const n = (counts[sub?.id ?? '_'] = (counts[sub?.id ?? '_'] ?? 0) + 1);
      const pid = `b3-${ch.id}-${list.length + 1}`;

      // Medición: alinea el ~M en la posición i+1 SOLO si reproduce la cantidad.
      let med: MedLine[] = [];
      const m = measByPos.get(i + 1);
      if (m && round2(m.total ?? 0) === qty) {
        const lines = m.details
          .filter((x) => !isAuxLine(x.type) && !isSectionLine(x))
          .map((x) => ({
            comment: x.comment ?? '',
            uds: x.units ?? 1,
            largo: dim(x.length),
            ancho: dim(x.latitude),
            alto: dim(x.height),
          }));
        if (lines.length && round2(lines.reduce((s, l) => s + lineParcial(l), 0)) === qty) {
          med = lines.map((l) => ({ ...l, id: `${pid}-m${(medSeq += 1)}` }));
          medVisible += 1;
        }
      }

      const items: Item[] = (child.decompositions ?? []).map((dc) => {
        const rc = doc.getConcept(dc.childCode);
        const type = badgeOf(dc.childCode, rc?.concept.type ?? undefined);
        registerRecurso(dc.childCode, type, rc);
        const raw = cantidadDe(dc);
        // Convención FIEBDC/Presto de los conceptos %: el rendimiento viaja
        // como FRACCIÓN (0.02 = 2 %); nuestro modelo guarda el PORCENTAJE (2).
        // Verificado con la trazadora F7.4a en Presto real (importe = base ×
        // rendimiento) y con el fixture (%PM0200: precio 2, rendimiento 0.02).
        const cantidad = type === '%CI' ? Math.round(raw * 100 * 1e4) / 1e4 : raw;
        return { code: dc.childCode, type, cantidad };
      });

      list.push({
        id: pid,
        sub: sub?.id,
        pos: `${sub ? sub.code : ch.code}.${n}`,
        code: d.childCode,
        title: (child.concept.summary || d.childCode).slice(0, 120),
        ud: child.concept.unit ?? '',
        precio,
        cantidad: qty,
        desc: child.concept.text || child.concept.summary || '',
        med,
        items,
        fromBase: true,
        baseSource: 'Importado .bc3',
      });
    });
  }

  // Capítulos de primer nivel = descomposición de la raíz (marcador «##») o,
  // si no hay descomposición, sus children. Las raíces SUELTAS se añaden como
  // capítulos extra (robustez genérica: archivos con varios árboles). Nota:
  // los códigos «-XXX» del ~D raíz (BCCA) ya los enlaza el parser propio
  // (src/vendor/bc3, fix en DParser.looksLikeChildCode) — el fallback queda
  // para raíces genuinamente sueltas.
  const roots = doc.roots;
  const root =
    roots.find((n) => n.concept.code.endsWith('##')) ?? (roots.length === 1 ? roots[0]! : null);
  const rootPrice = root ? root.concept.prices?.[0] ?? null : null;
  const topCodes: string[] = [];
  if (root && root.decompositions.length) topCodes.push(...root.decompositions.map((d) => d.childCode));
  else if (root) topCodes.push(...root.children.map((n) => n.concept.codeNorm));
  for (const n of roots) {
    if (n !== root && !topCodes.includes(n.concept.codeNorm)) topCodes.push(n.concept.codeNorm);
  }

  let ci = 0;
  for (const code of topCodes) {
    const chNode = doc.getConcept(code);
    const t = typeByCode.get(code);
    if (!chNode || (t != null && t >= 1)) continue; // un recurso no es capítulo
    ci += 1;
    const id = String(ci).padStart(2, '0');
    const ch: Chapter = { id, code: String(ci), title: chNode.concept.summary || code };
    chapters.push(ch);
    partidas[id] = [];
    containersSeen.add(chNode.concept.codeNorm);
    collectPartidas(chNode, ch, ch, {}, new Set([chNode.concept.codeNorm]));
  }
  if (cyclesSkipped > 0)
    warnings.push(
      `Se ignoraron ${cyclesSkipped} referencias circulares en la descomposición (archivo malformado).`,
    );
  if (containersReused.size > 0)
    warnings.push(
      `${containersReused.size} capítulo(s)/grupo(s) del .bc3 se reutilizan en varias ramas; ` +
        `su contenido se duplicó en cada una (cantidades independientes): ` +
        `${[...containersReused].slice(0, 5).join(', ')}${containersReused.size > 5 ? '…' : ''}.`,
    );

  if (chapters.length === 0) {
    throw new Bc3ImportError(
      'El archivo no contiene una estructura de obra reconocible (capítulos con partidas medidas). ¿Es una base de precios sin mediciones?',
    );
  }

  // El precio del .bc3 es autoridad: marca override donde no cuadre con el
  // descompuesto (igual que seedObraData), para que el sync de recursos no lo
  // colapse y el PEM se conserve.
  for (const ps of Object.values(partidas))
    for (const p of ps) {
      const items = p.items;
      if (items.length && round2(p.precio) !== descompUnit(items, recursos)) p.precioManual = true;
    }

  const rates = ratesFromK(doc, warnings);
  const coefK = rates.coefK;
  const certs: Cert[] = [{ id: 'c1', num: 1, period: 'Certificación nº 1', retencion: 0.05, data: {} }];
  const data: ImportedObra = {
    chapters,
    partidas,
    recursos,
    certs,
    rates,
    obra: { ...DEFAULT_OBRA, denominacion: root?.concept.summary || 'Obra importada' },
  };

  const pemCents = pemOf(partidas, coefK);
  const rootPriceCents = rootPrice != null ? toCents(rootPrice) : null;
  const summary = doc.getSummary();

  const report: Bc3Report = {
    charset,
    declaredCharset: declared,
    program: doc.metadata?.program,
    version: doc.metadata?.version,
    chapters: chapters.length,
    partidas: Object.values(partidas).reduce((s, ps) => s + ps.length, 0),
    recursos: Object.keys(recursos).length,
    medVisible,
    coefK,
    pemCents,
    rootPriceCents,
    deltaCents: rootPriceCents != null ? pemCents - rootPriceCents : null,
    diagnostics: summary.diagnostics,
    warnings,
  };

  return { data, report };
}
