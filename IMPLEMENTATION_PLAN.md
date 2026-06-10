# Plan de implementación — Concreta · Mediciones

> Reconstrucción del prototipo de diseño (`design_handoff_concreta_mediciones/`) como
> aplicación de producción en **Vite 7 + React 19 + TypeScript**, con fidelidad
> pixel-perfect al sistema visual Concreta y un motor de cálculo tipado y testeado.

**Estado del documento:** v2 — revisado en `/plan-eng-review` (2026-06-08).
**Decisiones cerradas:** Vite SPA · CSS Modules + tokens CSS portados verbatim · persistencia local-first (IndexedDB/Dexie) · backend opcional posterior.

---

## 0. Revisión de ingeniería — decisiones bloqueadas (2026-06-08)

> Donde estas decisiones choquen con el texto de las fases F0–F8 de más abajo, **mandan estas**. Salidas de `/plan-eng-review` + voz externa Codex. Ver también `TODOS.md`.

**Hito 1 = corte vertical fino (no las 8 fases antes de validar).** Objetivo: dogfoodear una certificación real cuanto antes.
- **Incluye:** F0 shell · F1 motor de cálculo testeado (100% ramas) · F2 presupuesto mínimo (sostener datos, editar) · F4 certificación mínima · import BC3 mínimo · **persistencia mínima (Dexie + `schemaVersion`)**.
- **NO construir en M1 (gate duro):** F3 Resumen · F5 panel Referencia · F7 exporters salvo PDF-print · DOCX/XLSX/BC3-export · drag&drop · tweaks-panel · multiselección. Se difieren a propósito; no tocarlos hasta validar el bucle medir→presupuestar→certificar.

**Orden de construcción ≠ orden de validación.** Construcción de abajo arriba (core→presupuesto→certificación); validación certificación-primero (dogfood con .bc3 real).

**Decisiones técnicas (override del texto antiguo):**
1. **FIEBDC-3 (.bc3) — IMPORT con la librería `bc3` (npm); EXPORT propio, fase posterior.** Evaluada `bc3` (v1.1.0, MIT, **cero dependencias**, corre en navegador): parser FIEBDC-3 2002–2020 testeado contra ficheros reales de Presto/ARQUIMEDES/TCQ, con modos lenient/strict + diagnostics. Maneja los baches duros (multilínea `~D` de ARQUIMEDES, códigos hijo con puntos, `~O`/`~K`). **Es parser-only: no serializa .bc3.**
   - **Import (M1):** usar `bc3` + un **adaptador** `BC3Document → {chapters, partidas, recursos}` en `importers/bc3`. El `core/` de cálculo queda puro (la dependencia vive solo en el límite de import). Los diagnostics alimentan los estados de error/parcial de import.
   - **Gate de M1 = fidelidad de import** (no round-trip aún): parsear .bc3 reales propios de Presto y Arquímedes, mapear, y que **PEM/total cuadre al céntimo** con lo que muestra Presto; registros no modelados conservados por la librería.
   - **Export a .bc3 (serializador):** **propio, fase posterior** (cuando importe el puente de salida constructora→arquitecto). Opción elegante: escribirlo y contribuirlo upstream (MIT). El round-trip completo se valida entonces.
   - **Riesgo bus-factor** (autor único): mitigado por MIT + cero deps → vendoreable/forkeable. (Anula el "parser propio en F7".)
2. **Dinero en enteros de céntimos (exacto), no float.** `core/money` modela importes en céntimos enteros, aplicando las **mismas reglas de redondeo por paso** que el prototipo (round-per-line). Cero error de representación de float. (Anula el "round2 sobre float es suficiente".)
3. **Eliminar `BASE_PEM`.** `PEM = Σ importes de partidas reales`. Sin cubos ocultos. Un capítulo "alzado / a justificar" se modela como una partida normal con precio fijo (el modelo ya lo soporta). Ajustar el test semilla: PEM = Σ partidas, no la constante 28.420,18.
4. **Persistencia desde M1.** Dexie con autosave y campo `schemaVersion` + ruta de migración desde el día uno (no en F6). Diseñar el shape serializable pronto.
5. **Sin duplicar fila desktop/móvil.** Un hook/selector calcula los valores derivados de cada fila una vez; `<Row>` (tabla) y `<Card>` (móvil) solo presentan.
6. **Precio de partida = descompuesto por defecto, con OVERRIDE manual señalizado** (revisado 2026-06-09 con el fundador; corrige la versión absoluta anterior). Por defecto el `precio` de una partida ES la suma de su descomposición (`descompUnit`): editar sus recursos **recalcula el precio**, así que coinciden de inicio. El usuario PUEDE escribir el precio a mano → queda fijo (`precioManual = true`) y se muestra una **señal en la justificación** de que el precio ya NO se calcula de los descompuestos sumados (estado entendible). La señal es data-driven: salta cuando `precio ≠ descompUnit`. Partidas importadas/semilla traen el precio de la fuente (autoridad). El `precio` guardado es siempre el **efectivo** (lo usa `partidaImporte`); el store lo mantiene sincronizado con `descompUnit` mientras no haya override.
7. **Tests (refinado en `/plan-ceo-review` 2026-06-08, D6):** **100% de ramas en la matemática de dinero/cert** (`money`, `medicion`, `banco`, `totales`, `certificacion`) + **fixtures `.bc3` reales** + tests de regresión; cobertura sensata (no obligada al 100%) en el pegamento (`numbering`, `seed`, UI). E2E clave: recalc vivo, recurso compartido, mover/borrar, toggle cert, **gate de import BC3 = PEM al céntimo sobre .bc3 reales** (NO round-trip: el export es fase posterior, ver decisión 1), dogfood. Escritos junto al código, no diferidos.
8. **Versiones:** usar Vite y React **actuales** (Vite 7, React 19) en vez de pinear majors viejos sin motivo. Si F0 lista Storybook en aceptación, debe ser también una tarea (o quitarlo del criterio).

**Aplazado y capturado en `TODOS.md`:** clave de banco consciente de fuente (T-1) · inmutabilidad/auditoría de certificaciones (T-2) · PDF de certificación profesional (T-3) · variantes de contrato españolas (T-4).

---

## 0.5. Spike de validación + legal — GATE antes de F1 (revisión CEO 2026-06-08)

> Salida de `/plan-ceo-review` (modo HOLD SCOPE) + voz externa Codex. Antes de construir
> F1 en producción se ejecuta un spike barato que ataca las dos incógnitas que pueden
> invalidar el producto. Decisión del fundador (D1).

**Por qué:** la demanda es débil (fundador + un colega, nadie paga aún) y hay un
**BLOQUEANTE legal** sin resolver. Construir F1–F4 (semanas) antes de tocar esas dudas es
el riesgo nº1. El prototipo hi-fi ya corre el flujo entero en el navegador: sirve de banco
de pruebas sin esperar al `core/` de producción.

**Tareas del spike:**
1. **Validez legal de la certificación (research, el fundador es el experto de dominio).**
   Resolver **por escrito**: ¿la certificación que emite Concreta es legalmente utilizable
   en España (e-firma / AutoFirma / aprobación de la Dirección Facultativa / formato oficial)
   o es solo un documento de trabajo interno? **Done =** respuesta escrita (e-firma sí/no +
   formato) antes de empezar F4. Esta respuesta **decide T-2** (ver abajo) y puede reformar
   el alcance de F4.
2. **Dogfood cronometrado (The Assignment del design doc, elevado a gate).** Coger una obra
   real propia, **medir primero cuánto tardas hoy en certificarla en Excel** (línea base),
   importar su `.bc3` ya presupuestado en el **prototipo existente** (hack mínimo, mapping
   a mano) y certificarla dentro del prototipo. Cronometrar vs Excel y anotar **cada momento
   en que dan ganas de huir a Excel** (qué falta, qué es lento). Capturar una **señal de pago**
   ("esto lo pagaría"). Bonus: que el colega lo haga y observarle sin ayudar.

**Criterios kill/go:** **se deciden tras ver el resultado del spike** (D5), no se prefijan
aquí. Codex (#16) recomienda fijarlos antes; el fundador opta por juzgar con la evidencia
en mano. Riesgo asumido y registrado: el sesgo de "seguir construyendo por inercia" queda
explícito para vigilarlo.

**Dependencia con T-2 (inmutabilidad de certificaciones, D3):** el resultado de la tarea 1
gobierna la prioridad de T-2. **Si la cert es un documento legal de cobro** → T-2 (estado
emitida/borrador + snapshot al emitir, sin retro-edición silenciosa) **entra en F4**. **Si es
un documento de trabajo** → T-2 sigue aplazado. No pre-comprometer hasta cerrar el spike.

### Resultado del spike (2026-06-09) — GATE SUPERADO ✅ → GO a F1
Dogfood sobre obra real (`obra ejemplo.bc3` Presto + `2025-011 MED Romeral.bc3` FIEBDC-2016, ambas importadas con `ogorhc/bc3`, PEM cuadrado salvo céntimos de redondeo, K global resuelto):
- ⏱️ **Certificar en Concreta: 10 min MÁS RÁPIDO que en Excel.** 🎯 **Todo cuadró.** → bate a Excel, el criterio de éxito del dogfood se cumple.
- 💶 **Señal de pago: ~15 €/mes** (SaaS por puesto, coherente con la hipótesis de pricing del arquitecto).
- ⚖️ **Legal (tarea 1) — CONFIRMADO (2026-06-09):** el fundador opta, **de momento**, por **certificación = documento de trabajo, SIN e-firma**. → **T-2 (inmutabilidad) SIGUE APLAZADO**. (Revisitar antes de uso externo / cobro formal; sigue en `TODOS.md` T-2.)
- **D5 (kill/go) resuelto = GO.** El spike valida la apuesta; se arranca F1. Riesgo "construir por inercia" mitigado: la evidencia es positiva y concreta.
- 📋 **Feedback de uso → requisitos de F4** (lo que falta para que sea útil de verdad): `%` editable que autocompleta lo ejecutado; descripción + líneas de medición accesibles en modo certificar (desplegable, sin saturar); certificar marcando líneas de medición. **Incorporados a la Fase 4** (abajo) y a la memoria del proyecto.

---

## 1. Resumen ejecutivo

La app es una herramienta de **mediciones, presupuesto y certificación de obra** (tipo
Presto/Arquímedes) con cuatro vistas (Importar · Presupuesto · Resumen · Certificaciones),
un panel lateral de Referencia para copiar partidas de bases de precios, y exportadores
(PDF/Word/Excel/BC3). El prototipo es de alta fidelidad pero **no es código de producción**:
React vía Babel en navegador, estado en memoria, estilos inline, helpers colgados de `window`,
y tasas (IVA/GG/BI) mutadas sobre globals — todo eso se reescribe.

Tres núcleos de complejidad gobiernan el diseño:

1. **Motor de cálculo encadenado** (medición → cantidad → importe → capítulo → PEM → PEC → IVA).
2. **Banco de recursos compartido por código** (editar un recurso recalcula todas las partidas que lo usan).
3. **Certificaciones con doble semántica** ("a origen" vs "esta certificación"), contradictorios y retención.

Y tres subproyectos de peso para el final: exportadores reales y el parser/serializador **FIEBDC-3 (.bc3)**.

**Principio rector:** el motor de cálculo se extrae a un módulo `core/` puro, tipado y
agnóstico de React, blindado con tests unitarios. Si el cálculo es correcto, el resto es UI.

---

## 2. Stack y dependencias

| Capa | Elección | Notas |
|---|---|---|
| Build | Vite (actual, v7) | SPA, sin SSR |
| UI | React 19 + TypeScript (strict) | F0 implementada en React 19 (ver §0 decisión 8) |
| Estado | Zustand + Immer | Store global con slices por dominio |
| Estilos | CSS Modules + `tokens.css` portado | Variables CSS = única fuente de verdad del design system |
| Iconos | `lucide-react` | Sustituye el set propio `ICONS` |
| Persistencia | Dexie (IndexedDB) | Autosave; export/import JSON de proyecto |
| Formato nº | `Intl.NumberFormat('es-ES')` | Miles con punto, decimales con coma |
| Tests | Vitest + @testing-library/react | Cobertura obligatoria del `core/` |
| Import BC3 | **`bc3`** (npm, MIT, cero deps) + adaptador propio | Parser FIEBDC-3 real-world tested; solo lectura |
| Exportadores | `exceljs` (XLSX), `docx` (DOCX), print CSS (PDF) | Export .bc3 = serializador propio (fase posterior) |
| Lint/format | ESLint + Prettier | |

---

## 3. Arquitectura de carpetas (app nueva)

La app vive en `app/` (proyecto Vite), junto al handoff que se conserva como referencia.

```
app/
  public/
    fonts/                # Geist woff2 (copiados del handoff)
    favicon.svg
  src/
    core/                 # ── motor de dominio, SIN React ──
      types.ts            # Chapter, Partida, MedLine, Recurso, Item, Cert, Obra, Rates
      money.ts            # round2, fmtNum, fmtEur, parseEsNumber
      medicion.ts         # lineParcial, medTotal, partidaCantidad, partidaImporte
      banco.ts            # buildRecursos, recursoUsage, recursoBase, itemImporteRec, descompUnit
      totales.ts          # chapterTotal, pem, pec, totalConIva
      certificacion.ts    # certCalc, computeTotals, chapterRows
      numbering.ts        # renumberChapter, posición de partidas/subcapítulos
      seed.ts             # datos de ejemplo (port de data.js/refdata.js)
      __tests__/          # specs de cada módulo
    store/                # Zustand: slices presupuesto, certs, ui, obra, referencia
    styles/
      tokens.css          # PORTADO VERBATIM del handoff
      base.css            # reset, .mono, .caps, .dot-grid, scrollbars, print
    components/           # primitivas: Icon, Badge, EditableNum, EditableText, InlineCreate, IvaSelect, Bar, ContraChip
    layout/               # TopBar, Sidebar, StatusBar, BottomTabBar, Drawer
    features/
      presupuesto/        # tabla partidas, panel detalle (medición/desc/justif), tarjetas móvil, AllChapters
      resumen/
      certificaciones/
      referencia/
      importar/
      exportar/           # modal + generadores
      obra/               # modal datos de obra
    hooks/                # useBreakpoint, useTheme, useTweaks
    persistence/          # dexie db, repo, autosave, import/export proyecto
    App.tsx
    main.tsx
```

---

## 4. Modelo de dominio (TypeScript)

Portado de `data.js`/`refdata.js`. Tipos canónicos:

```ts
type ResourceType = 'MO' | 'MQ' | 'MAT' | '%CI';

interface MedLine { comment: string; uds: number|''; largo: number|''; ancho: number|''; alto: number|''; }

interface Item {                 // línea de justificación de precio dentro de una partida
  code: string;                  // clave del banco; '%CI' es especial (no es recurso)
  type: ResourceType;
  cantidad: number;              // rendimiento, PROPIO de la partida
  // desc/ud/precio NO viven aquí salvo en datos semilla; se leen del banco por code
}

interface Recurso { type: ResourceType; desc: string; ud: string; precio: number; }  // banco[code]

interface Partida {
  id: string; sub?: string; pos: string; code: string; title: string; ud: string;
  precio: number; cantidad?: number;   // cantidad fija si no hay medición
  desc: string; med: MedLine[]; items: Item[];
  mainType?: ResourceType;             // badge de tipo dominante
  fromBase?: boolean;                  // chip "BASE" hasta que se edita
  contradictorio?: boolean;            // chip "P.C."
  baseSource?: string;
}

interface Chapter { id: string; code: string; title: string; children?: { id: string; code: string; title: string }[]; }

interface Cert { id: string; num: number; period: string; retencion: number; data: Record<string, number>; }
//   data[partidaId] = cantidad ejecutada A ORIGEN

interface Rates { iva: number; gg: number; bi: number; coefK: number; }   // p.ej. 0.10, 0.13, 0.06, 1.0
interface Obra { denominacion: string; direccion: string; localidad: string; /* … promotor, constructor, redactor */ }
```

**Coeficiente K global (`coefK`) — requisito de dominio (fundador arquitecto, spike §0.5).**
Aunque los precios vengan de una base de precios, arquitecto/constructor ajustan TODA la obra con un coeficiente global para **cuadrar el PEM a una cifra objetivo** (alza o baja: ×1,13, ×0,87, ×0,80…). Caso real: un PEM aprobado en el ayuntamiento al que hay que cuadrar; o una baja de adjudicación del constructor. Es el registro **`~K`** de FIEBDC (el .bc3 de prueba trae K=+13%: `PEM_base 434.777,78 × 1,13 = 491.298,72` = precio raíz). **`coefK` debe ser editable** y aplicarse a los precios unitarios. Decisión abierta de F1: si K se aplica por precio unitario (con redondeo por partida) o sobre el PEM, y cómo se absorbe el céntimo para **cuadrar exacto** (Presto deja ~2 cént. de desvío por redondeo). Ver `core/money` (céntimos enteros) + `TODOS.md` T-8.

**Estado global** (slices Zustand): `view`, `active` (capítulo/sub o `'__ALL__'`), `expanded`,
`expandedRows`, `partidas` (mapa chId→Partida[]), `chapters`, `recursos` (banco), `certs` + `curCert`,
`rates` (iva/gg/bi), `notes`, `obra`, y flags UI (`drawerOpen`, `refOpen`, `refSourceId`, `refWidth`,
`exportOpen`, `obraOpen`). **Importante:** las tasas son estado de React/store, **no** globals
mutados (eliminar el hack `window.IVA_RATE = …`).

---

## 5. Motor de cálculo — fórmulas exactas (a portar y testear)

Estas son las reglas que el `core/` debe cumplir **exactamente** (extraídas del prototipo):

**Redondeo y formato**
- `round2(n) = Math.round((n + EPSILON) * 100) / 100`
- `fmtNum`: `Intl` es-ES, 2 decimales por defecto, `useGrouping:true`. `fmtEur = fmtNum + " €"`.

**Medición** (dimensión vacía/0/NaN cuenta como factor 1)
- `parcial(l) = round2(dim(uds) · dim(largo) · dim(ancho) · dim(alto))`
- `medTotal = round2(Σ parcial)`
- `partidaCantidad(p) = p.med.length ? medTotal(p.med) : (p.cantidad ?? 0)`
- **Coeficiente K:** el precio efectivo de la partida es `precioK(p) = precio · coefK` (ver §4). `partidaImporte` usa `precioK`. Regla de redondeo de K (por precio vs sobre PEM) = decisión de F1 (T-8).
- `partidaImporte(p) = round2(partidaCantidad(p) · (p.precio ?? 0))`

**Banco / justificación** (precio se lee del banco por `code`, fallback a `it.precio`)
- `recursoBase(items, banco) = round2(Σ_{type≠%CI} round2(cantidad · precioBanco))`
- `itemImporteRec(it)`: si `%CI` → `round2(base · cantidad / 100)`; si no → `round2(cantidad · precioBanco)`
- `descompUnit = round2(base + Σ_{%CI} round2(base · cantidad / 100))`
- Editar `desc/ud/precio` de un recurso → afecta a **todas** las partidas con ese `code`. `cantidad` (rendimiento) es por partida.

**Totales de presupuesto**
- `chapterTotal(ch) = Σ partidaImporte`
- `pem = Σ chapterTotal`  (sin `BASE_PEM`; ver §0 decisión 3. Un capítulo "alzado" es una partida normal con precio fijo)
- `pec = round2(pem · (1 + gg + bi))`
- `totalConIva = round2((pem + round2(pem·(gg+bi))) · (1 + iva))`

**Certificación** (`curData`, `prevData` = cert. anterior de la lista)
- por partida: `ofertada=partidaCantidad`, `ejecutada=curData[id]`, `prev=prevData[id]`, `pct=ejecutada/ofertada·100`, `aOrigen=round2(ejecutada·precio)`, `anterior=round2(prev·precio)`, `estaCert=round2(aOrigen−anterior)`
- totales: `certPEM=Σ aOrigen`, `prevPEM=Σ anterior`, `ggbiOrigen=round2(certPEM·(gg+bi))`, `pecOrigen=round2(certPEM+ggbiOrigen)`, `pecPrev=round2(prevPEM·(1+gg+bi))`, `pecEsta=round2(pecOrigen−pecPrev)`, `ret=round2(pecEsta·retencion)`, `base=round2(pecEsta−ret)`, `iva=round2(base·iva)`, `liquido=round2(base+iva)`
- **edición "esta certificación":** el input muestra `round2(ejecutada − prev)`; al confirmar `v` guarda `round2(max(0, prev + v))` como valor a-origen.

---

## 6. Sistema visual

- **Portar `tokens.css` verbatim** (variables dark/light, `--accent-soft`, sombras, `.dot-grid`, `.mono`, `.caps`, `.sec-head`, `.badge`, scrollbars, `fadeUp`, drawer, `@media print` con `.no-print`).
- Fuentes Geist (Sans 400/500/600, Mono 400/500) desde `public/fonts/`.
- Tema vía `data-theme="dark|light"` en `<html>`; acento configurable vía `--accent`.
- Badges de recurso: MO=warn, MQ=violeta, MAT=teal, %CI=neutral (fondo `color-mix 13%` + punto 5px).
- Breakpoints: móvil <760 · tablet 760–1023 · desktop ≥1024 · split Referencia ≥1100 · tabla→tarjetas si ancho útil <780. Clases `.hide-lg/md/sm/xs`.
- Animaciones gated en `prefers-reduced-motion: no-preference` (estado final visible como base, para no romper PDF).

---

## 7. Fases de implementación

Cada fase es incremental y deja algo ejecutable. Marca `[ ]` al completar.

### Fase 0 — Cimientos y shell
**Objetivo:** proyecto arrancable con el chrome visual y el tema.
- [x] Scaffolding Vite 7 + React 19 + TS (strict), ESLint/Prettier, Vitest 4.
- [x] Portar `tokens.css` (verbatim) + `base.css`; copiar fuentes Geist y favicon.
- [x] `useBreakpoint`, `useTheme` (data-theme + acento + persist), `useTweaks` (prefs UI local-first).
- [x] Primitivas: `Icon` (lucide), `Badge`, `Bar`, `EditableNum`, `EditableText`, `InlineCreate`, `IvaSelect`, `ContraChip` (+ `GhostBtn`).
- [x] Layout shell: `TopBar` (marca, breadcrumb, tabs, acciones), `Sidebar` (vacío), `StatusBar`, `BottomTabBar`, `Drawer` móvil.
- **Entregable:** app con cabecera, tabs que cambian de vista (placeholders), tema claro/oscuro y responsive del chrome. ✅
- **Aceptación:** alternar tema funciona; tabs cambian `view`; topbar colapsa correctamente en cada breakpoint; primitivas renderizan en página sandbox (`#sandbox`, en vez de Storybook — ver T9); `npm run build`, `npm test` (15 verdes) y `npm run lint` verdes. ✅

### Fase 1 — Núcleo de dominio (la base crítica) ✅ COMPLETA (2026-06-09)
**Objetivo:** motor de cálculo tipado y testeado + store con datos semilla.
- [x] `core/types.ts`, `money.ts`, `medicion.ts`, `banco.ts`, `totales.ts`, `certificacion.ts`, `numbering.ts`.
- [x] `core/seed.ts` (port de `data.js` + `refdata.js`), **sin `BASE_PEM`** (ver §0 decisión 3: `PEM = Σ partidas`). Incluye `makeCertsInit` + `DEFAULT_OBRA` (port verbatim).
- [x] Store Zustand (+ Immer) con estado de obra sembrado + UI y **selectores memoizados** (chapterTotals, pem, pec, totalConIva, counts) en `store/`. Acciones F1: setView/setActive/setRates/setCurCert/onCertEdit/reset. CRUD completo de partidas/recursos = F2 (store preparado).
- [x] **Tests unitarios** de §5 (116 verdes; 18 del store). Build + lint OK.
- **Entregable:** módulo `core/` reutilizable + store que expone los mismos números que el prototipo. ✅ PEM = 26.291,91 € desde el selector.
- **Aceptación (tests obligatorios):**
  - `partidaCantidad` con dimensión vacía = factor 1 (p.ej. arena 0/5: `1·14,20 = 14,20`).
  - PEM con seed = **Σ partidas = 26.291,91 €** (sin `BASE_PEM`; ver §0 decisión 3). NOTA: el comentario de `data.js` decía 26.196,66 pero NO cuadraba con sus propios datos (las partidas suman 26.291,91); el motor reproduce la fórmula del prototipo al céntimo sobre los datos reales → la fuente de verdad son los datos, no el comentario. La antigua constante 28.420,18 incluía el cubo oculto, ya eliminado.
  - `descompUnit` se calcula bien (informativo). En el seed la descomposición demo NO suma al precio (p111: descompUnit 9,27 € vs precio 18,42 €) → la **señal de override** salta (`precio ≠ descompUnit`). En una partida construida desde recursos, `precio` = `descompUnit` hasta que se hace override manual.
  - Editar el precio de `mo001` recalcula **todas** las partidas que lo usan; `recursoUsage('mo001') ≥ 4`.
  - Certificación: `estaCert = aOrigen − anterior`; editar en modo "esta cert." guarda `max(0, prev+v)` a origen.
  - `liquido` de la cert. nº actual reproduce el valor del prototipo con las mismas tasas.

### Fase 2 — Vista Presupuesto (la grande)
**Objetivo:** edición completa del presupuesto.
- [ ] `Sidebar`: "Toda la obra", árbol capítulos/subcapítulos con chevron, código mono, importe `{k}`, barra de progreso %PEM, añadir capítulo/subcapítulo (InlineCreate), papelera con confirmación; tarjeta Resumen (composición PEM/GG+BI/IVA + selector IVA + Total).
- [ ] `ChapterHeader` + `AllChapters` (vista obra completa con total c/IVA y bandas por capítulo).
- [ ] Tabla de partidas (`ctable`): Nº·Código, Descripción (badge+título editable+chips BASE/P.C.), Ud, Cantidad (derivada), Precio editable, Importe (+barra peso), menú ⋮ (mover/eliminar con renumeración).
- [ ] Panel de detalle (toggle segmentado): **Medición** (tabla uds/largo/ancho/alto/parcial + añadir línea + total), **Descripción** (textarea), **Justificación** (banco compartido, SharedChip, %CI, precio descompuesto).
- [ ] Add/move/delete partidas, subcapítulos (sus partidas suben al capítulo), capítulos; renumeración `pos`.
- [ ] Tarjetas de partida en móvil/compacto (<780).
- [ ] Regla `fromBase=false` al editar cualquier campo/medición/rendimiento.
- **Entregable:** la vista principal totalmente operativa y editable.
- **Aceptación:** editar una medición actualiza cantidad→importe→capítulo→PEM en vivo; editar un recurso en una partida cambia el importe en otra que lo comparte; mover una partida renumera ambos capítulos; borrar subcapítulo reasigna sus partidas; el chip BASE desaparece al editar; en <780 la tabla conmuta a tarjetas.

### Fase 3 — Vista Resumen
- [ ] Hoja resumen (max-width 880, dot-grid): desglose por capítulos (% y importe), PEM, GG (% editable→importe), BI (% editable→importe), PEC s/IVA, IVA (selector 10/21), Presupuesto base de licitación.
- [ ] Tarjeta Observaciones (textarea libre, persistida).
- **Aceptación:** cambiar GG% o BI% recalcula PEC y total; el selector de IVA es coherente con el resto de la app (mismo estado de tasas); la denominación de obra alimenta la cabecera.

### Fase 4 — Vista Certificaciones

> **Eng review F4 (2026-06-10, `/plan-eng-review` + voz externa Codex) — decisiones bloqueadas. Mandan sobre el texto antiguo de abajo donde choquen.** El motor de cert ya está hecho y testeado (F1: `core/certificacion` + `onCertEdit`/`setCurCert`); F4 = UI + pocas acciones + 1 cambio de modelo. **Troceada en sub-commits a main (como F2).**
> 1. **Modelo de ejecución por línea = SNAPSHOT, no ids (Tensión 1, acepta Codex #1/#2/#3/#14).** `MedLine` gana `id` estable NO opcional (toca `addMedLine`/seed/keys de F2). `Cert` gana `lineQty?: Record<partidaId, Record<lineId, number>>`: la cantidad ejecutada por línea **congelada al marcar** (= parcial si entera, o menos si parcial → soporta certificar PARTE de una línea). `Cert.data[partidaId]` (a-origen) = `Σ lineQty`. Estable frente a editar la medición después; cada cert tiene su snapshot. NO guardar solo ids + recomputar en vivo (frágil). NO el helper transitorio (pierde "ver qué está hecho").
> 2. **Marca = siempre a origen (Hallazgo 1A).** Marcar fija la cantidad acumulada a-origen; el toggle A origen/Esta cert solo afecta al input tecleado y al importe mostrado. `addCert` hereda `data` **y** `lineQty` de la última cert cronológica (Codex #2/#7), además de `retencion`/defaults de periodo; "Nueva" añade desde la última, no inserta tras la actual (#6).
> 3. **`addCert`/edición de medición invalidan marcas = trabajo de modelo de F4.1, no de F4.3 (Codex #8).** El shape del modelo y la coherencia de `lineQty` ante `editMedLine`/`deleteMedLine`/`deletePartida` se resuelven en el primer corte; la UI de marcar va después sobre el modelo ya coherente.
> 4. **Contradictorios cert-local DENTRO de F4 (Tensión 2, acepta Codex #12/#13).** Modelar la línea contradictoria dentro de la cert (NO toca `partidas` ni el PEM base). Da sitio al trabajo extra sin corromper el histórico. (Revierte el "aplazar" inicial: el fundador confirma que sus obras llevan contradictorios.)
> 5. **DRY: `groupBySub` → `core/grouping.ts`** (lo comparten Presupuesto y Certificaciones). Helpers puros `certChapterRows` + `pctToCantidad`/`cantidadToPct` en `core/certificacion` (+ tests); **% y cantidad son CANTIDAD, redondeo a 2-3 dec, no céntimos (Codex #10)**. Selectores memoizados `selectCertTotals`/`selectCertChapterRows`.
> 6. **T-6: endurecer `parseEsNumber`** (inputs de cert = dinero), pero SIN sobre-endurecer (Codex #11): "esta cert" negativa es corrección legítima; clamp retención a 0..1; el input intermedio malformado no debe hacer hostil la edición inline.
> 7. **Residuo de #5 (precio en vivo reescribe certs históricas) → afinado en `TODOS.md` T-2, sigue aplazado** (postura del spike: working doc, solo). T-2 (inmutabilidad) NO entra en F4.
> 8. **Regresiones obligatorias:** (a) `onCertEdit` limpia `lineQty[id]` al teclear (override); (b) `MedLine.id` no rompe `addMedLine`/seed/tests de F2; (c) `deletePartida` deja `Cert.data`/`lineQty` huérfanos que los totales ignoran.

- [ ] Selector de certificación (histórico con % y líquido + "Nueva certificación").
- [ ] Periodo editable; "Líquido a abonar" grande; toggle **A origen / Esta certificación**; % ejecución global.
- [ ] Tabla por partida con `PctBar`, ejecutada editable (semántica según modo), importe a abonar.
- [x] Precios contradictorios (F4.4, commit pendiente): botón "Añadir precio contradictorio" por capítulo → línea con badge ámbar P.C., código "P.C."/pos "C…", campos editables (título/ud/cantidad/precio) DENTRO de la cert (`Cert.extras: CertExtra[]`, no toca `partidas` ni el PEM base). El `precio` es efectivo (NO se escala por K). Suma a certPEM/prevPEM (no a budgetPEM → % global puede pasar de 100). `addCert` hereda los extras a-origen (mismo id → "anterior" cuadra). Acciones `addContradictorio`/`editContradictorio`/`deleteContradictorio`; core `extraCalc`/`extrasCantidad`.
- [ ] `CertSummary` (retención % editable, base, IVA, líquido) + `CertChapterSummary` (barras de avance).

**Requisitos del dogfood (2026-06-09) — validados en obra real, son lo que falta para que sea útil:**
- [x] **`%` editable por partida que autocompleta lo ejecutado** (F4.2). Teclear "50%" calcula la cantidad/importe ejecutado **a origen** o **en esta certificación** (según el modo). Bidireccional: editar % ↔ editar cantidad.
- [x] **Descripción + líneas de medición accesibles EN modo certificar** (F4.2): desplegable por partida (colapsado por defecto) con descripción + líneas de medición.
- [x] **Certificar marcando líneas de medición** (F4.3, commit pendiente). Casilla por línea en el desplegable: marcar fija `lineQty[partidaId][lineId]` = parcial a-origen (snapshot) y `data[partidaId] = Σ lineQty`; desmarcar la última limpia la partida; teclear cantidad/% hace override y borra `lineQty[partidaId]` (§8a). Marca SIEMPRE a-origen, independiente del modo (§2). Certificar "por trozos medibles" en vez de teclear una cantidad. *(El modelo `Cert.lineQty` venía de F4.1.)*
- [x] **Tarjetas móvil (F4.5, commit pendiente) → F4 COMPLETA.** Conmuta tabla↔tarjetas por ANCHO ÚTIL <780 (`useElementWidth`, igual que F2.5, no por viewport). `CertCard` (pos/código, ofertada/precio, ejecutada+`PctBar` editables, desplegable que reusa `CertDetail` con marcado de líneas F4.3) + `CertExtraCard` (contradictorio editable) + `CertChapterCards` (grupos por sub + alta). Oculta `CertHead` en compacto; resumen a 1 columna.
- **Aceptación:** el toggle cambia importe mostrado y significado del input; añadir contradictorio aparece marcado y suma al líquido; editar retención recalcula base/IVA/líquido; cert. nº2 usa nº1 como "anterior"; **teclear un % rellena la cantidad ejecutada al céntimo; el desplegable por partida muestra descripción + líneas de medición sin saturar; marcar líneas suma a lo ejecutado.** **TODO ✓ — F4 cerrada en 5 commits (F4.1 `11d2326` · F4.2 `a10f6c6` · F4.3 `e8be65b` · F4.4 `ffc6bf9` · F4.5 pendiente).**

### Fase 5 — Referencia + Importar

> **Alcance acordado (2026-06-10):** esta fase = SOLO el **panel Referencia** (copiar partidas de bases al presupuesto). La **vista Importar .bc3** (integrar la librería `bc3`, subproyecto de mayor riesgo) se difiere a una slice posterior (F5.x) con su propia preparación. Panel con **fidelidad del prototipo** (split redimensionable 320–640 en ≥1100, overlay en <1100). Troceado: **F5.1** panel + copia (botón/capítulo/multiselección) · **F5.2** drag&drop.

- [x] Panel Referencia (F5.1, commit pendiente): split redimensionable (320–640) si ventana ≥1100, si no overlay. Selector de fuente, buscador, interruptor "Copiar como precio contradictorio". Datos portados a `core/refdata.ts` tipado (3 fuentes: BDT Andalucía, Reforma Goya, CYPE GP) + `REF_DESC`.
- [x] Árbol solo-lectura (F5.1) con checkbox multiselección, desplegar descripción larga + descomposición, botón "←", copiar capítulo entero.
- [x] Copia por **botón** y por **multiselección + "Copiar a {capítulo}"** (F5.1): acción `copyRefPartidas` integra recursos en el banco **sin pisar** los homónimos; crea partida con `med:[]`, items por código, marca BASE (o P.C. si contradictorio). `precio` de la base = autoridad (no recomputa). Destino = capítulo/sub activo (`copyTargetOf`/`selectCopyTarget`) o explícito. Estado de UI en store (`refOpen`/`refSourceId`/`refWidth`); split/overlay + tirador en `App`.
- [x] **Copia por drag&drop** (F5.2, commit pendiente): arrastrar partida(s)/capítulo y soltar sobre capítulo/sub del sidebar (→ ese destino) o sobre el área de presupuesto (→ capítulo/sub activo). Payload en el store (`refDrag = {items, contra}`, congela el toggle al empezar a arrastrar); `setRefDrag` lo fija/limpia. Drop targets con resaltado: filas del Sidebar (`DropHandlers`, clase `.dropOver`) y `<main>` (borde discontinuo `.dropZone`). Arrastrar una partida seleccionada arrastra toda la selección.
- [x] **Vista Importar .bc3** (F5.3, commit pendiente): zona drop + file picker → `core/bc3import.bc3ToObra(bytes)` (librería `bc3` integrada en la app). Resumen con programa/charset, capítulos/partidas/recursos, coef. K y **gate de PEM** (calculado vs precio raíz del .bc3); "Cargar al presupuesto" reemplaza la obra (`loadObra`). Mapeo portado del spike: estructura por descomposición (raíz→capítulos→partidas→recursos; nodo con medición = contenedor; subcapítulos aplanados), K como TASA `rates.coefK` (no pre-multiplica), `precioManual` donde no cuadra. Charset por `TextDecoder` (windows-1252/utf-8/iso-8859-1; cp850/cp437→fallback). Validado contra `obra ejemplo.bc3` (Presto): 19 cap · 167 part · K=1,13 · PEM cuadra (≈0,11 € de redondeo).
- **Aceptación:** copiar una partida con descomposición crea la partida con `med:[]`, items por código, chip BASE, y sus recursos nuevos entran al banco sin sobreescribir los homónimos ✓; drag&drop al sidebar funciona ✓; en <1100 abre overlay ✓; un .bc3 real (Presto) se importa a chapters+partidas+banco y el PEM cuadra con la raíz ✓. **F5 COMPLETA: panel Referencia (F5.1 `a257d1c` + F5.2 `cb213a2`) + Importar .bc3 (F5.3).**

### Fase 6 — Persistencia + Datos de obra

> **Eng review F6 (2026-06-10, `/plan-eng-review` + voz externa Codex gpt-5.5) — decisiones bloqueadas. Mandan sobre el texto antiguo donde choquen.** El seam de serialización ya está hecho (`ObraData`/`toSerializable`/`fromSerializable`/`SCHEMA_VERSION`/`loadObra` de F1/F5.3); F6 = cableado de persistencia + datos de obra. **Troceada en sub-commits (como F2/F4/F5).**
> 1. **Alcance (D2-A):** F6 SIN multi-proyecto. Troceado **F6.1** persistencia · **F6.2** datos de obra · **F6.3** export/import JSON. Multi-proyecto → `TODOS.md` **T-10**; restaurar estado de UI → **T-11**.
> 2. **Almacenamiento = `idb-keyval`, NO Dexie (Issue 1-B, Codex coincide).** Guardamos UN blob `ObraData` bajo una clave; no hay tablas que consultar (multi-proyecto aplazado). Dexie sería complejidad accidental. **Envelope** `{schemaVersion, savedAt, appVersion, data}` + nombres DB/store/clave estables (diagnóstico/migración futura sin comprometer multi-proyecto). Capa aislada en un módulo `persist` → migrar a Dexie luego es local.
> 3. **Hidratación gated (Issue 2-A + Codex #7):** cargar de IDB **antes de `createRoot().render()`** (no en un hook post-render: los hooks corren tras render), splash mínimo mientras. Si hay guardado → **validación estructural** (no solo `schemaVersion`; arrays/maps presentes, certs/refs coherentes, rates finitos, ids string — Codex #11) → `fromSerializable` → `loadObra`. Si vacío → demo en memoria, **NO** se persiste.
> 4. **Persistencia DOMINIO-SOLO (Issue 4-A):** solo `ObraData`; la UI (vista/activo/curCert/ref*) vuelve a defaults al recargar. **Persistir SOLO tras la 1ª mutación de dominio (Tensión 2-A, Codex #16):** la demo es andamiaje, no debe fosilizarse como datos del usuario; "vacío" queda distinguible y el seed se puede actualizar en v2.
> 5. **Autosave (Issue 5-A + Codex #2/#3/#4):** `subscribeWithSelector` sobre el slice de dominio `[chapters,partidas,recursos,certs,rates,obra]` con shallow-equal (navegar NO guarda), debounced; **armado solo tras hidratar**; **todas las escrituras por UNA cola serializada** (un autosave lento no pisa a uno posterior); **flush** en operaciones de riesgo (importar/reset/cerrar pestaña) + **indicador de estado de guardado**; efectos **idempotentes + cleanup** (React StrictMode los duplica).
> 6. **Ids ÚNICOS — `crypto.randomUUID` (Tensión 1-B, supersede el plan inicial de "rehidratar contadores").** Codex cazó que rehidratar contadores debía escanear `Cert.lineQty`/todas las `certs[*].extras`/`items` y un olvido = **corrupción del histórico de cobro** (una línea nueva hereda un `m·N` que una cert vieja cree suyo). UUID elimina la clase entera: se **borran** los 4 contadores de sesión (`partidaSeq/recursoSeq/medLineSeq/extraSeq`) y `next*Id()` devuelve `<prefijo>-<uuid>`. Seed (`p111`) y bc3 (`b3-*`) ids intactos (literales). Tests que asumían formato `p·N`/`m·N` se actualizan (no aserciones de formato exacto).
> 7. **T-7 (focus-trap) ENTRA en F6.2:** el modal de Datos de la obra es el **primer modal real**; el design review marcó el trap de foco como arquitectural (AA). Primitiva `Modal` reutilizable (focus-trap + Esc + clic en overlay + restaurar foco al cerrar).
> 8. **Recuperación de corruptos (Codex #6/#12):** datos corruptos / versión desconocida en IDB → **NO** pisar con seed; ofrecer exportar-blob-crudo / descartar / importar reemplazo. El fallo de IDB (incógnito/cuota/abort/`SecurityError` — Codex #13) se captura y se muestra "no se pudo guardar", nunca silencioso.

- [ ] **F6.1 Persistencia (commit pendiente):** `idb-keyval` + envelope + módulo `persist` (load/save/cola/flush) · `useHydrate` gated **pre-render** (valida→`fromSerializable`→`loadObra` ó demo-en-memoria) · autosave por slice armado tras hidratar, persiste tras 1ª mutación · **ids únicos UUID** (borra contadores) · validación estructural · recuperación de corruptos · UX de fallo de IDB + indicador de guardado. **→ "recargar conserva el trabajo".**
- [x] **F6.2 Datos de obra (HECHO):** primitiva `Modal` con focus-trap (**cierra T-7**: role=dialog/aria-modal, Tab cicla DENTRO en captura, Esc cierra, clic en overlay cierra, foco restaurado al cerrar) · `ObraModal` (`features/obra/`: Obra/Promotor/Constructora/Dirección facultativa; grid 2col / 1móvil; bottom-sheet en compacto; mapa de campos del prototipo `app.jsx:146-151`) · acción `setObraPath('promotor.nif', v)` (rutas anidadas, crea objetos intermedios, solo strings) · breadcrumb lee `obra.denominacion` (ya cableado). 242 tests verdes.
- [x] **F6.3 Export/import JSON (HECHO) → cierra F6:** módulo `persist/transfer.ts` (`buildExportText`/`exportObraJson` → sobre `{kind,schemaVersion,exportedAt,appVersion,data}` → blob `.json`; `parseObraJson` = parse → validación estructural (`isObraData`, acepta sobre `.data` o `ObraData` plano) → `fromSerializable` (gate de `schemaVersion`), con `ImportError` `malformado`/`version-desconocida`; `readFileText` vía FileReader). UI `features/obra/ProjectBackup` (sección dentro del `ObraModal`): Exportar/Importar; el import **confirma** (destructivo) + **descarga backup del estado actual ANTES de pisar** → `loadObra` → `flushPending` (si la escritura IDB falla, chip "Sin guardar"); errores legibles inline. 255 tests verdes.

**Flujo de datos (F6):**
```
ARRANQUE  main.tsx
  persist.load() ──► IndexedDB            EDICIÓN (acción de dominio)
    envelope? ─validar estructural             store.subscribeWithSelector(domainSlice, shallow)
      ├─ ok  ─► fromSerializable ─► loadObra          │ (armado solo si hydrated)
      ├─ vacío ─► demo en memoria (NO persiste)        ▼
      └─ corrupto ─► recuperación (export/descartar)  debounce ─► cola de escritura ─► set(KEY, envelope)
    hydrated=true ─► createRoot().render()            flush en import/reset/beforeunload
```

- **Tests (F6):** `fake-indexeddb` (devDep). **Regresión CRÍTICA:** crear partidas/líneas → recargar → crear más → **sin colisión de ids** (verde por construcción con UUID; el test fija el invariante). + round-trip persist/load, hidratación vacío/lleno/**corrupto**, autosave armado-tras-hidratar y por-slice (navegar NO guarda), persiste-tras-1ª-mutación, `setObraPath` anidado, `Modal` focus-trap (Tab cicla, Esc cierra, foco restaurado), export/import JSON (ok/malformado/versión-desconocida), flush en import/reset.
- **NOT in scope (F6):** multi-proyecto (T-10), restaurar estado de UI al recargar (T-11), Dexie (revisitar si T-10), cifrado/sync remoto (Fase 9), undo/redo, `notes` por obra (no hay UI de notas aún).
- **Aceptación:** recargar la página conserva todo el trabajo de DOMINIO; editar datos de obra actualiza el breadcrumb; export→import reproduce el estado idéntico (números incluidos); crear cosas tras recargar nunca colisiona ids; un fallo/corrupción de almacenamiento se ve, no se traga.

### Fase 7 — Exportadores

> **Eng review F7 (2026-06-10, `/plan-eng-review` + voz externa Codex gpt-5.5) — decisiones bloqueadas. Mandan sobre el texto antiguo donde choquen.** Fase 7 = exportadores. **Troceada en sub-commits (como F2/F4/F5/F6); SLICE acordado: PDF primero.**
> 1. **Scope (Step 0):** la fase entera (PDF+XLSX+DOCX+BC3) dispara el smell de complejidad → se trocea **F7.0** (snapshot de precio en cert) · **F7.1** PDF · **F7.2** XLSX · **F7.3** DOCX · **F7.4** BC3 writer. Cada slice completo en sí.
> 2. **Arquitectura PDF (Issue 1):** **documento de impresión DEDICADO**, NO imprimir la vista viva (las vistas son interactivas: inputs editables, filas colapsadas → imprimirían cajas de formulario y ocultarían detalle). `features/print/` read-only y paginado, alimentado por **selectores `listado` PUROS nuevos** (`core/listado.ts`). `@media print` cambia la app por el doc.
> 3. **Montaje del doc (Issue 3):** render **bajo demanda** (acción Exportar → estado → portal a nivel `body` → `window.print()` en efecto → desmontar en `onafterprint`). Nada de DOM siempre-montado (evita construir el árbol de 167 partidas en reposo) ni contenido obsoleto. **Endurecer** `afterprint`: fallback por timeout + guarda anti-doble-print (StrictMode) + esperar fuentes/layout.
> 4. **DRY:** PDF/XLSX/DOCX comparten el modelo de FILAS de presentación (`core/listado`); **el BC3 NO** — el .bc3 necesita un serializador del **grafo semántico** (conceptos/descomposición), serializa del MODELO DE DOMINIO directamente, no del listado (corrección de Codex). Reusar `core/grouping` (`groupBySub`), `core/money` (`toEur`/`fmtNum` es-ES) y los selectores existentes; no reconstruir. **Contrato de metadatos de obra COMPARTIDO** por los 3 (PDF/XLSX/DOCX), no solo DOCX.
> 5. **T-2 en cert export (tensión cross-model, RESUELTA):** `core/certificacion` lee `partida.precio` EN VIVO → exportar una cert y luego editar precio/recurso/K hace irreproducible ese documento de cobro. **Decisión: SNAPSHOT de precio por cert al certificar** (espeja `Cert.lineQty` que ya congela cantidades). Entra como **F7.0**, ANTES del export. Cierra el residuo de precio de T-2.
> 6. **Resumen (tensión cross-model, RESUELTA):** la F3 (vista Resumen) no existe (tab → placeholder). **Decisión: construir la VISTA Resumen** desde `buildResumen` y imprimir esa vista (no un doc oculto no verificable). Front-runea el núcleo económico de F3.
> 7. **Presupuesto doc (tensión cross-model, RESUELTA):** **"Presupuesto y mediciones" COMBINADO** (cada partida con precio + sus líneas de medición debajo). Funde "mediciones detalladas" → desaparece la contradicción del plan viejo.
> 8. **"PDF" = documento imprimible (Guardar como PDF del navegador).** `window.print()` no es un exportador PDF real (márgenes/nombre/paginación dependen del navegador). Suficiente para el dogfood ("PDF al instante"); lib de PDF real para entrega externa = **T-3** (aplazado).
> 9. **Verificación:** los selectores `listado` se testean al CÉNTIMO y AMPLIO (no solo importes: orden de filas, agrupación sub, capítulos vacíos, K, extras/contradictorios, cert en curso, "anterior" en 1ª cert, metadatos de obra, formato es-ES). La paginación/CSS de impresión NO se prueba en jsdom (mock `window.print`) → **QA en navegador real** (`/qa` o manual).

- [x] **F7.0 Snapshot de precio en certificación (HECHO):** `Cert` gana `priceSnapshot: Record<partidaId, number>` (euros SIN K) + `coefK` congelado + `snapshotAt` (fecha ISO, trazabilidad del doc — design review). Congela **al certificar** (`onCertEdit`/`setCertLine` fijan el precio vivo de la partida tocada la PRIMERA vez, espejo de `lineQty`); `addCert` **hereda** los precios congelados de la última cert (su "anterior" reproduce al céntimo lo ya certificado) **y congela** al precio vivo los que falten → la cert nueva nace con snapshot completo. `core/certificacion`: `CertSnapshot`/`certSnapshotOf`/`certPrecioK`; `certCalc`/`certTotals`/`certChapterRows` valoran con el snapshot si existe, en vivo si no (certs legadas pre-F7). `budgetPEM` sigue SIEMPRE vivo (referencia del % global). Drive-by: el histórico (`CertSelector`) valora cada cert con SU snapshot y **con sus contradictorios** (antes omitía `extras` → el líquido del histórico no cuadraba con la vista). Cierra el residuo de precio de **T-2**. Tests (12): cert con snapshot no cambia al editar recurso/precio/K; legada sigue en vivo; herencia + congelado de faltantes; K heredado; no re-congela; marcar línea congela. 267 verdes.
- [ ] **F7.1 PDF (commit pendiente):** `core/listado.ts` (`buildPresupuestoListado` con mediciones embebidas, `buildResumen`, `buildCertListado` con snapshot de F7.0 + contradictorios) + selectores memoizados; **vista Resumen EDITABLE** (port de `resumen.jsx`: desglose por capítulos + PEM, GG/BI/IVA inline-editables vía `setRates` —único hogar de edición de GG/BI— + observaciones → **nuevo campo de dominio `obra.notes`** persistido; el tab deja de ser placeholder); `features/print/` (PrintDoc + Presupuesto/Resumen/Cert, paginado, `@page`, `<thead>` repetido, SIN inputs —el doc renderiza la Resumen en solo-lectura desde el mismo selector) montado bajo demanda en portal + `window.print()` + cleanup; **chooser de export = `ExportModal` sobre la primitiva `Modal` (F6.2)** con "mostrar solo lo que funciona" (en F7.1: solo chip PDF activo para los 3 docs construidos; CP1/2, justificación y los formatos DOCX/XLSX/BC3 aparecen al shipear su slice; chips por formato con su color de DESIGN.md: PDF=warn, DOCX=accent, XLSX=ok, BC3=mq) + sección "Certificaciones de obra" (una fila por cert). Deliverable = documento imprimible (Guardar como PDF). **→ "PDF al instante".**
- [ ] **F7.2 XLSX (commit pendiente):** `exceljs` (o lib más ligera; evaluar peso/compat en Vite navegador) por **import dinámico** (fuera del bundle inicial). Desde `core/listado`. **Política numérica EXPLÍCITA:** importes como CELDAS NUMÉRICAS con formato es-ES (`#.##0,00`), NO strings `"1.234,56"`; reglas de redondeo (céntimos) explícitas.
- [ ] **F7.3 DOCX (commit pendiente):** `docx` por import dinámico, cabecera con metadatos de obra (contrato compartido §4). Aviso: la fidelidad Word (cabeceras de tabla repetidas, saltos, márgenes, descripciones largas) es el trabajo duro, no la reutilización de datos.
- [ ] **F7.4 BC3 export FIEBDC-3 (commit pendiente):** serializador **propio** desde el MODELO DE DOMINIO (grafo semántico, no `core/listado`): `~V/~C/~D/~T/~M`…, conceptos, descomposición, mediciones, `~K`, `%CI`, overrides de precio. **Spec ANTES de codificar:** escape de campos, delimitador `|`, multilínea, convención decimal, charset, CRLF, orden de registros, concepto raíz. Decidir export de **subcapítulos** (el modelo soporta `Chapter.children`/`Partida.sub`; el import los aplana) y de **contradictorios cert-local** (van en doc de cert, NO en presupuesto/PEM base ni BC3 salvo mapeo deliberado). Considerar contribuir el writer upstream (MIT).
- **Aceptación:** el documento imprimible sale sin controles de UI y con números es-ES; XLSX abre en Excel con celdas numéricas correctas; la cert exportada es REPRODUCIBLE tras editar el presupuesto (snapshot F7.0); el .bc3 exportado valida **contra fixtures reales de Presto/CYPE** (no solo round-trip contra el propio importer, que es lenient/lossy: aplana subcapítulos, puede descartar líneas de medición, charset parcial).

> **Design review F7.1 (2026-06-10, `/plan-design-review`) — decisiones (calibradas contra `DESIGN.md` + prototipo hi-fi; mockups OMITIDOS, el prototipo es la fuente).** (D1) **Resumen = hoja EDITABLE** (no solo-lectura): GG/BI/IVA inline + observaciones; añade `obra.notes` al dominio (F6 lo había dejado fuera). El doc de impresión la renderiza en solo-lectura. (D2) **Chooser "mostrar solo lo que funciona":** nada de chips inertes que parecen clicables y no hacen nada (erosionan confianza, Krug); el chooser crece por slice. (Notas) Estado VACÍO de Resumen (obra sin capítulos) reusa el empty-state de "Estados de UI de M1" (no una hoja a 0,00); el doc/fila de cert estampa la fecha de snapshot (F7.0) para trazabilidad. Reusa `Modal`/`IvaSelect`/`EditableNum`/`dot-grid`/`sec-head`. Rating 7→10.

### Fase 8 — Pulido
- [ ] Responsive y tarjetas en todas las vistas; drawer animado; reduced-motion.
- [ ] Accesibilidad (focus rings, roles, navegación teclado en editables; Enter confirma / Esc cancela).
- [ ] Print/PDF afinado; estados vacíos; microinteracciones.
- **Aceptación:** auditoría a11y básica sin errores graves; uso completo con teclado en edición inline; impresión limpia en las 4 vistas.

### Fase 9 (opcional, posterior) — Backend multiusuario
API + auth + sync. La arquitectura local-first permite añadirlo como capa de sync sin reescribir el dominio.

---

## 8. Riesgos y notas de implementación

- **BC3/FIEBDC-3 — riesgo reducido.** El IMPORT se resuelve con la librería `bc3` (npm, MIT, cero deps, real-world tested); ver §0 decisión 1. Riesgo residual: fidelidad del **adaptador** `BC3Document → modelo` (cubrir con tests sobre .bc3 reales) y el **serializador de export**, que es propio y de fase posterior.
- **Banco de recursos compartido**: el invariante más fácil de romper. Modelarlo explícitamente
  (recursos por código en el store; `Item` solo guarda `code/type/cantidad`) y cubrirlo con tests.
- **Tasas como estado, no globals**: eliminar `window.IVA_RATE/GGBI_RATE`. El `core/` recibe `Rates`
  como parámetro puro; nada de mutación global.
- **Redondeo**: respetar `round2` en cada paso intermedio tal como el prototipo (no redondear solo al final),
  o los totales divergirán en céntimos respecto a las capturas.
- **Precisión monetaria**: enteros de céntimos (ver §0, decisión 2). Mismas reglas de redondeo por paso
  que el prototipo, pero sobre enteros: cero error de representación de float. `round2` sobre float NO se usa.
- **Exportadores**: PDF (print) primero por ROI; DOCX/XLSX/BC3 después.

## 9. Orden recomendado y dependencias

```
Fase 0 ─► Fase 1 ─►┬─► Fase 2 ─►┬─► Fase 3
                   │            ├─► Fase 4
                   │            └─► Fase 5
                   └─────────────► Fase 6 (puede solaparse con 3–5)
Fase 7 (tras 2–4) ─► Fase 8 ─► Fase 9 (opcional)
```

Las fases 1 y 2 son el grueso del esfuerzo y el corazón del producto. Conviene no avanzar a
3/4/5 hasta tener el `core/` verde y la vista Presupuesto sólida.

## Implementation Tasks (revisión de ingeniería 2026-06-08)
Sintetizadas de los hallazgos de `/plan-eng-review` + Codex. P1 bloquea; P2 misma rama; P3 follow-up.

- [ ] **T1 (P1, human ~1d / CC ~1h)** — importers/bc3 — Adoptar `bc3` (npm, MIT): validar con .bc3 reales propios (Presto+Arquímedes) + escribir adaptador `BC3Document → modelo` y confirmar totales al céntimo. (Serializador .bc3 = fase posterior; riesgo nº1 reducido al ser solo adaptador.)
- [ ] **T2 (P1, human ~3h / CC ~20min)** — core/money — Dinero en enteros de céntimos (reglas round-per-line del prototipo, sin float).
- [ ] **T3 (P1, human ~1h / CC ~10min)** — core/totales — Eliminar `BASE_PEM`; `PEM = Σ partidas`; ajustar test semilla.
- [ ] **T4 (P1, human ~0 / CC ~0)** — proceso — Gate de scope Hito 1 (ver §0); NO construir F3/F5/F7-extra/drag&drop/tweaks hasta validar.
- [ ] **T5 (P2, human ~4h / CC ~30min)** — persistence — Dexie + `schemaVersion` + autosave desde M1 (no F6).
- [ ] **T6 (P2, human ~4h / CC ~30min)** — components — Hook de datos de fila compartido; `Row`/`Card` solo presentan (DRY).
- [ ] **T7 (P1, human ~1d / CC ~1h)** — core/__tests__ — Tests core 100% ramas + E2E clave (recalc, recurso compartido, mover/borrar, toggle cert, gate BC3, dogfood).
- [ ] **T8 (P2, human ~1h / CC ~10min)** — core/types + store + F2 — Modelo de precio descompuesto/override: `precioManual` en `Partida`; el store recalcula `precio = descompUnit` al editar recursos en partidas no-override; editar el precio a mano fija `precioManual=true`; **señal UI** en la justificación cuando `precio ≠ descompUnit` (estado override entendible). Helpers en `core/banco` (`precioDescompuesto`, `precioCuadraDescompuesto`).
- [ ] **T9 (P3, human ~30min / CC ~5min)** — F0 — Storybook como tarea o fuera del criterio; usar Vite 7 / React 19.

## Estados de UI de M1 (revisión de diseño 2026-06-08)

El sistema visual está completo (ver `DESIGN.md`). Esto cubre los **estados de los flujos nuevos de M1** que el prototipo no diseñó. Todo usa tokens Concreta; nada de gris genérico.

**1. Primer arranque (proyecto vacío).** El prototipo siempre muestra datos semilla; un proyecto nuevo necesita un empty state con calidez, no "0 partidas".
```
            ┌───────────────────────────────────────┐
            │            · dot-grid bg ·            │
            │         ┌─────┐  (bg-elevated)        │
            │         │ 🏢  │  icono building 24    │
            │         └─────┘                       │
            │   Empieza tu primera obra  (H1 23/600)│
            │   Importa un presupuesto .bc3 o crea  │
            │   una obra en blanco. (text-secondary)│
            │  ┌────────────────┐  ┌──────────────┐ │
            │  │ Importar .bc3  │  │ Obra en blanco│ │  ← Importar = primario (accent),
            │  └────────────────┘  └──────────────┘ │     wedge de entrada; blanco = ghost
            └───────────────────────────────────────┘
```
Sidebar vacío: solo cabecera "Capítulos" + "＋ Añadir capítulo" en `--text-disabled`.

**2. Import .bc3 — estados (no silenciosos; Codex marcó la falta de modelo de error).**
- `idle`: zona drop dashed `--border-main` + "Arrastra tu .bc3" + botón seleccionar (ya existe).
- `dragover`: borde `--accent`, fondo `--accent-soft`.
- `parsing`: spinner `--accent` + "Leyendo presupuesto… {n} capítulos".
- `preview` (antes de confirmar): tarjeta `--bg-elevated` con "{X} capítulos · {Y} partidas · {Z} recursos" + **badge de dialecto** (Presto/Arquímedes) + botón "Importar a la obra".
- `error` (corrupto/no soportado): banner `--state-warn`, "No se pudo leer el archivo: {razón concreta}". Recuperación: "Probar otro archivo" + enlace a formatos compatibles. **Nunca fallo en blanco.**
- `partial`: info `--state-warn` suave "Importado · {n} registros no reconocidos se han conservado" (passthrough).

**3. Autosave / recuperación.** Indicador discreto en la StatusBar (24px): "Guardado" (`--text-disabled`) / "Guardando…" (`--accent`) / "Sin guardar — reintentar" (`--state-warn`). Si falla la cuota/corrupción: toast `--state-warn` "No se pudo guardar (espacio del navegador). Exporta una copia" + acción "Exportar .json". Al cargar un proyecto corrupto: pantalla de recuperación ofreciendo la última copia buena o importar.

**4. Journey de certificación (dogfood, ligero — los pros odian los wizards).** No wizard modal; afordancia sutil de "siguiente paso": tras import con éxito → CTA "Ir al presupuesto"; con presupuesto listo → "Crear certificación". El número grande "Líquido a abonar" es el momento de pago (ya existe). Exportar PDF desde la cert.

**5. Loading.** Carga inicial de Dexie: **skeleton** del árbol + tabla (no pantalla en blanco). Parse de .bc3 grande: progreso con conteo.

**6. Accesibilidad (arquitectural, no pulido — Codex).** Celdas editables: anillo `--accent` 2px, rol `textbox`, navegación teclado entre celdas (Tab/flechas), Enter/Esc (ya). Tarjetas móvil: touch targets ≥44px. Modales/drawer: trap de foco + Esc (ya). **Verificar contraste AA** de `--text-secondary` sobre `--bg-surface` en ambos temas. (Auditoría completa = F8, pero el foco y los roles se diseñan en los componentes desde el inicio.)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | REVIEWED (HOLD SCOPE) | spike validación+legal como GATE pre-F1 (§0.5); 6 decisiones; 0 críticos, 0 sin resolver; defectos de plan corregidos (BASE_PEM/React/round-trip) |
| Codex Review | `/codex review` | Independent 2nd opinion | 4 | REVIEWED | run 1: integer-cents/BC3/cert-first. run 2 (CEO): 18 puntos. run 3 (Eng F1): 2 bugs reales. run 4 (Eng F4 plan, 2026-06-10): 14 problemas; 2 tensiones cross-model reales (encoding de líneas frágil → snapshot; contradictorios → cert-local) + refinó addCert/MedLine.id/%-no-céntimos |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 4 | CLEAR (F4 plan) | run 1 (plan): 6 issues, scope→M1. run 2 (post-F0): 3. run 3 (post-F1): 8 decisiones, 124 tests. run 4 (F4 plan, 2026-06-10): 6 decisiones + 2 tensiones Codex resueltas, 0 sin resolver, 1 crítico cazado (snapshot de cantidad por línea) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | REVIEWED | sistema visual 10/10; estados nuevos de M1 especificados (import/empty/autosave/loading/a11y); DESIGN.md formalizado |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX:** voz externa ejecutada en eng-run-1 y en la revisión CEO (2026-06-08). En CEO: 18 puntos de reto. **Consenso cross-model** (refuerza decisiones): cert-immutability (D3), spike-first sobre el prototipo (D1). **Tensiones resueltas por el fundador:** kill/go criteria del spike → decidir TRAS el spike, no prefijar (D5); cobertura → 100% en la matemática de dinero/cert + fixtures, pragmático en glue (D6). Defectos de plan que Codex cazó y se han **corregido**: #9 `BASE_PEM` (F1 alineado a §0: PEM = Σ partidas = 26.196,66), #10 React 18→19, #8 wording "round-trip" (M1 = fidelidad de import, no round-trip).
- **CROSS-MODEL:** 2 consensos (cert-audit, spike-first), 2 tensiones (kill-criteria, coverage) decididas por el usuario. 0 sin resolver.
- **UNRESOLVED:** 0.
- **POST-CEO (HOLD SCOPE, 2026-06-08):** **D1** spike de validación+legal como gate pre-F1 (§0.5). **D2** HOLD SCOPE (el foso es simple+bonito+flujo, no paridad). **D3** T-2 (inmutabilidad cert) condicional al resultado del spike legal. **D5** criterios kill/go del spike = juicio post-spike. **D6** 100% ramas en `money/medicion/banco/totales/certificacion` + fixtures `.bc3` reales; glue pragmático.
- **POST-F0 (eng run 2):** F0 implementada/revisada; `EditableText` permite vaciar (D2-eng); 15→46 tests. Aplazados en `TODOS.md`: T-5 CI/CD (remoto GitHub ya existe → accionable), T-6 footgun `parseEsNumber`, T-7 trap de foco en Drawer. El motor F1 usa céntimos enteros, NO el `round2` float de `core/money`.
- **POST-F1 (eng run 3, 2026-06-09 — revisión de IMPLEMENTACIÓN, no de plan):** F1 (core/ + store Zustand) revisada y validada. Scope bien dimensionado (5 ficheros, 0 servicios nuevos, CRUD bien diferido a F2). **8 decisiones aplicadas:** D1 `schemaVersion` + `toSerializable/fromSerializable` (honra §0 dec.4); D2 `reset` vía `Object.assign(seedObraData())` (anti-drift DRY); D3 documentar desviación consciente de `onCertEdit` origen (clamp+round2); D4 +2 tests de store (setCurCert, aislamiento); **D6 marcar `precioManual` en seed donde precio≠descompUnit** (evita que el sync de F2 colapse 18,42→9,27 y rompa el PEM); **D7 `precioCuadraDescompuesto` compara en céntimos** (no falsos override por ruido de float); D8 guardas en `setRates` (ignora NaN/negativos/coefK≤0) y clamp en `setCurCert`. 116→**124 tests verdes**, build+lint OK. **0 gaps críticos, 0 regresiones, 0 sin resolver.**
- **CODEX (voz externa F1):** corrió read-only sobre `core/` + `store/`; 7 findings. **Cero contradicción cross-model** con la review interna: **complementaria**, aportó 2 bugs reales que la review interna pasó por alto (#2 seed `precioManual`, #5 float-eq) → ambos corregidos. Resto: #1 cadena recurso→PEM (F2 por diseño → **T-9** nuevo), #3 redondeo medio-céntimo (port verbatim, por diseño), #4 K-multiplicador (T-8 abierto), #7 `parseEsNumber` malformado (ampliado en **T-6**).
- **DESIGN:** sistema visual completo (10/10) formalizado en `DESIGN.md`; estados de M1 especificados.
- **POST-F2 / F4-PLAN (eng run 4, 2026-06-10 — revisión de PLAN de F4):** F2 cerrada (5 commits, 155 tests). F4 reutiliza el motor de F1; review = UI + acciones + 1 cambio de modelo. **Decisiones bloqueadas (ver §Fase 4):** modelo de ejecución por línea = **snapshot `Cert.lineQty`** (no ids — Codex demolió el encoding live, 1 crítico cazado); marca = siempre a-origen; **contradictorios cert-local DENTRO de F4** (des-aplazado: el fundador confirma que sus obras los llevan); `groupBySub`→`core/grouping.ts`; helpers `certChapterRows`/`pctToCantidad` en core; **T-6** endurecer `parseEsNumber` sin sobre-endurecer; troceado en sub-commits como F2. **Voz externa Codex:** 14 problemas, 2 tensiones cross-model resueltas por el fundador (encoding de líneas → snapshot; contradictorios → cert-local), resto adoptado como refinamiento o afinado en `TODOS.md` T-2 (residuo precio-en-vivo, sigue aplazado). 3 regresiones obligatorias capturadas. **0 sin resolver.**
- **DESIGN (F4):** vista UI nueva; el sistema visual (DESIGN.md) ya está completo y F2 no necesitó design-review. `/plan-design-review` opcional para F4 (selector/desplegable/resumen).
- **VERDICT (F4):** **F4 PLAN CLEARED** (Eng run 4 + Codex). F1 + F2 ya cerradas. CEO + ENG + DESIGN CLEARED en fases previas. **Próximo paso: implementar F4.1** (vista lectura + selector + resumen + shape del modelo `MedLine.id`/`Cert.lineQty`). Trabajo diferido en `TODOS.md` (T-2 afinado, T-6 entra en F4, T-7 a F8).
- **POST-F5 / F6-PLAN (eng run 5, 2026-06-10 — revisión de PLAN de F6):** F3/F4/F5 cerradas (211 tests; F5 = Referencia + Importar .bc3). F6 reutiliza el seam de serialización de F1 (`toSerializable`/`fromSerializable`/`loadObra`); review = cableado de persistencia + datos de obra. **Step 0:** scope reducido a F6 sin multi-proyecto, troceado F6.1/6.2/6.3 (el seam ya existe → F6 es wiring, no modelado). **Decisiones bloqueadas (ver §Fase 6):** `idb-keyval` (no Dexie — guardamos un blob, no una BD relacional) con envelope; hidratación gated **pre-render**; persistencia dominio-solo y **solo tras la 1ª mutación** (la demo no se fosiliza); autosave por slice de dominio, armado tras hidratar, cola serializada + flush; **ids únicos `crypto.randomUUID`** (borra los 4 contadores de sesión); **T-7 focus-trap entra en F6.2**. **Voz externa Codex (gpt-5.5):** 16 hallazgos; **cero contradicción de fondo** (coincide en idb-keyval/gated/dominio-solo) y cazó **1 bug de corrupción real** que la review interna subvaloró (rehidratar contadores debía escanear `Cert.lineQty`/extras → cambio a UUID = **Tensión 1-B**) + "persistir-semilla fosiliza la demo" (**Tensión 2-A**); 9 endurecimientos (validación estructural, recuperación de corruptos, UX de fallo IDB, flush, StrictMode, envelope, confirmación+backup de import) **incorporados al plan**. Regresión crítica de ids capturada. 2 TODOs nuevos (**T-10** multi-proyecto, **T-11** UI-restore). **0 sin resolver.**
- **DESIGN (F6):** F6.2 añade el modal Datos de la obra (UI nueva); `DESIGN.md` ya cubre el sistema visual y el prototipo (`app.jsx` ObraModal) es la fuente. `/plan-design-review` opcional para el modal/estados de guardado.
- **VERDICT (F6):** **F6 PLAN CLEARED** (Eng run 5 + Codex). F1–F5 cerradas. **Próximo paso: implementar F6.1** (persistencia idb-keyval + hidratación gated + ids UUID + autosave por slice). Trabajo diferido en `TODOS.md` (T-10 multi-proyecto, T-11 UI-restore; T-7 se cierra EN F6.2).

NO UNRESOLVED DECISIONS
