/* ===========================================================================
   EVAL de «Sugerir con IA» del estudio de residuos (E6) — partida → plantilla.
   ---------------------------------------------------------------------------
   Golpea la API REAL de Gemini con la clave de `.env.local`, como el eval del
   asistente. NO determinista y NO en CI (sufijo `.eval.ts`). A mano, al tocar
   el prompt o cambiar de modelo:  npm run eval:ia
   Casos de todo tipo: demoliciones dichas de mil formas, obra nueva, medios,
   transporte y alguna ambigua (varias ya las reconocen las reglas y en la app
   no llegarían a la IA; aquí sirven para ver que la IA dice lo mismo). Cada
   caso admite varias respuestas buenas; lo que no se perdona es inventar un
   residuo en obra nueva. 2026-11-01, gemini-3.1-flash-lite: 18/19, 0
   inventados; falla el picado de enfoscado (no hay plantilla de mortero).
   =========================================================================== */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runJsonTurn } from '../../ai/chat';
import { AI_MODELS } from '../../ai/models';
import { ESQUEMA_IA, SISTEMA_IA, leerRespuestaIa, mensajeIa, type PartidaIa } from './ia';
import { proponerResiduo } from './reglas';

function readLocalKey(): string {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = /^\s*VITE_AI_SHARED_GEMINI_KEY\s*=\s*(.*)$/.exec(line);
      if (m) return m[1]!.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sin .env.local */
  }
  return '';
}
const KEY = readLocalKey();

/** `bien`: respuestas aceptables («noGenera», «noSe» o el id de una plantilla). */
const CASOS: Array<{ title: string; ud: string; desc?: string; bien: string[] }> = [
  { title: 'Picado de enfoscado de mortero de cemento en paramentos verticales', ud: 'm²', bien: ['hormigon', 'solado', 'noSe'] },
  { title: 'Retirada de falso techo continuo de placas de escayola', ud: 'm²', bien: ['yeso'] },
  { title: 'Arranque de carpintería exterior de aluminio con vidrio', ud: 'ud', bien: ['aluminio'] },
  { title: 'Retirada de bañera de chapa esmaltada', ud: 'ud', bien: ['acero', 'sanitarios'] },
  { title: 'Rebaje de terreno con medios mecánicos', ud: 'm³', bien: ['excavacion'] },
  { title: 'Arrancado de moqueta y rodapié de madera', ud: 'm²', bien: ['madera', 'pvc', 'noSe'] },
  { title: 'Eliminación de cubierta de placas onduladas de fibrocemento', ud: 'm²', bien: ['amianto'] },
  { title: 'Fresado de firme de mezcla bituminosa', ud: 'm²', bien: ['bituminoso'] },
  { title: 'Retirada de cableado eléctrico existente', ud: 'm', bien: ['cables'] },
  { title: 'Retirada de bajante de PVC', ud: 'm', bien: ['pvc'] },
  { title: 'Tabique de ladrillo hueco doble de 9 cm', ud: 'm²', desc: 'Formación de tabique con ladrillo cerámico hueco doble recibido con mortero.', bien: ['noGenera'] },
  { title: 'Pintura plástica lisa en paramentos interiores', ud: 'm²', bien: ['noGenera'] },
  { title: 'Hormigón HA-25/B/20/IIa en zapatas', ud: 'm³', bien: ['noGenera'] },
  { title: 'Carga y transporte de escombros a vertedero', ud: 'm³', bien: ['noGenera'] },
  { title: 'Oficial de primera albañilería', ud: 'h', bien: ['noGenera'] },
  { title: 'Andamio tubular homologado, montaje y desmontaje', ud: 'm²', bien: ['noGenera'] },
  { title: 'Desmontaje de puerta de paso para su posterior colocación', ud: 'ud', bien: ['noGenera'] },
  { title: 'Partida alzada de trabajos varios', ud: 'PA', bien: ['noSe', 'noGenera'] },
  { title: 'Saneado de zona afectada por humedades', ud: 'm²', bien: ['noSe', 'yeso', 'hormigon', 'solado'] },
];

describe.skipIf(!KEY)('eval «Sugerir con IA» de residuos (Gemini real)', () => {
  it('clasifica las partidas que las reglas no reconocen', { timeout: 180_000 }, async () => {
    const partidas: PartidaIa[] = CASOS.map((c, i) => ({ id: `c${i}`, code: '——', title: c.title, ud: c.ud, desc: c.desc ?? '' }));
    const reconocidas = CASOS.filter((c) => proponerResiduo({ code: '——', title: c.title, desc: c.desc ?? '', ud: c.ud }) !== null);
    if (reconocidas.length) console.log('Aviso: las reglas ya reconocen', reconocidas.map((c) => c.title));
    const raw = await runJsonTurn('gemini', KEY, {
      system: { stable: SISTEMA_IA, volatile: '' },
      schema: ESQUEMA_IA,
      turns: [{ role: 'user', text: mensajeIa(partidas) }],
    });
    const sugerencias = new Map(leerRespuestaIa(raw, partidas).map((s) => [s.id, s]));
    let aciertos = 0;
    let inventadas = 0;
    console.log(`\nModelo: ${AI_MODELS.gemini}`);
    CASOS.forEach((c, i) => {
      const s = sugerencias.get(`c${i}`);
      const dijo = !s ? '(sin respuesta)' : s.decision === 'plantilla' ? s.plantilla! : s.decision;
      const ok = c.bien.includes(dijo);
      if (ok) aciertos += 1;
      // Lo grave: poner residuo donde lo bueno era «noGenera».
      if (!ok && c.bien.length === 1 && c.bien[0] === 'noGenera' && s?.decision === 'plantilla') inventadas += 1;
      console.log(`${ok ? '✓' : '✗'} ${c.title} → ${dijo}${s ? ` · ${s.motivo}` : ''}`);
    });
    console.log(`\n${aciertos}/${CASOS.length} aciertos · ${inventadas} residuos inventados en obra nueva\n`);
    expect(sugerencias.size).toBe(CASOS.length);
    expect(inventadas).toBe(0);
    expect(aciertos / CASOS.length).toBeGreaterThanOrEqual(0.75);
  });
});
