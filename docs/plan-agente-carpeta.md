# Plan — La obra en una carpeta, con Claude trabajando sobre ella

> Propuesta del 2026-11-09. Las decisiones D1–D8 las propone Claude; las de §10 las
> tiene que tomar el usuario antes de empezar.
>
> **Decidido por el usuario (2026-11-09):**
> - El MCP se empaqueta para que cualquier usuario lo **descargue desde la app** y lo
>   instale: no depende del repo (D5).
> - **Firefox y Safari no hacen falta** por ahora: solo Chrome y Edge, sin servidor local.
> - **Bases de precios:** las que tenga el usuario, más las oficiales de la app, que el MCP
>   puede descargar con los mismos enlaces (D6).

## 1. Qué se quiere

Lo mismo que en Concreta FEM:

- **Pasar la obra a una carpeta** del ordenador. Desde entonces la obra vive ahí, no en el
  navegador.
- **Que un agente (Claude Code) trabaje sobre ella** a través de un MCP: crear capítulos,
  partidas y líneas de medición, ponerles precio, corregir, certificar.
- **Que la app abierta en el navegador vea los cambios en tiempo real**, sin recargar ni
  perder lo que el técnico tiene abierto.
- **Que sirva desde cualquier sesión**: una o varias sesiones de Claude Code, en cualquier
  carpeta, y que sepan qué tiene abierto el técnico («esta partida»).

## 2. Lo que ya hay

### En Concreta FEM (el modelo a seguir)

- **Un fichero `proyecto.json`** es la única fuente de verdad. La app lo abre desde una
  carpeta con la File System Access API («Abrir carpeta», «Pasar a una carpeta»; Chrome y
  Edge) o desde un servidor local (`fem visor`).
- **La app vigila el fichero cada segundo** (`VIGILANCIA_MS = 1000`, por fecha y tamaño o
  ETag) y lo recarga cuando cambia. **Escribe con sello**: si el fichero cambió desde que se
  leyó, no lo pisa y avisa.
- **`.fem/app.json`** guarda lo que el ingeniero tiene elegido; `fem seleccion` se lo da al
  agente.
- **`cli/mcp.ts`** es un MCP escrito a mano (JSON-RPC por stdio, sin SDK) que envuelve las
  mismas órdenes de la CLI. Para escribir usa `editar`, con las operaciones del editor de la
  app, y `escribir_proyecto`, con sello.
- **`bun run instalar`** enlaza la skill `fem` en `~/.claude/skills` (junction), pone `fem`
  en el PATH y registra el MCP en Claude Desktop.

### En Mediciones

- **La obra vive en IndexedDB**, con un registro de varias obras (`persist/registry.ts`), un
  candado por pestaña (`tabLock.ts`) y autoguardado con 1,5 s de pausa (`persist/sync.ts`). La
  copia `.json` es el sobre `{ kind: 'concreta-obra', schemaVersion, data }`; la `.zip` lleva
  además `planos/<huella>.pdf`.
- **Todo el dominio son acciones del store** (Zustand + Immer, ~118 acciones), y el store no
  importa nada del navegador ni de `persist/`. **Comprobado con un spike en bun**: el store
  corre fuera del navegador. `loadObra` → `addChapter` → `createPartida` → `setPrecio` →
  `addMedLines` dan 13,44 m³ × 18,50 € = 248,64 €, y la ida y vuelta del JSON sale idéntica.
- **El asistente de la app ya tiene un catálogo de operaciones** (`ai/ops.ts`, 12 ops) y un
  ejecutor sin interfaz (`ai/executor.ts`) con postcondiciones, recibos y un tope por turno.
  Ese ejecutor depende de `persist` para el sello de la obra activa y para saber si está en
  solo lectura.
- **Deshacer** (`store/temporal.ts`) junta una ráfaga de cambios en una sola entrada.
  `loadObra` vacía el historial.
- **Los bancos de precios** son obras de tipo `reference` en IndexedDB. Un agente no las ve.

## 3. Decisiones de diseño

### D1. El fichero en la carpeta es la fuente de verdad, no un puente en vivo con la pestaña

Una obra en carpeta es un fichero `*.mediciones.json` más sus planos. La app lo lee y lo
escribe con la File System Access API y lo vigila; el agente lo cambia con el MCP.

**Por qué:**
- El agente trabaja aunque el navegador esté cerrado, y varias sesiones pueden trabajar a la
  vez.
- La carpeta se puede versionar y copiar, y lleva los PDF, que Claude puede leer.
- La File System Access API funciona en la app publicada (https, GitHub Pages): en Chrome y
  Edge no hace falta ningún servidor local.
- Es el mismo modelo que FEM, que el usuario ya conoce.

**Descartado:**
- **Un WebSocket entre el MCP y la pestaña.** Chrome ya pide un permiso de «acceso a la red
  local» para que una web pública hable con `127.0.0.1`. Habría que autenticar al cliente con
  un token, y el agente se queda sin obra al cerrar la pestaña.
- **Que el agente maneje la interfaz** con automatización del navegador: lento y frágil.

### D2. El agente nunca edita el JSON a mano: siempre por operaciones, con el mismo código que la app

El JSON de FEM está pensado para editarlo a mano, con su validador. El de Mediciones no.
Tiene datos derivados y acoplados:
- la numeración (`pos`, `code`);
- el `precio`, que se recalcula del descompuesto salvo con `precioManual`;
- el banco de recursos compartido, con copy-on-write;
- las bajas (`bajas`) de las partidas certificadas que se borran;
- el `lineSnap` de las certificaciones, y las certificaciones emitidas, que quedan cerradas.

Una edición a mano lo deja incoherente sin que nadie lo note. Por eso, **toda escritura pasa
por `editar`**, que carga el fichero en el store sin interfaz, llama a las mismas acciones que
la app y lo vuelve a escribir.

- **Un solo motor de operaciones** (`src/agente/motor.ts`), sacado de `ai/executor.ts`: sin
  importar `persist`, con el sello y la solo-lectura como parámetros, y con ids que se pueden
  dar de antemano (D4). El asistente de la app pasa a usarlo también. Un solo catálogo: lo que
  gane el MCP lo gana el chat de la app, y al revés.
- **`validar`** comprueba la estructura, las referencias, la numeración y la versión de
  esquema. Es la red de seguridad (y detecta un fichero tocado a mano).

### D3. En vivo: la app vigila el fichero y aplica lo de fuera como un solo paso de deshacer

- Se vigila cada segundo, como en FEM. Al leer un cambio de fuera, una acción nueva del store,
  **`aplicarExterno(data, etiqueta)`**, cambia las claves de dominio de una vez **sin
  `loadObra`**. Así no se vacía el historial y no se mueve lo que el técnico tiene abierto
  (capítulo, partida, vista, certificación en curso). `reconcileUi` arregla lo que quede
  colgando.
- **Se reaprovechan los objetos que no cambian** (los iguales por contenido conservan su
  referencia): solo se repintan las filas tocadas, aunque la obra sea grande.
- **Es una entrada de deshacer** con nombre («Claude: +2 partidas, +14 líneas»): Ctrl+Z quita
  el lote entero del agente.
- **Se resalta lo que acaba de cambiar** durante unos segundos, con un aviso que deja
  deshacerlo o ir a ello. Es lo que hace que «se vea en tiempo real».
- **Latencia: ≤ 1 s** desde que vuelve cada llamada del agente. La skill le pide lotes
  pequeños (una partida con sus líneas, o unas pocas) para que la obra se vea crecer.

### D4. Concurrencia: sello y repetir las operaciones, no fusionar JSON

Pueden escribir la app y una o varias sesiones del agente.

- **En el MCP:** lee el fichero y su sello, aplica las operaciones y escribe solo si el sello
  no ha cambiado; si cambió, vuelve a leer y **repite las mismas operaciones** (hasta tres
  veces). Se puede porque una operación es una intención («añade estas líneas a la 2.3»), no un
  «sustituye este array». Dos agentes, o un agente justo después de un guardado de la app,
  nunca chocan.
- **En la app, con cambios sin guardar** cuando llega uno del agente: repite sobre lo que tiene
  en memoria las operaciones de ese lote, que el MCP deja en el **diario**
  (`.mediciones/diario/`), con los ids que creó para que salgan los mismos, y guarda lo fusionado.
  Si una no se puede aplicar (el técnico acaba de borrar esa partida), lo dice. Si falla todo, se
  elige como en FEM: lo mío o lo de Claude.
- La primera versión de la app (F3) solo **detecta y pregunta**, como FEM. La repetición
  automática entra en F4.

### D5. La interfaz: un MCP empaquetado que se descarga desde la app

FEM ejecuta el MCP desde el repo con bun. Aquí no puede ser así, porque lo instala cualquier
usuario de la app, que no tiene ni el repo ni bun.

**Qué es:**
- **MCP por stdio, `concreta-mediciones`.** Las herramientas con tipos evitan escribir JSON entre
  comillas en PowerShell (las barras se pierden en los heredocs).
- **Las mismas órdenes como CLI** (`mediciones <orden>`, con la misma salida JSON), para pruebas,
  scripts y depurar.
- **La guía** (la skill) va dentro del MCP: en sus instrucciones de `initialize`, en un recurso y
  en la herramienta `guia`. Así llega a todos los clientes, tengan skills o no.

**Cómo se empaqueta:**
- **Un solo fichero JavaScript para Node** (`concreta-mediciones.mjs`): el motor, el store y el
  parser de bc3, empaquetados con Vite en modo SSR. No necesita `node_modules`.
- **Con el SDK oficial de MCP** (MIT), no escrito a mano como el de FEM. Lo van a instalar otros
  usuarios con versiones de cliente que no controlamos, y el SDK sigue los cambios del protocolo.
  Al ir empaquetado, no añade nada que instalar.
- **Se construye en el mismo workflow que despliega la app** (`deploy.yml`) y se publica junto a
  ella en GitHub Pages (`/mcp/`). Cada versión de la app lleva su MCP, con el mismo `APP_VERSION`
  y el mismo `SCHEMA_VERSION`. Esto resuelve casi todo el desfase de D8.

**Cómo se instala** (una pantalla «Trabajar con Claude» en la app, en el menú y en Ayuda):
- **Claude Desktop:** un paquete **`.mcpb`** (MCP Bundle, el antiguo `.dxt`). Se descarga y se
  abre con doble clic. Claude Desktop trae su propio Node, así que no hay que instalar nada más.
  En su `manifest.json` se piden la carpeta de bases (D6) y las carpetas donde puede trabajar.
- **Claude Code:** un **plugin** desde un marketplace en el repo de GitHub. Un plugin lleva a la
  vez el MCP y la skill `mediciones`. La pantalla da las dos órdenes para copiarlas
  (`/plugin marketplace add …` y `/plugin install …`). Necesita Node, que Claude Code suele
  tener ya.
- **Alternativa sin plugin:** descargar el `.mjs` y registrarlo con
  `claude mcp add -s user concreta-mediciones -- node <ruta>`. La pantalla da la orden ya escrita.
- **Versión:** el MCP dice la suya en `obra` y en `guia`. La app, con la obra en carpeta, compara
  la que deja el MCP en el diario con la suya y avisa si hay que actualizarlo.

**A comprobar en el spike de F2:** cómo instala el `.mcpb` el Claude Desktop actual en Windows, y
si Claude Code acepta el plugin con el MCP y la skill juntos tal como se describe.

**Descartado:**
- **Un ejecutable con `bun build --compile`.** Pesa unos 100 MB, y en Windows, sin firmar, sale
  el aviso de SmartScreen.
- **Publicarlo en npm** (`npx …`). Es otra cuenta y otro sitio que mantener; se puede añadir más
  adelante.

**Para desarrollar:** el MCP se ejecuta desde el código del repo (con `vite-node` o bun), sin
empaquetar.

### D6. Las bases de precios: las del usuario y las oficiales de la app

El agente no ve las referencias de IndexedDB. Tiene tres fuentes:

1. **Las del usuario, en disco.** Los `.bc3` de una **carpeta de bases**, que se elige al
   instalar, más los que haya en la carpeta de la obra. Se leen con el parser de `vendor/bc3`,
   que no depende del navegador.
2. **Las oficiales, descargadas por el MCP.** Usa el mismo catálogo que la app
   (`core/basesOficiales.ts`) y el mismo descargador (`features/importar/descargaBase.ts`, sin
   React: `fetch` y el lector de zip de `persist/zip`). La herramienta `bases` las lista con su
   organismo, edición y condiciones; `descargar_base` la baja **en el ordenador del usuario**,
   como hace el navegador, porque redistribuirlas exige permiso, y la deja en la carpeta de bases.
   - Hoy se pueden descargar la BCCA (zip) y la de Extremadura (bc3).
   - La de Madrid no tiene enlace fijo (se baja con formularios): el MCP da su página, y el
     usuario la deja en la carpeta de bases.
   - Al mantener el catálogo (`scripts/bases/comprobar.mjs`) se actualizan a la vez la app y el
     MCP, porque comparten el fichero.
3. **Las que ya tiene en la app (opcional, F5).** La pantalla «Trabajar con Claude» puede escribir
   en la carpeta de bases las referencias importadas en el navegador. Así no hay que volver a
   buscar el `.bc3` original.

El índice de cada base se guarda en caché, por su sha256 (`~/.concreta-mediciones/bases/`):
abrir una base de 30 MB no cuesta nada la segunda vez.

Es lo que permite la regla 1 de la skill (§7): los precios salen de una base, con su
descompuesto y su `baseSource`, nunca de memoria.

### D7. Lo que el técnico tiene abierto

La app deja en `.mediciones/app.json` la vista, el capítulo activo, la partida abierta, las
líneas elegidas, la certificación en curso, el plano y la página, si tiene cambios sin guardar
y el sello de la versión que enseña. Lo escribe 300 ms después de cada cambio, solo si ya tiene
permiso de escritura (nunca lo pide por esto).

`seleccion` se lo da al agente con `alDia`: false si la app enseña otra versión que la del
fichero.

### D8. Versión de esquema entre el MCP y la app publicada

El MCP descargado sale del mismo build que la app (D5), pero el usuario puede quedarse con uno
viejo, y en desarrollo el MCP ejecuta el repo local. Si un MCP escribe la obra con una versión de
esquema más nueva que la de la app, la app la abriría en solo lectura.

- **El MCP no sube la versión de un fichero** sin `subirVersion: true`, y lo explica: hay que
  desplegar antes.
- **Con un fichero más nuevo que el MCP**, no escribe nada y dice que hay que descargar el MCP
  nuevo desde la app.

## 4. Arquitectura

```text
 Claude Code (una o varias sesiones)              Chrome / Edge (la app publicada)
        │ MCP por stdio                                  │
        ▼                                                │ File System Access API
 cli/mcp.ts ─► cli/ordenes.ts ─► src/agente/            │ vigila cada 1 s
 (= CLI `mediciones`)            motor · consultas ·    │ aplicarExterno → 1 paso de deshacer
                                 fichero · bases        │
                                        │               │
                                        ▼               ▼
                 D:\Obras\Calle Mayor 12\
                   Calle Mayor 12.mediciones.json   ◄── la obra (única fuente de verdad)
                   planos\<huella>.pdf              ◄── los PDF (como dentro de la copia .zip)
                   .mediciones\app.json             ◄── lo que el técnico tiene abierto
                   .mediciones\diario\<fecha>.json  ◄── cada lote de Claude: ops, ids, recibos
                   .mediciones\*.bak                ◄── la versión anterior a cada escritura
```

## 5. El fichero

- **Nombre:** `<denominación>.mediciones.json`, fijado al crearlo (no cambia si se renombra la
  obra). El sufijo lo distingue del `proyecto.json` de FEM, que puede estar en la misma carpeta
  de obra.
- **Contenido:** el mismo sobre que la copia `.json` (`kind`, `schemaVersion`, `appVersion`,
  `data`), sin `exportedAt`, que cambiaría en cada guardado. Se puede importar en la app como
  una copia más.
- **Forma canónica:** `JSON.stringify` con 2 espacios, en el orden de claves que deja
  `toSerializable`. Al implementarlo se vio que **no hace falta ordenar las claves**: leer y
  volver a escribir sin cambios da el mismo texto, también con una obra importada de un `.bc3` de
  Presto (probado en `src/agente/editar.test.ts`). Dos versiones se comparan bien en git y en un
  diff.
- **Escritura atómica:** un temporal en la carpeta y luego se renombra (en el navegador lo hace
  `createWritable`). Antes se deja la copia `.bak`.
- **Los planos:** `planos/<huella>.pdf`, la misma estructura que la `.zip`. Así «Pasar a una
  carpeta» escribe casi lo mismo que la copia, pero sin comprimir.

## 6. Herramientas del MCP

Todas reciben la ruta absoluta de la carpeta (o del fichero) y devuelven JSON.

**Lectura**

| Herramienta | Qué da |
|---|---|
| `guia` | La skill: reglas, flujo y convenios |
| `obra` | El fichero de la carpeta, su versión, su sello y el estado de la app |
| `resumen` | Ficha, capítulos con importes, PEM, GG, BI, IVA, total, K, certificaciones |
| `arbol` | Capítulos, subcapítulos y partidas (código, ud, cantidad, precio, importe), por capítulo y profundidad |
| `partida` | Descripción, líneas (índice, comentario, uds × l × a × h, fórmula, parcial, plano), descompuesto, certificado |
| `buscar` | Partidas de la obra por texto o código (`core/buscar.ts`) |
| `seleccion` | Lo que el técnico tiene abierto, con `alDia` |
| `planos` | Planos y páginas con su escala, y la ruta de cada PDF para leerlo |
| `bases` | Las bases que hay en disco y las oficiales que se pueden descargar |
| `buscar_precio` | Partidas de las bases `.bc3` del disco, con precio y descompuesto |
| `validar` | Errores y avisos (partidas sin precio, sin medición, referencias rotas) |

**Escritura:** `editar`, con un lote de operaciones (todas o ninguna; un lote es un paso de
deshacer en la app). Es el catálogo de `ai/ops.ts`, ampliado:

- **Estructura:** `crear_capitulo`, `crear_subcapitulo`, `renombrar`, `mover_contenedor`,
  `borrar_contenedor` (vacío).
- **Partidas:** `crear_partida`, `editar_partida`, `duplicar_partida`, `mover_partida`,
  `borrar_partida`, `set_precio`, `set_cantidad`, `copiar_de_base` (con su descompuesto y su
  `baseSource`).
- **Medición:** `agregar_lineas` (con posición y fórmulas), `editar_linea`, `borrar_lineas`,
  `mover_lineas`, `forma_medicion`.
- **Descompuesto:** `agregar_recurso`, `editar_recurso`, `quitar_recurso`, con las reglas de
  copy-on-write de la app.
- **Económico y ficha:** `set_rates` (GG, BI, IVA, CI), `set_coef_k`, `editar_obra`.
- **Certificación:** `crear_certificacion`, `certificar`, `certificar_100`. Nunca sobre una
  certificación emitida.

**Otras:**
- `nueva_obra`: crea el fichero en una carpeta.
- `descargar_base`: baja una base oficial a la carpeta de bases (D6).
- `abrir_app`: abre la app publicada en el navegador. La primera vez, el técnico elige la carpeta,
  porque el navegador no deja abrir una por su ruta; después ya está en su lista de obras.
- Más adelante, `importar_bc3` y `exportar` (bc3, xlsx, docx).

## 7. Reglas de la skill

1. **Los precios no salen de tu memoria.** Salen de una base (`buscar_precio` y
   `copiar_de_base`) o te los da el técnico. Si no, la partida queda sin precio y se dice al
   final.
2. **Las mediciones no se inventan.** Salen de las cotas que da el técnico o de un documento que
   has leído, y el comentario de cada línea dice de dónde («Planta baja · eje A (plano A-02)»).
   Medir sobre el plano calibrado es una herramienta del técnico en la app.
3. **Lee justo antes de cambiar.** El técnico puede haber guardado desde la app. «Esta partida»
   se resuelve con `seleccion`.
4. **El fichero no se toca a mano**, solo con `editar`.
5. **Las certificaciones emitidas están cerradas.** Una partida certificada no se borra ni se
   cambia su medición sin que lo pida el técnico.
6. **Lotes pequeños:** una partida con sus líneas, o unas pocas, por llamada. Así el técnico ve
   crecer la obra y cada lote se deshace por separado.
7. **Obra privada:** nada de licitación ni baja de adjudicación.

## 8. Cambios en la app

- **Obras en carpeta en el registro.** El índice guarda la `FileSystemDirectoryHandle`, que se
  puede guardar en IndexedDB. El selector de obras las enseña con un icono de carpeta. Al
  reabrir, el navegador pide permiso con un clic; Chrome y Edge recientes ofrecen «Permitir en
  cada visita».
- **«Pasar a una carpeta»** (menú de la obra y Ctrl+K): elige una carpeta para escribir y deja
  el fichero y los planos. **Nunca pisa una obra que ya esté**. Desde entonces la obra se guarda
  y se vigila en la carpeta (ver §10, punto 1).
- **«Abrir carpeta»:** una carpeta con un `*.mediciones.json` se añade a la lista.
- **Autoguardado en el fichero,** con sello y una pausa más corta. Sin permiso de escritura, la
  obra se abre en solo lectura hasta el primer guardado.
- **Vigilancia, `aplicarExterno`, resaltado y aviso** (D3). En F3, aviso de conflicto con
  elección; en F4, repetición del diario (D4).
- **Indicador en la barra:** «Carpeta · al día / guardando / cambió fuera».
- **Planos:** si un PDF no está en IndexedDB, se lee de `planos/`; uno adjuntado en la app se
  escribe también allí.
- **Pantalla «Trabajar con Claude»** (D5): descargas del `.mcpb`, del plugin y del `.mjs`, con las
  órdenes ya escritas, la versión y, en F5, «Copiar mis bases a la carpeta de bases».
- **Firefox y Safari** no tienen carpetas: siguen con IndexedDB y la copia, sin «Pasar a una
  carpeta» (el botón no sale). No hay servidor local: decisión del usuario.

## 9. Fases y criterios de paso

| Fase | Qué | Tamaño |
|---|---|---|
| F0 | Spike: el store corre sin navegador, en bun | Hecho |
| F1 | Motor y fichero | M |
| F2 | MCP, CLI y guía; paquetes `.mcpb`, plugin y `.mjs` | M |
| F3 | La app sobre la carpeta, en vivo | L |
| F4 | Trabajar a la vez | M |
| F5 | Bases de precios: del disco y oficiales | M |
| F6 | Extras | — |

**F1 — Motor y fichero** (sin interfaz). `src/agente/`:
- `fichero.ts`: leer y escribir en forma canónica, con sello, `.bak` y escritura atómica;
- `motor.ts`: sacado de `ai/executor.ts`, sin `persist` y con ids dados de antemano;
- `consultas.ts`: resumen, árbol, partida y buscar;
- `validar.ts`.

El asistente de la app pasa a usar el motor, y sus pruebas siguen pasando.

*Criterios:* una prueba por operación; la ida y vuelta del fichero idéntica; dos escrituras con
el mismo sello, la segunda repite y no pierde nada; un `.bc3` de prueba da el mismo PEM por el
motor que por la app.

**F1 hecha (2026-11-09).** En `src/agente/`:

| Fichero | Qué hace |
|---|---|
| `operaciones.ts` | El catálogo, con validación estricta |
| `motor.ts` | Los aplicadores y `aplicarLote` |
| `formato.ts` | El fichero, sin Node: lo usará también la app |
| `fichero.ts` | Leer y escribir con sello, `.bak` y escritura atómica |
| `editar.ts` | El lote sobre el fichero: todo o nada, repetir si hay conflicto y comprobar la versión |
| `consultas.ts` | Resumen, árbol, partida y buscar |
| `validar.ts` | Errores de estructura y avisos de lo que falta |

Las pruebas están junto a cada uno. Además:
- **El catálogo:** las 12 operaciones de la app más 9 propias del agente (`renombrar`,
  `borrar_contenedor`, `borrar_partida`, `duplicar_partida`, `mover_partida`, `borrar_lineas`,
  `set_porcentajes`, `set_coef_k`, `editar_obra`). Las del descompuesto y las de copiar de una
  base van en la F5, con las bases.
- **El ejecutor de la app** aplica a través del motor. Al moverlo salió un fallo:
  `applyProposals` leía la certificación de antes del cambio, así que «certificar» desde una
  tarjeta decía «omitida: no se registró la cantidad» aunque sí se registraba. Corregido, con su
  prueba.
- **Las referencias:** una partida, por su número en el árbol («1.2.3») o su id; un contenedor,
  por su código, su título o su id; una línea, por su número en la partida, en el momento de
  aplicar (las operaciones de un lote van en orden).
- **El aviso de códigos repetidos** solo sale con partidas *distintas*: la misma partida en dos
  sitios comparte concepto en el `.bc3`, y las distintas se exportan renombradas (`.2`, `.3`).
- **Los ids dados de antemano** pasan a la F4: solo hacen falta para repetir el diario en la app.

**F2 — MCP, guía y paquetes.**
- **El código:** `cli/ordenes.ts`, `cli/mediciones.ts`, `cli/mcp.ts` (con el SDK) y la guía, en
  `.claude/skills/mediciones/`.
- **El empaquetado:** `scripts/mcp/empaquetar.mjs` hace el `.mjs` con Vite en modo SSR, el `.mcpb`
  (su `manifest.json` y el `.mjs`, en zip con `fflate`) y el plugin (su manifiesto, `.mcp.json` y
  la skill).
- **El despliegue:** `deploy.yml` lo ejecuta tras el build de la app y lo deja en `dist/mcp/`.
- **Primero, un spike de instalación:** el `.mcpb` en el Claude Desktop del usuario y el plugin en
  Claude Code, antes de escribir las herramientas.

*Criterios:*
- el protocolo, probado por stdio con el `.mjs` empaquetado, no con el código fuente;
- instalado desde los ficheros de `dist/mcp/` (no desde el repo), en Claude Desktop y en Claude
  Code;
- una sesión en una carpeta de obra crea un capítulo con tres partidas y sus líneas, y `validar`
  da ok;
- aún sin vista en vivo: se ve importando el fichero.

**F3 — La app sobre la carpeta.** Todo §8 salvo la repetición del diario. Pruebas con una File
System Access API en memoria, como `aCarpeta.test.tsx` de FEM.

*Criterios — hito:* con la obra abierta en Chrome desde su carpeta, cada lote del agente aparece
en ≤ 2 s, resaltado, sin mover lo abierto, y Ctrl+Z lo quita. Un cambio sin guardar del técnico
nunca se pierde.

**F4 — Trabajar a la vez.** `app.json` y `seleccion`; el diario con autor (cada sesión); la
repetición automática sobre cambios sin guardar.

*Criterios:* el técnico edita precios mientras el agente mete líneas, y no se pierde nada ni se
pregunta nada. «Pon medición a esta partida» va a la que tiene abierta.

**F5 — Bases de precios.**
- `bases`, `descargar_base`, `buscar_precio` y `copiar_de_base`;
- el índice en caché;
- en la app, «Copiar mis bases a la carpeta de bases».

*Criterios:*
- una partida copiada de una base trae el mismo descompuesto y el mismo precio que copiándola en
  la app;
- la BCCA descargada por el MCP da el mismo índice que la descargada en el navegador.

**F6 — Extras:**
- exportar bc3, xlsx y docx desde el MCP;
- `importar_bc3` a una carpeta;
- las operaciones de residuos, calidad y seguridad (el store ya las tiene);
- publicarlo en npm, si hace falta.

## 10. Decisiones del usuario

1. **«Pasar a una carpeta», ¿mover o copiar?** *Propuesta:* mover. La obra queda en la carpeta y
   la copia del navegador se guarda oculta 30 días, para recuperarla. FEM copia, pero aquí, con
   varias obras en la lista, quedarían dos iguales.
2. **Nombre del fichero.** *Propuesta:* `<denominación>.mediciones.json`, frente a un `obra.json`
   fijo.
3. **Qué hace el agente sin preguntar.** *Propuesta:* todo lo que se deshace, directamente; ya
   están los permisos de Claude Code por herramienta y cada lote es un Ctrl+Z. Certificar, y
   tocar partidas certificadas, solo si el técnico lo pide en ese momento.
4. **El marketplace del plugin**, ¿en el mismo repo de la app o en uno aparte?
   *Propuesta:* en el mismo, para que la versión del plugin vaya con la de la app.

**Confirmadas por el usuario el 2026-11-09:** el punto 1, **mover**; y el 2, el 3 y el 4, como
se proponen. Antes ya se había decidido: el MCP empaquetado se descarga desde la app (D5), no
hacen falta Firefox ni Safari, y las bases son las del usuario más las oficiales de la app (D6).

## 11. Riesgos

- **Solo Chrome y Edge** tienen carpetas (D1). Aceptado por el usuario.
- **La instalación la hace otra gente.** Si el `.mcpb` o el plugin cambian de formato, se rompe
  fuera de nuestra vista. Por eso hay un spike en F2, y la pantalla de la app explica cada paso y
  ofrece la alternativa del `.mjs`.
- **Las URL de las bases oficiales cambian** con cada edición. El catálogo es el mismo de la app,
  y `comprobar.mjs` avisa.
- **Permiso al reabrir:** un clic por sesión del navegador, salvo con «Permitir en cada visita».
- **Obras grandes:** cada lote reescribe el fichero entero. Un banco de varios miles de recursos
  son unos MB: escribir y leer cuesta decenas de ms. Vigilar es mirar fecha y tamaño. Si se nota,
  se mide con la obra de prueba.
- **Desfase de esquema** entre el repo local y la app publicada (D8).
- **Números inventados:** reglas 1 y 2 de la skill, `baseSource`, comentarios con su fuente y
  los avisos de `validar`.
