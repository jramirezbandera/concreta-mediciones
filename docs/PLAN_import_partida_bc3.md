# Plan — Importar una partida desde el Generador de Precios CYPE (.bc3)

> Estado: **revisado** (dual-voice Codex + subagente independiente) y con las dos
> decisiones de dominio confirmadas por el usuario. Listo para implementar.

## Objetivo
Usar el Generador de Precios CYPE como **base de precios**: importar **partidas sueltas**
(un `.bc3` exportado vía FIE BDC = una partida con su descomposición y recursos) al
presupuesto, sin reemplazar la obra. Ejemplo: `docs/spike/samples/REC010_…bc3`
(REC010, 902,50 €/Ud, 8 recursos + CI 2% del `~K`, árbol root##→R#→RE#→REC#→REC010).

## Decisión de entrega (confirmada por el usuario)
La app es una **SPA web pura** (Vite + React 19, Zustand, `idb-keyval`; sin Electron,
sin backend). El comportamiento literal de Arquímedes ("arrastrar el ENLACE FIE BDC")
**no es reproducible** en web pura: al soltar un enlace de otra pestaña el `DataTransfer`
solo trae la URL (`text/uri-list`/`text/plain`), no los bytes; y `fetch()` a
`my.generadordeprecios.info` está bloqueado por CORS + sesión CYPE. **Ambos revisores lo
confirman como límite duro.**

**Entrega elegida:** arrastrar el **FICHERO** `.bc3` ya descargado (un clic en FIE BDC lo
baja → se arrastra desde la barra de descargas/explorador a la zona del presupuesto) **+
botón "+ Importar partida (.bc3)"**. Si el usuario suelta un enlace en vez del fichero →
aviso accionable. El "puente de descarga" (proxy CORS o shell Electron) queda en scope B
(`docs/TODOS.md`).

## Decisión de costes indirectos (confirmada por el usuario)
**Conservar el CI de origen, visible.** La partida importada mantiene su línea `%CI` al %
de origen (2% en REC010), como Arquímedes (precio de base = autoridad, congelado). Se
muestra el % de CI por partida para que 2% vs 3% sea **visible** y no se mezcle en
silencio. Esto preserva el 902,50 € exacto.

## Lo que YA existe (reutilizar)
- `src/core/bc3import.ts::bc3ToObra(bytes)`: parser + charset + recorrido descompo + CI +
  marca `precioManual` + recálculo de precio desde descompuesto (REC010 trae `~C …|0|`,
  el precio sale de la descomposición). Hoy alimenta `loadObra` (reemplaza la obra).
- Worker `bc3worker.ts` + `parseBc3.ts` + hook `useBc3Parse` (parseo fuera del hilo UI, con
  `busy`/`error`).
- Pipeline de copia de referencia: `core/refdata.ts` (`RefCopyItem`, `hydrateItem`,
  `detectCollisions`, `Resolution`) + `store/obraStore.ts` (`requestCopyRefPartidas`,
  `applyCopy`, `pendingCopy`, modal `ConflictModal`). Inserta partida en capítulo/sub,
  fusiona recursos sin pisar homónimos, resuelve colisiones de código (merge/fork), numera
  `pos`. Confirmado seguro: **no toca `s.rates` ni crea capítulos** → sin fugas de GG/BI/IVA
  ni capítulos fantasma.

## Diseño (MVP) — con los arreglos del review

### 1. Adaptador `bc3 → RefCopyItem[]`  (`src/core/bc3ToPartidas.ts`)
`export function bc3ToRefCopyItems(bytes): { items: RefCopyItem[]; report: Bc3Report; error?: string }`
- Reutiliza `bc3ToObra(bytes)` y **aplana solo las partidas hoja** (ignora estructura/rates).
- **[FIX review #5]** `bc3ToObra` lanza `Bc3ImportError` si no hay estructura reconocible
  (`chapters.length === 0`). El adaptador **captura** ese throw y el "0 partidas hoja" y los
  mapea al estado "no se encontró ninguna partida" (no error duro).
- **[FIX review #3 — CI]** Preserva la línea `%CI` de origen **con su `desc` y su %** (no la
  normaliza ni la pisa). Expone `ciPct` por partida en el `RefCopyItem` para el badge.
- Hidrata el resto de items desde `recursos` (como `partidaToRefCopyItem`).
- `sourceName`/provenance = "CYPE GP (.bc3)" (ver §2).

### 2. Wrapper de importación  (`store/obraStore.ts`)  — **requerido, no opcional**
`importPartidasFromBc3(items, target)` (envuelve `applyCopy`):
- **[FIX review #2 — precioManual]** `RefPartida`/`RefCopyItem` y `applyCopy` se extienden
  para **transportar `precioManual`**; el wrapper lo fija cuando `precio ≠ descompUnit(items)`.
  Sin esto, al editar un recurso colisionante (p.ej. `mo113`) `editRecurso` resincroniza y el
  902,50 € se va. (Hoy `partidaToRefCopyItem` omite `precioManual` a propósito.)
- **[FIX review #3 — %CI desc]** `applyCopy` deja de descartar `desc` del `%CI`; lo conserva.
- **[FIX review #6 — provenance]** Se añade un tercer valor de procedencia (`'import'`) o un
  `baseSource: 'CYPE GP (.bc3)'` distinto de la copia de Referencia, para etiquetar origen.
- Colisiones de recurso → modal `pendingCopy` existente (reusa `detectCollisions`).

### 3. Zona de drop de fichero — **una sola, desacoplada de `refDrag`**
- **[FIX review #4]** NO sobrecargar los `onDrop` de fila/capítulo (hoy están **condicionados
  a `refDrag != null`**, así que un drop de fichero externo nunca dispararía). En su lugar:
  un **dropzone de fichero a nivel `main`** que aparece cuando `e.dataTransfer.types` incluye
  `'Files'`. Los handlers de `refDrag` (fila/sub) se quedan intactos. Destino = capítulo/sub
  activo vía `copyTargetOf`.
- **[FIX review #4]** Guard global `dragover`/`drop` con `preventDefault` para que soltar un
  `.bc3` fuera de la zona **no navegue** (la app autoguarda en `pagehide`; una navegación
  persistiría medio estado).
- Flujo: bytes → `parseBc3` (worker, con `busy`) → `bc3ToRefCopyItems` → `importPartidasFromBc3`.
- Realce de drop propio (no el de `refDrag`).

### 4. Botón "+ Importar partida (.bc3)" — **columna vertebral**
- En la **topbar del presupuesto** (global). `<input type="file" accept=".bc3" multiple>`.
- Mismo flujo que el drop. Es el camino testeable, accesible y móvil; el drag es realce.

### 5. Detección de enlace soltado (no fichero)
- Drop con `text/uri-list`/`text/plain` y **sin** `files` → aviso: "Arrastrar el enlace no
  funciona en la versión web por seguridad del navegador. Pulsa FIE BDC para descargar el
  `.bc3` y arrástralo aquí (o usa + Importar)." (Solo detectable en `drop`, no en `dragover`.)

## Alcance
- **MVP:** 1 partida (caso CYPE). El adaptador acepta N partidas hoja sin coste extra, pero
  **si N>1 avisa** ("este .bc3 trae N partidas; se importarán todas al destino, sin su
  estructura de capítulos") — limitación conocida, no caso CYPE.
- **Fuera (scope B → TODOS.md):** fetch directo del enlace (proxy CORS o Electron); import
  masivo de catálogo; edición del recurso entrante antes de fusionar.
- **D-B (auto):** botón en topbar + drop global; **drop por capítulo se difiere** (es la
  fuente del enganche entre los dos modos de drag).

## Estados UI a cubrir
- Drop/botón válido sin colisión → partida añadida, capítulo expandido, realce a la nueva.
- Colisión de recurso → modal `pendingCopy` (merge/fork) existente.
- **`busy`** durante el parseo (reusar `useBc3Parse.busy`; un `.bc3` grande no debe dejar UI muerta).
- Enlace/URL en vez de fichero → aviso accionable (§5).
- No-`.bc3` / `.bc3` corrupto → error del worker → toast claro (reusar manejo de `useBc3Parse`).
- `.bc3` sin partidas hoja / sin estructura → "no se encontró ninguna partida" (§1, captura el throw).
- N>1 partidas → import + aviso de limitación.

## Plan de pruebas
- **Regresión sample real [review #3]:** `bc3ToRefCopyItems(REC010_…bc3)` → 1 item, code `REC010`,
  ud `Ud`, **precio 902,50**, items = 8 recursos hidratados + `%CI` (2%, con su desc), `desc` con
  el `~T`, sin mojibake (charset ANSI/windows-1252).
- **CI no se mezcla [review #7]:** importar REC010 (CI 2%) en obra con partidas CI 3% → la
  partida importada conserva su `%CI` 2% y el % es visible; no se altera el CI de las demás.
- **Supervivencia de `precioManual` [review #7]:** importar REC010 → editar un recurso
  colisionante (`mo113`) → **902,50 € intacto** (sin este test el bug pasa silencioso).
- **Conservación de PEM [review #7]:** el PEM sube exactamente `cantidad × 902,50 × coefK`.
- **Store/colisión:** reusa `copyConflict.test.ts`; soltar items adaptados con recurso a
  precio/unidad distinta dispara `pendingCopy`.
- **DnD [review #4]:** drop de `File('.bc3')` **con `refDrag === null`** dispara el flujo
  (condición real); drop de URL muestra el aviso; el guard `dragover` evita navegación; botón + abre picker.
- **Bordes:** `.bc3` sin partidas → estado "no encontrada"; N>1 → aviso.

## Decision Audit Trail
| # | Fase | Decisión | Clasificación | Principio | Razón | Rechazado |
|---|------|----------|---------------|-----------|-------|-----------|
| 1 | CEO | Entrega = drop de fichero + botón (no link-drag literal) | User Challenge → **usuario confirmó** | — | Límite duro CORS/web puro confirmado por ambos modelos; usuario eligió A | Proxy/backend; Electron |
| 2 | CEO | CI: conservar el de origen, visible por partida | Taste de dominio → **usuario confirmó** | P1 | Preserva 902,50 €, evita mezcla silenciosa; usuario eligió A | Quitar CI de origen |
| 3 | Eng | Wrapper `importPartidasFromBc3` (no reuso pelado) | Mechanical (review lo subió de taste a requisito) | P1/P5 | Sin él se pierde `precioManual` y la procedencia | — |
| 4 | Eng | Threadear `precioManual` por RefCopyItem/applyCopy | Mechanical | P1 | Evita deriva del precio al editar recursos | — |
| 5 | Eng | Conservar `desc` del `%CI` en applyCopy | Mechanical | P1 | La política CI exige el % visible | — |
| 6 | Eng | Dropzone único a nivel `main` + guard dragover | Mechanical | P5 | Los handlers refDrag están gated; evita enganche de 2 modos y navegación accidental | Sobrecargar onDrop de fila |
| 7 | Eng | 3 tests nuevos (CI, precioManual, PEM) + sample real | Mechanical | P1 | El review predice 2 bugs que los tests actuales no atrapan | — |
| 8 | CEO | Botón en topbar; drop por capítulo diferido | Taste | P3/P5 | Reduce superficie y enganche; el usuario selecciona capítulo antes | Drop por capítulo |
| 9 | CEO | Aceptar N partidas hoja con aviso si N>1 | Taste | P3 | El adaptador ya lo soporta; protege ante .bc3 no-CYPE | Rechazar N>1 |

## Implementation Tasks
- [x] **T1 (P1) — core** `src/core/bc3ToPartidas.ts`: `bc3ToRefCopyItems` (reusa `bc3ToObra`,
  aplana hojas, captura `Bc3ImportError`). **Ajuste tras la muestra real:** `bc3ToObra` pliega
  el CI del ~K en el precio (929,58, convención Presto); CYPE muestra 902,50 (CI = coeficiente
  de proyecto, aparte). El adaptador **quita esa línea de CI y recalcula el precio = directos
  (902,50)**, y expone el CI (3%) en `ciPct` (badge). + tests sample real/hidratación/CI/bordes.
- [x] **T2 (P1) — types/applyCopy** `RefPartida` y `Partida` += `precioManual`/`ciPct`;
  `applyCopy` los transporta y conserva `desc` del `%CI`. (Sin enum `provenance` nuevo: la
  procedencia ya viaja en `baseSource` = "CYPE GP (.bc3)" — más simple, mismo resultado.)
- [x] **T3 (P1) — store** El adaptador + `requestCopyRefPartidas` existente cubren la inserción
  (no hizo falta acción nueva). Tests: precio 902,50, **supervivencia a editar recurso** (precioManual),
  CI no mezclado, fusión de recursos. (PEM-increase no aplica: la base entra sin medición, qty 0,
  como copiar de Referencia.)
- [x] **T4 (P2) — ui** `<main>` acepta drop de fichero (rama `Files`) sin tocar los handlers
  `refDrag`; guard global `dragover/drop` preventDefault (no navegar); guard `defaultPrevented`
  para ceder a zonas hijas (vista Importar); realce propio (`fileOver`); parser por import dinámico
  (`processBudgetDrop`). + tests (drop con `refDrag===null`, enlace, no-.bc3).
- [x] **T5 (P2) — ui** `ImportPartidaButton` en el TopBar (solo vista presupuesto); selector .bc3;
  el parser se carga por import dinámico (no entra en el bundle inicial; chunk `parseBc3` 35 KB aparte).
- [x] **T6 (P2) — ui** `CiChip` (badge "CI X%") en `PartidaRow` + `PartidaCard`; aviso de
  enlace-soltado vía toast global.
- [x] **T7 (P3) — docs** `docs/TODOS.md` T-20: scope B (puente de descarga proxy/Electron) + límite N>1.
