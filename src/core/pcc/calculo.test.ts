import { describe, expect, it } from 'vitest';
import { RATES, confirmar, obraA, obraB, partida, type ObraPcc } from '../../test/fixtures/pcc/obras';
import type { RefSource } from '../refdata';
import { calcularPlanCalidad, precioDe, textoPlano } from './calculo';
import { citasVetadasEn } from './citas';
import { tomarPrecios } from './precios';
import type { PlanCalidadDatos } from './tipos';

/* El plan entero desde el presupuesto (docs/plan-control-calidad.md §1–§10), con las dos obras
   inventadas del plan («Casos de prueba»): A, unifamiliar entre medianeras en Málaga; B,
   plurifamiliar de 6 plantas en Toledo. */

const calc = (o: ObraPcc, plan: Partial<PlanCalidadDatos> = {}) =>
  calcularPlanCalidad({ ...o, plan: { ...o.plan, ...plan }, banco: {}, rates: RATES, hoy: '2026-10-26' });
const val = (r: ReturnType<typeof calc>, id: string) => r.valoracion.find((v) => v.ensayo === id);
const otros = (r: ReturnType<typeof calc>, id: string) => r.aCargoDeOtros.find((v) => v.ensayo === id);

describe('obra A · unifamiliar entre medianeras en Málaga', () => {
  const r = calc(obraA());

  it('lotes del Código: 9 amasadas como el ejemplo de D §3.3, más el muro y la escalera', () => {
    expect(r.estructura.grupos.map((g) => [g.clave, g.lotes, g.amasadas])).toEqual([
      ['cim_superficial|HA-25/B/20/XC2', 1, 3],
      ['flexion|HA-25/B/20/XC1', 1, 3],
      ['pilares_muros|HA-25/B/20/XC1', 1, 3],
      ['pilares_muros|HA-30/B/20/XS1', 1, 3],
      ['flexion|HA-25/B/20/IIa', 1, 3],
    ]);
    expect(val(r, 'j03-008')).toMatchObject({ cantidad: 15, unidad: 'amasada', precio: { valor: 59.28, fuente: 'junta', fecha: '2022' }, importe: 88920 });
    expect(val(r, 'j03-009')).toMatchObject({ cantidad: 15, precio: { valor: 17.26 } });
    // K-PCC.53: una obra de hormigón armado no sale sin ensayos de hormigón
    expect(r.avisos.map((a) => a.id)).not.toContain('sinEnsayosHormigon');
  });

  it('la designación con «IIa» cuenta para los lotes y avisa, sin durabilidad (K-PCC.52)', () => {
    expect(r.avisos.some((a) => /«IIa» no es una clase de exposición/.test(a.texto))).toBe(true);
    expect(r.estructura.durabilidad.map((d) => d.dosificacion)).toEqual(['HA-30/B/20/XS1']);
    expect(val(r, 'j03-029')).toMatchObject({ cantidad: 1, precio: { valor: 151.45 } });
    expect(val(r, 'j03-030')).toBeUndefined();
  });

  it('la ferralla de taller por el 59.2: tracciones, geometrías y las 15 unidades (partida propia, precio pedido)', () => {
    expect(val(r, 'j03-085')?.cantidad).toBe(4);
    expect(val(r, 'j03-083')?.cantidad).toBe(8);
    expect(val(r, 'app-dimensiones-ferralla')).toMatchObject({ cantidad: 15, precio: { fuente: 'pendiente' }, importe: null });
    expect(r.totalCompleto).toBe(false);
    expect(r.pendientes.some((p) => p.id === 'precio:app-dimensiones-ferralla')).toBe(true);
  });

  it('las partidas sin control no generan filas (K-PCC.70)', () => {
    expect(r.recepcion.map((b) => b.familia)).toEqual([
      'hormigon-estructural',
      'acero-armar',
      'fabrica-ladrillo',
      'cubierta-plana',
      'saneamiento',
      'fontaneria',
    ]);
    const partidas = r.recepcion.flatMap((b) => b.partidas.map((p) => p.code));
    for (const code of ['03WSS80000', '17RRR00310', '19SIC10004']) expect(partidas).not.toContain(code);
  });

  it('niveles de la Junta (D8): el 1 propuesto, el 2 y el 3 solo si se marcan', () => {
    const fab = r.recepcion.find((b) => b.familia === 'fabrica-ladrillo')!;
    expect(fab.ensayos.filter((f) => f.estado === 'incluido').map((f) => f.ensayo)).toEqual(['j06-026']);
    expect(fab.ensayos.some((f) => f.nivel === 2 && f.estado === 'noMarcado')).toBe(true);
    expect(r.valoracion.every((v) => !/^j06-0(0[7-9]|1[0-4])$/.test(v.ensayo))).toBe(true);
    const marcado = calc(obraA(), { marcados: { 'j06-007': true, 'j06-026': false } });
    expect(val(marcado, 'j06-007')).toBeDefined();
    expect(val(marcado, 'j06-026')).toBeUndefined();
  });

  it('cubierta plana: prueba de estanqueidad propuesta y desmarcable (D9)', () => {
    expect(val(r, 'j08-130')).toMatchObject({ cantidad: 1, precio: { valor: 210 } });
    expect(val(calc(obraA(), { marcados: { 'estanqueidad-cubierta': false } }), 'j08-130')).toBeUndefined();
  });

  it('las pruebas de HS 4 y HS 5 van a cargo del instalador, sin coste; se pueden pasar al laboratorio (D2)', () => {
    expect(otros(r, 'j08-046')).toMatchObject({ quien: 'INST', cantidad: 1 });
    expect(otros(r, 'j08-012')).toMatchObject({ quien: 'INST', cantidad: 1, regla: '1 vivienda × 20 % → 1 prueba' });
    expect(val(r, 'j08-046')).toBeUndefined();
    const lab = calc(obraA(), { aCargo: { 'hs4-presion': 'laboratorio' } });
    expect(val(lab, 'j08-046')).toMatchObject({ cantidad: 1 });
    expect(otros(lab, 'j08-046')).toBeUndefined();
    // los tramos y las bajantes no salen del presupuesto: se piden
    expect(r.pendientes.map((p) => p.texto).join(' ')).toMatch(/Tramos entre arquetas/);
  });

  it('Andalucía: la IT 5 del Decreto 50/2025 obligatoria y valorada; unifamiliar aislada, solo fachada', () => {
    expect(r.comunidad).toBe('andalucia');
    expect(r.obraTerminada.find((o) => o.id === 'it5-acustica')).toMatchObject({ incluida: true, quien: 'LAB', cita: 'Decreto 50/2025, art. 27.3 e IT 5' });
    for (const id of ['j08-126', 'j08-127', 'j08-128']) expect(val(r, id)?.cantidad, id).toBe(1);
    // la acústica «a criterio» del CTE no se duplica en Andalucía
    expect(r.obraTerminada.some((o) => o.id === 'acustica-in-situ')).toBe(false);
    const aislada = calc(obraA(), { aislada: true });
    expect(['j08-126', 'j08-127', 'j08-128'].filter((id) => val(aislada, id))).toEqual(['j08-128']);
  });

  it('marco normativo de Andalucía y del Estado, con el 305/2011 (K-PCC.9)', () => {
    expect(r.marco.join(' · ')).toMatch(/Decreto 67\/2011.*BOJA núm\. 77, de 19-04-2011/);
    expect(r.marco.join(' · ')).toMatch(/Ley 5\/2025.*arts\. 27 y 29/);
    expect(r.marco.join(' · ')).toMatch(/305\/2011/);
    expect(r.marco.join(' · ')).toMatch(/Código Estructural/);
  });

  it('el texto del plan no lleva ninguna cita prohibida (K-PCC.50–52, 65, 71)', () => {
    expect(citasVetadasEn(textoPlano(r))).toEqual([]);
    expect(textoPlano(r)).toMatch(/Reglamento \(UE\) n\.º 305\/2011/);
    expect(citasVetadasEn(textoPlano(calc(obraB())))).toEqual([]);
  });

  it('control de ejecución con la frecuencia en número (K-PCC.63)', () => {
    const fab = r.ejecucion.find((b) => b.familia === 'fabrica-ladrillo')!;
    expect(fab.inspecciones[0]).toMatchObject({ cantidad: 2, cuenta: 'una por planta: 2 plantas' });
    const cub = r.ejecucion.find((b) => b.familia === 'cubierta-plana')!;
    expect(cub.inspecciones[0]).toMatchObject({ cantidad: 2, cuenta: '150 m² / 100 → 2' });
    const h = r.ejecucion.find((b) => b.familia === 'hormigon-estructural')!;
    expect(h.inspecciones.find((i) => i.comprobacion === 'Replanteos')?.cantidad).toBe(12);
  });

  it('con distintivo: el mínimo de 3 lotes y N = 1, sin durabilidad (K-PCC.58)', () => {
    const con = calc(obraA(), { hormigon: { distintivo: 'con' } });
    expect(con.estructura.totales.lotes).toBeGreaterThanOrEqual(3);
    expect(con.estructura.totales.amasadas).toBe(con.estructura.totales.lotes);
    expect(val(con, 'j03-029')).toBeUndefined();
    expect(val(con, 'j03-008')!.cantidad).toBeLessThan(val(r, 'j03-008')!.cantidad);
  });

  it('el % del PEM, como dato, sobre el PEM sin el capítulo de control (Q1)', () => {
    expect(r.porcentaje?.basePem).toBe(r.porcentaje && r.porcentaje.basePem);
    const o = obraA();
    o.chapters.push({ id: 'cc', code: '3', title: 'Control de calidad' });
    o.partidas.cc = [partida('18HHL00010', 'Resistencia a compresión', 'ud', 15, 59.28)];
    const sin = calc(obraA());
    const con = calc(o, { capituloControl: 'cc' });
    expect(con.porcentaje!.basePem).toBe(sin.porcentaje!.basePem);
    expect(con.total).toBe(sin.total);
    // sin enlazarlo, el capítulo sí entra en la base
    expect(calc(o).porcentaje!.basePem).toBeGreaterThan(sin.porcentaje!.basePem);
  });
});

describe('estados de la partida', () => {
  it('una propuesta sin confirmar no cuenta y sale en «Antes de entregar»', () => {
    const o = obraA();
    const p = o.partidas.est![0]!;
    p.pcc = { ...p.pcc!, estado: 'propuesta' };
    const r = calc(o);
    expect(r.sinRevisar).toBe(1);
    expect(r.estructura.grupos.some((g) => g.fila === 'cim_superficial')).toBe(false);
    expect(r.pendientes.some((x) => x.id === 'sinRevisar')).toBe(true);
  });

  it('una confirmada que cambia de título pasa a revisar y sale del cálculo (O6)', () => {
    const o = obraA();
    const p = o.partidas.est![1]!;
    p.title = 'Hormigón para armar HA-30/B/20/XC1 en forjados y losas';
    const r = calc(o);
    expect(r.revisar).toEqual([p.id]);
    expect(r.estructura.grupos.some((g) => g.clave === 'flexion|HA-25/B/20/XC1')).toBe(false);
    // al volver a confirmarla, entra con la nueva designación
    confirmar(p);
    expect(calc(o).estructura.grupos.some((g) => g.clave === 'flexion|HA-30/B/20/XC1')).toBe(true);
  });

  it('presupuesto vacío: sin cantidades y con avisos (K-PCC.66)', () => {
    const r = calcularPlanCalidad({ chapters: [], partidas: {}, banco: {}, rates: RATES, obra: obraA().obra, plan: { version: 1 }, hoy: '2026-10-26' });
    expect(r.valoracion).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.porcentaje).toBeNull();
    expect(r.pendientes.map((p) => p.id)).toContain('sinPartidas');
  });

  it('hormigón sin tipo ni fck legibles: fuera de los lotes, con la designación pendiente (Q2)', () => {
    const o = obraA();
    o.partidas.est!.push(confirmar(partida('03HAZ00099', 'Hormigón HX-2O/B/20/XC2 en zapatas de cimentación', 'm3', 10, 100)));
    const x = o.partidas.est!.at(-1)!;
    expect(x.pcc).toMatchObject({ estado: 'confirmada', familia: 'hormigon-estructural' });
    expect(x.pcc!.hormigon).toBeUndefined();
    const r = calc(o);
    expect(r.pendientes.find((p) => p.id === `designacion:${x.id}`)?.texto).toMatch(/falta la designación del hormigón/);
    expect(r.estructura.grupos.flatMap((g) => g.partidas.map((p) => p.partidaId))).not.toContain(x.id);
  });

  it('hormigón de la estructura confirmado y ninguna amasada → aviso (K-PCC.53)', () => {
    const o = obraA();
    // solo hormigón sin designación legible, o un forjado en m² sin sus m³ por m²: nada que lotificar
    o.partidas = {
      est: [
        confirmar(partida('X1', 'Hormigón para armar en pilares', 'm3', 10, 100)),
        confirmar(partida('05HHL00010', 'Hormigón para armar HA-25/B/20/XC1 en forjados', 'm2', 100, 50), (c) => (c.hormigon!.m3PorUd = null)),
      ],
      res: [],
    };
    const r = calc(o);
    expect(r.estructura.totales.amasadas).toBe(0);
    expect(r.avisos.map((a) => a.id)).toContain('sinEnsayosHormigon');
    expect(calc(obraA()).avisos.map((a) => a.id)).not.toContain('sinEnsayosHormigon');
  });

  it('acero dentro del hormigón y acero aparte: aviso de doble cómputo (O3)', () => {
    const o = obraA();
    o.partidas.est![0]!.pcc!.acero = { tipo: 'barras', kgPorUd: 40 };
    expect(calc(o).avisos.map((a) => a.id)).toContain('dobleComputo');
  });
});

describe('precios (§8, A1)', () => {
  const banco = (precios: Record<string, number>): RefSource => ({
    id: 'bcca',
    kind: 'base',
    name: 'BCCA 2023',
    org: 'Junta de Andalucía',
    chapters: [{ id: '18', code: '18', title: 'Control de calidad' }],
    partidas: {
      '18': Object.entries(precios).map(([code, precio], i) => ({ id: `r${i}`, pos: String(i), code, title: code, ud: 'ud', precio, items: [], desc: `Texto de ${code}` })),
    },
  });

  it('el orden de la fuente: copia del banco, hoja de la Junta, tecleado, pendiente', () => {
    const { precios, faltan } = tomarPrecios(banco({ '18HHL00010': 61.5 }), '2026-10-26', ['j03-008', 'j03-009']);
    expect(precios['j03-008']).toMatchObject({ precio: 61.5, banco: 'BCCA 2023', codigo: '18HHL00010', fecha: '2026-10-26', ud: 'amasada' });
    expect(faltan).toEqual(['j03-009']); // el banco no trae ese código: sigue con la hoja
    const r = calc(obraA(), { precios });
    expect(val(r, 'j03-008')).toMatchObject({ precio: { valor: 61.5, fuente: 'banco', banco: 'BCCA 2023' }, importe: 92250 });
    expect(val(r, 'j03-009')?.precio.fuente).toBe('junta');
    expect(precioDe('app-dimensiones-ferralla', { version: 1, preciosManuales: { 'app-dimensiones-ferralla': 12 } })).toEqual({ valor: 12, fuente: 'manual' });
    expect(precioDe('app-dimensiones-ferralla', { version: 1 }).fuente).toBe('pendiente');
  });

  it('el cálculo no lee bancos: sin copia, el mismo total', () => {
    expect(calc(obraA()).total).toBe(calc(obraA()).total);
    const conManual = calc(obraA(), { preciosManuales: { 'app-dimensiones-ferralla': 10 } });
    expect(conManual.totalCompleto).toBe(true);
    expect(conManual.total).toBe(calc(obraA()).total + 15 * 10 * 100);
  });

  it('un precio compuesto es la suma de sus partidas', () => {
    const { precios } = tomarPrecios(banco({ '18MAA00020': 80, '18MAA00030': 60, '18MAA00040': 50, '18MAA00050': 30 }), '2026-10-26', ['j03-162']);
    expect(precios['j03-162']).toMatchObject({ precio: 220, codigo: '18MAA00020 + 18MAA00030 + 18MAA00040 + 18MAA00050' });
  });

  it('lo que cubre cada precio cambia el número de precios (O4)', () => {
    // la hoja da el precio por punto y pide 10 por ensayo; la BCCA, por ensayo
    expect(precioDe('j10-070', { version: 1 }).cubre).toMatchObject({ porEnsayo: 10 });
    const copia = { ensayo: 'j10-070', codigo: '18BSH00050', precio: 125, ud: 'ensayo', banco: 'BCCA 2023', fecha: '2026-10-26' };
    expect(precioDe('j10-070', { version: 1, precios: { 'j10-070': copia } }).cubre).toMatchObject({ porEnsayo: 1 });
  });

  it('PEM de 299.999 € sin aviso de niveles y de 300.001 € con aviso (D8)', () => {
    const con = (pemEuros: number) => {
      const o = obraA();
      o.partidas.res = [partida('X', 'Partida de ajuste', 'ud', 1, pemEuros)];
      o.partidas.est = [];
      return calc(o).avisos.map((a) => a.id);
    };
    expect(con(299_999)).not.toContain('niveles300k');
    expect(con(300_001)).toContain('niveles300k');
  });
});

describe('obra B · plurifamiliar de 6 plantas en Toledo', () => {
  const r = calc(obraB());

  it('losa de 400 m³ en un elemento → N = 12; forjados y pilares con plantas y superficie', () => {
    expect(r.estructura.grupos.map((g) => [g.fila, g.lotes, g.amasadas])).toEqual([
      ['cim_mayor_200', 1, 12],
      ['flexion', 5, 15],
      ['pilares_muros', 6, 18],
    ]);
    expect(val(r, 'j03-008')?.cantidad).toBe(45);
    const con = calc(obraB(), { hormigon: { distintivo: 'con' } });
    expect(con.estructura.grupos[0]).toMatchObject({ fila: 'cim_mayor_200', amasadas: 4 });
  });

  it('pruebas por porcentaje: 23 viviendas → 5 pruebas en 1 visita (K-PCC.64)', () => {
    expect(otros(r, 'j08-047')).toMatchObject({ cantidad: 1, unidad: 'visita', regla: '23 viviendas × 20 % → 5 pruebas, 5 por visita → 1 visita' });
    expect(otros(r, 'j08-046')).toMatchObject({ cantidad: 5 });
  });

  it('REBT: la inspección inicial por organismo de control, listada sin coste', () => {
    expect(otros(r, 'rebt-oc')).toMatchObject({ quien: 'OC', cantidad: 1 });
    expect(otros(calc(obraB(), { inspeccionInicial: false }), 'rebt-oc')).toBeUndefined();
  });

  it('acero estructural (§5.7): visual y ensayos de soldadura en obra por tipo de cordón, apriete; no el taller', () => {
    for (const id of ['j03-133', 'j03-131', 'j03-158']) expect(val(r, id), id).toBeDefined();
    for (const id of ['j03-125', 'j03-136', 'j03-139', 'j03-150', 'j03-110']) expect(val(r, id), id).toBeUndefined();
    const sinDato = calc(obraB(), { familias: { 'acero-laminado': {} } });
    expect(val(sinDato, 'j03-131')).toBeUndefined();
    expect(val(sinDato, 'j03-158')).toBeDefined();
    expect(sinDato.pendientes.map((p) => p.id)).toContain('dato:acero-laminado:soldadura');
    const aTope = calc(obraB(), { familias: { 'acero-laminado': { soldaduraObra: true, cordones: ['tope'] } } });
    expect(val(aTope, 'j03-136')).toBeDefined();
  });

  it('fuera de Andalucía: sin IT 5; la acústica in situ, a criterio del proyecto', () => {
    expect(r.comunidad).toBe('otra');
    expect(r.obraTerminada.some((o) => o.id === 'it5-acustica')).toBe(false);
    expect(r.obraTerminada.find((o) => o.id === 'acustica-in-situ')).toMatchObject({ incluida: false, oblig: 'P' });
    expect(val(calc(obraB(), { marcados: { 'acustica-in-situ': true } }), 'j08-126')?.cantidad).toBe(3);
    expect(r.marco.join(' ')).not.toMatch(/Decreto 67\/2011|Andalucía/);
  });

  it('el PEM pasa de 300.000 €: aviso de los niveles de la Junta, sin marcar nada (D8)', () => {
    expect(r.avisos.map((a) => a.id)).toContain('niveles300k');
    expect(r.valoracion.every((v) => !/^j03-11\d$/.test(v.ensayo))).toBe(true);
  });

  it('ningún ensayo fraccionario (K-PCC.57) y toda fila con su regla (K-PCC.54)', () => {
    for (const plan of [r, calc(obraA())]) {
      for (const v of plan.valoracion) {
        expect(Number.isInteger(v.cantidad), v.ensayo).toBe(true);
        expect(v.regla, v.ensayo).toBeTruthy();
      }
      for (const b of plan.recepcion) for (const f of b.ensayos) expect(Number.isInteger(f.cantidad), f.ensayo).toBe(true);
    }
  });
});
