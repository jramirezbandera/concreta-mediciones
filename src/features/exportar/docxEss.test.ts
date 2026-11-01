import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { estudioSsVacio } from '../../core/ess/obra';
import type { Partida, Rates } from '../../core/types';
import { docxEssFor, type DocxEssState } from './docxEss';

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error as Error);
    fr.readAsArrayBuffer(blob);
  });
}

const RATES: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, ci: 0, coefK: 1 };
const p = (id: string, title: string): Partida => ({
  id,
  pos: id,
  code: id,
  title,
  ud: 'm²',
  precio: 100,
  cantidad: 10,
  desc: '',
  med: [],
  items: [],
});

function estado(conEstudio = true): DocxEssState {
  return {
    chapters: [{ id: 'c1', code: '1', title: 'Obra' }],
    partidas: {
      c1: [
        p('a', 'Demolición de pavimento cerámico.'),
        p('b', 'Cubierta inclinada de teja cerámica.'),
      ],
    },
    recursos: {},
    rates: RATES,
    obra: { denominacion: 'Reforma de prueba', direccion: '', localidad: 'Málaga' },
    ...(conEstudio ? { seguridadSalud: estudioSsVacio({ tipos: ['reforma'] }) } : {}),
  };
}

describe('Word del estudio básico de seguridad y salud (E3)', () => {
  it('sale con los apartados como Título 1 y las fichas como Título 2', async () => {
    const out = await docxEssFor(estado(), '2026-11-01');
    expect(out!.fileName).toMatch(/^Estudio básico de seguridad y salud.*\.docx$/);
    const xml = strFromU8(unzipSync(await blobBytes(out!.blob))['word/document.xml']!);
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>');
    for (const t of [
      '1. Justificación del estudio básico',
      '8. Riesgos no eliminables',
      'Cubierta inclinada (teja, panel, materiales ligeros)',
    ])
      expect(xml).toContain(t);
    expect(xml).toContain('Pendiente: técnico que redacta y firma el estudio.');
  });

  it('sin estudio no hay Word', async () => {
    expect(await docxEssFor(estado(false), '2026-11-01')).toBeNull();
  });
});
