/* ===========================================================================
   store/slices/ofertasSlice — ofertas de las constructoras (v10).
   Plan: docs/plan-ofertas.md (O2).

   · Cada acción es UN paso de Deshacer (`structural`): `ofertas` es clave de
     dominio. Ninguna toca el presupuesto.
   · La oferta llega ya casada (`core/ofertas.casarOferta`): el store solo la
     guarda, la renombra o la quita.
   =========================================================================== */
import type { Oferta } from '../../core/ofertas';
import type { ObraSlice, ObraState } from '../obraStore';
import { structural } from './estructuraSlice';

type OfertasActions = Pick<ObraState, 'addOferta' | 'renombrarOferta' | 'quitarOferta'>;

export const createOfertasSlice: ObraSlice<OfertasActions> = (set) => ({
  addOferta: (oferta: Oferta) =>
    structural(() =>
      set((s) => {
        s.ofertas = [...(s.ofertas ?? []), oferta];
      }),
    ),

  renombrarOferta: (id: string, empresa: string) =>
    structural(() =>
      set((s) => {
        const o = s.ofertas?.find((x) => x.id === id);
        if (o) o.empresa = empresa;
      }),
    ),

  quitarOferta: (id: string) =>
    structural(() =>
      set((s) => {
        const quedan = (s.ofertas ?? []).filter((x) => x.id !== id);
        s.ofertas = quedan.length ? quedan : undefined;
      }),
    ),
});
