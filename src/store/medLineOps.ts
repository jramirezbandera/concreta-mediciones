/* ===========================================================================
   store/medLineOps — lo que hacen los gestos sobre líneas de medición:
   copiar, cortar, pegar, mover, duplicar, reordenar, borrar y seleccionar. No
   son hooks: leen las stores con `getState`, así los comparten el enrutador
   global de teclado (`useMedClipboard`), las teclas locales del grid, la barra
   de selección, el pie («Pegar N líneas») y el diálogo de revisión.

   Reglas comunes:
   · Destino de un pegado (teclado y botones): detrás de la última línea
     seleccionada; sin selección, detrás de la línea con el foco; si no, al final.
   · Tras pegar, mover o duplicar, las líneas quedan seleccionadas y el foco va
     al comentario de la primera.
   · El «Deshacer» de los avisos está atado a la revisión del dominio: si la obra
     cambió después, el aviso ya se descartó y el botón no hace nada.
   · Nada cambia dinero en silencio: formas de medir incompatibles, líneas
     certificadas o líneas cortadas que ya no existen pasan por el diálogo de
     revisión (`medUiStore.review`).

   Portapapeles del sistema (Excel ↔ Concreta):

     copiar/cortar ─► clip interno {id, líneas, tsv, cut}
                  └─► TSV al sistema: evento copy (text/plain + MIME propio
                      con el id) · si no llega, navigator.clipboard.writeText ·
                      si nada confirma, sysOk=false (aviso) y el siguiente
                      pegado usa lo interno aunque el sistema tenga otro texto
     pegar ─► resolverPegado(texto, mime)
              · MIME = id del clip ─────────► interno, con AUTORIDAD (mover)
              · MIME = id ya movido ────────► «Esas líneas ya se movieron»
              · sysOk=false ────────────────► interno, sin autoridad
              · texto = TSV del clip ───────► interno, sin autoridad
                                              (un cortado pregunta mover/copia)
              · texto = TSV ya movido ──────► pregunta «Pegar una copia»
              · otro texto ─────────────────► TSV ajeno (cancela un cortado)
              · nada ───────────────────────► nada
   =========================================================================== */
import { medFormaDe } from '../core/medForma';
import {
  lineasCertificadas,
  necesitaRevision,
  prepararMovimiento,
  prepararPegado,
  resumenCantidad,
  rotuloCasilla,
  type PegadoPreparado,
  type ResumenCantidad,
} from '../core/medPaste';
import { lineasATsv, normalizarTsv, parseTsv, textoErrorTsv } from '../core/medTsv';
import { fmtNum } from '../core/money';
import { rawUuid } from '../core/id';
import type { Partida } from '../core/types';
import { useClipboardStore, type MedClip } from './clipboardStore';
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
const toast = () => useToastStore.getState();
const clipStore = () => useClipboardStore.getState();

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
  toast().show(
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

/** ¿El portapapeles tiene un cortado de ESTE documento? */
export function cutPending(clip: MedClip | null = clipStore().medLines): boolean {
  return !!clip?.cut && clip.source.docToken === useObraStore.getState().docToken;
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

/* ---- portapapeles del sistema --------------------------------------------- */

/** TSV pendiente de llegar al portapapeles del sistema (una copia en curso). */
let staged: { id: string; tsv: string } | null = null;

/** Lo recoge el evento `copy`/`cut` del documento para escribirlo él. */
export function takeStagedCopy(): { id: string; tsv: string } | null {
  const s = staged;
  staged = null;
  return s;
}

/** Resultado de la escritura en el sistema para la copia `id`. */
export function systemCopyResult(id: string, ok: boolean): void {
  const clip = clipStore().medLines;
  if (clip?.id !== id) return;
  clipStore().setSysOk(id, ok);
  if (!ok)
    toast().show(`${clip.cut ? 'Cortado' : 'Copiado'} en Concreta; no disponible para Excel`, undefined, {
      tone: 'warn',
    });
}

/** Respaldo si ningún evento `copy` recogió el TSV: `writeText`, si existe
 *  (en http no existe). Si tampoco, `sysOk = false` y aviso. */
export function flushSystemCopy(): void {
  const st = takeStagedCopy();
  if (!st) return;
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb || typeof cb.writeText !== 'function') {
    systemCopyResult(st.id, false);
    return;
  }
  cb.writeText(st.tsv).then(
    () => systemCopyResult(st.id, true),
    () => systemCopyResult(st.id, false),
  );
}

/** Botones (sin Ctrl+C): dispara un evento `copy` dentro del gesto
 *  (`execCommand`, que funciona también en http) y, si no llegó, `writeText`. */
export function copyToSystem(): void {
  if (!staged) return;
  try {
    if (typeof document.execCommand === 'function') document.execCommand('copy');
  } catch {
    /* sin execCommand: queda el respaldo */
  }
  flushSystemCopy();
}

/* ---- copiar / cortar ------------------------------------------------------- */

/**
 * Copia (o corta, con `cut`) las líneas indicadas al portapapeles interno:
 * instantánea profunda + procedencia + TSV. Deja el TSV listo para el sistema
 * (`takeStagedCopy` / `flushSystemCopy`). Vacía las partidas copiadas: la
 * última copia manda. Cortar no quita nada: marca las líneas hasta pegar.
 */
export function copyLines(partidaId: string, lineIds: string[], opts: { cut?: boolean } = {}): boolean {
  const loc = locatePartida(partidaId);
  if (!loc) return false;
  const want = new Set(lineIds);
  const lines = loc.partida.med.filter((l) => want.has(l.id)).map((l) => structuredClone(l));
  if (!lines.length) return false;
  const p = loc.partida;
  const obra = useObraStore.getState();
  const clip: MedClip = {
    id: rawUuid(),
    lines,
    tsv: lineasATsv(lines),
    cut: !!opts.cut,
    sysOk: null,
    source: {
      chapterId: loc.chapterId,
      partidaId,
      code: p.code,
      title: p.title,
      forma: medFormaDe(p),
      ud: p.ud,
      obraName: obra.obra.denominacion || 'Obra',
      docToken: obra.docToken,
    },
  };
  clipStore().setMedClip(clip);
  staged = { id: clip.id, tsv: clip.tsv };
  return true;
}

/** Cancela un cortado pendiente (Esc, ✕ del chip, «Cancelar corte»). */
export function cancelCut(): boolean {
  if (!clipStore().medLines?.cut) return false;
  clipStore().clear();
  toast().show('Corte cancelado');
  return true;
}

/* ---- pegar ---------------------------------------------------------------- */

export type ResolucionPegado =
  | { kind: 'internal'; authority: boolean }
  | { kind: 'consumed' }
  | { kind: 'consumed-text' }
  | { kind: 'foreign' }
  | { kind: 'none' };

/** Qué significa un pegado del sistema (ver diagrama de la cabecera). */
export function resolverPegado(text: string, mimeId: string | null): ResolucionPegado {
  const { medLines: clip, consumed } = clipStore();
  if (mimeId) {
    if (clip && mimeId === clip.id) return { kind: 'internal', authority: true };
    if (consumed && mimeId === consumed.id) return { kind: 'consumed' };
  }
  if (clip && clip.sysOk === false) return { kind: 'internal', authority: false };
  const norm = normalizarTsv(text);
  if (!norm) return { kind: 'none' };
  if (clip && norm === normalizarTsv(clip.tsv)) return { kind: 'internal', authority: false };
  if (consumed && norm === normalizarTsv(consumed.tsv)) return { kind: 'consumed-text' };
  return { kind: 'foreign' };
}

/** Ejecuta un pegado ya resuelto en una partida. */
export function aplicarResolucion(
  r: ResolucionPegado,
  partidaId: string,
  afterId: string | null,
  text: string,
  opts: { switchTab?: boolean } = {},
): void {
  switch (r.kind) {
    case 'internal':
      pasteLines(partidaId, afterId, { ...opts, authority: r.authority });
      return;
    case 'consumed':
      toast().show('Esas líneas ya se movieron', undefined, { tone: 'warn' });
      return;
    case 'consumed-text':
      useMedUiStore.getState().openReview({
        kind: 'choose',
        reason: 'consumed-text',
        partidaId,
        afterId,
        text,
        srcCode: '',
        n: text.split('\n').filter((x) => x.trim()).length,
      });
      return;
    case 'foreign':
      pasteText(partidaId, afterId, text, opts);
      return;
  }
}

/**
 * Pega el portapapeles INTERNO en una partida, detrás de `afterId` (`null` =
 * al final). Un cortado de este documento se MUEVE, pero solo con autoridad
 * (el MIME propio o un botón de Concreta); con solo el texto, se pregunta. Un
 * cortado de otra obra se pega como copia. `switchTab` lleva el panel a la
 * pestaña Medición (Ctrl+V desde fuera de la tabla).
 */
export function pasteLines(
  partidaId: string,
  afterId: string | null,
  opts: { switchTab?: boolean; authority?: boolean } = {},
): void {
  const clip = clipStore().medLines;
  if (!clip?.lines.length) return;
  const loc = locatePartida(partidaId);
  if (!loc) {
    toast().show(failText('no-partida'), undefined, { tone: 'error' });
    return;
  }
  const ui = useMedUiStore.getState();
  if (opts.switchTab && ui.tab !== 'medicion') ui.setTab('medicion');

  if (cutPending(clip)) {
    if (!opts.authority) {
      ui.openReview({
        kind: 'choose',
        reason: 'cut-text',
        partidaId,
        afterId,
        text: clip.tsv,
        srcCode: clip.source.code,
        n: clip.lines.length,
      });
      return;
    }
    prepareMove(clip, loc, afterId);
    return;
  }
  let nota: string | undefined;
  if (clip.cut) {
    clipStore().uncutMedClip(); // corte de otra obra: se pega como copia
    nota = 'como copia: el corte era de otra obra';
  }
  const prep = prepararPegado({
    destino: loc.partida,
    chapterId: loc.chapterId,
    destinoForma: medFormaDe(loc.partida),
    lines: clip.lines,
    origen: { code: clip.source.code, forma: clip.source.forma, ud: clip.source.ud },
    afterId,
    coefK: coefK(),
  });
  if (necesitaRevision(prep)) {
    ui.openReview({ kind: 'paste', prep, nota });
    return;
  }
  applyPaste(prep, nota);
}

/** Prepara mover un cortado de este documento a `loc`. */
function prepareMove(clip: MedClip, loc: { chapterId: string; partida: Partida }, afterId: string | null): void {
  const ui = useMedUiStore.getState();
  const src = locatePartida(clip.source.partidaId);
  const ids = clip.lines.map((l) => l.id);
  const vivas = src ? src.partida.med.filter((l) => ids.includes(l.id)) : [];
  if (!src || vivas.length === 0) {
    // Ninguna sigue viva: se ofrece pegar la instantánea guardada al cortar.
    const prep = prepararPegado({
      destino: loc.partida,
      chapterId: loc.chapterId,
      destinoForma: medFormaDe(loc.partida),
      lines: clip.lines,
      origen: { code: clip.source.code, forma: clip.source.forma, ud: clip.source.ud },
      afterId,
      coefK: coefK(),
    });
    ui.openReview({ kind: 'paste', prep: { ...prep, copiaGuardada: true } });
    return;
  }
  const prep = prepararMovimiento({
    src: src.partida,
    srcChapterId: src.chapterId,
    srcForma: medFormaDe(src.partida),
    lineIds: ids,
    destino: loc.partida,
    chapterId: loc.chapterId,
    destinoForma: medFormaDe(loc.partida),
    afterId,
    certs: useObraStore.getState().certs,
    coefK: coefK(),
  });
  if (prep.mover!.noop) return; // mismo sitio: ni cambia nada ni consume el corte
  if (necesitaRevision(prep)) {
    ui.openReview({ kind: 'paste', prep });
    return;
  }
  applyPaste(prep);
}

/**
 * Pega TEXTO ajeno (una hoja de cálculo) como líneas nuevas. Un fallo de
 * lectura rechaza el pegado entero y lo explica en la franja de error. Pegar
 * otro texto cancela un cortado pendiente.
 */
export function pasteText(
  partidaId: string,
  afterId: string | null,
  text: string,
  opts: { switchTab?: boolean } = {},
): void {
  const loc = locatePartida(partidaId);
  if (!loc) {
    toast().show(failText('no-partida'), undefined, { tone: 'error' });
    return;
  }
  const ui = useMedUiStore.getState();
  if (opts.switchTab && ui.tab !== 'medicion') ui.setTab('medicion');
  if (clipStore().medLines?.cut) clipStore().clear();
  const forma = medFormaDe(loc.partida);
  let parsed: ReturnType<typeof parseTsv>;
  try {
    parsed = parseTsv(text);
  } catch {
    ui.setPasteError({ partidaId, text: 'No se pudo pegar: el texto no se puede leer como tabla' });
    return;
  }
  if (!parsed.ok) {
    ui.setPasteError({ partidaId, text: textoErrorTsv(parsed.error, (slot) => rotuloCasilla(forma, slot).label) });
    return;
  }
  if (!parsed.lines.length) return;
  const prep = prepararPegado({
    destino: loc.partida,
    chapterId: loc.chapterId,
    destinoForma: forma,
    lines: parsed.lines,
    origen: null,
    afterId,
    coefK: coefK(),
  });
  if (!Number.isFinite(prep.despues.cantidad) || !Number.isFinite(prep.despues.importe)) {
    ui.setPasteError({ partidaId, text: 'No se pudo pegar: la cantidad o el importe no serían un número finito' });
    return;
  }
  if (necesitaRevision(prep)) {
    ui.openReview({ kind: 'paste', prep });
    return;
  }
  applyPaste(prep);
}

/** Aplica un pegado ya preparado (directo, o tras confirmar en el diálogo). */
export function applyPaste(prep: PegadoPreparado, nota?: string): void {
  if (prep.mover) {
    applyMove(prep);
    return;
  }
  const { chapterId, partidaId } = prep.destino;
  const res = useObraStore.getState().insertMedLines(chapterId, partidaId, prep.lines, prep.afterId);
  if (!res.ids.length) {
    toast().show(failText(res.reason), undefined, { tone: 'error' });
    return;
  }
  if (prep.copiaGuardada) clipStore().uncutMedClip();
  afterInsert(partidaId, res.ids, prep.afterId, prep.antes, 'pegada', 'pegadas', nota);
}

/** Mueve un cortado: UN paso de Deshacer, el clip se consume. */
function applyMove(prep: PegadoPreparado): void {
  const m = prep.mover!;
  const { chapterId, partidaId, code, ud } = prep.destino;
  const res = useObraStore
    .getState()
    .moveMedLinesTo(m.srcChapterId, m.srcPartidaId, m.lineIds, chapterId, partidaId, prep.afterId, m.lineIds);
  if (res.reason === 'noop') return;
  if (res.reason === 'stale') {
    pasteLines(partidaId, prep.afterId, { authority: true }); // vuelve a preparar (y a preguntar)
    return;
  }
  if (!res.ids.length) {
    toast().show(failText(res.reason), undefined, { tone: 'error' });
    return;
  }
  clipStore().consumeMedClip();
  const ui = useMedUiStore.getState();
  ui.setPasteError(null);
  ui.select(partidaId, res.ids, res.ids[0]);
  ui.requestFocus({ partidaId, kind: 'lines', lineIds: [res.ids[0]!], col: 0, scroll: true });
  const n = plural(res.ids.length, 'línea movida', 'líneas movidas');
  const focusBack: FocusRequest = { partidaId, kind: 'lines', lineIds: prep.afterId ? [prep.afterId] : [], col: 0 };
  if (m.mismaPartida) {
    toastWithUndo(n, focusBack);
    return;
  }
  const src = locatePartida(m.srcPartidaId)?.partida;
  const dst = locatePartida(partidaId)?.partida;
  const k = coefK();
  const partes = [n];
  if (src) partes.push(`${m.srcCode || 'origen'} ${cambioCantidad(m.srcAntes, resumenCantidad(src, k), m.srcUd)}`);
  if (dst) partes.push(`${code || 'destino'} ${cambioCantidad(prep.antes, resumenCantidad(dst, k), ud)}`);
  toastWithUndo(partes.join(' · '), focusBack);
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
  nota?: string,
): void {
  const ui = useMedUiStore.getState();
  ui.setPasteError(null);
  ui.select(partidaId, ids, ids[0]);
  ui.requestFocus({ partidaId, kind: 'lines', lineIds: [ids[0]!], col: 0, scroll: true });
  const loc = locatePartida(partidaId);
  if (!loc) return;
  const p = loc.partida;
  const despues = resumenCantidad(p, coefK());
  const donde = one === 'pegada' ? ` en ${p.code || 'la partida'}` : '';
  toastWithUndo(
    `${plural(ids.length, `línea ${one}`, `líneas ${many}`)}${donde} · ${cambioCantidad(antes, despues, p.ud)}${nota ? ` (${nota})` : ''}`,
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
