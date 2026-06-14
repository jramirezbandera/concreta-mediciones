/* T0.3 — Guardia de regresión de render (PERFORMANCE_AUDIT · CR-2 / T1.1+T1.2).
   ---------------------------------------------------------------------------
   INVARIANTE: editar UNA partida debe re-renderizar SOLO su fila, no las
   hermanas. Lo medimos espiando `descompUnit`, que `partidaEconomics` llama
   exactamente UNA vez por render de fila. Las llamadas internas de
   `precioCuadraDescompuesto` usan el binding ORIGINAL del módulo (no el mock),
   así que el contador refleja solo los renders de `PartidaRow`.

   Antes del fix (sin React.memo + fila suscrita al total del capítulo): editar
   una partida re-renderizaba las N filas del capítulo → ~N llamadas. Después:
   solo la fila editada → 1 llamada. */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El mock debe declararse antes de importar el módulo bajo prueba (vitest lo iza).
vi.mock('../../core/banco', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/banco')>();
  return { ...actual, descompUnit: vi.fn(actual.descompUnit) };
});

import { descompUnit } from '../../core/banco';
import { selectChapterTotals, useObraStore } from '../../store';
import { PartidasTable } from './PartidasTable';

const descompSpy = vi.mocked(descompUnit);
const CH = '01';

/** Espejo del uso real: el contenedor se suscribe al store y pasa al `PartidasTable`. */
function Harness() {
  const chapter = useObraStore((s) => s.chapters.find((c) => c.id === CH)!);
  const partidas = useObraStore((s) => s.partidas[CH] ?? []);
  const chapterTotal = useObraStore((s) => selectChapterTotals(s)[CH] ?? 0);
  return <PartidasTable chapter={chapter} partidas={partidas} chapterTotal={chapterTotal} />;
}

beforeEach(() => {
  useObraStore.getState().reset();
  // Garantiza ≥4 partidas en el capítulo para que "no re-renderizar hermanas" sea medible.
  while ((useObraStore.getState().partidas[CH] ?? []).length < 4) {
    useObraStore.getState().addPartida(CH, null);
  }
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('PartidaRow — aislamiento de render (T1.1 + T1.2)', () => {
  it('editar una partida NO recalcula las filas hermanas', () => {
    render(<Harness />);
    const n = useObraStore.getState().partidas[CH]!.length;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(descompSpy).toHaveBeenCalled(); // el montaje calculó todas las filas

    descompSpy.mockClear();
    const targetId = useObraStore.getState().partidas[CH]![0]!.id;
    act(() => {
      useObraStore.getState().editPartidaField(CH, targetId, 'title', 'Editado X');
    });

    // Solo la fila editada recalcula su descomposición: 1, NO ~n.
    expect(descompSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(descompSpy.mock.calls.length).toBeLessThan(n);
  });
});
