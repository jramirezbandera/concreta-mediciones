/* ===========================================================================
   agente/editar — un lote de operaciones sobre el fichero de una obra (Node).
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md D2, D4 y D8)

     leer (y su sello) → cargar en el store → aplicar el lote → escribir con el sello

   · TODO O NADA: si una op no se aplica, no se escribe nada y se dice cuál y por qué.
   · REPETIR, NO FUSIONAR: si el fichero cambió entre leer y escribir (lo guardó la
     app u otra sesión), se vuelve a leer y se repiten LAS MISMAS operaciones sobre
     lo nuevo. Se puede porque una op es una intención («añade estas líneas a la
     2.3»), no un «sustituye esto». Hasta `INTENTOS` veces.
   · VERSIÓN (D8): no se sube la versión de esquema de un fichero sin
     `subirVersion`, porque la app publicada podría no conocerla todavía.
   · El store es el de la app (`useObraStore`), en este proceso: aquí no hay
     interfaz, así que cargar una obra en él no pisa nada de nadie.
   =========================================================================== */
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { APP_VERSION } from '../persist/persist';
import {
  SCHEMA_VERSION,
  blankObraData,
  toSerializable,
  useObraStore,
  type ObraData,
} from '../store';
import { aplicarLote, type ReciboLote } from './motor';
import { leerOperaciones, type ErrorForma } from './operaciones';
import { escribirDiario, escribirObra, leerObra } from './fichero';
import { compararObras } from './cambios';
import { VERSION_DIARIO, type Autor } from './diario';

/** Veces que se repite un lote si el fichero cambia entre leer y escribir. */
export const INTENTOS = 3;

export interface OpcionesEditar {
  /** El sello con que el agente leyó la obra: si ya no es el del disco, no se aplica nada. */
  sello?: string;
  /** Permite escribir una obra de una versión de esquema anterior en la actual. */
  subirVersion?: boolean;
  /** Quién hace el lote: va al diario (F4). Sin autor, no se deja diario. */
  autor?: Autor;
}

export type ResultadoEditar =
  | {
      ok: true;
      fichero: string;
      recibos: ReciboLote[];
      sello: string;
      selloAnterior: string;
      intentos: number;
      /** Si quedó en el diario: sin él, la app pregunta en vez de repetir. */
      diario: boolean;
    }
  | {
      ok: false;
      fichero: string;
      motivo: 'forma' | 'lectura' | 'sello' | 'version' | 'lote' | 'conflicto' | 'escritura';
      mensaje: string;
      errores?: ErrorForma[];
      recibos?: ReciboLote[];
      sinIntentar?: number;
    };

/** Carga `data` en el store del proceso (sin interfaz: no hay nada que pisar). */
export function cargarEnStore(data: ObraData): void {
  useObraStore.getState().loadObra(data);
}

/** Aviso de D8, o null si se puede escribir. */
export function avisoVersion(versionFichero: number, subirVersion?: boolean): string | null {
  if (versionFichero >= SCHEMA_VERSION || subirVersion) return null;
  return (
    `la obra está escrita con la versión ${versionFichero} del formato y esta herramienta escribe la ${SCHEMA_VERSION}. ` +
    'Si la app publicada aún no conoce esa versión, abriría la obra en solo lectura. ' +
    'Repite con subirVersion: true cuando la app esté actualizada.'
  );
}

/** Aplica un lote de operaciones (sin validar todavía) al fichero de una obra. */
export function editarObra(
  fichero: string,
  opsCrudas: unknown,
  opciones: OpcionesEditar = {},
): ResultadoEditar {
  const lectura = leerOperaciones(opsCrudas);
  if (!lectura.ok) {
    return {
      ok: false,
      fichero,
      motivo: 'forma',
      mensaje: 'hay operaciones mal escritas: no se ha aplicado ninguna',
      errores: lectura.errores,
    };
  }
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const l = leerObra(fichero);
    if (!l.ok) return { ok: false, fichero, motivo: 'lectura', mensaje: l.mensaje };
    if (intento === 1 && opciones.sello && opciones.sello !== l.sello) {
      return {
        ok: false,
        fichero,
        motivo: 'sello',
        mensaje:
          'la obra cambió desde que la leíste (la habrá guardado el técnico desde la app): vuelve a leerla antes de cambiarla',
      };
    }
    const aviso = avisoVersion(l.versionFichero, opciones.subirVersion);
    if (aviso) return { ok: false, fichero, motivo: 'version', mensaje: aviso };

    cargarEnStore(l.data);
    const r = aplicarLote(useObraStore, lectura.ops);
    if (!r.ok) {
      const fallo = r.recibos.at(-1);
      return {
        ok: false,
        fichero,
        motivo: 'lote',
        mensaje: `la operación ${(fallo?.indice ?? 0) + 1} (${fallo?.op}) no se pudo aplicar: ${fallo?.reason ?? fallo?.detail}. No se ha guardado nada.`,
        recibos: r.recibos,
        sinIntentar: r.sinIntentar,
      };
    }
    const nueva = toSerializable(useObraStore.getState());
    const w = escribirObra(fichero, nueva, l.sello);
    if (w.ok) {
      const diario =
        !!opciones.autor &&
        escribirDiario(fichero, {
          version: VERSION_DIARIO,
          fichero: basename(fichero),
          fecha: new Date().toISOString(),
          autor: opciones.autor,
          mcp: APP_VERSION,
          antes: l.huella,
          despues: w.huella,
          resumen: compararObras(l.data, nueva).texto,
          pasos: r.pasos,
        });
      return {
        ok: true,
        fichero,
        recibos: r.recibos,
        sello: w.sello,
        selloAnterior: l.sello,
        intentos: intento,
        diario,
      };
    }
    if (!w.conflicto) return { ok: false, fichero, motivo: 'escritura', mensaje: w.mensaje };
    // Conflicto: otro guardó entre leer y escribir. Se repite el lote sobre lo nuevo.
  }
  return {
    ok: false,
    fichero,
    motivo: 'conflicto',
    mensaje: `la obra cambió ${INTENTOS} veces mientras se aplicaba el lote: no se ha guardado nada; inténtalo de nuevo`,
  };
}

export type ResultadoNueva =
  | { ok: true; fichero: string; sello: string }
  | { ok: false; fichero: string; mensaje: string };

/** Crea el fichero de una obra vacía. Nunca pisa uno que exista. */
export function nuevaObra(fichero: string, denominacion: string): ResultadoNueva {
  if (existsSync(fichero))
    return { ok: false, fichero, mensaje: `ya existe ${fichero}: no se pisa` };
  cargarEnStore(blankObraData(denominacion));
  const w = escribirObra(fichero, toSerializable(useObraStore.getState()), null);
  return w.ok ? { ok: true, fichero, sello: w.sello } : { ok: false, fichero, mensaje: w.mensaje };
}
