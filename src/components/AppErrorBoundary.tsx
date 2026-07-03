import { Component, type ReactNode } from 'react';
import { cancelPending, exportObraJson } from '../persist';

/**
 * Red de seguridad global (auditoría E-03). Sin boundary, una excepción de
 * render desmonta el árbol entero → pantalla en blanco sin mensaje. Y peor: el
 * autosave vive FUERA de React (suscripción zustand + timers en persist/sync),
 * así que la mutación que provocó el crash puede tener un guardado ya
 * programado — se persistiría el estado sospechoso y al recargar volvería a
 * reventar (bucle de brick sin acceso a ProjectBackup, que vive dentro de la
 * UI muerta). Aquí: (1) se CANCELA el autosave pendiente, (2) se ofrece
 * exportar la copia .json y recargar. Estilos inline a propósito: cuanto menos
 * dependa esta pantalla del resto de la app, menos papeletas de fallar ella.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  componentDidCatch(): void {
    try {
      cancelPending(); // no fosilizar el estado que (quizá) causó el crash
    } catch {
      /* mejor esfuerzo: el boundary nunca debe re-lanzar */
    }
  }

  private exportar = (): void => {
    try {
      exportObraJson();
    } catch {
      // El estado en memoria no es serializable: los blobs de IndexedDB siguen
      // intactos (el autosave pendiente se canceló) — recargar los recupera.
      window.alert(
        'No se pudo exportar el estado en memoria. Tus datos guardados en el navegador siguen intactos: recarga la página.',
      );
    }
  };

  render(): ReactNode {
    if (this.state.error == null) return this.props.children;
    const msg = this.state.error instanceof Error ? this.state.error.message : String(this.state.error);
    const btn: React.CSSProperties = {
      padding: '8px 14px',
      borderRadius: 8,
      border: '1px solid #8886',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      cursor: 'pointer',
    };
    return (
      <div
        role="alert"
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ margin: 0, fontSize: 20 }}>Algo ha fallado</h1>
        <p style={{ margin: 0, maxWidth: 480, opacity: 0.8 }}>
          La aplicación ha encontrado un error inesperado. El guardado automático pendiente se ha
          cancelado, así que tus datos guardados no se han tocado.
        </p>
        <code style={{ fontSize: 12, opacity: 0.6, maxWidth: 560, overflowWrap: 'anywhere' }}>{msg}</code>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" style={btn} onClick={this.exportar}>
            Exportar copia de datos (.json)
          </button>
          <button
            type="button"
            style={{ ...btn, fontWeight: 600 }}
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
