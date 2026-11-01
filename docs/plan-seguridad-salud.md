# Plan · Estudio de seguridad y salud, básico y completo, desde el presupuesto

> Estado: EN CURSO (2026-11-01). Tercer anejo de «Anejos», junto al estudio de residuos y el
> plan de control de calidad. Obra privada (no hay licitación).
>
> Base normativa: la verificación hecha para concreta-instalaciones,
> [verificacion-seguridad-salud.md](research/seguridad-salud/verificacion-seguridad-salud.md)
> (K-SYS.1–19), que manda en todo lo normativo. Base de contenido: el análisis de los 15
> estudios de ejemplo, [analisis-ejemplos-ebss.md](research/seguridad-salud/analisis-ejemplos-ebss.md).
> Las dos se copian a `docs/research/seguridad-salud/` sin cambios, para que las citas K-SYS de
> este repo se puedan seguir.

## Petición

Hacer aquí el estudio de seguridad y salud como un anejo, el básico y el completo. El básico ya
existe en concreta-instalaciones (feature-35); el completo no existe en ninguna de las dos.

## Por qué aquí

- **Las partidas dicen qué se ejecuta.** En instalaciones las fichas de riesgos se proponen desde
  las justificaciones del CTE y El edificio; aquí salen de las partidas del presupuesto, con
  reglas como las de residuos y calidad. Una demolición, una zanja, un forjado o un andamio en el
  presupuesto proponen su ficha y la nombran como motivo.
- **El art. 4 sale solo.** PEM, GG, BI e IVA están en la obra (`rates` y el PEM del presupuesto):
  el PEC y la justificación del básico no se teclean.
- **Las jornadas se pueden medir.** Con descompuestos, Σ horas de mano de obra (`MO`) ÷ 8 da las
  jornadas del supuesto c) en lugar de estimarlas con un % del PEM.
- **El completo necesita presupuesto** (art. 5.2 e y 5.4: un capítulo más del presupuesto
  general). Es lo que solo esta app puede hacer.

## Objetivo medible

**Fase 1 · Estudio básico (EBSS)**
- En «Anejos», una pestaña «Seguridad y salud». Con «Empezar el estudio», la app propone las
  fichas de lo que tiene el presupuesto, cada una con las partidas que la motivan. El técnico
  marca, quita y edita (riesgos, medidas, protecciones, EPI).
- El apartado 1 justifica el básico con los cuatro supuestos del art. 4.1 y los datos de esta obra
  (PEC desglosado desde el presupuesto, plazo, trabajadores, jornadas). Si sale completo, lo dice.
- El Word sale con los 14 apartados del de instalaciones: amianto, anexo II, servicios higiénicos
  del convenio, trabajos posteriores y otras actividades; sin nada derogado (test de prohibidos).
- Lo que falta (plazo, trabajadores, amianto, centro asistencial…) sale en «Antes de entregar» y
  marcado en el Word, nunca supuesto.

**Fase 2 · Estudio completo (ESS)**
- Cuando el art. 4 lo pide (o el promotor lo encarga), el mismo estudio sale completo: memoria,
  pliego de condiciones particulares, relación de planos y mediciones y presupuesto.
- El presupuesto de seguridad y salud se propone desde las fichas marcadas, los trabajadores y el
  plazo, y se crea como capítulo del presupuesto («Crear capítulo»), enlazado como el de gestión
  de residuos o el de control.

## Lo que se trae de concreta-instalaciones

| Pieza (instalaciones) | Aquí | Cómo |
|---|---|---|
| `lib/ebss/tipos.ts` | `core/ess/tipos.ts` | Se copia; `EstudioSeguridadSalud` pasa a `EstudioSsDatos` (ver §Datos) |
| `lib/ebss/catalogo.ts` + `catalogo/*` (93 fichas) | `core/ess/catalogo*` | Se copia tal cual. `tablaCTE` → `tabla` local (`core/ess/tabla.ts`, misma forma) |
| `lib/ebss/cifras.ts`, `textos.ts`, `prohibidos.ts` | `core/ess/` | Se copian |
| `lib/ebss/art4.ts` | `core/ess/art4.ts` | Se copia; entra el PEC ya calculado desde la obra |
| `lib/ebss/datos.ts` | `core/ess/datos.ts` | Se rehace: lee `ObraData`, no `Proyecto` |
| `lib/ebss/propuesta.ts` | `core/ess/reglas.ts` + `core/ess/seleccion.ts` | Las reglas se rehacen desde partidas; la selección como diferencia se copia |
| `lib/obra/estudioBasico.ts` | `core/ess/documento.ts` | Se reescribe sobre `core/documento` (`Documento`, `SeccionDoc`) |
| Tests de `lib/ebss/test/*` | `core/ess/*.test.ts` | Se copian y se adaptan |
| `SeguridadSaludPage`, `FichasEbss` | `features/seguridad/` | Se rehacen con los componentes de residuos y calidad |

Las dos apps tendrán el catálogo. **Decisión D1** (abajo): esta es la buena; instalaciones remite
aquí cuando el básico esté hecho, como ya hace con el estudio de residuos.

## Diseño

### Datos (`ObraData.seguridadSalud`, esquema nuevo)

```ts
interface EstudioSsDatos {
  version: 1;
  /** El promotor encarga el completo aunque baste el básico (Guía folio 24). */
  forzarCompleto?: boolean;
  fecha: string | null;
  manoDeObra?: ManoDeObra;          // plazo, máx. trabajadores, jornadas o periodos
  subterraneas?: boolean;           // art. 4.1 d)
  coordinacion?: Coordinacion;
  entorno?: Entorno;                // centro asistencial, vía pública, edificio en uso, servicios
  medios?: MediosObra;              // grúa torre, grúa móvil
  serviciosHigienicos?: ServiciosHigienicosDatos;
  seleccion?: SeleccionFichas;      // diferencia con la propuesta
  planos?: string;                  // «SS01–SS02»
  redactor: { nombre: string; titulacion: string; colegiado: string } | null;
  capituloSs?: string | null;       // fase 2: id del capítulo de seguridad y salud
}
```

- **No hay `Partida.ss`.** La unidad del estudio es la ficha, no la partida: la propuesta se
  calcula al vuelo desde el texto de las partidas y solo se guarda lo que el técnico cambia
  (`seleccion`). Un cambio en el presupuesto se refleja sin perder lo decidido. No toca el
  esquema de `Partida`.
- **Lo que ya está en la obra no se pide otra vez:**
  - PEM: el del presupuesto (sin el capítulo de seguridad y salud, que en el completo se suma
    aparte), o `estudioRcd.pemObra` si residuos ya declaró el de toda la obra (proyecto básico).
    Ver D3.
  - GG, BI, IVA: `rates`. El PEC con el desglose de `calcularPec`.
  - Amianto y tipo de obra (nueva, reforma, demolición): los del estudio de residuos si existe
    (`estudioRcd.amianto`, `amiantoElementos`, `tipos`); si no, se declaran aquí. Ver D4.
  - Superficie y plantas: la ficha de la obra (`core/edificio`, TD2).
  - Redactor: se propone el del estudio de residuos.
- Esquema: la siguiente versión libre (v10, o v11 si el plan de ofertas entra antes). Migración:
  solo sube la versión, como v7 y v8. Clave en `DOMAIN_KEYS`.

### Reglas: qué ficha proponen las partidas (`core/ess/reglas.ts`)

Leen título, descripción, unidad y código, como `rcd/reglas` y `pcc/reglas` (mismo `textoDe`).
Cada regla da fichas y su motivo con la partida («02.03 Excavación en zanja…»).

- **Siempre** (toda obra con presupuesto): F0, IP1, IP4, IP6, IP7, M13, M22, MA5.
- **Por partidas** (orientativo; se cierra en E3 contra las obras reales de los tests):
  - demolición/levantado/picado → F1 (reforma) o F2 (demolición), F3, MA10, M2, M14; amianto en
    la partida → aviso de amianto;
  - excavación/vaciado → F4, M1, M2; zanja → F5; pozo → F6; relleno → F7, M20;
  - zapata/losa/muro de sótano → F8; muro a dos caras → F9; encofrado → F10;
  - hormigón armado/forjado/ferralla → F11, F10, M4, M16, M21, MA6, MA7, MA8; bomba → M5;
  - estructura metálica → F12, M17; prefabricados → F13, M6;
  - fábricas de fachada → F14, MA1; tabiquería/pladur → F15, MA2;
  - cubierta plana → F16; inclinada/teja → F17, MA9; impermeabilización con soplete → F18, M18;
  - carpintería → F19; vidrio → F20; cerrajería/barandillas → F21, M17;
  - electricidad → F22; fontanería → F23; saneamiento → F24; climatización/ACS → F25 (y F42 si
    van a cubierta); telecomunicaciones → F26; ascensor → F27, TP3;
  - enfoscados → F28; yesos → F29; falsos techos → F30, MA3; alicatados → F31; solados → F32,
    M12; tarima/vinílicos → F33; solera → F34; pinturas → F35, IP8;
  - urbanización/firmes → F39; apertura de huecos/recalces → F40, MA6;
  - andamio en una partida → MA1/MA2/MA3/MA4 según el tipo; grúa → M7 o M6; plataforma
    elevadora → MA14; montacargas → M8.
- **Por datos del estudio**: vía pública → IP2; edificio en uso → IP9; servicios afectados → IP3;
  grúa torre → M7, F36; cubierta en el presupuesto → TP1; fachada → TP2.
- **Por la obra**: plantas sobre rasante ≥ 2 → MA7, MA1; sótano → F8.
- Los bancos con capítulos conocidos (BCCA, Precio Centro, CYPE, Extremadura) refuerzan la regla
  por código, como en `rcd/reglas`.
- Nada se da por bueno solo: la ficha propuesta se imprime, pero la pantalla muestra el motivo y
  el técnico la puede quitar. Las fichas «redactadas por la app» piden revisión (como allí).

### Documento (`core/ess/documento.ts`)

Los apartados de `estudioBasico.ts` sobre `core/documento`: 0 Datos generales, 1 Justificación
del básico (art. 4), 2 Objeto, 3 Emplazamiento, entorno y servicios afectados, 4 Descripción de la
obra (fases desde las fichas, en el orden de los capítulos), 5 Normas aplicables,
6 Implantación, instalaciones provisionales y servicios higiénicos, 7 Riesgos evitables,
8 Riesgos no eliminables (fichas), 9 Otras actividades, 10 Anexo II y recurso preventivo,
11 Amianto, 12 Trabajos posteriores, 13 Obligaciones, 14 Firma.

- `BloqueDoc` gana `{ kind: 'sub'; texto }` (título de tercer nivel) para los rótulos de las
  fichas; `docxBloques` lo pinta. Residuos y calidad no lo usan: su golden no cambia.
- El Word con `documentoDocx`, como `docxPcc`, por import dinámico (el catálogo no entra en el
  chunk principal, P1 del plan de calidad).
- Test de prohibidos sobre el catálogo y sobre el documento generado (lista de `prohibidos.ts`).

### Vista (`features/seguridad/`)

Tercera pestaña de `AnejosView` («Seguridad y salud», icono a elegir). Dentro, como residuos y
calidad: estado vacío con «Empezar el estudio»; cabecera con el resultado del art. 4 (básico,
completo o pendiente), el PEC y las fichas; pestañas **Fichas** (por grupo, marcar/quitar, motivo
con enlace a la partida, editor de la ficha), **Datos** (plazo, trabajadores, jornadas con lo
medido desde la mano de obra, coordinación, entorno, medios, servicios higiénicos, redactor),
**Antes de entregar** y «Exportar Word».

## Etapas

### Fase 1 · Básico

- **E0 · Traer la base.** Copiar las dos notas de `research/` a `docs/research/seguridad-salud/`.
  Copiar a `core/ess/` tipos, catálogo, cifras, textos, prohibidos y art. 4, con sus tests
  (catálogo, cifras, art. 4). Todo verde sin tocar la app.
- **E1 · Datos de la obra.** `EstudioSsDatos`, `datos.ts` sobre `ObraData`: PEC desde el
  presupuesto, jornadas desde la mano de obra, amianto y tipos desde residuos, pendientes.
  Esquema nuevo, slice (`essSlice`: iniciar, set, quitar), migración y tests de esquema.
- **E2 · Reglas y selección.** `reglas.ts` (propuesta con motivos), `seleccion.ts` (diferencia,
  ediciones, fichas del estudio). Tests con las obras de `__fixtures__` (qué proponen y qué no).
- **E3 · Documento y Word.** `documento.ts`, `{kind:'sub'}`, `docxEss.ts`, test de prohibidos y
  golden del Word. El golden de residuos sigue igual.
- **E4 · Vista.** Pestaña, estado vacío, Fichas, Datos, Antes de entregar, Exportar.
- **E5 · QA.** En el navegador con una obra real; comparar con 2–3 estudios de
  `ejemplos/seguridad y salud/` de instalaciones.

### Fase 2 · Completo

- **C0 · Normativa del art. 5.** Cotejar lo que falta en K-SYS: contenido de la memoria (art. 5.2
  a; Guía folios 26–29), pliego (5.2 b), planos (5.2 c y 5.5: zonas del anexo II «localizadas e
  identificadas»), mediciones y presupuesto (5.2 d y e, 5.4; Guía folio 31: qué entra y qué no,
  sobre qué base). Mismo método: texto del BOE, VERIFICADO o INTERPRETACIÓN.
- **C1 · Memoria del completo.** El documento del básico más lo que pide el art. 5.2 a:
  procedimientos y orden de ejecución (desde los capítulos), servicios sanitarios y comunes
  dimensionados por trabajadores (ya calculados en `dotacionHigienica`).
- **C2 · Pliego de condiciones particulares.** Texto fijo de normativa y condiciones de medios,
  protecciones y EPI, según las fichas marcadas.
- **C3 · Capítulo de seguridad y salud.** Propuesta de partidas desde las fichas (protecciones
  colectivas, EPI, instalaciones de higiene y bienestar, señalización, formación, medicina
  preventiva) con cantidades derivadas de trabajadores, plazo, plantas y superficie, o a 0 con
  pendiente. «Crear capítulo» y enlace, como `rcd/capitulo` y `pcc/capitulo`. Precios del banco o
  de la referencia, o 0 € con pendiente.
- **C4 · Planos.** Relación de planos declarada por el técnico; pendiente si hay anexo II y no se
  dice dónde se localiza.
- **C5 · Word del completo y QA.**

## Decisiones

- **D1 · La app buena es esta.** Cuando el básico esté aquí, concreta-instalaciones remite a este
  estudio, como hace con el de residuos (feature-35: «El estudio de gestión de residuos no va
  aquí»). Hasta entonces, el catálogo de instalaciones no se toca. Se cambia en aquel repo, no en
  este plan.
- **D2 · Sin `Partida.ss`.** La propuesta se recalcula; solo se guarda la diferencia (§Datos).
- **D3 · PEM de toda la obra.** Se toma el de residuos si lo declaró; si no, el del presupuesto.
  Si más adelante lo pide un tercer anejo, se sube a la ficha de la obra como la superficie (TD2).
- **D4 · Amianto y tipo de obra compartidos con residuos.** Si hay estudio de residuos, se leen
  de él y se editan allí (la pantalla lo dice). Una sola declaración de amianto por obra. Los
  tipos encajan: residuos `'no' | 'posible' | 'identificado'` ↔ seguridad
  `'no_identificado' | 'posible' | 'identificado'`; la friabilidad solo la pide seguridad.
- **D5 · El completo es la misma pantalla.** Fichas y datos son los mismos; el resultado del
  art. 4 (o `forzarCompleto`) decide qué documento sale.

## Fuera de alcance

- Plan de seguridad y salud del contratista, libro de incidencias, acta de aprobación: son de la
  obra, no del proyecto.
- Dibujar planos de seguridad.
- Coordinación con otras apps (la remisión de instalaciones es D1, en aquel repo).
