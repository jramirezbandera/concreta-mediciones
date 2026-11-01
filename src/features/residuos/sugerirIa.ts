/* ===========================================================================
   features/residuos/sugerirIa — «Sugerir con IA» (E6, D15): pregunta por las
   partidas sin asignar en lotes, con el esquema cerrado de `core/rcd/ia`, y
   deja las respuestas como propuestas (un paso de Deshacer).
   =========================================================================== */
// Módulos concretos, no el barrel `ai/`: ese arrastra el proveedor y el ejecutor del chat.
import { AI_MODELS } from '../../ai/models';
import { selectActiveKey, useAiSettings } from '../../ai/settingsStore';
import { AI_ERROR_MESSAGES, AiError } from '../../ai/types';
import { LOTE_IA, ESQUEMA_IA, SISTEMA_IA, leerRespuestaIa, mensajeIa, partidasParaIa, propuestasIa, type SugerenciaIa } from '../../core/rcd/ia';
import { useObraStore } from '../../store';

export interface ResultadoIa {
  /** Partidas por las que se preguntó. */
  preguntadas: number;
  /** Propuestas que quedaron puestas. */
  propuestas: number;
  /** De ellas, «no genera». */
  noGenera: number;
  /** Las que la IA no supo (siguen sin asignar). */
  noSe: number;
  /** Lotes que fallaron y el porqué del primero (las demás propuestas sí entran). */
  fallos: number;
  error?: string;
}

export class SinClaveIa extends Error {
  constructor() {
    super('Falta la clave de la IA: ponla en los ajustes del asistente.');
    this.name = 'SinClaveIa';
  }
}

export async function sugerirResiduosIa(signal?: AbortSignal): Promise<ResultadoIa> {
  const { activeKey } = selectActiveKey();
  if (!activeKey) throw new SinClaveIa();
  const provider = useAiSettings.getState().provider;
  const { runJsonTurn } = await import('../../ai/chat');
  const todas = partidasParaIa(useObraStore.getState().partidas);
  const sugerencias: SugerenciaIa[] = [];
  let fallos = 0;
  let error: string | undefined;
  for (let i = 0; i < todas.length; i += LOTE_IA) {
    const lote = todas.slice(i, i + LOTE_IA);
    try {
      const raw = await runJsonTurn(provider, activeKey, {
        system: { stable: SISTEMA_IA, volatile: '' },
        schema: ESQUEMA_IA,
        turns: [{ role: 'user', text: mensajeIa(lote) }],
        cacheKey: 'rcd-sugerir',
        signal,
      });
      sugerencias.push(...leerRespuestaIa(raw, lote));
    } catch (e) {
      if (e instanceof AiError && e.kind === 'aborted') throw e;
      fallos += 1;
      error ??= e instanceof AiError ? AI_ERROR_MESSAGES[e.kind] : 'Error inesperado.';
    }
  }
  const s = useObraStore.getState();
  const propuestas = propuestasIa(sugerencias, s.partidas, AI_MODELS[provider]);
  const puestas = s.aplicarSugerenciasIa(Object.fromEntries(propuestas));
  const noGenera = [...propuestas.values()].filter((r) => r.componentes.length === 0).length;
  return {
    preguntadas: todas.length,
    propuestas: puestas,
    noGenera: Math.min(noGenera, puestas),
    noSe: sugerencias.filter((x) => x.decision === 'noSe').length,
    fallos,
    ...(error && { error }),
  };
}
