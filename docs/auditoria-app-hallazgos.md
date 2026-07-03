# Auditoría de la aplicación — Hallazgos

> **Fecha:** 2026-07-02 · **Plan seguido:** [auditoria-app-plan.md](auditoria-app-plan.md)
> **Método:** 6 auditores en paralelo (tracks A–F) + track G transversal. Cada hallazgo
> confirmado se reprodujo con tests temporales ejecutados en verde (los estados anómalos
> son alcanzables) y borrados después; el working tree quedó intacto. **Baseline:**
> 636 tests / 68 ficheros, todos en verde antes y después.
> **Alcance de solo-diagnóstico:** ningún fix aplicado; todo es propuesta.

---

## Resumen ejecutivo

**49 hallazgos netos** (51 brutos, 2 duplicados cruzados entre tracks — señal de robustez:
dos auditores independientes llegaron al mismo bug): **0 críticos · 9 altos · 19 medios ·
21 bajos.** Ningún camino destruye datos incondicionalmente; la validación de fondo
(migraciones, snapshots F7.0, motor de céntimos, COW, multi-pestaña) está bien construida
y verificada. Los fallos viven donde predijo el plan: **los bordes semánticos**.

Los 5 más graves:

| # | Hallazgo | Efecto |
|---|---|---|
| B-01/B-02 | La UI cuantiza retención y ajustes a **% enteros** | 2,5 % → 3 %: −250 € en una cert de 50.000 € |
| D-01/D-02 | Borrar partida/capítulo **reescribe certs históricas** y deja contradictorios sumando invisibles | documentos firmados que dejan de reproducirse |
| A-01 | Tras el banner de recuperación, **restaurar el backup no persiste nada** y no avisa | pérdida silenciosa justo al intentar recuperarse |
| C-01/C-02 | Un `~` en un texto corrompe el .bc3 exportado; la coma decimal **trunca al entero** todo el import | PEM/mediciones mal sin ningún aviso |
| D-08 | El «Deshacer» de borrado sobrevive al cambio de obra | inyecta partidas de la obra A en la B, PEM inflado invisible |

**Temas transversales** (patrón típico de desarrollo con IA, confirmando la tesis del plan):
1. **El fix que no llegó a su gemelo** — `pctToRate` corrigió GG/BI pero no retención/ajustes (B-01/B-02); `precioManual` viaja en el import CYPE pero no en copiar/pegar (D-05); el banner de recuperación existe pero la rama legacy nunca lo dispara (A-03).
2. **Borrado sin limpiar referencias cruzadas** — D-01, D-02, D-03, D-04, D-09: las certs referencian por id y ningún borrado las repasa.
3. **Éxito silencioso** — exports que fallan sin aviso (E-01), imports truncados que pasan por buenos (C-03), guardados que fallan y se conmuta igual (A-04).
4. **Dos convenciones de redondeo conviviendo** — B-03 (pecPrev vs pecOrigen), B-07 (Sidebar vs Resumen).

---

## Estado de aplicación (2026-07-02, misma sesión)

**26 hallazgos ARREGLADOS** en 4 lotes, con test de regresión cada uno. Suite: 636 → **667
tests** (69 ficheros), `tsc -b` y build de producción limpios tras cada lote.

| Lote | Hallazgos aplicados |
|---|---|
| 1 — dinero/pérdida mecánicos | **B-01, B-02** (`pctToRate` en `core/money`, commit+display), **A-01** (autosave armado en recovery), **E-01** (toast en los 3 exports), **A-06/F-01** (`APP_VERSION` única) |
| 2 — borrados vs certs *(semántica elegida: PRESERVAR DOCUMENTO)* | **D-01** (certTotals/chapterRows/listado valoran huérfanos por snapshot + fila «Eliminado del presupuesto» en resumen, documento y vista), **D-02/B-04** (extras huérfanos contados Y visibles/editables — Σ capítulos == total garantizado por test), **D-03** (id de capítulo `ch-<uuid>`, único por construcción), **D-08** (guard en `restorePartida` + `toastStore.clear()` en `loadObra`/`reset`) |
| 3 — fidelidad .bc3 | **C-01** (`~`→`-` en `field`/`ttext`), **C-02** (coma decimal normalizada en el vendor + `ratesFromK` — de regalo, la obra real de Presto pasa de 120 a **121** mediciones alineadas), **C-03** (heurística de truncado + contador «Con medición» en el resumen del import), **C-04** (`~K` siempre, con `CI\GG\BI\BAJA\IVA` espejo del import), **C-05** (precios/rendimientos hasta 6 dec) |
| 4 — red de seguridad | **B-03** (`pecPrev` misma fórmula que `pecOrigen`), **B-05** (`round2`/`toCents` simétricos half-away-from-zero), **B-07** (`pec`/`totalConIva` con la convención por-línea del documento), **B-06/F-02** (el panel Referencia delega en `itemImporteRec`/`baseAcumulada` del motor), **E-02** (worker con timeout 120 s + `onmessageerror`), **E-03** (`AppErrorBoundary` raíz: cancela el autosave pendiente + exportar copia + recargar), **A-02** (`isObraData` valida un nivel más: certs/chapters/recursos/partidas envenenados rechazados), **E-04/A-05** (catch+aviso en ObraSwitcher/PersistUI/ReferenciaPanel), **E-05** (catch en imports dinámicos de chunks), **E-06** (catch del spinner del panel), **B-08** (`selectors.test.ts` de humo contra el core), **G-01** (coverage ampliado a `src/**`) |

**Lote 5 (2026-07-03): 12 hallazgos más aplicados** — suite 667 → **673 tests** (70 ficheros):
| | |
|---|---|
| **A-04** *(decisión: BLOQUEAR)* | `flushPending` devuelve si el guardado aterrizó (con reintento único del fallido); `switchObra` NO conmuta si la obra actual no llegó a disco — toast + chip, la edición en riesgo queda a la vista |
| **D-06** *(decisión: SUELO)* | `setCertLine`: el a-origen nunca baja de lo heredado de la cert anterior (marcar/desmarcar líneas no puede producir una cert negativa; bajar exige teclear) |
| **D-05** | `precioManual` viaja en `partidaToRefCopyItem`/`obraToRefSource` — el precio pegado ya no colapsa al editar el banco |
| **A-03** | la legacy corrupta ANUNCIA el banner de recuperación (la rama muerta, viva) |
| **A-10** | fallback de hydrate y destino corrupto: el banner convive con la obra sana cargada; `discardRecovery` ya no reactiva otra obra si la corrupta no era la activa |
| **D-07** | `mainType` recalculado en todas las mutaciones de items y en `editRecurso` (helper `mainTypeOf` en core/banco) |
| **D-09** | línea certificada y luego borrada de la medición: fila «Línea eliminada…» visible y desmarcable en el desplegable de la cert |
| **D-04** | GC conservador en `toSerializable`: purga recursos huérfanos Y vacíos (basura de addItem cancelado); los sin uso con datos se conservan |
| **B-09** | etiqueta «GG + BI» con 1 decimal (decía 20 % aplicando 19,5 %) |
| **C-06** | títulos de partida/subcapítulo ÍNTEGROS en el import (fuera el `.slice(0,120)`) |
| **A-07** | banner cuando no hay Web Locks (Safari viejo / contexto no-HTTPS): «evita dos pestañas con la misma obra» |
| **A-08** | cleanup del listener `visibilitychange` (menor) |

**Lote 6 (2026-07-03): cierre del backlog** — suite 673 → **677 tests**:
| | |
|---|---|
| **Tombstones v3** *(completa D-01)* | `SCHEMA_VERSION 3` + migración: `deletePartida`/`deleteChapter` apuntan `bajas[id] = {code,title,ud}` si alguna cert la certificó; «Eliminado del presupuesto» muestra cada partida borrada CON NOMBRE Y PRECIO (vista, doc impreso, XLSX, DOCX vía `certDeletedRows`); el undo retira el tombstone; `loadObra` no los arrastra entre obras |
| **A-09** | RMW del índice de obras bajo `navigator.locks` (cross-tab); sin Web Locks degrada al comportamiento anterior (auto-curado por `reconcile`) |
| **C-07** | `hydrateItem` conserva el código original del concepto `%` (dos `%` distintos ya no colapsan al re-exportar) |
| **F-03** | el importador .bc3 usa `lineParcial` del core (fuera la réplica que podía divergir; la conversión 0→'' queda documentada como política de import) + `nextPos()` único en `core/numbering` para los 4 sitios que escribían la regla a mano |
| **F-08** | borrado `banco.itemImporte` (muerto y homónimo confuso del local del panel) |
| **G-02** | flake frío de vitest documentado en el README (re-ejecutar; no reproducible de forma determinista) |

**Lote 7 (2026-07-03): F-04/F-05/F-06 aplicados** — splits de `obraStore`/`Sidebar`/
`ReferenciaPanel` PURAMENTE estructurales (cero cambio de comportamiento; los fixes de dinero
que el informe empaquetaba con ellos —B-06, F-08, F-02— ya se aplicaron en los lotes 4 y 6).
Verificado con `tsc -b` + `vite build` + suite completa: 677 → **683 tests** (nuevo
`useRefIndex.test.ts`, 6 casos), sin editar ningún test existente salvo la superficie de
imports (re-exports estables). **Sin acción (deliberado):** F-07 — docxRender/bc3import se
quedan como están (cohesionados).

---

## Índice por severidad

| ID | Título | Sev. | Área |
|---|---|---|---|
| B-01 | Retención cuantizada a % enteros | alta | dinero |
| B-02 | Ajustes `pct` cuantizados a % enteros | alta | dinero |
| D-01 | Borrar partida reescribe certs históricas | alta | estado |
| D-02 (≡B-04) | Contradictorios huérfanos tras borrar capítulo | alta | estado/dinero |
| D-08 | Undo de borrado cruza obras | alta | estado |
| A-01 | Tras recovery, restaurar backup no persiste | alta | persistencia |
| C-01 | `~` en textos corrompe el export | alta | bc3 |
| C-02 | Coma decimal trunca al entero en import | alta | bc3 |
| E-03 | Sin ErrorBoundary; autosave puede fosilizar estado que crashea | alta | errores |
| A-02 | `isObraData` deja pasar blobs envenenados → brick loop | media | persistencia |
| A-03 | Recuperación legacy corrupta: banner inalcanzable | media | persistencia |
| A-04 | `switchObra` conmuta aunque el guardado falle | media | persistencia |
| B-03 | pecPrev redondea distinto que pecOrigen (±1 cént. entre certs) | media | dinero |
| B-05 | `round2` asimétrico en negativos (correctivas, «a deducir») | media | dinero |
| B-06 (≡F-02) | Panel Referencia calcula el % con base distinta al motor | media | dinero |
| B-07 | PEC del Sidebar ≠ documento Resumen (25 % de PEM) | media | dinero |
| B-08 | `selectors.ts` sin test (cableado de 10 args posicionales) | media | cobertura |
| C-03 | Fichero truncado importa como éxito parcial | media | bc3 |
| C-04 | GG/BI/IVA no viajan en el export (asimetría con import) | media | bc3 |
| C-05 | Export trunca precios a 2 dec (206 alterados en centro2017) | media | bc3 |
| D-03 | Ids de capítulo reutilizados «resucitan» huérfanos | media | estado |
| D-05 | Copiar/pegar pierde `precioManual` | media | estado |
| D-06 | Marcar líneas tras cert manual hunde el a-origen | media | estado |
| E-01 | Exports XLSX/DOCX/BC3 fallan en silencio | media | errores |
| E-02 | Worker BC3 sin timeout ni `messageerror` | media | errores |
| E-04 (≡A-05) | Operaciones de obra `void` sin feedback de fallo | media | errores |
| F-04 | `obraStore.ts`: god store, dividir en 4 slices | media | mantenibilidad |
| G-01 | Coverage configurado solo para `src/core` | media | cobertura |
| A-06…A-10, B-09, C-06, C-07, D-04, D-07, D-09, E-05, E-06, F-01, F-03, F-05…F-10, G-02 | ver secciones | baja | varias |

---

## Hallazgos de severidad ALTA

### [B-01] La UI cuantiza la retención a % enteros
- Severidad: alta · Área: dinero
- Fichero: `src/features/certificaciones/CertSummary.tsx:102`
- Qué pasa: el commit del campo Retención hace `setCertField('retencion', round2(v / 100))` — `round2` redondea la **fracción** a 2 decimales → granularidad de 1 punto porcentual, aunque el input declara `dec={1}`. `ResumenSheet.tsx:9-11` ya corrigió esta clase de bug para GG/BI (`pctToRate`), pero la corrección no llegó aquí.
- Repro: `round2(2.5/100) → 0.03` (2,5 % guarda 3 %) · `round2(0.4/100) → 0` (la retención desaparece).
- Impacto: cert con pecEsta 50.000 € y retención tecleada 2,5 % → se retienen 1.500,01 € en vez de 1.250,01 € (**−250 € de retención, −275 € en el líquido** con IVA 10 %). Verificado end-to-end con `certTotals`.
- Propuesta: misma conversión que `pctToRate` (`Math.round(v*10)/1000`) o `v/100` sin round2 (el store ya clampa a [0,1]). Test: commit "2,5" → `cert.retencion === 0.025`.
- Estado: [confirmado]

### [B-02] El ajuste porcentual pierde los decimales: guarda % enteros aunque el input ofrece 3
- Severidad: alta · Área: dinero
- Fichero: `src/features/certificaciones/CertSummary.tsx:156` (commit) y `:152` (display)
- Qué pasa: `editAjuste(a.id, 'valor', round2(v / 100))` → saltos de 1 %. El input declara `dec={3}` y el docstring de `ajusteLabel` (`certificacion.ts:117`) usa «10,197 %» como ejemplo canónico — imposible de introducir. El display también pierde el tercer decimal.
- Repro: `round2(10.197/100) → 0.1` → `ajusteImporte` da 1.000,00 € donde la intención era 1.019,70 €.
- Impacto: 19,70 € por cada 10.000 € en el ejemplo del propio código; cualquier descuento pactado con decimales se aplica mal en silencio (el usuario teclea 10,197, la UI muestra "10,000", factura 10 %).
- Propuesta: commit con milésima de % (`Math.round(v*1000)/100000`), display `a.valor*100` sin round2. Test: "10,197" → `valor === 0.10197` → 1.019,70 €.
- Estado: [confirmado]

### [D-01] Borrar una partida reescribe en silencio las certificaciones históricas y deja huérfanos en cada Cert
- Severidad: alta · Área: estado
- Fichero: `src/store/obraStore.ts:1361` (`deletePartida`), `:1260` (`deleteChapter`) · consumo en `src/core/certificacion.ts:160` (`certTotals` itera partidas VIVAS)
- Qué pasa: los borrados no tocan las certs: `cert.data[pid]`, `lineQty[pid]` y `priceSnapshot[pid]` quedan huérfanos. Como `certTotals`/`certChapterRows` iteran las partidas vivas, el importe certificado de la partida borrada **desaparece del total de certs ya emitidas** (documentos de facturación reescritos hacia abajo), y las claves huérfanas se propagan indefinidamente vía `addCert` — sin entrada de `priceSnapshot`, con lo que si la partida "vuelve" (undo) se valora a precio/K vivos.
- Repro (test en verde):
```ts
state().setCertLine('p111', 'p111-m1', 61.2);   // certifica y congela precio
const t0 = selectCertTotals(state());
state().deletePartida('01', 'p111');
expect(state().certs[0]!.data.p111).toBe(61.2);              // huérfano
expect(selectCertTotals(state()).certPEM).toBeLessThan(t0.certPEM); // histórico reescrito
```
- Impacto: una cert nº N ya firmada/exportada deja de reproducir su líquido si después se borra una partida certificada (o su capítulo); el "anterior" de la siguiente baja → "esta cert" salta. La clase de fallo que el snapshot F7.0 quería impedir, reabierta por la vía del borrado.
- Propuesta: decidir semántica y aplicarla en la misma mutación: (a) bloquear/avisar al borrar partida con `data>0` en alguna cert (como Presto), o (b) valorar certs desde snapshots aunque la partida no exista (`certTotals` sobre `data ∪ partidas`), o (c) limpiar `data/lineQty/priceSnapshot` en todas las certs avisando. Ojo con el undo (`restorePartida` cuenta con que las certs conservan el dato). Test: "borrar partida certificada no cambia `certPEM` de certs con snapshot".
- Estado: [confirmado]

### [D-02 ≡ B-04] Contradictorios huérfanos tras borrar un capítulo: dinero invisible que sigue sumando
- Severidad: alta · Área: estado / dinero *(hallado independientemente por los tracks B y D)*
- Fichero: `src/store/obraStore.ts:1260` (`deleteChapter` no filtra `cert.extras`) · `src/core/certificacion.ts:170-175` (suma TODOS los extras) vs `:248` y `listado.ts:342-357` / `CertTable.tsx:330` (agrupan/filtran por `chapterId`)
- Qué pasa: `deleteChapter` no limpia los `CertExtra` del capítulo borrado. `certTotals` los sigue sumando pero ninguna vista ni documento los pinta: Σ filas por capítulo ≠ total de la cert.
- Repro (ambos tracks, tests en verde): contradictorio de 200 € → `deleteChapter` → `certPEM` sigue en 200 €; `Σ certChapterRows == 0`; en `buildCertListado`, Σ capítulos 50 € vs `totals.certPEM` 250 €.
- Impacto: el líquido incluye un importe que no aparece en ninguna fila ni puede editarse/borrarse desde la UI. Descuadre inauditables en un documento de facturación, por el importe íntegro del contradictorio a origen.
- Propuesta: `deleteChapter` purga de todas las certs los `extras` de ese `chapterId` (o bloquea el borrado si hay extras con cantidad>0, avisando). Test de invariante: tras cualquier borrado, `Σ capítulos del listado == totals.certPEM`.
- Estado: [confirmado]

### [D-08] El toast «Deshacer» de borrado sobrevive a `loadObra`/`switchObra` y restaura la partida en la OTRA obra
- Severidad: alta · Área: estado
- Fichero: `src/hooks/usePartidaDelete.ts:18-21` · `src/store/obraStore.ts:1374` (`restorePartida` no valida que el capítulo exista) · `src/store/toastStore.ts` (sin `clear`)
- Qué pasa: el `run` del toast captura `(chapterId, partida)` y llama a `restorePartida` contra el estado vigente — sea cual sea la obra cargada. En la ventana (~6 s) el usuario puede conmutar de obra (o borrar el capítulo) y el Deshacer inyecta la partida de la obra A en la B; `restorePartida` hace `(s.partidas[chapterId] ??= [])` → **bucket fantasma** que ninguna vista pinta pero que `selectPem`/`selectCounts` SÍ suman; el autosave lo fosiliza en el blob de B.
- Repro (test en verde): borrar con undo → `loadObra(blankObraData('B'))` → `undo.run()` → B sin capítulos pero con la partida de A dentro y `selectPem > 0`. Variante intra-obra: borrar partida → borrar su capítulo → undo → mismo dinero invisible.
- Impacto: corrupción entre obras (dato de A persistido dentro de B) y PEM/contadores inflados por partidas invisibles.
- Propuesta: (1) `restorePartida` no-op si `chapterId` no existe en `s.chapters`; (2) invalidar el toast al cambiar de obra (`clear()` en toastStore desde `loadObra`/`switchObra`, o token de obra en el closure). Test: los dos del repro.
- Estado: [confirmado]

### [A-01] Tras el banner de recuperación, todo lo que el usuario haga se pierde en silencio (incluido restaurar su backup .json)
- Severidad: alta · Área: persistencia
- Fichero: `src/persist/sync.ts:260-261` (hydrate, rama recovery: `setRecovery` sin `armAutosave`) · `src/features/obra/ProjectBackup.tsx:53-59`
- Qué pasa: cuando ninguna obra carga (blob corrupto o de versión futura), `hydrate` marca recuperación y **no arma el autosave** (deliberado, para no pisar nada). Pero la app queda editable: el usuario puede editar o —reacción natural al banner— **importar su backup .json**, que ejecuta `loadObra` + `flushPending`, informa de éxito… y no persiste nada (`flushPending` es no-op sin suscripción). El chip queda en `idle`: ni siquiera «Sin guardar».
- Repro (test en verde): blob `schemaVersion:3` → `hydrate()` → recovery → `loadObra(backup)` + `flushPending()` → IndexedDB sigue conteniendo solo el blob corrupto, `getActiveObraId() === null`, `status === 'idle'`.
- Impacto: el usuario que intenta recuperarse restaurando su copia cree que lo ha conseguido; al recargar vuelve la demo + banner y el trabajo de la sesión (o el backup importado) se ha esfumado. La combinación exacta «fallo + reacción razonable = pérdida».
- Propuesta: armar el autosave también en la rama recovery — es seguro: `persistNow` con `activeId=null` genera un id **nuevo** y jamás escribe sobre la clave corrupta (verificado con test). Alternativa mínima: en recovery, `status:'error'` + ProjectBackup rechaza importar mientras `recovery != null`. Test: tras recovery, editar/importar crea una clave nueva y el blob corrupto queda intacto.
- Estado: [confirmado]

### [C-01] Un `~` en cualquier texto corrompe el .bc3 exportado (la partida pierde el PRECIO al releerlo)
- Severidad: alta · Área: bc3
- Fichero: `src/core/bc3export.ts:122-134` (`field()`/`ttext()` no neutralizan `~`) · agravado por `src/vendor/bc3/parsing/Tokenizer.ts:91` (en modo `lenient`, todo `~` arranca registro nuevo aunque esté en mitad de línea)
- Qué pasa: el writer sanitiza `|`→`¦` y `\`→`/` pero deja pasar `~` en campos. Al releer, el registro se parte por el `~` y se pierde todo lo que va detrás — incluido el precio del `~C`.
- Repro (test con fixture sintético): `title = 'Muro de espesor ~30 cm'`, precio 114,54 → tras round-trip: `title 'Muro de espesor'`, **precio 0**; warning inútil («registros de tipo no soportado: ~3»). Con `~` en la desc se pierde el resto del `~T`.
- Impacto: un `~` tecleado en un título/desc → el .bc3 exportado factura a PEM distinto al releerlo o pierde texto, sin aviso comprensible. Afecta también al import de .bc3 de terceros con `~` en textos.
- Propuesta: neutralizar `~` (→`-`) en `field()` y en todo `ttext()`; en import, intentar tokenizado estricto (spec: `~` solo tras fin de línea) y caer a lenient solo si no sale documento. Test: round-trip de título y desc con `~` intercalado.
- Estado: [confirmado]

### [C-02] Decimales con coma se truncan al entero, en silencio (precios, rendimientos, dims, ~K)
- Severidad: alta · Área: bc3
- Fichero: `src/vendor/bc3/builder/assemblers/DomainAssembler.ts:63,110-113,144-149,169` (`parseFloat` crudo) · `src/core/bc3import.ts:246-249` (`ratesFromK` ídem)
- Qué pasa: FIEBDC-3 admite punto **o coma** decimal según el programa de origen; `parseFloat('12,34') = 12` y nadie avisa.
- Repro (fixture con comas): `~C |12,34| → precio 12` · `~D P1\1\2,5 → cantidad 2` · `~K 13,5 → ciPct 13` · en `~M` total y parcial se truncan por igual → **la medición corrupta pasa el guard** y se importa mal. 0 warnings.
- Impacto: un .bc3 con coma decimal importa toda la obra truncada al entero sin ningún aviso: PEM, mediciones y CI mal.
- Propuesta: normalizador en el assembler: campo que casa `/^-?\d+,\d+$/` → coma a punto antes de `parseFloat`; warning «archivo con coma decimal». El export ya emite punto (correcto).
- Estado: [confirmado]

### [E-03] Sin ErrorBoundary ni manejadores globales: render que lanza = pantalla blanca, y el autosave (fuera de React) puede fosilizar el estado que crashea
- Severidad: alta · Área: errores
- Fichero: `src/main.tsx`, `src/App.tsx` (sin boundary), `index.html` (sin `window.onerror`)
- Qué pasa: no existe ningún ErrorBoundary/`window.onerror`/`unhandledrejection` en todo src/ (grep: 0). En React 19, excepción de render sin boundary desmonta el árbol → pantalla blanca. Lo delicado: el autosave es una suscripción zustand + timers (sync.ts:75-87) **independiente de React** — la mutación que provocó el crash ya programó su guardado antes del render; 1,5 s después se persiste. Al recargar, el gate estructural (que no valida semántica, ver A-02) lo acepta → crash de nuevo. Bucle de brick sin acceso a ProjectBackup (que vive dentro de la UI muerta).
- Repro: sin repro concreto hoy — es ausencia de red de seguridad, no un bug activo (el escenario «dato raro de un .bc3 exótico que rompe un selector» es plausible).
- Impacto: pérdida de acceso total a la app (los datos sobreviven en IndexedDB pero solo rescatables por DevTools).
- Propuesta: (1) ErrorBoundary raíz en main.tsx con mensaje + botón «Exportar copia de datos» (reutiliza `exportRaw` de PersistUI, que no depende del árbol roto), y que en `componentDidCatch` inhiba el autosave programado para no persistir estado sospechoso; (2) opcional `window.onerror`/`unhandledrejection` con toast.
- Estado: ausencia [confirmado]; bucle de brick concreto [sospecha, sin repro]

---

## Hallazgos de severidad MEDIA

### [A-02] `isObraData` es demasiado superficial: un blob envenenado pasa el gate, no hay banner y la app revienta en render
- Severidad: media · Área: persistencia · Fichero: `src/persist/persist.ts:47-67`
- Qué pasa: el gate valida arrays/maps de primer nivel pero no los elementos: `certs:[null]`, `chapters:[null]`, `recursos:{r1:null}` pasan como sanos; `fromSerializable` tampoco los frena (v2 = passthrough). El blob hidrata sin recovery y el primer código que toque `cert.data` lanza `TypeError`. Combinado con E-03: pantalla blanca **en cada arranque** (brick loop). Repro en verde: `isObraData({...certs:[null]}) === true`, hidrata sin banner, selector revienta.
- Impacto: obra inaccesible. Vector realista limitado (.json de terceros o bug propio) → media, no alta.
- Propuesta: endurecer un nivel más (cada cert record con `id/num/data`, cada chapter con `id/title`, cada recurso record) + el ErrorBoundary de E-03. Test: blob con `certs:[null]` → recovery.
- Estado: [confirmado]

### [A-03] Obra legacy corrupta desaparece sin banner: la rama de recuperación legacy es código muerto
- Severidad: media · Área: persistencia · Fichero: `src/persist/registry.ts:202-203` · `PersistUI.tsx:61` y `sync.ts:424-427` (soporte del banner, inalcanzable)
- Qué pasa: si el blob pre-multi-obra (`concreta.obra.v1`) está corrupto, `migrateLegacy` sella índice vacío y conserva el blob «para recuperación manual»… pero nadie llama a `setRecovery`: `hydrate` ve 0 obras y arranca la demo con autosave armado. El fallback `recoveryKey ?? OBRA_KEY` de PersistUI demuestra que el banner estaba pensado para este caso. Repro en verde.
- Impacto: usuario que actualiza desde mono-obra con datos dañados percibe pérdida total (el dato sigue en IDB). Población pequeña (instalaciones pre-T-10).
- Propuesta: en la rama corrupt de `migrateLegacy`, señalizar recovery con `recoveryKey = OBRA_KEY` (banner y `discardRecovery` ya lo soportan).
- Estado: [confirmado]

### [A-04] `switchObra` conmuta aunque el guardado de la obra actual haya fallado (`flushPending` nunca rechaza)
- Severidad: media · Área: persistencia · Fichero: `src/persist/sync.ts:180-187`, `:295`
- Qué pasa: `flushPending` devuelve promesas ya capturadas → nunca rechaza; `switchObraImpl` conmuta igual aunque el blob no llegara a disco (cuota). Mitigaciones verificadas: chip «Sin guardar» + la entrada queda en `pending` y se reintenta en el siguiente drain. Repro en verde con `QuotaExceededError` mockeado: conmuta, la edición queda fuera de disco, `status 'error'` es la única señal; el siguiente guardado sí reintenta y aterriza.
- Impacto: si la cuota no se libera y se cierra la pestaña, la edición se pierde; la vista ya cambió de obra.
- Propuesta: `flushPending` expone el resultado y `switchObraImpl` aborta o pide confirmación. Test: con cuota llena, `switchObra` no cambia la activa.
- Estado: [confirmado]

### [B-03] Descuadre de 1 céntimo entre certs consecutivas: `pecPrev` redondea distinto que `pecOrigen`
- Severidad: media · Área: dinero · Fichero: `src/core/certificacion.ts:178-181`
- Qué pasa: `pecOrigen = certPEM + scaleCents(certPEM, gg+bi)` (GG+BI aparte) pero `pecPrev = scaleCents(prevPEM, 1+gg+bi)` (junto). Barrido 1..500.000 céntimos: difieren en 1.306 valores (0,26 %, PEM acabado en ,50). End-to-end (3 certs, 300 escenarios): Σ pecEsta ≠ pecOrigen final en 1 escenario (+1 cént.).
- Impacto: la línea «Certificación anterior» de la cert N no reproduce el «PEC a origen» facturado en la N−1 — el descuadre que un promotor detecta al cuadrar la liquidación.
- Propuesta: `pecPrev = prevPEM + scaleCents(prevPEM, ggbi)` (misma fórmula). Test de invariante: `Σ pecEsta == pecOrigen(última)` en barrido.
- Estado: [confirmado]

### [B-05] `round2` asimétrico en negativos llega a dinero real vía certs correctivas y deducciones de medición
- Severidad: media · Área: dinero · Fichero: `src/core/money.ts:13-15`
- Qué pasa: `Math.round((n+EPSILON)*100)/100` redondea +0,005→0,01 pero −0,005→−0,00 (asimétrico en 17.734 de 200.000 valores a paso de milésima). Los negativos entran al motor por: (1) `pecEsta` negativo en cert correctiva → retención/IVA sobre base negativa; (2) líneas de medición negativas («a deducir hueco»). Repro: certificar 1 ud × 10 € y corregirla → líquido + líquido de la corrección = **−0,01 €** (no vuelve a 0); 475 de 4.000 cantidades del barrido dejan residuo. `medTotal([10, +0.125, −0.125]) = 10,01`.
- Impacto: ±1 céntimo por ciclo certificación+corrección, sistemático y siempre contra el que corrige.
- Propuesta: redondeo half-away-from-zero: `Math.sign(n) * Math.round((Math.abs(n)+Number.EPSILON)*100)/100`. Test: `round2(-x) === -round2(x)` en barrido + líquido residual 0.
- Estado: [confirmado]

### [B-06 ≡ F-02] El panel Referencia calcula el % de la descomposición con otra base que el motor
- Severidad: media · Área: dinero (display) *(hallado independientemente por los tracks B y F)*
- Fichero: `src/features/referencia/ReferenciaPanel.tsx:44-53` vs `src/core/banco.ts:69-97`
- Qué pasa: el `itemImporte` local del panel usa como base del `%` la Σ **plana** de las líneas no-% (ignora orden y `%` previos); el motor (`baseAcumulada`/`descompUnit`) acumula estilo Arquímedes — que es lo que fija el precio al copiar. Con items [MO 10 €, %AUX 2 %, MAT 5 €, %CI 3 %]: motor 15,66 vs panel 15,75. Además usa `it.precio` directo en vez del precio de banco con fallback (`recPrecio`). Nota F-08: existe un `banco.itemImporte` exportado y totalmente muerto con el mismo nombre — confusión servida.
- Impacto: las líneas que el usuario ve en el panel no suman el precio que realmente se copia (0,09 €/ud en el caso); mina la confianza al comparar con la fuente.
- Propuesta: sustituir el `itemImporte` local por `itemImporteRec` + `baseAcumulada` de `core/banco` (ya exportados) y borrar el `banco.itemImporte` muerto. Test: Σ líneas del panel == `descompUnit(items)`.
- Estado: [confirmado]

### [B-07] El PEC/total del Sidebar difiere del documento Resumen en ~25 % de los PEM posibles
- Severidad: media-baja · Área: dinero · Fichero: `src/core/totales.ts:29-31` vs `src/core/listado.ts:225-229`; consumidores `Sidebar.tsx:150-163`, `App.tsx:58-59`
- Qué pasa: dos convenciones conviven: `scaleCents(pem, 1+gg+bi)` (StatusBar/Sidebar) y `pem + scaleCents(pem,gg) + scaleCents(pem,bi)` (hoja Resumen y doc imprimible). listado.ts lo documenta como «±1 cént.», pero ocurre en 50.518 de 200.000 PEM (25,3 %). Ej.: PEM 0,12 € → Sidebar 0,14 €, Resumen 0,15 €.
- Impacto: 1 céntimo de incoherencia visible entre vistas del mismo dato; el documento firmado es internamente coherente (verificado) — problema de confianza, no de facturación.
- Propuesta: derivar el PEC/total de barra y sidebar del mismo `buildResumen` (selector único fuente de verdad).
- Estado: [confirmado] (comportamiento documentado; hallazgo de coherencia)

### [B-08] `selectors.ts` sin ningún test (todo el dinero de la UI pasa por ahí)
- Severidad: media · Área: cobertura · Fichero: `src/store/selectors.ts`
- Qué pasa: leído entero, **no hace aritmética propia** (delega a core). El riesgo real: `_certTotals` (l.94-121) con **10 argumentos posicionales** — trasponer `extras`/`prevExtras` o `curData`/`prevData` compila y descuadraría todos los totales de la UI sin que ningún test lo detecte.
- Propuesta: test de humo con `ObraState` sintético comparando `selectCertTotals`/`selectResumen`/`selectPem` contra la llamada directa a core, con 2 certs (valida el cableado prev/cur) y memoización.
- Estado: [confirmado] (gap verificado; cableado actual correcto por lectura)

### [C-03] Fichero truncado importa como «éxito» parcial: pérdida silenciosa de ~M/~T y aviso engañoso
- Severidad: media · Área: bc3 · Fichero: `src/core/bc3import.ts` (sin check de integridad) · `src/features/importar/importShared.tsx:114-135`
- Qué pasa (obra ejemplo.bc3 cortada): al **99 %** → 167/167 partidas, PEM idéntico, 0 warnings, pero 18 mediciones perdidas (la UI ni muestra ese contador). Al **50 %** → PEM exacto, 0 warnings, TODAS las mediciones perdidas. Al **25 %** → el gate de PEM salta pero el warning le quita hierro («suelen ser variantes paramétricas…»). Vacío/binario → error legible (bien).
- Impacto: una descarga/copia truncada pasa por buena; el usuario pierde su trabajo de detalle creyendo que importó bien.
- Propuesta: heurística de truncado (el archivo debe terminar cerrando registro `…|` + EOL → si no, warning «posiblemente truncado»); añadir «partidas con medición: N» al resumen del import; reformular el aviso cuando la proporción de referencias inexistentes es alta (>10 %).
- Estado: [confirmado]

### [C-04] GG/BI/IVA no viajan en el export (asimetría con el import, que sí los lee del ~K)
- Severidad: media · Área: bc3 · Fichero: `src/core/bc3export.ts:237-238`
- Qué pasa: el `~K` exportado solo lleva el pct del coefK (y con K=1 ni se emite), sin subcampos `GG\BI\BAJA\IVA` que `ratesFromK` sí lee al importar. Round-trip: rates {gg 0.17, bi 0.06, iva 0.21} importados de centro2017 → reexport → reimport → defaults del seed {0.13, 0.06, 0.10}.
- Impacto: el destinatario del .bc3 recupera IVA/GG/BI por defecto → PEC/resumen distinto en el otro extremo.
- Propuesta: emitir siempre `~K` con `CI\GG\BI\\IVA` (espejo exacto de `ratesFromK`). Test de round-trip de `rates`.
- Estado: [confirmado]

### [C-05] El writer trunca precios a 2 decimales (y rendimientos a 3): 206 precios alterados en centro2017
- Severidad: media · Área: bc3 · Fichero: `src/core/bc3export.ts:253`, `:325-329`, `:338-341`, `:150-155`
- Qué pasa: centro2017 (34 MB) import→export→reimport: conteos/jerarquía idénticos (62.922 partidas) pero 206 precios cambian (`M07TC100: 0.313 → 0.31`); PEM −11 cts. El import conserva el crudo — la pérdida es solo del export.
- Impacto: deriva de céntimos en bancos re-exportados; rendimientos truncados desalinearían la ~D del precio (el reimport degradaría la partida a precio cerrado sin justificación).
- Propuesta: `num(x, 6)` para precio/rendimiento (`num` ya recorta ceros; el `~K` de cabecera declara los decimales). Test con 0.313 y 0.0125.
- Estado: [confirmado]

### [D-03] `addChapter` reutiliza ids de capítulo borrados → los extras huérfanos «resucitan» bajo un capítulo ajeno
- Severidad: media (agrava D-02) · Área: estado · Fichero: `src/store/obraStore.ts:1226-1235`
- Qué pasa: el id de capítulo es `String(max+1).padStart(2,'0')` sobre los vivos, no único por construcción. Borrar el último capítulo y añadir otro reusa el id → los `CertExtra` huérfanos (D-02) se re-enganchan a un capítulo sin relación. Repro en verde: contradictorio de 200 € aparece certificado bajo el capítulo nuevo.
- Propuesta: id de capítulo con `uid('ch')` (como partidas/líneas), manteniendo `code` como dato visible. El fix de D-02 elimina el vector principal.
- Estado: [confirmado]

### [D-05] Copiar/pegar (y obra-como-Referencia) pierde `precioManual`: el precio pegado colapsa en la siguiente edición del banco
- Severidad: media · Área: estado · Fichero: `src/core/refdata.ts:387` y `:412` · `src/store/obraStore.ts:275`, `:1127`
- Qué pasa: al copiar una partida con precio-override, el snapshot descarta `precioManual` a propósito («partida limpia»). La copia nace con el precio del override pero sin el flag; la primera edición de CUALQUIER precio del banco la resincroniza a su descompuesto y el precio pegado se esfuma en silencio. El import CYPE sí viaja con `precioManual:true` (`bc3ToPartidas.ts:94`) — la ruta clipboard/obra-ref quedó fuera. Repro en verde (18,42 → 9,91 tras `editRecurso` de un recurso ajeno).
- Impacto: PEM alterado sin acción del usuario sobre esa partida.
- Propuesta: propagar `precioManual` en `partidaToRefCopyItem`/`obraToRefSource` (RefPartida ya tiene el campo); o marcar override en `applyCopy` cuando `precio ≠ descompUnit`. Test: pegar override + `editRecurso` conserva el precio.
- Estado: [confirmado]

### [D-06] Marcar líneas sobre una partida certificada a mano en una cert anterior HUNDE el a-origen (cert negativa)
- Severidad: media · Área: estado · Fichero: `src/store/obraStore.ts:840-860` (`setCertLine`)
- Qué pasa: si la cert anterior se certificó A MANO (sin `lineQty`), al marcar la primera línea en la cert nueva `setCertLine` REEMPLAZA el a-origen heredado por la Σ de las líneas de esta cert: el a-origen cae (10 → 2) y `pecEsta` sale negativo sin corrección explícita. Dentro de la misma cert el comportamiento es coherente (verificado).
- Impacto: usuario que empezó certificando grueso y pasa a líneas (el flujo real del dogfood) factura en negativo sin querer.
- Propuesta: al marcar la primera línea de una partida con `data` heredado > 0 y sin `lineQty`, avisar/sembrar la diferencia o clamp `data = max(Σ líneas, anterior)` con señal visual de «a-origen < anterior».
- Estado: [confirmado] (si es intención de diseño, degradar a nota de UX; el estado es alcanzable sin aviso)

### [E-01] Los tres exports (XLSX/DOCX/BC3) fallan en silencio total para el usuario
- Severidad: media · Área: errores · Fichero: `src/App.tsx:154,157,163` (+ `ExportModal.tsx:102-115`)
- Qué pasa: `ExportModal` cierra el modal ANTES de lanzar el export. Si el import dinámico de `write-excel-file`/`docx` falla (offline, chunk con hash viejo tras deploy) o la generación lanza, el error muere en `console.error`: sin toast, sin chip, sin reapertura.
- Repro: DevTools → offline (caché vaciada) → Exportar → Excel. El modal se cierra, no se descarga nada, cero feedback.
- Impacto: el usuario cree que exportó la certificación (documento contractual) y no tiene nada.
- Propuesta: en los tres catch, además del log: `useToastStore.getState().show('No se pudo generar el archivo…')`. Una línea por sitio.
- Estado: [confirmado]

### [E-02] Worker BC3: sin timeout ni `messageerror` — muerte dura del worker deja «Procesando…» para siempre y bloquea reimportes en silencio
- Severidad: media · Área: errores · Fichero: `src/features/importar/parseBc3.ts:20-36`, `importPartida.ts:36-40`, `useBc3Parse.ts:33-53`
- Qué pasa: la promesa solo se asienta por `onmessage`/`onerror`. Sin `onmessageerror` (respuesta que no sobrevive el structured clone) ni timeout; si el navegador mata el worker (OOM con un banco enorme) no dispara `error` de forma fiable. Consecuencias confirmadas por código: `busy` queda `true` para siempre (dropzone en «Procesando…») y el latch de módulo `importing` (importPartida.ts:36) queda `true` → **todo import posterior hace `return` sin toast** hasta recargar.
- Impacto: UI colgada sin mensaje; el import queda inutilizado en silencio el resto de la sesión.
- Propuesta: `onmessageerror` → `terminate()` + reject; timeout generoso (120 s; los 29 MB tardan ~1,2 s) con mensaje accionable; el `finally` existente ya libera el latch cuando la promesa se asienta.
- Estado: falta de messageerror/timeout [confirmado]; OOM-kill sin `onerror` [sospecha, sin repro]

### [E-04 ≡ A-05] Operaciones multi-obra fire-and-forget: crear/conmutar/borrar obra sin feedback si la persistencia rechaza
- Severidad: media · Área: errores / persistencia *(hallado por los tracks A y E)*
- Fichero: `src/layout/ObraSwitcher.tsx:68,101,114` · `src/features/referencia/ReferenciaPanel.tsx:503` · `src/persist/PersistUI.tsx:78`
- Qué pasa: `void newObra(...)`, `void switchObra(...)`, `void deleteObraById(...)`, `void discardRecovery(...)` descartan el rechazo. Repro del track A en verde: `newObra` con cuota llena rechaza en `createObra` **antes** de `persistNow` → ni el chip pasa a error; el clic simplemente no hace nada.
- Impacto: acciones estructurales que fallan sin rastro; el usuario puede seguir editando creyendo que está en la obra nueva.
- Propuesta: `.catch()` en los call-sites → toast/`status:'error'`; o centralizarlo en `serializeOp` con parámetro de mensaje.
- Estado: [confirmado]

### [F-04] `obraStore.ts` (1437 LOC, ~53 acciones): dividir en slices sin cambiar comportamiento
- Severidad: media · Área: mantenibilidad · Fichero: `src/store/obraStore.ts`
- Propuesta (4 módulos, patrón slice de Zustand, cero cambio de API): (1) `store/schema.ts` — SCHEMA_VERSION, MIGRATIONS, to/fromSerializable, seed/blank (l.88-735; es lo que importa `persist/` — sacarlo desacopla persistencia del store); (2) `store/copySlice.ts` — copia de Referencia (l.161-292, 1003-1070); (3) `store/certSlice.ts` — freezePrecio, onCertEdit, setCertLine, addCert, contradictorios, ajustes (l.144-159, 816-1001); (4) `store/estructuraSlice.ts` — CRUD capítulos/subs/partidas/recursos + COW (l.1072-1433).
- Estado: [refactor aplicado] — `store/schema.ts` + `store/base.ts` (helpers puros compartidos: `ALL`, generadores de id, `subIn`) + `store/slices/{cert,copy,estructura}Slice.ts` (patrón `StateCreator` de Zustand con `Pick<ObraState, …>`, cero re-declaración de firmas). `obraStore.ts` (1525 → ~640 LOC) conserva UI/ciclo de vida, ensambla los slices y RE-EXPORTA la API pública → los 90 consumidores y `selectors.ts`/`index.ts` no cambian una línea. Suite en verde sin tocar `obraStore.test.ts`/`selectors.test.ts`.

### [G-01] El coverage está configurado solo para `src/core/**`: el 96,8 % no habla del resto
- Severidad: media · Área: cobertura · Fichero: `vite.config.ts:19`
- Qué pasa: `coverage.include: ['src/core/**/*.ts']` — `store/`, `persist/`, `features/`, `hooks/` no se miden. Precisamente donde esta auditoría concentró hallazgos (obraStore, persist, CertSummary) el número no dice nada.
- Propuesta: ampliar el include a `src/**` (excluyendo vendor y sandbox) y mirar el reporte una vez — no para perseguir un %, sino para localizar rutas de dinero/persistencia sin ningún test.
- Estado: [confirmado]

---

## Hallazgos de severidad BAJA

### [A-06 ≡ F-01] `APP_VERSION = '0.6'` duplicado literal (y ya divergente de package.json, que dice 0.1.0)
- `src/persist/persist.ts:30` · `src/persist/transfer.ts:16`. Verificado que `appVersion` solo se escribe (metadato), nunca se compara, y que nada confunde APP_VERSION con SCHEMA_VERSION. Propuesta: constante única (`src/persist/version.ts` o import desde persist.ts). Quick win. [confirmado]

### [A-07] Sin Web Locks (Safari viejo o contexto NO seguro) el candado multi-pestaña se apaga en silencio
- `src/persist/tabLock.ts:39-48,77-81`. Fallback documentado (last-writer-wins), pero matiz no documentado: `navigator.locks` solo existe en **contextos seguros** — servida por `http://` en LAN, la protección T-19 desaparece sin aviso incluso en Chrome. Propuesta: fallback con BroadcastChannel o aviso en UI cuando `lockSupported() === false`. [confirmado por lectura; colisión sin repro multiproceso]

### [A-08] Handoff al morir la pestaña dueña: el lock se libera antes de que el write de `pagehide` esté garantizado
- `src/App.tsx:117-124` · `sync.ts:157-176`. Ventana de milisegundos inherente a IDB-en-pagehide; el camino ordenado (switchObra) tiene el orden correcto. De paso: el listener de `visibilitychange` (App.tsx:120) no se limpia en el cleanup y se duplica en StrictMode (inofensivo). [sospecha, sin repro]

### [A-09] Índice de obras compartido entre pestañas sin candado: RMW cross-tab puede perder una entrada temporalmente
- `src/persist/registry.ts:117-130`. El blob de la obra nunca se pierde y `reconcile()` auto-cura al siguiente arranque (test existente). Propuesta: `navigator.locks.request('concreta.obras.index', …)` o `reconcile` al enfocar. [sospecha, sin repro]

### [A-10] Fallback de hydrate silencioso: si la activa está corrupta pero otra carga, se abre otra obra sin avisar
- `src/persist/sync.ts:243-258`. Decisión asumida (tests la cubren) pero falta el aviso. Propuesta: `setRecovery` de la corrupta conviviendo con la obra cargada, o toast «No se pudo abrir X; se abrió Y». [confirmado]

### [B-09] Etiqueta «GG + BI (N %)» redondea el porcentaje a entero
- `CertSummary.tsx:83` y `Sidebar.tsx:219`: `Math.round((gg+bi)*100)` — con GG 13,5 % + BI 6 % la etiqueta dice «20 %» y el importe aplica 19,5 % (correcto). Propuesta: `fmtNum((gg+bi)*100, 1)`. [confirmado]

### [C-06] Títulos truncados a 120 caracteres en el import
- `src/core/bc3import.ts:406`, `:463`. centro2017: 19 partidas con título cortado a 120 exactos (la desc conserva el texto, pero el export re-emite el resumen truncado — la pérdida viaja al destinatario). Propuesta: subir/eliminar el límite o truncar solo en la UI. [confirmado]

### [C-07] `hydrateItem` renombra todo concepto `%` a código `%CI` en la partida suelta
- `src/core/refdata.ts:364-367`. La línea `%` de CYPE pierde su código original; dos conceptos `%` distintos en la misma partida colapsarían al mismo código al re-exportar. [confirmado el renombrado; la colisión, sospecha sin repro]

### [D-04] El banco de recursos solo crece: sin recolección ni acción de borrado
- `obraStore.ts:1146-1164`, `:1204`, `:1361`. Ningún borrado retira recursos sin uso; no existe `deleteRecurso`. El export .bc3 ya filtra huérfanos → es bloat del blob y ruido (incl. recursos vacíos de `addItem` cancelados). Propuesta: GC oportunista en `toSerializable` según `recursoUsage`. [confirmado]

### [D-07] `mainType` es un derivado que nunca se recalcula
- `types.ts:70` · `obraStore.ts:1190`. Convertir todos los items a MQ deja el badge anterior (repro en verde). Cosmético. Propuesta: derivarlo en render (tipo con mayor importe) y retirar el campo persistido. [confirmado]

### [D-09] Borrar una línea de medición certificada deja el importe sostenido por una línea invisible e indesmarcable
- `obraStore.ts:1108`. Intencionado por semántica snapshot (types.ts:150-155) — el hallazgo es el callejón de UX: no hay checkbox para desmarcar una línea que ya no existe; la única salida es el override manual (que borra todo el lineQty). Propuesta: fila «línea eliminada» en la cert en curso, o aviso al borrar. [confirmado; comportamiento documentado]

### [E-05] Imports dinámicos de chunks sin `.catch`: el drop/botón de importar partida se vuelve no-op silencioso si el chunk no carga
- `App.tsx:253` · `ImportPartidaButton.tsx:34`. Deploy nuevo con assets purgados + sesión abierta → soltar el .bc3 no hace nada. Los `lazy()` de App.tsx tienen el mismo problema agravado por E-03. Propuesta: `.catch` con toast «Recarga la página». [confirmado]

### [E-06] Panel Referencia: carga de obra-fuente sin `.catch` → spinner infinito si IndexedDB rechaza
- `ReferenciaPanel.tsx:315-320`. Maneja el «resultado null» pero no el rechazo: `setLoading(false)` nunca corre. Propuesta: `.catch` con `setError`. [confirmado (código); fallo subyacente sospecha]

### [F-03] Otros dos duplicados de cálculo entre core y periferia
- (a) `bc3import.ts:106-112` reimplementa `dim`/`lineParcial` de `medicion.ts:15-27` con semántica de cero distinta — hoy consistente, pero el check de aceptación de mediciones usa SU réplica: si cambia la regla en medicion.ts, el round-trip se rompe en silencio. (b) La regla `pos = <códigoBase>.<n>` escrita a mano en 4 sitios (`numbering.ts:20`, `obraStore.ts:268`, `:1350`, `bc3import.ts:461`). Propuesta: exportar `lineParcial`/`dim` y un helper `nextPos()`. [confirmado]

### [F-05] `Sidebar.tsx` (775 LOC): 3 componentes independientes en un fichero
- `AjustaModal` (l.45-145, ya con test propio), `ResumenCard` (l.148-251) y el árbol (l.285-564). Extracción mecánica a `layout/sidebar/`; Sidebar queda en ~220 LOC. [refactor aplicado] — `AjustaModal`, `ResumenCard`, `ChapterCard`, `SubRow`+`SubMenu` extraídos a `layout/sidebar/` (+ `shared.ts` con `k()`/`DropHandlers`); `Sidebar.tsx` (777 → ~260 LOC) conserva el árbol y `visibleContainers`. `AjustaModal` se re-exporta desde `Sidebar.tsx` → `Sidebar.test.tsx` intacto. Los 3 CSS/tests de Sidebar (modal, coefK, DnD) siguen en verde.

### [F-06] `ReferenciaPanel.tsx` (685 LOC): separar subcomponentes y lógica de búsqueda
- `SourceSelect` (l.56-157), `RefPartidaRow` (l.160-251) y 5 `useMemo` encadenados de indexación/búsqueda (l.336-458) que son lógica pura testeable → hook `useRefIndex`. Llevarse de paso el `itemImporte` unificado de B-06. [refactor aplicado] — `SourceSelect` y `RefPartidaRow` a `referencia/components/`; las 6 derivaciones de indexación/búsqueda al hook `useRefIndex` (con `useRefIndex.test.ts` nuevo: agrupado, recuentos, búsqueda por código/título+ruta, truncado). El `itemImporte` unificado de B-06 viaja tal cual (ya estaba aplicado en el lote 4). `ReferenciaPanel.tsx` (698 → ~480 LOC) conserva el `renderNode` recursivo; App.tsx intacto (instancia única `key="ref-panel"`). `Referencia.test.tsx` en verde.

### [F-07] `bc3import.ts` y `docxRender.ts`: cohesionados; división opcional o innecesaria
- docxRender: una sola responsabilidad, dejar como está. bc3import: si se toca, extraer solo el resumidor de diagnósticos (l.122-232, ~110 LOC de UX de avisos) a `core/bc3diagnostics.ts`. [confirmado]

### [F-08] Exports muertos o solo-test en `core/`
- `banco.itemImporte` totalmente muerto (y homónimo del local de ReferenciaPanel — ver B-06). Solo-test: `fmtEur`, `pctCents`, `recursoBase`, `precioDescompuesto`, `ajusteLabel`, `findChapterIdForContainer`, `encodeCp1252`, `coefKPct`, `summarizeParserWarnings`, `bc3ToRefCopyItems`, `DEMO_REF_SOURCES`. `recPrecio` y `DEFAULT_CAP` pueden perder el `export`. Propuesta: borrar el muerto; el resto caso a caso. [confirmado]

### [F-09] Sandbox no es código muerto (chunk lazy) · los «16 TODO/FIXME» son falsos positivos
- `Sandbox` va en chunk separado vía `lazy()` (App.tsx:28), fuera del bundle inicial; arrastra `useTweaks` como único consumidor. No existe ningún TODO/FIXME real en src/: los matches son la palabra española «TODO/TODOS». Nada que limpiar. [confirmado]

### [F-10] Dependencias: todas en uso, ninguna sobrante
- `immer` no tiene import directo pero es runtime de `zustand/middleware/immer` — necesaria, no quitar (anotar por qué, para que un futuro «cleanup» no la rompa). `fflate` correcta como devDep (solo docxRender.test). [confirmado]

### [G-02] Primer `npm test` en frío puede fallar entero con un error espurio de Vitest
- Observado en esta auditoría: la primera ejecución falló 68/68 con «"vitest" is imported inside "globalSetup"» y la segunda pasó 636/636 sin cambio alguno. Parece interacción de arranque de Vitest 4 en esta máquina (transform frío). Impacto: sustos y CI flaky si ocurre allí. Propuesta: si reaparece, revisar `src/test/setup.ts` vs `globalSetup` y fijar versión; documentar el «re-ejecuta» en README mientras tanto. [sospecha, repro intermitente]

---

## Verificado y SANO (lo que se revisó y quedó limpio)

**Persistencia:** migración v1→v2 existe y está doblemente probada · versión futura se rechaza limpio en toda la cadena (blob intacto byte a byte) · un blob corrupto jamás se sobrescribe por autosave (`persistNow` solo escribe bajo `activeId`; con `activeId=null` genera id nuevo) · QuotaExceeded en autosave → chip «Sin guardar» + reintento en el siguiente drain · cola de un carril con coalescing por clave, sin envenenamiento · borrar obra con escritura en vuelo no resucita el blob · switchObra: orden flush→carga→liberar lock correcto; `isOwner` re-verificado en `persistNow` · import vs autosave en vuelo: sin ventana (estado capturado al ejecutar).

**Dinero:** coeficiente K aplicado UNA vez · contradictorios excluidos del K en todos los caminos · snapshots F7.0 correctos (congelado si existe, vivo si no; mezcla y legadas bien; fallback de coefK) · Σ subtotales por capítulo == total al céntimo en 200 escenarios aleatorios (solo roto por extras huérfanos, D-02) · aOrigen − anterior == estaCert exacto en céntimos · retención y ajustes sobre pecEsta ANTES de IVA, signo respetado; el error ×100 NO está en el motor (solo en la capa UI, B-01/B-02) · orden GG/BI sobre PEM, IVA sobre PEC · %CI no se suma como recurso; base acumulada estilo Arquímedes en el motor · importes acumulados en céntimos en todo el core; los `.reduce` float restantes son de cantidades (permitido) · `cert.data` huérfano no INFLA totales (los reduce, D-01) · el store clampa negativos en la entrada de certs · EditableNum sin redondeo oculto; `parseEsNumber` valida la cadena completa.

**BC3:** round-trip de la obra real Presto EXACTO (0 diffs en 167 partidas: título/ud/precio/cantidad/desc/mediciones/items; PEM al céntimo; jerarquía N niveles) · encoding windows-1252 con `~V` declarando ANSI correctamente; acentos/ñ/º/ª/€ sobreviven el ciclo; UTF-8 de entrada bien; fuera de cp1252 degrada a `?` visible por diseño · REC010 partida suelta: precio efectivo = costes directos CYPE, CI como badge, `precioManual` congelado, descomposición sin duplicar · vacío/binario → error legible; el worker serializa errores y la UI los muestra · export con punto decimal, sin miles, CRLF (dialecto Presto/Arquímedes) · BCCA: round-trip de conteo estable, códigos-trampa con byte no ASCII sobreviven.

**Estado:** `editRecurso` resincroniza todas las partidas respetando `precioManual` · COW sin aliasing (clones planos suficientes; Immer congela el resto) · copias profundas con ids regenerados (imposible duplicar ids de MedLine por copia) · `addCert` hereda retención/ajustes-recurrentes/extras/priceSnapshot correctamente, congela lo que falta, sin aliasing · override manual borra `lineQty` y re-marcar en la misma cert deja UN camino · `deleteSubchapter`/`moveSubtree` promueven sin destruir · `loadObra`/`reset` limpian el estado UI por-obra; el clipboard sobrevive a propósito con preflight de colisiones (la única fuga real es el toast de undo, D-08). *Nota de diseño:* el K congelado se hereda en cadena — un `coefK` renegociado a mitad de obra nunca llega a las certs nuevas (intencionado y testeado, pero tenerlo presente si algún día K puede cambiar por contrato).

**Errores:** censo completo de los 23 catch: 12 notifican bien, 8 silencios justificados (cosméticos/documentados), 3 injustificados (los exports, E-01), 0 catch vacíos · `parseEsNumber` cubre el 100 % de la entrada numérica de usuario (3 inputs en toda la UI, los 3 pasan por él) · ProjectBackup es la ruta destructiva mejor defendida (backup previo + confirm + mensajes por causa) · la capa persist no se traga fallos (chip persistente, recovery banner, hydrate con catch total) · no se usa `navigator.clipboard` (sin permisos que manejar).

---

## Orden de acometida recomendado

**Lote 1 — dinero y pérdida, arreglos pequeños (≈1 sesión):**
1. **B-01 + B-02** — 2 líneas cada uno (la conversión `pctToRate` que ya existe). Dinero real por documento.
2. **A-01** — armar autosave en la rama recovery (1 línea + test).
3. **E-01** — toast en los 3 catch de export (3 líneas).
4. **A-06/F-01** — unificar APP_VERSION (quick win).

**Lote 2 — integridad de certs al borrar (requiere decisión de semántica tuya):**
5. **D-02** — purgar extras en `deleteChapter` (+ invariante Σ capítulos == total).
6. **D-01** — decidir: ¿bloquear borrado de partida certificada, valorar desde snapshot, o limpiar avisando? (recomendación: (b) valorar certs desde `data ∪ snapshots` — preserva los documentos, que es la promesa de F7.0).
7. **D-03** — `uid('ch')` para capítulos.
8. **D-08** — `restorePartida` no-op sin capítulo + invalidar toast al cambiar de obra.

**Lote 3 — fidelidad .bc3:**
9. **C-01** — neutralizar `~` en el writer.
10. **C-02** — normalizar coma decimal en el assembler + warning.
11. **C-04** — emitir GG/BI/IVA en el `~K`.
12. **C-05** — precisión 6 dec en precios/rendimientos del export.
13. **C-03** — heurística de truncado + contador de mediciones en el resumen del import.

**Lote 4 — red de seguridad:**
14. **E-03 + A-02** — ErrorBoundary raíz con «Exportar copia» + endurecer `isObraData` un nivel.
15. **B-03** — unificar fórmula de `pecPrev` · **B-05** — round2 simétrico · **B-07** — selector único de PEC.
16. **E-02** — timeout + `onmessageerror` en el worker · **E-04, A-04, E-05, E-06** — propagar fallos a la UI.
17. **B-08 + G-01** — tests de selectors + ampliar coverage include.

**Backlog (sin urgencia):** D-05, D-06 (decisión UX), A-03, A-07, A-10, C-06, C-07, D-04, D-07, D-09, B-09 y los refactors F-03…F-08 (aprovechar F-04/F-05/F-06 cuando toque trabajar en esos ficheros, no como proyecto propio).

> Regla acordada en el plan: nada de este documento se aplica sin confirmación; los lotes 1 y 3 son mecánicos, el lote 2 necesita que decidas la semántica de borrado con certs.
