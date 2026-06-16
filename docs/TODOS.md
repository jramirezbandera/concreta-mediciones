# TODOS — Concreta · Mediciones

Trabajo aplazado, capturado con contexto. No son bullets vagos: cada uno tiene el porqué y dónde empezar.
Origen: revisión de ingeniería (`/plan-eng-review`) + voz externa Codex, 2026-06-08.

---

## T-1 · Banco de recursos: clave consciente de fuente (evitar colisión de códigos)
- **Qué:** el banco de recursos se indexa por `code`. Distintas bases (Presto, Arquímedes, BDT, CYPE) reutilizan el mismo código para conceptos/precios distintos.
- **Por qué:** al copiar desde Referencia o importar varios .bc3, el merge "sin pisar homónimos" puede ligar silenciosamente dos conceptos diferentes al mismo código → precios incorrectos en partidas que creías independientes. Confirmado por Codex (cross-model).
- **Pros:** integridad de datos al mezclar fuentes; el "puente .bc3" multi-base no corrompe el presupuesto propio.
- **Cons:** clave compuesta (fuente+código) o namespacing añade complejidad al modelo del banco y a `recursoUsage`.
- **Contexto / dónde empezar:** hoy `Item` guarda `{code, type, cantidad}` y el banco es `recursos[code]`. Diseñar clave `{source, code}` o un id interno con alias por fuente. Mantener el invariante de edición compartida dentro de una misma fuente.
- **Depende de / bloqueado por:** F5 (Referencia) e import multi-base. Aplazado tras el Hito 1.
- **DISPARADO por multi-obra (eng-review 2026-06-13):** copiar partidas ENTRE TUS PROPIAS obras hace la colisión de código mucho más probable (el mismo estudio reusa `mo113`, `mt10haf010`… con precios que derivan año a año). `copyRefPartidas` con `if(!recursos[code])` se queda con el existente → el descompuesto copiado calcula con el precio equivocado en silencio. **Mitigación v1 (no T-1 completo):** AVISO interactivo de colisión al copiar (detectar código existente con precio/desc distinto, con tolerancia/normalización para no avisar por redondeo/espacios/mayúsculas) + opción fusionar vs **bifurcar** (crear el recurso entrante bajo código derivado y reescribir `item.code` de forma consistente en todas las partidas copiadas, con id único estable). La **clave compuesta `{source,code}` completa SIGUE aplazada** aquí; v1 resuelve el caso de copia sin rehacer el modelo del banco.

## T-2 · Inmutabilidad y auditoría de certificaciones
- **Qué:** al emitir una certificación debería quedar "congelada" (snapshot). Hoy editar una cert antigua recalcula en silencio las siguientes vía el encadenado "anterior".
- **Por qué:** la certificación es un documento de cobro. Alterar importes ya certificados/cobrados sin rastro es inaceptable ante propiedad/constructora.
- **Pros:** trazabilidad de cobro; certs reproducibles; export con snapshot.
- **Cons:** cambia el modelo de datos de `Cert` (estado emitida/borrador, snapshot de cantidades y precios al emitir).
- **Contexto / dónde empezar:** hoy `Cert.data[partidaId]` es editable libremente y `prevData` es la cert previa de la lista. Añadir estado `draft|issued`, congelar precios/cantidades al pasar a `issued`, y decidir qué pasa al editar una emitida (bloquear o versionar).
- **Depende de / bloqueado por:** decidir antes de usuarios externos. Para el dogfood en solitario (tú, una obra) la edición libre vale.
- **Prioridad CONDICIONAL al spike legal (revisión CEO 2026-06-08, D3 + Codex #13):** el resultado de la tarea 1 del spike (§0.5 del plan) gobierna esto. **Si la cert es un documento legal de cobro** → T-2 deja de estar aplazado y **entra en F4** (estado emitida/borrador + snapshot, sin retro-edición silenciosa). **Si es documento de trabajo** → sigue aplazado. No pre-comprometer hasta cerrar el spike. Dos modelos (revisión + Codex) coinciden en que editar certs históricas sin inmutabilidad invalida la cert para uso real.
- **AFINADO (eng-review F4, 2026-06-10, voz externa Codex #4/#5/#13):** el vector NO es solo "editar una cert". Editar el **PRESUPUESTO** (precio de recurso, `coefK`, medición) con certs ya hechas reescribe en silencio importes ya certificados, porque `core/certificacion.certCalc` lee `p.precio`/medición EN VIVO. F4 lo mitiga en parte: **contradictorios cert-local** (el trabajo extra no obliga a mutar el presupuesto) + **snapshot de cantidad ejecutada por línea/cert** (`Cert.lineQty`, que congela la cantidad frente a ediciones de medición). **RESIDUO:** el PRECIO sigue leyéndose en vivo → editar un recurso mueve importes históricos. Opciones para el T-2 propio: "solo la última cert editable", o snapshot de precio/ofertada por cert al certificar. **Decisión (eng-review F4):** afinar y seguir aplazado (postura del spike: working doc, solo); hacerlo BIEN (con estado borrador/emitida) antes de uso externo, no a trozos.
- **RESIDUO DE PRECIO → RESUELTO en F7.0 (eng-review F7, 2026-06-10, Codex cross-model; IMPLEMENTADO 2026-06-11):** exportar una cert (F7.1) la convierte en documento; con precio en vivo, una edición posterior la haría irreproducible. **Decisión: SNAPSHOT de precio por cert al certificar** (`Cert.priceSnapshot` + `coefK` congelado + `snapshotAt`; espeja `Cert.lineQty`), entró como **F7.0** antes del export. Cierra el residuo de PRECIO: congela al certificar la partida (primera vez), `addCert` hereda los precios de la última cert y congela los faltantes; certs legadas (pre-F7/seed) siguen en vivo. **Lo que SIGUE en T-2:** estado borrador/emitida + bloqueo/versionado de retro-edición (necesario antes de uso externo, no cubierto por el snapshot).

## T-3 · PDF de certificación de calidad profesional
- **Qué:** el documento de cobro vía `window.print()` (print CSS) puede fallar en paginación, cabeceras de tabla repetidas y saltos de página.
- **Por qué:** la certificación se entrega a propiedad/constructora; una paginación fea da mala imagen y puede confundir importes.
- **Pros:** documento de cobro presentable; base para Word/Excel reales después.
- **Cons:** introducir una lib de PDF (react-pdf / pdfmake) o usar make-pdf de gstack es más trabajo que print CSS.
- **Contexto / dónde empezar:** Hito 1 usa PDF por print (suficiente para validar el dogfood). Antes de entrega externa, evaluar lib de PDF con plantilla de certificación oficial.
- **CONFIRMADO (eng-review F7, 2026-06-10):** F7.1 ship = `window.print()` → "Guardar como PDF" del navegador (documento imprimible, no exportador PDF real; márgenes/nombre/paginación dependen del navegador). Lib de PDF real (react-pdf/pdfmake) sigue APLAZADA aquí, para entrega externa. La paginación/CSS de impresión se valida con QA en navegador real (no jsdom).
- **F7.1 SHIPEADA (2026-06-11):** doc de impresión dedicado (`features/print/`, no la vista viva), QA en Chromium real: paginación A4 con `<thead>` repetido y PEM/líquido al céntimo. Lo que queda aquí: lib de PDF real para entrega externa (márgenes/nombre de archivo controlados, cabecera/pie corporativos).
- **Depende de / bloqueado por:** F7.1 (exporters) ✓ hecha. Aplazado (entrega externa).

## T-4 · Variantes de contrato españolas
- **Qué:** baja de adjudicación, liquidación final, y variantes de retención/IVA por tipo de contrato. El prototipo hornea un solo conjunto de supuestos.
- **Por qué:** distintas obras/contratos calculan distinto (coeficiente de baja sobre PEC, liquidación, retenciones variables). Hornear los supuestos del demo como universales rompe en obra real.
- **Pros:** el modelo encaja con contratos reales, no solo el caso base.
- **Cons:** generaliza el motor económico (riesgo de sobre-ingeniería si se hace sin datos reales).
- **Contexto / dónde empezar:** hoy `rates` = {iva, gg, bi} + retención por cert. Explorar con obras reales qué variantes aparecen antes de generalizar. M1 usa el caso base.
- **Depende de / bloqueado por:** validación con obras reales (la tarea del dogfood). No bloquea M1.

---

> Añadidos en `/plan-eng-review` post-F0 (2026-06-08).

## T-5 · CI/CD (GitHub Actions: build + test + lint en push; deploy en merge a main)
- **Qué:** workflow de CI que corra `npm ci && npm run build && npm test && npm run lint` en cada push/PR, y un deploy estático (Vercel/Netlify/Cloudflare Pages) al hacer merge a `main`.
- **Por qué:** el design doc (Distribution Plan) lo pide explícitamente. Para un fundador solo, una CI que rompa el build ante una regresión es la red de seguridad barata; hoy nada verifica el árbol salvo correr los comandos a mano.
- **Pros:** regresiones detectadas antes de mergear; despliegue reproducible; base para el canal de adopción web.
- **Cons:** requiere remoto en GitHub configurado (hoy el repo es local) y elegir host de deploy. Trabajo ~30min CC una vez haya remoto.
- **Contexto / dónde empezar:** `.github/workflows/ci.yml` con node 22, cache de npm, los 4 comandos. El deploy puede esperar a que haya un host elegido; el CI de verificación no.
- **Depende de / bloqueado por:** tener remoto en GitHub. No bloquea F1 (es infra de distribución, no de dominio).

## T-6 · `parseEsNumber`: ambigüedad del punto como separador
- **Qué:** `core/money.parseEsNumber` quita TODOS los puntos como separador de miles, así que `14.5` (estilo US, o un usuario despistado) se interpreta como `145`, no `14,5`.
- **Por qué:** los usuarios objetivo son arquitectos españoles que escriben formato español (coma decimal), así que el impacto es bajo, pero es un footgun silencioso: el número se corrompe sin aviso.
- **Pros:** entrada numérica más robusta; menos errores de medición por un punto mal puesto.
- **Cons:** heurística (¿cuándo un punto es decimal vs miles?) puede sorprender; sobre-ingeniería si nadie lo sufre.
- **Contexto / dónde empezar:** `app/src/core/money.ts:parseEsNumber`. Posible regla: si hay coma, el punto es miles; si NO hay coma y hay un solo punto con ≤2 decimales, tratarlo como decimal. Cubrir con tests.
- **Ampliación (voz externa Codex, 2026-06-09):** además del punto, `parseEsNumber` usa `parseFloat`, que **acepta entrada parcial malformada**: `"12abc" → 12`, `"1,2,3" → 1.23` o parciales. Para campos de dinero/tasas eso corrompe en silencio. Endurecer: validar con regex la cadena normalizada completa (`/^-?\d+(\.\d+)?$/`) y devolver `null` si no casa entera, en vez de fiarse de `parseFloat`. Mismo sitio, mismos tests.
- **Depende de / bloqueado por:** nada. Recoger en F2 cuando se editen mediciones reales.

## T-7 · Trap de foco en Drawer/modales (a11y arquitectural)
- **Qué:** el `Drawer` (y futuros modales de export/obra) cierran con Esc y clic en overlay, pero NO atrapan el foco dentro del panel mientras está abierto.
- **Por qué:** el design doc §6 marca el trap de foco como **arquitectural, no pulido** ("Modales/drawer: trap de foco + Esc"). Sin él, el teclado se escapa al contenido de detrás; mala a11y y el revisor de diseño lo señaló.
- **Pros:** navegación por teclado correcta; cumple el criterio AA que el design review fijó desde el inicio.
- **Cons:** un poco de plomería (focus-trap propio o `focus-trap-react`); en F0 el drawer solo contiene una sidebar vacía, impacto real bajo hoy.
- **Contexto / dónde empezar:** `app/src/layout/Drawer.tsx`. Al abrir, enfocar el primer foco del panel; ciclar Tab/Shift+Tab dentro; restaurar foco al cerrar. Reutilizable para los modales de F6/F7.
- **Depende de / bloqueado por:** nada. Hacer cuando el drawer tenga contenido interactivo (F2) o al construir el primer modal real (F6).

---

> Añadido en el spike §0.5 (2026-06-08) — requisito de dominio del fundador.

## T-8 · Coeficiente K global editable (cuadrar el PEM a una cifra objetivo)
- **Qué:** un coeficiente global de obra (`coefK`) editable que escala TODOS los precios unitarios (alza o baja: ×1,13, ×0,87, ×0,80…) para cuadrar el PEM a una cifra objetivo. Es el registro `~K` de FIEBDC.
- **Por qué:** flujo real del arquitecto: aunque los precios salgan de una base de precios, se ajusta la obra entera a un PEM dado (p.ej. el aprobado en el ayuntamiento) o el constructor aplica una baja global. Sin K editable no se puede "cuadrar la cifra global" con facilidad, que es justo lo que pidió el fundador. El .bc3 de prueba trae K=+13% (PEM_base 434.777,78 × 1,13 = 491.298,72 = raíz).
- **Pros:** encaja con el flujo real de presupuestación; el import .bc3 respeta el K del archivo; cuadrar a un PEM objetivo es un clic.
- **Cons / decisión abierta:** ¿K se aplica por precio unitario (redondeo por partida) o sobre el PEM? ¿cómo se absorbe el céntimo para cuadrar EXACTO? (Presto deja ~2 cént. de desvío por redondeo; quizá una partida de redondeo, o aplicar K sobre el total). Atado a `core/money` (céntimos enteros, §0 decisión 2).
- **Contexto / dónde empezar:** modelo en `core/types` (`Rates.coefK`, ver §4 del plan); `partidaImporte` usa `precioK = precio · coefK` (§5); el adaptador `importers/bc3` ya parsea K del `~K` (ver `spike/import/bc3-to-prototype.mjs`). UI: campo editable en datos de obra / resumen.
- **Estado tras F1 (eng-review 2026-06-09):** F1 implementó K **como multiplicador del precio unitario** (decisión consciente; el comentario de `core/medicion.ts` lo marca). **Sigue ABIERTO** lo de "cuadrar a un PEM objetivo exacto" (target + absorción del céntimo). Codex (voz externa) lo confirmó como hueco esperado, no bug. Resolver al construir la UI de K en F2/F3.
- **Depende de / bloqueado por:** F1 (motor) lo modela; UI de edición en F2/F3. No bloquea el dogfood (el spike ya aplica K al importar).

## T-9 · F2: sincronización recurso→precio→PEM + test al céntimo de la cadena compartida — ✅ RESUELTO (F2.3, commit `d7835f2`, 2026-06-09)
> Cerrado: `editRecurso` resincroniza `precio = descompUnit` en las partidas sin override (`precioSegunModo`) → cadena recurso→importe→PEM en vivo; +6 tests del invariante (otra partida + PEM, %CI, override aguanta). Se deja el registro por trazabilidad.

- **Qué:** la acción `editRecurso(code)` de F2 debe actualizar `recursos[code]` y **resincronizar** `partida.precio = descompUnit` en las partidas que lo usan **sin** `precioManual` (vía `core/banco.precioSegunModo`), recalculando importes→capítulo→PEM en vivo. Acompañar con un test E2E al céntimo: "editar el precio de `mo001` cambia el importe de las ≥4 partidas que lo comparten y el PEM resultante".
- **Por qué:** es el invariante #1 del plan (banco compartido por código) y la aceptación de F2 ("editar un recurso cambia el importe en otra partida que lo comparte"). Hoy NADIE prueba la cadena recurso→PEM: F1 dejó el motor (`descompUnit`/`precioSegunModo`) y el store, pero la acción de edición y su test son F2. La voz externa Codex (2026-06-09, #1) lo marcó como el hueco principal.
- **Pros:** red de regresión sobre el invariante más fácil de romper; cierra el bucle "editar recurso recalcula todo".
- **Cons:** requiere la acción de edición de recursos de F2 (no existe aún).
- **Contexto / dónde empezar:** `core/banco` ya tiene `precioSegunModo`/`precioCuadraDescompuesto` (este último ya compara en céntimos tras la eng-review). El seed marca `precioManual` donde el precio es autoridad (no se colapsa). Falta: acción `editRecurso` en `store/obraStore` + test en `store/`. 
- **Depende de / bloqueado por:** F2 (vista Presupuesto). Relacionado con T-8 (K) y la decisión §0.6 (override).

---

> Añadidos en `/plan-eng-review` de F6 (eng run 5, 2026-06-10). Aplazados por decisión del fundador (D2-A / Issue 4-A).

## T-10 · Gestión multi-proyecto (lista de obras) — EN CURSO (eng-review 2026-06-13)
> **EN IMPLEMENTACIÓN** (diseño `Javier-main-design-20260613-175339.md` + esta eng-review). Enfoque: store de UNA obra viva + registro multi-obra; pestañas que CONMUTAN (no N vivas). Decisiones clave: **índice persistido** de obras (no derivar de blobs — por rendimiento de arranque: leer un blob pequeño de metadatos + cargar solo la obra activa, las demás perezosas) con reconciliación barata vía `keys()`; selector de obra como **dropdown** junto al nombre (no pestañas en la fila de vistas); ✕ = borrar con confirmación (no se borra la última → semilla); copiar entre obras reusa `copyRefPartidas` con **aviso de colisión de recurso** (ver T-1). Se aterriza en 3 PRs (registro+migración / pestañas / Referencia-desde-obra). Restos abiertos: T-19 (multi-pestaña navegador), T-1 (clave compuesta completa).
- **Qué:** poder tener VARIAS obras: lista/selector de proyectos, crear/duplicar/borrar, "obra activa", cambiar entre ellas.
- **Por qué:** hoy el dogfood es una obra y F6 persiste UN proyecto. Cuando el fundador maneje varias obras a la vez (lo normal en un estudio), hará falta. El plan ya lo marcaba "(opcional)"; se aplazó en F6 (D2-A) para no gastar UI/estado en valor aún no necesitado.
- **Pros:** soporta el flujo real de un estudio con varias obras; aprovecha de pleno una BD local.
- **Cons:** más UI y estado (selector, CRUD de proyectos); puede justificar migrar de `idb-keyval` a Dexie.
- **Contexto / dónde empezar:** F6.1 persiste con `idb-keyval` un blob `ObraData` bajo UNA clave, con envelope `{schemaVersion, savedAt, appVersion, data}`. Para multi-proyecto: clave por `projectId` (en vez de clave única) + un índice de proyectos; si crece en consultas, evaluar **Dexie** (tabla de obras). El envelope y la capa `persist` aislada ya dejan sitio sin migración traumática.
- **Depende de / bloqueado por:** F6 base (persistencia de una obra). No bloquea el dogfood.

## T-11 · Recordar dónde estaba al recargar (estado de UI)
- **Qué:** persistir y restaurar la vista activa + capítulo/sub seleccionado + certificación en curso al recargar, no solo el dominio.
- **Por qué:** comodidad — volver exactamente donde estabas. F6 (Issue 4-A) persiste DOMINIO-SOLO; al recargar se conserva todo el trabajo pero aterrizas en Presupuesto / primer capítulo. Si estabas certificando la cert nº2, vuelves a Presupuesto (fricción menor, cero pérdida de datos).
- **Pros:** UX más pulida ("sigo donde lo dejé"); barato con CC.
- **Cons:** añade una 2ª clave de persistencia y acopla UI a la hidratación, ensuciando la separación dominio/UI limpia que F6 mantiene a propósito (`toSerializable` excluye UI).
- **Contexto / dónde empezar:** una clave aparte (no el blob de dominio) con `{view, active, curCert}`, rehidratada en `useHydrate` tras cargar el dominio. Reusar el gate de hidratación de F6.1. Mantener separada del envelope de dominio.
- **Depende de / bloqueado por:** F6 base. Encaja en **F8 (pulido)**.

---

> Añadidos en `/plan-eng-review` de F7.4 (eng run 7, 2026-06-11). Aplazados por decisión del fundador.

## T-12 · Export de CERTIFICACIONES a BC3 (fases de medición FIEBDC)
- **Qué:** exportar una certificación como .bc3 con mediciones por fases (el mecanismo FIEBDC para certs), no solo el presupuesto.
- **Por qué:** cierra el ciclo del puente arquitecto↔constructora: la cert también viaja en .bc3, no solo en PDF/Word/Excel.
- **Pros:** completa la visión "owning the handoff"; FIEBDC lo soporta de serie.
- **Cons:** la semántica de fases es de lo menos uniforme entre programas; el mapeo `Cert.data`/`lineQty`→fases no es 1:1; necesita un .bc3 de cert real de referencia. Trabajo: human ~2d / CC ~1-2h.
- **Contexto / dónde empezar:** `core/bc3export` (añadir fases a `~M`) + mapeo cert→fase N. Conseguir primero un .bc3 de certificación real (Presto) como ground truth, igual que se hizo con el de presupuesto.
- **Depende de / bloqueado por:** F7.4 (writer base) + fixture real de cert.

## T-13 · Contribuir el writer BC3 upstream a la librería `bc3` (ogorhc, MIT)
- **Qué:** cuando el serializador esté estable y validado en Presto, PR upstream añadiendo `BC3.serialize()` a la librería que ya usamos para parsear.
- **Por qué:** el plan original lo apuntaba ("opción elegante"); mitiga el bus-factor del autor único y blinda el round-trip con los fixtures del ecosistema.
- **Pros:** visibilidad en el nicho FIEBDC; tests de terceros gratis; karma open-source.
- **Cons:** adaptar nuestro writer (serializa NUESTRO modelo) a `BC3Document`; la review del maintainer no está en nuestra mano. Trabajo: human ~1-2d / CC ~1h + ida y vuelta del PR.
- **Contexto / dónde empezar:** tras F7.4b estable; escribir un adapter `ObraData→BC3Document` o emitir desde `BC3Document`.
- **Depende de / bloqueado por:** F7.4 estable y validado en Presto.

## T-14 · Validación del export BC3 en Arquímedes/CYPE (y TCQ) cuando haya acceso
- **Qué:** abrir el .bc3 exportado en Arquímedes (CYPE) — y si surge, TCQ — con la misma checklist del gate manual de Presto (estructura, acentos, PEM al céntimo).
- **Por qué:** la aceptación de F7.4 nombra "Presto/CYPE" pero solo hay Presto a mano; los dialectos FIEBDC difieren justo en los baches (multilínea, charset, %). Sin esto, la mitad CYPE de la aceptación queda sin rastro.
- **Pros:** cubre al segundo lector más común; caza dialectismos antes de que un usuario externo los sufra.
- **Cons:** requiere acceso a Arquímedes (licencia/colega); no automatizable. Trabajo: human ~1h con el programa delante / CC 0.
- **Contexto / dónde empezar:** la checklist ya existe (gate manual de Presto, §F7.4 D5 capa 5); el colega del dogfood podría ejecutarla.
- **Depende de / bloqueado por:** F7.4 shipeada; acceso a CYPE.
- **AVANCE (2026-06-11):** la TRAZADORA (no una obra real) ya se abrió en **Arquímedes 2022** con resultado idéntico a Presto (raíz 4.074,19, descomposición y precio cerrado respetados, acentos/€/— OK). Queda la checklist con una obra completa real cuando F7.4 ruede en el dogfood.

## T-15 · Tokenizar la escala tipográfica (design-review 2026-06-11)
- **Qué:** colapsar las ~23 medidas de `font-size` distintas (con saltos de 0,5px: 11/11,5/12/12,5/13/13,5…) a una escala de ~7 tokens (`--fs-hero/h1/body/table/label/badge/micro`) y cuadrar las medidas sueltas. DESIGN.md describe la escala como rangos ("cuerpo 12,5–13 · tabla 12–13 · badges 9,5–11"), no como tokens, así que el CSS trata el tamaño como variable continua.
- **Por qué:** la diferencia entre 12px/12,5px/13px no es un paso de jerarquía perceptible, es deriva. Una escala tokenizada evita que cada módulo invente su propio tamaño.
- **Cons / por qué NO en el design-review:** toca ~24 ficheros CSS Module a la vez; riesgo de regresión visual alto. Es trabajo de refactor de sistema, no de fix atómico CSS. Cazado por Codex Y subagente (cross-model), severidad MEDIA.
- **Contexto:** los números grande análogos divergen (importe de capítulo 25px vs líquido cert 24px vs su líquido final 22px; H1 23px vs Resumen 25px). Empezar por definir los tokens en `tokens.css` y migrar fichero a fichero con QA visual por vista.

## T-16 · Tokenizar la escala de espaciado (design-review 2026-06-11)
- **Qué:** el padding/gap cae sobre una escala reconocible (4/6/8/12/16/24) pero mezclada con valores fuera de grid (7/9/11/13/14/18/22) que se repiten por copia-pega entre módulos (p.ej. `padding: 9px 14px` en sub-labels idéntico en Presupuesto y Certificaciones). No hay tokens de espaciado: la consistencia se mantiene a mano. Introducir `--space-*` y/o variables de ancho de columna de tabla (`width:116px`/`124px` duplicados).
- **Por qué:** sin tokens, la coherencia depende de no equivocarse al copiar; un token previene la deriva.
- **Cons:** sistematización de bajo riesgo pero amplia (muchos ficheros). POLISH, no bloquea nada. Cazado por Codex + subagente.
- **Depende de:** idealmente junto con T-15 (misma pasada de tokenización).

## ~~T-17 · Jerarquía de N niveles — Fase 2: edición a profundidad (eng-review 2026-06-12)~~ HECHA (2026-06-12)
- **IMPLEMENTADA** en `feat/jerarquia-n-niveles`: `addSubchapter(parentId)` acepta cualquier contenedor; `deleteSubchapter` borra a cualquier profundidad **PROMOVIENDO** (los sub-contenedores pasan al final de los hermanos recodificados con índices libres, las partidas directas suben al padre — se decidió promover, no cascada: borrar nunca destruye ramas ni partidas); nueva `moveSubtree(nodeId, toParentId)` mueve la rama con sus partidas entre buckets de `PartidasMap` recodificándola bajo el nuevo padre (ids estables → las certs no se enteran; rechaza capítulos, destinos fantasma y destinos dentro del propio subárbol). UI: menú ⋮ por fila del sidebar (añadir subcapítulo / mover a / eliminar), alta de partida a cualquier profundidad (fuera el gate `depth<=1`) y "Mover a" de partidas con destinos a cualquier nivel. 8 tests nuevos (429 en verde).
- Pendiente menor: reordenar contenedores por drag&drop (el menú "Mover a" cuelga al FINAL del destino; no hay orden fino entre hermanos).

### (histórico T-17)
- **Qué:** las acciones de ESCRITURA estructural a cualquier profundidad: crear sub-subcapítulo bajo cualquier contenedor, mover un subárbol (contenedor + sus partidas + sub-contenedores) entre capítulos, y borrar un contenedor promoviendo o eliminando sus hijos en cascada. Más las afordances de UI para hacerlo en el árbol del sidebar.
- **Por qué:** la Fase 1 (camino de lectura) deja la jerarquía N-nivel importable, navegable y exportable, pero NO editable bajo el nivel 2 (en Fase 1 esas afordances se DESACTIVAN para no corromper `Partida.sub`). Sin Fase 2, una obra con jerarquía profunda se ve pero no se reestructura a mano.
- **Pros:** edición completa de la jerarquía; cierra el ciclo (importar profundo → reorganizar → exportar).
- **Cons:** es el camino de escritura, el más espinoso. `movePartida`/`moveSubtree` entre capítulos arrastra partidas entre buckets de `PartidasMap` (la clave sigue siendo el capítulo); `deleteSubchapter` recursivo debe decidir promover vs borrar en cascada. Diff grande, riesgo de dejar `sub` huérfanos.
- **Contexto / dónde empezar:** la Fase 1 ya deja `core/tree.ts` (helper de estructura acotado a view-model), `findNode`/`findChapterIdForContainer`, el tipo recursivo y `addPartida`/`movePartida` endurecidos para RECHAZAR subId inexistente. Fase 2 = generalizar esas acciones del store a profundidad + UI. Empezar por `addSubchapter(parentId)` a cualquier nivel y `moveSubtree(fromChId, nodeId, toChId, toParentId)`.
- **Depende de / bloqueado por:** Fase 1 mergeada (plan en `docs/plan-jerarquia-n-niveles.md`).

---

> Añadidos en `/plan-eng-review` de multi-obra (2026-06-13, voz externa Codex).

## T-19 · Coordinación multi-pestaña del navegador (Web Locks / BroadcastChannel)
- **Qué:** evitar que dos pestañas/ventanas del navegador con obras distintas (o la misma) se pisen el autosave. Hoy `activeId` en IndexedDB NO es un cerrojo.
- **Por qué:** con multi-obra, dos pestañas abiertas pueden autosalvar sobre la misma clave o cruzar escrituras → pérdida silenciosa de datos. Cazado por Codex (voz externa) en la eng-review de multi-obra.
- **Pros:** integridad de datos con varias pestañas abiertas (caso normal en escritorio); base para colaboración futura.
- **Cons:** Web Locks API / BroadcastChannel + lógica de "esta pestaña es la dueña de la obra X"; superficie de test nueva. Gasta esfuerzo en un caso que el dogfooding en solitario (una ventana) casi nunca toca.
- **Contexto / dónde empezar:** la cola de escritura de `persist.ts` y el armado del autosave en `sync.ts`. Adquirir un Web Lock por `concreta.obra.<id>` antes de autosalvar, o difundir "obra X tomada" por BroadcastChannel y degradar a solo-lectura la segunda pestaña. Decisión: bloquear la 2ª pestaña vs. fusionar.
- **Depende de / bloqueado por:** T-10 (registro multi-obra). No bloquea el dogfooding solo; abordar antes de uso externo.
- **Decisión (eng-review 2026-06-13):** aplazado a TODO (dogfooding en solitario no lo dispara).

## T-20 · Puente de descarga para «arrastrar el enlace» FIE BDC (scope B del import de partida)
- **Qué:** reproducir el comportamiento LITERAL de CYPE/Arquímedes (mantener pulsado el icono FIE BDC y arrastrar el ENLACE a la app, que descarga e inserta la partida). Hoy el MVP (2026-06-15) usa arrastrar el FICHERO .bc3 + botón «Importar partida».
- **Por qué aplazado:** la app es una SPA web pura. Al soltar un enlace de otra pestaña el `DataTransfer` solo trae la URL, no los bytes; y `fetch()` a `my.generadordeprecios.info` está bloqueado por CORS + sesión de CYPE. Confirmado por dual-voice (Codex + subagente). Sin infra nueva no es posible.
- **Opciones (cada una añade infra):** (a) proxy/backend que descargue el .bc3 del enlace en tu nombre (rompe el local-first, depende de la sesión CYPE); (b) shell Electron (el SO descarga al arrastrar, como Arquímedes; cambia el producto a escritorio); (c) extensión de navegador o bookmarklet en la página de CYPE.
- **Contexto / dónde empezar:** el adaptador `core/bc3ToPartidas.ts` (`bc3ToRefCopyItems`) y `features/importar/importPartida.ts` (`processBudgetDrop`) ya aceptan bytes; el puente solo tendría que ENTREGAR los bytes desde la URL (resolver CORS/auth). Hoy `processBudgetDrop` ya detecta el drop de enlace y avisa.
- **Limitación conocida del MVP:** un .bc3 con N>1 partidas hoja se importa plano (sin su estructura de capítulos), con aviso. El caso CYPE es siempre 1 partida.
