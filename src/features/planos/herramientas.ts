/* ===========================================================================
   features/planos/herramientas — qué herramienta se puede usar ahora y por qué
   no (§5.2, §5.4, §5.9, §7.2). Suma a los motivos de medir (`planoMedida`) los
   del contexto del visor: sin partida abierta, pestaña de solo lectura,
   pantalla estrecha o página aún sin pintar.
   =========================================================================== */
import { leerCelda } from '../../core/expresion';
import { parseEsNumber, toDecimalComma } from '../../core/money';
import type { Armada } from '../../core/planoCiclo';
import { motivoHerramienta, type MotivoMedida, type ValorFijo } from '../../core/planoMedida';
import type { Escala, Herramienta, MedDim, Partida } from '../../core/types';
import { textoMotivoMedida } from '../../store/motivos';

export type MotivoVisor =
  | MotivoMedida
  | { motivo: 'sin-partida' }
  | { motivo: 'solo-lectura'; texto: string }
  | { motivo: 'estrecha' }
  | { motivo: 'pintando' };

export function textoMotivoVisor(m: MotivoVisor): string {
  switch (m.motivo) {
    case 'sin-partida':
      return 'Abre una partida para medir.';
    case 'solo-lectura':
      return m.texto;
    case 'estrecha':
      return 'Para medir, usa una pantalla más ancha.';
    case 'pintando':
      return 'Espera a que se pinte la página.';
    default:
      return textoMotivoMedida(m);
  }
}

export const HERRAMIENTAS_MEDIR: readonly Herramienta[] = ['longitud', 'superficie', 'rectangulo', 'recuento'];

export const TECLA: Record<Armada | 'calibrar' | 'restar' | 'ajustar', string> = {
  mano: 'M',
  calibrar: 'C',
  longitud: 'L',
  superficie: 'S',
  rectangulo: 'R',
  recuento: 'N',
  restar: 'D',
  ajustar: 'F',
};

/** Texto tecleado en un campo de dimensión fija → valor (número, operación o perfil). */
export function leerFija(texto: string | undefined): ValorFijo | undefined {
  const t = (texto ?? '').trim();
  if (!t) return undefined;
  const r = leerCelda(toDecimalComma(t));
  return r && Number.isFinite(r.value) ? r : undefined;
}

/** La h de «(tramos)×h». */
export function leerFactor(texto: string | undefined): number | undefined {
  const t = (texto ?? '').trim();
  if (!t) return undefined;
  const v = parseEsNumber(toDecimalComma(t)) ?? leerCelda(toDecimalComma(t))?.value;
  return v !== null && v !== undefined && Number.isFinite(v) ? v : undefined;
}

export interface ContextoVisor {
  partida: Pick<Partida, 'medForma' | 'ud' | 'med'> | null;
  escala: Escala | null;
  fijas: Partial<Record<MedDim, ValorFijo>>;
  factor?: number;
  supDirecta: boolean | null;
  soloLectura: string | null;
  estrecha: boolean;
  pintada: boolean;
}

/** Por qué no se puede medir con `h` aquí, o `null`. */
export function motivoVisor(h: Herramienta, c: ContextoVisor): MotivoVisor | null {
  if (c.soloLectura) return { motivo: 'solo-lectura', texto: c.soloLectura };
  if (c.estrecha) return { motivo: 'estrecha' };
  if (!c.partida) return { motivo: 'sin-partida' };
  const m = motivoHerramienta(h, {
    partida: c.partida,
    escala: c.escala,
    fijas: c.fijas,
    factor: c.factor,
    aceptaSupDirecta: c.supDirecta,
  });
  if (m) return m;
  if (!c.pintada) return { motivo: 'pintando' };
  return null;
}
