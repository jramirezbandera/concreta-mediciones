/* El fichero de una obra en carpeta, de verdad en disco (carpeta temporal):
   crear, editar con sello, todo o nada, la forma canónica y las versiones. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bc3ToObra } from '../core/bc3import';
import { partidaCantidad } from '../core/medicion';
import { SCHEMA_VERSION, blankObraData, selectPem, toSerializable, useObraStore } from '../store';
import { cargarEnStore, editarObra, nuevaObra } from './editar';
import { escribirObra, leerObra, resolverObra, selloEnDisco } from './fichero';
import { CARPETA_DERIVADOS, nombreFicheroObra, textoObra } from './formato';

let carpeta: string;
let fichero: string;

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'mediciones-'));
  fichero = join(carpeta, nombreFicheroObra('Calle Mayor 12'));
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

const PARTIDA = [
  { op: 'crear_capitulo', titulo: 'Movimiento de tierras' },
  {
    op: 'crear_partida',
    capitulo: '1',
    titulo: 'Excavación en zanjas',
    ud: 'm³',
    precio: 18.5,
    lineas: [{ comentario: 'Zanja eje A', uds: 1, largo: 12, ancho: 0.6, alto: 0.8 }],
  },
];

describe('nueva obra', () => {
  it('crea el fichero con el nombre de la obra y nunca pisa uno que exista', () => {
    expect(fichero.endsWith('Calle Mayor 12.mediciones.json')).toBe(true);
    const r = nuevaObra(fichero, 'Calle Mayor 12');
    expect(r.ok).toBe(true);
    const l = leerObra(fichero);
    expect(l.ok && l.data.obra.denominacion).toBe('Calle Mayor 12');
    const antes = readFileSync(fichero, 'utf8');
    expect(nuevaObra(fichero, 'Otra').ok).toBe(false);
    expect(readFileSync(fichero, 'utf8')).toBe(antes);
  });

  it('el nombre del fichero no lleva lo que Windows no admite', () => {
    expect(nombreFicheroObra('Nave 3: "Polígono" Sur / fase 2.')).toBe(
      'Nave 3 Polígono Sur fase 2.mediciones.json',
    );
    expect(nombreFicheroObra('   ')).toBe('Obra.mediciones.json');
    expect(nombreFicheroObra('CON')).toBe('Obra CON.mediciones.json');
  });
});

describe('editar', () => {
  beforeEach(() => {
    expect(nuevaObra(fichero, 'Calle Mayor 12').ok).toBe(true);
  });

  it('aplica el lote, lo escribe y deja la versión anterior en .mediciones/', () => {
    const antes = readFileSync(fichero, 'utf8');
    const r = editarObra(fichero, PARTIDA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recibos.map((x) => x.ref)).toEqual(['1', '1.1']);
    expect(r.sello).toBe(selloEnDisco(fichero));
    const l = leerObra(fichero);
    if (!l.ok) throw new Error(l.mensaje);
    const p = Object.values(l.data.partidas).flat()[0]!;
    expect(partidaCantidad(p)).toBe(5.76);
    expect(
      readFileSync(
        join(carpeta, CARPETA_DERIVADOS, `${nombreFicheroObra('Calle Mayor 12')}.bak`),
        'utf8',
      ),
    ).toBe(antes);
  });

  it('un lote que falla no cambia el fichero', () => {
    editarObra(fichero, PARTIDA);
    const antes = readFileSync(fichero, 'utf8');
    const r = editarObra(fichero, [
      { op: 'agregar_lineas', ref: '1.1', lineas: [{ uds: 2 }] },
      { op: 'set_precio', ref: '7.7', valor: 3 },
    ]);
    expect(r).toMatchObject({ ok: false, motivo: 'lote' });
    if (!r.ok) expect(r.mensaje).toContain('la operación 2 (set_precio)');
    expect(readFileSync(fichero, 'utf8')).toBe(antes);
  });

  it('una op mal escrita no llega a leer la obra', () => {
    const antes = readFileSync(fichero, 'utf8');
    const r = editarObra(fichero, [{ op: 'crear_capitulo' }]);
    expect(r).toMatchObject({ ok: false, motivo: 'forma' });
    expect(readFileSync(fichero, 'utf8')).toBe(antes);
  });

  it('con el sello de una lectura vieja no se aplica nada', () => {
    const viejo = selloEnDisco(fichero)!;
    editarObra(fichero, PARTIDA); // «la app guarda» entretanto
    const r = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'Cimentación' }], {
      sello: viejo,
    });
    expect(r).toMatchObject({ ok: false, motivo: 'sello' });
    const r2 = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'Cimentación' }], {
      sello: selloEnDisco(fichero)!,
    });
    expect(r2.ok).toBe(true);
  });
});

describe('la forma canónica', () => {
  it('leer y volver a escribir sin cambios da el mismo texto', () => {
    nuevaObra(fichero, 'Calle Mayor 12');
    editarObra(fichero, PARTIDA);
    const texto = readFileSync(fichero, 'utf8');
    const l = leerObra(fichero);
    if (!l.ok) throw new Error(l.mensaje);
    expect(textoObra(l.data)).toBe(texto);
    // Y pasando por el store, como hace cada lote.
    cargarEnStore(l.data);
    expect(textoObra(toSerializable(useObraStore.getState()))).toBe(texto);
  });

  it('con una obra importada de un .bc3 de Presto, el mismo texto y el mismo PEM', () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(process.cwd(), 'src', 'core', '__fixtures__', 'presto-mini.bc3')),
    );
    useObraStore.getState().loadObra(bc3ToObra(bytes).data);
    const pem = selectPem(useObraStore.getState());
    expect(pem).toBeGreaterThan(0);
    expect(escribirObra(fichero, toSerializable(useObraStore.getState()), null).ok).toBe(true);
    const texto = readFileSync(fichero, 'utf8');
    const l = leerObra(fichero);
    if (!l.ok) throw new Error(l.mensaje);
    cargarEnStore(l.data);
    expect(selectPem(useObraStore.getState())).toBe(pem);
    expect(textoObra(toSerializable(useObraStore.getState()))).toBe(texto);
  });

  it('es el sobre de la copia .json de la app, sin la fecha de exportación', () => {
    nuevaObra(fichero, 'Calle Mayor 12');
    const sobre = JSON.parse(readFileSync(fichero, 'utf8'));
    expect(Object.keys(sobre)).toEqual(['kind', 'schemaVersion', 'appVersion', 'data']);
    expect(sobre.kind).toBe('concreta-obra');
  });
});

describe('versiones (D8)', () => {
  const escribirConVersion = (v: number) => {
    const data = { ...blankObraData('Vieja'), schemaVersion: v };
    writeFileSync(
      fichero,
      JSON.stringify({ kind: 'concreta-obra', schemaVersion: v, appVersion: '0.5', data }),
      'utf8',
    );
  };

  it('no sube la versión de un fichero sin subirVersion', () => {
    escribirConVersion(SCHEMA_VERSION - 1);
    const antes = readFileSync(fichero, 'utf8');
    const r = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'X' }]);
    expect(r).toMatchObject({ ok: false, motivo: 'version' });
    expect(readFileSync(fichero, 'utf8')).toBe(antes);
    const r2 = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'X' }], { subirVersion: true });
    expect(r2.ok).toBe(true);
    expect(JSON.parse(readFileSync(fichero, 'utf8')).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('una obra de una versión más nueva no se toca, y se dice qué hacer', () => {
    escribirConVersion(SCHEMA_VERSION + 1);
    const r = editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'X' }]);
    expect(r).toMatchObject({ ok: false, motivo: 'lectura' });
    if (!r.ok) expect(r.mensaje).toContain('descarga el MCP nuevo');
  });
});

describe('resolverObra', () => {
  it('el único de la carpeta; ninguno o varios, se dice', () => {
    expect(resolverObra(carpeta)).toMatchObject({ ok: false });
    nuevaObra(fichero, 'Calle Mayor 12');
    expect(resolverObra(carpeta)).toEqual({ ok: true, fichero });
    nuevaObra(join(carpeta, nombreFicheroObra('Anexo')), 'Anexo');
    const r = resolverObra(carpeta);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.candidatos).toHaveLength(2);
    mkdirSync(join(carpeta, 'otra'));
    expect(resolverObra(join(carpeta, 'otra', 'x.json')).ok).toBe(false);
    expect(existsSync(fichero)).toBe(true);
  });
});
