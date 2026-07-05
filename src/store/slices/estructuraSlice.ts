/* ===========================================================================
   store/slices/estructuraSlice — CRUD estructural + edición in-situ + COW (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): edición de partidas y mediciones, justificación
   del precio (banco compartido, T9), copy-on-write de recursos, y el CRUD de
   capítulos/subcapítulos/partidas con su renumeración. Lógica idéntica al store
   monolítico; solo cambia de fichero.
   =========================================================================== */
import type { Cert, Chapter, Partida, PartidaBaja, SubChapter } from '../../core/types';
import { round2 } from '../../core/money';
import { mainTypeOf, precioSegunModo } from '../../core/banco';
import { findNode, flattenContainers, subtreeIds } from '../../core/tree';
import { nextPos, renumberChapter } from '../../core/numbering';
import { rawUuid } from '../../core/id';
import { ALL, nextMedLineId, nextPartidaId, nextRecursoCode, subIn } from '../base';
import type { ObraSlice, ObraState } from '../obraStore';

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

type EstructuraSlice = Pick<
  ObraState,
  | 'editPartidaField'
  | 'setPrecio'
  | 'setCantidad'
  | 'addMedLine'
  | 'editMedLine'
  | 'deleteMedLine'
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
  | 'deletePartida'
  | 'restorePartida'
  | 'movePartida'
>;

export const createEstructuraSlice: ObraSlice<EstructuraSlice> = (set) => ({
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
        pos: nextPos(base, sameSub + 1),
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
});
