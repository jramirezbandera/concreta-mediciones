/* ===========================================================================
   agente/fichero — leer y escribir una obra en carpeta desde Node (MCP, CLI).
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md §5 y D4)

   · SELLO: el sha256 del contenido. Se escribe solo si el fichero sigue teniendo
     el sello con que se leyó: si lo cambió la app u otra sesión, no se pisa.
   · ESCRITURA ATÓMICA: un temporal en la misma carpeta y un `rename` encima, así
     la app nunca lee medio fichero. Antes se deja la versión anterior en
     `.mediciones/<fichero>.bak`.
   · Solo se escriben el fichero de la obra y `.mediciones/`: nada más de la carpeta.
   =========================================================================== */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { ObraData } from '../store';
import {
  CARPETA_DERIVADOS,
  SUFIJO_OBRA,
  leerTextoObra,
  textoObra,
  type MotivoLectura,
} from './formato';

/** Sello de un contenido: su sha256 en hexadecimal. */
export function sello(contenido: string | Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

/** Sello del fichero tal como está en el disco, o null si no existe. */
export function selloEnDisco(fichero: string): string | null {
  return existsSync(fichero) ? sello(readFileSync(fichero)) : null;
}

/** Los ficheros de obra de una carpeta (por su sufijo), ordenados. */
export function obrasEnCarpeta(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(SUFIJO_OBRA))
    .map((e) => join(carpeta, e.name))
    .sort((a, b) => a.localeCompare(b));
}

export type Resolucion =
  | { ok: true; fichero: string }
  | { ok: false; mensaje: string; candidatos?: string[] };

/**
 * El fichero de obra de una ruta: el propio fichero, o el único `*.mediciones.json`
 * de una carpeta. Con varios, no elige: los da para que se diga cuál.
 */
export function resolverObra(ruta: string): Resolucion {
  const r = resolve(ruta);
  if (!existsSync(r)) return { ok: false, mensaje: `no existe ${r}` };
  if (statSync(r).isFile()) {
    if (!r.toLowerCase().endsWith(SUFIJO_OBRA))
      return { ok: false, mensaje: `${basename(r)} no es un fichero de obra (*${SUFIJO_OBRA})` };
    return { ok: true, fichero: r };
  }
  const obras = obrasEnCarpeta(r);
  if (obras.length === 1) return { ok: true, fichero: obras[0]! };
  if (obras.length === 0)
    return {
      ok: false,
      mensaje: `la carpeta ${r} no tiene ninguna obra (*${SUFIJO_OBRA}); créala con nueva_obra o pásala desde la app`,
    };
  return {
    ok: false,
    mensaje: `la carpeta ${r} tiene ${obras.length} obras: di cuál`,
    candidatos: obras,
  };
}

export type LecturaFichero =
  | { ok: true; fichero: string; data: ObraData; versionFichero: number; sello: string }
  | { ok: false; fichero: string; motivo: MotivoLectura | 'no-existe'; mensaje: string };

/** Lee y valida el fichero de una obra (migrada en memoria; el disco no cambia). */
export function leerObra(fichero: string): LecturaFichero {
  if (!existsSync(fichero))
    return { ok: false, fichero, motivo: 'no-existe', mensaje: `no existe ${fichero}` };
  const bytes = readFileSync(fichero);
  const l = leerTextoObra(bytes.toString('utf8'));
  if (!l.ok) return { ok: false, fichero, motivo: l.motivo, mensaje: l.mensaje };
  return { ok: true, fichero, data: l.data, versionFichero: l.versionFichero, sello: sello(bytes) };
}

export type Escritura =
  | { ok: true; sello: string }
  | { ok: false; conflicto: boolean; mensaje: string };

/**
 * Escribe la obra en su forma canónica si el fichero sigue con `selloLeido`
 * (null = el fichero no debe existir: es nuevo). Deja la versión anterior en
 * `.mediciones/<fichero>.bak`.
 */
export function escribirObra(
  fichero: string,
  data: ObraData,
  selloLeido: string | null,
): Escritura {
  const actual = selloEnDisco(fichero);
  if (actual !== selloLeido) {
    return {
      ok: false,
      conflicto: true,
      mensaje:
        selloLeido === null
          ? `ya existe ${fichero}: no se pisa`
          : `${basename(fichero)} cambió en el disco desde que se leyó`,
    };
  }
  const carpeta = dirname(fichero);
  const texto = textoObra(data);
  const tmp = join(carpeta, `.${basename(fichero)}.${process.pid}.${Date.now()}.tmp`);
  try {
    if (actual !== null) {
      const derivados = join(carpeta, CARPETA_DERIVADOS);
      mkdirSync(derivados, { recursive: true });
      copyFileSync(fichero, join(derivados, `${basename(fichero)}.bak`));
    }
    writeFileSync(tmp, texto, 'utf8');
    renameSync(tmp, fichero);
  } catch (e) {
    if (existsSync(tmp)) unlinkSync(tmp);
    return {
      ok: false,
      conflicto: false,
      mensaje: `no se pudo escribir ${fichero}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return { ok: true, sello: sello(texto) };
}
