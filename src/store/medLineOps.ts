/* ===========================================================================
   store/medLineOps — lo que hacen los gestos sobre líneas de medición:
   copiar, pegar, duplicar, reordenar, borrar y seleccionar. No son hooks:
   leen las stores con `getState`, así los comparten el enrutador global de
   teclado (`useMedClipboard`), las teclas locales del grid, la barra de
   selección, el pie («Pegar N líneas») y el diálogo de revisión.

   Reglas comunes:
   · Destino de un pegado (teclado y botones): detrás de la última línea
     seleccionada; sin selección, detrás de la línea con el foco; si no, al final.
   · Tras pegar o duplicar, las líneas nuevas quedan seleccionadas y el foco va
     al comentario de la primera.
   · El «Deshacer» de los avisos está atado a la revisión del dominio: si la obra
     cambió después, el aviso ya se descartó y el botón no hace nada.
   · Nada cambia dinero en silencio: formas de medir incompatibles o líneas
     certificadas pasan por el diálogo de revisión (`medUiStore.review`).
   =========================================================================== */
import { medFormaDe } from '../core/medForma';
import {
  lineasCertificadas,
  prepararPegado,
  resumenCantidad,
  type PegadoPreparado,
  type ResumenCantidad,
} from '../core/medPaste';
import { fmtNum } from '../core/money';
import type { Partida } from '../core/types';
import { useClipboardStore } from './clipboardStore';
import { selectionOf, useMedUiStore, type FocusRequest } from './medUiStore';
import { useObraStore, type MedResult } from './obraStore';
import { getDomainRevision, undo } from './temporal';
import { useToastStore } from './toastStore';

/** Partida y su capítulo (clave del `PartidasMap`), por id. */
export function locatePartida(partidaId: string): { chapterId: string; partida: Partida } | null {
  const { partidas } = useObraStore.getState();
  for (const [chapterId, list] of Object.entries(partidas)) {
    const partida = list?.find((p) => p.id === partidaId);
    if (partida) return { chapterId, partida };
  }
  return null;
}

/** Selección de la partida, en orden de lista. */
export function orderedSelection(p: Partida): string[] {
  const sel = new Set(selectionOf(p.id));
  return p.med.filter((l) => sel.has(l.id)).map((l) => l.id);
}

/** Líneas sobre las que actúa un atajo o un botón: la selección o, si no hay,
 *  la línea con el foco. */
export function actionLines(p: Partida, focusLineId: string | null): string[] {
  const sel = orderedSelection(p);
  if (sel.length) return sel;
  return focusLineId && p.med.some((l) => l.id === focusLineId) ? [focusLineId] : [];
}

/** Destino de un pegado (ver cabecera). `null` = al final. */
export function pasteAnchor(p: Partida, focusLineId: string | null): string | null {
  const sel = orderedSelection(p);
  if (sel.length) return sel[sel.length - 1]!;
  return focusLineId && p.med.some((l) => l.id === focusLineId) ? focusLineId : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const coefK = () => useObraStore.getState().rates.coefK;

/** «A → B ud», o «cantidad fija A → medida B ud» si la partida no medía. */
export function cambioCantidad(antes: ResumenCantidad, despues: ResumenCantidad, ud: string): string {
  if (antes.fija && antes.cantidad > 0 && !despues.fija)
    return `cantidad fija ${fmtNum(antes.cantidad)} → medida ${fmtNum(despues.cantidad)} ${ud}`;
  if (!antes.fija && despues.fija && despues.cantidad > 0)
    return `${fmtNum(antes.cantidad)} → cantidad fija ${fmtNum(despues.cantidad)} ${ud}`;
  return `${fmtNum(antes.cantidad)} → ${fmtNum(despues.cantidad)} ${ud}`;
}

function failText(reason: MedResult['reason']): string {
  return reason === 'no-partida'
    ? 'No se pudo pegar: la partida ya no existe'
    : 'No se pudo pegar: la medición cambió mientras tanto. Vuelve a intentarlo';
}

/** Aviso con «Deshacer» atado a la revisión del dominio de ESTE momento. */
function toastWithUndo(msg: string, focusAfterUndo: FocusRequest): void {
  const rev = getDomainRevision();
  useToastStore.getState().show(
    msg,
    {
      label: 'Deshacer',
      run: () => {
        if (getDomainRevision() !== rev) return; // la obra cambió: desharía otra cosa
        undo();
        useMedUiStore.getState().requestFocus(focusAfterUndo);
      },
    },
    { rev },
  );
}

/* ---- selección ------------------------------------------------------------ */

/** Click en la casilla: alterna la línea; con Shift, añade el rango desde el
 *  ancla. */
export function toggleLine(partidaId: string, lineId: string, range = false): void {
  const loc = locatePartida(partidaId);
  if (!loc) return;
  const ui = useMedUiStore.getState();
  const ids = loc.partida.med.map((l) => l.id);
  const cur = selectionOf(partidaId);
  const anchor = ui.partidaId === partidaId ? ui.anchorId : null;
  if (range && anchor && ids.includes(anchor) && ids.includes(lineId)) {
    const a = ids.indexOf(anchor);
    const b = ids.indexOf(lineId);
    const span = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
    ui.select(partidaId, [...new Set([...cur, ...span])], anchor);
    return;
  }
  ui.select(
    partidaId,
    cur.includes(lineId) ? cur.filter((id) => id !== lineId) : [...cur, lineId],
    lineId,
  );
}

/** Shift+↑/↓: la selección pasa a ser el rango entre el ancla (o `fromId`, si
 *  no hay) y `toId`. */
export function extendSelection(partidaId: string, fromId: string, toId: string): void {
  const loc = locatePartida(partidaId);
  if (!loc) return;
  const ui = useMedUiStore.getState();
  const ids = loc.partida.med.map((l) => l.id);
  const sel = selectionOf(partidaId);
  const anchor = sel.length && ui.anchorId && ids.includes(ui.anchorId) ? ui.anchorId : fromId;
  const a = ids.indexOf(anchor);
  const b = ids.indexOf(toId);
  if (a < 0 || b < 0) return;
  ui.select(partidaId, ids.slice(Math.min(a, b), Math.max(a, b) + 1), anchor);
}

/* ---- copiar / pegar / duplicar -------------------------------------------- */

/** Copia las líneas indicadas al portapapeles interno (instantánea profunda +
 *  procedencia). Vacía las partidas copiadas: la última copia manda. */
export function copyLines(partidaId: string, lineIds: string[]): boolean {
  const loc = locatePartida(partidaId);
  if (!loc) return false;
  const want = new Set(lineIds);
  const lines = loc.partida.med.filter((l) => want.has(l.id)).map((l) => structuredClone(l));
  if (!lines.length) return false;
  const p = loc.partida;
  useClipboardStore.getState().setMedClip({
    lines,
    source: {
      chapterId: loc.chapterId,
      partidaId,
      code: p.code,
      title: p.title,
      forma: medFormaDe(p),
      ud: p.ud,
      obraName: useObraStore.getState().obra.denominacion || 'Obra',
    },
  });
  return true;
}

/**
 * Pega lo copiado en una partida, detrás de `afterId` (`null` = al final). Si
 * las formas de medir no son compatibles, abre el diálogo de revisión en vez de
 * pegar. `switchTab` lleva el panel a la pestaña Medición (Ctrl+V desde fuera
 * de la tabla), para que el cambio se vea.
 */
export function pasteLines(partidaId: string, afterId: string | null, opts: { switchTab?: boolean } = {}): void {
  const clip = useClipboardStore.getState().medLines;
  if (!clip?.lines.length) return;
  const loc = locatePartida(partidaId);
  if (!loc) {
    useToastStore.getState().show(failText('no-partida'), undefined, { tone: 'error' });
    return;
  }
  const ui = useMedUiStore.getState();
  if (opts.switchTab && ui.tab !== 'medicion') ui.setTab('medicion');
  const prep = prepararPegado({
    destino: loc.partida,
    chapterId: loc.chapterId,
    destinoForma: medFormaDe(loc.partida),
    lines: clip.lines,
    origen: { code: clip.source.code, forma: clip.source.forma, ud: clip.source.ud },
    afterId,
    coefK: coefK(),
  });
  if (!prep.compat.compatible) {
    ui.openReview({ kind: 'paste', prep });
    return;
  }
  applyPaste(prep);
}

/** Aplica un pegado ya preparado (directo, o tras «Pegar tal cual»). */
export function applyPaste(prep: PegadoPreparado): void {
  const { chapterId, partidaId } = prep.destino;
  const res = useObraStore.getState().insertMedLines(chapterId, partidaId, prep.lines, prep.afterId);
  if (!res.ids.length) {
    useToastStore.getState().show(failText(res.reason), undefined, { tone: 'error' });
    return;
  }
  afterInsert(partidaId, res.ids, prep.afterId, prep.antes, 'pegada', 'pegadas');
}

/** Duplica las líneas indicadas justo detrás de la última de ellas. */
export function duplicateLines(partidaId: string, lineIds: string[]): void {
  const loc = locatePartida(partidaId);
  if (!loc) return;
  const antes = resumenCantidad(loc.partida, coefK());
  const want = new Set(lineIds);
  const last = loc.partida.med.filter((l) => want.has(l.id)).at(-1)?.id ?? null;
  const res = useObraStore.getState().duplicateMedLines(loc.chapterId, partidaId, lineIds);
  if (!res.ids.length) return;
  afterInsert(partidaId, res.ids, last, antes, 'duplicada', 'duplicadas');
}

/** Tras insertar: selecciona lo nuevo, le lleva el foco y avisa con Deshacer. */
function afterInsert(
  partidaId: string,
  ids: string[],
  afterId: string | null,
  antes: ResumenCantidad,
  one: string,
  many: string,
): void {
  const ui = useMedUiStore.getState();
  ui.select(partidaId, ids, ids[0]);
  ui.requestFocus({ partidaId, kind: 'lines', lineIds: [ids[0]!], col: 0, scroll: true });
  const loc = locatePartida(partidaId);
  if (!loc) return;
  const p = loc.partida;
  const despues = resumenCantidad(p, coefK());
  const donde = one === 'pegada' ? ` en ${p.code || 'la partida'}` : '';
  toastWithUndo(
    `${plural(ids.length, `línea ${one}`, `líneas ${many}`)}${donde} · ${cambioCantidad(antes, despues, p.ud)}`,
    { partidaId, kind: 'lines', lineIds: afterId ? [afterId] : [], col: 0 },
  );
}

/* ---- borrar ---------------------------------------------------------------- */

/**
 * Borra líneas. Si alguna está certificada, pide confirmación en el diálogo de
 * revisión (salvo `confirmed`). El foco pasa a la misma columna de la fila
 * siguiente; si no hay, a la anterior; si la lista queda vacía, a «Añadir
 * línea». `toast` ofrece Deshacer (la barra sí; la X de una línea, no).
 */
export function deleteLines(
  partidaId: string,
  lineIds: string[],
  opts: { confirmed?: boolean; toast?: boolean; col?: number | 'del' } = {},
): void {
  const loc = locatePartida(partidaId);
  if (!loc) return;
  const { partida: p, chapterId } = loc;
  const want = new Set(lineIds);
  const ordered = p.med.filter((l) => want.has(l.id)).map((l) => l.id);
  if (!ordered.length) return;
  const ui = useMedUiStore.getState();
  if (!opts.confirmed) {
    const cert = lineasCertificadas(useObraStore.getState().certs, partidaId, ordered);
    if (cert.lineIds.length) {
      ui.openReview({
        kind: 'delete',
        chapterId,
        partidaId,
        lineIds: ordered,
        certLineIds: cert.lineIds,
        certNums: cert.certNums,
        toast: !!opts.toast,
        col: opts.col ?? 0,
      });
      return;
    }
  }
  const ids = p.med.map((l) => l.id);
  const first = ids.indexOf(ordered[0]!);
  const last = ids.indexOf(ordered[ordered.length - 1]!);
  const next =
    ids.slice(last + 1).find((id) => !want.has(id)) ??
    ids.slice(0, first).reverse().find((id) => !want.has(id));
  const antes = resumenCantidad(p, coefK());
  const res = useObraStore.getState().deleteMedLines(chapterId, partidaId, ordered);
  if (!res.ids.length) return;
  ui.clearSelection();
  const col = opts.col ?? 0;
  ui.requestFocus(
    next ? { partidaId, kind: 'lines', lineIds: [next], col } : { partidaId, kind: 'add' },
  );
  if (!opts.toast) return;
  const after = locatePartida(partidaId)?.partida;
  if (!after) return;
  toastWithUndo(
    `${plural(res.ids.length, 'línea eliminada', 'líneas eliminadas')} · ${cambioCantidad(antes, resumenCantidad(after, coefK()), after.ud)}`,
    { partidaId, kind: 'lines', lineIds: ordered, col: 0 },
  );
}

/* ---- reordenar ------------------------------------------------------------- */

/** Anuncia por `aria-live` dónde quedó lo movido (reordenar no muestra aviso). */
function announceMove(partidaId: string, ids: string[], delta?: -1 | 1): void {
  const p = locatePartida(partidaId)?.partida;
  if (!p || !ids.length) return;
  const ui = useMedUiStore.getState();
  if (ids.length === 1) {
    const pos = p.med.findIndex((l) => l.id === ids[0]) + 1;
    ui.say(`Línea movida a la posición ${pos} de ${p.med.length}`);
  } else {
    ui.say(`${ids.length} líneas movidas ${delta && delta > 0 ? 'hacia abajo' : 'hacia arriba'}`);
  }
}

/** Sube (-1) o baja (+1) las líneas una posición. `focus`: celda que debe
 *  seguir a la línea (Alt+↑/↓); sin él, el foco se queda donde está (barra). */
export function moveLinesBy(
  partidaId: string,
  lineIds: string[],
  delta: -1 | 1,
  focus?: { lineId: string; col: number | 'del' } | null,
): MedResult {
  const loc = locatePartida(partidaId);
  if (!loc) return { ids: [], reason: 'no-partida' };
  const res = useObraStore.getState().moveMedLinesBy(loc.chapterId, partidaId, lineIds, delta);
  if (!res.ids.length) return res;
  announceMove(partidaId, res.ids, delta);
  if (focus)
    useMedUiStore.getState().requestFocus({ partidaId, kind: 'lines', lineIds: [focus.lineId], col: focus.col });
  return res;
}

/** Arrastre: coloca UNA línea delante de `beforeId` (`null` = al final). */
export function moveLineTo(partidaId: string, lineId: string, beforeId: string | null): MedResult {
  const loc = locatePartida(partidaId);
  if (!loc) return { ids: [], reason: 'no-partida' };
  const res = useObraStore.getState().moveMedLine(loc.chapterId, partidaId, lineId, beforeId);
  if (res.ids.length) announceMove(partidaId, res.ids);
  return res;
}
