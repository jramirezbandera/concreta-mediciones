/* ===========================================================================
   core/rcd/datos — forma de lo que se guarda del estudio de residuos (v7):
   el estudio vacío y la comprobación al cargar.

   Como con los planos (`core/planoDatos.apartarIlegibles`), un `rcd` o un
   `estudioRcd` mal formado NUNCA manda la obra a recuperación: se aparta a
   `_ilegible` con su valor crudo y su ruta, y la obra se abre sin él.
   =========================================================================== */
import type { Ilegible, PartidasMap } from '../types';
import type { EstudioRcdDatos, ResiduoPartida } from './tipos';

const ESTADOS = new Set(['propuesta', 'confirmada', 'noGenera', 'gestion']);
const MODOS = new Set(['volumen', 'espesor', 'pesoSuperficie', 'seccion', 'pesoUnidad', 'masa', 'directo']);
const TIPOS = new Set(['demolicion', 'excavacion', 'colocacion', 'embalaje']);

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Lo mínimo para que la vista y el cálculo no rompan. */
export function residuoLegible(x: unknown): x is ResiduoPartida {
  if (!isRecord(x) || typeof x.estado !== 'string' || !ESTADOS.has(x.estado)) return false;
  if (!isRecord(x.origen) || !Array.isArray(x.componentes)) return false;
  if (x.huella !== undefined && !(isRecord(x.huella) && typeof x.huella.code === 'string' && typeof x.huella.title === 'string' && typeof x.huella.ud === 'string'))
    return false;
  return x.componentes.every(
    (c) =>
      isRecord(c) &&
      typeof c.ler === 'string' &&
      typeof c.tipo === 'string' &&
      TIPOS.has(c.tipo) &&
      isRecord(c.conversion) &&
      typeof c.conversion.modo === 'string' &&
      MODOS.has(c.conversion.modo),
  );
}

export function estudioLegible(x: unknown): x is EstudioRcdDatos {
  return (
    isRecord(x) &&
    x.version === 1 &&
    Array.isArray(x.tipos) &&
    isRecord(x.destinos) &&
    isRecord(x.precios) &&
    (x.ratios === null || isRecord(x.ratios))
  );
}

/** Remisión del 5.º cuando no se indica plano propio (lo habitual en obra
 *  pequeña): el de emplazamiento con el contenedor y el acopio marcados. El
 *  documento antepone «el». */
export const PLANO_POR_DEFECTO =
  'plano de emplazamiento, en el que se señalan la ubicación del contenedor y la zona de acopio y separación de los residuos';

/** Estudio recién empezado: nada supuesto (lo que falta sale pendiente). */
export function estudioVacio(over: Partial<EstudioRcdDatos> = {}): EstudioRcdDatos {
  return {
    version: 1,
    fase: 'ejecucion',
    fecha: null,
    tipos: [],
    comunidad: null,
    amianto: null,
    separacion: 'enObra',
    plantaMovil: false,
    destinos: {},
    precios: {},
    capituloGestion: null,
    fianza: null,
    ordenanza: null,
    plano: null,
    redactor: null,
    ratios: null,
    ...over,
  };
}

/** Aparta a `_ilegible` los `rcd` y el `estudioRcd` que no se pueden leer.
 *  Devuelve el mismo objeto si no hay nada que apartar. */
export function apartarRcdIlegibles<T extends { partidas: PartidasMap; estudioRcd?: unknown; _ilegible?: Ilegible[] }>(d: T): T {
  const fuera: Ilegible[] = [];
  let partidas = d.partidas;
  for (const [chId, ps] of Object.entries(d.partidas)) {
    for (const p of ps ?? []) {
      if (p.rcd !== undefined && !residuoLegible(p.rcd)) fuera.push({ donde: `partidas/${chId}/${p.id}/rcd`, valor: p.rcd });
    }
  }
  if (fuera.length) {
    const malas = new Set(fuera.map((f) => f.donde));
    partidas = Object.fromEntries(
      Object.entries(d.partidas).map(([chId, ps]) => [
        chId,
        (ps ?? []).map((p) => {
          if (!malas.has(`partidas/${chId}/${p.id}/rcd`)) return p;
          const q = { ...p };
          delete q.rcd;
          return q;
        }),
      ]),
    );
  }
  let estudioRcd = d.estudioRcd;
  if (estudioRcd !== undefined && !estudioLegible(estudioRcd)) {
    fuera.push({ donde: 'estudioRcd', valor: estudioRcd });
    estudioRcd = undefined;
  }
  if (!fuera.length) return d;
  console.warn(`Concreta: ${fuera.length} datos del estudio de residuos no se pueden leer; se apartan.`, fuera);
  return { ...d, partidas, estudioRcd, _ilegible: [...(d._ilegible ?? []), ...fuera] };
}
