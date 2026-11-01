import { describe, it, expect } from 'vitest';
import {
  cotaJornadas,
  estimarTrabajadores,
  jornadasDeclaradas,
  jornadasDePeriodos,
  parseSeguridadSalud,
  pideJornadas,
} from './datos';
import { SERVICIOS_AFECTADOS, type EstudioSeguridadSalud } from './tipos';

// =============================================================================
// Los datos del estudio: lectura saneada y mano de obra (de concreta-
// instalaciones, feature-35 paso 1). Lo que lee la obra está en E1.
// =============================================================================

/** Todos los datos que pide el estudio, declarados. */
const COMPLETO: EstudioSeguridadSalud = {
  presupuesto: { pem: 180_000, gg_pct: 13, bi_pct: 6, iva_pct: 10 },
  manoDeObra: { plazoDias: 120, maxTrabajadores: 4 },
  subterraneas: false,
  amianto: { estado: 'no_identificado' },
  coordinacion: { variosProyectistas: false, variasEmpresas: true },
  entorno: {
    centroAsistencial: { nombre: 'Hospital Xanit', distancia_km: 4.2, tiempo_min: 9 },
    viaPublica: false,
    edificioEnUso: false,
    servicios: Object.fromEntries(SERVICIOS_AFECTADOS.map((s) => [s, false])),
  },
};

describe('parseSeguridadSalud', () => {
  it('lo bien formado sale igual', () => {
    const e: EstudioSeguridadSalud = {
      ...COMPLETO,
      manoDeObra: {
        plazoDias: 200,
        maxTrabajadores: 8,
        estimacion: { manoObra_pct: 35, costeHora: 22 },
        periodos: [
          { descripcion: 'Estructura', trabajadores: 6, dias: 60 },
          { trabajadores: 3, dias: 140 },
        ],
      },
      demolicionPrevia: true,
      amianto: { estado: 'posible', ubicacion: 'bajantes del patio', friable: false },
      entorno: { ...COMPLETO.entorno, servicios: { linea_aerea: true }, tensionLineas_kV: 20 },
      medios: { gruaTorre: false, gruaMovil: true },
      seleccion: {
        anadidas: ['M7'],
        quitadas: ['F14'],
        ediciones: {
          IP1: {
            riesgos: {
              quitados: ['ruido'],
              anadidos: [{ clave: 'amianto', causa: 'placas de fibrocemento' }],
            },
            medidas: {
              quitados: ['Riego contra el polvo'],
              anadidos: ['Horario pactado con la comunidad'],
            },
            revisada: true,
          },
        },
      },
      planos: 'SS01–SS02',
    };
    expect(parseSeguridadSalud(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it('descarta lo que no tiene forma sin lanzar', () => {
    expect(parseSeguridadSalud(null)).toBeUndefined();
    expect(parseSeguridadSalud('x')).toBeUndefined();
    expect(parseSeguridadSalud([])).toBeUndefined();
    expect(parseSeguridadSalud({})).toBeUndefined();
    const r = parseSeguridadSalud({
      presupuesto: { pem: -5, gg_pct: '13', bi_pct: 6, iva_pct: Number.NaN },
      manoDeObra: {
        plazoDias: 12.5,
        maxTrabajadores: 0,
        jornadas: 300,
        periodos: [{ trabajadores: 2 }, 'x'],
      },
      estimacion: 3,
      subterraneas: 'no',
      amianto: { estado: 'quizas' },
      coordinacion: { variosProyectistas: 1 },
      entorno: {
        centroAsistencial: { nombre: '  ' },
        servicios: { gas: true, piscina: true, agua: 'si' },
      },
      seleccion: {
        anadidas: ['M7', 'M7', 3, ''],
        ediciones: {
          IP1: { riesgos: { quitados: ['caida', 'ruido'], anadidos: [{ clave: 'nada' }] } },
          F1: 'x',
        },
      },
    });
    expect(r).toEqual({
      presupuesto: { bi_pct: 6 },
      manoDeObra: { jornadas: 300 },
      entorno: { servicios: { gas: true } },
      seleccion: { anadidas: ['M7'], ediciones: { IP1: { riesgos: { quitados: ['ruido'] } } } },
    });
  });

  it('acepta un 0 % de gastos generales o beneficio, no un PEM de 0', () => {
    expect(
      parseSeguridadSalud({ presupuesto: { pem: 0, gg_pct: 0, bi_pct: 0, iva_pct: 0 } }),
    ).toEqual({
      presupuesto: { gg_pct: 0, bi_pct: 0, iva_pct: 0 },
    });
  });

  it('el porcentaje de mano de obra no pasa del 100 %', () => {
    expect(
      parseSeguridadSalud({ manoDeObra: { estimacion: { manoObra_pct: 120, costeHora: 20 } } }),
    ).toEqual({
      manoDeObra: { estimacion: { costeHora: 20 } },
    });
  });
});

describe('mano de obra', () => {
  it('jornadas por periodos: Σ Tᵢ × Dᵢ', () => {
    expect(jornadasDePeriodos([])).toBe(0);
    expect(
      jornadasDePeriodos([
        { trabajadores: 6, dias: 60 },
        { trabajadores: 3, dias: 140 },
      ]),
    ).toBe(780);
  });

  it('solo pide las jornadas si plazo × trabajadores pasa de 500', () => {
    expect(cotaJornadas(undefined)).toBeUndefined();
    expect(cotaJornadas({ plazoDias: 100 })).toBeUndefined();
    expect(pideJornadas({ plazoDias: 100, maxTrabajadores: 5 })).toBe(false); // 500, no «superior»
    expect(pideJornadas({ plazoDias: 167, maxTrabajadores: 3 })).toBe(true); // 501
    expect(pideJornadas({ plazoDias: 100 })).toBe(false);
  });

  it('con tabla de periodos manda la suma; si no, el número', () => {
    expect(jornadasDeclaradas(undefined)).toBeUndefined();
    expect(jornadasDeclaradas({ jornadas: 450 })).toBe(450);
    expect(jornadasDeclaradas({ jornadas: 450, periodos: [{ trabajadores: 4, dias: 100 }] })).toBe(
      400,
    );
    expect(jornadasDeclaradas({ jornadas: 450, periodos: [] })).toBe(450);
  });

  it('estima desde el PEM con el porcentaje y el coste que declara el proyectista', () => {
    // 180.000 € × 35 % = 63.000 € de mano de obra; a 20 €/h y 8 h, 393,75 jornadas;
    // en 120 días, 3,28 trabajadores de media → 4.
    expect(estimarTrabajadores(180_000, { manoObra_pct: 35, costeHora: 20 }, 120)).toEqual({
      jornadas: 394,
      trabajadoresMedios: 4,
    });
    // Nunca menos de uno.
    expect(
      estimarTrabajadores(1_000, { manoObra_pct: 10, costeHora: 25 }, 200)?.trabajadoresMedios,
    ).toBe(1);
  });

  it('sin un dato no estima nada (no hay valores por defecto)', () => {
    const est = { manoObra_pct: 35, costeHora: 20 };
    expect(estimarTrabajadores(undefined, est, 120)).toBeNull();
    expect(estimarTrabajadores(180_000, { costeHora: 20 }, 120)).toBeNull();
    expect(estimarTrabajadores(180_000, { manoObra_pct: 35 }, 120)).toBeNull();
    expect(estimarTrabajadores(180_000, est, undefined)).toBeNull();
    expect(estimarTrabajadores(180_000, undefined, 120)).toBeNull();
  });
});
