import { Fragment, useEffect, useState } from 'react';
import { Icon, Modal } from '../components';
import { selectCounts, useObraStore } from '../store';
import {
  FEATURES,
  STEPS,
  shortcutGroups,
  type GoView,
  type HelpTab,
  type OnboardingStep,
} from './ayudaContent';
import styles from './AyudaCenter.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = isMac ? '⌘' : 'Ctrl';

const TABS: { k: HelpTab; label: string }[] = [
  { k: 'inicio', label: 'Primeros pasos' },
  { k: 'funcionalidades', label: 'Funcionalidades' },
  { k: 'atajos', label: 'Atajos' },
];

/** Estado real de la obra → qué pasos del onboarding están hechos. */
function useStepProgress(): Record<NonNullable<OnboardingStep['done']>, boolean> {
  const counts = useObraStore(selectCounts);
  const chapters = useObraStore((s) => s.chapters);
  const coefK = useObraStore((s) => s.rates.coefK);
  const certs = useObraStore((s) => s.certs);
  return {
    obra: chapters.length > 0,
    partidas: counts.partidas > 0,
    medicion: counts.lineas > 0,
    coefK: coefK !== 1,
    cert: certs.some((c) => Object.keys(c.data ?? {}).length > 0),
  };
}

/* ---------- secciones ----------------------------------------------------- */
function Inicio({ onGo }: { onGo: (v: GoView) => void }) {
  const done = useStepProgress();
  return (
    <div className={styles.section}>
      <p className={styles.intro}>
        <strong>Concreta · Mediciones</strong> es tu herramienta de presupuestos, mediciones y
        certificaciones de obra. Este es el camino de principio a fin:
      </p>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => {
          const ok = s.done ? done[s.done] : false;
          return (
            <li key={i} className={styles.step}>
              <span className={`${styles.stepNum} ${ok ? styles.stepDone : ''}`}>
                {ok ? <Icon name="check" size={13} /> : i + 1}
              </span>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>{s.title}</div>
                <div className={styles.stepDesc}>{s.desc}</div>
              </div>
              {s.go && s.goLabel && (
                <button type="button" className={styles.stepGo} onClick={() => onGo(s.go!)}>
                  {s.goLabel}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Funcionalidades() {
  return (
    <div className={`${styles.section} ${styles.featGrid}`}>
      {FEATURES.map((f) => (
        <div key={f.title} className={styles.feat}>
          <span className={styles.featIcon}>
            <Icon name={f.icon} size={16} />
          </span>
          <div>
            <div className={styles.featTitle}>{f.title}</div>
            <div className={styles.featDesc}>{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Atajos() {
  return (
    <div className={`${styles.section} ${styles.groups}`}>
      {shortcutGroups(MOD).map((g) => (
        <div key={g.title} className={styles.group}>
          <div className={`sec-head ${styles.groupTitle}`}>{g.title}</div>
          {g.rows.map((r) => (
            <div key={r.label} className={styles.row}>
              <span className={styles.keys}>
                {r.keys.map((k, i) => (
                  <kbd key={i} className={styles.kbd}>
                    {k}
                  </kbd>
                ))}
              </span>
              <span className={styles.rowLabel}>{r.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const PANELS: Record<HelpTab, (p: { onGo: (v: GoView) => void }) => React.ReactNode> = {
  inicio: ({ onGo }) => <Inicio onGo={onGo} />,
  funcionalidades: () => <Funcionalidades />,
  atajos: () => <Atajos />,
};

/**
 * Centro de Ayuda / Onboarding. Modal con 3 secciones: Primeros pasos (checklist
 * con el estado real de la obra), Funcionalidades y Atajos. En escritorio navega
 * por pestañas (segmented); en compacto (bottom-sheet) apila las 3 secciones
 * (las pestañas con scroll horizontal son poco descubribles en móvil).
 * `initialTab` lo fija quien abre: el botón → 'inicio'; la tecla `?` → 'atajos'.
 */
export function AyudaCenter({
  open,
  onClose,
  initialTab = 'inicio',
  onNavigate,
  compact = false,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: HelpTab;
  onNavigate: (v: GoView) => void;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<HelpTab>(initialTab);
  // Al reabrir, vuelve a la pestaña que pide quien abre (sin persistir estado).
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const onGo = (v: GoView) => onNavigate(v);

  return (
    <Modal open={open} onClose={onClose} title="Ayuda" icon="help" compact={compact}>
      {compact ? (
        // Móvil: secciones apiladas con cabecera (sin pestañas horizontales).
        <div className={styles.stacked}>
          {TABS.map((t) => (
            <Fragment key={t.k}>
              <div className={`sec-head ${styles.stackHead}`}>{t.label}</div>
              {PANELS[t.k]({ onGo })}
            </Fragment>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.seg} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.k}
                type="button"
                role="tab"
                aria-selected={tab === t.k}
                className={`tcol ${styles.segBtn} ${tab === t.k ? styles.on : ''}`}
                onClick={() => setTab(t.k)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {PANELS[tab]({ onGo })}
        </>
      )}
    </Modal>
  );
}
