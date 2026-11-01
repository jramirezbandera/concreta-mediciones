/* ===========================================================================
   features/ofertas/importarOferta — de un fichero de la constructora a una
   `Oferta` casada con el presupuesto abierto (docs/plan-ofertas.md, O2/O3).
   =========================================================================== */
import { bc3CodigosPartidas } from '../../core/bc3export';
import { rawUuid } from '../../core/id';
import {
  casarOferta,
  empresaDeFichero,
  filasDeObra,
  partidasCasables,
  type Casamiento,
  type Oferta,
  type OfertaFila,
} from '../../core/ofertas';
import type { ObraState } from '../../store';
import { parseBc3 } from '../importar/parseBc3';

type Obra = Pick<ObraState, 'chapters' | 'partidas' | 'recursos' | 'rates' | 'obra'>;

export interface OfertaImportada {
  oferta: Oferta;
  casamiento: Casamiento;
}

/** Casa unas filas con la obra y arma la oferta (puro salvo el id y la fecha). */
export function ofertaDesdeFilas(filas: OfertaFila[], fichero: string, s: Obra): OfertaImportada {
  const casamiento = casarOferta(filas, partidasCasables(s.chapters, s.partidas, bc3CodigosPartidas(s)));
  return {
    casamiento,
    oferta: {
      id: rawUuid(),
      empresa: empresaDeFichero(fichero),
      fecha: new Date().toISOString(),
      fichero,
      precios: casamiento.precios,
      cantidades: casamiento.cantidades,
      sinCasar: casamiento.sinCasar,
    },
  };
}

export function esFicheroOferta(nombre: string): boolean {
  return /\.bc3$/i.test(nombre);
}

/** Lee el fichero (.bc3) y lo casa con la obra. Lanza si no se puede leer. */
export async function ofertaDesdeFichero(file: File, s: Obra): Promise<OfertaImportada> {
  if (!esFicheroOferta(file.name)) throw new Error('La oferta tiene que venir en .bc3.');
  const { data } = await parseBc3(new Uint8Array(await file.arrayBuffer()));
  return ofertaDesdeFilas(filasDeObra(data), file.name, s);
}
