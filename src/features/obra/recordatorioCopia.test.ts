import { describe, expect, it } from 'vitest';
import {
  DIAS_AVISO_COPIA,
  copiaVencida,
  diasDesdeCopia,
  mostrarRecordatorio,
  textoUltimaCopia,
} from './recordatorioCopia';

const DIA = 86_400_000;
const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const haceDias = (n: number) => new Date(NOW - n * DIA).toISOString();

describe('recordatorio de copia (Etapa 0)', () => {
  it('cuenta días enteros; sin fecha (o ilegible) es «nunca»', () => {
    expect(diasDesdeCopia(haceDias(0), NOW)).toBe(0);
    expect(diasDesdeCopia(new Date(NOW - 1.9 * DIA).toISOString(), NOW)).toBe(1);
    expect(diasDesdeCopia(haceDias(12), NOW)).toBe(12);
    expect(diasDesdeCopia(undefined, NOW)).toBeNull();
    expect(diasDesdeCopia('no es fecha', NOW)).toBeNull();
    expect(diasDesdeCopia(123, NOW)).toBeNull();
  });

  it('dice «descargada», porque el navegador no confirma que se guardó', () => {
    expect(textoUltimaCopia(null)).toBe('Aún no has hecho ninguna copia');
    expect(textoUltimaCopia(0)).toBe('Última copia descargada: hoy');
    expect(textoUltimaCopia(1)).toBe('Última copia descargada: ayer');
    expect(textoUltimaCopia(12)).toBe('Última copia descargada: hace 12 días');
  });

  it(`con las obras protegidas, el aviso sale a los 8 días y no a los 6 (umbral ${DIAS_AVISO_COPIA})`, () => {
    const dias6 = diasDesdeCopia(haceDias(6), NOW);
    const dias8 = diasDesdeCopia(haceDias(8), NOW);
    expect(mostrarRecordatorio(dias6, 'persisted')).toBe(false);
    expect(mostrarRecordatorio(dias8, 'persisted')).toBe(true);
    expect(mostrarRecordatorio(diasDesdeCopia(haceDias(7), NOW), 'persisted')).toBe(false);
    expect(mostrarRecordatorio(null, 'persisted')).toBe(true); // nunca hecha
    expect(copiaVencida(dias6)).toBe(false);
    expect(copiaVencida(dias8)).toBe(true);
  });

  it('si el navegador puede borrar las obras, se enseña siempre', () => {
    expect(mostrarRecordatorio(0, 'best-effort')).toBe(true);
    expect(mostrarRecordatorio(0, 'unsupported')).toBe(true);
    // Mientras no se sabe, solo con la copia vencida.
    expect(mostrarRecordatorio(0, 'unknown')).toBe(false);
  });
});
