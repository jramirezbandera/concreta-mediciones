import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { CertificacionesView } from './features/certificaciones';
import { ExportModal, exportBc3, exportDocx, exportXlsx } from './features/exportar';
import { CopiaRecordatorio, ObraModal, useEstadoCopia } from './features/obra';
import { PresupuestoView } from './features/presupuesto';
import { type PrintTarget } from './features/print';
import { ConflictModal, ReferenciaPanel, refStyles } from './features/referencia';
import { AsistenteChat } from './features/asistente';
import { ImportPartidaButton } from './features/importar/ImportPartidaButton';
import { Icon } from './components';
import { ClipboardToast } from './layout/ClipboardToast';
import { Toast } from './layout/Toast';
import { ResumenView } from './features/resumen';
import { PersistUI, flushPending } from './persist';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useClipboardHotkeys } from './hooks/usePartidaClipboard';
import { useMedClipboard } from './hooks/useMedClipboard';
import { useTheme } from './hooks/useTheme';
import { AyudaCenter } from './layout/AyudaCenter';
import type { HelpTab } from './layout/ayudaContent';
import { BottomTabBar, Drawer, MobileSummaryBar, ObraSwitcher, Sidebar, StatusBar, TopBar, type View } from './layout';
import { ROOMY_W } from './layout/TopBar';
import { selectCounts, selectPec, selectPem, selectTotalConIva, useObraStore, useToastStore } from './store';
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

/** Un export que falla NO se traga (auditoría E-01): el modal ya se cerró, así que
 *  sin toast el usuario creería que exportó su documento (el chunk dinámico puede
 *  fallar offline o tras un deploy que purgó los assets de la sesión abierta). */
const exportFailed = (kind: string) => (err: unknown) => {
  console.error(`Export ${kind} falló:`, err);
  useToastStore.getState().show(`No se pudo generar el ${kind}. Reintenta o recarga la página.`);
};

/** Cómo ocupa el panel lateral la pantalla: `split` (junto al presupuesto, con
 *  tirador de ancho), `overlay` (encima, en pantallas estrechas) o `full`
 *  (pantalla completa; solo Referencia). */
type LateralModo = 'split' | 'overlay' | 'full';

/**
 * El hueco lateral (diseño D4). UNA sola instancia del panel para los tres
 * modos: cambiar de tamaño SOLO alterna su clase, nunca la desmonta → no se
 * pierde el estado local (selección, búsqueda, desplegados, obra de referencia
 * cargada, conversación). Los `key` estables anclan la identidad aunque
 * aparezca o desaparezca el tirador. El overlay (estrecho) se desplaza el ancho
 * de la sidebar por CSS (`--sidebar-w`) para cubrir SOLO el presupuesto.
 */
function LateralAside({
  modo,
  width,
  onResizeStart,
  children,
}: {
  modo: LateralModo;
  width: number;
  onResizeStart: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}) {
  const split = modo === 'split';
  return (
    <>
      {split && (
        <div
          key="divider"
          className={`no-print ${refStyles.divider}`}
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
        />
      )}
      <aside
        key="panel"
        className={`no-print ${modo === 'full' ? refStyles.full : split ? refStyles.aside : refStyles.overlay}`}
        style={split ? { width } : undefined}
      >
        {children}
      </aside>
    </>
  );
}

/** Congela los firmantes de una cert al exportarla (pie de firma reproducible,
 *  OV1): la primera exportación sella quién firmó y la fecha. Idempotente. */
function freezeCertFirmantesFor(target: PrintTarget): void {
  if (target.kind === 'cert') useObraStore.getState().freezeCertFirmantes(target.index);
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const bp = useBreakpoint();
  useClipboardHotkeys(); // Ctrl/Cmd+C copiar partida · Ctrl/Cmd+V pegar (T8)
  useMedClipboard(); // líneas de medición: Ctrl/Cmd+C/V/D y Esc (cede a partidas fuera de contexto)
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

  // Hueco lateral (diseño D4): UN solo panel a la vez, Referencia o el asistente.
  const lateral = useObraStore((s) => s.lateral);
  const refOpen = lateral === 'ref';
  const refWidth = useObraStore((s) => s.refWidth);
  const refMaximized = useObraStore((s) => s.refMaximized);
  const refDrag = useObraStore((s) => s.refDrag);
  const setRefOpen = useObraStore((s) => s.setRefOpen);
  const setRefWidth = useObraStore((s) => s.setRefWidth);
  const setRefDrag = useObraStore((s) => s.setRefDrag);
  const requestCopyRefPartidas = useObraStore((s) => s.requestCopyRefPartidas);

  // Asistente de IA (F-A2): comparte el hueco lateral con Referencia (abrir uno
  // pliega el otro — lo garantiza la forma de `lateral`). Sin pantalla completa
  // en el primer incremento: split (ancho) u overlay (estrecho), reusando el
  // ancho de Referencia.
  const asistenteOpen = lateral === 'asistente';
  const setAsistenteOpen = useObraStore((s) => s.setAsistenteOpen);

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

  // Pantalla completa (solo Referencia): el panel tapa sidebar + presupuesto
  // (bajo el topbar). Tiene prioridad sobre split/overlay, que solo aplican sin
  // maximizar.
  const lateralModo: LateralModo =
    lateral === 'ref' && refMaximized ? 'full' : bp.w >= SPLIT_WIDTH ? 'split' : 'overlay';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [obraOpen, setObraOpen] = useState(false);
  // Recordatorio de copia (Etapa 0): en compacto vive en el menú «Más», que
  // lleva un punto de aviso mientras la copia está vencida.
  const copia = useEstadoCopia();
  // Realce de la zona de presupuesto al arrastrar un fichero .bc3 externo (T4).
  const [fileOver, setFileOver] = useState(false);
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
    // A-08 (menor): el listener de visibilitychange también se LIMPIA — antes
    // era una lambda inline sin cleanup y StrictMode lo registraba dos veces.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Guarda global: soltar un .bc3 FUERA de la zona de presupuesto NO debe navegar
  // (el navegador abriría el fichero y se perdería el estado). preventDefault solo
  // para drags de FICHERO, sin tocar el drag interno de Referencia.
  useEffect(() => {
    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const guard = (e: DragEvent) => {
      if (isFileDrag(e)) e.preventDefault();
    };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => {
      window.removeEventListener('dragover', guard);
      window.removeEventListener('drop', guard);
    };
  }, []);

  // Sandbox (galería de primitivas de dev): sin enlace visible; se entra escribiendo
  // `#sandbox` en la URL (lo capta el listener de `hashchange`).
  const leaveSandbox = useCallback(() => {
    window.location.hash = '';
    setSandbox(false);
  }, []);

  // El doc de impresión se desmonta al terminar (afterprint / fallback).
  const closePrint = useCallback(() => setPrintTarget(null), []);
  const exportPdf = useCallback((target: PrintTarget) => {
    freezeCertFirmantesFor(target);
    setPrintTarget(target);
  }, []);
  // XLSX/DOCX (F7.2/F7.3): generan y descargan; las librerías van por import dinámico.
  const exportExcel = useCallback((target: PrintTarget) => {
    freezeCertFirmantesFor(target);
    exportXlsx(target).catch(exportFailed('Excel'));
  }, []);
  const exportWord = useCallback((target: PrintTarget) => {
    freezeCertFirmantesFor(target);
    exportDocx(target).catch(exportFailed('Word'));
  }, []);
  // BC3 (F7.4): writer propio síncrono, sin librería (FIEBDC-3 para Presto y cía).
  const exportObraBc3 = useCallback(() => {
    try {
      exportBc3();
    } catch (err: unknown) {
      exportFailed('.bc3')(err);
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
        asistenteOpen={asistenteOpen}
        onToggleAsistente={() => setAsistenteOpen()}
        onExport={() => setExportOpen(true)}
        onObra={() => setObraOpen(true)}
        onHelp={() => openHelp('inicio')}
        obraSwitcher={<ObraSwitcher />}
        importAction={
          // En compacto (móvil/tablet) va dentro del menú «Más» del TopBar: fila con
          // texto. En escritorio, en la barra: solo icono por debajo de ROOMY_W para
          // no dejar sin sitio el nombre de la obra.
          view === 'presupuesto' ? (
            <ImportPartidaButton compact={bp.isDesktop && bp.w < ROOMY_W} />
          ) : undefined
        }
        backupAction={<CopiaRecordatorio variant={bp.isCompact ? 'menu' : 'bar'} />}
        moreBadge={copia.visible && copia.vencida}
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
          className={`${styles.main}${refDrag || fileOver ? ` ${styles.dropZone}` : ''}`}
          onDragOver={(e) => {
            if (refDrag) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              return;
            }
            // Una zona de drop hija (p.ej. la vista Importar = reemplazar obra) ya lo
            // gestiona: no iluminar ni competir por el mismo fichero.
            if (e.defaultPrevented) return;
            // Drag de fichero externo (.bc3): ilumina la zona y permite soltar.
            if (Array.from(e.dataTransfer.types).includes('Files')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (!fileOver) setFileOver(true);
            }
          }}
          onDragLeave={() => {
            if (fileOver) setFileOver(false);
          }}
          onDrop={(e) => {
            if (refDrag) {
              e.preventDefault();
              // Soltar en el área de presupuesto = capítulo/sub activo (con
              // preflight de colisión: puede abrir el diálogo de resolución).
              requestCopyRefPartidas(refDrag.items, null, refDrag.contra);
              setRefDrag(null);
              return;
            }
            if (e.defaultPrevented) return; // ya lo gestionó una zona hija
            const dt = e.dataTransfer;
            const types = Array.from(dt.types);
            if (!types.some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/plain'))
              return;
            e.preventDefault();
            setFileOver(false);
            // Captura SÍNCRONA antes del import dinámico (el evento se recicla). El
            // parser FIEBDC se carga aquí, no en el bundle inicial. Se copian TODOS
            // los ficheros: soltar las 12 partidas de un capítulo va en un solo gesto.
            const files = Array.from(dt.files ?? []);
            // .catch (E-05): un chunk que no carga convertía el drop en no-op mudo.
            void import('./features/importar/importPartida')
              .then((m) => m.processBudgetDrop(files, types, null))
              .catch(() =>
                useToastStore.getState().show('No se pudo cargar el importador. Recarga la página.'),
              );
          }}
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
          {fileOver && !refDrag && (
            <div className={`no-print ${styles.fileDropHint}`} aria-hidden>
              <Icon name="download" size={20} />
              Suelta el <span className="mono">.bc3</span> para importar la partida
            </div>
          )}
        </main>

        {/* Hueco lateral: Referencia o el asistente de IA, nunca los dos (lo
            garantiza la forma de `lateral`). El `key` separa un panel del otro;
            dentro, cambiar de tamaño no lo desmonta (ver LateralAside). */}
        {lateral && (
          <LateralAside key={lateral} modo={lateralModo} width={refWidth} onResizeStart={startRefResize}>
            {lateral === 'ref' ? (
              <ReferenciaPanel onImport={() => setRefImportOpen(true)} />
            ) : (
              <AsistenteChat />
            )}
          </LateralAside>
        )}
      </div>

      {bp.isMobile ? (
        <>
          {/* En la pestaña Resumen la franja PEM/TOTAL repetía la página entera. */}
          {view !== 'resumen' && (
            <MobileSummaryBar pem={pem} total={total} onOpen={() => setDrawerOpen(true)} />
          )}
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
