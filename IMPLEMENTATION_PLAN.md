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
6. **`precio` de partida = override manual, NO autocalculado de la descomposición.** `descompUnit(items)` es informativo (se muestra como "precio descompuesto"); editar `items` no pisa `precio`. Hacer este invariante explícito en el tipo y en los tests.
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

### Fase 1 — Núcleo de dominio (la base crítica)
**Objetivo:** motor de cálculo tipado y testeado + store con datos semilla.
- [ ] `core/types.ts`, `money.ts`, `medicion.ts`, `banco.ts`, `totales.ts`, `certificacion.ts`, `numbering.ts`.
- [ ] `core/seed.ts` (port de `data.js` + `refdata.js`), **sin `BASE_PEM`** (ver §0 decisión 3: `PEM = Σ partidas`).
- [ ] Store Zustand con slices y selectores memoizados (chapterTotals, pem, pec, counts).
- [ ] **Tests unitarios** de §5 (ver criterios).
- **Entregable:** módulo `core/` reutilizable + store que expone los mismos números que el prototipo.
- **Aceptación (tests obligatorios):**
  - `partidaCantidad` con dimensión vacía = factor 1 (p.ej. arena 0/5: `1·14,20 = 14,20`).
  - PEM con seed = **Σ partidas = 26 196,66 €** (sin `BASE_PEM`; ver §0 decisión 3. La antigua constante 28.420,18 incluía el cubo oculto, ya eliminado).
  - `descompUnit` de la partida `p111` (excavación zanjas) coincide con su `precio` mostrado.
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
- [ ] Selector de certificación (histórico con % y líquido + "Nueva certificación").
- [ ] Periodo editable; "Líquido a abonar" grande; toggle **A origen / Esta certificación**; % ejecución global.
- [ ] Tabla por partida con `PctBar`, ejecutada editable (semántica según modo), importe a abonar.
- [ ] Precios contradictorios: botón por capítulo → partida con badge ámbar P.C., código "P.C."/pos "C…", campos editables (título/ud/cantidad/precio) en la propia cert.
- [ ] `CertSummary` (retención % editable, base, IVA, líquido) + `CertChapterSummary` (barras de avance).
- **Aceptación:** el toggle cambia importe mostrado y significado del input; añadir contradictorio aparece marcado y suma al líquido; editar retención recalcula base/IVA/líquido; cert. nº2 usa nº1 como "anterior".

### Fase 5 — Referencia + Importar
- [ ] Panel Referencia: split redimensionable (320–640) si ventana ≥1100, si no overlay. Selector de fuente, buscador, interruptor "Copiar como precio contradictorio".
- [ ] Árbol solo-lectura con checkbox multiselección, desplegar descripción larga + descomposición, botón "←", copiar capítulo entero.
- [ ] Copia: por botón, por **drag&drop** (sobre capítulo/sub del sidebar o área de presupuesto = capítulo activo), por multiselección + "Copiar a {capítulo}". Integra recursos en el banco **sin pisar** los existentes; marca BASE (o P.C.).
- [ ] Vista Importar: zona drop .bc3 + selección + tarjetas de bases compatibles.
- **Aceptación:** copiar una partida con descomposición crea la partida con `med:[]`, items por código, chip BASE, y sus recursos nuevos entran al banco sin sobreescribir los homónimos; drag&drop al sidebar funciona; en <1100 abre overlay.

### Fase 6 — Persistencia + Datos de obra
- [ ] Dexie: esquema de proyecto (chapters, partidas, recursos, certs, rates, notes, obra); autosave con debounce.
- [ ] Export/import de proyecto en JSON; gestión multi-proyecto básica (opcional).
- [ ] Modal Datos de la obra (Obra/Promotor/Constructora/Dirección facultativa, grid 2 col / 1 móvil); alimenta cabecera y exportaciones.
- **Aceptación:** recargar la página conserva todo el trabajo; editar datos de obra actualiza el breadcrumb; export→import reproduce el estado idéntico (números incluidos).

### Fase 7 — Exportadores
- [ ] **PDF** vía print CSS (`.no-print` oculto, estado final visible). Listados: presupuesto y mediciones, CP nº1/nº2, resumen, justificación, mediciones detalladas; y por certificación.
- [ ] **XLSX** (exceljs) — resumen y listados tabulares.
- [ ] **DOCX** (docx) — documentos con datos de obra en cabecera.
- [ ] **BC3 export (FIEBDC-3)** — serializador **propio** (`~V/~C/~D/~T/~M`…, conceptos, descomposición, mediciones) para escribir el .bc3 de la obra completa. El **import ya está hecho en M1** vía la librería `bc3`; aquí solo la escritura (puente de salida constructora→arquitecto). Entonces se valida el round-trip completo. Considerar contribuir el writer upstream (MIT).
- **Aceptación:** PDF imprime sin controles UI; XLSX abre en Excel con números es-ES correctos; un .bc3 de ejemplo (CYPE/BDT) se importa a chapters+partidas+banco y al re-exportarse mantiene coherencia básica (round-trip de los campos soportados).

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
- [ ] **T8 (P2, human ~1h / CC ~10min)** — core/types — Invariante explícito `precio = override manual` (no autocalculado de items).
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
| Codex Review | `/codex review` | Independent 2nd opinion | 2 | REVIEWED | run 1: refuerza integer-cents/BC3/cert-first. run 2 (voz externa CEO): 18 puntos; consenso en cert-immutability y spike-first; tensiones kill-criteria/coverage resueltas por el fundador |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | REVIEWED (post-F0) | run 1 (plan): 6 issues, scope reducido a M1. run 2 (post-F0): 3 decisiones (D1 gate BC3, D2 borrado de campos, D3 tests de primitivas), 0 críticos, 0 sin resolver |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | REVIEWED | sistema visual 10/10; estados nuevos de M1 especificados (import/empty/autosave/loading/a11y); DESIGN.md formalizado |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX:** voz externa ejecutada en eng-run-1 y en la revisión CEO (2026-06-08). En CEO: 18 puntos de reto. **Consenso cross-model** (refuerza decisiones): cert-immutability (D3), spike-first sobre el prototipo (D1). **Tensiones resueltas por el fundador:** kill/go criteria del spike → decidir TRAS el spike, no prefijar (D5); cobertura → 100% en la matemática de dinero/cert + fixtures, pragmático en glue (D6). Defectos de plan que Codex cazó y se han **corregido**: #9 `BASE_PEM` (F1 alineado a §0: PEM = Σ partidas = 26.196,66), #10 React 18→19, #8 wording "round-trip" (M1 = fidelidad de import, no round-trip).
- **CROSS-MODEL:** 2 consensos (cert-audit, spike-first), 2 tensiones (kill-criteria, coverage) decididas por el usuario. 0 sin resolver.
- **UNRESOLVED:** 0.
- **POST-CEO (HOLD SCOPE, 2026-06-08):** **D1** spike de validación+legal como gate pre-F1 (§0.5). **D2** HOLD SCOPE (el foso es simple+bonito+flujo, no paridad). **D3** T-2 (inmutabilidad cert) condicional al resultado del spike legal. **D5** criterios kill/go del spike = juicio post-spike. **D6** 100% ramas en `money/medicion/banco/totales/certificacion` + fixtures `.bc3` reales; glue pragmático.
- **POST-F0 (eng run 2):** F0 implementada/revisada; `EditableText` permite vaciar (D2-eng); 15→46 tests. Aplazados en `TODOS.md`: T-5 CI/CD (remoto GitHub ya existe → accionable), T-6 footgun `parseEsNumber`, T-7 trap de foco en Drawer. El motor F1 usa céntimos enteros, NO el `round2` float de `core/money`.
- **DESIGN:** sistema visual completo (10/10) formalizado en `DESIGN.md`; estados de M1 especificados.
- **VERDICT:** CEO + ENG + DESIGN CLEARED. **Próximo paso ≠ F1 directamente: el spike de validación+legal (§0.5) es el gate.** F0 cerrada; trabajo aplazado en `TODOS.md`.
