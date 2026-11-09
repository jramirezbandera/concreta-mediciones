/* ===========================================================================
   persist/carpeta — la obra en una carpeta del ordenador, sincronizada.
   ---------------------------------------------------------------------------
   (docs/plan-agente-carpeta.md F3)

   Una obra VINCULADA a una carpeta sigue guardándose en IndexedDB como todas
   (la persistencia de siempre: candado entre pestañas, migraciones, copias),
   y ADEMÁS se sincroniza con el fichero `<obra>.mediciones.json` de su carpeta,
   en los dos sentidos, mientras es la obra activa:

     · HACIA LA CARPETA: cada cambio de dominio se escribe en el fichero (con
       una pausa corta). Solo si el fichero sigue como se dejó: si cambió fuera,
       no se pisa (CONFLICTO, abajo).
     · DESDE LA CARPETA: el fichero se mira cada segundo (fecha y tamaño). Si
       cambió fuera (lo cambió el agente por el MCP), se lee, se valida y entra
       en el store con `aplicarExterno`: un paso de Deshacer, sin mover lo que
       el técnico tiene abierto, con un aviso y las partidas resaltadas.
     · CONFLICTO: si el fichero cambió fuera mientras aquí había cambios sin
       llevar a la carpeta, no se elige solo: el técnico decide (usar la de la
       carpeta, o quedarse con la suya, que deja la de la carpeta en
       `.mediciones/`). La F4 lo resolverá sin preguntar.

   «Mover» a la carpeta (decisión del usuario): la obra sigue siendo UNA en la
   lista; la copia de IndexedDB es su caché y su red de seguridad.

   La File System Access API solo está en Chrome y Edge (`hayCarpetas`). El
   permiso de escritura se pide con un clic; al volver a abrir el navegador hay
   que darlo otra vez (un clic), salvo «Permitir en cada visita».

   Seguridad entre obras: el store se carga con la obra NUEVA antes de cambiar la
   activa (`persist/sync`). Cada vínculo guarda la `generacionCarga()` con que se
   armó: si cambia, ese vínculo ya no escribe nada.
   =========================================================================== */
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { shallow } from 'zustand/shallow';
import { create } from 'zustand';
import { huellasEnUso } from '../core/planoDatos';
import { compararObras } from '../agente/cambios';
import {
  CARPETA_DERIVADOS,
  SUFIJO_OBRA,
  leerTextoObra,
  nombreFicheroObra,
  textoObra,
} from '../agente/formato';
import {
  toSerializable,
  useObraStore,
  useToastStore,
  type ObraData,
  type ObraState,
} from '../store';
import { DOMAIN_KEYS } from '../store/schema';
import { getDomainRevision, undo } from '../store/temporal';
import { createObra, metaOf } from './registry';
import { guardarPlano, leerBytes, tienePlano } from './planos';
import { useSessionStore } from './sessionStore';
import { alSustituirObra, cargandoObra, flushPending, generacionCarga, switchObra } from './sync';

/* ---- lo mínimo de la File System Access API (no está entera en lib.dom) ----- */

export interface Escritor {
  write(d: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
export interface Fichero {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Escritor>;
}
export interface Directorio {
  kind: 'directory';
  name: string;
  getFileHandle(nombre: string, o?: { create?: boolean }): Promise<Fichero>;
  getDirectoryHandle(nombre: string, o?: { create?: boolean }): Promise<Directorio>;
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(otro: Directorio): Promise<boolean>;
}

type Selector = (o?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<Directorio>;
const selector = (): Selector | undefined =>
  typeof window !== 'undefined'
    ? (window as unknown as { showDirectoryPicker?: Selector }).showDirectoryPicker
    : undefined;

/** ¿Tiene este navegador carpetas? (Chrome y Edge sí; Firefox y Safari, no.) */
export const hayCarpetas = (): boolean => typeof selector() === 'function';

/* ---- huella de un texto ------------------------------------------------------ */

/** Huella rápida de un texto (cyrb53 + longitud): para saber si cambió, no para
 *  seguridad. Síncrona y sin `crypto.subtle`, que no está en todos los entornos. */
export function huellaTexto(t: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}-${t.length}`;
}

/* ---- el registro de vínculos (IndexedDB) ------------------------------------ */

/** El vínculo de una obra con su carpeta, guardado en IndexedDB. */
export interface Vinculo {
  obraId: string;
  dir: Directorio;
  /** Nombre del fichero de la obra en la carpeta. */
  fichero: string;
  /** Huella del texto del fichero la última vez que app y carpeta coincidían. */
  huella: string | null;
  /** Hay cambios de la app que aún no están en la carpeta. */
  pendiente: boolean;
}

const CLAVE = 'concreta6.carpetas';

/** Los handles de esta sesión, por obra. IndexedDB los guarda y los devuelve como
 *  handles en el navegador; aquí se reutilizan los mismos objetos mientras dura la
 *  sesión (y las pruebas, cuyo IndexedDB falso no conserva su prototipo). */
const handles = new Map<string, Directorio>();

async function leerVinculos(): Promise<Record<string, Vinculo>> {
  let v: Record<string, Vinculo>;
  try {
    v = ((await idbGet(CLAVE)) as Record<string, Vinculo> | undefined) ?? {};
  } catch {
    return {};
  }
  for (const x of Object.values(v)) {
    const h = handles.get(x.obraId);
    if (h) x.dir = h;
    else handles.set(x.obraId, x.dir);
  }
  return v;
}

/** Una sola escritura a la vez: dos cambios seguidos del vínculo no se pisan. */
let colaVinculos: Promise<unknown> = Promise.resolve();
function cambiarVinculos(fn: (v: Record<string, Vinculo>) => void): Promise<void> {
  const r = colaVinculos.then(async () => {
    const v = await leerVinculos();
    fn(v);
    for (const x of Object.values(v)) handles.set(x.obraId, x.dir);
    await idbSet(CLAVE, v);
    useCarpetaStore.getState().setCarpetas(resumenVinculos(v));
  });
  colaVinculos = r.catch(() => undefined);
  return r;
}

const resumenVinculos = (
  v: Record<string, Vinculo>,
): Record<string, { carpeta: string; fichero: string }> =>
  Object.fromEntries(
    Object.values(v).map((x) => [x.obraId, { carpeta: x.dir.name, fichero: x.fichero }]),
  );

/* ---- estado para la interfaz -------------------------------------------------- */

export type EstadoCarpeta =
  | { tipo: 'sin-carpeta' }
  | { tipo: 'conectando'; carpeta: string }
  /** Hace falta un clic para dar permiso (al volver a abrir el navegador). */
  | { tipo: 'sin-permiso'; carpeta: string }
  | { tipo: 'al-dia'; carpeta: string; fichero: string }
  | { tipo: 'guardando'; carpeta: string; fichero: string }
  | { tipo: 'conflicto'; carpeta: string; fichero: string; resumen: string }
  | { tipo: 'error'; carpeta: string; mensaje: string };

interface CarpetaUi {
  estado: EstadoCarpeta;
  /** Las obras vinculadas: id → carpeta y fichero (para el selector de obras). */
  carpetas: Record<string, { carpeta: string; fichero: string }>;
  /** Partidas que acaban de cambiar fuera, para resaltarlas, y hasta cuándo. */
  resaltadas: { ids: ReadonlySet<string>; hasta: number };
  setEstado: (e: EstadoCarpeta) => void;
  setCarpetas: (c: CarpetaUi['carpetas']) => void;
}

/** Cuánto dura el resaltado de lo que cambió fuera. */
export const RESALTE_MS = 6000;

export const useCarpetaStore = create<CarpetaUi>((set) => ({
  estado: { tipo: 'sin-carpeta' },
  carpetas: {},
  resaltadas: { ids: new Set(), hasta: 0 },
  setEstado: (estado) => set({ estado }),
  setCarpetas: (carpetas) => set({ carpetas }),
}));
const ui = () => useCarpetaStore.getState();

/* ---- la sincronización de la obra activa -------------------------------------- */

/** Cada cuánto se mira el fichero (como Concreta FEM). */
export const VIGILANCIA_MS = 1000;
/** Pausa entre un cambio y llevarlo a la carpeta. */
export const PAUSA_GUARDAR_MS = 600;

interface Activo {
  v: Vinculo;
  /** `generacionCarga()` cuando se armó: si cambia, otra obra está en el store. */
  generacion: number;
  /** Fecha y tamaño del fichero la última vez que se miró. */
  marca: string | null;
  /** La obra de la carpeta en conflicto, a la espera de que decida el técnico. */
  ajena?: { data: ObraData; texto: string; huella: string };
}

let activo: Activo | null = null;
let armada = false;
/** El gancho de `sync` se pone una vez (sobrevive a `__resetCarpetaForTests`). */
let enganchada = false;
/** Lo que hay que soltar al desarmar (pruebas). */
const soltar: (() => void)[] = [];
let temporizador: ReturnType<typeof setTimeout> | null = null;
let vigilancia: ReturnType<typeof setInterval> | null = null;
/** Mientras se aplica lo de fuera, sus cambios de dominio no son «pendientes». */
let aplicando = false;
/** Una operación con el fichero a la vez (mirar, guardar, resolver). */
let ocupado: Promise<void> = Promise.resolve();
function enSerie(fn: () => Promise<void>): Promise<void> {
  const r = ocupado.then(fn);
  ocupado = r.catch(() => undefined);
  return r;
}

const valido = (a: Activo | null): a is Activo =>
  !!a &&
  a === activo &&
  a.generacion === generacionCarga() &&
  useSessionStore.getState().activeId === a.v.obraId;

const marcaDe = (f: File) => `${f.lastModified}/${f.size}`;
const textoDeLaApp = () => textoObra(toSerializable(useObraStore.getState()));

async function permiso(dir: Directorio, pedir: boolean): Promise<boolean> {
  const o = { mode: 'readwrite' as const };
  const q = (await dir.queryPermission?.(o)) ?? 'granted';
  if (q === 'granted') return true;
  if (!pedir) return false;
  return ((await dir.requestPermission?.(o)) ?? 'granted') === 'granted';
}

async function escribirTexto(
  dir: Directorio,
  nombre: string,
  datos: string | ArrayBuffer,
): Promise<void> {
  const h = await dir.getFileHandle(nombre, { create: true });
  const w = await h.createWritable(); // escribe en un temporal y lo cambia al cerrar
  try {
    await w.write(datos);
    await w.close();
  } catch (e) {
    await w.abort().catch(() => undefined);
    throw e;
  }
}

async function existe(dir: Directorio, nombre: string): Promise<boolean> {
  try {
    await dir.getFileHandle(nombre);
    return true;
  } catch {
    return false;
  }
}

/** Los ficheros de obra de una carpeta. */
export async function obrasDeLaCarpeta(dir: Directorio): Promise<string[]> {
  const r: string[] = [];
  for await (const e of dir.values()) {
    if (e.kind === 'file' && e.name.toLowerCase().endsWith(SUFIJO_OBRA)) r.push(e.name);
  }
  return r.sort((a, b) => a.localeCompare(b));
}

/** Arranca la sincronización (una vez, tras hidratar). */
export function armarCarpeta(): void {
  if (armada) return;
  armada = true;
  if (!enganchada) alSustituirObra(() => llevarYa());
  enganchada = true;
  soltar.push(
    useSessionStore.subscribe((s, p) => {
      if (s.activeId !== p.activeId) void retarget(s.activeId);
    }),
    useObraStore.subscribe(
      (s: ObraState) => DOMAIN_KEYS.map((k) => s[k]),
      () => alCambiarDominio(),
      { equalityFn: shallow },
    ),
  );
  vigilancia = setInterval(() => void mirar(), VIGILANCIA_MS);
  if (typeof document !== 'undefined') {
    const alVer = () => {
      if (document.visibilityState === 'visible') void mirar();
      else void llevarYa(); // al irse de la pestaña, lo pendiente a la carpeta
    };
    document.addEventListener('visibilitychange', alVer);
    soltar.push(() => document.removeEventListener('visibilitychange', alVer));
  }
  void (async () => {
    const v = await leerVinculos();
    // Vínculos de obras que ya no existen (se borraron): fuera.
    const ids = new Set(useSessionStore.getState().obras.map((o) => o.id));
    if (Object.keys(v).some((id) => !ids.has(id)) && ids.size > 0) {
      await cambiarVinculos((x) => {
        for (const id of Object.keys(x)) if (!ids.has(id)) delete x[id];
      });
    } else ui().setCarpetas(resumenVinculos(v));
    await retarget(useSessionStore.getState().activeId);
  })();
}

/** La obra activa cambió: suelta el vínculo anterior y arma el de la nueva. */
async function retarget(id: string | null): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  activo = null;
  if (!id) return ui().setEstado({ tipo: 'sin-carpeta' });
  const v = (await leerVinculos())[id];
  if (useSessionStore.getState().activeId !== id) return; // se conmutó entre medias
  if (!v) return ui().setEstado({ tipo: 'sin-carpeta' });
  const a: Activo = { v, generacion: generacionCarga(), marca: null };
  activo = a;
  ui().setEstado({ tipo: 'conectando', carpeta: v.dir.name });
  if (!(await permiso(v.dir, false))) {
    if (a === activo) ui().setEstado({ tipo: 'sin-permiso', carpeta: v.dir.name });
    return;
  }
  await enSerie(() => conectar(a));
}

/** Con un clic del técnico: pide el permiso y conecta la carpeta de la obra activa. */
export async function conectarCarpeta(): Promise<boolean> {
  const a = activo;
  if (!a) return false;
  if (!(await permiso(a.v.dir, true))) {
    ui().setEstado({ tipo: 'sin-permiso', carpeta: a.v.dir.name });
    return false;
  }
  await enSerie(() => conectar(a));
  return true;
}

/** Primera lectura del fichero tras armar el vínculo. */
async function conectar(a: Activo): Promise<void> {
  if (!valido(a)) return;
  let f: File;
  try {
    f = await (await a.v.dir.getFileHandle(a.v.fichero)).getFile();
  } catch {
    return ui().setEstado({
      tipo: 'error',
      carpeta: a.v.dir.name,
      mensaje: `No está ${a.v.fichero} en la carpeta ${a.v.dir.name}. Se sigue guardando en el navegador.`,
    });
  }
  a.marca = marcaDe(f);
  const texto = await f.text();
  const h = huellaTexto(texto);
  if (h === a.v.huella) {
    ui().setEstado({ tipo: 'al-dia', carpeta: a.v.dir.name, fichero: a.v.fichero });
    if (a.v.pendiente) await guardar(a); // lo de la última sesión que no llegó
    return;
  }
  await deFuera(a, texto, h);
}

/** Mira si el fichero cambió (cada segundo). */
function mirar(): Promise<void> {
  const a = activo;
  if (!a || useSessionStore.getState().readonly) return Promise.resolve();
  const e = ui().estado.tipo;
  if (e === 'sin-permiso' || e === 'conflicto' || e === 'conectando') return Promise.resolve();
  return enSerie(async () => {
    if (!valido(a)) return;
    let f: File;
    try {
      f = await (await a.v.dir.getFileHandle(a.v.fichero)).getFile();
    } catch {
      return ui().setEstado({
        tipo: 'error',
        carpeta: a.v.dir.name,
        mensaje: `Ya no está ${a.v.fichero} en la carpeta ${a.v.dir.name}. Se sigue guardando en el navegador.`,
      });
    }
    const m = marcaDe(f);
    if (m === a.marca) return;
    const texto = await f.text();
    a.marca = m;
    const h = huellaTexto(texto);
    if (h === a.v.huella) return;
    await deFuera(a, texto, h);
  });
}

/** El fichero trae otra versión: se aplica, o es un conflicto. */
async function deFuera(a: Activo, texto: string, h: string): Promise<void> {
  const l = leerTextoObra(texto);
  if (!l.ok) {
    return ui().setEstado({
      tipo: 'error',
      carpeta: a.v.dir.name,
      mensaje: `${a.v.fichero} cambió y no se puede usar (${l.mensaje}): no se aplica. La obra sigue como estaba.`,
    });
  }
  if (a.v.pendiente) {
    a.ajena = { data: l.data, texto, huella: h };
    const c = compararObras(toSerializable(useObraStore.getState()), l.data);
    return ui().setEstado({
      tipo: 'conflicto',
      carpeta: a.v.dir.name,
      fichero: a.v.fichero,
      resumen: c.texto,
    });
  }
  await aplicar(a, l.data, h);
}

/** Mete en el store la obra que viene de la carpeta (un paso de Deshacer). */
async function aplicar(a: Activo, data: ObraData, h: string): Promise<void> {
  // Otra pestaña es la dueña de la obra: ella lo aplica; esta no lo da por visto.
  if (useSessionStore.getState().readonly) return;
  const antes = toSerializable(useObraStore.getState());
  aplicando = true;
  try {
    useObraStore.getState().aplicarExterno(data);
  } finally {
    aplicando = false;
  }
  a.v.huella = h;
  a.v.pendiente = false;
  a.ajena = undefined;
  await cambiarVinculos((x) => {
    if (x[a.v.obraId]) Object.assign(x[a.v.obraId]!, { huella: h, pendiente: false });
  });
  ui().setEstado({ tipo: 'al-dia', carpeta: a.v.dir.name, fichero: a.v.fichero });
  const c = compararObras(antes, data);
  if (c.hayCambios) {
    useToastStore
      .getState()
      .show(
        `La obra cambió en su carpeta: ${c.texto}`,
        { label: 'Deshacer', run: () => undo() },
        { rev: getDomainRevision() },
      );
    useCarpetaStore.setState({
      resaltadas: { ids: new Set(c.partidasTocadas), hasta: Date.now() + RESALTE_MS },
    });
  }
  void traerPlanos(a, data);
}

/** Cambio de dominio en la app: hay algo que llevar a la carpeta. */
function alCambiarDominio(): void {
  if (aplicando || cargandoObra()) return;
  const a = activo;
  if (!valido(a) || useSessionStore.getState().readonly) return;
  if (!a.v.pendiente) {
    a.v.pendiente = true;
    void cambiarVinculos((x) => {
      if (x[a.v.obraId]) x[a.v.obraId]!.pendiente = true;
    });
  }
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void enSerie(() => guardar(a));
  }, PAUSA_GUARDAR_MS);
}

/** Lleva ya a la carpeta lo pendiente (al salir de la pestaña, antes de conmutar). */
export function llevarYa(): Promise<void> {
  const a = activo;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (!a?.v.pendiente) return Promise.resolve();
  return enSerie(() => guardar(a));
}

/** Escribe la obra de la app en el fichero, si sigue como se dejó. */
async function guardar(a: Activo, forzar = false): Promise<void> {
  if (!valido(a) || useSessionStore.getState().readonly) return;
  const e = ui().estado.tipo;
  if (!forzar && (e === 'conflicto' || e === 'sin-permiso' || e === 'conectando')) return;
  if (!(await permiso(a.v.dir, false)))
    return ui().setEstado({ tipo: 'sin-permiso', carpeta: a.v.dir.name });
  const texto = textoDeLaApp();
  const h = huellaTexto(texto);
  const carpeta = a.v.dir.name;
  const fichero = a.v.fichero;
  if (h !== a.v.huella) {
    try {
      if (!forzar) {
        // ¿Cambió fuera desde la última vez? Entonces no se pisa: lo verá `mirar`.
        const f = await (await a.v.dir.getFileHandle(fichero)).getFile();
        if (marcaDe(f) !== a.marca && huellaTexto(await f.text()) !== a.v.huella) {
          a.marca = null; // que `mirar` lo lea
          return;
        }
      }
      ui().setEstado({ tipo: 'guardando', carpeta, fichero });
      await escribirTexto(a.v.dir, fichero, texto);
      a.marca = marcaDe(await (await a.v.dir.getFileHandle(fichero)).getFile());
    } catch (err) {
      return ui().setEstado({
        tipo: 'error',
        carpeta,
        mensaje: `No se pudo guardar en la carpeta ${carpeta} (${err instanceof Error ? err.message : String(err)}). Se sigue guardando en el navegador.`,
      });
    }
  }
  if (!valido(a)) return;
  a.v.huella = h;
  a.v.pendiente = false;
  await cambiarVinculos((x) => {
    if (x[a.v.obraId]) Object.assign(x[a.v.obraId]!, { huella: h, pendiente: false });
  });
  ui().setEstado({ tipo: 'al-dia', carpeta, fichero });
  void llevarPlanos(a);
}

/* ---- conflicto ------------------------------------------------------------------ */

/** Conflicto: se usa la obra de la carpeta. Lo de la app queda en el Deshacer. */
export function usarLaDeLaCarpeta(): Promise<void> {
  const a = activo;
  if (!a?.ajena) return Promise.resolve();
  const { data, huella } = a.ajena;
  return enSerie(async () => {
    if (!valido(a)) return;
    a.v.pendiente = false;
    await aplicar(a, data, huella);
  });
}

/** Conflicto: se queda la de la app. La de la carpeta se guarda en `.mediciones/`. */
export function quedarmeConLaMia(): Promise<void> {
  const a = activo;
  if (!a?.ajena) return Promise.resolve();
  const { texto } = a.ajena;
  return enSerie(async () => {
    if (!valido(a)) return;
    const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
      const d = await a.v.dir.getDirectoryHandle(CARPETA_DERIVADOS, { create: true });
      await escribirTexto(
        d,
        `${a.v.fichero.replace(SUFIJO_OBRA, '')}.conflicto-${fecha}${SUFIJO_OBRA}`,
        texto,
      );
    } catch {
      // sin la copia: se sigue (el técnico eligió quedarse con la suya)
    }
    a.ajena = undefined;
    await guardar(a, true);
  });
}

/* ---- planos ---------------------------------------------------------------------- */

const nombrePlano = (h: string) => `${h}.pdf`;

/** Los PDF de la obra que aún no están en `planos/` de la carpeta. */
async function llevarPlanos(a: Activo): Promise<void> {
  if (!valido(a)) return;
  const huellas = huellasEnUso(toSerializable(useObraStore.getState()));
  if (huellas.length === 0) return;
  try {
    const d = await a.v.dir.getDirectoryHandle('planos', { create: true });
    for (const h of huellas) {
      if (await existe(d, nombrePlano(h))) continue;
      const bytes = await leerBytes(h);
      if (bytes) await escribirTexto(d, nombrePlano(h), bytes);
    }
  } catch {
    // sin planos en la carpeta: la obra sigue
  }
}

/** Los PDF que trae la obra de la carpeta y aún no están en el navegador. */
async function traerPlanos(a: Activo, data: ObraData): Promise<void> {
  const huellas = huellasEnUso(data);
  if (huellas.length === 0) return;
  let d: Directorio;
  try {
    d = await a.v.dir.getDirectoryHandle('planos');
  } catch {
    return;
  }
  for (const h of huellas) {
    try {
      if (await tienePlano(h)) continue;
      const f = await (await d.getFileHandle(nombrePlano(h))).getFile();
      const nombre = data.planos.find((p) => p.huella === h)?.archivo;
      await guardarPlano(h, await f.arrayBuffer(), 'application/pdf', nombre);
    } catch {
      // ese plano no está en la carpeta: el visor lo dirá al abrirlo
    }
  }
}

/* ---- pasar a una carpeta, abrir una carpeta, dejarla -------------------------------- */

export type ResultadoCarpeta =
  | { ok: true; mensaje: string }
  | { ok: false; mensaje: string; cancelada?: boolean };

async function elegir(): Promise<Directorio | null> {
  try {
    return await selector()!({ mode: 'readwrite', id: 'concreta-mediciones' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/** ¿Está ya esta carpeta vinculada a alguna obra? Devuelve su vínculo. */
async function vinculoDe(dir: Directorio): Promise<Vinculo | null> {
  for (const v of Object.values(await leerVinculos())) {
    try {
      if (await v.dir.isSameEntry?.(dir)) return v;
    } catch {
      // un vínculo viejo que ya no responde
    }
  }
  return null;
}

/**
 * «Pasar a una carpeta»: la obra activa pasa a vivir en una carpeta (decisión del
 * usuario: MOVER, no copiar). Escribe el fichero y los planos y vincula la obra.
 * Nunca pisa una obra que ya esté en la carpeta.
 */
export async function pasarACarpeta(): Promise<ResultadoCarpeta> {
  if (!hayCarpetas())
    return { ok: false, mensaje: 'Este navegador no tiene carpetas: usa Chrome o Edge.' };
  if (useSessionStore.getState().readonly)
    return { ok: false, mensaje: 'Esta pestaña está en solo lectura.' };
  const dir = await elegir();
  if (!dir) return { ok: false, mensaje: '', cancelada: true };
  if (!(await permiso(dir, true)))
    return { ok: false, mensaje: `No hay permiso para escribir en la carpeta ${dir.name}.` };
  if (!(await flushPending()))
    return {
      ok: false,
      mensaje: 'No se pudo guardar la obra en el navegador: inténtalo de nuevo.',
    };
  const id = useSessionStore.getState().activeId;
  if (!id)
    return { ok: false, mensaje: 'Haz algún cambio en la obra antes, para que quede guardada.' };
  if ((await leerVinculos())[id])
    return { ok: false, mensaje: 'Esta obra ya está en una carpeta.' };
  const otra = await vinculoDe(dir);
  if (otra) return { ok: false, mensaje: `La carpeta ${dir.name} ya es la de otra obra.` };
  const ya = await obrasDeLaCarpeta(dir);
  if (ya.length) {
    return {
      ok: false,
      mensaje: `La carpeta ${dir.name} ya tiene una obra (${ya[0]}): elige otra carpeta, o ábrela con «Abrir carpeta».`,
    };
  }
  const fichero = nombreFicheroObra(useObraStore.getState().obra.denominacion);
  const texto = textoDeLaApp();
  try {
    await escribirTexto(dir, fichero, texto);
  } catch (e) {
    return {
      ok: false,
      mensaje: `No se pudo escribir en ${dir.name}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  await cambiarVinculos((x) => {
    x[id] = { obraId: id, dir, fichero, huella: huellaTexto(texto), pendiente: false };
  });
  await retarget(id);
  if (activo) await llevarPlanos(activo);
  return { ok: true, mensaje: `La obra está ahora en la carpeta ${dir.name} (${fichero}).` };
}

export type ResultadoAbrir =
  | ResultadoCarpeta
  /** La carpeta tiene varias obras: que el técnico elija (`abrirObraDeCarpeta`). */
  | { ok: false; varias: true; dir: Directorio; ficheros: string[]; mensaje: string };

/** «Abrir carpeta»: abre la obra de una carpeta (la añade a la lista y la activa). */
export async function abrirCarpeta(): Promise<ResultadoAbrir> {
  if (!hayCarpetas())
    return { ok: false, mensaje: 'Este navegador no tiene carpetas: usa Chrome o Edge.' };
  const dir = await elegir();
  if (!dir) return { ok: false, mensaje: '', cancelada: true };
  const ficheros = await obrasDeLaCarpeta(dir);
  if (ficheros.length === 0)
    return {
      ok: false,
      mensaje: `La carpeta ${dir.name} no tiene ninguna obra (*${SUFIJO_OBRA}).`,
    };
  if (ficheros.length > 1)
    return {
      ok: false,
      varias: true,
      dir,
      ficheros,
      mensaje: `La carpeta ${dir.name} tiene ${ficheros.length} obras.`,
    };
  return abrirObraDeCarpeta(dir, ficheros[0]!);
}

/** Abre `fichero` de `dir`: si ya es una obra de la lista, la activa; si no, la crea. */
export async function abrirObraDeCarpeta(
  dir: Directorio,
  fichero: string,
): Promise<ResultadoCarpeta> {
  const ya = await vinculoDe(dir);
  if (ya && ya.fichero === fichero) {
    await switchObra(ya.obraId);
    if (activo?.v.obraId === ya.obraId && ui().estado.tipo === 'sin-permiso')
      await conectarCarpeta();
    return { ok: true, mensaje: `Abierta la obra de la carpeta ${dir.name}.` };
  }
  if (ya)
    return { ok: false, mensaje: `La carpeta ${dir.name} ya es la de otra obra de la lista.` };
  let texto: string;
  try {
    texto = await (await (await dir.getFileHandle(fichero)).getFile()).text();
  } catch {
    return { ok: false, mensaje: `No se pudo leer ${fichero}.` };
  }
  const l = leerTextoObra(texto);
  if (!l.ok) return { ok: false, mensaje: `${fichero} no se puede abrir: ${l.mensaje}.` };
  if (!(await flushPending()))
    return { ok: false, mensaje: 'No se pudo guardar la obra abierta: inténtalo de nuevo.' };
  const id = await createObra(l.data);
  useSessionStore.getState().upsertObra(metaOf(id, l.data));
  await cambiarVinculos((x) => {
    x[id] = { obraId: id, dir, fichero, huella: huellaTexto(texto), pendiente: false };
  });
  await traerPlanosDe(dir, l.data);
  await switchObra(id);
  return { ok: true, mensaje: `Abierta la obra de la carpeta ${dir.name} (${fichero}).` };
}

async function traerPlanosDe(dir: Directorio, data: ObraData): Promise<void> {
  const a: Activo = {
    v: { obraId: '', dir, fichero: '', huella: null, pendiente: false },
    generacion: -1,
    marca: null,
  };
  await traerPlanos(a, data);
}

/** Deja de usar la carpeta: la obra sigue en el navegador; el fichero, en la carpeta. */
export async function dejarLaCarpeta(): Promise<void> {
  const id = useSessionStore.getState().activeId;
  if (!id) return;
  await llevarYa();
  await cambiarVinculos((x) => {
    delete x[id];
  });
  await retarget(id);
}

/** Solo para pruebas. */
export function __resetCarpetaForTests(): void {
  for (const s of soltar.splice(0)) s();
  if (vigilancia) clearInterval(vigilancia);
  if (temporizador) clearTimeout(temporizador);
  vigilancia = null;
  temporizador = null;
  activo = null;
  armada = false;
  aplicando = false;
  handles.clear();
  ocupado = Promise.resolve();
  colaVinculos = Promise.resolve();
  useCarpetaStore.setState({
    estado: { tipo: 'sin-carpeta' },
    carpetas: {},
    resaltadas: { ids: new Set(), hasta: 0 },
  });
}

/** Solo para pruebas: mira el fichero ahora y espera a que termine. */
export function __mirarAhoraForTests(): Promise<void> {
  return mirar();
}
/** Solo para pruebas: espera a la cola de operaciones con el fichero. */
export function __esperarCarpetaForTests(): Promise<void> {
  return enSerie(async () => undefined);
}
