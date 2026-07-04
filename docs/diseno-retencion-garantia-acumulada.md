# Diseño · Retención de garantía como ajuste predefinido + retenido acumulado

> Sesión de office-hours. Producto de diseño, no implementación.
> Fecha: 2026-07-04 · rama `main` · continúa de `8036b9c` (la retención dejó de ser fila fija).

## Objetivo

Dos cosas encima del mecanismo de ajustes ya existente:

1. **"Añadir ajuste" ofrece una retención de garantía predefinida** (además del ajuste en blanco).
2. **Bajo el líquido a abonar, una línea informativa** (jerarquía menor) con el **retenido de garantía acumulado** entre certificaciones, para llevar control.

## Decisiones tomadas

| # | Decisión | Elegido |
|---|----------|---------|
| D1 | Modelo de datos de la retención predefinida | **Ajuste etiquetado** con `preset:'retencion'` (no revivir `Cert.retencion`) |
| D2 | Qué muestra el acumulado | **Neto hasta esta cert (inclusive)**: Σ retenido − Σ devuelto |
| D3 | Dónde aparece la línea de acumulado | **Pantalla + documentos** (PDF / DOCX / XLSX) |

## Contexto del código (anclaje)

- `Cert.retencion` (0..1) → fila "Retención garantía", solo si `>0`. Mecanismo *legacy*, ya no forzado. [CertSummary.tsx:96](../src/features/certificaciones/CertSummary.tsx#L96)
- `Cert.ajustes: Ajuste[]` → concepto libre, `tipo` %/€, `signo` −/+, `recurrente`. Aplica a la base **antes de IVA**: `base = pecEsta − ret + Σ ajustes`. [certificacion.ts:288](../src/core/certificacion.ts#L288)
- `addAjuste()` crea un ajuste en blanco (fijo, negativo, no recurrente). [certSlice.ts:206](../src/store/slices/certSlice.ts#L206)
- Los recurrentes se heredan a la cert nueva con id nuevo (spread copia todos los campos → `preset` se conserva). [certSlice.ts:129](../src/store/slices/certSlice.ts#L129)
- Cada ajuste ya fluye a los exports vía `t.ajustesRows`. [PrintCert.tsx:142](../src/features/print/PrintCert.tsx#L142) · [xlsxBuilders.ts:346](../src/features/exportar/xlsxBuilders.ts#L346) · [docxRender.ts:490](../src/features/exportar/docxRender.ts#L490)
- Esquema en `SCHEMA_VERSION = 3` con migraciones en cadena. Un campo **opcional** nuevo en `Ajuste` no necesita migración (undefined = ajuste normal).

## Modelo de datos

Un solo campo nuevo, opcional, retrocompatible:

```ts
// core/types.ts
export interface Ajuste {
  id: string;
  concepto: string;
  tipo: 'pct' | 'fijo';
  valor: number;
  signo: -1 | 1;
  recurrente: boolean;
  /** Marca semántica. 'retencion' = retención de garantía: entra en el acumulado
   *  y en el trato especial de UI. undefined = ajuste normal. */
  preset?: 'retencion';
}
```

La retención vuelve a ser "un ajuste más" (misma valoración, mismo flujo a exports), pero **etiquetada** para que el acumulador y la UI la reconozcan sin depender del texto del concepto.

## Feature 1 — "Añadir ajuste" con predefinido

### Acción del store

`addAjuste()` pasa a `addAjuste(preset?: 'retencion')`. Con `preset === 'retencion'` inserta la plantilla:

```ts
{
  id: nextAjusteId(),
  concepto: 'Retención garantía',
  tipo: 'pct',
  valor: 0.05,          // 5% por defecto (ver nota); reutilizar el último % usado si existe
  signo: -1,            // retiene
  recurrente: true,     // se hereda cert a cert
  preset: 'retencion',
}
```

> Nota `valor`: 5% es el estándar habitual en obra privada y en LCSP. Mejora opcional: si la obra ya usó una retención antes (ajuste-retención o `Cert.retencion` legacy en cualquier cert), precargar ese %.

### UI del botón

Hoy "+ Añadir ajuste" es un botón único que crea en blanco. Pasa a **botón con menú** (popover anclado, estilo selección del sistema, coherente con `31d85ca`):

- **Ajuste en blanco** → `addAjuste()`
- **Retención de garantía** → `addAjuste('retencion')`

Alternativa más barata si el popover molesta: dejar "+ Añadir ajuste" para el blanco y añadir un chip secundario "+ Retención de garantía". El popover encaja mejor con lo pedido ("al darle a añadir ajuste, una opción de seleccionar").

### Guarda de doble retención (P3)

La opción "Retención de garantía" se **desactiva** (con tooltip "Esta certificación ya tiene retención") si la cert ya tiene:
- `retencion > 0` (obra legacy), o
- algún ajuste con `preset === 'retencion'`.

Evita retener dos veces sin querer.

## Feature 2 — Retenido acumulado

### Definición (D2: neto, hasta esta cert inclusive)

Por cert, el retenido bruto de ESTA cert (magnitud positiva = dinero que se queda la propiedad):

```
retenidoEstaCert(cert) =
    scaleCents(pecEsta, cert.retencion)                    // legacy, siempre retiene
  + Σ  (a.preset==='retencion')  →  (−a.signo) · ajusteImporte(a, pecEsta)
```

`signo −1` (retiene) aporta `+importe`; `signo +1` (devolución de garantía) aporta `−importe`. Así una línea de retención suma al retenido y una devolución lo resta, con un único modelo.

```
retenidoAcumulado(N) = Σ  para i = 0..N   retenidoEstaCert(cert_i)
```

Es la garantía en poder de la propiedad **a fecha de la certificación N**. Crece cert a cert y baja cuando se devuelve.

### Selector cross-cert

`selectRetenidoAcumulado(index)` en `store/selectors.ts`. Necesita el `pecEsta` de cada cert ≤ index, que hoy solo lo da `certTotals` (loop por partidas + snapshot).

**Perf** (el audit ya marcó esta zona): no llamar a `certTotals` completo por cada cert. Extraer un camino ligero que calcule solo `pecEsta` por cert (sin `ajustesRows`/capítulos) y aplicarle la retención. Memoizar el selector por `[certs, partidas, rates]`. Para obras típicas (pocas certs) el coste es bajo, pero la extracción evita recomputar los resúmenes de todas las certs en cada render.

### UI de la línea informativa

Bajo el bloque `liqFinal` de [CertSummary.tsx:237](../src/features/certificaciones/CertSummary.tsx#L237), una línea de **menor jerarquía** (tamaño menor, color atenuado `var(--text-disabled)`/secundario, sin acento, sin el `−` de resta porque no se descuenta aquí, es informativa):

```
Retenido acumulado (garantía)            12.345,67 €
hasta la certificación nº N
```

- Recibe el valor por **prop** desde `CertificacionesView` (no meterlo en `CertTotals`, que es puro por-cert).
- **Visibilidad**: mostrar si en las certs ≤ N hubo cualquier retención bruta (>0), aunque el neto sea 0 — así queda constancia de "garantía devuelta" cuando se cierra.
- Tooltip: "Garantía retenida hasta esta certificación (retenido − devuelto)".

### Exports (D3: también en documentos)

Añadir la línea "Retenido acumulado" **bajo** "Líquido a abonar" en:
- [PrintCert.tsx:160](../src/features/print/PrintCert.tsx#L160)
- [docxRender.ts:493](../src/features/exportar/docxRender.ts#L493)
- [xlsxBuilders.ts:349](../src/features/exportar/xlsxBuilders.ts#L349)

El valor es cross-cert, así que **se pasa explícito** en el payload de cada documento (calculado una vez con el selector), no se deriva de `CertTotals`. Mantener el estilo "informativo" (no negrita, secundario) para no competir con el líquido.

## Casos borde

- **Cert 1 con retención** → acumulado = retención de la cert 1.
- **Devolución total al cierre** → línea de retención con `signo +` por el acumulado; el neto llega a 0. La línea sigue visible mostrando 0,00 € (constancia).
- **Obra legacy** (`Cert.retencion>0`, sin ajustes) → el acumulado suma el legacy. Correcto sin tocar datos.
- **pecEsta negativa** (cert correctora a la baja) → la retención sobre base negativa es negativa (reduce el acumulado). Coherente; cubrir con test para fijar el signo.
- **Recurrencia** → el ajuste-retención recurrente se hereda con id nuevo y conserva `preset` (spread). Confirmar en test de `addCert`.

## Plan de implementación (por archivo)

1. `core/types.ts` — añadir `Ajuste.preset?: 'retencion'`.
2. `store/slices/certSlice.ts` — `addAjuste(preset?)` con la plantilla de retención.
3. `core/certificacion.ts` — helper `retenidoEstaCert(...)` (o exponer un `pecEsta` ligero) + `ajusteEsRetencion(a)`.
4. `store/selectors.ts` — `selectRetenidoAcumulado(index)` memoizado.
5. `features/certificaciones/CertSummary.tsx` — menú en "Añadir ajuste", guarda de doble retención, fila informativa (recibe `retenidoAcumulado` por prop).
6. `features/certificaciones/CertificacionesView.tsx` — calcular y pasar el acumulado a `CertSummary` y al payload de impresión.
7. Exports — línea "Retenido acumulado" en `PrintCert.tsx`, `docxRender.ts`, `xlsxBuilders.ts` (+ su payload).

## Tests

- `certificacion.test.ts` — retenido neto por cert; devolución (signo +) resta; legacy + ajuste conviven; pecEsta negativa.
- `selectors.test.ts` — acumulado hasta N; solo cuenta certs ≤ N; suma legacy + tag.
- `certSlice` — `addAjuste('retencion')` rellena la plantilla; `addCert` hereda el recurrente con `preset`.
- Exports — la línea "Retenido acumulado" aparece bajo el líquido en PDF/DOCX/XLSX.

## Fuera de alcance (por ahora)

- Migrar el campo `Cert.retencion` legacy a ajuste (no hace falta: el acumulador lee ambos). Se puede hacer más adelante si queréis un único mecanismo.
- Fecha/hito de devolución de garantía (fin de plazo de garantía). Hoy la devolución es una línea manual con signo +; un calendario de devolución sería otra feature.

## La asignación

En la próxima certificación real de una obra con retención: comprueba a mano que el "retenido acumulado" que muestra la app coincide con el control que llevas hoy (Excel/papel), y prueba el flujo de devolución añadiendo una línea de retención con signo + para confirmar que el acumulado baja. Validar el número contra la realidad antes de fiarte de él es lo que convierte esto en "control" de verdad.
