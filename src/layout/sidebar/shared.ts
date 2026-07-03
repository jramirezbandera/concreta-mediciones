/* Bits compartidos por los subcomponentes del Sidebar (F-05): formateo `{k}` y
   el contrato de drop de partidas de Referencia (F5.2). Extraído de Sidebar.tsx
   sin cambiar comportamiento. */
import { fmtNum, toEur, type Cents } from '../../core/money';

/** Importe en céntimos → "12,3k" (millares de euro, 1 decimal). */
export function k(cents: Cents): string {
  return `${fmtNum(toEur(cents) / 1000, 1)}k`;
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
