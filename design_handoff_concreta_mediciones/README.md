# Handoff: Concreta · Mediciones (software de presupuestos y certificaciones de obra)

## Overview
**Concreta · Mediciones** es una aplicación web para la elaboración de **presupuestos de construcción**, su **resumen económico**, la generación de **certificaciones de obra** (avance por periodos) y la **exportación** de listados. Forma parte del paraguas de marca **Concreta** (mismo sistema visual que el producto hermano "Concreta FEM3D" de cálculo de estructuras): tema oscuro por defecto con opción clara, tipografía Geist, números monoespaciados tabulares y un acento sky‑blue.

Funcionalidad cubierta:
- **Presupuesto**: árbol de capítulos / subcapítulos y tabla de partidas con medición (líneas tipo largo×ancho×alto), descripción y justificación de precios editable (banco de recursos compartido por código).
- **Resumen**: hoja resumen del presupuesto con desglose por capítulos, gastos generales y beneficio industrial editables, IVA seleccionable (10 % reforma / 21 % obra nueva) y observaciones.
- **Certificaciones**: histórico de certificaciones con avance por partida (a origen / en esta certificación), precios contradictorios, retención e IVA, y resumen económico por certificación.
- **Modo Referencia**: panel lateral (split) para abrir una base de precios u otro presupuesto y copiar partidas (con su descomposición) al presupuesto propio.
- **Exportar**: modal para generar listados (PDF/Word/Excel) y el BC3 (FIEBDC‑3) de la obra completa.
- **Datos de la obra**: ficha con emplazamiento, promotor, constructora y dirección facultativa que personaliza los documentos.

## About the Design Files
Los archivos de este paquete son **referencias de diseño construidas en HTML + React (vía Babel en el navegador)**: prototipos que muestran el aspecto y comportamiento deseados, **no código de producción para copiar tal cual**. La tarea es **recrear estos diseños en el entorno del codebase destino** (React/Next, Vue, etc.) usando sus patrones y librerías establecidas. Si no existe aún un entorno, elegir el framework más adecuado (se recomienda **React + TypeScript**, ya que el prototipo está hecho con componentes React) e implementarlo allí.

El CSS de tokens (`concreta/tokens.css`) y los valores de este README **sí** son la fuente de verdad del sistema visual y deben portarse con fidelidad.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado, estados e interacciones son finales. Recrear la UI de forma pixel‑perfect con la librería/ء patrones del codebase. Los tokens son exactos (ver "Design Tokens").

## Arquitectura de la aplicación

Layout raíz (columna, `100dvh`):
1. **TopBar** (48 px): hamburguesa (en compacto) · logo + marca "Concreta" · breadcrumb ("MEDICIONES / Presupuesto · {nombre obra}") · pestañas centrales · acciones (Datos de la obra, tema claro/oscuro, Referencia, Exportar).
2. **Cuerpo** (fila flex): **Sidebar** (286 px, árbol de capítulos + Resumen) + **main** (vista activa) + **panel de Referencia** opcional (split ≥1100 px, si no overlay).
3. **StatusBar** (24 px) en desktop / **BottomTabBar** en móvil.

**Pestañas (vistas):** `Importar` · `Presupuesto` · `Resumen` · `Certificaciones`.

**Breakpoints:** móvil `<760`, tablet `760–1023`, desktop `≥1024`. El sidebar es fijo en desktop y **drawer** (con overlay) en móvil/tablet. El panel de Referencia abre en **split** si la ventana ≥1100 px, si no a pantalla completa. En la vista Presupuesto, cuando el panel de Referencia reduce el ancho útil por debajo de ~780 px, la tabla de partidas conmuta a **tarjetas** (mismo layout que móvil).

---

## Screens / Views

### 1. TopBar (cabecera, 48 px)
- Fondo `--bg-surface`, borde inferior `1px --border-main`, padding `0 14px` (`0 10px` en móvil).
- **Marca**: favicon 21×21 (radio 5) + "Concreta" (15px/600, letter‑spacing −0.01em). Separador vertical 1×18 `--border-main`. Mono caps 11px "Mediciones" + "/" + "Presupuesto" (13/500) + "·" + **nombre de obra** (botón que abre "Datos de la obra"; con icono lápiz 12px a 0.5 opacidad). Partes del breadcrumb se ocultan progresivamente con `.hide-lg/.hide-md/.hide-sm`.
- **Pestañas centrales** (no en móvil): texto 13/500, altura 48, padding `0 13px`; activa = `--text-primary` con subrayado 2px `--accent` (radio superior 2px). Inactiva `--text-secondary`.
- **Acciones** (derecha): botones icono 30×30 (`.icon-btn`) para Datos de la obra (icono building) y tema (sun/moon). Botón "Referencia" (texto + icono split; activo con fondo `--accent-soft` y color `--accent`). Botón primario **Exportar** (altura 32, radio 6, `--accent` / texto `--on-accent`, icono download; en móvil solo icono 36px). Separadores 1×18.

### 2. Sidebar (286 px)
- Fondo `--bg-surface`, borde derecho `1px --border-main`, columna flex.
- **"Toda la obra"**: botón con icono grid 26×26 (radio 6), título 13px, importe mono `{k}` (miles/1000). Activo: fondo `--accent-soft`, borde `1px` accent 30%.
- **Cabecera "Capítulos"** (`.sec-head`) + botón "+" añadir capítulo.
- **Árbol**: cada **capítulo** es un botón (padding `9px 12px`, radio 6): chevron (si tiene hijos) · código mono 11px · título (13px, 600 si activo) · botones "+ subcapítulo" y papelera (aparecen en hover/activo, opacidad) · importe mono `{k}`. Bajo el título, barra de progreso 3px (% sobre PEM) + % mono 10px. Activo: barra lateral izquierda 2.5px `--accent` + fondo `--accent-soft`. Es **drop target** del panel de Referencia (resalta con borde/anillo accent).
- **Subcapítulos** (al expandir): lista indentada con borde izquierdo, filas 28px, código mono 10.5px + título 12.5px + papelera en hover.
- **Resumen** (pie, tarjeta `--bg-elevated`, radio 10): barra de composición apilada (PEM / GG+BI / IVA), filas PEM, "GG + BI (X%)", "PEC s/ IVA" (negrita), IVA (selector desplegable), y **Total** grande (mono 18/600).

### 3. Vista Presupuesto
- **Cabecera de capítulo**: código en chip + nº partidas + "% del PEM" + título H1 (23px/600, −0.02em) a la izquierda; "Importe" (caps 10px) + importe mono 25px a la derecha. Padding `18px 24px 16px` (compacto `13px 16px 12px`).
- **Tabla de partidas** (`.ctable`, min‑width 720): columnas **Nº · Código** (124px) · **Descripción** · **Ud.** (48) · **Cantidad** (96, der.) · **Precio** (92, der.) · **Importe** (110, der.) · **menú ⋮** (40).
  - Fila partida: chevron + (Nº pos mono 12/500 sobre código mono 10.5 disabled) · badge tipo + título editable inline + chips "BASE"/"P.C." si aplica · ud mono · cantidad (derivada de medición) · **precio editable** (mono, click→input) · importe mono 13/600 + barra de peso opcional 3px · menú "⋮" (mover a / eliminar). Click en la fila expande el **panel de detalle**.
  - Separador de subcapítulo: fila `--bg-elevated`, código mono accent + título caps + importe.
  - "+ Añadir partida" al final de cada grupo.
- **Panel de detalle** (al expandir partida, fondo `--bg-elevated`): toggle segmentado **Medición · Descripción · Justificación del precio**.
  - **Medición**: tabla Comentario · Uds · Longitud · Anchura · Altura · **Parcial** (mono accent) · eliminar; cada dimensión vacía cuenta como factor 1; parcial = uds×largo×ancho×alto; pie con "+ Añadir línea" y **Cantidad total** (mono accent). En móvil → tarjetas con campos etiquetados en grid.
  - **Descripción**: textarea editable a ancho completo.
  - **Justificación del precio**: tabla editable Tipo(badge) · Código · Concepto(editable) · Ud(editable) · Rendimiento(editable) · Precio(editable) · Importe · eliminar. **Banco de recursos compartido por código**: editar descripción/ud/precio de un concepto afecta a TODAS las partidas que lo usan; un chip "↔ N" indica en cuántas se comparte. El `%CI` (costes indirectos) se calcula como % sobre el coste directo. Pie "+ Añadir concepto" + "Precio descompuesto".
- En móvil la tabla se sustituye por **tarjetas de partida** (cabecera Nº·código + importe + menú ⋮; título; mini‑grid Ud./Cantidad/Precio; el detalle se expande dentro).
- **Vista "Toda la obra"**: cabecera con total c/IVA; bandas por capítulo + sus tablas.

### 4. Vista Resumen (hoja resumen)
- Fondo `.dot-grid`, centrado max‑width 880.
- Cabecera: "RESUMEN DE PRESUPUESTO" (caps accent) + nombre de obra (H1 25/600).
- Tarjeta hoja resumen: **Desglose por capítulos** (código · título · línea de puntos · % · importe). Línea **PEM** (negrita). Filas editables **Gastos generales** (% editable → importe) y **Beneficio industrial** (% editable → importe). **PEC s/ IVA** (negrita). Fila **IVA** con selector desplegable (10 %/21 %). **Presupuesto base de licitación** (total, mono 23/600).
- Tarjeta **Observaciones y notas**: textarea libre.

### 5. Vista Certificaciones
- Cabecera: **selector de certificación** (desplegable con histórico nº1, nº2, nº3… cada uno con % y líquido + "Nueva certificación") · periodo editable · "Líquido a abonar" grande. Toggle **A origen / Esta certificación**. "% Ejecución global".
- Tabla por partida: Nº·Código · Descripción · Ud · **Ofertada** (presupuestada) · **Ejecutada** (editable; en modo "A origen" es el acumulado, en "Esta certificación" es el incremento que se suma a lo certificado antes) · **% avance** (barra) · Precio · **A origen / Esta cert.** (importe a abonar).
- **Precios contradictorios**: botón "+ Añadir precio contradictorio" por capítulo. Crean una partida marcada con badge ámbar **"P.C."**, borde de aviso y código "P.C." / posición "C…", con título, ud, cantidad ofertada y precio editables en la propia certificación. También se pueden copiar desde la base con el interruptor "Copiar como precio contradictorio" del panel de Referencia.
- **Resumen de la certificación** (tarjeta): PEM presupuesto, PEM certificado a origen (+ barra ejecución global), GG+BI, PEC a origen, certificación anterior, importe esta certificación, **Retención de garantía** (% editable), Base imponible, IVA (selector), **Líquido a abonar**.
- **Resumen por capítulos**: cada capítulo con barra de avance, importe certificado / presupuestado y %.

### 6. Modo Referencia (panel lateral)
- Se abre con el botón "Referencia". Split redimensionable a la derecha (divisor arrastrable, ancho 320–640) si ventana ≥1100 px; si no, overlay a pantalla completa.
- Cabecera "REFERENCIA · COPIAR PARTIDAS" + cerrar. **Selector de fuente** (base de precios / otro presupuesto / CYPE; al final "Importar base de precios… .bc3 FIEBDC‑3"). **Buscador**. Interruptor "Copiar como precio contradictorio".
- **Árbol** solo lectura: capítulos→partidas con código, título, ud, precio; checkbox de multiselección; chevron para desplegar **descripción larga + descomposición**; botón "←" copiar; copiar capítulo entero.
- **Copiar**: por botón "←", por arrastre (drop sobre capítulo/subcapítulo del sidebar o sobre el área de presupuesto = capítulo activo) o multiselección + "Copiar a {capítulo activo}". Se copia código, descripción, ud, precio y **descomposición** (los recursos se integran en el banco sin pisar los existentes). Las partidas copiadas se marcan con chip **"BASE"** (o "P.C." si el interruptor está activo) hasta que se editan.

### 7. Vista Importar
- Zona de drop para archivo **.bc3 (FIEBDC‑3)** + botón seleccionar + tarjetas de bases compatibles (BDT, ITeC, CYPE…).

### 8. Modal Exportar
- Overlay centrado (en móvil hoja inferior). Cabecera "Exportar · Elige el listado y el formato" + botón destacado **BC3 · obra completa** (violeta `--state-mq`) + cerrar.
- Lista de listados: Presupuesto y mediciones, Cuadro de precios nº1/nº2, Resumen de presupuesto, Justificación de precios, Mediciones detalladas — cada uno con chips de formato **PDF / Word / Excel**.
- Sección **Certificaciones de obra**: una fila por cada certificación generada (nº1, nº2…) con PDF / Word / Excel.
- Pie: "PDF imprimible al instante · Word, Excel y BC3 (FIEBDC‑3) generan el archivo descargable."

### 9. Modal Datos de la obra
- Secciones: **Obra** (denominación, emplazamiento, localidad, provincia, ref. catastral, expediente) · **Promotor** (nombre/razón social, NIF/CIF, teléfono, email, dirección) · **Empresa constructora** (empresa, CIF, jefe de obra, teléfono, dirección) · **Dirección facultativa** (técnico redactor, nº colegiado, lugar y fecha de firma). Campos en grid de 2 columnas (1 en móvil). Estos datos personalizan los documentos exportados; la denominación alimenta la cabecera y la hoja Resumen.

---

## Interactions & Behavior
- **Edición inline**: precios, cantidades, descripciones, rendimientos, títulos → click sobre el valor abre un input/textarea con anillo accent; Enter confirma, Esc cancela. Números en formato español (miles con punto, decimales con coma).
- **Medición → cantidad**: la cantidad de una partida es la suma de parciales de sus líneas de medición (uds×largo×ancho×alto, dimensión vacía = 1); si no hay medición, usa un valor fijo.
- **Banco de recursos**: editar un recurso (por código) recalcula todas las partidas que lo usan.
- **Mover/eliminar**: menú "⋮" por partida (mover a otro capítulo/subcapítulo con renumeración automática, o eliminar). Papelera en capítulos/subcapítulos del árbol (con confirmación; al borrar subcapítulo sus partidas suben al capítulo).
- **Certificación a origen vs esta certificación**: el toggle cambia tanto el importe mostrado como el significado del input de cantidad ejecutada.
- **Drag & drop** desde el panel de Referencia al árbol/área de presupuesto.
- **Animaciones**: entrada `fadeUp` (0.3s), drawer slide‑in (0.24s) — siempre con el estado final visible como base (gated en `prefers-reduced-motion: no-preference`) para no romper impresión/PDF.
- **Tema**: atributo `data-theme="dark|light"` en `<html>`; alternable.
- **PDF**: `window.print()`; elementos `.no-print` se ocultan al imprimir.

## State Management
Estado principal (en el componente raíz): `view` (pestaña activa), `active` (capítulo/subcapítulo seleccionado o "__ALL__"), `expanded` (capítulos abiertos), `expandedRows` (partidas expandidas), `partidas` (mapa capítuloId → array de partidas), `chapters` (árbol), `recursos` (banco de recursos por código), `certs` (array de certificaciones) + `curCert` (índice), `ivaRate`, `ggRate`, `biRate`, `notes`, `obra` (datos generales), y flags de UI (`drawerOpen`, `refOpen`, `refSourceId`, `refWidth`, `exportOpen`, `obraOpen`).

Modelo de datos (ver `concreta/data.js` y `concreta/refdata.js`):
- **Capítulo**: `{ id, code, title, children?: [{id, code, title}] }`.
- **Partida**: `{ id, sub?, pos, code, title, ud, cantidad?, precio, desc, med: [línea], items: [recurso], mainType?, fromBase?, contradictorio?, baseSource? }`.
- **Línea de medición**: `{ comment, uds, largo, ancho, alto }`.
- **Concepto/recurso (items)**: `{ code, type: "MO|MQ|MAT|%CI", cantidad }`; descripción/ud/precio se leen del **banco** `recursos[code] = { type, desc, ud, precio }`.
- **Certificación**: `{ id, num, period, retencion, data: { partidaId → cantidadEjecutadaAOrigen } }`. La "anterior" es la certificación previa de la lista.
- **Constantes**: `BASE_PEM`, `GGBI_RATE` (= GG+BI), `IVA_RATE`, `RETENCION_RATE`. Helpers de cálculo: `round2`, `fmtNum`, `fmtEur`, `lineParcial`, `medTotal`, `partidaCantidad`, `partidaImporte`, `itemImporteRec`, `recursoBase`, `descompUnit`.

---

## Design Tokens

### Tipografía
- **Geist Sans** (400/500/600) para UI. **Geist Mono** (400/500) para números, códigos e identificadores — siempre con `font-variant-numeric: tabular-nums`.
- Escala usada: H1 23–25px/600 (−0.02em) · títulos sección `.sec-head` 10px/600 caps (letter‑spacing .11em) · cuerpo 12.5–13px · datos tabla 12–13px · badges 9.5–11px · barra estado 11px mono.
- `.caps` = uppercase + letter‑spacing .09em.

### Colores — DARK (por defecto)
| Token | Hex |
|---|---|
| `--bg-primary` | `#0b1220` |
| `--bg-surface` | `#111a2d` |
| `--bg-elevated` | `#1a2540` |
| `--border-main` | `#22304d` |
| `--border-sub` | `#1a2540` |
| `--text-primary` | `#f8fafc` |
| `--text-secondary` | `#94a3b8` |
| `--text-disabled` | `#475569` |
| `--accent` | `#38bdf8` |
| `--accent-hover` | `#0ea5e9` |
| `--on-accent` | `#04121f` |
| `--state-ok` | `#22c55e` |
| `--state-warn` (retención, P.C.) | `#f59e0b` |
| `--state-mat` (MAT) | `#2dd4bf` |
| `--state-mq` (MQ, BC3, BASE) | `#a78bfa` |
| `--state-neutral` | `#64748b` |
| `--dot` (fondo dot‑grid) | `#22304d` |

### Colores — LIGHT
| Token | Hex |
|---|---|
| `--bg-primary` | `#f8fafc` |
| `--bg-surface` | `#ffffff` |
| `--bg-elevated` | `#f1f5f9` |
| `--border-main` | `#cbd5e1` |
| `--border-sub` | `#e2e8f0` |
| `--text-primary` | `#0f172a` |
| `--text-secondary` | `#475569` |
| `--text-disabled` | `#94a3b8` |
| `--accent` | `#0284c7` |
| `--accent-hover` | `#0369a1` |
| `--on-accent` | `#ffffff` |
| `--state-ok` | `#16a34a` |
| `--state-warn` | `#d97706` |
| `--state-mat` | `#0d9488` |
| `--state-mq` | `#7c3aed` |

- `--accent-soft` = accent al 8–10 % (fondos suaves de selección/hover).
- Badges de recurso (tipo): MO=warn, MQ=mq(violeta), MAT=mat(teal), %CI=neutral; se pintan como `color-mix(tipo 13%, transparent)` de fondo + color del tipo, con un punto de 5px.

### Radios, sombras, espaciado
- **Radios**: botones/inputs 6px, chips 4–5px, tarjetas/paneles 9–12px, badges/píldoras 20px (redondeadas), avatares de icono 6–8px.
- **Sombras**: `--shadow-panel` `0 1px 2px rgba(0,0,0,.3)` (dark) / `…(15,23,42,.05)` (light); `--shadow-float` (popovers/modales/drawer) `0 8px 24px -8px …, 0 2px 6px -2px …`.
- **Alturas fijas**: TopBar 48 · StatusBar 24 · BottomTabBar 54 · botones 30–34 · inputs 34 · icon‑btn 30 · Sidebar 286 · panel Referencia 320–640.
- **Transiciones**: `.t150` 150ms ease‑in‑out (todo); `.tcol` 150ms (color/fondo/borde). Curvas de entrada `cubic-bezier(.22,1,.36,1)`.
- **dot‑grid**: `radial-gradient(circle, var(--dot) 1px, transparent 1px)` con `background-size: 24px`.
- **Breakpoints**: `.hide-lg` <1320 · `.hide-md` <1180 · `.hide-sm` <1080 · `.hide-xs` <480. Móvil <760 / tablet 760–1023 / desktop ≥1024 / split de Referencia ≥1100.

## Assets
- **Fuentes** (en `public/fonts/`, formato woff2): `Geist-Regular`, `Geist-Medium`, `Geist-SemiBold`, `GeistMono-Regular`, `GeistMono-Medium`. Geist es de Vercel (OFL). Usar las mismas o equivalentes con métricas tabulares.
- **Favicon / logo de marca**: `public/favicon.svg` (símbolo viga‑I de Concreta). Reusar el sistema de marca Concreta existente.
- **Iconos**: set propio tipo *lucide* (paths stroke 1.7) definido en `concreta/ui.jsx` (objeto `ICONS`). Equivalen a iconos de **lucide-react**: chevron, chevron-down, upload, list, download, file-text (doc), layers, search, plus, pencil, folder, ruler, grid, check, x, sun, moon, menu, clipboard-check, arrow-left, columns (split), grip-vertical, more-vertical (dots), trash, building, contact (idcard), hard-hat, compass. Recomendado: usar **lucide-react** en el codebase.

## Files (referencia — en el proyecto)
- `Presupuesto Concreta.html` — punto de entrada (carga React+Babel y los scripts).
- `concreta/tokens.css` — **tokens y clases base (fuente de verdad del sistema visual)**.
- `concreta/ui.jsx` — primitivas: `Icon`/`ICONS`, `Badge`, `EditableNum`, `EditableText`, `InlineCreate`, `IvaSelect`, `ContraChip`, hook `useBreakpoint`.
- `concreta/sidebar.jsx` — Sidebar, árbol de capítulos, tarjeta Resumen.
- `concreta/table.jsx` — tabla de partidas, panel de detalle (medición/descripción), tarjetas móviles, menú de partida, chip BASE.
- `concreta/justif.jsx` — justificación de precios editable (banco compartido).
- `concreta/certificaciones.jsx` — vista de certificaciones, histórico, contradictorios, resumen económico.
- `concreta/resumen.jsx` — hoja resumen del presupuesto.
- `concreta/reference.jsx` — panel de Referencia (copiar partidas).
- `concreta/app.jsx` — composición: TopBar, BottomTabBar, StatusBar, modales Exportar y Datos de la obra, estado global y handlers.
- `concreta/data.js` — datos de ejemplo del presupuesto + helpers de cálculo y formato.
- `concreta/refdata.js` — bases de referencia de ejemplo (BDT, presupuesto, CYPE) + descripciones.
- `public/fonts/*` , `public/favicon.svg` — assets.

> Nota: el prototipo usa React vía Babel en el navegador y estado en memoria (sin backend ni persistencia). En producción habrá que añadir capa de datos/persistencia, exportadores reales (PDF/DOCX/XLSX) y un parser/serializador **FIEBDC‑3 (.bc3)**.

## Screenshots
En `screenshots/` (referencia visual de alta fidelidad):
- `01-presupuesto.png` — Presupuesto: árbol + tabla de partidas con panel de detalle (Medición).
- `02-resumen.png` — Hoja Resumen de presupuesto (desglose, GG/BI/IVA, total).
- `03-certificaciones.png` — Certificación: avance por partida, selector de certificación, líquido a abonar.
- `04-referencia.png` — Modo Referencia: base de precios para copiar partidas.
- `05-exportar.png` — Modal Exportar: listados + formatos + BC3 obra completa.
- `06-datos-obra.png` — Modal Datos de la obra.
- `07-tema-oscuro.png` — Tema oscuro (por defecto) de la vista Presupuesto.
