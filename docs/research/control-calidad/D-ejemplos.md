# D — Ejemplos de planes de control de calidad (verificador de ejemplos)

Fuente: `D:\PROGRAMACION\Mediciones\ejemplos pdf\control calidad\` (no versionado), volcados en
`volcados/*.txt`, hoja de la Junta V03 (oct 2022) y **V04 (ene 2023)** en
`volcados/norma/xls/PlanCC_CodE_V04_2023.xls`, BCCA 2023 y Precio Centro 2017 de
`docs\spike\samples\`. No he tocado código. La normativa la verifican otros: aquí digo qué
hace cada documento y qué cita, no qué exige la norma (salvo cuando el propio documento se
contradice o cita algo que ya ha dicho otro verificador que está derogado).

Scripts (todos en `volcados/scripts/`):
- `xls_formulas.ps1`: abre el .xls con Excel en solo lectura y macros desactivadas y vuelca
  las fórmulas (`PlanCC_formulas.txt` V03, `PlanCC_V04_formulas.txt` V04).
- `formula_patterns.py`: agrupa las fórmulas por patrón de fila (`aux_patterns.txt`).
- `parse_plancc.py`: saca los 752 ensayos de las hojas de capítulo (`out\ensayos.json/.tsv`).
- `clasifica_lotes.py`: clasifica las reglas de lote en tipos programables.
- `bcca_cap18.py`: lee el capítulo 18 de la BCCA (o el E29 de Centro) y empareja con la hoja
  (`out\bcca18.json`, `out\match.json`; Centro en `out_centro\`).
- `diff_v03_v04.py`: compara V03 y V04 celda a celda (`out\diff_v03_v04.txt`).

---

## 0. Lo que ha salido al explorar (resumen para el plan)

1. **La V04 de la hoja de la Junta es la V03 con otra portada.** El diff celda a celda (valores
   y fórmulas de las 16 hojas) da solo dos cambios: la portada («Versión 04, enero 2023») y dos
   líneas nuevas en el equipo redactor (un colaborador del Colegio de ITOP de Zaragoza). **Ni un
   ensayo, lote, precio ni fórmula cambia; la hoja AUX es idéntica.** Por tanto la V04 **no
   arregla** el límite de «2 plantas» ni el de tiempo de la tabla 57.5.4.1 (comprobado en las
   fórmulas: los lotes de pilares salen de `ROUNDUP(V/100)` y `ROUNDUP(S/500)` y nada más; con
   pilares de 3 plantas, 20 m³ y 400 m² da 1 lote y 3 amasadas, que es lo que dice el verificador
   del Código). Todo lo que sigue sobre la hoja vale para la V04; los datos (ensayos, precios,
   enlace con la BCCA) están medidos sobre ella.
2. **Los dos planes del propio estudio no se pueden tomar como modelo.** La memoria de 2026
   (edificio de uso hostelero) es la plantilla del Colegio de Cádiz de 2007
   (esquema EHE-98, normas UNE de los ochenta, RL-88, NBE-FL-90, NBE-QB-90) con «Cod. Estructural»
   puesto encima, y su valoración (252,27 €, 0,08 % del PEM) son cuatro pruebas de servicio de
   Precio Centro que no casan con lo que dice el texto: **ni un ensayo de hormigón ni de acero**
   con 105.000 € de cimentación y estructura. La obra de ejemplo del repo (`obra ejemplo.bc3`,
   vivienda unifamiliar, PEM 491.298,72 €) repite el patrón: 283,69 € (0,06 %), tres pruebas de
   servicio de Centro. El anexo de 2025 (refuerzo con 116 micropilotes, hecho con CYPE) valora
   «4 ud» de un ensayo de hormigón a 23,73 € y nada de los micropilotes.
3. **Lo mejor de los ejemplos es CYPE para la ejecución y la Junta para los ensayos**, y no se
   solapan. El plan de CYPE (anexo 2025) va **partida a partida del presupuesto** con fases,
   verificaciones, frecuencia y criterio de rechazo, pero no calcula ningún número ni valora
   casi nada. La hoja de la Junta calcula y valora ensayos y pruebas de servicio, pero **no
   tiene recepción documental ni control de ejecución** (solo unas pocas inspecciones de
   laboratorio en acero). La app tiene que juntar las dos cosas y añadir la recepción documental,
   que no está en ninguna de las dos.
4. **La hoja de la Junta sigue la numeración de capítulos de la BCCA** (lo dice su introducción) y
   **la BCCA 2023 copia sus precios**: el 77 % de los 752 ensayos casa con una partida del
   capítulo 18 por precio (±0,5 %) y nombre; el 83 % si se admite el nombre solo. Pero el precio
   solo no basta (la mitad de los emparejamientos solo por precio son falsos: 210 € es a la vez
   «composición química del acero» y «compresión simple de suelo-cemento») y **la BCCA no tiene
   ningún ensayo de barras ni mallas de acero corrugado**, que es el control obligatorio más
   frecuente después del hormigón. Hace falta una tabla curada ensayo ↔ código, no un casado
   automático.
5. **La hoja AUX de amasadas es programable pero tiene fallos que la app no debe copiar**: además
   de las plantas y el tiempo, una fila sin tipo «C/AC» desaparece del total (SUMIF), los pilotes
   de menos de C35 dan tomas fraccionarias (`K/5` sin redondear), los encepados siguen la EHE-08
   y salen 0 si no se teclea el número, y **excluye por completo el hormigón con distintivo
   (DCOR)**, que en la práctica es el caso más corriente.
6. **Las designaciones de hormigón de los presupuestos del estudio están mal escritas a menudo**
   (EHE: `IIa`, `I`; erratas: `CX1`, `CX4`, `XC2a`, `CX2VERT`) y la app va a sacar de ahí los
   ensayos de durabilidad. Hay que validar la designación antes de usarla.
7. **Los textos `~T` de la BCCA y de Centro arrastran normativa vieja**: «clases generales de
   exposición III o IV» (BCCA 18HHL00030), «asentamiento en hormigón endurecido» (18HHL00020),
   «PROBETHA 08», UNE 7014:1950; en Centro 2017, 44 partidas del E29 citan la EHE-08 y ninguna el
   Código. No se pueden pegar tal cual en el plan.

---

## 1. Fichas de los documentos

Notación: CE = Código Estructural (RD 470/2021); RPC = Reglamento (UE) 305/2011.

### 1.1 `PlanCC_xls` — hoja de la Junta (V03 oct 2022 / V04 ene 2023)
- **Qué es**: «Plan de Control de Calidad de Materiales para Obras de Edificación (versión Código
  Estructural)». Herramienta en Excel. Nº de registro JAFIOT/SGT-01-2022.
- **Origen**: Consejería de Fomento (Servicio de Fomento y Control de Calidad), Asociación de
  Laboratorios de la Construcción de Andalucía (ALA: CEMOSA, GEOLEN, Sergeyco, ELABORA) y ETSIE
  de Sevilla. Precios «de la AOPJA y de mercado».
- **Plantilla**, no de un proyecto: todas las mediciones a 0. «Tipología de partida: bloque
  residencial», dice que se puede adaptar.
- **Base normativa**: CE para hormigón (tabla 57.5.4.1, art. 57.3.2/57.3.3, 33), CTE (DB HS, HR,
  SE-C), PG-3 (28 filas), NLT (45 filas). Restos: la hoja AUX hace los **encepados y la
  cimentación profunda «según la EHE-08»** (lo dice ella); la fila 65 del cap. 03 remite a la
  EHE-08 para la lotificación; «clases generales de exposición» (nomenclatura EHE) en las filas
  27 y 29; normas MOPU-74/86 en saneamiento; DRC 06/09 de la Generalitat Valenciana para la
  prueba de cubierta. No cita RC ni RPC (no tiene recepción documental).
- **Estructura**: Portada, Introducción, 10 hojas de capítulo (02, 03, 06, 07, 08, 09, 10, 11,
  13, 15), hoja AUX de amasadas, Precios unitarios recomendados, Resumen. Detalle en §3.
- **Valoración**: nº de ensayos × precio unitario por fila; suma por capítulo; total. Sin % del
  PEM, sin GG/BI/IVA.
- **Lotes de hormigón**: sí, en la hoja AUX (§3.3).
- **¿Del presupuesto?** No lee el presupuesto: el usuario teclea la medición de cada fila. Pero la
  medición es la de la partida (m², m³, t, nº de viviendas…) y los capítulos son los de la BCCA,
  así que es la candidata natural.

### 1.2 `PlanControlCalidad_22112022.docx`
- **Qué es**: plan tipo de «Estructuras de hormigón con armaduras pasivas» adaptado al CE.
  Casillas de opción (☐ visita a central / ☐ distintivo / ☐ control experimental…).
- **Origen**: el mismo autor (según los metadatos) que el pliego, el manual particular de 2011
  y los A3 de 2006; por el
  pliego que remite al COA de Málaga, parece documentación de apoyo del Colegio. Nov 2022.
- **Plantilla** (no hay obra).
- **Base**: CE (art. 29, 30, 33, 34, 35, 49, 56, 57, 59, 63, anejos 13, 14, 15), UNE-EN vigentes.
  Bien puesto al día.
- **Estructura**: control de productos (componentes, hormigón: previo, durante y después del
  suministro, docilidad, resistencia —estadístico, 100 %, indirecto—, durabilidad, información
  complementaria), armaduras (acero, armaduras normalizadas, ferralla), control de ejecución
  (lotes de ejecución, unidades de inspección, procesos previos, montaje de armaduras,
  soldaduras).
- **Valoración**: ninguna. **Lotes**: reproduce la tabla de lotes (con columna DCOR: tamaño ×5,
  N=1) y la de lotes de ejecución, pero no calcula nada.
- **Contradicción interna**: los criterios de penetración de agua aparecen dos veces con cifras
  distintas; la segunda tabla (máx. 50 / media 30, con XA2 y XS3/XA3 en filas aparte) está bajo
  el epígrafe del contenido de aire y no casa con la primera. Además las series de diámetros se
  solapan («gruesa: 25 a 32», «muy gruesa: 32 a 40»).
- **Vale como**: texto base del control de recepción y de ejecución del hormigón y del acero
  (después de que el verificador del CE lo revise). No sirve para la valoración.

### 1.3 `A3.plan_control_cte_catarquitectosdecadiz.doc`
- **Qué es**: «Plan de control tipo» del Colegio de Arquitectos de Cádiz, febrero de 2007, para
  una «vivienda unifamiliar sita en la parcela XX, manzana XX».
- **Plantilla** con datos de ejemplo.
- **Base**: CTE recién aprobado + **EHE (tabla 95.1.a)**, RL-88/NBE-FL-90 (ladrillo), NTE-RPE,
  NTE-RSR, NBE implícita en láminas (UNE 104281/85), normas UNE de los 70-90 (UNE 83300/84,
  7262, 36088, 53112/88, 53020/73, 67026…), «sello de calidad» de la perlita. Remite a la
  circular CAT nº 2/2007 y al documento del COAM, y a una **hoja de cálculo de la entidad de
  control VORSEVI** para el número de ensayos.
- **Estructura**: 0 generalidades; 1 recepción (documental, distintivos, ensayos, por materiales:
  zahorra, hormigón, armaduras, estructura metálica, ladrillos y morteros, revestimientos,
  cubiertas, aislamientos, pinturas, saneamiento y fontanería); 2 control de ejecución
  (inspecciones por oficio e instalaciones, «mínimo 6 visitas»); 3 obra terminada y pruebas
  finales (cubiertas 100 %, 3 de fachada, instalaciones «sobre el 30 % de las viviendas»);
  4 informes; cuadro-lista de chequeo por capítulo (documentación previa / ejecución / pruebas /
  documentación final).
- **Valoración**: ninguna (la remite a la hoja de VORSEVI).
- **Lotes**: tabla de la EHE con «2 series (N=2) de 4 probetas a 7 y 28 días» por lote y un cuadro
  de lotes con mediciones: **losa armada de 574 m³ y 6 lotes en una vivienda unifamiliar**,
  forjados de 817, 400 y 412 m². Son de otra obra: cuantificación arrastrada.
- **Vale como**: estructura (las tres partes y la lista de chequeo por capítulo son buenas). Ni
  una cifra ni una norma.

### 1.4 `A3.061025.doc` (= `A3.061025 (1).doc`), `-01`, `-02`, `-03`
Serie de 2006-2007, CTE recién publicado:
- **A3.061025** (104 pp.): «Prescripciones generales de recepción de productos y de ejecución de
  obra», en tablas, copiando por DB los apartados de control del CTE (SE-C, SE-A, SE-F, SE-M, HE,
  SU, HS, SI) y de la **EHE** («Estructuras de hormigón armado — Según EHE», CC-EHE, UNE 83309:90
  EX). Sin DB HR. Genérico.
- **-01** (5 pp.): definición del plan según la Parte I del CTE (art. 6, 7, anejo II). Genérico,
  todavía válido en lo esencial (lo verifica otro).
- **-02** (31 pp.): «Condiciones y medidas para la obtención de las calidades…», **preparado por la
  Comisión de Tecnología del COAAT de Madrid**, en cumplimiento de la **Ley 2/1999 de la
  Comunidad de Madrid**. Procedimiento del marcado CE según **RD 1630/1992 y Directiva
  89/106/CEE**, DITE, Sello INCE, CCRR, «Ministerio de la Vivienda», www.madrid.org; listado de
  productos con su fecha de obligatoriedad del marcado CE (2001-2005), RC-03, RY-85, RL-88,
  RB-90. Todo derogado o de otra comunidad.
- **-03** (11 pp.): «Listado mínimo de pruebas de las que se debe dejar constancia» por capítulo
  (cimentación, hormigón —modalidades y niveles de control de la EHE—, acero, fábricas,
  instalaciones…). La estructura (lista mínima por capítulo) es útil; el contenido es EHE.
- **Valoración y lotes**: ninguna.

### 1.5 `101_MEM_MEMORIA.pdf` (estudio, 2026)
- **Qué es**: memoria del proyecto de ejecución de un edificio de uso hostelero en
  la provincia de Málaga, del propio estudio, febrero-marzo 2026, 292 pp. PEM
  316.553,04 €. Apartado 6.4 «Plan de control de calidad» (pp. 236-239) y capítulo 16 del
  presupuesto.
- **Base**: la etiqueta «Cod. Estructural», pero el contenido es la plantilla de Cádiz 2007:
  series N = 2 / 4 / 6 según fck, 4 probetas a 7 y 28 días, UNE 83300/84-83313/90; barras
  «por cada 40 toneladas», UNE 36068/94 y UNE 7474; ladrillos «según RL-88 (anejo 1 de la NBE
  FL-90)», UNE 67026-67039; morteros «(FL-90)» y NTE-RPE; láminas UNE 104281/85; cubierta
  «según NBE-QB-90 y CTE DB-HS-1». El pliego (anexo 1 «Código Estructural») cita la RC-16 y
  «sello o marca de conformidad oficialmente homologado» para el cemento.
- **Estructura**: «Actividad 1/2: actuación como laboratorio» (frases de oferta de laboratorio:
  «Analizados los datos que han sido facilitados se propone…»), materiales y ensayos
  obligatorios, complementarios, control final, presupuesto.
- **Valoración**: capítulo 16 «Control de calidad», 4 partidas (pruebas de suministro y
  evacuación, cuadro eléctrico, toma de tierra, estanqueidad de saneamiento) = **252,27 €
  (0,08 % del PEM)**. Son las E29SI010/020/030/160 de Precio Centro 2017 con un coeficiente
  oculto de 0,816 (47,34/58,00 = 58,55/71,73 = 87,83/107,60 = 0,816).
- **Incoherencias**: el texto prevé control de hormigón y armaduras («-previsto-»), ladrillos,
  morteros, láminas, «5 pruebas» de cubierta y «6 ensayos» de fachada; el presupuesto no tiene
  ninguno. El presupuesto sí tiene micropilotes (34,5 t), forjado reticular, acero S275 soldado y
  placas de anclaje: el plan dice «estructura metálica -no previsto-» y no habla de micropilotes.
- **Designaciones del presupuesto**: `HA-30/B/32/IIa` (EHE), `HA-30/F/20/CX1` (errata),
  `HA-25/F/20/X0` en losas armadas, `XC2`/`XD2` en una obra en primera línea de playa (la app
  debería al menos preguntar por XS).

### 1.6 `2025-011 ANEXO CC, PCT, IUM .pdf` (estudio, 2025)
- **Qué es**: «Control de calidad, instrucciones de uso y mantenimiento, pliego de condiciones»
  del proyecto de refuerzo de cimentación y reparación de tres edificios de una comunidad de
  propietarios en Málaga, agosto 2025, 273 pp. **Hecho con CYPE** (Arquímedes/Generador de
  precios: códigos ADE010, CSL010, LCL060, RPE005… y sufijos propios `_AVY`).
- **Base**: CE (RD 470/2021), CTE, RD 410/2010, Decreto 67/2011 de Andalucía, RC-16. En el pliego
  sigue el texto de CYPE con «Real Decreto 1630/1992… Directiva 89/106/CEE» para el marcado CE, y
  «NTE-FCL» como normativa de aplicación de las ventanas.
- **Estructura**: 1.1 normativa; 1.2 recepción (remite al pliego); **1.3 control de ejecución por
  unidad de obra, con la medición del presupuesto**: cada partida → fases → verificación, nº de
  controles («1 cada 250 m²», «1 por micropilote», «1 cada 25 unidades»), criterio de rechazo, y
  «pruebas de servicio» donde toca (carpintería); 1.4 obra terminada (remite al pliego y al
  «Estudio de programación del control» del DEO); 1.5 valoración.
- **Valoración**: dice que lo del constructor no se presupuesta (art. 11 LOE) y valora solo lo de
  laboratorio: «Ensayo de consistencia y resistencia del hormigón de un mismo lote» (XEH010)
  **4,00 × 23,73 = 94,92 €**. Sin cálculo de lotes (losa de cimentación 8,71 m³, muro 9,61 m³,
  hormigón de limpieza 44 m³, solera 511 m²) y nada de los 116 micropilotes.
- **Lo bueno**: el plan sale del presupuesto, partida a partida, con su medición. Es el único.
- **Lo malo**: las frecuencias no se multiplican por la medición («1 cada 250 m²» en una losa de
  8,71 m³; «1 cada 250 m²» en un guarnecido de 1,00 m²); entran demoliciones, transporte e
  implantación («1 por camión», «1 por contenedor»); no hay recepción documental por producto.

### 1.7 `PliegoCondiciones_CTE_v8_2025.doc`
- **Qué es**: pliego de condiciones «adaptado al CTE», versión 8 (creado 2022, versión 2025),
  remite al COA de Málaga para el depósito de la documentación. Es el
  pliego que usa la memoria de 2026.
- **Control de calidad**: art. 8 (el constructor tendrá el plan), art. 35 (los ensayos son de
  cuenta de la contrata; «el presupuesto del proyecto de ejecución debe especificar un capítulo
  correspondiente al plan de control de calidad»), anexo 1 Código Estructural («ver cuadro en
  planos»), RC-16 (RD 256/2016). Restos: clasificación de baldosas «AIIa/BIIb» (es de la UNE-EN
  14411, no de la EHE: no es error).
- **Valoración / lotes**: no. Genérico.

### 1.8 `MANUAL PARTICULAR PARA EL USO_WORD_REDUCIDO.doc`, `INSTRUCCIONESCOMPLEMENTARIAS_…doc`, `104_MEM MANUAL USO Y MANTENIMIENTO.pdf`
- Manual particular de uso, mantenimiento y conservación de viviendas (Orden de 30-11-2009 de la
  Junta), plantilla de 2011, y sus «instrucciones complementarias»; el 104 es esas instrucciones
  rellenas para la obra hostelera de 2026 (2018/2026). **No son planes de control.** Único punto de
  contacto: el «plan de mantenimiento de la estructura (EHE y CTE DB-SE)» con «clases de
  exposición» (rótulo EHE en un documento de 2026).

### 1.9 `20220519_manual_del_laborante.pdf`
- «Manual de control de calidad de los ensayos de hormigón, adaptado al Código Estructural»,
  Junta (JAFIOT/SGT-03-2022) con ALA y ANEFHOP, marzo 2022, 62 pp. Para el técnico de laboratorio:
  toma de muestras, cono, probetas, curado, errores, ficha de seguridad.
- Base: CE (dice que deroga EHE-08 y EAE), RD 163/2019 (control de producción en central).
- **Útil para la app**: el modelo de **hoja de suministro** con sus campos (central, certificado RD
  163/2019, DCOR sí/no, designación, cemento, a/c, aditivos, horas de carga/llegada/descarga,
  agua añadida en obra, firma del control de recepción). Es la lista de comprobación de la
  recepción documental del hormigón.
- Valoración / lotes: no.

### 1.10 `CE.pdf`
- «Guía para el entendimiento y aplicación de las Directivas de marcado CE», Consejería de
  Innovación, Ciencia y Empresa (Junta) con el CTC, 2006. **Nuevo Enfoque en general**
  (máquinas, baja tensión, juguetes…); la 89/106/CEE aparece solo en la lista de directivas. No es
  de construcción y está superada (RPC 305/2011). No sirve.

### 1.11 Bancos y obras de `docs\spike\samples\`
- **BCCA 2023** (`BCCA2023_V02.bc3`, Presto 22, FIEBDC-3/2020): capítulo 18 «Control de calidad,
  pruebas y ensayos», 354 partidas en 14 subcapítulos (§4). Los ensayos tienen `~D` a precios
  básicos del capítulo N («Análisis pruebas y ensayos») y `~T`. El fichero lleva además partidas
  en mayúsculas con fecha 17-10-16 (18UBB00060 SATE, 18UBB00070 cámara, 18UDA00040 blower door,
  CC009, CC010): parecen añadidas por el estudio, no de la BCCA.
- **Precio Centro 2017** (`centro2017_clasica.bc3`): capítulo E29, 452 partidas (§4.4).
- **CYPE** (`REC010…bc3`): el `~L` declara los apartados del pliego por unidad de obra, entre
  ellos **`PS` «Pruebas de servicio» y `EN` «Ensayos»**, pero esta muestra no trae el texto `~L`
  de la partida. Si el estudio exporta con pliego, el .bc3 de CYPE puede traer las pruebas y
  ensayos de cada unidad.
- **`obra ejemplo.bc3`** (Presto 8.7, vivienda unifamiliar «Espiga»): C17 «Control de calidad» =
  E29SI020 + E29SI030 + E29SI160 = 283,69 €; designaciones `HA-25/B/40/IIa`, `HA-25/P/20/I`,
  `HA-30/B/20/CX4`, `HA-25/B/20/CX4`, `CX1`, `CX2`, `CX2VERT` mezcladas con `XC2`.

### Tabla resumen

| Documento | Tipo | Fecha | Obra | Base hormigón | Marcado CE | Valoración | Lotes | Del presupuesto |
|---|---|---|---|---|---|---|---|---|
| Hoja Junta V03/V04 | herramienta de ensayos | 2022/2023 | plantilla | CE (+EHE-08 en encepados) | — | ensayos × precio | sí (AUX) | medición tecleada |
| PlanControlCalidad 2022 | plan tipo estructura | 2022 | plantilla | CE | (DdP) | no | tablas, sin cálculo | no |
| Cádiz 2007 | plan tipo | 2007 | ficticia (XX) | EHE | — | no (hoja VORSEVI) | sí, de otra obra | no |
| A3.061025 / -01 / -02 / -03 | prescripciones / COAAT Madrid | 2006-07 | — | EHE | 89/106, RD 1630/92 | no | no | no |
| 101 memoria | plan de proyecto | 2026 | sí | «CE» con contenido EHE-98 | 305/2011 en pliego | 4 pruebas, 0,08 % | no (N=2/4/6) | no |
| 2025-011 anexo | plan de proyecto (CYPE) | 2025 | sí | CE | 89/106 en pliego | 4 × 23,73 € | no | **sí (ejecución)** |
| Pliego v8 2025 | pliego | 2025 | genérico | CE, RC-16 | — | no | no | no |
| Manuales uso / 104 | manual de uso | 2011/2026 | sí (104) | «EHE» rótulo | — | — | — | — |
| Manual laborante | manual de ensayo | 2022 | — | CE | — | — | — | — |
| CE.pdf | guía marcado CE | 2006 | — | — | Nuevo Enfoque | — | — | — |

---

## 2. Errores repetidos, citas derogadas y lo que la app no debe poder producir

### 2.1 Lo que se repite

1. **Plantilla arrastrada sin adaptar**: la memoria de 2026 copia la de Cádiz 2007 (mismas frases,
   mismas normas, misma lámina «UNE-104281-6-6/85»); Cádiz trae la losa de 574 m³ de otra obra;
   los manuales llevan «A rellenar por el proyectista».
2. **Etiqueta nueva sobre contenido viejo**: «Cod. Estructural» encima del esquema de la EHE-98
   (N = 2/4/6 por fck, 4 probetas a 7 y 28 días, 40 t por lote de acero).
3. **Texto y presupuesto desconectados**: el plan describe ensayos que el presupuesto no paga, y el
   presupuesto paga pruebas que el plan no cuenta. En los tres trabajos del estudio el capítulo de
   control está entre 0,03 % y 0,08 % del PEM y **no tiene ensayos de hormigón aunque la obra los
   tiene**.
4. **Número sin cálculo**: «4 ud de un mismo lote», «1 control», «2 muestras», «5 pruebas»,
   «6 ensayos» sin medición ni tamaño de lote; o frecuencia sin número (CYPE).
5. **Precio sin unidad clara**: 23,73 € por «ensayo de consistencia y resistencia de un mismo lote»
   (CYPE), 59,28 €/«ud» (Junta/BCCA, ¿amasada o probeta?), 126,33 € por amasada de 2 probetas y
   63,82 € por probeta (Centro). Mezclarlos multiplica o divide el coste por 2.
6. **Normas de ensayo derogadas o sustituidas** (UNE de 1973-1999 sustituidas por UNE-EN).
7. **Nomenclatura EHE de exposición** en textos y en las designaciones de las partidas.
8. **Normativa de otra comunidad**: Ley 2/1999 de Madrid (A3-02); DRC 06/09 de la Generalitat
   Valenciana como referencia de la prueba de cubierta (Junta y BCCA).
9. **Lenguaje de oferta de laboratorio** dentro del plan del proyectista («actuación como
   laboratorio», «Empresa Auditora del Control», nombre de una entidad concreta).
10. **Partidas sin control dentro del plan** (CYPE: implantación, transporte, contenedores) y
    **partidas con control fuera** (micropilotes, acero laminado, forjado reticular).
11. **Recepción documental reducida a una frase** («se exigirá el marcado CE») sin productos.

### 2.2 Citas derogadas o de otra época encontradas (documento → frase corta)

| Cita | Dónde |
|---|---|
| EHE / EHE-08 / CC-EHE / tabla 95.1.a | A3.061025 («Según EHE Instrucción de hormigón estructural»), A3-03, Cádiz («Adaptación tabla 95.1.a de la EHE»), hoja Junta (AUX: «según la EHE-08»; cap. 03 fila 65), 104 («EHE y CTE DB-SE»), Centro E29 (44 partidas, «CONFORMIDAD … EHE-2008») |
| Esquema EHE-98 (N = 2/4/6, 7 y 28 días, 40 t) | 101 memoria, Cádiz |
| RD 1630/1992 y Directiva 89/106/CEE | A3-02, 2025-011 (pliego CYPE), CE.pdf |
| DITE, Sello INCE, CCRR, «Ministerio de la Vivienda» | A3-02 |
| RC-03 | A3-02 |
| RL-88, RB-90, RY-85, NBE-FL-90, NBE-QB-90 | A3-02, Cádiz, 101 memoria |
| NTE-RPE, NTE-RSR, NTE-IFF/IFC/ISS/IET/IES, NTE-FCL como «normativa de aplicación» | Cádiz, 101, 2025-011 |
| Ley 2/1999 de la Comunidad de Madrid | A3-02 |
| UNE 83300/84, 83301/91, 83303/84, 83304/84, 83313/90, 83309:90 EX | 101, Cádiz, A3.061025 |
| UNE 7474, 7262, 36068/94, 36088, 36096/96, 36462/80 | 101, Cádiz |
| UNE 67026/27/29/30/31/39 (ladrillo) | 101, Cádiz |
| UNE 104281-6-x/85, 104242/89 (láminas) | 101, Cádiz |
| UNE 53112/88, 53020/73, 53301, 53215 | Cádiz |
| UNE 7014:1950 | BCCA 18SPP00010 |
| «clases generales de exposición» / «III o IV» | Junta (cap. 03 filas 27 y 29), BCCA 18HHL00030 |
| Clases EHE en partidas (`IIa`, `I`) y erratas (`CX1`, `CX4`, `XC2a`) | 101 presupuesto, `obra ejemplo.bc3` |
| PPTP MOPU-74 y MOPU-86 | Junta cap. 08 |
| UNE-EN 13829:2002 (junto a la ISO 9972:2019) | Junta cap. 08 fila 138 |

### 2.3 Criterios para tests (K-PCC.50 en adelante)

Los valores concretos (tamaños de lote, N, plazos) los fija el verificador del Código; estos
criterios dicen **qué no puede salir** y **qué tiene que estar**.

- **K-PCC.50 — Lista negra de normativa.** El texto generado no contiene: EHE, EHE-08, EHE-98,
  CC-EHE, EFHE, EAE, RC-03, RC-08, RD 1630/1992, 89/106/CEE, DITE, Sello INCE, NBE-*, RL-88,
  RB-90, RY-85, Ley 2/1999 (Madrid), «Ministerio de la Vivienda». Test: generar el plan de las
  dos obras de ejemplo y buscar las cadenas.
- **K-PCC.51 — Normas de ensayo sustituidas.** No contiene UNE 83300, 83301, 83303, 83304, 83313,
  83309, 7474, 7262, 7014, 36068/94, 36088, 36096, 36462, 67026-67039, 104281, 104242/89, 53112,
  53020 ni UNE con año anterior a la UNE-EN equivalente que use la hoja de la Junta. Test: lista
  negra por regex.
- **K-PCC.52 — Nomenclatura de exposición.** No escribe clases EHE (I, IIa, IIb, IIIa-c, IV,
  Qa-c, H, F, E) ni «clases generales/específicas». Una designación de hormigón de una partida
  con clase no válida (`IIa`, `CX1`, `CX4`, `XC2a`, `X0` en armado) produce un aviso en la
  partida y no se usa para disparar ensayos hasta que se corrija o confirme. Test: las 12
  designaciones de `obra ejemplo.bc3` y las 9 de la memoria de 2026.
- **K-PCC.53 — Hormigón estructural ⇒ ensayos de hormigón.** Si el presupuesto tiene partidas de
  HA/HP (o HM de uso estructural) y el plan no declara control al 100 % ni indirecto, la
  valoración tiene compresión y consistencia con nº de amasadas > 0. Test: la memoria de 2026 y
  `obra ejemplo.bc3` no pueden salir con 0 ensayos de hormigón.
- **K-PCC.54 — Número trazable.** Cada fila de la valoración muestra medición del presupuesto,
  regla de lote, nº de lotes y nº de ensayos (`ceil(medición / lote) × n`), o la marca «a juicio
  de la DF» con cantidad 0 y nota. Prohibido un número sin regla. Test: todas las filas tienen
  regla o marca.
- **K-PCC.55 — Lotes de hormigón con todos los criterios.** El cálculo de lotes usa volumen,
  tiempo, superficie y nº de plantas de la tabla de lotes; caso de prueba: pilares de 3 plantas,
  20 m³, 400 m² → 2 lotes (no 1, que es lo que da la hoja de la Junta V03/V04).
- **K-PCC.56 — Nada se pierde por falta de dato.** Un hormigón sin tipo (convencional /
  autocompactante) cuenta como convencional con aviso; nunca desaparece del total (fallo SUMIF de
  la hoja). Test: fila sin tipo → amasadas > 0.
- **K-PCC.57 — Redondeo hacia arriba** de lotes, amasadas, tomas y visitas (la hoja da 2,4 tomas
  para 12 pilotes). Test: ningún número de ensayos fraccionario.
- **K-PCC.58 — Caso con distintivo (DCOR).** La app calcula también el caso de hormigón con
  distintivo, que la hoja de la Junta excluye; el usuario elige «con / sin distintivo» y el plan lo
  dice. Test: mismo presupuesto con y sin DCOR da lotes distintos y los dos tienen ensayos.
- **K-PCC.59 — Durabilidad por clase y tipo, no por volumen.** Penetración de agua y aire ocluido
  se generan por tipo de hormigón (dosificación) con clase que lo pida, al inicio y por periodo de
  suministro; un mismo tipo no se cuenta dos veces aunque tenga dos clases (la hoja suma
  `O330 + O331`). Test: HA-30/B/20/XS1+XF2 → un tipo, no dos.
- **K-PCC.60 — Unidad del precio.** Cada ensayo guarda en qué se mide (amasada / serie de N
  probetas / probeta / visita / lote / tramo) y la valoración no mezcla unidades. Test: compresión
  BCCA 59,28 €/ud y Centro 63,82 €/probeta no pueden sumarse en la misma fila.
- **K-PCC.61 — Texto ↔ valoración.** Todo ensayo o prueba de laboratorio descrito en el texto está
  en la valoración y viceversa. Test: diff de las dos listas vacío.
- **K-PCC.62 — Cobertura de familias con control obligatorio.** Si hay partidas de acero para
  armar (barras, mallas), acero laminado, micropilotes, pilotes, pantallas o madera estructural,
  el plan tiene recepción y ensayos de esa familia. Test: la memoria de 2026 (micropilotes, S275) y
  el anexo 2025 (116 micropilotes) no pueden salir sin ellos.
- **K-PCC.63 — Frecuencia convertida en número y con unidad compatible.** Un control «1 cada
  250 m²» se convierte en `ceil(medición/250)`, mínimo 1; si la partida no está en m² (losa en
  m³), aviso y conversión pedida, no un texto. Test: CSL010 8,71 m³ del anexo 2025.
- **K-PCC.64 — Porcentajes con mínimo 1 y agrupación por visita** (pruebas de servicio: 20 % de
  viviendas, 5 viviendas por visita). Test: unifamiliar → 1 prueba y 1 visita; 23 viviendas →
  5 pruebas, 1 visita.
- **K-PCC.65 — Sin marcadores de plantilla**: «XX», «A rellenar», «……», nombres de laboratorios o
  entidades concretas, «actuación como laboratorio». Test: regex sobre la salida.
- **K-PCC.66 — Sin mediciones de otra obra.** Toda cantidad del plan viene del presupuesto de la
  obra o de un dato de proyecto declarado (superficie construida, nº de plantas, nº de viviendas).
  Test: con presupuesto vacío, el plan sale sin cantidades y con avisos.
- **K-PCC.67 — Precio con fuente y fecha.** Cada precio unitario dice de dónde viene (BCCA 2023
  cap. 18, hoja de la Junta 2022/2023, Centro, propio) y no lleva coeficientes ocultos. Test: la
  valoración muestra la fuente; el 0,816 de la memoria de 2026 sería visible.
- **K-PCC.68 — Textos de banco filtrados.** Un `~T` importado (BCCA, Centro) pasa por K-PCC.50-52
  antes de entrar en el plan; si falla, se usa el texto propio de la app y se avisa. Test:
  18HHL00030, 18HHL00020 y E29HH080.
- **K-PCC.69 — Tres partes siempre.** El plan tiene recepción (documental, distintivos, ensayos),
  ejecución y obra terminada, aunque los ensayos vengan de la hoja de la Junta, que solo cubre
  ensayos y pruebas de servicio. Test: las tres secciones con contenido para una obra con
  estructura de hormigón.
- **K-PCC.70 — Partidas sin control no generan ruido.** Implantación, transporte, contenedores,
  alzadas de seguridad y gestión de residuos no generan filas de control (CYPE sí). Test: el
  capítulo de residuos no aparece en el plan.
- **K-PCC.71 — Normativa de otra comunidad.** No se presenta como aplicable normativa de otra
  comunidad; un procedimiento de referencia (DRC 06/09) se puede citar como procedimiento, no como
  norma. Test: no aparece «Comunidad de Madrid»; el DRC aparece solo con la palabra
  «procedimiento».
- **K-PCC.72 — Aviso de emplazamiento costero.** Si la obra está marcada como próxima al mar y
  ninguna partida tiene clase XS, aviso «revisar la clase de exposición» (no decide la clase).
  Test: la obra hostelera de 2026.

---

## 3. La hoja de la Junta (V03 = V04 en datos)

### 3.1 Hojas de capítulo: columnas

Fila 1-3 de cabecera; desde la 4, capítulo, apartados (texto en la columna C con numeración
«6.1», «6.1.1») y filas de ensayo (columna A con el nivel 1/2/3). Columnas (en la hoja 03 hay una
columna D/E de «Observaciones» doble y todo se desplaza una a la derecha):

| Col. (03) | Col. (resto) | Campo | Contenido |
|---|---|---|---|
| A | A | Nivel de control | 1 = obligatorios + básicos (sin color), 2 = complementarios (verde), 3 = singulares (salmón) |
| B | B | Código DR | código de la «Relación de ensayos declarados» de la Junta (OLA, OLB, OLC, OLD, EF, EH, EA, EM, PS); 448 de 752 filas lo tienen |
| C | C | Ensayo | nombre |
| D-E | D | Observaciones | llamadas `*`, `**` |
| F | E | Norma o procedimiento | UNE-EN / NLT / CTE / PG-3 |
| G | F | Nº | ensayos por lote |
| H | G | Tamaño de lote | número, «Tipo», «Procedencia», «Día», «*», «-», o referencia a la hoja AUX |
| I | H | Ud | unidad del lote (m², m³, t, Tubo, «n.º de viviendas / ud. de uso», «Edificio»…) |
| J | I | Medición | **la teclea el usuario** (vacía = 0 ensayos) |
| K | J | Nº de ensayos | fórmula (§3.2) |
| L | K | Precio unitario | `='Precios unitarios recomendados'!E…` (743 filas; 7 fijos) |
| M | L | Importe | `= nº × precio` |
| N | M | Observaciones | condiciones de aplicación |

Al pie de cada hoja, el total del capítulo `=SUM(importe)`. **No filtra por nivel**: suma todo lo
que tenga medición; el nivel solo sirve para que el usuario elija qué rellenar. La regla de uso de
la introducción: PEM < 300.000 € → nivel 1 y lo que se crea necesario de 2 y 3; PEM > 300.000 € →
niveles 1 y 2 y lo necesario de 3.

**Ensayos por capítulo y nivel** (filas; entre paréntesis, ensayos distintos por nombre y norma):

| Hoja | N1 | N2 | N3 | Total |
|---|---|---|---|---|
| 02 Acondicionamiento del terreno | 69 (30) | 5 (2) | 28 (21) | 102 |
| 03 Cimentación y estructuras | 83 (57) | 35 (33) | 21 (21) | 139 |
| 06 Cerramientos y particiones | 1 (1) | 19 (18) | 10 (10) | 30 |
| 07 Cubiertas | 0 | 12 (12) | 10 (10) | 22 |
| 08 Instalaciones y pruebas de servicio | 48 (48) | 7 (7) | 38 (30) | 93 |
| 09 Aislamientos | 13 (12) | 0 | 5 (4) | 18 |
| 10 Revestimientos | 55 (55) | 19 (19) | 16 (15) | 90 |
| 11 Carpintería y vidrios | 3 | 3 | 5 | 11 |
| 13 Pinturas | 24 (8) | 8 (2) | 0 | 32 |
| 15 Urbanización | 123 (77) | 15 (11) | 77 (51) | 215 |
| **Total** | **419** | **123** | **210** | **752** |

401 ensayos distintos (por nombre y precio). Los apartados 15.1-15.7 repiten 2.1-2.7 (102 filas).
Lo que hay dentro:
- **02/15**: terreno natural, terraplén (suelo natural y RCD), estabilización con cal y cemento,
  geotextiles, escolleras, zahorras; 15 añade suelo-cemento, grava-cemento, hormigón compactado,
  pavimentos de hormigón, mezclas bituminosas, microaglomerados, adoquines, baldosas, bordillos.
- **03**: hormigón convencional (durante el suministro: compresión y asentamiento desde la AUX;
  información complementaria: testigos, esclerómetro, ultrasonidos, prueba de carga, a juicio de
  la DF), autocompactante (característicos y durante el suministro), durabilidad (aire ocluido,
  penetración de agua), micropilotes (lechada por día, tubos por 100 ud), pilotes y pantallas
  (integridad sónica, transparencia, lodos), barras corrugadas, mallas, acero activo, perfiles
  (química, tracción, resiliencia, espesor por 20 t si > 100 t), soldaduras (inspecciones por
  ½ jornada por 40-80 t), protección anticorrosiva y contra fuego, par de apriete, madera
  (aserrada, tableros, laminada), fábrica estructural (ladrillo, mortero, ensayo de muro),
  bovedillas.
- **06**: ladrillo, bloque cerámico, bloque de hormigón, mortero, PYL, perfilería, placas de
  fachada (con adherencia de anclajes).
- **07**: tejas cerámica y de hormigón, láminas bituminosas y sintéticas, hormigón celular.
- **08**: pruebas de funcionamiento de saneamiento, abastecimiento, fontanería, BT, MT, solar,
  climatización, ventilación, extracción, PCI, riego, piscinas, CO, alumbrado, pararrayos, telecom,
  gas, ascensores, gases medicinales; materiales de tubería; **8.2 pruebas de servicio sobre la
  obra: acústica, estanqueidad de cubiertas, fachadas y ventanas, barandillas, eficiencia
  energética (blower door, termografía, transmitancia)**.
- **09-13**: aislamientos por tipo, revestimientos por tipo de suelo/pared/techo, carpintería
  exterior e interior, vidrios, pinturas por tipo.

### 3.2 Reglas de lote: tipos programables (752 filas)

| Tipo | Filas | Fórmula de la hoja | Cómo programarlo |
|---|---|---|---|
| **A. Por medición** (m³ 144, t 42, m² 53, m 3, tubos, pilotes, anclajes) | 253 | `ROUNDUP(med/lote)×n` | medición de las partidas de la familia en la unidad del lote; si la unidad no casa, conversión o aviso |
| **B. Porcentaje de unidades** (10-20 % de viviendas, tramos, bajantes, montantes; 5 % de ventanas) | 24 | `ROUNDUP(med×%)×n`; 12 filas agrupan por visita: `IF(med=0;0;MAX(1;ROUNDUP(med×%×n/5)))` (/10 en videoporteros) | dato de proyecto (nº de viviendas o equivalencia por m² en otros usos) o recuento de partidas (bajantes, ventanas en ud) |
| **C. Uno por instalación / edificio / central** (grupo de presión, caldera, central de detección, cubierta, edificio, transformador, recinto de instalaciones) | 31 | `ROUNDUP(med×1)×n` | 1 si existe la familia en el presupuesto; nº de equipos si la partida está en ud |
| **D. Por tipo de producto** («Tipo» 307, «Tipo y diámetro» 26, «Tipo acero» 8, «Por tipo» 3, tipología, tipo de anclaje) | 348 | `med×n` (la medición es el nº de tipos) | **nº de productos distintos de la familia**: distintos básicos de la `~D` (BCCA) o distintas partidas; diámetros distintos para tubos |
| **E. Por procedencia o fracción** (suelos, áridos) | 49 | `med×n` | dato a pedir (nº de procedencias; por defecto 1, como dice la propia hoja) |
| **F. Por día o mes de trabajo** (lechadas, lodos, diagrafías) | 17 | `med×n` | dato de planificación (días de micropilotes/pilotes): se pide o se estima del rendimiento |
| **G. Del cálculo de amasadas** (hormigón, pilotes, pantallas, durabilidad) | 21 | referencia a la AUX; consistencia = compresión; anillo japonés = escurrimiento/4 | §3.3 |
| **H. A juicio de la DF** (testigos, esclerómetro, ultrasonidos, prueba de carga) | 4 | `med×n` con lote «*» | fila opcional con cantidad 0 por defecto y nota |
| **I. Exigencia documental sin cuantía** (cualificación de soldadores e inspectores) | 5 | sin fórmula | va a la recepción documental, no a la valoración |

Por nivel: A es sobre todo nivel 1 (177 de 253); D se reparte (132 / 76 / 140); B y C son
pruebas de servicio de nivel 1.

### 3.3 Hoja «03_C_y_E_AUX_CALC AMASADAS» — algoritmo (fórmulas leídas con Excel)

Solo hay valores en el volcado; las fórmulas están en `scripts\PlanCC_formulas.txt` y agrupadas
en `scripts\aux_patterns.txt`. Instrucciones de la hoja: excluye hormigón con distintivo (DCOR) y
con dispersión certificada; no calcula «más allá de los periodos de tiempo» de la tabla 57.5.4.1;
cimentación profunda según EHE-08 y UNE-EN.

**Parte 1, resistencia.** Un bloque por tipo de elemento de la tabla 57.5.4.1 (5 filas cada uno).
Entradas por fila: A elemento (texto), B categoría «fck < 50» / «fck ≥ 50», C «C» / «AC»,
D volumen (m³), K superficie construida (m²) o nº de elementos. Salidas: S nº de lotes, T nº de
amasadas. Con `m = 6 si fck ≥ 50, si no 3` (`4` en pilas y tableros):

| Bloque (filas) | Lotes por volumen | Lotes por elemento/superficie | Amasadas |
|---|---|---|---|
| Cimentación > 200 m³ (26-30) | E = 1 (constante, 1 elemento) | M = K (nº elementos) | `MAX(ceil(V/35), m·E, m·M)` |
| Cimentación < 200 m³ (44-48) | `E = ceil(V/100)` | — | `m·E` |
| Vigas, forjados, losas (62-66) | `E = ceil(V/100)` | `M = ceil(S/1000)` | `MAX(m·E, m·M)`; lotes = el que manda |
| Losa de marcos (80-84) | `ceil(V/200)`, `ceil(V/30)` | K | civil |
| Muros portantes (98-102), pilares (116-121), otros a compresión (207-211) | `E = ceil(V/100)` | `M = ceil(S/500)` | `MAX(m·E, m·M)` |
| Pilas, tableros, soleras y contrabóvedas de túnel (135-247) | 50/100/300/600 m³ | pilas, vanos, 50 m, fases | civil |

Totales: `E255 = Σ T` de las filas con C = «C»; `E256 = Σ T` con C = «AC» (`SUMIF`). El cap. 03
toma `compresión = E255` (59,28 €), `asentamiento = compresión` (17,26 €), y para AC
`compresión = E256`, `escurrimiento = E256`, `anillo japonés = E256/4`.

**Cimentación profunda.**
- Pilotes in situ (UNE-EN 1536): inicio de unidad = 3 tomas de docilidad y 3 de resistencia por
  estructura (`A266×3`); durante la ejecución, docilidad `ceil(V/10)`, resistencia 1 por pilote
  (≥ C35) o **`K/5` sin redondear** (< C35), menos las tomas de inicio, mínimo 0.
- Encepados: «según EHE-08», lote 100 m³, nº de amasadas 3 a 6 tecleado; con el valor por defecto
  «3 a 6» (texto) las fórmulas dan 0.
- Muros pantalla (UNE-EN 1538): resistencia `MAX(3·días, 3·ceil(V/100))`; docilidad
  `ceil(paneles/1)` + las de resistencia.

**Parte 2, durabilidad.** Fila 330 (XF2, XF4) y 331 (XA, XS, XD, XF, XM). Entradas: nº de tipos
de hormigón y nº de semestres de suministro. Aire ocluido (solo 330): inicio = tipos, durante =
tipos × semestres. Penetración de agua: inicio = tipos, durante = tipos × semestres, en 330 y en
331, y el cap. 03 **suma las dos filas** (un tipo XF2 + XS se cuenta dos veces).

**Fallos que la app no debe copiar** (todos en V03 y V04):
1. No aplica el límite de plantas ni el de tiempo (2 semanas, 1 semana) de la tabla: solo volumen
   y superficie. Pilares de 3 plantas, 20 m³, 400 m² → 1 lote y 3 amasadas.
2. Fila sin «C/AC» → sus amasadas no entran en ningún total.
3. `K/5` sin redondear en pilotes.
4. Encepados con la EHE-08 y 0 por defecto.
5. Rama muerta `IF(V/35 > 105; V/35; …)` en cimentaciones > 200 m³ (resto de la fórmula con
   distintivo, sin efecto porque `ceil(V/35)` ya está en el MAX).
6. Bloque > 200 m³ con «1 lote» constante: no reparte por elementos de vertido continuo.
7. Ningún caso con distintivo (DCOR) ni con dispersión certificada.
8. La superficie construida y el nº de plantas no están en el presupuesto: los tiene que dar el
   proyecto.

Ejemplo con las fórmulas de la hoja (solo para ver el orden de magnitud, sin DCOR):
unifamiliar de 2 plantas con zapatas 40 m³, forjados 45 m³ / 300 m², pilares 5 m³ → 3 + 3 + 3 =
9 amasadas × (59,28 + 17,26) = 688,86 €; plurifamiliar de 6 plantas con losa de 400 m³ (un
elemento), forjados 450 m³ / 3.000 m², pilares y muros 120 m³ / 3.000 m² → 12 + 15 + 18 = 45
amasadas = 3.444,30 €. Frente a 0 € de hormigón en los presupuestos del estudio.

### 3.4 «Precios unitarios recomendados» y «Resumen»

- **Precios**: columnas código DR | ensayo | obs. | norma | precio, ordenadas por los mismos
  capítulos y apartados que las hojas de capítulo (cada fila de capítulo apunta a «su» fila de
  precios). 737 filas con precio: 388 con valor propio y 349 que repiten otro precio de la misma
  hoja (gris = primera aparición, verde = dependiente); 187 códigos DR distintos; 237 filas sin
  código; de 0 a 1.200 € (prueba de carga de forjado). Origen: AOPJA y mercado, 2022; **sin
  cambios en la V04**. Unidades: casi todo «ud ensayada»; las visitas son de ½ jornada (392 €) o
  jornada (650 €).
- **Resumen**: 17 capítulos con la numeración de la BCCA (1 demoliciones, 14 equipamiento, 16
  residuos, 17 seguridad: «no se aplica»; 4 saneamiento → ver 08; 5 estructuras → ver 03; 12
  vidrios → ver 11) y el total. Ni % del PEM, ni GG, BI o IVA.

### 3.5 Qué partes del plan cubre

| Parte del plan (CTE art. 7) | ¿En la hoja? |
|---|---|
| Recepción: control documental (hojas de suministro, DdP, marcado CE) | **No** (solo llamadas «si no posee distintivo») |
| Recepción: distintivos de calidad | Solo como condición de exclusión (AUX, acero) |
| Recepción: ensayos | **Sí** — es su objeto |
| Control de ejecución por el DEO (replanteo, encofrado, armado, vertido, curado…) | **No** |
| Inspecciones de ejecución por laboratorio | Parcial: soldaduras, par de apriete, despieces, chorreado, acopios de tubos, micraje |
| Obra terminada: pruebas de servicio | **Sí** (cap. 08, 8.1 y 8.2) |
| Valoración | Sí, de lo anterior |

---

## 4. Enlace con la BCCA 2023

### 4.1 Capítulo 18

354 partidas (14 subcapítulos): instalaciones 72, baldosas y revestimientos 68, cerámicos y
bloques 32, áridos y suelos 27, cimentación 25, acero 24, madera 21, pruebas de servicio 18,
aislamientos e impermeabilizaciones 17, morteros/yesos/cementos 14, hormigón 13, carpintería y
vidrios 11, pinturas 10, fábrica 2. Unidad «ud»/«u» (322), m³ 13, alguna en m/m². 342 con `~T`,
345 con `~D` a básicos del capítulo N. La BCCA reorganiza por material (18A, 18B, 18C…) y no por
capítulo de obra como la hoja.

### 4.2 Emparejamiento hoja ↔ BCCA (sobre la V04)

Criterio: precio igual con tolerancia ±0,5 % (la BCCA redondea las visitas: 392,01 y 650,04
frente a 392 y 650) y semejanza de nombre (Jaccard de palabras ≥ 0,12); si no, nombre solo
(≥ 0,34); si no, «solo precio» (a revisar) o nada.

| Hoja | Filas | Precio + nombre | + nombre solo | Solo precio (dudoso) | Sin pareja |
|---|---|---|---|---|---|
| 02 | 102 | 91 % | 99 % | 0 | 1 |
| 03 | 139 | 57 % | 65 % | 31 | 18 |
| 06 | 30 | 73 % | 77 % | 5 | 2 |
| 07 | 22 | 68 % | 73 % | 6 | 0 |
| 08 | 93 | 92 % | 96 % | 4 | 0 |
| 09 | 18 | 61 % | 61 % | 7 | 0 |
| 10 | 90 | 96 % | 97 % | 3 | 0 |
| 11 | 11 | 100 % | 100 % | 0 | 0 |
| 13 | 32 | 69 % | 69 % | 10 | 0 |
| 15 | 215 | 73 % | 82 % | 17 | 21 |
| **Total** | **752** | **77 %** (582) | **83 %** (627) | 83 | 42 |

Por ensayo distinto (401): 72 % fuerte, 77 % con nombre. 274 de las 354 partidas de la BCCA casan
con algún ensayo.

Ejemplos que casan: compresión 59,28 = 18HHL00010; asentamiento 17,26 = 18HHL00020;
penetración 151,45 = 18HHL00030; esclerómetro y ultrasonidos 210 = 18HHI00020/30; testigos
180 = 18HHI00040; prueba de carga 1.200 = 18HHI00010; Próctor modificado 106 = 18ALF00070;
densidad in situ 17,36 = 18ASS00010; transparencia sónica 226,8/289,8/346,5 = 18CPI00010/20/30;
prueba de cubierta plana 210 = 18UBB00010; blower door 750 = 18UDA00010.

«Solo precio»: revisados a mano, **la mitad son falsos** (composición química del acero 210 €
→ «compresión simple 7 días» 18ALF00090; resistencia mecánica de bovedillas 95 € → «resistencia
química de baldosa» 18BBC00040; puesta en carga de anclaje 500 € → «compresión en muros de
fábrica»). Los otros son buenos con nombres distintos (heladicidad, densidad de lodos, espesor de
poliuretano).

Sin pareja (42): **todo el acero para armar** (características geométricas 50/42,6, tracción
60,66, doblado 35,09, despegue de nudos 25,3), aire ocluido 66, anclajes (idoneidad 950),
radiografías 600, valores característicos de madera 270, geotextiles 55, fórmulas de trabajo de
suelo-cemento y grava-cemento 857, casi todo lo de mezclas bituminosas y filler, macrotextura,
dimensiones de adoquín, y las cinco exigencias de cualificación (sin precio). En la otra
dirección, la BCCA tiene 80 partidas sin ensayo de la hoja (sobre todo variantes de instalaciones,
madera, baldosas y las añadidas del estudio).

**Conclusión**: la BCCA sirve como fuente de código y precio de la mayoría de ensayos, pero el
enlace tiene que ser una **tabla curada** (ensayo de la app → código BCCA, o «sin código»), con el
acero corrugado y el aire ocluido como partidas propias de la app.

### 4.3 Normativa en los `~T` de la BCCA 18

Busqué EHE, «clases generales», clases EHE, Código Estructural, CTE, NBE/NTE, RC, UNE 83xxx,
UNE 7xxx/36xxx, RITE/REBT, PG-3, lote:
- **18HHL00030** penetración de agua: «clases generales de exposición III o IV, o cuando presente
  cualquier clase específica» (EHE) junto a «capítulo 13 del Código estructural».
- **18HHL00020**: el resumen dice «asentamiento en hormigón **endurecido**» y el texto «como mínimo
  de 5 ensayos».
- **18HHL00010** compresión: «mediante programa PROBETHA 08» y «apartado 57.3.2 del Capítulo 13».
- **18SPP00010/30/40**: UNE 7014:1950 y otras UNE antiguas para el acero de perfiles.
- **18UBB00010**: «DRC 06/09 de la Generalitat Valenciana».
- **18CMM00010** (micropilotes): «lechadas para tendones de pretensado», UNE-EN 445.
- **18SPP00100** «Inspección previa a soldadura realizada por técnico»: precio 0.
- Ninguna cita «EHE» literal; 2 citan el Código Estructural; 27 el CTE.

### 4.4 Precio Centro 2017, E29

452 partidas: obras de fábrica 186, hormigón 87, geotecnia 49, pruebas de servicio 48,
instalaciones 21, acero 20, carpintería 17, madera 11, recubrimientos 11, salubridad 2.
**44 citan la EHE-08** («CONFORMIDAD ÁRIDOS/CEMENTOS/ACEROS EHE-2008», «control durante el
suministro, s/EHE-08») y ninguna el Código. Tiene lo que le falta a la BCCA (barras: «ENSAYO LOTE 2
BARRAS ACERO» 217 €, tracción, doblado, geometría; amasada de hormigón 126,33 € con 2 probetas y
consistencia; probeta suelta 63,82 €), pero precios de 2017 y textos EHE. E29HH200 «LOTE CONTROL
HORMIGÓN 2 PROBETAS» se describe como «ensayo característico… antes del suministro» (nombre y
texto no casan). Con la hoja de la Junta casa solo por nombre (precios distintos). Es de donde
salen las pruebas de servicio de los presupuestos del estudio.

### 4.5 CYPE

`REC010…bc3` no tiene ensayos, pero su `~L` declara los apartados `PS` (pruebas de servicio),
`EN` (ensayos), `PEF` (fases), `PEC`, `CMO`, `CVE`: CYPE puede exportar por partida lo que el
anexo de 2025 imprime (verificaciones, nº de controles, criterios de rechazo, pruebas de
servicio). Hay que pedir al estudio un .bc3 exportado **con pliego** para ver si llega relleno.

---

## 5. Qué partidas disparan cada control

Cómo reconocer la familia: como en `src\core\rcd\reglas.ts` — texto de la partida en minúsculas y
sin tildes (`textoDe`), unidad normalizada, y prefijo de código de banco conocido (BCCA por
capítulo de 2 cifras + letras, Precio Centro `E0x…`, CYPE por familia de 3 letras). Igual que en
residuos: la regla deja una **propuesta** con motivo; el usuario confirma. Hormigón: además hay
que leer la designación `HA-25/B/20/XC2` (tipificación, consistencia, árido, clase) para los
tipos, el autocompactante (`AC`) y la durabilidad (K-PCC.52).

Los prefijos BCCA y Centro están comprobados en los .bc3 de `docs\spike\samples\`; los de CYPE
salen del anexo de 2025 (ADE, ADR, ANS, CSL, CHH, EHL, EHM, FFF, FFQ, FFX, FBY, LCL, LVI, QAF,
RAG, RPE, RPG, RQO, RSB, RSG, RSI, UDH, UVM, UXT, GTA, GRA) y el resto (CSZ, EHS, EHV, EAS, IFI,
IEI…) son de memoria del Generador de precios: confirmar con un .bc3 de CYPE antes de usarlos.

Leyenda: Doc = recepción documental (hoja de suministro, DdP/marcado CE, distintivo, certificados);
Ej = control de ejecución (DEO, con frecuencia); OT = obra terminada / prueba de servicio;
Ens = ensayos de la hoja de la Junta (apartado) con regla de lote; U = unifamiliar, P = plurifamiliar.

| Familia | Reconocerla (BCCA · Centro · CYPE · texto · ud) | Doc | Ej | OT | Ens (Junta) y lote | U / P |
|---|---|---|---|---|---|---|
| Hormigón estructural | `03H`, `05H`, `05F` · `E04C/E04L/E04M/E04S…`, `E05H` · `CSZ`, `CSL`, `CHH`, `EHS`, `EHV`, `EHL`, `EHM`, `EHU`, `EHR` · `\bh[ap]-\d\d\/` · m³ (forjados en m²) | hoja de suministro por camión, certificado de la central (RD 163/2019), DCOR sí/no, certificado final | replanteo, encofrado, armado, vertido, curado, desencofrado (lotes de ejecución por 250 m² / 2 plantas / 50 m de muro) | prueba de carga solo a juicio de la DF | 03.01.01: compresión + consistencia por amasada (AUX: volumen, superficie, **plantas, tiempo**); 03.01.03 durabilidad por tipo y clase | U: 9 amasadas típicas; P: 40-60 |
| Hormigón autocompactante | `/ac-` o «autocompactante» en la designación | idem | idem | — | 03.01.02: característicos por tipo; escurrimiento por amasada, anillo japonés 1/4 | raro en U |
| Hormigón de limpieza, rellenos HM-15/20 no estructural | «limpieza», «nivelacion», HM sin función estructural | hoja de suministro | espesor, cota | — | ninguno | U y P |
| Acero para armar (barras) | `03AC`, `05HA` · `E04AB` · `EHA`, «acero b ?500 ?s» · kg | DdP / distintivo, certificado de adherencia, trazabilidad | despiece, montaje, recubrimientos (punto de parada antes de hormigonar) | — | 03.01.06: geometría, doblado, tracción, 2 por lote de 30 t por serie de diámetros (sin distintivo); química > 300 t | U: 1-2 lotes; P: 3-10 |
| Mallas electrosoldadas | `03AM` · `E04AM` · «malla(zo)? electrosoldad» · m², kg | idem | solapes, calzos | — | 03.01.07: geometría, despegue de nudos, tracción, por 30 t | U y P |
| Ferralla elaborada / armada fuera de obra | «ferralla», «armadura elaborada» | distintivo de la instalación, certificados mensuales | 15 unidades por lote | — | (en el plan tipo de 2022; no en la hoja) | P |
| Micropilotes | `03CT` · `E04PM` · «micropilote» · m, ud | tubo: certificado 3.1; lechada | replanteo, perforación, inyección (1 por micropilote) | — | 03.01.04: lechada por día (compresión, densidad; nivel 2: Marsh, exudación), tubos por 100 ud | reformas y recalces |
| Pilotes / pantallas | `03CP`, `03CM` · `E04PI`, `E04PS` · «pilote», «pantalla» | hormigón y acero como arriba, lodos | — | integridad | 03.01.05: AUX pilotes y pantallas; transparencia sónica por pilote; lodos por día | P |
| Forjado de viguetas / bovedillas | `05FU`, `05FB` · `E05H…` · «vigueta», «bovedilla», «forjado unidireccional» | DdP y marcado CE de viguetas y bovedillas (no la «autorización de uso», que citan las plantillas de 2006) | colocación, apoyos, capa de compresión | — | 03.05: bovedillas por tipo (nivel 2-3) | U y P |
| Acero laminado | `05A` · `E05A` · `EAS`, `EAV`, «s275», «s355», «perfil», «ipe/heb» · kg | certificado 3.1, cualificación de soldadores e inspectores (filas «sin cuantía» de la hoja) | uniones, soldaduras, par de apriete, montaje | — | 03.02: química y tracción por 20 t si > 100 t; inspección de soldaduras por 40-80 t; micraje por 20 t | P / reformas |
| Madera estructural | `05M` · «madera laminada», «aserrada» | marcado CE, clase resistente, tratamiento | uniones, humedad | — | 03.03: por procedencia y por 30-100 m³ | U |
| Fábrica de ladrillo / bloque | `06L`, `06B`, `06A` · `E07…` · `FFZ`, `FFQ`, `FFX` · «ladrillo», «bloque» · m² | DdP (categoría I/II, succión en fachada) | replanteo, aparejo, juntas, plomos, «1 por planta» | estanqueidad de fachada (8.2.2) | 06.1.1-06.1.4 por tipo de pieza; mortero por 1.000 m² | U: 1-2 tipos; P: 2-4 |
| Tabiquería de PYL | `06DP` · `FBY` · «placa de yeso laminado» | DdP placas y perfiles | perfilería, separaciones | — | 06.1.5, 06.1.6 por tipo | U y P |
| Cubierta plana / impermeabilización | `07H`, `09I` · `E09…`, `E10…` · `QAB`, `QAF`, `NIM` · «impermeabiliz», «lamina» · m² | DdP láminas | pendientes, solapes, encuentros | **prueba de estanqueidad por cubierta** (8.2.2, C) | 07.3/07.4 láminas por tipo (nivel 2-3) | U y P |
| Cubierta inclinada / tejas | `07IT` · «teja» | DdP | solape, fijación | estanqueidad de cubierta inclinada | 07.1/07.2 por tipo | U |
| Aislamiento térmico / acústico | `09T`, `09A` · `NAF`, `NAO` · «aislamiento», «xps», «eps», «lana mineral», «poliuretano proyectado» · m² | DdP (λ, espesor, reacción al fuego) | continuidad, espesor | blower door, termografía, transmitancia (8.2.4, por edificio); acústica (8.2.1, 10 % de viviendas) | 09.x por tipo; poliuretano proyectado: espesor por 100 m², densidad por 1.000 m² | U: blower door 1; P: acústica 10 % |
| Revestimientos continuos | `10C` · `RPE`, `RPG`, `RQO` · «enfoscado», «guarnecido», «monocapa» · m² | DdP mortero/yeso | espesor, planeidad, «1 cada 100 m²» | — | 10.2.1, 10.2.2 por tipo | U y P |
| Solados / alicatados / aplacados | `10S`, `10A` · `RSG`, `RAG`, `RSB` · «baldosa», «gres», «terrazo», «piedra», «alicatado» · m² | DdP, clase de resbaladicidad | planeidad, juntas, adherencia | resbaladicidad in situ si procede | 10.1.x, 10.2.3-10.2.5 por tipo | U y P |
| Falsos techos | `10T` · `RTC` · «falso techo» · m² | DdP | perfilería, nivelación | — | 10.3 por tipo | U y P |
| Carpintería exterior y vidrio | `11L`, `11P`, `11M…V`, `12` · `LCL`, `LCP`, `LVC` · «ventana», «carpinteria exterior», «vidrio», «doble acristalamiento» · ud, m² | DdP (aire, agua, viento, U), vidrio | aplomado, sellado, «1 cada 25 ud» | estanqueidad de ventanas in situ (5 % de ud, 8.2.2) | 11.1 por tipo (nivel 1: dimensiones, anodizado/lacado) | U: 1; P: 5 % |
| Barandillas | `11SB` · `FDD` · «barandilla» | — | altura, huecos, fijación | prueba de empuje (8.2.3) | — | U y P |
| Pinturas | `13` · `RIP`, `RFS` · «pintura» · m² | ficha técnica | soporte, manos | — | 13.x por tipo (nivel 1) | U y P |
| Saneamiento | `04` · `E03` · `ASA`, `ASB`, `ISS`, `ISB` · «colector», «arqueta», «bajante», «saneamiento» · m, ud | DdP tubos | pendientes, uniones | estanqueidad de redes enterradas (10 % de tramos), interiores (20 % viv.), bajantes (20 %) | 08.1.1.3 tubos PVC por tipo y diámetro (nivel 3) | U: 1 de cada; P: % |
| Fontanería / ACS | `08F` · `E20` · `IFI`, `IFC`, `IFW` · «fontaneria», «tuberia», «acs» · m, ud | DdP | fijaciones, aislamiento de tuberías | presión y estanqueidad (20 % viv.), funcionamiento (visita por 5 viv.), grupo de presión (1) | 08.1.3 tubos por tipo (nivel 3) | U: 1 visita |
| Electricidad BT | `08E` · `E17` · `IEI`, `IEP` · «cuadro», «circuito», «toma de tierra» | certificado del instalador | trazado, secciones | cuadros y mecanismos (20 % viv., visita por 5), puesta a tierra (1), zonas comunes (1 edificio) | 08.1.4 tubos (nivel 3) | U y P |
| Climatización, ventilación, extracción | `08C` · `E22`, `E23` · `ICR`, `IVV` · «climatizacion», «ventilacion», «extraccion», «caldera», «radiador» | certificado RITE | — | equipos individuales (20 % viv.), centralizados (1), estanqueidad con humo (10 %) | — | U y P |
| PCI | `08I…` · `E26` · `OIX`, `OIA` · «extintor», «bie», «deteccion» | certificados | — | detección y alarma (1 central), red de extinción (1) | — | P |
| Telecom, portero, CCTV | `08K` · `E19` · `ILA`, `IAI` · «telecomunicaciones», «tv», «portero» | certificado ICT | — | señal TV, voz y datos (20 %), videoportero (/10) | — | P |
| Gas | `08L` · `E24` · «gas» | certificado | — | estanqueidad (20 % viv.) | — | U y P |
| Ascensores | `08M…` · `E25` · «ascensor» | marcado CE, declaración de conformidad | — | prueba de funcionamiento (1 por ud) | — | P |
| Movimiento de tierras y rellenos | `02` · `E02` · `ADE`, `ADR`, `ADT` · «relleno», «terraplen», «compactacion», «zahorra», «encachado» · m³, m² | procedencia, DdP árido | tongadas, compactación | — | 02.1.2 densidad in situ (5 por 1.000 m²) y Próctor; 02.2 terraplén por 5.000 m³ y procedencia; zahorra 02.7 | U: Próctor + 5 densidades |
| Urbanización (pavimentos, bordillos, firmes) | `15` · `UXT`, `UDH`, `UVM` · «adoquin», «bordillo», «aglomerado», «firme» | DdP | — | — | 15.x | P / parcelas |
| Excluir | capítulo de gestión de residuos (17), seguridad y salud, implantación, transporte, alquileres, demoliciones | — | (demolición: control de ejecución opcional) | — | — | — |

Datos que el presupuesto no da y la app tiene que pedir (o leer de la ficha del proyecto): superficie
construida por grupo de elementos, nº de plantas, nº de viviendas o unidades de uso, nº de
procedencias de suelos, días de trabajo de micropilotes y pilotes, nº de tipos cuando la partida no
lo deja claro, si el hormigón tiene distintivo, y el plazo de hormigonado (para el criterio de
tiempo).

---

## 6. Para la app

1. **Tres capas con fuentes distintas.** Recepción documental (lista por familia con los campos de
   la hoja de suministro del manual del laborante y las exigencias «sin cuantía» de la hoja de la
   Junta), ejecución (modelo CYPE: fases, verificación, frecuencia, criterio de rechazo, pero con
   el número calculado), obra terminada y ensayos (hoja de la Junta). Ninguna fuente sola basta
   (K-PCC.69).
2. **Datos: la hoja de la Junta (V04 = V03) como catálogo de ensayos**, con nivel, norma, nº por
   lote, tipo de lote (§3.2) y precio recomendado. Antes de usarla: quitar la EHE-08 de encepados,
   corregir «clases generales», sustituir MOPU-74/86 y UNE-EN 13829, y reescribir la AUX con los
   criterios que faltan (§3.3). Licencia: está registrada (JAFIOT/SGT-01-2022) y no dice nada de
   reproducción en lo que he visto; conviene preguntar antes de meter el catálogo en el repo, como
   se hizo con los ratios de residuos.
3. **Precios: BCCA 2023 cap. 18 por tabla curada**, con fuente y fecha por fila; huecos (acero
   corrugado, aire ocluido, anclajes, mezclas bituminosas) con precio de la hoja de la Junta o
   propio. Nunca casar solo por precio (K-PCC.67).
4. **Unidad de cuantificación en cada ensayo** (amasada, probeta, visita, lote, tramo) y en cada
   precio (K-PCC.60).
5. **Cálculo de amasadas propio**, por tipo de hormigón y grupo de elementos, con volumen,
   superficie, plantas y tiempo, con y sin distintivo, con redondeo hacia arriba y sin perder
   filas sin tipo (K-PCC.55-59). Los valores los da el verificador del Código; los casos de
   prueba salen de §3.3.
6. **Validación de designaciones de hormigón** antes de usar la clase de exposición, con aviso por
   partida (K-PCC.52). Es el mismo tipo de comprobación que los códigos LER en residuos.
7. **Plan de ejecución por partida como CYPE, pero agrupado**: una tabla por familia con la suma de
   mediciones y el nº de controles calculado, no 60 fichas repetidas (K-PCC.63, K-PCC.70). Si el
   .bc3 de CYPE trae `~L` con `PS`/`EN`, importarlo como propuesta.
8. **Valoración enlazada al capítulo de control del presupuesto** (como el 7.º de residuos con el
   capítulo de gestión): lo que es de laboratorio va al capítulo con partida y medición; lo que es
   del constructor se lista sin coste, diciéndolo. Coherencia texto ↔ capítulo (K-PCC.61). La
   decisión de si las pruebas de servicio de instalaciones son del instalador (sin coste) o del
   laboratorio (con coste) la toma el estudio; los dos planes del estudio hacen cosas distintas.
9. **Aviso de plan pobre**: si el capítulo de control queda por debajo de lo que dan los ensayos de
   nivel 1 de las familias presentes (p. ej. hormigón y acero), aviso. Los tres presupuestos del
   estudio lo darían.
10. **Lista negra de texto** (K-PCC.50, 51, 65, 71) aplicada a todo lo que salga, incluidos los
    `~T` de banco (K-PCC.68).
11. **Lo que no hay que copiar de los ejemplos**: la plantilla de Cádiz y la memoria de 2026
    (esquema EHE-98), el A3-02 de Madrid, la guía CE.pdf, el capítulo E29 de Centro tal cual.

Pendiente de comprobar: si el estudio puede exportar de CYPE con el pliego (`~L`), y la
relación de ensayos declarados de 2024 (`norma\xls\relacion_ensayos_20240408.xlsx`) frente a los
448 códigos DR de la hoja (no lo he cruzado: la lectura con openpyxl no terminó en 2 minutos;
le toca a quien haya bajado ese fichero).
