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
