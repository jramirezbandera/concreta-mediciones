/* ===========================================================================
   store/slices/estructuraSlice — CRUD estructural + edición in-situ + COW (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): edición de partidas y mediciones, justificación
   del precio (banco compartido, T9), copy-on-write de recursos, y el CRUD de
   capítulos/subcapítulos/partidas con su renumeración. Lógica idéntica al store
   monolítico; solo cambia de fichero.
   =========================================================================== */
import type { Cert, Chapter, MedDim, MedForma, MedLine, Partida, PartidaBaja, SubChapter } from '../../core/types';
import { round2 } from '../../core/money';
import { medFormaDe, pesoDesdeComentario } from '../../core/medForma';
import {
  indiceInsercion,
  lineaParaDestino,
  ordenTrasDesplazar,
  ordenTrasMover,
  ordenTrasMoverBloque,
} from '../../core/medPaste';
import { mainTypeOf, precioSegunModo } from '../../core/banco';
import { findNode, flattenContainers, subtreeIds } from '../../core/tree';
import { nextPos, renumberChapter } from '../../core/numbering';
import { rawUuid } from '../../core/id';
import { ALL, nextMedLineId, nextPartidaId, nextRecursoCode, subIn } from '../base';
import type { MedResult, ObraSlice, ObraState } from '../obraStore';
import { historyCheckpoint } from '../temporal';

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
 * Reescribe el PREFIJO de capítulo en toda la rama: el código de un sub es su
 * RUTA («2.1.3»), así que renumerar el capítulo obliga a rebasar a sus
 * descendientes. A diferencia de `recodeSubtree` NO resecuencia a los hermanos
 * (mover un capítulo no debe recodificar la numeración interna de otro), sólo
 * cambia el tramo del capítulo. Un código que no cuelgue del viejo (dato
 * importado raro) se deja intacto.
 */
function rebaseChapterCode(ch: Chapter, code: string): void {
  const old = ch.code;
  if (old === code) return;
  ch.code = code;
  const seen = new Set<SubChapter>();
  const walk = (subs: SubChapter[] | undefined): void => {
    for (const sub of subs ?? []) {
      if (seen.has(sub)) continue; // ciclo (dato corrupto)
      seen.add(sub);
      if (sub.code === old || sub.code.startsWith(`${old}.`))
        sub.code = `${code}${sub.code.slice(old.length)}`;
      walk(sub.children);
    }
  };
  walk(ch.children);
}

/**
 * Renumera los capítulos a 1..N según su ORDEN actual y arrastra la
 * renumeración a subs (prefijo de la ruta) y a las `pos` de sus partidas.
 * Reordenar SÍ cierra los huecos de códigos que deja borrar (política de
 * huecos): un orden 3·1·2 sin recodificar sería ilegible.
 */
function renumberChapters(s: ObraState): void {
  s.chapters.forEach((ch, i) => {
    const code = String(i + 1);
    if (ch.code === code) return; // su numeración no cambia → nada que reescribir
    rebaseChapterCode(ch, code);
    renumberInPlace(ch, s.partidas[ch.id] ?? []);
  });
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
 * Renumera `pos` de una lista de partidas EN SITIO (Immer-friendly), reusando la
 * regla pura de `core/numbering`. Sólo escribe `pos` sobre los drafts; descarta
 * los objetos intermedios → no contamina el árbol de Immer con copias.
 */
function renumberInPlace(ch: Chapter | undefined, list: Partida[]): void {
  const fresh = renumberChapter(ch, list);
  for (let i = 0; i < list.length; i++) list[i]!.pos = fresh[i]!.pos;
}

/**
 * Tombstone (v3): apunta el rastro de una partida que se va a BORRAR si alguna
 * cert la tiene certificada — «Eliminado del presupuesto» la mostrará CON
 * NOMBRE (la valoración va por el `priceSnapshot` de cada cert, no por aquí).
 * Sin importe certificado no hay nada que preservar: no se apunta.
 */
function registrarBaja(s: { certs: Cert[]; bajas: Record<string, PartidaBaja> }, p: Partida): void {
  if (!s.certs.some((c) => (c.data[p.id] ?? 0) > 0)) return;
  s.bajas[p.id] = { code: p.code, title: p.title, ud: p.ud };
}

/**
 * Inserta una partida vacía con el `id` dado en el capítulo/sub destino y su `pos`
 * correlativa. Cuerpo compartido por `addPartida` (id generado dentro del set) y
 * `createPartida` (id generado fuera para devolverlo). Un `subId` inexistente en
 * el capítulo se RECHAZA (partida huérfana que ninguna vista pinta). Devuelve si
 * insertó.
 */
function insertPartida(s: ObraState, chapterId: string, subId: string | null, id: string): boolean {
  const ch = s.chapters.find((c) => c.id === chapterId);
  if (!ch) return false;
  const sub = subId ? subIn(ch, subId) : undefined;
  if (subId && !sub) return false;
  const list = (s.partidas[chapterId] ??= []);
  const base = sub ? sub.code : ch.code;
  const sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub)).length;
  list.push({
    id,
    sub: subId || undefined,
    pos: nextPos(base, sameSub + 1),
    code: '——',
    title: '',
    ud: 'ud',
    precio: 0,
    desc: '',
    med: [],
    items: [],
  });
  return true;
}

/**
 * Reordena una partida DENTRO de su capítulo: la coloca justo ANTES de
 * `beforeId` o, con `beforeId` nulo, al FINAL de su grupo. Las partidas de un
 * capítulo viven en UNA lista plana etiquetada por `sub`, así que «final del
 * grupo» = detrás de la última hermana del mismo contenedor (no de la lista).
 * `toSubId` ausente conserva el contenedor; presente lo cambia (soltar sobre
 * otro grupo del mismo capítulo), validado como en `movePartida`. Cuerpo
 * compartido por `reorderPartida` (arrastre) y `movePartidaBy` (menú ⋮).
 */
function reorderPartidaIn(
  s: ObraState,
  chapterId: string,
  partidaId: string,
  beforeId: string | null,
  toSubId?: string | null,
): void {
  const ch = s.chapters.find((c) => c.id === chapterId);
  const list = s.partidas[chapterId];
  const idx = list?.findIndex((p) => p.id === partidaId) ?? -1;
  if (!ch || !list || idx < 0) return;
  if (beforeId === partidaId) return; // soltarla sobre sí misma
  const cur = list[idx]!;
  const destSub = toSubId === undefined ? (cur.sub ?? null) : toSubId || null;
  // Un sub inexistente en el capítulo se RECHAZA (nunca deja `sub` huérfano).
  if (destSub && !subIn(ch, destSub)) return;
  const subChanged = (cur.sub ?? null) !== destSub;
  const [moving] = list.splice(idx, 1);
  if (!moving) return;
  let at: number;
  if (beforeId) {
    const bi = list.findIndex((p) => p.id === beforeId);
    if (bi < 0) {
      list.splice(idx, 0, moving); // destino fantasma: deja todo como estaba
      return;
    }
    at = bi;
  } else {
    // Final del grupo destino: tras la última hermana; si no hay ninguna, al
    // final de la lista (el grupo aún no existe en ella).
    let last = -1;
    list.forEach((p, i) => {
      if ((p.sub ?? null) === destSub) last = i;
    });
    at = last >= 0 ? last + 1 : list.length;
  }
  if (subChanged) {
    moving.sub = destSub || undefined;
    moving.fromBase = false; // cambiar de contenedor confirma la partida (como `movePartida`)
  }
  list.splice(at, 0, moving);
  renumberInPlace(ch, list);
}

/** Aplica a la línea el kg/m del perfil que nombra su comentario, si toca
 *  (regla en `pesoDesdeComentario`). */
function pesoDelComentario(forma: MedForma, line: MedLine): void {
  const cambio = pesoDesdeComentario(forma, line);
  if (!cambio) return;
  line[cambio.slot] = cambio.value;
  (line.expr ??= {})[cambio.slot] = cambio.expr;
}

/**
 * Partida por id: primero en el capítulo dado y, si no está ahí (se movió de
 * capítulo desde que la UI leyó su `chapterId`), en todo el mapa.
 */
function findPartida(
  s: Pick<ObraState, 'partidas'>,
  chapterId: string,
  partidaId: string,
): Partida | undefined {
  const hit = s.partidas[chapterId]?.find((x) => x.id === partidaId);
  if (hit) return hit;
  for (const list of Object.values(s.partidas)) {
    const p = list.find((x) => x.id === partidaId);
    if (p) return p;
  }
  return undefined;
}

/** Reordena las líneas de una partida (draft) según una lista de ids. Si la
 *  lista ya no casa con las líneas (algo cambió), no toca nada. */
function applyLineOrder(p: Partida, order: readonly string[]): boolean {
  if (order.length !== p.med.length) return false;
  const byId = new Map(p.med.map((l) => [l.id, l]));
  if (order.some((id) => !byId.has(id))) return false;
  p.med = order.map((id) => byId.get(id)!);
  return true;
}

/** Una acción estructural de medición = exactamente UN paso de Deshacer: corta
 *  la ráfaga del historial antes y después (no se funde con una edición
 *  contigua de <700 ms). */
function structural(fn: () => void): void {
  historyCheckpoint();
  try {
    fn();
  } finally {
    historyCheckpoint();
  }
}

/** Hermanas de una partida (mismo contenedor) EN ORDEN de lista. */
function groupSiblings(list: Partida[], p: Partida): Partida[] {
  const sub = p.sub ?? null;
  return list.filter((x) => (x.sub ?? null) === sub);
}

/**
 * Reordena un contenedor ENTRE SUS HERMANOS: capítulo entre capítulos, sub
 * entre los hijos de su mismo padre. Colocar bajo OTRO padre no es reordenar
 * sino `moveSubtree` (menú «Mover a»), así que un `beforeId` que no sea hermano
 * se rechaza. `beforeId` nulo = al final de la lista de hermanos. Renumera lo
 * que toque (códigos de capítulo 1..N o de la rama, y las `pos` de las partidas).
 */
function reorderContainerIn(s: ObraState, nodeId: string, beforeId: string | null): void {
  if (beforeId === nodeId) return;
  const ci = s.chapters.findIndex((c) => c.id === nodeId);
  if (ci >= 0) {
    const bi = beforeId ? s.chapters.findIndex((c) => c.id === beforeId) : s.chapters.length;
    if (bi < 0) return; // capítulo destino inexistente
    const [node] = s.chapters.splice(ci, 1);
    if (!node) return;
    s.chapters.splice(bi > ci ? bi - 1 : bi, 0, node);
    renumberChapters(s);
    return;
  }
  const hit = findNode(s.chapters, nodeId);
  if (!hit || hit.depth === 0) return; // id desconocido
  const ch = hit.chapter;
  const parent = parentOf(ch, nodeId);
  const sibs = parent?.children;
  const si = sibs?.findIndex((x) => x.id === nodeId) ?? -1;
  if (!parent || !sibs || si < 0) return;
  const bi = beforeId ? sibs.findIndex((x) => x.id === beforeId) : sibs.length;
  if (bi < 0) return; // no es hermano: reparentar es `moveSubtree`, no reordenar
  const [node] = sibs.splice(si, 1);
  if (!node) return;
  sibs.splice(bi > si ? bi - 1 : bi, 0, node);
  // La rama se recodifica por posición (misma regla que promover/mover).
  sibs.forEach((sib, i) => recodeSubtree(sib, `${parent.code}.${i + 1}`));
  renumberInPlace(ch, s.partidas[ch.id] ?? []);
}

type EstructuraSlice = Pick<
  ObraState,
  | 'editPartidaField'
  | 'setPrecio'
  | 'setCantidad'
  | 'addMedLine'
  | 'editMedLine'
  | 'deleteMedLine'
  | 'setMedForma'
  | 'editRecurso'
  | 'editItemCantidad'
  | 'addItem'
  | 'deleteItem'
  | 'editItemCode'
  | 'editItemType'
  | 'forkResource'
  | 'setCowChoice'
  | 'addChapter'
  | 'addSubchapter'
  | 'editChapterTitle'
  | 'deleteChapter'
  | 'deleteSubchapter'
  | 'moveSubtree'
  | 'addPartida'
  | 'createPartida'
  | 'addMedLines'
  | 'moveMedLine'
  | 'moveMedLinesBy'
  | 'insertMedLines'
  | 'duplicateMedLines'
  | 'deleteMedLines'
  | 'moveMedLinesTo'
  | 'deletePartida'
  | 'restorePartida'
  | 'movePartida'
  | 'reorderPartida'
  | 'movePartidaBy'
  | 'reorderContainer'
  | 'moveContainerBy'
>;

export const createEstructuraSlice: ObraSlice<EstructuraSlice> = (set, get) => ({
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

  setCantidad: (chapterId, partidaId, value) =>
    set((s) => {
      // La cantidad envenena el importe/PEM igual que el precio: ignora NaN/±∞
      // y negativos. round2 = precisión de cantidad (como la medición).
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      if (!p) return;
      p.cantidad = round2(value);
      p.fromBase = false;
    }),

  addMedLine: (chapterId, partidaId) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      if (!p) return;
      p.med.push({ id: nextMedLineId(), comment: '', uds: '', largo: '', ancho: '', alto: '' });
      p.fromBase = false;
    }),

  editMedLine: (chapterId, partidaId, index, field, value, expr) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      const line = p?.med[index];
      if (!p || !line) return;
      line[field] = value;
      if (field === 'comment') pesoDelComentario(medFormaDe(p), line);
      if (field === 'uds' || field === 'largo' || field === 'ancho' || field === 'alto') {
        const dim = field as MedDim;
        if (expr) (line.expr ??= {})[dim] = expr;
        else if (line.expr) {
          delete line.expr[dim];
          if (Object.keys(line.expr).length === 0) delete line.expr;
        }
      }
      p.fromBase = false;
    }),

  deleteMedLine: (chapterId, partidaId, index) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      if (!p || index < 0 || index >= p.med.length) return;
      p.med.splice(index, 1);
      p.fromBase = false;
    }),

  // No quita el chip BASE: cambiar las columnas no es revisar la partida.
  setMedForma: (chapterId, partidaId, forma) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      if (!p) return;
      if (forma) p.medForma = forma;
      else delete p.medForma;
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
        // El badge de tipo dominante también depende del precio (D-07).
        for (const ch in s.partidas)
          for (const p of s.partidas[ch] ?? []) {
            p.precio = precioSegunModo(p, s.recursos);
            p.mainType = mainTypeOf(p.items, s.recursos);
          }
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
      p.mainType = mainTypeOf(p.items, s.recursos); // D-07: derivado, no fósil
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
      p.mainType = mainTypeOf(p.items, s.recursos); // D-07
    }),

  deleteItem: (chapterId, partidaId, itemIndex) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      if (!p || itemIndex < 0 || itemIndex >= p.items.length) return;
      p.items.splice(itemIndex, 1);
      p.fromBase = false;
      p.precio = precioSegunModo(p, s.recursos);
      p.mainType = mainTypeOf(p.items, s.recursos); // D-07
    }),

  editItemCode: (chapterId, partidaId, itemIndex, rawCode) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      const it = p?.items[itemIndex];
      if (!p || !it) return;
      if (it.type === '%CI') return; // el %CI no es un recurso del banco
      const newCode = (rawCode ?? '').trim();
      if (!newCode || newCode === it.code) return; // no-op
      const existing = s.recursos[newCode];
      if (existing) {
        // ADOPTAR: la línea sigue al concepto existente; el banco da el tipo.
        it.type = existing.type;
      } else {
        // CREAR: clona los valores actuales bajo el código nuevo.
        const src = s.recursos[it.code];
        s.recursos[newCode] = src
          ? { ...src }
          : { type: it.type, desc: it.desc ?? '', ud: it.ud ?? '', precio: it.precio ?? 0 };
      }
      it.code = newCode;
      p.fromBase = false;
      p.precio = precioSegunModo(p, s.recursos);
      p.mainType = mainTypeOf(p.items, s.recursos); // D-07
    }),

  editItemType: (chapterId, partidaId, itemIndex, newType) =>
    set((s) => {
      if (newType !== 'MO' && newType !== 'MQ' && newType !== 'MAT') return; // %CI excluido
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      const it = p?.items[itemIndex];
      if (!p || !it) return;
      if (it.type === '%CI') return; // no se convierte %CI por aquí
      const r = s.recursos[it.code];
      if (r) r.type = newType; // banco = fuente de verdad (render + export lo leen)
      it.type = newType; // espeja el vestigio de ESTA línea
      p.fromBase = false;
      // El tipo no altera el precio (sale del banco) → sin resync de precio.
      // Pero el recurso es COMPARTIDO: el badge dominante puede cambiar en
      // cualquier partida que lo use (D-07) → recalcular todas.
      for (const ch in s.partidas)
        for (const q of s.partidas[ch] ?? []) q.mainType = mainTypeOf(q.items, s.recursos);
    }),

  forkResource: (chapterId, partidaId, itemIndex) => {
    const newCode = nextRecursoCode(); // fuera de `set`: lo devolvemos al llamador
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      const it = p?.items[itemIndex];
      if (!p || !it || it.type === '%CI') return;
      const src = s.recursos[it.code];
      s.recursos[newCode] = src
        ? { ...src }
        : { type: it.type, desc: it.desc ?? '', ud: it.ud ?? '', precio: it.precio ?? 0 };
      it.code = newCode; // re-apunta SOLO esta línea → las demás quedan intactas
      p.fromBase = false;
      p.precio = precioSegunModo(p, s.recursos);
      p.mainType = mainTypeOf(p.items, s.recursos); // D-07
    });
    return newCode;
  },

  setCowChoice: (partidaId, choice) =>
    set((s) => {
      s.cowChoice[partidaId] = choice;
    }),

  addChapter: (title) =>
    set((s) => {
      const num = s.chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
      const code = String(num);
      // Id ÚNICO por construcción (D-03), no derivado del código: el esquema
      // antiguo (`code.padStart`) REUTILIZABA el id de un capítulo borrado, y
      // los contradictorios huérfanos de las certs (referencian por chapterId)
      // «resucitaban» bajo el capítulo nuevo, sin relación con ellos.
      const id = `ch-${rawUuid()}`;
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

  editChapterTitle: (id, title) =>
    set((s) => {
      const t = title.trim();
      if (!t) return; // un capítulo/sub siempre conserva nombre
      const hit = findNode(s.chapters, id);
      if (hit) hit.node.title = t;
    }),

  deleteChapter: (chapterId) =>
    set((s) => {
      const i = s.chapters.findIndex((c) => c.id === chapterId);
      if (i < 0) return;
      const ch = s.chapters[i]!;
      const affectsActive = s.active === chapterId || !!subIn(ch, s.active);
      // Tombstones (v3): las partidas del capítulo que alguna cert tiene
      // certificadas dejan su rastro — «Eliminado del presupuesto» las
      // seguirá mostrando con nombre (la valoración va por snapshot).
      for (const p of s.partidas[chapterId] ?? []) registrarBaja(s, p);
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
      // El sub destino se resuelve a CUALQUIER profundidad; un subId que no exista
      // en el capítulo se RECHAZA dentro de `insertPartida` (crearía una partida
      // huérfana cuyo grupo ninguna vista pinta — eng-review 2026-06-12, Tensión 2).
      insertPartida(s, chapterId, subId, nextPartidaId());
    }),

  createPartida: (chapterId, subId) => {
    // Id fuera del `set` para DEVOLVERLO (patrón de `forkResource`): el executor
    // del asistente lo usa para setear campos/mediciones sin inferir por diferencia.
    const id = nextPartidaId();
    let ok = false;
    set((s) => {
      ok = insertPartida(s, chapterId, subId, id);
    });
    return ok ? id : '';
  },

  addMedLines: (chapterId, partidaId, lines) =>
    set((s) => {
      const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
      if (!p || lines.length === 0) return;
      const forma = medFormaDe(p);
      for (const l of lines) {
        const src: MedLine = {
          id: '',
          comment: l.comment ?? '',
          uds: l.uds ?? '',
          largo: l.largo ?? '',
          ancho: l.ancho ?? '',
          alto: l.alto ?? '',
        };
        p.med.push({ ...lineaParaDestino(src, forma), id: nextMedLineId() });
      }
      p.fromBase = false;
    }),

  moveMedLine: (chapterId, partidaId, lineId, beforeId): MedResult => {
    const p = findPartida(get(), chapterId, partidaId);
    if (!p) return { ids: [], reason: 'no-partida' };
    const order = ordenTrasMover(
      p.med.map((l) => l.id),
      lineId,
      beforeId,
    );
    if (!order) return { ids: [], reason: 'noop' }; // soltar en su sitio: ni historial ni BASE
    let ok = false;
    structural(() =>
      set((s) => {
        const q = findPartida(s, chapterId, partidaId);
        if (!q || !applyLineOrder(q, order)) return;
        q.fromBase = false;
        ok = true;
      }),
    );
    return ok ? { ids: [lineId] } : { ids: [], reason: 'stale' };
  },

  moveMedLinesBy: (chapterId, partidaId, lineIds, delta): MedResult => {
    const p = findPartida(get(), chapterId, partidaId);
    if (!p) return { ids: [], reason: 'no-partida' };
    const order = ordenTrasDesplazar(
      p.med.map((l) => l.id),
      lineIds,
      delta,
    );
    if (!order) return { ids: [], reason: 'noop' }; // borde: el bloque entero se queda
    let ok = false;
    structural(() =>
      set((s) => {
        const q = findPartida(s, chapterId, partidaId);
        if (!q || !applyLineOrder(q, order)) return;
        q.fromBase = false;
        ok = true;
      }),
    );
    return ok ? { ids: lineIds.filter((id) => order.includes(id)) } : { ids: [], reason: 'stale' };
  },

  insertMedLines: (chapterId, partidaId, lines, afterId): MedResult => {
    const p = findPartida(get(), chapterId, partidaId);
    if (!p) return { ids: [], reason: 'no-partida' };
    if (lines.length === 0) return { ids: [], reason: 'no-lines' };
    // Copias PROFUNDAS con id nuevo: el id de origen es clave de `Cert.lineQty`
    // y repetirlo haría que la línea pegada naciera ya certificada.
    const forma = medFormaDe(p);
    const nuevas = lines.map((l) => ({ ...lineaParaDestino(l, forma), id: nextMedLineId() }));
    let ok = false;
    structural(() =>
      set((s) => {
        const q = findPartida(s, chapterId, partidaId);
        if (!q) return;
        q.med.splice(indiceInsercion(q.med, afterId), 0, ...nuevas);
        q.fromBase = false;
        ok = true;
      }),
    );
    return ok ? { ids: nuevas.map((l) => l.id) } : { ids: [], reason: 'stale' };
  },

  duplicateMedLines: (chapterId, partidaId, lineIds): MedResult => {
    const p = findPartida(get(), chapterId, partidaId);
    if (!p) return { ids: [], reason: 'no-partida' };
    const want = new Set(lineIds);
    const src = p.med.filter((l) => want.has(l.id)); // en su orden de lista
    if (src.length === 0) return { ids: [], reason: 'no-lines' };
    return get().insertMedLines(chapterId, partidaId, src, src[src.length - 1]!.id);
  },

  deleteMedLines: (chapterId, partidaId, lineIds): MedResult => {
    const p = findPartida(get(), chapterId, partidaId);
    if (!p) return { ids: [], reason: 'no-partida' };
    const want = new Set(lineIds);
    const gone = p.med.filter((l) => want.has(l.id)).map((l) => l.id);
    if (gone.length === 0) return { ids: [], reason: 'no-lines' };
    let ok = false;
    structural(() =>
      set((s) => {
        const q = findPartida(s, chapterId, partidaId);
        if (!q) return;
        q.med = q.med.filter((l) => !want.has(l.id));
        q.fromBase = false;
        ok = true;
      }),
    );
    return ok ? { ids: gone } : { ids: [], reason: 'stale' };
  },

  moveMedLinesTo: (srcChapterId, srcPartidaId, lineIds, dstChapterId, dstPartidaId, afterId, expect): MedResult => {
    const s0 = get();
    const src = findPartida(s0, srcChapterId, srcPartidaId);
    const dst = findPartida(s0, dstChapterId, dstPartidaId);
    if (!dst) return { ids: [], reason: 'no-partida' };
    const want = new Set(lineIds);
    const moving = src ? src.med.filter((l) => want.has(l.id)) : [];
    const movingIds = moving.map((l) => l.id);
    if (expect && (expect.length !== movingIds.length || expect.some((id, i) => id !== movingIds[i])))
      return { ids: [], reason: 'stale' }; // la UI preparó otra cosa: que vuelva a preparar
    if (!src || moving.length === 0) return { ids: [], reason: 'no-lines' };

    if (src.id === dst.id) {
      const order = ordenTrasMoverBloque(
        src.med.map((l) => l.id),
        movingIds,
        afterId,
      );
      if (!order) return { ids: [], reason: 'noop' }; // mismo sitio: ni historial ni BASE
      let ok = false;
      structural(() =>
        set((s) => {
          const q = findPartida(s, srcChapterId, srcPartidaId);
          if (!q || !applyLineOrder(q, order)) return;
          q.fromBase = false;
          ok = true;
        }),
      );
      return ok ? { ids: movingIds } : { ids: [], reason: 'stale' };
    }

    // A otra partida: ids NUEVOS (el viejo sigue siendo clave de la cert del origen).
    const forma = medFormaDe(dst);
    const nuevas = moving.map((l) => ({ ...lineaParaDestino(l, forma), id: nextMedLineId() }));
    let ok = false;
    structural(() =>
      set((s) => {
        const a = findPartida(s, srcChapterId, srcPartidaId);
        const b = findPartida(s, dstChapterId, dstPartidaId);
        if (!a || !b) return;
        a.med = a.med.filter((l) => !want.has(l.id));
        b.med.splice(indiceInsercion(b.med, afterId), 0, ...nuevas);
        a.fromBase = false;
        b.fromBase = false;
        ok = true;
      }),
    );
    return ok ? { ids: nuevas.map((l) => l.id) } : { ids: [], reason: 'stale' };
  },

  deletePartida: (chapterId, partidaId) =>
    set((s) => {
      const list = s.partidas[chapterId];
      const idx = list?.findIndex((p) => p.id === partidaId) ?? -1;
      if (!list || idx < 0) return;
      registrarBaja(s, list[idx]!); // tombstone si alguna cert la certificó (v3)
      list.splice(idx, 1);
      if (s.openPartidaId === partidaId) s.openPartidaId = null; // no dejar selección fantasma
      renumberInPlace(
        s.chapters.find((c) => c.id === chapterId),
        list,
      );
    }),

  restorePartida: (chapterId, partida, index) =>
    set((s) => {
      // D-08: el capítulo puede haber desaparecido entre el borrado y el undo
      // (capítulo borrado, u obra conmutada). Restaurar contra un capítulo
      // inexistente crearía un bucket fantasma que ninguna vista pinta pero
      // que SÍ suma al PEM — y el autosave lo fosilizaría en el blob.
      if (!s.chapters.some((c) => c.id === chapterId)) return;
      const list = (s.partidas[chapterId] ??= []);
      // El tombstone se limpia ANTES de la guarda (auditoría 2026-07-05): en las
      // DOS salidas la partida queda viva, y viva + tombstone es el estado
      // inconsistente que fosilizaría un huérfano en «Eliminado del presupuesto».
      delete s.bajas[partida.id];
      // Idempotente (voz externa / eng-review undo/redo): si la partida ya está
      // (p.ej. un undo GLOBAL la restauró antes de que se pulse «Deshacer» en el
      // toast de borrado), no reinsertar → evitar duplicarla.
      if (list.some((p) => p.id === partida.id)) return;
      const at = Math.max(0, Math.min(index, list.length));
      list.splice(at, 0, partida);
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

  reorderPartida: (chapterId, partidaId, beforeId, toSubId) =>
    set((s) => {
      reorderPartidaIn(s, chapterId, partidaId, beforeId, toSubId);
    }),

  movePartidaBy: (chapterId, partidaId, delta) =>
    set((s) => {
      const list = s.partidas[chapterId];
      const p = list?.find((x) => x.id === partidaId);
      if (!list || !p) return;
      // Sube/baja UNA posición DENTRO de su grupo (no salta de subcapítulo: eso
      // es «Mover a»). En los bordes del grupo, no-op.
      const sibs = groupSiblings(list, p);
      const i = sibs.findIndex((x) => x.id === partidaId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= sibs.length) return;
      // Subir = colocarse ANTES de la hermana de arriba; bajar = antes de la
      // que sigue a la de abajo (o al final del grupo si no hay más).
      const beforeId = delta < 0 ? sibs[j]!.id : (sibs[j + 1]?.id ?? null);
      reorderPartidaIn(s, chapterId, partidaId, beforeId);
    }),

  reorderContainer: (nodeId, beforeId) =>
    set((s) => {
      reorderContainerIn(s, nodeId, beforeId);
    }),

  moveContainerBy: (nodeId, delta) =>
    set((s) => {
      let sibs: { id: string }[] | undefined;
      if (s.chapters.some((c) => c.id === nodeId)) {
        sibs = s.chapters; // hermanos de un capítulo = los capítulos
      } else {
        const hit = findNode(s.chapters, nodeId);
        if (!hit || hit.depth === 0) return;
        sibs = parentOf(hit.chapter, nodeId)?.children;
      }
      if (!sibs) return;
      const i = sibs.findIndex((x) => x.id === nodeId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= sibs.length) return;
      reorderContainerIn(s, nodeId, delta < 0 ? sibs[j]!.id : (sibs[j + 1]?.id ?? null));
    }),
});
