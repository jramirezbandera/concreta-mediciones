# Plan · Buscar partidas dentro de la obra actual (presupuesto)

> Estado: REVISADO + **IMPLEMENTADO** (autoplan, 2026-06-14 · voces: Codex +
> subagente eng + subagente design). Análogo del buscador del panel Referencia,
> pero aplicado al PRESUPUESTO propio: escribir un nombre/código, ver las partidas
> que casan con su ubicación (capítulo › subcapítulo), y al pulsar una, NAVEGAR
> hasta ella — marcar el subcapítulo en el sidebar y abrir la partida lista para
> editar. Decisión de UX confirmada por el usuario: AISLAR el subcapítulo al saltar.
>
> Implementado en: `core/buscar.ts` (+test), `core/tree.ts` (`ancestorIds`, +test),
> `store/obraStore.ts` (`revealPartida`/`revealNonce`, +test),
> `features/presupuesto/BuscarPartidas.tsx` (+CSS, +test),
> `hooks/useJustRevealed.ts`, `layout/Sidebar.tsx`, `PresupuestoView.tsx`,
> `ChapterHeader.tsx`, `PartidaRow.tsx`, `PartidaCard.tsx`, `Presupuesto.module.css`,
> `test/setup.ts` (stub scrollIntoView). tsc + 549 tests + eslint + build en verde.

## Premisa

Para editar una partida concreta de una obra grande hay que recordar en qué
capítulo/subcapítulo está, navegar el árbol a mano y desplegarla. En bancos reales
(BCCA: miles de partidas por capítulo, según el comentario de `core/tree.ts`) eso
es lento. El panel Referencia ya tiene buscador (`ReferenciaPanel.tsx`, estado `q`
+ `matchP`) pero filtra una fuente EXTERNA en sitio; el presupuesto propio no tiene
ninguna forma de buscar.

**Problema a resolver:** localizar y saltar a una partida del presupuesto propio
por nombre o código, sin recorrer el árbol a mano.

## Decisión de UX confirmada (gate)

**Buscador-saltador (jump-to), NO filtro en sitio.** El de Referencia filtra el
árbol del panel; éste vive junto a la navegación (sidebar) y, al elegir un
resultado, NAVEGA la vista principal a esa partida. No filtra la tabla del
presupuesto (rompería el contexto de capítulo/subtotales).

**Aislar el subcapítulo al saltar** (`active = p.sub`): es lo que pide literalmente
el usuario («marca el subcapítulo donde está»). El sidebar marca el sub y la vista
aísla su subárbol (modo `focused` de `PresupuestoView`) → contexto de edición
limpio. **Riesgo conocido (voces):** es un cambio de contexto grande y silencioso.
Se mitiga haciéndolo LEGIBLE (ver §6) y con fallback a capítulo si el sub es
huérfano (ver §2).

## Modelo de datos y navegación (estado real del repo)

- Partidas: `partidas: PartidasMap = Record<chapterId, Partida[]>` en `obraStore`.
  `Partida` tiene `id`, `code`, `title`, `pos`, `sub?` (id del contenedor inmediato;
  `undefined` = directa del capítulo).
- Árbol: `chapters: Chapter[]`; `flattenContainers(ch)` / `findNode(chapters, id)`
  en `core/tree.ts` resuelven código/título de un contenedor.
- Navegación (store): `active` (id de contenedor o `ALL`); `setActive(id)` **resetea
  `openPartidaId = null`**; `setView('presupuesto')` **también resetea
  `openPartidaId`**; `expanded: Record<id,bool>` + `toggleExpanded`; `openPartidaId:
  string|null` + `togglePartida` (single-open; la fila abierta despliega `DetailPanel`).
- **No existe** hoy "scroll a la partida" ni "abrir determinista" (solo `togglePartida`).
- `PresupuestoView` enruta por `active`; si `active` es un SUB **válido**, AÍSLA su
  subárbol (`focused`). Si `active` es un id desconocido (sub huérfano), `findNode`
  falla → cae a `chapters[0]` (¡capítulo equivocado!). De ahí el fallback de §2.

## Diseño

### 1. Índice de búsqueda — `src/core/buscar.ts` (nuevo)
Función pura, sin React, testeable. Aplana todas las partidas con su ubicación
resuelta UNA vez (O(n+m), nunca `findNode` por partida → evita O(n²) en 70k):

```ts
export interface HitPartida {
  p: Partida;
  chapterId: string; chCode: string; chTitle: string;
  subId: string | null;                       // contenedor inmediato (null = directa)
  path: { code: string; title: string }[];    // cadena capítulo→…→sub (miga completa)
  haystack: string;                            // `${pos} ${code} ${title}`.toLowerCase()
}
export interface SearchResult { hits: HitPartida[]; truncated: boolean; }

export function buildSearchIndex(chapters: Chapter[], partidas: PartidasMap): HitPartida[]
export function searchPartidas(index: HitPartida[], query: string, cap = 50): SearchResult
```

- Construir `Map<subId, {parentId, code, title}>` con `flattenContainers` sobre todos
  los capítulos (estructural, barato) → resolver `path` subiendo por `parentId`.
  `Map<chId,{code,title}>` para la raíz. Mapear cada partida mirando `p.sub`.
- Null-safe: `buildSearchIndex([], {})` → `[]`.
- `searchPartidas`: `query.trim().toLowerCase()`; si `< 2` chars → `{hits:[],truncated:false}`;
  filtra por `haystack.includes(q)` y **para en `cap+1`** (`truncated = true` si se
  alcanza). El `SearchResult` cierra el desfase de API que señalaron las voces
  (antes el plan decía "marca de hay más" pero devolvía solo array).

### 2. Acción del store — `revealPartida(partidaId, chapterId, subId)` (nuevo)
Una sola `set((s)=>{…})` ATÓMICA (NO delega en `setActive`/`setView`/`togglePartida`,
que resetean/toglean `openPartidaId`). Recibe `chapterId`/`subId` del hit (O(1), sin
rescan). Hace, en este orden:
1. **Validar el sub:** `const validSub = subId && findNode(s.chapters, subId)?.chapter.id === chapterId ? subId : null;`
   (un `p.sub` huérfano/cross-capítulo → se trata como directa del capítulo).
2. `s.active = validSub ?? chapterId`.
3. Expandir la cadena de ancestros con el helper `ancestorIds` (§3): `s.expanded[chapterId]=true`
   y cada ancestro de `validSub`.
4. `s.view = 'presupuesto'`.
5. `s.openPartidaId = partidaId` (**último**, para que ningún reset previo lo borre).
6. `s.revealNonce++` **siempre** (también si se re-revela la ya abierta → re-scroll/pulse).
- No-op seguro si `chapterId` no existe.

### 3. Helper de ancestros — `ancestorIds(chapters, containerId)` en `core/tree.ts` (nuevo)
Devuelve `[chapterId, …ancestros, containerId]` (vacío si no existe). Extraído para
reusarse en `revealPartida` Y en `Sidebar.onAddSub` (hoy duplica el walk en una
closure de componente — las voces pidieron un helper puro). `onAddSub` se refactoriza
para llamarlo (DRY, sin cambio de comportamiento).

### 4. Scroll-a-la-partida (robusto)
- Ancla estable en AMBOS modos: `id={`partida-${p.id}`}` en el `<tr>` de fila de
  `PartidaRow` (la fila, NO el `<tr>` de detalle) y en la raíz de `PartidaCard`
  (modo compacto). Sin esto, en móvil/tarjetas el scroll falla.
- Efecto en `PresupuestoView` keyed por `revealNonce`: reintento ACOTADO por frames
  (hasta ~5 `requestAnimationFrame`/≈300ms) hasta que el elemento exista —
  `document.getElementById(...)?.scrollIntoView({block:'center', behavior})` con
  `behavior` = `'auto'` si `prefers-reduced-motion`. Cancela el reintento pendiente
  si `revealNonce` cambia (segundo salto) o al desmontar. Resuelve: nodo aún no
  montado tras la renavegación, swap del subárbol `focused`, flip table↔cards, y el
  cierre del drawer en móvil (que re-maqueta).

### 5. UI del buscador — `src/features/presupuesto/BuscarPartidas.tsx` (nuevo)
Caja + dropdown, montada como **primer hijo del `<aside>` del Sidebar, ARRIBA del
todo (antes de «Toda la obra»)**, en bloque propio con divisor inferior — es un
punto de entrada global, no un ítem más de navegación.
- Estado local `q`; índice memoizado SOLO cuando hay búsqueda activa
  (`useMemo` gateado por `q.trim().length >= 2`, con `useDeferredValue(q)` para no
  bloquear el tecleo); `searchPartidas` memoizado. Evita reconstruir el índice de 70k
  en cada edición ajena de `partidas`.
- **Dropdown en PORTAL** anclado bajo el input (el `.sidebar` tiene `overflow:hidden`
  y solo 286/308px → un dropdown absoluto se recorta; el portal lo evita y permite
  algo más de ancho). `max-height` + `scroll-thin`.
- Filas de resultado a **DOS líneas** (286px es estrecho): línea 1 = `code` + título
  (ellipsis); línea 2 = miga `chCode › … › subCode subTitle` (cadena completa, elide
  el medio), estilo muted. Reusa look de `.part`/`.srcOpt` de Referencia.
- Estados (modelados en el `.state`/`.hint` de Referencia): query vacía/<2 → sin
  dropdown; **«Sin coincidencias en esta obra»** (aclara el alcance vs Referencia);
  truncado → pie fijado NO-focuseable «Afina la búsqueda (50+ resultados)».
- Selección (click/Enter): `revealPartida(hit.p.id, hit.chapterId, hit.subId)`, luego
  **limpiar `q` + blur** (el salto es la finalización; un dropdown obsoleto sobre una
  vista ya navegada confunde) y `onAfterSelect?.()` (cierra el drawer en móvil —
  `onAfterSelect` se prop-drillea de `Sidebar` a `BuscarPartidas`).
- **Teclado / a11y (patrón combobox):** input `role="combobox"` con `aria-expanded`,
  `aria-controls`, `aria-activedescendant` → opción resaltada (`role="option"`,
  `aria-selected`). ↓/↑ mueven (primer ↓ = índice 0) y auto-scrollean la opción a la
  vista; Enter selecciona; **Esc en dos fases** (1ª cierra dropdown conservando texto,
  2ª limpia). `aria-label` en el input.

### 6. Legibilidad del salto (que el aislamiento NO desoriente)
- **Pulso transitorio «aquí está»**: clase `.justRevealed` sobre la fila/tarjeta
  revelada, disparada por `revealNonce`, retirada a ~1,2s (timeout), gated en
  `prefers-reduced-motion`. Distingue «el buscador me trajo aquí» del `.selected` de
  un click normal. Es el remate que convierte «scrolleó a algún sitio» en «ahí está».
- **Ruta completa en cabecera**: al aislar un sub, `ChapterHeader` debe mostrar la
  miga `capítulo › … › sub` (no solo el título del sub), para que se entienda que la
  vista se ha estrechado y haya una vía obvia de volver (clic en el capítulo del
  sidebar). Pequeño ajuste de `ChapterHeader`.

### 7. Estilos — `Sidebar.module.css` (+ levantar clases de Referencia)
Levantar literal `.search/.searchInput/.searchClear` y el look de fila `.srcOpt`
de `Referencia.module.css` (mismas alturas/colores/tokens) — no re-derivar píxeles
(dos buscadores a un clic de distancia deben verse idénticos). Fila resaltada por
teclado = `--accent-soft` (como `.srcOpt.on`). Sin librerías nuevas (el portal usa
`createPortal` de react-dom).

## Qué YA existe (reuso, DRY)
- Patrón de buscador (`q`/clear) y estilos de `Referencia.module.css`.
- `flattenContainers`/`findNode` (`core/tree.ts`) para ubicación y validación de sub.
- `expanded`/`toggleExpanded`, `openPartidaId`, modo `focused` de `PresupuestoView`.
- El walk de ancestros de `onAddSub` → se EXTRAE a `ancestorIds` y se comparte.

## NO en alcance (aplazado a TODOS.md)
- Buscar por descripción larga (`desc`) o por recursos del descompuesto (de momento
  `pos·code·title`; fácil de ampliar el `haystack`).
- Buscar a través de OTRAS obras (eso es Referencia).
- Resaltar el término dentro del título del resultado (highlight).
- Atajo global tipo Ctrl/⌘+K para enfocar el buscador.
- Virtualización de la tabla de partidas (si se añade, el reveal deberá scrollear por
  índice de ítem, no por id de DOM — nota para el futuro).

## Plan de test
- `core/buscar.test.ts`: ubicación correcta de partida en sub anidado (depth≥2, miga
  resuelta del capítulo correcto) y de partida directa de capítulo; `searchPartidas`
  por código, por título, case-insensitive; query `<2` → vacío; cap/`truncated`;
  `buildSearchIndex` sobre obra vacía → `[]`.
- `obraStore.test.ts` (`revealPartida`): (a) sub válido → `active=sub`, ancestros
  expandidos, `view='presupuesto'`, `openPartidaId=partidaId`; (b) **`openPartidaId`
  NO queda en null** (guarda directa del trap de `setActive`); (c) partida directa de
  capítulo → `active=chapterId`; (d) **sub huérfano → `active=chapterId`** (no
  `chapters[0]`); (e) revelar con OTRA partida abierta → la nueva queda abierta, la
  previa cerrada; (f) `revealNonce` incrementa incluso re-revelando la ya abierta.
- `ancestorIds`: cadena correcta para sub anidado; `[]` para id inexistente; equivale
  al walk de `onAddSub`.
- Componente `BuscarPartidas`: teclear filtra; click/Enter → `revealPartida` con los
  tres args + `onAfterSelect` disparado; Esc en dos fases; estado «sin coincidencias».
- Reveal end-to-end en `compact=false` (tabla) Y `compact=true` (tarjetas): el ancla
  existe en ambos.

## Archivos tocados (estimación)
- Nuevos: `src/core/buscar.ts` (+ `buscar.test.ts`),
  `src/features/presupuesto/BuscarPartidas.tsx` (+ `.test.tsx`).
- Editados: `src/core/tree.ts` (`ancestorIds`),
  `src/store/obraStore.ts` (`revealPartida` + `revealNonce`),
  `src/layout/Sidebar.tsx` (montar buscador arriba + usar `ancestorIds` en `onAddSub`),
  `src/features/presupuesto/PresupuestoView.tsx` (efecto scroll + `.justRevealed`),
  `src/features/presupuesto/PartidaRow.tsx` y `PartidaCard.tsx` (ancla `id` + `.justRevealed`),
  `src/features/presupuesto/ChapterHeader.tsx` (miga completa),
  `Sidebar.module.css` + `Presupuesto.module.css` (estilos buscador/pulso).
- ~10 archivos, sin infraestructura nueva, < 1 día CC.

---

## GSTACK REVIEW REPORT

### Voces
- **Codex (eng):** 2 high + 5 medium. Disponible y ejecutado en read-only.
- **Subagente Claude (eng):** 2 critical + 3 high + 4 medium. Independiente.
- **Subagente Claude (design):** 2 critical + 4 high + 5 medium/low. Independiente.

### Consenso eng (CONFIRMED = ambas voces)
| Dimensión | Consenso |
|---|---|
| `revealPartida` atómico, `openPartidaId` el último | CONFIRMED (crítico) |
| Sub huérfano → fallback a capítulo (no `chapters[0]`) | CONFIRMED (alto) |
| Pasar `chapterId`/`subId` del hit (sin rescan) | CONFIRMED |
| Scroll por reintento acotado, gate en montaje, cancela en nonce | CONFIRMED |
| Ancla en `PartidaCard` (modo compacto) + test ambos | CONFIRMED |
| Helper `ancestorIds` compartido (DRY con `onAddSub`) | CONFIRMED |
| Gate de índice por foco/long-mín + `useDeferredValue` + parar en cap+1 | CONFIRMED |
| a11y combobox (no solo listbox/option) | CONFIRMED |

### Consenso design
Pulso transitorio `.justRevealed` (el scroll solo no basta) · aislamiento legible
(ruta completa en cabecera) · buscador ARRIBA del sidebar · dropdown en PORTAL
(evita `overflow:hidden`) · filas a dos líneas con miga completa · Esc en dos fases ·
levantar estilos `.search` de Referencia.

### Decision Audit Trail
| # | Fase | Decisión | Clase | Principio | Razón |
|---|------|----------|-------|-----------|-------|
| 1 | Eng | `revealPartida` = una `set()` atómica, `openPartidaId` al final | Mech | P5 | Correctud: `setActive`/`setView` nulan `openPartidaId` |
| 2 | Eng | Validar `p.sub`; huérfano → `active=chapterId` | Mech | P1 | Sin esto, salta al capítulo equivocado |
| 3 | Eng | Firma `revealPartida(id, chapterId, subId)` desde el hit | Mech | P3/P4 | O(1), sin rescan |
| 4 | Eng | `ancestorIds` helper en `core/tree.ts`, reuso en `onAddSub` | Mech | P4 | DRY, no duplicar el walk |
| 5 | Eng | Scroll: reintento acotado + gate montaje + cancela en nonce | Mech | P1 | rAF único es frágil (re-render/compact/drawer) |
| 6 | Eng | Ancla en tabla Y tarjeta; test ambos modos | Mech | P1 | Móvil usa tarjetas |
| 7 | Eng | Índice gateado por foco/≥2 chars + `useDeferredValue` + cap+1 | Mech | P1 | 70k partidas |
| 8 | Eng | `SearchResult {hits, truncated}` (cierra desfase de API) | Mech | P5 | Coherencia firma |
| 9 | Eng | a11y combobox completo + `revealNonce` siempre incrementa | Mech | P1 | Completitud |
| 10 | Design | Pulso `.justRevealed` keyed en `revealNonce` (gated reduced-motion) | Scope+ | P1/P2 | En radio, <1d; ES el remate del feature |
| 11 | Design | Ruta completa en `ChapterHeader` al aislar | Scope+ | P1 | Hace legible el cambio de contexto |
| 12 | Design | Buscador arriba del sidebar, bloque propio | Mech | P5 | Punto de entrada global |
| 13 | Design | Dropdown en portal; filas dos líneas; Esc dos fases | Mech | P1/P5 | Evita recorte; disambigua; convención |
| 14 | Design | Limpiar `q` + blur al seleccionar | Mech | P5 | El salto es la finalización |
| 15 | Eng | DX phase N/A: feature de usuario final, no herramienta de devs | Skip | — | Examinado; sin superficie DX |

### Lo que NO se tocó y por qué
- **CEO/estrategia:** sin ambigüedad estratégica — feature pequeño, con análogo en
  repo (Referencia) y pedido explícito. Premisa aceptada (P6).
- **DX:** N/A — app de usuario final (presupuestos), no API/CLI/SDK.
