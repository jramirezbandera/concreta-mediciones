import { describe, it, expect } from 'vitest';
import {
  MARGEN_AVISO_PEC,
  UMBRAL_PEC,
  art4,
  avisoCercaniaPec,
  calcularPec,
  coordinadores,
  dotacionHigienica,
  evaluarSupuestos,
  type Supuesto,
} from './art4';
import { parseSeguridadSalud } from './datos';
import type { EstudioSeguridadSalud } from './tipos';

// =============================================================================
// feature-35, paso 2: el motor del art. 4 (PEC, supuestos, coordinadores y
// servicios higiénicos).
// =============================================================================

const estado = (ev: { supuestos: Supuesto[] }, letra: Supuesto['letra']) =>
  ev.supuestos.find((s) => s.letra === letra)!.estado;

/** La hoja del art. 4 de ss02 (2025): refuerzo de cimentación, PEC a 541 € del umbral. */
const SS02: EstudioSeguridadSalud = {
  presupuesto: { pem: 312_672.94, gg_pct: 13, bi_pct: 6, iva_pct: 21 },
  manoDeObra: { plazoDias: 30, maxTrabajadores: 7 },
  subterraneas: false,
};

/** ss03 (2026): sustitución de un mirador, 3 días y 2 operarios. */
const SS03: EstudioSeguridadSalud = {
  presupuesto: { pem: 25_000, gg_pct: 13, bi_pct: 6, iva_pct: 21 },
  manoDeObra: { plazoDias: 3, maxTrabajadores: 2 },
  subterraneas: false,
};

/** ss04 (2026): ascensor y conservación de fachada, «2 meses» (unos 44 días laborables) y 3 operarios. */
const SS04: EstudioSeguridadSalud = {
  presupuesto: { pem: 39_250, gg_pct: 13, bi_pct: 6, iva_pct: 21 },
  manoDeObra: { plazoDias: 44, maxTrabajadores: 3 },
  subterraneas: false,
};

describe('calcularPec', () => {
  it('desglosa el PEC de ss02 línea a línea, a céntimos, como la hoja del estudio', () => {
    expect(calcularPec(SS02.presupuesto)).toEqual({
      pem: 312_672.94,
      gg_pct: 13,
      gg: 40_647.48,
      bi_pct: 6,
      bi: 18_760.38,
      base: 372_080.8,
      iva_pct: 21,
      iva: 78_136.97,
      pec: 450_217.77,
    });
  });

  it('da los PEC de ss03 y ss04 (el IVA de ss04 redondea 9.808,575 hacia arriba)', () => {
    expect(calcularPec(SS03.presupuesto)).toMatchObject({
      gg: 3_250,
      bi: 1_500,
      base: 29_750,
      iva: 6_247.5,
      pec: 35_997.5,
    });
    expect(calcularPec(SS04.presupuesto)).toMatchObject({
      gg: 5_102.5,
      bi: 2_355,
      base: 46_707.5,
      iva: 9_808.58,
      pec: 56_516.08,
    });
  });

  it('sin PEM o sin alguno de los porcentajes no hay PEC; el 0 % es un dato válido', () => {
    expect(calcularPec(undefined)).toBeNull();
    expect(calcularPec({ gg_pct: 13, bi_pct: 6, iva_pct: 21 })).toBeNull();
    expect(calcularPec({ pem: 1000, gg_pct: 13, bi_pct: 6 })).toBeNull();
    expect(calcularPec({ pem: 0, gg_pct: 0, bi_pct: 0, iva_pct: 0 })).toBeNull();
    expect(calcularPec({ pem: 1000, gg_pct: 0, bi_pct: 0, iva_pct: 0 })).toMatchObject({
      gg: 0,
      bi: 0,
      iva: 0,
      pec: 1000,
    });
  });
});

describe('supuesto a) PEC', () => {
  it('450.759,07 no llega; 450.759,08 es «igual o superior»', () => {
    expect(estado(evaluarSupuestos({ pec: 450_759.07 }), 'a')).toBe('no_supera');
    expect(estado(evaluarSupuestos({ pec: 450_759.08 }), 'a')).toBe('supera');
    expect(estado(evaluarSupuestos({ pec: 1_000_000 }), 'a')).toBe('supera');
  });

  it('con el PEM en el umbral y 0 % de todo, el PEC calculado lo supera', () => {
    const r = art4({ presupuesto: { pem: UMBRAL_PEC, gg_pct: 0, bi_pct: 0, iva_pct: 0 } });
    expect(r.pec?.pec).toBe(UMBRAL_PEC);
    expect(estado(r, 'a')).toBe('supera');
    expect(r.resultado).toBe('completo');
  });

  it('sin PEC queda sin datos, con la nota de lo que falta', () => {
    const s = evaluarSupuestos({}).supuestos[0];
    expect(s!.estado).toBe('sin_datos');
    expect(s!.proyecto).toBe('Sin presupuesto');
    expect(s!.nota).toMatch(/Falta el PEC/);
  });
});

describe('supuesto b) días y trabajadores, las dos a la vez', () => {
  it('en el límite: 30 y 20 no se supera; 31 y 21 sí', () => {
    expect(estado(evaluarSupuestos({ plazoDias: 30, maxTrabajadores: 21 }), 'b')).toBe('no_supera');
    expect(estado(evaluarSupuestos({ plazoDias: 31, maxTrabajadores: 20 }), 'b')).toBe('no_supera');
    expect(estado(evaluarSupuestos({ plazoDias: 31, maxTrabajadores: 21 }), 'b')).toBe('supera');
  });

  it('con una sola condición que falla ya no se supera, aunque falte la otra', () => {
    const soloPlazo = evaluarSupuestos({ plazoDias: 30 }).supuestos[1];
    expect(soloPlazo!.estado).toBe('no_supera');
    expect(soloPlazo!.nota).toMatch(/30 días laborables o menos/);
    const soloTrabajadores = evaluarSupuestos({ maxTrabajadores: 20 }).supuestos[1];
    expect(soloTrabajadores!.estado).toBe('no_supera');
    expect(soloTrabajadores!.nota).toMatch(/20 trabajadores a la vez o menos/);
  });

  it('con una condición que se cumple y la otra sin dato, queda sin datos', () => {
    expect(estado(evaluarSupuestos({ plazoDias: 31 }), 'b')).toBe('sin_datos');
    expect(estado(evaluarSupuestos({ maxTrabajadores: 21 }), 'b')).toBe('sin_datos');
    expect(estado(evaluarSupuestos({}), 'b')).toBe('sin_datos');
  });

  it('la columna del proyecto lleva los dos datos', () => {
    expect(evaluarSupuestos({ plazoDias: 120, maxTrabajadores: 4 }).supuestos[1]!.proyecto).toBe(
      '120 días laborables; 4 trabajadores a la vez como máximo',
    );
  });
});

describe('supuesto c) jornadas', () => {
  it('500 no se supera; 501 sí; las declaradas mandan', () => {
    expect(estado(evaluarSupuestos({ jornadas: 500 }), 'c')).toBe('no_supera');
    expect(estado(evaluarSupuestos({ jornadas: 501 }), 'c')).toBe('supera');
    expect(
      estado(evaluarSupuestos({ jornadas: 501, plazoDias: 10, maxTrabajadores: 10 }), 'c'),
    ).toBe('supera');
  });

  it('el atajo: con plazo × trabajadores ≤ 500 queda descartado sin pedir las jornadas', () => {
    const s = evaluarSupuestos({ plazoDias: 50, maxTrabajadores: 10 }).supuestos[2];
    expect(s!.estado).toBe('no_supera');
    expect(s!.proyecto).toBe('Como mucho 500 jornadas (50 días × 10 trabajadores)');
    expect(s!.nota).toMatch(/no llega a 500/);
  });

  it('con plazo × trabajadores > 500 y sin jornadas, hay que declararlas', () => {
    const s = evaluarSupuestos({ plazoDias: 51, maxTrabajadores: 10 }).supuestos[2];
    expect(s!.estado).toBe('sin_datos');
    expect(s!.nota).toMatch(/da 510, más de 500: hay que declarar las jornadas/);
  });

  it('sin nada, sin datos', () => {
    expect(evaluarSupuestos({}).supuestos[2]).toMatchObject({
      estado: 'sin_datos',
      proyecto: 'Sin jornadas',
    });
  });

  it('desde el proyecto, la tabla de periodos manda sobre el número', () => {
    const r = art4({
      manoDeObra: {
        plazoDias: 100,
        maxTrabajadores: 8,
        jornadas: 300,
        periodos: [
          { trabajadores: 6, dias: 60 },
          { trabajadores: 8, dias: 40 },
        ],
      },
    });
    expect(r.supuestos[2]).toMatchObject({ estado: 'supera', proyecto: '680 jornadas' });
  });
});

describe('supuesto d) obras subterráneas', () => {
  it('sí supera, no no supera, sin declarar sin datos', () => {
    expect(evaluarSupuestos({ subterraneas: true }).supuestos[3]).toMatchObject({
      estado: 'supera',
      proyecto: 'Sí',
    });
    expect(evaluarSupuestos({ subterraneas: false }).supuestos[3]).toMatchObject({
      estado: 'no_supera',
      proyecto: 'No',
    });
    const sin = evaluarSupuestos({}).supuestos[3];
    expect(sin!.estado).toBe('sin_datos');
    expect(sin!.nota).toMatch(/zanjas a cielo abierto no cuentan/);
  });
});

describe('resultado', () => {
  it('completo si se supera alguno, aunque otros estén sin datos', () => {
    const r = evaluarSupuestos({ subterraneas: true });
    expect(r.resultado).toBe('completo');
    expect(r.superados).toEqual(['d']);
    expect(r.sinDatos).toEqual(['a', 'b', 'c']);
  });

  it('pendiente si ninguno se supera pero falta algún dato', () => {
    const r = evaluarSupuestos({ pec: 1000, plazoDias: 10, maxTrabajadores: 2 });
    expect(r.resultado).toBe('pendiente');
    expect(r.superados).toEqual([]);
    expect(r.sinDatos).toEqual(['d']);
  });

  it('básico con los cuatro descartados', () => {
    const r = evaluarSupuestos({
      pec: 1000,
      plazoDias: 10,
      maxTrabajadores: 2,
      subterraneas: false,
    });
    expect(r.resultado).toBe('basico');
    expect(r.sinDatos).toEqual([]);
  });

  it('sin nada guardado, los cuatro sin datos y pendiente', () => {
    const r = art4(undefined);
    expect(r.pec).toBeNull();
    expect(r.resultado).toBe('pendiente');
    expect(r.sinDatos).toEqual(['a', 'b', 'c', 'd']);
    expect(r.avisoPec).toBeUndefined();
  });
});

describe('aviso de cercanía al umbral (decisión 4)', () => {
  it('ss02 queda a 541,31 € (el 0,12 %) y avisa', () => {
    const r = art4(SS02);
    expect(r.avisoPec).toEqual({ diferencia: 541.31, pct: 0.12 });
  });

  it('justo en el margen avisa; por debajo del margen no; en el umbral o por encima no', () => {
    const margen = Math.round(UMBRAL_PEC * MARGEN_AVISO_PEC * 100) / 100;
    expect(avisoCercaniaPec(UMBRAL_PEC - margen)?.diferencia).toBe(margen);
    expect(avisoCercaniaPec(UMBRAL_PEC - margen - 1)).toBeUndefined();
    expect(avisoCercaniaPec(UMBRAL_PEC)).toBeUndefined();
    expect(avisoCercaniaPec(UMBRAL_PEC + 1)).toBeUndefined();
    expect(avisoCercaniaPec(undefined)).toBeUndefined();
  });
});

describe('los casos del estudio: ss02, ss03 y ss04 salen básicos', () => {
  it('ss02: PEC 450.217,77 €, 30 días y 7 operarios; el atajo da 210 jornadas', () => {
    const r = art4(SS02);
    expect(r.resultado).toBe('basico');
    expect(r.supuestos.map((s) => s.estado)).toEqual([
      'no_supera',
      'no_supera',
      'no_supera',
      'no_supera',
    ]);
    expect(r.supuestos[0]!.proyecto).toBe('PEC 450.217,77 €');
    expect(r.supuestos[2]!.proyecto).toBe('Como mucho 210 jornadas (30 días × 7 trabajadores)');
  });

  it('ss03: 35.997,50 €, 3 días y 2 operarios, sin aviso', () => {
    const r = art4(SS03);
    expect(r.resultado).toBe('basico');
    expect(r.pec?.pec).toBe(35_997.5);
    expect(r.avisoPec).toBeUndefined();
  });

  it('ss04: 56.516,08 €, 44 días y 3 operarios, sin aviso', () => {
    const r = art4(SS04);
    expect(r.resultado).toBe('basico');
    expect(r.pec?.pec).toBe(56_516.08);
    expect(r.avisoPec).toBeUndefined();
  });

  it('las filas llevan el título del art. 4.1 y el umbral', () => {
    const r = art4(SS03);
    expect(r.supuestos.map((s) => s.letra)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.supuestos[0]!.umbral).toBe('PEC ≥ 450.759,08 €');
    expect(r.supuestos[1]!.umbral).toBe('> 30 días laborables y > 20 trabajadores a la vez');
    expect(r.supuestos[2]!.umbral).toBe('> 500 jornadas');
  });
});

describe('coordinadores (art. 3)', () => {
  it('en proyecto, con varios proyectistas procede y redacta el estudio; si no, no procede con el motivo', () => {
    const si = coordinadores({ variosProyectistas: true }).proyecto;
    expect(si.estado).toBe('procede');
    expect(si.motivo).toMatch(/art\. 3\.1/);
    expect(si.motivo).toMatch(/art\. 6\.1/);
    const no = coordinadores({ variosProyectistas: false }).proyecto;
    expect(no.estado).toBe('no_procede');
    expect(no.motivo).toMatch(/^No procede/);
  });

  it('en ejecución, con más de una empresa o empresa y autónomos procede; con una sola, no procede y queda la reserva del 3.2', () => {
    const si = coordinadores({ variasEmpresas: true }).ejecucion;
    expect(si.estado).toBe('procede');
    expect(si.motivo).toMatch(/antes del inicio de los trabajos/);
    const no = coordinadores({ variasEmpresas: false }).ejecucion;
    expect(no.estado).toBe('no_procede');
    expect(no.motivo).toMatch(/tan pronto como se constate/);
  });

  it('sin respuesta, sin datos en las dos fases', () => {
    const r = coordinadores(undefined);
    expect(r.proyecto.estado).toBe('sin_datos');
    expect(r.ejecucion.estado).toBe('sin_datos');
    expect(coordinadores({}).proyecto.estado).toBe('sin_datos');
  });
});

describe('servicios higiénicos (VII Convenio art. 232.2; Guía folios 79–80)', () => {
  it('«o fracción»: 1 trabajador y 10 dan lo mismo; 11 sube lavabos y duchas; 26 sube retretes', () => {
    expect(dotacionHigienica(1)?.convenio).toEqual({ lavabos: 1, duchas: 1, retretes: 1 });
    expect(dotacionHigienica(10)?.convenio).toEqual({ lavabos: 1, duchas: 1, retretes: 1 });
    expect(dotacionHigienica(11)?.convenio).toEqual({ lavabos: 2, duchas: 2, retretes: 1 });
    expect(dotacionHigienica(25)?.convenio).toEqual({ lavabos: 3, duchas: 3, retretes: 1 });
    expect(dotacionHigienica(26)?.convenio).toEqual({ lavabos: 3, duchas: 3, retretes: 2 });
  });

  it('el local de primeros auxilios, con más de 50 (art. 234.3)', () => {
    expect(dotacionHigienica(50)?.localPrimerosAuxilios).toBe(false);
    expect(dotacionHigienica(51)?.localPrimerosAuxilios).toBe(true);
  });

  it('con el reparto por sexos declarado, la dotación de la Guía: retretes ⌈H/25⌉ + ⌈M/15⌉ y urinarios ⌈H/25⌉', () => {
    const d = dotacionHigienica(36, { hombres: 20, mujeres: 16 });
    expect(d?.guia).toEqual({ hombres: 20, mujeres: 16, retretes: 1 + 2, urinarios: 1 });
    expect(dotacionHigienica(36, { hombres: 20 })?.guia).toBeUndefined();
    expect(dotacionHigienica(36)?.guia).toBeUndefined();
  });

  it('la obra corta admite la solución alternativa, con el texto del proyectista', () => {
    expect(dotacionHigienica(2)).toMatchObject({ admiteAlternativa: false });
    expect(dotacionHigienica(2, { cortaDuracion: true })).toMatchObject({
      admiteAlternativa: true,
    });
    expect(
      dotacionHigienica(2, {
        cortaDuracion: true,
        alternativa: 'Aseo de la vivienda, cedido por el promotor',
      })?.alternativa,
    ).toBe('Aseo de la vivienda, cedido por el promotor');
    expect(
      dotacionHigienica(2, { cortaDuracion: false, alternativa: 'Aseo de la vivienda' })
        ?.alternativa,
    ).toBeUndefined();
  });

  it('sin el máximo de trabajadores no hay dotación: no se supone', () => {
    expect(dotacionHigienica(undefined)).toBeNull();
    expect(dotacionHigienica(0)).toBeNull();
  });

  it('los datos se leen saneados: 0 mujeres vale, un reparto negativo o con decimales no', () => {
    expect(
      parseSeguridadSalud({
        serviciosHigienicos: { cortaDuracion: true, alternativa: ' aseo ', hombres: 3, mujeres: 0 },
      }),
    ).toEqual({
      serviciosHigienicos: { cortaDuracion: true, alternativa: 'aseo', hombres: 3, mujeres: 0 },
    });
    expect(
      parseSeguridadSalud({ serviciosHigienicos: { hombres: -1, mujeres: 1.5 } }),
    ).toBeUndefined();
  });
});
