/* ===========================================================================
   store/obraStore — estado global de la obra (Zustand + Immer).
   ---------------------------------------------------------------------------
   Reúne el estado de DOMINIO (capítulos, partidas, banco, certs, tasas, obra),
   sembrado desde `core/seed`, con el estado de UI (vista activa, capítulo
   seleccionado, capítulos desplegados, certificación en curso). Las tasas son
   estado del store, NUNCA globals mutados (§8 del plan; era un hack del
   prototipo `window.IVA_RATE`).

   F-04 (auditoría): este fichero ya no es el «god store» monolítico. Ensambla
   el estado + las acciones de UI/ciclo de vida, y COMPONE tres slices (patrón
   slice de Zustand) sin cambiar la API pública:
     · `./schema`               — SCHEMA_VERSION, migraciones, to/fromSerializable,
                                   seed/blank (lo que consume `persist/`).
     · `./slices/certSlice`     — certificación (cantidades, contradictorios, ajustes).
     · `./slices/copySlice`     — copia de partidas de Referencia (+ tipos de copia).
     · `./slices/estructuraSlice`— CRUD estructural + edición in-situ + copy-on-write.
   Los símbolos públicos de esos módulos se RE-EXPORTAN aquí para que `./obraStore`
   (y el barrel `./index`) mantengan la superficie de exports byte a byte.
   =========================================================================== */
import { create, type StateCreator } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Cert, MedLine, Partida, Rates, ResourceType } from '../core/types';
import { ancestorIds, findNode } from '../core/tree';
import type { ImportedObra } from '../core/bc3import';
import { REF_SOURCES, type RefCopyItem, type RefDrag, type Resolution } from '../core/refdata';
import type { View } from '../layout/types';
import { useToastStore } from './toastStore';
import { ALL } from './base';
import { SCHEMA_VERSION, blankObraData, seedObraData, type ObraData } from './schema';
import { createCertSlice } from './slices/certSlice';
import { createCopySlice, type PendingCopy } from './slices/copySlice';
import { createEstructuraSlice } from './slices/estructuraSlice';

// --- superficie pública de `./obraStore` (invariante F-04: no cambia nada) ---
export { ALL };
export { SCHEMA_VERSION, blankObraData, seedObraData };
export { toSerializable, fromSerializable } from './schema';
export { copyTargetOf } from './slices/copySlice';
export type { ObraData };
export type { CopyTarget, PendingCopy } from './slices/copySlice';

/** Modo de edición de una certificación: importe a origen vs. de esta cert. */
export type CertMode = 'origen' | 'esta';

/** Salida del copy-on-write: forkar copia privada vs. editar el compartido en todas. */
export type CowChoice = 'copy' | 'all';

export interface ObraState extends ObraData {
  /* ---- estado de UI ---- */
  /** Vista activa (tabs). */
  view: View;
  /** Capítulo/subcapítulo seleccionado, o `__ALL__` para toda la obra. */
  active: string;
  /** Contenedores desplegados en el sidebar (id de capítulo O sub → abierto). */
  expanded: Record<string, boolean>;
  /** Índice de la certificación en curso dentro de `certs`. */
  curCert: number;
  /** Panel de Referencia abierto (F5). */
  refOpen: boolean;
  /** Fuente de referencia seleccionada (id de `REF_SOURCES`). */
  refSourceId: string;
  /** Ancho del panel en modo split (px, clamp 320–640). */
  refWidth: number;
  /** Panel de Referencia maximizado a pantalla completa (tapa sidebar + presupuesto). */
  refMaximized: boolean;
  /** Arrastre en curso desde el panel Referencia (F5.2); null = nada arrastrándose. */
  refDrag: RefDrag | null;
  /** Copia con colisiones pendiente de resolver (T-1, D2); null = sin conflicto. */
  pendingCopy: PendingCopy | null;
  /**
   * Partida desplegada Y seleccionada en el presupuesto (modelo unificado: la
   * fila abierta ES la seleccionada, una a la vez). `null` = ninguna. Es estado
   * de UI por-obra: `loadObra`/`reset` lo resetean (vía `seedUi`), y cambiar de
   * vista/capítulo o borrar/mover la partida lo limpian (no dejar selección
   * fantasma sobre una fila invisible).
   */
  openPartidaId: string | null;
  /**
   * Contador que dispara el scroll + pulso "ir a la partida" del buscador del
   * presupuesto (`revealPartida`). Lo incrementa cada salto (también al re-revelar
   * la ya abierta) y lo escucha `PresupuestoView`; atarse a él (y no a
   * `openPartidaId`) evita hacer scroll en cada apertura manual.
   */
  revealNonce: number;
  /** Contador que pide foco al buscador del presupuesto (atajo Ctrl/⌘+K). */
  searchFocusNonce: number;
  /**
   * Copy-on-write (estilo Arquímedes/CYPE): elección recordada "no volver a
   * preguntar en esta partida" del `CowDialog`, por id de partida. TRANSITORIO
   * (no entra en `toSerializable`): se limpia al cambiar de partida/vista. Solo
   * tiene sentido para la dimensión de RECURSO COMPARTIDO (la de partida base se
   * resuelve en la primera edición, que ya quita `fromBase`). `'copy'` = forkar
   * copia privada; `'all'` = editar el concepto compartido en todas.
   */
  cowChoice: Record<string, CowChoice>;

  /* ---- acciones (F1) ---- */
  setView: (v: View) => void;
  setActive: (id: string) => void;
  /**
   * Navega a una partida concreta y la deja lista para editar (buscador del
   * presupuesto, T-20): marca su subcapítulo —o capítulo si es directa— en el
   * sidebar, aísla su subárbol, expande la cadena de ancestros, despliega su
   * detalle y dispara el scroll/pulso. ATÓMICA: no delega en
   * `setActive`/`setView`/`togglePartida` (que resetean/alternan `openPartidaId`),
   * y fija `openPartidaId` el ÚLTIMO. `chapterId`/`subId` vienen del hit del
   * índice (O(1), sin re-escaneo); un `subId` huérfano cae al capítulo.
   */
  revealPartida: (partidaId: string, chapterId: string, subId: string | null) => void;
  /**
   * Despliega/selecciona una partida (o la colapsa/deselecciona si ya lo estaba).
   * Single-open: abrir una cierra la anterior. Es el gesto de "click en zona
   * vacía de la fila" del presupuesto.
   */
  togglePartida: (id: string) => void;
  /**
   * Despliega/colapsa un contenedor (capítulo o sub) en el árbol del sidebar
   * (estado de UI). `force` fija el estado (true = desplegar) en vez de
   * alternar; lo usa "añadir subcapítulo" para abrir la cadena de ancestros.
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
   * Marca una partida como COMPLETADA (100% a origen) en la cert en curso, SIN
   * reducir: `data = max(actual, ofertada, prev)`. Respeta el suelo D-06 y
   * conserva un sobre-tecleo del periodo; `ofertada<=0` → no-op. Override manual:
   * limpia la certificación por líneas de esa partida.
   */
  completePartida: (partidaId: string) => void;
  /** Desmarca «Completada»: vuelve al a-origen de la cert anterior (0 esta cert),
   *  nunca a 0 a origen. prev==0 borra la entrada. Limpia también `lineQty`. */
  uncompletePartida: (partidaId: string) => void;
  /**
   * Completa en LOTE (100% a origen) exactamente las partidas cuyos ids se pasan
   * —la UI pasa las VISIBLES (obra / capítulo / lo visible), nunca filas ocultas
   * (eng review Issue 5)—. UN solo `set` (no dispara N autosaves).
   */
  completePartidas: (partidaIds: string[]) => void;
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

  /* ---- ajustes configurables del resumen (pago adelantado, correcciones…) ---- */
  /** Añade un ajuste en blanco (descuento fijo, puntual) al resumen de la cert en curso. */
  addAjuste: () => void;
  /**
   * Edita un campo de un ajuste de la cert en curso. Al cambiar `tipo` RESETEA
   * `valor` a 0 (una fracción y unos euros no son intercambiables). `valor` se
   * clampa según el tipo: `fijo` ≥0 a 2 dec (euros); `pct` ∈ [0,1] (fracción).
   */
  editAjuste: (
    id: string,
    field: 'concepto' | 'tipo' | 'valor' | 'signo' | 'recurrente',
    value: string | number | boolean,
  ) => void;
  /** Elimina un ajuste de la cert en curso. */
  deleteAjuste: (id: string) => void;

  /* ---- acciones F5 (panel Referencia) ---- */
  /** Abre/cierra el panel de Referencia; sin argumento alterna. */
  setRefOpen: (open?: boolean) => void;
  /** Selecciona la fuente de referencia activa (id de `REF_SOURCES`). */
  setRefSource: (id: string) => void;
  /** Fija el ancho del panel en split (se clampa a 320–640). */
  setRefWidth: (w: number) => void;
  /** Maximiza/restaura el panel a pantalla completa; sin argumento alterna. */
  setRefMax: (max?: boolean) => void;
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
    resolution?: Resolution,
    provenance?: 'base' | 'clip',
  ) => void;
  /**
   * Punto de entrada de copia con PREFLIGHT de colisión (T-1, D2). Detecta
   * códigos de recurso entrantes que chocan con el banco a precio/desc distinto.
   * Sin colisiones → copia directa. Con colisiones → deja `pendingCopy` para que
   * la UI pregunte (fusionar/bifurcar) y luego llame a `resolveCopyRefPartidas`.
   * Lo usan TODAS las vías de copia (botón, selección, capítulo y drag&drop).
   */
  requestCopyRefPartidas: (
    items: RefCopyItem[],
    target: { chId: string; subId: string | null } | null,
    contra: boolean,
    provenance?: 'base' | 'clip',
  ) => void;
  /** Ejecuta la copia pendiente con la resolución elegida y limpia `pendingCopy`. */
  resolveCopyRefPartidas: (resolution: Resolution) => void;
  /** Cancela la copia pendiente (cierra el diálogo de colisión sin copiar). */
  cancelCopyRefPartidas: () => void;

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
  /**
   * Fija la cantidad A MANO (cantidad fija sin medición). Solo tiene efecto
   * mientras la partida NO tenga líneas de medición: `partidaCantidad` usa la
   * Σ de la medición si la hay y esta cantidad si no. Ignora no finitos/negativos.
   */
  setCantidad: (chapterId: string, partidaId: string, value: number) => void;
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

  /* ---- acciones copy-on-write (estilo Arquímedes/CYPE) ---- */
  /**
   * Re-apunta el CÓDIGO de una línea del descompuesto (estilo Presto/Arquímedes):
   * si `newCode` ya existe en el banco, la línea ADOPTA ese concepto (su tipo lo
   * pasa a dar el banco); si no existe, se CREA clonando los valores actuales.
   * Cambio LOCAL (no muta el concepto al que apuntaba) → no pisa otras partidas.
   * Quita el chip BASE y resincroniza el precio. `%CI`, code vacío o igual = no-op.
   */
  editItemCode: (chapterId: string, partidaId: string, itemIndex: number, newCode: string) => void;
  /**
   * Edita el TIPO de una línea (MO/MQ/MAT; `%CI` excluido). Escribe en el BANCO
   * (`recursos[code].type`, fuente de verdad que leen el render y el export) y
   * espeja el vestigio `Item.type` de ESTA línea. Si el concepto es compartido y
   * el usuario eligió "editar en todas", afecta a todas (banco). Quita BASE.
   */
  editItemType: (
    chapterId: string,
    partidaId: string,
    itemIndex: number,
    newType: ResourceType,
  ) => void;
  /**
   * Forka una COPIA PRIVADA del recurso de una línea: clona `recursos[code]` bajo
   * un código nuevo y re-apunta SOLO esta línea; las demás partidas que usaban el
   * código quedan intactas. Es la rama "copiar" del copy-on-write de recurso
   * compartido. Devuelve el código nuevo (para aplicar la edición sobre él). Quita
   * BASE. `%CI` o línea inexistente = no-op (devuelve el código actual/vacío).
   */
  forkResource: (chapterId: string, partidaId: string, itemIndex: number) => string;
  /** Recuerda la elección del `CowDialog` para una partida ("no volver a preguntar"). */
  setCowChoice: (partidaId: string, choice: CowChoice) => void;

  /* ---- acciones F2.4 (CRUD estructural + renumeración) ---- */
  /** Añade un capítulo (código = max+1) y lo deja activo en la vista Presupuesto. */
  addChapter: (title: string) => void;
  /**
   * Añade un subcapítulo bajo CUALQUIER contenedor (capítulo o sub a cualquier
   * profundidad, T-17): código `<padre>.<n>` (siguiente índice libre) y
   * despliega el capítulo dueño. Un `parentId` inexistente es no-op.
   */
  addSubchapter: (parentId: string, title: string) => void;
  /**
   * Renombra un contenedor (capítulo o sub a cualquier profundidad). El título
   * vacío se ignora: un contenedor siempre conserva nombre. Id inexistente = no-op.
   */
  editChapterTitle: (id: string, title: string) => void;
  /** Elimina un capítulo y sus partidas; si estaba activo, salta a "Toda la obra". */
  deleteChapter: (chapterId: string) => void;
  /**
   * Elimina un contenedor a CUALQUIER profundidad (T-17). Sus hijos se
   * PROMUEVEN al final de los hermanos (recodificados con índices libres) y
   * sus partidas directas suben al contenedor padre — borrar nunca destruye
   * ramas ni partidas. Si estaba activo, el activo salta al padre.
   */
  deleteSubchapter: (chapterId: string, subId: string) => void;
  /**
   * Mueve un SUBÁRBOL (contenedor + sub-contenedores + sus partidas) bajo otro
   * contenedor, incluso de otro capítulo (T-17): las partidas del subárbol
   * cambian de bucket en `PartidasMap` (la clave sigue siendo el capítulo) y la
   * rama se recodifica bajo el código del nuevo padre. Los ids no cambian (las
   * certs, indexadas por id de partida, no se enteran). Rechaza (no-op) mover
   * un capítulo, un destino inexistente o un destino DENTRO del propio subárbol.
   */
  moveSubtree: (nodeId: string, toParentId: string) => void;
  /** Añade una partida vacía al capítulo/subcapítulo, con su `pos` correlativa. */
  addPartida: (chapterId: string, subId: string | null) => void;
  /** Elimina una partida y renumera su capítulo. */
  deletePartida: (chapterId: string, partidaId: string) => void;
  /**
   * Reinserta una partida (identidad intacta) en su posición para DESHACER un
   * borrado (toast «deshacer»). Renumera el capítulo tras insertar.
   */
  restorePartida: (chapterId: string, partida: Partida, index: number) => void;
  /** Pide foco al buscador (atajo Ctrl/⌘+K). Incrementa `searchFocusNonce`. */
  focusSearch: () => void;
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

/** Tipo helper de los slices del store: fija `ObraState` y la pila de middleware
 *  (subscribeWithSelector + immer) para que `set` sea el de Immer (recipe). */
export type ObraSlice<T> = StateCreator<
  ObraState,
  [['zustand/subscribeWithSelector', never], ['zustand/immer', never]],
  [],
  T
>;

/** Estado de UI inicial (sincronizado con el nº de certs sembradas). */
function seedUi(certs: Cert[]) {
  return {
    view: 'presupuesto' as View,
    active: '01',
    // Árbol COLAPSADO por defecto (capítulos y subs): en bancos/obras grandes
    // el árbol desplegado es inmanejable; el usuario abre lo que necesita.
    expanded: {} as Record<string, boolean>,
    curCert: Math.max(0, certs.length - 1), // la última cert queda en curso
    refOpen: false,
    refSourceId: REF_SOURCES[0]?.id ?? '',
    refWidth: 400,
    refMaximized: false,
    refDrag: null as RefDrag | null,
    pendingCopy: null as PendingCopy | null,
    openPartidaId: null as string | null,
    revealNonce: 0,
    searchFocusNonce: 0,
    cowChoice: {} as Record<string, CowChoice>,
  };
}

export const useObraStore = create<ObraState>()(
  subscribeWithSelector(
  immer((set, get, store) => {
    // Arranque limpio: la app parte de una obra nueva vacía (sin datos demo). En
    // primera carga `hydrate` (sin obras en IDB) conserva este estado en memoria;
    // la 1ª edición la fosiliza. `seedObraData()`/`reset()` siguen vivos como
    // semilla de tests (los specs resiembran la obra demo en su beforeEach).
    const data = blankObraData();
    return {
      ...data,
      ...seedUi(data.certs),

      setView: (v) =>
        set((s) => {
          // ENTRAR en Certificaciones abre siempre la cert completa (dogfood
          // 2026-07-04); aislar capítulo/sub se hace después desde el árbol.
          // Solo al entrar: navegar el árbol ya dentro no pasa por aquí.
          if (v === 'certificaciones' && s.view !== 'certificaciones') s.active = ALL;
          s.view = v;
          s.openPartidaId = null; // la selección es contextual a lo que se mira
          s.cowChoice = {}; // memoria COW: viva solo mientras editas la partida
        }),

      setActive: (id) =>
        set((s) => {
          s.active = id;
          s.openPartidaId = null; // cambiar de capítulo deselecciona la partida
          s.cowChoice = {};
        }),

      togglePartida: (id) =>
        set((s) => {
          s.openPartidaId = s.openPartidaId === id ? null : id;
          s.cowChoice = {}; // abrir/cerrar partida reinicia su memoria COW
        }),

      revealPartida: (partidaId, chapterId, subId) =>
        set((s) => {
          const ch = s.chapters.find((c) => c.id === chapterId);
          if (!ch) return; // no-op seguro: capítulo inexistente
          // `subId` válido sólo si existe en ESTE capítulo; si no (huérfano o
          // cruzado), se trata como partida directa del capítulo (sin esto,
          // `active` apuntaría a un id desconocido → la vista caería a chapters[0]).
          const validSub =
            subId && findNode(s.chapters, subId)?.chapter.id === chapterId ? subId : null;
          s.active = validSub ?? chapterId;
          // Expandir la cadena de ancestros para dejar el contenedor a la vista.
          for (const id of ancestorIds(s.chapters, validSub ?? chapterId)) s.expanded[id] = true;
          s.view = 'presupuesto';
          s.openPartidaId = partidaId; // ÚLTIMO: ningún reset previo lo borra
          s.cowChoice = {}; // saltar a otra partida reinicia la memoria COW
          s.revealNonce += 1; // dispara scroll/pulso (también al re-revelar la abierta)
        }),

      focusSearch: () =>
        set((s) => {
          s.searchFocusNonce += 1;
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

      setRefOpen: (open) =>
        set((s) => {
          s.refOpen = open ?? !s.refOpen;
          // Al cerrar, salir de pantalla completa: reabrir no debe sorprender maximizado.
          if (!s.refOpen) s.refMaximized = false;
        }),

      setRefSource: (id) =>
        set((s) => {
          s.refSourceId = id;
        }),

      setRefWidth: (w) =>
        set((s) => {
          s.refWidth = Math.max(320, Math.min(640, Math.round(w)));
        }),

      setRefMax: (max) =>
        set((s) => {
          s.refMaximized = max ?? !s.refMaximized;
        }),

      setRefDrag: (drag) =>
        set((s) => {
          s.refDrag = drag;
        }),

      loadObra: (data) => {
        // D-08: un toast «Deshacer» pendiente capturó (capítulo, partida) de la
        // obra SALIENTE; ejecutarlo tras cargar otra inyectaría datos ajenos.
        useToastStore.getState().clear();
        set((s) => {
          // `bajas: {}` por delante: un `ImportedObra` (.bc3) no trae tombstones
          // y sin el default arrastraría los de la obra ANTERIOR (v3).
          Object.assign(s, { schemaVersion: SCHEMA_VERSION, bajas: {}, ...data });
          Object.assign(s, seedUi(data.certs));
          const first = data.chapters[0]?.id;
          s.view = 'presupuesto';
          s.active = first ?? ALL;
          s.expanded = {}; // árbol colapsado: una obra recién importada se explora
          s.refOpen = false;
        });
      },

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

      reset: () => {
        useToastStore.getState().clear(); // como loadObra: mata el «Deshacer» capturado (D-08)
        set((s) => {
          // Object.assign desde seedObraData(): añadir un campo a ObraData lo
          // resetea automáticamente (sin drift silencioso campo-a-campo).
          const fresh = seedObraData();
          Object.assign(s, fresh);
          Object.assign(s, seedUi(fresh.certs));
        });
      },

      // --- slices (F-04): certificación, copia de Referencia, CRUD/edición ---
      ...createCertSlice(set, get, store),
      ...createCopySlice(set, get, store),
      ...createEstructuraSlice(set, get, store),
    };
  }),
  ),
);
