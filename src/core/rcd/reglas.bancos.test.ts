/* Códigos de demolición por banco (docs/plan-bases-oficiales.md, R12/D17).
   `proponerResiduo` no sabe de qué banco es una partida: un prefijo nuevo para
   un banco no puede cambiar las propuestas de otro. En la CI, un juego pequeño
   de códigos escrito a mano; en local (las bases no viajan en git), que ninguna
   partida de las otras bases empieza por los prefijos de Extremadura. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToObra } from '../bc3import';
import { proponerResiduo } from './reglas';

const p = (code: string, title: string, ud: string, desc = '') => ({ code, title, ud, desc });
const ref = (r: ReturnType<typeof proponerResiduo>) => r?.origen.tipo === 'regla' ? r.origen.ref : null;

/** Lo que añadió E3 para Extremadura (ha de cuadrar con `CODIGO_DEMOLICION`). */
const PREFIJOS_EXTREMADURA = /^(E01E[A-Z]|R01D[A-UW-Z]|Q01[DP]\d|U01CR[EF])/;

describe('reglas por código de Extremadura (E3)', () => {
  it('escarificado y fresado de firme: sin verbo de demolición, el código basta', () => {
    const mbc = 'Fresado de firme (m2xcm) de mezcla bituminosa en caliente, incluso carga sobre camión.';
    const hm = 'Fresado de firme (m2xcm) de hormigón, incluso carga sobre camión.';
    expect(ref(proponerResiduo(p('U01CRF010', 'FRESADO DE FIRME (MBC)', 'm2cm', mbc)))).toBe('bituminoso');
    expect(ref(proponerResiduo(p('U01CRF050', 'FRESADO DE FIRME HORMIGÓN', 'm2cm', hm)))).toBe('hormigon');
    // Sin el código de Extremadura, el mismo texto no se reconoce (no hay verbo).
    expect(proponerResiduo(p('X01', 'FRESADO DE FIRME (MBC)', 'm2cm', mbc))).toBeNull();
  });

  it('la evacuación de escombros (R01DV) sigue siendo transporte: no genera', () => {
    const desc = 'Evacuación y transporte a vertedero de tierra, escombros y material de desecho mediante contenedores.';
    expect(ref(proponerResiduo(p('R01DVE040', 'EVACUACIÓN Y TRANSPORTE A VERTEDERO CONTENEDORES', 'm3', desc)))).toBe(
      'transporte',
    );
  });

  it('la protección de mobiliario (R01DV) no se propone como demolición', () => {
    expect(proponerResiduo(p('R01DVP010', 'PROTECCIÓN MOBILIARIO VARIO', 'ud'))).toBeNull();
  });

  it('un corte con disco de la obra civil (U01CRL) no se propone como demolición', () => {
    expect(proponerResiduo(p('U01CRL005', 'CORTE CON DISCO', 'm'))).toBeNull();
  });
});

describe('los prefijos de Extremadura no tocan a otros bancos', () => {
  it('Precio Centro U01C010 (escarificado del terreno) no es una demolición por código', () => {
    expect(proponerResiduo(p('U01C010', 'ESCARIFICADO SUPERFICIAL TERRENO CON MOTONIVELADORA', 'm2'))).toBeNull();
  });

  it('códigos de la BCCA, Precio Centro y CYPE no casan con los prefijos nuevos', () => {
    for (const c of ['01ADS00001', 'E01DCC020', 'DRS020', 'U01C010', 'E02CM010', 'R01', 'Q01', '02ZAA00001'])
      expect(PREFIJOS_EXTREMADURA.test(c), c).toBe(false);
  });

  const MUESTRAS = ['BCCA2023_V02.bc3', 'centro2017_clasica.bc3', 'base precios.bc3', 'obra ejemplo.bc3'].map((n) =>
    resolve(process.cwd(), 'docs', 'spike', 'samples', n),
  );
  // LOCAL-ONLY (las bases no viajan en git): ninguna partida de otra base
  // empieza por un prefijo de Extremadura, así que ninguna cambia de propuesta.
  for (const ruta of MUESTRAS)
    it.skipIf(!existsSync(ruta))(`ninguna partida de ${ruta.split(/[\\/]/).at(-1)} usa un prefijo de Extremadura`, () => {
      const { data } = bc3ToObra(new Uint8Array(readFileSync(ruta)));
      const choques = Object.values(data.partidas)
        .flat()
        .map((x) => x.code)
        .filter((c) => PREFIJOS_EXTREMADURA.test(c));
      expect(choques).toEqual([]);
    }, 120_000);
});
