import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { CertificacionesView } from './features/certificaciones';
import { ExportModal, exportBc3, exportDocx, exportXlsx } from './features/exportar';
import { ObraModal } from './features/obra';
import { PresupuestoView } from './features/presupuesto';
import { type PrintTarget } from './features/print';
import { ConflictModal, ReferenciaPanel, refStyles } from './features/referencia';
import { ClipboardToast } from './layout/ClipboardToast';
import { Toast } from './layout/Toast';
import { ResumenView } from './features/resumen';
import { PersistUI, flushPending } from './persist';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useClipboardHotkeys } from './hooks/usePartidaClipboard';
import { useTheme } from './hooks/useTheme';
import { AyudaCenter } from './layout/AyudaCenter';
import type { HelpTab } from './layout/ayudaContent';
import { BottomTabBar, Drawer, MobileSummaryBar, ObraSwitcher, Sidebar, StatusBar, TopBar, type View } from './layout';
import { selectCounts, selectPec, selectPem, selectTotalConIva, useObraStore } from './store';
import styles from './App.module.css';

// Code-splitting (T3): vistas/modales pesados o poco usados salen del bundle
// inicial. El feature `importar` arrastra el parser FIEBDC (~117 KB de vendor/bc3)
// → al diferir ImportarView + ReferenciaImportModal todo ese feature se carga solo
// al usarlo. Sandbox es solo de dev; PrintDoc renderiza la obra entera para imprimir.
const Sandbox = lazy(() => import('./features/sandbox/Sandbox').then((m) => ({ default: m.Sandbox })));
const ImportarView = lazy(() => import('./features/importar').then((m) => ({ default: m.ImportarView })));
const ReferenciaImportModal = lazy(() =>
  import('./features/importar').then((m) => ({ default: m.ReferenciaImportModal })),
);
const PrintDoc = lazy(() => import('./features/print').then((m) => ({ default: m.PrintDoc })));

/** Por encima de este ancho de ventana el panel Referencia abre en split; si no, overlay. */
const SPLIT_WIDTH = 1100;

/** ¿La ruta actual es el sandbox de primitivas? (`#sandbox`) */
function isSandboxHash(): boolean {
  return typeof window !== 'undefined' && window.location.hash.replace('#', '') === 'sandbox';
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const bp = useBreakpoint();
  useClipboardHotkeys(); // Ctrl/Cmd+C copiar partida · Ctrl/Cmd+V pegar (T8)
  // Centro de Ayuda: `null` = cerrado; el botón abre en 'inicio', la tecla `?` en 'atajos'.
  const [helpTab, setHelpTab] = useState<HelpTab | null>(null);
  const openHelp = useCallback((tab: HelpTab = 'inicio') => setHelpTab(tab), []);
  useAppHotkeys({ onHelp: () => setHelpTab('atajos') }); // Ctrl/Cmd+K · Supr · Esc · ?

  // La vista activa vive en el store (única fuente; el sandbox sigue local).
  const view = useObraStore((s) => s.view);
  const setView = useObraStore((s) => s.setView);
  const obraName = useObraStore((s) => s.obra.denominacion);
  const counts = useObraStore(selectCounts);
  const pem = useObraStore(selectPem);
  const pec = useObraStore(selectPec);
  const total = useObraStore(selectTotalConIva);

  const refOpen = useObraStore((s) => s.refOpen);
  const refWidth = useObraStore((s) => s.refWidth);
  const refMaximized = useObraStore((s) => s.refMaximized);
  const refDrag = useObraStore((s) => s.refDrag);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const setRefWidth = useObraStore((s) => s.setRefWidth);
  const setRefDrag = useObraStore((s) => s.setRefDrag);
  const requestCopyRefPartidas = useObraStore((s) => s.requestCopyRefPartidas);

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

  // Pantalla completa: el panel tapa sidebar + presupuesto (bajo el topbar).
  // Tiene prioridad sobre split/overlay, que solo aplican sin maximizar.
  const refFull = refOpen && refMaximized;
  const splitOpen = refOpen && !refMaximized && bp.w >= SPLIT_WIDTH;
  const overlayOpen = refOpen && !refMaximized && bp.w < SPLIT_WIDTH;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [obraOpen, setObraOpen] = useState(false);
  // Importar como obra de REFERENCIA (no reemplaza la activa): modal sobre el
  // panel, disparado desde la Referencia. Distinto de la vista Importar (reemplaza).
  const [refImportOpen, setRefImportOpen] = useState(false);
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

  // Sandbox (galería de primitivas de dev): sin enlace visible; se entra escribiendo
  // `#sandbox` en la URL (lo capta el listener de `hashchange`).
  const leaveSandbox = useCallback(() => {
    window.location.hash = '';
    setSandbox(false);
  }, []);

  // El doc de impresión se desmonta al terminar (afterprint / fallback).
  const closePrint = useCallback(() => setPrintTarget(null), []);
  const exportPdf = useCallback((target: PrintTarget) => setPrintTarget(target), []);
  // XLSX/DOCX (F7.2/F7.3): generan y descargan; las librerías van por import dinámico.
  const exportExcel = useCallback((target: PrintTarget) => {
    exportXlsx(target).catch((err: unknown) => console.error('Export XLSX falló:', err));
  }, []);
  const exportWord = useCallback((target: PrintTarget) => {
    exportDocx(target).catch((err: unknown) => console.error('Export DOCX falló:', err));
  }, []);
  // BC3 (F7.4): writer propio síncrono, sin librería (FIEBDC-3 para Presto y cía).
  const exportObraBc3 = useCallback(() => {
    try {
      exportBc3();
    } catch (err: unknown) {
      console.error('Export BC3 falló:', err);
    }
  }, []);

  const changeView = useCallback(
    (v: View) => {
      setView(v);
      setDrawerOpen(false);
    },
    [setView],
  );

  if (sandbox)
    return (
      <Suspense fallback={null}>
        <Sandbox onBack={leaveSandbox} />
      </Suspense>
    );

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
        onHelp={() => openHelp('inicio')}
        obraSwitcher={<ObraSwitcher />}
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
                  // Soltar en el área de presupuesto = capítulo/sub activo (con
                  // preflight de colisión: puede abrir el diálogo de resolución).
                  requestCopyRefPartidas(refDrag.items, null, refDrag.contra);
                  setRefDrag(null);
                }
              : undefined
          }
        >
          {view === 'presupuesto' ? (
            <PresupuestoView
              compact={bp.isMobile}
              onImport={() => changeView('import')}
              onOpenHelp={() => openHelp('inicio')}
            />
          ) : view === 'certificaciones' ? (
            <CertificacionesView
              compact={bp.isMobile}
              onGoPresupuesto={() => changeView('presupuesto')}
            />
          ) : view === 'import' ? (
            <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-disabled)' }}>Cargando…</div>}>
              <ImportarView compact={bp.isMobile} />
            </Suspense>
          ) : (
            <ResumenView compact={bp.isMobile} />
          )}
          {overlayOpen && (
            <div className={`no-print ${refStyles.overlay}`}>
              <ReferenciaPanel onImport={() => setRefImportOpen(true)} />
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
              <ReferenciaPanel onImport={() => setRefImportOpen(true)} />
            </aside>
          </>
        )}

        {refFull && (
          <div className={`no-print ${refStyles.full}`}>
            <ReferenciaPanel onImport={() => setRefImportOpen(true)} />
          </div>
        )}
      </div>

      {bp.isMobile ? (
        <>
          <MobileSummaryBar pem={pem} total={total} onOpen={() => setDrawerOpen(true)} />
          <BottomTabBar view={view} onView={changeView} />
        </>
      ) : (
        <StatusBar counts={counts} pem={pem} pec={pec} onHelp={() => openHelp('inicio')} />
      )}

      <ObraModal open={obraOpen} onClose={() => setObraOpen(false)} compact={bp.isMobile} />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        compact={bp.isMobile}
        onExportPdf={exportPdf}
        onExportXlsx={exportExcel}
        onExportDocx={exportWord}
        onExportBc3={exportObraBc3}
      />
      {printTarget && (
        <Suspense fallback={null}>
          <PrintDoc target={printTarget} onDone={closePrint} />
        </Suspense>
      )}

      {refImportOpen && (
        <Suspense fallback={null}>
          <ReferenciaImportModal open onClose={() => setRefImportOpen(false)} compact={bp.isMobile} />
        </Suspense>
      )}

      <AyudaCenter
        open={helpTab !== null}
        initialTab={helpTab ?? 'inicio'}
        onClose={() => setHelpTab(null)}
        onNavigate={(v) => {
          changeView(v);
          setHelpTab(null);
        }}
        compact={bp.isMobile}
      />

      <ConflictModal />
      <ClipboardToast />
      <Toast />
      <PersistUI />
    </div>
  );
}
