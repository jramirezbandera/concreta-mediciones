/* ===========================================================================
   agente/formato — el fichero de una obra en carpeta (*.mediciones.json).
   ---------------------------------------------------------------------------
   Sin Node ni navegador: lo usan el MCP (`agente/fichero`, con `node:fs`) y,
   en la F3, la app con la File System Access API (docs/plan-agente-carpeta.md §5).

   · El contenido es el MISMO sobre que la copia `.json` (`kind`, `schemaVersion`,
     `appVersion`, `data`), sin `exportedAt`: cambiaría en cada guardado y
     ensuciaría cada comparación. Se puede importar en la app como una copia más.
   · La forma canónica es la de `JSON.stringify` con 2 espacios y salto de línea
     final, en el orden de claves que deja `toSerializable`. No se ordenan las
     claves: leer y volver a escribir sin cambios da el mismo texto (comprobado
     en pruebas), y así la app y el MCP escriben lo mismo.
   · La lectura es la del import de la app (`parseObraJson`): la misma validación
     estructural, los mismos topes y la misma cadena de migraciones.
   =========================================================================== */
import { ImportError, parseObraJson } from '../persist/transfer';
import { APP_VERSION } from '../persist/persist';
import { SCHEMA_VERSION, type ObraData } from '../store';

/** Sufijo de los ficheros de obra: lo distingue del `proyecto.json` de FEM. */
export const SUFIJO_OBRA = '.mediciones.json';
/** Carpeta de lo derivado, junto a la obra (copias `.bak`, `app.json`, diario). */
export const CARPETA_DERIVADOS = '.mediciones';

const KIND = 'concreta-obra';

/** El sobre que se escribe en el fichero. */
export interface SobreFichero {
  kind: typeof KIND;
  schemaVersion: number;
  appVersion: string;
  data: ObraData;
}

/** El texto canónico del fichero de una obra. */
export function textoObra(data: ObraData): string {
  const sobre: SobreFichero = {
    kind: KIND,
    schemaVersion: data.schemaVersion,
    appVersion: APP_VERSION,
    data,
  };
  return `${JSON.stringify(sobre, null, 2)}\n`;
}

export type MotivoLectura = 'malformado' | 'mas-nueva' | 'demasiado-grande' | 'version-desconocida';

export type LecturaObra =
  | {
      ok: true;
      /** Ya migrada a `SCHEMA_VERSION`. */
      data: ObraData;
      /** La versión de esquema con la que estaba escrito el fichero. */
      versionFichero: number;
    }
  | { ok: false; motivo: MotivoLectura; mensaje: string };

/** Versión de esquema que declara el texto (la del sobre o la de sus datos). */
function versionDeclarada(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.schemaVersion === 'number') return o.schemaVersion;
  const d = o.data as Record<string, unknown> | undefined;
  return typeof d?.schemaVersion === 'number' ? d.schemaVersion : null;
}

/** Lee el texto de un fichero de obra, con la validación del import de la app. */
export function leerTextoObra(texto: string): LecturaObra {
  let raw: unknown;
  try {
    raw = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'malformado', mensaje: 'el fichero no es JSON' };
  }
  const v = versionDeclarada(raw);
  if (v !== null && v > SCHEMA_VERSION) {
    return {
      ok: false,
      motivo: 'mas-nueva',
      mensaje: `la obra está escrita con la versión ${v} del formato y esta herramienta solo conoce hasta la ${SCHEMA_VERSION}: descarga el MCP nuevo desde la app`,
    };
  }
  try {
    const data = parseObraJson(texto);
    return { ok: true, data, versionFichero: v ?? data.schemaVersion };
  } catch (e) {
    if (!(e instanceof ImportError)) throw e;
    const mensajes: Record<string, string> = {
      malformado: 'el fichero no tiene la forma de una obra de Concreta Mediciones',
      'demasiado-grande': 'la obra pasa de los topes de planos de la app',
      'version-desconocida': 'la versión del formato de la obra no tiene migración',
    };
    const motivo = (e.kind === 'zip-rechazado' ? 'malformado' : e.kind) as MotivoLectura;
    return { ok: false, motivo, mensaje: mensajes[motivo] ?? e.message };
  }
}

/** Huella rápida de un texto (cyrb53 + longitud): para saber si cambió, no para
 *  seguridad. Síncrona y sin `crypto.subtle`, que no está en todos los entornos.
 *  La calculan igual la app y el MCP: el diario y `app.json` la usan para saber
 *  de qué versión del fichero hablan. */
export function huellaTexto(t: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}-${t.length}`;
}

/** Nombre de la obra sin el sufijo («Vivienda.mediciones.json» → «Vivienda»). */
export const baseFicheroObra = (fichero: string): string =>
  fichero.toLowerCase().endsWith(SUFIJO_OBRA) ? fichero.slice(0, -SUFIJO_OBRA.length) : fichero;

/** Lo que el técnico tiene abierto: `.mediciones/<obra>.app.json` (D7). */
export const nombreAppJson = (fichero: string): string => `${baseFicheroObra(fichero)}.app.json`;
/** La carpeta del diario de lotes del agente, dentro de `.mediciones/` (D4). */
export const CARPETA_DIARIO = 'diario';

/** Caracteres que Windows no admite en un nombre de fichero (y los de control). */
// eslint-disable-next-line no-control-regex -- los de control son justo los que hay que quitar
const PROHIBIDOS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Nombre del fichero de una obra a partir de su denominación (D2 de §10). */
export function nombreFicheroObra(denominacion: string): string {
  let base = denominacion
    .replace(PROHIBIDOS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  // Los nombres que Windows reserva (CON, NUL, COM1…), aunque lleven extensión.
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base)) base = `Obra ${base}`;
  return `${base || 'Obra'}${SUFIJO_OBRA}`;
}
