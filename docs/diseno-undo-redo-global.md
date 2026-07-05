# Diseño: Deshacer / Rehacer global

Generado por /office-hours el 2026-07-05
Rama: main
Repo: concreta / mediciones
Estado: BORRADOR
Modo: Builder
Revisión adversarial: 6/10 inicial → 3 fallos de fondo (#1 clear no cancela push
pendiente; #2 debounce trailing conserva el "antes" equivocado; #3 falta `bajas`)
+ 3 mejoras, todos incorporados.
Revisión de ingeniería (/plan-eng-review): 3 decisiones — (1) middleware temporal
PROPIO (~50 líneas), no zundo; (2) flag `historyPaused` para la limpieza al cargar
obra; (3) undo/redo PERMITIDO en pestaña de solo-lectura (coherencia con las
ediciones, que tampoco se bloquean).
Auditoría post-implementación (/code-review high, 2026-07-05): 8 ángulos → 8
hallazgos (0 rompían el núcleo; 3 candidatos refutados con evidencia). Fixes
aplicados: undo/redo limpian el toast pendiente (D-08 simétrico); guarda de
flanco en notify(); `DOMAIN_KEYS` canónico en schema.ts (exhaustividad en tipos)
compartido por autosave (ya con `bajas`) e historial; tombstone limpiado antes de
la guarda de idempotencia en restorePartida; `__resetSyncForTests` resetea también
el historial. Pendiente sin cambio: T8 (medir memoria antes de subir LIMIT=25).

## Problema

Hoy la app no tiene pila de historial. La única forma de "deshacer" es un toast
efímero de ~6 s que **solo** cubre borrar una partida (`usePartidaDelete` →
`restorePartida`). En concreto:

- **«Completar la obra» (masivo) no se puede deshacer.** `CertificacionesView`
  llama `completePartidas(ids)` directo, sin toast. Para revertirlo hay que ir
  partida por partida.
- **Descompletar no restaura el estado previo.** `uncompletePartida` devuelve la
  cantidad al a-origen de la cert anterior (suelo D-06), no a lo tecleado este
  periodo; y `dropLineQty` borra el marcado fino, dejando la partida sin el detalle
  por líneas que tenía. (Nota de implementación 2026-07-05: `completeDraft` ya no
  suelta `lineQty` sino que MARCA todas las líneas al parcial; el motivo original
  del undo se mantiene igual — descompletar sigue sin devolver el estado exacto del
  periodo, y un Ctrl+Z sí.)

Objetivo: un Deshacer/Rehacer **general** (Ctrl/⌘+Z, Ctrl+Shift+Z + botones) que
cubra cualquier edición de dominio y, en particular, revierta «Completar la obra»
en un solo paso restaurando el estado exacto (incluido `lineQty`).

## Estado actual (base sobre la que construir)

- **Store**: Zustand único (`src/store/obraStore.ts`) con middleware
  `subscribeWithSelector` + `immer`. Mezcla estado de **dominio** (`chapters`,
  `partidas`, `recursos`, `certs`, `rates`, `obra`, `bajas`) y estado de **UI**
  (`view`, `active`, `expanded`, `curCert`, `refOpen`, `openPartidaId`, …) en el
  mismo objeto. Acciones en slices (`certSlice`, `copySlice`, `estructuraSlice`).
- **Sustrato ideal para undo**: con `immer`, cada acción produce un estado
  inmutable nuevo con *structural sharing* (las ramas no tocadas conservan su
  referencia). Nadie guarda esos estados; esa es toda la pieza que falta.
- **Frontera de dominio casi aislada**: el autosave (`src/persist/sync.ts:112`)
  ya se suscribe al slice de dominio
  `[chapters, partidas, recursos, certs, rates, obra]` (6 claves) con igualdad
  `shallow`, y tiene un flag `suppress` que corta el autosave mientras `loadObra`
  muta el dominio. Undo/redo necesita ESA frontera **más `bajas`** (7 claves): el
  slice del autosave omite `bajas` a propósito, pero el historial sí lo necesita
  (ver `partialize` abajo). No reutilizar el `domainSlice` de 6 claves tal cual.
- **Precedente D-08**: `loadObra`/`reset` ya llaman `useToastStore.clear()` para
  que un «Deshacer» capturado sobre la obra saliente no se ejecute contra la
  entrante. El historial de undo necesita EXACTAMENTE la misma disciplina.

## Enfoques considerados

### Enfoque A: Undo puntual de «Completar» (toast)
Copiar el patrón del toast de borrado: snapshot de `data`+`lineQty` de las
partidas afectadas antes de completar, y toast «Deshacer» que las restaura.
- Esfuerzo: S · Riesgo: bajo · Reusa `toastStore` + disciplina D-08.
- Pro: tapa el dolor concreto hoy mismo, restaura el estado exacto.
- Contra: solo cubre esta acción, ventana de ~6 s, no es undo general.

### Enfoque B: Undo/Redo global con `zundo` (RECOMENDADO)
Middleware temporal estándar para Zustand, compatible con immer. Envuelve el
store y mantiene pilas `pastStates` / `futureStates` del slice de dominio.
- Esfuerzo: M · Riesgo: medio.
- Pro: la función completa que se pide; «Completar obra» pasa a ser un solo
  Ctrl+Z que restaura el estado exacto (incluido `lineQty`), gratis, porque
  `completePartidas` ya es un único `set` → una única entrada de historial.
- Contra: hay que afinar el coalescing (que teclear no sea 1 paso/tecla),
  limpiar el historial al cargar/cambiar de obra, y validar el orden de
  middleware.

### Enfoque C: Command/event-log
Cada mutación como comando serializable con do/undo, log append-only. Da
undo/redo + auditoría + base para sync/colaboración.
- Esfuerzo: XL · Riesgo: alto. Reescribe los slices. Sobredimensionado ahora.
- Aparcado como scope futuro (si más adelante se quiere traza de auditoría o
  multiusuario).

## Enfoque recomendado

**B (middleware temporal propio) como la función real.** Opcionalmente **A como fase 0** si se quiere
tapar el agujero de «Completar obra» antes de que B esté completo; si B entra
pronto, A es innecesario (B lo cubre).

### Diseño detallado de B

1. **Middleware temporal PROPIO (~50 líneas), no `zundo`** (decisión eng-review).
   zundo no está instalado y su compatibilidad con zustand 5 habría que verificarla;
   la lógica de undo (pilas `past`/`future` + partialize + equality + throttle) es
   pequeña y se controla mejor a mano. Encaja con el patrón de vendorizar del repo
   (el parser bc3 ya está forkado). Estructura: un middleware que envuelve `set`,
   captura `partialize(prev)` en `past` (con el throttle) antes de aplicar el cambio,
   vacía `future` en cada edición nueva, y expone `undo()`/`redo()`/`clear()` +
   `past`/`future` observables. Debe ir **por dentro** de `subscribeWithSelector`
   (que sigue siendo el más externo, lo exige el `subscribe` selectivo del autosave)
   y **por fuera** de `immer`. Test humo de orden de middleware antes de seguir.

2. **`partialize` → solo dominio (pick barato, no `toSerializable`).** Trackear
   exactamente `{ chapters, partidas, recursos, certs, rates, obra, bajas }` — las
   **7** claves, incluida `bajas`. Deja fuera todo el estado de UI, así **deshacer
   no mueve el cursor** (no cambia capítulo activo, panel, expandidos ni la cert
   seleccionada).
   - `bajas` es **obligatorio**: `deletePartida`→`registrarBaja` escribe el
     tombstone (`estructuraSlice.ts`) y `restorePartida` lo borra; sin `bajas` en
     el historial, deshacer el borrado de una partida certificada restaura la
     partida pero **deja el tombstone huérfano** (aparecería viva Y en «Eliminado
     del presupuesto»).
   - Reutilizar solo la **lista de campos** de `toSerializable`, **nunca la
     función**: `partialize: (s) => ({ chapters: s.chapters, partidas: s.partidas,
     recursos: s.recursos, certs: s.certs, rates: s.rates, obra: s.obra, bajas:
     s.bajas })`. Cablear `partialize: toSerializable` pagaría un escaneo
     `recursoUsage` O(partidas) en CADA `set`/pulsación y clonaría `recursos`
     (`{...recursos}`) al hacer GC → cambia la referencia y rompe `shallow`
     espuriamente (entradas de historial fantasma en acciones de UI).

3. **`equality` → `shallow` sobre el dominio.** Como immer conserva por
   referencia las ramas no tocadas, una igualdad `shallow` (de `zustand/shallow`)
   sobre esas 7 claves es barata y correcta: una acción de Uis (`setActive`,
   `togglePartida`, `setRefWidth`…) deja el dominio shallow-igual → **no genera
   entrada de historial**. Es el mismo truco que ya usa el autosave.

4. **`limit` ≈ 50.** Backstop de profundidad. Por el *structural sharing* de
   immer, 50 entradas NO son 50 copias de la obra: las ramas sin cambios se
   comparten por referencia; la memoria escala con el *churn* real, no con el
   tamaño de la obra. (Relevante dado que el blob de obra puede ser grande —
   ver PERFORMANCE_AUDIT.) No clonar los snapshots (romper el sharing sería el
   error a evitar).

5. **`handleSet` con throttle *leading-edge* (~600–800 ms) para coalescing —
   NO debounce.** Teclear una cantidad dispara un `set` por pulsación
   (`onCertEdit`, `editMedLine`, `editPartidaField`, `setPrecio`, `editRecurso`…).
   El middleware ve el `pastState` **de cada `set`**; hay que quedarse con el del
   PRIMER `set` de la ráfaga, no el del último.
   - **Un debounce *trailing* conserva el "antes" equivocado**: como cada
     `onCertEdit` fija el número completo, tras teclear «123» sobre un campo vacío
     un debounce colapsaría a un push con el `pastState` previo a la ÚLTIMA
     pulsación → Ctrl+Z restauraría «12», no «». Por eso el ejemplo de coalescing
     del README de zundo usa **throttle leading-edge** (`{ leading: true,
     trailing: false }`): captura el `pastState` del primer `set` y descarta los
     siguientes de la ventana → una entrada por ráfaga que restaura el valor
     **pre-ráfaga**. El test de coalescing (paso 4) debe **afirmar que undo
     restaura el valor pre-ráfaga**, no solo que hay una entrada.
   - Ventana algo más corta que el autosave (1500 ms): la granularidad de undo
     quiere ser algo más fina (un campo terminado = un paso).

6. **`historyPaused` + clear DENTRO de `loadObra`/`reset`, no en el wrapper de
   `sync.ts` (CRÍTICO, análogo D-08)** (decisión eng-review; corregido por la voz
   externa). `loadObra` NO se llama solo desde `sync.ts`: también directo desde
   [ProjectBackup.tsx:53](../src/features/obra/ProjectBackup.tsx#L53) (restaurar
   backup), [ImportarView.tsx:33](../src/features/importar/ImportarView.tsx#L33) y
   [ReferenciaImportModal.tsx:55](../src/features/importar/ReferenciaImportModal.tsx#L55).
   Si el gate solo viviera en `loadDataIntoStore`, un Ctrl+Z tras importar/restaurar
   resucitaría la obra anterior. El sitio correcto es **dentro de `loadObra` y
   `reset`** (acciones del store), justo donde YA llaman `useToastStore.clear()` por
   D-08 ([obraStore.ts:551](../src/store/obraStore.ts#L551)): un solo punto cubre
   import, backup, `newObra`, switch, handoff y test-resets.
   - El middleware no empuja mientras `historyPaused` esté activo; `loadObra`/`reset`
     lo activan durante su `set` y vacían `past`/`future` (paralelo al `suppress` del
     autosave). Como el throttle es leading-edge (sin trailing), no hay push diferido
     que cancelar → el flag basta.
   - Test obligatorio (regresión): cargar la obra B con una edición reciente de A
     pendiente, esperar > ventana de throttle, y afirmar que `past` sigue vacío;
     cubrir también la ruta de import directo (no solo `sync.ts`).

7. **Semántica de `undo()`/`redo()`.** Aplican un *merge parcial* de las 7 claves
   de dominio sobre el estado vivo (vía el `set` de immer), NO un reemplazo total:
   así la UI (`view`, `active`, `expanded`, `curCert`…) se preserva y deshacer no
   mueve el cursor. El estado de UI que quede al deshacer es el ACTUAL, no el del
   snapshot (correcto: quieres deshacer el dato, no la navegación).

8. **UI + atajos.** Botones Deshacer/Rehacer en `TopBar`, deshabilitados cuando
   la pila correspondiente está vacía. El middleware propio expone `past`/`future`
   como estado observable (un pequeño store o un `useSyncExternalStore`) para que
   el botón se re-pinte al cambiar las pilas; NO leer la longitud en render (una
   lectura puntual no re-renderiza).
   - Atajos en el `useAppHotkeys` existente: Ctrl/⌘+Z (undo), Ctrl+Shift+Z y
     Ctrl+Y (redo). Dos cuidados con `useAppHotkeys.ts`: (a) colocar los handlers
     **antes** del early-return `if (e.ctrlKey || e.metaKey || e.altKey) return;`
     ([useAppHotkeys.ts:34](../src/hooks/useAppHotkeys.ts#L34)), o nunca se
     ejecutan; (b) gatearlos con **`!isTextEditingTarget()`** para dejar el undo
     NATIVO del `<input>` mientras el usuario teclea dentro de un campo (interceptar
     Ctrl+Z global ahí rompería la expectativa del navegador).
   - **Undo/redo PERMITIDO en pestañas de solo-lectura** (decisión eng-review):
     en readonly (T-19) las ediciones NO se bloquean —solo se inhibe el autosave y
     se muestra un banner—, así que undo/redo debe igualar ese comportamiento. Lo
     contrario (teclear sí, deshacer no) es una asimetría confusa. Bloquear TODAS
     las mutaciones en readonly es un cambio mayor aparte (ver TODO).

9. **Interacción con el toast de borrado — `restorePartida` idempotente**
   (decisión eng-review; bug detectado por la voz externa). Secuencia rota: borrar
   partida → Ctrl+Z (el undo global la restaura) → pulsar «Deshacer» en el toast →
   `restorePartida` la inserta OTRA VEZ sin comprobar el id → **partida duplicada**.
   Fix v1: **`restorePartida` idempotente** — si el id ya existe en el capítulo,
   no-op. Arregla la raíz con el mínimo diff y deja toast y undo global conviviendo
   sin acoplarlos. Convergencia (retirar el toast a favor de Ctrl+Z) queda para v2.

10. **Autosave.** Undo/redo cambian el dominio → el autosave existente los
    persiste (deseado: deshacer también se guarda). No hay bucle: undo es solo
    otro cambio de estado.

### Refuerzos de la revisión de ingeniería (voz externa Codex)

- **Reconciliar la UI tras undo/redo (necesario, no opcional).** Varias acciones de
  dominio también tocan UI: `addChapter` fija `active`, `addCert` fija `curCert`,
  copiar expande capítulos, borrar limpia `openPartidaId`. Restaurar solo el dominio
  puede dejar `active` apuntando a un capítulo ya inexistente o `curCert` fuera del
  array. Tras aplicar undo/redo, **reconciliar**: `active` → `ALL` si su
  capítulo/sub no existe; `curCert` → clamp a `[0, certs.length-1]`; `openPartidaId`
  → validar. Reutiliza los patrones de clamp existentes (`setCurCert`,
  `revealPartida`).
- **API de la UI: exponer `canUndo`/`canRedo` (booleanos), no `past`/`future`.**
  Los botones solo necesitan si hay algo que deshacer/rehacer; exponer los arrays de
  snapshots acopla la UI a objetos grandes retenidos e invita a re-renders accidentales.
- **Alinear el slice del autosave a 7 claves (incluir `bajas`).** Hoy el autosave
  escucha 6 (sin `bajas`) y el historial 7. Aunque `bajas` no se muta hoy en
  solitario (siempre con `partidas`), igualar ambos slices elimina el acoplamiento
  latente (si algún día `bajas` cambiara sola, undo no la persistiría).
- **Memoria: `limit` medido, no supuesto.** El structural sharing ayuda, pero 50
  raíces de dominio con `certs`/`partidas` grandes siguen reteniendo grafos viejos.
  Empezar con `limit ≈ 25` y **medir** con la obra de dogfood antes de subirlo.
- **Estimación realista: ~80–120 líneas bien tipadas**, no 50 (typing de middleware
  zustand v5 + pause/clear + estado observable + throttle + reconciliación de UI).
- **Coalescing: verificar el modelo de commit ANTES de elegir throttle.** Si los
  inputs de cert/medición commitean en blur/Enter (no por pulsación), cada commit ya
  es un paso lógico y un throttle global fundiría acciones rápidas distintas — quizá
  no haga falta throttle. Verificar en el spike (afecta a la decisión abierta #1).
- **Tests extra (voz externa):** orden de middleware con recipe-set, object-set y
  no-op; redo restaura el POST-estado capturado (no re-ejecuta acciones no
  deterministas: `addCert`, ids, timestamps); reconciliación de UI tras undo;
  `restorePartida` idempotente.

## Decisiones abiertas

1. **Granularidad del coalescing.** ¿Throttle global (simple; puede fundir un
   edit de texto + una acción estructural que caigan en la misma ventana) o
   clasificador de acciones (las estructurales/`delete`/`complete`/`add` empujan
   inmediato + hacen flush del throttle pendiente; solo el texto throttle)? El
   clasificador es más limpio pero más código (un nonce transitorio que las
   acciones discretas incrementan y que `handleSet` inspecciona). **Propuesta:
   throttle global en v1, clasificador como pulido posterior.**
2. **¿Fase 0 (Enfoque A)?** ¿Se quiere el toast puntual de «Completar» antes de
   B, o se espera a B directamente? Propuesta: ir directo a B si entra pronto.
3. **Toast de borrado en v1**: ¿mantener independiente (propuesta) o converger ya?
4. **Ámbito del `limit`**: 50 por defecto; ¿configurable?

## Criterios de éxito

- Ctrl/⌘+Z deshace la última edición de dominio; Ctrl+Shift+Z la rehace.
- «Completar la obra» se revierte en **un** Ctrl+Z, restaurando `data` y
  `lineQty` exactos de antes de la acción.
- Deshacer **no** cambia capítulo activo, panel, expandidos ni cert seleccionada.
- Navegar (cambiar de capítulo/vista, mover panel) **no** crea entradas de
  historial.
- Teclear una cantidad de varias pulsaciones = **una** entrada de historial, y
  ese Ctrl+Z restaura el valor **pre-ráfaga** (p.ej. tras teclear «123» sobre
  vacío, un undo deja el campo vacío, no «12»).
- Cargar/cambiar/crear obra **vacía** el historial Y cancela cualquier push
  pendiente (un undo nunca cruza obras, ni siquiera con una edición reciente en
  vuelo al cambiar de obra).
- Undo/redo funcionan también en pestaña de solo-lectura (coherente con que las
  ediciones no se bloquean ahí; solo se inhibe el autosave).
- Sin regresión de memoria perceptible con obras grandes (verificar con la obra
  de dogfood).

## Próximos pasos (implementación por fases, tras aprobación)

1. Escribir el middleware temporal PROPIO (~50 líneas) y envolver el store
   (`partialize` de 7 claves con `bajas`; `equality: shallow`; `limit ≈ 50`;
   throttle leading-edge; `past`/`future` observables; `historyPaused`). Va por
   dentro de `subscribeWithSelector` y por fuera de `immer`. Test humo de orden de
   middleware (undo hace merge parcial de las 7 claves de dominio y preserva la UI;
   el `subscribe` selectivo del autosave sigue funcionando).
2. `historyPaused` + vaciado de `past`/`future` en `loadDataIntoStore` / `reset` /
   `__resetSyncForTests` + test (cargar B con edición de A en vuelo → `past` vacío
   tras la ventana de throttle — espejo de los tests D-08).
3. Botones en `TopBar` (deshabilitado vía `useStore(temporal, …)`) + atajos en
   `useAppHotkeys` (antes del early-return de modificadores, con
   `!isTextEditingTarget()` y gating de readonly).
4. Tests: mass complete = 1 undo con restauración exacta de `lineQty`; coalescing
   de tecleo **afirmando el valor pre-ráfaga**; deshacer un borrado de partida
   certificada restaura partida Y limpia su tombstone (`bajas`); undo/redo
   restaura dominio y no UI.
5. (Opcional v2) Converger el toast de borrado con la pila global; clasificador de
   coalescing (acciones estructurales empujan inmediato + flush del throttle).

## Riesgos

- **Orden de middleware propio×immer×subscribeWithSelector**: mitigado con test
  humo temprano (el `subscribe` selectivo del autosave debe seguir vivo).
- **Coalescing con el "antes" equivocado**: usar throttle leading-edge (no
  debounce trailing); test que afirma el valor pre-ráfaga.
- **Coalescing demasiado agresivo/laxo**: empezar con throttle global y ajustar el
  valor con dogfood.
- **Memoria**: acotada por `limit` + structural sharing; verificar con obra grande.
- **Olvidar limpiar el historial** al cargar obra: es el bug D-08; cubrir con test
  desde el primer commit — Y desde los flujos de import directo, no solo `sync.ts`.
- **Refs de UI colgando tras undo** (capítulo/cert borrados): mitigado con la
  reconciliación de UI (ver refuerzos).

## NO en alcance (deferido conscientemente)

- **Command/event-log (Enfoque C)**: auditoría/colaboración; XL, reescribe slices.
  Futuro, solo si se quiere traza o multiusuario.
- **Bloquear mutaciones en pestaña readonly**: latente y transversal → a `TODOS.md`
  (no lo crea undo/redo; undo se limita a igualar el comportamiento actual).
- **Convergencia toast↔undo global** (retirar el toast de borrado): v2. En v1 el
  toast se hace idempotente y convive.
- **Clasificador de coalescing** (acciones estructurales empujan inmediato): v2,
  tras medir; v1 arranca con throttle global (o sin él, según el spike).
- **Fase 0 (toast puntual de «Completar»)**: innecesaria si B entra pronto (B lo
  cubre restaurando el estado exacto).

## Qué ya existe (y se reutiliza)

- **Frontera de dominio del autosave** ([sync.ts:112](../src/persist/sync.ts#L112)):
  da la lista de campos del `partialize` (se amplía a 7 con `bajas`, alineando ambos
  slices).
- **Flag `suppress`** del autosave: patrón espejo para `historyPaused`.
- **`useToastStore.clear()` en `loadObra`/`reset`** (D-08): mismo punto exacto donde
  pausar/limpiar el historial.
- **`toSerializable`**: fuente de la lista de campos de dominio (se reutiliza la
  LISTA, no la función).
- **Clamps existentes** (`setCurCert`, `revealPartida`): base para la reconciliación
  de UI tras undo/redo.
- **Structural sharing de immer**: memoria del historial acotada sin trabajo extra.
- **Toast «Deshacer» de borrado** ([usePartidaDelete.ts](../src/hooks/usePartidaDelete.ts)):
  precedente de UX; se conserva y se hace idempotente.

El plan **reutiliza** estas piezas; no reconstruye ninguna.

## Implementation Tasks

Sintetizadas de los hallazgos de esta revisión. P1 bloquea; P2 mismo branch; P3 seguimiento.

- [ ] **T1 (P1, human: ~1 día / CC: ~30 min)** — store/temporal — Escribir el middleware temporal propio
  - Surgido por: Arquitectura Issue 1 — `partialize` 7 claves, `equality: shallow`, throttle leading-edge, `limit≈25`, `historyPaused`, `canUndo/canRedo` observables. Por dentro de `subscribeWithSelector`, por fuera de `immer`.
  - Ficheros: `src/store/temporal.ts` (nuevo), `src/store/obraStore.ts`
  - Verificar: `src/store/temporal.test.ts` (push/no-push, throttle pre-ráfaga, límite, recipe/object/no-op set)
- [ ] **T2 (P1, human: ~2h / CC: ~15 min)** — store — `historyPaused`+clear DENTRO de `loadObra`/`reset`
  - Surgido por: Voz externa A — cubre import/backup/`newObra`/switch/handoff, no solo `sync.ts`.
  - Ficheros: `src/store/obraStore.ts`
  - Verificar: `obraStore.test.ts` — `past` vacío tras load con edición en vuelo (incl. import directo). REGRESIÓN.
- [ ] **T3 (P1, human: ~2h / CC: ~15 min)** — store — Reconciliar UI tras undo/redo
  - Surgido por: Voz externa B — `active`→`ALL` si no existe; `curCert` clamp; `openPartidaId` validar.
  - Ficheros: `src/store/temporal.ts` / `obraStore.ts`
  - Verificar: undo de `addChapter`/`addCert` no deja refs colgando.
- [ ] **T4 (P1, human: ~30 min / CC: ~5 min)** — store/estructura — `restorePartida` idempotente
  - Surgido por: Voz externa — doble-undo duplicaba la partida.
  - Ficheros: `src/store/slices/estructuraSlice.ts`
  - Verificar: `obraStore.test.ts` — restore con id existente = no-op.
- [ ] **T5 (P2, human: ~15 min / CC: ~5 min)** — persist — Alinear `domainSlice` del autosave a 7 claves (`bajas`)
  - Surgido por: Voz externa — desajuste de shape autosave(6)/historial(7).
  - Ficheros: `src/persist/sync.ts`
  - Verificar: el autosave sigue disparando en cambios de dominio.
- [ ] **T6 (P2, human: ~3h / CC: ~20 min)** — layout/hooks — Botones TopBar + atajos
  - Surgido por: Arquitectura Issue (UI) — `canUndo/canRedo`; atajos antes del early-return, `!isTextEditingTarget()`, permitido en readonly.
  - Ficheros: `src/layout/TopBar.tsx`, `src/hooks/useAppHotkeys.ts`
  - Verificar: `useAppHotkeys.test.tsx` — atajos disparan; inertes dentro de `<input>`.
- [ ] **T7 (P2, human: ~4h / CC: ~25 min)** — tests — Suite de integración undo/redo
  - Surgido por: Test review — mass-complete=1 undo restaura `lineQty`; coalescing pre-ráfaga; redo restaura snapshot; delete certificada restaura `bajas`; undo restaura dominio y no UI.
  - Ficheros: `obraStore.test.ts`, `temporal.test.ts`
  - Verificar: `vitest`.
- [ ] **T8 (P3, human: ~1h / CC: ~15 min)** — spike — Verificar modelo de commit + medir memoria
  - Surgido por: Voz externa D — blur/Enter vs pulsación decide si hace falta throttle; medir memoria con obra dogfood para fijar `limit`.
  - Ficheros: —
  - Verificar: manual.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN→RESOLVED | 3 decisiones + 6 refuerzos voz externa, todos incorporados |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX (voz externa):** 12 hallazgos; los 3 de fondo (boundary de `loadObra`, refs de UI colgando, doble-undo del toast) verificados contra código e incorporados; 6 refuerzos aceptados; 1 llevado a `TODOS.md`; 1 (redo=snapshot) ya cubierto por diseño.
- **CROSS-MODEL:** revisión por secciones + voz externa concuerdan; sin tensión sin resolver (la de readonly quedó reconciliada: permitir undo ahora + TODO para el problema de raíz).
- **VERDICT:** ENG CLEARED — plan listo para implementar (fases T1→T8).

NO UNRESOLVED DECISIONS
