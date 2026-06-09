import { Bar, Icon, IvaSelect } from '../components';
import { fmtCents, fmtNum, toEur, type Cents } from '../core/money';
import type { Chapter, SubChapter } from '../core/types';
import {
  ALL,
  selectChapterTotals,
  selectPec,
  selectPem,
  selectTotalConIva,
  useObraStore,
} from '../store';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  /** Estilo drawer (móvil/tablet). */
  drawer?: boolean;
  /** Se invoca tras seleccionar (cierra el drawer en móvil). */
  onAfterSelect?: () => void;
}

/** Importe en céntimos → "12,3k" (millares de euro, 1 decimal). */
function k(cents: Cents): string {
  return `${fmtNum(toEur(cents) / 1000, 1)}k`;
}

/* ---------- Tarjeta Resumen (composición del presupuesto) ----------------- */
function ResumenCard() {
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);
  const total = useObraStore(selectTotalConIva);
  const gg = useObraStore((s) => s.rates.gg);
  const bi = useObraStore((s) => s.rates.bi);
  const iva = useObraStore((s) => s.rates.iva);
  const setRates = useObraStore((s) => s.setRates);

  const ggbi: Cents = pec - pem;
  const ivaCents: Cents = total - pec;
  const pemColor = 'var(--accent)';
  const ggbiColor = 'color-mix(in srgb, var(--accent) 45%, var(--bg-elevated))';
  const ivaColor = 'var(--text-disabled)';
  const segs: [Cents, string][] = [
    [pem, pemColor],
    [ggbi, ggbiColor],
    [ivaCents, ivaColor],
  ];

  return (
    <div className={styles.resumen}>
      <div className={`sec-head ${styles.resHead}`}>Resumen</div>
      <div className={styles.compBar}>
        {segs.map(([value, color], i) => (
          <div
            key={i}
            className={styles.compSeg}
            style={{ width: `${total ? (value / total) * 100 : 0}%`, background: color }}
          />
        ))}
      </div>
      <div className={styles.resRows}>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: pemColor }} />
            PEM
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(pem)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: ggbiColor }} />
            GG + BI ({Math.round((gg + bi) * 100)}%)
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(ggbi)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>PEC s/ IVA</span>
          <span className={`mono ${styles.resVal} ${styles.strong}`}>{fmtCents(pec)}</span>
        </div>
        <div className={styles.resRow}>
          <span className={styles.resLabel}>
            <span className={styles.resDot} style={{ background: ivaColor }} />
            <IvaSelect rate={iva} onChange={(r) => setRates({ iva: r })} />
          </span>
          <span className={`mono ${styles.resVal}`}>{fmtCents(ivaCents)}</span>
        </div>
      </div>
      <div className={styles.resTotal}>
        <span className={styles.resTotalLabel}>Total</span>
        <span className={`mono ${styles.resTotalVal}`}>{fmtCents(total)}</span>
      </div>
    </div>
  );
}

/* ---------- Fila de subcapítulo ------------------------------------------- */
function SubRow({
  sub,
  active,
  onSelect,
}: {
  sub: SubChapter;
  active: string;
  onSelect: (id: string) => void;
}) {
  const on = active === sub.id;
  return (
    <button type="button" className={`tcol ${styles.subRow} ${on ? styles.on : ''}`} onClick={() => onSelect(sub.id)}>
      <span className={`mono ${styles.subCode}`}>{sub.code}</span>
      <span className={styles.subTitle}>{sub.title}</span>
    </button>
  );
}

/* ---------- Tarjeta de capítulo de primer nivel --------------------------- */
function ChapterCard({
  ch,
  active,
  expanded,
  importe,
  pct,
  onSelect,
  onToggle,
}: {
  ch: Chapter;
  active: string;
  expanded: boolean;
  importe: Cents;
  pct: number;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const isActive = active === ch.id || !!ch.children?.some((c) => c.id === active);
  const hasChildren = !!ch.children?.length;
  return (
    <button
      type="button"
      className={`tcol ${styles.chap} ${isActive ? styles.on : ''}`}
      onClick={() => onSelect(ch.id)}
    >
      <div className={styles.chapTop}>
        {hasChildren ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={expanded ? 'Colapsar' : 'Desplegar'}
            className={`tcol ${styles.chev}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(ch.id);
            }}
          >
            <Icon name={expanded ? 'chevronDown' : 'chevron'} size={13} />
          </span>
        ) : (
          <span className={styles.chevSpacer} />
        )}
        <span className={`mono ${styles.chapCode}`}>{ch.code}</span>
        <span className={styles.chapTitle}>{ch.title}</span>
        {importe > 0 && <span className={`mono ${styles.chapK}`}>{k(importe)}</span>}
      </div>
      {importe > 0 && (
        <div className={styles.chapBarRow}>
          <span className={styles.chapBar}>
            <Bar pct={pct} active={isActive} height={3} />
          </span>
          <span className={`mono ${styles.chapPct}`}>{fmtNum(pct, 1)}%</span>
        </div>
      )}
    </button>
  );
}

/**
 * Sidebar de capítulos (F2.1): "Toda la obra", árbol de capítulos/subcapítulos
 * con importe `{k}` y barra de % PEM, y la tarjeta Resumen al pie. Suscrito al
 * store (navegación con `setActive`, despliegue con `toggleExpanded`). El alta y
 * borrado de capítulos llega en F2.4.
 */
export function Sidebar({ drawer = false, onAfterSelect }: SidebarProps) {
  const active = useObraStore((s) => s.active);
  const expanded = useObraStore((s) => s.expanded);
  const chapters = useObraStore((s) => s.chapters);
  const chapterTotals = useObraStore(selectChapterTotals);
  const pem = useObraStore(selectPem);
  const setActive = useObraStore((s) => s.setActive);
  const setView = useObraStore((s) => s.setView);
  const toggleExpanded = useObraStore((s) => s.toggleExpanded);

  const select = (id: string) => {
    setActive(id);
    setView('presupuesto');
    onAfterSelect?.();
  };

  return (
    <aside
      className={`${styles.sidebar} ${drawer ? styles.drawer : ''}`}
      aria-label="Capítulos de la obra"
    >
      <div className={styles.allWrap}>
        <button
          type="button"
          className={`tcol ${styles.allRow} ${active === ALL ? styles.on : ''}`}
          onClick={() => select(ALL)}
        >
          <span className={styles.allIcon}>
            <Icon name="grid" size={14} />
          </span>
          <span className={styles.allLabel}>Toda la obra</span>
          <span className={`mono ${styles.allK}`}>{k(pem)}</span>
        </button>
      </div>

      <div className={styles.head}>
        <span className="sec-head">Capítulos</span>
      </div>

      <nav className={`scroll-thin ${styles.nav}`}>
        {chapters.map((ch) => (
          <div key={ch.id}>
            <ChapterCard
              ch={ch}
              active={active}
              expanded={!!expanded[ch.id]}
              importe={chapterTotals[ch.id] ?? 0}
              pct={pem ? ((chapterTotals[ch.id] ?? 0) / pem) * 100 : 0}
              onSelect={select}
              onToggle={toggleExpanded}
            />
            {ch.children && expanded[ch.id] && (
              <div className={styles.subList}>
                {ch.children.map((sub) => (
                  <SubRow key={sub.id} sub={sub} active={active} onSelect={select} />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <ResumenCard />
      </div>
    </aside>
  );
}
