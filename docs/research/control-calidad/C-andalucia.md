# Verificación normativa: Plan de control de calidad, caso particular de Andalucía

**Fecha:** 2026-10-24 · Agente: verificador de normativa autonómica andaluza · **No se ha editado código.**
**Encargo:** el plan de control de calidad (PCC) que la app genera desde el presupuesto, en obra de edificación **privada** situada en Andalucía. Criterios **K-PCC.40 … K-PCC.49**. El CTE estatal y el Código Estructural los cubren otros verificadores; aquí solo entra lo andaluz y lo que lo toca de frente.

**Método y límites de esta sesión**
- **Textos oficiales descargados** en `volcados/norma/pdf/` y volcados con `pdftotext` en `volcados/norma/txt/`.
  - Decreto 67/2011: BOJA original, a dos columnas. Se volcó **sin `-layout`** (`D67-2011_boja77_raw.txt`), que lee columna a columna. El orden sale coherente.
  - Cotejo **en imagen** (PyMuPDF, `volcados/norma/img/D67_p9.png` y `D67_p10.png`): BOJA pp. 9 y 10, es decir, arts. 1, 2, 3 y 4. → **VERIFICADO (imagen)**.
  - El resto de artículos del Decreto 67/2011, la Ley 5/2025, el Decreto 50/2025 y las notas aclaratorias de la Consejería: **VERIFICADO (texto)**.
- **Decreto 13/1988:** el PDF del BOJA es imagen sin capa de texto. Se leyó el texto HTML de la propia página del BOJA (`juntadeandalucia.es/boja/1988/11/4`), en `D13-1988_boja11_html.txt`. → **LEÍDO (web, oficial)**: texto completo, pero no es el PDF.
- **Hojas de cálculo oficiales** descargadas de la web de la Consejería, en `volcados/norma/xls/`. Se volcaron con un lector propio (`volcados/tools/`): `txt\PlanCC_V04.txt` y `txt\relacion_ensayos.txt`.
- **BCCA:** los `.bc3` oficiales (jul-2023 corregido y V02 dic-2023/ene-2024), en `volcados/norma/bcca/`. Se leyeron con `iconv CP1252`.
- **Páginas web** (portal de la Junta, colegios): descargadas con `curl` y pasadas a texto. Donde solo hubo lector o buscador: **LEÍDO (web)**.
- **No hay texto consolidado oficial** de los decretos andaluces. El BOE solo consolida leyes. Su vigencia se apoya en la web de la Consejería y en la ausencia de derogaciones encontradas.

**Veredictos** (los mismos de `verificacion-residuos.md`):
- **VERIFICADO (imagen)** / **VERIFICADO (texto)**: literal de la norma, con página.
- **LEÍDO (web)**: juntadeandalucia.es o la web del colegio, en HTML o leída con un lector.
- **INTERPRETACIÓN**: se sigue de la norma, pero la norma no lo escribe tal cual.
- **CORREGIDO**: el encargo, una plantilla de muestra o una fuente previa no coincide con la fuente.
- **SIN CONFIRMAR**: no se ha podido leer en fuente oficial. **No se codifica.**

---

## 0. Fuentes y ediciones

| Clave | Documento | Edición / versión | Fuente (fichero) | Lectura |
|---|---|---|---|---|
| [D67] | **Decreto 67/2011, de 5 de abril**, por el que se regula el control de calidad de la construcción y obra pública | BOJA núm. 77, 19-04-2011, desde la p. 8 (articulado pp. 8–15; anexos I y II desde la p. 16). En vigor «el día siguiente al de su publicación» (DF 2.ª, p. 15), es decir, el **20-04-2011** | `juntadeandalucia.es/boja/2011/77/d2.pdf` → `pdf\boja2011-77-d2.pdf`, `txt\D67-2011_boja77_raw.txt` | **VERIFICADO (imagen)**: arts. 1–4 (pp. 9–10). **VERIFICADO (texto)**: arts. 5–17, DT única, disp. derogatoria, DF 1.ª y 2.ª (pp. 10–15), anexo I |
| [D13] | Decreto 13/1988, de 27 de enero, control de calidad de la construcción y obra pública | BOJA núm. 11, 12-02-1988. **Derogado** por [D67], disp. derogatoria a) (p. 14) | `boja/1988/11/4` (HTML) → `txt\D13-1988_boja11_html.txt` | Derogación: VERIFICADO (texto). Contenido: **LEÍDO (web, oficial)** |
| [O89] etc. | Decreto 21/2004; Orden de 15-06-1989 (Registro de Entidades Acreditadas); Órdenes de 18-02-2004, 20-06-2005 y 06-11-2008 (áreas de acreditación) | **Derogadas** por [D67], disp. derogatoria b)–f) (pp. 14–15) | [D67] | VERIFICADO (texto) |
| [WEB-CC] | Web de la Consejería, «Normativa de Calidad» | En 2026 lista solo el RD 410/2010 y el Decreto 67/2011 | `organismos/viviendajuventudyordenaciondelterritorio/areas/calidad/informacion-tecnica/paginas/normativa-control-calidad.html` | LEÍDO (web) |
| [PCC-JA] | «Plan de Control de Calidad de Materiales para Obras de Edificación (versión Código Estructural)». Consejería de Fomento, Infraestructuras y Ordenación del Territorio (SGT) + ALA + ETSIE Sevilla | Muestra del encargo: **v03, oct-2022**. **En la web oficial: v04, ene-2023** (`20230116_Plan_Control_Calidad_Edifiacion-CodE- V04_Enero_2023.xls`) | Página «Recomendaciones Técnicas» → `xls\PlanCC_CodE_V04_2023.xls`, `txt\PlanCC_V04.txt`; muestra `volcados/PlanCC_xls.txt` | VERIFICADO (texto), hoja volcada |
| [REL] | «Relación de Ensayos», plantilla del «anexo de ensayos declarados» de la declaración responsable de laboratorios | `20240408_relacion_de_ensayos_conjunta.xlsx`. Fechas de actualización por área de feb–mar 2024 (OL de feb-2023) | Página «Declaración Responsable: Laboratorios» → `xls\relacion_ensayos_20240408.xlsx`, `txt\relacion_ensayos.txt` | VERIFICADO (texto) |
| [L5/25] | **Ley 5/2025, de 16 de diciembre, de Vivienda de Andalucía** | BOJA núm. 247, 24-12-2025, pp. 17103/1–100. En vigor «al mes de su publicación» (DF 8.ª, p. 17103/100) | `pdf\L5-2025_vivienda_boja247.pdf`, `txt\L5-2025_vivienda_raw.txt` | **VERIFICADO (texto)**: arts. 27, 28 h), 29, 30, 31 (pp. 17103/41–43). Consolidado BOE no leído |
| [D50] | **Decreto 50/2025, de 24 de febrero**, Reglamento para la preservación de la calidad acústica en Andalucía | BOJA núm. 42, 04-03-2025, pp. 2738/1–71. En vigor «a los 20 días de su publicación» (DF 2.ª, p. 2738/7). **Deroga el Decreto 6/2012** (disp. derogatoria única, p. 2738/6) | `pdf\D50-2025_boja42.pdf`, `txt\D50-2025_boja42_raw.txt` | **VERIFICADO (texto)**: art. 27.2–3 (p. 2738/24), art. 44 (p. 2738/36), IT 4 (p. 2738/63), IT 5 (pp. 2738/63–64) |
| [FAQ18] / [FAQ26] | Notas aclaratorias de la SGT: ensayos acústicos IT.5 (26-04-2018, Decreto 6/2012) y «FAQ – Aclaraciones sobre acústica Decreto 50/2025» (23-03-2026) | PDF firmados | Página «Laboratorios de control de calidad» → `pdf\FAQ_acustica_*.pdf` | VERIFICADO (texto). Son **notas interpretativas, no norma** |
| [BCCA] | **Base de Costes de la Construcción de Andalucía**, «BCCA2023_V02.bc3» | Página «Actualización … Enero de 2024» (corrige erratas de jul-2023). Es la **última edición publicada** a 2026-10. Raíz `BCCA_2023_v02##`; cabecera `~V … FIEBDC-3/2020\01112023` | `…/paginas/bcca-ene-2024.html` → `bcca\v02\BCCA2023_V02.bc3`. También jul-2023 corregido → `bcca\jul23\` | Fichero: VERIFICADO (texto). Página web: LEÍDO (web) |
| [AVISO] | Aviso legal del Portal de la Junta de Andalucía, «Propiedad intelectual» | vigente a 2026-10 | `juntadeandalucia.es/informacion/legal.html` → `web\aviso-legal.html` | LEÍDO (web), literal copiado del HTML |
| [DocArqT] | DocArqT, herramienta del Consejo Andaluz de COAAT | noticia del COAAT Málaga, 25-11-2024; docarqt.com | coaat.es, docarqt.com | LEÍDO (web) |
| [D6/12] | Decreto 6/2012, de 17 de enero (Reglamento de protección contra la contaminación acústica en Andalucía) | **Derogado** por [D50] | [D50] p. 2738/6 | VERIFICADO (texto) la derogación |

### Correcciones al encargo y a las muestras (resumen)

1. **El Decreto 67/2011 sí alcanza a la obra privada**, en dos niveles. Art. 1.2: «todas las obras de construcción que se lleven a cabo en el ámbito de la Comunidad Autónoma» llevan el plan de control que exija la normativa básica. Art. 1.3: solo la obra de la Junta, o la financiada por ella, lleva **además** los ensayos que fije el propio decreto o su desarrollo. (K-PCC.41)
2. **No hay porcentaje del PEM** para el control, ni en el Decreto 67/2011 ni en el derogado 13/1988. Lo que hay es el «plan de control de calidad … con su correspondiente presupuesto» (art. 3.1). (K-PCC.42)
3. **CORREGIDO (encargo):** el Decreto 67/2011 **no regula** un «programa de control» del director de ejecución, ni un «libro de control de calidad», ni una «certificación final de control». El programa definitivo del director y la certificación final estaban en el **Decreto 13/1988, art. 2.2 y 2.3, derogado**. Hoy se rige por el CTE (otro verificador) y por el art. 3.3 del Decreto 67/2011: «documentación reglamentariamente exigible». (K-PCC.43)
4. **Nuevo:** la **Ley 5/2025 de Vivienda de Andalucía** (en vigor desde enero de 2026) exige, en toda obra de vivienda pública o privada, «sistemas de aseguramiento, control y verificación», con laboratorios y entidades de control. El promotor y el constructor deben acreditar «la implantación de los sistemas de control establecidos y su resultado satisfactorio» (arts. 27.1 y 29). (K-PCC.46)
5. **Nuevo:** el **Decreto 50/2025** (acústica) deroga el Decreto 6/2012. Su **IT 5** obliga a presentar, para la licencia de primera ocupación, un **informe de ensayo acústico in situ** con muestreos mínimos (10 % de viviendas, etc.). Es el único ensayo obligatorio de origen autonómico que encaja de lleno en «obra terminada». (K-PCC.47)
6. **CORREGIDO (muestras):** la hoja [PCC-JA] y el BCCA, cap. 18 (concepto 18UAA00010), citan el «RD 6/2012 JJAA» / «D 6/2012». Ese decreto está **derogado** y no es real decreto. La memoria `101_MEM_MEMORIA` fecha el Decreto 67/2011 en el «B.O.J.A. 19/11/2012»: es **BOJA 77, de 19-04-2011**. (K-PCC.47, K-PCC.49)
7. **CORREGIDO (encargo):** la versión vigente de la hoja de la Consejería es la **v04 (enero 2023)**, no la v03. Los datos de ensayos, lotes y precios son **idénticos**: el volcado normalizado no da ninguna diferencia. Solo cambian la portada y un colaborador (CITOP Zaragoza). (K-PCC.45)
8. **«Relación de ensayos declarados»** es el anexo que cada laboratorio adjunta a su declaración responsable (art. 11.1 [D67]). Los códigos que usa la hoja en la columna «CÓDIGO DR» (OLA003, EF…, EM…, PS…) son los de esa plantilla oficial. (K-PCC.45)
9. **BCCA:** la última publicada sigue siendo la **BCCA 2023 (V02, publicada en enero de 2024)**. Fecha de conceptos 05-12-2022: coincide con la de la app. Su cap. 18 «CONTROL DE CALIDAD, PRUEBAS Y ENSAYOS» se creó en 2023. (K-PCC.48)

---

## K-PCC.40 — Decreto 67/2011: identificación, vigencia y qué deroga

**Respuesta.**
- Es la norma andaluza vigente de control de calidad de la construcción. BOJA núm. 77, de 19-04-2011, en vigor el 20-04-2011.
- No se ha encontrado ninguna modificación.
- Deroga expresamente el Decreto 13/1988, el Decreto 21/2004 y **cuatro órdenes**: la de 15-06-1989 y las de 2004, 2005 y 2008.

**Cita.** [D67], **VERIFICADO (texto)**:
- Disp. derogatoria única, pp. 14–15: «Quedan derogadas las disposiciones de igual o inferior rango en cuanto se opongan a lo establecido en el presente Decreto y, expresamente, las siguientes:
  - a) El Decreto 13/1988, de 27 de enero, por el que se regula el control de calidad de la construcción y obra pública.
  - b) El Decreto 21/2004, de 3 de febrero, por el que se aprueba el Reglamento de la Acreditación y del Registro de las entidades de control de calidad de la construcción.
  - c) La Orden de la Consejería de Obras Públicas y Transportes, de 15 de junio de 1989, por la que se regula el Registro de Entidades Acreditadas para la prestación de asistencia técnica a la construcción y obra pública.
  - d) La Orden […] de 18 de febrero de 2004, […] áreas de acreditación de los laboratorios de ensayos […].
  - e) La Orden […] de 20 de junio 2005, […] área de acreditación para la asistencia técnica de las obras de edificación cuyo uso principal sea administrativo, sanitario, religioso, residencial en todas sus formas, docente y cultural, […].
  - f) La Orden […] de 6 de noviembre de 2008, […] para obras de ingeniería civil de carreteras y ferrocarriles.»
- DF 2.ª, p. 15: «El presente Decreto entrará en vigor el día siguiente al de su publicación en el Boletín Oficial de la Junta de Andalucía.»
- DF 1.ª, p. 15: «1. Se faculta a la Consejera de Obras Públicas y Vivienda para dictar cuantas disposiciones sean necesarias para el desarrollo y ejecución de este Decreto, […]. 2. Se faculta a las personas titulares de las Consejerías afectadas para que en el ámbito de sus respectivas competencias dicten las normas necesarias para la elaboración de planes de control de calidad específicos.»

**Vigencia.**
- LEÍDO (web):
  - la página «Normativa de Calidad» de la Consejería (2026) lo cita como normativa andaluza junto al RD 410/2010;
  - Iberley lo da por vigente y sin modificaciones.
- **INTERPRETACIÓN** a favor de la vigencia: la Ley 5/2025 (art. 30.b, p. 17103/42) da por existentes «los registros públicos oficiales de los agentes responsables de la garantía de calidad en la edificación, laboratorios de ensayos y de entidades de control de calidad de la construcción y obra pública de Andalucía». Ese registro lo crea el art. 9 del Decreto 67/2011.
- **SIN CONFIRMAR**: que no haya modificación puntual posterior. No existe texto consolidado oficial que lo diga.

**Para la app.** Cita normativa andaluza del PCC: «Decreto 67/2011, de 5 de abril, por el que se regula el control de calidad de la construcción y obra pública (BOJA núm. 77, de 19-04-2011)». **Nunca** el Decreto 13/1988, la Orden de 1989 ni las «áreas de acreditación».

---

## K-PCC.41 — Ámbito: ¿obliga a la obra de edificación privada? (pregunta principal)

**Respuesta.** **Sí, en lo básico.**
- Toda obra de construcción en Andalucía, pública o privada, debe tener el plan de control que exija la normativa básica de obligado cumplimiento (CTE, Código Estructural, etc.). Y el proyecto debe incluir ese plan con su presupuesto (art. 3.1, K-PCC.42).
- Lo que **no** alcanza a la privada es el control **adicional** del art. 1.3: ensayos fijados por el propio decreto o por su desarrollo. Ese es solo para la obra de la Junta o financiada por ella.
- Lo que **sí** alcanza a la privada:
  - la definición del control en tres fases (art. 3.2);
  - la regla de laboratorios y entidades (art. 4);
  - las incompatibilidades (art. 7).

**Cita.** [D67] art. 1, p. 9, **VERIFICADO (imagen)**:
> «1. El presente Decreto tiene por objeto regular el control de calidad de la construcción y obra pública, el Registro de laboratorios de ensayos y de entidades de control de calidad de la construcción y obra pública de Andalucía, y establecer los requisitos exigibles para el ejercicio de la actividad de los laboratorios de ensayos y de las entidades de control de calidad para la prestación de asistencia técnica a las obras citadas.
> 2. En todas las obras de construcción que se lleven a cabo en el ámbito de la Comunidad Autónoma de Andalucía se realizará el plan de control de calidad que, en aplicación de la normativa básica de obligado cumplimiento, en cada caso, resulte pertinente para comprobar su calidad.
> 3. En las obras de construcción de iniciativa pública que lleven a cabo las distintas Consejerías y entidades instrumentales de la Administración de la Junta de Andalucía o que se realicen en todo o en parte con financiación directa o indirecta de la misma se realizarán, además, los ensayos, análisis, e informes de los productos y unidades de obra que se determinen en la presente norma así como en las disposiciones que se dicten en desarrollo y ejecución del presente Decreto.»

Art. 2, p. 9, **VERIFICADO (imagen)**:
> «a) Obras de construcción: Obras de edificación y obras de ingeniería civil. b) Obras de edificación: Son las definidas en el artículo 2 de la Ley 38/1999, de 5 de noviembre, de Ordenación de la Edificación. […] d) Obra pública: Son obras que responden a las necesidades especificadas por las Consejerías y entidades instrumentales de la Administración de la Junta de Andalucía.»

**Antecedente** (derogado; solo para contexto): [D13] art. 1, LEÍDO (web, oficial). Tenía el mismo esquema de dos niveles: «1. En todas las obras que se lleven a cabo en el ámbito de la Comunidad Autónoma de Andalucía se realizarán los ensayos y análisis […]. 2. En las obras de iniciativa pública […] se efectuarán además […]».

**INTERPRETACIÓN.**
- El art. 3.1 dice «los proyectos de las obras a que se refiere el presente Decreto». Esas obras son las del art. 1.2, es decir, todas. Por tanto el proyecto de ejecución de una obra privada en Andalucía debe incluir el plan de control **con presupuesto**.
- El art. 6 se titula «Obra pública» y su ámbito es solo ese: la verificación documental del marcado CE y los ensayos obligatorios de procedencia cuando falta. A la privada no le es exigible por este decreto (sí, en su caso, por el CTE).
- Lo que el art. 1.2 llama «obras de construcción» incluye las de edificación de la LOE art. 2. La obra menor sin proyecto (LOE art. 2.2) no tiene proyecto donde incluir el plan del art. 3.1.

**Para la app.** Con la obra en Andalucía, el PCC del proyecto de ejecución es **obligatorio por norma autonómica**, además de por el CTE. La app no debe ofrecer el apartado del art. 1.3 («ensayos adicionales de la Junta»): la obra es privada (memoria `obra-privada.md`).

---

## K-PCC.42 — Plan de control en el proyecto y su valoración económica

**Respuesta.**
- El proyecto incluye «el plan de control de calidad a realizar sobre los productos y unidades de obra con su correspondiente presupuesto», conforme a la normativa obligatoria aplicable.
- **No hay porcentaje del PEM** ni regla sobre a cargo de quién va. En obra privada, quién paga es asunto del contrato entre promotor y constructor.

**Cita.** [D67] art. 3.1, p. 10, **VERIFICADO (imagen)**:
> «1. En los proyectos de las obras a que se refiere el presente Decreto se incluirán las especificaciones técnicas detalladas de calidades, así como el plan de control de calidad a realizar sobre los productos y unidades de obra con su correspondiente presupuesto, de conformidad con lo previsto en las disposiciones de obligado cumplimiento de aplicación en la obra.»

**Búsqueda** en todo el volcado de [D67] de «por ciento», «%», «presupuesto de ejecución material»: **0 apariciones**. Tampoco las hay en [D13] (LEÍDO (web, oficial)).

**INTERPRETACIÓN.**
- El «1 % del PEM» que se oye a menudo viene de la contratación pública (pliegos de obra pública). **No es norma de obra privada en Andalucía.**
- El origen concreto de ese 1 % no se ha leído en esta sesión → **SIN CONFIRMAR**. No se codifica.
- La hoja [PCC-JA] propone niveles de control por PEM (< 300.000 € y > 300.000 €). Es una **recomendación** de un documento técnico, no norma (ver K-PCC.45).

**Para la app.** Con la obra en Andalucía, la valoración del PCC es **obligatoria** como apartado del plan, con cita al art. 3.1. Es un presupuesto propio por ensayos (medición × precio). Dónde va el importe (capítulo del presupuesto, a cargo de la propiedad o de la contrata) lo decide el proyectista.

---

## K-PCC.43 — Controles durante la obra, programa, libro y certificado final

**Respuesta.**
- El art. 3.2 define tres controles a cargo de la dirección facultativa. El texto es casi literal al del CTE Parte I art. 7:
  - recepción, con tres vías: documentación, distintivos y evaluaciones de idoneidad, y ensayos;
  - ejecución;
  - obra terminada.
- El art. 3.3 remite a la «documentación reglamentariamente exigible».
- **No existe** en Andalucía un modelo autonómico vigente de programa de control, libro de control de calidad, actas de ensayo obligatorias ni certificado final de control.

**Cita.** [D67] art. 3.2–3.3, p. 10, **VERIFICADO (imagen)**:
- «2. Durante la construcción de las obras, la dirección facultativa competente, realizará, en la forma prevista en las disposiciones de aplicación en función del tipo de obra, los controles siguientes:
  - a) El control de la recepción en obra de los productos, equipos y sistemas suministrados, […] comprenderá:
    - 1.º Control de la documentación de los suministros: Los suministradores entregarán al constructor, quien los facilitará al director o directora de ejecución de la obra, los documentos de identificación del producto exigidos por la normativa de obligado cumplimiento y, en su caso, por el proyecto o por la dirección facultativa. […] incluida la documentación correspondiente al marcado CE […].
    - 2.º Control de recepción mediante distintivos de calidad y evaluaciones de idoneidad técnica […].
    - 3.º Control de recepción mediante ensayos: […] La realización de este control se efectuará de acuerdo con los criterios establecidos en el proyecto o indicados por la dirección facultativa sobre el muestreo del producto, los ensayos a realizar, los criterios de aceptación y rechazo y las acciones a adoptar.
    - 4.º La dirección facultativa competente comprobará […].
  - b) Control de la ejecución de la obra: […] verificando su replanteo, los materiales que se utilicen, la correcta ejecución y disposición de los elementos constructivos y de las instalaciones […].
  - c) Control de la obra terminada: En la obra terminada, total o parcialmente, deberán realizarse, además de las que puedan establecerse con carácter voluntario, las comprobaciones y pruebas de servicio previstas en el proyecto u ordenadas por la dirección facultativa y las exigidas por la legislación aplicable.»
- «3. Durante la obra se cumplimentará la documentación reglamentariamente exigible, en la que se incluirá la documentación del control de calidad realizado a lo largo de la misma.»
- Art. 8, p. 11, VERIFICADO (texto): «La realización del control de calidad exigido por la Administración de la Junta de Andalucía no podrá ser invocado para disminuir la responsabilidad civil, administrativa o penal en que hubieren podido incurrir cualquiera de los agentes intervinientes en el proceso constructivo.»

**Derogado** ([D13], LEÍDO (web, oficial)). **No citar.**
- Art. 2.2: «El facultativo Director de la obra, fijará el Programa definitivo de Control de Calidad atendiendo al programa proyectado, […]».
- Art. 2.3: «A la terminación de la obra, se extenderá certificación por el facultativo Director de la misma haciendo constar el cumplimiento del programa de ensayos y análisis, así como la referencia a los resultados obtenidos. […]».
- DF 2.ª: la Consejería «aprobará las normas mínimas generales para la elaboración del Programa de Control». No se han encontrado.

**Criterio del encargo → CORREGIDO.** «Programa de control del director de ejecución», «libro de control de calidad» y «certificación final de control» **no tienen soporte en la norma andaluza vigente**. Si la app los genera, la cita es el CTE (Parte I art. 7.4 y anejo II), que verifica otro agente, no Andalucía.

**Plazos:** el Decreto 67/2011 no fija plazos para el plan ni para la documentación. El único plazo que contiene es el de un mes de la DT única, para los laboratorios ya inscritos en 2011.

**Para la app.** Las secciones de recepción, ejecución y obra terminada pueden citar **a la vez** el CTE y el art. 3.2 a), b) y c) del Decreto 67/2011. El art. 3.2.a.3.º pide al proyecto «el muestreo del producto, los ensayos a realizar, los criterios de aceptación y rechazo y las acciones a adoptar». Es el contenido mínimo de cada línea de ensayo del PCC.

---

## K-PCC.44 — Laboratorios y entidades de control: registro e incompatibilidades

**Respuesta.**
- En el ámbito del decreto, **también en obra privada**, los ensayos y verificaciones los hacen laboratorios y entidades de control «legalmente establecidos» con capacidad técnica (art. 4.1).
- El laboratorio con establecimiento en Andalucía presenta una **declaración responsable** con su relación de ensayos (art. 11) y queda inscrito de oficio en el **Registro de laboratorios de ensayos y de entidades de control de calidad de la construcción y obra pública de Andalucía** (arts. 9–11). La inscripción **ya no habilita**: la habilitación nace de la declaración responsable.
- **Incompatibilidad:** los informes no surten efecto si algún agente de la obra es propietario, partícipe, directivo o técnico del laboratorio o de la entidad.

**Cita.** [D67], VERIFICADO (imagen) el art. 4 y VERIFICADO (texto) el resto:
- Art. 4.1, p. 10: «En el ámbito de aplicación de este Decreto, los ensayos y las pruebas analíticas para la comprobación de las características técnicas de los materiales, sistemas o instalaciones, así como la verificación de la calidad del proyecto, de los materiales y de la ejecución de la obra y sus instalaciones, se realizarán por laboratorios de ensayos para el control de calidad de la construcción y obra pública y por entidades de control de calidad de la construcción y obra pública, legalmente establecidos, que dispongan de capacidad técnica suficiente para las actividades que realizan.»
- Art. 4.4.a, p. 10: entregan los resultados «al agente autor del encargo y, en todo caso, al responsable técnico de la recepción y aceptación de los resultados de la asistencia, ya sea el director o directora de la ejecución de las obras, […]».
- Art. 7, p. 11: «Los dictámenes y actuaciones de los laboratorios de ensayo y de las entidades de control, no surtirán efecto, en relación con los proyectos y con las obras, cuando entre los distintos agentes que intervienen en el proceso constructivo se hallen personas físicas o jurídicas propietarias de los laboratorios de ensayos o de las entidades de control o que tengan participación en el capital de la persona jurídica titular […], o que formen parte de los órganos de dirección o del personal técnico de los mismos.»
- Exposición de motivos, pp. 8–9: la inscripción en el Registro «pierde su carácter de requisito habilitante y pasa a desempeñar un papel necesario como instrumento de información para la actuación inspectora y como fuente de estadística».
- Art. 11.3, p. 12: «La presentación de la declaración responsable habilita al laboratorio de ensayos o a la entidad de control, desde el momento de su presentación, para el ejercicio de las actividades para las que declara cumplir los requisitos exigibles, con una duración indefinida.»
- Art. 15.1.c.1.º, p. 13: el informe de resultados «se ajustará al contenido técnico establecido en la norma del ensayo, debiendo firmarse por el técnico titulado responsable del mismo».

**Refuerzo legal** ([L5/25] art. 27.1, p. 17103/41, VERIFICADO (texto); ver K-PCC.46): en vivienda, el control se hace «contando para ello con los laboratorios de ensayos para el control de calidad de la construcción y obra pública y, entre otras, con las entidades de control de calidad de la construcción y obra pública».

**Registro y consulta** (LEÍDO (web), página «Laboratorios de control de calidad»):
- el registro se publica en `…/areas/calidad/laboratorios/laboratorios_ensayos/`, con visor de mapas;
- aviso de la propia página: «Las informaciones ofrecidas por este medio tienen exclusivamente carácter ilustrativo»;
- para el registro estatal remite al RD 410/2010 (codigotecnico.org).

**Para la app.** Texto tipo del PCC andaluz: «Los ensayos se realizarán por laboratorio de ensayos con declaración responsable presentada e inscrito en el Registro de laboratorios de ensayos y de entidades de control de calidad de la construcción y obra pública de Andalucía (Decreto 67/2011, arts. 4, 9–11), sin incurrir en las incompatibilidades del art. 7.» La app **no** debe nombrar un laboratorio concreto.

---

## K-PCC.45 — «Relación de ensayos declarados» y la hoja «Plan de Control de Calidad de Materiales» de la Consejería

### a) Qué es la «Relación de ensayos declarados»

**Respuesta.**
- Es el anexo de la declaración responsable de cada laboratorio (art. 11.1 [D67]). La Consejería publica una **plantilla oficial** con un **código por ensayo**, para que el laboratorio marque los que hace. Las áreas son:
  - edificación (RD 410/2010): GT geotecnia, PS pruebas de servicio, VS viales, EH hormigón, EA acero, EF fábrica, EM madera;
  - obra lineal: OL-A a OL-D.
- La columna «CÓDIGO DR» de la hoja [PCC-JA] es ese código.

**Cita.**
- [D67] art. 11.1, p. 12, VERIFICADO (texto): «La declaración responsable incluirá la relación de los ensayos en los que el laboratorio vaya a prestar su asistencia técnica, identificando claramente la denominación del ensayo, el método que utiliza y su fecha de aprobación y, en su caso, la referencia a la disposición reglamentaria donde se incluye. En la citada relación de ensayos podrán establecerse clasificaciones y subclasificaciones de los ensayos que se realicen. Con carácter indicativo se agrupan como sigue: A. Obras de edificación: a) Ensayos de geotecnia. b) Ensayos de viales. c) Ensayos de pruebas de servicio. d) Ensayos de estructuras de hormigón estructural. e) Ensayos de estructuras de acero estructural. f) Ensayos de obras de albañilería. g) Ensayos de estructuras de madera estructural. […]»
- Web, página «Declaración Responsable: Laboratorios», LEÍDO (web): «Debera acompañarse del Anexo de Ensayos Declarados, para lo cual se facilita la plantilla, en formato hoja de cálculo "Relación de Ensayos" con todas la áreas de edificación (GT RD 410, PS RD 410,…) y con todas las áreas de obras lineales (OL-A, OL-B, OL-C y OL-D).»
- [REL], hoja «NORMAS GENERALES», VERIFICADO (texto):
  - «imprimir un único pdf, que llamaremos ANEXO DE ENSAYOS DECLARADOS»;
  - fechas de actualización: GT 19-03-2024; PS y EF 25-01-2024; VS 12-03-2024; EH y EA 02-02-2024; EM 02-02-2024; OL-A, B, C y D 22-02-2023;
  - marcas: «(NA) Norma Armonizada · (CTE) Norma citada en Código Técnico de la Edificación · (CE) Norma citada en el Código Estructural · (PG-3) […]».
  - Ejemplos: «GT04 | d | Análisis granulométrico de suelos por tamizado | UNE 103101:1995 (CTE)(PG3)»; «EH004 | d | Resistencia a compresión. | UNE-EN 12390-3:2009 (CE)».

**Cotejo de códigos.** De los 166 códigos de la columna «CÓDIGO DR» de la hoja [PCC-JA], **162 están en [REL] 2024**. No están: EF40, EM16, OLA133 y OLB047. Prefijos usados en la hoja: OL 78, EF 59, PS 11, EM 11, EA 5, EH 2. → **INTERPRETACIÓN**: la hoja de 2022–2023 usa una relación anterior y cuatro códigos han cambiado o desaparecido.

### b) Estado jurídico y condiciones de uso de la hoja [PCC-JA]

**Hechos** (VERIFICADO (texto) salvo donde se indica):
- **Publicada en la web oficial** de la Consejería, en «Recomendaciones Técnicas» (LEÍDO (web)): «Plan de Control de Calidad de Ensayos de Materiales para Obras de Edificación adaptado al Código Estructural (versión 4, enero 2023)». Hay dos vídeos explicativos en YouTube.
- La misma página aloja el «Manual de Control de Calidad de Ensayos de Hormigón» (marzo 2022) y el «Modelo de Acta de Ensayos de Hormigón» (2018, .ods). La página se presenta como «Dentro de las actividades para el fomento de la calidad, se facilitan enlaces de interés para el sector».
- Hoja «Introducción» (v03 y v04):
  - «El objeto del presente trabajo es poner a disposición un documento de referencia para la redacción del Plan de Control de materiales mediante ensayos, para obras de edificación, de todos los usos permitidos como residencial, docente, sanitarios, etc, y tanto públicas como privadas.»
  - «se ha confeccionado la presente herramienta con un criterio variable para los ensayos a realizar, planteando tres niveles de control que superan en todos los casos lo meramente prescriptivo.»
  - «Para las recomendaciones de precios unitarios de los ensayos, se han tenido en cuenta los empleados por la Agencia de Obra Pública de Andalucía (AOPJA) y precios de mercado.»
  - «Nº de Registro: JAFIOT / SGT-01-2022».
  - Organismos: Consejería (SGT), ALA (asociación privada de laboratorios; personal de CEMOSA, GEOLEN, Sergeyco, ELABORA), ETSIE Sevilla y, en la v04, un ingeniero del CITOP de Zaragoza.
- **No hay** en la hoja ninguna cláusula de licencia, derechos ni condiciones de uso. Se buscaron «licencia», «derechos», «propiedad», «reservados»: 0 apariciones fuera de los nombres de ensayos.
- [AVISO], LEÍDO (web), literal: «La Junta de Andalucía promueve el libre uso y reutilización de los textos disponibles en el presente Portal sobre los que ostenta derechos de propiedad intelectual. Dichos textos están disponibles a través de una licencia-tipo Creative Commons Reconocimiento 3.0». La Junta autoriza a «Copiar, redistribuir y comunicar públicamente los textos del Portal. Hacer un uso comercial de los contenidos. Generar obras derivadas.» Condiciones:
  - reconocer la fuente con la fórmula «Información obtenida del Portal de la Junta de Andalucía»;
  - no desnaturalizar la información;
  - no sugerir respaldo de la Junta;
  - no reproducir logotipos sin autorización.

**INTERPRETACIÓN.**
- La hoja es un **documento técnico de recomendación**, no una norma: no se ha publicado en el BOJA.
- Tampoco consta que sea un «documento reconocido» inscrito en la Sección Tercera del Registro (arts. 2.h y 10.4 [D67]) → **SIN CONFIRMAR**.
- «JAFIOT / SGT-01-2022» parece un número de registro interno: Junta de Andalucía, Fomento, Infraestructuras y Ordenación del Territorio / Secretaría General Técnica. No es el Registro de la Propiedad Intelectual → **SIN CONFIRMAR**. No aparece en ninguna búsqueda.
- La licencia CC BY 3.0 del Portal cubre «los textos […] sobre los que [la Junta] ostenta derechos». La hoja es una **obra en colaboración con terceros privados** (ALA y laboratorios) y la Junta puede no tener todos los derechos. Además, una hoja con 983 precios y lotes puede considerarse una **base de datos** (LPI, derecho sui generis).
- Conclusión prudente:
  - Los **datos normativos** se pueden usar citando la fuente: código de ensayo de la Relación oficial, norma UNE, frecuencia que impone la norma. Son hechos o normas que no generan derecho de autor (LPI art. 13).
  - La **reproducción sistemática** de los lotes «propuestos» y de los **precios recomendados** de la hoja requiere permiso escrito. Contacto: el buzón que da la propia hoja, controldecalidad.cfiot@juntadeandalucia.es, y gerencia@laboratoriosacreditados.com por la parte de ALA.
- Coincidencia útil: los precios del BCCA cap. 18 parecen los mismos de la hoja. Ejemplo: granulometría 44 € en los dos (18ALF00010 / OLA003); CBR 161 €; Próctor normal 71 €. → Es más seguro tomar el precio del **BCCA** (K-PCC.48) que de la hoja.

**Para la app.**
- Se puede guardar por ensayo el «código Relación de ensayos (Junta de Andalucía)» como dato informativo para obra en Andalucía. Fuente: [REL] 2024, con la fórmula de reconocimiento del Portal.
- **No** copiar en bloque los lotes «propuestos», los niveles 1/2/3 ni los precios de la hoja [PCC-JA] sin permiso. Pueden citarse como referencia orientativa: «Plan de Control de Calidad de Materiales para Obras de Edificación, v04 ene-2023, Consejería…/ALA/ETSIE».
- Los umbrales de 300.000 € de PEM son una **recomendación**, no una norma. Si se muestran, que sea con esa etiqueta.

---

## K-PCC.46 — Ley 5/2025 de Vivienda de Andalucía: control de calidad en vivienda privada

**Respuesta.**
- La ley regula la calidad de **toda** vivienda nueva o rehabilitada en Andalucía, de promoción pública o privada. Exige:
  - el estudio geotécnico preceptivo;
  - sistemas de aseguramiento, control y verificación, con laboratorios y entidades de control (art. 27.1).
- Promotor y constructor deben **acreditar documentalmente** la implantación de los sistemas de control, su resultado satisfactorio y los agentes participantes (art. 29).
- Exige además el Libro del Edificio, que remite a la LOE art. 7, y el **Manual del Usuario de la Vivienda**, con modelo por orden (art. 31).
- La ley no fija contenido ni presupuesto del PCC.

**Cita.** [L5/25], **VERIFICADO (texto)**:
- Art. 27.1, p. 17103/41: «Con objeto de alcanzar los objetivos de calidad, en todas las obras de construcción y rehabilitación de viviendas, tanto de promoción pública como privada, se realizará el estudio geotécnico previo que fuese preceptivo, así como se implementarán durante la construcción sistemas de aseguramiento, control y verificación al efecto para la comprobación de las características técnicas de los materiales, sistemas o instalaciones, así como la supervisión de la calidad del proyecto, de los materiales y de la ejecución de la obra y sus instalaciones, contando para ello con los laboratorios de ensayos para el control de calidad de la construcción y obra pública y, entre otras, con las entidades de control de calidad de la construcción y obra pública.»
- Art. 29, p. 17103/42: «Los promotores y constructores de las viviendas en Andalucía tienen la responsabilidad de garantizar que las mismas cumplan con los principios rectores de la calidad de las viviendas establecidos en la presente legislación y resto de normativa de aplicación, acreditando documentalmente la redacción del correspondiente estudio geotécnico, así como la implantación de los sistemas de control establecidos y su resultado satisfactorio, junto a la demás documentación técnica y comercial de las viviendas, y explicitando los agentes participantes en dichos sistemas.»
- Art. 30.a, p. 17103/42: la Junta acometerá «La regulación de la calidad de la edificación, estableciendo y actualizando las normas específicas, como, entre otras, las normas técnicas de diseño y calidad, que la garanticen y fijen los estándares y niveles de control […]». Es un mandato futuro.
- Art. 31.1–2, p. 17103/43: el Libro del Edificio, «cuyo contenido se regula en el artículo 7 de la Ley 38/1999», es exigible «tanto a nuevas construcciones como a rehabilitaciones integrales». El promotor lo entrega «debidamente autorizado por la dirección facultativa». Art. 31.4: el modelo de Manual del Usuario se aprobará por orden.
- DF 8.ª, p. 17103/100: «La presente ley entrará en vigor al mes de su publicación en el Boletín Oficial de la Junta de Andalucía». Publicada el 24-12-2025 → **24-01-2026** (INTERPRETACIÓN del cómputo).

**INTERPRETACIÓN.**
- Con rango de ley, refuerza que el PCC es obligatorio en vivienda privada andaluza.
- Introduce como deber de promotor y constructor la **acreditación de resultados**. En la práctica es la relación de controles y resultados del CTE (anejo II), más la identificación de laboratorio y entidad.
- Los «estándares y niveles de control» del art. 30.a quedan para un reglamento futuro → **SIN CONFIRMAR** que exista. A 2026-10 no se ha encontrado.
- Uso no residencial: el art. 27 no le alcanza. Sigue el Decreto 67/2011 art. 1.2.

**Para la app.**
- En obra de **uso vivienda** en Andalucía, el PCC cita también «Ley 5/2025, de Vivienda de Andalucía, arts. 27 y 29».
- Se añade al PCC un apartado «Agentes del control»: laboratorio y entidad de control, que define el proyectista o la DF, con el texto del art. 29 (acreditación documental de resultados).
- El Manual del Usuario no es del PCC. Ver el capítulo de mantenimiento de la app.

---

## K-PCC.47 — Decreto 50/2025 (acústica): ensayos in situ para la licencia de primera ocupación

**Respuesta.**
- Para la licencia de primera ocupación o utilización de obras con proyecto (LOE art. 2.2), el promotor presenta un **informe de ensayo acústico** que justifique dos cosas:
  - el aislamiento exigido por el DB-HR;
  - que las instalaciones comunes no superan los niveles límite.
- La IT 5 fija los **muestreos mínimos**. Es un ensayo de **obra terminada obligatorio por norma andaluza**: el DB-HR por sí solo no obliga a medir in situ.

**Cita.** [D50], **VERIFICADO (texto)**:
- Art. 27.3, p. 2738/24: «En lo referente al sistema de verificación acústica de las edificaciones, para la obtención de la licencia de primera ocupación o utilización de los edificios o bien para posteriores licencias de ocupación o utilización, siempre y cuando sean consecuencia de obras que requieran proyecto técnico de edificación conforme a lo previsto en el artículo 2.2 de la Ley 38/1999, de 5 de noviembre, de Ordenación de la Edificación, se exigirá el cumplimiento de lo establecido en el Código Técnico de la Edificación, mediante informe de ensayo acústico ajustado a los requisitos establecidos en la instrucción técnica 5 y realizado por las entidades que establezca la normativa que le sea de aplicación.»
- IT 5, pp. 2738/63–64:
  - «1. Junto a la documentación que deba presentarse a los efectos de obtener la licencia de primera ocupación o utilización de un edificio, la persona promotora deberá presentar un informe de ensayo, que justifique los siguientes extremos: Que se cumple con los aislamientos acústicos exigidos en el documento básico DB-HR […]. Que las instalaciones comunes del edificio no producen en los recintos protegidos destinados a usos de vivienda, hotelero, docente, hospitalario o administrativo, niveles sonoros en el lugar superiores a los valores límite establecidos.»
  - «2. Las comprobaciones de aislamiento acústico a ruido aéreo entre viviendas se llevarán a cabo mediante un muestreo representativo en, al menos, un 10% de las viviendas de la promoción. Cuando este 10% sea inferior a la unidad se comprobará al menos en una. […]»
  - «3. […] ruido aéreo de fachadas […] al menos, un 10% de las viviendas de la promoción. […]»
  - «4. […] ruido de impacto […] al menos, un 10% de las viviendas de la promoción. […]»
  - «5. […] entre recintos que puedan albergar actividades y recintos habitables, se llevarán a cabo en todos los casos existentes.»
  - «6. […] entre recintos que alberguen instalaciones y recintos habitables, se llevarán a cabo en todos los casos existentes.»
  - «7. Las comprobaciones de niveles sonoros de instalaciones comunes del edificio, se llevarán a cabo para todos los casos existentes en el edificio.»
  - «8. La comprobación de niveles sonoros de bajantes sanitarios del edificio y restantes instalaciones sanitarias, se llevarán a cabo en la vivienda o viviendas más afectadas, en las condiciones más desfavorables. […]»
  - «9. El cumplimiento en los casos muestreados no exime del cumplimiento en los casos no muestreados.»
  - «10. Para las viviendas unifamiliares aisladas las comprobaciones que se deben aportar serán las de aislamiento acústico a ruido aéreo de fachadas.»
- Art. 44.1.e y 44.3, p. 2738/36: son ensayos acústicos «e) Los ensayos acústicos previstos en la instrucción técnica 5». «3. Serán competentes para la realización de ensayos acústicos el personal técnico competente definido en el artículo 3.a) y las entidades colaboradoras en materia de calidad ambiental en el ámbito de contaminación acústica, reguladas por el Decreto 334/2012, de 17 de julio, […].»
- IT 4, p. 2738/63: índice mínimo del informe de ensayo (entidad, solicitante, objeto, normativa, instrumentación, metodología, resultados, conclusiones, anexos).
- Anexo, ap. 1.g e i: normas de medición in situ UNE-EN ISO 16283-1:2015 (+A1:2018) y UNE-EN ISO 16283-2:2021.
- Disp. derogatoria única, p. 2738/6: deroga «específicamente, el Decreto 6/2012, de 17 de enero». DF 2.ª, p. 2738/7: en vigor «a los 20 días de su publicación». Publicado el 04-03-2025 → **24-03-2025** (INTERPRETACIÓN del cómputo; Iberley da la misma fecha, LEÍDO (web)).
- Notas de la Consejería:
  - [FAQ18], 26-04-2018, bajo el Decreto 6/2012: concluye que los ensayos de la IT.5 deben hacerlos laboratorios con declaración responsable de ensayos de acústica e inscritos en el Registro del Decreto 67/2011.
  - [FAQ26], 23-03-2026: aclara cómo validar el ruido de instalaciones comunes según la IT 5 («Se recomienda aplicar el muestreo de la norma UNE-EN_ISO_16032:2024 y como procedimiento de medición el descrito en la I.T.2. del Decreto 50/2025»). Da una lista de casos: ascensores/dormitorio, puerta de garaje, grupo de presión, bajantes, sanitarios y climatización.

**INTERPRETACIÓN.**
- **Quién mide.** Hay tensión entre tres textos:
  - el art. 27.3 dice «las entidades que establezca la normativa que le sea de aplicación»;
  - el art. 44.3 dice «personal técnico competente» y entidades colaboradoras ambientales;
  - la nota de 2018, anterior al Decreto 50/2025, dice laboratorio inscrito según el Decreto 67/2011.
- La nota de 2026 no lo resuelve → **SIN CONFIRMAR**. La app no debe afirmar quién mide. Basta con «laboratorio o entidad competente según el art. 27.3 del Decreto 50/2025».
- El Decreto 50/2025 cita la Ley 7/2007 (GICA). Según `verificacion-residuos.md` K-RCD.11, la GICA quedó derogada por la Ley 2/2026 (LEGAM) desde el 20-06-2026. Su desarrollo reglamentario conserva la vigencia «en todo aquello que no contradiga» la LEGAM. → El Decreto 50/2025 sigue aplicándose. La remisión a la GICA no afecta al art. 27.3 ni a la IT 5.

**Para la app.**
- Obra en Andalucía con proyecto LOE art. 2.2 y uso con DB-HR → la sección «Obra terminada» incluye **siempre** el bloque «Ensayos acústicos in situ (Decreto 50/2025, art. 27.3 e IT 5)».
- Número de ensayos calculado con las reglas de la IT 5: 10 % de viviendas con mínimo 1 para aéreo, fachada e impacto; «todos los casos» para recintos de actividad o instalaciones e instalaciones comunes; vivienda más afectada para bajantes.
- **Unifamiliar aislada:** solo fachada.
- Recordar en el texto el ap. 9 de la IT 5.
- **No citar** el «Decreto 6/2012», ni el «RD 6/2012».

---

## K-PCC.48 — BCCA: edición vigente, capítulo 18 y condiciones de uso

**Respuesta.**
- La última BCCA publicada a 2026-10 es la **«Actualización … Enero de 2024»**: fichero `BCCA2023_V02.bc3`, «Dic-2023» en el enlace. Corrige erratas de la de **julio 2023**.
- La fecha de los conceptos es **05-12-2022 («051222»)**, la misma de la BCCA 2023 que tiene la app. No hay edición 2025 ni 2026 en la web oficial.
- El capítulo **18 «CONTROL DE CALIDAD, PRUEBAS Y ENSAYOS»** se creó en la edición de 2023.
- La titularidad es de la Consejería. **Licencia específica: SIN CONFIRMAR** (ver más abajo).

**Cita.**
- Página «Base de Costes de la Construcción de Andalucía (BCCA)», LEÍDO (web):
  - lista, de más reciente a más antigua: ene-2024; jul-2023 (corrección de errores); jul-2023; dic-2021; jul-2017; …
  - la página ene-2024 dice: «La labor realizada en la presente actualización […] del mes de enero de 2024, consiste en la corrección de varias erratas localizadas en los distintos informes publicados en julio 2023. El resultado […] es un banco de costes de la construcción de Andalucía con unos 6.600 precios, tal como se contempla en el archivo "BCCA2023_V02.bc3"»;
  - «La titularidad de la Base de Costes de la Construcción de Andalucía corresponde a la Consejería de Fomento, Articulación del Territorio y Vivienda de la Junta de Andalucía»;
  - «la BCCA se entiende como base de precios de referencia del ámbito de actuación de esta Consejería»;
  - anuncia una futura «licitación de un BCCA más ambicioso» → SIN CONFIRMAR que haya salido.
- Página jul-2023, LEÍDO (web): «Se crea el capítulo CONTROL DE CALIDAD, PRUEBAS Y ENSAYOS con su respectiva reestructuración para incorporar las partidas de los ensayos y pruebas que se realizan en construcción.»
- Fichero `BCCA2023_V02.bc3`, **VERIFICADO (texto)**:
  - `~C|18#||CONTROL DE CALIDAD, PRUEBAS Y ENSAYOS|`;
  - subcapítulos 18A Áridos y suelos, 18B Baldosas y revestimientos, 18C Cimentación, 18E Estructuras de fábrica, 18H Estructuras de hormigón, 18I Instalaciones, 18K Carpintería y vidrios, 18M Estructuras de madera, 18O Morteros, yesos, cales, escayolas y cementos, 18P Pinturas, 18R Materiales cerámicos y bloques de hormigón, 18S Estructuras de acero, 18T Aislamientos e impermeabilizaciones, 18U Pruebas de servicio;
  - **618 conceptos** con precio en el cap. 18 (615 con fecha 051222);
  - cada partida trae texto (`~T`) con la norma de ensayo. Ejemplo: «18ALF00010 … Análisis granulométrico de suelos … 44 € … siguiendo la norma UNE-EN ISO 17892-4:2019».
  - Diferencia entre jul-2023 corregido y V02 en el cap. 18: **un solo** registro (18UBB00070, sufijo de código).
  - **CORREGIDO (muestra):** 18UAA00010 cita «D 6/2012 JJAA», derogado (K-PCC.47).
- [AVISO], LEÍDO (web): CC BY 3.0 ES para los «textos» del Portal. Sobre el BC3 no hay una licencia propia.

**INTERPRETACIÓN.**
- Importar el BC3 y usar sus precios en un presupuesto es su **uso previsto**: la página explica cómo importarlo en un «programa de Mediciones».
- Redistribuir la BCCA completa dentro de la app es otra cosa. Exige, como mínimo, la atribución del Portal y no sugerir respaldo de la Junta. Si la base de datos queda cubierta por la licencia de «textos», es dudoso → **SIN CONFIRMAR**. La opción más prudente: el usuario la importa desde el fichero oficial, como ya hace la app.
- Los textos de norma de las partidas pueden haber quedado desfasados respecto al CTE y al Código Estructural vigentes. Ejemplo: la cita al Decreto 6/2012. Los resuelven los otros verificadores.

**Para la app.** Si la obra está en Andalucía y el usuario tiene cargada la BCCA, el precio por defecto de cada ensayo del PCC sale de las partidas **18…** de la BCCA, con su código. Si no hay BCCA, el precio lo pone el proyectista. Etiqueta: «BCCA 2023 (V02, publicada ene-2024), cap. 18».

---

## K-PCC.49 — Colegios de Málaga y otras normas andaluzas

### a) COA Málaga, COAAT Málaga, Consejo Andaluz de COAAT

**Respuesta.** No se ha encontrado ningún **modelo obligatorio** de plan de control exigido para el visado en Málaga. Ni el COA Málaga ni el COAAT Málaga lo exigen, según lo leído.
- El visado del proyecto de ejecución y del certificado final de obra es el del **RD 1000/2010**, art. 2. El CFO incluye la documentación del CTE, anejo II.3.3.
- El Consejo Andaluz de COAAT ofrece **DocArqT**, herramienta gratuita para colegiados andaluces, para la documentación del control (recepción, ejecución, obra terminada) y la relación de controles y resultados que acompaña al CFO.

**Cita.**
- COA Málaga, «Informe sobre las exigencias de visado colegial obligatorio …» (Comisión de Secretaría, 06-03-2014, `pdf\COAMA_Informe_CS20140306.pdf`), **VERIFICADO (texto)**: reproduce el RD 1000/2010 art. 2: «b) Certificado de final de obra de edificación, que incluirá la documentación prevista en el anexo II.3.3 del Real Decreto 314/2006 […]». El visado comprueba la «integridad formal de la documentación […] con arreglo a la normativa de obligado cumplimiento». No menciona el plan de control.
- COAAT Málaga, noticia de 25-11-2024, LEÍDO (web): DocArqT es «gratuita para las personas colegiadas de Andalucía»; facilita «La automatización de la relación de controles y sus resultados» y el «depósito documental para el certificado final de obra», que se presenta «junto al certificado final de obra para su visado, tal y como exige el Código Técnico de la Edificación».
- docarqt.com, LEÍDO (web): «una iniciativa del Consejo Andaluz de Colegios Oficiales de Aparejadores y Arquitectos Técnicos». Cita CTE arts. 7.2 y 7.3 y anejo II. No cita el Decreto 67/2011.
- Muestra `A3.plan_control_cte_catarquitectosdecadiz.txt`: hay un modelo del COA de Cádiz, que no es obligatorio en Málaga. No se ha verificado su estado.

**SIN CONFIRMAR:**
- si el COA Málaga tiene ficha o modelo propio de PCC o lo comprueba en el visado;
- si el COAAT Málaga exige DocArqT o un formato concreto de la relación de controles.

### b) Otras normas andaluzas con control en obra de edificación privada

| Norma | Qué aporta al PCC | Veredicto |
|---|---|---|
| Decreto 50/2025 (acústica) | Ensayos in situ de la IT 5 para la licencia de ocupación | **VERIFICADO (texto)**, K-PCC.47 |
| Ley 5/2025 de Vivienda | Sistemas de control y acreditación de resultados en vivienda | **VERIFICADO (texto)**, K-PCC.46 |
| Decreto 293/2009 (accesibilidad) | Excluido por el encargo | — |
| Ley 3/2023 / Decreto 73/2012 (RCD) | Gestión de residuos, no control de calidad | ver `verificacion-residuos.md` |
| Instalaciones (puesta en servicio, OCA, pruebas de instaladores) | Seguridad industrial, sobre todo estatal (RITE, REBT, RIPCI…). No se ha encontrado norma andaluza que añada ensayos al PCC de edificación | **SIN CONFIRMAR**. No se codifica nada autonómico |
| Ordenanzas municipales (p. ej. Málaga, documentación para la licencia o DR de ocupación) | Pueden pedir certificados o ensayos (acústica, telecomunicaciones…) | **SIN CONFIRMAR** (no leídas) |

---

## Para la app

### (a) Qué cambia el PCC cuando la obra está en Andalucía

1. **Marco normativo** (sección inicial), además de lo estatal:
   - «Decreto 67/2011, de 5 de abril, por el que se regula el control de calidad de la construcción y obra pública (BOJA núm. 77, de 19-04-2011), arts. 1.2, 3 y 4».
   - Si el uso es vivienda: «Ley 5/2025, de 16 de diciembre, de Vivienda de Andalucía, arts. 27 y 29».
   - Si hay DB-HR: «Decreto 50/2025, de 24 de febrero, Reglamento para la preservación de la calidad acústica en Andalucía, art. 27.3 e IT 5».
2. **Obligatoriedad y presupuesto:** una frase con la cita del art. 3.1 del Decreto 67/2011: el proyecto incluye el plan «con su correspondiente presupuesto». Ningún porcentaje del PEM.
3. **Las tres fases** (recepción, ejecución, obra terminada) pueden citar el art. 3.2 a), b) y c) del Decreto 67/2011 junto al CTE. Cada ensayo de recepción lleva **muestreo, ensayo, criterio de aceptación/rechazo y acción**: es el contenido que exige el art. 3.2.a.3.º.
4. **Laboratorios:** el texto tipo de K-PCC.44 (declaración responsable, Registro andaluz, incompatibilidades del art. 7).
5. **Obra terminada:** bloque obligatorio de **ensayos acústicos in situ (IT 5)**, con su regla de muestreo. Unifamiliar aislada: solo fachada.
6. **Vivienda:** apartado «Agentes del control y acreditación de resultados», con la cita del art. 29 de la Ley 5/2025.
7. **Códigos y precios:**
   - código de la Relación de ensayos de la Junta [REL] 2024 como dato opcional por ensayo;
   - precio por defecto de la **BCCA 2023 V02, cap. 18**, si está cargada.
8. **Lo que no se genera:** el apartado de «ensayos adicionales de la Junta» del art. 1.3. La obra es privada y ese apartado es solo de obra pública.

### (b) Qué se pide al proyectista

- Uso del edificio y si es **vivienda**: activa la Ley 5/2025.
- Si la obra requiere **proyecto según la LOE art. 2.2**: activa la IT 5.
- Si es **unifamiliar aislada** (IT 5 ap. 10).
- Número de viviendas o recintos y casos de la IT 5: recintos de actividad, recintos de instalaciones, lista de instalaciones comunes, vivienda más afectada por bajantes.
- Opcional: laboratorio y entidad de control previstos. Solo si ya se conocen; normalmente los fija la DF.
- Dónde va el presupuesto del control (capítulo propio, a cargo de la propiedad o de la contrata). La norma no lo fija.
- Si quiere aplicar los «niveles» recomendados de la hoja de la Consejería. Es una recomendación, no una norma. Requiere permiso para reproducir sus datos.

### (c) SIN CONFIRMAR (no se codifica)

- Si hay alguna modificación del Decreto 67/2011 posterior a 2011. No existe consolidado oficial.
- Si la hoja [PCC-JA] es «documento reconocido» (Sección Tercera del Registro), qué es «JAFIOT / SGT-01-2022» y bajo qué licencia se publica.
- Si la licencia CC BY 3.0 del Portal cubre bases de datos y hojas de cálculo (BCCA, [PCC-JA], [REL]) y no solo «textos».
- Si existe una BCCA posterior a la V02 de enero de 2024 o se ha licitado la «BCCA más ambiciosa».
- Si hay normas técnicas de «estándares y niveles de control» de vivienda (Ley 5/2025, art. 30.a) o modelo de Manual del Usuario (art. 31.4).
- Quién está habilitado para los ensayos de la IT 5: laboratorio inscrito según el Decreto 67/2011, o personal técnico competente o entidad colaboradora según el Decreto 50/2025, arts. 27.3 y 44.3.
- El origen del «1 % del PEM» en control de calidad. Es contratación pública y no aplica a la obra privada.
- Exigencias propias del COA Málaga o del COAAT Málaga sobre el PCC en el visado. Ordenanzas de Málaga y municipios de la provincia sobre documentación de ocupación.
- Norma andaluza de instalaciones que añada ensayos al PCC.

### (d) Citas andaluzas derogadas o erróneas (no imprimir nunca)

| Cita | Situación | Sustituir por |
|---|---|---|
| Decreto 13/1988, de 27 de enero (control de calidad) | Derogado por el Decreto 67/2011, disp. derog. a) | Decreto 67/2011 |
| «Programa de Control de Calidad» del director / «certificación final» del Decreto 13/1988, art. 2.2–2.3 | Derogado | CTE Parte I art. 7.4 y anejo II (otro verificador) |
| Decreto 21/2004 (acreditación y registro de entidades) | Derogado (b) | Decreto 67/2011, arts. 9–16 |
| Orden de 15-06-1989 (Registro de Entidades Acreditadas) | Derogada (c) | Registro del Decreto 67/2011 |
| Órdenes de 18-02-2004, 20-06-2005 y 06-11-2008 (áreas de acreditación de laboratorios y entidades) | Derogadas (d–f) | Declaración responsable + Relación de ensayos (Decreto 67/2011, art. 11) |
| «Laboratorios acreditados por la Junta» / «acreditación» como requisito | Régimen sustituido por la declaración responsable (Decreto 67/2011, exposición de motivos y art. 11.3) | «laboratorio con declaración responsable e inscrito en el Registro…» |
| Decreto 6/2012, de 17 de enero (contaminación acústica); «RD 6/2012 JJAA» (hoja [PCC-JA]); «D 6/2012 JJAA» (BCCA 18UAA00010) | Derogado por el Decreto 50/2025. Además, no es real decreto | Decreto 50/2025, art. 27.3 e IT 5 |
| «Decreto 67/2011 … B.O.J.A. 19/11/2012» (muestra `101_MEM_MEMORIA`) | Fecha errónea | BOJA núm. 77, de 19-04-2011 |
| Ley 7/2007 (GICA), cuando se cite como base del reglamento acústico | Derogada por la Ley 2/2026 desde el 20-06-2026 (ver `verificacion-residuos.md` K-RCD.11) | Citar el Decreto 50/2025 sin la remisión a la GICA |
| Hoja «Plan de Control de Calidad … v03, octubre 2022» | Sustituida por la v04, enero 2023 (mismos datos) | v04 |
