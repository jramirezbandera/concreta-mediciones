/* ===========================================================================
   core/planoRevision — revisiones de un plano y reenlace con otra huella
   (§9.3, A1). Puro: el visor lo usa para el aviso «Hay una revisión más
   nueva» y para decidir si ofrece «Usar este PDF para este plano».
   =========================================================================== */
import type { Caja } from './planoGeom';
import { escalaLegible, origenLegible, planoLegible } from './planoDatos';
import type { PartidasMap, PlanoMeta, Punto } from './types';

/**
 * La revisión que sigue a `anterior`: «Rev. A» → «Rev. B», «Rev. 2» → «Rev. 3».
 * Sin revisión, la anterior cuenta como la A: «Rev. B». Una letra final solo
 * cuenta si va sola («Rev» no es la revisión V).
 */
export function siguienteRevision(anterior?: string): string {
  const t = anterior?.trim();
  if (!t) return 'Rev. B';
  const letra = /^(.*[^A-Za-z])?([A-Za-z])$/.exec(t);
  if (letra && !/[Zz]/.test(letra[2]!)) return `${letra[1] ?? ''}${String.fromCharCode(letra[2]!.charCodeAt(0) + 1)}`;
  const num = /^(.*?)(\d+)$/.exec(t);
  if (num) return `${num[1]}${Number(num[2]) + 1}`;
  return `${t}.1`;
}

/** «Planta primera · Rev. B» (o solo el nombre). */
export function nombreConRevision(p: Pick<PlanoMeta, 'nombre' | 'revision'>): string {
  return p.revision ? `${p.nombre} · ${p.revision}` : p.nombre;
}

/**
 * La revisión más nueva que sustituye (en cadena) al plano `planoId`, o `null`.
 * La cadena se sigue también por revisiones quitadas, pero solo se devuelve
 * una viva; con dos revisiones del mismo plano, manda la última adjunta.
 */
export function revisionMasNueva(planos: readonly unknown[], planoId: string): PlanoMeta | null {
  const todos = planos.filter((p): p is PlanoMeta => planoLegible(p));
  const vistos = new Set([planoId]);
  let actual = planoId;
  let out: PlanoMeta | null = null;
  for (;;) {
    const siguientes = todos.filter((p) => p.sustituye === actual && !vistos.has(p.id));
    if (!siguientes.length) return out;
    const vivas = siguientes.filter((p) => !p.quitado);
    const n = vivas.at(-1) ?? siguientes.at(-1)!;
    if (!n.quitado) out = n;
    vistos.add(n.id);
    actual = n.id;
  }
}

/** Las páginas con geometría guardada de `plano`: escalas y formas medidas. */
export function paginasConGeometria(plano: PlanoMeta, partidas: PartidasMap): number[] {
  const out = new Set<number>();
  for (const [k, e] of Object.entries(plano.escalas)) if (escalaLegible(e)) out.add(Number(k));
  for (const ps of Object.values(partidas))
    for (const p of ps) for (const l of p.med) if (origenLegible(l.origen) && l.origen.planoId === plano.id) out.add(l.origen.pagina);
  return [...out].sort((a, b) => a - b);
}

/**
 * ¿Encaja lo guardado de `plano` en otro PDF? (§9.3) Mismo número de páginas
 * y cada punto guardado (cotas de calibración y comprobación, formas medidas)
 * dentro de la caja de su página en el PDF nuevo (`cajas`, por página). Es la
 * condición para «Usar este PDF para este plano»; el tamaño de las páginas del
 * PDF anterior no se conoce cuando sus bytes faltan, que es cuando se reenlaza.
 * Después, cada página calibrada pide una comprobación nueva con otra cota.
 */
export function encajaEnPaginas(
  plano: PlanoMeta,
  partidas: PartidasMap,
  paginas: number,
  cajas: ReadonlyMap<number, Caja>,
): boolean {
  if (paginas !== plano.paginas) return false;
  const dentro = (n: number, pts: readonly Punto[]) => {
    const c = cajas.get(n);
    if (!c) return false;
    const [x0, y0, x1, y1] = [Math.min(c[0], c[2]), Math.min(c[1], c[3]), Math.max(c[0], c[2]), Math.max(c[1], c[3])];
    return pts.every(([x, y]) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1);
  };
  for (const [k, e] of Object.entries(plano.escalas)) {
    if (!escalaLegible(e)) continue;
    const pts: Punto[] = [e.ref.a, e.ref.b];
    if (e.comprobacion?.fuente === 'cota') pts.push(e.comprobacion.a, e.comprobacion.b);
    if (!dentro(Number(k), pts)) return false;
  }
  for (const ps of Object.values(partidas))
    for (const p of ps)
      for (const l of p.med) {
        const o = l.origen;
        if (origenLegible(o) && o.planoId === plano.id && !dentro(o.pagina, o.puntos)) return false;
      }
  return true;
}
