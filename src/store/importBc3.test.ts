import { beforeEach, describe, expect, it } from 'vitest';
import { bc3ToRefCopyItems } from '../core/bc3ToPartidas';
import { rec010Bytes } from '../core/__fixtures__/rec010Bc3';
import type { Resolution } from '../core/refdata';
import { useObraStore } from './obraStore';

const state = () => useObraStore.getState();

function sampleItems() {
  return bc3ToRefCopyItems(rec010Bytes()).items;
}

/** Inserta los items adaptados en el capítulo '01', resolviendo colisiones por MERGE. */
function importInto(chId: string): void {
  state().requestCopyRefPartidas(sampleItems(), { chId, subId: null }, false);
  if (state().pendingCopy) {
    const res: Resolution = {};
    for (const c of state().pendingCopy!.collisions) res[c.code] = 'merge';
    state().resolveCopyRefPartidas(res);
  }
}

const imported = () => state().partidas['01']!.find((p) => p.code === 'REC010');

beforeEach(() => {
  state().reset(); // obra demo: banco + capítulo activo '01'
});

describe('importar partida CYPE (.bc3) por el pipeline de copia', () => {
  it('inserta la partida con precio 902,50, ud, badge CI y procedencia CYPE', () => {
    importInto('01');
    const p = imported()!;
    expect(p).toBeDefined();
    expect(p.ud).toBe('Ud');
    expect(p.precio).toBeCloseTo(902.5, 1);
    expect(p.precioManual).toBe(true); // precio de base congelado
    expect(p.ciPct).toBe(3); // CI del ~K, visible como badge
    expect(p.fromBase).toBe(true);
    expect(p.baseSource).toBe('CYPE GP (.bc3)');
    expect(p.med).toEqual([]); // base sin medición: se mide después (como copiar de Referencia)
  });

  it('no mezcla el CI en silencio: la descomposición NO trae línea «Costes indirectos»', () => {
    importInto('01');
    const ci = imported()!.items.filter((i) => i.type === '%CI');
    // Solo el «%» de complementarios (parte de los directos); el CI global del ~K
    // se quitó del descompuesto y vive en ciPct (badge).
    expect(ci.some((i) => i.desc === 'Costes indirectos')).toBe(false);
    expect(ci.length).toBeGreaterThanOrEqual(1);
  });

  it('el precio importado SOBREVIVE al editar un recurso colisionante (precioManual)', () => {
    importInto('01');
    const before = imported()!.precio;
    // mo023 (oficial solador) es un recurso de REC010; cambiar su precio en el banco
    // resincroniza las partidas SIN override. La importada está congelada → no deriva.
    const usa = imported()!.items.find((i) => i.code === 'mo023');
    expect(usa).toBeDefined();
    state().editRecurso('mo023', 'precio', 999);
    expect(imported()!.precio).toBeCloseTo(before, 2);
    expect(imported()!.precio).toBeCloseTo(902.5, 1);
  });

  it('los recursos entrantes se integran en el banco sin pisar homónimos', () => {
    importInto('01');
    // mo023 quedó en el banco (nuevo o fusionado), con su tipo MO.
    expect(state().recursos['mo023']).toBeDefined();
    expect(state().recursos['mo023']!.type).toBe('MO');
  });
});
