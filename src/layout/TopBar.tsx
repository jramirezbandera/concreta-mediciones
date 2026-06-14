import { Icon } from '../components/Icon';
import type { Breakpoint } from '../hooks/useBreakpoint';
import type { Theme } from '../hooks/useTheme';
import { TABS, VIEW_LABEL, type View } from './types';
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
  onExport?: () => void;
  onObra?: () => void;
  /** Abre el Centro de Ayuda. Punto de entrada universal (también en móvil). */
  onHelp?: () => void;
  /** Selector de obra (multi-obra, PR2). Si se pasa, sustituye al nombre de obra inline. */
  obraSwitcher?: React.ReactNode;
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
  onExport,
  onObra,
  onHelp,
  obraSwitcher,
}: TopBarProps) {
  const { isMobile, isTablet, isCompact } = bp;

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
        {/* En tablet las pestañas viven en el TopBar y no cabe el wordmark:
            solo logo (en móvil las pestañas van abajo y el nombre sí cabe). */}
        {!isTablet && <span className={styles.name}>Concreta</span>}
        <span className={`hide-sm ${styles.sep}`} />
        <span className={`mono caps hide-md ${styles.kicker}`}>Mediciones</span>
        <span className={`hide-sm ${styles.slash}`}>/</span>
        <span className={`hide-sm ${styles.crumb}`}>{VIEW_LABEL[view]}</span>
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
        {onHelp && (
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
        {onToggleRef &&
          (isMobile ? (
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
            {!isMobile && <span className={styles.sep} />}
            <button
              type="button"
              onClick={onExport}
              title="Exportar listados"
              className={`t150 ${styles.export} ${isMobile ? styles.compact : ''}`}
            >
              <Icon name="download" size={isMobile ? 16 : 14} />
              {!isMobile && 'Exportar'}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
