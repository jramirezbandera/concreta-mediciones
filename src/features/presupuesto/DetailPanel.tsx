import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { EditableText, Icon } from '../../components';
import { medTotal } from '../../core/medicion';
import { medColumnas, medFormaDe, medFormaDef } from '../../core/medForma';
import { fmtNum } from '../../core/money';
import type { Partida } from '../../core/types';
import { isTextField } from '../../hooks/hotkeyGuards';
import { isTouchOnly } from '../../hooks/touchOnly';
import { useGridNav } from '../../hooks/useGridNav';
import { useMedGridTab } from '../../hooks/useMedGridTab';
import { useMedLineKeys } from '../../hooks/useMedLineKeys';
import { useClipboardStore, useObraStore } from '../../store';
import { pasteAnchor, pasteLines } from '../../store/medLineOps';
import { selectionOf, useMedUiStore } from '../../store/medUiStore';
import { FUERA_TITLE } from './format';
import { MedCards } from './MedCards';
import { MedFormaSelect } from './MedFormaSelect';
import { MedLineRow } from './MedLineRow';
import { MedPasteReview } from './MedPasteReview';
import { MedSelectionBar } from './MedSelectionBar';
import { PriceJustif } from './PriceJustif';
import { PriceJustifCards } from './PriceJustifCards';
import styles from './Presupuesto.module.css';

/** Cantidad de la partida tal como la usa el importe: la Σ de la medición o,
 *  sin líneas, la cantidad FIJA (que antes el pie enseñaba como 0,00). */
function Cantidad({ p }: { p: Partida }) {
  const med = p.med ?? [];
  const fija = med.length === 0 && (p.cantidad ?? 0) > 0;
  return (
    <div className={styles.detailQty}>
      <span className={`caps ${styles.detailQtyLabel}`}>{fija ? 'Cantidad fija' : 'Cantidad total'}</span>
      <span className={`mono ${styles.detailQtyVal}`}>{fmtNum(fija ? p.cantidad : medTotal(med))}</span>
      <span className={styles.detailQtyUd}>{p.ud}</span>
    </div>
  );
}

/** Destino actual de un pegado en esta partida (selección → foco → final). */
function currentAnchor(p: Partida): string | null {
  const ui = useMedUiStore.getState();
  return pasteAnchor(p, ui.partidaId === p.id ? ui.lastFocusedLineId : null);
}

/**
 * «Pegar N líneas» del pie (tabla y tarjetas) mientras el portapapeles interno
 * tenga líneas. El destino se FIJA en `pointerdown`, antes de que el click saque
 * el foco de la línea (en Safari un botón no toma el foco y la línea lo pierde);
 * activado con teclado se calcula al pulsar. Si hay destino lo dice en gris.
 */
function PasteButton({ p, touch }: { p: Partida; touch: boolean }) {
  const clip = useClipboardStore((s) => s.medLines);
  const anchorId = useMedUiStore((s) => pasteAnchor(p, s.partidaId === p.id ? s.lastFocusedLineId : null));
  const pinned = useRef<string | null | undefined>(undefined);
  if (!clip) return null;
  const n = clip.lines.length;
  const idx = anchorId ? p.med.findIndex((l) => l.id === anchorId) : -1;
  const anchor = idx >= 0 ? p.med[idx]! : null;
  const title =
    `${n} ${n === 1 ? 'línea' : 'líneas'} de ${clip.source.code || 'otra partida'} · ` +
    `medidas por ${medFormaDef(clip.source.forma).nombre}${touch ? '' : ' · Ctrl/⌘+V'}`;
  return (
    <button
      type="button"
      title={title}
      className={`tcol ${styles.medAddBtn} ${styles.medPasteBtn}`}
      onPointerDown={() => {
        pinned.current = currentAnchor(p);
      }}
      onClick={() => {
        const afterId = pinned.current !== undefined ? pinned.current : currentAnchor(p);
        pinned.current = undefined;
        pasteLines(p.id, afterId);
      }}
    >
      <Icon name="paste" size={14} /> Pegar {n === 1 ? 'línea' : `${n} líneas`}
      {anchor && (
        <span className={styles.medPasteWhere}>tras «{anchor.comment.trim() || `línea ${idx + 1}`}»</span>
      )}
    </button>
  );
}

/**
 * Aplica la petición de foco pendiente (`medUiStore.pendingFocus`) tras el
 * render que movió o creó las filas: celda pedida de la primera línea que
 * exista → primera fila → «Añadir línea». Efecto PASIVO a propósito: corre
 * después de que un `Modal` que se cierra devuelva el foco a donde estaba.
 */
function usePendingFocus(
  partidaId: string,
  rootRef: RefObject<HTMLElement | null>,
  addRef: RefObject<HTMLElement | null>,
) {
  const pending = useMedUiStore((s) => (s.pendingFocus?.partidaId === partidaId ? s.pendingFocus : null));
  useEffect(() => {
    if (!pending) return;
    useMedUiStore.getState().consumeFocus();
    const root = rootRef.current;
    if (!root) return;
    let el: HTMLElement | null = null;
    if (pending.kind === 'lines') {
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-lineid]'));
      const row =
        pending.lineIds.map((id) => rows.find((r) => r.dataset.lineid === id)).find(Boolean) ?? rows[0];
      if (row)
        el =
          pending.col === 'del'
            ? row.querySelector<HTMLElement>('[data-del]')
            : (row.querySelector<HTMLElement>(`[data-editfield][data-col="${pending.col}"] [data-editcell]`) ??
              row.querySelector<HTMLElement>('[data-editcell]'));
    }
    el ??= addRef.current;
    el?.focus();
    if (pending.kind === 'lines' && pending.scroll) el?.scrollIntoView?.({ block: 'nearest' });
  }, [pending, rootRef, addRef]);
}

/**
 * Panel de detalle de una partida: toggle segmentado Medición / Descripción /
 * Justificación del precio. La Medición edita líneas (uds·largo·ancho·alto →
 * parcial) y el total alimenta la cantidad de la partida en vivo; la forma de
 * medir decide qué columnas se ven y cómo se llaman (`core/medForma`). En modo
 * `compact` (<780, F2.5) la medición y la justificación pasan a tarjetas.
 *
 * Las líneas se reordenan (asa, Alt+↑/↓, barra), se seleccionan (casilla,
 * Shift+click, Shift+Espacio, Shift+↑/↓) y se copian, pegan, duplican o borran
 * (`store/medLineOps`). La pestaña y la selección viven en `medUiStore`, así
 * sobreviven al paso tabla ↔ tarjetas, que monta otro árbol.
 */
export function DetailPanel({
  p,
  chapterId,
  compact = false,
}: {
  p: Partida;
  chapterId: string;
  compact?: boolean;
}) {
  const tab = useMedUiStore((s) => s.tab);
  const setTab = useMedUiStore((s) => s.setTab);
  const hasSel = useMedUiStore((s) => s.partidaId === p.id && s.selected.length > 0);
  const announce = useMedUiStore((s) => s.announce);
  const gridNav = useGridNav();
  const editPartidaField = useObraStore((s) => s.editPartidaField);
  const addMedLine = useObraStore((s) => s.addMedLine);
  const setMedForma = useObraStore((s) => s.setMedForma);

  const med = p.med ?? [];
  const forma = medFormaDe(p);
  // Memoizado: las filas (`MedLineRow`, memo) no se re-renderizan al seleccionar.
  const cols = useMemo(() => medColumnas(forma, p.med ?? []), [forma, p.med]);
  const touch = isTouchOnly();
  const formaSelect = (
    <MedFormaSelect forma={p.medForma} ud={p.ud} onChange={(f) => setMedForma(chapterId, p.id, f)} />
  );
  // Tab/Enter encadenan edición y crean fila al final (hoja de cálculo).
  const medTab = useMedGridTab(() => addMedLine(chapterId, p.id), med.length);
  const lineKeys = useMedLineKeys(p.id);
  const medRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  usePendingFocus(p.id, medRef, addRef);

  const clipN = useClipboardStore((s) => s.medLines?.lines.length ?? 0);
  const emptyText = touch
    ? `Sin líneas de medición. Añade la primera para calcular la cantidad${clipN ? ' o pega las copiadas' : ''}.`
    : `Sin líneas de medición. Añade la primera para calcular la cantidad${clipN ? ' o pega las copiadas' : ''}; luego encadena celdas con Tab y baja con Enter.`;

  return (
    <div className={`${styles.detail} ${compact ? styles.compact : ''}`}>
      <div className={styles.detailBar}>
        <div className={styles.seg}>
          <button
            type="button"
            className={`tcol ${styles.segBtn} ${tab === 'medicion' ? styles.on : ''}`}
            onClick={() => setTab('medicion')}
          >
            Medición
            <span className={`mono ${styles.segCount}`}>{med.length}</span>
          </button>
          <button
            type="button"
            className={`tcol ${styles.segBtn} ${tab === 'descripcion' ? styles.on : ''}`}
            onClick={() => setTab('descripcion')}
          >
            Descripción
          </button>
          <button
            type="button"
            className={`tcol ${styles.segBtn} ${tab === 'justif' ? styles.on : ''}`}
            onClick={() => setTab('justif')}
          >
            {/* En móvil, «del precio» partía la pestaña en dos líneas. */}
            {compact ? 'Justificación' : 'Justificación del precio'}
            {p.items.length > 0 && <span className={`mono ${styles.segCount}`}>{p.items.length}</span>}
          </button>
        </div>
        {!compact && (tab === 'medicion' ? formaSelect : <Cantidad p={p} />)}
      </div>

      {tab === 'medicion' && (
        <div
          ref={medRef}
          className={`${hasSel ? styles.medHasSel : ''} ${touch ? styles.medTouch : ''}`}
          // Foco dentro de la medición: recuerda la línea (destino del pegado) y
          // entrar a editar una celda quita la selección.
          onFocus={(e) => {
            const t = e.target as HTMLElement;
            const ui = useMedUiStore.getState();
            const lineId = t.closest<HTMLElement>('[data-lineid]')?.dataset.lineid;
            if (lineId) ui.setLastFocused(p.id, lineId);
            if (isTextField(t) && t.closest('[data-medgrid]')) ui.clearSelection();
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              useMedUiStore.getState().setLastFocused(p.id, null);
          }}
          // Click en una fila fuera de la selección la quita (la casilla no).
          onPointerDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest('[data-linecheck], [data-medbar], [role="dialog"]')) return;
            const sel = selectionOf(p.id);
            if (!sel.length) return;
            const lineId = t.closest<HTMLElement>('[data-lineid]')?.dataset.lineid;
            if (lineId && !sel.includes(lineId)) useMedUiStore.getState().clearSelection();
          }}
        >
          {compact ? (
            <>
              <div className={styles.medFormaRow}>{formaSelect}</div>
              <MedCards p={p} chapterId={chapterId} cols={cols} emptyText={emptyText} />
            </>
          ) : (
            <div
              ref={medTab.ref}
              data-editgrid=""
              data-medgrid={p.id}
              className={styles.medWrap}
              onKeyDown={(e) => {
                gridNav(e);
                medTab.onKeyDown(e);
              }}
              {...lineKeys}
            >
              <table className={styles.medTable}>
                <thead>
                  <tr>
                    <th className={`${styles.medTh} ${styles.medThSel}`} aria-label="Selección" />
                    <th className={`${styles.medTh} ${styles.medThComment}`}>Comentario</th>
                    {cols.map((c) => (
                      <th
                        key={c.slot}
                        className={`${styles.medTh} ${c.slot === 'uds' ? styles.medThUds : styles.medThDim} ${c.fuera ? styles.medThFuera : ''}`}
                        title={c.fuera ? FUERA_TITLE : undefined}
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className={`${styles.medTh} ${styles.medThParcial}`}>Parcial</th>
                    <th className={styles.medTh} />
                  </tr>
                </thead>
                <tbody>
                  {med.map((l, i) => (
                    <MedLineRow
                      key={l.id}
                      line={l}
                      index={i}
                      cols={cols}
                      chapterId={chapterId}
                      partidaId={p.id}
                      nextId={med[i + 1]?.id ?? null}
                      touch={touch}
                    />
                  ))}
                  {med.length === 0 && (
                    <tr>
                      <td colSpan={cols.length + 4} className={styles.medEmpty}>
                        {emptyText}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className={`${styles.medFoot} ${compact ? styles.medFootCompact : ''}`}>
            <div className={styles.medFootBtns}>
              <button
                ref={addRef}
                type="button"
                title={touch ? undefined : 'Añadir línea (Ctrl+Enter, o Tab/Enter al final de la última)'}
                className={`tcol add-partida ${styles.medAddBtn}`}
                onClick={() => addMedLine(chapterId, p.id)}
              >
                <Icon name="plus" size={14} /> Añadir línea{compact ? '' : ' de medición'}
              </button>
              <PasteButton p={p} touch={touch} />
            </div>
            <Cantidad p={p} />
          </div>
          {/* Detrás del pie (que sigue pegado a la tabla) y pegajosa al fondo
              de la vista mientras la medición no quepa entera. */}
          <MedSelectionBar p={p} compact={compact} />
          {/* Reordenar no muestra aviso: se anuncia aquí. El espacio alterno
              hace que un texto repetido se vuelva a leer. */}
          <div className={styles.srOnly} aria-live="polite">
            {announce.text}
            {announce.n % 2 ? ' ' : ''}
          </div>
        </div>
      )}

      {tab === 'descripcion' && (
        <div className={styles.descBox}>
          <EditableText
            value={p.desc}
            ariaLabel="Descripción de la partida"
            placeholder="Escribe la descripción detallada de la partida (sistema constructivo, materiales, normativa, criterios de medición y abono…)"
            style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', display: 'block', maxWidth: 820 }}
            onCommit={(v) => editPartidaField(chapterId, p.id, 'desc', v)}
          />
        </div>
      )}

      {tab === 'justif' &&
        (compact ? (
          <PriceJustifCards p={p} chapterId={chapterId} />
        ) : (
          <PriceJustif p={p} chapterId={chapterId} />
        ))}

      <MedPasteReview compact={compact} />
    </div>
  );
}
