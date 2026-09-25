import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { watchDurability } from './persist/durability';
import { hydrate } from './persist/sync';
import { useObraStore } from './store';
import { initHistory } from './store/temporal';
import { UpdatePrompt, startUpdateWatcher } from './update';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

// F6.1: hidratar la obra persistida ANTES del primer render (los hooks correrían
// tras render → parpadeo demo→obra). `hydrate` muta el store si hay datos sanos;
// el render ve ya la obra correcta. Pase lo que pase (vacío/corrupto/IDB caído)
// arrancamos: la demo en memoria es el peor caso. El boundary (E-03) evita la
// pantalla en blanco + autosave del estado roto si un render lanza.
void hydrate().finally(() => {
  // Arranca el historial de Deshacer/Rehacer DESPUÉS de hidratar: la obra cargada
  // es la línea base y no se registra como una edición.
  initHistory(useObraStore);
  // Que el navegador no borre las obras por su cuenta: se pide con el primer
  // guardado de la sesión, nunca al cargar (Firefox pregunta al usuario).
  watchDurability();
  createRoot(root).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
      {/* FUERA del boundary: un chunk purgado por un deploy tumba la App entera
          (lazy sin cargar), y justo entonces el aviso tiene que seguir ahí. */}
      <UpdatePrompt />
    </StrictMode>,
  );
  // Aviso de versión nueva: solo en el build publicado (en dev no hay version.json).
  if (import.meta.env.PROD) startUpdateWatcher();
});
