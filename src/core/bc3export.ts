/* ===========================================================================
   core/bc3export — Serialización de la obra a FIEBDC-3 (.bc3).
   ---------------------------------------------------------------------------
   Writer propio (la lib `bc3` es parser-only). Spec F7.4 D1 de la eng-review
   2026-06-11, anclada al fixture real de Presto 8.7 y ESPEJO EXACTO de
   `bc3import` (round-trip propio al céntimo):

     · Bytes windows-1252 declarando `ANSI` en `~V` (encoder propio:
       `TextEncoder` solo emite UTF-8; carácter no mapeable → '?').
     · Punto decimal, sin separador de miles; precios/cantidades 2 dec,
       rendimientos 3 dec, dims de medición hasta 3 dec; CRLF.
     · Orden `~V → ~K → conceptos raíz→hojas` (~C/~D/~M/~T por nivel).
     · Marcadores de tipo en el código: raíz `##`, capítulos `#`; los HIJOS de
       una `~D` van SIN marcador (así lo escribe Presto en el fixture).
     · Sanitización (BC3 no tiene mecanismo de escape): `|`→`¦`, `\`→`/` en
       campos con subcampos, saltos de línea solo dentro de `~T` con el `~`
       inicial de línea neutralizado.
     · `~K` de 7 grupos `\2\2\3\2\2\2\2\EUR\` con pct = round((K−1)·100, 4),
       registro OMITIDO si K=1 (espejo de `coefKOf` del import).
     · Precios de partida/recurso en BASE (sin K); capítulo = Σ hijos CON K y
       raíz = PEM CON K. Verificado en el fixture de Presto: Σ capítulos =
       precio raíz al céntimo, con los precios de partida en base.
     · `~M` anclado por ÍNDICE a la `~D` del contenedor (espejo de
       `collectPartidas`): se emite UN ~M por partida, en orden, con 0 líneas
       si no hay medición — si faltara alguno, el reimport desalinearía las
       líneas de medición del resto.
     · `%CI` = concepto `%` con rendimiento = PORCENTAJE/100 en la `~D` y el
       porcentaje en el campo precio del `~C` (convención de Presto, verificada
       con la trazadora: Presto calcula importe = base × rendimiento, así que
       escribir el porcentaje entero multiplicaba el CI ×100).
     · La descomposición SOLO viaja si el precio cuadra con ella
       (`precioCuadraDescompuesto`): Presto recalcula el precio del padre desde
       los hijos e ignora el del `~C` (verificado con la trazadora). Un precio
       manual/override se exporta como precio CERRADO sin `~D` — partida
       alzada, que Presto sí respeta. El PEM es lo sagrado; la justificación
       inconsistente es irrepresentable en FIEBDC.
     · Solo se exporta el ÁRBOL de la obra: los recursos huérfanos del banco
       (sin partida que los use) NO viajan.

   F7.4a (bala trazadora): subcapítulos APLANADOS en su capítulo y códigos tal
   cual (el anidado real D3 y el renombrado determinista de homónimos D2 son
   F7.4b). Certificaciones a BC3: aplazado (TODOS.md T-12).
   =========================================================================== */
import type { Banco, Chapter, Item, MedLine, Obra, PartidasMap, Rates, ResourceType } from './types';
import { precioCuadraDescompuesto } from './banco';
import { toEur } from './money';
import { partidaCantidad } from './medicion';
import { chapterTotal, pem } from './totales';

/** Payload de dominio a exportar (espeja `ImportedObra` sin certs — T-12). */
export interface Bc3ExportObra {
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  rates: Rates;
  obra: Obra;
}

/* ---- encoder windows-1252 --------------------------------------------------
   Unicode → byte cp1252. Coincide con latin-1 salvo el rango 0x80–0x9F, donde
   cp1252 coloca €‚ƒ„…†‡ˆ‰Š‹ŒŽ''""•–—˜™š›œžŸ. Los 5 huecos (0x81/8D/8F/90/9D)
   se dejan pasar tal cual: `TextDecoder('windows-1252')` los devuelve como
   U+0081… → el round-trip byte↔texto es estable. No mapeable → '?'. */
const CP1252_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

export function encodeCp1252(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) out.push(cp);
    else if (CP1252_EXTRA[cp] != null) out.push(CP1252_EXTRA[cp]!);
    else if (cp <= 0x9f) out.push(cp);
    else out.push(0x3f); // '?'
  }
  return Uint8Array.from(out);
}

/* ---- números: punto decimal, sin miles, ceros finales fuera (como Presto) -- */
function num(n: number, dec: number): string {
  const s = n.toFixed(dec);
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

/* ---- sanitización (BC3 no tiene escape) ------------------------------------ */
/** Campo de registro: UNA línea, sin `|` (separador) ni `\` (subcampos). */
function field(s: string): string {
  return s.replace(/\r\n|\r|\n/g, ' ').replace(/\|/g, '¦').replace(/\\/g, '/');
}

/** Texto de `~T`: conserva saltos (CRLF) neutralizando el `~` a inicio de
 *  línea (arrancaría un registro nuevo). Sin subcampos → `\` se conserva. */
function ttext(s: string): string {
  return s
    .replace(/\|/g, '¦')
    .replace(/\r\n|\r|\n/g, '\r\n')
    .replace(/(^|\r\n)~/g, '$1 ~');
}

/** pct del `~K`: round((coefK − 1)·100, 4). 0 ⇒ el registro se omite. */
export function coefKPct(coefK: number): number {
  return Math.round((coefK - 1) * 100 * 1e4) / 1e4;
}

/** Tipo numérico del `~C` (espejo de `badgeOf` del import). Estructural = 0. */
const TYPE_NUM: Record<ResourceType, number> = { MO: 1, MQ: 2, MAT: 3, '%CI': 0 };

/* ---- líneas de medición del ~M ---------------------------------------------
   Cada línea son 6 subcampos `TIPO\COMENTARIO\UDS\LARGO\ANCHO\ALTO\` (TIPO
   vacío = línea normal). Dims hasta 3 dec; dimensión vacía viaja vacía
   (factor 1 en ambos motores). Si las CUATRO están vacías se explicita
   uds=1: el import descartaría la línea como "de sección" (todas null) y el
   Σ de parciales dejaría de cuadrar con la cantidad → perdería la medición. */
function medLine(l: MedLine): string {
  const d = (v: number | '') => (v === '' ? '' : num(v, 3));
  const allEmpty = l.uds === '' && l.largo === '' && l.ancho === '' && l.alto === '';
  const uds = allEmpty ? '1' : d(l.uds);
  return `\\${field(l.comment)}\\${uds}\\${d(l.largo)}\\${d(l.ancho)}\\${d(l.alto)}\\`;
}

/* ===========================================================================
   Serialización principal
   =========================================================================== */
const ROOT_CODE = 'OBRA';

export function obraToBc3(input: Bc3ExportObra): Uint8Array {
  const { chapters, partidas, recursos, rates, obra } = input;
  const k = rates.coefK || 1;
  const recs: string[] = [];

  recs.push('~V|Concreta|FIEBDC-3/2016|Concreta Mediciones||ANSI|');
  const pct = coefKPct(k);
  if (pct !== 0) recs.push(`~K|\\2\\2\\3\\2\\2\\2\\2\\EUR\\|${num(pct, 4)}|`);

  // Raíz: precio = PEM CON K (como Presto). Sus hijos en la ~D van sin `#`.
  recs.push(`~C|${ROOT_CODE}##||${field(obra.denominacion)}|${num(toEur(pem(partidas, k)), 2)}||0|`);
  recs.push(`~D|${ROOT_CODE}##|${chapters.map((c) => `${field(c.code)}\\1\\1\\`).join('')}|`);

  // Recursos usados por el árbol, en orden de primera aparición (huérfanos
  // fuera). Para los % se guarda el porcentaje del primer uso (precio del ~C).
  const used = new Map<string, { type: ResourceType; pct?: number }>();

  chapters.forEach((ch, ci) => {
    const ps = partidas[ch.id] ?? [];
    const chCode = `${field(ch.code)}#`;
    recs.push(`~C|${chCode}||${field(ch.title)}|${num(toEur(chapterTotal(ps, k)), 2)}||0|`);
    if (ps.length) {
      recs.push(`~D|${chCode}|${ps.map((p) => `${field(p.code)}\\1\\${num(partidaCantidad(p), 2)}\\`).join('')}|`);
      // Un ~M por partida, alineado por índice con la ~D del capítulo.
      ps.forEach((p, pi) => {
        const lines = p.med.map(medLine).join('');
        recs.push(`~M|${chCode}\\${field(p.code)}|${ci + 1}\\${pi + 1}\\|${num(partidaCantidad(p), 2)}|${lines}|`);
      });
    }
    for (const p of ps) {
      recs.push(`~C|${field(p.code)}|${field(p.ud)}|${field(p.title)}|${num(p.precio, 2)}||0|`);
      if (p.desc) recs.push(`~T|${field(p.code)}|${ttext(p.desc)}|`);
      // La ~D solo si el precio ES su descompuesto: Presto recalcula el padre
      // desde los hijos, así que una justificación que no cuadra movería el PEM.
      if (p.items.length && precioCuadraDescompuesto(p, recursos)) {
        recs.push(`~D|${field(p.code)}|${p.items.map((it) => itemLine(it)).join('')}|`);
        for (const it of p.items)
          if (!used.has(it.code))
            used.set(it.code, {
              type: recursos[it.code]?.type ?? it.type,
              pct: it.type === '%CI' ? it.cantidad : undefined,
            });
      }
    }
  });

  for (const [code, u] of used) {
    if (u.type === '%CI') {
      recs.push(`~C|${field(code)}|%|Costes indirectos|${num(u.pct ?? 0, 4)}||0|`);
    } else {
      const r = recursos[code];
      recs.push(`~C|${field(code)}|${field(r?.ud ?? '')}|${field(r?.desc ?? '')}|${num(r?.precio ?? 0, 2)}||${TYPE_NUM[u.type]}|`);
    }
  }

  return encodeCp1252(recs.join('\r\n') + '\r\n');
}

/** Línea de descomposición `código\factor\rendimiento\` (rendimiento 3 dec).
 *  Para `%CI` el rendimiento viaja como FRACCIÓN (3 % → 0.03): Presto calcula
 *  importe = base × rendimiento (verificado con la trazadora). */
function itemLine(it: Item): string {
  if (it.type === '%CI') return `${field(it.code)}\\1\\${num(it.cantidad / 100, 6)}\\`;
  return `${field(it.code)}\\1\\${num(it.cantidad, 3)}\\`;
}
