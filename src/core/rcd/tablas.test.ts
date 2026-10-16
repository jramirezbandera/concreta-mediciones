import { describe, expect, it } from 'vitest';
import { densidadAparente } from './aparente';
import { kNaT, materialSeAe, materialesSeAe, pesoSuperficieSeAe } from './densidades';
import { destinoPorDefecto, fraccionDe, operacion } from './fracciones';
import { citaLer, lerVigente, normalizarLer } from './ler';

/* Dos fuentes que tienen que coincidir: la tabla generada del volcado del DOUE
   y los literales de la verificación K-RCD.9 (Instalaciones, 2026-10-16). */
const K_RCD_9_CAP_17: Array<[string, string, boolean]> = [
  ['17 01 01', 'Hormigón', false],
  ['17 01 02', 'Ladrillos', false],
  ['17 01 03', 'Tejas y materiales cerámicos', false],
  ['17 01 06', 'Mezclas, o fracciones separadas, de hormigón, ladrillos, tejas y materiales cerámicos que contienen sustancias peligrosas', true],
  ['17 01 07', 'Mezclas de hormigón, ladrillos, tejas y materiales cerámicos, distintas de las especificadas en el código 17 01 06', false],
  ['17 02 01', 'Madera', false],
  ['17 02 02', 'Vidrio', false],
  ['17 02 03', 'Plástico', false],
  ['17 02 04', 'Vidrio, plástico y madera que contienen sustancias peligrosas o están contaminados por ellas', true],
  ['17 03 01', 'Mezclas bituminosas que contienen alquitrán de hulla', true],
  ['17 03 02', 'Mezclas bituminosas distintas de las especificadas en el código 17 03 01', false],
  ['17 03 03', 'Alquitrán de hulla y productos alquitranados', true],
  ['17 04 01', 'Cobre, bronce, latón', false],
  ['17 04 02', 'Aluminio', false],
  ['17 04 03', 'Plomo', false],
  ['17 04 04', 'Zinc', false],
  ['17 04 05', 'Hierro y acero', false],
  ['17 04 06', 'Estaño', false],
  ['17 04 07', 'Metales mezclados', false],
  ['17 04 09', 'Residuos metálicos contaminados con sustancias peligrosas', true],
  ['17 04 10', 'Cables que contienen hidrocarburos, alquitrán de hulla y otras sustancias peligrosas', true],
  ['17 04 11', 'Cables distintos de los especificados en el código 17 04 10', false],
  ['17 05 03', 'Tierra y piedras que contienen sustancias peligrosas', true],
  ['17 05 04', 'Tierra y piedras distintas de las especificadas en el código 17 05 03', false],
  ['17 05 05', 'Lodos de drenaje que contienen sustancias peligrosas', true],
  ['17 05 06', 'Lodos de drenaje distintos de los especificados en el código 17 05 05', false],
  ['17 05 07', 'Balasto de vías férreas que contiene sustancias peligrosas', true],
  ['17 05 08', 'Balasto de vías férreas distinto del especificado en el código 17 05 07', false],
  ['17 06 01', 'Materiales de aislamiento que contienen amianto', true],
  ['17 06 03', 'Otros materiales de aislamiento que consisten en sustancias peligrosas o contienen dichas sustancias', true],
  ['17 06 04', 'Materiales de aislamiento distintos de los especificados en los códigos 17 06 01 y 17 06 03', false],
  ['17 06 05', 'Materiales de construcción que contienen amianto', true],
  ['17 08 01', 'Materiales de construcción a base de yeso contaminados con sustancias peligrosas', true],
  ['17 08 02', 'Materiales de construcción a base de yeso distintos de los especificados en el código 17 08 01', false],
  ['17 09 01', 'Residuos de construcción y demolición que contienen mercurio', true],
  [
    '17 09 02',
    'Residuos de construcción y demolición que contienen PCB (por ejemplo, sellantes que contienen PCB, revestimientos de suelo a base de resinas que contienen PCB, acristalamientos dobles que contienen PCB, condensadores que contienen PCB)',
    true,
  ],
  ['17 09 03', 'Otros residuos de construcción y demolición (incluidos los residuos mezclados) que contienen sustancias peligrosas', true],
  ['17 09 04', 'Residuos mezclados de construcción y demolición distintos de los especificados en los códigos 17 09 01, 17 09 02 y 17 09 03', false],
];
const K_RCD_9_OTROS: Array<[string, string, boolean]> = [
  ['08 01 11', 'Residuos de pintura y barniz que contienen disolventes orgánicos u otras sustancias peligrosas', true],
  ['08 01 12', 'Residuos de pintura y barniz, distintos de los especificados en el código 08 01 11', false],
  ['13 02 05', 'Aceites minerales no clorados de motor, de transmisión mecánica y lubricantes', true],
  ['15 01 01', 'Envases de papel y cartón', false],
  ['15 01 02', 'Envases de plástico', false],
  ['15 01 03', 'Envases de madera', false],
  ['15 01 10', 'Envases que contienen restos de sustancias peligrosas o están contaminados por ellas', true],
  [
    '15 02 02',
    'Absorbentes, materiales de filtración (incluidos los filtros de aceite no especificados en otra categoría), trapos de limpieza y ropas protectoras contaminados por sustancias peligrosas',
    true,
  ],
  ['16 06 04', 'Pilas alcalinas (excepto 16 06 03)', false],
  ['16 06 05', 'Otras pilas y acumuladores', false],
  ['20 01 21', 'Tubos fluorescentes y otros residuos que contienen mercurio', true],
  ['20 03 01', 'Mezclas de residuos municipales', false],
];

describe('lista europea de residuos', () => {
  const hoy = lerVigente('2026-10-16');

  it('el capítulo 17 tiene los 38 códigos con el literal de K-RCD.9', () => {
    const cap17 = [...hoy.values()].filter((c) => c.codigo.startsWith('17'));
    expect(cap17).toHaveLength(38);
    for (const [codigo, descripcion, peligroso] of K_RCD_9_CAP_17) expect(hoy.get(codigo), codigo).toMatchObject({ descripcion, peligroso, rcd: true });
  });

  it('los demás códigos verificados coinciden', () => {
    for (const [codigo, descripcion, peligroso] of K_RCD_9_OTROS) expect(hoy.get(codigo), codigo).toMatchObject({ descripcion, peligroso });
  });

  it('minería y cemento existen, pero no son RCD (aviso)', () => {
    expect(hoy.get('01 04 09')).toMatchObject({ descripcion: 'Residuos de arena y arcillas', rcd: false });
    expect(hoy.get('10 13 99')!.rcd).toBe(false);
    expect(hoy.get('01 04 08')!.aviso).toMatch(/no son RCD/);
  });

  it('la Decisión Delegada 2025/934 cambia las pilas desde el 2026-11-09', () => {
    const antes = lerVigente('2026-11-08');
    const despues = lerVigente('2026-11-09');
    expect(antes.get('16 06 04')!.peligroso).toBe(false);
    expect(despues.get('16 06 04')).toMatchObject({
      peligroso: true,
      descripcion: 'Residuos de pilas y baterías alcalinas (distintos de los especificados en el código 16 06 03)',
    });
    expect(antes.has('16 06 05')).toBe(true);
    for (const c of ['16 06 05', '20 01 33', '20 01 34']) expect(despues.has(c), c).toBe(false);
    // el capítulo 17 no cambia
    expect([...despues.values()].filter((c) => c.codigo.startsWith('17'))).toHaveLength(38);
  });

  it('la cita añade la Decisión Delegada solo si se usan códigos que cambian', () => {
    expect(citaLer('2026-12-01', ['17 01 01'])).toBe(
      'Lista europea de residuos (Decisión 2000/532/CE, en la redacción de la Decisión 2014/955/UE), conforme al art. 6.1 de la Ley 7/2022',
    );
    expect(citaLer('2026-12-01', ['16 06 04'])).toMatch(/y la Decisión Delegada \(UE\) 2025\/934$/);
    expect(citaLer('2026-10-16', ['16 06 04'])).not.toMatch(/2025\/934/);
  });

  it('normaliza lo que llega de un .bc3 o de la IA', () => {
    expect(normalizarLer('170102')).toBe('17 01 02');
    expect(normalizarLer('17 01 02')).toBe('17 01 02');
    expect(normalizarLer('17 06 05*')).toBe('17 06 05');
    expect(normalizarLer('17-01-02')).toBe('17 01 02');
    expect(normalizarLer('ZZ18975')).toBeNull();
    expect(normalizarLer('17 01')).toBeNull();
  });
});

describe('operaciones (Ley 7/2022, anexos II y III)', () => {
  it('literales de K-RCD.8', () => {
    expect(operacion('R0506')!.nombre).toBe('Valorización de residuos inorgánicos para la producción de áridos.');
    expect(operacion('R0508')!.nombre).toBe('Valorización de materiales inorgánicos en operaciones de relleno (backfilling).');
    expect(operacion('R0511')!.nombre).toBe('Preparación para la reutilización de residuos inorgánicos.');
    expect(operacion('R1201')!.nombre).toBe('Clasificación de residuos.');
    expect(operacion('D0501')!.nombre).toBe('Depósito en vertederos de residuos inertes.');
    expect(operacion('D0502')!.nombre).toBe('Depósito en vertederos de residuos no peligrosos.');
    expect(operacion('D0503')!.nombre).toBe('Depósito en vertederos de residuos peligrosos.');
  });

  it('destino por defecto: planta de valorización; amianto a vertedero de peligrosos; otros peligrosos, pendiente', () => {
    expect(destinoPorDefecto('17 01 07', fraccionDe('17 01 07', false)).operacion).toBe('R0506');
    expect(destinoPorDefecto('17 09 04', 'mezcla')).toMatchObject({ operacion: 'R1201', destino: expect.stringMatching(/Planta de valorización/) });
    expect(destinoPorDefecto('17 06 05', 'peligrosos').operacion).toBe('D0503');
    expect(destinoPorDefecto('15 01 10', 'peligrosos').operacion).toBeNull();
    for (const c of ['R0304', 'R0305', 'R0403', 'R0504', 'R0507']) expect(operacion(c), c).toBeDefined();
  });

  it('fracciones', () => {
    expect(fraccionDe('17 01 02', false)).toBe('minerales');
    expect(fraccionDe('15 01 02', false)).toBe('plastico');
    expect(fraccionDe('17 06 05', true)).toBe('peligrosos');
    expect(fraccionDe('17 09 04', false)).toBe('mezcla');
    expect(fraccionDe('17 05 04', false)).toBe('tierras');
  });
});

describe('densidades', () => {
  it('SE-AE anejo C (K-RCD.15): kN/m³ × 0,1 y valor central del intervalo', () => {
    expect(kNaT(12)).toBe(1.2);
    expect(materialSeAe('ladrillo-hueco')).toMatchObject({ kNm3: [12, 12], tPorM3: 1.2, ler: '17 01 02' });
    expect(materialSeAe('mortero-cemento')!.tPorM3).toBe(2.1);
    expect(materialSeAe('mortero-yeso')!.kNm3).toEqual([12, 28]);
    expect(materialSeAe('acero')!.tPorM3).toBe(7.775);
    expect(materialSeAe('hormigon-armado')!.tPorM3).toBe(2.5);
    expect(materialesSeAe().every((m) => m.tPorM3 > 0 && m.kNm3[0] <= m.kNm3[1])).toBe(true);
  });

  it('pesos por m² de las tablas C.4 y C.5', () => {
    expect(pesoSuperficieSeAe('tabique-ladrillo-hueco-45')).toMatchObject({ tPorM2: 0.06, espesor: 0.045 });
    expect(pesoSuperficieSeAe('solado-plaston-8')).toMatchObject({ tPorM2: 0.1, espesor: null });
  });

  it('densidad aparente: la declarada manda; si no, ECO-eficiencia; si no, ninguna', () => {
    expect(densidadAparente('17 01 01')!.tPorM3).toBe(1.5);
    expect(densidadAparente('17 05 04')!.tPorM3).toBe(1.8);
    expect(densidadAparente('17 06 05')).toBeNull();
    expect(densidadAparente('17 06 05', { densidadesAparentes: { '17 06 05': { tPorM3: 1.1, fuente: 'Gestor X' } } })).toEqual({ tPorM3: 1.1, fuente: 'Gestor X' });
  });
});
