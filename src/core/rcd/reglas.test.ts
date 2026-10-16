import { describe, expect, it } from 'vitest';
import { espesorDe, proponerResiduo, textoDe, transporteDe } from './reglas';

const p = (code: string, title: string, ud: string, desc = '') => ({ code, title, ud, desc });
const lers = (r: ReturnType<typeof proponerResiduo>) => r?.componentes.map((c) => c.ler);

describe('reglas: demoliciones', () => {
  it('BCCA: tabique de ladrillo hueco sencillo → SE-AE C.4 (0,60 kN/m², 45 mm)', () => {
    const r = proponerResiduo(p('01ADS00001', 'DEMOLICIÓN DE TABIQUE DE L/ HUECO SENCILLO, C. MANUAL, T. VERT.', 'm2'))!;
    expect(r.estado).toBe('propuesta');
    expect(r.componentes[0]).toMatchObject({ ler: '17 01 02', tipo: 'demolicion', conversion: { modo: 'pesoSuperficie', tPorM2: 0.06, espesor: 0.045 } });
    expect(r.transporte).toBe('incluido');
  });

  it('BCCA: muro de ladrillo hueco en m³ → volumen × 1,2 t/m³', () => {
    const r = proponerResiduo(p('01ALH00006', 'DEMOLICIÓN DE MURO DE L/H M. MANUALES T. CONTENEDOR', 'm3'))!;
    expect(r.componentes[0]).toMatchObject({ ler: '17 01 02', conversion: { modo: 'volumen' }, densidad: { tPorM3: 1.2 } });
  });

  it('el código del capítulo de demoliciones basta aunque el título no tenga verbo (Precio Centro)', () => {
    const r = proponerResiduo(p('E01DCC020', 'COBERTURA TEJA CERÁMICA CURVA C/RECUPERACIÓN', 'm2'))!;
    expect(r.componentes[0]).toMatchObject({ ler: '17 01 03', reutilizable: true });
  });

  it('CYPE: pavimento cerámico; «carga sobre camión o contenedor» = transporte aparte', () => {
    const r = proponerResiduo(
      p('DRS020', 'Demolición de pavimento cerámico.', 'm²', 'Demolición de pavimento existente de baldosas cerámicas, con martillo neumático, y carga manual sobre camión o contenedor.'),
    )!;
    expect(lers(r)).toEqual(['17 01 03']);
    expect(r.transporte).toBe('excluido');
  });

  it('solado sobre plastón → SE-AE C.5 (1,0 kN/m², agarre incluido)', () => {
    const r = proponerResiduo(p('X1', 'Levantado de solado cerámico sobre plastón de mortero', 'm²'))!;
    expect(r.componentes[0]).toMatchObject({ ler: '17 01 07', conversion: { modo: 'pesoSuperficie', tPorM2: 0.1 } });
  });

  it('solera de hormigón armado con su espesor en la descripción', () => {
    const r = proponerResiduo(p('X2', 'Demolición de solera de hormigón armado de 15 cm de espesor', 'm²'))!;
    expect(r.componentes[0]).toMatchObject({ ler: '17 01 01', conversion: { modo: 'espesor', espesor: 0.15 }, densidad: { tPorM3: 2.5 } });
  });

  it('enlucido de yeso: mortero de yeso del SE-AE; escayola: sin densidad (fuera del SE-AE)', () => {
    expect(proponerResiduo(p('X3', 'Picado de enlucido de yeso', 'm²'))!.componentes[0]).toMatchObject({ ler: '17 08 02', densidad: { tPorM3: 2 } });
    expect(proponerResiduo(p('X4', 'Desmontaje de falso techo de escayola', 'm²'))!.componentes[0]).toMatchObject({ ler: '17 08 02', densidad: { tPorM3: null } });
  });

  it('carpintería de aluminio con vidrio: dos componentes, peso por unidad pendiente', () => {
    const r = proponerResiduo(p('X5', 'Levantado de carpintería de aluminio con vidrio', 'ud'))!;
    expect(lers(r)).toEqual(['17 04 02', '17 02 02']);
    expect(r.componentes[0]!.conversion).toEqual({ modo: 'pesoUnidad', kgPorUd: null, m3PorUd: null });
  });

  it('fibrocemento → amianto (17 06 05*)', () => {
    expect(lers(proponerResiduo(p('X6', 'Desmontaje de bajante de fibrocemento', 'm')))).toEqual(['17 06 05']);
  });

  it('sanitarios: reutilizables (Ley 7/2022 art. 30.2)', () => {
    expect(proponerResiduo(p('X7', 'Levantado de inodoro y lavabo', 'ud'))!.componentes[0]).toMatchObject({ ler: '17 01 03', reutilizable: true });
  });
});

describe('reglas: lo que no genera o no es suyo', () => {
  it('transporte de escombros: propuesta sin componentes (no genera)', () => {
    const r = proponerResiduo(p('X8', 'Transporte de escombros a vertedero', 'm³'))!;
    expect(r.componentes).toEqual([]);
    expect(r.origen.ref).toBe('transporte');
  });

  it('desmontaje y reposición: no genera', () => {
    expect(proponerResiduo(p('AVY_BA', 'Desmontaje y reposición de fontanería y mecanismos de baño.', 'ud'))!.origen.ref).toBe('reposicion');
  });

  it('excavación en m³ → 17 05 04, densidad de la tierra pendiente', () => {
    const r = proponerResiduo(p('ADE010', 'Excavación de zanjas en terreno compacto', 'm³'))!;
    expect(r.componentes[0]).toMatchObject({ ler: '17 05 04', tipo: 'excavacion', conversion: { modo: 'volumen' }, densidad: { tPorM3: null } });
  });

  it('obra nueva sin verbo de demolición: sin propuesta', () => {
    expect(proponerResiduo(p('FFQ010', 'Tabique de ladrillo cerámico hueco doble', 'm²'))).toBeNull();
  });

  it('partida del capítulo de gestión enlazado → gestion; fuera de él, sin propuesta', () => {
    const g = p('GRA010', 'Transporte de residuos inertes con contenedor + canon', 'Ud');
    expect(proponerResiduo(g, true)!.estado).toBe('gestion');
    expect(proponerResiduo(g)).toBeNull();
  });
});

describe('lectura del texto', () => {
  it('espesor de la descripción', () => {
    expect(espesorDe(textoDe({ title: 'Tabique de 7 cm', desc: '' }))).toBe(0.07);
    expect(espesorDe('solera e=15 cm')).toBe(0.15);
    expect(espesorDe('tabique de 45 mm de espesor')).toBe(0.045);
    expect(espesorDe('solera < 15 cm')).toBe(0.15);
    expect(espesorDe('puerta de paso')).toBeNull();
  });

  it('transporte incluido, excluido o sin decir', () => {
    expect(transporteDe('demolicion incluso carga y transporte a vertedero')).toBe('incluido');
    expect(transporteDe('demolicion de tabique, t. vert.')).toBe('incluido');
    expect(transporteDe('demolicion sin transporte')).toBe('excluido');
    expect(transporteDe('carga manual sobre camion o contenedor')).toBe('excluido');
    expect(transporteDe('demolicion de tabique')).toBe('noDice');
  });
});
