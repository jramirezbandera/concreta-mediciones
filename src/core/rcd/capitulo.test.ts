import { describe, expect, it } from 'vitest';
import type { Partida } from '../types';
import { partidasGestion } from './capitulo';
import { coherencia } from './coherencia';
import { estudioVacio } from './datos';
import type { EstudioRcd, FilaCodigo, FilaFraccion } from './tipos';

const fila = (ler: string, fraccion: FilaCodigo['fraccion'], t: number, m3Aparente: number | null, peligroso = false): FilaCodigo => ({
  ler,
  descripcion: `Residuo ${ler}`,
  peligroso,
  fraccion,
  t,
  m3Aparente,
  m3EnObra: null,
  origen: [],
  incompleta: false,
});
const sep = (fraccion: FilaFraccion['fraccion'], obligatoria: boolean): FilaFraccion => ({ fraccion, nombre: fraccion, t: 0, obligatoria, motivo: '', cita: '' });

const R: Pick<EstudioRcd, 'porCodigo' | 'separacion'> = {
  porCodigo: [
    fila('17 01 02', 'minerales', 3.6, 3.27),
    fila('17 01 07', 'minerales', 5, 4.1),
    fila('17 04 02', 'metales', 0.15, 0.08),
    fila('17 06 05', 'peligrosos', 0.4, 0.5, true),
    fila('17 05 04', 'tierras', 20, 12.5),
    fila('20 01 01', 'papelCarton', 0.1, 0.4),
    fila('17 08 02', 'yeso', 0, 0), // no sale en el capítulo
  ],
  separacion: [sep('minerales', true), sep('metales', true), sep('peligrosos', true), sep('papelCarton', false), sep('tierras', false)],
};
const datos = estudioVacio({ precios: { '17 01 02': { eurPorT: 12 } } });

describe('capítulo de gestión propuesto desde la estimación', () => {
  const { partidas, sinM3 } = partidasGestion(R, datos, 7);
  const titulo = (re: RegExp) => partidas.find((p) => re.test(p.title))!;

  it('cada fracción separada, sus contenedores: m³ aparentes ÷ capacidad, por arriba', () => {
    const min = titulo(/^Transporte de fracciones minerales/);
    expect(min).toMatchObject({ ud: 'Ud', cantidad: 2, precio: 0, gestiona: { codigos: ['17 01 02', '17 01 07'], capacidadContenedorM3: 7 } });
    expect(min.title).toMatch(/contenedor de 7 m³/);
    expect(min.desc).toMatch(/7,37 m³ aparentes/);
    expect(titulo(/^Transporte de metales/).cantidad).toBe(1); // 0,08 m³: un contenedor
  });

  it('lo que no hay que separar va junto; la entrega va por código, en t, a su precio', () => {
    expect(titulo(/^Transporte de resto de residuos no peligrosos/).gestiona.codigos).toEqual(['20 01 01']);
    expect(titulo(/^Entrega a gestor autorizado: Residuo 17 01 02/)).toMatchObject({ ud: 't', cantidad: 3.6, precio: 12 });
    expect(titulo(/^Entrega a gestor autorizado: Residuo 17 01 07/).precio).toBe(0);
  });

  it('tierras en m³, peligrosos aparte (el amianto por empresa RERA), y nada de lo que no pesa', () => {
    expect(titulo(/^Transporte de tierras/)).toMatchObject({ ud: 'm3', cantidad: 12.5 });
    expect(titulo(/amianto/)).toMatchObject({ ud: 't', cantidad: 0.4 });
    expect(titulo(/amianto/).title).toMatch(/17 06 05\*.*RERA/);
    expect(partidas.some((p) => p.gestiona.codigos?.includes('17 08 02'))).toBe(false);
    expect(sinM3).toEqual([]);
  });

  it('con la separación en un gestor externo, un solo grupo de no peligrosos', () => {
    const t = partidasGestion(R, { ...datos, separacion: 'gestorExterno' }, 9).partidas.filter((p) => p.ud === 'Ud');
    expect(t).toHaveLength(1);
    expect(t[0]!).toMatchObject({ cantidad: 1, gestiona: { codigos: ['17 01 02', '17 01 07', '17 04 02', '20 01 01'] } });
  });

  it('sin m³ aparentes no se inventan contenedores: 0 y se dice', () => {
    const r = { ...R, porCodigo: [fila('17 01 02', 'minerales', 3, null)] };
    const out = partidasGestion(r, datos, 7);
    expect(out.partidas[0]!.cantidad).toBe(0);
    expect(out.sinM3).toEqual(['fracciones minerales (hormigón, ladrillos, azulejos, cerámica y piedra)']);
  });

  it('el capítulo creado cuadra con la estimación: redondear contenedores no es un descuadre', () => {
    const gestion: Partida[] = partidas.map((x, i) => ({
      id: `g${i}`, pos: `${i}`, code: `G${i}`, title: x.title, ud: x.ud, precio: x.precio, cantidad: x.cantidad, desc: x.desc, med: [], items: [],
      rcd: { estado: 'gestion', origen: { tipo: 'manual', motivo: '' }, componentes: [], gestiona: x.gestiona },
    }));
    const avisos = coherencia({ gestion, generan: [], porCodigo: R.porCodigo, andalucia: true, hayCapitulo: true });
    expect(avisos).toEqual([]);
  });
});
