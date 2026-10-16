import { useMemo } from 'react';
import { calcularEstudioRcd, type EstudioRcd } from '../../core/rcd';
import { useObraStore } from '../../store';
import { hoyIso } from './formato';

/** El estudio calculado de la obra abierta (`null` si no tiene estudio). */
export function useEstudioRcd(): EstudioRcd | null {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const rates = useObraStore((s) => s.rates);
  const obra = useObraStore((s) => s.obra);
  const estudio = useObraStore((s) => s.estudioRcd);
  return useMemo(
    () => (estudio ? calcularEstudioRcd({ chapters, partidas, rates, obra, estudio, hoy: hoyIso() }) : null),
    [chapters, partidas, rates, obra, estudio],
  );
}
