/* ===========================================================================
   core/reusar — reaprovechar lo que no cambia entre dos versiones de un dato.
   ---------------------------------------------------------------------------
   Cuando la obra llega de fuera (el fichero de su carpeta, que cambió un agente),
   viene entera, con objetos nuevos aunque casi todo sea igual. `reusar(viejo,
   nuevo)` devuelve `nuevo` pero con las ramas IGUALES sustituidas por las del
   `viejo`: lo que no cambió conserva su referencia, así que los selectores
   memoizados y los componentes de esas filas no se vuelven a calcular ni a pintar
   (docs/plan-agente-carpeta.md D3), y el historial de deshacer solo retiene lo
   que cambió (structural sharing, como immer).

   Igualdad por contenido (la de JSON: claves y valores, sin importar el orden de
   las claves). `undefined` en una clave equivale a no tenerla.
   =========================================================================== */

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** `nuevo`, con las ramas iguales a las de `viejo` tomadas de `viejo`. */
export function reusar<T>(viejo: unknown, nuevo: T): T {
  return paso(viejo, nuevo).valor as T;
}

/** Devuelve el valor a usar y si es el `viejo` (igual entero). */
function paso(viejo: unknown, nuevo: unknown): { valor: unknown; igual: boolean } {
  if (Object.is(viejo, nuevo)) return { valor: viejo, igual: true };
  if (Array.isArray(viejo) && Array.isArray(nuevo)) {
    let igual = viejo.length === nuevo.length;
    const out = nuevo.map((n, i) => {
      const r = paso(viejo[i], n);
      if (!r.igual) igual = false;
      return r.valor;
    });
    return igual ? { valor: viejo, igual: true } : { valor: out, igual: false };
  }
  if (esObjeto(viejo) && esObjeto(nuevo)) {
    const claves = Object.keys(nuevo).filter((k) => nuevo[k] !== undefined);
    const clavesViejas = Object.keys(viejo).filter((k) => viejo[k] !== undefined);
    let igual = claves.length === clavesViejas.length;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(nuevo)) {
      const r = paso(viejo[k], nuevo[k]);
      if (!r.igual) igual = false;
      out[k] = r.valor;
    }
    return igual ? { valor: viejo, igual: true } : { valor: out, igual: false };
  }
  return { valor: nuevo, igual: false };
}
