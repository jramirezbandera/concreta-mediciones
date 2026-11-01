/* ===========================================================================
   core/ess/seleccion — qué fichas salen en el estudio y cómo las ha editado
   el técnico (docs/plan-seguridad-salud.md, E2). PURO.

   La selección se guarda como DIFERENCIA con la propuesta (`SeleccionFichas`,
   D2): un cambio en el presupuesto se refleja sin perder lo que el técnico
   decidió. Lo que edita dentro de una ficha se guarda por ficha: los riesgos
   por clave, las medidas, protecciones y EPI por texto. Viene de
   concreta-instalaciones (feature-35, paso 4) sin cambios de criterio; aquí
   recibe la propuesta ya calculada (`reglas.fichasPropuestas`).
   =========================================================================== */
import { FICHAS_EBSS, textoItem } from './catalogo';
import type { FichaPropuesta, PartidaMotivo } from './reglas';
import type {
  EdicionFicha,
  EdicionLista,
  FichaCatalogo,
  ItemFicha,
  SeleccionFichas,
} from './tipos';

/** Una ficha del catálogo tal como la ve la pantalla: si la propone la app y si sale en el estudio. */
export interface FichaEnSeleccion {
  ficha: FichaCatalogo;
  propuesta: boolean;
  /** Los motivos de la propuesta; vacío si no la propone la app. */
  motivos: string[];
  /** Las partidas que la piden. */
  partidas: PartidaMotivo[];
  /** Sale en el estudio: propuesta y no quitada, o añadida por el técnico. */
  marcada: boolean;
}

/**
 * ¿Sale la ficha en el estudio? Una añadida sale siempre; una propuesta, salvo
 * que el técnico la haya quitado. Lo quitado sigue quitado aunque cambie la
 * obra, y lo que la app pasa a proponer aparece solo.
 */
export function estaMarcada(
  id: string,
  propuesta: boolean,
  sel: SeleccionFichas | undefined,
): boolean {
  if (sel?.anadidas?.includes(id)) return true;
  return propuesta && !(sel?.quitadas?.includes(id) ?? false);
}

/** Todo el catálogo, en su orden, con la propuesta y la selección de esta obra. */
export function seleccionDeFichas(
  propuestas: readonly FichaPropuesta[],
  sel: SeleccionFichas | undefined,
): FichaEnSeleccion[] {
  const por = new Map(propuestas.map((f) => [f.id, f]));
  return FICHAS_EBSS.map((ficha) => {
    const p = por.get(ficha.id);
    return {
      ficha,
      propuesta: p !== undefined,
      motivos: p?.motivos ?? [],
      partidas: p?.partidas ?? [],
      marcada: estaMarcada(ficha.id, p !== undefined, sel),
    };
  });
}

const sin = (xs: readonly string[] | undefined, id: string): string[] =>
  (xs ?? []).filter((x) => x !== id);
const con = (xs: readonly string[] | undefined, id: string): string[] => [...sin(xs, id), id];

/** La selección sin listas vacías. */
function limpia(s: SeleccionFichas): SeleccionFichas {
  const out: SeleccionFichas = {};
  if (s.anadidas && s.anadidas.length > 0) out.anadidas = s.anadidas;
  if (s.quitadas && s.quitadas.length > 0) out.quitadas = s.quitadas;
  if (s.ediciones && Object.keys(s.ediciones).length > 0) out.ediciones = s.ediciones;
  return out;
}

/**
 * Marca o quita una ficha. Marcar: deja de estar quitada y, si la app no la
 * propone, pasa a añadida. Quitar: deja de estar añadida y, si la app la
 * propone, pasa a quitada. Las ediciones de la ficha se conservan.
 */
export function marcarFicha(
  sel: SeleccionFichas | undefined,
  id: string,
  marcada: boolean,
  propuesta: boolean,
): SeleccionFichas {
  const s = sel ?? {};
  if (marcada)
    return limpia({
      ...s,
      quitadas: sin(s.quitadas, id),
      anadidas: propuesta ? sin(s.anadidas, id) : con(s.anadidas, id),
    });
  return limpia({
    ...s,
    anadidas: sin(s.anadidas, id),
    quitadas: propuesta ? con(s.quitadas, id) : sin(s.quitadas, id),
  });
}

/** Guarda la edición de una ficha; una edición vacía la borra. */
export function conEdicion(
  sel: SeleccionFichas | undefined,
  id: string,
  ed: EdicionFicha | undefined,
): SeleccionFichas {
  const ediciones = { ...(sel?.ediciones ?? {}) };
  if (ed && edicionNoVacia(ed)) ediciones[id] = ed;
  else delete ediciones[id];
  return limpia({ ...(sel ?? {}), ediciones });
}

const listaNoVacia = (l: EdicionLista | undefined): boolean =>
  (l?.quitados?.length ?? 0) > 0 || (l?.anadidos?.length ?? 0) > 0;

function edicionNoVacia(ed: EdicionFicha): boolean {
  return (
    (ed.riesgos?.quitados?.length ?? 0) > 0 ||
    (ed.riesgos?.anadidos?.length ?? 0) > 0 ||
    listaNoVacia(ed.medidas) ||
    listaNoVacia(ed.protecciones) ||
    listaNoVacia(ed.epi) ||
    ed.revisada === true
  );
}

/** Una lista de la ficha sin los textos quitados y con los añadidos al final. */
function editarLista(items: readonly ItemFicha[], ed: EdicionLista | undefined): ItemFicha[] {
  if (!ed) return [...items];
  const quitados = new Set(ed.quitados ?? []);
  const anadidos = (ed.anadidos ?? []).filter((t) => !items.some((i) => textoItem(i) === t));
  return [...items.filter((i) => !quitados.has(textoItem(i))), ...anadidos];
}

/**
 * La ficha con lo que edita el técnico. Los riesgos se quitan por clave
 * (también de los que evita una protección colectiva) y los añadidos van al
 * final; las medidas, protecciones y EPI se quitan por texto: si el catálogo
 * cambia el texto, la medida vuelve a salir.
 */
export function fichaEditada(f: FichaCatalogo, ed: EdicionFicha | undefined): FichaCatalogo {
  if (!ed) return f;
  const quitados = new Set(ed.riesgos?.quitados ?? []);
  const riesgos = f.riesgos.filter((r) => !quitados.has(r.clave));
  const anadidos = (ed.riesgos?.anadidos ?? []).filter(
    (r) => !riesgos.some((x) => x.clave === r.clave),
  );
  const out: FichaCatalogo = {
    ...f,
    riesgos: [...riesgos, ...anadidos],
    medidas: editarLista(f.medidas, ed.medidas),
    protecciones: editarLista(f.protecciones, ed.protecciones),
    epi: editarLista(f.epi, ed.epi),
  };
  if (f.evita) out.evita = f.evita.filter((r) => !quitados.has(r.clave));
  return out;
}

/** Las fichas que salen en el estudio, en el orden del catálogo y ya editadas. */
export function fichasDelEstudio(
  propuestas: readonly FichaPropuesta[],
  sel: SeleccionFichas | undefined,
): FichaCatalogo[] {
  const ediciones = sel?.ediciones ?? {};
  return seleccionDeFichas(propuestas, sel)
    .filter((f) => f.marcada)
    .map((f) => fichaEditada(f.ficha, ediciones[f.ficha.id]));
}

/** Las fichas «redactadas por la app» que salen sin que el técnico las haya revisado. */
export function fichasSinRevisar(
  propuestas: readonly FichaPropuesta[],
  sel: SeleccionFichas | undefined,
): FichaCatalogo[] {
  const ediciones = sel?.ediciones ?? {};
  return seleccionDeFichas(propuestas, sel)
    .filter(
      (f) =>
        f.marcada && f.ficha.redactadaPorApp === true && ediciones[f.ficha.id]?.revisada !== true,
    )
    .map((f) => f.ficha);
}
