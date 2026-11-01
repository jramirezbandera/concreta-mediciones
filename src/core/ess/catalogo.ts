// =============================================================================
// El catálogo de fichas del estudio básico de seguridad y salud (feature-35,
// paso 3). DATOS versionados, como las tablas de la app, y ayudas puras.
//
// 89 entradas del análisis (research/analisis-ejemplos-ebss.md §4.3–4.7) y 4
// huecos del §4.8 redactados por la app (decisión 11), en cinco grupos:
// instalaciones provisionales (IP), fases de obra (F), medios auxiliares y
// protecciones colectivas (MA), maquinaria (M) y trabajos posteriores (TP).
// Los nombres de riesgo son los de K-SYS.15; las cifras, las de K-SYS.16 (las
// marcadas ⚠ en el análisis van sin cifra). Lo que la obra no tiene no se
// imprime (K-SYS.12): la app propone (paso 4) y el proyectista marca o quita.
// =============================================================================

import { tabla } from './tabla';
import {
  NOMBRE_GRUPO,
  type ApartadoAnexoII,
  type ClaveRiesgo,
  type FichaCatalogo,
  type GrupoFicha,
  type ItemFicha,
  type RiesgoFicha,
} from './tipos';
import { INSTALACIONES_PROVISIONALES } from './catalogo/instalaciones';
import { FASES_1 } from './catalogo/fases1';
import { FASES_2 } from './catalogo/fases2';
import { MEDIOS_AUXILIARES } from './catalogo/medios';
import { MAQUINARIA } from './catalogo/maquinaria';
import { TRABAJOS_POSTERIORES } from './catalogo/posteriores';

// ── Nombres de riesgo (K-SYS.15) ─────────────────────────────────────────────

/**
 * Los 28 nombres de riesgo, con sus claves. No hay terminología reglamentaria:
 * es la lista de «formas de accidente» del método general de evaluación del
 * INSST, con las exposiciones nombradas como el real decreto que las regula.
 */
export const NOMBRES_RIESGO = tabla(
  {
    db: 'INSST, método general de evaluación (formas de accidente); exposiciones según RD 286/2006, RD 1311/2005, RD 374/2001, RD 396/2006',
    edicion: 'K-SYS.15 (INTERPRETACIÓN)',
    fecha: '2026-10-16',
    fuente: 'research/verificacion-seguridad-salud.md',
  },
  {
    distinto: 'Caída de personas a distinto nivel',
    mismo: 'Caída de personas al mismo nivel',
    desplome: 'Caída de objetos por desplome o derrumbamiento',
    manipulacion: 'Caída de objetos en manipulación',
    desprendidos: 'Caída de objetos desprendidos',
    pisadas: 'Pisadas sobre objetos',
    'choque-inmoviles': 'Choques contra objetos inmóviles',
    'choque-moviles': 'Choques contra objetos móviles',
    golpes: 'Golpes o cortes por objetos o herramientas',
    proyeccion: 'Proyección de fragmentos o partículas',
    atrapamiento: 'Atrapamiento por o entre objetos',
    vuelco: 'Atrapamiento por vuelco de máquinas o vehículos',
    sobreesfuerzos: 'Sobreesfuerzos',
    temperaturas: 'Exposición a temperaturas ambientales extremas',
    termicos: 'Contactos térmicos',
    electrico: 'Contactos eléctricos',
    nocivas: 'Exposición a sustancias nocivas o tóxicas',
    causticas: 'Contactos con sustancias cáusticas o corrosivas',
    radiaciones: 'Exposición a radiaciones',
    explosiones: 'Explosiones',
    incendios: 'Incendios',
    'seres-vivos': 'Accidentes causados por seres vivos',
    atropellos: 'Atropellos o golpes con vehículos',
    quimicos: 'Exposición a agentes químicos',
    biologicos: 'Exposición a agentes biológicos',
    ruido: 'Exposición al ruido',
    vibraciones: 'Exposición a vibraciones',
    amianto: 'Exposición al amianto',
  } satisfies Record<ClaveRiesgo, string>,
);

/** El nombre literal de una clave de riesgo. */
export const nombreRiesgo = (clave: ClaveRiesgo): string => NOMBRES_RIESGO.datos[clave];

// ── Anexo II del RD 1627/1997 (K-SYS.4) ──────────────────────────────────────

/**
 * Los diez apartados del anexo II, en resumen (no es el literal: el estudio
 * los cita por número). Qué ficha activa cada uno es INTERPRETACIÓN.
 */
export const ANEXO_II = tabla(
  {
    db: 'RD 1627/1997',
    edicion: 'consolidado BOE, última modificación 23-03-2010',
    fecha: '2026-10-16',
    articulo: 'anexo II',
    fuente: 'research/verificacion-seguridad-salud.md (K-SYS.4)',
  },
  {
    1: 'Sepultamiento, hundimiento o caída de altura con riesgo especialmente grave',
    2: 'Exposición a agentes químicos o biológicos de especial gravedad, o con vigilancia específica de la salud exigible',
    3: 'Exposición a radiaciones ionizantes con zonas controladas o vigiladas',
    4: 'Proximidad de líneas eléctricas de alta tensión',
    5: 'Riesgo de ahogamiento por inmersión',
    6: 'Excavación de túneles, pozos y otros movimientos de tierra subterráneos',
    7: 'Inmersión con equipo subacuático',
    8: 'Cajones de aire comprimido',
    9: 'Uso de explosivos',
    10: 'Montaje o desmontaje de elementos prefabricados pesados',
  } satisfies Record<ApartadoAnexoII, string>,
);

export const APARTADOS_ANEXO_II: readonly ApartadoAnexoII[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ── El catálogo ──────────────────────────────────────────────────────────────

const FICHAS: readonly FichaCatalogo[] = [
  ...INSTALACIONES_PROVISIONALES,
  ...FASES_1,
  ...FASES_2,
  ...MEDIOS_AUXILIARES,
  ...MAQUINARIA,
  ...TRABAJOS_POSTERIORES,
];

/** Las fichas, con su procedencia: el análisis de los 15 estudios y las verificaciones K-SYS. */
export const CATALOGO_EBSS = tabla(
  {
    db: 'Catálogo EBSS (análisis de ejemplos + K-SYS.15–16)',
    edicion: '2026-10-18 (feature-35, paso 3)',
    fecha: '2026-10-18',
    fuente: 'research/analisis-ejemplos-ebss.md §4; research/verificacion-seguridad-salud.md',
  },
  FICHAS,
);

export const FICHAS_EBSS: readonly FichaCatalogo[] = CATALOGO_EBSS.datos;

/** Las fichas del análisis, con fuentes: 89. Las redactadas por la app (4) quedan fuera. */
export const fichasDelAnalisis = (): FichaCatalogo[] =>
  FICHAS_EBSS.filter((f) => !f.redactadaPorApp);

/** Las fichas de los huecos del §4.8 redactadas por la app (decisión 11). */
export const fichasRedactadasPorApp = (): FichaCatalogo[] =>
  FICHAS_EBSS.filter((f) => f.redactadaPorApp === true);

export function fichaPorId(id: string): FichaCatalogo | undefined {
  return FICHAS_EBSS.find((f) => f.id === id);
}

export function fichasDeGrupo(grupo: GrupoFicha): FichaCatalogo[] {
  return FICHAS_EBSS.filter((f) => f.grupo === grupo);
}

/** El grupo que dicta el prefijo del id («MA1» → MA). */
export function grupoDeId(id: string): GrupoFicha | undefined {
  const m = /^(IP|F|MA|M|TP)\d+$/.exec(id);
  return m ? (m[1] as GrupoFicha) : undefined;
}

export const nombreGrupo = (grupo: GrupoFicha): string => NOMBRE_GRUPO[grupo];

// ── Ayudas sobre los textos ──────────────────────────────────────────────────

/** El texto de una medida, protección o EPI, tenga o no frecuencia. */
export const textoItem = (item: ItemFicha): string =>
  typeof item === 'string' ? item : item.texto;

/** Los riesgos de una ficha, con los que evita si es una protección colectiva. */
export function riesgosDeFicha(f: FichaCatalogo): RiesgoFicha[] {
  return [...(f.evita ?? []), ...f.riesgos];
}

/** Todo el texto de una ficha, en una cadena: para buscar y para el test de prohibidos. */
export function textoFicha(f: FichaCatalogo): string {
  const partes: string[] = [
    f.titulo,
    f.descripcion,
    ...riesgosDeFicha(f).map((x) => `${nombreRiesgo(x.clave)}${x.causa ? ` (${x.causa})` : ''}`),
    ...f.medidas.map(textoItem),
    ...f.protecciones.map(textoItem),
    ...f.epi.map(textoItem),
    ...(f.anexoII ?? []).map(
      (a) => `Anexo II, apartado ${a.apartado}${a.cuando ? `: ${a.cuando}` : ''}`,
    ),
    f.eficacia,
    ...(f.notas ?? []),
    ...(f.avisos ?? []),
    ...(f.previsiones ?? []),
    ...(f.informaciones ?? []),
  ];
  return partes.join('\n');
}

/** Todo el texto del catálogo, en una cadena. */
export function textoCatalogo(): string {
  return FICHAS_EBSS.map(textoFicha).join('\n\n');
}
