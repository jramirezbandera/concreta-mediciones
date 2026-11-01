import { describe, expect, it } from 'vitest';
import type { Chapter, Obra, Partida, PartidasMap, Rates } from '../types';
import type { EstudioRcdDatos } from '../rcd/tipos';
import { art4, calcularPec } from './art4';
import {
  amiantoDe,
  capituloSsPropuesto,
  estudioDe,
  estudioSsVacio,
  jornadasMedidas,
  pemEss,
  pendientesDatosEss,
  presupuestoDeObra,
  type EntradaEss,
} from './obra';
import type { EstudioSsDatos } from './tipos';

const RATES: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };
const OBRA: Obra = { denominacion: 'Prueba', direccion: '', localidad: '' };

function p(id: string, precio: number, cantidad: number, items: Partida['items'] = []): Partida {
  return { id, pos: id, code: id, title: id, ud: 'm²', precio, cantidad, desc: '', med: [], items };
}

/** 100.000 € de obra y 5.000 € en el capítulo de seguridad y salud. */
function entrada(datos: Partial<EstudioSsDatos> = {}, estudioRcd?: EstudioRcdDatos): EntradaEss {
  const chapters: Chapter[] = [
    { id: 'c1', code: '1', title: 'Albañilería' },
    { id: 'c2', code: '2', title: 'Seguridad y salud' },
  ];
  const partidas: PartidasMap = {
    c1: [
      p('a', 100, 900, [
        { code: 'mo1', type: 'MO', cantidad: 0.5 },
        { code: 'mt1', type: 'MAT', cantidad: 1 },
      ]),
      p('b', 100, 100),
    ],
    c2: [p('s', 50, 100)],
  };
  return {
    chapters,
    partidas,
    banco: {
      mo1: { type: 'MO', desc: 'Oficial 1.ª', ud: 'h', precio: 20 },
      mt1: { type: 'MAT', desc: 'Ladrillo', ud: 'ud', precio: 1 },
    },
    rates: RATES,
    obra: OBRA,
    estudioRcd,
    datos: estudioSsVacio(datos),
  };
}

const rcd = (over: Partial<EstudioRcdDatos> = {}): EstudioRcdDatos =>
  ({
    version: 1,
    fase: 'ejecucion',
    fecha: null,
    tipos: ['reforma'],
    comunidad: null,
    amianto: 'posible',
    amiantoElementos: 'bajantes de fibrocemento',
    separacion: null,
    plantaMovil: null,
    destinos: {},
    precios: {},
    capituloGestion: null,
    fianza: null,
    ordenanza: null,
    plano: null,
    redactor: null,
    ratios: null,
    ...over,
  }) as EstudioRcdDatos;

describe('el PEM y el PEC desde la obra (art. 4.1 a)', () => {
  it('sin el capítulo de seguridad y salud enlazado, que no cuenta dos veces', () => {
    expect(pemEss(entrada())).toEqual({ pem: 105_000, origen: 'presupuesto', pemSs: 0 });
    expect(pemEss(entrada({ capituloSs: 'c2' }))).toEqual({
      pem: 100_000,
      origen: 'presupuesto',
      pemSs: 5_000,
    });
  });

  it('manda el PEM de toda la obra que declaró el estudio de residuos (D3)', () => {
    expect(pemEss(entrada({}, rcd({ pemObra: 600_000 }))).pem).toBe(600_000);
  });

  it('los porcentajes salen de la obra, sin ruido de coma flotante', () => {
    const pr = presupuestoDeObra(entrada({ capituloSs: 'c2' }));
    expect(pr).toEqual({ pem: 100_000, gg_pct: 13, bi_pct: 6, iva_pct: 10 });
    expect(calcularPec(pr)!.pec).toBe(130_900);
  });

  it('el art. 4 lo lee como en instalaciones', () => {
    const a = art4(estudioDe(entrada({ capituloSs: 'c2' }, rcd({ pemObra: 400_000 }))));
    expect(a.pec?.pec).toBe(523_600);
    expect(a.resultado).toBe('completo');
  });

  it('el capítulo que se propone es el que se llama «Seguridad y salud»', () => {
    expect(capituloSsPropuesto(entrada().chapters)).toBe('c2');
  });
});

describe('las jornadas medidas desde la mano de obra', () => {
  it('Σ cantidad × horas de mano de obra ÷ 8, con la parte del PEM que la tiene', () => {
    expect(jornadasMedidas(entrada())).toEqual({
      horas: 450,
      jornadas: 56,
      pemConMo: 90_000,
      pemTotal: 105_000,
    });
  });

  it('sin descompuestos con mano de obra en horas, no mide nada', () => {
    const e = entrada();
    e.banco = { ...e.banco, mo1: { ...e.banco.mo1!, ud: 'ud' } };
    expect(jornadasMedidas(e)).toBeNull();
  });
});

describe('amianto y tipo de obra compartidos con residuos (D4)', () => {
  it('con estudio de residuos, el estado y dónde salen de él; la friabilidad, de aquí', () => {
    const e = entrada({ amianto: { estado: 'no_identificado', friable: false } }, rcd());
    expect(amiantoDe(e)).toEqual({
      estado: 'posible',
      ubicacion: 'bajantes de fibrocemento',
      friable: false,
    });
  });

  it('sin estudio de residuos, el de este estudio', () => {
    expect(amiantoDe(entrada({ amianto: { estado: 'identificado' } }))).toEqual({
      estado: 'identificado',
    });
  });

  it('obra nueva con demolición: derribo previo, y el amianto se pide', () => {
    const e = entrada({ tipos: ['nueva', 'demolicion'] });
    expect(estudioDe(e).demolicionPrevia).toBe(true);
    expect(pendientesDatosEss(e).map((x) => x.id)).toContain('amianto');
  });
});

describe('lo que falta', () => {
  it('sin datos, pendiente; en obra nueva, sin amianto ni edificio en uso', () => {
    const ids = pendientesDatosEss(entrada({ tipos: ['nueva'] })).map((x) => x.id);
    expect(ids).toEqual([
      'plazo',
      'trabajadores',
      'subterraneas',
      'varios-proyectistas',
      'varias-empresas',
      'centro',
      'servicios',
      'via-publica',
      'redactor',
    ]);
  });

  it('en reforma, el amianto se declara en residuos si lo hay', () => {
    const sin = pendientesDatosEss(entrada({}, rcd({ amianto: null })));
    expect(sin.find((x) => x.id === 'amianto')?.texto).toMatch(/estudio de residuos/);
    expect(sin.map((x) => x.id)).toContain('en-uso');
    expect(pendientesDatosEss(entrada({}, rcd())).map((x) => x.id)).not.toContain('amianto');
  });

  it('sin tipo de obra, se pide', () => {
    expect(pendientesDatosEss(entrada()).map((x) => x.id)[0]).toBe('tipos');
  });
});
