/* ===========================================================================
   store/slices/essSlice — acciones del estudio de seguridad y salud (v11).
   Plan: docs/plan-seguridad-salud.md (E4).

   · Cada acción es UN paso de Deshacer (`structural`): `seguridadSalud` es
     clave de dominio.
   · No toca las partidas: las fichas se proponen al vuelo desde ellas y solo
     se guarda lo que el técnico cambia (D2).
   · Solo importa `core/ess/guardado` (ligero): el catálogo, las reglas y el
     documento van con la vista.
   =========================================================================== */
import { capituloSsPropuesto, estudioSsVacio } from '../../core/ess/guardado';
import type { EstudioSsDatos } from '../../core/ess/tipos';
import type { ObraSlice, ObraState } from '../obraStore';
import { structural } from './estructuraSlice';

type EssActions = Pick<ObraState, 'iniciarEstudioSs' | 'setEstudioSs' | 'quitarEstudioSs'>;

export const createEssSlice: ObraSlice<EssActions> = (set) => ({
  iniciarEstudioSs: () =>
    structural(() =>
      set((s) => {
        if (s.seguridadSalud) return;
        // Del estudio de residuos, lo que es de la obra y no cambia de anejo:
        // el redactor (se puede cambiar) y la fecha. El tipo de obra y el
        // amianto se leen de él mientras exista (D4): no se copian.
        const rcd = s.estudioRcd;
        s.seguridadSalud = estudioSsVacio({
          capituloSs: capituloSsPropuesto(s.chapters),
          ...(rcd?.redactor?.nombre.trim() ? { redactor: { ...rcd.redactor } } : {}),
          ...(rcd?.fecha ? { fecha: rcd.fecha } : {}),
        });
      }),
    ),

  setEstudioSs: (patch: Partial<EstudioSsDatos>) =>
    structural(() =>
      set((s) => {
        if (!s.seguridadSalud) return;
        Object.assign(s.seguridadSalud, patch);
      }),
    ),

  quitarEstudioSs: () =>
    structural(() =>
      set((s) => {
        s.seguridadSalud = undefined;
      }),
    ),
});
