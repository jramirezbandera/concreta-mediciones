# Análisis de los ejemplos de estudio de seguridad y salud (Fase 8 de PLAN-MEMORIA.md)

**Fecha:** 2026-10-16 · **No se ha editado código.**
**Encargo:** `PLAN-MEMORIA.md` §5.8 («Ejemplos»): analizar los estudios de seguridad y salud que ha aportado el usuario y sacar de ellos el **esqueleto del estudio básico de la app** y el **catálogo de riesgos**, sin lo derogado. Es la base de feature-35, junto con `research/verificacion-seguridad-salud.md` (K-SYS.1 … K-SYS.14), que manda en todo lo normativo.

**Qué se ha analizado.** Los 15 PDF de `ejemplos/seguridad y salud/`:
- 9 **estudios básicos** (ss02, ss03, ss04, ss05, ss06, ss09, ss10, ss12, ss15);
- 4 **estudios completos** (ss01, ss07, ss08, ss11);
- 1 juego de **planos** de un estudio completo (ss14);
- 1 **guía colegial** con el índice recomendado (ss13), que no es un estudio.

Cinco son del estudio del usuario (ss02, ss03, ss04, ss11 y, casi seguro, ss14). Los otros diez son de autores externos: administraciones locales, ingenierías y arquitectos de otras comunidades. Hay obra de edificación (vivienda, equipamiento, oficinas, nave) y obra civil (carreteras).

**Método y límites**
- Los PDF se pasaron a texto con `pdftotext -layout`. Cuatro agentes los analizaron en grupos (A: ss07, ss10, ss12, ss13, ss14; B: ss02, ss05, ss06, ss11; C: ss01, ss04; D: ss03, ss08, ss09, ss15). Sus análisis completos están en `…\scratchpad\fase8\ss\analisis-A.md` … `analisis-D.md` (no se publican: llevan más detalle de cada obra).
- ss13 (fuentes con la codificación rota) y ss14 (planos) se leyeron **como imagen**. De ss11 (333 págs.) se leyeron el índice, la memoria general, unas 30 fichas y las secciones clave; el resto, con búsquedas.
- Este documento **consolida y deduplica** los cuatro catálogos y los contrasta con `verificacion-seguridad-salud.md`.
- **Límite 1.** El estado de las normas que no están en K-SYS (por ejemplo, «el RD 1316/1989 lo derogó el RD 286/2006») lo dan los analistas y **no se ha cotejado en el BOE**. Basta para no citar la norma vieja. No basta para citar la nueva sin leerla (ver §5.3).
- **Límite 2.** Las cifras de las medidas son las de los ejemplos. Solo las marcadas [V] están verificadas (ver §4.1).
- **Límite 3.** En ss03 y ss04 la marca SÍ/NO de la tabla del art. 4 se pierde en el texto, y las tablas de normativa salen con las columnas desalineadas. **Cotejado en imagen el 2026-10-16** (la hoja del art. 4 de cada uno): los cuatro supuestos van marcados «NO»; el PEC se desglosa con GG 13 %, BI 6 % e IVA 21 %; los supuestos b) y c) llevan solo la marca, sin los días, los trabajadores ni las jornadas de la obra; el compromiso del promotor dice «encargar y visar» y «Decreto 1627/1997» (se quitan: decisión 5 de feature-35). Las tablas de normativa no se han mirado.

**Regla de datos.** Son documentos de clientes. Aquí **no** figuran nombres de personas ni de promotores, direcciones, referencias catastrales, expedientes, números de visado ni importes exactos de obra. Cada documento se cita por su número y una descripción genérica. El índice número → fichero queda en el scratchpad, fuera del repositorio.

**Marcas de este documento**
- **[V]**: cifra o regla verificada en texto (RD 1627/1997, VII CGSC o RD 396/2006; ver K-SYS).
- **[W]**: regla del RD 1215/1997, que en la verificación sigue «LEÍDO (web)»; hay que cotejarla antes de imprimir su literal.
- **⚠**: cifra en la que los ejemplos no coinciden, o que contradice una norma. **No se codifica** hasta verificarla (§4.9).
- **(vivienda)**: entrada imprescindible en una obra de vivienda (obra nueva unifamiliar o plurifamiliar pequeña, reforma, cambio de uso de local a vivienda).
- **INTERPRETACIÓN**: se sigue de la norma, pero la norma no lo escribe tal cual (mismo sentido que en `verificacion-memoria.md`).

---

## 1. Documentos analizados

| Nº | Tipo | Obra (genérica) | Año | Autoría | Calidad | Lo más útil |
|---|---|---|---|---|---|---|
| ss01 | Completo (memoria, pliego, presupuesto, planos), 194 págs. | Equipamiento público de nueva planta | 2020 | Externo | Plantilla muy extensa; poco propio de la obra | Ficha por fase en cinco partes (medios, riesgos, normas, colectivas, EPI); cálculo de dotaciones a la vista; trabajos posteriores en cuatro puntos |
| ss02 | Básico, con hoja previa del art. 4 | Refuerzo de cimentación y reparaciones en edificios residenciales existentes | 2025 | Estudio del usuario | Plantilla de fichas en tabla; datos generales propios | Hoja del art. 4 con el PEC desglosado (PEM, GG, BI, IVA), tabla SÍ/NO y compromiso del promotor |
| ss03 | Básico dentro de un proyecto técnico | Sustitución de un mirador de madera en la fachada de un edificio protegido | 2026 | Estudio del usuario | Plantilla antigua de 20 fichas; el índice lista las 20 y solo hay unas 10 | PEC bien calculado; bloque de datos generales compacto; tabla de dotaciones y asistencia |
| ss04 | Básico dentro de un proyecto (cap. 8) | Ascensor y conservación de fachada en un edificio plurifamiliar existente y habitado | 2026 | Estudio del usuario | Fichas de plantilla sin adaptar (la identificación dice «reforma interior») | Hoja del art. 4; división «riesgos evitables / no evitables», que es literalmente el art. 6.2 |
| ss05 | Básico | Adecuación de una nave existente como cámaras frigoríficas | 2017 | Externo | Corto; análisis de riesgos flojo | Tabla «proceso → máquinas → medios → materiales → cuadrilla» y planning por días: base para estimar jornadas. La lista de normativa más limpia |
| ss06 | Básico, con pliego dentro | Ampliación de un equipamiento asistencial | 2023 | Externo | Plantilla genérica; normativa muy anticuada | Justificación numérica de los cuatro supuestos (con el PEC mal calculado); columna «grado de adopción» |
| ss07 | Completo, 350 págs. | Reforma de accesibilidad de un edificio público comercial | h. 2019–2022 | Externo (administración) | Plantilla de software; describe unidades que la obra no tiene y se contradice | Tabla de interferencias con servicios (existe / no existe); riesgo con su causa; bloque «recurso preventivo: actividades de vigilancia» |
| ss08 | Completo | Glorieta en carretera (obra civil) | 2020 | Externo | Plantilla; arrastra unidades de otro proyecto | Tabla de mano de obra por actividad; procedimiento de servicios afectados con cifras; láminas de entibación |
| ss09 | Básico, 78 págs. | Sustitución de la producción térmica en un edificio de oficinas | 2019 | Externo | Genérico; unas 30 págs. transcriben reglamentos | Cálculo del nº de trabajadores desde el PEM; servicios higiénicos dentro del edificio en rehabilitación; láminas «incorrecto / correcto» (solo imagen) |
| ss10 | Básico, 15 págs. | Reforma de una oficina pública en la planta baja de un edificio residencial | 2021 | Externo | Datos propios; fichas de plantilla | Bloque «toda la obra»; frecuencia de cada medida y EPI; cabina compacta de aseo en un local existente; «fase única» en obra pequeña |
| ss11 | Completo, 333 págs. | Edificio entre medianeras: demolición parcial, reforma y ampliación en altura | 2020 | Despacho del usuario | Plantilla de software; la demolición y el entorno sí son propios | El mejor texto de demolición en reforma, con cifras; zanjas; instalación eléctrica provisional; entorno de la obra |
| ss12 | Básico, 16 págs. | Ascensores en dos edificios municipales existentes | 2010 | Externo | Modelo clásico de tres columnas, con las notas al redactor sin borrar | La mejor justificación del básico (dato del proyecto en cada supuesto); textos fijos de obligaciones |
| ss13 | Guía colegial (8 págs.), no es un estudio | — | 2019 o después | Colegio profesional (licencia CC BY-NC-ND) | Buena; alineada con la Guía del INSST | Índice recomendado; «condiciones del solar» y «entorno»; esquema de la ficha por fase; amianto y anexo II por fase |
| ss14 | Planos de un completo (15 hojas) | La misma obra que ss11 | 2020 | Estudio del usuario | Específicos de la obra | Ordenación de obra; recorrido al centro asistencial; detalles de barandilla, huecos, redes, andamio e instalación eléctrica con cifras |
| ss15 | Básico, anejo del proyecto | Modificación de un acceso a carretera (obra civil) | 2017 | Externo | El mejor organizado | Lista primero las unidades y las máquinas de la obra y solo da fichas de esas; recursos preventivos y coordinación; acopios con cifras |

---

## 2. Qué se ha visto

**Cuatro familias de documento**
1. **Fichas en tabla «riesgos evitables / no evitables»** (ss02, ss03, ss04). Es la plantilla del estudio del usuario: 20 fichas con columnas *Riesgos | Protecciones personales | Protecciones colectivas*, normas básicas y tres campos de cierre (*Riesgos especiales*, *Observaciones*, *Normativa específica*). Delante va una hoja con los supuestos del art. 4.
2. **Modelo clásico de tres columnas por fase** (ss06, ss10, ss12): *Riesgos | Medidas y protecciones colectivas | EPI*, a veces con el grado de adopción (permanente / frecuente / ocasional).
3. **Estudios de software o banco de fichas** (ss01, ss07, ss08, ss11, y el básico ss09): una ficha por unidad de obra, decenas de fichas de máquinas, pliego largo. Son los completos.
4. **Selección por unidades de la obra** (ss15, y a su manera ss05): primero listan lo que tiene la obra y luego solo dan esas fichas. Es lo que pide la Guía del INSST.

**Cuánto es plantilla.** En 11 de los 13 estudios el grueso es plantilla genérica. Los datos generales sí suelen ser propios de la obra; las fichas, casi nunca. Solo ss05 y ss15 eligen las fichas por la obra. Señales típicas: unidades que la obra no tiene (grúa torre sobre carriles en una parcela pequeña, «pozo o mina», muros pantalla), índices que anuncian fichas que no están, identificaciones heredadas de otra obra. Ninguno tiene «riesgos ligados a esta obra», que es lo que pide la Guía (K-SYS.12).

**Fallos frecuentes, contrastados con la verificación** (13 estudios; sin contar ss13 ni ss14)

| Fallo | Estudios | Criterio |
|---|---|---|
| Aplican el **RD 486/1997** a la obra (servicios, botiquín, escaleras) | 12 de 13 (todos salvo ss05) | No se aplica a obras (art. 1.2). K-SYS.5 |
| Citan la **Ordenanza General de 1971** | 8 (ss02, ss03, ss04, ss06, ss07, ss08, ss10, ss11) | No citable para obras. K-SYS.5 |
| Citan la **Ordenanza de la Construcción, Vidrio y Cerámica de 1970**, a menudo en cada ficha | 8 (ss02, ss03, ss04, ss06, ss07, ss10, ss11, ss12) | No citable. K-SYS.5 |
| Mencionan el **aviso previo** | 7 (ss01, ss02, ss06, ss07, ss08, ss09, ss12) | Derogado (RD 337/2010). K-SYS.6 |
| **Copia a la Inspección de toda anotación** del libro de incidencias en 24 h | 4 (ss01, ss06, ss11, ss12) | Solo en los casos del art. 13.4. K-SYS.6 |
| **Identifican el amianto** | **0 de 13**. Era pertinente en 10 (obras sobre edificio existente). ss07 y ss11 llegan a **recomendar** fibrocemento y EPI de amianto | Obligatorio en el EBSS (RD 396/2006, art. 10.2). K-SYS.9 |
| Dan las ratios de servicios con el **VII Convenio** | **0**. Nueve dan ratios con la fuente mal o sin fuente; cuatro no dan ninguna | VII CGSC art. 232.2. K-SYS.5 |
| Rellenan el **anexo II** con medidas | **0**. El campo queda vacío, dice «ninguno» o es genérico | RD 1627 art. 6.2. K-SYS.4 |
| Dan **trabajos posteriores** propios de la obra | **0**. Seis son genéricos, cinco no dicen nada y ss11 pone un manual de uso | RD 1627 art. 6.3. K-SYS.14 |
| Tratan **otras actividades** en el lugar (edificio habitado, vía pública) | 0 (ss04 era un edificio habitado) | RD 1627 art. 6.2 |
| **Justifican** el básico o el completo con datos | 6 (ss02, ss03, ss04, ss06, ss12, ss15), casi todos con algún error | Guía folio 25. K-SYS.2 |
| Calculan bien el **PEC** = (PEM + GG + BI) × (1 + IVA) | 3, todos del estudio del usuario (ss02, ss03, ss04). ss12 usa un IVA del 16 %; ss06 no suma GG ni BI | Guía folio 24. K-SYS.1 |
| Calculan las **jornadas** | 3 (ss06 con el atajo días × trabajadores; ss10; ss12). ss15 escribe «superior a 500» y aun así concluye que basta el básico | K-SYS.2 |

**Conclusión.** Los ejemplos sirven por su **esqueleto y su banco de medidas**, no por su normativa ni por su selección de fichas. Los apartados que más fallan (amianto, anexo II, trabajos posteriores, otras actividades, servicios con el convenio) son justo los que la verificación marca como obligatorios. La app tiene que generarlos desde los datos de la obra, no desde una plantilla.

---

## 3. Estructura propuesta para el EBSS de la app

Cruza lo que exige el **art. 6 del RD 1627/1997** (K-SYS.3), la Guía del INSST y la sección «Para la app (fase 8)» de la verificación con el mejor formato de cada ejemplo.

**Orden.** Es el de K-SYS.3, salvo un cambio: los servicios higiénicos pasan a la implantación (apartado 6), delante de los riesgos, como en ss13 y en la mayoría de los ejemplos. El contenido no cambia.

| Nº | Apartado | Qué lleva (regla) | Formato tomado de | Base |
|---|---|---|---|---|
| 0 | Datos generales | Autor del estudio y del proyecto; promotor; coordinador en proyecto y en ejecución, o «no procede» con el motivo (art. 3); emplazamiento; uso y tipo de obra (nueva, reforma, cambio de uso); PEM, PEC, plazo en días laborables y máximo de trabajadores a la vez | ss03 y ss02 (bloque compacto); ss06 (cuadro); ss13 I.1–I.2 | RD arts. 3 y 6.1 [V] |
| 1 | Justificación del estudio básico | Tabla «Supuesto \| Umbral \| Proyecto \| ¿Se supera?»: a) PEC desglosado ≥ 450.759,08 €; b) días > 30 **y** simultáneos > 20 (dos datos, las dos condiciones); c) jornadas > 500 (Σ Tᵢ × Dᵢ, o el atajo días × simultáneos); d) túneles, galerías, conducciones subterráneas o presas, con la aclaración de la Guía. Aviso si el PEC queda cerca del umbral (ss02 quedaba a 540 €). Si se supera algún supuesto, la app lo dice y no redacta el estudio. Cierra con el compromiso del promotor de encargar el estudio completo si en la contratación se pasa un umbral | ss12 (dato del proyecto en cada supuesto); ss02, ss03 y ss04 (PEC desglosado y SÍ/NO, compromiso); ss06 (jornadas con el atajo); ss05 y ss08 (tabla de periodos para la suma) | RD art. 4 [V]; Guía folios 24–25 |
| 2 | Objeto | Dos párrafos: contenido del art. 6.2 y 6.3 en resumen; el estudio es la información del promotor al contratista (RD 171/2004, DA 1.ª) y la base del plan (art. 7) | ss12 1.2; ss06 2 | RD arts. 6 y 7 [V]; RD 171/2004 (LEÍDO web) |
| 3 | Emplazamiento, entorno y servicios afectados | Accesos (con dimensiones), topografía, linderos y medianeras, colindantes, vía pública y tráfico, servidumbres; tabla de servicios «existe / no existe» (líneas aéreas y enterradas, transformadores, gas, agua, saneamiento, telecomunicaciones); acometidas provisionales; centro asistencial con distancia y tiempo | ss13 I.3–I.4; ss11 1.6; ss07 4.4 (tabla); ss05 («información previa»); ss06 (cuadro); ss07, ss10 y ss11 (asistencia) | Guía, comentario al art. 5.2 a), al que remite el del 6.2 |
| 4 | Descripción de la obra y organización | Unidades de obra que tiene **esta** obra (desde los módulos y lo intervenido), maquinaria y medios previstos, orden de ejecución; «fase única» en obras pequeñas; tabla *proceso → máquinas → medios → cuadrilla* | ss15 2.4–2.5 (selección); ss05 tabla F1; ss10 1.4 | Guía folios 26 y 122 |
| 5 | Normas de seguridad y salud aplicables | Lista corta y cerrada (ver la tabla de abajo), cada norma con su estado de lectura | ss05 (la única lista limpia) | RD art. 6.2, primera frase [V] |
| 6 | Implantación, instalaciones provisionales y servicios higiénicos | Ordenación de obra, vallado, acopios, instalación eléctrica provisional, protección contra incendios. Dotación calculada a la vista: n → retretes, lavabos, duchas, vestuario. Primero lo **obligatorio** (convenio) y, aparte, lo **recomendado** (Guía). Soluciones alternativas en obra corta o en edificio existente. Agua potable, comedor, botiquín | ss01 (cálculo); ss02 y ss03 (tabla dotación \| asistencia); ss10 (cabina compacta); ss09 (servicios dentro del edificio); ss14 hoja 4 | RD anexo IV A.14–16 y 19 [V]; VII CGSC arts. 231–233 [V]; Guía folios 79–80 |
| 7 | Riesgos evitables y medidas técnicas para evitarlos | Solo los que se evitan con una decisión concreta de esta obra: anular instalaciones antes de demoler, prefabricar en taller, cortar a medida, no trabajar con viento… No se listan los que el proyecto ya ha evitado | ss02 y ss04 (división); ss13 (frase sobre lo evitado en proyecto); ss10 (viento) | RD art. 6.2 [V]; Guía folio 27 |
| 8 | Riesgos no eliminables: medidas, protecciones y eficacia | Bloque «toda la obra» y, después, fichas del catálogo **solo** de las fases, medios, máquinas e instalaciones marcadas. Cada ficha: descripción ligada al proyecto; riesgos (nombre del INSST y causa); medidas; protecciones colectivas; EPI; valoración de eficacia (duda 4) | ss10 (toda la obra; frecuencia de uso); ss01 (ficha en cinco partes); ss13 II.5; ss12 (tabla); ss07 (riesgo con su causa); ss15 (selección) | RD art. 6.2 [V]; anexo IV parte C [V] |
| 9 | Otras actividades en el lugar | Edificio o local en uso, vecinos, vía pública, otros contratistas: separación de zonas, recorridos, horarios, servicios del edificio que siguen funcionando | Ninguno lo hace bien. Ideas sueltas en ss07 («aislar la zona») y ss15 («afecciones al tráfico») | RD art. 6.2: «tendrá en cuenta cualquier otro tipo de actividad» [V] |
| 10 | Trabajos con riesgos especiales (anexo II) y recurso preventivo | Apartados del anexo II que se dan, cada uno con su medida específica. **Nunca vacío**: si no hay ninguno, «no se prevén» y el motivo. Recurso preventivo preceptivo; lista «Comprobar que…» solo en esas unidades | ss07 (vigilancia del recurso preventivo); ss15 §8 | RD art. 6.2 y anexo II [V]; DA única [V]; Guía folio 32 |
| 11 | Identificación de materiales con amianto | No identificado / posible / identificado; ubicación; friable o no. Con «posible» o «identificado»: empresa del RERA, plan de trabajo aprobado antes de empezar, retirada antes de demoler, anexo II.2, residuos peligrosos. Sin valores límite | Ninguno (todos fallan); el formato es el de la verificación | RD 396/2006 arts. 10.2, 11, 12 y 17 [V] |
| 12 | Trabajos posteriores: previsiones e informaciones útiles | Dos bloques (previsiones / informaciones útiles), por cada elemento que tiene esta obra: cubierta (los cinco puntos de la Guía), fachada, instalaciones, ascensor. Tabla *ubicación → elemento previsto*. Destino: el promotor y el Libro del Edificio | ss01 3.7.3 (cuatro puntos); ss13 II.10 (lista de elementos); ss02 y ss03 (tabla ubicación \| elemento) | RD art. 6.3 [V]; Guía folios 32–33 |
| 13 | Obligaciones durante la obra | Texto fijo corregido: plan de cada contratista y su aprobación; comunicación de apertura; libro de incidencias (copia a la ITSS solo en los casos del 13.4); libro de subcontratación; coordinación de actividades; recursos preventivos; paralización; derechos de los trabajadores; cabeza de familia (art. 2.3) si procede | ss12 §7–15 y pliego de ss06, corregidos; ss15 3.1 (lista de comprobación) y §9 | RD arts. 2.3, 7, 9, 13, 14 y 19 y DA única [V]; Ley 32/2006 (LEÍDO web) |
| 14 | Firma | Lugar, fecha y técnico | — | RD art. 6.1 [V] |
| A | Documentación gráfica (opcional) | Situación con el recorrido al centro asistencial; ordenación de obra; detalles tipo (barandilla, huecos, andamio, instalación eléctrica) | ss14 hojas 1, 4, 11, 13 y 14; láminas de ss09 (hay que redibujarlas) | Guía folio 34 («puede anexar documentación gráfica») |

**Sin presupuesto.** El básico es «exclusivamente descriptivo» (K-SYS.3). La partida de seguridad y salud del presupuesto general es otra cosa y no se trata aquí.

**Cómo se eligen las fichas.** Como en ss15: la app propone las unidades desde lo que ya sabe y el proyectista marca o quita. Correspondencia propuesta (INTERPRETACIÓN):

| Dato o módulo de la app | Entradas del catálogo que propone |
|---|---|
| Obra nueva | IP1–IP8, F0, F4, F5, F8, F10, F11, F14–F25, F28–F32, F34–F36; MA1, MA2, MA5, MA7; M1–M4, M6, M10–M13, M16, M22 |
| Reforma, cambio de uso, intervención en edificio existente | F1, F3, MA6, MA10, M14 y el apartado 11 (amianto, obligatorio), además de las fases de lo intervenido |
| Edificio o local en uso | Apartado 9 (otras actividades); IP6 con la solución alternativa |
| Fachada o cubierta intervenida | MA1 o MA3, F14, F16 o F17; IP2 si da a la vía pública; aviso del anexo II.1 |
| HS 4 / HS 5 (fontanería, saneamiento) | F23, F24 (y F5 si hay red enterrada) |
| HE 4 / RITE (ACS, climatización) | F25, F36, M6 |
| REBT, HE 6 (recarga del vehículo eléctrico) | F22 |
| ICT | F26 |
| Ascensor | F27 |

### Normas aplicables: lista corta propuesta (apartado 5)

| Norma | Estado en la verificación |
|---|---|
| RD 1627/1997, obras de construcción (con RD 2177/2004, RD 604/2006, RD 1109/2007 y RD 337/2010) | VERIFICADO (texto); modificadoras, LEÍDO (web) |
| Ley 31/1995, de Prevención de Riesgos Laborales | LEÍDO (web) |
| RD 39/1997, Reglamento de los Servicios de Prevención | No leído |
| RD 171/2004, coordinación de actividades empresariales | LEÍDO (web) |
| Ley 32/2006, subcontratación, y RD 1109/2007 | LEÍDO (web, parcial) / SIN CONFIRMAR |
| RD 485/1997 (señalización), RD 487/1997 (cargas), RD 773/1997 (uso de EPI) | No leídos |
| RD 1215/1997, equipos de trabajo (con RD 2177/2004) | LEÍDO (web) |
| RD 614/2001 (riesgo eléctrico), RD 286/2006 (ruido), RD 1311/2005 (vibraciones), RD 374/2001 (agentes químicos) | No leídos |
| RD 396/2006, amianto | VERIFICADO (texto) |
| RD 842/2002, REBT (ITC-BT-33) | No leído en esta fase |
| RD 836/2003 y RD 837/2003 (grúas), solo si la obra las tiene | No leídos |
| VII Convenio General del Sector de la Construcción | VERIFICADO (texto) |
| Orden TIN/1071/2010, comunicación de apertura | SIN CONFIRMAR |

Las que no están verificadas se imprimen por número y título, sin literal, hasta cotejarlas (principio de la verificación). Las que sí están bien en los ejemplos (ss05, ss10, ss15) coinciden con esta lista.

### Formato de la ficha impresa

Hay dos candidatos (duda 3):
- **(a) La tabla del estudio del usuario** (ss02, ss03, ss04): bloques «evitables» y «no evitables», cada uno con *Riesgo | Protecciones personales | Protecciones colectivas* y normas debajo. El campo «Riesgos especiales» se rellena desde el anexo II y no queda nunca vacío. «Normativa específica» solo con normas de la lista corta.
- **(b) Cuatro columnas** *Riesgo | Medidas preventivas | Protecciones colectivas | EPI* (ss12 ampliado), con los evitables en el apartado 7.

**Propuesta: (b).** Las medidas, que son lo que más informa, tienen columna propia, y los evitables no se repiten en cada ficha.

---

## 4. Catálogo consolidado

### 4.1 Convenciones

- Cuatro grupos de los pedidos (instalación provisional, fase de obra, medio auxiliar, maquinaria) y un quinto con **trabajos posteriores**, porque los ejemplos lo traen y la app lo necesita para el apartado 12. Las protecciones colectivas (barandillas, redes, líneas de vida, viseras) van en «medio auxiliar», como en los análisis.
- Cada entrada tiene: **Riesgos** (nombre normalizado del §4.2 y, entre paréntesis, la causa); **Medidas preventivas**; **Protecciones colectivas**; **EPI**; **Fuentes**. Cuando aplica, también **Anexo II**: la asignación de apartados es INTERPRETACIÓN (K-SYS.4).
- Las cifras sin marca son de los ejemplos, coinciden entre ellos y ninguna norma leída las contradice. Son **buena práctica, no norma**: se imprimen como medida, sin cita.
- **Se ha quitado** de las fuentes, y se dice en cada entrada cuando importa: lo derogado, el RD 486/1997, la Ordenanza de 1971 y la de 1970, el «cinturón de seguridad» (pasa a «arnés anticaídas»), materiales con amianto, cifras con errata o sin base (lista en §5).
- La regla general de K-SYS.12 manda sobre el catálogo: la app solo imprime las fichas de lo que tiene la obra, y el proyectista puede quitar riesgos o medidas.

### 4.2 Nombres de riesgo

Los ejemplos usan la lista de «formas de accidente» del método general de evaluación del INSST (ss07 §6 la trae entera, con 25 nombres). Se normaliza a esa lista, más las exposiciones higiénicas. La clave es la que propone este documento para el código. **Falta cotejar con los 22 nombres de la NTP 908 que fija K-SYS.13** (duda 1).

| Clave | Nombre normalizado | Agrupa estas redacciones de los ejemplos |
|---|---|---|
| `distinto` | Caída de personas a distinto nivel | caída al vacío, en altura, desde andamio, escalera o máquina, a zanja o pozo |
| `mismo` | Caída de personas al mismo nivel | resbalones, tropiezos, torceduras, suelos mojados o con barro |
| `desplome` | Caída de objetos por desplome o derrumbamiento | hundimiento, derrumbe, desprendimiento de tierras, vuelco de pilas o de andamio, reventón de encofrado, descalce de medianeras |
| `manipulacion` | Caída de objetos en manipulación | caída de materiales transportados o de la carga |
| `desprendidos` | Caída de objetos desprendidos | caída de objetos a niveles inferiores o sobre terceros |
| `pisadas` | Pisadas sobre objetos | clavos, puntas, armaduras, fragmentos |
| `choque-inmoviles` | Choques contra objetos inmóviles | |
| `choque-moviles` | Choques contra objetos móviles | golpes con la carga, con la manguera de la bomba |
| `golpes` | Golpes o cortes por objetos o herramientas | |
| `proyeccion` | Proyección de fragmentos o partículas | cuerpos extraños en los ojos, salpicaduras |
| `atrapamiento` | Atrapamiento por o entre objetos | aplastamiento, órganos móviles |
| `vuelco` | Atrapamiento por vuelco de máquinas o vehículos | vuelco de la máquina |
| `sobreesfuerzos` | Sobreesfuerzos | posturas forzadas, movimientos repetitivos, lesiones dorsolumbares |
| `temperaturas` | Exposición a temperaturas ambientales extremas | estrés térmico, insolación |
| `termicos` | Contactos térmicos | quemaduras (soplete, soldadura, aglomerado) |
| `electrico` | Exposición a contactos eléctricos | directos o indirectos, electrocución |
| `nocivas` | Exposición a sustancias nocivas o tóxicas | intoxicación aguda; atmósfera pobre en oxígeno o con gases (pozos) |
| `causticas` | Contactos con sustancias cáusticas o corrosivas | dermatosis por cemento, cal u hormigón |
| `radiaciones` | Exposición a radiaciones | arco de soldadura (no ionizantes) |
| `explosiones` | Explosiones | |
| `incendios` | Incendios | |
| `seres-vivos` | Accidentes causados por seres vivos | (ningún ejemplo lo usa) |
| `atropellos` | Atropellos o golpes con vehículos | colisiones, maniobras |
| `quimicos` | Exposición a contaminantes químicos | polvo, sílice, humos de soldadura, vapores, plomo |
| `biologicos` | Exposición a contaminantes biológicos | falta de higiene, saneamiento existente |
| `ruido` | Exposición a ruido | |
| `vibraciones` | Exposición a vibraciones | |
| `amianto` | Exposición a amianto | contaminante químico con régimen propio (RD 396/2006) |

**No son nombres de riesgo**, aunque los ejemplos los ponen como tales: viento o mal tiempo, iluminación deficiente, inundación, derrames, interferencias con servicios, daños a terceros, fallo de anclaje. Son **causas**: van entre paréntesis o en las medidas.

### 4.3 Instalaciones provisionales

#### IP1 · Instalación provisional · Implantación, vallado, accesos y señalización (vivienda)
- **Riesgos:** atropellos o golpes con vehículos (entrada y salida de camiones; terceros); caída de objetos desprendidos (sobre terceros); caída de personas al mismo nivel (piquetas, catas, escombros); choques contra objetos móviles; caída de objetos en manipulación (montaje de casetas); exposición a contactos eléctricos (acometidas).
- **Medidas preventivas:** vallado de toda la obra antes de empezar, de 2,00 m de alto (ss07, ss11, ss14), y en vía con tráfico, delimitación por zonas (ss15); accesos separados para personas y vehículos; carteles «Prohibido el paso a toda persona ajena a la obra» y de uso obligatorio de EPI; señal de STOP y de salida de camiones; prohibido estacionar junto al acceso; señalista en las maniobras, con su posición en el plano de ordenación (ss14); normas de acceso y circulación colgadas en la entrada y entregadas con recibí (ss11); casetas, aseos y botiquín junto al acceso, en terreno estable y fuera de la zona de trabajo; en edificios de varias plantas, pasan a planta baja al terminar la estructura (ss14); en el montaje de casetas, nadie bajo la carga, guiada con cuerdas y nunca con las manos (ss15); cartel con los teléfonos de urgencias y el centro asistencial, con distancia y tiempo (ss07, ss10, ss11, ss14); zonas de paso libres de acopios e iluminadas; piquetas de replanteo señalizadas; replanteo fuera del radio de las máquinas (ss15); orden y limpieza; retirada frecuente de escombros.
- **Protecciones colectivas:** vallado fijo y trasladable; cerramiento opaco en casco urbano (ss14); malla de balizamiento y cinta bicolor; marquesina en el acceso peatonal; señalización de seguridad y de tráfico; iluminación nocturna; extintor.
- **EPI:** casco (también para visitantes, ss15); calzado de seguridad; ropa de trabajo; ropa de alta visibilidad para el señalista y en tajos en calzada.
- **Fuentes:** ss01, ss02, ss03, ss04, ss06, ss07, ss08, ss11, ss14, ss15.

#### IP2 · Instalación provisional · Trabajos junto a la vía pública y protección de terceros (vivienda)
- **Riesgos** (de terceros y del personal): atropellos o golpes con vehículos; caída de objetos desprendidos (sobre viandantes); caída de personas a distinto nivel (zanjas, pozos y arquetas abiertas); choques contra objetos inmóviles (vallas, acopios).
- **Medidas preventivas:** ocupación de la vía pública según la licencia y la ordenanza municipal; tajos que invadan la calzada señalizados por la Norma 8.3-IC o la ordenanza (ss07, ss15); aviso a la policía local en los cortes (ss07); si se ocupa la acera, paso peatonal provisional protegido por valla, con señalización nocturna y bordillo nivelado (ss01: 1,20 m de ancho); luces rojas cada 10 m y en las esquinas (ss08, ss11); peatones separados del tráfico por valla continua; pasarelas a portales y fincas; zanjas y arquetas en acera tapadas o con barandilla; chapas de acero en los pasos de vehículos; no acopiar fuera del recinto, y en la vía solo lo que se use antes de la siguiente interrupción (ss15); lonas en los camiones; riego contra el polvo; salida de vehículos guiada, con un tramo horizontal antes de la calle de 1,5 veces la batalla y 6 m como mínimo (ss03, ss04, ss07, ss11); en trabajos de fachada sobre la vía, marquesina o pantalla de recogida que vuele sobre la acera (ss11: 2 m) y zona de caída acotada.
- **Protecciones colectivas:** valla peatonal; vallas de desvío; conos; balizas luminosas; marquesina o pantalla de recogida; chapas de paso.
- **EPI:** ropa de alta visibilidad; casco; calzado de seguridad.
- **Fuentes:** ss01, ss03, ss07, ss08, ss11, ss15.

#### IP3 · Instalación provisional · Servicios afectados y acometidas (vivienda)
- **Riesgos:** exposición a contactos eléctricos (líneas aéreas o enterradas); explosiones e incendios (gas); exposición a sustancias nocivas o tóxicas (gases en el saneamiento); caída de objetos por desplome (rotura de una conducción que inunda la zanja); atropellos (cortes de calzada).
- **Medidas preventivas:** tabla previa de servicios con «existe / no existe» (líneas aéreas, enterradas, transformadores, gas, agua, saneamiento, telecomunicaciones) (ss07); planos de las compañías y sus teléfonos antes de empezar (ss08, ss15); dos calicatas como mínimo para confirmar el trazado (ss08); excavación mecánica hasta 0,50 m de la conducción y, desde ahí, a mano (ss08); si la compañía no da garantías, comunicarlo por escrito y no empezar (ss08); desvío, corte o consignación por escrito antes del trabajo y descargo por escrito después (ss08); si aparece un servicio no previsto, parar, no tocarlo y avisar a la compañía y a la DF (ss08, ss11, ss15); distancia a líneas aéreas según el RD 614/2001 ⚠ (las cifras de los ejemplos no coinciden: §4.9); no llevar a hombro pértigas, reglas ni escaleras bajo líneas, y usar escaleras aislantes cerca de ellas; acometidas y aberturas en el vallado señalizadas y aprobadas por el coordinador (ss01).
- **Protecciones colectivas:** pórticos limitadores de gálibo bajo las líneas; señalización; balizamiento; bombas de achique.
- **EPI:** guantes dieléctricos (debajo de los de cuero); calzado aislante; casco con barbuquejo; gafas.
- **Anexo II:** apdo. 4 si hay una línea de alta tensión próxima.
- **Fuentes:** ss01, ss07, ss08, ss09, ss11, ss15.

#### IP4 · Instalación provisional · Instalación eléctrica provisional de obra (vivienda)
- **Riesgos:** exposición a contactos eléctricos (directos e indirectos); incendios; contactos térmicos; caída de personas al mismo nivel (mangueras por el suelo).
- **Medidas preventivas:**
  - **Acometida y cuadros.** Acometida de la compañía con armario y llave. Cuadro general de intemperie, metálico con la carcasa a tierra o de doble aislamiento, con puerta, cerradura, visera y señal «Peligro, riesgo eléctrico», colgado de un paramento o pie derecho firme y fuera de las rampas. Interruptor general omnipolar accesible desde fuera, magnetotérmicos en todos los circuitos y diferenciales: 300 mA en fuerza y 30 mA en alumbrado y, como mejora, en máquinas (ss01, ss06, ss07, ss10, ss11, ss15; ss14 dibuja 30 mA en todos) ⚠ cotejar con la ITC-BT-33. Comprobar a diario que el diferencial dispara. Maniobras en el cuadro sobre banqueta aislante. Extintor de CO₂ junto al cuadro general.
  - **Puesta a tierra.** Pica en arqueta registrable. Conductor amarillo-verde solo para tierra, nunca a través de tuberías de agua. **Sin cifra de resistencia** ⚠: los ejemplos dan 2, 20, 37, 80 y 800 Ω (§4.9).
  - **Conductores y tomas.** Mangueras antihumedad de 1.000 V, sin empalmes con cinta (cajas estancas elevadas o cinta autovulcanizante). Tendido aéreo a 2 m como mínimo en zonas de peatones y a 5 m en pasos de vehículos, tensado con fiador; si va enterrado, a 40–50 cm, en tubo de PVC y bajo tablones (ss07 decía «fibrocemento o PVC»: solo PVC). Una toma por máquina, con clavija normalizada macho-hembra. Prohibido conectar hilos desnudos y desconectar tirando del cable.
  - **Alumbrado.** Circuitos de alumbrado separados. Portátiles a 24 V con transformador de seguridad, mango aislante y rejilla. Lámparas generales a 2,50 m como mínimo. El trazado eléctrico no coincide con el de agua.
  - **Mantenimiento.** Trabajos en la instalación sin tensión, comprobada con detector, y con el cartel «No conectar, personal trabajando». Montaje y mantenimiento solo por instalador autorizado.
- **Protecciones colectivas:** diferenciales y magnetotérmicos; puesta a tierra de las masas; doble aislamiento; cuadros cerrados; banqueta y alfombrilla aislantes; señalización.
- **EPI:** guantes y calzado aislantes; casco dieléctrico; comprobador de tensión; herramienta aislada.
- **Fuentes:** ss01, ss04, ss05, ss06, ss07, ss08, ss09, ss10, ss11, ss14, ss15. *Se quita:* el REBT de 1973 (MI BT 039 y 023), el «IP 447» y el tubo de fibrocemento.

#### IP5 · Instalación provisional · Protección contra incendios de obra (vivienda)
- **Riesgos:** incendios; explosiones (acopio de inflamables, gases licuados).
- **Medidas preventivas:** extintores según la clase de fuego, fijos, señalizados y revisados: CO₂ (5 a 12 kg) junto al cuadro general y junto al acopio de inflamables; polvo polivalente ABC de 6 kg (eficacia 21A-113B, ss07, ss10) en la oficina, el almacén y los tajos de soplete o soldadura (ss01, ss02, ss03, ss04, ss11); caminos de evacuación y escaleras despejados; inflamables en envases cerrados e identificados; escombro combustible separado; prohibido fumar donde haya riesgo; sin hogueras; repostar con el motor parado; ante un incendio eléctrico, cortar primero la tensión; aviso a los bomberos; personal formado en el uso de los extintores.
- **Protecciones colectivas:** extintores; señalización de extintores, evacuación y prohibido fumar; agua y arena como medios auxiliares.
- **EPI:** los del puesto.
- **Fuentes:** ss01, ss02, ss03, ss04, ss07, ss08, ss10, ss11, ss15. *Se quita:* el halón (ss01), prohibido.

#### IP6 · Instalación provisional · Servicios higiénicos, vestuario, comedor y primeros auxilios (vivienda)
- **Riesgos:** exposición a contaminantes biológicos (falta de higiene). *La atención tardía de un accidente no es una forma de accidente: queda como nota.*
- **Medidas preventivas** (la regla es K-SYS.5, no las cifras de los ejemplos):
  - **Obligatorio (VII CGSC):**
    - retretes ⌈n/25⌉, lavabos ⌈n/10⌉ y duchas ⌈n/10⌉ cuando la actividad o la salubridad lo requieran, con n = máximo de trabajadores a la vez (art. 232.2) [V];
    - vestuario climatizado, con taquilla de doble compartimento, si hay ropa especial o trabajos sucios, y siempre un espacio con llave para cada trabajador (art. 232.1) [V];
    - separación por sexos o uso por separado (art. 232.3) [V];
    - comedor con calientacomidas, ventilación y calefacción (art. 233.5) [V];
    - dotación que se adapta al número de trabajadores, con subcontratas y autónomos (art. 231.1) [V].
  - **Siempre:** agua potable e instalaciones para comer (RD 1627, anexo IV A.19 b y c) [V].
  - **Recomendado (Guía, no vinculante):** vestuario, duchas y lavabos en todas las obras; retretes ⌈H/25⌉ + ⌈M/15⌉ y urinarios ⌈H/25⌉ si se conoce el reparto entre hombres y mujeres.
  - **Obra corta o edificio existente** (convenio, art. 231.4; Guía): usar los aseos del local o de la vivienda (ss09, ss10); cabina compacta de inodoro y ducha conectada a la red (ss10); aseo portátil (ss05); comedor en zona habilitada o en restaurantes concertados (ss05, ss15).
  - **Cálculo a la vista:** n, y de ahí retretes, lavabos, duchas y taquillas (ss01, ss02, ss03).
  - **Funcionamiento:** en servicio antes de empezar la obra; limpieza diaria (ss11).
  - **Botiquín:** visible, a cargo de una persona designada, revisado y repuesto (ss02, ss11, ss12). Contenido actual: sin mercurocromo, amoníaco ni «tónicos» (§5.2).
  - **Asistencia:** cartel con el centro de salud y el hospital, la distancia, el tiempo y la ruta (ss07, ss10, ss11, ss14), el 112 y el teléfono de toxicología; los heridos se evacúan en ambulancia (ss09).
- **Protecciones colectivas:** casetas de aseo y vestuario; botiquín (también de tajo si hay zonas alejadas).
- **EPI:** —
- **Fuentes:** todos los estudios; ss13 II.3.
- **No se imprimen** estas cifras de los ejemplos: 2 m² de vestuario por trabajador, 2,30 m de altura libre, cabina de 1 × 1,20 m, 1,20 m² de comedor por trabajador, un espejo por cada 25, un lavabo por retrete. Vienen de la Ordenanza de 1971 o no tienen respaldo verificado (ss01, ss02, ss03, ss04, ss06, ss07, ss08, ss09, ss11).

#### IP7 · Instalación provisional · Acopios y almacenamiento de materiales (vivienda)
- **Riesgos:** caída de objetos por desplome (pilas); caída de objetos en manipulación; caída de personas al mismo nivel; golpes o cortes por objetos o herramientas (vidrio); atrapamiento por o entre objetos.
- **Medidas preventivas:** zonas de acopio en el plano de ordenación, «según la fase» (ss14), fuera de los pasos y balizadas; material suelto de 1,50 m de alto como máximo (ss15); sacos en capas cruzadas y, a partir de 1,50 m, en pirámide escalonando 0,50 m (ss15); palés de 700 kg como máximo, flejados y sin apilar cargados (ss15); material rodante calzado; ferralla, perfiles y tablones sobre durmientes, en pilas de 1,50 m como máximo (ss01, ss07, ss09, ss11); vidrio en vertical sobre durmientes, algo ladeado y señalizado (ss01, ss07, ss11); palés de ladrillo junto a los pilares, lejos de los vanos y de los bordes (ss09, ss11); no sobrecargar forjados ni cubiertas; nada en las casetas de higiene; distancia al borde de las excavaciones según F4 y F5.
- **Protecciones colectivas:** vallas o malla de balizamiento; señalización.
- **EPI:** guantes; calzado de seguridad; casco.
- **Fuentes:** ss01, ss03, ss07, ss09, ss11, ss14, ss15.

#### IP8 · Instalación provisional · Almacén de inflamables y productos químicos (pinturas, colas, disolventes, gases licuados) (vivienda)
- **Riesgos:** incendios; explosiones; exposición a contaminantes químicos (vapores); exposición a sustancias nocivas o tóxicas (trasvases).
- **Medidas preventivas:** recinto ventilado (con corriente de aire) e iluminado, con puerta y cerradura; extintor junto a la puerta; señales «Peligro de incendio» y «Prohibido fumar»; envases cerrados y etiquetados, con su ficha de datos de seguridad; productos separados por incompatibilidad; botellas de gas de pie, sujetas en carro, a la sombra y con capuchón; letrero «No usar acetileno para soldar cobre» (ss11); nunca en las casetas de higiene; trapos impregnados en un recipiente metálico cerrado, para el gestor (ss01).
- **Protecciones colectivas:** ventilación; extintor; señalización.
- **EPI:** guantes; mascarilla con filtro para vapores en los trasvases.
- **Fuentes:** ss01, ss02, ss07, ss10, ss11, ss15.

### 4.4 Fases de obra

#### F0 · Fase de obra · Riesgos y medidas comunes a toda la obra (vivienda)
- **Riesgos:** caída de personas al mismo nivel y a distinto nivel; caída de objetos desprendidos; choques contra objetos inmóviles; golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas; sobreesfuerzos; exposición a contactos eléctricos; exposición a temperaturas ambientales extremas (trabajo a la intemperie).
- **Medidas preventivas** (entre paréntesis, la frecuencia que da ss10; duda 5):
  - **Permanentes:** orden y limpieza; iluminación suficiente; no permanecer en el radio de acción de las máquinas ni bajo cargas suspendidas; señalización y balizamiento.
  - **Frecuentes:** retirada de escombros; información y formación.
  - **Riesgo evitable:** no trabajar en el exterior con viento fuerte, lluvia, nieve o heladas (ss10).
  - **Organización:** coordinación entre oficios, sin trabajos superpuestos en la misma vertical (ss10, ss11); normas de acceso y circulación (ss11).
  - **Cargas:** 25 kg por persona como máximo, y las mayores entre dos o con medios mecánicos (ss01, ss08).
  - **Calor:** hidratación, descansos y ropa adecuada (ss15).
- **Protecciones colectivas:** señales y carteles; cintas de balizamiento; extintor; escaleras auxiliares en buen estado.
- **EPI:** casco, calzado de seguridad y ropa de trabajo (permanentes); ropa impermeable (con mal tiempo); gafas (frecuente); protectores auditivos y mascarilla según el tajo; faja lumbar (ocasional).
- **Fuentes:** ss01, ss05, ss08, ss10, ss11, ss15.

#### F1 · Fase de obra · Demolición manual, elemento a elemento, en reforma (vivienda)
- **Riesgos:** caída de personas a distinto nivel (huecos, forjados debilitados); caída de objetos por desplome o derrumbamiento (hundimiento de forjados, muros y voladizos; descalce de medianeras); caída de objetos desprendidos y en manipulación; atrapamiento por o entre objetos; golpes o cortes por objetos o herramientas; pisadas sobre objetos (clavos); exposición a contactos eléctricos (instalaciones sin anular); explosiones e incendios (gas, depósitos); exposición a contaminantes químicos (polvo, sílice); exposición a ruido; exposición a vibraciones; sobreesfuerzos; exposición a amianto (si lo hay: apartado 11).
- **Medidas preventivas:**
  - **Antes de empezar.** Estudio previo del edificio por la DF, con testigos en las medianeras y en los elementos dudosos. Identificación del amianto (apartado propio; RD 396/2006 art. 10.2 [V]). Acometidas anuladas con las compañías (electricidad, agua, gas, telecomunicaciones), saneamiento taponado y depósitos vaciados. Retirada previa de vidrios y aparatos sanitarios, sin trocearlos. Plano del estado actual con la superficie y el volumen a demoler (ss14).
  - **Orden de la demolición.** Inverso al de construcción: de arriba abajo, planta a planta y aligerando de forma simétrica. Nadie trabaja en la misma vertical. No se retiran arriostramientos, tirantes ni apeos hasta anular sus esfuerzos. Los voladizos se apuntalan antes de quitar los contrapesos.
  - **Durante.** Apeos y apuntalamientos vigilados a diario. Al acabar la jornada no queda nada inestable, y se arriostran los muros cuya altura pase de 7 veces el espesor (ss11). Troceo en piezas que pueda manejar una persona; lo mayor, suspendido o apuntalado. Pasarelas sobre las viguetas sin entrevigado. En la madera, clavos doblados o arrancados. Martillos solo con autorización de la DF.
  - **Escombros.** Como máximo 100 kg/m² sobre los forjados (ss11). Nada sobre los andamios ni contra vallas o medianeras. Evacuación por bajante cerrada hasta el contenedor (MA10). Riego contra el polvo sin encharcar a los colindantes.
  - **Clima.** Parar con lluvia o viento fuerte (ss11: más de 60 km/h ⚠).
  - **Caídas.** Protección colectiva desde 2 m de caída (RD 1627, anexo IV C.3) [V]. ss11 ponía el arnés a partir de 3 m: se corrige.
- **Protecciones colectivas:** barandillas en huecos y bordes; redes o lonas en la fachada; andamios arriostrados; pantalla o marquesina sobre la vía pública (IP2); bajante de escombros; lonas antipolvo; zona de caída acotada y vigilada; cerramiento provisional de la parcela (ss14).
- **EPI:** casco; gafas antifragmentos; mascarilla filtrante adecuada al polvo; protectores auditivos; guantes contra agresiones mecánicas; calzado con puntera y plantilla antiperforación; arnés anticaídas solo donde no quepa protección colectiva; equipo de oxicorte si se corta metal.
- **Anexo II:** apdo. 1 (hundimiento, caída de altura); apdo. 2 si hay amianto.
- **Fuentes:** ss02, ss03, ss04, ss10, ss11, ss14.

#### F2 · Fase de obra · Demolición mecánica (por empuje o con máquina)
- **Riesgos:** caída de objetos por desplome o derrumbamiento; atrapamiento por vuelco de máquinas o vehículos; proyección de fragmentos o partículas; atrapamiento por o entre objetos; atropellos o golpes con vehículos; exposición a ruido; exposición a contaminantes químicos (polvo).
- **Medidas preventivas:** altura a demoler de 2/3 del alcance de la máquina como máximo; máquina sobre suelo firme y con giro libre; empuje por encima del centro de gravedad del elemento; distancia de la máquina igual o mayor que la altura de la fábrica que empuja; la parte unida a las medianerías se demuele antes a mano (en una franja de 1 m como mínimo); los faldones inclinados se demuelen antes; no se usan grúas para arrastrar.
- **Protecciones colectivas:** cabina FOPS con vidrio laminado y malla; zona de caída señalizada.
- **EPI:** casco; protectores auditivos; mascarilla; calzado de seguridad.
- **Fuentes:** ss11.

#### F3 · Fase de obra · Picado de revestimientos y demolición de pavimentos (vivienda)
- **Riesgos:** proyección de fragmentos o partículas; caída de objetos desprendidos; exposición a contactos eléctricos (instalaciones empotradas); exposición a ruido; exposición a vibraciones; exposición a contaminantes químicos (polvo, sílice); sobreesfuerzos; atrapamiento por o entre objetos (martillo en máquina).
- **Medidas preventivas:** localizar las instalaciones empotradas o enterradas antes de picar (ss11); riego sin encharcar; mascarilla cuando el polvo no se pueda eliminar; con exposición alta a ruido, información, protectores y vigilancia de la salud (ss15 da 80 dB(A) ⚠: cotejar con el RD 286/2006); radio libre de 5 m alrededor del martillo montado en máquina (ss15); nadie trabaja por debajo; relevos.
- **Protecciones colectivas:** zona acotada; señalista si se trabaja en calzada.
- **EPI:** protectores auditivos; gafas; mascarilla; guantes; calzado de seguridad; faja antivibraciones.
- **Fuentes:** ss04, ss11, ss15.

#### F4 · Fase de obra · Movimiento de tierras: excavación y vaciado a cielo abierto (vivienda)
- **Riesgos:** caída de objetos por desplome o derrumbamiento (tierras, taludes, descalce de colindantes); caída de personas a distinto nivel (borde); caída de personas al mismo nivel (barro); atropellos o golpes con vehículos; atrapamiento por vuelco de máquinas o vehículos; choques contra objetos móviles; exposición a contactos eléctricos (líneas aéreas o enterradas); exposición a contaminantes químicos (polvo); exposición a ruido; exposición a vibraciones; exposición a temperaturas ambientales extremas; proyección de fragmentos o partículas (piedras).
- **Medidas preventivas:**
  - **Inspección.** Terreno y colindantes antes de empezar (apuntalar los que estén deteriorados, con testigos), a diario y después de lluvias o heladas; dos veces por jornada en ss15.
  - **Terreno.** Taludes según el estudio geotécnico. Bolos y viseras saneados. No socavar ni excavar por debajo de la máquina. No trabajar al pie de un frente sin sanear ni en la vertical de otro tajo. Bataches junto a las medianeras (ss07). Frente de excavación de 1 m como máximo por encima del alcance del brazo (ss07).
  - **Distancias al borde.** Acopios a 2 m del borde ⚠ (los ejemplos dan de 0,60 a 2,50 m: §4.9). Vehículos ligeros a 3 m y pesados a 4 m ⚠ (ss07, ss11). Topes de final de recorrido.
  - **Circulación.** Accesos separados para personas y máquinas. Rampas con pendiente y anchura adecuadas (ss07: 4,5 m de ancho, 12 % en recta y 8 % en curva como máximo) y tramo horizontal de 6 m como mínimo antes de la calle. Maniobras dirigidas por una persona distinta del conductor. Nadie en el radio de acción de las máquinas. Prohibido llevar personas en ellas.
  - **Agua y clima.** Instalaciones enterradas localizadas y señalizadas (IP3). Achique sin arrastre de finos. Parar con lluvia, viento o helada.
- **Protecciones colectivas:** barandilla de 90 cm como mínimo, con pasamanos, protección intermedia y rodapié, en bordes con caída de más de 2 m [V]; balizamiento a 1,00–1,50 m del borde en excavaciones de menos de 2 m (ss15); pasarelas de 60 cm como mínimo con barandilla; topes; iluminación y señales reflectantes; redes o mallazo sobre los taludes (ss15).
- **EPI:** casco; calzado de seguridad; botas y traje de agua; guantes; mascarilla y gafas antipolvo; protectores auditivos; ropa de alta visibilidad.
- **Anexo II:** apdo. 1 (sepultamiento) si la excavación lo supone.
- **Fuentes:** ss01, ss02, ss04, ss07, ss08, ss09, ss11, ss12, ss15.

#### F5 · Fase de obra · Zanjas (saneamiento, acometidas, cimentación corrida) (vivienda)
- **Riesgos:** caída de objetos por desplome o derrumbamiento (paredes; fallo de la entibación); caída de personas a distinto nivel (al interior); caída de objetos desprendidos (al interior); caída de personas al mismo nivel; atropellos o golpes con vehículos; golpes o cortes por objetos o herramientas (tubos); exposición a sustancias nocivas o tóxicas (gases); exposición a contactos eléctricos (servicios).
- **Medidas preventivas:**
  - **Entibación.** Supervisión por persona competente. Entibación según el terreno ⚠: la profundidad a partir de la cual se exige no coincide entre ejemplos y no se imprime hasta verificarla (§4.9). Se coloca sin entrar antes de sostener las paredes y se revisa al empezar la jornada y después de lluvias, heladas o días sin trabajo. No se usa como escalera.
  - **Acceso.** Escalera de mano anclada arriba que sobrepase 1 m el borde [W], una cada 30 m de zanja (ss11). Ancho mínimo de 60 cm, con sobreancho para trabajar con el tubo colocado (ss01). Fuera de la zanja mientras se presenta el tubo (ss01).
  - **Trabajadores dentro.** Prohibido trabajar solo en zanjas profundas, con un retén fuera ⚠ (1,25 a 1,50 m según el ejemplo).
  - **Bordes y entorno.** Acopios lejos del borde ⚠. Vallas a 1 m como mínimo del borde con peatones y a 2 m con vehículos. Si los vehículos circulan en perpendicular, zona acotada de dos veces la profundidad y 4 m como mínimo (ss08, ss11). Iluminación cada 10 m. Bocas tapadas al acabar la jornada. Tuberías calzadas, sin acopiar material rodante junto al borde.
  - **Imprevistos.** Si aparece una conducción, parar. Achique inmediato.
- **Protecciones colectivas:** entibación; barandilla de 90 cm como mínimo en bordes con caída de más de 2 m [V]; pasarelas de 60 cm como mínimo, con barandilla, para cruzar; tableros o tapas sobre las bocas; vallas con rodapié; malla de balizamiento.
- **EPI:** casco con barbuquejo; calzado de seguridad; botas de agua; guantes de cuero; mascarilla; ropa de alta visibilidad.
- **Anexo II:** apdo. 1 (sepultamiento) en zanjas profundas o en terreno inestable. *Una zanja a cielo abierto no es una «conducción subterránea» del art. 4.1 d) (Guía; K-SYS.1).*
- **Fuentes:** ss01, ss02, ss07, ss08, ss09, ss11, ss15.

#### F6 · Fase de obra · Pozos y pocería (cimentación por pozos, arquetas profundas)
- **Riesgos:** caída de personas a distinto nivel; caída de objetos desprendidos (al fondo); caída de objetos por desplome o derrumbamiento (paredes); exposición a sustancias nocivas o tóxicas (atmósfera pobre en oxígeno o con gases); exposición a contactos eléctricos; caída de personas al mismo nivel; sobreesfuerzos; exposición a temperaturas ambientales extremas.
- **Medidas preventivas:** antes de excavar, conocer el terreno, los colindantes y las conducciones; pocero experto; entibación según el terreno ⚠; sin motores de combustión dentro y con ventilación forzada; si aparece gas o se levanta el fondo, parar y avisar; acopios fuera de un radio de 2 m; nadie solo dentro, con un retén fuera; bajada por escalera anclada que sobrepase 1 m, nunca por la entibación; espacio libre en el fondo de 80 cm de diámetro como mínimo (ss01); bocas tapadas al terminar; 24 V si hay agua; prohibido fumar dentro.
- **Protecciones colectivas:** barandilla de 90 cm como mínimo alrededor de la boca; entablado de la bocana; tapas; malla de balizamiento sobre pies derechos (ss14); dispositivo anticaídas en el acceso (UNE-EN 353-2, ss08; norma no cotejada); ventilación.
- **EPI:** casco (con lámpara); botas; guantes; mascarilla; arnés con cuerda de rescate si procede.
- **Anexo II:** apdos. 1 y 6.
- **Fuentes:** ss01, ss02, ss08, ss11, ss14.

#### F7 · Fase de obra · Rellenos y compactación
- **Riesgos:** atropellos o golpes con vehículos; atrapamiento por vuelco de máquinas o vehículos; caída de objetos desprendidos (de las cajas); caída de personas a distinto nivel (desde la caja); exposición a vibraciones; exposición a contaminantes químicos (polvo); exposición a ruido.
- **Medidas preventivas:** conductores con capacitación; vehículos revisados, con la tara y la carga máxima a la vista y sin sobrecarga; cada equipo dirigido por un operario a pie; riego de tajos y cargas; nadie a menos de 5 m de compactadoras y apisonadoras en marcha (ss15); bocina de marcha atrás; topes en los bordes de vertido; señales «Peligro, salida de camiones» y STOP en los accesos; con compactadores manuales, avanzar siempre hacia delante, no empujar con los pies y relevar cada 1,5 h (ss15).
- **Protecciones colectivas:** topes de vertido; recorridos señalizados.
- **EPI:** casco; calzado de seguridad; protectores auditivos; mascarilla; faja antivibraciones; ropa de alta visibilidad.
- **Fuentes:** ss09, ss15.

#### F8 · Fase de obra · Cimentación: zapatas, losas, muros de sótano y foso de ascensor (vivienda)
- **Riesgos:** caída de personas a distinto nivel (a pozos y zanjas); caída de personas al mismo nivel (barro); caída de objetos por desplome o derrumbamiento (laterales de la excavación; reventón del encofrado); caída de objetos en manipulación (armaduras, cargas suspendidas); pisadas sobre objetos; golpes o cortes por objetos o herramientas (ferralla); atrapamiento por o entre objetos; contactos con sustancias cáusticas o corrosivas (hormigón); atropellos o golpes con vehículos (hormigonera, dúmper); exposición a ruido y a vibraciones (vibrador); exposición a contactos eléctricos; sobreesfuerzos.
- **Medidas preventivas:**
  - **Armaduras.** Montadas en la mesa de ferrallista y colocadas ya terminadas. Paquetes izados desde dos puntos, con eslingas o balancín, y guiados por tres operarios: dos con sogas y uno que dirige (ss07, ss11). Setas o capuchones en las esperas. Acopio sobre durmientes, de 1,50 m como máximo. Nadie bajo cargas suspendidas.
  - **Hormigonado.** Plataformas de paso de 60 cm como mínimo sobre zanjas y zapatas. Hormigonar desde plataformas, sin pisar la ferralla. Vibrar desde una plataforma de tres tablones perpendicular a la zanja. Revisar encofrados y entibaciones antes de hormigonar. Topes para la hormigonera y el dúmper.
  - **Excavación.** Si se interrumpe, tapada y cercada. Agua achicada. Pozos y zapatas abiertos, señalizados con malla sobre pies derechos (ss14). Nadie solo en zanjas profundas.
- **Protecciones colectivas:** barandilla de 90 cm como mínimo en bordes con caída de más de 2 m [V]; tableros en los huecos; plataformas y pasarelas; topes; malla de balizamiento.
- **EPI:** casco con barbuquejo; guantes de cuero (ferralla) y de goma (hormigón); calzado con puntera y plantilla antiperforación; botas y traje de agua; gafas en el vertido; mandil de ferrallista.
- **Fuentes:** ss01, ss02, ss07, ss11, ss12, ss14.

#### F9 · Fase de obra · Muros de contención encofrados a dos caras
- **Riesgos:** caída de personas a distinto nivel; caída de personas al mismo nivel; caída de objetos por desplome o derrumbamiento (reventón del encofrado); caída de objetos en manipulación; golpes o cortes por objetos o herramientas; atrapamiento por o entre objetos; sobreesfuerzos; atropellos o golpes con vehículos; exposición a contactos eléctricos.
- **Medidas preventivas:** taludes revisados y saneados; ferralla acopiada en orden, de 1,50 m como máximo; protectores en las esperas; nadie bajo cargas suspendidas; encofrados revisados antes de hormigonar; vertido repartido; vibradores con doble aislamiento; parar con viento fuerte o lluvia ⚠; en el trasdós, cada trabajador acompañado de otro; topes para camiones y un operario que guíe las maniobras.
- **Protecciones colectivas:** redes y líneas de vida para trabajos a más de 2 m; accesos por escalera o rampa de 60 cm como mínimo; pasarela de coronación con barandilla.
- **EPI:** casco; guantes; calzado de seguridad; arnés.
- **Fuentes:** ss11.

#### F10 · Fase de obra · Encofrado y desencofrado (vivienda)
- **Riesgos:** caída de personas a distinto nivel (borde, encofrado); caída de personas al mismo nivel; caída de objetos por desplome o derrumbamiento (pilas de madera; encofrado); caída de objetos desprendidos (tableros y puntales al desencofrar); golpes o cortes por objetos o herramientas (sierra, clavazón); pisadas sobre objetos (puntas); atrapamiento por o entre objetos; sobreesfuerzos; exposición a contactos eléctricos (sierra); proyección de fragmentos o partículas.
- **Medidas preventivas:** prohibido encofrar sin redes o barandillas ya puestas (ss09, ss11); tableros y puntales izados en bateas emplintadas y flejadas, con nadie en la zona que barre la carga; madera acopiada en orden; tableros alabeados desechados; huecos tapados con madera clavada antes de armar; desencofrar desde el lado ya desencofrado, con uña metálica, reteniendo los tableros y sin dejar caer material a la red, con la zona de caída acotada; puntas extraídas o remachadas; barrido diario de puntas, alambres y recortes; no trabajar sobre sopandas ni encofrados con viento, lluvia o helada; no cargar material pesado sobre el encofrado; acceso por escalera de mano reglamentaria y pasarela de 60 cm como mínimo.
- **Protecciones colectivas:** redes bajo forjado o sistema equivalente; redes de horca; barandillas; plataformas de trabajo.
- **EPI:** casco; guantes de cuero; calzado con plantilla antiperforación; gafas al cortar; arnés donde no quepa protección colectiva (montaje de las protecciones).
- **Fuentes:** ss01, ss02, ss07, ss09, ss11, ss12.

#### F11 · Fase de obra · Estructura de hormigón: ferralla, forjados y hormigonado (vivienda)
- **Riesgos:** caída de personas a distinto nivel (bordes y huecos de forjado); caída de personas al mismo nivel; caída de objetos desprendidos (a niveles inferiores); caída de objetos en manipulación (viguetas, bovedillas, cubo); choques contra objetos móviles (cubo, tubería de la bomba); caída de objetos por desplome o derrumbamiento (reventón del encofrado); pisadas sobre objetos; golpes o cortes por objetos o herramientas; atrapamiento por o entre objetos; contactos con sustancias cáusticas o corrosivas; exposición a contactos eléctricos (vibrador); exposición a ruido; sobreesfuerzos.
- **Medidas preventivas:**
  - **Antes de empezar.** Comprobar planos, replanteo, apeos y encofrados.
  - **Ferralla y piezas.** Redondos en horizontal sobre durmientes, en pilas de 1,50 m como máximo. Prohibido izar en vertical las armaduras de pilares y trepar por las armaduras. Viguetas suspendidas de dos puntos y bovedillas en bateas. Colocación guiada por dos operarios con sogas y un tercero que dirige.
  - **Circulación.** Pasarelas o plataformas de 60 cm como mínimo sobre el forjado sin hormigonar. Prohibido pisar las bovedillas.
  - **Hormigonado.** Pilares desde castilletes con barandilla. Con cubo: sin pasar de su carga máxima, zona barrida señalizada, apertura con la palanca y cabos de guía. Con bomba: tubería sobre caballetes y arriostrada, manguera gobernada por dos operarios y montaje dirigido por un especialista.
  - **Huecos y bordes.** Ocluir todos los huecos, también shunts y ventilaciones que no estén en los planos (ss14). Sustituir cuanto antes las protecciones provisionales por los pretiles definitivos. Al retirar las redes, barandillas en todos los bordes. Losa de escalera con peldañeado inmediato.
  - **Clima.** Parar con lluvia o mal tiempo, y con grúa si el viento es fuerte ⚠ (ss07: 50 km/h).
- **Protecciones colectivas:** redes de horca en todo el perímetro, cubriendo dos plantas (ss11); redes horizontales bajo forjado; mallazo pasante en patinillos y huecos de ascensor (ss01); barandillas de borde de 90 cm como mínimo [V] (MA7); visera perimetral en el techo de la planta baja (ss11); castilletes; línea de vida para montar las protecciones.
- **EPI:** casco; guantes de cuero y de goma; calzado reforzado; botas y polainas para el hormigón; gafas; arnés en el montaje de protecciones y donde no quepa protección colectiva.
- **Fuentes:** ss01, ss02, ss07, ss09, ss11, ss12, ss14, ss15.

#### F12 · Fase de obra · Estructura metálica: montaje y soldadura
*Frecuente en reforma (vigas y cargaderos al abrir huecos, refuerzos).*
- **Riesgos:** caída de personas a distinto nivel (al moverse por las alas de las vigas o trepar); caída de objetos desprendidos (perfiles a gancho); caída de objetos por desplome o derrumbamiento (pilas de perfiles; estructura sin arriostrar); choques contra objetos móviles (la carga); atrapamiento por o entre objetos; exposición a radiaciones (arco); contactos térmicos; incendios y explosiones (botellas, chispas); exposición a contaminantes químicos (humos metálicos, galvanizado); exposición a contactos eléctricos; proyección de fragmentos o partículas; sobreesfuerzos.
- **Medidas preventivas:**
  - **Acopio e izado.** Perfiles por capas cruzadas sobre durmientes, de 1,50 m como máximo. Izado con eslingas de acero con pestillo o con garras. Piezas presentadas por tres operarios: dos con sogas y uno que dirige. Cuerdas de seguridad en los perfiles antes de izarlos, para amarrar el arnés.
  - **Montaje.** Estructura arriostrada. No elevar una nueva altura sin terminar las soldaduras de la inferior. Prohibido trepar por la estructura y andar por las alas sin amarrarse. Perfiles cortados a medida, para no usar el oxicorte en altura. Escalera que sobrepase 1 m el desembarco.
  - **Soldadura.** En altura, desde guindola o plataforma con barandilla (MA4). Nadie bajo las cargas ni bajo los tajos de soldadura; si no se puede evitar, viseras. Mangueras colgadas y recogepinzas. Botellas en su carro. Mantas ignífugas y cortinas de PVC para proteger a terceros. Ventilación. Suspender con viento fuerte ⚠ (ss07: 60 km/h).
- **Protecciones colectivas:** redes horizontales bajo la primera altura; redes de horca; cuerda de circulación o línea de vida; guindolas; mantas ignífugas.
- **EPI:** arnés anticaídas; casco; pantalla de soldador; guantes, mandil y polainas de cuero; calzado de seguridad.
- **Fuentes:** ss01, ss02, ss05, ss07, ss09, ss11.

#### F13 · Fase de obra · Montaje de elementos prefabricados
- **Riesgos:** caída de personas a distinto nivel; caída de objetos por desplome o derrumbamiento (piezas suspendidas); atrapamiento por o entre objetos; choques contra objetos móviles.
- **Medidas preventivas:** recibir y colocar desde una plataforma con barandilla de 90 cm como mínimo; nadie en el recorrido de las piezas; acopio horizontal sobre durmientes, sin dañar los enganches; parar con viento fuerte ⚠ (ss09: 60 km/h).
- **Protecciones colectivas:** plataformas con barandilla; andamios.
- **EPI:** casco; arnés anticaídas; guantes; calzado de seguridad.
- **Anexo II:** apdo. 10 si los prefabricados son pesados.
- **Fuentes:** ss09.

#### F14 · Fase de obra · Cerramientos y fábricas de fachada (ladrillo, bloque, aplacados) (vivienda)
- **Riesgos:** caída de personas a distinto nivel (bordes, huecos, andamios); caída de personas al mismo nivel; caída de objetos en manipulación y por desplome o derrumbamiento (piezas izadas; fábricas recién hechas con viento); atrapamiento por o entre objetos (medios de elevación, montaje de andamios); golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas (corte, rozas); contactos con sustancias cáusticas o corrosivas (cemento, cal); exposición a contaminantes químicos (polvo); exposición a ruido; exposición a contactos eléctricos; sobreesfuerzos.
- **Medidas preventivas:**
  - **Huecos y bordes.** Cerrar primero los huecos interiores del forjado. Cables de seguridad entre pilares para amarrar el arnés al replantear y colocar miras (ss11). Si no hay andamio, la fábrica se hace desde dentro y sobre el forjado. La barandilla perimetral se quita solo en el tramo donde se recibe la carga y se repone enseguida. Los huecos verticales se destapan solo para aplomar. Red horizontal en los patios cada dos plantas (ss07, ss09, ss11).
  - **Cargas.** Cerámica izada flejada, en plataformas emplintadas, guiada con cabos y nunca con las manos. Prohibidos los puentes de un tablón. No concentrar palés sobre los vanos.
  - **Andamios.** Acceso desde el interior. Repisa para el material. Borriquetas en balcones o bordes solo con protección.
  - **Escombro.** Retirado a diario por bajante, nunca por los huecos.
  - **Posturas.** No trabajar por encima de los hombros ni en un nivel inferior al del tajo.
  - **Fábrica fresca.** No trabajar junto a fábricas levantadas en las últimas 48 h si hay viento fuerte (ss07, ss11). No someterlas a vibraciones del forjado.
  - **Corte y clima.** Corte de piezas por vía húmeda o en lugar ventilado. Parar con lluvia o temperaturas extremas.
- **Protecciones colectivas:** barandillas de 90 cm como mínimo, con protección intermedia y rodapié, en bordes y huecos [V]; tableros en huecos horizontales; mallazo o redes en huecos verticales; andamios normalizados; viseras a nivel de la planta primera; plataforma de carga y descarga; escaleras del edificio peldañeadas y con barandilla.
- **EPI:** casco; guantes de cuero y de goma; dediles reforzados para rozas; gafas; mascarilla antipolvo; protectores auditivos; arnés donde no quepa protección colectiva; calzado de seguridad.
- **Anexo II:** apdo. 1 en fachada con caída de altura.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss06, ss07, ss08, ss09, ss10, ss11, ss12.

#### F15 · Fase de obra · Tabiquería y particiones interiores (ladrillo, placa de yeso laminado, paneles) (vivienda)
- **Riesgos:** caída de personas al mismo nivel; caída de personas a distinto nivel (huecos interiores, borriquetas); sobreesfuerzos (también movimientos repetitivos); choques contra objetos inmóviles y móviles; caída de objetos en manipulación; golpes o cortes por objetos o herramientas (perfilería, cúter); proyección de fragmentos o partículas; contactos con sustancias cáusticas o corrosivas; exposición a contaminantes químicos (polvo); exposición a contactos eléctricos.
- **Medidas preventivas:** las de F14 que apliquen; iluminación suficiente en el tajo (⚠ los ejemplos dan 100 lux) y portátiles a 24 V; placas manipuladas entre dos; atornillador y cortador con sus resguardos (ss05); corte en lugar ventilado; coordinación entre oficios; plataformas sobre borriquetas en lugar de escaleras.
- **Protecciones colectivas:** barandillas en huecos; plataformas libres de obstáculos.
- **EPI:** casco; guantes; gafas; mascarilla; calzado de seguridad.
- **Fuentes:** ss01, ss02, ss05, ss11. *La placa de yeso laminado no tiene ficha propia en ningún ejemplo (§4.8).*

#### F16 · Fase de obra · Cubierta plana o azotea (vivienda)
- **Riesgos:** caída de personas a distinto nivel (borde, huecos, lucernarios); caída de objetos desprendidos (a niveles inferiores); caída de personas al mismo nivel; golpes o cortes por objetos o herramientas; sobreesfuerzos; exposición a temperaturas ambientales extremas (con viento como causa); exposición a contactos eléctricos (líneas próximas); proyección de fragmentos o partículas.
- **Medidas preventivas:**
  - **Antes de empezar.** Comprobar las protecciones colectivas.
  - **Acopios.** Repartidos sobre durmientes, cerca de las vigas, lejos del borde y sin sobrecargar.
  - **Clima.** Parar con viento fuerte ⚠ (50 o 60 km/h según el ejemplo), heladas, lluvia o nieve.
  - **Organización.** Vertical acotada. Personal experto, nunca solo. No salir de las zonas de trabajo previstas. Obstáculos señalizados. Sin trabajos superpuestos.
  - **Lucernarios y medios.** Lucernarios protegidos o recibidos con cuerdas hasta fijarlos. Prohibidos los andamios de bidones o pilas de material. Plataformas de 60 cm como mínimo.
  - **Protección retirada.** Si hay que quitar una protección colectiva, se sustituye por EPI anclado.
- **Protecciones colectivas:** barandilla perimetral de 90 cm como mínimo [V], o andamio perimetral con plataforma en el borde (ss14); parapetos rígidos, también en los casetones; redes de horca, con caída sobre la red de 6 m como máximo (ss09, ss11); tableros en los huecos; protección de lucernarios; cables o líneas de vida a puntos fuertes; acceso protegido a la cubierta; zona acotada a nivel de suelo.
- **EPI:** arnés anticaídas (donde no quepa protección colectiva); calzado antideslizante; guantes; casco.
- **Anexo II:** apdo. 1.
- **Fuentes:** ss01, ss06, ss09, ss10, ss11, ss12, ss14. *Se quitan las alturas de barandilla de ss11 (0,95 / 1,00 / 1,10 / 1,50 m según la altura de caída), que no tienen base.*

#### F17 · Fase de obra · Cubierta inclinada (teja, panel, materiales ligeros) (vivienda)
- **Riesgos:** caída de personas a distinto nivel (alero, faldón, rotura de materiales ligeros); caída de personas al mismo nivel (sobre el faldón); caída de objetos desprendidos; caída de objetos por desplome o derrumbamiento (hundimiento por acopios); golpes o cortes por objetos o herramientas; contactos térmicos (impermeabilización); exposición a contactos eléctricos (líneas próximas); exposición a temperaturas ambientales extremas.
- **Medidas preventivas:** acceso a la cubierta previsto desde el proyecto; zona de caída de objetos acotada abajo; acopios repartidos y prohibidos los excesivos, con carteles; no pisar nunca directamente los materiales ligeros, sino pasarelas o plataformas de reparto; plataforma horizontal sobre cuñas para trabajar en el faldón (ss09); arnés amarrado a una línea de vida en la cumbrera para moverse por el faldón; tendidos aéreos localizados y señalizados; parar con mal tiempo; la teja se levanta por faldones opuestos, empezando por la cumbrera (ss11).
- **Protecciones colectivas:** andamio perimetral o barandilla rígida en el alero, con protección en la coronación; redes; viseras en la última planta; pasarelas con barandilla; línea de vida; tableros en los huecos.
- **EPI:** arnés anticaídas; calzado antideslizante; guantes; casco.
- **Anexo II:** apdo. 1.
- **Fuentes:** ss06, ss07 (desde el mantenimiento), ss09, ss11, ss12. *Ficha débil: ningún ejemplo trae la ejecución completa (§4.8).*

#### F18 · Fase de obra · Impermeabilización con láminas (soplete) y productos (vivienda)
- **Riesgos:** contactos térmicos (soplete); incendios; exposición a contaminantes químicos (humos de betún, imprimaciones); caída de personas a distinto nivel (borde); caída de personas al mismo nivel; sobreesfuerzos; exposición a temperaturas ambientales extremas; proyección de fragmentos o partículas.
- **Medidas preventivas:** almacén ventilado y con extintor (IP8); extintor de polvo junto al tajo de soplete; prohibido fumar; ni soldadura ni oxicorte cerca; ventilación al trabajar con imprimaciones; soporte comprobado antes de empezar; si se interrumpe el trabajo, la cubierta queda estanca y lastrada contra el viento (ss01); rollos acopiados según su tipo, de pie o tumbados y a cinco alturas como máximo (ss01); botellas de gas a la sombra; parar con mal tiempo.
- **Protecciones colectivas:** las de la cubierta (barandillas o petos); extintor; zona acotada.
- **EPI:** guantes de cuero contra el calor (los de goma fina de ss01 no sirven con soplete); botas, polainas y mandil de cuero; mascarilla con filtro; gafas.
- **Fuentes:** ss01, ss07, ss10, ss11, ss12. *Sin ficha de impermeabilización de muros o sótanos (§4.8).*

#### F19 · Fase de obra · Carpintería exterior e interior (madera, aluminio, PVC) (vivienda)
- **Riesgos:** caída de personas a distinto nivel (huecos de fachada, balcones, miradores); caída de personas al mismo nivel; caída de objetos en manipulación y por desplome o derrumbamiento (cercos sin acuñar, hojas); golpes o cortes por objetos o herramientas (máquinas, recortes); atrapamiento por o entre objetos; proyección de fragmentos o partículas; sobreesfuerzos; exposición a contactos eléctricos; exposición a contaminantes químicos (polvo de lijado, maderas tóxicas, colas).
- **Medidas preventivas:**
  - **Material.** Descarga y elevación en bloques flejados. Acopio en los lugares previstos, con los pasos libres. Colas y barnices en un almacén ventilado. Recortes y serrín recogidos.
  - **Colocación.** Cercos y precercos acuñados y apuntalados hasta su fijación, con un listón contra deformaciones a unos 60 cm, en madera blanca para que se vea (ss01, ss03, ss07, ss11). Cercos y hojas presentados y colgados entre dos operarios como mínimo. Perfiles al hombro, con el extremo delantero alto. Colocar desde el interior siempre que se pueda.
  - **Protecciones.** Las colectivas se quitan solo en el tramo necesario, con EPI que las sustituya, y se reponen enseguida.
  - **Máquinas.** Autorización por escrito para cada máquina-herramienta. Doble aislamiento o toma de tierra. Desconectadas cuando no se usan. Mascarilla al lijar.
- **Protecciones colectivas:** barandillas o redes en los huecos; anclajes y cuerdas para el arnés en los alféizares (ss11); zona acotada; trompas de vertido.
- **EPI:** guantes anticorte; casco; calzado con puntera; gafas; mascarilla; arnés anclado en huecos sin protección colectiva.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss07, ss09, ss11, ss12.

#### F20 · Fase de obra · Vidrio y acristalamiento (vivienda)
- **Riesgos:** golpes o cortes por objetos o herramientas (vidrio); pisadas sobre objetos (fragmentos); caída de objetos en manipulación y desprendidos (fragmentos); caída de personas a distinto nivel y al mismo nivel; sobreesfuerzos; exposición a contaminantes químicos (siliconas, masillas).
- **Medidas preventivas:** vidrio en vertical sobre una base antideslizante o durmientes, en un lugar señalizado; manipulación con ventosas y en vertical; piezas con los cantos matados, con solo cortes de ajuste en obra; nadie en la vertical del tajo (acotar con banderolas); colocar desde dentro y sellar sin sacar el cuerpo; vidrieras grandes desde una plataforma con barandilla, recibidas con cuerdas; los vidrios ya puestos, marcados con pintura a la cal; fragmentos recogidos enseguida para el gestor; andamio para acristalar a más de 2 m; no trabajar por debajo de 0 °C ni con viento fuerte (ss11).
- **Protecciones colectivas:** barandilla de 90 cm como mínimo en el lado del andamio que da a la ventana; zona acotada.
- **EPI:** guantes anticorte y manguitos; calzado con suela reforzada; casco; gafas; arnés.
- **Fuentes:** ss01, ss02, ss03, ss04, ss07, ss09, ss11, ss12.

#### F21 · Fase de obra · Cerrajería, barandillas definitivas y soldadura en obra (vivienda)
- **Riesgos:** caída de personas a distinto nivel; caída de objetos en manipulación (piezas metálicas); golpes o cortes por objetos o herramientas; atrapamiento por o entre objetos; pisadas sobre objetos; proyección de fragmentos o partículas; contactos térmicos y exposición a radiaciones (soldadura); incendios; exposición a contactos eléctricos; exposición a contaminantes químicos (humos de galvanizado); sobreesfuerzos.
- **Medidas preventivas:** izado en bloques flejados; tajos limpios de recortes; máquinas con autorización y con sus protecciones; las barandillas definitivas se colocan sin demora y la provisional se mantiene hasta fijarlas; no acopiarlas en los bordes; fiador del arnés a los puntos previstos; prohibido usar bidones o cajas como borriquetas; nivel inferior acotado al soldar; mascarilla con filtro al soldar o cortar galvanizado; cables secos y sin empalmes, pinza en su funda y grupo desconectado al dejar el tajo; no soldar a la intemperie con lluvia o viento fuerte.
- **Protecciones colectivas:** barandilla provisional hasta la definitiva; pantallas o cortinas en la soldadura; extintor.
- **EPI:** arnés; casco; pantalla de soldador; guantes, mandil y polainas de cuero; calzado de seguridad.
- **Fuentes:** ss01, ss07, ss11, ss12.

#### F22 · Fase de obra · Instalación eléctrica de baja tensión, definitiva (vivienda)
- **Riesgos:** exposición a contactos eléctricos (pruebas, conexión a la red); caída de personas a distinto nivel (patinillos, escaleras, borriquetas); caída de personas al mismo nivel (rozas); golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas (rozas); exposición a contaminantes químicos (polvo); sobreesfuerzos; incendios; contactos térmicos.
- **Medidas preventivas:** conectar siempre sin tensión, comprobada con detector; pruebas solo con la instalación terminada, anunciadas a todo el personal y después de revisar conexiones, protecciones y cuadros; aparamenta montada por un especialista; herramienta aislada; orden y limpieza al abrir y cerrar rozas; iluminación suficiente en el tajo ⚠ (100 a 300 lux según el ejemplo) y portátiles a 24 V; escalera de tijera con zapatas y cadenilla, nunca como borriqueta; ni escaleras ni borriquetas junto a huecos sin proteger; en el exterior, parar con mal tiempo; nunca usar las tuberías como tierra o neutro.
- **Protecciones colectivas:** barandillas en huecos y patinillos; zona acotada durante las pruebas.
- **EPI:** guantes y calzado aislantes; casco; gafas en las rozas; arnés en altura.
- **Fuentes:** ss01, ss04, ss05, ss06, ss07, ss10, ss11, ss12.

#### F23 · Fase de obra · Fontanería y aparatos sanitarios (vivienda)
- **Riesgos:** caída de personas al mismo nivel y a distinto nivel; caída de objetos en manipulación; golpes o cortes por objetos o herramientas (tubos, guías); choques contra objetos inmóviles (transporte de tubos); contactos térmicos (soplete); incendios y explosiones (gases licuados); exposición a contaminantes químicos (humos de soldadura con plomo, colas de PVC); sobreesfuerzos (posturas forzadas); exposición a contactos eléctricos.
- **Medidas preventivas:** taller y almacén ventilados e iluminados; tubos a hombro con el extremo delantero por encima de la altura de una persona; patinillos cerrados después de usarlos; barandilla de 90 cm en los pasos de forjado que no se puedan tapar (ss07); aparatos sanitarios llevados del acopio a su sitio y montados enseguida, retirando los rotos; prohibido soldar con plomo en lugar cerrado; sopletes apagados al dejarlos y lejos de inflamables; botellas a la sombra, en un local ventilado con cerradura y extintor; sin pruebas de presión mientras se pinta (ss09); iluminación suficiente en el tajo.
- **Protecciones colectivas:** tapas o redes en los huecos; ventilación; extintor.
- **EPI:** guantes; gafas o pantalla al soldar; calzado de seguridad; mascarilla.
- **Fuentes:** ss01, ss07, ss09, ss11, ss12.

#### F24 · Fase de obra · Saneamiento: red enterrada, bajantes y colectores colgados (vivienda)
- **Riesgos:** caída de personas a distinto nivel (zanjas, colectores colgados); caída de objetos por desplome o derrumbamiento (zanjas); exposición a contaminantes químicos (colas y disolventes de PVC); exposición a vibraciones; exposición a contactos eléctricos; caída de personas al mismo nivel; sobreesfuerzos.
- **Medidas preventivas:** las de las zanjas (F5); andamio en condiciones para los colectores colgados y arnés si no hay protección colectiva; borriquetas solo en interiores y de poca altura ⚠ (ss01: 3 m); no trabajar en tajos inferiores; iluminación; arquetas y pozos tapados en cuanto se terminan; ventilación al usar colas.
- **Protecciones colectivas:** zanjas valladas; barandilla en los huecos; andamio.
- **EPI:** guantes de nitrilo o neopreno (colas); calzado; casco; arnés.
- **Fuentes:** ss01, ss11.

#### F25 · Fase de obra · Calefacción, climatización, ACS y equipos en cubierta (vivienda)
- **Riesgos:** caída de personas a distinto nivel (huecos, techos, cubierta para las unidades exteriores); caída de personas al mismo nivel; caída de objetos en manipulación (equipos, máquinas); atrapamiento por o entre objetos (izado con camión grúa o carretilla); contactos térmicos y exposición a radiaciones (soldadura de cobre); exposición a contaminantes químicos (refrigerantes, humos de soldadura); incendios y explosiones; exposición a contactos eléctricos; sobreesfuerzos.
- **Medidas preventivas:** equipos izados con medio mecánico (camión grúa, montacargas) y zona acotada, también en la vía pública (F36, M6); montaje en techo desde plataforma elevadora o andamio, no desde escalera; instrucciones del fabricante y formación del instalador; refrigerantes manipulados por instalador habilitado según su reglamento (ss05 cita el RD 138/2011, que es de instalaciones frigoríficas; para equipos de vivienda falta ver la norma); pruebas de estanqueidad con los instrumentos adecuados; ventilación en interiores; cortinas de PVC para proteger a terceros al soldar; local de bombonas ventilado y con extintor; patinillos cerrados; barandilla en los pasos de forjado; acopio en una zona habilitada.
- **Protecciones colectivas:** zona acotada durante el izado; barandilla o línea de vida en la cubierta; ventilación.
- **EPI:** arnés en cubierta y en plataformas articuladas; pantalla de soldar; guantes de cuero; casco; calzado; ropa de manga larga.
- **Fuentes:** ss05, ss07, ss09, ss10, ss11, ss12. *Ningún ejemplo trata bien el izado a cubierta ni los refrigerantes; ss09 era justo esa obra.*

#### F26 · Fase de obra · Telecomunicaciones, antenas y pararrayos
- **Riesgos:** caída de personas a distinto nivel (cubierta); caída de objetos desprendidos; atrapamiento por o entre objetos; golpes o cortes por objetos o herramientas; exposición a contactos eléctricos (líneas próximas); proyección de fragmentos o partículas; sobreesfuerzos; exposición a temperaturas ambientales extremas.
- **Medidas preventivas:** suspender con lluvia, nieve, hielo, viento fuerte o tormenta próxima; trabajar desde una plataforma horizontal sobre cuñas en el faldón, con barandilla de 90 cm como mínimo; antenas grandes montadas entre varios; bajante del pararrayos instalado a la vez que se trabaja en la fachada, con los mismos medios; líneas próximas sin servicio o apantalladas; herramientas de clase II o a menos de 50 V; puntos fijos para el arnés; escalera anclada que sobrepase 1 m.
- **Protecciones colectivas:** plataformas con barandilla; puntos de anclaje o línea de vida; barandilla de cubierta.
- **EPI:** arnés; casco; guantes; calzado.
- **Fuentes:** ss05, ss07, ss09, ss11, ss12, ss15.

#### F27 · Fase de obra · Ascensor: montaje en el hueco
- **Riesgos:** caída de personas a distinto nivel (por el hueco); caída de objetos desprendidos (por el hueco); atrapamiento por o entre objetos (tracción, cabina); contactos térmicos (soldadura); exposición a contactos eléctricos; golpes o cortes por objetos o herramientas; sobreesfuerzos.
- **Medidas preventivas:**
  - **Hueco.** Montaje por la empresa instaladora. Antes de tender los plomos, todos los accesos al hueco cerrados en cada planta con barandilla de 90 cm como mínimo o con entablado (ss07, ss14).
  - **Plataforma de trabajo.** Cubre todo el hueco, con barandilla y acuñada contra un descenso brusco. Prueba de carga antes de usarla (ss07: carga máxima mayorada un 40 %, a 30 cm del fondo del foso). Sin acopios encima.
  - **Montaje.** Plataforma y cabina montadas desde el punto más bajo, con las puertas superiores ya colocadas y bloqueadas (ss11). Perfil de cuelgue o gancho del forjado superior con su carga máxima pintada.
  - **Entorno.** Alumbrado en todo el hueco (ss07: 200 lux ⚠) y portátiles a 24 V. Cartel de prohibida la entrada a personas ajenas. El ascensor no se usa antes de su autorización (ss01). En un edificio existente, la zona se aísla del uso de los vecinos (ss04, ss07).
- **Protecciones colectivas:** barandillas o entablado en los accesos al hueco (ss14: barandilla empotrada de 1,00 m con rodapié); plataforma de trabajo con barandilla; protección del foso.
- **EPI:** arnés; casco; calzado; gafas; guantes; pantalla de soldar.
- **Fuentes:** ss01, ss04, ss07, ss11, ss14. *ss12, que es un EBSS de ascensores, no tiene esta ficha.*

#### F28 · Fase de obra · Enfoscados y revocos (vivienda)
- **Riesgos:** caída de personas a distinto nivel (andamios, balcones); caída de personas al mismo nivel; caída de objetos desprendidos; golpes o cortes por objetos o herramientas; contactos con sustancias cáusticas o corrosivas (dermatosis); proyección de fragmentos o partículas (salpicaduras de mortero); sobreesfuerzos; exposición a contactos eléctricos.
- **Medidas preventivas:** todos los huecos protegidos antes de empezar; superficies de tránsito limpias; andamios interiores sobre borriquetas, prohibidos escaleras, bidones o pilas de material; borriquetas en balcones solo con redes tensas o con pies derechos acuñados y barandilla de 90 cm como mínimo; cables a puntos fuertes de la cubierta para el arnés en el exterior; miras y reglas a hombro con el extremo delantero por encima del casco, o atadas a la carretilla; sacos en carretilla y repartidos lejos de los vanos; zona acordonada al proyectar garbancillo; no amasar sobre el andamio; trabajar por debajo de la altura del hombro; iluminación y portátiles a 24 V.
- **Protecciones colectivas:** barandillas o redes en balcones, bordes y huecos; andamio exterior con barandilla y rodapié; zona inferior acotada.
- **EPI:** casco; guantes de goma; gafas antisalpicaduras; calzado; arnés en el exterior sin protección colectiva.
- **Fuentes:** ss01, ss02, ss03, ss04, ss07, ss09, ss11, ss12.

#### F29 · Fase de obra · Guarnecidos y enlucidos de yeso (vivienda)
- **Riesgos:** caída de personas al mismo nivel (resbalón con la pasta); caída de personas a distinto nivel (borriquetas); proyección de fragmentos o partículas (salpicaduras de yeso a los ojos); golpes o cortes por objetos o herramientas; sobreesfuerzos; exposición a contactos eléctricos.
- **Medidas preventivas:** pasta limpiada del suelo; borriquetas en lugar de escaleras; no trabajar por encima de los hombros; acopio repartido; iluminación suficiente; coordinación con otros oficios.
- **Protecciones colectivas:** barandillas en los huecos; plataformas libres de obstáculos.
- **EPI:** gafas; guantes de goma; casco; mascarilla al lijar.
- **Fuentes:** ss01, ss02, ss11.

#### F30 · Fase de obra · Falsos techos (escayola, placa de yeso laminado, registrables) (vivienda)
- **Riesgos:** caída de personas a distinto nivel (borriquetas, escaleras); caída de personas al mismo nivel; golpes o cortes por objetos o herramientas (perfilería, guías); caída de objetos en manipulación (placas); proyección de fragmentos o partículas; sobreesfuerzos (trabajo por encima de la cabeza); exposición a contactos eléctricos.
- **Medidas preventivas:** plataformas sobre borriquetas en lugar de escaleras; placas manejadas entre dos; miras, tablones y puntales atados a la carretilla; pasos alternativos señalizados si los andamios cortan uno; junto a huecos y bordes, pies derechos acuñados con barandilla de 90 cm como mínimo, medida desde la plataforma (ss07); iluminación y portátiles a 24 V; acopio repartido.
- **Protecciones colectivas:** tapas o redes en los huecos; plataformas completas.
- **EPI:** casco; gafas; guantes; mascarilla; calzado.
- **Fuentes:** ss07, ss11, ss12.

#### F31 · Fase de obra · Alicatados y aplacados (vivienda)
- **Riesgos:** caída de personas a distinto nivel y al mismo nivel; caída de objetos por desplome o derrumbamiento (aplacados) y en manipulación; golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas (corte); exposición a contaminantes químicos (polvo de corte, sílice); exposición a ruido; contactos con sustancias cáusticas o corrosivas (adhesivos, cemento); sobreesfuerzos; exposición a contactos eléctricos.
- **Medidas preventivas:** piezas cortadas por vía húmeda o en un lugar abierto, con el cortador a sotavento; cargas izadas con dos cuerdas de retenida o en plataformas emplintadas, dentro de su embalaje; cajas repartidas, lejos de los vanos y fuera de los pasos; borriquetas en balcones solo con protección; plataformas de tres tablones trabados; escombro por la bajante, nunca por los huecos; cortadora lejos de encharcamientos; andamio exterior libre de material al izar o bajar cargas; en aplacados, pescantes de andamio colgado metálicos (ss01).
- **Protecciones colectivas:** barandillas o redes en huecos y bordes; plataforma de carga y descarga.
- **EPI:** guantes; gafas; mascarilla filtrante; calzado con puntera; rodilleras.
- **Fuentes:** ss01, ss02, ss04, ss07, ss09, ss11.

#### F32 · Fase de obra · Solados de piezas rígidas (gres, terrazo, piedra, baldosa hidráulica) (vivienda)
- **Riesgos:** caída de personas al mismo nivel (superficies recientes, lodos de pulido); caída de personas a distinto nivel (escaleras, huecos); golpes o cortes por objetos o herramientas (aristas, aplastamiento de dedos); sobreesfuerzos (trabajo de rodillas); contactos con sustancias cáusticas o corrosivas; proyección de fragmentos o partículas; exposición a contactos eléctricos (pulidoras); atrapamiento por o entre objetos (pulidoras); exposición a contaminantes químicos (polvo); exposición a ruido.
- **Medidas preventivas:** corte por vía húmeda; lo recién solado, acotado con cuerda de banderolas y con itinerarios alternativos señalados; cartel de pavimento resbaladizo; cajas repartidas junto a los tajos y lejos de los vanos; piezas izadas en plataformas emplintadas o jaulones flejados; pulidoras con doble aislamiento, manillar aislado y aro antiatrapamiento; lodos del pulido retirados; pisos inferiores acotados al solar escaleras, con cables de seguridad en el peldañeado; lámparas de iluminación adecuadas.
- **Protecciones colectivas:** barandillas en escaleras y huecos; tapas o redes en los huecos; zona acotada.
- **EPI:** rodilleras; guantes de goma y de cuero; gafas; mascarilla; protectores auditivos (pulidora); calzado.
- **Fuentes:** ss01, ss02, ss04, ss07, ss09, ss11, ss12.

#### F33 · Fase de obra · Pavimentos de madera y flexibles (tarima, parquet, vinílicos pegados)
- **Riesgos:** caída de personas al mismo nivel; exposición a contaminantes químicos (colas, disolventes, polvo de madera); incendios y explosiones (vapores; polvo de lijado); golpes o cortes por objetos o herramientas; pisadas sobre objetos; exposición a contactos eléctricos (lijadoras); sobreesfuerzos; exposición a ruido.
- **Medidas preventivas:** ventilación constante mientras se usan colas y disolventes; envases cerrados; almacén de colas aparte, ventilado y señalizado; lamas transportadas entre dos; lijado con ventilación para que no se formen atmósferas explosivas de polvo; lijadoras con doble aislamiento; cartel de superficie irregular.
- **Protecciones colectivas:** ventilación; extintor.
- **EPI:** mascarilla con filtro para vapores orgánicos y polvo; guantes; gafas; rodilleras; protectores auditivos (lijado).
- **Fuentes:** ss07.

#### F34 · Fase de obra · Soleras de hormigón (vivienda)
- **Riesgos:** caída de personas al mismo nivel; atrapamiento por o entre objetos y golpes (compactadores, regla vibrante); contactos con sustancias cáusticas o corrosivas; exposición a contactos eléctricos; sobreesfuerzos; exposición a vibraciones.
- **Medidas preventivas:** clavija macho-hembra obligatoria y portátiles a 24 V; en el exterior, parar si llueve; precaución con los compactadores; lo recién hormigonado, señalizado.
- **Protecciones colectivas:** balizamiento.
- **EPI:** botas de agua; guantes de goma; casco; ropa de trabajo.
- **Fuentes:** ss07.

#### F35 · Fase de obra · Pinturas, barnices e imprimaciones (vivienda)
- **Riesgos:** caída de personas a distinto nivel (andamios, borriquetas, escaleras); caída de personas al mismo nivel; exposición a contaminantes químicos (vapores orgánicos, disolventes, pigmentos, polvo de lijado); incendios y explosiones; contactos con sustancias cáusticas o corrosivas (salpicaduras, dermatosis); proyección de fragmentos o partículas; exposición a contactos eléctricos; atrapamiento por o entre objetos (compresores, pistolas); sobreesfuerzos.
- **Medidas preventivas:**
  - **Productos.** Almacén ventilado, con extintor y señales (IP8). Envases cerrados y lejos del calor. En el tajo, solo el producto de una jornada (ss01). Sustituir los productos peligrosos por otros que lo sean menos. Trapos en un recipiente metálico cerrado, para el gestor.
  - **Ambiente.** Ventilación natural o forzada. Lijado con ventilación localizada o bajo corriente de aire. Pigmentos vertidos desde poca altura. Prohibido fumar y comer donde se pinta con disolventes. Ni soldadura ni oxicorte cerca.
  - **Interferencias.** No conectar aparatos de elevación ni hacer pruebas de instalaciones mientras se pinta (ss09).
  - **Personas.** Evitar el contacto con la piel: crema barrera, y nunca limpiarse con disolvente.
  - **Equipos.** Compresores con las poleas protegidas. Pistolas *airless* según el fabricante. Estructuras pintadas desde guindola, con arnés. Iluminación sin sombras y portátiles a 24 V.
- **Protecciones colectivas:** plataformas o andamios con barandilla; zona inferior acotada; puntos de anclaje; ventilación; extintor.
- **EPI:** mascarilla con el filtro adecuado al producto; guantes de nitrilo frente a los disolventes; gafas o pantalla (techos); ropa que cubra todo el cuerpo; calzado; arnés en altura; protectores auditivos (compresor).
- **Fuentes:** ss01, ss02, ss03, ss04, ss06, ss07, ss09, ss10, ss11, ss12.

#### F36 · Fase de obra · Izado de cargas (vivienda)
- **Riesgos:** caída de objetos desprendidos y por desplome o derrumbamiento (cargas suspendidas); choques contra objetos móviles (la carga); atrapamiento por o entre objetos; caída de personas a distinto nivel (recepción en altura); atrapamiento por vuelco de máquinas o vehículos (medio de elevación).
- **Medidas preventivas:**
  - **Accesorios.** Eslingas, ganchos y accesorios revisados antes de cada izado; ganchos con pestillo.
  - **Zona.** Nadie bajo las cargas, con la zona acotada. Nunca cargas suspendidas sobre personas ni sobre la vía pública.
  - **Carga.** Material suelto en bateas con laterales de mallazo o chapa, sin rebosar. Piezas largas atadas. Cubos con compuerta, sin llenar hasta el borde. Prohibido tirar en oblicuo y arrastrar cargas.
  - **Maniobra.** Eslingado a dos puntos, con dos operarios que guían con cabos (nunca con las manos) y un tercero que ordena. El gruista ve la carga, o trabaja con señalista.
  - **Recepción en altura.** Con protección colectiva o con arnés.
- **Protecciones colectivas:** zona acotada; bateas y cubos adecuados; señalista.
- **EPI:** casco; guantes; calzado de seguridad; arnés en la recepción.
- **Fuentes:** ss07, ss09, ss11, ss15.

#### F37 · Fase de obra · Trabajos verticales (acceso y posicionamiento con cuerdas)
- **Riesgos:** caída de personas a distinto nivel; caída de objetos en manipulación; caída de objetos desprendidos (fallo de anclaje o de cuerda como causa).
- **Medidas preventivas:** evaluación de riesgos y procedimientos de la empresa (también descansos, revisiones y emergencias), vigilancia de la salud específica, formación (ss01 pide 80 h) y EPI certificados, no deportivos; nunca solo (dos como mínimo); dos cuerdas, de trabajo y de seguridad, con anclajes independientes y calculados, y una tercera para los materiales si hace falta; protectores contra el roce; todo ello incluido en el plan.
- **Protecciones colectivas:** vertical de trabajo acotada.
- **EPI:** arnés con dispositivo anticaídas; casco con barbuquejo; silla de trabajo; protectores de cuerda.
- **Anexo II:** apdo. 1.
- **Fuentes:** ss01, ss02. *Se quita el «aviso previo» que pedía ss01.*

#### F38 · Fase de obra · Trabajos con riesgo de caída de altura sin protección colectiva
- **Riesgos:** caída de personas a distinto nivel; caída de objetos en manipulación.
- **Medidas preventivas:** solo en las situaciones de la lista (montaje y desmontaje de protecciones, bordes de forjado, descarga en plataforma, remates de fachada y chimeneas…); ninguna protección colectiva se retira sin autorización del encargado, y se repone; las protecciones no se usan como amarre; puntos de anclaje fijos previstos (omegas en la estructura y, después, argollas); zonas de paso inferiores señalizadas; parar con viento fuerte, nieve, lluvia o tormenta.
- **Protecciones colectivas:** acotación inferior.
- **EPI:** arnés anticaídas; casco; calzado antideslizante; bolsa portaherramientas.
- **Fuentes:** ss01.

#### F39 · Fase de obra · Urbanización: firmes, pavimentos, señalización y jardinería
- **Riesgos:** atropellos o golpes con vehículos; contactos térmicos (aglomerado caliente); exposición a contaminantes químicos (humos de betún, emulsiones, polvo); exposición a temperaturas ambientales extremas; atrapamiento por vuelco de máquinas o vehículos; atrapamiento por o entre objetos (cortacésped); caída de personas al mismo nivel; golpes o cortes por objetos o herramientas; exposición a ruido; sobreesfuerzos.
- **Medidas preventivas:** señalización según la Norma 8.3-IC, con señalistas; junto a la extendedora, solo el personal necesario; nadie a menos de 6 m de compactadoras y rodillos en marcha (ss01; ss15 da 5 m); prohibido acceder a la regla vibrante durante el extendido; repostar con el motor parado y con embudo; hidratación y descansos con calor; protecciones de máquinas y herramientas revisadas a diario; no meter los pies bajo la cortacésped.
- **Protecciones colectivas:** bordes de la extendedora con bandas amarillas y negras; baliza y señal acústica de marcha atrás en todas las máquinas; señalización provisional del tráfico; plataformas de la extendedora con barandilla.
- **EPI:** calzado de protección contra el calor; guantes; ropa de alta visibilidad; protectores auditivos; mascarilla; gafas.
- **Fuentes:** ss01, ss08, ss15.

### 4.5 Medios auxiliares y protecciones colectivas

#### MA1 · Medio auxiliar · Andamio tubular o modular de fachada (vivienda)
- **Riesgos:** caída de personas a distinto nivel (montaje, plataforma incompleta, trepar); caída de objetos por desplome o derrumbamiento (vuelco del andamio por falta de arriostramiento, apoyo inestable o sobrecarga); caída de objetos desprendidos y en manipulación; caída de personas al mismo nivel; golpes en el montaje y el transporte; atrapamiento por o entre objetos; sobreesfuerzos.
- **Medidas preventivas:**
  - **Montaje.** Andamio con certificado del fabricante (los ejemplos citan las UNE-EN 12810 y 12811; normas no cotejadas). Montaje, desmontaje y modificaciones dirigidos por persona con formación, con plan de montaje, utilización y desmontaje y cálculo cuando lo exija el RD 1215/1997, anexo II, ap. 4.3.3 (más de 6 m, entre otros supuestos) [W]. Ningún nivel se empieza sin terminar el arriostramiento del anterior.
  - **Apoyos y anclajes.** Base sólida con durmientes o tablones de reparto y husillos, nunca bidones ni pilas de material. Anclajes a puntos resistentes de la fachada, nunca a barandillas, petos ni rejas. Cadencia según el fabricante ⚠: ss01 y ss07 dan reglas distintas. Cruces de San Andrés en las dos caras.
  - **Plataformas.** De 60 cm como mínimo, metálicas, antideslizantes, enclavadas y con la carga máxima marcada. A 30 cm de la fachada como máximo (ss07, ss11, ss14; ss01 da 20 cm ⚠); a esa distancia el lado de la fachada puede ir sin barandilla. Un módulo por encima de la última plataforma de trabajo.
  - **Uso.** Acceso por la escalera propia del andamio, prohibido trepar o saltar. Cargas repartidas, sin escombro ni mortero amasado encima.
  - **Inspección.** Antes de usarlo cada día, después de cualquier incidencia o de mal tiempo y periódicamente, por escrito (ss01: cada quince días). Suspender con viento fuerte. Paso de peatones protegido con marquesina. Zona señalizada durante el montaje.
- **Protecciones colectivas:** barandilla de 90 cm como mínimo, con pasamanos, protección intermedia y rodapié, en todos los lados exteriores [V]; red o lona de fachada; marquesina o visera en la base; vallado de la base.
- **EPI:** arnés anticaídas con absorbedor en el montaje y desmontaje; casco; calzado; guantes.
- **Anexo II:** apdo. 1.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss06, ss07, ss10, ss11, ss14.

#### MA2 · Medio auxiliar · Andamio de borriquetas o caballetes (vivienda)
- **Riesgos:** caída de personas a distinto nivel; caída de personas al mismo nivel; caída de objetos por desplome o derrumbamiento (basculamiento de la plataforma, vuelco); caída de objetos desprendidos; golpes o cortes por objetos o herramientas; sobreesfuerzos.
- **Medidas preventivas:**
  - **Apoyo.** Dos borriquetas como mínimo, niveladas y sobre suelo firme, nunca sobre otro andamio, bidones, cajas o pilas de material. Las de tijera, con cadenilla limitadora.
  - **Plataforma.** De 60 cm como mínimo (tres tablones trabados), fijada a las borriquetas. Tablones sin nudos y de 7 cm de canto como mínimo.
  - **Separación entre apoyos ⚠.** 2,5 m en ss01, ss03 y ss11; 3,5 m en ss06, ss07 y ss10; ss07 la liga además al canto del tablón. No se imprime hasta verificar.
  - **Altura.** Desde 2 m de altura, barandilla de 90 cm como mínimo, con protección intermedia y rodapié [V: caída de más de 2 m], y arriostramiento. Altura máxima ⚠: prohibidas por encima de 6 m (ss01, ss02, ss03, ss07); ss07 y ss11 las limitan a menos de 2 m en otros puntos.
  - **Uso.** Nunca en balcones ni bordes sin protección. Material justo y repartido.
- **Protecciones colectivas:** barandilla; protección de los huecos y bordes próximos.
- **EPI:** casco; calzado; arnés si hay riesgo de caída al vacío sin protección.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss06, ss07, ss09, ss10, ss11.

#### MA3 · Medio auxiliar · Torre de trabajo o andamio móvil sobre ruedas
- **Riesgos:** caída de personas a distinto nivel; caída de objetos por desplome o derrumbamiento (vuelco, desplazamiento involuntario); caída de objetos desprendidos; atrapamiento por o entre objetos (montaje).
- **Medidas preventivas:** plataformas de 60 cm como mínimo, sujetas; acceso por la escalera interior y trampillas; altura de la plataforma de 3 veces el lado menor de la base como máximo, salvo que se arriostre a puntos fijos (ss01) ⚠; diagonales en la base; frenos puestos antes de subir; nunca se mueve con personas ni material encima; apoyo firme, liso y horizontal, nunca sobre tierra ni pavimento fresco; sin borriquetas encima ni pastas sobre la plataforma; plan de montaje según su complejidad [W].
- **Protecciones colectivas:** barandilla perimetral de 90 cm como mínimo, con protección intermedia y rodapié; diagonales de rigidez.
- **EPI:** casco; calzado antideslizante; arnés si hay riesgo de caída; guantes en el montaje.
- **Fuentes:** ss01, ss02, ss03, ss04, ss11.

#### MA4 · Medio auxiliar · Andamio colgado y guindola de soldador
- **Riesgos:** caída de personas a distinto nivel; caída de objetos desprendidos; caída de objetos por desplome o derrumbamiento (rotura de cables o pescantes); choques contra objetos inmóviles (balanceo contra la fachada).
- **Medidas preventivas:** prueba de carga previa; pescantes metálicos separados menos de 3 m; andamiadas siempre horizontales y de menos de 8 m, sujetas al cerramiento con anclajes; ganchos con pestillo; cables defectuosos desechados; cabrestantes revisados periódicamente; nadie pasa ni acopia debajo. Guindola de soldador de taller, de 50 × 50 × 100 cm como mínimo, con doble cuelgue y barandilla de 1 m.
- **Protecciones colectivas:** barandilla con protección intermedia y rodapié; zona inferior acotada.
- **EPI:** arnés anclado a un punto o línea **independiente** del andamio; casco; calzado.
- **Fuentes:** ss01, ss02, ss03, ss04, ss06, ss07, ss09, ss11. *Se quitan las prescripciones obsoletas de ss11 (tirillas de esparto, rollizos, «tablones del norte»).*

#### MA5 · Medio auxiliar · Escalera de mano, simple o de tijera (vivienda)
- **Riesgos:** caída de personas a distinto nivel (deslizamiento de la base, rotura de un peldaño, mala colocación); caída de personas al mismo nivel; caída de objetos en manipulación; golpes o cortes por objetos o herramientas; atrapamiento por o entre objetos (tijera); sobreesfuerzos; exposición a contactos eléctricos (escaleras metálicas cerca de líneas).
- **Medidas preventivas:**
  - **Colocación.** Zapatas antideslizantes y sujeción arriba (ganchos o amarre). Sobrepasa al menos 1 m el punto de llegada [W] (ss05 decía 90 cm: se corrige). Inclinación de unos 75°: la base, separada ¼ de la longitud. Lejos de zonas de paso, bordes y huecos.
  - **Escalera.** Largueros de una pieza con los peldaños ensamblados, a 30 cm como máximo entre sí (ss08). La de tijera, con cadena o cable limitador y el tensor extendido.
  - **Uso.** Subir y bajar de frente y de uno en uno. No llevar cargas de 25 kg o más ni hacer trabajos que necesiten las dos manos. No subir más allá del tercer peldaño contando desde arriba. No usarla como borriqueta ni como pasarela. Herramientas en bolsa. Material aislante cerca de instalaciones eléctricas.
  - **Límites del RD 1215/1997.** Con esfuerzos a más de 3,5 m, solo con sistema anticaídas [W]. Más de 5 m, solo con las garantías del RD [W].
- **Protecciones colectivas:** —
- **EPI:** calzado antideslizante; casco; portaherramientas.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss06, ss07, ss08, ss09, ss10, ss11.

#### MA6 · Medio auxiliar · Puntales y apeos (vivienda)
- **Riesgos:** caída de objetos por desplome o derrumbamiento (rotura por sobrecarga o mal estado; deslizamiento del apoyo; desplome del encofrado o del elemento apeado); golpes o cortes por objetos o herramientas; atrapamiento por o entre objetos; sobreesfuerzos.
- **Medidas preventivas:** en demolición, refuerzo o apertura de huecos, apeos y apuntalamientos según el cálculo de la DF y revisados a diario (ss02, ss03); puntales clavados al durmiente y a la sopanda, aplomados y arriostrados en horizontal si la altura es grande; nunca se mueve un puntal cargado; los defectuosos se rechazan; apoyos sobre tablones de reparto; transporte atado a la carretilla.
- **Protecciones colectivas:** zona de influencia señalizada.
- **EPI:** casco; guantes; calzado.
- **Fuentes:** ss01, ss02, ss03, ss04, ss07, ss11, ss12.

#### MA7 · Medio auxiliar · Barandillas provisionales y protección de huecos: tableros, mallazo, tapas (vivienda)
- **Riesgos que evita:** caída de personas a distinto nivel; caída de objetos desprendidos. **En el montaje:** caída de personas a distinto nivel; golpes o cortes por objetos o herramientas; sobreesfuerzos.
- **Medidas preventivas:**
  - **Regla.** En todo borde o hueco con más de 2 m de caída, barandilla de 90 cm como mínimo, con pasamanos, protección intermedia y rodapié («reborde de protección») [V; RD 1627, anexo IV C.3].
  - **Cifras sin verificar ⚠.** Resistencia de 150 kg/m (ss01, ss11). Rodapié de 15 o 20 cm según el ejemplo.
  - **Pies derechos.** Por hinca, en casquillos embebidos en el hormigón con tapa antillenado, separados 2 m como máximo (ss14; ss01 da 2,30 m ⚠). Se montan con el arnés amarrado a la cuerda de circulación (ss14).
  - **Huecos.** Barandillas en el hueco del ascensor. Huecos horizontales con tableros cuajados y clavados, o con mallazo embebido. Se ocluyen todos, aunque no estén en los planos (ss14).
  - **Uso.** La protección retirada se repone de inmediato. Nunca se usan como amarre. Las cuerdas con banderolas solo delimitan; no protegen (ss01). Se sustituyen cuanto antes por los pretiles definitivos (ss14).
- **Protecciones colectivas:** la propia.
- **EPI:** arnés en el montaje; guantes; casco.
- **Fuentes:** ss01, ss02, ss04, ss06, ss07, ss10, ss11, ss14.

#### MA8 · Medio auxiliar · Redes de seguridad (horca, horizontales, bajo forjado)
- **Riesgos que evita:** caída de personas a distinto nivel; caída de objetos desprendidos. **En el montaje:** caída de personas a distinto nivel; golpes; pisadas sobre objetos.
- **Medidas preventivas:** malla de poliamida de 100 mm de lado como máximo y cuerda perimetral de 10 mm como mínimo (los ejemplos citan la UNE-EN 1263, no cotejada); montaje según el fabricante, dirigido por persona formada; pescantes cada 4,50 m (nunca más de 5 m), con omegas o anclajes embebidos y replanteados en la ferralla; ganchos inferiores cada medio metro aproximadamente; caída sobre la red de 6 m como máximo (ss09, ss11); redes verticales que cubran dos plantas; red horizontal en patios cada dos plantas; sistemas bajo forjado; roturas revisadas y objetos caídos retirados; almacenadas a cubierto y protegidas de la luz, con la vida útil que dé el fabricante; al retirarlas, barandillas en su lugar; desmontaje por paños.
- **Protecciones colectivas:** la propia; línea de vida para montarla.
- **EPI:** arnés en el montaje; guantes; casco.
- **Fuentes:** ss01, ss02, ss04, ss06, ss07, ss09, ss11, ss14.

#### MA9 · Medio auxiliar · Línea de vida provisional y cable fiador
- **Riesgos:** caída de personas a distinto nivel; golpes o cortes por objetos o herramientas.
- **Medidas preventivas:** montada por personal cualificado; cuerda o cable atado a puntos fijos de la estructura; cuerda del arnés de 1 m como máximo; se monta con las redes ya puestas; se desmonta desde una plataforma elevadora, sin tirar los soportes al suelo.
- **Protecciones colectivas:** cuerda salvavidas; cable fiador.
- **EPI:** arnés; casco; calzado.
- **Fuentes:** ss01, ss04.

#### MA10 · Medio auxiliar · Bajante de escombros y contenedor (vivienda)
- **Riesgos que evita:** caída de objetos desprendidos (sobre terceros y trabajadores); exposición a contaminantes químicos (polvo). **Propios:** caída de personas a distinto nivel (bocas de vertido); caída de objetos por desplome o derrumbamiento (bajante mal anclada); golpes o cortes por objetos o herramientas.
- **Medidas preventivas:** tramos troncocónicos anclados a cada forjado, montados según el fabricante; boca de vertido de cada planta protegida por la barandilla, con un tope para la rueda de la carretilla; último tramo inclinado; boca a poca altura sobre el contenedor ⚠ (1 m como máximo en ss01, 2 m en ss11 y ss14); lona o malla sobre el contenedor; sección de 50 × 50 cm como máximo (ss11); escombro humedecido; zona inferior acotada; vertido libre solo desde poca altura y sobre un espacio acotado (ss11: desde 2 plantas como máximo, sobre 6 × 6 m); nunca por los huecos.
- **Protecciones colectivas:** contenedor cubierto y acotado.
- **EPI:** casco; mascarilla; gafas; guantes.
- **Fuentes:** ss01, ss02, ss04, ss06, ss11, ss14.

#### MA11 · Medio auxiliar · Visera o marquesina de protección
- **Riesgos que evita:** caída de objetos desprendidos (sobre personas). **Propios:** caída de objetos por desplome o derrumbamiento (puntales desaplomados, tablones sueltos).
- **Medidas preventivas:** techo de tablones sobre los accesos al edificio, que se prolonga fuera del borde del forjado (ss11: 2,5 m); apoyos en suelo y forjado sobre durmientes de madera; puntales verticales y aplomados; tablones fijados para que no se muevan, basculen ni deslicen; si hay andamio, no se apoya en la marquesina ni la sobrecarga; visera perimetral en el techo de la planta baja (ss11: capaz de 600 kg/m² ⚠).
- **Protecciones colectivas:** la propia; señalización.
- **EPI:** casco; calzado de seguridad.
- **Fuentes:** ss01, ss02, ss04, ss06, ss11.

#### MA12 · Medio auxiliar · Plataforma de carga y descarga en planta
- **Riesgos:** caída de personas a distinto nivel; caída de objetos en manipulación (sin rodapié); caída de objetos por desplome o derrumbamiento (la plataforma).
- **Medidas preventivas:** certificado del fabricante con la carga de uso y las instrucciones de montaje y apeo; puntales aplomados (ss11: tres por lado) con tablón de reparto; barandillas y rodapié laterales; trampilla abatible con enclavamiento que haga de barandilla; cargas colocadas sin que nadie tenga que entrar en la plataforma; nunca en la misma vertical en dos plantas, ni sobre una zona de paso; revisada antes de usarla; carga máxima señalizada en cada planta.
- **Protecciones colectivas:** barandillas y rodapiés; puntos fijos para el arnés.
- **EPI:** casco; guantes; calzado; arnés.
- **Fuentes:** ss01, ss02, ss04, ss06, ss11.

#### MA13 · Medio auxiliar · Pasarelas, rampas y torretas de hormigonado
- **Riesgos:** caída de personas a distinto nivel; caída de personas al mismo nivel; caída de objetos por desplome o derrumbamiento (vuelco de la torreta).
- **Medidas preventivas:** 60 cm de ancho como mínimo; tablones de madera sana trabados con travesaños, para que no basculen, y anclados contra el deslizamiento; libres de obstáculos y no resbaladizas; fuera de la zona de caída de objetos, o protegidas con marquesina; torreta con base estable y nivelada, acceso por su escalerilla, y nunca se mueve con alguien encima.
- **Protecciones colectivas:** a más de 2 m de altura, barandilla de 90 cm como mínimo a los dos lados, con protección intermedia y rodapié [V].
- **EPI:** casco; calzado antideslizante.
- **Fuentes:** ss01, ss02, ss04, ss11.

#### MA14 · Medio auxiliar · Plataforma elevadora móvil de personas (tijera, articulada, sobre mástil)
- **Riesgos:** caída de personas a distinto nivel; atrapamiento por vuelco de máquinas o vehículos; atrapamiento por o entre objetos (entre las tijeras); choques contra objetos móviles e inmóviles; atropellos o golpes con vehículos; exposición a contactos eléctricos (líneas aéreas); caída de objetos por desplome o derrumbamiento.
- **Medidas preventivas:**
  - **Equipo y operador.** Marcado CE, declaración de conformidad y manual. Operador formado y autorizado. Revisiones periódicas por personal cualificado.
  - **Antes de usarla.** Suelo capaz de soportarla, sin agujeros ni grasas. Entorno revisado (líneas, vigas). Estabilizadores puestos.
  - **Uso.** Sin pasar de la carga ni del número de personas. Inclinómetro y dispositivos de seguridad sin anular. Prohibido ganar altura con escaleras o andamios sobre la cesta, sentarse en la barandilla, subir o bajar en marcha, usarla como ascensor o anclarla a la estructura. En recintos cerrados, nunca diésel. Parar con tormenta o con viento por encima del límite del fabricante.
  - **Líneas eléctricas.** Protocolo para un contacto con una línea.
  - **Al acabar.** Inmovilizada, con los mandos a cero y la corriente cortada. Las de mástil se montan según el fabricante.
- **Protecciones colectivas:** barandilla de la cesta; descenso de emergencia; zona acotada abajo.
- **EPI:** arnés anclado a la cesta en las articuladas o telescópicas; calzado antideslizante; casco.
- **Fuentes:** ss01, ss02, ss05, ss07.

#### MA15 · Medio auxiliar · Eslingas, ganchos, bateas y garras
- **Riesgos:** caída de objetos en manipulación y desprendidos (rotura de eslinga o gancho); choques contra objetos móviles (la carga); atrapamiento por o entre objetos.
- **Medidas preventivas:** eslingas de acero o textiles con la carga máxima marcada; ganchos con pestillo; braga de dos brazos con grilletes; bateas emplintadas, con el material ordenado y flejado; cables defectuosos desechados; revisión periódica; prohibido arrastrar cargas o tirar en oblicuo.
- **Protecciones colectivas:** zona de izado acotada.
- **EPI:** guantes; casco.
- **Fuentes:** ss02, ss11.

#### MA16 · Medio auxiliar · Silo de cemento
- **Riesgos:** atrapamiento por vuelco de máquinas o vehículos (carga, descarga y servicio); exposición a contaminantes químicos (polvo); caída de personas a distinto nivel (mantenimiento); atrapamiento por o entre objetos.
- **Medidas preventivas:** suspendido de tres puntos para descargarlo con grúa; anclado, firme y estable; sin nubes de polvo en el trasiego; mantenimiento interior con el operario anclado a la boca y otro vigilando.
- **Protecciones colectivas:** filtros de manga.
- **EPI:** gafas antipolvo; mascarilla; arnés en el mantenimiento.
- **Fuentes:** ss02, ss04.

### 4.6 Maquinaria

#### M1 · Maquinaria · Retroexcavadora, miniexcavadora y pala cargadora (vivienda)
- **Riesgos:** atropellos o golpes con vehículos; atrapamiento por vuelco de máquinas o vehículos (pendientes, bordes, barro); caída de personas a distinto nivel (al subir o bajar de la máquina); atrapamiento por o entre objetos; choques contra objetos móviles e inmóviles; exposición a contactos eléctricos (líneas aéreas o enterradas); caída de objetos desprendidos (desde la cuchara); incendios; contactos térmicos (mantenimiento); proyección de fragmentos o partículas; exposición a ruido, a vibraciones y a contaminantes químicos (polvo).
- **Medidas preventivas:**
  - **Personal y máquina.** Maquinista autorizado y cualificado, con las normas por escrito. Cabina antivuelco y antiimpactos (ROPS/FOPS) y cinturón. Extintor, luces y bocina de retroceso. Mandos revisados al empezar cada turno.
  - **Trabajo.** Radio de acción del brazo acotado; nadie dentro, ni en zanjas a su alcance. Desplazamientos con la cuchara baja y plegada. Desniveles salvados de frente. Marchas cortas en pendiente. Prohibido llevar o elevar personas en la cuchara, y usarla como grúa salvo con argolla y gancho con pestillo. No socavar la base. No golpear rocas con la cuchara. Velocidad de 20 km/h como máximo en la obra. Maniobras con señalista.
  - **Bordes.** Topes en los bordes de talud. Estacionar a 2 m como mínimo del borde.
  - **Líneas eléctricas.** Distancia de seguridad (§4.9). Si la máquina toca una línea, el maquinista se queda en la cabina y nadie la toca; solo si es imprescindible, salta sin tocar a la vez máquina y suelo.
  - **Al bajar.** Cuchara apoyada en el suelo, freno, llave quitada y batería desconectada. Subir y bajar de frente por peldaños y asideros. No reparar con el motor en marcha.
- **Protecciones colectivas:** zona acotada y señalizada; topes; caminos interiores señalizados.
- **EPI:** casco al bajar de la cabina; cinturón antivibratorio; calzado antideslizante; guantes; protectores auditivos; mascarilla en terreno pulverulento; ropa de alta visibilidad.
- **Fuentes:** ss01, ss02, ss04, ss07, ss08, ss09, ss11, ss12, ss15.

#### M2 · Maquinaria · Camión de transporte, basculante y contenedor (vivienda)
- **Riesgos:** atropellos o golpes con vehículos; atrapamiento por vuelco de máquinas o vehículos (blandones, bordes, carga desplazada); caída de personas a distinto nivel (caja, cabina); atrapamiento por o entre objetos; caída de objetos desprendidos (la carga); exposición a contactos eléctricos (basculante bajo líneas); sobreesfuerzos.
- **Medidas preventivas:** freno de mano y calzos antes de cargar o descargar; maniobras dirigidas por señalista; subir a la caja por la escalerilla, nunca trepando; cargas suspendidas guiadas con cabos de gobierno; carga repartida y cubierta con lona; sin circular con la caja levantada ni accionar el basculante hasta que el vehículo esté parado; nadie cerca en las maniobras; frenos, dirección, luces y neumáticos revisados; prohibido llevar personas; topes en los bordes de vaciado.
- **Protecciones colectivas:** señalista; calzos; topes; recorridos señalizados.
- **EPI:** casco al bajar; calzado antideslizante; ropa de alta visibilidad; guantes.
- **Fuentes:** ss01, ss02, ss04, ss07, ss08, ss11, ss15.

#### M3 · Maquinaria · Dúmper o motovolquete (vivienda)
- **Riesgos:** atrapamiento por vuelco de máquinas o vehículos; atropellos o golpes con vehículos; caída de personas a distinto nivel (desde la máquina); caída de personas al mismo nivel; choques contra objetos inmóviles; exposición a contaminantes químicos (polvo), a ruido y a vibraciones.
- **Medidas preventivas:** conductor con el permiso de conducción que corresponda y autorizado (ss15 cita la clase «B2», que ya no existe); sin pasajeros; la carga no tapa la visión ni desequilibra; rampas bajadas en carga marcha atrás y despacio; sin circular por pendientes de más del 20 % en terreno húmedo ni del 30 % en seco (ss15) ⚠, ni por taludes; tope de vertido junto a zanjas y taludes; estacionado con el motor parado, el freno puesto y calzos en pendiente; frenos revisados después de pasar por barro; arranque sentado y con el cinturón puesto (ss01).
- **Protecciones colectivas:** pórtico antivuelco; cinturón; bocina y avisador de marcha atrás; luces; topes de vertido.
- **EPI:** casco; calzado; ropa de alta visibilidad; faja antivibraciones.
- **Fuentes:** ss01, ss04, ss11, ss15. *No se reutiliza el texto del dúmper de ss01, que es un manual de fabricante.*

#### M4 · Maquinaria · Camión hormigonera (vivienda)
- **Riesgos:** atropellos o golpes con vehículos; atrapamiento por vuelco de máquinas o vehículos (rampas, bordes); caída de personas a distinto nivel (al subir a la tolva); choques contra objetos móviles (canaleta); atrapamiento por o entre objetos (al desplegar la canaleta); contactos con sustancias cáusticas o corrosivas (hormigón); sobreesfuerzos.
- **Medidas preventivas:** rampas de acceso del 20 % como máximo; colocación y maniobras dirigidas por señalista; ruedas a distancia del borde de la excavación ⚠ (§4.9) y topes de final de recorrido; parado en rampa, frenado y calzado; cuba y canaletas limpiadas en un lugar definido; normas de seguridad entregadas al conductor.
- **Protecciones colectivas:** topes; señalista.
- **EPI:** casco al bajar; guantes de goma; botas de agua; gafas.
- **Fuentes:** ss01, ss04, ss09, ss15.

#### M5 · Maquinaria · Bomba de hormigón autopropulsada
- **Riesgos:** atrapamiento por vuelco de máquinas o vehículos; proyección de fragmentos o partículas (reventón de tubería, pelota de limpieza); choques contra objetos móviles (manguera, tubo oscilante); atrapamiento por o entre objetos (tolva); exposición a contactos eléctricos (pluma cerca de líneas); caída de personas a distinto nivel; sobreesfuerzos; atropellos o golpes con vehículos.
- **Medidas preventivas:** personal especialista; emplazamiento horizontal, con los estabilizadores a 3 m como mínimo del borde de taludes o zanjas (ss01, ss07); ruedas calzadas y gatos con enclavamiento; zona de bombeo aislada de los peatones; parrilla en la tolva; nunca meter las manos en la tolva ni en el tubo oscilante con la máquina en marcha, y purgar la presión antes de tocarlos; no trabajar con averías; espesor de la tubería medido sin presión; por encima de 50 bar, prueba de presión un 30 % por encima de la de servicio y cambio de acoplamientos cada unos 1.000 m³ (ss01, ss07, ss11); pelota de limpieza solo con su redecilla; normas entregadas al operador.
- **Protecciones colectivas:** zona acotada; resguardos; topes.
- **EPI:** casco; gafas antisalpicaduras; guantes de goma; botas de agua; protectores auditivos; ropa de alta visibilidad.
- **Fuentes:** ss01, ss02, ss07, ss11.

#### M6 · Maquinaria · Camión grúa (vivienda)
- **Riesgos:** atrapamiento por vuelco de máquinas o vehículos; caída de objetos desprendidos y por desplome o derrumbamiento (la carga); choques contra objetos móviles (la carga contra paramentos); atrapamiento por o entre objetos; atropellos o golpes con vehículos; exposición a contactos eléctricos (líneas aéreas); caída de personas a distinto nivel (al subir o bajar de los mandos).
- **Medidas preventivas:**
  - **Equipo y conductor.** Marcado CE o adaptación al RD 1215/1997. Conductor autorizado, con certificado de capacitación y permiso de conducir si sale a la vía. Avisador de marcha atrás y extintor.
  - **Emplazamiento.** Terreno compacto. Calzos en las cuatro ruedas y estabilizadores extendidos del todo antes de izar, con tablones o chapas de reparto en terreno blando. A 2 m como mínimo de cortes del terreno y bordes. Brazo recogido en los desplazamientos.
  - **Izado.** Gancho con pestillo. Sin pasar de la carga de la tabla según el alcance. Prohibido llevar personas, arrastrar cargas o tirar en oblicuo. Una maniobra cada vez, con elevación lenta y la carga guiada con cabos. Nadie a menos de 5 m del camión ni bajo la carga (ss01, ss15). El gruista ve la carga, o trabaja con señalista. Sin izar de lado con el terreno inclinado hacia la carga. Parar con viento por encima del límite del fabricante.
  - **Líneas eléctricas.** Pluma a distancia de seguridad (§4.9). Si toca una, el conductor se queda en la cabina.
  - **Normas.** Hoja de normas de la obra entregada al conductor en el acceso (ss01).
- **Protecciones colectivas:** radio de acción sin trabajadores; zona acotada.
- **EPI:** casco al bajar de la cabina; guantes; calzado de seguridad.
- **Fuentes:** ss01, ss02, ss04, ss05, ss15.

#### M7 · Maquinaria · Grúa torre
- **Riesgos:** caída de objetos desprendidos (la carga); choques contra objetos móviles (la carga); caída de objetos por desplome o derrumbamiento (vuelco o caída de la grúa por viento o cimentación); caída de personas a distinto nivel (gruista, montaje); atrapamiento por o entre objetos; exposición a contactos eléctricos (líneas aéreas, tormenta).
- **Medidas preventivas:**
  - **Elección y montaje.** Elegida en el plan por alcance y carga en punta, con un cartel que la indique. Limitadores de carga y de recorrido del carro. Gancho con pestillo. Montaje según el fabricante, con certificado del instalador (RD 836/2003; no leído).
  - **Mástil y pluma.** Escalera con aros y cable fiador para el arnés.
  - **Manejo.** Gruista con las normas por escrito y recibí, desde la botonera y con señalista. La carga nunca pasa sobre los operarios ni queda suspendida.
  - **Clima.** Parar con viento de 60 km/h o más, o con tormenta, y dejar la grúa en veleta.
  - **Al acabar la jornada.** Gancho arriba y junto al mástil, pluma en veleta, mandos a cero y corriente cortada.
  - **Cables y alimentación.** Cables con un 10 % de hilos rotos, sustituidos (ss14). Alimentación enterrada a 40 cm como mínimo, señalizada, y tierra independiente.
  - **Entorno.** Distancia a líneas eléctricas según el RD 614/2001 (§4.9). Radio dibujado en el plano de ordenación (ss14). Dispositivo anticolisión si hay varias grúas.
- **Protecciones colectivas:** zona de seguridad delimitada; huecos de planta protegidos contra la caída de materiales; cable de alimentación en manguera antihumedad con tierra.
- **EPI:** arnés del gruista y de los montadores; casco; calzado de seguridad; guantes.
- **Fuentes:** ss02, ss04, ss07, ss11, ss14. *Se quitan las ITC de 1988 (ss11, ss14) y las distancias a líneas de ss11.*

#### M8 · Maquinaria · Montacargas, elevador de materiales, ascensor de obra y maquinillo
- **Riesgos:** caída de objetos desprendidos (la carga); caída de personas a distinto nivel (en la planta de recepción); atrapamiento por o entre objetos; exposición a contactos eléctricos; choques contra objetos móviles (la carga); caída de objetos por desplome o derrumbamiento (la plataforma).
- **Medidas preventivas:**
  - **Revisión.** Diaria: cables, frenos, dispositivos eléctricos, puertas y disparo del diferencial, en una ficha a disposición del coordinador (ss07). Mantenimiento con la máquina parada.
  - **Recepción en planta.** Puerta en cada planta con enclavamiento que pare el aparato al abrirse. Pasarelas de desembarco con barandilla de 90 cm como mínimo. Visera sobre el acceso.
  - **Mandos y carga.** Botonera a 3 m como mínimo del hueco (ss07). Carga repartida y que no sobresalga. Prohibido subir personas en el montacargas de materiales. Área de seguridad acotada al pie (ss14: 0,80 m). Cartel con la carga máxima y limitador de recorrido.
  - **Maquinillo.** Anclado a puntos sólidos del forjado con abrazaderas metálicas, nunca con contrapeso. Prohibido arrastrar o tirar en oblicuo. Quien lo maneja junto al borde va sujeto a un punto fijo (ss08).
- **Protecciones colectivas:** barandillas y puertas en cada planta; motor y transmisiones con carcasa; cable con tierra.
- **EPI:** casco; guantes; calzado; arnés en el montaje, el desmontaje y el desembarco.
- **Fuentes:** ss01, ss02, ss04, ss06, ss07, ss08, ss14. *La puesta en servicio, según su reglamento (no leído).*

#### M9 · Maquinaria · Carretilla elevadora y manipulador telescópico
- **Riesgos:** atrapamiento por vuelco de máquinas o vehículos (pendiente, carga elevada); caída de objetos desprendidos (la carga, sobre personas o sobre el conductor); atropellos o golpes con vehículos; caída de personas a distinto nivel (llevar personas); choques contra objetos inmóviles; exposición a sustancias nocivas o tóxicas (motor térmico en recinto mal ventilado).
- **Medidas preventivas:** suelo con resistencia comprobada; protección FOPS; solo personal formado y autorizado, con la llave en manos del responsable; circuitos hidráulicos revisados a diario; circular con la carga baja; resaltes en diagonal y despacio; carga en palés, sujeta y dentro de la tabla de cargas; sin pasar de la pendiente del fabricante; prohibido llevar personas; motor térmico prohibido en recintos cerrados mal ventilados; topes al final de los recorridos.
- **Protecciones colectivas:** recorridos señalizados; ventilación.
- **EPI:** calzado de seguridad; casco; cinturón del asiento.
- **Fuentes:** ss01, ss05.

#### M10 · Maquinaria · Hormigonera y amasadora (vivienda)
- **Riesgos:** atrapamiento por o entre objetos (tambor, corona, transmisiones); exposición a contactos eléctricos; contactos con sustancias cáusticas o corrosivas (dermatosis); exposición a contaminantes químicos (polvo de cemento); sobreesfuerzos; golpes y caídas con las carretillas; atrapamiento por vuelco de máquinas o vehículos (al moverla); exposición a ruido.
- **Medidas preventivas:** preferir el hormigón de central y dejar la hormigonera para pequeñas cantidades; superficie llana y firme, fuera de los pasos y de la zona que barren las cargas; a 3 m como mínimo del borde de excavaciones; motor, corona y transmisiones con carcasa; freno de basculamiento del bombo; alimentación aérea desde un cuadro con diferencial y tierra, y botonera estanca; reparaciones por personal cualificado y sin tensión; nunca meter el brazo en el tambor en marcha; manejo solo por personal autorizado; para moverla con grúa, balancín de cuatro puntos; limpieza al acabar la jornada; paso de carretillas limpio.
- **Protecciones colectivas:** carcasas; toma de tierra; diferencial; zona delimitada.
- **EPI:** guantes y botas de goma; mascarilla; protectores auditivos; gafas; casco.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss07, ss08, ss11, ss15.

#### M11 · Maquinaria · Sierra circular de mesa (vivienda)
- **Riesgos:** golpes o cortes por objetos o herramientas (contacto con el disco); proyección de fragmentos o partículas (retroceso de la pieza, rotura del disco); atrapamiento por o entre objetos (correas); exposición a contaminantes químicos (polvo); exposición a contactos eléctricos; incendios (serrín); exposición a ruido.
- **Medidas preventivas:** a 3 m como mínimo de los bordes de forjado, salvo que estén protegidos; fuera de lugares encharcados; carcasa del disco, cuchillo divisor, empujador y carcasa de poleas siempre puestos; interruptor estanco y toma de tierra comprobada; clavos quitados y nudos revisados antes de cortar; discos fisurados sustituidos; disco adecuado al material y a las revoluciones, sin presionarlo; zona limpia de serrín; solo la usa el trabajador autorizado, con las normas por escrito; corte cerámico por vía húmeda; tablones largos entre dos; no dejarla colgada de la grúa; con lluvia, cubierta y parada.
- **Protecciones colectivas:** resguardos de la máquina; diferencial; zona acotada.
- **EPI:** gafas antiproyecciones; protectores auditivos; mascarilla; guantes para manipular la madera, nunca junto al disco; calzado de seguridad.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss07, ss08, ss10, ss11.

#### M12 · Maquinaria · Radial, cortadora de material cerámico y rozadora (vivienda)
- **Riesgos:** golpes o cortes por objetos o herramientas (contacto con el disco); proyección de fragmentos o partículas (rotura del disco); exposición a contaminantes químicos (polvo, sílice); exposición a contactos eléctricos; exposición a ruido; exposición a vibraciones; sobreesfuerzos (posturas forzadas); contactos térmicos.
- **Medidas preventivas:** carcasa del disco siempre puesta y la máquina rechazada si le falta una pieza; disco adecuado y en buen estado, cambiado con la máquina desconectada; pieza amarrada con mordazas, nunca pisada en el suelo; empuñadura lateral; no usarla por encima de los hombros; postura estable; disco parado antes de dejarla y nunca en el suelo; sin trabajar en zonas encharcadas; corte húmedo o con aspiración; rozadora solo en fábrica; sin golpear con el disco; reparaciones por especialista.
- **Protecciones colectivas:** zona ventilada; diferencial; mesa de trabajo.
- **EPI:** gafas o pantalla facial; mascarilla con filtro mecánico (FFP2 o superior frente a la sílice, ss11); protectores auditivos; guantes de cuero; calzado.
- **Fuentes:** ss01, ss02, ss04, ss05, ss07, ss08, ss09, ss11, ss15.

#### M13 · Maquinaria · Herramientas eléctricas portátiles: taladro, atornillador, lijadora, clavadora (vivienda)
- **Riesgos:** exposición a contactos eléctricos; golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas; contactos térmicos (broca caliente); exposición a ruido y a vibraciones; exposición a contaminantes químicos (polvo); atrapamiento por o entre objetos (accesorio que gira, ropa holgada); sobreesfuerzos.
- **Medidas preventivas:** marcado CE o adaptación al RD 1215/1997; doble aislamiento (clase II) o toma de tierra con diferencial, o batería; mangueras antihumedad revisadas antes de usarlas; clavijas normalizadas y enchufes estancos; nunca sin clavija ni desconectada de un tirón; alargadera desde la herramienta hacia el enchufe; accesorios adecuados, cambiados con la máquina desconectada; gafas, protectores auditivos y mascarilla durante todo el taladrado; pulsador de hombre muerto; posición estable; desconectada y con el seguro puesto al dejarla; las que hacen polvo, en zonas ventiladas o con aspiración; reparaciones por personal autorizado; guardadas al acabar; cables fuera de los pasos.
- **Protecciones colectivas:** diferencial de 30 mA; zonas limpias.
- **EPI:** gafas; protectores auditivos; mascarilla; guantes; casco.
- **Fuentes:** ss01, ss02, ss03, ss04, ss05, ss07, ss08, ss11.

#### M14 · Maquinaria · Martillo rompedor y picador eléctrico (vivienda)
- **Riesgos:** exposición a vibraciones; exposición a ruido; proyección de fragmentos o partículas (también de la herramienta de ataque); exposición a contaminantes químicos (polvo); exposición a contactos eléctricos; golpes o cortes por objetos o herramientas; caída de objetos desprendidos (por la vibración); sobreesfuerzos.
- **Medidas preventivas:** antes de picar, inspección del elemento por los desprendimientos que pueda provocar la vibración; manguera de 1.000 V y clavija estanca; doble aislamiento, o tierra y diferencial de 30 mA; interruptor estanco; nunca en el suelo en marcha; rechazados los aparatos con cables pelados o empalmes con cinta; solo personal autorizado, con las normas por escrito; relevos (ss07: dos cuadrillas que se turnan cada hora); agarrado a la altura de la cintura o del pecho, y si no, desde un andamio; sin hacer palanca; perforación con agua cuando se pueda.
- **Protecciones colectivas:** zona acotada; riego contra el polvo; pantallas entre puestos; señales de protección auditiva y de mascarilla obligatorias.
- **EPI:** protectores auditivos; gafas antiproyecciones; mascarilla con filtro mecánico; guantes antivibración; faja lumbar; calzado con puntera; casco.
- **Fuentes:** ss01, ss04, ss07, ss10.

#### M15 · Maquinaria · Martillo neumático y compresor
- **Riesgos:** exposición a vibraciones; exposición a ruido; proyección de fragmentos o partículas; exposición a contaminantes químicos (polvo); choques contra objetos móviles (latigazo de la manguera); explosiones (mangueras, sobrepresión); caída de objetos por desplome o derrumbamiento (compresor junto a un borde); atrapamiento por o entre objetos; exposición a sustancias nocivas o tóxicas (gases de escape en lugar cerrado); incendios.
- **Medidas preventivas:**
  - **Compresor.** A 2 m como mínimo del borde de cortes, taludes y forjados. Lanza horizontal y ruedas calzadas. Izado con eslingas de cuatro puntos. Carcasas cerradas y poleas protegidas. Repostar con el motor parado. Nunca en locales cerrados sin sacar el escape. Mejor los modelos silenciosos.
  - **Distancias ⚠.** Zona de 4 m señalizada con «protección auditiva obligatoria». Los compresores no insonorizados, lejos del tajo de martillos (8, 10 o 15 m según el ejemplo).
  - **Mangueras.** Sin grietas, revisadas a diario, con racores de presión, protegidas del paso y elevadas a 4 m en los cruces de caminos. Purgadas antes de conectar. El aire se cierra en el compresor antes de desarmar, nunca doblando la manguera. Nunca conectar a oxígeno.
  - **Martillo.** Con autorización de la DF en demolición. Puntero en buen estado y bien acoplado. Sin apoyar el peso del cuerpo, dejarlo hincado ni hacerlo funcionar en vacío. Instalaciones localizadas antes de picar. Rotación de operarios y vigilancia de la salud.
- **Protecciones colectivas:** manómetros y válvulas de seguridad; zona acotada; carcasa insonorizada.
- **EPI:** protectores auditivos (obligatorios cerca del compresor); gafas; mascarilla; guantes y faja antivibraciones; calzado de seguridad; casco.
- **Fuentes:** ss01, ss02, ss03, ss04, ss07, ss11, ss15.

#### M16 · Maquinaria · Vibrador de hormigón (vivienda)
- **Riesgos:** exposición a contactos eléctricos; exposición a vibraciones; proyección de fragmentos o partículas (lechada a los ojos); caída de personas al mismo nivel (tropiezos con el cable); caída de personas a distinto nivel (desde el encofrado); exposición a ruido.
- **Medidas preventivas:** doble aislamiento y cable aislado con tierra, protegido en los pasos; revisado antes de cada hormigonado y desenchufado al no usarse, nunca tirando del cable; continuidad de la tierra comprobada; vibrar siempre desde una posición estable (plataforma de tres tablones); no tocar la aguja.
- **Protecciones colectivas:** plataforma de vibrado con barandilla.
- **EPI:** botas y guantes de goma (dieléctricos, según ss01); gafas antisalpicaduras; casco.
- **Fuentes:** ss01, ss02, ss04, ss07, ss11.

#### M17 · Maquinaria · Soldadura eléctrica
- **Riesgos:** exposición a radiaciones (no ionizantes); exposición a contactos eléctricos; contactos térmicos; incendios y explosiones; exposición a contaminantes químicos (humos metálicos); proyección de fragmentos o partículas; caída de personas a distinto nivel (en altura).
- **Medidas preventivas:** soldador formado, con las normas por escrito; pantalla siempre; no mirar al arco, no picar el cordón sin gafas y no tocar lo recién soldado; lugar ventilado; tensión de vacío limitada, con el grupo fuera del recinto en zonas húmedas o conductoras (ss07 da 150 V en continua y 50 V en zonas húmedas ⚠); recogepinzas; grupo desconectado al dejar el tajo y antes de cambiar la polaridad; una pinza por grupo; masas a tierra; cables secos y sin empalmes; sin soldar a la intemperie con lluvia o viento fuerte; mantas o mamparas ignífugas y extintor; equipo también para el ayudante.
- **Protecciones colectivas:** mamparas o cortinas; extintor; extracción o ventilación.
- **EPI:** pantalla de soldador con filtro; guantes, mandil y polainas de cuero; calzado de seguridad; mascarilla para humos; arnés en altura.
- **Fuentes:** ss01, ss02, ss05, ss07, ss11.

#### M18 · Maquinaria · Soldadura y oxicorte con gases (soplete)
- **Riesgos:** contactos térmicos; exposición a radiaciones (infrarrojos); incendios; explosiones (botellas, retroceso de llama); proyección de fragmentos o partículas; exposición a contaminantes químicos (humos).
- **Medidas preventivas:**
  - **Botellas.** De pie, sujetas en carro, a la sombra y con capuchón; las de oxígeno separadas de las de acetileno; cerradas al dejar el equipo. Nunca se elevan con eslingas, ganchos ni electroimanes. A 3 m como mínimo del punto de trabajo, con mangueras de 6 m (ss01). El acetileno, en vertical 12 h antes de usarlo. Almacén resistente al fuego, señalizado y con extintor (IP8).
  - **Equipo.** Válvulas antirretroceso de llama. Fugas buscadas con agua jabonosa, nunca con llama. Prohibido doblar las mangueras ante un retroceso.
  - **Entorno.** Ningún combustible a menos de 2 m de la llama, ni a menos de 8 m si hay inflamables o explosivos (ss01). Recipientes que contuvieron inflamables, limpios o inertizados antes de soldarlos.
  - **Personal.** Ropa sin grasa. Operario formado, siguiendo las instrucciones del fabricante.
- **Protecciones colectivas:** pantallas; carros portabotellas; extintor; extracción en espacios mal ventilados.
- **EPI:** gafas o pantalla de soldador; guantes y manoplas, manguitos, polainas y mandil de cuero; calzado de seguridad.
- **Fuentes:** ss01, ss02, ss04, ss05, ss11.

#### M19 · Maquinaria · Grupo electrógeno
- **Riesgos:** exposición a contactos eléctricos (arranque imprevisto, humedad); incendios y explosiones (combustible); caída de objetos por desplome o derrumbamiento (junto a un borde); atrapamiento por o entre objetos; exposición a sustancias nocivas o tóxicas (escape en lugar cerrado); exposición a ruido.
- **Medidas preventivas:** a 2 m como mínimo de los bordes, calzado y nivelado, fuera de la zona de cargas suspendidas y de los pasos; izado con eslingas de cuatro puntos; niveles revisados a diario; repostar con el motor parado; carcasas puestas; conductores de 1.000 V; diferencial con puesta a tierra conectada siempre que funcione, y parada de emergencia; tomas de intemperie; al aire libre o con ventilación; zona de 4 m señalizada.
- **Protecciones colectivas:** puesta a tierra; diferencial; zona acotada.
- **EPI:** guantes aislantes en las maniobras; protectores auditivos; calzado.
- **Fuentes:** ss01, ss08, ss15.

#### M20 · Maquinaria · Pisones, placas y rodillos manuales; cortadora de pavimento
- **Riesgos:** exposición a ruido; exposición a vibraciones; atrapamiento por o entre objetos (pies); sobreesfuerzos; golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas; exposición a contaminantes químicos (polvo); explosiones (combustible); caída de personas al mismo nivel.
- **Medidas preventivas:** solo personal competente, con las normas por escrito; tapas y carcasas puestas; avance siempre de frente, sin apoyar ni empujar con los pies; relevos cada 1,5 h (ss15); zona en compactación cerrada al paso; riego; corte de pavimento en húmedo; marcado CE.
- **Protecciones colectivas:** zona señalizada y cerrada; carcasas.
- **EPI:** calzado de seguridad con puntera; protectores auditivos; gafas; guantes antivibración; mascarilla; cinturón antivibratorio.
- **Fuentes:** ss01, ss04, ss15.

#### M21 · Maquinaria · Dobladora y cortadora de ferralla
- **Riesgos:** atrapamiento por o entre objetos; golpes o cortes por objetos o herramientas (redondos); choques contra objetos móviles (giro del redondo); sobreesfuerzos; exposición a contactos eléctricos.
- **Medidas preventivas:** en el lugar señalado; entorno barrido periódicamente; partes metálicas a tierra y manguera enterrada; superficie que barren los redondos acotada con señales; descarga eslingada de cuatro puntos.
- **Protecciones colectivas:** zona acotada; toma de tierra.
- **EPI:** guantes de cuero; calzado con puntera; casco; gafas.
- **Fuentes:** ss01, ss04.

#### M22 · Maquinaria · Herramientas manuales (vivienda)
- **Riesgos:** golpes o cortes por objetos o herramientas; proyección de fragmentos o partículas; caída de objetos en manipulación; sobreesfuerzos (posturas).
- **Medidas preventivas:** la herramienta adecuada a cada trabajo, en buen estado, afilada y con los mangos firmes, sin aristas y aislados si hay riesgo eléctrico o térmico; rebabas de cinceles eliminadas y las herramientas rajadas, desechadas; pieza y herramienta fijas al golpear; se entregan en mano, nunca se lanzan; distancia con los compañeros; ergonomía (brazos junto al cuerpo, pieza a la altura de la cintura) y pausas con herramientas pesadas; reparación por especialista.
- **Protecciones colectivas:** —
- **EPI:** guantes de cuero; gafas o pantalla; calzado; casco.
- **Fuentes:** ss07, ss15.

### 4.7 Trabajos posteriores (apartado 12 del EBSS)

Estas entradas se usan para redactar las **previsiones** (elementos) y las **informaciones útiles** (datos) de K-SYS.14. La app solo las propone si el proyecto tiene el elemento.

#### TP1 · Trabajos posteriores · Mantenimiento de cubiertas (vivienda)
- **Riesgos:** caída de personas a distinto nivel (por el borde y por elementos frágiles); caída de personas al mismo nivel (en el faldón); caída de objetos desprendidos (materiales y herramientas); caída de objetos por desplome o derrumbamiento (hundimiento por acopios); contactos térmicos y golpes o cortes (reparaciones e impermeabilización); exposición a contactos eléctricos.
- **Previsiones** (los cinco puntos de la Guía, más los ejemplos): acceso a la cubierta previsto desde el proyecto; resistencia de la cubierta y de sus partes traslúcidas; zonas de tránsito; señalización de las zonas frágiles; anclajes para arnés y elementos para instalar las protecciones (ganchos de servicio, línea de vida, barandillas), dando prioridad a las colectivas.
- **Informaciones útiles:** equipos que hay en la cubierta (de HE 4, HE 5, HS 3); carga máxima admisible; prohibición de acopios excesivos; acceso desde la escalera o por trampilla.
- **Medidas preventivas:** zona inferior aislada y señalizada, también dentro del edificio habitado; plataformas y pasarelas con barandilla; arnés amarrado a la línea de vida en los faldones; andamio o visera con protección en la coronación.
- **EPI:** arnés anticaídas; calzado antideslizante; guantes.
- **Fuentes:** ss01, ss02, ss03, ss04, ss07, ss12, ss13; Guía folios 32–33.

#### TP2 · Trabajos posteriores · Fachadas, ventanas y cristaleras (vivienda)
- **Riesgos:** caída de personas a distinto nivel; caída de objetos desprendidos; caída de objetos por desplome o derrumbamiento (hundimiento del andamio).
- **Previsiones:** anclajes para arnés en la pared o en ménsula para limpiar las ventanas que no se alcanzan desde dentro (ss12); anclajes para poleas de mudanza (ss12); pescantes o pasarelas de limpieza solo si el edificio los tiene.
- **Informaciones útiles:** carpinterías practicables o fijas; cómo se limpia cada hueco.
- **Medidas preventivas:** no improvisar, por corto que sea el trabajo; andamio o plataforma con barandilla y rodapié, sin huecos y con la carga máxima rotulada; redes o lonas.
- **EPI:** arnés con un cable de longitud y resistencia adecuadas.
- **Fuentes:** ss02, ss03, ss04, ss07, ss12.

#### TP3 · Trabajos posteriores · Instalaciones y ascensor (vivienda)
- **Riesgos:** exposición a contactos eléctricos (accionamiento inadvertido, deterioro); explosiones e incendios (combustibles, desechos); exposición a contaminantes químicos (productos de limpieza o reparación); caída de objetos desprendidos (al subirlos); atrapamiento por o entre objetos (órganos móviles); caída de personas a distinto nivel (foso, techo de cabina, patinillos).
- **Previsiones:** registros accesibles; carcasas en los órganos móviles; acceso protegido al foso, al techo de cabina y a la sala o hueco de máquinas del ascensor.
- **Informaciones útiles:** localización de conducciones, cuadros y llaves de corte; instrucciones de uso y mantenimiento de los equipos; mantenimiento por empresa habilitada (REBT, RITE, ascensores, PCI).
- **Medidas preventivas:** zona aislada y señalizada; instalación fuera de servicio mientras dure el trabajo; en edificio habitado, máquinas desconectadas al acabar la jornada y huecos tapados con elementos resistentes.
- **EPI:** los del oficio.
- **Fuentes:** ss01, ss07, ss12, ss13 (II.10: antenas, bajantes, ascensor, sala de calderas, chimeneas, cuadros). *No se toma el «manual de uso y mantenimiento» de ss11: va al Libro del Edificio, no al art. 6.3.*

### 4.8 Huecos del catálogo (ningún ejemplo trae una ficha útil)

| Hueco | Por qué importa en vivienda | De dónde puede salir |
|---|---|---|
| Refuerzo de cimentación, recalces y apertura de huecos en muros de carga | Reforma y cambio de uso de local a vivienda | ss02 es una obra de este tipo, pero sus fichas son genéricas. MA6 y F12 cubren una parte. Hay que redactarla |
| Estructura de madera (forjados, cubiertas) | Rehabilitación de edificios antiguos | ss02 y ss04 solo la nombran. Hay que redactarla |
| Instalación de gas | Vivienda con gas | Solo junta con la calefacción (ss07). F25 cubre la soldadura y los locales |
| Captadores solares y fotovoltaica en cubierta | La app tiene HE 4 y HE 5 | Ninguno. TP1, F16, F17, F25 y F36 cubren una parte |
| Aislamientos (lana mineral, poliuretano proyectado, SATE) | Reforma de la envolvente (HE 1) | ss10 tiene poliuretano proyectado sin ficha |
| Impermeabilización de muros y sótanos | Obra nueva con sótano | Ninguno |
| Obra con el edificio habitado o el local en uso | Reforma en plurifamiliar; local en planta baja | Ninguno (ss04 tenía el caso y no lo trata). Va al apartado 9 |
| Trabajos en vuelo de fachada sobre la vía pública (miradores, balcones, cornisas) | Casco histórico | ss03 tenía el caso y no lo trata. IP2 y MA1 cubren una parte |
| Retirada de plomo y de otros agentes del edificio existente | Rehabilitación | ss03 retira plomo sin tratarlo (duda 8) |
| Izado de equipos a cubierta desde la vía urbana | Climatización y aerotermia | ss09 tenía el caso y no lo trata. F25, F36 y M6 cubren una parte |
| Placa de yeso laminado como ficha propia | Tabiquería y techos de vivienda | F15 y F30 cubren una parte |
| Cubierta inclinada en ejecución, con detalle | Unifamiliar | F17 es débil |

### 4.9 Cifras en conflicto (no se codifican hasta verificarlas)

| Tema | Valores en los ejemplos | Qué hace la app mientras tanto | Norma que hay que leer |
|---|---|---|---|
| Resistencia de la toma de tierra provisional | 2 Ω (ss11), 20 Ω (ss01, ss07, ss08), 37 Ω (ss04), 80 Ω (ss01, ss06, ss10, ss14), 800 Ω (ss01, con 30 mA) | No imprime cifra | ITC-BT-18 e ITC-BT-33 (tensión de contacto) |
| Sensibilidad de los diferenciales | 300 mA en fuerza y 30 mA en alumbrado (casi todos); 30 mA en todo (ss14) | Imprime 300 / 30 mA como práctica, sin cita | ITC-BT-33 |
| Profundidad a partir de la que se entiba | 0,60 m (ss07, ss11), 1,30 m (criterio habitual), 1,50 m (ss09; pozos en ss11); tipos por profundidad en ss08 | «Según el terreno y el estudio geotécnico», sin cifra | Ninguna norma leída lo fija; Guía o NTP |
| Retén exterior y prohibición de trabajar solo | 1,25 m (ss08), 1,30 m (ss07, ss11), 1,50 m (ss01) | Sin cifra | Ídem |
| Acopio respecto al borde de la excavación | 0,60 m (ss01), 1 m (ss01), 2 m (ss07, ss11, ss15), 2,50 m si la excavación pasa de 1,25 m (ss08) | Sin cifra | Ídem |
| Vehículos y máquinas respecto al borde | 3 m ligeros y 4 m pesados (ss07, ss11; ss09 lo escribe al revés, «como máximo»); 2 m (ss09, ss15); topes a 1 m (ss01) | Sin cifra | Ídem |
| Altura de la barandilla | 90 cm (RD [V] y la mayoría); 1,00 m (ss14, ss11, ss01) | «90 cm como mínimo» [V]; el proyectista puede poner 1,00 m | RD 1627 anexo IV C.3 (hecho) |
| Rodapié y resistencia de la barandilla | 15 cm (ss01, ss07, ss11) o 20 cm (ss05, ss14); 150 kg/m (ss01, ss11) | Sin cifra: el RD dice «reborde de protección» | RD 1627 anexo IV C.3 (hecho) |
| Borriquetas: separación entre apoyos y altura máxima | 2,5 m o 3,5 m; prohibidas por encima de 6 m, o limitadas a menos de 2 m; arriostrar desde 2 o 3 m | Barandilla desde 2 m [V]; lo demás, sin cifra | RD 1215/1997 anexo II, ap. 4.3 |
| Escalera de mano | Sobrepasar 1 m (casi todos) o 90 cm (ss05); 5 m como máximo (ss01); prohibidas las de más de 3 m sin fijar en los dos extremos (ss08) | 1 m; 5 m con garantías; 3,5 m con anticaídas [W] | RD 1215/1997 anexo II, ap. 4.2 |
| Arnés o protección en demolición | 3 m (ss11) frente a 2 m (RD) | 2 m [V] | Hecho |
| Viento para parar | 50 km/h (ss01, ss07, ss11 en cubiertas y muros); 60 km/h (ss07, ss09, ss11, ss14 en grúa, soldadura, demolición, prefabricados) | «Viento fuerte»; para grúas y plataformas, el límite del fabricante | Manuales; RD 836/2003 |
| Compresor respecto al tajo de martillos | 8 m (ss07), 10 m (ss02, ss03, ss04), 15 m (ss01, ss07, ss15) | Sin cifra; protección auditiva obligatoria a menos de 4 m como práctica | RD 286/2006 |
| Distancia a líneas eléctricas | 3, 5 y 6 m según la tensión (ss07); 3 y 5 m con corte en 50 kV (ss11); 5 m (ss01, ss09) | «Distancia de seguridad del RD 614/2001», sin cifra | RD 614/2001 (anexos) |
| Iluminación del tajo | 100 lux a 2 m o a 1,50 m (ss07), 200–300 lux (ss11), 200 lux en el hueco del ascensor (ss07) | «Iluminación suficiente» | RD 1627 anexo IV |
| Andamio: separación a la fachada y cadencia de anclajes | 20 cm (ss01) o 30 cm (ss07, ss11, ss14); anclajes cada 24/12 m² (ss07) o 5 m + 6 m + 3 m (ss01) | 30 cm; anclajes según el fabricante | RD 1215/1997; UNE-EN 12810/12811 |
| Boca de la bajante sobre el contenedor | 1 m (ss01) o 2 m (ss11, ss14) | «A poca altura y con lona» | — |
| Separación de los pies derechos de la barandilla | 2 m (ss14) o 2,30 m (ss01) | Sin cifra | — |
| Ruido | 80 dB(A) (ss15) | Sin cifra | RD 286/2006 |

Cifras **coherentes** entre ejemplos que se pueden imprimir como práctica, sin cita: pilas de acopio de 1,50 m como máximo; 25 kg por persona; plataformas y pasarelas de 60 cm; portátiles a 24 V; tendido aéreo a 2 m y 5 m; caída sobre la red de 6 m como máximo; hormigonera y sierra a 3 m del borde. La de 25 kg conviene citarla con el RD 487/1997 una vez leída su guía.

### 4.10 Recuento y origen

**89 entradas**: 8 de instalación provisional (IP1–IP8), 40 de fase de obra (F0–F39), 16 de medio auxiliar (MA1–MA16), 22 de maquinaria (M1–M22) y 3 de trabajos posteriores (TP1–TP3). **57 llevan la marca (vivienda).** Hay además 12 huecos (§4.8).

Los cuatro catálogos de partida sumaban 240 entradas (A 62, B 63, C 64, D 51). Al unirlos:
- se fusionan las fichas iguales de los cuatro grupos (andamios, escaleras, demolición, instalación eléctrica…) y se suman sus fuentes;
- la producción de hormigón en obra pasa a la hormigonera (M10);
- el ascensor de obra pasa al montacargas (M8);
- la jardinería y las firmes pasan a la urbanización (F39);
- los encofrados de pilares, de forjados y de madera quedan en F10, y la ferralla, los forjados y el hormigonado en F11.

---

## 5. Lo que no se copia de los ejemplos

### 5.1 Prohibido o corregido por la verificación

| Qué | Dónde aparece | Motivo | Criterio |
|---|---|---|---|
| «Aviso previo» y el contenido del anexo III | ss01, ss02, ss06, ss07, ss08, ss09, ss12 | Art. 18 derogado por el RD 337/2010; hoy, comunicación de apertura (art. 19.1) | K-SYS.6 |
| Copia a la ITSS de toda anotación del libro de incidencias en 24 h | ss01, ss06, ss11, ss12 | El art. 13.4 vigente lo limita al incumplimiento de advertencias anteriores y a la paralización (art. 14) | K-SYS.6 |
| Ratios de servicios atribuidas al RD 1627, al RD 486/1997 o a la Ordenanza de 1971 | ss02, ss03, ss04, ss06, ss07, ss08, ss11 | El RD 1627 dice «número suficiente»; las ratios son del VII CGSC, art. 232.2 | K-SYS.5 |
| Cifras de dotación sin respaldo: 2 m² de vestuario por trabajador, 2,30 m de altura, cabina de 1 × 1,20 m, 1,20 m² de comedor, espejo cada 25 | ss01, ss02, ss03, ss04, ss06, ss07, ss08, ss09, ss11 | Vienen de la Ordenanza de 1971 o no están verificadas | K-SYS.5 |
| RD 486/1997 aplicado a la obra (servicios, botiquín, escaleras, salidas, PCI) | 12 de 13 estudios | El RD 486/1997 excluye las obras (art. 1.2) | K-SYS.5 (LEÍDO web) |
| Ordenanza General de 1971 y Ordenanza de Trabajo de la Construcción, Vidrio y Cerámica de 1970 | 8 y 8 estudios | No citables para obras; no leídas, así que no se citan | K-SYS, «SIN CONFIRMAR» 9 |
| Umbral en pesetas, «450.800 €» o «450.760 €»; PEC sin GG ni BI; IVA del 16 % | ss06, ss08, ss09, ss12 | 450.759,08 €; PEC = (PEM + GG + BI) × (1 + IVA), con los porcentajes declarados | K-SYS.1 |
| Supuesto b) leído como «inferior a 30 días», o como si bastara una de las dos condiciones | ss06, ss09 | Hacen falta las dos a la vez | K-SYS.1 |
| Concluir que basta el básico con más de 500 jornadas | ss15 | El supuesto c) obliga al estudio completo | K-SYS.1 |
| No justificar por qué es básico o completo | ss01, ss05, ss07, ss08, ss11 | La Guía pide justificarlo con datos | K-SYS.2 |
| Presupuesto propio en el básico; exigir en el plan una «valoración económica no inferior» (art. 7.1) | ss02, ss12 | El básico es descriptivo; el art. 7.1 se refiere al estudio completo | K-SYS.3 |
| Amianto sin identificar en edificio existente; «si aparece, se elimina en otra operación» | 10 estudios pertinentes; ss11 | La identificación debe constar en el EBSS | K-SYS.9 |
| Excepción del art. 3.2 del RD 396/2006 dada por hecha; valores límite de amianto | (ningún ejemplo, pero es tentador) | Depende de la evaluación de la empresa; los valores van a cambiar | K-SYS.9 |
| Campo «Riesgos especiales» vacío; «ninguno» sin motivo | ss02, ss03, ss04, ss06, ss10 | El art. 6.2 pide medidas específicas | K-SYS.4 |
| Trabajos posteriores genéricos, o un manual de uso en su lugar | ss02, ss03, ss04, ss06, ss07, ss11, ss12 | Previsiones e informaciones de esta obra | K-SYS.14 |
| Riesgo de caída: arnés desde 3 m | ss11 | Protección colectiva desde 2 m | RD 1627 anexo IV C.3 [V] |
| Escalera que sobresale 90 cm | ss05 | Al menos 1 m | RD 1215/1997 [W] |

### 5.2 Materiales, EPI y contenidos prohibidos u obsoletos

| Qué | Dónde | Motivo |
|---|---|---|
| Tubo de fibrocemento para proteger cables; guantes, calzado y capuces de amianto; losetas de amianto-vinilo | ss07, ss11 | Materiales con amianto, prohibidos; además contradicen el art. 10.2 del RD 396/2006 |
| Halón como agente extintor | ss01 | Prohibido (Reglamento (CE) 1005/2009, según el análisis C; no cotejado) |
| Botiquín con mercurocromo o mercromina, amoníaco, tintura de yodo, «tónicos cardíacos», hervidor | ss10, ss11, ss15 | Contenido desfasado |
| «Cinturón de seguridad clase A o C», normas MT | ss01, ss03, ss04, ss06, ss07, ss09, ss14 | Hoy es arnés anticaídas (UNE-EN 361) o cinturón de sujeción (UNE-EN 358), según los análisis |
| Andamios colgados con tirillas de esparto, rollizos o «tablones del norte» | ss11 | Prescripciones obsoletas |
| «Estudio de Seguridad e Higiene» | ss14 | Terminología del RD 555/1986, derogado |

### 5.3 Normas sustituidas que citan los ejemplos

El estado lo dan los analistas y **no se ha cotejado** aquí. Basta para no citar la norma de la izquierda; la de la derecha solo se cita cuando esté leída.

| Norma citada | Dónde | Sustituida por (según los análisis) |
|---|---|---|
| RD 1316/1989, ruido | ss01, ss02, ss03, ss04, ss06 | RD 286/2006 |
| RD 1407/1992 y RD 159/1995, comercialización de EPI | ss01, ss02, ss03, ss07, ss08, ss10, ss11, ss15 | Reglamento (UE) 2016/425 |
| RD 1435/1992 y RD 56/1995, máquinas; Directiva 89/392/CEE | ss01, ss02, ss03, ss04, ss06, ss07, ss10, ss11 | RD 1644/2008; Directiva 2006/42/CE |
| RD 1495/1986, seguridad en las máquinas | ss02, ss03, ss04, ss06, ss07, ss10, ss11 | RD 1849/2000 (alcance por confirmar) |
| REBT de 1973 (instrucciones MI BT) | ss01, ss04, ss06, ss07, ss11 | RD 842/2002 |
| Reglamento de alta tensión de 1968 | ss11 | RD 223/2008 |
| ITC MIE-AEM 2 de 1988; MIE-AEM 4 (RD 2370/1996) | ss01, ss02, ss04, ss06, ss11, ss14 | RD 836/2003; RD 837/2003 |
| Órdenes de amianto de 1984 y 1987; Resolución de 1989 | ss01, ss02, ss03, ss04, ss06, ss07 | RD 396/2006 |
| RD 1403/1986, señalización | ss08 | RD 485/1997 |
| RD 245/1989 y RD 71/1992, ruido de máquinas | ss01, ss02, ss03, ss04 | RD 212/2002 |
| RD 1942/1993, instalaciones de PCI | ss01, ss15 | RD 513/2017 |
| NBE-CPI-96, NBE QB-90 | ss01, ss07, ss11 | CTE |
| EHE | ss03, ss04 | Código Estructural (RD 470/2021) |
| Ley 10/1998, Ley 22/2011 y RD 833/1988 (residuos) | ss01, ss07, ss08, ss11 | Ley 7/2022 |
| Ley 8/1988, infracciones | ss01 | RDLeg 5/2000 |
| Ley 42/1997, Inspección | ss01 | Ley 23/2015 |
| Estatuto de los Trabajadores (Ley 8/1980, RDL 1/1995) | ss01, ss02, ss03, ss07, ss10, ss12, ss15 | RDLeg 2/2015 |
| Convenios de 2002–2006, 2007–2011, IV y V | ss07, ss08, ss15 | VII CGSC (verificado) |
| Orden de 20-05-1952 (Reglamento de la construcción); Orden de 31-01-1940 (andamios) | ss04, ss06, ss07, ss10, ss11 | Sin vigencia útil; no se citan |
| Orden de 20-09-1986, modelo de libro de incidencias | ss03, ss04, ss06, ss10 | Art. 13 del RD 1627/1997 |
| Orden de 16-12-1987, notificación de accidentes | ss03, ss04 | Orden TAS/2926/2002 |
| UNE 76-502 (andamios); UNE-EN 344 a 347 (calzado) | ss03, ss04, ss10 | UNE-EN 12810/12811; UNE-EN ISO 20344 a 20347 |
| RD 1995/1978; Decreto 423/1971; RD 2001/1983 | ss02, ss03 | RD 1299/2006; Ley 31/1995; derogado |
| RD 1254/1999; RD 2414/1961 (RAMINP); Reglamento de aparatos a presión de 1979; RD 909/2001 (legionela); RD 255/2003 | ss01, ss06, ss07, ss11 | RD 840/2015; Ley 34/2007; RD 809/2021; RD 487/2022; Reglamento CLP |

Quedan **por confirmar** (los analistas lo marcan): órdenes de plomo y de cloruro de vinilo de 1986, RD 1513/1991 (cables, cadenas y ganchos), Orden de 1977 (aparatos elevadores para obras), RD 2291/1985, Orden TAS/2947/2007 (botiquines). No se citan.

### 5.4 Erratas y cifras sin base

| Qué | Dónde | Corrección |
|---|---|---|
| «IP 447» | ss07, ss11 | Código inexistente; se quita |
| Diferenciales de «300 A / 30 A» | ss15 | mA |
| Borriquetas separadas «2,5 cm» | ss01 | m (y ⚠, §4.9) |
| «30 cm entre máquinas» | ss01 | Sin sentido; se quita |
| Barandilla de cubierta de 0,95/1,00 m hasta 25 m de caída y 1,10/1,50 m por encima | ss11 | Sin base; provisional según el RD 1627 (90 cm como mínimo) y definitiva según el DB SUA 1 |
| Vehículos «a no más de» 3 o 4 m del borde | ss07, ss09 | Redacción invertida |
| «RD 1215/2004», «RDL 1627», «RD 1627/1999», «1627/19979», «R.D. 5/2000», «RD 83720/03», «RD 833/1998», «RD 842/2001», «Ley 5412003», «Decreto 1627/1997», «Art. 1.3» por 2.3 | ss02, ss03, ss04, ss07, ss08, ss11, ss15 | Erratas de cita |
| Ley 54/2003 rotulada «de Prevención de Riesgos Laborales»; botiquín «según el anexo 6 del RD 1627» | ss06 | Mal rotulado y mal citado |
| Dúmper con permiso «clase B2» | ss15 | Categoría que ya no existe |
| Media de trabajadores usada como punta; plazo de 18 meses dividido entre 1,25 años | ss01 | El dato es el **máximo** a la vez, y el plazo, el del proyecto |
| PEM de la memoria distinto del total del presupuesto | ss07 | Coherencia (fase 7, «Antes de entregar») |

### 5.5 Genérico sin utilidad

- **Fichas de unidades o máquinas que la obra no tiene** (ss01, ss07, ss08, ss09, ss11, ss12): grúa torre sobre carriles en una parcela pequeña, muros pantalla, «pozo o mina», hinca, galería visitable, pilotadora, asfalto en una obra de edificación, gasóleo, «hospitales, cementerios, cuadras». La app solo imprime lo marcado.
- **Índices que anuncian fichas o apartados que no están** (ss01, ss02, ss03, ss04), e identificaciones heredadas de otra obra (ss04).
- **Transcripción de reglamentos** (ss09: unas 30 págs. de la LPRL y de los RD 486, 485 y 1215).
- **Fichas por oficio, fichas de producto de EPI y de materiales, manuales de fabricante pegados** (ss01, ss07, ss11).
- **Lo que es del plan, no del estudio:** comité de seguridad, delegados, planes de evacuación, protocolo COVID (ss01, ss06, ss11; también los recoge ss13).
- **Matriz probabilidad × consecuencias con todos los riesgos «Evitado»** (ss11). En el básico basta la lista, y «evitado» solo puede ser lo del apartado 7.
- **Recurso preventivo en todas las unidades** (ss07): solo en las del anexo II.
- **Tablas largas de normativa, desalineadas** (ss02, ss03, ss04, ss10).
- **Volumen.** 194, 333 y 350 páginas; un básico de vivienda cabe en 10 a 20.
- **Texto de ss13.** Tiene licencia CC BY-NC-ND: se toma la estructura, no el texto.

---

## 6. Pendiente y dudas para el usuario

**Para verificar antes de cerrar feature-35**
1. **Nombres de riesgo.** Cotejar la lista del §4.2 (la del método general del INSST que usan los ejemplos) con los 22 nombres de la NTP 908 que fija K-SYS.13, y decidir cuál manda.
2. **Cifras en conflicto (§4.9).** Leer la ITC-BT-18 y la ITC-BT-33, el RD 1215/1997 (anexo II, aps. 4.2 y 4.3), el RD 614/2001, el RD 286/2006 y el RD 487/1997. Mientras tanto, la app imprime esas medidas sin cifra.
3. **Normas de la lista corta** que siguen sin leer (§3) y las «por confirmar» del §5.3.
4. ~~**PDF de ss03 y ss04.**~~ Hoja del art. 4 cotejada en imagen (2026-10-16, ver «Límite 3»). La tabla de normativa no hace falta: la lista corta sale de la verificación.

**Decisiones a validar con el usuario**
1. **Ayuda para estimar el número de trabajadores desde el PEM.** ss01, ss07 y ss09 lo hacen con el porcentaje de mano de obra, las horas al año y el coste por hora (con porcentajes del 6,67 al 50 %). La Guía no da método (K-SYS.2). **Propuesta:** la app lo ofrece como estimación, con el porcentaje que declare el proyectista, y el dato que cuenta es el que el proyectista confirma.
2. **Compromiso del promotor** de la hoja del art. 4 (plantilla del estudio: ss02, ss03, ss04). **Propuesta:** mantenerlo, quitando «encargar y visar» y «Decreto 1627/1997». ¿Hay algún motivo para que diga «visar»?
3. **Formato de la ficha impresa:** (a) la tabla del estudio, con evitables y no evitables, o (b) cuatro columnas *Riesgo | Medidas | Protecciones colectivas | EPI* (§3). **Propuesta: (b).**
4. **«Valorando su eficacia»** (art. 6.2). Ningún ejemplo lo hace. **Propuesta:** una frase por ficha que diga qué medidas eliminan la exposición y cuáles solo la reducen. Alternativa: la columna de frecuencia de ss10.
5. **Frecuencia de uso** (permanente / frecuente / ocasional) de ss10 y ss06 junto a cada medida y EPI: ¿se incluye? **Propuesta:** solo en el bloque «toda la obra».
6. **Documentación gráfica.** ¿La app genera las dos hojas básicas (situación con el recorrido al centro asistencial; ordenación de obra) o deja solo el hueco y los detalles tipo de ss14?
7. **Centro asistencial.** ¿Lo declara el proyectista (nombre, distancia, tiempo) o la app lo saca del mapa, como el radón?
8. **Plomo y otros agentes del edificio existente** (ss03 retira plomo de una cubierta): ¿un apartado «otros agentes peligrosos» junto al del amianto, o una nota en la fase de demolición?
9. **Coordinador en proyecto con dos coautores** (caso de ss04): ¿cuenta como «varios proyectistas» del art. 3.1? (K-SYS.11: la Guía habla de varios proyectistas «durante la elaboración del proyecto»).
10. **La plantilla de 20 fichas del estudio** (ss02, ss03, ss04) arrastra la Ordenanza de 1970 en cada ficha, el aviso previo (ss02) y el RD 486/1997. ¿La app la sustituye entera, o hay textos propios que se quieran conservar?
11. **Botiquín.** ¿Qué contenido se imprime? El RD 1627 (anexo IV A.14) solo pide material de primeros auxilios; la Orden TAS/2947/2007 que cita ss09 no está leída.
12. **Huecos del §4.8.** ¿Cuáles se redactan para la primera versión? **Propuesta:** apertura de huecos y recalces, edificio habitado, vuelo sobre la vía pública e izado de equipos a cubierta, que son los casos de vivienda que más salen en el estudio.
