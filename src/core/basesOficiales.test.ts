import { describe, expect, it } from 'vitest';
import {
  BASES_OFICIALES,
  edicionNueva,
  esFuenteOficial,
  fechaCorta,
  fuenteDe,
  nombreReferencia,
  textoFuente,
} from './basesOficiales';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

describe('catálogo de bases oficiales', () => {
  it('cada entrada tiene página, fecha de comprobación y, si se descarga, URL https con tamaño', () => {
    const ids = new Set<string>();
    for (const b of BASES_OFICIALES) {
      expect(ids.has(b.id), b.id).toBe(false);
      ids.add(b.id);
      expect(b.pagina.startsWith('https://'), b.id).toBe(true);
      expect(b.comprobada, b.id).toMatch(FECHA);
      if (b.actualizada !== null) expect(b.actualizada, b.id).toMatch(FECHA);
      expect(b.condiciones.length, b.id).toBeGreaterThan(0);
      if (b.descarga) {
        expect(b.descarga.url.startsWith('https://'), b.id).toBe(true);
        expect(b.descarga.url, b.id).not.toContain('?t='); // sin el parámetro de caché
        expect(b.descarga.bytes, b.id).toBeGreaterThan(0);
        expect(b.descarga.ocupa, b.id).toBeGreaterThan(b.descarga.bytes);
        // Con descarga, la cita tiene que llevar la fecha de la edición (D16).
        expect(b.actualizada, b.id).not.toBeNull();
      }
    }
  });

  it('trae la BCCA y Extremadura con descarga, y Madrid solo con página (D3)', () => {
    const porId = Object.fromEntries(BASES_OFICIALES.map((b) => [b.id, b]));
    expect(porId.bcca?.descarga?.formato).toBe('zip');
    expect(porId.extremadura?.descarga?.formato).toBe('bc3');
    expect(porId.madrid?.descarga).toBeUndefined();
  });

  it('Extremadura cita para quién se publica y que no se redistribuye (D18)', () => {
    const ex = BASES_OFICIALES.find((b) => b.id === 'extremadura')!;
    expect(ex.condiciones).toContain('redactores de proyectos');
    expect(ex.condiciones).toContain('Sin permiso para redistribuirla');
  });
});

describe('fuente de una referencia', () => {
  const bcca = BASES_OFICIALES.find((b) => b.id === 'bcca')!;
  const madrid = BASES_OFICIALES.find((b) => b.id === 'madrid')!;

  it('el nombre de la referencia lleva base, edición y organismo (D15)', () => {
    expect(nombreReferencia(bcca)).toBe('BCCA · V02 · enero 2024 (Junta de Andalucía)');
  });

  it('fuenteDe sella la fecha de descarga en local y copia la edición', () => {
    const f = fuenteDe(bcca, new Date(2026, 9, 24, 23, 30));
    expect(f).toEqual({
      baseId: 'bcca',
      organismo: 'Junta de Andalucía',
      edicion: 'V02 · enero 2024',
      actualizada: '2024-01-09',
      pagina: bcca.pagina,
      descargadaEl: '2026-10-24',
    });
    expect(esFuenteOficial(f)).toBe(true);
  });

  it('el texto cita la fecha de actualización y la de descarga, y omite la que no hay', () => {
    expect(textoFuente(fuenteDe(bcca, new Date(2026, 9, 24)))).toBe(
      'Junta de Andalucía · V02 · enero 2024 · actualizada el 09/01/2024 · descargada el 24/10/2026',
    );
    expect(textoFuente(fuenteDe(madrid, new Date(2026, 9, 24)))).toBe(
      'Comunidad de Madrid · 2024 · descargada el 24/10/2026',
    );
    expect(fechaCorta('2026-06-23')).toBe('23/06/2026');
  });

  it('marca edición nueva solo si el catálogo trae otra edición de esa base', () => {
    const f = fuenteDe(bcca, new Date(2026, 9, 24));
    expect(edicionNueva(f)).toBeNull();
    expect(edicionNueva({ ...f, edicion: 'V01 · 2023' })?.id).toBe('bcca');
    expect(edicionNueva({ ...f, baseId: 'desconocida' })).toBeNull();
  });

  it('esFuenteOficial descarta una fuente mal formada', () => {
    const f = fuenteDe(bcca, new Date(2026, 9, 24));
    expect(esFuenteOficial(null)).toBe(false);
    expect(esFuenteOficial({ ...f, descargadaEl: '24/10/2026' })).toBe(false);
    expect(esFuenteOficial({ ...f, actualizada: 7 })).toBe(false);
    expect(esFuenteOficial({ ...f, baseId: undefined })).toBe(false);
    expect(esFuenteOficial({ ...f, actualizada: null })).toBe(true);
  });
});
