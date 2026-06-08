import { useState, type ReactNode } from 'react';
import {
  Badge,
  Bar,
  ContraChip,
  EditableNum,
  EditableText,
  GhostBtn,
  Icon,
  ICONS,
  type IconName,
  InlineCreate,
  IvaSelect,
} from '../../components';
import { useTheme } from '../../hooks/useTheme';
import { useTweaks } from '../../hooks/useTweaks';
import styles from './Sandbox.module.css';

const ACCENTS = ['#38bdf8', '#0284c7', '#0d9488', '#7c3aed', '#ea580c'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className="sec-head" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </span>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.cell}>
      <span className={styles.cellLabel}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Página sandbox: galería viva de las primitivas de F0 con estado interactivo
 * y controles de tema/acento (demuestra useTheme/useTweaks). Accesible en
 * `#sandbox`. Satisface el criterio de aceptación de F0.
 */
export function Sandbox({ onBack }: { onBack: () => void }) {
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  // Demuestra useTweaks: preferencia de UI persistida (local-first).
  const [prefs, setTweak] = useTweaks('concreta.sandbox', { dotGrid: false });

  const [num1, setNum1] = useState(14.2);
  const [num2, setNum2] = useState(28420.18);
  const [text, setText] = useState('Excavación en zanjas a máquina');
  const [emptyText, setEmptyText] = useState('');
  const [iva, setIva] = useState(0.1);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string[]>([]);

  const curAccent = accent ?? ACCENTS[0];
  const iconNames = Object.keys(ICONS) as IconName[];

  return (
    <div className={`${prefs.dotGrid ? 'dot-grid' : ''} ${styles.page}`}>
      <div className={`no-print ${styles.bar}`}>
        <button type="button" className={styles.back} onClick={onBack}>
          <Icon name="arrowLeft" size={15} /> Volver a la app
        </button>
        <span className={styles.barTitle}>Sandbox · primitivas</span>
        <div className={styles.barTools}>
          <div className={styles.swatches}>
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Acento ${c}`}
                className={`${styles.swatch} ${c === curAccent ? styles.on : ''}`}
                style={{ background: c }}
                onClick={() => setAccent(c)}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.themeBtn}
            aria-pressed={prefs.dotGrid}
            onClick={() => setTweak('dotGrid', !prefs.dotGrid)}
          >
            <Icon name="grid" size={14} />
            dot-grid
          </button>
          <button type="button" className={styles.themeBtn} onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            {theme === 'dark' ? 'Claro' : 'Oscuro'}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <Section title="Badges de recurso">
          <Badge type="MO" />
          <Badge type="MQ" />
          <Badge type="MAT" />
          <Badge type="%CI" />
          <ContraChip />
          <ContraChip small />
        </Section>

        <Section title="Barras de proporción">
          <div className={styles.barCol}>
            <Cell label="Activa · 72%">
              <Bar pct={72} active />
            </Cell>
          </div>
          <div className={styles.barCol}>
            <Cell label="Inactiva · 38%">
              <Bar pct={38} />
            </Cell>
          </div>
          <div className={styles.barCol}>
            <Cell label="Activa · 12%">
              <Bar pct={12} active />
            </Cell>
          </div>
        </Section>

        <Section title="Edición inline numérica">
          <Cell label="Cantidad">
            <div className={`mono ${styles.numCell}`}>
              <EditableNum value={num1} onCommit={setNum1} ariaLabel="Cantidad" />
            </div>
          </Cell>
          <Cell label="Importe (bold, accent)">
            <div className={`mono ${styles.numCell}`}>
              <EditableNum value={num2} onCommit={setNum2} bold accent ariaLabel="Importe" />
            </div>
          </Cell>
        </Section>

        <Section title="Edición inline de texto">
          <Cell label="Descripción">
            <div style={{ minWidth: 280, fontSize: 13, color: 'var(--text-primary)' }}>
              <EditableText value={text} onCommit={setText} ariaLabel="Descripción" />
            </div>
          </Cell>
          <Cell label="Vacío (placeholder)">
            <div style={{ minWidth: 180, fontSize: 13 }}>
              <EditableText
                value={emptyText}
                onCommit={setEmptyText}
                placeholder="Sin descripción"
                ariaLabel="Descripción vacía"
              />
            </div>
          </Cell>
        </Section>

        <Section title="Selector de IVA">
          <IvaSelect rate={iva} onChange={setIva} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-disabled)' }}>
            rate = {iva}
          </span>
        </Section>

        <Section title="Creación inline">
          {creating ? (
            <div style={{ minWidth: 280 }}>
              <InlineCreate
                placeholder="Nombre del capítulo…"
                onCommit={(v) => {
                  setCreated((prev) => [...prev, v]);
                  setCreating(false);
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : (
            <GhostBtn icon="plus" onClick={() => setCreating(true)}>
              Añadir capítulo
            </GhostBtn>
          )}
          {created.length > 0 && (
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Creados: {created.join(', ')}
            </span>
          )}
        </Section>

        <Section title="Botones fantasma">
          <GhostBtn icon="download">Exportar</GhostBtn>
          <GhostBtn icon="split" active>
            Referencia
          </GhostBtn>
          <GhostBtn icon="building">Datos de obra</GhostBtn>
        </Section>

        <Section title={`Iconos (${iconNames.length})`}>
          <div className={styles.iconGrid}>
            {iconNames.map((n) => (
              <div key={n} className={styles.iconCard}>
                <Icon name={n} size={20} />
                <span className={styles.iconName}>{n}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
