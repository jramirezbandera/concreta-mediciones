/* ===========================================================================
   Mediciones — datos de ejemplo (construcción española) + helpers de formato
   =========================================================================== */

// ---- Formato numérico español (miles con punto, decimales con coma) ----------
window.fmtNum = function (n, dec = 2) {
  if (n == null || isNaN(n)) return "";
  return Number(n).toLocaleString("es-ES", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
    useGrouping: true, // fuerza separador de miles también en 4 cifras (2.293,29)
  });
};
window.fmtEur = function (n, dec = 2) {
  return window.fmtNum(n, dec) + " €";
};
window.round2 = function (n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};
// Importe de una línea de descomposición. El %CI es un porcentaje sobre la
// base (precio), no un producto cantidad×precio.
window.itemImporte = function (it) {
  if (it.type === "%CI") return window.round2((it.precio * it.cantidad) / 100);
  return window.round2(it.cantidad * it.precio);
};

// ---- Medición: parcial de una línea (uds × long × anch × alt) ----------------
// Una dimensión vacía/0 se trata como factor 1 (no anula la línea).
function _dim(v) { return v == null || v === "" || isNaN(v) ? 1 : Number(v); }
window.lineParcial = function (l) {
  return window.round2(_dim(l.uds) * _dim(l.largo) * _dim(l.ancho) * _dim(l.alto));
};
window.medTotal = function (med) {
  if (!med || !med.length) return 0;
  return window.round2(med.reduce((s, l) => s + window.lineParcial(l), 0));
};
// Cantidad de una partida: suma de parciales si hay medición; si no, valor fijo.
window.partidaCantidad = function (p) {
  if (p.med && p.med.length) return window.medTotal(p.med);
  return p.cantidad || 0;
};
window.partidaImporte = function (p) {
  return window.round2(window.partidaCantidad(p) * (p.precio || 0));
};

// ---- Banco de recursos compartido (MO / MQ / MAT) ----------------------------
// Los conceptos de la justificación de precios se comparten por CÓDIGO: editar
// su descripción/ud/precio afecta a TODAS las partidas que los usan. El %CI no
// es un recurso: su importe se calcula como % sobre el coste directo de la partida.
window.buildRecursos = function (partidasMap) {
  const rec = {};
  for (const ch in partidasMap) for (const p of partidasMap[ch] || []) for (const it of p.items || []) {
    if (it.type === "%CI") continue;
    if (!rec[it.code]) rec[it.code] = { type: it.type, desc: it.desc, ud: it.ud, precio: it.precio };
  }
  return rec;
};
window.recursoUsage = function (partidasMap) {
  const u = {};
  for (const ch in partidasMap) for (const p of partidasMap[ch] || []) for (const it of p.items || []) {
    if (it.type === "%CI") continue;
    u[it.code] = (u[it.code] || 0) + 1;
  }
  return u;
};
function _recPrecio(it, rec) { return rec[it.code] && rec[it.code].precio != null ? rec[it.code].precio : it.precio; }
// Coste directo (suma de conceptos que no son %CI)
window.recursoBase = function (items, rec) {
  let b = 0;
  for (const it of items || []) if (it.type !== "%CI") b += window.round2(it.cantidad * _recPrecio(it, rec));
  return window.round2(b);
};
// Importe de una línea de justificación, leyendo precio del banco compartido.
window.itemImporteRec = function (it, rec, base) {
  if (it.type === "%CI") return window.round2((base * it.cantidad) / 100);
  return window.round2(it.cantidad * _recPrecio(it, rec));
};
// Precio unitario resultante de la descomposición (coste directo + %CI).
window.descompUnit = function (items, rec) {
  if (!items || !items.length) return 0;
  const base = window.recursoBase(items, rec);
  let total = base;
  for (const it of items) if (it.type === "%CI") total += window.round2((base * it.cantidad) / 100);
  return window.round2(total);
};

// ---- Árbol de capítulos ------------------------------------------------------
window.CHAPTERS = [
  {
    id: "01",
    code: "1",
    title: "Movimiento de tierras",
    children: [
      { id: "01.01", code: "1.1", title: "Excavaciones" },
      { id: "01.02", code: "1.2", title: "Rellenos y compactaciones" },
      { id: "01.03", code: "1.3", title: "Transporte a vertedero" },
    ],
  },
  { id: "02", code: "2", title: "Cimentación" },
  { id: "03", code: "3", title: "Saneamiento" },
  { id: "04", code: "4", title: "Estructura" },
  { id: "05", code: "5", title: "Cerramientos y particiones" },
  { id: "06", code: "6", title: "Cubiertas" },
  { id: "07", code: "7", title: "Carpintería" },
  { id: "08", code: "8", title: "Instalaciones" },
];

// ---- Partidas por capítulo ---------------------------------------------------
// Estructura de cada partida (nivel resumen):
//   { id, sub, pos, code, title, ud, precio, desc, med[], items[] }
//   · title  → título corto (lo que se ve en la fila)
//   · desc   → descripción larga (panel de detalle, editable)
//   · med[]  → líneas de medición { comment, uds, largo, ancho, alto }
//              la cantidad de la partida = Σ parciales de med
//   · items[]→ justificación del precio (auxiliares MO|MQ|MAT|%CI)
window.PARTIDAS = {
  "01": [
    {
      id: "p111", sub: "01.01", pos: "1.1.1", code: "E02EM030", ud: "m³", precio: 18.42,
      title: "Excavación en zanjas a máquina",
      desc: "Excavación en zanjas, en terrenos compactos, por medios mecánicos, con extracción de tierras a los bordes, sin carga ni transporte al vertedero y con p.p. de medios auxiliares. Según CTE-DB-SE-C y NTE-ADZ.",
      med: [
        { comment: "Zanjas de saneamiento", uds: 1, largo: 85.00, ancho: 0.60, alto: 1.20 },
        { comment: "Zanjas de instalaciones", uds: 1, largo: 70.50, ancho: 0.50, alto: 1.80 },
      ],
      items: [
        { code: "mo001", type: "MO", desc: "Peón ordinario construcción", ud: "h", cantidad: 0.25, precio: 17.52 },
        { code: "mq01ret020", type: "MQ", desc: "Retrocargadora neumáticos 75 CV", ud: "h", cantidad: 0.12, precio: 38.5 },
        { code: "%CI", type: "%CI", desc: "Costes indirectos 3%", ud: "%", cantidad: 3.0, precio: 9.0 },
      ],
    },
    {
      id: "p112", sub: "01.01", pos: "1.1.2", code: "E02SZ070", ud: "m³", precio: 24.18,
      title: "Excavación en pozos de cimentación",
      desc: "Excavación en pozos de cimentación, en terrenos de consistencia media, por medios mecánicos, con extracción de tierras a los bordes. Incluida parte proporcional de medios auxiliares. Según CTE-DB-SE-C y NTE-ADZ.",
      med: [
        { comment: "Pozos de zapatas aisladas", uds: 8, largo: 1.50, ancho: 1.50, alto: 1.40 },
        { comment: "Pozo del ascensor", uds: 1, largo: 2.80, ancho: 2.80, alto: 1.75 },
      ],
      items: [
        { code: "mo001", type: "MO", desc: "Peón ordinario construcción", ud: "h", cantidad: 0.32, precio: 17.52 },
        { code: "mq01exn020", type: "MQ", desc: "Excavadora hidráulica neumáticos 100 CV", ud: "h", cantidad: 0.18, precio: 46.2 },
        { code: "%CI", type: "%CI", desc: "Costes indirectos 3%", ud: "%", cantidad: 3.0, precio: 11.83 },
      ],
    },
    {
      id: "p113", sub: "01.01", pos: "1.1.3", code: "E02ZM010", ud: "m³", precio: 12.75,
      title: "Excavación a cielo abierto",
      desc: "Excavación a cielo abierto en cualquier clase de terreno, incluso roca, hasta una profundidad máxima de 4 m, por medios mecánicos, con extracción de tierras sobre camión. Según CTE-DB-SE-C.",
      med: [
        { comment: "Vaciado general del solar", uds: 1, largo: 18.00, ancho: 12.00, alto: 0.95 },
        { comment: "Rampa de acceso", uds: 1, largo: 6.00, ancho: 3.00, alto: 0.40 },
      ],
      items: [
        { code: "mo001", type: "MO", desc: "Peón ordinario construcción", ud: "h", cantidad: 0.12, precio: 17.52 },
        { code: "mq01pan010", type: "MQ", desc: "Pala cargadora neumáticos 85 CV / 1,2 m³", ud: "h", cantidad: 0.1, precio: 40.13 },
        { code: "%CI", type: "%CI", desc: "Costes indirectos 3%", ud: "%", cantidad: 3.0, precio: 6.24 },
      ],
    },
    {
      id: "p121", sub: "01.02", pos: "1.2.1", code: "E02RW040", ud: "m³", precio: 6.18,
      title: "Relleno y extendido de tierras propias",
      desc: "Relleno y extendido de tierras propias, con medios mecánicos, motoniveladora, en tongadas de 30 cm de espesor, incluso humectación y compactación al 95% del Proctor Normal.",
      med: [
        { comment: "Trasdós de muros", uds: 1, largo: 62.00, ancho: 0.80, alto: 1.40 },
        { comment: "Relleno de zanjas", uds: 1, largo: 53.50, ancho: 0.40, alto: 0.60 },
      ],
      items: [
        { code: "mo001", type: "MO", desc: "Peón ordinario construcción", ud: "h", cantidad: 0.08, precio: 17.52 },
        { code: "mq01mot010", type: "MQ", desc: "Motoniveladora de 135 CV", ud: "h", cantidad: 0.05, precio: 64.8 },
        { code: "%CI", type: "%CI", desc: "Costes indirectos 3%", ud: "%", cantidad: 3.0, precio: 4.86 },
      ],
    },
    {
      id: "p122", sub: "01.02", pos: "1.2.2", code: "mt07acc010", mainType: "MAT", ud: "t", precio: 11.4,
      title: "Arena de río 0/5 mm",
      desc: "Arena de río 0/5 mm cargada en camión, puesta en obra para camas de asiento y rellenos seleccionados.",
      med: [
        { comment: "Camas de tubería de saneamiento", uds: 1, largo: 14.20, ancho: "", alto: "" },
      ],
      items: [],
    },
  ],
  "02": [
    {
      id: "p211", pos: "2.1.1", code: "E04CM040", ud: "m³", precio: 112.34,
      title: "Hormigón armado HA-25 en zapatas",
      desc: "Hormigón armado HA-25/B/20/IIa fabricado en central, vertido con cubilote, en zapatas, incluso encofrado, armadura B 500 S y vibrado. Según EHE-08 y CTE-DB-SE-C.",
      med: [
        { comment: "Zapatas aisladas", uds: 12, largo: 1.40, ancho: 1.40, alto: 0.50 },
        { comment: "Zapatas corridas de muro", uds: 1, largo: 48.00, ancho: 0.60, alto: 0.60 },
        { comment: "Vigas de atado", uds: 1, largo: 64.00, ancho: 0.40, alto: 0.45 },
        { comment: "Losa de ascensor", uds: 1, largo: 2.80, ancho: 2.80, alto: 0.90 },
      ],
      items: [
        { code: "mo043", type: "MO", desc: "Oficial 1ª ferrallista", ud: "h", cantidad: 0.45, precio: 19.85 },
        { code: "mt10haf010", type: "MAT", desc: "Hormigón HA-25/B/20/IIa central", ud: "m³", cantidad: 1.05, precio: 76.4 },
        { code: "mt07aco010", type: "MAT", desc: "Acero corrugado B 500 S", ud: "kg", cantidad: 42.0, precio: 1.02 },
        { code: "%CI", type: "%CI", desc: "Costes indirectos 3%", ud: "%", cantidad: 3.0, precio: 109.07 },
      ],
    },
    {
      id: "p212", pos: "2.1.2", code: "E04SE020", ud: "m²", precio: 14.6,
      title: "Solera de hormigón HM-20 e=15 cm",
      desc: "Solera de hormigón en masa HM-20/B/20/I de 15 cm de espesor, sobre encachado de piedra de 15 cm y lámina de polietileno, incluso curado y fratasado.",
      med: [
        { comment: "Planta baja", uds: 1, largo: 18.00, ancho: 7.50, alto: "" },
        { comment: "Cuarto de instalaciones", uds: 1, largo: 3.50, ancho: 1.00, alto: "" },
      ],
      items: [],
    },
  ],
  "03": [
    {
      id: "p311", pos: "3.1.1", code: "E03ALA010", ud: "m", precio: 22.85,
      title: "Tubería PVC saneamiento DN 200",
      desc: "Tubería enterrada de PVC liso de saneamiento DN 200 mm, sobre cama de arena de 10 cm, con p.p. de piezas especiales y juntas elásticas.",
      med: [
        { comment: "Colector principal", uds: 1, largo: 42.00, ancho: "", alto: "" },
        { comment: "Ramales a arquetas", uds: 1, largo: 22.20, ancho: "", alto: "" },
      ],
      items: [],
    },
  ],
  "04": [
    {
      id: "p411", pos: "4.1.1", code: "E05HVA020", ud: "m²", precio: 58.9,
      title: "Forjado unidireccional 25+5 cm",
      desc: "Forjado unidireccional de hormigón armado, canto 25+5 cm, con viguetas pretensadas y bovedilla de hormigón, incluso encofrado, hormigonado y armaduras. Según EHE-08.",
      med: [
        { comment: "Forjado planta primera", uds: 1, largo: 16.00, ancho: 7.50, alto: "" },
        { comment: "Forjado planta cubierta", uds: 1, largo: 16.00, ancho: 4.00, alto: "" },
      ],
      items: [],
    },
  ],
  "05": [],
  "06": [],
  "07": [],
  "08": [],
};

// Base del PEM aportada por capítulos sin desglosar (05–08), de modo que
// PEM = BASE_PEM + Σ importes de TODAS las partidas editables. Calibrado para
// que con los datos iniciales el PEM sea 28.420,18 € (resumen del brief).
//   Σ partidas iniciales = 26.196,66 €  →  BASE_PEM = 2.223,52 €
window.BASE_PEM = 2223.52;
window.GGBI_RATE = 0.19; // GG (13%) + BI (6%)
window.IVA_RATE = 0.21;
window.RETENCION_RATE = 0.05; // retención de garantía sobre PEC de la certificación

// ---- Certificación: estado inicial de avance (a origen + anterior) -----------
// Factores estables por id de partida, para que el demo tenga variedad realista.
window.makeCertInit = function (partidasMap) {
  const out = {};
  for (const ch in partidasMap) {
    for (const p of partidasMap[ch]) {
      const qty = window.partidaCantidad(p);
      const seed = String(p.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const fo = 0.35 + ((seed * 37) % 66) / 100;            // 0.35 .. 1.00 (a origen)
      const fp = Math.max(0, fo - (0.18 + ((seed * 13) % 24) / 100)); // certificación anterior
      out[p.id] = { origen: window.round2(qty * fo), prev: window.round2(qty * fp) };
    }
  }
  return out;
};

// ---- Histórico de certificaciones -------------------------------------------
// Lista ordenada; cada certificación guarda la cantidad ejecutada A ORIGEN por
// partida. La "anterior" de una certificación es la inmediatamente previa.
window.makeCertsInit = function (partidasMap) {
  const periods = ["Abril 2026", "Mayo 2026", "Junio 2026"];
  const fracs = [0.40, 0.72, 1.0]; // fracción del avance final alcanzada en cada cert.
  const certs = periods.map((per, i) => ({ id: "c" + (i + 1), num: i + 1, period: per, retencion: 0.05, data: {} }));
  for (const ch in partidasMap) {
    for (const p of partidasMap[ch]) {
      const qty = window.partidaCantidad(p);
      const seed = String(p.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const fo = 0.35 + ((seed * 37) % 66) / 100; // avance final 0.35 .. 1.0
      certs.forEach((c, i) => { c.data[p.id] = window.round2(qty * fo * fracs[i]); });
    }
  }
  return certs;
};
