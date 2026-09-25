import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, seedObraData, toSerializable, type ObraData } from '../store';
import {
  OBRA_KEY,
  clearObra,
  isObraData,
  loadObraEnvelope,
  loadRaw,
  obraKey,
  obraKeys,
  saveObra,
  versionKey,
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

  it('A-02: rechaza blobs ENVENENADOS (elementos nulos que antes pasaban el gate)', () => {
    // Antes hidrataban sin banner y el primer selector reventaba en render, con
    // el blob recargándose «sano» en cada arranque (bucle de brick).
    expect(isObraData({ ...sample(), certs: [null] })).toBe(false);
    expect(isObraData({ ...sample(), certs: [{ id: 'c1', num: 1 }] })).toBe(false); // sin data
    expect(isObraData({ ...sample(), chapters: [null] })).toBe(false);
    expect(isObraData({ ...sample(), chapters: [{ id: '01' }] })).toBe(false); // sin title
    expect(isObraData({ ...sample(), recursos: { r1: null } })).toBe(false);
    expect(isObraData({ ...sample(), partidas: { '01': [null] } })).toBe(false);
    expect(isObraData({ ...sample(), partidas: { '01': [{ code: 'X' }] } })).toBe(false); // sin id
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

/* ---- Etapa 0: obras guardadas por una versión MÁS NUEVA ------------------- */
const V7 = SCHEMA_VERSION + 2;
/** Sobre de una Concreta futura con OTRA forma (no pasaría `isObraData`). */
const futuro = () => ({ schemaVersion: V7, savedAt: 'x', appVersion: '9.0', data: { hojas: [] } });

describe('versión más nueva (Etapa 0)', () => {
  it('un sobre v7 con otra forma → «newer», nunca «corrupt»', async () => {
    await set(K, futuro());
    const res = await loadObraEnvelope(K);
    expect(res.kind).toBe('newer');
    if (res.kind === 'newer') expect(res.version).toBe(V7);
  });

  it('la versión se mira también en `data` (sobre sin versión propia)', async () => {
    await set(K, { data: { schemaVersion: V7 } });
    expect((await loadObraEnvelope(K)).kind).toBe('newer');
  });

  it('saveObra NO pisa un sobre más nuevo: «version-conflict» y el disco intacto', async () => {
    await saveObra(K, sample()); // escribe la clave de versión
    await set(K, futuro());
    await set(versionKey(K), V7); // lo que dejaría la app nueva
    expect(await saveObra(K, sample())).toBe('version-conflict');
    expect(await get(K)).toEqual(futuro());
    expect(await get(versionKey(K))).toBe(V7);
  });

  it('sin clave de versión (sobre anterior a la Etapa 0) mira la del sobre', async () => {
    await set(K, futuro());
    expect(await saveObra(K, sample())).toBe('version-conflict');
    expect(await get(K)).toEqual(futuro());
  });

  it('el rechazo es TERMINAL: sale de la cola y no bloquea el guardado de otras obras', async () => {
    const otra = obraKey('otra');
    await set(K, futuro());
    const [r1, r2] = await Promise.all([saveObra(K, sample()), saveObra(otra, sample())]);
    expect(r1).toBe('version-conflict');
    expect(r2).toBe('ok');
    expect((await loadObraEnvelope(otra)).kind).toBe('ok');
    // El siguiente guardado de otra obra no reintenta el rechazado.
    expect(await saveObra(obraKey('tercera'), sample())).toBe('ok');
    expect(await get(K)).toEqual(futuro());
  });

  it('guardar la misma versión o una anterior en disco escribe y sella la versión', async () => {
    await set(K, { ...futuro(), schemaVersion: SCHEMA_VERSION - 1, data: sample() });
    expect(await saveObra(K, sample())).toBe('ok');
    expect(await get(versionKey(K))).toBe(SCHEMA_VERSION);
  });

  it('la clave de versión no cuenta como obra y se borra con la obra', async () => {
    await saveObra(K, sample());
    expect(await obraKeys()).toEqual([K]);
    await clearObra(K);
    expect(await get(versionKey(K))).toBeUndefined();
  });
});
