# Plan de auditoría — Concreta · Mediciones

> **Para la sesión de auditoría (Fable 5).** Este documento es autocontenido: puedes
> ejecutarlo en frío sin más contexto. El objetivo NO es reescribir la app, sino
> **encontrar los fallos latentes** que suele dejar el desarrollo asistido por IA en
> una app de este tipo (dinero real, datos irreemplazables, formato de intercambio
> normativo) y proponer arreglos priorizados por impacto.

## 0. Contexto en una pantalla

App web 100 % cliente (Vite 7 · React 19 · TS · Zustand+Immer · IndexedDB). Sirve
para **medir, presupuestar y certificar obra**, con import/export **FIEBDC-3 (.bc3)**.
~30 k LOC en `src/`. No hay servidor: **si se corrompe o se pierde el blob de
IndexedDB, el usuario pierde la obra**. Las certificaciones son documentos de
**facturación**: un descuadre de céntimos o un redondeo mal aplicado es un fallo real,
no cosmético.

Lo que YA está bien (no gastes tiempo aquí): 0 `any`, 0 `@ts-ignore`, 0 `catch` vacíos,
tipado de dominio cuidado (`src/core/types.ts`), motor de importes en **céntimos
enteros** (`src/core/money.ts`), snapshots de precio/cantidad para reproducibilidad de
certs, autosave serializado + Web Locks multi-pestaña. **El riesgo no es el estilo; es
la corrección semántica en los bordes.** Ahí es donde debes cavar.

## 1. Reglas de enganche

- **Diagnóstico primero, no toques código sin avisar.** Registra hallazgos en el
  formato de §3. Los *quick wins* triviales y seguros (un typo, una constante
  duplicada) puedes arreglarlos sobre la marcha marcándolos como `[fix aplicado]`;
  cualquier cambio en lógica de dinero, persistencia o estado se **propone**, no se
  aplica, hasta que Javier lo confirme.
- **Cada hallazgo necesita una repro o un caso concreto**, no una corazonada. Si no
  puedes construir el caso que falla, márcalo como `[sospecha, sin repro]` y baja su
  severidad.
- **Prioriza por impacto en este orden:** pérdida/corrupción de datos → error de
  dinero → pérdida de fidelidad en round-trip .bc3 → estado inconsistente → deuda de
  mantenibilidad. No te disperses en refactors estéticos antes de cerrar los tres
  primeros.
- **Escribe un test que falle** para cada bug de corrección numérica o de estado que
  confirmes: es la prueba y, de paso, la red de seguridad del arreglo.

## 2. Comandos base

```bash
npm test                 # Vitest (68 ficheros de test hoy)
npm run coverage         # cobertura v8 — úsalo para localizar rutas críticas sin test
npm run build            # tsc -b + vite build (typecheck estricto)
npm run lint             # ESLint
```

Muestras .bc3 reales para pruebas de round-trip: `docs/spike/samples/*.bc3` y
`docs/trazadora-presto.bc3`. Auditoría previa del importador (léela antes del Track C):
`docs/auditoria-importador-bc3.md`. Auditoría de rendimiento (contexto, no repitas):
`PERFORMANCE_AUDIT.md`.

## 3. Formato del registro de hallazgos

Ve anotando en `docs/auditoria-app-hallazgos.md` (créalo). Un bloque por hallazgo:

```
### [A-01] Título corto
- Severidad: crítica | alta | media | baja
- Área: persistencia | dinero | bc3 | estado | errores | mantenibilidad
- Fichero: src/…:línea
- Qué pasa: 1-2 frases.
- Repro / caso: entradas concretas → resultado incorrecto esperado vs. observado.
- Impacto: qué pierde/factura mal el usuario.
- Propuesta: arreglo mínimo. Test que lo cubriría.
- Estado: [confirmado] | [sospecha, sin repro] | [fix aplicado]
```

---

## Track A — Integridad de datos y persistencia  *(prioridad máxima)*

**Por qué es el track IA más peligroso:** la IA tiende a escribir el *happy path* de
persistencia y dejar sin cubrir el fallo parcial, la concurrencia y la migración. Aquí
un fallo = obra perdida, sin red porque no hay backend.

**Ficheros:** `src/persist/persist.ts`, `sync.ts`, `tabLock.ts`, `transfer.ts`,
`registry.ts`, `persistStore.ts`, `sessionStore.ts` · esquema en
`src/store/obraStore.ts` (`SCHEMA_VERSION = 2`, `toSerializable`/`fromSerializable`).

**Qué revisar (checklist):**
- [ ] **Migración de esquema.** `SCHEMA_VERSION = 2` en el store; ¿existe y se prueba
  la ruta v1→v2 en `fromSerializable`? ¿Qué pasa al cargar un blob de versión
  **futura** (usuario que abrió una build más nueva y vuelve a una vieja)? ¿Se
  rechaza limpio o corrompe?
- [ ] **Validación estructural vs. pérdida.** `isObraData` valida forma pero no cada
  número. Traza qué ocurre cuando un blob **falla** la validación al cargar: ¿se
  descarta y se muestra vacío (pérdida silenciosa) o se preserva el blob crudo para
  recuperación? Confirma que un blob malo **nunca** se sobre-escribe con uno vacío por
  un autosave posterior.
- [ ] **Cuota de IndexedDB.** Busca el manejo de `QuotaExceededError` en la cola de
  escritura. Una obra grande + varias obras puede llenar la cuota; ¿el autosave falla
  en silencio y el usuario cree que guardó?
- [ ] **Concurrencia multi-pestaña.** Revisa `tabLock.ts` (Web Locks) y `sync.ts`:
  ¿qué pasa si el navegador **no soporta** Web Locks (fallback)? ¿Dos pestañas con la
  misma obra pueden pisarse entre el `flush` de `switchObra` y la carga? Reproduce:
  editar en pestaña A, editar en B, ver quién gana y si hay pérdida.
- [ ] **Import/restore vs. autosave en vuelo.** `flush()` antes de importar/reset:
  confirma que no hay ventana en la que un autosave viejo aterrice tras el import.
- [ ] **Duplicación de constantes de versión.** `APP_VERSION = '0.6'` está **duplicado
  literal** en `persist.ts:30` y `transfer.ts:16`; pueden divergir. Unifícalo. Verifica
  también que `APP_VERSION` (0.6) y `SCHEMA_VERSION` (2) no se confundan en ninguna
  comparación.

**Sospechas ya detectadas (verifícalas):** constante `APP_VERSION` duplicada;
ausencia aparente de manejo explícito de cuota; migración v1→v2 con cobertura de test
por confirmar. **Entregable:** tabla de fallos con repro + un test de "blob corrupto /
versión futura no borra la obra".

---

## Track B — Corrección numérica y monetaria  *(prioridad máxima)*

**Por qué:** es facturación. La IA suele acertar el caso feliz y fallar en redondeo de
medio céntimo, negativos, orden de aplicación de %/coeficientes y en **mezclar float
con el motor de céntimos**.

**Ficheros:** `src/core/money.ts`, `totales.ts`, `certificacion.ts`, `medicion.ts`,
`listado.ts`, `banco.ts`, `src/features/certificaciones/certPctState.ts`,
`src/store/selectors.ts`. Y **ojo con el leak de float a la UI**: hacen su propio
`round2` en `CertSummary.tsx`, `CertTable.tsx`, `CertCard.tsx`, `PctBar.tsx`,
`ResumenSheet.tsx`, `ReferenciaPanel.tsx`, `usePartidaRow.ts`, `selectors.ts`.

**Qué revisar (checklist):**
- [ ] **`round2` con `Number.EPSILON`.** `Math.round((n + EPSILON) * 100) / 100` es un
  patrón frágil: es **asimétrico para negativos** (p.ej. `+0,005 → 0,01` pero
  `−0,005 → 0,00`) y no arregla todos los flotantes límite. Como `CertExtra`, `Ajuste`
  y las correcciones **admiten importes negativos** (ver `types.ts`), construye casos
  con importes negativos de medio céntimo y comprueba el sesgo. Documenta si el impacto
  es real (aparece en una cert) o teórico.
- [ ] **¿Float filtrándose donde debería usarse el motor de céntimos?** El header de
  `money.ts` dice que los **importes** van en céntimos enteros para que la Σ sea
  exacta. Verifica que los totales de certificación, resumen (PEM/GG/BI/IVA/PEC) y
  subtotales por capítulo se acumulan en **céntimos** y no re-suman floats en la UI.
  Busca sitios que hagan `round2(a + b + c)` sobre euros en vez de `sumCents`.
- [ ] **Invariantes de certificación.** Comprueba con casos reales:
  - Σ subtotales por capítulo == total de la certificación (al céntimo).
  - "a origen − anterior = esta certificación" nunca sale negativo salvo corrección
    explícita.
  - Σ certificado a lo largo de las certs ≤ presupuesto (o el exceso está justificado
    por contradictorios/ajustes, no por redondeo).
  - **Retención** (`0..1`) y **ajustes** (`signo ±1`, `tipo pct|fijo`) se aplican sobre
    la base correcta y en el orden correcto (antes de IVA, como dice `types.ts`).
- [ ] **Coeficiente K.** `types.ts` afirma que los **contradictorios (`CertExtra`) NO
  se escalan por K** y las partidas sí. Verifica en `certificacion.ts`/`certCalc` que:
  (a) el K se aplica **una sola vez** a partidas, (b) los contradictorios quedan
  **excluidos**, (c) el snapshot congela `coefK` y `certCalc` usa el congelado si
  existe y el vivo si no (certs legadas). Un K aplicado dos veces o al contradictorio
  es un error de dinero directo.
- [ ] **IVA/GG/BI y `%CI`.** Orden y base de cada tasa en `totales.ts`/`ResumenSheet`.
  El `%CI` es "% sobre coste directo", no un recurso — confirma que no se suma como
  importe.
- [ ] **`selectors.ts` sin test** y hace aritmética de dinero: candidato prioritario a
  cubrir con tests de invariantes.

**Sospechas ya detectadas:** asimetría de `round2` en negativos; float de importes en
componentes de UI en lugar del motor de céntimos; `selectors.ts` sin cobertura.
**Entregable:** una suite de tests de invariantes monetarias (property-based cuando
puedas: genera medición/precio/K/retención aleatorios y afirma los invariantes) + lista
de descuadres reproducibles.

---

## Track C — Fidelidad de import/export FIEBDC-3 (.bc3)  *(prioridad alta)*

**Por qué:** el intercambio con Presto/CYPE es el gancho profesional. La IA pierde
datos en el round-trip de formatos poco convencionales (encoding ANSI, jerarquía,
coeficientes, parámetros) sin que salte ningún error.

**Ficheros:** `src/vendor/bc3/**` (parser forkado), `src/core/bc3import.ts`,
`bc3export.ts`, `bc3ToPartidas.ts`, `src/features/importar/**`,
`src/features/exportar/bc3.ts`. **Lee primero** `docs/auditoria-importador-bc3.md` y
`docs/parametricos-bc3.md` para no repetir lo ya cubierto.

**Qué revisar (checklist):**
- [ ] **Round-trip estructural.** Importa cada `docs/spike/samples/*.bc3`, expórtalo y
  **diffea** el resultado contra el original a nivel de registros (~C precios, ~D
  descomposición, ~M mediciones, ~K coeficientes). Cataloga toda pérdida: importes,
  descripciones, unidades, jerarquía N niveles, `%CI`, coefK.
- [ ] **Encoding.** El fork ya resolvió un quirk de byte raro en `~D` (ver memoria
  `bc3-lib-quirks`). Verifica ANSI (ISO-8859-1/Windows-1252) vs UTF-8 en import **y**
  export: nombres con acentos/ñ/º deben sobrevivir el ciclo completo.
- [ ] **Import de partida suelta (Generador de precios CYPE).** `importPartida.ts` +
  `ImportPartidaButton`: confirma que el CI y el precio efectivo entran como en el
  panel de Referencia y no se duplica la descomposición.
- [ ] **Manejo de .bc3 malformado.** Fichero truncado o de otra codificación: ¿error
  legible al usuario o excepción tragada en el worker (`bc3worker.ts`,
  `useBc3Parse.ts`)?

**Entregable:** matriz muestra × registro con ✓/pérdida, y los .bc3 problemáticos
guardados como fixtures de regresión.

---

## Track D — Corrección del estado central (el "god store")  *(prioridad alta)*

**Por qué:** `obraStore.ts` tiene **1437 LOC y 53 `set()`**. Es el punto donde la IA
acumula mutaciones y donde se cuela el estado derivado inconsistente y los **huérfanos**
tras un borrado.

**Ficheros:** `src/store/obraStore.ts`, `selectors.ts`, hooks de mutación
(`usePartidaRow.ts`, `usePartidaDelete.ts`, `usePartidaClipboard.ts`), COW en
`src/features/presupuesto/useCowGuard.tsx` / `CowDialog.tsx`.

**Qué revisar (checklist):**
- [ ] **Referencias huérfanas al borrar.** Al borrar una **partida** o un **capítulo/
  subcapítulo**, ¿se limpian todas sus referencias cruzadas en cada `Cert`
  (`data[partidaId]`, `lineQty[partidaId]`, `priceSnapshot[partidaId]`, `extras` que
  cuelguen de ese capítulo)? Un huérfano infla o rompe totales de certs históricas.
- [ ] **Estado derivado consistente.** `precio` efectivo vs `precioManual`, `mainType`,
  `pos`/numeración automática: tras editar recursos, mover partidas o cambiar de nivel,
  ¿se recalcula todo lo derivado en la misma mutación? Busca acciones que muten datos
  base sin recomputar lo dependiente.
- [ ] **Copy-on-write del banco.** El COW comparte conceptos del banco por `code`.
  Confirma que al editar un recurso "copiado" no se muta por **aliasing** el concepto
  compartido de otra partida (Immer protege el árbol del store, pero si hay objetos
  compartidos por referencia con el banco, revisa que la copia sea profunda donde toca).
- [ ] **Herencia en `addCert`.** Nueva cert hereda retención, ajustes recurrentes y
  precios de la anterior. Verifica que hereda **snapshots** correctamente y no arrastra
  cantidades de la cert previa como si fueran de la nueva.
- [ ] **Idempotencia/at-origen.** `Cert.data` es "cantidad ejecutada a origen":
  confirma que teclear a mano borra `lineQty` (override) como documenta `types.ts` y no
  deja los dos caminos activos a la vez.

**Sospechas ya detectadas:** limpieza de huérfanos en certs al borrar
partidas/capítulos (verificar exhaustivamente). **Entregable:** tests de invariantes de
store ("borrar X no deja referencias colgando", "editar recurso recalcula precio") y
lista de mutaciones que dejan estado inconsistente.

---

## Track E — Manejo de errores y estados límite  *(prioridad media)*

**Por qué:** hay ~20 `catch`. Ninguno vacío (bien), pero conviene ver **qué se traga**
vs **qué llega al usuario**. La IA suele degradar a "silencio" en vez de avisar.

**Ficheros:** los `catch` de `App.tsx`, `persist/*`, `features/importar/*`,
`features/obra/ProjectBackup.tsx`, `hooks/useTheme.ts`, `useTweaks.ts`.

**Qué revisar (checklist):**
- [ ] Cada `catch` que envuelve una operación de datos (import, backup, persist):
  ¿informa al usuario (toast/estado) o se traga? Un import que falla en silencio deja
  al usuario creyendo que funcionó.
- [ ] `parseEsNumber` (ya endurecido en T-6) — confirma que **todos** los campos
  numéricos pasan por él y no hay `parseFloat` crudo tragando "12abc".
- [ ] Estados de carga/errores en el worker `bc3worker.ts`: fallo del worker →
  ¿UI colgada o mensaje?

**Entregable:** lista de `catch` que deberían notificar y no lo hacen.

---

## Track F — Deuda estructural y mantenibilidad  *(prioridad baja, hazla al final)*

**Por qué:** típico de IA — ficheros que crecen sin dividirse y lógica duplicada. No es
urgente pero encarece cada cambio futuro.

**Objetivos concretos:**
- Ficheros gigantes: `obraStore.ts` (1437), `Sidebar.tsx` (775), `ReferenciaPanel.tsx`
  (685), `bc3import.ts` (571), `docxRender.ts` (550). Propón divisiones por
  responsabilidad **sin cambiar comportamiento**.
- Duplicación: `APP_VERSION` (Track A), `round2` disperso por 19 ficheros (¿debería la
  UI llamar a un único formateador desde céntimos?), lógica de totales replicada entre
  `core` y componentes.
- Código muerto: cruza `src/features/sandbox/` y exports no usados con el build.

**Entregable:** lista priorizada de refactors de bajo riesgo (solo propuesta).

---

## Track G — Cobertura y verificación  *(transversal)*

Corre `npm run coverage` al principio para guiar los tracks B y D. Sin test colocado
hoy (confirmado): `src/store/selectors.ts` (¡hace dinero!), `src/core/grouping.ts`,
`seed.ts`, `id.ts`, `src/persist/persistStore.ts`, `sessionStore.ts`. Prioriza cubrir
**selectors.ts** y las rutas de persistencia por encima de lo demás.

---

## Orden sugerido y encuadre de tiempo

1. `npm run coverage` + leer `docs/auditoria-importador-bc3.md` y este documento. *(15')*
2. **Track A** (persistencia) — el fallo más caro. *(bloque grande)*
3. **Track B** (dinero) — construye la suite de invariantes. *(bloque grande)*
4. **Track D** (estado / huérfanos). *(medio)*
5. **Track C** (round-trip .bc3). *(medio)*
6. **Track E** (errores). *(corto)*
7. **Track F** (mantenibilidad) — solo propuestas. *(corto)*

Tracks A–E son **independientes**: si dispones de orquestación multi-agente
(`ultracode`/Workflow), lánzalos en paralelo, uno por track, cada uno devolviendo su
bloque de hallazgos en el formato de §3, y consolida al final. Si no, secuencial en el
orden de arriba.

## Entregable final

Al cerrar: `docs/auditoria-app-hallazgos.md` con todos los hallazgos ordenados por
severidad, un resumen ejecutivo arriba (nº de hallazgos por severidad y los 3 más
graves), los tests nuevos que fallan/pasan, y una **lista corta de arreglos recomendados
en orden de acometida**. No apliques cambios de dinero/persistencia/estado sin que
Javier los confirme.
