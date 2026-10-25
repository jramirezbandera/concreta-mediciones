# Verificación normativa A — Plan de control de calidad: CTE genérico, agentes, productos, instalaciones y normas derogadas

**Fecha:** 2026-10-24 · Verificador A (CTE genérico) · **No se ha editado código.**
**Encargo:** base normativa estatal del «Plan de control de calidad» del proyecto de ejecución que la app generará a partir de las partidas del presupuesto: recepción de productos, control de ejecución, control de obra terminada y valoración económica. Obra privada. Andalucía y el Código Estructural quedan fuera: los llevan otros dos verificadores. Criterios **K-PCC.1 … K-PCC.19**, en el orden de las preguntas.

**Método y límites de esta sesión**
- **Volcados de texto** (`pdftotext -layout`, UTF-8) de los PDF oficiales, en `volcados/norma/txt/` (PDF en `volcados/norma/pdf/`). La página citada es la impresa: «Página N» en los consolidados del BOE; «Sec. I. Pág. N» o el número de página del BOE en los originales; «N/106» o «L 88/N» en el DOUE; el número impreso del DB («45», «HR-35», «SE-C-57»…). Las páginas se comprobaron buscando cada cita en el PDF página a página (PyMuPDF). → **VERIFICADO (texto)**.
- **Cotejo en imagen**: tabla del anejo I de la Parte I del CTE (pp. 20 y 21, páginas renderizadas). Es una tabla a dos columnas y `pdftotext` separa los nombres de las observaciones. → **VERIFICADO (imagen)**.
- **Lo leído en la ficha «Análisis» de boe.es** (referencias anteriores y posteriores), sin el texto de la disposición, queda como **LEÍDO (web)**. Lo localizado solo con el buscador queda como **LEÍDO (web, secundaria)**.
- EUR-Lex devolvió 202 (bloqueo) a `curl`. Los reglamentos de la UE se leyeron en la copia del DOUE que publica boe.es (`/doue/…`): es el PDF de la Oficina de Publicaciones, con su ELI y paginación.
- **Plantillas de ejemplo** (`volcados/*.txt`, dato de cliente): solo se contó qué citas derogadas aparecen, para justificar la lista de K-PCC.19. No se reproduce su contenido.

**Veredictos** (los de `verificacion-residuos.md`):
- **VERIFICADO (imagen)** / **VERIFICADO (texto)**: literal de la norma, con página.
- **LEÍDO (web)**: ficha o HTML oficial (boe.es) leído sin el texto de la disposición.
- **LEÍDO (web, secundaria)**: buscador o fuente no oficial.
- **INTERPRETACIÓN**: se sigue de la norma, pero la norma no lo escribe tal cual.
- **CORREGIDO**: el encargo o una idea de partida no coincide con la fuente.
- **SIN CONFIRMAR**: no se ha podido leer en fuente oficial. **No se codifica.**

---

## 0. Fuentes y ediciones

| Clave | Documento | Edición / versión | Fuente | Lectura |
|---|---|---|---|---|
| [CTE-I] | RD 314/2006, CTE, Parte I | BOE-A-2006-5515, consolidado. «Última modificación: 15 de junio de 2022» (p. 3) | PDF consolidado BOE | **VERIFICADO (texto)**: DT 1.ª–4.ª y DD única (pp. 5–7), art. 4 (pp. 9–10), arts. 5–8 (pp. 10–14), anejo I (pp. 19–21), anejo II (pp. 21–22). **VERIFICADO (imagen)**: anejo I, pp. 20–21 |
| [LOE] | Ley 38/1999, de Ordenación de la Edificación | BOE-A-1999-21567, consolidado. «Última modificación: 15 de junio de 2022» (p. 4) | PDF consolidado BOE | **VERIFICADO (texto)**: arts. 9–15 (pp. 9–13) |
| [RD410] | RD 410/2010, requisitos de las entidades de control de calidad y de los laboratorios de ensayos | BOE-A-2010-6368, consolidado. «Última modificación: sin modificaciones» (p. 3) | PDF consolidado BOE | **VERIFICADO (texto)**: preámbulo, arts. 1–6, DT única, DD única, DF 2.ª, anexos I–III (pp. 3–14) |
| [R305] | Reglamento (UE) n.º 305/2011, productos de construcción | DO L 88, 04-04-2011, pp. 5–43, texto **original** (sin consolidar) | PDF DOUE (copia en boe.es `/doue/2011/088/`) | **VERIFICADO (texto)**: arts. 4 (L 88/12), 8 (L 88/13), 65–68 (L 88/31–32), anexo V (L 88/42–43) |
| [R3110] | Reglamento (UE) 2024/3110, productos de construcción (deroga el 305/2011) | DO L de 18-12-2024 | PDF DOUE (boe.es `/doue/2024/3110/`) | **VERIFICADO (texto)**: arts. 15 (31/106), 17 (32/106), 94–96 (75–77/106), anexo IX (97–98/106) |
| [RD2026-1310] | Reglamento Delegado (UE) 2026/1310, sistemas de evaluación y verificación por familias | DO L de 28-08-2026 | PDF DOUE (boe.es `/doue/2026/1310/`) | **VERIFICADO (texto)**: arts. 1–4. Anexos no recorridos |
| [RD1630] | RD 1630/1992, libre circulación de productos de construcción | BOE-A-1993-3344, consolidado: **«Norma derogada, con efectos de 1 de julio de 2020»** (p. 3) | PDF consolidado BOE | **VERIFICADO (texto)** |
| [RD542] | RD 542/2020, modifica y deroga disposiciones de calidad y seguridad industrial | BOE-A-2020-6472, consolidado, «sin modificaciones» | PDF consolidado BOE | **VERIFICADO (texto)**: DD única 1.g (p. 29), DF única (p. 30) |
| [RD1328] | RD 1328/1995, modifica el RD 1630/1992 | BOE-A-1995-19849. Sin consolidado (404) | ficha «Análisis» boe.es | **LEÍDO (web)** |
| [RC-16] | RD 256/2016, Instrucción para la recepción de cementos (RC-16) | BOE-A-2016-6167, consolidado. «Última modificación: 10 de abril de 2024» (p. 3) | PDF consolidado BOE | **VERIFICADO (texto)**: DD única (p. 4), arts. 7–8 (pp. 8–12) |
| [RD320] | RD 320/2024, modifica la RC-16 | BOE-A-2024-7034, original, BOE núm. 88, 10-04-2024 | PDF BOE | **VERIFICADO (texto)**: título y DF única, «entrará en vigor el 1 de julio de 2024» (Sec. I, pág. 39961) |
| [HS] | CTE DB HS Salubridad | «14 junio 2022», consolidado hasta el RD 450/2022 (p. 2) | PDF codigotecnico.org | **VERIFICADO (texto)**: introducción (p. 4), HS 1 4.2 y 5 (pp. 40, 44–45), HS 3 6.3 (p. 74), HS 4 5.2 (pp. 100–101), HS 5 5.6 (pp. 129–130), HS 6 4.2 y 5 (pp. 141, 143) |
| [HE] | CTE DB HE Ahorro de energía | «14 Junio 2022» | PDF codigotecnico.org | **VERIFICADO (texto)**: HE 0 6.3 (p. 14), HE 1 3.1.3 (p. 18) y 5.4–5.6 (p. 20), HE 3 (p. 27), HE 4 (p. 29), HE 5 (p. 32), HE 6 (pp. 34–35), anejo H (p. 56) |
| [HR] | CTE DB HR Protección frente al ruido | «20 diciembre 2019» | PDF codigotecnico.org | **VERIFICADO (texto)**: 4.3 (HR-32), 5.2–5.3 (HR-35) |
| [SI] | CTE DB SI Seguridad en caso de incendio | «4 marzo 2025», modificado por el RD 164/2025 | PDF codigotecnico.org | **VERIFICADO (texto)**: introducción IV–V (p. 6). No tiene apartado de control |
| [SUA] | CTE DB SUA Seguridad de utilización y accesibilidad | «14 junio 2022» | PDF codigotecnico.org | **VERIFICADO (texto)**: SUA 1, tabla 1.1 (p. 8). No tiene apartado de control |
| [SE] | CTE DB SE Seguridad estructural | «20 diciembre 2019» | PDF codigotecnico.org | **VERIFICADO (texto)**: introducción y 1.1 (pp. 3, SE-1) |
| [SE-C] | CTE DB SE-C Cimientos | «20 diciembre 2019» | PDF codigotecnico.org | **VERIFICADO (texto)**: 4.6 (SE-C-39 a 41), 5.4.2 (SE-C-56 a 59), 6.4.2 (SE-C-92), 9.1 y 9.4 (SE-C-99, 102) |
| [SE-F] | CTE DB SE-F Fábrica | «20 diciembre 2019» | PDF codigotecnico.org | **VERIFICADO (texto)**: cap. 8 (SE-F-43 a 45) |
| [SE-M] | CTE DB SE-M Madera | «20 diciembre 2019» | PDF codigotecnico.org | **VERIFICADO (texto)**: cap. 13 (SE-M 91 a 93) |
| [SE-A] | CTE DB SE-A Acero | «Texto modificado por RD 1371/2007 […] y corrección de errores (BOE 25/01/2008)» (portada) | PDF codigotecnico.org | **VERIFICADO (texto)**: 10.8 (SE-A-117 a 119), cap. 12 (SE-A-133 a 135) |
| [CodE] | RD 470/2021, Código Estructural | BOE-A-2021-13681, consolidado, «sin modificaciones» | volcado del verificador del Código Estructural (`txt\CodE-consolidado.txt`) | **VERIFICADO (texto)**, solo DT única y DD única (pp. 6–7) y art. 2 (pp. 7–8). El resto es de su verificador |
| [EHE-08] | RD 1247/2008, EHE-08, disposiciones del real decreto | BOE núm. 203, 22-08-2008, pp. 35176–35178 (original) | PDF BOE | **VERIFICADO (texto)**: DD única (pp. 35177–35178) |
| [RD1371] | RD 1371/2007, aprueba el DB HR | BOE núm. 254, 23-10-2007, pp. 42992 y ss. (original) | PDF BOE | **VERIFICADO (texto)**: DD única (p. 42993) |
| [RITE] | RD 1027/2007, RITE | BOE-A-2007-15820, consolidado. «Última modificación: 02 de agosto de 2022» | PDF consolidado BOE | **VERIFICADO (texto)**: arts. 20–23 (pp. 15–16), IT 2.2 (pp. 70–73) |
| [REBT] | RD 842/2002, REBT | BOE-A-2002-18099, consolidado. «Última modificación: 03 de septiembre de 2025» | PDF consolidado BOE | **VERIFICADO (texto)**: ITC-BT-04 5.2–5.3 (pp. 53–54), ITC-BT-05 (pp. 55–56) |
| [RIPCI] | RD 513/2017, RIPCI | BOE-A-2017-6606, consolidado. «Última modificación: 03 de septiembre de 2025» | PDF consolidado BOE | **VERIFICADO (texto)**: arts. 9, 19–20 (pp. 10, 15–16); anexo I, sección 1.ª, 5.5 y 6.4 (pp. 24–25) |
| [ICT] | Orden ITC/1644/2011, desarrolla el Reglamento ICT (RD 346/2011) | BOE-A-2011-10457, consolidado. «Última modificación: 3 de octubre de 2019». RD 346/2011: BOE-A-2011-5834, «26 de marzo de 2025» | PDF consolidado BOE | **VERIFICADO (texto)**: art. 6.4 (p. 7) |
| [GAS] | RD 919/2006, Reglamento técnico de distribución y utilización de combustibles gaseosos | BOE-A-2006-15345, consolidado. «Última modificación: 03 de septiembre de 2025» | PDF consolidado BOE | **VERIFICADO (texto)**: ITC-ICG 07, 3.3 (p. 45) |
| [ANÁL] | Fichas «Análisis» del BOE de RD 1247/2008, 642/2002, 956/2008, 1797/2003, 2661/1998, 1371/2007 | — | boe.es `doc.php` | **LEÍDO (web)** |
| [PRD-PC] | Proyecto de RD español de productos de construcción (notificación TRIS 2025/0632/ES) | — | buscador | **LEÍDO (web, secundaria)**. **No consta publicado → SIN CONFIRMAR** |

### Correcciones al encargo y hallazgos que cambian el planteamiento (resumen)

1. **El «Plan de control de calidad» es un anejo de la memoria y solo del proyecto de ejecución.** En el anejo I no lleva asterisco. Además, **el presupuesto detallado «Incluirá el presupuesto del control de calidad»**. (K-PCC.5)
2. **CORREGIDO (encargo):** el **DB HS 1 no exige la prueba de estanqueidad de cubiertas planas**. Su 5.3 dice: «En esta sección del DB no se prescriben pruebas finales». La prueba solo es exigible si la pide el proyecto o la dirección facultativa (CTE art. 7.4) o una norma autonómica. (K-PCC.12)
3. **Sin pruebas finales en el CTE** en HS 1, HS 3, HS 6 (este no lo dice tan claro), HE 0, HE 1, HE 3, HE 4, HE 5 y HE 6, HR, SI y SUA. **Son obligatorias** las de **HS 4** (fontanería) y **HS 5** (saneamiento), ambas a cargo de la empresa instaladora. (K-PCC.12–15)
4. **Las mediciones acústicas in situ (DB HR) no son obligatorias.** Si se hacen, deben hacerlas laboratorios acreditados, con tolerancias de 3 dBA, 3 dB y 0,1 s. **El ensayo n50 (blower door) del HE 1 tampoco es obligatorio**: el n50 puede obtenerse por valores de referencia. (K-PCC.13, K-PCC.14)
5. **CORREGIDO (encargo):** el **RD 1630/1992 está derogado entero**, no «en parte», por el RD 542/2020 y con efectos del 01-07-2020. El RD 1328/1995 solo modificaba ese real decreto. **El propio CTE (art. 5.2.1) sigue citando la Directiva 89/106/CEE y el «Real Decreto 1329/1995»** (errata de 1328/1995): **no hay que copiarlo.** (K-PCC.1, K-PCC.10)
6. **El Reglamento (UE) 305/2011 no está derogado del todo.** Desde el 08-01-2026 rige el 2024/3110. Pero los artículos de la declaración de prestaciones, el marcado CE y los sistemas EVCP (anexos III y V) siguen hasta el **08-01-2040** para los productos con norma armonizada del 305/2011. En un plan de hoy hay que citar los dos. (K-PCC.9)
7. **Los laboratorios ya no se «acreditan» ni se «homologan»**: presentan una **declaración responsable** (LOE art. 14 y RD 410/2010). El RD 1230/1989 y las Órdenes FOM/2060/2002 y FOM/898/2004 están derogados. (K-PCC.8)
8. **La RC-16 se modificó por el RD 320/2024**, en vigor desde el 01-07-2024. Las fases 1 (documentación) y 2 (inspección visual) son obligatorias; los ensayos (fase 3) son potestativos. (K-PCC.11)
9. **Los DB estructurales citan aún la «Instrucción EHE» y la «EFHE»** (DB SE 1.1, SE-C, SE-F, SI). El test de citas derogadas debe aplicarse a lo que genera la app, no al texto literal de los DB. (K-PCC.16, K-PCC.19)
10. **El RD 1371/2007 derogó los pliegos RY-85, RL-88 y RB-90** (recepción de yesos, ladrillos y bloques). Aparecen todavía en las plantillas de ejemplo. (K-PCC.19)

---

## K-PCC.1 — CTE Parte I: vigencia y art. 5.2 (conformidad de productos, equipos y sistemas)

**Respuesta.** La Parte I vigente es la consolidada a 15-06-2022. Su art. 5.2 es la base de la recepción documental: marcado CE, características que fijan los DB, distintivos voluntarios reconocidos y evaluaciones técnicas de idoneidad (DIT/DAU) para productos innovadores. **Su apartado 1 está desfasado**: cita la Directiva 89/106/CEE y el RD 1630/1992, los dos derogados.

**Cita.** [CTE-I] art. 5.2, p. 11, **VERIFICADO (texto)**:
> «1. Los productos de construcción que se incorporen con carácter permanente a los edificios, en función de su uso previsto, llevarán el marcado CE, de conformidad con la Directiva 89/106/CEE de productos de construcción, transpuesta por el Real Decreto 1630/1992, de 29 de diciembre, modificado por el Real Decreto 1329/1995, de 28 de julio, y disposiciones de desarrollo, u otras Directivas Europeas que les sean de aplicación.
> 2. En determinados casos, y con el fin de asegurar su suficiencia, los DB establecen las características técnicas de productos, equipos y sistemas que se incorporen a los edificios, sin perjuicio del Marcado CE que les sea aplicable de acuerdo con las correspondientes Directivas Europeas.
> 3. Las marcas, sellos, certificaciones de conformidad u otros distintivos de calidad voluntarios que faciliten el cumplimiento de las exigencias básicas del CTE, podrán ser reconocidos por las Administraciones Públicas competentes. […]
> 5. Se considerarán conformes con el CTE los productos, equipos y sistemas innovadores que demuestren el cumplimiento de las exigencias básicas del CTE […] mediante una evaluación técnica favorable de su idoneidad para el uso previsto […]».

[CTE-I] p. 3: «TEXTO CONSOLIDADO / Última modificación: 15 de junio de 2022».

**CORREGIDO (la propia norma).** El real decreto que modificó el RD 1630/1992 es el **1328/1995**, de 28 de julio ([RD1328], LEÍDO (web): «Real Decreto 1328/1995, de 28 de julio, por el que se modifica, en aplicación de la Directiva 93/68/CEE, las disposiciones para la libre circulación de productos de construcción, aprobadas por el Real Decreto 1630/1992»). El «1329/1995» del CTE es una errata. **INTERPRETACIÓN:** según el art. 65.2 del [R305] («Las referencias a la Directiva derogada se entenderán hechas al presente Reglamento») y el art. 94 del [R3110] (las referencias al 305/2011 se entienden hechas al 2024/3110), el art. 5.2.1 se lee hoy como remisión a los reglamentos de la UE (K-PCC.9).

**Consecuencia para la app.** No se copia el art. 5.2.1 literal. Se cita «CTE Parte I, art. 5.2» junto con el reglamento de la UE aplicable.

---

## K-PCC.2 — CTE art. 6: qué debe definir el proyecto, y proyecto básico frente a proyecto de ejecución

**Cita.** [CTE-I] art. 6.1.2, p. 12, **VERIFICADO (texto)**:
> «Esta definición incluirá, al menos, la siguiente información:
> a) Las características técnicas mínimas que deben reunir los productos, equipos y sistemas que se incorporen de forma permanente en el edificio proyectado, así como sus condiciones de suministro, las garantías de calidad y el control de recepción que deba realizarse.
> b) Las características técnicas de cada unidad de obra, con indicación de las condiciones para su ejecución y las verificaciones y controles a realizar para comprobar su conformidad con lo indicado en el proyecto. […]
> c) Las verificaciones y las pruebas de servicio que, en su caso, deban realizarse para comprobar las prestaciones finales del edificio; y
> d) Las instrucciones de uso y mantenimiento del edificio terminado […]».

Art. 6.1.3, p. 12: «a) El proyecto básico […] Su contenido será suficiente para solicitar la licencia municipal de obras […] pero insuficiente para iniciar la construcción del edificio. […] b) El proyecto de ejecución desarrollará el proyecto básico y definirá la obra en su totalidad […]».

**INTERPRETACIÓN.** Las letras a), b) y c) son, una por una, el control de recepción, el control de ejecución y el control de obra terminada. Son obligación del **proyecto**, no un extra del plan. Como el proyecto básico es «insuficiente para iniciar la construcción», el plan pertenece al de ejecución (lo confirma K-PCC.5).

**Consecuencia para la app.** Tres bloques fijos: recepción, ejecución y obra terminada. Se generan solo en modo «proyecto de ejecución».

---

## K-PCC.3 — CTE art. 7.1–7.2: control de recepción (documentación, distintivos, ensayos)

**Cita.** [CTE-I] art. 7.1.4, p. 13, **VERIFICADO (texto)**: «Durante la construcción de las obras el director de obra y el director de la ejecución de la obra realizarán, según sus respectivas competencias, los controles siguientes: a) Control de recepción en obra de los productos, equipos y sistemas que se suministren a las obras de acuerdo con el artículo 7.2. b) Control de ejecución de la obra de acuerdo con el artículo 7.3; y c) Control de la obra terminada de acuerdo con el artículo 7.4.»

Art. 7.2, p. 13: «El control de recepción tiene por objeto comprobar que las características técnicas de los productos, equipos y sistemas suministrados satisfacen lo exigido en el proyecto. Este control comprenderá: a) El control de la documentación de los suministros, realizado de acuerdo con el artículo 7.2.1. b) El control mediante distintivos de calidad o evaluaciones técnicas de idoneidad, según el artículo 7.2.2; y c) El control mediante ensayos, conforme al artículo 7.2.3.»

Art. 7.2.1, p. 13: «Los suministradores entregarán al constructor, quien los facilitará al director de ejecución de la obra, los documentos de identificación del producto exigidos por la normativa de obligado cumplimiento y, en su caso, por el proyecto o por la dirección facultativa. Esta documentación comprenderá, al menos, los siguientes documentos: a) Los documentos de origen, hoja de suministro y etiquetado. b) El certificado de garantía del fabricante, firmado por persona física; y c) Los documentos de conformidad o autorizaciones administrativas exigidas reglamentariamente, incluida la documentación correspondiente al marcado CE de los productos de construcción, cuando sea pertinente […]».

Art. 7.2.2.2, p. 13: «El director de la ejecución de la obra verificará que esta documentación es suficiente para la aceptación de los productos, equipos y sistemas amparados por ella.»

Art. 7.2.3, p. 13: «1. Para verificar el cumplimiento de las exigencias básicas del CTE puede ser necesario, en determinados casos, realizar ensayos y pruebas sobre algunos productos, según lo establecido en la reglamentación vigente, o bien según lo especificado en el proyecto u ordenados por la dirección facultativa. 2. La realización de este control se efectuará de acuerdo con los criterios establecidos en el proyecto o indicados por la dirección facultativa sobre el muestreo del producto, los ensayos a realizar, los criterios de aceptación y rechazo y las acciones a adoptar.»

**INTERPRETACIÓN.** El control documental es **siempre** obligatorio. El control por ensayos solo lo es cuando lo imponga una reglamentación (por ejemplo, el Código Estructural) **o lo diga el proyecto**: el CTE deja el muestreo, los ensayos, los criterios de aceptación y rechazo y las acciones a **decisión del proyectista**.

**Consecuencia para la app.** Todas las partidas con producto llevan el control documental 7.2.1 a)–c). Los ensayos van como propuesta editable, con su origen marcado: «reglamentario» o «a criterio del proyecto».

---

## K-PCC.4 — CTE art. 7.3–7.4: control de ejecución y de obra terminada

**Cita.** [CTE-I] art. 7.3.1, p. 14, **VERIFICADO (texto)**: «Durante la construcción, el director de la ejecución de la obra controlará la ejecución de cada unidad de obra verificando su replanteo, los materiales que se utilicen, la correcta ejecución y disposición de los elementos constructivos y de las instalaciones, así como las verificaciones y demás controles a realizar para comprobar su conformidad con lo indicado en el proyecto, la legislación aplicable, las normas de buena práctica constructiva y las instrucciones de la dirección facultativa. En la recepción de la obra ejecutada pueden tenerse en cuenta las certificaciones de gestión de calidad que ostenten los agentes que intervienen, así como las verificaciones que, en su caso, realicen las entidades de control de calidad de la edificación.»

Art. 7.4, p. 14: «En la obra terminada, bien sobre el edificio en su conjunto, o bien sobre sus diferentes partes y sus instalaciones, parcial o totalmente terminadas, deben realizarse, además de las que puedan establecerse con carácter voluntario, las comprobaciones y pruebas de servicio previstas en el proyecto u ordenadas por la dirección facultativa y las exigidas por la legislación aplicable.»

**INTERPRETACIÓN.** Las pruebas de obra terminada tienen tres orígenes: la legislación (HS 4, HS 5, RITE, REBT, RIPCI, ICT, gas…), el proyecto y la dirección facultativa. La app debe distinguir lo **exigido por norma** de lo **previsto en el proyecto**.

---

## K-PCC.5 — CTE anejo I: dónde va el «Plan de control de calidad», el pliego y el presupuesto

**Respuesta.**
- El «**Plan de control de calidad**» figura entre los **«Anejos a la memoria»**, **sin asterisco**. No forma parte del contenido mínimo del proyecto básico.
- El **pliego de condiciones técnicas particulares** recoge, para cada producto y unidad de obra, el control de recepción con su muestreo, ensayos, criterios de aceptación y rechazo y acciones, y además las verificaciones de obra terminada.
- El **presupuesto detallado «Incluirá el presupuesto del control de calidad»**.

**Cita.** [CTE-I] anejo I, pp. 19–21, **VERIFICADO (imagen)** (p. 20 y p. 21 renderizadas) y **VERIFICADO (texto)**:
- p. 19: «2. Los marcados con asterisco (*) son los que, al menos, debe contener el Proyecto Básico.»
- p. 20, columna «Contenido del proyecto»: «Anejos a la memoria: […] Información geotécnica. Cálculo de la estructura. Protección contra el incendio. Instalaciones del edificio. Eficiencia energética. Estudio de impacto ambiental. **Plan de control de calidad.** Estudio de Seguridad y Salud o Estudio Básico, en su caso.» Ninguno lleva asterisco. Sí lo llevan, en la misma tabla, «3.2 Seguridad en caso de incendio*» o «Plano de situación *».
- p. 21, «Prescripciones sobre los materiales»: «Características técnicas mínimas que deben reunir los productos, equipos y sistemas que se incorporen a las obras, así como sus condiciones de suministro, recepción y conservación, almacenamiento y manipulación, las garantías de calidad y el control de recepción que deba realizarse incluyendo el muestreo del producto, los ensayos a realizar, los criterios de aceptación y rechazo, y las acciones a adoptar y los criterios de uso, conservación y mantenimiento. Estas especificaciones se pueden hacer por referencia a pliegos generales que sean de aplicación, Documentos Reconocidos u otros que sean válidas a juicio del proyectista.»
- p. 21, «Prescripciones en cuanto a la ejecución por unidades de obra»: «Características técnicas de cada unidad de obra indicando su proceso de ejecución, normas de aplicación, condiciones previas que han de cumplirse antes de su realización, tolerancias admisibles, condiciones de terminación, conservación y mantenimiento, control de ejecución, ensayos y pruebas, garantías de calidad, criterios de aceptación y rechazo, criterios de medición y valoración de unidades, etc.»
- p. 21, «Prescripciones sobre verificaciones en el edificio terminado»: «Se indicarán las verificaciones y pruebas de servicio que deban realizarse para comprobar las prestaciones finales del edificio.»
- p. 21, «Presupuesto detallado»: «Cuadro de precios agrupado por capítulos. / Resumen por capítulos, con expresión del valor final de ejecución y contrata. / **Incluirá el presupuesto del control de calidad.** / Presupuesto del Estudio de Seguridad y Salud.» En la imagen, las cuatro observaciones van en filas propias bajo «Presupuesto detallado».

**INTERPRETACIÓN.**
- El anejo I es indicativo («sin perjuicio de lo que, en su caso, establezcan las Administraciones competentes», p. 19). Las comunidades autónomas pueden añadir contenido (Andalucía: otro verificador).
- El CTE **no fija ni un porcentaje ni una forma**: pide que el presupuesto incluya el control de calidad. Que vaya como capítulo propio es la práctica habitual, pero el anejo I no lo dice.
- El plan y el pliego se solapan. El plan puede remitir al pliego en los criterios de aceptación y rechazo, o al revés.

**Consecuencia para la app.** El documento es un «Anejo a la memoria: Plan de control de calidad», solo en proyecto de ejecución. La valoración económica de ensayos y pruebas se lleva al presupuesto del proyecto. Su ubicación por defecto (capítulo propio) se marca como INTERPRETACIÓN.

---

## K-PCC.6 — CTE anejo II: documentación del seguimiento y del control de la obra

**Cita.** [CTE-I] art. 7.1.2, p. 13: «Durante la construcción de la obra se elaborará la documentación reglamentariamente exigible. En ella se incluirá, sin perjuicio de lo que establezcan otras Administraciones Publicas competentes, la documentación del control de calidad realizado a lo largo de la obra. En el anejo II se detalla, con carácter indicativo, el contenido […]».

Anejo II, II.2, p. 22, **VERIFICADO (texto)**:
> «1. El control de calidad de las obras realizado incluirá el control de recepción de productos, los controles de la ejecución y de la obra terminada. Para ello:
> a) El director de la ejecución de la obra recopilará la documentación del control realizado, verificando que es conforme con lo establecido en el proyecto, sus anejos y modificaciones.
> b) El constructor recabará de los suministradores de productos y facilitará al director de obra y al director de la ejecución de la obra la documentación de los productos anteriormente señalada, así como sus instrucciones de uso y mantenimiento, y las garantías correspondientes cuando proceda; y
> c) La documentación de calidad preparada por el constructor sobre cada una de las unidades de obra podrá servir, si así lo autorizara el director de la ejecución de la obra, como parte del control de calidad de la obra.
> 2. Una vez finalizada la obra, la documentación del seguimiento del control será depositada por el director de la ejecución de la obra en el Colegio Profesional correspondiente o, en su caso, en la Administración Publica competente […]».

II.3.3, p. 22: «Al certificado final de obra se le unirán como anejos los siguientes documentos: […] b) Relación de los controles realizados durante la ejecución de la obra y sus resultados.»

Art. 8.1.2, p. 14: «Se incluirá en el Libro del Edificio la documentación indicada en el artículo 7.2 de los productos equipos y sistemas que se incorporen a la obra.»

**Consecuencia para la app.** Fuera del alcance del plan de proyecto, pero conviene que el plan diga a dónde va el resultado: documentación del control (II.2), relación de controles en el certificado final (II.3.3.b) y Libro del Edificio (8.1.2).

---

## K-PCC.7 — Agentes (LOE): quién redacta, quién desarrolla, quién paga

**Cita.** [LOE], **VERIFICADO (texto)**:
- Art. 9.1, p. 9: promotor es quien «decide, impulsa, programa y financia, con recursos propios o ajenos, las obras de edificación […]».
- Art. 10.1, p. 10: «El proyectista es el agente que, por encargo del promotor y con sujeción a la normativa técnica y urbanística correspondiente, redacta el proyecto.»
- Art. 11.2.a, p. 10: el constructor debe «Ejecutar la obra con sujeción al proyecto, a la legislación aplicable y a las instrucciones del director de obra y del director de la ejecución de la obra, a fin de alcanzar la calidad exigida en el proyecto.»
- Art. 12.3.b, p. 11: el director de obra debe «Verificar el replanteo y la adecuación de la cimentación y de la estructura proyectadas a las características geotécnicas del terreno.»
- Art. 13.1, p. 12: el director de la ejecución de la obra «asume la función técnica de dirigir la ejecución material de la obra y de controlar cualitativa y cuantitativamente la construcción y la calidad de lo edificado.» Art. 13.2: «b) Verificar la recepción en obra de los productos de construcción, ordenando la realización de ensayos y pruebas precisas. […] f) Colaborar con los restantes agentes en la elaboración de la documentación de la obra ejecutada, aportando los resultados del control realizado.»
- Art. 14.3.a, p. 12: las entidades y laboratorios deben «Prestar asistencia técnica y entregar los resultados de su actividad al agente autor del encargo y, en todo caso, al responsable técnico de la recepción y aceptación de los resultados de la asistencia, ya sea el director de la ejecución de las obras, o el agente que corresponda […]».
- Art. 15.3.a–b, p. 13: el suministrador responde «de su origen, identidad y calidad» y facilita «las garantías de calidad correspondientes».

[RC-16] art. 7.1, p. 8: «el plan de control elaborado por el autor del proyecto, de acuerdo con esta Instrucción, deberá establecer pautas y criterios para su ejecución al tiempo que el programa de control aprobado por la dirección facultativa (en obras de edificación corresponde al director de ejecución), para el desarrollo de dicho plan, deberá posibilitar su cumplimiento y su adecuación a las circunstancias de la obra.»

**Respuesta.**
- **Redacta** el plan el **proyectista**, como parte del proyecto (LOE art. 10; CTE anejo I). → INTERPRETACIÓN, con apoyo literal en la RC-16 para el cemento («plan de control elaborado por el autor del proyecto»).
- **Lo desarrolla** el **director de la ejecución de la obra**, que ordena ensayos y pruebas (LOE 13.2.b) y recopila la documentación (CTE anejo II.2). → VERIFICADO.
- **Quién paga: la LOE no lo dice.** El promotor es quien «financia» la obra (art. 9.1), y el CTE mete el control de calidad en el presupuesto del proyecto (K-PCC.5). En obra privada, quién asume cada ensayo lo decide el contrato entre promotor y constructor. → INTERPRETACIÓN.
- Las **pruebas que los reglamentos de instalaciones atribuyen a la empresa instaladora** (HS 4, RITE art. 22.2, ITC-BT-05 2.1, ICT, gas) son obligación de quien ejecuta la instalación. → VERIFICADO (texto) que son del instalador (K-PCC.12, K-PCC.17, K-PCC.18). Que su coste vaya en la partida de la instalación es INTERPRETACIÓN.

**SIN CONFIRMAR.** La regla de que los ensayos corren a cargo del contratista hasta el 1 % del presupuesto es de contratación pública (pliego de cláusulas administrativas generales). No se ha leído y **no se aplica a obra privada**. No se codifica.

---

## K-PCC.8 — RD 410/2010: entidades de control y laboratorios de ensayos

**Respuesta.** Está **vigente y sin modificar**. Entidades y laboratorios ejercen tras presentar una **declaración responsable** ante la comunidad autónoma: las entidades, donde tengan su domicilio; los laboratorios, una por cada establecimiento. Con ella pueden actuar en todo el territorio nacional y por tiempo indefinido. Los laboratorios necesitan un sistema de gestión conforme a **UNE EN ISO/IEC 17025**; las entidades, conforme a **UNE EN ISO/IEC 17020**. Pueden inscribirse en el **Registro General del CTE**.

**Cita.** [RD410], **VERIFICADO (texto)**:
- p. 3: «TEXTO CONSOLIDADO / Última modificación: sin modificaciones».
- Art. 2.2, p. 5: «Declaración responsable: es el documento suscrito por el titular de la entidad […] y del laboratorio […] en el que manifiesta, bajo su responsabilidad, que cumple con los requisitos exigibles para el ejercicio de la actividad, que dispone de la documentación que así lo acredita y que se compromete a mantener su cumplimiento […]».
- Art. 4.1, p. 5: «Las entidades y laboratorios presentarán ante el Órgano competente una declaración responsable con carácter previo al inicio de su actividad. Esta declaración permitirá, con carácter indefinido, ejercer su actividad en todo el territorio español […]». Art. 4.2.b: «Los laboratorios presentarán una declaración responsable por cada uno de sus establecimientos físicos desde los que preste sus servicios, ante el Órgano competente de la comunidad autónoma donde se ubique.»
- Anexo II.1.b, p. 11: «Tener implantado un sistema de gestión de la calidad de acuerdo con la norma UNE EN ISO/IEC 17025 […]». Anexo II.A, p. 11, grupos indicativos de ensayos: «a. Ensayos de geotecnia. b. Ensayos de viales. c. Ensayos de pruebas de servicio. d. Ensayos de estructuras de hormigón estructural. e. Ensayos de estructuras de acero estructural. f. Ensayos de obras de albañilería.»
- Anexo I.1.b, p. 9 (entidades): sistema de gestión «conforme con la norma UNE EN ISO/IEC 17020».
- DT única.2, p. 7: los laboratorios acreditados por el RD 1230/1989 «seguirán prestando su asistencia técnica […] sin necesidad de presentar la declaración responsable».
- DD única, p. 7: deroga el «Real Decreto 1230/1989, de 13 de octubre», la «Orden FOM/2060/2002, de 2 de agosto» y la «Orden FOM/898/2004, de 30 de marzo».
- DF 2.ª, p. 9, que añade al art. 4.4 la letra d) ([CTE-I] p. 10): en el Registro General del CTE pueden inscribirse «Las entidades de control de calidad de la edificación y los laboratorios de ensayos para el control de calidad de la edificación acreditados, así como los que presenten una declaración responsable desde la entrada el vigor de la Ley 25/2009 […] el 27 de diciembre de 2009.»
- [LOE] art. 14.2, p. 12, en el mismo sentido: «será suficiente con la presentación de una declaración responsable por cada uno de sus establecimientos físicos […]».

**Nota.** El art. 4.3 cita el «artículo 71 bis de la Ley 30/1992». Esa ley la sustituyó la Ley 39/2015 (**SIN CONFIRMAR** aquí; no es una cita del plan).

**Consecuencia para la app.** Fórmula: «laboratorio de ensayos para el control de calidad de la edificación con declaración responsable presentada conforme al RD 410/2010 (art. 14 LOE)». Nunca «laboratorio homologado» ni «acreditado conforme al RD 1230/1989».

---

## K-PCC.9 — Productos de construcción: Reglamento (UE) 305/2011 y Reglamento (UE) 2024/3110 a 24-10-2026

**Respuesta.**
- El **Reglamento (UE) 2024/3110 se aplica desde el 08-01-2026** y deroga el 305/2011 con efectos de esa fecha.
- **Excepción:** los artículos 2, 4 a 9, 11 a 18, 27–28, 36 a 40, 47–49, 52–53, 55 y 60 a 64 y los **anexos III (modelo de declaración de prestaciones) y V (sistemas EVCP 1+, 1, 2+, 3, 4)** del 305/2011 siguen **hasta el 08-01-2040**. Desde 2026 solo se aplican a los productos cubiertos por las **normas armonizadas del 305/2011 que sigan en la lista** y a los DEE publicados hasta el 08-01-2026.
- Para cada familia, las obligaciones del 2024/3110 empiezan **un año después** del acto de ejecución que haga obligatoria su especificación técnica armonizada, salvo que el acto fije una fecha posterior. Entonces el documento pasa a ser la **«declaración de prestaciones y de conformidad»** y los sistemas son los del anexo IX: **1+, 1, 2+, 3+, 3 y 4** (el **3+** es nuevo: sostenibilidad medioambiental).

**Cita.**
- [R3110] art. 94, p. 75/106, **VERIFICADO (texto)**: «Queda derogado el Reglamento (UE) n.o 305/2011 con efectos a partir del 8 de enero de 2026, a excepción del artículo 2, los artículos 4 a 9, los artículos 11 a 18, los artículos 27 y 28, los artículos 36 a 40, los artículos 47 a 49, los artículos 52 y 53, el artículo 55, los artículos 60 a 64, y los anexos III y V de dicho Reglamento, que quedan derogados con efectos a partir del 8 de enero de 2040.»
- Art. 95.3, p. 76/106: «Las normas armonizadas cuyas referencias figuran en la lista publicada de acuerdo con el artículo 17, apartado 5, del Reglamento (UE) n.o 305/2011 que estén en vigor el 8 de enero de 2026 seguirán siendo válidas con arreglo al Reglamento (UE) n.o 305/2011 hasta que sean retiradas por la Comisión o derogadas de otro modo.»
- Art. 95.8, p. 76/106: «El artículo 2, los artículos 4 a 9, […] del Reglamento (UE) n.o 305/2011 solo se aplicarán a los productos cubiertos por las normas a las que se refiere el apartado 3 del presente artículo o a los productos cubiertos por los documentos de evaluación europeos a los que se refiere el apartado 4 del presente artículo.»
- Art. 95.9, p. 76/106: «Los requisitos y las obligaciones de los operadores económicos establecidos en los capítulos I, II y III solo serán aplicables a una determinada familia de productos o categoría de productos dentro de dicha familia transcurrido un año desde la fecha de adopción de un acto de ejecución al que se refiere el artículo 5, apartado 8, que haga obligatoria una norma armonizada o un acto de ejecución al que se refiere el artículo 6, apartado 1, que se aplique a esa familia de productos […]».
- Art. 95.4, p. 76/106: los DEE listados hasta el 08-01-2026 «seguirán siendo válidos hasta el 9 de enero de 2031», y no se introducirán productos con ETE basadas en ellos «después del 9 de enero de 2036».
- Art. 96, pp. 76–77/106: «Será aplicable a partir del 8 de enero de 2026, a excepción del artículo 1, […] que serán aplicables a partir del 7 de enero de 2025, y del artículo 92, que serán aplicables a partir del 8 de enero de 2027.»
- Art. 15.1, p. 31/106: «La declaración de prestaciones y de conformidad se elaborará utilizando el modelo que figura en el anexo V.» Art. 17.2, p. 32/106: «El marcado CE se colocará únicamente en aquellos productos respecto de los cuales el fabricante haya elaborado una declaración de prestaciones y de conformidad con arreglo a los artículos 13 y 15.»
- Anexo IX, pp. 97–98/106: «Sistemas de evaluación y verificación: 1. Sistema 1+ […] 2. Sistema 1 […] 3. Sistema 2+ […] 4. Sistema 3+ / Control de la evaluación de la sostenibilidad medioambiental por parte del organismo notificado […] 5. Sistema 3 […] 6. Sistema 4».
- [R305] art. 4.1, L 88/12: «Cuando un producto de construcción esté cubierto por una norma armonizada o sea conforme con una evaluación técnica europea emitida para el mismo, el fabricante emitirá una declaración de prestaciones cuando dicho producto se introduzca en el mercado.» Art. 8.2, L 88/13: «El marcado CE se colocará en los productos de construcción respecto de los cuales el fabricante haya emitido una declaración de prestaciones con arreglo a los artículos 4 y 6.» Anexo V, L 88/42–43: «Sistemas de evaluación y verificación de la constancia de las prestaciones»: 1+, 1, 2+, 3, 4.
- [RD2026-1310], DO L 28-08-2026, **VERIFICADO (texto)**: «por el que se completa el Reglamento (UE) 2024/3110 […] mediante el establecimiento de los sistemas de evaluación y verificación aplicables a familias y categorías de productos». Art. 4: «entrará en vigor a los veinte días de su publicación». Eso da el 17-09-2026 (INTERPRETACIÓN del cómputo).

**SIN CONFIRMAR.**
- Si a 24-10-2026 hay **algún acto de ejecución del art. 5.8 o del 6.1** que haga obligatoria una norma armonizada del 2024/3110 para alguna familia, y si ya ha pasado el año. **No se ha encontrado ninguno.**
- El **real decreto español** que desarrolla el 2024/3110: hay un proyecto notificado (TRIS 2025/0632/ES), LEÍDO (web, secundaria); **no consta publicado en el BOE**.

**Consecuencia para la app.** Fórmula de recepción para productos con norma armonizada: «marcado CE y declaración de prestaciones (Reglamento (UE) n.º 305/2011, vigente para los productos cubiertos por normas armonizadas publicadas a su amparo, art. 95 del Reglamento (UE) 2024/3110) o, para las familias ya sujetas al Reglamento (UE) 2024/3110, declaración de prestaciones y de conformidad». Sistemas: 1+, 1, 2+, 3, 4 (305) y 1+, 1, 2+, 3+, 3, 4 (3110). **El sistema concreto de cada producto no se codifica a mano:** sale de su norma armonizada o del Reglamento Delegado 2026/1310, cuyos anexos no se han recorrido.

---

## K-PCC.10 — RD 1630/1992 y RD 1328/1995

**Respuesta.** **CORREGIDO (encargo):** el RD 1630/1992 está **derogado en su totalidad desde el 01-07-2020**, no solo en parte. El RD 1328/1995 no tenía contenido propio: sustituía artículos del RD 1630/1992 y cae con él.

**Cita.**
- [RD1630] p. 3, **VERIFICADO (texto)**: «Norma derogada, con efectos de 1 de julio de 2020, por la disposición derogatoria única.1.g) del Real Decreto 542/2020, de 26 de mayo. Ref. BOE-A-2020-6472».
- [RD542] DD única.1, p. 29: «Quedan derogados los reales decretos que se relacionan a continuación: […] g) Real Decreto 1630/1992, de 29 de diciembre, por el que se dictan disposiciones para la libre circulación de productos de construcción, en aplicación de la Directiva 89/106/CEE.» DF única, p. 30: «El presente real decreto entrará en vigor el 1 de julio de 2020.»
- [RD1328] ficha «Análisis», **LEÍDO (web)**: «SUSTITUYE los arts. 2.1.B), 5, Anexo II, la Expresión indicada y modifica el art. 7 del Real Decreto 1630/1992 […]».

**INTERPRETACIÓN.** Como el RD 1328/1995 solo modificaba el RD 1630/1992, con la derogación de este queda sin objeto.

**Consecuencia para la app.** Ni «RD 1630/1992», ni «RD 1328/1995», ni «RD 1329/1995» en el texto generado (K-PCC.19).

---

## K-PCC.11 — RC-16 (RD 256/2016, modificado por el RD 320/2024)

**Respuesta.** Está **vigente**, en la redacción del RD 320/2024 (en vigor desde el 01-07-2024). La recepción del cemento tiene tres fases. La **1.ª, documental (con etiquetado), y la 2.ª, de inspección visual, son obligatorias**; la **3.ª, de ensayos, es potestativa**: la aplica el responsable de la recepción, o el proyecto si la prevé. Lotes: los de igual designación y procedencia recibidos en un mes, partidos por cada **200 t** o fracción cuando se pasa de esa cantidad mensual («como mínimo, se constituyan dos lotes por mes»), y al menos un lote al mes en el suministro discontinuo.

**Cita.** [RC-16], **VERIFICADO (texto)**:
- p. 3: «Última modificación: 10 de abril de 2024». DD única, p. 4: «A la entrada en vigor de este real decreto, queda derogado el Real Decreto 956/2008, de 6 de junio, por el que se aprueba la Instrucción para la recepción de cementos (RC-08).»
- Art. 7.1, p. 8: «La recepción comprenderá: a) control de la documentación, incluidos los distintivos de calidad, en su caso, y del etiquetado, según 8.1; b) control del suministro mediante inspección visual, según 8.2; y c) en su caso, control mediante ensayos, conforme al apartado 8.3.»
- Art. 7.2, p. 8: «b) En general, y sin perjuicio de lo que se establezca en el plan de control, el lote lo formará el conjunto de remesas o cantidad mensual recibida de cemento de igual designación y procedencia, salvo que se sobrepase la cantidad mensual de 200 toneladas de peso, en cuyo caso las remesas recibidas serán divididas formando lotes por cada 200 toneladas o fracción, de modo que, como mínimo, se constituyan dos lotes por mes.»
- Art. 8, p. 9: «– una primera fase de comprobación de la documentación, incluidos los distintivos de calidad y de sostenibilidad, en su caso, y del etiquetado del cemento envasado; y – una segunda fase, consistente en una inspección visual del suministro. Ambas fases son obligatorias cualquiera que sea la organización del control.» Art. 8.1.c, p. 9: «la declaración de prestaciones correspondiente al marcado CE, según el apartado AIV.2.2, o, en su caso, la certificación de conformidad del Real Decreto 1313/1988, de 28 de octubre […]».
- Art. 8.3, p. 11: «Esta tercera fase de la recepción es potestativa y de aplicación cuando, en su caso, el proyecto en función de las características especiales de la obra o en previsión de la posible presencia en la recepción de los defectos citados, así lo establezca.»
- [RD320], Sec. I, pág. 39961: «El presente real decreto entrará en vigor el 1 de julio de 2024.»

**INTERPRETACIÓN.** Si el hormigón es preparado, el cemento se recibe en la central y no en obra. El control de cemento del plan solo aplica a cemento suministrado a obra (morteros u hormigones hechos en obra). Lo que pide el Código Estructural para el hormigón es del otro verificador.

**Consecuencia para la app.** En las partidas con cemento a obra: fases 1 y 2 obligatorias; fase 3 «si el proyecto lo establece». Lote por defecto según el art. 7.2.

---

## K-PCC.12 — DB HS: control de ejecución y de obra terminada

**Respuesta por sección.**

| Sección | Recepción | Ejecución | Obra terminada | ¿Prueba obligatoria? |
|---|---|---|---|---|
| HS 1 Humedad | 4.2: según pliego; ensayos «cuando así se establezca en el pliego de condiciones o lo determine el director de la ejecución» | 5.2: «controles y […] frecuencia […] establecida en el pliego» | 5.3: «**no se prescriben pruebas finales**» | **No.** **CORREGIDO (encargo): no hay prueba de estanqueidad de cubierta plana en el CTE** |
| HS 2 Residuos | — | — | — | Sin apartado de construcción |
| HS 3 Aire interior | 5.2 (igual que HS 1) | 6.2 | 6.3: «no se prescriben pruebas finales» | No |
| HS 4 Suministro de agua | — | — | 5.2 Puesta en servicio: prueba de resistencia mecánica y estanquidad + pruebas de ACS | **Sí** («estará obligada»), empresa instaladora |
| HS 5 Evacuación de aguas | — | — | 5.6: estanqueidad parcial + total (agua, aire o humo) | **Sí** («Se realizarán»), con valores numéricos |
| HS 6 Radón | 4.2 (igual que HS 1) | 5.2 | 5.3: solo remite al art. 7.4 | No prescribe ninguna |

**Cita.** [HS], **VERIFICADO (texto)**:
- HS 1, 4.2, p. 40: «1 En el pliego de condiciones del proyecto deben indicarse las condiciones de control para la recepción de los productos, incluyendo los ensayos necesarios para comprobar que los mismos reúnen las características exigidas en los apartados anteriores. 2 Debe comprobarse que los productos recibidos: a) corresponden a los especificados en el pliego de condiciones del proyecto; b) disponen de la documentación exigida; c) están caracterizados por las propiedades exigidas; d) han sido ensayados, cuando así se establezca en el pliego de condiciones o lo determine el director de la ejecución de la obra con el visto bueno del director de obra, con la frecuencia establecida.»
- HS 1, 5.2.2, p. 45: «Se comprobará que la ejecución de la obra se realiza de acuerdo con los controles y con la frecuencia de los mismos establecida en el pliego de condiciones del proyecto.»
- HS 1, 5.3, p. 45: «En el control se seguirán los criterios indicados en el artículo 7.4 de la parte I del CTE. En esta sección del DB no se prescriben pruebas finales.» Se buscaron «estanq», «inunda», «prueba» y «ensayo» en todo HS 1: no hay ninguna prueba de cubierta.
- HS 3, 6.3, p. 74: «En esta sección del DB no se prescriben pruebas finales.»
- HS 4, 5.2.1.1, pp. 100–101: «1 La empresa instaladora estará obligada a efectuar una prueba de resistencia mecánica y estanquidad de todas las tuberías, elementos y accesorios que integran la instalación, estando todos sus componentes vistos y accesibles para su control. […] a) para las tuberías metálicas se considerarán válidas las pruebas realizadas según se describe en la norma UNE 100 151:1988; b) para las tuberías termoplásticas y multicapas se considerarán válidas las pruebas realizadas conforme al procedimiento de ensayo A de la norma UNE-CEN/TR 12108:2015 IN. 3 Una vez realizada la prueba anterior, a la instalación se le conectarán la grifería y los aparatos de consumo, sometiéndose nuevamente a la prueba anterior. 4 El manómetro que se utilice en esta prueba debe apreciar como mínimo intervalos de presión de 0,1 bar.»
- HS 4, 5.2.1.2, p. 101: «En las instalaciones de preparación de ACS se realizarán las siguientes pruebas de funcionamiento: a) medición de caudal y temperatura en los puntos de agua; b) obtención de los caudales exigidos a la temperatura fijada una vez abiertos el número de grifos estimados en la simultaneidad; c) comprobación del tiempo que tarda el agua en salir a la temperatura de funcionamiento […]; d) medición de temperaturas de la red; e) con el acumulador a régimen, comprobación con termómetro de contacto de las temperaturas del mismo, en su salida y en los grifos. La temperatura del retorno no debe ser inferior en 3 ºC a la de salida del acumulador.»
- HS 5, 5.6.1, p. 129: «1 Se realizarán pruebas de estanqueidad parcial descargando cada aparato aislado o simultáneamente, verificando los tiempos de desagüe, los fenómenos de sifonado […]. 2 No se admitirá que quede en el sifón de un aparato una altura de cierre hidráulico inferior a 25 mm. 3 […] no se acumulará agua en el aparato en el tiempo mínimo de 1 minuto. 4 En la red horizontal se probará cada tramo de tubería, para garantizar su estanqueidad introduciendo agua a presión (entre 0,3 y 0,6 bar) durante diez minutos. 5 Las arquetas y pozos de registro se someterán a idénticas pruebas llenándolos previamente de agua y observando si se advierte o no un descenso de nivel. 6 Se controlarán al 100 % las uniones, entronques y/o derivaciones.»
- HS 5, 5.6.2–5.6.5, p. 130: «Las pruebas deben hacerse sobre el sistema total, bien de una sola vez o por partes […]». Prueba con agua: «sobre las redes de evacuación de aguas residuales y pluviales […] no debe ser inferior a 0,3 bar, ni superar el máximo de 1 bar». Prueba con aire: «entre 0,5 y 1 bar como máximo […] satisfactoria cuando la presión se mantenga constante durante tres minutos». Prueba con humo: «sobre la red de aguas residuales y su correspondiente red de ventilación […] mantener una presión de gases de 250 Pa».
- HS 6, 4.2, p. 141 (igual que HS 1); 5.3, p. 143: «En el control deben seguirse los criterios indicados en el artículo 7.4 de la Parte I del CTE.»

**INTERPRETACIÓN.**
- En HS 5 la prueba total se hace con **una** de las tres (agua, aire o humo). El DB las describe como alternativas sin decir cuál; la de humo solo vale para residuales con su ventilación.
- La prueba de estanqueidad de cubierta plana de las plantillas de ejemplo sale de Documentos Reconocidos autonómicos (una plantilla cita el «DRC 06/09 de la Generalitat Valenciana») o de la decisión del proyectista. En el CTE estatal es una prueba «prevista en el proyecto» (art. 7.4). Andalucía: otro verificador.

**Consecuencia para la app.** Partidas de fontanería → pruebas HS 4 (obligatorias, del instalador). Partidas de saneamiento → pruebas HS 5 parcial y total (obligatorias). Partidas de cubierta plana → prueba de estanqueidad **propuesta y desmarcable**, con la etiqueta «a criterio del proyecto (CTE art. 7.4); no exigida por el DB HS 1». Ventilación y radón → sin prueba final.

---

## K-PCC.13 — DB HE: ninguna sección prescribe pruebas finales; n50

**Cita.** [HE], **VERIFICADO (texto)**:
- «En esta Sección del Documento Básico no se prescriben pruebas finales.»: HE 0, 6.3 (p. 14); HE 1, 5.6 (p. 20); HE 3, 5.3 (p. 27); HE 4, 5.3 (p. 29); HE 5, 5.3 (p. 32); HE 6, 5.3 (p. 35). HE 2 remite al RITE.
- HE 1, 5.4.1, p. 20: «En el pliego de condiciones del proyecto han de indicarse las condiciones particulares de control para la recepción de los productos que forman los cerramientos y particiones interiores de la envolvente térmica, incluyendo los ensayos necesarios […]». 5.5.4: «En el Libro del Edificio se incluirá la documentación referente a las características de los productos, equipos y sistemas incorporados a la obra.»
- HE 1, 3.1.3.4, p. 18: «En edificios nuevos de uso residencial privado con una superficie útil total superior a 120 m2, la relación del cambio de aire con una presión diferencial de 50 Pa (n50) no superará el valor límite de la tabla 3.1.3.b-HE1.» (V/A ≤ 2 → 6; V/A ≥ 4 → 3 h⁻¹; interpolación entre ambos.)
- Anejo H, p. 56: «La determinación de la permeabilidad al aire del edificio debe realizarse con alguno de los métodos siguientes: 1 Determinación mediante ensayo […] método 1 ó 2 de la norma UNE-EN ISO 9972:2019 […] 2 Determinación mediante valores de referencia […] n50 = 0,629 · (Co · Ao + Ch · Ah) / Vint».
- HE 6, 5.2.1, p. 34: control de ejecución «siguiendo lo especificado en el Reglamento electrotécnico de baja tensión».

**INTERPRETACIÓN.** El ensayo de presurización (blower door) **no es obligatorio**: el n50 puede justificarse con valores de referencia en proyecto. Es un ensayo voluntario u opcional del proyecto.

**Consecuencia para la app.** Partidas de envolvente térmica: recepción documental (conductividad, U, permeabilidad de huecos, marcado CE). Blower door solo como ensayo opcional, propuesto en vivienda nueva de más de 120 m² útiles.

---

## K-PCC.14 — DB HR: mediciones in situ

**Cita.** [HR], **VERIFICADO (texto)**:
- 4.3, HR-32: igual que HS 1 4.2 (pliego; productos «ensayados, cuando así se establezca en el pliego de condiciones o lo determine el director de la ejecución de la obra»).
- 5.3, HR-35: «1 En el control se seguirán los criterios indicados en el artículo 7.4 de la Parte I del CTE. 2 En el caso de que se realicen mediciones in situ para comprobar las exigencias de aislamiento acústico a ruido aéreo, de aislamiento acústico a ruido de impactos y de limitación del tiempo de reverberación, se realizarán por laboratorios acreditados y conforme a lo establecido en las UNE-EN ISO 16283-1 y UNE-EN ISO 16283-3 para ruido aéreo, en la UNE-EN ISO 16283-2 para ruido de impactos y en la UNE-EN ISO 3382 para tiempo de reverberación. […] 3 Para el cumplimiento de las exigencias de este DB se admiten tolerancias entre los valores obtenidos por mediciones in situ y los valores límite establecidos en el apartado 2.1 de este DB, de 3 dBA para aislamiento a ruido aéreo, de 3 dB para aislamiento a ruido de impacto y de 0,1 s para tiempo de reverberación. 4 En el caso de fachadas, cuando se dispongan como aberturas de admisión de aire, según DB-HS 3, sistemas con dispositivo de cierre […] la verificación […] se realizará con dichos dispositivos cerrados.»

**INTERPRETACIÓN.** «En el caso de que se realicen»: las mediciones in situ **no son obligatorias** por el DB HR. Si se hacen, deben cumplir esas normas, hacerlas laboratorios «acreditados» y tienen esas tolerancias.

**Consecuencia para la app.** Ensayo acústico in situ opcional: aéreo entre recintos, impactos, fachada D2m,nT,Atr y tiempo de reverberación. Muestreo a definir por el proyectista (el DB no fija ninguno).

---

## K-PCC.15 — DB SI y DB SUA

**Cita.**
- [SI] IV, p. 6, **VERIFICADO (texto)**: «La aplicación de los procedimientos de este DB se llevará a cabo de acuerdo con las condiciones particulares que en el mismo se establecen y con las condiciones generales para el cumplimiento del CTE, las condiciones del proyecto, las condiciones en la ejecución de las obras y las condiciones del edificio que figuran en los artículos 5, 6, 7 y 8 respectivamente de la parte I del CTE.» V.1, p. 6: las condiciones de reacción y resistencia al fuego se dan «conforme a las nuevas clasificaciones europeas establecidas mediante el Real Decreto 842/2013 de 31 de octubre». SI 4: la señalización de las instalaciones manuales «debe cumplir lo establecido en el vigente Reglamento de instalaciones de protección contra incendios, aprobado por el Real Decreto 513/2017».
- [SUA] SUA 1, p. 8: «El valor de resistencia al deslizamiento Rd es el valor PTV obtenido mediante el ensayo del péndulo descrito en la norma UNE 41901:2017 EX. La muestra seleccionada será representativa de las condiciones más desfavorables de resbaladicidad.» IV, p. 5: misma remisión a los arts. 5–8 de la Parte I.

**Respuesta.** Ni el DB SI ni el DB SUA tienen apartados de control de ejecución ni de obra terminada. El control es el general del art. 7, más:
- **SI:** recepción documental de las clasificaciones de reacción y resistencia al fuego (RD 842/2013; su vigencia no se ha comprobado aquí → **SIN CONFIRMAR**). Las instalaciones se rigen por el RIPCI (K-PCC.18).
- **SUA:** recepción documental de la **clase de resbaladicidad** de los pavimentos (Rd según UNE 41901:2017 EX), según su localización (tabla 1.2).

**Consecuencia para la app.** Partidas de pavimento → recepción: clase Rd exigida por la localización. Puertas y sectorización → recepción: clasificación EI/E y certificado del cierre automático (UNE-EN 1154/1158/1155, SI V.3–4).

---

## K-PCC.16 — DB SE-C, SE-F, SE-M, SE-A (y DB SE)

**Cita.** [SE-C], **VERIFICADO (texto)**:
- 4.6.2.1, SE-C-40: «Antes de proceder a la ejecución de la cimentación se realizará la confirmación del estudio geotécnico según el apartado 3.4. Se comprobará visualmente, o mediante las pruebas que se juzguen oportunas, que el terreno de apoyo de aquella se corresponde con las previsiones del proyecto. El resultado de tal inspección […] se incorporará a la documentación final de obra.»
- 4.6.3, SE-C-40: se comprobará que «a) los materiales disponibles se ajustan a lo establecido en el proyecto de edificación y son idóneos para la construcción; b) las resistencias son las indicadas en el proyecto.» 4.6.4, SE-C-40: lista de comprobaciones durante la ejecución, de a) a p): replanteo, dimensiones, armaduras, recubrimientos, hormigón de limpieza, vibrado, juntas, impermeabilizaciones…
- 4.6.5.2, SE-C-41: «Si bien es recomendable controlar los movimientos del terreno para cualquier tipo de construcción, en edificios de tipo C-3 y C-4 será obligado el establecimiento de un sistema de nivelación para controlar el asiento de las zonas más características de la obra […]».
- 5.4.2.1.9, SE-C-57: «El número y la naturaleza de los ensayos se fijarán en el Pliego de condiciones del proyecto y se establecerán antes del comienzo de los trabajos. El número de ensayos no debe ser inferior a 1 por cada 20 pilotes, salvo en el caso de pilotes aislados con diámetros entre 45 y 100 cm que no debe ser inferior a 2 por cada 20 pilotes. En pilotes aislados de diámetro superior a 100 cm no debe ser inferior a 5 por cada 20 pilotes.» (Ensayos de integridad: «a) transparencia sónica; b) impedancia mecánica; c) sondeos mecánicos a lo largo del pilote».)
- 5.4.2.3.7, SE-C-59: «Para edificios de categoría C-3 y C-4, en pilotes prefabricados, se considera necesaria la realización de pruebas dinámicas de hinca contrastadas con pruebas de carga.»
- 9.1.5, SE-C-99: «a) ensayo de aceptación: prueba de carga in situ para confirmar que cada anclaje cumple las condiciones previstas en el proyecto». 9.4, SE-C-102: «se consideran válidas las especificaciones contenidas en la norma UNE EN 1537:2015».
- 6.4.2.1, SE-C-92: «Los elementos de contención de hormigón cumplirán los condicionantes definidos en este DB y en la Instrucción EHE.» (cita derogada, ver más abajo).

[SE-F], **VERIFICADO (texto)**:
- 8.1.1, SE-F-43: «1 Las piezas se suministrarán a obra con una declaración del suministrador sobre su resistencia y la categoría de fabricación. […] 7 Si no existe valor declarado por el fabricante para el valor de resistencia a compresión en la dirección de esfuerzo aplicado, se tomarán muestras en obra según UNE EN 771 y se ensayarán según UNE-EN 772-1:2011+A1:2016 […]». 8.1.2.3: arenas, «Se realizará una inspección ocular de características y, si se juzga preciso, se realizará una toma de muestras para la comprobación de características en laboratorio.»
- 8.2.1, SE-F-44: «Se establecen tres categorías de ejecución: A, B y C». Categoría A: piezas con certificación, mortero con resistencias a 7 y 28 días, «certificado de ensayos previos a compresión según la norma UNE EN 1052-1:1999 […]» e «inspección diaria de la obra ejecutada». B: igual que A salvo succión y retracción o expansión, mortero a 28 días e inspección diaria. «Categoría C: Cuando no se cumpla alguno de los requisitos establecidos para la categoría B.»
- 8.3, SE-F-45: «Se admite la mezcla manual únicamente en proyectos con categoría de ejecución C. […] 6 Cuando se establezca la determinación mediante ensayos de la resistencia del mortero, se usará la UNE-EN 1015-11:2000.»

[SE-M] 13.1.2, SE-M 92–93, **VERIFICADO (texto)**: a la llegada a obra, el director de la ejecución comprueba el aspecto, la identificación (13.1.1) y, en madera aserrada, especie, clase resistente, tolerancias (UNE-EN 336:2014) y «contenido de humedad: Salvo especificación en contra debe ser ≤ 20%, valor medido con xilohigrómetro según norma UNE-EN 13183-2:2002». En madera tratada, el certificado del tratamiento; en herrajes, la certificación del material y de la protección. 13.1.2.2: «El incumplimiento de alguna de las especificaciones de un producto, salvo demostración de que no suponga riesgo apreciable […] será condición suficiente para la no-aceptación del producto y en su caso de la partida.»

[SE-A], **VERIFICADO (texto)**:
- 10.8.4.1, SE-A-119: «En el pliego de condiciones se indicará si se realizarán o no ensayos no destructivos, los métodos a emplear y la localización de las soldaduras que se van a inspeccionar, pero se debe realizar siempre una inspección visual sobre toda la longitud de todas las soldaduras […]. 2 […] se ensayarán las cinco primeras uniones de cada tipo […]. Si estas cinco primeras cumplen los criterios de aceptación, se ensayará una en cinco uniones de cada tipo. 3 En soldaduras longitudinales, se ensayarán 0,5 m cada 10 m o parte, de todas las uniones (incluyendo uno en cuatro extremos de soldadura). 4 En soldadura de atado (correas, rigidizadores de pandeo, etc.) se ensayará uno en veinte puntos de fijación.»
- 12.3, SE-A-133: «1 En el caso de materiales cubiertos por un certificado expedido por el fabricante el control podrá limitarse al establecimiento de la traza que permita relacionar de forma inequívoca cada elemento de la estructura con el certificado de origen que lo avala. 2 Cuando en la documentación del proyecto se especifiquen características no avaladas por el certificado de origen del material […] se establecerá un procedimiento de control mediante ensayos realizados por un laboratorio independiente.» 12.4.1 y 12.5.1: revisión y aprobación por la dirección facultativa de la documentación de taller y de montaje (con su plan de puntos de inspección).

[SE] 1.1.2, SE-1, **VERIFICADO (texto)**: «Deberán tenerse en cuenta, además, las especificaciones de la normativa siguiente: – NCSE […] – EHE Instrucción de hormigón estructural – EFHE Instrucción para el proyecto y la ejecución de forjados unidireccionales […]». Introducción III, p. 3: «Cuando se cita una disposición reglamentaria en este DB debe entenderse que se hace referencia a la versión vigente en el momento en el que se aplica el mismo.»

[CodE], **VERIFICADO (texto)**: DD única, p. 7: «1. Quedan derogados el Real Decreto 1247/2008, de 18 de julio, por el que se aprueba la instrucción de hormigón estructural (EHE-08), y el Real Decreto 751/2011, de 27 de mayo, por el que se aprueba la Instrucción de Acero Estructural (EAE).» Art. 2, p. 8: «Este Código Estructural es de aplicación a todas las estructuras y elementos estructurales de hormigón, de acero o mixtos de hormigón-acero […]».

**INTERPRETACIÓN.**
- El **DB SE-A no está derogado expresamente**: la DD del Código Estructural solo nombra la EHE-08 y la EAE, más la cláusula general. Como el Código Estructural se aplica a «todas las estructuras […] de acero», **cómo convive con el DB SE-A en la ejecución y el control de estructuras de acero de edificación lo decide el verificador del Código Estructural.** Aquí solo se deja constancia del texto del DB.
- Las citas de «EHE»/«EFHE» de los DB SE, SE-C, SE-F y SI son texto no actualizado. La cláusula de «versión vigente» del DB SE permite leerlas como remisión a la norma que las sustituye. **SE-C, SE-F, SE-M y SE-A no tienen esa cláusula** (se buscó en los cuatro). La sustitución se apoya entonces en la derogación expresa ([CodE] DD única).
- **Hormigón y armaduras:** no están en los DB. Son del Código Estructural.

**Consecuencia para la app.** Cimentación → confirmación geotécnica y comprobaciones 4.6.2–4.6.5; nivelación obligatoria si el edificio es C-3/C-4 (dato del proyectista). Pilotes in situ → ensayos de integridad con ≥1/20, ≥2/20 o ≥5/20 según diámetro y si están aislados. Fábrica → declaración de resistencia y categoría de las piezas; categoría de ejecución A/B/C (dato). Madera → identificación y humedad ≤20 %. Acero → **pendiente del verificador del Código Estructural**.

---

## K-PCC.17 — RITE y REBT

**Cita.** [RITE], **VERIFICADO (texto)**:
- Art. 20.1, p. 15: el control de recepción comprende el «i. Control de la documentación de los suministros; ii. control mediante distintivos de calidad […]; iii. control mediante ensayos y pruebas.» 20.2.c: «documentos de conformidad o autorizaciones administrativas exigidas reglamentariamente, incluida la documentación correspondiente al marcado CE, etiquetado energético cuando sea pertinente […]».
- Art. 22, p. 16: «2. Las pruebas de la instalación se efectuarán por la empresa instaladora, que dispondrá de los medios humanos y materiales necesarios para efectuar las pruebas parciales y finales de la instalación, de acuerdo a los requisitos de la IT 2. 3. Todas las pruebas se efectuarán en presencia del instalador habilitado o del director de la instalación, cuando la participación de este último sea preceptiva […]. 4. Los resultados de las distintas pruebas […] pasarán a formar parte de la documentación final de la instalación.»
- IT 2.2.2.1, p. 71: «Todas las redes de circulación de fluidos portadores deben ser probadas hidrostáticamente, a fin de asegurar su estanquidad, antes de quedar ocultas por obras de albañilería, material de relleno o por el material aislante. 2. Son válidas las pruebas realizadas de acuerdo a la norma UNE-EN 14.336, para tuberías metálicas o a UNE-ENV 12.108 para tuberías plásticas.»
- IT 2.2.2.4, p. 71: «En el caso de circuitos cerrados de agua refrigerada o de agua caliente hasta una temperatura máxima de servicio de 100 °C, la presión de prueba será equivalente a una vez y media la presión máxima efectiva de trabajo a la temperatura de servicio, con un mínimo de 6 bar; para circuitos de agua caliente sanitaria, la presión de prueba será equivalente a dos veces la presión máxima efectiva de trabajo a la temperatura de servicio, con un mínimo de 6 bar. 2. Para los circuitos primarios de las instalaciones de energía solar, la presión de la prueba será de una vez y media la presión máxima de trabajo del circuito primario, con un mínimo de 3 bar […]».
- IT 2.2.3 a 2.2.6, pp. 72–73: circuitos frigoríficos («No es necesario someter a una prueba de estanquidad la instalación de unidades por elementos, cuando se realice con líneas precargadas suministradas por el fabricante del equipo, que entregará el correspondiente certificado de pruebas»), libre dilatación, conductos de aire («deben someterse a pruebas de resistencia estructural y estanquidad»), chimeneas («según las instrucciones de su fabricante»).
- IT 2.2.7, p. 73: «Se consideran válidas las pruebas finales que se realicen siguiendo las instrucciones indicadas en la norma UNE-EN 12599 […]». Solar: prueba de estancamiento.

[REBT], **VERIFICADO (texto)**:
- ITC-BT-04, 5.2, p. 53: «Al término de la ejecución de la instalación, la empresa instaladora realizará las verificaciones que resulten oportunas, en función de las características de aquélla, según se especifica en la ITC-BT-05 y en su caso todas las que determine la dirección de obra.» 5.3, p. 54: «Asimismo, las instalaciones que se especifican en la ITC-BT-05, deberán ser objeto de la correspondiente Inspección Inicial por Organismo de Control.»
- ITC-BT-05, 2.1 y 3, p. 55: «Las verificaciones previas a la puesta en servicio de las instalaciones deberán ser realizadas por las empresas instaladoras que las ejecuten.» / «Las instalaciones eléctricas en baja tensión deberán ser verificadas, previamente a su puesta en servicio y según corresponda en función de sus características, siguiendo la metodología de la norma UNE 20.460 -6-61.»
- ITC-BT-05, 4.1, p. 56: inspección inicial por organismo de control de, entre otras, «b) Locales de pública concurrencia. c) Locales con riesgo de incendio o explosión, de clase I, excepto aparcamientos o estacionamientos de menos de 25 plazas. d) Locales mojados con potencia instalada superior a 25 kW. e) Piscinas con potencia instalada superior a 10 kW. […] h) Instalaciones de las estaciones de recarga para el vehículo eléctrico, que requieran la elaboración de proyecto para su ejecución.» 4.2: periódicas «cada 10 años, las comunes de edificios de viviendas de potencia total instalada superior a 100 kW».

**INTERPRETACIÓN.** En un edificio residencial corriente:
- Las verificaciones del REBT son siempre del instalador.
- Hace falta **inspección inicial por organismo de control** si hay **garaje de 25 plazas o más** (local con riesgo de incendio clase I), piscina comunitaria de más de 10 kW o recarga de vehículo eléctrico con proyecto.
- La norma «UNE 20.460-6-61» es la que cita el REBT; su sustitución por la serie UNE-HD 60364 no se ha comprobado (**SIN CONFIRMAR**). La app cita el REBT, no la UNE.

**Consecuencia para la app.** Climatización/ACS → pruebas IT 2.2 del instalador (estanquidad, resistencia mecánica, libre dilatación, conductos, pruebas finales UNE-EN 12599). Electricidad → verificaciones ITC-BT-05 del instalador + organismo de control **condicionado** a los datos del proyecto (plazas de garaje, piscina, recarga).

---

## K-PCC.18 — RIPCI, ICT y gas

**Cita.**
- [RIPCI] art. 19.2, p. 16, **VERIFICADO (texto)**: «En los edificios a los que sea de aplicación el Código Técnico de la Edificación, Documento Básico "Seguridad en caso de incendio (SI)", las instalaciones de protección contra incendios se atendrán a lo dispuesto en el mismo.» Art. 20.1, p. 16: para la puesta en servicio, «a) La presentación […] de un certificado de la empresa instaladora, emitido por un técnico titulado competente designado por la misma […]; b) Tener suscrito un contrato de mantenimiento con una empresa mantenedora debidamente habilitada […]». Al final del apartado 1: «Para la puesta en servicio de las instalaciones de protección activa contra incendios señaladas en el apartado 2 del artículo anterior, serán también de aplicación los requisitos fijados en el presente artículo.» Art. 20.2: «No será necesaria la puesta en servicio de las instalaciones que consten únicamente de los equipos citados en el artículo 9.2» (extintores, mantas ignífugas, planos de evacuación; p. 10).
- [RIPCI] anexo I, sección 1.ª, 5.5, p. 24: «el sistema de BIE se someterá, antes de su puesta en servicio, a una prueba de estanquidad y resistencia mecánica, sometiendo a la red a una presión estática igual a la máxima de servicio y, como mínimo, a 980 kPa (10 kg/cm2), manteniendo dicha presión de prueba durante dos horas, como mínimo, no debiendo aparecer fugas en ningún punto de la instalación.» (En las BIE de alta presión: 1,5 veces la presión de trabajo máxima, 2 h.) 6.4, p. 25: «El sistema de columna seca, se someterá, antes de su puesta en servicio, a una prueba de estanquidad y resistencia mecánica, sometiéndolo a una presión estática igual a la máxima de servicio y, como mínimo de 1470 kPa (15 kg/cm2) en columnas de hasta 30 m y de 2.450 kPa (25 kg/cm2) en columnas de más de 30 m de altura, durante dos horas, como mínimo […]».
- [ICT] art. 6.4, p. 7, **VERIFICADO (texto)**: «Finalizados los trabajos de ejecución del proyecto técnico mencionado, la empresa instaladora de telecomunicación que ha ejecutado la ICT entregará al titular de la propiedad […] un boletín de instalación […]. Será, asimismo, responsabilidad de la empresa instaladora, cumplimentar y firmar el protocolo de pruebas realizado para comprobar la correcta ejecución de la instalación, que se ajustará al modelo normalizado incluido como anexo V de esta orden y, adjuntarlo al boletín, excepto en los casos en que exista director de obra. […] cuando exista, el director de obra expedirá y entregará […] un certificado de fin de obra, que se ajuste al modelo normalizado incluido como anexo IV de esta orden, y supervisará y entregará al citado titular el protocolo […]».
- [GAS] ITC-ICG 07, 3.3, p. 45, **VERIFICADO (texto)**: «La empresa instaladora deberá realizar una prueba de estanquidad de las instalaciones receptoras de acuerdo con la norma UNE 60670-8 o la norma UNE 60620, según proceda, y cuyo resultado positivo se indicará en el correspondiente certificado de instalación.»

**Consecuencia para la app.** BIE → prueba ≥980 kPa durante 2 h. Columna seca → prueba ≥1470 kPa (≤30 m) o ≥2450 kPa (>30 m) durante 2 h. Certificado del instalador y contrato de mantenimiento para la puesta en servicio. ICT → protocolo de pruebas (anexo V de la Orden ITC/1644/2011) y boletín. Gas → prueba de estanquidad UNE 60670-8. Todo a cargo de la empresa instaladora. **Ascensores, piscinas, ACS solar con reglamentos propios y agua de consumo (RD 3/2023): no se han verificado → SIN CONFIRMAR.**

---

## K-PCC.19 — Normativa derogada o superada que no debe aparecer en un plan de hoy

| Cita a vetar (patrón) | Norma | Derogada por | Desde | Veredicto |
|---|---|---|---|---|
| `EHE-08`, `RD 1247/2008` | Instrucción de Hormigón Estructural | RD 470/2021 (Código Estructural), DD única.1 ([CodE] p. 7) | 10-11-2021 (entra en vigor «a los tres meses de su publicación», 10-08-2021) | **VERIFICADO (texto)**; la fecha de efectos sale del cómputo y de la ficha BOE, LEÍDO (web) |
| `EAE`, `RD 751/2011` | Instrucción de Acero Estructural | RD 470/2021, DD única.1 | 10-11-2021 | **VERIFICADO (texto)** |
| `EHE` (sin -08), `RD 2661/1998` | Instrucción de Hormigón Estructural EHE | RD 1247/2008, DD única.1.a ([EHE-08] BOE pp. 35177–35178) | 2008 | **VERIFICADO (texto)** |
| `EFHE`, `RD 642/2002` | Forjados unidireccionales prefabricados | RD 1247/2008, DD única.1.b | 2008 | **VERIFICADO (texto)** |
| `RC-08`, `RD 956/2008` | Recepción de cementos | RD 256/2016, DD única ([RC-16] p. 4) | 2016 | **VERIFICADO (texto)** |
| `RC-03`, `RD 1797/2003` | Recepción de cementos | RD 956/2008 | 2008 | LEÍDO (web) ([ANÁL]) |
| `RC-97`, `RD 776/1997` | Recepción de cementos | RD 1797/2003 | 2004 | LEÍDO (web) ([ANÁL]) |
| `NBE CT-79`, `NBE AE-88`, `NBE QB-90`, `NBE FL-90`, `NBE EA-95`, `NBE CPI-96`, `RD 1650/1977` | Normas Básicas de la Edificación | RD 314/2006, DD única.1.a–g ([CTE-I] pp. 6–7) | 29-03-2006, con transitorios de 6 y 12 meses (DT 2.ª) | **VERIFICADO (texto)** |
| `NBE CA-81`, `NBE CA-82`, `NBE CA-88` | Condiciones acústicas | RD 1371/2007, DD única ([RD1371] BOE p. 42993) | 2007 | **VERIFICADO (texto)** |
| `RY-85`, `RL-88`, `RB-90` | Pliegos de recepción de yesos y escayolas, ladrillos cerámicos y bloques de hormigón | RD 1371/2007, DD única | 2007 | **VERIFICADO (texto)** |
| «Orden de 9 de diciembre de 1975» / `Normas básicas para las instalaciones interiores de suministro de agua` | Fontanería | RD 314/2006, DD única.1.h | 2006 | **VERIFICADO (texto)** |
| `89/106/CEE`, «Directiva de productos de construcción» | Directiva | Reglamento (UE) 305/2011, art. 65.1 ([R305] L 88/31), aplicable desde el 01-07-2013 (art. 68) | 01-07-2013 | **VERIFICADO (texto)** |
| `RD 1630/1992` | Libre circulación de productos de construcción | RD 542/2020, DD única.1.g ([RD542] p. 29) | 01-07-2020 | **VERIFICADO (texto)** |
| `RD 1328/1995`, `RD 1329/1995` | Modificación del RD 1630/1992 (y la errata del CTE) | sin objeto al derogarse el RD 1630/1992 | 01-07-2020 | INTERPRETACIÓN + LEÍDO (web) |
| `RD 1230/1989`, `FOM/2060/2002`, `FOM/898/2004`, «laboratorio homologado/acreditado» | Acreditación de laboratorios | RD 410/2010, DD única ([RD410] p. 7) | 23-04-2010 | **VERIFICADO (texto)** |
| `Decreto 2215/1974` | Homologación de laboratorios | sustituido por el RD 1230/1989 (preámbulo de [RD410], p. 3: «esta legislación fue sustituida») | 1989 | INTERPRETACIÓN |

**No vetar (está vigente o en vigor parcial):**
- **Reglamento (UE) 305/2011**: en vigor parcial hasta 2040 (K-PCC.9). Vetarlo sería un error.
- **RD 1313/1988**: homologación de cementos, citado por la RC-16 de 2024.
- **Decreto 462/1971**: Libro de Órdenes y certificado final, citado por el anejo II del CTE. Su vigencia no se ha leído (**SIN CONFIRMAR**).
- **DB SE-A**: no está derogado expresamente (K-PCC.16).

**Uso en las plantillas de ejemplo** (`volcados/*.txt`, solo recuento): aparecen EHE/EHE-08, EFHE, EAE, NBE (FL, CA, EA, QB), RL-88, RY-85, RB-90, RC-03, RD 1230/1989, RD 1630/1992 y la Directiva 89/106/CEE. Ninguna de esas citas puede salir de la app.

**SIN CONFIRMAR.** No se ha encontrado ninguna **«Orden estatal de 1991 de control de calidad»**. Las órdenes y decretos de control de calidad son **autonómicos** (Andalucía: otro verificador). No se veta un texto que no se ha identificado.

**Ojo con el test.** Los DB vigentes citan literalmente «EHE» y «EFHE» (DB SE 1.1.2, SE-1; SE-C 6.4.2.1, SE-C-92 y otros; SE-F; SI). El test debe ejecutarse **sobre el texto que genera la app**, no sobre transcripciones literales de los DB. Si la app transcribe un DB, debe sustituir la cita (por ejemplo, «EHE» → «Código Estructural»).

---

## Para la app

### (a) Lo que se puede codificar como datos (por familia de partida)

`oblig`: **R** = exigido por reglamento; **P** = a criterio del proyecto, propuesto y desmarcable; **C** = condicionado a un dato del proyecto. `quién`: DEO = director de la ejecución de la obra; INST = empresa instaladora; LAB = laboratorio con declaración responsable (RD 410/2010); OC = organismo de control.

| Familia de partida | Control / prueba | Frecuencia / muestreo | oblig | quién | Cita |
|---|---|---|---|---|---|
| Toda partida con producto | Recepción documental: origen, hoja de suministro y etiquetado; garantía; marcado CE y DdP (o DdPyC) | cada suministro | R | DEO | CTE I art. 7.2.1; R 305/2011 arts. 4 y 8; R 2024/3110 arts. 15, 17 y 95 |
| Toda partida con producto | Distintivos de calidad / DIT-DAU (si los hay) | cada suministro | C | DEO | CTE I arts. 5.2.3, 5.2.5 y 7.2.2 |
| Toda partida con producto | Ensayos de recepción | lo que fije el proyecto | P | LAB | CTE I art. 7.2.3 |
| Cemento a obra (morteros/hormigón hechos en obra) | Fase 1 documental + fase 2 inspección visual | cada remesa; lote ≤200 t/mes (≥2 lotes/mes si se superan) | R | DEO | RC-16 arts. 7.2 y 8 |
| Cemento a obra | Fase 3: ensayos de identificación (anejos V–VI) | por lote | P | LAB | RC-16 art. 8.3 |
| Cimentación directa | Confirmación del estudio geotécnico; comprobaciones del terreno, materiales y ejecución (a–p) | por elemento / fase | R | DO + DEO | DB SE-C 4.6.2–4.6.4; LOE 12.3.b |
| Cimentación (C-3/C-4) | Nivelación de asientos | durante la obra | C (tipo C-3/C-4) | DEO | DB SE-C 4.6.5.2 |
| Pilotes in situ | Ensayos de integridad | ≥1/20; aislados de 45–100 cm ≥2/20; >100 cm ≥5/20 | R | LAB | DB SE-C 5.4.2.1.9 |
| Pilotes prefabricados (C-3/C-4) | Pruebas dinámicas de hinca contrastadas con pruebas de carga | — | C | LAB | DB SE-C 5.4.2.3.7 |
| Anclajes al terreno | Ensayos UNE EN 1537:2015 (aceptación: «cada anclaje») | cada anclaje (INTERPRETACIÓN) | R | LAB | DB SE-C 9.1.5 y 9.4 |
| Fábrica resistente | Declaración de resistencia y categoría de las piezas; ensayo UNE-EN 772-1 si falta el valor declarado | por suministro | R / C | DEO / LAB | DB SE-F 8.1.1 |
| Fábrica resistente | Inspección diaria (categoría A/B) | diaria | C (categoría) | DEO | DB SE-F 8.2.1 |
| Madera estructural | Identificación; clase resistente; humedad ≤20 % (xilohigrómetro UNE-EN 13183-2) | por suministro | R | DEO | DB SE-M 13.1 |
| Acero estructural | **Pendiente del verificador del Código Estructural** (el DB SE-A dice: visual 100 % de soldaduras; END 5 primeras y luego 1/5; 0,5 m cada 10 m; atado 1/20) | — | — | — | DB SE-A 10.8.4.1 |
| Impermeabilización, fachada, suelos (HS 1) | Recepción según pliego; control de ejecución según pliego | según pliego | R (doc.) | DEO | DB HS 1 4.2 y 5.2 |
| Cubierta plana | Prueba de estanqueidad (inundación o riego) | — | **P** (no exigida por el DB HS 1) | constructor / LAB | CTE I art. 7.4; DB HS 1 5.3 («no se prescriben pruebas finales») |
| Fontanería (HS 4) | Prueba de resistencia mecánica y estanquidad (UNE 100151:1988 metálicas / UNE-CEN/TR 12108:2015 IN plásticas), repetida con grifería | toda la red | R | INST | DB HS 4 5.2.1.1 |
| ACS (HS 4) | Pruebas de funcionamiento a)–e) | instalación | R | INST | DB HS 4 5.2.1.2 |
| Saneamiento (HS 5) | Estanqueidad parcial: cierre ≥25 mm; vaciado 1 min; tramos a 0,3–0,6 bar durante 10 min; arquetas llenas; 100 % de uniones | cada aparato / tramo | R | INST / constructor | DB HS 5 5.6.1 |
| Saneamiento (HS 5) | Estanqueidad total: agua 0,3–1 bar, aire 0,5–1 bar durante 3 min o humo a 250 Pa | sistema total | R (una de las tres, INTERPRETACIÓN) | INST / constructor | DB HS 5 5.6.2–5.6.5 |
| Ventilación (HS 3), radón (HS 6) | Recepción y ejecución según pliego; sin prueba final | — | R (doc.) | DEO | DB HS 3 5.2 y 6.3; DB HS 6 4.2 y 5.3 |
| Envolvente térmica (HE 1) | Recepción documental; sin prueba final | — | R (doc.) | DEO | DB HE 1 5.4–5.6 |
| Vivienda nueva >120 m² útiles | Ensayo n50 (UNE-EN ISO 9972) | — | **P** (alternativa: valores de referencia) | LAB | DB HE 1 3.1.3.4; anejo H |
| Aislamiento acústico | Medición in situ: UNE-EN ISO 16283-1/-2/-3 y 3382; tolerancias 3 dBA / 3 dB / 0,1 s | — | **P** | LAB acreditado | DB HR 5.3 |
| Pavimentos | Clase de resbaladicidad Rd (UNE 41901:2017 EX) según localización | por suministro | R (doc.) | DEO | DB SUA 1 tablas 1.1–1.2 |
| Puertas EI / sectorización | Clasificación de resistencia y reacción al fuego; cierre UNE-EN 1154/1158/1155 | por suministro | R (doc.) | DEO | DB SI V |
| Climatización / ACS (RITE) | Recepción art. 20; pruebas IT 2.2 (redes de agua: preliminar + 1,5× ≥6 bar; ACS 2× ≥6 bar; solar 1,5× ≥3 bar; frigoríficos; libre dilatación; conductos; chimeneas); pruebas finales UNE-EN 12599 | instalación | R | INST (en presencia del instalador o del director) | RITE arts. 20 y 22; IT 2.2 |
| Electricidad BT | Verificaciones previas (UNE 20.460-6-61) | instalación | R | INST | REBT ITC-BT-04 5.2; ITC-BT-05 3 |
| Electricidad BT | Inspección inicial: garaje ≥25 plazas, piscina >10 kW, local mojado >25 kW, recarga de VE con proyecto | — | C | OC | ITC-BT-05 4.1 |
| BIE | Estanquidad y resistencia: ≥980 kPa durante 2 h (alta presión: 1,5× durante 2 h) | sistema | R | INST | RIPCI anexo I, sección 1.ª, 5.5 |
| Columna seca | ≥1470 kPa (≤30 m) / ≥2450 kPa (>30 m) durante 2 h | cada columna | R | INST | RIPCI anexo I, sección 1.ª, 6.4 |
| PCI (puesta en servicio) | Certificado del instalador + contrato de mantenimiento | — | R | INST / promotor | RIPCI art. 20 |
| ICT | Protocolo de pruebas (anexo V) + boletín; certificado de fin de obra si hay director | instalación | R | INST | Orden ITC/1644/2011 art. 6.4 |
| Gas | Prueba de estanquidad UNE 60670-8 / UNE 60620 | instalación | R | INST | RD 919/2006 ITC-ICG 07 3.3 |

Literales de cabecera, para codificar como texto fijo:
- «Plan de control de calidad» = anejo de la memoria (CTE I, anejo I), solo en proyecto de ejecución.
- Tres bloques: art. 7.2 / 7.3 / 7.4.
- «El presupuesto […] Incluirá el presupuesto del control de calidad.»
- Fórmula de laboratorios (K-PCC.8) y de productos (K-PCC.9).

### (b) Lo que hay que pedir al proyectista

1. **Qué ensayos de recepción y de obra terminada «previstos en el proyecto»** quiere (CTE 7.2.3 y 7.4). Por ejemplo: prueba de cubierta plana, blower door, acústica in situ, ensayos de fase 3 de cemento, ensayos de fábrica. Con su muestreo, criterios de aceptación y rechazo y acciones.
2. **Tipo de construcción C-0…C-4 y de terreno** (SE-C), para la nivelación y las pruebas de pilotes. **Tipo y diámetro de pilotes** y si están aislados.
3. **Categoría de ejecución de la fábrica** (A/B/C) y **categoría de fabricación de las piezas** (I/II).
4. **Uso y superficie útil** (¿residencial privado nuevo de más de 120 m²? → n50).
5. **Plazas de garaje, piscina, recarga de VE con proyecto** → organismo de control del REBT. **BIE y columna seca** (y su altura) → pruebas del RIPCI. **Gas** (sí/no).
6. **A quién se carga cada ensayo** (laboratorio en el capítulo de control frente a prueba incluida en la partida del instalador). La LOE no lo fija en obra privada.
7. **Estructura de acero y hormigón**: lo que diga el verificador del Código Estructural.
8. **Productos con distintivo, DIT o DAU**, porque cambian el alcance de la recepción (CTE 7.2.2).

### (c) Lo que queda SIN CONFIRMAR (no se codifica)

- Actos de ejecución del Reglamento (UE) 2024/3110 que hagan obligatoria ya alguna especificación técnica armonizada para alguna familia (y si ha pasado el año del art. 95.9). Anexos del Reglamento Delegado 2026/1310 (sistema por familia).
- El real decreto español de productos de construcción (proyecto TRIS 2025/0632/ES): no consta publicado.
- La regla de «ensayos a cargo del contratista hasta el 1 % del presupuesto» (contratación pública; no aplica a obra privada).
- Una «Orden estatal de 1991 de control de calidad»: no encontrada; lo que hay es autonómico.
- La vigencia del Decreto 462/1971 y del RD 842/2013 (citados por el CTE y el DB SI): no se han leído sus fichas.
- La sustitución de la UNE 20.460-6-61 (citada por la ITC-BT-05).
- Cómo conviven el DB SE-A y el Código Estructural en estructuras de acero de edificación (verificador del Código Estructural).
- Ascensores, piscinas, agua de consumo (RD 3/2023), legionela y fotovoltaica: no recorridos.
- Que la valoración económica vaya en **capítulo propio**: el CTE solo dice que el presupuesto «Incluirá» el control de calidad (INTERPRETACIÓN, no SIN CONFIRMAR, pero no se presenta como obligación).

### (d) Citas derogadas con su derogación (para el test)

```
EHE-08 | RD 1247/2008        -> derogado por RD 470/2021, DD única.1 (efectos 10-11-2021)
EAE | RD 751/2011            -> derogado por RD 470/2021, DD única.1 (efectos 10-11-2021)
EHE | RD 2661/1998           -> derogado por RD 1247/2008, DD única.1.a
EFHE | RD 642/2002           -> derogado por RD 1247/2008, DD única.1.b
RC-08 | RD 956/2008          -> derogado por RD 256/2016, DD única
RC-03 | RD 1797/2003         -> derogado por RD 956/2008            [LEÍDO (web)]
RC-97 | RD 776/1997          -> derogado por RD 1797/2003           [LEÍDO (web)]
NBE CT-79 | NBE AE-88 | NBE QB-90 | NBE FL-90 | NBE EA-95 | NBE CPI-96 | RD 1650/1977
                             -> derogados por RD 314/2006, DD única.1.a–g
NBE CA-81 | NBE CA-82 | NBE CA-88 -> derogados por RD 1371/2007, DD única
RY-85 | RL-88 | RB-90        -> derogados por RD 1371/2007, DD única
Orden 9-12-1975 (Normas básicas instalaciones interiores de suministro de agua)
                             -> derogada por RD 314/2006, DD única.1.h
Directiva 89/106/CEE         -> derogada por Reglamento (UE) 305/2011, art. 65.1 (aplicable 01-07-2013)
RD 1630/1992                 -> derogado por RD 542/2020, DD única.1.g (efectos 01-07-2020)
RD 1328/1995 | RD 1329/1995  -> sin objeto tras la derogación del RD 1630/1992 [INTERPRETACIÓN]
RD 1230/1989 | Orden FOM/2060/2002 | Orden FOM/898/2004
                             -> derogados por RD 410/2010, DD única (23-04-2010)
"laboratorio homologado" | "laboratorio acreditado (RD 1230/1989)" -> sustituir por "declaración responsable (RD 410/2010)"
NO VETAR: Reglamento (UE) 305/2011 (vigente en parte hasta 08-01-2040) · RD 1313/1988 · DB SE-A
```
