/* ===========================================================================
   core/id — generación de ids únicos. Una sola fuente para todo el dominio:
   `crypto.randomUUID` cuando existe, con un fallback (tiempo+azar) para entornos
   sin Web Crypto (contextos no seguros, algunos tests). El store la usa con
   prefijo legible (`p-`/`r-`/`m-`…); el registro de obras la usa cruda.

   `conIds` graba los ids que salen mientras corre una función, o los repite:
   el agente graba los de cada operación en su diario y la app, al repetirla
   sobre los cambios del técnico, saca los mismos (docs/plan-agente-carpeta.md
   D4, F4). Como todo id del store pasa por aquí, sirve para cualquier acción.
   =========================================================================== */
function nuevo(): string {
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** La grabación en curso: los ids que repetir y los que han salido. */
let cinta: { previos: string[]; usados: string[] } | null = null;

export function rawUuid(): string {
  if (!cinta) return nuevo();
  const id = cinta.previos.shift() ?? nuevo();
  cinta.usados.push(id);
  return id;
}

/**
 * Ejecuta `fn` grabando los ids que genera. Con `previos`, los primeros ids
 * son esos, en orden (si hacen falta más, salen nuevos; si sobran, se dejan).
 * No se anida: dentro de otra grabación, graba en la de fuera.
 */
export function conIds<T>(
  previos: readonly string[] | undefined,
  fn: () => T,
): { valor: T; ids: string[] } {
  if (cinta) {
    const desde = cinta.usados.length;
    const valor = fn();
    return { valor, ids: cinta.usados.slice(desde) };
  }
  cinta = { previos: [...(previos ?? [])], usados: [] };
  try {
    const valor = fn();
    return { valor, ids: cinta.usados };
  } finally {
    cinta = null;
  }
}
