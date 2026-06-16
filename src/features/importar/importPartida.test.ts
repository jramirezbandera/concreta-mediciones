import { beforeEach, describe, expect, it } from 'vitest';
import { rec010File } from '../../core/__fixtures__/rec010Bc3';
import { useObraStore, useToastStore } from '../../store';
import { importPartidaFromFile, isBc3File, processBudgetDrop } from './importPartida';

const obra = () => useObraStore.getState();
const lastToast = () => useToastStore.getState().msg;

const sampleFile = rec010File;

beforeEach(() => {
  obra().reset();
  useToastStore.setState({ msg: '', action: null, tick: 0 });
});

describe('isBc3File', () => {
  it('reconoce .bc3 (mayúsculas incluidas) y rechaza el resto', () => {
    expect(isBc3File(new File([], 'x.bc3'))).toBe(true);
    expect(isBc3File(new File([], 'X.BC3'))).toBe(true);
    expect(isBc3File(new File([], 'x.pdf'))).toBe(false);
    expect(isBc3File(undefined)).toBe(false);
  });
});

describe('processBudgetDrop', () => {
  it('un drop de ENLACE (sin fichero) avisa de que no funciona en web', () => {
    processBudgetDrop(undefined, ['text/uri-list', 'text/plain']);
    expect(lastToast()).toMatch(/enlace/i);
  });

  it('un fichero que no es .bc3 avisa', () => {
    processBudgetDrop(new File([], 'foto.png'), ['Files']);
    expect(lastToast()).toMatch(/\.bc3/i);
  });
});

describe('importPartidaFromFile (ruta inline en jsdom)', () => {
  it('inserta la partida REC010 en el capítulo activo (sin refDrag)', async () => {
    const before = obra().partidas['01']!.length;
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    // Sin colisión con el banco demo → inserción directa; si hubiera, se resolvería aparte.
    if (obra().pendingCopy) {
      const res: Record<string, 'merge'> = {};
      for (const c of obra().pendingCopy!.collisions) res[c.code] = 'merge';
      obra().resolveCopyRefPartidas(res);
    }
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010');
    expect(obra().partidas['01']!.length).toBeGreaterThan(before);
    expect(p).toBeDefined();
    expect(p!.precio).toBeCloseTo(902.5, 1);
    expect(p!.ciPct).toBe(3);
    expect(lastToast()).toMatch(/REC010|colisiones/);
  });

  it('sin colisión, salta a la partida recién importada (reveal + pulso)', async () => {
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    if (obra().pendingCopy) return; // con colisión la inserción la confirma el modal
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010')!;
    expect(obra().openPartidaId).toBe(p.id);
    expect(obra().revealNonce).toBeGreaterThan(0);
    expect(obra().view).toBe('presupuesto');
  });

  it('en Presupuesto entra como partida normal (BASE, no contradictorio)', async () => {
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    if (obra().pendingCopy) {
      const res: Record<string, 'merge'> = {};
      for (const c of obra().pendingCopy!.collisions) res[c.code] = 'merge';
      obra().resolveCopyRefPartidas(res);
    }
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010')!;
    expect(p.fromBase).toBe(true);
    expect(p.contradictorio).toBeUndefined();
  });

  it('en Certificaciones entra como precio contradictorio (P.C., sin chip BASE)', async () => {
    obra().setView('certificaciones'); // la vista manda: el .bc3 importa como contradictorio
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    if (obra().pendingCopy) {
      const res: Record<string, 'merge'> = {};
      for (const c of obra().pendingCopy!.collisions) res[c.code] = 'merge';
      obra().resolveCopyRefPartidas(res);
    }
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010')!;
    expect(p.contradictorio).toBe(true);
    expect(p.fromBase).toBeFalsy();
  });
});
