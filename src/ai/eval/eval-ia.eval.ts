/* ===========================================================================
   Harness de EVAL del prompt (F-A3, T4) — frase de obra → ops esperadas.
   ---------------------------------------------------------------------------
   Golpea la API REAL de Gemini con la clave de `.env.local` y comprueba que
   `gemini-3.1-flash-lite` emite las operaciones correctas para frases reales de
   obra. NO determinista, NO en CI (por eso el sufijo `.eval.ts`, que la suite
   normal no coge, y su propia config `vitest.eval.config.ts`).

   Se ejecuta A MANO cuando se toca el prompt o se cambia de modelo:
     npm run eval:ia
   El fichero de casos (`casos.json`) crece con lo que falle en dogfood.
   =========================================================================== */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import casos from './casos.json';
import { buildObraSnapshot, type ObraSnapshotInput } from '../snapshot';
import { buildChatSystem } from '../prompt';
import { CHAT_ENVELOPE_SCHEMA } from '../schema';
import { runChatTurn } from '../chat';
import { applyProposals, currentSeal, planTurn } from '../executor';
import type { Operation } from '../ops';
import { blankObraData, useObraStore } from '../../store';
import type { Chapter, MedLine, Partida } from '../../core/types';

/** Lee VITE_AI_SHARED_GEMINI_KEY de `.env.local` (no de import.meta.env: en modo
 *  test `.env.test` la vacía). '' si no hay fichero o clave. */
function readLocalKey(): string {
  try {
    const raw = readFileSync('.env.local', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*VITE_AI_SHARED_GEMINI_KEY\s*=\s*(.*)$/.exec(line);
      if (m) return m[1]!.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sin .env.local */
  }
  return '';
}

const KEY = readLocalKey();

const line = (o: Partial<MedLine>): MedLine => ({ id: `m-${o.uds ?? 0}-${o.largo ?? 0}`, comment: '', uds: '', largo: '', ancho: '', alto: '', ...o });
const partida = (o: Partial<Partida> & Pick<Partida, 'id' | 'pos'>): Partida => ({
  code: '——', title: 'P', ud: 'ud', precio: 0, desc: '', med: [], items: [], ...o,
});

const CHAPTERS: Chapter[] = [
  { id: 'c1', code: '1', title: 'Movimiento de tierras', children: [] },
  { id: 'c2', code: '2', title: 'Cimentaciones', children: [] },
];
const partidas = (): Record<string, Partida[]> => ({
  c1: [
    partida({ id: 'p1', pos: '1.1', code: 'ADE010', title: 'Excavación en zanjas', ud: 'm³', precio: 18.5, med: [line({ uds: 4, largo: 2, ancho: 1 })] }),
    partida({ id: 'p2', pos: '1.2', code: 'ADR010', title: 'Relleno y compactación', ud: 'm³', precio: 9.2, med: [line({ uds: 10 })] }),
  ],
  c2: [],
});

const snapshotInput = (): ObraSnapshotInput => ({
  obra: { denominacion: 'Vivienda unifamiliar', localidad: 'Málaga' },
  chapters: structuredClone(CHAPTERS),
  partidas: partidas(),
  certs: [{ id: 'ce1', num: 1, period: 'junio 2026', retencion: 0, data: {} }],
  rates: { coefK: 1, iva: 0.21, gg: 0.13, bi: 0.06 },
  view: 'presupuesto',
  active: 'c1',
  openPartidaId: 'p1',
  curCert: 0,
});

function seedStore(): void {
  useObraStore.setState({ ...blankObraData(), chapters: structuredClone(CHAPTERS), partidas: partidas(), active: 'c1', openPartidaId: 'p1', curCert: 0 });
}

interface Expect {
  op: string;
  ref?: string;
  ud?: string;
  campo?: string;
  indice?: number;
  valor?: number;
  precio?: number;
  modo?: string;
  ambito?: string;
  linea?: { uds?: number; largo?: number; ancho?: number; alto?: number };
  /** Producto de las dimensiones de la 1ª línea (invariante robusto al reparto de
   *  slots: "5 por 4" puede ir a largo·ancho o uds·largo, pero el parcial es 20). */
  parcial?: number;
}
const approx = (a: unknown, b: number): boolean => typeof a === 'number' && Math.abs(a - b) < 0.01;
/** Normaliza una unidad para comparar: el modelo escribe "m2"/"m²", "m3"/"m³"
 *  indistintamente y ambas son válidas en la app (funcionalmente equivalentes). */
const normUd = (u: unknown): string => String(u ?? '').trim().toLowerCase().replace(/²/g, '2').replace(/³/g, '3');
/** Factor de una dimensión cruda (ausente/vacía = 1), como `core/medicion`. */
const dimFactor = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 1);

/** Comprueba que `ops` contiene la op esperada con sus campos clave. */
function check(ops: Operation[], exp: Expect): { ok: boolean; msg: string } {
  if (exp.op === 'ninguna') {
    return { ok: ops.length === 0, msg: `esperaba SIN ops, salió: ${JSON.stringify(ops)}` };
  }
  const op = ops.find((o) => o.op === exp.op) as Record<string, unknown> | undefined;
  if (!op) return { ok: false, msg: `no emitió ${exp.op}; ops = ${JSON.stringify(ops)}` };
  const fail = (m: string) => ({ ok: false, msg: `${m} · op = ${JSON.stringify(op)}` });
  if (exp.ref !== undefined && op.ref !== exp.ref) return fail(`ref ${JSON.stringify(op.ref)} ≠ ${exp.ref}`);
  if (exp.ud !== undefined && normUd(op.ud) !== normUd(exp.ud)) return fail(`ud ${JSON.stringify(op.ud)} ≠ ${exp.ud}`);
  if (exp.campo !== undefined && op.campo !== exp.campo) return fail(`campo ${JSON.stringify(op.campo)} ≠ ${exp.campo}`);
  if (exp.indice !== undefined && op.indice !== exp.indice) return fail(`indice ${JSON.stringify(op.indice)} ≠ ${exp.indice}`);
  if (exp.valor !== undefined && !approx(op.valor, exp.valor)) return fail(`valor ${JSON.stringify(op.valor)} ≠ ${exp.valor}`);
  if (exp.precio !== undefined && !approx(op.precio, exp.precio)) return fail(`precio ${JSON.stringify(op.precio)} ≠ ${exp.precio}`);
  if (exp.modo !== undefined && op.modo !== exp.modo) return fail(`modo ${JSON.stringify(op.modo)} ≠ ${exp.modo}`);
  if (exp.ambito !== undefined && op.ambito !== exp.ambito) return fail(`ambito ${JSON.stringify(op.ambito)} ≠ ${exp.ambito}`);
  if (exp.linea) {
    const l = (op.lineas as Record<string, unknown>[] | undefined)?.[0];
    if (!l) return fail('sin línea inline');
    for (const [k, v] of Object.entries(exp.linea)) {
      if (!approx(l[k], v as number)) return fail(`línea.${k} ${JSON.stringify(l[k])} ≠ ${v}`);
    }
  }
  if (exp.parcial !== undefined) {
    const l = (op.lineas as Record<string, unknown>[] | undefined)?.[0];
    if (!l) return fail('sin línea inline');
    const p = dimFactor(l.uds) * dimFactor(l.largo) * dimFactor(l.ancho) * dimFactor(l.alto);
    if (!approx(p, exp.parcial)) return fail(`parcial ${p} ≠ ${exp.parcial}`);
  }
  return { ok: true, msg: '' };
}

const results: { id: string; ok: boolean }[] = [];

describe.skipIf(!KEY)('eval:ia — frase de obra → ops (Gemini real)', () => {
  for (const caso of casos as { id: string; prompt: string; expect: Expect }[]) {
    it(`${caso.id}: ${caso.prompt}`, async () => {
      const snap = buildObraSnapshot(snapshotInput());
      const system = buildChatSystem(snap);
      const env = await runChatTurn(KEY, { system, schema: CHAT_ENVELOPE_SCHEMA, turns: [{ role: 'user', text: caso.prompt }] });
      const ops = env.ops ?? [];

      // Sanidad de integración: las ops de acción se aplican sobre el store real.
      let execNote = '';
      if (ops.length && caso.expect.op !== 'ninguna') {
        seedStore();
        const plan = planTurn(ops, currentSeal());
        if (plan.proposals.length) applyProposals(plan.proposals, currentSeal());
        execNote = ` | exec: ${plan.applied.length} aplicadas, ${plan.proposals.length} propuestas, ${plan.notFound.length} no-encontradas`;
      }

      const res = check(ops, caso.expect);
      results.push({ id: caso.id, ok: res.ok });
      console.log(`[${res.ok ? 'OK ' : 'XX '}] ${caso.id} → reply="${env.reply.slice(0, 60)}" ops=${JSON.stringify(ops)}${execNote}${res.ok ? '' : `\n        ${res.msg}`}`);
      if (env.discarded.length) console.log(`        descartadas: ${JSON.stringify(env.discarded)}`);

      expect(res.ok, res.msg).toBe(true);
      // Pausa breve para no saturar el rate limit del free tier compartido.
      await new Promise((r) => setTimeout(r, 600));
    });
  }

  it('resumen', () => {
    const hits = results.filter((r) => r.ok).length;
    console.log(`\n=== EVAL: ${hits}/${results.length} aciertos ===`);
  });
});

if (!KEY) {
  console.warn('[eval:ia] Sin VITE_AI_SHARED_GEMINI_KEY en .env.local → eval OMITIDA.');
}
