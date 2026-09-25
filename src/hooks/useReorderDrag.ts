/* ===========================================================================
   hooks/useReorderDrag — arrastrar para REORDENAR (partidas y contenedores).
   ---------------------------------------------------------------------------
   Feedback de obra (2026-08): «poder arrastrar para cambiar el orden de las
   partidas de un capítulo… y el de los capítulos». Reusa el HTML5 drag&drop
   nativo, como el arrastre desde el panel Referencia (F5.2), con dos diferencias
   deliberadas:

   · El payload NO vive en el store: el arrastre en curso es un dato EFÍMERO de
     interacción, y meterlo en el store haría que cada `dragover` re-renderizara
     las N filas suscritas. Vive en este módulo (una variable) y cada fila guarda
     en estado LOCAL si el puntero está sobre ella → sólo re-renderiza la fila
     bajo el cursor. (`dataTransfer` no sirve: en `dragover` los datos están
     protegidos y no se pueden leer.)
   · La fila sólo es `draggable` mientras se agarra por su ASA (`handle`). Sin
     esto, arrastrar para seleccionar texto dentro de una celda editable
     empezaría un arrastre de fila.

   El teclado y el táctil NO usan esto: tienen «Subir/Bajar» en los menús ⋮
   (HTML5 DnD no existe en táctil y no es operable por teclado).

   Tres clases de arrastre (`kind`): partidas (dentro de su capítulo),
   contenedores (entre hermanos) y líneas de medición (`'medline'`, dentro de
   su partida: `scope` = id de partida; mueve UNA línea, la agarrada, aunque
   haya selección — los bloques van con Alt+↑/↓ o la barra de selección).
   =========================================================================== */
import { useCallback, useState, type DragEvent } from 'react';

/** Qué se está arrastrando. `scope` acota dónde se puede soltar: el capítulo
 *  dueño (partidas), el contenedor padre (capítulos/subcapítulos) o la partida
 *  (líneas de medición). */
export interface ReorderDrag {
  kind: 'partida' | 'contenedor' | 'medline';
  id: string;
  scope: string;
}

/** Mitad de la fila destino sobre la que se suelta. */
export type DropPlace = 'before' | 'after';

/** Mitad (arriba/abajo) del elemento en la que cae el puntero. */
function placeAt(e: DragEvent): DropPlace {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'before' : 'after';
}

let current: ReorderDrag | null = null;

/** Arrastre de reordenación en curso (`null` = ninguno). */
export function getReorderDrag(): ReorderDrag | null {
  return current;
}

/** Limpia el arrastre en curso (lo llaman `onDragEnd` y el propio drop). */
export function endReorderDrag(): void {
  current = null;
}

/**
 * Origen del arrastre: `source` va en el elemento que se mueve (fila, tarjeta
 * de capítulo…) y `handle` en su asa —que puede ser el elemento entero, cuando
 * no tiene texto que seleccionar—. `dragging` permite atenuarlo mientras viaja.
 */
export function useReorderSource(make: () => ReorderDrag): {
  dragging: boolean;
  source: {
    draggable: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragEnd: () => void;
  };
  handle: { onMouseDown: () => void; onMouseUp: () => void };
} {
  const [armed, setArmed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onDragStart = useCallback(
    (e: DragEvent) => {
      current = make();
      e.dataTransfer.effectAllowed = 'move';
      // Firefox no arranca un arrastre sin datos, aunque no los usemos.
      e.dataTransfer.setData('text/plain', current.id);
      setDragging(true);
    },
    [make],
  );

  const onDragEnd = useCallback(() => {
    endReorderDrag();
    setDragging(false);
    setArmed(false);
  }, []);

  return {
    dragging,
    source: { draggable: armed, onDragStart, onDragEnd },
    handle: { onMouseDown: () => setArmed(true), onMouseUp: () => setArmed(false) },
  };
}

/**
 * Destino del arrastre: marca la mitad (arriba/abajo) sobre la que se suelta.
 * `accepts` decide si ESTE destino admite el arrastre en curso (mismo capítulo,
 * mismos hermanos, no sobre sí mismo); si no lo acepta, no se llama a
 * `preventDefault` → el navegador muestra «no soltar aquí».
 */
export function useReorderTarget(
  accepts: (d: ReorderDrag) => boolean,
  onDropAt: (d: ReorderDrag, place: DropPlace) => void,
): {
  place: DropPlace | null;
  events: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
} {
  const [place, setPlace] = useState<DropPlace | null>(null);

  return {
    place,
    events: {
      onDragOver: (e: DragEvent) => {
        const d = getReorderDrag();
        if (!d || !accepts(d)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const p = placeAt(e);
        setPlace((cur) => (cur === p ? cur : p));
      },
      onDragLeave: () => setPlace(null),
      onDrop: (e: DragEvent) => {
        const d = getReorderDrag();
        setPlace(null);
        if (!d || !accepts(d)) return;
        e.preventDefault();
        e.stopPropagation(); // el destino más INTERNO manda (fila sobre capítulo)
        endReorderDrag();
        // La mitad se RECALCULA aquí, no se lee del estado que pintó la guía:
        // el `place` del render en curso puede ir un tick por detrás del último
        // `dragover` (React agrupa), y soltar debe obedecer a dónde está el
        // puntero AHORA, no a lo último que alcanzó a repintarse.
        onDropAt(d, placeAt(e));
      },
    },
  };
}
