import 'fake-indexeddb/auto';
import { clear, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedObraData, toSerializable, type ObraData } from '../store';
import {
  OBRA_KEY,
  clearObra,
  isObraData,
  loadObraEnvelope,
  loadRaw,
  obraKey,
  obraKeys,
  saveObra,
} from './persist';

const sample = (): ObraData => toSerializable(seedObraData());
const K = obraKey('test-1');

beforeEach(async () => {
  await clear();
});

describe('isObraData (validación estructural)', () => {
  it('acepta un ObraData sano', () => {
    expect(isObraData(sample())).toBe(true);
  });
  it('rechaza formas malformadas (mismo nivel pero rotas)', () => {
    expect(isObraData(null)).toBe(false);
    expect(isObraData({})).toBe(false);
    expect(isObraData({ ...sample(), chapters: 'nope' })).toBe(false);
    expect(isObraData({ ...sample(), partidas: { '01': 'no-array' } })).toBe(false);
    expect(isObraData({ ...sample(), rates: { iva: NaN, gg: 0, bi: 0, coefK: 1 } })).toBe(false);
    expect(isObraData({ ...sample(), obra: {} })).toBe(false);
  });
});

describe('saveObra / loadObraEnvelope (round-trip por clave)', () => {
  it('guarda un sobre con metadatos y lo recupera idéntico', async () => {
    const data = sample();
    await saveObra(K, data);
    const res = await loadObraEnvelope(K);
    expect(res.kind).toBe('ok');
    if (res.kind !== 'ok') return;
    expect(res.envelope.schemaVersion).toBe(data.schemaVersion);
    expect(res.envelope.appVersion).toBeTruthy();
    expect(res.envelope.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.envelope.data).toEqual(data);
  });

  it('clave vacía → kind "empty"', async () => {
    expect((await loadObraEnvelope(K)).kind).toBe('empty');
  });

  it('blob no-ObraData → kind "corrupt" (no se interpreta como obra)', async () => {
    await set(K, { schemaVersion: 1, data: { roto: true } });
    const res = await loadObraEnvelope(K);
    expect(res.kind).toBe('corrupt');
    if (res.kind === 'corrupt') expect(res.raw).toBeTruthy();
  });

  it('clearObra borra SOLO esa clave', async () => {
    await saveObra(K, sample());
    await clearObra(K);
    expect(await loadRaw(K)).toBeUndefined();
  });

  it('escrituras coalescidas de la MISMA obra: solo la última gana', async () => {
    const a = sample();
    const b = { ...sample(), obra: { ...sample().obra, denominacion: 'Última' } };
    void saveObra(K, a);
    await saveObra(K, b); // espera a la cola
    const res = await loadObraEnvelope(K);
    expect(res.kind === 'ok' && res.envelope.data.obra.denominacion).toBe('Última');
  });

  it('escrituras a obras DISTINTAS no se pisan (coalescing por clave)', async () => {
    const A = obraKey('A');
    const B = obraKey('B');
    const a = { ...sample(), obra: { ...sample().obra, denominacion: 'Obra A' } };
    const b = { ...sample(), obra: { ...sample().obra, denominacion: 'Obra B' } };
    void saveObra(A, a);
    await saveObra(B, b); // un solo carril drena ambas
    const ra = await loadObraEnvelope(A);
    const rb = await loadObraEnvelope(B);
    expect(ra.kind === 'ok' && ra.envelope.data.obra.denominacion).toBe('Obra A');
    expect(rb.kind === 'ok' && rb.envelope.data.obra.denominacion).toBe('Obra B');
  });

  it('obraKeys lista claves de obra por id y excluye la legacy', async () => {
    await saveObra(obraKey('x'), sample());
    await set(OBRA_KEY, { algo: true });
    const ks = await obraKeys();
    expect(ks).toContain(obraKey('x'));
    expect(ks).not.toContain(OBRA_KEY);
  });
});
