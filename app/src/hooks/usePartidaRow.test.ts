import { describe, expect, it } from 'vitest';
import { buildRecursos } from '../core/banco';
import { toCents } from '../core/money';
import { PARTIDAS } from '../core/seed';
import type { Partida } from '../core/types';
import { partidaRowData } from './usePartidaRow';

const banco = buildRecursos(PARTIDAS);
const p111 = (PARTIDAS['01'] ?? []).find((p) => p.id === 'p111') as Partida;

describe('partidaRowData (núcleo del hook de fila, T6)', () => {
  it('cantidad e importe salen del motor (p111: 124,65 → 2.296,05 €)', () => {
    const r = partidaRowData(p111, 0, 1, banco);
    expect(r.cantidad).toBe(124.65);
    expect(r.importe).toBe(toCents(2296.05)); // round2(124,65 · 18,42)
  });

  it('coefK escala el importe (×1,13)', () => {
    const r = partidaRowData(p111, 0, 1.13, banco);
    expect(r.importe).toBe(toCents(2594.54)); // round2(124,65 · (18,42 · 1,13))
  });

  it('pct es el peso del importe sobre el total del capítulo', () => {
    const base = partidaRowData(p111, 0, 1, banco).importe;
    expect(partidaRowData(p111, base * 2, 1, banco).pct).toBeCloseTo(50);
    expect(partidaRowData(p111, 0, 1, banco).pct).toBe(0); // sin total → 0, no NaN
  });

  it('señala override cuando precio ≠ descompuesto (p111: 18,42 ≠ 9,27)', () => {
    const r = partidaRowData(p111, 0, 1, banco);
    expect(r.descompUnit).toBe(9.27);
    expect(r.isOverride).toBe(true);
  });

  it('sin items no hay descomposición que contrastar → sin override', () => {
    const p: Partida = { ...p111, items: [], precio: 50 };
    const r = partidaRowData(p, 0, 1, banco);
    expect(r.descompUnit).toBe(0);
    expect(r.isOverride).toBe(false);
  });
});
