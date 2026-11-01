import { useMemo } from 'react';
import { estudioSs, type EntradaDocumentoEss, type EstudioSs } from '../../core/ess/documento';
import { useObraStore } from '../../store';
import { hoyIso } from '../residuos/formato';

/** Lo que lee el estudio de la obra abierta (`null` si no tiene estudio). */
export function useEntradaEss(): EntradaDocumentoEss | null {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const recursos = useObraStore((s) => s.recursos);
  const rates = useObraStore((s) => s.rates);
  const obra = useObraStore((s) => s.obra);
  const estudioRcd = useObraStore((s) => s.estudioRcd);
  const control = useObraStore((s) => s.planCalidad?.capituloControl);
  const datos = useObraStore((s) => s.seguridadSalud);
  return useMemo(
    () =>
      datos
        ? {
            chapters,
            partidas,
            banco: recursos,
            rates,
            obra,
            estudioRcd,
            datos: datos.fecha ? datos : { ...datos, fecha: hoyIso() },
            excluidos: [control],
          }
        : null,
    [chapters, partidas, recursos, rates, obra, estudioRcd, control, datos],
  );
}

/** El estudio calculado de la obra abierta (`null` si no tiene estudio). */
export function useEstudioSs(e: EntradaDocumentoEss | null): EstudioSs | null {
  return useMemo(() => (e ? estudioSs(e) : null), [e]);
}
