/* ===========================================================================
   useCowGuard — puerta de copy-on-write (estilo Arquímedes/CYPE) para la edición
   del descompuesto. CENTRALIZA la regla para que `PriceJustif` (tabla) y
   `PriceJustifCards` (tarjetas) no la dupliquen: ambas vistas solo difieren en
   maquetación y delegan toda la edición aquí.

   Clasifica el cambio por A QUIÉN AFECTA, no por el campo:

     · MUTA el banco compartido (desc/ud/precio/tipo de un recurso usado por ≥2
       partidas) → protección de RECURSO: copiar (forkar privado) vs editar en
       todas.
     · LOCAL a la partida (rendimiento, re-apuntar código, alta/baja de línea) →
       nunca pisa a nadie; solo dispara la protección de PARTIDA BASE.

   Partida tuya (no `fromBase`) + recurso privado → edición directa, sin cuadro.
   El cuadro (`CowDialog`) sale una sola vez por decisión; la casilla "no volver a
   preguntar en esta partida" recuerda la elección en `cowChoice` del store.
   =========================================================================== */
import { useState } from 'react';
import type { Partida, ResourceType } from '../../core/types';
import { selectRecursoUsage, useObraStore, type CowChoice } from '../../store';
import { CowDialog } from './CowDialog';

type Pending = {
  isBase: boolean;
  shared: boolean;
  run: (choice: CowChoice) => void;
};

export interface CowGuard {
  /** Edita un campo del recurso del banco (puede afectar a otras → gate completo). */
  recurso: (itemIndex: number, field: 'desc' | 'ud' | 'precio', value: string | number) => void;
  /** Edita el tipo (MO/MQ/MAT) → escribe en el banco (gate completo). */
  type: (itemIndex: number, value: ResourceType) => void;
  /** Edita el rendimiento (cantidad propia de la línea) → local. */
  cantidad: (itemIndex: number, value: number) => void;
  /** Re-apunta el código de la línea → local (no muta el concepto anterior). */
  code: (itemIndex: number, value: string) => void;
  /** Añade una línea de descompuesto → local (estructural). */
  addItem: () => void;
  /** Elimina una línea de descompuesto → local (estructural). */
  deleteItem: (itemIndex: number) => void;
}

export function useCowGuard(chapterId: string, p: Partida): { guard: CowGuard; dialogEl: React.ReactNode } {
  const usage = useObraStore(selectRecursoUsage);
  const remembered = useObraStore((s) => s.cowChoice[p.id]);
  const editRecurso = useObraStore((s) => s.editRecurso);
  const editItemType = useObraStore((s) => s.editItemType);
  const editItemCode = useObraStore((s) => s.editItemCode);
  const editItemCantidad = useObraStore((s) => s.editItemCantidad);
  const addItem = useObraStore((s) => s.addItem);
  const deleteItem = useObraStore((s) => s.deleteItem);
  const forkResource = useObraStore((s) => s.forkResource);
  const setCowChoice = useObraStore((s) => s.setCowChoice);

  const [pending, setPending] = useState<Pending | null>(null);

  /** Edición que MUTA el banco: aplica sobre el código resuelto (compartido o forkado). */
  function bankEdit(itemIndex: number, applyToCode: (code: string) => void) {
    const it = p.items[itemIndex];
    if (!it) return;
    const isBase = !!p.fromBase;
    const shared = it.type !== '%CI' && (usage[it.code] ?? 0) >= 2;
    if (!isBase && !shared) {
      applyToCode(it.code); // partida tuya + recurso privado → directo
      return;
    }
    const run = (choice: CowChoice) => {
      if (choice === 'copy' && shared) {
        applyToCode(forkResource(chapterId, p.id, itemIndex)); // copia privada
      } else {
        applyToCode(it.code); // "editar en todas", o "copiar" de partida base sin compartir
      }
    };
    if (remembered) {
      run(remembered);
      return;
    }
    setPending({ isBase, shared, run });
  }

  /** Edición LOCAL (no muta el banco): solo la protección de partida base aplica. */
  function localEdit(apply: () => void) {
    if (!p.fromBase) {
      apply();
      return;
    }
    if (remembered) {
      apply();
      return;
    }
    setPending({ isBase: true, shared: false, run: () => apply() });
  }

  const guard: CowGuard = {
    recurso: (i, field, value) => bankEdit(i, (code) => editRecurso(code, field, value)),
    // `editItemType` lee la línea por índice (y su code, ya re-apuntado tras forkar).
    type: (i, value) => bankEdit(i, () => editItemType(chapterId, p.id, i, value)),
    cantidad: (i, value) => localEdit(() => editItemCantidad(chapterId, p.id, i, value)),
    code: (i, value) => localEdit(() => editItemCode(chapterId, p.id, i, value)),
    addItem: () => localEdit(() => addItem(chapterId, p.id)),
    deleteItem: (i) => localEdit(() => deleteItem(chapterId, p.id, i)),
  };

  const dialogEl = pending ? (
    <CowDialog
      isBase={pending.isBase}
      shared={pending.shared}
      onChoose={(choice, remember) => {
        if (remember) setCowChoice(p.id, choice);
        pending.run(choice);
        setPending(null);
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { guard, dialogEl };
}
