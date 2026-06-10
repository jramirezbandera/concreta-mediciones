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
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Banco, Cert, Chapter, MedLine, Obra, Partida, PartidasMap, Rates } from '../core/types';
import { buildRecursos, precioCuadraDescompuesto, precioSegunModo } from '../core/banco';
import { estaCertToOrigen, prevDataOf, sumLineQty } from '../core/certificacion';
import { round2 } from '../core/money';
import { renumberChapter } from '../core/numbering';
import type { ImportedObra } from '../core/bc3import';
import { REF_DESC, REF_SOURCES, type RefCopyItem, type RefDrag } from '../core/refdata';
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
 * Ids ÚNICOS por construcción (F6, eng-review run 5 / Tensión 1-B). Antes eran
 * contadores de sesión (`p·N`…) que arrancaban en 0 cada carga → al recargar una
 * obra persistida colisionaban. Peor: el id de línea `m·N` vive CONGELADO en los
 * snapshots de certificación (`Cert.lineQty`), así que rehidratar contadores
 * podía reusar un id que una cert vieja aún referencia (corrupción del cobro).
 * `crypto.randomUUID` elimina la clase entera: sin contadores, sin rehidratación,
 * sin escaneo que olvidar. El prefijo (`p-`/`r-`/`m-`/`x-`) sólo da legibilidad;
 * la unicidad la garantiza el uuid. Seed (`p111`) y bc3 (`b3-*`) ids son literales
 * (no salen de aquí) y no cambian.
 */
function uid(prefix: string): string {
  const c = globalThis.crypto;
  const raw = c?.randomUUID
    ? c.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${raw}`;
}
const nextRecursoCode = (): string => uid('r');
const nextPartidaId = (): string => uid('p');
const nextMedLineId = (): string => uid('m');
const nextExtraId = (): string => uid('x');

/**
 * Renumera `pos` de una lista de partidas EN SITIO (Immer-friendly), reusando la
 * regla pura de `core/numbering`. Sólo escribe `pos` sobre los drafts; descarta
 * los objetos intermedios → no contamina el árbol de Immer con copias.
 */
function renumberInPlace(ch: Chapter | undefined, list: Partida[]): void {
  const fresh = renumberChapter(ch, list);
  for (let i = 0; i < list.length; i++) list[i]!.pos = fresh[i]!.pos;
}

/** Destino de copia (F5): capítulo/sub seleccionado, o el primer capítulo si la
 *  selección es "Toda la obra"/vacía. `label` para la barra "Copiar a …". */
export interface CopyTarget {
  chId: string;
  subId: string | null;
  label: string;
}
export function copyTargetOf(chapters: Chapter[], active: string): CopyTarget {
  if (active !== ALL) {
    for (const ch of chapters) {
      if (ch.id === active) return { chId: ch.id, subId: null, label: `${ch.code} · ${ch.title}` };
      for (const sub of ch.children ?? [])
        if (sub.id === active) return { chId: ch.id, subId: sub.id, label: `${sub.code} · ${sub.title}` };
    }
  }
  const c = chapters[0];
  return c ? { chId: c.id, subId: null, label: `${c.code} · ${c.title}` } : { chId: '', subId: null, label: '' };
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
  /** Panel de Referencia abierto (F5). */
  refOpen: boolean;
  /** Fuente de referencia seleccionada (id de `REF_SOURCES`). */
  refSourceId: string;
  /** Ancho del panel en modo split (px, clamp 320–640). */
  refWidth: number;
  /** Arrastre en curso desde el panel Referencia (F5.2); null = nada arrastrándose. */
  refDrag: RefDrag | null;

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
  /**
   * Marca/desmarca una línea de medición como ejecutada en la cert en curso
   * (dogfood #3). `qty` = cantidad A ORIGEN de la línea (su parcial si entera;
   * menos si se certifica una parte); `null`/≤0 la desmarca. Resincroniza
   * `data[partidaId] = Σ lineQty[partidaId]` (a-origen, regla §1). La marca es
   * SIEMPRE a-origen, independiente del modo A origen/Esta cert (regla §2).
   */
  setCertLine: (partidaId: string, lineId: string, qty: number | null) => void;
  /**
   * Crea una certificación nueva al final y la deja en curso. Hereda de la
   * ÚLTIMA cronológica (no de la actual): `data` y `lineQty` a-origen (la
   * ejecución es acumulativa), la `retencion` y el periodo en blanco. Así "esta
   * certificación" arranca en 0 sobre lo ya certificado (eng-review F4 / Codex #6/#7).
   */
  addCert: () => void;
  /** Edita el periodo (texto) o la retención (0..1, se clampa) de la cert en curso. */
  setCertField: (field: 'period' | 'retencion', value: string | number) => void;
  /**
   * Añade un precio contradictorio (F4.4) al capítulo dado, DENTRO de la cert en
   * curso (no toca `partidas` ni el PEM base). `pos` = "C{n}" según los que ya
   * cuelgan del capítulo; campos a 0/'' para editar in-situ.
   */
  addContradictorio: (chapterId: string) => void;
  /** Edita un campo de un contradictorio de la cert en curso (cantidad/precio ≥ 0). */
  editContradictorio: (
    extraId: string,
    field: 'title' | 'ud' | 'cantidad' | 'precio',
    value: string | number,
  ) => void;
  /** Elimina un contradictorio de la cert en curso. */
  deleteContradictorio: (extraId: string) => void;

  /* ---- acciones F5 (panel Referencia) ---- */
  /** Abre/cierra el panel de Referencia; sin argumento alterna. */
  setRefOpen: (open?: boolean) => void;
  /** Selecciona la fuente de referencia activa (id de `REF_SOURCES`). */
  setRefSource: (id: string) => void;
  /** Fija el ancho del panel en split (se clampa a 320–640). */
  setRefWidth: (w: number) => void;
  /** Fija/limpia el payload de arrastre (drag&drop, F5.2). */
  setRefDrag: (drag: RefDrag | null) => void;
  /**
   * Reemplaza TODA la obra por una importada (F5.3, .bc3). Estampa la versión de
   * esquema, resetea la UI y deja la vista en el presupuesto, con el primer
   * capítulo activo. Igual que `reset` pero con datos importados en vez de seed.
   */
  loadObra: (data: ImportedObra) => void;
  /**
   * Copia partidas de una fuente de referencia al presupuesto (F5). Integra los
   * recursos de su descomposición en el banco SIN pisar los homónimos (coherencia);
   * crea cada partida con `med:[]`, items por código y marca `fromBase` (chip BASE)
   * o `contradictorio` (chip P.C.) según `contra`. `target` = capítulo/sub destino;
   * `null` = el capítulo/sub activo (`copyTargetOf`). Despliega el capítulo destino.
   */
  copyRefPartidas: (
    items: RefCopyItem[],
    target: { chId: string; subId: string | null } | null,
    contra: boolean,
  ) => void;

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

  /* ---- acciones F2.4 (CRUD estructural + renumeración) ---- */
  /** Añade un capítulo (código = max+1) y lo deja activo en la vista Presupuesto. */
  addChapter: (title: string) => void;
  /** Añade un subcapítulo al capítulo (código `<cap>.<n>`) y despliega el padre. */
  addSubchapter: (chapterId: string, title: string) => void;
  /** Elimina un capítulo y sus partidas; si estaba activo, salta a "Toda la obra". */
  deleteChapter: (chapterId: string) => void;
  /** Elimina un subcapítulo; sus partidas suben al capítulo (renumeradas). */
  deleteSubchapter: (chapterId: string, subId: string) => void;
  /** Añade una partida vacía al capítulo/subcapítulo, con su `pos` correlativa. */
  addPartida: (chapterId: string, subId: string | null) => void;
  /** Elimina una partida y renumera su capítulo. */
  deletePartida: (chapterId: string, partidaId: string) => void;
  /** Mueve una partida a otro capítulo/subcapítulo y renumera origen y destino. */
  movePartida: (fromChapterId: string, partidaId: string, toChapterId: string, toSubId: string | null) => void;

  /* ---- acciones F6.2 (datos de obra) ---- */
  /**
   * Edita un campo de los datos de obra por RUTA anidada (`'promotor.nif'`,
   * `'denominacion'`). Crea los objetos intermedios que falten (la obra semilla
   * solo trae los campos planos; promotor/constructor/redactor nacen al editarse).
   * Solo escribe strings (los campos del modal son inputs de texto).
   */
  setObraPath: (path: string, value: string) => void;

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
    refOpen: false,
    refSourceId: REF_SOURCES[0]?.id ?? '',
    refWidth: 400,
    refDrag: null as RefDrag | null,
  };
}

export const useObraStore = create<ObraState>()(
  subscribeWithSelector(
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
          // Teclear una cantidad/% es un override del total: deja de certificarse
          // por líneas (regresión §8a). Si no quedan líneas marcadas en la cert,
          // limpia el contenedor para no dejar `{}` huérfanos.
          if (cert.lineQty?.[partidaId]) {
            delete cert.lineQty[partidaId];
            if (Object.keys(cert.lineQty).length === 0) cert.lineQty = undefined;
          }
        }),

      setCertLine: (partidaId, lineId, qty) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          const lineQty = (cert.lineQty ??= {});
          const lines = (lineQty[partidaId] ??= {});
          if (qty == null || qty <= 0) {
            delete lines[lineId];
          } else {
            lines[lineId] = round2(qty);
          }
          if (Object.keys(lines).length === 0) {
            // Sin líneas marcadas: la partida deja de certificarse por líneas.
            delete lineQty[partidaId];
            delete cert.data[partidaId];
            if (Object.keys(lineQty).length === 0) cert.lineQty = undefined;
          } else {
            cert.data[partidaId] = sumLineQty(lines);
          }
        }),

      addCert: () =>
        set((s) => {
          const last = s.certs.at(-1);
          const num = (last?.num ?? 0) + 1;
          // Clonado superficial por nivel (no `structuredClone`: los valores son
          // drafts de Immer y el proxy no es clonable). data es plano; lineQty
          // tiene un nivel de anidación.
          const data: Record<string, number> = { ...(last?.data ?? {}) };
          let lineQty: Record<string, Record<string, number>> | undefined;
          if (last?.lineQty) {
            lineQty = {};
            for (const pid in last.lineQty) lineQty[pid] = { ...last.lineQty[pid] };
          }
          // Los contradictorios se heredan a-origen (mismo id → "anterior" cuadra).
          const extras = last?.extras?.map((e) => ({ ...e }));
          s.certs.push({
            id: `c${num}`,
            num,
            period: '',
            retencion: last?.retencion ?? 0,
            data,
            lineQty,
            extras,
          });
          s.curCert = s.certs.length - 1;
        }),

      setCertField: (field, value) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          if (field === 'period') {
            if (typeof value === 'string') cert.period = value;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            cert.retencion = Math.min(1, Math.max(0, value)); // retención ∈ [0,1]
          }
        }),

      addContradictorio: (chapterId) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert) return;
          const extras = (cert.extras ??= []);
          const n = extras.filter((e) => e.chapterId === chapterId).length + 1;
          extras.push({
            id: nextExtraId(),
            chapterId,
            pos: `C${n}`,
            title: '',
            ud: '',
            cantidad: 0,
            precio: 0,
          });
        }),

      editContradictorio: (extraId, field, value) =>
        set((s) => {
          const e = s.certs[s.curCert]?.extras?.find((x) => x.id === extraId);
          if (!e) return;
          if (field === 'title' || field === 'ud') {
            if (typeof value === 'string') e[field] = value;
          } else if (typeof value === 'number' && Number.isFinite(value)) {
            // cantidad/precio no pueden ser negativos; cantidad a 2 dec, precio
            // (dinero) a 2 dec también (coherente con el banco de precios).
            e[field] = round2(Math.max(0, value));
          }
        }),

      deleteContradictorio: (extraId) =>
        set((s) => {
          const cert = s.certs[s.curCert];
          if (!cert?.extras) return;
          cert.extras = cert.extras.filter((e) => e.id !== extraId);
          if (cert.extras.length === 0) cert.extras = undefined;
        }),

      setRefOpen: (open) =>
        set((s) => {
          s.refOpen = open ?? !s.refOpen;
        }),

      setRefSource: (id) =>
        set((s) => {
          s.refSourceId = id;
        }),

      setRefWidth: (w) =>
        set((s) => {
          s.refWidth = Math.max(320, Math.min(640, Math.round(w)));
        }),

      setRefDrag: (drag) =>
        set((s) => {
          s.refDrag = drag;
        }),

      loadObra: (data) =>
        set((s) => {
          Object.assign(s, { schemaVersion: SCHEMA_VERSION, ...data });
          Object.assign(s, seedUi(data.certs));
          const first = data.chapters[0]?.id;
          s.view = 'presupuesto';
          s.active = first ?? ALL;
          s.expanded = first ? { [first]: true } : {};
          s.refOpen = false;
        }),

      copyRefPartidas: (items, target, contra) =>
        set((s) => {
          if (!items.length) return;
          const t = target ?? copyTargetOf(s.chapters, s.active);
          const ch = s.chapters.find((c) => c.id === t.chId);
          if (!ch) return;
          const subId = t.subId;
          const sub = subId && ch.children ? ch.children.find((x) => x.id === subId) : undefined;
          const base = sub ? sub.code : ch.code;
          const list = (s.partidas[t.chId] ??= []);
          // 1) recursos al banco SIN pisar los homónimos (coherencia, §0).
          for (const it of items)
            for (const r of it.partida.items) {
              if (r.type === '%CI') continue;
              if (!s.recursos[r.code])
                s.recursos[r.code] = {
                  type: r.type,
                  desc: r.desc ?? '',
                  ud: r.ud ?? '',
                  precio: r.precio ?? 0,
                };
            }
          // 2) partidas nuevas (pos correlativa dentro del sub destino; el precio
          //    de la base es autoridad, igual que la semilla, sin recomputar).
          let sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub)).length;
          for (const it of items) {
            const p = it.partida;
            sameSub += 1;
            const newItems = p.items.map((r) =>
              r.type === '%CI'
                ? { code: '%CI', type: '%CI' as const, cantidad: r.cantidad }
                : { code: r.code, type: r.type, cantidad: r.cantidad },
            );
            list.push({
              id: nextPartidaId(),
              sub: subId || undefined,
              pos: `${base}.${sameSub}`,
              code: p.code,
              title: p.title,
              ud: p.ud,
              precio: p.precio,
              mainType: p.mainType,
              desc: REF_DESC[p.code] ?? '',
              med: [],
              items: newItems,
              fromBase: !contra,
              contradictorio: contra || undefined,
              baseSource: it.sourceName,
            });
          }
          s.expanded[t.chId] = true;
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
          p.med.push({ id: nextMedLineId(), comment: '', uds: '', largo: '', ancho: '', alto: '' });
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

      addChapter: (title) =>
        set((s) => {
          const num = s.chapters.reduce((m, c) => Math.max(m, parseInt(c.code, 10) || 0), 0) + 1;
          const code = String(num);
          const id = code.padStart(2, '0');
          s.chapters.push({ id, code, title, children: [] });
          s.partidas[id] = [];
          s.view = 'presupuesto';
          s.active = id;
        }),

      addSubchapter: (chapterId, title) =>
        set((s) => {
          const c = s.chapters.find((ch) => ch.id === chapterId);
          if (!c) return;
          if (!c.children) c.children = [];
          const n =
            c.children.reduce(
              (m, sub) => Math.max(m, parseInt(String(sub.code).split('.')[1] ?? '', 10) || 0),
              0,
            ) + 1;
          c.children.push({
            id: `${c.id}.${String(n).padStart(2, '0')}`,
            code: `${c.code}.${n}`,
            title,
          });
          s.expanded[chapterId] = true;
        }),

      deleteChapter: (chapterId) =>
        set((s) => {
          const i = s.chapters.findIndex((c) => c.id === chapterId);
          if (i < 0) return;
          const ch = s.chapters[i]!;
          const affectsActive =
            s.active === chapterId || !!ch.children?.some((sc) => sc.id === s.active);
          s.chapters.splice(i, 1);
          delete s.partidas[chapterId];
          if (affectsActive) s.active = ALL;
        }),

      deleteSubchapter: (chapterId, subId) =>
        set((s) => {
          const ch = s.chapters.find((c) => c.id === chapterId);
          const si = ch?.children?.findIndex((sc) => sc.id === subId) ?? -1;
          if (!ch?.children || si < 0) return;
          ch.children.splice(si, 1);
          // Las partidas del sub borrado suben al capítulo (sub = undefined).
          const list = s.partidas[chapterId] ?? [];
          for (const p of list) if (p.sub === subId) p.sub = undefined;
          renumberInPlace(ch, list);
          if (s.active === subId) s.active = chapterId;
        }),

      addPartida: (chapterId, subId) =>
        set((s) => {
          const ch = s.chapters.find((c) => c.id === chapterId);
          if (!ch) return;
          const list = (s.partidas[chapterId] ??= []);
          const sub = subId && ch.children ? ch.children.find((x) => x.id === subId) : undefined;
          const base = sub ? sub.code : ch.code;
          const sameSub = list.filter((p) => (subId ? p.sub === subId : !p.sub)).length;
          list.push({
            id: nextPartidaId(),
            sub: subId || undefined,
            pos: `${base}.${sameSub + 1}`,
            code: '——',
            title: '',
            ud: 'ud',
            precio: 0,
            desc: '',
            med: [],
            items: [],
          });
        }),

      deletePartida: (chapterId, partidaId) =>
        set((s) => {
          const list = s.partidas[chapterId];
          const idx = list?.findIndex((p) => p.id === partidaId) ?? -1;
          if (!list || idx < 0) return;
          list.splice(idx, 1);
          renumberInPlace(
            s.chapters.find((c) => c.id === chapterId),
            list,
          );
        }),

      movePartida: (fromChapterId, partidaId, toChapterId, toSubId) =>
        set((s) => {
          const fromList = s.partidas[fromChapterId];
          const idx = fromList?.findIndex((p) => p.id === partidaId) ?? -1;
          if (!fromList || idx < 0) return;
          const [moving] = fromList.splice(idx, 1);
          if (!moving) return;
          moving.sub = toSubId || undefined;
          moving.fromBase = false;
          const toList = (s.partidas[toChapterId] ??= []);
          toList.push(moving);
          renumberInPlace(
            s.chapters.find((c) => c.id === fromChapterId),
            fromList,
          );
          renumberInPlace(
            s.chapters.find((c) => c.id === toChapterId),
            toList,
          );
          s.expanded[toChapterId] = true;
        }),

      setObraPath: (path, value) =>
        set((s) => {
          if (typeof value !== 'string') return;
          const keys = path.split('.');
          let obj = s.obra as Record<string, unknown>;
          for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i]!;
            if (typeof obj[k] !== 'object' || obj[k] === null) obj[k] = {};
            obj = obj[k] as Record<string, unknown>;
          }
          obj[keys[keys.length - 1]!] = value;
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
  ),
);
