import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import App from './App';
import { hydrate } from './persist/sync';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

// F6.1: hidratar la obra persistida ANTES del primer render (los hooks correrían
// tras render → parpadeo demo→obra). `hydrate` muta el store si hay datos sanos;
// el render ve ya la obra correcta. Pase lo que pase (vacío/corrupto/IDB caído)
// arrancamos: la demo en memoria es el peor caso.
void hydrate().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
