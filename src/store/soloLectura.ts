/* ===========================================================================
   store/soloLectura — en una pestaña de SOLO LECTURA la obra no se edita.
   ---------------------------------------------------------------------------
   Antes solo se inhibía el autosave (T-19): las acciones del store seguían
   mutando la obra en memoria y lo tecleado se perdía en la próxima recarga o
   traspaso, sin más aviso que el banner. Ahora el `set` del store rechaza todo
   cambio que toque una clave de DOMINIO mientras la pestaña es de solo lectura,
   y lo explica con un aviso. La navegación (vista, capítulo, partida abierta)
   sigue libre: solo se mira.

   · Middleware ENTRE `subscribeWithSelector` e `immer`: recibe ya el `produce`
     de immer, así calcula el estado siguiente sin instalarlo y compara las
     claves de dominio por referencia (structural sharing, como el historial).
     Cubre también `setState` de fuera (Deshacer/Rehacer, tests), que immer
     enruta por el mismo `set`.
   · La acción se rechaza ENTERA (también su parte de UI): es atómica.
   · Quién decide que la pestaña es de solo lectura lo INYECTA `persist/`
     (`setBloqueoEdicion`): `store/` no importa `persist/`.
   · La persistencia sí carga obras en una pestaña de solo lectura (traspaso,
     conmutar): esas cargas van envueltas en `permitirCarga`.
   =========================================================================== */
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { DOMAIN_KEYS } from './schema';
import { useToastStore } from './toastStore';

/** Devuelve el aviso que explica por qué no se puede editar, o `null` si se puede. */
type Bloqueo = () => string | null;

let bloqueo: Bloqueo = () => null;
/** >0 mientras corre una carga permitida (`permitirCarga`). */
let permitidas = 0;
/** Ya hay un aviso en cola: una ráfaga de rechazos enseña UNO. */
let avisoEnCola = false;

/** Lo llama `persist/` para decir cuándo esta pestaña es de solo lectura. */
export function setBloqueoEdicion(fn: Bloqueo): void {
  bloqueo = fn;
}

/** El aviso de solo lectura si ahora no se puede editar la obra; si no, `null`. */
export function edicionBloqueada(): string | null {
  return permitidas > 0 ? null : bloqueo();
}

/** Ejecuta `fn` (una carga de obra de la persistencia) aunque la pestaña sea de
 *  solo lectura: cargar lo que hay en disco no es editar. */
export function permitirCarga<T>(fn: () => T): T {
  permitidas++;
  try {
    return fn();
  } finally {
    permitidas--;
  }
}

/** Enseña el aviso de solo lectura. En un microtask: la acción rechazada puede
 *  enseñar después su propio aviso de éxito («Línea pegada»), y este debe ganar. */
export function avisarSoloLectura(msg: string): void {
  if (avisoEnCola) return;
  avisoEnCola = true;
  queueMicrotask(() => {
    avisoEnCola = false;
    useToastStore.getState().show(msg, undefined, { tone: 'warn' });
  });
}

function tocaDominio(cur: object, next: object): boolean {
  const c = cur as Record<string, unknown>;
  const n = next as Record<string, unknown>;
  return DOMAIN_KEYS.some((k) => k in n && !Object.is(n[k], c[k]));
}

type GuardaSoloLectura = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

type SetCrudo = (partial: unknown, replace?: boolean, ...rest: unknown[]) => void;

/** Middleware: rechaza los cambios de dominio mientras la edición esté bloqueada. */
export const guardaSoloLectura: GuardaSoloLectura = (initializer) => (set, get, store) => {
  const crudo = set as unknown as SetCrudo;
  const guardado: SetCrudo = (partial, replace, ...rest) => {
    const msg = edicionBloqueada();
    if (!msg) return crudo(partial, replace, ...rest);
    const cur = get() as object;
    const next = (typeof partial === 'function' ? (partial as (s: unknown) => unknown)(cur) : partial) as object;
    if (next === cur || !tocaDominio(cur, next)) return crudo(next, replace, ...rest);
    avisarSoloLectura(msg);
  };
  return initializer(guardado as unknown as typeof set, get, store);
};
