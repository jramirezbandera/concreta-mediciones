/* ===========================================================================
   features/ofertas/importarOferta — de un fichero de la constructora a una
   `Oferta` casada con el presupuesto abierto (docs/plan-ofertas.md, O2/O3).
   =========================================================================== */
import { bc3CodigosPartidas } from '../../core/bc3export';
import { rawUuid } from '../../core/id';
import {
  casarOferta,
  empresaDeFichero,
  filasDeExcel,
  filasDeObra,
  partidasCasables,
  type Casamiento,
  type Oferta,
  type OfertaFila,
} from '../../core/ofertas';
import { leerPrimeraHoja } from '../../core/xlsxLeer';
import type { ObraState } from '../../store';
import { parseBc3 } from '../importar/parseBc3';

type Obra = Pick<ObraState, 'chapters' | 'partidas' | 'recursos' | 'rates' | 'obra'>;

export interface OfertaImportada {
  oferta: Oferta;
  casamiento: Casamiento;
}

/**
 * Casa unas filas con la obra y arma la oferta (puro salvo el id y la fecha).
 * El .bc3 trae los códigos con que viajaron las partidas (homónimos `.2`); el
 * Excel, los suyos propios.
 */
export function ofertaDesdeFilas(filas: OfertaFila[], fichero: string, s: Obra, origen: 'bc3' | 'xlsx' = 'bc3'): OfertaImportada {
  const codigos = origen === 'bc3' ? bc3CodigosPartidas(s) : new Map<string, string>();
  const casamiento = casarOferta(filas, partidasCasables(s.chapters, s.partidas, codigos));
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

function origenDe(nombre: string): 'bc3' | 'xlsx' | null {
  if (/\.bc3$/i.test(nombre)) return 'bc3';
  if (/\.xlsx$/i.test(nombre)) return 'xlsx';
  return null;
}

/** Lee el fichero (.bc3 o .xlsx) y lo casa con la obra. Lanza si no se puede leer. */
export async function ofertaDesdeFichero(file: File, s: Obra): Promise<OfertaImportada> {
  const origen = origenDe(file.name);
  if (!origen) throw new Error('la oferta tiene que venir en .bc3 o en el Excel (.xlsx) de las mediciones.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const filas = origen === 'bc3' ? filasDeObra((await parseBc3(bytes)).data) : filasDeExcel(leerPrimeraHoja(bytes));
  return ofertaDesdeFilas(filas, file.name, s, origen);
}
