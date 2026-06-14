/* ===========================================================================
   editGridNav — navegación tipo hoja de cálculo entre celdas editables de un
   grid (medición). Las celdas son display↔input (botón/span en reposo con
   `data-editcell` → input al editar). Tab/Enter mueven el foco a la celda
   vecina y la ABREN en edición; las flechas (useGridNav) solo mueven foco entre
   celdas en reposo.

   El abrir-al-foco se ARMA solo durante un Tab/Enter (no al enfocar a secas),
   para no romper la navegación con flechas. El «armado» guarda el NODO destino
   esperado y un timestamp: solo ese nodo, y solo si el foco llega enseguida,
   consume el armado. Así un armado que no llega a destino (foco que sale del
   grid, doble Tab) caduca y nunca dispara una apertura espuria en otra celda.

   Marcadores que consume este módulo (los pone el grid):
     [data-editgrid]  contenedor del grid
     [data-editrow]   cada fila (para Enter = misma columna, fila siguiente)
     [data-editfield] cada celda-campo, con [data-col="N"]
     [data-editcell]  el display en reposo dentro del campo
   =========================================================================== */

let armedTarget: HTMLElement | null = null;
let armedAt = 0;
/** Ventana de validez del armado (ms): cubre el re-render display→input. */
const ARM_TTL = 400;

/** Arma la apertura-al-foco para `target` (el display de la celda vecina). */
export function armNextEdit(target: HTMLElement): void {
  armedTarget = target;
  armedAt = performance.now();
}

/** ¿`el` es el destino armado y reciente? Consume SIEMPRE (resetea el armado). */
export function consumeArmNextEdit(el: HTMLElement): boolean {
  const ok = armedTarget === el && performance.now() - armedAt < ARM_TTL;
  armedTarget = null;
  armedAt = 0;
  return ok;
}

/** Limpia el armado (p.ej. al salir el foco del grid). */
export function clearArmedEdit(): void {
  armedTarget = null;
  armedAt = 0;
}

function gridOf(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>('[data-editgrid]');
}

/** Campos del grid en orden DOM, EXCLUYENDO los de grids anidados. */
function fieldsOf(grid: HTMLElement): HTMLElement[] {
  return Array.from(grid.querySelectorAll<HTMLElement>('[data-editfield]')).filter(
    (f) => f.closest('[data-editgrid]') === grid,
  );
}

/** Celda display vecina (Tab): campo anterior/siguiente en orden DOM. `null` en el borde. */
export function neighborEditCell(from: HTMLElement, dir: 1 | -1): HTMLElement | null {
  const grid = gridOf(from);
  const cur = from.closest<HTMLElement>('[data-editfield]');
  if (!grid || !cur) return null;
  const fields = fieldsOf(grid);
  const i = fields.indexOf(cur);
  if (i < 0) return null;
  const next = fields[i + dir];
  return next?.querySelector<HTMLElement>('[data-editcell]') ?? null;
}

/** Celda display en la MISMA columna, fila siguiente/anterior (Enter). `null` en el borde. */
export function cellBelow(from: HTMLElement, dir: 1 | -1): HTMLElement | null {
  const grid = gridOf(from);
  const cur = from.closest<HTMLElement>('[data-editfield]');
  const curRow = from.closest<HTMLElement>('[data-editrow]');
  if (!grid || !cur || !curRow) return null;
  const col = cur.dataset.col;
  if (col == null) return null;
  const rows = Array.from(grid.querySelectorAll<HTMLElement>('[data-editrow]')).filter(
    (r) => r.closest('[data-editgrid]') === grid,
  );
  const ri = rows.indexOf(curRow);
  const row = rows[ri + dir];
  if (!row) return null;
  return (
    row.querySelector<HTMLElement>(`[data-editfield][data-col="${col}"] [data-editcell]`) ??
    row.querySelector<HTMLElement>(`[data-editfield][data-col="${col}"][data-editcell]`) ??
    null
  );
}

/** Índice de columna (`data-col`) del campo que contiene a `from`, o `null`. */
export function colOf(from: HTMLElement): number | null {
  const field = from.closest<HTMLElement>('[data-editfield]');
  const col = field?.dataset.col;
  return col == null ? null : Number(col);
}

/** ¿`from` está en la ÚLTIMA fila del grid? (para crear fila al tabular/Enter al final). */
export function isLastRow(from: HTMLElement): boolean {
  const grid = gridOf(from);
  const curRow = from.closest<HTMLElement>('[data-editrow]');
  if (!grid || !curRow) return false;
  const rows = Array.from(grid.querySelectorAll<HTMLElement>('[data-editrow]')).filter(
    (r) => r.closest('[data-editgrid]') === grid,
  );
  return rows[rows.length - 1] === curRow;
}
