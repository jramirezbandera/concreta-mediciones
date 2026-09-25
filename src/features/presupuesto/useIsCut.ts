import { useClipboardStore, useObraStore } from '../../store';

/** ¿Esta línea está cortada (pendiente de moverse) en ESTE documento? Cada
 *  fila o tarjeta se suscribe solo a su propio estado. */
export function useIsCut(partidaId: string, lineId: string): boolean {
  const docToken = useObraStore((s) => s.docToken);
  return useClipboardStore((s) => {
    const c = s.medLines;
    return (
      !!c?.cut &&
      c.source.docToken === docToken &&
      c.source.partidaId === partidaId &&
      c.lines.some((l) => l.id === lineId)
    );
  });
}
