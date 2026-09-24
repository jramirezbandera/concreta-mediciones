import { describe, expect, it } from 'vitest';
import { formaDeUd, medColumnas, medFormaDe, pesoDesdeComentario } from './medForma';
import type { MedLine } from './types';

const ml = (o: Partial<MedLine>): MedLine => ({
  id: '',
  comment: '',
  uds: '',
  largo: '',
  ancho: '',
  alto: '',
  ...o,
});

const labels = (forma: Parameters<typeof medColumnas>[0], med: MedLine[] = []) =>
  medColumnas(forma, med).map((c) => c.label);

describe('formaDeUd', () => {
  it('deduce la forma de las unidades habituales', () => {
    expect(formaDeUd('Ud')).toBe('ud');
    expect(formaDeUd('pa')).toBe('ud');
    expect(formaDeUd('m')).toBe('lin');
    expect(formaDeUd('m²')).toBe('sup');
    expect(formaDeUd('M2')).toBe('sup');
    expect(formaDeUd('kg')).toBe('peso');
    expect(formaDeUd('m³')).toBe('vol');
  });

  it('una unidad desconocida enseña las cuatro columnas de siempre', () => {
    expect(formaDeUd('h')).toBe('vol');
    expect(formaDeUd('')).toBe('vol');
  });
});

describe('medFormaDe', () => {
  it('la forma elegida a mano manda sobre la de la unidad', () => {
    expect(medFormaDe({ ud: 'm²' })).toBe('sup');
    expect(medFormaDe({ ud: 'm²', medForma: 'area' })).toBe('area');
  });
});

describe('medColumnas', () => {
  it('rotula un prefijo de las casillas uds·largo·ancho·alto', () => {
    expect(labels('ud')).toEqual(['Uds']);
    expect(labels('area')).toEqual(['Uds', 'Superficie']);
    expect(labels('areaEsp')).toEqual(['Uds', 'Superficie', 'Espesor']);
    expect(labels('vol')).toEqual(['Uds', 'Longitud', 'Anchura', 'Altura']);
    // La superficie se guarda en `largo`: es lo que viaja en el ~M del .bc3.
    expect(medColumnas('area', []).map((c) => c.slot)).toEqual(['uds', 'largo']);
  });

  it('enseña una casilla con datos aunque la forma no la use (y la marca)', () => {
    const cols = medColumnas('area', [ml({ uds: 1, largo: 5 }), ml({ largo: 2, alto: 3 })]);
    expect(cols.map((c) => c.label)).toEqual(['Uds', 'Superficie', 'Anchura', 'Altura']);
    expect(cols.map((c) => c.fuera)).toEqual([false, false, true, true]);
  });

  it('un 0 cuenta como dato (anula la línea), un vacío no', () => {
    expect(labels('ud', [ml({ uds: 2, largo: 0 })])).toEqual(['Uds', 'Longitud']);
    expect(labels('ud', [ml({ uds: 2, largo: '' })])).toEqual(['Uds']);
  });
});

describe('pesoDesdeComentario', () => {
  it('en «Peso», el perfil del comentario va a la columna kg/m (casilla ancho)', () => {
    expect(pesoDesdeComentario('peso', ml({ comment: 'Vigas IPE300' }))).toEqual({
      slot: 'ancho',
      value: 42.2,
      expr: 'IPE 300',
    });
  });

  it('fuera de una forma con kg/m no toca nada', () => {
    expect(pesoDesdeComentario('vol', ml({ comment: 'IPE300' }))).toBeNull();
    expect(pesoDesdeComentario('lin', ml({ comment: 'IPE300' }))).toBeNull();
  });

  it('respeta un kg/m tecleado a mano (número u operación)', () => {
    expect(pesoDesdeComentario('peso', ml({ comment: 'IPE300', ancho: 45 }))).toBeNull();
    expect(
      pesoDesdeComentario('peso', ml({ comment: 'IPE300', ancho: 44.31, expr: { ancho: 'IPE300*1,05' } })),
    ).toBeNull();
  });

  it('si el kg/m salió de un perfil, sigue al comentario', () => {
    const l = ml({ comment: 'Vigas IPE 330', ancho: 42.2, expr: { ancho: 'IPE 300' } });
    expect(pesoDesdeComentario('peso', l)).toEqual({ slot: 'ancho', value: 49.1, expr: 'IPE 330' });
    // Ya al día → nada que hacer.
    expect(pesoDesdeComentario('peso', { ...l, comment: 'IPE 300' })).toBeNull();
  });
});
