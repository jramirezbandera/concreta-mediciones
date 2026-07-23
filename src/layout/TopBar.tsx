import { Icon } from '../components/Icon';
import type { Breakpoint } from '../hooks/useBreakpoint';
import type { Theme } from '../hooks/useTheme';
import { TABS, type View } from './types';
import { UndoRedoButtons } from './UndoRedoButtons';
import styles from './TopBar.module.css';

export interface TopBarProps {
  view: View;
  onView: (v: View) => void;
  theme: Theme;
  onToggleTheme: () => void;
  bp: Breakpoint;
  onMenu: () => void;
  obraName: string;
  refOpen?: boolean;
  onToggleRef?: () => void;
  asistenteOpen?: boolean;
  onToggleAsistente?: () => void;
  onExport?: () => void;
  onObra?: () => void;
  /** Abre el Centro de Ayuda. Punto de entrada universal (también en móvil). */
  onHelp?: () => void;
  /** Selector de obra (multi-obra, PR2). Si se pasa, sustituye al nombre de obra inline. */
  obraSwitcher?: React.ReactNode;
  /** Acción contextual «Importar partida» (.bc3). Solo en la vista presupuesto. */
  importAction?: React.ReactNode;
}

/** Barra superior: lockup de marca Concreta, breadcrumb, tabs y acciones. */
export function TopBar({
  view,
  onView,
  theme,
  onToggleTheme,
  bp,
  onMenu,
  obraName,
  refOpen = false,
  onToggleRef,
  asistenteOpen = false,
  onToggleAsistente,
  onExport,
  onObra,
  onHelp,
  obraSwitcher,
  importAction,
}: TopBarProps) {
  const { isMobile, isCompact } = bp;

  return (
    <header className={styles.bar} style={{ padding: isMobile ? '0 10px' : '0 14px' }}>
      {/* Marca */}
      <div className={styles.brand} style={{ flex: isMobile ? 1 : '0 1 auto' }}>
        {isCompact && (
          <button
            type="button"
            onClick={onMenu}
            title="Capítulos"
            aria-label="Abrir capítulos"
            className="tcol icon-btn"
            style={{ marginLeft: -4, flexShrink: 0 }}
          >
            <Icon name="menu" size={18} />
          </button>
        )}
        {/* BASE_URL: en GitHub Pages la app vive bajo /concreta-mediciones/ y la
            ruta absoluta /favicon.svg daba 404 (logo roto en producción). */}
        <img
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          width={21}
          height={21}
          className={styles.logo}
          alt=""
        />
        {/* Cuándo mostrar el wordmark (no es monótono con el ancho):
            · móvil (<760): SÍ — las pestañas van a la barra inferior y sobra sitio;
            · tablet (760–1023): NO — las pestañas viven aquí, solo cabe el logo;
            · escritorio 1024–1180: NO — selector de obra + pestañas + acciones van
              justos y el wordmark pisaría las pestañas;
            · escritorio holgado (>1180): SÍ, junto al kicker «Mediciones» (mismo umbral). */}
        {(isMobile || bp.w > 1180) && <span className={styles.name}>Concreta</span>}
        <span className={`hide-sm ${styles.sep}`} />
        <span className={`mono caps hide-md ${styles.kicker}`}>Mediciones</span>
        {obraSwitcher ? (
          <>
            <span className={`hide-sm ${styles.dotSep}`}>·</span>
            {obraSwitcher}
          </>
        ) : (
          onObra && (
            <>
              <span className={`hide-lg ${styles.dotSep}`}>·</span>
              <button
                type="button"
                onClick={onObra}
                title="Datos de la obra"
                className={`tcol hide-lg ${styles.obra}`}
              >
                {obraName}
                <Icon name="pencil" size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              </button>
            </>
          )
        )}
      </div>

      {/* Tabs centrales (ocultas en móvil → barra inferior) */}
      {!isMobile && (
        <nav className={styles.tabs} aria-label="Vistas">
          {TABS.map((t) => {
            const active = view === t.k;
            return (
              <button
                key={t.k}
                type="button"
                onClick={() => onView(t.k)}
                aria-current={active ? 'page' : undefined}
                className={`tcol ${styles.tab} ${active ? styles.active : ''}`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Acciones */}
      <div className={styles.actions}>
        {/* Deshacer/Rehacer: en móvil no caben (la barra ya va justa a 390px);
            pendiente de un pase de UX móvil (¿Drawer?). Los atajos Ctrl+Z/Ctrl+Y
            viven en useAppHotkeys. */}
        {!isMobile && <UndoRedoButtons />}
        {importAction}
        {/* La ayuda vive en la barra de estado inferior (desktop). En móvil no hay
            StatusBar, así que se mantiene aquí como único punto de entrada. */}
        {onHelp && isMobile && (
          <button
            type="button"
            title="Ayuda y atajos"
            aria-label="Ayuda"
            onClick={onHelp}
            className="tcol icon-btn"
          >
            <Icon name="help" size={16} />
          </button>
        )}
        {onObra && (
          <button
            type="button"
            title="Datos de la obra"
            aria-label="Datos de la obra"
            onClick={onObra}
            className="tcol icon-btn"
          >
            <Icon name="building" size={16} />
          </button>
        )}
        <button
          type="button"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          onClick={onToggleTheme}
          className="tcol icon-btn"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
        </button>
        {onToggleAsistente && (
          <button
            type="button"
            onClick={onToggleAsistente}
            title="Asistente de IA (Ctrl/⌘+J)"
            aria-label="Asistente de IA"
            aria-pressed={asistenteOpen}
            className="tcol icon-btn"
            style={{
              background: asistenteOpen ? 'var(--accent-soft)' : undefined,
              color: asistenteOpen ? 'var(--accent)' : undefined,
            }}
          >
            <Icon name="assistant" size={16} />
          </button>
        )}
        {onToggleRef &&
          (isCompact ? (
            <button
              type="button"
              onClick={onToggleRef}
              title="Modo referencia"
              aria-label="Modo referencia"
              className="tcol icon-btn"
              style={{
                background: refOpen ? 'var(--accent-soft)' : undefined,
                color: refOpen ? 'var(--accent)' : undefined,
              }}
            >
              <Icon name="split" size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleRef}
              title="Abrir base de precios u otro presupuesto"
              className={`tcol ${styles.refBtn} ${refOpen ? styles.on : ''}`}
            >
              <Icon name="split" size={15} /> Referencia
            </button>
          ))}
        {onExport && (
          <>
            {!isCompact && <span className={styles.sep} />}
            <button
              type="button"
              onClick={onExport}
              title="Exportar listados"
              className={`t150 ${styles.export} ${isCompact ? styles.compact : ''}`}
            >
              <Icon name="download" size={isCompact ? 16 : 14} />
              {!isCompact && 'Exportar'}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
