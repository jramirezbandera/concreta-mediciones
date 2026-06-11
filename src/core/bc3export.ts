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

   F7.4b añade sobre la trazadora (validada en Presto 8.7 y Arquímedes 2022):
     · Códigos DETERMINISTAS (D2): la identidad BC3 es el código → homónimos
       divergentes se renombran `.2`/`.3`…; los idénticos comparten un solo
       concepto (correcto en BC3: cantidad en la ~D del padre, medición en su
       ~M); vacíos/'——' → generados (P001…). La asignación corre TRAS
       sanitizar y canonicalizar a cp1252 (sanitizar puede crear colisiones
       nuevas). Sin esto, Presto fusiona homónimos EN SILENCIO.
     · Subcapítulos ANIDADOS reales (D3): el consumidor es Presto. Las
       directas van ANTES que los subs en la ~D del capítulo (el anclaje por
       índice de los ~M exige que las partidas ocupen los primeros índices).
       Asimetría documentada: nuestro import los aplana (PEM invariante). Los
       subs VACÍOS no viajan (sin ~M propio, el reimport los confundiría con
       una partida fantasma a 0).
   Certificaciones a BC3: aplazado (TODOS.md T-12).
   =========================================================================== */
import type { Banco, Chapter, Item, MedLine, Obra, Partida, PartidasMap, Rates, ResourceType } from './types';
import { precioCuadraDescompuesto } from './banco';
import { groupBySub } from './grouping';
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

/** Forma canónica cp1252 de un texto: lo no mapeable → '?'. La dedupe de
 *  códigos (D2) corre sobre esta forma — dos códigos distintos en Unicode que
 *  acaban en los mismos BYTES son una colisión real en el archivo. */
function cp1252Canonical(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    out += cp <= 0x9f || (cp >= 0xa0 && cp <= 0xff) || CP1252_EXTRA[cp] != null ? ch : '?';
  }
  return out;
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

/* ---- códigos de concepto (D2) ----------------------------------------------
   Sanitizado + canónico cp1252 (la colisión se decide sobre los BYTES que
   viajan), sin `#` (marcador de capítulo/raíz) y sin `%` inicial (reservado a
   los conceptos porcentaje). Vacío ⇒ el llamante genera uno. */
function sanCode(s: string): string {
  return cp1252Canonical(field(s)).replace(/#/g, '-').replace(/^%+/, '').trim();
}

/** Identidad de una partida como CONCEPTO BC3: lo que define al ~C/~T/~D.
 *  La cantidad y la medición quedan fuera (viven en la ~D/~M del contenedor),
 *  así dos homónimos idénticos con distinta medición comparten concepto. */
function partidaSig(p: Partida): string {
  return `P|${JSON.stringify([p.title, p.ud, p.precio, p.desc, p.items.map((it) => [it.code, it.type, it.cantidad])])}`;
}

/* ===========================================================================
   Serialización principal
   =========================================================================== */
const ROOT_CODE = 'OBRA';

export function obraToBc3(input: Bc3ExportObra): Uint8Array {
  const { chapters, partidas, recursos, rates, obra } = input;
  const k = rates.coefK || 1;

  /* ---- asignación determinista de códigos (D2) ----
     Homónimos divergentes → sufijo `.2`/`.3`…; idénticos (misma identidad) →
     concepto compartido; nada se pierde nunca (sin esto Presto fusiona
     homónimos en silencio). Precedencia: raíz → capítulos → subs/partidas en
     orden del árbol → recursos en orden de primer uso. */
  const taken = new Map<string, string>(); // código final → identidad
  function assign(desired: string, sig: string): string {
    let code = desired;
    for (let n = 2; ; n += 1) {
      const cur = taken.get(code);
      if (cur === undefined) {
        taken.set(code, sig);
        return code;
      }
      if (cur === sig) return code; // concepto idéntico → compartido
      code = `${desired}.${n}`;
    }
  }
  let genP = 0;
  const genned = new Map<string, string>(); // identidad → código generado ('——'/vacíos)
  function conceptCode(raw: string, sig: string): string {
    const san = sanCode(raw);
    if (san && san !== '——') return assign(san, sig);
    const hit = genned.get(sig);
    if (hit != null) return hit;
    const fin = assign(`P${String((genP += 1)).padStart(3, '0')}`, sig);
    genned.set(sig, fin);
    return fin;
  }

  // Recursos usados por el árbol, código del banco → código final (huérfanos
  // fuera). Para los % se guarda el porcentaje del primer uso (precio del ~C).
  const recFinal = new Map<string, string>();
  const used = new Map<string, { orig: string; type: ResourceType; pct?: number }>();
  let genR = 0;
  function recursoCode(it: Item): string {
    const hit = recFinal.get(it.code);
    if (hit != null) return hit;
    const fin =
      it.type === '%CI'
        ? assign(`%${sanCode(it.code) || 'CI'}`, `%|${it.code}`)
        : assign(sanCode(it.code) || `R${String((genR += 1)).padStart(3, '0')}`, `R|${it.code}`);
    recFinal.set(it.code, fin);
    used.set(fin, {
      orig: it.code,
      type: recursos[it.code]?.type ?? it.type,
      pct: it.type === '%CI' ? it.cantidad : undefined,
    });
    return fin;
  }

  const recs: string[] = [];
  recs.push('~V|Concreta|FIEBDC-3/2016|Concreta Mediciones||ANSI|');
  const pct = coefKPct(k);
  if (pct !== 0) recs.push(`~K|\\2\\2\\3\\2\\2\\2\\2\\EUR\\|${num(pct, 4)}|`);

  // Raíz: precio = PEM CON K (como Presto). Sus hijos en la ~D van sin `#`.
  const rootCode = assign(sanCode(ROOT_CODE), 'ROOT');
  const chCodes = chapters.map((ch, ci) =>
    assign(sanCode(ch.code) || `C${String(ci + 1).padStart(2, '0')}`, `CH|${ch.id}`),
  );
  recs.push(`~C|${rootCode}##||${field(obra.denominacion)}|${num(toEur(pem(partidas, k)), 2)}||0|`);
  recs.push(`~D|${rootCode}##|${chCodes.map((c) => `${c}\\1\\1\\`).join('')}|`);

  /** ~C/~T/~D de un concepto de partida, una sola vez por código final. */
  const emitted = new Set<string>();
  function partidaBlock(p: Partida, code: string): void {
    if (emitted.has(code)) return;
    emitted.add(code);
    recs.push(`~C|${code}|${field(p.ud)}|${field(p.title)}|${num(p.precio, 2)}||0|`);
    if (p.desc) recs.push(`~T|${code}|${ttext(p.desc)}|`);
    // La ~D solo si el precio ES su descompuesto: Presto recalcula el padre
    // desde los hijos, así que una justificación que no cuadra movería el PEM.
    if (p.items.length && precioCuadraDescompuesto(p, recursos)) {
      recs.push(`~D|${code}|${p.items.map((it) => itemLine(it, recursoCode(it))).join('')}|`);
    }
  }

  const mRec = (parent: string, child: string, pos: string, p: Partida): string =>
    `~M|${parent}#\\${child}|${pos}|${num(partidaCantidad(p), 2)}|${p.med.map(medLine).join('')}|`;

  let genS = 0;
  chapters.forEach((ch, ci) => {
    const ps = partidas[ch.id] ?? [];
    const chCode = chCodes[ci]!;
    // Grupos en el orden de la vista (directas primero, luego subs); los subs
    // vacíos no viajan. Las directas DEBEN ir antes: el ~M se ancla por índice
    // a la ~D del contenedor y los subs no llevan ~M anclado al capítulo.
    const groups = groupBySub(ch, ps).filter((g) => g.items.length > 0);
    const subCode = new Map<string, string>(); // sub.id → código final
    const pCode = new Map<Partida, string>();
    for (const g of groups) {
      if (g.sub) subCode.set(g.sub.id, assign(sanCode(g.sub.code) || `S${String((genS += 1)).padStart(2, '0')}`, `SUB|${ch.id}|${g.sub.id}`));
      for (const p of g.items) pCode.set(p, conceptCode(p.code, partidaSig(p)));
    }

    recs.push(`~C|${chCode}#||${field(ch.title)}|${num(toEur(chapterTotal(ps, k)), 2)}||0|`);
    const children = groups.flatMap((g) =>
      g.sub
        ? [`${subCode.get(g.sub.id)}\\1\\1\\`]
        : g.items.map((p) => `${pCode.get(p)}\\1\\${num(partidaCantidad(p), 2)}\\`),
    );
    if (children.length) recs.push(`~D|${chCode}#|${children.join('')}|`);

    // ~M de las directas (anclados al capítulo) y bloques de subcapítulos.
    const subBlocks: string[] = [];
    let entry = 0;
    for (const g of groups) {
      if (!g.sub) {
        for (const p of g.items) {
          entry += 1;
          recs.push(mRec(chCode, pCode.get(p)!, `${ci + 1}\\${entry}\\`, p));
        }
        continue;
      }
      entry += 1;
      const sc = subCode.get(g.sub.id)!;
      subBlocks.push(`~C|${sc}#||${field(g.sub.title)}|${num(toEur(chapterTotal(g.items, k)), 2)}||0|`);
      subBlocks.push(`~D|${sc}#|${g.items.map((p) => `${pCode.get(p)}\\1\\${num(partidaCantidad(p), 2)}\\`).join('')}|`);
      g.items.forEach((p, pi) => subBlocks.push(mRec(sc, pCode.get(p)!, `${ci + 1}\\${entry}\\${pi + 1}\\`, p)));
    }
    recs.push(...subBlocks);

    for (const g of groups) for (const p of g.items) partidaBlock(p, pCode.get(p)!);
  });

  for (const [code, u] of used) {
    if (u.type === '%CI') {
      recs.push(`~C|${code}|%|Costes indirectos|${num(u.pct ?? 0, 4)}||0|`);
    } else {
      const r = recursos[u.orig];
      recs.push(`~C|${code}|${field(r?.ud ?? '')}|${field(r?.desc ?? '')}|${num(r?.precio ?? 0, 2)}||${TYPE_NUM[u.type]}|`);
    }
  }

  return encodeCp1252(recs.join('\r\n') + '\r\n');
}

/** Línea de descomposición `código\factor\rendimiento\` (rendimiento 3 dec).
 *  Para `%CI` el rendimiento viaja como FRACCIÓN (3 % → 0.03): Presto calcula
 *  importe = base × rendimiento (verificado con la trazadora). */
function itemLine(it: Item, code: string): string {
  if (it.type === '%CI') return `${code}\\1\\${num(it.cantidad / 100, 6)}\\`;
  return `${code}\\1\\${num(it.cantidad, 3)}\\`;
}
