/* ===========================================================================
   core/rcd/ia — «Sugerir con IA» del estudio de residuos (E6, decisión D15).

   · Solo se pregunta por las partidas SIN asignar (las reglas no las
     reconocieron): título, unidad, código y el principio de la descripción.
   · La IA elige, por partida, una PLANTILLA de una lista cerrada
     (`PLANTILLAS_IA`), «no genera» o «no lo sé», y da un motivo corto. El
     código LER, la densidad y la conversión los pone la plantilla: la IA nunca
     escribe un código (lección del commit 8136865).
   · Todo sale como `propuesta` con `origen.tipo: 'ia'`: no suma hasta que el
     técnico lo confirma.
   · Puro: el prompt, el esquema y la lectura de la respuesta. La llamada al
     proveedor vive en la vista (`features/residuos/sugerirIa`).
   =========================================================================== */
import type { Partida, PartidasMap } from '../types';
import { PLANTILLAS_IA, proponerConPlantilla } from './reglas';
import type { ResiduoPartida } from './tipos';

/** Partidas por petición: cabe de sobra en el contexto y el error de una no tumba todo. */
export const LOTE_IA = 80;
/** Lo que se manda de la descripción: el principio dice qué es; el resto es pliego. */
const MAX_DESC = 240;

export interface PartidaIa {
  id: string;
  code: string;
  title: string;
  ud: string;
  desc: string;
}

/** Partidas que la IA puede sugerir: las que no tienen residuo asignado. */
export function partidasParaIa(partidas: PartidasMap): PartidaIa[] {
  return Object.values(partidas)
    .flat()
    .filter((p): p is Partida => Boolean(p) && !p.rcd)
    .map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      ud: p.ud,
      desc: p.desc.length > MAX_DESC ? `${p.desc.slice(0, MAX_DESC)}…` : p.desc,
    }));
}

export type DecisionIa = 'plantilla' | 'noGenera' | 'noSe';

/** Respuesta de la IA por partida, ya validada. */
export interface SugerenciaIa {
  id: string;
  decision: DecisionIa;
  plantilla: string | null;
  motivo: string;
}

/** Valor de `plantilla` cuando no aplica (un `enum` con `null` no lo admiten todos los proveedores). */
const SIN_PLANTILLA = 'ninguna';

/** Esquema cerrado de la respuesta (Gemini lo toma tal cual; OpenAI lo convierte). */
export const ESQUEMA_IA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['partidas'],
  properties: {
    partidas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'decision', 'plantilla', 'motivo'],
        properties: {
          id: { type: 'string', description: 'El id de la partida, tal como llega.' },
          decision: {
            type: 'string',
            enum: ['plantilla', 'noGenera', 'noSe'],
            description: 'plantilla = genera el residuo de una plantilla; noGenera = no da residuo; noSe = no está claro.',
          },
          plantilla: {
            type: 'string',
            enum: [...PLANTILLAS_IA.map((x) => x.id), SIN_PLANTILLA],
            description: `Solo con decision = plantilla; si no, «${SIN_PLANTILLA}».`,
          },
          motivo: { type: 'string', description: 'Por qué, en una frase corta en español.' },
        },
      },
    },
  },
};

/** Instrucciones fijas (bloque cacheable). */
export const SISTEMA_IA = [
  'Eres un técnico que redacta el estudio de gestión de residuos de construcción y demolición (RD 105/2008) de una obra en España.',
  'Para cada partida del presupuesto decides qué residuo genera POR SÍ MISMA. Responde solo con el JSON del esquema, una entrada por partida y con su id.',
  '',
  'Cómo decidir:',
  '- Demoliciones, levantados, desmontajes y picados que producen escombro: decision «plantilla» con la del material que se retira.',
  '- Excavaciones, vaciados, zanjas y pozos: plantilla «excavacion».',
  '- Obra nueva (colocar, ejecutar, suministrar, montar), mano de obra, medios auxiliares, seguridad y salud, ensayos, transporte o carga de escombros y gestión de residuos: «noGenera». El residuo de la obra nueva se estima aparte por superficie construida, y el transporte solo mueve lo que ya generan las demoliciones.',
  '- Desmontar para volver a colocar: «noGenera».',
  '- Si la partida es ambigua o no sabes qué material sale: «noSe». Es mejor «noSe» que adivinar.',
  '- Si una demolición retira varios materiales, elige el principal.',
  '',
  'Plantillas (id: residuo):',
  ...PLANTILLAS_IA.map((x) => `- ${x.id}: ${x.motivo}`),
].join('\n');

/** Bloque variable: las partidas de este lote. */
export function mensajeIa(partidas: PartidaIa[]): string {
  return `Partidas:\n${JSON.stringify(partidas.map((p) => ({ id: p.id, codigo: p.code, titulo: p.title, ud: p.ud, descripcion: p.desc })))}`;
}

const IDS_PLANTILLA = new Set(PLANTILLAS_IA.map((x) => x.id));

/**
 * Lee la respuesta cruda: se queda con las entradas de partidas que se
 * preguntaron, con decisión y plantilla válidas. Lo demás se descarta en
 * silencio (una entrada rota no tumba el lote).
 */
export function leerRespuestaIa(raw: unknown, preguntadas: readonly PartidaIa[]): SugerenciaIa[] {
  const ids = new Set(preguntadas.map((p) => p.id));
  const lista = raw && typeof raw === 'object' ? (raw as { partidas?: unknown }).partidas : undefined;
  if (!Array.isArray(lista)) return [];
  const vistas = new Set<string>();
  const out: SugerenciaIa[] = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') continue;
    const { id, decision, plantilla, motivo } = x as Record<string, unknown>;
    if (typeof id !== 'string' || !ids.has(id) || vistas.has(id)) continue;
    if (decision !== 'plantilla' && decision !== 'noGenera' && decision !== 'noSe') continue;
    if (decision === 'plantilla' && (typeof plantilla !== 'string' || !IDS_PLANTILLA.has(plantilla))) continue;
    vistas.add(id);
    out.push({
      id,
      decision,
      plantilla: decision === 'plantilla' ? (plantilla as string) : null,
      motivo: typeof motivo === 'string' && motivo.trim() ? motivo.trim().slice(0, 200) : 'Sugerido por la IA',
    });
  }
  return out;
}

/**
 * Residuos propuestos a partir de las sugerencias. «noSe» no propone nada (la
 * partida sigue sin asignar). `modelo` queda en el origen, para saber de dónde
 * salió.
 */
export function propuestasIa(
  sugerencias: readonly SugerenciaIa[],
  partidas: PartidasMap,
  modelo: string,
): Map<string, ResiduoPartida> {
  const porId = new Map(
    Object.values(partidas)
      .flat()
      .map((p) => [p.id, p]),
  );
  const out = new Map<string, ResiduoPartida>();
  for (const s of sugerencias) {
    const p = porId.get(s.id);
    if (!p || p.rcd || s.decision === 'noSe') continue;
    const origen = { tipo: 'ia' as const, ref: modelo, motivo: s.motivo };
    if (s.decision === 'noGenera') {
      out.set(s.id, { estado: 'propuesta', origen, componentes: [] });
      continue;
    }
    const r = proponerConPlantilla(p, s.plantilla!, origen);
    if (r) out.set(s.id, r);
  }
  return out;
}
