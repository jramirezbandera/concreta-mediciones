/* Textos del visor de planos que comparten varios componentes (§7.2). */
import { fmtNum } from '../../core/money';
import type { AvisoCalibrar } from '../../core/planoCiclo';
import { nombreConRevision } from '../../core/planoRevision';
import type { PlanoMeta } from '../../core/types';

/** «1:5 000 000», «1:63,5». */
export function textoEscala(n: number): string {
  return `1:${n.toLocaleString('es-ES', { maximumFractionDigits: 1 }).replace(/\./g, ' ')}`;
}

const pct = (f: number) => `${fmtNum(f * 100, 1)} %`;

export function textoAvisoCalibrar(a: AvisoCalibrar): string {
  switch (a.tipo) {
    case 'faltan-puntos':
      return 'Marca los dos extremos de la cota.';
    case 'metros':
      return 'Escribe la distancia real en metros.';
    case 'corta':
      return `Acerca el zoom o elige una cota más larga: esta mide ${fmtNum(a.px, 0)} px en pantalla y la precisión sería ±${pct(a.precision)}.`;
    case 'desviacion':
      return `Desviación ${pct(a.valor)}: la calibración no cuadra con la comprobación.`;
    case 'plausibilidad':
      return a.clase === 'fuera'
        ? `${textoEscala(a.n)} no parece la escala de un plano: ¿la cota está en metros?`
        : `${textoEscala(a.n)} no es una escala habitual: ¿el PDF se imprimió ajustado a la página? Si la cota es correcta, sigue.`;
  }
}

/** «?» de los mensajes de calibración, «no encaja» y «PDF no idéntico» (§7.2):
 *  abre el Centro de Ayuda en sus funcionalidades («Medir sobre planos»). */
export function abrirAyudaPlanos(): void {
  window.dispatchEvent(new CustomEvent('concreta:ayuda', { detail: 'funcionalidades' }));
}

/** ¿Es el fallo de cargar un chunk (versión nueva publicada, red caída)? */
export function esFalloDeChunk(e: unknown): boolean {
  const msg = `${(e as Error)?.name ?? ''} ${(e as Error)?.message ?? e}`;
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|module script/i.test(msg);
}

/** [A1] El aviso de una revisión recién adjunta (§9.3). */
export function textoRevisionAdjunta(revision: string, viejo: Pick<PlanoMeta, 'nombre' | 'revision'>): string {
  return `${revision} adjunta: calibra sus páginas para medir. «${nombreConRevision(viejo)}» conserva sus líneas.`;
}

/** [A1] El aviso de «Usar este PDF para este plano» (§9.3). */
export function textoReenlazado(lineas: number, calibradas: number): string {
  const l = lineas ? `: ${lineas} ${lineas === 1 ? 'línea conserva' : 'líneas conservan'} sus números` : '';
  const c = calibradas
    ? ` Comprueba ${calibradas === 1 ? 'la escala de su página calibrada' : `la escala de sus ${calibradas} páginas calibradas`} con otra cota antes de medir.`
    : '';
  return `Plano reenlazado${l}.${c}`;
}
