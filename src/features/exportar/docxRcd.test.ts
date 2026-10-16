import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { OBRA_A, RATES, estudio, obraA } from '../../test/fixtures/rcd/obras';
import { docxRcdFor } from './docxRcd';

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error as Error);
    fr.readAsArrayBuffer(blob);
  });
}

async function xmlA(): Promise<{ xml: string; fileName: string }> {
  const { chapters, partidas } = obraA();
  const out = await docxRcdFor(
    { chapters, partidas, rates: RATES, obra: { ...OBRA_A, promotor: { nombre: 'Promotora de prueba' } }, estudioRcd: estudio({ capituloGestion: 'g' }) },
    '2026-10-16',
  );
  expect(out).not.toBeNull();
  const files = unzipSync(await blobBytes(out!.blob));
  return { xml: strFromU8(files['word/document.xml']!), fileName: out!.fileName };
}

describe('Word del estudio de residuos', () => {
  it('títulos con estilo de título de Word, para el índice de la memoria', async () => {
    const { xml } = await xmlA();
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    for (const t of ['1.º Estimación de la cantidad de residuos', '2.º Medidas para la prevención', '7.º Valoración del coste', 'Inventario de residuos peligrosos'])
      expect(xml).toContain(t);
  });

  it('tabla por código con cabecera repetida y filas que no parten', async () => {
    const { xml } = await xmlA();
    expect(xml).toContain('<w:tblHeader');
    expect(xml).toContain('<w:cantSplit');
    expect(xml).toContain('17 06 05*');
    expect(xml).toContain('Materiales de construcción que contienen amianto');
  });

  it('pendientes en el color de aviso, firma del redactor y nombre del fichero', async () => {
    const { xml, fileName } = await xmlA();
    expect(xml).toContain('Pendiente: gestor autorizado');
    expect(xml).toContain('B45309');
    expect(xml).toContain('Técnica de prueba');
    expect(xml).toContain('EL TÉCNICO REDACTOR');
    expect(fileName).toBe('Estudio de residuos - Reforma A.docx');
  });

  it('sin estudio no hay documento', async () => {
    const { chapters, partidas } = obraA();
    expect(await docxRcdFor({ chapters, partidas, rates: RATES, obra: OBRA_A }, '2026-10-16')).toBeNull();
  });
});
