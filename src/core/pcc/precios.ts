/* ===========================================================================
   core/pcc/precios — «Tomar precios de un banco» (A1, §8 del plan).

   Acción explícita: con una referencia ya cargada (BCCA, más adelante CYPE),
   busca los códigos del enlace curado y devuelve los precios para copiarlos al
   plan, con banco, fecha, texto y lo que cubre cada uno. El cálculo no lee
   bancos: el mismo plan da siempre el mismo total. Nunca casa por importe.
   =========================================================================== */
import type { RefSource } from '../refdata';
import enlaceBcca from './tablas/enlace-bcca.json';
import type { CoberturaPrecio, PrecioCopiado } from './tipos';

interface Enlace {
  ensayo: string;
  partidas: Array<{ codigo: string; resumen: string; ud: string }>;
  unidad: string;
  como: string;
  cubre?: CoberturaPrecio;
}
const ENLACES = enlaceBcca.enlaces as Enlace[];

export interface ResultadoTomarPrecios {
  precios: Record<string, PrecioCopiado>;
  /** Ensayos del enlace cuyo código no está en el banco: siguen con la fuente siguiente. */
  faltan: string[];
}

/** Precios de los ensayos (`ensayos`, o todos los del enlace) que trae la referencia. */
export function tomarPrecios(fuente: RefSource, hoy: string, ensayos?: readonly string[]): ResultadoTomarPrecios {
  const porCodigo = new Map<string, { precio: number; ud: string; desc: string }>();
  for (const ps of Object.values(fuente.partidas))
    for (const p of ps) porCodigo.set(p.code.toUpperCase(), { precio: p.precio, ud: p.ud, desc: p.desc ?? p.title });
  const quiero = ensayos ? new Set(ensayos) : null;
  const precios: Record<string, PrecioCopiado> = {};
  const faltan: string[] = [];
  for (const e of ENLACES) {
    if (quiero && !quiero.has(e.ensayo)) continue;
    if (!e.partidas.length) continue;
    const encontradas = e.partidas.map((x) => porCodigo.get(x.codigo.toUpperCase()));
    if (encontradas.some((x) => !x || !(x.precio > 0))) {
      faltan.push(e.ensayo);
      continue;
    }
    // Un precio compuesto es la suma de sus partidas (la hoja lo da así).
    const precio = Math.round(encontradas.reduce((s, x) => s + x!.precio, 0) * 100) / 100;
    precios[e.ensayo] = {
      ensayo: e.ensayo,
      codigo: e.partidas.map((x) => x.codigo).join(' + '),
      precio,
      ud: e.unidad,
      banco: fuente.name,
      fecha: hoy,
      texto: encontradas.map((x) => x!.desc).join('\n'),
      ...(e.cubre ? { cubre: e.cubre } : {}),
    };
  }
  return { precios, faltan };
}

/** Lo que cubre el precio del banco según el enlace (si lo dice). */
export function cubreDelEnlace(ensayo: string): CoberturaPrecio | undefined {
  return ENLACES.find((e) => e.ensayo === ensayo)?.cubre;
}

/** Códigos del banco que el enlace da al ensayo (varios si el precio es una suma). */
export function codigosDelEnlace(ensayo: string): string[] {
  return ENLACES.find((e) => e.ensayo === ensayo)?.partidas.map((x) => x.codigo) ?? [];
}

export const ENLACE_VERSION: string = enlaceBcca.version;
