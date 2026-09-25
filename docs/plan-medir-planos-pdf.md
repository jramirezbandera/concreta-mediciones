<!-- /autoplan restore point: "C:\\Users\\javie\\.gstack\\projects\\jramirezbandera-concreta-mediciones\\main-autoplan-restore-20260925-132708.md" -->
## Implementation plan
# Plan · Medir sobre planos PDF

> Estado: APROBADO (/autoplan, 2026-09-25). Orden: Etapa 0 → X0 → A0 → puerta cronometrada → A1 → Etapa B. Lo que manda está en los bloques aceptados (ingeniería > DX > diseño > CEO) y, cuando exista, en la «Especificación · Etapa A» (X0).

## Petición

«Donde se va de verdad el tiempo al medir es en leer el plano y teclear las cifras. La
idea es un visor de PDF con escala calibrada: haces clic en longitudes, superficies o
recuentos, y cada medida entra como línea con su comentario («P1 · Salón») y sus
dimensiones. Encaja con lo que ya existe: `expr` guarda de dónde sale cada número y
«Medir por» decide las columnas. Al revisar, pinchar una línea te llevaría a la zona
del plano de donde salió. Es lo que convierte «10 minutos más rápido que Excel» en «ya
no vuelvo a Presto».» (TODOS.md, «Medir sobre planos PDF (P2, grande)»).

## Objetivo medible

- Medir una partida típica desde el plano (12 tabiques de una planta, 8 estancias de
  solado) sin teclear ninguna cifra que el plano ya da: clic, clic, Enter por medida.
- Cada línea medida sabe de qué plano, página y geometría sale, y se puede volver a
  ella con un clic.
- Una medida nunca cambia dinero en silencio: escala sin calibrar, forma de medir que
  no encaja o línea retocada a mano se ven.

## Qué ya existe (reuso)

- **Línea de medición** (`core/types.ts`): `MedLine { id, comment, uds, largo, ancho,
  alto, expr? }`. `expr` es la operación de la que sale el número de una casilla, y el
  invariante es que el valor = `evalEsExpr(expr)` (`editMedLine` borra el `expr` al
  teclear un número suelto). Una polilínea de tramos 3,20 + 4,15 + 2,10 cabe tal cual
  como `expr` «3,2+4,15+2,1».
- **Forma de medir** (`core/medForma.ts`): `MED_FORMAS`, `medFormaDef`, `medColumnas`,
  `formaDeUd`, `medFormaDe`. Es presentación: el dato vive en las cuatro casillas.
  `pesoDesdeComentario` rellena el kg/m desde el perfil del comentario.
- **Alta de líneas**: `insertMedLines(chapterId, partidaId, lines, afterId)` (copias
  con id nuevo, `expr` clonado, kg/m del destino) devuelve `MedResult { ids, reason? }`
  y es UN paso de Deshacer (`historyCheckpoint`, `store/temporal.ts`). `addMedLines`
  (lote del asistente) usa `NewMedLine` sin `expr`.
- **Estado efímero de medición**: `store/medUiStore.ts` (selección, foco pendiente,
  `lastFocusedLineId`, anuncios `aria-live`). `DetailPanel.usePendingFocus` enfoca
  líneas tras una acción.
- **Hueco lateral**: Referencia y Asistente comparten un `aside` con modo split
  redimensionable (`refWidth`, tirador), overlay y pantalla completa (`refMaximized`);
  el store garantiza que solo uno esté abierto (`setRefOpen` / `setAsistenteOpen`).
- **Persistencia** (`persist/`): `idb-keyval`, un blob `ObraEnvelope` por obra bajo
  `concreta.obra.<id>` con cola de un carril; `registry.reconcile` lista claves por el
  prefijo `concreta.obra.`; `durability.ts` pide `navigator.storage.persist()`;
  `transfer.ts` exporta/importa la obra como .json (`ProjectBackup`).
- **Esquema** (`store/schema.ts`): `SCHEMA_VERSION = 5`, `MIGRATIONS` en cadena,
  `DOMAIN_KEYS` con comprobación exhaustiva en compilación (autosave, Deshacer y
  serialización salen de ahí).
- **Carga diferida**: `ImportarView` va en un chunk aparte (`lazy`) y el parser .bc3
  corre en un Worker (`features/importar/bc3worker.ts`): precedente para pdf.js.
- **Imágenes en el asistente** (`ai/imagePrep.ts`): fotos de hojas de medición que el
  modelo lee; no se guardan en la obra.
- **Operaciones y perfiles**: `evalEsExpr`, `leerCelda`, `core/perfiles`.

## Cambios

### 1. Modelo de datos (esquema v6)

- `ObraData.planos: PlanoMeta[]` (entra en `DOMAIN_KEYS`: adjuntar, quitar y calibrar
  se deshacen):
  - `id`, `tipo: 'pdf' | 'imagen'` (ya en v6, aunque las imágenes lleguen en la Etapa
    B), `nombre` (editable, p. ej. «Planta primera»), `archivo` (nombre original),
    `bytes`, `sha256`, `paginas`, `revision?` («Rev. B») y `sustituye?` (id del plano
    de la revisión anterior);
  - `etiquetas?: Record<number, string>`: rótulo corto por página («P1»), prefijo del
    comentario;
  - `escalas: Record<number, Escala>` por página, con `Escala { mPorUnidad, ref: { a,
    b, metros }, comprobacion?: { metros, medidos, desviacion }, escalaDeclarada?,
    ajustada?, at }`. Se calibra siempre con dos puntos (`ref`, en unidades PDF).
    `escalaDeclarada` es la del cajetín, leída del texto, y solo sirve de comprobación;
    `ajustada` indica que `mPorUnidad` se llevó a la declarada exacta por quedar a menos
    del 1 %.
- `MedLine.origen?: OrigenPlano` (opcional, no necesita migración):
  `{ planoId, pagina, formaId, herramienta: 'longitud' | 'superficie' | 'rectangulo' |
  'recuento', puntos: [x, y][], mPorUnidad, magnitud: 'recuento' | 'longitud' |
  'area' | 'perimetro' | 'lados' | 'longitudPorFactor', factor?, valores:
  Partial<Record<MedDim, number>>, resta? }`.
  - `formaId` identifica la FORMA dibujada: las líneas creadas desde la misma forma
    («Añadir también a…») lo comparten; duplicar o pegar una línea crea una copia
    independiente con `formaId` nuevo. Es la única identidad de «misma forma»: nunca se
    deduce comparando coordenadas.
  - Los puntos van en el espacio de la página SIN rotar (independiente del zoom y de
    `/Rotate`); en una imagen, en píxeles de la imagen ya orientada.
  - `mPorUnidad` es la escala congelada al medir (1 en Recuento).
  - `magnitud` dice qué se sacó de la geometría: el área o el perímetro de un mismo
    polígono, los dos lados de un rectángulo, o L × h. `factor` guarda la dimensión
    fija que multiplica (h).
  - `valores` guarda lo escrito en CADA casilla que salió del plano (un rectángulo en
    Superficie escribe `largo` y `ancho`).
  - Una sola función pura, `valoresDesdeOrigen(origen, mPorUnidad)`, da valores y `expr`
    al crear, recalcular, editar vértices y copiar a otra partida.
  - «Retocada a mano» = alguna casilla de `valores` difiere de la de la línea.
  - `uds` se escribe siempre: 1, o -1 con Restar; en Recuento, N o -N. Solo en Recuento
    entra en `valores`: fuera de él, recalcular, «Volver a medir» y editar vértices no lo
    tocan, así que un `uds = 2` tecleado para dos tabiques iguales se conserva.
  - Redondeo: un valor sin `expr` es `round2`; uno con `expr` es exactamente
    `evalEsExpr(expr)` sobre operandos `round2` (tramos, lados, h); el área de un
    polígono es `round2` del lazo.
  - En Superficie y Rectángulo, `longitud` y `longitudPorFactor` usan el perímetro
    CERRADO.
- Migración v5 → v6: `planos: []`. `isObraData` acepta `planos` ausente o array.

### 2. Almacén de PDF, fuera de la obra

- `persist/planos.ts`: un almacén `idb-keyval` propio (`createStore('concreta-planos',
  'pdf')`), clave = `planoId`, valor `{ sha256, bytes, datos: ArrayBuffer, tipo,
  savedAt, sinReferenciaDesde? }`. Se guardan los bytes, no un Blob: así el `sha256` y
  los tests con `fake-indexeddb` funcionan en jsdom, que no implementa
  `Blob.arrayBuffer()`; el fichero se lee con `FileReader`. Se escribe una vez al
  adjuntar; nunca pasa por el autosave ni por el historial.
- El `sha256` usa `crypto.subtle.digest` y, fuera de contexto seguro (la app se sirve
  también por `http://` en red local, ver `persist/PersistUI.tsx`), una implementación
  pura en `core/sha256.ts`, con test contra los vectores conocidos. Todo uso de
  `navigator.storage.estimate()` va protegido: si no existe, no se enseña el espacio.
- Motivo: el autosave reescribe la obra entera en cada cambio y el historial guarda
  copias del dominio; un PDF de 20 MB ahí sería inmanejable. Y un almacén aparte no se
  cruza con el prefijo `concreta.obra.` de `reconcile`.
- Avisos: fichero > 50 MB; espacio usado y libre con `navigator.storage.estimate()` en
  la lista de planos.
- Ningún camino borra blobs directamente, tampoco borrar una obra: lo hace SOLO la
  limpieza de huérfanos, en reposo al arrancar y tras borrar una obra. La primera vez
  que un blob aparece sin referencia se anota `sinReferenciaDesde`; si vuelve a tener
  referencia, la marca se quita; se borra 7 días DESPUÉS de la marca (no de la fecha de
  adjuntar), y nunca si su id está en el estado en memoria o en el historial de
  Deshacer. Si algún sobre de obra no se puede leer, la limpieza entera se aborta.
- **Plano no disponible** (obra importada en otro equipo, datos borrados): el plano
  sigue listado con «Vuelve a adjuntar el PDF»; al adjuntar un fichero con el mismo
  `sha256` se reenlaza solo, con sus escalas y las líneas que salen de él.
- `ProjectBackup` dice que los planos no viajan en el .json.

### 3. Motor de PDF

- Dependencia nueva `pdfjs-dist` (Apache-2.0) en un chunk diferido. Worker con
  `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` (respeta el `base`
  de GitHub Pages).
- Seguridad: versión ≥ 4.2.67 (CVE-2024-4367), `isEvalSupported: false`, sin scripting,
  sin formularios ni capa de anotaciones.
- `features/planos/pdfAdapter.ts`: interfaz pequeña (`abrir(blob)`, tamaño de página,
  pintar una región a una escala, textos con posición) para probar la UI con un doble.
- Pintado: la página entera a la resolución de «ajustar» y, al hacer zoom, solo la zona
  visible a la resolución del zoom (con retardo). Nunca un canvas de más de 16 MP
  (límite de iOS).

### 4. Geometría pura (`core/planoGeom.ts`)

- Distancia, longitud de polilínea, área (fórmula del lazo), perímetro, rectángulo por
  dos esquinas; conversión de unidades PDF a metros con `mPorUnidad`.
- Redondeo a 2 decimales POR TRAMO y `expr` de la suma («3,2+4,15+2,1») de modo que
  `evalEsExpr(expr) === valor` siempre.
- Calibración, un solo modo: dos puntos sobre una cota larga + su distancia real →
  `mPorUnidad`. Después se mide una segunda cota conocida como comprobación y se
  enseña la desviación; por encima del 1 % se pide calibrar de nuevo.
- La escala del cajetín («E 1:50»), si el texto de la página la trae, se compara con la
  calibrada teniendo en cuenta `userUnit` (1 unidad PDF = `userUnit`/72 pulgadas): la
  franja dice «calibrada 1:49,7 · el plano dice 1:50». Si quedan a menos del 1 %,
  `mPorUnidad` se ajusta a la escala exacta (`ajustada`), lo que elimina el error del
  clic. No hay atajo «Escala 1:N» sin dos puntos.

### 5. De medida a línea (`core/planoMedida.ts`)

La herramienta da una magnitud y la forma de la partida decide la casilla:

| Herramienta | Unidades | Longitud | Superficie (L×A) | Sup. directa | Volumen | Sup. × espesor | Peso |
|---|---|---|---|---|---|---|---|
| Recuento (N) | uds = N | uds = N; Longitud fija | uds = N; Longitud y Anchura fijas | uds = N; Superficie fija | uds = N; L, A y Altura fijas | uds = N; Superficie y Espesor fijos | uds = N; Longitud y kg/m fijos |
| Longitud (L) | no encaja | largo = L | largo = L; Anchura fija | largo = «(tramos)×h»; Altura fija | largo = L; Anchura y Altura fijas | largo = «(tramos)×h»; Altura y Espesor fijos | largo = L; kg/m |
| Superficie (polígono) | no encaja | largo = perímetro | pasa a Sup. directa (abajo) | largo = área | no encaja | largo = área; Espesor fijo | no encaja |
| Rectángulo (L, A) | no encaja | largo = perímetro | largo = L, ancho = A | largo = «L×A» | largo = L, ancho = A; Altura fija | largo = «L×A»; Espesor fijo | no encaja |

- **Toda casilla visible se rellena o no se mide.** Una casilla vacía vale ×1
  (`core/medicion.ts`), así que cada casilla visible que el plano no da sale de una
  dimensión fija OBLIGATORIA. Si falta, la herramienta queda deshabilitada con el motivo
  («Indica la Altura fija para medir paramentos»). Cuentan solo las columnas de la
  forma (`medFormaDef(forma).cols`): una casilla fuera de la forma, visible por otras
  líneas, queda vacía en la línea medida.
- «No encaja»: la herramienta sale deshabilitada con el motivo («Esta partida se mide
  por Unidades: usa Recuento»).
- **Superficie en una partida L×A** (la forma por defecto del m²): el visor ofrece
  «Medir esta partida por Superficie directa». Aceptar cambia `medForma` a `'area'` en el
  MISMO paso de Deshacer que la primera medida, con aviso. Las líneas L×A que ya
  hubiera siguen igual (su Anchura sale como columna fuera de la forma). Si se rechaza,
  la herramienta queda deshabilitada y se sugiere Rectángulo.
- **Peso:** el kg/m sale del campo fijo kg/m (admite un perfil, «IPE 300», con
  `leerCelda`) o del perfil que nombre el comentario. El comentario se pide ANTES de
  crear la línea; Enter no crea la línea mientras el kg/m no se resuelva. Si el campo
  fijo y el comentario nombran perfiles distintos, Enter se bloquea con el motivo («El
  comentario dice HEB 200 y el kg/m fijo es IPE 300»). Un kg/m fijo numérico se escribe
  sin `expr`, así que `pesoDesdeComentario` no lo pisa.
- **Dimensiones fijas**: las casillas de la forma que el plano no da (Anchura, Altura,
  Espesor, kg/m) aparecen como campos en la franja «Midiendo en» y se aplican a cada
  medida (altura de planta 2,70; espesor 0,15). Se guardan POR PARTIDA en
  `planoUiStore`, así que cambiar de partida no arrastra la altura de Pintura a
  Alicatado, y la franja las enseña siempre.
- **Restar** (huecos): conmutador que crea la línea con uds = -1 (en Recuento, uds = -N).
  Su forma sale en rojo discontinuo en la capa. Duplicar la línea o copiar la forma a
  otra partida conserva el signo.
- **Comentario**: prefijo fijo (etiqueta de la página, «P1 · ») + texto que se pide
  tras cada medida, con Enter para aceptar el propuesto.
- La línea se crea con `medirEnPartida` (el mismo helper de líneas que
  `insertMedLines`) al final de la partida, o tras la línea con el foco: UN paso de
  Deshacer por medida.
- Si luego se teclea otro valor en una casilla medida (alguna casilla ≠ su
  `origen.valores`), la línea se marca «retocada a mano» y su forma en el plano sale
  discontinua. «Volver a medir» sustituye valores, `expr` y origen, solo con la MISMA
  herramienta y el mismo estado de Restar (para cambiarlos, se borra la línea y se mide
  de nuevo), así que nunca deja un `uds` de Recuento multiplicando una longitud.

### 6. Visor

- Botón «Planos» en la barra superior; abre el visor en el hueco lateral (tercer
  ocupante, excluyente con Referencia y Asistente), con split redimensionable y
  pantalla completa.
- Partes: cabecera (plano, página, «Adjuntar PDF»); barra de herramientas (Mano,
  Calibrar, Longitud, Superficie, Rectángulo, Recuento, Restar, zoom); lienzo con capa
  SVG encima; franja inferior «Midiendo en: 2.6 EAV010 Acero en vigas · Peso» con
  dimensiones fijas y prefijo.
- Destino = la partida abierta (`openPartidaId`). Sin partida abierta, las herramientas
  de medir salen deshabilitadas: «Abre una partida para medir».
- Interacción: rueda = zoom al cursor; arrastrar con Mano, espacio o botón central =
  desplazar; clic añade vértice; doble clic o Enter cierra; Retroceso quita el último
  vértice; Esc cancela; Mayús fuerza 0/45/90°; lectura en vivo de longitud o área.
- Entrada de geometría segura (`core/planoGeom`):
  - el doble clic que cierra no añade vértices;
  - un punto a menos de 4 px de pantalla del anterior se descarta;
  - Recuento solo termina con Enter (un doble clic no cuenta dos veces);
  - se rechazan con motivo la longitud 0, el polígono de menos de 3 vértices o de área 0
    y el polígono que se corta a sí mismo («La forma se cruza: rehazla en orden»).
  - Tests de cada caso.
- Capa: las medidas de la partida abierta resaltadas y numeradas como sus líneas.
  Clic en una forma (con Mano) → foco en su línea. En la línea, «Ver en plano» → abre el visor en
  su página, encuadra la forma y la destaca.
- Página sin calibrar: aviso «Calibra esta página»; Longitud, Superficie y Rectángulo
  deshabilitadas; Recuento sí funciona.

### 7. Móvil y táctil

- Escritorio primero. Tablet: eventos de puntero, pellizco para zoom, medir con toques.
- Móvil (< 760): solo ver («Ver en plano» y navegar); medir queda fuera.

### 8. Ayuda

- `ayudaContent`: función «Medir sobre planos» y grupo de atajos del visor.

### 9. Tests

- `core/planoGeom` y `core/planoMedida` (toda la tabla, `expr` = valor, restar,
  dimensiones fijas, peso con perfil).
- Migración v5 → v6; `isObraData` con y sin `planos`.
- `persist/planos` con `fake-indexeddb` y bytes (`ArrayBuffer`): adjuntar, borrar obra,
  huérfanos, reenlazar por `sha256`.
- UI con el doble del adaptador: calibrar, medir longitud → línea con `expr` y
  `origen`, Deshacer, «Ver en plano», plano no disponible, herramienta que no encaja.

## Etapas

- **Etapa A** (la que se usa en una obra real):
  - modelo v6 con `origen` completo (`formaId`) y `valoresDesdeOrigen`;
  - almacén aparte, adjuntar, revisión de un plano, quitar, plano no disponible y
    reenlace por `sha256`;
  - copia .zip de la obra con planos, y su restauración;
  - visor con zoom y páginas;
  - calibración por dos puntos con cota de comprobación, y escala del cajetín como
    comprobación;
  - las cuatro herramientas con la tabla completa, dimensiones fijas obligatorias y
    restar;
  - comentario con prefijo y texto propuesto;
  - «Añadir también a…» (la misma forma en otras partidas);
  - línea con `origen`, capa de la partida abierta y «Ver en plano»;
  - recalcular al recalibrar.
- La Etapa A se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`).
- **Puerta antes de la Etapa B:** dogfood cronometrado, como el spike §0.5
  (`docs/spike/02-dogfood-cronometrado.md`). En una obra real se miden las dos partidas
  del objetivo (12 tabiques, 8 estancias de solado) como hoy (visor de PDF y tecleo) y
  con Concreta. Meta: al menos el doble de rápido y ninguna diferencia con las cotas
  del plano por encima de la tolerancia. El resultado se escribe en
  `docs/spike/03-planos-cronometrado.md`.
- **Etapa B** (solo si se supera la puerta), en este orden:
  - imán a la geometría vectorial (los trazados ya salen del adaptador);
  - capa de toda la obra con leyenda y filtro;
  - editar vértices;
  - PNG/JPG como plano.

## Fuera de alcance (propuesta)

- DWG/DXF; varias escalas por página (ventanas de detalle); certificar sobre el plano;
  medición automática con IA; imprimir el plano con las medidas; sincronizar planos
  entre equipos. El imán a la geometría vectorial no está fuera: es lo primero de la
  Etapa B.

## Archivos (estimación)

Nuevos: `core/planoGeom.ts`, `core/planoMedida.ts`, `core/planoTexto.ts` (escala y
nombres de estancia desde el texto del PDF), `persist/planos.ts`,
`features/planos/` (`PlanosPanel.tsx`, `PlanoViewer.tsx`, `PlanoToolbar.tsx`,
`PlanoOverlay.tsx`, `CalibrarDialog.tsx`, `pdfAdapter.ts`, `Planos.module.css`),
`store/planoUiStore.ts`, tests.
Editados: `core/types.ts`, `store/schema.ts`, `store/obraStore.ts`,
`store/slices/estructuraSlice.ts`, `persist/persist.ts`, `persist/registry.ts`,
`App.tsx`, `layout/TopBar.tsx`, `features/presupuesto/MedLineRow.tsx`,
`features/presupuesto/MedCards.tsx`, `features/obra/ProjectBackup.tsx`,
`layout/ayudaContent.ts`, `package.json`, `core/medPaste.ts` (`origen` en
`lineaParaDestino`), `store/medLineOps.ts`, `features/presupuesto/MedPasteReview.tsx`
(guarda de certificadas al volver a medir y al borrar con Supr), `persist/sync.ts` (obra de referencia),
`persist/transfer.ts` (.zip), `hooks/useAppHotkeys.ts` (Esc mientras se dibuja).

<!-- autoplan-accepted:ceo -->
- **Recalibrar con medidas hechas:** si una página ya tiene líneas medidas y se cambia su escala, el visor pregunta «¿La escala anterior estaba mal?». Hay dos respuestas: «Sí, recalcular N líneas con la escala nueva» y «No, solo cambia la escala para lo que mida ahora». La segunda es la opción por defecto: Enter no recalcula nada, así que cambiar a 1:20 para medir un detalle y volver a 1:50 no toca las líneas.
  - Candidatas: las líneas de esa página cuya escala es distinta de la nueva, que no son de Recuento y que no están retocadas a mano, agrupadas por escala antigua («12 líneas a 1:50 · 3 a 1:20»). Las retocadas se listan aparte y no cambian.
  - Cambiar la escala y recalcular son UN paso de Deshacer (valores y `expr` salen de `valoresDesdeOrigen`). El aviso resume «N líneas · cantidad A → B <ud>» por partida.
  - Si se rechaza, la página queda con la escala nueva para lo que se mida después, y las líneas viejas conservan la suya. La lista de planos avisa: «N líneas medidas con otra escala».
  - Las líneas certificadas (`lineQty > 0` en alguna cert) NO se recalculan: se listan aparte («2 líneas certificadas en C1: revísalas a mano»), igual que las retocadas. Así no hace falta una guarda nueva para varias partidas y ninguna cantidad certificada cambia sola.
  - Tests: recalcular cambia valor, `expr` y `origen.mPorUnidad`; la retocada y la certificada no cambian y se listan; Deshacer revierte todo; Enter por defecto no recalcula; detalle a 1:20 y vuelta a 1:50 deja las líneas como estaban.
- **La escala siempre a la vista:** la lectura en vivo y la franja del visor muestran la escala activa («1:50 · calibrada con 5,00 m · comprobada 0,3 %»). Cada línea guarda la suya (`origen.mPorUnidad`).
- **Escala del cajetín como comprobación** (sustituye al atajo 1:N y a la calibración desde el texto, que las dos voces CEO vieron redundantes con la cota obligatoria): si el texto de la página contiene «1:N», «E 1:N» o «ESCALA 1:N», la franja compara la calibrada con la declarada («calibrada 1:49,7 · el plano dice 1:50»).
  - A menos del 1 %, `mPorUnidad` se ajusta a la escala exacta (`ajustada: true`). Por encima, aviso en tono de advertencia («La calibración no cuadra con la escala del plano: ¿el PDF está a otro tamaño?»), sin bloquear, porque la cota manda.
  - Hasta calibrar con dos puntos y comprobar con una segunda cota, Longitud, Superficie y Rectángulo siguen deshabilitadas.
  - Tests: dos puntos a 1:49,7 con «E 1:50» en el texto se ajustan a 1:50; a 1:47 avisan sin ajustar; `userUnit` 2 dobla la unidad; el lector descarta «1:2» dentro de una fecha y «1/2».
- **Comentario propuesto desde el texto del PDF:** en Superficie y Rectángulo se propone el texto de la página que cae dentro del polígono: el de mayor tamaño de letra que no sea una cifra. En Longitud y Recuento solo va el prefijo.
  - Nunca bloquea: Enter acepta la propuesta; el primer Esc deja solo el prefijo y el segundo descarta la forma (ver «Teclado y clics del visor»).
  - Tests con textos simulados: dentro o fuera, número descartado, sin texto.
- **Una forma, varias partidas** (taste; pasa a la Etapa A por acuerdo de las dos voces CEO): al crear la línea de una forma, la franja ofrece «Añadir también a…» con las partidas usadas hace poco en este plano (hasta 5) y un buscador. Con Mano, una forma ya dibujada ofrece lo mismo. No necesita la capa de toda la obra.
  - Cada partida elegida recibe una línea NUEVA con el mismo `formaId` y su propia magnitud; todas en UN paso de Deshacer.
  - Las ofertas salen de la tabla de §5: el perímetro CERRADO de la forma se trata como la fila Longitud (largo = perímetro; «(tramos)×h» en Sup. directa; largo = perímetro con la Anchura fija como altura en Superficie L×A) y su área como la fila Superficie, incluido el paso a Sup. directa en partidas L×A. Un rectángulo ofrece también su perímetro, igual que en §5.
  - La línea nueva guarda su propia `magnitud`: cuando un recálculo de escala o una edición de vértices propagada (ver «Editar vértices») la alcanza, se recalcula con esa magnitud, nunca con la del origen.
  - Tests: el polígono de «Solado» entra como perímetro en «Rodapié» (Longitud) y como perímetro × 2,70 en «Pintura» (Sup. directa); en una partida por Unidades no se ofrece; recalcular la escala actualiza las dos líneas, cada una con su magnitud.
  - Etapa A.
- **Capa de toda la obra:** conmutador «Esta partida / Toda la obra», color por partida con leyenda y formas ajenas atenuadas (Etapa B).
- **Editar vértices:** arrastrar un vértice recalcula valores, `expr` y `origen` de su línea en un paso de Deshacer. Una línea retocada a mano pide confirmación antes de sobrescribirse (Etapa B).
  - Si otras líneas comparten el mismo `formaId` (creadas con «Añadir también a…»; una línea duplicada es independiente), se ofrece «Aplicar también a N líneas» (taste, amplía #5). Cada una se recalcula con su `magnitud`, en el MISMO paso de Deshacer; las retocadas a mano y las certificadas se saltan y se listan. Sin aplicarlo, la capa marca «N líneas más usan la forma anterior».
  - Tests: editar el polígono de Solado con «Aplicar también» actualiza Rodapié y Pintura con su magnitud; sin aplicarlo, quedan igual y marcadas.
- **Copia de la obra con planos (.zip), en la Etapa A** (Codex: una copia que no restaura los planos rompe la promesa de «guardar la obra entera»): `ProjectBackup` ofrece «.json» (sin planos) y «.zip con planos», y restaurar el .zip en un navegador limpio devuelve obra, planos, escalas y capa.
  - Importar un .zip restaura obra y blobs, y verifica el `sha256` de cada PDF. Un PDF que no cuadra se descarta con aviso y su plano queda «no disponible».
  - `fflate` pasa a `dependencies`: hoy solo está en `devDependencies` y llega de forma transitiva por `write-excel-file`.
  - Test: exportar .zip → borrar IndexedDB → importar → la capa y «Ver en plano» funcionan.
  - La interfaz dice que las líneas medidas no dependen del PDF: si se pierde, solo se pierde la capa, y se recupera volviendo a adjuntarlo.
- **Imágenes como plano (Etapa B, esfuerzo M):** PNG y JPG entran como plano de una página.
  - Unidades en píxeles de la imagen, con la orientación EXIF ya aplicada (`createImageBitmap` con `imageOrientation: 'from-image'`).
  - Para pintar se reduce a ≤ 16 MP; la geometría sigue en píxeles originales.
  - Sin atajo 1:N ni escala leída: calibración con dos puntos obligatoria.
  - El botón dice «Adjuntar plano (PDF o imagen)».
- **Tabla herramienta × forma, dos casillas más:**
  - Superficie (polígono) en una partida por Longitud → largo = perímetro, con `expr` de los tramos.
  - Longitud en Sup. directa o Sup. × espesor → largo = L × altura fija, con `expr` «(tramos)×h». Sin altura fija, la herramienta pide rellenarla.
  - Tests de las dos.
- **Esquema v6 obligatorio:** `SCHEMA_VERSION` sube a 6 para que una versión antigua RECHACE la obra en vez de guardarla sin `planos`.
  - Tests: migración v5 → v6 (`planos: []`); rechazo de v7.
- **Tabla completa en tests:** `core/planoMedida` prueba CADA celda de la tabla herramienta × forma de §5: casillas escritas, dimensiones fijas obligatorias y motivo de «no encaja». Incluye Recuento en formas con más columnas, Peso sin perfil y el paso a Sup. directa (un paso de Deshacer; rechazar deshabilita la herramienta).
- **`origen` en las copias de líneas:** `lineaParaDestino` (`core/medPaste.ts`) clona `origen` en profundidad; hoy lo perdería.
  - Duplicar y mover (cortar y pegar) lo conservan mientras el destino tenga ese plano.
  - El TSV nunca lo lleva. Pegar en una obra cuyo `planos` no contiene `origen.planoId` lo quita (no se usa `docToken`, que cambia al volver a abrir la misma obra).
  - Tests de las cuatro rutas.
- **Carga de obra sin herencia:**
  - `loadObra` pone `planos: []` por defecto, como ya hace con `bajas`: importar un .bc3 tras una obra con planos no los hereda.
  - `importObraAsReferenceImpl` (`persist/sync.ts`) estampa `planos: []`.
  - `toSerializable` incluye `planos` en su lista explícita de claves.
  - Tests de las tres rutas.
- **Planos compartidos entre obras:** un `planoId` puede estar en más de una obra (importar el .json de X en Y).
  - Borrar una obra no borra blobs: los deja a la limpieza de huérfanos (§2), que solo borra los que ninguna obra referencia.
  - La limpieza lee los sobres de todas las obras y se ABORTA entera si alguno no se puede leer (los corruptos se guardan para recuperarlos). La marca `sinReferenciaDesde` se quita en cuanto el blob vuelve a tener referencia.
  - Tests: borrar Y con un plano compartido con X lo conserva; un sobre corrupto detiene la limpieza; un blob marcado, referenciado de nuevo y vuelto a quitar espera otros 7 días.
- **Sin contexto seguro:** con la app servida por `http://`, adjuntar y reenlazar funcionan con el `sha256` puro (`core/sha256.ts`). Tests: vectores conocidos, y adjuntar con `crypto.subtle` ausente.
- **Quitar un plano:** pide confirmación con cuántas líneas salen de él.
  - Las líneas conservan números y `origen`, marcado «plano quitado».
  - Quitar es un paso de Deshacer. El blob no se borra en el acto (lo hará la limpieza de huérfanos, con su margen de 7 días), así que Deshacer lo recupera entero.
  - Tests: quitar → Deshacer → la capa vuelve.
- **Teclado y clics del visor:**
  - La raíz del visor lleva `tabIndex=-1` y toma el foco en `pointerdown`: los atajos globales escuchan en burbuja (`useAppHotkeys` en `window`, `useMedClipboard` en `document`), así que el visor solo puede consumir teclas si el foco está dentro.
  - Mientras se dibuja una forma o está abierto el comentario, el visor consume Esc, Enter, Retroceso, Espacio y Ctrl/⌘+Z (`preventDefault` + `stopPropagation`), así `useAppHotkeys` no cierra la partida.
  - Esc a medio dibujo cancela la forma. En el comentario, el primer Esc borra el texto propuesto y el segundo descarta la forma sin crear la línea.
  - El visor entra en el orden de Esc de `useAppHotkeys`: salir de pantalla completa → cerrar el visor de planos (como Referencia y Asistente) → cerrar la partida. Y entra en la exclusión mutua de `setRefOpen` / `setAsistenteOpen` (abrir uno cierra los otros).
  - Ctrl/⌘+Z a medio dibujo quita el último vértice y no toca el historial.
  - Supr (Delete) con el foco en el visor NUNCA llega a `useAppHotkeys` (que borraría la partida abierta): con una forma seleccionada (Mano) borra su línea por `deleteLines`, con la guarda de certificadas; sin selección no hace nada.
  - Espacio desplaza solo si el foco no está en un campo de texto (el comentario).
  - Con una herramienta de medir activa, un clic siempre añade vértice. Seleccionar una forma existente (foco en su línea, o «Añadir también a…») solo funciona con Mano o sin herramienta.
  - Tests: Esc a medio dibujo no cierra la partida; Esc con el visor en reposo lo cierra y deja la partida abierta; dos Esc en el comentario descartan la forma; Ctrl+Z quita un vértice sin deshacer la última línea; abrir el visor cierra Referencia; Supr con el visor enfocado no borra la partida.
- **Revisión de un plano** (Codex; mínimo, Etapa A): «Adjuntar revisión» crea un plano NUEVO con `sustituye` apuntando al anterior y `revision` («Rev. B»); el anterior no se toca. Las líneas siguen en la revisión con la que se midieron y lo dicen («P1 · Rev. A»). Al abrir una revisión sustituida, aviso «Hay una revisión más nueva». Comparar revisiones queda en TODOS.
  - Tests: adjuntar revisión conserva el plano viejo, sus escalas y sus líneas; el aviso aparece en la vieja.
- **Trazados en el adaptador:** `pdfAdapter` expone ya `trazados(pagina)` (segmentos de las rutas del PDF vectorial), aunque el imán llegue en la Etapa B, para no rehacer la interfaz. Test con el doble.
- **Puerta cronometrada** antes de la Etapa B (ver Etapas): sin el documento `docs/spike/03-planos-cronometrado.md` con la meta cumplida no se empieza la B.
- **Acciones de store atómicas** (cada una es UN `set` dentro de `structural()`, con cortes de historial antes y después, y revalida contra el estado del momento: partida existente, líneas retocadas y certificadas):
  - `adjuntarPlano(meta)`, `quitarPlano(planoId)`, `calibrarPagina(planoId, pagina, escala)`;
  - `medirEnPartida(chapterId, partidaId, lineas, { medForma?, afterId? })`: cambia la forma (paso a Sup. directa) y da de alta las líneas en el mismo `set`;
  - `recalibrarPagina(planoId, pagina, escala, lineIds, expect)`: escala nueva + recálculo de las líneas indicadas, en varias partidas;
  - `volverAMedir(lineId, origen, expect)` y `editarVertices(origenLineId, puntos, alsoLineIds, expect)`.
  - `expect` es, como en `moveMedLinesTo`, lo que la UI preparó y el usuario confirmó: ids, valores y ids certificados. Si una línea se certificó o se retocó entre la confirmación y el `set`, devuelven `reason: 'stale'` y la UI vuelve a preparar y a preguntar.
  - `volverAMedir` sobre una línea certificada pasa por la guarda de certificadas existente (una partida). `editarVertices` se salta las líneas certificadas de otras partidas y las lista, igual que recalcular.
  - Devuelven `MedResult` (`reason: 'stale'` si algo cambió entre la preparación y el `set`).
  - Tests: cada acción es un solo paso de Deshacer; `stale` no toca nada.
- **El estado del visor tras Deshacer:** `planoUiStore` se reconcilia con `obraStore.planos` en cada cambio: si desaparece el plano que se ve, vuelve a la lista; si la página ya no existe, va a la 1; la forma a medio dibujar se descarta si su página ya no está calibrada.
  - Test: adjuntar → Deshacer → el visor enseña la lista sin errores.
- **`uds` y dimensiones fijas en tests:** recalcular una línea con `uds = 2` tecleado conserva el 2; la Altura fija de Pintura no aparece al abrir Alicatado; conflicto de perfiles en Peso bloquea Enter.
- **Casos límite de las secciones CEO:**
  - Adjuntar un PDF con el mismo `sha256` que otro plano de la obra no lo duplica: «Ya está adjunto como Planta 1».
  - Cambiar de partida abierta a medio dibujar descarta la forma con el aviso «Forma descartada: cambiaste de partida».
  - Tests de los dos.
- **.zip seguro y sin bloquear:** exportar e importar con la API asíncrona de `fflate`; al importar, tope de tamaño descomprimido (500 MB), solo nombres conocidos (`obra.json`, `planos/<id>.pdf|.png|.jpg`) y `sha256` verificado. Tests: bomba zip rechazada; nombre desconocido ignorado.
- **Bytes al worker sin copia:** los bytes leídos de IDB se transfieren al worker de pdf.js; el pintado se cancela (`renderTask.cancel()`) y solo pinta la última petición.
- **PDF reales en tests:** fixtures generados con geometría conocida (A3 a 1:50, variante con /Rotate 90 y con `userUnit` 2) y un test de pdf.js real en entorno node que comprueba coordenadas, rotación y unidad.
- **Un solo envoltorio para el hueco lateral:** `LateralAside` en `App.tsx` para Referencia, Asistente y Planos (divisor, split, overlay y pantalla completa), en lugar de una tercera copia del bloque.
- **Detalles de la medida:** cada línea con `origen` enseña plano, revisión, página, escala (y si está ajustada), herramienta y fecha. La forma exacta la decide la fase de diseño.
- **TODOS.md al aprobar:** varias escalas por página (P3), exportar el plano marcado para la DF (P2), certificar sobre el plano (P3), contar símbolos iguales automáticamente (P3), comparar revisiones de un plano (P2). El imán a la geometría vectorial pasa a ser lo primero de la Etapa B.
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- **Precedencia:** si choca con el bloque CEO, manda este (diseño > CEO); cada punto dice qué sustituye.
- **Sustituciones en el texto base del plan** (se leen como corregidas):
  - Objetivo: «clic, clic, Enter por medida» pasa a «clic… Enter para cerrar la forma y Enter para aceptar el comentario».
  - §4: «rectángulo por dos esquinas» pasa a «rectángulo por tres clics» (ver abajo).
  - §5: Restar ya no sale «en rojo discontinuo»: usa sombreado e insignia «−» (ver «Lenguaje visual de la capa»).
  - §5: «Comentario … que se pide tras cada medida» sigue igual, dentro del estado NOMBRANDO.
  - §6: «Página sin calibrar: aviso» es el aviso único con su acción; «Clic en una forma (con Mano)» abre el popover de la forma.
  - §7: la tablet solo ve en la Etapa A.
  - Archivos: `CalibrarDialog.tsx` pasa a `CalibrarPasos.tsx` + `Lupa.tsx`; nuevos `MedOrigen.tsx` y `AnadirTambien.tsx`.
- **Espacio de trabajo del visor:**
  - Planos tiene su propio ancho, no el tope 320–640 de Referencia (`setRefWidth`): mínimo 480 px, máximo «ancho útil − 520 px», por defecto el 55 % del área principal. El tirador es el de `LateralAside`.
  - Hay split solo si caben el lienzo (≥ 480 px) y el presupuesto (≥ 520 px); si no, el visor ocupa el área principal. El umbral sale de esos anchos útiles, no del `SPLIT_WIDTH` de 1100.
  - Selector de partida propio en la franja («Midiendo en ▾»): buscador más las recientes (las mismas 5 de «Añadir también a…»). Así el visor sirve también en pantalla completa y en overlay.
  - Por anchos:
    - ≥ 1366: split por defecto;
    - 1024–1365: split si caben los mínimos; si no, overlay;
    - 760–1023 (tablet): overlay de solo ver (medir con el dedo pasa a la Etapa B);
    - < 760: solo ver, con «Planos» en el menú «Más» del TopBar.
  - Tests: el cálculo de split a 1366 y a 1024; el overlay trae su selector.
- **Cabecera, aviso y franja:**
  - Cabecera, una fila de 40 px:
    - plano ▾;
    - página ▾ («P1 · Planta baja · 1:50 ✓ · 4 medidas»);
    - chip de escala por estado: «Sin calibrar» (neutral), «1:50 · ±0,3 %» (accent), «1:50 ajustada» (accent), no cuadra con el cajetín (`--state-warn`);
    - menú ⋯: Adjuntar plano, Adjuntar revisión, Renombrar, Etiquetas de página, Quitar plano.
  - Aviso único encima del lienzo (banda de 32 px): solo el más prioritario, con su acción. Orden: plano no disponible > revisión más nueva > calibración que no cuadra > página sin calibrar.
  - Franja inferior, fila 1 (siempre): «Midiendo en: 2.6 EAV010 Acero en vigas · Peso ▾» y el total «12 líneas · 148,30 kg».
  - Franja inferior, fila 2, según el estado:
    - EN REPOSO: dimensiones fijas; la obligatoria que falta, con borde `--state-warn`;
    - DIBUJANDO: lectura en vivo (Geist Mono) y pistas «Enter cierra · Retroceso quita punto · Esc cancela»;
    - NOMBRANDO: prefijo como chip fijo, comentario con la propuesta seleccionada y vista previa («largo 18,40 → parcial 18,40 m²»);
    - CREADA: «✓ Línea 7 · 18,40 m²», [Ver línea] y «Añadir también a…», hasta el siguiente vértice.
  - Sustituye a la franja del §6 como única superficie de medir.
- **Ciclo de una medida (contrato):**
  - Estados: EN REPOSO → DIBUJANDO → NOMBRANDO → CREADA → (siguiente clic) DIBUJANDO.
  - Enter o doble clic cierra la forma y pasa a NOMBRANDO con la propuesta seleccionada (lo que se teclee la sustituye). Un segundo Enter crea la línea. La secuencia real es «clic… Enter, Enter», y así la cuentan la ayuda y el objetivo.
  - Tras crear la línea:
    - el foco sigue en el visor y se mantienen la herramienta y las dimensiones fijas;
    - la línea nueva se desplaza a la vista en la tabla SIN mover el foco;
    - `aria-live` anuncia «Línea 7 creada: P1 · Salón, 18,40 m²».
  - Punto de inserción: se fija al entrar a medir (tras la línea con el foco, o al final) y AVANZA a la última línea creada desde el visor, así las medidas salen en orden. No usa el `requestFocus(..., scroll)` de `medLineOps`.
  - El aviso con «Deshacer» se ancla a la izquierda del área principal y no tapa ni la franja ni el lienzo.
  - Tests: tres medidas seguidas salen en orden; el foco no sale del visor; Esc tras crear no cierra la partida.
- **Teclado en el campo de comentario:** mandan las teclas nativas de edición (Retroceso borra letras, Ctrl/⌘+Z deshace texto). El visor solo gestiona Enter (crear) y Esc. Un solo Esc descarta la forma: sustituye el doble Esc del bloque CEO, porque con la propuesta seleccionada ya no hace falta el primero.
- **Calibrar en el lienzo, sin modal:**
  - Paso 1 «Cota conocida»: dos clics y la distancia en un campo anclado al segmento.
  - Paso 2 «Comprobación»: dos clics sobre otra cota y su valor.
  - En los dos pasos, los puntos se pueden arrastrar antes de confirmar.
  - Ayudas de precisión al colocar puntos de calibración y vértices: cursor en cruz con guías a todo el ancho y lupa ×4 (recuadro de 120 px en la esquina opuesta al cursor). Mayús bloquea 0/45/90°.
  - Si falla la comprobación: «Desviación 2,8 %» con [Rehacer cota] y [Rehacer comprobación], sin empezar de cero.
  - En el mismo flujo se pide «Esta página es: [P1]» (la etiqueta), con propuesta desde el texto si la hay.
  - «Usar esta calibración en otras páginas» (mismo tamaño de página y misma escala en el cajetín) copia la escala, pero cada página pide su comprobación (2 clics y 1 número).
  - Si la página no tiene una segunda cota, la comprobación puede repetir la misma cota en otra zona. Sin comprobación no se mide.
  - Tests: arrastrar un punto recalcula; rehacer la comprobación conserva la cota.
- **Una sola escala por página** (Codex; sustituye el flujo «detalle a 1:20 y vuelta» del bloque CEO):
  - Cambiar la escala de una página con líneas pregunta «¿La escala anterior estaba mal?», con [Recalcular N líneas] y [Cancelar]. Cancelar es la opción por defecto: Enter cancela.
  - Desaparece «solo cambia la escala para lo que mida ahora»: una página nunca queda con dos escalas.
  - Los detalles a otra escala no se miden en la Etapa A (la ayuda lo dice); la escala por zonas sigue en TODOS.
  - El ajuste al cajetín solo se hace si la página declara UNA sola escala, y la comprobación se evalúa contra la escala ya ajustada.
  - Tests: cancelar deja la escala y las líneas intactas; dos escalas en el texto no ajustan.
- **Herramientas deshabilitadas:** van con `aria-disabled` y siguen enfocables. Al pulsarlas, el motivo sale en el aviso y lleva al arreglo:
  - sin calibrar → empieza Calibrar;
  - falta la Altura → foco en el campo;
  - sin partida → abre el selector;
  - forma de medir que no encaja → nombra la herramienta que sí encaja y la selecciona.
  - Mano y Calibrar funcionan sin partida abierta.
- **Superficie en partidas L×A:** la oferta «Medir esta partida por Superficie directa / Usar Rectángulo» aparece en la franja al elegir la herramienta, antes de dibujar; nunca tras cerrar un polígono.
- **Rectángulo por tres clics** (taste): arista con dos clics y anchura con el tercero (proyección perpendicular), para que sirva en estancias giradas. Alternativa: dos esquinas alineadas con la página.
- **Polígono:**
  - Se cierra también con un clic en el primer vértice (anillo de enganche de 8 px).
  - El cruce se comprueba en cada clic: el tramo de vista previa se pinta en `--state-danger`, el clic se rechaza y la pista lo explica. Sustituye «se rechaza al cerrar».
- **Lenguaje visual de la capa:** no depende del tema, y el PDF nunca se invierte.
  - Partida abierta: relleno accent al 15 % y trazo de 2 px con halo blanco de 1 px.
  - Líneas con la misma forma (`formaId`), al seleccionar: contorno punteado accent.
  - Restar: sombreado a 45° e insignia «−». Sin rojo: en DESIGN.md el rojo es error o acción destructiva.
  - Retocada a mano: trazo discontinuo e insignia «✎» en `--state-warn`.
  - Dibujo en curso: trazo de 1,5 px accent con vértices de 6 px.
  - Insignias numeradas de tamaño fijo en pantalla (18 px, Geist Mono 11, fondo del tema con halo), iguales a las del marcador de la línea.
  - Contraste de los gráficos ≥ 3:1, comprobado sobre blanco y sobre línea negra.
- **Marcador de origen en la línea** (sustituye «Detalles de la medida: lo decide diseño» del bloque CEO):
  - Columna estrecha de 28 px en `MedLineRow` (y chip en `MedCards`) con el número de la forma. Es el botón «Ver en plano».
  - Muestra el estado: normal, «✎» retocada (`--state-warn`), o atenuado si el plano no está disponible o se quitó.
  - Su popover lleva plano, revisión, página, escala (ajustada o no), herramienta y fecha, más [Ver en plano] [Volver a medir].
  - La revisión («Rev. A») NO entra en el texto del comentario, para no ensuciar los exportes.
- **Forma seleccionada con Mano en el visor:** popover con comentario, valores, parcial y detalles, y las acciones [Ver línea] [Volver a medir] [Añadir también a…] [Borrar]. Supr equivale a Borrar, con la guarda de certificadas.
  - «Volver a medir»: la forma vieja se atenúa, se arma la misma herramienta y el destino es la partida de la línea (se abre si hace falta). Enter sustituye; Esc restaura.
- **«Añadir también a…», hoja de revisión:**
  - Selección múltiple de partidas (recientes y buscador).
  - Por cada partida, en castellano: interpretación («perímetro», «perímetro × 2,70», «área»), dimensión fija que falte (campo en línea), cantidad resultante con su ud y el cambio de forma si lo hay.
  - Un único botón «Añadir a N partidas», todo o nada: si alguna no es válida, no se crea ninguna y se marca cuál.
  - Se ofrece en el estado CREADA y desde el popover de una forma.
- **Borradores al cambiar de contexto** (sustituye «descarta la forma con aviso» del bloque CEO): el borrador vive en `planoUiStore`, ligado a partida, página, herramienta y escala.
  - Al cambiar de partida: si la herramienta encaja en la nueva, el borrador pasa a ella; si no, queda en espera con «Borrador para <partida>: [Volver] [Descartar]».
  - Al cambiar de página, de plano o de ocupante del hueco lateral, o al redimensionar: el borrador se conserva y al volver se ofrece [Seguir] [Descartar].
  - Tests de las tres rutas.
- **Estados** (la tabla de la revisión de diseño se implementa tal cual):
  - Adjuntando, con progreso por fases (leer, huella, guardar).
  - Abriendo.
  - Pintando: página previa borrosa y «Pintando…». Medir sigue deshabilitado hasta que la página mostrada sea la activa.
  - PDF con contraseña: «Este PDF tiene contraseña: quítala y vuelve a adjuntarlo».
  - PDF dañado.
  - Cuota llena, con el espacio usado si se puede leer.
  - Fallo del visor: «No se pudo cargar el visor. Recarga la página.»
  - Reenlazar con una huella distinta: «Este PDF no es idéntico al original», con [Adjuntar como revisión nueva] [Cancelar].
  - Restauración parcial del .zip: resumen persistente plano a plano, con acciones.
- **Vacíos:**
  - Obra sin planos: zona de soltar en el panel con tres pasos («Adjunta el PDF · Calibra con una cota · Mide») y botón «Adjuntar plano».
  - Partida sin medidas en esta página: «Esta partida tiene medidas en P2 y P3», con enlaces.
- **Páginas y etiquetas:** el selector de página enseña etiqueta, escala y número de medidas. Las etiquetas se editan en el menú ⋯ y al calibrar. Sin etiqueta, el prefijo es «Pág. 3».
- **Atajos del visor** (solo con el foco dentro): M Mano, L Longitud, S Superficie, R Rectángulo, N Recuento, − Restar, C Calibrar, F Ajustar a la ventana, +/− zoom. Van en `ayudaContent` y en los tooltips (no en táctil).
- **Colocar puntos con el teclado:** con una herramienta activa, las flechas mueven el cursor en cruz 1 px de pantalla (×10 con Mayús), Espacio coloca el punto y Enter (con 2 puntos o más) cierra. La tabla de medición, con su marcador, hace de lista accesible de formas.
- **Accesibilidad:**
  - herramientas como `radiogroup` con `aria-checked`, y Restar como conmutador con `aria-pressed`;
  - el lienzo con `role="application"` y `aria-label` («Plano P1, 1:50, herramienta Longitud»);
  - `aria-live` con límite para crear, descartar, calibrar y errores;
  - foco visible con `--ring-accent`;
  - al cerrar el visor, el foco vuelve al botón «Planos».
- **Dimensiones fijas:** se proponen desde el `origen.factor` de la última línea medida de esa partida, así que sobreviven a recargar. Se rotulan con el nombre de la columna y, si hace falta, su sentido: «Anchura (altura del paramento)».
- **Copia de seguridad:**
  - Con planos en la obra, «Copia completa con planos (.zip)» es la acción principal y enseña el tamaño («42 MB · 3 planos»).
  - «Solo presupuesto (.json)» queda como secundaria y dice que no lleva planos.
  - Un .zip con planos no disponibles se rotula «incompleta» y dice cuáles faltan.
  - El aviso de > 50 MB informa, no bloquea.
- **Barra de control mientras se dibuja:** barra flotante [Terminar (n)] [Deshacer punto] [Cancelar], con botones de 44 px que no se solapan. Sirve también con ratón, y Recuento se puede terminar con ella.
- **Tablet** (taste): en la Etapa A la tablet solo ve, como el móvil. Medir con el dedo (un dedo coloca, dos desplazan y hacen zoom, lupa desplazada) pasa a la Etapa B. Sustituye «Tablet: … medir con toques» del §7.
- **Verificación visual:** `/design-review` a 1366, 1024 y 390 px tras implementar la Etapa A.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- **Precedencia:** si choca con los bloques CEO o de diseño, manda este (DX > diseño > CEO); cada punto dice qué sustituye.
- **Especificación canónica antes de codificar** (las dos voces DX): tras el gate, y antes de la primera línea de código, el plan se reescribe en UNA sección «Especificación · Etapa A» con estas cinco partes:
  - los tipos;
  - la tabla herramienta × forma con su magnitud;
  - la tabla de estados y eventos del visor;
  - la tabla de atajos;
  - la tabla de errores y la lista de tests regenerada.
  Lo que ha quedado sustituido pasa al historial, no se anota encima.
- **Primer hito, un sandbox que funciona:**
  - `npm run dev` → `/#sandbox` → «Planos (ejemplo)» carga un PDF de prueba generado (A3 a 1:50, un tabique de 5,00 m y una estancia de 20,00 m²) ya calibrado y comprobado, en un store aislado con dos partidas (m y m²).
  - Medir el tabique da `largo = 5`, `expr` de un tramo, un `origen` completo y un paso de Deshacer.
  - El ejemplo es un test (`PlanosSandbox.test.tsx`).
  - Objetivo: < 3 min desde `npm run dev` hasta la primera línea medida.
- **PDF de prueba sin dependencias:**
  - un generador en `src/test/pdfMinimo.ts` escribe a mano PDFs pequeños (página, `/Rotate`, `/UserUnit`, líneas y textos);
  - los fixtures salen de él dentro del propio test, así que no hay binarios en el repo;
  - los tests de pdf.js real van en un proyecto de Vitest aparte con entorno node y su propio setup (`src/test/setup.ts` toca `Element` y no vale en node), usando `pdfjs-dist/legacy/build/pdf.mjs`.
- **Interfaz exacta del adaptador** (sustituye el esbozo del §3), con un doble completo y tests de contrato comunes para el real y el doble:
  - `abrir(datos: ArrayBuffer): Promise<DocPdf>`. Se queda con el buffer (lo transfiere al worker), así que quien llama no lo reutiliza.
  - `DocPdf.paginas: number`
  - `DocPdf.pagina(n)` → `{ ancho, alto, rotacion, userUnit }`: `n` desde 1, en unidades PDF y sin rotar.
  - `DocPdf.pintar(n, lienzo, region, escala, signal)`
  - `DocPdf.textos(n)` → `[{ texto, caja, tamano }]`
  - `DocPdf.trazados?(n)`: opcional, para la Etapa B.
  - `DocPdf.cerrar()`: idempotente.
  - Las transformaciones pantalla ↔ página son funciones puras, fuera del adaptador.
  - Pensado para `StrictMode`: cada pintado se cancela con su `AbortSignal` y `cerrar` se puede llamar dos veces.
- **Tipos y unidades** (sustituyen donde choquen con §1):
  - `pagina` empieza en 1;
  - `desviacion` es una fracción (0,003);
  - `at` es ISO;
  - `escalaDeclarada` es la N de 1:N;
  - el tamaño del fichero se llama `tamano` (no `bytes`).
  - `OrigenPlano` es una unión discriminada por herramienta:
    - un rectángulo guarda sus 4 esquinas en orden;
    - Recuento guarda los puntos contados.
  - `OrigenPlano` añade:
    - `slots` (las casillas que salen del plano, fijadas al medir, nunca por la forma actual de la partida);
    - `fijas?: Partial<Record<MedDim, number>>` (dimensiones fijas escritas en casillas);
    - `factor?` (solo el multiplicador dentro de `expr`, p. ej. la h de «(tramos)×h»);
    - `at`;
    - `escalaAjustada`.
  - `valoresDesdeOrigen(origen, { mPorUnidad })` escribe solo en `origen.slots`.
  - La tabla del §5 gana una columna con la `magnitud` de cada celda.
  - En la franja las dimensiones se rotulan distinto: «Anchura» (casilla) frente a «Altura (multiplica)».
  - Hay un ejemplo JSON de `OrigenPlano` por herramienta, que también sirve de fixture.
- **Escala de la página, dicho con exactitud** (sustituye «una página nunca queda con dos escalas» del bloque de diseño): cada página tiene UNA calibración activa. Las líneas que se saltó un recálculo (retocadas o certificadas) conservan su escala histórica y se listan como «N líneas con otra escala».
- **Calibrar sin fricción:**
  - Si la página declara UNA escala en el cajetín y la calibración por dos puntos queda a menos del 1 %, eso cuenta como la comprobación (dos fuentes independientes), y queda en `comprobacion.fuente = 'cajetin'`. Sin cajetín, o si no cuadran, se pide la segunda cota.
  - En una partida L×A SIN líneas, elegir Superficie cambia la forma a Sup. directa sin preguntar (mismo paso de Deshacer, aviso con Deshacer). Solo se pregunta si ya hay líneas L×A (precisa el punto de diseño).
- **Escala ajustada reversible:** el chip «1:50 ajustada» ofrece «Usar la calibrada (1:49,7)».
- **Acción por lotes para «Añadir a N partidas»** (sustituye el uso de `medirEnPartida` en bucle):
  - `addPlanoLines({ destinos: [{ chapterId, partidaId, lineas, medForma?, afterId? }], expect })`: todas las partidas en UN `set`, todo o nada.
  - Devuelve un error por destino (partida, campo, motivo).
  - La preparación (`prepararMedida`) es pura y la usan la vista previa y la confirmación.
- **Nombres de las acciones de store** (convención del store: verbo en inglés + nombre de dominio; sustituye los nombres del bloque CEO):
  - `attachPlano`, `removePlano`;
  - `setPlanoPageScale` (devuelve `reason: 'has-lines'` si la página ya tiene líneas medidas: la única vía para cambiar la escala de líneas es `rescalePlanoPage`);
  - `addPlanoLines`, `rescalePlanoPage`, `remeasureLine`, `moveShapeVertices`.
  - Todas reciben un objeto de opciones y un `expect: ExpectLineas` común (ids, valores, ids certificados, `docToken`).
  - Los módulos puros siguen en castellano (`planoGeom`, `planoMedida`, `valoresDesdeOrigen`), como el resto de `core/`.
- **Motivos y textos:** `MedResult.reason` suma `'no-plano' | 'sin-calibrar' | 'no-encaja' | 'certificada' | 'falta-dimension' | 'has-lines'`. `failText` (hoy en `medLineOps.ts`) pasa a un módulo con un texto por motivo, con problema, causa y arreglo. Tests: cada motivo tiene texto.
- **Coordinador de adjuntar** (dos almacenes, sin transacción común):
  - Captura el `docToken`, guarda los bytes y SOLO después publica el metadato.
  - Si cambia la obra a mitad, descarta el resultado (el blob queda para la limpieza).
  - Reintentar es idempotente por `sha256`.
  - Restaurar un .zip escribe primero todos los bytes. Si falta cuota a mitad, la obra se restaura con los planos que entraron y el resto queda «no disponible», dicho en el resumen.
  - Tests: cambio de obra durante adjuntar; cuota a mitad de restaurar.
- **Bytes por huella** (sustituye «clave = `planoId`» del §2):
  - El almacén de planos usa como clave el `sha256`.
  - El mismo PDF adjuntado dos veces (p. ej. para otra escala: se ofrece «Adjuntar otra vez») o compartido entre obras guarda los bytes una sola vez.
  - Reenlazar es buscar por huella, y la limpieza cuenta referencias por huella.
  - Para la limpieza, el historial de Deshacer expone una consulta mínima de las huellas referenciadas (`temporal.ts` es privado).
- **Reenlazar con otra huella:** además de «Adjuntar como revisión nueva», se ofrece «Usar este PDF para este plano», solo si coinciden el número de páginas y el tamaño de cada una. Conserva escalas y líneas, pide una comprobación nueva en cada página calibrada y guarda la huella nueva.
- **Línea retocada:** el popover del marcador ofrece además «Aceptar valores actuales» (reescribe `valores`) y «Desvincular del plano» (quita `origen` y conserva los números).
- **Validación del esquema v6** (sustituye «`isObraData` acepta `planos` ausente o array»):
  - Antes de migrar, se admite v5 sin `planos`.
  - Después de migrar, `planos` es obligatorio y se validan sus elementos:
    - id y huella;
    - páginas > 0;
    - escalas finitas y > 0;
    - que cada `origen` tenga su forma según herramienta, con puntos finitos.
  - Un `origen` inválido se descarta de su línea (se conservan los números) con un aviso en la recuperación. Nunca rompe el render.
  - Tests: v6 con `planos: [null]`, escala 0 u `origen` con NaN.
- **Rollback:**
  - La primera entrega mete el lector y el escritor v6 y el visor detrás de una constante de compilación (`PLANOS_VISOR`). Revertir el visor es apagar la constante, no volver a v5.
  - Antes de la primera migración a v6 de cada obra se guarda una copia del sobre v5 (clave de recuperación).
  - La app vieja distingue «esta obra necesita una versión más nueva» de «obra dañada».
  - Test: el lector v5 ante un fixture v6 no toca los datos guardados.
- **pdf.js:**
  - Versión exacta en `package.json` (sin ^), por la CVE.
  - El worker sale del MISMO paquete instalado, y un test comprueba que la versión de la librería y la del worker coinciden.
  - Tras cada subida de versión: tests de contrato del adaptador y prueba del build publicado con el `base` de Pages (cambios de página rápidos incluidos).
- **Error del visor aislado:**
  - Una frontera de errores local envuelve el chunk de Planos dentro de `LateralAside`.
  - Si falla la carga del chunk: «Hay una versión nueva: recarga», enlazado con `update/`.
  - Si falla el worker o el PDF: el nombre del fichero y la causa.
  - El presupuesto nunca se queda en blanco.
  - Test: un chunk que falla deja el presupuesto usable.
- **Textos de error con acción** (tabla completa en la especificación canónica):
  - PDF dañado: «No se pudo leer "X.pdf" (dañado o no es un PDF). Ábrelo en otro visor y vuelve a guardarlo».
  - Cuota llena: lleva a la lista de planos con tamaños, con «Quitar plano» y «Copia .zip».
  - `stale`: dice qué cambió («La línea 7 se certificó mientras confirmabas»).
  - Conflicto de perfiles en Peso: [Usar HEB 200] [Usar IPE 300].
  - Plano no disponible: nombra el fichero y su tamaño.
  - Rechazos del .zip: con su causa.
  - Los avisos de calibración, «no encaja» y «PDF no idéntico» llevan «?» a su sección de la ayuda.
- **Tope del .zip calculado del contenido** (sustituye el tope fijo de 500 MB): suma de los tamaños declarados de los planos + margen + un límite para `obra.json`. Los nombres desconocidos se siguen rechazando.
- **Borradores** (precisa el bloque de diseño):
  - Ligados al `docToken` y a la revisión de la calibración de su página.
  - Cambiar de obra, recalibrar esa página o Deshacer un cambio de escala los descarta con aviso.
  - Al cambiar de partida se recalcula la interpretación y se piden las dimensiones que pase a necesitar.
  - Tests de las cuatro rutas.
- **Atajos sin choques** (sustituye los puntos «Atajos del visor» y «Colocar puntos con el teclado» del bloque de diseño):
  - Restar = D («descontar»);
  - zoom = + / − y Ctrl + rueda;
  - Espacio mantenido = desplazar;
  - el cursor de teclado se activa al pulsar una flecha y se apaga al mover el ratón. Con él activo, Intro coloca un punto y Mayús+Intro cierra la forma; sin él, Enter cierra la forma como en el ciclo de medida;
  - Esc por estado: DIBUJANDO cancela la forma; NOMBRANDO descarta; CREADA vuelve a EN REPOSO; EN REPOSO cierra el visor.
- **Ayuda:** `ayudaContent` gana las secciones:
  - qué herramienta para qué partida (la tabla, en lenguaje de obra);
  - el ciclo «clic… Enter, Enter»;
  - calibrar y comprobar;
  - una escala por página y cómo medir un detalle (adjuntar otra vez);
  - .zip frente a .json («tus líneas sobreviven aunque se pierda el PDF»);
  - líneas retocadas.
  Todas con ancla para los «?». Tras la Etapa A se añade el paso de primeros pasos en `STEPS`.
- **README:** la lista de características suma «Medir sobre planos PDF».
- **TODOS.md al aprobar:** «Probar con un plano de ejemplo» para el usuario final, en el estado vacío (P3; el sandbox cubre al desarrollador).
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- **Precedencia:** si choca con los bloques DX, de diseño o CEO, manda este (ingeniería > DX > diseño > CEO); cada punto dice qué sustituye. La «Especificación · Etapa A» canónica (tarea X0) lo absorbe todo.
- **Decisiones del usuario en la aprobación (D4 y D5, 2026-09-25)** (sustituyen la lista «Etapa A» de «Etapas» y el punto «Puerta cronometrada» del bloque CEO donde choquen):
  - **Orden (reto 1, respuesta B):**
    - La Etapa 0 lleva también el recordatorio de copia (P1 de TODOS, «Que la obra no pueda perderse»):
      - «Última copia: hace N días» con botón para hacerla;
      - visible fuera del modal de obra cuando `durability` no es `persisted`, o cuando pasan más de 7 días sin copia;
      - la fecha se guarda por obra en la meta del registro (`ObraMeta.ultimaCopia`, ISO) y no entra en `ObraData`;
      - la sella cada descarga iniciada (.json hoy, .zip en A1), con el id de la obra capturado al exportar;
      - el texto dice «Última copia descargada», porque el navegador no confirma que el fichero se guardó; sin fecha, dice «Aún no has hecho ninguna copia»;
      - `saveActiveObra` y `metaOf` FUSIONAN la meta en vez de sustituirla. Hoy la reconstruyen y pierden campos, también `kind`; así `ultimaCopia` y `huellas` sobreviven al autosave;
      - importar un .json o un .zip sobre la obra, crearla y borrarla ponen la fecha a cero; la copia automática previa a importar sella la obra ANTERIOR.
      - Tests:
        - exportar → editar → autosave → recargar conserva la fecha;
        - el aviso sale a los 8 días y no a los 6;
        - importar no hereda la fecha de la obra sustituida.
    - Después, los planos. Los documentos (cuadros de precios nº 1 y nº 2, mediciones sin precios) siguen en TODOS, detrás.
  - **Etapa A partida (reto 2, respuesta A):** A0 → puerta cronometrada → A1 → Etapa B.
    - **A0**, lo mínimo para la puerta:
      - modelo v6 completo, con todos los campos de `origen` (también los que usa A1), para no migrar otra vez;
      - almacén por huella en su módulo propio de IndexedDB (`meta` + `bytes`, el formato definitivo, para no migrarlo en A1), con `update` de `meta` al adjuntar; sin marcas ni borrado de PDF;
      - adjuntar, plano no disponible y reenlace solo por huella idéntica;
      - visor con zoom y páginas;
      - calibrar con dos puntos y comprobación con una segunda cota. En A0 no se lee el cajetín: ni aviso, ni ajuste, ni comprobación por cajetín;
      - las cuatro herramientas con la tabla completa y dimensiones fijas obligatorias. Restar solo si la certificación por líneas con signo (E12) está hecha; si T11 no la aprueba, Restar queda deshabilitado en A0 con su motivo;
      - cursor en cruz y lupa ×4 al colocar puntos de calibración y vértices. Sin ellos la tolerancia no se cumple a zoom de ajustar: un píxel son unos 3 cm a 1:50 en un A3;
      - la cota de calibración mide al menos 300 px en pantalla y la franja enseña la precisión (≈ 2 px / longitud en px). Una escala fuera de 1:1–1:5000, o poco común, pide confirmación: un «cm» tecleado como «m» pasa la segunda cota;
      - comentario con prefijo y texto que se teclea, sin propuesta desde el PDF;
      - `addPlanoLines` a una sola partida y «Volver a medir»;
      - capa de la partida abierta, marcador de origen y «Ver en plano»;
      - quitar plano (con `quitado`);
      - atajos de una tecla, Esc por estado y la defensa de Supr;
      - pestaña de solo lectura, frontera de errores e interruptor en tiempo de ejecución;
      - sandbox «Planos (ejemplo)».
    - **Cambiar la escala de una página con líneas en A0:** `setPlanoPageScale` devuelve `has-lines`. El aviso dice «Esta página ya tiene N líneas medidas con esta escala. Recalcularlas llega más adelante; para medir a otra escala, adjunta el PDF otra vez». La escala no cambia.
    - **Copia en A0:** solo .json. Lleva las líneas con su `origen` y los metadatos de los planos, no los PDF. `ProjectBackup` lo dice («los planos no van en esta copia; si se pierden, vuelve a adjuntar el PDF»).
    - **La puerta:** con las tolerancias y el presupuesto de pintado de este bloque. Sin `docs/spike/03-planos-cronometrado.md` con la meta cumplida no empieza A1.
    - **A1**, tras la puerta y antes de la Etapa B:
      - .zip con planos y restauración por etapas;
      - marcas, índice `huellas` y «Liberar espacio»;
      - revisiones de un plano;
      - recalcular al cambiar la escala (`rescalePlanoPage`) y «Usar esta calibración en otras páginas»;
      - «Añadir también a…» con su hoja (`addPlanoLines` a varias partidas);
      - cajetín: lectura, comparación y, según T9, comprobación y ajuste;
      - comentario propuesto desde el texto del PDF;
      - cursor de teclado con flechas;
      - «Usar este PDF para este plano», según T10;
      - «Aceptar valores actuales» y «Desvincular del plano».
    - Cada pieza se lleva sus tests a su subetapa. A0 se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`), igual que A1.
- **Etapa 0, release de compatibilidad ANTES de cualquier escritor v6** (las dos voces; sustituye «la app vieja distingue…» del bloque DX, que no llega a pestañas ya abiertas):
  - `loadObraData` devuelve un resultado con tipo (`ok | vacia | danada | mas-nueva`). Con «más nueva», el aviso dice «Esta obra se guardó con una versión más nueva de Concreta: recarga la página», sin «Descartar y empezar», y la pestaña queda en solo lectura para esa obra.
  - Traspaso del candado (`claimActive` 'handoff', `persist/sync.ts`): si recargar de disco falla, la pestaña sigue en solo lectura y NO arma el autosave. Hoy lo arma igualmente y la siguiente edición pisaría la obra.
  - `saveObra` no sobrescribe un sobre con `schemaVersion` mayor que el que escribe (el cómo, abajo: resultado `version-conflict` y transacción propia).
  - Tests con un fixture v7: hidratar, conmutar, traspaso y guardar nunca lo borran ni lo pisan.
  - Se publica sola, antes que A0. El tiempo que pase no es la garantía: una pestaña antigua puede seguir abierta semanas (el aviso de versión nueva admite «Más tarde»). La garantía es el espacio de claves propio de v6 (abajo). En el mismo paso previo: el hueco lateral pasa a un solo campo `lateral: 'ref' | 'asistente' | 'planos' | null` con `LateralAside`, con los tests actuales en verde.
  - Traspaso, con exactitud (segunda pasada): `isOwner` y `readonly` no cambian hasta que la recarga devuelve `ok`. Hoy se ponen antes de recargar (`sync.ts:173-178`) y el autosave ya estaba armado desde `hydrate`, así que no basta con «no armarlo».
  - `saveObra` ante una versión mayor en disco da un resultado terminal `version-conflict`:
    - la entrada sale de `pending` (hoy se reintentaría para siempre y bloquearía el guardado de las demás obras);
    - el índice no se toca;
    - la pestaña pasa a solo lectura con el aviso de «más nueva».
    - Comparar y escribir va en una transacción propia (el `update` de idb-keyval siempre hace `put`), contra una clave pequeña de versión por obra, sin leer el sobre entero en cada guardado.
  - `loadObraData` mira `schemaVersion > SCHEMA_VERSION` ANTES de `isObraData`, así una v7 con otra forma nunca sale como «dañada». Lo mismo en `activateFirstLoadable`, `discardRecovery` y `features/referencia/obraSource.ts`, con tests en todas.
  - Guardados fallidos, ya en la Etapa 0:
    - importar un .json comprueba el `false` de `flushPending` y, si falla, lo dice y deja recuperar la obra anterior (hoy cierra como si hubiera ido bien, `ProjectBackup.tsx:78`);
    - «Actualizar» no recarga si el volcado devuelve `false` o no termina a tiempo (`reloadToLatest`, `update/appVersion.ts`), y lo dice.
    - Tests con `false` y con escritura lenta.
- **Espacio de claves propio de v6** (segunda pasada, las dos voces; sustituye la copia v5 bajo `concreta.recovery.v5.*` de la primera pasada y la copia v5 del bloque DX):
  - Las obras v6 y su índice viven bajo un prefijo que el código anterior no lista ni escribe: `concreta6.obra.<id>` y `concreta6.obras.index`.
  - La primera vez que se abre una obra v5, se migra a la clave nueva. La clave v5 (`concreta.obra.<id>`) se queda tal cual y hace de copia v5.
  - Una pestaña antigua solo puede escribir en la clave v5: nunca pisa la v6. Si al cargar la clave v5 tiene un `savedAt` posterior a la migración, el aviso dice «Una versión antigua de Concreta guardó cambios en esta obra después de actualizarla», con [Abrir esos cambios como obra aparte] [Ignorar].
  - La clave v5 se borra 30 días después de la migración si no ha cambiado desde entonces.
  - `reconcile`, `obraKeys` y la migración legacy trabajan con el prefijo nuevo; el prefijo v5 solo se lee para migrar.
  - Tests:
    - pestaña antigua con la obra en memoria + traspaso → la v6 queda intacta y sale el aviso;
    - una v5 se migra una sola vez;
    - limpieza a los 30 días.
- **Validar v6 sin destruir** (las dos voces; sustituye «planos obligatorio y se validan sus elementos» del bloque DX y la limpieza de la primera pasada):
  - Tras migrar, `isObraData` solo exige `Array.isArray(planos)`. Una obra nunca va a recuperación por un plano mal formado.
  - Un `PlanoMeta`, una escala o un `origen` que no se entiende NO se borra:
    - se conserva tal cual, como dato opaco, y no se pinta;
    - la línea sigue con sus números;
    - se escribe de vuelta sin cambios.
  - Solo lo que rompería el render se aparta a un campo `_ilegible` con su valor crudo, y se avisa. Limpiar nunca provoca un guardado por sí solo.
  - Regla de versión: todo cambio que amplíe las formas o los valores válidos que se guardan sube `SCHEMA_VERSION` (una herramienta nueva, un campo con significado nuevo), así el código anterior pasa a solo lectura por la Etapa 0 en vez de reinterpretar. Por eso el modelo v6 trae desde A0 todos los campos de A1.
  - Topes al importar un .json: puntos por `origen`, número de planos, de páginas y de líneas con `origen`. Un fichero manipulado no puede congelar el validador ni la capa.
  - Claves de página: `escalas` y `etiquetas` se validan como enteros de 1 a `paginas`, porque en JSON llegan como texto.
  - Tests:
    - `planos: [null]`, escala 0 y `origen` con NaN cargan la obra;
    - un lector A0 ante un fixture A1 conserva lo que no entiende y lo devuelve igual al guardar;
    - claves de página de ida y vuelta por .json.
- **Almacén de PDF sin borrado automático en la Etapa A** (las dos voces; sustituye la limpieza de huérfanos del §2 y del bloque CEO):
  - Se marcan los PDF sin referencia (`sinReferenciaDesde`), pero no se borran solos.
  - «Liberar espacio», en la lista de planos, enseña los PDF sin referencia en ninguna obra con su tamaño y los borra tras confirmar. Ese borrado:
    - toma un Web Lock `concreta.planos` si existe;
    - borra dentro de una transacción de lectura y escritura que relee el registro y solo borra si la marca no cambió;
    - excluye las huellas del estado en memoria y de las dos pilas del historial de esta pestaña.
  - Adjuntar, reenlazar y restaurar hacen siempre un `update` que quita la marca y sella `tocadoEn`, aunque los bytes ya existan.
  - Las referencias salen de un índice nuevo, `ObraMeta.huellas: string[]`, junto con `huellasDe`: el `savedAt` del sobre del que salen. Lo escriben `saveActiveObra` y `reconcile` cuando registra una obra.
  - Un índice que falta, o que no coincide con el `savedAt` del sobre, vale «desconocido», nunca `[]`: se lee el sobre, en crudo si hace falta. Un sobre ilegible que no se puede recorrer detiene la limpieza con su motivo («limpieza detenida»).
  - Nunca se ofrece borrar un PDF con `tocadoEn` de menos de 24 h.
  - Adjuntar, reenlazar y restaurar toman el Web Lock `concreta.planos` en modo compartido hasta que su guardado ha aterrizado; «Liberar espacio» lo toma en exclusiva.
  - Sin Web Locks (http en red local), «Liberar espacio» pregunta antes a las demás pestañas por `BroadcastChannel` qué huellas tienen en memoria y en su historial, y espera su respuesta 500 ms.
  - El almacén es un módulo propio de IndexedDB (`concreta-planos`, con versión explícita) y dos almacenes:
    - `meta`, por huella: `tamano`, `tipo`, `tocadoEn`, `sinReferenciaDesde`;
    - `bytes`, por huella, escritos una sola vez.
  - Las marcas solo tocan `meta`; borrar es una transacción sobre los dos. idb-keyval no sirve aquí: su `update` reescribe el valor entero (los bytes) y solo admite un almacén por base de datos.
  - Un plano quitado sigue contando como referencia mientras su alta esté en el historial de Deshacer de esta pestaña. «Liberar espacio» lo lista aparte con «Liberar ya: Deshacer ya no recuperará la capa de N líneas», así el espacio se recupera en el acto si el usuario lo pide.
  - El borrado automático entre pestañas queda en TODOS (P3).
- **Plano quitado sin perder la procedencia** (las dos voces): `removePlano` deja el `PlanoMeta` con `quitado: at` (fuera de las listas y del recuento de referencias de «Liberar espacio»). Volver a adjuntar el mismo PDF lo revive con sus escalas y sus líneas. Cada `origen` guarda además `huella` (el sha256 del PDF con el que se midió).
- **Revisión de calibración** (las dos voces; sustituye la comparación de `mPorUnidad` como número): cada `Escala` lleva `rev` (id nuevo en cada calibración) y cada `origen` guarda `calRev`. Las candidatas a recalcular son las líneas con `calRev` distinto. Todo camino que cambia la escala de una página con líneas pasa por `rescalePlanoPage`:
  - «Usar la calibrada»;
  - «Usar esta calibración en otras páginas»;
  - «Usar este PDF para este plano».
- **`expect` por operación** (Codex; precisa `ExpectLineas` del bloque DX): además de ids, valores, certificadas y `docToken`, cada acción compara `calRev` de la página, `huella` del plano y `medForma` y unidad del destino. Dentro del `set`, la acción vuelve a preparar contra el estado vivo con la misma función pura (`prepararMedida`) y solo aplica si el resultado coincide con lo que el usuario revisó; si no, `reason: 'stale'` con el motivo. Test: cambiar la calibración o la forma del destino con la hoja «Añadir a N partidas» abierta.
- **Una forma, una geometría** (las dos voces): `formaId` identifica una geometría inmutable. «Volver a medir» da un `formaId` nuevo a la línea. En la Etapa B, `moveShapeVertices` con «Aplicar también» mantiene el `formaId` solo en las líneas que actualiza; las que se salta pasan a un `formaId` propio. Invariante con test: misma `formaId` ⇒ mismos `puntos`.
- **Valores aceptados a mano** (Codex; precisa «Aceptar valores actuales» del bloque DX): aceptar marca `origen.aceptada = true`, conserva los valores que salieron de la geometría y excluye la línea de los recálculos automáticos (se lista con las retocadas). Solo «Volver a medir» devuelve la autoridad a la geometría.
- **Primera medida en una partida con cantidad fija** (Codex): la vista previa de NOMBRANDO y el aviso de CREADA enseñan «fija 100 → medida 5» (`resumenCantidad` y `cambioCantidad`, como el pegado). La línea entra con Deshacer y el cambio queda dicho. Convertir la cantidad fija en línea sigue en TODOS (P3, ya existe).
- **Copia .zip segura** (las dos voces; sustituye «tope calculado del contenido» del bloque DX):
  - Topes absolutos:
    - 2 GB descomprimidos en total;
    - 500 MB por entrada;
    - 500 entradas;
    - 50 MB para `obra.json`.
  - Los bytes se cuentan al descomprimir en flujo (`Unzip` de fflate) y se aborta al pasarse; nunca se confía en los tamaños declarados.
  - Se rechazan los nombres duplicados y los desconocidos.
  - La clave de cada PDF es la huella CALCULADA, no la declarada.
  - Los PDF se guardan sin comprimir (nivel 0) y la exportación se escribe por partes en un Blob.
  - Los tests del .zip van en el proyecto de Vitest en node.
  - Un solo contrato para exportar e importar (segunda pasada):
    - adjuntar rechaza un PDF de más de 500 MB y avisa si la obra pasaría de los topes del .zip;
    - exportar comprueba los mismos topes antes de empezar. Si no caben, lo dice y ofrece «.json y los PDF por separado», en vez de rotular «completa» una copia que no se podría restaurar.
    - Tests de cada tope en los dos sentidos.
- **Restaurar un .zip por etapas** (Codex; precisa el coordinador del bloque DX y sustituye su «la obra se restaura con los planos que entraron»):
  - escribe los PDF uno a uno y anota cuáles son nuevos en este equipo;
  - si la cuota se acaba, deja de escribir PDF y retira los nuevos que hagan falta para que quepa la obra;
  - carga la obra y espera a que `flushPending()` devuelva `true` antes de anunciar nada;
  - con la obra guardada, el resumen dice qué planos quedaron «no disponibles» (restauración parcial del bloque de diseño);
  - si la obra no se puede guardar ni así, retira todos los PDF nuevos de esta restauración, vuelve a cargar la obra anterior y lo dice. Nunca se anuncia un éxito que solo existe en memoria.
  - La copia previa al importar es un .zip si la obra actual tiene planos.
  - Cada restauración lleva un token (segunda pasada):
    - los PDF que escribe se anotan con él en `meta`;
    - retirarlos solo borra los que siguen siendo suyos y no tienen referencia viva, con la misma comprobación que «Liberar espacio». Si otra pestaña adoptó esa huella entretanto, se quedan.
  - La restauración va en la cola de operaciones de obra (`serializeOp`) y cancela los guardados pendientes de la obra importada antes de volver a la anterior. «La obra anterior» sale de una instantánea en memoria tomada antes de `loadObra`, no del disco.
  - Arreglo del mismo fallo que ya existe en `ProjectBackup.tsx`: hoy ignora el `false` de `flushPending` al importar un .json.
- **Adaptador de pdf.js** (las dos voces; precisa la interfaz del bloque DX):
  - `pagina(n)` devuelve `{ vista: [x0, y0, x1, y1], rotacion, userUnit }`: la caja visible en el espacio de usuario del PDF, con la y hacia arriba. Las transformaciones pantalla ↔ página y los textos usan esa misma convención, y `region` y `escala` de `pintar` se definen en ella.
  - `abrir(datos, { signal })` se puede cancelar; cada resultado lleva un número de generación y un documento que llega tarde se cierra.
  - Los bytes se releen de IndexedDB en cada apertura, porque pdf.js se queda con el buffer.
  - Fixtures: origen de caja distinto de 0, CropBox, las cuatro rotaciones y rotación con `UserUnit`.
  - `trazados?` queda en la interfaz, pero no se implementa en la Etapa A.
- **pdf.js en el build:**
  - `cMapUrl`, `standardFontDataUrl` y `wasmUrl` (pdf.js 5) salen en `dist` y se resuelven con el `base` de Pages; sin ellos, el texto CID del cajetín sale mal y los escaneos, en blanco.
  - Se usa el build `legacy`, o el README dice el navegador mínimo; se prueba en Safari de iPad.
  - La rueda se escucha con un listener nativo `{ passive: false }` y el lienzo lleva `touch-action: none`.
  - Los lienzos se liberan (ancho y alto a 0) al cambiar de página.
  - Se juntan los textos contiguos y se lee también «ESCALA 1/N» y «E 1/N».
  - El hash de la huella se calcula en un worker.
  - Los assets se copian a `dist` con un plugin propio en `vite.config.ts`, como el `versionFile` que ya emite `version.json`: sin dependencia nueva.
  - Con el build `legacy`, el worker también es `legacy/build/pdf.worker.min.mjs`, y el test de versiones comprueba además la ruta.
  - `enableXfa: false` explícito.
  - El texto sacado del PDF (propuestas de comentario, en A1) solo entra como nodo de texto de React o `<text>` de SVG, nunca con `innerHTML`, y al .bc3 por el `field()` que ya sanea.
- **Pestaña de solo lectura:** el visor solo deja ver; adjuntar, calibrar y medir salen deshabilitados con el motivo, igual que el asistente (`ai/executor.ts`).
- **Interruptor en tiempo de ejecución** (sustituye la constante de compilación `PLANOS_VISOR` del bloque DX):
  - Hasta superar la puerta, el visor se activa con `?planos=1` o con `localStorage['concreta.planos']`, y en producción va apagado por defecto. Así se hace el dogfood en la app publicada y apagarlo es inmediato.
  - El lector y el escritor v6 NO van detrás del interruptor.
- **Teclado, defensa en profundidad** (precisa «Teclado y clics del visor»):
  - `isInteractiveTarget` reconoce `[data-planos-viewer]`, así que Supr nunca borra la partida aunque falle un `stopPropagation`.
  - `role="dialog"` solo para modales de verdad: `hasBlockingOverlay` apagaría Ctrl+Z y Ctrl+K con los popovers.
  - Enter con `e.isComposing` no crea la línea.
- **Ciclo de medida como reductor puro:** `core/planoCiclo.ts` (`(estado, evento) → { estado, efectos }`). La tabla de estados y eventos de la especificación es su tabla de tests; el visor solo la conecta.
- **Restar se ve por el signo:** el sombreado sale del signo de `uds`, no de `origen.resta`, así que la capa nunca contradice a la línea.
- **Acciones que faltaban**, con `structural()`, `fromBase = false` y `pesoDesdeComentario` como `insertMedLines`: `renamePlano`, `setPlanoPageLabel`, `setPlanoScaleAdjusted`, `relinkPlano` y `attachPlanoRevision`.
- **Números de las casillas:**
  - Un solo formateador de cifras para `expr` en `core/` (sin separador de miles ni notación exponencial), con tests de referencia.
  - El .bc3 exporta las dimensiones con hasta 4 decimales (`num(v, 4)` ya quita los ceros de cola, así que las líneas de ≤ 3 decimales salen idénticas); test de ida y vuelta.
- **Contradicciones cerradas** (sustituyen las versiones anteriores):
  - Destino: «Midiendo en ▾» abre la partida elegida (`openPartidaId` sigue siendo la única fuente).
  - Dimensiones fijas: viven en `planoUiStore` por partida, se proponen desde el `origen.fijas` o `origen.factor` de su última línea medida, y `origen.fijas` registra lo escrito.
  - La rueda desplaza y Ctrl + rueda hace zoom.
  - Los PDF se guardan por huella y el tamaño se llama `tamano`.
  - Adjuntar un PDF cuya huella ya está en la obra: «Ya está adjunto como Planta 1», con [Abrirlo] [Adjuntar otra vez (para otra escala)]. El bloque CEO («no lo duplica») y el DX («Adjuntar otra vez») quedan así: nunca se duplica sin que se pida, y los bytes se guardan una sola vez.
- **Calibración:** si se puede, la comprobación va sobre una cota a más de 45° de la de calibrar. La franja lo sugiere y la lupa lo facilita.
- **El resumen del recálculo avisa** si alguna partida queda por debajo de lo ya certificado («C2 certificó 120 m²; la medición pasa a 112 m²»).
- **Marcador fuera de la rejilla:** la columna de 28 px no cuenta como celda en `editGridNav` ni en `useMedGridTab`, ni en el mapeo TSV de copiar y cortar. Se amplían los tests de Tab y de Excel.
- **La puerta, medible** (las dos voces en la segunda pasada; sustituye las tolerancias de la primera):
  - Los valores de referencia se calculan antes de medir, a partir de las cotas del plano, y se escriben en `docs/spike/03-planos-cronometrado.md`.
  - Tolerancias por magnitud:
    - longitudes: |Δ| ≤ 2 cm + 0,5 %;
    - superficies: |Δ| ≤ 1 %;
    - recuentos: exactos;
    - cada total de partida: ≤ 0,5 %.
  - Cronómetro: desde abrir el PDF hasta crear la última línea, con la calibración dentro y la caché del navegador vacía en la primera página.
  - Orden cruzado, para quitar el efecto aprendizaje: una partida se mide primero a mano y la otra primero con Concreta.
  - Presupuesto de pintado con un plano CAD real pesado, en el portátil de dogfood (mientras llega la imagen nítida, se enseña la escalada):
    - primera página visible: < 2 s;
    - cambio de página: < 1 s;
    - zoom nítido: < 1,5 s.
- **Tests que añade ingeniería** (además de los ya previstos; lista completa en el registro de la fase 3):
  - `src/persist/sync.test.ts`: fixture v7 por hidratar, conmutar y traspaso, sin borrar ni pisar; traspaso fallido → solo lectura sin autosave.
  - `src/persist/persist.test.ts`: `saveObra` sobre un sobre v7 no escribe.
  - `src/persist/registry.test.ts`: las claves v5 (`concreta.obra.*`) no aparecen en el `reconcile` de v6; `huellas` y `huellasDe` en `ObraMeta`.
  - `src/persist/planos.test.ts`: `update` quita la marca; «Liberar espacio» relee y respeta una marca cambiada; sobre ilegible → recorrido crudo o «limpieza detenida»; «Liberar ya» de un plano quitado.
  - `src/store/schema.test.ts`: los `planos` inválidos se conservan como datos opacos y la obra carga.
  - `src/core/planoGeom.test.ts`: área invariante a giro y traslación; autocruces (colineal, vértice tocante, tramo de cierre); Mayús con `/Rotate 90`; formateador de `expr`.
  - `src/core/planoCiclo.test.ts`: la tabla de estados y eventos.
  - `src/store/planos.test.ts`: `expect` por operación (`calRev`, `medForma`); `removePlano` con `quitado` y revivir; `remeasureLine` con `formaId` nuevo; invariante `formaId` ⇒ `puntos`; `aceptada` fuera del recálculo; aviso de certificado > medición; «fija → medida».
  - `src/core/bc3export.test.ts`: 4 decimales de ida y vuelta; ≤ 3 decimales idénticos.
  - `src/persist/transfer.node.test.ts`: .zip con tamaños falsos, duplicados y tope real; restauración con cuota llena.
  - `src/features/obra/ProjectBackup.test.tsx`: `flushPending` falso → error visible.
  - `src/features/planos/pdfAdapter.node.test.ts`: caja con origen ≠ 0, CropBox, cuatro rotaciones, rotación con `UserUnit`; abrir A → B → llega A y se cierra.
  - `src/hooks/useAppHotkeys.test.tsx`: Supr dentro de `[data-planos-viewer]` no borra la partida.
  - `src/features/presupuesto/*`: Tab y TSV con la columna del marcador; Enter con `isComposing`.
  - Integración con el doble: pestaña de solo lectura (el visor solo ve); adjuntar mientras otra pestaña libera espacio; Deshacer tras medir y volver a medir.
- **Dónde nace un `formaId`** (segunda pasada): en las llamadas, nunca dentro de `lineaParaDestino`, que es el helper común de las cuatro rutas.
  - Duplicar y pegar dan uno nuevo.
  - «Añadir también a…» reutiliza el de la forma.
  - Mover a otra partida lo conserva.
- **Pegar en otra forma de medir:** si `compatibilidad()` dice que las casillas cambian de significado o de unidad, la línea pegada pierde `origen` (conserva los números). Así un recálculo nunca escribe una magnitud geométrica donde la unidad ya es otra.
- **X0 es una puerta dura:** la especificación canónica incluye el contrato de lo que se guarda y fixtures JSON de referencia por herramienta. El lector y el escritor v6 entran en UN commit, después de X0, porque cada push a `main` publica. El contrato cubre:
  - `PlanoMeta` con `quitado`, `sustituye` y `revision`;
  - `Escala` con `rev` y `comprobacion.fuente`;
  - `OrigenPlano` con todos los campos de A1.
- **Tests de la segunda pasada:**
  - pestaña antigua + traspaso con la obra ya en el espacio v6: la v6 queda intacta y sale el aviso de cambios antiguos;
  - un `saveObra` rechazado sale de `pending`, y otra obra se guarda después;
  - una v7 con otra forma sale como «más nueva» en `activateFirstLoadable`, en `discardRecovery` y en la fuente de Referencia;
  - importar un .json y «Actualizar», con el volcado en `false` o lento;
  - `ultimaCopia` y `huellas` sobreviven al autosave;
  - una meta sin `huellas` hace leer el sobre;
  - adjuntar en B y pulsar «Liberar espacio» en A antes de que B guarde conserva el PDF;
  - marcar no reescribe `bytes`;
  - una restauración que falla mientras otra pestaña adopta la misma huella;
  - los topes del .zip al exportar y al importar;
  - la precisión y la plausibilidad de la calibración;
  - el `formaId` al duplicar, pegar, mover y con «Añadir también a…»;
  - pegar en otra forma quita `origen`;
  - Restar deshabilitado sin E12.
- **TODOS.md:** el borrado automático de PDF entre pestañas (P3), además de los aplazados de las fases anteriores.
<!-- /autoplan-accepted:eng -->
## Review record

<!-- autoplan-accepted:ceo -->
- **Recalibrar con medidas hechas:** si una página ya tiene líneas medidas y se cambia su escala, el visor pregunta «¿La escala anterior estaba mal?». Hay dos respuestas: «Sí, recalcular N líneas con la escala nueva» y «No, solo cambia la escala para lo que mida ahora». La segunda es la opción por defecto: Enter no recalcula nada, así que cambiar a 1:20 para medir un detalle y volver a 1:50 no toca las líneas.
  - Candidatas: las líneas de esa página cuya escala es distinta de la nueva, que no son de Recuento y que no están retocadas a mano, agrupadas por escala antigua («12 líneas a 1:50 · 3 a 1:20»). Las retocadas se listan aparte y no cambian.
  - Cambiar la escala y recalcular son UN paso de Deshacer (valores y `expr` salen de `valoresDesdeOrigen`). El aviso resume «N líneas · cantidad A → B <ud>» por partida.
  - Si se rechaza, la página queda con la escala nueva para lo que se mida después, y las líneas viejas conservan la suya. La lista de planos avisa: «N líneas medidas con otra escala».
  - Las líneas certificadas (`lineQty > 0` en alguna cert) NO se recalculan: se listan aparte («2 líneas certificadas en C1: revísalas a mano»), igual que las retocadas. Así no hace falta una guarda nueva para varias partidas y ninguna cantidad certificada cambia sola.
  - Tests: recalcular cambia valor, `expr` y `origen.mPorUnidad`; la retocada y la certificada no cambian y se listan; Deshacer revierte todo; Enter por defecto no recalcula; detalle a 1:20 y vuelta a 1:50 deja las líneas como estaban.
- **La escala siempre a la vista:** la lectura en vivo y la franja del visor muestran la escala activa («1:50 · calibrada con 5,00 m · comprobada 0,3 %»). Cada línea guarda la suya (`origen.mPorUnidad`).
- **Escala del cajetín como comprobación** (sustituye al atajo 1:N y a la calibración desde el texto, que las dos voces CEO vieron redundantes con la cota obligatoria): si el texto de la página contiene «1:N», «E 1:N» o «ESCALA 1:N», la franja compara la calibrada con la declarada («calibrada 1:49,7 · el plano dice 1:50»).
  - A menos del 1 %, `mPorUnidad` se ajusta a la escala exacta (`ajustada: true`). Por encima, aviso en tono de advertencia («La calibración no cuadra con la escala del plano: ¿el PDF está a otro tamaño?»), sin bloquear, porque la cota manda.
  - Hasta calibrar con dos puntos y comprobar con una segunda cota, Longitud, Superficie y Rectángulo siguen deshabilitadas.
  - Tests: dos puntos a 1:49,7 con «E 1:50» en el texto se ajustan a 1:50; a 1:47 avisan sin ajustar; `userUnit` 2 dobla la unidad; el lector descarta «1:2» dentro de una fecha y «1/2».
- **Comentario propuesto desde el texto del PDF:** en Superficie y Rectángulo se propone el texto de la página que cae dentro del polígono: el de mayor tamaño de letra que no sea una cifra. En Longitud y Recuento solo va el prefijo.
  - Nunca bloquea: Enter acepta la propuesta; el primer Esc deja solo el prefijo y el segundo descarta la forma (ver «Teclado y clics del visor»).
  - Tests con textos simulados: dentro o fuera, número descartado, sin texto.
- **Una forma, varias partidas** (taste; pasa a la Etapa A por acuerdo de las dos voces CEO): al crear la línea de una forma, la franja ofrece «Añadir también a…» con las partidas usadas hace poco en este plano (hasta 5) y un buscador. Con Mano, una forma ya dibujada ofrece lo mismo. No necesita la capa de toda la obra.
  - Cada partida elegida recibe una línea NUEVA con el mismo `formaId` y su propia magnitud; todas en UN paso de Deshacer.
  - Las ofertas salen de la tabla de §5: el perímetro CERRADO de la forma se trata como la fila Longitud (largo = perímetro; «(tramos)×h» en Sup. directa; largo = perímetro con la Anchura fija como altura en Superficie L×A) y su área como la fila Superficie, incluido el paso a Sup. directa en partidas L×A. Un rectángulo ofrece también su perímetro, igual que en §5.
  - La línea nueva guarda su propia `magnitud`: cuando un recálculo de escala o una edición de vértices propagada (ver «Editar vértices») la alcanza, se recalcula con esa magnitud, nunca con la del origen.
  - Tests: el polígono de «Solado» entra como perímetro en «Rodapié» (Longitud) y como perímetro × 2,70 en «Pintura» (Sup. directa); en una partida por Unidades no se ofrece; recalcular la escala actualiza las dos líneas, cada una con su magnitud.
  - Etapa A.
- **Capa de toda la obra:** conmutador «Esta partida / Toda la obra», color por partida con leyenda y formas ajenas atenuadas (Etapa B).
- **Editar vértices:** arrastrar un vértice recalcula valores, `expr` y `origen` de su línea en un paso de Deshacer. Una línea retocada a mano pide confirmación antes de sobrescribirse (Etapa B).
  - Si otras líneas comparten el mismo `formaId` (creadas con «Añadir también a…»; una línea duplicada es independiente), se ofrece «Aplicar también a N líneas» (taste, amplía #5). Cada una se recalcula con su `magnitud`, en el MISMO paso de Deshacer; las retocadas a mano y las certificadas se saltan y se listan. Sin aplicarlo, la capa marca «N líneas más usan la forma anterior».
  - Tests: editar el polígono de Solado con «Aplicar también» actualiza Rodapié y Pintura con su magnitud; sin aplicarlo, quedan igual y marcadas.
- **Copia de la obra con planos (.zip), en la Etapa A** (Codex: una copia que no restaura los planos rompe la promesa de «guardar la obra entera»): `ProjectBackup` ofrece «.json» (sin planos) y «.zip con planos», y restaurar el .zip en un navegador limpio devuelve obra, planos, escalas y capa.
  - Importar un .zip restaura obra y blobs, y verifica el `sha256` de cada PDF. Un PDF que no cuadra se descarta con aviso y su plano queda «no disponible».
  - `fflate` pasa a `dependencies`: hoy solo está en `devDependencies` y llega de forma transitiva por `write-excel-file`.
  - Test: exportar .zip → borrar IndexedDB → importar → la capa y «Ver en plano» funcionan.
  - La interfaz dice que las líneas medidas no dependen del PDF: si se pierde, solo se pierde la capa, y se recupera volviendo a adjuntarlo.
- **Imágenes como plano (Etapa B, esfuerzo M):** PNG y JPG entran como plano de una página.
  - Unidades en píxeles de la imagen, con la orientación EXIF ya aplicada (`createImageBitmap` con `imageOrientation: 'from-image'`).
  - Para pintar se reduce a ≤ 16 MP; la geometría sigue en píxeles originales.
  - Sin atajo 1:N ni escala leída: calibración con dos puntos obligatoria.
  - El botón dice «Adjuntar plano (PDF o imagen)».
- **Tabla herramienta × forma, dos casillas más:**
  - Superficie (polígono) en una partida por Longitud → largo = perímetro, con `expr` de los tramos.
  - Longitud en Sup. directa o Sup. × espesor → largo = L × altura fija, con `expr` «(tramos)×h». Sin altura fija, la herramienta pide rellenarla.
  - Tests de las dos.
- **Esquema v6 obligatorio:** `SCHEMA_VERSION` sube a 6 para que una versión antigua RECHACE la obra en vez de guardarla sin `planos`.
  - Tests: migración v5 → v6 (`planos: []`); rechazo de v7.
- **Tabla completa en tests:** `core/planoMedida` prueba CADA celda de la tabla herramienta × forma de §5: casillas escritas, dimensiones fijas obligatorias y motivo de «no encaja». Incluye Recuento en formas con más columnas, Peso sin perfil y el paso a Sup. directa (un paso de Deshacer; rechazar deshabilita la herramienta).
- **`origen` en las copias de líneas:** `lineaParaDestino` (`core/medPaste.ts`) clona `origen` en profundidad; hoy lo perdería.
  - Duplicar y mover (cortar y pegar) lo conservan mientras el destino tenga ese plano.
  - El TSV nunca lo lleva. Pegar en una obra cuyo `planos` no contiene `origen.planoId` lo quita (no se usa `docToken`, que cambia al volver a abrir la misma obra).
  - Tests de las cuatro rutas.
- **Carga de obra sin herencia:**
  - `loadObra` pone `planos: []` por defecto, como ya hace con `bajas`: importar un .bc3 tras una obra con planos no los hereda.
  - `importObraAsReferenceImpl` (`persist/sync.ts`) estampa `planos: []`.
  - `toSerializable` incluye `planos` en su lista explícita de claves.
  - Tests de las tres rutas.
- **Planos compartidos entre obras:** un `planoId` puede estar en más de una obra (importar el .json de X en Y).
  - Borrar una obra no borra blobs: los deja a la limpieza de huérfanos (§2), que solo borra los que ninguna obra referencia.
  - La limpieza lee los sobres de todas las obras y se ABORTA entera si alguno no se puede leer (los corruptos se guardan para recuperarlos). La marca `sinReferenciaDesde` se quita en cuanto el blob vuelve a tener referencia.
  - Tests: borrar Y con un plano compartido con X lo conserva; un sobre corrupto detiene la limpieza; un blob marcado, referenciado de nuevo y vuelto a quitar espera otros 7 días.
- **Sin contexto seguro:** con la app servida por `http://`, adjuntar y reenlazar funcionan con el `sha256` puro (`core/sha256.ts`). Tests: vectores conocidos, y adjuntar con `crypto.subtle` ausente.
- **Quitar un plano:** pide confirmación con cuántas líneas salen de él.
  - Las líneas conservan números y `origen`, marcado «plano quitado».
  - Quitar es un paso de Deshacer. El blob no se borra en el acto (lo hará la limpieza de huérfanos, con su margen de 7 días), así que Deshacer lo recupera entero.
  - Tests: quitar → Deshacer → la capa vuelve.
- **Teclado y clics del visor:**
  - La raíz del visor lleva `tabIndex=-1` y toma el foco en `pointerdown`: los atajos globales escuchan en burbuja (`useAppHotkeys` en `window`, `useMedClipboard` en `document`), así que el visor solo puede consumir teclas si el foco está dentro.
  - Mientras se dibuja una forma o está abierto el comentario, el visor consume Esc, Enter, Retroceso, Espacio y Ctrl/⌘+Z (`preventDefault` + `stopPropagation`), así `useAppHotkeys` no cierra la partida.
  - Esc a medio dibujo cancela la forma. En el comentario, el primer Esc borra el texto propuesto y el segundo descarta la forma sin crear la línea.
  - El visor entra en el orden de Esc de `useAppHotkeys`: salir de pantalla completa → cerrar el visor de planos (como Referencia y Asistente) → cerrar la partida. Y entra en la exclusión mutua de `setRefOpen` / `setAsistenteOpen` (abrir uno cierra los otros).
  - Ctrl/⌘+Z a medio dibujo quita el último vértice y no toca el historial.
  - Supr (Delete) con el foco en el visor NUNCA llega a `useAppHotkeys` (que borraría la partida abierta): con una forma seleccionada (Mano) borra su línea por `deleteLines`, con la guarda de certificadas; sin selección no hace nada.
  - Espacio desplaza solo si el foco no está en un campo de texto (el comentario).
  - Con una herramienta de medir activa, un clic siempre añade vértice. Seleccionar una forma existente (foco en su línea, o «Añadir también a…») solo funciona con Mano o sin herramienta.
  - Tests: Esc a medio dibujo no cierra la partida; Esc con el visor en reposo lo cierra y deja la partida abierta; dos Esc en el comentario descartan la forma; Ctrl+Z quita un vértice sin deshacer la última línea; abrir el visor cierra Referencia; Supr con el visor enfocado no borra la partida.
- **Revisión de un plano** (Codex; mínimo, Etapa A): «Adjuntar revisión» crea un plano NUEVO con `sustituye` apuntando al anterior y `revision` («Rev. B»); el anterior no se toca. Las líneas siguen en la revisión con la que se midieron y lo dicen («P1 · Rev. A»). Al abrir una revisión sustituida, aviso «Hay una revisión más nueva». Comparar revisiones queda en TODOS.
  - Tests: adjuntar revisión conserva el plano viejo, sus escalas y sus líneas; el aviso aparece en la vieja.
- **Trazados en el adaptador:** `pdfAdapter` expone ya `trazados(pagina)` (segmentos de las rutas del PDF vectorial), aunque el imán llegue en la Etapa B, para no rehacer la interfaz. Test con el doble.
- **Puerta cronometrada** antes de la Etapa B (ver Etapas): sin el documento `docs/spike/03-planos-cronometrado.md` con la meta cumplida no se empieza la B.
- **Acciones de store atómicas** (cada una es UN `set` dentro de `structural()`, con cortes de historial antes y después, y revalida contra el estado del momento: partida existente, líneas retocadas y certificadas):
  - `adjuntarPlano(meta)`, `quitarPlano(planoId)`, `calibrarPagina(planoId, pagina, escala)`;
  - `medirEnPartida(chapterId, partidaId, lineas, { medForma?, afterId? })`: cambia la forma (paso a Sup. directa) y da de alta las líneas en el mismo `set`;
  - `recalibrarPagina(planoId, pagina, escala, lineIds, expect)`: escala nueva + recálculo de las líneas indicadas, en varias partidas;
  - `volverAMedir(lineId, origen, expect)` y `editarVertices(origenLineId, puntos, alsoLineIds, expect)`.
  - `expect` es, como en `moveMedLinesTo`, lo que la UI preparó y el usuario confirmó: ids, valores y ids certificados. Si una línea se certificó o se retocó entre la confirmación y el `set`, devuelven `reason: 'stale'` y la UI vuelve a preparar y a preguntar.
  - `volverAMedir` sobre una línea certificada pasa por la guarda de certificadas existente (una partida). `editarVertices` se salta las líneas certificadas de otras partidas y las lista, igual que recalcular.
  - Devuelven `MedResult` (`reason: 'stale'` si algo cambió entre la preparación y el `set`).
  - Tests: cada acción es un solo paso de Deshacer; `stale` no toca nada.
- **El estado del visor tras Deshacer:** `planoUiStore` se reconcilia con `obraStore.planos` en cada cambio: si desaparece el plano que se ve, vuelve a la lista; si la página ya no existe, va a la 1; la forma a medio dibujar se descarta si su página ya no está calibrada.
  - Test: adjuntar → Deshacer → el visor enseña la lista sin errores.
- **`uds` y dimensiones fijas en tests:** recalcular una línea con `uds = 2` tecleado conserva el 2; la Altura fija de Pintura no aparece al abrir Alicatado; conflicto de perfiles en Peso bloquea Enter.
- **Casos límite de las secciones CEO:**
  - Adjuntar un PDF con el mismo `sha256` que otro plano de la obra no lo duplica: «Ya está adjunto como Planta 1».
  - Cambiar de partida abierta a medio dibujar descarta la forma con el aviso «Forma descartada: cambiaste de partida».
  - Tests de los dos.
- **.zip seguro y sin bloquear:** exportar e importar con la API asíncrona de `fflate`; al importar, tope de tamaño descomprimido (500 MB), solo nombres conocidos (`obra.json`, `planos/<id>.pdf|.png|.jpg`) y `sha256` verificado. Tests: bomba zip rechazada; nombre desconocido ignorado.
- **Bytes al worker sin copia:** los bytes leídos de IDB se transfieren al worker de pdf.js; el pintado se cancela (`renderTask.cancel()`) y solo pinta la última petición.
- **PDF reales en tests:** fixtures generados con geometría conocida (A3 a 1:50, variante con /Rotate 90 y con `userUnit` 2) y un test de pdf.js real en entorno node que comprueba coordenadas, rotación y unidad.
- **Un solo envoltorio para el hueco lateral:** `LateralAside` en `App.tsx` para Referencia, Asistente y Planos (divisor, split, overlay y pantalla completa), en lugar de una tercera copia del bloque.
- **Detalles de la medida:** cada línea con `origen` enseña plano, revisión, página, escala (y si está ajustada), herramienta y fecha. La forma exacta la decide la fase de diseño.
- **TODOS.md al aprobar:** varias escalas por página (P3), exportar el plano marcado para la DF (P2), certificar sobre el plano (P3), contar símbolos iguales automáticamente (P3), comparar revisiones de un plano (P2). El imán a la geometría vectorial pasa a ser lo primero de la Etapa B.
<!-- /autoplan-accepted:ceo -->
<!-- autoplan-accepted:design -->
- **Precedencia:** si choca con el bloque CEO, manda este (diseño > CEO); cada punto dice qué sustituye.
- **Sustituciones en el texto base del plan** (se leen como corregidas):
  - Objetivo: «clic, clic, Enter por medida» pasa a «clic… Enter para cerrar la forma y Enter para aceptar el comentario».
  - §4: «rectángulo por dos esquinas» pasa a «rectángulo por tres clics» (ver abajo).
  - §5: Restar ya no sale «en rojo discontinuo»: usa sombreado e insignia «−» (ver «Lenguaje visual de la capa»).
  - §5: «Comentario … que se pide tras cada medida» sigue igual, dentro del estado NOMBRANDO.
  - §6: «Página sin calibrar: aviso» es el aviso único con su acción; «Clic en una forma (con Mano)» abre el popover de la forma.
  - §7: la tablet solo ve en la Etapa A.
  - Archivos: `CalibrarDialog.tsx` pasa a `CalibrarPasos.tsx` + `Lupa.tsx`; nuevos `MedOrigen.tsx` y `AnadirTambien.tsx`.
- **Espacio de trabajo del visor:**
  - Planos tiene su propio ancho, no el tope 320–640 de Referencia (`setRefWidth`): mínimo 480 px, máximo «ancho útil − 520 px», por defecto el 55 % del área principal. El tirador es el de `LateralAside`.
  - Hay split solo si caben el lienzo (≥ 480 px) y el presupuesto (≥ 520 px); si no, el visor ocupa el área principal. El umbral sale de esos anchos útiles, no del `SPLIT_WIDTH` de 1100.
  - Selector de partida propio en la franja («Midiendo en ▾»): buscador más las recientes (las mismas 5 de «Añadir también a…»). Así el visor sirve también en pantalla completa y en overlay.
  - Por anchos:
    - ≥ 1366: split por defecto;
    - 1024–1365: split si caben los mínimos; si no, overlay;
    - 760–1023 (tablet): overlay de solo ver (medir con el dedo pasa a la Etapa B);
    - < 760: solo ver, con «Planos» en el menú «Más» del TopBar.
  - Tests: el cálculo de split a 1366 y a 1024; el overlay trae su selector.
- **Cabecera, aviso y franja:**
  - Cabecera, una fila de 40 px:
    - plano ▾;
    - página ▾ («P1 · Planta baja · 1:50 ✓ · 4 medidas»);
    - chip de escala por estado: «Sin calibrar» (neutral), «1:50 · ±0,3 %» (accent), «1:50 ajustada» (accent), no cuadra con el cajetín (`--state-warn`);
    - menú ⋯: Adjuntar plano, Adjuntar revisión, Renombrar, Etiquetas de página, Quitar plano.
  - Aviso único encima del lienzo (banda de 32 px): solo el más prioritario, con su acción. Orden: plano no disponible > revisión más nueva > calibración que no cuadra > página sin calibrar.
  - Franja inferior, fila 1 (siempre): «Midiendo en: 2.6 EAV010 Acero en vigas · Peso ▾» y el total «12 líneas · 148,30 kg».
  - Franja inferior, fila 2, según el estado:
    - EN REPOSO: dimensiones fijas; la obligatoria que falta, con borde `--state-warn`;
    - DIBUJANDO: lectura en vivo (Geist Mono) y pistas «Enter cierra · Retroceso quita punto · Esc cancela»;
    - NOMBRANDO: prefijo como chip fijo, comentario con la propuesta seleccionada y vista previa («largo 18,40 → parcial 18,40 m²»);
    - CREADA: «✓ Línea 7 · 18,40 m²», [Ver línea] y «Añadir también a…», hasta el siguiente vértice.
  - Sustituye a la franja del §6 como única superficie de medir.
- **Ciclo de una medida (contrato):**
  - Estados: EN REPOSO → DIBUJANDO → NOMBRANDO → CREADA → (siguiente clic) DIBUJANDO.
  - Enter o doble clic cierra la forma y pasa a NOMBRANDO con la propuesta seleccionada (lo que se teclee la sustituye). Un segundo Enter crea la línea. La secuencia real es «clic… Enter, Enter», y así la cuentan la ayuda y el objetivo.
  - Tras crear la línea:
    - el foco sigue en el visor y se mantienen la herramienta y las dimensiones fijas;
    - la línea nueva se desplaza a la vista en la tabla SIN mover el foco;
    - `aria-live` anuncia «Línea 7 creada: P1 · Salón, 18,40 m²».
  - Punto de inserción: se fija al entrar a medir (tras la línea con el foco, o al final) y AVANZA a la última línea creada desde el visor, así las medidas salen en orden. No usa el `requestFocus(..., scroll)` de `medLineOps`.
  - El aviso con «Deshacer» se ancla a la izquierda del área principal y no tapa ni la franja ni el lienzo.
  - Tests: tres medidas seguidas salen en orden; el foco no sale del visor; Esc tras crear no cierra la partida.
- **Teclado en el campo de comentario:** mandan las teclas nativas de edición (Retroceso borra letras, Ctrl/⌘+Z deshace texto). El visor solo gestiona Enter (crear) y Esc. Un solo Esc descarta la forma: sustituye el doble Esc del bloque CEO, porque con la propuesta seleccionada ya no hace falta el primero.
- **Calibrar en el lienzo, sin modal:**
  - Paso 1 «Cota conocida»: dos clics y la distancia en un campo anclado al segmento.
  - Paso 2 «Comprobación»: dos clics sobre otra cota y su valor.
  - En los dos pasos, los puntos se pueden arrastrar antes de confirmar.
  - Ayudas de precisión al colocar puntos de calibración y vértices: cursor en cruz con guías a todo el ancho y lupa ×4 (recuadro de 120 px en la esquina opuesta al cursor). Mayús bloquea 0/45/90°.
  - Si falla la comprobación: «Desviación 2,8 %» con [Rehacer cota] y [Rehacer comprobación], sin empezar de cero.
  - En el mismo flujo se pide «Esta página es: [P1]» (la etiqueta), con propuesta desde el texto si la hay.
  - «Usar esta calibración en otras páginas» (mismo tamaño de página y misma escala en el cajetín) copia la escala, pero cada página pide su comprobación (2 clics y 1 número).
  - Si la página no tiene una segunda cota, la comprobación puede repetir la misma cota en otra zona. Sin comprobación no se mide.
  - Tests: arrastrar un punto recalcula; rehacer la comprobación conserva la cota.
- **Una sola escala por página** (Codex; sustituye el flujo «detalle a 1:20 y vuelta» del bloque CEO):
  - Cambiar la escala de una página con líneas pregunta «¿La escala anterior estaba mal?», con [Recalcular N líneas] y [Cancelar]. Cancelar es la opción por defecto: Enter cancela.
  - Desaparece «solo cambia la escala para lo que mida ahora»: una página nunca queda con dos escalas.
  - Los detalles a otra escala no se miden en la Etapa A (la ayuda lo dice); la escala por zonas sigue en TODOS.
  - El ajuste al cajetín solo se hace si la página declara UNA sola escala, y la comprobación se evalúa contra la escala ya ajustada.
  - Tests: cancelar deja la escala y las líneas intactas; dos escalas en el texto no ajustan.
- **Herramientas deshabilitadas:** van con `aria-disabled` y siguen enfocables. Al pulsarlas, el motivo sale en el aviso y lleva al arreglo:
  - sin calibrar → empieza Calibrar;
  - falta la Altura → foco en el campo;
  - sin partida → abre el selector;
  - forma de medir que no encaja → nombra la herramienta que sí encaja y la selecciona.
  - Mano y Calibrar funcionan sin partida abierta.
- **Superficie en partidas L×A:** la oferta «Medir esta partida por Superficie directa / Usar Rectángulo» aparece en la franja al elegir la herramienta, antes de dibujar; nunca tras cerrar un polígono.
- **Rectángulo por tres clics** (taste): arista con dos clics y anchura con el tercero (proyección perpendicular), para que sirva en estancias giradas. Alternativa: dos esquinas alineadas con la página.
- **Polígono:**
  - Se cierra también con un clic en el primer vértice (anillo de enganche de 8 px).
  - El cruce se comprueba en cada clic: el tramo de vista previa se pinta en `--state-danger`, el clic se rechaza y la pista lo explica. Sustituye «se rechaza al cerrar».
- **Lenguaje visual de la capa:** no depende del tema, y el PDF nunca se invierte.
  - Partida abierta: relleno accent al 15 % y trazo de 2 px con halo blanco de 1 px.
  - Líneas con la misma forma (`formaId`), al seleccionar: contorno punteado accent.
  - Restar: sombreado a 45° e insignia «−». Sin rojo: en DESIGN.md el rojo es error o acción destructiva.
  - Retocada a mano: trazo discontinuo e insignia «✎» en `--state-warn`.
  - Dibujo en curso: trazo de 1,5 px accent con vértices de 6 px.
  - Insignias numeradas de tamaño fijo en pantalla (18 px, Geist Mono 11, fondo del tema con halo), iguales a las del marcador de la línea.
  - Contraste de los gráficos ≥ 3:1, comprobado sobre blanco y sobre línea negra.
- **Marcador de origen en la línea** (sustituye «Detalles de la medida: lo decide diseño» del bloque CEO):
  - Columna estrecha de 28 px en `MedLineRow` (y chip en `MedCards`) con el número de la forma. Es el botón «Ver en plano».
  - Muestra el estado: normal, «✎» retocada (`--state-warn`), o atenuado si el plano no está disponible o se quitó.
  - Su popover lleva plano, revisión, página, escala (ajustada o no), herramienta y fecha, más [Ver en plano] [Volver a medir].
  - La revisión («Rev. A») NO entra en el texto del comentario, para no ensuciar los exportes.
- **Forma seleccionada con Mano en el visor:** popover con comentario, valores, parcial y detalles, y las acciones [Ver línea] [Volver a medir] [Añadir también a…] [Borrar]. Supr equivale a Borrar, con la guarda de certificadas.
  - «Volver a medir»: la forma vieja se atenúa, se arma la misma herramienta y el destino es la partida de la línea (se abre si hace falta). Enter sustituye; Esc restaura.
- **«Añadir también a…», hoja de revisión:**
  - Selección múltiple de partidas (recientes y buscador).
  - Por cada partida, en castellano: interpretación («perímetro», «perímetro × 2,70», «área»), dimensión fija que falte (campo en línea), cantidad resultante con su ud y el cambio de forma si lo hay.
  - Un único botón «Añadir a N partidas», todo o nada: si alguna no es válida, no se crea ninguna y se marca cuál.
  - Se ofrece en el estado CREADA y desde el popover de una forma.
- **Borradores al cambiar de contexto** (sustituye «descarta la forma con aviso» del bloque CEO): el borrador vive en `planoUiStore`, ligado a partida, página, herramienta y escala.
  - Al cambiar de partida: si la herramienta encaja en la nueva, el borrador pasa a ella; si no, queda en espera con «Borrador para <partida>: [Volver] [Descartar]».
  - Al cambiar de página, de plano o de ocupante del hueco lateral, o al redimensionar: el borrador se conserva y al volver se ofrece [Seguir] [Descartar].
  - Tests de las tres rutas.
- **Estados** (la tabla de la revisión de diseño se implementa tal cual):
  - Adjuntando, con progreso por fases (leer, huella, guardar).
  - Abriendo.
  - Pintando: página previa borrosa y «Pintando…». Medir sigue deshabilitado hasta que la página mostrada sea la activa.
  - PDF con contraseña: «Este PDF tiene contraseña: quítala y vuelve a adjuntarlo».
  - PDF dañado.
  - Cuota llena, con el espacio usado si se puede leer.
  - Fallo del visor: «No se pudo cargar el visor. Recarga la página.»
  - Reenlazar con una huella distinta: «Este PDF no es idéntico al original», con [Adjuntar como revisión nueva] [Cancelar].
  - Restauración parcial del .zip: resumen persistente plano a plano, con acciones.
- **Vacíos:**
  - Obra sin planos: zona de soltar en el panel con tres pasos («Adjunta el PDF · Calibra con una cota · Mide») y botón «Adjuntar plano».
  - Partida sin medidas en esta página: «Esta partida tiene medidas en P2 y P3», con enlaces.
- **Páginas y etiquetas:** el selector de página enseña etiqueta, escala y número de medidas. Las etiquetas se editan en el menú ⋯ y al calibrar. Sin etiqueta, el prefijo es «Pág. 3».
- **Atajos del visor** (solo con el foco dentro): M Mano, L Longitud, S Superficie, R Rectángulo, N Recuento, − Restar, C Calibrar, F Ajustar a la ventana, +/− zoom. Van en `ayudaContent` y en los tooltips (no en táctil).
- **Colocar puntos con el teclado:** con una herramienta activa, las flechas mueven el cursor en cruz 1 px de pantalla (×10 con Mayús), Espacio coloca el punto y Enter (con 2 puntos o más) cierra. La tabla de medición, con su marcador, hace de lista accesible de formas.
- **Accesibilidad:**
  - herramientas como `radiogroup` con `aria-checked`, y Restar como conmutador con `aria-pressed`;
  - el lienzo con `role="application"` y `aria-label` («Plano P1, 1:50, herramienta Longitud»);
  - `aria-live` con límite para crear, descartar, calibrar y errores;
  - foco visible con `--ring-accent`;
  - al cerrar el visor, el foco vuelve al botón «Planos».
- **Dimensiones fijas:** se proponen desde el `origen.factor` de la última línea medida de esa partida, así que sobreviven a recargar. Se rotulan con el nombre de la columna y, si hace falta, su sentido: «Anchura (altura del paramento)».
- **Copia de seguridad:**
  - Con planos en la obra, «Copia completa con planos (.zip)» es la acción principal y enseña el tamaño («42 MB · 3 planos»).
  - «Solo presupuesto (.json)» queda como secundaria y dice que no lleva planos.
  - Un .zip con planos no disponibles se rotula «incompleta» y dice cuáles faltan.
  - El aviso de > 50 MB informa, no bloquea.
- **Barra de control mientras se dibuja:** barra flotante [Terminar (n)] [Deshacer punto] [Cancelar], con botones de 44 px que no se solapan. Sirve también con ratón, y Recuento se puede terminar con ella.
- **Tablet** (taste): en la Etapa A la tablet solo ve, como el móvil. Medir con el dedo (un dedo coloca, dos desplazan y hacen zoom, lupa desplazada) pasa a la Etapa B. Sustituye «Tablet: … medir con toques» del §7.
- **Verificación visual:** `/design-review` a 1366, 1024 y 390 px tras implementar la Etapa A.
<!-- /autoplan-accepted:design -->
<!-- autoplan-accepted:dx -->
- **Precedencia:** si choca con los bloques CEO o de diseño, manda este (DX > diseño > CEO); cada punto dice qué sustituye.
- **Especificación canónica antes de codificar** (las dos voces DX): tras el gate, y antes de la primera línea de código, el plan se reescribe en UNA sección «Especificación · Etapa A» con estas cinco partes:
  - los tipos;
  - la tabla herramienta × forma con su magnitud;
  - la tabla de estados y eventos del visor;
  - la tabla de atajos;
  - la tabla de errores y la lista de tests regenerada.
  Lo que ha quedado sustituido pasa al historial, no se anota encima.
- **Primer hito, un sandbox que funciona:**
  - `npm run dev` → `/#sandbox` → «Planos (ejemplo)» carga un PDF de prueba generado (A3 a 1:50, un tabique de 5,00 m y una estancia de 20,00 m²) ya calibrado y comprobado, en un store aislado con dos partidas (m y m²).
  - Medir el tabique da `largo = 5`, `expr` de un tramo, un `origen` completo y un paso de Deshacer.
  - El ejemplo es un test (`PlanosSandbox.test.tsx`).
  - Objetivo: < 3 min desde `npm run dev` hasta la primera línea medida.
- **PDF de prueba sin dependencias:**
  - un generador en `src/test/pdfMinimo.ts` escribe a mano PDFs pequeños (página, `/Rotate`, `/UserUnit`, líneas y textos);
  - los fixtures salen de él dentro del propio test, así que no hay binarios en el repo;
  - los tests de pdf.js real van en un proyecto de Vitest aparte con entorno node y su propio setup (`src/test/setup.ts` toca `Element` y no vale en node), usando `pdfjs-dist/legacy/build/pdf.mjs`.
- **Interfaz exacta del adaptador** (sustituye el esbozo del §3), con un doble completo y tests de contrato comunes para el real y el doble:
  - `abrir(datos: ArrayBuffer): Promise<DocPdf>`. Se queda con el buffer (lo transfiere al worker), así que quien llama no lo reutiliza.
  - `DocPdf.paginas: number`
  - `DocPdf.pagina(n)` → `{ ancho, alto, rotacion, userUnit }`: `n` desde 1, en unidades PDF y sin rotar.
  - `DocPdf.pintar(n, lienzo, region, escala, signal)`
  - `DocPdf.textos(n)` → `[{ texto, caja, tamano }]`
  - `DocPdf.trazados?(n)`: opcional, para la Etapa B.
  - `DocPdf.cerrar()`: idempotente.
  - Las transformaciones pantalla ↔ página son funciones puras, fuera del adaptador.
  - Pensado para `StrictMode`: cada pintado se cancela con su `AbortSignal` y `cerrar` se puede llamar dos veces.
- **Tipos y unidades** (sustituyen donde choquen con §1):
  - `pagina` empieza en 1;
  - `desviacion` es una fracción (0,003);
  - `at` es ISO;
  - `escalaDeclarada` es la N de 1:N;
  - el tamaño del fichero se llama `tamano` (no `bytes`).
  - `OrigenPlano` es una unión discriminada por herramienta:
    - un rectángulo guarda sus 4 esquinas en orden;
    - Recuento guarda los puntos contados.
  - `OrigenPlano` añade:
    - `slots` (las casillas que salen del plano, fijadas al medir, nunca por la forma actual de la partida);
    - `fijas?: Partial<Record<MedDim, number>>` (dimensiones fijas escritas en casillas);
    - `factor?` (solo el multiplicador dentro de `expr`, p. ej. la h de «(tramos)×h»);
    - `at`;
    - `escalaAjustada`.
  - `valoresDesdeOrigen(origen, { mPorUnidad })` escribe solo en `origen.slots`.
  - La tabla del §5 gana una columna con la `magnitud` de cada celda.
  - En la franja las dimensiones se rotulan distinto: «Anchura» (casilla) frente a «Altura (multiplica)».
  - Hay un ejemplo JSON de `OrigenPlano` por herramienta, que también sirve de fixture.
- **Escala de la página, dicho con exactitud** (sustituye «una página nunca queda con dos escalas» del bloque de diseño): cada página tiene UNA calibración activa. Las líneas que se saltó un recálculo (retocadas o certificadas) conservan su escala histórica y se listan como «N líneas con otra escala».
- **Calibrar sin fricción:**
  - Si la página declara UNA escala en el cajetín y la calibración por dos puntos queda a menos del 1 %, eso cuenta como la comprobación (dos fuentes independientes), y queda en `comprobacion.fuente = 'cajetin'`. Sin cajetín, o si no cuadran, se pide la segunda cota.
  - En una partida L×A SIN líneas, elegir Superficie cambia la forma a Sup. directa sin preguntar (mismo paso de Deshacer, aviso con Deshacer). Solo se pregunta si ya hay líneas L×A (precisa el punto de diseño).
- **Escala ajustada reversible:** el chip «1:50 ajustada» ofrece «Usar la calibrada (1:49,7)».
- **Acción por lotes para «Añadir a N partidas»** (sustituye el uso de `medirEnPartida` en bucle):
  - `addPlanoLines({ destinos: [{ chapterId, partidaId, lineas, medForma?, afterId? }], expect })`: todas las partidas en UN `set`, todo o nada.
  - Devuelve un error por destino (partida, campo, motivo).
  - La preparación (`prepararMedida`) es pura y la usan la vista previa y la confirmación.
- **Nombres de las acciones de store** (convención del store: verbo en inglés + nombre de dominio; sustituye los nombres del bloque CEO):
  - `attachPlano`, `removePlano`;
  - `setPlanoPageScale` (devuelve `reason: 'has-lines'` si la página ya tiene líneas medidas: la única vía para cambiar la escala de líneas es `rescalePlanoPage`);
  - `addPlanoLines`, `rescalePlanoPage`, `remeasureLine`, `moveShapeVertices`.
  - Todas reciben un objeto de opciones y un `expect: ExpectLineas` común (ids, valores, ids certificados, `docToken`).
  - Los módulos puros siguen en castellano (`planoGeom`, `planoMedida`, `valoresDesdeOrigen`), como el resto de `core/`.
- **Motivos y textos:** `MedResult.reason` suma `'no-plano' | 'sin-calibrar' | 'no-encaja' | 'certificada' | 'falta-dimension' | 'has-lines'`. `failText` (hoy en `medLineOps.ts`) pasa a un módulo con un texto por motivo, con problema, causa y arreglo. Tests: cada motivo tiene texto.
- **Coordinador de adjuntar** (dos almacenes, sin transacción común):
  - Captura el `docToken`, guarda los bytes y SOLO después publica el metadato.
  - Si cambia la obra a mitad, descarta el resultado (el blob queda para la limpieza).
  - Reintentar es idempotente por `sha256`.
  - Restaurar un .zip escribe primero todos los bytes. Si falta cuota a mitad, la obra se restaura con los planos que entraron y el resto queda «no disponible», dicho en el resumen.
  - Tests: cambio de obra durante adjuntar; cuota a mitad de restaurar.
- **Bytes por huella** (sustituye «clave = `planoId`» del §2):
  - El almacén de planos usa como clave el `sha256`.
  - El mismo PDF adjuntado dos veces (p. ej. para otra escala: se ofrece «Adjuntar otra vez») o compartido entre obras guarda los bytes una sola vez.
  - Reenlazar es buscar por huella, y la limpieza cuenta referencias por huella.
  - Para la limpieza, el historial de Deshacer expone una consulta mínima de las huellas referenciadas (`temporal.ts` es privado).
- **Reenlazar con otra huella:** además de «Adjuntar como revisión nueva», se ofrece «Usar este PDF para este plano», solo si coinciden el número de páginas y el tamaño de cada una. Conserva escalas y líneas, pide una comprobación nueva en cada página calibrada y guarda la huella nueva.
- **Línea retocada:** el popover del marcador ofrece además «Aceptar valores actuales» (reescribe `valores`) y «Desvincular del plano» (quita `origen` y conserva los números).
- **Validación del esquema v6** (sustituye «`isObraData` acepta `planos` ausente o array»):
  - Antes de migrar, se admite v5 sin `planos`.
  - Después de migrar, `planos` es obligatorio y se validan sus elementos:
    - id y huella;
    - páginas > 0;
    - escalas finitas y > 0;
    - que cada `origen` tenga su forma según herramienta, con puntos finitos.
  - Un `origen` inválido se descarta de su línea (se conservan los números) con un aviso en la recuperación. Nunca rompe el render.
  - Tests: v6 con `planos: [null]`, escala 0 u `origen` con NaN.
- **Rollback:**
  - La primera entrega mete el lector y el escritor v6 y el visor detrás de una constante de compilación (`PLANOS_VISOR`). Revertir el visor es apagar la constante, no volver a v5.
  - Antes de la primera migración a v6 de cada obra se guarda una copia del sobre v5 (clave de recuperación).
  - La app vieja distingue «esta obra necesita una versión más nueva» de «obra dañada».
  - Test: el lector v5 ante un fixture v6 no toca los datos guardados.
- **pdf.js:**
  - Versión exacta en `package.json` (sin ^), por la CVE.
  - El worker sale del MISMO paquete instalado, y un test comprueba que la versión de la librería y la del worker coinciden.
  - Tras cada subida de versión: tests de contrato del adaptador y prueba del build publicado con el `base` de Pages (cambios de página rápidos incluidos).
- **Error del visor aislado:**
  - Una frontera de errores local envuelve el chunk de Planos dentro de `LateralAside`.
  - Si falla la carga del chunk: «Hay una versión nueva: recarga», enlazado con `update/`.
  - Si falla el worker o el PDF: el nombre del fichero y la causa.
  - El presupuesto nunca se queda en blanco.
  - Test: un chunk que falla deja el presupuesto usable.
- **Textos de error con acción** (tabla completa en la especificación canónica):
  - PDF dañado: «No se pudo leer "X.pdf" (dañado o no es un PDF). Ábrelo en otro visor y vuelve a guardarlo».
  - Cuota llena: lleva a la lista de planos con tamaños, con «Quitar plano» y «Copia .zip».
  - `stale`: dice qué cambió («La línea 7 se certificó mientras confirmabas»).
  - Conflicto de perfiles en Peso: [Usar HEB 200] [Usar IPE 300].
  - Plano no disponible: nombra el fichero y su tamaño.
  - Rechazos del .zip: con su causa.
  - Los avisos de calibración, «no encaja» y «PDF no idéntico» llevan «?» a su sección de la ayuda.
- **Tope del .zip calculado del contenido** (sustituye el tope fijo de 500 MB): suma de los tamaños declarados de los planos + margen + un límite para `obra.json`. Los nombres desconocidos se siguen rechazando.
- **Borradores** (precisa el bloque de diseño):
  - Ligados al `docToken` y a la revisión de la calibración de su página.
  - Cambiar de obra, recalibrar esa página o Deshacer un cambio de escala los descarta con aviso.
  - Al cambiar de partida se recalcula la interpretación y se piden las dimensiones que pase a necesitar.
  - Tests de las cuatro rutas.
- **Atajos sin choques** (sustituye los puntos «Atajos del visor» y «Colocar puntos con el teclado» del bloque de diseño):
  - Restar = D («descontar»);
  - zoom = + / − y Ctrl + rueda;
  - Espacio mantenido = desplazar;
  - el cursor de teclado se activa al pulsar una flecha y se apaga al mover el ratón. Con él activo, Intro coloca un punto y Mayús+Intro cierra la forma; sin él, Enter cierra la forma como en el ciclo de medida;
  - Esc por estado: DIBUJANDO cancela la forma; NOMBRANDO descarta; CREADA vuelve a EN REPOSO; EN REPOSO cierra el visor.
- **Ayuda:** `ayudaContent` gana las secciones:
  - qué herramienta para qué partida (la tabla, en lenguaje de obra);
  - el ciclo «clic… Enter, Enter»;
  - calibrar y comprobar;
  - una escala por página y cómo medir un detalle (adjuntar otra vez);
  - .zip frente a .json («tus líneas sobreviven aunque se pierda el PDF»);
  - líneas retocadas.
  Todas con ancla para los «?». Tras la Etapa A se añade el paso de primeros pasos en `STEPS`.
- **README:** la lista de características suma «Medir sobre planos PDF».
- **TODOS.md al aprobar:** «Probar con un plano de ejemplo» para el usuario final, en el estado vacío (P3; el sandbox cubre al desarrollador).
<!-- /autoplan-accepted:dx -->
<!-- autoplan-accepted:eng -->
- **Precedencia:** si choca con los bloques DX, de diseño o CEO, manda este (ingeniería > DX > diseño > CEO); cada punto dice qué sustituye. La «Especificación · Etapa A» canónica (tarea X0) lo absorbe todo.
- **Decisiones del usuario en la aprobación (D4 y D5, 2026-09-25)** (sustituyen la lista «Etapa A» de «Etapas» y el punto «Puerta cronometrada» del bloque CEO donde choquen):
  - **Orden (reto 1, respuesta B):**
    - La Etapa 0 lleva también el recordatorio de copia (P1 de TODOS, «Que la obra no pueda perderse»):
      - «Última copia: hace N días» con botón para hacerla;
      - visible fuera del modal de obra cuando `durability` no es `persisted`, o cuando pasan más de 7 días sin copia;
      - la fecha se guarda por obra en la meta del registro (`ObraMeta.ultimaCopia`, ISO) y no entra en `ObraData`;
      - la sella cada descarga iniciada (.json hoy, .zip en A1), con el id de la obra capturado al exportar;
      - el texto dice «Última copia descargada», porque el navegador no confirma que el fichero se guardó; sin fecha, dice «Aún no has hecho ninguna copia»;
      - `saveActiveObra` y `metaOf` FUSIONAN la meta en vez de sustituirla. Hoy la reconstruyen y pierden campos, también `kind`; así `ultimaCopia` y `huellas` sobreviven al autosave;
      - importar un .json o un .zip sobre la obra, crearla y borrarla ponen la fecha a cero; la copia automática previa a importar sella la obra ANTERIOR.
      - Tests:
        - exportar → editar → autosave → recargar conserva la fecha;
        - el aviso sale a los 8 días y no a los 6;
        - importar no hereda la fecha de la obra sustituida.
    - Después, los planos. Los documentos (cuadros de precios nº 1 y nº 2, mediciones sin precios) siguen en TODOS, detrás.
  - **Etapa A partida (reto 2, respuesta A):** A0 → puerta cronometrada → A1 → Etapa B.
    - **A0**, lo mínimo para la puerta:
      - modelo v6 completo, con todos los campos de `origen` (también los que usa A1), para no migrar otra vez;
      - almacén por huella en su módulo propio de IndexedDB (`meta` + `bytes`, el formato definitivo, para no migrarlo en A1), con `update` de `meta` al adjuntar; sin marcas ni borrado de PDF;
      - adjuntar, plano no disponible y reenlace solo por huella idéntica;
      - visor con zoom y páginas;
      - calibrar con dos puntos y comprobación con una segunda cota. En A0 no se lee el cajetín: ni aviso, ni ajuste, ni comprobación por cajetín;
      - las cuatro herramientas con la tabla completa y dimensiones fijas obligatorias. Restar solo si la certificación por líneas con signo (E12) está hecha; si T11 no la aprueba, Restar queda deshabilitado en A0 con su motivo;
      - cursor en cruz y lupa ×4 al colocar puntos de calibración y vértices. Sin ellos la tolerancia no se cumple a zoom de ajustar: un píxel son unos 3 cm a 1:50 en un A3;
      - la cota de calibración mide al menos 300 px en pantalla y la franja enseña la precisión (≈ 2 px / longitud en px). Una escala fuera de 1:1–1:5000, o poco común, pide confirmación: un «cm» tecleado como «m» pasa la segunda cota;
      - comentario con prefijo y texto que se teclea, sin propuesta desde el PDF;
      - `addPlanoLines` a una sola partida y «Volver a medir»;
      - capa de la partida abierta, marcador de origen y «Ver en plano»;
      - quitar plano (con `quitado`);
      - atajos de una tecla, Esc por estado y la defensa de Supr;
      - pestaña de solo lectura, frontera de errores e interruptor en tiempo de ejecución;
      - sandbox «Planos (ejemplo)».
    - **Cambiar la escala de una página con líneas en A0:** `setPlanoPageScale` devuelve `has-lines`. El aviso dice «Esta página ya tiene N líneas medidas con esta escala. Recalcularlas llega más adelante; para medir a otra escala, adjunta el PDF otra vez». La escala no cambia.
    - **Copia en A0:** solo .json. Lleva las líneas con su `origen` y los metadatos de los planos, no los PDF. `ProjectBackup` lo dice («los planos no van en esta copia; si se pierden, vuelve a adjuntar el PDF»).
    - **La puerta:** con las tolerancias y el presupuesto de pintado de este bloque. Sin `docs/spike/03-planos-cronometrado.md` con la meta cumplida no empieza A1.
    - **A1**, tras la puerta y antes de la Etapa B:
      - .zip con planos y restauración por etapas;
      - marcas, índice `huellas` y «Liberar espacio»;
      - revisiones de un plano;
      - recalcular al cambiar la escala (`rescalePlanoPage`) y «Usar esta calibración en otras páginas»;
      - «Añadir también a…» con su hoja (`addPlanoLines` a varias partidas);
      - cajetín: lectura, comparación y, según T9, comprobación y ajuste;
      - comentario propuesto desde el texto del PDF;
      - cursor de teclado con flechas;
      - «Usar este PDF para este plano», según T10;
      - «Aceptar valores actuales» y «Desvincular del plano».
    - Cada pieza se lleva sus tests a su subetapa. A0 se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`), igual que A1.
- **Etapa 0, release de compatibilidad ANTES de cualquier escritor v6** (las dos voces; sustituye «la app vieja distingue…» del bloque DX, que no llega a pestañas ya abiertas):
  - `loadObraData` devuelve un resultado con tipo (`ok | vacia | danada | mas-nueva`). Con «más nueva», el aviso dice «Esta obra se guardó con una versión más nueva de Concreta: recarga la página», sin «Descartar y empezar», y la pestaña queda en solo lectura para esa obra.
  - Traspaso del candado (`claimActive` 'handoff', `persist/sync.ts`): si recargar de disco falla, la pestaña sigue en solo lectura y NO arma el autosave. Hoy lo arma igualmente y la siguiente edición pisaría la obra.
  - `saveObra` no sobrescribe un sobre con `schemaVersion` mayor que el que escribe (el cómo, abajo: resultado `version-conflict` y transacción propia).
  - Tests con un fixture v7: hidratar, conmutar, traspaso y guardar nunca lo borran ni lo pisan.
  - Se publica sola, antes que A0. El tiempo que pase no es la garantía: una pestaña antigua puede seguir abierta semanas (el aviso de versión nueva admite «Más tarde»). La garantía es el espacio de claves propio de v6 (abajo). En el mismo paso previo: el hueco lateral pasa a un solo campo `lateral: 'ref' | 'asistente' | 'planos' | null` con `LateralAside`, con los tests actuales en verde.
  - Traspaso, con exactitud (segunda pasada): `isOwner` y `readonly` no cambian hasta que la recarga devuelve `ok`. Hoy se ponen antes de recargar (`sync.ts:173-178`) y el autosave ya estaba armado desde `hydrate`, así que no basta con «no armarlo».
  - `saveObra` ante una versión mayor en disco da un resultado terminal `version-conflict`:
    - la entrada sale de `pending` (hoy se reintentaría para siempre y bloquearía el guardado de las demás obras);
    - el índice no se toca;
    - la pestaña pasa a solo lectura con el aviso de «más nueva».
    - Comparar y escribir va en una transacción propia (el `update` de idb-keyval siempre hace `put`), contra una clave pequeña de versión por obra, sin leer el sobre entero en cada guardado.
  - `loadObraData` mira `schemaVersion > SCHEMA_VERSION` ANTES de `isObraData`, así una v7 con otra forma nunca sale como «dañada». Lo mismo en `activateFirstLoadable`, `discardRecovery` y `features/referencia/obraSource.ts`, con tests en todas.
  - Guardados fallidos, ya en la Etapa 0:
    - importar un .json comprueba el `false` de `flushPending` y, si falla, lo dice y deja recuperar la obra anterior (hoy cierra como si hubiera ido bien, `ProjectBackup.tsx:78`);
    - «Actualizar» no recarga si el volcado devuelve `false` o no termina a tiempo (`reloadToLatest`, `update/appVersion.ts`), y lo dice.
    - Tests con `false` y con escritura lenta.
- **Espacio de claves propio de v6** (segunda pasada, las dos voces; sustituye la copia v5 bajo `concreta.recovery.v5.*` de la primera pasada y la copia v5 del bloque DX):
  - Las obras v6 y su índice viven bajo un prefijo que el código anterior no lista ni escribe: `concreta6.obra.<id>` y `concreta6.obras.index`.
  - La primera vez que se abre una obra v5, se migra a la clave nueva. La clave v5 (`concreta.obra.<id>`) se queda tal cual y hace de copia v5.
  - Una pestaña antigua solo puede escribir en la clave v5: nunca pisa la v6. Si al cargar la clave v5 tiene un `savedAt` posterior a la migración, el aviso dice «Una versión antigua de Concreta guardó cambios en esta obra después de actualizarla», con [Abrir esos cambios como obra aparte] [Ignorar].
  - La clave v5 se borra 30 días después de la migración si no ha cambiado desde entonces.
  - `reconcile`, `obraKeys` y la migración legacy trabajan con el prefijo nuevo; el prefijo v5 solo se lee para migrar.
  - Tests:
    - pestaña antigua con la obra en memoria + traspaso → la v6 queda intacta y sale el aviso;
    - una v5 se migra una sola vez;
    - limpieza a los 30 días.
- **Validar v6 sin destruir** (las dos voces; sustituye «planos obligatorio y se validan sus elementos» del bloque DX y la limpieza de la primera pasada):
  - Tras migrar, `isObraData` solo exige `Array.isArray(planos)`. Una obra nunca va a recuperación por un plano mal formado.
  - Un `PlanoMeta`, una escala o un `origen` que no se entiende NO se borra:
    - se conserva tal cual, como dato opaco, y no se pinta;
    - la línea sigue con sus números;
    - se escribe de vuelta sin cambios.
  - Solo lo que rompería el render se aparta a un campo `_ilegible` con su valor crudo, y se avisa. Limpiar nunca provoca un guardado por sí solo.
  - Regla de versión: todo cambio que amplíe las formas o los valores válidos que se guardan sube `SCHEMA_VERSION` (una herramienta nueva, un campo con significado nuevo), así el código anterior pasa a solo lectura por la Etapa 0 en vez de reinterpretar. Por eso el modelo v6 trae desde A0 todos los campos de A1.
  - Topes al importar un .json: puntos por `origen`, número de planos, de páginas y de líneas con `origen`. Un fichero manipulado no puede congelar el validador ni la capa.
  - Claves de página: `escalas` y `etiquetas` se validan como enteros de 1 a `paginas`, porque en JSON llegan como texto.
  - Tests:
    - `planos: [null]`, escala 0 y `origen` con NaN cargan la obra;
    - un lector A0 ante un fixture A1 conserva lo que no entiende y lo devuelve igual al guardar;
    - claves de página de ida y vuelta por .json.
- **Almacén de PDF sin borrado automático en la Etapa A** (las dos voces; sustituye la limpieza de huérfanos del §2 y del bloque CEO):
  - Se marcan los PDF sin referencia (`sinReferenciaDesde`), pero no se borran solos.
  - «Liberar espacio», en la lista de planos, enseña los PDF sin referencia en ninguna obra con su tamaño y los borra tras confirmar. Ese borrado:
    - toma un Web Lock `concreta.planos` si existe;
    - borra dentro de una transacción de lectura y escritura que relee el registro y solo borra si la marca no cambió;
    - excluye las huellas del estado en memoria y de las dos pilas del historial de esta pestaña.
  - Adjuntar, reenlazar y restaurar hacen siempre un `update` que quita la marca y sella `tocadoEn`, aunque los bytes ya existan.
  - Las referencias salen de un índice nuevo, `ObraMeta.huellas: string[]`, junto con `huellasDe`: el `savedAt` del sobre del que salen. Lo escriben `saveActiveObra` y `reconcile` cuando registra una obra.
  - Un índice que falta, o que no coincide con el `savedAt` del sobre, vale «desconocido», nunca `[]`: se lee el sobre, en crudo si hace falta. Un sobre ilegible que no se puede recorrer detiene la limpieza con su motivo («limpieza detenida»).
  - Nunca se ofrece borrar un PDF con `tocadoEn` de menos de 24 h.
  - Adjuntar, reenlazar y restaurar toman el Web Lock `concreta.planos` en modo compartido hasta que su guardado ha aterrizado; «Liberar espacio» lo toma en exclusiva.
  - Sin Web Locks (http en red local), «Liberar espacio» pregunta antes a las demás pestañas por `BroadcastChannel` qué huellas tienen en memoria y en su historial, y espera su respuesta 500 ms.
  - El almacén es un módulo propio de IndexedDB (`concreta-planos`, con versión explícita) y dos almacenes:
    - `meta`, por huella: `tamano`, `tipo`, `tocadoEn`, `sinReferenciaDesde`;
    - `bytes`, por huella, escritos una sola vez.
  - Las marcas solo tocan `meta`; borrar es una transacción sobre los dos. idb-keyval no sirve aquí: su `update` reescribe el valor entero (los bytes) y solo admite un almacén por base de datos.
  - Un plano quitado sigue contando como referencia mientras su alta esté en el historial de Deshacer de esta pestaña. «Liberar espacio» lo lista aparte con «Liberar ya: Deshacer ya no recuperará la capa de N líneas», así el espacio se recupera en el acto si el usuario lo pide.
  - El borrado automático entre pestañas queda en TODOS (P3).
- **Plano quitado sin perder la procedencia** (las dos voces): `removePlano` deja el `PlanoMeta` con `quitado: at` (fuera de las listas y del recuento de referencias de «Liberar espacio»). Volver a adjuntar el mismo PDF lo revive con sus escalas y sus líneas. Cada `origen` guarda además `huella` (el sha256 del PDF con el que se midió).
- **Revisión de calibración** (las dos voces; sustituye la comparación de `mPorUnidad` como número): cada `Escala` lleva `rev` (id nuevo en cada calibración) y cada `origen` guarda `calRev`. Las candidatas a recalcular son las líneas con `calRev` distinto. Todo camino que cambia la escala de una página con líneas pasa por `rescalePlanoPage`:
  - «Usar la calibrada»;
  - «Usar esta calibración en otras páginas»;
  - «Usar este PDF para este plano».
- **`expect` por operación** (Codex; precisa `ExpectLineas` del bloque DX): además de ids, valores, certificadas y `docToken`, cada acción compara `calRev` de la página, `huella` del plano y `medForma` y unidad del destino. Dentro del `set`, la acción vuelve a preparar contra el estado vivo con la misma función pura (`prepararMedida`) y solo aplica si el resultado coincide con lo que el usuario revisó; si no, `reason: 'stale'` con el motivo. Test: cambiar la calibración o la forma del destino con la hoja «Añadir a N partidas» abierta.
- **Una forma, una geometría** (las dos voces): `formaId` identifica una geometría inmutable. «Volver a medir» da un `formaId` nuevo a la línea. En la Etapa B, `moveShapeVertices` con «Aplicar también» mantiene el `formaId` solo en las líneas que actualiza; las que se salta pasan a un `formaId` propio. Invariante con test: misma `formaId` ⇒ mismos `puntos`.
- **Valores aceptados a mano** (Codex; precisa «Aceptar valores actuales» del bloque DX): aceptar marca `origen.aceptada = true`, conserva los valores que salieron de la geometría y excluye la línea de los recálculos automáticos (se lista con las retocadas). Solo «Volver a medir» devuelve la autoridad a la geometría.
- **Primera medida en una partida con cantidad fija** (Codex): la vista previa de NOMBRANDO y el aviso de CREADA enseñan «fija 100 → medida 5» (`resumenCantidad` y `cambioCantidad`, como el pegado). La línea entra con Deshacer y el cambio queda dicho. Convertir la cantidad fija en línea sigue en TODOS (P3, ya existe).
- **Copia .zip segura** (las dos voces; sustituye «tope calculado del contenido» del bloque DX):
  - Topes absolutos:
    - 2 GB descomprimidos en total;
    - 500 MB por entrada;
    - 500 entradas;
    - 50 MB para `obra.json`.
  - Los bytes se cuentan al descomprimir en flujo (`Unzip` de fflate) y se aborta al pasarse; nunca se confía en los tamaños declarados.
  - Se rechazan los nombres duplicados y los desconocidos.
  - La clave de cada PDF es la huella CALCULADA, no la declarada.
  - Los PDF se guardan sin comprimir (nivel 0) y la exportación se escribe por partes en un Blob.
  - Los tests del .zip van en el proyecto de Vitest en node.
  - Un solo contrato para exportar e importar (segunda pasada):
    - adjuntar rechaza un PDF de más de 500 MB y avisa si la obra pasaría de los topes del .zip;
    - exportar comprueba los mismos topes antes de empezar. Si no caben, lo dice y ofrece «.json y los PDF por separado», en vez de rotular «completa» una copia que no se podría restaurar.
    - Tests de cada tope en los dos sentidos.
- **Restaurar un .zip por etapas** (Codex; precisa el coordinador del bloque DX y sustituye su «la obra se restaura con los planos que entraron»):
  - escribe los PDF uno a uno y anota cuáles son nuevos en este equipo;
  - si la cuota se acaba, deja de escribir PDF y retira los nuevos que hagan falta para que quepa la obra;
  - carga la obra y espera a que `flushPending()` devuelva `true` antes de anunciar nada;
  - con la obra guardada, el resumen dice qué planos quedaron «no disponibles» (restauración parcial del bloque de diseño);
  - si la obra no se puede guardar ni así, retira todos los PDF nuevos de esta restauración, vuelve a cargar la obra anterior y lo dice. Nunca se anuncia un éxito que solo existe en memoria.
  - La copia previa al importar es un .zip si la obra actual tiene planos.
  - Cada restauración lleva un token (segunda pasada):
    - los PDF que escribe se anotan con él en `meta`;
    - retirarlos solo borra los que siguen siendo suyos y no tienen referencia viva, con la misma comprobación que «Liberar espacio». Si otra pestaña adoptó esa huella entretanto, se quedan.
  - La restauración va en la cola de operaciones de obra (`serializeOp`) y cancela los guardados pendientes de la obra importada antes de volver a la anterior. «La obra anterior» sale de una instantánea en memoria tomada antes de `loadObra`, no del disco.
  - Arreglo del mismo fallo que ya existe en `ProjectBackup.tsx`: hoy ignora el `false` de `flushPending` al importar un .json.
- **Adaptador de pdf.js** (las dos voces; precisa la interfaz del bloque DX):
  - `pagina(n)` devuelve `{ vista: [x0, y0, x1, y1], rotacion, userUnit }`: la caja visible en el espacio de usuario del PDF, con la y hacia arriba. Las transformaciones pantalla ↔ página y los textos usan esa misma convención, y `region` y `escala` de `pintar` se definen en ella.
  - `abrir(datos, { signal })` se puede cancelar; cada resultado lleva un número de generación y un documento que llega tarde se cierra.
  - Los bytes se releen de IndexedDB en cada apertura, porque pdf.js se queda con el buffer.
  - Fixtures: origen de caja distinto de 0, CropBox, las cuatro rotaciones y rotación con `UserUnit`.
  - `trazados?` queda en la interfaz, pero no se implementa en la Etapa A.
- **pdf.js en el build:**
  - `cMapUrl`, `standardFontDataUrl` y `wasmUrl` (pdf.js 5) salen en `dist` y se resuelven con el `base` de Pages; sin ellos, el texto CID del cajetín sale mal y los escaneos, en blanco.
  - Se usa el build `legacy`, o el README dice el navegador mínimo; se prueba en Safari de iPad.
  - La rueda se escucha con un listener nativo `{ passive: false }` y el lienzo lleva `touch-action: none`.
  - Los lienzos se liberan (ancho y alto a 0) al cambiar de página.
  - Se juntan los textos contiguos y se lee también «ESCALA 1/N» y «E 1/N».
  - El hash de la huella se calcula en un worker.
  - Los assets se copian a `dist` con un plugin propio en `vite.config.ts`, como el `versionFile` que ya emite `version.json`: sin dependencia nueva.
  - Con el build `legacy`, el worker también es `legacy/build/pdf.worker.min.mjs`, y el test de versiones comprueba además la ruta.
  - `enableXfa: false` explícito.
  - El texto sacado del PDF (propuestas de comentario, en A1) solo entra como nodo de texto de React o `<text>` de SVG, nunca con `innerHTML`, y al .bc3 por el `field()` que ya sanea.
- **Pestaña de solo lectura:** el visor solo deja ver; adjuntar, calibrar y medir salen deshabilitados con el motivo, igual que el asistente (`ai/executor.ts`).
- **Interruptor en tiempo de ejecución** (sustituye la constante de compilación `PLANOS_VISOR` del bloque DX):
  - Hasta superar la puerta, el visor se activa con `?planos=1` o con `localStorage['concreta.planos']`, y en producción va apagado por defecto. Así se hace el dogfood en la app publicada y apagarlo es inmediato.
  - El lector y el escritor v6 NO van detrás del interruptor.
- **Teclado, defensa en profundidad** (precisa «Teclado y clics del visor»):
  - `isInteractiveTarget` reconoce `[data-planos-viewer]`, así que Supr nunca borra la partida aunque falle un `stopPropagation`.
  - `role="dialog"` solo para modales de verdad: `hasBlockingOverlay` apagaría Ctrl+Z y Ctrl+K con los popovers.
  - Enter con `e.isComposing` no crea la línea.
- **Ciclo de medida como reductor puro:** `core/planoCiclo.ts` (`(estado, evento) → { estado, efectos }`). La tabla de estados y eventos de la especificación es su tabla de tests; el visor solo la conecta.
- **Restar se ve por el signo:** el sombreado sale del signo de `uds`, no de `origen.resta`, así que la capa nunca contradice a la línea.
- **Acciones que faltaban**, con `structural()`, `fromBase = false` y `pesoDesdeComentario` como `insertMedLines`: `renamePlano`, `setPlanoPageLabel`, `setPlanoScaleAdjusted`, `relinkPlano` y `attachPlanoRevision`.
- **Números de las casillas:**
  - Un solo formateador de cifras para `expr` en `core/` (sin separador de miles ni notación exponencial), con tests de referencia.
  - El .bc3 exporta las dimensiones con hasta 4 decimales (`num(v, 4)` ya quita los ceros de cola, así que las líneas de ≤ 3 decimales salen idénticas); test de ida y vuelta.
- **Contradicciones cerradas** (sustituyen las versiones anteriores):
  - Destino: «Midiendo en ▾» abre la partida elegida (`openPartidaId` sigue siendo la única fuente).
  - Dimensiones fijas: viven en `planoUiStore` por partida, se proponen desde el `origen.fijas` o `origen.factor` de su última línea medida, y `origen.fijas` registra lo escrito.
  - La rueda desplaza y Ctrl + rueda hace zoom.
  - Los PDF se guardan por huella y el tamaño se llama `tamano`.
  - Adjuntar un PDF cuya huella ya está en la obra: «Ya está adjunto como Planta 1», con [Abrirlo] [Adjuntar otra vez (para otra escala)]. El bloque CEO («no lo duplica») y el DX («Adjuntar otra vez») quedan así: nunca se duplica sin que se pida, y los bytes se guardan una sola vez.
- **Calibración:** si se puede, la comprobación va sobre una cota a más de 45° de la de calibrar. La franja lo sugiere y la lupa lo facilita.
- **El resumen del recálculo avisa** si alguna partida queda por debajo de lo ya certificado («C2 certificó 120 m²; la medición pasa a 112 m²»).
- **Marcador fuera de la rejilla:** la columna de 28 px no cuenta como celda en `editGridNav` ni en `useMedGridTab`, ni en el mapeo TSV de copiar y cortar. Se amplían los tests de Tab y de Excel.
- **La puerta, medible** (las dos voces en la segunda pasada; sustituye las tolerancias de la primera):
  - Los valores de referencia se calculan antes de medir, a partir de las cotas del plano, y se escriben en `docs/spike/03-planos-cronometrado.md`.
  - Tolerancias por magnitud:
    - longitudes: |Δ| ≤ 2 cm + 0,5 %;
    - superficies: |Δ| ≤ 1 %;
    - recuentos: exactos;
    - cada total de partida: ≤ 0,5 %.
  - Cronómetro: desde abrir el PDF hasta crear la última línea, con la calibración dentro y la caché del navegador vacía en la primera página.
  - Orden cruzado, para quitar el efecto aprendizaje: una partida se mide primero a mano y la otra primero con Concreta.
  - Presupuesto de pintado con un plano CAD real pesado, en el portátil de dogfood (mientras llega la imagen nítida, se enseña la escalada):
    - primera página visible: < 2 s;
    - cambio de página: < 1 s;
    - zoom nítido: < 1,5 s.
- **Tests que añade ingeniería** (además de los ya previstos; lista completa en el registro de la fase 3):
  - `src/persist/sync.test.ts`: fixture v7 por hidratar, conmutar y traspaso, sin borrar ni pisar; traspaso fallido → solo lectura sin autosave.
  - `src/persist/persist.test.ts`: `saveObra` sobre un sobre v7 no escribe.
  - `src/persist/registry.test.ts`: las claves v5 (`concreta.obra.*`) no aparecen en el `reconcile` de v6; `huellas` y `huellasDe` en `ObraMeta`.
  - `src/persist/planos.test.ts`: `update` quita la marca; «Liberar espacio» relee y respeta una marca cambiada; sobre ilegible → recorrido crudo o «limpieza detenida»; «Liberar ya» de un plano quitado.
  - `src/store/schema.test.ts`: los `planos` inválidos se conservan como datos opacos y la obra carga.
  - `src/core/planoGeom.test.ts`: área invariante a giro y traslación; autocruces (colineal, vértice tocante, tramo de cierre); Mayús con `/Rotate 90`; formateador de `expr`.
  - `src/core/planoCiclo.test.ts`: la tabla de estados y eventos.
  - `src/store/planos.test.ts`: `expect` por operación (`calRev`, `medForma`); `removePlano` con `quitado` y revivir; `remeasureLine` con `formaId` nuevo; invariante `formaId` ⇒ `puntos`; `aceptada` fuera del recálculo; aviso de certificado > medición; «fija → medida».
  - `src/core/bc3export.test.ts`: 4 decimales de ida y vuelta; ≤ 3 decimales idénticos.
  - `src/persist/transfer.node.test.ts`: .zip con tamaños falsos, duplicados y tope real; restauración con cuota llena.
  - `src/features/obra/ProjectBackup.test.tsx`: `flushPending` falso → error visible.
  - `src/features/planos/pdfAdapter.node.test.ts`: caja con origen ≠ 0, CropBox, cuatro rotaciones, rotación con `UserUnit`; abrir A → B → llega A y se cierra.
  - `src/hooks/useAppHotkeys.test.tsx`: Supr dentro de `[data-planos-viewer]` no borra la partida.
  - `src/features/presupuesto/*`: Tab y TSV con la columna del marcador; Enter con `isComposing`.
  - Integración con el doble: pestaña de solo lectura (el visor solo ve); adjuntar mientras otra pestaña libera espacio; Deshacer tras medir y volver a medir.
- **Dónde nace un `formaId`** (segunda pasada): en las llamadas, nunca dentro de `lineaParaDestino`, que es el helper común de las cuatro rutas.
  - Duplicar y pegar dan uno nuevo.
  - «Añadir también a…» reutiliza el de la forma.
  - Mover a otra partida lo conserva.
- **Pegar en otra forma de medir:** si `compatibilidad()` dice que las casillas cambian de significado o de unidad, la línea pegada pierde `origen` (conserva los números). Así un recálculo nunca escribe una magnitud geométrica donde la unidad ya es otra.
- **X0 es una puerta dura:** la especificación canónica incluye el contrato de lo que se guarda y fixtures JSON de referencia por herramienta. El lector y el escritor v6 entran en UN commit, después de X0, porque cada push a `main` publica. El contrato cubre:
  - `PlanoMeta` con `quitado`, `sustituye` y `revision`;
  - `Escala` con `rev` y `comprobacion.fuente`;
  - `OrigenPlano` con todos los campos de A1.
- **Tests de la segunda pasada:**
  - pestaña antigua + traspaso con la obra ya en el espacio v6: la v6 queda intacta y sale el aviso de cambios antiguos;
  - un `saveObra` rechazado sale de `pending`, y otra obra se guarda después;
  - una v7 con otra forma sale como «más nueva» en `activateFirstLoadable`, en `discardRecovery` y en la fuente de Referencia;
  - importar un .json y «Actualizar», con el volcado en `false` o lento;
  - `ultimaCopia` y `huellas` sobreviven al autosave;
  - una meta sin `huellas` hace leer el sobre;
  - adjuntar en B y pulsar «Liberar espacio» en A antes de que B guarde conserva el PDF;
  - marcar no reescribe `bytes`;
  - una restauración que falla mientras otra pestaña adopta la misma huella;
  - los topes del .zip al exportar y al importar;
  - la precisión y la plausibilidad de la calibración;
  - el `formaId` al duplicar, pegar, mover y con «Añadir también a…»;
  - pegar en otra forma quita `origen`;
  - Restar deshabilitado sin E12.
- **TODOS.md:** el borrado automático de PDF entre pestañas (P3), además de los aplazados de las fases anteriores.
<!-- /autoplan-accepted:eng -->

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"62c51d928026e3ae2bd50bcf9d889eea20a2b53b8af606d470157463e9527261","replacements":[{"oldText":"  - `escalas: Record<number, Escala>` por página, con `Escala { mPorUnidad, ref: { a,\n    b, metros }, at }` (los puntos en unidades PDF).","newText":"  - `escalas: Record<number, Escala>` por página, con `Escala { mPorUnidad, ref: { a,\n    b, metros }, comprobacion?: { metros, medidos, desviacion }, escalaDeclarada?,\n    ajustada?, at }`. Se calibra siempre con dos puntos (`ref`, en unidades PDF).\n    `escalaDeclarada` es la del cajetín, leída del texto, y solo sirve de comprobación;\n    `ajustada` indica que `mPorUnidad` se llevó a la declarada exacta por quedar a menos\n    del 1 %."},{"oldText":"- `MedLine.origen?: OrigenPlano` (opcional, no necesita migración):\n  `{ planoId, pagina, herramienta: 'longitud' | 'superficie' | 'rectangulo' |\n  'recuento', puntos: [x, y][], mPorUnidad, slot, valor, resta? }`. Los puntos van en\n  el espacio de la página SIN rotar (independiente del zoom y de `/Rotate`);\n  `mPorUnidad` es la escala congelada al medir.","newText":"- `MedLine.origen?: OrigenPlano` (opcional, no necesita migración):\n  `{ planoId, pagina, formaId, herramienta: 'longitud' | 'superficie' | 'rectangulo' |\n  'recuento', puntos: [x, y][], mPorUnidad, magnitud: 'recuento' | 'longitud' |\n  'area' | 'perimetro' | 'lados' | 'longitudPorFactor', factor?, valores:\n  Partial<Record<MedDim, number>>, resta? }`.\n  - `formaId` identifica la FORMA dibujada: las líneas creadas desde la misma forma\n    («Añadir también a…») lo comparten; duplicar o pegar una línea crea una copia\n    independiente con `formaId` nuevo. Es la única identidad de «misma forma»: nunca se\n    deduce comparando coordenadas.\n  - Los puntos van en el espacio de la página SIN rotar (independiente del zoom y de\n    `/Rotate`); en una imagen, en píxeles de la imagen ya orientada.\n  - `mPorUnidad` es la escala congelada al medir (1 en Recuento).\n  - `magnitud` dice qué se sacó de la geometría: el área o el perímetro de un mismo\n    polígono, los dos lados de un rectángulo, o L × h. `factor` guarda la dimensión\n    fija que multiplica (h).\n  - `valores` guarda lo escrito en CADA casilla que salió del plano (un rectángulo en\n    Superficie escribe `largo` y `ancho`).\n  - Una sola función pura, `valoresDesdeOrigen(origen, mPorUnidad)`, da valores y `expr`\n    al crear, recalcular, editar vértices y copiar a otra partida.\n  - «Retocada a mano» = alguna casilla de `valores` difiere de la de la línea.\n  - `uds` se escribe siempre: 1, o -1 con Restar; en Recuento, N o -N. Solo en Recuento\n    entra en `valores`: fuera de él, recalcular, «Volver a medir» y editar vértices no lo\n    tocan, así que un `uds = 2` tecleado para dos tabiques iguales se conserva.\n  - Redondeo: un valor sin `expr` es `round2`; uno con `expr` es exactamente\n    `evalEsExpr(expr)` sobre operandos `round2` (tramos, lados, h); el área de un\n    polígono es `round2` del lazo.\n  - En Superficie y Rectángulo, `longitud` y `longitudPorFactor` usan el perímetro\n    CERRADO."},{"oldText":"| Herramienta | Unidades | Longitud | Superficie (L×A) | Sup. directa | Volumen | Sup. × espesor | Peso |\n|---|---|---|---|---|---|---|---|\n| Recuento (N) | uds = N | uds = N | uds = N | uds = N | uds = N | uds = N | uds = N |\n| Longitud (L) | no encaja | largo = L | largo = L | no encaja | largo = L | no encaja | largo = L |\n| Superficie (A) | no encaja | no encaja | ofrece pasar a Sup. directa | largo = A | no encaja | largo = A | no encaja |\n| Rectángulo (L, A) | no encaja | no encaja | largo = L, ancho = A | largo = «L×A» | largo = L, ancho = A | largo = «L×A» | no encaja |\n\n- «No encaja»: la herramienta sale deshabilitada con el motivo («Esta partida se mide\n  por Unidades: usa Recuento»).","newText":"| Herramienta | Unidades | Longitud | Superficie (L×A) | Sup. directa | Volumen | Sup. × espesor | Peso |\n|---|---|---|---|---|---|---|---|\n| Recuento (N) | uds = N | uds = N; Longitud fija | uds = N; Longitud y Anchura fijas | uds = N; Superficie fija | uds = N; L, A y Altura fijas | uds = N; Superficie y Espesor fijos | uds = N; Longitud y kg/m fijos |\n| Longitud (L) | no encaja | largo = L | largo = L; Anchura fija | largo = «(tramos)×h»; Altura fija | largo = L; Anchura y Altura fijas | largo = «(tramos)×h»; Altura y Espesor fijos | largo = L; kg/m |\n| Superficie (polígono) | no encaja | largo = perímetro | pasa a Sup. directa (abajo) | largo = área | no encaja | largo = área; Espesor fijo | no encaja |\n| Rectángulo (L, A) | no encaja | largo = perímetro | largo = L, ancho = A | largo = «L×A» | largo = L, ancho = A; Altura fija | largo = «L×A»; Espesor fijo | no encaja |\n\n- **Toda casilla visible se rellena o no se mide.** Una casilla vacía vale ×1\n  (`core/medicion.ts`), así que cada casilla visible que el plano no da sale de una\n  dimensión fija OBLIGATORIA. Si falta, la herramienta queda deshabilitada con el motivo\n  («Indica la Altura fija para medir paramentos»). Cuentan solo las columnas de la\n  forma (`medFormaDef(forma).cols`): una casilla fuera de la forma, visible por otras\n  líneas, queda vacía en la línea medida.\n- «No encaja»: la herramienta sale deshabilitada con el motivo («Esta partida se mide\n  por Unidades: usa Recuento»).\n- **Superficie en una partida L×A** (la forma por defecto del m²): el visor ofrece\n  «Medir esta partida por Superficie directa». Aceptar cambia `medForma` a `'area'` en el\n  MISMO paso de Deshacer que la primera medida, con aviso. Las líneas L×A que ya\n  hubiera siguen igual (su Anchura sale como columna fuera de la forma). Si se rechaza,\n  la herramienta queda deshabilitada y se sugiere Rectángulo.\n- **Peso:** el kg/m sale del campo fijo kg/m (admite un perfil, «IPE 300», con\n  `leerCelda`) o del perfil que nombre el comentario. El comentario se pide ANTES de\n  crear la línea; Enter no crea la línea mientras el kg/m no se resuelva. Si el campo\n  fijo y el comentario nombran perfiles distintos, Enter se bloquea con el motivo («El\n  comentario dice HEB 200 y el kg/m fijo es IPE 300»). Un kg/m fijo numérico se escribe\n  sin `expr`, así que `pesoDesdeComentario` no lo pisa."},{"oldText":"- **Restar** (huecos): conmutador que crea la línea con uds = -1.","newText":"- **Restar** (huecos): conmutador que crea la línea con uds = -1 (en Recuento, uds = -N).\n  Su forma sale en rojo discontinuo en la capa. Duplicar la línea o copiar la forma a\n  otra partida conserva el signo."},{"oldText":"- **Etapa A**: modelo v6, almacén, visor con zoom y páginas, calibración, las cuatro\n  herramientas, dimensiones fijas, restar, línea con `origen`, capa de la partida\n  abierta, «Ver en plano», plano no disponible.\n- **Etapa B** (si el gate la mantiene): capa de toda la obra con leyenda y filtro,\n  sugerencias desde el texto del PDF (nombre de la estancia dentro del polígono),\n  editar vértices, exportar obra + planos en .zip.","newText":"- **Etapa A** (la que se usa en una obra real):\n  - modelo v6 con `origen` completo (`formaId`) y `valoresDesdeOrigen`;\n  - almacén aparte, adjuntar, revisión de un plano, quitar, plano no disponible y\n    reenlace por `sha256`;\n  - copia .zip de la obra con planos, y su restauración;\n  - visor con zoom y páginas;\n  - calibración por dos puntos con cota de comprobación, y escala del cajetín como\n    comprobación;\n  - las cuatro herramientas con la tabla completa, dimensiones fijas obligatorias y\n    restar;\n  - comentario con prefijo y texto propuesto;\n  - «Añadir también a…» (la misma forma en otras partidas);\n  - línea con `origen`, capa de la partida abierta y «Ver en plano»;\n  - recalcular al recalibrar.\n- La Etapa A se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`).\n- **Puerta antes de la Etapa B:** dogfood cronometrado, como el spike §0.5\n  (`docs/spike/02-dogfood-cronometrado.md`). En una obra real se miden las dos partidas\n  del objetivo (12 tabiques, 8 estancias de solado) como hoy (visor de PDF y tecleo) y\n  con Concreta. Meta: al menos el doble de rápido y ninguna diferencia con las cotas\n  del plano por encima de la tolerancia. El resultado se escribe en\n  `docs/spike/03-planos-cronometrado.md`.\n- **Etapa B** (solo si se supera la puerta), en este orden:\n  - imán a la geometría vectorial (los trazados ya salen del adaptador);\n  - capa de toda la obra con leyenda y filtro;\n  - editar vértices;\n  - PNG/JPG como plano."},{"oldText":"Nuevos: `core/planoGeom.ts`, `core/planoMedida.ts`, `persist/planos.ts`,","newText":"Nuevos: `core/planoGeom.ts`, `core/planoMedida.ts`, `core/planoTexto.ts` (escala y\nnombres de estancia desde el texto del PDF), `persist/planos.ts`,"},{"oldText":"`layout/ayudaContent.ts`, `package.json`.","newText":"`layout/ayudaContent.ts`, `package.json`, `core/medPaste.ts` (`origen` en\n`lineaParaDestino`), `store/medLineOps.ts`, `features/presupuesto/MedPasteReview.tsx`\n(guarda de certificadas al volver a medir y al borrar con Supr), `persist/sync.ts` (obra de referencia),\n`persist/transfer.ts` (.zip), `hooks/useAppHotkeys.ts` (Esc mientras se dibuja)."},{"oldText":"- Si luego se teclea otro valor en la casilla medida (valor ≠ `origen.valor`), la línea\n  se marca «retocada a mano» y su forma en el plano sale discontinua. «Volver a medir»\n  sustituye valor y origen.","newText":"- Si luego se teclea otro valor en una casilla medida (alguna casilla ≠ su\n  `origen.valores`), la línea se marca «retocada a mano» y su forma en el plano sale\n  discontinua. «Volver a medir» sustituye valores, `expr` y origen, solo con la MISMA\n  herramienta y el mismo estado de Restar (para cambiarlos, se borra la línea y se mide\n  de nuevo), así que nunca deja un `uds` de Recuento multiplicando una longitud."},{"oldText":"  Clic en una forma → foco en su línea. En la línea, «Ver en plano» → abre el visor en","newText":"  Clic en una forma (con Mano) → foco en su línea. En la línea, «Ver en plano» → abre el visor en"},{"oldText":"- **Dimensiones fijas**: las casillas visibles que el plano no da (Anchura, Altura,\n  Espesor) aparecen como campos en la barra del visor y se aplican a cada medida\n  (altura de planta 2,70; espesor 0,15). En Peso, el kg/m sale del comentario\n  (`pesoDesdeComentario`).","newText":"- **Dimensiones fijas**: las casillas de la forma que el plano no da (Anchura, Altura,\n  Espesor, kg/m) aparecen como campos en la franja «Midiendo en» y se aplican a cada\n  medida (altura de planta 2,70; espesor 0,15). Se guardan POR PARTIDA en\n  `planoUiStore`, así que cambiar de partida no arrastra la altura de Pintura a\n  Alicatado, y la franja las enseña siempre."},{"oldText":"- `persist/planos.ts`: un almacén `idb-keyval` propio (`createStore('concreta-planos',\n  'pdf')`), clave = `planoId`, valor `{ sha256, bytes, blob, savedAt }`. Se escribe una\n  vez al adjuntar; nunca pasa por el autosave ni por el historial.","newText":"- `persist/planos.ts`: un almacén `idb-keyval` propio (`createStore('concreta-planos',\n  'pdf')`), clave = `planoId`, valor `{ sha256, bytes, datos: ArrayBuffer, tipo,\n  savedAt, sinReferenciaDesde? }`. Se guardan los bytes, no un Blob: así el `sha256` y\n  los tests con `fake-indexeddb` funcionan en jsdom, que no implementa\n  `Blob.arrayBuffer()`; el fichero se lee con `FileReader`. Se escribe una vez al\n  adjuntar; nunca pasa por el autosave ni por el historial.\n- El `sha256` usa `crypto.subtle.digest` y, fuera de contexto seguro (la app se sirve\n  también por `http://` en red local, ver `persist/PersistUI.tsx`), una implementación\n  pura en `core/sha256.ts`, con test contra los vectores conocidos. Todo uso de\n  `navigator.storage.estimate()` va protegido: si no existe, no se enseña el espacio."},{"oldText":"- Borrar una obra borra sus planos. Huérfanos (obra reemplazada al importar, planos\n  quitados): limpieza en reposo al arrancar, solo de blobs sin referencia de ninguna\n  obra y con más de 7 días.","newText":"- Ningún camino borra blobs directamente, tampoco borrar una obra: lo hace SOLO la\n  limpieza de huérfanos, en reposo al arrancar y tras borrar una obra. La primera vez\n  que un blob aparece sin referencia se anota `sinReferenciaDesde`; si vuelve a tener\n  referencia, la marca se quita; se borra 7 días DESPUÉS de la marca (no de la fecha de\n  adjuntar), y nunca si su id está en el estado en memoria o en el historial de\n  Deshacer. Si algún sobre de obra no se puede leer, la limpieza entera se aborta."},{"oldText":"  - `id`, `nombre` (editable, p. ej. «Planta primera»), `archivo` (nombre original),\n    `bytes`, `sha256`, `paginas`;","newText":"  - `id`, `tipo: 'pdf' | 'imagen'` (ya en v6, aunque las imágenes lleguen en la Etapa\n    B), `nombre` (editable, p. ej. «Planta primera»), `archivo` (nombre original),\n    `bytes`, `sha256`, `paginas`, `revision?` («Rev. B») y `sustituye?` (id del plano\n    de la revisión anterior);"},{"oldText":"- Calibración: dos puntos + distancia real → `mPorUnidad`. Atajo «Escala 1:N» para PDF\n  impresos a escala real (1 unidad PDF = 1/72 pulgada = 0,3528 mm × N). Se enseña la\n  escala resultante («≈ 1:50») como comprobación.","newText":"- Calibración, un solo modo: dos puntos sobre una cota larga + su distancia real →\n  `mPorUnidad`. Después se mide una segunda cota conocida como comprobación y se\n  enseña la desviación; por encima del 1 % se pide calibrar de nuevo.\n- La escala del cajetín («E 1:50»), si el texto de la página la trae, se compara con la\n  calibrada teniendo en cuenta `userUnit` (1 unidad PDF = `userUnit`/72 pulgadas): la\n  franja dice «calibrada 1:49,7 · el plano dice 1:50». Si quedan a menos del 1 %,\n  `mPorUnidad` se ajusta a la escala exacta (`ajustada`), lo que elimina el error del\n  clic. No hay atajo «Escala 1:N» sin dos puntos."},{"oldText":"- `persist/planos` con `fake-indexeddb` y Blob: adjuntar, borrar obra, huérfanos,\n  reenlazar por `sha256`.","newText":"- `persist/planos` con `fake-indexeddb` y bytes (`ArrayBuffer`): adjuntar, borrar obra,\n  huérfanos, reenlazar por `sha256`."},{"oldText":"- La línea se crea con `insertMedLines` al final de la partida (o tras la línea con el\n  foco): UN paso de Deshacer por medida.","newText":"- La línea se crea con `medirEnPartida` (el mismo helper de líneas que\n  `insertMedLines`) al final de la partida, o tras la línea con el foco: UN paso de\n  Deshacer por medida."},{"oldText":"- Interacción: rueda = zoom al cursor; arrastrar con Mano, espacio o botón central =\n  desplazar; clic añade vértice; doble clic o Enter cierra; Retroceso quita el último\n  vértice; Esc cancela; Mayús fuerza 0/45/90°; lectura en vivo de longitud o área.","newText":"- Interacción: rueda = zoom al cursor; arrastrar con Mano, espacio o botón central =\n  desplazar; clic añade vértice; doble clic o Enter cierra; Retroceso quita el último\n  vértice; Esc cancela; Mayús fuerza 0/45/90°; lectura en vivo de longitud o área.\n- Entrada de geometría segura (`core/planoGeom`):\n  - el doble clic que cierra no añade vértices;\n  - un punto a menos de 4 px de pantalla del anterior se descarta;\n  - Recuento solo termina con Enter (un doble clic no cuenta dos veces);\n  - se rechazan con motivo la longitud 0, el polígono de menos de 3 vértices o de área 0\n    y el polígono que se corta a sí mismo («La forma se cruza: rehazla en orden»).\n  - Tests de cada caso."},{"oldText":"- DWG/DXF; imán a la geometría vectorial del PDF; varias escalas por página\n  (ventanas de detalle); certificar sobre el plano; medición automática con IA;\n  imprimir el plano con las medidas; sincronizar planos entre equipos.","newText":"- DWG/DXF; varias escalas por página (ventanas de detalle); certificar sobre el plano;\n  medición automática con IA; imprimir el plano con las medidas; sincronizar planos\n  entre equipos. El imán a la geometría vectorial no está fuera: es lo primero de la\n  Etapa B."}]} -->

### Fase 1 · CEO · SELECTIVE EXPANSION (autoplan, 2026-09-25)

**Incidencia de herramienta.** El hook de fases de /autoplan rechazaba la carga de la fase CEO en Windows («Native parent project directory is unavailable»): `CLAUDE_PROJECT_DIR` le llega con barras `/` y el `cwd` de la sesión alterna `d:\` / `D:\`. Con aprobación del usuario (D1 = A) se parchearon dos ficheros locales de gstack: `autoplan/bin/phase-publication-hook.ts` normaliza la ruta y `lib/claude-public-transcript.ts` compara el `cwd` sin distinguir mayúsculas en Windows. El diff está en el scratchpad de la sesión, para reportarlo arriba. El portero de fases sigue activo.

**Auditoría del sistema.**
- **Estado del repo.** `main` limpio en 967937e; solo está sin seguimiento este plan. Sin stash. La rama `feat/lineas-medicion` ya está fusionada (Etapas A y B de líneas: e30c1ef, 5bebf2c).
- **Últimos 30 días.** Pase de diseño móvil, portapapeles de líneas con TSV y Cortar, y almacenamiento persistente (`be5fe03`, `persist/durability.ts`). Los ficheros más tocados son `Presupuesto.module.css`, `TopBar.tsx`, `App.tsx`, `estructuraSlice.ts` y `DetailPanel.tsx`: este plan vuelve a tocar tres de ellos.
- **TODOS.md.** Relacionados:
  - «Medir sobre planos PDF (P2, grande)», que es este plan.
  - «Que la obra no pueda perderse»: los PDF aumentan lo que se pierde si el navegador borra datos, y el .zip con planos lo ataca.
  - «Guardar la obra en una carpeta (P2)» y «Obra en el móvil (P3)»: un plano adjunto tendría que viajar también por ahí.
  - T-19 (pestaña de solo lectura): adjuntar un PDF desde una pestaña de solo lectura escribiría el blob sin guardar su metadato. La limpieza de huérfanos lo cubre.
- **Referencias de estilo** (buenas):
  - `core/medPaste.ts` + `store/medLineOps.ts`: una operación pura preparada que el diálogo y la acción comparten, revalidada dentro del `set`, con diagrama ASCII;
  - `persist/persist.ts`: garantías escritas en cabecera y cola de un carril;
  - `core/expresion.ts`: parser propio, sin `eval`.
- **Antipatrón a evitar:** acciones de medición por índice (`editMedLine` / `deleteMedLine`). Todo lo nuevo va por id.
- **Aprendizajes previos aplicados:**
  - `temporal-700ms-coalescing` (9/10): cada medida y cada recálculo es una acción estructural que corta el historial;
  - `detailpanel-double-mount` (9/10): el estado del visor va en un store efímero, no en `DetailPanel`;
  - `no-jq-use-bun` (8/10).
- **Paisaje (WebSearch; Aside no disponible).**
  - [Capa 1] Bluebeam Revu es el listón de la «medición sobre PDF»: calibrar con una cota, longitud, polilínea, área, perímetro, volumen, «área de muro» (longitud × altura), recuento y huecos, más una lista de marcas exportable. Herramientas web recientes (Solid Takeoff, EzTakeoff, Easy Takeoffs) hacen lo mismo en el navegador, y alguna lee la escala impresa del cajetín para confirmarla con un toque.
  - [Capa 2] Presto mide sobre DWG e imágenes con un módulo CAD de pago y asocia las polilíneas a las líneas de medición. Hay un visor de código abierto (React + Vite + PDF.js) que guarda la geometría en coordenadas de página PDF, como propone este plan. En pdf.js, el lienzo grande a mucho zoom es un problema conocido (issue #6419): se pinta solo la zona visible.
  - [Capa 3] La ventaja de Concreta no es medir (eso es un commodity), sino que la medida ES la línea del presupuesto, con su `expr`, su forma de medir y su certificación, sin exportar a Excel ni reconciliar. Donde la sabiduría común falla: los takeoff americanos miden «cantidades» sueltas; en la medición española cada línea lleva comentario y dimensiones que la DF revisa. Por eso el vínculo línea ↔ plano pesa más aquí que la velocidad de clic.

**0A · Premisas**

| # | Premisa | Valoración |
|---|---|---|
| P1 | El tiempo se va en leer el plano y teclear | VÁLIDA: lo dice el experto de dominio, y toda la categoría de producto (Bluebeam, takeoff web) existe por eso |
| P2 | El PDF, y no el DWG, es la entrada correcta | VÁLIDA: es el formato que llega del arquitecto; el DWG a menudo no se entrega, y Presto ya cubre el DWG con su módulo |
| P3 | Hacer clic con escala calibrada es lo bastante preciso | VÁLIDA CON CONDICIONES: el error por vértice depende del zoom (±1-2 px de pantalla). Hace falta zoom fácil y Mayús para 0/45/90°. El imán vectorial queda para más adelante |
| P4 | «Medir por» decide las columnas | PARCIAL: Superficie en L×A no encaja con un polígono (el plan ya lo resuelve). Faltaban dos casos de dominio: el perímetro de una estancia (rodapié) y el área de paramento (L × altura) en formas de superficie directa → corregido en la tabla |
| P5 | Los PDF pueden vivir en IndexedDB junto a la obra | VÁLIDA CON CONDICIONES: el .json no los lleva; el reenlace por `sha256` y el .zip lo cubren. En `best-effort`, el navegador puede borrarlos, pero el usuario tiene el original |
| P6 | Una escala por página basta | DUDOSA: las hojas mezclan planta 1:50 con detalles 1:20. Se acepta como limitación visible (la escala activa siempre a la vista) y se aplaza la escala por zonas |
| P7 | Medir solo en la partida abierta | VÁLIDA pero lenta: una estancia alimenta solado, techo, rodapié y pintura. Se añade «una forma, varias partidas» |
| P8 | Una calibración equivocada se detecta a tiempo | FALSA: se descubre tras 50 medidas y hoy no habría forma de rehacerlas → se añade recalcular con la escala nueva (origen con puntos + escala congelada) |

Ninguna premisa llega como User Challenge: las falsas o dudosas se corrigen dentro de la dirección del usuario.

**0B · Qué ya existe**

| Subproblema | Código existente | Reuso |
|---|---|---|
| Línea con operación visible | `MedLine.expr`, `evalEsExpr`, `leerCelda` | Sí: la polilínea es una suma de tramos |
| Columnas según forma | `medFormaDef`, `medColumnas`, `formaDeUd`, `medFormaDe` | Sí: la tabla herramienta × forma se apoya en `cols` |
| kg/m desde el comentario | `pesoDesdeComentario` (vía `insertMedLines`) | Sí |
| Alta de líneas con Deshacer exacto | `insertMedLines` + `historyCheckpoint` + `MedResult` | Sí (hay que extender el clon a `origen`) |
| Guarda de certificadas | diálogo `MedPasteReview` y `deleteLines` en `medLineOps.ts` | Sí, para recalcular |
| Foco en una línea | `medUiStore.pendingFocus` + `usePendingFocus` | Sí, para «clic en forma → su línea» |
| Panel lateral | aside de Referencia/Asistente (`refWidth`, split/overlay/full) | Sí, tercer ocupante |
| Persistencia local | `idb-keyval`, `durability.ts`, `ProjectBackup` | Sí, con un almacén aparte |
| Esquema y migraciones | `SCHEMA_VERSION`, `MIGRATIONS`, `DOMAIN_KEYS` | Sí (v6) |
| Worker y chunk diferido | `bc3worker.ts`, `lazy(ImportarView)` | Patrón para pdf.js |
| Zip | `fflate` (transitivo por `write-excel-file`) | Sí para el .zip, declarándolo |
| Aviso de versión nueva | `update/appVersion.ts` + `version.json` | Sí: mitiga pestañas antiguas |
| Candado multi-pestaña | `persist/tabLock.ts` (T-19) | Sí |

**0C · Estado ideal**

```
  HOY                            ESTE PLAN                            IDEAL 12 MESES
  Plano en otro visor;      -->  PDF dentro de la obra, escala   -->  El plano es la fuente de la
  cifras tecleadas a mano;       por página, 4 herramientas;          medición: imán a la geometría,
  `expr` guarda la operación     cada medida = línea con origen;      escala por zonas, la misma
  pero no de dónde sale;         volver al plano; una forma en        forma alimenta N partidas,
  la DF revisa sin plano         varias partidas; recalcular          capa de «qué falta», plano
                                 si la escala estaba mal              marcado para la DF, certificar
                                                                      pintando lo ejecutado
```

**0C-bis · Alternativas**

| Enfoque | Resumen | Esfuerzo | Riesgo | Completitud |
|---|---|---|---|---|
| A · Mínimo | Visor + calibración + Longitud/Recuento; líneas sin origen persistente ni vuelta al plano | M | Bajo | 5/10: pierde la mitad de la promesa («pinchar una línea te lleva al plano») |
| B · Borrador | Visor, calibración, 4 herramientas, dimensiones fijas, restar, origen, capa de la partida, «Ver en plano», almacén aparte | L | Medio | 8/10 |
| C · B + corrección y reuso | B + recalcular al cambiar la escala, escala del cajetín, comentario desde el texto, una forma en varias partidas, perímetro y paramento, imágenes, .zip | L | Medio | 9/10 |
| D · DWG/DXF | Medir sobre CAD con geometría exacta | XL | Alto | Otra apuesta: el DWG no siempre llega y su lector en navegador es pesado |

Elegido: **C** (P1). Las piezas añadidas evitan dinero equivocado en silencio (recalcular) o multiplican la velocidad donde el dominio lo pide (una forma, varias partidas).

**0E · Modo:** SELECTIVE EXPANSION (regla de autoplan: se añade una capacidad nueva a un producto existente).

**0F/0G · Selección (cherry-picks)**

| # | Propuesta | Esfuerzo | Decisión | Motivo |
|---|---|---|---|---|
| 1 | Escala leída del texto del PDF + comprobación con una cota | S | ACEPTADA | En el radio de la calibración; es lo que ya hacen las herramientas web |
| 2 | Comentario propuesto desde el texto dentro del polígono | S | ACEPTADA | «P1 · Salón» sin teclear el nombre de la estancia |
| 3 | Una forma, varias partidas | M | ACEPTADA (taste) | El mayor multiplicador de velocidad en obra; amplía el concepto de origen |
| 4 | Capa de toda la obra con leyenda | M | ACEPTADA (Etapa B) | Ver qué falta por medir |
| 5 | Editar vértices | M | ACEPTADA (Etapa B) | Corregir sin volver a medir |
| 6 | .zip con planos | M | ACEPTADA (Etapa B) | Sin él, la copia de seguridad pierde los planos |
| 7 | Imán a la geometría vectorial | XL | APLAZADA (TODOS) | Fuera del radio y > 1 día |
| 8 | Varias escalas por página | M | APLAZADA (TODOS) | Se mitiga con la escala a la vista |
| 9 | Exportar el plano marcado para la DF | L | APLAZADA (TODOS) | Otra superficie (PDF de salida) |
| 10 | Certificar sobre el plano | XL | APLAZADA (TODOS) | Cambia el modelo de certificación |
| 11 | PNG/JPG como plano | S | ACEPTADA | El mismo adaptador, escaneos |
| 12 | Medición automática con IA | XL | DESCARTADA | Proyecto aparte; el asistente ya lee fotos |
| 13 | Contar símbolos iguales automáticamente | XL | APLAZADA (TODOS) | Visión por computador |
| 14 | Perímetro (Superficie en Longitud) y paramento (Longitud × altura en Sup. directa) | S | ACEPTADA | Corrige P4 |
| 15 | Recalcular al cambiar la escala | S | ACEPTADA (obligatoria) | Corrige P8: dinero equivocado sin salida |

**0D · Análisis**
- **Complejidad.** Unos 12 ficheros nuevos y 13 editados: pasa del umbral de 8, pero es una superficie nueva autocontenida (`features/planos`, `core/plano*`, `persist/planos`) que toca el resto por pocos puntos (esquema, `insertMedLines`, `MedLineRow`, aside). Lo mínimo que cumple la petición es la alternativa A, que deja fuera el vínculo con el plano.
- **10x.** Con un polígono por estancia salen solado, techo, rodapié y pintura, cada uno en su partida con su comentario, y la DF pincha cualquier línea y ve de dónde sale.
- **Detalles que se agradecen:**
  1. escala del cajetín en un clic;
  2. «P1 · Salón» sin teclear;
  3. Mayús para 0/45/90°;
  4. la forma se numera como su línea;
  5. recalcular tras corregir la escala;
  6. «Ver en plano» destaca la forma.
- **Plataforma.** `origen` y la capa son la base de certificar sobre plano, del plano marcado para la DF y del imán vectorial.

**0I · Interrogatorio temporal**
- **Hora 1:** ¿dónde viven los blobs y quién los borra? ¿Qué coordenadas guarda `origen` (página sin rotar, unidades PDF)? ¿Cómo se carga pdf.js en Vite con `base` de GitHub Pages?
- **Horas 2-3:** la tabla herramienta × forma y el `expr` exacto (redondeo por tramo). El destino cuando no hay partida abierta. Cómo se clona `origen` en `insertMedLines` y en el portapapeles (copiar una línea medida a otra obra deja un `planoId` que no existe).
- **Horas 4-5:** repintado con zoom y desplazamiento sin bloquear (cancelar `renderTask`). Recalcular con certificadas. La capa SVG alineada con el canvas en pantallas HiDPI (`devicePixelRatio`).
- **Horas 6+:** tests sin canvas en jsdom (doble del adaptador), un PDF real de prueba y Safari (cuota de IndexedDB).
- Esfuerzo: humano ~3-4 semanas / CC + gstack ~1-2 días, en dos etapas.

**0H · Revisión de especificación.** Tres lanzamientos, el tope (5/10 → 6/10 → 7/10), con 31 hallazgos, todos aplicados. Destacan tres:
- casillas vacías que multiplican ×1;
- `origen` sin magnitud, que impedía recalcular;
- `lineaParaDestino` perdiendo `origen`.

Métrica en `~/.gstack/analytics/spec-review.jsonl`. Documentos de 0H aprobados (decisión 19).

**Voces CEO**
- **Subagente Claude** (INPUT `ceo 3f3f84e2…`, coincide con la instantánea; completado), 10 hallazgos:
  1. «ya no vuelvo a Presto» depende de los documentos (cuadros de precios nº 1 y nº 2, mediciones sin precios), no de los planos (crítico);
  2. el recordatorio de copia P1 queda detrás (alto);
  3. el almacén de PDF debería ser una caché y el fichero del usuario la fuente de verdad (alto);
  4. la Etapa A es demasiado ancha y no se ha cronometrado nada (alto);
  5. 1:N y la escala leída son redundantes con la cota obligatoria (alto);
  6. una forma para varias partidas es el mayor ahorro y estaba en la B (alto);
  7. la precisión sin imán no se ha comprobado (medio);
  8. medir sobre PDF ya es algo corriente, así que el titular debe ser la trazabilidad (medio);
  9. por la puerta de atrás entra una medición vinculada (medio);
  10. el público no encaja con la licencia PolyForm Noncommercial (medio).
- **Codex** (completado, provider=codex), 9 hallazgos:
  1. no hay evidencia de que alguien cambie de Presto (alto);
  2. dibujar no es la única vía contra el tecleo: importar mediciones ya hechas, o terminar los documentos que faltan (alto);
  3. la Etapa A gasta la inversión antes de probar la hipótesis (alto);
  4. la primera entrega rompe la copia completa de la obra, porque el .zip estaba en la B (crítico);
  5. no se contemplan las revisiones del plano (alto);
  6. reusar una forma por igualdad de coordenadas no expresa la intención (alto);
  7. calibrar no garantiza que la medida sea correcta (alto);
  8. la trazabilidad se acaba en la frontera de Concreta (alto);
  9. no hay camino comercial (medio).

```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                             Claude  Codex  Consensus
  1. Premises valid?                     No      No     CONFIRMED (el motivo «dejar Presto» no se sostiene solo con planos)
  2. Right problem to solve?             Parcial No     CONFIRMED (dudan de la prioridad → User Challenge UC1)
  3. Scope calibration correct?          No      No     CONFIRMED (Etapa A demasiado ancha → Etapa A acotada + puerta cronometrada)
  4. Alternatives sufficiently explored? No      No     CONFIRMED (caché de PDF, importar mediciones hechas, documentos)
  5. Competitive/market risks covered?   No      No     CONFIRMED (medir sobre PDF es corriente; titular = trazabilidad; licencia)
  6. 6-month trajectory sound?           No      No     CONFIRMED (revisiones de plano, identidad de forma, copia completa)
```

**Integración** (regla de voz externa: cada hallazgo se contrasta con el código y con las decisiones previas):
- **User Challenge UC1 (las dos voces):** cambiar el orden. Primero el recordatorio de copia (P1) y los documentos (cuadros de precios, mediciones sin precios), o validar la demanda con usuarios reales, y después los planos. NO se decide aquí: va al gate final y la dirección del usuario se mantiene.
- **Aplicado sin preguntar** (dentro de la dirección del usuario; las dos voces coinciden):
  - Etapa A acotada, con puerta cronometrada antes de la B (dogfood como el spike §0.5, `docs/spike/02-dogfood-cronometrado.md`);
  - calibración única (dos puntos más una cota), con la escala del cajetín solo como comprobación y ajuste exacto por debajo del 1 %;
  - «Añadir también a…» en la Etapa A, con `formaId` explícito;
  - .zip con planos en la Etapa A;
  - recalcular salta las líneas certificadas;
  - trazados en el adaptador y el imán como lo primero de la Etapa B;
  - revisión mínima de un plano;
  - aviso de que las líneas no dependen del PDF.
- **Taste (al gate):**
  - T1: «una forma, varias partidas» en la Etapa A;
  - T2: propagar la edición de vértices por `formaId`;
  - T3: almacén persistente + .zip (Codex) frente a caché con reenlace (Claude);
  - T4: plano marcado para la DF en TODOS frente a Etapa B;
  - T5: imán en la Etapa B frente a TODOS.
- **Descartado:** `origen.fuente` para formas propuestas por IA (Claude #8), por especulativo (P5); la exclusión de la IA se razona en «NOT in scope».
- **Al gate como tema cruzado:** licencia y público (Claude #10, Codex #9).

### Sección 1 · Arquitectura

Alcance vigente: SELECTIVE EXPANSION. Filas aprobadas: decisiones 2-19 y la integración de voces (decisiones 20-27).

```
 TopBar «Planos» ─► obraStore.planosOpen ── excluye ── refOpen / asistenteOpen
                         │
 App: aside lateral ─► PlanosPanel (chunk diferido) ─► PlanoViewer ─► pdfAdapter ─► pdfjs-dist (worker)
        │                    │         ▲     ▲                             │ abrir(bytes) · pintar región
        │                    │         │     └── persist/planos (IDB 'concreta-planos': bytes+sha256)
        │                    │         │            ▲ adjuntar(File→FileReader→bytes→sha256)
        │                    ▼         │
        │              PlanoOverlay (SVG) ◄── med[].origen (planoId, pagina, formaId, puntos)
        │                    │ cierra forma / «Añadir también a…»
        ▼                    ▼
  planoUiStore        core/planoMedida (tabla herramienta × forma) ─► core/planoGeom (+ core/planoTexto)
  (herramienta, página,      │ valoresDesdeOrigen
   dims fijas por partida)   ▼
                      obraStore: medirEnPartida · recalibrarPagina · calibrarPagina · adjuntar/quitarPlano
                             │ structural() + historyCheckpoint (un paso de Deshacer)
                             ▼
                   ObraData v6 { planos[], partidas[].med[].origen }
                     │ autosave (sin bytes)                 │ ProjectBackup .zip (fflate) con bytes
                     ▼                                      ▼
            IDB concreta.obra.<id>                   fichero .zip ⇄ importar (verifica sha256)
 MedLineRow / MedCards «Ver en plano» ─► planoUiStore.revelar(origen) ─► el visor encuadra y destaca
```

- **Flujo «adjuntar».**
  - Camino feliz: File → bytes → `sha256` → `put` en el almacén de planos → `adjuntarPlano(meta)`.
  - Nulo: sin fichero, no pasa nada.
  - Vacío: 0 bytes → «El archivo está vacío».
  - Error: no es PDF, lleva contraseña o no hay cuota → mensaje concreto (Sección 2).
  - Orden: primero los bytes y después el metadato. Un corte entre medias deja un blob huérfano (lo recoge la limpieza), nunca un metadato sin bytes.
- **Flujo «medir».**
  - Camino feliz: forma → comentario → `medirEnPartida`.
  - Nulo: sin partida abierta, herramientas deshabilitadas.
  - Vacío: longitud 0 o polígono degenerado → rechazo con motivo.
  - Error: partida borrada mientras tanto → `reason: 'no-partida'` → aviso.
- **Máquina de estados del visor:**

```
 [sin plano] --adjuntar/abrir--> [cargando] --ok--> [viendo] <------------------------------+
                                      |error--> [error: «No se pudo abrir el PDF»]          |
 [viendo] --Calibrar--> [calibrando: 2 clics + distancia] --2ª cota ≤1 %--> [viendo, calibrada]
                                   ^------------- desviación > 1 % ---------------+
 [viendo] --herramienta--> [lista] --clic--> [dibujando] --Esc/cambiar partida--> [lista]
 [dibujando] --Enter/doble clic, forma válida--> [comentario] --Enter (kg/m resuelto)--> crea línea → [lista]
 [comentario] --Esc 1º--> sin propuesta --Esc 2º--> descarta → [lista]
 Imposibles: [dibujando] con Longitud/Superficie/Rectángulo en página sin calibrar (herramienta
 deshabilitada); [comentario] → línea en Peso sin kg/m (Enter bloqueado); Recuento cerrado por
 doble clic (solo Enter).
```

- **Acoplamiento nuevo:**
  - `MedLine.origen` → `planos` (por `planoId`): justificado, es el vínculo pedido.
  - El aside se convierte en el tercer ocupante del hueco lateral. `App.tsx` ya repite casi igual los bloques de Referencia y Asistente; un tercero pide extraer un envoltorio común (tarea T6).
- **Escala:**
  - Un PDF de 100 páginas se abre con el selector de página y carga perezosa.
  - 500 formas en la capa de una partida caben en SVG.
  - En la capa de toda la obra (Etapa B) hay que descartar lo que no está en la página.
  - Lo primero que se rompe es pintar hojas A0 muy vectoriales (Sección 7).
- **Puntos únicos de fallo:** el worker de pdf.js (chunk o ruta tras un despliegue) → error del visor con «Recarga la página»; las líneas no se ven afectadas.
- **Seguridad de la arquitectura:** Sección 3.
- **Rollback:** solo hacia delante. Una obra guardada en v6 es rechazada por la app v5, que muestra su banner de recuperación. Revertir el código no devuelve las obras ya guardadas: habría que publicar una corrección. Reversibilidad 2/5 (Sección 10).
- **Decisión:** sin hallazgos que pidan un cambio aparte de la tarea T6.

### Sección 2 · Mapa de errores

```
  CAMINO                         | QUÉ FALLA                               | CLASE
  -------------------------------|-----------------------------------------|---------------------------
  adjuntar: leer File            | FileReader.onerror                      | DOMException (lectura)
  adjuntar: abrir con pdf.js     | no es PDF / roto                        | InvalidPDFException
                                 | con contraseña                          | PasswordException
  adjuntar: guardar bytes        | sin cuota                               | QuotaExceededError
  adjuntar: sha256               | sin contexto seguro                     | crypto.subtle undefined
  abrir plano guardado           | faltan los bytes                        | (lectura IDB → undefined)
  pdfAdapter: cargar worker      | chunk/worker 404 tras despliegue        | Error de import dinámico
  pintar página                  | zoom a medio pintar                     | RenderingCancelledException
                                 | otro error de pintado                   | Error
  texto de la página             | getTextContent falla                    | Error
  calibrar                       | distancia 0, no numérica                | validación
  medirEnPartida / recalibrar    | partida borrada / estado cambiado       | MedResult reason no-partida/stale
  importar .zip                  | zip roto / demasiado grande / sha distinto | ImportError malformado / límite / sha
  limpieza de huérfanos          | un sobre de obra ilegible               | (loadObraEnvelope corrupt)

  CLASE                          | ¿RESCATADA? | ACCIÓN                              | EL USUARIO VE
  -------------------------------|-------------|-------------------------------------|-----------------------------
  lectura File                   | Sí          | aviso                               | «No se pudo leer el archivo»
  InvalidPDFException            | Sí          | aviso, nada se guarda               | «No es un PDF válido»
  PasswordException              | Sí          | aviso                               | «El PDF tiene contraseña: quítala y vuelve a adjuntarlo»
  QuotaExceededError             | Sí          | aviso con espacio (si estimate)     | «No queda espacio en el navegador»
  crypto.subtle undefined        | Sí          | sha256 puro                         | nada (transparente)
  bytes ausentes                 | Sí          | estado «plano no disponible»        | «Vuelve a adjuntar el PDF»
  import dinámico                | Sí          | aviso (patrón E-05)                 | «No se pudo cargar el visor. Recarga la página.»
  RenderingCancelledException    | Sí          | se ignora (esperado)                | nada
  otro error de pintado          | Sí          | 1 reintento, luego estado de error  | «No se pudo pintar esta página»
  getTextContent                 | Sí          | sin propuesta; console.warn         | solo el prefijo (degradado)
  validación de calibrar         | Sí          | error en línea                      | «Escribe la distancia real en metros»
  no-partida / stale             | Sí          | aviso / volver a preparar           | «La partida ya no existe» / diálogo otra vez
  ImportError .zip               | Sí          | aviso; plano sin bytes = no disponible | mensaje concreto
  sobre ilegible en limpieza     | Sí          | aborta la limpieza; console.warn    | nada (no borra)
```

Sin GAPs críticos. Hay dos degradaciones silenciosas a propósito (texto del PDF y limpieza abortada); las dos dejan registro en consola y ninguna cambia datos.

### Sección 3 · Seguridad y amenazas

| Amenaza | Prob. | Impacto | Mitigación en el plan |
|---|---|---|---|
| PDF malicioso que ejecuta código a través de pdf.js (CVE-2024-4367) | Baja | Alto | versión ≥ 4.2.67 fijada, `isEvalSupported: false`, sin scripting, formularios ni capa de anotaciones (sin enlaces `javascript:`) |
| Bomba zip o rutas raras al importar el .zip | Baja | Medio | tarea T4: tope de tamaño descomprimido, solo nombres conocidos, verificación de `sha256` |
| Texto del PDF inyectado en el comentario | Media | Bajo | React escapa el texto; el .bc3 lo limpia con `field()` en `core/bc3export.ts` (BC3 no tiene escape) |
| Dependencia nueva (`pdfjs-dist`) | Baja | Medio | Mozilla, mantenida; versión mayor fijada y revisada en cada subida |
| Datos personales en los planos (direcciones, nombres) | Media | Bajo | se quedan en el navegador; el .zip es un fichero del usuario |

No hay autenticación, red ni secretos nuevos. **Decisión:** añadir la tarea T4 (límites del .zip).

### Sección 4 · Flujos de datos y casos límite

```
 ADJUNTAR: File ─► leer (FileReader) ─► validar (pdf.js abre, páginas>0, ≤50 MB aviso) ─► sha256 ─► put bytes ─► adjuntarPlano(meta)
   sombra: nulo→no-op │ vacío→«vacío» │ no PDF/contraseña→aviso │ sin cuota→aviso │ mismo sha ya adjunto→«ya está: Planta 1» (no duplica)
 MEDIR:    clics ─► validar forma (planoGeom) ─► tabla (planoMedida) ─► comentario ─► medirEnPartida (revalida) ─► línea + capa
   sombra: sin partida→deshabilitado │ degenerada/cruzada→motivo │ dims fijas faltan→motivo │ partida borrada→no-partida │ cambio en medio→stale
 RESTAURAR .zip: fichero ─► unzip (límites) ─► parse obra ─► por plano: sha256(bytes)==meta.sha256 ? put : «no disponible»
```

- **Orden asíncrono.** Invariante: nunca queda un metadato que apunte a bytes sin guardar.
  - `put` de los bytes → `await` → `adjuntarPlano`. Si la pestaña se cierra tras el `put`, queda un blob sin referencia que la limpieza marca y borra a los 7 días. En el orden contrario, podría quedar un metadato sin bytes, y el orden impuesto lo impide.
  - Limpieza al arrancar frente a un adjunto en los primeros segundos: el blob nuevo aún no está en ningún sobre guardado. La limpieza solo lo MARCA, porque los 7 días de margen y el id en memoria le impiden borrarlo. Al guardarse, la marca se quita.
  - Cambio de página a medio pintar: `renderTask.cancel()` y un contador de petición; solo pinta la última.
  - Pruebas con pausas controladas: adjuntar con limpieza intercalada; cambiar de página dos veces seguidas.

| Interacción | Caso límite | ¿Cubierto? | Cómo |
|---|---|---|---|
| Adjuntar | el mismo PDF dos veces | Sí (añadido) | el mismo `sha256` en la obra → «Ya está adjunto como Planta 1» |
| Adjuntar | doble clic en «Adjuntar» | Sí | un único `<input type=file>`; el diálogo del sistema es modal |
| Medir | cambiar de partida a medio dibujar | Sí (añadido) | la forma se descarta con aviso «Forma descartada: cambiaste de partida» |
| Medir | cambiar de vista (Certificaciones) | Sí | `setView` limpia `openPartidaId` → herramientas deshabilitadas |
| Medir | doble clic, puntos repetidos | Sí | reglas de entrada de geometría |
| Visor | PDF de 0 páginas o roto | Sí | error al abrir |
| Visor | pestaña de solo lectura (T-19) | Parcial | se puede medir y no se guarda: es el TODO T-19 existente; aquí solo se documenta |
| Recalibrar | Enter por inercia | Sí | «No» por defecto |

**Decisión:** dos casos añadidos (PDF duplicado, cambiar de partida a medio dibujar); T-19 queda documentado.

### Sección 5 · Calidad de código

- **Reuso:**
  - `lineaParaDestino` sigue siendo el único constructor de líneas;
  - la guarda de certificadas de una partida (`MedPasteReview`) se reutiliza;
  - `structural()` y `historyCheckpoint` se reutilizan.
- **DRY:** `App.tsx` repite los bloques del aside para Referencia y Asistente (divisor + `aside` con las clases de `refStyles`). Con un tercer ocupante hay que extraer `LateralAside` (T6). Se mantienen los tres booleanos (`refOpen`, `asistenteOpen`, `planosOpen`) con la exclusión en el store, por diff mínimo; un `lateral: 'ref' | 'asistente' | 'planos' | null` sería más explícito, pero toca todas las lecturas de `refOpen`.
- **Complejidad:** la tabla herramienta × forma va como DATOS (un objeto por celda con casillas, dimensiones fijas exigidas y motivo), no como `if` anidados, para que el test recorra la tabla.
- **Nombres:** dominio en castellano como el resto (`planoMedida`, `valoresDesdeOrigen`, `medirEnPartida`).
- **Sobre-ingeniería evitada:** una sola forma de calibrar y sin `origen.fuente`.

### Sección 6 · Tests

```
 NUEVO                                   | TIPO          | FELIZ                       | FALLO                          | LÍMITE
 ----------------------------------------|---------------|-----------------------------|--------------------------------|-----------------------------
 core/planoGeom (long., área, lazo)      | Unit          | polilínea 3 tramos          | polígono cruzado → rechazo     | 2 vértices, área 0, puntos <4 px
 core/planoMedida (tabla completa)       | Unit          | cada celda                  | «no encaja» con motivo         | Recuento con más columnas; Peso sin perfil
 valoresDesdeOrigen + redondeo           | Unit          | expr = valor                | —                              | uds=2 se conserva; 0,1+0,2
 core/planoTexto (escala y nombres)      | Unit          | «E 1:50»                    | «1/2», fecha                   | sin texto
 core/sha256 (puro)                      | Unit          | vectores conocidos          | —                              | 0 bytes, 1 MB
 esquema v6                              | Unit          | v5→v6 planos: []            | v7 rechazada                   | loadObra/.bc3 sin herencia
 persist/planos (fake-indexeddb, bytes)  | Integración   | adjuntar/leer               | sin cuota (simulada)           | huérfano marcado/desmarcado/7 días; sobre corrupto aborta
 acciones de store                       | Integración   | un paso de Deshacer cada una | stale no toca nada             | recalcular salta certificadas
 lineaParaDestino con origen             | Unit          | duplicar conserva           | pegar en obra sin el plano lo quita | TSV nunca lo lleva
 PlanoViewer (doble del adaptador)       | UI            | calibrar + medir + Ver en plano | plano no disponible        | Esc/Supr/Ctrl+Z; cambiar de partida
 .zip ida y vuelta                       | Integración   | exportar→borrar→importar    | sha distinto → no disponible   | límite de tamaño
 pdf.js real (entorno node)              | Integración   | PDF A3 1:50 de prueba: una línea de longitud conocida | —            | /Rotate 90, userUnit 2
 E2E con /qa (navegador)                 | E2E           | adjuntar, calibrar, medir 3 tabiques, cantidad = esperada | —      | Safari/iPad
```

- **Test del viernes a las 2 de la mañana:** el E2E con un PDF de geometría conocida, donde la cantidad final coincide con la calculada a mano.
- **QA hostil:** polígono cruzado, zoom a medio pintar, Deshacer tras adjuntar, Supr con el visor enfocado.
- **Caos:** cuota llena al adjuntar.
- **Inestabilidad:** nada de pintado real en jsdom (se usa el doble). El PDF real se prueba en entorno node con fixtures generados.
- **Decisión:** añadir los fixtures PDF de prueba y el test de pdf.js real (T3), que no estaban en el plan.

### Sección 7 · Rendimiento

- **Tres caminos lentos:**
  1. primer pintado de una hoja A0 muy vectorial (1-5 s): marcador de «Pintando…» y cancelación al hacer zoom;
  2. `sha256` puro de 50 MB (1-2 s) fuera de contexto seguro: indicador de progreso;
  3. exportar un .zip de 100 MB con `zipSync` bloquearía la interfaz: usar la API asíncrona de `fflate` (T4).
- **Memoria:**
  - Los bytes se leen de IDB y se TRANSFIEREN al worker (transferible), sin copia doble.
  - El texto de cada página se cachea mientras el plano está abierto.
  - El historial guarda el metadato de `planos` y los puntos de `origen` (pequeños); nunca los bytes.
- **Autosave:** no cambia (sin bytes).
- **Decisión:** API asíncrona de `fflate` y transferencia al worker, en las tareas T4 y T2.

### Sección 8 · Observabilidad y depuración

La app es local, sin telemetría ni servidor: no hay paneles ni alertas que montar (N/A, justificado).
- **La depuración vive en el dato:** `origen` guarda plano, revisión, página, `formaId`, herramienta, escala y valores, así que un «¿de dónde sale este 23,40?» a las tres semanas se responde desde la propia línea.
- **Añadido:** «Detalles de la medida» en la línea (plano, revisión, página, escala y si está ajustada, herramienta, fecha). Pasa a la fase de diseño.
- **Consola:** `console.warn` con el id de plano y la página en fallos de pintado, de texto y en la limpieza abortada.

### Sección 9 · Despliegue

- **Cambios en el despliegue:** GitHub Pages sirve el worker como asset con hash; el `base` de Pages se respeta con `new URL(..., import.meta.url)`.
- **Pruebas tras publicar:** abrir el visor con un PDF de ejemplo y medir una línea.
- **Pestañas con versiones distintas:** el candado de pestañas (T-19) y el aviso de versión nueva (`update/appVersion.ts`) evitan que una pestaña antigua con el candado borre `planos`. Si la pestaña antigua tiene el candado, la nueva es de solo lectura y no guarda.
- **Sin feature flag:** la Etapa B depende de la puerta cronometrada, no de un interruptor.
- **Rollback:** solo hacia delante (Sección 1).
- **Decisión:** añadir la prueba del worker en el build publicado a la lista de verificación (T8).

### Sección 10 · Trayectoria

- **Deuda:**
  - pdf.js cambia de API entre versiones mayores (se fija la versión);
  - la heurística del texto (nombre de estancia, escala);
  - la tabla herramienta × forma (documentada como datos).
- **Reversibilidad:** 2/5 (esquema v6 en una sola dirección).
- **Plataforma:** `origen` + `formaId` + trazados son la base de:
  - certificar sobre el plano;
  - el plano marcado para la DF;
  - el imán;
  - la detección automática de estancias, si algún día se hace.
- **Retrospectiva de los cherry-picks:**
  - el atajo 1:N y la calibración desde el texto fueron una mala elección: se deshacen;
  - «una forma, varias partidas» era la pieza que sostenía el resto: sube a la Etapa A.
- **Dentro de un año:** un ingeniero nuevo entiende la tabla herramienta × forma y `valoresDesdeOrigen` si llevan diagramas ASCII en cabecera (T1).

### Sección 11 · Diseño y experiencia

| Función | Cargando | Vacío | Error | Éxito | Parcial |
|---|---|---|---|---|---|
| Lista de planos | «Cargando planos…» | «Adjunta el PDF de un plano para medir sobre él» + botón | plano no disponible con «Vuelve a adjuntar» | lista con escala por página | «N líneas medidas con otra escala» |
| Visor | «Pintando…» sobre la página a baja resolución | página sin calibrar: «Calibra esta página» | «No se pudo pintar esta página» | página nítida con capa | texto del PDF no disponible: sin propuestas |
| Medir | — | sin partida abierta: «Abre una partida para medir» | motivo de la herramienta deshabilitada | línea creada, aviso con la cantidad A → B | dimensiones fijas pendientes |

```
 Presupuesto (partida abierta) ──[Planos]──► Visor: lista ──► plano/página
      ▲                                           │ sin calibrar → Calibrar (2 puntos + cota)
      │ «Ver en plano»                            ▼
 línea medida ◄── crear línea ◄── comentario ◄── dibujar (herramienta según «Medir por»)
                                     │
                                     └──► «Añadir también a…» ──► otras partidas (misma forma)
```

- **Arquitectura de la información:** primero la partida de destino («Midiendo en…»), luego el plano y después las herramientas.
- **Riesgo de pantalla genérica:** bajo; el visor tiene un propósito concreto.
- **DESIGN.md:** hay que alinear con los tokens, que se repasan en la fase de diseño.
- **Móvil:** solo ver.
- **Accesibilidad:** teclado completo en el visor y `aria-live` para la lectura en vivo.

Se recomienda /plan-design-review, que es la fase 2 de este autoplan.

#### NOT in scope

- **Aplazado (TODOS.md al aprobar):**
  - varias escalas por página (P3);
  - exportar el plano marcado para la DF (P2);
  - certificar sobre el plano (P3);
  - contar símbolos iguales automáticamente (P3);
  - comparar revisiones de un plano (P2).
- **Condicionado a la puerta (Etapa B):** imán a la geometría vectorial, capa de toda la obra, editar vértices, PNG/JPG.
- **Descartado:**
  - DWG/DXF: el DWG no siempre llega, y Presto ya lo cubre con su módulo;
  - medición automática con IA: fiabilidad con PDF arbitrarios, coste y claves; el asistente ya lee fotos para otra tarea;
  - `origen.fuente`: especulativo;
  - sincronizar planos entre equipos: depende de «Obra en el móvil», P3;
  - el atajo «Escala 1:N» y calibrar desde el texto: sustituidos por la comprobación.

#### What already exists

Tabla 0B más arriba, con dos añadidos: `update/appVersion.ts` (aviso de versión nueva) y `field()` de `core/bc3export.ts` (limpieza del comentario al exportar).

#### Dream state delta

El plan deja resuelto medir con trazabilidad en una obra real, con reuso de una forma y copia completa. Del ideal a 12 meses quedan cuatro cosas:
- el imán, detrás de la puerta;
- la escala por zonas;
- el plano marcado para la DF;
- certificar pintando lo ejecutado.

Y queda la pregunta de negocio del gate (UC1): si los documentos son lo que de verdad retiene frente a Presto.

#### Failure Modes Registry

```
  CAMINO                  | MODO DE FALLO                                   | ¿RESCATADO? | ¿TEST? | EL USUARIO VE                 | ¿LOG?
  ------------------------|-------------------------------------------------|-------------|--------|-------------------------------|------
  calibrar                | PDF a otro tamaño que el del cajetín             | Sí          | Sí     | aviso «no cuadra con 1:50»     | No
  medir                   | casilla visible vacía (×1)                       | Sí (bloquea)| Sí     | motivo en la herramienta       | No
  recalibrar              | Enter por inercia recalcula                      | Sí («No» por defecto) | Sí | nada cambia            | No
  recalibrar              | línea certificada cambiaría                      | Sí (se salta)| Sí    | lista «revísalas a mano»       | No
  copiar línea            | origen perdido / de otra obra                    | Sí          | Sí     | capa correcta / sin capa       | No
  cargar .bc3 tras obra   | hereda `planos`                                  | Sí          | Sí     | nada                           | No
  borrar obra             | borra el PDF de otra obra                        | Sí (solo limpieza) | Sí | nada                     | Sí
  limpieza                | borra un blob que Deshacer necesita              | Sí (memoria + 7 días) | Sí | nada                  | Sí
  visor                   | Supr borra la partida abierta                    | Sí          | Sí     | nada                           | No
  visor                   | Esc cierra la partida a medio dibujar            | Sí          | Sí     | la forma se cancela            | No
  worker pdf.js           | 404 tras despliegue                              | Sí          | Sí (E2E) | «Recarga la página»          | Sí
  .zip                    | bomba / sha distinto                             | Sí          | Sí     | mensaje concreto               | No
  http en LAN             | sin crypto.subtle                                | Sí          | Sí     | nada                           | No
```

Sin CRITICAL GAPs (no hay ninguna fila sin rescate, sin test y silenciosa).

#### Diagramas y auditoría de diagramas existentes

- **Producidos:**
  - arquitectura del sistema;
  - flujos de datos con caminos sombra;
  - máquina de estados del visor;
  - flujo de error (mapa de la Sección 2);
  - despliegue y rollback (Secciones 1 y 9).
- **Diagramas ASCII existentes que tocan los ficheros del plan:**
  - `store/schema.ts` (historial de versiones): añadir v6;
  - `persist/persist.ts` (garantías en cabecera): mencionar el almacén aparte;
  - `App.tsx` (comentario del aside «UNA sola instancia del panel para las tres vistas»): actualizar con el tercer ocupante;
  - `hooks/useAppHotkeys.ts` (orden de Esc): añadir el visor;
  - `core/types.ts` (comentario de `MedLine`): añadir `origen`.

Ninguno queda obsoleto si se actualiza en el mismo cambio (T1).

#### Implementation Tasks (CEO)

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — core — Diagramas ASCII en `core/planoMedida.ts` y `valoresDesdeOrigen`, y actualizar los comentarios de esquema, persistencia, aside y Esc
  - Surfaced by: Sección 10 / auditoría de diagramas
  - Files: src/core/planoMedida.ts, src/store/schema.ts, src/persist/persist.ts, src/App.tsx, src/hooks/useAppHotkeys.ts, src/core/types.ts
  - Verify: revisión en el diff
- [ ] **T2 (P1, human: ~1d / CC: ~1h)** — planos — Adaptador pdf.js con worker, transferencia de bytes, cancelación de pintado y `trazados`
  - Surfaced by: Secciones 1, 7 y la integración de voces (trazados)
  - Files: src/features/planos/pdfAdapter.ts, package.json
  - Verify: test con el doble + E2E en el build publicado
- [ ] **T3 (P1, human: ~4h / CC: ~20min)** — tests — Fixtures PDF de geometría conocida (A3 1:50, /Rotate 90, userUnit 2) y test de pdf.js real en entorno node
  - Surfaced by: Sección 6
  - Files: src/core/__fixtures__/, src/features/planos/pdfAdapter.test.ts
  - Verify: `npx vitest run src/features/planos`
- [ ] **T4 (P1, human: ~1d / CC: ~45min)** — persist — .zip con planos en la Etapa A: API asíncrona de fflate, límites de tamaño y nombres, verificación de sha256
  - Surfaced by: Codex #4, Secciones 3 y 7
  - Files: src/persist/transfer.ts, src/features/obra/ProjectBackup.tsx, package.json
  - Verify: test de ida y vuelta + zip bomba rechazado
- [ ] **T5 (P1, human: ~2h / CC: ~15min)** — planos — PDF duplicado (mismo sha256) y descartar la forma al cambiar de partida
  - Surfaced by: Sección 4
  - Files: src/features/planos/PlanoViewer.tsx, src/store/planoUiStore.ts
  - Verify: tests de UI
- [ ] **T6 (P2, human: ~3h / CC: ~20min)** — layout — Extraer `LateralAside` para Referencia, Asistente y Planos
  - Surfaced by: Sección 5
  - Files: src/App.tsx
  - Verify: tests de TopBar y del aside en verde
- [ ] **T7 (P1, human: ~1h / CC: ~10min)** — docs — Plantilla de `docs/spike/03-planos-cronometrado.md` (método, partidas, meta) para la puerta
  - Surfaced by: integración de voces (puerta cronometrada)
  - Files: docs/spike/03-planos-cronometrado.md
  - Verify: existe antes de empezar la Etapa B
- [ ] **T8 (P2, human: ~30min / CC: ~5min)** — deploy — Prueba tras publicar: abrir el visor con un PDF de ejemplo y medir una línea
  - Surfaced by: Sección 9
  - Files: to be determined
  - Verify: `/qa` o `/canary` sobre el despliegue

#### Completion Summary (CEO)

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | main limpio; lineaParaDestino pierde origen;|
  |                      | loadObra hereda claves; aside duplicado     |
  | Step 0               | Enfoque C; 15 propuestas; spec 5→6→7/10     |
  | Section 1  (Arch)    | 1 issue (aside duplicado → T6)              |
  | Section 2  (Errors)  | 14 error paths mapped, 0 GAPS               |
  | Section 3  (Security)| 5 issues found, 0 High severity sin mitigar |
  | Section 4  (Data/UX) | 8 edge cases mapped, 0 unhandled (T-19 doc.)|
  | Section 5  (Quality) | 2 issues found (DRY aside, tabla como datos)|
  | Section 6  (Tests)   | Diagram produced, 1 gap (pdf.js real → T3)  |
  | Section 7  (Perf)    | 3 issues found (zip async, sha puro, pintado)|
  | Section 8  (Observ)  | 1 gap found (detalles de la medida)         |
  | Section 9  (Deploy)  | 2 risks flagged (rollback solo adelante, worker)|
  | Section 10 (Future)  | Reversibility: 2/5, debt items: 3           |
  | Section 11 (Design)  | 3 issues (estados, detalles, móvil solo ver)|
  +--------------------------------------------------------------------+
  | NOT in scope         | written (14 items)                          |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 14 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 13 total, 0 CRITICAL GAPS                   |
  | TODOS.md updates     | 5 items proposed (al aprobar)               |
  | Scope proposals      | 15 proposed, 9 accepted (EXP + SEL)         |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed + subagente Claude completed|
  | Lake Score           | N/A (decisiones automáticas de autoplan)    |
  | Diagrams produced    | 5 (arquitectura, datos, estados, error, despliegue) |
  | Stale diagrams found | 0 (5 a actualizar en el mismo cambio)       |
  | Unresolved decisions | 1 User Challenge + 5 taste → gate final     |
  +====================================================================+
```


### Fase 2 · Diseño (autoplan, 2026-09-25)

**Incidencia de herramienta.** El hook tampoco reconocía el cierre de la fase 1: este entorno guarda en el registro de la sesión una versión reescrita en castellano del texto del asistente («Fase 1 completada: …»), no el literal «Phase 1 complete». Con aprobación del usuario (D2 = A), `lib/autoplan-phase-publication.ts` acepta también «Fase N completada/terminada/cerrada» y los nombres de fase en castellano. El diff está junto al primero, en el scratchpad de la sesión.

**Auditoría.**
- **Alcance de UI:** alto.
  - Un panel nuevo (visor): cabecera, lienzo con capa, franja y calibración.
  - Cambios en `MedLineRow`/`MedCards` (marcador de origen), `ProjectBackup` (.zip), `TopBar` (botón Planos) y `App.tsx` (hueco lateral).
- **DESIGN.md existe** (`docs/DESIGN.md`) y todo se calibra contra él:
  - Geist Sans/Mono con cifras tabulares;
  - acento sky;
  - `--state-warn` para atención y `--state-danger` para errores y acciones destructivas;
  - `--ring-accent` para el foco;
  - alturas fijas (TopBar 48, botones 30–34);
  - breakpoints (<760, 760–1023, ≥1024; tabla → tarjetas si el ancho útil es < 780).
- **Patrones a reutilizar:**
  - el hueco lateral de Referencia/Asistente;
  - el `Modal` y la hoja inferior de `MedPasteReview`;
  - `toastStore` con tono;
  - `lineCheck`/`.tap-target` para 44 px;
  - `isTouchOnly()`;
  - `aria-live` en `DetailPanel`.
- **Revisiones previas:** el pase móvil (FINDING-001…018) y el diseño del plan de líneas (barra de selección, aviso único, sin opacidad para el cortado) fijan el vocabulario.
- **Aprendizajes aplicados:**
  - `modal-close-focus-passive-effect` (9/10): el foco tras cerrar el popover o la hoja se pide por estado y se aplica en un efecto pasivo;
  - `coarse-pointer-icon-btn` (9/10): en táctil real los botones del visor ocupan 44 px;
  - `detailpanel-double-mount` (9/10): el estado del visor va en `planoUiStore`.
- **Maquetas:** el generador está disponible (DESIGN_READY), pero no se usa dentro de autoplan, porque su tablero pide elegir variante a mitad de proceso. Es el mismo criterio que en el plan de líneas. Tras aprobar, `/design-shotgun` para el visor.

**Paso 0.**
- **Completitud inicial: 5/10.** Las reglas de interacción y de dinero están muy precisas. Falta lo que se ve:
  - el reparto del espacio;
  - la jerarquía de cabecera y franja;
  - el ciclo de una medida;
  - el flujo de calibrar;
  - la codificación visual de la capa;
  - dónde vive la procedencia en la línea;
  - la tabla de estados.
- **Un 10 sería:** un contrato de pantalla por ancho, con estados, foco y teclado definidos para cada paso de «adjuntar → calibrar → medir → revisar».
- **Foco:** las 7 dimensiones (P1).

**Voces de diseño**
- **CLAUDE SUBAGENT (design — independent review)** (INPUT `design 85e4a249…`, coincide con la instantánea; completado). 3 críticos, 7 altos y 12 medios.
  - Críticos:
    - C1: la franja lo carga todo y no tiene disposición ni estados;
    - C2: una medida escribe dinero sin confirmación visible, porque la tabla suele quedar oculta (`SPLIT_WIDTH = 1100`, sin columna de número);
    - C3: calibrar sin ayudas de precisión falla el 1 % (a 1:50 y ajustado a unos 600 px, un píxel son ~7 cm).
  - Altos:
    - H1: el ancho 320–640 no da para medir;
    - H2: la tablet contradice el modelo de interacción;
    - H3: el foco y el punto de inserción tras medir invertirían el orden de las líneas;
    - H4: las herramientas deshabilitadas no tienen regla ni camino al arreglo;
    - H5: el lenguaje visual de la capa choca consigo mismo (discontinuo = dos cosas; rojo = error);
    - H6: faltan los puntos de entrada a acciones sobre formas;
    - H7: reenlazar con una huella distinta no tiene camino.
  - Medios: M1–M12 (Sup. directa antes de dibujar, cruce en cada clic, Esc de un solo paso, «Añadir también a…», páginas y etiquetas, rectángulo girado, atajos, dimensiones fijas tras recargar, revisión fuera del comentario, borradores, copia, móvil y accesibilidad).
- **CODEX SAYS (design — UX challenge)** (completado, provider=codex; el prompt fue por stdin porque en Windows supera los 32 KB de la línea de órdenes). 10 hallazgos:
  1. el panel auxiliar no sirve como espacio de trabajo (alto);
  2. la calibración presenta una garantía de página entera aunque permite escalas mezcladas (crítico);
  3. «clic, clic, Enter» no tiene contrato de confirmar y repetir (alto);
  4. en tablet no se puede terminar un Recuento (alto);
  5. contener teclas no es accesibilidad: falta entrada por teclado, y Retroceso y Ctrl+Z tienen que ser nativos en el comentario (alto);
  6. faltan estados de carga y de fallo parcial (alto);
  7. la procedencia y los avisos quedan aplazados (alto; además, rojo = error en DESIGN.md);
  8. «Añadir también a…» calcula pero no deja decidir (alto);
  9. los cambios de contexto destruyen el trabajo a medias (medio);
  10. la copia de seguridad enseña formatos antes que completitud (medio).

```
DESIGN OUTSIDE VOICES — LITMUS SCORECARD (clasificación: APP UI / OPERATE):
═══════════════════════════════════════════════════════════════
  Check                                    Claude  Codex  Consensus
  ─────────────────────────────────────── ─────── ─────── ─────────
  1. Brand unmistakable in first screen?   N/A     N/A    N/A (panel dentro de la app)
  2. One strong visual anchor?             Sí*     No     DISAGREE (lienzo, pero sin espacio → Pase 1)
  3. Scannable by headlines only?          No      No     CONFIRMED NO (franja sin jerarquía)
  4. Each section has one job?             No      No     CONFIRMED NO (franja multiuso)
  5. Cards actually necessary?             Sí      Sí     CONFIRMED (no hay tarjetas decorativas)
  6. Motion improves hierarchy?            NOT SPEC'D —   NOT SPEC'D
  7. Premium without decorative shadows?   NOT SPEC'D —   NOT SPEC'D
  ─────────────────────────────────────── ─────── ─────── ─────────
  Hard rejections triggered:               0       0      CONFIRMED 0
═══════════════════════════════════════════════════════════════
 * Claude da el lienzo como ancla, pero advierte (H1) de que el ancho lo ahoga.
```

**Pase 1 · Arquitectura de la información: 4/10 → 8/10.**
- **Hallazgos:**
  - la franja lo carga todo (C1 y Codex #1, CONFIRMADO);
  - el panel es demasiado estrecho (H1 y Codex #1, CONFIRMADO);
  - sin selector de partida dentro del visor (C2 y Codex #1).
- **Decisión:** el contexto del documento va a la cabecera y el de medir a la franja, con dos filas y cuatro estados. El ancho del visor es propio (480 px → ancho útil − 520) y el split depende de anchos útiles. Hay selector de partida propio. Todo en el bloque de diseño.

```
 ┌ Cabecera 40px: [Planta 1 ▾] [P1 · Planta baja · 1:50 ✓ · 4 medidas ▾] (1:50 · ±0,3 %) [⋯] ┐
 │ Aviso (32px, uno): «Hay una revisión más nueva: Rev. B» [Abrir]                           │
 │ ┌ Herramientas: Mano · Calibrar │ Longitud · Superficie · Rectángulo · Recuento │ − Restar ┐│
 │ │                                                                                        ││
 │ │                LIENZO (PDF + capa SVG; lupa ×4 en la esquina opuesta)                  ││
 │ │                           [Terminar (4)] [Deshacer punto] [Cancelar]                   ││
 │ └────────────────────────────────────────────────────────────────────────────────────────┘│
 │ Fila 1: Midiendo en: 2.6 EAV010 Acero en vigas · Peso ▾         12 líneas · 148,30 kg     │
 │ Fila 2: [EN REPOSO: dims fijas] | [DIBUJANDO: 9,45 m · pistas] | [NOMBRANDO: P1 · [Salón] → │
 │         largo 18,40 → parcial 18,40 m²] | [CREADA: ✓ Línea 7 · Ver línea · Añadir también a…]│
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

Queda en 8 y no llega a 10 porque no hay maqueta: la proporción real de la franja se valida con `/design-review`.

**Pase 2 · Cobertura de estados: 5/10 → 9/10.**

| Función | Cargando | Vacío | Error | Éxito | Parcial |
|---|---|---|---|---|---|
| Adjuntar | fases «Leyendo… · Calculando huella… · Guardando…» (la huella pura puede tardar segundos por http) | — | contraseña / dañado / no es PDF / cuota llena, cada uno con su texto | abre la pág. 1 con la llamada «Calibra esta página» | mismo `sha256` → «Ya está adjunto como Planta 1» |
| Lista de planos | «Cargando planos…» | zona de soltar con 3 pasos y «Adjuntar plano» | plano no disponible: «Vuelve a adjuntar el PDF» | lista con escala y nº de medidas por página | «N líneas con otra escala» (solo certificadas o retocadas) |
| Página | página previa borrosa + «Pintando…», medir deshabilitado | sin medidas de la partida aquí: «Tiene medidas en P2 y P3» | «No se pudo pintar esta página» [Reintentar] | página nítida con la capa | texto ilegible: sin propuesta ni escala del cajetín, sin aviso |
| Calibrar | — | — | «Desviación 2,8 %» [Rehacer cota] [Rehacer comprobación] | «P1 calibrada 1:50 · comprobada 0,3 %» | ajustada / no cuadra con el cajetín (aviso warn) |
| Medir | — | sin partida: selector abierto | herramienta que no encaja → motivo + arreglo; cruce → tramo en danger | «✓ Línea 7 · 18,40 m²» + aria-live | falta una dimensión fija → campo en warn |
| Ver en plano | abriendo el plano | — | plano no disponible o quitado → marcador atenuado + popover «Vuelve a adjuntar» | encuadra y destaca 1,5 s | línea sin forma (borrada) → no hay marcador |
| Reenlazar | — | — | huella distinta → [Adjuntar como revisión nueva] [Cancelar] | «Plano reenlazado: 12 líneas» | — |
| Copia .zip | progreso «Empaquetando 3 planos…» | sin planos → solo .json | fallo → mensaje y la .json sigue disponible | «Copia completa (42 MB)» | planos no disponibles → «incompleta: falta Planta 2» |
| Restaurar .zip | progreso | — | zip no válido / demasiado grande | obra y planos restaurados | resumen persistente plano a plano |

**Pase 3 · Recorrido y emoción: 5/10 → 8/10.**

| Paso | El usuario hace | Siente | Lo sostiene |
|---|---|---|---|
| 1 | Abre Planos por primera vez | curiosidad | vacío con 3 pasos y zona de soltar |
| 2 | Adjunta el PDF | esperanza e impaciencia | fases de progreso; abre en la pág. 1 |
| 3 | Calibra | fricción | paso a paso en el lienzo, lupa ×4, puntos arrastrables, rehacer solo lo que falla |
| 4 | Primera medida | momento de la verdad | vista previa del valor antes del Enter y «✓ Línea 7» después |
| 5 | Ritmo (clic… Enter, Enter) | fluidez | foco que no sale, orden de inserción que avanza, atajos de una tecla |
| 6 | Misma estancia en otras partidas | «esto sí que ahorra» | hoja «Añadir a N partidas» con la cantidad de cada una |
| 7 | Revisa (DF o él mismo) | confianza | marcador con número igual al de la capa, popover de procedencia |

- **Primeros 5 segundos:** el lienzo manda y la franja dice dónde cae la medida.
- **5 minutos:** el ritmo sin teclear cifras.
- **Largo plazo:** la trazabilidad («¿de dónde sale este 23,40?»).

Se queda en 8 porque la calibración sigue siendo fricción obligatoria en cada página; la mitiga «Usar esta calibración en otras páginas».

**Pase 4 · Riesgo de pantalla genérica: 8/10 → 9/10.** Clasificación: OPERATE (herramienta de la app).
- **Reglas duras:** ninguna activada.
- **Litmus:** sin tarjetas decorativas y con un ancla (el lienzo) una vez resuelto el ancho.
- **Hallazgo:** el lenguaje de la capa estaba sin definir y chocaba consigo mismo (H5 y Codex #7). **Decisión:**
  - paleta de la capa independiente del tema, con halos;
  - Restar con sombreado y «−», sin rojo;
  - retocada con «✎» en warn;
  - insignias de tamaño fijo.

**Pase 5 · Sistema de diseño: 6/10 → 9/10.**
- **Hallazgos:** el rojo se usaba para Restar (en DESIGN.md el rojo es error o acción destructiva) y no se asignaban tokens ni tipografía a la lectura en vivo, al chip de escala ni a los avisos.
- **Decisión:**
  - Geist Mono con cifras tabulares para la lectura, la escala y las insignias;
  - `--accent` / `--accent-soft` para la capa de la partida y el chip calibrado;
  - `--state-warn` para retocada, «no cuadra» y dimensión que falta;
  - `--state-danger` solo para el tramo que se cruza y los errores;
  - `--ring-accent` para el foco;
  - alturas de 40 px (cabecera), 32 px (aviso) y 44 px (barra de control táctil);
  - iconos de lucide (ruler, square-dashed, hash, hand, crosshair, minus).
- **Componente nuevo:** el popover de forma o línea sigue el vocabulario del menú ⋮ y del `InfoTip`.

**Pase 6 · Responsive y accesibilidad: 3/10 → 8/10.**
- **Hallazgos:**
  - el ancho y el split no son intencionales (H1, Codex #1);
  - la tablet mide sin controles táctiles (H2, Codex #4, CONFIRMADO);
  - no hay entrada de puntos por teclado y el comentario perdía sus teclas nativas (Codex #5, M3);
  - faltan roles ARIA (M12).
- **Decisión:**
  - disposición por anchos (≥1366, 1024–1365, 760–1023, <760);
  - la tablet solo ve en la Etapa A (taste);
  - barra [Terminar] [Deshacer punto] [Cancelar] de 44 px;
  - cursor con flechas;
  - radiogroup y `role="application"`;
  - `aria-live` con límite;
  - teclas nativas en el comentario.
- **Por qué 8:** medir no es accesible con lector de pantalla más allá de lo razonable en una herramienta gráfica; lo compensan la tabla y su marcador.

**Pase 7 · Decisiones sin resolver.**

| Decisión | Si se aplaza |
|---|---|
| Rectángulo por 3 clics o por 2 esquinas | resuelta (3 clics, taste T8) |
| Medir con el dedo en tablet | resuelta (Etapa B, taste T7) |
| Una escala por página o flujo de detalle | resuelta (una escala; Codex; taste T6) |
| Qué ve la DF fuera de Concreta | sigue en TODOS (plano marcado, P2) |
| Proporción exacta de la franja a 1024 px | se valida con `/design-review` tras implementar |

Resueltas: 3 (auto con recomendación, al gate como taste). Aplazadas: 2.

#### NOT in scope (diseño)
- Maquetas dentro de autoplan: después, con `/design-shotgun`.
- Medir con el dedo en tablet: Etapa B.
- Lectura del plano por lector de pantalla (descripción de la geometría): no aplica a una herramienta gráfica; la tabla es la vía accesible.
- Plano marcado para la DF: TODOS (P2), decidido en la fase CEO.

#### What already exists (diseño)
- `docs/DESIGN.md` y `src/styles/tokens.css` (tokens, tipografía, alturas);
- el hueco lateral (`App.tsx`, `refStyles`) y su tirador;
- `Modal` / la hoja inferior de `MedPasteReview`;
- `toastStore` con tono y acción;
- `.tap-target` / `lineCheck`;
- `isTouchOnly()`;
- el menú ⋮ (`PartidaMenu`) e `InfoTip` para los popovers;
- `aria-live` de `DetailPanel`;
- `EmptyState` para los vacíos.

#### TODOS.md (diseño)
Ninguno nuevo. Medir con el dedo va a la Etapa B, dentro del plan; el plano marcado ya está en la lista CEO.

#### Implementation Tasks (diseño)
- [ ] **D1 (P1, human: ~1d / CC: ~45min)** — planos — Disposición del visor: ancho propio, split por anchos útiles, cabecera, aviso único y franja de dos filas con cuatro estados
  - Surfaced by: Pase 1 (C1, H1, Codex #1)
  - Files: src/features/planos/PlanosPanel.tsx, src/features/planos/Planos.module.css, src/App.tsx, src/store/obraStore.ts
  - Verify: tests de split a 1366/1024 + `/design-review`
- [ ] **D2 (P1, human: ~1d / CC: ~40min)** — planos — Ciclo de medida: NOMBRANDO con vista previa, CREADA, foco retenido, punto de inserción que avanza
  - Surfaced by: Pase 3 (C2, H3, Codex #3)
  - Files: src/features/planos/PlanoViewer.tsx, src/store/planoUiStore.ts
  - Verify: tres medidas en orden; foco en el visor
- [ ] **D3 (P1, human: ~1d / CC: ~40min)** — planos — Calibrar en el lienzo con lupa ×4, puntos arrastrables, rehacer parcial y copiar a otras páginas
  - Surfaced by: Pase 3 (C3)
  - Files: src/features/planos/CalibrarPasos.tsx (sustituye CalibrarDialog), src/features/planos/Lupa.tsx
  - Verify: test de arrastre y de rehacer la comprobación
- [ ] **D4 (P1, human: ~4h / CC: ~20min)** — presupuesto — Marcador de origen en `MedLineRow`/`MedCards` con su popover
  - Surfaced by: Pase 4 (C2, H6, Codex #7)
  - Files: src/features/presupuesto/MedLineRow.tsx, src/features/presupuesto/MedCards.tsx, src/features/presupuesto/MedOrigen.tsx
  - Verify: estados normal / retocada / no disponible
- [ ] **D5 (P1, human: ~4h / CC: ~20min)** — planos — Lenguaje visual de la capa independiente del tema y contraste ≥ 3:1 sobre blanco y negro
  - Surfaced by: Pase 4/5 (H5)
  - Files: src/features/planos/PlanoOverlay.tsx, src/features/planos/Planos.module.css
  - Verify: test de clases por estado + `/design-review`
- [ ] **D6 (P1, human: ~4h / CC: ~25min)** — planos — Hoja «Añadir a N partidas» con interpretación, cantidad y todo o nada
  - Surfaced by: Pase 7 (M4, Codex #8)
  - Files: src/features/planos/AnadirTambien.tsx
  - Verify: una partida inválida bloquea todas
- [ ] **D7 (P1, human: ~4h / CC: ~25min)** — planos — Estados de la tabla del Pase 2 (adjuntar, pintar, contraseña, cuota, huella distinta, .zip parcial)
  - Surfaced by: Pase 2 (Codex #6)
  - Files: src/features/planos/*, src/features/obra/ProjectBackup.tsx
  - Verify: un test por estado de error
- [ ] **D8 (P1, human: ~4h / CC: ~25min)** — a11y — Teclado: cursor con flechas, atajos de una tecla, teclas nativas en el comentario, radiogroup, aria-live con límite
  - Surfaced by: Pase 6 (Codex #5, M3, M7, M12)
  - Files: src/features/planos/PlanoViewer.tsx, src/features/planos/PlanoToolbar.tsx, src/layout/ayudaContent.ts
  - Verify: tests de teclado
- [ ] **D9 (P2, human: ~3h / CC: ~20min)** — planos — Borradores ligados a partida, página, herramienta y escala; [Seguir] [Descartar]
  - Surfaced by: Codex #9, M10
  - Files: src/store/planoUiStore.ts
  - Verify: tests de las tres rutas
- [ ] **D10 (P2, human: ~2h / CC: ~15min)** — obra — Copia completa con planos como acción principal, tamaños y «incompleta»
  - Surfaced by: Codex #10, M11
  - Files: src/features/obra/ProjectBackup.tsx
  - Verify: test de rótulos con y sin planos

#### Completion Summary (diseño)

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md sí; UI: panel nuevo + marcador    |
  | Step 0               | 5/10 inicial; las 7 dimensiones             |
  | Pass 1  (Info Arch)  | 4/10 → 8/10 after fixes                     |
  | Pass 2  (States)     | 5/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 5/10 → 8/10 after fixes                     |
  | Pass 4  (AI Slop)    | 8/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 6/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 3/10 → 8/10 after fixes                     |
  | Pass 7  (Decisions)  | 3 resolved, 2 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (autoplan), 0 approved          |
  | Decisions made       | 24 added to plan (auto, P1/P5)              |
  | Decisions deferred   | 2 (listed in Pass 7)                        |
  | Overall design score | 3/10 → 8/10                                 |
  +====================================================================+
```

Queda en 8 (y no más) por lo que se verá en vivo: la proporción de la franja y la calibración en uso real. `/design-review` tras la Etapa A.


### Fase 2.5 · DX (autoplan, 2026-09-25)

**Alcance.** El detector de términos activó la fase («package», «import», «API»). El producto no es una herramienta para desarrolladores, así que la experiencia de desarrollo se aplica a quien implementa y mantiene el visor en este repo: la API del store, la frontera del adaptador de pdf.js, los módulos puros, los fixtures, el bucle local y las subidas de pdf.js y del esquema.

**Clasificación:** Library/SDK interno (módulos del repo). **Modo:** DX POLISH (regla de autoplan: mejora de producto existente).

```
TARGET DEVELOPER PERSONA
========================
Who:       El desarrollador-propietario de Concreta (y el agente de código que implementa con él)
Context:   Implementa la Etapa A en ramas cortas, con tests en verde antes de cada commit
Tolerance: ~5 min para ver el visor midiendo algo; abandona si tiene que buscar un PDF y montar una obra
Expects:   Tipos exactos, un ejemplo que funcione, tests que no dependan de canvas en jsdom
```

**Empatía (primera persona).** «Clono, `npm install`, `npm run dev`. Quiero ver el visor midiendo un tabique. El plan me habla de un adaptador con "abrir(blob)", pero el almacén guarda ArrayBuffer, así que lo primero que hago es decidir yo el contrato. Busco un PDF en mi disco, creo una obra, una partida en m², adjunto, calibro con dos puntos y comprobación, elijo Superficie y me salta "¿Superficie directa o Rectángulo?". Diez minutos y aún no he medido nada. Para escribir los tests leo tres bloques con "sustituye"; «dos Esc» está en uno y «un Esc» en otro. `valoresDesdeOrigen` no me dice en qué casillas escribe. La primera vez que el test de pdf.js real revienta es porque `setup.ts` toca `Element` en node.» (Predicción sobre el texto del plan y el código; no es una observación medida.)

**Benchmark (0C).**

| Herramienta | Inicio → resultado | Tiempo + tipo de evidencia | Decisión DX | Fuente |
|---|---|---|---|---|
| Este plan (antes) | `npm run dev` → primera línea medida | ~10 min, estimado | sin ejemplo ni fixture | plan + código |
| Este plan (después) | `npm run dev` → `/#sandbox` «Planos (ejemplo)» → línea | < 3 min, estimado | ejemplo precalibrado | bloque DX |
| Visor abierto de medición (Plan Measure) | clonar → dev → PDF de ejemplo | no medido | incluye PDF de ejemplo | búsqueda de la fase CEO |

**TTHW:** ~10 min estimados ahora → objetivo Competitive (2-5 min; < 3 min desde `npm run dev`). La preparación de `npm install` se excluye del reloj y se dice. Vehículo del momento mágico: el sandbox con el ejemplo precalibrado, donde clic, clic, Enter, Enter da la línea con su `expr`. Usa una capacidad existente (`#sandbox`).

**Recorrido del desarrollador**

| Etapa | Hace | Fricción | Estado |
|---|---|---|---|
| 1. Descubrir | Lee el plan | Tres bloques en capas con «sustituye» | resuelto: especificación canónica antes de codificar |
| 2. Evaluar | Busca el contrato del adaptador y de los tipos | `abrir(blob)` frente a ArrayBuffer; `slots` sin definir | resuelto: interfaz exacta y unión discriminada |
| 3. Instalar | `npm install` (añade pdfjs-dist) | versión del worker ≠ librería | resuelto: versión exacta y test de versiones |
| 4. Hola mundo | Ver el visor midiendo | sin PDF ni obra de ejemplo | resuelto: sandbox «Planos (ejemplo)» |
| 5. Integrar | Conectar con el store | `medirEnPartida` no sirve para N destinos | resuelto: `addPlanoLines` por lotes |
| 6. Probar | Tests de UI y de pdf.js | canvas en jsdom; setup en node | resuelto: doble + proyecto node + generador de PDF |
| 7. Depurar | Un fallo de carga del visor | tumba la app entera | resuelto: frontera de errores local |
| 8. Subir versiones | pdf.js y esquema | rollback a v5 imposible | resuelto: constante `PLANOS_VISOR` + copia v5 + versiones exactas |
| 9. Escalar | Etapa B | trazados y capa de obra | ok: `trazados?` opcional en la interfaz |

```
FIRST-TIME DEVELOPER REPORT
============================
Persona: desarrollador-propietario + agente
Attempting: primera línea medida en local
CONFUSION LOG:
T+0:00  npm run dev; abre la app; no hay «Planos» con ejemplo → busca un PDF
T+2:00  crea obra y partida m²; adjunta; calibra (2 clics + distancia + comprobación)
T+6:00  elige Superficie → pregunta Sup. directa / Rectángulo → duda
T+8:00  mide; quiere el test: ¿cómo se prueba pdf.js en jsdom? → sin respuesta en el plan
T+10:00 decide él la interfaz del adaptador → deriva del plan
```

Tras los cambios: `/#sandbox` → «Planos (ejemplo)» → clic, clic, Enter, Enter → línea (T+2:00), y el test del ejemplo es el mismo recorrido.

**Voces DX**
- **Claude SUBAGENT (DX — independent review)** (INPUT `dx d8c321d5…`, coincide; completado). 18 hallazgos, 7 de ellos altos:
  - rodeo de forma en m²;
  - comprobación obligatoria en cada página;
  - plan en capas sin fusionar;
  - `valoresDesdeOrigen` sin casillas destino;
  - frontera de errores del visor;
  - reenlazar con otra huella;
  - `magnitud` por celda.
- **Codex SAYS (DX — developer experience challenge)** (completado, provider=codex, prompt por stdin). 11 hallazgos, 9 de ellos altos:
  - sin primera línea reproducible;
  - especificación que hay que fusionar a mano;
  - acción por lotes;
  - adaptador sin interfaz;
  - persistencia en dos almacenes;
  - validación de v6;
  - test de pdf.js real y subidas de versión;
  - rollback;
  - borradores sin dueño.

```
DX DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex  Consensus
  1. Getting started < 5 min?          No      No     CONFIRMED (sin ejemplo ni fixture)
  2. API/CLI naming guessable?         No      No     CONFIRMED (firmas, unidades, adaptador)
  3. Error messages actionable?        Parcial No     CONFIRMED (faltan causa, acción y tipos)
  4. Docs findable & complete?         No      No     CONFIRMED (plan en capas)
  5. Upgrade path safe?                —       No     N/A en Claude (no lo evaluó); Codex solo → aplicado (rollback, versiones)
  6. Dev environment friction-free?    No      No     CONFIRMED (jsdom/node, fixtures)
```

**Pases**
- **Pase 1 · Primeros pasos: 3 → 8.**
  - Sandbox «Planos (ejemplo)» con PDF generado y precalibrado.
  - Una partida m² vacía pasa a Sup. directa sin preguntar.
  - El cajetín cuenta como comprobación cuando cuadra.
  - Se queda en 8 porque `npm install` añade pdfjs-dist (~1,5 MB en `node_modules`) fuera del reloj.
- **Pase 2 · API: 5 → 8.**
  - Nombres de acciones con la convención del store.
  - Objeto de opciones y `ExpectLineas` común.
  - `addPlanoLines` por lotes.
  - Interfaz exacta del adaptador.
  - Unión discriminada de `OrigenPlano` con `slots`, `fijas` y `factor`.
  - Unidades fijadas.
  - Se queda en 8 porque la especificación canónica aún no está escrita (tarea DX0).
- **Pase 3 · Errores: 6 → 8.**
  - Motivos nuevos con texto (problema, causa y arreglo).
  - Frontera de errores local.
  - Copia con acción por estado.
  - «?» a la ayuda.
- **Pase 4 · Documentación: 5 → 7.**
  - Especificación canónica pendiente (DX0).
  - Ayuda con secciones y anclas.
  - Ejemplos JSON de `origen`.
  - Línea en el README.
- **Pase 5 · Subidas: 4 → 8.**
  - pdf.js con versión exacta y test de versión del worker.
  - Validación de v6 por elementos.
  - Constante `PLANOS_VISOR`.
  - Copia v5 antes de migrar.
  - «Necesita versión más nueva» frente a «dañada».
- **Pase 6 · Entorno: 4 → 8.**
  - Generador de PDF sin dependencias.
  - Proyecto de Vitest en node.
  - Doble del adaptador con tests de contrato.
  - Sandbox.
- **Pase 7 · Comunidad: 5 → 5.** N/A razonado: repo de un propietario con licencia PolyForm Noncommercial; no hay canal ni ecosistema que cuidar. Sin hallazgos que cambien el plan.
- **Pase 8 · Medición: 6 → 7.**
  - La puerta cronometrada mide al usuario final.
  - El test del sandbox fija el «hola mundo» del desarrollador.
  - `/devex-review` no aplica: no hay producto para desarrolladores.

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      |  8/10  |  3/10  |  ↑     |
| API/CLI/SDK          |  8/10  |  5/10  |  ↑     |
| Error Messages       |  8/10  |  6/10  |  ↑     |
| Documentation        |  7/10  |  5/10  |  ↑     |
| Upgrade Path         |  8/10  |  4/10  |  ↑     |
| Dev Environment      |  8/10  |  4/10  |  ↑     |
| Community            |  5/10  |  5/10  |  =     |
| DX Measurement       |  7/10  |  6/10  |  ↑     |
+--------------------------------------------------------------------+
| TTHW                 | <3 min | ~10 min|  ↑     |
| Competitive Rank     | Competitive                                 |
| Magical Moment       | designed via sandbox «Planos (ejemplo)»     |
| Product Type         | Library/SDK interno (módulos del repo)      |
| Mode                 | POLISH                                      |
| Overall DX           |  5/10  |  3/10  |  ↑  (el más bajo: Comunidad N/A) |
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction      | covered (sandbox)                              |
| Learn by Doing     | covered (ejemplo = test)                       |
| Fight Uncertainty  | covered (motivos + textos + frontera)          |
| Opinionated + Escape Hatches | covered (ajustada reversible, usar este PDF, desvincular) |
| Code in Context    | covered (JSON de origen por herramienta)       |
| Magical Moments    | covered (sandbox)                              |
+====================================================================+
```

```
DX IMPLEMENTATION CHECKLIST
============================
[ ] Time to hello world < 3 min desde `npm run dev` (sandbox «Planos (ejemplo)»)
[ ] Installation is one command (`npm install`; pdfjs-dist con versión exacta)
[ ] First run produces meaningful output (línea con largo 5, expr y origen)
[ ] Magical moment delivered via sandbox precalibrado
[ ] Every error message has: problem + cause + fix (+ «?» a la ayuda)
[ ] API naming guessable (verbo inglés + nombre de dominio en el store; castellano en core)
[ ] Every parameter has a sensible default (objeto de opciones; afterId = final)
[ ] Docs have copy-paste examples that actually work (JSON de origen = fixtures)
[ ] Examples show real use cases (tabique + estancia; Peso con perfil)
[ ] Upgrade path documented (v5→v6, copia v5, PLANOS_VISOR, versión de pdf.js)
[ ] Breaking changes have deprecation warnings (N/A: sin API pública)
[ ] TypeScript types included (unión discriminada de OrigenPlano, DocPdf)
[ ] Works in CI without special configuration (proyecto node aparte en vitest)
[ ] Changelog: N/A (el repo no lleva CHANGELOG; el commit y el plan hacen de registro)
```

#### NOT in scope (DX)
- Ejemplo de plano para el usuario final («Probar con un plano de ejemplo»): TODOS P3; el sandbox cubre al desarrollador.
- Canal de comunidad y contribución: no aplica a este repo.
- `/devex-review` tras implementar: no aplica (sin producto para desarrolladores); la puerta cronometrada mide al usuario.

#### What already exists (DX)
- `#sandbox` (`src/features/sandbox/Sandbox.tsx`);
- `fake-indexeddb` en devDependencies;
- `vitest.eval.config.ts` como precedente de un proyecto de Vitest aparte;
- `failText` en `medLineOps.ts`;
- `MedResult` en `obraStore.ts`;
- `AppErrorBoundary`;
- `update/appVersion.ts`;
- `ayudaContent.ts` con `FEATURES`, atajos y `STEPS`.

#### Implementation Tasks (DX)
- [ ] **X0 (P1, human: ~3h / CC: ~20min)** — docs — Escribir la «Especificación · Etapa A» canónica (tipos, tabla con magnitud, estados, atajos, errores, tests) y pasar lo sustituido al historial
  - Surfaced by: las dos voces DX (plan en capas)
  - Files: docs/plan-medir-planos-pdf.md
  - Verify: ninguna regla contradictoria; lista de tests única
- [ ] **X1 (P1, human: ~4h / CC: ~25min)** — sandbox — «Planos (ejemplo)» en `#sandbox` con PDF generado precalibrado y su test
  - Surfaced by: Pase 1
  - Files: src/features/sandbox/Sandbox.tsx, src/features/planos/PlanosSandbox.test.tsx
  - Verify: < 3 min desde `npm run dev`; el test mide el tabique
- [ ] **X2 (P1, human: ~4h / CC: ~25min)** — tests — Generador `pdfMinimo` y proyecto de Vitest en node para pdf.js real
  - Surfaced by: Pase 6 (Codex #8)
  - Files: src/test/pdfMinimo.ts, vitest.node.config.ts, package.json
  - Verify: `npx vitest run -c vitest.node.config.ts`
- [ ] **X3 (P1, human: ~4h / CC: ~20min)** — planos — Interfaz `DocPdf` exacta, doble y tests de contrato comunes
  - Surfaced by: Pase 2 (las dos voces)
  - Files: src/features/planos/pdfAdapter.ts, src/features/planos/pdfAdapter.fake.ts
  - Verify: los mismos tests pasan con el real (node) y con el doble
- [ ] **X4 (P1, human: ~1d / CC: ~45min)** — store — Acciones con nombres del store, objeto de opciones, `ExpectLineas`, `addPlanoLines` por lotes, motivos y textos
  - Surfaced by: Pases 2 y 3
  - Files: src/store/slices/estructuraSlice.ts, src/store/obraStore.ts, src/store/planoTextos.ts
  - Verify: lote todo o nada; un texto por motivo
- [ ] **X5 (P1, human: ~4h / CC: ~25min)** — persist — Coordinador de adjuntar (`docToken`, bytes antes que metadato), almacén por huella, consulta de huellas del historial
  - Surfaced by: Codex #6, Claude (dedupe)
  - Files: src/persist/planos.ts, src/store/temporal.ts
  - Verify: tests de cambio de obra y de cuota a mitad
- [ ] **X6 (P1, human: ~3h / CC: ~20min)** — schema — Validación de v6 por elementos, copia v5 antes de migrar, constante `PLANOS_VISOR`
  - Surfaced by: Pase 5 (Codex #7, #9)
  - Files: src/persist/persist.ts, src/store/schema.ts, vite.config.ts
  - Verify: v6 con `[null]`/NaN no rompe; el lector v5 no toca v6
- [ ] **X7 (P1, human: ~2h / CC: ~15min)** — app — Frontera de errores local para el chunk de Planos
  - Surfaced by: Claude §3 (alto)
  - Files: src/App.tsx
  - Verify: un chunk que falla deja el presupuesto usable
- [ ] **X8 (P2, human: ~2h / CC: ~15min)** — ayuda — Secciones con ancla, «?» en los avisos, README
  - Surfaced by: Pase 4
  - Files: src/layout/ayudaContent.ts, README.md
  - Verify: cada aviso de calibración, «no encaja» y huella distinta enlaza a su sección


### Fase 3 · Ingeniería (autoplan, 2026-09-25)

**Metodología:** `plan-eng-review` cargada entera (4 tramos, 2175/2175 líneas). Objetivo: el plan (`docs/plan-medir-planos-pdf.md`), revisado contra el código de `src/`.

**Aprendizajes previos:** ninguno aplicable (búsqueda de learnings sin resultados para este proyecto).

#### Paso 0 · Reto de alcance

**Qué existe ya para cada subproblema** (leído en el código):

| Subproblema | Código existente | Reuso |
|---|---|---|
| Deshacer por acción | `structural()` + `historyCheckpoint` (`estructuraSlice.ts:253`, `temporal.ts:219`) | tal cual |
| Alta de líneas con id nuevo | `insertMedLines` → `lineaParaDestino` (`estructuraSlice.ts:739`, `medPaste.ts:72`) | ampliar (`origen`) |
| Guarda de cambios entre preparar y aplicar | `moveMedLinesTo(…, expect)` (solo ids, `estructuraSlice.ts:796`) | generalizar por operación |
| Dominio con undo y autosave | `DOMAIN_KEYS` con exhaustividad en compilación (`schema.ts:68`) | añadir `planos` |
| Migraciones | `MIGRATIONS` + `fromSerializable` (`schema.ts:167-217`) | v5 → v6 |
| Carga y recuperación | `hydrate`, `switchObra`, `claimActive` (`sync.ts:170-351`), `loadObraData` (`registry.ts:87`) | cambiar: hoy «versión no soportada» = «dañada» |
| Vista previa de cantidad antes/después | `resumenCantidad` / `cambioCantidad` (`medPaste.ts:241`, `medLineOps.ts:94`) | tal cual |
| Hueco lateral | dos booleanos + exclusión a mano (`obraStore.ts:669-700`), dos `aside` (`App.tsx:339-382`) | refactor previo |
| Atajos globales | `useAppHotkeys` en `window` (`useAppHotkeys.ts:33-130`), guardas en `hotkeyGuards` | ampliar guardas |
| Solo lectura | `sessionStore.readonly`, gate en `ai/executor.ts` | mismo patrón en el visor |
| Chunk diferido y worker | `lazy()` en `App.tsx:31-36`, `bc3worker.ts` | precedente |
| Exportar .bc3 | `medLine` con `num(v, 3)` (`bc3export.ts:161`) | subir a 4 |

**Cambio mínimo:** el plan ya se acotó en CEO (Etapa A con puerta). La ingeniería no reduce alcance (regla P2 de autoplan). Las dos voces piden partir la Etapa A para llegar antes a la puerta: es un cambio de alcance en el que coinciden, así que va al gate como **UC2**, sin aplicarlo.

**Complejidad:** unos 22 ficheros nuevos y 20 editados; clases o servicios nuevos: adaptador de pdf.js, almacén de planos, `planoUiStore`, reductor del ciclo. Supera los umbrales (8 ficheros, 2 servicios).
- Pregunta de funciones: sin recortes (P2).
- Pregunta de estructura, auto-decidida: **disposición original**, porque ninguna disposición menor conserva los contratos aprobados, más una secuencia por commits:
  - Etapa 0 (compatibilidad y hueco lateral);
  - núcleo puro;
  - almacén;
  - visor;
  - integración.
- Registro de alcance: funciones: todas (P2); estructura: original + secuencia; alcance aceptado: el plan con los bloques CEO, diseño, DX y este; remedios pendientes: UC2, T9, T10 y T11 (gate).

**Búsqueda:** sin Aside y sin búsqueda web en esta fase; se usó el conocimiento del modelo y el código. **[Layer 1]** pdf.js (patrón estándar de visor web); **[Layer 1]** fflate `Unzip` en flujo; **[Layer 3]** un solo `valoresDesdeOrigen` para crear, recalcular y copiar.

**TODOS cruzados:**
- «Pestaña de solo-lectura (T-19)» (TODOS.md): el visor la agravaría (se podrían medir 20 líneas sin guardar), así que el visor la respeta desde el principio (bloque eng).
- «Conservar la cantidad fija como primera línea» (P3) sigue aparte; el visor solo lo hace visible.

**Distribución:** GitHub Pages en cada push a `main`. Afecta a los assets de pdf.js (`cMapUrl`, `standardFontDataUrl`, `wasmUrl`) y al interruptor en tiempo de ejecución.

#### Voces de ingeniería

**Claude SUBAGENT (eng — independent review)** (INPUT `eng d2792276…`, coincide con la instantánea; completado). 20 hallazgos, 3 altos:
- E1: desplegar v6 contra el v5 publicado (descartar, traspaso del candado);
- E2: la Etapa A es tan grande que la puerta no protege;
- E3: huecos en la limpieza de PDF (carrera con la deduplicación, abortar para siempre, leer todos los sobres, prefijo de la copia v5).

Medios:
- E4: validar rechazando la obra entera;
- E5: quitar un plano rompe la procedencia;
- E6: contradicciones entre bloques;
- E7: pestaña de solo lectura;
- E8: límites del .zip;
- E9: trabajo oculto de pdf.js;
- E10: 4 decimales frente al .bc3;
- E11: teclado.

Bajos: E12–E20 (hueco lateral, reductor, signo de Restar, acciones sin nombre, interruptor, comprobación en otro eje, certificado > 100 %, hash en worker, columna del marcador en la rejilla).

**Codex SAYS (eng — architecture challenge)** (completado, provider=codex, prompt por stdin, 82.816 tokens). 14 hallazgos:
- Crítico:
  - C1: Restar choca con certificar por líneas; `completeDraft` solo marca parciales > 0 (`certSlice.ts:95`) y `setCertLine` borra cantidades ≤ 0 (`certSlice.ts:152`).
- Altos:
  - C2: «Aceptar valores actuales» expone la corrección a un recálculo;
  - C3: reenlazar con otra huella destruye la procedencia;
  - C4: `ExpectLineas` insuficiente;
  - C5: la primera línea sustituye la cantidad fija (`medicion.ts:50`);
  - C6: la limpieza entre pestañas no es segura;
  - C7: la restauración parcial del .zip consume la cuota y `ProjectBackup` ignora `flushPending` (`ProjectBackup.tsx:78`);
  - C8: un tope derivado de lo declarado no es un tope;
  - C9: el adaptador no da el origen de la caja;
  - C10: el cajetín vuelve a ser autoridad.
- Medios:
  - C11: `formaId` sin versión de geometría;
  - C12: cancelar la apertura del documento;
  - C13: falta la release previa para el rollback;
  - C14: la puerta valida poco y tarde.
- Recommendation: revisar la especificación canónica antes de implementar.

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex  Consensus
  1. Architecture sound?               No*     No     CONFIRMED (núcleo sano; despliegue, limpieza, procedencia y expect no)
  2. Test coverage sufficient?         No      No     CONFIRMED (v7, carreras, fixtures de caja, .zip deshonesto)
  3. Performance risks addressed?      No      No     CONFIRMED (PDF CAD pesados, memoria de lienzos, hash, .zip en memoria)
  4. Security threats covered?         Parcial No     CONFIRMED (tope real del .zip, huella calculada como clave)
  5. Error paths handled?              No      No     CONFIRMED (validación, traspaso, restauración parcial)
  6. Deployment risk manageable?       No      No     CONFIRMED (release de compatibilidad antes de v6)
CONFIRMED = native + outside agree; primary cannot replace outside. DISAGREE → taste.
* «el núcleo del modelo es sano» (Claude): el No es por el despliegue y la limpieza.
```

- **Consenso:** 6/6 confirmadas; 0 desacuerdos entre voces.
- **Cambio de alcance en el que coinciden las dos** (E2 + C14): partir la Etapa A → **UC2**, al gate.
- **Codex contra decisiones DX aceptadas, con motivo válido** → decisiones de criterio:
  - **T9**: el cajetín cuenta como comprobación (C10 frente a la fila 54 DX).
  - **T10**: «Usar este PDF para este plano» con otra huella (C3 frente a la fila 60 DX).
- **Crítico de una sola voz** (C1, Codex): Restar frente a la certificación por líneas. Se marca y va al gate como **T11**, porque cambia la semántica de un documento de cobro.

#### Sección 1 · Arquitectura

```
                          ┌────────────── App.tsx ───────────────┐
  TopBar «Planos» ───────▶│ LateralAside (lateral: ref|asist|planos)│◀── useAppHotkeys (Esc/Supr/Ctrl+Z)
                          │   └─ ErrorBoundary local                │        ▲ isInteractiveTarget
                          │       └─ lazy(features/planos) ─────────┼──┐     │ [data-planos-viewer]
                          └────────────────────────────────────────┘  │
                                                                      ▼
  features/planos/  PlanoViewer ──▶ core/planoCiclo (reductor puro) ──▶ efectos
     │   PlanoToolbar, PlanoOverlay(SVG), CalibrarPasos, Lupa,            │
     │   AnadirTambien, MedOrigen (en MedLineRow/MedCards)                │
     │                                                                    ▼
     ├──▶ pdfAdapter (DocPdf) ──worker──▶ pdfjs-dist (versión exacta, legacy, assets en dist)
     │        ▲ bytes re-leídos por apertura
     ├──▶ core/planoGeom · core/planoMedida (prepararMedida, valoresDesdeOrigen)
     │      · core/planoTexto (cajetín, estancias) · core/sha256 (worker)
     ├──▶ store/planoUiStore (plano, página, herramienta, borradores, fijas por partida)
     │        ▲ reconcilia con obraStore.planos tras Deshacer
     └──▶ obraStore acciones: attachPlano · removePlano(quitado) · setPlanoPageScale
              addPlanoLines · rescalePlanoPage · remeasureLine · renamePlano …
              └─ structural() + expect por operación (calRev, huella, medForma)
                     │
        ┌────────────┴───────────────┐
        ▼                            ▼
  ObraData.planos (v6, DOMAIN_KEYS)  persist/planos.ts  ── IDB 'concreta-planos' (clave = sha256)
  MedLine.origen (huella, calRev,    │  update(): marca/tocadoEn;  «Liberar espacio» con Web Lock
     formaId, slots, fijas, aceptada)│  ▲ referencias desde ObraMeta.huellas (registry)
        │                            │
        ▼                            ▼
  persist/sync (autosave, hydrate,   persist/transfer (.json, .zip en flujo, restaurar por etapas)
   handoff seguro, «más nueva»)
```

Hallazgos (auto-decididos salvo lo que va al gate):
1. **[P1] (confianza 9/10) `persist/sync.ts:175-178`**: en el traspaso, un `loadObraIntoStore` que falla se ignora y se arma el autosave: `if (activeId() === id) await loadObraIntoStore(id); armAutosave();`. Con una pestaña vieja y una obra v6, la siguiente edición pisa el sobre. Remedio: Etapa 0 del bloque eng.
2. **[P1] (9/10) `persist/registry.ts:87-94`**: `fromSerializable` lanza con una versión mayor y `loadObraData` devuelve `null`; el banner ofrece «Descartar y empezar» (`discardRecovery` → `registryDeleteObra`). Remedio: resultado `mas-nueva` sin descartar.
3. **[P1] (8/10) Limpieza de PDF**: carrera entre deduplicar y borrar; aborto permanente con un sobre ilegible (`reconcile` conserva los corruptos a propósito, `registry.ts:175`); lectura de todos los sobres. Remedio: sin borrado automático en la Etapa A, índice `huellas` y «Liberar espacio».
4. **[P1] (8/10) Procedencia**: el `origen` no guarda la huella ni la revisión de calibración, y quitar un plano borra su metadato. Remedio: `origen.huella`, `origen.calRev`, `quitado`.
5. **[P2] (8/10) `obraStore.ts:669-700`**: tres booleanos excluyentes a mano. Remedio: `lateral` único en la Etapa 0.
6. **[P2] (7/10) Adaptador**: sin caja visible ni cancelación de la apertura. Remedio en el bloque eng.
7. **[P2] (8/10) Seguridad del .zip**: tope real al descomprimir y huella calculada como clave.
8. **[P2] (7/10) Distribución**: assets de pdf.js con el `base` de Pages; build `legacy` o navegador mínimo; interruptor en tiempo de ejecución.

Fallo realista por integración nueva: el worker de pdf.js no carga tras un despliegue (chunk viejo en caché) → frontera de errores local con «Hay una versión nueva: recarga» (bloque DX); el presupuesto sigue usable.

#### Sección 2 · Calidad de código

1. **[P2] (8/10) Contradicciones entre bloques** (E6): destino, dimensiones fijas, rueda, clave del almacén y `bytes`/`tamano`. Se cierran en el bloque eng y la especificación X0 las absorbe.
2. **[P2] (7/10) El ciclo de medida en componentes** sería lo más difícil de probar → reductor puro `core/planoCiclo.ts`.
3. **[P2] (7/10) Acciones sin nombre** (renombrar, etiquetas, ajuste reversible, reenlazar, revisión) → nombradas con el mismo patrón que `insertMedLines`.
4. **[P2] (8/10) `bc3export.ts:161`**: `const d = (v) => (v === '' ? '' : num(v, 3))`. Los productos «(tramos)×h» tienen 4 decimales → `num(v, 4)` (quita ceros de cola) + test de ida y vuelta. Un solo formateador de `expr` en `core/`.
5. **[P2] (8/10) `useAppHotkeys.ts:77-86`**: Supr borra la partida si el foco no es «interactivo»; la raíz del visor no lo es. Remedio: `isInteractiveTarget` reconoce `[data-planos-viewer]`. `role="dialog"` solo en modales; `isComposing`.
6. **[P3] (7/10) Columna del marcador en `[data-editgrid]`** (`DetailPanel.tsx:271`, `MedCards.tsx:154`): no debe contar como celda para Tab ni para TSV.
7. **[P3] (7/10) El signo de Restar** se dibuja desde `uds`, no desde `origen.resta`.
8. **[P2] (8/10) «Aceptar valores actuales»** (C2): `origen.aceptada` excluye la línea del recálculo.

No hay extracción de código compartido que proponer: el plan ya reusa `lineaParaDestino`, `structural`, `resumenCantidad` y `failText` (que pasa a un módulo de textos). La rúbrica de código compartido no encuentra dos llamadores reales nuevos que justifiquen otro helper.

#### Sección 3 · Tests

**Framework:** Vitest 4 (jsdom, `src/test/setup.ts`) según `vite.config.ts`; ~60 ficheros de test en el repo. Proyecto node aparte para pdf.js real y el .zip (tarea X2). Sin LLM en el alcance: no hay suites de evaluación que correr (`eval:ia` no se toca).

Código y tests existentes leídos antes del diagrama: `schema.ts`, `temporal.ts`, `estructuraSlice.ts`, `certSlice.ts`, `persist.ts`, `registry.ts`, `sync.ts`, `medPaste.ts`, `medicion.ts`, `expresion.ts`, `bc3export.ts`, `useAppHotkeys.ts`, `ProjectBackup.tsx`, `App.tsx`. Tests existentes de las rutas en riesgo: `sync.test.ts`, `registry.test.ts`, `persist.test.ts`, `medPaste.test.ts`, `medLines.test.ts`, `temporal.test.ts`, `certificacion.test.ts`, `bc3export.test.ts`, `useAppHotkeys.test.tsx`, `ProjectBackup.test.tsx`.

```
CODE PATHS                                              USER FLOWS
[+] store/schema + persist (v6)                          [+] Primera medida (sandbox y obra real)
  ├── MIGRATIONS[5] v5→v6 planos:[]  [PLANNED]             ├── [PLANNED] [→E2E] sandbox: tabique → largo 5, expr, origen, 1 Deshacer
  ├── isObraData tras migrar          [GAP→añadido]         ├── [PLANNED] adjuntar → calibrar → comprobar → medir
  │     planos:[null]/escala 0/NaN → carga y limpia        ├── [GAP→añadido] partida con cantidad fija: «fija 100 → medida 5»
  ├── loadObraData 'mas-nueva'        [GAP→añadido] CRITICAL├── [GAP→añadido] Enter con isComposing no crea
  ├── claimActive handoff falla       [GAP→añadido] CRITICAL└── [PLANNED] tres medidas seguidas salen en orden
  ├── saveObra no pisa versión mayor  [GAP→añadido] CRITICAL
  └── copia v5 fuera de 'concreta.obra.' [GAP→añadido]    [+] Varias partidas y recálculo
[+] core/planoGeom                                         ├── [PLANNED] Añadir a N partidas todo o nada
  ├── longitud/área/perímetro/rect 3 clics [PLANNED]       ├── [GAP→añadido] hoja abierta + cambia calRev/medForma → stale
  ├── autocruce (colineal, vértice tocante, cierre) [GAP→añadido]├── [PLANNED] recalcular salta certificadas y retocadas
  ├── área invariante a giro y traslación [GAP→añadido]   ├── [GAP→añadido] salta también las aceptadas
  ├── Mayús 0/45/90 con /Rotate 90   [GAP→añadido]        └── [GAP→añadido] resumen avisa de cert > 100 %
  └── formateador de expr (golden)   [GAP→añadido]
[+] core/planoMedida                                     [+] Copia y restauración
  ├── tabla herramienta × forma completa [PLANNED]         ├── [PLANNED] [→E2E] .zip → borrar IDB → importar → capa
  ├── valoresDesdeOrigen = evalEsExpr [PLANNED]            ├── [GAP→añadido] tamaños falsos, duplicados, tope real
  ├── prepararMedida (vista previa = confirmación) [PLANNED]├── [GAP→añadido] cuota a mitad: sin éxito falso, retira nuevos
  └── invariante formaId ⇒ mismos puntos [GAP→añadido]    └── [GAP→añadido] .json: flushPending false → error visible
[+] core/planoCiclo (reductor)                             (regresión de ProjectBackup)
  └── tabla estados × eventos        [GAP→añadido]
[+] core/planoTexto                                      [+] Pestañas y versiones
  ├── E 1:50 / ESCALA 1/50 / dos escalas / fecha [PLANNED+añadido]├── [GAP→añadido] [→E2E] app vieja + obra v6: aviso sin descartar
  └── textos contiguos unidos         [GAP→añadido]        ├── [GAP→añadido] pestaña readonly: visor solo ve
[+] persist/planos                                         └── [GAP→añadido] adjuntar mientras otra pestaña libera espacio
  ├── adjuntar/reenlazar por huella   [PLANNED]
  ├── update(): quita marca, tocadoEn [GAP→añadido]      [+] Teclado y rejilla
  ├── Liberar espacio: lock + relectura [GAP→añadido]      ├── [PLANNED] Esc por estado; Supr no borra la partida
  └── sobre ilegible → recorrido crudo [GAP→añadido]      ├── [GAP→añadido] Supr con stopPropagation roto: la guarda salva
[+] store acciones (structural + expect)                   ├── [GAP→añadido] Tab y pegar Excel con columna marcador
  ├── un paso de Deshacer cada una    [PLANNED]            └── [GAP→añadido] Deshacer tras medir y volver a medir (ancla)
  ├── stale no toca nada              [PLANNED]
  ├── removePlano deja 'quitado' y revive [GAP→añadido]  [+] Rendimiento (puerta)
  └── remeasureLine → formaId nuevo   [GAP→añadido]        └── [GAP→añadido] plano CAD pesado: < 2 s primera página
[+] certificación por líneas (T11)
  ├── ★★★ certSlice actual (positivas) — certificacion.test.ts   REGRESIÓN: se conserva
  └── +100 / −10 → «Completada» certifica 90 [GAP→añadido, según T11] CRITICAL
[+] bc3export
  ├── ★★★ export actual — bc3export.test.ts (≤ 3 decimales idénticos)  REGRESIÓN
  └── línea «(tramos)×h» 4 decimales ida y vuelta [GAP→añadido]
[+] pdfAdapter (node, pdf.js real)
  ├── contrato real = doble           [PLANNED]
  ├── caja con origen ≠ 0, CropBox, 4 rotaciones, rot+UserUnit [GAP→añadido]
  ├── abrir A → B → llega A (se cierra) [GAP→añadido]
  └── versión librería = worker        [PLANNED]

LLM integration: ninguna (sin [→EVAL])
COVERAGE (del plan, antes de esta fase): 17/47 rutas con test previsto (36 %)
TRAS ESTA FASE: 47/47 con test previsto  |  Rutas de código: 30/30  |  Flujos: 17/17
QUALITY (tests existentes en riesgo): ★★★:2 (certSlice, bc3export)  |  GAPS añadidos: 30 (3 E2E, 0 eval)
Legend: ★★★ comportamiento + bordes + error | [PLANNED] test ya previsto en el plan | [GAP→añadido] test que faltaba y entra ahora | [→E2E] integración
```

**Regresión (regla de hierro).** Comportamiento existente en riesgo, con su contrato (auto-decidido; T11 cambia uno de ellos a propósito):
- **`lineaParaDestino`:** duplicar, pegar y mover sin `origen` siguen idénticos (`medPaste.test.ts`).
- **`loadObra` / `reset`:** una obra v5 migra a `planos: []` y no hereda planos de la anterior.
- **`completeDraft` / `setCertLine` con líneas positivas:** idéntico. Con líneas negativas cambia solo si T11 = A. Ese cambio es intencionado y va con test.
- **`bc3export`:** las líneas de ≤ 3 decimales salen byte a byte iguales.
- **`useAppHotkeys`:**
  - Esc con Referencia o el asistente abiertos, igual que hoy (pasa por `lateral`);
  - Supr sobre la partida, igual fuera del visor.
- **`ProjectBackup` (.json):** el camino feliz, igual. Un guardado fallido pasa a verse (cambio intencionado, con test).

**Tests que faltaban, por fichero** (todos unitarios salvo los marcados E2E):
- `src/persist/sync.test.ts`:
  - fixture v7 por `hydrate`, `switchObra` y traspaso: no se borra ni se pisa;
  - traspaso fallido → solo lectura sin autosave.
- `src/persist/persist.test.ts`: `saveObra` sobre un sobre v7 no escribe.
- `src/persist/registry.test.ts`:
  - `concreta.recovery.v5.*` no aparece en `reconcile`;
  - `huellas` en `ObraMeta`.
- `src/persist/planos.test.ts`:
  - `update` quita la marca;
  - «Liberar espacio» relee y respeta la marca cambiada;
  - sobre ilegible → recorrido crudo o «limpieza detenida».
- `src/store/schema.test.ts` (nuevo): limpiar `planos` inválidos carga la obra.
- `src/core/planoGeom.test.ts`: propiedades de área y autocruces; Mayús con rotación; formateador.
- `src/core/planoCiclo.test.ts`: la tabla de estados.
- `src/store/planos.test.ts`:
  - `expect` por operación (`calRev`, `medForma`);
  - `removePlano` con `quitado`;
  - `remeasureLine` con `formaId` nuevo;
  - `aceptada` fuera del recálculo;
  - aviso de cert > 100 %.
- `src/store/slices/certSlice` (en `certificacion.test.ts`): +100/−10 (T11).
- `src/core/bc3export.test.ts`: 4 decimales de ida y vuelta.
- `src/persist/transfer.node.test.ts`:
  - .zip deshonesto, duplicados, tope real;
  - restauración con cuota llena.
- `src/features/obra/ProjectBackup.test.tsx`: `flushPending` falso → error.
- `src/features/planos/pdfAdapter.node.test.ts`: cajas, rotaciones, apertura cancelada.
- `src/hooks/useAppHotkeys.test.tsx`: Supr dentro de `[data-planos-viewer]`.
- `src/features/presupuesto/*`:
  - Tab y TSV con la columna del marcador;
  - Enter con `isComposing`.
- E2E (Vitest de integración con el doble): la pestaña vieja con una obra v6; el sandbox; .zip completo.

Plan de pruebas escrito en `~/.gstack/projects/jramirezbandera-concreta-mediciones/javie-main-eng-review-test-plan-20260925-170828.md`.

#### Sección 4 · Rendimiento

1. **[P2] (7/10) PDF CAD pesados**: pintar una región vuelve a ejecutar toda la lista de operadores de la página. Presupuesto medido en la puerta con un plano real. Se liberan los lienzos (iOS limita la memoria total de lienzos, no solo los 16 MP de cada uno).
2. **[P2] (7/10) Huella de ficheros grandes**: calcularla en el hilo principal congela la UI con 50-500 MB → worker.
3. **[P2] (8/10) Limpieza**: leer todos los sobres al arrancar contradice la carga perezosa del registro → índice `ObraMeta.huellas`.
4. **[P2] (7/10) .zip en memoria**: exportar a un solo `Uint8Array` de cientos de MB tumba un iPad → Blob por partes y nivel 0.
5. **[P3] (6/10) Tamaño del sobre**: cada línea medida guarda sus `puntos`; con miles de líneas y polígonos de 30 vértices, el autosave (que reescribe la obra entera) crece. Medio: puntos redondeados a 0,01 unidades PDF en `origen` (la geometría del plano no tiene más precisión útil). Medir con la obra de dogfood antes de optimizar más.

#### Modos de fallo

| Ruta nueva | Fallo realista | Test | Manejo | Lo ve el usuario |
|---|---|---|---|---|
| Traspaso del candado con obra v6 en pestaña vieja | pisa el sobre v6 | añadido | Etapa 0 | hoy SILENCIOSO → **gap crítico** (cerrado por la Etapa 0) |
| Obra v6 abierta por la app vieja | «Descartar» borra la obra | añadido | tipo `mas-nueva` | hoy silencioso al pulsar → **gap crítico** (cerrado) |
| Restaurar .zip / .json sin cuota | éxito aparente solo en memoria | añadido | etapas + `flushPending` | hoy SILENCIOSO (fallo existente en `ProjectBackup.tsx:78`) → **gap crítico** (cerrado) |
| «Completada» con Restar | certifica 100 de 90 | añadido | T11 | se ve como > 100 %, pero cobra de más |
| Adjuntar mientras otra pestaña libera | PDF borrado | añadido | `update` + relectura + lock | «no disponible»; las líneas siguen |
| Sobre ilegible | limpieza parada para siempre | añadido | recorrido crudo + aviso | «limpieza detenida» |
| Worker/chunk de pdf.js no carga | visor en blanco | previsto | frontera local | «Hay una versión nueva: recarga» |
| PDF con contraseña o dañado | error de pdf.js | previsto | textos del bloque DX | mensaje con causa y arreglo |
| .zip malicioso | memoria agotada | añadido | tope real en flujo | rechazo con causa |
| Recalibrar con la hoja abierta | aplica con supuestos viejos | añadido | `expect` por operación | «stale» con el motivo |
| Texto CID sin cMaps | cajetín ilegible | añadido (fixture) | assets en dist | sin propuesta de escala |

**Gaps críticos: 3** (sin test, sin manejo y silenciosos en el diseño de entrada): traspaso con v6, descartar una obra más nueva y restauración sin guardar. Los tres quedan cerrados por el bloque eng; el tercero es un fallo que ya existe en `.json`.

#### NOT in scope (ingeniería)
- Borrado automático de PDF entre pestañas: TODOS (P3); en la Etapa A es manual («Liberar espacio»).
- `trazados()` implementado: solo la firma en la interfaz; se implementa con el imán (Etapa B).
- Convertir la cantidad fija en primera línea: ya en TODOS (P3).
- Bloquear todas las mutaciones en pestañas de solo lectura: TODO existente (T-19); el visor solo cubre lo suyo.
- Partir la Etapa A (A0/A1): no se aplica; va al gate como UC2.

#### What already exists (ingeniería)
- Se reusan tal cual: `structural` / `historyCheckpoint`, `DOMAIN_KEYS`, `MIGRATIONS`, `resumenCantidad` / `cambioCantidad`, `claimObra` (T-19), `lazy()` + worker del .bc3, `readonly` de `sessionStore`, `num()` (ya quita ceros).
- Se amplían: `lineaParaDestino`, `expect` de `moveMedLinesTo`, `loadObraData`, `saveObra`, `isInteractiveTarget`, `ObraMeta`.
- Se reconstruye: el hueco lateral pasa a `lateral` (refactor previo con tests en verde).

#### Paralelización

| Paso | Módulos | Depende de |
|---|---|---|
| E0 Compatibilidad + `lateral` | persist/, store/, App, hooks/ | — |
| E1 Núcleo puro (geom, medida, ciclo, texto, sha256, formateador) | core/ | — |
| E2 Almacén + transfer (.zip) | persist/ | E0 |
| E3 Adaptador pdf.js + generador PDF + proyecto node | features/planos (adaptador), src/test/ | — |
| E4 Acciones de store + v6 | store/ | E0, E1 |
| E5 Visor, capa, marcador | features/planos, features/presupuesto | E1, E3, E4 |
| E6 Certificación con signo (si T11 = A) | store/slices (cert) | — |

- Carriles: A: E0 → E2 → E4 (persist/store compartidos, en serie). B: E1. C: E3. D: E6.
- Orden: lanzar A (E0), B, C y D a la vez; fusionar B y C; tras E0, seguir A (E2 → E4); con todo fusionado, E5.
- Conflicto: E4 y E6 tocan `store/slices` (ficheros distintos: `estructuraSlice` frente a `certSlice`), así que se coordinan en el merge.
- E0 se publica sola antes que E4 (release de compatibilidad).

#### TODOS.md (ingeniería)
Escritos con los aplazados de todas las fases (ver TODOS.md, «Medir sobre planos PDF»):
- varias escalas por página (P3);
- plano marcado para la DF (P2);
- certificar sobre el plano (P3);
- contar símbolos (P3);
- comparar revisiones (P2);
- «Probar con un plano de ejemplo» (P3);
- borrado automático de PDF entre pestañas (P3).

#### Implementation Tasks (ingeniería)
- [ ] **E0 (P1, human: ~1d / CC: ~40min)** — persist — Release de compatibilidad: resultado `mas-nueva` sin descartar, traspaso fallido en solo lectura, `saveObra` que no pisa versiones mayores, fixture v7; publicar antes de v6
  - Surfaced by: Sección 1 #1-2 (las dos voces: E1, C13)
  - Files: src/persist/registry.ts, src/persist/sync.ts, src/persist/persist.ts, src/persist/PersistUI.tsx
  - Verify: `npx vitest run src/persist`; pestaña vieja + obra v7 sin pérdida
- [ ] **E1 (P1, human: ~4h / CC: ~25min)** — app — Hueco lateral como `lateral` único con `LateralAside`, sin cambiar comportamiento
  - Surfaced by: Sección 1 #5 (E12)
  - Files: src/store/obraStore.ts, src/App.tsx, src/hooks/useAppHotkeys.ts, src/layout/TopBar.tsx
  - Verify: tests actuales de Referencia, asistente y Esc en verde
- [ ] **E2 (P1, human: ~1d / CC: ~45min)** — persist — Almacén sin borrado automático: `update` con marca y `tocadoEn`, índice `huellas`, «Liberar espacio» con lock y relectura, copia v5 en `concreta.recovery.v5.*`
  - Surfaced by: Sección 1 #3 (E3, C6)
  - Files: src/persist/planos.ts, src/persist/registry.ts, src/persist/sync.ts
  - Verify: adjuntar concurrente con liberar; sobre ilegible
- [ ] **E3 (P1, human: ~6h / CC: ~35min)** — store — Procedencia y guardas: `origen.huella`, `calRev`, `aceptada`, `quitado`, `expect` por operación con repreparación dentro del `set`, `formaId` inmutable, acciones que faltaban
  - Surfaced by: Sección 1 #4, Sección 2 #3 y #8 (C2, C3, C4, C11, E5, E15)
  - Files: src/core/types.ts, src/store/slices/estructuraSlice.ts, src/core/planoMedida.ts
  - Verify: `npx vitest run src/store`
- [ ] **E4 (P1, human: ~4h / CC: ~25min)** — schema — Validación v6 que limpia en vez de rechazar
  - Surfaced by: E4 (Claude)
  - Files: src/persist/persist.ts, src/store/schema.ts
  - Verify: `planos: [null]`, escala 0 y NaN cargan
- [ ] **E5 (P1, human: ~1d / CC: ~45min)** — transfer — .zip con tope real en flujo, huella calculada, duplicados, nivel 0, exportar por partes; restaurar por etapas; `ProjectBackup` comprueba `flushPending`
  - Surfaced by: C7, C8, E8
  - Files: src/persist/transfer.ts, src/features/obra/ProjectBackup.tsx
  - Verify: tests node del .zip; `ProjectBackup.test.tsx`
- [ ] **E6 (P1, human: ~6h / CC: ~35min)** — planos — Adaptador con `vista`, apertura cancelable, generaciones, bytes releídos; assets de pdf.js en dist; build legacy; fixtures de caja y rotación
  - Surfaced by: C9, C12, E9
  - Files: src/features/planos/pdfAdapter.ts, vite.config.ts, src/test/pdfMinimo.ts
  - Verify: `npx vitest run -c vitest.node.config.ts`; build con `base` de Pages
- [ ] **E7 (P2, human: ~4h / CC: ~25min)** — core — Reductor `planoCiclo`, formateador de `expr`, propiedades de geometría
  - Surfaced by: Sección 2 #2 y #4 (E13, E10)
  - Files: src/core/planoCiclo.ts, src/core/planoGeom.ts
  - Verify: tabla de estados como tests
- [ ] **E8 (P2, human: ~3h / CC: ~20min)** — ui — Defensa de teclado, solo lectura en el visor, columna del marcador fuera de la rejilla, rueda no pasiva, Restar por signo, «fija → medida»
  - Surfaced by: Sección 2 #5-7, E7, E11, E20, C5
  - Files: src/hooks/hotkeyGuards.ts, src/features/planos/PlanoViewer.tsx, src/hooks/editGridNav.ts, src/hooks/useMedGridTab.ts
  - Verify: tests de Supr, Tab, TSV e `isComposing`
- [ ] **E9 (P2, human: ~1h / CC: ~10min)** — export — .bc3 con 4 decimales y test de ida y vuelta
  - Surfaced by: Sección 2 #4 (E10)
  - Files: src/core/bc3export.ts
  - Verify: `npx vitest run src/core/bc3export`
- [ ] **E10 (P2, human: ~2h / CC: ~15min)** — flag — Interruptor en tiempo de ejecución (`?planos=1` / localStorage) en vez de la constante de compilación
  - Surfaced by: E16
  - Files: src/App.tsx, src/features/planos/flag.ts
  - Verify: apagado por defecto en producción
- [ ] **E11 (P1, human: ~2h / CC: ~15min)** — spike — Tolerancias y presupuesto de pintado de la puerta en `docs/spike/03-planos-cronometrado.md`
  - Surfaced by: C14, E9
  - Files: docs/spike/03-planos-cronometrado.md
  - Verify: el documento fija tolerancias y tiempos antes de medir
- [ ] **E12 (P1 si T11 = A, human: ~4h / CC: ~25min)** — cert — Certificación por líneas con signo (`completeDraft` y `setCertLine` aceptan negativas), antes de Restar
  - Surfaced by: C1 (Codex, crítico de una voz)
  - Files: src/store/slices/certSlice.ts
  - Verify: +100/−10 → 90; tests actuales de positivas intactos

#### Completion Summary (ingeniería)
- Step 0: Scope Challenge — scope accepted as-is (P2); partir la Etapa A → UC2 en el gate
- Architecture Review: 8 issues found
- Code Quality Review: 8 issues found
- Test Review: diagram produced, 30 gaps identified (todos añadidos al plan)
- Performance Review: 5 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 7 items (6 de fases anteriores + 1 de ingeniería), escritos
- Failure modes: 3 critical gaps flagged (cerrados por el bloque eng)
- Unresolved decisions: 4 en esta revisión, al gate (UC2, T9, T10, T11)
- Outside voice: codex, completed (14 findings); native subagent completed (20 findings)
- Parallelization: 4 lanes, 3 parallel / 1 sequential (A: E0 → E2 → E4)
- Lake Score: 12/12 (en cada elección de cobertura se tomó la opción completa)

### Fase 3 · Ingeniería, segunda pasada tras la aprobación (autoplan, 2026-09-25)

**Por qué hay segunda pasada:** en la aprobación final elegiste resolver los retos (B2):
- **D4 (reto 1, B):** el recordatorio de copia va en la Etapa 0, antes de los planos.
- **D5 (reto 2, A):** la Etapa A se parte en A0 → puerta → A1.

El flujo de autoplan exige repetir ingeniería sobre el plan cambiado.

**Metodología:** `plan-eng-review` cargada otra vez entera (4 tramos, 2175/2175 líneas, mismo sha256 `c5f1da66…`).

**Entrada:**
- Punto de control: `autoplan-eng-vkuE5Y`.
- Entrada revisada, con las decisiones D4 y D5 ya aplicadas al bloque de ingeniería: `autoplan-eng-KTPXOm` (sha256 `57cab19b…`).

#### Paso 0 · Reto de alcance (segunda pasada)

- **Alcance:** lo fijan tus respuestas D4 y D5; ingeniería no lo reduce (P2).
- **Voz que proponía recortar más:**
  - Claude M4 propone un A0 aún más pequeño: solo Longitud y Superficie en la interfaz.
  - Choca con D5, que ya aprobaste con las cuatro herramientas, y solo lo propone una voz. **No se reabre;** queda anotado.
- **Complejidad:**
  - Sin cambios en el número de ficheros.
  - Aparecen tres piezas nuevas:
    - el espacio de claves `concreta6.*` y su migración;
    - un módulo propio de IndexedDB para los PDF;
    - el protocolo de «Liberar espacio» entre pestañas.
  - Estructura: la original, con la secuencia Etapa 0 → A0 → puerta → A1 → B.
- **Código leído en esta pasada:**
  - `persist/registry.ts:258-292`: `saveActiveObra` reconstruye la meta con `metaOf` y pierde campos, incluido `kind`.
  - `update/appVersion.ts:101-121`: `reloadToLatest` recarga aunque el volcado falle o se agote.
  - `update/UpdatePrompt.tsx:53`: el aviso admite «Más tarde».
  - `persist/persist.ts:131-156`: una entrada fallida se queda en `pending` y se reintenta antes que las demás.
  - `persist/sync.ts:170-189`: `isOwner` y `readonly` cambian antes de recargar.
  - `certSlice.ts:95,152`.

#### Voces

**Claude SUBAGENT (eng — independent review)** (INPUT `eng 57cab19b…`, coincide con la entrada revisada; completado). 3 altos, 6 medios, 5 bajos y seguridad:
- H1: la limpieza al cargar más un solo esquema para A0, A1 y B destruye datos más nuevos desde una pestaña A0.
- H2: «Liberar espacio» puede borrar PDF en uso (meta sin `huellas`, ventana entre adjuntar y guardar, sin Web Locks por http).
- H3: `ultimaCopia` se pierde en el siguiente autosave.
- M1: la palanca de la Etapa 0 está mal en el traspaso, en `saveObra` y en el orden de tipos al cargar.
- M2: idb-keyval no sirve para el almacén de PDF.
- M3: la precisión del clic a zoom de ajustar hace imposible la tolerancia (lupa y cruz en A0; plausibilidad de la escala).
- M4: A0 no es mínimo (no se reabre).
- M5: el primer commit v6 congela el esquema.
- M6: complejidad oculta de pdf.js.
- L1–L5: dónde nace `formaId`, pegar en otra forma, claves de página, importar con cambios sin guardar, higiene del plan.

**Codex SAYS (eng — architecture challenge)** (completado, provider=codex, prompt por stdin, 74.426 tokens). 10 hallazgos:
- Crítico, #1: esperar una semana no protege de pestañas antiguas.
- Altos:
  - #2: el rechazo de `saveObra` necesita un final terminal;
  - #4: los guardados fallidos pertenecen a la Etapa 0;
  - #5: el índice `huellas` no basta para borrar;
  - #6: deshacer una restauración puede borrar un PDF adoptado por otra pestaña;
  - #8: T11 es condición de A0;
  - #9: reenlazar con otra huella no tiene contrato para las líneas antiguas.
- Medios:
  - #3: ciclo de vida de `ultimaCopia`;
  - #7: se pueden exportar copias que el importador rechaza;
  - #10: criterios de la puerta ambiguos.
- Recommendation: revisar el plan antes de implementar.

```
ENG DUAL VOICES — CONSENSUS TABLE (segunda pasada):
  Dimension                           Claude  Codex  Consensus
  1. Architecture sound?               No*     No     CONFIRMED (persistencia entre versiones y pestañas)
  2. Test coverage sufficient?         No      No     CONFIRMED (pestañas mixtas, cola, índice, topes)
  3. Performance risks addressed?      No      —      N/A en Codex; solo Claude (zoom de CAD, sobre leído en cada guardado)
  4. Security threats covered?         Parcial Parcial CONFIRMED (topes al importar .json; borrar lo adoptado)
  5. Error paths handled?              No      No     CONFIRMED (rechazo terminal, importar y actualizar con volcado fallido)
  6. Deployment risk manageable?       No      No     CONFIRMED (pestañas antiguas; el primer commit v6 congela el esquema)
CONFIRMED = native + outside agree; primary cannot replace outside. DISAGREE → taste.
* «la arquitectura central se sostiene» (Claude): el No es por la persistencia.
```

- **Consenso:** 5/6 confirmadas, 0 desacuerdos; rendimiento solo con una voz.
- **Crítico de una sola voz:** Codex #1 (pestañas antiguas). Claude H1 y M1 van en la misma línea, así que se trata como confirmado y se aplica: el espacio de claves de v6.

#### Sección 1 · Arquitectura (cambios)

```
  Etapa 0 (v5, publicada sola)          A0 (v6)                                  A1
  ─────────────────────────────         ───────────────────────────────          ───────────────────────────
  loadObraData: más-nueva primero       concreta6.obra.<id> ◀── migra una vez ── concreta.obra.<id> (copia v5)
  traspaso: owner solo tras recarga ok  concreta6.obras.index (huellas,huellasDe) pestaña vieja escribe aquí ─▶
  saveObra: version-conflict terminal   aviso «cambios antiguos» si savedAt v5 > migración
  importar/actualizar: sin éxito falso  validar sin destruir (opaco, _ilegible)
  recordatorio de copia (ultimaCopia,   concreta-planos (IDB propio):             Liberar espacio:
    meta fusionada)                       meta{tamano,tipo,tocadoEn,marca}          lock compartido/exclusivo
  lateral único + LateralAside            bytes{huella}  ← escritos una vez         o BroadcastChannel
                                        visor, calibrar (lupa, ≥300 px),          .zip (contrato común de topes,
                                          4 herramientas, Restar si E12             token por restauración)
                                        puerta cronometrada ──────────────────▶   revisiones, recálculo, cajetín…
```

Hallazgos:
1. **[P1] (confianza 8/10) Pestañas antiguas** (`sync.ts:170-189`, `UpdatePrompt.tsx:53`): la protección por tiempo no vale. Remedio: espacio de claves `concreta6.*` y aviso de cambios antiguos.
2. **[P1] (9/10) `persist.ts:131-156`:** una escritura rechazada se quedaría en `pending` para siempre. Remedio: resultado terminal `version-conflict`.
3. **[P1] (8/10) Validación destructiva entre subetapas** (Claude H1). Remedio: datos opacos y regla de versión.
4. **[P1] (8/10) «Liberar espacio»:**
   - Problema: meta sin `huellas` (`registry.ts:168`); ventana entre adjuntar y guardar; http sin Web Locks.
   - Remedio: «desconocido» ≠ `[]`, `huellasDe`, margen de 24 h, lock compartido/exclusivo o `BroadcastChannel`.
5. **[P2] (8/10) idb-keyval de un solo almacén** (Claude M2). Remedio: módulo IDB propio con `meta` y `bytes`.
6. **[P2] (7/10) Restauración que retira PDF adoptados** (Codex #6). Remedio: token por restauración y comprobación viva; va en `serializeOp`.

#### Sección 2 · Calidad de código (cambios)

1. **[P1] (9/10) `registry.ts:258-266,284`:** `saveActiveObra` sustituye la meta por `metaOf`, sin `kind` ni campos nuevos. Remedio: fusionar. Arregla de paso la pérdida de `kind` que ya existe.
2. **[P2] (8/10) `formaId` dentro del helper común** (`medPaste.ts:72`). Remedio: nace en las llamadas.
3. **[P2] (7/10) Pegar en otra forma** conserva un `origen` que ya no significa lo mismo. Remedio: se quita.
4. **[P2] (7/10) Claves de página como texto tras JSON.** Remedio: validar enteros de 1 a `paginas`.
5. **[P2] (8/10) Contradicciones que quedan** (Claude L5): el mismo PDF dos veces, Esc al nombrar, `fuente:'cajetin'` en A0… Remedio: X0 como puerta dura, con el contrato de lo que se guarda.

#### Sección 3 · Tests (cambios)

Diagrama de lo que añade esta pasada. El resto sigue como en la primera.

```
CODE PATHS                                              USER FLOWS
[+] Etapa 0 · persist                                    [+] Pestañas y versiones
  ├── loadObraData: más-nueva antes que isObraData          ├── [GAP→añadido] [→E2E] pestaña pre-Etapa-0 + traspaso tras migrar
  │     [GAP→añadido] v7 con otra forma → más-nueva         │     → v6 intacta + aviso «cambios antiguos»
  │     (hydrate, switch, activateFirstLoadable,            ├── [GAP→añadido] «Actualizar» con volcado false o lento: no recarga
  │      discardRecovery, obraSource)                       └── [GAP→añadido] importar .json con flushPending false: lo dice
  ├── saveObra version-conflict
  │     [GAP→añadido] sale de pending; otra obra guarda  [+] Copia
  ├── traspaso: owner solo tras ok [GAP→añadido]            ├── [GAP→añadido] exportar → editar → autosave → recargar: ultimaCopia sigue
  └── metaOf fusiona [GAP→añadido] (kind, ultimaCopia,     ├── [GAP→añadido] aviso a 8 días sí, a 6 no
        huellas sobreviven)                                 └── [GAP→añadido] importar no hereda la fecha
[+] A0 · espacio concreta6.*
  ├── migración única [GAP→añadido]                      [+] Calibrar
  ├── limpieza de la clave v5 a 30 días [GAP→añadido]      ├── [GAP→añadido] cota < 300 px: se pide otra
  └── validar sin destruir: A0 ante fixture A1             └── [GAP→añadido] escala 1:5 000 000 o rara: confirmación
        [GAP→añadido] round-trip de lo opaco
[+] A1 · concreta-planos (IDB propio)                    [+] Restar
  ├── marcar no reescribe bytes [GAP→añadido]              └── [GAP→añadido] deshabilitado sin E12
  ├── meta sin huellas → leer sobre [GAP→añadido]
  ├── adjuntar en B + Liberar en A [GAP→añadido] [→E2E]
  └── restauración con token + adopción [GAP→añadido]
[+] core · formaId y pegar
  ├── duplicar/pegar/mover/añadir [GAP→añadido]
  └── pegar en otra forma quita origen [GAP→añadido]
[+] .zip · contrato común de topes [GAP→añadido] (exportar e importar)

COVERAGE (de esta pasada): 24 rutas nuevas, todas con test previsto; 3 E2E; 0 eval.
Regresión: saveActiveObra/metaOf (el índice actual, registry.test.ts), reloadToLatest (appVersion.test.ts),
ProjectBackup (.json). Se conserva el camino feliz; los cambios intencionados son no perder la meta y no dar éxito falso.
```

- Plan de pruebas actualizado en disco (ver abajo).
- Sin LLM en el alcance.

#### Sección 4 · Rendimiento (cambios)

1. **[P2] (7/10) Zoom en CAD pesado:** repintar una región recorre toda la página. Remedio: presupuesto de zoom en la puerta y la imagen escalada mientras tanto.
2. **[P2] (7/10) Comparar y escribir:** leer el sobre entero en cada guardado. Remedio: una clave pequeña de versión por obra en la misma transacción.
3. **[P3] (6/10) Miles de líneas con `origen`** engordan el sobre (se clona entero en cada ráfaga). Remedio: medirlo en el dogfood; los puntos ya van redondeados.

#### Modos de fallo (actualización)

| Ruta | Fallo realista | Test | Manejo | Lo ve el usuario |
|---|---|---|---|---|
| Pestaña pre-Etapa-0 abierta semanas | pisa la obra v6 | añadido | espacio `concreta6.*` + aviso | antes SILENCIOSO → **gap crítico** (cerrado) |
| `saveObra` rechazado | bloquea el guardado de todas las obras | añadido | `version-conflict` terminal | antes silencioso → **gap crítico** (cerrado) |
| Autosave tras exportar | borra `ultimaCopia` | añadido | meta fusionada | antes silencioso (aviso falso) → **gap crítico** (cerrado) |
| A0 carga datos de A1 | los borra y guarda | añadido | validar sin destruir | antes silencioso → cerrado |
| Adjuntar en B, liberar en A | borra un PDF en uso | añadido | «desconocido», 24 h, lock o canal | se ve como «no disponible» → cerrado |
| «Actualizar» con volcado fallido | recarga y pierde cambios | añadido | no recarga y lo dice | antes silencioso → cerrado |

**Gaps críticos nuevos: 3** (pestaña antigua, cola bloqueada y `ultimaCopia`), cerrados en el bloque de ingeniería.

#### NOT in scope (segunda pasada)
- A0 aún más pequeño (solo Longitud y Superficie): lo propone solo Claude M4 y choca con tu D5; no se aplica.
- Protocolo automático de borrado entre pestañas: sigue en TODOS (P3); «Liberar espacio» es manual.
- Prototipo de `trazados` (Claude M6): antes de la Etapa B, no en A0 ni en A1.

#### What already exists (segunda pasada)
- `versionFile` en `vite.config.ts`: patrón para copiar los assets de pdf.js sin dependencia nueva.
- `serializeOp` en `sync.ts`: la cola de operaciones de obra en la que entra la restauración.
- `compatibilidad()` en `medPaste.ts`: decide cuándo pegar quita `origen`.
- `claimObra` (T-19): el traspaso que se corrige.
- `reloadToLatest` con `beforeReload`: el punto donde se corta la recarga si el volcado falla.

#### Paralelización (actualizada)

| Paso | Módulos | Depende de |
|---|---|---|
| E0 Etapa 0 (compatibilidad, copia, lateral, guardados fallidos) | persist/, update/, store/, App | — |
| X0 Especificación canónica y contrato de lo que se guarda | docs/ | — |
| E1 Núcleo puro | core/ | X0 |
| E6 Adaptador y fixtures | features/planos (adaptador), src/test/ | X0 |
| A0 v6 (espacio `concreta6.*`, validar, acciones) | persist/, store/ | E0 publicado, X0 |
| A0 visor | features/planos, features/presupuesto | E1, E6, A0 v6 |
| Puerta | docs/spike/ | A0 |
| A1 (almacén IDB propio, .zip, recálculo…) | persist/, store/, features/planos | Puerta |

- Carriles: E0 y X0 en paralelo; tras X0, E1 y E6 en paralelo; A0 v6 espera a que E0 esté publicado.
- Todo es secuencial desde A0 v6 hasta la puerta.

#### Implementation Tasks (ingeniería, segunda pasada)
Se mantienen E0–E12 con estos cambios de alcance:
- E0 suma el recordatorio de copia, la meta fusionada, el rechazo terminal y los guardados fallidos.
- E2 y E5 pasan a A1.

Nuevas:
- [ ] **E13 (P1, human: ~1d / CC: ~45min)** — persist — Espacio de claves `concreta6.*`: migración única, copia v5 en la clave antigua, aviso de cambios antiguos y limpieza a 30 días
  - Surfaced by: segunda pasada, Codex #1 (crítico) y Claude H1
  - Files: src/persist/persist.ts, src/persist/registry.ts, src/persist/sync.ts
  - Verify: test de pestaña antigua con traspaso tras migrar
- [ ] **E14 (P1, human: ~4h / CC: ~25min)** — schema — Validar sin destruir (opaco, `_ilegible`), regla de versión, topes al importar .json y claves de página
  - Surfaced by: Claude H1, L3 y seguridad
  - Files: src/persist/persist.ts, src/store/schema.ts
  - Verify: lector A0 ante un fixture A1, de ida y vuelta
- [ ] **E15 (P1, human: ~4h / CC: ~25min)** — persist — Etapa 0: `version-conflict` terminal, dueño solo tras recarga `ok`, más-nueva antes que `isObraData` en todas las rutas, meta fusionada, importar y «Actualizar» sin éxito falso
  - Surfaced by: Claude M1 y H3; Codex #2, #3 y #4
  - Files: src/persist/persist.ts, src/persist/sync.ts, src/persist/registry.ts, src/features/obra/ProjectBackup.tsx, src/update/appVersion.ts
  - Verify: `npx vitest run src/persist src/update`
- [ ] **E16 (P1, human: ~4h / CC: ~25min)** — ui — Recordatorio de copia (`ultimaCopia`, «Última copia descargada», 7 días)
  - Surfaced by: D4 (reto 1)
  - Files: src/features/obra/ProjectBackup.tsx, src/persist/registry.ts, src/layout/TopBar.tsx
  - Verify: tests de 6 y 8 días; la fecha sobrevive al autosave
- [ ] **E17 (P1, human: ~1d / CC: ~45min)** — persist — Módulo IDB propio `concreta-planos` (`meta` + `bytes`) ya en A0, y en A1 el protocolo de «Liberar espacio» (desconocido ≠ vacío, `huellasDe`, 24 h, lock o `BroadcastChannel`)
  - Surfaced by: Claude H2 y M2; Codex #5
  - Files: src/persist/planos.ts, src/persist/registry.ts
  - Verify: marcar no reescribe `bytes` (A0); adjuntar en B y liberar en A conserva el PDF (A1)
- [ ] **E18 (P2, human: ~3h / CC: ~20min)** — transfer — Contrato común de topes al exportar e importar, token por restauración y restauración en `serializeOp`
  - Surfaced by: Codex #6 y #7; Claude L4
  - Files: src/persist/transfer.ts, src/features/obra/ProjectBackup.tsx
  - Verify: tests de topes en los dos sentidos; restauración con adopción concurrente (A1)
- [ ] **E19 (P1, human: ~3h / CC: ~20min)** — planos — Precisión de calibración en A0: cruz y lupa, cota ≥ 300 px, plausibilidad de la escala; tolerancias de la puerta por magnitud
  - Surfaced by: Claude M3; Codex #10
  - Files: src/features/planos/CalibrarPasos.tsx, src/core/planoGeom.ts, docs/spike/03-planos-cronometrado.md
  - Verify: tests de precisión y plausibilidad; documento de la puerta con referencias
- [ ] **E20 (P2, human: ~2h / CC: ~15min)** — core — `formaId` en las llamadas, pegar en otra forma quita `origen`, X0 con contrato de lo que se guarda y fixtures JSON
  - Surfaced by: Claude L1, L2, L5 y M5
  - Files: src/core/medPaste.ts, src/store/slices/estructuraSlice.ts, docs/plan-medir-planos-pdf.md
  - Verify: tests de las cuatro rutas de `formaId`

#### Completion Summary (ingeniería, segunda pasada)
- Step 0: Scope Challenge: scope accepted as-is (D4 y D5 del usuario); Claude M4 anotado y no aplicado.
- Architecture Review: 6 issues found
- Code Quality Review: 5 issues found
- Test Review: diagram produced, 24 gaps identified (todos añadidos)
- Performance Review: 3 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items nuevos (el borrado automático ya estaba)
- Failure modes: 3 critical gaps flagged (cerrados por el bloque eng)
- Unresolved decisions: 3 (T9, T10 y T11 siguen en la aprobación final; T11 ya tiene una opción segura por defecto)
- Outside voice: codex, completed (10 findings); native subagent completed (14 findings + seguridad)
- Parallelization: 3 lanes al principio (E0, X0, luego E1 y E6); secuencial desde A0 v6
- Lake Score: 8/8 (se tomó la opción completa en cada elección de cobertura)

<!-- AUTONOMOUS DECISION LOG -->
### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Modo SELECTIVE EXPANSION | Mechanical | regla autoplan | Capacidad nueva sobre producto existente | EXPANSION, HOLD |
| 2 | CEO | Enfoque C (B + corrección y reuso) | Mechanical | P1 | Mayor completitud; las añadidas evitan dinero silencioso | A (5/10), B (8/10), D (DWG) |
| 3 | CEO | Aceptar escala leída del PDF (#1) | Mechanical | P2 | En radio, < 1 día | — |
| 4 | CEO | Aceptar comentario desde el texto (#2) | Mechanical | P2 | En radio, < 1 día | — |
| 5 | CEO | Aceptar una forma, varias partidas (#3) | Taste | P1 | Multiplicador de dominio, pero amplía el concepto | Aplazar a TODOS |
| 6 | CEO | Capa de obra, editar vértices y .zip en Etapa B (#4-6) | Mechanical | P2 | Ya estaban en el borrador como Etapa B | — |
| 7 | CEO | Aplazar imán, escalas por zona, plano marcado, certificar sobre plano y contar símbolos (#7-10, #13) | Mechanical | P3 | Fuera del radio o > 1 día | Incluir |
| 8 | CEO | PNG/JPG como plano (#11) | Mechanical | P2 | S, mismo adaptador | — |
| 9 | CEO | Descartar medición con IA (#12) | Mechanical | P3 | Proyecto aparte | Aplazar |
| 10 | CEO | Perímetro y paramento en la tabla (#14) | Mechanical | P1 | Corrige una premisa (P4) | — |
| 11 | CEO | Recalcular al cambiar la escala (#15) | Mechanical | P1 | Corrige una premisa falsa (P8) | — |
| 12 | CEO | Esquema v6 obligatorio | Mechanical | P5 | Una versión vieja debe rechazar, no borrar `planos` | Campo opcional sin subir versión |
| 13 | CEO | Revisión de especificación: aplicar los 12 hallazgos de la iteración 1 (casillas ×1, `origen` sin magnitud, `lineaParaDestino`, `loadObra`, etapas, tabla, teclado) | Mechanical | P1 | Errores de dinero o de contrato verificados en el código | Dejarlos como riesgos |
| 14 | CEO | Mover #3 y PNG/JPG a Etapa B; PNG/JPG pasa a esfuerzo M | Mechanical | P5 | #3 depende de la capa de toda la obra; las imágenes necesitan píxeles, EXIF y reducción | Mantener en Etapa A |
| 15 | CEO | Aplicar los 10 hallazgos de la iteración 2 (escala sin comprobar, `uds` y redondeo, columnas de la forma, precedencia del kg/m, acciones atómicas, huérfanos y Deshacer, bytes en vez de Blob) | Mechanical | P1 | Contratos que faltaban para que el recálculo y las pruebas sean posibles | — |
| 16 | CEO | Editar vértices: ofrecer «Aplicar también a N líneas» a las que comparten forma | Taste | P1 | Evita que Solado, Rodapié y Pintura de la misma estancia se desincronicen; amplía #5 | Editar solo su línea y marcar las demás |
| 17 | CEO | Quitar la opción de forzar una escala con desviación > 1 % | Mechanical | P5 | Contradecía la decisión #1 y dejaba dinero sin rastro | Forzar con marca por línea |
| 18 | CEO | Aplicar los 9 hallazgos de la iteración 3 (entrada de geometría, «Volver a medir», Supr, recálculo con «No» por defecto, borrado de blobs solo por la limpieza, guarda de varias partidas con `expect`, `sha256` puro) | Mechanical | P1 | Correcciones directas; el bucle llegó a su tope de 3 | Dejarlos como Reviewer Concerns sin corregir |
| 19 | CEO | Aprobar los documentos de 0H (plan y resumen CEO) | Mechanical | P6 | Reflejan las decisiones; lo pendiente está en Reviewer Concerns | Revisar otra vez |
| 20 | CEO | UC1 (las dos voces): hacer antes documentos y recordatorio de copia, o validar la demanda | User Challenge | — | Cambia la dirección del usuario: al gate, sin decidir | — |
| 21 | CEO | Etapa A acotada + puerta cronometrada (dogfood como el spike §0.5) | Mechanical | P1 | Las dos voces coinciden; el repo ya usó ese patrón como puerta | Etapa A ancha sin puerta |
| 22 | CEO | Calibración única (dos puntos + cota); cajetín como comprobación con ajuste < 1 % | Mechanical | P5 | Las dos voces: el atajo 1:N era redundante con la cota obligatoria | Tres modos de calibrar |
| 23 | CEO | «Añadir también a…» en la Etapa A con `formaId` explícito | Taste | P1 | Las dos voces: el mayor ahorro; Codex: identidad explícita, no coordenadas | Etapa B con igualdad de coordenadas |
| 24 | CEO | .zip con planos en la Etapa A | Mechanical | P1 | Codex (crítico): la copia debe restaurar la obra entera | Etapa B |
| 25 | CEO | Recalcular salta las certificadas y las lista | Mechanical | P5 | Claude: más simple que una guarda nueva para varias partidas; no cambia dinero en silencio | Guarda de varias partidas |
| 26 | CEO | Almacén persistente + .zip en vez de caché con reenlace | Taste | P1 | Copia completa (Codex) frente a menos código (Claude) | Caché de PDF |
| 27 | CEO | Revisión mínima de un plano (`sustituye`, `revision`); comparar revisiones a TODOS | Mechanical | P2 | Codex; S y en el radio | Sin revisiones |
| 28 | CEO | Imán como lo primero de la Etapa B; trazados ya en el adaptador | Taste | P2 | Claude: precisión y velocidad; > 1 día pero detrás de la puerta | Dejarlo en TODOS |
| 29 | CEO | Plano marcado para la DF sigue en TODOS (P2) | Taste | P3 | Codex lo pide en la primera entrega; es L y otra superficie de salida | Etapa B |
| 30 | CEO | Descartar `origen.fuente` para formas de IA | Mechanical | P5 | Especulativo | Añadir el campo |
| 31 | CEO | Tareas T1-T8 (diagramas, adaptador, fixtures PDF, .zip, duplicados, aside, puerta, prueba tras publicar) | Mechanical | P2 | Hallazgos de las secciones 1-11 | — |
| 32 | Design | Sin maquetas dentro de autoplan (su tablero es interactivo); `/design-shotgun` tras aprobar | Mechanical | P6 | autoplan reserva las decisiones del usuario al gate; mismo criterio que el plan de líneas | Generar variantes |
| 33 | Design | Disposición: ancho propio, split por anchos útiles, cabecera/aviso/franja con 4 estados, selector de partida en el visor | Mechanical | P5 | Las dos voces (C1/H1, Codex #1) | Heredar el hueco 320–640 |
| 34 | Design | Ciclo de medida con vista previa, CREADA, foco retenido e inserción que avanza | Mechanical | P1 | Las dos voces (C2/H3, Codex #3): dinero visible y orden correcto | Reusar `requestFocus` de `medLineOps` |
| 35 | Design | Calibrar en el lienzo con lupa, puntos arrastrables y rehacer parcial | Mechanical | P1 | C3: sin ayudas, el 1 % falla con regularidad | Modal `CalibrarDialog` |
| 36 | Design | Una sola escala por página; Cancelar por defecto al cambiarla (sustituye el flujo de detalle del bloque CEO) | Taste | P1 | Codex #2: una página «calibrada» con dos escalas engaña | Mantener «solo cambia la escala para lo que mida ahora» |
| 37 | Design | Tablet de solo ver en la Etapa A; medir con el dedo en la B; barra [Terminar] [Deshacer punto] [Cancelar] ya en la A | Taste | P3 | Las dos voces ven la tablet rota; la A ya se acotó | Controles táctiles completos en la A |
| 38 | Design | Rectángulo por 3 clics (arista + anchura) | Taste | P1 | Estancias giradas (M6) | 2 esquinas alineadas |
| 39 | Design | Lenguaje de la capa sin rojo para Restar; ✎ warn para retocada; halos; insignias fijas | Mechanical | P5 | DESIGN.md: rojo = error/destructivo (H5, Codex #7) | Rojo discontinuo |
| 40 | Design | Marcador de origen con popover en la línea (sustituye «lo decide diseño») | Mechanical | P1 | Las dos voces: la procedencia es la promesa central | Detalles solo en el visor |
| 41 | Design | Hoja «Añadir a N partidas», todo o nada | Mechanical | P1 | Las dos voces (M4, Codex #8) | Lista de recientes sin revisión |
| 42 | Design | Un solo Esc descarta en el comentario; Retroceso/Ctrl+Z nativos dentro del campo (sustituye el doble Esc CEO) | Mechanical | P5 | M3 + Codex #5 | Doble Esc y teclas interceptadas |
| 43 | Design | Borradores que sobreviven a cambios de contexto (sustituye «descarta con aviso») | Mechanical | P1 | Las dos voces (M10, Codex #9) | Descartar al cambiar |
| 44 | Design | Estados y vacíos de la tabla del Pase 2; reenlazar con huella distinta → revisión | Mechanical | P1 | Las dos voces (§2, H7, Codex #6) | — |
| 45 | Design | Entrada de puntos por teclado, atajos de una tecla, ARIA | Mechanical | P1 | Codex #5, M7, M12 | Solo contención de teclas |
| 46 | Design | Copia completa con planos como acción principal | Mechanical | P1 | Codex #10, M11 | Dos formatos al mismo nivel |
| 47 | Design | Tareas D1-D10 | Mechanical | P2 | Hallazgos de los pases | — |
| 48 | DX | Modo DX POLISH; persona: desarrollador-propietario + agente; tipo: módulos internos | Mechanical | P6 | Regla de autoplan (mejora de producto existente) y el README | DX EXPANSION |
| 49 | DX | Objetivo TTHW Competitive (< 3 min desde `npm run dev`) con sandbox «Planos (ejemplo)» | Mechanical | P5 | `#sandbox` ya existe; vehículo de menor esfuerzo | Ejemplo para el usuario final (→ TODOS) |
| 50 | DX | Especificación canónica antes de codificar (tarea X0) | Mechanical | P5 | Las dos voces: el plan en capas obliga a fusionar a mano | Implementar desde las capas |
| 51 | DX | Interfaz exacta `DocPdf` + doble + tests de contrato | Mechanical | P5 | Las dos voces | Esbozo actual |
| 52 | DX | `OrigenPlano` como unión discriminada con `slots`, `fijas`, `factor`, `at`; unidades fijadas | Mechanical | P1 | Las dos voces: sin esto el recálculo no sabe dónde escribir | — |
| 53 | DX | Nombres del store en inglés (convención) y objeto de opciones; `addPlanoLines` por lotes | Mechanical | P5 | Consistencia del store; Codex #3 (todo o nada) | Nombres en castellano del bloque CEO |
| 54 | DX | El cajetín cuenta como comprobación si cuadra < 1 %; partida L×A vacía pasa a Sup. directa sin preguntar | Taste | P5 | Claude (fricción en cada página y en el caso m²); cambia decisiones de diseño/CEO | Comprobación manual siempre; preguntar siempre |
| 55 | DX | Almacén de bytes por huella (sha256) | Mechanical | P4 | Deduplica, simplifica reenlazar y la limpieza entre obras | Clave = planoId |
| 56 | DX | Coordinador de adjuntar y restaurar entre dos almacenes | Mechanical | P1 | Codex #6: sin transacción común | — |
| 57 | DX | Validación de v6 por elementos; copia v5 antes de migrar; constante `PLANOS_VISOR` para rollback | Mechanical | P1 | Codex #7 y #9 | Solo rechazo de versión |
| 58 | DX | pdf.js con versión exacta y test de versión del worker | Mechanical | P5 | Error típico «API version does not match Worker version» | Rango ^ |
| 59 | DX | Frontera de errores local del visor | Mechanical | P1 | Claude §3 | Solo `AppErrorBoundary` |
| 60 | DX | Salidas: ajustada reversible, «Usar este PDF para este plano», aceptar/desvincular retocada, adjuntar otra vez | Mechanical | P1 | Claude §5 | — |
| 61 | DX | Atajos sin choques (Restar = D, Intro coloca punto, Esc por estado) | Mechanical | P5 | Las dos voces | Lista del bloque de diseño |
| 62 | DX | Tope del .zip calculado del contenido | Mechanical | P5 | Claude §5 | 500 MB fijos |
| 63 | DX | Tareas X0-X8 y TODO P3 «Probar con un plano de ejemplo» | Mechanical | P2/P3 | Hallazgos de los pases | — |
| 64 | Eng | Alcance aceptado tal cual; estructura original con secuencia por commits | Mechanical | P2/P5 | Ninguna disposición menor conserva los contratos aprobados | Reducir alcance |
| 65 | Eng | UC2 (las dos voces): partir la Etapa A en A0 (hasta la puerta) y A1 | User Challenge | — | Cambio de alcance en el que coinciden las dos voces: al gate, sin aplicar | — |
| 66 | Eng | Etapa 0: release de compatibilidad (`mas-nueva`, traspaso seguro, `saveObra` sin pisar) antes de v6 | Mechanical | P1 | Las dos voces; verificado en `sync.ts:175-178` y `registry.ts:87-94` | Confiar en la constante de compilación |
| 67 | Eng | Copia v5 bajo `concreta.recovery.v5.*` | Mechanical | P5 | Con el prefijo de obra, `reconcile` la listaría | `concreta.obra.*` |
| 68 | Eng | Validar v6 limpiando entradas malas en vez de rechazar la obra | Mechanical | P1 | Claude E4: la recuperación solo ofrece exportar o descartar | Rechazo estructural |
| 69 | Eng | Sin borrado automático de PDF en la Etapa A; «Liberar espacio» con lock y relectura; índice `huellas` | Mechanical | P5 | Las dos voces: carreras entre pestañas y aborto permanente | Limpieza automática a 7 días |
| 70 | Eng | `quitado` en vez de borrar el metadato; `origen.huella` | Mechanical | P1 | Las dos voces: procedencia de líneas medidas y certificadas | Borrar el metadato |
| 71 | Eng | `Escala.rev` + `origen.calRev`; todo cambio de escala con líneas por `rescalePlanoPage` | Mechanical | P5 | Igualdad de floats y rutas de cambio sin definir (Claude E6, Codex C4) | Comparar `mPorUnidad` |
| 72 | Eng | `expect` por operación con repreparación dentro del `set` | Mechanical | P1 | Codex C4 | Solo ids y valores |
| 73 | Eng | `formaId` = geometría inmutable; «Volver a medir» da `formaId` nuevo | Mechanical | P5 | Las dos voces (C11, E6) | Misma identidad con geometrías distintas |
| 74 | Eng | «Aceptar valores actuales» marca `aceptada` y la saca del recálculo | Mechanical | P1 | Codex C2: si no, el recálculo pisa la corrección | Reescribir `valores` |
| 75 | Eng | Primera medida en partida con cantidad fija: «fija → medida» visible con Deshacer | Mechanical | P1 | Codex C5; mismo patrón que el pegado | Preguntar siempre |
| 76 | Eng | .zip con topes absolutos contados al descomprimir; huella calculada; duplicados fuera; nivel 0; exportar por partes | Mechanical | P1 | Las dos voces (C8, E8); sustituye el tope calculado del contenido | Tope derivado de lo declarado |
| 77 | Eng | Restaurar por etapas y arreglar `ProjectBackup` (ignora `flushPending` falso) | Mechanical | P1 | Codex C7; fallo existente verificado | Anunciar éxito sin guardar |
| 78 | Eng | Adaptador con `vista`, apertura cancelable y generaciones; bytes releídos | Mechanical | P1 | Codex C9, C12; Claude E9 | Interfaz DX sin caja ni cancelación |
| 79 | Eng | Assets de pdf.js en dist, build legacy o navegador mínimo, rueda no pasiva, lienzos liberados, hash en worker | Mechanical | P1 | Claude E9, E19 | — |
| 80 | Eng | Visor de solo ver en pestañas de solo lectura | Mechanical | P1 | Claude E7; mismo patrón que el asistente | Permitir medir sin guardar |
| 81 | Eng | Interruptor en tiempo de ejecución en vez de `PLANOS_VISOR` de compilación | Mechanical | P3 | Claude E16: cada push despliega; dogfood en la app publicada | Constante de compilación |
| 82 | Eng | Defensa de teclado (`[data-planos-viewer]`, `role="dialog"` solo en modales, `isComposing`) | Mechanical | P1 | Claude E11; verificado en `useAppHotkeys.ts:77-86` | Solo `stopPropagation` |
| 83 | Eng | Reductor puro `core/planoCiclo.ts` | Mechanical | P5 | Claude E13: la parte más difícil de probar | Estado en componentes |
| 84 | Eng | .bc3 con 4 decimales; un formateador de `expr` | Mechanical | P1 | Claude E10; `num()` ya quita ceros (sin regresión) | 3 decimales |
| 85 | Eng | Columna del marcador fuera de la rejilla y del TSV; Restar por el signo de `uds`; acciones nombradas | Mechanical | P5 | Claude E14, E15, E20 | — |
| 86 | Eng | Contradicciones cerradas (destino, fijas, rueda, clave, `tamano`) | Mechanical | P5 | Claude E6 | Dejarlas a la especificación |
| 87 | Eng | Puerta con tolerancias (±1 % / ±2 cm por línea, ±0,5 % por partida) y presupuesto de pintado | Mechanical | P1 | Codex C14, Claude E9 | «Dentro de la tolerancia» sin número |
| 88 | Eng | T9: el cajetín cuenta como comprobación (DX) frente a solo avisar (Codex C10) | Taste | P5 | Codex discute con motivo una decisión DX aceptada | — |
| 89 | Eng | T10: «Usar este PDF para este plano» con historial de huellas frente a solo revisión nueva (Codex C3) | Taste | P1 | Codex discute con motivo una decisión DX aceptada | — |
| 90 | Eng | T11: certificación por líneas con signo antes de Restar (Codex C1, crítico de una voz) | Taste | P1 | Cambia la semántica de un documento de cobro | — |
| 91 | Eng | Comprobación a > 45° cuando se pueda; aviso de cert > 100 % al recalcular | Mechanical | P1 | Claude E17, E18 | — |
| 92 | Eng | Plan de pruebas (30 huecos añadidos), TODOS de todas las fases y tareas E0-E12 | Mechanical | P1/P2 | Secciones 1-4 | — |
| 93 | Gate | D3 = B2: resolver los retos uno a uno | User decision | — | Respuesta del usuario en la aprobación final | A, B, C/D/E |
| 94 | Gate | D4 (reto 1) = B: recordatorio de copia en la Etapa 0 y después planos | User decision | — | Respuesta del usuario; documentos siguen en TODOS | Planos primero, documentos antes, validar demanda |
| 95 | Gate | D5 (reto 2) = A: Etapa A partida en A0 → puerta → A1 | User decision | — | Respuesta del usuario | Etapa A entera |
| 96 | Eng 2 | Segunda pasada de ingeniería con punto de control nuevo y entrada revisada (`amend-input`) con D4 y D5 | Mechanical | P6 | Regla B2 de autoplan: repetir ingeniería antes de volver a la aprobación | Revisar la entrada sin las decisiones |
| 97 | Eng 2 | Espacio de claves `concreta6.*` con copia v5 en la clave antigua y aviso de cambios antiguos | Mechanical | P1 | Codex #1 (crítico) + Claude H1/M1: el tiempo no protege de pestañas antiguas | Esperar una semana; `concreta.recovery.v5.*` |
| 98 | Eng 2 | `saveObra` con `version-conflict` terminal; dueño solo tras recarga `ok`; más-nueva antes que `isObraData` en todas las rutas | Mechanical | P1 | Las dos voces; verificado en `persist.ts:131-156` y `sync.ts:170-189` | Rechazo sin salida de la cola |
| 99 | Eng 2 | Guardados fallidos (importar .json y «Actualizar») en la Etapa 0 | Mechanical | P1 | Codex #4 + Claude L4; verificado en `appVersion.ts:101-121` | Dejarlo en A1 |
| 100 | Eng 2 | Meta fusionada (`ultimaCopia`, `huellas`, `kind`); «Última copia descargada»; fecha a cero al importar, crear o borrar | Mechanical | P1 | Las dos voces (H3, Codex #3); verificado en `registry.ts:258-292` | Añadir el campo sin más |
| 101 | Eng 2 | Validar sin destruir (opaco, `_ilegible`) y regla de versión al ampliar formas | Mechanical | P1 | Claude H1: A0 borraría datos de A1 | Limpiar quitando |
| 102 | Eng 2 | Módulo IDB propio `concreta-planos` con `meta` y `bytes` | Mechanical | P5 | Claude M2: idb-keyval reescribe los bytes y tiene un solo almacén | idb-keyval |
| 103 | Eng 2 | Protocolo de «Liberar espacio»: desconocido ≠ vacío, `huellasDe`, 24 h, lock compartido/exclusivo o `BroadcastChannel` | Mechanical | P1 | Las dos voces (H2, Codex #5) | Confiar en el índice |
| 104 | Eng 2 | Token por restauración; restauración en `serializeOp`; instantánea en memoria de la obra anterior | Mechanical | P1 | Codex #6 + Claude L4 | Retirar todo lo nuevo |
| 105 | Eng 2 | Contrato común de topes al exportar e importar; adjuntar rechaza > 500 MB | Mechanical | P5 | Codex #7 | Solo topes al importar |
| 106 | Eng 2 | Restar en A0 solo con E12; si T11 no la aprueba, Restar deshabilitado | Mechanical | P1 | Codex #8: condición segura por defecto; T11 sigue en la aprobación final | «Detrás de T11» sin más |
| 107 | Eng 2 | Cruz y lupa en A0; cota ≥ 300 px; plausibilidad de la escala | Mechanical | P1 | Claude M3: sin ellas la tolerancia no se cumple | Dejarlas en el bloque de diseño sin etapa |
| 108 | Eng 2 | Puerta con tolerancias por magnitud, referencias previas, orden cruzado y presupuesto de zoom | Mechanical | P1 | Las dos voces (M3, Codex #10) | ±1 % o ±2 cm sin más |
| 109 | Eng 2 | Assets de pdf.js con plugin propio; worker legacy con test de ruta; `enableXfa: false`; texto del PDF sin `innerHTML` | Mechanical | P5 | Claude M6 y seguridad | Dependencia nueva de copia |
| 110 | Eng 2 | `formaId` nace en las llamadas; pegar en otra forma quita `origen`; claves de página validadas; topes al importar .json | Mechanical | P5 | Claude L1-L3 y seguridad | — |
| 111 | Eng 2 | X0 como puerta dura con contrato de lo que se guarda y fixtures; lector y escritor v6 en un commit | Mechanical | P5 | Claude M5, L5 | Tipos sin congelar |
| 112 | Eng 2 | No reabrir D5 para un A0 aún más pequeño (Claude M4) | Mechanical | P2 | Una sola voz contra una decisión del usuario | Solo Longitud y Superficie en A0 |
| 113 | Eng 2 | T10: el contrato de las líneas antiguas (huella de `origen` manda en «Ver en plano» y cuenta como referencia) se añade a la opción recomendada | Mechanical | P1 | Codex #9; la decisión T10 sigue en la aprobación final | — |
| 114 | Eng 2 | Tareas E13-E20, plan de pruebas actualizado | Mechanical | P1/P2 | Hallazgos de la segunda pasada | — |
| 115 | Gate | D6 = A: plan aprobado tal cual | User decision | — | Respuesta del usuario en la aprobación final, tras la segunda pasada de ingeniería | B, C/D/E |
| 116 | Gate | Elecciones de criterio 1-12 con su opción recomendada (T9 cajetín como comprobación; T10 reenlazar con historial de huellas; T11 certificación con signo antes de Restar, tarea E12) | User decision | — | Aprobadas con D6 = A | Las alternativas descritas en la aprobación final |

### Aprobación (2026-09-25)

**Estado: APROBADO** con D6 = A (aprobar tal cual), tras D3 = B2, D4 = B y D5 = A.

- **Orden de trabajo:**
  1. Etapa 0: compatibilidad, recordatorio de copia, guardados fallidos y hueco lateral único. Se publica sola.
  2. X0: especificación canónica con el contrato de lo que se guarda. Es puerta dura.
  3. A0, en el espacio de claves `concreta6.*`.
  4. Puerta cronometrada (`docs/spike/03-planos-cronometrado.md`).
  5. A1.
  6. Etapa B.
- **Elecciones de criterio aprobadas (1-12):**
  - 1: «Añadir también a…», en A1.
  - 2: «Aplicar también a N líneas» al editar vértices, en la Etapa B.
  - 3: almacén persistente con .zip.
  - 4: imán primero en la Etapa B.
  - 5: plano marcado para la DF en TODOS.
  - 6: una escala por página, con Cancelar por defecto.
  - 7: tablet de solo ver en la Etapa A.
  - 8: rectángulo por 3 clics.
  - 9: partida L×A vacía pasa a Superficie directa sin preguntar.
  - 10 (T9): el cajetín cuenta como comprobación si cuadra a < 1 %, en A1.
  - 11 (T10): «Usar este PDF para este plano» con historial de huellas. La huella de `origen` manda en «Ver en plano» y cuenta como referencia.
  - 12 (T11): certificación por líneas con signo (E12) antes de habilitar Restar.
- **Siguiente paso:** implementar la Etapa 0 (tareas E0, E1, E15 y E16) y escribir X0 antes de la primera línea de A0.
- **Etapa 0 implementada (2026-09-25), pendiente de publicar.** Clave de versión por obra `concreta.version.<id>`; `newObra` también deja de sustituir una obra sin guardar; `lateral: 'ref' | 'asistente' | null` (A0 añade `'planos'`). Tests con el fixture v7 en `persist/sync.etapa0.test.ts`. Siguiente: publicarla sola y escribir X0.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` (via /autoplan) | Scope & strategy | 2 | CLEAR (PLAN via /autoplan) | 15 proposals, 9 accepted, 5 deferred; UC1 resuelto por el usuario (D4 = B) |
| Outside Review | codex (via /autoplan, prompt por stdin) | Independent 2nd opinion | 5 | completed | CEO 9, diseño 10, DX 11, ingeniería 14 + 10 |
| Eng Review | `/plan-eng-review` (via /autoplan) | Architecture & tests (required) | 3 | ISSUES OPEN (PLAN via /autoplan) | 89 issues (51 en la primera pasada + 38 en la segunda), 6 critical gaps, todos cerrados en el plan y convertidos en tareas E0-E20 |
| Design Review | `/plan-design-review` (via /autoplan) | UI/UX gaps | 2 | CLEAR (FULL via /autoplan) | score: 3/10 → 8/10, 16 decisions |
| DX Review | `/plan-devex-review` (via /autoplan) | Developer experience gaps | 1 | CLEAR (PLAN via /autoplan) | score: 3/10 → 5/10, TTHW: ~10 min → < 3 min |

- **OUTSIDE COVERAGE:** codex completed en las cinco pasadas (CEO, diseño, DX e ingeniería dos veces); desde la fase de diseño, con el prompt por stdin (supera los 32 KB de la línea de órdenes de Windows). El subagente Claude nativo también se completó en todas, con INPUT coincidente con su instantánea.
- **CROSS-MODEL:** consenso nativo + externo:
  - CEO: 6/6 confirmadas, 1 desacuerdo (caché o persistente → elección 3);
  - diseño: 4/8 confirmadas, 1 desacuerdo;
  - DX: 5/6 confirmadas (1 N/A);
  - ingeniería 1: 6/6 confirmadas;
  - ingeniería 2: 5/6 confirmadas (rendimiento, solo Claude).
  Los retos en los que coincidían las dos voces (UC1 y UC2) los resolvió el usuario. No se infiere familia de modelo más allá del proveedor registrado.
- **VERDICT:** CEO + DISEÑO + DX CLEAR. Ingeniería con ISSUES OPEN: los hallazgos son trabajo mapeado en tareas (E0-E20), no fallos pendientes del plan. Eng review required: la puerta de ingeniería vuelve a aplicarse al código antes de /ship.

NO UNRESOLVED DECISIONS
