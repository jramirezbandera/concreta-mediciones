# Plan · Estudio de gestión de residuos (RCD) desde el presupuesto

> Estado: APROBADO (2026-10-16). Todas las decisiones cerradas (§«Decisiones»); D8 se
> resuelve de forma PROVISIONAL con ECO-eficiencia mientras se pide permiso.
> Hecho: E0.1 y E0.2 (tabla LER y operaciones transcritas del DOUE y del BOE) y E1 (motor y
> tablas en `src/core/rcd/`, con los datos de ECO-eficiencia extraídos de su hoja por
> `scripts/rcd/extraer_ecoeficiencia.py` y comprobados contra la propia hoja en Excel),
> E2 (esquema v7, store, vista «Residuos» y pestaña en el detalle de la partida; la vista y
> el editor van en chunks aparte), E3 (Word, avisos de coherencia y «Crear capítulo de
> gestión») y la IMPORTACIÓN de E4 (`~R`/`~X`, contrastada con el estudio impreso de una
> obra real de CYPE). Falta: la exportación de `~R` (E4, tras probarla en Presto y
> Arquímedes), E5 (tabla propia o permiso de ECO-ARQ), E6 («Sugerir con IA») y E7.
> La verificación normativa NO se rehace: se cita la de Instalaciones,
> `D:\PROGRAMACION\Instalaciones\research\verificacion-residuos.md` (criterios K-RCD.1–17,
> 2026-10-16). El contexto del otro proyecto está en `D:\PROGRAMACION\Instalaciones\PLAN-MEMORIA.md`,
> §4.3 y §5.8.

## Petición

«Añadir a concreta-mediciones el estudio de gestión de residuos de construcción y demolición
de un proyecto de ejecución, generado desde el presupuesto de la obra. Es un documento
obligatorio (RD 105/2008). Hoy lo hacemos con una plantilla de Word con normativa derogada y
ratios de origen desconocido. Mediciones ya conoce las partidas y sus mediciones: que saque las
cantidades por código de residuo y el documento.»

Contenido exigido (RD 105/2008, art. 4.1.a, con la Ley 7/2022; K-RCD.2): 1.º estimación en t y
m³ por código de la lista europea; 2.º prevención; 3.º operaciones de destino por código; 4.º
separación en obra; 5.º planos; 6.º pliego; 7.º coste de la gestión en capítulo independiente;
y el inventario de peligrosos en demolición, rehabilitación, reparación o reforma (art. 4.1.b,
K-RCD.3). En proyecto básico, 1.º–4.º, 7.º y el inventario (art. 4.2).

## Objetivo medible

- **Reforma pequeña de vivienda:** el estudio sale del presupuesto sin teclear ninguna cantidad
  que el presupuesto ya tiene. Cada tonelada del 1.º sale de una partida, con su cuenta a la
  vista («38,50 m² × 0,060 t/m² = 2,31 t»).
- **Obra nueva unifamiliar:** el 1.º sale de la superficie construida por los ratios de la
  tabla propia (o los que teclee el proyectista, con su fuente), más las partidas que el
  presupuesto ya mide (excavación); o por partidas si el banco trae sus residuos (D9).
- **Nada en silencio:** ningún código entra en el documento sin que el usuario lo confirme. Lo
  que falta (gestor, precio, fianza, amianto, un espesor) sale como «pendiente», nunca
  supuesto.
- **Cero citas derogadas:** un test recorre el texto del Word y falla si aparece cualquiera de
  las de K-RCD.17 (Orden MAM/304/2002, Ley 10/1998, RD 833/1988, Decisión 96/350/CE, normas de
  Madrid, art. 104 de la Ley 7/2007, «a partir de yeso»…).
- **El 7.º cuadra con el presupuesto:** si la obra tiene capítulo de gestión de residuos, el
  coste del estudio ES ese capítulo, y la app avisa si sus cantidades no casan con la
  estimación.

## Lo que ha salido al explorar (cambia parte del encargo)

1. **El .bc3 sí tiene sitio para el residuo.** FIEBDC-3 define desde la versión 3/2016 el
   registro `~R` «Descomposición de residuos» y la información técnica `~X` con `ler` (código
   LER), `m` (masa, kg) y `v` (volumen, m³), con conceptos de tipo 4 («componentes adicionales
   de residuo») y 5 («clasificación de residuo») en el `~C`. Cada partida lleva sus residuos
   por unidad de medición, en cuatro tipos: 0 colocación (merma `rp` de un material de su
   `~D`), 1 demolición, 2 excavación y 3 embalaje. Fuente: especificaciones FIEBDC-3/2016
   (rev. 2020-11-23, «Registro tipo descomposición de residuos») y FIEBDC-3/2024 (pp. 11–15,
   con ejemplo del BEDEC), fiebdc.es.
   - Nuestro exportador ya declara `FIEBDC-3/2016` en el `~V` (`core/bc3export.ts`), pero no
     escribe `~R` ni `~X`.
   - El importador ignora los dos: el parser del vendor lee `~X` y lo cuelga de
     `ConceptNode.itCodes`, pero `bc3ToObra` no lo usa; `~R` no tiene parser y sale en el
     aviso «registros de tipo no soportado» (`core/bc3import.ts`).
   - **El .bc3 del Generador de precios de CYPE lo trae relleno** (muestra
     `docs/spike/samples/REC010…bc3`, FIEBDC-3/2016): `~X` con `ler`, `m` y `v` en cada
     material, conceptos `re150101`, `re170201`… de tipo 4 en kg, y `~R` en la partida y en
     sus materiales.
   - **La BCCA 2023 (Presto 22, FIEBDC-3/2020) declara el diccionario `~X` pero no trae ni un
     dato ni un `~R`.** Para ella hace falta otra vía (reglas por código, D2).
   - **Comprobado con las obras del estudio** (`ejemplos pdf/Gestion de residuos/bc3/`, no
     versionado): con un lector de prueba, el `~R` del presupuesto de una obra de 2025 da **exactamente
     la tabla por código que imprimió el estudio de residuos de CYPE** de esa obra (20 códigos,
     t y m³, iguales al redondeo), embalaje de los materiales incluido. El cálculo es el de §10.
   - De las cuatro obras de Arquímedes, **dos traen `~R` y dos no**: las otras dos traen en su
     lugar los parámetros del generador de precios (`INFORMACION_GENERADOR` en el `~X`). Hay que
     averiguar con qué opción de exportación de Arquímedes salen los residuos.
   - En las dos que lo traen, el 70 % y el 64 % de las partidas tienen `~R`. El resto son
     partidas propias del estudio («Desmontaje y reposición…»), alzadas y mano de obra: pasan por
     las reglas (§4).
   - CYPE también usa códigos de minería: 01 04 08, 01 04 09 y 01 04 13 (40 t en una obra).
   - Consecuencia: la asignación se guarda en el modelo de Mediciones, pero **viaja en el .bc3
     con el registro estándar**, que Presto y CYPE saben leer (D4).
2. **Los datos de CYPE no son de fiar a ciegas.** La arena del ejemplo viene como `01 04 09`
   (capítulo 01, minería: no es RCD, K-RCD.9) y los envases metálicos como `15 01 04`, que no
   está entre los códigos verificados. Lo importado entra como propuesta y con aviso.
3. **Ningún estudio de los ejemplos sirve como fuente de ratios.**
   - Las dos memorias de obra nueva de `Instalaciones/ejemplos/` (plurifamiliar y unifamiliar)
     llevan la misma plantilla que la memoria de referencia: ratios de demolición del ITEC aplicados a obra
     nueva, y **la misma superficie y el mismo volumen en las dos obras**, es decir, una
     cuantificación arrastrada de otro proyecto.
   - Los ocho de `ejemplos pdf/Gestion de residuos/` (no versionados; dos del estudio, de 2025 y
     2026 en Málaga, y seis de terceros, casi todos de licitaciones públicas de otras
     comunidades) estiman con ratios de plantilla sin fuente (0,10, 0,15 o 0,20 m³ por m²
     construido, densidad única de 0,5 a 1,5 t/m³), reparten con la composición del Plan
     Nacional de RCD 2001-2006 (caducado) o con la tabla de demolición del ITEC. Ninguna cifra
     coincide entre fuentes, y en una de ellas el volumen sale de multiplicar la masa por la
     densidad.
   - Errores repetidos: códigos de minería (01 04 08 y 01 04 09), 17 09 04 como cajón de sastre,
     papel con el código municipal 20 01 01, peligrosos sin asterisco o calculados por
     porcentaje, ningún código de operación R/D, ningún inventario de peligrosos (dos son
     reformas), separación decidida en contra de su propio umbral, normativa derogada y de otra
     comunidad. Es la lista de lo que la app no debe poder producir.
   - Lo que sí vale como modelo: el estudio de 2025 del estudio, hecho con CYPE **por
     partidas** (mermas, embalajes y demoliciones de cada unidad de obra): tabla por código con
     densidad aparente, t y m³, esponjamiento de tierras, tabla de separación con «obligatoria»
     y coste igual al capítulo de gestión del presupuesto (2 % del PEM). Le faltan el inventario
     y los planos.
   - **El origen de la plantilla es la documentación de apoyo del COA de Málaga** (modelos de
     estudio para nueva planta y demolición y sus hojas de cálculo, 2008-2009, en la misma
     carpeta): «0,20 m de altura de mezcla de residuos por m² construido», densidad de 0,5 a 1,5
     t/m³ (0,9 en la hoja), reparto por porcentajes de la Comunidad de Madrid y del ITEC, tabla
     de demolición del ITEC, Orden MAM/304/2002 y umbrales del art. 5.5. El propio Colegio
     advierte que el importe de la aplicación ALCOREC 1.0 es la fianza de los ayuntamientos de
     Los Alcores, no el coste de la gestión, y que solo sirve para vivienda.
   - La «tabla propia» de la decisión 12 de PLAN-MEMORIA tiene que salir de otra parte (D8).
4. **La BCCA 2023 tiene un capítulo 17 «Gestión de residuos»** organizado por fracción
   (metales, asfaltos, hormigones y cerámicos…), con partidas en t o en m³ por distancia a
   planta. Es exactamente el «capítulo independiente» del 7.º, y se puede enlazar.
   - Las cuatro obras de Arquímedes llevan el capítulo G «Gestión de residuos» de CYPE:
     clasificación en obra (m³), transporte de tierras, transporte de residuos con contenedor y
     canon (contenedores por unidad) y canon por m³. En la obra de 2025 las partidas de tierras
     y de hormigón llevan justo los m³ de la estimación; el resto de
     fracciones va en «5 contenedores».
   - La obra de Presto (2020) gestiona por los cuatro grupos de la plantilla: tierras, pétrea, no
     pétrea, potencialmente peligrosos (m³), más una partida alzada de alquileres.
   - La coherencia del 7.º tiene que saber leer las tres formas: por código, por grupo y por
     contenedor (§6).
5. **Muchas demoliciones de la BCCA dicen «T. VERTEDERO»** en el resumen. En Andalucía el
   vertedero directo solo cabe si el tratamiento es inviable y se justifica (Decreto 73/2012,
   art. 86, K-RCD.7): el estudio diría «planta de valorización» y el presupuesto «vertedero».
   La app lo avisa.
6. **Las partidas de transporte y carga de escombros (m³) no generan residuo**: mueven el que
   ya generó la demolición. Contarlas sería doble cómputo. La regla las marca «no genera» y las
   usa solo para comprobar la coherencia.
   - Lo mismo, al revés, en la memoria de 2026 del estudio: unas demoliciones dicen «incluso
     carga y transporte» y otras «sin transporte», y la partida de gestión («retirada de
     residuos mixtos a planta, medido el volumen esponjado») ni cubre las segundas ni evita
     cobrar dos veces las primeras. Su estudio recoge una cuarta parte de lo que dan sus
     propias partidas. La app tiene que leer si cada demolición lleva ya el transporte (§6).
7. **Los m³ no son los mismos según la fuente.** El DB SE-AE da pesos del material colocado
   (macizo, K-RCD.15); el `v` de CYPE es volumen aparente (el mortero del ejemplo: 1.900 kg y
   1,27 m³ por m³, unos 1.500 kg/m³ de escombro), y el estudio de 2025 imprime m³ aparentes
   (hormigón a 1,50 t/m³, cerámicos a 1,25, madera a 1,10). Mezclarlos en una columna sin
   decirlo sería un error (D6).
8. **Hay una fuente andaluza con base de investigación: la herramienta «-RCDs =+
   ECO-eficiencia»** (equipo ECO-ARQ, ETS de Arquitectura de la Universidad de Sevilla,
   subvencionada por la Consejería de Fomento y Vivienda; manual de octubre de 2012 y hoja de
   cálculo de 2013, en la misma carpeta).
   - **Datos:** ratios por código LER en m³ aparentes por m² construido para vivienda de nueva
     planta en Andalucía (estudio de obras de VPO de 2009-2012), en tres grupos: envases (cap.
     15), restos (cap. 17) y tierras. Los corrige con coeficientes por tipología (plurifamiliar o
     unifamiliar, exento, entre medianeras, pareado), número de plantas, cimentación,
     estructura, forjado, cubierta, fachada y pavimento. Para otros usos, rehabilitación y
     demolición da un «nivel I» más grueso.
   - **Método** (Llatas, 2011, «A model for quantifying construction waste in projects
     according to the European waste list», *Waste Management*): residuo de cada elemento =
     cantidad del elemento × factor de envases, de restos o de tierras × factor de conversión ×
     factor de volumen aparente, sobre la estructura de capítulos de la BCCA. Es el mismo
     esquema que el `~R` (colocación y embalaje por unidad de obra), sin necesidad de que el
     banco lo traiga.
   - **Derechos:** el manual prohíbe la «difusión, comercialización o reproducción total o
     parcial» sin autorización escrita de la Consejería y de los autores. Como con la guía
     CGATE, ninguna cifra suya entra en el repo sin permiso (D8).
   - **Desfase:** decide la separación con los umbrales del art. 5.5 y cita la Orden
     MAM/304/2002; sus precios de gestión son de 2012. Vale como dato de generación, no como
     texto normativo.

## Qué ya existe (reuso)

- **Modelo** (`core/types.ts`): `Partida { code, title, ud, desc, med, cantidad?, items,
  fromBase?, baseSource? }`, capítulos y subcapítulos a N niveles. `partidaCantidad(p)`
  (`core/medicion.ts`) da la cantidad medida o la fija. `formaDeUd`/`medFormaDe`
  (`core/medForma.ts`) normalizan la unidad (m, m², m³, ud, kg…).
- **Esquema** (`store/schema.ts`): `SCHEMA_VERSION = 6`, `MIGRATIONS` en cadena,
  `DOMAIN_KEYS` con comprobación exhaustiva (autosave, Deshacer y serialización salen de ahí).
  Una versión más nueva deja la pestaña antigua en solo lectura (`persist/persist.ts`,
  `newerVersionOf`, Etapa 0 del plan de planos).
- **Totales** (`core/totales.ts`): costes directos, CI, PEM, PEC; `chapterTotal` por capítulo.
- **.bc3**: `core/bc3import.ts` (charset, árbol a N niveles, `~K`, avisos agrupados),
  `core/bc3export.ts` (códigos deterministas, `partidaSig` para homónimos, cp1252,
  sanitización), parser forkado en `src/vendor/bc3` (ya parsea `~X`).
- **Referencia e importar partida suelta** (`core/refdata.ts` `RefPartida`,
  `features/importar/importPartida.ts`, `features/referencia/obraSource.ts`): copiar partidas
  de un banco o de otra obra.
- **Word** (`features/exportar/docxRender.ts`, carga diferida desde `docx.ts`): A4, cabecera
  de obra (`obraMeta`), tablas con cabecera repetida, `cantSplit`, firma por rol. Los datos
  salen de constructores puros de `core/listado.ts`; el render no calcula.
- **Asistente de IA** (`src/ai/`): proveedores Gemini y OpenAI con esquema JSON
  (`ProviderChatFn(req, apiKey, model)`), validación fina (`validate.ts`), tarjetas de
  propuesta. Lección del commit 8136865: la IA inventaba códigos «tipo CYPE»; desde entonces
  el código lo pone la app. Aquí, los códigos LER le llegan como lista cerrada.
- **Datos de la obra** (`features/obra/ObraModal.tsx`, `Obra` con `[k]: unknown`): promotor,
  constructora, provincia…; `direccionFacultativa` para firmas.
- **Vistas** (`layout/types.ts`): `import | presupuesto | resumen | certificaciones`; detalle de
  partida con conmutador Medición / Descripción / Justificación (`DetailPanel.tsx`).

## Diseño

### 1. El cálculo: una función pura con un tipo claro

`core/rcd/calculo.ts`, sin store ni React:

```ts
calcularEstudioRcd(entrada: EntradaRcd, tablas: TablasRcd = TABLAS_RCD): EstudioRcd
// EntradaRcd = { chapters, partidas, rates, obra, estudio: EstudioRcdDatos }
```

`EstudioRcd` es el contrato que leerán el Word, la vista y, más adelante, la memoria de
Instalaciones (que no se construye ahora). Lleva su versión y la de cada tabla usada, para que
un documento se pueda reproducir:

```ts
interface EstudioRcd {
  version: { motor: 1; ler: string; densidades: string; ratios?: string };
  fecha: string;                      // la que decide la tabla LER (D10)
  alcance: { apartados: Apartado[]; inventario: boolean; motivo: string }; // art. 4.1 / 4.2
  porCodigo: FilaCodigo[];            // 1.º  «Código | Residuo | m³ | t»
  totales: { t: number; m3: number; peligrososT: number };
  destinos: FilaDestino[];            // 3.º  operación R/D, destino y gestor por código
  separacion: FilaFraccion[];         // 4.º  fracciones, si es obligatoria y por qué
  inventario: FilaPeligroso[];        // art. 4.1.b
  coste: CosteRcd;                    // 7.º  capítulo enlazado o t × precio
  fianza: FianzaRcd;                  // referencias y dato declarado
  pendientes: Pendiente[];            // lo que falta, con su apartado y su partida
  avisos: Aviso[];                    // incoherencias (vertedero, 01 04 xx, 17 09 04…)
}
interface FilaCodigo {
  ler: string; descripcion: string; peligroso: boolean;
  t: number; m3: number; m3Base: 'macizo' | 'aparente' | 'mixto';
  fraccion: Fraccion;
  origen: OrigenCantidad[];           // de qué partidas o ratios sale, con su cuenta
  incompleta: boolean;                // alguna partida confirmada sin espesor, peso…
}
```

- t y m³ redondeados a 0,01 al final (la suma se hace sin redondear).
- Las partidas en estado «propuesta» NO suman: aparecen en `pendientes` (D5).
- Una partida confirmada a la que le falta un dato (espesor, kg/ud, densidad) no se rellena:
  suma lo que se sabe, su fila sale `incompleta` y el dato va a `pendientes`.
- El capítulo enlazado como gestión de residuos no genera residuo.

### 2. Tablas versionadas

Ficheros de datos en `src/core/rcd/tablas/`, con la forma del bloque «Para la app» de la
verificación (`rcd/ler.json`, `rcd/operaciones.json`…), para que Instalaciones pueda leer los
mismos datos más adelante (D16). Cada tabla lleva cabecera `{ id, norma, edicion, tabla,
pagina, verificacion: 'K-RCD.n', veredicto }` y cada fila su veredicto. Un test impide que
entre una fila «SIN CONFIRMAR».

| Tabla | Contenido | Fuente | Versión |
|---|---|---|---|
| `ler` | Códigos con descripción literal y marca de peligroso. Hoy: los 38 del cap. 17 y los 12 de otros capítulos verificados (K-RCD.9). Ampliación a los capítulos 15, 16 y 20 completos en E0 (D13). | Decisión 2000/532/CE en la redacción de la 2014/955/UE (Ley 7/2022 art. 6.1, K-RCD.8) | **Por fecha**: base aplicable desde 2015-06-01 + cambio de la Decisión Delegada (UE) 2025/934 desde **2026-11-09** (16 06 04 pasa a 16 06 04*, 16 06 05 desaparece). `lerVigente(fecha)` devuelve la lista del día. La corrección de errores que movería la fecha está SIN CONFIRMAR: se codifica la del texto. |
| `operaciones` | R0506, R0508, R0511, R1201, D0501, D0502, D0503 con su nombre literal. El resto del anexo II (metales, madera, plástico, vidrio, papel) en E0. | Ley 7/2022, anexos II y III (K-RCD.8) | Consolidado 2025-04-02 |
| `fracciones` | Código → fracción; las seis sin umbral desde 2022-07-01; papel y cartón > 0,5 t; peligrosos siempre aparte; reutilizables (tejas, sanitarios, estructurales). | Ley 7/2022 art. 30.2; RD 105/2008 art. 5.5; Decreto 73/2012 art. 88.1 a) (K-RCD.4) | — |
| `densidades` | Material, kN/m³ (mín.–máx.), t/m³ por defecto (D7), código LER sugerido; pesos por m² de las tablas C.4 y C.5. | CTE DB SE-AE, abril 2009, anejo C (tabla C.1 cotejada en imagen; K-RCD.15). Conversión 1 kN/m³ ≈ 0,1 t/m³ (B.3.3). | `SE-AE-2009-04` |
| `ratios` | t/m² y m³/m² por código para obra nueva, y quizá coeficientes por tipología, plantas y estructura (D8). | ECO-eficiencia (Universidad de Sevilla) si da permiso, o tabla propia (D8). Hasta entonces, vacía: el proyectista teclea el ratio con su fuente (K-RCD.16). | `concreta-rcd-AAAA.N` |
| `reglas` | Propuestas automáticas (§4). | Elaboración propia, cada regla con su cita. | Con la app |
| `textos` | 2.º, 5.º y 6.º, por tipo de obra y comunidad. | Redacción propia con las citas de K-RCD.1–12; nada copiado de la plantilla. | Con la app |

**Congelar lo usado.** Al confirmar una partida, la densidad o el peso elegido se copia a la
partida con su referencia (`SE-AE-2009:C.1:ladrillo-hueco`). Al aplicar la tabla de ratios, sus
valores se copian a la obra con su edición. Si después sale una edición nueva, la obra lo dice
(«hay ratios 2026.2: el total pasaría de A a B t») y no cambia sola, igual que los precios
congelados de las certificaciones.

**Lo que el SE-AE no tiene** (placa de yeso laminado, escayola, PVC, fundición, porcelana
sanitaria, fibrocemento, tierra): sin valor por defecto; lo declara el proyectista, con su
fuente, y si falta queda pendiente. En E0 se busca una fuente citable (por ejemplo el Catálogo
de Elementos Constructivos del CTE; SIN CONFIRMAR).

### 3. Asignación partida → residuo (dónde vive, D1)

En la **partida**, como la descomposición de precio, porque es una propiedad de la unidad de
obra («este tabique, demolido, da tanto 17 01 02 por m²»), que es como lo modela el `~R`:

```ts
interface Partida { /* … */ rcd?: ResiduoPartida }

interface ResiduoPartida {
  estado: 'propuesta' | 'confirmada' | 'noGenera' | 'gestion';
  origen: { tipo: 'regla' | 'banco' | 'ia' | 'manual'; ref?: string; motivo: string };
  componentes: ComponenteRcd[];
  /** Si el precio de la partida ya lleva carga y transporte (coherencia del 7.º, §6). */
  transporte?: 'incluido' | 'excluido' | 'noDice';
}

interface ComponenteRcd {
  ler: string;                                    // validado contra lerVigente(fecha)
  tipo: 'demolicion' | 'excavacion' | 'colocacion' | 'embalaje'; // ~R tipos 1, 2, 0, 3
  conversion:
    | { modo: 'volumen' }                         // m³ de la partida = m³ de residuo
    | { modo: 'espesor'; espesor: number | null } // m² × e
    | { modo: 'pesoSuperficie'; tPorM2: number | null; espesor: number | null } // tablas C.4/C.5
    | { modo: 'seccion'; seccion: number | null } // m × s
    | { modo: 'pesoUnidad'; kgPorUd: number | null; m3PorUd: number | null }   // ud × peso
    | { modo: 'masa' }                            // partida en kg o t
    | { modo: 'directo'; tPorUd: number; m3PorUd: number; m3Base: 'macizo' | 'aparente' }; // de un .bc3
  densidad?: { tPorM3: number | null; ref?: string };
  parte?: number;                                 // reparto 0..1 si una medición da varios residuos
  reutilizable?: boolean;                         // Ley 7/2022 art. 30.2
}
```

- **Estados.** `propuesta` (la puso una regla, el banco o la IA; no suma), `confirmada` (la
  revisó el usuario), `noGenera` (confirmado que no da residuo: mano de obra, ayudas,
  transporte de escombros) y `gestion` (partida del capítulo del 7.º; puede llevar las
  fracciones que gestiona, para la coherencia).
- **La unidad manda.** El modo tiene que casar con la unidad de la partida (`formaDeUd`): una
  regla de m² en una partida de m³ no se aplica y la propuesta lo explica. Una partida alzada
  (PA) solo admite `pesoUnidad`.
- **Cuenta visible.** Cada componente produce su fórmula legible («24,00 m² × 0,008 m × 1,8
  t/m³ = 0,35 t»), la misma en la vista, en el detalle y en el anejo del Word.
- **No pasa por el copy-on-write.** Asignar residuo no cambia el precio ni la definición de la
  partida: no salta el aviso de partida de base ni quita la marca BASE.
- **Viaja con la partida.** Copiar o duplicar una partida, copiarla desde Referencia o desde
  otra obra se lleva su `rcd`. «Aplicar a las N partidas con el mismo código» copia una
  asignación confirmada a sus homónimos de la obra.
- **Deshacer gratis:** `partidas` ya es clave de dominio.

Los datos del estudio (lo que no es de una partida) van en `ObraData.estudioRcd` (§5).

### 4. Propuesta automática: reglas, banco e IA (D2, D15)

Nada se confirma solo. Las tres vías dejan `estado: 'propuesta'` con su origen y su motivo, y
el usuario confirma una a una o en bloque («Aceptar las 14 propuestas de reglas»).

1. **Banco (.bc3 con `~R`/`~X`).** Al importar una obra o copiar partidas de un banco de CYPE (o
   del BEDEC), cada partida trae sus componentes en modo `directo` (t/ud y m³/ud ya
   calculados), origen «banco · CYPE Generador de precios». El algoritmo (§10) se coteja con
   lo que CYPE enseña como «residuos generados» de la misma partida antes de darlo por bueno.
2. **Reglas** (`core/rcd/reglas.ts`), en orden, de la más concreta a la más general:
   - **Exclusiones:** capítulo enlazado como gestión → `gestion`; partidas de solo mano de
     obra, medios auxiliares, seguridad y salud o control de calidad → sin propuesta;
     «transporte / carga de escombros» → `noGenera` con aviso de doble cómputo.
   - **Transporte incluido o no:** en cada demolición se lee si el texto dice «incluso carga y
     transporte», «a vertedero», «a planta», «canon» o «sin transporte», y se guarda en la
     propuesta (`transporte: 'incluido' | 'excluido' | 'noDice'`) para la coherencia del 7.º.
     «Carga manual sobre camión o contenedor» (la fórmula de CYPE) cuenta como `excluido`: CYPE
     lleva el transporte al capítulo G.
   - **Por código de banco conocido**, para los bancos que no traen `~R` (D2):
     - BCCA 2023: el capítulo 01 «Demoliciones y trabajos previos» está ordenado por elemento
       (01ADS tabiques sencillos, 01ADT tabicones, 01AL paredes de ladrillo, 01R
       revestimientos, 01K carpintería, 01Q cubiertas, 01I instalaciones, 01X estructuras…);
     - Precio Centro: E01D «Derribos», con subgrupos por elemento (E01DCC coberturas de teja…);
     - las reglas por código se escriben como datos (`reglas-bcca-2023.json`,
       `reglas-centro-2017.json`), una por grupo, con su código, modo y cita, y se prueban
       contra los .bc3 de muestra.
   - **Por texto** (título y descripción): verbo de demolición («demolición», «levantado»,
     «desmontaje», «picado», «arranque») + material («tabique», «ladrillo hueco», «alicatado»,
     «solado», «gres», «escayola», «carpintería de madera», «aluminio», «vidrio», «bañera»,
     «fibrocemento», «tierras», «vaciado»…).
   - Cada regla propone código, tipo y modo, y solo rellena un espesor o un peso si la
     descripción lo dice («tabique de 7 cm») o si hay una fila del SE-AE que es exactamente ese
     elemento (tabla C.4: «ladrillo hueco, 45 mm, 0,60 kN/m²»). Si no, el dato queda vacío y
     la propuesta lo pide.
   - «Fibrocemento», «uralita», «amianto» → 17 06 05*, al inventario, y pide el dato de amianto
     de la obra.
3. **IA, como sugerencia**, solo para las partidas que ninguna regla reconoce: botón «Sugerir
   con IA» en la vista. Petición aparte del chat, con el proveedor y la clave del asistente:
   - esquema cerrado: el código LER es un `enum` con la tabla vigente; el tipo y el modo,
     también; los números, `number | null`;
   - por cada número, de dónde sale: «de la descripción» o «valor típico» (este último marcado
     en ámbar);
   - validación como `ai/validate.ts`: código existente, modo que casa con la unidad, valores en
     rango (espesor 0,005–1 m; kg/ud 0,1–2.000);
   - lotes de hasta 40 partidas; un caso de evaluación nuevo en `src/ai/eval` (acierto de código
     por partida).

### 5. Datos del estudio: lo que la app no sabe

`ObraData.estudioRcd?: EstudioRcdDatos`. Se piden en la vista; si faltan, el documento dice
«pendiente» en su sitio y la vista los lista en «Antes de entregar».

| Dato | Para qué | Si falta |
|---|---|---|
| Fase: proyecto básico o de ejecución | Apartados (art. 4.2, K-RCD.2) | Ejecución |
| Fecha del estudio (y de inicio prevista) | Tabla LER vigente (D10); aviso si la obra empieza tras un cambio | Hoy |
| Tipo de obra: nueva, reforma o rehabilitación, demolición (combinables) | Método, inventario, textos, fianza | Pendiente |
| Superficie construida de obra nueva (m²) | Ratios (§1) | Pendiente |
| Amianto: no / posible / identificado (y en qué elementos) | Inventario, 6.º, RD 396/2006 (K-RCD.3) | Pendiente, obligatorio en obra existente |
| Tierras reutilizadas en la obra (m³ y destino) | Se restan: RD 105/2008 art. 3.1 a) (K-RCD.6) | Cero |
| Gestor autorizado por código o fracción (nombre y nº de autorización) | 3.º, opcional: lo designa el poseedor (art. 5) | Sin columna |
| Operación R/D cuando la tabla no la da | 3.º | Pendiente |
| Precio de gestión (€/t o €/m³), solo sin capítulo enlazado | 7.º | Pendiente |
| Capítulo de gestión de residuos de la obra | 7.º (§6) | Se propone por el título |
| Separación en obra o por gestor externo | 4.º (RD 105/2008 art. 5.5, último párrafo) | En obra |
| Planta móvil prevista | Decreto 73/2012 art. 85 (K-RCD.7) | No |
| Plano de las instalaciones de almacenamiento (nº y título) | 5.º | Pendiente |
| Ordenanza municipal (nombre, artículo de la fianza) | Fianza (K-RCD.12) | Pendiente |
| Fianza: importe, criterio | Fianza | Pendiente, con el mínimo como aviso |
| Esponjamiento por fracción, con su fuente | m³ aparente (D6) | Sin columna aparente |
| Ratios de obra nueva usados (copiados de la tabla o tecleados, con su fuente) | 1.º | Pendiente |
| Comunidad autónoma | Textos y citas (D11) | De la provincia de la obra |

Productor (promotor) y poseedor (constructora) salen de los Datos de la obra que ya existen.
El **técnico redactor** del estudio (nombre, titulación, nº de colegiado), que firma (D14), se
elige en los datos del estudio; sin él, la firma sale pendiente.

### 6. 7.º Coste: enlazar con el capítulo real (D12)

- **Enlace.** El usuario elige el capítulo (o subcapítulo) de gestión de residuos de la obra; la
  app propone el que se llame «gestión de residuos», «residuos» o «RCD», o el que venga de los
  capítulos de gestión de los bancos (BCCA 17, Precio Centro U20). El coste del estudio
  es su importe, con el mismo criterio que la hoja Resumen, y el Word lista sus partidas
  (código, resumen, ud, cantidad, precio, importe). Así el estudio y el presupuesto no pueden
  decir dos cifras distintas.
- **Coherencia.** Cada partida del capítulo puede decir qué fracciones o códigos gestiona (la
  regla lo propone por el título: «residuos acero» → 17 04 05). Si sus t o m³ difieren de la
  estimación en más de un 10 %, aviso con las dos cifras. Si una partida de la obra dice «a
  vertedero» y la estimación lleva el código a planta, aviso (art. 86 del Decreto 73/2012).
  - **Huecos y doble cobro** (hallazgo 6): lo que generan las demoliciones «sin transporte» tiene
    que caber en el capítulo de gestión; lo de las que lo llevan «incluido» no debería estar
    también en él. La vista enseña las dos cifras («sin gestionar: 3,2 m³ de 4 partidas»;
    «posible doble cobro: 0,4 m³ de 2 partidas») y no corrige nada sola.
  - **Unidades:** se compara en t si la partida de gestión va en t; en m³ aparentes si dice
    «volumen esponjado» y hay esponjamiento declarado; si no, en m³ en obra, con la nota.
  - **Por grupo y por contenedor:** una partida «RCD de naturaleza pétrea» gestiona los códigos
    de ese grupo (tabla `fracciones`); una partida por contenedor («Ud») gestiona su número ×
    la capacidad que diga el texto («contenedor de 7 m³»); si el texto no la dice, se pide.
- El coste sale también como % del PEM, como hacen los ejemplos.
- **Sin capítulo.** Coste = Σ cantidad × precio declarado, por código o fracción. Botón «Crear
  capítulo de gestión de residuos»: una partida por fracción con la cantidad estimada y el
  precio declarado (o 0 y pendiente). Cambia el PEM: va en un paso de Deshacer, con aviso.

### 7. Fianza

Dato del proyectista; la app no la calcula como si fuera norma (K-RCD.12). Enseña dos
referencias con su cita:

- el presupuesto del estudio (RD 105/2008 art. 6.3: base cuando hay estudio);
- en Andalucía, el mínimo del Decreto 73/2012 art. 81.1 sobre el PEM: 2 % derribo, 1 % obra
  nueva, 2 % excavación. Con varios supuestos, el artículo permite aplicar cada porcentaje a
  sus partidas: la app propone el reparto desde los tipos de los componentes (demolición →
  derribo, excavación → excavación, el resto → nueva construcción) y el usuario lo confirma.
  Para una reforma pura (no está en a, b ni c) no hay regla: se enseñan las opciones.

Manda la ordenanza (arts. 81.2 y 89). Nunca se cita el art. 104 de la Ley 7/2007 (derogada por
la Ley 2/2026, LEGAM, desde el 20-06-2026; K-RCD.11).

### 8. UI (D3)

- **Vista propia «Residuos»** (quinta pestaña en escritorio; en móvil, en el menú «Más»). Sin
  estudio, un estado vacío con «Empezar el estudio de residuos». Tres bloques:
  1. **Partidas:** lista agrupada por capítulo con filtros «Por revisar · Sin asignar ·
     Confirmadas · No generan»; cada fila con su estado, sus códigos y sus t; acciones en bloque
     («Proponer», «Aceptar propuestas», «Sugerir con IA»); al pulsar, el editor de la partida.
  2. **Estimación:** la tabla «Código | Residuo | m³ | t» en vivo, la separación, el destino
     por código (editable: operación, destino, gestor), el 7.º con el capítulo enlazado y su
     coherencia, la fianza.
  3. **Datos del estudio** (§5) y «Antes de entregar» (pendientes, cada uno lleva a su sitio).
  Cabecera con «Exportar Word».
- **En el presupuesto:** pestaña «Residuos» en el detalle de la partida (junto a Medición /
  Descripción / Justificación), con el mismo editor; y un chip «RCD» en la fila (ámbar si es
  propuesta, verde si está confirmada), solo si la obra tiene estudio activo.
- **Sin columna nueva** ni en la tabla de partidas ni en el árbol de capítulos: la tabla ya va
  densa y en móvil pasa a tarjetas.
- **Editor de una partida:** partida, cantidad y unidad arriba; origen de la propuesta y su
  motivo; componentes (buscador de código sobre la tabla vigente, tipo, modo, espesor o peso,
  densidad con desplegable del SE-AE y su valor); la cuenta en vivo; «Confirmar», «No genera
  residuo», «Descartar», «Aplicar a las N con el mismo código».
- El detalle visual (densidad, móvil, estados vacíos) pasa por `/plan-design-review` antes de E2.

### 9. Documento Word

`features/exportar/docxRcd.ts`, en un chunk diferido como `docxRender`, desde
`EstudioRcd` (el render no calcula). Comparte con `docxRender` la página, la cabecera, las
tablas y la firma (se sacan a un módulo común). Añade estilos de título de Word (Título 1–2)
para que el índice de la memoria lo recoja.

1. Objeto, agentes (productor, poseedor) y normativa aplicada: RD 105/2008 (sin modificaciones),
   Ley 7/2022 (consolidado 2025-04-02), en Andalucía Ley 3/2023 y Decreto 73/2012, ordenanza
   (dato) (K-RCD.1).
2. **1.º Estimación:** tabla «Código | Residuo | m³ | t» con peligrosos marcados y total; nota
   del método (por partidas y/o ratios) y de la base de los m³; cita de la lista: «Decisión
   2000/532/CE, en la redacción de la Decisión 2014/955/UE, conforme al art. 6.1 de la Ley
   7/2022» (+ «y la Decisión Delegada (UE) 2025/934» si hay códigos de pilas tras el 09-11-2026).
3. **2.º Prevención:** texto por tipo de obra. Con demoliciones, la demolición selectiva como
   obligatoria (Ley 7/2022 art. 30.3, desde 2024-01-01). Nunca «no se prevé operación alguna».
4. **3.º Destino:** tabla «Código | Residuo | Operación | Destino | Gestor». Por defecto, planta
   de valorización; vertedero solo para rechazos o con la justificación del art. 86.2 del
   Decreto 73/2012.
5. **4.º Separación:** tabla de fracciones (t, obligatoria, cita): las seis de la Ley 7/2022
   art. 30.2 sin umbral; papel y cartón con el de 0,5 t; peligrosos siempre aparte y, en
   Andalucía, la frase del art. 88.1 a). Separación en obra o por gestor, con la acreditación.
6. **5.º Planos:** remisión al plano declarado.
7. **6.º Pliego:** texto propio con las citas (almacenamiento, contenedores, documentación de
   entrega, peligrosos, amianto con el RD 396/2006).
8. **7.º Coste:** el capítulo enlazado (o la tabla de precios) y su total.
9. **Inventario de residuos peligrosos** (obra existente): «Código | Residuo | Elemento | Cantidad
   | Retirada selectiva | Gestor» (K-RCD.3); «no se prevén» si no hay.
10. **Fianza:** las referencias del §7 y el importe declarado.
11. **Anejo: detalle de la estimación por partida** (código de partida, resumen, medición,
    cuenta, t, m³). Es lo que el revisor mira para fiarse del 1.º.

Lo pendiente sale en su celda o párrafo como «Pendiente: …» en el color de aviso del documento.
Firma: D14. PDF e impresión quedan fuera de esta etapa.

### 10. .bc3, .json y Referencia (D4)

- **Copia .json / .zip:** todo va en `ObraData`; nada que hacer aparte de la versión.
- **Exportar .bc3:** si alguna partida tiene componentes confirmados, se escriben:
  - el diccionario `~X||ler\Código LER\\m\Masa del elemento\kg\v\Volumen\m3\|`;
  - un concepto de tipo 4 por código y densidad usados (`RCD170102`, unidad kg, `~X` con `ler`,
    `m = 1`, `v = 1 / densidad`), con la deduplicación de códigos que ya existe;
  - un `~R` por partida con `TIPO\HIJO\r\kg por unidad\` (1 demolición, 2 excavación).
  La receta (espesor, densidad, referencia al SE-AE) no tiene sitio estándar: viaja solo en el
  .json. Antes de activarlo por defecto se valida con la trazadora en Presto y en Arquímedes,
  como F7.4 (`bc3export.trazadora.test.ts`).
- **Importar .bc3:** parser de `~R` en el vendor y lectura de `~X`. Por cada partida:
  - tipos 1, 2 y 3: hijo de tipo 4, t/ud = r × m(hijo) / 1.000, m³/ud = r × v(hijo);
  - tipo 0 (colocación): material del `~D`, t/ud = rendimiento × factor × rp × m(material);
  - el embalaje de los propios materiales (su `~R` de tipo 3) se suma por su cantidad en la
    partida, como el ejemplo del BEDEC de la especificación. La especificación no lo dice
    con todas las letras, pero es lo que hace CYPE: así sale igual que su estudio (hallazgo 1);
  - el `ler` llega como «17 02 01», «170201» o como código de un concepto de tipo 5 cuyo resumen
    es «170102 (ladrillos)» (BEDEC): se normaliza a «17 01 02» y se valida;
  - todo entra como `propuesta` con origen «banco» y el programa del `~V`; un código que no
    está en la tabla vigente o es del capítulo 01 entra con aviso y sin sumar hasta que se
    corrija; el informe de importación dice «N partidas traen residuos (~R): por revisar».
- **Referencia e importar partida suelta:** `RefPartida` lleva `rcd`, así que copiar desde un
  banco CYPE o desde otra obra trae la asignación (como propuesta si viene del banco, tal cual
  si viene de una obra propia).

### 11. Esquema v7

- `SCHEMA_VERSION = 7`: `ObraData.estudioRcd?` (clave de dominio nueva, en `DOMAIN_KEYS`) y
  `Partida.rcd?`. Migración v6 → v7: solo sube la versión (ambos opcionales). Se sube por la
  regla del esquema: amplía lo que se guarda, y una pestaña con la app anterior debe pasar a
  solo lectura en vez de borrar `rcd` al guardar.
- Sigue en el espacio de claves `concreta6.*`: la Etapa 0 ya trata una versión más nueva.
- `isObraData` valida la forma de `estudioRcd` y `rcd` sin destruir: lo ilegible se aparta como
  hacen los planos (`_ilegible`).

## Casos de prueba

Dos obras de prueba **inventadas** (nada de las memorias de cliente), como fixtures JSON en
`src/test/fixtures/rcd/` con el resultado esperado calculado a mano en el test.

**A · Reforma pequeña de vivienda** (Málaga, unos 70 m², planta segunda, amianto
«identificado» en una bajante). La mezcla de partidas imita la de las reformas reales de los
ejemplos (tipos de partida, no sus datos):

| Partida | Ud | Medición | Asignación esperada |
|---|---|---|---|
| Demolición de tabique de ladrillo hueco sencillo de 45 mm, sin transporte | m² | 38,50 | 17 01 02 · C.4 0,60 kN/m² → 2,31 t; e 0,045 → 1,73 m³ |
| Demolición de bóveda tabicada de escalera, a mano | m² | 7,00 | 17 01 02 + 17 01 07 · espesor declarado |
| Demolición de solera de hormigón armado < 15 cm, incluso transporte | m² | 2,10 | 17 01 01 · e 0,15 × 2,5 (armado) |
| Levantado de barandilla metálica para reutilizar | m | 11,35 | 17 04 05, reutilizable |
| Picado de alicatado con su mortero | m² | 24,00 | 17 01 03 (e 0,008 × 1,8) + 17 01 07 (e 0,010 × mortero de cemento) |
| Levantado de solado cerámico sobre plastón | m² | 62,00 | 17 01 07 · C.5 1,0 kN/m² → 6,20 t; m³ con el espesor declarado |
| Desmontaje de falso techo de escayola | m² | 15,00 | 17 08 02 · densidad fuera del SE-AE → **pendiente** |
| Desmontaje de puerta de paso de madera | ud | 6 | 17 02 01 · kg/ud declarado |
| Desmontaje de ventana de aluminio con vidrio | ud | 3 | 17 04 02 (kg/ud) + 17 02 02 (m² × 0,004 × 2,5) |
| Levantado de inodoro y lavabo | ud | 2 | 17 01 03, reutilizable (sanitarios) |
| Desmontaje de bajante de fibrocemento | m | 8 | 17 06 05* · inventario, D0503, RD 396/2006 |
| Transporte de escombros a vertedero | m³ | 12,00 | `noGenera` + aviso de doble cómputo + aviso art. 86 |
| Tabiquería nueva de placa de yeso, alicatado nuevo | m² | — | sin propuesta (D9) |
| Capítulo «Gestión de residuos»: retirada de mezcla a planta (m³), metales (t), amianto (kg) | — | — | `gestion`, enlace 7.º, coherencia |

Comprueba: totales por código, separación (minerales, madera, metales, vidrio, yeso; papel y
cartón por debajo de 0,5 t no obliga), inventario, pendientes (escayola, gestor, fianza),
avisos, coste = capítulo enlazado, fianza mínima según el reparto propuesto, y la coherencia
de transporte (el tabique «sin transporte» tiene que caber en el capítulo de gestión; la
solera «incluso transporte» no debería estar también en él).

**B · Obra nueva unifamiliar** (Málaga, unos 180 m² construidos, dos plantas):

- ratios de prueba (valores de juguete marcados como tales, no de ninguna tabla) × 180 m² por
  código;
- vaciado de 95 m³ con 30 m³ de tierras reutilizadas en la obra → 65 m³ de 17 05 04; densidad de
  la tierra declarada;
- sin inventario (obra nueva); fianza mínima 1 % del PEM y 2 % de las partidas de excavación;
- variante con el mismo presupuesto importado de un .bc3 con `~R` (fixture sintético según la
  especificación FIEBDC): mismas cantidades por partida que las del fichero.

Y un .bc3 de ida y vuelta: la obra A exportada con `~R` y reimportada da los mismos t/ud y m³/ud
por partida.

**Validación con obras reales, fuera del repo.** Los .bc3 y los estudios del estudio que hay
en `ejemplos pdf/Gestion de residuos/` se pasan por la app:

- `rcdReales.node.test.ts`, como `planosReales.node.test.ts`: se salta si la carpeta no está.
  Importar el .bc3 de la obra de 2025 da por código las mismas t y m³ que su estudio de CYPE.
  Las cifras esperadas van junto al .bc3 (`X.esperado.json`), fuera del repo.
- La reforma de 2026 (sin `~R`, por reglas y SE-AE) se compara con el estudio que se entregó,
  y las diferencias se explican.
- Las notas quedan fuera del repo (es público y son datos de cliente); al plan solo vuelve lo
  que cambie el diseño.

## Etapas

- **E0 · Datos y verificación pendiente** (sin código de la app; puede ir en paralelo y solo
  bloquea lo que se indica):
  1. Tabla LER: capítulos 15, 16 y 20 completos desde el texto del DOUE (D13). Bloquea el
     import de CYPE (usa 15 01 04).
  2. Operaciones del anexo II para metales, madera, plástico, vidrio y papel. Hasta entonces,
     «pendiente (según gestor)».
  3. Densidades fuera del SE-AE con fuente citable; tabla C.3 del SE-AE en imagen; edición
     vigente del DB.
  4. Ratios de obra nueva (D8): pedir permiso a ECO-ARQ (Universidad de Sevilla) y a la
     Consejería; si no, tabla propia. Bloquea solo la tabla, no el modo de ratios tecleados.
- **E1 · Motor y tablas** (`core/rcd/`): tipos, tablas verificadas, conversiones, cálculo,
  separación, alcance, inventario, fianza (referencias), pendientes y avisos. Los dos fixtures en
  verde. Sin UI ni esquema.
- **E2 · Asignación en la app:** esquema v7, acciones del store (asignar, confirmar, aplicar a
  homónimos, Deshacer), reglas, vista «Residuos» (partidas, estimación, datos), pestaña en el
  detalle y chip. Ratios tecleados por el proyectista. Hito: la reforma A se asigna entera en
  pantalla.
- **E3 · Word, 7.º y fianza:** `docxRcd`, textos 2.º/5.º/6.º, enlace con el capítulo,
  coherencia, «Crear capítulo de gestión», fianza. Hito: la reforma A sale en Word, se abre en
  Word, pasa la lista de citas prohibidas y su índice recoge los títulos; y la reforma real de
  2026 del estudio, pasada por la app, explica la diferencia con lo que se entregó.
- **E4 · .bc3:** importar `~R`/`~X` como propuestas (obra, partida suelta, Referencia),
  exportarlos, validar en Presto y Arquímedes.
- **E5 · Tabla propia de ratios** cuando E0.4 la entregue: fichero de datos, documento de método
  y aviso de edición nueva en las obras.
- **E6 · IA:** «Sugerir con IA» y su evaluación.
- **E7 · Restos y embalajes por partidas sin `~R`** (opcional, después): aplicar el método de
  Llatas (2011) a los materiales del descompuesto de cada partida (BCCA, Precio Centro): merma
  por clase de material × masa por unidad, más embalaje por unidad, con su propia tabla de
  factores. Da a una obra nueva con BCCA o Centro lo que CYPE da con el `~R`. Depende de que
  haya factores citables (D8).

Cada etapa se entrega en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`), como las
demás del repo.

## Tests

- **Tablas:** 38 códigos en el cap. 17 con la descripción literal de K-RCD.9; peligrosos con
  `*`; `lerVigente('2026-11-08')` y `('2026-11-09')` difieren solo en 16 06; densidades iguales a
  K-RCD.15; kN → t × 0,1; ninguna fila «SIN CONFIRMAR».
- **Conversiones:** cada modo con su unidad; modo que no casa → error con motivo; PA solo
  `pesoUnidad`; `parte` reparte sin perder masa.
- **Cálculo:** golden de A y B; propuestas fuera de la suma; partida confirmada incompleta →
  suma parcial + pendiente; capítulo de gestión no genera; tierras reutilizadas restan.
- **Separación y alcance:** seis fracciones sin umbral; papel y cartón a 0,49 y 0,51 t;
  proyecto básico sin 5.º ni 6.º; inventario solo en obra existente; 17 09 04 > 0 → aviso.
- **Avisos:** 01 04 09 importado, «a vertedero» frente a planta, transporte de escombros,
  capítulo de gestión que no cuadra (> 10 %).
- **Store:** asignar, confirmar, aplicar a homónimos y Deshacer; copiar partida lleva `rcd`;
  asignar en una partida BASE no la convierte en copia; migración v6 → v7; `_ilegible`.
- **.bc3:** importar el ejemplo de la especificación (BEDEC, P6143-AX1Q) y un fixture tipo CYPE;
  normalización de `ler`; ida y vuelta de la obra A; obra sin residuos → fichero igual que hoy.
- **Word:** el render de A contiene los títulos 1.º–7.º e inventario con estilo de título, las
  tablas y los pendientes; **lista de citas prohibidas** (K-RCD.17) sobre todo el texto.
- **IA:** validación de la respuesta (código fuera del `enum`, modo que no casa, valor fuera de
  rango → descartado con motivo); evaluación en `src/ai/eval`.

## Fuera de alcance

- Estudio de seguridad y salud (fase 8 de Instalaciones, otro documento).
- Que la memoria de Instalaciones lea el estudio: aquí solo queda el tipo `EstudioRcd`
  exportable.
- PDF e impresión del estudio; Excel.
- Normativa de comunidades distintas de Andalucía, más allá de la estatal (D11).
- Ordenanzas concretas de Málaga o Benalmádena (SIN CONFIRMAR en K-RCD.12).
- Esponjamiento por defecto (sin fuente, K-RCD.15): solo declarado.
- Certificar la gestión de residuos en obra (documentos de entrega, art. 5.3).
- Huella de carbono y coste energético, aunque el `~X` de CYPE los traiga.
- Dimensionar contenedores (número, volumen y frecuencia de retirada por fracción), que traen
  dos de los ejemplos: buena idea para después, a TODOS.

## Archivos (estimación)

- **Nuevos:** `core/rcd/` (`tipos.ts`, `calculo.ts`, `conversion.ts`, `ler.ts`, `reglas.ts`,
  `textos.ts`, `tablas/*.json`, tests); `src/test/fixtures/rcd/`; `features/residuos/`
  (`ResiduosView.tsx`, `ListaPartidas.tsx`, `EditorResiduo.tsx`, `Estimacion.tsx`,
  `DatosEstudio.tsx`, `Residuos.module.css`); `features/exportar/docxRcd.ts`;
  `vendor/bc3/parsing/dispatch/parsers/RParser.ts`; `ai/rcd/` (prompt, esquema, validación).
- **Editados:** `core/types.ts`, `store/schema.ts`, `store/obraStore.ts`,
  `store/slices/estructuraSlice.ts`, `core/bc3import.ts`, `core/bc3export.ts`,
  `core/refdata.ts`, `features/importar/importPartida.ts`, `features/referencia/obraSource.ts`,
  `features/exportar/docxRender.ts` (helpers comunes), `features/presupuesto/DetailPanel.tsx`,
  `features/presupuesto/PartidaRow.tsx`, `layout/types.ts`, `layout/TopBar.tsx`, `App.tsx`,
  `layout/ayudaContent.ts`, `persist/` (validación de la forma).

## Decisiones

**Cerradas el 2026-10-16.** D2, D9 y D14 se decidieron con los cambios que dicen; D8, con
ECO-eficiencia de forma provisional (abajo); las demás, tal como se propusieron. Se conserva la
redacción de cada una con su propuesta y su alternativa para saber de dónde sale.

**D8, provisional:** se implementa ya con ECO-eficiencia (nivel detallado para vivienda nueva,
básico para otros usos), con su fuente citada y su aviso de derechos en
`src/core/rcd/tablas/ecoeficiencia-2013.json`. Queda pendiente pedir el permiso; si no se da, se
sustituye por la tabla propia. Ojo: el repo es público y un push a `main` publica los datos.
Las densidades aparentes por código (D6) salen de la misma herramienta.

- **D1 · Dónde vive la asignación.** Propuesta: en la partida (`Partida.rcd`), como la
  descomposición y como el `~R`; los datos del estudio en `ObraData.estudioRcd`. Alternativa:
  un mapa aparte por id de partida (más aislado, pero se pierde al copiar partidas y hay que
  limpiarlo al borrar).
- **D2 · Qué trae el banco de serie. Decidido (2026-10-16):** el estudio usa sobre todo CYPE,
  pero tiene que funcionar también a quien trabaje con Precio Centro o la BCCA, que no traen
  residuos. Queda así:
  - CYPE (y BEDEC): el `~R`/`~X` del .bc3 entra como propuesta;
  - BCCA y Precio Centro: reglas por código para demoliciones y capítulo de gestión, más las
    reglas por texto, que valen para cualquier banco;
  - demolición y reforma: siempre por partidas (reglas + SE-AE), con cualquier banco;
  - obra nueva sin `~R`: ratios por m² (D8) y, más adelante, restos por partidas desde el
    descompuesto (E7);
  - más adelante: recordar por código lo que confirmas, para proponerlo en la obra siguiente.
- **D3 · UI.** Propuesta: vista propia «Residuos» + pestaña «Residuos» en el detalle de la
  partida + chip en la fila; sin columna en la tabla ni en el árbol. En móvil, la vista en el
  menú «Más», no en la barra inferior.
- **D4 · .bc3.** Propuesta: exportar el `~R`/`~X` estándar (validado antes en Presto y
  Arquímedes) e importarlo como propuestas; la receta (espesor, densidad) solo en el .json.
  Corrige la premisa del encargo: el formato sí tiene sitio para el código de residuo.
- **D5 · Qué cuenta en el documento.** Propuesta: solo lo confirmado; las propuestas sin revisar
  salen como «N partidas sin revisar» en pendientes y no suman.
- **D6 · Qué m³ imprime el 1.º.** Dos maneras de medir el mismo residuo: el **m³ en obra** es el
  volumen que ocupaba el material colocado (1 m² de tabique de 9 cm = 0,09 m³); el **m³
  aparente** o de contenedor es el que ocupa el escombro suelto, mayor por los huecos entre
  trozos (el esponjamiento; en CYPE, el hormigón a 1,50 t/m³ frente a 2,4 macizo). El RD 105/2008
  pide m³ sin decir cuáles. CYPE, vuestro estudio de 2025, la herramienta de Sevilla y las
  partidas de gestión («medido el volumen esponjado», contenedores) usan el aparente.
  Propuesta:
  - la tonelada manda (no depende de cómo se mida);
  - la columna de m³ del documento es la **aparente**: la de CYPE tal cual; en lo calculado por
    partidas, t ÷ densidad aparente de cada tipo de residuo, de una tabla editable cuya fuente
    hay que fijar (ECO-eficiencia si da permiso, D8; si no, la que declare el técnico);
  - mientras falte esa densidad, se imprime el m³ en obra con una nota, que también cumple el
    RD, y nunca se mezclan los dos en la misma columna sin decirlo.
- **D7 · Valor por defecto de un intervalo del SE-AE** (mortero de cemento 19–23 kN/m³; mortero
  de yeso 12–28). Propuesta: el valor central, editable, y el documento cita el intervalo.
  Alternativa: el superior (estima de más).
- **D8 · Ratios de obra nueva.** Ni las memorias del estudio, ni los ocho ejemplos, ni las
  hojas del COA de Málaga valen (hallazgo 3). La mejor fuente andaluza es ECO-eficiencia
  (hallazgo 8), pero no se puede reproducir sin permiso. Propuesta, por orden:
  1. **Pedir permiso al equipo ECO-ARQ de la Universidad de Sevilla y a la Consejería** para
     usar sus ratios y coeficientes en la app, citados. Si lo dan, la tabla de la app es la suya
     (fuente citable, andaluza, por código y por tipología), con su fecha y sus límites
     (vivienda nueva, VPO 2009-2012), y se escribe una nota de cómo se aplica hoy (separación
     por la Ley 7/2022, no por sus umbrales).
  2. Si no, tabla propia por el método de abajo, contrastada con ECO-eficiencia y con la guía
     CGATE fuera del repo.
  Método de la tabla propia, si hace falta: calcular partida a partida 3–5 presupuestos reales
  de obra nueva del estudio (de los .bc3 que hay, dos tienen cimentación y estructura; falta saber
  si son obra nueva y su superficie construida, y uno habría que exportarlo con residuos) con este mismo motor (densidades del SE-AE y,
  donde lo haya, el `~R` de CYPE), sacar t/m² y m³/m² por código y contrastar cada código con
  ECO-eficiencia y con la guía CGATE-CSCAE 2020 (región Mediterráneo Litoral), las dos
  transcritas **fuera del repo**: el repo es público, la guía es CC BY-NC-ND y el manual de
  Sevilla prohíbe reproducirlo, así que ninguna cifra suya entra ni se copia; solo se citan como
  contraste. Granularidad v1: una tabla «residencial obra nueva», sin regiones; los coeficientes
  por tipología y plantas, solo si la fuente los da. ¿Pedir también permiso al CGATE y al CSCAE?
- **D9 · Partidas también en obra nueva cuando el banco las trae. Decidido (2026-10-16), tal
  como se propuso.** Si el presupuesto trae `~R` (CYPE, BEDEC), la obra nueva se estima por
  partidas y los ratios solo cubren lo que falte; nunca las dos cosas para el mismo código. Lo
  mismo para los recortes y embalajes de lo que se construye dentro de una reforma: por
  partidas si hay `~R`; si no, no se estiman y el documento lo dice.
- **D10 · Qué fecha elige la tabla LER.** Propuesta: la fecha del estudio, con aviso si la de
  inicio prevista cae después de un cambio (hoy, el 09-11-2026 de las pilas).
- **D11 · Comunidades.** Propuesta: Andalucía y estatal en la primera versión; en otra
  comunidad, el texto estatal y «normativa autonómica: pendiente».
- **D12 · 7.º.** Propuesta: enlace con el capítulo de la obra por defecto; precios por fracción
  solo sin capítulo; y el botón «Crear capítulo de gestión» desde la estimación (cambia el PEM,
  con Deshacer).
- **D13 · Tabla LER.** Propuesta: completar en E0 los capítulos 15, 16 y 20 desde el DOUE (CYPE
  usa 15 01 04, que hoy no está); un código fuera de la tabla siempre entra con aviso.
- **D14 · Quién firma el estudio. Decidido (2026-10-16):** el técnico que lo redacta. Datos del
  estudio con «Técnico redactor» (nombre, titulación y nº de colegiado), elegido al empezar el
  estudio (se puede tomar de un agente de la dirección facultativa, pero se elige, no se
  supone). Sin él, la firma sale pendiente.
- **D15 · IA.** Propuesta: botón «Sugerir con IA» con esquema cerrado en la vista, no una
  operación nueva del chat.
- **D16 · Formato de las tablas.** Propuesta: JSON con la forma del bloque «Para la app» de la
  verificación, para que Instalaciones lea los mismos ficheros más adelante.

Cuando estén decididas, el plan se cierra (y PLAN-MEMORIA §5.8 de Instalaciones puede apuntar
aquí: la asignación vive en Mediciones).
