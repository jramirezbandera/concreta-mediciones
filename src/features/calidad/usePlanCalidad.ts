import { useMemo } from 'react';
import { calcularPlanCalidad } from '../../core/pcc/calculo';
import type { PlanCalidad } from '../../core/pcc/tipos';
import { useObraStore } from '../../store';
import { hoyIso } from '../residuos/formato';

/** El plan calculado de la obra abierta (`null` si no tiene plan). */
export function usePlanCalidad(): PlanCalidad | null {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const recursos = useObraStore((s) => s.recursos);
  const rates = useObraStore((s) => s.rates);
  const obra = useObraStore((s) => s.obra);
  const plan = useObraStore((s) => s.planCalidad);
  return useMemo(
    () => (plan ? calcularPlanCalidad({ chapters, partidas, banco: recursos, rates, obra, plan, hoy: hoyIso() }) : null),
    [chapters, partidas, recursos, rates, obra, plan],
  );
}
