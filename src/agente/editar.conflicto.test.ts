/* D4: si otro guarda la obra entre que el agente la lee y la escribe, el lote se
   repite sobre lo nuevo y no se pierde nada de nadie. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObraData } from '../store';

vi.mock('./fichero', async (importOriginal) => {
  const real = await importOriginal<typeof import('./fichero')>();
  return { ...real, escribirObra: vi.fn(real.escribirObra) };
});

const { escribirObra, leerObra } = await import('./fichero');
const real = await vi.importActual<typeof import('./fichero')>('./fichero');
const { editarObra, nuevaObra, INTENTOS } = await import('./editar');

let carpeta: string;
let fichero: string;

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'mediciones-'));
  fichero = join(carpeta, 'Obra.mediciones.json');
  nuevaObra(fichero, 'Obra');
  vi.mocked(escribirObra).mockClear();
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

/** Lo que haría la app al guardar entre la lectura y la escritura del agente. */
function guardaLaApp(cambio: (d: ObraData) => void) {
  const l = leerObra(fichero);
  if (!l.ok) throw new Error(l.mensaje);
  cambio(l.data);
  expect(real.escribirObra(fichero, l.data, l.sello).ok).toBe(true);
}

describe('conflicto al escribir', () => {
  it('repite el lote sobre lo que guardó la app y conserva los dos cambios', () => {
    vi.mocked(escribirObra).mockImplementationOnce((f, data, sello) => {
      guardaLaApp((d) => {
        d.obra.denominacion = 'Obra (renombrada en la app)';
      });
      return real.escribirObra(f, data, sello);
    });
    const r = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'Cimentación' }]);
    expect(r).toMatchObject({ ok: true, intentos: 2 });
    const l = leerObra(fichero);
    if (!l.ok) throw new Error(l.mensaje);
    expect(l.data.obra.denominacion).toBe('Obra (renombrada en la app)');
    expect(l.data.chapters.map((c) => c.title)).toEqual(['Cimentación']);
  });

  it(`si cambia en cada intento, a los ${INTENTOS} se rinde sin escribir lo suyo`, () => {
    let n = 0;
    vi.mocked(escribirObra).mockImplementation((f, data, sello) => {
      guardaLaApp((d) => {
        d.obra.denominacion = `Obra ${++n}`;
      });
      return real.escribirObra(f, data, sello);
    });
    const r = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'Cimentación' }]);
    expect(r).toMatchObject({ ok: false, motivo: 'conflicto' });
    const l = leerObra(fichero);
    if (!l.ok) throw new Error(l.mensaje);
    expect(l.data.chapters).toEqual([]);
    expect(l.data.obra.denominacion).toBe(`Obra ${INTENTOS}`);
    vi.mocked(escribirObra).mockReset();
  });
});
