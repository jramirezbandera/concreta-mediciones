# Plan · Plan de control de calidad (CTE) desde el presupuesto

> Estado: BORRADOR (2026-10-24), pendiente de `/plan-eng-review`. Cerradas el 2026-10-24 las
> tres decisiones de la Etapa 0 (D1, D2 y D3, abajo); las demás van con su propuesta.
> La verificación normativa está en [`docs/research/control-calidad/`](research/control-calidad/README.md)
> (criterios K-PCC.1–72, 2026-10-24): el plan la cita y no la repite. Modelo de forma y de
> código: el estudio de residuos ([`plan-estudio-residuos.md`](plan-estudio-residuos.md),
> `src/core/rcd/`, `src/features/residuos/`).

## Petición

«Añadir el Plan de control de calidad del CTE», generado desde las partidas del presupuesto
como el estudio de gestión de residuos. Alcance acordado para la primera versión:

- estructura calculada por lotes (Código Estructural);
- recepción y ejecución por familia de producto;
- pruebas de obra terminada;
- valoración económica.

El seguimiento durante la obra (registrar ensayos reales, actas, libro de control) queda para
después. CTE genérico, con Andalucía como caso particular. Precios de la BCCA o de CYPE. Obra
privada: nada de contratación pública («1 % a cargo del contratista», ensayos adicionales de la
Junta del art. 1.3 del Decreto 67/2011).

Contenido exigido (K-PCC.3–5; en Andalucía K-PCC.41–42): anejo de la memoria del proyecto de
ejecución con el control de recepción (documentación, distintivos, ensayos: CTE I art. 7.2), el
de ejecución (7.3) y el de obra terminada (7.4); y su valoración, que el presupuesto «Incluirá».
En Andalucía, cada ensayo de recepción lleva muestreo, ensayo, criterio de aceptación y rechazo
y acción (Decreto 67/2011, art. 3.2.a.3.º). La estructura, además, con el nivel de control de
ejecución en el pliego y el coste del control independiente, a cargo de la propiedad (Código
Estructural, arts. 14.3, 17 y 19; K-PCC.21, K-PCC.35).

## Objetivo medible

- **Unifamiliar de hormigón armado:** el plan sale del presupuesto sin teclear ninguna cantidad
  que el presupuesto ya tiene. Lo que pide la app y el presupuesto no trae (superficie construida
  y plantas por grupo de elementos, número de viviendas) se teclea una vez.
- **Cada número tiene su regla a la vista** (K-PCC.54): «Forjados HA-25/B/20/XC1: 45,00 m³ ·
  300 m² · 2 plantas → 1 lote (tabla 57.5.4.1) × 3 amasadas = 3 tomas». Un control sin regla sale
  «a criterio de la DF», con cantidad 0 y su nota; nunca un número suelto.
- **Lotes según el Código, no según la hoja de la Junta:** los 16 casos resueltos de K-PCC.29
  (B «Para la app» A6) pasan como test, incluidos los tres en que la hoja se equivoca (E3, E4,
  E7) y el caso con distintivo (E9), que la hoja no calcula.
- **Cero citas derogadas:** un test recorre el texto del Word y falla con cualquiera de las
  listas de K-PCC.50–52 y de las secciones (d) de A, B y C (EHE-08, EAE, RC-08, RD 1630/1992,
  Decreto 13/1988, Decreto 6/2012, clases «IIa», «laboratorio acreditado»…). Y **no** veta el
  Reglamento (UE) 305/2011, que sigue vigente en parte (K-PCC.9).
- **El texto y la valoración dicen lo mismo** (K-PCC.61): todo ensayo descrito está valorado, o
  dice quién lo paga y por qué no está en la valoración; y al revés.
- **El capítulo de control cuadra con la valoración:** si la obra lo tiene, la app avisa de
  cada diferencia; si no lo tiene, lo crea. Y avisa de un plan pobre (K-PCC.61, D §6.9): una obra
  de hormigón armado no puede salir con 0 ensayos de hormigón (K-PCC.53).
- **Nada en silencio:** ninguna familia de control entra en el plan sin que el usuario la
  confirme, como los códigos LER en residuos.

## Lo que ha salido al explorar (cambia parte del encargo)

Resumen de la síntesis de la Etapa 0 ([README](research/control-calidad/README.md), «Lo que
cambia el planteamiento»). Lo que pesa en el diseño:

1. **Solo la estructura se calcula de verdad.** La tabla 57.5.4.1 da los lotes de hormigón por
   volumen, semanas, superficie construida y plantas, y con distintivo × 5, N = 1 y mínimo de 3
   lotes (K-PCC.27). Armaduras, ejecución y durabilidad tienen sus propias reglas, también
   verificadas (K-PCC.30–35). Fuera de la estructura, casi todo es control documental con
   frecuencia por suministro, y las frecuencias de la hoja de la Junta son recomendación, no
   norma.
2. **La hoja de la Junta calcula mal los lotes** (la V04 de 2023 tiene los mismos datos que la
   V03): no aplica las 2 plantas ni el tiempo, pierde las filas sin tipo de hormigón, deja tomas
   fraccionarias y no calcula el distintivo (K-PCC.38–39, D §3.3). **Sirve como catálogo de
   ensayos, no como algoritmo.**
3. **Con ferralla de taller se ensaya la ferralla (art. 59.2), no las barras (art. 58)**, y ni
   la hoja ni la BCCA tienen partida para eso; la BCCA tampoco tiene ensayos de barras ni de
   mallas (K-PCC.31–32, D §4.2). Son partidas propias de la app, con precio pedido o de la hoja.
4. **El CTE casi no impone pruebas de obra terminada.** Fontanería (HS 4) y saneamiento (HS 5)
   son obligatorias y las hace el instalador; las instalaciones las rigen sus reglamentos (RITE,
   REBT, RIPCI, ICT, gas). Cubierta plana, blower door y acústica in situ son a criterio del
   proyecto (K-PCC.12–18). **Excepción andaluza:** la IT 5 del Decreto 50/2025 hace obligatorio
   el ensayo acústico in situ para la licencia de primera ocupación (K-PCC.47).
5. **Los planes reales del estudio no sirven de modelo** (D §1–2): plantilla de Cádiz de 2007
   con normativa derogada, 0,06–0,08 % del PEM, ningún ensayo de hormigón ni de acero aunque
   haya micropilotes y estructura metálica. Son la lista de lo que la app no debe poder producir.
6. **Ninguna fuente sola da el plan** (D §6.1): el plan de CYPE da el control de ejecución por
   partida (sin multiplicar la frecuencia por la medición); la hoja de la Junta da ensayos y
   pruebas de servicio; la recepción documental no la trae ninguna. La app junta las tres capas.
7. **Las designaciones de hormigón de los presupuestos hay que validarlas** antes de usarlas:
   salen clases EHE (`IIa`) y erratas (`CX1`, `XC2a`), y de la clase dependen los ensayos de
   durabilidad (K-PCC.52).
8. **Los precios no se casan por importe** (D §4.2): 210 € es a la vez la química del acero y la
   compresión de suelo-cemento. Hace falta una tabla curada ensayo ↔ código BCCA, y los `~T` de
   la BCCA arrastran nomenclatura EHE (K-PCC.67–68).

## Qué ya existe (reuso)

- **El estudio de residuos entero como patrón** (`core/rcd/`, `features/residuos/`):
  - asignación en la partida con estados `propuesta | confirmada | …` y origen con motivo
    (`Partida.rcd`, `ResiduoPartida`);
  - reglas por código de banco y por texto (`rcd/reglas.ts`, `textoDe` normaliza minúsculas y
    tildes);
  - motor puro `calcularEstudioRcd(entrada, tablas)` → resultado con `pendientes` y `avisos`;
  - documento como datos (`rcd/documento.ts`: `DocumentoRcd`, `SeccionDoc`, `BloqueDoc`,
    `textoPlano` para el test de citas) y render diferido (`features/exportar/docxRcd.ts`);
  - capítulo propuesto (`rcd/capitulo.ts`, `partidasGestion`) y coherencia con tolerancia
    (`rcd/coherencia.ts`);
  - vista propia con lista de partidas, editor, datos del estudio y «Antes de entregar»
    (`ResiduosView`, `ListaPartidas`, `EditorResiduo`, `DatosEstudio`, `Pendientes`, `RcdChip`);
  - `comunidadDeProvincia` para el caso andaluz;
  - prueba con obras reales fuera del repo (`rcd/rcdReales.node.test.ts`, se salta si no está
    la carpeta).
- **Esquema** (`store/schema.ts`): `SCHEMA_VERSION = 7`, `DOMAIN_KEYS` con `estudioRcd`;
  migraciones en cadena; una versión más nueva deja la pestaña en solo lectura.
- **Modelo y mediciones:** `partidaCantidad(p)` (`core/medicion.ts`), `formaDeUd`
  (`core/medForma.ts`), totales y PEM (`core/totales.ts`).
- **Referencia** (`core/refdata.ts`, `RefSource`, `RefPartida`): los bancos que el usuario ha
  cargado (BCCA, Precio Centro, CYPE). De aquí sale el precio de cada ensayo y la partida que se
  copia al capítulo de control.
- **Vistas** (`layout/types.ts`): `import | presupuesto | resumen | certificaciones | residuos`;
  la de residuos va en el menú «Más» en móvil (`enBarraInferior: false`).

## Diseño

### 1. El cálculo: una función pura

`core/pcc/calculo.ts`, sin store ni React, con la misma forma que el de residuos:

```ts
calcularPlanCalidad(entrada: EntradaPcc, tablas: TablasPcc = TABLAS_PCC): PlanCalidad
// EntradaPcc = { chapters, partidas, rates, obra, plan: PlanCalidadDatos, bancos: PrecioBanco[] }
```

```ts
interface PlanCalidad {
  version: { motor: 1; lotes: string; catalogo: string; enlaceBcca: string };
  fecha: string;
  comunidad: string | null;                  // 'andalucia' activa §10
  recepcion: BloqueRecepcion[];              // 7.2: por familia, documental + distintivos + ensayos
  ejecucion: BloqueEjecucion[];              // 7.3: por familia, inspecciones con frecuencia → número
  obraTerminada: PruebaObraTerminada[];      // 7.4
  estructura: ResultadoEstructura;           // lotes de hormigón, armaduras, ejecución, acero
  valoracion: FilaValoracion[];              // solo lo que paga la propiedad (laboratorio)
  aCargoDeOtros: FilaSinCoste[];             // instalador, constructor: listado, sin importe (D2)
  total: number;                             // Σ valoración
  pendientes: Pendiente[];
  avisos: Aviso[];
}

interface FilaValoracion {
  ensayo: string;                            // id del catálogo
  descripcion: string; norma: string;
  unidad: UnidadEnsayo;                      // 'amasada' | 'probeta' | 'ensayo' | 'visita' | 'lote' | 'tramo' (K-PCC.60)
  cantidad: number;                          // entero, redondeado hacia arriba (K-PCC.57)
  regla: CuentaVisible;                      // de qué partidas, qué lote, qué cuenta (K-PCC.54)
  precio: { valor: number | null; fuente: FuentePrecio };  // banco, hoja de la Junta, propio (K-PCC.67)
  importe: number | null;
}
```

- Las partidas en estado `propuesta` no generan controles: salen en `pendientes` («6 partidas
  sin revisar»), como en residuos.
- Un dato que falta no se supone salvo que el plan diga su valor por defecto (§6): la fila sale
  con la cuenta parcial y el dato en `pendientes`.
- Los números se calculan sin redondear y se redondean hacia arriba al final, en la cantidad de
  cada fila (lotes, amasadas, tomas, visitas): nunca un ensayo fraccionario (K-PCC.57).
- El capítulo enlazado como control de calidad no genera controles (K-PCC.70), y tampoco los de
  gestión de residuos, seguridad y salud, implantación, transporte y alquileres.

### 2. Tres capas y una valoración

| Capa | Qué lleva | De dónde sale | Va a la valoración |
|---|---|---|---|
| Recepción documental | Hoja de suministro, marcado CE y DdP, distintivos y DIT/DAU, certificados (hormigón: certificado de la central y final; acero: adherencia, trazabilidad) | Tabla `familias` (A «Para la app» a; D §5), texto propio | No: la hace la DEO |
| Recepción: ensayos | Ensayos por lote | Estructura: §5 (norma). Resto: catálogo de la Junta (D1) con su tipo de lote (D §3.2) | Sí, si se proponen y se confirman |
| Ejecución | Inspecciones por fase, con frecuencia convertida en número (K-PCC.63) | Estructura: tabla 63.1 y anejo 15 (§5). Resto: tabla `familias` (modelo CYPE agrupado por familia, D §6.7) | Solo las inspecciones de laboratorio (soldaduras, par de apriete); las de la DEO, no |
| Obra terminada | Pruebas de servicio | §7 | Las de laboratorio; las del instalador van a `aCargoDeOtros` (D2) |

Los textos son **redacción propia** con sus citas: nada copiado de las plantillas del estudio ni
de los `~T` de banco sin pasar por la lista negra (K-PCC.68).

### 3. Tablas versionadas

`src/core/pcc/tablas/`, JSON con cabecera `{ id, norma, edicion, tabla, pagina, verificacion:
'K-PCC.n', veredicto }` y veredicto por fila; un test impide que entre una fila «SIN
CONFIRMAR», como en `rcd/tablas`.

| Tabla | Contenido | Fuente | Versión |
|---|---|---|---|
| `lotes-hormigon` | Filas de edificación de la tabla 57.5.4.1, multiplicadores (5 con distintivo, 2 con dispersión certificada), mínimo de 3 lotes, 6 semanas, N ≥ 6 con fck ≥ 50, Kₙ | Código Estructural, pp. 145–147, verificado en imagen (K-PCC.27–28; B A1) | `CodE-2021+CE-2024` |
| `durabilidad` | Clases que piden penetración de agua y aire ocluido; profundidades de la tabla 57.5.7 | CodE 57.5.7 (K-PCC.30) | ídem |
| `armaduras` | Series de diámetros, lotes de 30 t (barras, mallas) y 25 t (ferralla), tabla 59.2.4.3, 15 unidades | CodE arts. 58–59 (K-PCC.31–32; B A4) | ídem |
| `ejecucion` | Tabla 63.1 (edificación), tabla 101.1 (acero), anejo 15 orientativo y su opción simplificada, anejo 17 (END por tipo de cordón) | CodE (K-PCC.33, K-PCC.35; B A5) | ídem |
| `catalogo` | Ensayos: id, nombre, norma, nº por lote, tipo de lote (A–I de D §3.2), unidad, nivel 1/2/3 de la Junta, código DR, precio de referencia con fecha | Hoja de la Junta V04 (D1), **corregida** donde la norma la contradice (§3 bis) | `junta-PCC-V04-2023` |
| `enlace-bcca` | Ensayo del catálogo → código BCCA 2023 cap. 18 (o «sin código») | Tabla curada a mano sobre el emparejamiento de D §4.2; sin los «solo precio» falsos | `bcca-2023-V02` |
| `enlace-cype` | Ensayo → código del Generador de precios de CYPE | SIN CONFIRMAR hasta tener un .bc3 de CYPE con el capítulo de control (E0.3); vacía mientras tanto | — |
| `familias` | Familia → cómo reconocerla (prefijos BCCA, Centro, CYPE; texto; unidad) → recepción documental, ejecución, obra terminada, ensayos del catálogo, obligatoriedad R/P/C y quién lo hace | A «Para la app» (a) + D §5, cada fila con su cita | Con la app |
| `citas-prohibidas` | Listas de K-PCC.50–51, A (d), B (d), C (d), con lo que las sustituye; y la lista de lo que **no** se veta | Verificación | Con la app |
| `textos` | Párrafos fijos (objeto, agentes, laboratorios, productos, criterios de aceptación) por comunidad | Redacción propia con las citas de K-PCC | Con la app |

**§3 bis. Lo que se corrige del catálogo de la Junta al pasarlo a JSON** (D §6.2, K-PCC.39):
encepados «s/EHE-08» → fila de cimentaciones de la tabla 57.5.4.1; «clases generales» → clases
X; armaduras «2 / 30 t» → art. 58 por serie o 59.2 según procedencia; mallas, con lo que falta
del 59.1.4.2; acero de pretensar «art. 37» → arts. 36 y 60; perfiles «química y tracción > 100
t» → opcionales, no obligatorios; «mínimo 5 ensayos por desplazamiento» → fuera (práctica
comercial); normas UNE sustituidas → la vigente (K-PCC.51). Cada corrección queda en el JSON con
la fila original y el motivo, para que se pueda auditar contra la hoja.

**Extracción reproducible:** `scripts/pcc/extraer_junta.py` lee la hoja V04 desde fuera del
repo (`ejemplos pdf/control calidad/`, no versionado) y escribe el JSON; las correcciones van
en un fichero aparte que el script aplica, como `scripts/rcd/extraer_ecoeficiencia.py`.

**Congelar lo usado:** el plan guarda la edición de cada tabla y el precio de cada fila con su
fuente. Si cambia el banco o sale otra edición, la vista lo dice («con la BCCA cargada hoy, el
total pasaría de A a B €») y no cambia sola.

### 4. Familias: qué partida dispara qué control

En la partida, como el residuo (`Partida.pcc?`), porque es propiedad de la unidad de obra y
viaja con ella al copiarla:

```ts
interface ControlPartida {
  estado: 'propuesta' | 'confirmada' | 'sinControl' | 'capituloControl';
  origen: { tipo: 'regla' | 'banco' | 'manual'; ref?: string; motivo: string };
  familia: FamiliaId;                        // 'hormigon-estructural', 'acero-barras', 'cubierta-plana'…
  hormigon?: DesignacionHormigon;            // leída del texto y validada (abajo)
  grupoEstructura?: FilaLote;                // 'cim_superficial' | 'flexion' | 'pilares_muros'…
  acero?: { kgPorUd?: number | null; procedencia?: 'taller' | 'obra' };
}
```

- **Estados.** `propuesta` (la puso una regla; no cuenta), `confirmada`, `sinControl` (mano de
  obra, ayudas, transporte, hormigón de limpieza: K-PCC.70) y `capituloControl` (partida del
  capítulo de control, para la coherencia del §9).
- **Reglas** (`core/pcc/reglas.ts`), de la más concreta a la más general, como las de residuos:
  exclusiones (capítulos de control, residuos, seguridad y salud; implantación; alquileres) →
  prefijo de banco (BCCA por capítulo y letras: `03H`, `05H`, `03AC`, `05A`…; Precio Centro
  `E04…`, `E05…`; CYPE por familia de tres letras, solo las confirmadas en E0.3) → texto
  («h[ap]-\d\d/», «acero b 500 s», «malla electrosoldada», «ferralla», «micropilote»,
  «impermeabiliz», «fontaneria»…) con la unidad como filtro. Fuente de los patrones: D §5.
- **Designación de hormigón** (`core/pcc/hormigon.ts`): `HA-25/B/20/XC2` → tipo (HM, HA, HP),
  fck, consistencia, árido, clases de exposición, autocompactante. Se valida contra las clases
  del art. 27 (X0, XC1–4, XS1–3, XD1–3, XF1–4, XA1–3, XM1–3). Una clase no válida (`IIa`, `CX1`,
  `XC2a`, `X0` en armado) deja la partida con aviso y no dispara durabilidad hasta que se corrija
  (K-PCC.52). Un HM sin función estructural (limpieza, rellenos) va a `sinControl`.
- **Grupo de estructura.** La regla propone la fila de la tabla 57.5.4.1 por el texto
  («zapata», «losa de cimentación», «forjado», «pilar», «muro»); el usuario la confirma. Las
  cimentaciones de más de 200 m³ por elemento solo se proponen si la partida lo dice; si no, se
  piden.
- **Aplicar a homónimos y Deshacer**, igual que en residuos. Asignar familia no pasa por el
  copy-on-write de las partidas de base.

### 5. Estructura (lo que la app calcula)

Todo en `core/pcc/estructura.ts`, con los algoritmos de B «Para la app» A2–A5:

1. **Grupos de hormigón:** por (fila de la tabla 57.5.4.1, tipo de hormigón): un HA-25 de
   cimentación y un HA-30 de forjados nunca comparten lote. El volumen sale de las partidas
   confirmadas del grupo; la superficie construida, las plantas y las semanas, de los datos del
   plan por grupo (§6). Una partida de forjado medida en m² necesita su espesor equivalente o el
   volumen declarado: si no, pendiente (K-PCC.63).
2. **Lotes y amasadas:** `lotes = max(⌈V/Vmax⌉, ⌈S/Smax⌉, ⌈P/2⌉, ⌈T/Tmax⌉)` con los límites
   × 5 si hay distintivo; N = 3 sin distintivo, 1 con él, ≥ 6 si fck ≥ 50; mínimo 3 lotes en
   tamaño ampliado; cimentaciones > 200 m³ por elemento. Si no se dan las semanas, la app supone
   que cada grupo cabe en su plazo y lo avisa (K-PCC.29). Salida por grupo: lotes, amasadas,
   tomas de resistencia y de consistencia, probetas (≥ 4 por amasada) y la cuenta legible.
3. **Lo que queda SIN CONFIRMAR no se aplica como norma** (README): el × 5 sobre plantas y
   semanas se aplica (es el literal, «los valores de la tabla»), pero el plan lo dice en una
   nota; la nota (*) de pilares (500 → 1000 m²) y el tope de N por amasadas reales solo con el
   volumen de cuba declarado, y marcados como interpretación; el control indirecto no se ofrece
   hasta confirmar γc = 1,5 del anejo 19.
4. **Durabilidad:** por tipo de hormigón (dosificación) con clase que lo pida, sin distintivo:
   `1 + floor((meses − ε)/6)` penetraciones; aire ocluido con XF2 o XF4. Un tipo con dos clases
   se cuenta una vez (K-PCC.59).
5. **Armaduras:** con ferralla de taller (por defecto, D3), art. 59.2: lotes de 25 t, tracciones,
   geometrías por diámetro de las series fina y media, doblados si hay soldadura no resistente,
   15 unidades dimensionales; con distintivo de la ferralla, solo documentación. Elaborada en
   obra, art. 58: lotes de 30 t por serie de diámetros. Mallas, 59.1.4.2. Las toneladas salen de
   las partidas en kg; las partidas de hormigón «incluso armadura» necesitan su cuantía (kg/m³)
   declarada, y si no, pendiente.
6. **Control de ejecución:** lotes de la tabla 63.1 (cimentación por 250 m² y 10 elementos;
   flexión y pilares por 250 m² y 2 plantas; muros por 50 m), nivel normal por defecto (D3), y
   las inspecciones orientativas del anejo 15 (o su opción simplificada si la obra cumple sus
   condiciones). Van a `aCargoDeOtros` como inspecciones de la DEO, salvo que el plan declare
   control externo con laboratorio y un precio por visita (K-PCC.35).
7. **Acero estructural:** documental (marcado CE según UNE-EN 1090-1), clase de ejecución 2 por
   defecto, inspección visual del 100 % de los cordones, END con los porcentajes orientativos de
   la tabla A17.2.2.b si hay soldadura en obra, apriete de uniones atornilladas; valorado por
   jornadas de inspección, con su precio (K-PCC.33). El DB SE-A 10.8 se cita como alternativa «a
   criterio del plan» mientras su convivencia con el Código siga SIN CONFIRMAR.
8. **Cimentaciones profundas:** micropilotes, pilotes y pantallas se reconocen y se proponen con
   los ensayos del catálogo (lechada por día, tubos, integridad); los días de trabajo se piden
   (D §3.2 F). La integridad de pilotes in situ, con el DB SE-C 5.4.2.1.9 (K-PCC.16).
9. **Pruebas de carga, testigos, esclerómetro, ultrasonidos:** fila opcional «a criterio de la
   DF» con cantidad 0 (K-PCC.36).

### 6. Datos del plan: lo que el presupuesto no trae

`ObraData.planCalidad?: PlanCalidadDatos`. Se piden en la vista; si faltan, el documento dice
«pendiente» en su sitio y «Antes de entregar» los lista.

| Dato | Para qué | Si falta |
|---|---|---|
| Fecha del plan | Ediciones de tablas | Hoy |
| Uso y si es vivienda; unifamiliar aislada | Ley 5/2025, IT 5, n50 | Pendiente |
| Número de viviendas o unidades de uso | Pruebas por porcentaje (K-PCC.64), IT 5 | 1 si es unifamiliar; si no, pendiente |
| Superficie construida y plantas **por grupo de estructura** | Lotes de hormigón y de ejecución | Pendiente (no se calcula el lote por ese criterio y se avisa) |
| Semanas de hormigonado por grupo | Criterio de tiempo de la tabla | Dentro de plazo, con aviso |
| Meses de suministro por tipo de hormigón | Durabilidad | Pendiente si hay clases que la piden |
| Distintivo del hormigón: sin / con / dispersión certificada | Lotes y durabilidad | **Sin distintivo** (lo más exigente), con aviso (D3) |
| Distintivo del acero, de las mallas y de la ferralla | Armaduras | Sin distintivo, con aviso |
| Procedencia de la ferralla: taller u obra; enderezado; soldadura | Art. 58 o 59.2 | **Taller**, con aviso (D3) |
| Volumen de cuba (m³) | Nota (*) y tope de N (interpretación) | Sin aplicar |
| Nivel de control de ejecución: normal o intenso; opción A o B del art. 17 | Pliego, ejecución | **Normal** (D3); opción A |
| Clase de ejecución del acero estructural; soldadura en obra; tipos de cordón | §5.7 | Clase 2; el resto pendiente si hay acero |
| Zona sísmica | Art. 58: cargas cíclicas | De la provincia, si hay tabla; si no, pendiente |
| Pruebas a criterio del proyecto: cubierta plana, ventanas, blower door, acústica, barandillas | §7 | No propuestas, salvo las que activan una regla (cubierta plana → propuesta) |
| A cargo de quién va cada prueba (laboratorio o instalador) | Valoración | Instalador (D2) |
| Capítulo de control de la obra | §9 | Se propone por el título |
| Técnico redactor | Firma | Pendiente (como en residuos) |
| Comunidad autónoma | Textos y citas | De la provincia de la obra |

### 7. Obra terminada

- **Instalaciones (D2, decidido):** las pruebas que mandan sus reglamentos (HS 4, HS 5, RITE IT
  2.2, REBT ITC-BT-05, RIPCI, ICT, gas) se listan con su cita y su alcance, **a cargo de la
  empresa instaladora y sin coste en la valoración**, diciéndolo. Cada una se puede pasar al
  capítulo de control con precio de laboratorio, de una en una. Solo se listan las de las
  familias presentes en el presupuesto.
- **Organismo de control** cuando el REBT lo pide (garaje ≥ 25 plazas, piscina > 10 kW…): se
  pregunta y se lista, sin coste (K-PCC.17).
- **A criterio del proyecto** (K-PCC.12–15): prueba de estanqueidad de cubierta plana (propuesta
  si hay cubierta plana), estanqueidad de ventanas y fachada, empuje de barandillas, blower door
  (con vivienda nueva > 120 m² útiles, como opción frente a los valores de referencia del HE 1),
  acústica in situ. Muestreo con mínimo 1 y agrupado por visita (K-PCC.64).
- **Andalucía:** ensayo acústico in situ de la IT 5 del Decreto 50/2025 **obligatorio** en obra
  con proyecto, con su muestreo (10 % de viviendas, mínimo una; unifamiliar aislada, solo
  fachada) y valorado, porque lo paga la propiedad (K-PCC.47). Quién puede hacerlo queda SIN
  CONFIRMAR: el plan dice «laboratorio o entidad habilitada» sin elegir.

### 8. Valoración y precios

- **Orden de la fuente del precio** de cada fila:
  1. el banco cargado en Referencia, por el código del enlace (`enlace-bcca`; `enlace-cype`
     cuando exista);
  2. el precio de referencia del catálogo de la Junta, con «Junta, 2022» como fuente;
  3. el que teclee el usuario;
  4. si no hay ninguno, pendiente.
  La fuente se ve en la vista y en el Word; sin coeficientes ocultos (K-PCC.67).
- **La unidad manda** (K-PCC.60): la fila guarda en qué se mide el ensayo y el precio; una
  compresión por amasada (BCCA, 2 probetas) y una por probeta (Centro) no se mezclan. Si no
  casan, la fila sale pendiente con el motivo.
- **Sin regla de porcentaje.** El total sale también como % del PEM, como dato; ninguna norma
  fija un mínimo (K-PCC.5, K-PCC.42).
- **Aviso de plan pobre** (D §6.9): si el capítulo de control de la obra queda por debajo de lo
  que dan los ensayos de nivel 1 de las familias presentes (hormigón y acero como mínimo), aviso
  con las dos cifras. No se corrige solo.

### 9. Capítulo de control en el presupuesto

Como el 7.º de residuos (`rcd/capitulo.ts`, `rcd/coherencia.ts`):

- **Enlace.** El usuario elige el capítulo de control; la app propone el que se llame «control
  de calidad», «ensayos» o venga de los capítulos de control de los bancos (BCCA 18, Precio
  Centro E29). El coste del plan es su importe y el Word lista sus partidas.
- **Coherencia** (K-PCC.61): cada partida del capítulo se casa con su fila de la valoración por
  código del enlace o por texto. Avisos: ensayo valorado sin partida; partida sin ensayo en el
  plan; cantidades distintas. Unidades como en §8.
- **«Crear capítulo de control de calidad»:** una partida por fila de la valoración, copiada del
  banco cargado cuando el enlace tiene código (con su `~T` pasado por la lista negra, K-PCC.68;
  si falla, el texto propio del ensayo) o partida propia con el precio de la fila. Cantidad = la
  del plan. Cambia el PEM: va en un paso de Deshacer, con aviso.
- Las partidas del capítulo quedan `capituloControl` y no generan control ni residuo (las reglas
  de residuos ya excluyen el control de calidad).

### 10. Andalucía (y otras comunidades)

Con la comunidad «Andalucía» (de la provincia de la obra) el plan añade, de C «Para la app» (a):

- marco: Decreto 67/2011 (arts. 1.2, 3 y 4); con vivienda, Ley 5/2025 (arts. 27 y 29); con DB HR,
  Decreto 50/2025 (art. 27.3 e IT 5);
- la frase del art. 3.1 (el plan «con su correspondiente presupuesto»), sin porcentaje;
- las tres fases con el art. 3.2 a), b) y c), y en cada ensayo de recepción muestreo, criterio
  de aceptación y rechazo y acción (art. 3.2.a.3.º);
- laboratorios con declaración responsable e inscritos en el Registro (K-PCC.44);
- con vivienda, «Agentes del control y acreditación de resultados» (Ley 5/2025, art. 29);
- el código de la Relación de ensayos declarados de la Junta, cuando el catálogo lo tenga.

No genera el apartado de ensayos adicionales de la Junta (obra pública, art. 1.3). En otra
comunidad: el texto estatal y «normativa autonómica: pendiente», como en residuos.

### 11. UI

- **Vista propia «Calidad»** (en móvil, en el menú «Más», como «Residuos»). Sin plan, un estado
  vacío con «Empezar el plan de control». Bloques:
  1. **Partidas:** lista por capítulo con filtros «Por revisar · Sin familia · Confirmadas · Sin
     control»; acciones en bloque («Proponer», «Aceptar propuestas»); al pulsar, el editor.
  2. **Estructura:** los grupos de hormigón con sus datos (superficie, plantas, semanas) editables
     en la propia fila y su cuenta en vivo; armaduras; lotes de ejecución.
  3. **Plan:** recepción, ejecución y obra terminada por familia; lo «a criterio» con su casilla;
     lo «a cargo del instalador» con su conmutador para pasarlo al capítulo.
  4. **Valoración:** tabla con unidad, cantidad, precio con fuente, importe; el capítulo enlazado
     y su coherencia; «Crear capítulo de control de calidad».
  5. **Datos del plan** (§6) y «Antes de entregar».
  Cabecera con «Exportar Word».
- **En el presupuesto:** pestaña «Calidad» en el detalle de la partida, con el editor, y chip
  «PCC» en la fila (ámbar propuesta, verde confirmada), solo con plan activo. Sin columnas
  nuevas.
- Para no llenar la barra de vistas: «Residuos» y «Calidad» pueden ir juntas bajo un
  «Anejos» con dos pestañas (D6). El detalle visual pasa por `/plan-design-review` antes de E3.

### 12. Documento Word

`features/exportar/docxPcc.ts`, chunk diferido, desde `DocumentoPcc` (`core/pcc/documento.ts`).
Los tipos de documento (`Trozo`, `Parrafo`, `TablaDoc`, `SeccionDoc`) y los helpers de página,
cabecera, tablas y firma de `rcd/documento.ts` y `docxRcd.ts` se sacan a un módulo común
(`core/documento/`, `features/exportar/docxComun.ts`) en E4, sin cambiar la salida del de
residuos (su test lo asegura).

1. Objeto y alcance; agentes (promotor, constructor, DF, DEO, laboratorio y entidad de control
   «a designar» si no se conocen); marco normativo (CTE, Código Estructural, RC-16, Reglamentos
   (UE) 305/2011 y 2024/3110, RD 410/2010, reglamentos de instalaciones; y §10).
2. **Control de recepción:** documental y distintivos por familia; ensayos por familia con
   muestreo, ensayo, norma, criterio de aceptación y rechazo y acción.
3. **Control de la estructura:** distintivos y modalidad; tabla de lotes por grupo con su
   cuenta; criterio de aceptación (K-PCC.28); durabilidad; armaduras; nivel de control de
   ejecución y lotes de ejecución.
4. **Control de ejecución** del resto por familia: fase, comprobación, frecuencia convertida en
   número, criterio de rechazo.
5. **Control de obra terminada:** pruebas a cargo del laboratorio, pruebas a cargo del
   instalador (sin coste, diciéndolo), pruebas a criterio incluidas.
6. **Valoración económica:** tabla «Ensayo | Norma | Ud | Cantidad | Precio | Fuente | Importe»
   y el total; o el capítulo enlazado; % del PEM como dato.
7. Anejo: detalle de la asignación por partida (código, resumen, medición, familia, grupo).

Pendientes en el color de aviso; firma del técnico redactor. PDF e impresión, fuera de esta
versión.

### 13. .bc3, .json y Referencia

- **.json / .zip:** todo en `ObraData`.
- **.bc3:** el capítulo de control son partidas normales y viajan como siempre. La asignación
  `pcc` no tiene registro estándar: solo en el .json.
- **Importar el pliego de CYPE** (`~L` con `PS` y `EN`, D §4.5) como propuesta: después (E6), si
  el estudio consigue un .bc3 exportado con pliego que lo traiga relleno.
- **Referencia:** `RefPartida` lleva `pcc` al copiar desde otra obra (tal cual) y desde un banco
  (como propuesta si llega a tenerlo).

### 14. Esquema v8

- `SCHEMA_VERSION = 8`: `ObraData.planCalidad?` (clave nueva en `DOMAIN_KEYS`) y `Partida.pcc?`.
  Migración v7 → v8: solo sube la versión. Se sube por la regla del esquema: una pestaña con la
  app anterior pasa a solo lectura en vez de borrar `pcc` al guardar.
- `isObraData` valida la forma sin destruir; lo ilegible a `_ilegible`.
- Ojo: hay trabajo sin commitear de cuadros de precios en `features/exportar/` y `features/print/`;
  E3 y E4 se empiezan cuando esté subido.

## Casos de prueba

Dos obras **inventadas** como fixtures en `src/test/fixtures/pcc/`, con el resultado esperado
calculado a mano en el test. Nada de las obras del estudio en el repo.

**A · Unifamiliar entre medianeras** (Málaga, 2 plantas, 300 m² construidos, BCCA):

| Partida | Ud | Medición | Esperado |
|---|---|---|---|
| Hormigón de limpieza HM-20 | m³ | 4,00 | `sinControl` |
| Zapatas HA-25/B/20/XC2 | m³ | 40,00 | cimentación superficial: 1 lote × 3 amasadas (E6); con 2 semanas, 2 × 3 (E7) |
| Forjado HA-25/B/20/XC1, 300 m², 2 plantas | m³ | 45,00 | flexión: 1 lote × 3 |
| Pilares HA-25/B/20/XC1 | m³ | 5,00 | pilares: 1 lote × 3 |
| Ferralla B 500 S de taller, Ø8, Ø10, Ø12 y Ø16, con enderezado | kg | 6.500 | 59.2: 1 lote, 4 tracciones + 8 geometrías + 15 unidades |
| Muro de sótano HA-30/B/20/XS1 (próximo al mar) | m³ | 18,00 | otro tipo → otro grupo; durabilidad: 1 penetración con 4 meses |
| Fábrica de ladrillo cara vista | m² | 220 | recepción documental; ejecución por planta; ensayos solo si se marcan |
| Cubierta plana invertida | m² | 150 | prueba de estanqueidad propuesta (a criterio) |
| Fontanería y saneamiento | ud/m | — | pruebas HS 4 y HS 5 a cargo del instalador, sin coste |
| Gestión de residuos, seguridad y salud | — | — | sin control (K-PCC.70) |
| Partida con «HA-25/B/20/IIa» | m³ | 3,00 | aviso de designación; no dispara durabilidad (K-PCC.52) |

Comprueba: 9 amasadas sin distintivo (como el ejemplo de D §3.3) más las del muro; con
distintivo, el mínimo de 3 lotes y N = 1 (E9); lotes de ejecución (X1); IT 5 de Andalucía con
1 vivienda (y la variante aislada, solo fachada); valoración con fuente BCCA; plan sin capítulo →
«Crear capítulo» da las mismas cantidades; texto sin citas prohibidas.

**B · Plurifamiliar de 6 plantas** (23 viviendas, losa de cimentación de 400 m³ en vertido
continuo, forjados 450 m³ / 3.000 m², pilares y muros 120 m³ / 3.000 m², acero laminado en
cubierta con soldadura en obra, garaje de 30 plazas):

- losa: 1 elemento > 200 m³ → N = ⌈400/35⌉ = 12 (con distintivo, ⌈400/105⌉ = 4);
- forjados y pilares con los criterios de plantas y superficie;
- pruebas por porcentaje: 23 viviendas → 5 pruebas en 1 visita (K-PCC.64);
- REBT: inspección inicial del organismo de control por el garaje;
- acero estructural: visual 100 % + END de la tabla A17.2.2.b, por jornadas.

Y los **16 casos de B A6** como tests unitarios del motor de estructura, uno por uno.

**Validación con obras reales, fuera del repo.** `pccReales.node.test.ts`, como
`rcdReales.node.test.ts` (se salta si no está la carpeta): la obra de 2026 y el anexo de 2025 de
`ejemplos pdf/control calidad/` no pueden salir con 0 ensayos de hormigón ni sin micropilotes
(K-PCC.53, K-PCC.62); sus cifras esperadas van fuera del repo. Las notas tampoco se suben: solo
vuelve al plan lo que cambie el diseño.

## Etapas

- **E0 · Datos** (sin código de la app):
  1. `scripts/pcc/extraer_junta.py` y `catalogo.json` con las correcciones de §3 bis; test de
     que cada fila tiene tipo de lote y unidad.
  2. `enlace-bcca.json` curado sobre el emparejamiento de D §4.2 (los 83 «solo precio», a mano).
  3. Pedir al estudio un .bc3 de CYPE con el capítulo de control y otro exportado con pliego
     (`~L`), para `enlace-cype` y los prefijos CYPE sin confirmar (D §5).
  4. Los SIN CONFIRMAR que afectan al cálculo (γc del anejo 19; × 5 en plantas y semanas) se
     intentan cerrar leyendo el anejo 19 en imagen; si no se cierran, quedan como dice §5.3.
- **E1 · Motor de estructura** (`core/pcc/estructura.ts`, `hormigon.ts`, tablas de lotes,
  durabilidad, armaduras y ejecución): los 16 casos de A6 en verde. Sin UI ni esquema.
- **E2 · Familias y plan completo** (`familias.json`, `reglas.ts`, `calculo.ts`): recepción,
  ejecución, obra terminada, valoración con precios del banco cargado, Andalucía. Fixtures A y B
  en verde; lista de citas prohibidas sobre `textoPlano`.
- **E3 · App:** esquema v8, acciones del store (asignar, confirmar, homónimos, Deshacer), vista
  «Calidad», pestaña en el detalle y chip. Hito: la obra A se asigna entera en pantalla.
- **E4 · Word y capítulo:** módulo común de documento, `docxPcc`, enlace y coherencia del
  capítulo, «Crear capítulo de control de calidad», aviso de plan pobre. Hito: la obra A sale en
  Word, se abre en Word y pasa la lista de citas; la obra real de 2026, pasada por la app,
  explica la diferencia con lo que se entregó.
- **E5 · Precios de CYPE** cuando E0.3 dé el .bc3: `enlace-cype` y prefijos.
- **E6 · Pliego de CYPE** (`~L`) como propuesta, si llega relleno.

Cada etapa en verde (`tsc -b`, `vitest run`, `eslint`, `vite build`) y subida a `main`.

## Tests

- **Tablas:** filas de la tabla 57.5.4.1 iguales a B A1; Kₙ; series de diámetros; ninguna fila
  SIN CONFIRMAR; cada corrección de §3 bis con su fila original.
- **Estructura:** los 16 casos de A6; grupos por (fila, tipo); redondeo hacia arriba; fila sin
  tipo convencional/autocompactante cuenta como convencional con aviso (K-PCC.56).
- **Designaciones:** las clases válidas del art. 27; `IIa`, `CX1`, `XC2a`, `X0` en armado → aviso;
  XS1 + XF2 → un tipo de durabilidad, no dos.
- **Reglas:** prefijos BCCA y Centro contra los .bc3 de `docs/spike/samples/`; exclusiones de
  K-PCC.70; la unidad que no casa no propone.
- **Valoración:** fuente del precio por orden; unidades que no casan → pendiente; plan sin
  presupuesto → sin cantidades y con avisos (K-PCC.66); total = Σ filas.
- **Instalaciones:** por defecto en `aCargoDeOtros` sin importe; al pasarlas al capítulo, en la
  valoración con precio.
- **Capítulo:** coherencia en los tres sentidos; «Crear capítulo» y Deshacer; partidas
  `capituloControl` sin control ni residuo.
- **Texto:** citas prohibidas (K-PCC.50–51, A, B y C (d)); el 305/2011 sí aparece; sin
  marcadores de plantilla (K-PCC.65); sin otra comunidad (K-PCC.71); texto ↔ valoración
  (K-PCC.61); tres partes siempre (K-PCC.69).
- **Store y esquema:** migración v7 → v8; `_ilegible`; copiar partida lleva `pcc`; asignar en una
  partida BASE no la convierte en copia.
- **Word:** títulos con estilo; el de residuos sale igual tras sacar el módulo común.

## Fuera de alcance

- Seguimiento durante la obra: ensayos reales, actas, resultados, libro de control, certificado
  final (CTE anejo II). Será la siguiente versión.
- Evaluar resultados de ensayos (Kₙ se usa solo para el texto del criterio).
- Filas de obra civil de la tabla 57.5.4.1 (puentes, túneles, marcos).
- Urbanización y viales (capítulo 15 de la hoja), salvo lo que reconozcan las reglas de
  movimiento de tierras.
- Control indirecto del hormigón, hasta cerrar γc.
- Normativa de otras comunidades más allá de la estatal; exigencias del COA o del COAAT de Málaga
  (SIN CONFIRMAR).
- PDF, impresión y Excel del plan.
- IA para proponer familias: las reglas bastan para v1; si no, como «Sugerir con IA» de residuos.

## Archivos (estimación)

- **Nuevos:** `core/pcc/` (`tipos.ts`, `calculo.ts`, `estructura.ts`, `hormigon.ts`, `reglas.ts`,
  `precios.ts`, `capitulo.ts`, `coherencia.ts`, `documento.ts`, `textos.ts`, `tablas/*.json`,
  tests); `scripts/pcc/extraer_junta.py`; `src/test/fixtures/pcc/`; `features/calidad/`
  (`CalidadView.tsx`, `ListaPartidas.tsx`, `EditorControl.tsx`, `Estructura.tsx`, `Plan.tsx`,
  `Valoracion.tsx`, `DatosPlan.tsx`, `Calidad.module.css`); `features/exportar/docxPcc.ts`;
  `core/documento/` y `features/exportar/docxComun.ts` (sacados de residuos).
- **Editados:** `core/types.ts`, `store/schema.ts`, `store/obraStore.ts`, `core/refdata.ts`,
  `core/rcd/documento.ts` y `features/exportar/docxRcd.ts` (al módulo común),
  `features/presupuesto/DetailPanel.tsx`, `features/presupuesto/PartidaRow.tsx`,
  `layout/types.ts`, `App.tsx`, `layout/ayudaContent.ts`, `persist/` (validación).

## Decisiones

**Cerradas el 2026-10-24:**

- **D1 · Catálogo de ensayos. Decidido:** el catálogo de la hoja de la Junta es de uso libre, así
  que se usa como fuente de los ensayos (nombre, norma, nº por lote, tipo de lote, nivel, código
  DR y precio de referencia de 2022), transcrito a JSON con su cita y **corregido** donde la norma
  lo contradice (§3 bis). No se usa su algoritmo de amasadas (hallazgo 2). No se pide permiso.
- **D2 · Pruebas de instalaciones. Decidido:** a cargo de la empresa instaladora, listadas con su
  cita y sin coste, diciéndolo; se pueden pasar al capítulo de control de una en una (§7).
- **D3 · Valores por defecto. Decidido:** hormigón sin distintivo (lo más exigente), con aviso;
  control de ejecución a nivel normal. Por la misma lógica, el acero, las mallas y la ferralla
  sin distintivo; y la ferralla de taller, que es lo corriente en vivienda (propuesta: confirmar
  en la revisión).

**Abiertas, con propuesta:**

- **D4 · Capítulo de control.** Propuesta: enlace por defecto, «Crear capítulo de control de
  calidad» con partidas del banco cargado, coherencia y aviso de plan pobre (§9). Alternativa:
  solo la tabla de valoración en el anejo, sin tocar el presupuesto (no cumple el «Incluirá» del
  anejo I si la obra no tiene capítulo).
- **D5 · Dónde vive la asignación.** Propuesta: en la partida (`Partida.pcc`), como `rcd`; los
  datos del plan en `ObraData.planCalidad`. Alternativa: deducir la familia al vuelo, sin guardar
  nada en la partida (menos esquema, pero el usuario no puede corregir una regla que se
  equivoca).
- **D6 · Vistas.** Propuesta: vista «Calidad» propia; a revisar en `/plan-design-review` si
  «Residuos» y «Calidad» se agrupan en «Anejos».
- **D7 · Datos por grupo de estructura.** Propuesta: superficie y plantas por grupo, prerrellenas
  con la superficie construida y las plantas de la obra (un dato nuevo en la ficha) para que en
  una unifamiliar se teclee una vez. Alternativa: solo por grupo.
- **D8 · Niveles de la Junta.** Propuesta: los ensayos de nivel 1 de las familias presentes se
  proponen; los de nivel 2 y 3, desmarcados, a criterio. La regla de la hoja (por encima de
  300.000 € de PEM, también el nivel 2) se enseña como recomendación, no se aplica sola.
- **D9 · Pruebas de obra terminada a criterio.** Propuesta: solo la de cubierta plana se propone
  sola (hay partida que la reconoce); blower door, ventanas, barandillas y acústica estatal, a
  casilla. En Andalucía, la acústica de la IT 5, siempre.

## Revisión de ingeniería (2026-10-25, `/plan-eng-review`)

Objetivo revisado: este plan (`docs/plan-control-calidad.md`), en el commit `a8a668f`.

### Alcance

feature answers: sin recortes propuestos (E5 y E6 ya aplazadas; acero estructural y
cimentaciones profundas hacen falta para la obra real de 2026, K-PCC.62); structure: B «Smaller
arrangement» (respuesta D1, 2026-10-25); accepted scope: sin `features/exportar/docxComun.ts`,
`docxPcc.ts` importa de `docxRender.ts` (que ya exporta `cabecera`, `tabla`, `firma`, `cell`,
`run` y los colores, y que ya usa `docxRcd.ts:16`); `core/documento/` solo con los tipos
(`Trozo`, `Parrafo`, `TablaDoc`, `SeccionDoc`, `BloqueDoc`) y un `bloques()` genérico sacado de
`bloquesRcd`; el resto de `core/pcc/` y `features/calidad/` como en el plan; pending remedies:
A1, A2, P1, P2, T1 y las abiertas D3 (ferralla), D4, D5, D7, D8 y D9 del plan.

### Correcciones de hecho (sin cambio de comportamiento)

- **§14:** los cuadros de precios ya están subidos (`cb09152`); E3 y E4 no esperan a nada.
- **§14 y «Qué ya existe»:** no hay `isObraData`; la carga pasa por `fromSerializable`
  (`store/schema.ts:249`) y lo ilegible se aparta con `apartarRcdIlegibles`
  (`core/rcd/datos.ts:76`). El de calidad va al lado, `apartarPccIlegibles`.
- **§1:** `EntradaPcc` lleva `hoy` (ISO), como `EntradaRcd` (`core/rcd/calculo.ts:54-62`): la
  fecha del plan «si falta, hoy» no puede leer el reloj dentro de una función pura.
- **§9:** las reglas de residuos no excluyen el control de calidad: solo proponen con verbo o
  código de demolición, o con excavación en m³ (`core/rcd/reglas.ts:246-285`). Un ensayo no
  casa, pero el test «partidas `capituloControl` sin residuo» lo tiene que comprobar con
  partidas del capítulo 18 de la BCCA, no darlo por hecho.
- **Archivos editados que faltan:** `store/slices/pccSlice.ts` (nuevo, como `rcdSlice.ts`),
  `store/slices/copySlice.ts:148` (copiar lleva `pcc`), `core/bc3ToPartidas.ts:100` y
  `core/refdata.ts:420,454` (el `pcc` viaja como el `rcd`), `features/presupuesto/PartidaCard.tsx:82`
  (el chip en móvil), `store/medUiStore.ts:21` (`DetailTab` con `'calidad'`), el reinicio de
  `obraStore.ts:861` y `layout/TopBar.tsx:41`: una pestaña más obliga a subir `ROOMY_W`, medido
  con las pestañas (aprendizaje `roomy-w-depende-de-las-pestanas`).
- **Tests de reglas:** los .bc3 de `docs/spike/samples/` no están en git. Como en
  `core/rcd/reglas.bancos.test.ts`, en la CI va un juego de códigos escrito a mano y el
  recorrido de las bases enteras queda `skipIf` en local.
- **E11 de A6:** con γc SIN CONFIRMAR el control indirecto no se ofrece (§5.3), así que el test
  comprueba que no se ofrece, no que se rechaza por fcd. E5 solo con el volumen de cuba declarado,
  marcado como interpretación.

## Decision ledger

### A1: de dónde y cuándo salen los precios de los ensayos
Finding: 1, P1, confianza 9/10, `docs/plan-control-calidad.md:209-211` frente a `:340-346`; `src/features/referencia/obraSource.ts:10-13,41-50`; revisor: Claude (plan-eng-review).
Plan baseline: propuesta original. §8: el precio sale del banco cargado en Referencia por el código de `enlace-bcca`; §3: «el plan guarda el precio de cada fila con su fuente… y no cambia sola». `EntradaPcc.bancos: PrecioBanco[]`.
Runtime evidence: un banco es otra obra del índice (`kind: 'reference'`), se carga asíncrona con `loadObraRefSource` y una base grande hidratada retiene unos 50 MB (`obraSource.ts:10-13`); el panel guarda como mucho 2 en caché. Nada carga hoy un banco fuera del panel Referencia.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| A1 fuente del precio en el cálculo | contradictoria (§3 frente a §8) | copia guardada en `planCalidad.precios` | banco cargado en vivo |
| A1 cuándo se carga el banco | sin definir | al pulsar «Tomar precios de un banco» | al abrir la vista |
| A1 aviso «pasaría de A a B €» | §3 | al repetir la acción, antes de aplicar | no hace falta (siempre en vivo) |
| Orden de fuentes §8 (banco → Junta → tecleado → pendiente) | propuesta | se mantiene, con «banco» = la copia | se mantiene |
Question D2:
D2 — De dónde y cuándo salen los precios de los ensayos
Project/branch/task: main, plan de control de calidad, §3 «Congelar lo usado» y §8.
ELI10: El plan dice dos cosas que chocan. En el §8, el precio de cada ensayo se busca en el banco cargado en Referencia. En el §3, el precio se congela y no cambia solo. Además, un banco es otra obra guardada aparte: la BCCA ocupa unos 50 MB en memoria y se carga de forma asíncrona (obraSource.ts:10-13), así que la función pura del cálculo no puede recibir los bancos sin que alguien los cargue antes.
Stakes if we pick wrong: con precio en vivo, el total cambia solo al cargar o borrar un banco, la vista carga 50 MB al abrirse y un Word ya entregado no se puede reproducir.
Recommendation: A because el cálculo queda determinista y reproducible, y el banco solo se carga cuando el usuario lo pide.
Completeness: A=9/10, B=6/10
Pros / cons:
A) Copia de precios en el plan (recommended)
  ✅ El mismo plan da siempre el mismo total y el mismo Word, y se puede auditar la fuente
  ✅ No carga 50 MB al abrir la vista: solo al pulsar el botón, con el cargador que ya existe
  ❌ Un paso más para el usuario, y un precio puede quedar viejo (se ve su fecha)
B) Precio en vivo
  ✅ Siempre el último precio del banco cargado, sin pasos extra
  ✅ No hace falta guardar precios en el plan
  ❌ Carga asíncrona pesada al abrir y un total que se mueve solo; contradice el §3
Net: reproducibilidad y una carga bajo demanda frente a no tener que pulsar un botón.
Header: Precios
Options:
A) Copia de precios en el plan (recommended)
«Tomar precios de un banco» es una acción explícita: el usuario elige la referencia, la app la carga con loadObraRefSource, busca los códigos de enlace-bcca y guarda en planCalidad.precios {ensayo, código, precio, ud, banco, fecha}. El cálculo solo lee esa copia, el precio de la Junta y el tecleado, por ese orden. Repetir la acción enseña «con este banco el total pasaría de A a B €» antes de aplicar. Riesgo bajo; mantenimiento: un campo más en el esquema v8. (human: ~1 día / CC: ~30 min)
B) Precio en vivo
La vista carga el banco elegido al abrirse y pasa sus precios al cálculo en cada render; solo se congela al exportar el Word. Riesgo: carga de ~50 MB y total no reproducible; mantenimiento: estado de carga, errores y caché en la vista. (human: ~1 día / CC: ~30 min)

State: approved
Actual answer: A «Copia de precios en el plan» (respuesta D2, 2026-10-25)
Accepted scope: acción explícita «Tomar precios de un banco» que carga la referencia elegida con `loadObraRefSource`, busca los códigos de `enlace-bcca` y guarda `planCalidad.precios` {ensayo, código, precio, ud, banco, fecha}; `EntradaPcc` deja `bancos` y lee esa copia; orden de fuentes del §8 = copia → Junta → tecleado → pendiente; repetir la acción enseña «pasaría de A a B €» antes de aplicar; campo en el esquema v8. Con sus tests: cálculo sin banco cargado da el mismo total; la acción con un banco sin el código deja la fila con la fuente siguiente.
History: —

### D4: capítulo de control en el presupuesto
Finding: decisión abierta D4 del plan (`docs/plan-control-calidad.md:592-595`, §9); revisor: plan.
Plan baseline: propuesta original: enlace por defecto, «Crear capítulo de control de calidad», coherencia y aviso de plan pobre (§9).
Runtime evidence: el patrón existe en residuos: `crearCapituloGestionRcd` (`store/slices/rcdSlice.ts:143-171`) y `core/rcd/coherencia.ts`.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| D4 enlace con un capítulo de la obra | propuesta | sí, propuesto por el título | no |
| D4 «Crear capítulo de control» | propuesta | sí, un paso de Deshacer | no |
| D4 coherencia y aviso de plan pobre | propuesta | sí | solo el aviso de plan pobre, sin capítulo |
| A2 cómo se crean las partidas | pendiente | pendiente (se pregunta después) | no aplica |
Question D3:
D3 — ¿El plan toca el presupuesto con un capítulo de control?
Project/branch/task: main, plan de control de calidad, decisión abierta D4 (§9).
ELI10: El CTE dice que el presupuesto «incluirá» el del control de calidad, y el Código Estructural quiere el coste de la estructura aparte y a cargo de la propiedad. La propuesta es enlazar el capítulo de control de la obra, crearlo si no hay, y avisar cuando no cuadra con la valoración. La alternativa deja la valoración solo en el anejo.
Stakes if we pick wrong: sin capítulo, una obra sin partidas de control sale con un plan valorado que no está en el PEM, que es justo lo que la norma pide que no pase.
Recommendation: A because cumple el «incluirá» del anejo I con el mismo patrón ya probado en residuos.
Completeness: A=9/10, B=5/10
Pros / cons:
A) Enlace, crear capítulo y coherencia (recommended)
  ✅ Cumple el «incluirá» del CTE y el coste independiente del Código Estructural
  ✅ Copia un patrón que ya funciona en residuos (crearCapituloGestionRcd y coherencia)
  ❌ Cambia el PEM: va en un paso de Deshacer, con aviso, y hay que decidir cómo se crean las partidas (A2)
B) Solo la valoración en el anejo
  ✅ No toca el presupuesto ni el PEM: menos superficie y menos tests
  ✅ Más rápido de entregar (sin capitulo.ts ni coherencia.ts)
  ❌ No cumple el «incluirá» del anejo I cuando la obra no tiene capítulo de control
Net: cumplir la norma dentro del presupuesto frente a una entrega más corta.
Header: Capítulo
Options:
A) Enlace, crear capítulo y coherencia (recommended)
Como el §9: la app propone el capítulo por su título; «Crear capítulo de control de calidad» añade una partida por fila de la valoración en un paso de Deshacer, con aviso de que cambia el PEM; coherencia en los tres sentidos y aviso de plan pobre. Cómo se crean las partidas se decide aparte (A2). Riesgo medio (toca el PEM); mantenimiento: capitulo.ts y coherencia.ts, como en residuos. (human: ~2 días / CC: ~1 h)
B) Solo la valoración en el anejo
La valoración sale en el Word con su total y su % del PEM, sin enlazar ni crear capítulo; se mantiene el aviso de plan pobre contra la valoración. Riesgo bajo; deja la obra sin el presupuesto de control dentro del PEM. (human: ~2 h / CC: ~10 min)

State: approved
Actual answer: A «Enlace, crear capítulo y coherencia» (respuesta D3, 2026-10-25)
Accepted scope: el §9 tal cual: capítulo propuesto por el título, «Crear capítulo de control de calidad» en un paso de Deshacer con aviso de que cambia el PEM, coherencia en los tres sentidos y aviso de plan pobre; con los tests del plan («Capítulo»). Cómo se crean las partidas, en A2.
History: —

### A2: cómo se crean y se casan las partidas del capítulo de control
Finding: 2, P2, confianza 8/10, `docs/plan-control-calidad.md:366-369` («copiada del banco cargado… o partida propia») y `:363-365` (casar «por código del enlace o por texto»); `src/store/slices/rcdSlice.ts:143-171`; `src/core/refdata.ts:498` (`detectCollisions`); revisor: Claude (plan-eng-review).
Plan baseline: propuesta original: copiar del banco la partida enlazada (con su `~T` pasado por la lista negra) o una partida propia con el precio de la fila; la coherencia casa por código o por texto.
Runtime evidence: residuos crea partidas propias, `items: []`, código nuevo (`nextPartidaCode`) y la marca `rcd.estado: 'gestion'` (`rcdSlice.ts:152-165`). Copiar una partida de banco con descomposición pasa por el flujo de Referencia, con colisiones de recursos (`detectCollisions`, `Resolution` merge/fork, `refdata.ts:477-498`). Con A1 aprobada, el precio ya está en `planCalidad.precios` y no hace falta cargar el banco para crear el capítulo.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| A2 partida creada | banco o propia, sin regla | propia, sin descomposición, precio de la fila | copia del banco con descomposición (flujo de Referencia) |
| A2 código de la partida | sin definir | el del banco si la obra no lo usa ya; si no, `nextPartidaCode` | el del banco (colisión: merge/fork) |
| A2 texto | `~T` por la lista negra o texto propio | el `~T` guardado con el precio (A1) por la lista negra; si falla, el texto propio | el `~T` del banco por la lista negra |
| A2 marca en la partida | `capituloControl` | `pcc: { estado: 'capituloControl', ensayo: <id> }` | ídem |
| A2 cómo casa la coherencia | código o texto | `pcc.ensayo` → código del enlace → texto (propuesta que se confirma) | ídem |
| A1 precios | aprobado (copia en el plan) | se mantiene | se mantiene; el banco se vuelve a cargar al crear |
| D4 capítulo | aprobado | se mantiene | se mantiene |
Question D4:
D4 — Cómo se crean y se reconocen las partidas del capítulo de control
Project/branch/task: main, plan de control de calidad, §9 «Crear capítulo de control de calidad».
ELI10: Al crear el capítulo, el plan duda entre copiar la partida del banco (con su descomposición) o crear una partida propia con el precio de la fila. Copiar del banco obliga a pasar por el flujo de Referencia, que resuelve choques de recursos (mano de obra, materiales) con «fusionar o separar». Además, para que la coherencia no se equivoque, la partida creada debería recordar de qué ensayo viene.
Stakes if we pick wrong: con la copia, crear el capítulo abre el diálogo de colisiones y vuelve a cargar el banco de 50 MB; sin la marca del ensayo, la coherencia casa por texto y puede emparejar mal (210 € es a la vez la química del acero y el suelo-cemento).
Recommendation: A because reutiliza el patrón de residuos, no necesita cargar el banco (el precio ya está guardado por A1) y empareja por un id, no por texto.
Completeness: A=9/10, B=7/10
Pros / cons:
A) Partidas propias marcadas con su ensayo (recommended)
  ✅ Igual que crearCapituloGestionRcd: un paso de Deshacer, sin diálogos ni carga del banco
  ✅ La coherencia casa por pcc.ensayo, sin falsos emparejamientos por importe o texto
  ❌ La partida no lleva descomposición: si el usuario la quiere, la copia luego desde Referencia
B) Copia del banco con descomposición
  ✅ La partida queda idéntica a la del banco, con su justificación de precio
  ✅ Un .bc3 exportado lleva la descomposición del laboratorio
  ❌ Pasa por colisiones de recursos y recarga el banco; más código y más casos que probar
Net: un capítulo sencillo y bien emparejado frente a partidas con descomposición.
Header: Partidas
Options:
A) Partidas propias marcadas con su ensayo (recommended)
Como crearCapituloGestionRcd: una partida por fila de la valoración, sin descomposición, con el precio y el texto guardados en planCalidad.precios (el ~T por la lista negra; si falla, el texto propio del ensayo); código del banco si la obra no lo usa ya, si no nextPartidaCode; marca pcc { estado: 'capituloControl', ensayo: id }. La coherencia casa por pcc.ensayo, luego por código del enlace y, por texto, solo como propuesta que el usuario confirma. Riesgo bajo; mantenimiento: el de residuos. (human: ~4 h / CC: ~20 min)
B) Copia del banco con descomposición
Cada fila con código de enlace se copia del banco por el flujo de Referencia (copyRefPartidas, con detectCollisions y merge/fork de recursos), recargando el banco; las filas sin código, como partida propia. Misma marca pcc y la misma coherencia. Riesgo medio (diálogo de colisiones dentro de un paso de Deshacer); mantenimiento: dos caminos de creación. (human: ~1,5 días / CC: ~1 h)

State: approved
Actual answer: A «Partidas propias marcadas con su ensayo» (respuesta D4, 2026-10-25)
Accepted scope: «Crear capítulo» como `crearCapituloGestionRcd`: una partida por fila, `items: []`, precio y texto de `planCalidad.precios` (que guarda también el `~T`, pasado por la lista negra; si falla, el texto propio del ensayo); código del banco si la obra no lo usa ya, si no `nextPartidaCode`; `pcc: { estado: 'capituloControl', ensayo: <id> }` (`ControlPartida` gana `ensayo?`). Coherencia: `pcc.ensayo` → código del enlace → texto solo como propuesta que se confirma. Tests: crear y Deshacer; código ya usado → código nuevo; coherencia por `ensayo` aunque cambie el título; dos ensayos con el mismo importe no se cruzan.
History: —

### D5: dónde vive la asignación de control
Finding: decisión abierta D5 del plan (`docs/plan-control-calidad.md:596-599`, §4); revisor: plan.
Plan baseline: propuesta original: `Partida.pcc` como `Partida.rcd`; los datos del plan en `ObraData.planCalidad`.
Runtime evidence: `Partida.rcd` viaja al copiar (`copySlice.ts:148`), a Referencia (`refdata.ts:420,454`) y desde .bc3 (`bc3ToPartidas.ts:100`); se aparta si es ilegible (`apartarRcdIlegibles`). Con A2 aprobada, las partidas del capítulo de control necesitan `pcc.ensayo` guardado.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| D5 dónde va la familia de cada partida | propuesta | `Partida.pcc` guardado | se deduce al vuelo, nada en la partida |
| D5 corregir una regla que se equivoca | propuesta | sí, en la partida | no (solo cambiando la regla) |
| D5 esquema | v8 | `Partida.pcc?` + `planCalidad?` | solo `planCalidad?` (con la marca `ensayo` de A2 dentro) |
| A2 marca `pcc.ensayo` | aprobada | en `Partida.pcc` | tendría que ir en `planCalidad` por id de partida |
Question D5:
D5 — ¿La familia de control se guarda en la partida?
Project/branch/task: main, plan de control de calidad, decisión abierta D5 (§4).
ELI10: Cada partida tiene que decir qué control dispara: «hormigón estructural, forjado», «ferralla de taller», «sin control». Se puede guardar en la propia partida, como el residuo, o deducirlo cada vez con las reglas. Si se deduce, el usuario no puede corregir una regla que se equivoca en su obra.
Stakes if we pick wrong: sin guardarlo, un «HA-25» que la regla lee mal no se puede arreglar a mano, y las partidas creadas por A2 no tienen dónde llevar su ensayo.
Recommendation: A because es el patrón de residuos, deja corregir a mano y es donde A2 ya pone pcc.ensayo.
Completeness: A=9/10, B=5/10
Pros / cons:
A) En la partida, como el residuo (recommended)
  ✅ El usuario corrige y confirma partida a partida, y la asignación viaja al copiar
  ✅ Mismo patrón y mismos caminos que Partida.rcd (copia, Referencia, ilegibles)
  ❌ Más esquema: Partida.pcc en v8 y su validación al cargar
B) Deducida al vuelo
  ✅ Menos esquema y nada que migrar en la partida
  ✅ Una regla mejorada arregla todas las obras a la vez
  ❌ No se puede corregir una regla equivocada ni confirmar nada (incumple «nada en silencio»)
Net: control del usuario y el patrón ya probado frente a un esquema más pequeño.
Header: Asignación
Options:
A) En la partida, como el residuo (recommended)
Partida.pcc?: ControlPartida con estado, origen, familia y los datos de hormigón y acero del §4 (y ensayo, por A2); los datos del plan en ObraData.planCalidad. Viaja al copiar, a Referencia y se aparta si es ilegible, como rcd. Riesgo bajo; mantenimiento: el mismo que rcd. (human: ~1 día / CC: ~30 min)
B) Deducida al vuelo
Las reglas se aplican en cada cálculo y nada se guarda en la partida; solo ObraData.planCalidad (que tendría que guardar por id de partida las excepciones y la marca de A2). Riesgo: sin confirmación ni corrección; mantenimiento: excepciones por id que se rompen al copiar. (human: ~4 h / CC: ~20 min)

State: approved
Actual answer: A «En la partida, como el residuo» (respuesta D5, 2026-10-25)
Accepted scope: `Partida.pcc?: ControlPartida` (§4, con `ensayo?` de A2) y `ObraData.planCalidad?`; viaja al copiar (`copySlice`), a Referencia (`refdata`) y por `bc3ToPartidas` como `rcd`; `apartarPccIlegibles` al cargar. Tests del plan («Store y esquema»).
History: —

### D7: superficie construida y plantas para los lotes de hormigón
Finding: decisión abierta D7 del plan (`docs/plan-control-calidad.md:602-604`, §6); revisor: plan.
Plan baseline: propuesta original: superficie y plantas por grupo de estructura, prerrellenas con la superficie construida y las plantas de la obra, «un dato nuevo en la ficha».
Runtime evidence: la ficha de la obra (`Obra`) no tiene superficie construida; residuos ya la pide en su propio estudio (`DatosRatios.superficieConstruida`, `core/rcd/tipos.ts`). Un dato en la ficha cambia `Obra`, que también lee la cabecera de los documentos.
Comparison grid:
| Elección | Actual | A | B | C |
|---|---|---|---|---|
| D7 dónde se teclea la superficie y las plantas de la obra | propuesta: ficha | `planCalidad` (una vez) | ficha de la obra (`Obra`) | no hay dato de obra |
| D7 grupos | por grupo, prerrellenos | prerrellenos desde `planCalidad`, editables | prerrellenos desde la ficha, editables | solo por grupo |
| D7 residuos | su propio dato | no se toca | no se toca (unificar, TODO) | no se toca |
Question D6:
D6 — Dónde se teclea la superficie construida y las plantas
Project/branch/task: main, plan de control de calidad, decisión abierta D7 (§6).
ELI10: Los lotes de hormigón dependen de la superficie construida y del número de plantas de cada grupo (cimentación, forjados, pilares). En una unifamiliar todos los grupos tienen la misma, así que la idea es teclearla una vez y que rellene los grupos. La duda es dónde: en el plan de calidad, en la ficha de la obra (que hoy no la tiene) o en ningún sitio común.
Stakes if we pick wrong: sin dato común, en una unifamiliar se teclea lo mismo tres veces; en la ficha, se toca Obra (cabeceras, impresión) por un dato que hoy solo usa calidad.
Recommendation: A because consigue el «se teclea una vez» del objetivo sin tocar la ficha de la obra.
Completeness: A=8/10, B=9/10, C=6/10
Pros / cons:
A) En el plan de calidad (recommended)
  ✅ Se teclea una vez y rellena los grupos, sin tocar la ficha ni las cabeceras
  ✅ Todo el dato nuevo queda en planCalidad, en el mismo esquema v8
  ❌ Residuos sigue pidiendo la suya: el mismo número en dos sitios
B) En la ficha de la obra
  ✅ Un único dato para calidad y, más adelante, residuos
  ✅ Es lo que propone el plan
  ❌ Cambia Obra y su ficha por un dato que hoy solo usa calidad
C) Solo por grupo
  ✅ Ningún dato nuevo de obra; lo más simple
  ✅ Exacto en obras con grupos distintos
  ❌ En una unifamiliar se teclea tres veces lo mismo; incumple el objetivo
Net: un dato en su módulo frente a un dato común de la obra.
Header: Superficie
Options:
A) En el plan de calidad (recommended)
planCalidad.superficieConstruida y planCalidad.plantas, tecleados una vez; cada grupo de estructura los toma por defecto y se pueden cambiar en su fila. Residuos no se toca. Riesgo bajo; mantenimiento: dos campos en planCalidad. (human: ~2 h / CC: ~10 min)
B) En la ficha de la obra
Obra.superficieConstruida y Obra.plantas en la ficha; los grupos los toman por defecto y se pueden cambiar. Residuos no se toca ahora (unificarlo queda como TODO). Riesgo: toca Obra, su ficha y las cabeceras; mantenimiento: un dato de obra más. (human: ~4 h / CC: ~20 min)
C) Solo por grupo
Cada grupo pide su superficie y sus plantas, sin dato de obra. Riesgo bajo; en una unifamiliar se teclea varias veces. (human: ~1 h / CC: ~5 min)

State: approved
Actual answer: A «En el plan de calidad» (respuesta D6, 2026-10-25)
Accepted scope: `planCalidad.superficieConstruida` y `planCalidad.plantas`, una vez; cada grupo los toma por defecto y se cambian en su fila; residuos no se toca. Test: obra A con el dato de obra y sin datos por grupo da los lotes del caso A; un grupo con su propio dato manda sobre el de la obra.
History: —

### D3f: ferralla de taller por defecto
Finding: decisión D3 del plan, con la ferralla «propuesta: confirmar en la revisión» (`docs/plan-control-calidad.md:585-588`, §6 «Procedencia de la ferralla»); revisor: plan.
Plan baseline: propuesta: ferralla de taller por defecto, con aviso (art. 59.2: lotes de 25 t); hormigón sin distintivo y control normal ya cerrados el 2026-10-24.
Runtime evidence: no aplica (dato normativo, K-PCC.31–32).
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| D3f procedencia por defecto | propuesta: taller | taller, con aviso | ninguna: pendiente hasta que se diga |
| D3f cálculo sin el dato | art. 59.2 | art. 59.2 con aviso en «Antes de entregar» | sin ensayos de armaduras; fila pendiente |
| D3 hormigón sin distintivo, control normal | cerrado | se mantiene | se mantiene |
Question D7:
D7 — ¿Ferralla de taller por defecto?
Project/branch/task: main, plan de control de calidad, D3 (valores por defecto), punto pendiente de confirmar.
ELI10: Con ferralla armada en taller se ensaya la ferralla (Código Estructural, art. 59.2, lotes de 25 t); con barras dobladas en obra se ensayan las barras (art. 58, lotes de 30 t por serie de diámetros). El plan propone suponer taller, que es lo corriente en vivienda, y avisarlo. La otra opción es no suponer nada y dejar las armaduras pendientes hasta que el técnico lo diga.
Stakes if we pick wrong: con taller por defecto, una obra que dobla en obra sale con los ensayos de otro artículo si el aviso se ignora; sin defecto, un plan sin ese dato sale sin ningún ensayo de acero.
Recommendation: A because es lo corriente en vivienda, sigue el criterio de D3 (suponer y avisar) y nunca deja el plan con 0 ensayos de acero.
Completeness: A=8/10, B=7/10
Pros / cons:
A) Taller por defecto, con aviso (recommended)
  ✅ El plan sale completo desde el principio, con los ensayos del art. 59.2
  ✅ Mismo criterio que el resto de D3: un valor por defecto a la vista y avisado
  ❌ Si el técnico no lee el aviso y la ferralla se dobla en obra, el artículo es otro
B) Sin valor por defecto
  ✅ Nunca se supone nada sobre cómo se arma la ferralla
  ✅ Obliga a decidirlo antes de entregar
  ❌ Hasta que se diga, el plan no tiene ensayos de armaduras: el plan pobre que la app debe evitar
Net: un plan completo con un supuesto avisado frente a un dato obligatorio.
Header: Ferralla
Options:
A) Taller por defecto, con aviso (recommended)
Sin dato, la ferralla se trata como de taller (art. 59.2: lotes de 25 t, tracciones, geometrías, 15 unidades) y «Antes de entregar» avisa de que es un supuesto. Riesgo bajo; mantenimiento: nada nuevo. (human: ~30 min / CC: ~5 min)
B) Sin valor por defecto
Sin dato, las armaduras salen pendientes, sin ensayos ni importe, y «Antes de entregar» pide la procedencia. Riesgo: plan sin ensayos de acero mientras falte; mantenimiento: nada nuevo. (human: ~30 min / CC: ~5 min)

State: approved
Actual answer: A «Taller por defecto, con aviso» (respuesta D7, 2026-10-25)
Accepted scope: sin dato, art. 59.2 (ferralla de taller) con aviso en «Antes de entregar»; D3 queda cerrada entera. Test: obra A sin procedencia da el 59.2 y el aviso; con «obra», el art. 58 por serie.
History: —

### D8: niveles de la hoja de la Junta
Finding: decisión abierta D8 del plan (`docs/plan-control-calidad.md:605-607`); revisor: plan.
Plan baseline: propuesta original: nivel 1 de las familias presentes propuesto; nivel 2 y 3 desmarcados, a criterio; la regla de la hoja (PEM > 300.000 € → también nivel 2) solo como recomendación.
Runtime evidence: no aplica (dato del catálogo, D1).
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| D8 nivel 1 | propuesto | propuesto (se confirma) | propuesto (se confirma) |
| D8 niveles 2 y 3 | desmarcados, visibles | desmarcados, visibles, a casilla | no se muestran |
| D8 regla de 300.000 € | como recomendación | aviso con la regla, sin aplicarla | no se muestra |
Question D8:
D8 — Qué hacer con los niveles 2 y 3 de la hoja de la Junta
Project/branch/task: main, plan de control de calidad, decisión abierta D8.
ELI10: El catálogo de la Junta clasifica cada ensayo en nivel 1, 2 o 3, y recomienda añadir el nivel 2 cuando el PEM pasa de 300.000 €. Eso es una recomendación, no una norma. La propuesta es proponer el nivel 1 y enseñar el 2 y el 3 desmarcados, con la regla de los 300.000 € como aviso. La alternativa es esconderlos.
Stakes if we pick wrong: escondidos, el técnico no ve ensayos que quizá quiera; aplicados solos, el plan mete coste que ninguna norma pide.
Recommendation: A because deja decidir al técnico con toda la información y no aplica una recomendación como si fuera norma.
Completeness: A=9/10, B=6/10
Pros / cons:
A) Nivel 1 propuesto; 2 y 3 a casilla (recommended)
  ✅ El técnico ve todo el catálogo de la familia y elige, con la regla de 300.000 € a la vista
  ✅ No mete coste sin que nadie lo marque
  ❌ Una lista más larga en la vista y en la revisión
B) Solo nivel 1
  ✅ Vista más corta y plan más simple
  ✅ Menos filas que probar
  ❌ Los ensayos de nivel 2 y 3 no se pueden añadir desde la app
Net: catálogo completo a elección frente a una lista corta.
Header: Niveles
Options:
A) Nivel 1 propuesto; 2 y 3 a casilla (recommended)
Los ensayos de nivel 1 de las familias presentes salen propuestos; los de nivel 2 y 3, desmarcados y a casilla; con PEM > 300.000 €, un aviso cita la recomendación de la hoja sin marcar nada. Riesgo bajo; mantenimiento: un filtro por nivel. (human: ~2 h / CC: ~10 min)
B) Solo nivel 1
Solo entran los ensayos de nivel 1; el 2 y el 3 no se muestran ni se pueden añadir, y no hay aviso de 300.000 €. Riesgo bajo; menos opciones para el técnico. (human: ~1 h / CC: ~5 min)

State: approved
Actual answer: A «Nivel 1 propuesto; 2 y 3 a casilla» (respuesta D8, 2026-10-25)
Accepted scope: nivel 1 de las familias presentes propuesto (se confirma); nivel 2 y 3 desmarcados y a casilla; con PEM > 300.000 €, aviso que cita la recomendación sin marcar nada. Test: PEM de 299.999 € sin aviso y de 300.001 € con aviso; ningún nivel 2 entra en la valoración sin marcarlo.
History: —

### D9: pruebas de obra terminada a criterio del proyecto
Finding: decisión abierta D9 del plan (`docs/plan-control-calidad.md:608-610`, §7); revisor: plan.
Plan baseline: propuesta original: solo la estanqueidad de cubierta plana se propone sola; blower door, ventanas, barandillas y acústica estatal a casilla; en Andalucía, la acústica de la IT 5 siempre.
Runtime evidence: no aplica (K-PCC.12–15 y K-PCC.47).
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| D9 cubierta plana | propuesta sola | propuesta (se confirma) | a casilla |
| D9 blower door, ventanas, barandillas, acústica estatal | a casilla | a casilla | a casilla |
| D9 acústica IT 5 en Andalucía | siempre | siempre | siempre |
Question D9:
D9 — ¿Qué pruebas a criterio del proyecto se proponen solas?
Project/branch/task: main, plan de control de calidad, decisión abierta D9 (§7).
ELI10: El CTE casi no obliga a pruebas de obra terminada: la estanqueidad de la cubierta plana, el blower door, las ventanas, las barandillas y la acústica son a criterio del proyecto. Solo la acústica de la IT 5 es obligatoria en Andalucía. La propuesta es que la app proponga sola la de cubierta plana cuando hay una partida que la reconoce, y deje el resto a casilla.
Stakes if we pick wrong: si no se propone ninguna, una cubierta plana sale sin prueba de estanqueidad aunque sea la más habitual; si se proponen todas, el plan mete coste que la norma no pide.
Recommendation: A because la de cubierta plana es la prueba habitual y la app ya tiene la partida que la dispara; el resto queda a elección.
Completeness: A=9/10, B=8/10
Pros / cons:
A) Cubierta plana propuesta; el resto a casilla (recommended)
  ✅ La prueba más habitual entra sola cuando hay cubierta plana, pendiente de confirmar
  ✅ Ninguna otra prueba mete coste sin que el técnico la marque
  ❌ Una regla más (cubierta plana) que probar con partidas reales
B) Todas a casilla
  ✅ Ninguna prueba no obligatoria entra sola
  ✅ Una regla menos
  ❌ Una cubierta plana puede salir sin prueba de estanqueidad si nadie la marca
Net: proponer la prueba habitual frente a no proponer nada que no sea obligatorio.
Header: Pruebas
Options:
A) Cubierta plana propuesta; el resto a casilla (recommended)
Con una partida de cubierta plana, la prueba de estanqueidad sale propuesta (pendiente de confirmar, como toda propuesta); blower door, ventanas, barandillas y acústica estatal, a casilla; en Andalucía la acústica de la IT 5 siempre, con su muestreo. Riesgo bajo; mantenimiento: una regla. (human: ~1 h / CC: ~5 min)
B) Todas a casilla
Ninguna prueba a criterio se propone sola; solo entra lo que el técnico marque, y en Andalucía la acústica de la IT 5 siempre. Riesgo bajo; puede quedar una cubierta plana sin prueba. (human: ~30 min / CC: ~5 min)

State: approved
Actual answer: A «Cubierta plana propuesta; el resto a casilla» (respuesta D9, 2026-10-25)
Accepted scope: el §7 tal cual: estanqueidad de cubierta plana propuesta si hay partida que la reconoce; el resto a casilla; IT 5 siempre en Andalucía con su muestreo. Test: obra A propone la prueba de cubierta (pendiente de confirmar); sin cubierta plana, no.
History: —

### Q1: sobre qué PEM se da el % del control
Finding: 3, P3, confianza 8/10, `docs/plan-control-calidad.md:350-351` («El total sale también como % del PEM, como dato») y `:369` («Crear capítulo»… «Cambia el PEM»); revisor: Claude (plan-eng-review).
Plan baseline: propuesta original: % del PEM como dato, sin decir qué PEM.
Runtime evidence: el PEM sale de `core/totales.ts` con todos los capítulos; tras «Crear capítulo» (D4 aprobada) el capítulo de control ya está dentro.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| Q1 base del % | sin definir | PEM sin el capítulo de control enlazado | PEM total |
| Q1 cambia al crear el capítulo | sin definir | no | sí (el % baja un poco) |
| D4 capítulo | aprobado | se mantiene | se mantiene |
Question D10:
D10 — Sobre qué PEM se calcula el % del control de calidad
Project/branch/task: main, plan de control de calidad, §8 («% del PEM como dato»).
ELI10: El plan da el coste del control también como % del PEM, solo como dato. Pero al crear el capítulo de control, ese capítulo entra en el PEM, así que el % cambia según se calcule con él o sin él. Hay que fijar una base para que el mismo plan no dé dos porcentajes.
Stakes if we pick wrong: el % del Word y el de la vista pueden no coincidir antes y después de crear el capítulo, y el técnico no sabe cuál vale.
Recommendation: A because el % no se mueve al crear el capítulo y compara el control con la obra que controla.
Completeness: A=9/10, B=8/10
Pros / cons:
A) PEM sin el capítulo de control (recommended)
  ✅ El mismo % antes y después de crear el capítulo
  ✅ Compara el control con la obra que se controla, no consigo mismo
  ❌ El Word tiene que decir la base («sobre el PEM sin el capítulo de control»)
B) PEM total
  ✅ Es el PEM que el técnico ve en el resumen
  ✅ Sin restas: menos código
  ❌ El % cambia al crear el capítulo y se calcula sobre sí mismo
Net: un % estable frente al PEM tal cual.
Header: % del PEM
Options:
A) PEM sin el capítulo de control (recommended)
% = total de la valoración ÷ (PEM − importe del capítulo de control enlazado); el Word dice la base en la misma línea. Riesgo bajo; mantenimiento: una resta. (human: ~30 min / CC: ~5 min)
B) PEM total
% = total de la valoración ÷ PEM de la obra, con el capítulo de control dentro si existe. Riesgo bajo; el % se mueve al crear el capítulo. (human: ~15 min / CC: ~2 min)

State: approved
Actual answer: A «PEM sin el capítulo de control» (respuesta D10, 2026-10-25)
Accepted scope: % = total de la valoración ÷ (PEM − importe del capítulo de control enlazado), con la base dicha en el Word. Test: el % es el mismo antes y después de «Crear capítulo»; sin capítulo enlazado, la base es el PEM entero.
History: la fórmula «PEM − importe» la sustituye O1b (respuesta D15): base = `pem()` sin el capítulo, por los CI. La intención de D10 se mantiene.

### Q2: una designación de hormigón no válida, ¿cuenta para los lotes?
Finding: 4, P2, confianza 8/10, `docs/plan-control-calidad.md:240-242` («Una clase no válida… deja la partida con aviso y no dispara durabilidad hasta que se corrija») y `:474` (caso A, «HA-25/B/20/IIa», 3 m³); revisor: Claude (plan-eng-review).
Plan baseline: propuesta original: aviso y sin durabilidad; no dice si su volumen entra en los lotes de resistencia.
Runtime evidence: no aplica (código futuro); los lotes dependen del tipo y de la fila de la tabla 57.5.4.1, no de la clase de exposición (§5.1-5.2).
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| Q2 volumen en los lotes | sin definir | cuenta, con tipo y fck leídos (HA-25) | no cuenta hasta corregir |
| Q2 durabilidad | no se dispara | no se dispara | no se dispara |
| Q2 aviso | sí | sí, «designación con clase no válida» | sí, «partida fuera del cálculo» |
Question D11:
D11 — ¿Una designación de hormigón mal escrita cuenta para los lotes?
Project/branch/task: main, plan de control de calidad, §4 «Designación de hormigón».
ELI10: Los presupuestos traen designaciones como «HA-25/B/20/IIa» (clase de la EHE) o con erratas («CX1»). El plan ya dice que esas partidas no disparan los ensayos de durabilidad hasta que se corrijan. No dice si su volumen cuenta para los lotes de resistencia, que dependen del tipo y la resistencia (HA-25), no de la clase de exposición.
Stakes if we pick wrong: si no cuentan, una obra con todas sus partidas en «IIa» sale con 0 lotes de hormigón: el plan pobre que la app debe impedir.
Recommendation: A because el tipo y la resistencia se leen bien aunque la clase esté mal, y quitar el volumen da menos ensayos de los que pide la norma.
Completeness: A=9/10, B=6/10
Pros / cons:
A) Cuenta para los lotes; durabilidad bloqueada (recommended)
  ✅ Nunca deja la obra sin lotes por una errata en la clase de exposición
  ✅ El aviso dice qué corregir y que la durabilidad queda pendiente
  ❌ Si el tipo también está mal (no se lee HA ni fck), la partida sí queda fuera, con aviso
B) Fuera del cálculo hasta corregir
  ✅ No se calcula nada sobre un dato dudoso
  ✅ Más simple: una sola regla para la partida no válida
  ❌ Un presupuesto entero en nomenclatura EHE sale sin lotes de hormigón
Net: no perder ensayos por una errata frente a no usar un dato dudoso.
Header: Designación
Options:
A) Cuenta para los lotes; durabilidad bloqueada (recommended)
Si el tipo (HM/HA/HP) y el fck se leen, la partida entra en su grupo y cuenta para los lotes; la durabilidad no se dispara y el aviso pide corregir la clase. Si no se lee el tipo o el fck, queda fuera del cálculo con aviso. Riesgo bajo; mantenimiento: dos casos en hormigon.ts. (human: ~1 h / CC: ~5 min)
B) Fuera del cálculo hasta corregir
Con cualquier parte no válida, la partida no cuenta para lotes ni durabilidad y el aviso dice que está fuera del cálculo. Riesgo: obras enteras sin lotes; mantenimiento: un caso. (human: ~30 min / CC: ~5 min)

State: approved
Actual answer: A «Cuenta para los lotes; durabilidad bloqueada» (respuesta D11, 2026-10-25)
Accepted scope: con tipo y fck legibles, la partida entra en su grupo y cuenta para los lotes; la durabilidad no se dispara y el aviso pide corregir la clase; sin tipo o fck legibles, fuera del cálculo con aviso. Tests: el «HA-25/B/20/IIa» del caso A suma sus 3 m³ a su grupo y no da penetración; «HX-2O/…» queda fuera con aviso.
History: —

Corrección de hecho de la sección 2 (sin pregunta): el §5.1 pide «espesor equivalente o volumen declarado» para un forjado medido en m², pero `ControlPartida` (§4) no tiene dónde guardarlo. Se añade `hormigon.m3PorUd?: number | null` (`null` = falta, se pide), como `Conversion` en residuos. Riesgo que queda por verificar en E1, confianza 5/10: si dos designaciones con la misma resistencia y distinta clase de exposición (XC1 y XC2) comparten lote; el plan agrupa por «tipo de hormigón» sin decir si la clase entra en el tipo. Se cierra contra B «Para la app» A2 antes de escribir `estructura.ts`.

### T1: contrato de regresión del Word de residuos al sacar los tipos a `core/documento/`
Finding: 5, P1 (regla de regresión), confianza 9/10, `docs/plan-control-calidad.md:412-415` («sin cambiar la salida del de residuos (su test lo asegura)») con la estructura aprobada en D1; `src/features/exportar/docxRcd.test.ts:32-62` y `src/core/rcd/documento.test.ts:51-106`; revisor: Claude (plan-eng-review).
Plan baseline: propuesta original: «su test lo asegura». Estructura aprobada (D1): mover a `core/documento/` los tipos y un `bloques()` genérico sacado de `bloquesRcd`.
Runtime evidence: los tests de hoy comprueban estilos de título, cabecera repetida, color de aviso, firma y nombre de fichero (`docxRcd.test.ts`) y el contenido por apartados y citas (`documento.test.ts`); ninguno compara la salida entera antes y después. Callers en riesgo: `docxRcdFor` (`docxRcd.ts:106`), `bloquesRcd` (`docxRcd.ts:77`) y `textoPlano` (`documento.ts:432`), que usa el test de citas.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| T1 comportamiento que se conserva | «la salida no cambia» | el texto y la estructura de bloques del Word de residuos, iguales | ídem |
| T1 cambio intencionado | ninguno | ninguno: solo se mueven tipos y `bloques()` | ninguno |
| T1 prueba | los tests de hoy | golden de `textoPlano` y de la lista de bloques (tipo, estilo, texto) de las obras de `src/test/fixtures/rcd/obras.ts`, grabado ANTES de mover, más los tests de hoy | solo los tests de hoy y `tsc -b` |
Question D12:
D12 — Cómo se prueba que el Word de residuos no cambia al compartir sus tipos
Project/branch/task: main, plan de control de calidad, §12 con la estructura aprobada en D1.
ELI10: Para que el Word de calidad use los mismos bloques que el de residuos, hay que sacar de residuos los tipos del documento y la función que los pinta. Es un movimiento de código, no un cambio de lógica, pero el Word de residuos ya se entrega a clientes. Los tests de hoy miran estilos y citas, no la salida entera. La propuesta es grabar la salida de las obras de prueba antes de mover nada y exigir que salga igual después.
Stakes if we pick wrong: un párrafo perdido o una tabla con otro estilo en el Word de residuos pasaría los tests de hoy y llegaría al cliente sin que nadie lo vea.
Recommendation: A because es la única prueba que compara la salida entera, y grabarla cuesta minutos.
Completeness: A=10/10, B=7/10
Pros / cons:
A) Golden antes de mover, más los tests de hoy (recommended)
  ✅ Cualquier cambio en el texto o en la estructura del Word de residuos rompe un test
  ✅ Se graba con las obras de prueba que ya hay (src/test/fixtures/rcd/obras.ts)
  ❌ Un golden más que mantener cuando el Word de residuos cambie a propósito
B) Solo los tests de hoy y tsc
  ✅ Nada nuevo que mantener
  ✅ tsc ya pilla un tipo mal movido
  ❌ No ve un bloque perdido o reordenado: los tests de hoy no comparan la salida entera
Net: una red de seguridad completa por unos minutos frente a fiarse de tests parciales.
Header: Regresión
Options:
A) Golden antes de mover, más los tests de hoy (recommended)
Primer commit de E4: un test que graba textoPlano(documentoRcd(...)) y la lista de bloques (tipo, estilo y texto de cada uno) de cada obra de src/test/fixtures/rcd/obras.ts, en verde con el código de hoy. Segundo commit: mover los tipos y bloques() a core/documento/ sin tocar el golden. Siguen los tests de docxRcd.test.ts y documento.test.ts. Riesgo bajo; mantenimiento: regrabar el golden cuando residuos cambie a propósito. (human: ~2 h / CC: ~10 min)
B) Solo los tests de hoy y tsc
Se mueve el código y basta con que pasen docxRcd.test.ts, documento.test.ts y tsc -b. Riesgo: un cambio de salida que esos tests no miran pasa sin verse. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Golden antes de mover, más los tests de hoy» (respuesta D12, 2026-10-25)
Accepted scope: primer commit de E4, `src/features/exportar/docxRcd.golden.test.ts` (o junto a `documento.test.ts`) con `textoPlano` y la lista de bloques (tipo, estilo, texto) de cada obra de `src/test/fixtures/rcd/obras.ts`, en verde con el código de hoy; segundo commit, mover tipos y `bloques()` a `core/documento/` sin tocar el golden; siguen `docxRcd.test.ts` y `documento.test.ts`. Sin cambios intencionados en la salida de residuos.
History: —

### Mapa de cobertura (sección 3)

Todo el código es futuro: `[PLAN]` = el plan ya pide el test; `[AÑADIDO]` = lo añade esta revisión
(prueba de un comportamiento ya aceptado, sin decisión nueva); `[→E2E]` = prueba de varias piezas
juntas. Framework: Vitest + Testing Library (`vitest run`; `*.node.test.ts` con
`vitest.node.config.ts`).

```
CODE PATHS                                              USER FLOWS
[+] core/pcc/estructura.ts                              [+] Empezar el plan (vista «Calidad»)
  ├── lotes por grupo: 16 casos de A6        [PLAN]       ├── [AÑADIDO] [→E2E] estado vacío → «Empezar» →
  │   ├── E11: control indirecto no ofrecido [AÑADIDO]    │   propuestas → «Aceptar propuestas» → lotes
  │   └── E5: solo con cuba declarada        [AÑADIDO]    │   (Calidad.test.tsx, como Residuos.test.tsx)
  ├── grupo con dato propio > dato de obra   [AÑADIDO D6] ├── [PLAN] Deshacer de asignar, homónimos
  ├── durabilidad (XS1+XF2 = un tipo)        [PLAN]       └── [AÑADIDO] pestaña de la obra más nueva → solo lectura
  ├── armaduras: 59.2 por defecto / 58       [AÑADIDO D7] [+] Precios (A1)
  └── forjado en m² sin m3PorUd → pendiente  [AÑADIDO]    ├── [AÑADIDO] «Tomar precios» con banco cargado
[+] core/pcc/hormigon.ts                                  ├── [AÑADIDO] banco sin el código → fuente siguiente
  ├── clases del art. 27; IIa/CX1/XC2a/X0     [PLAN]       └── [AÑADIDO] repetir: «pasaría de A a B €», sin aplicar
  ├── IIa cuenta en lotes, sin durabilidad   [AÑADIDO D11][+] Capítulo (D4/A2)
  └── tipo/fck ilegible → fuera con aviso    [AÑADIDO D11] ├── [PLAN] crear y Deshacer
[+] core/pcc/reglas.ts                                     ├── [AÑADIDO] código ya usado → código nuevo
  ├── juego de códigos a mano (CI)           [AÑADIDO]    ├── [AÑADIDO] casa por pcc.ensayo aunque cambie el título
  ├── bases enteras de samples (skipIf)      [PLAN]       ├── [AÑADIDO] mismo importe, dos ensayos: no se cruzan
  ├── exclusiones K-PCC.70                   [PLAN]       └── [AÑADIDO] % igual antes y después (D10)
  └── cubierta plana propone prueba          [AÑADIDO D9] [+] Word
[+] core/pcc/calculo.ts + precios.ts                       ├── [PLAN] citas prohibidas; 305/2011 presente
  ├── orden de fuentes del precio            [PLAN]       ├── [PLAN] texto ↔ valoración (K-PCC.61)
  ├── unidades que no casan → pendiente      [PLAN]       ├── [AÑADIDO D12] golden de residuos antes de mover
  ├── nivel 2/3 nunca sin marcar; 300.000 €  [AÑADIDO D8] └── [PLAN] hito: se abre en Word (manual)
  ├── plan pobre: HA con 0 ensayos → aviso   [AÑADIDO]
  └── sin bancos en la entrada: mismo total  [AÑADIDO A1]
[+] store/schema.ts + slices/pccSlice.ts
  ├── v7 → v8; pcc ilegible → _ilegible      [PLAN]
  ├── copiar lleva pcc; BASE no pasa a copia [PLAN]
  └── capituloControl sin residuo (BCCA 18)  [AÑADIDO]

COVERAGE (planificada): 44/44 ramas con test previsto | del plan: 21 | añadidas: 23
GAPS que quedan: 0 sin test previsto  |  E2E: 1 (flujo de la vista)  |  sin LLM: no hay eval
```

LLM/eval: no aplica (la IA para proponer familias está fuera de alcance).

### P1: que el motor y sus tablas no entren en el chunk principal
Finding: 6, P2, confianza 7/10, `docs/plan-control-calidad.md:232-237` (`reglas.ts`) y `:184-195` (tablas JSON); `src/store/slices/rcdSlice.ts:17` (el store importa las reglas, así que van al chunk principal), `src/App.tsx:38` (la vista de residuos es `lazy`); revisor: Claude (plan-eng-review).
Plan baseline: el plan solo pide «chunk diferido» para el Word (§12); no dice nada del motor ni de las tablas.
Runtime evidence: en residuos, el store importa `core/rcd/reglas` (con `densidades-se-ae.json`, 5 KB) y la vista se carga diferida. El catálogo de la Junta (cientos de ensayos), las tablas del Código y `estructura.ts` irían al chunk principal si `pccSlice` o el chip de `PartidaRow` los importan.
Comparison grid:
| Elección | Actual | A | B |
|---|---|---|---|
| P1 qué importa el store | sin definir | solo `reglas.ts`, `familias.json` y `datos.ts` | lo que haga falta |
| P1 dónde van catálogo, tablas, cálculo y textos | sin definir | en el chunk de la vista «Calidad» y en el de `docxPcc` | donde caigan |
| P1 comprobación | ninguna | test que busca en el chunk principal de `vite build` un id del catálogo y uno de `lotes-hormigon`, y falla si los encuentra | ninguna |
Question D13:
D13 — Que el motor de calidad no engorde la carga inicial de la app
Project/branch/task: main, plan de control de calidad, §3 y §4 (tablas y reglas).
ELI10: La app carga al arrancar el store y lo que este importa; las vistas pesadas se cargan solo al abrirlas. En residuos, el store importa las reglas (pequeñas) y el resto se carga con la vista. El catálogo de la Junta y las tablas del Código son mucho más grandes: si el store o el chip del presupuesto los importan, toda la app tarda más en abrir aunque nadie use calidad.
Stakes if we pick wrong: un import mal puesto mete cientos de KB en la carga inicial de todas las obras, y nadie lo nota hasta que la app va lenta en el móvil.
Recommendation: A because fija qué puede importar el store y lo comprueba en el build, así un import descuidado no pasa.
Completeness: A=9/10, B=5/10
Pros / cons:
A) Límite de imports y comprobación en el build (recommended)
  ✅ El store solo trae reglas y familias; catálogo, tablas y cálculo van con la vista
  ✅ Un test del build falla si el catálogo aparece en el chunk principal
  ❌ Un test más que depende de la salida de vite build
B) Sin límite
  ✅ Nada que mantener
  ✅ Más libertad para importar donde convenga
  ❌ Un import descuidado engorda la carga de todas las obras sin que salte nada
Net: una regla de imports vigilada frente a confiar en no equivocarse.
Header: Carga
Options:
A) Límite de imports y comprobación en el build (recommended)
pccSlice y el chip solo importan core/pcc/reglas.ts, familias.json y datos.ts; catálogo, tablas del Código, calculo.ts, estructura.ts y textos.ts solo desde la vista Calidad (lazy, como Residuos) y docxPcc. Un test node tras vite build busca en el chunk principal un id del catálogo y uno de lotes-hormigon y falla si aparecen. Riesgo bajo; mantenimiento: el test del build. (human: ~2 h / CC: ~15 min)
B) Sin límite
Cada módulo importa lo que necesite, sin regla ni comprobación. Riesgo: carga inicial más pesada sin aviso; mantenimiento: ninguno. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Límite de imports y comprobación en el build» (respuesta D13, 2026-10-25)
Accepted scope: `pccSlice` y el chip solo importan `core/pcc/reglas.ts`, `familias.json` y `datos.ts`; catálogo, tablas del Código, `calculo.ts`, `estructura.ts` y `textos.ts` solo desde la vista «Calidad» (lazy) y `docxPcc`; un test node tras `vite build` falla si el chunk principal contiene un id del catálogo o de `lotes-hormigon`.
History: —

Rendimiento, resto (sin hallazgos): el cálculo se memoiza sobre `chapters`, `partidas`, `rates`, `obra` y `planCalidad`, como `useEstudioRcd`; el caso B (plurifamiliar) son cientos de partidas y un recorrido lineal; con A1 no hay carga de banco al abrir la vista. No hay acceso a red ni a IndexedDB en el cálculo.

### Voz externa (Codex, 2026-10-25)

Codex (`codex exec`, solo lectura) completó la revisión con 6 hallazgos y «Recommendation: revise
the plan before implementation». Todos comprobados contra el código. El 1 junta dos elecciones
independientes y se parte en O1a y O1b. Menú de cada uno: A aplicar, B dejar como está,
C investigar antes, D aplazar solo esta propuesta.

### O1a: el coeficiente K y los costes indirectos frente a la valoración
Finding: Codex 1, P1, confianza 9/10, `src/core/medicion.ts:61-63` (`importeCents(cantidad, precio · coefK)`) y `src/core/totales.ts:44-62` (PEM = CD + CI); revisor: Codex, verificado por Claude.
Plan baseline: A2 aprobada (partidas creadas con el precio de la fila; coherencia por `pcc.ensayo`); la coherencia del §9 compara «cantidades distintas».
Runtime evidence: con K = 0,9 una fila de 1.000 € entra en el capítulo por 900 €; con CI del 3 % aporta 927 € al PEM. La coherencia por cantidades no lo ve.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O1a qué compara la coherencia | cantidades | cantidad y precio unitario (sin K) | cantidades | sin decidir: se mide con obras con K ≠ 1 y CI > 0 | cantidades, propuesta aplazada |
| O1a aviso de K y CI | ninguno | con K ≠ 1 o CI > 0: «el capítulo aporta X € al PEM; la valoración es Y €», las dos cifras | ninguno | ninguno | ninguno |
| A2 precio de la partida creada | aprobado: el de la fila | se mantiene | se mantiene | se mantiene | se mantiene |
Question D14:
D14 — El coeficiente K y los costes indirectos cambian lo que el capítulo aporta al PEM
Project/branch/task: main, plan de control de calidad, voz externa (Codex 1), §9 y A2.
ELI10: La app multiplica cada precio por el coeficiente K de la obra y suma los costes indirectos al PEM. Así, una valoración de 1.000 € metida en el capítulo de control aporta 900 € con K = 0,9, o 1.030 € con un 3 % de CI. La coherencia del plan solo compara cantidades, así que diría «cuadra» aunque el dinero no cuadre.
Stakes if we pick wrong: el Word dice que el control cuesta 1.000 € y el presupuesto lleva 900 €, sin ningún aviso.
Recommendation: A because el técnico ve las dos cifras y la causa, sin tocar los precios de laboratorio.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Comparar precio unitario y avisar de K y CI (recommended)
  ✅ La coherencia ve un precio cambiado a mano, no solo la cantidad
  ✅ Con K o CI, el técnico ve cuánto aporta el capítulo al PEM y por qué no es la valoración
  ❌ Un aviso más en obras con K o CI, aunque todo esté bien
B) Dejarlo como está
  ✅ Nada nuevo que hacer ni probar
  ✅ La coherencia sigue siendo simple
  ❌ El dinero del capítulo y el de la valoración pueden no cuadrar sin que salte nada
C) Investigar antes
  ✅ Se mira con obras reales con K y CI antes de elegir
  ✅ No compromete código todavía
  ❌ Deja el hueco abierto hasta que se mida
D) Aplazar esta propuesta
  ✅ No retrasa E0–E3
  ✅ Se puede retomar en E4, donde vive la coherencia
  ❌ Queda sin resolver; E4 empieza con la duda
Net: dos cifras a la vista frente a una coherencia que solo mira cantidades.
Header: K y CI
Options:
A) Aplicar: precio unitario y aviso de K y CI (recommended)
La coherencia compara cantidad y precio unitario (sin K) de cada partida enlazada con su fila. Con K ≠ 1 o CI > 0, la vista y el Word dicen cuánto aporta el capítulo al PEM y que la valoración son precios de laboratorio sin K ni CI. Los precios de A2 no cambian. (human: ~3 h / CC: ~15 min)
B) Dejar como está
La coherencia compara cantidades; sin aviso de K ni CI. (human: ~0 / CC: ~0)
C) Investigar antes
Antes de E4, medir con dos obras (K = 0,9 y CI = 3 %) cuánto difieren capítulo y valoración y volver a esta pregunta. No aprueba ningún cambio; la coherencia queda como en el plan mientras tanto. (human: ~1 h / CC: ~10 min)
D) Aplazar solo esta propuesta
La propuesta queda sin resolver para E4; nada cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: precio unitario y aviso de K y CI» (respuesta D14, 2026-10-25)
Accepted scope: la coherencia compara cantidad y precio unitario (sin K) de cada partida enlazada con su fila; con K ≠ 1 o CI > 0, la vista y el Word dan lo que aporta el capítulo al PEM y dicen que la valoración son precios de laboratorio sin K ni CI; los precios de A2 no cambian. Tests: obra con K = 0,9 y con CI = 3 % → aviso con las dos cifras; precio cambiado a mano en una partida enlazada → diferencia de precio.
History: —

### O1b: la base del % (D10) con costes indirectos
Finding: Codex 1, P1, confianza 9/10, `src/core/totales.ts:44-62`; revisor: Codex, verificado por Claude. Reabre D10 por un supuesto que cambia: «PEM − importe del capítulo» no quita los CI que el capítulo arrastra.
Plan baseline: D10 aprobada: % = valoración ÷ (PEM − importe del capítulo de control enlazado).
Runtime evidence: con CI del 3 %, un capítulo de 1.000 € sube el PEM 1.030 €; restar 1.000 € deja 30 € del capítulo en la base.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O1b base del % | PEM − importe del capítulo (D10) | `pem()` recalculado con los costes directos sin el capítulo (sus CI salen también) | D10 tal cual | D10 mientras se mide | D10, propuesta aplazada |
| D10 intención (el % no se mueve al crear el capítulo) | aprobada | se cumple también con CI | falla por los CI | — | — |
Question D15:
D15 — La base del % del PEM tiene que quitar también los costes indirectos del capítulo
Project/branch/task: main, plan de control de calidad, voz externa (Codex 1), reabre D10.
ELI10: En D10 elegimos calcular el % sobre el PEM sin el capítulo de control, para que no cambie al crearlo. Pero el PEM suma los costes indirectos encima de los directos: restar solo el importe del capítulo deja dentro sus indirectos, y el % se mueve un poco. Recalcular el PEM sin el capítulo lo arregla.
Stakes if we pick wrong: en obras con CI el % cambia al crear el capítulo, justo lo que D10 quería evitar.
Recommendation: A because cumple lo que D10 pretendía con la misma función pem() que ya usa la app.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Recalcular el PEM sin el capítulo (recommended)
  ✅ El % es el mismo antes y después de crear el capítulo, también con CI
  ✅ Reutiliza pem() de core/totales, sin fórmulas nuevas
  ❌ Hay que sumar los costes directos sin el capítulo, no restar una cifra
B) Dejar D10 como está
  ✅ Una resta, ya aprobada
  ✅ Exacto con CI = 0, que es el caso por defecto
  ❌ Con CI > 0 el % se mueve al crear el capítulo
C) Investigar antes
  ✅ Se mide cuántas obras usan CI antes de elegir
  ✅ No cambia nada aprobado todavía
  ❌ Deja D10 con el fallo conocido mientras tanto
D) Aplazar esta propuesta
  ✅ No toca lo aprobado ahora
  ✅ Se retoma en E4 con la valoración
  ❌ Queda sin resolver
Net: cumplir la intención de D10 con CI frente a la resta simple.
Header: Base del %
Options:
A) Aplicar: recalcular el PEM sin el capítulo (recommended)
Base = pem(costes directos sin el capítulo de control enlazado, rates); el Word dice la base. Mantiene la intención de D10 y su test, que añade una obra con CI = 3 %. (human: ~30 min / CC: ~5 min)
B) Dejar D10 como está
Base = PEM − importe del capítulo. (human: ~0 / CC: ~0)
C) Investigar antes
Antes de E4, contar cuántas obras guardadas usan CI > 0 y volver; D10 sigue como está mientras tanto. (human: ~30 min / CC: ~5 min)
D) Aplazar solo esta propuesta
Queda sin resolver para E4; D10 no cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: recalcular el PEM sin el capítulo» (respuesta D15, 2026-10-25)
Accepted scope: base del % = `pem(costes directos sin el capítulo de control enlazado, rates)`, sustituye la resta de D10; el Word dice la base; el test de D10 añade una obra con CI = 3 % y el % sigue igual antes y después de crear el capítulo.
History: D10 aprobada A (respuesta D10, 2026-10-25): «PEM − importe del capítulo»; se reabre por los CI (Codex 1).

### O2: los datos que el cálculo de estructura necesita y el plan no guarda
Finding: Codex 2, P1, confianza 8/10, `docs/plan-control-calidad.md:219-226` (`ControlPartida`) y `:299-318` (§6); `docs/research/control-calidad/B-codigo-estructural.md:516` en adelante (algoritmos A2–A5); revisor: Codex, verificado por Claude.
Plan baseline: §4 y §6 tal cual: `ControlPartida` sin volumen por elemento, sin diámetros ni kg por serie, sin dosificación o suministrador por grupo; D6 aprobada (superficie y plantas en `planCalidad`).
Runtime evidence: la tabla 57.5.4.1 trata aparte las cimentaciones de más de 200 m³ por elemento; el art. 58 hace lotes de 30 t por serie de diámetros; el § 5.4 cuenta la durabilidad por dosificación. Nada de eso tiene campo en el plan.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O2 contrato de entradas de E1 | implícito | escrito antes de E1: `hormigon.elementoMayorM3?` (cimentación), `acero.series?: { fina, media, gruesa: kg }` (leídas del texto si se puede), `grupos[].dosificacion?` (id que separa suministros), con `null` = falta | como está | se escribe tras revisar los 16 casos de A6 | aplazado |
| O2 prueba | 16 casos con entradas a mano | más un test de ida y vuelta: fixture A guardada en .json, recargada y calculada da lo mismo | como está | — | — |
Question D16:
D16 — Escribir antes de E1 los datos que el cálculo necesita y dónde se guardan
Project/branch/task: main, plan de control de calidad, voz externa (Codex 2), §4–§6.
ELI10: El cálculo de lotes necesita datos que el plan no dice dónde se guardan: el volumen del mayor elemento de cimentación (por encima de 200 m³ cambia la regla), los kilos de acero por serie de diámetros (el art. 58 hace lotes por serie) y qué partidas son la misma dosificación (para la durabilidad). Los 16 tests pasarían con esos datos puestos a mano en el test, y la app real no tendría dónde teclearlos.
Stakes if we pick wrong: E1 sale en verde y en E3 la vista no puede dar los datos que el motor necesita, y hay que rehacer tipos y esquema.
Recommendation: A because fija el contrato antes de escribir el motor y una prueba de ida y vuelta demuestra que la app guarda lo que el cálculo usa.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Escribir el contrato de entradas antes de E1 (recommended)
  ✅ Motor, esquema y vista usan los mismos campos desde el principio
  ✅ El test de ida y vuelta pilla un dato que el motor usa y la app no guarda
  ❌ Unas horas más de diseño antes de empezar E1
B) Dejarlo como está
  ✅ E1 empieza ya
  ✅ Los campos salen al escribir el motor
  ❌ Riesgo de rehacer tipos y esquema v8 en E3
C) Investigar antes
  ✅ Se repasan los 16 casos de A6 para ver qué dato pide cada uno
  ✅ El contrato sale de casos reales
  ❌ Retrasa la decisión; mientras tanto, E1 no debería empezar
D) Aplazar esta propuesta
  ✅ No retrasa nada
  ✅ Se puede retomar al cerrar E1
  ❌ El esquema v8 se puede fijar sin estos campos
Net: un contrato escrito antes del motor frente a descubrir los campos sobre la marcha.
Header: Entradas
Options:
A) Aplicar: contrato de entradas antes de E1 (recommended)
Antes de E1, el plan añade: hormigon.elementoMayorM3? (cimentación), acero.series? con kg por serie (fina, media, gruesa; leídas del texto si se puede, si no se piden), grupos[].dosificacion? (id que separa suministros para durabilidad y lotes), con null = falta y pendiente. Test de ida y vuelta: la obra A se guarda en .json, se recarga y da el mismo plan. (human: ~4 h / CC: ~20 min)
B) Dejar como está
Los campos se definen al escribir el motor. (human: ~0 / CC: ~0)
C) Investigar antes
Repasar los 16 casos de A6 y los algoritmos A2–A5 apuntando qué dato pide cada uno y volver a esta pregunta antes de E1. No aprueba campos. (human: ~2 h / CC: ~10 min)
D) Aplazar solo esta propuesta
Queda sin resolver; nada cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: contrato de entradas antes de E1» (respuesta D16, 2026-10-25)
Accepted scope: antes de E1, el plan añade al §4 y al §6 `hormigon.elementoMayorM3?` (cimentación), `acero.series?` con kg por serie (fina, media, gruesa; del texto si se puede, si no se piden) y `grupos[].dosificacion?` (id que separa suministros para durabilidad y lotes), con `null` = falta y pendiente; test de ida y vuelta: la obra A se guarda en .json, se recarga y da el mismo plan.
History: —

### O3: sacar los m³ de hormigón y los kg de acero de la descomposición
Finding: Codex 3, P2, confianza 8/10, `src/core/refdata.ts:119-125` (zapata HA-25 con `mt10haf010` 1,05 m³ y `mt07aco010` 40 kg por m³ en su descomposición); `docs/plan-control-calidad.md:35-37` (objetivo «sin teclear ninguna cantidad que el presupuesto ya tiene») y `:275-277` (cuantía «declarada»); revisor: Codex, verificado por Claude.
Plan baseline: §5.5: las partidas «incluso armadura» necesitan la cuantía declarada; `EntradaPcc` sin `recursos`.
Runtime evidence: las partidas con descomposición traen el hormigón (m³/ud) y el acero (kg/ud) como recursos `MAT`; el plan los pediría a mano.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O3 m³/ud y kg/ud | se teclean | propuestos desde la descomposición (recursos de hormigón y acero), con origen «descomposición», y se confirman | se teclean | sin decidir | aplazado |
| O3 doble cómputo | sin tratar | si la obra tiene además partidas de acero aparte, aviso para que el técnico diga cuál cuenta | — | — | — |
| O3 entrada | sin `recursos` | `EntradaPcc` lleva `recursos` | igual | — | — |
Question D17:
D17 — Leer de la descomposición los m³ de hormigón y los kg de acero
Project/branch/task: main, plan de control de calidad, voz externa (Codex 3), §5.5 y objetivo.
ELI10: Una partida como «Zapata de HA-25 incluso armadura» ya trae en su descomposición 1,05 m³ de hormigón y 40 kg de acero por m³. El plan pide al técnico que teclee esa cuantía, aunque el presupuesto ya la tiene. Se puede proponer desde la descomposición y que el técnico la confirme. El riesgo es contar dos veces el acero si además hay una partida de acero aparte.
Stakes if we pick wrong: sin leerla, el técnico teclea datos que ya están; leyéndola sin control, el acero de una obra puede contarse dos veces.
Recommendation: A because cumple el objetivo de no teclear lo que el presupuesto ya tiene, como propuesta y con aviso de doble cómputo.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Proponer desde la descomposición (recommended)
  ✅ Cumple «sin teclear lo que el presupuesto ya tiene» en las partidas con descomposición
  ✅ Queda como propuesta: nada entra sin confirmar
  ❌ Reconocer el recurso de hormigón y de acero es otra regla que probar con bancos reales
B) Dejarlo como está
  ✅ Más simple: el técnico teclea la cuantía
  ✅ Sin riesgo de leer mal un recurso
  ❌ Incumple el objetivo medible en las partidas compuestas
C) Investigar antes
  ✅ Se mira en BCCA, Precio Centro y CYPE cómo vienen esos recursos
  ✅ Decide con datos
  ❌ Aplaza la decisión
D) Aplazar esta propuesta
  ✅ No retrasa E1
  ✅ Se puede añadir después sin cambiar el esquema
  ❌ Queda sin resolver
Net: leer lo que ya está, con confirmación, frente a teclearlo.
Header: Descomposición
Options:
A) Aplicar: proponer desde la descomposición (recommended)
EntradaPcc lleva recursos; para cada partida con descomposición, los recursos MAT de hormigón (por designación) y de acero (B 500 S, mallas) proponen m3PorUd y kgPorUd con origen «descomposición», que el técnico confirma. Si la obra tiene además partidas de acero aparte, un aviso pide decir cuál cuenta. Test: la zapata compuesta propone 1,05 m³ y 40 kg; con una partida de acero aparte, aviso de doble cómputo. (human: ~1 día / CC: ~30 min)
B) Dejar como está
La cuantía y el espesor se teclean. (human: ~0 / CC: ~0)
C) Investigar antes
Revisar en las bases de docs/spike/samples cómo vienen los recursos de hormigón y acero, y volver antes de E2. No aprueba nada. (human: ~2 h / CC: ~10 min)
D) Aplazar solo esta propuesta
Queda sin resolver; nada cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: proponer desde la descomposición» (respuesta D17, 2026-10-25)
Accepted scope: `EntradaPcc` lleva `recursos`; en las partidas con descomposición, los recursos MAT de hormigón (por designación) y de acero (B 500 S, mallas) proponen `m3PorUd` y `kgPorUd` con origen «descomposición», que se confirman; si la obra tiene además partidas de acero aparte, aviso de doble cómputo para que el técnico diga cuál cuenta. Tests: la zapata compuesta de `refdata` propone 1,05 m³ y 40 kg; con una partida de acero aparte, aviso.
History: —

### O4: qué cubre el precio de cada ensayo
Finding: Codex 4, P1, confianza 7/10, `docs/plan-control-calidad.md:347-349` (la unidad manda) y `:263` (≥ 4 probetas por amasada); revisor: Codex, verificado por Claude.
Plan baseline: §8: la fila casa unidad de ensayo y unidad del precio; si no casan, pendiente.
Runtime evidence: el plan ya cita que la BCCA valora la compresión «por amasada, 2 probetas» y Precio Centro «por probeta»; dos precios «por amasada» pueden cubrir distinto número de probetas o llevar la consistencia dentro.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O4 qué guarda el enlace | código y unidad | código, unidad y qué cubre: `{ probetas?, incluye?: ensayo[] }` | código y unidad | sin decidir | aplazado |
| O4 si cubre menos de lo exigido | pasa | la cantidad se ajusta (p. ej. 2 precios por amasada de 4 probetas) o pendiente con el motivo | pasa | — | — |
| O4 si incluye otro ensayo | se cuenta dos veces | el incluido no se valora aparte | dos veces | — | — |
Question D18:
D18 — Que el precio de un ensayo cubra lo que el plan pide
Project/branch/task: main, plan de control de calidad, voz externa (Codex 4), §8.
ELI10: El plan comprueba que el ensayo y su precio se midan en la misma unidad (por amasada, por probeta). Pero dos precios «por amasada» pueden cubrir 2 probetas o 4, o traer la consistencia incluida. El Código pide al menos 4 probetas por amasada, así que un precio de 2 probetas pasa la comprobación y valora la mitad.
Stakes if we pick wrong: la valoración se queda corta (la mitad de las probetas) o cuenta dos veces la consistencia, y nadie lo ve.
Recommendation: A because el enlace curado a mano ya se escribe en E0 y añadirle qué cubre cada precio cuesta poco.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Guardar qué cubre cada precio (recommended)
  ✅ La valoración cuenta las probetas que pide la norma, no las del precio
  ✅ Lo incluido en otro precio no se valora dos veces
  ❌ Más trabajo al curar enlace-bcca en E0
B) Dejarlo como está
  ✅ Enlace más simple
  ✅ E0 más corto
  ❌ Un precio que cubre menos de lo exigido pasa sin aviso
C) Investigar antes
  ✅ Se cuenta en la BCCA cuántos precios tienen este problema
  ✅ Decide con datos de E0
  ❌ Aplaza la decisión hasta E0
D) Aplazar esta propuesta
  ✅ No alarga E0
  ✅ Se puede añadir al enlace después
  ❌ Queda sin resolver
Net: un enlace que sabe qué paga frente a uno que solo sabe la unidad.
Header: Cobertura
Options:
A) Aplicar: guardar qué cubre cada precio (recommended)
enlace-bcca (y el catálogo) guardan por precio { probetas?, incluye?: ensayo[] }. Si cubre menos probetas de las exigidas, la cantidad se ajusta (número de precios necesarios) y la fila lo dice; si no se puede, pendiente con el motivo. Lo incluido en otro precio no se valora aparte. Test: precio de 2 probetas con 4 exigidas → 2 precios por amasada; consistencia incluida → sin fila aparte. (human: ~4 h / CC: ~20 min)
B) Dejar como está
El enlace guarda código y unidad; solo se comprueba la unidad. (human: ~0 / CC: ~0)
C) Investigar antes
En E0, contar en el capítulo 18 de la BCCA cuántos ensayos cubren menos o incluyen otros, y volver. No aprueba nada. (human: ~2 h / CC: ~10 min)
D) Aplazar solo esta propuesta
Queda sin resolver; nada cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: guardar qué cubre cada precio» (respuesta D18, 2026-10-25)
Accepted scope: `enlace-bcca` y el catálogo guardan por precio `{ probetas?, incluye?: ensayo[] }`; si cubre menos probetas de las exigidas, la cantidad se ajusta al número de precios necesarios y la fila lo dice, o queda pendiente con el motivo; lo incluido en otro precio no se valora aparte. Tests: precio de 2 probetas con 4 exigidas → 2 precios por amasada; consistencia incluida → sin fila aparte.
History: —

### O5: congelar el plan entregado, no solo los precios
Finding: Codex 5, P1, confianza 8/10, `docs/plan-control-calidad.md:209-211` («Congelar lo usado») con A1 aprobada; revisor: Codex, verificado por Claude.
Plan baseline: §3: guardar la edición de cada tabla y el precio de cada fila; A1: copia de precios del banco.
Runtime evidence: la app no conserva ediciones antiguas de las tablas ni versiones del motor; al cambiar el catálogo, una regla o un texto, el mismo plan da otro resultado y no hay con qué compararlo.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O5 qué se congela | precios (A1) y nombres de edición | al exportar el Word, `planCalidad.emitido = { fecha, versiones, filas de la valoración, totales }` | precios y nombres de edición | sin decidir | aplazado |
| O5 al reabrir | sin definir | si el cálculo de hoy difiere de lo emitido, aviso con las diferencias y «Recalcular» explícito | nada | — | — |
| A1 precios | aprobado | se mantiene | se mantiene | se mantiene | se mantiene |
Question D19:
D19 — Guardar lo que se entregó para poder compararlo después
Project/branch/task: main, plan de control de calidad, voz externa (Codex 5), §3 «Congelar lo usado».
ELI10: El plan promete que un plan no cambia solo cuando cambian las tablas. Pero solo guarda los precios (A1) y el nombre de la edición de cada tabla: la app no conserva las tablas antiguas, así que al cambiar el catálogo o una regla el mismo plan sale distinto y nadie sabe qué se entregó. La propuesta es guardar, al exportar el Word, el resultado entregado y avisar si el cálculo de hoy no coincide.
Stakes if we pick wrong: el técnico reabre un plan ya visado, el total ha cambiado por una actualización de la app y no tiene cómo saber qué firmó.
Recommendation: A because guardar el resultado emitido es pequeño, no obliga a mantener tablas viejas y hace verdad la promesa del §3.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Guardar el resultado emitido (recommended)
  ✅ Siempre se sabe qué se entregó, aunque cambien tablas o reglas
  ✅ Recalcular es una acción explícita, con las diferencias a la vista
  ❌ Unos KB más en la obra por cada plan emitido
B) Dejarlo como está
  ✅ Nada nuevo en el esquema
  ✅ El plan siempre refleja las tablas de hoy
  ❌ Un plan entregado puede cambiar sin aviso al actualizar la app
C) Investigar antes
  ✅ Se valora mantener ediciones antiguas de las tablas
  ✅ Decide entre las dos vías con más datos
  ❌ Aplaza la decisión
D) Aplazar esta propuesta
  ✅ No añade esquema ahora
  ✅ Se puede añadir en E4, con el Word
  ❌ Queda sin resolver
Net: un registro de lo entregado frente a un plan que siempre se recalcula.
Header: Emitido
Options:
A) Aplicar: guardar el resultado emitido (recommended)
Al exportar el Word, planCalidad.emitido = { fecha, versiones de tablas y motor, filas de la valoración, totales }. Al reabrir, si el cálculo de hoy difiere, aviso con las filas que cambian y botón «Recalcular» (un paso de Deshacer) que sustituye lo emitido en la siguiente exportación. Test: exportar, cambiar el catálogo de prueba, reabrir → aviso con la diferencia; sin cambios, sin aviso. (human: ~4 h / CC: ~20 min)
B) Dejar como está
Solo precios (A1) y nombres de edición; sin registro de lo emitido. (human: ~0 / CC: ~0)
C) Investigar antes
Valorar guardar ediciones antiguas de las tablas frente al resultado emitido, y volver antes de E4. No aprueba nada. (human: ~1 h / CC: ~10 min)
D) Aplazar solo esta propuesta
Queda sin resolver; nada cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: guardar el resultado emitido» (respuesta D19, 2026-10-25)
Accepted scope: al exportar el Word, `planCalidad.emitido = { fecha, versiones de tablas y motor, filas de la valoración, totales }`; al reabrir, si el cálculo de hoy difiere, aviso con las filas que cambian y «Recalcular» (un paso de Deshacer) que sustituye lo emitido en la siguiente exportación. Tests: exportar, cambiar el catálogo de prueba, reabrir → aviso con la diferencia; sin cambios, sin aviso.
History: —

### O6: una asignación confirmada que se queda vieja al editar la partida
Finding: Codex 6, P1, confianza 8/10, `src/store/slices/estructuraSlice.ts:364-370` (`editPartidaField` cambia el campo sin tocar asignaciones) y `src/store/slices/rcdSlice.ts:70` (proponer salta las partidas ya asignadas); revisor: Codex, verificado por Claude.
Plan baseline: D5 aprobada: `Partida.pcc` guardado, con la designación leída y el grupo confirmados.
Runtime evidence: si el título pasa de «HA-25» a «HA-30» después de confirmar, `pcc.hormigon` sigue diciendo HA-25 y nada lo avisa. Residuos tiene el mismo hueco.
Comparison grid:
| Elección | Actual | A | B | C | D |
|---|---|---|---|---|---|
| O6 al confirmar | se guarda la asignación | se guarda también una huella de código, título, descripción y unidad | se guarda la asignación | sin decidir | aplazado |
| O6 si la partida cambia | nada | la asignación pasa a «revisar» (no cuenta hasta confirmarla otra vez), salvo lo puesto a mano por el usuario, que se conserva y se avisa | nada | — | — |
| O6 residuos | mismo hueco | no se toca (TODO aparte) | — | — | — |
Question D20:
D20 — Volver a revisar una partida confirmada cuando cambia su texto o su unidad
Project/branch/task: main, plan de control de calidad, voz externa (Codex 6), §4 y D5.
ELI10: Al confirmar una partida, la app guarda lo que leyó: «HA-25, forjado». Si después el técnico cambia el título a «HA-30» o la unidad, la asignación sigue diciendo HA-25 y el plan calcula con un dato viejo. La propuesta es guardar una huella del texto al confirmar y, si cambia, devolver la partida a «revisar».
Stakes if we pick wrong: un cambio de resistencia o de unidad después de confirmar deja lotes y ensayos mal calculados sin ningún aviso.
Recommendation: A because es poco código, nunca calcula con un dato que ya no está en la partida y respeta lo puesto a mano.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Huella al confirmar y «revisar» si cambia (recommended)
  ✅ Un cambio de texto o unidad nunca deja un dato viejo contando en silencio
  ✅ Lo que el técnico puso a mano se conserva, con aviso
  ❌ Cambiar una errata del título pide volver a confirmar la partida
B) Dejarlo como está
  ✅ Igual que residuos hoy
  ✅ Sin estado nuevo
  ❌ Una partida editada sigue calculando con su designación vieja
C) Investigar antes
  ✅ Se mira cuántas ediciones de texto hay tras confirmar en obras reales
  ✅ Decide el alcance de la huella
  ❌ Aplaza la decisión
D) Aplazar esta propuesta
  ✅ No añade estado ahora
  ✅ Se puede añadir en E3, con el store
  ❌ Queda sin resolver
Net: no calcular nunca con datos viejos frente a un modelo más simple.
Header: Revisar
Options:
A) Aplicar: huella al confirmar y «revisar» si cambia (recommended)
Al confirmar, pcc guarda una huella de code, title, desc y ud. Si al calcular la huella no casa, la partida pasa a «revisar»: no cuenta hasta confirmarla otra vez, y los campos puestos a mano (origen manual) se conservan con aviso. Residuos no se toca (TODO aparte). Test: confirmar HA-25, cambiar el título a HA-30 → «revisar» y fuera del cálculo; volver a confirmar → HA-30. (human: ~3 h / CC: ~15 min)
B) Dejar como está
La asignación confirmada no se revisa al editar la partida. (human: ~0 / CC: ~0)
C) Investigar antes
Mirar en las obras reales cuántas partidas cambian de texto tras asignar residuos, y volver antes de E3. No aprueba nada. (human: ~1 h / CC: ~10 min)
D) Aplazar solo esta propuesta
Queda sin resolver; nada cambia ahora. (human: ~0 / CC: ~0)

State: approved
Actual answer: A «Aplicar: huella al confirmar y «revisar» si cambia» (respuesta D20, 2026-10-25)
Accepted scope: al confirmar, `pcc` guarda una huella de `code`, `title`, `desc` y `ud`; si al calcular no casa, la partida pasa a «revisar» y no cuenta hasta confirmarla otra vez; los campos de origen manual se conservan con aviso; residuos no se toca (TODO aparte). Tests: confirmar HA-25, cambiar el título a HA-30 → «revisar» y fuera del cálculo; volver a confirmar → HA-30.
History: —

### TD1: la misma huella de «revisar» para el estudio de residuos
Finding: consecuencia de O6 (D20); `src/store/slices/rcdSlice.ts:70` y `src/store/slices/estructuraSlice.ts:364-370`; revisor: Claude (plan-eng-review).
Plan baseline: fuera del plan; O6 aprobada solo para calidad («residuos no se toca, TODO aparte»).
Runtime evidence: una partida con residuo confirmado conserva sus códigos LER y su conversión aunque cambien título, descripción o unidad.
What: guardar una huella de `code`, `title`, `desc` y `ud` en `Partida.rcd` al confirmar y pasarla a «revisar» si cambia, como en calidad. Why: el mismo dato viejo que O6 evita en calidad sigue contando en residuos. Pros: los dos anejos se comportan igual; reutiliza el helper de huella de calidad. Cons: cambia el comportamiento de residuos, que ya se entrega, y pide volver a confirmar tras corregir una errata. Context: hecho en calidad por D20; empezar por `core/rcd/reglas.ts` (`estadoTrasConfirmar`) y `rcdSlice`. Depends on: el helper de huella de E3 de calidad.
Comparison grid:
| Elección | Actual | A | B | C |
|---|---|---|---|---|
| TD1 disposición | sin registrar | en `TODOS.md`, P3 | se descarta | entra en este plan (E3) |
Question D21:
D21 — ¿Apuntar en TODOS.md la huella de «revisar» para residuos?
Project/branch/task: main, plan de control de calidad, TODO derivado de D20.
ELI10: En D20 decidimos que una partida confirmada para calidad vuelva a «revisar» si cambia su texto o su unidad. Residuos tiene el mismo hueco: un residuo confirmado sigue contando aunque la partida cambie. No entra en este plan; la pregunta es si se apunta para después, se descarta o se mete ya.
Stakes if we pick wrong: si se descarta, residuos puede seguir calculando con un dato viejo; si se mete ya, el plan de calidad toca residuos más de lo previsto.
Recommendation: A because el hueco es real, el helper saldrá de calidad y no conviene mezclarlo con este plan.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Añadir a TODOS.md (recommended)
  ✅ Queda escrito con su contexto y el helper que lo resuelve
  ✅ No amplía este plan
  ❌ Residuos sigue con el hueco hasta que se haga
B) Descartar
  ✅ Nada más que mantener
  ✅ Residuos no cambia
  ❌ El hueco se olvida
C) Hacerlo en este plan
  ✅ Los dos anejos iguales desde E3
  ✅ El helper se escribe una vez para los dos
  ❌ Amplía el plan y cambia un Word que ya se entrega
Net: apuntarlo frente a olvidarlo o ampliar el plan.
Header: TODO residuos
Options:
A) Añadir a TODOS.md (recommended)
Entrada P3 en TODOS.md con qué, por qué, contexto y dependencia (el helper de huella de calidad). (human: ~5 min / CC: ~1 min)
B) Descartar
No se apunta. (human: ~0 / CC: ~0)
C) Hacerlo en este plan
Se añade a E3: huella y «revisar» también en Partida.rcd, con sus tests en rcd.test.ts. (human: ~3 h / CC: ~15 min)

State: approved
Actual answer: A «Añadir a TODOS.md» (respuesta D21, 2026-10-25)
Accepted scope: entrada P3 en `TODOS.md` con qué, por qué, contexto y dependencia; nada cambia en este plan.
History: —

### TD2: una sola superficie construida para residuos y calidad
Finding: consecuencia de D7 (D6 aprobada A); `src/core/rcd/tipos.ts` (`DatosRatios.superficieConstruida`); revisor: Claude (plan-eng-review).
Plan baseline: D6 aprobada: `planCalidad.superficieConstruida`; residuos tiene la suya.
Runtime evidence: el técnico teclea la superficie construida en residuos y otra vez en calidad.
What: un dato de obra (ficha) con la superficie construida y las plantas que lean residuos y calidad, con su migración. Why: el mismo número en dos sitios puede no coincidir entre los dos anejos. Pros: un dato, dos anejos coherentes. Cons: toca `Obra`, la ficha, las cabeceras y una migración de los datos de residuos. Context: D6 lo dejó fuera para no tocar la ficha; empezar por `Obra` en `core/types.ts` y `DatosRatios`. Depends on: E3 de calidad.
Comparison grid:
| Elección | Actual | A | B | C |
|---|---|---|---|---|
| TD2 disposición | sin registrar | en `TODOS.md`, P3 | se descarta | entra en este plan (cambia D6) |
Question D22:
D22 — ¿Apuntar en TODOS.md unificar la superficie construida?
Project/branch/task: main, plan de control de calidad, TODO derivado de D6.
ELI10: En D6 decidimos guardar la superficie construida y las plantas en el plan de calidad, sin tocar la ficha de la obra. Residuos ya pide su propia superficie, así que el mismo dato se teclea dos veces y puede no coincidir. La pregunta es si se apunta para unificarlo después, se descarta o se hace ya.
Stakes if we pick wrong: si se olvida, los dos anejos pueden dar superficies distintas de la misma obra.
Recommendation: A because mantiene D6 tal cual y deja escrito el arreglo para cuando haya los dos anejos en uso.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Añadir a TODOS.md (recommended)
  ✅ Queda escrito con su contexto
  ✅ No cambia D6 ni amplía el plan
  ❌ El dato sigue en dos sitios hasta que se haga
B) Descartar
  ✅ Nada más que mantener
  ✅ Cada anejo sigue con su dato
  ❌ Dos superficies de la misma obra que pueden no coincidir
C) Hacerlo en este plan
  ✅ Un dato desde el principio
  ✅ Evita una migración posterior
  ❌ Reabre D6 y toca la ficha y residuos
Net: apuntarlo frente a olvidarlo o reabrir D6.
Header: TODO superficie
Options:
A) Añadir a TODOS.md (recommended)
Entrada P3 en TODOS.md con qué, por qué, contexto y dependencia (E3 de calidad). (human: ~5 min / CC: ~1 min)
B) Descartar
No se apunta. (human: ~0 / CC: ~0)
C) Hacerlo en este plan
Reabre D6: el dato pasa a la ficha de la obra y residuos lo lee, con migración. (human: ~1 día / CC: ~40 min)

State: approved
Actual answer: A «Añadir a TODOS.md» (respuesta D22, 2026-10-25)
Accepted scope: entrada P3 en `TODOS.md` con qué, por qué, contexto y dependencia; D6 no cambia.
History: —

Approval readiness: PASS. Comprobados: alcance (D1), A1 (D2), D4 (D3), A2 (D4), D5 (D5), D7 (D6),
D3f (D7), D8 (D8), D9 (D9), Q1 (D10, con la fórmula sustituida por O1b), Q2 (D11), T1 (D12),
P1 (D13), O1a (D14), O1b (D15), O2 (D16), O3 (D17), O4 (D18), O5 (D19), O6 (D20), TD1 (D21),
TD2 (D22). Las correcciones de hecho no cambian comportamiento y no piden respuesta. Sin
contestar: la D6 del plan (vistas), que el propio plan manda a `/plan-design-review`.

### Fuera de alcance (lo que se consideró y se dejó)

- **docxComun.ts:** no se crea; `docxRender.ts` ya es el módulo común (D1).
- **Copiar del banco las partidas del capítulo con descomposición:** se crean propias (A2); quien
  quiera la descomposición la copia desde Referencia.
- **Precio en vivo del banco:** se usa la copia guardada (A1).
- **Huella de «revisar» en residuos** y **superficie construida común:** a `TODOS.md` (TD1, TD2).
- **Agrupar «Residuos» y «Calidad» en «Anejos» (D6 del plan):** a `/plan-design-review` antes de E3.
- Lo que el plan ya deja fuera (seguimiento en obra, obra civil, control indirecto, PDF y Excel,
  IA para proponer familias) sigue fuera.

### Qué ya existe (y se reutiliza)

- `features/exportar/docxRender.ts`: cabecera, tablas, firma y colores del Word (D1).
- `store/slices/rcdSlice.ts`: patrón de acciones (un paso de Deshacer con `structural`, proponer,
  confirmar, homónimos, crear capítulo) para `pccSlice` (A2, D5).
- `core/rcd/datos.ts` (`apartarRcdIlegibles`) y `store/schema.ts` (`fromSerializable`): validar
  sin destruir y migración v7 → v8.
- `features/referencia/obraSource.ts` (`loadObraRefSource`): cargar un banco una vez para «Tomar
  precios» (A1).
- `core/totales.ts` (`pem`): la base del % (O1b). `core/medicion.ts` (`partidaImporte`): lo que el
  capítulo aporta con K (O1a).
- `core/rcd/reglas.bancos.test.ts`: patrón de test de reglas en CI y local.
- `features/residuos/useEstudioRcd.ts` y la vista `lazy` de `App.tsx`: memoización y carga diferida
  (P1).

### Diagramas

Flujo de datos del plan, con las decisiones de esta revisión:

```
 Presupuesto (chapters, partidas, recursos, rates, obra)          Referencia (banco, IndexedDB)
        │                                                                  │ solo al pulsar
        │ reglas.ts + familias.json (store, chunk principal, P1)           │ «Tomar precios» (A1)
        ▼                                                                  ▼
 Partida.pcc  propuesta ──confirmar──► confirmada (+ huella, O6)    planCalidad.precios
        │          ▲                        │ texto/ud cambia             {ensayo, código, precio,
        │          └──────── revisar ◄──────┘                            ud, cubre, ~T, fecha} (O4)
        ▼                                                                  │
 calcularPlanCalidad(entrada, hoy)   [vista Calidad, lazy]  ◄──────────────┘
   ├─ hormigon.ts   designación → tipo/fck (lotes) · clase (durabilidad) (Q2)
   ├─ estructura.ts lotes, amasadas, armaduras, ejecución (entradas de O2, descomposición de O3)
   ├─ precios.ts    copia → Junta → tecleado → pendiente; cobertura (O4)
   └─ PlanCalidad { recepción, ejecución, obra terminada, valoración, %PEM (O1b), avisos }
        │                                         │
        ▼                                         ▼
 «Crear capítulo» (A2): partidas propias     docxPcc (lazy) ──► Word + planCalidad.emitido (O5)
   pcc {capituloControl, ensayo}                  │
        │                                         ▼
        └──► coherencia: ensayo → código → texto; cantidad y precio; aviso K y CI (O1a)
```

Hay que poner diagrama en línea en `core/pcc/estructura.ts` (de los grupos al lote, a las amasadas
y a las tomas) y en `core/pcc/coherencia.ts` (orden de emparejamiento).

### Modos de fallo

| Camino nuevo | Fallo realista | Test | Qué ve el usuario |
|---|---|---|---|
| Reglas → `Partida.pcc` | una regla lee mal la designación | `hormigon.test.ts`, `reglas.test.ts` | propuesta con aviso; nada cuenta sin confirmar |
| Edición tras confirmar | título HA-25 → HA-30 | test de huella (O6) | «revisar», fuera del cálculo |
| «Tomar precios» | el banco no carga o es de una app más nueva | test de la acción (A1) | error de `loadObraRefSource`; los precios anteriores se quedan |
| Precio que cubre menos | 2 probetas frente a 4 | test de cobertura (O4) | cantidad ajustada o pendiente con el motivo |
| Crear capítulo | código del banco ya usado | test A2 | código nuevo; Deshacer lo quita entero |
| Coherencia con K o CI | el capítulo aporta 900 € y la valoración dice 1.000 € | test O1a | aviso con las dos cifras |
| Tablas o motor nuevos | el plan reabierto da otro total | test de lo emitido (O5) | aviso con las filas que cambian; «Recalcular» |
| Mover los tipos del Word | se pierde un bloque del Word de residuos | golden (D12) | el test falla antes de subir |
| Imports | el catálogo entra en el chunk principal | test del build (D13) | el test falla antes de subir |

Huecos críticos (sin test, sin manejo de error y silenciosos): ninguno.

### Paralelización

| Paso | Módulos | Depende de |
|---|---|---|
| Golden del Word de residuos (D12) | `features/exportar/`, `core/rcd/` | — |
| E0 datos (catálogo, enlace con cobertura) | `scripts/pcc/`, `core/pcc/tablas/` | — |
| Contrato de entradas (O2) | `docs/` (este plan) | — |
| E1 motor de estructura | `core/pcc/` | E0, O2 |
| E2 familias y plan completo | `core/pcc/` | E1 |
| E3 app | `store/`, `features/calidad/`, `features/presupuesto/`, `layout/` | E2, `/plan-design-review` |
| E4 Word y capítulo | `core/documento/`, `features/exportar/`, `core/pcc/` | E3, golden |

Carriles: A: O2 → E0 → E1 → E2 → E3 → E4 (`core/pcc/` en común, en serie). B: golden de
residuos (independiente). Arrancar A y B a la vez; B tiene que estar en `main` antes del segundo
commit de E4. Conflicto: ninguno entre carriles (B no toca `core/pcc/`).

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~4 h / CC: ~20 min)** — plan — Escribir el contrato de entradas del motor en §4 y §6
  - Surfaced by: Voz externa — O2 (D16)
  - Files: `docs/plan-control-calidad.md`
  - Verify: cada dato de A2–A5 de B «Para la app» tiene campo y «si falta»
- [ ] **T2 (P1, human: ~2 h / CC: ~10 min)** — exportar — Golden del Word de residuos antes de mover tipos
  - Surfaced by: Test review — T1 (D12)
  - Files: `src/features/exportar/docxRcd.golden.test.ts`, `src/test/fixtures/rcd/obras.ts`
  - Verify: `npx vitest run src/features/exportar` en verde antes y después de mover
- [ ] **T3 (P1, human: ~1 día / CC: ~30 min)** — core/pcc + calidad — Copia de precios del banco
  - Surfaced by: Architecture — A1 (D2)
  - Files: `src/core/pcc/precios.ts`, `src/features/calidad/Valoracion.tsx`, `src/store/slices/pccSlice.ts`
  - Verify: test «sin bancos en la entrada, mismo total»; test de la acción con banco sin el código
- [ ] **T4 (P1, human: ~3 h / CC: ~15 min)** — core/pcc + store — Huella al confirmar y «revisar»
  - Surfaced by: Voz externa — O6 (D20)
  - Files: `src/core/pcc/reglas.ts`, `src/store/slices/pccSlice.ts`
  - Verify: HA-25 → HA-30 tras confirmar pasa a «revisar»
- [ ] **T5 (P1, human: ~4 h / CC: ~20 min)** — core/pcc — Guardar el resultado emitido y avisar de diferencias
  - Surfaced by: Voz externa — O5 (D19)
  - Files: `src/core/pcc/calculo.ts`, `src/features/exportar/docxPcc.ts`, `src/features/calidad/CalidadView.tsx`
  - Verify: exportar, cambiar el catálogo de prueba, reabrir → aviso
- [ ] **T6 (P2, human: ~4 h / CC: ~20 min)** — tablas — Cobertura de cada precio en el enlace
  - Surfaced by: Voz externa — O4 (D18)
  - Files: `src/core/pcc/tablas/enlace-bcca.json`, `src/core/pcc/tablas/catalogo.json`, `src/core/pcc/precios.ts`
  - Verify: 2 probetas frente a 4 → 2 precios por amasada
- [ ] **T7 (P2, human: ~1 día / CC: ~30 min)** — core/pcc — m³ y kg desde la descomposición
  - Surfaced by: Voz externa — O3 (D17)
  - Files: `src/core/pcc/estructura.ts`, `src/core/pcc/reglas.ts`
  - Verify: la zapata compuesta de `refdata` propone 1,05 m³ y 40 kg; aviso de doble cómputo
- [ ] **T8 (P2, human: ~4 h / CC: ~20 min)** — core/pcc + store — Crear capítulo con partidas propias y coherencia por ensayo
  - Surfaced by: Architecture — A2 (D4)
  - Files: `src/core/pcc/capitulo.ts`, `src/core/pcc/coherencia.ts`, `src/store/slices/pccSlice.ts`
  - Verify: crear y Deshacer; código ya usado; cambio de título; mismo importe
- [ ] **T9 (P2, human: ~3 h / CC: ~15 min)** — core/pcc — Precio unitario en la coherencia y aviso de K y CI; base del % sin el capítulo
  - Surfaced by: Voz externa — O1a (D14), O1b (D15); Code quality — Q1 (D10)
  - Files: `src/core/pcc/coherencia.ts`, `src/core/pcc/calculo.ts`
  - Verify: obras con K = 0,9 y CI = 3 %; el % no cambia al crear el capítulo
- [ ] **T10 (P2, human: ~1 h / CC: ~5 min)** — core/pcc — Designación con clase no válida cuenta para lotes
  - Surfaced by: Code quality — Q2 (D11)
  - Files: `src/core/pcc/hormigon.ts`
  - Verify: el «IIa» del caso A suma sus 3 m³ sin penetración
- [ ] **T11 (P2, human: ~2 h / CC: ~15 min)** — build — Límite de imports y test del chunk principal
  - Surfaced by: Performance — P1 (D13)
  - Files: `src/store/slices/pccSlice.ts`, `src/App.tsx`, test node del build
  - Verify: `vite build` y el test no encuentran ids del catálogo en el chunk principal
- [ ] **T12 (P2, human: ~2 h / CC: ~10 min)** — plan — Pasar al cuerpo del plan las decisiones D1–D22 y las correcciones de hecho
  - Surfaced by: Scope Challenge y todas las secciones
  - Files: `docs/plan-control-calidad.md` (§1, §3, §4, §6, §8, §9, §12, §14, «Archivos», «Tests», «Decisiones»)
  - Verify: el cuerpo no contradice el ledger (§12 sin `docxComun.ts`, `EntradaPcc` sin `bancos` y con `hoy` y `recursos`)
- [ ] **T13 (P2, human: ~3 h / CC: ~15 min)** — tests — Tests añadidos por la revisión
  - Surfaced by: Test review — mapa de cobertura (`[AÑADIDO]`)
  - Files: `src/features/calidad/Calidad.test.tsx`, `src/core/pcc/*.test.ts`
  - Verify: los 23 casos `[AÑADIDO]` del mapa en verde
- [ ] **T14 (P3, human: ~30 min / CC: ~5 min)** — plan — Cerrar contra B A2 si la clase de exposición separa lotes
  - Surfaced by: Code quality — riesgo de confianza 5/10
  - Files: `docs/plan-control-calidad.md` §5.1
  - Verify: cita de B que lo decide, antes de escribir `estructura.ts`

### Decisiones sin resolver que pueden pesar después

- **D6 del plan (vistas: «Calidad» propia o «Anejos» con dos pestañas):** no se ha preguntado en
  esta revisión; el plan la manda a `/plan-design-review` antes de E3. Si no se decide, E3 no
  sabe dónde va la pestaña ni cuánto subir `ROOMY_W`.

### Resumen

- Step 0: Scope Challenge — alcance aceptado tal cual, con la estructura de ficheros reducida (D1)
- Architecture Review: 2 issues found (A1, A2) y 2 decisiones abiertas del plan cerradas (D4, D5)
- Code Quality Review: 3 issues found (Q1, Q2, `m3PorUd`) y 1 riesgo por verificar (T14)
- Test Review: diagram produced, 23 gaps identified (todos con test previsto), regresión atada (D12)
- Performance Review: 1 issue found (P1)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 2 items proposed to user (los 2 añadidos)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 1 in this review (D6 del plan, para el design review)
- Outside voice: Codex, completed (6 findings, 7 decisiones; las 7 aplicadas)
- Parallelization: 2 lanes, 2 parallel / 5 sequential
- Lake Score: 1/12 (solo D12 tenía una opción 10/10; en las 12 se eligió la de más cobertura)

### Hallazgos suprimidos (confianza < 5)

Ninguno.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | stale (2026-09-25, otro plan) | no corrida para este plan |
| Outside Review | `codex exec` desde `/plan-eng-review` | Independent 2nd opinion | 3 | completed | 6 findings, 7 decisiones, las 7 aplicadas |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | ISSUES OPEN (PLAN) | 29 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | stale (2026-09-25, otro plan) | no corrida para este plan |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | stale (2026-09-25, otro plan) | no corrida para este plan |

- **OUTSIDE COVERAGE:** Codex, fase plan-review, completada (2026-10-25, commit `a8a668f`): 6
  hallazgos, todos comprobados en el código y resueltos en D14–D20.
- **CROSS-MODEL:** Claude encontró las entradas de precios y del capítulo (A1, A2) y los casos
  límite (Q1, Q2); Codex encontró K y CI, el contrato de entradas, la descomposición, la
  cobertura de precios, lo emitido y la huella. Coinciden en un punto: la base del % (Q1) y O1b.
- **VERDICT:** ninguna revisión CLEAR para este plan; eng review required (todas las issues tienen
  remedio aprobado, pero el estado es «issues_open» hasta que T1 y T12 pasen al cuerpo del plan).

**UNRESOLVED DECISIONS:**
- D6 del plan (vistas «Calidad» o «Anejos»): para `/plan-design-review` antes de E3
