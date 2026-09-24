import { useEffect, useRef, useState } from 'react';
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
  /** Acción contextual «Importar partidas» (.bc3). Solo en la vista presupuesto. */
  importAction?: React.ReactNode;
}

/** Ancho desde el que las acciones secundarias del escritorio llevan texto. */
export const ROOMY_W = 1400;

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
  const { isMobile, isCompact, isTablet } = bp;
  // Menú «Más» (móvil y tablet): las acciones secundarias no caben (con puntero
  // táctil cada .icon-btn crece a 44px). En móvil la fila desbordaba pisando la
  // marca; en tablet (junto a las pestañas) dejaba el selector de obra en 0px.
  const useMenu = isCompact;
  // Escritorio por debajo de 1400: Referencia e Importar partidas van como icono;
  // con texto, el selector de obra se quedaba sin nombre (medido: 0px a 1024 y a
  // 1181, cuando aparece el wordmark; el nombre entero cabe desde ~1400).
  const roomy = bp.w >= ROOMY_W;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMoreOpen(false);
      moreBtnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  // Cualquier elección dentro del menú lo cierra (burbujea tras el onClick del ítem).
  const closeMore = () => setMoreOpen(false);

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
            · móvil (<760): SÍ — las pestañas van a la barra inferior; pero en
              teléfono (<480, `hide-xs`) cede el sitio al selector de obra: saber
              en qué obra estás pesa más que el nombre de la app (el logo ya la firma);
            · tablet (760–1023): NO — las pestañas viven aquí, solo cabe el logo;
            · escritorio 1024–1180: NO — selector de obra + pestañas + acciones van
              justos y el wordmark pisaría las pestañas;
            · escritorio holgado (>1180): SÍ, junto al kicker «Mediciones» (mismo umbral). */}
        {(isMobile || bp.w > 1180) && (
          <span className={`${isMobile ? 'hide-xs ' : ''}${styles.name}`}>Concreta</span>
        )}
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
                // Tablet: etiqueta corta (la de la barra inferior) para dejar sitio
                // al nombre de la obra; el nombre accesible sigue siendo el completo.
                aria-label={isTablet && t.short !== t.label ? t.label : undefined}
                className={`tcol ${styles.tab} ${active ? styles.active : ''}`}
              >
                {isTablet ? t.short : t.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Acciones */}
      <div className={styles.actions}>
        {/* Deshacer/Rehacer: en móvil no caben en la barra; van al menú «Más».
            Los atajos Ctrl+Z/Ctrl+Y viven en useAppHotkeys. */}
        {!isMobile && <UndoRedoButtons />}
        {!useMenu && importAction}
        {!useMenu && onObra && (
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
        {!useMenu && (
          <button
            type="button"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            onClick={onToggleTheme}
            className="tcol icon-btn"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>
        )}
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
        {useMenu && (
          <div ref={moreRef} className={styles.more}>
            <button
              ref={moreBtnRef}
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              title="Más acciones"
              aria-label="Más acciones"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className="tcol icon-btn"
              style={{
                background: moreOpen ? 'var(--bg-elevated)' : undefined,
                color: moreOpen ? 'var(--text-primary)' : undefined,
              }}
            >
              <Icon name="dots" size={17} />
            </button>
            {/* Montado siempre (oculto con `hidden`): el input de fichero de
                «Importar partidas» vive dentro y su onChange llega DESPUÉS de cerrar
                el menú. El role solo mientras está abierto: las guardas de atajos
                (hotkeyGuards) tratan cualquier [role="menu"] como UI abierta. */}
            <div
              role={moreOpen ? 'menu' : undefined}
              aria-label="Más acciones"
              hidden={!moreOpen}
              onClick={closeMore}
              className={styles.menu}
            >
              {/* Deshacer/Rehacer (solo móvil; en tablet siguen en la barra): en el
                  teléfono no hay Ctrl+Z. No cierran el menú (stopPropagation) para
                  poder deshacer varios pasos seguidos. */}
              {isMobile && (
                <>
                  <div className={styles.menuUndo} onClick={(e) => e.stopPropagation()}>
                    <UndoRedoButtons />
                  </div>
                  <div className={styles.menuDivider} />
                </>
              )}
              {onToggleRef && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={refOpen}
                  onClick={onToggleRef}
                  className={`tcol ${styles.menuItem} ${refOpen ? styles.menuItemOn : ''}`}
                >
                  <Icon name="split" size={16} />
                  Referencia · copiar partidas
                </button>
              )}
              {importAction && <div className={styles.menuSlot}>{importAction}</div>}
              {onObra && (
                <button type="button" role="menuitem" onClick={onObra} className={`tcol ${styles.menuItem}`}>
                  <Icon name="building" size={16} />
                  Datos de la obra
                </button>
              )}
              <div className={styles.menuDivider} />
              <button
                type="button"
                role="menuitem"
                onClick={onToggleTheme}
                className={`tcol ${styles.menuItem}`}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </button>
              {/* En móvil no hay StatusBar: este es el punto de entrada a la ayuda
                  (en tablet la Ayuda sigue en la barra de estado). */}
              {onHelp && isMobile && (
                <button type="button" role="menuitem" onClick={onHelp} className={`tcol ${styles.menuItem}`}>
                  <Icon name="help" size={16} />
                  Ayuda
                </button>
              )}
            </div>
          </div>
        )}
        {!useMenu &&
          onToggleRef &&
          (roomy ? (
            <button
              type="button"
              onClick={onToggleRef}
              title="Abrir base de precios u otro presupuesto"
              className={`tcol ${styles.refBtn} ${refOpen ? styles.on : ''}`}
            >
              <Icon name="split" size={15} /> Referencia
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleRef}
              title="Referencia: abrir base de precios u otro presupuesto"
              aria-label="Referencia"
              aria-pressed={refOpen}
              className="tcol icon-btn"
              style={{
                background: refOpen ? 'var(--accent-soft)' : undefined,
                color: refOpen ? 'var(--accent)' : undefined,
              }}
            >
              <Icon name="split" size={16} />
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
