# Verificación · Plan de control de calidad (CTE, con Andalucía como caso particular)

> Fecha: 2026-10-24. Etapa 0 del plan de control de calidad (el plan está en
> `docs/plan-control-calidad.md`). No se ha tocado código.
> Petición: «Añadir el Plan de control de calidad del CTE». Alcance acordado: estructura calculada
> por lotes, recepción y ejecución por familia de producto, pruebas de obra terminada y valoración.
> El seguimiento durante la obra (registrar ensayos reales, actas) queda para después. CTE genérico
> con Andalucía como caso particular. Precios de la BCCA o de CYPE. Obra privada.

## Qué hay aquí

| Fichero | Qué verifica | Criterios |
|---|---|---|
| [A-cte-general.md](A-cte-general.md) | CTE Parte I (arts. 5–7, anejos I y II), LOE, RD 410/2010, Reglamentos (UE) 305/2011 y 2024/3110, RC-16, el control de cada DB, RITE, REBT, RIPCI, ICT, gas, normas derogadas | K-PCC.1–19 |
| [B-codigo-estructural.md](B-codigo-estructural.md) | Código Estructural (RD 470/2021): control del hormigón (tabla 57.5.4.1, modalidades, durabilidad), acero, ferralla, acero estructural, control de ejecución (tabla 63.1), y contraste con la hoja de la Junta | K-PCC.20–39 |
| [C-andalucia.md](C-andalucia.md) | Decreto 67/2011, Ley 5/2025 de Vivienda, Decreto 50/2025 (acústica), Relación de ensayos declarados, hoja de la Consejería, BCCA | K-PCC.40–49 |
| [D-ejemplos.md](D-ejemplos.md) | Los ejemplos de `ejemplos pdf/control calidad/` (no versionados), la hoja de la Junta V03/V04, su enlace con el capítulo 18 de la BCCA 2023 y la tabla «familia de partida → controles» | K-PCC.50–72 |

Método (el mismo de `Instalaciones/research/verificacion-residuos.md`): PDF oficiales descargados
del BOE, del BOJA, del DOUE (copia de boe.es) y de codigotecnico.org, volcados con `pdftotext`,
y cita literal con la página impresa. Las tablas a dos columnas y los anejos del Código Estructural
que son imagen se cotejaron renderizando la página. Veredictos: **VERIFICADO (texto / imagen)**,
**LEÍDO (web)**, **INTERPRETACIÓN**, **CORREGIDO**, **SIN CONFIRMAR** (no se codifica).
Los volcados (`volcados/…` en los informes) están fuera del repo. Lo que sale de los ejemplos del
estudio se cita sin datos de la obra.

---

## Lo que cambia el planteamiento

1. **Es obligatorio, y lleva presupuesto.** El CTE pone el «Plan de control de calidad» como anejo
   de la memoria del proyecto de ejecución, no del básico. Además, el presupuesto «Incluirá el
   presupuesto del control de calidad» (K-PCC.5). En Andalucía, el Decreto 67/2011 alcanza a
   **toda** obra, pública o privada (art. 1.2), y el proyecto lleva el plan «con su
   correspondiente presupuesto» (art. 3.1) (K-PCC.41–42). El Código Estructural pide que el coste
   del control de la estructura vaya **independiente** en el presupuesto, a cargo de la propiedad
   (arts. 17 y 19) (K-PCC.21). Ninguna norma fija un % del PEM: el «1 %» es de contratación pública.
2. **La estructura es lo único que se calcula de verdad**, y la tabla 57.5.4.1 está verificada en
   imagen. Un lote no puede pasar de **ninguno** de los límites de su fila (volumen, semanas, m²
   construidos, **2 plantas**) ni de 6 semanas. Con distintivo, los límites se multiplican por 5,
   N = 1 y hay un mínimo de 3 lotes (K-PCC.27). Hay 16 casos de prueba resueltos (K-PCC.29 y B
   «Para la app» A6).
3. **La hoja de la Junta calcula mal los lotes**, y la V04 (enero 2023) es la V03 con otra
   portada. No aplica el límite de 2 plantas ni el de tiempo: con pilares de 3 plantas da 1 lote
   y 3 amasadas, y el Código da 2 y 6. Tampoco calcula el hormigón con distintivo, que es el caso
   corriente. Pierde filas, deja tomas fraccionarias y cita la EHE-08 en encepados
   (K-PCC.38–39, K-PCC.55–59). **El cálculo es propio**; la hoja sirve de contraste.
4. **Armaduras:** con ferralla de taller se controla la ferralla (art. 59.2: lotes de 25 t), no
   las barras (art. 58: 30 t por serie). Ni la hoja de la Junta ni la BCCA tienen partida para
   eso. Además, la BCCA no tiene **ningún** ensayo de barras ni de mallas (K-PCC.31–32, D §4).
5. **El CTE casi no impone pruebas.** Solo son obligatorias las de fontanería (HS 4) y
   saneamiento (HS 5), y ambas las hace la empresa instaladora. Los DB HS 1, HS 3, HE (todas las
   secciones), HR, SI y SUA no prescriben pruebas finales. La prueba de estanqueidad de la
   cubierta plana, el blower door y la acústica in situ son **a criterio del proyecto** (art. 7.4)
   (K-PCC.12–15). Las instalaciones las rigen sus reglamentos: RITE, REBT, RIPCI, ICT y gas
   (K-PCC.17–18).
6. **En Andalucía hay dos obligaciones nuevas:**
   - **Decreto 50/2025, IT 5:** ensayo acústico in situ para la licencia de primera ocupación,
     con muestreo mínimo (10 % de viviendas, como mínimo una). En la unifamiliar aislada, solo la
     fachada (K-PCC.47).
   - **Ley 5/2025 de Vivienda, arts. 27 y 29:** sistemas de control con laboratorios y
     acreditación del resultado (K-PCC.46).

   El «libro de control», el «programa de control» y la «certificación final» andaluces eran del
   Decreto 13/1988, que está derogado (K-PCC.43).
7. **Productos:** hay que citar **dos reglamentos**. El 305/2011 sigue vigente en parte hasta
   2040 y el 2024/3110 se aplica desde el 08-01-2026. El test de citas derogadas **no** debe
   vetar el 305/2011. El RD 1630/1992 está derogado entero, y el art. 5.2.1 del propio CTE cita
   normativa superada, así que no se copia (K-PCC.1, 9 y 10). Los laboratorios presentan
   declaración responsable; ya no se «acreditan» ni se «homologan» (K-PCC.8 y 44).
8. **Ninguna fuente sola basta.** El plan de CYPE (ejemplo de 2025) da el control de ejecución
   partida a partida, pero no multiplica las frecuencias por la medición. La hoja de la Junta da
   ensayos y pruebas de servicio. La recepción documental no la trae ninguna de las dos. La app
   junta las tres capas (D §6).
9. **Los planes reales del estudio no sirven de modelo:**
   - Son la plantilla de Cádiz de 2007 (EHE-98, RL-88, NBE) con «Cod. Estructural» encima.
   - Valoran entre el 0,06 % y el 0,08 % del PEM con cuatro pruebas de servicio.
   - No incluyen ningún ensayo de hormigón ni de acero, aunque haya micropilotes y estructura
     metálica.

   La app debe avisar de un plan pobre (D §1.5–1.6, K-PCC.61).
10. **Hay que validar las designaciones de hormigón** de los presupuestos antes de usarlas. Salen
    nomenclaturas EHE (`IIa`) y erratas (`CX1`, `XC2a`), y de la clase de exposición dependen los
    ensayos de durabilidad (K-PCC.52). Es la misma comprobación que la de los códigos LER en
    residuos.
11. **BCCA 2023 V02:** es la última publicada, la misma que maneja el estudio. Su capítulo 18
    copia los precios de la hoja de la Junta. Aun así:
    - casarlos solo por precio da emparejamientos falsos (210 € es a la vez la química del acero
      y la compresión de suelo-cemento);
    - sus textos `~T` arrastran nomenclatura EHE.

    Hace falta una tabla curada ensayo ↔ código BCCA, y los textos de banco pasan por la lista
    negra (K-PCC.67–68).

### Contradicciones entre informes, ya resueltas

- **V04 de la hoja:** B la da por «no analizada»; C y D la compararon celda a celda con la V03 y
  los datos son idénticos. Vale lo dicho en B para la V04.
- **Tamaño del capítulo 18 de la BCCA:** 790 conceptos `~C` con prefijo 18, incluidos los
  capítulos y los auxiliares `.1`. 618 ensayos con norma en su texto (C). 354 partidas distintas
  (D). Cuentan cosas distintas; para el enlace vale la cifra de D.
- **Acero estructural:** A transcribe el DB SE-A 10.8 (END: 5 primeras uniones y luego 1 de cada
  5). B dice que el Código Estructural solo obliga a la inspección visual del 100 % de los
  cordones, con los END según el plan (anejo 17, orientativo). No está confirmado cómo conviven
  el DB SE-A y el Código en edificación: SIN CONFIRMAR, y la app los propone como «a criterio del
  plan».
- **Acústica in situ:** según el CTE es opcional (A); en Andalucía es obligatoria por la IT 5 del
  Decreto 50/2025 (C). La regla de la app depende de la comunidad.

## Licencias (antes de meter datos en el repo)

- **Hoja de la Junta:** recomendación con número de registro (JAFIOT / SGT-01-2022), firmada
  también por la Asociación de Laboratorios y laboratorios privados, y sin licencia expresa. **No
  se copia su catálogo (lotes, niveles, precios) sin permiso**, como pasó con los ratios de
  ECO-eficiencia en residuos (K-PCC.45).
- **BCCA:** el aviso legal del portal (CC BY 3.0) habla de «textos»; no está confirmado que cubra
  la base de datos (K-PCC.48). La app ya funciona sin traer bancos incluidos: el usuario carga el
  .bc3 en Referencia. Así que **lo seguro es versionar solo el enlace ensayo → código BCCA**, que
  es un dato de hecho, y tomar el precio del banco que el usuario tenga cargado (BCCA o CYPE),
  o pedirlo.
- **La norma** (Código Estructural, CTE, decretos) se puede codificar sin problema: es la fuente
  de los lotes y de las frecuencias.

## SIN CONFIRMAR (no se codifica)

Vienen detallados en la sección (c) de «Para la app» de cada informe. Los que afectan al diseño:

- Código Estructural:
  - si el × 5 del distintivo alcanza también a plantas y semanas (el diario original del BOE no
    lo aclara);
  - qué hacer con un lote que tiene menos amasadas reales que N;
  - el anejo 4 (documentación de suministro);
  - la lista vigente de distintivos.
- Si hay alguna familia de productos ya obligada por el Reglamento 2024/3110, y el real decreto
  español que lo desarrolla (en proyecto, TRIS 2025/0632/ES).
- Quién puede hacer los ensayos de la IT 5 (el Decreto 50/2025, arts. 27.3 y 44.3, no dice lo
  mismo en los dos sitios).
- Si el COA o el COAAT de Málaga piden algo propio en el visado.
- Los códigos CYPE de la tabla «familia → controles» que no salen del ejemplo de 2025, a
  confirmar con un .bc3 de CYPE.
- El cruce de los códigos DR de la hoja con la Relación de ensayos de 2024: C da 162 de 166
  coincidencias en una muestra; el cruce completo quedó sin hacer.

## Decisiones que hay que cerrar antes del plan

> **Cerradas el 2026-10-24** (ver `docs/plan-control-calidad.md`, D1–D3): el catálogo de la hoja
> de la Junta es de uso libre y se usa como fuente de ensayos, corregido donde la norma lo
> contradice (sin pedir permiso, a diferencia de lo que se propone abajo y en «Licencias»); las
> pruebas de instalaciones van a cargo del instalador y sin coste; por defecto, hormigón sin
> distintivo y control de ejecución normal. La 3 y la 4 pasan al plan como D4 y §6.

1. **Catálogo de ensayos.** Propuesta: tabla propia escrita desde la norma (CodE, CTE, RC-16,
   reglamentos de instalaciones), con el enlace a códigos BCCA y sin los precios ni los
   «niveles» de la Junta. En paralelo, pedir permiso a la Consejería y a la Asociación de
   Laboratorios para usar su catálogo, igual que con ECO-ARQ.
2. **Pruebas de servicio de instalaciones:** ¿van sin coste, como obligación del instalador, o
   al capítulo de control con precio de laboratorio? Los planes del estudio hacen las dos cosas.
   Propuesta: por defecto, a cargo del instalador y listadas sin coste, diciéndolo; se pueden
   pasar al capítulo de una en una.
3. **Capítulo de control en el presupuesto:** «Crear capítulo de control de calidad» como el de
   gestión de residuos, con coherencia entre el texto y el capítulo, y aviso de plan pobre.
4. **Datos que la app pide** porque el presupuesto no los trae: superficie construida y plantas
   por grupo de elementos, número de viviendas, distintivo del hormigón (por defecto «sin», lo
   más exigente, con aviso), procedencia de la ferralla, nivel de control de ejecución (normal
   por defecto) y semanas de hormigonado (opcional).
