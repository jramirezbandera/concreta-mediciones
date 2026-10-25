# Plan · Bases de precios oficiales con un botón

> Estado: HECHO (2026-10-24), E0–E4; quedan los TODOs D19 y D20. Revisado antes con
> `/plan-eng-review` (13 decisiones, D5–D18). Enfoque acordado con el usuario el 2026-10-24:
> no se precargan copias, se descargan de la web oficial al pulsar. Lo que cambió al
> implementar está en «Implementación»; el registro de la revisión, al final.

## Petición

«¿Qué otras bases de precios libres de España merece la pena incorporar? Podrían venir
precargadas, usarse con un botón.» Hoy Referencia arranca vacía (`REF_SOURCES = []` en
`src/core/refdata.ts`). Cada base se consigue a mano en la web del organismo, se descomprime y
se suelta en «Añadir base de referencia».

## Objetivo medible

- **BCCA y Extremadura con un clic:** de «Añadir base de referencia» a tener la base en el
  selector de Referencia, sin salir de la app ni descomprimir nada.
- **Las que no se pueden descargar desde la app, en dos pasos:** el botón abre la página
  oficial y la app dice qué fichero bajar y dónde soltarlo.
- **Cada base dice de dónde sale:** organismo, edición, enlace oficial y fecha de descarga, a la
  vista en Referencia.
- **Ninguna base dentro del repo ni del despliegue.**

## Lo que ha salido al explorar (2026-10-24)

| Base | Descarga | Desde la app (CORS) | Edición | Licencia |
|---|---|---|---|---|
| **BCCA**, Junta de Andalucía | ZIP directo, 625 KB, con un solo `BCCA2023_V02.bc3` de 4,4 MB: el mismo de `docs/spike/samples/`, que ya importa bien | Sí, `access-control-allow-origin: *` | V02, enero de 2024, la última | Sin confirmar que el CC BY del portal cubra la base |
| **Extremadura**, Junta de Extremadura | `.bc3` directo, 18,7 MB, sin registro | Sí: el servidor devuelve el `Origin` y `text/plain` | 2026, una al año | Aviso legal §7: solo «la descarga de dicho contenido y el uso privado»; distribuirla, prohibido sin autorización expresa |
| **Comunidad de Madrid** | Solo desde la aplicación `gestiona.comunidad.madrid/bdco_inter`, con formularios JSF; sin enlace fijo | No | 2024 | Sin encontrar |
| Galicia, BDCG del IGVS | La página `igvs.xunta.gal/base-datos-construccion` da 404 y `presupuesta.com` responde 403 | — | Dos al año (según BuildGets) | Sin encontrar |

Fuera, por desfasadas o de pago: País Vasco (con registro, sin calendario fijo), Castilla y
León (2015), IVE, BEDEC, Precio Centro y PREOC. CYPE ya entra partida a partida.

**Conclusión legal:** que la descargue el navegador del usuario desde la web oficial es «la
descarga y el uso privado» que permite Extremadura. Y usar sus precios en presupuestos para
clientes es justo el uso para el que se publica: su página dice en «Destinatarios» «Técnicos
redactores de proyectos de construcción y directores de obras, empresas promotoras y
constructoras, y todo tipo de usuarios, sean profesionales o no del sector» (leída el
2026-10-24). Lo que el aviso legal prohíbe es reproducirla o distribuirla: guardarla en el repo,
que es público, o servirla desde nuestro despliegue sería distribuirla. Por eso no se precarga.
Los correos de §6 piden confirmar por escrito el uso en presupuestos (R13, D18).

## Qué ya existe (reuso)

- **`ReferenciaImportModal`** (`src/features/importar/`) con `useBc3Parse().handleFile(file)`:
  parsea en un Web Worker y llama a `importObraAsReference(data)` (`src/persist/sync.ts`), que
  guarda la base como obra `kind: 'reference'` en IndexedDB. El botón nuevo acaba en ese mismo
  `handleFile` con un `File` construido a partir de la descarga.
- **`src/persist/zip.ts`** lee el ZIP por el directorio central, con un tope de lo
  descomprimido (`leerDirectorio`, `leerEntrada`). Sirve tal cual para el ZIP de la BCCA.
- **`ObraMeta`** (`src/persist/registry.ts`) es metadato fuera del dominio: el sitio para la
  fuente (organismo, edición, URL, fecha), sin tocar `ObraData` ni el esquema.
- **Reglas por código de banco** del estudio de residuos (`src/core/rcd/reglas.ts`, capítulos
  de demoliciones de la BCCA, Precio Centro y CYPE). Las bases nuevas necesitan aquí su entrada.

## Diseño

### 1. Catálogo, `src/core/basesOficiales.ts`

```ts
export interface BaseOficial {
  id: string;                 // 'bcca', 'extremadura', 'madrid'
  nombre: string;             // «Base de Costes de la Construcción de Andalucía»
  nombreCorto: string;        // «BCCA»: con edición y organismo, nombre de la referencia (D15)
  organismo: string;          // «Junta de Andalucía»
  edicion: string;            // «V02 · enero 2024»
  actualizada: string;        // fecha ISO de la edición publicada por el organismo (D16)
  pagina: string;             // página oficial (siempre)
  descarga?: {                // solo si se puede bajar desde la app
    url: string;
    formato: 'bc3' | 'zip';
    bytes: number;            // para la barra de progreso y el aviso de tamaño
  };
  condiciones: string;        // una línea, con enlace; Extremadura: «Publicada para redactores
                              // de proyectos y constructoras. Sin permiso para redistribuirla:
                              // se descarga de la web oficial» (D18)
  comprobada: string;         // fecha ISO de la última comprobación del enlace
}
export const BASES_OFICIALES: BaseOficial[];
```

Lo mantenemos nosotros a mano. Cuando sale una edición nueva, se cambian la URL y `edicion`
con un commit. `scripts/bases/comprobar.mjs` (R6, D10) hace un HEAD a cada `descarga.url` con
`Accept-Encoding: identity` (si no, Extremadura no da tamaño) y un `Origin` de prueba; compara
`Content-Length` con `bytes` y mira `Access-Control-Allow-Origin`. Avisa de 404, redirección,
tamaño distinto o CORS perdida, y sale con código distinto de 0 si algo cambia. Para las
entradas sin `descarga`, comprueba que `pagina` responde 200. Las URL se guardan sin el `?t=`
de caché del portal. Se lanza a mano, no en la CI, que no debe depender de webs ajenas.

### 2. Modal: «Bases oficiales» encima de la zona de soltar

Una fila por base: nombre, organismo y edición, tamaño, condiciones en una línea y un botón.

- **Con `descarga`:** «Descargar y añadir». `fetch` con barra de progreso, leída en flujo
  sobre el `bytes` del catálogo (tamaño descomprimido), no sobre `Content-Length`: Extremadura
  lo sirve con gzip y sin esa cabecera. La barra se para en 99 % hasta terminar; una base sin
  `bytes` muestra solo «Descargando… X MB» (R1, D5). Si es ZIP, se busca su única entrada `.bc3` con `leerDirectorio` y
  `leerEntrada`; si hay cero o más de una, error claro. Después,
  `handleFile(new File([bytes], nombre))`, y desde ahí todo sigue igual: resumen, «Añadir como
  referencia».
- **Sin `descarga`, o si la descarga falla** (CORS, red, 404, el formato no cuadra): «Abrir
  página oficial» en una pestaña nueva, con el texto «Descarga el .bc3 y suéltalo aquí abajo».
  El error nunca deja el modal en blanco. Desde ese momento la zona de soltar queda asociada a
  esa base (R9, D14), con el rótulo «Suelta aquí el fichero de <base>»: acepta `.bc3` o `.zip`
  (el mismo lector de ZIP de la descarga), cada fichero soltado es una operación nueva con la
  `fuenteOficial` de esa base (edición del catálogo, `descargadaEl` de hoy) y sigue D9. «No es
  esta base» la desasocia y la zona vuelve a ser la de siempre.
- **Una descarga cada vez** (R3, D7): con una en marcha, las demás filas y la zona de soltar
  se desactivan. **Cancelar** o cerrar el modal la abortan (`AbortController`) y no llegan a
  llamar a `handleFile`. El cuerpo se lee siempre como bytes (`getReader`), nunca con
  `text()`, que descodificaría mal el `.bc3`. Y todo va atado a la operación (R3, D13): al
  empezar una descarga se borra el resumen anterior y «Añadir como referencia» se desactiva
  hasta que llega el nuevo; la fuente se guarda junto a ese resultado y se borra con `reset` o
  al soltar un fichero a mano; el aborto va en la limpieza del `useEffect` al desmontar, porque
  cerrar desmonta el modal (`App.tsx`); `Bc3Dropzone` recibe `disabled`, que ignora soltar,
  clic y teclado.
- **Sin obra activa** (R5, D9): una base oficial nunca se carga como presupuesto. Si
  `activeId === null`, primero `newObra()` y después `importObraAsReference`. El `.bc3`
  soltado a mano sigue la ruta de hoy (`loadObra`).
- **Ya la tienes:** si hay una referencia con la misma `baseId` y la misma edición, el botón
  pasa a «Usar» y la selecciona sin volver a bajarla.

### 3. La fuente, en los datos y copiada en la meta

`obra.fuenteOficial?: { baseId, edicion, url, descargadaEl }`, tipado en `Obra`
(`src/core/types.ts`), que ya admite campos libres: no sube el esquema. La rellena
`importObraAsReference(data, fuente?)` con un parámetro opcional, y `metaOf` la copia a
`ObraMeta.fuente` en cada guardado, como hace con `huellas`. Así viaja en la copia `.json` y
sobrevive a que `reconcile` rehaga la meta desde el blob; el selector la lee de la meta sin
abrir la obra (R2, D6). `isMeta` la ignora si está mal formada. En Referencia se ve bajo el nombre: «Junta de Extremadura · 2026 · actualizada el 23/06/2026 ·
descargada el 24/10/2026», con enlace a la página oficial (R11, D16). Así se cumple «citar la fuente y la fecha de
última actualización» (Ley 37/2007, art. 8).

**El nombre de la referencia sale del catálogo** (R10, D15): al importar una base oficial,
`obra.denominacion` = «<nombre corto> · <edición> (<organismo>)», por ejemplo «BCCA · V02 enero
2024 (Junta de Andalucía)». Así cada partida copiada lleva base, edición y organismo en
`baseSource` (`copySlice.ts`), aunque después se borre la referencia.

**La marca de referencia, también en los datos** (R8, D12): `importObraAsReference` pone
`obra.soloReferencia = true` a toda referencia, oficial o no. `metaOf` y el paso de huérfanos de
`reconcile` derivan de ella `kind: 'reference'`. Si falla la escritura del índice después de la
del blob (`createObra`), la base vuelve como referencia y no como obra propia. Las referencias
importadas antes de este cambio no la llevan.

**Edición nueva:** si el catálogo trae para esa `baseId` una `edicion` distinta de la
guardada, aparece una marca «Hay edición nueva» con el botón de descargarla como referencia
aparte. Nunca se sustituye sola: las obras ya copiadas de la vieja no cambian.

### 4. Tamaño

Extremadura son 18,7 MB de `.bc3`; Precio Centro, 34 MB, ya entra hoy como referencia. En E1
se mide cuánto ocupa Extremadura en IndexedDB y cuánto tarda en parsearse en un portátil
normal. Con esa medida (R4, D8): antes de descargar, `espacioNavegador()` frente a `bytes` ×
el factor medido avisa si no cabe, con lo que queda libre; y si al guardar `esCuotaLlena(e)`,
el modal dice «No cabe en el navegador: borra alguna referencia o libera espacio de planos»,
sin «Inténtalo de nuevo». Las dos funciones ya existen en `src/persist/planos.ts`.

### 5. Reglas por código de las bases nuevas

Se analizan los códigos de Extremadura con el `.bc3` en `docs/spike/samples/` (no se sube): qué
capítulo es demoliciones y cuáles son las familias de hormigón, acero, fábricas e
impermeabilización. Esos códigos se añaden a las reglas de residuos y, cuando exista, al plan
de control de calidad. Sin ellos funcionan las reglas por texto, que aciertan menos; la app
avisa «base sin reglas por código: revisa las propuestas».

### 6. Permiso para precargar (aparte, sin código)

Un correo a la Junta de Andalucía y otro a la Junta de Extremadura pidiendo dos cosas: que
confirmen por escrito que sus precios se pueden usar en presupuestos entregados a clientes
(R13, D18), y autorización expresa para servir la base desde la app, citando fuente y fecha. Si contestan que sí, la
descarga puede venir de nuestro despliegue, que es más rápido y no se rompe cuando cambia su
URL. Hasta entonces, nada.

## Etapas

- **E0 · Tests de regresión del modal** (R7, D11), en un commit propio antes de tocarlo y
  pasando contra el código de hoy: (1) con obra activa, soltar un `.bc3` → resumen → «Añadir
  como referencia» guarda con `importObraAsReference`, selecciona `obra:<id>`, avisa y cierra;
  (2) con la app vacía, el `.bc3` soltado entra con `loadObra`; (3) un fallo al guardar que no
  es de cuota da el mensaje genérico y deja reintentar; (4) cerrar y reabrir empieza en blanco.
  E1 y E2 no tocan estos cuatro tests; solo añaden los de D7, D8 y D9.
- **E1 · Catálogo y descarga:** `basesOficiales.ts` con BCCA, Extremadura y Madrid (este,
  solo página); fila y botón en el modal; descarga con progreso y cancelación; ZIP; vuelta a
  «Abrir página oficial» si falla. Medida de tamaño y tiempo con Extremadura.
- **E2 · Fuente y ediciones:** `ObraMeta.fuente`, «Ya la tienes», «Hay edición nueva», la
  fuente a la vista en Referencia.
- **E3 · Reglas de Extremadura:** códigos de demoliciones en residuos, con test sobre partidas
  reales de la base y tests negativos (R12, D17): instantánea de propuestas antes y después
  sobre la BCCA, Precio Centro y la obra de ejemplo de `docs/spike/samples/` (a mano; no se
  suben) y, en la CI, un juego pequeño de códigos copiados a mano. Ninguna propuesta de otra
  base puede cambiar.
- **E4 · `scripts/bases/comprobar.mjs`.**
- **Aparte:** correos de permiso (§6), si el usuario quiere.

## Tests

Ninguno toca la red: `fetch` simulado.

- Catálogo: cada entrada tiene `pagina`, una `comprobada` válida y, si trae `descarga`, una URL
  https con `bytes > 0`.
- Descarga de `.bc3`: `fetch` devuelve un `.bc3` pequeño → `handleFile` lo recibe con su
  nombre → el resumen sale.
- ZIP: uno con una entrada `.bc3`, bien; con ninguna o con dos, error claro; dañado, error del
  `ErrorZip` que ya existe.
- Fallo de `fetch` (TypeError de CORS, 404, abortado) → el mensaje lleva a la página oficial y
  la zona de soltar sigue funcionando.
- «Ya la tienes»: con una referencia de la misma base y edición, no hay `fetch`.
- `fuente` se guarda en la meta y sobrevive a recargar el índice (`isMeta` la acepta y la
  ignora si está mal).
- Edición nueva: catálogo «2027» frente a una guardada «2026» → sale la marca; no se borra nada.

## Fuera de alcance

- Bases de pago (IVE, BEDEC, Precio Centro, PREOC) y la base entera de CYPE.
- Galicia, País Vasco y Castilla y León, mientras no tengan descarga viva y edición reciente.
- Precargar bases en el repo o en el despliegue sin permiso escrito.
- Actualizar bases solas en segundo plano.

## Archivos

- Nuevo: `src/core/basesOficiales.ts` (+ test), `src/features/importar/descargaBase.ts`
  (+ test: fetch, progreso, ZIP y errores, sin React) y `scripts/bases/comprobar.mjs`.
- Cambian: `src/features/importar/ReferenciaImportModal.tsx` (+ test),
  `src/core/types.ts` (`Obra.fuenteOficial?`), `src/persist/registry.ts` (`ObraMeta.fuente`,
  copiada por `metaOf`), `src/persist/sync.ts`
  (`importObraAsReference(data, fuente?)`), el selector de Referencia
  (`src/features/referencia/ReferenciaPanel.tsx`) y `src/core/rcd/reglas.ts` (E3).
- No cambia `useBc3Parse.ts`: `handleFile(file: File | undefined)` ya acepta el `File`
  construido con la descarga.

## Decisiones

- **D1 · Sin obra activa:** cerrada en la revisión (D9): las bases oficiales entran siempre
  como referencia; si no hay obra activa, `newObra()` crea antes una en blanco. El `.bc3`
  soltado a mano sigue como hoy.
- **D2 · Madrid en el catálogo:** cerrada en la revisión (D3): entra solo con «Abrir página
  oficial» y el plan B asociado de R9.
- **D3 · La fuente en `ObraMeta` o en `ObraData`.** Cerrada en la revisión (D6): en
  `obra.fuenteOficial`, con copia en la meta.
- **D4 · Correos de permiso (§6):** apuntados como TODO en la revisión (D19), con las dos
  preguntas de D18. No bloquean E0–E4.

## Implementación (2026-10-24)

Commits en main: E0 `732fbbf`, E1 y E2 `84f2135`, E4 `b5bdfcf`, E3 el siguiente. Probado en el
navegador contra las webs oficiales: la BCCA (ZIP) y Extremadura (18,7 MB con gzip) se
descargan, se guardan como referencia y el selector cita su fuente.

Lo que cambió respecto al diseño:

- **Aviso de espacio (D8):** no se calcula con `bytes` × un factor común. Medido: Extremadura
  ocupa ya importada 33,8 MB (1,8 × su .bc3) y la BCCA 7,9 MB (12,6 × su ZIP). El catálogo
  guarda lo medido en `descarga.ocupa` y el aviso usa eso con un margen de 1,2.
- **Madrid sin `actualizada`:** su página no da la fecha de la edición 2024 («Última
  actualización: 26 marzo 2026» es de la página). `actualizada: null` y no se enseña; con
  `descarga`, el test exige la fecha.
- **Nombre del fichero:** la URL de Extremadura acaba en un identificador
  (`…/BCEXTGREM_26_v1.bc3/8066c810-…`): se toma el último tramo que acaba en `.bc3` o `.zip`.
- **Fuente mal formada (D6):** `isMeta` no rechaza la meta (eso vaciaría el índice); quien
  enseña la fuente la valida con `esFuenteOficial`.
- **`reconcile` (D12):** si no hay obra activa válida, elige la primera obra de trabajo y no
  una referencia. Lo mismo al borrar la obra activa, al descartar una obra dañada y en el
  respaldo del arranque (`idsDeTrabajo`, 2026-10-25): si no queda ninguna obra de trabajo,
  se crea una en blanco (o, al arrancar, la demo).
- **Madrid:** su página antigua redirigía (301, lo encontró `comprobar.mjs`); el catálogo
  apunta a `https://www.comunidad.madrid/vivienda/base-datos-construccion`.
- **E3 (D17):** en Extremadura las demoliciones son E01E, R01D, Q01D/Q01P y U01C, pero casi
  todas ya las reconocen los verbos del título. Con el código entero cambiaban 11 partidas y
  algunas a peor (R01DV es evacuación: transporte y protecciones; U01CRL005 es un corte con
  disco), y `U01C` choca con los escarificados del terreno de Precio Centro (`U01C010`). Se
  quedan `E01E[A-Z]`, `R01D` sin `R01DV`, `Q01[DP]` + cifra y `U01CR[EF]`: cambian 6 partidas
  de Extremadura (5 escarificados y fresados de firme ganan propuesta; la apertura de rozas
  pierde una de «transporte» que tampoco era correcta) y ninguna de la BCCA, Precio Centro ni
  la obra de ejemplo (instantánea antes y después sobre las cuatro).

## Revisión de ingeniería (2026-10-24)

Revisión `/plan-eng-review` de este plan (`docs/plan-bases-oficiales.md`).

### Alcance

feature answers: D2 «Incluirlo en este cambio» (scripts/bases/comprobar.mjs entra), D3
«Incluir, solo página» (Madrid en el catálogo sin `descarga`); structure: A «Smaller
arrangement» (D4); accepted scope: E1–E4 del plan con Madrid solo página, la descarga en
`src/features/importar/descargaBase.ts` y `useBc3Parse.ts` sin tocar; pending remedies: R1,
R2, R3, R4.

Corrección de hecho (sin pregunta): el plan decía que `useBc3Parse.ts` tenía que «aceptar un
`File` construido»; ya lo acepta (`src/features/importar/useBc3Parse.ts:33`,
`async function handleFile(file: File | undefined)`).

Corrección de datos (sin pregunta): la URL de Extremadura responde igual sin el
`?t=1782217730923` que añade el portal (`Content-Length: 18708326`, curl 2026-10-24); el
catálogo la guarda sin ese parámetro de caché.

### Decision ledger

#### R1: total de la barra de progreso
Finding: S2, P2, confidence 9/10, plan §2 «fetch con barra de progreso (lectura en flujo sobre `Content-Length`)», reviewer Claude.
Plan baseline: progreso sobre `Content-Length` (propuesta original, sin aprobar).
Runtime evidence: `curl -sI -H "Accept-Encoding: gzip, br"` a la URL de Extremadura devuelve `Content-Encoding: gzip` y ningún `Content-Length` (2026-10-24). La BCCA sí manda `Content-Length: 624785` y no comprime.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 total del progreso | `Content-Length`, ausente en Extremadura | `bytes` del catálogo (tamaño descomprimido); la barra se para en 99 % hasta terminar; si una base no trae `bytes`, contador de MB sin porcentaje | Siempre contador «Descargando… X MB», sin porcentaje |
| R2–R4 | pending | pending | pending |

Question D5:
D5 — ¿Con qué total se calcula la barra de progreso?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: para pintar «45 %» hace falta saber cuánto pesa el fichero entero. El plan lo saca de la cabecera Content-Length, pero el servidor de Extremadura manda su .bc3 comprimido con gzip y sin esa cabecera (probado hoy con curl). Son 18,7 MB, unos segundos con buena conexión y bastante más en la obra con el móvil.
Si elegimos mal: con el plan tal cual, la barra de Extremadura no se mueve o marca mal justo en la base más pesada.
Recomendación: A porque el catálogo ya guarda `bytes` y con eso la barra funciona en las dos bases sin depender de cabeceras.
Completeness: A=9/10, B=7/10
Net: un porcentaje que puede quedarse corto si la Junta cambia el fichero frente a un contador que nunca miente pero no dice cuánto falta.
Header: Progreso
Options:
A) Tamaño del catálogo (recommended)
✅ Extremadura y la BCCA muestran porcentaje real, con o sin gzip. ✅ El tope en 99 % evita que marque «100 %» antes de acabar si la Junta cambia el fichero; comprobar.mjs avisa de ese cambio de tamaño. ❌ Si el fichero cambia de tamaño, el porcentaje se desvía hasta que actualicemos `bytes`. (human: ~30 min / CC: ~5 min)
B) Solo contador de MB
✅ Nunca muestra un porcentaje falso: dice lo descargado y nada más. ✅ Menos código y nada que mantener en el catálogo. ❌ En 18,7 MB por móvil el usuario no sabe si falta poco o mucho. (human: ~15 min / CC: ~3 min)

State: approved
Actual answer: A) Tamaño del catálogo (D5, 2026-10-24)
Accepted scope: progreso sobre `descarga.bytes` del catálogo con tope en 99 % hasta terminar; sin `bytes`, contador de MB sin porcentaje; tests en `descargaBase.test.ts` con respuesta gzip sin `Content-Length`; plan §2 actualizado.
History: —

#### R2: dónde vive la fuente de la base
Finding: S3, P2, confidence 8/10, plan §3 «`ObraMeta.fuente?` … Es metadato y no viaja en la copia `.json`» y decisión D3 del plan, reviewer Claude.
Plan baseline: `ObraMeta.fuente` (propuesta original; D3 del plan abierta).
Runtime evidence: `Obra` admite campos libres (`src/core/types.ts:302`, `[k: string]: unknown; // promotor/constructor… se completan en F6`) y la carga copia `obra` tal cual (`src/store/schema.ts:215`, `const obra = { ...d.obra }`), así que un campo nuevo en `obra` no sube el esquema. `reconcile` (`src/persist/registry.ts`, paso 2) reconstruye la meta de un blob huérfano solo con `id, name, savedAt, schemaVersion, huellas, huellasDe`: lo que viva solo en la meta se pierde ahí. `metaOf` ya deriva `huellas` de los datos en cada guardado.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1 progreso | approved: `bytes` del catálogo (D5) | igual | igual |
| R2 sitio de la fuente | `ObraMeta.fuente` | `obra.fuenteOficial` en los datos; `metaOf` la copia a la meta en cada guardado, como `huellas`; el selector la lee de la meta | Solo `ObraMeta.fuente`, como el plan |
| R3–R4 | pending | pending | pending |

Question D6:
D6 — ¿Dónde se guarda de qué base oficial sale una referencia?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: cada base descargada tiene que recordar organismo, edición, enlace y fecha, para enseñarlos y para saber si ya la tienes o si hay edición nueva. El plan lo guarda en la ficha del índice de obras, fuera de la obra. Pero el campo `obra` ya admite datos extra sin cambiar el formato (src/core/types.ts:302), y si el índice se reconstruye (registry.ts, `reconcile`), la ficha pierde todo lo que no sale de los datos.
Si elegimos mal: con la fuente solo en la ficha, una reconstrucción del índice o una copia .json dejan la base sin origen: no se sabe de dónde salió ni si hay edición nueva.
Recomendación: A porque la fuente viaja con los datos, no hay que subir el esquema y la ficha la sigue teniendo a mano para pintar el selector.
Completeness: A=9/10, B=6/10
Net: un campo en los datos con su copia en la ficha frente a un dato que solo vive en la ficha.
Header: Fuente
Options:
A) En los datos, copia en ficha (recommended)
✅ La fuente sobrevive a una copia .json, a abrirla como obra y a reconstruir el índice. ✅ Sin subir el esquema: `obra` ya admite campos libres y la carga lo copia tal cual. ❌ `metaOf` gana un campo más que copiar, con su test. (human: ~1 h / CC: ~10 min)
B) Solo en la ficha del índice
✅ No toca los datos de la obra: es metadato puro, como `ultimaCopia`. ✅ Es el plan tal cual. ❌ Si el índice se rehace desde los blobs, la base pierde su origen y deja de detectar ediciones nuevas. (human: ~45 min / CC: ~8 min)

State: approved
Actual answer: A) En los datos, copia en ficha (D6, 2026-10-24)
Accepted scope: `Obra.fuenteOficial?` tipado en `src/core/types.ts`; `importObraAsReference(data, fuente?)` lo escribe; `metaOf` lo copia a `ObraMeta.fuente` en cada guardado; `isMeta` tolera y descarta una `fuente` mal formada; tests de que sobrevive a guardar, a `reconcile` de un blob huérfano y a la copia `.json`; plan §3, Archivos y D3 actualizados.
History: —

#### R3: una descarga cada vez, cancelable y en bytes
Finding: S4, P2, confidence 8/10, plan §2 «**Cancelar** durante la descarga la aborta (`AbortController`)», reviewer Claude.
Plan baseline: botón «Descargar y añadir» por fila y Cancelar aborta (propuesta original).
Runtime evidence: `handleFile` solo se protege con `if (!file || busy) return;` (`src/features/importar/useBc3Parse.ts:34`), y `busy` no se enciende hasta que hay `File`: durante la descarga nada impide pulsar otra fila, otra vez la misma o soltar un fichero. El modal limpia su estado al cerrarse (`ReferenciaImportModal.tsx`, `useEffect` con `if (!open) reset()`), pero eso no aborta un `fetch` en marcha. Los `.bc3` llevan su propia codificación (Extremadura se sirve como `text/plain; charset=UTF-8`): leerlo con `res.text()` lo descodificaría mal.
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R3 coherencia de la operación | approved D7: guarda `descargando`, abortar al cerrar, bytes crudos | D7 más: al empezar una descarga se borra el resumen anterior (`reset()`); «Añadir como referencia» desactivado mientras descarga; la fuente va atada a ESA operación (se guarda junto al resultado del parseo y se borra con `reset` o al soltar un fichero a mano); el aborto va en la limpieza del `useEffect` al desmontar, porque cerrar desmonta el modal (`App.tsx`); `Bc3Dropzone` recibe `disabled` que ignora soltar, clic y teclado | D7 tal cual | investigar ≤30 min en el modal y volver a preguntar; D7 sigue aprobada | aplazar lo nuevo a TODOS; D7 sigue aprobada |
| R1, R2, R4–R8 | approved | igual | igual | igual | igual |

Question D13:
D13 — ¿Ampliamos la protección de la descarga (D7) con lo que ha encontrado Codex?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: D7 desactiva las filas durante una descarga, pero quedan tres huecos comprobados en el código. Uno: si ya había un resumen de otra base, «Añadir como referencia» sigue activo mientras baja la nueva, porque solo mira `!result || busy || importing` (ReferenciaImportModal.tsx:92), y podría guardarse el fichero viejo con la fuente nueva. Dos: la zona de soltar con `busy` solo cambia el dibujo y sigue aceptando ficheros (importShared.tsx). Tres: cerrar el modal lo desmonta entero (App.tsx:510), así que abortar «cuando `open` pasa a false» no llega a ejecutarse.
Si elegimos mal: se guarda Extremadura con la etiqueta de la BCCA, o una descarga sigue en segundo plano tras cerrar.
Recomendación: A porque cierra tres fallos reales con cambios pequeños en el mismo modal.
Completeness: A=10/10, B=6/10, C=6/10, D=6/10
Net: unas guardas más frente a poder guardar una base con la fuente de otra.
Header: Descarga 2
Options:
A) Atar todo a la operación (recommended)
✅ Al empezar una descarga se borra el resumen anterior y se desactiva «Añadir»: nunca se guarda un fichero con la fuente de otro. ✅ El aborto va en la limpieza al desmontar y la zona de soltar se desactiva de verdad (soltar, clic y teclado). ❌ `Bc3Dropzone` gana una prop `disabled`; la vista Importar no la usa y no cambia. (human: ~1,5 h / CC: ~10 min)
B) Dejar D7 como está
✅ Nada nuevo que hacer sobre lo ya aprobado en D7. ✅ Las guardas de D7 ya cubren el doble clic sobre las filas. ❌ Quedan los tres huecos: fuente cruzada, soltar durante la descarga y descarga viva tras cerrar.
C) Investigar antes
✅ Media hora en el modal para ver si un solo estado (la operación en curso) cubre los tres casos. ✅ D7 sigue aprobada mientras tanto. ❌ R3 queda pendiente y bloquea cerrar la revisión hasta volver a preguntar.
D) Aplazar lo nuevo
✅ E1 sale con D7 y los tres huecos quedan apuntados en TODOS. ✅ Ningún cambio en `Bc3Dropzone`. ❌ La fuente cruzada es justo el dato que D6 quiere fiable.

State: approved
Actual answer: A) Atar todo a la operación (D13, 2026-10-24), que amplía A) Una cada vez, cancelable (D7)
Accepted scope: D7 entera más: al empezar una descarga, `reset()` del resumen anterior; «Añadir como referencia» desactivado mientras descarga; la fuente atada a la operación (junto al resultado del parseo; se borra con `reset` o al soltar un fichero a mano); aborto en la limpieza del `useEffect` al desmontar; `Bc3Dropzone` con prop `disabled` que ignora soltar, clic y teclado (la vista Importar no la pasa); tests: resumen viejo + descarga nueva no deja guardar el viejo con la fuente nueva; soltar durante la descarga no hace nada; desmontar a mitad aborta; plan §2 actualizado.
History: reabierta el 2026-10-24 por riesgo nuevo comprobado en el código (Codex, salida no validada; comprobado por Claude). Versión anterior:
> Comparison grid:
> 
> | Choice | Current | A | B |
> |---|---|---|---|
> | R1 progreso | approved (D5) | igual | igual |
> | R2 fuente | approved (D6) | igual | igual |
> | R3 descarga concurrente y cierre | sin guarda; cerrar no aborta | estado `descargando` en el modal: desactiva todas las filas y la zona de soltar; cerrar el modal o Cancelar abortan el `fetch` y no llaman a `handleFile`; el cuerpo se lee siempre como bytes (`getReader`), nunca `text()` | Solo Cancelar aborta, como el plan; sin guarda entre filas |
> | R4 cuota | pending | pending | pending |
> 
> Question D7:
> D7 — ¿Cómo se protege la descarga de dobles clics y de cerrar el modal?
> Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
> ELI10: mientras baja Extremadura (18,7 MB) no hay nada que impida pulsar la BCCA, pulsar dos veces o soltar otro fichero: el único freno, `busy`, se enciende después de la descarga (useBc3Parse.ts:34). Y si cierras el modal, la descarga sigue y al terminar escribe en un modal que ya no está. Además el .bc3 hay que leerlo como bytes: leerlo como texto rompe los acentos.
> Si elegimos mal: dos descargas que acaban a la vez y la segunda pisa a la primera, o la base que acaba saliendo no es la que el usuario pulsó.
> Recomendación: A porque son tres guardas pequeñas en el mismo sitio y cada una cierra un fallo que se ve en uso real.
> Completeness: A=9/10, B=5/10
> Net: unas líneas más en el modal frente a dejar carreras que el usuario ve.
> Header: Descarga
> Options:
> A) Una cada vez, cancelable (recommended)
> ✅ Con una descarga en marcha, las demás filas y la zona de soltar se desactivan: nunca hay dos a la vez. ✅ Cerrar el modal aborta y no deja nada a medias; los bytes se leen crudos y los acentos llegan intactos. ❌ Tres tests más (doble clic, cerrar a mitad, acentos). (human: ~1,5 h / CC: ~10 min)
> B) Solo el Cancelar del plan
> ✅ Menos estado en el modal: solo el `AbortController` del botón Cancelar. ✅ Es el plan tal cual. ❌ Doble clic o cerrar el modal dejan descargas sueltas que pueden pisarse. (human: ~30 min / CC: ~4 min)
> 
> State: approved
> Actual answer: A) Una cada vez, cancelable (D7, 2026-10-24)
> Accepted scope: estado `descargando` en el modal que desactiva todas las filas y la zona de soltar; Cancelar y cerrar el modal abortan el `fetch` sin llamar a `handleFile`; lectura del cuerpo como bytes con `getReader`, nunca `text()`; tests de doble clic, cerrar a mitad y acentos de un `.bc3` en Windows-1252; plan §2 actualizado.
> History: —

#### R4: cuota del navegador llena al guardar la base
Finding: A1, P2, confidence 8/10, plan §4 «Si pasa de lo que admite la cuota del navegador, se avisa antes de descargar», reviewer Claude.
Plan baseline: medir en E1 y avisar antes de descargar si no cabe (propuesta original).
Runtime evidence: el modal convierte cualquier fallo al guardar en un mensaje genérico (`ReferenciaImportModal.tsx`, `catch { setSaveError('No se pudo guardar la obra de referencia. Inténtalo de nuevo.') }`), y reintentar con la cuota llena falla igual. Ya existen `esCuotaLlena(e)` (`src/persist/planos.ts:97`) y `espacioNavegador()` (`src/persist/planos.ts:290`, `navigator.storage.estimate()`), que usa «Liberar espacio» de los planos.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R3 | approved (D5, D6, D7) | igual | igual |
| R4 cuota llena | aviso previo según la medida de E1; fallo al guardar con mensaje genérico | aviso previo con `espacioNavegador()` frente a `bytes` × factor medido en E1; y si al guardar `esCuotaLlena(e)`, mensaje «No cabe en el navegador: borra alguna referencia o libera espacio de planos», sin «Inténtalo de nuevo» | Solo el aviso previo del plan; el fallo al guardar sigue genérico |

Question D8:
D8 — ¿Qué ve el usuario si la base no cabe en el navegador?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: el navegador da a cada web un espacio limitado. Si se llena al guardar Extremadura, hoy el modal dice «No se pudo guardar… Inténtalo de nuevo» (ReferenciaImportModal.tsx), y reintentar falla igual. La app ya sabe reconocer ese error (`esCuotaLlena`, planos.ts:97) y medir el espacio libre (`espacioNavegador`, planos.ts:290).
Si elegimos mal: el usuario reintenta una descarga de 18,7 MB varias veces sin saber que el problema es el espacio.
Recomendación: A porque reutiliza dos funciones que ya existen y convierte un callejón sin salida en una instrucción clara.
Completeness: A=9/10, B=6/10
Net: un mensaje concreto y un aviso previo frente a dejar el «Inténtalo de nuevo» que no sirve.
Header: Cuota
Options:
A) Aviso previo y mensaje claro (recommended)
✅ Antes de bajar 18,7 MB avisa si no cabe, con lo que hay libre. ✅ Si aun así se llena, dice qué hacer (borrar una referencia o liberar planos) en vez de «Inténtalo de nuevo». ❌ Dos ramas más que probar con una cuota simulada. (human: ~1 h / CC: ~8 min)
B) Solo el aviso previo del plan
✅ Menos código: el fallo al guardar sigue por el camino genérico de hoy. ✅ El aviso previo ya cubre el caso más habitual. ❌ Si la estimación falla o el navegador no la da, el usuario vuelve al «Inténtalo de nuevo» inútil. (human: ~30 min / CC: ~4 min)

State: approved
Actual answer: A) Aviso previo y mensaje claro (D8, 2026-10-24)
Accepted scope: aviso antes de descargar con `espacioNavegador()` frente a `bytes` × factor medido en E1 (sin aviso si la estimación no está disponible); mensaje propio cuando `esCuotaLlena(e)` al guardar, sin «Inténtalo de nuevo»; tests con estimación simulada (cabe, no cabe, sin estimación) y con un `QuotaExceededError` al guardar; plan §4 actualizado.
History: —

#### R5: base oficial con la app sin obra activa
Finding: A2, P2, confidence 9/10, decisión D1 del plan «Propuesta: las bases oficiales entran siempre como referencia, y si no hay obra se crea una en blanco», reviewer Claude.
Plan baseline: D1 abierta; propuesta del plan: siempre referencia y obra en blanco si no hay ninguna.
Runtime evidence: `ReferenciaImportModal.tsx`, `if (activeId === null) { loadObra(result.data); show(`«${name}» cargada`); onClose(); return; }`: sin obra activa, lo importado pasa a ser el presupuesto. `newObra(name?)` (`src/persist/sync.ts`) ya crea, persiste y activa una obra en blanco, y `importObraAsReference` guarda sin activar.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R4 | approved (D5–D8) | igual | igual |
| R5 base oficial sin obra activa | se carga como presupuesto (`loadObra`) | siempre referencia: si `activeId === null`, `newObra()` primero y luego `importObraAsReference`; el `.bc3` soltado a mano sigue como hoy | igual que hoy para todo: sin obra, la base pasa a ser el presupuesto |

Question D9:
D9 — Sin obra abierta, ¿una base oficial entra como presupuesto o como referencia?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: hoy, si la app está vacía, lo que importas en este modal se carga como tu presupuesto (ReferenciaImportModal.tsx, `if (activeId === null) loadObra(...)`). Tiene sentido con una obra tuya en .bc3, pero con la BCCA te deja las 4,4 MB de la base entera como presupuesto. La alternativa crea antes una obra en blanco con `newObra()`, que ya existe, y guarda la base como referencia.
Si elegimos mal: el primer contacto de alguien con la app es un presupuesto con miles de partidas que no son suyas.
Recomendación: A porque una base de precios nunca es un presupuesto, y para el .bc3 soltado a mano no cambia nada.
Completeness: A=9/10, B=6/10
Net: un paso más por dentro frente a un primer arranque confuso.
Header: Sin obra
Options:
A) Siempre como referencia (recommended)
✅ Con la app vacía se crea una obra en blanco y la base queda como referencia, lista para copiar partidas. ✅ El .bc3 que sueltas a mano sigue cargándose como presupuesto, igual que hoy. ❌ Dos caminos distintos en el mismo modal según de dónde venga el fichero, con su test cada uno. (human: ~1 h / CC: ~8 min)
B) Igual que hoy para todo
✅ Un solo comportamiento en el modal, sin distinguir de dónde viene el fichero. ✅ Cero código nuevo en este punto. ❌ Con la app vacía, la BCCA o Extremadura acaban siendo tu presupuesto. (human: 0 / CC: 0)

State: approved
Actual answer: A) Siempre como referencia (D9, 2026-10-24)
Accepted scope: en el modal, una base del catálogo con `activeId === null` llama a `newObra()` y después a `importObraAsReference`; si `newObra` devuelve `null`, no se guarda nada y se avisa; el `.bc3` soltado a mano mantiene `loadObra`; tests de los dos caminos con la app vacía; plan §2 y D1 actualizados.
History: —

#### R6: qué comprueba scripts/bases/comprobar.mjs
Finding: C1, P2, confidence 9/10, plan §1 «`scripts/bases/comprobar.mjs` hace un HEAD a cada URL y avisa de cambios de tamaño o de 404», reviewer Claude.
Plan baseline: HEAD por URL, aviso de tamaño y 404 (aprobado como alcance en D2; el contrato del script no se había revisado).
Runtime evidence: un HEAD normal a Extremadura no trae tamaño (`Content-Encoding: gzip`, sin `Content-Length`); con `Accept-Encoding: identity` sí (`Content-Length: 18708326`). (La URL sin `?t=` se anota aparte, como corrección de datos.)
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R5 | approved (D5–D9) | igual | igual |
| R6 contrato del script | HEAD; avisa de tamaño y 404 | HEAD con `Accept-Encoding: identity`; compara `Content-Length` con `descarga.bytes` y la CORS (`Access-Control-Allow-Origin` con un `Origin` de prueba); avisa de 404, redirección, tamaño distinto o CORS perdida; sale con código distinto de 0 si algo cambia; para entradas sin `descarga`, solo que `pagina` responde 200 | HEAD tal cual el plan |

Question D10:
D10 — ¿Qué tiene que comprobar el script de enlaces?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: el script que entra por D2 hace un HEAD a cada URL. Pero Extremadura, si no se le pide expresamente sin comprimir, no dice cuánto pesa (probado con curl), así que el script nunca vería un cambio de tamaño en la base más grande. Tampoco miraría si siguen permitiendo descargar desde la app (CORS), que es lo que de verdad rompe el botón.
Si elegimos mal: el script dice «todo bien» mientras el botón de Extremadura falla o la barra de progreso calcula con un tamaño viejo.
Recomendación: A porque son tres cabeceras más y cubre justo los dos fallos que rompen el botón.
Completeness: A=9/10, B=4/10
Net: un script que mira lo que de verdad importa frente a uno que solo confirma que la URL existe.
Header: Script
Options:
A) Tamaño, CORS y código (recommended)
✅ Pide el tamaño sin comprimir y lo compara con `bytes`: detecta el fichero cambiado que desviaría la barra (R1). ✅ Mira la CORS y sale con error si algo cambia, para no publicar un catálogo roto. ❌ El script crece de unas 20 a unas 60 líneas. (human: ~1,5 h / CC: ~8 min)
B) HEAD tal cual el plan
✅ El script más corto posible: estado HTTP por URL. ✅ Ya detecta el 404 cuando la Junta cambia el enlace. ❌ No ve el tamaño de Extremadura ni la pérdida de CORS, que son lo que rompe el botón. (human: ~45 min / CC: ~4 min)

State: approved
Actual answer: A) Tamaño, CORS y código (D10, 2026-10-24)
Accepted scope: comprobar.mjs con HEAD `Accept-Encoding: identity` y `Origin` de prueba; compara `Content-Length` con `bytes` y comprueba `Access-Control-Allow-Origin`; avisa de 404, redirección, tamaño distinto o CORS perdida; código de salida distinto de 0 si algo cambia; para entradas sin `descarga`, `pagina` responde 200; plan §1 actualizado.
History: —

#### R7: contrato de regresión del modal de importar referencia
Finding: T1, P1 (CRITICAL, regresión), confidence 9/10, plan §2 «Modal: "Bases oficiales" encima de la zona de soltar» y Archivos «`ReferenciaImportModal.tsx` (+ test)», reviewer Claude.
Plan baseline: «+ test» sin contrato de lo que hay que conservar (propuesta original).
Runtime evidence: `src/features/importar/ReferenciaImportModal.test.tsx` solo tiene dos tests: `it('abre como diálogo NO destructivo (añade, no reemplaza) con el confirmar deshabilitado sin archivo'` y `it('no renderiza nada cuando está cerrado'`. Ningún test suelta un `.bc3`, ni cubre la app vacía (`loadObra`), ni el error al guardar, ni el reseteo al cerrar. `importObraAsReference` sí tiene tests en `src/persist/importReference.test.ts`.
Comparison grid:

| Choice | Current | A | B |
|---|---|---|---|
| R1–R6 | approved (D5–D10) | igual | igual |
| R7 contrato de regresión | sin contrato | conservar: (1) con obra activa, soltar un `.bc3` → resumen → «Añadir como referencia» llama a `importObraAsReference`, selecciona `obra:<id>` como fuente, avisa «añadida como referencia» y cierra; (2) con la app vacía, el `.bc3` soltado se carga con `loadObra` y avisa «cargada»; (3) un fallo al guardar que no es de cuota muestra el mensaje genérico y deja reintentar; (4) cerrar y reabrir empieza en blanco. Cambios intencionados: D7 (zona de soltar desactivada mientras descarga), D8 (mensaje de cuota), D9 (base oficial sin obra → referencia). Los cuatro tests van en un commit propio ANTES de tocar el modal y tienen que pasar contra el código de hoy | mismo contrato (1)–(4) y mismos cambios intencionados, pero los tests van en el mismo commit que el cambio del modal |

Question D11:
D11 — ¿Cómo se protege lo que ya hace el modal antes de cambiarlo?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: el modal de «Añadir base de referencia» se va a llenar de cosas nuevas, pero hoy su test solo mira que se abre y se cierra (ReferenciaImportModal.test.tsx). Lo que de verdad hace (soltar un .bc3 y añadirlo, cargarlo como presupuesto con la app vacía, el error al guardar, empezar en blanco al reabrir) no lo prueba nada. El contrato fija esas cuatro cosas y los tres cambios que sí queremos (D7, D8, D9).
Si elegimos mal: al meter la lista de bases se rompe el soltar a mano, que es como entra hoy cualquier base, y nada avisa.
Recomendación: A porque unos tests que pasan contra el código de hoy son la única prueba de que lo que falla después lo ha roto el cambio y no estaba ya roto.
Completeness: A=10/10, B=8/10
Net: un commit más pequeño delante frente a no saber si el test pasaba antes del cambio.
Header: Regresión
Options:
A) Tests primero, commit aparte (recommended)
✅ Los cuatro tests pasan contra el modal de hoy: si fallan después, lo ha roto el cambio. ✅ El commit del cambio deja intactos esos cuatro tests y solo añade los de D7, D8 y D9: si toca uno, salta a la vista en el diff. ❌ Un commit más en main, que despliega sin cambiar nada visible. (human: ~1,5 h / CC: ~10 min)
B) Tests en el mismo commit
✅ Un solo commit para todo E1, con el mismo contrato (1)–(4). ✅ Menos despliegues seguidos a main. ❌ No queda probado que los tests pasaban con el código de antes: un test mal escrito que solo pasa con el cambio no se nota. (human: ~1,5 h / CC: ~10 min)

State: approved
Actual answer: A) Tests primero, commit aparte (D11, 2026-10-24)
Accepted scope: etapa E0 con los cuatro tests de regresión (1)–(4) en `ReferenciaImportModal.test.tsx`, en un commit propio que pasa contra el modal de hoy; E1 y E2 no los modifican y solo añaden los de D7, D8 y D9; plan, Etapas actualizado.
History: —

#### R8: una referencia huérfana vuelve como obra de trabajo
Finding: X1, P1, confidence 9/10, señalado por Codex (salida no validada) y comprobado por Claude en `src/persist/registry.ts:378` y en `reconcile`.
Plan baseline: R2 aprobada (D6): la fuente en `obra.fuenteOficial`, copiada a la meta por `metaOf`. Nada sobre `kind`.
Runtime evidence: `createObra` guarda primero el blob y después el índice (`await saveObra(obraKey(id), data);` y luego `await updateIndex(...)`): si falla la segunda escritura, queda un blob huérfano. `reconcile` lo registra con `{ id, name, savedAt, schemaVersion, huellas, huellasDe }`, sin `kind`, así que la referencia reaparece como «Obra propia» y puede acabar activa (`activeId … : (obras[0]?.id ?? null)`). Pasa ya hoy con cualquier referencia importada.
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R8 `kind` de un huérfano | se pierde: vuelve como obra de trabajo | `importObraAsReference` marca los datos con `obra.soloReferencia = true` (todas las referencias, oficiales o no); `reconcile` y `metaOf` derivan `kind: 'reference'` de esa marca; test con un fallo simulado entre blob e índice | igual que hoy | investigar ≤30 min si hay otra vía (escribir blob e índice juntos) y volver a preguntar; sin código | aplazar: TODO en TODOS.md |
| R1–R7 | approved | igual | igual | igual | igual |

Question D12:
D12 — Si se pierde el índice, ¿cómo sabe la app que una obra es solo de referencia?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: al guardar una referencia se escribe primero la obra y después el índice (registry.ts:378). Si lo segundo falla, la obra queda suelta y al arrancar `reconcile` la recupera, pero sin la marca de «referencia»: vuelve como obra tuya y hasta puede abrirse como presupuesto. Pasa ya hoy, y con Extremadura (18,7 MB) un fallo de cuota entre las dos escrituras es más probable. La propuesta guarda la marca dentro de los datos, igual que hicimos con la fuente (D6).
Si elegimos mal: una base de miles de partidas aparece como obra propia y puede abrirse como presupuesto.
Recomendación: A porque es el mismo mecanismo que D6 y arregla de paso las referencias que ya se importan hoy.
Completeness: A=10/10, B=5/10, C=6/10, D=5/10
Net: un campo y dos derivaciones frente a dejar que una base se convierta en obra.
Header: Huérfanas
Options:
A) Marca en los datos (recommended)
✅ `obra.soloReferencia = true` viaja con los datos: `reconcile` y `metaOf` vuelven a poner `kind: 'reference'` aunque se pierda el índice. ✅ Vale para todas las referencias, no solo las oficiales, y sin subir el esquema (`obra` admite campos libres). ❌ Las referencias importadas antes de este cambio no llevan la marca y siguen igual que hoy. (human: ~1,5 h / CC: ~10 min)
B) Dejarlo como hoy
✅ Cero cambios en `reconcile` ni en `metaOf`. ✅ Es un fallo raro: hace falta que falle justo la segunda escritura. ❌ Cuando pasa, una base entera aparece como obra propia y puede abrirse como presupuesto.
C) Investigar antes
✅ Media hora para ver si se pueden escribir obra e índice en una sola transacción, que evitaría el huérfano de raíz. ✅ No compromete código hasta tener el dato. ❌ Deja R8 pendiente y bloquea cerrar la revisión hasta volver a preguntar.
D) Aplazar a TODOS
✅ El plan de bases sigue sin este cambio y la deuda queda apuntada. ✅ No crece el primer commit. ❌ La base más pesada, la que más riesgo tiene de fallar a mitad, llega sin protección.

State: approved
Actual answer: A) Marca en los datos (D12, 2026-10-24)
Accepted scope: `Obra.soloReferencia?` tipado en `src/core/types.ts`; `importObraAsReference` lo pone a `true` en toda referencia; `metaOf` y el paso de huérfanos de `reconcile` derivan `kind: 'reference'` de él; tests: huérfano con la marca vuelve como referencia y no se activa; huérfano sin marca sigue como hoy; fallo simulado entre blob e índice; plan §3 actualizado.
History: —

#### R9: el plan B (soltar a mano) pierde la base elegida
Finding: X2, P2, confidence 9/10, señalado por Codex (salida no validada) y comprobado por Claude en `src/features/importar/importShared.tsx` (`accept=".bc3"`) y en el modal.
Plan baseline: plan §2 «Sin `descarga`, o si la descarga falla … "Abrir página oficial" … "Descarga el .bc3 y suéltalo aquí abajo"»; D3 aprobó Madrid solo con esa vía; D9 aprobó que una base oficial nunca se cargue como presupuesto.
Runtime evidence: la zona de soltar solo acepta `.bc3` (`<input type="file" accept=".bc3"`) y el modal no sabe de qué base viene un fichero soltado: sin obra activa lo carga con `loadObra` (contra D9) y sin `fuenteOficial` (contra D6). La BCCA se publica como `BCCA2023_V02.zip`, así que si su descarga falla el usuario tendría que descomprimirla a mano.
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R9 soltar a mano una base elegida | el fichero soltado no sabe de qué base viene; solo `.bc3` | tras «Abrir página oficial» (o un fallo de descarga), la zona de soltar queda asociada a esa base con el rótulo «Suelta aquí el fichero de <base>»: acepta `.bc3` o `.zip` (con el mismo lector de ZIP de la descarga), guarda su `fuenteOficial` con la edición del catálogo y `descargadaEl` de hoy, y sigue D9; cada fichero soltado así es una operación nueva con la fuente de esa base, y la de la operación anterior se borra como manda D13; un botón «No es esta base» la desasocia | igual que hoy: se trata como un `.bc3` cualquiera | investigar ≤30 min y volver a preguntar | aplazar a TODOS |
| R1–R8 | approved | igual | igual | igual | igual |

Question D14:
D14 — Cuando la descarga no va y el usuario suelta el fichero a mano, ¿la app sabe de qué base es?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: Madrid siempre entra así, y la BCCA o Extremadura cuando falla la descarga: «abre la página oficial y suelta el fichero aquí». Pero la zona de soltar no sabe qué base elegiste. Con la app vacía la carga como presupuesto (contra D9), no guarda de dónde viene (contra D6) y solo acepta .bc3, cuando la BCCA se publica en .zip (importShared.tsx, `accept=".bc3"`).
Si elegimos mal: justo en el plan B se pierden la fuente y la protección de D9, y con la BCCA el usuario tiene que descomprimir a mano.
Recomendación: A porque el plan B es el camino normal de Madrid y debe dar el mismo resultado que el botón.
Completeness: A=10/10, B=5/10, C=6/10, D=5/10
Net: la zona de soltar recuerda la base elegida frente a un plan B que deshace D6 y D9.
Header: Plan B
Options:
A) Asociar a la base elegida (recommended)
✅ Lo soltado tras «Abrir página oficial» es una operación nueva de esa base: con su fuente y como referencia aunque no haya obra (D9). ✅ Acepta .bc3 o .zip con el mismo lector de la descarga, y «No es esta base» lo desasocia si te equivocas. ❌ La zona de soltar del modal gana un modo más, con sus tests. (human: ~2 h / CC: ~12 min)
B) Como hoy
✅ La zona de soltar sigue siendo una sola cosa, igual en todos los casos. ✅ Ningún modo nuevo que probar. ❌ Madrid y cualquier descarga fallida entran sin fuente y, sin obra, como presupuesto; la BCCA hay que descomprimirla a mano.
C) Investigar antes
✅ Media hora para ver si basta con reconocer la base por la cabecera del .bc3, sin modo nuevo. ✅ No compromete código todavía. ❌ R9 queda pendiente y bloquea cerrar la revisión.
D) Aplazar a TODOS
✅ E1 sale antes con solo el botón de descarga. ✅ La deuda queda apuntada. ❌ Madrid, que ya está aprobada (D3), entra desde el primer día sin fuente.

State: approved
Actual answer: A) Asociar a la base elegida (D14, 2026-10-24)
Accepted scope: modo «base elegida» de la zona de soltar tras «Abrir página oficial» o un fallo de descarga: rótulo con la base; acepta `.bc3` y `.zip` (lector de `descargaBase.ts`); cada fichero es una operación nueva con la `fuenteOficial` de esa base y `descargadaEl` de hoy; sigue D9 sin obra activa; «No es esta base» desasocia; tests: Madrid soltado con la app vacía entra como referencia con su fuente; ZIP de la BCCA soltado a mano; desasociar vuelve al comportamiento de E0; plan §2 actualizado.
History: —

#### R10: la atribución se pierde al copiar partidas
Finding: X3, P2, confidence 8/10, señalado por Codex (salida no validada) y comprobado por Claude en `src/store/slices/copySlice.ts:153` y `src/features/referencia/ReferenciaPanel.tsx:22`.
Plan baseline: R2 aprobada (D6): la fuente vive en la obra de referencia y se ve en el selector. El plan §3 dice que así se cumple «citar la fuente y la fecha de última actualización» (Ley 37/2007, art. 8).
Runtime evidence: cada partida copiada guarda solo `baseSource: provenance === 'clip' ? undefined : it.sourceName`, y `sourceName` es `source.name` (`ReferenciaPanel.tsx:22`), que para una obra de referencia sale de `nameOf(data)` = `data.obra.denominacion` (`registry.ts:164`): la cabecera del `.bc3`, no el catálogo. (La fecha que se enseña va aparte, en R11.)
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R10 nombre que llevan las partidas copiadas | `baseSource` = denominación del `.bc3` | al importar una base oficial, `obra.denominacion` = «<nombre corto> · <edición> (<organismo>)» del catálogo, así cada partida copiada lleva en `baseSource` base, edición y organismo | igual que hoy | investigar ≤30 min qué piden las salidas (Word, PDF) y volver a preguntar | aplazar a TODOS |
| R11 fecha que se enseña | pending | pending | pending | pending | pending |
| R1–R9 | approved | igual | igual | igual | igual |

Question D15:
D15 — ¿Qué atribución llevan las partidas que copias de una base oficial?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: al copiar una partida, la app solo guarda el nombre de la fuente (copySlice.ts:153), y ese nombre es el que trae la cabecera del .bc3, por ejemplo algo genérico, sin edición ni organismo. Si luego borras la referencia, el presupuesto ya no dice de qué base y edición salió cada precio. (La fecha que se enseña es otra pregunta, la siguiente.)
Si elegimos mal: un presupuesto con precios de la BCCA 2024 y de Extremadura 2026 no deja ver cuál es cuál, ni de qué edición.
Recomendación: A porque reutiliza `baseSource`, que ya viaja con cada partida, y solo cambia el nombre que se le da a la referencia.
Completeness: A=9/10, B=5/10, C=6/10, D=5/10
Net: un nombre bien puesto frente a perder la procedencia al copiar.
Header: Atribución
Options:
A) Nombre del catálogo (recommended)
✅ Cada partida copiada lleva en `baseSource` «BCCA · V02 enero 2024 (Junta de Andalucía)», aunque luego borres la referencia. ✅ No hay campo nuevo: se reutiliza `baseSource`, que ya viaja con cada partida. ❌ Las referencias se llaman como el catálogo y no como su cabecera .bc3 (se puede renombrar después). (human: ~45 min / CC: ~6 min)
B) Como hoy
✅ La referencia conserva el nombre de su cabecera .bc3, sin tocarlo. ✅ Cero código en este punto. ❌ Lo copiado no dice edición ni organismo.
C) Investigar antes
✅ Media hora para ver si Word y PDF tendrían que citar la base en el documento. ✅ No compromete código todavía. ❌ R10 queda pendiente y bloquea cerrar la revisión.
D) Aplazar a TODOS
✅ E1 y E2 salen sin tocar el nombre de las referencias. ✅ La deuda queda apuntada. ❌ Las partidas copiadas mientras tanto se quedan sin edición para siempre.

State: approved
Actual answer: A) Nombre del catálogo (D15, 2026-10-24)
Accepted scope: al importar una base oficial (botón o plan B de R9), `obra.denominacion` = «<nombre corto> · <edición> (<organismo>)» del catálogo; el catálogo gana `nombreCorto`; test: copiar una partida de esa referencia deja ese texto en `baseSource` y sigue ahí tras borrar la referencia; plan §3 actualizado.
History: —

#### R11: qué fecha se enseña de la base
Finding: X4, P3, confidence 8/10, señalado por Codex (salida no validada) y comprobado por Claude contra el plan §3 «"Junta de Extremadura · 2026 · descargada el 24/10/2026" … Así se cumple "citar la fuente y la fecha de última actualización" (Ley 37/2007, art. 8)».
Plan baseline: se enseñan organismo, `edicion` y «descargada el».
Runtime evidence: la fecha de descarga no es la de última actualización de la base. Los servidores sí la dan: `last-modified: Tue, 09 Jan 2024` (BCCA) y `Last-Modified: Tue, 23 Jun 2026` (Extremadura), curl del 2026-10-24. `edicion` es texto libre («V02 · enero 2024»).
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R11 fecha mostrada | `edicion` en texto y «descargada el» | el catálogo gana `actualizada` (fecha ISO de la edición, la publicada por el organismo); la fila del modal y el selector enseñan «actualizada el 09/01/2024 · descargada el 24/10/2026» | igual que hoy: `edicion` ya lleva mes y año | investigar ≤30 min qué fecha da cada organismo y volver a preguntar | aplazar a TODOS |
| R1–R10 | approved | igual | igual | igual | igual |

Question D16:
D16 — ¿Se enseña la fecha de actualización de la base, además de la de descarga?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: el plan enseña «descargada el 24/10/2026» y dice que así se cumple la ley de reutilización, pero esa ley pide la fecha de última actualización de la base, que es otra: la BCCA se actualizó el 09/01/2024 aunque la bajes hoy. Hoy esa fecha solo va dentro del texto de la edición («V02 · enero 2024»). La propuesta añade la fecha exacta al catálogo y la enseña junto a la de descarga.
Si elegimos mal: la cita de la fuente no lleva la fecha que pide la ley.
Recomendación: A porque es un campo más en el catálogo y completa la cita que el plan ya da por cumplida.
Completeness: A=9/10, B=6/10, C=6/10, D=5/10
Net: una fecha más en el catálogo frente a una cita con la fecha equivocada.
Header: Fecha
Options:
A) Añadir «actualizada el» (recommended)
✅ La cita queda completa: organismo, edición, actualizada el 09/01/2024 y descargada el día que la bajaste. ✅ Es un dato fijo por edición: se escribe una vez al añadir la entrada al catálogo. ❌ Un campo más que mantener a mano en cada entrada del catálogo. (human: ~30 min / CC: ~5 min)
B) Como hoy
✅ `edicion` ya dice el mes y el año, que para una persona basta. ✅ Ningún campo nuevo. ❌ No hay fecha exacta de actualización en la cita.
C) Investigar antes
✅ Media hora para ver si todos los organismos publican una fecha fiable. ✅ No compromete nada. ❌ R11 queda pendiente y bloquea cerrar la revisión.
D) Aplazar a TODOS
✅ El catálogo sale con un campo menos. ✅ La deuda queda apuntada. ❌ La cita va sin la fecha que pide la ley hasta que se haga.

State: approved
Actual answer: A) Añadir «actualizada el» (D16, 2026-10-24)
Accepted scope: `BaseOficial.actualizada` (fecha ISO de la edición); `fuenteOficial` la copia al importar; la fila del modal y el selector enseñan «actualizada el … · descargada el …»; test del catálogo (fecha válida) y del texto del selector; plan §1 y §3 actualizados.
History: —

#### R12: las reglas de Extremadura (E3) son globales
Finding: X5, P2, confidence 9/10, señalado por Codex (salida no validada) y comprobado por Claude en `src/core/rcd/reglas.ts:239`.
Plan baseline: E3 «códigos de demoliciones en residuos, con test sobre partidas reales de la base» (aprobado como alcance en D4).
Runtime evidence: `export function proponerResiduo(p: Pick<Partida, 'code' | 'title' | 'desc' | 'ud'>, enGestion = false)`: la regla solo ve código, texto y unidad, no de qué banco viene la partida, y decide con `CODIGO_DEMOLICION.test(p.code.toUpperCase())`. Un prefijo nuevo para Extremadura se aplica también a la BCCA, a Precio Centro, a CYPE y a los códigos propios del usuario.
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R12 E3 reglas de Extremadura | prefijos añadidos a la regla global; tests solo positivos | E3 sigue, pero cada prefijo nuevo lleva tests negativos: ninguna partida de la BCCA (`BCCA2023_V02.bc3`), de Precio Centro (`centro2017_clasica.bc3`) ni de la obra de ejemplo cambia de propuesta (instantánea antes/después sobre las tres, en `docs/spike/samples/`, que no se sube; en la CI, un juego pequeño de códigos copiados a mano) | E3 tal cual el plan | investigar ≤1 h si los códigos de demolición de Extremadura chocan con los de otras bases y volver a preguntar; E3 queda en espera | aplazar solo los tests negativos a TODOS; E3 sigue en el plan como está |
| R1–R11 | approved | igual | igual | igual | igual |

Question D17:
D17 — ¿Cómo entran las reglas de residuos de Extremadura (E3) sin estropear las de otras bases?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: para que el estudio de residuos reconozca las demoliciones de Extremadura, E3 añade sus prefijos de código. Pero la regla no sabe de qué base viene cada partida (reglas.ts:239): mira el código y el texto y ya. Un prefijo nuevo puede hacer que una partida de la BCCA o un código tuyo se proponga de pronto como demolición. El plan solo prueba que acierta con Extremadura, no que no falla con las demás.
Si elegimos mal: tras E3, el estudio de residuos de una obra con la BCCA cambia sin que nadie lo haya tocado.
Recomendación: A porque una instantánea antes/después sobre las bases que ya tenemos detecta cualquier choque, y E3 sigue dando valor a Extremadura.
Completeness: A=10/10, B=5/10, C=7/10, D=6/10
Net: tests negativos sobre tres bases frente a cambiar en silencio residuos ya propuestos.
Header: Reglas E3
Options:
A) E3 con tests negativos (recommended)
✅ Instantánea de propuestas antes y después de E3 sobre la BCCA, Precio Centro y la obra de ejemplo: ninguna cambia. ✅ En la CI, un juego pequeño de códigos copiados a mano, sin subir las bases (no tenemos licencia). ❌ Los ficheros grandes solo están en `docs/spike/samples/`: la instantánea completa se pasa a mano, no en la CI. (human: ~3 h / CC: ~20 min)
B) E3 tal cual el plan
✅ Menos tests: solo partidas de Extremadura que deben acertar. ✅ E3 sale antes. ❌ Un prefijo que choque con la BCCA o con códigos propios cambia propuestas sin que nada avise.
C) Investigar antes
✅ Una hora para ver si los prefijos de Extremadura chocan de verdad con los de otras bases. ✅ Si no chocan, A sale más barata. ❌ E3 queda en espera y R12 bloquea cerrar la revisión.
D) Aplazar los tests negativos
✅ E3 sale como dice el plan y los tests negativos quedan apuntados en TODOS. ✅ No hace falta preparar el juego de códigos ahora. ❌ Mientras tanto, un choque de prefijos cambia propuestas de otras bases sin que nada avise.

State: approved
Actual answer: A) E3 con tests negativos (D17, 2026-10-24)
Accepted scope: E3 como el plan más: instantánea de `proponerResiduo` antes/después sobre la BCCA, Precio Centro y la obra de ejemplo (`docs/spike/samples/`, a mano, sin subirlas); en la CI, un test con un juego pequeño de códigos de esas bases copiado a mano que no debe cambiar de propuesta; plan, Etapas actualizado.
History: —

#### R13: el uso en presupuestos para clientes, ¿es «uso privado»?
Finding: X6, P2, confidence 7/10, señalado por Codex (salida no validada) contra la «Conclusión legal» del plan; comprobado por Claude en la página oficial de la base.
Plan baseline: «Conclusión legal: que la descargue el navegador del usuario desde la web oficial es "la descarga y el uso privado" que permite Extremadura»; D4 del plan (correos) solo pide permiso para alojarla.
Runtime evidence: el aviso legal del portal (§7) limita la licencia a «la descarga de dicho contenido y el uso privado» y prohíbe reproducir o distribuir sin autorización. Pero la página de la base (juntaex.es/w/base-precios-construccion-2026, leída el 2026-10-24) dice en «Destinatarios»: «Técnicos redactores de proyectos de construcción y directores de obras, empresas promotoras y constructoras, y todo tipo de usuarios, sean profesionales o no del sector», con «Fecha de actualización 11/8/2026». La base se publica para redactar presupuestos; lo que el aviso legal restringe es redistribuirla.
Comparison grid:

| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R13 justificación del uso | «uso privado» del aviso legal | la conclusión legal del plan cita también los «Destinatarios» de la página oficial; la línea `condiciones` del catálogo dice «Publicada para redactores de proyectos y constructoras. Sin permiso para redistribuirla: se descarga de la web oficial»; los correos de D4 preguntan además, de forma expresa, por usar sus precios en presupuestos entregados a clientes | el plan tal cual | investigar: pedir antes respuesta a la Junta y no publicar la fila de Extremadura hasta tenerla | aplazar solo el cambio de los correos; el resto como A |
| R1–R12 | approved | igual | igual | igual | igual |

Question D18:
D18 — ¿Cómo dejamos justificado que se pueden usar sus precios en presupuestos para clientes?
Proyecto/rama: concreta-mediciones en main, plan de bases oficiales.
ELI10: el plan se apoya en el aviso legal del portal de Extremadura, que solo permite «la descarga y el uso privado». Codex objeta que hacer presupuestos para clientes quizá no sea «uso privado». Lo he comprobado: la propia página de la base dice que está publicada para «técnicos redactores de proyectos… empresas promotoras y constructoras». Lo que el aviso legal prohíbe es redistribuirla, y eso la app no lo hace. La propuesta cita esa frase en el plan y en la fila del catálogo, y pide a la Junta que lo confirme por escrito.
Si elegimos mal: si nos quedamos solo con «uso privado», el plan se apoya en el argumento más débil; si esperamos a la Junta, Extremadura no sale hasta que contesten.
Recomendación: A porque la página oficial ya dice para quién es la base, y el correo deja la confirmación por escrito sin bloquear el trabajo.
Note: options differ in kind, not coverage — no completeness score.
Net: apoyarse en lo que dice la propia publicación frente a esperar una respuesta que puede tardar meses.
Header: Uso legal
Options:
A) Citar destinatarios y confirmar (recommended)
✅ El plan y la fila del catálogo citan la página oficial: la base es para redactores de proyectos y constructoras. ✅ Los correos de D4 piden confirmar por escrito el uso en presupuestos para clientes, sin bloquear E1. ❌ Hasta que contesten, la justificación es nuestra lectura de su página, no una autorización. (human: ~30 min / CC: ~5 min)
B) El plan tal cual
✅ Nada que cambiar en el texto ni en los correos. ✅ La descarga sigue siendo desde la web oficial, sin redistribuir. ❌ La conclusión legal se apoya solo en «uso privado», que es lo más discutible.
C) Esperar a la Junta
✅ Extremadura solo sale con permiso escrito para ese uso. ✅ Cero riesgo de interpretar mal su aviso legal. ❌ La base más actual, la 2026, queda fuera del catálogo durante meses, quizá indefinidamente.
D) Aplazar el correo
✅ El plan y el catálogo citan los destinatarios, igual que en A. ✅ No hay que redactar ahora la pregunta a la Junta. ❌ Sin confirmación escrita, nadie lo vuelve a mirar hasta que haya un problema.

State: approved
Actual answer: A) Citar destinatarios y confirmar (D18, 2026-10-24)
Accepted scope: la conclusión legal del plan cita los «Destinatarios» de la página oficial; la línea `condiciones` de Extremadura dice «Publicada para redactores de proyectos y constructoras. Sin permiso para redistribuirla: se descarga de la web oficial»; los correos de §6 piden además confirmar por escrito el uso en presupuestos para clientes; no bloquea E1. Mandar los correos sigue siendo la D4 del plan.
History: —

Approval readiness: PASS. Comprobadas R1 (D5), R2 (D6), R3 (D7 y D13), R4 (D8), R5 (D9), R6
(D10), R7 (D11), R8 (D12), R9 (D14), R10 (D15), R11 (D16), R12 (D17) y R13 (D18), cada una con
su respuesta. Alcance: D2, D3 y D4. TODOs: D19 y D20.

### Hallazgos y disposiciones

Paso 0, alcance (Claude):
- [P2] (9/10) plan §Archivos, `useBc3Parse.ts`: no hace falta cambiarlo (`useBc3Parse.ts:33`). Corrección de hecho, aplicada.
- [P2] (9/10) plan §2: la barra sobre `Content-Length` no funciona con Extremadura (gzip). R1, aceptada (D5).
- [P2] (8/10) plan §3: la fuente solo en la meta se pierde en `reconcile`. R2, aceptada (D6).
- [P2] (8/10) plan §2: nada impide dos descargas a la vez ni aborta al cerrar. R3, aceptada (D7).
- Corrección de datos: la URL de Extremadura sin `?t=`. Aplicada.

Sección 1, arquitectura:
- [P2] (8/10) `ReferenciaImportModal.tsx`: con la cuota llena el error es genérico. R4, aceptada (D8).
- [P2] (9/10) `ReferenciaImportModal.tsx`: sin obra activa, la base pasa a ser el presupuesto. R5, aceptada (D9).

Sección 2, calidad de código:
- [P2] (9/10) plan §1: `comprobar.mjs` con HEAD normal no ve el tamaño de Extremadura ni la CORS. R6, aceptada (D10).

Sección 3, tests:
- [P1] (9/10) CRITICAL regresión: `ReferenciaImportModal.test.tsx` no cubre lo que hace hoy el modal. R7, aceptada (D11): E0.

Sección 4, rendimiento: sin hallazgos. La descarga de 18,7 MB hace como mucho tres copias en
memoria de corta vida (trozos, `File`, `readBytes`); el paso al worker transfiere el buffer sin
copiar (`parseBc3.ts:57`, `worker.postMessage(bytes, [bytes.buffer])`). El tamaño en IndexedDB y
el tiempo de parseo se miden en E1 (§4).

Segunda opinión (Codex terminó, salida no validada; seis observaciones comprobadas por Claude
en el código):
- [P1] (9/10) `registry.ts:378`: una referencia huérfana vuelve como obra propia. R8, aceptada (D12).
- [P1] (9/10) `ReferenciaImportModal.tsx:92`, `importShared.tsx`, `App.tsx:510`: fuente cruzada, zona de soltar viva y aborto que no llega. R3 reabierta, ampliación aceptada (D13).
- [P2] (9/10) `importShared.tsx` (`accept=".bc3"`): el plan B pierde la base elegida. R9, aceptada (D14).
- [P2] (8/10) `copySlice.ts:153`: lo copiado no dice base ni edición. R10, aceptada (D15).
- [P3] (8/10) plan §3: la fecha de descarga no es la de actualización. R11, aceptada (D16).
- [P2] (9/10) `reglas.ts:239`: los prefijos de E3 son globales. R12, aceptada (D17).
- [P2] (7/10) plan, conclusión legal: «uso privado» y presupuestos para clientes. R13, aceptada (D18).

### NOT in scope

- Bases de pago (IVE, BEDEC, Precio Centro, PREOC) y la base entera de CYPE: no son libres.
- Galicia (BDCG): página caída el 2026-10-24; TODO aceptado (D20).
- País Vasco y Castilla y León: con registro o sin actualizar desde 2015.
- Precargar bases en el repo o en el despliegue: sin permiso escrito (TODO D19).
- Actualizar bases solas en segundo plano: el plan solo avisa de edición nueva.
- Marcar como `soloReferencia` las referencias importadas antes de este cambio: siguen como hoy (R8).
- Identidad de banco en `proponerResiduo`: E3 se protege con tests negativos (D17), sin rediseñar la regla.

### What already exists

- `useBc3Parse().handleFile(file)`: se reutiliza tal cual con el `File` de la descarga.
- `importObraAsReference` y `newObra` (`src/persist/sync.ts`): guardar como referencia y crear obra en blanco (D9).
- `leerDirectorio` y `leerEntrada` (`src/persist/zip.ts`): el ZIP de la BCCA, con tope de lo descomprimido.
- `esCuotaLlena` y `espacioNavegador` (`src/persist/planos.ts`): aviso y mensaje de cuota (D8).
- `metaOf` (`src/persist/registry.ts`): ya deriva `huellas` de los datos; ahora también `fuente` y `kind` (D6, D12).
- `baseSource` en cada partida copiada (`copySlice.ts`): lleva el nombre del catálogo (D15).
- Campos libres en `Obra` (`types.ts:302`): `fuenteOficial` y `soloReferencia` sin subir el esquema.

### Diagrama: descarga de una base oficial

```
fila del catálogo
  ├─ con descarga ──► «Descargar y añadir»
  │     ├─ ¿ya la tienes (baseId + edición)? ── sí ──► «Usar»: seleccionar, sin fetch
  │     ├─ ¿cabe? espacioNavegador() < bytes × k ── no ──► aviso con lo libre (D8)
  │     ├─ reset() del resumen anterior; descargando = true;
  │     │  filas, zona de soltar y «Añadir» desactivados (D7, D13)
  │     ├─ fetch(url, AbortController) → getReader() → progreso = leído / bytes, tope 99 % (D5)
  │     │     ├─ Cancelar / desmontar ──► abort; no se llama a handleFile
  │     │     └─ error (CORS, red, 404) ──► plan B (abajo)
  │     ├─ ¿zip? → leerDirectorio: una sola entrada .bc3; si no, error claro
  │     └─ handleFile(new File([bytes], nombre)), con la fuente atada a la operación
  └─ sin descarga, o plan B ──► «Abrir página oficial» + zona de soltar asociada a la base (D14)
        └─ soltar .bc3 o .zip ──► operación nueva con la fuente de esa base

resumen → «Añadir como referencia»
  ├─ activeId === null ──► newObra() ── null ──► aviso, no se guarda nada
  │                                 └─ ok ───► importObraAsReference (D9)
  └─ importObraAsReference(datos con denominación del catálogo, fuenteOficial, soloReferencia)
        ├─ esCuotaLlena(e) ──► «No cabe en el navegador…» (D8)
        ├─ otro error ──► mensaje genérico, se puede reintentar (E0, contrato 3)
        └─ ok ──► metaOf: fuente y kind a la meta; seleccionar obra:<id>; aviso; cerrar
```

### Failure modes

| Camino | Fallo realista | Test | Manejo | El usuario ve |
|---|---|---|---|---|
| fetch | la Junta cambia la URL (404) o quita la CORS | `descargaBase.test.ts` (404, TypeError) | plan B con la base asociada | mensaje y «Abrir página oficial» |
| progreso | el fichero cambia de tamaño | test con `bytes` distinto | tope 99 %; `comprobar.mjs` avisa | barra que se para en 99 % hasta acabar |
| ZIP | la BCCA publica un ZIP con dos ficheros | test de ZIP con 0 y 2 entradas | error claro | «El ZIP no trae un único .bc3» |
| guardar | cuota llena entre blob e índice | test de fallo entre escrituras | marca `soloReferencia` (D12) y mensaje de cuota (D8) | mensaje claro; la base vuelve como referencia |
| operación | resumen viejo + descarga nueva | test de fuente cruzada | `reset()` y «Añadir» desactivado (D13) | no se puede guardar a mitad |
| cierre | cerrar el modal a mitad | test de desmontar | aborto en la limpieza | nada queda descargando |
| E3 | un prefijo choca con la BCCA | instantánea y juego de códigos | tests negativos (D17) | ninguna propuesta cambia |

Huecos críticos: 0. Todos los caminos tienen test aprobado y un error visible.

### Cobertura de tests (planificada)

```
CODE PATHS                                        USER FLOWS
[+] core/basesOficiales.ts                        [+] Descargar y añadir
  └── catálogo: pagina, comprobada, actualizada,     ├── [GAP→plan] BCCA (ZIP) de punta a punta
      bytes>0 si hay descarga  [GAP→plan]            ├── [GAP→plan] Extremadura con gzip
[+] features/importar/descargaBase.ts                ├── [GAP→plan] «Usar» sin fetch
  ├── progreso sobre bytes, tope 99 % [GAP→plan]     └── [GAP→plan] [→E2E] /qa contra las URL reales
  ├── abort (Cancelar, desmontar)     [GAP→plan]  [+] Plan B
  ├── 404 / TypeError de CORS         [GAP→plan]     ├── [GAP→plan] Madrid con la app vacía
  └── ZIP 1 / 0 / 2 entradas, dañado  [GAP→plan]     └── [GAP→plan] ZIP de la BCCA soltado a mano
[+] ReferenciaImportModal.tsx                     [+] Errores
  ├── E0 contrato 1–4 (regresión)     [GAP→E0]       ├── [GAP→plan] cuota: aviso previo y al guardar
  ├── operación: reset, «Añadir» off  [GAP→plan]     └── [GAP→plan] doble clic / soltar al descargar
  └── sin obra → newObra → referencia [GAP→plan]
[+] persist: metaOf, reconcile, isMeta
  ├── fuente y kind derivados         [GAP→plan]
  └── huérfano con y sin marca        [GAP→plan]
[+] core/rcd/reglas.ts (E3): negativos [GAP→plan]
[★★ TESTED] importObraAsReference — src/persist/importReference.test.ts
[★  TESTED] modal abre/cierra — ReferenciaImportModal.test.tsx:15, :26

COVERAGE hoy: 2/20 caminos con test; con el plan, 20/20 con test aprobado.
Legend: ★★ happy path | ★ smoke | [GAP→plan] test aprobado en el plan | [→E2E] pasada de /qa
```

Plan de QA guardado en
`~/.gstack/projects/jramirezbandera-concreta-mediciones/javie-main-eng-review-test-plan-20261024-220504.md`.

### Worktree parallelization strategy

| Paso | Módulos | Depende de |
|---|---|---|
| E0 tests de regresión | features/importar | — |
| E1 catálogo y descarga | core/, features/importar | E0 |
| E2 fuente, marca y ediciones | persist/, core/, features/referencia | E1 |
| E3 reglas de Extremadura | core/rcd | — |
| E4 comprobar.mjs | scripts/ | E1 (el catálogo) |

Lane A: E0 → E1 → E2 (comparten features/importar y el catálogo). Lane B: E3 (independiente).
Lane C: E4 tras E1. Orden: lanzar A y B; al acabar E1, lanzar C. Conflictos: ninguno entre
lanes; E2 y E4 solo leen el catálogo de E1.

### Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~1,5 h / CC: ~10 min)** — modal — tests de regresión E0 en commit propio
  - Surfaced by: Tests — R7 (D11)
  - Files: src/features/importar/ReferenciaImportModal.test.tsx
  - Verify: `npx vitest run src/features/importar/ReferenciaImportModal.test.tsx` en verde contra el código de hoy
- [ ] **T2 (P1, human: ~3 h / CC: ~20 min)** — catálogo y descarga — `basesOficiales.ts` y `descargaBase.ts` con progreso, abort y ZIP
  - Surfaced by: Alcance D4; R1 (D5), R3 (D7, D13)
  - Files: src/core/basesOficiales.ts, src/features/importar/descargaBase.ts (+ tests)
  - Verify: tests de gzip sin `Content-Length`, abort y ZIP de 0, 1 y 2 entradas
- [ ] **T3 (P1, human: ~3 h / CC: ~20 min)** — modal — lista de bases, operación atada, plan B asociado, sin obra, cuota
  - Surfaced by: R3 (D13), R4 (D8), R5 (D9), R9 (D14)
  - Files: src/features/importar/ReferenciaImportModal.tsx, src/features/importar/importShared.tsx (`disabled`) (+ tests)
  - Verify: tests del modal; los de E0 siguen en verde sin tocarlos
- [ ] **T4 (P1, human: ~2 h / CC: ~15 min)** — persist — `fuenteOficial`, `soloReferencia`, `metaOf`, `reconcile`, `isMeta`
  - Surfaced by: R2 (D6), R8 (D12)
  - Files: src/core/types.ts, src/persist/registry.ts, src/persist/sync.ts (+ tests)
  - Verify: un huérfano con marca vuelve como referencia; la fuente sobrevive a `reconcile` y a la copia `.json`
- [ ] **T5 (P2, human: ~1 h / CC: ~8 min)** — atribución — nombre del catálogo y «actualizada el»
  - Surfaced by: R10 (D15), R11 (D16)
  - Files: src/features/importar/ReferenciaImportModal.tsx, src/features/referencia/ReferenciaPanel.tsx
  - Verify: el `baseSource` de una partida copiada lleva base, edición y organismo
- [ ] **T6 (P2, human: ~3 h / CC: ~20 min)** — residuos — E3 con tests negativos
  - Surfaced by: R12 (D17)
  - Files: src/core/rcd/reglas.ts (+ test)
  - Verify: instantánea antes/después sobre las tres bases sin cambios; test del juego de códigos en la CI
- [ ] **T7 (P2, human: ~1,5 h / CC: ~8 min)** — script — `comprobar.mjs`
  - Surfaced by: Alcance D2; R6 (D10)
  - Files: scripts/bases/comprobar.mjs
  - Verify: `node scripts/bases/comprobar.mjs` sale con 0 hoy y con 1 si se cambia un `bytes`
- [ ] **T8 (P3, human: ~30 min / CC: ~5 min)** — textos — `condiciones` de Extremadura
  - Surfaced by: R13 (D18)
  - Files: src/core/basesOficiales.ts
  - Verify: la fila de Extremadura muestra la línea de D18

### TODOs aceptados (no persistidos en TODOS.md)

TODOS.md tiene cambios del usuario sin subir y no se toca. Los dos TODOs aceptados quedan aquí:

- **Correos de permiso a las Juntas (D19).** Qué: un correo a la Junta de Andalucía y otro a la de Extremadura. Piden confirmar por escrito el uso de sus precios en presupuestos para clientes, y autorización para servir la base desde la app. Por qué: la justificación legal es hoy nuestra lectura de su página. Pros: confirmación escrita y posible precarga. Contras: puede tardar meses o no llegar. Contexto: plan, «Conclusión legal» y §6. Depende de: nada; no bloquea E0–E4.
- **Galicia, BDCG (D20).** Qué: comprobar la descarga directa, la CORS y la licencia de la BDCG cuando su página vuelva, y añadirla como entrada del catálogo. Por qué: base libre con dos ediciones al año. Pros: cuarta base libre. Contras: tarea sin fecha, depende de la Xunta. Contexto: el 2026-10-24, `igvs.xunta.gal/base-datos-construccion` daba 404 y presupuesta.com 403. Depende de: E1 (el catálogo); se prueba con `comprobar.mjs`.

### Unresolved decisions

Ninguna en esta revisión.

### Completion summary

- Step 0: Scope Challenge — scope accepted as-is (Madrid y comprobar.mjs dentro; estructura más pequeña, D4)
- Architecture Review: 2 issues found
- Code Quality Review: 1 issue found
- Test Review: diagram produced, 18 gaps identified (todos con test aprobado)
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 2 items proposed to user (aceptados; no persistidos en TODOS.md)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, unavailable (terminó, pero la salida no pasó la validación; sin plan alternativo nativo porque no hay TaskOutput; sus 6 observaciones, comprobadas por Claude, abrieron R8–R13 y reabrieron R3)
- Parallelization: 3 lanes, 2 parallel / 1 sequential
- Lake Score: 12/12 = opciones completas elegidas en las preguntas de cobertura (D5–D17; D18 es de tipo)

### Suppressed findings

- [P3] (4/10) Guardar un `sha256` por base en el catálogo para detectar un fichero cambiado en la misma URL. Lo cubren en buena parte `bytes` y `comprobar.mjs` (D10); no se propone.
- [P3] (4/10) Pasar los bytes descargados directamente a `parseBc3` sin construir un `File`, para ahorrar una copia de 18,7 MB. Copia corta y sin efecto medible esperado; se mide en E1.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex (`/plan-eng-review` outside voice) | Independent 2nd opinion | 1 | unavailable | salida no validada; 6 observaciones comprobadas por Claude |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | ISSUES OPEN (PLAN) | 13 issues, 0 critical gaps (todos con remedio aprobado) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review, unavailable: el CLI terminó, pero su informe no pasó la validación (línea de recomendación en castellano) y no había plan alternativo nativo (sin TaskOutput). Sin cobertura externa válida; sus observaciones solo se usaron después de comprobarlas Claude en el código.
- **VERDICT:** ninguna revisión CLEAR; los 13 hallazgos tienen remedio aprobado y el plan está listo para implementar desde E0 — eng review required

NO UNRESOLVED DECISIONS
