import { describe, expect, it } from 'vitest';
import { OBRA_A, RATES, estudio, obraA, partida } from '../../test/fixtures/rcd/obras';
import { calcularEstudioRcd } from './calculo';
import { capacidadContenedor, queGestiona } from './coherencia';
import { textoDe } from './reglas';

function calculaA(over: Parameters<typeof estudio>[0] = {}, extraGestion: ReturnType<typeof partida>[] = []) {
  const { chapters, partidas } = obraA();
  partidas.g!.push(...extraGestion);
  return calcularEstudioRcd({ chapters, partidas, rates: RATES, obra: OBRA_A, estudio: estudio({ capituloGestion: 'g', ...over }), hoy: '2026-10-16' });
}
const ids = (r: ReturnType<typeof calculaA>) => r.avisos.map((a) => a.id);

describe('coherencia del 7.º con la estimación', () => {
  it('qué gestiona cada partida, por su título', () => {
    expect(queGestiona({ title: 'Retirada de residuos mixtos a planta de valorización', desc: '' })).toEqual({ mixtos: true });
    expect(queGestiona({ title: 'Transporte de tierras con contenedor + canon', desc: '' })).toEqual({ grupos: ['tierras'] });
    expect(queGestiona({ title: 'RCDs Naturaleza no pétrea', desc: '' })).toEqual({ grupos: ['noPetrea'] });
    expect(queGestiona({ title: 'Retirada de residuos metálicos', desc: '' })!.codigos).toContain('17 04 05');
    expect(queGestiona({ title: 'Retirada de amianto por empresa inscrita en el RERA', desc: '' })).toEqual({ grupos: ['peligrosos'] });
    expect(queGestiona({ title: 'Clasificación de residuos de la construcción', desc: '' })).toBeNull();
  });

  it('capacidad del contenedor en el texto', () => {
    expect(capacidadContenedor(textoDe({ title: 'Transporte con contenedor de 7 m³', desc: '' }))).toBe(7);
    expect(capacidadContenedor('contenedor 3 m3')).toBe(3);
    expect(capacidadContenedor('con contenedor + canon')).toBeNull();
  });

  it('reforma A: los metales no cuadran (0,30 t frente a 0,19 t); los mixtos y el amianto sí', () => {
    const r = calculaA();
    const metales = r.avisos.filter((a) => a.id.startsWith('cuadre-t:'));
    expect(metales).toHaveLength(1);
    expect(metales[0]!.texto).toBe('«Retirada de residuos metálicos»: el presupuesto gestiona 0,3 t y el estudio estima 0,19 t.');
    expect(ids(r).some((i) => i.startsWith('cuadre-m3:'))).toBe(false);
    expect(ids(r)).not.toContain('sin-gestion');
  });

  it('una demolición que ya incluye el transporte: posible doble cobro', () => {
    expect(calculaA().avisos.find((a) => a.id === 'doble-cobro')!.texto).toContain('DT11');
  });

  it('demoliciones sin transporte y sin capítulo de gestión: aviso', () => {
    expect(ids(calculaA({ capituloGestion: null }))).toContain('sin-transporte');
  });

  it('contenedores sin capacidad: no se comparan y se avisa', () => {
    const r = calculaA({}, [partida('G04', 'Transporte de residuos inertes con contenedor + canon', 'Ud', 2, 150)]);
    expect(ids(r).some((i) => i.startsWith('contenedor:'))).toBe(true);
  });

  it('partidas que dicen «a vertedero» (Andalucía, art. 86)', () => {
    const { chapters, partidas } = obraA();
    partidas.d![0]!.title = 'Demolición de tabique de ladrillo hueco, carga y transporte a vertedero';
    const r = calcularEstudioRcd({ chapters, partidas, rates: RATES, obra: OBRA_A, estudio: estudio({ capituloGestion: 'g' }), hoy: '2026-10-16' });
    expect(r.avisos.find((a) => a.id === 'texto-vertedero')!.texto).toContain('DT01');
  });
});
