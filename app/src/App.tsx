import { useCallback, useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { PresupuestoView } from './features/presupuesto';
import { PlaceholderView } from './features/PlaceholderView';
import { Sandbox } from './features/sandbox/Sandbox';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useTheme } from './hooks/useTheme';
import { BottomTabBar, Drawer, Sidebar, StatusBar, TopBar, type View } from './layout';
import { selectCounts, selectPec, selectPem, useObraStore } from './store';
import styles from './App.module.css';

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sandbox, setSandbox] = useState(isSandboxHash);
  const [flash, setFlash] = useState<string | null>(null);

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

  // Auto-oculta el toast de placeholder.
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2600);
    return () => window.clearTimeout(id);
  }, [flash]);

  const goSandbox = useCallback(() => {
    window.location.hash = 'sandbox';
    setSandbox(true);
  }, []);
  const leaveSandbox = useCallback(() => {
    window.location.hash = '';
    setSandbox(false);
  }, []);

  const placeholder = useCallback(
    (label: string) => setFlash(`${label} llegará en una fase posterior.`),
    [],
  );

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
        onToggleRef={() => placeholder('El panel de Referencia')}
        onExport={() => placeholder('La exportación de listados')}
        onObra={() => placeholder('Los datos de la obra')}
      />

      <div className={styles.body}>
        {bp.isDesktop ? (
          sidebar
        ) : (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {sidebar}
          </Drawer>
        )}

        <main className={styles.main}>
          {view === 'presupuesto' ? (
            <PresupuestoView compact={bp.isMobile} />
          ) : (
            <PlaceholderView view={view} compact={bp.isMobile} />
          )}
        </main>
      </div>

      {bp.isMobile ? (
        <BottomTabBar view={view} onView={changeView} />
      ) : (
        <StatusBar counts={counts} pem={pem} pec={pec} onSandbox={goSandbox} />
      )}

      {flash && (
        <div className={styles.toast} role="status">
          <span className={styles.ic}>
            <Icon name="command" size={15} />
          </span>
          {flash}
        </div>
      )}
    </div>
  );
}
