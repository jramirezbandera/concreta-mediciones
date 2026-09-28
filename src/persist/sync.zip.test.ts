/* ===========================================================================
   Copia .zip de la obra con planos y su restauración POR ETAPAS (§9.2, A1):
     · exportar → borrar los PDF del navegador → restaurar: vuelven obra, PDF,
       escalas y líneas con su procedencia;
     · un PDF que no cuadra con su huella se descarta (plano «no disponible»);
     · cuota a mitad: se deja de escribir PDF; la obra se restaura igual;
     · la obra no cabe: se retiran PDF nuevos hasta que quepa; si ni así,
       vuelve la obra anterior y se retiran los nuevos que sigan siendo suyos
       (no los que otra pestaña adoptó entretanto).
   Fichero aparte: los espías de `registry` y `planos` (para inyectar fallos)
   no deben contaminar las demás suites.
   =========================================================================== */
import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock(import('./registry'), { spy: true });
vi.mock(import('./planos'), { spy: true });
import * as registry from './registry';
import * as planos from './planos';
import { huellaDe } from '../core/sha256';
import type { PlanoMeta } from '../core/types';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import { toSerializable, useObraStore, useToastStore, type ObraData } from '../store';
import { usePlanoUiStore } from '../store/planoUiStore';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';
import {
  __resetSyncForTests,
  descargarCopiaZip,
  flushPending,
  getActiveObraId,
  hydrate,
  importarSobreActiva,
  restaurarZipSobreActiva,
} from './sync';
import { leerCopiaZip, parseObraJson } from './transfer';
import { EscritorZip } from './zip';

const state = () => useObraStore.getState();
const HUELLA_A0 = (a0 as unknown as { planos: PlanoMeta[] }).planos[0]!.huella;
const cuota = () => Object.assign(new Error('lleno'), { name: 'QuotaExceededError' });

/** Lo descargado en esta prueba (los Blob que pasan por `createObjectURL`). */
let descargas: { blob: Blob; nombre: string }[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  await clear();
  await planos.__resetPlanosForTests();
  state().reset();
  __resetSyncForTests();
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null, durability: 'unknown' });
  useToastStore.setState({ msg: null, action: null, tick: 0 });
  usePlanoUiStore.getState().reset();
  descargas = [];
  let ultimo: Blob | null = null;
  vi.stubGlobal('URL', {
    createObjectURL: (b: Blob) => {
      ultimo = b;
      return 'blob:x';
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (ultimo) descargas.push({ blob: ultimo, nombre: this.download });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bytesPdf = (texto: string) => new TextEncoder().encode(`%PDF-1.4\n${texto}\n%%EOF`).buffer;

/** La obra A0 (un plano, 7 líneas medidas), con la huella de `bytes` y esos
 *  bytes en el almacén; activa y guardada. `extra`: más planos con sus bytes. */
async function obraGuardada(bytes: ArrayBuffer, extra: { nombre: string; bytes: ArrayBuffer }[] = []) {
  const h = await huellaDe(bytes);
  const data = parseObraJson(JSON.stringify(a0).split(HUELLA_A0).join(h));
  for (const [i, x] of extra.entries()) {
    const hx = await huellaDe(x.bytes);
    await planos.guardarPlano(hx, x.bytes, 'application/pdf');
    data.planos.push({ ...(data.planos[0] as PlanoMeta), id: `pl-extra${i}`, nombre: x.nombre, huella: hx, tamano: x.bytes.byteLength, escalas: {} });
  }
  await planos.guardarPlano(h, bytes, 'application/pdf');
  await hydrate();
  expect((await importarSobreActiva(data)).kind).toBe('ok');
  await flushPending();
  descargas = [];
  return h;
}

async function copiaZip(): Promise<Blob> {
  const r = await descargarCopiaZip();
  expect(r.kind).toBe('ok');
  return descargas.at(-1)!.blob;
}

const lineasConOrigen = (d: ObraData) =>
  Object.values(d.partidas)
    .flat()
    .flatMap((p) => p.med)
    .filter((l) => l.origen);

describe('copia .zip: exportar → borrar los PDF → restaurar', () => {
  it('vuelven la obra, el PDF, las escalas y las líneas con su procedencia', async () => {
    const h = await obraGuardada(bytesPdf('planta primera'));
    const antes = toSerializable(state());
    const zip = await copiaZip();
    expect(descargas.at(-1)!.nombre).toBe('concreta-obra.zip');
    expect(useSessionStore.getState().obras.find((o) => o.id === getActiveObraId())?.ultimaCopia).toBeTruthy();

    await planos.__resetPlanosForTests(); // otro navegador: sin el PDF
    state().editPartidaField('c01', 'p-tabique', 'title', 'Cambiada después');
    await flushPending();
    expect(await planos.tienePlano(h)).toBe(false);

    const res = await restaurarZipSobreActiva(await leerCopiaZip(zip));
    expect(res).toEqual({ kind: 'ok', planos: [{ planoId: 'pl-p1', nombre: 'Planta primera', disponible: true }] });
    expect(await planos.tienePlano(h)).toBe(true);
    expect(usePlanoUiStore.getState().disponibles[h]).toBe(true);
    const ahora = toSerializable(state());
    expect(ahora.planos).toEqual(antes.planos);
    expect(lineasConOrigen(ahora)).toEqual(lineasConOrigen(antes));
    // en disco, no solo en memoria; y la restaurada empieza sin fecha de copia
    const disco = await registry.loadObraData(getActiveObraId()!);
    expect(disco.kind === 'ok' && disco.data.planos).toEqual(antes.planos);
    expect(useSessionStore.getState().obras.find((o) => o.id === getActiveObraId())?.ultimaCopia).toBeUndefined();
    // antes de pisar, la copia de la obra anterior (con planos, .zip)
    expect(descargas.map((d) => d.nombre)).toContain('concreta-copia-antes-de-importar.zip');
  });

  it('un PDF que ya estaba en este navegador no es «nuevo» de la restauración', async () => {
    const h = await obraGuardada(bytesPdf('ya estaba'));
    const zip = await copiaZip();
    await restaurarZipSobreActiva(await leerCopiaZip(zip));
    expect((await planos.leerMetaPlano(h))?.restauracion).toBeUndefined();
  });

  it('un PDF que no cuadra con su huella se descarta; el resto se restaura', async () => {
    const buena = bytesPdf('buena');
    const h = await obraGuardada(buena);
    const data = toSerializable(state());
    // copia a mano: el PDF lleva el nombre de su huella pero OTROS bytes
    const z = new EscritorZip();
    await z.anadir('obra.json', new TextEncoder().encode(JSON.stringify(data)), true);
    await z.anadir(`planos/${h}.pdf`, new Uint8Array(bytesPdf('manipulada')), false);
    await planos.__resetPlanosForTests();

    const res = await restaurarZipSobreActiva(await leerCopiaZip(z.cerrar()));
    expect(res).toEqual({
      kind: 'ok',
      planos: [{ planoId: 'pl-p1', nombre: 'Planta primera', disponible: false, motivo: 'huella' }],
    });
    expect(await planos.tienePlano(h)).toBe(false);
    expect(lineasConOrigen(toSerializable(state()))).toHaveLength(7); // las líneas, intactas
  });

  it('cuota llena a mitad: deja de escribir PDF y restaura la obra igual', async () => {
    const hA = await obraGuardada(bytesPdf('A'), [{ nombre: 'Planta B', bytes: bytesPdf('B') }]);
    const zip = await copiaZip();
    await planos.__resetPlanosForTests();
    vi.mocked(planos.restaurarPlano).mockRejectedValueOnce(cuota());

    const res = await restaurarZipSobreActiva(await leerCopiaZip(zip));
    expect(res.kind === 'ok' && res.planos.map((p) => [p.nombre, p.disponible, p.motivo])).toEqual([
      ['Planta primera', false, 'cuota'],
      ['Planta B', false, 'cuota'],
    ]);
    expect(planos.restaurarPlano).toHaveBeenCalledTimes(1); // no se intenta el segundo
    expect(await planos.tienePlano(hA)).toBe(false);
    expect((await registry.loadObraData(getActiveObraId()!)).kind).toBe('ok');
  });
});

describe('restaurar: la obra no cabe', () => {
  it('retira PDF nuevos (el más grande primero) hasta que la obra quepa', async () => {
    const grande = bytesPdf('G'.repeat(5000));
    const hG = await obraGuardada(bytesPdf('pequeño'), [{ nombre: 'Grande', bytes: grande }]);
    const hP = state().planos[0]!.huella;
    const hGrande = await huellaDe(grande);
    expect(hG).toBe(hP);
    const zip = await copiaZip();
    await planos.__resetPlanosForTests();
    vi.mocked(registry.saveActiveObra).mockRejectedValueOnce(cuota());

    const res = await restaurarZipSobreActiva(await leerCopiaZip(zip));
    expect(res.kind === 'ok' && res.planos.map((p) => [p.nombre, p.disponible, p.motivo])).toEqual([
      ['Planta primera', true, undefined],
      ['Grande', false, 'cuota'],
    ]);
    expect(await planos.tienePlano(hGrande)).toBe(false);
    expect(await planos.tienePlano(hP)).toBe(true);
  });

  it('si ni así: vuelve la obra anterior y retira los PDF nuevos de esta restauración', async () => {
    // Anterior: sin planos. La copia: una obra con un plano.
    const h = await obraGuardada(bytesPdf('de la copia'));
    const zip = await copiaZip();
    await planos.__resetPlanosForTests();
    state().reset();
    await importarSobreActiva({ ...toSerializable(state()), obra: { denominacion: 'Anterior', direccion: '', localidad: '' } });
    await flushPending();
    vi.mocked(registry.saveActiveObra).mockRejectedValue(cuota());

    const res = await restaurarZipSobreActiva(await leerCopiaZip(zip));
    vi.mocked(registry.saveActiveObra).mockReset();
    expect(res).toEqual({ kind: 'revertida' });
    expect(state().obra.denominacion).toBe('Anterior');
    expect(state().planos).toEqual([]);
    expect(await planos.tienePlano(h)).toBe(false);
  });

  it('un PDF que otra pestaña adoptó entretanto no se retira', async () => {
    const bytes = bytesPdf('adoptado');
    const h = await obraGuardada(bytes);
    const zip = await copiaZip();
    await planos.__resetPlanosForTests();
    // Guardar la obra falla siempre; justo antes, «otra pestaña» adjunta ese PDF.
    vi.mocked(registry.saveActiveObra).mockImplementation(async () => {
      await planos.guardarPlano(h, bytes, 'application/pdf');
      throw cuota();
    });

    const res = await restaurarZipSobreActiva(await leerCopiaZip(zip));
    vi.mocked(registry.saveActiveObra).mockReset();
    expect(res).toEqual({ kind: 'revertida' });
    expect(await planos.tienePlano(h)).toBe(true);
  });

  it('con la obra actual sin guardar no restaura nada', async () => {
    await obraGuardada(bytesPdf('x'));
    const zip = await copiaZip();
    state().editPartidaField('c01', 'p-tabique', 'title', 'En riesgo');
    vi.mocked(registry.saveActiveObra).mockRejectedValueOnce(cuota());
    await expect(restaurarZipSobreActiva(await leerCopiaZip(zip))).resolves.toEqual({ kind: 'sin-guardar-actual' });
    expect(planos.restaurarPlano).not.toHaveBeenCalled();
  });
});

describe('copia .zip: incompleta', () => {
  it('un plano sin su PDF en este navegador: la copia sale y lo dice', async () => {
    await obraGuardada(bytesPdf('A'));
    await planos.__resetPlanosForTests();
    await expect(descargarCopiaZip()).resolves.toMatchObject({ kind: 'ok', planos: 0, faltan: ['Planta primera'] });
  });
});
