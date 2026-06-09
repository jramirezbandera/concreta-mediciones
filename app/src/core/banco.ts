/* ===========================================================================
   core/banco — banco de recursos compartido por código (MO/MQ/MAT).
   Portado verbatim de data.js. Los conceptos de la justificación se comparten
   por CÓDIGO: editar desc/ud/precio de un recurso afecta a TODAS las partidas
   que lo usan. El `%CI` NO es un recurso (es un % sobre el coste directo).

   `descompUnit`/`recursoBase` devuelven EUROS (precio unitario informativo,
   §0 decisión 6: NO pisa `partida.precio`). La acumulación del PEM va en
   céntimos en `core/totales`, sobre `partida.precio`.
   =========================================================================== */
import type { Banco, Item, Partida, PartidasMap } from './types';
import { round2 } from './money';

/** Importe de una línea de justificación con su propio `precio` (datos semilla). */
export function itemImporte(it: Item): number {
  if (it.type === '%CI') return round2(((it.precio ?? 0) * it.cantidad) / 100);
  return round2(it.cantidad * (it.precio ?? 0));
}

/** Construye el banco por código (primer concepto gana). Excluye `%CI`. */
export function buildRecursos(partidas: PartidasMap): Banco {
  const rec: Banco = {};
  for (const ch in partidas)
    for (const p of partidas[ch] ?? [])
      for (const it of p.items ?? []) {
        if (it.type === '%CI') continue;
        if (!rec[it.code]) {
          rec[it.code] = {
            type: it.type,
            desc: it.desc ?? '',
            ud: it.ud ?? '',
            precio: it.precio ?? 0,
          };
        }
      }
  return rec;
}

/** Cuántas partidas usan cada recurso (excl. `%CI`). El invariante compartido. */
export function recursoUsage(partidas: PartidasMap): Record<string, number> {
  const u: Record<string, number> = {};
  for (const ch in partidas)
    for (const p of partidas[ch] ?? [])
      for (const it of p.items ?? []) {
        if (it.type === '%CI') continue;
        u[it.code] = (u[it.code] ?? 0) + 1;
      }
  return u;
}

/** Precio del recurso: del banco por código; fallback al `precio` del item. */
export function recPrecio(it: Item, banco: Banco): number {
  const r = banco[it.code];
  return r && r.precio != null ? r.precio : (it.precio ?? 0);
}

/** Coste directo (€): round2(Σ_{type≠%CI} round2(cantidad · precioBanco)). */
export function recursoBase(items: Item[], banco: Banco): number {
  let b = 0;
  for (const it of items ?? []) {
    if (it.type === '%CI') continue;
    b += round2(it.cantidad * recPrecio(it, banco));
  }
  return round2(b);
}

/** Importe (€) de una línea leyendo el precio del banco compartido. */
export function itemImporteRec(it: Item, banco: Banco, base: number): number {
  if (it.type === '%CI') return round2((base * it.cantidad) / 100);
  return round2(it.cantidad * recPrecio(it, banco));
}

/** Precio unitario resultante de la descomposición (€): coste directo + %CI. */
export function descompUnit(items: Item[], banco: Banco): number {
  if (!items || !items.length) return 0;
  const base = recursoBase(items, banco);
  let total = base;
  for (const it of items) if (it.type === '%CI') total += round2((base * it.cantidad) / 100);
  return round2(total);
}

/* ---------- Precio descompuesto vs override manual (§0 decisión 6) ---------- */

/** Precio descompuesto de la partida (suma de su justificación). 0 sin items. */
export function precioDescompuesto(p: Partida, banco: Banco): number {
  return descompUnit(p.items, banco);
}

/**
 * ¿El `precio` efectivo cuadra con su descompuesto? Sin items, se considera que
 * sí (no hay descomposición que contrastar). Cuando es `false`, la UI muestra la
 * SEÑAL de override: el precio no es la suma de los descompuestos.
 */
export function precioCuadraDescompuesto(p: Partida, banco: Banco): boolean {
  if (!p.items || !p.items.length) return true;
  return p.precio === descompUnit(p.items, banco);
}

/**
 * Precio que DEBERÍA tener la partida según su modo: si está override manual,
 * el guardado; si no, el descompuesto (cuando hay items). Lo usa el store para
 * sincronizar `precio` al editar recursos en partidas no-override.
 */
export function precioSegunModo(p: Partida, banco: Banco): number {
  if (p.precioManual) return p.precio;
  if (p.items && p.items.length) return descompUnit(p.items, banco);
  return p.precio;
}
