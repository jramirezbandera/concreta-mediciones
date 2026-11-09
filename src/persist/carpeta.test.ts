/* La obra en una carpeta (F3): pasarla, abrirla, llevar los cambios al fichero,
   traer los de fuera como un paso de Deshacer, los conflictos, el permiso y que
   conmutar de obra nunca escriba una obra en la carpeta de otra. */
import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VERSION_DIARIO, nombreEntrada, type EntradaDiario } from '../agente/diario';
import { huellaTexto, leerTextoObra, textoObra } from '../agente/formato';
import { aplicarLote } from '../agente/motor';
import { leerOperaciones } from '../agente/operaciones';
import { leerEstadoApp, seleccionPara } from '../agente/seleccion';
import {
  blankObraData,
  tiendaAparte,
  toSerializable,
  useObraStore,
  useToastStore,
  type ObraData,
} from '../store';
import { useMedUiStore } from '../store/medUiStore';
import { __resetHistoryForTests, initHistory, undo } from '../store/temporal';
import { CarpetaMem } from '../test/fsMemoria';
import {
  __escribirAppAhoraForTests,
  __esperarCarpetaForTests,
  __mirarAhoraForTests,
  __resetCarpetaForTests,
  abrirCarpeta,
  armarCarpeta,
  conectarCarpeta,
  llevarYa,
  pasarACarpeta,
  quedarmeConLaMia,
  useCarpetaStore,
  usarLaDeLaCarpeta,
} from './carpeta';
import { usePersistStore } from './persistStore';
import { useSessionStore } from './sessionStore';
import { __resetSyncForTests, getActiveObraId, hydrate, newObra, switchObra } from './sync';

const st = () => useObraStore.getState();
const estado = () => useCarpetaStore.getState().estado;
const F = 'Vivienda Mayor 12.mediciones.json';

let dir: CarpetaMem;
let elegida: CarpetaMem;

beforeEach(async () => {
  await clear();
  st().reset();
  __resetSyncForTests();
  __resetCarpetaForTests();
  __resetHistoryForTests();
  initHistory(useObraStore);
  usePersistStore.setState({ status: 'idle', recovery: null, recoveryKey: null });
  useToastStore.getState().clear();
  dir = new CarpetaMem('Obra Mayor 12');
  elegida = dir;
  (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = vi.fn(
    async () => elegida,
  );
});
afterEach(() => {
  __resetCarpetaForTests();
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

/** Una obra «Vivienda Mayor 12», ya en su carpeta y al día. */
async function obraEnCarpeta(): Promise<string> {
  await hydrate();
  const id = (await newObra('Vivienda Mayor 12'))!;
  armarCarpeta();
  const r = await pasarACarpeta();
  expect(r).toMatchObject({ ok: true });
  await vi.waitFor(() => expect(estado().tipo).toBe('al-dia'));
  return id;
}

/** La obra del fichero, leída como la leería la app. */
function enElFichero(d: CarpetaMem = dir, f = F): ObraData {
  const l = leerTextoObra(d.leer(f)!);
  if (!l.ok) throw new Error(l.mensaje);
  return l.data;
}

/** Lo que haría el agente: cambiar el fichero desde fuera. */
function cambiarFuera(fn: (d: ObraData) => void): void {
  const d = enElFichero();
  fn(d);
  dir.escribirFuera(F, textoObra(d));
}

const capitulo = (id: string, title: string, code = '9') => ({ id, code, title, children: [] });

describe('pasar a una carpeta', () => {
  it('escribe la obra en su fichero y la deja vinculada, una sola en la lista', async () => {
    const id = await obraEnCarpeta();
    expect(enElFichero().obra.denominacion).toBe('Vivienda Mayor 12');
    expect(useCarpetaStore.getState().carpetas[id]).toEqual({
      carpeta: 'Obra Mayor 12',
      fichero: F,
    });
    expect(
      useSessionStore.getState().obras.filter((o) => o.name === 'Vivienda Mayor 12'),
    ).toHaveLength(1);
  });

  it('nunca pisa una obra que ya esté en la carpeta', async () => {
    dir.escribirFuera('Otra.mediciones.json', textoObra(blankObraData('Otra')));
    await hydrate();
    await newObra('Vivienda Mayor 12');
    armarCarpeta();
    const r = await pasarACarpeta();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('ya tiene una obra');
    expect(dir.ficheros.size).toBe(1);
  });
});

describe('de la app a la carpeta', () => {
  it('un cambio en la app llega al fichero', async () => {
    await obraEnCarpeta();
    st().addChapter('Cimentación');
    await llevarYa();
    expect(enElFichero().chapters.map((c) => c.title)).toEqual(['Cimentación']);
    expect(estado().tipo).toBe('al-dia');
  });
});

describe('de la carpeta a la app', () => {
  it('lo de fuera entra como un paso de Deshacer, con su aviso y lo tocado resaltado', async () => {
    await obraEnCarpeta();
    const chId = 'c-fuera';
    cambiarFuera((d) => {
      d.chapters.push(capitulo(chId, 'Movimiento de tierras', '1'));
      d.partidas[chId] = [
        {
          id: 'p-fuera',
          pos: '1.1',
          code: 'ADE010',
          title: 'Excavación',
          ud: 'm³',
          precio: 18.5,
          desc: '',
          med: [],
          items: [],
        },
      ];
    });
    await __mirarAhoraForTests();
    expect(st().chapters.map((c) => c.title)).toEqual(['Movimiento de tierras']);
    expect(useToastStore.getState().msg).toBe(
      'La obra cambió en su carpeta: +1 capítulo · +1 partida',
    );
    expect([...useCarpetaStore.getState().resaltadas.ids]).toEqual(['p-fuera']);
    // Ctrl+Z lo quita… y el fichero vuelve a como estaba.
    undo();
    expect(st().chapters).toEqual([]);
    await llevarYa();
    expect(enElFichero().chapters).toEqual([]);
  });

  it('no mueve lo que el técnico tiene abierto', async () => {
    await obraEnCarpeta();
    st().addChapter('Estructura');
    await llevarYa();
    const activo = st().chapters[0]!.id;
    useObraStore.setState({ active: activo, view: 'resumen' });
    cambiarFuera((d) => {
      d.chapters.push(capitulo('c2', 'Cubiertas', '2'));
    });
    await __mirarAhoraForTests();
    expect(st().chapters.map((c) => c.title)).toEqual(['Estructura', 'Cubiertas']);
    expect(st().active).toBe(activo);
    expect(st().view).toBe('resumen');
  });

  it('un fichero que no es una obra no se aplica', async () => {
    await obraEnCarpeta();
    st().addChapter('Mía');
    await llevarYa();
    dir.escribirFuera(F, '{ roto');
    await __mirarAhoraForTests();
    expect(estado().tipo).toBe('error');
    expect(st().chapters.map((c) => c.title)).toEqual(['Mía']);
  });
});

describe('conflicto', () => {
  /** Un cambio aquí sin llevar a la carpeta, y otro fuera a la vez. */
  async function conflicto() {
    await obraEnCarpeta();
    st().addChapter('Mío'); // pendiente: aún no está en el fichero
    cambiarFuera((d) => {
      d.chapters.push(capitulo('c-suyo', 'Suyo'));
    });
    await __mirarAhoraForTests();
    expect(estado()).toMatchObject({ tipo: 'conflicto' });
  }

  it('no se elige solo: ni se pisa el fichero ni se aplica', async () => {
    await conflicto();
    await llevarYa();
    expect(enElFichero().chapters.map((c) => c.title)).toEqual(['Suyo']);
    expect(st().chapters.map((c) => c.title)).toEqual(['Mío']);
  });

  it('usar la de la carpeta: lo mío queda en el Deshacer', async () => {
    await conflicto();
    await usarLaDeLaCarpeta();
    expect(st().chapters.map((c) => c.title)).toEqual(['Suyo']);
    expect(estado().tipo).toBe('al-dia');
    undo();
    expect(st().chapters.map((c) => c.title)).toEqual(['Mío']);
  });

  it('quedarme con la mía: la de la carpeta se guarda en .mediciones/', async () => {
    await conflicto();
    await quedarmeConLaMia();
    expect(enElFichero().chapters.map((c) => c.title)).toEqual(['Mío']);
    const copias = [...(dir.carpetas.get('.mediciones')?.ficheros.values() ?? [])].filter((f) =>
      f.name.includes('.conflicto-'),
    );
    expect(copias).toHaveLength(1);
    expect(copias[0]!.name).toMatch(/^Vivienda Mayor 12\.conflicto-.*\.mediciones\.json$/);
    expect(copias[0]!.texto()).toContain('Suyo');
    expect(estado().tipo).toBe('al-dia');
  });
});

describe('trabajar a la vez (F4)', () => {
  /** Lo que hace el MCP con `editar`: aplicar el lote, escribir el fichero y su entrada del diario. */
  function agenteEdita(ops: unknown[], sesion = 's1'): void {
    const antes = dir.leer(F)!;
    const l = leerTextoObra(antes);
    if (!l.ok) throw new Error(l.mensaje);
    const lo = leerOperaciones(ops);
    if (!lo.ok) throw new Error(JSON.stringify(lo.errores));
    const t = tiendaAparte(l.data);
    const r = aplicarLote(t, lo.ops);
    if (!r.ok) throw new Error(JSON.stringify(r.recibos.at(-1)));
    const despues = textoObra(toSerializable(t.getState()));
    dir.escribirFuera(F, despues);
    const e: EntradaDiario = {
      version: VERSION_DIARIO,
      fichero: F,
      fecha: new Date().toISOString(),
      autor: { sesion },
      antes: huellaTexto(antes),
      despues: huellaTexto(despues),
      pasos: r.pasos,
    };
    const md = dir.carpetas.get('.mediciones') ?? new CarpetaMem('.mediciones');
    dir.carpetas.set('.mediciones', md);
    const diario = md.carpetas.get('diario') ?? new CarpetaMem('diario');
    md.carpetas.set('diario', diario);
    diario.escribirFuera(nombreEntrada(e), JSON.stringify(e));
  }

  /** La obra con la partida 1.1 «Excavación» sin precio, ya en la carpeta. */
  async function conPartida() {
    await obraEnCarpeta();
    st().addChapter('Movimiento de tierras');
    const chId = st().chapters[0]!.id;
    const pid = st().createPartida(chId, null);
    st().editPartidaField(chId, pid, 'title', 'Excavación');
    await llevarYa();
    expect(estado().tipo).toBe('al-dia');
    return { chId, pid };
  }

  const partida = (d: ObraData, chId: string, pid: string) =>
    d.partidas[chId]!.find((p) => p.id === pid)!;

  it('el técnico pone precios mientras el agente mete líneas: no se pierde nada ni se pregunta', async () => {
    const { chId, pid } = await conPartida();
    st().setPrecio(chId, pid, 18.5); // sin llevar aún a la carpeta
    agenteEdita([
      { op: 'agregar_lineas', ref: '1.1', lineas: [{ comentario: 'Zanja A', uds: 1, largo: 10 }] },
    ]);
    await __mirarAhoraForTests();
    expect(estado().tipo).toBe('al-dia');
    // En la app, las dos cosas…
    const p = partida(toSerializable(st()), chId, pid);
    expect(p.precio).toBe(18.5);
    expect(p.med.map((l) => l.comment)).toEqual(['Zanja A']);
    // …y en la carpeta también, con la línea con el mismo id que le dio el agente.
    const f = partida(enElFichero(), chId, pid);
    expect(f.precio).toBe(18.5);
    expect(f.med.map((l) => l.id)).toEqual(p.med.map((l) => l.id));
    expect(useToastStore.getState().msg).toBe('Claude: +1 línea, sobre tus cambios');
    expect([...useCarpetaStore.getState().resaltadas.ids]).toEqual([pid]);
    // Ctrl+Z quita lo del agente y deja lo mío.
    undo();
    const q = partida(toSerializable(st()), chId, pid);
    expect(q.med).toEqual([]);
    expect(q.precio).toBe(18.5);
  });

  it('dos lotes seguidos, de dos sesiones, se repiten en orden', async () => {
    const { chId, pid } = await conPartida();
    st().editPartidaField(chId, pid, 'ud', 'm³');
    agenteEdita([{ op: 'agregar_lineas', ref: '1.1', lineas: [{ comentario: 'A', largo: 2 }] }], 's1');
    agenteEdita([{ op: 'editar_linea', ref: '1.1', indice: 1, campo: 'largo', valor: 3 }], 's2');
    await __mirarAhoraForTests();
    expect(estado().tipo).toBe('al-dia');
    const p = partida(enElFichero(), chId, pid);
    expect(p.ud).toBe('m³');
    expect(p.med.map((l) => l.largo)).toEqual([3]);
    expect(useToastStore.getState().msg).toMatch(/^Claude \(2 sesiones\): /);
  });

  it('si el técnico borró lo que tocaba el agente, pregunta y dice por qué', async () => {
    const { chId, pid } = await conPartida();
    st().deletePartida(chId, pid);
    agenteEdita([{ op: 'set_precio', ref: '1.1', valor: 20 }]);
    await __mirarAhoraForTests();
    expect(estado()).toMatchObject({
      tipo: 'conflicto',
      motivo: expect.stringContaining('no se pudo repetir lo de Claude'),
    });
  });

  it('un cambio del agente sin cambios aquí lleva su nombre en el aviso', async () => {
    await conPartida();
    agenteEdita([{ op: 'set_precio', ref: '1.1', valor: 20 }]);
    await __mirarAhoraForTests();
    expect(useToastStore.getState().msg).toBe('Claude: 1 partida cambiada');
  });

  it('deja en app.json lo que el técnico tiene abierto, con la versión que enseña', async () => {
    const { chId, pid } = await conPartida();
    st().addMedLines(chId, pid, [{ comment: 'A' }, { comment: 'B' }]);
    await llevarYa();
    const lineas = partida(toSerializable(st()), chId, pid).med.map((l) => l.id);
    useObraStore.setState({ openPartidaId: pid, active: chId });
    useMedUiStore.setState({ partidaId: pid, selected: [lineas[1]!] });
    await __escribirAppAhoraForTests();
    const texto = dir.carpetas.get('.mediciones')!.ficheros.get('Vivienda Mayor 12.app.json')!.texto();
    const e = leerEstadoApp(texto)!;
    expect(e).toMatchObject({
      fichero: F,
      partida: pid,
      capitulo: chId,
      lineas: [lineas[1]],
      cambiosSinGuardar: false,
      huella: huellaTexto(dir.leer(F)!),
    });
    // Lo resuelve el agente, con la obra del fichero.
    const s = seleccionPara(enElFichero(), e, huellaTexto(dir.leer(F)!));
    expect(s).toMatchObject({ alDia: true, partida: { ref: '1.1', lineasElegidas: [2] } });
  });
});

describe('conmutar de obra', () => {
  it('lo pendiente llega a su carpeta, y la otra obra nunca se escribe en ella', async () => {
    await obraEnCarpeta();
    st().addChapter('Solo de la vivienda'); // pendiente
    await newObra('Otra obra'); // conmuta: antes, lo pendiente a la carpeta
    expect(enElFichero().chapters.map((c) => c.title)).toEqual(['Solo de la vivienda']);
    st().addChapter('De la otra');
    await new Promise((r) => setTimeout(r, 700)); // más que la pausa de guardar
    await __esperarCarpetaForTests();
    const d = enElFichero();
    expect(d.obra.denominacion).toBe('Vivienda Mayor 12');
    expect(d.chapters.map((c) => c.title)).toEqual(['Solo de la vivienda']);
    expect(estado().tipo).toBe('sin-carpeta');
  });

  it('al volver sin permiso, un clic; y entra lo que cambió fuera mientras', async () => {
    const id = await obraEnCarpeta();
    await newObra('Otra obra');
    cambiarFuera((d) => {
      d.chapters.push(capitulo('c-ausente', 'Mientras no estaba'));
    });
    dir.permiso = 'prompt';
    await switchObra(id);
    await vi.waitFor(() => expect(estado().tipo).toBe('sin-permiso'));
    expect(await conectarCarpeta()).toBe(true);
    expect(estado().tipo).toBe('al-dia');
    expect(st().chapters.map((c) => c.title)).toEqual(['Mientras no estaba']);
  });
});

describe('abrir una carpeta', () => {
  it('añade su obra a la lista y la abre; abrirla otra vez no la duplica', async () => {
    await hydrate();
    await newObra('La de antes');
    armarCarpeta();
    const nave = new CarpetaMem('Nave');
    const d = blankObraData('Nave en el polígono');
    d.chapters.push(capitulo('c1', 'Cimentación', '1'));
    nave.escribirFuera('Nave en el polígono.mediciones.json', textoObra(d));
    elegida = nave;
    expect(await abrirCarpeta()).toMatchObject({ ok: true });
    const id = getActiveObraId();
    expect(st().obra.denominacion).toBe('Nave en el polígono');
    expect(st().chapters.map((c) => c.title)).toEqual(['Cimentación']);
    await vi.waitFor(() => expect(estado().tipo).toBe('al-dia'));
    const n = useSessionStore.getState().obras.length;
    await newObra('Y otra');
    expect(await abrirCarpeta()).toMatchObject({ ok: true });
    expect(getActiveObraId()).toBe(id);
    expect(useSessionStore.getState().obras.length).toBe(n + 1); // solo «Y otra»
  });

  it('una carpeta sin obra lo dice', async () => {
    await hydrate();
    armarCarpeta();
    elegida = new CarpetaMem('Vacía');
    expect(await abrirCarpeta()).toMatchObject({
      ok: false,
      mensaje: expect.stringContaining('no tiene ninguna obra'),
    });
  });
});
