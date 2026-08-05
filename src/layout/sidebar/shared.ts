/* Bits compartidos por los subcomponentes del Sidebar (F-05): formateo `{k}` y
   el contrato de drop de partidas de Referencia (F5.2). Extraído de Sidebar.tsx
   sin cambiar comportamiento. */
import { fmtNum, toEur, type Cents } from '../../core/money';

/** Importe en céntimos → "12,3k" (millares de euro, 1 decimal). */
export function k(cents: Cents): string {
  return `${fmtNum(toEur(cents) / 1000, 1)}k`;
}

/**
 * Ámbito de reordenación de los CAPÍTULOS (su «padre» es la obra, que no es un
 * nodo del árbol). Los subcapítulos usan el id de su contenedor padre: sólo se
 * reordena entre hermanos — colgar de otro padre es «Mover a».
 */
export const ROOT_SCOPE = '__obra__';

/** Vecinos de un contenedor entre sus HERMANOS (para arrastre y Subir/Bajar). */
export interface SiblingNav {
  prev: string | null;
  next: string | null;
}

/** Reordenación por arrastre de una fila del árbol. */
export interface ReorderHandlers {
  /** Ámbito de la fila: `ROOT_SCOPE` (capítulo) o el id del padre (sub). */
  scope: string;
  /** Vecinos entre hermanos; `next` es el destino de «soltar debajo». */
  nav: SiblingNav;
  /** Coloca `nodeId` antes de `beforeId` (nulo = al final de los hermanos). */
  onReorder: (nodeId: string, beforeId: string | null) => void;
}

/** Genera los props de drop para una fila destino; `undefined` si no se arrastra. */
export interface DropHandlers {
  bind: (id: string, chId: string, subId: string | null) => {
    isOver: boolean;
    events: {
      onDragOver: (e: React.DragEvent) => void;
      onDragLeave: () => void;
      onDrop: (e: React.DragEvent) => void;
    };
  };
}
