/* ===========================================================================
   Plan de control con una obra real (plan, «Validación con obras reales» e
   hito de E4): el presupuesto de la vivienda unifamiliar de ejemplo
   (`obra ejemplo.bc3`, Presto) pasa por la app, con todas las propuestas de
   las reglas confirmadas, y el plan explica la diferencia con lo que se
   entregó: su capítulo «Control de calidad» son tres pruebas de servicio de
   Precio Centro (283,69 €, 0,06 % del PEM) y ningún ensayo de hormigón ni de
   acero (D-ejemplos, hallazgo 2; K-PCC.53, K-PCC.61).

   El .bc3 es de un cliente: vive en `docs/spike/samples/`, fuera de git; sin
   él la prueba se salta. Las cifras de la obra no van al repo: solo lo que
   tiene que cumplir el plan.
   =========================================================================== */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bc3ToObra } from '../bc3import';
import { calcularPlanCalidad } from './calculo';
import { capituloControlPropuesto, enCapituloControl, planVacio } from './datos';
import { estadoTrasConfirmar, huellaDe, proponerControl } from './reglas';

const OBRA = resolve(process.cwd(), 'docs', 'spike', 'samples', 'obra ejemplo.bc3');

describe.skipIf(!existsSync(OBRA))('plan de control con una obra real (docs/spike/samples/)', () => {
  it('obra ejemplo: el plan cuenta ensayos de hormigón y explica por qué el capítulo entregado se queda corto', () => {
    const { data } = bc3ToObra(new Uint8Array(readFileSync(OBRA)));
    const capituloControl = capituloControlPropuesto(data.chapters);
    for (const ch of data.chapters)
      for (const p of data.partidas[ch.id] ?? []) {
        const c = proponerControl(p, { banco: data.recursos, enCapituloControl: enCapituloControl(data.chapters, capituloControl, ch.id, p) });
        if (!c) continue;
        const estado = c.estado === 'propuesta' ? estadoTrasConfirmar(c) : c.estado;
        p.pcc = { ...c, estado, ...(estado === 'confirmada' ? { huella: huellaDe(p) } : {}) };
      }
    const plan = planVacio({ capituloControl, comunidad: 'andalucia', uso: 'vivienda', unifamiliar: true, fecha: '2026-10-26' });
    const r = calcularPlanCalidad({ chapters: data.chapters, partidas: data.partidas, banco: data.recursos, rates: data.rates, obra: data.obra, plan, hoy: '2026-10-26' });
    // K-PCC.53: hormigón estructural ⇒ ensayos de hormigón, con su número.
    expect(r.estructura.totales.amasadas).toBeGreaterThan(0);
    expect(r.valoracion.find((v) => v.ensayo === 'j03-008')?.precios).toBe(r.estructura.totales.amasadas);
    // El capítulo entregado: enlazado por su título, ninguna de sus partidas es un ensayo del plan…
    const cap = r.capitulo!;
    expect(cap).not.toBeNull();
    expect(cap.partidas.length).toBeGreaterThan(0);
    expect(cap.partidas.every((x) => x.ensayo == null)).toBe(true);
    const ids = r.avisos.map((a) => a.id);
    for (const x of cap.partidas) expect(ids).toContain(`capitulo:sinEnsayo:${x.partidaId}`);
    // …le faltan los ensayos de hormigón, y queda por debajo del nivel 1 de sus familias (plan pobre).
    expect(ids).toContain('capitulo:sinPartida:j03-008');
    expect(ids).toContain('planPobre');
    expect(cap.importe).toBeLessThan(cap.minimoNivel1);
  });
});
