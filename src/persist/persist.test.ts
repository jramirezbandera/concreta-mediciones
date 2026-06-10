import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedObraData, toSerializable, type ObraData } from '../store';
import { clearObra, isObraData, loadObraEnvelope, loadRaw, saveObra, OBRA_KEY } from './persist';
import { set } from 'idb-keyval';

const sample = (): ObraData => toSerializable(seedObraData());

beforeEach(async () => {
  await clearObra();
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

describe('saveObra / loadObraEnvelope (round-trip)', () => {
  it('guarda un sobre con metadatos y lo recupera idéntico', async () => {
    const data = sample();
    await saveObra(data);
    const res = await loadObraEnvelope();
    expect(res.kind).toBe('ok');
    if (res.kind !== 'ok') return;
    expect(res.envelope.schemaVersion).toBe(data.schemaVersion);
    expect(res.envelope.appVersion).toBeTruthy();
    expect(res.envelope.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.envelope.data).toEqual(data);
  });

  it('almacén vacío → kind "empty"', async () => {
    expect((await loadObraEnvelope()).kind).toBe('empty');
  });

  it('blob no-ObraData → kind "corrupt" (no se interpreta como obra)', async () => {
    await set(OBRA_KEY, { schemaVersion: 1, data: { roto: true } });
    const res = await loadObraEnvelope();
    expect(res.kind).toBe('corrupt');
    if (res.kind === 'corrupt') expect(res.raw).toBeTruthy();
  });

  it('clearObra borra el proyecto persistido', async () => {
    await saveObra(sample());
    await clearObra();
    expect(await loadRaw()).toBeUndefined();
  });

  it('escrituras coalescidas: solo la última gana (cola de un carril)', async () => {
    const a = sample();
    const b = { ...sample(), obra: { ...sample().obra, denominacion: 'Última' } };
    void saveObra(a);
    await saveObra(b); // espera a la cola
    const res = await loadObraEnvelope();
    expect(res.kind === 'ok' && res.envelope.data.obra.denominacion).toBe('Última');
  });
});
