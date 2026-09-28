/* ===========================================================================
   transfer — export/import del proyecto como .json (F6.3). Portabilidad y copia
   de seguridad del único proyecto (multi-proyecto = T-10). Separado de `persist`
   (que habla con IndexedDB): aquí solo se serializa a/desde texto y se valida.

   · Export: `toSerializable` → sobre con metadatos → blob .json descargable.
   · Import: texto → parse → validación ESTRUCTURAL → `fromSerializable` (gate de
     schemaVersion) → `ObraData`. Errores LEGIBLES (`malformado` / versión
     desconocida). La operación es DESTRUCTIVA (reemplaza el proyecto), así que la
     confirmación + el backup previo viven en la UI (ProjectBackup).
   · [A1] Copia .zip con planos (§9.2): `obra.json` + `planos/<huella>.pdf`.
     Los MISMOS topes al exportar (antes de empezar) y al importar (contando
     lo descomprimido de verdad). Al importar se rechazan los nombres
     desconocidos y los repetidos; la huella de cada PDF se comprueba al
     restaurarlo (`sync.restaurarZipSobreActiva`).
   =========================================================================== */
import { fmtNum } from '../core/money';
import { excedeTopes, huellasParaCopia, planoLegible } from '../core/planoDatos';
import type { PlanoMeta } from '../core/types';
import { fromSerializable, toSerializable, useObraStore, type ObraData } from '../store';
import { APP_VERSION, isObraData, newerVersionOf } from './persist';
import { leerBytes, leerMetaPlano, tienePlano } from './planos';
import { ErrorZip, EscritorZip, empiezaComoZip, leerDirectorio, leerEntrada, type EntradaZip } from './zip';

const EXPORT_KIND = 'concreta-obra';

/** Sobre de exportación: el dominio + metadatos de diagnóstico, autodescriptivo. */
export interface ObraExport {
  kind: typeof EXPORT_KIND;
  schemaVersion: number;
  exportedAt: string; // ISO 8601
  appVersion: string;
  data: ObraData;
}

/** Serializa el estado actual del dominio a texto JSON (sobre con metadatos). */
export function buildExportText(): string {
  return textoDeObra(toSerializable(useObraStore.getState()));
}

/** El sobre de exportación de `data`, como texto JSON. */
function textoDeObra(data: ObraData): string {
  const env: ObraExport = {
    kind: EXPORT_KIND,
    schemaVersion: data.schemaVersion,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    data,
  };
  return JSON.stringify(env, null, 2);
}

/** Descarga el proyecto como .json (copia portable). */
export function exportObraJson(filename = 'concreta-obra.json'): void {
  triggerDownload(buildExportText(), filename);
}

function triggerDownload(text: string, filename: string): void {
  descargarBlob(new Blob([text], { type: 'application/json' }), filename);
}

/** Descarga un Blob como fichero. La URL se suelta con retraso: el navegador
 *  lee un .zip grande DESPUÉS del clic. */
export function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Motivo de un import fallido, en mensaje legible. `demasiado-grande`: pasa
 *  de los topes de planos (§1.4), que protegen el validador y la capa de un
 *  fichero manipulado. [A1] `zip-rechazado`: la copia .zip no se abre, con su
 *  causa en `detalle` («La copia pasa de 2 GB.»). */
export type ImportErrorKind = 'malformado' | 'version-desconocida' | 'demasiado-grande' | 'zip-rechazado';

export class ImportError extends Error {
  constructor(
    public kind: ImportErrorKind,
    public detalle?: string,
  ) {
    super(detalle ?? kind);
    this.name = 'ImportError';
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Extrae el `ObraData` de lo parseado: acepta el sobre de export/guardado
 *  (`.data`) o un `ObraData` plano. `null` si no hay forma reconocible. */
function pickObraData(x: unknown): ObraData | null {
  if (isObraData(x)) return x;
  if (isRecord(x) && isObraData(x.data)) return x.data;
  return null;
}

/**
 * Parsea y valida un texto JSON de proyecto. Lanza `ImportError`:
 *   · `malformado`: no es JSON, o no contiene un `ObraData` estructuralmente sano.
 *   · `version-desconocida`: es de una versión MÁS NUEVA de Concreta (se mira
 *     antes que la forma: una v7 con otra estructura no es «malformado»), o de
 *     un `schemaVersion` sin migración.
 * No toca el store: el llamador decide confirmar/cargar.
 */
export function parseObraJson(text: string): ObraData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('malformado');
  }
  if (newerVersionOf(parsed) !== null) throw new ImportError('version-desconocida');
  const candidate = pickObraData(parsed);
  if (!candidate) throw new ImportError('malformado');
  if (excedeTopes(candidate)) throw new ImportError('demasiado-grande');
  try {
    return fromSerializable(candidate); // gate de schemaVersion
  } catch {
    throw new ImportError('version-desconocida');
  }
}

/**
 * Lee un `File` como texto. Usa `FileReader` (no `Blob.text()`): jsdom no
 * implementa `Blob.text`/`arrayBuffer` pero sí FileReader (igual que el import
 * .bc3 de F5.3).
 */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error ?? new Error('No se pudo leer el archivo'));
    fr.readAsText(file);
  });
}

/* ---- [A1] copia .zip con planos (§9.2) ---------------------------------------- */
const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface TopesZip {
  /** Descomprimido en total. */
  total: number;
  /** Por entrada. */
  entrada: number;
  entradas: number;
  obraJson: number;
}

/** Topes de la copia .zip: los mismos al exportar y al importar (y adjuntar
 *  avisa si la obra pasaría de ellos). */
export const TOPES_ZIP: TopesZip = { total: 2 * GB, entrada: 500 * MB, entradas: 500, obraJson: 50 * MB };

const OBRA_JSON = 'obra.json';
const RE_PDF = /^planos\/([0-9a-f]{64})\.pdf$/;
const nombrePdf = (huella: string) => `planos/${huella}.pdf`;

/** «2 GB», «500 MB», «1 000 bytes». */
function tam(n: number): string {
  if (n >= GB) return `${fmtNum(n / GB, n % GB ? 1 : 0)} GB`;
  if (n >= MB) return `${fmtNum(n / MB, 0)} MB`;
  return `${fmtNum(n, 0)} bytes`;
}

const planosVivos = (d: { planos: unknown }): PlanoMeta[] =>
  (Array.isArray(d.planos) ? d.planos : []).filter((p): p is PlanoMeta => planoLegible(p) && !p.quitado);

/** ¿Pasa una copia de estos tamaños de los topes? Devuelve por qué, o `null`. */
export function excedeTopesZip(obraJson: number, pdfs: readonly number[], topes: TopesZip = TOPES_ZIP): string | null {
  if (pdfs.length + 1 > topes.entradas) return `La copia tendría más de ${fmtNum(topes.entradas, 0)} archivos.`;
  if (obraJson > topes.obraJson) return `El presupuesto pasa de ${tam(topes.obraJson)}.`;
  if (pdfs.some((n) => n > topes.entrada)) return `Un plano pasa de ${tam(topes.entrada)}.`;
  if (pdfs.reduce((s, n) => s + n, obraJson) > topes.total) return `La obra con sus planos pasa de ${tam(topes.total)}.`;
  return null;
}

/** Qué lleva la copia .zip de `data` antes de hacerla. */
export interface PlanCopiaZip {
  /** Las huellas con sus bytes en este navegador (van en la copia). */
  huellas: { huella: string; tamano: number }[];
  /** Planos con su PDF en este navegador. */
  planos: number;
  /** Planos cuyo PDF NO está aquí: la copia sale «incompleta». */
  faltan: string[];
  /** Tamaño aproximado de la copia (el presupuesto, sin comprimir). */
  tamano: number;
  /** Si pasa de los topes: por qué. Entonces no se hace como .zip. */
  noCabe: string | null;
}

export async function planCopiaZip(data: ObraData, topes: TopesZip = TOPES_ZIP): Promise<PlanCopiaZip> {
  const json = new TextEncoder().encode(textoDeObra(data)).length;
  const vivos = planosVivos(data);
  const huellas: PlanCopiaZip['huellas'] = [];
  const hay = new Set<string>();
  for (const h of huellasParaCopia(data)) {
    if (!(await tienePlano(h).catch(() => false))) continue;
    const meta = await leerMetaPlano(h).catch(() => undefined);
    hay.add(h);
    huellas.push({ huella: h, tamano: meta?.tamano ?? vivos.find((p) => p.huella === h)?.tamano ?? 0 });
  }
  const faltan = vivos.filter((p) => !hay.has(p.huella)).map((p) => p.nombre);
  return {
    huellas,
    planos: vivos.length - faltan.length,
    faltan,
    tamano: huellas.reduce((s, x) => s + x.tamano, json),
    noCabe: excedeTopesZip(
      json,
      huellas.map((x) => x.tamano),
      topes,
    ),
  };
}

/**
 * Escribe la copia .zip de `data` según su `plan`: el presupuesto comprimido y
 * los PDF tal cual, uno a uno (`onProgreso(hechos, total)`). Un PDF que
 * desaparece entre el plan y la copia se cuenta en `faltan`.
 */
export async function construirCopiaZip(
  data: ObraData,
  plan: PlanCopiaZip,
  onProgreso?: (hechos: number, total: number) => void,
): Promise<{ blob: Blob; faltan: string[] }> {
  const zip = new EscritorZip();
  await zip.anadir(OBRA_JSON, new TextEncoder().encode(textoDeObra(data)), true);
  const faltan = [...plan.faltan];
  for (const [i, { huella }] of plan.huellas.entries()) {
    onProgreso?.(i, plan.huellas.length);
    const b = await leerBytes(huella);
    if (b) await zip.anadir(nombrePdf(huella), new Uint8Array(b), false);
    else faltan.push(...planosVivos(data).filter((p) => p.huella === huella).map((p) => p.nombre));
  }
  return { blob: zip.cerrar(), faltan };
}

/** Descarga cada PDF de la obra por separado, con su nombre original (cuando
 *  la obra no cabe en un .zip). Devuelve cuántos. */
export async function descargarPdfsSueltos(data: ObraData): Promise<number> {
  let n = 0;
  const vistos = new Set<string>();
  for (const p of planosVivos(data)) {
    if (vistos.has(p.huella)) continue;
    vistos.add(p.huella);
    const b = await leerBytes(p.huella).catch(() => undefined);
    if (!b) continue;
    descargarBlob(new Blob([b], { type: 'application/pdf' }), p.archivo);
    n++;
  }
  return n;
}

/** Una copia .zip leída y validada, lista para restaurar. */
export interface CopiaZip {
  data: ObraData;
  /** Las entradas de PDF por la huella de su NOMBRE (la calculada se
   *  compara al restaurar). */
  pdfs: ReadonlyMap<string, EntradaZip>;
  /** Bytes descomprimidos de toda la copia, contados. */
  tamano: number;
  /** Los bytes del PDF de esa huella, con los mismos topes. */
  leerPdf: (huella: string) => Promise<ArrayBuffer>;
}

/** ¿Es un .zip? (por su firma, no por la extensión). */
export async function esCopiaZip(archivo: Blob): Promise<boolean> {
  return empiezaComoZip(archivo);
}

/**
 * Lee y valida una copia .zip SIN escribir nada: nombres (solo `obra.json` y
 * `planos/<huella>.pdf`, sin repetidos), topes (contando lo descomprimido de
 * cada entrada; nunca los tamaños declarados) y el presupuesto
 * (`parseObraJson`). Lanza `ImportError` con su causa.
 */
export async function leerCopiaZip(archivo: Blob, topes: TopesZip = TOPES_ZIP): Promise<CopiaZip> {
  let entradas: EntradaZip[];
  try {
    entradas = await leerDirectorio(archivo, topes.entradas);
  } catch (e) {
    throw rechazo(e, topes);
  }
  const vistos = new Set<string>();
  const pdfs = new Map<string, EntradaZip>();
  let obra: EntradaZip | null = null;
  for (const e of entradas) {
    if (vistos.has(e.nombre)) throw new ImportError('zip-rechazado', `Nombre repetido en la copia: ${e.nombre}`);
    vistos.add(e.nombre);
    const m = RE_PDF.exec(e.nombre);
    if (e.nombre === OBRA_JSON) obra = e;
    else if (m) pdfs.set(m[1]!, e);
    else throw new ImportError('zip-rechazado', `Nombre desconocido en la copia: ${e.nombre}`);
  }
  if (!obra) throw new ImportError('zip-rechazado', 'La copia no trae obra.json: no es una copia de Concreta.');
  const entradaObra = obra;

  let total = 0;
  let nombreDe = (h: string) => `planos/${h.slice(0, 8)}….pdf`;
  /** Lee una entrada con su tope y lo que queda del total. */
  const leer = async (e: EntradaZip, tope: number, guardar: boolean) => {
    const max = Math.min(tope, topes.total - total);
    try {
      const r = await leerEntrada(archivo, e, { max, guardar, crc: e === entradaObra });
      total += r.tamano;
      return r.datos;
    } catch (err) {
      if (err instanceof ErrorZip && err.motivo === 'grande') {
        if (max < tope) throw new ImportError('zip-rechazado', `La copia pasa de ${tam(topes.total)}.`);
        const quien = e === entradaObra ? OBRA_JSON : `El PDF de ${nombreDe(RE_PDF.exec(e.nombre)![1]!)}`;
        throw new ImportError('zip-rechazado', `${quien} pasa de ${tam(tope)}.`);
      }
      throw rechazo(err, topes);
    }
  };

  const texto = new TextDecoder().decode((await leer(entradaObra, topes.obraJson, true))!);
  const data = parseObraJson(texto);
  const vivos = planosVivos(data);
  nombreDe = (h) => {
    const p = vivos.find((x) => x.huella === h);
    return p ? `«${p.nombre}»` : `planos/${h.slice(0, 8)}….pdf`;
  };
  for (const e of pdfs.values()) await leer(e, topes.entrada, false);

  return {
    data,
    pdfs,
    tamano: total,
    leerPdf: async (h) => {
      const e = pdfs.get(h);
      if (!e) throw new ImportError('zip-rechazado', `La copia no trae el PDF ${nombreDe(h)}.`);
      try {
        const r = await leerEntrada(archivo, e, { max: topes.entrada, guardar: true });
        return r.datos!.buffer as ArrayBuffer;
      } catch (err) {
        throw rechazo(err, topes);
      }
    },
  };
}

/** Un fallo al leer el .zip, como `ImportError` con su causa. */
function rechazo(e: unknown, topes: TopesZip): ImportError {
  if (e instanceof ImportError) return e;
  if (!(e instanceof ErrorZip)) return new ImportError('zip-rechazado', 'No se pudo leer el archivo.');
  switch (e.motivo) {
    case 'entradas':
      return new ImportError('zip-rechazado', `La copia tiene más de ${fmtNum(topes.entradas, 0)} archivos.`);
    case 'grande':
      return new ImportError('zip-rechazado', `La copia pasa de ${tam(topes.total)}.`);
    case 'cifrado':
      return new ImportError('zip-rechazado', `La copia tiene archivos con contraseña: ${e.entrada}.`);
    case 'metodo':
      return new ImportError('zip-rechazado', `La copia usa una compresión que Concreta no lee: ${e.entrada}.`);
    default:
      return new ImportError('zip-rechazado', 'El archivo .zip está dañado.');
  }
}
