# Auditoría de rendimiento — Concreta · Mediciones

> Fecha: 2026-06-14 · Rama: `main` · Método: 5 auditorías en paralelo (estado/store,
> persistencia/arranque, render React, panel de referencia+copia, importación .bc3),
> todas en solo-lectura sobre el código actual.

## 0. Síntomas reportados

- "La aplicación tarda en cargar."
- "Cada acción tiene un tiempo de retardo" (al editar).
- El **panel de referencia** y la **copia** van lentos.
- Empeora con **varias obras**, **bases de precios muy grandes** e **importaciones**.

## 1. Conclusión ejecutiva

El retardo **no** viene de "tener varias obras cargadas": el diseño multi-obra es correcto
— solo se hidrata en memoria la **obra activa** (carga perezosa desde IndexedDB), las demás
son metadatos. El coste escala con el **tamaño de la base de precios activa**, no con el nº
de obras.

Hay **tres causas raíz transversales**, y las tres comparten un mismo origen: **Immer
sustituye la referencia de `partidas`/`recursos` en cada mutación**, y tres capas reaccionan
recorriendo / serializando / renderizando **TODO el dominio** en lugar del cambio concreto:

1. **Persistencia no incremental** — el autosave re-serializa y reescribe en IndexedDB la
   **obra activa entera** (todas las partidas + banco completo) en **cada** mutación.
2. **Render no acotado** — **no hay virtualización en ninguna lista** ni **`React.memo` en
   ninguna fila**; además cada fila se suscribe al **banco completo**. Resultado: teclear en
   una celda re-renderiza y recalcula **todas** las filas de la obra.
3. **Recálculo global por tecla** — los selectores memoizados (`memo1`) se invalidan en cada
   edición y recorren toda la obra (PEM, conteos, uso de recursos, resumen).

Y dos causas raíz **localizadas** que afectan a síntomas concretos:

4. **Sin code-splitting** — el parser FIEBDC (~117 KB) y todas las vistas entran en el bundle
   inicial → "tarda en cargar".
5. **Buscador de referencia sin debounce ni índice** — re-filtra la base entera en cada
   pulsación → "el panel de referencia va lento".

Lo que **SÍ está bien hecho** (no tocar): multi-obra con hidratación perezosa; parseo .bc3 en
un **Web Worker real** y O(n); la **copia de recursos es lineal O(1) por recurso** (no O(n²));
los selectores no devuelven objetos nuevos; las librerías de export (`docx`, `write-excel-file`)
ya van con `import()` dinámico; `BuscarPartidas` (búsqueda en la obra) ya usa `useDeferredValue`
+ índice + tope.

## 2. Diagnóstico detallado (evidencia)

### CR-1 · Autosave reescribe la obra entera en cada mutación — CRÍTICO
- `src/persist/sync.ts:60-100` — autosave suscrito al slice de dominio completo
  `[chapters, partidas, recursos, certs, rates, obra]`; cualquier escritura anidada cambia la
  referencia top-level → dispara siempre (debounce 600 ms).
- `src/persist/persist.ts:109-134` — `idb-keyval.set()` hace **structured-clone síncrono del
  `ObraData` completo** (incluido el banco `recursos` entero) antes de escribir.
- `src/store/obraStore.ts:596-606` — `toSerializable` solo reempaqueta referencias (barato);
  el coste está en el clone+write de IndexedDB.
- **Escala:** O(tamaño total de la obra activa) por ráfaga de edición. Con banco grande, cada
  pausa de 600 ms congela el hilo para serializar varios MB. Editar **una** medición reescribe
  **todo el banco**.

### CR-2 · Sin virtualización + sin `React.memo` + suscripción al banco por fila — CRÍTICO
- Sin virtualización (confirmado por grep: 0 `react-window`/`virtual`):
  `src/features/presupuesto/PartidasTable.tsx:82-87`, `src/features/presupuesto/AllChapters.tsx:39`,
  `src/features/certificaciones/CertTable.tsx:330-353`,
  `src/features/referencia/ReferenciaPanel.tsx:493`.
- Sin `React.memo` en ninguna fila (confirmado por grep: 0 `React.memo`/`useShallow` en UI).
- `src/hooks/usePartidaRow.ts:57-61` — **cada** `PartidaRow`/`PartidaCard` hace
  `useObraStore((s) => s.recursos)` (banco completo) y recalcula `descompUnit`/`precioCuadra…`
  por fila en cada render.
- **Escala:** editar **cualquier** recurso reemplaza `recursos` → **todas** las filas montadas
  re-renderizan y recalculan. En "Toda la obra" se montan todas las partidas de todos los
  capítulos a la vez (decenas de miles de nodos DOM).

### CR-3 · Recálculo global por tecla en selectores memoizados — ALTO
- `src/store/selectors.ts:27-41` (`memo1`, 1 solo slot) usado por `selectPem:71`,
  `selectChapterTotals:67`, `selectCounts:80`, `selectRecursoUsage:85`, `selectResumen:181`.
- Como `partidas` cambia de referencia en cada edición, todos recorren la obra completa
  (`pemCore`/`chapterTotal`/`banco.ts:40-49`/`listado.ts:208`). Se consumen en componentes
  siempre montados (Sidebar, StatusBar, App).
- Equivalente en certificaciones: `src/store/selectors.ts:108-117` hace
  `Object.values(partidas).flat()` en el cuerpo memoizado; `CertificacionesView.tsx:133-142`
  recalcula totales por capítulo en el render sin memo.

### CR-4 · `editRecurso` re-sincroniza precio sobre TODAS las partidas — ALTO (O(n·k))
- `src/store/obraStore.ts:972-989` (bucle `:982-983`) — al editar el precio de un recurso,
  recorre **todas** las partidas sin override y recalcula `descompUnit` por cada una, dentro de
  un único `produce` de Immer. Editar un recurso común (p. ej. "Peón ordinario", usado por
  miles de partidas) recalcula y muta miles de partidas → dispara en cascada CR-1, CR-2 y CR-3.

### CR-5 · Sin code-splitting; parser .bc3 eager en el bundle inicial — ALTO (carga)
- `src/App.tsx:1-21` — todas las vistas con import estático; **0 `React.lazy`** en `src/`.
- `src/features/importar/parseBc3.ts:7,11-19` importa estáticamente `bc3ToObra`
  (`src/core/bc3import.ts:24` → `src/vendor/bc3/**`, ~117 KB / 69 archivos / ~3.800 LOC) para el
  fallback sin worker → el parser entra en el chunk principal.
- Bien hecho (referencia): export libs ya diferidas en `src/features/exportar/xlsx.ts:43` y
  `docx.ts:12`.

### CR-6 · Buscador de referencia sin debounce ni índice — ALTO (panel de referencia)
- `src/features/referencia/ReferenciaPanel.tsx:413` (`setQ` síncrono),
  `:336` (`matchP` construye string nuevo por partida y tecla), `:458-460`/`:493` (re-filtra y
  re-monta todos los capítulos por pulsación; con query, `open=true` fuerza montar todo).
- **Contraste:** `src/features/presupuesto/BuscarPartidas.tsx:52-53` + `src/core/buscar.ts:86,109`
  ya hace lo correcto (deferred + índice `haystack` + tope 50). El panel de referencia no lo reusa.

### CR-7 · Re-render del árbol y selección no acotados en referencia — MEDIO
- `src/features/referencia/ReferenciaPanel.tsx:296-299,343-352,494-497` — `sel`/`expanded`/`q`
  viven en el panel; `RefPartidaRow` no está memoizada y `toggleSel`/`dragStart`/`onCopyOne` se
  recrean en cada render → marcar un check reconcilia toda la lista.

### CR-8 · "La copia va lenta" = el re-render posterior, NO la fusión de recursos — MEDIO
- `src/store/obraStore.ts:207-281` (`applyCopy`) y `src/core/refdata.ts:468-486`
  (`detectCollisions`) son **lineales** (lookup O(1) por código en el banco; verificado línea a
  línea). El retardo al pegar es la cascada CR-2/CR-3 + Immer materializando un capítulo grande,
  no la integración "sin pisar homónimos". `forkCode` (`obraStore.ts:193-199`) es O(n²) solo en
  el patológico (re-copiar recursos ya bifurcados).

### CR-9 · Importar: el coste está DESPUÉS del worker, en el hilo principal — MEDIO
- El parseo está en worker real y O(n): `src/features/importar/parseBc3.ts:20-36` (transferable),
  `src/features/importar/bc3worker.ts:17`.
- El "tirón" al importar es: (a) `loadObra` desde `ImportarView.tsx:33` **no suprime el autosave**
  → escribe el blob completo a IDB (CR-1); (b) `loadObra` drafta toda la obra en Immer
  (`obraStore.ts:886-889`, podría reemplazar fuera de Immer); (c) re-render total del árbol;
  (d) **doble parseo** si el `~V` declara charset ≠ windows-1252 (`src/core/bc3import.ts:215-219`).

### CR-10 · Costes O(n) menores por render — BAJO
- `src/core/tree.ts:76-84` (`findNode` re-aplana el árbol; llamado 3× por render en
  `PresupuestoView` y por capítulo en `Sidebar`), `src/layout/Sidebar.tsx:596-602`
  (`emptyContainers` de toda la obra por tecla), `obraCache` de referencia sin LRU
  (`ReferenciaPanel.tsx:263` — varias bases grandes abiertas acumulan copias hidratadas en RAM).

## 3. Plan de soluciones (por prioridad impacto/esfuerzo)

Esfuerzo: **S** ≈ <½ día CC · **M** ≈ ½–1½ día · **L** ≈ 2–4 días.

### Tier 0 · Línea base de medición (antes de optimizar)
- **T0.1** Fixture `.bc3` grande real (CYPE/BCCA) en `spike/samples/` + un perfil reproducible
  (React DevTools Profiler + `performance.mark` en editar-celda, abrir-referencia, copiar,
  importar, arranque). Cuantificar antes/después. Esfuerzo: **S**.

### Tier 1 · Mata "cada acción tiene retardo" (máxima palanca)
- **T1.1** `React.memo` en `PartidaRow`, `PartidaCard`, `CertRow`, `RefPartidaRow` + estabilizar
  callbacks con `useCallback`. → editar una celda deja de re-renderizar las demás filas.
  Esfuerzo: **S/M**. (CR-2, CR-7, CR-8)
- **T1.2** `usePartidaRow`: dejar de suscribirse al banco completo por fila. Derivar
  `descompUnit`/`isOverride` con un selector memoizado por id de partida (recomputado solo si
  cambia `recursos`) o pasar el banco por contexto estable. Esfuerzo: **M**. (CR-2)
- **T1.3** Persistencia incremental: separar el banco `recursos` a su **propia clave IDB** y
  reescribirlo solo cuando cambian recursos (no al teclear mediciones/certs); mover
  clone+write a `requestIdleCallback`/worker. Mínimo viable: partir "dominio pesado"
  (partidas+recursos) de "ligero" (rates/obra/certs). Esfuerzo: **M/L**. (CR-1)

### Tier 2 · Gran salto con bases grandes
- **T2.1** Virtualizar listas largas con `@tanstack/react-virtual`. Orden: panel de Referencia →
  "Toda la obra" (presupuesto) → `CertTable`. Esfuerzo: **L**. (CR-2)
- **T2.2** Buscador de referencia: `useDeferredValue` + `haystack` precomputado por fuente +
  gate ≥2 chars + tope de resultados. Reusar `core/buscar.ts`. Esfuerzo: **M**. (CR-6)
- **T2.3** Selectores incrementales por capítulo (PEM/conteos/cert-totales): recomputar solo el
  capítulo tocado y sumar capítulos memoizados; evitar `.flat()` en el path memoizado.
  Esfuerzo: **M**. (CR-3)

### Tier 3 · Tiempo de carga
- **T3.1** `React.lazy` + `Suspense` para `ImportarView`, `ReferenciaImportModal`,
  `Print*`, `ExportModal`, `ReferenciaPanel`, `Sandbox`. Esfuerzo: **S/M**. (CR-5)
- **T3.2** `parseBc3.ts`: importar `bc3ToObra` con `import()` dinámico también en el fallback →
  el parser sale del bundle inicial. Opcional `build.rollupOptions.manualChunks` para aislar
  `vendor/bc3`, `docx`, `write-excel-file`. Esfuerzo: **S**. (CR-5)

### Tier 4 · Algorítmico + pulido de importación
- **T4.1** `editRecurso`: índice inverso `recurso → partidas que lo usan`; resincronizar solo
  esas. Esfuerzo: **M**. (CR-4)
- **T4.2** Importar: suprimir autosave en la ruta de `ImportarView` (escritura única
  controlada) y reemplazar la obra **fuera de Immer** en `loadObra`. Esfuerzo: **S/M**. (CR-9)
- **T4.3** Charset: leer solo la cabecera `~V` para detectar charset y parsear **una** vez.
  Esfuerzo: **M**. (CR-9)
- **T4.4** Pulido: `Map<id,FoundNode>` para `findNode`/`flattenContainers`; `emptyContainers`
  por capítulo; LRU (1–2) en `obraCache`; cache de índice en `forkCode`. Esfuerzo: **S** c/u.
  (CR-10)

## 4. Riesgos y validación

- **Virtualización (T2.1)** es el cambio de mayor riesgo: las tablas usan `<table>` con `thead`
  sticky y grupos por subcapítulo; requiere refactor a contenedor con alturas medidas o filas
  absolutas. Empezar por el panel de Referencia (lista más simple) reduce riesgo.
- **Persistencia particionada (T1.3)** toca el seam de serialización y la migración de esquema;
  cubrir con tests de hidratación/guardado y un round-trip export/import.
- Mantener verdes los ~255 tests existentes; añadir tests de regresión de rendimiento básicos
  (nº de renders por edición con React Testing Library + un contador).
- Cada Tier es entregable de forma independiente; medir con T0.1 tras cada uno.

## 5. Orden recomendado

`T0.1` → `T1.1` → `T1.2` → `T1.3` → `T2.2` → `T2.1` → `T3.1`+`T3.2` → `T2.3` → `T4.*`.

Tier 1 debería eliminar la mayor parte del "retardo en cada acción" percibido; Tier 2 es lo que
hace usable una base de decenas de miles de partidas; Tier 3 ataca el tiempo de carga.

---

## GSTACK REVIEW REPORT (autoplan · 2026-06-14)

Revisado por 3 voces independientes: **2 subagentes Claude** (ingeniería + estrategia) y
**Codex `gpt-5.5`** (xhigh). Alcance: **Eng a fondo + estrategia**. **Design N/A** (el plan no
propone cambios visuales/UX; solo se anotan 2 micro-toques: mensaje de "afina la búsqueda" al
capar resultados y confirmación al "copiar capítulo entero"). **DX N/A** (app de usuario final,
no herramienta de desarrollador).

### Consenso (3/3 confirman el diagnóstico)
El diagnóstico de causas raíz es **correcto y verificado** en el código. Lo que declara "ya bien
hecho" (worker real, copia lineal, hidratación perezosa, export libs diferidas, `BuscarPartidas`)
es cierto, sin falsos positivos. Pero la revisión añade **1 corrección de fondo + 3 correcciones
de secuenciación/medición** que cambian el plan.

| Dimensión Eng | Claude | Codex | Consenso |
|---|---|---|---|
| Arquitectura de los fixes sólida | sí, con reorden | sí, falta el modelo de datos | **CONFIRMADO (sólida pero incompleta)** |
| Cobertura de tests suficiente | NO (faltan tests de render) | NO | **CONFIRMADO: hueco** |
| Riesgos de rendimiento atendidos | parcial (T1.3/T2.1 sobredimensionados) | parcial | **CONFIRMADO: revisar T1.3/T2.1** |
| Caminos de error atendidos | NO (atomicidad T1.3, flush al cerrar) | NO | **CONFIRMADO: concern** |
| Riesgo de despliegue manejable | sí (tiers independientes) | sí | **CONFIRMADO** |
| Seguridad | N/A (sin nueva superficie) | N/A | N/A |

### CR-0 · La mayor palanca que el plan NO contemplaba — DATA-MODEL (User Challenge)
Voz de estrategia y Codex, **independientemente**, señalan lo mismo: el banco `recursos` vive en
el **mismo blob `ObraData` y el mismo grafo Immer** que `partidas` (`obraStore.ts:283-293`). Al
importar una base CYPE/BCCA grande, **decenas de miles de recursos entran en el estado VIVO**
editado y persistido — y de ahí cuelgan CR-1, CR-2 **y** CR-4 a la vez. `ImportarView.tsx:33`
carga el `.bc3` directamente al store vivo; `ReferenciaImportModal.tsx:53` también usa `loadObra`
si no hay obra activa.
**Tesis de la revisión:** el banco vivo de una obra real solo necesita los recursos que sus
partidas **usan** (decenas/centenares), no la base entera. La base de referencia es una **fuente
de consulta externa** (cargada bajo demanda, fuera del autosave), de la que `applyCopy` ya copia
solo lo necesario (CR-8, lineal). Si se separa, **buena parte de Tier 2 (virtualización) y Tier 4
se vuelven innecesarias**. → Decisión del fundador (no auto-decidida): ver gate.

### Correcciones adoptadas (consenso 3/3)
- **C1 · Orden de Tier 1 invertido.** `React.memo` (T1.1) es casi un no-op mientras `usePartidaRow`
  siga suscribiendo cada fila al banco completo (`usePartidaRow.ts:57-59`). **Hacer T1.2 antes/junto
  con T1.1** y estabilizar los callbacks inline (`PartidaRow.tsx:82,94,115`; en referencia
  `ReferenciaPanel.tsx:498-502`). Además, una edición de **medición** cambia el denominador
  `chapterTotal` de todas las filas del capítulo → **separar la barra de % del cuerpo de la fila** o
  el memo tampoco corta ahí. La vía más barata para T1.2: pasar el banco por **contexto estable**.
- **C2 · "Por tecla" es inexacto.** Las celdas (`MedCells.tsx:79-80`, `EditableNum.tsx:81-89`)
  hacen commit en Enter/blur, **no** por carácter. La cascada se dispara **1 vez por edición
  confirmada**. El fixture de T0.1 debe medir **commit-de-celda** (e incluir "editar precio de
  recurso común", que solo mejora en T4.1), no keypress, o medirá coste 0. (El buscador de
  referencia **sí** es literal por pulsación — CR-6 exacto.)
- **C3 · T1.3 sobredimensionado.** Partir la persistencia en claves IDB separadas arriesga
  **atomicidad entre claves, migración de esquema y round-trip export/import** (`persist.ts:32-37`,
  `registry.ts:225-252`, `transfer.ts:28`, `bc3.ts:16` espera `recursos` en memoria). Dividir en:
  - **T1.3a (Tier 1, esfuerzo S, riesgo nulo):** subir el debounce (600 ms → ~1,5–2 s con `flush`
    robusto en `beforeunload`/`visibilitychange`), mover el clone+write a `requestIdleCallback`, y
    **dirty-gate del banco** (Immer conserva la referencia de `recursos` si solo cambia una medición
    → no reescribir el banco en el 95% de las ediciones). Da el ~80% del alivio.
  - **T1.3b (opcional, M/L, solo si T1.3a se queda corto medido):** partición de clave, **con**
    transacción multi-clave atómica (`setMany`) o manifiesto `bankRev` de validación.

### Tareas nuevas (completeness — faltaban)
- **T0.2 · Telemetría de rendimiento permanente** (esfuerzo S): hoy hay **cero**
  `performance.mark`/`measure`. Instrumentar las 4 acciones calientes (editar-celda, abrir-referencia,
  pegar, importar) y volcarlas a un panel oculto (`#debug`). Sin esto no hay detección de regresión.
- **T0.3 · Tests de regresión de render** (esfuerzo S/M): `<Profiler>` + contador de commits.
  Aserto: "editar 1 celda ⇒ 1 render de esa fila, 0 de las hermanas". **Es lo único que verifica
  que T1.1/T1.2 funcionan** y que no regresan.
- **T2.0 · Spike del modelo de datos** (CR-0): medir nº de recursos del banco de una obra propia
  mediana vs. una base CYPE importada; si la diferencia es ~100×, confirma CR-0 y reordena Tier 2/4.
- **T5.1 · Límite de producto** (esfuerzo S): si una fuente de referencia supera N recursos, el panel
  entra en "modo solo-búsqueda" (no renderiza el árbol completo) — más barato y robusto que virtualizar.

### Correcciones a T2.1 (virtualización) — adoptadas
- **Empezar SOLO por `ReferenciaPanel`** (lista plana, sin print, sin grid-nav). Las tablas de
  presupuesto/cert **no** son listas planas: tienen grupos por subcapítulo, filas expandibles de
  altura variable, navegación por teclado (`useGridNav.ts:21` hace `querySelectorAll` del DOM
  montado → **se rompe** con virtualización) y reveal-scroll por id (`PresupuestoView.tsx:90`).
- Para esas tablas: **aplanar a un modelo de filas tipado** (`{kind:'subheader'|'row'|'detail'|'addrow'}`)
  + `scrollToIndex` + roving focus por índice de datos, **diseñado de antemano**. No virtualizar el
  `<table>` con `<thead>` sticky + `<Fragment>` por grupo (camino frágil).
- **Print NO es bloqueante** (árbol independiente, `PrintPresupuesto.tsx`) — pasa de "riesgo" a
  "ventaja". **T2.1 es CONDICIONAL a telemetría** y puede volverse innecesaria si CR-0 reduce el banco vivo.

### Secuenciación revisada (consenso)
`T0.1`+`T0.2`(telemetría)+`T0.3`(tests render) → `T1.2`(suscripción fina, vía contexto)+`T1.1`(memo+callbacks+split %bar) →
`T1.3a`(debounce+idle+dirty-gate) → `T2.2`(buscador referencia, reusa `core/buscar.ts`) →
**`T2.0`(spike modelo de datos) → decisión CR-0** → `T3.1`+`T3.2`(code-splitting) → `T4.1`(índice inverso `editRecurso`) →
*(`T2.1` virtualización y `T1.3b` partición-IDB: solo si la telemetría lo justifica tras lo anterior)*.

### Riesgos de regret señalados (3/3)
1. Virtualizar `<table>` con thead sticky + grupos + grid-nav + 2 caminos de render (pantalla/print) = herida abierta. Agotar CR-0 y T5.1 antes.
2. Partir la persistencia (T1.3b) y duplicar carga/guardado/migración/recuperación para un banco que quizá debió ser pequeño (CR-0).
3. Optimizar el modelo actual en vez de cambiarlo: invertir Tier 2+4 enteros para que una base de 50k líneas en el estado vivo "vaya tolerable", cuando nunca debió estar viva.

### Decision Audit Trail
| # | Fase | Decisión | Clasificación | Principio | Resuelto |
|---|---|---|---|---|---|
| D1 | CEO | El esfuerzo de rendimiento merece la pena | Premisa | — | CONFIRMADO por el usuario |
| D2 | Eng | T1.2 antes/junto a T1.1 + callbacks estables + split %bar | Mecánica (consenso 3/3) | P5 explícito | Adoptado |
| D3 | Eng | T1.3 → T1.3a (debounce+idle+dirty-gate) ya; T1.3b opcional con atomicidad | Mecánica (consenso 3/3) | P3 pragmático | Adoptado |
| D4 | Eng | Medir commit, no keypress; narrativa "por edición confirmada" | Mecánica | P5 explícito | Adoptado |
| D5 | Eng | +T0.2 telemetría +T0.3 tests de render | Completeness | P1 | Adoptado |
| D6 | Eng | T2.1 → solo Referencia primero; tablas = flatten+roving; condicional a telemetría | Taste (eng) | P5/P1 | Adoptado |
| D7 | CEO | +T5.1 límite de producto (modo solo-búsqueda) | Completeness | P1 | Adoptado |
| **D8** | **CEO** | **CR-0: base de referencia como fuente externa; banco vivo = recursos usados** | **USER CHALLENGE** | — | **APROBADO** |

### Estado: APROBADO (2026-06-14)
**D8 resuelto:** el fundador confirma que **solo usa las bases grandes como referencia** (nunca las
edita como obra entera) → el **modelo de referencia externa es seguro y queda como dirección
estratégica**.
**Camino elegido: _Tier 1 ya + spike de modelo en paralelo_.** Se implementan primero los fixes
inmediatos de bajo riesgo en este orden: `T0.3` (harness de test de render-count, para poder probar
el fix) → `T1.2` (suscripción fina: la fila deja de leer el banco completo, vía contexto estable) →
`T1.1` (React.memo en filas + callbacks estables + separar la barra de % del cuerpo de la fila) →
`T1.3a` (autosave en `requestIdleCallback` + subir debounce + dirty-gate del banco + flush robusto) →
`T0.2` (telemetría `performance.mark`). En paralelo, `T2.0` (spike) cuantifica el tamaño del banco
vivo vs. base importada **antes** de comprometer `T2.1` (virtualización) o `T1.3b` (partición de claves).

---

## IMPLEMENTACIÓN (2026-06-14)

### Spike T2.0 — CR-0 confirmado con números
Medido parseando `.bc3` reales (`bc3ToObra`):

| Fichero | Tipo | partidas | recursos (banco) | parse |
|---|---|---|---|---|
| obra ejemplo | **obra de trabajo real** | 167 | **447** | 29 ms |
| BCCA2023_V02 | base de precios (Andalucía) | 11.798 | 4.826 | 203 ms |
| centro2017_clasica | base de precios | 62.922 | 23.905 | 1.283 ms |
| base precios | base de precios | 70.782 | **26.504** | 1.172 ms |

**Una base de referencia tiene ~10–60× los recursos de una obra de trabajo** (447 vs 4.826–26.504).
Confirma CR-0: si una base entra como estado vivo (`ObraData` en el grafo Immer + blob de autosave),
cada edición clona/serializa decenas de miles de recursos en vez de los ~447 reales. Como el fundador
**solo usa las bases como referencia**, el banco vivo debe quedarse en ese orden → la base de referencia
como **fuente externa** (Tier 2 de modelo de datos) elimina el techo, no lo parchea.

### Tier 1 — HECHO y verificado (577 tests verdes, tsc limpio)
- **T0.3** — `src/features/presupuesto/PartidaRow.render.test.tsx`: guardia de regresión que prueba que
  editar 1 partida recalcula **solo su fila** (espía sobre `descompUnit`). Antes ~N, ahora 1.
- **T1.2** — `usePartidaRow(p)` deja de depender del total del capítulo y devuelve `PartidaEconomics`
  (sin `pct`). `coefK`/`recursos` son estables con Immer → editar una medición no dispara el hook en las
  filas hermanas. (`src/hooks/usePartidaRow.ts`)
- **T1.1** — `React.memo` en `PartidaRow` y `PartidaCard` (por `p`/`chapterId`); el peso % se extrae a
  `WeightBar`, que lee el denominador de `WeightContext` (provisto por `PartidasTable`). El contexto
  atraviesa el memo → al cambiar el total solo se re-renderizan las barras (baratas), no las filas.
  (`WeightBar.tsx`, `PartidaRow.tsx`, `PartidaCard.tsx`, `PartidasTable.tsx`, `PartidasCards.tsx`, `Partidas.tsx`)
- **T1.3a** — autosave: debounce 600 ms → **1.500 ms**, clone+write diferido a `requestIdleCallback`
  (fallback `setTimeout`), `flushPending` cancela lo programado y persiste si hay `dirty`. El flush en
  `pagehide`/`visibilitychange` ya cubría el cierre. (`src/persist/sync.ts`)

### Tier 2 ligero + Tier 3 — HECHO y verificado (577 tests, build OK)
- **T2.2** — buscador del panel de referencia con `useDeferredValue` + haystack precomputado por
  fuente + tope 100 con aviso. Ya no re-filtra la base en cada tecla. (`ReferenciaPanel.tsx`)
- **T3** — code-splitting: `ImportarView`/`ReferenciaImportModal`/`Sandbox`/`PrintDoc` con `React.lazy`
  + `Suspense`. El parser FIEBDC sale del bundle de entrada (verificado en build: el entry ya no
  contiene `windows-1252`; el parser vive en un chunk lazy de 43 kB que carga solo al abrir Importar).
  (`App.tsx`)

### Pendiente
- **T0.2** — telemetría `performance.mark/measure` en las 4 acciones calientes + panel `#debug`.
- **Tier 2 (modelo de datos)** — la base de referencia como **fuente externa** (CR-0): el mayor salto
  estructural que queda; el spike ya lo justifica (banco de obra ~447 vs base ~26.504 recursos).
- **Tier 4** — índice inverso de `editRecurso` (T4.1). **T2.1** — virtualización **condicional** (solo
  si la telemetría la justifica tras lo anterior).
