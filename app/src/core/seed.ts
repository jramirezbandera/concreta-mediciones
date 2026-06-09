/* ===========================================================================
   core/seed — datos de ejemplo (port verbatim de data.js, SIN BASE_PEM).
   "Reforma vivienda C/ Mayor 14". Fuente de verdad de los números de prueba.
   §0 decisión 3: PEM = Σ importes de partidas reales (sin cubo oculto).
   =========================================================================== */
import type { Chapter, PartidasMap, Rates } from './types';

export const CHAPTERS: Chapter[] = [
  {
    id: '01',
    code: '1',
    title: 'Movimiento de tierras',
    children: [
      { id: '01.01', code: '1.1', title: 'Excavaciones' },
      { id: '01.02', code: '1.2', title: 'Rellenos y compactaciones' },
      { id: '01.03', code: '1.3', title: 'Transporte a vertedero' },
    ],
  },
  { id: '02', code: '2', title: 'Cimentación' },
  { id: '03', code: '3', title: 'Saneamiento' },
  { id: '04', code: '4', title: 'Estructura' },
  { id: '05', code: '5', title: 'Cerramientos y particiones' },
  { id: '06', code: '6', title: 'Cubiertas' },
  { id: '07', code: '7', title: 'Carpintería' },
  { id: '08', code: '8', title: 'Instalaciones' },
];

export const PARTIDAS: PartidasMap = {
  '01': [
    {
      id: 'p111',
      sub: '01.01',
      pos: '1.1.1',
      code: 'E02EM030',
      ud: 'm³',
      precio: 18.42,
      title: 'Excavación en zanjas a máquina',
      desc: 'Excavación en zanjas, en terrenos compactos, por medios mecánicos, con extracción de tierras a los bordes, sin carga ni transporte al vertedero y con p.p. de medios auxiliares. Según CTE-DB-SE-C y NTE-ADZ.',
      med: [
        { comment: 'Zanjas de saneamiento', uds: 1, largo: 85.0, ancho: 0.6, alto: 1.2 },
        { comment: 'Zanjas de instalaciones', uds: 1, largo: 70.5, ancho: 0.5, alto: 1.8 },
      ],
      items: [
        { code: 'mo001', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.25, precio: 17.52 },
        { code: 'mq01ret020', type: 'MQ', desc: 'Retrocargadora neumáticos 75 CV', ud: 'h', cantidad: 0.12, precio: 38.5 },
        { code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad: 3.0, precio: 9.0 },
      ],
    },
    {
      id: 'p112',
      sub: '01.01',
      pos: '1.1.2',
      code: 'E02SZ070',
      ud: 'm³',
      precio: 24.18,
      title: 'Excavación en pozos de cimentación',
      desc: 'Excavación en pozos de cimentación, en terrenos de consistencia media, por medios mecánicos, con extracción de tierras a los bordes. Incluida parte proporcional de medios auxiliares. Según CTE-DB-SE-C y NTE-ADZ.',
      med: [
        { comment: 'Pozos de zapatas aisladas', uds: 8, largo: 1.5, ancho: 1.5, alto: 1.4 },
        { comment: 'Pozo del ascensor', uds: 1, largo: 2.8, ancho: 2.8, alto: 1.75 },
      ],
      items: [
        { code: 'mo001', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.32, precio: 17.52 },
        { code: 'mq01exn020', type: 'MQ', desc: 'Excavadora hidráulica neumáticos 100 CV', ud: 'h', cantidad: 0.18, precio: 46.2 },
        { code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad: 3.0, precio: 11.83 },
      ],
    },
    {
      id: 'p113',
      sub: '01.01',
      pos: '1.1.3',
      code: 'E02ZM010',
      ud: 'm³',
      precio: 12.75,
      title: 'Excavación a cielo abierto',
      desc: 'Excavación a cielo abierto en cualquier clase de terreno, incluso roca, hasta una profundidad máxima de 4 m, por medios mecánicos, con extracción de tierras sobre camión. Según CTE-DB-SE-C.',
      med: [
        { comment: 'Vaciado general del solar', uds: 1, largo: 18.0, ancho: 12.0, alto: 0.95 },
        { comment: 'Rampa de acceso', uds: 1, largo: 6.0, ancho: 3.0, alto: 0.4 },
      ],
      items: [
        { code: 'mo001', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.12, precio: 17.52 },
        { code: 'mq01pan010', type: 'MQ', desc: 'Pala cargadora neumáticos 85 CV / 1,2 m³', ud: 'h', cantidad: 0.1, precio: 40.13 },
        { code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad: 3.0, precio: 6.24 },
      ],
    },
    {
      id: 'p121',
      sub: '01.02',
      pos: '1.2.1',
      code: 'E02RW040',
      ud: 'm³',
      precio: 6.18,
      title: 'Relleno y extendido de tierras propias',
      desc: 'Relleno y extendido de tierras propias, con medios mecánicos, motoniveladora, en tongadas de 30 cm de espesor, incluso humectación y compactación al 95% del Proctor Normal.',
      med: [
        { comment: 'Trasdós de muros', uds: 1, largo: 62.0, ancho: 0.8, alto: 1.4 },
        { comment: 'Relleno de zanjas', uds: 1, largo: 53.5, ancho: 0.4, alto: 0.6 },
      ],
      items: [
        { code: 'mo001', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.08, precio: 17.52 },
        { code: 'mq01mot010', type: 'MQ', desc: 'Motoniveladora de 135 CV', ud: 'h', cantidad: 0.05, precio: 64.8 },
        { code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad: 3.0, precio: 4.86 },
      ],
    },
    {
      id: 'p122',
      sub: '01.02',
      pos: '1.2.2',
      code: 'mt07acc010',
      mainType: 'MAT',
      ud: 't',
      precio: 11.4,
      title: 'Arena de río 0/5 mm',
      desc: 'Arena de río 0/5 mm cargada en camión, puesta en obra para camas de asiento y rellenos seleccionados.',
      med: [{ comment: 'Camas de tubería de saneamiento', uds: 1, largo: 14.2, ancho: '', alto: '' }],
      items: [],
    },
  ],
  '02': [
    {
      id: 'p211',
      pos: '2.1.1',
      code: 'E04CM040',
      ud: 'm³',
      precio: 112.34,
      title: 'Hormigón armado HA-25 en zapatas',
      desc: 'Hormigón armado HA-25/B/20/IIa fabricado en central, vertido con cubilote, en zapatas, incluso encofrado, armadura B 500 S y vibrado. Según EHE-08 y CTE-DB-SE-C.',
      med: [
        { comment: 'Zapatas aisladas', uds: 12, largo: 1.4, ancho: 1.4, alto: 0.5 },
        { comment: 'Zapatas corridas de muro', uds: 1, largo: 48.0, ancho: 0.6, alto: 0.6 },
        { comment: 'Vigas de atado', uds: 1, largo: 64.0, ancho: 0.4, alto: 0.45 },
        { comment: 'Losa de ascensor', uds: 1, largo: 2.8, ancho: 2.8, alto: 0.9 },
      ],
      items: [
        { code: 'mo043', type: 'MO', desc: 'Oficial 1ª ferrallista', ud: 'h', cantidad: 0.45, precio: 19.85 },
        { code: 'mt10haf010', type: 'MAT', desc: 'Hormigón HA-25/B/20/IIa central', ud: 'm³', cantidad: 1.05, precio: 76.4 },
        { code: 'mt07aco010', type: 'MAT', desc: 'Acero corrugado B 500 S', ud: 'kg', cantidad: 42.0, precio: 1.02 },
        { code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad: 3.0, precio: 109.07 },
      ],
    },
    {
      id: 'p212',
      pos: '2.1.2',
      code: 'E04SE020',
      ud: 'm²',
      precio: 14.6,
      title: 'Solera de hormigón HM-20 e=15 cm',
      desc: 'Solera de hormigón en masa HM-20/B/20/I de 15 cm de espesor, sobre encachado de piedra de 15 cm y lámina de polietileno, incluso curado y fratasado.',
      med: [
        { comment: 'Planta baja', uds: 1, largo: 18.0, ancho: 7.5, alto: '' },
        { comment: 'Cuarto de instalaciones', uds: 1, largo: 3.5, ancho: 1.0, alto: '' },
      ],
      items: [],
    },
  ],
  '03': [
    {
      id: 'p311',
      pos: '3.1.1',
      code: 'E03ALA010',
      ud: 'm',
      precio: 22.85,
      title: 'Tubería PVC saneamiento DN 200',
      desc: 'Tubería enterrada de PVC liso de saneamiento DN 200 mm, sobre cama de arena de 10 cm, con p.p. de piezas especiales y juntas elásticas.',
      med: [
        { comment: 'Colector principal', uds: 1, largo: 42.0, ancho: '', alto: '' },
        { comment: 'Ramales a arquetas', uds: 1, largo: 22.2, ancho: '', alto: '' },
      ],
      items: [],
    },
  ],
  '04': [
    {
      id: 'p411',
      pos: '4.1.1',
      code: 'E05HVA020',
      ud: 'm²',
      precio: 58.9,
      title: 'Forjado unidireccional 25+5 cm',
      desc: 'Forjado unidireccional de hormigón armado, canto 25+5 cm, con viguetas pretensadas y bovedilla de hormigón, incluso encofrado, hormigonado y armaduras. Según EHE-08.',
      med: [
        { comment: 'Forjado planta primera', uds: 1, largo: 16.0, ancho: 7.5, alto: '' },
        { comment: 'Forjado planta cubierta', uds: 1, largo: 16.0, ancho: 4.0, alto: '' },
      ],
      items: [],
    },
  ],
  '05': [],
  '06': [],
  '07': [],
  '08': [],
};

/** Tasas por defecto (reforma 10% IVA; GG 13% + BI 6%; sin coeficiente K). */
export const DEFAULT_RATES: Rates = { iva: 0.1, gg: 0.13, bi: 0.06, coefK: 1 };
