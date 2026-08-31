/* ===========================================================================
   store/schema — shape serializable de la obra + migraciones (F-04).
   ---------------------------------------------------------------------------
   Extraído de `obraStore` (F-04): reúne el estado de DOMINIO serializable
   (`ObraData`), su versión de esquema, las migraciones en cadena y las
   funciones de seed/serialización. NO depende del store (solo de `core/`), así
   la capa de persistencia (`persist/`) lo consume sin arrastrar las ~53
   acciones del store.
   =========================================================================== */
import type { Banco, Cert, Chapter, Obra, PartidaBaja, PartidasMap, Rates } from '../core/types';
import { buildRecursos, precioCuadraDescompuesto, recursoUsage } from '../core/banco';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS, makeCertsInit } from '../core/seed';
import { nextAgenteId } from './base';

/**
 * Versión del shape serializable de la obra (§0 decisión 4: schemaVersion +
 * ruta de migración desde el día uno). `fromSerializable` migra en CADENA las
 * versiones < SCHEMA_VERSION (hydrate de IndexedDB e import .json pasan ambos
 * por ahí); las > SCHEMA_VERSION se rechazan (archivo de una app más nueva).
 *
 *   v1 → v2 (2026-06-12, jerarquía N niveles): `SubChapter` pasa a ser
 *   recursivo (`children?`). Migración IDENTIDAD: un árbol de 2 niveles ya es
 *   un caso degenerado válido del recursivo; solo se sella la versión.
 *
 *   v2 → v3 (2026-07-03, tombstones de la auditoría): nuevo mapa `bajas` con
 *   el rastro (code/title/ud) de las partidas borradas que alguna cert tiene
 *   certificadas — así «Eliminado del presupuesto» las muestra CON NOMBRE.
 *   Migración: `bajas: {}` (los borrados anteriores a v3 no dejaron rastro y
 *   salen como fila genérica).
 *
 *   v3 → v4 (2026-07-04, pies de firma por rol): la firma única
 *   (`obra.redactor` + `obra.lugar` + `obra.fecha`) se sustituye por
 *   `obra.direccionFacultativa: Agente[]`. Migración: siembra un «Director de
 *   obra» desde el `redactor` si tenía nombre y BORRA los campos viejos (limpia,
 *   no datos muertos).
 *
 *   v4 → v5 (2026-08-31, costes indirectos de obra): `rates.ci` (fracción de CI
 *   sobre los costes directos, DENTRO del PEM). Migración: `ci: 0` — la obra
 *   guardada se presupuestó sin esa línea, así que su PEM no puede moverse al
 *   abrirla; quien quiera el CI lo pone en la hoja Resumen.
 */
export const SCHEMA_VERSION = 5;

/** Estado de dominio de la obra (lo que persistiría en F6). Serializable. */
export interface ObraData {
  /** Versión del shape (para migración al cargar; ver SCHEMA_VERSION). */
  schemaVersion: number;
  chapters: Chapter[];
  partidas: PartidasMap;
  recursos: Banco;
  certs: Cert[];
  rates: Rates;
  obra: Obra;
  /** Tombstones (v3): partidas borradas con importe certificado, por id — las
   *  certs las muestran CON NOMBRE en «Eliminado del presupuesto». Ver
   *  `PartidaBaja` (core/types). */
  bajas: Record<string, PartidaBaja>;
}

/**
 * Claves MUTABLES del dominio (todo `ObraData` salvo `schemaVersion`, que es
 * constante en runtime). FUENTE ÚNICA para las tres suscripciones/vistas del
 * dominio: el autosave (`persist/sync.domainSlice`), el historial de undo
 * (`store/temporal.partialize`) y esta serialización. La auditoría 2026-07-05
 * encontró las listas divergidas (el autosave omitía `bajas`); derivarlas de
 * aquí convierte el drift en imposible.
 */
export const DOMAIN_KEYS = [
  'chapters',
  'partidas',
  'recursos',
  'certs',
  'rates',
  'obra',
  'bajas',
] as const satisfies readonly (keyof ObraData)[];
export type DomainKey = (typeof DOMAIN_KEYS)[number];

/** Exhaustividad EN COMPILACIÓN: añadir un campo a `ObraData` sin listarlo en
 *  `DOMAIN_KEYS` (o excluirlo aquí a propósito, como `schemaVersion`) rompe el
 *  build nombrando la clave que falta — el drift silencioso era el bug. */
type MissingDomainKey = Exclude<keyof ObraData, 'schemaVersion' | DomainKey>;
const domainKeysExhaustive: MissingDomainKey extends never
  ? true
  : ['falta en DOMAIN_KEYS:', MissingDomainKey] = true;
void domainKeysExhaustive;

/**
 * Construye el estado de dominio desde `core/seed`. Clona partidas/capítulos
 * (en F2 se mutan), deriva el banco con `buildRecursos` y siembra el histórico
 * de certificaciones. Las tasas y la obra se copian (no se comparte referencia
 * con el seed para no contaminarlo entre stores/tests).
 */
export function seedObraData(): ObraData {
  const partidas = structuredClone(PARTIDAS);
  const recursos = buildRecursos(partidas);
  // §0 decisión 6: el precio de una partida semilla/importada es AUTORIDAD de la
  // fuente. La descomposición demo es ilustrativa y no siempre suma al precio
  // (p111: descompUnit 9,27 € vs precio 18,42 €). Sin marcar override, el sync de
  // recursos de F2 (precioSegunModo) colapsaría el precio al descompuesto y el PEM
  // dejaría de cuadrar. Marcamos override donde no cuadra → precio fijo y seguro;
  // la señal de override (data-driven, precio≠descompUnit) sigue saltando igual.
  for (const ps of Object.values(partidas))
    for (const p of ps) if (!precioCuadraDescompuesto(p, recursos)) p.precioManual = true;
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: structuredClone(CHAPTERS),
    partidas,
    recursos,
    certs: makeCertsInit(partidas),
    rates: { ...DEFAULT_RATES },
    obra: { ...DEFAULT_OBRA },
    bajas: {},
  };
}

/**
 * Obra EN BLANCO para "nueva obra" (multi-obra, T-10): sin capítulos/partidas/
 * recursos, una certificación vacía lista para editar, tasas por defecto. No
 * arrastra el contenido demo del seed (eso confundiría: cada obra nueva con
 * "Movimiento de tierras" de ejemplo). El usuario añade capítulos con el "+".
 */
export function blankObraData(name = 'Obra nueva'): ObraData {
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: [],
    partidas: {},
    recursos: {},
    certs: [{ id: 'c1', num: 1, period: '', retencion: 0, data: {} }],
    rates: { ...DEFAULT_RATES },
    obra: { denominacion: name, direccion: '', localidad: '' },
    bajas: {},
  };
}

/** Extrae el estado de dominio serializable (sin estado de UI). Lo usa F6. */
export function toSerializable(s: ObraData): ObraData {
  // D-04 (GC conservador): fuera la BASURA de `addItem` cancelados — recursos
  // que ya no usa ninguna partida Y siguen vacíos (sin desc y precio 0). Los
  // sin uso CON datos se conservan a propósito (memoria de precios del banco).
  const usage = recursoUsage(s.partidas);
  let recursos = s.recursos;
  const junk = Object.keys(recursos).filter((code) => {
    const r = recursos[code]!;
    return !usage[code] && !r.desc && !(r.precio > 0);
  });
  if (junk.length > 0) {
    recursos = { ...recursos };
    for (const code of junk) delete recursos[code];
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: s.chapters,
    partidas: s.partidas,
    recursos,
    certs: s.certs,
    rates: s.rates,
    obra: s.obra,
    bajas: s.bajas,
  };
}

/**
 * Migraciones de esquema: `MIGRATIONS[v]` transforma un `ObraData` de la
 * versión `v` a la `v+1`. Se aplican en cadena hasta `SCHEMA_VERSION`.
 */
const MIGRATIONS: Record<number, (d: ObraData) => ObraData> = {
  // v1 → v2 (jerarquía N niveles): identidad estructural — el shape de 2
  // niveles ya es un árbol recursivo degenerado; solo sube la versión.
  1: (d) => ({ ...d, schemaVersion: 2 }),
  // v2 → v3 (tombstones): estrena `bajas` vacío (v2 no registraba borrados).
  2: (d) => ({ ...d, bajas: {}, schemaVersion: 3 }),
  // v3 → v4 (pies de firma por rol): siembra `direccionFacultativa` desde el
  // `redactor` viejo (si tenía nombre) y borra `redactor`/`lugar`/`fecha`.
  3: (d) => {
    const obra = { ...d.obra } as Record<string, unknown>;
    const redactor = obra.redactor as { nombre?: unknown; colegiado?: unknown } | undefined;
    const nombre = typeof redactor?.nombre === 'string' ? redactor.nombre : '';
    delete obra.redactor;
    delete obra.lugar;
    delete obra.fecha;
    if (nombre.trim()) {
      obra.direccionFacultativa = [
        {
          id: nextAgenteId(),
          rol: 'Director de obra',
          nombre,
          colegiado: typeof redactor?.colegiado === 'string' ? redactor.colegiado : '',
        },
      ];
    }
    return { ...d, obra: obra as unknown as Obra, schemaVersion: 4 };
  },
  // v4 → v5 (costes indirectos de obra): estrena `rates.ci` en 0 — el PEM de una
  // obra ya guardada no se mueve al abrirla (ver SCHEMA_VERSION).
  4: (d) => ({ ...d, rates: { ...d.rates, ci: 0 }, schemaVersion: 5 }),
};

/**
 * Valida/migra un `ObraData` cargado (hydrate de IndexedDB e import .json).
 * Migra en cadena las versiones antiguas; rechaza las desconocidas (más nuevas
 * que la app, o tan viejas que no hay ruta).
 */
export function fromSerializable(data: ObraData): ObraData {
  let d = data;
  while (d.schemaVersion < SCHEMA_VERSION) {
    const mig = MIGRATIONS[d.schemaVersion];
    if (!mig) break; // sin ruta → cae al rechazo de abajo
    d = mig(d);
  }
  if (d.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion ${data.schemaVersion} no soportada (esperada ≤ ${SCHEMA_VERSION}); sin ruta de migración.`,
    );
  }
  return d;
}
