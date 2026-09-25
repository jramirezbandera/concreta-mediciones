import { useEffect, useRef } from 'react';
import { useClipboardStore, useToastStore } from '../store';

/**
 * Aviso «Copiado al portapapeles» tras copiar (o cortar) una partida o líneas
 * de medición (teclado, menú o barra de selección). No pinta nada: lo pasa a
 * `toastStore`, así nunca hay dos avisos a la vez (copiar y enseguida pegar
 * deja solo el último). Se dispara con `copyTick` para reaparecer aunque se
 * recopie lo mismo. Si el TSV no llegó al portapapeles del sistema, el aviso es
 * la advertencia (en Concreta sí; en Excel no).
 */
export function ClipboardToast() {
  const tick = useClipboardStore((s) => s.copyTick);
  // Solo las copias hechas con el aviso montado: el tick de una copia anterior
  // (otra vista, un remontaje) no debe reavisar al montar.
  const mountedTick = useRef(tick);

  useEffect(() => {
    if (tick === mountedTick.current) return;
    const { items, medLines } = useClipboardStore.getState();
    if (medLines?.sysOk === false) {
      useToastStore
        .getState()
        .show(`${medLines.cut ? 'Cortado' : 'Copiado'} en Concreta; no disponible para Excel`, undefined, {
          tone: 'warn',
        });
      return;
    }
    let msg = 'Copiado al portapapeles';
    if (medLines) {
      const n = medLines.lines.length;
      const verbo = medLines.cut ? (n === 1 ? 'línea cortada' : 'líneas cortadas') : n === 1 ? 'línea copiada' : 'líneas copiadas';
      msg = `${n} ${verbo} · ${medLines.source.code || 'partida'}`;
    } else if (items?.[0]?.partida.code) {
      msg = `${items[0].partida.code} copiada al portapapeles`;
    }
    useToastStore.getState().show(msg);
  }, [tick]);

  return null;
}
