/* ===========================================================================
   core/pcc/emitido — lo que salió en el Word, para saber qué se entregó
   aunque cambien las tablas, el motor o el presupuesto (O5, §12 del plan).

   Al exportar se guarda `planCalidad.emitido` (versiones, filas de la
   valoración y totales). Al reabrir, si el cálculo de hoy difiere, el plan
   avisa con las filas que cambian; no cambia nada solo. «Recalcular» da por
   buenas las diferencias (un paso de Deshacer).
   =========================================================================== */
import { fmtCents, fmtNum } from '../money';
import type { DiferenciaEmitido, PlanCalidad, PlanEmitido } from './tipos';

/** Lo que se guarda al exportar el Word. */
export function emitidoDe(r: Pick<PlanCalidad, 'version' | 'valoracion' | 'total' | 'porcentaje'>, fecha: string): PlanEmitido {
  return {
    fecha,
    version: { ...r.version },
    filas: r.valoracion.map((v) => ({ ensayo: v.ensayo, descripcion: v.descripcion, cantidad: v.precios, precio: v.precio.valor, importe: v.importe })),
    total: r.total,
    porcentaje: r.porcentaje?.valor ?? null,
  };
}

const num = (n: number) => (Number.isInteger(n) ? fmtNum(n, 0) : fmtNum(n, 2));
const corta = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);
const eur = (n: number | null) => (n == null ? 'sin precio' : `${fmtNum(n, 2)} €`);

/** Diferencias entre el cálculo de hoy y lo emitido. */
export function diferenciasEmitido(r: Pick<PlanCalidad, 'version' | 'valoracion' | 'total'>, e: PlanEmitido): DiferenciaEmitido[] {
  const out: DiferenciaEmitido[] = [];
  const antes = new Map(e.filas.map((f) => [f.ensayo, f]));
  const hoy = new Map(r.valoracion.map((v) => [v.ensayo, v]));
  for (const v of r.valoracion) {
    const f = antes.get(v.ensayo);
    if (!f) {
      out.push({ ensayo: v.ensayo, texto: `Nuevo: «${corta(v.descripcion)}», ${num(v.precios)} ${v.unidad}.` });
      continue;
    }
    if (Math.abs(f.cantidad - v.precios) > 1e-6)
      out.push({ ensayo: v.ensayo, texto: `«${corta(v.descripcion)}»: ${num(f.cantidad)} → ${num(v.precios)} ${v.unidad}.` });
    if ((f.precio ?? null) !== (v.precio.valor ?? null) && !(f.precio != null && v.precio.valor != null && Math.abs(f.precio - v.precio.valor) < 0.005))
      out.push({ ensayo: v.ensayo, texto: `«${corta(v.descripcion)}»: precio ${eur(f.precio)} → ${eur(v.precio.valor)}.` });
  }
  for (const f of e.filas) if (!hoy.has(f.ensayo)) out.push({ ensayo: f.ensayo, texto: `Ya no está: «${corta(f.descripcion)}».` });
  if (out.length || e.total !== r.total) {
    if (e.total !== r.total) out.push({ ensayo: null, texto: `Total: ${fmtCents(e.total)} → ${fmtCents(r.total)}.` });
    const tablas = (Object.keys(r.version) as Array<keyof PlanCalidad['version']>).filter((k) => String(e.version[k]) !== String(r.version[k]));
    if (tablas.length) out.push({ ensayo: null, texto: `Han cambiado las tablas de la app: ${tablas.map((k) => `${k} (${e.version[k]} → ${r.version[k]})`).join(', ')}.` });
  }
  return out;
}
