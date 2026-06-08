# Spike §0.5 — Validación + legal (gate antes de F1)

Gate definido en `IMPLEMENTATION_PLAN.md` §0.5 (revisión CEO 2026-06-08). Ataca las dos
incógnitas que pueden invalidar el producto **antes** de construir F1 en producción.

| Track | Doc | Estado | Done = |
|-------|-----|--------|--------|
| 1 · Validez legal de la certificación | [`01-validez-legal-certificacion.md`](01-validez-legal-certificacion.md) | 🟡 hipótesis del fundador (a confirmar por escrito) | respuesta escrita: ¿documento de cobro legal o de trabajo? + público/privado + e-firma sí/no |
| 2 · Dogfood cronometrado vs Excel | [`02-dogfood-cronometrado.md`](02-dogfood-cronometrado.md) | 🟢 import resuelto · `dogfood.html` listo · falta cronometrar | tabla con tiempos (Excel vs prototipo) + fricciones + señal de pago |

## Hallazgos del import (track 2, 2026-06-08)
`obra ejemplo.bc3` (Presto 8.7, FIEBDC-3/2002, ANSI) → **19 capítulos · 167 partidas · 497 recursos**, mapeado con `ogorhc/bc3`.
- **PEM (Σ partidas a precio unitario) = 434.777,78 €.** El precio de la raíz del .bc3 = 491.298,72 € = **PEM × 1,13** (coeficiente global del registro `~K`, p.ej. GG 13%). Confirmado: `491.298,72 / 1,13 = 434.777,63`.
- **Estructura ✅** correcta. **Al céntimo ⚠**: desviación de céntimos (~0,15 € en el total) por el redondeo del precio unitario (`prices[0]` a 2 dec). El cuadre exacto exige recalcular cada precio desde su descomposición a plena precisión → **eso es el motor de F1 (céntimos enteros)**, no un fallo del mapeo.
- La medición se adjunta al **capítulo** (no a la partida); las partidas se identifican por la **descomposición** del contenedor (perf = cantidad).

## Hipótesis legal del fundador (track 1, a confirmar por escrito)
> "Para obra privada pequeña/mediana, una certificación firmada por la DF es utilizable para el cobro; el bloqueante legal probablemente NO es fatal."

**Implicación (decisión D3 de la revisión CEO):** si se confirma que la cert es **documento legal de cobro**, **T-2 (inmutabilidad: emitida/borrador + snapshot) entra en F4**. Pendiente de la respuesta escrita en `01-…md`.

**Qué decide cada track:**
- Track 1 → si la cert es documento legal de cobro, **T-2 (inmutabilidad) entra en F4** y la
  herramienta necesita firma; si es documento de trabajo, T-2 sigue aplazado.
- Track 2 → si **no** bates a Excel en tiempo o el resultado no cuadra al céntimo, el plan se
  replantea antes de gastar semanas.

**Criterios kill/go:** se deciden con la evidencia del spike en mano (D5), no prefijados.

> Esto es trabajo desechable sobre el prototipo existente. No es código de producción.
