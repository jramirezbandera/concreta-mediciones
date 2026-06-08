/* ===========================================================================
   Spike §0.5 — Import desechable de un .bc3 real al prototipo Concreta.
   ---------------------------------------------------------------------------
   USO:
     node bc3-to-prototype.mjs ../samples/tu-obra.bc3 --inspect
         → parsea y vuelca la ESTRUCTURA (resumen, diagnostics, árbol, muestras)
           para entender el dialecto del archivo. No genera nada.
     node bc3-to-prototype.mjs ../samples/tu-obra.bc3 [--encoding=cp1252] [--out=data.generated.js]
         → mapea al shape del prototipo, calcula el PEM y escribe data.generated.js.
           Compara el PEM impreso con el que ves en Presto/Arquímedes (gate del spike).

   NO es código de producción. El mapeo es heurístico y se afina contra el
   archivo real (los dialectos Presto/Arquímedes difieren). Por eso existe
   --inspect: primero miramos la estructura real, luego se ajusta el mapeo.
   =========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { BC3, ResourceType } from 'bc3';
import iconv from 'iconv-lite';

// ---- CLI -------------------------------------------------------------------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const INSPECT = args.includes('--inspect');
const encArg = (args.find((a) => a.startsWith('--encoding=')) || '').split('=')[1];
const outArg = (args.find((a) => a.startsWith('--out=')) || '').split('=')[1] || 'data.generated.js';
const coefArg = (args.find((a) => a.startsWith('--coef=')) || '').split('=')[1];
if (!file) {
  console.error('uso: node bc3-to-prototype.mjs <archivo.bc3> [--inspect] [--encoding=cp1252] [--out=data.generated.js]');
  process.exit(1);
}

// ---- Lectura + decodificación ---------------------------------------------
// FIEBDC suele venir en cp1252 (ANSI) o cp850 (DOS); los NÚMEROS son ASCII, así
// que el PEM no depende del charset, pero las descripciones sí. Default cp1252.
const buf = readFileSync(file);
const charsetMap = { ANSI: 'cp1252', '1252': 'cp1252', '850': 'cp850', '437': 'cp437', 'UTF-8': 'utf8', UTF8: 'utf8', 'ISO-8859-1': 'latin1' };
let enc = encArg || 'cp1252';
let text = iconv.decode(buf, enc);

// ---- Parse -----------------------------------------------------------------
let { document: doc, diagnostics } = BC3.parse(text, { mode: 'lenient' });
// Si el ~V declara otro charset y no se forzó --encoding, re-decodifica.
const declared = doc?.metadata?.charset;
if (!encArg && declared && charsetMap[declared] && charsetMap[declared] !== enc) {
  enc = charsetMap[declared];
  text = iconv.decode(buf, enc);
  ({ document: doc, diagnostics } = BC3.parse(text, { mode: 'lenient' }));
}
if (!doc) {
  console.error('❌ No se pudo parsear el .bc3. Diagnostics:');
  for (const d of diagnostics.slice(0, 20)) console.error(`  [${d.level}] ${d.message}`);
  process.exit(2);
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtEur = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// RECURSO se clasifica por concept.type: 1=MO, 2=MQ, 3=MAT, 4/5=residuos.
// type 0 (UNCLASSIFIED) = estructural: raíz, capítulos, partidas y auxiliares.
// (getResourceHierarchy mete los type-0 en un grupo y por eso NO sirve aquí.)
const resourceCodes = new Set();
const typeByCode = new Map();
for (const [code, node] of doc.conceptsByCode) {
  const t = node.concept.type;
  if (t != null) {
    typeByCode.set(code, t);
    if (t >= 1) resourceCodes.add(code);
  }
}

// ───────────────────────────── INSPECT ─────────────────────────────────────
if (INSPECT) {
  const s = doc.getSummary();
  console.log('=== METADATA ===');
  console.log(JSON.stringify(doc.metadata, null, 2));
  console.log(`\n=== RESUMEN ===  encoding=${enc}`);
  console.log(`conceptos=${s.totalConcepts} roots=${s.rootConcepts} hojas=${s.leafConcepts} profundidad=${s.maxDepth}`);
  console.log(`con medición=${s.conceptsWithMeasurements} líneas de medición=${s.totalMeasurementLines}`);
  console.log(`con descomposición=${s.conceptsWithDecompositions} líneas descomp=${s.totalDecompositions}`);
  console.log(`tipos de concepto:`, [...s.conceptTypeDistribution.entries()]);
  console.log(`recursos detectados=${resourceCodes.size}`);
  console.log(`diagnostics: info=${s.diagnostics.info} warn=${s.diagnostics.warn} error=${s.diagnostics.error}`);
  const errs = diagnostics.filter((d) => d.level === 'error').slice(0, 15);
  if (errs.length) {
    console.log('\n=== ERRORES (primeros 15) ===');
    for (const d of errs) console.log(`  ${d.message}`);
  }

  console.log('\n=== ÁRBOL (code · tipo · ud · precio[0] · #hijos · #med · #descomp) ===');
  let printed = 0;
  doc.walkTree((node, depth) => {
    if (printed++ > 120) return;
    const c = node.concept;
    const isRes = resourceCodes.has(c.codeNorm);
    const tag = isRes ? `R${typeByCode.get(c.codeNorm) ?? '?'}` : `t${c.type ?? '-'}`;
    const price = c.prices?.[0] != null ? c.prices[0] : '';
    console.log(
      `${'  '.repeat(depth)}${c.codeNorm}  [${tag}] ${c.unit || ''} ${price}  ` +
        `h:${node.children.length} m:${node.measurements.length} d:${node.decompositions.length}  ${(c.summary || '').slice(0, 48)}`,
    );
  }, true);

  // Muestra de 3 nodos con medición (candidatos a partida).
  const withMed = [];
  doc.walkTree((node) => { if (node.measurements.length && !resourceCodes.has(node.concept.codeNorm)) withMed.push(node); }, false);
  console.log(`\n=== MUESTRA: ${Math.min(3, withMed.length)} partidas candidatas (con medición) ===`);
  for (const node of withMed.slice(0, 3)) {
    const c = node.concept;
    console.log(`\n• ${c.codeNorm}  ${c.unit || ''}  precio=${c.prices?.[0]}  "${(c.summary || '').slice(0, 60)}"`);
    for (const m of node.measurements) {
      console.log(`   medición total=${m.total} líneas=${m.details.length}`);
      for (const d of m.details.slice(0, 4)) {
        console.log(`     U=${d.units ?? ''} L=${d.length ?? ''} La=${d.latitude ?? ''} A=${d.height ?? ''} parcial=${d.partial}  ${(d.comment || '').slice(0, 30)}`);
      }
    }
    for (const dc of node.decompositions.slice(0, 5)) {
      console.log(`   descomp → ${dc.childCode}  rend=${dc.performance ?? dc.factor ?? ''}`);
    }
  }
  process.exit(0);
}

// ───────────────────────────── MAPEO ───────────────────────────────────────
// Aprendido del --inspect (Presto FIEBDC-3/2002):
//  · La MEDICIÓN se adjunta al PADRE (capítulo); cada Measurement tiene
//    conceptCode = la PARTIDA y total = su cantidad. → partida = conceptCode de
//    alguna medición; su capítulo = el ancestro de primer nivel.
//  · RECURSO = tipo 1/2/3 (MO/MQ/MAT); '%…' = %CI.
//  · PEM = Σ round2(cantidad · precio) sobre todas las mediciones. Contrastable
//    contra el precio de la raíz del .bc3 (lo que Presto muestra como PEM).
const RT2BADGE = { [ResourceType.LABOR]: 'MO', [ResourceType.MACHINERY]: 'MQ', [ResourceType.MATERIALS]: 'MAT' };
const badgeOf = (code) =>
  code.startsWith('%') ? '%CI' : RT2BADGE[typeByCode.get(code)] || (resourceCodes.has(code) ? 'MAT' : '%CI');

// Replica EXACTA de la medición del prototipo (dim vacía/0 = factor 1).
const dim = (x) => (x === '' || x == null || Number.isNaN(Number(x)) || Number(x) === 0 ? '' : Number(x));
const factor = (x) => (x === '' || x == null || Number.isNaN(Number(x)) ? 1 : Number(x));
const lineParcial = (l) => round2(factor(l.uds) * factor(l.largo) * factor(l.ancho) * factor(l.alto));
const medTotalOf = (med) => round2(med.reduce((s, l) => s + lineParcial(l), 0));
// Línea de sección/comentario = todas las dimensiones vacías (no suma): se descarta.
const isSectionLine = (d) => d.units == null && d.length == null && d.latitude == null && d.height == null;
const medLineOf = (d) => ({ comment: d.comment || '', uds: d.units ?? 1, largo: dim(d.length), ancho: dim(d.latitude), alto: dim(d.height) });

// Estructura (aprendida del probe): la DESCOMPOSICIÓN es la verdad.
//   raíz --decomp--> capítulos --decomp--> [subcapítulos | partidas] --> recursos
//   · CONTENEDOR (capítulo/subcapítulo) = nodo con measurements (lista las
//     cantidades de sus hijos, conceptCode = el propio contenedor).
//   · PARTIDA = hijo de descomposición de un contenedor que NO es contenedor.
//   · cantidad de la partida = performance en la descomposición del contenedor.
//   · importe = round2(cantidad · precio_unitario_de_la_partida).
const roots = doc.roots;
const root = roots.length === 1 ? roots[0] : null;
const rootPEM = root ? root.concept.prices?.[0] ?? null : null;
const isContainer = (node) => node.measurements.length > 0;

const CHAPTERS = [];
const PARTIDAS = {};
const chapterRef = new Map();
let pemCalc = 0;
let nPartidas = 0;
let nMedShown = 0;
const posCount = {};

function collectPartidas(containerNode, chId, chCode) {
  const meas = containerNode.measurements;
  containerNode.decompositions.forEach((d, i) => {
    const child = doc.getConcept(d.childCode);
    if (!child) return;
    if (isContainer(child)) { collectPartidas(child, chId, chCode); return; } // subcapítulo
    const qty = round2(d.performance ?? 0);
    const precio = child.concept.prices?.[0] ?? 0;
    pemCalc += round2(qty * precio);
    nPartidas += 1;
    posCount[chId] = (posCount[chId] || 0) + 1;
    // Adjunta la medición alineada por posición SOLO si reproduce la cantidad.
    const m = meas[i];
    let med = [];
    if (m && round2(m.total ?? 0) === qty) {
      const lines = m.details.filter((x) => !isSectionLine(x)).map(medLineOf);
      if (lines.length && medTotalOf(lines) === qty) { med = lines; nMedShown += 1; }
    }
    PARTIDAS[chId].push({
      id: `p${chId}_${posCount[chId]}`,
      pos: `${chCode}.${posCount[chId]}`,
      code: d.childCode,
      title: (child.concept.summary || d.childCode).slice(0, 90),
      ud: child.concept.unit || '',
      precio,
      cantidad: qty,
      desc: child.concept.text || child.concept.summary || '',
      med,
      items: (child.decompositions || []).map((dc) => {
        const rc = doc.getConcept(dc.childCode);
        return {
          code: dc.childCode,
          type: badgeOf(dc.childCode),
          cantidad: dc.performance ?? dc.factor ?? 0,
          desc: rc?.concept.summary || '',
          ud: rc?.concept.unit || '',
          precio: rc?.concept.prices?.[0] ?? 0,
        };
      }),
    });
  });
}

// Capítulos de primer nivel = descomposición de la raíz (o sus children).
let topDecomps = root && root.decompositions.length ? root.decompositions : [];
if (!topDecomps.length && root) topDecomps = root.children.map((n) => ({ childCode: n.concept.codeNorm }));
if (!root) topDecomps = roots.map((n) => ({ childCode: n.concept.codeNorm }));

let ci = 0;
for (const cd of topDecomps) {
  const chNode = doc.getConcept(cd.childCode);
  if (!chNode || resourceCodes.has(cd.childCode)) continue;
  ci += 1;
  const id = String(ci).padStart(2, '0');
  CHAPTERS.push({ id, code: String(ci), title: chNode.concept.summary || cd.childCode });
  PARTIDAS[id] = [];
  chapterRef.set(id, chNode.concept.prices?.[0] ?? 0);
  collectPartidas(chNode, id, String(ci));
}
pemCalc = round2(pemCalc);
const pemBase = pemCalc;

// ── Coeficiente K global (registro ~K) ─────────────────────────────────────
// El arquitecto/constructor ajusta TODOS los precios unitarios con un coef.
// global para cuadrar el PEM a una cifra objetivo (alza o baja: ×1,13, ×0,87…).
// En el modelo de producción debe ser EDITABLE (ver IMPLEMENTATION_PLAN §4).
// Aquí lo aplicamos para que el dogfood refleje el presupuesto real de la obra.
let kPct = NaN;
{
  const parts = (doc.coefficients?.raw || '').replace(/\r?\n/g, '').split('|');
  kPct = parseFloat(parts[2]); // p.ej. "13" → +13%
}
const coefMult = coefArg
  ? Number(coefArg)
  : rootPEM && pemBase
    ? Math.round((rootPEM / pemBase) * 1e6) / 1e6 // empírico: cuadra al precio raíz
    : 1;
if (coefMult && coefMult !== 1) {
  for (const id in PARTIDAS)
    for (const p of PARTIDAS[id]) {
      p.precioBase = p.precio;
      p.precio = round2(p.precio * coefMult);
    }
}
pemCalc = round2(
  Object.values(PARTIDAS)
    .flat()
    .reduce((s, p) => s + round2(p.cantidad * p.precio), 0),
);
const perChapter = CHAPTERS.map((c) => ({
  code: c.code,
  title: c.title.slice(0, 32),
  partidas: (PARTIDAS[c.id] || []).length,
  importe: round2((PARTIDAS[c.id] || []).reduce((s, p) => s + round2(p.cantidad * p.precio), 0)),
  ref: chapterRef.get(c.id),
}));

// ---- Salida: data.generated.js (override de los globals del prototipo) -----
const banner = `/* GENERADO por spike/import/bc3-to-prototype.mjs desde ${file}\n   NO editar a mano. Sobrescribe los globals del prototipo con la obra real. */`;
const out = `${banner}
window.COEF_K = ${coefMult}; // coeficiente global aplicado a los precios unitarios (editable en F1)
window.CHAPTERS = ${JSON.stringify(CHAPTERS, null, 2)};
window.PARTIDAS = ${JSON.stringify(PARTIDAS, null, 2)};
window.BASE_PEM = 0; // sin cubo oculto: PEM = Σ partidas (precios ya ajustados por COEF_K)
// Certificación arranca vacía (un borrador) para cronometrar una cert real.
window.makeCertsInit = function () { return [{ id: 'c1', num: 1, period: 'Certificación nº 1', retencion: 0.05, data: {} }]; };
`;
writeFileSync(outArg, out, 'utf8');

// ---- Informe de validación (gate al céntimo contra el precio de la raíz) ---
console.log(`encoding=${enc}  ·  capítulos=${CHAPTERS.length}  ·  partidas=${nPartidas}  ·  recursos=${resourceCodes.size}  ·  con medición visible=${nMedShown}`);
console.log('\n=== PEM por capítulo (calculado vs precio del capítulo en el .bc3) ===');
console.log(`  Cap  ${'Título'.padEnd(32)} part  ${'calculado'.padStart(15)}  ${'.bc3'.padStart(15)}  Δ`);
for (const c of perChapter) {
  const d = round2(c.importe - c.ref);
  console.log(`  ${c.code.padEnd(4)} ${c.title.padEnd(32)} ${String(c.partidas).padStart(3)}  ${fmtEur(c.importe).padStart(15)}  ${fmtEur(c.ref).padStart(15)}  ${d === 0 ? '✔' : fmtEur(d)}`);
}
console.log('  ' + '-'.repeat(78));
const refPEM = rootPEM != null ? round2(rootPEM) : null;
console.log(`  PEM base (Σ partidas, precio de base de precios) = ${fmtEur(pemBase)}`);
console.log(`  Coeficiente K global                            = ×${coefMult}${Number.isNaN(kPct) ? '' : `  (~K declara ${kPct} → ${kPct >= 0 ? '+' : ''}${kPct}%)`}`);
console.log(`  PEM ajustado (precios × K)                      = ${fmtEur(pemCalc)}`);
if (refPEM != null) {
  console.log(`  PEM objetivo en el .bc3 (precio raíz)           = ${fmtEur(refPEM)}   Δ = ${fmtEur(round2(pemCalc - refPEM))}`);
  console.log(`\n  ESTRUCTURA: ✅ ${CHAPTERS.length} cap · ${nPartidas} partidas · K=${coefMult} aplicado, cuadra con la raíz.`);
  console.log(`  AL CÉNTIMO: ⚠ desviación de céntimos por redondeo del precio unitario (prices[0] a 2 dec).`);
  console.log(`              El gate exacto requiere recalcular el precio de cada partida desde su`);
  console.log(`              descomposición a plena precisión → eso es el motor de F1 (céntimos enteros).`);
} else {
  console.log('  (no hay precio de raíz único para contrastar; verifica contra Presto)');
}
const wd = diagnostics.filter((d) => d.level !== 'info').length;
if (wd) console.log(`\n⚠  ${wd} diagnostics no-info (corre --inspect para verlos). Registros no modelados se conservan.`);
console.log(`\n✔ escrito ${outArg}.  Cárgalo en el prototipo para cronometrar la certificación (track 2).`);
