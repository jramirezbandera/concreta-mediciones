/* ===========================================================================
   core/huella — lo que tenía la partida cuando se confirmó su residuo o su
   control de calidad. Si cambia el código, el título, la descripción o la
   unidad, la asignación vuelve a «revisar» y no cuenta hasta confirmarla otra
   vez: nunca se calcula con un dato que ya no está en la partida
   (docs/plan-control-calidad.md, O6; en residuos, TD1).
   =========================================================================== */
import type { Partida } from './types';

export interface Huella {
  code: string;
  title: string;
  desc: string;
  ud: string;
}

type ConHuella = Pick<Partida, 'code' | 'title' | 'desc' | 'ud'>;

export function huellaDe(p: ConHuella): Huella {
  return { code: p.code, title: p.title, desc: p.desc ?? '', ud: p.ud };
}

/** ¿La partida ya no es la que se confirmó? Sin huella (asignaciones antiguas) no hay con qué comparar. */
export function huellaCambia(h: Huella | undefined, p: ConHuella): boolean {
  if (!h) return false;
  const a = huellaDe(p);
  return a.code !== h.code || a.title !== h.title || a.desc !== h.desc || a.ud !== h.ud;
}
