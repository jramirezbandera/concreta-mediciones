/* ===========================================================================
   features/planos/flag — interruptor en tiempo de ejecución del visor de planos
   (§5.9). Terminada la Etapa A1, encendido por defecto también en producción:
     · `?planos=0` lo apaga y `?planos=1` lo vuelve a encender (y se recuerda en
       `localStorage['concreta.planos']`);
     · sin nada, encendido.
   El lector y el escritor v6 NO van detrás del interruptor: solo la interfaz
   (botón «Planos», visor y marcador de origen en las líneas).
   =========================================================================== */

const CLAVE = 'concreta.planos';

function leer(): boolean {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('planos');
    if (q === '1' || q === '0') {
      try {
        globalThis.localStorage?.setItem(CLAVE, q);
      } catch {
        // almacenamiento bloqueado: vale para esta carga
      }
      return q === '1';
    }
    const guardado = globalThis.localStorage?.getItem(CLAVE);
    if (guardado === '1' || guardado === '0') return guardado === '1';
  } catch {
    // sin location o sin localStorage
  }
  return true;
}

let activo = leer();

/** ¿Está encendido el visor de planos en esta carga? */
export function planosActivos(): boolean {
  return activo;
}

/** Tests: fuerza el interruptor. */
export function __setPlanosActivosForTests(v: boolean): void {
  activo = v;
}
