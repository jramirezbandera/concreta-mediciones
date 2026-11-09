/* ===========================================================================
   agente/ordenes — las órdenes del agente, comunes al MCP y a la CLI.
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md §6, F2)

   Cada orden es: nombre, descripción, esquema JSON de su entrada y una función
   que devuelve un objeto JSON. El MCP las publica como herramientas tal cual
   (`agente/mcp`) y la CLI las ejecuta con los mismos argumentos (`agente/cli`):
   la misma salida por los dos caminos.

   Cada orden que lee la obra la lee del disco en ese momento (regla 3 de la
   guía): nunca se trabaja con una copia vieja en memoria.
   =========================================================================== */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { APP_VERSION } from '../persist/persist';
import { SCHEMA_VERSION, selectCounts, selectPem, useObraStore } from '../store';
import { toEur } from '../core/money';
import { rawUuid } from '../core/id';
import { arbolObra, buscarEnObra, partidaObra, resumenObra } from './consultas';
import { cargarEnStore, editarObra, nuevaObra } from './editar';
import { leerObra, obrasEnCarpeta, resolverObra } from './fichero';
import { CARPETA_DERIVADOS, SUFIJO_OBRA, nombreAppJson, nombreFicheroObra } from './formato';
import type { Autor } from './diario';
import { leerEstadoApp, seleccionPara } from './seleccion';
import { TODAS_LAS_OPS } from './operaciones';
import { validarObra } from './validar';
import GUIA from './guia.md?raw';

/** La app publicada. */
export const URL_APP = 'https://jramirezbandera.github.io/concreta-mediciones/';
export const NOMBRE_MCP = 'concreta-mediciones';

/** La guía sin la cabecera de la skill (`name`, `description`). */
export function textoGuia(): string {
  return GUIA.replace(/^---[\s\S]*?---\s*/, '');
}

type Esquema = Record<string, unknown>;
type Args = Record<string, unknown>;

/** Lo que devuelve una orden: `ok: false` con su motivo es un error para el cliente. */
export type Salida = Record<string, unknown> & { ok: boolean };

/** La sesión de este proceso: un MCP es una sesión del agente; una llamada de la CLI, otra. */
const SESION = rawUuid().replace(/-/g, '').slice(0, 10);

/** El autor de los lotes de este proceso, para el diario. */
export function autorDeEstaSesion(cliente?: string): Autor {
  return { sesion: SESION, ...(cliente ? { cliente } : {}), carpeta: process.cwd() };
}

/** Quién llama: el MCP lo saca de su cliente; la CLI se presenta como «cli». */
export interface Contexto {
  autor?: Autor;
}

export interface Orden {
  nombre: string;
  descripcion: string;
  entrada: Esquema;
  /** true si no cambia nada (el cliente puede no pedir permiso). */
  soloLectura: boolean;
  ejecutar(a: Args, ctx: Contexto): Salida;
}

const obj = (properties: Record<string, Esquema>, required: string[] = []): Esquema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const OBRA: Esquema = {
  type: 'string',
  description: `Ruta absoluta del fichero de la obra (*${SUFIJO_OBRA}) o de la carpeta de la obra, si solo tiene uno.`,
};

class Fallo extends Error {
  constructor(
    public motivo: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function ruta(a: Args, k: string): string {
  const v = a[k];
  if (typeof v !== 'string' || !v.trim()) throw new Fallo('argumentos', `falta «${k}»`);
  if (!isAbsolute(v))
    throw new Fallo('argumentos', `«${k}» tiene que ser una ruta absoluta (${v})`);
  return resolve(v);
}

function textoArg(a: Args, k: string, opcional = false): string | undefined {
  const v = a[k];
  if (v === undefined || v === null) {
    if (opcional) return undefined;
    throw new Fallo('argumentos', `falta «${k}»`);
  }
  if (typeof v !== 'string') throw new Fallo('argumentos', `«${k}» tiene que ser un texto`);
  return v;
}

/** Resuelve la obra y la carga en el store, recién leída del disco. */
function cargar(a: Args) {
  const r = resolverObra(ruta(a, 'obra'));
  if (!r.ok) throw new Fallo('obra', r.mensaje, r.candidatos ? { candidatos: r.candidatos } : {});
  const l = leerObra(r.fichero);
  if (!l.ok) throw new Fallo('lectura', l.mensaje);
  cargarEnStore(l.data);
  return {
    fichero: r.fichero,
    sello: l.sello,
    versionFichero: l.versionFichero,
    st: useObraStore.getState(),
  };
}

/** Lo esencial de una obra cargada: para `obra`, y tras cada `editar`. */
function estado() {
  const st = useObraStore.getState();
  const c = selectCounts(st);
  return {
    denominacion: st.obra.denominacion,
    pem: toEur(selectPem(st)),
    recuento: { capitulos: c.chapters, partidas: c.partidas, lineas: c.lineas },
  };
}

function abrirNavegador(url: string): void {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).unref();
}

const RESUMEN_OPS = TODAS_LAS_OPS.join(', ');

export const ORDENES: Orden[] = [
  {
    nombre: 'guia',
    descripcion:
      'La guía de trabajo con Concreta Mediciones: reglas (los precios y las mediciones no se inventan), flujo, referencias y todas las operaciones de editar con ejemplos. Léela antes de empezar.',
    entrada: obj({}),
    soloLectura: true,
    ejecutar: () => ({ ok: true, guia: textoGuia() }),
  },
  {
    nombre: 'obra',
    descripcion:
      'Qué obra hay en una carpeta (o en un fichero): su fichero, su denominación, su PEM, cuántos capítulos, partidas y líneas tiene, y las versiones del formato. Con varias en la carpeta, las lista para elegir; sin ninguna, dilo y ofrece nueva_obra.',
    entrada: obj({ obra: OBRA }, ['obra']),
    soloLectura: true,
    ejecutar: (a) => {
      const r = resolverObra(ruta(a, 'obra'));
      if (!r.ok) {
        if (r.candidatos)
          return { ok: true, varias: true, candidatos: r.candidatos, mensaje: r.mensaje };
        throw new Fallo('obra', r.mensaje);
      }
      const c = cargar({ obra: r.fichero });
      return {
        ok: true,
        fichero: c.fichero,
        ...estado(),
        sello: c.sello,
        version: { fichero: c.versionFichero, herramienta: SCHEMA_VERSION, app: APP_VERSION },
      };
    },
  },
  {
    nombre: 'nueva_obra',
    descripcion: `Crea una obra vacía en una carpeta: el fichero «<denominación>${SUFIJO_OBRA}». Crea la carpeta si no existe (su carpeta madre, sí). Nunca pisa una obra que ya esté.`,
    entrada: obj(
      {
        carpeta: { type: 'string', description: 'Ruta absoluta de la carpeta de la obra.' },
        denominacion: {
          type: 'string',
          description: 'Nombre de la obra («Vivienda unifamiliar en calle Mayor 12»).',
        },
      },
      ['carpeta', 'denominacion'],
    ),
    soloLectura: false,
    ejecutar: (a) => {
      const carpeta = ruta(a, 'carpeta');
      const denominacion = textoArg(a, 'denominacion')!.trim();
      if (!denominacion) throw new Fallo('argumentos', '«denominacion» está vacía');
      if (existsSync(carpeta) && !statSync(carpeta).isDirectory())
        throw new Fallo('argumentos', `${carpeta} no es una carpeta`);
      if (!existsSync(carpeta)) {
        if (!existsSync(dirname(carpeta)))
          throw new Fallo('argumentos', `no existe la carpeta ${dirname(carpeta)}`);
        mkdirSync(carpeta);
      }
      const ya = obrasEnCarpeta(carpeta);
      const fichero = join(carpeta, nombreFicheroObra(denominacion));
      const r = nuevaObra(fichero, denominacion);
      if (!r.ok) throw new Fallo('existe', r.mensaje);
      return {
        ok: true,
        fichero: r.fichero,
        sello: r.sello,
        ...(ya.length ? { otrasObrasEnLaCarpeta: ya } : {}),
      };
    },
  },
  {
    nombre: 'resumen',
    descripcion:
      'El resumen económico de la obra: la ficha, los capítulos con su importe y su peso, costes directos e indirectos, PEM, gastos generales, beneficio industrial, PEC, IVA y total (en euros), los porcentajes (en %), el coeficiente K y las certificaciones.',
    entrada: obj({ obra: OBRA }, ['obra']),
    soloLectura: true,
    ejecutar: (a) => {
      const c = cargar(a);
      return { ok: true, fichero: c.fichero, sello: c.sello, ...resumenObra(c.st) };
    },
  },
  {
    nombre: 'arbol',
    descripcion:
      'El árbol del presupuesto: capítulos y subcapítulos con su importe y, en cada uno, sus partidas (número, id, código, título, ud, cantidad, precio, importe y nº de líneas). Para obras grandes, pide un capítulo, o sin partidas, o hasta una profundidad.',
    entrada: obj(
      {
        obra: OBRA,
        capitulo: {
          type: 'string',
          description: 'Solo este capítulo o subcapítulo (código, título o id).',
        },
        profundidad: {
          type: 'integer',
          minimum: 0,
          description: 'Niveles de subcapítulos bajo cada capítulo (0 = solo capítulos).',
        },
        partidas: { type: 'boolean', description: 'Incluir las partidas (por defecto, sí).' },
      },
      ['obra'],
    ),
    soloLectura: true,
    ejecutar: (a) => {
      const c = cargar(a);
      const r = arbolObra(c.st, {
        capitulo: textoArg(a, 'capitulo', true),
        profundidad: typeof a.profundidad === 'number' ? a.profundidad : undefined,
        partidas: typeof a.partidas === 'boolean' ? a.partidas : undefined,
      });
      if (!r.ok) throw new Fallo('no-encontrado', r.mensaje);
      return { ok: true, fichero: c.fichero, sello: c.sello, capitulos: r.capitulos };
    },
  },
  {
    nombre: 'partida',
    descripcion:
      'Una partida entera: descripción, precio, cantidad e importe, sus líneas de medición una a una (número, comentario, dimensiones, fórmulas, parcial y si sale de un plano), su descompuesto y lo certificado.',
    entrada: obj(
      {
        obra: OBRA,
        ref: { type: 'string', description: 'Su número en el árbol («1.2.3») o su id.' },
      },
      ['obra', 'ref'],
    ),
    soloLectura: true,
    ejecutar: (a) => {
      const c = cargar(a);
      const r = partidaObra(c.st, textoArg(a, 'ref')!);
      if (!r.ok) throw new Fallo('no-encontrado', r.mensaje);
      return { ok: true, fichero: c.fichero, sello: c.sello, partida: r.partida };
    },
  },
  {
    nombre: 'buscar',
    descripcion:
      'Busca partidas de la obra por texto o código (en su número, código y título). Da dónde está cada una.',
    entrada: obj(
      {
        obra: OBRA,
        texto: { type: 'string', description: 'Lo que se busca (2 letras como mínimo).' },
      },
      ['obra', 'texto'],
    ),
    soloLectura: true,
    ejecutar: (a) => {
      const c = cargar(a);
      return { ok: true, fichero: c.fichero, ...buscarEnObra(c.st, textoArg(a, 'texto')!) };
    },
  },
  {
    nombre: 'validar',
    descripcion:
      'Comprueba la obra: errores (referencias rotas, números que no lo son; no debería haber ninguno) y avisos de lo que falta (partidas sin precio, sin medición o sin unidad, capítulos vacíos, partidas distintas con el mismo código). Úsala al terminar un trabajo.',
    entrada: obj({ obra: OBRA }, ['obra']),
    soloLectura: true,
    ejecutar: (a) => {
      const c = cargar(a);
      return { ...validarObra(c.st), fichero: c.fichero };
    },
  },
  {
    nombre: 'editar',
    descripcion:
      `Cambia la obra con una lista de operaciones, en orden, todas o ninguna: si una falla, no se guarda nada y se dice cuál y por qué. Cada lote es un paso de deshacer para el técnico: hazlos pequeños (una partida con sus líneas). ` +
      `Operaciones: ${RESUMEN_OPS}. Sus campos y ejemplos están en la guía (herramienta guia). ` +
      'Partidas por su número («1.2.3») o id; capítulos por código, título o id; líneas por su número en la partida, desde 1. ' +
      'Lo certificado solo con forzar: true y si el técnico lo pidió. Los precios no se inventan.',
    entrada: obj(
      {
        obra: OBRA,
        operaciones: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: { op: { type: 'string', enum: [...TODAS_LAS_OPS] } },
            required: ['op'],
          },
          description: 'Las operaciones, en orden. Ver la guía.',
        },
        sello: {
          type: 'string',
          description:
            'Opcional: el sello de tu última lectura; si la obra cambió desde entonces, no se aplica nada.',
        },
        subirVersion: {
          type: 'boolean',
          description:
            'Solo si la herramienta lo pide al escribir una obra de una versión anterior del formato.',
        },
      },
      ['obra', 'operaciones'],
    ),
    soloLectura: false,
    ejecutar: (a, ctx) => {
      const r0 = resolverObra(ruta(a, 'obra'));
      if (!r0.ok)
        throw new Fallo('obra', r0.mensaje, r0.candidatos ? { candidatos: r0.candidatos } : {});
      const r = editarObra(r0.fichero, a.operaciones, {
        sello: textoArg(a, 'sello', true),
        subirVersion: a.subirVersion === true,
        autor: ctx.autor,
      });
      if (!r.ok) {
        // `resto` lleva también `ok: false`: es lo que devuelve `ejecutar` de todos modos.
        const { motivo, mensaje, ...resto } = r;
        throw new Fallo(motivo, mensaje, resto);
      }
      return {
        ok: true,
        fichero: r.fichero,
        recibos: r.recibos.map(({ status: _s, ...x }) => x),
        sello: r.sello,
        ...estado(),
      };
    },
  },
  {
    nombre: 'seleccion',
    descripcion:
      'Lo que el técnico tiene abierto ahora en la app: la vista, el capítulo, la partida abierta (su número, id, título, cantidad y las líneas que ha elegido), la certificación en curso y el plano. Úsala cuando diga «esta partida», «aquí», «estas líneas». `alDia` dice si la app enseña la versión del fichero de ahora; si no, nombra la partida por su id.',
    entrada: obj({ obra: OBRA }, ['obra']),
    soloLectura: true,
    ejecutar: (a) => {
      const r = resolverObra(ruta(a, 'obra'));
      if (!r.ok) throw new Fallo('obra', r.mensaje, r.candidatos ? { candidatos: r.candidatos } : {});
      const l = leerObra(r.fichero);
      if (!l.ok) throw new Fallo('lectura', l.mensaje);
      const ruta_app = join(dirname(r.fichero), CARPETA_DERIVADOS, nombreAppJson(basename(r.fichero)));
      const e = existsSync(ruta_app) ? leerEstadoApp(readFileSync(ruta_app, 'utf8')) : null;
      if (!e)
        return {
          ok: true,
          fichero: r.fichero,
          abierta: false,
          mensaje:
            'la app no ha dejado lo que tiene abierto: la obra no está abierta en la app desde esta carpeta (en Chrome o Edge, con «Abrir carpeta» o «Pasar a una carpeta»), o el técnico aún no la ha tocado. Pregúntale a qué partida se refiere.',
        };
      cargarEnStore(l.data);
      return {
        ok: true,
        fichero: r.fichero,
        abierta: true,
        sello: l.sello,
        ...seleccionPara(useObraStore.getState(), e, l.huella),
      };
    },
  },
  {
    nombre: 'abrir_app',
    descripcion: `Abre la app (${URL_APP}) en el navegador del técnico.`,
    entrada: obj({}),
    soloLectura: true,
    ejecutar: () => {
      abrirNavegador(URL_APP);
      return { ok: true, url: URL_APP };
    },
  },
];

const POR_NOMBRE = new Map(ORDENES.map((o) => [o.nombre, o]));

/** Ejecuta una orden. Nunca lanza: un fallo es `{ ok: false, motivo, mensaje }`. */
export function ejecutar(nombre: string, args: unknown, ctx: Contexto = {}): Salida {
  const o = POR_NOMBRE.get(nombre);
  if (!o)
    return {
      ok: false,
      motivo: 'orden',
      mensaje: `no hay ninguna orden «${nombre}» (son: ${ORDENES.map((x) => x.nombre).join(', ')})`,
    };
  const a = (typeof args === 'object' && args !== null && !Array.isArray(args) ? args : {}) as Args;
  try {
    return o.ejecutar(a, ctx);
  } catch (e) {
    if (e instanceof Fallo) return { ok: false, motivo: e.motivo, mensaje: e.message, ...e.extra };
    return { ok: false, motivo: 'interno', mensaje: e instanceof Error ? e.message : String(e) };
  }
}
