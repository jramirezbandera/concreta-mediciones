/* ===========================================================================
   ai/settingsStore — proveedor activo + API keys del asistente (Zustand).
   ---------------------------------------------------------------------------
   Equivalente al `AiSettingsProvider` (React Context) de concreta-v2, reescrito
   como store Zustand para encajar en Mediciones y que el executor headless (F-A3)
   pueda leerlo con `getState()`.

   SEGURIDAD: las keys viven SOLO en localStorage, en texto plano (trade-off
   documentado). NUNCA se loguean (console.*) ni se interpolan en mensajes de
   error. La key NO entra en `ObraData`/IndexedDB: no debe viajar en backups ni
   en el historial de deshacer.
   =========================================================================== */
import { create } from 'zustand';
import type { AiProviderId } from './types';
import { sharedKeyFor } from './sharedKey';

const STORAGE_KEY = 'concreta.ai.settings';

const PROVIDER_IDS: readonly AiProviderId[] = ['anthropic', 'openai', 'gemini'];

export interface AiSettings {
  provider: AiProviderId;
  keys: Partial<Record<AiProviderId, string>>;
}

/** Key resuelta para el proveedor activo y su procedencia. */
export interface ActiveKey {
  /** La del usuario (trimmed) si la tiene; si no, la compartida; null si ninguna. */
  activeKey: string | null;
  /** true cuando `activeKey` proviene de la clave compartida, no de una propia. */
  usingSharedKey: boolean;
}

function isProviderId(v: unknown): v is AiProviderId {
  return (PROVIDER_IDS as readonly unknown[]).includes(v);
}

// Default = Gemini: trae la clave compartida embebida, así el asistente funciona
// out-of-the-box. Solo afecta a usuarios nuevos; quien tenga settings los conserva.
function defaultSettings(): AiSettings {
  return { provider: 'gemini', keys: {} };
}

/**
 * Parseo defensivo del JSON guardado (`{provider, keys}`): proveedor desconocido
 * → gemini, keys no-string/vacías descartadas, JSON corrupto → defaults.
 */
function parseStored(raw: string | null): AiSettings {
  if (raw === null) return defaultSettings();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultSettings();
    const obj = parsed as Record<string, unknown>;
    const provider: AiProviderId = isProviderId(obj.provider) ? obj.provider : 'gemini';
    const keys: Partial<Record<AiProviderId, string>> = {};
    if (typeof obj.keys === 'object' && obj.keys !== null) {
      const rawKeys = obj.keys as Record<string, unknown>;
      for (const p of PROVIDER_IDS) {
        const k = rawKeys[p];
        if (typeof k === 'string' && k.trim() !== '') keys[p] = k.trim();
      }
    }
    return { provider, keys };
  } catch {
    return defaultSettings(); // JSON corrupto — empezar limpio
  }
}

function readStored(): AiSettings {
  if (typeof window === 'undefined') return defaultSettings();
  try {
    return parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultSettings(); // localStorage no disponible (modo privado, desactivado)
  }
}

function persist(next: AiSettings): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: next.provider, keys: next.keys }));
    }
  } catch {
    // persistencia fallida — el estado de la sesión igualmente se actualiza
  }
}

export interface AiSettingsState extends AiSettings {
  setProvider(p: AiProviderId): void;
  /** Recorta la key; un resultado vacío equivale a clearKey(p). */
  setKey(p: AiProviderId, key: string): void;
  clearKey(p: AiProviderId): void;
}

/**
 * Resuelve la key activa a partir del proveedor, las keys guardadas y la clave
 * compartida. FUNCIÓN PURA (la clave compartida se pasa como argumento) para
 * poder testear la precedencia sin depender del entorno. Regla: la key propia
 * del usuario SIEMPRE gana; si no la tiene, cae a la compartida.
 */
export function resolveActiveKey(
  provider: AiProviderId,
  keys: Partial<Record<AiProviderId, string>>,
  sharedKey: string | null,
): ActiveKey {
  const raw = keys[provider];
  const own = typeof raw === 'string' ? raw.trim() : '';
  const resolved = own !== '' ? own : (sharedKey ?? '');
  return {
    activeKey: resolved === '' ? null : resolved,
    usingSharedKey: own === '' && sharedKey !== null,
  };
}

export const useAiSettings = create<AiSettingsState>((set) => ({
  ...readStored(),

  setProvider: (p) =>
    set((prev) => {
      if (prev.provider === p) return prev;
      const next = { provider: p, keys: prev.keys };
      persist(next);
      return { provider: p };
    }),

  setKey: (p, key) =>
    set((prev) => {
      const trimmed = key.trim();
      const keys = { ...prev.keys };
      if (trimmed === '') {
        if (keys[p] === undefined) return prev;
        delete keys[p];
      } else {
        if (keys[p] === trimmed) return prev;
        keys[p] = trimmed;
      }
      persist({ provider: prev.provider, keys });
      return { keys };
    }),

  clearKey: (p) =>
    set((prev) => {
      if (prev.keys[p] === undefined) return prev;
      const keys = { ...prev.keys };
      delete keys[p];
      persist({ provider: prev.provider, keys });
      return { keys };
    }),
}));

/**
 * Key activa resuelta contra la clave compartida embebida (lee `sharedKeyFor`).
 * Por defecto usa el estado vivo del store; el executor headless la llama sin
 * argumentos. La lógica pura está en `resolveActiveKey`.
 */
export function selectActiveKey(state: AiSettings = useAiSettings.getState()): ActiveKey {
  return resolveActiveKey(state.provider, state.keys, sharedKeyFor(state.provider));
}

// Sincronización entre pestañas: otra pestaña cambió los ajustes → seguirla.
// setState hace merge shallow, así que las acciones del store se conservan.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    useAiSettings.setState(parseStored(e.newValue));
  });
}

/** Reset para tests: vuelve a defaults y limpia el localStorage. */
export function __resetAiSettingsForTests(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  useAiSettings.setState(defaultSettings());
}
