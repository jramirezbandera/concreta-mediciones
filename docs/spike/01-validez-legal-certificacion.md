# Track 1 — ¿Es legalmente utilizable la certificación que emite Concreta?

> **Esto no es asesoramiento legal.** Es un punto de partida estructurado para que TÚ
> (arquitecto en ejercicio, COA Málaga) cierres la respuesta autoritativa rápido. Lo que
> yo aporto está marcado **[VERIFICAR]** donde no es seguro. Tú eres el experto de dominio.

## Por qué este track gatea el producto
El criterio de éxito del proyecto es "dejar de huir a Excel para certificar". Si el documento
que emite Concreta **no sirve para el cobro real** (solo es un borrador interno), entonces el
wedge de la certificación se debilita y F4 cambia de forma. Hay que responderlo **por escrito
antes de construir F4**.

## Las preguntas que hay que cerrar
1. **¿La certificación de obra que generaría Concreta es el documento de cobro válido, o solo
   un documento de trabajo del que luego nace el oficial?**
2. **¿Qué le da validez para cobrar?** (firma de la Dirección Facultativa, conformidad de
   propiedad/contratista, formato, registro…)
3. **¿Se exige firma electrónica** (AutoFirma + certificado FNMT/DNIe) o basta firma manuscrita
   sobre el PDF?
4. **¿Tus obras son mayoritariamente privadas o públicas?** (el régimen cambia, ver abajo)

## Marco legal — mi mejor entendimiento (a confirmar por ti)

**Obra privada (reformas, pequeño/mediano — probablemente tu caso principal):**
- No hay un "formato oficial" obligatorio del documento de certificación. **[VERIFICAR]**
- Rige el **contrato** entre propiedad y constructora. El instrumento de cobro habitual es la
  **certificación firmada por la Dirección Facultativa** (relación valorada del periodo:
  a origen / anterior / esta certificación, retención, IVA, líquido) + conformidad de las
  partes. **[VERIFICAR]**
- Implicación: una certificación que Concreta genere y que tú **firmes** (manuscrita o
  e-firma) **sería utilizable** para el cobro en obra privada. El bloqueante NO sería fatal.
  **[VERIFICAR — es la hipótesis clave a confirmar]**

**Obra pública:**
- Regulada por la **LCSP (Ley 9/2017), art. 240 "Certificaciones y abonos a cuenta"**: la DF
  hace la **relación valorada**; la **certificación la expide el órgano de contratación** (la
  Administración), con carácter de abono a cuenta, normalmente mensual, y se tramita por sus
  **plataformas electrónicas**. **[VERIFICAR]**
- Implicación: en obra pública, Concreta produciría la **relación valorada / borrador**, no la
  certificación oficial (esa la emite la Administración). El documento de Concreta sería
  insumo, no el acto administrativo. **[VERIFICAR]**

**Firma electrónica:**
- **eIDAS** + **Ley 6/2020**: la **firma electrónica cualificada** tiene equivalencia legal a
  la manuscrita. AutoFirma con certificado FNMT/DNIe es la vía habitual en España. **[VERIFICAR]**
- Para obra privada suele bastar firma manuscrita sobre PDF; la e-firma es **buena práctica /
  profesionalidad**, no necesariamente requisito. **[VERIFICAR]**

**LOE (Ley 38/1999):** regula agentes y responsabilidades de la edificación, no el formato del
documento de cobro. No es el marco que decide esto. **[VERIFICAR]**

## Matriz de decisión (qué cambia según tu respuesta)

| Tu respuesta | Efecto en F4 | Efecto en T-2 (inmutabilidad) | Efecto en el wedge |
|---|---|---|---|
| **Doc legal de cobro firmado por la DF** (privado) | F4 debe permitir **firmar** (e-firma o exportar PDF para firma) | **T-2 entra en F4** (emitida/borrador + snapshot, sin retro-edición silenciosa) | wedge de cobro intacto: certificas y cobras desde la herramienta |
| **Solo documento de trabajo; el oficial lo expide la Administración** (público) | F4 produce **relación valorada / borrador** exportable a la plataforma | T-2 aplazable (no es el documento de cobro) | wedge se reubica: "preparar la certificación" más que "emitir el cobro" |
| **Mixto** (tienes de los dos) | soportar ambos modos | T-2 condicional al modo | el producto cubre los dos flujos |

## TU RESPUESTA AUTORITATIVA (rellena esto)

- **¿Cobro legal o documento de trabajo?** → _____________________________________________
- **¿Privado, público o mixto en tu cartera?** → __________________________________________
- **¿Qué le da validez (firma DF / conformidad / formato)?** → ____________________________
- **¿e-firma exigida o basta manuscrita sobre PDF?** → ____________________________________
- **¿Tus clientes/administraciones piden algún formato concreto?** → ______________________
- **Conclusión para F4/T-2:** ______________________________________________________________

## Done
Respuesta escrita arriba (cobro/trabajo + público/privado + e-firma sí/no + formato),
**antes** de empezar a construir F4. Esto cierra la Open Question "[BLOQUEANTE antes de F4]"
del design doc y fija la prioridad de T-2.
