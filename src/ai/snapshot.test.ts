import { describe, expect, it } from 'vitest';
import { buildObraSnapshot, SNAPSHOT_CHAR_BUDGET, type ObraSnapshotInput } from './snapshot';
import type { Cert, Chapter, MedLine, Partida } from '../core/types';

const line = (o: Partial<MedLine>): MedLine => ({
  id: 'm',
  comment: '',
  uds: '',
  largo: '',
  ancho: '',
  alto: '',
  ...o,
});

const partida = (o: Partial<Partida> & Pick<Partida, 'id' | 'pos' | 'code'>): Partida => ({
  title: 'Partida',
  ud: 'ud',
  precio: 0,
  desc: '',
  med: [],
  items: [],
  ...o,
});

const baseInput = (over: Partial<ObraSnapshotInput> = {}): ObraSnapshotInput => ({
  obra: { denominacion: 'Casa X', localidad: 'Málaga' },
  chapters: [{ id: 'c1', code: '1', title: 'Movimiento de tierras', children: [] }] as Chapter[],
  partidas: {
    c1: [
      partida({
        id: 'p1',
        pos: '1.1',
        code: 'E01',
        title: 'Excavación',
        ud: 'm³',
        precio: 100,
        med: [line({ uds: 2, largo: 3 })], // 2·3 = 6 m³
      }),
    ],
  },
  certs: [],
  rates: { coefK: 1, iva: 0.21 },
  view: 'presupuesto',
  active: 'c1',
  openPartidaId: null,
  curCert: 0,
  ...over,
});

describe('buildObraSnapshot', () => {
  it('incluye obra, totales y la línea de la partida con cantidad e importe', () => {
    const snap = buildObraSnapshot(baseInput());
    expect(snap.truncated).toBe(false);
    expect(snap.text).toContain('Casa X');
    expect(snap.text).toContain('Málaga');
    expect(snap.text).toContain('1.1 E01');
    expect(snap.text).toContain('6,00 m³'); // cantidad = 2·3 (2 decimales)
    expect(snap.text).toContain('600,00 €'); // 6 × 100
    expect(snap.text).toContain('IVA 21%');
  });

  it('añade lo certificado y su % cuando la cert en curso tiene datos de la partida', () => {
    const certs: Cert[] = [
      { id: 'ce1', num: 1, period: 'junio', retencion: 0, data: { p1: 3 } },
    ];
    const snap = buildObraSnapshot(baseInput({ certs }));
    expect(snap.text).toContain('certificado 3,00 m³ (50%)'); // 3 de 6
    expect(snap.text).toContain('Certificación en curso: nº 1');
  });

  it('incluye el total con IVA cuando se le pasa', () => {
    const snap = buildObraSnapshot(baseInput(), 72_600); // 726,00 €
    expect(snap.text).toContain('total con IVA 726,00 €');
  });

  it('degrada y ANUNCIA el recorte cuando excede el presupuesto de tokens', () => {
    // c1 (activo, pocas partidas) + c2 con muchas → supera el budget de caracteres.
    const many = Array.from({ length: 600 }, (_, i) =>
      partida({
        id: `q${i}`,
        pos: `2.${i}`,
        code: `M${i}`,
        title: 'Partida de relleno con un título razonablemente largo',
        ud: 'm²',
        precio: 12,
        med: [line({ uds: 4 })],
      }),
    );
    const input = baseInput({
      chapters: [
        { id: 'c1', code: '1', title: 'Movimiento de tierras', children: [] },
        { id: 'c2', code: '2', title: 'Albañilería', children: [] },
      ] as Chapter[],
      partidas: {
        c1: [partida({ id: 'p1', pos: '1.1', code: 'E01', title: 'Excavación', ud: 'm³', precio: 100, med: [line({ uds: 2, largo: 3 })] })],
        c2: many,
      },
      active: 'c1',
    });
    const snap = buildObraSnapshot(input);
    expect(snap.truncated).toBe(true);
    expect(snap.text.length).toBeLessThanOrEqual(SNAPSHOT_CHAR_BUDGET);
    expect(snap.text).toContain('NOTA:'); // el recorte se anuncia
    expect(snap.text).toContain('detalle omitido'); // c2 no se detalla
    expect(snap.text).toContain('1.1 E01'); // el capítulo activo (c1) SÍ se detalla
  });
});
