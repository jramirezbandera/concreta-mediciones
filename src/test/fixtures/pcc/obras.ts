/* Obras de prueba INVENTADAS para el plan de control de calidad (plan §«Casos de
   prueba»): nada de obras reales. Cada partida pasa por las reglas y se confirma,
   como haría el técnico; lo que la regla no puede saber (el tipo de elemento de
   una partida ambigua, el elemento mayor de una losa) se completa a mano. */
import { estadoTrasConfirmar, huellaDe, proponerControl } from '../../../core/pcc/reglas';
import type { ControlPartida, PlanCalidadDatos } from '../../../core/pcc/tipos';
import type { Chapter, Obra, Partida, PartidasMap, Rates } from '../../../core/types';

export const RATES: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };

let seq = 0;
export function partida(code: string, title: string, ud: string, cantidad: number, precio: number, desc = ''): Partida {
  seq += 1;
  return { id: `q${seq}`, pos: String(seq), code, title, ud, precio, cantidad, desc, med: [], items: [] };
}

/** Propone el control con las reglas y lo confirma, con su huella. `ajuste` completa lo que falte. */
export function confirmar(p: Partida, ajuste: (c: ControlPartida) => void = () => {}): Partida {
  const c = proponerControl(p);
  if (!c) throw new Error(`Ninguna regla reconoce ${p.code} ${p.title}`);
  ajuste(c);
  p.pcc = { ...c, estado: estadoTrasConfirmar(c), huella: huellaDe(p) };
  return p;
}

export interface ObraPcc {
  chapters: Chapter[];
  partidas: PartidasMap;
  obra: Obra;
  plan: PlanCalidadDatos;
}

const obraBase = (provincia: string): Obra => ({ denominacion: 'Obra de prueba', direccion: 'Calle Inventada 1', localidad: 'X', provincia }) as Obra;

/* ---- A · Unifamiliar entre medianeras (Málaga, 2 plantas, 300 m², BCCA) ---- */
export function obraA(): ObraPcc {
  const estructura: Partida[] = [
    confirmar(partida('03HAZ00010', 'Hormigón HA-25/B/20/XC2 en zapatas de cimentación', 'm3', 40, 110)),
    confirmar(partida('05HHL00010', 'Hormigón para armar HA-25/B/20/XC1 en forjados y losas', 'm3', 45, 120)),
    confirmar(partida('05HHP00010', 'Hormigón para armar HA-25/B/20/XC1 en pilares', 'm3', 5, 130)),
    confirmar(partida('03HAM00010', 'Hormigón HA-30/B/20/XS1 en muro de sótano', 'm3', 18, 125)),
    confirmar(partida('05HHE00010', 'Hormigón HA-25/B/20/IIa en losa de escalera', 'm3', 3, 140)),
    confirmar(partida('A01', 'Ferralla elaborada en taller B 500 S, Ø8, Ø10, Ø12 y Ø16', 'kg', 6500, 1.3)),
    confirmar(partida('03WSS80000', 'Capa de hormigón de limpieza HM-20/B/20/X0', 'm3', 4, 70)),
  ];
  const resto: Partida[] = [
    confirmar(partida('06LMM00101', 'Fábrica de ladrillo cara vista de 1/2 pie', 'm2', 220, 45)),
    confirmar(partida('07HNF00021', 'Cubierta plana invertida no transitable', 'm2', 150, 60)),
    confirmar(partida('04EC010', 'Colector enterrado de saneamiento de PVC de 160 mm', 'm', 60, 30)),
    confirmar(partida('08FCC00010', 'Instalación de fontanería de la vivienda', 'ud', 1, 3000)),
    confirmar(partida('17RRR00310', 'Gestión de residuos de construcción y demolición', 'm3', 20, 30)),
    confirmar(partida('19SIC10004', 'Seguridad y salud', 'ud', 1, 1500)),
  ];
  return {
    chapters: [
      { id: 'est', code: '1', title: 'Cimentación y estructura' },
      { id: 'res', code: '2', title: 'Resto de la obra' },
    ],
    partidas: { est: estructura, res: resto },
    obra: { ...obraBase('Málaga'), superficieConstruida: 300, plantasSobreRasante: 2 },
    plan: {
      version: 1,
      fecha: '2026-10-26',
      uso: 'vivienda',
      unifamiliar: true,
      aislada: false,
      grupos: { 'cim_superficial|HA-25/B/20/XC2': { semanas: 1, superficie: 150, elementos: 12 } },
      dosificaciones: { 'HA-30/B/20/XS1': { meses: 4 } },
      acero: { procedencia: 'taller', enderezado: true, soldadura: 'no' },
      zonaSismica: false,
    },
  };
}

/* ---- B · Plurifamiliar de 6 plantas (Toledo, 23 viviendas) ---- */
export function obraB(): ObraPcc {
  const ps: Partida[] = [
    confirmar(partida('03HAL00010', 'Hormigón HA-30/B/20/XC2 en losa de cimentación', 'm3', 400, 115), (c) => {
      c.hormigon!.elementoMayorM3 = 400;
    }),
    confirmar(partida('05HHL00020', 'Hormigón para armar HA-25/B/20/XC1 en forjados', 'm3', 450, 120)),
    confirmar(partida('05HHP00020', 'Hormigón para armar HA-25/B/20/XC1 en pilares y muros', 'm3', 120, 130)),
    confirmar(partida('05HAC00015', 'Acero en barras corrugadas tipo B500S, Ø8 a Ø20', 'kg', 70000, 1.2)),
    confirmar(partida('05ACJ00010', 'Acero S275JR en perfiles laminados de la estructura de cubierta', 'kg', 12000, 2.1)),
    confirmar(partida('08FCC00020', 'Instalación de fontanería de las viviendas', 'ud', 23, 2500)),
    confirmar(partida('08ECC00102', 'Instalación eléctrica de las viviendas', 'ud', 23, 2200)),
    confirmar(partida('08KTT00010', 'Infraestructura común de telecomunicaciones', 'ud', 1, 9000)),
  ];
  return {
    chapters: [{ id: 'b', code: '1', title: 'Obra' }],
    partidas: { b: ps },
    obra: { ...obraBase('Toledo'), superficieConstruida: 3000, plantasSobreRasante: 6 },
    plan: {
      version: 1,
      fecha: '2026-10-26',
      uso: 'vivienda',
      viviendas: 23,
      inspeccionInicial: true,
      zonaSismica: false,
      acero: { procedencia: 'taller', enderezado: false, soldadura: 'no' },
      familias: { 'acero-laminado': { tipos: 1, soldaduraObra: true, cordones: ['angulo'] } },
    },
  };
}
