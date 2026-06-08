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
