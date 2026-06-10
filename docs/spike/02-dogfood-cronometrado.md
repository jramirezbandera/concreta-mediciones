# Track 2 — Dogfood cronometrado: ¿Concreta bate a tu Excel?

> Objetivo: prueba **desechable** sobre el prototipo existente. No medimos "¿está bonito?",
> medimos **¿certificar en Concreta es más rápido que tu Excel y cuadra al céntimo?** y
> capturamos una **señal de pago** real.

## Preparación (lo que necesito de ti)
1. **Una obra real** tuya (reciente o en curso) que tenga:
   - su **presupuesto en `.bc3`** (FIEBDC-3) — exportado de Presto/Arquímedes/CYPE/lo que uses;
   - al menos **una certificación ya hecha en Excel** (para comparar y para medir tu tiempo base).
2. Pásame el **`.bc3`** (track 2 está bloqueado hasta tenerlo). Yo construyo un import
   desechable que lo carga en el prototipo.

## Protocolo

**Paso 0 — Línea base Excel (mídela ANTES de tocar Concreta).**
Haz (o rehaz) **una** certificación en tu Excel como sueles. Cronómetro en marcha.
Anota los **minutos** y los pasos que más te cuestan.

**Paso 1 — Import del `.bc3` al prototipo.**
Con el tooling que te entrego, carga el `.bc3` de esa obra. Comprueba que el **PEM cuadra al
céntimo** con lo que ves en Presto/Arquímedes (si no cuadra, eso ya es un hallazgo del spike).

**Paso 2 — Certifica en el prototipo.**
Haz **la misma** certificación que en Excel. Cronómetro en marcha. Anota minutos.

**Paso 3 — Compara.**
¿El líquido a abonar cuadra al céntimo con tu Excel? ¿Más rápido o más lento? ¿Cuánto?

## Qué registrar (rellena la tabla)

| Métrica | Excel | Concreta (prototipo) |
|---|---|---|
| Tiempo de 1 certificación (min) | ____ | ____ |
| ¿Líquido cuadra al céntimo? | — | sí / no: ____ |
| ¿PEM del import cuadra? | — | sí / no: ____ |

**Momentos "ganas de huir a Excel"** (lo más valioso — qué falta, qué es lento, qué confunde):
- ____________________________________________________________________
- ____________________________________________________________________
- ____________________________________________________________________

**Señal de pago** (pregúntatelo en serio):
- ¿Esto lo pagarías? → ____
- ¿Cuánto al mes / por obra? → ____
- ¿Qué tendría que hacer para que SÍ lo pagaras? → ____

**Bonus (donde está el oro):** que tu **colega** haga el mismo ejercicio y obsérvale **sin
ayudarle**. Apunta lo que te sorprenda de cómo lo usa.

## Done
Tabla rellena con tiempos (Excel vs prototipo), cuadre al céntimo, lista de fricciones y la
señal de pago. Con eso decidimos los criterios kill/go (D5) y si F1 arranca como está, se
reforma, o se para.
