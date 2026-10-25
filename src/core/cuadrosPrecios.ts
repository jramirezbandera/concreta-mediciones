/* ===========================================================================
   core/cuadrosPrecios — filas de los CUADROS DE PRECIOS del proyecto.
   ---------------------------------------------------------------------------
   · Cuadro nº 1: cada partida con su precio unitario en cifra y en LETRA (el
     que rige el contrato).
   · Cuadro nº 2: el mismo precio DESCOMPUESTO en mano de obra, maquinaria,
     materiales y las líneas de porcentaje (medios auxiliares, costes
     indirectos), cerrando en el precio del cuadro nº 1.

   Comparten filas (mismo orden y numeración que el presupuesto); PDF, XLSX y
   DOCX las pintan como `core/listado`. Importes en CÉNTIMOS. Precio = el
   efectivo de la partida con el coeficiente K, como en el presupuesto.

   Reglas del cuadro nº 2 (la suma de sus líneas ES el precio del nº 1):
     · Sin justificación, o con el precio puesto a mano (no sigue a su
       justificación) → una línea «Sin descomposición» con el precio entero:
       un precio a mano no tiene descompuesto.
     · Con K ≠ 1 se escalan las líneas y el redondeo (±1 cént.) lo absorbe la
       mayor, sin inventar una línea de ajuste por un céntimo.
   Incluye TODAS las partidas, también las aún sin medir: el cuadro fija
   precios unitarios, no importes. Los capítulos sin partidas no salen.
   =========================================================================== */
import type { Banco, Chapter, Item, Partida, PartidasMap, ResourceType, SubChapter } from './types';
import { itemImporteRec, precioOrigen } from './banco';
import { groupBySub } from './grouping';
import { rollupByDepth } from './tree';
import { centsALetras } from './numeroALetras';
import { fmtNum, round2, sumCents, toCents, type Cents } from './money';

export interface CuadroLinea {
  concepto: string;
  importe: Cents;
}

export interface CuadroPartidaRow {
  id: string;
  pos: string;
  code: string;
  title: string;
  desc: string;
  ud: string;
  /** Precio unitario CON coeficiente K, redondeado al céntimo. */
  precio: Cents;
  /** El mismo precio en letra («DOCE EUROS con TREINTA CÉNTIMOS»). */
  letras: string;
  /** Descomposición del cuadro nº 2; Σ importe === precio. */
  lineas: CuadroLinea[];
}

export interface CuadroGrupo {
  sub: SubChapter | null;
  /** 0 = grupo sin sub (directas del capítulo); 1 = sub; 2 = sub-sub… */
  depth: number;
  rows: CuadroPartidaRow[];
}

export interface CuadroCapitulo {
  id: string;
  code: string;
  title: string;
  grupos: CuadroGrupo[];
}

export interface CuadrosPrecios {
  capitulos: CuadroCapitulo[];
}

const POR_TIPO: { type: Exclude<ResourceType, '%CI'>; concepto: string }[] = [
  { type: 'MO', concepto: 'Mano de obra' },
  { type: 'MQ', concepto: 'Maquinaria' },
  { type: 'MAT', concepto: 'Materiales' },
];

/** «2 %», «2,5 %»: sin ceros de relleno. */
function fmtPct(n: number): string {
  return `${fmtNum(n, Number.isInteger(n) ? 0 : 2)
    .replace(/(,\d*?)0+$/, '$1')
    .replace(/,$/, '')} %`;
}

/** Concepto de una línea de porcentaje: su descripción y el %, salvo que la
 *  descripción ya lo diga («Costes indirectos 3%»). */
function conceptoPct(it: Item): string {
  const nombre = it.desc?.trim() || 'Costes indirectos';
  return nombre.includes('%') ? nombre : `${nombre} (${fmtPct(it.cantidad)})`;
}

/** Líneas del descompuesto SIN K: por tipo y los % en su orden. Σ importe =
 *  precio sin K (cada línea va redondeada al céntimo, como `descompUnit`). */
function lineasBase(p: Partida, banco: Banco): CuadroLinea[] {
  const precio = toCents(p.precio ?? 0);
  if (precioOrigen(p, banco) !== 'descompuesto')
    return [{ concepto: 'Sin descomposición', importe: precio }];
  const porTipo: Partial<Record<ResourceType, Cents>> = {};
  const pcts: CuadroLinea[] = [];
  let running = 0;
  for (const it of p.items) {
    // Misma acumulación que `descompUnit`: cada % sobre lo que llevan las anteriores.
    const imp = itemImporteRec(it, banco, running);
    running += imp;
    if (it.type === '%CI') pcts.push({ concepto: conceptoPct(it), importe: toCents(imp) });
    else porTipo[it.type] = (porTipo[it.type] ?? 0) + toCents(imp);
  }
  return [
    ...POR_TIPO.filter((t) => porTipo[t.type]).map((t) => ({
      concepto: t.concepto,
      importe: porTipo[t.type]!,
    })),
    ...pcts.filter((l) => l.importe !== 0),
  ];
}

/** Escala las líneas por K y deja el redondeo en la mayor: Σ === total. */
function escalar(lineas: CuadroLinea[], coefK: number, total: Cents): CuadroLinea[] {
  const out = lineas.map((l) => ({
    ...l,
    importe: coefK === 1 ? l.importe : Math.round(l.importe * coefK),
  }));
  const resto = total - sumCents(out.map((l) => l.importe));
  if (resto !== 0 && out.length) {
    const mayor = out.reduce(
      (m, l, i) => (Math.abs(l.importe) > Math.abs(out[m]!.importe) ? i : m),
      0,
    );
    out[mayor]!.importe += resto;
  }
  return out;
}

function fila(p: Partida, banco: Banco, coefK: number): CuadroPartidaRow {
  const precio = toCents(round2((p.precio ?? 0) * coefK));
  return {
    id: p.id,
    pos: p.pos,
    code: p.code,
    title: p.title,
    desc: p.desc,
    ud: p.ud,
    precio,
    letras: centsALetras(precio),
    lineas: escalar(lineasBase(p, banco), coefK, precio),
  };
}

/** Filas de los cuadros de precios nº 1 y nº 2, en el orden del presupuesto. */
export function buildCuadrosPrecios(
  chapters: Chapter[],
  partidas: PartidasMap,
  banco: Banco,
  coefK = 1,
): CuadrosPrecios {
  const capitulos = chapters
    .map((ch) => {
      const gs = groupBySub(ch, partidas[ch.id] ?? []);
      const cuenta = rollupByDepth(
        gs,
        gs.map((g) => g.items.length),
      );
      // Como el presupuesto: un contenedor sin partidas directas pero con
      // descendientes conserva su cabecera; los subárboles vacíos caen.
      const grupos = gs
        .filter((_, i) => cuenta[i]! > 0)
        .map((g) => ({
          sub: g.sub,
          depth: g.depth,
          rows: g.items.map((p) => fila(p, banco, coefK)),
        }));
      return { id: ch.id, code: ch.code, title: ch.title, grupos };
    })
    .filter((c) => c.grupos.length > 0);
  return { capitulos };
}
