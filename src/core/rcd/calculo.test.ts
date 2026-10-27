import { describe, expect, it } from 'vitest';
import type { Obra, Partida } from '../types';
import { calcularEstudioRcd, comunidadDeProvincia, type EntradaRcd } from './calculo';
import { estimarEcoDetallado } from './ecoeficiencia';
import type { EstudioRcdDatos } from './tipos';
import { OBRA_A, OBRA_B, RATES, estudio, estudioB, obraA, partida } from '../../test/fixtures/rcd/obras';

function calculaA(over: Partial<EstudioRcdDatos> = {}) {
  const { chapters, partidas } = obraA();
  const e: EntradaRcd = {
    chapters,
    partidas,
    rates: RATES,
    obra: OBRA_A,
    estudio: estudio({ capituloGestion: 'g', ...over }),
    hoy: '2026-10-16',
  };
  return calcularEstudioRcd(e);
}

describe('A · reforma pequeña por partidas', () => {
  const r = calculaA();
  const fila = (ler: string) => r.porCodigo.find((f) => f.ler === ler);

  it('toneladas por código, sumando partidas y componentes', () => {
    expect(fila('17 01 02')!.t).toBeCloseTo(2.31 + 0.63, 9); // tabique C.4 + bóveda
    expect(fila('17 01 03')!.t).toBeCloseTo(0.346 + 0.06, 3);
    expect(fila('17 01 07')!.t).toBeCloseTo(0.504 + 6.2, 9);
    expect(fila('17 01 01')!.t).toBe(0.788);
    expect(fila('17 02 01')!.t).toBe(0.15);
    expect(fila('17 04 02')!.t).toBe(0.054);
    expect(fila('17 02 02')!.t).toBe(0.045);
    expect(fila('17 04 05')!.t).toBe(0.136);
    expect(fila('17 06 05')!.t).toBe(0.064);
  });

  it('m³ en obra de la geometría y m³ aparentes con la densidad del escombro', () => {
    expect(fila('17 01 02')!.m3EnObra).toBe(2.083); // 1,7325 + 0,35, redondeado a milésimas
    expect(fila('17 01 02')!.m3Aparente).toBeCloseTo((2.31 + 0.63) / 0.9, 3);
    // 17 06 05*: sin densidad aparente → null y pendiente
    expect(fila('17 06 05')!.m3Aparente).toBeNull();
    expect(r.pendientes.some((p) => p.id === 'aparente:17 06 05')).toBe(true);
  });

  it('cada tonelada dice de qué partida sale y con qué cuenta', () => {
    const o = fila('17 01 02')!.origen[0]!;
    expect(o.kind).toBe('partida');
    expect(o.kind === 'partida' && o.formula).toBe('38,5 m² × 0,06 t/m² = 2,31 t');
  });

  it('lo que falta no se rellena: escayola sin densidad, incompleta y pendiente', () => {
    const y = fila('17 08 02')!;
    expect(y.t).toBe(0);
    expect(y.incompleta).toBe(true);
    expect(r.pendientes.find((p) => p.id.startsWith('falta:') && p.ler === '17 08 02')!.texto).toMatch(/falta densidad/);
    // sin toneladas no se piden aún sus m³ de contenedor
    expect(r.pendientes.some((p) => p.id === 'aparente:17 08 02')).toBe(false);
  });

  it('la propuesta sin revisar, el transporte y la tabiquería nueva no suman', () => {
    expect(fila('17 01 03')!.origen.every((o) => o.kind !== 'partida' || o.code !== 'DT13')).toBe(true);
    expect(r.pendientes.find((p) => p.id === 'sin-revisar')!.texto).toMatch(/^1 partida/);
    expect(r.porCodigo.some((f) => f.origen.some((o) => o.kind === 'partida' && (o.code === 'DT09' || o.code === 'TB01')))).toBe(false);
  });

  it('separación: las seis fracciones sin umbral; peligrosos aparte con la frase andaluza', () => {
    const sep = new Map(r.separacion.map((s) => [s.fraccion, s]));
    for (const fr of ['minerales', 'madera', 'metales', 'vidrio', 'yeso'] as const) {
      expect(sep.get(fr)!.obligatoria).toBe(true);
      expect(sep.get(fr)!.cita).toBe('Ley 7/2022, art. 30.2');
    }
    expect(sep.get('peligrosos')!.cita).toBe('Decreto 73/2012, art. 88.1 a)');
  });

  it('inventario de peligrosos en obra existente, con su elemento', () => {
    expect(r.alcance.inventario).toBe(true);
    expect(r.inventario).toHaveLength(1);
    expect(r.inventario[0]).toMatchObject({ ler: '17 06 05', t: 0.064 });
    expect(r.inventario[0]!.elemento).toContain('DT08');
  });

  it('destino por defecto: planta para minerales, vertedero de peligrosos para el amianto', () => {
    const d = new Map(r.destinos.map((x) => [x.ler, x]));
    expect(d.get('17 01 07')).toMatchObject({ operacion: 'R0506', porDefecto: true });
    expect(d.get('17 06 05')!.operacion).toBe('D0503');
    expect(r.avisos.some((a) => a.id.startsWith('vertedero:'))).toBe(false);
    expect(r.pendientes.some((p) => p.id.startsWith('gestor:'))).toBe(false);
  });

  it('7.º es el capítulo enlazado de gestión, que no genera residuo', () => {
    expect(r.coste.modo).toBe('capitulo');
    expect(r.coste.importe).toBe(47600);
    expect(r.coste.capitulo!.title).toBe('Gestión de residuos');
    expect(r.coste.partidas.map((p) => p.code)).toEqual(['G01', 'G02', 'G03']);
  });

  it('fianza: base del estudio y mínimo andaluz del 2 % sobre las demoliciones, por confirmar', () => {
    expect(r.fianza.baseEstudio).toBe(47600);
    const m = r.fianza.minimoAndalucia!;
    expect(m.reparto.map((x) => x.supuesto)).toEqual(['derribo']);
    expect(m.importe).toBe(Math.round(m.reparto[0]!.base * 0.02));
    expect(r.pendientes.map((p) => p.id)).toEqual(expect.arrayContaining(['fianza', 'fianza-reparto', 'ordenanza']));
  });

  it('proyecto básico: sin 5.º ni 6.º, con inventario', () => {
    const b = calculaA({ fase: 'basico' });
    expect(b.alcance.apartados).toEqual(['1', '2', '3', '4', '7']);
    expect(b.alcance.inventario).toBe(true);
    expect(b.pendientes.some((p) => p.id === 'plano')).toBe(false);
  });

  it('ejecución sin plano indicado: no queda pendiente (va el de emplazamiento)', () => {
    expect(calculaA({ fase: 'ejecucion', plano: null }).pendientes.some((p) => p.id === 'plano')).toBe(false);
  });

  it('sin capítulo de gestión ni precios: el coste queda pendiente', () => {
    const s = calculaA({ capituloGestion: null });
    expect(s.coste.modo).toBe('pendiente');
    expect(s.pendientes.some((p) => p.id.startsWith('precio:'))).toBe(true);
  });

  it('vertedero directo de un no peligroso en Andalucía: aviso del art. 86.2', () => {
    const v = calculaA({ destinos: { '17 01 07': { operacion: 'D0501' } } });
    expect(v.avisos.find((a) => a.id === 'vertedero:17 01 07')!.texto).toMatch(/art\. 86\.2/);
  });

  it('obra existente sin el dato de amianto: pendiente', () => {
    const s = calculaA({ amianto: null });
    expect(s.pendientes.some((p) => p.id === 'amianto')).toBe(true);
  });
});

/* ---- B · obra nueva unifamiliar ------------------------------------------- */
describe('B · obra nueva unifamiliar por ratios', () => {
  const opciones = {
    tipologia: 'unifamiliarExento',
    plantas: '2-3',
    cimentacion: 'zapatas',
    estructuraVertical: 'hormigonArmado',
    estructuraHorizontal: 'unidireccionalBovedillaCeramica',
    cubierta: 'planaAndaluza',
    fachada: 'ceramicaRevestida',
    pavimento: 'baldosaCeramica',
  };
  function calculaB(extra: Partida[] = [], over: Partial<EstudioRcdDatos> = {}, obra: Partial<Obra> = {}) {
    const vaciado = partida('ADE01', 'Vaciado hasta 2 m con medios mecánicos', 'm³', 95, 12, {
      estado: 'confirmada',
      origen: { tipo: 'manual', motivo: 'test' },
      componentes: [{ ler: '17 05 04', tipo: 'excavacion', conversion: { modo: 'volumen' }, densidad: { tPorM3: 1.9 } }],
    });
    const estructura = partida('EHS01', 'Pilar de hormigón armado', 'm³', 20, 300);
    return calcularEstudioRcd({
      chapters: [{ id: 'c', code: '1', title: 'Obra' }],
      partidas: { c: [vaciado, estructura, ...extra] },
      rates: RATES,
      obra: { denominacion: 'Unifamiliar B', direccion: '', localidad: '', provincia: 'Málaga', superficieConstruida: 180, ...obra },
      estudio: estudio({
        tipos: ['nueva'],
        amianto: null,
        tierrasReutilizadas: { m3: 30, destino: 'Relleno del trasdós de muros de la propia obra' },
        ratios: { metodo: 'ecoeficiencia', nivel: 'detallado', superficieSolar: 400, superficieOcupacion: 110, opciones, incluirTierras: true },
        ...over,
      }),
      hoy: '2026-10-16',
    });
  }
  const r = calculaB();
  const eco = estimarEcoDetallado({ superficieConstruida: 180, opciones, incluirTierras: false });

  it('los residuos de construcción salen de ECO-eficiencia, código a código', () => {
    const envases = eco.find((f) => f.ler === '15 01 03')!;
    expect(r.porCodigo.find((f) => f.ler === '15 01 03')!.t).toBeCloseTo(envases.t, 3);
    expect(r.version.ratios).toBe('ecoeficiencia-2013');
    expect(r.porCodigo.find((f) => f.ler === '15 01 03')!.origen[0]!.kind).toBe('ratio');
  });

  it('con partida de excavación, las tierras salen de ella y no de los ratios', () => {
    const t = r.porCodigo.find((f) => f.ler === '17 05 04')!;
    // 95 m³ × 1,9 t/m³, menos 30 m³ reutilizados en obra (RD 105/2008 art. 3.1 a)
    expect(t.t).toBeCloseTo(65 * 1.9, 3);
    expect(t.origen.filter((o) => o.kind === 'ratio' && o.fuente.startsWith('Herramienta'))).toHaveLength(0);
    expect(r.avisos.some((a) => a.id === 'ratios-tierras')).toBe(true);
  });

  it('obra nueva: sin inventario de peligrosos ni dato de amianto', () => {
    expect(r.alcance.inventario).toBe(false);
    expect(r.pendientes.some((p) => p.id === 'amianto')).toBe(false);
  });

  it('fianza mínima: 1 % de obra nueva y 2 % de la excavación', () => {
    const m = r.fianza.minimoAndalucia!;
    expect(m.reparto.map((x) => [x.supuesto, x.pct])).toEqual([
      ['excavacion', 2],
      ['nueva', 1],
    ]);
    expect(m.reparto.find((x) => x.supuesto === 'excavacion')!.base).toBe(95 * 12 * 100);
  });

  it('D9: un código que trae el banco por partidas no recibe ratio', () => {
    const banco = partida('EHS02', 'Losa de hormigón (con ~R de CYPE)', 'm²', 100, 50, {
      estado: 'confirmada',
      origen: { tipo: 'banco', ref: 'CYPE', motivo: '~R' },
      componentes: [{ ler: '17 01 01', tipo: 'colocacion', conversion: { modo: 'directo', tPorUd: 0.005, m3PorUd: 0.0033, m3Base: 'aparente' } }],
    });
    const b = calculaB([banco]);
    const h = b.porCodigo.find((f) => f.ler === '17 01 01')!;
    expect(h.t).toBeCloseTo(0.5, 9);
    expect(h.origen.every((o) => o.kind === 'partida')).toBe(true);
    expect(b.avisos.find((a) => a.id === 'ratios-bloqueados')!.texto).toContain('17 01 01');
  });

  it('ECO-eficiencia usa 10 13 99 para la cal: aviso de código fuera de los RCD', () => {
    expect(r.avisos.some((a) => a.id === 'fuera-rcd:10 13 99')).toBe(true);
  });

  it('sin superficie construida en la ficha no aplica ratios y lo pide', () => {
    const s = calculaB([], {}, { superficieConstruida: null });
    expect(s.pendientes.some((p) => p.id === 'superficie')).toBe(true);
    expect(s.version.ratios).toBeNull();
  });

  it('TD2: con las plantas en la ficha, el tramo sale de ellas; sin ellas, el elegido en residuos', () => {
    const t = (x: ReturnType<typeof calculaB>) => x.porCodigo.find((f) => f.ler === '15 01 03')!.t;
    const cinco = estimarEcoDetallado({ superficieConstruida: 180, opciones: { ...opciones, plantas: '4-5' }, incluirTierras: false });
    expect(t(calculaB([], {}, { plantasSobreRasante: 5 }))).toBeCloseTo(cinco.find((f) => f.ler === '15 01 03')!.t, 3);
    expect(t(calculaB([], {}, { plantasSobreRasante: 3 }))).toBeCloseTo(t(r), 9);
    expect(t(calculaB([], {}, { plantasSobreRasante: 5 }))).not.toBeCloseTo(t(r), 3);
  });

  it('TD2: la superficie y las plantas bajo rasante salen de la ficha', () => {
    const t = (x: ReturnType<typeof calculaB>) => x.porCodigo.find((f) => f.ler === '15 01 03')!.t;
    expect(t(calculaB([], {}, { superficieConstruida: 360 }))).toBeCloseTo(2 * t(r), 6);
    // Sin partida de excavación, las tierras del vaciado del sótano salen de la ocupación y las plantas bajo rasante.
    const tierras = (obra: Partial<Obra>) =>
      calcularEstudioRcd({ chapters: [{ id: 'c', code: '1', title: 'Obra' }], partidas: { c: [] }, rates: RATES, obra: { ...OBRA_B, ...obra }, estudio: estudioB(), hoy: '2026-10-16' })
        .porCodigo.find((f) => f.ler === '17 05 04')!.t;
    expect(tierras({ plantasBajoRasante: 1 })).toBeGreaterThan(tierras({}));
  });

  it('TD2: nivel básico, el tramo de la hoja sale de las plantas de la ficha', () => {
    const basico = (plantasBasico: string, obra: Partial<Obra> = {}) =>
      calculaB([], { ratios: { metodo: 'ecoeficiencia', nivel: 'basico', tipoBasico: 'nuevaResidencial', plantasBasico, incluirTierras: true } }, obra)
        .porCodigo.find((f) => f.ler === '15 01 03')!.t;
    expect(basico('1', { plantasSobreRasante: 6 })).toBeCloseTo(basico('>4'), 9);
    expect(basico('>4', { plantasSobreRasante: 1 })).toBeCloseTo(basico('1'), 9);
    expect(basico('1')).not.toBeCloseTo(basico('>4'), 6);
  });
});

describe('fecha y comunidad', () => {
  it('provincia → comunidad', () => {
    expect(comunidadDeProvincia('Málaga')).toBe('andalucia');
    expect(comunidadDeProvincia('MALAGA')).toBe('andalucia');
    expect(comunidadDeProvincia('Madrid')).toBe('otra');
    expect(comunidadDeProvincia('')).toBeNull();
  });

  it('obra fuera de Andalucía: sin mínimo de fianza andaluz y con la autonómica pendiente', () => {
    const r = calculaA({ comunidad: 'otra' });
    expect(r.fianza.minimoAndalucia).toBeNull();
    expect(r.pendientes.some((p) => p.id === 'autonomica')).toBe(true);
    expect(r.separacion.find((s) => s.fraccion === 'peligrosos')!.cita).toBe('Ley 7/2022, art. 30.1');
  });

  it('inicio de obra después del cambio de pilas: aviso solo si se usan esos códigos', () => {
    const sin = calculaA({ inicioPrevisto: '2027-02-01' });
    expect(sin.avisos.some((a) => a.id.startsWith('ler-cambio'))).toBe(false);
  });
});
