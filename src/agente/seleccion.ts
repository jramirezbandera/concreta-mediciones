/* ===========================================================================
   agente/seleccion — lo que el técnico tiene abierto en la app (D7, F4).
   ---------------------------------------------------------------------------
   La app deja en `.mediciones/<obra>.app.json` (`nombreAppJson`) la vista, el
   capítulo, la partida abierta, las líneas elegidas, la certificación en
   curso y el plano, todo por id, con la huella de la versión del fichero que
   enseña y si tiene cambios sin llevar a la carpeta. Lo reescribe poco después
   de cada cambio.

   La orden `seleccion` del MCP lo traduce a lo que entiende el agente (el
   número de la partida en el árbol, su título, los números de las líneas) con
   la obra del fichero, y dice si la app está AL DÍA con él: si no, los números
   pueden no ser los que ve el técnico, y el id es lo que vale.

   Puro: sin Node ni navegador.
   =========================================================================== */
import { findNode, findPartidaById } from '../core/tree';
import { partidaCantidad } from '../core/medicion';
import type { ObraState } from '../store';

export const VERSION_APP_JSON = 1;

/** Lo que escribe la app. */
export interface EstadoApp {
  version: typeof VERSION_APP_JSON;
  fichero: string;
  /** Cuándo lo escribió. */
  fecha: string;
  /** La versión de la app. */
  app: string;
  /** `huellaTexto` de la versión del fichero que la app tiene en común con la carpeta. */
  huella: string | null;
  /** La app tiene cambios que aún no están en el fichero. */
  cambiosSinGuardar: boolean;
  /** La pestaña está a la vista. */
  visible: boolean;
  vista: string;
  /** Id del capítulo o subcapítulo elegido en el árbol; null = toda la obra. */
  capitulo: string | null;
  /** Id de la partida abierta. */
  partida: string | null;
  /** Ids de las líneas elegidas en la partida abierta. */
  lineas: string[];
  /** Número de la certificación en curso. */
  certificacion: number | null;
  plano: { id: string; pagina: number } | null;
}

const esTexto = (x: unknown): x is string => typeof x === 'string';
const textoONulo = (x: unknown): string | null => (esTexto(x) ? x : null);

/** Lee el `app.json`; null si no lo es. */
export function leerEstadoApp(texto: string): EstadoApp | null {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null || o.version !== VERSION_APP_JSON) return null;
  if (!esTexto(o.fichero) || !esTexto(o.fecha)) return null;
  const pl = o.plano as { id?: unknown; pagina?: unknown } | null | undefined;
  return {
    version: VERSION_APP_JSON,
    fichero: o.fichero,
    fecha: o.fecha,
    app: esTexto(o.app) ? o.app : '',
    huella: textoONulo(o.huella),
    cambiosSinGuardar: o.cambiosSinGuardar === true,
    visible: o.visible !== false,
    vista: esTexto(o.vista) ? o.vista : '',
    capitulo: textoONulo(o.capitulo),
    partida: textoONulo(o.partida),
    lineas: Array.isArray(o.lineas) ? o.lineas.filter(esTexto) : [],
    certificacion: typeof o.certificacion === 'number' ? o.certificacion : null,
    plano:
      pl && esTexto(pl.id) && typeof pl.pagina === 'number'
        ? { id: pl.id, pagina: pl.pagina }
        : null,
  };
}

/** Lo que tiene abierto, en un estado comparable (sin la fecha): para no reescribirlo igual. */
export const claveEstadoApp = (e: EstadoApp): string => JSON.stringify({ ...e, fecha: '' });

/** Hace cuánto, en palabras («hace 12 s», «hace 3 min»). */
function hace(fecha: string, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - Date.parse(fecha)) / 1000));
  if (!Number.isFinite(s)) return '';
  if (s < 90) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

/** La selección para el agente, resuelta sobre la obra del fichero (`st`). */
export function seleccionPara(
  st: Pick<ObraState, 'chapters' | 'partidas' | 'certs' | 'planos'>,
  e: EstadoApp,
  huellaFichero: string,
  ahora = Date.now(),
) {
  const alDia = !e.cambiosSinGuardar && e.huella === huellaFichero;
  const avisos: string[] = [];
  if (!alDia)
    avisos.push(
      e.cambiosSinGuardar
        ? 'el técnico tiene cambios que aún no están en el fichero (llegan en un segundo): si algo no cuadra, vuelve a pedir la selección'
        : 'la app enseña otra versión del fichero que la de ahora: los números pueden haber cambiado; usa los id',
    );

  let partida: Record<string, unknown> | null = null;
  if (e.partida) {
    const hit = findPartidaById(st.partidas, e.partida);
    if (hit) {
      const p = hit.partida;
      const ch = findNode(st.chapters, p.sub ?? hit.chapterId)?.node;
      const elegidas = e.lineas
        .map((id) => p.med.findIndex((l) => l.id === id) + 1)
        .filter((i) => i > 0);
      partida = {
        ref: p.pos,
        id: p.id,
        codigo: p.code,
        titulo: p.title,
        ud: p.ud,
        cantidad: partidaCantidad(p),
        precio: p.precio,
        lineas: p.med.length,
        ...(ch ? { en: `${ch.code} ${ch.title}` } : {}),
        ...(elegidas.length ? { lineasElegidas: elegidas } : {}),
      };
    } else {
      partida = { id: e.partida, enElFichero: false };
      avisos.push(
        'la partida abierta aún no está en el fichero (la acaba de crear el técnico): vuelve a pedir la selección en un par de segundos',
      );
    }
  }

  const nodo = e.capitulo ? findNode(st.chapters, e.capitulo)?.node : undefined;
  const cert =
    e.certificacion != null ? st.certs.find((c) => c.num === e.certificacion) : undefined;
  const plano = e.plano ? st.planos.find((p) => p.id === e.plano!.id) : undefined;

  return {
    alDia,
    fecha: e.fecha,
    hace: hace(e.fecha, ahora),
    visible: e.visible,
    vista: e.vista,
    capitulo: nodo ? { ref: nodo.code, id: nodo.id, titulo: nodo.title } : null,
    partida,
    certificacion: cert ? { num: cert.num, periodo: cert.period, emitida: !!cert.emitidaAt } : null,
    plano: plano && e.plano ? { id: plano.id, nombre: plano.nombre, pagina: e.plano.pagina } : null,
    ...(avisos.length ? { avisos } : {}),
  };
}
