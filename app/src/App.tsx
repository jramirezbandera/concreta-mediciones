import { useCallback, useEffect, useState } from 'react';
import { CertificacionesView } from './features/certificaciones';
import { ExportModal } from './features/exportar';
import { ImportarView } from './features/importar';
import { ObraModal } from './features/obra';
import { PresupuestoView } from './features/presupuesto';
import { PrintDoc, type PrintTarget } from './features/print';
import { ReferenciaPanel, refStyles } from './features/referencia';
import { ResumenView } from './features/resumen';
import { Sandbox } from './features/sandbox/Sandbox';
import { PersistUI, flushPending } from './persist';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useTheme } from './hooks/useTheme';
import { BottomTabBar, Drawer, Sidebar, StatusBar, TopBar, type View } from './layout';
import { selectCounts, selectPec, selectPem, useObraStore } from './store';
import styles from './App.module.css';

/** Por encima de este ancho de ventana el panel Referencia abre en split; si no, overlay. */
const SPLIT_WIDTH = 1100;

/** ¿La ruta actual es el sandbox de primitivas? (`#sandbox`) */
function isSandboxHash(): boolean {
  return typeof window !== 'undefined' && window.location.hash.replace('#', '') === 'sandbox';
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const bp = useBreakpoint();

  // La vista activa vive en el store (única fuente; el sandbox sigue local).
  const view = useObraStore((s) => s.view);
  const setView = useObraStore((s) => s.setView);
  const obraName = useObraStore((s) => s.obra.denominacion);
  const counts = useObraStore(selectCounts);
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);

  const refOpen = useObraStore((s) => s.refOpen);
  const refWidth = useObraStore((s) => s.refWidth);
  const refDrag = useObraStore((s) => s.refDrag);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const setRefWidth = useObraStore((s) => s.setRefWidth);
  const setRefDrag = useObraStore((s) => s.setRefDrag);
  const copyRefPartidas = useObraStore((s) => s.copyRefPartidas);

  // Redimensionar el panel en split: se arrastra el tirador (320–640 lo clampa el store).
  const startRefResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const onMove = (ev: PointerEvent) => setRefWidth(window.innerWidth - ev.clientX);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [setRefWidth],
  );

  const splitOpen = refOpen && bp.w >= SPLIT_WIDTH;
  const overlayOpen = refOpen && bp.w < SPLIT_WIDTH;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [obraOpen, setObraOpen] = useState(false);
  // F7.1: chooser de export + doc de impresión montado BAJO DEMANDA (portal).
  const [exportOpen, setExportOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);
  const [sandbox, setSandbox] = useState(isSandboxHash);

  // Ruta sandbox sincronizada con el hash (deep-link + botón atrás).
  useEffect(() => {
    const onHash = () => setSandbox(isSandboxHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // El drawer sólo existe en compacto; ciérralo al pasar a desktop.
  useEffect(() => {
    if (bp.isDesktop) setDrawerOpen(false);
  }, [bp.isDesktop]);

  // F6.1: al ocultar la pestaña, fuerza el guardado pendiente (no perder la última
  // edición por el debounce). `pagehide` es el evento más fiable para esto.
  useEffect(() => {
    const onHide = () => void flushPending();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  const goSandbox = useCallback(() => {
    window.location.hash = 'sandbox';
    setSandbox(true);
  }, []);
  const leaveSandbox = useCallback(() => {
    window.location.hash = '';
    setSandbox(false);
  }, []);

  // El doc de impresión se desmonta al terminar (afterprint / fallback).
  const closePrint = useCallback(() => setPrintTarget(null), []);
  const exportPdf = useCallback((target: PrintTarget) => setPrintTarget(target), []);

  const changeView = useCallback(
    (v: View) => {
      setView(v);
      setDrawerOpen(false);
    },
    [setView],
  );

  if (sandbox) return <Sandbox onBack={leaveSandbox} />;

  const sidebar = <Sidebar drawer={!bp.isDesktop} onAfterSelect={() => setDrawerOpen(false)} />;

  return (
    <div className={styles.app}>
      <TopBar
        view={view}
        onView={changeView}
        theme={theme}
        onToggleTheme={toggleTheme}
        bp={bp}
        onMenu={() => setDrawerOpen(true)}
        obraName={obraName}
        refOpen={refOpen}
        onToggleRef={() => setRefOpen()}
        onExport={() => setExportOpen(true)}
        onObra={() => setObraOpen(true)}
      />

      <div className={styles.body}>
        {bp.isDesktop ? (
          sidebar
        ) : (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {sidebar}
          </Drawer>
        )}

        <main
          className={`${styles.main}${refDrag ? ` ${styles.dropZone}` : ''}`}
          onDragOver={
            refDrag
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }
              : undefined
          }
          onDrop={
            refDrag
              ? (e) => {
                  e.preventDefault();
                  // Soltar en el área de presupuesto = capítulo/sub activo.
                  copyRefPartidas(refDrag.items, null, refDrag.contra);
                  setRefDrag(null);
                }
              : undefined
          }
        >
          {view === 'presupuesto' ? (
            <PresupuestoView compact={bp.isMobile} />
          ) : view === 'certificaciones' ? (
            <CertificacionesView compact={bp.isMobile} />
          ) : view === 'import' ? (
            <ImportarView compact={bp.isMobile} />
          ) : (
            <ResumenView compact={bp.isMobile} />
          )}
          {overlayOpen && (
            <div className={`no-print ${refStyles.overlay}`}>
              <ReferenciaPanel />
            </div>
          )}
        </main>

        {splitOpen && (
          <>
            <div
              className={`no-print ${refStyles.divider}`}
              onPointerDown={startRefResize}
              role="separator"
              aria-orientation="vertical"
            />
            <aside className={refStyles.aside} style={{ width: refWidth }}>
              <ReferenciaPanel />
            </aside>
          </>
        )}
      </div>

      {bp.isMobile ? (
        <BottomTabBar view={view} onView={changeView} />
      ) : (
        <StatusBar counts={counts} pem={pem} pec={pec} onSandbox={goSandbox} />
      )}

      <ObraModal open={obraOpen} onClose={() => setObraOpen(false)} compact={bp.isMobile} />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        compact={bp.isMobile}
        onExportPdf={exportPdf}
      />
      {printTarget && <PrintDoc target={printTarget} onDone={closePrint} />}

      <PersistUI />
    </div>
  );
}
