<!-- /autoplan restore point: "C:\\Users\\javie\\.gstack\\projects\\jramirezbandera-concreta-mediciones\\main-autoplan-restore-20260924-164502.md" -->
## Implementation plan
# Plan · Reordenar, copiar y duplicar líneas de medición

> Estado: BORRADOR (entrada de /autoplan, 2026-09-24).

## Petición

«Me gustaría poder cambiar el orden de las líneas de medición y también copiar una o
varias líneas de medición para llevármelas a otra partida o duplicarlas dentro de la
misma partida.» (captura: partida 2.6 EAV010 «Acero en vigas», Medir por Peso, seis
líneas IPE300 / IPE160 / TIRANTE HEB200 / IPE240 / TUBO 300X150X12 / vacía).

## Qué ya existe (reuso)

- **Líneas de medición**: `MedLine` con `id` estable (`core/types.ts`); el `id` es la
  clave de `Cert.lineQty` (certificación por líneas), así que reordenar debe conservar
  ids y copiar debe dar ids NUEVOS (`nextMedLineId`, `store/base.ts`).
- **Acciones de medición** (`store/slices/estructuraSlice.ts`): `addMedLine`,
  `editMedLine` / `deleteMedLine` (por ÍNDICE), `addMedLines` (lote, aplica
  `pesoDelComentario`), `setMedForma`. Todas pasan por el `set` de immer → quedan en
  Deshacer/Rehacer (`store/temporal.ts`) sin trabajo extra.
- **Reordenar partidas**: `hooks/useReorderDrag.ts` (`useReorderSource` /
  `useReorderTarget`, HTML5 DnD, asa que arma el `draggable`, guía before/after) +
  `reorderPartidaIn` / `movePartidaBy` en el slice + «Subir/Bajar» en el menú ⋮
  (`PartidaMenu.tsx`) para teclado y táctil.
- **Portapapeles de partidas**: `store/clipboardStore.ts` (fuera de `obraStore`,
  sobrevive al cambio de obra), `hooks/usePartidaClipboard.ts` (`copy`, `paste`,
  `useClipboardHotkeys` con Ctrl/⌘+C/V y guardas de `hotkeyGuards.ts`),
  `layout/ClipboardToast.tsx` (aviso «copiada»), chip en `layout/StatusBar.tsx`.
  Ojo: `RefPartida` NO lleva `med`, así que copiar una partida hoy NO copia su medición.
- **Grid de medición**: `DetailPanel.tsx` (tabla, escritorio) y `MedCards.tsx`
  (tarjetas, <780px); navegación `useGridNav` (flechas) + `useMedGridTab`
  (Tab/Enter/Ctrl+Enter) sobre `[data-editgrid]`/`[data-editrow]`/`[data-editfield]`.
- **Ayuda**: `layout/ayudaContent.ts` (`FEATURES`, `shortcutGroups` → grupo «Líneas de
  medición»).

## Cambios

### 1. Store — acciones nuevas por ID (`estructuraSlice.ts`, tipos en `obraStore.ts`)

- `moveMedLine(chapterId, partidaId, lineId, beforeId: string | null)`: saca la línea y
  la inserta antes de `beforeId` (o al final con `null`). Conserva el `id`. No-op si
  `lineId === beforeId` o algún id no existe. `fromBase = false`.
- `moveMedLinesBy(chapterId, partidaId, lineIds: string[], delta: -1 | 1)`: sube/baja un
  bloque de líneas seleccionadas una posición (vía teclado y menú). No-op en el borde.
- `insertMedLines(chapterId, partidaId, lines: MedLine[], afterId: string | null): MedResult`
  (`{ ids, reason? }`; ver obligaciones de ingeniería):
  inserta COPIAS profundas (incluido `expr`) con ids nuevos detrás de `afterId` (o al
  final con `null`); devuelve los ids nuevos (para seleccionar/enfocar lo pegado).
  Aplica `pesoDelComentario` de la forma DESTINO (como `addMedLines`). `fromBase = false`.
- `duplicateMedLines(chapterId, partidaId, lineIds)`: atajo sobre `insertMedLines` que
  copia las líneas indicadas (en su orden de lista) y las pone justo después de la
  última de ellas. Devuelve los ids nuevos.
- `deleteMedLines(chapterId, partidaId, lineIds)`: borrar la selección de golpe.

### 2. Portapapeles de líneas (`clipboardStore.ts`)

- Añadir un segundo contenido, `medLines: { lines: MedLine[]; tsv: string; cut: boolean;
  source: { obraId: string; chapterId: string; partidaId: string; code: string; title: string;
  forma: MedForma; ud: string } } | null`, con `setMedClip`. Copiar líneas guarda un
  snapshot inmutable (copias; al pegar como copia los ids se regeneran).
- Regla «la última copia manda»: copiar líneas vacía `items` (partidas) y viceversa,
  para que Ctrl+V no sea ambiguo.
- `copyTick` sigue disparando el aviso; `ClipboardToast` y el chip de `StatusBar`
  distinguen «3 líneas copiadas (EAV010)» de «EAV010 copiada».

### 3. Selección de líneas (estado efímero de UI, fuera del dominio)

- La selección vive en un store efímero `store/medUiStore.ts` (zustand, fuera del
  dominio y del historial), no en `useState`: sobrevive al cambio tabla ↔ tarjetas y la
  consultan los atajos globales. Se vacía al cambiar de partida abierta o de obra y se
  poda de ids que ya no existan (borrado, deshacer).
- Escritorio: nueva columna estrecha a la izquierda del Comentario con el ASA de
  arrastre y una casilla de selección. Se ven al pasar el ratón, con el foco dentro de la
  fila (`:focus-within`), si hay selección, y SIEMPRE en táctil (`hover: none`, donde el
  asa se oculta porque no hay arrastre). Click = alterna; Shift+click = rango desde la
  última marcada.
- Barra de selección: franja PROPIA y pegajosa; NO sustituye al pie (el pie y la
  «Cantidad total» siguen visibles). Contenido y variantes en las obligaciones de la
  fase de diseño.

### 4. Reordenar arrastrando (escritorio)

- Reusar `useReorderSource` / `useReorderTarget` con `kind: 'medline'` y
  `scope: partidaId` (solo se suelta dentro de la misma partida). Ampliar el tipo
  `ReorderDrag.kind`.
- La guía before/after reusa los estilos de `.row.dropBefore/.dropAfter` adaptados a
  `.medTd`. Soltar llama a `moveMedLine`.
- Arrastrar mueve UNA sola línea (la agarrada), aunque haya selección; los bloques se
  mueven con Alt+↑/↓ o con la barra de selección.

### 5. Teclado

- Con el foco en el grid de medición (celda en reposo, no dentro del input):
  - `Ctrl/⌘+C`: copia las líneas seleccionadas o, si no hay, la línea con el foco.
  - `Ctrl/⌘+V`: pega detrás de la última línea seleccionada; sin selección, detrás de
    la línea con el foco; si no, al final. La misma regla en todas partes (botones incluidos).
  - `Ctrl/⌘+D`: duplica la selección (o la línea con el foco).
  - `Alt+↑ / Alt+↓`: sube/baja la línea con el foco (o la selección) y el foco la sigue.
  - `Espacio` sobre el asa/casilla: alterna la selección de la fila.
- Fuera del grid, con una partida abierta y líneas en el portapapeles: `Ctrl/⌘+V`
  pega al final de la partida abierta (en vez de pegar partidas).
- El manejo se reparte en dos piezas (ver obligaciones de ingeniería): un enrutador
  global `hooks/useMedClipboard.ts` montado en `App` (copiar, cortar, pegar, duplicar, Esc
  y el evento `paste` del documento) y un hook local `hooks/useMedLineKeys.ts` en fase
  de captura sobre `[data-medgrid]` (Alt+↑/↓, Shift+Espacio, Shift+↑/↓).
  `useClipboardHotkeys` cede Ctrl+C/X solo en contexto de medición y Ctrl+V solo cuando
  el portapapeles interno tiene líneas o el foco está en `[data-medgrid]`.

### 6. Móvil / táctil (`MedCards.tsx`)

- Sin menú ⋮ por tarjeta: la casilla de cada tarjeta y la barra de selección son la
  única superficie de acciones (sin arrastre, como las partidas).
- Botón «Pegar N líneas» en el pie de la medición cuando el portapapeles interno tiene
  líneas, en tarjetas Y en la tabla de escritorio.

### 7. Pegar entre partidas con otra «Medir por»

- El dato vive en las cuatro casillas (`uds/largo/ancho/alto`), así que pegar copia
  casilla a casilla (igual que cambiar «Medir por»). Si las formas son INCOMPATIBLES
  (definición en las obligaciones de la fase CEO), un diálogo muestra las columnas de
  origen y destino y la cantidad antes → después, con «Pegar tal cual» / «Cancelar». Si
  son compatibles se pega directamente y el aviso «cantidad A → B» lo cubre.

### 8. Ayuda y descubribilidad

- `shortcutGroups`: filas nuevas en «Líneas de medición» (Ctrl+C/V/D, Alt+↑/↓).
- `FEATURES` «Ordenar a mano» y «Medición por líneas»: mencionar reordenar/copiar
  líneas.
- Tooltips en el asa («Arrastra para cambiar el orden · Alt+↑/↓») y en los botones de
  la barra de selección.

### 9. Tests

- Store: `moveMedLine`, `moveMedLinesBy`, `insertMedLines` (ids nuevos, `expr` copiado
  en profundidad, orden, `pesoDelComentario` en destino peso), `duplicateMedLines`,
  `deleteMedLines`; ids de cert (`lineQty`) intactos tras reordenar; deshacer revierte.
- Portapapeles: copiar líneas vacía partidas y viceversa; pegar en otra partida/obra.
- UI (Testing Library + user-event): seleccionar con click/Shift+click, barra de
  selección, Ctrl+C/V/D y Alt+↑/↓ desde celda en reposo (y NO desde el input), el
  foco sigue a la línea movida, arrastre (dragstart/dragover/drop) reordena.
- `MedCards`: casilla por tarjeta, barra de selección compacta y botón Pegar.

## Archivos (estimación)

Nuevos: `hooks/useMedClipboard.ts` y `hooks/useMedLineKeys.ts` (+tests), `store/medUiStore.ts`,
`core/medPaste.ts`, `features/presupuesto/MedLineRow.tsx`, `features/presupuesto/MedSelectionBar.tsx`,
`features/presupuesto/MedPasteReview.tsx` (diálogo único de revisión), `core/medTsv.ts`,
tests de store y UI. Editados además: `layout/Toast.tsx`, `store/toastStore.ts`,
`hooks/useGridNav.ts`, `styles/tokens.css`.
Editados: `estructuraSlice.ts`, `obraStore.ts`, `clipboardStore.ts`,
`usePartidaClipboard.ts`, `useReorderDrag.ts`, `DetailPanel.tsx`, `MedCards.tsx`,
`Presupuesto.module.css`, `ClipboardToast.tsx`, `StatusBar.tsx`, `ayudaContent.ts`.

<!-- autoplan-accepted:ceo -->
- **Definiciones de contrato:**
  - «Línea certificada»: su `id` tiene `lineQty > 0` en cualquier `Cert` de la obra.
  - «Formas compatibles»: cada casilla NO vacía de las líneas pegadas tiene el mismo rótulo en `medFormaDef(origen).cols` y en `medFormaDef(destino).cols`. Una casilla fuera de la forma usa el rótulo genérico de `medColumnas`.
  - El TSV ajeno no tiene forma de origen, así que no abre el diálogo.
  - «Mover», a efectos de la guarda de certificadas, es SOLO pegar un cortado en OTRA partida. Reordenar (arrastre, Alt+↑/↓, Subir/Bajar) y pegar un cortado en la MISMA partida conservan los ids y no preguntan.
- **Portapapeles del sistema en TSV canónico**, además del interno:
  - Copiar y cortar escriben en `text/plain` filas `Comentario⇥uds⇥largo⇥ancho⇥alto`.
  - Sin cabecera, con coma decimal y sin separador de miles. Se escribe la precisión guardada y el VALOR (no `expr`); una casilla vacía queda vacía.
  - En el comentario, los tabuladores y saltos de línea pasan a espacio. Se antepone `'` si empieza por `=`, `+` o `@`, o si es un número liso.
  - `clipboardStore.medLines` guarda, junto al contenido completo, el TSV exacto escrito, `cut` y la procedencia: `obraId` (`sessionStore.activeId`), `chapterId`, `partidaId`, código, título, forma efectiva y ud.
  - Módulo puro nuevo `core/medTsv.ts` (serializar, normalizar, parsear), con tests.
- **Leer TSV al pegar:**
  - Normalizar antes de comparar o parsear: CRLF → LF, quitar el salto final y las celdas y filas vacías del final.
  - Quitar las comillas envolventes y el `'` inicial.
  - Con 5 celdas, la 1.ª es siempre el comentario. Con ≤4, la 1.ª es el comentario salvo que sea un número liso (`parseEsNumber`); entonces todas son casillas desde uds. Más de 5 celdas: se rechaza.
  - Las casillas se leen con las reglas de teclear en la celda (`toDecimalComma` + `leerCelda`: operaciones y perfiles).
  - Una cifra con forma de miles y sin coma (`/^\d{1,3}(\.\d{3})+$/`) es ambigua y se rechaza.
  - Una celda ilegible o ambigua rechaza el pegado entero, con un aviso que dice fila y columna. Máximo 500 filas.
  - Tests:
    - ida y vuelta Concreta → TSV → Concreta idéntica, salvo `expr`;
    - una fila «IPE300⇥2⇥9,50» en una partida medida por Peso rellena el kg/m;
    - rechazo con fila y columna, rechazo de «1.234», «9.50» = 9,5, CRLF y filas vacías finales, límite de 500;
    - prefijo `'` al exportar y su retirada al pegar; un comentario numérico hace la ida y vuelta.
- **Qué manda al pegar con teclado:**
  - Se usa el `text/plain` normalizado del evento `paste`: si coincide con el TSV guardado → contenido completo; si coincide con `consumedTsv` → no-op y aviso «Esas líneas ya se movieron»; si es otro texto → TSV ajeno, que además cancela un cortado pendiente; sin texto → nada.
  - Mecanismo:
    - en el `keydown` de Ctrl/⌘+C y Ctrl/⌘+X se guarda en el portapapeles interno y se llama a `navigator.clipboard.writeText(tsv)` dentro del gesto;
    - en el `keydown` de Ctrl/⌘+V se pone una marca; si en `setTimeout(0)` no llegó ningún `paste`, se pega del portapapeles interno.
  - Botones:
    - «Copiar» y «Cortar» (barra y móvil) guardan en el interno y llaman a `writeText` como mejor esfuerzo; si falla, no avisan;
    - «Pegar N líneas» usa solo el interno.
  - Copiar líneas vacía `items` (partidas), y viceversa.
  - Tests de las dos órdenes del respaldo con fake timers, y de cada rama de la resolución.
- **Ctrl/⌘+C, X y V nunca copian ni pegan partidas** con el foco dentro del grid de medición (celda en reposo, asa o casilla de selección): `useClipboardHotkeys` ni actúa ni llama a `preventDefault` ahí.
  - Dentro del input de edición, copiar y pegar siguen siendo los nativos.
  - Test: Ctrl+C en una celda en reposo de la medición no cambia `clipboardStore.items`.
- **Cortar** (Ctrl/⌘+X y botón «Cortar» de la barra de selección) mueve al pegar dentro de la misma obra:
  - Cortar no quita nada: atenúa las líneas mientras dure y las deja en el portapapeles.
  - Pegar en la misma obra llama a una acción nueva `moveMedLinesTo(srcChapterId, srcPartidaId, lineIds, dstChapterId, dstPartidaId, afterId)`. En UN `set` (un paso de Deshacer) inserta el contenido ACTUAL de esas líneas y las borra del origen.
  - Misma partida → conserva los ids. Otra partida → ids nuevos.
  - Las líneas que ya no existen se omiten; si no queda ninguna, se pega la instantánea como copia, con aviso.
  - Tras pegarlo, el portapapeles interno se vacía y su TSV pasa a `consumedTsv`.
  - En otra obra se pega como copia sin tocar el origen, con aviso; el cortado pasa a copia normal y pierde la marca.
  - Esc en la medición, o una copia nueva, cancelan el cortado.
  - Tests de cada rama, incluido cortar-pegar-Deshacer restaurando las dos partidas.
- **Diálogo al pegar entre formas INCOMPATIBLES** (componente `Modal` existente): muestra las columnas de origen y de destino y la cantidad del destino antes → después, con «Pegar tal cual» y «Cancelar». Cancelar no cambia nada.
  - Tests: Peso → Superficie abre el diálogo; Longitud → Superficie no; el TSV ajeno no.
- **Aviso tras pegar, duplicar o mover** (reusa `toastStore` con acción): «N líneas pegadas en <código> · cantidad A → B <ud>», y «cantidad fija A → medida B» si el destino no tenía líneas.
  - Su «Deshacer» solo ejecuta `undo()` si el historial de dominio no ha cambiado desde esa acción; si cambió, el aviso se descarta.
  - Tests: el texto de fija → medida; Deshacer después de otra edición no deshace la edición ajena.
- **Guarda de líneas certificadas:** borrar líneas certificadas, y moverlas por cortar a otra partida, pide confirmación con cuántas son y en qué certificaciones («2 de 5 líneas están certificadas en C1 y C3»). Sin confirmar, no cambia nada.
  - Se aplica a la X de una sola línea (cambio de comportamiento documentado) y al borrado en bloque.
  - Una línea sin certificar se sigue borrando sin diálogo.
  - Tests de confirmar, de cancelar y del caso sin certificar.
- **Selección múltiple también en móvil:** casilla en cada tarjeta de `MedCards`, la misma barra (Copiar, Cortar, Duplicar, Subir, Bajar, Eliminar, quitar selección) y el botón «Pegar N líneas».
- **Arrastrar mueve UNA sola línea** (la agarrada), aunque haya selección. Los bloques se mueven con Alt+↑/↓ o con la barra.
- **Semántica de la selección:**
  - Alt+↑/↓ con una selección no contigua mueve cada línea una posición, y el bloque entero se detiene en el borde.
  - Dónde pega: con selección, detrás de la última seleccionada; con el foco en una fila, detrás de ella; si no, al final.
  - Tras pegar o duplicar, las líneas nuevas quedan seleccionadas.
  - La selección se poda de ids que ya no existen (test tras Deshacer).
- **«Pegar N líneas» en el estado vacío** de la medición (tabla y tarjetas) cuando el portapapeles interno tiene líneas.
- **Las acciones nuevas de medición devuelven los ids afectados** (vacío si no hacen nada). La UI avisa «No se pudo pegar: la partida ya no existe» cuando no hay ninguno.
- **TODOS.md, al aprobar:**
  - copiar/duplicar partida con su medición (P2);
  - instantánea del comentario y las dimensiones al certificar por líneas (P2);
  - mediciones vinculadas (P3);
  - cantidad fija → primera línea (P3);
  - pegar sobrescribiendo celdas (P3).
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- **Capas y pie:**
  - El pie de la medición conserva siempre «Añadir línea», «Pegar N líneas» (cuando toque) y la cantidad.
  - Sin líneas y con cantidad fija, la cantidad dice «Cantidad fija A ud»; con líneas, «Cantidad total B ud».
  - La barra de selección NUNCA sustituye al pie.
- **Barra de selección** (`MedSelectionBar`): franja propia `position: sticky; bottom: 0` dentro del contenedor con scroll, encima de la StatusBar. En móvil va sobre la BottomTabBar, con `env(safe-area-inset-bottom)`.
  - Escritorio: «N líneas · Σ <suma de parciales> <ud>» + Copiar · Cortar · Duplicar · Subir · Bajar · Eliminar (en `--state-danger`) + ✕ quitar selección.
  - Subir y Bajar se deshabilitan cuando la selección toca el borde.
  - Móvil (<760): recuento y Σ + Copiar + «Más» (Cortar, Duplicar, Subir, Bajar, y Eliminar en rojo separado) + ✕. Son botones de icono con `aria-label` y áreas táctiles de 44 px que no se solapan.
  - Orden de apilado de abajo arriba: BottomTabBar, barra, aviso.
- **Pegar con ratón:**
  - «⧉ Pegar N líneas» siempre en el pie (tabla Y tarjetas) mientras el portapapeles interno tenga líneas. Tooltip: «N líneas de <código> · medidas por <forma> · Ctrl+V».
  - Si hay destino, el texto añade en gris «tras «<comentario>»».
  - Si el portapapeles tiene un cortado de la misma obra, el botón dice «Mover N líneas aquí». Si viene de otra obra, «Pegar N líneas como copia».
  - El botón fija el destino (selección → foco → final) en `pointerdown`, antes de que el foco lo deje.
- **Destino del pegado**, única regla para teclado y botones: detrás de la última línea seleccionada; sin selección, detrás de la línea con el foco; si no, al final.
- **Táctil**, `@media (hover: none)`, con independencia del ancho: la casilla de selección y la X de borrar se ven SIEMPRE (esto arregla también la X que hoy es invisible en tablet) y el asa de arrastre se oculta.
  - Los textos de ayuda, del estado vacío y de los tooltips usan `isTouchOnly()`.
  - Tarjetas (`MedCards`): casilla + comentario + X. Se quita el menú ⋮ por tarjeta y la barra es la única superficie de acciones.
- **Selección:**
  - Se guarda en `DetailPanel`, así que sobrevive al paso de tabla a tarjetas.
  - Entrar a editar una celda, o hacer click en una fila fuera de la selección, la vacía.
  - `dragstart` también la vacía (el arrastre mueve una línea).
  - Tras pegar o duplicar, las líneas nuevas quedan seleccionadas.
  - Estilo: fondo `--accent-soft` + el inset de acento de `.row.selected`, compatible con la guía de arrastre y con el cortado.
- **Casilla y asa:**
  - La casilla reutiliza el patrón `lineCheck` (`button role="checkbox"`, `aria-checked`, `aria-label` «Seleccionar línea: <comentario>»), con `tabIndex=-1` para no romper el Tab de hoja de cálculo.
  - Se ven con `:hover`, con `:focus-within` de la fila, con selección y en táctil.
- **Teclado:**
  - `Shift+Espacio` en una celda en reposo alterna la selección de su fila.
  - `Shift+↑/↓` amplía la selección desde la fila ancla y mueve el foco.
  - `Alt+↑/↓` mueve las líneas.
  - `useGridNav` ignora los eventos con Alt, Ctrl o Meta.
  - El hook de medición consume cada evento una sola vez (`stopPropagation`).
  - Funciona también en las tarjetas.
- **Foco tras cada acción:**
  - Borrar: la misma columna de la fila siguiente; si no hay, la anterior; si la lista queda vacía, «Añadir línea».
  - Pegar o duplicar: el comentario en reposo de la primera línea nueva, con `scrollIntoView({ block: 'nearest' })`.
  - Subir o Bajar desde la barra: el foco sigue en el botón y la barra sigue abierta.
  - Alt+↑/↓: el foco sigue a la línea.
  - Al cerrar un diálogo: se sobrescribe el foco que `Modal` devuelve para aplicar estas reglas.
  - Tras Deshacer: la primera línea afectada si existe; si no, la primera fila; si no, «Añadir línea».
- **Esc**, por orden: overlay abierto → edición de celda → selección → cortado pendiente (aviso «Corte cancelado») → lo que ya existía (cerrar la partida). El hook de medición consume el Esc que usa, para que `useAppHotkeys` no cierre la partida.
- **Cortado visible:** contorno discontinuo `1px dashed var(--accent)` en las filas o tarjetas cortadas, más la etiqueta de texto «cortada». NO se usa opacidad. Siguen editables.
  - Chip en la StatusBar: «N líneas cortadas · <código> <título>», con ✕ para cancelar.
  - En móvil, el botón «Mover N líneas aquí» y un enlace «Cancelar corte» en el pie.
- **Avisos:**
  - Un único hueco: los avisos de copiar y cortar pasan por `toastStore` (o `ClipboardToast` se oculta cuando `Toast` muestra), así que nunca hay dos a la vez.
  - `toastStore.show` admite `tone: 'ok' | 'warn' | 'error'`, con icono (check / alerta) y color (`--accent` / `--state-warn` / `--state-danger`).
  - El texto puede ir en dos líneas (sin `nowrap`) y el botón de acción no encoge.
  - Mientras tenga el ratón encima o el foco, el aviso no se cierra.
  - El aviso con Deshacer se cierra en cuanto cambia el historial de dominio, así que nunca se muestra un Deshacer que ya no sirve.
  - En compacto, los textos se acortan («3 líneas pegadas · 1.234,56 → 2.469,12 kg»).
  - Reordenar nunca muestra aviso: se anuncia por `aria-live`, «Línea movida a la posición 3 de 6».
- **Errores de pegado en línea:** el TSV rechazado muestra una franja `role="alert"` en `--state-danger` bajo la tabla o tarjetas, con fila, columna, valor y corrección. Se va al pulsar ✕ o al pegar bien.
  - Ejemplos: «No se pudo pegar: fila 3, Largo «1.234» es ambiguo. Pégalo sin separador de miles»; «Solo se pegan hasta 500 filas»; «Fila 2: 6 columnas; admite comentario y 4 casillas».
  - Los demás motivos se distinguen, cada uno con su texto: sin destino → «Abre una partida para pegar las líneas»; partida inexistente → «No se pudo pegar: la partida ya no existe»; portapapeles vacío → nada; borde de Subir/Bajar → botón deshabilitado.
  - Las acciones del store devuelven `{ ids, reason }` para que la UI sepa cuál aplicar.
- **Diálogo único de revisión** (`MedPasteReview`, sobre `Modal`; en compacto, hoja inferior). Reúne en UNA confirmación cada problema que exista:
  - **Formas incompatibles.** Título «Esta partida se mide de otra forma». Origen «<código> · <forma> · <cols> · <ud>» → destino «<código> · <forma> · <cols> · <ud>». Las casillas cuyo significado cambia van en `--state-warn` (p. ej. «kg/m → Anchura»). Texto «Se reinterpretan las cifras; no se convierten unidades». Cantidad Y importe del destino antes → después, ya calculados con el perfil del comentario.
  - **Líneas certificadas.** Las afectadas por comentario (hasta 5, luego «y N más») y las certificaciones (C1, C3). Texto «Lo ya certificado se queda en <código origen>; las líneas en destino empiezan sin certificar» (al mover) o «La certificación conserva su importe, pero no verá la línea» (al borrar).
  - **Líneas del cortado que ya no existen.** «Mover las M restantes», o «Pegar la copia guardada» si no queda ninguna.
  - Acción principal única y específica: «Pegar tal cual», «Mover N líneas» o «Eliminar N líneas» (en rojo al borrar). El foco inicial va a Cancelar. Cancelar no cambia nada.
  - Sustituye, en la obligación CEO de Cortar, el «se omiten con aviso / se pega la instantánea como copia con aviso»: ahora lo decide el usuario en este diálogo.
- **Aviso al mover:** incluye origen y destino, «3 líneas movidas · EAV010 2.817,23 → 520,00 · EAV011 0,00 → 2.297,23 kg». Si el origen se queda sin líneas y tenía cantidad fija, lo dice.
- **Pegado con teclado sin carrera de tiempos** (sustituye el respaldo `setTimeout(0)` de la obligación CEO):
  - Ctrl/⌘+V pega SOLO con el evento `paste` real.
  - Si a los 500 ms del keydown no ha llegado ninguno y el portapapeles interno tiene líneas, aparece la pista «Pulsa «Pegar N líneas» para pegar lo copiado en Concreta». Es solo una pista: nunca cambia datos.
  - Test con fake timers: el `paste` llega tarde (sigue pegando una sola vez) y no llega nunca (solo la pista).
- **Copiar al sistema:** si `writeText` rechaza, aviso en tono advertencia «Copiado en Concreta; no disponible para Excel» (sustituye el «si falla, no avisan» de la obligación CEO).
  - `consumedTsv` se vacía con cualquier copia o cortado interno nuevo, así que solo bloquea el mismo TSV de un cortado ya pegado.
- **Ctrl/⌘+V con líneas en el portapapeles**, foco fuera del grid y una partida abierta: pega en esa partida y, si estaba en Descripción o Justificación, cambia a la pestaña Medición, para que el cambio se vea.
  - Sin partida abierta: aviso «Abre una partida para pegar las líneas».
  - Ctrl/⌘+D solo actúa con el foco en reposo (dentro de un input manda el navegador). La ayuda dice «Ctrl+D duplica la línea (no rellena hacia abajo)».
- **Iconos:** se añaden a `Icon.tsx` los de lucide para cortar y pegar si faltan (`scissors`, `clipboardPaste`).
- **Tests de UI:**
  - render bajo `(hover: none)` simulado con `matchMedia` → casillas y X visibles, asa ausente;
  - barra en compacto con «Más»;
  - foco tras borrar, pegar y Deshacer;
  - orden de Esc (la selección se vacía antes de cerrar la partida);
  - un solo aviso visible tras Ctrl+C seguido de Ctrl+V;
  - aviso de error con tono `error` y franja en línea;
  - el Deshacer del aviso desaparece tras otra edición;
  - `aria-live` al mover;
  - diálogo de revisión con formas incompatibles + certificadas a la vez.
- **Verificación visual** a 360 px y alrededor de 780 px de ancho útil con `/design-review` tras implementar.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:eng -->
- **Precedencia:** si dos obligaciones se contradicen, manda la de la fase posterior (ingeniería > diseño > CEO). Este bloque sustituye explícitamente lo que se indica en cada punto.
- **Etapas, en el mismo plan y con commits ordenados:**
  - **Etapa A:**
    - acciones de store con cortes de historial;
    - `medUiStore` y el enrutador;
    - reordenar (arrastre, Alt+↑/↓, barra) y duplicar;
    - copiar y pegar con el portapapeles INTERNO;
    - diálogo de revisión (formas y certificadas);
    - barra, avisos, foco/Esc y táctil.
  - **Etapa B:** TSV del sistema (Excel ↔ Concreta) y Cortar/mover, si el gate los mantiene.
  - La Etapa A se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`) antes de empezar la B.
- **Historial** (`store/temporal.ts`):
  - Se añade `historyCheckpoint()`, que cierra la ventana de agrupado (`throttleUntil = 0`).
  - Se añade un contador monótono `domainRevision`, que sube con CADA cambio de dominio registrado (también los agrupados), expuesto con `getDomainRevision()`.
  - Las acciones estructurales de medición (pegar, duplicar, mover por cortar, borrar en bloque, reordenar) llaman a `historyCheckpoint()` antes y después: cada una es exactamente UN paso de Deshacer y nunca se funde con una edición contigua.
  - El Deshacer del aviso guarda la revisión tras la acción y solo actúa si `getDomainRevision()` no ha cambiado.
  - Tests: editar → pegar a <700 ms → Deshacer revierte solo el pegado; pegar → editar a <700 ms → el aviso ya no ofrece Deshacer.
- **Acciones del store:** van por id y devuelven `MedResult = { ids: string[]; reason?: 'no-partida' | 'no-lines' | 'noop' | 'stale' }` (sustituye `string[]` y el «vacío si no hacen nada»).
  - Un no-op (soltar en el sitio, Subir en el borde) sale antes de tocar el estado: sin entrada de historial, sin autosave y sin `fromBase = false`.
  - Un helper interno único construye las líneas (clon profundo con `expr`, id nuevo y `pesoDelComentario` del destino) para `addMedLines` e `insertMedLines`.
  - La partida de origen de un cortado se busca por `partidaId` en todo `PartidasMap`, no por el `chapterId` guardado.
  - Tests de cada acción: no-op sin entrada de Deshacer y conservando BASE; origen movido de capítulo.
- **Operación preparada:** módulo puro `core/medPaste.ts` con `prepararPegado(...)`, que devuelve:
  - líneas finales (tras `pesoDelComentario`);
  - compatibilidad (casillas que cambian);
  - certificadas y faltantes;
  - cantidad e importe antes y después del destino (y del origen al mover);
  - destino resuelto.
  - La MISMA estructura alimenta el diálogo y la acción de store.
  - La acción revalida dentro del `set` (partidas existentes, ids de origen presentes, contenido igual). Si algo cambió, devuelve `reason: 'stale'` y la UI vuelve a preparar y a mostrar el diálogo.
  - Diagrama ASCII del flujo en el propio módulo.
- **Compatibilidad** (sustituye la definición CEO). Es incompatible si:
  - (a) una casilla no vacía cambia de rótulo;
  - (b) una casilla no vacía cae fuera de las columnas de la forma destino;
  - (c) la ud normalizada difiere (minúsculas, sin punto final, `m2`→`m²`, `ml`→`m`).
  - El TSV ajeno solo se evalúa con (b).
  - Tests: Longitud→Unidades (b), m→m² (c), Peso→Peso (compatible).
- **Destino de un cortado pegado en la misma partida:**
  - El ancla se traduce sobre el orden ORIGINAL a la línea anterior más cercana que NO se mueve; si no hay ninguna, al principio.
  - Si el orden queda igual, es un no-op: no consume el cortado ni da error.
  - Tests: ancla dentro del bloque, selección no contigua, todas seleccionadas.
- **Estado de UI:** `store/medUiStore.ts` (zustand, efímero, fuera de `DOMAIN_KEYS`) con `{ partidaId, tab, selected, anchorId, lastFocusedLineId, pendingFocus, cut }`. Sustituye la selección en `DetailPanel` del bloque de diseño.
  - Se reinicia al cambiar `openPartidaId` y en `loadObra`/reset.
  - Se poda contra las líneas actuales tras cada cambio, también al deshacer.
  - `DetailPanel` lee `tab` de ahí.
  - Test: cruzar el punto de corte tabla ↔ tarjetas con el árbol real de `Partidas` conserva la selección y la pestaña.
- **Marcadores:** el contenedor de la medición (tabla y tarjetas) lleva `data-medgrid`, además de `data-editgrid`. Las filas de la tabla pasan a un componente `MedLineRow` con `data-lineid`.
  - Test de regresión: Ctrl+C en una celda de la FILA de partida sigue copiando la partida.
- **Enrutador de portapapeles:** `hooks/useMedClipboard.ts`, montado UNA vez en `App` e independiente de la pestaña.
  - **Contexto de medición:** foco dentro de `[data-medgrid]`, O selección activa en `medUiStore` para la partida abierta.
  - Con contexto, Ctrl/⌘+C, X, D y Esc actúan sobre líneas (Esc según el orden de diseño). Respeta `isTextEditingTarget`, `hasBlockingOverlay`, `hasNativeSelection` y la vista presupuesto.
  - **Pegar:** escucha el `paste` del documento. Con una partida abierta y el foco fuera de un campo de texto, resuelve líneas.
  - `useClipboardHotkeys` cede Ctrl+C/X solo con contexto de medición, y Ctrl+V solo cuando el portapapeles interno tiene líneas o el foco está en `[data-medgrid]`. En esos casos no llama a `preventDefault`.
  - `useAppHotkeys` no cierra la partida con Esc si `medUiStore` tiene selección o un cortado.
  - Tests de regresión: Ctrl+V con partidas en el portapapeles sigue pegando partidas; flechas sin modificador siguen navegando.
- **Foco en macOS:** en `pointerdown` de la casilla, el asa o la barra, el foco pasa explícitamente a la fila (`tabIndex=-1`) o a la barra. Los atajos consultan `medUiStore`, no solo el foco.
  - `lastFocusedLineId` se registra con `focusin`, así que el botón «Pegar» lo usa también si se activa desde el teclado.
  - Verificación manual en Safari y Firefox de macOS (plan de pruebas).
- **Teclas locales:** `hooks/useMedLineKeys.ts` en fase de CAPTURA (`onKeyDownCapture`) sobre `[data-medgrid]`.
  - Gestiona Alt+↑/↓, Shift+Espacio y Shift+↑/↓. En Shift+Espacio llama a `preventDefault` en keydown y keyup, para que ni `MedNum` ni `MedComment` abran el editor.
  - `useGridNav` ignora los eventos con Alt, Ctrl, Meta o Shift y los que traen `defaultPrevented`. Esto aplica también al `gridNav` exterior de `PartidasTable`.
  - Tests: Shift+Espacio en el comentario y en una celda numérica selecciona sin abrir el editor; Shift+↓ mueve el foco una sola vez.
- **Copia al sistema** (Etapa B):
  - Va por los eventos `copy`/`cut` del documento con `clipboardData.setData('text/plain', tsv)`, más un tipo propio `application/x-concreta-medlines` con el id de la copia o del cortado. Es síncrono y funciona en http.
  - Respaldo: `navigator.clipboard?.writeText(tsv)`, comprobando antes que exista.
  - Si ninguna vía confirma, `sysClipOk = false`, aviso de advertencia, y el siguiente pegado usa el portapapeles interno aunque el texto del sistema sea otro. Sustituye el mecanismo `keydown`+`writeText` de CEO y diseño.
  - Tests: `writeText` indefinido (http) y rechazado, seguidos de Ctrl+V.
- **Autoridad de un cortado** (Etapa B; sustituye la comparación solo por texto):
  - El movimiento solo se ejecuta si el pegado trae el tipo propio con el id del cortado pendiente, o si se lanza desde los botones internos.
  - Si solo coincide el texto, el diálogo pregunta: «Mover las líneas cortadas de <código>» o «Pegar una copia».
  - `consumedTsv` pasa a guardar el id: solo bloquea si coincide el id; con solo texto, pregunta.
- **Identidad de obra para Cortar:** un token de documento en memoria, creado en `loadObra`/hidratar/reset. No se usa `sessionStore.activeId`, que es null en la demo hasta el primer guardado.
  - Test: cortar → primera edición y guardado de la demo → pegar = mover.
- **TSV, lectura** (Etapa B; sustituye las reglas CEO donde choquen):
  - La normalización para COMPARAR va aparte del parseo.
  - El parseo usa un separador que respeta las comillas de Excel (campos entre comillas con saltos de línea, tabuladores y `""`).
  - Solo se quitan las filas vacías del final, no las celdas.
  - Una celda que empieza por `'` es SIEMPRE texto (se quita un `'`).
  - La disposición se decide UNA vez para todo el bloque: la 1.ª columna es el comentario si alguna fila tiene texto no numérico en la 1.ª celda.
  - Números, por token. Se rechazan:
    - celdas con coma y punto donde el punto va detrás de la coma («1,234.56»);
    - celdas con más de una coma;
    - tokens con forma de miles y sin coma, también con signo o dentro de operaciones («-1.234», «1.234+2»), salvo `0.ddd`.
  - Valores, parciales, total e importe tienen que ser finitos.
  - Topes: texto ≤ 200 000 caracteres, casilla ≤ 200, comentario ≤ 1 000. El parseo va en try/catch y un fallo muestra la franja de error.
  - Tests:
    - «'123⇥⇥⇥⇥» vuelve como comentario;
    - `'` literal;
    - comentario entre comillas con salto de línea;
    - «1,234.56», «-1.234», «1.234+2», «0.125» y «1e400»;
    - bloque mixto;
    - 50 000 «(».
- **TSV, escritura** (Etapa B): prefijo `'` en los comentarios que empiezan por `=`, `+`, `-`, `@`, `'`, TAB o CR, o que son un número liso (sustituye la lista CEO). Verificación manual en Excel y Google Sheets de que el `'` no se ve.
- **Texto de la guarda de certificadas** (sustituye el texto de borrar del bloque de diseño):
  - Al borrar: «La certificación conserva la cantidad (aparece como «línea eliminada»), pero se pierden su comentario y sus dimensiones».
  - Test de regresión: tras borrar una línea certificada, `CertDetail` sigue mostrando la fila «Línea eliminada…» con su cantidad y su casilla para desmarcar.
  - Una partida certificada a mano (sin `lineQty`) no activa la guarda, porque su cantidad no depende de las líneas. Queda documentado.
- **Aviso existente roto:** `Toast.tsx` deja de mostrarse (y cancela su temporizador y su acción) cuando se llama a `toastStore.clear()` o cambia el mensaje. Test de render tras `clear()`, `undo()` y `loadObra`.
  - Test de regresión: los avisos «Deshacer» de borrar partida y «copiada» siguen apareciendo.
- **`Modal`** acepta `initialFocus`. El foco de cierre se fija después de que `Modal` restaure `prevFocus`.
- **Táctil:** una sola fuente, `isTouchOnly()`, decide en JS la clase que muestra la casilla y la X y oculta el asa. Así se puede probar en jsdom con `matchMedia` simulado. Sustituye el `@media (hover: none)` de diseño como fuente de verdad.
- **Barra:** usa el mismo `compact` que las tarjetas (ancho útil < 780), en lugar del viewport < 760. Va FUERA de `.medWrap`, que tiene `overflow: hidden`. El estilo `lineCheck` pasa a un CSS compartido.
- **Aviso al mover:** muestra la ud de cada partida por separado.
- **Asistente de IA:** `borrar_linea` del ejecutor sigue borrando sin la guarda nueva, porque la confirmación es la aprobación de la propuesta en `PropuestaCard`. Queda documentado en el código.
- **Diagramas ASCII en el código:** `core/medPaste.ts` y `hooks/useMedClipboard.ts`. Actualizar la cabecera de `useReorderDrag.ts` (tipo `'medline'`).
- **TODOS.md** queda escrito en esta fase con los aplazados de todas las fases (sustituye «al aprobar» del bloque CEO).
<!-- /autoplan-accepted:eng -->
## Review record

### Fase 1 · CEO · SELECTIVE EXPANSION (autoplan, 2026-09-24)

**Auditoría del sistema.**
- **Estado del repo.** `main` limpio (e4ddd2f), sin trabajo en curso.
- **Últimos 30 días.**
  - Pase de diseño móvil (FINDING-001…018).
  - Medición con operaciones y perfiles: 1aa8ad5, 411d6b2, ec330b1.
  - `908461b`: el borrador de una celda sobrevive al Alt+Tab. Esto importa si se reordena con una celda abierta.
- **TODOS.md.** Solo T-19 (pestaña de solo lectura) toca esto de refilón: reordenar o pegar ahí mutará en memoria igual que el resto de acciones.
- **Plan previo.** `docs/plan-atajos-y-tab-medicion.md` dejó «reordenar líneas por teclado» fuera de alcance. También mantuvo el commit POR ÍNDICE «porque no hay reorden durante la edición». Con este plan esa premisa deja de cumplirse (Sección 4).
- **Referencias de estilo:**
  - `useReorderDrag.ts`: estado efímero fuera del store;
  - `hotkeyGuards.ts`: guardas compartidas;
  - `temporal.ts`: Deshacer por suscripción.
- **Antipatrón:** acciones de medición por índice (`editMedLine`/`deleteMedLine`).
- **Búsqueda web:** no disponible. Se usa lo que ya se sabe de Presto, Arquímedes y TCQ, que traen de serie copiar/pegar/reordenar líneas y el intercambio con Excel.

**0A · Premisas**

| # | Premisa | Valoración |
|---|---|---|
| P1 | El usuario necesita reordenar, copiar 1..N líneas a otra partida y duplicar en la misma | VÁLIDA: petición directa del experto de dominio |
| P2 | Un portapapeles solo interno basta | DUDOSA según las dos voces: el intercambio con Excel es la siguiente petición y el listón de la competencia → expansión #1 (taste) |
| P3 | «Llevármelas a otra partida» = copiar | VÁLIDA en su literalidad; mover se cubre con Cortar (#2, taste) |
| P4 | Pegar casilla a casilla entre «Medir por» distintas es seguro con un aviso | FALSA: Peso→Superficie comparte 3 casillas y 461 kg pasan a 461 m² sin columna ámbar (`MED_FORMAS`, `medColumnas`) → #3 |
| P5 | Pegar solo añade | FALSA: con cantidad fija, las líneas la SUSTITUYEN (`partidaCantidad`, `core/medicion.ts:50`) → #4 |
| P6 | Borrar en bloque no necesita trato especial | FALSA si las líneas están certificadas: `Cert.lineQty` va por id, y D-09 solo pinta «Línea eliminada», sin descripción → #5 |
| P7 | Ctrl+C dentro de la medición no está ocupado | FALSA: hoy copia la PARTIDA abierta (`useClipboardHotkeys`) → #7 |

Ninguna premisa llega como User Challenge: las falsas se corrigen dentro de la dirección que pidió el usuario.

**0B · Qué ya existe**

| Subproblema | Código existente | Reuso |
|---|---|---|
| Reordenar arrastrando | `hooks/useReorderDrag.ts` (origen/destino, asa, guía antes/después) | Sí, con `kind:'medline'` y `scope: partidaId` |
| Subir/Bajar | `movePartidaBy` + `reorderPartidaIn` | Mismo patrón, sobre `p.med` |
| Portapapeles | `clipboardStore`, `usePartidaClipboard`, `ClipboardToast`, chip de `StatusBar` | Sí, ampliándolo con `medLines` |
| Atajos y guardas | `hotkeyGuards.ts`, `useClipboardHotkeys`, `useAppHotkeys` | Sí; ceden dentro del grid |
| Alta en lote | `addMedLines` (+ `pesoDelComentario`) | Un helper compartido con `insertMedLines` |
| Leer celdas | `leerCelda`, `toDecimalComma`, `parseEsNumber` | Sí, para el TSV |
| Aviso con acción | `toastStore.show(msg, { label, run })` | Sí |
| Diálogo | `components/Modal` | Sí |
| Deshacer | `store/temporal.ts` (gratis vía `set`) | Sí |
| Ids nuevos | `nextMedLineId` (uuid) | Sí |

**0C · Estado ideal**

```
  HOY                            ESTE PLAN                            IDEAL 12 MESES
  Líneas en orden de alta;  -->  Reordenar (arrastre, Alt, barra);-->  La medición es una hoja:
  copiar solo partidas (sin      copiar/cortar/duplicar 1..N;          Excel también sobrescribe
  medición); Ctrl+C en la        TSV con Excel; pegar sin sorpresas    celdas; partidas que se copian
  medición copia la partida      de dinero (formas, certificadas, A→B) CON su medición; mediciones
                                                                        vinculadas
```

**0C-bis · Alternativas**

| Enfoque | Resumen | Esfuerzo | Riesgo | Completitud |
|---|---|---|---|---|
| A · Mínimo | Menú ⋮ por línea (Subir/Bajar/Duplicar/Copiar) + Pegar; una línea cada vez; portapapeles interno | S | Bajo | 5/10: no cumple «una o varias» |
| B · Plan original | Selección, arrastre, atajos y portapapeles interno | M | Medio | 7/10: deja abiertos P4–P7 |
| C · B + seguridad + TSV + Cortar | B con TSV del sistema, cortar atómico, diálogo de formas, guarda de certificadas y aviso A→B | M/L | Medio | 9/10 |

Elegido: **C** (P1). Las piezas añadidas son las que impiden cambios de dinero silenciosos.

**0F · Modo:** SELECTIVE EXPANSION, porque se mejora una función existente (regla de autoplan).

**0D · Análisis**
- **Complejidad.** Unos 14 ficheros editados y 4 nuevos: hook, barra, menú y `core/medTsv.ts`. Pasa del umbral de 8, pero son dos superficies (tabla y tarjetas) de la misma función y no hay servicios nuevos. El mínimo que cumple la petición: acciones de store, asa y arrastre, Subir/Bajar, selección, y copiar/pegar/duplicar.
- **10x.** La medición como hoja que habla con Excel: un listado «IPE300 · 2 · 9,50» pegado en una partida medida por Peso rellena solo el kg/m.
- **Detalles que se agradecen:**
  1. lo pegado queda seleccionado;
  2. Ctrl+D deja la copia justo debajo, con el foco en su comentario;
  3. «Pegar N líneas» aparece en el estado vacío;
  4. aviso A→B con Deshacer;
  5. chip «3 líneas · EAV010» en la barra de estado;
  6. ida y vuelta con Excel.
- **Cherry-picks:** aceptadas #1–#8, descartadas #9 y #15, aplazadas #10–#14. Tabla completa en el plan CEO: `~/.gstack/projects/jramirezbandera-concreta-mediciones/ceo-plans/2026-09-24-lineas-medicion-orden-copiar.md`.
- **Revisión de especificación del plan CEO:** 2 iteraciones, 17 problemas corregidos, 8/10.

**0E · Interrogatorio temporal**
- **Hora 1:** ¿acciones por id o por índice? ¿La selección vive en local? ¿Qué forma tiene el contenido copiado?
- **Horas 2-3:** el arbitraje de Ctrl+C/V entre el hook de partidas y el grid. `useGridNav` no filtra modificadores: Alt+↑ movería el foco Y la línea. `pesoDelComentario` al pegar.
- **Horas 4-5:** el respaldo de pegado con `setTimeout(0)`. El aviso con Deshacer frente al agrupamiento de 700 ms de `temporal.ts`. El foco tiene que seguir a la fila movida.
- **Horas 6+:** los tests de arrastre en jsdom (mock de DataTransfer, como en `PartidaReorder.test.tsx`) y Safari.

**Voces CEO**
- **Subagente Claude** (INPUT `ceo 2ecbe8f3…`, completado), 9 hallazgos:
  - usar eventos nativos y TSV (alto);
  - falta mover (alto);
  - líneas certificadas (alto);
  - formas distintas (medio);
  - Ctrl+C sobre una celda (medio);
  - partida copiada sin medición (medio);
  - las copias se desvían con el tiempo (medio);
  - semántica de la multiselección (medio);
  - partir en dos PRs (medio).
- **Codex** (completado, provider=codex), 7 hallazgos:
  - las mismas casillas no significan la misma magnitud (crítico);
  - pegar sustituye la cantidad fija (alto);
  - ¿el problema real es reutilizar la medición? (alto);
  - líneas certificadas (alto);
  - un portapapeles interno no resuelve cómo entran los datos (alto);
  - «copiar» con dos sentidos distintos (medio);
  - pulido antes que el flujo completo, y el móvil sin multilínea (medio).

Salida de Codex (literal, sin la cola duplicada de la captura):

```tool-output
1. Critical — "Same storage slots" does not mean "same measurement." Weight and surface area both use three columns: pasting 2 × 5 × 46.1 can turn 461 kg into 461 m² without any amber column. medColumnas flags surplus columns, not incompatible meanings. Applying destination weight inference can also change copied values. A toast after changing the budget is inadequate.
   Fix: Include source units and column meanings in the payload. Preserve values for compatible copies; require an explicit mapping and before/after quantity preview for incompatible ones. Make weight recalculation an explicit conversion option.
2. High — "Paste" can replace the destination quantity instead of adding to it. partidaCantidad uses the measurement sum whenever any lines exist, otherwise the fixed quantity. Pasting 10 units into a partida with a fixed quantity of 100 therefore produces 10, not 110. Pasting a blank line can produce zero. Bulk deletion of the last lines can resurrect the old fixed quantity. The plan never defines these financially consequential transitions.
   Fix: Define the transition between fixed quantities and measured quantities. On first paste, explicitly offer replacing the fixed quantity or preserving it as a baseline line. Define last-line deletion behavior too. Test resulting quantities and amounts, not just array contents.
3. High — The plan assumes the requested interaction is the underlying problem. One screenshot establishes friction; it does not establish whether users are repeating floors, reusing geometry across trades, correcting misplaced measurements, or assembling deliverables. Independent copies help initial entry but create multiple places to correct later. The potentially much larger opportunity is measuring once and reusing that measurement with controlled updates.
   Fix: Observe several real source-to-destination tasks and measure entry time and subsequent correction time. Ship a small copy/duplicate/reorder slice while testing whether named measurement sets, templates, or explicit references would remove more work. Do not build linked measurements without evidence—but do not silently rule them out either.
4. High — Stable IDs protect quantities, not the explanation of certified work. The plan tests certification IDs after reordering but adds bulk deletion without addressing historical evidence. Existing CertDetail retains deleted certified quantities under a generic "Línea eliminada…" label; the original description and dimensions are absent there. Copying then deleting to relocate work also creates new, uncertified identities while leaving historical quantities attached to the source.
   Fix: Declare copies independent and uncertified. Identify certified lines before bulk deletion and preserve their measurement snapshot for historical inspection. Treat relocation as a separate domain decision rather than encouraging copy/delete as an implicit move. Test certified-line deletion, duplication, subsequent certification, and reload.
5. High — The clipboard solves circulation inside Concreta without establishing how work enters Concreta. The proposed payload extends an in-memory application clipboard. It does not establish spreadsheet interchange, cross-tab transfer, or survival across reloads. If users' measurements originate elsewhere, this feature improves a secondary step while leaving the adoption barrier intact. The competitive risk is assuming users will move their whole workflow before receiving value.
   Fix: Establish the dominant source of copied measurements. If it is external, prioritize a defined tabular copy/paste format with unit validation and a round-trip acceptance task. If it is internal, label the clipboard accordingly and validate the cross-project workflow. Do not claim incumbent parity from internal row manipulation.
6. Medium — Two meanings of "copy" will make reuse unpredictable. The plan acknowledges that copying a partida excludes its measurements, then leaves that behavior intact while adding measurement copying. The existing partida copy path explicitly creates med: []. Reusing a measured partida therefore remains a two-stage operation, with "last copy wins" discarding the first payload.
   Fix: Define one product contract: "Copy price definition" versus "Duplicate partida with measurements." Support the latter as one operation with fresh measurement IDs and no copied certification state. Keep partial line copying as a separate, clearly named action.
7. Medium — Scope favors interaction polish over complete workflows. Desktop gets block selection, range selection, drag, shortcuts, and batch actions; mobile gets only per-card copying despite the request explicitly including multiple lines. Meanwhile, the desktop selection bar omits a visible Paste action. The plan expands into bulk deletion before proving that users can discover and complete the central copy-to-another-partida task.
   Fix: First deliver a visible, complete multi-line select → copy → choose destination → paste workflow on supported devices, plus duplication and button-based reordering. Defer block dragging and bulk deletion. Gate expansion on successful task completion, time saved, and quantity errors—not the number of interaction tests.
Recommendation: Revise before implementation because the proposed copy semantics can silently change budget quantities, while the larger investment assumes an unvalidated reuse workflow.
OUTSIDE_STATUS: completed provider=codex host=claude
```

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   parcial parcial CONFIRMED (P4-P7 falsas)
  2. Right problem to solve?           sí      dudoso  DISAGREE → rechazado (usuario = dominio)
  3. Scope calibration correct?        no      no      CONFIRMED (recalibrar)
  4. Alternatives sufficiently explored? no    no      CONFIRMED (TSV, mover, partida+medición)
  5. Competitive/market risks covered? no      no      CONFIRMED (intercambio con Excel)
  6. 6-month trajectory sound?         riesgos riesgos CONFIRMED (certificadas, deriva, dos «copiar»)
═══════════════════════════════════════════════════════════════
```

**Sección 1 · Arquitectura**

```
 DetailPanel (tabla)                           MedCards (tarjetas)
   MedLineRow ×N (asa + casilla + celdas)        MedCard ×N (+ casilla)
        │   selección LOCAL: Set<lineId>              │
        └──────────────┬──────────────────────────────┘
                       ▼
     useMedLineHotkeys / useMedLineClipboard  (keydown C/X/V/D, Alt+↑↓, evento paste)
        │                         │                         │
        ▼                         ▼                         ▼
  clipboardStore            core/medTsv (puro)        toastStore · Modal
  { items | medLines,       serializar / normalizar   (aviso A→B, diálogo de formas,
    tsv, cut, source,        / parsear                  guarda de certificadas)
    consumedTsv }
        │
        ▼
  obraStore · estructuraSlice (immer set): moveMedLine · moveMedLinesBy · insertMedLines
                                           duplicateMedLines · deleteMedLines · moveMedLinesTo
        │ suscripciones
        ├──► temporal (Deshacer)      ├──► autosave (IndexedDB)
        ▼
  Cert.lineQty[partidaId][lineId]  (solo lectura: guarda de certificadas)
```

Hallazgos:
1. `useClipboardHotkeys` y el grid chocan: hoy Ctrl+C en una celda en reposo copia la partida. El hook de partidas cede dentro de `[data-editgrid]` (obligación).
2. `useGridNav` no filtra modificadores, así que Alt+↑ movería el foco y la línea a la vez. Tiene que ignorar Alt, Ctrl y Meta; eng lo concreta.
3. Las acciones de medición van por índice y ahora la lista se reordena (Sección 4). Pasa a eng como decisión de arquitectura.

Rollback: `git revert`. No hay migración: la forma de `MedLine` no cambia y `clipboardStore` no se persiste. Tampoco hay superficie de red nueva.

**Sección 2 · Mapa de errores y rescate**

| Ruta | Qué falla | Nombre | ¿Rescatado? | Acción | El usuario ve |
|---|---|---|---|---|---|
| insertMedLines / moveMedLinesTo | la partida destino ya no existe | DestinoInexistente | S | no-op; la acción devuelve `[]` y la UI avisa | «No se pudo pegar: la partida ya no existe» |
| pegar TSV ajeno | celda ilegible o con forma de miles | TsvCeldaIlegible | S | se rechaza todo | «Fila 3, Largo: «1.234» es ambiguo…» |
| pegar TSV ajeno | más de 5 celdas o más de 500 filas | TsvFormaInvalida | S | se rechaza todo | aviso con la regla |
| pegar | sin texto en el portapapeles | PortapapelesVacio | S | nada | nada |
| writeText | permiso o navegador | ClipboardWriteDenied | S | se ignora: la copia interna vale | nada |
| Ctrl+V sin evento `paste` | el navegador no lo despacha | PasteEventMissing | S | respaldo interno en `setTimeout(0)` | pega lo interno |
| moveMedLinesTo | las líneas de origen ya no existen | CortadoObsoleto | S | pega la instantánea como copia | aviso |
| pegar un cortado | la obra es otra | CortadoOtraObra | S | copia; el origen no se toca | aviso |
| pegar | el TSV ya lo consumió un cortado | CortadoYaPegado | S | no-op | «Esas líneas ya se movieron» |
| diálogo de formas | cancelar | PegadoCancelado | S | nada | nada |
| guarda de certificadas | cancelar | BorradoCancelado | S | nada | nada |
| Deshacer del aviso | el historial cambió | DeshacerObsoleto | S | el aviso se descarta | desaparece |

Brecha: las acciones del store son no-op silenciosas si reciben ids inválidos. Por eso las nuevas devuelven los ids afectados y la UI avisa cuando no hay ninguno.

**Sección 3 · Seguridad**
- **Texto pegado desde el sistema.** No es de fiar, pero React lo pinta como texto y `leerCelda` usa un parser propio, sin `eval` ni `Function` (`core/expresion.ts:4`). Probabilidad baja, impacto bajo.
- **Fórmulas al pegar en Excel.** Un comentario «=…» de un .bc3 ajeno podría ejecutarse. Se mitiga con el prefijo `'`. Probabilidad baja, impacto medio.
- **Tamaño.** Máximo 500 filas por pegado.
- Sin dependencias nuevas, sin secretos y sin autenticación (app local).

**Sección 4 · Flujos de datos y casos límite**

```
 teclado/botón ─► leer (evento paste | interno) ─► normalizar ─► ¿= TSV guardado? ─sí─► contenido rico
      │                    │                           │                 │no
  [vacío → nada]   [sin evento → interno]      [CRLF, huecos]     ¿= consumedTsv? ─sí─► no-op + aviso
                                                                         │no
                                                                  parsear TSV ─► [ilegible → rechazo]
      ┌──────────────────────────────────────────────────────────────────┘
      ▼
 ¿formas incompatibles? ─sí─► diálogo (cancelar → nada) ─┐
      │no                                                  ▼
      ├──────────────► ¿cortado de la misma obra? ─sí─► moveMedLinesTo (guarda si otra partida)
      │                            │no
      ▼                            ▼
 insertMedLines (ids nuevos, pesoDelComentario del destino) ─► set ─► aviso «A → B» + Deshacer
```

| Interacción | Caso | ¿Cubierto? | Cómo |
|---|---|---|---|
| Pegar | doble Ctrl+V | S | dos pegados y dos pasos de Deshacer (lo esperado) |
| Pegar | con una celda en edición | S | dentro del input manda el pegado nativo |
| Pegar | partida sin líneas y con cantidad fija | S | aviso «fija A → medida B» |
| Reordenar | la lista se reordena con un borrador abierto (sobrevive al Alt+Tab desde 908461b) | **RIESGO** | el commit va por índice (`editMedLine(…, i, …)`) → eng |
| Arrastrar | soltar sobre sí misma o en otra partida | S | no-op; `scope` lo rechaza |
| Alt+↑ | en la primera línea | S | no-op en el borde |
| Cortar | editar el origen antes de pegar | S | se mueve el contenido ACTUAL |
| Cortar | Deshacer después de mover | S | un solo paso restaura los dos lados |
| Copiar | cambiar de obra y pegar | S | se pega como copia |
| Seleccionar | Deshacer deja ids seleccionados que ya no existen | S | la selección se poda |

Orden asíncrono. Solo hay dos esperas: `setTimeout(0)` del respaldo de pegado y `writeText`, que no se espera.
- **(a)** El `paste` llega antes del timeout: consume la marca y el timeout ya no hace nada.
- **(b)** El `paste` no llega: el timeout pega lo interno.
- **(c) No puede ocurrir:** el timeout se dispara y luego llega el `paste`. El navegador despacha el `paste` de ese Ctrl+V en la misma tarea que el keydown, antes de que se ejecute un `setTimeout`.
- **Test:** los dos órdenes posibles, con fake timers.
- `writeText` no toca ningún invariante: lo interno ya está escrito antes.

**Sección 5 · Calidad de código**
- **DRY:** `addMedLines` e `insertMedLines` construyen las líneas igual, así que comparten un helper (clon + `pesoDelComentario` + id nuevo). El reordenar líneas y `reorderPartidaIn` comparten un helper de lista.
- **Nombres:** `moveMedLine` (reordenar) y `moveMedLinesTo` (cortar) se confunden. Eng decide los nombres finales.
- **Sobreingeniería:** solo aparece `core/medTsv.ts`, que es puro y testeable.
- **Infraingeniería:** acciones por índice (Sección 4).

**Sección 6 · Tests**

```
 FLUJOS UX NUEVOS: arrastrar el asa · Alt+↑↓ · Subir/Bajar en la barra · seleccionar (click,
   Shift+click, móvil) · Ctrl+C/X/V/D · botones Copiar/Cortar/Duplicar/Eliminar/Pegar ·
   diálogo de formas · guarda de certificadas · aviso A→B + Deshacer · Pegar en el estado vacío
 FLUJOS DE DATOS: interno → pegar · TSV propio → contenido rico · TSV ajeno → líneas · cortar → mover
 RUTAS NUEVAS: normalizar/parsear TSV · formas compatibles · certificadas · respaldo sin evento
 ASÍNCRONO: setTimeout(0) del pegado · writeText
 ERRORES: los 12 de la Sección 2
```

Cada ruta tiene su test en las obligaciones: unitarios para el store y `medTsv`, integración con RTL + user-event para la UI.
- **Test de «las 2 de la mañana del viernes»:** cortar 3 líneas certificadas de EAV010, pegarlas en EAV011, confirmar y Deshacer. Las dos partidas y `lineQty` tienen que volver exactamente a su estado anterior.
- **Test hostil:** un TSV con «1.234», CRLF, comillas, una fila de 6 celdas y 501 filas.
- **Riesgo de test inestable:** `setTimeout(0)`; se prueba con fake timers.

**Sección 7 · Rendimiento.** Revisado sin hallazgos:
- la selección vive en estado local y solo re-renderiza el panel abierto;
- el arrastre guarda estado por fila, como el patrón existente;
- el TSV es O(n), con tope de 500 filas;
- las instantáneas de Deshacer comparten estructura: solo cambia `partidas[ch]`.

**Sección 8 · Observabilidad.** La app es local y no tiene telemetría: la observabilidad es lo que ve el usuario.
- el aviso A→B;
- los errores de TSV con fila y columna;
- el chip del portapapeles («3 líneas · EAV010», «cortadas»);
- la marca atenuada del cortado.

No hay logs nuevos porque no hay infraestructura para ellos.

**Sección 9 · Despliegue.** PWA con aviso de versión nueva (a7275f5). Sin migración de esquema.
- Una pestaña con la versión vieja no interpreta el TSV como líneas; no hay riesgo.
- Rollback: `git revert`.
- Comprobación tras desplegar: copiar y pegar entre dos partidas, y a Excel, en Chrome/Edge.

**Sección 10 · Trayectoria.** Reversibilidad 5/5. Deuda en tres puntos:
1. acciones por índice (eng);
2. la certificación no guarda instantánea de la línea (TODO);
3. «copiar» con dos sentidos (TODO).

La procedencia del contenido copiado ya deja preparadas las mediciones vinculadas.

**Sección 11 · Diseño (la Fase 2 lo profundiza)**

| Función | CARGA | VACÍO | ERROR | ÉXITO | PARCIAL |
|---|---|---|---|---|---|
| Pegar | n/a (síncrono) | «Pegar N líneas» en el estado vacío | aviso con fila y columna | aviso A→B | no existe (todo o nada) |
| Reordenar | n/a | sin asa con 0-1 líneas | n/a | la fila se mueve con el foco | n/a |
| Cortar | n/a | n/a | obsoleto → copia | aviso | líneas omitidas → aviso |

```
 [partida abierta] ─click en asa/casilla─► [selección N] ─Copiar/Cortar─► [chip «N líneas»]
       │                                       │ Esc / ✕                        │ abrir otra partida
       ▼                                       ▼                                ▼
 [Alt+↑↓ / arrastre] ─► [orden nuevo]    [sin selección]         [Ctrl+V / «Pegar N»] ─incompatible─► [diálogo]
                                                                        │                                   │
                                                                        ▼                                   ▼
                                                             [aviso A→B + Deshacer] ◄──────── Pegar tal cual
```

Accesibilidad:
- asa y casilla con `aria-label`; Espacio alterna la selección;
- `aria-live` al mover («Línea movida a la posición 3 de 6»);
- táctil a 44 px (`tap-target`).

**NOT in scope (CEO)**
- Copiar/duplicar partida con su medición: decisión de producto aparte (TODO).
- Mediciones vinculadas: sin evidencia de uso (TODO).
- Instantánea de la línea al certificar: cambia el modelo de certificación (TODO).
- Conservar la cantidad fija como primera línea: cambia «Añadir línea» (TODO).
- Pegar sobrescribiendo celdas: semántica de hoja de cálculo completa (TODO).
- Arrastrar bloques: ambiguo con una selección no contigua (descartado).
- «Mover a partida…»: basta con Cortar/Pegar (descartado).
- Investigación de usuarios previa (Codex #3): el usuario es el experto de dominio y lo pide directamente.

**Registro de modos de fallo (CEO)**

```
  RUTA                 | FALLO                         | RESCATE   | TEST | USUARIO VE        | LOG
  ---------------------|-------------------------------|-----------|------|-------------------|-----
  pegar entre formas   | 461 kg → 461 m²               | S diálogo | S    | diálogo           | n/a
  pegar con c. fija    | 100 → 10 sin darse cuenta     | S aviso   | S    | aviso A→B         | n/a
  borrar certificada   | cert sin línea visible        | S confirm | S    | confirmación      | n/a
  Ctrl+C en medición   | copia la partida              | S         | S    | —                 | n/a
  reordenar + borrador | escribe en otra línea         | → eng     | → eng| —                 | n/a
  cortado ya pegado    | se pega otra vez como copia   | S         | S    | aviso             | n/a
  TSV «1.234»          | 1,234 en vez de 1234          | S rechazo | S    | aviso fila/col    | n/a
```

No queda ningún CRITICAL GAP abierto en CEO. «Reordenar + borrador» pasa a eng como decisión obligatoria.

**Distancia al ideal.** El plan deja la medición como una lista editable completa (ordenar, copiar, cortar, duplicar, Excel en los dos sentidos) y sin sorpresas de dinero. Para el ideal faltan tres cosas: sobrescribir celdas desde Excel, copiar partidas con su medición y las mediciones vinculadas.

**TODOS propuestos** (auto-decidido: se añaden a TODOS.md al aprobar el plan). Son los cinco aplazados:
- P2: partida con medición; instantánea de la línea al certificar.
- P3: vinculadas, cantidad fija como primera línea, sobrescribir celdas.

**Resumen CEO**

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | Ctrl+C en medición copia la partida; acciones|
  |                      | por índice; copiar partida sin medición     |
  | Step 0               | Enfoque C; 8 aceptadas, 5 aplaz., 2 descart.|
  | Section 1  (Arch)    | 3 issues found                              |
  | Section 2  (Errors)  | 12 error paths mapped, 1 GAP (cubierto)     |
  | Section 3  (Security)| 1 issue found, 0 High severity              |
  | Section 4  (Data/UX) | 10 edge cases mapped, 1 unhandled (→ eng)   |
  | Section 5  (Quality) | 3 issues found                              |
  | Section 6  (Tests)   | Diagram produced, 0 gaps (en obligaciones)  |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 0 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 3           |
  | Section 11 (Design)  | 3 issues (→ Fase 2)                         |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (8 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 12 methods, 0 CRITICAL GAPS                 |
  | Failure modes        | 7 total, 0 CRITICAL GAPS (1 → eng)          |
  | TODOS.md updates     | 5 items proposed                            |
  | Scope proposals      | 15 proposed, 8 accepted                     |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed                             |
  | Lake Score           | 4/4 recommendations chose complete option   |
  | Diagrams produced    | 5 (arquitectura, datos, ideal, UX, tests)   |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0 (3 de gusto → gate)                       |
  +====================================================================+
```

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"2ecbe8f3ab47a0be642ca84cd5366c4890d3d2673621a05079e76298c452b6eb","replacements":[{"oldText":"- Añadir un segundo contenido, `medLines: { lines: MedLine[]; source: { code: string;\n  title: string; forma: MedForma } } | null`, con `setMedClip`. Copiar líneas guarda un\n  snapshot inmutable (copias, ids originales descartados al pegar).","newText":"- Añadir un segundo contenido, `medLines: { lines: MedLine[]; tsv: string; cut: boolean;\n  source: { obraId: string; chapterId: string; partidaId: string; code: string; title: string;\n  forma: MedForma; ud: string } } | null`, con `setMedClip`. Copiar líneas guarda un\n  snapshot inmutable (copias; al pegar como copia los ids se regeneran)."},{"oldText":"- Arrastrar con varias líneas seleccionadas y agarrando una de ellas: mueve el bloque.","newText":"- Arrastrar mueve UNA sola línea (la agarrada), aunque haya selección; los bloques se\n  mueven con Alt+↑/↓ o con la barra de selección."},{"oldText":"  casilla a casilla (igual que cambiar «Medir por»). Si la forma de origen y destino\n  difieren, el aviso lo dice («pegadas 3 líneas · medidas por Peso en origen») y las\n  columnas «fuera de forma» ya se marcan en ámbar (`medColumnas`).","newText":"  casilla a casilla (igual que cambiar «Medir por»). Si las formas son INCOMPATIBLES\n  (definición en las obligaciones de la fase CEO), un diálogo muestra las columnas de\n  origen y destino y la cantidad antes → después, con «Pegar tal cual» / «Cancelar». Si\n  son compatibles se pega directamente y el aviso «cantidad A → B» lo cubre."}]} -->

<!-- autoplan-accepted:ceo -->
- **Definiciones de contrato:**
  - «Línea certificada»: su `id` tiene `lineQty > 0` en cualquier `Cert` de la obra.
  - «Formas compatibles»: cada casilla NO vacía de las líneas pegadas tiene el mismo rótulo en `medFormaDef(origen).cols` y en `medFormaDef(destino).cols`. Una casilla fuera de la forma usa el rótulo genérico de `medColumnas`.
  - El TSV ajeno no tiene forma de origen, así que no abre el diálogo.
  - «Mover», a efectos de la guarda de certificadas, es SOLO pegar un cortado en OTRA partida. Reordenar (arrastre, Alt+↑/↓, Subir/Bajar) y pegar un cortado en la MISMA partida conservan los ids y no preguntan.
- **Portapapeles del sistema en TSV canónico**, además del interno:
  - Copiar y cortar escriben en `text/plain` filas `Comentario⇥uds⇥largo⇥ancho⇥alto`.
  - Sin cabecera, con coma decimal y sin separador de miles. Se escribe la precisión guardada y el VALOR (no `expr`); una casilla vacía queda vacía.
  - En el comentario, los tabuladores y saltos de línea pasan a espacio. Se antepone `'` si empieza por `=`, `+` o `@`, o si es un número liso.
  - `clipboardStore.medLines` guarda, junto al contenido completo, el TSV exacto escrito, `cut` y la procedencia: `obraId` (`sessionStore.activeId`), `chapterId`, `partidaId`, código, título, forma efectiva y ud.
  - Módulo puro nuevo `core/medTsv.ts` (serializar, normalizar, parsear), con tests.
- **Leer TSV al pegar:**
  - Normalizar antes de comparar o parsear: CRLF → LF, quitar el salto final y las celdas y filas vacías del final.
  - Quitar las comillas envolventes y el `'` inicial.
  - Con 5 celdas, la 1.ª es siempre el comentario. Con ≤4, la 1.ª es el comentario salvo que sea un número liso (`parseEsNumber`); entonces todas son casillas desde uds. Más de 5 celdas: se rechaza.
  - Las casillas se leen con las reglas de teclear en la celda (`toDecimalComma` + `leerCelda`: operaciones y perfiles).
  - Una cifra con forma de miles y sin coma (`/^\d{1,3}(\.\d{3})+$/`) es ambigua y se rechaza.
  - Una celda ilegible o ambigua rechaza el pegado entero, con un aviso que dice fila y columna. Máximo 500 filas.
  - Tests:
    - ida y vuelta Concreta → TSV → Concreta idéntica, salvo `expr`;
    - una fila «IPE300⇥2⇥9,50» en una partida medida por Peso rellena el kg/m;
    - rechazo con fila y columna, rechazo de «1.234», «9.50» = 9,5, CRLF y filas vacías finales, límite de 500;
    - prefijo `'` al exportar y su retirada al pegar; un comentario numérico hace la ida y vuelta.
- **Qué manda al pegar con teclado:**
  - Se usa el `text/plain` normalizado del evento `paste`: si coincide con el TSV guardado → contenido completo; si coincide con `consumedTsv` → no-op y aviso «Esas líneas ya se movieron»; si es otro texto → TSV ajeno, que además cancela un cortado pendiente; sin texto → nada.
  - Mecanismo:
    - en el `keydown` de Ctrl/⌘+C y Ctrl/⌘+X se guarda en el portapapeles interno y se llama a `navigator.clipboard.writeText(tsv)` dentro del gesto;
    - en el `keydown` de Ctrl/⌘+V se pone una marca; si en `setTimeout(0)` no llegó ningún `paste`, se pega del portapapeles interno.
  - Botones:
    - «Copiar» y «Cortar» (barra y móvil) guardan en el interno y llaman a `writeText` como mejor esfuerzo; si falla, no avisan;
    - «Pegar N líneas» usa solo el interno.
  - Copiar líneas vacía `items` (partidas), y viceversa.
  - Tests de las dos órdenes del respaldo con fake timers, y de cada rama de la resolución.
- **Ctrl/⌘+C, X y V nunca copian ni pegan partidas** con el foco dentro del grid de medición (celda en reposo, asa o casilla de selección): `useClipboardHotkeys` ni actúa ni llama a `preventDefault` ahí.
  - Dentro del input de edición, copiar y pegar siguen siendo los nativos.
  - Test: Ctrl+C en una celda en reposo de la medición no cambia `clipboardStore.items`.
- **Cortar** (Ctrl/⌘+X y botón «Cortar» de la barra de selección) mueve al pegar dentro de la misma obra:
  - Cortar no quita nada: atenúa las líneas mientras dure y las deja en el portapapeles.
  - Pegar en la misma obra llama a una acción nueva `moveMedLinesTo(srcChapterId, srcPartidaId, lineIds, dstChapterId, dstPartidaId, afterId)`. En UN `set` (un paso de Deshacer) inserta el contenido ACTUAL de esas líneas y las borra del origen.
  - Misma partida → conserva los ids. Otra partida → ids nuevos.
  - Las líneas que ya no existen se omiten; si no queda ninguna, se pega la instantánea como copia, con aviso.
  - Tras pegarlo, el portapapeles interno se vacía y su TSV pasa a `consumedTsv`.
  - En otra obra se pega como copia sin tocar el origen, con aviso; el cortado pasa a copia normal y pierde la marca.
  - Esc en la medición, o una copia nueva, cancelan el cortado.
  - Tests de cada rama, incluido cortar-pegar-Deshacer restaurando las dos partidas.
- **Diálogo al pegar entre formas INCOMPATIBLES** (componente `Modal` existente): muestra las columnas de origen y de destino y la cantidad del destino antes → después, con «Pegar tal cual» y «Cancelar». Cancelar no cambia nada.
  - Tests: Peso → Superficie abre el diálogo; Longitud → Superficie no; el TSV ajeno no.
- **Aviso tras pegar, duplicar o mover** (reusa `toastStore` con acción): «N líneas pegadas en <código> · cantidad A → B <ud>», y «cantidad fija A → medida B» si el destino no tenía líneas.
  - Su «Deshacer» solo ejecuta `undo()` si el historial de dominio no ha cambiado desde esa acción; si cambió, el aviso se descarta.
  - Tests: el texto de fija → medida; Deshacer después de otra edición no deshace la edición ajena.
- **Guarda de líneas certificadas:** borrar líneas certificadas, y moverlas por cortar a otra partida, pide confirmación con cuántas son y en qué certificaciones («2 de 5 líneas están certificadas en C1 y C3»). Sin confirmar, no cambia nada.
  - Se aplica a la X de una sola línea (cambio de comportamiento documentado) y al borrado en bloque.
  - Una línea sin certificar se sigue borrando sin diálogo.
  - Tests de confirmar, de cancelar y del caso sin certificar.
- **Selección múltiple también en móvil:** casilla en cada tarjeta de `MedCards`, la misma barra (Copiar, Cortar, Duplicar, Subir, Bajar, Eliminar, quitar selección) y el botón «Pegar N líneas».
- **Arrastrar mueve UNA sola línea** (la agarrada), aunque haya selección. Los bloques se mueven con Alt+↑/↓ o con la barra.
- **Semántica de la selección:**
  - Alt+↑/↓ con una selección no contigua mueve cada línea una posición, y el bloque entero se detiene en el borde.
  - Dónde pega: con selección, detrás de la última seleccionada; con el foco en una fila, detrás de ella; si no, al final.
  - Tras pegar o duplicar, las líneas nuevas quedan seleccionadas.
  - La selección se poda de ids que ya no existen (test tras Deshacer).
- **«Pegar N líneas» en el estado vacío** de la medición (tabla y tarjetas) cuando el portapapeles interno tiene líneas.
- **Las acciones nuevas de medición devuelven los ids afectados** (vacío si no hacen nada). La UI avisa «No se pudo pegar: la partida ya no existe» cuando no hay ninguno.
- **TODOS.md, al aprobar:**
  - copiar/duplicar partida con su medición (P2);
  - instantánea del comentario y las dimensiones al certificar por líneas (P2);
  - mediciones vinculadas (P3);
  - cantidad fija → primera línea (P3);
  - pegar sobrescribiendo celdas (P3).
<!-- /autoplan-accepted:ceo -->

### Fase 2 · Diseño (autoplan, 2026-09-24)

**Auditoría.**
- DESIGN.md: `docs/DESIGN.md`, con tokens oscuro/claro, `.tap-target` 44 px, rojo `--state-danger` para destruir y ámbar `--state-warn` para avisar.
- Alcance de UI:
  - tabla de medición (`DetailPanel`) y tarjetas (`MedCards`);
  - avisos (`Toast`/`ClipboardToast`);
  - `Modal`;
  - barra de estado.
- El pase de diseño móvil anterior (FINDING-010, 014, 015, 016 y 018) ya resolvió esta misma clase de problemas en otros sitios: pistas solo táctiles con `isTouchOnly()`, `@media (hover: none)` en el árbol y borrar en rojo. Hay que ser igual de estrictos aquí.
- Problema que ya existe: la X de borrar línea (`.med-row .med-del { opacity: 0 }` hasta el hover, `tokens.css:222`) no se ve en tablet táctil.

**Maquetas.** El generador está disponible (DESIGN_READY), pero no se ha usado. Su tablero de comparación pide al usuario que elija variante a mitad de proceso, y /autoplan reserva esas decisiones para el gate final. La referencia visual es la captura del usuario, `docs/DESIGN.md` y el CSS real de la tabla. Tras aprobar, se puede lanzar `/design-shotgun` para la barra de selección y el diálogo.

**Paso 0 · Valoración inicial: 5/10.** Los datos y la lógica están definidos al detalle, pero la capa de UI solo está nombrada, no diseñada. Un 10 para este plan significa:
- dónde vive la barra;
- qué ve el usuario en cada estado, incluido el error;
- dónde queda el foco tras cada acción;
- cómo se ve un cortado;
- qué pasa en táctil ancho y en móvil;
- los textos exactos de avisos y diálogos.

**Voces de diseño**
- **Subagente Claude** (INPUT `design d4619bcf…`, completado): 2 críticos, 7 altos y 12 medios.
  - Críticos: no hay botón de Pegar en escritorio cuando ya hay líneas; en tablet táctil no se llega a nada.
  - Altos: la barra tapa el total; dos avisos se pintan en el mismo sitio; los errores salen como éxito; el aviso se desborda en móvil; no hay selección por teclado; no se sabe dónde queda el foco; las tarjetas y la barra no caben en móvil.
- **Codex** (completado): 1 crítico compartido y 9 altos.
  - Crítico: el diálogo de formas no explica la consecuencia en dinero.
  - Crítico propio: el respaldo `setTimeout(0)` puede pegar contenido obsoleto; `consumedTsv` bloquea copias legítimas; un `writeText` fallido pasa en silencio.
  - Altos: la guarda de certificadas no dice qué pasa; el pie tapa el total; el destino de Pegar es incoherente; el móvil es solo una lista de acciones; la precedencia de teclado; la accesibilidad; el cortado parcial hecho en silencio; los avisos.

Salida de Codex, resumida por hallazgo (literal en la conversación de autoplan):

```tool-output
1 Critical — compatibility dialog lacks the financial consequence (show code/title/forma/ud both sides, highlight kg/m→Anchura, destination quantity AND amount before/after after profile autofill, "Se reinterpretan los valores; no se convierten unidades").
2 Critical — clipboard timing: setTimeout(0) fallback can paste stale internal content before a later paste event; silent writeText failure; consumedTsv blocks legitimate re-copies → one authoritative paste transaction, explicit internal paste, "Copiado en Concreta; no disponible para Excel", scope suppression.
3 High — certification confirmation must state consequences (history stays with source; destination starts uncertified); one combined review dialog.
4 High — replacing the footer hides the quantity; empty state must show "Cantidad fija: A ud"; moves report source and destination.
5 High — paste destination inconsistent; persistent paste control in table and cards; capture destination before focus moves; restrict outside-grid paste to an explicit measurement context.
6 High — mobile toolbar: sticky above bottom nav with count/Copiar/Más/clear; checkboxes without hover on touch incl. wide; preserve selection across layouts; test 360px and ~780px.
7 High — keyboard precedence (useGridNav + Alt), focus after paste/duplicate/delete/undo, Escape precedence, keyboard in cards.
8 High — accessibility: labelled checkboxes, :focus-within, textual cut indicator (not opacity), 4.5:1 / 3:1 contrast, 44px non-overlapping, announcements, dialog initial focus.
9 High — cut silently becomes partial move or copy → persistent pending-cut indicator; explicit choices when lines are missing; "Pegar como copia" labelled before activation.
10 High — toasts: success/warning/error variants, one stack, wrapping, inline paste errors until dismissed, pause on hover/focus, remove invalid undo immediately, distinct error reasons.
Recommendation: Revise before implementation because clipboard ambiguity and incomplete consequence previews can change quantities incorrectly, while responsive layout, focus and recovery behavior still require product decisions.
OUTSIDE_STATUS: completed provider=codex host=claude
```

```
DESIGN OUTSIDE VOICES — LITMUS SCORECARD (superficie OPERATE / app UI):
═══════════════════════════════════════════════════════════════
  Check                                    Claude  Codex  Consensus
  ─────────────────────────────────────── ─────── ─────── ─────────
  1. Brand unmistakable in first screen?   n/a     n/a    N/A (función dentro de la app)
  2. One strong visual anchor?             NO      NO     CONFIRMED fallo (la barra tapa el total)
  3. Scannable by headlines only?          n/a     n/a    N/A
  4. Each section has one job?             NO      NO     CONFIRMED fallo (pie = total Y acciones)
  5. Cards actually necessary?             sí      sí     CONFIRMED (tarjetas móviles ya existentes)
  6. Motion improves hierarchy?            —       —      NOT SPEC'D (guía de arrastre existente)
  7. Premium without decorative shadows?   n/a     n/a    N/A (sistema existente)
  ─────────────────────────────────────── ─────── ─────── ─────────
  Hard rejections triggered:               0       0      CONFIRMED ninguna
═══════════════════════════════════════════════════════════════
```

**Pase 1 · Arquitectura de la información: 5 → 9.**
- *Problema.* La barra de selección ocupa el lugar del pie y tapa la «Cantidad total», que es justo la cifra que confirma lo que acaba de hacer cada acción. En escritorio no hay forma visible de pegar en una partida que ya tiene líneas.
- *Decisión* (mecánica, P1+P5):
  - Tres capas: primero los datos de la fila; después la cantidad, siempre visible; en tercer lugar las acciones.
  - La barra va en una franja propia y pegajosa.
  - «Pegar N líneas» está siempre en el pie de escritorio y de tarjetas mientras el portapapeles interno tenga líneas.
- *Por qué no llega a 10:* la barra solo se pega dentro de su contenedor con scroll; no flota en toda la pantalla.

```
 ┌ Partida 2.6 EAV010 Acero en vigas ─────────────────────────────── kg  2.817,23 ┐
 │ [Medición 6] [Descripción] [Justificación]                      MEDIR POR Peso │
 │ ☐ ⋮⋮ COMENTARIO                       UDS   LONGITUD   KG/M        PARCIAL     │
 │ ☑ ⋮⋮ IPE300                            ·      ·      IPE 300 42,20     42,20   │ ← seleccionada (--accent-soft + inset)
 │ ☑ ⋮⋮ IPE160                            ·      ·      IPE 160 15,80     15,80   │
 │ ☐ ⋮⋮ TIRANTE HEB200 [cortada]          5    6,36     HEB 200 61,30  1.949,34   │ ← contorno discontinuo + etiqueta
 │ …                                                                              │
 │ + Añadir línea de medición   ⧉ Pegar 3 líneas tras «IPE160»    CANTIDAD TOTAL 2.817,23 kg │ ← pie: nunca se oculta
 ╞════════════════════════════════════════════════════════════════════════════════╡
 │ 2 líneas · Σ 58,00 kg   Copiar  Cortar  Duplicar  ↑ Subir  ↓ Bajar  Eliminar  ✕ │ ← barra pegajosa (bottom: 0)
 └────────────────────────────────────────────────────────────────────────────────┘
```

**Pase 2 · Estados: 4 → 9.**
- *Problema.* No están definidos los estados de error ni el parcial. El `Toast` actual siempre pinta ✓ y dura 2,2 s, así que un error de TSV se vería como un éxito. `ClipboardToast` y `Toast` se pintan en el mismo sitio (los dos usan `ClipboardToast.module.css .toast`). `white-space: nowrap` desborda en 360 px. Además, el pie enseña «Cantidad total 0,00» en una partida sin líneas pero con cantidad fija.
- *Decisión* (mecánica, P1): la tabla de estados de abajo, un único hueco de avisos con tres tonos, y los errores de pegado en línea.

| Función | CARGA | VACÍO | ERROR | ÉXITO | PARCIAL |
|---|---|---|---|---|---|
| Pegar | n/a (síncrono) | medición vacía: «Sin líneas de medición. Añade la primera o pega líneas copiadas (Ctrl+V)» (en táctil: «…o pega líneas copiadas») + botón «Pegar N líneas»; pie «Cantidad fija A ud» si la hay | franja en línea `role="alert"` en tono `--state-danger` bajo la tabla, hasta ✕ o hasta pegar bien: «No se pudo pegar: fila 3, Largo «1.234» es ambiguo. Pégalo sin separador de miles» | aviso de éxito «3 líneas pegadas · 2.817,23 → 2.875,23 kg» + Deshacer | no existe (todo o nada) |
| Pegar en cantidad fija | — | — | — | aviso en tono advertencia, 8 s: «Cantidad fija 100,00 → medida 10,00 m²» + Deshacer | — |
| Mover (cortar) | n/a | — | diálogo de revisión si faltan líneas o hay certificadas | «3 líneas movidas · EAV010 2.817,23 → 520,00 · EAV011 0,00 → 2.297,23 kg» + Deshacer | el diálogo ofrece «Mover las M restantes» |
| Duplicar | n/a | — | — | «2 líneas duplicadas · 2.817,23 → 2.875,23 kg» + Deshacer | — |
| Reordenar | n/a | sin asa con 0–1 líneas | — | SIN aviso: la fila se mueve y conserva el foco; `aria-live` «Línea movida a la posición 3 de 6» | — |
| Copiar / Cortar | n/a | nada que copiar → sin efecto ni aviso | `writeText` falla → advertencia «Copiado en Concreta; no disponible para Excel» | «3 líneas copiadas · EAV010» / «3 líneas cortadas · EAV010» | — |
| Ctrl+V sin partida abierta | — | — | — | — | aviso «Abre una partida para pegar las líneas» |

**Pase 3 · Recorrido y arco emocional: 5 → 8.**
- *Problema.* El recorrido principal se rompe en tres puntos: no hay Pegar con el ratón, los avisos se solapan y los errores parecen éxitos.
- *Decisión* (mecánica): el guion de abajo.
- *Por qué no llega a 10:* falta validarlo con un usuario real, cosa que hará `/design-review` sobre la app en vivo.

| Paso | El usuario hace | Siente | Lo sostiene |
|---|---|---|---|
| 1 | Pasa el ratón por una línea | «esto se puede mover o elegir» | asa y casilla aparecen (siempre visibles en táctil) |
| 2 | Marca 3 líneas | control | barra pegajosa «3 líneas · Σ» y el total sigue visible |
| 3 | Copiar / Ctrl+C | confirmación | aviso «3 líneas copiadas · EAV010» en el único hueco de avisos |
| 4 | Abre 2.7 (ya tiene líneas) | orientación | «⧉ Pegar 3 líneas» en el pie, con su origen en el tooltip |
| 5 | Pega | confianza | las líneas nuevas quedan seleccionadas y enfocadas, más el aviso A→B con Deshacer |
| 6 | Se equivoca de partida | tranquilidad | Deshacer en el aviso (o Ctrl+Z) restaura en un paso |
| 7 | Pega de Excel algo raro | «me dice qué arreglar» | franja de error con fila, columna, valor y corrección |

Horizonte de tiempo:
- en 5 segundos, la fila seleccionada y el total no se mueven de sitio;
- en 5 minutos, los atajos coinciden con los de Excel (salvo Ctrl+D, que duplica y la ayuda lo dice);
- a largo plazo, nunca cambia dinero sin que el usuario lo vea.

**Pase 4 · Riesgo de UI genérica: 7 → 9.**
- *Clasificación:* OPERATE (UI de aplicación). Ninguna hard rejection.
- *Problema.* Había descripciones vagas: «atenuado», «barra de selección», «un aviso», «un diálogo».
- *Decisión* (mecánica, P5):
  - Textos exactos, en los estados y en las obligaciones.
  - El cortado se marca con contorno discontinuo y la etiqueta «cortada», no con opacidad, que se confunde con arrastrar o con deshabilitado.
  - La barra usa lenguaje de utilidad: recuento, suma y verbos.

**Pase 5 · Sistema de diseño: 6 → 9.**
- *Decisión* (mecánica, DESIGN.md existe y el arreglo es obvio):
  - selección con `--accent-soft` + el inset de acento existente (`.row.selected`);
  - Eliminar en `--state-danger` (convención FINDING-018);
  - avisos de advertencia en `--state-warn`, errores en `--state-danger`;
  - la casilla reutiliza el patrón `lineCheck` de certificaciones (`button role="checkbox"` + `.tap-target`);
  - los diálogos son `Modal` (en compacto, como hoja inferior);
  - iconos lucide ya presentes (`copy`, `arrowUp`, `arrowDown`, `trash`, `x`) más `scissors`/`clipboardPaste` si faltan en `Icon`;
  - números en Geist Mono con `tabular-nums`.
- *Por qué no llega a 10:* hay que añadir dos iconos a `Icon.tsx`.

**Pase 6 · Adaptable y accesibilidad: 3 → 8.**
- *Problema.* Desde una tablet táctil (≥780 px) no se llega a ninguna función: todo aparece solo al pasar el ratón y no hay arrastre. La barra de 7 acciones no cabe en 360 px. La casilla no es alcanzable por teclado. `useGridNav` no filtra Alt, así que Alt+↑ movería el foco y la línea a la vez. No está definido dónde queda el foco tras borrar o pegar. Falta anunciar los cambios.
- *Decisión* (mecánica, P1): las obligaciones de diseño sobre táctil, móvil, teclado, foco, Esc y `aria-live`.
- *Por qué no llega a 10:* sin maquetas; la verificación a 360 px y a unos 780 px se hará con `/design-review` en vivo.

**Pase 7 · Decisiones que quedaban abiertas**

| Decisión | Resuelta |
|---|---|
| Dónde vive la barra | franja propia pegajosa; nunca tapa el total |
| Pegar con ratón y ya hay líneas | «Pegar N líneas» siempre en el pie mientras el portapapeles interno tenga líneas |
| Destino del pegado | selección → foco → final, igual para teclado y botón; el botón fija el destino al pulsar |
| Táctil ancho | casilla y X siempre visibles, asa oculta (`hover: none`) |
| Móvil | barra de iconos (Copiar, Más, ✕) sobre la BottomTabBar; sin ⋮ por tarjeta |
| Foco tras cada acción | reglas en las obligaciones |
| Orden de Esc | overlay → edición → selección → cortado → (cerrar partida, lo existente) |
| Aspecto del cortado | contorno discontinuo + etiqueta «cortada»; sigue editable |
| Avisos | un único hueco, tres tonos, texto en dos líneas; los errores de pegado van en línea |
| Guarda de certificadas + formas + líneas que faltan | UN diálogo de revisión (`Modal`), foco inicial en Cancelar |
| Ctrl+V fuera del grid | pega en la partida abierta y cambia a la pestaña Medición (taste, ver gate) |
| Respaldo sin evento `paste` | se quita el `setTimeout(0)`; a los 500 ms sale una pista que manda al botón |

**NOT in scope (diseño)**
- Marca «C» en las líneas certificadas dentro de la tabla de medición. Añade ruido a la rejilla más usada; el diálogo ya lista las líneas afectadas por comentario.
- Vista previa con asignación de columnas para TSV ajeno (Codex #1b). El formato canónico está documentado y el aviso A→B con Deshacer lo cubre.
- Maquetas generadas. Se reservan a `/design-shotgun` después de aprobar.

**Qué ya existe (diseño):**
- `docs/DESIGN.md` (tokens, `.tap-target`, reglas de rojo y ámbar);
- `.row.selected` y la guía de arrastre `.dropBefore/.dropAfter`;
- `lineCheck` de certificaciones;
- `Modal` (con modo `compact`);
- `Toast` con acción;
- `isTouchOnly()` y el patrón `@media (hover: none)` de `Sidebar.module.css`;
- `icon-btn` / `tap-target`.

**TODOS (diseño):** ninguno nuevo. Los aplazados son las exclusiones de arriba y quedan documentadas aquí.

**Resumen de diseño**

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md en docs/; UI: tabla, tarjetas,    |
  |                      | avisos, Modal, barra de estado              |
  | Step 0               | 5/10; foco en todas las dimensiones         |
  | Pass 1  (Info Arch)  | 5/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 4/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 5/10 → 8/10 after fixes                     |
  | Pass 4  (AI Slop)    | 7/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 6/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 3/10 → 8/10 after fixes                     |
  | Pass 7  (Decisions)  | 12 resolved, 0 deferred (1 taste → gate)    |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (autoplan), 0 approved          |
  | Decisions made       | 14 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 3/10 → 8/10                                 |
  +====================================================================+
```

<!-- autoplan-baseline-edits:design {"sourceSha256":"1b67c27d662515151582a6ab50380177bf8a6d4f3bc4938c8bbb09f5d57a83b8","replacements":[{"oldText":"- Escritorio: nueva columna estrecha a la izquierda del Comentario con el ASA de\n  arrastre y una casilla de selección (aparece al pasar el ratón o si hay selección).\n  Click = alterna; Shift+click = rango desde la última marcada.\n- Barra de selección (sustituye al pie mientras hay selección): «N líneas ·\n  Copiar · Duplicar · Subir · Bajar · Eliminar · ✕ (quitar selección)».","newText":"- Escritorio: nueva columna estrecha a la izquierda del Comentario con el ASA de\n  arrastre y una casilla de selección. Se ven al pasar el ratón, con el foco dentro de la\n  fila (`:focus-within`), si hay selección, y SIEMPRE en táctil (`hover: none`, donde el\n  asa se oculta porque no hay arrastre). Click = alterna; Shift+click = rango desde la\n  última marcada.\n- Barra de selección: franja PROPIA y pegajosa; NO sustituye al pie (el pie y la\n  «Cantidad total» siguen visibles). Contenido y variantes en las obligaciones de la\n  fase de diseño."},{"oldText":"  - `Ctrl/⌘+V`: pega las líneas del portapapeles detrás de la línea con el foco (o al\n    final si el foco no está en una fila).","newText":"  - `Ctrl/⌘+V`: pega detrás de la última línea seleccionada; sin selección, detrás de\n    la línea con el foco; si no, al final. La misma regla en todas partes (botones incluidos)."},{"oldText":"- Menú ⋮ por tarjeta: Subir, Bajar, Duplicar, Copiar línea, Eliminar (sin arrastre,\n  como las partidas).\n- Botón «Pegar N líneas» en el pie de la medición cuando el portapapeles tiene líneas.","newText":"- Sin menú ⋮ por tarjeta: la casilla de cada tarjeta y la barra de selección son la\n  única superficie de acciones (sin arrastre, como las partidas).\n- Botón «Pegar N líneas» en el pie de la medición cuando el portapapeles interno tiene\n  líneas, en tarjetas Y en la tabla de escritorio."},{"oldText":"Nuevos: `hooks/useMedLineHotkeys.ts` (+test), `features/presupuesto/MedLineMenu.tsx`\n(menú ⋮ de tarjeta), `features/presupuesto/MedSelectionBar.tsx`, tests de store y UI.","newText":"Nuevos: `hooks/useMedLineHotkeys.ts` (+test), `features/presupuesto/MedSelectionBar.tsx`,\n`features/presupuesto/MedPasteReview.tsx` (diálogo único de revisión), `core/medTsv.ts`,\ntests de store y UI. Editados además: `layout/Toast.tsx`, `store/toastStore.ts`,\n`hooks/useGridNav.ts`, `styles/tokens.css`."}]} -->

<!-- autoplan-accepted:design -->
- **Capas y pie:**
  - El pie de la medición conserva siempre «Añadir línea», «Pegar N líneas» (cuando toque) y la cantidad.
  - Sin líneas y con cantidad fija, la cantidad dice «Cantidad fija A ud»; con líneas, «Cantidad total B ud».
  - La barra de selección NUNCA sustituye al pie.
- **Barra de selección** (`MedSelectionBar`): franja propia `position: sticky; bottom: 0` dentro del contenedor con scroll, encima de la StatusBar. En móvil va sobre la BottomTabBar, con `env(safe-area-inset-bottom)`.
  - Escritorio: «N líneas · Σ <suma de parciales> <ud>» + Copiar · Cortar · Duplicar · Subir · Bajar · Eliminar (en `--state-danger`) + ✕ quitar selección.
  - Subir y Bajar se deshabilitan cuando la selección toca el borde.
  - Móvil (<760): recuento y Σ + Copiar + «Más» (Cortar, Duplicar, Subir, Bajar, y Eliminar en rojo separado) + ✕. Son botones de icono con `aria-label` y áreas táctiles de 44 px que no se solapan.
  - Orden de apilado de abajo arriba: BottomTabBar, barra, aviso.
- **Pegar con ratón:**
  - «⧉ Pegar N líneas» siempre en el pie (tabla Y tarjetas) mientras el portapapeles interno tenga líneas. Tooltip: «N líneas de <código> · medidas por <forma> · Ctrl+V».
  - Si hay destino, el texto añade en gris «tras «<comentario>»».
  - Si el portapapeles tiene un cortado de la misma obra, el botón dice «Mover N líneas aquí». Si viene de otra obra, «Pegar N líneas como copia».
  - El botón fija el destino (selección → foco → final) en `pointerdown`, antes de que el foco lo deje.
- **Destino del pegado**, única regla para teclado y botones: detrás de la última línea seleccionada; sin selección, detrás de la línea con el foco; si no, al final.
- **Táctil**, `@media (hover: none)`, con independencia del ancho: la casilla de selección y la X de borrar se ven SIEMPRE (esto arregla también la X que hoy es invisible en tablet) y el asa de arrastre se oculta.
  - Los textos de ayuda, del estado vacío y de los tooltips usan `isTouchOnly()`.
  - Tarjetas (`MedCards`): casilla + comentario + X. Se quita el menú ⋮ por tarjeta y la barra es la única superficie de acciones.
- **Selección:**
  - Se guarda en `DetailPanel`, así que sobrevive al paso de tabla a tarjetas.
  - Entrar a editar una celda, o hacer click en una fila fuera de la selección, la vacía.
  - `dragstart` también la vacía (el arrastre mueve una línea).
  - Tras pegar o duplicar, las líneas nuevas quedan seleccionadas.
  - Estilo: fondo `--accent-soft` + el inset de acento de `.row.selected`, compatible con la guía de arrastre y con el cortado.
- **Casilla y asa:**
  - La casilla reutiliza el patrón `lineCheck` (`button role="checkbox"`, `aria-checked`, `aria-label` «Seleccionar línea: <comentario>»), con `tabIndex=-1` para no romper el Tab de hoja de cálculo.
  - Se ven con `:hover`, con `:focus-within` de la fila, con selección y en táctil.
- **Teclado:**
  - `Shift+Espacio` en una celda en reposo alterna la selección de su fila.
  - `Shift+↑/↓` amplía la selección desde la fila ancla y mueve el foco.
  - `Alt+↑/↓` mueve las líneas.
  - `useGridNav` ignora los eventos con Alt, Ctrl o Meta.
  - El hook de medición consume cada evento una sola vez (`stopPropagation`).
  - Funciona también en las tarjetas.
- **Foco tras cada acción:**
  - Borrar: la misma columna de la fila siguiente; si no hay, la anterior; si la lista queda vacía, «Añadir línea».
  - Pegar o duplicar: el comentario en reposo de la primera línea nueva, con `scrollIntoView({ block: 'nearest' })`.
  - Subir o Bajar desde la barra: el foco sigue en el botón y la barra sigue abierta.
  - Alt+↑/↓: el foco sigue a la línea.
  - Al cerrar un diálogo: se sobrescribe el foco que `Modal` devuelve para aplicar estas reglas.
  - Tras Deshacer: la primera línea afectada si existe; si no, la primera fila; si no, «Añadir línea».
- **Esc**, por orden: overlay abierto → edición de celda → selección → cortado pendiente (aviso «Corte cancelado») → lo que ya existía (cerrar la partida). El hook de medición consume el Esc que usa, para que `useAppHotkeys` no cierre la partida.
- **Cortado visible:** contorno discontinuo `1px dashed var(--accent)` en las filas o tarjetas cortadas, más la etiqueta de texto «cortada». NO se usa opacidad. Siguen editables.
  - Chip en la StatusBar: «N líneas cortadas · <código> <título>», con ✕ para cancelar.
  - En móvil, el botón «Mover N líneas aquí» y un enlace «Cancelar corte» en el pie.
- **Avisos:**
  - Un único hueco: los avisos de copiar y cortar pasan por `toastStore` (o `ClipboardToast` se oculta cuando `Toast` muestra), así que nunca hay dos a la vez.
  - `toastStore.show` admite `tone: 'ok' | 'warn' | 'error'`, con icono (check / alerta) y color (`--accent` / `--state-warn` / `--state-danger`).
  - El texto puede ir en dos líneas (sin `nowrap`) y el botón de acción no encoge.
  - Mientras tenga el ratón encima o el foco, el aviso no se cierra.
  - El aviso con Deshacer se cierra en cuanto cambia el historial de dominio, así que nunca se muestra un Deshacer que ya no sirve.
  - En compacto, los textos se acortan («3 líneas pegadas · 1.234,56 → 2.469,12 kg»).
  - Reordenar nunca muestra aviso: se anuncia por `aria-live`, «Línea movida a la posición 3 de 6».
- **Errores de pegado en línea:** el TSV rechazado muestra una franja `role="alert"` en `--state-danger` bajo la tabla o tarjetas, con fila, columna, valor y corrección. Se va al pulsar ✕ o al pegar bien.
  - Ejemplos: «No se pudo pegar: fila 3, Largo «1.234» es ambiguo. Pégalo sin separador de miles»; «Solo se pegan hasta 500 filas»; «Fila 2: 6 columnas; admite comentario y 4 casillas».
  - Los demás motivos se distinguen, cada uno con su texto: sin destino → «Abre una partida para pegar las líneas»; partida inexistente → «No se pudo pegar: la partida ya no existe»; portapapeles vacío → nada; borde de Subir/Bajar → botón deshabilitado.
  - Las acciones del store devuelven `{ ids, reason }` para que la UI sepa cuál aplicar.
- **Diálogo único de revisión** (`MedPasteReview`, sobre `Modal`; en compacto, hoja inferior). Reúne en UNA confirmación cada problema que exista:
  - **Formas incompatibles.** Título «Esta partida se mide de otra forma». Origen «<código> · <forma> · <cols> · <ud>» → destino «<código> · <forma> · <cols> · <ud>». Las casillas cuyo significado cambia van en `--state-warn` (p. ej. «kg/m → Anchura»). Texto «Se reinterpretan las cifras; no se convierten unidades». Cantidad Y importe del destino antes → después, ya calculados con el perfil del comentario.
  - **Líneas certificadas.** Las afectadas por comentario (hasta 5, luego «y N más») y las certificaciones (C1, C3). Texto «Lo ya certificado se queda en <código origen>; las líneas en destino empiezan sin certificar» (al mover) o «La certificación conserva su importe, pero no verá la línea» (al borrar).
  - **Líneas del cortado que ya no existen.** «Mover las M restantes», o «Pegar la copia guardada» si no queda ninguna.
  - Acción principal única y específica: «Pegar tal cual», «Mover N líneas» o «Eliminar N líneas» (en rojo al borrar). El foco inicial va a Cancelar. Cancelar no cambia nada.
  - Sustituye, en la obligación CEO de Cortar, el «se omiten con aviso / se pega la instantánea como copia con aviso»: ahora lo decide el usuario en este diálogo.
- **Aviso al mover:** incluye origen y destino, «3 líneas movidas · EAV010 2.817,23 → 520,00 · EAV011 0,00 → 2.297,23 kg». Si el origen se queda sin líneas y tenía cantidad fija, lo dice.
- **Pegado con teclado sin carrera de tiempos** (sustituye el respaldo `setTimeout(0)` de la obligación CEO):
  - Ctrl/⌘+V pega SOLO con el evento `paste` real.
  - Si a los 500 ms del keydown no ha llegado ninguno y el portapapeles interno tiene líneas, aparece la pista «Pulsa «Pegar N líneas» para pegar lo copiado en Concreta». Es solo una pista: nunca cambia datos.
  - Test con fake timers: el `paste` llega tarde (sigue pegando una sola vez) y no llega nunca (solo la pista).
- **Copiar al sistema:** si `writeText` rechaza, aviso en tono advertencia «Copiado en Concreta; no disponible para Excel» (sustituye el «si falla, no avisan» de la obligación CEO).
  - `consumedTsv` se vacía con cualquier copia o cortado interno nuevo, así que solo bloquea el mismo TSV de un cortado ya pegado.
- **Ctrl/⌘+V con líneas en el portapapeles**, foco fuera del grid y una partida abierta: pega en esa partida y, si estaba en Descripción o Justificación, cambia a la pestaña Medición, para que el cambio se vea.
  - Sin partida abierta: aviso «Abre una partida para pegar las líneas».
  - Ctrl/⌘+D solo actúa con el foco en reposo (dentro de un input manda el navegador). La ayuda dice «Ctrl+D duplica la línea (no rellena hacia abajo)».
- **Iconos:** se añaden a `Icon.tsx` los de lucide para cortar y pegar si faltan (`scissors`, `clipboardPaste`).
- **Tests de UI:**
  - render bajo `(hover: none)` simulado con `matchMedia` → casillas y X visibles, asa ausente;
  - barra en compacto con «Más»;
  - foco tras borrar, pegar y Deshacer;
  - orden de Esc (la selección se vacía antes de cerrar la partida);
  - un solo aviso visible tras Ctrl+C seguido de Ctrl+V;
  - aviso de error con tono `error` y franja en línea;
  - el Deshacer del aviso desaparece tras otra edición;
  - `aria-live` al mover;
  - diálogo de revisión con formas incompatibles + certificadas a la vez.
- **Verificación visual** a 360 px y alrededor de 780 px de ancho útil con `/design-review` tras implementar.
<!-- /autoplan-accepted:design -->

### Fase 3 · Ingeniería (autoplan, 2026-09-24)

**Paso 0 · Reto de alcance.** Se ha leído el código que el plan cita: `estructuraSlice`, `temporal`, `clipboardStore`, `usePartidaClipboard`, `useReorderDrag`, `useGridNav`, `useMedGridTab`, `useAppHotkeys`, `hotkeyGuards`, `DetailPanel`, `MedCards`, `MedCells`, `PartidaRow`, `Partidas`, `PartidasTable`, `PartidaCard`, `Toast`, `toastStore`, `money`, `expresion`, `medForma`, `medicion`, `CertTable` y `ai/executor`.

- **Complejidad.** Unos 20 ficheros y 8 módulos nuevos: `medTsv`, `medPaste`, `medUiStore`, `useMedClipboard`, `useMedLineKeys`, `MedLineRow`, `MedSelectionBar` y `MedPasteReview`. Salta el umbral de complejidad.
  - **Decisión:** no se reduce, porque la regla de autoplan en ingeniería es no recortar (P2).
  - **Mitigación:** implementar en DOS etapas dentro del mismo plan. La Etapa A es el núcleo con el portapapeles interno; la Etapa B, el TSV del sistema y Cortar, que es donde se concentra el riesgo de navegador según las dos voces.
- **Mínimo que cumple la petición:** la Etapa A.
- **Búsqueda:** no se ha usado ni Aside ni la web. Los comportamientos de navegador que no se pueden probar aquí (el evento `paste` en Safari con el foco fuera de un campo, cómo muestra Excel el `'`) no se afirman: quedan como verificación manual en el plan de pruebas.
- **TODOS:** T-19 (pestaña de solo lectura) no bloquea. Esta fase escribe en TODOS.md los aplazados de todas las fases.
- **Distribución:** no hay artefactos nuevos; se despliega como PWA, igual que hoy.

**Voces de ingeniería**
- **Subagente Claude** (INPUT `eng d0671cef…`, completado): 4 altos, 11 medios y 13 bajos.
  - Altos:
    - H1: la agrupación de 700 ms rompe «un paso de Deshacer» y el Deshacer protegido.
    - H2: con el foco en el cuerpo de la página (macOS Safari/Firefox al hacer click en botones), los atajos acaban en la partida.
    - H3: `writeText` no existe en http, así que Ctrl+V pega texto del sistema desfasado.
    - H4: «1,234.56» se lee 1000 veces menor.
  - Medios:
    - M1: `[data-editgrid]` no identifica la medición.
    - M2: la selección local no sobrevive a tabla ↔ tarjetas.
    - M3: el cortado se busca por `chapterId`.
    - M4: el ancla puede caer dentro de lo que se mueve.
    - M5: las teclas chocan con los manejadores de las celdas.
    - M6: el TSV es ingenuo (comillas y disposición por fila).
    - M7: falta `-` entre los prefijos contra fórmulas.
    - M8: `Toast` no se oculta al hacer `clear()`.
    - M9: falta una operación preparada compartida.
    - M10: entrada degenerada.
    - M11: la compatibilidad ignora `ud` y las columnas fuera de la forma.
- **Codex** (completado): 12 hallazgos.
  - Altos:
    - 1: un `set` no es un paso de Deshacer.
    - 2: normalizar el TSV convierte un comentario numérico en uds.
    - 3: `Infinity` y ambigüedad dentro de operaciones.
    - 4: la igualdad de texto no autoriza un movimiento destructivo.
    - 5: ancla dentro del bloque cortado.
    - 6: el cortado vivo y los metadatos de la instantánea pueden no coincidir.
    - 7: hace falta un enrutador global.
  - Medios:
    - 8: fase de captura.
    - 9: la selección se pierde al cambiar de árbol.
    - 10: `activeId` es null en la demo.
    - 11: `Toast` no se oculta al hacer `clear()`.
  - Bajo:
    - 12: el aviso de certificadas exagera lo que se pierde.

Salida de Codex, resumida por hallazgo:

```tool-output
1 High — temporal.ts:139 sliding 700 ms coalescing: one set ≠ one undo step; no revision token → history boundaries + domain revision; tests edit→paste and paste→edit within 700 ms.
2 High — TSV normalization loses schema: "'123⇥⇥⇥⇥" → trimmed → apostrophe stripped → uds=123 (money). Separate compare-normalization from parsing; reversible escaping; quote-aware fields.
3 High — money.ts:53 accepts Infinity; ambiguity regex misses "-1.234", "1.234+2" → finiteness validation + per-token ambiguity detection.
4 High — text equality authorizes a destructive cut; consumedTsv blocks legitimate copies → explicit cut identity, provenance with plain text, confirm when only text matches.
5 High — same-partida cut/paste: anchor is a moving row → translate against original order; no-op must not consume the cut nor error.
6 High — cut live rows vs snapshot metadata disagree → one prepared operation for preview and commit, revalidated before commit.
7 High — grid-local hook can't do global paste; data-editgrid also on partida rows (PartidaRow.tsx:108) → one clipboard router with grid-kind markers.
8 Medium — bubbling can't enforce precedence (MedCells.tsx:210 opens editor on Space) → capture phase / modifier-aware cells, defaultPrevented checks.
9 Medium — DetailPanel remounts across Partidas.tsx table/cards switch → lift selection/tab above the switch.
10 Medium — sessionStore.activeId null for the unsaved demo (sync.ts:125) → stable in-memory document identity.
11 Medium — Toast.tsx:17 caches msg/action; clear() doesn't hide it → reactive dismissal + render tests.
12 Low — CertTable.tsx:47/80 already shows deleted certified lines with qty → warning must say comment/dimensions are lost, qty kept; regression test.
Recommendation: Revise before implementation because the current contracts can reinterpret comments as quantities, authorize destructive moves from text equality, and undo unrelated edits.
OUTSIDE_STATUS: completed provider=codex host=claude
```

```
ENG DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               no      no     CONFIRMED (enrutador, store de UI, op. preparada)
  2. Test coverage sufficient?         no      no     CONFIRMED (<700 ms, http, Safari, TSV hostil)
  3. Performance risks addressed?      no      parcial CONFIRMED (entrada degenerada → topes)
  4. Security threats covered?         no      no     CONFIRMED (inyección de fórmulas, Infinity, `'`)
  5. Error paths handled?              no      no     CONFIRMED (deshacer agrupado, http, cortado obsoleto)
  6. Deployment risk manageable?       sí      —      N/A (Codex no se pronuncia; sin migración)
═══════════════════════════════════════════════════════════════
```

No hay ningún hallazgo crítico de una sola voz. Los dos «Revise» se atienden con las obligaciones de esta fase.

**Sección 1 · Arquitectura**

```
                         App
   ┌──────────────────────┼─────────────────────────────┐
   │ useClipboardHotkeys  │ useMedClipboard (NUEVO)      │ useAppHotkeys
   │ (partidas; cede C/X  │  keydown C/X/D/Esc +         │ (Esc cierra la partida
   │  con contexto de     │  copy/cut/paste del documento│  solo si medUiStore no
   │  medición, V con     │  ─ contexto: foco en         │  tiene nada que cancelar)
   │  líneas)             │    [data-medgrid] o selección│
   └──────────┬───────────┴──────────────┬───────────────┘
              │                          │
              ▼                          ▼
     clipboardStore             medUiStore (NUEVO, efímero, fuera de DOMAIN_KEYS)
     { items | medLines,        { partidaId, tab, selected, anchorId,
       tsv, cutId, sysClipOk,     lastFocusedLineId, pendingFocus, cut }
       consumed }                        ▲            │
              │                          │            ▼
              ▼                  Partidas ─┬─ PartidasTable ─ PartidaRow ─ DetailPanel ─┬─ MedLineRow ×N (NUEVO)
     core/medTsv (NUEVO, puro)             └─ PartidasCards ─ PartidaCard ─ DetailPanel ─┤  [data-medgrid][data-lineid]
     core/medPaste (NUEVO, puro) ◄───────── MedPasteReview (NUEVO, Modal)                 ├─ MedCards (compact)
              │  prepararPegado()                                                        ├─ MedSelectionBar (NUEVO)
              ▼                                                                          └─ useMedLineKeys (captura)
     obraStore.estructuraSlice ── moveMedLine · moveMedLinesBy · insertMedLines · duplicateMedLines
       (immer set)                 · deleteMedLines · moveMedLinesTo  → MedResult { ids, reason }
              │ suscripción
              ├──► temporal: historyCheckpoint() · domainRevision ──► Toast (tonos, se oculta con clear)
              └──► autosave
     Cert.lineQty (solo lectura: guarda de certificadas)
```

Hallazgos de la sección, con decisión y confianza:
1. **Los atajos globales no pueden depender solo del foco.** (9/10; `useClipboardHotkeys` en `usePartidaClipboard.ts:69-103`, `PartidaRow.tsx:108` con `data-editgrid`.) Decisión: enrutador global + `data-medgrid` + `medUiStore`.
2. **La selección local se pierde al cambiar de árbol.** (9/10; `Partidas.tsx:23-26`, `PartidaCard.tsx:137`.) Decisión: `medUiStore`.
3. **Vista previa y acción pueden divergir.** (8/10.) Decisión: `core/medPaste.ts` como operación preparada con revalidación.
4. **Un cortado no puede autorizarse por igualdad de texto.** (8/10.) Decisión: tipo MIME propio con id de cortado, y preguntar si solo coincide el texto.

Escenario de fallo real: una edición y un pegado a menos de 700 ms comparten la misma entrada de historial. Queda cubierto por `historyCheckpoint()`. Rollback: `git revert`, sin migración.

**Sección 2 · Calidad de código**
- **DRY.**
  - Un solo helper para construir líneas (`addMedLines` + `insertMedLines`).
  - Un solo helper de «sacar e insertar antes de» para líneas.
  - `lineCheck` pasa a un CSS compartido (hoy está en `Certificaciones.module.css`).
  - Una sola consulta táctil (`isTouchOnly()`), en vez de `(hover: none)` en el CSS y `(hover: none) and (pointer: coarse)` en JS.
- **Nombres.** `moveMedLine` (reordenar dentro de una partida) frente a `moveMedLinesTo` (mover entre partidas). Se mantienen, con JSDoc que dice qué conserva ids y qué no.
- **Casos límite ya contados en las obligaciones:** no-op sin mutación, ancla dentro del bloque, origen buscado por `partidaId`, `ud` en la compatibilidad, `Infinity` y topes de tamaño.
- **Diagramas ASCII en el código:** `core/medPaste.ts` (flujo preparar → revisar → aplicar) y `useMedClipboard.ts` (cómo se resuelve un pegado). `useReorderDrag.ts` necesita actualizar su cabecera al añadir `'medline'`.
- **Defecto existente arreglado:** `Toast.tsx` no se ocultaba con `clear()`.

**Sección 3 · Tests**

Framework: vitest 4 + Testing Library + user-event + jsdom (`package.json`); `fake-indexeddb` para la persistencia.

```
CODE PATHS                                                     USER FLOWS
[+] store/slices/estructuraSlice.ts                            [+] Copiar → otra partida → pegar
  ├── moveMedLine        [PLAN ★★★] sitio igual=no-op,          ├── [PLAN ★★★] botón del pie (2.7 con líneas)  MedLinesClipboard.test.tsx
  │                       id inexistente, fromBase               ├── [PLAN ★★★] Ctrl+C / Ctrl+V (foco en celda y en body)
  ├── moveMedLinesBy     [PLAN ★★★] contiguo, no contiguo,       └── [PLAN ★★ ] Deshacer desde el aviso
  │                       borde detiene el bloque               [+] Reordenar
  ├── insertMedLines     [PLAN ★★★] ids nuevos, expr profundo,    ├── [PLAN ★★★] arrastre (DataTransfer simulado) MedLineReorder.test.tsx
  │                       afterId null/desconocido, peso destino ├── [PLAN ★★★] Alt+↑/↓ + el foco sigue
  │                       partida inexistente → reason            └── [PLAN ★★ ] Subir/Bajar de la barra, deshabilitados en borde
  ├── duplicateMedLines  [PLAN ★★ ] orden, tras la última       [+] Duplicar Ctrl+D / barra  [PLAN ★★ ]
  ├── deleteMedLines     [PLAN ★★ ] bloque, ids inexistentes    [+] Cortar → otra partida → Deshacer [PLAN ★★★] (Etapa B)
  └── moveMedLinesTo     [PLAN ★★★] misma partida conserva ids, [+] Diálogo de revisión
                          otra da ids nuevos, origen por           ├── [PLAN ★★★] Peso→Superficie, Longitud→Superficie no, TSV ajeno no
                          partidaId, ancla dentro, stale,          ├── [PLAN ★★★] certificadas: confirmar / cancelar / sin certificar
                          todas desaparecidas                       └── [PLAN ★★ ] faltantes: «Mover las M restantes» / «copia guardada»
[+] store/temporal.ts                                          [+] Selección
  ├── historyCheckpoint  [PLAN ★★★] editar→pegar <700 ms        ├── [PLAN ★★★] click, Shift+click, Shift+Espacio (no abre editor)
  └── domainRevision     [PLAN ★★★] pegar→editar <700 ms        ├── [PLAN ★★ ] Shift+↓ mueve el foco UNA vez
[+] store/medUiStore.ts  [PLAN ★★★] reset, poda tras deshacer,  └── [PLAN ★★★] cruzar tabla↔tarjetas con el árbol real de Partidas
                          pestaña                               [+] Esc: overlay→edición→selección→cortado→partida [PLAN ★★★]
[+] store/clipboardStore.ts [PLAN ★★] exclusión items/medLines,[+] Táctil (matchMedia simulado): casilla/X visibles, sin asa [PLAN ★★]
                          consumed se vacía con copia nueva      [+] Avisos
[+] core/medTsv.ts       [PLAN ★★★] serializar (prefijos, precisión),├── [PLAN ★★★] un solo aviso tras Ctrl+C→Ctrl+V
                          normalizar, parsear (comillas, disposición, ├── [PLAN ★★★] tono error + franja en línea
                          `'`, EE. UU., miles, 0.ddd, Infinity,      └── [PLAN ★★★] se oculta con clear/undo/loadObra (Toast.render.test.tsx)
                          topes, >5 celdas, 500 filas, degenerado) [+] Ayuda: filas nuevas en «Líneas de medición» [PLAN ★]
[+] core/medPaste.ts     [PLAN ★★★] compat (rótulo, fuera, ud),
                          certificadas, A→B cantidad e importe, ancla
[+] hooks/useMedClipboard.ts [PLAN ★★★] contexto, C/X/D/V/Esc, copy event + writeText (indefinido/rechazado),
                          sysClipOk, resolución (rico/consumido/ajeno/vacío), respaldo de partidas, pista 500 ms (fake timers)
[+] hooks/useMedLineKeys.ts [PLAN ★★★] captura Alt, Shift+Espacio, Shift+↑/↓
[+] hooks/useGridNav.ts  [PLAN ★★ ] ignora modificadores y defaultPrevented; flechas sin modificador siguen navegando
Manual: Safari/Firefox macOS · Excel/Sheets · /design-review 360 y ~780 px   (no automatizables en jsdom)

COVERAGE (del plan): 100 % de las rutas nuevas con test asignado | hoy 0 % (código nuevo)
REGRESIONES (IRON RULE, críticas y obligatorias):
  R1 Ctrl+C en una celda de la FILA de partida sigue copiando la partida (usePartidaClipboard.test)
  R2 flechas sin modificador siguen navegando en la medición y en PartidasTable (MedGridTab.test)
  R3 la X de una línea SIN certificar sigue borrando sin diálogo (MedCells/DetailPanel test)
  R4 Ctrl+V con partidas en el portapapeles sigue pegando partidas (usePartidaClipboard.test)
  R5 teclear seguido en ObraModal sigue siendo UNA entrada de Deshacer (temporal.test)
  R6 CertDetail sigue mostrando «Línea eliminada…» con su cantidad tras borrar una certificada (Certificaciones.test)
  R7 los avisos existentes («Deshacer» de borrar partida, «copiada») siguen apareciendo (UndoRedoButtons/Toast tests)
```

El plan de pruebas está escrito en disco: `~/.gstack/projects/jramirezbandera-concreta-mediciones/javie-main-eng-review-test-plan-20260924-173319.md`. No hay LLM ni prompts afectados, así que no aplican evals; el snapshot del asistente no cambia de forma.

**Sección 4 · Rendimiento**
- La selección vive en `medUiStore`. Cada fila se suscribe con un selector `selected.includes(id)`, así que al marcar una casilla solo se re-renderizan las filas cuyo estado cambia, no la tabla entera. Es el mismo patrón que `PartidaRow` memoizada (T1.1).
- `prepararPegado` es O(n·4).
- El TSV tiene topes: 200 000 caracteres, 500 filas y 200 caracteres por casilla. Así el O(n²) de `leerPerfil` y la recursión de `evalEsExpr` quedan acotados.
- `historyCheckpoint()` es O(1).
- Sin más hallazgos: la tabla de medición no está virtualizada, igual que hoy, y una partida con cientos de líneas ya funciona así.

**NOT in scope (ingeniería)**
- Pegar sobrescribiendo celdas (TODO).
- Compartir el portapapeles interno entre pestañas (BroadcastChannel): el TSV del sistema ya cubre la vía texto.
- Tests automáticos en Safari: son verificación manual.
- Guarda de certificadas en `borrar_linea` del asistente de IA: la confirmación es aprobar la propuesta, y queda documentado.
- Virtualizar la tabla de medición.

**What already exists (ingeniería):**
- `useReorderDrag`: se reusa, añadiendo `'medline'` a `ReorderDrag.kind`.
- `reorderPartidaIn`: sirve de patrón para el helper de lista.
- `nextMedLineId` (uuid).
- `pesoDelComentario` / `pesoDesdeComentario`.
- `leerCelda`, `toDecimalComma` y `parseEsNumber`: se envuelven con validación por token.
- `medColumnas` / `medFormaDef`.
- `hotkeyGuards`.
- `toastStore` con acción: se amplía con tonos.
- `Modal` (compact): se amplía con `initialFocus`.
- `isTouchOnly`.
- `CertDetail` D-09.
- El ejecutor del asistente, que ya resuelve líneas por `lineId`.

**Registro de modos de fallo (ingeniería)**

```
  RUTA                          | FALLO REALISTA                         | TEST | MANEJO               | USUARIO VE
  ------------------------------|----------------------------------------|------|----------------------|-----------------------
  pegar tras editar (<700 ms)   | Deshacer revierte también la edición   | S    | historyCheckpoint    | Deshacer exacto
  Ctrl+C en http                | writeText no existe → texto desfasado  | S    | copy event + sysClip | aviso advertencia
  ⌘V en Safari (foco en body)   | no llega `paste`                       | man. | pista 500 ms + botón | pista
  cruzar punto de corte         | se pierde la selección                 | S    | medUiStore           | selección intacta
  Shift+Espacio en celda        | abre el editor                         | S    | captura + keyup      | selección
  TSV «1,234.56»                | 1,23456                                | S    | rechazo por token    | franja fila/col
  TSV «'123⇥⇥⇥⇥»                | 123 uds (dinero)                       | S    | `'` = texto          | comentario
  cortado por texto igual       | borra filas de origen                  | S    | MIME propio / pregunta | diálogo
  origen movido de capítulo     | no encuentra líneas → duplica          | S    | búsqueda por partidaId | mueve bien
  ancla dentro del bloque       | destino indefinido                     | S    | traducción al orden original | orden esperado
  Toast tras clear/undo         | Deshacer muerto visible                | S    | render reactivo      | desaparece
  portapapeles degenerado       | RangeError / congelación               | S    | topes + try/catch    | franja de error
  «1e400»                       | Infinity en el PEM                     | S    | validación finita    | franja de error
```

Sin CRITICAL GAP: todas las filas tienen test o verificación manual con manejo y mensaje visible.

**Paralelización (worktrees)**

| Etapa | Módulos | Depende de |
|---|---|---|
| Núcleo puro (`medTsv`, `medPaste`) | `core/` | — |
| Store (acciones, temporal, `medUiStore`, `clipboardStore`) | `store/` | — |
| Hooks (`useMedClipboard`, `useMedLineKeys`, `useGridNav`) | `hooks/` | store |
| UI (`MedLineRow`, `MedSelectionBar`, `MedPasteReview`, `DetailPanel`, `MedCards`, `Toast`) | `features/presupuesto/`, `layout/`, `components/` | store, hooks, core |

- Carril A: núcleo puro, independiente.
- Carril B: store → hooks, secuencial (los hooks leen el store).
- Carril C: UI, después de A y B.

Orden: lanzar A y B en paralelo, fusionar, y después C. Conflictos: B y C tocan `DetailPanel` solo en C, así que no hay choque si C va al final.

**TODOS.md:** escritos en esta fase (5 entradas; ver la sección nueva en `TODOS.md`).

**Resumen de ingeniería**
- Paso 0: alcance aceptado tal cual (autoplan no recorta), implementado en Etapa A y Etapa B.
- Arquitectura: 4 hallazgos (todos en las obligaciones).
- Calidad de código: 6 hallazgos.
- Tests: diagrama hecho, 12 huecos cubiertos en el plan y 7 regresiones obligatorias.
- Rendimiento: 1 hallazgo (entrada degenerada → topes).
- NOT in scope: escrito. What already exists: escrito.
- TODOS.md: 5 entradas escritas.
- Modos de fallo: 0 huecos críticos.
- Voz externa: Codex, completada.
- Paralelización: 3 carriles, 2 en paralelo y 1 secuencial.
- Lake Score: 9/9 recomendaciones eligieron la opción completa.
- Decisiones sin resolver: 0 (dos de gusto suben al gate).

<!-- autoplan-baseline-edits:eng {"sourceSha256":"ae7c60d0d15774149108959cda6c1a229da34cd5c00e45c73ec7a643c556a4c1","replacements":[{"oldText":"- `insertMedLines(chapterId, partidaId, lines: MedLine[], afterId: string | null): string[]`:","newText":"- `insertMedLines(chapterId, partidaId, lines: MedLine[], afterId: string | null): MedResult`\n  (`{ ids, reason? }`; ver obligaciones de ingeniería):"},{"oldText":"### 3. Selección de líneas (estado LOCAL del panel, no del store)","newText":"### 3. Selección de líneas (estado efímero de UI, fuera del dominio)"},{"oldText":"- `DetailPanel`/`MedCards` guardan `selected: Set<lineId>` en `useState` (efímero; se\n  vacía al cerrar la partida o cambiar de pestaña). Se poda al vuelo de ids que ya no\n  existan (borrado, deshacer).","newText":"- La selección vive en un store efímero `store/medUiStore.ts` (zustand, fuera del\n  dominio y del historial), no en `useState`: sobrevive al cambio tabla ↔ tarjetas y la\n  consultan los atajos globales. Se vacía al cambiar de partida abierta o de obra y se\n  poda de ids que ya no existan (borrado, deshacer)."},{"oldText":"- El manejo vive en un hook nuevo `hooks/useMedLineHotkeys.ts` colgado del contenedor\n  `[data-editgrid]` (no global), y `useClipboardHotkeys` cede cuando el foco está en\n  un grid de medición o cuando el portapapeles tiene líneas.","newText":"- El manejo se reparte en dos piezas (ver obligaciones de ingeniería): un enrutador\n  global `hooks/useMedClipboard.ts` montado en `App` (copiar, cortar, pegar, duplicar, Esc\n  y el evento `paste` del documento) y un hook local `hooks/useMedLineKeys.ts` en fase\n  de captura sobre `[data-medgrid]` (Alt+↑/↓, Shift+Espacio, Shift+↑/↓).\n  `useClipboardHotkeys` cede Ctrl+C/X solo en contexto de medición y Ctrl+V solo cuando\n  el portapapeles interno tiene líneas o el foco está en `[data-medgrid]`."},{"oldText":"- `MedCards`: menú ⋮ Subir/Bajar/Duplicar/Copiar y botón Pegar.","newText":"- `MedCards`: casilla por tarjeta, barra de selección compacta y botón Pegar."},{"oldText":"Nuevos: `hooks/useMedLineHotkeys.ts` (+test), `features/presupuesto/MedSelectionBar.tsx`,","newText":"Nuevos: `hooks/useMedClipboard.ts` y `hooks/useMedLineKeys.ts` (+tests), `store/medUiStore.ts`,\n`core/medPaste.ts`, `features/presupuesto/MedLineRow.tsx`, `features/presupuesto/MedSelectionBar.tsx`,"}]} -->

<!-- autoplan-accepted:eng -->
- **Precedencia:** si dos obligaciones se contradicen, manda la de la fase posterior (ingeniería > diseño > CEO). Este bloque sustituye explícitamente lo que se indica en cada punto.
- **Etapas, en el mismo plan y con commits ordenados:**
  - **Etapa A:**
    - acciones de store con cortes de historial;
    - `medUiStore` y el enrutador;
    - reordenar (arrastre, Alt+↑/↓, barra) y duplicar;
    - copiar y pegar con el portapapeles INTERNO;
    - diálogo de revisión (formas y certificadas);
    - barra, avisos, foco/Esc y táctil.
  - **Etapa B:** TSV del sistema (Excel ↔ Concreta) y Cortar/mover, si el gate los mantiene.
  - La Etapa A se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`) antes de empezar la B.
- **Historial** (`store/temporal.ts`):
  - Se añade `historyCheckpoint()`, que cierra la ventana de agrupado (`throttleUntil = 0`).
  - Se añade un contador monótono `domainRevision`, que sube con CADA cambio de dominio registrado (también los agrupados), expuesto con `getDomainRevision()`.
  - Las acciones estructurales de medición (pegar, duplicar, mover por cortar, borrar en bloque, reordenar) llaman a `historyCheckpoint()` antes y después: cada una es exactamente UN paso de Deshacer y nunca se funde con una edición contigua.
  - El Deshacer del aviso guarda la revisión tras la acción y solo actúa si `getDomainRevision()` no ha cambiado.
  - Tests: editar → pegar a <700 ms → Deshacer revierte solo el pegado; pegar → editar a <700 ms → el aviso ya no ofrece Deshacer.
- **Acciones del store:** van por id y devuelven `MedResult = { ids: string[]; reason?: 'no-partida' | 'no-lines' | 'noop' | 'stale' }` (sustituye `string[]` y el «vacío si no hacen nada»).
  - Un no-op (soltar en el sitio, Subir en el borde) sale antes de tocar el estado: sin entrada de historial, sin autosave y sin `fromBase = false`.
  - Un helper interno único construye las líneas (clon profundo con `expr`, id nuevo y `pesoDelComentario` del destino) para `addMedLines` e `insertMedLines`.
  - La partida de origen de un cortado se busca por `partidaId` en todo `PartidasMap`, no por el `chapterId` guardado.
  - Tests de cada acción: no-op sin entrada de Deshacer y conservando BASE; origen movido de capítulo.
- **Operación preparada:** módulo puro `core/medPaste.ts` con `prepararPegado(...)`, que devuelve:
  - líneas finales (tras `pesoDelComentario`);
  - compatibilidad (casillas que cambian);
  - certificadas y faltantes;
  - cantidad e importe antes y después del destino (y del origen al mover);
  - destino resuelto.
  - La MISMA estructura alimenta el diálogo y la acción de store.
  - La acción revalida dentro del `set` (partidas existentes, ids de origen presentes, contenido igual). Si algo cambió, devuelve `reason: 'stale'` y la UI vuelve a preparar y a mostrar el diálogo.
  - Diagrama ASCII del flujo en el propio módulo.
- **Compatibilidad** (sustituye la definición CEO). Es incompatible si:
  - (a) una casilla no vacía cambia de rótulo;
  - (b) una casilla no vacía cae fuera de las columnas de la forma destino;
  - (c) la ud normalizada difiere (minúsculas, sin punto final, `m2`→`m²`, `ml`→`m`).
  - El TSV ajeno solo se evalúa con (b).
  - Tests: Longitud→Unidades (b), m→m² (c), Peso→Peso (compatible).
- **Destino de un cortado pegado en la misma partida:**
  - El ancla se traduce sobre el orden ORIGINAL a la línea anterior más cercana que NO se mueve; si no hay ninguna, al principio.
  - Si el orden queda igual, es un no-op: no consume el cortado ni da error.
  - Tests: ancla dentro del bloque, selección no contigua, todas seleccionadas.
- **Estado de UI:** `store/medUiStore.ts` (zustand, efímero, fuera de `DOMAIN_KEYS`) con `{ partidaId, tab, selected, anchorId, lastFocusedLineId, pendingFocus, cut }`. Sustituye la selección en `DetailPanel` del bloque de diseño.
  - Se reinicia al cambiar `openPartidaId` y en `loadObra`/reset.
  - Se poda contra las líneas actuales tras cada cambio, también al deshacer.
  - `DetailPanel` lee `tab` de ahí.
  - Test: cruzar el punto de corte tabla ↔ tarjetas con el árbol real de `Partidas` conserva la selección y la pestaña.
- **Marcadores:** el contenedor de la medición (tabla y tarjetas) lleva `data-medgrid`, además de `data-editgrid`. Las filas de la tabla pasan a un componente `MedLineRow` con `data-lineid`.
  - Test de regresión: Ctrl+C en una celda de la FILA de partida sigue copiando la partida.
- **Enrutador de portapapeles:** `hooks/useMedClipboard.ts`, montado UNA vez en `App` e independiente de la pestaña.
  - **Contexto de medición:** foco dentro de `[data-medgrid]`, O selección activa en `medUiStore` para la partida abierta.
  - Con contexto, Ctrl/⌘+C, X, D y Esc actúan sobre líneas (Esc según el orden de diseño). Respeta `isTextEditingTarget`, `hasBlockingOverlay`, `hasNativeSelection` y la vista presupuesto.
  - **Pegar:** escucha el `paste` del documento. Con una partida abierta y el foco fuera de un campo de texto, resuelve líneas.
  - `useClipboardHotkeys` cede Ctrl+C/X solo con contexto de medición, y Ctrl+V solo cuando el portapapeles interno tiene líneas o el foco está en `[data-medgrid]`. En esos casos no llama a `preventDefault`.
  - `useAppHotkeys` no cierra la partida con Esc si `medUiStore` tiene selección o un cortado.
  - Tests de regresión: Ctrl+V con partidas en el portapapeles sigue pegando partidas; flechas sin modificador siguen navegando.
- **Foco en macOS:** en `pointerdown` de la casilla, el asa o la barra, el foco pasa explícitamente a la fila (`tabIndex=-1`) o a la barra. Los atajos consultan `medUiStore`, no solo el foco.
  - `lastFocusedLineId` se registra con `focusin`, así que el botón «Pegar» lo usa también si se activa desde el teclado.
  - Verificación manual en Safari y Firefox de macOS (plan de pruebas).
- **Teclas locales:** `hooks/useMedLineKeys.ts` en fase de CAPTURA (`onKeyDownCapture`) sobre `[data-medgrid]`.
  - Gestiona Alt+↑/↓, Shift+Espacio y Shift+↑/↓. En Shift+Espacio llama a `preventDefault` en keydown y keyup, para que ni `MedNum` ni `MedComment` abran el editor.
  - `useGridNav` ignora los eventos con Alt, Ctrl, Meta o Shift y los que traen `defaultPrevented`. Esto aplica también al `gridNav` exterior de `PartidasTable`.
  - Tests: Shift+Espacio en el comentario y en una celda numérica selecciona sin abrir el editor; Shift+↓ mueve el foco una sola vez.
- **Copia al sistema** (Etapa B):
  - Va por los eventos `copy`/`cut` del documento con `clipboardData.setData('text/plain', tsv)`, más un tipo propio `application/x-concreta-medlines` con el id de la copia o del cortado. Es síncrono y funciona en http.
  - Respaldo: `navigator.clipboard?.writeText(tsv)`, comprobando antes que exista.
  - Si ninguna vía confirma, `sysClipOk = false`, aviso de advertencia, y el siguiente pegado usa el portapapeles interno aunque el texto del sistema sea otro. Sustituye el mecanismo `keydown`+`writeText` de CEO y diseño.
  - Tests: `writeText` indefinido (http) y rechazado, seguidos de Ctrl+V.
- **Autoridad de un cortado** (Etapa B; sustituye la comparación solo por texto):
  - El movimiento solo se ejecuta si el pegado trae el tipo propio con el id del cortado pendiente, o si se lanza desde los botones internos.
  - Si solo coincide el texto, el diálogo pregunta: «Mover las líneas cortadas de <código>» o «Pegar una copia».
  - `consumedTsv` pasa a guardar el id: solo bloquea si coincide el id; con solo texto, pregunta.
- **Identidad de obra para Cortar:** un token de documento en memoria, creado en `loadObra`/hidratar/reset. No se usa `sessionStore.activeId`, que es null en la demo hasta el primer guardado.
  - Test: cortar → primera edición y guardado de la demo → pegar = mover.
- **TSV, lectura** (Etapa B; sustituye las reglas CEO donde choquen):
  - La normalización para COMPARAR va aparte del parseo.
  - El parseo usa un separador que respeta las comillas de Excel (campos entre comillas con saltos de línea, tabuladores y `""`).
  - Solo se quitan las filas vacías del final, no las celdas.
  - Una celda que empieza por `'` es SIEMPRE texto (se quita un `'`).
  - La disposición se decide UNA vez para todo el bloque: la 1.ª columna es el comentario si alguna fila tiene texto no numérico en la 1.ª celda.
  - Números, por token. Se rechazan:
    - celdas con coma y punto donde el punto va detrás de la coma («1,234.56»);
    - celdas con más de una coma;
    - tokens con forma de miles y sin coma, también con signo o dentro de operaciones («-1.234», «1.234+2»), salvo `0.ddd`.
  - Valores, parciales, total e importe tienen que ser finitos.
  - Topes: texto ≤ 200 000 caracteres, casilla ≤ 200, comentario ≤ 1 000. El parseo va en try/catch y un fallo muestra la franja de error.
  - Tests:
    - «'123⇥⇥⇥⇥» vuelve como comentario;
    - `'` literal;
    - comentario entre comillas con salto de línea;
    - «1,234.56», «-1.234», «1.234+2», «0.125» y «1e400»;
    - bloque mixto;
    - 50 000 «(».
- **TSV, escritura** (Etapa B): prefijo `'` en los comentarios que empiezan por `=`, `+`, `-`, `@`, `'`, TAB o CR, o que son un número liso (sustituye la lista CEO). Verificación manual en Excel y Google Sheets de que el `'` no se ve.
- **Texto de la guarda de certificadas** (sustituye el texto de borrar del bloque de diseño):
  - Al borrar: «La certificación conserva la cantidad (aparece como «línea eliminada»), pero se pierden su comentario y sus dimensiones».
  - Test de regresión: tras borrar una línea certificada, `CertDetail` sigue mostrando la fila «Línea eliminada…» con su cantidad y su casilla para desmarcar.
  - Una partida certificada a mano (sin `lineQty`) no activa la guarda, porque su cantidad no depende de las líneas. Queda documentado.
- **Aviso existente roto:** `Toast.tsx` deja de mostrarse (y cancela su temporizador y su acción) cuando se llama a `toastStore.clear()` o cambia el mensaje. Test de render tras `clear()`, `undo()` y `loadObra`.
  - Test de regresión: los avisos «Deshacer» de borrar partida y «copiada» siguen apareciendo.
- **`Modal`** acepta `initialFocus`. El foco de cierre se fija después de que `Modal` restaure `prevFocus`.
- **Táctil:** una sola fuente, `isTouchOnly()`, decide en JS la clase que muestra la casilla y la X y oculta el asa. Así se puede probar en jsdom con `matchMedia` simulado. Sustituye el `@media (hover: none)` de diseño como fuente de verdad.
- **Barra:** usa el mismo `compact` que las tarjetas (ancho útil < 780), en lugar del viewport < 760. Va FUERA de `.medWrap`, que tiene `overflow: hidden`. El estilo `lineCheck` pasa a un CSS compartido.
- **Aviso al mover:** muestra la ud de cada partida por separado.
- **Asistente de IA:** `borrar_linea` del ejecutor sigue borrando sin la guarda nueva, porque la confirmación es la aprobación de la propuesta en `PropuestaCard`. Queda documentado en el código.
- **Diagramas ASCII en el código:** `core/medPaste.ts` y `hooks/useMedClipboard.ts`. Actualizar la cabecera de `useReorderDrag.ts` (tipo `'medline'`).
- **TODOS.md** queda escrito en esta fase con los aplazados de todas las fases (sustituye «al aprobar» del bloque CEO).
<!-- /autoplan-accepted:eng -->

### Temas cruzados entre fases

Son preocupaciones que las voces de varias fases levantaron por su cuenta. Es la señal de más confianza de la revisión.

- **El canal del portapapeles del sistema (TSV).**
  - CEO: las dos voces sobre portapapeles interno frente al del sistema, y la revisión de especificación.
  - Diseño: carrera de `setTimeout(0)` (Codex #2).
  - Ingeniería: las dos voces (H2, H3, H4, M6 / Codex 2, 3, 4).
  - Casi todo el riesgo de navegador vive aquí. Por eso la Etapa B va aparte y se decide en el gate.
- **La semántica de Deshacer.**
  - Diseño: un Deshacer que ya no sirve (Claude M9, Codex #10).
  - Ingeniería: el agrupado de 700 ms (H1 / Codex 1).
  - Se resuelve con `historyCheckpoint()` + `domainRevision`, y arreglando `Toast`.
- **Las consecuencias sobre líneas certificadas.**
  - CEO: las dos voces.
  - Diseño: Codex #3 y Claude M5.
  - Ingeniería: Codex 12, sobre qué se pierde de verdad.
  - Se resuelve con el diálogo único de revisión, un texto preciso y el test de regresión de D-09.
- **Dónde viven la selección y el foco.**
  - Diseño: Claude HIGH-5/6 y Codex #7.
  - Ingeniería: las dos voces (M2 / Codex 9, H2).
  - Se resuelve con `medUiStore`, el enrutador global y el foco explícito en `pointerdown`.
- **Reinterpretar dinero entre formas de medir.**
  - CEO: las dos voces.
  - Diseño: Codex #1, sobre el importe en el diálogo.
  - Ingeniería: Claude M11, sobre `ud` y las columnas fuera de la forma.
  - Se resuelve con la compatibilidad en tres reglas y el diálogo con cantidad e importe.

### Estado de la revisión

**APROBADO** en el gate final de /autoplan el 2026-09-24. Revisado en CEO, diseño e ingeniería, con las voces Claude y Codex completadas en las tres fases; DX no aplica.

Decisiones del usuario en el gate:
- **D1:** aprobar.
- **D2:** incluir el intercambio con Excel (TSV) en la Etapa B.
- **D3:** incluir Cortar (Ctrl+X) en la Etapa B.
- **D4:** Ctrl+V fuera de la tabla pega en la partida abierta y cambia a la pestaña Medición.

Las decisiones de gusto menores (orden de Esc, sin vista previa de columnas para TSV ajeno) quedan tal como se recomendaron.

Siguiente paso: implementar la Etapa A. La Etapa B empieza cuando la A esté en verde.

<!-- AUTONOMOUS DECISION LOG -->
### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Modo SELECTIVE EXPANSION | Mechanical | regla autoplan | mejora de una función existente | otros modos |
| 2 | CEO | Enfoque C (plan + seguridad + TSV + Cortar) | Mechanical | P1 | cierra P4–P7 | A (5/10), B (7/10) |
| 3 | CEO | #1 TSV del sistema ↔ Excel | Taste | P2 | en radio; las dos voces | solo interno |
| 4 | CEO | #2 Cortar = mover al pegar | Taste | P1/P2 | completa «llevármelas»; Codex lo prefería aparte | «Mover a partida…», nada |
| 5 | CEO | #3 diálogo con formas incompatibles | Mechanical | P1 | consenso; afecta al dinero | solo aviso |
| 6 | CEO | Sin «adoptar la forma de origen» | Mechanical | P5 | forma que no encaja con la unidad | adoptar forma |
| 7 | CEO | #4 aviso A→B con Deshacer protegido | Mechanical | P1 | hallazgo de Codex verificado en el código | nada |
| 8 | CEO | #5 guarda de certificadas, incluida la X | Mechanical | P1 | consenso | sin guarda |
| 9 | CEO | #6 multiselección en móvil | Mechanical | P1/P2 | «una o varias» | solo escritorio |
| 10 | CEO | #7 Ctrl+C/V en la medición nunca partidas | Mechanical | P1 | defecto actual | — |
| 11 | CEO | #8 procedencia completa | Mechanical | P1 | Cortar la necesita | código/título/forma |
| 12 | CEO | #9 el arrastre mueve una sola línea | Mechanical | P5 | ambigüedad con selección no contigua | bloque |
| 13 | CEO | #10 aplazar partida con medición | Mechanical | P3 | cambia comportamiento existente fuera del radio | incluir |
| 14 | CEO | #11–#14 aplazados | Mechanical | P3 | fuera del radio | — |
| 15 | CEO | #15 descartar «Mover a partida…» | Mechanical | P4/P5 | Cortar basta | — |
| 16 | CEO | Ctrl+C sin selección copia la LÍNEA, no la celda | Mechanical | P5 | copiar un valor ya funciona en modo edición (`select()`) | valor de celda (subagente) |
| 17 | CEO | Un solo plan, implementado en commits ordenados | Mechanical | P6 | el usuario lo pidió todo | dos PRs (subagente) |
| 18 | CEO | Sin investigación previa de usuarios | Mechanical | P6 | el usuario es el experto de dominio | Codex #3 |
| 19 | CEO | TSV canónico de 5 columnas y reglas de lectura | Mechanical | P5 | revisión de especificación | columnas visibles |
| 20 | CEO | «1.234» ambiguo se rechaza | Mechanical | P1 | afecta al dinero | leer 1,234 |
| 21 | CEO | `consumedTsv` evita volver a pegar un cortado | Mechanical | P1 | revisión de especificación | vaciar sin más |
| 22 | Design | Sin maquetas generadas dentro de autoplan (su tablero es interactivo) | Mechanical | P6 | autoplan reserva las decisiones del usuario al gate | generar variantes |
| 23 | Design | Barra propia y pegajosa; el pie y el total siempre visibles | Mechanical | P1/P5 | consenso de las dos voces | sustituir el pie |
| 24 | Design | «Pegar N líneas» siempre en el pie (escritorio y tarjetas) | Mechanical | P1 | consenso (crítico) | solo teclado |
| 25 | Design | Táctil: casilla y X siempre visibles, asa oculta | Mechanical | P1 | consenso (crítico); arregla la X invisible en tablet | depender del hover |
| 26 | Design | Quitar el menú ⋮ por tarjeta | Mechanical | P5 | restar; la barra basta | ⋮ + casilla |
| 27 | Design | Avisos: un solo hueco, tres tonos, dos líneas; errores de pegado en línea | Mechanical | P1 | consenso; verificado en Toast.tsx | Toast actual |
| 28 | Design | Diálogo único de revisión, con consecuencias e importe | Mechanical | P1/P5 | crítico de Codex + Claude | diálogos sueltos / solo recuento |
| 29 | Design | Quitar el respaldo `setTimeout(0)`; pista a los 500 ms | Mechanical | P1 | crítico de Codex (carrera con el menú de macOS) | respaldo automático |
| 30 | Design | `writeText` fallido → aviso de advertencia | Mechanical | P1 | Codex | silencio |
| 31 | Design | `consumedTsv` se vacía con cualquier copia nueva | Mechanical | P1 | Codex | sin límite |
| 32 | Design | Reglas de foco y orden de Esc | Mechanical | P1 | consenso | — |
| 33 | Design | Esc: la selección antes que el cortado | Taste (menor) | P5 | primero lo más local | cortado antes (Codex) |
| 34 | Design | Ctrl+V fuera del grid pega en la partida abierta y cambia a Medición | Taste | P1 | completa el flujo (Claude) | exigir foco en el grid (Codex) |
| 35 | Design | Sin vista previa de columnas para TSV ajeno | Taste (menor) | P5 | formato canónico + aviso A→B | vista previa (Codex) |
| 36 | Design | Sin marca «C» de certificada en la tabla | Mechanical | P3 | ruido en la rejilla; el diálogo lista las líneas | marca |
| 37 | Design | Σ de parciales en la barra | Mechanical | P1 | detalle barato y útil | — |
| 38 | Design | «Cantidad fija A ud» en el pie cuando no hay líneas | Mechanical | P1 | incoherencia existente (el pie decía 0,00) | — |
| 39 | Eng | No reducir el alcance pese a la complejidad; Etapas A y B | Mechanical | P2 (regla eng de autoplan) | autoplan no recorta en ingeniería; las etapas acotan el riesgo | recortar TSV/Cortar |
| 40 | Eng | `historyCheckpoint()` + `domainRevision` | Mechanical | P1 | consenso (H1 / Codex 1) | confiar en un `set` |
| 41 | Eng | `medUiStore` efímero | Mechanical | P5 | consenso (M2 / Codex 9) | estado local |
| 42 | Eng | Enrutador global + `data-medgrid` | Mechanical | P5 | consenso (M1 / Codex 7) | hook local en `[data-editgrid]` |
| 43 | Eng | `core/medPaste` como operación preparada y revalidada | Mechanical | P1/P5 | consenso (M9 / Codex 6) | cálculo duplicado |
| 44 | Eng | Compatibilidad también con columnas fuera de la forma y con la ud | Mechanical | P1 | Claude M11 | solo rótulos |
| 45 | Eng | Ancla traducida al orden original; un no-op no consume el cortado | Mechanical | P1 | consenso (M4 / Codex 5) | indefinido |
| 46 | Eng | Fase de captura + `useGridNav` ignora modificadores | Mechanical | P1 | consenso (M5 / Codex 8) | burbuja |
| 47 | Eng | Eventos copy/cut + tipo MIME propio + `writeText` de respaldo + `sysClipOk` | Mechanical | P1 | Claude H3 + Codex 4 | keydown + `writeText` |
| 48 | Eng | Un cortado se autoriza por id; si solo coincide el texto, se pregunta | Mechanical | P1 | Codex 4 | igualdad de texto |
| 49 | Eng | Token de documento en memoria para Cortar | Mechanical | P1 | Codex 10 | `activeId` |
| 50 | Eng | TSV: comillas, `'` = texto, disposición por bloque, números por token, finitos, topes | Mechanical | P1 | consenso (H4, M6, M10 / Codex 2, 3) | reglas CEO |
| 51 | Eng | Prefijo `'` también para `-`, `'`, TAB y CR | Mechanical | P1 | Claude M7 | lista CEO |
| 52 | Eng | Texto de la guarda de borrado: la cantidad se conserva | Mechanical | P5 | Codex 12 | texto exagerado |
| 53 | Eng | Arreglar `Toast` con `clear()` | Mechanical | P1 | consenso (M8 / Codex 11), defecto existente | — |
| 54 | Eng | `Modal` con `initialFocus` | Mechanical | P5 | Claude L6 | — |
| 55 | Eng | Táctil decidido en JS (`isTouchOnly`) | Mechanical | P5 | Claude L7 (testeable en jsdom) | media query CSS |
| 56 | Eng | Barra con `compact`, fuera de `.medWrap`; `lineCheck` compartido | Mechanical | P4/P5 | Claude L8–L10 | — |
| 57 | Eng | `borrar_linea` de la IA sin guarda (documentado) | Mechanical | P3 | aprobar la propuesta ya es la confirmación | guarda en el ejecutor |
| 58 | Eng | TODOS.md escrito en la fase de ingeniería | Mechanical | regla eng de autoplan | recoge los aplazados de todas las fases | al aprobar |
| 59 | Eng | Sin compartir el portapapeles entre pestañas (BroadcastChannel) | Mechanical | P3 | el TSV cubre la vía texto | compartirlo |
