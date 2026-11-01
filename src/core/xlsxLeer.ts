/* ===========================================================================
   core/xlsxLeer — lector mínimo de la PRIMERA hoja de un .xlsx.
   ---------------------------------------------------------------------------
   Para la oferta que vuelve en el Excel de «Mediciones sin precios»
   (docs/plan-ofertas.md, O3). `write-excel-file` solo escribe; esto lee lo
   justo: valores de celda (números, textos compartidos, en línea y el último
   resultado de las fórmulas), sin estilos. Sin DOM (corre igual en node) y con
   `fflate`, que ya es dependencia.

   Una fórmula sin resultado guardado (el fichero que genera la app y nadie ha
   abierto en Excel) sale vacía: quien la lea lo trata como «no hay dato».
   =========================================================================== */
import { strFromU8, unzipSync } from 'fflate';

export type ValorCelda = string | number;

/** Fila leída: columna (0 = A) → valor. Las celdas vacías no están. */
export type FilaXlsx = Map<number, ValorCelda>;

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function desescapar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/** Texto de un `<si>` o un `<is>`: concatena sus `<t>` (texto enriquecido incluido). */
function textoDe(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += m[1] ?? '';
  return desescapar(out);
}

/** «AB12» → 27 (columna 0-based). */
export function columnaDe(ref: string): number {
  let n = 0;
  for (const ch of ref.toUpperCase()) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function hojaPrincipal(files: Record<string, Uint8Array>): string | null {
  const wb = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  if (wb && rels) {
    const id = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(strFromU8(wb))?.[1];
    // El orden de los atributos depende de quién guardó el fichero.
    const rel = [...strFromU8(rels).matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`));
    const t = rel && /\bTarget="([^"]+)"/.exec(rel)?.[1];
    if (t) {
      const ruta = t.startsWith('/') ? t.slice(1) : `xl/${t}`;
      if (files[ruta]) return ruta;
    }
  }
  return Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))[0] ?? null;
}

/** Filas de la primera hoja, en orden. Lanza si no es un .xlsx. */
export function leerPrimeraHoja(bytes: Uint8Array): FilaXlsx[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('no es un fichero de Excel (.xlsx)');
  }
  const ruta = hojaPrincipal(files);
  if (!ruta) throw new Error('el Excel no tiene ninguna hoja');
  const compartidos = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) =>
        textoDe(m[1] ?? ''),
      )
    : [];
  const xml = strFromU8(files[ruta]!);
  const filas: FilaXlsx[] = [];
  for (const fm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const num = Number(/\br="(\d+)"/.exec(fm[1]!)?.[1] ?? filas.length + 1);
    const fila: FilaXlsx = new Map();
    for (const cm of (fm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]!;
      const cuerpo = cm[2] ?? '';
      const ref = /\br="([A-Z]+)\d*"/i.exec(attrs)?.[1];
      if (!ref) continue;
      const tipo = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
      let valor: ValorCelda | undefined;
      if (tipo === 's') valor = v != null ? compartidos[Number(v)] : undefined;
      else if (tipo === 'inlineStr') valor = textoDe(/<is>([\s\S]*?)<\/is>/.exec(cuerpo)?.[1] ?? '');
      else if (tipo === 'str' || tipo === 'e') valor = v != null ? desescapar(v) : undefined;
      else if (tipo === 'b') valor = v != null ? Number(v) : undefined;
      else if (v != null && v.trim() !== '') valor = Number(v);
      if (valor === undefined || valor === '' || (typeof valor === 'number' && !Number.isFinite(valor))) continue;
      fila.set(columnaDe(ref), valor);
    }
    filas[num - 1] = fila;
  }
  return Array.from(filas, (f) => f ?? new Map());
}
