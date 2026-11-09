/* F4: el diario de cada lote del agente (con sus destinos anclados y sus ids),
   repetirlo sobre la versión del técnico, y lo que el técnico tiene abierto. */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { conIds } from '../core/id';
import { findPartidaById } from '../core/tree';
import { tiendaAparte, toSerializable, type ObraData } from '../store';
import { ENTRADAS_DIARIO, cadena, leerEntrada, repetirCadena, type EntradaDiario } from './diario';
import { editarObra, nuevaObra } from './editar';
import { carpetaDiario, escribirDiario, leerObra } from './fichero';
import { CARPETA_DERIVADOS, huellaTexto, nombreAppJson } from './formato';
import { ejecutar } from './ordenes';
import type { EstadoApp } from './seleccion';

let carpeta: string;
let fichero: string;
const autor = { sesion: 'sesion1', cliente: 'prueba' };

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'mediciones-diario-'));
  fichero = join(carpeta, 'Obra.mediciones.json');
  nuevaObra(fichero, 'Obra');
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

const leer = (): ObraData => {
  const l = leerObra(fichero);
  if (!l.ok) throw new Error(l.mensaje);
  return l.data;
};
const entradas = (): EntradaDiario[] =>
  readdirSync(carpetaDiario(fichero))
    .sort()
    .map((n) => leerEntrada(readFileSync(join(carpetaDiario(fichero), n), 'utf8'))!);

/** Una obra con un capítulo y la partida 1.1 «Excavación», con dos líneas. */
function base() {
  const r = editarObra(
    fichero,
    [
      { op: 'crear_capitulo', titulo: 'Movimiento de tierras' },
      {
        op: 'crear_partida',
        capitulo: '1',
        titulo: 'Excavación',
        ud: 'm³',
        lineas: [
          { comentario: 'Zanja A', uds: 1, largo: 10 },
          { comentario: 'Zanja B', uds: 1, largo: 5 },
        ],
      },
    ],
    { autor },
  );
  if (!r.ok) throw new Error(r.mensaje);
  return { chId: r.recibos[0]!.id!, pid: r.recibos[1]!.id! };
}

describe('conIds', () => {
  it('graba los ids que salen y, con ellos, los repite', () => {
    const t = tiendaAparte(leer());
    const g = conIds(undefined, () => t.getState().addChapter('Uno'));
    expect(g.ids).toHaveLength(1);
    const t2 = tiendaAparte(leer());
    conIds(g.ids, () => t2.getState().addChapter('Uno'));
    expect(t2.getState().chapters[0]!.id).toBe(t.getState().chapters[0]!.id);
  });
});

describe('el diario', () => {
  it('cada lote deja una entrada: de qué versión a cuál, quién, y sus ops ancladas', () => {
    const antes = huellaTexto(readFileSync(fichero, 'utf8'));
    const { pid } = base();
    const [e] = entradas();
    expect(e).toMatchObject({
      fichero: 'Obra.mediciones.json',
      autor,
      antes,
      despues: huellaTexto(readFileSync(fichero, 'utf8')),
      resumen: '+1 capítulo · +1 partida · +2 líneas',
    });
    // `capitulo: '1'` queda por el id del capítulo, que no cambia al renumerar.
    expect(e!.pasos[1]!.op).toMatchObject({
      op: 'crear_partida',
      capitulo: e!.pasos[0]!.ids.map((x) => `ch-${x}`)[0],
    });
    expect(e!.pasos[1]!.ids.length).toBe(3); // la partida y sus dos líneas
    // Una línea, por su id.
    editarObra(fichero, [{ op: 'borrar_linea', ref: '1.1', indice: 2 }], { autor });
    const ultima = entradas().find((x) => x.pasos[0]!.op.op === 'borrar_linea')!;
    expect(ultima.pasos[0]!.op).toMatchObject({ ref: pid });
    expect(ultima.pasos[0]!.lineas).toHaveLength(1);
  });

  it('sin autor (las pruebas, una llamada interna) no deja diario', () => {
    editarObra(fichero, [{ op: 'crear_capitulo', titulo: 'X' }]);
    expect(() => readdirSync(carpetaDiario(fichero))).toThrow();
  });

  it(`guarda las ${ENTRADAS_DIARIO} últimas`, () => {
    const e0 = { version: 1 as const, fichero: 'x', autor, antes: 'a', despues: 'b' };
    for (let i = 0; i < ENTRADAS_DIARIO + 5; i++) {
      escribirDiario(fichero, {
        ...e0,
        fecha: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        pasos: [],
      });
    }
    const quedan = readdirSync(carpetaDiario(fichero)).sort();
    expect(quedan).toHaveLength(ENTRADAS_DIARIO);
    expect(quedan[0]).toContain('2026-01-01T00-00-05');
  });

  it('la cadena va de una versión a otra por las entradas; si falta un eslabón, no hay', () => {
    const h0 = huellaTexto(readFileSync(fichero, 'utf8'));
    base();
    editarObra(fichero, [{ op: 'set_precio', ref: '1.1', valor: 18.5 }], { autor });
    const h2 = huellaTexto(readFileSync(fichero, 'utf8'));
    const es = entradas();
    expect(cadena(es, h0, h2)?.map((e) => e.pasos[0]!.op.op)).toEqual([
      'crear_capitulo',
      'set_precio',
    ]);
    expect(cadena(es.slice(1), h0, h2)).toBeNull();
    expect(cadena(es, h2, h2)).toEqual([]);
  });
});

describe('repetir sobre la versión del técnico', () => {
  it('va a la misma partida aunque el técnico la haya renumerado, y saca los mismos ids', () => {
    const { chId } = base();
    const comun = leer();
    const h = huellaTexto(readFileSync(fichero, 'utf8'));
    editarObra(
      fichero,
      [{ op: 'agregar_lineas', ref: '1.1', lineas: [{ comentario: 'Zanja C', largo: 3 }] }],
      {
        autor,
      },
    );
    const delAgente = leer();
    // El técnico, a la vez: una partida nueva DELANTE de la 1.1 y un precio.
    const t = tiendaAparte(comun);
    const nueva = t.getState().createPartida(chId, null)!;
    t.getState().reorderPartida(chId, nueva, comun.partidas[chId]![0]!.id);
    const mia = toSerializable(t.getState());
    const excav = mia.partidas[chId]!.find((p) => p.title === 'Excavación')!;
    expect(excav.pos).not.toBe('1.1'); // la renumeró

    const r = repetirCadena(
      mia,
      cadena(entradas(), h, huellaTexto(readFileSync(fichero, 'utf8')))!,
    );
    if (!r.ok) throw new Error(r.motivo);
    const p = findPartidaById(r.data.partidas, excav.id)!.partida;
    expect(p.med.map((l) => l.comment)).toEqual(['Zanja A', 'Zanja B', 'Zanja C']);
    // La línea nueva se llama igual que en el fichero del agente.
    const suya = findPartidaById(delAgente.partidas, excav.id)!.partida.med[2]!;
    expect(p.med[2]!.id).toBe(suya.id);
    // Y lo del técnico sigue.
    expect(r.data.partidas[chId]).toHaveLength(2);
  });

  it('si el técnico borró la línea que cambia el agente, no se repite y dice por qué', () => {
    const { chId, pid } = base();
    const comun = leer();
    const h = huellaTexto(readFileSync(fichero, 'utf8'));
    editarObra(fichero, [{ op: 'editar_linea', ref: '1.1', indice: 2, campo: 'largo', valor: 6 }], {
      autor,
    });
    const t = tiendaAparte(comun);
    const l2 = findPartidaById(comun.partidas, pid)!.partida.med[1]!.id;
    t.getState().deleteMedLines(chId, pid, [l2]);
    const r = repetirCadena(
      toSerializable(t.getState()),
      cadena(entradas(), h, huellaTexto(readFileSync(fichero, 'utf8')))!,
    );
    expect(r).toEqual({ ok: false, motivo: expect.stringContaining('ya no está') });
  });

  it('si el técnico borró la partida, tampoco', () => {
    const { chId, pid } = base();
    const comun = leer();
    const h = huellaTexto(readFileSync(fichero, 'utf8'));
    editarObra(fichero, [{ op: 'set_precio', ref: '1.1', valor: 20 }], { autor });
    const t = tiendaAparte(comun);
    t.getState().deletePartida(chId, pid);
    const r = repetirCadena(
      toSerializable(t.getState()),
      cadena(entradas(), h, huellaTexto(readFileSync(fichero, 'utf8')))!,
    );
    expect(r).toMatchObject({
      ok: false,
      motivo: expect.stringContaining('no encuentro la partida'),
    });
  });
});

describe('seleccion', () => {
  function escribirApp(e: Partial<EstadoApp>) {
    const d = join(carpeta, CARPETA_DERIVADOS);
    mkdirSync(d, { recursive: true });
    const completo: EstadoApp = {
      version: 1,
      fichero: 'Obra.mediciones.json',
      fecha: new Date().toISOString(),
      app: 'x',
      huella: huellaTexto(readFileSync(fichero, 'utf8')),
      cambiosSinGuardar: false,
      visible: true,
      vista: 'presupuesto',
      capitulo: null,
      partida: null,
      lineas: [],
      certificacion: null,
      plano: null,
      ...e,
    };
    writeFileSync(join(d, nombreAppJson('Obra.mediciones.json')), JSON.stringify(completo));
  }

  it('«esta partida»: la abierta, con su número, y las líneas elegidas', () => {
    const { chId, pid } = base();
    const l2 = leer().partidas[chId]![0]!.med[1]!.id;
    escribirApp({ partida: pid, capitulo: chId, lineas: [l2] });
    const s = ejecutar('seleccion', { obra: carpeta });
    expect(s).toMatchObject({
      ok: true,
      abierta: true,
      alDia: true,
      capitulo: { ref: '1', titulo: 'Movimiento de tierras' },
      partida: { ref: '1.1', id: pid, titulo: 'Excavación', lineas: 2, lineasElegidas: [2] },
    });
    expect(s.avisos).toBeUndefined();
  });

  it('dice si la app no está al día con el fichero', () => {
    const { pid } = base();
    escribirApp({ partida: pid, cambiosSinGuardar: true });
    expect(ejecutar('seleccion', { obra: carpeta })).toMatchObject({
      alDia: false,
      avisos: [expect.stringContaining('cambios que aún no están')],
    });
    escribirApp({ partida: 'p-nueva' });
    expect(ejecutar('seleccion', { obra: carpeta })).toMatchObject({
      partida: { id: 'p-nueva', enElFichero: false },
    });
  });

  it('sin app.json, lo dice', () => {
    expect(ejecutar('seleccion', { obra: carpeta })).toMatchObject({ ok: true, abierta: false });
  });
});
