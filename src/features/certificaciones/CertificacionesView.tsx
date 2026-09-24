import { useRef, useState } from 'react';
import { CompactHeaderBar, EditableText, EmptyAction, EmptyState, Icon } from '../../components';
import {
  certCalc,
  certDeletedRows,
  certSnapshotOf,
  extraCalc,
  extrasCantidad,
} from '../../core/certificacion';
import { fmtCents, fmtNum, sumCents, toEur, type Cents } from '../../core/money';
import { partidaImporte } from '../../core/medicion';
import { findNode, subtreeIds } from '../../core/tree';
import type { SubChapter } from '../../core/types';
import { useElementWidth } from '../../hooks/useElementWidth';
import { useGridNav } from '../../hooks/useGridNav';
import { useMedGridTab } from '../../hooks/useMedGridTab';
import {
  ALL,
  selectCertChapterRows,
  selectCertTotals,
  selectRetenidoAcumulado,
  useObraStore,
  type CertMode,
} from '../../store';
import { CertChapterCards } from './CertChapterCards';
import { CertChapterTable, CertDeletedTable, CertHead } from './CertTable';
import { CertChapterSummary, CertSummary } from './CertSummary';
import { CertSelector } from './CertSelector';
import { MassComplete } from './MassComplete';
import { completeScope } from './completeScope';
import { certPctState } from './certPctState';
import styles from './Certificaciones.module.css';

/** Por debajo de este ancho ÚTIL la tabla conmuta a tarjetas (igual que F2.5). */
const COMPACT_WIDTH = 780;

const MODES: [CertMode, string][] = [
  ['origen', 'A origen'],
  ['esta', 'Esta certificación'],
];

/**
 * Vista de Certificaciones (F4.1): selector de cert + periodo/retención editables,
 * "líquido a abonar" grande, toggle A origen / Esta certificación, tabla por
 * capítulo con la cantidad ejecutada editable, y resúmenes (económico + por
 * capítulos). El cálculo es el motor de F1; el % editable + desplegable (F4.2),
 * marcar líneas (F4.3), contradictorios cert-local (F4.4) y tarjetas móvil (F4.5,
 * conmuta por ancho útil <780, igual que F2.5). F4 completa.
 */
export function CertificacionesView({
  compact: mobile,
  onGoPresupuesto,
}: {
  compact: boolean;
  /** Lleva a la vista Presupuesto (CTA del estado vacío de obra, F8.3). */
  onGoPresupuesto?: () => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(viewRef);
  const compact = mobile || (width > 0 && width < COMPACT_WIDTH);
  const [mode, setMode] = useState<CertMode>('origen');
  const certs = useObraStore((s) => s.certs);
  const curCert = useObraStore((s) => s.curCert);
  const active = useObraStore((s) => s.active);
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const bajas = useObraStore((s) => s.bajas);
  const coefK = useObraStore((s) => s.rates.coefK);
  const setCertField = useObraStore((s) => s.setCertField);
  const completePartidas = useObraStore((s) => s.completePartidas);
  const addContradictorio = useObraStore((s) => s.addContradictorio);
  const totals = useObraStore(selectCertTotals);
  const chapterRows = useObraStore(selectCertChapterRows);
  const retenidoAcumulado = useObraStore(selectRetenidoAcumulado);
  // Navegación tipo hoja de cálculo en la tabla: flechas mueven el foco entre
  // celdas en reposo (`useGridNav`) y Tab/Enter encadenan edición (`useMedGridTab`
  // sin «alta al final», a diferencia de la medición). Se componen como en DetailPanel.
  const gridNav = useGridNav();
  const editTab = useMedGridTab();

  const cur = certs[curCert];
  if (!cur) return <div className={styles.view} />;

  // Obra sin partidas: no hay nada que certificar (journey §4 — siguiente paso
  // sutil, sin wizard). El estado vacío manda al presupuesto.
  if (Object.values(partidas).every((ps) => ps.length === 0)) {
    return (
      <div ref={viewRef} className={`${styles.view} ${styles.viewFill}`}>
        <EmptyState
          icon="clipboardCheck"
          title="Nada que certificar todavía"
          text="Cuando el presupuesto tenga partidas medidas, aquí certificarás la obra ejecutada mes a mes y sacarás la relación valorada."
        >
          {onGoPresupuesto && (
            <EmptyAction primary onClick={onGoPresupuesto}>
              Ir al presupuesto
            </EmptyAction>
          )}
        </EmptyState>
      </div>
    );
  }
  const curData = cur.data;
  const prevData = curCert > 0 ? (certs[curCert - 1]?.data ?? {}) : {};
  const extras = cur.extras ?? [];
  const prevExtras = curCert > 0 ? (certs[curCert - 1]?.extras ?? []) : [];
  const prevExtraCant = extrasCantidad(prevExtras);
  // F7.0: precios congelados de la cert (undefined si es legada → en vivo).
  const snap = certSnapshotOf(cur, coefK);

  // Aislamiento por selección del árbol (paridad con Presupuesto): un capítulo
  // activo muestra SOLO su sección; un sub, solo su subárbol. «Toda la obra»
  // (o un id desconocido) = la cert completa. La cabecera (líquido, % global)
  // y los resúmenes siguen siendo de TODA la cert: son del documento, no de la
  // parte que se navega.
  const hit = active === ALL ? undefined : findNode(chapters, active);
  const activeChapter = hit?.chapter;
  const focusSub = hit && hit.depth > 0 ? (hit.node as SubChapter) : null;
  const focusIds = focusSub ? subtreeIds(focusSub) : null;
  const shownChapters = activeChapter ? [activeChapter] : chapters;

  // «Completar {alcance}» WYSIWYG (eng review Issue 5): mismas partidas que se
  // PINTAN abajo (obra / capítulo / lo visible), nunca filas ocultas.
  const visiblePs = shownChapters.flatMap((ch) => {
    const allPs = partidas[ch.id] ?? [];
    return focusIds ? allPs.filter((p) => p.sub != null && focusIds.has(p.sub)) : allPs;
  });
  const scope = completeScope(visiblePs, curData, cur.lineQty);
  const scopeName = active === ALL ? 'obra' : focusSub ? 'lo visible' : 'capítulo';

  return (
    <div ref={viewRef} className={`fadeUp ${styles.view}${compact ? ` ${styles.compact}` : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <CertSelector />
            <span className={styles.period}>
              <Icon name="doc" size={14} style={{ color: 'var(--text-disabled)' }} />
              <EditableText
                value={cur.period}
                ariaLabel="Periodo de la certificación"
                placeholder="Periodo…"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
                onCommit={(v) => setCertField('period', v)}
              />
            </span>
          </div>
          <div>
            <div className={`caps ${styles.liqLabel}`}>Líquido a abonar</div>
            <div className={`mono ${styles.liqVal}`}>{fmtCents(totals.liquido)}</div>
          </div>
        </div>
        <div className={styles.headerBottom}>
          <div className={styles.seg}>
            {MODES.map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={`tcol ${styles.segBtn} ${mode === m ? styles.on : ''}`}
                onClick={() => setMode(m)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.headerBottomRight}>
            <MassComplete
              scopeName={scopeName}
              scope={scope}
              onConfirm={completePartidas}
              compact={compact}
            />
            <span className={styles.globalPct}>
              Ejecución global <span className="mono">{fmtNum(totals.pctGlobal, 1)}%</span>
            </span>
          </div>
        </div>
      </div>
      {/* Compacto: la cabecera (≈200px en móvil) deja de ser fija; al salir por
          arriba queda esta barra con la cert, el modo y el líquido. */}
      {compact && (
        <CompactHeaderBar
          watch={curCert}
          title={`Certificación nº ${cur.num}`}
          sub={mode === 'origen' ? 'A origen' : 'Esta cert.'}
          value={fmtCents(totals.liquido)}
        />
      )}

      {!compact && <CertHead mode={mode} />}

      {/* Grid de edición (Tab/Enter) SOLO en modo tabla: en tarjetas no hay
          navegación de teclado, y montar `data-editgrid` allí engañaría a
          hotkeyGuards (suprimiría atajos globales). `display:contents` → sin caja. */}
      <div
        style={{ display: 'contents' }}
        ref={compact ? undefined : editTab.ref}
        onKeyDown={
          compact
            ? undefined
            : (e) => {
                gridNav(e); // flechas: mueve foco entre celdas en reposo
                editTab.onKeyDown(e); // Tab/Enter: encadena edición
              }
        }
        {...(compact ? {} : { 'data-editgrid': '' })}
      >
        {shownChapters.map((ch) => {
        const allPs = partidas[ch.id] ?? [];
        // Sub aislado: solo las partidas de su subárbol; los contradictorios son
        // del CAPÍTULO (no viven en ningún sub) → fuera de la vista aislada.
        const ps = focusIds ? allPs.filter((p) => p.sub != null && focusIds.has(p.sub)) : allPs;
        const chExtras = focusSub ? [] : extras.filter((e) => e.chapterId === ch.id);
        // En «toda la obra» los capítulos sin nada certificable se omiten (como
        // siempre); aislado, la sección se pinta igualmente con su estado vacío.
        if (!ps.length && !chExtras.length && !activeChapter) return null;
        const totalByMode: Cents = sumCents([
          ...ps.map((p) => {
            const k = certCalc(p, curData, prevData, coefK, snap);
            return mode === 'origen' ? k.aOrigen : k.estaCert;
          }),
          ...chExtras.map((e) => {
            const k = extraCalc(e, prevExtraCant[e.id] ?? 0);
            return mode === 'origen' ? k.aOrigen : k.estaCert;
          }),
        ]);
        // % del sub aislado: mismo criterio que el core (presupuesto VIVO como
        // base, certificado con snapshot), acotado a su subárbol.
        let pct = chapterRows.find((r) => r.id === ch.id)?.pct ?? 0;
        if (focusSub) {
          const budget = sumCents(ps.map((p) => partidaImporte(p, coefK)));
          const certed = sumCents(
            ps.map((p) => certCalc(p, curData, prevData, coefK, snap).aOrigen),
          );
          pct = budget > 0 ? (certed / budget) * 100 : 0;
        }
        const band = focusSub ?? ch; // la banda habla de lo que se AÍSLA
        const st = certPctState(pct);
        const stCls = st === 'over' ? styles.over : st === 'full' ? styles.full : '';
        return (
          <section key={ch.id}>
            <div className={styles.chapBand}>
              <span className={`mono ${styles.chapCode}`}>{band.code}</span>
              <span className={styles.chapTitle}>{band.title}</span>
              <div className={styles.chapRight}>
                <span
                  className={`mono ${styles.chapPct} ${stCls}`}
                  title={st === 'over' ? 'Sobre-certificado: supera el 100 % del presupuesto' : undefined}
                >
                  {fmtNum(pct, 1)}% ejec.
                </span>
                <span className={`mono ${styles.chapImporte}`}>{fmtNum(toEur(totalByMode))}</span>
              </div>
            </div>
            {ps.length === 0 && chExtras.length === 0 ? (
              // Capítulo (no sub) aislado y vacío: se puede seguir dándole precios
              // contradictorios aunque no tenga partidas. Los P.C. son de CAPÍTULO,
              // así que en un sub aislado vacío solo se muestra el mensaje.
              <div className={styles.chapEmpty}>
                <p className={styles.chapEmptyText}>
                  {focusSub ? 'Este subcapítulo' : 'Este capítulo'} no tiene partidas que
                  certificar.
                </p>
                {activeChapter && !focusSub && (
                  <button
                    type="button"
                    className={`tcol ${styles.cardsAdd}`}
                    onClick={() => addContradictorio(ch.id)}
                  >
                    <Icon name="plus" size={15} /> Añadir precio contradictorio
                  </button>
                )}
              </div>
            ) : compact ? (
              <CertChapterCards
                chapter={ch}
                partidas={allPs}
                curData={curData}
                prevData={prevData}
                mode={mode}
                coefK={coefK}
                snap={snap}
                extras={extras}
                prevExtras={prevExtras}
                focus={focusSub?.id ?? null}
              />
            ) : (
              <div className={styles.tableWrap}>
                <CertChapterTable
                  chapter={ch}
                  partidas={allPs}
                  curData={curData}
                  prevData={prevData}
                  mode={mode}
                  coefK={coefK}
                  snap={snap}
                  extras={extras}
                  prevExtras={prevExtras}
                  focus={focusSub?.id ?? null}
                />
              </div>
            )}
          </section>
        );
        })}
      </div>

      {(() => {
        // «Eliminado del presupuesto» (D-01/D-02): partidas borradas con importe
        // certificado (valen su snapshot; CON NOMBRE si dejaron tombstone v3) +
        // contradictorios de capítulos borrados. Sin esta sección ese dinero
        // sumaría al total sin fila que lo enseñe. Solo en «toda la obra»: el
        // rastro de borrados no pertenece a ningún capítulo vivo.
        if (activeChapter) return null;
        const chapterIdSet = new Set(chapters.map((c) => c.id));
        const aliveIds = new Set(
          chapters.flatMap((ch) => (partidas[ch.id] ?? []).map((p) => p.id)),
        );
        const deletedRows = certDeletedRows(aliveIds, curData, prevData, snap, bajas);
        const deletedExtras = extras.filter((e) => !chapterIdSet.has(e.chapterId));
        if (deletedRows.length === 0 && deletedExtras.length === 0) return null;
        const totalByMode: Cents = sumCents([
          ...deletedRows.map((r) => (mode === 'origen' ? r.aOrigen : r.estaCert)),
          ...deletedExtras.map((e) => {
            const k = extraCalc(e, prevExtraCant[e.id] ?? 0);
            return mode === 'origen' ? k.aOrigen : k.estaCert;
          }),
        ]);
        const table = (
          <CertDeletedTable
            rows={deletedRows}
            extras={deletedExtras}
            prevExtras={prevExtras}
            mode={mode}
          />
        );
        return (
          <section>
            <div className={styles.chapBand}>
              <span className={`mono ${styles.chapCode}`}>—</span>
              <span className={styles.chapTitle}>Eliminado del presupuesto</span>
              <div className={styles.chapRight}>
                <span className={`mono ${styles.chapImporte}`}>{fmtNum(toEur(totalByMode))}</span>
              </div>
            </div>
            {compact ? table : <div className={styles.tableWrap}>{table}</div>}
          </section>
        );
      })()}

      <div className={styles.summaryGrid}>
        <CertChapterSummary rows={chapterRows} />
        <CertSummary totals={totals} retencion={cur.retencion} retenidoAcumulado={retenidoAcumulado} />
      </div>
    </div>
  );
}
