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
   partidas → recursos; un nodo CON medición es un contenedor (capítulo/sub).
   Subcapítulos se APLANAN en su capítulo (fiel al spike; 1 nivel de partidas).
   =========================================================================== */
import { BC3, type BC3Document, type ConceptNode } from 'bc3';
import { descompUnit } from './banco';
import { round2, toCents, type Cents } from './money';
import { pem as pemOf } from './totales';
import { DEFAULT_OBRA, DEFAULT_RATES } from './seed';
import type { Banco, Cert, Chapter, Item, MedLine, Obra, PartidasMap, Rates, ResourceType } from './types';

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
  return { doc: parsed.document, charset: enc, declared };
}

/* ---- coeficiente K del registro ~K ---------------------------------------- */
function coefKOf(doc: BC3Document): number {
  const raw = doc.coefficients?.raw ?? '';
  const parts = raw.replace(/\r?\n/g, '').split('|');
  const kPct = parseFloat(parts[2] ?? '');
  if (Number.isNaN(kPct) || kPct === 0) return 1;
  return Math.round((1 + kPct / 100) * 1e6) / 1e6;
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

  const isContainer = (node: ConceptNode): boolean => node.measurements.length > 0;
  const isSectionLine = (d: { units?: number; length?: number; latitude?: number; height?: number }): boolean =>
    d.units == null && d.length == null && d.latitude == null && d.height == null;

  const chapters: Chapter[] = [];
  const partidas: PartidasMap = {};
  const recursos: Banco = {};
  let medVisible = 0;
  let medSeq = 0;

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

  /** Recorre la descomposición de un contenedor y emite sus partidas. */
  function collectPartidas(container: ConceptNode, chId: string, chCode: string): void {
    const meas = container.measurements;
    container.decompositions.forEach((d, i) => {
      const child = doc.getConcept(d.childCode);
      if (!child) return;
      if (isContainer(child)) {
        collectPartidas(child, chId, chCode); // subcapítulo → se aplana en el capítulo
        return;
      }
      const list = partidas[chId]!;
      const qty = round2(d.performance ?? 0);
      const precio = child.concept.prices?.[0] ?? 0;
      const n = list.length + 1;
      const pid = `b3-${chId}-${n}`;

      // Medición: alinea la línea i del contenedor SOLO si reproduce la cantidad.
      let med: MedLine[] = [];
      const m = meas[i];
      if (m && round2(m.total ?? 0) === qty) {
        const lines = m.details
          .filter((x) => !isSectionLine(x))
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
        return { code: dc.childCode, type, cantidad: dc.performance ?? dc.factor ?? 0 };
      });

      list.push({
        id: pid,
        pos: `${chCode}.${n}`,
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

  // Capítulos de primer nivel = descomposición de la raíz (o sus children).
  const roots = doc.roots;
  const root = roots.length === 1 ? roots[0]! : null;
  const rootPrice = root ? root.concept.prices?.[0] ?? null : null;
  let topCodes: string[];
  if (root && root.decompositions.length) topCodes = root.decompositions.map((d) => d.childCode);
  else if (root) topCodes = root.children.map((n) => n.concept.codeNorm);
  else topCodes = roots.map((n) => n.concept.codeNorm);

  let ci = 0;
  for (const code of topCodes) {
    const chNode = doc.getConcept(code);
    const t = typeByCode.get(code);
    if (!chNode || (t != null && t >= 1)) continue; // un recurso no es capítulo
    ci += 1;
    const id = String(ci).padStart(2, '0');
    chapters.push({ id, code: String(ci), title: chNode.concept.summary || code });
    partidas[id] = [];
    collectPartidas(chNode, id, String(ci));
  }

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

  const coefK = coefKOf(doc);
  const certs: Cert[] = [{ id: 'c1', num: 1, period: 'Certificación nº 1', retencion: 0.05, data: {} }];
  const data: ImportedObra = {
    chapters,
    partidas,
    recursos,
    certs,
    rates: { ...DEFAULT_RATES, coefK },
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
