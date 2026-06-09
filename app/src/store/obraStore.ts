/* ===========================================================================
   store/obraStore — estado global de la obra (Zustand + Immer).
   ---------------------------------------------------------------------------
   Reúne el estado de DOMINIO (capítulos, partidas, banco, certs, tasas, obra),
   sembrado desde `core/seed`, con el estado de UI (vista activa, capítulo
   seleccionado, capítulos desplegados, certificación en curso). Las tasas son
   estado del store, NUNCA globals mutados (§8 del plan; era un hack del
   prototipo `window.IVA_RATE`).

   Alcance F1: estado sembrado + acciones básicas (setView/setActive/setRates/
   onCertEdit). El CRUD completo (mover/borrar/añadir partidas, editar medición
   y recursos, sincronizar `precio` con el descompuesto) es de F2; el store queda
   preparado pero esas acciones no se implementan aquí.
   =========================================================================== */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Banco, Cert, Chapter, MedLine, Obra, PartidasMap, Rates } from '../core/types';
import { buildRecursos, precioCuadraDescompuesto, precioSegunModo } from '../core/banco';
import { estaCertToOrigen, prevDataOf } from '../core/certificacion';
import { round2 } from '../core/money';
import { CHAPTERS, DEFAULT_OBRA, DEFAULT_RATES, PARTIDAS, makeCertsInit } from '../core/seed';
import type { View } from '../layout/types';

/** Selección especial del sidebar: "Toda la obra". */
export const ALL = '__ALL__';

/**
 * Versión del shape serializable de la obra (§0 decisión 4: schemaVersion +
 * ruta de migración desde el día uno). F6 (Dexie) persiste `ObraData` y migra
 * versiones < SCHEMA_VERSION en `fromSerializable`; aquí sólo nace versionado.
 */
export const SCHEMA_VERSION = 1;

/** Modo de edición de una certificación: importe a origen vs. de esta cert. */
export type CertMode = 'origen' | 'esta';

/**
 * Secuencia para códigos de recurso nuevos (F2.3, "añadir concepto"). Monótona
 * por sesión; el prefijo `r·` no colisiona con los códigos de banco del seed
 * (mo001/mq…/E…). La generación robusta de ids es competencia de F6 (persistencia).
 */
let recursoSeq = 0;
function nextRecursoCode(): string {
  recursoSeq += 1;
  return `r·${recursoSeq}`;
}

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
}

export interface ObraState extends ObraData {
  /* ---- estado de UI ---- */
  /** Vista activa (tabs). */
  view: View;
  /** Capítulo/subcapítulo seleccionado, o `__ALL__` para toda la obra. */
  active: string;
  /** Capítulos desplegados en el sidebar (id → abierto). */
  expanded: Record<string, boolean>;
  /** Índice de la certificación en curso dentro de `certs`. */
  curCert: number;

  /* ---- acciones (F1) ---- */
  setView: (v: View) => void;
  setActive: (id: string) => void;
  /**
   * Despliega/colapsa un capítulo en el árbol del sidebar (estado de UI).
   * `force` fija el estado (true = desplegar) en vez de alternar; lo usa
   * "añadir subcapítulo" para abrir el padre antes de crear (F2.4).
   */
  toggleExpanded: (chId: string, force?: boolean) => void;
  /** Edita una o varias tasas (iva/gg/bi/coefK) sin tocar globals. */
  setRates: (patch: Partial<Rates>) => void;
  /** Selecciona la certificación en curso por índice. */
  setCurCert: (index: number) => void;
  /**
   * Edita la cantidad ejecutada de una partida en la cert en curso.
   * En modo `origen` guarda el valor como cantidad A ORIGEN; en modo `esta`
   * convierte el valor tecleado (cantidad de ESTA cert) a origen con
   * `core/certificacion.estaCertToOrigen` = round2(max(0, anterior + v)).
   */
  onCertEdit: (partidaId: string, value: number, mode: CertMode) => void;

  /* ---- acciones F2 (edición in-situ de partidas) ---- */
  /** Edita un campo de texto de la partida (title/ud/code/desc) y quita el chip BASE. */
  editPartidaField: (
    chapterId: string,
    partidaId: string,
    field: 'title' | 'ud' | 'code' | 'desc',
    value: string,
  ) => void;
  /**
   * Fija el precio unitario A MANO: lo marca como override (`precioManual`) para
   * que el sync de recursos (F2.3) no lo colapse al descompuesto, y quita el chip
   * BASE. Ignora valores no finitos o negativos (frontera de invariantes).
   */
  setPrecio: (chapterId: string, partidaId: string, value: number) => void;
  /** Añade una línea de medición vacía (dimensiones en blanco = factor 1). */
  addMedLine: (chapterId: string, partidaId: string) => void;
  /** Edita un campo de una línea de medición (comentario o dimensión). */
  editMedLine: <K extends keyof MedLine>(
    chapterId: string,
    partidaId: string,
    index: number,
    field: K,
    value: MedLine[K],
  ) => void;
  /** Elimina una línea de medición. */
  deleteMedLine: (chapterId: string, partidaId: string, index: number) => void;

  /* ---- acciones F2.3 (justificación del precio / banco compartido, T9) ---- */
  /**
   * Edita un concepto del banco POR CÓDIGO (desc/ud/precio): afecta a TODAS las
   * partidas que lo usan. Al cambiar el `precio`, resincroniza `precio =
   * descompUnit` en las partidas SIN override (`precioManual` falso) → la cadena
   * recurso→importe→PEM (T9). `desc`/`ud` no alteran el descompuesto.
   */
  editRecurso: (code: string, field: 'desc' | 'ud' | 'precio', value: string | number) => void;
  /** Edita el rendimiento (cantidad propia de la partida) de un concepto y resincroniza el precio. */
  editItemCantidad: (
    chapterId: string,
    partidaId: string,
    itemIndex: number,
    value: number,
  ) => void;
  /** Añade un concepto MAT vacío (con su entrada nueva en el banco) y resincroniza. */
  addItem: (chapterId: string, partidaId: string) => void;
  /** Elimina un concepto de la justificación y resincroniza el precio. */
  deleteItem: (chapterId: string, partidaId: string, itemIndex: number) => void;

  /** Restaura el estado sembrado (datos + UI). Útil en tests y para "nueva obra". */
  reset: () => void;
}

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
  };
}

/** Extrae el estado de dominio serializable (sin estado de UI). Lo usa F6. */
export function toSerializable(s: ObraData): ObraData {
  return {
    schemaVersion: SCHEMA_VERSION,
    chapters: s.chapters,
    partidas: s.partidas,
    recursos: s.recursos,
    certs: s.certs,
    rates: s.rates,
    obra: s.obra,
  };
}

/**
 * Valida/migra un `ObraData` cargado. Punto único donde F6 (Dexie) enchufará la
 * ruta de migración de versiones antiguas; hoy sólo acepta la versión vigente.
 */
export function fromSerializable(data: ObraData): ObraData {
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion ${data.schemaVersion} no soportada (esperada ${SCHEMA_VERSION}); falta migración (F6).`,
    );
  }
  return data;
}

/** Estado de UI inicial (sincronizado con el nº de certs sembradas). */
function seedUi(certs: Cert[]) {
  return {
    view: 'presupuesto' as View,
    active: '01',
    expanded: { '01': true } as Record<string, boolean>,
    curCert: Math.max(0, certs.length - 1), // la última cert queda en curso
  };
}

export const useObraStore = create<ObraState>()(
  immer((set) => {
    const data = seedObraData();
    return {
      ...data,
      ...seedUi(data.certs),

      setView: (v) =>
        set((s) => {
          s.view = v;
        }),

      setActive: (id) =>
        set((s) => {
          s.active = id;
        }),

      toggleExpanded: (chId, force) =>
        set((s) => {
          s.expanded[chId] = force ?? !s.expanded[chId];
        }),

      setRates: (patch) =>
        set((s) => {
          // El store es la frontera de invariantes: ignora valores no finitos y
          // fuera de rango (un NaN o IVA negativo envenenaría TODOS los totales).
          // coefK debe ser > 0 (un 0 anularía el PEM); el resto, ≥ 0.
          (Object.keys(patch) as (keyof Rates)[]).forEach((k) => {
            const v = patch[k];
            if (typeof v !== 'number' || !Number.isFinite(v)) return;
            if (k === 'coefK' ? v <= 0 : v < 0) return;
            s.rates[k] = v;
          });
        }),

      setCurCert: (index) =>
        set((s) => {
          // Clampa al rango válido de certs (evita una selección fuera de rango).
          s.curCert = Math.max(0, Math.min(index, s.certs.length - 1));
        }),

      onCertEdit: (partidaId, value, mode) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          if (mode === 'esta') {
            const prev = prevDataOf(s.certs, s.curCert)[partidaId] ?? 0;
            cert.data[partidaId] = estaCertToOrigen(prev, value);
          } else {
            // A origen: desviación CONSCIENTE del prototipo (que guardaba v crudo).
            // La cantidad ejecutada no puede ser negativa; round2 = 2 decimales,
            // consistente con `estaCertToOrigen` y con el seed (`makeCertsInit`),
            // que también redondean la cantidad a origen.
            cert.data[partidaId] = round2(Math.max(0, value));
          }
        }),

      editPartidaField: (chapterId, partidaId, field, value) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          p[field] = value;
          p.fromBase = false; // editar confirma la partida: se va el chip BASE
        }),

      setPrecio: (chapterId, partidaId, value) =>
        set((s) => {
          // El precio envenena el importe/PEM: ignora NaN/±∞ y negativos.
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          p.precio = value;
          p.precioManual = true; // override: el precio deja de seguir al descompuesto
          p.fromBase = false;
        }),

      addMedLine: (chapterId, partidaId) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          p.med.push({ comment: '', uds: '', largo: '', ancho: '', alto: '' });
          p.fromBase = false;
        }),

      editMedLine: (chapterId, partidaId, index, field, value) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          const line = p?.med[index];
          if (!p || !line) return;
          line[field] = value;
          p.fromBase = false;
        }),

      deleteMedLine: (chapterId, partidaId, index) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p || index < 0 || index >= p.med.length) return;
          p.med.splice(index, 1);
          p.fromBase = false;
        }),

      editRecurso: (code, field, value) =>
        set((s) => {
          const r = s.recursos[code];
          if (!r) return;
          if (field === 'precio') {
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
            r.precio = value;
            // T9: el cambio de precio del banco se propaga a TODAS las partidas
            // sin override (precioManual). precioSegunModo deja fijas las override
            // y las sin items; el resto pasan a su descompuesto recalculado.
            for (const ch in s.partidas)
              for (const p of s.partidas[ch] ?? []) p.precio = precioSegunModo(p, s.recursos);
          } else {
            // desc/ud: no alteran el descompuesto → no hay resync.
            if (typeof value !== 'string') return;
            r[field] = value;
          }
        }),

      editItemCantidad: (chapterId, partidaId, itemIndex, value) =>
        set((s) => {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          const it = p?.items[itemIndex];
          if (!p || !it) return;
          it.cantidad = value;
          p.fromBase = false;
          p.precio = precioSegunModo(p, s.recursos);
        }),

      addItem: (chapterId, partidaId) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p) return;
          const code = nextRecursoCode();
          s.recursos[code] = { type: 'MAT', desc: '', ud: 'ud', precio: 0 };
          p.items.push({ code, type: 'MAT', cantidad: 1 });
          p.fromBase = false;
          p.precio = precioSegunModo(p, s.recursos); // precio 0 → descompuesto sin cambio
        }),

      deleteItem: (chapterId, partidaId, itemIndex) =>
        set((s) => {
          const p = s.partidas[chapterId]?.find((x) => x.id === partidaId);
          if (!p || itemIndex < 0 || itemIndex >= p.items.length) return;
          p.items.splice(itemIndex, 1);
          p.fromBase = false;
          p.precio = precioSegunModo(p, s.recursos);
        }),

      reset: () =>
        set((s) => {
          // Object.assign desde seedObraData(): añadir un campo a ObraData lo
          // resetea automáticamente (sin drift silencioso campo-a-campo).
          const fresh = seedObraData();
          Object.assign(s, fresh);
          Object.assign(s, seedUi(fresh.certs));
        }),
    };
  }),
);
