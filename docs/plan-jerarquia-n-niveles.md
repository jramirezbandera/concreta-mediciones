# Plan — Jerarquía de N niveles (Fase 1: camino de lectura)

> **Fase 2 (edición a profundidad, T-17) también IMPLEMENTADA** (2026-06-12,
> misma rama): `addSubchapter` bajo cualquier contenedor, `deleteSubchapter`
> a cualquier profundidad con política de PROMOVER (ramas al final de los
> hermanos con códigos libres, partidas al padre; nunca cascada destructiva),
> y `moveSubtree` (rama + partidas entre buckets, recodificada bajo el nuevo
> padre, ids estables). UI: menú ⋮ en el árbol del sidebar, alta de partida a
> cualquier nivel y destinos profundos en "Mover a". Detalle en TODOS.md T-17.

Estado: **IMPLEMENTADA** (2026-06-12, rama `feat/jerarquia-n-niveles`). T1-T10
completas; 422 tests en verde (+23 nuevos: árbol, round-trips N-nivel sintético
y BCCA real, migración v1→v2 por hydrate e import .json, endurecimiento del
store); verificada en navegador real (BCCA: sidebar y tabla con Arenas/Gravas
anidados, IVA 21 del ~K, 352 filas de árbol fluidas). Desviación deliberada del
plan: los contenedores VACÍOS ahora SÍ viajan en el export BC3 — la regla
antigua protegía al import por-mediciones (hoy detecta por «#») y descartarlos
re-perdía 1.177 de los 2.900 grupos del BCCA en el round-trip, justo lo que A1
prohíbe. Pendiente del plan: gate manual en Presto/Arquímedes (T-14).
Revisado con /plan-eng-review (2026-06-12); decisiones de scope y arquitectura
tomadas con el usuario. Fase 2 (edición a profundidad) diferida → TODOS.md T-17.

## Problema

El modelo soporta exactamente 2 niveles: `Chapter` con `children?: SubChapter[]`, y
`Partida.sub` referencia el id de un subcapítulo. Un .bc3 con más profundidad (el BCCA
real: ÁRIDOS Y PIEDRAS → Arenas/Gravas/… → precios) se **aplana**: los niveles
intermedios se pierden y sus partidas se funden en el primer subcapítulo. Queremos
jerarquía de N niveles arbitrarios.

## Decisión de scope: FASEADO

- **Fase 1 (este plan):** modelo recursivo + el importador deja de aplanar + todo el
  **camino de lectura** (render, numeración, totales, export xlsx/docx/bc3, print,
  migración de persistencia) entiende N niveles. Entrega ya el import del BCCA con su
  jerarquía completa, visible y exportable.
- **Fase 2 (diferida, TODOS.md):** acciones de **edición** a profundidad (crear
  sub-subcapítulo a cualquier nivel, mover un subárbol entre capítulos, borrar
  promoviendo hijos) y sus afordances de UI.

## Arquitectura (Opción C: subcapítulo recursivo, híbrido conservado)

```
ObraData
├─ chapters: Chapter[]              Chapter { id, code, title, children?: Node[] }
│                                   Node    { id, code, title, children?: Node[] }  ← RECURSIVO
└─ partidas: { [chId]: Partida[] }  Partida { id, sub?: nodeId, pos }
   (el capítulo SIGUE siendo la clave de PartidasMap; las partidas siguen planas por
    capítulo, etiquetadas por su contenedor INMEDIATO en `sub`)
```

Razón: mantiene el patrón actual (estructura = árbol de contenedores / contenido =
partidas etiquetadas), no introduce un híbrido nuevo. Una obra v1 (2 niveles) es un
caso degenerado válido del modelo recursivo → migración casi un no-op.

Alternativa descartada: árbol único recursivo donde las partidas son hojas del árbol.
Más "limpio" en abstracto pero reescribe el modelo de hoja, certificación, persistencia
y todas las vistas; más riesgo, gasta un innovation token sin mejorar el resultado de
usuario.

### Decisiones tomadas en la revisión

- **A1 — Export BC3 recursivo con round-trip testeado.** La emisión `~C`/`~D`/`~M`
  pasa a ser recorrido recursivo del árbol; el ancla del `~M` pasa de índice
  (`${ci+1}\${entry}\${pi+1}\`) a **ruta de posiciones** (`1\2\3\…`). Tests de
  round-trip: importar BCCA → exportar → reimportar → comparar jerarquía y PEM. Evita
  que el round-trip re-aplane en silencio justo el caso que motiva el proyecto.
- **A2 — SCHEMA_VERSION 1→2 con migración real en cadena.** No basta tocar
  `fromSerializable`: hay **código de cadena de versión** (v1→v2, hoy identidad de
  forma) probado por DOS rutas — el hydrate del store Y el import JSON de backup
  (`persist/transfer.ts`, que valida con `isObraData`). `isObraData` (en
  **`persist/persist.ts:38`**, no en el store) acepta `children` recursivo. Las obras v1
  en IndexedDB se cargan sin romper.
- **C1 (afinado por outside voice) — Helper de estructura ACOTADO a view-model
  `core/tree.ts`.** `buildChapterTree(chapter, partidas, coefK)` devuelve SOLO la
  estructura (node/pos/partidas-directas/children/total). Lo consumen grouping,
  numbering, totales, listado y las vistas. **bc3export usa el MISMO árbol solo para el
  ORDEN de recorrido y conserva ARRIBA su lógica de emisión FIEBDC** (dedupe de códigos,
  orden `~D`, política de contenedor vacío, anclas `~M`, orden de primer uso de
  recursos) — un nodo de árbol no expresa eso. Acotar el helper evita la god-abstraction
  "mitad-exporter mitad-view-model" que avisó Codex, sin perder el DRY de la estructura.
  Junto al árbol van utilidades sueltas: `findNode`, `findChapterIdForContainer`,
  `flattenContainers`, `partidasByContainer`.
- **Tensión 2 — Fase 1 es read-only DE VERDAD.** Renderizar nodos profundos expone los
  flujos de edición de 2 niveles (`addPartida:780`, `deleteSubchapter:767`,
  `movePartida:814`, `PartidaMenu`), que podrían dejar un `Partida.sub` huérfano. En
  Fase 1 se **desactivan/ocultan las afordances de añadir/mover/borrar bajo el nivel 2**
  y se endurecen `addPartida`/`movePartida` para **rechazar (no corromper)** un subId
  que no exista en el capítulo destino. La edición profunda llega en Fase 2 (T-17).
- **Tensión 3 — Contenedor reutilizado: clonar subárbol con ids nuevos.** BC3 es un
  grafo: un contenedor puede colgar de varios padres. Hoy el importador lo salta como
  ciclo (`bc3import.ts:261`). Fase 1: **clonar** la rama con ids propios por ruta
  (`b3-…`), recursos compartidos por código. Hay que **distinguir reúso legítimo de
  ciclo real** (A→B→A) y seguir cortando SOLO el ciclo. Además emite un warning en el
  report para medir cuánto ocurre en bancos reales antes de fijar la política.
- **`active` (selección) necesita resolución por índice.** Hoy `copyTargetOf:106`,
  `PresupuestoView:61` y `Sidebar:175` resuelven el id activo mirando solo hijos
  directos. Un id profundo no resuelve a su capítulo sin `findNode`/
  `findChapterIdForContainer` (las utilidades de C1). El tipo `active: string` no
  cambia; la lógica de resolución sí.
- **Perf (requisito de C1).** `buildChapterTree` **indexa las partidas por `sub` una
  sola vez** (`Map<subId, Partida[]>`, O(n)) y reparte en el recorrido. NO `filter()`
  por nodo (sería O(partidas × contenedores), cuadrático: congelaría el banco de 70.782
  partidas).

```
interface TreeNode {
  node: Container          // capítulo o subcapítulo (id/code/title)
  pos: string              // ruta de códigos: "1.2.3"
  partidas: Partida[]      // hojas directas (sub === node.id)
  children: TreeNode[]     // recursivo
  total: Cents             // Σ partidas directas + Σ totales de hijos
}
buildChapterTree(chapter: Chapter, partidas: Partida[], coefK: number): TreeNode
```

## Camino de datos (Fase 1)

```
IMPORT (bc3import.collectPartidas)        RENDER / EXPORT  (camino de lectura)
  árbol .bc3 ─► chapters: Chapter[]            ┌─ buildChapterTree(ch, partidas) ─┐
             └► partidas[chId]: Partida[]      │  índice sub→partidas (O(n)) +     │
                sub = id contenedor inmediato  │  recorrido recursivo del árbol     │
                                               └─────────────┬──────────────────────┘
                        ┌──────────────┬───────────────────┼──────────────────┐
                        ▼              ▼                    ▼                  ▼
                  Sidebar (árbol   PartidasTable      listado (xlsx/docx)   bc3export
                  recursivo)       (sub-headers        grupos recursivos    ~C/~D/~M recursivo
                                    recursivos)                              ~M por ruta posiciones
                        └─── pos = ruta con puntos "1.2.3.4" · renumber recorre el árbol ───┘
            totales: nodo.total = Σ partidas directas + Σ totales de hijos  (recursivo)
```

## Lo que NO cambia (reduce el riesgo)

- **El DATO de certificación** (`Cert.data` indexada por id de partida, snapshots) y el
  **avance por capítulo** (`certChapterRows`, que parte de `partidas[ch.id]` plano): son
  **agnósticos a la profundidad**. No se toca el dato de cert ni hay migración de certs.
  MATIZ (outside voice): el **render/edición** de cert SÍ usa `groupBySub`
  (`CertTable.tsx:305`, `CertChapterCards`) y los contradictorios cuelgan de ids de
  capítulo → en Fase 1 el render de cert se vuelve recursivo como el de presupuesto, pero
  el dato y los extras (a nivel capítulo) no cambian.
- **El keying de `PartidasMap` por capítulo.** Las partidas siguen planas por capítulo.
- **El modelo de hoja (`Partida`)**, edición in-situ de partidas, banco de recursos.

## NOT in scope (Fase 1)

- **Edición a profundidad** (crear/mover/borrar contenedores a cualquier nivel) → Fase 2,
  TODOS.md. Es el camino de escritura, el más espinoso (mover subárbol arrastra partidas
  entre buckets de PartidasMap).
- **Reordenar contenedores por drag&drop en el árbol** → Fase 2.
- **Árbol único recursivo (partidas como hojas)** → descartado, no diferido.
- **cp850 por defecto, 2 decimales de cantidad, T-1 multi-base** → sin relación con
  jerarquía, siguen en la auditoría del importador.

## What already exists (se reutiliza, no se reconstruye)

- `groupBySub`, `renumberChapter`, `chapterTotals`, `buildPresupuestoListado`: las 4
  funciones puras donde vive la recursión; se generalizan vía `buildChapterTree`.
- `listado.ts` como cuello único de xlsx/docx: hacer recursivo `GrupoListado` propaga a
  ambos export sin tocarlos directamente.
- `active` (string id) ya casa con capítulo o subcapítulo: sirve a N niveles sin cambio
  de tipo.
- El guard de ciclos y el patrón estructura/contenido del importador.

## Failure modes (camino de lectura)

| Codepath nuevo | Fallo realista | Test | Manejo | Visible |
|---|---|---|---|---|
| buildChapterTree | ciclo o `sub` a contenedor inexistente | sí (borde) | cuelga huérfanas en el capítulo | — |
| bc3export recursivo | `~M` mal anclado a nivel profundo → Presto abre mal | round-trip | ruta de posiciones | round-trip lo detecta |
| migración v1→v2 | obra v1 en IndexedDB no carga | regresión | migración identidad | error de carga si falla |
| numbering recursivo | `pos` se desincroniza en 3+ niveles | sí | renumber recorre árbol | pos visible en UI |
| perf (filter/nodo) | banco 70k congela import | smoke 29MB | índice O(n) | — |

Crítico: ninguno queda sin test **y** sin manejo **y** silencioso.

## Tareas de implementación

- [ ] **T1 (P1)** — core/tree.ts — `buildChapterTree` (view-model acotado) con índice O(n) (`partidasByContainer`) + total por nodo + ruta de códigos; utilidades `findNode`, `findChapterIdForContainer`, `flattenContainers`. Verify: tests de árbol (2 niveles degenerado, 3+ niveles, nodo vacío, ciclo, sub inexistente, contenedor reutilizado clonado).
- [ ] **T2 (P1)** — core/types.ts — `SubChapter`/`Node` recursivo (`children?`); `Partida.sub` documentado como id de contenedor inmediato.
- [ ] **T3 (P1)** — core/bc3import.ts — `collectPartidas` deja de aplanar: crea contenedor por nivel; **clona** contenedores reutilizados con ids por ruta y **distingue reúso de ciclo real** (sigue cortando A→B→A) + warning de reúso. Regresión: obra 2-niveles idéntica; reescribir test BCCA (ya no aplana).
- [ ] **T4 (P1)** — core/numbering.ts, grouping.ts, totales.ts — consumir `buildChapterTree`; `pos` = ruta de puntos. Regresión: 2 niveles **semánticamente** idéntico (mismos pos/totales, no byte).
- [ ] **T5 (P1)** — core/listado.ts — `GrupoListado` recursivo → xlsx/docx anidados (aserciones semánticas, no byte: son zips).
- [ ] **T6 (P1)** — core/bc3export.ts — emisión recursiva + `~M` por ruta de posiciones; el árbol da el ORDEN, la lógica FIEBDC (dedupe/~D/~M/recursos) se mantiene. Tests de round-trip (BCCA jerarquía + PEM) + **gate manual**: abrir el .bc3 exportado en Presto/Arquímedes (el self-round-trip no basta). Regresión: export 2-niveles semánticamente idéntico.
- [ ] **T7 (P1)** — **src/persist/* + store** — SCHEMA_VERSION 2 + migración real en cadena 1→2; `isObraData` (persist.ts:38) acepta `children` recursivo. Regresión: cargar obra v1 por hydrate Y por import JSON (transfer.ts:72).
- [ ] **T8 (P1)** — store + features/presupuesto — **desactivar/ocultar afordances de edición bajo nivel 2** (PartidaMenu, add/move/delete); endurecer `addPartida`/`movePartida` para rechazar subId inexistente (no crear `sub` huérfano). Test: intento de mover a destino profundo/ inexistente = no-op + aviso.
- [ ] **T9 (P2)** — features/presupuesto, layout/Sidebar, features/certificaciones — render recursivo (read-only): sub-headers y árbol del sidebar a cualquier profundidad; `active` resuelto vía `findNode`.
- [ ] **T10 (P2)** — features/print — sangría por nivel en presupuesto y certificación.

## Paralelización (worktrees)

| Lane | Pasos | Módulos | Depende |
|---|---|---|---|
| A (núcleo) | T1→T2→T3→T4→T5 | core/ | secuencial (comparten core/) |
| B (export) | T6 | core/bc3export | T1 (helper) |
| C (persist) | T7 | store/, persist/ | T2 (tipo) |
| D (UI) | T8→T9 | features/, layout/ | T1, T4 (helper+pos) |

Orden: A primero (define el helper y el tipo). Luego B, C, D en paralelo sobre A
mergeado. B y D ambos leen el árbol pero no comparten archivos → sin conflicto.
