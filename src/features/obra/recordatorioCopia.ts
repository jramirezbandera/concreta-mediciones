/* ===========================================================================
   recordatorioCopia — «Última copia descargada: hace N días» (Etapa 0, P1 de
   TODOS «Que la obra no pueda perderse»). La fecha es `ObraMeta.ultimaCopia`:
   la sella cada descarga de la copia .json (`persist.descargarCopia`). Aquí
   solo se decide qué decir y cuándo enseñarlo fuera del modal de obra.
   =========================================================================== */
import { useEffect, useState } from 'react';
import { usePersistStore, useSessionStore, type Durability } from '../../persist';

/** Pasados estos días sin copia se recuerda aunque el navegador no vaya a borrar
 *  las obras: tampoco las salva de un equipo roto o perdido. */
export const DIAS_AVISO_COPIA = 7;
const DIA_MS = 86_400_000;

/** Días enteros desde la última copia. `null` = nunca (o fecha ilegible). */
export function diasDesdeCopia(ultimaCopia: unknown, now: number): number | null {
  if (typeof ultimaCopia !== 'string') return null;
  const t = Date.parse(ultimaCopia);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / DIA_MS));
}

/** «Descargada» y no «hecha»: el navegador no confirma que el fichero se guardó. */
export function textoUltimaCopia(dias: number | null): string {
  if (dias === null) return 'Aún no has hecho ninguna copia';
  if (dias === 0) return 'Última copia descargada: hoy';
  if (dias === 1) return 'Última copia descargada: ayer';
  return `Última copia descargada: hace ${dias} días`;
}

/** ¿Hace falta copia? Nunca hecha, o más de `DIAS_AVISO_COPIA` días. */
export function copiaVencida(dias: number | null): boolean {
  return dias === null || dias > DIAS_AVISO_COPIA;
}

/** ¿Se enseña fuera del modal de obra? Siempre que el navegador pueda borrar las
 *  obras por su cuenta; si no (o aún no se sabe), solo con la copia vencida. */
export function mostrarRecordatorio(dias: number | null, durability: Durability): boolean {
  return durability === 'best-effort' || durability === 'unsupported' || copiaVencida(dias);
}

/** Reloj que avanza cada hora: una pestaña abierta días seguidos no se queda
 *  con el «hace N días» de cuando se abrió. */
function useHora(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 3_600_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export interface EstadoCopia {
  /** Hay obra guardada en pantalla (la demo sin editar no tiene nada que copiar). */
  registrada: boolean;
  dias: number | null;
  texto: string;
  vencida: boolean;
  /** Se enseña fuera del modal de obra (barra superior o menú «Más»). */
  visible: boolean;
}

/** Estado del recordatorio de copia de la obra en pantalla. */
export function useEstadoCopia(): EstadoCopia {
  const registrada = useSessionStore((s) => s.obras.some((o) => o.id === s.activeId));
  const ultimaCopia = useSessionStore((s) => s.obras.find((o) => o.id === s.activeId)?.ultimaCopia);
  const durability = usePersistStore((s) => s.durability);
  const now = useHora();
  const dias = diasDesdeCopia(ultimaCopia, now);
  return {
    registrada,
    dias,
    texto: textoUltimaCopia(dias),
    vencida: copiaVencida(dias),
    visible: registrada && mostrarRecordatorio(dias, durability),
  };
}
