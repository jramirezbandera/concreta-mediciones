import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Partida } from '../../core/types';
import { __resetAiSettingsForTests, useAiSettings } from '../../ai/settingsStore';
import { AiError } from '../../ai/types';
import { blankObraData, useObraStore } from '../../store';
import { __resetHistoryForTests, initHistory, undo } from '../../store/temporal';
import { sugerirResiduosIa } from './sugerirIa';

const runJsonTurn = vi.fn();
vi.mock('../../ai/chat', () => ({ runJsonTurn: (...a: unknown[]) => runJsonTurn(...a) }));

const state = () => useObraStore.getState();
const partida = (id: string, title: string): Partida => ({ id, pos: id, code: id, title, ud: 'm²', precio: 1, desc: '', med: [], items: [] });

beforeEach(() => {
  __resetHistoryForTests();
  __resetAiSettingsForTests();
  useAiSettings.getState().setKey('gemini', 'clave-de-prueba');
  const d = blankObraData('Reforma');
  d.chapters = [{ id: 'a', code: '1', title: 'Demoliciones' }];
  d.partidas = { a: [partida('p1', 'Retirada de falso techo'), partida('p2', 'Pintura plástica'), partida('p3', 'Algo raro')] };
  state().loadObra(d);
  state().iniciarEstudioRcd();
  initHistory(useObraStore);
  runJsonTurn.mockReset();
});
afterEach(() => __resetHistoryForTests());

describe('sugerirResiduosIa', () => {
  it('pregunta por las sin asignar y deja propuestas, en un paso de Deshacer', async () => {
    const sinAsignar = Object.values(state().partidas).flat().filter((p) => !p.rcd).map((p) => p.id);
    runJsonTurn.mockResolvedValue({
      partidas: [
        { id: 'p1', decision: 'plantilla', plantilla: 'yeso', motivo: 'Escayola' },
        { id: 'p2', decision: 'noGenera', plantilla: 'ninguna', motivo: 'Obra nueva' },
        { id: 'p3', decision: 'noSe', plantilla: 'ninguna', motivo: '' },
      ].filter((x) => sinAsignar.includes(x.id)),
    });
    const r = await sugerirResiduosIa();
    expect(runJsonTurn).toHaveBeenCalledTimes(1);
    const [provider, clave, req] = runJsonTurn.mock.calls[0]!;
    expect([provider, clave]).toEqual(['gemini', 'clave-de-prueba']);
    expect(req.turns[0].text).toContain('Pintura plástica');
    expect(r.noSe).toBe(sinAsignar.includes('p3') ? 1 : 0);
    const p = (id: string) => state().partidas.a!.find((x) => x.id === id)!;
    if (sinAsignar.includes('p2')) {
      expect(p('p2').rcd).toMatchObject({ estado: 'propuesta', origen: { tipo: 'ia', motivo: 'Obra nueva' }, componentes: [] });
    }
    expect(p('p3').rcd?.origen.tipo).not.toBe('ia');
    expect(r.propuestas).toBeGreaterThan(0);
    undo();
    expect(Object.values(state().partidas).flat().filter((x) => x.rcd?.origen.tipo === 'ia')).toEqual([]);
  });

  it('un lote que falla no tumba los demás y se avisa', async () => {
    const muchas = Array.from({ length: 100 }, (_, i) => partida(`q${i}`, `Partida ${i}`));
    useObraStore.setState((s) => ({ partidas: { ...s.partidas, a: muchas } }));
    runJsonTurn
      .mockRejectedValueOnce(new AiError('rate-limit', 'x'))
      .mockImplementationOnce(async (_p: unknown, _k: unknown, req: { turns: { text: string }[] }) => ({
        partidas: [...req.turns[0]!.text.matchAll(/"id":"(q\d+)"/g)].map((m) => ({ id: m[1], decision: 'noGenera', plantilla: 'ninguna', motivo: 'x' })),
      }));
    const r = await sugerirResiduosIa();
    expect(runJsonTurn).toHaveBeenCalledTimes(2);
    expect(r.fallos).toBe(1);
    expect(r.error).toMatch(/Límite de peticiones/);
    expect(r.propuestas).toBe(20);
  });

  it('sin clave no llama a nadie', async () => {
    useAiSettings.getState().clearKey('gemini');
    useAiSettings.getState().setProvider('openai');
    await expect(sugerirResiduosIa()).rejects.toThrow(/Falta la clave/);
    expect(runJsonTurn).not.toHaveBeenCalled();
  });
});
