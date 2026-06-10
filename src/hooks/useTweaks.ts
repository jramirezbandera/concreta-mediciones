import { useCallback, useState } from 'react';

/**
 * Preferencias de UI persistidas (panel dev opcional). Reemplaza el
 * `useTweaks` del prototipo —que hablaba con el host de Omelette por
 * postMessage— por una versión local-first respaldada en localStorage.
 *
 * El tema y el acento NO viven aquí (los gestiona `useTheme`, fuente única);
 * este hook cubre ajustes de presentación: densidad, dot-grid, barras, etc.
 */
export function useTweaks<T extends Record<string, unknown>>(
  storageKey: string,
  defaults: T,
): [T, (keyOrEdits: keyof T | Partial<T>, value?: T[keyof T]) => void] {
  const [values, setValues] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      /* localStorage no disponible o JSON corrupto */
    }
    return defaults;
  });

  const setTweak = useCallback(
    (keyOrEdits: keyof T | Partial<T>, value?: T[keyof T]) => {
      const edits: Partial<T> =
        typeof keyOrEdits === 'object' && keyOrEdits !== null
          ? keyOrEdits
          : ({ [keyOrEdits]: value } as Partial<T>);
      setValues((prev) => {
        const next = { ...prev, ...edits };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* noop */
        }
        return next;
      });
    },
    [storageKey],
  );

  return [values, setTweak];
}
