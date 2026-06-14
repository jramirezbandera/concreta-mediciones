# Plan: Panel de referencia ligero con bases enormes (CR-0, alcance A)

> Rama: main · Origen: PERFORMANCE_AUDIT.md (CR-0). Revisado con /plan-eng-review.
> Alcance elegido (Step 0): **A — subconjunto pragmático, SIN cambio de esquema ni migración.**

## Objetivo
Que abrir, navegar y mantener en memoria una base de referencia de 70k partidas en el panel
no congele ni acumule RAM. NO toca la edición de la obra de trabajo (Tier 1 ya la arregló) ni
el modelo de datos en disco.

## Qué ya existe (aprovechar, no reconstruir)
- `RefSource` ([core/refdata.ts](src/core/refdata.ts)) unifica bases y obras-referencia.
- `hydrateItem(it, recursos)` (refdata.ts:357) — punto único de hidratación de un item. Se reusa.
- T2.2: `useDeferredValue` + `haystack` precomputado por fuente + tope `REF_SEARCH_CAP=100` + aviso.
- `obraCache` (ReferenciaPanel) — caché de fuentes, hoy SIN límite.
- Copia selectiva: `applyCopy`/`detectCollisions` solo integran recursos usados → banco vivo pequeño.

## Diseño

```
ACTUAL (abrir base 70k):
  loadObraData ─get(blob ENTERO)─> fromSerializable ─> obraToRefSource ─HIDRATA 70k×items─> RefSource (sin recursos, items inline)
                     [1] FLOOR            [2] trivial        [3] caro (~200k hydrateItem)           render SIN tope [4]

LAZY (alcance A):
  loadObraData ─get(blob ENTERO)─> fromSerializable ─> obraToRefSource(LIGERO) ─> RefSource { chapters, partidas(code/title/ud/precio + items CRUDOS {code,type,cant}), recursos }
                     [1] FLOOR (sin tocar)                  [3'] O(n) barato (sin hidratar items)
  Al DESPLEGAR fila  → hydrateRefItems(p, source.recursos)  (descomposición)
  Al COPIAR          → hydrateRefItems(p, source.recursos)  (fuerza hidratación; no depende de desplegar)
  Render             → tope ~200 + "mostrar más" (patrón T2.2)
  obraCache          → LRU(2): actual + anterior
```

### Cambios
1. **`obraToRefSource` perezoso** (refdata.ts): NO llama `hydrateItem` por item; deja items crudos
   `{code,type,cantidad}` y **retiene `recursos`** en el `RefSource`. Campos baratos (code/title/ud/precio)
   se mantienen (los necesita la búsqueda T2.2 y la fila).
2. **`hydrateRefItems(p, recursos)`** (reusa `hydrateItem`): hidrata la descomposición de UNA partida bajo
   demanda. Se llama al desplegar la fila y en `copyItem` (antes de construir el `RefCopyItem`).
3. **Tope de render** en ReferenciaPanel: por capítulo abierto, renderiza las primeras `REF_BROWSE_CAP`
   (~200) partidas + botón "mostrar más" (sube el tope). Reusa el patrón/aviso de T2.2.
4. **LRU(2) en `obraCache`**: `Map` plano; al insertar una 3ª fuente, evicta la menos reciente.
5. **Instrumentación** (`performance.mark`/`measure`) en la ruta de apertura → mide [1] vs [3'] real
   (alimenta T0.2; revela si el floor [1] llega a justificar scope B).

## NO en alcance (diferido, con motivo)
- **Scope B (modelo de datos / sub-claves por capítulo)** — eliminaría el floor [1] (lectura del blob
  entero), pero exige tipo nuevo + esquema + **migración irreversible**. Diferido: el floor solo se ataca
  si la instrumentación (cambio 5) demuestra que [1] solo es demasiado lento.
- **`@tanstack/react-virtual`** — descartado a favor del tope (cambio 3): sin dep nueva, diff mínimo.
- **Cerrar la ruta base→`loadObra`** (vista Importar) — fuera de este panel; el flujo del usuario es solo-referencia.

## Plan de tests (cobertura objetivo 100% de la lógica nueva)
- `refdata.test.ts`: `obraToRefSource` devuelve items crudos + `recursos` retenido; `hydrateRefItems`
  rellena desc/ud/precio del banco; item normal y `%CI`; code ausente en banco → fallback.
- **CRÍTICO (regresión):** copiar una partida y un capítulo **nunca desplegados** conserva la
  descomposición completa (la copia fuerza `hydrateRefItems`). Sin esto, deferir rompe la copia.
- `Referencia.test.tsx`: tope muestra ≤200 + "mostrar más" revela el resto; LRU evicta más allá de 2;
  los 11 tests existentes (búsqueda, copia, contradictorio, multiselección, drag, cambio de fuente) verdes.

## Modos de fallo (por codepath nuevo)
| Codepath | Fallo realista | ¿Test? | ¿Manejo? | ¿Visible? |
|---|---|---|---|---|
| copia sin desplegar | items vacíos → partida copiada sin descomposición | **CRÍTICO añadido** | hidratar en copyItem | sería SILENCIOSO → gap si no se testea |
| hydrateRefItems | code ausente en `recursos` | sí (fallback) | fallback a item crudo | no |
| LRU(2) | evictar la fuente activa por error | sí | nunca evictar la activa | re-carga (lento), no incorrecto |
| tope | "mostrar más" no sube el tope | sí | estado por capítulo | el usuario no ve todas |
| apertura | blob enorme bloquea | mark (medición) | estado "Cargando…" ya existe | spinner |

## Secuencia (revisada por la voz externa — decisión 2A)

Codex demolió la prioridad original: no está probado qué domina al abrir (lectura del blob [1],
construcción del `haystack` de T2.2, adaptador [3'], render [4]) y hay un cambio de ~1 línea que
puede quitar el grueso del freeze. Orden nuevo: **barato + medir primero; lo caro solo si los
números lo piden.**

### Fase 1 — Barato + medición (HACER YA)
- [ ] **T1 (P1, humano ~30min / CC ~10min) — no auto-abrir el primer capítulo.** `ReferenciaPanel.tsx:~314`
  arranca colapsado (`setExpanded({})`). Abrir una base muestra solo la lista de capítulos (barato); el
  usuario despliega lo que quiere. Con la búsqueda ya capada (T2.2), esto elimina montar el capítulo
  entero al abrir, SIN tocar la semántica de copia.
- [ ] **T2 (P1, humano ~1h / CC ~15min) — instrumentar la apertura.** `performance.mark/measure` separando
  blob-read [1] / `fromSerializable` [2] / `obraToRefSource` [3'] / haystack / primer render. A consola o `#debug`.
- [ ] **T3 (P0, humano ~15min / CC ~5min) — MEDIR** abrir/navegar una base BCCA/CYPE real con T1+T2.

### Fase 2 — Hidratación perezosa + LRU + tope (CONDICIONAL: solo si la medición señala [3'] como dominante)
Incorpora las correcciones de Codex:
- [ ] Hidratación perezosa de items (defer `hydrateItem`); `RefSource.recursos` **opcional** (no romper
  fixtures `refdata.ts:59` ni tests `refdata.test.ts:43`/`obraSource.test.ts:33` que asumen hidratación eager).
- [ ] `RefPartidaRow` recibe el banco por prop/callback para hidratar al desplegar (`:161,:209`) — no pinta
  vacío ni muta filas cacheadas.
- [ ] **Capar también las acciones de CAPÍTULO**: `dragStartChapter`/"Copiar capítulo entero" (`:415,:525`)
  hidratan + escanean colisiones de TODO el capítulo por un clic; el tope de render NO las acota → hidratar
  por lote / avisar en capítulos enormes.
- [ ] Hidratar en **todos** los caminos de copia (una, selección, drag, capítulo) vía el único funnel
  `copyItem`→`hydrateRefItems` (porque `detectCollisions:475`/`applyCopy obraStore.ts:235,245` comparan/escriben `ud/precio`).
- [ ] LRU(2) en `obraCache` — OJO (Codex): retiene DOS bancos enteros; medir si compensa.
- [ ] Tope "mostrar más" (1A) en el render del capítulo.
- [ ] Tests: regresión CRÍTICA "copiar sin desplegar"; tope; LRU; los 11 de `Referencia.test` verdes.

### Resultado de la medición (2A) — Fase 2 DESCARTADA
Spike sobre bases reales (`structuredClone` como proxy de la lectura `idb-keyval`):

| Base | partidas | [1] blob read (clone) | [3'] obraToRefSource | haystack |
|---|---|---|---|---|
| BCCA2023 | 11.798 | 85 ms | 14 ms | 4 ms |
| base precios | 70.782 | **636 ms** | **36 ms** | 40 ms |

**El blob read [1] domina ~18×.** La Fase 2 (hidratación perezosa) ataca [3']=36 ms → **no compensa**.
Codex tenía razón. **Fase 2 descartada.** Lo que resuelve el dolor lo dio la **Fase 1 (implementada):**
no auto-abrir capítulos enormes (quita el freeze de montar miles de filas) + diferir el haystack a la
búsqueda. Abrir una base de 70k queda en ~636 ms de lectura **detrás del spinner "Cargando…" que ya
existe** + árbol colapsado instantáneo.

**El floor [1] (636 ms) solo lo quita scope B** (sub-claves por capítulo + migración). Es una lectura
ÚNICA tras un spinner → se acepta por ahora; scope B queda diferido salvo que el spinner moleste.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 6 hallazgos (3 high): copiar-capítulo no capado, hidratar-todos-los-caminos, mide-tarde; +cambio de 1 línea (no auto-abrir) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 2 decisiones (1A tope vs virtualización; 2A secuencia); 1 regresión crítica (copiar sin desplegar) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX:** 6 hallazgos verificados contra el código; volcó la secuencia a "medir primero + el cambio de 1 línea no-auto-abrir" antes de construir la hidratación perezosa.
- **CROSS-MODEL:** Eng review recomendó construir-primero; Codex recomendó medir-primero + cambio barato. El usuario eligió Codex (2A). Las correcciones de Codex (capar copiar-capítulo, hidratar en todos los caminos, `recursos` opcional, plumbing de la fila) quedan plegadas en la Fase 2.
- **VERDICT:** ENG CLEARED — alcance reducido a 2A (barato + medir primero). Listo para implementar la Fase 1.

NO UNRESOLVED DECISIONS
