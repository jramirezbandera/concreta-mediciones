import { useEffect, useState } from 'react';
import { useCarpetaStore } from '../persist/carpeta';

/**
 * ¿Acaba de cambiar fuera esta partida (en el fichero de su carpeta, el agente)?
 * true durante el resaltado (`RESALTE_MS`) tras aplicarse el cambio. Solo se
 * repinta la fila cuando entra o sale de la lista, no en cada cambio de otras.
 */
export function useCambiadaFuera(partidaId: string): boolean {
  const hasta = useCarpetaStore((s) => (s.resaltadas.ids.has(partidaId) ? s.resaltadas.hasta : 0));
  const [on, setOn] = useState(false);
  useEffect(() => {
    const queda = hasta - Date.now();
    if (queda <= 0) {
      setOn(false);
      return;
    }
    setOn(true);
    const t = setTimeout(() => setOn(false), queda);
    return () => clearTimeout(t);
  }, [hasta]);
  return on;
}
