/* Golden del Word del estudio de residuos (docs/plan-control-calidad.md, D12).
   Se graba con el código de hoy ANTES de sacar a `core/documento/` los tipos del
   documento y el pintor de bloques, y no se toca al moverlos: cualquier cambio
   en el texto o en la estructura del Word de residuos rompe este test. Si el
   Word de residuos cambia a propósito, se regraba con `vitest -u`. */
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Obra } from '../../core/types';
import type { EstudioRcdDatos } from '../../core/rcd/tipos';
import { OBRA_A, OBRA_B, RATES, estudio, estudioB, obraA, obraB } from '../../test/fixtures/rcd/obras';
import { docxRcdFor } from './docxRcd';

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error as Error);
    fr.readAsArrayBuffer(blob);
  });
}

const PROMOTOR: Pick<Obra, 'promotor'> = { promotor: { nombre: 'Promotora de prueba' } };

async function xml(obra: Obra, o: ReturnType<typeof obraA>, d: EstudioRcdDatos): Promise<string> {
  const out = await docxRcdFor({ ...o, rates: RATES, obra: { ...obra, ...PROMOTOR }, estudioRcd: d }, '2026-10-16');
  expect(out).not.toBeNull();
  return strFromU8(unzipSync(await blobBytes(out!.blob))['word/document.xml']!);
}

const CASOS: [string, () => Promise<string>][] = [
  ['reforma-a', () => xml(OBRA_A, obraA(), estudio({ capituloGestion: 'g' }))],
  ['reforma-a-basico', () => xml(OBRA_A, obraA(), estudio({ capituloGestion: 'g', fase: 'basico' }))],
  ['reforma-a-otra-comunidad', () => xml(OBRA_A, obraA(), estudio({ capituloGestion: 'g', comunidad: 'otra' }))],
  ['obra-nueva-b', () => xml(OBRA_B, obraB(), estudioB())],
];

describe('Word del estudio de residuos: golden', () => {
  for (const [nombre, gen] of CASOS)
    it(`${nombre}: el document.xml no cambia`, async () => {
      await expect(await gen()).toMatchFileSnapshot(`./__golden__/rcd-${nombre}.xml`);
    });
});
