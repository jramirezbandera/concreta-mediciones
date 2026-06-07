# Plan de implementación — Concreta · Mediciones

> Reconstrucción del prototipo de diseño (`design_handoff_concreta_mediciones/`) como
> aplicación de producción en **Vite + React 18 + TypeScript**, con fidelidad
> pixel-perfect al sistema visual Concreta y un motor de cálculo tipado y testeado.

**Estado del documento:** v1 — plan aprobado para arrancar por fases.
**Decisiones cerradas:** Vite SPA · CSS Modules + tokens CSS portados verbatim · persistencia local-first (IndexedDB/Dexie) · backend opcional posterior.

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
| Build | Vite 5 | SPA, sin SSR |
| UI | React 18 + TypeScript (strict) | |
| Estado | Zustand + Immer | Store global con slices por dominio |
| Estilos | CSS Modules + `tokens.css` portado | Variables CSS = única fuente de verdad del design system |
| Iconos | `lucide-react` | Sustituye el set propio `ICONS` |
| Persistencia | Dexie (IndexedDB) | Autosave; export/import JSON de proyecto |
| Formato nº | `Intl.NumberFormat('es-ES')` | Miles con punto, decimales con coma |
| Tests | Vitest + @testing-library/react | Cobertura obligatoria del `core/` |
| Exportadores | `exceljs` (XLSX), `docx` (DOCX), print CSS (PDF) | BC3 = parser propio |
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

interface Rates { iva: number; gg: number; bi: number; }   // p.ej. 0.10, 0.13, 0.06
interface Obra { denominacion: string; direccion: string; localidad: string; /* … promotor, constructor, redactor */ }
```

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
- `partidaImporte(p) = round2(partidaCantidad(p) · (p.precio ?? 0))`

**Banco / justificación** (precio se lee del banco por `code`, fallback a `it.precio`)
- `recursoBase(items, banco) = round2(Σ_{type≠%CI} round2(cantidad · precioBanco))`
- `itemImporteRec(it)`: si `%CI` → `round2(base · cantidad / 100)`; si no → `round2(cantidad · precioBanco)`
- `descompUnit = round2(base + Σ_{%CI} round2(base · cantidad / 100))`
- Editar `desc/ud/precio` de un recurso → afecta a **todas** las partidas con ese `code`. `cantidad` (rendimiento) es por partida.

**Totales de presupuesto**
- `chapterTotal(ch) = Σ partidaImporte`
- `pem = round2(BASE_PEM + Σ chapterTotal)`  (BASE_PEM = aportación de capítulos sin desglosar; en el seed = 2 223,52)
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
- [ ] Scaffolding Vite + React + TS (strict), ESLint/Prettier, Vitest.
- [ ] Portar `tokens.css` + `base.css`; copiar fuentes Geist y favicon.
- [ ] `useBreakpoint`, `useTheme` (data-theme + persist), `useTweaks` (panel dev opcional).
- [ ] Primitivas: `Icon` (lucide), `Badge`, `Bar`, `EditableNum`, `EditableText`, `InlineCreate`, `IvaSelect`, `ContraChip`.
- [ ] Layout shell: `TopBar` (marca, breadcrumb, tabs, acciones), `Sidebar` (vacío), `StatusBar`, `BottomTabBar`, `Drawer` móvil.
- **Entregable:** app con cabecera, tabs que cambian de vista (placeholders), tema claro/oscuro y responsive del chrome.
- **Aceptación:** alternar tema funciona; tabs cambian `view`; topbar colapsa correctamente en cada breakpoint; primitivas renderizan en Storybook o página sandbox; `npm run build` y `npm test` verdes.

### Fase 1 — Núcleo de dominio (la base crítica)
**Objetivo:** motor de cálculo tipado y testeado + store con datos semilla.
- [ ] `core/types.ts`, `money.ts`, `medicion.ts`, `banco.ts`, `totales.ts`, `certificacion.ts`, `numbering.ts`.
- [ ] `core/seed.ts` (port de `data.js` + `refdata.js`), con `BASE_PEM`.
- [ ] Store Zustand con slices y selectores memoizados (chapterTotals, pem, pec, counts).
- [ ] **Tests unitarios** de §5 (ver criterios).
- **Entregable:** módulo `core/` reutilizable + store que expone los mismos números que el prototipo.
- **Aceptación (tests obligatorios):**
  - `partidaCantidad` con dimensión vacía = factor 1 (p.ej. arena 0/5: `1·14,20 = 14,20`).
  - PEM con seed = **28 420,18 €** (Σ partidas 26 196,66 + BASE_PEM 2 223,52).
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
- [ ] **BC3 (FIEBDC-3)** — subproyecto: parser de importación + serializador de exportación (registros `~V`, `~C`, `~D`, `~T`, `~M`, conceptos, descomposición, mediciones). Empezar por **lectura** (Importar) y luego escritura (obra completa).
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

- **BC3/FIEBDC-3** es el mayor riesgo técnico: es un estándar con codificación y gramática propias.
  Tratarlo como subproyecto con su propio set de tests round-trip; no bloquear el resto de fases por él.
- **Banco de recursos compartido**: el invariante más fácil de romper. Modelarlo explícitamente
  (recursos por código en el store; `Item` solo guarda `code/type/cantidad`) y cubrirlo con tests.
- **Tasas como estado, no globals**: eliminar `window.IVA_RATE/GGBI_RATE`. El `core/` recibe `Rates`
  como parámetro puro; nada de mutación global.
- **Redondeo**: respetar `round2` en cada paso intermedio tal como el prototipo (no redondear solo al final),
  o los totales divergirán en céntimos respecto a las capturas.
- **Precisión monetaria**: si en el futuro se requiere exactitud contable estricta, evaluar enteros en
  céntimos; por ahora `round2` reproduce el prototipo y es suficiente.
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
