/**
 * ¿Dispositivo solo táctil (el puntero principal es un dedo, sin ratón ni
 * trackpad)? Ahí no aplican los atajos de teclado ni el «arrastra y suelta», así
 * que los textos que los mencionan cambian por su equivalente táctil.
 *
 * Se evalúa al pintar: el tipo de puntero no cambia en mitad de la sesión. Sin
 * `matchMedia` (jsdom) → false: se quedan los textos de escritorio.
 */
export function isTouchOnly(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
}
