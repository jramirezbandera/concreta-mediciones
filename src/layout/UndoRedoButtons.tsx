import { Icon } from '../components/Icon';
import { redo, undo, useHistoryStore } from '../store/temporal';

/**
 * Botones Deshacer/Rehacer del TopBar (T6 del plan de undo/redo). Autocontenidos:
 * se suscriben ellos mismos al historial —el TopBar sigue siendo presentacional—
 * y a PRIMITIVOS (`s.canUndo`, no el objeto entero): con la guarda de flanco de
 * `notify()`, solo re-renderizan cuando un botón cambia de habilitado a
 * deshabilitado, nunca por pulsación (auditoría 2026-07-05).
 */
export function UndoRedoButtons() {
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  return (
    <>
      <button
        type="button"
        className="tcol icon-btn"
        title="Deshacer (Ctrl+Z)"
        aria-label="Deshacer"
        disabled={!canUndo}
        onClick={undo}
      >
        <Icon name="undo" size={16} />
      </button>
      <button
        type="button"
        className="tcol icon-btn"
        title="Rehacer (Ctrl+Y)"
        aria-label="Rehacer"
        disabled={!canRedo}
        onClick={redo}
      >
        <Icon name="redo" size={16} />
      </button>
    </>
  );
}
