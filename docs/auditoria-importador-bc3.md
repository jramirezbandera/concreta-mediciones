# Auditoría del motor de importación .bc3 — 2026-06-12

Alcance: `src/core/bc3import.ts` (mapeo FIEBDC → `ObraData`), la librería `bc3@1.1.0`
de la que depende, y la ruta de integración `features/importar` → store → persist.
Método: lectura del código (app y `node_modules/bc3/dist`), fixtures sintéticos
FIEBDC ejecutados contra `bc3ToObra`, y contraste con los tres .bc3 de muestra
(`obra ejemplo.bc3`, `BCCA2023_V02.bc3`, `base precios.bc3`).

Estado de partida: la suite pasa (391 tests), el PEM de la obra real cuadra con la
raíz a <1 €, y la estructura (capítulos/subcapítulos/partidas, bancos incluidos)
importa bien tras el fix de 2026-06-12. Lo que sigue son los riesgos restantes.

---

## ALTA

### A1 · Las mediciones se asignan por índice y la librería pierde el código del hijo
`bc3import.ts` alinea `container.measurements[i]` con `decompositions[i]`. Pero
`bc3@1.1.0` **descarta el código del hijo** del `~M|PADRE\HIJO|…` (MParser,
`dist/index.js:1862` — se queda solo `PADRE`): las mediciones cuelgan del padre en
orden de archivo, sin saber de qué hijo son. La alineación por índice es una
coincidencia de cómo exporta Presto, no un contrato. Se rompe en cuanto un hijo no
tiene `~M`:

- **Evidencia real**: en `obra ejemplo.bc3`, el capítulo C03 tiene 14 partidas y 13
  `~M` (la 1ª no tiene). Todo se desplaza una posición: **12 de 14 partidas pierden
  su detalle de medición** (el guard `total === qty` las descarta en silencio). En
  total solo 111/167 partidas conservan medición (`medVisible`).
- **Corrupción silenciosa demostrada** (fixture sintético): dos partidas con la misma
  cantidad y `~M` en orden distinto al `~D` → cada una importa **las líneas de la
  otra** y el guard no lo detecta.
- Además los registros `~N` (mediciones de certificación) se mezclan en el MISMO
  array `measurements`, agravando el desplazamiento si el archivo los trae.

**Fix recomendado**: alinear por `m.positions` (el último elemento es la posición
1-based del hijo dentro de la descomposición del padre; FIEBDC campo POSICIÓN), con
fallback al índice solo si no hay positions. Es el único dato de alineación que
sobrevive al bug de la librería.

### A2 · El FACTOR del `~D` se ignora (cantidad = solo rendimiento)
FIEBDC: cantidad = FACTOR × RENDIMIENTO. El importador usa `d.performance ?? 0`
(partidas) y `dc.performance ?? dc.factor ?? 0` (items de la justificación).

- Fixture `~D|C1#|P1\2\5|` (factor 2 × rend 5 = 10) → importa **cantidad 5**.
- Item `~D|P1|MAT1\3\2|` (= 6) → importa **cantidad 2**.

Presto suele exportar factor vacío o 1 (por eso el PEM de la muestra cuadra), pero
otros programas (Arquímedes/CYPE/TCQ) sí lo usan → PEM silenciosamente mal.
Matiz adicional: por espec, factor/rendimiento VACÍOS valen 1 (no 0); hoy un `~D`
sin rendimiento explícito importa cantidad 0. Y la librería puede entregar `NaN`
en factor/performance (sin guard, `dist/index.js:1135`); conviene `Number.isFinite`.

**Fix**: `cantidad = round2((factor finito ?? 1) × (rendimiento finito ?? 1))`,
mismo criterio en items (con la conversión % actual encima).

### A3 · Un `~D` cíclico revienta la importación (RangeError)
La librería no protege ciclos en la ruta `decompositions`/`getConcept` y
`collectPartidas` recursa sin set de visitados. Fixture A#→B#→A# →
`RangeError: Maximum call stack size exceeded`. La UI lo captura como error genérico
("No se pudo leer el archivo"), sin pista. **Fix**: set de códigos visitados en
`collectPartidas` → `Bc3ImportError` con mensaje claro (archivo malformado).

---

## MEDIA

### M1 · Conceptos referenciados sin `~C` desaparecen sin aviso al usuario
`~D|C1#|P1\1\2\GHOST\1\3|` sin `~C|GHOST` → la partida (y su dinero) se pierde.
La librería SÍ emite un diagnóstico warn, pero `report.warnings` no lo surfacea
(solo se muestran los contadores). **Fix**: volcar los mensajes warn/error de
`parsed.diagnostics` en `report.warnings` (limitados a N).

### M2 · Del `~K` solo se lee el primer subcampo; GG/BI/BAJA/IVA se ignoran
`coefKOf` lee `parts[2]` → primera subcolumna = **CI** (costes indirectos). Funciona
para los archivos validados (obra: 13 → 1,13 cuadra con la raíz; BCCA: 14,42 € como
Arquímedes), pero: (a) si el archivo trae BAJA, se ignora y el PEM no cuadrará con el
objetivo; (b) el IVA del archivo (BCCA: 21) se ignora y la obra queda con el 10% por
defecto; (c) GG/BI quedan en los defaults del seed. La librería expone GG\BI\BAJA\IVA
en `doc.coefficients.legacy/full` (strings crudos). **Fix**: importar IVA (y GG/BI si
procede) a `rates`, y documentar que el "K" del modelo es el CI del FIEBDC.

### M3 · Charset por defecto incorrecto para archivos antiguos
FIEBDC: sin declaración en `~V`, el juego de caracteres es **850 (OEM)**. El
importador asume windows-1252 → mojibake: fixture sin charset con "CAÑERÍA" en cp850
importa **"CA¥ERÖA"**. `TextDecoder` no soporta cp850 (haría falta una tabla de 128
entradas, trivial). Hoy cp850/cp437 declarados ya avisan con warning, pero el caso
"sin declarar" ni avisa. Frecuencia: archivos de programas antiguos.

### M4 · Las cantidades se truncan a 2 decimales
`round2(d.performance)`: un archivo con cantidad 1,234 importa 1,23 (PEM 1.230 € en
vez de 1.234 € con precio 1.000 €). FIEBDC y Presto manejan 3 decimales en mediciones.
Es coherente con el modelo de la app (todo a 2 dec), pero es una decisión que
desvía el PEM en archivos reales con 3 decimales — al menos debería contarse en el
report (deltaCents ya lo delata de rebote contra la raíz).

### M5 · UI: archivo grande congela la pestaña; reentrada y reemplazo sin confirmación
(`features/importar/ImportarView.tsx`)
- El parse corre en el hilo principal: `base precios.bc3` (29 MB, ~70k partidas)
  congela la UI varios segundos sin feedback ni límite de tamaño. Candidato a Web
  Worker o, mínimo, aviso de tamaño.
- "Cargar al presupuesto" no se deshabilita durante `busy` → doble clic = doble
  `loadObra`.
- El reemplazo de la obra actual es directo (texto avisa, pero no hay confirmación
  modal) y el autosave tiene debounce de 600 ms (cerrar la pestaña justo después
  puede perder la importación).

### M6 · Deuda conocida T-1: colisión de códigos de recurso entre bases
Documentada en `docs/TODOS.md`: el banco se indexa por `code` plano; importar
fuentes distintas con códigos homónimos pisa precios (primero-gana en
`registerRecurso`, último-gana en la librería para `~C` duplicados — criterios
además opuestos). Aplazada a M1/T-10; sigue siendo el mayor landmine de producto.

---

## BAJA

- **B1** Dimensión 0 explícita en `~M` se trata como "vacía" (factor 1): la suma no
  cuadra y el guard descarta TODA la medición de esa partida (pérdida, no corrupción).
- **B2** Líneas de fórmula (TIPO=3) y subtotales (1/2): la librería no las evalúa
  (`partial=1`) y el importador no mira `detail.type` (existe). Hoy las salva el
  guard de suma + `isSectionLine`; sería más robusto excluir tipos 1/2/3
  explícitamente. La librería también genera una "línea fantasma" por `\` final de
  campo (la filtra `isSectionLine` de rebote).
- **B3** Capítulos `#` vacíos generan subcapítulos sin partidas (cosmético).
- **B4** `report.warnings` y el report completo no se persisten con la obra (no hay
  registro post-importación).
- **B5** Accesibilidad/robustez menor del flujo importar (aria-label del botón,
  `schemaVersion` estampado solo en `loadObra`).
- **B6** Recursos homónimos: primer-visto gana — coherente con `buildRecursos`, OK,
  pero sin aviso cuando los precios difieren (lo mitiga `precioManual`).

## Lo que está BIEN (verificado)

- PEM de obra real cuadra a <1 € con la raíz; el K como tasa (no pre-multiplicado) es
  correcto y `precioManual` protege la autoridad del precio del archivo.
- Conversión `%` fracción→porcentaje correcta (validada contra Presto y por fixture).
- El guard `total === qty` + suma de parciales evita casi toda corrupción de
  mediciones (a costa de pérdida silenciosa — ver A1).
- Detección de capítulos por `#`/mediciones y raíz `##` con raíces huérfanas: cubre
  obras y bancos (BCCA, base 29 MB) tras el fix de 2026-06-12.
- Charset declarado (ANSI/UTF-8/ISO-8859-1) con re-parse: correcto.
- Rendimiento del parse: lineal en la ruta usada; evitar `getResourceHierarchy`/
  `getAllPathsToConcept` de la librería (exponenciales en DAGs).

## Orden de ataque sugerido — estado (implementado 2026-06-12)

1. ✅ **A1** alinear `~M` por `positions` (+ excluir `detail.type` 1/2/3 → resuelve
   B2). `medVisible` en la obra real: 111 → **120** de 167 (C03 recupera 9).
2. ✅ **A2** factor×rendimiento con defaults 1 (vacío=1, 0 explícito=0) y guard NaN.
3. ✅ **A3** guard de ciclos (set de visitados por capítulo + warning); también
   corta referencias duplicadas de un mismo contenedor dentro de un capítulo.
4. ✅ **M1** diagnostics warn/error del parser → `report.warnings` (cap 8 + resumen).
5. ✅ **M2** IVA/GG/BI del `~K` a `rates` cuando vienen > 0; warning si hay BAJA.
6. ✅ **M5** completo: el parseo corre en un Web Worker (`features/importar/
   bc3worker.ts`, bytes transferidos sin copia; fallback inline donde no hay
   Worker — jsdom) y «Cargar al presupuesto» abre un modal de confirmación que
   enseña qué se pierde (obra, partidas, PEM, certificaciones con datos) antes
   de reemplazar. Verificado en navegador real (preview + headless Chromium):
   el banco de 29 MB se parsea sin congelar la UI, sin errores de consola, y
   las 70.782 partidas sobreviven el roundtrip de IndexedDB tras recargar.
7. ☐ Reportar upstream a `ogorhc/bc3`: MParser pierde el hijo; `looksLikeChildCode`
   con `-XXX`/`Ñ…`; `~N` en `measurements`; NaN en factor/performance.

Pendientes conscientes: **M3** (cp850 por defecto sin declaración), **M4** (cantidades
a 2 decimales — decisión de modelo), **M6/T-1** (colisión multi-base), B1, B3-B6.
Regresión: 398 tests en verde; smoke del banco de 29 MB importa en ~1,2 s
(70.782 partidas) sin warnings.

Los bugs de la librería están detallados en la memoria del proyecto
(`bc3-lib-quirks`) con líneas de `dist/index.js` como evidencia.
