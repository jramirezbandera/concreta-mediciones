/* ===========================================================================
   core/id — generación de ids únicos. Una sola fuente para todo el dominio:
   `crypto.randomUUID` cuando existe, con un fallback (tiempo+azar) para entornos
   sin Web Crypto (contextos no seguros, algunos tests). El store la usa con
   prefijo legible (`p-`/`r-`/`m-`…); el registro de obras la usa cruda.
   =========================================================================== */
export function rawUuid(): string {
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
