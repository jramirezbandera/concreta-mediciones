/* Acciones del marcador de origen (líneas medidas en un plano, §5.6). */
import type { MedLine, OrigenPlano, Partida } from '../../core/types';
import { useObraStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { planosActivos } from '../planos/flag';

/** ¿Pinta la partida la columna del marcador? Solo con el visor encendido y
 *  alguna línea con `origen`: con el visor apagado, la tabla no cambia. */
export function conMarcador(p: Pick<Partida, 'med'>): boolean {
  return planosActivos() && p.med.some((l) => l.origen !== undefined);
}

/** Abre el visor en la página de la forma, la encuadra y la destaca 1,5 s. */
export function verEnPlano(l: MedLine & { origen: OrigenPlano }): void {
  const o = l.origen;
  usePlanoUiStore.getState().pedirDestacar({ planoId: o.planoId, pagina: o.pagina, formaId: o.formaId, lineId: l.id });
  useObraStore.getState().setPlanosOpen(true);
}

/** «Volver a medir»: abre el visor con la misma herramienta y el mismo signo armados. */
export function volverAMedir(l: MedLine & { origen: OrigenPlano }): void {
  const ui = usePlanoUiStore.getState();
  ui.abrirPlano(l.origen.planoId, l.origen.pagina);
  ui.pedirRemedir(l.id);
  useObraStore.getState().setPlanosOpen(true);
}
