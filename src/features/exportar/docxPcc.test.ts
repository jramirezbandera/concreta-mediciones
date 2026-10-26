import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { RATES, obraA } from '../../test/fixtures/pcc/obras';
import { docxPccFor } from './docxPcc';

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error as Error);
    fr.readAsArrayBuffer(blob);
  });
}

async function wordA(redactor = false) {
  const o = obraA();
  const out = await docxPccFor(
    {
      chapters: o.chapters,
      partidas: o.partidas,
      recursos: {},
      rates: RATES,
      obra: { ...o.obra, promotor: { nombre: 'Promotora de prueba' } },
      planCalidad: redactor ? { ...o.plan, redactor: { nombre: 'Ana Ruiz', titulacion: 'Arquitecta técnica', colegiado: '123' } } : o.plan,
    },
    '2026-10-26',
  );
  expect(out).not.toBeNull();
  const files = unzipSync(await blobBytes(out!.blob));
  return { ...out!, xml: strFromU8(files['word/document.xml']!) };
}

describe('Word del plan de control de calidad (hito de E4)', () => {
  it('la obra A sale en Word, con títulos de Word para el índice de la memoria', async () => {
    const { xml, fileName } = await wordA();
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    for (const t of ['Objeto y alcance', 'Agentes del control', '1. Control de recepción', '2. Control de la estructura', '3. Control de ejecución', '4. Control de la obra terminada', '5. Valoración económica'])
      expect(xml).toContain(t);
    expect(xml).toContain('Pendiente: técnico que redacta y firma el plan.');
    expect(fileName).toMatch(/^Plan de control de calidad.*\.docx$/);
  });

  it('con técnico, su firma; y devuelve lo emitido', async () => {
    const { xml, emitido } = await wordA(true);
    expect(xml).toContain('Ana Ruiz');
    expect(xml).not.toContain('Pendiente: técnico que redacta');
    expect(emitido).toMatchObject({ fecha: '2026-10-26', version: { motor: 1 } });
    expect(emitido.filas.find((f) => f.ensayo === 'j03-008')).toMatchObject({ cantidad: 15, precio: 59.28 });
  });

  it('sin plan no hay Word', async () => {
    const o = obraA();
    expect(await docxPccFor({ chapters: o.chapters, partidas: o.partidas, recursos: {}, rates: RATES, obra: o.obra }, '2026-10-26')).toBeNull();
  });
});
