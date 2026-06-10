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

## T-2 · Inmutabilidad y auditoría de certificaciones
- **Qué:** al emitir una certificación debería quedar "congelada" (snapshot). Hoy editar una cert antigua recalcula en silencio las siguientes vía el encadenado "anterior".
- **Por qué:** la certificación es un documento de cobro. Alterar importes ya certificados/cobrados sin rastro es inaceptable ante propiedad/constructora.
- **Pros:** trazabilidad de cobro; certs reproducibles; export con snapshot.
- **Cons:** cambia el modelo de datos de `Cert` (estado emitida/borrador, snapshot de cantidades y precios al emitir).
- **Contexto / dónde empezar:** hoy `Cert.data[partidaId]` es editable libremente y `prevData` es la cert previa de la lista. Añadir estado `draft|issued`, congelar precios/cantidades al pasar a `issued`, y decidir qué pasa al editar una emitida (bloquear o versionar).
- **Depende de / bloqueado por:** decidir antes de usuarios externos. Para el dogfood en solitario (tú, una obra) la edición libre vale.
- **Prioridad CONDICIONAL al spike legal (revisión CEO 2026-06-08, D3 + Codex #13):** el resultado de la tarea 1 del spike (§0.5 del plan) gobierna esto. **Si la cert es un documento legal de cobro** → T-2 deja de estar aplazado y **entra en F4** (estado emitida/borrador + snapshot, sin retro-edición silenciosa). **Si es documento de trabajo** → sigue aplazado. No pre-comprometer hasta cerrar el spike. Dos modelos (revisión + Codex) coinciden en que editar certs históricas sin inmutabilidad invalida la cert para uso real.
- **AFINADO (eng-review F4, 2026-06-10, voz externa Codex #4/#5/#13):** el vector NO es solo "editar una cert". Editar el **PRESUPUESTO** (precio de recurso, `coefK`, medición) con certs ya hechas reescribe en silencio importes ya certificados, porque `core/certificacion.certCalc` lee `p.precio`/medición EN VIVO. F4 lo mitiga en parte: **contradictorios cert-local** (el trabajo extra no obliga a mutar el presupuesto) + **snapshot de cantidad ejecutada por línea/cert** (`Cert.lineQty`, que congela la cantidad frente a ediciones de medición). **RESIDUO:** el PRECIO sigue leyéndose en vivo → editar un recurso mueve importes históricos. Opciones para el T-2 propio: "solo la última cert editable", o snapshot de precio/ofertada por cert al certificar. **Decisión (eng-review F4):** afinar y seguir aplazado (postura del spike: working doc, solo); hacerlo BIEN (con estado borrador/emitida) antes de uso externo, no a trozos.

## T-3 · PDF de certificación de calidad profesional
- **Qué:** el documento de cobro vía `window.print()` (print CSS) puede fallar en paginación, cabeceras de tabla repetidas y saltos de página.
- **Por qué:** la certificación se entrega a propiedad/constructora; una paginación fea da mala imagen y puede confundir importes.
- **Pros:** documento de cobro presentable; base para Word/Excel reales después.
- **Cons:** introducir una lib de PDF (react-pdf / pdfmake) o usar make-pdf de gstack es más trabajo que print CSS.
- **Contexto / dónde empezar:** Hito 1 usa PDF por print (suficiente para validar el dogfood). Antes de entrega externa, evaluar lib de PDF con plantilla de certificación oficial.
- **Depende de / bloqueado por:** F7 (exporters). Aplazado.

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

## T-10 · Gestión multi-proyecto (lista de obras)
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
