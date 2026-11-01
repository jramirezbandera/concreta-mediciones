# Verificación normativa — Estudio básico de seguridad y salud (Fase 8 de PLAN-MEMORIA.md)

**Fecha:** 2026-10-15 · **Revisión 2026-10-16: cotejo en texto** (ver «Método») · **Revisión 2026-10-16 (paso 0 de feature-35): K-SYS.15 a K-SYS.20**, al final · Agente: cte-normativa · **No se ha editado código.**
**Encargo:** la pregunta 11 de `PLAN-MEMORIA.md` §4.2 (RD 1627/1997: art. 4, jornadas, art. 6, anexo II, anexo IV, modificaciones, amianto, coordinación y subcontratación, obras pequeñas y coordinadores) y el catálogo de riesgos por fase de obra que pide §5.8. Criterios numerados **K-SYS.1 … K-SYS.14**, en el orden de las preguntas, y una sección final «Para la app (fase 8)». El paso 0 de `feature-35.md` añade **K-SYS.15 … K-SYS.20** (nombres de riesgo, cifras en conflicto, lista corta de normas, amianto, botiquín y Orden TIN/1071/2010).

**Método y límites**
- **Cotejo en texto (2026-10-16).** El coordinador bajó los PDF oficiales y los pasó a texto con `pdftotext -layout` (`…\scratchpad\fase8\txt\`; PDF en `…\fase8\pdf\`). Con ellos se ha cotejado palabra por palabra lo que antes era LEÍDO (web) o SIN CONFIRMAR de cuatro fuentes:
  - **RD 1627/1997**, consolidado del BOE (`BOE-A-1997-22614.txt`, 22 pp.). Página = la del pie «Página N» del PDF consolidado.
  - **RD 396/2006**, consolidado del BOE (`BOE-A-2006-6474.txt`). Página = pie «Página N».
  - **VII CGSC**, PDF original del BOE núm. 228, 23-09-2023 (`BOE-A-2023-19903.txt`). Se cita la página del BOE («Pág. 129148») y la del PDF (= pág. − 129032).
  - **Guía técnica del INSST, 2019** (`guia-insst-2019.txt`). Se cita el **folio impreso** y la **página del PDF**, que es folio − 1 (comprobado contando saltos de página: el folio 8 cae en la p. 7 del PDF, el 63 en la 62 y la serie sigue sin saltos hasta el folio 142).
- **Segundo cotejo en texto (2026-10-16, paso 0 de feature-35).** Mismo método, con los consolidados del BOE descargados ese día: RD 1215/1997, RD 614/2001, RD 286/2006, RD 1311/2005, RD 487/1997, RD 485/1997, RD 773/1997, RD 39/1997, RD 374/2001, RD 171/2004, Ley 31/1995, Ley 32/2006, RD 1109/2007, RD 842/2002 (REBT, con sus ITC), RD 836/2003 y RD 837/2003; y los PDF originales de la Orden TIN/1071/2010 y la Orden TAS/2947/2007. Página = pie «Página N» del consolidado; en las órdenes, la página del BOE. De las normas que solo se han usado para la lista corta (K-SYS.17) se ha cotejado **la cabecera** (título y «Última modificación»), no el articulado.
- Lo que coincide palabra por palabra pasa a **VERIFICADO (texto)**, con página. Lo que no coincide, o lo que el lector web se saltó, va como **CORREGIDO**.
- **No cotejado en texto** (sigue LEÍDO (web)): RD 486/1997, Orden TAS/2926/2002, CTE Parte I, el «Análisis» del BOE (lista de normas modificadoras del RD 1627; el PDF consolidado no trae notas de modificación), la FAQ del INSST, el articulado de la Ley 31/1995, del RD 171/2004 y de la Ley 32/2006 (solo su cabecera), y la Resolución de 27-08-2008 de la SESS (K-SYS.19).
- **Tablas.** La tabla 1 del RD 614/2001 se cotejó en imagen el 2026-10-16 con PyMuPDF (el coordinador): coincide celda a celda. Las de la ITC-BT-18 salen limpias en el texto y no se han renderizado.
- **Modelo de la CNSST de 2011**: no hay copia; sigue **SIN CONFIRMAR**. Directiva (UE) 2023/2668 y proyecto de RD de amianto: siguen **SIN CONFIRMAR** en su contenido (K-SYS.18).
- Esta materia **no es CTE**: no hay «DB con comentarios». La escala «LEÍDO (comentario)» se usa para los documentos **no vinculantes del INSST** (Guía técnica, NTP, FAQ). La disposición final primera del RD 1627/1997 habla de una Guía técnica «de carácter no vinculante». Cuando el texto de la Guía se ha cotejado, se escribe **LEÍDO (comentario), cotejado en texto**, con página.

**Veredictos** (los mismos de `verificacion-memoria.md`):
- **VERIFICADO (imagen)** / **VERIFICADO (texto)**: literal de la norma, con página.
- **LEÍDO (web)**: boe.es en HTML, lectura resumida, literal pedido por trozos.
- **LEÍDO (comentario)**: documento técnico del INSST (Guía técnica, NTP, FAQ). No es reglamentario.
- **INTERPRETACIÓN**: se sigue de la norma, pero la norma no lo escribe tal cual.
- **CORREGIDO**: el encargo, el plan o una fuente previa no coincide con la fuente.
- **SIN CONFIRMAR**: no se ha podido leer en fuente oficial. **No se codifica.**

---

## 0. Fuentes y ediciones

| Clave | Documento | Edición / versión | Fuente | Lectura |
|---|---|---|---|---|
| [RD1627] | RD 1627/1997, de 24 de octubre, disposiciones mínimas de seguridad y salud en las obras de construcción | BOE-A-1997-22614; BOE núm. 256, 25-10-1997; en vigor 25-12-1997. Consolidado, cabecera del PDF: **«Última modificación: 23 de marzo de 2010»**. Según el «Análisis» del BOE, modificado por **RD 2177/2004** (anexo IV, C.5), **RD 604/2006** (añade la DA única), **RD 1109/2007** (arts. 13.4 y 18.2) y **RD 337/2010** (deroga el art. 18, modifica el 19.1). Transpone la Directiva 92/57/CEE | PDF consolidado del BOE (22 pp.) y boe.es («Análisis») | **VERIFICADO (texto)**: arts. 1–8, 13, 14, 17, 18, 19, DA única, DT única, DD única, DF 1.ª; anexos I, II y IV (en el segundo cotejo, además, A.9, A.14, C.3 b), C.4, C.9 y C.10). La lista de normas modificadoras sigue LEÍDO (web) |
| [GT-Obras] | INSST, *Guía técnica para la evaluación y prevención de los riesgos relativos a las obras de construcción* | **3.ª edición, Madrid, noviembre 2019** (GT.113.1.19; NIPO en línea 871-19-111-0; papel 871-19-110-5). Ediciones anteriores 2003 y 2012 | PDF de insst.es; texto `guia-insst-2019.txt` | **LEÍDO (comentario), cotejado en texto**: art. 2.3 (folio 22), art. 4 (folios 24–25), art. 5 (folios 26–33), art. 6 (folios 33–34), anexo IV A.14 (folios 77–79), A.15–16 (folios 79–81), C.3 (folios 90–92), C.9 (folios 99–102), C.10 (folios 102–103), C.12 (folio 104), apéndice 4 (folios 121–125) |
| [NTP1071] | INSST, NTP 1071, *Gestión de la seguridad y salud en obras sin proyecto (I)* | 2016 (NIPO 272-15-025-5) | insst.es (HTML) | LEÍDO (comentario) |
| [NTP908] | INSST, NTP 908, **«Residuos sólidos urbanos. Riesgos laborales en plantas de tratamiento de frigoríficos (I)»** | 2011 (serie 26.ª, NTP 891 a 925) | insst.es (HTML; el PDF no se pudo bajar) | LEÍDO (comentario). **CORREGIDO**: no es una nota de terminología; su tabla 1 es la lista de riesgos de una planta de frigoríficos (K-SYS.15) |
| [FAQ-LT] | INSST, Preguntas técnicas frecuentes sobre lugares de trabajo | Consultada 2026-10-15 | insst.es (HTML) | LEÍDO (comentario) |
| [CGSC7] | **VII Convenio colectivo general del sector de la construcción** (Resolución de 6-09-2023, Dirección General de Trabajo; suscrito el 3-07-2023) | BOE-A-2023-19903, BOE núm. 228, **23-09-2023**, págs. 129033 y siguientes. Vigencia **01-01-2022 a 31-12-2026** (art. 7.1); después «continuará rigiendo hasta que sea sustituido por otro» (art. 7.2) | PDF original del BOE | **VERIFICADO (texto)**: art. 7 (pág. 129039), arts. 231–233 (págs. 129148–129149), **art. 234** (págs. 129149–129150) |
| [RD486] | RD 486/1997, lugares de trabajo | BOE-A-1997-8669; consolidado, última actualización 12-05-2023 | boe.es | LEÍDO (web): art. 1.2 (literal de la letra b: «Las obras de construcción temporales o móviles»), DD única, anexo V.A, **anexo VI.A.1–4** |
| [RD1215] | RD 1215/1997, de 18 de julio, por el que se establecen las disposiciones mínimas de seguridad y salud para la utilización por los trabajadores de los equipos de trabajo | BOE-A-1997-17824; BOE núm. 188, 07-08-1997. Consolidado, cabecera: **«Última modificación: 13 de noviembre de 2004»** (RD 2177/2004) | PDF consolidado del BOE | **VERIFICADO (texto)**: anexo II, aps. 4.1 a 4.4 (pp. 14–17) |
| [RD396] | RD 396/2006, de 31 de marzo, trabajos con riesgo de exposición al amianto | **BOE-A-2006-6474** (BOE núm. 86, 11-04-2006); en vigor 11-10-2006. Cabecera del consolidado: **«Última modificación: sin modificaciones»** | PDF consolidado del BOE; boe.es («Análisis», 2026-10-16) | **VERIFICADO (texto)**: arts. 3, 4.1, 10, 11, 12, 16, 17. Sin «referencias posteriores» en el BOE: LEÍDO (web) (K-SYS.18) |
| [Dir2668] | Directiva (UE) 2023/2668, que modifica la Directiva 2009/148/CE (amianto) | De 22-11-2023; transposición hasta 21-12-2025; segundo hito 21-12-2029 | Fuentes secundarias; EUR-Lex no se pudo leer | SIN CONFIRMAR en sus cifras |
| [PRD-Am] | Proyecto de real decreto de amianto (Ministerio de Trabajo), que **derogaría** el RD 396/2006 | Proyecto fechado el 10-02-2026, en información pública. **No publicado en el BOE a 2026-10-16** (K-SYS.18) | mites.gob.es (PDF no leído), prensa | SIN CONFIRMAR |
| [LPRL] | Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales | BOE-A-1995-24292; BOE núm. 269, 10-11-1995. Cabecera del consolidado: **«Última modificación: 09 de abril de 2026»** | boe.es; PDF consolidado (cabecera) | LEÍDO (web): art. 32 bis.1, DA 14.ª.1. Cabecera VERIFICADO (texto) |
| [RD39] | RD 39/1997, de 17 de enero, por el que se aprueba el Reglamento de los Servicios de Prevención | BOE-A-1997-1853; BOE núm. 27, 31-01-1997. Cabecera: **«Última modificación: 17 de octubre de 2025»** | PDF consolidado del BOE | Cabecera VERIFICADO (texto); articulado no leído |
| [RD171] | RD 171/2004, de 30 de enero, por el que se desarrolla el artículo 24 de la Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales, en materia de coordinación de actividades empresariales | BOE-A-2004-1848; BOE núm. 27, 31-01-2004. Cabecera: **«Última modificación: sin modificaciones»** | boe.es; PDF consolidado (cabecera) | LEÍDO (web): DA 1.ª. Cabecera VERIFICADO (texto). *(La Guía, folio 24, cita literalmente su DA 1.ª: «se entenderá cumplida por el promotor mediante el estudio de seguridad y salud o el estudio básico».)* |
| [L32] | Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el Sector de la Construcción | BOE-A-2006-18205; BOE núm. 250, 19-10-2006. Cabecera: **«Última modificación: 30 de diciembre de 2021»** | boe.es; PDF consolidado (cabecera) | LEÍDO (web, parcial): arts. 4.2, 5.2, 8.1. Cabecera VERIFICADO (texto) |
| [RD1109] | RD 1109/2007, de 24 de agosto, por el que se desarrolla la Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el Sector de la Construcción | BOE-A-2007-15766; BOE núm. 204, 25-08-2007. Cabecera: **«Última modificación: 23 de marzo de 2010»** | PDF consolidado del BOE | Cabecera VERIFICADO (texto); articulado no leído |
| [RD485] | RD 485/1997, de 14 de abril, sobre disposiciones mínimas en materia de señalización de seguridad y salud en el trabajo | BOE-A-1997-8668; BOE núm. 97, 23-04-1997. Cabecera: **«Última modificación: 04 de julio de 2015»** | PDF consolidado del BOE | Cabecera VERIFICADO (texto) |
| [RD487] | RD 487/1997, de 14 de abril, sobre disposiciones mínimas de seguridad y salud relativas a la manipulación manual de cargas que entrañe riesgos, en particular dorsolumbares, para los trabajadores | BOE-A-1997-8670; BOE núm. 97, 23-04-1997. Cabecera: **«Última modificación: sin modificaciones»** | PDF consolidado del BOE (5 pp.) | **VERIFICADO (texto)**: texto completo |
| [RD773] | RD 773/1997, de 30 de mayo, sobre disposiciones mínimas de seguridad y salud relativas a la utilización por los trabajadores de equipos de protección individual | BOE-A-1997-12735; BOE núm. 140, 12-06-1997. Cabecera: **«Última modificación: 08 de diciembre de 2021»** | PDF consolidado del BOE | Cabecera VERIFICADO (texto) |
| [RD614] | RD 614/2001, de 8 de junio, sobre disposiciones mínimas para la protección de la salud y seguridad de los trabajadores frente al riesgo eléctrico | BOE-A-2001-11881; BOE núm. 148, 21-06-2001. Cabecera: **«Última modificación: sin modificaciones»** | PDF consolidado del BOE (16 pp.) | **VERIFICADO (texto)**: anexo I (definiciones 7 y 11, tabla 1, p. 6–7), anexo V (pp. 14–15). Tabla 1 pendiente de imagen antes de codificarla |
| [RD286] | RD 286/2006, de 10 de marzo, sobre la protección de la salud y la seguridad de los trabajadores contra los riesgos relacionados con la exposición al ruido | BOE-A-2006-4414; BOE núm. 60, 11-03-2006. Cabecera: **«Última modificación: sin modificaciones»** | PDF consolidado del BOE | **VERIFICADO (texto)**: arts. 4.3, 5, 6.1, 7.1 (pp. 5–7) |
| [RD1311] | RD 1311/2005, de 4 de noviembre, sobre la protección de la salud y la seguridad de los trabajadores frente a los riesgos derivados o que puedan derivarse de la exposición a vibraciones mecánicas | BOE-A-2005-18262; BOE núm. 265, 05-11-2005. Cabecera: **«Última modificación: 26 de marzo de 2009»** | PDF consolidado del BOE | **VERIFICADO (texto)**: art. 3 (p. 5) |
| [RD374] | RD 374/2001, de 6 de abril, sobre la protección de la salud y seguridad de los trabajadores contra los riesgos relacionados con los agentes químicos durante el trabajo | BOE-A-2001-8436; BOE núm. 104, 01-05-2001. Cabecera: **«Última modificación: 04 de julio de 2015»** | PDF consolidado del BOE | Cabecera VERIFICADO (texto) |
| [REBT] | RD 842/2002, de 2 de agosto, por el que se aprueba el Reglamento electrotécnico para baja tensión, con sus ITC | BOE-A-2002-18099; BOE núm. 224, 18-09-2002. Cabecera: **«Última modificación: 03 de septiembre de 2025»** | PDF consolidado del BOE, con las ITC | **VERIFICADO (texto)**: ITC-BT-18 ap. 9 (p. 125); ITC-BT-24 ap. 4.1 y 4.1.2 (pp. 157–159); ITC-BT-33 completa (pp. 216–218) |
| [RD836] | RD 836/2003, de 27 de junio, por el que se aprueba una nueva Instrucción técnica complementaria «MIE-AEM-2» del Reglamento de aparatos de elevación y manutención, referente a grúas torre para obras u otras aplicaciones | BOE-A-2003-14326; BOE núm. 170, 17-07-2003. Cabecera: **«Última modificación: 03 de septiembre de 2025»**. *(El título del BOE trae una errata: «por el que se se aprueba».)* | PDF consolidado del BOE | **VERIFICADO (texto)**: ITC ap. 5.4 (pp. 9–10); anexo IV, «Interrupción del trabajo» (p. 24) y «Recomendaciones generales» (p. 25) |
| [RD837] | RD 837/2003, de 27 de junio, por el que se aprueba el nuevo texto modificado y refundido de la Instrucción técnica complementaria «MIE-AEM-4» del Reglamento de aparatos de elevación y manutención, referente a grúas móviles autopropulsadas | BOE-A-2003-14327; BOE núm. 170, 17-07-2003. Cabecera: **«Última modificación: 13 de abril de 2024»** | PDF consolidado del BOE | Cabecera VERIFICADO (texto); búsqueda de cifras de viento: no fija ninguna para el trabajo |
| [O1071] | Orden TIN/1071/2010, de 27 de abril, sobre los requisitos y datos que deben reunir las comunicaciones de apertura o de reanudación de actividades en los centros de trabajo | BOE-A-2010-6871; BOE núm. 106, **01-05-2010**, págs. 38787–38793. En vigor el 02-05-2010 para las obras (art. 2.2) y el 31-05-2010 para el resto (DF 2.ª). Sin «referencias posteriores» en el BOE | PDF original del BOE; boe.es («Análisis») | **VERIFICADO (texto)**: preámbulo, arts. 1–5, DT única, DD única, DF 2.ª, anexo partes A y B (K-SYS.20) |
| [TAS2947] | Orden TAS/2947/2007, de 8 de octubre, por la que se establece el suministro a las empresas de botiquines con material de primeros auxilios en caso de accidente de trabajo, como parte de la acción protectora del sistema de la Seguridad Social | BOE-A-2007-17835; BOE núm. 244, 11-10-2007, págs. 41429–41430; en vigor 12-10-2007. Sin derogación anotada; única referencia posterior: Resolución de 27-08-2008 | PDF original del BOE; boe.es («Análisis») | **VERIFICADO (texto)**: preámbulo, arts. 1–3, DA única, DF (K-SYS.19) |
| [RES2008] | Resolución de 27 de agosto de 2008, de la Secretaría de Estado de la Seguridad Social, por la que se dictan instrucciones para la aplicación de la Orden TAS/2947/2007 | BOE-A-2008-14778; BOE 10-09-2008, págs. 36822–36828 | boe.es (HTML) | LEÍDO (web): título y anexo I (tabla de reembolso por número de trabajadores, precios de 2008). No se imprime |
| [TAS2926] | Orden TAS/2926/2002, modelos de parte de accidente (Delt@) | BOE-A-2002-22650; en vigor 01-01-2003 | boe.es | LEÍDO (web): anexo II, tabla 5 «Forma contacto» |
| [PI-BOE] | CTE Parte I (RD 314/2006), Anejo I «Contenido del proyecto» | BOE-A-2006-5515, consolidado 15-06-2022; el Anejo I con la redacción de 11-03-2010 | boe.es | LEÍDO (web) |
| [CNSST] | Comisión Nacional de Seguridad y Salud en el Trabajo, Grupo de trabajo de Construcción: documentos aprobados | Página consultada 2026-10-15 | insst.es (HTML) | LEÍDO (web) la lista; los PDF, no. **Modelo 2011: SIN CONFIRMAR** |

### Correcciones al encargo y al plan (resumen)

1. **El umbral es de ejecución por contrata, no material.** El art. 4.1 a) dice «presupuesto de ejecución por contrata incluido en el proyecto». La Guía lo define **con IVA**: PEC = (PEM + GG + BI) x (1+IVA). `PLAN-MEMORIA.md` §5.8 solo prevé pedir el **PEM**: con el PEM no basta para decidir. (K-SYS.1)
2. **El RD 1627/1997 no fija ratios de servicios higiénicos.** El anexo IV dice «número suficiente». La frase de §5.8 «dimensionados por el número de trabajadores (anexo IV)» es **incorrecta en la cita**. Las ratios salen del **VII CGSC, art. 232.2**. La Guía del INSST recomienda además vestuarios, duchas y lavabos **en todas las obras**, y retretes por sexos. (K-SYS.5)
3. **El «aviso previo» ya no existe.** El art. 18 figura «(Derogado)» en el consolidado. Ahora el contratista presenta la **comunicación de apertura** (art. 19.1). El EBSS no debe mencionar el aviso previo. El anexo III («Contenido del aviso previo») sigue impreso en el consolidado, pero ya no lo usa ningún artículo. (K-SYS.6)
4. **El estudio básico no lleva presupuesto propio.** El art. 6 no lo pide; la Guía lo llama «un documento exclusivamente descriptivo». (K-SYS.3)
5. **Amianto: el RD 396/2006 está vigente y «sin modificaciones».** **CORREGIDO, y es nuevo:** su art. 10.2 obliga a que la identificación de materiales con amianto «deberá quedar reflejada en el estudio de seguridad y salud, o en el estudio básico». La lectura web se saltó ese párrafo. (K-SYS.9)
6. **No hay un catálogo oficial de riesgos por fase de obra.** Confirmado en el texto: la Guía 2019 no trae ninguno, ni siquiera en su apéndice 4. La estructura codificable sale del propio RD (anexo I y anexo IV, parte C). (K-SYS.12 y K-SYS.13)
7. **La Guía pide justificar en el proyecto por qué no se hace el estudio completo**, con los datos de presupuesto, duración y mano de obra. Es un apartado nuevo del EBSS. (K-SYS.2)
8. **Cabeza de familia** (art. 2.3 del RD): si contrata directamente a autónomos para su vivienda, no es contratista, y según la Guía no hace falta plan de seguridad para esas partes. El EBSS se sigue exigiendo. (K-SYS.11)
9. **La NTP 908 no es una lista de terminología.** Es la nota sobre riesgos en plantas de tratamiento de frigoríficos. La lista que manda es la del análisis §4.2, con cinco nombres ajustados. (K-SYS.15)
10. **La toma de tierra provisional no tiene un valor fijo en ohmios.** Sale de RA × Ia ≤ 24 V (ITC-BT-33 e ITC-BT-24): 800 Ω con 30 mA y 80 Ω con 300 mA. Toda base de toma de corriente va con diferencial de 30 mA como máximo, también las de fuerza. (K-SYS.16)
11. **El RD 487/1997 no fija 25 kg.** Remite a la Guía técnica del INSST. (K-SYS.16)
12. **La Orden TAS/2947/2007 no es norma de seguridad de la obra.** Regula que la mutua suministre el botiquín del RD 486/1997, que excluye las obras. (K-SYS.19)

---

## K-SYS.1 — Art. 4.1: cuándo hace falta el estudio completo

**Pregunta.** Supuestos que obligan al estudio de seguridad y salud (completo), con cifras exactas; si el presupuesto es de ejecución por contrata o material y qué incluye.

**Respuesta.** Hace falta el estudio completo si se da **uno cualquiera** de los cuatro supuestos. El presupuesto es **de ejecución por contrata (PEC)**, «incluido en el proyecto», y la Guía lo define con IVA. La cifra es 75 millones de pesetas = **450.759,08 €**.

**Cita.** [RD1627] art. 4.1, p. 5, **VERIFICADO (texto)**:
> «1. El promotor estará obligado a que en la fase de redacción del proyecto se elabore un estudio de seguridad y salud en los proyectos de obras en que se den alguno de los supuestos siguientes:
> a) Que el presupuesto de ejecución por contrata incluido en el proyecto sea igual o superior a 75 millones de pesetas.
> b) Que la duración estimada sea superior a 30 días laborables, empleándose en algún momento a más de 20 trabajadores simultáneamente.
> c) Que el volumen de mano de obra estimada, entendiendo por tal la suma de los días de trabajo del total de los trabajadores en la obra, sea superior a 500.
> d) Las obras de túneles, galerías, conducciones subterráneas y presas.»

**Guía**, [GT-Obras] folio 24 (PDF p. 23), **LEÍDO (comentario), cotejado en texto**:
> «Los 75 millones de pesetas equivalen a 450.759,08 euros.
> El presupuesto de ejecución por contrata se obtiene a partir de los siguientes conceptos:
> PEC = (PEM + GG + BI) x (1+IVA)
> Donde: PEC = Presupuesto de ejecución por contrata. PEM = Presupuesto de ejecución material. GG = Gastos generales. BI = Beneficio industrial. IVA = Impuesto sobre el valor añadido.»

Sobre b), mismo folio: «Este apartado será de aplicación cuando se den las dos condiciones enunciadas en el mismo de forma simultánea, es decir, duración y número de trabajadores.»
Sobre d), folio 25 (PDF p. 24): «El concepto de "conducciones subterráneas" que se recoge en este apartado del real decreto comprende las tareas relativas a cualquier tipo de trabajo que sea necesario ejecutar para la correcta instalación de conducciones enterradas, siempre que estas se realicen por debajo de la cota del terreno, no sean a cielo abierto y requieran la presencia de trabajadores en su interior.»
Y (folio 24): el promotor puede encargar un estudio completo aunque solo sea exigible el básico.

*(La cita de la Guía se ha recompuesto desde la maquetación a dos columnas del texto; el orden de las frases es el de la página.)*

**Lo que el literal fija (para el motor)**
- a) **igual o superior**: `PEC ≥ 450.759,08 €`, con **PEC = (PEM + GG + BI) × (1 + IVA)**.
- b) **las dos condiciones a la vez** (la Guía lo confirma): `días laborables > 30` **y** `trabajadores simultáneos > 20`.
- c) **estrictamente superior**: `jornadas > 500`.
- d) por tipo de obra, sin cifra. Las zanjas a cielo abierto de saneamiento o acometidas **no** son «conducciones subterráneas» (Guía).

**Conversión a euros.** La cifra en euros la da la Guía literalmente. **Antes INTERPRETACIÓN, ahora LEÍDO (comentario), cotejado en texto.**

**Consecuencia para la app (actualizada)**
- Pedir **PEM, % GG, % BI y % IVA** (o directamente el PEC del resumen de presupuesto) y calcular `PEC = (PEM + GG + BI) × (1 + IVA)` con la fórmula de la Guía. Los porcentajes los declara el proyectista: no se suponen (principio 4).
- Si el proyectista solo da el PEM, la app puede seguir descartando con una cota (`PEM × 1,19 × 1,21 < 450.759,08`, GG 13 % + BI 6 % + IVA 21 %) y confirmar cuando `PEM ≥ 450.759,08`. Entre medias, pide los porcentajes.
- Pregunta d) con la aclaración de la Guía: «¿trabajos con personas dentro de conducciones enterradas que no son a cielo abierto?».

---

## K-SYS.2 — Art. 4.2: en los demás casos, estudio básico; volumen de mano de obra

**Pregunta.** Que en los demás casos basta el básico. Cómo se estima el volumen de mano de obra: si hay método oficial o del INSST desde el presupuesto.

**Cita.** [RD1627] art. 4.2, p. 5, **VERIFICADO (texto)**:
> «2. En los proyectos de obras no incluidos en ninguno de los supuestos previstos en el apartado anterior, el promotor estará obligado a que en la fase de redacción del proyecto se elabore un estudio básico de seguridad y salud.»

**Jornadas.** [GT-Obras] folio 25 (PDF p. 24), **LEÍDO (comentario), cotejado en texto**:
> «Para su cálculo se puede aplicar la siguiente fórmula: […] Donde: n = Número de períodos en los cuales el número de trabajadores permanece constante. i = Período de tiempo durante el cual el número de trabajadores permanece constante. Ti = Número de trabajadores para cada periodo i. Di = Número de días de trabajo para cada periodo i.»
> «1. Con el fin de computar el número de trabajadores, se considerará el total de los necesarios para ejecutar la obra en el plazo previsto en el proyecto, con independencia de que en dicha ejecución participen una o varias empresas o trabajadores autónomos.
> 2. Como referencia, un día de trabajo equivale a una jornada de 8 horas.
> Cuando el sumatorio sea superior a 500, se elaborará el preceptivo estudio de seguridad y salud.»

- **La expresión de la fórmula** es una imagen en el PDF. Cotejada en imagen el 2026-10-16 (folio 25, p. 25 del PDF renderizada): **Σᵢ₌₁ⁿ Tᵢ × Dᵢ > 500** → **VERIFICADO (imagen)** como texto de la Guía (no reglamentario).
- **No hay método para estimar las jornadas desde el presupuesto.** La Guía solo da la suma por periodos y la equivalencia día = 8 h. **Antes SIN CONFIRMAR, ahora LEÍDO (comentario), cotejado en texto.**

**Justificación en el proyecto. NUEVO.** [GT-Obras] folio 25 (PDF p. 24), **LEÍDO (comentario), cotejado en texto**:
> «En el proyecto debieran incluirse los datos necesarios (presupuesto de ejecución, duración y volumen de mano de obra) que permitan determinar si procede elaborar un estudio o un estudio básico de seguridad y salud. En el caso de que la obra no esté incluida en ninguno de los supuestos especificados en el artículo 4.1, apartados a), b) o c) de este real decreto, es conveniente justificar, con los datos extraídos del proyecto, por qué no procede elaborar un estudio de seguridad y salud. En tal circunstancia se elaborará un estudio básico.»

**Consecuencia para la app (actualizada)**
- Las jornadas las declara el proyectista, o salen de una tablita de periodos (Tᵢ, Dᵢ) que la app suma. Nota «1 día = jornada de 8 h; todos los trabajadores necesarios, también autónomos y subcontratas».
- **Atajo exacto (INTERPRETACIÓN, aritmética):** jornadas ≤ días laborables × máximo de trabajadores simultáneos. Si ese producto es ≤ 500, el supuesto c) queda descartado.
- **Primer apartado del EBSS: «Justificación del estudio básico»**, una tabla «Supuesto del art. 4.1 | Umbral | Proyecto | ¿Se supera?» con PEC, días × simultáneos, jornadas y tipo de obra. Es lo que pide la Guía.

---

## K-SYS.3 — Art. 6: contenido del estudio básico; quién lo redacta y cuándo

**Cita.** [RD1627] art. 6, pp. 6–7, **VERIFICADO (texto)**:
> «1. El estudio básico de seguridad y salud a que se refiere el apartado 2 del artículo 4 será elaborado por el técnico competente designado por el promotor. Cuando deba existir un coordinador en materia de seguridad y salud durante la elaboración del proyecto de obra, le corresponderá a éste elaborar o hacer que se elabore, bajo su responsabilidad, dicho estudio.
> 2. El estudio básico deberá precisar las normas de seguridad y salud aplicables a la obra. A tal efecto, deberá contemplar la identificación de los riesgos laborales que puedan ser evitados, indicando las medidas técnicas necesarias para ello; relación de los riesgos laborales que no puedan eliminarse conforme a lo señalado anteriormente, especificando las medidas preventivas y protecciones técnicas tendentes a controlar y reducir dichos riesgos y valorando su eficacia, en especial cuando se propongan medidas alternativas. En su caso, tendrá en cuenta cualquier otro tipo de actividad que se lleve a cabo en la misma, y contendrá medidas específicas relativas a los trabajos incluidos en uno o varios de los apartados del anexo II.
> 3. En el estudio básico se contemplarán también las previsiones y las informaciones útiles para efectuar en su día, en las debidas condiciones de seguridad y salud, los previsibles trabajos posteriores.»

**CORREGIDO (nota de numeración).** El 6.1 **sí lleva el «1.»** en el BOE (p. 6). El párrafo sin número es el primero del **art. 5** (p. 5), no el del art. 6.

**Fase y visado.** [RD1627] art. 17.1, p. 11, **VERIFICADO (texto)**:
> «1. La inclusión en el proyecto de ejecución de obra del estudio de seguridad y salud o, en su caso, del estudio básico será requisito necesario para el visado de aquél por el Colegio profesional correspondiente, expedición de la licencia municipal y demás autorizaciones y trámites por parte de las distintas Administraciones públicas.»

**CORREGIDO**: el BOE no lleva la coma que aparecía en la lectura web después de «estudio básico».
CTE Parte I, Anejo I: «Estudio de Seguridad y Salud o Estudio Básico, en su caso.» (LEÍDO (web), sin cambios.)

**Qué es el básico.** [GT-Obras] folio 34 (PDF p. 33), **LEÍDO (comentario), cotejado en texto**:
> «El estudio básico se configura en este real decreto como un documento exclusivamente descriptivo. Por lo tanto, su redacción es conveniente que sea lo suficientemente detallada para que permita la elaboración del plan de seguridad y salud en el trabajo. Esto quiere decir que, si el redactor del estudio básico lo considera oportuno, puede anexar documentación gráfica complementaria.»

Y folio 33 (PDF p. 32): el apéndice 4 de la Guía, «Salvo indicación en contrario, […] será de aplicación tanto al estudio como al estudio básico». Sobre el 6.2 la Guía remite a su comentario del 5.2 a). Ese comentario pide describir en la memoria «los servicios sanitarios y comunes», aplicando los puntos 14, 15, 16 y 19 de la parte A del anexo IV (folio 27).

**Sin presupuesto.** **Antes INTERPRETACIÓN; ahora la respalda la Guía** («exclusivamente descriptivo»). El presupuesto del estudio completo (art. 5.2 e y 5.4, pp. 5–6, VERIFICADO (texto)) se calcula sobre el PEC (Guía folio 31) y va como un capítulo más del presupuesto general. Nada de eso se exige al básico.

**Otros cambios del cotejo**
- El art. 5.2 a) (solo estudio completo, p. 6) dice además: «Asimismo, se incluirá la descripción de los servicios sanitarios y comunes de que deberá estar dotado el centro de trabajo de la obra, en función del número de trabajadores que vayan a utilizarlos.»
- El **CGSC7 art. 231.2** (VERIFICADO (texto), pág. 129148) dice que, en obras con estudio o estudio básico, las instalaciones higiénicas «se definirán en el plan de seguridad y salud en el trabajo en función de lo previsto en el correspondiente estudio o estudio básico».
- → **INTERPRETACIÓN reforzada**: el EBSS debe prever los servicios higiénicos (K-SYS.5).

**Consecuencia para la app (actualizada).** Orden del documento:
0. justificación del básico (K-SYS.2);
1. normas aplicables;
2. riesgos evitables y medidas técnicas;
3. riesgos no eliminables, con medidas, protecciones y eficacia;
4. otras actividades en el lugar;
5. medidas específicas del anexo II;
6. servicios higiénicos y comunes (A.14–16 y 19);
7. identificación de amianto (K-SYS.9);
8. trabajos posteriores.

Sin presupuesto. Planos opcionales («documentación gráfica complementaria»).

---

## K-SYS.4 — Anexo II: trabajos con riesgos especiales

**Cita.** [RD1627] anexo II, p. 13, **VERIFICADO (texto)**. Los diez apartados coinciden palabra por palabra con los transcritos en la versión anterior. Título: «Relación no exhaustiva de los trabajos que implican riesgos especiales para la seguridad y la salud de los trabajadores». Definición art. 2.1 b), p. 4, **VERIFICADO (texto)**.

**NUEVO, recurso preventivo.** [GT-Obras] folio 32 (PDF p. 31), **LEÍDO (comentario), cotejado en texto**: «para la ejecución de trabajos especificados en el anexo II es preceptiva la presencia de un recurso preventivo. Esta circunstancia también deberá ser considerada en el estudio de seguridad y salud.» La DA única a) del RD (pp. 11–12, **VERIFICADO (texto)**) deja al plan la forma de esa presencia.

**Para el estudio completo** (art. 5.5, p. 6, VERIFICADO (texto)), las zonas con trabajos del anexo II deben estar «localizadas e identificadas». **Para el básico, el art. 6.2 solo pide «medidas específicas».** La app no exige planos de zonas en el EBSS.

Las asignaciones a cada apartado (amianto → 2; cubierta, fachada, huecos, excavación → 1; etc.) siguen siendo **INTERPRETACIÓN**, sin cambios.

---

## K-SYS.5 — Anexo IV: servicios higiénicos y locales de descanso; ratios

**Respuesta (actualizada).**
- El RD 1627/1997 **no fija ninguna ratio**.
- Lo **vigente y obligatorio** con cifras es el **VII CGSC, art. 232.2**: 1 ducha y 1 lavabo por cada 10, 1 retrete por cada 25 «personas trabajadoras o fracción que desarrollen actividades simultáneamente en la obra».
- La **Guía del INSST para obras** (no vinculante) va más allá:
  - vestuarios, duchas y lavabos **en todas las obras**, con alternativas en obras de corta duración;
  - retretes **1 por cada 25 hombres y 1 por cada 15 mujeres**, y 1 urinario por cada 25 hombres.

**Cita 1.** [RD1627] anexo IV parte A, ap. 14 (p. 16) y aps. 15, 16 y 19 (p. 17), **VERIFICADO (texto)**. Los literales de la versión anterior coinciden. Ninguna ratio. Además:
- 19 b): «En la obra, los trabajadores deberán disponer de agua potable y, en su caso, de otra bebida apropiada no alcohólica en cantidad suficiente, tanto en los locales que ocupen como cerca de los puestos de trabajo.»
- 19 c): «Los trabajadores deberán disponer de instalaciones para poder comer y, en su caso, para preparar sus comidas en condiciones de seguridad y salud.»

**Cita 2.** [CGSC7], **VERIFICADO (texto)**:
- **Art. 231.1** (pág. 129148, PDF p. 116): «Las obras de construcción estarán dotadas de servicios sanitarios y comunes, en función del número de personas trabajadoras que vayan a utilizarlos. Dichas instalaciones se irán adaptando progresivamente a medida que se incorporen las personas trabajadoras, incluidos los de las empresas subcontratistas y trabajadores/as autónomos/as, guardando siempre relación con el número de personas trabajadoras que desempeñen simultáneamente tareas en la obra.»
- **Art. 231.2**: ver K-SYS.3.
- **Art. 231.3 y 231.4**: coinciden con la versión anterior.
- **Art. 232.1** (pág. 129148). **CORREGIDO**: es más exigente que el RD. Vestuarios «Cuando las personas trabajadoras tengan que llevar ropa especial de trabajo, o se realicen trabajos sucios»; «Los vestuarios estarán dotados de un sistema de climatización que garantice el confort térmico de acuerdo con la normativa»; ropa separada «contando, para ello, con taquillas de doble compartimentación»; «En todo caso, cada trabajador/a deberá poder disponer de un espacio para colocar su ropa y sus objetos personales bajo llave.»
- **Art. 232.2** (pág. 129149, PDF p. 117): coincide palabra por palabra con la cita de la versión anterior. Al final añade: «Si las duchas o los lavabos y los vestuarios estuvieren separados, la comunicación entre unos y otros deberá ser fácil.»
- **Art. 232.3**: separación por sexos o uso separado.
- **Art. 233.5**: instalaciones para comer «dotadas de hornos calienta comida, ventilación suficiente, calefacción y condiciones adecuadas de higiene y limpieza».

**Cita 3.** [GT-Obras], comentario al anexo IV A.15, folios 79–80 (PDF pp. 78–79), **LEÍDO (comentario), cotejado en texto**:
> «Independientemente de lo anterior, y dada la singularidad de los trabajos de construcción, todas las obras dispondrán de vestuarios adecuados. No obstante, en el caso de las obras de corta duración se podrá disponer de un medio alternativo para cambiarse y guardar la ropa.»
> «En todas las obras de construcción se dispondrá de duchas y lavabos apropiados. En este sentido, el VI Convenio General del Sector de la Construcción establece, como mínimo, una ducha y un lavabo por cada 10 trabajadores o fracción que desarrollen actividades simultáneamente en la obra. No obstante, en obras de corta duración, se podrán instaurar soluciones alternativas que permitan el aseo.»
> «La dotación recomendada será: • Un retrete por cada 25 hombres o fracción y uno por cada 15 mujeres o fracción. • Un urinario por cada 25 hombres o fracción. No obstante, para aquellas obras de corta duración se podrá disponer de medios alternativos a los descritos.»
> Nota 36: «El VI Convenio General del Sector de la Construcción prevé la instalación de un retrete "por cada 25 trabajadores o fracción que desarrollen actividades simultáneamente en la obra."»

La Guía (2019) cita el **VI** Convenio. El vigente es el **VII**, que mantiene las mismas cifras en su art. 232.2.

**Tabla de vigencia (actualizada)**

| Fuente | ¿Aplica a obras? | ¿Ratios? | Veredicto |
|---|---|---|---|
| RD 1627/1997, anexo IV A.14–16 y 19 | Sí, es la norma | No | Se cita siempre. VERIFICADO (texto) |
| VII CGSC, arts. 231–233 | Sí: empresas del sector; vigente hasta 31-12-2026 y después prorrogado (art. 7.2) | 1/10 duchas (si actividad o salubridad lo requieren), 1/10 lavabos, 1/25 retretes, «o fracción», simultáneos | **Citable y obligatorio**. VERIFICADO (texto) |
| Guía técnica INSST de obras (2019), comentario a A.15 | Sí (no vinculante) | Vestuarios, duchas y lavabos en todas las obras; retretes 1/25 hombres + 1/15 mujeres; urinario 1/25 hombres; alternativas en obras de corta duración | **Citable como criterio técnico**. LEÍDO (comentario), cotejado en texto. **CORREGIDO**: la versión anterior atribuía la cifra de 1/15 solo a la Guía de lugares de trabajo |
| RD 486/1997, anexo V | **No** (art. 1.2 b) | No | No se cita. LEÍDO (web) |
| Ordenanza General de 1971 / Ordenanza Laboral de 1970 | No citable para obras | No leídas | SIN CONFIRMAR, sin cambios |

**Cálculo para la app (INTERPRETACIÓN, actualizado)**, con n = máximo de trabajadores simultáneos:
- **Obligatorio (convenio):** retretes ⌈n/25⌉; lavabos ⌈n/10⌉; duchas ⌈n/10⌉ cuando el tipo de actividad o la salubridad lo requieran.
- **Recomendado (Guía):** duchas y vestuarios **siempre**. Si el proyectista declara cuántas mujeres y cuántos hombres, retretes ⌈hombres/25⌉ + ⌈mujeres/15⌉ y urinarios ⌈hombres/25⌉. Si no lo declara, se imprime la ratio del convenio y la frase de la Guía.
- **Obra de corta duración o de escasa importancia:** soluciones alternativas (convenio 231.4; Guía, folios 79–80), a elección del proyectista y con texto.
- Vestuario climatizado y taquilla de doble compartimento cuando haya ropa especial o trabajos sucios (convenio 232.1).
- Primeros auxilios: ver **K-SYS.19** (convenio art. 234: local si n > 50).

---

## K-SYS.6 — Modificaciones posteriores: lo que el EBSS debe decir hoy

**Cotejo.** [RD1627], **VERIFICADO (texto)**:
- Art. 7.1 y 7.2: p. 7.
- Art. 13: p. 10. El 13.4 vigente coincide: copia a la Inspección «en el plazo de veinticuatro horas» solo si la anotación se refiere a un incumplimiento de advertencias anteriores o al supuesto del art. 14 (paralización).
- Art. 18: «(Derogado)», p. 11.
- Art. 19.1: p. 11, coincide.
- DA única: pp. 11–12, coincide.

**Lo nuevo del cotejo**
- Art. 19.2 (p. 11): «El plan de seguridad y salud estará a disposición permanente de la Inspección de Trabajo y Seguridad Social y de los técnicos de los órganos especializados en materia de seguridad y salud en las Administraciones públicas competentes.»
- Art. 7.3 (p. 7): en la obra, el plan «constituye el instrumento básico de ordenación de las actividades de identificación y, en su caso, evaluación de los riesgos y planificación de la actividad preventiva».
- Art. 9 c) y f) (p. 8): sin coordinador, la dirección facultativa aprueba el plan y controla el acceso a la obra.

**El anexo III («Contenido del aviso previo») sigue impreso en el consolidado** (pp. 13–14), pero ningún artículo vigente remite a él. **CORREGIDO**: la versión anterior lo daba por desaparecido. Sigue **prohibido citarlo** en el EBSS.

Lo que viene del «Análisis» del BOE (qué RD modifica cada artículo) y la Ley 32/2006: sin cambios. **La Orden TIN/1071/2010 ya está cotejada: ver K-SYS.20.**

---

## K-SYS.7 — Ley 31/1995, RD 171/2004 y Ley 32/2006: qué citar

**Sin cambios de fondo.** La Guía (folio 24, PDF p. 23) cita literalmente la DA 1.ª del RD 171/2004: la información del empresario titular «se entenderá cumplida por el promotor mediante el estudio de seguridad y salud o el estudio básico». En su apéndice 4 (folio 122, PDF p. 121) añade que el estudio es «el instrumento mediante el cual el promotor informa al contratista sobre los aspectos más relevantes de la obra en relación con la prevención de riesgos laborales». **LEÍDO (comentario), cotejado en texto.**

**Nuevo (apéndice 4, folio 122):** «Cabe recordar que la falta de alcance y contenido del estudio de SS está tipificada como infracción grave en el artículo 12.24 de la Ley sobre Infracciones y Sanciones en el Orden Social (Real Decreto Legislativo 5/2000).» El RDL 5/2000 no se ha leído. Es útil para el aviso de «Antes de entregar», sin citar el artículo hasta leerlo → **SIN CONFIRMAR** el artículo.

Títulos exactos y fecha de última modificación de estas tres normas: K-SYS.17.

---

## K-SYS.8 — Andamios y escaleras de mano

[RD1627] anexo IV C.5, p. 20, **VERIFICADO (texto)**: coincide. Lo del **RD 1215/1997** (3,5 m, 5 m, 6 / 8 / 24 m) **ya está cotejado en texto: ver K-SYS.16** (filas de escaleras, borriquetas y andamios). Una corrección de lectura: el 4.2.4 no fija un máximo de 5 m, sino que prohíbe las escaleras de mano (en particular las de más de 5 m) «sobre cuya resistencia no se tengan garantías».

---

## K-SYS.9 — Amianto: RD 396/2006

**Cabecera.** [RD396]: «TEXTO CONSOLIDADO. Última modificación: sin modificaciones». **CORREGIDO**: la versión anterior decía «última actualización 11-04-2006»; el dato es que no tiene modificaciones. **Estado a 2026-10-16: K-SYS.18.**

**Cotejo, VERIFICADO (texto)**: art. 3.1 a), c)–f) (p. 5); art. 10.1 (p. 8); art. 10.2 (pp. 8–9); art. 11.1 (p. 9); art. 11.4 (p. 10); art. 12.1 (p. 10); art. 16.1, primera frase (p. 12); art. 17.1 (p. 12). Coinciden con los literales de la versión anterior, **salvo lo que sigue**.

**CORREGIDO, 1: art. 10.2 tiene un segundo párrafo que la lectura web omitió** (p. 9):
> «A estos efectos, la identificación deberá quedar reflejada en el estudio de seguridad y salud, o en el estudio básico de seguridad y salud, a que se refiere el Real Decreto 1627/1997, de 24 de octubre, por el que se establecen disposiciones mínimas de seguridad y salud en las obras de construcción, o en su caso en la evaluación de riesgos en aquellas obras en las que reglamentariamente no sea exigible la elaboración de dichos estudios.»

La Guía lo repite (folio 28, PDF p. 27, LEÍDO (comentario), cotejado en texto): el art. 10.2 «determina la obligación de reflejar la identificación de los materiales que puedan contener amianto en el estudio o en el estudio básico de seguridad y salud».
→ **Ya no es INTERPRETACIÓN: es una obligación directa del EBSS.**

**CORREGIDO, 2: art. 12.2 completo** (p. 10):
> «El plazo para resolver y notificar la resolución será de cuarenta y cinco días, a contar desde la fecha en que la solicitud haya tenido entrada en el registro de la autoridad laboral competente; si, transcurrido dicho plazo, no se hubiera notificado pronunciamiento expreso, el plan de trabajo se entenderá aprobado.»

Hay silencio positivo. Y «En la tramitación del expediente deberá recabarse el informe de la Inspección de Trabajo y Seguridad Social y de los órganos técnicos en materia preventiva de las correspondientes comunidades autónomas.»

**NUEVO, 3: art. 3.2, excepciones** (pp. 5–6):
> «No obstante lo anterior, siempre que se trate de exposiciones esporádicas de los trabajadores, que la intensidad de dichas exposiciones sea baja y que los resultados de la evaluación prevista en el artículo 5 indiquen claramente que no se sobrepasará el valor límite de exposición al amianto en el área de la zona de trabajo, los artículos 11, 16, 17 y 18 no serán de aplicación cuando se trabaje: a) en actividades cortas y discontinuas de mantenimiento durante las cuales sólo se trabaje con materiales no friables, b) en la retirada sin deterioro de materiales no friables, c) en la encapsulación y en el sellado de materiales en buen estado que contengan amianto, siempre que estas operaciones no impliquen riesgo de liberación de fibras, y d) en la vigilancia y control del aire y en la toma de muestras para detectar la presencia de amianto en un material determinado.»

→ **INTERPRETACIÓN**: la excepción depende de la evaluación con medición del art. 5, que hace la empresa. El EBSS no puede darla por hecha. La app no la aplica: si hay o puede haber amianto, imprime plan de trabajo, RERA y vigilancia de la salud, y una frase que remite al art. 3.2 «cuando la evaluación del art. 5 lo acredite».

**NUEVO, 4**
- Art. 11.2 (p. 9): el plan de trabajo especifica, entre otras cosas, si el material es «friable (amianto proyectado, calorifugados, paneles aislantes, etc.) o no friable (fibrocemento, amianto-vinilo, etc.)».
- Art. 11.5 (p. 10): quien contrate esos trabajos «deberá comprobar que dichos contratistas o subcontratistas cuentan con el correspondiente plan de trabajo», y el contratista o subcontratista remite el plan, «una vez aprobado por la autoridad laboral», a la empresa principal.
- Art. 4.1 (p. 6): VLA-ED de **0,1 fibras/cm³**. Vigente, pero **no se imprime**: va a cambiar con la transposición.

**Directiva (UE) 2023/2668 y proyecto de RD**: sin cambios, **SIN CONFIRMAR** (estado a 2026-10-16 en K-SYS.18).

**Consecuencia para la app (actualizada)**
- En toda obra de **demolición o mantenimiento sobre edificio existente**, el EBSS lleva **siempre** un apartado «Identificación de materiales con amianto (RD 396/2006, art. 10.2)». Su contenido es la declaración del proyectista: **no se ha identificado / posible / identificado**, con la ubicación y el tipo (friable o no friable) si se conoce. El apartado es obligatorio: si falta la declaración, sale pendiente en «Antes de entregar».
- Con «posible» o «identificado»:
  - empresa inscrita en el RERA (art. 17.1);
  - plan de trabajo aprobado por la autoridad laboral **antes** del inicio (arts. 11 y 12): 45 días, con silencio positivo;
  - retirada antes de demoler (art. 11.1 a);
  - comprobación del plan por quien contrate (art. 11.5);
  - anexo II.2 y recurso preventivo;
  - residuos peligrosos al estudio de residuos.
- Sin valores límite. Cita «RD 396/2006, o la norma que lo sustituya en transposición de la Directiva (UE) 2023/2668».

---

## K-SYS.10 — Obras sin proyecto

**Sin cambios** (NTP 1071, LEÍDO (comentario)). Ahora se apoya también en dos textos cotejados:
- RD 396/2006 art. 10.2 (p. 9, VERIFICADO (texto)), que prevé «la evaluación de riesgos en aquellas obras en las que reglamentariamente no sea exigible la elaboración de dichos estudios».
- La Guía, apéndice 4 (folio 121, PDF p. 120): si la obra no está obligada a plan de SST, «las medidas preventivas deberán planificarse de acuerdo con lo establecido en la LPRL, en el RSP, en el Real Decreto 1627/1997 (salvo lo especificado en el citado artículo 7) y en el resto de normativa de prevención de riesgos laborales».
- Y la Orden TIN/1071/2010, art. 2.2 (VERIFICADO (texto), K-SYS.20): si no es exigible el plan, la comunicación de apertura «se acompañará de la correspondiente evaluación de riesgos».

---

## K-SYS.11 — Proyecto de reforma pequeña, coordinadores y cabeza de familia

**Cotejo.** [RD1627] art. 3 (p. 5) y art. 2.1 c) a h) (p. 4), **VERIFICADO (texto)**: coinciden.

**NUEVO, cabeza de familia.** [RD1627] art. 2.3, p. 5, **VERIFICADO (texto)**:
> «3. Cuando el promotor contrate directamente trabajadores autónomos para la realización de la obra o de determinados trabajos de la misma, tendrá la consideración de contratista respecto de aquéllos a efectos de lo dispuesto en el presente Real Decreto.
> Lo dispuesto en el párrafo anterior no será de aplicación cuando la actividad contratada se refiera exclusivamente a la construcción o reparación que pueda contratar un cabeza de familia respecto de su vivienda.»

[GT-Obras] folio 22 (PDF p. 21), **LEÍDO (comentario), cotejado en texto**: «Se entiende como "cabeza de familia", a los efectos de este real decreto, aquella persona que construye o repara una vivienda (de la cual es titular) para su utilización propia o de su familia.» Si contrata directamente a autónomos sin que estos sean empresarios, «no es obligado elaborar el plan de seguridad y salud en el trabajo correspondiente a las partes de la obra ejecutadas por estos trabajadores».

**INTERPRETACIÓN.** Esto toca al **plan**, no al **estudio**. El art. 4 no tiene excepción para el cabeza de familia, así que el EBSS se sigue exigiendo en todo proyecto (y el art. 17.1 lo pide para visado y licencia).

**Guía sobre el coordinador en proyecto** (folio 26, PDF p. 25, cotejado en texto): «En el supuesto de intervención de varios proyectistas durante la elaboración del proyecto de la obra, resulta necesario que el promotor designe un coordinador […]. En este caso, ese coordinador será el responsable de la elaboración del estudio de seguridad y salud.»

**Consecuencia para la app.** Pregunta nueva, solo en vivienda: «¿el promotor es una persona que reforma su propia vivienda y contrata directamente a autónomos?». Con «sí», el EBSS dice que en esas partes el promotor no es contratista (art. 2.3) y, según la Guía, no hay plan para ellas. El EBSS se redacta igual.

---

## K-SYS.12 — Catálogo de riesgos: fuente oficial y estructura

**Cotejo.**
- [RD1627] anexo I (p. 13) y anexo IV (pp. 14–22), **VERIFICADO (texto)**: títulos de las partes A, B y C y de sus apartados, y C.3, C.12 a) y b). Coinciden. El anexo I lleva letras a) a m), que la lista anterior omitía.
- [GT-Obras], **LEÍDO (comentario), cotejado en texto**: los siete apéndices coinciden con la lista anterior (índice, PDF pp. 8–9; apéndice 4 en folios 121–125, PDF pp. 120–124).

**Confirmado: la Guía no trae catálogo de riesgos por fases.** Ni el apéndice 4 ni el resto del documento tienen listas de riesgos tipo: los términos «caída de personas» o «atrapamiento» aparecen dos veces en toda la Guía. **Antes SIN CONFIRMAR, ahora LEÍDO (comentario), cotejado en texto.** La Guía da orientaciones de método:
- (folio 122, PDF p. 121) «en el estudio de SS se deben contemplar cada una de las actividades u operaciones de forma independiente prestando especial atención a los equipos, medios auxiliares, materiales y elementos utilizados o presentes en la obra», y considerar «la posible concurrencia de actividades que pueda darse en cada una de las fases de ejecución de la obra»;
- (folio 26, PDF p. 25, comentario al art. 5.2 a) la memoria parte del «Conjunto de unidades de obra descritas según los métodos y sistemas de ejecución previstos en el proyecto», el «Orden cronológico de ejecución de la obra» y la «Localización en el centro de trabajo de las unidades de obra a ejecutar»;
- (folio 27, PDF p. 26) no hace falta identificar los riesgos que el propio proyecto ha evitado, y los riesgos de los equipos se identifican «en relación con el entorno de la obra», «para evitar así la redacción de listados genéricos que carecen de utilidad preventiva».

**Consecuencia de la frase anterior. INTERPRETACIÓN, importante para el diseño del catálogo:** el catálogo de la app debe proponer riesgos **ligados a las fases y unidades que tiene esta obra**, no un listado genérico. Es lo que ya prevé §5.8 (la app propone desde los módulos y lo intervenido, y el proyectista marca o quita).

**Referencia para demoliciones.** [GT-Obras] folio 104 (PDF p. 103), cotejado en texto: «se puede tomar como referencia lo especificado en la Norma Tecnológica de la Edificación NTE-ADD/1975 (Acondicionamiento del terreno. Desmontes. Demoliciones)». La NTE no se ha leído. Para excavaciones, la Guía cita las NTE-ADV/1976, NTE-ADZ/1976 (zanjas y pozos), NTE-ASD/1977, NTE-ADE/1977, NTE-CCT/1977 y NTE-ADG/1983 (folio 102, PDF p. 101), con la nota 58: «tienen un carácter no vinculante». No leídas.

**Modelo CNSST 2011**: sigue **SIN CONFIRMAR**. La correspondencia fases → anexo IV / anexo II sigue como **INTERPRETACIÓN**, sin cambios.

---

## K-SYS.13 — Terminología de los riesgos

**CORREGIDO por K-SYS.15.** La versión anterior fijaba «los 22 nombres de la NTP 908». La NTP 908 es «Residuos sólidos urbanos. Riesgos laborales en plantas de tratamiento de frigoríficos (I)»: su tabla 1 es la lista de riesgos de esa planta, no una terminología. La Guía no fija nombres (K-SYS.12). Los nombres que mandan y sus claves están en **K-SYS.15**.

---

## K-SYS.14 — Trabajos posteriores (art. 6.3)

**Cotejo.** [RD1627] arts. 5.6, 6.3 y 8.2, pp. 6–8, **VERIFICADO (texto)**. Comentario de la Guía al 5.6, al que remite el del 6.3: folios 32–33 (PDF pp. 31–32), **LEÍDO (comentario), cotejado en texto**.

**Definiciones de la Guía:**
- «"trabajos posteriores": los de reparación, conservación y mantenimiento de la totalidad de la obra en sí misma, o de parte de ella, y de sus instalaciones una vez entregada esta (sustitución de material de cubierta, luminarias, limpieza de canalones, bajantes, muros cortina, lucernarios, mantenimiento de instalaciones, desbroces, cunetas, biondas etc.).»
- «"previsiones": los elementos de seguridad y salud (pasarelas, plataformas, barandillas, puntos de anclaje, etc.) cuya finalidad es evitar el daño o minimizar sus consecuencias.»
- «"informaciones útiles": todas aquellas relativas a la construcción que puedan ser relevantes para la ejecución de los previsibles trabajos posteriores (instrucciones de uso y mantenimiento de los equipos e instalaciones, cargas máximas sobre los elementos constructivos, localización de conducciones, etc.).»

**Cubiertas.** El proyectista incluirá los requisitos, dispositivos y sistemas relacionados con:
- «el acceso a la cubierta»;
- «la resistencia de la cubierta y de sus componentes traslúcidos»;
- «las zonas de tránsito»;
- «la señalización de las zonas frágiles»;
- «los elementos indispensables para la instalación de las protecciones necesarias, priorizando las protecciones colectivas frente a las individuales».

**DB SUA.** La Guía recoge que el personal de mantenimiento «no se considera usuario del edificio» a efectos del DB SUA (comentario del DB SUA de 29-06-2018), así que esos elementos cumplen la normativa de seguridad en el trabajo.

**Destino.** «todas estas previsiones e informaciones para efectuar los trabajos posteriores deberán quedar en poder del promotor, con el fin de que este proceda a su posterior traslado al futuro usuario o usuarios de la obra». En edificación van al **Libro del Edificio** (art. 7 de la LOE).

**Consecuencia para la app (actualizada).** El apartado se divide en «Previsiones» (elementos) e «Informaciones útiles» (datos), con las definiciones de la Guía. La app propone:
- en cubierta, los cinco puntos de la Guía, según el tipo de cubierta del proyecto;
- información útil desde los módulos: equipos de HE 4/HE 5/HS 3 en cubierta, bajantes y arquetas de HS 5, conducciones.

Frase final: «Estas previsiones e informaciones quedan en poder del promotor para su traslado al Libro del Edificio.»

---

## Para la app (fase 8)

*(Actualizada el 2026-10-16 con K-SYS.15–20.)*

### Se codifica (con su cita)

| Qué | Regla | Cita | Veredicto |
|---|---|---|---|
| ¿Estudio completo o básico? | Completo si `PEC ≥ 450.759,08` **o** (`días laborables > 30` **y** `simultáneos > 20`) **o** `jornadas > 500` **o** túneles, galerías, conducciones subterráneas (no a cielo abierto, con trabajadores dentro) o presas. Si no, básico. Si sale completo, la app lo dice y **no** lo redacta | RD 1627/1997 art. 4.1–4.2 (p. 5); Guía folios 24–25 | **VERIFICADO (texto)** + Guía cotejada |
| PEC | `PEC = (PEM + GG + BI) × (1 + IVA)`, con GG, BI e IVA declarados por el proyectista (o el PEC del resumen de presupuesto) | Guía folio 24 (PDF p. 23) | LEÍDO (comentario), cotejado en texto |
| Jornadas | Σ Tᵢ × Dᵢ por periodos de plantilla constante; 1 día = jornada de 8 h; todos los trabajadores, también autónomos y subcontratas. Atajo: si días × simultáneos ≤ 500, c) descartado | Guía folio 25 (PDF p. 24) | LEÍDO (comentario), cotejado; la expresión Σ, cotejada en imagen |
| Justificación del básico | Tabla «Supuesto \| Umbral \| Proyecto \| ¿Se supera?» al principio del EBSS | Guía folio 25 | LEÍDO (comentario), cotejado en texto |
| Estructura del documento | Justificación · normas aplicables · riesgos evitables · riesgos no eliminables (medidas, protecciones, eficacia) · otras actividades · anexo II · servicios higiénicos · amianto · trabajos posteriores. Descriptivo, sin presupuesto; planos opcionales | RD art. 6 (pp. 6–7); Guía folio 34 | **VERIFICADO (texto)** + Guía cotejada |
| Quién y cuándo | Técnico competente designado por el promotor, o el coordinador en proyecto; en la redacción del proyecto; anejo a la memoria; requisito de visado y licencia | RD arts. 4.2, 6.1, 17.1 (pp. 5–6, 11); CTE Parte I Anejo I | **VERIFICADO (texto)**; CTE LEÍDO (web) |
| Anexo II | Lista literal de los 10 apartados; avisos automáticos (amianto → 2; cubierta, fachada, huecos, excavación → 1; AT → 4; prefabricados pesados → 10). **Recurso preventivo preceptivo** si se marca alguno | RD anexo II (p. 13); DA única (p. 11); Guía folio 32 | **VERIFICADO (texto)**; la asignación es INTERPRETACIÓN |
| Servicios higiénicos | **Obligatorio:** retretes ⌈n/25⌉, lavabos ⌈n/10⌉, duchas ⌈n/10⌉ si actividad o salubridad lo requieren; vestuarios (climatizados, taquilla doble) si hay ropa especial o trabajos sucios; separación por sexos. **Recomendado (Guía):** vestuarios, duchas y lavabos en todas las obras; retretes ⌈H/25⌉ + ⌈M/15⌉ y urinarios ⌈H/25⌉ si se conoce el reparto. Alternativas en obras de corta duración o escasa importancia. Agua potable e instalaciones para comer (A.19) | **VII CGSC arts. 231–233** (págs. 129148–129149); RD anexo IV A.14–16 y 19 (pp. 16–18); Guía folios 79–80 | **VERIFICADO (texto)** + Guía cotejada |
| Primeros auxilios y botiquín | Texto del RD anexo IV A.14 a) y d) y del convenio art. 234: personal con conocimientos en primeros auxilios en **todas** las obras; material de primeros auxilios señalizado y de fácil acceso; **local de primeros auxilios si n > 50**; información visible del centro sanitario más próximo, el recorrido y los teléfonos. Revisión y reposición del material, como criterio de la Guía. **Sin la Orden TAS/2947/2007 en las normas aplicables** | RD anexo IV A.14 (p. 16); VII CGSC art. 234 (págs. 129149–129150); Guía folio 78 | **VERIFICADO (texto)** + Guía cotejada (K-SYS.19) |
| Medidas con cifra (caídas y equipos) | Barandilla ≥ 90 cm con reborde (= rodapié), pasamanos y protección intermedia para caídas > 2 m. Escalera de mano: sobresalir ≥ 1 m del plano al que se accede; ángulo aproximado de 75°; anticaídas o alternativa a más de 3,5 m con movimientos o esfuerzos peligrosos; prohibidas las de resistencia sin garantías (en particular, más de 5 m) y las improvisadas; nunca dos personas a la vez. Andamio: plan de montaje, utilización y desmontaje si altura > 6 m o vanos > 8 m (salvo borriquetas), > 24 m sobre azoteas o cubiertas, torres móviles > 6 m, plataformas suspendidas o sobre mástil; con marcado CE, instrucciones del fabricante | RD 1627 anexo IV C.3 a) (p. 19); RD 1215/1997 anexo II 4.2.2–4.2.4 (p. 15) y 4.3.3 (pp. 15–16); Guía folio 91 | **VERIFICADO (texto)** (K-SYS.16) |
| Instalación eléctrica provisional | Bases de toma de corriente con diferencial ≤ 30 mA (o MBTS o separación por transformador). En esquema TT, tensión límite convencional 24 V: **RA × Ia ≤ 24 V** (RA ≤ 800 Ω con 30 mA; ≤ 80 Ω con 300 mA). Elementos a la intemperie IP45 como mínimo. Cables de acometida y exteriores 450/750 V con cubierta de policloropreno o similar, aptos para servicios móviles; interiores 300/500 V. Cables fuera de pasos de peatones y vehículos o con protección especial. Cuadro general con los dispositivos de protección principales; seccionamiento bloqueable por sector | ITC-BT-33 aps. 4.2, 5.1–5.3, 6.1 (pp. 217–218); ITC-BT-24 4.1.2 (p. 159); ITC-BT-18 ap. 9 (p. 125) | **VERIFICADO (texto)**; el cálculo de RA, INTERPRETACIÓN (aritmética) |
| Líneas eléctricas próximas | Desviar o dejar sin tensión; si no, barreras, avisos, señalización y gálibo (RD 1627 C.10 c). No invadir la zona de peligro; delimitación según la tabla 1 del anexo I del RD 614/2001 y su anexo V. Con la tensión declarada, la app da DPEL y DPROX-2 de la tabla (interpolación lineal) | RD 1627 anexo IV C.10 c) (p. 21); RD 614/2001 anexo I tabla 1 (p. 7), anexo V B.2 (p. 15); Guía folios 102–103 | **VERIFICADO (texto)**; la tabla, cotejar en imagen antes de codificarla |
| Ruido y vibraciones | Ruido (LAeq,d): 80 dB(A) → protectores a disposición; 85 dB(A) → uso obligatorio y señalización; 87 dB(A) valor límite. Vibraciones (A(8)): mano-brazo 2,5 / 5 m/s²; cuerpo entero 0,5 / 1,15 m/s². Los evalúa la empresa | RD 286/2006 arts. 4.3, 5.1, 7.1 (pp. 5–7); RD 1311/2005 art. 3 (p. 5) | **VERIFICADO (texto)** |
| Viento | «Viento fuerte» y condiciones meteorológicas en general, sin cifra. Grúa torre: 72 km/h como máximo o el del fabricante si es menor; anemómetro con aviso a 50 y 70 km/h. Grúa móvil y plataformas: límite del fabricante | RD 1215 anexo II 4.1.6 (p. 14); RD 1627 C.4 (p. 20); RD 836/2003 ITC MIE-AEM-2 ap. 5.4 (pp. 9–10) y anexo IV (pp. 24–25) | **VERIFICADO (texto)** |
| Coordinadores | Proyecto: si hay varios proyectistas (también parciales); entonces el coordinador redacta el estudio. Ejecución: si hay más de una empresa, o empresa y autónomos | RD arts. 2.1 d, 3 (pp. 4–5); Guía folio 26 | **VERIFICADO (texto)** + INTERPRETACIÓN |
| Cabeza de familia | Pregunta en vivienda; texto del art. 2.3; el EBSS se mantiene | RD art. 2.3 (p. 5); Guía folio 22 | **VERIFICADO (texto)** + Guía cotejada |
| Obligaciones durante la obra | Plan de cada contratista, aprobado por el coordinador o la DF antes del inicio; **comunicación de apertura del contratista, previa al comienzo, expuesta en la obra en lugar visible, actualizada (10 días) y acompañada del plan aprobado**; el promotor facilita los datos y responde también; plan a disposición de la ITSS; libro de incidencias (Colegio; copia a la ITSS solo en los casos del 13.4); libro de subcontratación; recursos preventivos | RD arts. 7, 9, 13, 19, DA única (pp. 7–12); **Orden TIN/1071/2010 arts. 2.2, 3.5 y 5.2** (págs. 38788–38790); Ley 32/2006 art. 8 | **VERIFICADO (texto)**; Ley 32 LEÍDO (web) |
| Normas aplicables | Lista cerrada de K-SYS.17, por número y título exacto; las de grúas, solo si la obra las tiene | Cabeceras de los consolidados del BOE | **VERIFICADO (texto)** (K-SYS.17) |
| Amianto | **Apartado obligatorio** en demolición o mantenimiento de edificio existente: identificación (no / posible / identificado; ubicación; friable o no). Si posible o identificado: RERA, plan de trabajo aprobado antes del inicio (45 días, silencio positivo), retirada antes de demoler, comprobación del plan por quien contrate, anexo II.2, residuos peligrosos. Sin valores límite. RD 396/2006 vigente a 2026-10-16 | RD 396/2006 arts. 3, 10.2, 11, 12, 17 (pp. 5–12); Guía folio 28 | **VERIFICADO (texto)**; estado, K-SYS.18 |
| Trabajos posteriores | Previsiones e informaciones útiles con las definiciones de la Guía; los cinco puntos de cubierta; destino: promotor y Libro del Edificio | RD arts. 5.6, 6.3, 8.2; Guía folios 32–33 | **VERIFICADO (texto)** + Guía cotejada |
| Fases | Lista de §5.8 con la correspondencia al anexo IV parte C y al anexo II. Riesgos ligados a las fases y unidades de **esta** obra, no listados genéricos | RD anexos I y IV (pp. 13–22); Guía folios 26–27 y 122 | Títulos VERIFICADO (texto); correspondencia INTERPRETACIÓN |
| Nombres de riesgos | **Las 28 claves de K-SYS.15** (formas de accidente del método general del INSST y exposiciones con el nombre de su real decreto). **CORREGIDO**: ya no «los 22 nombres de la NTP 908» | Método general de evaluación del INSST; títulos de RD 286/2006, RD 374/2001, RD 396/2006 | INTERPRETACIÓN (no hay terminología reglamentaria) |
| Prohibido en plantilla | «aviso previo», «anexo III», «copia a la Inspección de toda anotación», ratios atribuidas al RD 1627 o al RD 486/1997, valores límite de amianto, la excepción del art. 3.2 del RD 396 dada por hecha. **Nuevo:** resistencias de tierra fijas en ohmios (2, 20, 37 Ω…); «300 mA en fuerza» como regla general; los 25 kg atribuidos al RD 487/1997; la Orden TAS/2947/2007 o el RD 486/1997 como base del botiquín de la obra; «escaleras de 5 m como máximo»; distancias a líneas de «3, 5 y 6 m» o con corte en 50 kV | RD arts. 13.4 y 18; RD 396 arts. 3.2 y 4.1; K-SYS.16 y K-SYS.19 | CORREGIDO |
| Excepción del test de prohibidos | El RD 1627 anexo IV C.3 b) dice literalmente «cinturones de seguridad con anclaje». Si el estudio cita ese literal, el test lo admite solo dentro de la cita; en el resto del texto se escribe «equipo de protección individual anticaídas» o «arnés anticaídas» | RD 1627 anexo IV C.3 b) (p. 20) | **VERIFICADO (texto)** |

### Se pide al proyectista (principio 4: no se supone)

- **PEM y % de GG, BI e IVA**, o directamente el PEC del resumen de presupuesto.
- **Plazo en días laborables**, **máximo de trabajadores simultáneos** y, solo si días × simultáneos > 500, **jornadas** (o la tablita de periodos).
- ¿Trabajos con personas dentro de conducciones enterradas que no son a cielo abierto? ¿Túneles, galerías o presas?
- ¿Otros proyectistas con proyectos parciales? ¿Más de una empresa o autónomos en ejecución?
- En vivienda: ¿el promotor es una persona que reforma su propia vivienda y contrata directamente a autónomos?
- **Amianto** (obligatorio en demolición o mantenimiento de edificio existente): no se ha identificado / posible / identificado, con ubicación y tipo si se conoce.
- ¿Líneas de alta tensión próximas? **Si las hay, su tensión nominal en kV** (para la distancia de la tabla 1 del RD 614/2001). ¿Prefabricados pesados? ¿Excavaciones con riesgo de sepultamiento?
- **¿Grúa torre o grúa móvil?** (normas aplicables y límite de viento).
- Servicios: ¿obra de corta duración o de escasa importancia (soluciones alternativas)? Reparto hombres / mujeres (opcional, para la dotación de la Guía).
- ¿La obra se hace con el edificio o el local en uso (otras actividades, art. 6.2)?
- Marcar o quitar fases, riesgos y medidas que proponga el catálogo; lo que añada se guarda en local (como «Mis normas»).
- Tipo de andamio (la app avisa por altura).
- Previsiones e informaciones útiles para trabajos posteriores que proponga la app.

### Queda SIN CONFIRMAR (no se codifica)

1. ~~Fórmula del PEC en la Guía~~ → **VERIFICADA** en el cotejo (folio 24).
2. ~~Expresión gráfica de la fórmula de jornadas~~ → **cotejada en imagen** el 2026-10-16: Σᵢ₌₁ⁿ Tᵢ × Dᵢ > 500 (Guía, folio 25).
3. **Modelo de estudio de la CNSST de 2011** (fichas por fase): sin copia. *(Apéndice 4 de la Guía: leído; no trae catálogo.)*
4. **Cifras de la Directiva (UE) 2023/2668** y contenido del proyecto de RD de amianto. **Publicación del nuevo RD: no consta a 2026-10-16** (K-SYS.18). Volver a comprobarlo en el BOE en el paso 7 de feature-35, antes de cerrarla; si se ha publicado, sustituir las citas del RD 396/2006 (artículos, plazo de 45 días y silencio positivo incluidos).
5. **Año de la prohibición general del amianto** (referencia para el aviso suave): no leído; no se imprime.
6. ~~Orden TIN/1071/2010~~ → **VERIFICADA (texto)** (K-SYS.20).
7. **RD 1109/2007** (articulado: libro de subcontratación, REA) y **RDL 5/2000 art. 12.24** (infracción por falta de contenido del estudio): solo la cabecera del RD 1109/2007 está cotejada.
8. ~~Ediciones de las normas específicas de la lista del 6.2~~ → **cabeceras VERIFICADAS (texto)** (K-SYS.17). Siguen sin leer y sin entrar en la lista: RD 664/1997 (agentes biológicos), RD 665/1997 (cancerígenos; sílice cristalina respirable) y RD 1644/2008 (máquinas).
9. **Ordenanza General de 1971 y Ordenanza Laboral de la Construcción de 1970**: no se citan.
10. ~~Nombres de riesgo adicionales fuera de los 22 de la NTP 908~~ → resuelto en K-SYS.15 (la NTP 908 no era la fuente). La lista original del método general del INSST (con sus códigos) solo se ha leído en fuentes secundarias.
11. **NTE-ADD/1975** (demoliciones) y **NTE-ADZ/1976** (zanjas y pozos), referencias no vinculantes de la Guía: no leídas. De ahí salen probablemente las cifras de entibación de los ejemplos; **no se imprimen**.
12. **Guía técnica del INSST de manipulación manual de cargas** (los 25 kg): solo en fuentes secundarias. **UNE-EN 13374** (barandillas provisionales), **UNE-EN 12810/12811** (andamios) y **UNE-EN 60439-4** (conjuntos de obra): no leídas.
13. **Sigue LEÍDO (web)**: RD 486/1997, el articulado de RD 171/2004, Ley 31/1995 y Ley 32/2006, Orden TAS/2926/2002, CTE Parte I, el «Análisis» del BOE del RD 1627 y la Resolución de 27-08-2008. Cotejar antes de imprimir sus literales.
14. ~~**Tabla 1 del RD 614/2001 en imagen**~~ → cotejada el 2026-10-16 (PyMuPDF): VERIFICADO (imagen).

### Fuentes consultadas

- [RD 1627/1997, consolidado (BOE-A-1997-22614)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-22614) y [su análisis](https://www.boe.es/buscar/doc.php?id=BOE-A-1997-22614); PDF consolidado en `…\scratchpad\fase8\pdf\BOE-A-1997-22614.pdf`
- [VII Convenio General del Sector de la Construcción (BOE-A-2023-19903)](https://www.boe.es/buscar/doc.php?id=BOE-A-2023-19903); PDF en `…\fase8\pdf\BOE-A-2023-19903.pdf`
- [RD 396/2006 (BOE-A-2006-6474)](https://www.boe.es/buscar/act.php?id=BOE-A-2006-6474) y [su análisis](https://www.boe.es/buscar/doc.php?id=BOE-A-2006-6474); PDF en `…\fase8\pdf\BOE-A-2006-6474.pdf`
- [INSST, Guía técnica de obras de construcción, 2019 (ficha)](https://www.insst.es/documentacion/catalogo-de-publicaciones/guia-tecnica-para-la-evaluacion-y-prevencion-de-los-riesgos-relativos-a-las-obras-de-construccion-ano-2019); PDF en `…\fase8\pdf\guia-insst-2019.pdf`
- [RD 486/1997 (BOE-A-1997-8669)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-8669)
- [RD 1215/1997 (BOE-A-1997-17824)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-17824); PDF en `…\fase8\pdf\BOE-A-1997-17824.pdf`
- [RD 614/2001 (BOE-A-2001-11881)](https://www.boe.es/buscar/act.php?id=BOE-A-2001-11881), [RD 286/2006 (BOE-A-2006-4414)](https://www.boe.es/buscar/act.php?id=BOE-A-2006-4414), [RD 1311/2005 (BOE-A-2005-18262)](https://www.boe.es/buscar/act.php?id=BOE-A-2005-18262), [RD 487/1997 (BOE-A-1997-8670)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-8670), [RD 485/1997 (BOE-A-1997-8668)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-8668), [RD 773/1997 (BOE-A-1997-12735)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-12735), [RD 39/1997 (BOE-A-1997-1853)](https://www.boe.es/buscar/act.php?id=BOE-A-1997-1853), [RD 374/2001 (BOE-A-2001-8436)](https://www.boe.es/buscar/act.php?id=BOE-A-2001-8436), [RD 1109/2007 (BOE-A-2007-15766)](https://www.boe.es/buscar/act.php?id=BOE-A-2007-15766); PDF consolidados en `…\fase8\pdf\`
- [RD 842/2002, REBT (BOE-A-2002-18099)](https://www.boe.es/buscar/act.php?id=BOE-A-2002-18099); PDF consolidado con las ITC en `…\fase8\pdf\BOE-A-2002-18099.pdf`
- [RD 836/2003 (BOE-A-2003-14326)](https://www.boe.es/buscar/act.php?id=BOE-A-2003-14326) y [RD 837/2003 (BOE-A-2003-14327)](https://www.boe.es/buscar/act.php?id=BOE-A-2003-14327)
- [Orden TIN/1071/2010 (BOE-A-2010-6871)](https://www.boe.es/buscar/doc.php?id=BOE-A-2010-6871); PDF en `…\fase8\pdf\BOE-A-2010-6871.pdf`
- [Orden TAS/2947/2007 (BOE-A-2007-17835)](https://www.boe.es/buscar/doc.php?id=BOE-A-2007-17835); PDF en `…\fase8\pdf\BOE-A-2007-17835.pdf`
- [Resolución de 27-08-2008 de la SESS (BOE-A-2008-14778)](https://www.boe.es/buscar/doc.php?id=BOE-A-2008-14778)
- [RD 171/2004 (BOE-A-2004-1848)](https://www.boe.es/buscar/act.php?id=BOE-A-2004-1848)
- [Ley 31/1995 (BOE-A-1995-24292)](https://www.boe.es/buscar/act.php?id=BOE-A-1995-24292)
- [Ley 32/2006 (BOE-A-2006-18205)](https://www.boe.es/buscar/act.php?id=BOE-A-2006-18205)
- [Orden TAS/2926/2002 (BOE-A-2002-22650)](https://www.boe.es/buscar/act.php?id=BOE-A-2002-22650)
- [CTE Parte I, RD 314/2006 (BOE-A-2006-5515)](https://www.boe.es/buscar/act.php?id=BOE-A-2006-5515)
- [INSST, FAQ lugares de trabajo](https://www.insst.es/materias/riesgos/seguridad-en-el-trabajo/lugares-trabajo/faq)
- [INSST, NTP 1071](https://www.insst.es/documentacion/colecciones-tecnicas/ntp-notas-tecnicas-de-prevencion/31-serie-ntp-numeros-1066-a-1101-ano-2016/ntp-1.071-gestion-de-la-seguridad-y-salud-en-obras-sin-proyecto-i-en-un-centro-de-trabajo-con-distinta-actividad)
- [INSST, NTP 908](https://www.insst.es/documentacion/colecciones-tecnicas/ntp-notas-tecnicas-de-prevencion/26-serie-ntp-numeros-891-a-925-ano-2011/nota-tecnica-de-prevencion-ntp-908)
- [Universitat de València, método general de evaluación (lista de riesgos del INSHT, adaptada)](https://www.uv.es/emergencias-uv/es/salud-prevencion/unidades/unidad-seguridad-trabajo/evaluaciones/metodo-general.html) (fuente secundaria)
- [CNSST, Grupo de trabajo de Construcción](https://www.insst.es/cnsst/grupos-de-trabajo/en-funcionamiento/construccion)
- Estado del proyecto de RD de amianto (fuentes secundarias): [Adpreven](https://www.adpreven.es/noticias/nueva-normativa-amianto-real-decreto-2026/), [Noticias Obreras, marzo 2026](https://noticiasobreras.es/2026/03/trabajo-ultima-un-real-decreto-con-nuevas-exigencias-de-seguridad-frente-al-amianto-tras-el-toque-de-atencion-de-bruselas/), [proyecto en mites.gob.es](https://expinterweb.mites.gob.es/participa/listado/download/6e963260-dc39-4eb2-8ecd-94a68133efab), [UGT, plazo de transposición vencido](https://www.ugt.es/el-gobierno-debe-trasponer-la-directiva-europea-que-protege-contra-los-riesgos-del-amianto), [EUR-Lex, Directiva 2023/2668](https://eur-lex.europa.eu/legal-content/ES/ALL/?uri=CELEX:32023L2668)
- Guía de manipulación manual de cargas, cifras en fuente secundaria: [JCCM, FAT-PRL-MMC](https://seguridadlaboral.castillalamancha.es/sites/default/files/2025-03/FAT-PRL-MMC.pdf)

---

# Revisión 2026-10-16 — Paso 0 de feature-35 (K-SYS.15 a K-SYS.20)

Lo que dejaron abierto K-SYS.1–14 y el análisis de los ejemplos (`analisis-ejemplos-ebss.md` §3, §4.2, §4.9 y §6). El punto 6 del paso 0 (marcas SÍ/NO de ss03 y ss04 en imagen) no se hace aquí.

---

## K-SYS.15 — Nombres de riesgo: qué lista manda y sus claves

**Pregunta.** La lista del análisis §4.2 (28 claves, formas de accidente del método general del INSST) frente a los 22 nombres de la NTP 908 que fijaba K-SYS.13, y la Guía 2019 si trae alguna.

**Respuesta.** Manda **la lista del análisis §4.2**, con cinco nombres ajustados. La NTP 908 no es una fuente de terminología y la Guía no trae ninguna lista.

**1. La NTP 908. CORREGIDO.** [NTP908], LEÍDO (comentario), insst.es (HTML; el PDF no se pudo bajar, insst.es devuelve HTML): su título es «NTP 908: Residuos sólidos urbanos. Riesgos laborales en plantas de tratamiento de frigoríficos (I)» (2011). Su tabla 1, «Principales riesgos laborales identificados en una planta de tratamiento de residuos de frigoríficos», trae 24 entradas sin código, unos 22 nombres distintos. Es una evaluación de una actividad concreta que usa, con variantes, los mismos nombres del método general del INSST: «Caída de objetos por derrumbe o desplome», «Golpes / cortes por objetos o herramientas», «Atropellos, golpes y choques con o contra vehículos», «Contactos eléctricos», «Exposición a agentes químicos (polvo)»… No aporta nada que no esté en la lista del análisis, y no es la fuente que hay que citar.

**2. La Guía 2019.** LEÍDO (comentario), cotejado en texto: no trae lista de riesgos (K-SYS.12).

**3. El método general del INSST.** La lista de «formas de accidente» que usan los ejemplos (ss07 §6 la trae entera con 25 entradas, incluidas «Patologías no traumáticas» e «In itínere», que no son riesgos de obra) es la del método general de evaluación del antiguo INSHT. El documento original del INSST con los códigos (010 Caída de personas a distinto nivel, 020 al mismo nivel…) **no se ha leído en fuente oficial**; solo en fuentes secundarias (por ejemplo, la Universitat de València, que la publica adaptada con 29 entradas). La Orden TAS/2926/2002 (Delt@) usa otra clasificación, la «forma-contacto», que describe el accidente ocurrido y no sirve para un estudio. **No hay terminología reglamentaria de riesgos.** → **INTERPRETACIÓN**: se adopta la lista del análisis, que coincide con el método general y con las tablas de las NTP.

**4. Ajustes de nombre (INTERPRETACIÓN).** Cinco nombres del análisis se cambian para que coincidan con el método general o con el título del real decreto que regula la exposición (títulos VERIFICADO (texto), K-SYS.17). Las claves no cambian.

| Clave | Análisis §4.2 | Nombre que manda | Motivo |
|---|---|---|---|
| `electrico` | Exposición a contactos eléctricos | **Contactos eléctricos** | Nombre del método general y de la NTP 908; «directos» o «indirectos» van como causa |
| `quimicos` | Exposición a contaminantes químicos | **Exposición a agentes químicos** | Título del RD 374/2001 («agentes químicos») |
| `biologicos` | Exposición a contaminantes biológicos | **Exposición a agentes biológicos** | Terminología del RD 664/1997 (título no cotejado) |
| `ruido` | Exposición a ruido | **Exposición al ruido** | Título del RD 286/2006 («exposición al ruido») |
| `amianto` | Exposición a amianto | **Exposición al amianto** | Título del RD 396/2006 («riesgo de exposición al amianto») |

**5. Lista que manda (28 claves, minúsculas y sin acentos).** Para `src/lib/ebss/catalogo.ts`, con metadatos `fuente: "INSST, método general de evaluación (formas de accidente); exposiciones según RD 286/2006, RD 1311/2005, RD 374/2001, RD 396/2006"`, `veredicto: "INTERPRETACIÓN"`, `fecha: "2026-10-16"`:

| Clave | Nombre literal |
|---|---|
| `distinto` | Caída de personas a distinto nivel |
| `mismo` | Caída de personas al mismo nivel |
| `desplome` | Caída de objetos por desplome o derrumbamiento |
| `manipulacion` | Caída de objetos en manipulación |
| `desprendidos` | Caída de objetos desprendidos |
| `pisadas` | Pisadas sobre objetos |
| `choque-inmoviles` | Choques contra objetos inmóviles |
| `choque-moviles` | Choques contra objetos móviles |
| `golpes` | Golpes o cortes por objetos o herramientas |
| `proyeccion` | Proyección de fragmentos o partículas |
| `atrapamiento` | Atrapamiento por o entre objetos |
| `vuelco` | Atrapamiento por vuelco de máquinas o vehículos |
| `sobreesfuerzos` | Sobreesfuerzos |
| `temperaturas` | Exposición a temperaturas ambientales extremas |
| `termicos` | Contactos térmicos |
| `electrico` | Contactos eléctricos |
| `nocivas` | Exposición a sustancias nocivas o tóxicas |
| `causticas` | Contactos con sustancias cáusticas o corrosivas |
| `radiaciones` | Exposición a radiaciones |
| `explosiones` | Explosiones |
| `incendios` | Incendios |
| `seres-vivos` | Accidentes causados por seres vivos |
| `atropellos` | Atropellos o golpes con vehículos |
| `quimicos` | Exposición a agentes químicos |
| `biologicos` | Exposición a agentes biológicos |
| `ruido` | Exposición al ruido |
| `vibraciones` | Exposición a vibraciones |
| `amianto` | Exposición al amianto |

Se mantiene lo del análisis: viento, iluminación deficiente, inundación, derrames, interferencias con servicios, daños a terceros o fallo de anclaje **no son riesgos, son causas**. «Patologías no traumáticas» e «In itínere» (ss07) no entran. `nocivas` (intoxicación aguda, atmósfera pobre en oxígeno) y `quimicos` (exposición higiénica: polvo, sílice, humos) se mantienen separados, como en la NTP 908.

---

## K-SYS.16 — Cifras en conflicto (análisis §4.9)

**Pregunta.** Para cada una de las 19 filas del §4.9, qué dice la norma (literal y página) o «la norma no fija cifra».

**Literales base**, todos **VERIFICADO (texto)**:

*Instalación eléctrica provisional.*
- [REBT] **ITC-BT-33, ap. 4.2** (p. 217): «Cuando la protección de las personas contra los contactos indirectos está asegurada por corte automático de la alimentación, según esquema de alimentación TT, la tensión límite convencional no debe ser superior a 24 V de valor eficaz en corriente alterna, ó 60 V en corriente continua.» / «Cada base o grupo de bases de toma de corriente deben estar protegidas por dispositivos diferenciales de corriente diferencial residual asignada igual como máximo a 30 mA; o bien alimentadas a muy baja tensión de seguridad MBTS; o bien protegidas por separación eléctrica de los circuitos mediante un transformador individual.»
- **ITC-BT-24, ap. 4.1.2** (p. 159), esquema TT: «Se cumplirá la siguiente condición: RA x Ia ≤ U», donde RA es «la suma de las resistencias de la toma de tierra y de los conductores de protección de masas», Ia, con diferencial, «la corriente diferencial-residual asignada», y U «la tensión de contacto límite convencional (50, 24V u otras, según los casos)».
- **ITC-BT-18, ap. 9** (p. 125): «Este valor de resistencia de tierra será tal que cualquier masa no pueda dar lugar a tensiones de contacto superiores a: – 24 V en local o emplazamiento conductor – 50 V en los demás casos.»
- **ITC-BT-33, ap. 5.1** (p. 217): elementos a la intemperie «deberán tener como mínimo un grado de protección IP45, según UNE 20.324». Conjuntos de aparamenta según «UNE-EN 60.439-4». **Ap. 5.3** (p. 218): cables de acometidas e instalaciones exteriores «de tensión asignada mínima 450/750V, con cubierta de policloropreno o similar, según UNE 21.027 ó UNE 21.150 y aptos para servicios móviles»; interiores, 300/500 V. **Ap. 5.2** (p. 217): los cables «no deben estar tendidos en pasos para peatones o vehículos. Si tal tendido es necesario, debe disponerse protección especial contra los daños mecánicos y contra contactos con elementos de la construcción.»

*Equipos de trabajo en altura.* [RD1215] anexo II:
- **4.2.2** (p. 15): «Las escaleras de mano para fines de acceso deberán tener la longitud necesaria para sobresalir al menos un metro del plano de trabajo al que se accede. […] Las escaleras de mano simples se colocarán, en la medida de lo posible, formando un ángulo aproximado de 75 grados con la horizontal.»
- **4.2.3** (p. 15): «Los trabajos a más de 3,5 metros de altura, desde el punto de operación al suelo, que requieran movimientos o esfuerzos peligrosos para la estabilidad del trabajador, sólo se efectuarán si se utiliza un equipo de protección individual anticaídas o se adoptan otras medidas de protección alternativas. […] Las escaleras de mano no se utilizarán por dos o más personas simultáneamente.»
- **4.2.4** (p. 15): «No se emplearán escaleras de mano y, en particular, escaleras de más de cinco metros de longitud, sobre cuya resistencia no se tengan garantías. Queda prohibido el uso de escaleras de mano de construcción improvisada.»
- **4.3.3** (pp. 15–16): el plan de montaje, de utilización y de desmontaje, y el cálculo, los hace «una persona con una formación universitaria que lo habilite». Es obligatorio en: «a) Plataformas suspendidas de nivel variable […] y plataformas elevadoras sobre mástil. b) Andamios constituidos con elementos prefabricados apoyados sobre terreno natural, soleras de hormigón, forjados, voladizos u otros elementos cuya altura, desde el nivel inferior de apoyo hasta la coronación de la andamiada, exceda de seis metros o dispongan de elementos horizontales que salven vuelos y distancias superiores entre apoyos de más de ocho metros. Se exceptúan los andamios de caballetes o borriquetas. c) Andamios instalados en el exterior, sobre azoteas, cúpulas, tejados o estructuras superiores cuya distancia entre el nivel de apoyo y el nivel del terreno o del suelo exceda de 24 metros de altura. d) Torres de acceso y torres de trabajo móviles en los que los trabajos se efectúen a más de seis metros de altura desde el punto de operación hasta el suelo.» Con marcado «CE», el plan «podrá ser sustituido por las instrucciones específicas del fabricante».
- **4.1.6** (p. 14): «Los trabajos temporales en altura sólo podrán efectuarse cuando las condiciones meteorológicas no pongan en peligro la salud y la seguridad de los trabajadores.»
- **4.3.7 y 4.3.8** (pp. 16–17): montaje dirigido por persona con formación universitaria o profesional habilitante; sin plan obligatorio, por persona con experiencia certificada de más de dos años y formación preventiva de nivel básico. Inspección antes de la puesta en servicio, periódicamente y tras cualquier modificación o periodo sin uso.

*Distancias a elementos en tensión.* [RD614] anexo I, **tabla 1** «Distancias límite de las zonas de trabajo» (p. 7), en cm, con interpolación lineal para tensiones intermedias. DPEL-1 con riesgo de sobretensión por rayo; DPEL-2 sin él; DPROX-1 cuando se puede delimitar con precisión la zona de trabajo; DPROX-2 cuando no:

| Un (kV) | DPEL-1 | DPEL-2 | DPROX-1 | DPROX-2 |
|---|---|---|---|---|
| ≤ 1 | 50 | 50 | 70 | 300 |
| 3 | 62 | 52 | 112 | 300 |
| 6 | 62 | 53 | 112 | 300 |
| 10 | 65 | 55 | 115 | 300 |
| 15 | 66 | 57 | 116 | 300 |
| 20 | 72 | 60 | 122 | 300 |
| 30 | 82 | 66 | 132 | 300 |
| 45 | 98 | 73 | 148 | 300 |
| 66 | 120 | 85 | 170 | 300 |
| 110 | 160 | 100 | 210 | 500 |
| 132 | 180 | 110 | 330 | 500 |
| 220 | 260 | 160 | 410 | 500 |
| 380 | 390 | 250 | 540 | 700 |

*(Transcrita del texto y **cotejada en imagen el 2026-10-16**, celda a celda: VERIFICADO (imagen).)* Para las obras, el **anexo V, B.2** (p. 15) remite a la parte A (delimitación e información) cuando las líneas no pueden desviarse ni dejarse sin tensión. La Guía (folios 102–103, PDF pp. 101–102, cotejado en texto) remite al RD 614/2001, anexos II y V, para el comentario del RD 1627 anexo IV C.10 c).

*Ruido y vibraciones.* [RD286] **art. 5.1** (p. 5): «a) Valores límite de exposición: LAeq,d = 87 dB(A) y Lpico= 140 dB (C), respectivamente; b) Valores superiores de exposición que dan lugar a una acción: LAeq,d = 85 dB(A) y Lpico = 137 dB (C), respectivamente; c) Valores inferiores de exposición que dan lugar a una acción: LAeq,d = 80 dB(A) y Lpico = 135 dB (C), respectivamente.» **Art. 7.1** (p. 7): por encima de los inferiores, protectores a disposición; igual o por encima de los superiores, se usan. **Art. 4.3** (p. 5): señalización por encima de los superiores. [RD1311] **art. 3** (p. 5): mano-brazo, límite 5 m/s² y acción 2,5 m/s²; cuerpo entero, límite 1,15 m/s² y acción 0,5 m/s² (exposición diaria normalizada a 8 h).

*Cargas.* [RD487], texto completo (pp. 1–5): **no fija ningún peso**. Su DF 1.ª (p. 3) encarga al INSST una Guía en la que «se considerarán los valores máximos de carga como referencia».

*Grúa torre.* [RD836] ITC MIE-AEM-2, **ap. 5.4** (pp. 9–10): el anemómetro «Deberá dar un aviso intermitente a la velocidad de viento de 50 km/h y continuo a 70 km/h». **Anexo IV** (manual de instrucciones), «Interrupción del trabajo» (p. 24): «En caso de vientos fuertes, o de tormenta eléctrica próxima, se interrumpirá el trabajo y se tomarán las medidas prescritas por el fabricante, dejando la grúa en veleta y cortando la corriente en el cuadro general de la obra»; «Recomendaciones generales» (p. 25): «La velocidad máxima del viento admitida para el trabajo con esta grúa será de 72 km/h, o la que indique el fabricante, si es menor.» [RD837] (grúas móviles): no fija velocidad de trabajo; remite al fabricante.

*RD 1627, anexo IV.* A.9 a) (p. 15): iluminación artificial «adecuada y suficiente»; C.4 (p. 20): proteger «contra las inclemencias atmosféricas»; C.9 b) 1.º y d) (p. 21): entibación, blindaje, apeo, taludes «u otras medidas adecuadas»; acopios y vehículos «alejados de las excavaciones». Ninguna cifra. La Guía (folio 99, PDF p. 98) remite al estudio geotécnico, y para la distancia de acopios y vehículos (folio 101, PDF p. 100): «un técnico competente establecerá, en función de las características del terreno y de la excavación, la distancia a la que se puedan situar tanto las distintas acumulaciones, como las vías de circulación de los vehículos». Sobre C.3 a) (folio 91, PDF p. 90): «El término "reborde de protección" se refiere al rodapié», y «Como referencia se puede consultar la norma UNE-EN 13374».

**Tabla de las 19 filas**

| # | Tema | Qué dice la norma | Veredicto | La app imprime |
|---|---|---|---|---|
| 1 | Resistencia de la toma de tierra provisional | **No fija un valor en ohmios.** Fija la tensión: RA × Ia ≤ 24 V en TT (ITC-BT-33 4.2, p. 217; ITC-BT-24 4.1.2, p. 159). De ahí, RA ≤ 800 Ω con 30 mA y RA ≤ 80 Ω con 300 mA (aritmética). Los 80 Ω y 800 Ω de los ejemplos salen de esa cuenta; los 2, 20 y 37 Ω no tienen base | VERIFICADO (texto); el valor, INTERPRETACIÓN | «La resistencia de tierra será tal que RA × Ia ≤ 24 V (ITC-BT-33, 4.2)». Si el proyectista declara la sensibilidad, el valor calculado. **Sin** 2, 20 ni 37 Ω |
| 2 | Sensibilidad de los diferenciales | **Toda base o grupo de bases ≤ 30 mA** (o MBTS o separación por transformador), sea de alumbrado o de fuerza (ITC-BT-33 4.2, p. 217). Los 300 mA no están en la ITC; solo caben en circuitos sin bases (alimentación a cuadros, selectividad), y entonces RA ≤ 80 Ω | VERIFICADO (texto). **CORREGIDO**: «300 mA en fuerza» no vale como regla | «Bases de toma de corriente protegidas por diferencial de 30 mA como máximo». 300 mA solo en la alimentación a cuadros, con la condición de la fila 1 |
| 3 | Profundidad desde la que se entiba | **Ninguna norma la fija.** RD 1627 C.9 b) 1.º (p. 21): «entibación, blindaje, apeo, taludes u otras medidas adecuadas»; Guía folio 99: según el estudio geotécnico. Las cifras de los ejemplos vienen probablemente de la NTE-ADZ/1976, no vinculante y no leída | VERIFICADO (texto) que no hay cifra | Sin cifra: «según el terreno y el estudio geotécnico» |
| 4 | Retén exterior y prohibición de trabajar solo | **Ninguna cifra.** La vigilancia desde el exterior solo es literal para la atmósfera confinada de alto riesgo (RD 1627 A.7 c, p. 15) | VERIFICADO (texto) que no hay cifra | Sin cifra; como medida, en pozos y zanjas profundas, «no trabajar solo, con vigilancia desde el exterior» |
| 5 | Acopio respecto al borde | **Ninguna cifra.** RD 1627 C.9 d) (p. 21); Guía folio 101: la distancia la fija un técnico competente según el terreno y la excavación; calzos o topes | VERIFICADO (texto) + Guía cotejada | Sin cifra, con la frase de la Guía |
| 6 | Vehículos respecto al borde | Ídem fila 5. Para los vehículos que excavan, el manual de instrucciones (Guía folio 101) | VERIFICADO (texto) + Guía cotejada | Sin cifra; topes y señalización |
| 7 | Altura de la barandilla | **90 cm como mínimo** (RD 1627 C.3 a, p. 19) | VERIFICADO (texto) | «90 cm como mínimo»; el proyectista puede poner 1,00 m |
| 8 | Rodapié y resistencia de la barandilla | **Ninguna cifra.** «Reborde de protección», que la Guía (folio 91) identifica con el rodapié; «resistentes»; referencia UNE-EN 13374 (no leída) | VERIFICADO (texto) que no hay cifra | «Rodapié, pasamanos y protección intermedia; barandillas resistentes (UNE-EN 13374 como referencia)». Sin 15 ni 20 cm ni 150 kg/m |
| 9 | Borriquetas: separación entre apoyos y altura | **Ninguna cifra.** El RD 1215 4.3.3 b) las excluye del plan de montaje; la barandilla, desde 2 m de caída (RD 1627 C.3 a) | VERIFICADO (texto) | Barandilla para caídas de más de 2 m; el resto, sin cifra |
| 10 | Escalera de mano | **1 m** por encima del plano de acceso y **75°** aproximados (4.2.2); anticaídas o alternativa a más de **3,5 m** con esfuerzos peligrosos (4.2.3); prohibidas las de resistencia sin garantías, «en particular» las de más de **5 m**, y las improvisadas (4.2.4); nunca dos personas (4.2.3). RD 1215/1997 anexo II, p. 15. **CORREGIDO**: no hay «5 m como máximo» (ss01) ni «3 m sin fijar» (ss08); el «90 cm» de ss05 es incorrecto | VERIFICADO (texto) | Las cuatro reglas con su cifra |
| 11 | Arnés o protección en demolición | **2 m** (RD 1627 C.3 a, p. 19); los 3 m de ss11 no tienen base | VERIFICADO (texto) | Protección colectiva desde 2 m |
| 12 | Viento para parar | **Sin cifra general** (RD 1215 4.1.6, p. 14; RD 1627 C.4, p. 20). **Grúa torre: 72 km/h o el del fabricante si es menor** (RD 836/2003, anexo IV, p. 25); anemómetro a 50 y 70 km/h (ap. 5.4). Grúa móvil: el fabricante. Los 50 y 60 km/h de los ejemplos para cubiertas, soldadura o demolición no tienen base | VERIFICADO (texto) | «Viento fuerte» en general; en la ficha de grúa torre, el límite del RD 836/2003; en grúa móvil y plataformas, el del fabricante |
| 13 | Compresor respecto al tajo | **Ninguna norma fija distancia.** El RD 286/2006 fija niveles, no distancias | VERIFICADO (texto) que no hay cifra | Sin cifra. **Se quita** la «protección auditiva a menos de 4 m» que proponía el análisis: no tiene base. En su lugar, los niveles de la fila 19 |
| 14 | Distancia a líneas eléctricas | **Tabla 1 del anexo I del RD 614/2001** (p. 7). En obra, donde no se puede delimitar con precisión la zona, rige DPROX-2: 3 m hasta 66 kV, 5 m de 110 a 220 kV, 7 m a 380 kV (con interpolación entre 66 y 110 kV). **CORREGIDO**: el «6 m» de ss07 es 7 m a 380 kV y el «corte en 50 kV» de ss11 no existe | VERIFICADO (texto); elegir DPROX-2 es INTERPRETACIÓN. Tabla pendiente de imagen | «Distancias de la tabla 1 del anexo I del RD 614/2001»; con la tensión declarada, DPEL y DPROX-2 calculados |
| 15 | Iluminación del tajo | **Sin cifra**: «adecuada y suficiente» (RD 1627 A.9 a, p. 15). Los lux de los ejemplos salen del RD 486/1997, que excluye las obras | VERIFICADO (texto) | «Iluminación suficiente»; portátiles con protección antichoques (A.9 a) |
| 16 | Andamio: separación a la fachada y anclajes | **Sin cifra** en el RD 1215 (4.3.1–4.3.5): estabilidad, nota de cálculo o configuración tipo, plan de montaje; «ningún vacío peligroso» entre plataforma y protección (4.3.5). UNE-EN 12810/12811, no leídas | VERIFICADO (texto) que no hay cifra. **CORREGIDO**: el análisis proponía imprimir 30 cm, pero los ejemplos no coinciden (20 o 30 cm) | Sin cifra: separación y anclajes según el fabricante o el plan de montaje |
| 17 | Boca de la bajante sobre el contenedor | Ninguna norma leída | — | «A poca altura y con lona», sin cifra |
| 18 | Separación de los pies derechos de la barandilla | Ninguna norma leída (UNE-EN 13374, no leída) | — | Sin cifra |
| 19 | Ruido | **80 / 85 / 87 dB(A)** LAeq,d y 135 / 137 / 140 dB(C) de pico (RD 286/2006 art. 5.1, p. 5); protectores a disposición desde 80 y obligatorios desde 85 (art. 7.1, p. 7). El «80 dB(A)» de ss15 es el valor inferior de acción: correcto | VERIFICADO (texto) | Los tres valores con su efecto, como referencia de la evaluación que hace la empresa |

**Cifras «coherentes» del §4.9, revisadas**
- **25 kg por persona**: el RD 487/1997 **no la fija** (VERIFICADO (texto)). Viene de la Guía técnica del INSST de manipulación manual de cargas (25 kg en condiciones ideales; 15 kg para proteger a la mayoría de la población), leída solo en fuentes secundarias → **SIN CONFIRMAR** en fuente oficial. Se imprime como buena práctica **sin cita**; nunca «según el RD 487/1997».
- **Portátiles a 24 V, tendido aéreo a 2 m y 5 m, pilas de 1,50 m, plataformas de 60 cm, red a 6 m como máximo, hormigonera y sierra a 3 m del borde**: ninguna norma cotejada las fija ni las contradice. Siguen como buena práctica, sin cita.
- **Nuevas cifras verificadas para la ficha IP4** (ITC-BT-33): IP45 a la intemperie; cables 450/750 V con cubierta de policloropreno, aptos para servicios móviles; sustituyen al «IP 447» que el análisis ya quitaba.
- **Vibraciones** (RD 1311/2005 art. 3): 2,5 / 5 m/s² mano-brazo y 0,5 / 1,15 m/s² cuerpo entero, para las fichas de martillos, compactadores y dúmper.

**Una alerta para el test de prohibidos.** El RD 1627 anexo IV C.3 b) (p. 20) dice literalmente: «deberá disponerse de medios de acceso seguros y utilizarse cinturones de seguridad con anclaje u otros medios de protección equivalente». La Guía (folio 91) lo reproduce. Si el estudio cita ese literal, el test que prohíbe «cinturón de seguridad» fallará. O la cita se parafrasea («equipos de protección individual anticaídas con anclaje»), o el test admite ese literal exacto entre comillas.

---

## K-SYS.17 — Lista corta de normas (análisis §3): títulos exactos y estado

**Cotejo.** Título y cabecera «TEXTO CONSOLIDADO · Última modificación» del PDF consolidado del BOE descargado el 2026-10-16, **VERIFICADO (texto)**. Ninguna cabecera marca la norma como derogada. **Vigente** = sin marca de derogación en el consolidado, y para las órdenes, sin «referencias posteriores» en el «Análisis» del BOE (LEÍDO (web)).

| # | Norma (título exacto del BOE) | Referencia BOE | Última modificación (cabecera) | Estado |
|---|---|---|---|---|
| 1 | Real Decreto 1627/1997, de 24 de octubre, por el que se establecen disposiciones mínimas de seguridad y de salud en las obras de construcción | BOE-A-1997-22614 | 23 de marzo de 2010 | Vigente |
| 2 | Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales | BOE-A-1995-24292 | 09 de abril de 2026 | Vigente |
| 3 | Real Decreto 39/1997, de 17 de enero, por el que se aprueba el Reglamento de los Servicios de Prevención | BOE-A-1997-1853 | 17 de octubre de 2025 | Vigente |
| 4 | Real Decreto 171/2004, de 30 de enero, por el que se desarrolla el artículo 24 de la Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales, en materia de coordinación de actividades empresariales | BOE-A-2004-1848 | sin modificaciones | Vigente |
| 5 | Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el Sector de la Construcción | BOE-A-2006-18205 | 30 de diciembre de 2021 | Vigente |
| 6 | Real Decreto 1109/2007, de 24 de agosto, por el que se desarrolla la Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el Sector de la Construcción | BOE-A-2007-15766 | 23 de marzo de 2010 | Vigente |
| 7 | Real Decreto 485/1997, de 14 de abril, sobre disposiciones mínimas en materia de señalización de seguridad y salud en el trabajo | BOE-A-1997-8668 | 04 de julio de 2015 | Vigente |
| 8 | Real Decreto 487/1997, de 14 de abril, sobre disposiciones mínimas de seguridad y salud relativas a la manipulación manual de cargas que entrañe riesgos, en particular dorsolumbares, para los trabajadores | BOE-A-1997-8670 | sin modificaciones | Vigente |
| 9 | Real Decreto 773/1997, de 30 de mayo, sobre disposiciones mínimas de seguridad y salud relativas a la utilización por los trabajadores de equipos de protección individual | BOE-A-1997-12735 | 08 de diciembre de 2021 | Vigente |
| 10 | Real Decreto 1215/1997, de 18 de julio, por el que se establecen las disposiciones mínimas de seguridad y salud para la utilización por los trabajadores de los equipos de trabajo | BOE-A-1997-17824 | 13 de noviembre de 2004 | Vigente |
| 11 | Real Decreto 614/2001, de 8 de junio, sobre disposiciones mínimas para la protección de la salud y seguridad de los trabajadores frente al riesgo eléctrico | BOE-A-2001-11881 | sin modificaciones | Vigente |
| 12 | Real Decreto 286/2006, de 10 de marzo, sobre la protección de la salud y la seguridad de los trabajadores contra los riesgos relacionados con la exposición al ruido | BOE-A-2006-4414 | sin modificaciones | Vigente |
| 13 | Real Decreto 1311/2005, de 4 de noviembre, sobre la protección de la salud y la seguridad de los trabajadores frente a los riesgos derivados o que puedan derivarse de la exposición a vibraciones mecánicas | BOE-A-2005-18262 | 26 de marzo de 2009 | Vigente |
| 14 | Real Decreto 374/2001, de 6 de abril, sobre la protección de la salud y seguridad de los trabajadores contra los riesgos relacionados con los agentes químicos durante el trabajo | BOE-A-2001-8436 | 04 de julio de 2015 | Vigente |
| 15 | Real Decreto 396/2006, de 31 de marzo, por el que se establecen las disposiciones mínimas de seguridad y salud aplicables a los trabajos con riesgo de exposición al amianto | BOE-A-2006-6474 | sin modificaciones | Vigente (K-SYS.18) |
| 16 | Real Decreto 842/2002, de 2 de agosto, por el que se aprueba el Reglamento electrotécnico para baja tensión (ITC-BT-33) | BOE-A-2002-18099 | 03 de septiembre de 2025 | Vigente |
| 17 | Real Decreto 836/2003, de 27 de junio, por el que se aprueba una nueva Instrucción técnica complementaria «MIE-AEM-2» del Reglamento de aparatos de elevación y manutención, referente a grúas torre para obras u otras aplicaciones | BOE-A-2003-14326 | 03 de septiembre de 2025 | Vigente. Solo si hay grúa torre. *(El BOE escribe «por el que se se aprueba»: la app corrige la errata.)* |
| 18 | Real Decreto 837/2003, de 27 de junio, por el que se aprueba el nuevo texto modificado y refundido de la Instrucción técnica complementaria «MIE-AEM-4» del Reglamento de aparatos de elevación y manutención, referente a grúas móviles autopropulsadas | BOE-A-2003-14327 | 13 de abril de 2024 | Vigente. Solo si hay grúa móvil (camión grúa) |
| 19 | Resolución de 6 de septiembre de 2023, de la Dirección General de Trabajo, por la que se registra y publica el VII Convenio colectivo general del sector de la construcción | BOE-A-2023-19903 (23-09-2023) | — (no se consolida) | Vigente hasta 31-12-2026 y prorrogado hasta que lo sustituya otro (art. 7.2) |
| 20 | Orden TIN/1071/2010, de 27 de abril, sobre los requisitos y datos que deben reunir las comunicaciones de apertura o de reanudación de actividades en los centros de trabajo | BOE-A-2010-6871 (01-05-2010) | — (PDF original) | Vigente; sin referencias posteriores |

*(Título cotejado palabra por palabra en la primera página del PDF del BOE, pág. 129033.)*

**¿Sobra o falta alguna para una obra de vivienda?** (INTERPRETACIÓN)
- **Sobran como fijas**: las de grúas (17 y 18) solo entran si la obra tiene grúa torre o camión grúa (el catálogo sabe si M6 o M7 están marcadas). El resto aplica a cualquier obra de vivienda.
- **No entran**: RD 486/1997 (excluye las obras, art. 1.2 b), Orden TAS/2947/2007 (K-SYS.19), Orden TAS/2926/2002 (parte de accidente, es del empresario), RD 1644/2008 (comercialización de máquinas, es del fabricante), Reglamento (UE) 2016/425 (comercialización de EPI).
- **Pueden faltar, pendientes de leer**: RD 665/1997, de agentes cancerígenos (desde su modificación de 2020 incluye, según fuentes secundarias, el polvo de sílice cristalina respirable que generan el corte y el rozado de cerámica y hormigón), y RD 664/1997, de agentes biológicos (saneamiento existente en reformas). **SIN CONFIRMAR**: no se añaden hasta leer su cabecera y su ámbito.
- **Modificadoras del RD 1627/1997**: si se nombran (RD 2177/2004, RD 604/2006, RD 1109/2007, RD 337/2010), siguen LEÍDO (web) por el «Análisis» del BOE. Basta con el n.º 1 «en su redacción vigente».

---

## K-SYS.18 — Amianto: estado del RD 396/2006 a 2026-10-16

**Consolidado.** [RD396], cabecera del PDF descargado el 2026-10-16: «TEXTO CONSOLIDADO · Última modificación: sin modificaciones» → **VERIFICADO (texto)**. La versión HTML (act.php) dice «Última actualización, publicada el 11/04/2006», que es la misma cosa: no hay ninguna versión posterior.

**«Análisis» del BOE** (doc.php, consultado 2026-10-16): solo trae «Referencias anteriores» (las órdenes y resoluciones de 1984 a 1993 que deroga). **No hay «Referencias posteriores»**: si un real decreto de 2026 lo hubiera derogado o modificado, constaría ahí → **LEÍDO (web)**.

**Búsqueda del nuevo real decreto.** Solo consta el **proyecto** del Ministerio de Trabajo fechado el **10-02-2026**, cuya disposición derogatoria derogaría el RD 396/2006, y prensa de hasta julio de 2026 que lo sigue llamando «proyecto». El plazo de transposición de la Directiva (UE) 2023/2668 venció el 21-12-2025. No se ha encontrado aprobación en Consejo de Ministros ni publicación en el BOE. **LEÍDO (web)**, fuentes secundarias para el proyecto; que no exista no se puede verificar del todo.

**Veredicto.** A 2026-10-16 el **RD 396/2006 está vigente y sin modificaciones**; el nuevo real decreto **no se ha publicado**. Todo K-SYS.9 se mantiene. Se mantienen también la cita «RD 396/2006, o la norma que lo sustituya en transposición de la Directiva (UE) 2023/2668» y la regla de no imprimir valores límite. **Volver a mirar el «Análisis» del BOE en el paso 7 de feature-35.**

---

## K-SYS.19 — Botiquín: la Orden TAS/2947/2007 y lo que se imprime

**Pregunta.** Si la Orden TAS/2947/2007 que cita ss09 se aplica a las obras, y qué se puede imprimir en el estudio básico.

**1. La orden.** [TAS2947], BOE núm. 244, 11-10-2007, págs. 41429–41430, **VERIFICADO (texto)**:
- Título: «Orden TAS/2947/2007, de 8 de octubre, por la que se establece el suministro a las empresas de botiquines con material de primeros auxilios en caso de accidente de trabajo, como parte de la acción protectora del sistema de la Seguridad Social.»
- Art. 1 (pág. 41429): «Los botiquines para primeros auxilios en caso de accidente de trabajo a que se refiere el anexo VI.A).3 del Real Decreto 486/1997, de 14 de abril, por el que se establecen las disposiciones mínimas de seguridad y salud en los lugares de trabajo, constituyen parte del contenido de la prestación de asistencia sanitaria de la Seguridad Social […] y podrán ser facilitados por las entidades gestoras y las mutuas de accidentes de trabajo y enfermedades profesionales de la Seguridad Social a las empresas respecto de cuyos trabajadores asuman la protección por las contingencias profesionales.»
- Art. 2 (pág. 41430): «El contenido de los botiquines a que se refiere el artículo anterior se limitará al mínimo establecido en el citado anexo VI.A).3 del Real Decreto 486/1997, de 14 de abril.»
- Art. 3: la reposición la asume la entidad gestora o mutua.
- **No tiene anexo propio.** No impone ninguna obligación preventiva: dice quién paga el botiquín del RD 486/1997. La Resolución de 27-08-2008 de la SESS (LEÍDO (web)) solo dicta las instrucciones de reembolso, con una tabla de material y precios de 2008 por número de trabajadores.

**2. El RD 486/1997 excluye las obras.** [RD486] art. 1.2 b), LEÍDO (web): «Este Real Decreto no será de aplicación a: […] b) Las obras de construcción temporales o móviles.» Su anexo VI.A.3 (LEÍDO (web)): «todo lugar de trabajo deberá disponer, como mínimo, de un botiquín portátil que contenga desinfectantes y antisépticos autorizados, gasas estériles, algodón hidrófilo, venda, esparadrapo, apósitos adhesivos, tijeras, pinzas y guantes desechables.»

**3. Conclusión. INTERPRETACIÓN.** La Orden TAS/2947/2007 **no es una norma de seguridad aplicable a la obra**: se refiere al botiquín del RD 486/1997, que no rige en las obras, y su objeto es la financiación por la Seguridad Social. **No va en las normas aplicables (apartado 5) ni se cita como base del botiquín.** Que la mutua suministre el botiquín a la empresa constructora es otra cosa, y no le toca al estudio.

**4. Lo que rige en la obra**, **VERIFICADO (texto)**:
- [RD1627] anexo IV A.14 (p. 16): «a) Será responsabilidad del empresario garantizar que los primeros auxilios puedan prestarse en todo momento por personal con la suficiente formación para ello. Asimismo, deberán adoptarse medidas para garantizar la evacuación, a fin de recibir cuidados médicos, de los trabajadores accidentados o afectados por una indisposición repentina. b) Cuando el tamaño de la obra o el tipo de actividad lo requieran, deberá contarse con uno o varios locales para primeros auxilios. […] d) En todos los lugares en los que las condiciones de trabajo lo requieran se deberá disponer también de material de primeros auxilios, debidamente señalizado y de fácil acceso. Una señalización claramente visible deberá indicar la dirección y el número de teléfono del servicio local de urgencia.»
- [CGSC7] **art. 234** (págs. 129149–129150, PDF pp. 117–118): «3. Cuando el número de personas trabajadoras en una obra supere los 50 se dispondrá de locales destinados a primeros auxilios y otras posibles atenciones sanitarias. 4. En el caso de ser necesarios locales para primeros auxilios, éstos deberán disponer, como mínimo, de: un botiquín, una camilla, agua potable y de otros materiales en función de la existencia de riesgos específicos. […] 6. En todas las obras existirá personal con conocimientos en primeros auxilios. […] 7. Igualmente, se dispondrá, en un lugar visible, información en la que se haga constar el centro sanitario más próximo a la obra, así como el recorrido más recomendable para acceder a dicho centro y cuantos teléfonos sean necesarios en caso de urgencia.»
- [GT-Obras] comentario a A.14, folio 78 (PDF p. 77), **LEÍDO (comentario), cotejado en texto**: para el contenido, «se puede consultar como referencia el anexo I de la Resolución de 27 de agosto de 2008, de la Secretaría de Estado de la Seguridad Social, por la que se dictan instrucciones para la aplicación de la Orden TAS/2947/2007»; y «El material de primeros auxilios se revisará periódicamente y se repondrá tan pronto caduque o sea utilizado.»

**CORREGIDO (decisión 15 de feature-35).** «Revisado y repuesto» no está en el RD 1627 A.14: es de la Guía (y del RD 486/1997 anexo VI.A.4, que no rige en la obra). Se imprime atribuido a la Guía o sin cita.

**Lo que se imprime en el apartado 6:**
1. El literal de A.14 a) y d).
2. Convenio art. 234: personal con conocimientos en primeros auxilios; local si n > 50 (con botiquín, camilla y agua potable); información visible del centro sanitario, el recorrido y los teléfonos (enlaza con el centro asistencial del paso 1).
3. Como buena práctica, sin cita reglamentaria: botiquín portátil con desinfectantes y antisépticos, gasas estériles, algodón, vendas, esparadrapo, apósitos, tijeras, pinzas y guantes desechables, revisado y repuesto cuando caduque o se use (Guía, folio 78).
4. **Nada** de la Orden TAS/2947/2007 ni del RD 486/1997, ni la tabla de la Resolución de 2008 (son precios de reembolso).

---

## K-SYS.20 — Orden TIN/1071/2010: la comunicación de apertura en las obras

**Antes SIN CONFIRMAR (K-SYS.6 y lista «Queda SIN CONFIRMAR», 6). Ahora VERIFICADO (texto)**, PDF original del BOE núm. 106, 01-05-2010.

**Preámbulo** (pág. 38787): la orden integra en la comunicación de apertura del contratista (art. 19 del RD 1627/1997) «el de aviso previo que había de presentar el promotor ante la misma autoridad laboral y cuya supresión se ha producido al quedar derogado el articulo 18 del Real Decreto 1627/1997, de 24 de octubre, según la disposición derogatoria del Real Decreto 337/2010, de 19 de marzo». Confirma K-SYS.6: el aviso previo ya no existe.

**Art. 2.2** (págs. 38788–38789):
> «2. En las obras de construcción incluidas en el ámbito de aplicación del Real Decreto 1627/1997, de 24 de octubre, por el que se establecen disposiciones mínimas de seguridad y de salud en las obras de construcción, la comunicación de apertura del centro de trabajo deberá ser previa al comienzo de los trabajos, deberá exponerse en la obra en lugar visible, se mantendrá permanentemente actualizada en el caso de que se produzcan cambios no identificados inicialmente y se efectuará únicamente por los empresarios que tengan la condición de contratistas conforme al indicado real decreto. A tal efecto el promotor deberá facilitar a los contratistas los datos que sean necesarios para el cumplimiento de dicha obligación. La comunicación se cumplimentará según el modelo oficial que figura en el anexo (partes A y B) y contendrá los siguientes datos e informaciones:
> a) Número de Inscripción en el Registro de Empresas Acreditadas según el Real Decreto 1109/2007, de 24 de agosto, que desarrolla la Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el sector de la construcción.
> b) Número del expediente de la primera comunicación de apertura, en los supuestos de actualización de la misma.
> c) Tipo de obra.
> d) Dirección de la obra.
> e) Fecha prevista para el comienzo de la obra.
> f) Duración prevista de los trabajos en la obra.
> g) Duración prevista de los trabajos en la obra del contratista.
> h) Número máximo estimado de trabajadores en toda la obra.
> i) Número previsto de subcontratistas y trabajadores autónomos en la obra dependientes del contratista.
> j) Especificación de los trabajos del anexo II del Real Decreto 1627/1997, de 24 de octubre, que, en su caso, se vayan a realizar por el contratista.
> k) Datos del promotor: Nombre/razón social, número del Documento de Identificación Fiscal, domicilio, localidad y código postal.
> l) Datos del proyectista: Nombre y apellidos, número del Documento de Identificación Fiscal, domicilio, localidad y código postal.
> m) Datos del coordinador de seguridad y salud en fase de elaboración del proyecto: Nombre y apellidos, número del Documento de Identificación Fiscal, domicilio, localidad y código postal.
> n) Datos del coordinador de seguridad y salud en fase de ejecución de la obra: Nombre y apellidos, número del Documento de Identificación Fiscal, domicilio, localidad y código postal.
> Junto a dicho modelo deberá adjuntarse el Plan de seguridad y salud cuando el mismo sea exigible conforme al Real Decreto 1627/1997, de 24 de octubre, acompañado de su correspondiente aprobación, conforme al artículo 7 de dicho real decreto. Si no fuera exigible el plan de seguridad y salud, se acompañará de la correspondiente evaluación de riesgos.»

**Art. 3.5** (pág. 38790): «La actualización de los datos a los que se refiere el artículo 2.2 se comunicarán a la autoridad laboral en el plazo de 10 días desde que se produzcan los cambios no identificados en la comunicación inicial.»

**Art. 5.2** (pág. 38790): en las obras del RD 1627/1997, la responsabilidad por incumplir la orden «será exigible igualmente al promotor de la obra, de acuerdo con lo señalado en el artículo 6.3 del Real Decreto-ley 1/1986, de 14 de marzo».

**Anexo, parte B** (pág. 38793): «EN EL CASO DE TRATARSE DE UNA OBRA DE CONSTRUCCIÓN», con las casillas «Acompaña Plan de Seguridad y Salud en el Trabajo aprobado» y «Acompaña Evaluación de Riesgos», y los datos a)–n).

**Entrada en vigor** (DF 2.ª.2, pág. 38791): para las obras (art. 2.2), «el día siguiente al de su publicación», es decir, el 02-05-2010. Sin referencias posteriores en el BOE (LEÍDO (web)).

**Consecuencia para la app**
- **Apartado 13 (obligaciones), texto fijo verificado:** «Cada contratista presentará ante la autoridad laboral la comunicación de apertura del centro de trabajo antes del comienzo de los trabajos, acompañada del plan de seguridad y salud en el trabajo y de su aprobación (art. 7 del RD 1627/1997). La comunicación se expondrá en la obra en lugar visible y se actualizará en el plazo de 10 días cuando se produzcan cambios no identificados inicialmente. El promotor facilitará a los contratistas los datos necesarios (Orden TIN/1071/2010, arts. 2.2 y 3.5).» Con la pregunta del cabeza de familia en «sí» (K-SYS.11), se añade que, en las partes sin plan, la comunicación va con la evaluación de riesgos.
- **Apartado 0 (datos generales):** el estudio básico ya reúne los datos que el promotor debe facilitar (c, d, f, h, j, k, l, m, n). Conviene que el apartado 0 los presente en ese orden; la app no genera el modelo oficial.
- **Apartado 10 (anexo II):** el dato j) de la comunicación sale de este apartado; refuerza que no quede nunca vacío.

---

## K-SYS.21 — Libro de incidencias y paralización (arts. 13 y 14) y amianto, a 2026-10-18

Paso 7 de feature-35: lo que el paso 5 dejó parafraseado sin cotejar (decisión 14) y la segunda mirada al amianto que pedía K-SYS.18.

**Arts. 13 y 14 del RD 1627/1997**, en el consolidado del BOE (BOE-A-1997-22614) pasado a texto → **VERIFICADO (texto)**:
- **13.1**: en cada centro de trabajo, con fines de control y seguimiento del plan, un libro de incidencias «que constará de hojas por duplicado, habilitado al efecto».
- **13.2**: lo facilita «a) El Colegio profesional al que pertenezca el técnico que haya aprobado el plan de seguridad y salud» o «b) La Oficina de Supervisión de Proyectos u órgano equivalente cuando se trate de obras de las Administraciones públicas».
- **13.3**: siempre en la obra, en poder del coordinador durante la ejecución o, si no es necesario designarlo, de la dirección facultativa; pueden anotar la dirección facultativa, contratistas, subcontratistas, autónomos, los responsables de prevención de las empresas, los representantes de los trabajadores y los técnicos de las administraciones.
- **13.4**: quien lo tiene notifica cada anotación «al contratista afectado y a los representantes de los trabajadores de éste»; con un incumplimiento de advertencias u observaciones anteriores, o en el supuesto del art. 14, «deberá remitirse una copia a la Inspección de Trabajo y Seguridad Social en el plazo de veinticuatro horas».
- **14.1**: el coordinador durante la ejecución o cualquier otra persona de la dirección facultativa que observe incumplimientos lo advierte al contratista, deja constancia en el libro y, «en circunstancias de riesgo grave e inminente», puede disponer la paralización de los tajos o de la obra entera. **14.2**: quien la ordena da cuenta a la Inspección, a los contratistas y subcontratistas afectados y a los representantes de sus trabajadores.

**Veredicto.** Los parafraseos del paso 5 eran correctos. Se completan en `OBLIGACIONES_EBSS` con lo que faltaba: hojas por duplicado, la oficina de supervisión en obra pública (13.2), quién tiene el libro (13.3), la advertencia y la anotación previas a la paralización y a quién se da cuenta (14). La frase del 13.4 dice «una copia de la anotación a la Inspección», que no choca con el prohibido «copia a la Inspección» (que caza la copia de toda anotación).

**Amianto, segunda mirada (2026-10-18).** El consolidado del RD 396/2006 en boe.es sigue con «Última actualización, publicada el 11/04/2006», sin modificaciones ni derogación → **LEÍDO (web)**. La búsqueda solo encuentra el **proyecto** de real decreto que transpone la Directiva (UE) 2023/2668 y lo derogaría; ninguna noticia de aprobación ni referencia del BOE. Algunas fuentes dan el nuevo VLA-ED de 0,01 fibras/cm³ en los LEP 2026 del INSST, que no son norma de este estudio y que el estudio no imprime → **LEÍDO (web)**, fuentes secundarias. **K-SYS.9 y K-SYS.18 se mantienen.**
