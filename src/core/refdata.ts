/* ===========================================================================
   core/refdata — Fuentes de referencia para el panel Referencia (F5).
   Bases de precios y otros presupuestos desde los que COPIAR partidas al
   presupuesto propio. Misma forma que el presupuesto: chapters + partidas
   {chId:[...]} con descomposición (items). Algunos recursos comparten código
   con el banco propio (mo113, %CI…) para demostrar la coherencia al copiar:
   al integrarlos NO se pisan los homónimos ya existentes.
   Portado verbatim de design_handoff/refdata.js.
   =========================================================================== */
import type { Banco, Chapter, Item, PartidasMap, ResourceType } from './types';

/** Partida de una fuente de referencia (subconjunto de `Partida`: sin `med`). La
 *  descripción larga viene de `REF_DESC` por código (bases estáticas) o de `desc`
 *  (obras propias, que la traen en la propia partida). */
export interface RefPartida {
  id: string;
  sub?: string;
  pos: string;
  code: string;
  title: string;
  ud: string;
  precio: number;
  mainType?: ResourceType;
  items: Item[];
  /** Descripción larga propia (obras como fuente; las bases la traen en REF_DESC). */
  desc?: string;
}

/** Fuente de referencia: base de precios o presupuesto ajeno. */
export interface RefSource {
  id: string;
  kind: 'base' | 'presupuesto';
  name: string;
  org: string;
  chapters: Chapter[];
  partidas: Record<string, RefPartida[]>;
}

/** Item de copia que la UI entrega al store (`copyRefPartidas`). */
export interface RefCopyItem {
  sourceName: string;
  partida: RefPartida;
}

/** Payload de arrastre del panel Referencia (F5.2): los items a soltar y si van
 *  como contradictorio (se congela el toggle al empezar a arrastrar). */
export interface RefDrag {
  items: RefCopyItem[];
  contra: boolean;
}

const CI = (cantidad: number): Item => ({ code: '%CI', type: '%CI', desc: 'Costes indirectos 3%', ud: '%', cantidad, precio: 0 });

/**
 * Bases de precios DEMO (BDT Andalucía, Reforma Goya, CYPE GP). Se conservan como
 * fixtures de test y para poder re-habilitarlas trivialmente, pero NO se cargan en
 * la app por defecto. Para volver a precargarlas: `export const REF_SOURCES = DEMO_REF_SOURCES`.
 */
export const DEMO_REF_SOURCES: RefSource[] = [
  {
    id: 'base-bdt',
    kind: 'base',
    name: 'Base de Precios de la Construcción 2025',
    org: 'BDT · Andalucía',
    chapters: [
      {
        id: 'A',
        code: 'A',
        title: 'Acondicionamiento del terreno',
        children: [
          { id: 'A.1', code: 'A.1', title: 'Movimiento de tierras' },
          { id: 'A.2', code: 'A.2', title: 'Red de saneamiento horizontal' },
        ],
      },
      { id: 'C', code: 'C', title: 'Cimentaciones' },
      { id: 'E', code: 'E', title: 'Estructuras' },
      { id: 'F', code: 'F', title: 'Fachadas y particiones' },
    ],
    partidas: {
      A: [
        {
          id: 'rADE010', sub: 'A.1', pos: 'A.1.1', code: 'ADE010', ud: 'm³', precio: 19.85,
          title: 'Excavación de zanjas y pozos', mainType: 'MQ',
          items: [
            { code: 'mo113', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.22, precio: 17.52 },
            { code: 'mq01ret020', type: 'MQ', desc: 'Retrocargadora s/neumáticos 70 CV', ud: 'h', cantidad: 0.2, precio: 38.5 },
            CI(3.0),
          ],
        },
        {
          id: 'rADR010', sub: 'A.1', pos: 'A.1.2', code: 'ADR010', ud: 'm³', precio: 8.42,
          title: 'Relleno con tierra seleccionada y compactación', mainType: 'MQ',
          items: [
            { code: 'mo113', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.12, precio: 17.52 },
            { code: 'mt01arp020', type: 'MAT', desc: 'Tierra de préstamo seleccionada', ud: 'm³', cantidad: 1.1, precio: 4.95 },
            { code: 'mq04cap010', type: 'MQ', desc: 'Compactador tándem autopropulsado', ud: 'h', cantidad: 0.08, precio: 41.3 },
            CI(3.0),
          ],
        },
        {
          id: 'rASA010', sub: 'A.2', pos: 'A.2.1', code: 'ASA010', ud: 'm', precio: 24.6,
          title: 'Colector enterrado PVC SN-4 DN 200 mm', mainType: 'MAT',
          items: [
            { code: 'mo008', type: 'MO', desc: 'Oficial 1ª construcción', ud: 'h', cantidad: 0.18, precio: 19.4 },
            { code: 'mt11tpb030', type: 'MAT', desc: 'Tubo PVC liso saneamiento DN 200', ud: 'm', cantidad: 1.05, precio: 14.2 },
            CI(3.0),
          ],
        },
      ],
      C: [
        {
          id: 'rCSZ010', pos: 'C.1', code: 'CSZ010', ud: 'm³', precio: 118.9,
          title: 'Zapata de cimentación de hormigón armado HA-25', mainType: 'MAT',
          items: [
            { code: 'mo043', type: 'MO', desc: 'Oficial 1ª ferrallista', ud: 'h', cantidad: 0.42, precio: 19.85 },
            { code: 'mt10haf010', type: 'MAT', desc: 'Hormigón HA-25/B/20/IIa central', ud: 'm³', cantidad: 1.05, precio: 78.3 },
            { code: 'mt07aco010', type: 'MAT', desc: 'Acero corrugado B 500 S', ud: 'kg', cantidad: 40.0, precio: 1.05 },
            CI(3.0),
          ],
        },
        {
          id: 'rCSL010', pos: 'C.2', code: 'CSL010', ud: 'm²', precio: 15.2,
          title: 'Solera de hormigón en masa HM-20 e=15 cm', mainType: 'MAT',
          items: [
            { code: 'mo008', type: 'MO', desc: 'Oficial 1ª construcción', ud: 'h', cantidad: 0.12, precio: 19.4 },
            { code: 'mt10hmf010', type: 'MAT', desc: 'Hormigón HM-20/B/20/I central', ud: 'm³', cantidad: 0.16, precio: 70.1 },
            CI(3.0),
          ],
        },
      ],
      E: [
        {
          id: 'rEHU010', pos: 'E.1', code: 'EHU010', ud: 'm²', precio: 61.4,
          title: 'Forjado unidireccional 25+5 cm, bovedilla cerámica', mainType: 'MAT',
          items: [
            { code: 'mo041', type: 'MO', desc: 'Oficial 1ª estructurista', ud: 'h', cantidad: 0.55, precio: 19.85 },
            { code: 'mt07vau010', type: 'MAT', desc: 'Vigueta pretensada T-18', ud: 'm', cantidad: 3.3, precio: 4.85 },
            { code: 'mt10haf010', type: 'MAT', desc: 'Hormigón HA-25/B/20/IIa central', ud: 'm³', cantidad: 0.1, precio: 78.3 },
            CI(3.0),
          ],
        },
        {
          id: 'rEAS010', pos: 'E.2', code: 'EAS010', ud: 'kg', precio: 2.34,
          title: 'Acero S275JR en pilares y vigas metálicas', mainType: 'MAT',
          items: [
            { code: 'mo047', type: 'MO', desc: 'Oficial 1ª montador estructura metálica', ud: 'h', cantidad: 0.02, precio: 19.85 },
            { code: 'mt07ala010', type: 'MAT', desc: 'Acero laminado S275JR perfiles', ud: 'kg', cantidad: 1.05, precio: 1.62 },
            CI(3.0),
          ],
        },
      ],
      F: [
        {
          id: 'rFFX010', pos: 'F.1', code: 'FFX010', ud: 'm²', precio: 38.7,
          title: 'Fábrica de ladrillo cerámico perforado 1/2 pie', mainType: 'MAT',
          items: [
            { code: 'mo020', type: 'MO', desc: 'Oficial 1ª construcción en trabajos de albañilería', ud: 'h', cantidad: 0.65, precio: 19.4 },
            { code: 'mt04lpv010', type: 'MAT', desc: 'Ladrillo cerámico perforado 24×11,5×7', ud: 'ud', cantidad: 48.0, precio: 0.18 },
            CI(3.0),
          ],
        },
        {
          id: 'rFTP010', pos: 'F.2', code: 'FTP010', ud: 'm²', precio: 21.3,
          title: 'Tabique de placa de yeso laminado 13+48+13', mainType: 'MAT',
          items: [
            { code: 'mo020', type: 'MO', desc: 'Oficial 1ª montador de prefabricados interiores', ud: 'h', cantidad: 0.3, precio: 19.4 },
            { code: 'mt12psg010', type: 'MAT', desc: 'Placa de yeso laminado 13 mm', ud: 'm²', cantidad: 2.1, precio: 4.65 },
            CI(3.0),
          ],
        },
      ],
    },
  },
  {
    id: 'pres-goya',
    kind: 'presupuesto',
    name: 'Reforma local C/ Goya 28',
    org: 'Presupuesto · 2025',
    chapters: [
      { id: 'D', code: '1', title: 'Demoliciones' },
      { id: 'AL', code: '2', title: 'Albañilería' },
      { id: 'IN', code: '3', title: 'Instalaciones' },
    ],
    partidas: {
      D: [
        {
          id: 'gD11', pos: '1.1', code: 'DPT020', ud: 'm²', precio: 9.85,
          title: 'Demolición de tabique de ladrillo hueco con medios manuales', mainType: 'MO',
          items: [
            { code: 'mo113', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.45, precio: 17.52 },
            CI(3.0),
          ],
        },
        {
          id: 'gD12', pos: '1.2', code: 'DRS010', ud: 'm²', precio: 7.2,
          title: 'Levantado de solado de baldosas con medios manuales', mainType: 'MO',
          items: [
            { code: 'mo113', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.32, precio: 17.52 },
            CI(3.0),
          ],
        },
      ],
      AL: [
        {
          id: 'gAL11', pos: '2.1', code: 'RSG010', ud: 'm²', precio: 28.4,
          title: 'Solado de baldosa de gres porcelánico 60×60 cm', mainType: 'MAT',
          items: [
            { code: 'mo023', type: 'MO', desc: 'Oficial 1ª solador', ud: 'h', cantidad: 0.4, precio: 19.4 },
            { code: 'mt18bgr010', type: 'MAT', desc: 'Baldosa gres porcelánico 60×60', ud: 'm²', cantidad: 1.05, precio: 18.9 },
            CI(3.0),
          ],
        },
        {
          id: 'gAL12', pos: '2.2', code: 'RPE010', ud: 'm²', precio: 12.6,
          title: 'Enfoscado de mortero de cemento en paramentos', mainType: 'MAT',
          items: [
            { code: 'mo020', type: 'MO', desc: 'Oficial 1ª construcción en trabajos de albañilería', ud: 'h', cantidad: 0.38, precio: 19.4 },
            { code: 'mt09mor010', type: 'MAT', desc: 'Mortero de cemento M-5', ud: 'm³', cantidad: 0.015, precio: 115.3 },
            CI(3.0),
          ],
        },
      ],
      IN: [
        {
          id: 'gIN11', pos: '3.1', code: 'IFI010', ud: 'ud', precio: 86.4,
          title: 'Punto de luz sencillo empotrado', mainType: 'MAT',
          items: [
            { code: 'mo003', type: 'MO', desc: 'Oficial 1ª electricista', ud: 'h', cantidad: 1.2, precio: 19.85 },
            { code: 'mt35cun010', type: 'MAT', desc: 'Cable unipolar ES07Z1-K 1,5 mm²', ud: 'm', cantidad: 12.0, precio: 0.42 },
            CI(3.0),
          ],
        },
        {
          id: 'gIN12', pos: '3.2', code: 'IFW010', ud: 'ud', precio: 142.8,
          title: 'Toma de agua para lavabo con llave de escuadra', mainType: 'MAT',
          items: [
            { code: 'mo008', type: 'MO', desc: 'Oficial 1ª fontanero', ud: 'h', cantidad: 1.6, precio: 19.4 },
            { code: 'mt30lla020', type: 'MAT', desc: 'Llave de escuadra 1/2" cromada', ud: 'ud', cantidad: 2.0, precio: 4.85 },
            CI(3.0),
          ],
        },
      ],
    },
  },
  {
    id: 'cype-gp',
    kind: 'base',
    name: 'Generador de Precios CYPE',
    org: 'España · 2025',
    chapters: [
      {
        id: 'A',
        code: 'A',
        title: 'Acondicionamiento del terreno',
        children: [
          { id: 'AH', code: 'AH', title: 'Achiques y agotamientos' },
          { id: 'AD', code: 'AD', title: 'Movimiento de tierras en edificación' },
        ],
      },
      { id: 'C', code: 'C', title: 'Cimentaciones' },
    ],
    partidas: {
      A: [
        {
          id: 'cAHP010', sub: 'AH', pos: 'A.1.1', code: 'AHP010', ud: 'Ud', precio: 2592.23,
          title: 'Pozo de bombeo provisional', mainType: 'MQ',
          items: [
            { code: 'mo113', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 8.0, precio: 17.52 },
            { code: 'mq01per010', type: 'MQ', desc: 'Equipo de perforación de micropozos', ud: 'h', cantidad: 6.0, precio: 95.4 },
            { code: 'mt01tac010', type: 'MAT', desc: 'Tubo de acero Ø 45 cm para entubación', ud: 'm', cantidad: 14.0, precio: 86.2 },
            CI(3.0),
          ],
        },
        {
          id: 'cADE010', sub: 'AD', pos: 'A.2.1', code: 'ADE010', ud: 'm³', precio: 20.4,
          title: 'Excavación de zanjas para instalaciones', mainType: 'MQ',
          items: [
            { code: 'mo113', type: 'MO', desc: 'Peón ordinario construcción', ud: 'h', cantidad: 0.24, precio: 17.52 },
            { code: 'mq01ret010', type: 'MQ', desc: 'Retroexcavadora hidráulica sobre neumáticos', ud: 'h', cantidad: 0.21, precio: 38.5 },
            CI(3.0),
          ],
        },
      ],
      C: [
        {
          id: 'cCSV010', pos: 'C.1', code: 'CSV010', ud: 'm³', precio: 124.5,
          title: 'Viga de atado de hormigón armado HA-25', mainType: 'MAT',
          items: [
            { code: 'mo043', type: 'MO', desc: 'Oficial 1ª ferrallista', ud: 'h', cantidad: 0.48, precio: 19.85 },
            { code: 'mt10haf010', type: 'MAT', desc: 'Hormigón HA-25/B/20/IIa central', ud: 'm³', cantidad: 1.05, precio: 78.3 },
            { code: 'mt07aco010', type: 'MAT', desc: 'Acero corrugado B 500 S', ud: 'kg', cantidad: 60.0, precio: 1.05 },
            CI(3.0),
          ],
        },
      ],
    },
  },
];

/**
 * Fuentes de referencia cargadas en la app (panel Referencia, F5). Arranca VACÍO:
 * el usuario parte de cero y añade fuentes importando bases .bc3 o reutilizando sus
 * obras guardadas (que se listan como fuentes "propias"). Las bases demo viven en
 * `DEMO_REF_SOURCES` (solo tests / re-habilitación manual).
 */
export const REF_SOURCES: RefSource[] = [];

/** Descripciones largas de partida, indexadas por código FIEBDC (lo que se
 *  despliega para decidir qué importar). Se copia a `Partida.desc` al importar. */
export const REF_DESC: Record<string, string> = {
  ADE010:
    'Excavación de tierras a cielo abierto para formación de zanjas y pozos hasta 2 m de profundidad, en suelo de arcilla semidura, con medios mecánicos, hasta alcanzar la cota de profundidad indicada en el Proyecto. Incluso refinado de paramentos y fondo, extracción de tierras a los bordes, sin carga ni transporte al vertedero y p/p de medios auxiliares. Criterio de medición: volumen medido sobre las secciones teóricas de la excavación.',
  ADR010:
    'Formación de relleno y extendido con tierras seleccionadas procedentes de la propia excavación, en tongadas de 30 cm de espesor, con medios mecánicos, y compactación al 95% del Proctor Modificado mediante equipo manual, hasta alcanzar una densidad seca no inferior a la indicada. Incluso humectación. Criterio de medición: volumen medido sobre los planos de perfiles transversales.',
  ASA010:
    'Suministro y montaje de colector enterrado de saneamiento, sin arquetas, mediante sistema integral registrable, de tubería de PVC liso de pared compacta de DN 200 mm, serie SN-4, rigidez anular nominal 4 kN/m², con junta elástica. Incluso p/p de accesorios, piezas especiales, lubricante y elementos de sujeción. Totalmente montada, conexionada y probada.',
  CSZ010:
    'Formación de zapata de cimentación de hormigón armado, realizada con hormigón HA-25/B/20/IIa fabricado en central y vertido con cubilote, y acero UNE-EN 10080 B 500 S, con una cuantía aproximada de 40 kg/m³. Incluso armaduras de espera del soporte, separadores y p/p de elementos de fijación. Según EHE-08 y CTE DB SE-C.',
  CSL010:
    'Formación de solera de hormigón en masa de 15 cm de espesor, realizada con hormigón HM-20/B/20/I fabricado en central y vertido desde camión, para base de un solado, sin tratamiento de su superficie; apoyada sobre capa base existente. Incluso p/p de preparación de la superficie de apoyo, extendido y vibrado, curado del hormigón y formación de juntas.',
  EHU010:
    'Forjado unidireccional de hormigón armado, horizontal, canto 25+5 cm, con viguetas pretensadas y bovedilla cerámica, 70 cm de intereje; hormigón HA-25/B/20/IIa fabricado en central y acero B 500 S. Incluso p/p de zunchos perimetrales de planta, encofrado, apuntalamiento, vertido, vibrado y curado. Según EHE-08.',
  EAS010:
    'Suministro y montaje de acero laminado UNE-EN 10025 S275JR, en perfiles laminados en caliente para pilares y vigas, mediante uniones soldadas. Incluso p/p de preparación de bordes, soldaduras, cortes, piezas especiales, despuntes y dos manos de imprimación con pintura de minio de plomo. Trabajado y montado en taller y obra.',
  FFX010:
    'Hoja de partición interior de 11,5 cm de espesor de fábrica, de ladrillo cerámico perforado (panal), para revestir, recibida con mortero de cemento industrial M-5. Incluso p/p de replanteo, nivelación y aplomado, recibido de cercos y precercos, mermas y roturas, enjarjes, mochetas y limpieza.',
  FTP010:
    'Tabique sencillo (15+48+15)/600 (48) LM con placas de yeso laminado, sobre banda acústica, formado por una estructura simple de perfiles de chapa de acero galvanizado de 48 mm de anchura, a base de montantes y canales, a la que se atornillan dos placas en total (una en cada cara). Incluso p/p de tratamiento de juntas.',
  DPT020:
    'Demolición de partición interior de fábrica revestida, formada por ladrillo hueco sencillo de 4/5 cm de espesor, con medios manuales, sin afectar a la estabilidad de los elementos constructivos contiguos, y carga manual sobre camión o contenedor. Incluso p/p de demolición de sus revestimientos.',
  DRS010:
    'Levantado de pavimento existente de baldosas cerámicas y picado del material de agarre, con medios manuales, sin deteriorar los elementos constructivos contiguos, y carga manual sobre camión o contenedor. Incluso limpieza del tajo.',
  RSG010:
    'Suministro y ejecución de pavimento mediante el método de colocación en capa fina, de baldosas cerámicas de gres porcelánico, de 60x60 cm, recibidas con adhesivo cementoso mejorado, C2 sin deslizamiento, y rejuntadas con mortero de juntas cementoso tipo CG 2. Incluso p/p de limpieza.',
  RPE010:
    'Formación de revestimiento continuo de mortero de cemento, tipo GP CSIII W0, a buena vista, de 15 mm de espesor, aplicado sobre un paramento vertical interior, acabado superficial rugoso, para servir de base a un posterior revestimiento. Incluso p/p de formación de juntas, rincones, maestras y aristas.',
  IFI010:
    'Instalación interior empotrada de un punto de luz sencillo, formado por cable unipolar ES07Z1-K, conductos y mecanismo, conectado al cuadro de mando y protección. Incluso p/p de cajas de derivación, regletas de conexión, cajas de empotrar y elementos de fijación. Totalmente montado, conexionado y probado.',
  IFW010:
    'Instalación interior de fontanería para cuarto de baño con dotación para lavabo, realizada con tubo de polietileno reticulado (PE-X), para la red de agua fría y caliente. Incluso p/p de llaves de escuadra de regulación, material auxiliar y ayudas de albañilería. Totalmente montada, conexionada y probada.',
  AHP010:
    'Pozo de bombeo provisional, de hasta 14 m de profundidad, realizado con tubo de acero de 45 cm de diámetro, para alojamiento de bomba sumergible, a utilizar en los trabajos de agotamiento del agua del fondo de la excavación. Incluso p/p de perforación, entubación, grava filtrante y retirada del equipo. Totalmente terminado.',
  CSV010:
    'Viga de atado de hormigón armado, realizada con hormigón HA-25/B/20/IIa fabricado en central y vertido con cubilote, y acero UNE-EN 10080 B 500 S, con una cuantía aproximada de 60 kg/m³. Incluso p/p de separadores y armaduras de espera. Según EHE-08 y CTE DB SE-C.',
};

/* ===========================================================================
   Multi-obra (T-10, PR3): usar OTRA obra propia como fuente de Referencia.
   =========================================================================== */

/**
 * Hidrata un `Item` de partida para mostrarlo en el panel: en runtime el item
 * solo guarda `{code,type,cantidad}`; `desc/ud/precio` viven en el banco por
 * código. El panel SÍ necesita esos campos (descomposición + importe), así que
 * los rellenamos desde `recursos` (Codex: el adaptador no puede descartarlos).
 */
function hydrateItem(it: Item, recursos: Banco): Item {
  if (it.type === '%CI') {
    return { code: '%CI', type: '%CI', cantidad: it.cantidad, desc: it.desc ?? 'Costes indirectos', ud: '%', precio: 0 };
  }
  const r = recursos[it.code];
  return {
    code: it.code,
    type: it.type,
    cantidad: it.cantidad,
    desc: r?.desc ?? it.desc ?? '',
    ud: r?.ud ?? it.ud ?? '',
    precio: r?.precio ?? it.precio ?? 0,
  };
}

/**
 * Adapta una obra propia (capítulos + partidas + banco) a `RefSource` para el
 * panel. Hidrata los items desde el banco y trae la descripción larga de la
 * propia partida (`Partida.desc`, no `REF_DESC`). `med`/`precioManual`/`fromBase`
 * no viajan (la fuente no los necesita). El id se prefija `obra:` para distinguir
 * las obras propias de las bases estáticas.
 */
export function obraToRefSource(
  id: string,
  name: string,
  chapters: Chapter[],
  partidas: PartidasMap,
  recursos: Banco,
): RefSource {
  const out: Record<string, RefPartida[]> = {};
  for (const chId in partidas) {
    out[chId] = (partidas[chId] ?? []).map((p) => ({
      id: p.id,
      sub: p.sub,
      pos: p.pos,
      code: p.code,
      title: p.title,
      ud: p.ud,
      precio: p.precio,
      mainType: p.mainType,
      desc: p.desc,
      items: p.items.map((it) => hydrateItem(it, recursos)),
    }));
  }
  return {
    id: `obra:${id}`,
    kind: 'presupuesto',
    name: name || 'Obra sin nombre',
    org: 'Obra propia',
    chapters,
    partidas: out,
  };
}

/* ---- colisión de recurso al copiar (T-1, decisión eng-review D2) ----------- */

/** Valores comparables de un recurso (para detectar colisión de código). */
export interface RecursoVals {
  desc: string;
  ud: string;
  precio: number;
}

/** Una colisión: un código entrante que YA existe en el banco a precio/desc distinto. */
export interface Collision {
  code: string;
  existing: RecursoVals;
  incoming: RecursoVals;
}

/** Resolución por código: fusionar (mantener el existente) o bifurcar (código nuevo). */
export type Resolution = Record<string, 'merge' | 'fork'>;

/** Precios "iguales" dentro de medio céntimo (evita avisos por redondeo). */
const priceClose = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;
const normUd = (s: string): string => s.trim().toLowerCase();

/**
 * Detecta colisiones al copiar `items`: un código entrante presente en el banco
 * a otro PRECIO (tolerancia de céntimo) o con otra UNIDAD. Ambos envenenan el
 * descompuesto: el precio cambia el importe; la unidad cambia el SIGNIFICADO de
 * la cantidad (autorizada contra la unidad de origen). Una descripción distinta
 * al mismo precio+unidad es ruido cosmético y se fusiona en silencio (Codex: no
 * avisar por ruido). %CI nunca colisiona. Un código por colisión.
 */
export function detectCollisions(items: RefCopyItem[], recursos: Banco): Collision[] {
  const seen = new Map<string, Collision>();
  for (const it of items) {
    for (const r of it.partida.items) {
      if (r.type === '%CI' || seen.has(r.code)) continue;
      const ex = recursos[r.code];
      if (!ex) continue; // no existe → se integra sin más, no es colisión
      const incoming: RecursoVals = { desc: r.desc ?? '', ud: r.ud ?? '', precio: r.precio ?? 0 };
      if (!priceClose(ex.precio, incoming.precio) || normUd(ex.ud) !== normUd(incoming.ud)) {
        seen.set(r.code, {
          code: r.code,
          existing: { desc: ex.desc, ud: ex.ud, precio: ex.precio },
          incoming,
        });
      }
    }
  }
  return [...seen.values()];
}
