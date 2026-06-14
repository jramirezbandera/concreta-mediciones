import { useEffect, useState } from 'react';
import { useObraStore } from '../store';

/**
 * `true` durante ~1,2 s tras revelar ESTA partida desde el buscador del
 * presupuesto (`revealPartida`). Alimenta el pulso "aquí está" que distingue la
 * llegada por buscador del `selected` de un click normal. Atado a `revealNonce`
 * (no a la apertura manual): sólo pulsa la fila destino de un salto. La
 * animación se desactiva en `prefers-reduced-motion` desde el CSS.
 */
export function useJustRevealed(partidaId: string): boolean {
  const nonce = useObraStore((s) => s.revealNonce);
  const isTarget = useObraStore((s) => s.openPartidaId === partidaId);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!isTarget || nonce === 0) {
      setOn(false);
      return;
    }
    setOn(true);
    const t = setTimeout(() => setOn(false), 1200);
    return () => clearTimeout(t);
  }, [nonce, isTarget]);
  return on;
}
