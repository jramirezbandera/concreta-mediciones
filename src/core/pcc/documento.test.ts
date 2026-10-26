import { describe, expect, it } from 'vitest';
import { RATES, obraA, obraB, type ObraPcc } from '../../test/fixtures/pcc/obras';
import { textoPlano } from '../documento/tipos';
import { calcularPlanCalidad } from './calculo';
import { partidasControl } from './capitulo';
import { citasVetadasEn } from './citas';
import { documentoPcc } from './documento';
import { diferenciasEmitido, emitidoDe } from './emitido';
import type { PlanCalidadDatos } from './tipos';

/* El texto del plan (docs/plan-control-calidad.md §12, «Tests · Texto» y «Emitido»). */

const META = { denominacion: 'Obra de prueba', localidad: 'Málaga', promotor: 'Promotora de prueba', constructora: '' };
const calc = (o: ObraPcc, plan: Partial<PlanCalidadDatos> = {}, rates = RATES) =>
  calcularPlanCalidad({ ...o, plan: { ...o.plan, ...plan }, banco: {}, rates, hoy: '2026-10-26' });
const doc = (o: ObraPcc, plan: Partial<PlanCalidadDatos> = {}) => documentoPcc(calc(o, plan), { ...o.plan, ...plan }, META);
const texto = (o: ObraPcc, plan: Partial<PlanCalidadDatos> = {}) => textoPlano(doc(o, plan));

describe('Word del plan: el texto', () => {
  it('sin citas prohibidas (K-PCC.50–52) y con el Reglamento (UE) 305/2011', () => {
    for (const o of [obraA(), obraB()]) {
      const t = textoPlano(doc(o));
      expect(citasVetadasEn(t)).toEqual([]);
      expect(t).toMatch(/Reglamento \(UE\) n\.º 305\/2011/);
    }
  });

  it('sin marcadores de plantilla ni otra comunidad (K-PCC.65, K-PCC.71)', () => {
    for (const o of [obraA(), obraB()]) {
      const t = textoPlano(doc(o));
      expect(t).not.toMatch(/\bXX+\b|A rellenar|……|\.\.\.\.|actuación como laboratorio|Comunidad de Madrid/i);
    }
  });

  it('tres partes siempre (K-PCC.69), también sin partidas confirmadas', () => {
    const vacia: ObraPcc = { ...obraA(), partidas: { est: [], res: [] } };
    for (const o of [obraA(), vacia]) {
      const ids = doc(o).secciones.map((s) => s.id);
      expect(ids).toEqual(expect.arrayContaining(['recepcion', 'ejecucion', 'obraTerminada', 'valoracion']));
    }
    expect(doc(obraA()).secciones.map((s) => s.id)).toContain('estructura');
  });

  it('el texto y la valoración dicen lo mismo (K-PCC.61)', () => {
    const o = obraA();
    const r = calc(o);
    const d = documentoPcc(r, o.plan, META);
    const val = textoPlano({ titulo: '', secciones: d.secciones.filter((s) => s.id === 'valoracion') });
    const resto = textoPlano({ titulo: '', secciones: d.secciones.filter((s) => s.id === 'recepcion' || s.id === 'obraTerminada') });
    for (const v of r.valoracion) {
      expect(val).toContain(v.descripcion);
      expect(resto).toContain(v.descripcion);
    }
    // lo que paga otro agente sale sin coste, diciéndolo
    expect(r.aCargoDeOtros.length).toBeGreaterThan(0);
    for (const f of r.aCargoDeOtros) expect(val).toContain(`${f.descripcion}: `);
    expect(val).toMatch(/Sin coste en esta valoración/);
  });

  it('Andalucía: laboratorios del Registro andaluz y acreditación de la Ley 5/2025; otra comunidad, pendiente', () => {
    const t = texto(obraA());
    expect(t).toMatch(/Registro de laboratorios de ensayos y de entidades de control de calidad de la construcción y obra pública de Andalucía/);
    expect(t).toMatch(/Ley 5\/2025, de Vivienda de Andalucía, art\. 29/);
    expect(t).toMatch(/Decreto 67\/2011, art\. 3\.1/);
    const otra = texto(obraA(), { comunidad: 'otra' });
    expect(otra).not.toMatch(/Decreto 67\/2011/);
    expect(otra).toMatch(/Pendiente: normativa autonómica/);
    expect(otra).toMatch(/RD 410\/2010/);
  });

  it('criterio de aceptación del hormigón según el distintivo (K-PCC.28)', () => {
    expect(texto(obraA())).toMatch(/f\(x₁\) = x₁·Kₙ ≥ fck/);
    expect(texto(obraA(), { hormigon: { distintivo: 'con' } })).toMatch(/xᵢ ≥ fck/);
  });

  it('sin capítulo enlazado lo dice pendiente; con capítulo, su importe y, con K, lo que aporta al PEM', () => {
    const o = obraA();
    expect(texto(o)).toMatch(/Pendiente: capítulo del presupuesto que recoge la valoración/);
    const rates = { ...RATES, coefK: 0.9 };
    const r = calc(o, {}, rates);
    const ps = partidasControl(r.valoracion, o.plan).partidas.map((x, i) => ({
      id: `cc${i}`, pos: String(i), code: `C${i}`, title: x.title, ud: x.ud, precio: x.precio, cantidad: x.cantidad, desc: x.desc, med: [], items: [],
      pcc: { estado: 'capituloControl' as const, origen: { tipo: 'manual' as const, motivo: '' }, ensayo: x.ensayo },
    }));
    const conCap: ObraPcc = { ...o, chapters: [...o.chapters, { id: 'cc', code: '3', title: 'Control de calidad' }], partidas: { ...o.partidas, cc: ps }, plan: { ...o.plan, capituloControl: 'cc' } };
    const r2 = calc(conCap, {}, rates);
    const t = textoPlano(documentoPcc(r2, conCap.plan, META));
    expect(t).toMatch(/en el capítulo 3 «Control de calidad», por/);
    expect(t).toMatch(/el capítulo aporta .* al presupuesto de ejecución material/);
  });

  it('firma del técnico redactor, o ninguna', () => {
    expect(doc(obraA()).firma).toBeNull();
    expect(doc(obraA(), { redactor: { nombre: 'Ana Ruiz', titulacion: 'Arquitecta técnica', colegiado: '123' } }).firma).toEqual({ nombre: 'Ana Ruiz', sub: 'Arquitecta técnica · Col. 123' });
  });
});

describe('lo emitido (O5)', () => {
  it('sin cambios, sin aviso', () => {
    const o = obraA();
    const r = calc(o);
    const r2 = calc(o, { emitido: emitidoDe(r, '2026-10-26') });
    expect(r2.emitido).toEqual([]);
    expect(r2.avisos.map((a) => a.id)).not.toContain('emitido');
  });

  it('cambia el presupuesto o el precio → aviso con las filas que cambian', () => {
    const o = obraA();
    const emitido = emitidoDe(calc(o), '2026-10-20');
    o.partidas.est![0]!.cantidad = 400; // zapatas: de 40 a 400 m³
    const r = calc(o, { emitido, preciosManuales: {}, precios: { 'j03-009': { ensayo: 'j03-009', codigo: 'X', precio: 20, ud: 'amasada', banco: 'BCCA', fecha: '2026-10-26' } } });
    expect(r.avisos.find((a) => a.id === 'emitido')?.texto).toMatch(/desde el Word del 2026-10-20/);
    expect(r.emitido.some((x) => x.ensayo === 'j03-008' && /→/.test(x.texto))).toBe(true);
    expect(r.emitido.some((x) => x.ensayo === 'j03-009' && /precio 17,26 € → 20,00 €/.test(x.texto))).toBe(true);
    expect(r.emitido.some((x) => x.ensayo == null && /^Total/.test(x.texto))).toBe(true);
  });

  it('una tabla de la app cambiada que cambia la valoración lo dice', () => {
    const r = calc(obraA());
    const e = emitidoDe(r, '2026-10-20');
    const viejo = { ...e, version: { ...e.version, catalogo: 'junta-PCC-V03' }, filas: e.filas.map((f, i) => (i === 0 ? { ...f, cantidad: f.cantidad - 1 } : f)) };
    const dif = diferenciasEmitido(r, viejo);
    expect(dif.some((x) => /catalogo \(junta-PCC-V03 → /.test(x.texto))).toBe(true);
  });
});
