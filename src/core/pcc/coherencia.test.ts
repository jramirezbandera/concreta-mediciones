import { describe, expect, it } from 'vitest';
import { RATES, obraA, partida, type ObraPcc } from '../../test/fixtures/pcc/obras';
import { proponerResiduo } from '../rcd/reglas';
import type { Partida, Rates } from '../types';
import { calcularPlanCalidad } from './calculo';
import { partidasControl } from './capitulo';
import { proponerControl } from './reglas';
import type { PlanCalidad, PlanCalidadDatos } from './tipos';

/* El capítulo de control frente a la valoración (docs/plan-control-calidad.md §9, A2, O1a, O1b):
   «Crear capítulo» con partidas propias marcadas con su ensayo, coherencia por ensayo, código y
   texto, K y CI, y el aviso de plan pobre. */

const calc = (o: ObraPcc, rates: Rates = RATES, plan: Partial<PlanCalidadDatos> = {}) =>
  calcularPlanCalidad({ ...o, plan: { ...o.plan, ...plan }, banco: {}, rates, hoy: '2026-10-26' });
const ids = (r: PlanCalidad) => r.avisos.map((a) => a.id).filter((id) => /^(capitulo|planPobre)/.test(id));

/** La obra con el capítulo que crearía «Crear capítulo» (como `crearCapituloControl`). */
function conCapitulo(o: ObraPcc, r: PlanCalidad, cambia: (ps: Partida[]) => void = () => {}): ObraPcc {
  const ps = partidasControl(r.valoracion, o.plan).partidas.map((x, i) => ({
    ...partida(x.codigoBanco ?? `C${String(i + 1).padStart(2, '0')}`, x.title, x.ud, x.cantidad, x.precio, x.desc),
    pcc: { estado: 'capituloControl' as const, origen: { tipo: 'manual' as const, motivo: 'Creada desde la valoración del plan' }, ensayo: x.ensayo },
  }));
  cambia(ps);
  return {
    ...o,
    chapters: [...o.chapters, { id: 'cc', code: '3', title: 'Control de calidad' }],
    partidas: { ...o.partidas, cc: ps },
    plan: { ...o.plan, capituloControl: 'cc' },
  };
}

describe('capítulo de control', () => {
  const o = obraA();
  const r = calc(o);

  it('sin capítulo enlazado, «Antes de entregar» lo pide', () => {
    expect(r.capitulo).toBeNull();
    expect(r.pendientes.map((p) => p.id)).toContain('capitulo');
  });

  it('«Crear capítulo»: una partida por fila, con la cantidad de precios y el precio de la fila; cuadra sin avisos', () => {
    const { partidas, sinPrecio } = partidasControl(r.valoracion, o.plan);
    expect(partidas).toHaveLength(r.valoracion.length);
    const compresion = partidas.find((x) => x.ensayo === 'j03-008')!;
    expect(compresion).toMatchObject({ cantidad: 15, precio: 59.28, ud: 'amasada', codigoBanco: null });
    expect(compresion.desc).toMatch(/Cantidad del plan de control de calidad: /);
    expect(sinPrecio).toEqual(r.valoracion.filter((v) => v.precio.valor == null).map((v) => v.ensayo));

    const r2 = calc(conCapitulo(o, r));
    expect(r2.capitulo).toMatchObject({ code: '3', title: 'Control de calidad', kci: false, propuestas: [] });
    expect(r2.capitulo!.partidas.every((x) => x.como === 'ensayo')).toBe(true);
    expect(r2.capitulo!.importe).toBe(r.total);
    expect(ids(r2)).toEqual([]);
    expect(r2.pendientes.map((p) => p.id)).not.toContain('capitulo');
    // Las partidas del capítulo no generan control: la valoración no cambia.
    expect(r2.total).toBe(r.total);
  });

  it('el % no cambia al crear el capítulo, tampoco con CI = 3 % (D10, O1b)', () => {
    expect(calc(conCapitulo(o, r)).porcentaje).toEqual(r.porcentaje);
    const ci = { ...RATES, ci: 0.03 };
    const antes = calc(o, ci);
    expect(calc(conCapitulo(o, antes), ci).porcentaje).toEqual(antes.porcentaje);
  });

  it('casa por su ensayo aunque cambie el título', () => {
    const r2 = calc(conCapitulo(o, r, (ps) => (ps[0]!.title = 'Otro nombre cualquiera')));
    expect(r2.capitulo!.partidas[0]).toMatchObject({ ensayo: r.valoracion[0]!.ensayo, como: 'ensayo' });
    expect(ids(r2)).toEqual([]);
  });

  it('precio o cantidad cambiados a mano → diferencia; quitar una partida → ensayo sin partida', () => {
    const e = r.valoracion[0]!.ensayo;
    const r2 = calc(
      conCapitulo(o, r, (ps) => {
        ps[0]!.precio = (ps[0]!.precio ?? 0) + 5;
        ps[1]!.cantidad = (ps[1]!.cantidad ?? 0) + 1;
        ps.pop();
      }),
    );
    expect(ids(r2)).toEqual(
      expect.arrayContaining([`capitulo:precio:${e}`, `capitulo:cantidad:${r.valoracion[1]!.ensayo}`, `capitulo:sinPartida:${r.valoracion.at(-1)!.ensayo}`]),
    );
  });

  it('dos ensayos con el mismo importe no se cruzan: una partida sin marca ni código casa no casa por importe', () => {
    const v = r.valoracion[0]!;
    const r2 = calc(
      conCapitulo(o, r, (ps) => {
        ps.splice(0, 1);
        ps.push(partida('ZZ1', 'Partida sin relación', 'ud', v.precios, v.precio.valor!));
      }),
    );
    const zz = r2.capitulo!.partidas.find((x) => x.code === 'ZZ1')!;
    expect(zz.ensayo).toBeNull();
    expect(ids(r2)).toEqual(expect.arrayContaining([`capitulo:sinEnsayo:${zz.partidaId}`, `capitulo:sinPartida:${v.ensayo}`]));
  });

  it('por el código del banco del enlace, y por el texto solo como propuesta', () => {
    const r2 = calc(
      conCapitulo(o, r, (ps) => {
        const i = ps.findIndex((x) => x.pcc!.ensayo === 'j03-008');
        ps[i] = partida('18HHL00010', 'Resistencia a compresión', 'ud', ps[i]!.cantidad ?? 0, ps[i]!.precio ?? 0);
        const j = ps.findIndex((x) => x.pcc?.ensayo === 'j03-009');
        ps[j] = partida('X1', r.valoracion.find((v) => v.ensayo === 'j03-009')!.descripcion, 'ud', ps[j]!.cantidad ?? 0, ps[j]!.precio ?? 0);
      }),
    );
    const cap = r2.capitulo!;
    expect(cap.partidas.find((x) => x.code === '18HHL00010')).toMatchObject({ ensayo: 'j03-008', como: 'codigo' });
    const x1 = cap.partidas.find((x) => x.code === 'X1')!;
    expect(x1.ensayo).toBeNull();
    expect(cap.propuestas).toEqual([expect.objectContaining({ partidaId: x1.partidaId, ensayo: 'j03-009' })]);
  });

  it('K = 0,9 y CI = 3 % → aviso con las dos cifras (O1a)', () => {
    for (const rates of [
      { ...RATES, coefK: 0.9 },
      { ...RATES, ci: 0.03 },
    ]) {
      const base = calc(o, rates);
      const r2 = calc(conCapitulo(o, base), rates);
      expect(r2.capitulo!.kci).toBe(true);
      const aviso = r2.avisos.find((a) => a.id === 'capitulo:kci')!;
      expect(aviso.texto).toMatch(/aporta .* al PEM .* valoración del plan es de/);
      expect(r2.capitulo!.aportePem).not.toBe(r2.total);
    }
    const k = calc(conCapitulo(o, calc(o, { ...RATES, coefK: 0.9 })), { ...RATES, coefK: 0.9 });
    expect(k.capitulo!.aportePem).toBe(k.capitulo!.importe);
    expect(Math.abs(k.capitulo!.importe - Math.round(k.total * 0.9))).toBeLessThan(k.capitulo!.partidas.length);
  });

  it('plan pobre: un capítulo por debajo del nivel 1 de las familias presentes avisa con las dos cifras', () => {
    const pobre = calc(conCapitulo(o, r, (ps) => ps.splice(1)));
    const a = pobre.avisos.find((x) => x.id === 'planPobre');
    expect(a?.texto).toMatch(/queda por debajo/);
    expect(pobre.capitulo!.minimoNivel1).toBeGreaterThan(0);
    expect(calc(conCapitulo(o, r)).avisos.map((x) => x.id)).not.toContain('planPobre');
  });

  it('el ~T del banco va al capítulo si no cita normas vetadas; si las cita, el texto propio', () => {
    const plan: PlanCalidadDatos = {
      ...o.plan,
      precios: {
        'j03-008': { ensayo: 'j03-008', codigo: '18HHR00010', precio: 60, ud: 'amasada', banco: 'BCCA', fecha: '2026-10-26', texto: 'Ensayo de compresión según UNE-EN 12390-3.' },
        'j03-009': { ensayo: 'j03-009', codigo: '18HHL00020', precio: 17, ud: 'amasada', banco: 'BCCA', fecha: '2026-10-26', texto: 'Consistencia según EHE-08.' },
      },
    };
    const rb = calc({ ...o, plan });
    const { partidas, textoPropio } = partidasControl(rb.valoracion, plan);
    expect(partidas.find((x) => x.ensayo === 'j03-008')).toMatchObject({ codigoBanco: '18HHR00010', desc: 'Ensayo de compresión según UNE-EN 12390-3.' });
    expect(partidas.find((x) => x.ensayo === 'j03-009')!.desc).not.toMatch(/EHE/);
    expect(textoPropio).toEqual(['j03-009']);
  });

  it('las partidas del capítulo 18 de la BCCA no disparan control ni residuo', () => {
    for (const p of [
      partida('18HHR00010', 'Ensayo de resistencia a compresión de hormigón, con 2 probetas', 'ud', 3, 59),
      partida('18ALF00010', 'Análisis granulométrico de suelos', 'ud', 1, 40),
      partida('18HHL00020', 'Consistencia del hormigón por el cono de Abrams', 'ud', 3, 17),
    ]) {
      expect(proponerControl(p, { enCapituloControl: true })?.estado).toBe('capituloControl');
      expect(proponerResiduo(p)).toBeNull();
    }
  });
});
