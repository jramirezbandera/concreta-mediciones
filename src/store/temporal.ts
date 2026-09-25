/* ===========================================================================
   store/temporal — historial de Deshacer/Rehacer del DOMINIO (undo/redo global).
   ---------------------------------------------------------------------------
   Middleware temporal PROPIO (no zundo), implementado por SUSCRIPCIÓN al slice de
   dominio del store (mismo mecanismo que el autosave). Guarda snapshots de las 7
   claves de dominio en dos pilas (`past`/`future`) y las restaura por merge parcial,
   preservando el estado de UI (deshacer NO mueve el cursor/capítulo/cert).

   Diseño (revisado en /plan-eng-review + voz externa):
   · partialize = pick BARATO de 7 claves (incl. `bajas`); NO `toSerializable`
     (que escanearía/clonaría en cada `set`). `equality: shallow` se apoya en el
     structural sharing de immer: una acción de UI deja el dominio shallow-igual →
     NO genera entrada; un cambio de dominio sí.
   · Coalescing por throttle LEADING-edge: una ráfaga de ediciones = UNA entrada,
     que restaura el valor PREVIO a la ráfaga (por eso leading, no trailing).
   · `pauseHistory` (espejo del `suppress` del autosave) lo llaman `loadObra`/`reset`
     para NO registrar la carga y VACIAR el historial (un undo no cruza obras, D-08).
   · Tras restaurar un snapshot, `reconcileUi` arregla refs de UI colgando
     (deshacer un `addChapter` dejaría `active` sobre un capítulo inexistente).
   · Se inyecta el store en `initHistory` para no crear un ciclo de import con
     `obraStore` (solo se importa su TIPO, que se borra en compilación).
   =========================================================================== */
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { findNode } from '../core/tree';
import { ALL } from './base';
import { DOMAIN_KEYS, type DomainKey } from './schema';
import { useToastStore } from './toastStore';
import type { ObraState, ObraStore } from './obraStore';

/** Snapshot del DOMINIO trackeado: las claves de `DOMAIN_KEYS` (fuente única en
 *  `schema.ts`, compartida con el autosave). Sin estado de UI a propósito. */
export type DomainSnapshot = Pick<ObraState, DomainKey>;

/**
 * Pick barato de las claves de dominio (NO `toSerializable`, que escanea y clona
 * en cada llamada). immer conserva las referencias de las ramas no tocadas, así
 * que `shallow` sobre estas claves distingue un cambio de dominio (ref distinta)
 * de una acción de UI (todas iguales → no se registra).
 *
 * INVARIANTE (auditoría 2026-07-05): los snapshots retienen las referencias
 * VIVAS del estado, sin clonar — la integridad del historial descansa en que
 * TODA mutación pasa por el `set` de immer (copy-on-write: nunca muta la base
 * retenida; `autoFreeze` de immer, activo de serie en dev Y prod, es la segunda
 * barrera). No añadir `setAutoFreeze(false)` ni mutar estado instalado fuera de
 * un `set` — corrompería `past`/`future` en silencio.
 */
function partialize(s: ObraState): DomainSnapshot {
  const snap = {} as Record<DomainKey, unknown>;
  for (const k of DOMAIN_KEYS) snap[k] = s[k];
  return snap as DomainSnapshot;
}

/** Profundidad máxima del historial. Acota el Nº DE ENTRADAS, no el churn por
 *  entrada: el structural sharing hace que cada una retenga solo los objetos
 *  realmente cambiados, pero una acción masiva (editRecurso de un recurso muy
 *  compartido, completar la obra) puede tocar miles de partidas de golpe —
 *  25 × ese churn es el peor caso de memoria (T8). Medir con la obra de
 *  dogfood ANTES de subirlo. */
const LIMIT = 25;
/** Ventana de coalescing (ms). Editable en tests. */
let throttleMs = 700;

let host: ObraStore | null = null;
let unsub: (() => void) | null = null;
let past: DomainSnapshot[] = [];
let future: DomainSnapshot[] = [];
/** Mientras es true, los cambios de dominio NO se registran: lo activan la propia
 *  aplicación de undo/redo y `pauseHistory` (carga/cambio de obra). */
let suspended = false;
/** Fin (Date.now()) de la ventana de throttle en curso. */
let throttleUntil = 0;
/**
 * Revisión MONÓTONA del dominio: sube con CADA cambio de dominio que ve la
 * suscripción, también los coalescidos, los de undo/redo y los de una carga.
 * Un «Deshacer» ofrecido tras una acción guarda la revisión de ese momento y
 * solo actúa si nadie ha tocado la obra después (si no, desharía otra cosa).
 */
let domainRevision = 0;

/** Booleans reactivos para la UI (botones Deshacer/Rehacer). Exponemos ESTO, no
 *  las pilas `past`/`future` (acoplaría la UI a los snapshots retenidos). */
export const useHistoryStore = create<{ canUndo: boolean; canRedo: boolean }>(() => ({
  canUndo: false,
  canRedo: false,
}));
function notify(): void {
  // Solo escribir en el FLANCO (auditoría 2026-07-05): zustand no hace bail por
  // igualdad de valor —un objeto nuevo siempre notifica—, y notify() corre en
  // CADA set de dominio (por pulsación). Sin esta guarda, cualquier suscriptor
  // (los botones del TopBar) se re-renderizaría a frecuencia de tecleo.
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const cur = useHistoryStore.getState();
  if (cur.canUndo === canUndo && cur.canRedo === canRedo) return;
  useHistoryStore.setState({ canUndo, canRedo });
}

/** Ejecuta `fn` sin que el historial registre los cambios que provoque. */
function suspend<T>(fn: () => T): T {
  const prev = suspended;
  suspended = true;
  try {
    return fn();
  } finally {
    suspended = prev;
  }
}

/**
 * Reconcilia la UI tras restaurar un snapshot de dominio. El historial solo
 * trackea dominio, así que restaurarlo puede dejar refs de UI colgando:
 * deshacer un `addChapter` deja `active` sobre un capítulo ya inexistente;
 * deshacer un `addCert` deja `curCert` fuera del array; una partida abierta
 * puede haber desaparecido. Devuelve el parche de UI o `null` si todo es válido.
 */
function reconcileUi(s: ObraState): Partial<ObraState> | null {
  const fix: Partial<ObraState> = {};
  const activeOk =
    s.active === ALL ||
    s.chapters.some((c) => c.id === s.active) ||
    !!findNode(s.chapters, s.active);
  if (!activeOk) fix.active = ALL;
  const maxCert = Math.max(0, s.certs.length - 1);
  if (s.curCert > maxCert) fix.curCert = maxCert;
  else if (s.curCert < 0) fix.curCert = 0;
  if (s.openPartidaId != null) {
    const exists = Object.values(s.partidas).some((ps) =>
      ps.some((p) => p.id === s.openPartidaId),
    );
    if (!exists) fix.openPartidaId = null;
  }
  return Object.keys(fix).length > 0 ? fix : null;
}

/** Aplica un snapshot de dominio (merge parcial de las 7 claves; la UI se
 *  preserva salvo las refs inválidas, que reconcilia). */
function applyDomain(snap: DomainSnapshot): void {
  if (!host) return;
  host.setState(snap);
  const fix = reconcileUi(host.getState());
  if (fix) host.setState(fix);
}

/** Listener de cambios de dominio: registra el estado PREVIO a la ráfaga. */
function onDomainChange(_next: DomainSnapshot, prev: DomainSnapshot): void {
  domainRevision++;
  // Un aviso con «Deshacer» atado a una revisión muere en cuanto la obra cambia:
  // nunca se enseña un Deshacer que ya desharía otra cosa.
  const toast = useToastStore.getState();
  if (toast.rev != null && toast.rev !== domainRevision) toast.clear();
  if (suspended) return;
  future = []; // cualquier edición nueva invalida el rehacer
  const now = Date.now();
  if (now >= throttleUntil) {
    // Borde de entrada de una ráfaga nueva: guarda el estado pre-ráfaga.
    past.push(prev);
    if (past.length > LIMIT) past.shift();
  }
  // Ventana DESLIZANTE (T8a): cada set —también los coalescidos— la extiende.
  // Las celdas de dinero commitean en Enter/blur (1 set por edición), pero tres
  // superficies de texto (ObraModal, notas del Resumen, editor de DF) escriben
  // POR PULSACIÓN: sin deslizar, una sesión de tecleo fragmentaba en ~1 entrada
  // por ventana. Deslizando, teclear seguido = UNA entrada que restaura el valor
  // pre-sesión. Trade-off aceptado: dos commits de grid encadenados a <700 ms
  // también se fusionan (un Ctrl+Z revierte ese mini-lote; tolerable).
  throttleUntil = now + throttleMs;
  notify();
}

/**
 * Arranca el historial suscribiéndose al slice de dominio del store. Idempotente
 * (StrictMode/tests). Llamar TRAS `hydrate` para que la obra cargada sea la línea
 * base y no se registre. El store se INYECTA para no crear un ciclo de import.
 */
export function initHistory(store: ObraStore): void {
  if (unsub) return;
  host = store;
  unsub = store.subscribe(partialize, onDomainChange, { equalityFn: shallow });
  notify();
}

/** Deshace la última edición de dominio (no-op si no hay historial). */
export function undo(): void {
  if (!host || past.length === 0) return;
  // D-08 simétrico (auditoría): un toast «Deshacer» pendiente capturó estado de
  // ANTES de este undo; dejarlo vivo tras restaurar daría un botón muerto (la
  // guarda de restorePartida lo neutraliza) o una acción sobre estado ya movido.
  // loadObra/reset ya hacen exactamente esto.
  useToastStore.getState().clear();
  const current = partialize(host.getState());
  const target = past[past.length - 1]!;
  past = past.slice(0, -1);
  future = [current, ...future];
  suspend(() => applyDomain(target));
  throttleUntil = 0; // cierra la ráfaga abierta: la próxima edición empuja
  notify();
}

/** Rehace la última edición deshecha (no-op si no hay futuro). */
export function redo(): void {
  if (!host || future.length === 0) return;
  useToastStore.getState().clear(); // mismo D-08 simétrico que undo()
  const current = partialize(host.getState());
  const target = future[0]!;
  future = future.slice(1);
  past = [...past, current];
  suspend(() => applyDomain(target));
  throttleUntil = 0;
  notify();
}

/**
 * Cierra la ráfaga en curso: el próximo cambio de dominio abre entrada propia.
 * Las acciones estructurales de medición (pegar, duplicar, reordenar, borrar en
 * bloque) la llaman ANTES y DESPUÉS de su `set`, así cada una es exactamente un
 * paso de Deshacer y nunca se funde con una edición de celda contigua (<700 ms).
 */
export function historyCheckpoint(): void {
  throttleUntil = 0;
}

/** Revisión actual del dominio (ver `domainRevision`). */
export function getDomainRevision(): number {
  return domainRevision;
}

/** Vacía el historial (cambio/carga de obra: un undo no debe cruzar obras). */
export function clearHistory(): void {
  past = [];
  future = [];
  throttleUntil = 0;
  notify();
}

/**
 * Ejecuta `fn` (el `set` de `loadObra`/`reset`) sin registrarlo y VACÍA el
 * historial: la obra saliente no debe quedar en el `past` de la entrante (análogo
 * D-08). Espejo del flag `suppress` del autosave. Cubre import/backup/newObra/
 * switch/handoff porque vive en la acción `loadObra` del store, no en `sync.ts`.
 */
export function pauseHistory<T>(fn: () => T): T {
  const r = suspend(fn);
  clearHistory();
  return r;
}

/* ---- helpers de test ------------------------------------------------------- */
export function __resetHistoryForTests(): void {
  unsub?.();
  unsub = null;
  host = null;
  past = [];
  future = [];
  suspended = false;
  throttleUntil = 0;
  throttleMs = 700;
  notify();
}
export function __historyState(): { past: number; future: number } {
  return { past: past.length, future: future.length };
}
export function __setThrottleMsForTests(ms: number): void {
  throttleMs = ms;
}
