/* T-2: emitir certificaciones (esquema v13). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { certSnapshotOf, certTotals, prevDataOf } from '../core/certificacion';
import { firmaFor } from '../core/listado';
import { SCHEMA_VERSION, blankObraData, fromSerializable, type ObraData } from './schema';
import { useObraStore } from './obraStore';
import { useToastStore } from './toastStore';
import { __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();
const liquido = (i: number) => {
  const s = state();
  const c = s.certs[i]!;
  return certTotals(Object.values(s.partidas).flat(), c.data, prevDataOf(s.certs, i), s.rates, c.retencion, s.rates.coefK, c.extras ?? [], s.certs[i - 1]?.extras ?? [], certSnapshotOf(c, s.rates.coefK), c.ajustes ?? [], c.cerradas).liquido;
};

beforeEach(() => {
  __resetHistoryForTests();
  state().reset(); // obra de ejemplo: 3 certs legadas (sin precios congelados)
  initHistory(useObraStore);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => __resetHistoryForTests());

describe('emitirCert', () => {
  it('en orden: no se emite la nº 2 con la nº 1 en borrador', () => {
    expect(state().emitirCert(1)).toBe(false);
    expect(state().emitirCert(0)).toBe(true);
    expect(state().emitirCert(1)).toBe(true);
    expect(state().certs[1]!.emitidaAt).toBeTruthy();
    expect(state().emitirCert(1)).toBe(false); // ya emitida
  });

  it('congela los precios que leía en vivo sin mover ningún importe', () => {
    expect(state().certs[0]!.priceSnapshot).toBeUndefined();
    const antes = liquido(0);
    state().emitirCert(0);
    expect(state().certs[0]!.priceSnapshot).toBeDefined();
    expect(liquido(0)).toBe(antes);
    // Cambiar un precio del presupuesto ya no mueve la emitida.
    const p = Object.values(state().partidas).flat()[0]!;
    useObraStore.setState((s) => ({
      partidas: Object.fromEntries(Object.entries(s.partidas).map(([k, ps]) => [k, ps.map((x) => (x.id === p.id ? { ...x, precio: x.precio * 2 } : x))])),
    }));
    expect(liquido(0)).toBe(antes);
  });

  it('congela la firma y los documentos usan esa, aunque cambie la dirección facultativa', () => {
    state().setObraPath('constructor.nombre', 'Construcciones Pérez');
    state().emitirCert(0);
    state().addAgenteDF();
    const id = (state().obra.direccionFacultativa as { id: string }[])[0]!.id;
    state().editAgenteDF(id, 'nombre', 'Ana Ruiz');
    const firma = firmaFor('cert', state().obra, state().certs[0]);
    expect(firma.firmantes.map((f) => f.nombre)).toEqual(['Construcciones Pérez']);
  });

  it('un paso de Deshacer', () => {
    state().emitirCert(0);
    undo();
    expect(state().certs[0]!.emitidaAt).toBeUndefined();
  });
});

describe('una cert emitida no cambia', () => {
  it('el store rechaza las ediciones y avisa', () => {
    state().setCurCert(0);
    state().emitirCert(0);
    const antes = structuredClone(state().certs[0]!);
    const pid = Object.keys(antes.data)[0]!;
    state().onCertEdit(pid, 999, 'origen');
    state().setCertField('period', 'Otro');
    state().setCertField('retencion', 0.5);
    state().completePartida(pid);
    state().toggleCerrada(pid);
    state().addContradictorio(state().chapters[0]!.id);
    state().addAjuste();
    expect(state().certs[0]).toEqual(antes);
    expect(useToastStore.getState().msg).toMatch(/está emitida: reábrela/);
  });

  it('la cert en borrador sigue editándose', () => {
    state().emitirCert(0);
    state().setCurCert(1);
    state().setCertField('period', 'Julio');
    expect(state().certs[1]!.period).toBe('Julio');
  });
});

describe('reabrirCert', () => {
  it('solo la última emitida, y queda en el historial', () => {
    state().emitirCert(0);
    state().emitirCert(1);
    expect(state().reabrirCert(0)).toBe(false);
    expect(state().reabrirCert(1)).toBe(true);
    const c = state().certs[1]!;
    expect(c.emitidaAt).toBeUndefined();
    expect(c.historial!.map((h) => h.accion)).toEqual(['emitida', 'reabierta']);
    expect(state().reabrirCert(1)).toBe(false); // ya en borrador
  });
});

describe('v12 → v13', () => {
  it('solo sube la versión: las certs de antes son borradores', () => {
    const v12 = { ...blankObraData(), schemaVersion: 12 } as ObraData;
    const d = fromSerializable(structuredClone(v12));
    expect(d).toEqual({ ...v12, schemaVersion: SCHEMA_VERSION });
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(13);
    expect(d.certs[0]!.emitidaAt).toBeUndefined();
  });
});
