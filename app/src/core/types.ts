/* ===========================================================================
   core/types — modelo de dominio (portado de data.js/refdata.js).
   Tipos canónicos, agnósticos de React. Los precios van en EUROS (float de 2
   decimales, como el banco de precios); la aritmética de IMPORTES se hace en
   céntimos enteros en `core/money` (acumulación exacta, §0 decisión 2).
   =========================================================================== */

export type ResourceType = 'MO' | 'MQ' | 'MAT' | '%CI';

/** Línea de medición: uds × largo × ancho × alto. Dimensión vacía = factor 1. */
export interface MedLine {
  /**
   * Id estable de la línea (F4): la certificación por líneas guarda un SNAPSHOT
   * de cantidad por `id` (`Cert.lineQty`), así que el id debe sobrevivir a editar
   * otras líneas. Lo asigna `addMedLine` (store) y el normalizador del seed.
   */
  id: string;
  comment: string;
  uds: number | '';
  largo: number | '';
  ancho: number | '';
  alto: number | '';
}

/**
 * Línea de justificación de precio dentro de una partida. En runtime sólo
 * `code/type/cantidad` son propios de la partida; `desc/ud/precio` viven en el
 * banco (por `code`) y aquí sólo aparecen en datos semilla para sembrarlo.
 * `%CI` es especial: no es un recurso, es un % sobre el coste directo.
 */
export interface Item {
  code: string;
  type: ResourceType;
  cantidad: number; // rendimiento, propio de la partida
  desc?: string;
  ud?: string;
  precio?: number; // euros — sólo en semilla; en runtime se lee del banco
}

/** Concepto del banco de recursos compartido (indexado por `code`). */
export interface Recurso {
  type: ResourceType;
  desc: string;
  ud: string;
  precio: number; // euros
}

export interface Partida {
  id: string;
  sub?: string;
  pos: string;
  code: string;
  title: string;
  ud: string;
  /**
   * Precio unitario EFECTIVO en EUROS (lo usa `partidaImporte`). §0 decisión 6:
   * por defecto = `descompUnit(items)` (suma de la justificación); el store lo
   * recalcula al editar recursos mientras `precioManual` sea falsy. Si el usuario
   * lo escribe a mano → `precioManual=true` y queda fijo (override señalizado).
   */
  precio: number;
  /** Override manual del precio: si true, `precio` no se recalcula del descompuesto. */
  precioManual?: boolean;
  cantidad?: number; // cantidad fija si no hay medición
  desc: string;
  med: MedLine[];
  items: Item[];
  mainType?: ResourceType; // badge de tipo dominante
  fromBase?: boolean; // chip "BASE" hasta que se edita
  contradictorio?: boolean; // chip "P.C."
  baseSource?: string;
}

export interface SubChapter {
  id: string;
  code: string;
  title: string;
}

export interface Chapter {
  id: string;
  code: string;
  title: string;
  children?: SubChapter[];
}

/**
 * Línea de precio contradictorio (F4.4): trabajo extra acordado en obra que NO
 * está en el presupuesto. Vive DENTRO de la certificación (no toca `partidas`
 * ni el PEM base — eng-review F4 §4). `precio` es el precio EFECTIVO acordado:
 * NO se escala por el coeficiente K (a diferencia de las partidas, el K es la
 * baja de adjudicación y el contradictorio ya se pacta a precio final).
 */
export interface CertExtra {
  id: string;
  chapterId: string; // capítulo al que cuelga (agrupación y subtotales)
  pos: string; // "C1", "C2"… posición dentro del capítulo
  title: string;
  ud: string;
  cantidad: number; // ejecutada A ORIGEN (como `Cert.data`)
  precio: number; // euros, precio efectivo (sin K)
}

/** Certificación: `data[partidaId]` = cantidad ejecutada A ORIGEN. */
export interface Cert {
  id: string;
  num: number;
  period: string;
  retencion: number; // 0..1
  data: Record<string, number>;
  /**
   * Certificación por líneas (F4.3): cantidad ejecutada por línea de medición,
   * CONGELADA al marcar (snapshot). `lineQty[partidaId][lineId]` = cantidad de
   * esa línea hecha en ESTA cert (= su parcial si entera, o menos si parcial).
   * `data[partidaId]` = Σ lineQty cuando la partida se certifica por líneas;
   * teclear la cantidad a mano borra `lineQty[partidaId]` (override). Estable
   * frente a editar la medición después (la cert no cambia sola).
   */
  lineQty?: Record<string, Record<string, number>>;
  /** Precios contradictorios de ESTA cert (F4.4). Ver `CertExtra`. */
  extras?: CertExtra[];
}

/** Tasas económicas. Estado del store, NUNCA globals mutados (§8 riesgos). */
export interface Rates {
  iva: number; // p.ej. 0.10 | 0.21
  gg: number; // gastos generales, p.ej. 0.13
  bi: number; // beneficio industrial, p.ej. 0.06
  /**
   * Coeficiente K global de obra (FIEBDC `~K`): escala los precios unitarios
   * para cuadrar el PEM a una cifra objetivo (alza o baja). 1 = sin ajuste.
   * Requisito de dominio del spike §0.5 / `TODOS.md` T-8.
   */
  coefK: number;
}

export interface Obra {
  denominacion: string;
  direccion: string;
  localidad: string;
  [k: string]: unknown; // promotor/constructor/redactor… se completan en F6
}

/** Banco de recursos indexado por código. */
export type Banco = Record<string, Recurso>;

/** Partidas agrupadas por id de capítulo. */
export type PartidasMap = Record<string, Partida[]>;
