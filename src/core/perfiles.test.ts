import { describe, expect, it } from 'vitest';
import { BARRAS, PERFILES, leerPerfil, nombrePerfil } from './perfiles';

describe('catálogo de perfiles', () => {
  // Dos fuentes que tienen que coincidir: el peso del prontuario y el área del
  // catálogo de Concreta EST por 0,785 kg/m·cm² (acero 7850 kg/m³). Una errata
  // al copiar cualquiera de las dos columnas rompe esto.
  it('cada peso cuadra con su área (A · 0,785) a menos del 1 %', () => {
    for (const [serie, filas] of Object.entries(PERFILES)) {
      for (const [talla, area, kgm] of filas) {
        const desvio = Math.abs(area * 0.785 - kgm) / kgm;
        expect(desvio, `${serie} ${talla}`).toBeLessThan(0.01);
      }
    }
  });

  it('las barras pesan π·Ø²/4 · 7850 kg/m³', () => {
    for (const [d, kgm] of BARRAS) {
      const teorico = ((Math.PI * d * d) / 4) * 0.00785;
      expect(Math.abs(teorico - kgm) / kgm, `Ø${d}`).toBeLessThan(0.01);
    }
  });

  it('las tallas van en orden creciente y sin repetir', () => {
    for (const filas of Object.values(PERFILES)) {
      const tallas = filas.map(([t]) => t);
      expect(tallas).toEqual([...new Set(tallas)].sort((a, b) => a - b));
    }
  });
});

describe('leerPerfil', () => {
  it('lee serie y talla con o sin espacio, sin distinguir mayúsculas', () => {
    expect(leerPerfil('IPE 300')).toEqual({ kgm: 42.2, nombre: 'IPE 300', len: 7 });
    expect(leerPerfil('heb200')).toEqual({ kgm: 61.3, nombre: 'HEB 200', len: 6 });
    expect(leerPerfil('UPN 100*2')).toEqual({ kgm: 10.6, nombre: 'UPN 100', len: 7 });
  });

  it('lee barras con Ø y con D (la Ø no está en el teclado)', () => {
    expect(leerPerfil('Ø12')?.kgm).toBe(0.888);
    expect(leerPerfil('d16')?.nombre).toBe('Ø16');
  });

  it('una talla que no está en el catálogo no se inventa', () => {
    expect(leerPerfil('IPE 310')).toBeNull();
    expect(leerPerfil('UPN 320')).toBeNull(); // fuera a propósito: dato dudoso en la fuente
    expect(leerPerfil('Ø13')).toBeNull();
  });
});

describe('nombrePerfil', () => {
  it('solo si TODA la cadena es un perfil', () => {
    expect(nombrePerfil(' ipe300 ')).toBe('IPE 300');
    expect(nombrePerfil('IPE 300*1,05')).toBeNull();
    expect(nombrePerfil('42,2')).toBeNull();
  });
});
