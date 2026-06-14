/* ===========================================================================
   store/obraStore — estado global de la obra (Zustand + Immer).
   ---------------------------------------------------------------------------
   Reúne el estado de DOMINIO (capítulos, partidas, banco, certs, tasas, obra),
   sembrado desde `core/seed`, con el estado de UI (vista activa, capítulo
   seleccionado, capítulos desplegados, certificación en curso). Las tasas son
   estado del store, NUNCA globals mutados (§8 del plan; era un hack del
   prototipo `window.IVA_RATE`).

   Alcance F1: estado sembrado + acciones básicas (setView/setActive/setRates/
   onCertEdit). El CRUD completo (mover/borrar/añadir partidas, editar medición
   y recursos, sincronizar `precio` con el descompuesto) es de F2; el store queda
   preparado pero esas acciones no se implementan aquí.
   =========================================================================== */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Banco, Cert, Chapter, MedLine, Obra, Partida, PartidasMap, Rates, SubChapter } from '../core/types';
import { buildRecursos, precioCuadraDescompuesto, precioSegunModo } from '../core/banco';
import { estaCertToOrigen, prevDataOf, sumLineQty } from '../core/certificacion';
import { rawUuid } from '../core/id';
import { round2 } from '../core/money';
import { renumberChapter } from '../core/numbering';
import { ancestorIds, findNode, flattenContainers, subtreeIds } from '../core/tree';
import type { ImportedObra } from '../core/bc3import';
import {
  REF_DESC,
  REF_SOURCES,
  detectCollisions,
  type Collision,
  type RefCopyItem,
  type RefDrag,
  type Resolution,
} from '../core/refdata';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS, makeCertsInit } from '../core/seed';
import type { View } from '../layout/types';

/** Selección especial del sidebar: "Toda la obra". */
export const ALL = '__ALL__';

/** Sub del capítulo por id, a CUALQUIER profundidad (jerarquía N niveles). */
function subIn(ch: Chapter, subId: string): SubChapter | undefined {
  return flattenContainers(ch).find((f) => f.sub.id === subId)?.sub;
}

/**
 * Siguiente índice libre entre los hijos de un contenedor: max(último segmento
 * numérico de los códigos) + 1. Política de huecos (igual que `addChapter`):
 * borrar no recodifica a los hermanos, así que el hueco no se rellena.
 */
function nextChildNum(parent: Chapter | SubChapter): number {
  return (
    (parent.children ?? []).reduce(
      (m, sub) => Math.max(m, parseInt(String(sub.code).split('.').at(-1) ?? '', 10) || 0),
      0,
    ) + 1
  );
}

/**
 * Recodifica un subárbol bajo un código nuevo: el nodo toma `code` y sus
 * descendientes pasan a índices secuenciales (`code.1`, `code.2`…). Lo usan
 * promover (deleteSubchapter) y mover (moveSubtree): el código de un contenedor
 * es su RUTA, así que cambiar de padre obliga a reescribir toda la rama. Los
 * ids NO cambian (son los que referencian `Partida.sub` y `active`).
 */
function recodeSubtree(node: SubChapter, code: string): void {
  const seen = new Set<SubChapter>();
  const walk = (n: SubChapter, c: string): void => {
    if (seen.has(n)) return; // ciclo (dato corrupto)
    seen.add(n);
    n.code = c;
    (n.children ?? []).forEach((child, i) => walk(child, `${c}.${i + 1}`));
  };
  walk(node, code);
}

/**
 * Contenedor PADRE de un sub dentro de su capítulo (el propio capítulo para
 * los de primer nivel), o `null` si el sub no existe en él.
 */
function parentOf(ch: Chapter, subId: string): Chapter | SubChapter | null {
  const f = flattenContainers(ch).find((x) => x.sub.id === subId);
  if (!f) return null;
  return f.parentId === ch.id ? ch : (subIn(ch, f.parentId) ?? null);
}

/**
 * Versión del shape serializable de la obra (§0 decisión 4: schemaVersion +
 * ruta de migración desde el día uno). `fromSerializable` migra en CADENA las
 * versiones < SCHEMA_VERSION (hydrate de IndexedDB e import .json pasan ambos
 * por ahí); las > SCHEMA_VERSION se rechazan (archivo de una app más nueva).
 *
 *   v1 → v2 (2026-06-12, jerarquía N niveles): `SubChapter` pasa a ser
 *   recursivo (`children?`). Migración IDENTIDAD: un árbol de 2 niveles ya es
 *   un caso degenerado válido del recursivo; solo se sella la versión.
 */
export const SCHEMA_VERSION = 2;

/** Modo de edición de una certificación: importe a origen vs. de esta cert. */
export type CertMode = 'origen' | 'esta';

/**
 * Ids ÚNICOS por construcción (F6, eng-review run 5 / Tensión 1-B). Antes eran
 * contadores de sesión (`p·N`…) que arrancaban en 0 cada carga → al recargar una
 * obra persistida colisionaban. Peor: el id de línea `m·N` vive CONGELADO en los
 * snapshots de certificación (`Cert.lineQty`), así que rehidratar contadores
 * podía reusar un id que una cert vieja aún referencia (corrupción del cobro).
 * `crypto.randomUUID` elimina la clase entera: sin contadores, sin rehidratación,
 * sin escaneo que olvidar. El prefijo (`p-`/`r-`/`m-`/`x-`) sólo da legibilidad;
 * la unicidad la garantiza el uuid. Seed (`p111`) y bc3 (`b3-*`) ids son literales
 * (no salen de aquí) y no cambian.
 */
function uid(prefix: string): string {
  return `${prefix}-${rawUuid()}`;
}
const nextRecursoCode = (): string => uid('r');
const nextPartidaId = (): string => uid('p');
const nextMedLineId = (): string => uid('m');
const nextExtraId = (): string => uid('x');

/**
 * Renumera `pos` de una lista de partidas EN SITIO (Immer-friendly), reusando la
 * regla pura de `core/numbering`. Sólo escribe `pos` sobre los drafts; descarta
 * los objetos intermedios → no contamina el árbol de Immer con copias.
 */
function renumberInPlace(ch: Chapter | undefined, list: Partida[]): void {
  const fresh = renumberChapter(ch, list);
  for (let i = 0; i < list.length; i++) list[i]!.pos = fresh[i]!.pos;
}

/**
 * F7.0: congela en la cert el precio unitario VIGENTE de la partida al
 * certificarla (espeja `Cert.lineQty`, que congela la cantidad al marcar): el
 * precio que el usuario ve al certificar es el que queda en el documento;
 * editar después el presupuesto (recurso/precio/K) ya no lo reescribe. Sólo
 * congela la primera vez (el snapshot no se refresca); el K se congela con el
 * primer precio. `snapshotAt` estampa el último congelado (trazabilidad F7.1).
 */
function freezePrecio(
  partidas: PartidasMap,
  rates: Rates,
  cert: Cert,
  partidaId: string,
): void {
  if (cert.priceSnapshot?.[partidaId] != null) return;
  for (const chId in partidas) {
    const p = partidas[chId]?.find((x) => x.id === partidaId);
    if (!p) continue;
    (cert.priceSnapshot ??= {})[partidaId] = p.precio;
    cert.coefK ??= rates.coefK;
    cert.snapshotAt = new Date().toISOString();
    return;
  }
}

/** Destino de copia (F5): capítulo/sub seleccionado, o el primer capítulo si la
 *  selección es "Toda la obra"/vacía. `label` para la barra "Copiar a …". */
export interface CopyTarget {
  chId: string;
  subId: string | null;
  label: string;
}

/** Copia en espera de resolver colisiones de recurso (T-1, decisión D2). */
export interface PendingCopy {
  items: RefCopyItem[];
  target: { chId: string; subId: string | null } | null;
  contra: boolean;
  collisions: Collision[];
  /** Procedencia para que la copia, tras resolver colisiones, respete BASE vs limpia. */
  provenance: 'base' | 'clip';
}
export function copyTargetOf(chapters: Chapter[], active: string): CopyTarget {
  if (active !== ALL) {
    // Resolución a CUALQUIER profundidad (jerarquía N niveles): un sub-sub
    // activo también es un destino válido de copia.
    const hit = findNode(chapters, active);
    if (hit) {
      const { chapter, node } = hit;
      return node === chapter
        ? { chId: chapter.id, subId: null, label: `${chapter.code} · ${chapter.title}` }
        : { chId: chapter.id, subId: node.id, label: `${node.code} · ${node.title}` };
    }
  }
  const c = chapters[0];
  return c ? { chId: c.id, subId: null, label: `${c.code} · ${c.title}` } : { chId: '', subId: null, label: '' };
}

/** Siguiente código derivado libre para BIFURCAR un recurso en colisión (`code~2`,
 *  `code~3`…). Despoja un sufijo `~N` previo para no encadenar `code~2~2` al
 *  re-copiar entre tres o más obras un recurso ya bifurcado. */
function forkCode(recursos: Banco, code: string): string {
  const base = code.replace(/~\d+$/, '');
  let i = 2;
  let c = `${base}~${i}`;
  while (recursos[c]) c = `${base}~${++i}`;
  return c;
}

/**
 * Ejecuta la copia de partidas de referencia sobre el draft `s` (lo comparten la
 * copia directa y la resuelta tras colisión). `resolution[code] === 'fork'` crea
 * el recurso entrante bajo un código derivado y reescribe los items que lo usan;
 * el resto integra SIN pisar homónimos (fusionar = comportamiento histórico).
 */
function applyCopy(
  s: ObraState,
  items: RefCopyItem[],
  target: { chId: string; subId: string | null } | null,
  contra: boolean,
  resolution?: Resolution,
  provenance: 'base' | 'clip' = 'base',
): void {
  if (!items.length) return;
  const t = target ?? copyTargetOf(s.chapters, s.active);
  const ch = s.chapters.find((c) => c.id === t.chId);
  if (!ch) return;
  const subId = t.subId;
  // Destino a cualquier profundidad; un subId inexistente se RECHAZA (no-op).
  const sub = subId ? subIn(ch, subId) : undefined;
  if (subId && !sub) return;
  const base = sub ? sub.code : ch.code;
  const list = (s.partidas[t.chId] ??= []);

  // 0) Bifurcaciones: por cada código resuelto a 'fork' que choca, crea el recurso
  //    ENTRANTE bajo un código derivado (una vez por código de origen).
  const forkMap: Record<string, string> = {};
  for (const it of items)
    for (const r of it.partida.items) {
      if (r.type === '%CI') continue;
      if (resolution?.[r.code] === 'fork' && s.recursos[r.code] && !forkMap[r.code]) {
        const fc = forkCode(s.recursos, r.code);
        forkMap[r.code] = fc;
        s.recursos[fc] = { type: r.type, desc: r.desc ?? '', ud: r.ud ?? '', precio: r.precio ?? 0 };
      }
    }

  // 1) Recursos no bifurcados al banco SIN pisar homónimos (coherencia §0 / fusionar).
  for (const it of items)
    for (const r of it.partida.items) {
      if (r.type === '%CI') continue;
      const code = forkMap[r.code] ?? r.code;
      if (!s.recursos[code])
        s.recursos[code] = { type: r.type, desc: r.desc ?? '', ud: r.ud ?? '', precio: r.precio ?? 0 };
    }

  // 2) Partidas nuevas (pos correlativa dentro del sub destino; precio de la base
  //    es autoridad, sin recomputar). Los items 'fork' apuntan al código derivado.
  let sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub)).length;
  for (const it of items) {
    const p = it.partida;
    sameSub += 1;
    const newItems = p.items.map((r) =>
      r.type === '%CI'
        ? { code: '%CI', type: '%CI' as const, cantidad: r.cantidad }
        : { code: forkMap[r.code] ?? r.code, type: r.type, cantidad: r.cantidad },
    );
    list.push({
      id: nextPartidaId(),
      sub: subId || undefined,
      pos: `${base}.${sameSub}`,
      code: p.code,
      title: p.title,
      ud: p.ud,
      precio: p.precio,
      mainType: p.mainType,
      // La desc propia de la partida (obras como fuente) manda sobre la canónica
      // por código (bases); coincide con lo que previsualiza el panel (RefPartidaRow).
      desc: p.desc ?? REF_DESC[p.code] ?? '',
      med: [],
      items: newItems,
      // Procedencia 'clip' (portapapeles) = trabajo tuyo → partida limpia, sin
      // chip BASE ni baseSource. 'base' (panel Referencia) mantiene el chip.
      fromBase: provenance === 'clip' ? undefined : !contra,
      contradictorio: contra || undefined,
      baseSource: provenance === 'clip' ? undefined : it.sourceName,
    });
  }
  s.expanded[t.chId] = true;
}

/** Estado de dominio de la obra (lo que persistiría en F6). Serializable. */
export interface ObraData {
  /** Versión del shape (para migración al cargar; ver SCHEMA_VERSION). */
  schemaVersion: number;
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  certs: Cert[];
  rates: Rates;
  obra: Obra;
}

export interface ObraState extends ObraData {
  /* ---- estado de UI ---- */
  /** Vista activa (tabs). */
  view: View;
  /** Capítulo/subcapítulo seleccionado, o `__ALL__` para toda la obra. */
  active: string;
  /** Contenedores desplegados en el sidebar (id de capítulo O sub → abierto). */
  expanded: Record<string, boolean>;
  /** Índice de la certificación en curso dentro de `certs`. */
  curCert: number;
  /** Panel de Referencia abierto (F5). */
  refOpen: boolean;
  /** Fuente de referencia seleccionada (id de `REF_SOURCES`). */
  refSourceId: string;
  /** Ancho del panel en modo split (px, clamp 320–640). */
  refWidth: number;
  /** Arrastre en curso desde el panel Referencia (F5.2); null = nada arrastrándose. */
  refDrag: RefDrag | null;
  /** Copia con colisiones pendiente de resolver (T-1, D2); null = sin conflicto. */
  pendingCopy: PendingCopy | null;
  /**
   * Partida desplegada Y seleccionada en el presupuesto (modelo unificado: la
   * fila abierta ES la seleccionada, una a la vez). `null` = ninguna. Es estado
   * de UI por-obra: `loadObra`/`reset` lo resetean (vía `seedUi`), y cambiar de
   * vista/capítulo o borrar/mover la partida lo limpian (no dejar selección
   * fantasma sobre una fila invisible).
   */
  openPartidaId: string | null;
  /**
   * Contador que dispara el scroll + pulso "ir a la partida" del buscador del
   * presupuesto (`revealPartida`). Lo incrementa cada salto (también al re-revelar
   * la ya abierta) y lo escucha `PresupuestoView`; atarse a él (y no a
   * `openPartidaId`) evita hacer scroll en cada apertura manual.
   */
  revealNonce: number;

  /* ---- acciones (F1) ---- */
  setView: (v: View) => void;
  setActive: (id: string) => void;
  /**
   * Navega a una partida concreta y la deja lista para editar (buscador del
   * presupuesto, T-20): marca su subcapítulo —o capítulo si es directa— en el
   * sidebar, aísla su subárbol, expande la cadena de ancestros, despliega su
   * detalle y dispara el scroll/pulso. ATÓMICA: no delega en
   * `setActive`/`setView`/`togglePartida` (que resetean/alternan `openPartidaId`),
   * y fija `openPartidaId` el ÚLTIMO. `chapterId`/`subId` vienen del hit del
   * índice (O(1), sin re-escaneo); un `subId` huérfano cae al capítulo.
   */
  revealPartida: (partidaId: string, chapterId: string, subId: string | null) => void;
  /**
   * Despliega/selecciona una partida (o la colapsa/deselecciona si ya lo estaba).
   * Single-open: abrir una cierra la anterior. Es el gesto de "click en zona
   * vacía de la fila" del presupuesto.
   */
  togglePartida: (id: string) => void;
  /**
   * Despliega/colapsa un contenedor (capítulo o sub) en el árbol del sidebar
   * (estado de UI). `force` fija el estado (true = desplegar) en vez de
   * alternar; lo usa "añadir subcapítulo" para abrir la cadena de ancestros.
   */
  toggleExpanded: (chId: string, force?: boolean) => void;
  /** Edita una o varias tasas (iva/gg/bi/coefK) sin tocar globals. */
  setRates: (patch: Partial<Rates>) => void;
  /** Selecciona la certificación en curso por índice. */
  setCurCert: (index: number) => void;
  /**
   * Edita la cantidad ejecutada de una partida en la cert en curso.
   * En modo `origen` guarda el valor como cantidad A ORIGEN; en modo `esta`
   * convierte el valor tecleado (cantidad de ESTA cert) a origen con
   * `core/certificacion.estaCertToOrigen` = round2(max(0, anterior + v)).
   */
  onCertEdit: (partidaId: string, value: number, mode: CertMode) => void;
  /**
   * Marca/desmarca una línea de medición como ejecutada en la cert en curso
   * (dogfood #3). `qty` = cantidad A ORIGEN de la línea (su parcial si entera;
   * menos si se certifica una parte); `null`/≤0 la desmarca. Resincroniza
   * `data[partidaId] = Σ lineQty[partidaId]` (a-origen, regla §1). La marca es
   * SIEMPRE a-origen, independiente del modo A origen/Esta cert (regla §2).
   */
  setCertLine: (partidaId: string, lineId: string, qty: number | null) => void;
  /**
   * Crea una certificación nueva al final y la deja en curso. Hereda de la
   * ÚLTIMA cronológica (no de la actual): `data` y `lineQty` a-origen (la
   * ejecución es acumulativa), la `retencion` y el periodo en blanco. Así "esta
   * certificación" arranca en 0 sobre lo ya certificado (eng-review F4 / Codex #6/#7).
   */
  addCert: () => void;
  /** Edita el periodo (texto) o la retención (0..1, se clampa) de la cert en curso. */
  setCertField: (field: 'period' | 'retencion', value: string | number) => void;
  /**
   * Añade un precio contradictorio (F4.4) al capítulo dado, DENTRO de la cert en
   * curso (no toca `partidas` ni el PEM base). `pos` = "C{n}" según los que ya
   * cuelgan del capítulo; campos a 0/'' para editar in-situ.
   */
  addContradictorio: (chapterId: string) => void;
  /** Edita un campo de un contradictorio de la cert en curso (cantidad/precio ≥ 0). */
  editContradictorio: (
    extraId: string,
    field: 'title' | 'ud' | 'cantidad' | 'precio',
    value: string | number,
  ) => void;
  /** Elimina un contradictorio de la cert en curso. */
  deleteContradictorio: (extraId: string) => void;

  /* ---- acciones F5 (panel Referencia) ---- */
  /** Abre/cierra el panel de Referencia; sin argumento alterna. */
  setRefOpen: (open?: boolean) => void;
  /** Selecciona la fuente de referencia activa (id de `REF_SOURCES`). */
  setRefSource: (id: string) => void;
  /** Fija el ancho del panel en split (se clampa a 320–640). */
  setRefWidth: (w: number) => void;
  /** Fija/limpia el payload de arrastre (drag&drop, F5.2). */
  setRefDrag: (drag: RefDrag | null) => void;
  /**
   * Reemplaza TODA la obra por una importada (F5.3, .bc3). Estampa la versión de
   * esquema, resetea la UI y deja la vista en el presupuesto, con el primer
   * capítulo activo. Igual que `reset` pero con datos importados en vez de seed.
   */
  loadObra: (data: ImportedObra) => void;
  /**
   * Copia partidas de una fuente de referencia al presupuesto (F5). Integra los
   * recursos de su descomposición en el banco SIN pisar los homónimos (coherencia);
   * crea cada partida con `med:[]`, items por código y marca `fromBase` (chip BASE)
   * o `contradictorio` (chip P.C.) según `contra`. `target` = capítulo/sub destino;
   * `null` = el capítulo/sub activo (`copyTargetOf`). Despliega el capítulo destino.
   */
  copyRefPartidas: (
    items: RefCopyItem[],
    target: { chId: string; subId: string | null } | null,
    contra: boolean,
    resolution?: Resolution,
    provenance?: 'base' | 'clip',
  ) => void;
  /**
   * Punto de entrada de copia con PREFLIGHT de colisión (T-1, D2). Detecta
   * códigos de recurso entrantes que chocan con el banco a precio/desc distinto.
   * Sin colisiones → copia directa. Con colisiones → deja `pendingCopy` para que
   * la UI pregunte (fusionar/bifurcar) y luego llame a `resolveCopyRefPartidas`.
   * Lo usan TODAS las vías de copia (botón, selección, capítulo y drag&drop).
   */
  requestCopyRefPartidas: (
    items: RefCopyItem[],
    target: { chId: string; subId: string | null } | null,
    contra: boolean,
    provenance?: 'base' | 'clip',
  ) => void;
  /** Ejecuta la copia pendiente con la resolución elegida y limpia `pendingCopy`. */
  resolveCopyRefPartidas: (resolution: Resolution) => void;
  /** Cancela la copia pendiente (cierra el diálogo de colisión sin copiar). */
  cancelCopyRefPartidas: () => void;

  /* ---- acciones F2 (edición in-situ de partidas) ---- */
  /** Edita un campo de texto de la partida (title/ud/code/desc) y quita el chip BASE. */
  editPartidaField: (
    chapterId: string,
    partidaId: string,
    field: 'title' | 'ud' | 'code' | 'desc',
    value: string,
  ) => void;
  /**
   * Fija el precio unitario A MANO: lo marca como override (`precioManual`) para
   * que el sync de recursos (F2.3) no lo colapse al descompuesto, y quita el chip
   * BASE. Ignora valores no finitos o negativos (frontera de invariantes).
   */
  setPrecio: (chapterId: string, partidaId: string, value: number) => void;
  /** Añade una línea de medición vacía (dimensiones en blanco = factor 1). */
  addMedLine: (chapterId: string, partidaId: string) => void;
  /** Edita un campo de una línea de medición (comentario o dimensión). */
  editMedLine: <K extends keyof MedLine>(
    chapterId: string,
    partidaId: string,
    index: number,
    field: K,
    value: MedLine[K],
  ) => void;
  /** Elimina una línea de medición. */
  deleteMedLine: (chapterId: string, partidaId: string, index: number) => void;

  /* ---- acciones F2.3 (justificación del precio / banco compartido, T9) ---- */
  /**
   * Edita un concepto del banco POR CÓDIGO (desc/ud/precio): afecta a TODAS las
   * partidas que lo usan. Al cambiar el `precio`, resincroniza `precio =
   * descompUnit` en las partidas SIN override (`precioManual` falso) → la cadena
   * recurso→importe→PEM (T9). `desc`/`ud` no alteran el descompuesto.
   */
  editRecurso: (code: string, field: 'desc' | 'ud' | 'precio', value: string | number) => void;
  /** Edita el rendimiento (cantidad propia de la partida) de un concepto y resincroniza el precio. */
  editItemCantidad: (
    chapterId: string,
    partidaId: string,
    itemIndex: number,
    value: number,
  ) => void;
  /** Añade un concepto MAT vacío (con su entrada nueva en el banco) y resincroniza. */
  addItem: (chapterId: string, partidaId: string) => void;
  /** Elimina un concepto de la justificación y resincroniza el precio. */
  deleteItem: (chapterId: string, partidaId: string, itemIndex: number) => void;

  /* ---- acciones F2.4 (CRUD estructural + renumeración) ---- */
  /** Añade un capítulo (código = max+1) y lo deja activo en la vista Presupuesto. */
  addChapter: (title: string) => void;
  /**
   * Añade un subcapítulo bajo CUALQUIER contenedor (capítulo o sub a cualquier
   * profundidad, T-17): código `<padre>.<n>` (siguiente índice libre) y
   * despliega el capítulo dueño. Un `parentId` inexistente es no-op.
   */
  addSubchapter: (parentId: string, title: string) => void;
  /** Elimina un capítulo y sus partidas; si estaba activo, salta a "Toda la obra". */
  deleteChapter: (chapterId: string) => void;
  /**
   * Elimina un contenedor a CUALQUIER profundidad (T-17). Sus hijos se
   * PROMUEVEN al final de los hermanos (recodificados con índices libres) y
   * sus partidas directas suben al contenedor padre — borrar nunca destruye
   * ramas ni partidas. Si estaba activo, el activo salta al padre.
   */
  deleteSubchapter: (chapterId: string, subId: string) => void;
  /**
   * Mueve un SUBÁRBOL (contenedor + sub-contenedores + sus partidas) bajo otro
   * contenedor, incluso de otro capítulo (T-17): las partidas del subárbol
   * cambian de bucket en `PartidasMap` (la clave sigue siendo el capítulo) y la
   * rama se recodifica bajo el código del nuevo padre. Los ids no cambian (las
   * certs, indexadas por id de partida, no se enteran). Rechaza (no-op) mover
   * un capítulo, un destino inexistente o un destino DENTRO del propio subárbol.
   */
  moveSubtree: (nodeId: string, toParentId: string) => void;
  /** Añade una partida vacía al capítulo/subcapítulo, con su `pos` correlativa. */
  addPartida: (chapterId: string, subId: string | null) => void;
  /** Elimina una partida y renumera su capítulo. */
  deletePartida: (chapterId: string, partidaId: string) => void;
  /** Mueve una partida a otro capítulo/subcapítulo y renumera origen y destino. */
  movePartida: (fromChapterId: string, partidaId: string, toChapterId: string, toSubId: string | null) => void;

  /* ---- acciones F6.2 (datos de obra) ---- */
  /**
   * Edita un campo de los datos de obra por RUTA anidada (`'promotor.nif'`,
   * `'denominacion'`). Crea los objetos intermedios que falten (la obra semilla
   * solo trae los campos planos; promotor/constructor/redactor nacen al editarse).
   * Solo escribe strings (los campos del modal son inputs de texto).
   */
  setObraPath: (path: string, value: string) => void;

  /** Restaura el estado sembrado (datos + UI). Útil en tests y para "nueva obra". */
  reset: () => void;
}

/**
 * Construye el estado de dominio desde `core/seed`. Clona partidas/capítulos
 * (en F2 se mutan), deriva el banco con `buildRecursos` y siembra el histórico
 * de certificaciones. Las tasas y la obra se copian (no se comparte referencia
 * con el seed para no contaminarlo entre stores/tests).
 */
export function seedObraData(): ObraData {
  const partidas = structuredClone(PARTIDAS);
  const recursos = buildRecursos(partidas);
  // §0 decisión 6: el precio de una partida semilla/importada es AUTORIDAD de la
  // fuente. La descomposición demo es ilustrativa y no siempre suma al precio
  // (p111: descompUnit 9,27 € vs precio 18,42 €). Sin marcar override, el sync de
  // recursos de F2 (precioSegunModo) colapsaría el precio al descompuesto y el PEM
  // dejaría de cuadrar. Marcamos override donde no cuadra → precio fijo y seguro;
  // la señal de override (data-driven, precio≠descompUnit) sigue saltando igual.
  for (const ps of Object.values(partidas))
    for (const p of ps) if (!precioCuadraDescompuesto(p, recursos)) p.precioManual = true;
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: structuredClone(CHAPTERS),
    partidas,
    recursos,
    certs: makeCertsInit(partidas),
    rates: { ...DEFAULT_RATES },
    obra: { ...DEFAULT_OBRA },
  };
}

/**
 * Obra EN BLANCO para "nueva obra" (multi-obra, T-10): sin capítulos/partidas/
 * recursos, una certificación vacía lista para editar, tasas por defecto. No
 * arrastra el contenido demo del seed (eso confundiría: cada obra nueva con
 * "Movimiento de tierras" de ejemplo). El usuario añade capítulos con el "+".
 */
export function blankObraData(name = 'Obra nueva'): ObraData {
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: [],
    partidas: {},
    recursos: {},
    certs: [{ id: 'c1', num: 1, period: '', retencion: 0, data: {} }],
    rates: { ...DEFAULT_RATES },
    obra: { denominacion: name, direccion: '', localidad: '' },
  };
}

/** Extrae el estado de dominio serializable (sin estado de UI). Lo usa F6. */
export function toSerializable(s: ObraData): ObraData {
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: s.chapters,
    partidas: s.partidas,
    recursos: s.recursos,
    certs: s.certs,
    rates: s.rates,
    obra: s.obra,
  };
}

/**
 * Migraciones de esquema: `MIGRATIONS[v]` transforma un `ObraData` de la
 * versión `v` a la `v+1`. Se aplican en cadena hasta `SCHEMA_VERSION`.
 */
const MIGRATIONS: Record<number, (d: ObraData) => ObraData> = {
  // v1 → v2 (jerarquía N niveles): identidad estructural — el shape de 2
  // niveles ya es un árbol recursivo degenerado; solo sube la versión.
  1: (d) => ({ ...d, schemaVersion: 2 }),
};

/**
 * Valida/migra un `ObraData` cargado (hydrate de IndexedDB e import .json).
 * Migra en cadena las versiones antiguas; rechaza las desconocidas (más nuevas
 * que la app, o tan viejas que no hay ruta).
 */
export function fromSerializable(data: ObraData): ObraData {
  let d = data;
  while (d.schemaVersion < SCHEMA_VERSION) {
    const mig = MIGRATIONS[d.schemaVersion];
    if (!mig) break; // sin ruta → cae al rechazo de abajo
    d = mig(d);
  }
  if (d.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion ${data.schemaVersion} no soportada (esperada ≤ ${SCHEMA_VERSION}); sin ruta de migración.`,
    );
  }
  return d;
}

/** Estado de UI inicial (sincronizado con el nº de certs sembradas). */
function seedUi(certs: Cert[]) {
  return {
    view: 'presupuesto' as View,
    active: '01',
    // Árbol COLAPSADO por defecto (capítulos y subs): en bancos/obras grandes
    // el árbol desplegado es inmanejable; el usuario abre lo que necesita.
    expanded: {} as Record<string, boolean>,
    curCert: Math.max(0, certs.length - 1), // la última cert queda en curso
    refOpen: false,
    refSourceId: REF_SOURCES[0]?.id ?? '',
    refWidth: 400,
    refDrag: null as RefDrag | null,
    pendingCopy: null as PendingCopy | null,
    openPartidaId: null as string | null,
    revealNonce: 0,
  };
}

export const useObraStore = create<ObraState>()(
  subscribeWithSelector(
  immer((set) => {
    // Arranque limpio: la app parte de una obra nueva vacía (sin datos demo). En
    // primera carga `hydrate` (sin obras en IDB) conserva este estado en memoria;
    // la 1ª edición la fosiliza. `seedObraData()`/`reset()` siguen vivos como
    // semilla de tests (los specs resiembran la obra demo en su beforeEach).
    const data = blankObraData();
    return {
      ...data,
      ...seedUi(data.certs),

      setView: (v) =>
        set((s) => {
          s.view = v;
          s.openPartidaId = null; // la selección es contextual a lo que se mira
        }),

      setActive: (id) =>
        set((s) => {
          s.active = id;
          s.openPartidaId = null; // cambiar de capítulo deselecciona la partida
        }),

      togglePartida: (id) =>
        set((s) => {
          s.openPartidaId = s.openPartidaId === id ? null : id;
        }),

      revealPartida: (partidaId, chapterId, subId) =>
        set((s) => {
          const ch = s.chapters.find((c) => c.id === chapterId);
          if (!ch) return; // no-op seguro: capítulo inexistente
          // `subId` válido sólo si existe en ESTE capítulo; si no (huérfano o
          // cruzado), se trata como partida directa del capítulo (sin esto,
          // `active` apuntaría a un id desconocido → la vista caería a chapters[0]).
          const validSub =
            subId && findNode(s.chapters, subId)?.chapter.id === chapterId ? subId : null;
          s.active = validSub ?? chapterId;
          // Expandir la cadena de ancestros para dejar el contenedor a la vista.
          for (const id of ancestorIds(s.chapters, validSub ?? chapterId)) s.expanded[id] = true;
          s.view = 'presupuesto';
          s.openPartidaId = partidaId; // ÚLTIMO: ningún reset previo lo borra
          s.revealNonce += 1; // dispara scroll/pulso (también al re-revelar la abierta)
        }),

      toggleExpanded: (chId, force) =>
        set((s) => {
          s.expanded[chId] = force ?? !s.expanded[chId];
        }),

      setRates: (patch) =>
        set((s) => {
          // El store es la frontera de invariantes: ignora valores no finitos y
          // fuera de rango (un NaN o IVA negativo envenenaría TODOS los totales).
          // coefK debe ser > 0 (un 0 anularía el PEM); el resto, ≥ 0.
          (Object.keys(patch) as (keyof Rates)[]).forEach((k) => {
            const v = patch[k];
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            if (k === 'coefK' ? v <= 0 : v < 0) return;
            s.rates[k] = v;
          });
        }),

      setCurCert: (index) =>
        set((s) => {
          // Clampa al rango válido de certs (evita una selección fuera de rango).
          s.curCert = Math.max(0, Math.min(index, s.certs.length - 1));
        }),

      onCertEdit: (partidaId, value, mode) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          if (mode === 'esta') {
            const prev = prevDataOf(s.certs, s.curCert)[partidaId] ?? 0;
            cert.data[partidaId] = estaCertToOrigen(prev, value);
          } else {
            // A origen: desviación CONSCIENTE del prototipo (que guardaba v crudo).
            // La cantidad ejecutada no puede ser negativa; round2 = 2 decimales,
            // consistente con `estaCertToOrigen` y con el seed (`makeCertsInit`),
            // que también redondean la cantidad a origen.
            cert.data[partidaId] = round2(Math.max(0, value));
          }
          // Teclear una cantidad/% es un override del total: deja de certificarse
          // por líneas (regresión §8a). Si no quedan líneas marcadas en la cert,
          // limpia el contenedor para no dejar `{}` huérfanos.
          if (cert.lineQty?.[partidaId]) {
            delete cert.lineQty[partidaId];
            if (Object.keys(cert.lineQty).length === 0) cert.lineQty = undefined;
          }
          freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
        }),

      setCertLine: (partidaId, lineId, qty) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          const lineQty = (cert.lineQty ??= {});
          const lines = (lineQty[partidaId] ??= {});
          if (qty == null || qty <= 0) {
            delete lines[lineId];
          } else {
            lines[lineId] = round2(qty);
          }
          if (Object.keys(lines).length === 0) {
            // Sin líneas marcadas: la partida deja de certificarse por líneas.
            delete lineQty[partidaId];
            delete cert.data[partidaId];
            if (Object.keys(lineQty).length === 0) cert.lineQty = undefined;
          } else {
            cert.data[partidaId] = sumLineQty(lines);
            freezePrecio(s.partidas, s.rates, cert, partidaId); // F7.0
          }
        }),

      addCert: () =>
        set((s) => {
          const last = s.certs.at(-1);
          const num = (last?.num ?? 0) + 1;
          // Clonado superficial por nivel (no `structuredClone`: los valores son
          // drafts de Immer y el proxy no es clonable). data es plano; lineQty
          // tiene un nivel de anidación.
          const data: Record<string, number> = { ...(last?.data ?? {}) };
          let lineQty: Record<string, Record<string, number>> | undefined;
          if (last?.lineQty) {
            lineQty = {};
            for (const pid in last.lineQty) lineQty[pid] = { ...last.lineQty[pid] };
          }
          // Los contradictorios se heredan a-origen (mismo id → "anterior" cuadra).
          const extras = last?.extras?.map((e) => ({ ...e }));
          // F7.0: la cert nace con TODOS los precios congelados ("hereda/congela").
          // Hereda los de la última cert (así su "anterior" reproduce al céntimo lo
          // ya certificado) y congela al precio vivo los que falten (partidas nuevas
          // o última cert legada sin snapshot). El K congelado se hereda igual.
          const precios: Record<string, number> = {};
          for (const chId in s.partidas)
            for (const p of s.partidas[chId] ?? [])
              precios[p.id] = last?.priceSnapshot?.[p.id] ?? p.precio;
          s.certs.push({
            id: `c${num}`,
            num,
            period: '',
            retencion: last?.retencion ?? 0,
            data,
            lineQty,
            extras,
            priceSnapshot: precios,
            coefK: last?.coefK ?? s.rates.coefK,
            snapshotAt: new Date().toISOString(),
          });
          s.curCert = s.certs.length - 1;
        }),

      setCertField: (field, value) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          if (field === 'period') {
            if (typeof value === 'string') cert.period = value;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            cert.retencion = Math.min(1, Math.max(0, value)); // retención ∈ [0,1]
          }
        }),

      addContradictorio: (chapterId) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          const extras = (cert.extras ??= []);
          const n = extras.filter((e) => e.chapterId === chapterId).length + 1;
          extras.push({
            id: nextExtraId(),
            chapterId,
            pos: `C${n}`,
            title: '',
            ud: '',
            cantidad: 0,
            precio: 0,
          });
        }),

      editContradictorio: (extraId, field, value) =>
        set((s) => {
          const e = s.certs[s.curCert]?.extras?.find((x) => x.id === extraId);
          if (!e) return;
          if (field === 'title' || field === 'ud') {
            if (typeof value === 'string') e[field] = value;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            // cantidad/precio no pueden ser negativos; cantidad a 2 dec, precio
            // (dinero) a 2 dec también (coherente con el banco de precios).
            e[field] = round2(Math.max(0, value));
          }
        }),

      deleteContradictorio: (extraId) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert?.extras) return;
          cert.extras = cert.extras.filter((e) => e.id !== extraId);
          if (cert.extras.length === 0) cert.extras = undefined;
        }),

      setRefOpen: (open) =>
        set((s) => {
          s.refOpen = open ?? !s.refOpen;
        }),

      setRefSource: (id) =>
        set((s) => {
          s.refSourceId = id;
        }),

      setRefWidth: (w) =>
        set((s) => {
          s.refWidth = Math.max(320, Math.min(640, Math.round(w)));
        }),

      setRefDrag: (drag) =>
        set((s) => {
          s.refDrag = drag;
        }),

      loadObra: (data) =>
        set((s) => {
          Object.assign(s, { schemaVersion: SCHEMA_VERSION, ...data });
          Object.assign(s, seedUi(data.certs));
          const first = data.chapters[0]?.id;
          s.view = 'presupuesto';
          s.active = first ?? ALL;
          s.expanded = {}; // árbol colapsado: una obra recién importada se explora
          s.refOpen = false;
        }),

      copyRefPartidas: (items, target, contra, resolution, provenance = 'base') =>
        set((s) => {
          applyCopy(s, items, target, contra, resolution, provenance);
        }),

      requestCopyRefPartidas: (items, target, contra, provenance = 'base') =>
        set((s) => {
          if (!items.length) return;
          const collisions = detectCollisions(items, s.recursos);
          if (collisions.length === 0) {
            applyCopy(s, items, target, contra, undefined, provenance); // sin colisión: copia directa
          } else {
            // Guarda la procedencia: tras resolver la colisión, la copia debe
            // seguir respetando BASE (Referencia) vs limpia (portapapeles).
            s.pendingCopy = { items, target, contra, collisions, provenance };
          }
        }),

      resolveCopyRefPartidas: (resolution) =>
        set((s) => {
          const pc = s.pendingCopy;
          if (!pc) return;
          applyCopy(s, pc.items, pc.target, pc.contra, resolution, pc.provenance);
          s.pendingCopy = null;
        }),

      cancelCopyRefPartidas: () =>
        set((s) => {
          s.pendingCopy = null;
        }),

      editPartidaField: (chapterId, partidaId, field, value) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          p[field] = value;
          p.fromBase = false; // editar confirma la partida: se va el chip BASE
        }),

      setPrecio: (chapterId, partidaId, value) =>
        set((s) => {
          // El precio envenena el importe/PEM: ignora NaN/±∞ y negativos.
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          p.precio = value;
          p.precioManual = true; // override: el precio deja de seguir al descompuesto
          p.fromBase = false;
        }),

      addMedLine: (chapterId, partidaId) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          p.med.push({ id: nextMedLineId(), comment: '', uds: '', largo: '', ancho: '', alto: '' });
          p.fromBase = false;
        }),

      editMedLine: (chapterId, partidaId, index, field, value) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          const line = p?.med[index];
          if (!p || !line) return;
          line[field] = value;
          p.fromBase = false;
        }),

      deleteMedLine: (chapterId, partidaId, index) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p || index < 0 || index >= p.med.length) return;
          p.med.splice(index, 1);
          p.fromBase = false;
        }),

      editRecurso: (code, field, value) =>
        set((s) => {
          const r = s.recursos[code];
          if (!r) return;
          if (field === 'precio') {
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
            r.precio = value;
            // T9: el cambio de precio del banco se propaga a TODAS las partidas
            // sin override (precioManual). precioSegunModo deja fijas las override
            // y las sin items; el resto pasan a su descompuesto recalculado.
            for (const ch in s.partidas)
              for (const p of s.partidas[ch] ?? []) p.precio = precioSegunModo(p, s.recursos);
          } else {
            // desc/ud: no alteran el descompuesto → no hay resync.
            if (typeof value !== 'string') return;
            r[field] = value;
          }
        }),

      editItemCantidad: (chapterId, partidaId, itemIndex, value) =>
        set((s) => {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          const it = p?.items[itemIndex];
          if (!p || !it) return;
          it.cantidad = value;
          p.fromBase = false;
          p.precio = precioSegunModo(p, s.recursos);
        }),

      addItem: (chapterId, partidaId) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          const code = nextRecursoCode();
          s.recursos[code] = { type: 'MAT', desc: '', ud: 'ud', precio: 0 };
          p.items.push({ code, type: 'MAT', cantidad: 1 });
          p.fromBase = false;
          p.precio = precioSegunModo(p, s.recursos); // precio 0 → descompuesto sin cambio
        }),

      deleteItem: (chapterId, partidaId, itemIndex) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p || itemIndex < 0 || itemIndex >= p.items.length) return;
          p.items.splice(itemIndex, 1);
          p.fromBase = false;
          p.precio = precioSegunModo(p, s.recursos);
        }),

      addChapter: (title) =>
        set((s) => {
          const num = s.chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
          const code = String(num);
          const id = code.padStart(2, '0');
          s.chapters.push({ id, code, title, children: [] });
          s.partidas[id] = [];
          s.view = 'presupuesto';
          s.active = id;
        }),

      addSubchapter: (parentId, title) =>
        set((s) => {
          // El padre puede ser un capítulo o un sub a cualquier profundidad.
          const hit = findNode(s.chapters, parentId);
          if (!hit) return;
          const parent = hit.node;
          const n = nextChildNum(parent);
          (parent.children ??= []).push({
            id: `${parent.id}.${String(n).padStart(2, '0')}`,
            code: `${parent.code}.${n}`,
            title,
          });
          s.expanded[hit.chapter.id] = true;
        }),

      deleteChapter: (chapterId) =>
        set((s) => {
          const i = s.chapters.findIndex((c) => c.id === chapterId);
          if (i < 0) return;
          const ch = s.chapters[i]!;
          const affectsActive = s.active === chapterId || !!subIn(ch, s.active);
          s.chapters.splice(i, 1);
          delete s.partidas[chapterId];
          if (affectsActive) s.active = ALL;
        }),

      deleteSubchapter: (chapterId, subId) =>
        set((s) => {
          const ch = s.chapters.find((c) => c.id === chapterId);
          if (!ch) return;
          const parent = parentOf(ch, subId);
          const siblings = parent?.children;
          const si = siblings?.findIndex((sc) => sc.id === subId) ?? -1;
          if (!parent || !siblings || si < 0) return;
          const node = siblings.splice(si, 1)[0]!;
          // PROMOVER, no cascada (T-17): los hijos del borrado pasan al final
          // de los hermanos, recodificados con los índices libres siguientes
          // (política de huecos: los hermanos no se recodifican). Borrar un
          // contenedor nunca destruye sus ramas ni sus partidas.
          for (const child of node.children ?? []) {
            recodeSubtree(child, `${parent.code}.${nextChildNum(parent)}`);
            siblings.push(child);
          }
          // Las partidas directas del borrado suben al contenedor padre
          // (`sub = undefined` si el padre es el capítulo).
          const parentSubId = parent === ch ? undefined : parent.id;
          const list = s.partidas[chapterId] ?? [];
          for (const p of list) if (p.sub === subId) p.sub = parentSubId;
          renumberInPlace(ch, list);
          if (s.active === subId) s.active = parentSubId ?? chapterId;
        }),

      moveSubtree: (nodeId, toParentId) =>
        set((s) => {
          if (nodeId === toParentId) return;
          const src = findNode(s.chapters, nodeId);
          const dst = findNode(s.chapters, toParentId);
          // Los capítulos no se mueven (depth 0); destino inexistente = no-op.
          if (!src || !dst || src.depth === 0) return;
          const node = src.node as SubChapter;
          // El destino no puede caer DENTRO del subárbol movido (sería un ciclo
          // estructural: un contenedor colgando de su propio descendiente).
          const branch = subtreeIds(node);
          if (branch.has(toParentId)) return;
          const fromCh = src.chapter;
          const fromParent = parentOf(fromCh, nodeId);
          const fi = fromParent?.children?.findIndex((sc) => sc.id === nodeId) ?? -1;
          if (!fromParent || fi < 0) return;
          if (fromParent === dst.node) return; // ya cuelga de ahí
          fromParent.children!.splice(fi, 1);
          // Engancha al final del destino y recodifica la rama bajo su código.
          const toParent = dst.node;
          recodeSubtree(node, `${toParent.code}.${nextChildNum(toParent)}`);
          (toParent.children ??= []).push(node);
          // Las partidas del subárbol cambian de bucket si cambia el capítulo
          // (los ids no cambian: el dato de cert, por id de partida, no se toca).
          const toChId = dst.chapter.id;
          if (toChId !== fromCh.id) {
            const fromList = s.partidas[fromCh.id] ?? [];
            const moving = fromList.filter((p) => p.sub != null && branch.has(p.sub));
            if (moving.length) {
              s.partidas[fromCh.id] = fromList.filter((p) => !(p.sub != null && branch.has(p.sub)));
              (s.partidas[toChId] ??= []).push(...moving);
            }
            renumberInPlace(fromCh, s.partidas[fromCh.id] ?? []);
          }
          renumberInPlace(dst.chapter, s.partidas[toChId] ?? []);
          s.expanded[toChId] = true;
        }),

      addPartida: (chapterId, subId) =>
        set((s) => {
          const ch = s.chapters.find((c) => c.id === chapterId);
          if (!ch) return;
          // El sub destino se resuelve a CUALQUIER profundidad; un subId que no
          // exista en el capítulo se RECHAZA (crearía una partida huérfana cuyo
          // grupo ninguna vista pinta — eng-review 2026-06-12, Tensión 2).
          const sub = subId ? subIn(ch, subId) : undefined;
          if (subId && !sub) return;
          const list = (s.partidas[chapterId] ??= []);
          const base = sub ? sub.code : ch.code;
          const sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub)).length;
          list.push({
            id: nextPartidaId(),
            sub: subId || undefined,
            pos: `${base}.${sameSub + 1}`,
            code: '——',
            title: '',
            ud: 'ud',
            precio: 0,
            desc: '',
            med: [],
            items: [],
          });
        }),

      deletePartida: (chapterId, partidaId) =>
        set((s) => {
          const list = s.partidas[chapterId];
          const idx = list?.findIndex((p) => p.id === partidaId) ?? -1;
          if (!list || idx < 0) return;
          list.splice(idx, 1);
          if (s.openPartidaId === partidaId) s.openPartidaId = null; // no dejar selección fantasma
          renumberInPlace(
            s.chapters.find((c) => c.id === chapterId),
            list,
          );
        }),

      movePartida: (fromChapterId, partidaId, toChapterId, toSubId) =>
        set((s) => {
          const fromList = s.partidas[fromChapterId];
          const idx = fromList?.findIndex((p) => p.id === partidaId) ?? -1;
          if (!fromList || idx < 0) return;
          // Destino validado ANTES de mover: un toSubId inexistente en el
          // capítulo destino se RECHAZA (no-op), nunca deja `sub` huérfano.
          const toCh = s.chapters.find((c) => c.id === toChapterId);
          if (!toCh) return;
          if (toSubId && !subIn(toCh, toSubId)) return;
          const [moving] = fromList.splice(idx, 1);
          if (!moving) return;
          moving.sub = toSubId || undefined;
          moving.fromBase = false;
          const toList = (s.partidas[toChapterId] ??= []);
          toList.push(moving);
          renumberInPlace(
            s.chapters.find((c) => c.id === fromChapterId),
            fromList,
          );
          renumberInPlace(
            s.chapters.find((c) => c.id === toChapterId),
            toList,
          );
          s.expanded[toChapterId] = true;
          if (s.openPartidaId === partidaId) s.openPartidaId = null; // se movió: deselecciona
        }),

      setObraPath: (path, value) =>
        set((s) => {
          if (typeof value !== 'string') return;
          const keys = path.split('.');
          let obj = s.obra as Record<string, unknown>;
          for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i]!;
            if (typeof obj[k] !== 'object' || obj[k] === null) obj[k] = {};
            obj = obj[k] as Record<string, unknown>;
          }
          obj[keys[keys.length - 1]!] = value;
        }),

      reset: () =>
        set((s) => {
          // Object.assign desde seedObraData(): añadir un campo a ObraData lo
          // resetea automáticamente (sin drift silencioso campo-a-campo).
          const fresh = seedObraData();
          Object.assign(s, fresh);
          Object.assign(s, seedUi(fresh.certs));
        }),
    };
  }),
  ),
);
