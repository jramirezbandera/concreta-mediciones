/* Obras de prueba INVENTADAS para el estudio de residuos (plan §«Casos de
   prueba»): nada de obras reales. Las usan los tests del cálculo, del
   documento y del Word. */
import type { Chapter, Obra, Partida, PartidasMap, Rates } from '../../../core/types';
import type { ComponenteRcd, EstudioRcdDatos, ResiduoPartida } from '../../../core/rcd/tipos';

export const RATES: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };

let seq = 0;
export function partida(code: string, title: string, ud: string, cantidad: number, precio: number, rcd?: ResiduoPartida, sub?: string): Partida {
  seq += 1;
  return { id: `p${seq}`, sub, pos: String(seq), code, title, ud, precio, cantidad, desc: '', med: [], items: [], rcd };
}
export const conf = (...componentes: ComponenteRcd[]): ResiduoPartida => ({ estado: 'confirmada', origen: { tipo: 'manual', motivo: 'test' }, componentes });
export const demol = (ler: string, conversion: ComponenteRcd['conversion'], extra: Partial<ComponenteRcd> = {}): ComponenteRcd => ({
  ler,
  tipo: 'demolicion',
  conversion,
  ...extra,
});

export function estudio(over: Partial<EstudioRcdDatos> = {}): EstudioRcdDatos {
  return {
    version: 1,
    fase: 'ejecucion',
    fecha: '2026-10-16',
    tipos: ['reforma'],
    comunidad: null,
    amianto: 'identificado',
    separacion: 'enObra',
    plantaMovil: false,
    destinos: {},
    precios: {},
    capituloGestion: null,
    fianza: null,
    ordenanza: null,
    plano: 'Plano 12. Instalaciones de residuos',
    redactor: { nombre: 'Técnica de prueba', titulacion: 'Arquitecta', colegiado: '0000' },
    ratios: null,
    ...over,
  };
}

/* ---- A · reforma pequeña de vivienda -------------------------------------- */
export function obraA(): { chapters: Chapter[]; partidas: PartidasMap } {
  const ps: Partida[] = [
    partida('DT01', 'Demolición de tabique de ladrillo hueco sencillo de 45 mm, sin transporte', 'm²', 38.5, 8,
      conf(demol('17 01 02', { modo: 'pesoSuperficie', tPorM2: 0.06, espesor: 0.045 }))),
    partida('DT02', 'Picado de alicatado con su mortero', 'm²', 24, 6,
      conf(demol('17 01 03', { modo: 'espesor', espesor: 0.008 }, { densidad: { tPorM3: 1.8 } }),
        demol('17 01 07', { modo: 'espesor', espesor: 0.01 }, { densidad: { tPorM3: 2.1 } }))),
    partida('DT03', 'Levantado de solado cerámico sobre plastón', 'm²', 62, 7,
      conf(demol('17 01 07', { modo: 'pesoSuperficie', tPorM2: 0.1, espesor: 0.05 }))),
    partida('DT04', 'Desmontaje de falso techo de escayola', 'm²', 15, 5,
      conf(demol('17 08 02', { modo: 'espesor', espesor: 0.02 }, { densidad: { tPorM3: null } }))),
    partida('DT05', 'Desmontaje de puerta de paso de madera', 'ud', 6, 20, conf(demol('17 02 01', { modo: 'pesoUnidad', kgPorUd: 25, m3PorUd: null }))),
    partida('DT06', 'Desmontaje de ventana de aluminio con vidrio', 'ud', 3, 30,
      conf(demol('17 04 02', { modo: 'pesoUnidad', kgPorUd: 18, m3PorUd: null }), demol('17 02 02', { modo: 'pesoUnidad', kgPorUd: 15, m3PorUd: null }))),
    partida('DT07', 'Levantado de inodoro y lavabo', 'ud', 2, 25,
      conf(demol('17 01 03', { modo: 'pesoUnidad', kgPorUd: 30, m3PorUd: null }, { reutilizable: true }))),
    partida('DT08', 'Desmontaje de bajante de fibrocemento', 'm', 8, 40, conf(demol('17 06 05', { modo: 'pesoUnidad', kgPorUd: 8, m3PorUd: null }))),
    partida('DT09', 'Transporte de escombros a vertedero', 'm³', 12, 15, { estado: 'noGenera', origen: { tipo: 'regla', motivo: 'transporte' }, componentes: [] }),
    partida('DT10', 'Demolición de bóveda tabicada de escalera', 'm²', 7, 60,
      conf(demol('17 01 02', { modo: 'espesor', espesor: 0.05 }, { densidad: { tPorM3: 1.8, ref: 'se-ae-2009-04:ladrillo-macizo' } }))),
    partida('DT11', 'Demolición de solera de hormigón armado < 15 cm, incluso transporte', 'm²', 2.1, 25,
      conf(demol('17 01 01', { modo: 'espesor', espesor: 0.15 }, { densidad: { tPorM3: 2.5 } }))),
    partida('DT12', 'Levantado de barandilla metálica para reutilizar', 'm', 11.35, 20,
      conf(demol('17 04 05', { modo: 'pesoUnidad', kgPorUd: 12, m3PorUd: null }, { reutilizable: true }))),
    partida('TB01', 'Tabiquería de placa de yeso laminado', 'm²', 30, 35),
    partida('DT13', 'Levantado de rodapié cerámico', 'm', 40, 2,
      { estado: 'propuesta', origen: { tipo: 'regla', motivo: 'rodapié' }, componentes: [demol('17 01 03', { modo: 'pesoUnidad', kgPorUd: 1, m3PorUd: null })] }),
  ];
  const gs: Partida[] = [
    partida('G01', 'Retirada de residuos mixtos a planta de valorización', 'm³', 10, 30),
    partida('G02', 'Retirada de residuos metálicos', 't', 0.3, 120),
    partida('G03', 'Retirada de amianto por empresa inscrita en el RERA', 'kg', 70, 2),
  ];
  return {
    chapters: [
      { id: 'd', code: '1', title: 'Demoliciones' },
      { id: 'g', code: '2', title: 'Gestión de residuos' },
    ],
    partidas: { d: ps, g: gs },
  };
}


export const OBRA_A: Obra = { denominacion: 'Reforma A', direccion: '', localidad: 'Málaga', provincia: 'Málaga' };

/** B · obra nueva unifamiliar: vaciado medido y estructura, ratios ECO-eficiencia. */
export const OPCIONES_B = {
  tipologia: 'unifamiliarExento',
  plantas: '2-3',
  cimentacion: 'zapatas',
  estructuraVertical: 'hormigonArmado',
  estructuraHorizontal: 'unidireccionalBovedillaCeramica',
  cubierta: 'planaAndaluza',
  fachada: 'ceramicaRevestida',
  pavimento: 'baldosaCeramica',
};
export function obraB(extra: Partida[] = []): { chapters: Chapter[]; partidas: PartidasMap } {
  const vaciado = partida('ADE01', 'Vaciado hasta 2 m con medios mecánicos', 'm³', 95, 12, {
    estado: 'confirmada',
    origen: { tipo: 'manual', motivo: 'test' },
    componentes: [{ ler: '17 05 04', tipo: 'excavacion', conversion: { modo: 'volumen' }, densidad: { tPorM3: 1.9 } }],
  });
  const estructura = partida('EHS01', 'Pilar de hormigón armado', 'm³', 20, 300);
  return { chapters: [{ id: 'c', code: '1', title: 'Obra' }], partidas: { c: [vaciado, estructura, ...extra] } };
}
export const OBRA_B: Obra = { denominacion: 'Unifamiliar B', direccion: '', localidad: '', provincia: 'Málaga' };
export function estudioB(over: Partial<EstudioRcdDatos> = {}): EstudioRcdDatos {
  return estudio({
    tipos: ['nueva'],
    amianto: null,
    tierrasReutilizadas: { m3: 30, destino: 'Relleno del trasdós de muros de la propia obra' },
    ratios: { metodo: 'ecoeficiencia', nivel: 'detallado', superficieConstruida: 180, superficieSolar: 400, superficieOcupacion: 110, opciones: OPCIONES_B, incluirTierras: true },
    ...over,
  });
}
