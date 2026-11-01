import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estudioSsVacio } from '../core/ess/guardado';
import type { EstudioRcdDatos } from '../core/rcd/tipos';
import { buildExportText, parseObraJson } from '../persist/transfer';
import {
  SCHEMA_VERSION,
  blankObraData,
  fromSerializable,
  toSerializable,
  type ObraData,
} from './schema';
import { useObraStore } from './obraStore';
import { __resetHistoryForTests, initHistory, undo } from './temporal';

const state = () => useObraStore.getState();

beforeEach(() => {
  __resetHistoryForTests();
  state().loadObra(blankObraData('Seguridad'));
  initHistory(useObraStore);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => __resetHistoryForTests());

describe('v10 → v11 (estudio de seguridad y salud)', () => {
  it('solo sube la versión: sin estudio', () => {
    const v10 = { ...blankObraData(), schemaVersion: 10 } as ObraData;
    delete v10.seguridadSalud;
    expect(fromSerializable(structuredClone(v10))).toEqual({
      ...v10,
      schemaVersion: SCHEMA_VERSION,
    });
    expect(SCHEMA_VERSION).toBe(11);
  });

  it('toSerializable lleva el estudio solo si lo hay', () => {
    expect('seguridadSalud' in toSerializable(blankObraData())).toBe(false);
    expect(
      toSerializable({ ...blankObraData(), seguridadSalud: estudioSsVacio() }).seguridadSalud,
    ).toEqual(estudioSsVacio());
  });

  it('un estudio ilegible se aparta y la obra abre; uno legible se sanea', () => {
    const malo = fromSerializable(
      structuredClone({ ...blankObraData(), seguridadSalud: { version: 7 } as never }),
    );
    expect(malo.seguridadSalud).toBeUndefined();
    expect(malo._ilegible!.map((x) => x.donde)).toEqual(['seguridadSalud']);
    const raro = {
      ...estudioSsVacio({ tipos: ['reforma'] }),
      manoDeObra: { plazoDias: -3, maxTrabajadores: 4 },
      tipos: ['reforma', 'otra'],
    };
    const d = fromSerializable(
      structuredClone({ ...blankObraData(), seguridadSalud: raro as never }),
    );
    expect(d.seguridadSalud).toEqual({
      ...estudioSsVacio(),
      tipos: ['reforma'],
      manoDeObra: { maxTrabajadores: 4 },
    });
  });
});

describe('essSlice', () => {
  it('empezar, cambiar y quitar; cada paso se deshace', () => {
    state().iniciarEstudioSs();
    expect(state().seguridadSalud).toEqual(estudioSsVacio({ capituloSs: null }));
    state().setEstudioSs({ manoDeObra: { plazoDias: 60 } });
    state().quitarEstudioSs();
    expect(state().seguridadSalud).toBeUndefined();
    undo();
    expect(state().seguridadSalud?.manoDeObra).toEqual({ plazoDias: 60 });
    undo();
    undo();
    expect(state().seguridadSalud).toBeUndefined();
  });

  it('al empezar, toma del estudio de residuos el redactor y la fecha', () => {
    const rcd = {
      redactor: { nombre: 'Ana', titulacion: 'Arquitecta', colegiado: '1' },
      fecha: '2026-10-30',
    } as Partial<EstudioRcdDatos>;
    state().iniciarEstudioRcd();
    state().setEstudioRcd(rcd);
    state().iniciarEstudioSs();
    expect(state().seguridadSalud).toMatchObject({ redactor: rcd.redactor, fecha: '2026-10-30' });
  });

  it('no se hereda al cargar otra obra y viaja en la copia .json', () => {
    state().iniciarEstudioSs();
    const copia = parseObraJson(buildExportText());
    state().loadObra(blankObraData('Otra'));
    expect(state().seguridadSalud).toBeUndefined();
    expect(copia.seguridadSalud).toEqual(estudioSsVacio({ capituloSs: null }));
  });
});
