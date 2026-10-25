# Verificación normativa — Plan de control de calidad: estructura (Código Estructural)

**Fecha:** 2026-10-24 · Agente: verificador de normativa estructural · **No se ha editado código.**
**Encargo:** control de la estructura de hormigón y acero del Plan de control de calidad del proyecto de ejecución (app «Mediciones», obra privada), según el **Código Estructural (RD 470/2021)**. Criterios numerados **K-PCC.20 … K-PCC.39**, en el orden de las preguntas 1–10. El CTE y Andalucía los cubren otros verificadores.

**Método y límites de esta sesión**
- **Texto consolidado del BOE** del RD 470/2021 (BOE-A-2021-13681), descargado el 2026-10-24 a `volcados/norma/pdf/CodE-consolidado.pdf` (367 MB, 1743 páginas) y volcado con `pdftotext -layout` a `volcados/norma/txt/CodE-consolidado.txt`. Las páginas **1–267 (real decreto y articulado) tienen capa de texto**. Las **268–1743 (anejos) son imagen**: se han leído renderizándolas con PyMuPDF (`volcados/norma/img/`). La página citada es el pie «Página N» del consolidado, que coincide con el número de página del PDF.
- **Tablas:** `pdftotext` desordena las tablas 14, 17.1, 57.5.4.1, 57.5.4.3.a, 57.5.7 y 63.1. Todas se han **cotejado en imagen**: VERIFICADO (imagen). Las fórmulas de aceptación (57.5.4.3.a, 57.5.5.2) solo se ven en la imagen.
- **Corrección de errores** BOE-A-2024-1989 (BOE núm. 29, 02-02-2024), descargada y volcada (`volcados/norma/txt2/`). **El consolidado del BOE no la incorpora**: sigue diciendo «Última modificación: sin modificaciones» (p. 5) y conserva los textos erróneos (arts. 58, 63 y 57.7.3.1). Donde la corrección cambia un texto citado aquí, se cita ya corregido y se avisa.
- **Hoja de la Junta** (Plan de CC de materiales, versión CodE, v03 oct-2022): valores en `volcados/PlanCC_xls.txt` y **fórmulas** extraídas del `.xls` original en `volcados/scripts/PlanCC_formulas.txt` (resumen por patrones en `volcados/scripts/aux_patterns.txt`; ambos los generó otra sesión, y se han cotejado las celdas citadas). Es referencia práctica, no norma.
- Ficha del BOE (`buscar/doc.php?id=BOE-A-2021-13681`), leída con curl: fecha de entrada en vigor, derogaciones y referencias posteriores.
- No se ha usado ningún navegador.

**Veredictos** (los de `verificacion-residuos.md`):
- **VERIFICADO (imagen)** / **VERIFICADO (texto)**: literal de la norma, con página.
- **LEÍDO (web)**: ficha del BOE en HTML.
- **INTERPRETACIÓN**: se sigue de la norma, pero la norma no lo escribe tal cual.
- **CORREGIDO**: el encargo, la hoja de la Junta o una plantilla no coinciden con la norma.
- **SIN CONFIRMAR**: no se ha podido leer en fuente oficial. **No se codifica.**

---

## 0. Fuentes y ediciones

| Clave | Documento | Edición / versión | Fuente | Lectura |
|---|---|---|---|---|
| [CodE] | RD 470/2021, de 29 de junio, por el que se aprueba el Código Estructural | BOE núm. 190, 10-08-2021. Consolidado: «Última modificación: sin modificaciones» (p. 5) | BOE-A-2021-13681, PDF consolidado | **VERIFICADO (texto)**: RD (pp. 5–8); arts. 2, 14–23 (pp. 8, 21–36); 26 (p. 42); 38 (p. 79); 55–73 (pp. 136–182); 79 (pp. 189–190); 91.2 (pp. 214–215); 97–103 (pp. 241–255). **VERIFICADO (imagen)**: tablas 14 (p. 22), 17.1 (p. 25), 57.5.4.1 (pp. 145–146), 57.5.4.3.a/b (p. 147), 57.5.5.2 (p. 148), 57.5.7 (p. 149), 63.1 (p. 174); anejo 15 (pp. 490–495); anejo 17 (pp. 509–512); anejo 19, ap. 3.1.6 (p. 603) |
| [CE-24] | Corrección de errores del RD 470/2021 | BOE núm. 29, 02-02-2024, pp. 13450–13453 | BOE-A-2024-1989, PDF | **VERIFICADO (texto)**. Afecta a arts. 23.2, 57.7.3.1, 58, 63, 99 y a la tabla A15.2.2.a, entre otros |
| [FICHA] | Ficha «Análisis» del BOE de BOE-A-2021-13681 | consultada 2026-10-24 | boe.es (HTML) | **LEÍDO (web)**: entrada en vigor 10-11-2021; deroga RD 1247/2008 y RD 751/2011 con efectos 10-11-2021; única referencia posterior, la corrección de 2024 |
| [EHE-08] | RD 1247/2008, Instrucción de hormigón estructural | **Derogada** desde el 10-11-2021 | [CodE] disp. derogatoria única, p. 7 | VERIFICADO (texto) la derogación. Texto de la EHE-08 **no leído** |
| [EAE] | RD 751/2011, Instrucción de Acero Estructural | **Derogada** desde el 10-11-2021 | ídem | VERIFICADO (texto) la derogación |
| [RC-16] | RD 256/2016, Instrucción para la recepción de cementos (RC-16) | BOE núm. 153, 25-06-2016; consolidado «Última modificación: 10 de abril de 2024» | BOE-A-2016-6167 (volcado de otra sesión en `volcados/norma/txt/`) | **VERIFICADO (texto)**: cabecera y disp. derogatoria única (deroga la RC-08). Articulado no leído |
| [JUNTA] | «Plan de Control de Calidad de Materiales para Obras de Edificación (versión Código Estructural)», Consejería de Fomento + ALA + ETSIE Sevilla | «Versión 03, octubre 2022»; nº registro JAFIOT / SGT-01-2022 | `.xls` en `ejemplos pdf\control calidad\` (volcado de valores y de fórmulas) | **VERIFICADO (texto)** lo que dice la hoja. Hay una V04 (2023) en `volcados/norma/xls/PlanCC_CodE_V04_2023.xls`, **no analizada** |

### Lo que cambia el planteamiento (resumen)

1. **La EHE-08 y la EAE están derogadas desde el 10-11-2021.** Desde el **11-11-2022** ninguna obra de edificación nueva puede regirse por la EHE-08 (régimen transitorio de un año). Toda cita a la EHE-08 en el plan es un error. (K-PCC.20)
2. **El plan de control del proyecto tiene que valorar el coste total del control de la estructura** (art. 19). El Código pide además que ese coste vaya **independiente en el presupuesto** y lo pague la propiedad, «siempre que la legislación aplicable lo permita» (art. 17). (K-PCC.21)
3. **Lotes de resistencia (tabla 57.5.4.1):** el lote no puede superar **ninguno** de los límites de su fila (volumen, tiempo, superficie, **plantas**), ni seis semanas. Los hormigones con distintivo multiplican el tamaño por 5 y bajan a **N = 1**, con un **mínimo de 3 lotes** en la obra. (K-PCC.27)
4. **El control indirecto (modalidad 3) exige distintivo y fcd ≤ 15 N/mm².** Con αcc = 1,00 y γc = 1,5, **un HA-25 da fcd = 16,7 y no puede usarlo**. (K-PCC.26)
5. **CORREGIDO (hoja de la Junta):** la hoja **no aplica el límite de «2 plantas»** a forjados ni a pilares. En una vivienda de tres plantas eso da un lote de menos. Tampoco aplica los límites de tiempo, y cita la **EHE-08 para encepados** (los encepados no están excluidos del Código). (K-PCC.38, K-PCC.39)
6. **Armaduras:** si la ferralla llega elaborada de taller, lo que controla la DF en obra es la **ferralla (art. 59.2: lotes ≤ 25 t; 4 tracciones, 2 geometrías por diámetro y 15 unidades medidas)**, no el «2 ensayos cada 30 t» del acero en barra (art. 58), que la hoja aplica en todos los casos. (K-PCC.31, K-PCC.32)
7. **Acero estructural:** el Código **no fija ensayos de recepción** de perfiles con marcado CE. Lo obligatorio es la **inspección visual del 100 % de los cordones** y los END según el plan de control, con las frecuencias del anejo 17 como orientación. (K-PCC.33)
8. **Control de ejecución:** el **pliego de prescripciones técnicas particulares (PPTP) fija el nivel (normal o intenso)**. El nivel intenso exige un constructor con ISO 9001. Para edificación sencilla, el anejo 15 tiene una **opción simplificada** (tabla A15.2.2.c). (K-PCC.35)
9. **Corrección de errores de 2024:** el consolidado del BOE no la recoge. Cambia, entre otras cosas, el art. 58: la comprobación frente a fatiga y cargas cíclicas pasa a ser de todo acero, no solo del SD. (K-PCC.20, K-PCC.31)

---

## K-PCC.20 — Vigencia, entrada en vigor, régimen transitorio y derogaciones

**Respuesta.** Vigente. Entró en vigor el **10-11-2021**, tres meses después de su publicación (10-08-2021). Deroga la **EHE-08 (RD 1247/2008)** y la **EAE (RD 751/2011)**. No tiene modificaciones; solo una **corrección de errores (BOE 02-02-2024)**. El régimen transitorio dejó proyectar con la EHE-08 los encargos anteriores al 10-11-2021, siempre que la obra de edificación empezara antes de un año. **Desde el 11-11-2022 ningún proyecto de edificación puede acogerse a la EHE-08.**

**Cita.**
- [CodE] p. 7, **VERIFICADO (texto)**: «Disposición transitoria única. […] Lo dispuesto en este real decreto no será de aplicación a los proyectos cuya orden de redacción o de estudio, en el ámbito de las Administraciones públicas, o encargo, en otros casos, se hubiese efectuado con anterioridad a su entrada en vigor, ni a las obras de ellos derivadas, siempre que estas se inicien en un plazo no superior a un año para las obras de edificación, ni de tres años para las de ingeniería civil, desde dicha entrada en vigor, salvo que […] el promotor, se acordase acomodar el proyecto al contenido del «Código estructural».»
- [CodE] p. 7: «Disposición derogatoria única. […] 1. Quedan derogados el Real Decreto 1247/2008, de 18 de julio, por el que se aprueba la instrucción de hormigón estructural (EHE-08), y el Real Decreto 751/2011, de 27 de mayo, por el que se aprueba la Instrucción de Acero Estructural (EAE).»
- [CodE] p. 8: «Disposición final cuarta. Entrada en vigor. El presente real decreto entrará en vigor a los tres meses de su publicación en el «Boletín Oficial del Estado».»
- [FICHA], **LEÍDO (web)**: «Fecha de entrada en vigor: 10/11/2021 […] CORRECCIÓN de errores en BOE núm. 29 de 2 de febrero de 2024 (Ref. BOE-A-2024-1989)».
- [CodE] p. 7, disp. adicional segunda: en el sector público se pueden usar los Eurocódigos como alternativa. **No se aplica a la obra privada.**

**INTERPRETACIÓN.** Fecha de corte: 10-11-2021 + 1 año = 10-11-2022.

**CORREGIDO (consolidado del BOE).** El PDF consolidado conserva los textos que corrigió [CE-24]. La app debe citar los textos corregidos (K-PCC.28, K-PCC.31, K-PCC.35).

**Consecuencia para la app.** Cabecera normativa: «Real Decreto 470/2021, de 29 de junio, Código Estructural (BOE 10-08-2021; corrección de errores BOE 02-02-2024)».

---

## K-PCC.21 — Estructura del control en el Código y contenido del plan de control del proyecto

**Respuesta.** El control lo regulan las **bases generales** del capítulo 5 (arts. 17–23). Para el hormigón se desarrolla en los **capítulos 12 (proyecto), 13 (productos) y 14 (ejecución)**; para el acero, en los **capítulos 22, 23 y 24**. El **plan de control del proyecto** solo tiene un contenido mínimo explícito: las comprobaciones y ensayos, y la **valoración del coste total**. El **programa de control** lo aprueba la DF antes de empezar y desarrolla el plan.

**Cita.**
- [CodE] p. 25, tabla 17.1, **VERIFICADO (imagen)**:

| Tipo de conformidad | Hormigón | Acero | Mixtas |
|---|---|---|---|
| Control del proyecto | Art. 20 + cap. 12 | Art. 20 + cap. 22 | Art. 20 + cap. 32 |
| Control de la conformidad de los productos | Art. 21 + cap. 13 | Art. 21 + cap. 23 | Art. 21 + cap. 33 |
| Control de la ejecución de la estructura | Art. 22 + cap. 14 | Art. 22 + cap. 24 | Art. 22 + cap. 34 |
| Control de la estructura terminada | Art. 23 | Art. 23 | Art. 23 |

- [CodE] art. 19, p. 30, **VERIFICADO (texto)**: «En el plan de control de calidad del proyecto de ejecución de una obra se incluirá el plan de control de la estructura, indicando las comprobaciones y ensayos que se consideren oportunos. Así mismo se deberá valorar el coste total del control de calidad de la estructura.
Antes de iniciar las actividades de control en la obra, la dirección facultativa aprobará un programa de control, preparado de acuerdo con el plan de control definido en el proyecto, y que tenga en cuenta el cronograma o plan de obra del constructor y su procedimiento de autocontrol. El programa de control contemplará, al menos, los siguientes aspectos: a) la identificación de productos y procesos objeto de control, definiendo los correspondientes lotes de control y unidades de inspección, describiendo para cada caso las comprobaciones a realizar y los criterios a seguir en el caso de no conformidad; b) la previsión de medios materiales y humanos […]; c) la programación del control […]; d) la designación del responsable encargado de la toma de muestras […]; y e) el sistema de documentación del control […].»
- [CodE] art. 17, p. 25: «Siempre que la legislación aplicable lo permita, el coste del control de calidad efectuado por la dirección facultativa y estimado en el plan de control deberá considerarse de forma independiente en el presupuesto de cualquiera de las actuaciones referentes a la obra y será retribuido directamente por la propiedad y no por la empresa constructora.»
- [CodE] art. 17, p. 25 (alternativas de control): «a) un control basado en una comprobación estadística del producto o proceso, llevada a cabo por un laboratorio o entidad de control independiente que desarrolle su actividad para la dirección facultativa, o b) un control basado en una comprobación estadística […] llevada a cabo directamente por el constructor, combinado con un control externo del anterior llevado a cabo por la dirección facultativa […]». El anejo 15 las llama **opción A** y **opción B** (p. 491).
- [CodE] arts. 56, 58, 59.1: «Sin perjuicio de lo establecido al respecto en este Código, el pliego de prescripciones técnicas particulares o, en su caso, el plan de control podrá fijar los ensayos que considere pertinentes» (pp. 138, 154, 156).

**INTERPRETACIÓN.**
- El Código **no tiene un anejo** con el modelo de plan de control del proyecto. El anejo 3 es la lista de comprobación del **control de proyecto** (art. 55), que es otra cosa. Su contenido mínimo es: ensayos y comprobaciones, más coste total. Los lotes y las unidades de inspección son del **programa** (la DF, en obra). El plan puede adelantarlos como previsión, y eso es lo que calcula la app.
- «Coste independiente en el presupuesto»: en obra privada, el capítulo de control de calidad es el instrumento natural. Lo que el Código pide es que **no lo pague el contratista**. Cuadra con el capítulo independiente del presupuesto (lo cubre el verificador del CTE).

**Consecuencia para la app.** El documento lleva (1) la relación de controles y ensayos, por producto y proceso; (2) la previsión de lotes, amasadas y ensayos calculada desde las mediciones; (3) la valoración total; (4) una nota: «La DF aprobará el programa de control (art. 19), que ajustará los lotes al plan de obra».

---

## K-PCC.22 — Agentes del control: quién hace qué

**Cita.**
- [CodE] 17.2.1, p. 26, **VERIFICADO (texto)**: la DF debe «a) aprobar un programa de control de calidad para la obra, que desarrolle el plan de control incluido en el proyecto, b) velar por el desarrollo y validar las actividades de control […], c) recopilar y archivar la documentación del control realizado.» Y: «En el ámbito de la edificación, de acuerdo con el Artículo 13 de la Ley 38/1999 […], estas serán obligaciones del director de la ejecución.»
- [CodE] 17.2.2, p. 26: «La propiedad encomendará la realización de los ensayos de control a un laboratorio que sea conforme a lo establecido en el apartado 17.2.2.1.» Los laboratorios y entidades entregan antes de la obra una **declaración de independencia** firmada (p. 27).
- [CodE] 17.2.2.1, p. 27: laboratorios acreditados conforme al Reglamento (CE) 765/2008, o que cumplan el RD 410/2010; «Se considerará su inscripción en el Registro General del CTE […]».
- [CodE] art. 17, p. 25: «La garantía de la calidad de dicha estructura será responsabilidad del constructor. Para ello, el constructor […] dispondrá de un sistema de aseguramiento de la calidad propio […] procedimiento de autocontrol del constructor.»
- [CodE] 22.1, p. 33: el constructor elabora «el plan de obra y el programa de autocontrol de la ejecución de la estructura, desarrollando el plan de control definido en el proyecto», y ese programa lo aprueba la DF antes de empezar.
- [CodE] 57.2, p. 140: el acta de toma de muestras la levanta «el representante del laboratorio» y la firma, como mínimo, también un representante del constructor. El constructor o el suministrador pueden pedir **a su costa** una toma de contraste.

**Consecuencia para la app.** Párrafo fijo de agentes: DEO (DF en edificación), laboratorio acreditado contratado por la propiedad, constructor (autocontrol), suministradores (documentación). En la valoración solo entran los ensayos del laboratorio de la propiedad. El autocontrol del constructor va a su cargo.

---

## K-PCC.23 — Distintivos de calidad oficialmente reconocidos (DCOR): qué reducen y cómo se acreditan

**Cita.**
- [CodE] art. 18, p. 28, **VERIFICADO (texto)**: «a) mediante la posesión de un distintivo de calidad oficialmente reconocido (DCOR) concedido a un organismo de certificación acreditado conforme al Reglamento (CE) N.º 765/2008 […]». Para productos **sin** marcado CE obligatorio, el reconocimiento oficial lo da la «Subdirección General de Normativa y Estudios Técnicos del Ministerio de Transportes, Movilidad y Agenda Urbana u otro órgano directivo con competencias en el ámbito de la edificación o de la obra pública» de cualquier Estado de la UE, Turquía o el EEE. Además: «en el caso de los productos con marcado CE, los distintivos de calidad oficialmente reconocidos no podrán certificar la conformidad con las prestaciones declaradas en lo que respecta a las características esenciales cubiertas por la norma armonizada […]».
- [CodE] 21.1, pp. 31–32 (acreditación): «declaración del suministrador firmada por persona física con poder de representación suficiente en la que conste que, en la fecha de la misma, el producto está en posesión de un distintivo de calidad oficialmente reconocido, y fotocopia del mismo». Y: «los certificados que avalen que los productos […] están en posesión de un distintivo de calidad oficialmente reconocido vigente […] acompañada de una declaración del suministrador […] en la que conste la fecha de vigencia del distintivo, acompañado de copia del certificado.»

**Efectos (cada uno VERIFICADO (texto), con su página):**

| Producto o proceso | Sin DCOR | Con DCOR | Cita |
|---|---|---|---|
| Hormigón: ensayos previos y característicos | Puede exigirlos la DF (antigüedad ≤ 6 meses) | «No serán necesarios» | 57.4.3 y 57.4.3.1, p. 143 |
| Hormigón: tamaño del lote | Tabla 57.5.4.1 | «multiplicando los valores de la tabla 57.5.4.1 por cinco»; mínimo 3 lotes | 57.5.4.1, p. 146 |
| Hormigón: amasadas por lote | N ≥ 3 (o V/35, V/30, V/20) | N = 1 (cimentación > 200 m³: N ≥ V/105) | tabla 57.5.4.1, p. 145 |
| Hormigón: criterio de aceptación | Casos 2/3 (tabla 57.5.4.3.a) | Identificación: xᵢ ≥ fck | 57.5.4.2, pp. 146–147 |
| Hormigón: control indirecto | No se permite | Se permite con condiciones | 57.5.6, p. 148 |
| Hormigón: penetración de agua y aire ocluido | Al inicio y cada 6 meses | No se exige | 57.5.7, pp. 148–149 |
| Hormigón con **dispersión certificada** | — | Lote × 2; caso 1 de aceptación | 57.5.3 y 57.5.4.1, pp. 145–146 |
| Acero para armar en barra | Lotes de 30 t con ensayos | «control experimental no será preceptivo» | art. 58, p. 154 |
| Mallas y celosías | Lotes de 30 t con ensayos | No preceptivo | 59.1, p. 156 |
| Ferralla | Lotes de 25 t con ensayos | «no serán preceptivos» | 59.2, p. 158; 59.2.4.2, p. 161 |
| Ferralla sin DCOR hecha con acero con DCOR | 4 tracciones, 4 doblados | La DF «podrá reducir el número de ensayos a la mitad» | 59.2.4.3, p. 162 |
| Prefabricados | Comprobaciones de procesos y geometría | La DF puede eximirlas | 62.5.3.1, p. 172 |
| Procesos de ejecución | Inspecciones de la DF | La DF «podrá eximir de la realización de las inspecciones externas» | 22.2, p. 33 |
| Tornillos sin marcado CE | 10 muestras por lote | Basta el distintivo | 98.1, p. 242 |
| Protección del acero | 3 probetas por lote | Basta el distintivo | 99.2 y 99.3, p. 243 |

- Pérdida del beneficio: si un lote incumple, «la dirección facultativa no aplicará la consideración especial de ampliación del tamaño del lote y reducción del número de amasadas […] para los seis lotes siguientes» (57.5.4.1, p. 146).

**SIN CONFIRMAR.** Lista vigente de DCOR reconocidos (p. ej., los distintivos de hormigón preparado y acero reconocidos por el Ministerio). El Código dice que se pueden publicar en las webs de las Comisiones Permanentes (18.1, p. 29); no se ha consultado. **La app no debe dar por hecho que un hormigón tiene distintivo**: es un dato del proyectista.

**Consecuencia para la app.** Interruptores por producto: `hormigon.dcor`, `hormigon.dispersionCertificada`, `acero.dcor`, `mallas.dcor`, `ferralla.dcor`, `prefabricados.dcor`. Cada uno cambia el cálculo según la tabla de arriba.

---

## K-PCC.24 — Control del hormigón: documental, previo al suministro y toma de muestras

**Cita.**
- [CodE] 57.1, p. 140, **VERIFICADO (texto)**: «La conformidad de un hormigón […] se comprobará durante su recepción en la obra, e incluirá su comportamiento en relación con la docilidad, la resistencia y la durabilidad […]». Se aplica «tanto al hormigón preparado, como al fabricado en central de obra».
- [CodE] 57.4.1, pp. 142–143: sin DCOR, declaración responsable del suministrador (modelo del anejo 4) y, en su caso, «el resto de los ensayos previos y característicos, con una antigüedad máxima de seis meses».
- [CodE] 57.4.3.1, p. 143: no hacen falta ensayos previos ni característicos si hay DCOR, o si la misma central tiene documentada experiencia anterior con la misma dosificación, las mismas materias primas y las mismas instalaciones.
- [CodE] 57.5.1, p. 143: «Cada partida de hormigón empleada en la obra deberá ir acompañada de una hoja de suministro, cuyo contenido mínimo se establece en el Anejo 4.»
- [CodE] 57.2, p. 140: «Cada determinación constará del número mínimo suficiente de probetas, de las cuales se ensayarán a 28 días como mínimo dos de ellas y cuya media será la base para la comprobación de resistencia. También se reservarán al menos dos probetas para ensayar si fuera necesario a edades superiores a 28 días. Transcurridos 60 días sin que nadie autorizado haya dispuesto de las probetas, se desecharan definitivamente.» Toma en el punto de vertido, «entre ¼ y ¾ de la descarga».
- [CodE] 57.3.2, p. 142: recorrido relativo de tres probetas de una amasada ≤ 20 %; de dos probetas ≤ 13 %. Probetas cilíndricas de 150×300 (cúbicas de 150 con λ = 0,90 si fc < 60).
- [CodE] 57.6, p. 149: certificado final de suministro (anejo 4); se admiten certificados parciales mensuales.

**INTERPRETACIÓN.** Mínimo de **4 probetas por amasada controlada** (2 a 28 días + 2 de reserva). El precio del laboratorio se suele dar por «serie» o «determinación». La app debe valorar **por amasada controlada** (1 determinación de resistencia + 1 de consistencia).

**SIN CONFIRMAR.** Contenido del anejo 4 (pp. 376–392, imagen): no se ha leído.

---

## K-PCC.25 — Control de la docilidad (consistencia)

**Cita.** [CodE] 57.5.2.1, p. 144, **VERIFICADO (texto)**: los ensayos de consistencia se hacen «a) cuando se fabriquen probetas para controlar la resistencia, b) en todas las amasadas que se coloquen en obra con un control indirecto de la resistencia […], y c) siempre que lo indique la dirección facultativa o lo establezca el pliego […]». En hormigón autocompactante: escurrimiento con la misma frecuencia, y anillo japonés «una determinación cada cuatro ensayos de escurrimiento». El resultado es la media de dos determinaciones UNE-EN 12350-2 sobre la misma muestra (57.3.1, p. 141).

Tabla 57.5.2.2, p. 144 (tolerancia de ±10 mm ya incluida en el intervalo):

| Consistencia | Intervalo resultante (mm) |
|---|---|
| Seca (S) | 0–30 |
| Plástica (P) | 20–50 |
| Blanda (B) | 40–100 |
| Fluida (F) | 90–160 |
| Líquida (L) | 150–220 |

**Consecuencia para la app.** `nConsistencias = nAmasadasControladas` (estadístico o 100 %). En control indirecto: `≥ 4 × jornadas de suministro` (57.5.6.1, p. 148). Si el hormigón es autocompactante: `nAnilloJapones = ceil(nEscurrimientos / 4)`.

---

## K-PCC.26 — Modalidades de control de la resistencia

**Cita.**
- [CodE] 57.5.3, p. 145, **VERIFICADO (texto)**: «La modalidad de control que se adopte en el proyecto podrá ser: – modalidad 1. Control estadístico, según 57.5.4; – modalidad 2. Control al 100 por 100, según 57.5.5; y – modalidad 3. Control indirecto, según 57.5.6.»
- 57.5.4, p. 145: «Esta modalidad de control es la de aplicación general a todas las obras de hormigón estructural.»
- 57.5.5.1, p. 147: el control al 100 % «es de aplicación a cualquier estructura, siempre que se adopte antes del inicio del suministro del hormigón.»
- 57.5.6, p. 148, **VERIFICADO (imagen)**: «esta modalidad de control solo podrá aplicarse para hormigones en masa o armados en posesión de un distintivo de calidad oficialmente reconocido, que se empleen en uno de los siguientes casos: – elementos de edificios de viviendas de una o dos plantas, con luces inferiores a 6,00 metros, – elementos de edificios de viviendas de hasta cuatro plantas, que trabajen a flexión, con luces inferiores a 6,00 metros, – obras de ingeniería de pequeña importancia. Además, será necesario que se cumplan las dos condiciones siguientes: a) que el ambiente en el que está ubicado el elemento sea X0 o XC según lo indicado en el artículo 27, b) que en el proyecto se haya adoptado una resistencia de cálculo a compresión fcd no superior a 15 N/mm².»
- [CodE] anejo 19, ap. 3.1.6, p. 603, **VERIFICADO (imagen)**: «fcd = αcc·fck/γc […] Con carácter general, su valor será αcc = 1,00, si bien para elementos estructurales en los que la carga permanente constituya una parte muy importante de la carga total (superior al 80%), el autor del proyecto podrá adoptar un valor inferior, comprendido entre 0,85 y 1,0.»

**INTERPRETACIÓN.** Con γc = 1,5 (situación persistente) y αcc = 1,00, fcd ≤ 15 obliga a **fck ≤ 22,5 N/mm²**. Un **HA-25 (fcd = 16,7) no admite control indirecto**, salvo que el proyecto adopte αcc ≤ 0,90 y lo justifique. En la práctica, el control indirecto queda para HM-20 o HA con αcc reducido. El valor γc = 1,5 sale del ap. 2.4.2.4 del anejo 19, **no leído** (ver «SIN CONFIRMAR»).

**Consecuencia para la app.** `modalidad ∈ {estadistico (por defecto), cien_por_cien, indirecto}`. La opción `indirecto` solo se habilita si `dcor && ambiente ∈ {X0, XC*} && fcd ≤ 15 && (plantas ≤ 2 || (plantas ≤ 4 && flexion)) && luz < 6 m`, y el aviso lo cuenta.

---

## K-PCC.27 — Tabla 57.5.4.1: lotes y número de amasadas (literal)

**Cita.** [CodE] 57.5.4.1, pp. 145–146, **VERIFICADO (imagen)**. Tabla «Tamaño máximo de los lotes de control de la resistencia y número de amasadas a ensayar por lote (N)»:

| Tipo de elemento | Volumen de hormigón | Tiempo de hormigonado | N.º de elementos o dimensión | N sin DCOR | N con DCOR |
|---|---|---|---|---|---|
| Cimentaciones con elementos de volumen superior a 200 m³ | V. vertido de forma continua | 1 semana | 1 elemento | N ≥ V/35; N ≥ 3 | N ≥ V/105; N ≥ 1 |
| Cimentaciones superficiales con elementos de volumen inferior a 200 m³ | 100 m³ | 1 semana | — | N ≥ 3 | N = 1 |
| Vigas, forjados, losas para pavimentos y otros elementos trabajando a flexión | 100 m³ | 2 semanas | 1000 m² de superficie construida; 2 plantas (**) | N ≥ 3 | N = 1 |
| Losa superior o inferior en marcos | 200 m³; V. vertido de forma continua | 2 días | totalidad del elemento (losa superior o losa inferior) | N ≥ V/30; N ≥ 3 | N = 1 |
| Pilares y muros portantes de edificación | 100 m³ | 2 semanas | 500 m² de superficie construida (*); 2 plantas (**) | N ≥ 3 | N = 1 |
| Pilas y estribos de puente (encofrado convencional) | 50 m³ | 1 día | 1 pila / 1 estribo | N ≥ 3 | N = 1 |
| Pilas de puente construidas por trepado y deslizado | 100 m³ | 2 días | 1 pila | N ≥ V/20; N ≥ 4 | N = 1 |
| Tableros de puente en general y losas in situ de tableros con elementos prefabricados y mixtos | 300 m³ | 1 día | 1 vano; 50 m de longitud | N ≥ V/20; N ≥ 4 | N ≥ V/60; N ≥ 1 |
| Tableros construidos por fases (***) | 600 m³ | — | 1 fase | N ≥ V/30; N ≥ 4 | N ≥ V/90; N ≥ 1 |
| Otros elementos o grupos de elementos que funcionan fundamentalmente a compresión | 100 m³ | 2 semanas | 500 m² de superficie construida; 2 plantas | N ≥ 3 | N = 1 |
| Soleras de túneles | 100 m³ | 1 día | 1 fase | N ≥ 3 | N = 1 |
| Contrabóvedas de túneles | 100 m³ | 1 día | 1 fase | N ≥ 3 | N = 1 |

Notas literales (p. 146):
- «(*) En el caso de que el número de amasadas necesarias para ejecutar los pilares de un lote sea igual o inferior a tres, el límite de 500 m² se podrá elevar a 1000 m².»
- «(**) En el caso de que un lote esté constituido por elementos de dos plantas, se deberán tener resultados de ambas plantas.»
- «(***) […] se entiende por fase aquella parte de la estructura que se hormigona de una sola vez […]».

Reglas del texto (pp. 145–146), **VERIFICADO (texto)**:
- «Todas las amasadas de un lote procederán del mismo suministrador, estarán elaboradas con los mismos materiales componentes y tendrán la misma dosificación nominal. Además, no se mezclarán en un lote hormigones que pertenezcan a filas distintas de la tabla 57.5.4.1.»
- «La conformidad del lote en relación con la resistencia se comprobará a partir de los valores medios de los resultados obtenidos sobre dos probetas tomadas para cada una de las N amasadas controladas».
- «Cuando un lote esté constituido por amasadas de hormigones en posesión de un distintivo de calidad oficialmente reconocido, se aumentará su tamaño multiplicando los valores de la tabla 57.5.4.1 por cinco.» Con dispersión certificada: «multiplicando por dos».
- «En estos casos de tamaño ampliado del lote, el número mínimo de lotes será de tres, correspondiendo, si es posible, cada lote a elementos incluidos en filas distintas de la tabla 57.5.4.1 y en caso de obras de edificación los tres lotes mínimos corresponderían a cimentación, elementos sometidos a compresión y elementos sometidos a flexión.»
- «En ningún caso, un lote podrá estar formado por amasadas suministradas a la obra durante un período de tiempo superior a seis semanas.»
- «En el caso de que un lote esté ejecutado con hormigón de resistencia ≥ fck 50 N/mm², deberá cumplir además, que: N ≥ 6».
- La división en lotes se hace «previamente al inicio de su suministro […] salvo excepción justificada bajo la responsabilidad de la dirección facultativa.»

**INTERPRETACIÓN.**
1. Un lote no supera **ninguno** de los límites de su fila: volumen, tiempo, superficie y plantas. Así que `nLotes ≥ max(ceil(V/Vmax), ceil(S/Smax), ceil(P/Pmax), ceil(T/Tmax))`. Es una cota inferior. El programa de control puede necesitar más lotes al casarlos con el plan de obra.
2. El «× 5» con distintivo se aplica a los **valores** de la tabla: volumen, superficie, plantas y tiempo. El tiempo nunca pasa de 6 semanas. Que el × 5 alcance también a «plantas» y «tiempo» se deduce del literal («los valores de la tabla»), pero no está escrito expresamente.
3. «N ≥ 3» con un lote de menos de 3 amasadas reales: el Código no lo resuelve. Lo razonable es controlar todas las del lote (N = amasadas reales). La app solo puede aplicarlo si el usuario da el volumen medio por amasada (cuba).
4. Los lotes se forman por **tipo de hormigón** (designación y dosificación) **y fila**. Un HA-25 de cimentación y un HA-30 de forjados nunca comparten lote.

---

## K-PCC.28 — Criterios de aceptación y decisiones

**Cita.** [CodE] 57.5.4.2–57.5.4.3, pp. 146–147, **VERIFICADO (imagen)**:
- Identificación (solo con DCOR): «Se procederá a la aceptación del lote cuando se cumpla el siguiente criterio: xᵢ ≥ fck».
- Tabla 57.5.4.3.a:
  - Caso 1, dispersión certificada: f(x̄) = x̄·(1 − 1,66·δ*) ≥ fck.
  - Caso 2, sin DCOR, misma central, más de 36 amasadas controladas: f(x̄) = x̄ − 1,66·s*₃₅ ≥ fck, con s*₃₅ = √[(1/34)·Σᵢ₌₁³⁵ (xᵢ − x̄₃₅)²].
  - Caso 3, «hasta la 36.ª amasada»: f(x₁) = x₁·Kₙ ≥ fck, con x₁ el mínimo de las últimas N amasadas del lote.
- Tabla 57.5.4.3.b: Kₙ = 0,89 (N = 3); 0,91 (4); 0,93 (5); 0,94 (6); 0,95 (7); 0,96 (8); 0,97 (9); 0,98 (10); 1 (> 10).
- 57.5.5.2, p. 148 (control al 100 %): si N ≤ 20, fc,real es la amasada más baja; si N > 20, la que ocupa el lugar n = 0,05·N (redondeando por exceso). Se acepta si **fc,real ≥ fck** y **f₁ ≥ 0,9·fck**.
- 57.7.3.1, p. 150, **CORREGIDO por [CE-24]**: «que no cumpla el criterio de aceptación definido en el apartado 57.5.4.2 para el control de identificación» (el consolidado dice «tabla 57.5.4.3.a»). Se acepta el lote si los valores son > 0,90·fck y la producción cumple x̄ − 1,645·σ ≥ 0,90·fck.
- 57.7.3.2, pp. 150–151: escalonado ante un lote no conforme: a) romper las 2 probetas de reserva (sin DCOR); b) ensayos de información (57.8); c) estudio de seguridad; d) prueba de carga.

**Consecuencia para la app.** Al plan basta con la frase del criterio de aceptación que corresponda: identificación, caso 3, o 100 %. La app no evalúa resultados.

---

## K-PCC.29 — Ejemplos numéricos resueltos

Algoritmo de K-PCC.27 y de «Para la app» (a). Todos son HA-25 (fck < 50), salvo que se diga otra cosa.

| # | Caso | Cálculo según el Código | Lotes | Amasadas (tomas) | Hoja de la Junta |
|---|---|---|---|---|---|
| E1 | Forjado de 1 planta, 450 m², 60 m³, sin DCOR, hormigonado en ≤ 2 semanas | max(⌈60/100⌉, ⌈450/1000⌉, ⌈1/2⌉) = max(1, 1, 1) | **1** | **3** (≥ 12 probetas, 3 consistencias) | 1 lote, 3: coincide |
| E2 | Forjados de 3 plantas × 450 m² × 60 m³ (1350 m², 180 m³) | max(⌈180/100⌉ = 2, ⌈1350/1000⌉ = 2, ⌈3/2⌉ = 2) | **2** | **6** | 2 / 6: coincide |
| E3 | Forjados de 3 plantas × 300 m² × 30 m³ (900 m², 90 m³) | max(1, 1, ⌈3/2⌉ = 2) | **2** | **6** | **1 / 3: CORREGIDO** (no aplica «2 plantas») |
| E4 | Pilares de 3 plantas, 12 m³, superficie construida 450 m² | max(⌈12/100⌉ = 1, ⌈450/500⌉ = 1, ⌈3/2⌉ = 2) | **2** | **6** (con tope de amasadas reales, ver E5) | **1 / 3: CORREGIDO** |
| E5 | E4 con cubas de 6 m³ (INTERPRETACIÓN) | lote de 2 plantas ≈ 8 m³ → ⌈8/6⌉ = 2 amasadas reales < 3 → se controlan todas; la nota (*) eleva el límite a 1000 m² | 2 | **4** (2 + 2) | — |
| E6 | Zapatas, 40 m³ en total (cada una < 200 m³), hormigonadas en ≤ 1 semana | ⌈40/100⌉ = 1; tiempo 1 semana | **1** | **3** | 1 / 3: coincide |
| E7 | E6 hormigonadas a lo largo de 2 semanas | ⌈2/1⌉ = 2 | **2** | **6** | 1 / 3: CORREGIDO (no aplica el tiempo) |
| E8 | Losa de cimentación de 260 m³ (un elemento > 200 m³) en vertido continuo | 1 elemento → 1 lote; N = max(3, ⌈260/35⌉ = 8) | 1 | **8** (con DCOR: max(1, ⌈260/105⌉) = **3**) | 1 / 8: coincide |
| E9 | Edificio E2 + E4 + E6, **todo con DCOR** | Límites × 5 (500 m³, 5000 m², 10 plantas; tiempo ≤ 6 semanas): 1 lote por fila → 3 lotes = mínimo 3 | **3** | **3** (N = 1) | la hoja no calcula los DCOR |
| E10 | fck = 50, forjado de E1 | max(3, 6) | 1 | **6** | 6: coincide |
| E11 | ¿Control indirecto con HA-25? | fcd = 1,00·25/1,5 = 16,7 > 15 | — | **No admisible** | — |

**INTERPRETACIÓN.** Los tiempos (semanas) salen del plan de obra. Si el usuario no los da, la app supone que cada grupo se hormigona dentro de su límite de tiempo, y lo avisa.

---

## K-PCC.30 — Control de la durabilidad

**Cita.**
- [CodE] 57.5.7, pp. 148–149, **VERIFICADO (texto)**: «En los hormigones que no posean un distintivo de calidad oficialmente reconocido […], se realizará el ensayo de penetración de agua en el hormigón […], al inicio y posteriormente una vez cada seis meses a lo largo del suministro para cada tipo de dosificación, para los hormigones de ambientes XA, XS, XD, XF o XM.» Aire ocluido: con el mismo calendario, «cuando un hormigón esté sometido a una clase de exposición XF2 y XF4». [CE-24] corrige en 43.3.3 «XF2 y XF4» por «XF2 o XF4». En 57.5.7 el texto no se corrigió, pero el sentido es «o».
- 57.3.3, p. 142: 3 probetas de la misma muestra.
- Tabla 57.5.7, p. 149, **VERIFICADO (imagen)**:

| Clase de exposición | Profundidad máxima | Profundidad media |
|---|---|---|
| XS3, XA3; XA2 (solo pretensado) | Zm ≤ 30 mm; Z₃ ≤ 40 mm | Tm ≤ 20 mm; T₃ ≤ 27 mm |
| XS1, XS2, XD1, XD2, XD3, XA1, XM1, XM2, XM3, XF1, XF2, XF3, XF4; XA2 (masa o armado) | Zm ≤ 50 mm; Z₃ ≤ 65 mm | Tm ≤ 30 mm; T₃ ≤ 40 mm |
| X0, XC1, XC2, XC3, XC4 | No requiere esta comprobación | No requiere esta comprobación |

**INTERPRETACIÓN.** `nPenetracion = nDosificaciones × (1 + floor((mesesSuministro − ε)/6))`. Ejemplos: XS1 sin DCOR, 1 dosificación, 4 meses → **1 ensayo (3 probetas)**; 8 meses → **2**. Con DCOR → 0. La hoja de la Junta pide «nº de semestres» y le suma el ensayo inicial: si el usuario cuenta el primer semestre, sale uno de más.

---

## K-PCC.31 — Acero para armaduras pasivas en barra o rollo (art. 58)

**Cita.** [CodE] art. 58, pp. 153–155, **VERIFICADO (texto)**:
- «En los productos que no posean un distintivo de calidad oficialmente reconocido […] se procederá a la división en lotes de la cantidad de acero suministrado. El tamaño máximo del lote será de 30 toneladas, procedentes del mismo fabricante de acero, marca comercial, tipo de acero, forma de suministro y serie de diámetros.»
- Series: «Serie fina: diámetros hasta 10 mm. – Serie media: diámetros desde 12 mm hasta 20 mm. – Serie gruesa: diámetros 25 mm y 32 mm. – Serie muy gruesa: diámetros desde 40 mm.»
- «De cada lote se tomará una muestra representativa formada por dos barras diferentes y sobre cada una de ellas se realizarán los siguientes ensayos de acuerdo con la norma UNE-EN ISO 15630-1: – Ensayo de tracción, con envejecimiento artificial […] Rm, Rp0,2, Rm/Rp0,2, Rp0.2real/Rp0.2nominal, A, Agt […] – Ensayo de doblado-desdoblado o, alternativamente, el ensayo de doblado simple […] – Determinación de la masa por metro (m/m) […] – Determinación de las características geométricas para las corrugas […]».
- Contraensayo: si falla un solo ensayo, «serie adicional de cinco probetas»; si vuelve a fallar, se rechaza el lote.
- Suministros > 300 t: composición química en uno de cada cuatro lotes (mínimo 5 ensayos).
- **CORREGIDO por [CE-24]** (p. 154 del consolidado): «Se verificará además el comportamiento frente a fatiga y cargas cíclicas» (se suprime «En el caso de aceros de característica SD»). En **zona sísmica**, informe de ensayos de cargas cíclicas con antigüedad ≤ 1 año, para todo acero.
- «El control del acero para armaduras pasivas será efectuado por el responsable de la recepción del mismo en la instalación industrial (armadura normalizada o ferralla), de prefabricación o en la obra para el caso de que las armaduras se elaboren en la propia obra.» (p. 154)

**INTERPRETACIÓN.**
- Con ferralla de taller, el control del art. 58 lo hace el taller al recibir el acero. Lo que la DF ensaya **en obra** es la ferralla (art. 59.2, K-PCC.32). El art. 58 en obra solo procede cuando las armaduras se elaboran **en la obra**.
- Ejemplo: 9 t de barras B500S sin DCOR elaboradas en obra, con Ø8–Ø10 (fina) y Ø12–Ø16 (media) → **2 lotes** (por serie, aunque sean menos de 30 t). Cada lote: 2 tracciones, 2 doblados, 2 masas por metro y 2 geometrías → **4 de cada** en total.

---

## K-PCC.32 — Armaduras normalizadas (mallas) y ferralla elaborada o armada (art. 59)

**Cita.** [CodE] 59.1.4.2, pp. 157–158, **VERIFICADO (texto)** (mallas y celosías sin DCOR): lote máximo de **30 t** «procedentes del mismo fabricante de armaduras, marca comercial, tipo de acero y serie de diámetros». Muestra: **dos mallas o paneles**, con: tracción, doblado-desdoblado o doblado simple, masa por metro, geometría de corrugas, «cortante en cizalladura o despegue de nudo», dimensiones y número de elementos.

[CodE] 59.2, pp. 158–163 (ferralla), **VERIFICADO (texto)**:
- «Las comprobaciones y ensayos establecidos en este apartado no serán preceptivos en el caso de que la ferralla esté en posesión de un distintivo de calidad oficialmente reconocido.» (p. 158)
- Lote (59.2.4.2, p. 161): «– el tamaño del lote no será superior a 25 toneladas, – en el caso de ferralla fabricada en una instalación industrial fija ajena a la obra, deberá haber sido suministrada en remesas consecutivas desde la misma instalación, – en el caso de ferralla fabricada en instalaciones de la obra, la producida en períodos de un mes, – corresponder a la misma designación de armadura pasiva».
- Tabla 59.2.4.3 (pp. 161–162):

| Proceso | Sin enderezado | Con enderezado |
|---|---|---|
| Sin soldadura (elaborada, o armada con atado de alambre) | «La dirección facultativa podrá eximir los ensayos.» | Tracción; geometría superficial |
| Con soldadura no resistente | Tracción; doblado simple o doblado-desdoblado | Tracción; doblado; geometría superficial |

- Número (p. 162): «Cuatro ensayos de tracción sobre probetas preferentemente de diámetros de las series fina y media […]»; «Cuatro ensayos de doblado simple o doblado-desdoblado sobre probetas de los diámetros mayores utilizados en la ferralla armada con soldadura no resistente»; si el acero tiene DCOR, la DF «podrá reducir el número de ensayos a la mitad»; «Dos ensayos de geometría superficial por diámetro de las series fina y media».
- Dimensiones (59.2.4.4, p. 162): «De cada lote se verificarán como mínimo quince unidades de ferralla».
- Soldadura resistente en obra: solo con control de ejecución **intenso** (59.2.4.5, p. 163).

**Ejemplo.** Vivienda con 9 t de ferralla de taller sin DCOR, Ø8, Ø10, Ø12 y Ø16, con enderezado (rollo) y sin soldadura → **1 lote**: **4 tracciones + 8 geometrías (2 × 4 diámetros) + 15 unidades medidas**. Si el acero tiene DCOR y la ferralla no: 2 tracciones + 8 geometrías + 15 unidades. Sin enderezado ni soldadura, la DF puede eximir las tracciones y geometrías; las 15 unidades dimensionales se mantienen (INTERPRETACIÓN: la exención de la tabla 59.2.4.3 cubre las características mecánicas y de adherencia, no las dimensiones del 59.2.4.4).

**CORREGIDO (hoja de la Junta).** La hoja no tiene ninguna partida de ferralla elaborada. Aplica a toda la armadura «2 ensayos / 30 t» del art. 58, y a mallas «2 / 30 t» sin doblado ni dimensiones.

---

## K-PCC.33 — Acero estructural (perfiles, chapas, tornillos, soldaduras)

**Cita.**
- Ámbito ([CodE] art. 79, p. 190): excluye los «perfiles y chapas de paredes delgadas conformadas en frío».
- Productos (97.1 y 97.3, p. 241): con marcado CE, se comprueban la declaración de prestaciones y el marcado. «Cualquier ensayo sobre los productos de acero que decida el autor del proyecto o la dirección facultativa, se deberá efectuar de acuerdo con las indicaciones de éstos.» **No hay lotes ni ensayos obligatorios.**
- Tornillos sin CE ni DCOR (98.1, p. 242): «un lote de tornillos, tuercas, arandelas, por cada uno de los grados y clases de tornillo […] sobre al menos diez muestras».
- Protección (99.2, p. 243): sin DCOR, un lote por sistema y tipo de acero, ≥ 3 probetas; en galvanizado, el certificado del galvanizador permite eximir los ensayos. [CE-24] corrige probeta 150×**75** y espesor **≥ 3 mm**.
- Componentes (art. 100, p. 244): marcado CE según UNE-EN 1090-1.
- Clase de ejecución (91.2.3, p. 215, tabla 91.1): CC2 + SC1 + PC1 → clase 2; CC2 + SC1 + PC2 → clase 2. Y 14.3, p. 23: en acero, la clase de ejecución «deberá ser 2, 3 o 4»; nivel normal ↔ clase 2; nivel intenso ↔ clase 3 o 4 (tabla 14.3.1).
- Lotes de ejecución (tabla 101.1, p. 245): edificación, pilares y elementos verticales: «500 m² de superficie, sin rebasar las dos plantas»; vigas y forjados: «250 m² de superficie construida sin rebasar una planta».
- Soldaduras (103.2.2.6, p. 252): «Una inspección visual conforme a la norma UNE-EN ISO 17637, preceptiva para toda la longitud del 100 % de los cordones, – unas comprobaciones adicionales mediante la realización de ensayos no destructivos, cuya frecuencia en función de la clase de ejecución, será la definida en el plan de control incluido en el pliego de prescripciones técnicas particulares del proyecto. El Anejo 17 incluye, de forma orientativa, las frecuencias […]». Pernos conectadores: ensayo de doblado ≥ 3 % (clase 2) o 5 % (clases 3–4) (p. 253).
- Anejo 17, tabla A17.2.2.b, p. 512, **VERIFICADO (imagen)**: porcentaje de END para clase de ejecución 2:

| Tipo de cordón | Taller de la obra (sin CE) | En obra |
|---|---|---|
| A tope a tracción, k ≥ 0,8 | 50 % | 100 % |
| A tope a tracción, 0,3 < k < 0,8 | 20 % | 50 % |
| A tope a tracción, k ≤ 0,3 | 5 % | 10 % |
| A tope a compresión | 5 % | 10 % |
| De ángulo | 10 % | 10 % |
| Longitudinales | 5 % | 10 % |
| Uniones de atado | 5 % | 5 % |

- Anejo 17, tabla A17.2.1, pp. 509–510 (orientativa), control normal, control externo de la DF: gestión de acopios 3; planos de taller 3; ensamblado en taller 10 %; recepción en obra 10 %; replanteos 3; tratamientos 10 %.

**INTERPRETACIÓN.** En vivienda corriente (pórtico o pilares metálicos con marcado CE del taller según UNE-EN 1090-1, clase de ejecución 2), el plan valora: inspección visual del 100 % de los cordones de obra; END sobre los porcentajes de la tabla A17.2.2.b, según el tipo de cordón; y control del apriete de las uniones atornilladas (103.2.2.8, con remisión a UNE-EN 1090-2). Los ensayos químicos y de tracción de perfiles que pone la hoja de la Junta (> 100 t) son **opcionales**: no los exige el Código.

**Consecuencia para la app.** Partidas de acero estructural: el proyectista da las toneladas, la clase de ejecución (por defecto 2), si hay soldadura en obra y el reparto de cordones. La app valora **jornadas de inspección**: el Código no da un rendimiento; usar el precio por media jornada del laboratorio.

---

## K-PCC.34 — Otros productos: cemento, áridos, aditivos, agua, prefabricados y forjados

**Cita.** [CodE] 56.4, pp. 139–140, **VERIFICADO (texto)**:
- Cemento (56.4.1): «La comprobación de la conformidad del cemento se efectuará de acuerdo con la Instrucción para la recepción de cementos vigente.» Hoy es la RC-16 ([RC-16], vigente; deroga la RC-08).
- Áridos (56.4.2): «deberán disponer del marcado CE». Si son de autoconsumo, certificado de ensayo de menos de tres meses.
- Aditivos (56.4.3) y adiciones (56.4.4): marcado CE y comprobación documental.
- Agua (56.4.5): «Se podrá eximir de la realización de los ensayos cuando se utilice agua potable de red de suministro»; en otro caso, ensayos semestrales.
- El control de componentes lo hace el responsable de recepción **en la central** (56.4, p. 139): no es tarea de la obra con hormigón preparado.
- Piezas de entrevigado ([CodE] art. 38, p. 79): con viguetas prefabricadas, «deberán tener marcado CE (conforme a la serie de normas UNE-EN 15037)»; resistencia a carga puntual > 1,5 kN (o > 1,0 kN con entablado continuo); en cerámica, expansión por humedad < 0,6 mm/m.
- Prefabricados (art. 62, pp. 167–173): con marcado CE, comprobación documental y las comprobaciones que decida el responsable de recepción. Sin CE ni DCOR, geometría según la tabla 62.5.3.4 (p. 173): «Elementos tipo pilotes, viguetas, bloques... 10 / Elementos tipo losas, paneles, pilares, jácenas... 3 / Elementos de grandes dimensiones tipo artesas, cajones... 1» por lote (remesa).

**INTERPRETACIÓN.** En vivienda con hormigón preparado, la obra controla de los componentes solo la documentación del hormigón (hoja de suministro, declaración). Viguetas (UNE-EN 15037-1) y placas alveolares (UNE-EN 1168) tienen marcado CE obligatorio: el control es documental, y los ensayos de bovedillas de la hoja de la Junta (niveles 2–3) son voluntarios.

---

## K-PCC.35 — Control de la ejecución: niveles, lotes, inspecciones

**Cita.**
- [CodE] 14.3, p. 23, **VERIFICADO (texto)**: «El pliego de prescripciones técnicas particulares del proyecto incluirá la identificación del nivel de control de ejecución en el caso de estructuras de hormigón, y de las clases de ejecución que serán aplicables a cada elemento en el caso de estructuras de acero». El nivel mínimo es IL2, «en los elementos de hormigón, un control de ejecución intenso o normal».
- 22.4, p. 34: «a) Control de ejecución a nivel normal […] b) Control de ejecución a nivel intenso […] Cuando se realice un control de ejecución a nivel intenso el constructor deberá estar en posesión de un sistema de la calidad certificado conforme a la UNE-EN ISO 9001 […]».
- Tabla 14, p. 22, **VERIFICADO (imagen)**: trazabilidad A ↔ nivel intenso ↔ clase 3 o 4; trazabilidad B ↔ nivel normal ↔ clase 2.
- Art. 63, p. 173, **CORREGIDO por [CE-24]**: «El control de la ejecución estará ligado al nivel de control de la ejecución y a la clase de ejecución (acorde con lo definido en el apartado 14.3).» El consolidado remite a unos «22.4.1» y «22.4.2» que no existen.
- Tabla 63.1, p. 174, **VERIFICADO (imagen)** (filas de edificación):

| Tipo de elemento | N.º de elementos o dimensión (lote de ejecución) |
|---|---|
| Cimentaciones en edificación, depósitos, chimeneas o torres | Elementos de cimentación correspondientes a 250 m² de superficie, sin rebasar 10 elementos |
| Vigas, forjados y otros elementos trabajando a flexión en edificación, depósitos, chimeneas o torres | 250 m² de superficie construida; 2 plantas; 50 m de muro de contención |
| Pilares y muros portantes de edificación | 250 m² de superficie construida; 2 plantas; 50 m de muro |

  Para elementos que no estén en la tabla, el PPTP fija el criterio (p. 174).
- Anejo 15 (pp. 491–495), **VERIFICADO (imagen)**, «de forma orientativa». Tabla A15.2.1, unidades de inspección por lote, en el orden control / contraste de la DF:

| Proceso | Nivel normal | Nivel intenso |
|---|---|---|
| Gestión de acopios | 100 % / 3 | 100 % / 20 % (mín. 3) |
| Replanteos | 2 / 1 | 100 % / 20 % |
| Cimbras | 1 / 1 | 100 % / 50 % |
| Despiece | 1 / 1 | 1 / 1 |
| Elaboración de armaduras | 2 / 1 | 5 / 1 |
| Descimbrado | 1 / 1 | 3 / 2 |
| Uniones de prefabricados | 3 / 1 | 5 / 1 |

  **Opción simplificada** (tabla A15.2.2.c, pp. 494–495): para «obras de edificación sin especial complejidad estructural (formadas por vigas, pilares y forjados convencionales no pretensados, con luces de hasta 6,00 metros y un número de niveles de forjado no superior a diez), en las que se realice un nivel de control normal». Entre otras: encofrado, armado, vertido, curado y acabado, el 50 % de los elementos en control y el 10 % en contraste (en forjados, un elemento cada 50 m²; en muros, cada 5 m); armaduras de pilares y muros, mínimo 15 elementos en control y 3 en contraste. [CE-24] sustituye la fila «Vigas, forjados…» de la tabla A15.2.2.a (nivel intenso).
- 22.2, p. 33: con DCOR del proceso, la DF puede eximir las inspecciones externas.

**Ejemplo (INTERPRETACIÓN).** Vivienda de 3 plantas × 150 m² (450 m²) con 12 zapatas. Cimentación: ⌈12/10⌉ = 2 lotes (150 m² ≤ 250). Forjados: max(⌈450/250⌉, ⌈3/2⌉) = 2. Pilares: max(⌈450/250⌉, ⌈3/2⌉) = 2. **6 lotes de ejecución.** Con la opción A, las inspecciones las hace la DF. Con la opción B, la DF hace las de contraste de A15.2.1 / A15.2.2.c.

**Consecuencia para la app.** Dato del proyectista: `nivelControlEjecucion ∈ {normal, intenso}`, que va al PPTP. La app calcula los lotes de ejecución y, si el usuario da un precio por visita, valora las visitas: el Código no fija cuántas visitas cubren un lote, así que es un dato.

---

## K-PCC.36 — Pruebas de carga y ensayos de información complementaria

**Cita.**
- [CodE] 72.1, p. 182, **VERIFICADO (texto)**: las estructuras cuyos materiales y ejecución hayan alcanzado la calidad prevista «solo necesitan someterse a ensayos de información y en particular a pruebas de carga, las incluidas en los supuestos que se relacionan a continuación: a) cuando así lo dispongan las instrucciones, reglamentos específicos de un tipo de estructura o el pliego de prescripciones técnicas particulares; b) cuando debido al carácter particular de la estructura convenga comprobar que la misma reúne ciertas condiciones específicas […]; c) cuando a juicio de la dirección facultativa existan dudas razonables sobre la seguridad, funcionalidad o durabilidad de la estructura.»
- 57.8, p. 151: «Estos ensayos solo son preceptivos en los casos previstos por este Código en el apartado 57.7, cuando lo contemple el pliego de prescripciones técnicas particulares o cuando así lo exija la dirección facultativa.» Medios: testigos UNE-EN 12504-1 y «métodos no destructivos fiables, como complemento de los anteriormente descritos y debidamente correlacionados con los mismos».
- 23.2, pp. 34–36: tipos de prueba de carga. Para evaluar la capacidad resistente, la carga es 0,85·(1,35·G + 1,5·γsc·Q), en la redacción **corregida por [CE-24]**.

**Consecuencia para la app.** Testigos, esclerómetro, ultrasonidos y pruebas de carga **no se valoran por defecto** en edificación. Si se incluyen, van como partida alzada opcional («a criterio de la DF»).

---

## K-PCC.37 — Ámbito: cimentaciones profundas y encepados

**Cita.** [CodE] art. 26, p. 42, **VERIFICADO (texto)**: el título 2 se aplica a todo el hormigón estructural «con las excepciones siguientes: […] – las cimentaciones profundas; […]». La tabla 55.1 (p. 136) cuenta los **encepados** entre los elementos del control de proyecto.

**CORREGIDO (hoja de la Junta).** «Encepados (control de ejecucíon s/EHE-08). Nota: actualmente el CodE deja fuera los encepados de forma explicita» (AUX, fila 289). El art. 26 excluye las «cimentaciones profundas», no nombra los encepados, y la tabla 55.1 los incluye. **INTERPRETACIÓN:** el encepado es hormigón estructural de cimentación y se lotifica por la tabla 57.5.4.1 (fila de cimentaciones). Los pilotes in situ se controlan por su norma de ejecución (UNE-EN 1536) y el DB SE-C (fuera de este encargo).

---

## K-PCC.38 — Hoja «AUX CALC AMASADAS» de la Junta: el algoritmo, en forma programable

**Cita.** [JUNTA], hoja `03_C_y_E_AUX_CALC AMASADAS`, fórmulas cotejadas en `PlanCC_formulas.txt`, **VERIFICADO (texto)** (lo que hace la hoja):

```
# Una fila por "elemento" que introduce el usuario: B = "fck < 50" | "fck ≥ 50"; C = "C" | "AC"; D = V (m3); K = dato de dimensión
k = 6 si fck ≥ 50 si no 3          # (4 en filas de puentes)

Cimentación > 200 m3 (filas 26-30): E = nº de lotes (dato, 1); K = nº de elementos
   F = ceil(V/35); H = (fck≥50 ? 6E : (V/35 > 105 ? V/35 : 3E)); I = max(F, H)
   M = K; P = k·M; lotes = (I > P ? E : M); amasadas = max(I, P)
Cimentación superficial < 200 m3 (44-48):  lotes = ceil(V/100); amasadas = k·lotes
Flexión (62-66):  E = ceil(V/100); M = ceil(S/1000); lotes = (kE > kM ? E : M); amasadas = max(kE, kM)
Muros portantes (98-102) y pilares (116-121): E = ceil(V/100); M = ceil(S/500); igual que flexión
Otros a compresión (207-211): igual que pilares
Totales: suma de amasadas separada en convencional (C) y autocompactante (AC)
Durabilidad (330-331): penetración = tipos × (1 inicio + nº semestres); aire (solo XF2/XF4) = ídem
Excluye: hormigón con DCOR, con dispersión certificada, y "periodos de tiempo límite"
```

**Lo que hace bien.** Volumen y superficie de la tabla 57.5.4.1. N ≥ 3 (6 si fck ≥ 50). V/35 en cimentaciones > 200 m³. Separa convencional y autocompactante.

---

## K-PCC.39 — Hoja de la Junta frente al Código: diferencias

| # | La hoja | El Código | Veredicto |
|---|---|---|---|
| 1 | Flexión: lotes = max(V/100, S/1000). Pilares y muros: max(V/100, S/500) | Además, **2 plantas** por lote (tabla 57.5.4.1, p. 145) | **CORREGIDO**: con 3 plantas pequeñas da 1 lote en vez de 2 (E3, E4) |
| 2 | No aplica tiempos («periodos de tiempo límite» excluidos) | 1 semana (cimentaciones), 2 semanas (flexión, pilares), y nunca más de 6 semanas (p. 146) | **CORREGIDO**: la app debe pedir la duración, o suponer «dentro de plazo» y avisar (E7) |
| 3 | Pilares: siempre 500 m² | Nota (*): hasta 1000 m² si el lote tiene ≤ 3 amasadas | Conservador; la app puede aplicar la nota si conoce el volumen de cuba |
| 4 | Cimentación > 200 m³: compara «V/35 > 105» | No existe ese umbral: es la columna DCOR (V/105) traspuesta | **CORREGIDO** (error de fórmula; casi nunca cambia el resultado) |
| 5 | Tableros por fases: filas 190-193 usan V/35 y la 189 V/30 | V/30 (p. 146) | **CORREGIDO** (civil; no afecta a vivienda) |
| 6 | Excluye el hormigón con DCOR (no lo calcula) | Lote × 5, N = 1, mínimo 3 lotes (p. 146) | Laguna: la app debe calcularlo (E9) |
| 7 | Encepados y pilotes «s/EHE-08» | EHE-08 derogada; encepados dentro del Código (art. 26) | **CORREGIDO** (cita derogada) |
| 8 | Armaduras: «2 ensayos / 30 t» siempre (art. 58) | Ferralla de taller: art. 59.2 (25 t; 4 + 2/Ø + 15); acero en obra: lote por serie de diámetros | **CORREGIDO** (K-PCC.31, K-PCC.32) |
| 9 | Mallas: geometría + despegue + tracción | También doblado, masa por metro, dimensiones y nº de elementos (59.1.4.2) | **CORREGIDO** (incompleto) |
| 10 | Acero de pretensar: «artículo 37 mientras no esté vigente el marcado CE» | Las especificaciones están en el **art. 36** (art. 60, p. 164) | **CORREGIDO** (cita errónea) |
| 11 | Perfiles: química y tracción cada 20 t si > 100 t | El Código no las exige (97.3) | Voluntario (nivel 2 de la hoja): no presentarlo como obligatorio |
| 12 | Soldaduras: 10 % (EXC2) según UNE-EN 1090-2; ½ jornada cada 40–60 t | Visual 100 % + END según el plan; tabla A17.2.2.b orientativa por tipo de cordón | INTERPRETACIÓN: compatible, distinta fuente |
| 13 | «Mínimo 5 ensayos por desplazamiento» | No está en el Código | Práctica comercial del laboratorio, no norma |
| 14 | Durabilidad: «nº de semestres» + inicio | «al inicio y posteriormente una vez cada seis meses» | INTERPRETACIÓN: puede contar uno de más (K-PCC.30) |

---

## Para la app

### (a) Tablas y algoritmos codificables

**A1. Tabla 57.5.4.1 (edificación)** — [CodE] pp. 145–146, VERIFICADO (imagen):

```json
{
  "fuente": "Código Estructural (RD 470/2021), tabla 57.5.4.1, pp. 145-146 del consolidado BOE",
  "filas": {
    "cim_mayor_200": { "titulo": "Cimentaciones con elementos de volumen superior a 200 m³",
      "loteEsElemento": true, "semanas": 1,
      "N_sin": {"porVolumen": 35, "min": 3}, "N_dcor": {"porVolumen": 105, "min": 1} },
    "cim_superficial": { "titulo": "Cimentaciones superficiales con elementos de volumen inferior a 200 m³",
      "vol": 100, "semanas": 1,
      "N_sin": {"min": 3}, "N_dcor": {"fijo": 1} },
    "flexion": { "titulo": "Vigas, forjados, losas para pavimentos y otros elementos trabajando a flexión",
      "vol": 100, "semanas": 2, "sup": 1000, "plantas": 2,
      "N_sin": {"min": 3}, "N_dcor": {"fijo": 1} },
    "pilares_muros": { "titulo": "Pilares y muros portantes de edificación",
      "vol": 100, "semanas": 2, "sup": 500, "supSiPocasAmasadas": {"maxAmasadas": 3, "sup": 1000}, "plantas": 2,
      "N_sin": {"min": 3}, "N_dcor": {"fijo": 1} },
    "otros_compresion": { "titulo": "Otros elementos o grupos de elementos que funcionan fundamentalmente a compresión",
      "vol": 100, "semanas": 2, "sup": 500, "plantas": 2,
      "N_sin": {"min": 3}, "N_dcor": {"fijo": 1} }
  },
  "multiplicadorLote": {"dcor": 5, "dispersionCertificada": 2},
  "minimoLotesSiAmpliado": 3,
  "semanasMaxAbsoluto": 6,
  "N_minSiFckMayorIgual50": 6,
  "kn": {"3":0.89,"4":0.91,"5":0.93,"6":0.94,"7":0.95,"8":0.96,"9":0.97,"10":0.98,"mas10":1.0}
}
```

**A2. Algoritmo de lotes y amasadas** (INTERPRETACIÓN de K-PCC.27):

```
entrada por grupo g: fila, tipoHormigon (designación+dosificación), fck, V (m3), S (m² construidos), P (plantas),
                     T (semanas de hormigonado, opcional), nElementos (solo cim_mayor_200, con V por elemento),
                     dcor, dispersionCertificada, vCuba (opcional), modalidad
# Los grupos son por (fila, tipoHormigon): nunca se mezclan en un lote.
si modalidad == indirecto:  lotes = 0; amasadas = 0; consistencias = 4 × jornadas      (57.5.6.1)
si modalidad == cien:       amasadas = ceil(V / vCuba)  (sin vCuba: no calculable → pedir dato)
si modalidad == estadistico:
  k = dcor ? 5 : (dispersionCertificada ? 2 : 1)
  si fila == cim_mayor_200:
      por cada elemento e:  lotes += 1;  N_e = dcor ? max(1, ceil(Ve/105)) : max(3, ceil(Ve/35))
  si no:
      sup = fila.sup
      si fila == pilares_muros y vCuba y ceil((V/estimLotes)/vCuba) ≤ 3: sup = 1000      # nota (*)
      lotes = max(1, ceil(V/(fila.vol·k)), S? ceil(S/(sup·k)) : 1, P? ceil(P/(fila.plantas·k)) : 1,
                  T? ceil(T / min(fila.semanas·k, 6)) : 1)
      N = dcor ? 1 : 3
  si fck ≥ 50: N = max(N, 6)
  si vCuba: N_lote = min(N, ceil((V/lotes)/vCuba))                                          # INTERPRETACIÓN
  amasadas = Σ N_lote
global: si algún grupo con k > 1 y Σ lotes(ampliados) < 3 → subir a 3 lotes repartidos (cimentación, compresión, flexión)
ensayos: tomasResistencia = amasadas; consistencias = amasadas; probetas ≥ 4·amasadas (2 rotura 28 d + 2 reserva)
```

**A3. Durabilidad** (57.5.7, VERIFICADO (texto)):

```
si !dcor y clase ∈ {XA*, XS*, XD*, XF*, XM*}: penetracion = nDosificaciones × (1 + floor((meses − ε)/6))  [3 probetas c/u]
si !dcor y clase ∈ {XF2, XF4}:                 aireOcluido = ídem
```

**A4. Acero y armaduras** (arts. 58 y 59, VERIFICADO (texto)):

```
serie(Ø) = Ø ≤ 10 ? fina : Ø ≤ 20 ? media : Ø ≤ 32 ? gruesa : muy_gruesa
barras elaboradas en obra, sin DCOR:   lotes = Σ_{grupo fabricante·tipo·forma·serie} ceil(t/30)
                                       por lote: 2 tracción, 2 doblado, 2 masa/m, 2 geometría
                                       si t_total > 300: química en 1 de cada 4 lotes (mín. 5 ensayos)
mallas sin DCOR:                       lotes = Σ ceil(t/30); por lote 2 mallas: tracción, doblado, masa/m, geometría,
                                       despegue de nudo, dimensiones, nº de elementos
ferralla sin DCOR:                     lotes = ceil(t/25) (de obra: además ≥ 1 por mes)
                                       mecánicos: según tabla 59.2.4.3 (enderezado / soldadura no resistente)
                                         tracción 4 (2 si acero con DCOR), doblado 4 (2) si soldadura,
                                         geometría 2 × nº de diámetros de las series fina y media si enderezado
                                       dimensiones: 15 unidades por lote (siempre)
ferralla con DCOR:                     0 ensayos (solo documentación)
```

**A5. Lotes de ejecución** (tabla 63.1, VERIFICADO (imagen)):

```
cimentacion: max(ceil(S_cim/250), ceil(nElementos/10))
flexion:     max(ceil(S/250), ceil(P/2))          (muros de contención: ceil(L/50))
pilares:     max(ceil(S/250), ceil(P/2))          (muros: ceil(L/50))
acero (tabla 101.1): verticales max(ceil(S/500), ceil(P/2)); vigas y forjados max(ceil(S/250), P)
```

**A6. Casos de prueba** (resultado esperado; HA-25 salvo que se diga otra cosa; ver K-PCC.29):

| Caso | Entrada | Lotes | Amasadas |
|---|---|---|---|
| E1 | flexion, V = 60, S = 450, P = 1 | 1 | 3 |
| E2 | flexion, V = 180, S = 1350, P = 3 | 2 | 6 |
| E3 | flexion, V = 90, S = 900, P = 3 | 2 | 6 |
| E4 | pilares_muros, V = 12, S = 450, P = 3 | 2 | 6 |
| E5 | E4 + vCuba = 6 | 2 | 4 |
| E6 | cim_superficial, V = 40, T = 1 | 1 | 3 |
| E7 | cim_superficial, V = 40, T = 2 | 2 | 6 |
| E8 | cim_mayor_200, 1 elemento de 260 | 1 | 8 (con DCOR: 3) |
| E9 | E2 + E4 + E6 con DCOR | 3 | 3 |
| E10 | E1 con fck = 50 | 1 | 6 |
| E11 | indirecto con HA-25 (αcc = 1, γc = 1,5) | rechazado (fcd 16,7 > 15) | — |
| D1 | XS1, 1 dosificación, sin DCOR, 4 meses | — | 1 penetración |
| D2 | ídem, 8 meses | — | 2 |
| F1 | ferralla taller, 9 t, enderezado, sin soldadura, Ø8/10/12/16, sin DCOR | 1 | 4 tracciones + 8 geometrías + 15 dimensionales |
| B1 | barras en obra, 9 t, series fina + media, sin DCOR | 2 | 4 tracciones, 4 doblados, 4 masa/m, 4 geometrías |
| X1 | ejecución: 3 plantas × 150 m², 12 zapatas | 2 + 2 + 2 = 6 | — |

### (b) Datos que tiene que dar el proyectista

1. **Distintivos:** hormigón con DCOR / con dispersión certificada / sin. Acero para armar, mallas y ferralla, cada uno con o sin DCOR. Si no se sabe: **por defecto «sin DCOR»** (lo más exigente) y aviso.
2. **Modalidad de control de la resistencia** (estadístico por defecto; 100 %; indirecto solo si se cumple K-PCC.26).
3. Por tipo de hormigón: designación (fck, consistencia, árido, **clase de exposición**), autocompactante sí/no, número de dosificaciones.
4. Por grupo de elementos (fila de la tabla): volumen (de las mediciones), **superficie construida y número de plantas** que abarca, nº de elementos > 200 m³, **semanas de hormigonado** (opcional) y **meses de suministro** (para la durabilidad).
5. **Volumen medio por amasada (cuba)**: opcional, para topar N y para el 100 %.
6. Armaduras: **procedencia** (taller o elaborada en obra), enderezado sí/no, soldadura no resistente o resistente, toneladas por designación, diámetros usados.
7. **Nivel de control de ejecución** (normal o intenso; va al PPTP, 14.3) y **opción A o B** del art. 17. Si procede la opción simplificada del anejo 15 (luces ≤ 6 m, ≤ 10 niveles, nivel normal).
8. Acero estructural: toneladas, **clase de ejecución** (por defecto 2), soldadura en taller u obra, tipos de cordón, tornillos sin CE, sistema de protección (pintura o galvanizado).
9. Zona sísmica (art. 58: informe de cargas cíclicas).
10. **Precios unitarios** de laboratorio. La hoja de la Junta da referencias (p. ej., resistencia a compresión 59,28 €, asentamiento 17,26 €, penetración de agua 151,45 €, tracción de corrugado 60,66 €, doblado 35,09 €). Son valores de 2022: dato editable, **no norma**.

### (c) SIN CONFIRMAR (no se codifica como norma)

- **γc = 1,5** del ap. 2.4.2.4 del anejo 19 (imagen, no leída). El veto al control indirecto con HA-25 depende de ese valor (αcc = 1,00 sí está verificado).
- Si el «× 5» de los DCOR se aplica también a plantas y semanas (el literal dice «los valores de la tabla»).
- Cómo tratar un lote con menos amasadas reales que N (el Código no lo dice).
- Contenido del **anejo 4** (documentación de suministro y modelos de acta y certificado; pp. 376–392, imagen).
- **Lista vigente de DCOR** reconocidos por el Ministerio u otros órganos.
- Si el BOE publicará un consolidado que incorpore [CE-24]. Hoy (24-10-2026) dice «sin modificaciones».
- Valores de la tabla A15.2.2.a (nivel intenso), leídos a baja resolución; la fila de forjados la sustituye [CE-24].
- La fila «Vigas, forjados…» de la tabla 63.1 incluye «50 m de muro de contención»: así se lee en la imagen, aunque parece pertenecer a otra fila.
- **V04 (2023) de la hoja de la Junta** (`volcados/norma/xls/PlanCC_CodE_V04_2023.xls`): no analizada. Puede haber corregido los puntos de K-PCC.39.
- Numeración de artículos de la EHE-08 de (d): no se ha leído la EHE-08.

### (d) Citas derogadas o erróneas que suelen arrastrar las plantillas

| En la plantilla | Situación | Sustituir por |
|---|---|---|
| «Instrucción EHE-08 (RD 1247/2008)» | Derogada desde el 10-11-2021 (VERIFICADO) | Código Estructural, RD 470/2021 |
| «Instrucción EAE (RD 751/2011)» | Derogada desde el 10-11-2021 (VERIFICADO) | Código Estructural, título 3 |
| EHE-08 art. 86 / tabla 86.5.4.1 (lotes de hormigón) | Derogado (numeración de memoria, SIN CONFIRMAR) | CodE art. 57 / tabla 57.5.4.1 |
| EHE-08 art. 87 (acero), art. 88 (armaduras) | ídem | CodE arts. 58 y 59 |
| EHE-08 art. 92 / tabla 92.4 (lotes de ejecución) | ídem | CodE art. 63 / tabla 63.1; anejo 15 |
| EHE-08 anejo 21 (documentación de suministro) | ídem | CodE anejo 4 |
| «Control a nivel reducido» del hormigón o de la ejecución (EHE-98 y anteriores) | No existe en el Código | Solo estadístico / 100 % / indirecto; ejecución normal o intenso |
| «Ambiente I, IIa, IIIa…» | Designación antigua; [CE-24] cambia el ejemplo «HA-35/AC/20/IIIa» por «…/XS1» | Clases de exposición X0, XC, XS, XD, XF, XA, XM (art. 27) |
| «RC-08 (RD 956/2008)» | Derogada por la RC-16 (VERIFICADO) | RC-16 (RD 256/2016) |
| «Art. 37» para acero de pretensar (hoja de la Junta) | Error de cita | CodE art. 36 (especificaciones), art. 60 (control) |
| «22.4.1 / 22.4.2» (art. 63 del consolidado) | Error corregido en 2024 | «apartado 14.3» |
| «Aceros de característica SD» como único caso de comprobación cíclica (art. 58 del consolidado) | Corregido en 2024 | Todo acero de armar en zona sísmica o con fatiga |
| «Encepados s/EHE-08» (hoja de la Junta) | Cita derogada | CodE tabla 57.5.4.1, fila de cimentaciones |
