# Plan — Asistente de IA integrado (chat + acciones sobre la obra)

> Revisado en `/plan-eng-review` (2026-07-22) con voz externa (Codex). 14 hallazgos y
> 3 tensiones entre modelos, todos resueltos e incorporados abajo. El informe de la
> revisión está al final del fichero.

## Contexto

Queremos un asistente de IA dentro de la app que (a) resuelva dudas sobre la aplicación, y
(b) ejecute acciones sobre la obra por lenguaje natural: crear partidas mientras se dictan,
redactar descripciones, añadir líneas de medición y rellenar certificaciones.

La arquitectura de referencia ya existe y está probada en **concreta-v2**
(`E:\PROGRAMACION\Concreta EST\concreta-v2`, árbol `src/lib/ai/` + `src/components/ai/`):
llamadas al LLM **directamente desde el navegador** (sin backend), Gemini
`gemini-3.1-flash-lite` con **clave compartida embebida** en build y **BYOK** en
localStorage con prioridad sobre la compartida. No usa function-calling nativo: usa
**structured output** (JSON Schema estricto) y la app aplica los datos llamando a acciones
del estado — nunca manipulando el DOM.

La integración en Mediciones es limpia porque **todas las mutaciones del dominio ya son
acciones headless del store Zustand** (`useObraStore.getState().<accion>()`), y cualquier
mutación que pase por ellas entra **gratis** en el undo global (`src/store/temporal.ts`,
suscrito a `DOMAIN_KEYS`) y en el autosave a IndexedDB (`src/persist/sync.ts`). Verificado:
`temporal.ts:139-157` usa ventana **deslizante con flanco de entrada**, así que las ops
síncronas de un turno producen **una sola entrada de historial**. El precedente exacto de
llamador headless es `src/features/importar/importPartida.ts`.

### Decisiones tomadas con el usuario (2026-07-22)

1. **Aplicación híbrida**: lo inocuo se aplica directo con toast + «Deshacer»; lo que
   **sobrescribe** datos, toca **certificaciones**, o **altera una partida ya certificada**
   pasa por tarjeta de propuesta con diff y botón «Aplicar».
2. **Voz en fase final** (F-A6), con Web Speech API.
3. **Clave compartida nueva**: proyecto Google propio, sin facturación, cuota independiente
   de concreta-v2.
4. **Alcance reducido del primer incremento** (comprobación de complejidad de la revisión):
   **un solo panel lateral acoplado** (no los cuatro modos de contenedor de concreta-v2) y
   **solo Gemini**. OpenAI/Anthropic y los modos flotante/píldora pasan a F-A5.
5. **Privacidad**: nota explicativa en el modal de ajustes, **sin** pantalla de
   consentimiento bloqueante (uso personal). Si la app se abre a más usuarios, revisar.

---

## Arquitectura

### Qué se porta de concreta-v2 (primer incremento)

| Pieza | Origen (concreta-v2) | Destino |
|---|---|---|
| Tipos núcleo (`AiError`, `ChatRequest`, `ChatSystem`) | `src/lib/ai/types.ts` | `src/ai/types.ts` |
| ID de modelo + URL de consola | `models.ts` | `src/ai/models.ts` |
| Clave compartida | `sharedKey.ts` | `src/ai/sharedKey.ts` |
| Proveedor Gemini | `providers/gemini.ts` | `src/ai/providers/gemini.ts` |
| Ventana de historial | `chatHistory.ts` | `src/ai/chatHistory.ts` |
| Parseo defensivo del envelope | `validate.ts` | `src/ai/validate.ts` (adaptado a ops) |
| Tarjeta de propuesta con diff | `components/ai/ProposalCard.tsx` | `src/features/asistente/PropuestaCard.tsx` |
| Ajustes de proveedor + API key | `components/ai/ByokSettings.tsx` | `src/features/asistente/AjustesIA.tsx` |

**Diferido a F-A5**: `providers/{openai,anthropic}.ts`, `providers/schemaConvert.ts`,
`providers/index.ts` (dispatcher), `imagePrep.ts`, y los modos flotante/píldora del chat.
En el primer incremento se instala **solo `@google/genai`**, por dynamic import; nada de
agrupar SDKs en un chunk `ai-vendor` — con un único proveedor, el code-splitting de Vite ya
basta. Los IDs de modelo de OpenAI/Anthropic (`gpt-5.6-terra`, `claude-sonnet-5`) se
verifican contra la documentación viva **cuando** se implemente F-A5, no ahora.

**Settings**: store Zustand pequeño en `src/ai/settingsStore.ts`, persistido en localStorage
(`concreta.ai.settings`, patrón de `src/hooks/useTheme.ts`). Resolución: key propia SIEMPRE
gana; si no hay, cae a la compartida (`usingSharedKey`). El executor headless la lee con
`getState()`. **La key nunca entra en `ObraData`/IndexedDB** (no viaja en backups ni en undo).

**Clave compartida — hecho asumido, no secreto.** `.github/workflows/deploy.yml` publica la
app en GitHub Pages en cada push a `main`, y `import.meta.env.VITE_AI_SHARED_GEMINI_KEY` se
sustituye en build: la clave queda literal en el JS servido y es extraíble. El proyecto
Google **no debe tener facturación** (peor caso 429, nunca cargo). Requisitos derivados:

- Mensaje de límite explicativo, no genérico: qué ha pasado, que la clave es compartida,
  y botón directo a «usa tu propia clave» en `AjustesIA`.
- Procedimiento de rotación documentado en el README (regenerar clave → secret de CI → push).
- Cupo de referencia del free tier: ~15 peticiones/min, ~1.000/día, 250k tokens/min,
  **compartidos entre todos los usuarios de esa clave**.

### El envelope: de «propuesta de formulario» a «lista de operaciones»

```jsonc
{ "reply": "…", "ops": [ /* Operation[] */ ] | null }
```

`Operation` es **un único objeto plano** (`op: enum` + superconjunto de campos nullable), no
un `anyOf` de variantes. Motivo original: el límite de 16 uniones del conversor de Anthropic.
Se mantiene aunque Anthropic esté diferido, porque además es más fácil de emitir para un
modelo pequeño. La validación fina (qué campos exige cada op) la hace `validate.ts` y el
executor, nunca el JSON Schema.

Catálogo v1 (campos no listados = null). La columna «modo» es la clasificación por defecto;
la regla completa está en el árbol de decisión de más abajo.

| `op` | Campos | Modo |
|---|---|---|
| `crear_capitulo` | `titulo` | directo |
| `crear_subcapitulo` | `padre` (pos), `titulo` | directo |
| `crear_partida` | `capitulo` (pos), `codigo?`, `titulo`, `ud`, `precio?`, `descripcion?`, `lineas?` | directo |
| `agregar_lineas` | `ref`, `lineas: [{comentario?, uds?, largo?, ancho?, alto?}]` | directo **o** tarjeta (ver árbol) |
| `editar_partida` | `ref`, `campo: titulo\|ud\|codigo\|descripcion`, `valor` | tarjeta |
| `editar_linea` | `ref`, `indice` (1-based), `campo`, `valor` | tarjeta |
| `borrar_linea` | `ref`, `indice` | tarjeta |
| `set_precio` | `ref`, `valor` | tarjeta |
| `set_cantidad` | `ref`, `valor` | tarjeta (rechazada si la partida tiene medición) |
| `certificar` | `ref`, `valor`, `modo: origen\|esta` | tarjeta |
| `certificar_100` | `ambito: obra\|capitulo\|subarbol\|visible`, `ref?` | tarjeta |
| `crear_certificacion` | `periodo?` | tarjeta |

Notas de catálogo derivadas de la revisión:

- **`crear_capitulo` y `crear_subcapitulo` son ops distintas** porque el store las trata
  como acciones distintas (`addChapter(title)` vs `addSubchapter(parentId, title)`), con
  reglas de código propias. Un único op con `padre?` obligaría a validar a mano cuál toca.
- **`set_cantidad` se rechaza con motivo si `med.length > 0`**: `partidaCantidad`
  (`src/core/medicion.ts:32-35`) devuelve la suma de la medición cuando hay líneas, así que
  fijar la cantidad se guardaría sin cambiar nada visible — un no-op disfrazado de éxito.
- **`certificar_100` declara un ámbito, no una lista.** El modelo dice «el capítulo 2» y el
  executor lo expande a ids; certificar un capítulo grande enumerando cientos de códigos
  gasta tokens, invita a errores de copia y chocaría contra el tope de ops. La expansión
  alimenta `completePartidas(ids)`, que ya está diseñada para recibir el conjunto de filas
  visibles y resolverlo en **un solo `set`**.
- **Ref de partida = `pos`** (`"1.2.3"`). El `code` no sirve como identificador: `addPartida`
  crea con `code: '——'` (`estructuraSlice.ts:421`), así que muchas partidas lo comparten.
- **Tope de ~40 ops por turno.** Lo que exceda no se aplica y aparece en el informe con su
  motivo y la sugerencia de dictarlo en dos veces. Nunca se recorta en silencio. El tope
  cuenta ops, no partidas expandidas por un ámbito.

### Executor — `src/ai/executor.ts` (el corazón)

```
                       ┌──────────────────────────────────────────┐
   usuario escribe ───▶│ AsistenteChat.enviar()                   │
                       │  · sella contexto: obraId + curCert       │
                       │  · snapshot fresco (presupuesto ≤ 8k tok) │
                       └────────────────┬─────────────────────────┘
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │ providers/gemini.chatRaw (structured out) │
                       └────────────────┬─────────────────────────┘
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │ validate.parseEnvelope → {reply, ops}     │
                       │  ops mal formadas → descartadas c/ motivo │
                       └────────────────┬─────────────────────────┘
                                        ▼
      ¿mismo obraId y curCert que al enviar?  ──NO──▶ no se aplica nada,
                                        │            el chat lo explica
                                       SÍ
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │ FASE 1 · RESOLVER (no muta nada)         │
                       │  pos/ref  → partida.id                   │
                       │  índice   → medLine.id                   │
                       │  ámbito   → [partidaId]                  │
                       │  readonly → aborta todo                  │
                       │  sin resolver → noEncontradas + motivo   │
                       └────────────────┬─────────────────────────┘
                                        ▼
                       ┌──────────────────────────────────────────┐
                       │ FASE 2 · CLASIFICAR                      │
                       └───────┬──────────────────────┬───────────┘
                          directas                propuestas
                               ▼                      ▼
                    aplicar ya + toast        PropuestaCard (diff)
                    «Deshacer»                       │
                               │              (al pulsar Aplicar:
                               │               revalidar el sello)
                               ▼                      ▼
                       ┌──────────────────────────────────────────┐
                       │ FASE 3 · VERIFICAR POSTCONDICIONES       │
                       │  relee estado; el efecto ¿ocurrió?       │
                       │  no → «omitida» con motivo               │
                       └────────────────┬─────────────────────────┘
                                        ▼
                       informe enumerado {aplicadas, propuestas,
                       omitidas, noEncontradas} → chat + contexto
                       del turno siguiente
```

**Resolución en dos fases (obligatoria).** `deleteMedLine` hace `p.med.splice(index, 1)`
(`estructuraSlice.ts:161`) y `editMedLine` lee `p.med[index]`. Si un turno trae un borrado y
una edición por índice, la segunda op apunta a la fila equivocada y **no da error**: escribe
el número en la línea de al lado de una medición que después se certifica. Por eso la fase 1
traduce todas las refs e índices a identificadores estables contra el estado inicial, y la
fase 2 reconvierte id→índice justo antes de cada llamada.

**Sello de contexto.** El patrón `reqId + AbortController` portado de concreta-v2 solo evita
que una respuesta vieja pise a una nueva; no comprueba que la obra siga siendo la misma, y
cambiar de obra es un clic en el `TopBar`. Cada petición graba `obraId` y `curCert`; si al
llegar la respuesta no coinciden, no se aplica nada. La `PropuestaCard` guarda el mismo
sello y se invalida al pulsar «Aplicar» si el contexto cambió — un diff calculado hace tres
minutos no describe lo que se va a mutar ahora.

**Gate de solo-lectura.** Antes de resolver nada, el executor comprueba
`useSessionStore.getState().readonly`. Hoy ese flag solo inhibe el autosave y pinta un
banner (`TODOS.md:31-41`): las acciones del store siguen mutando memoria. Una frase dictada
puede crear una partida con ocho líneas, así que el asistente confirmaría por escrito
trabajo que se pierde al recargar. El gate no aplica nada y lo explica en el chat.

**Verificación de postcondiciones.** Las acciones del store están escritas para la interfaz:
casi todas empiezan con una guarda (`if (!p) return;`, `if (!ch) return;`) y no devuelven
nada; `setPrecio` ignora en silencio valores no finitos o negativos. El executor no puede
construir el informe con «llamé a la acción»: tras cada op relee el estado y confirma el
efecto. Si no ocurrió, la op pasa a «omitidas» con su motivo. Un informe que miente es peor
que no tener informe, y el informe es la defensa principal del usuario.

**Acción nueva en el store: `createPartida(chapterId, subId) => string`.** Devuelve el id
creado y elimina la inferencia por diferencia de ids. Se implementa reutilizando el cuerpo
de `addPartida` (que se mantiene para la UI).

**Obra vacía.** `copyTargetOf` devuelve `{ chId: '', subId: null }` cuando no hay capítulos
(`copySlice.ts:54`) y `addPartida` es entonces un no-op silencioso
(`estructuraSlice.ts:406-408`). Si llega un `crear_partida` sin capítulos, el executor crea
antes el capítulo que falta (título del contexto, o genérico) y lo declara en el informe.
Es el primer minuto de uso de la app: no puede fallar en silencio.

**Reutilización (nada de terceras copias).** Se extrae y exporta un único
`resolvePartidaRef(state, ref)` — en `store/selectors.ts` o `core/tree.ts` — que resuelve por
`pos` y por id, y se **refactoriza el `findPartida` privado de `certSlice.ts:53-60`** para
consumirlo: sale una copia menos de las que hay hoy. El executor usa además `copyTargetOf`
para el destino y `revealPartida(id, chId, subId)` tras crear (salto + pulso), que ya existen
y el plan original ignoraba.

### Árbol de clasificación directa/propuesta

```
op
├── crear_capitulo / crear_subcapitulo ................... DIRECTA
├── crear_partida ........................................ DIRECTA
├── agregar_lineas
│     └── ¿la partida aparece en alguna cert?
│            ├── NO .......................................... DIRECTA
│            └── SÍ ................................. TARJETA (¡ojo!)
│                 muestra % certificado antes/después
└── resto (editar_*, borrar_*, set_*, certificar*) ........ TARJETA
```

El criterio no es «aditivo frente a destructivo» sino **«inocuo frente a con
consecuencias»**. Añadir medición parece inofensivo y lo es… hasta que la partida está
certificada: `partidaCantidad` (`medicion.ts:32-35`) toma la suma de la medición, y esa
cantidad ofertada es el denominador del porcentaje certificado. Añadir una línea **baja el
porcentaje certificado sin que nadie toque la certificación**, en un documento que quizá ya
se envió.

### Certificación: nombrar el destino, sin candados inventados

Todas las acciones de certificación operan sobre `s.certs[s.curCert]`
(`certSlice.ts:130, 150`; `completeDraft:85-87`) y **no aceptan un índice**: certificar en
una cert anterior es imposible por construcción. Y `firmadoAt` se sella al **exportar**
(`obraStore.ts:628`, dentro de `freezeCertFirmantes`), no es un cierre: a mano se sigue
editando una cert ya exportada, a propósito. Conclusión:

- **No se implementa ningún candado.** El asistente puede exactamente lo mismo que el
  teclado; cualquier divergencia sería imposible de recordar.
- **La tarjeta y el informe encabezan siempre con la cert destino** («Certificación nº 3 ·
  periodo junio 2026») y marcan con un aviso visible si esa cert ya tiene `firmadoAt`. El
  riesgo real es aterrizar en la cert equivocada, y se ataca donde el usuario mira antes de
  aplicar.

### Prompt y contexto — `src/ai/prompt.ts` + `src/ai/appContext.ts`

Partido en dos bloques para caché de prompt (patrón `buildChatSystemBlocks`):

**Estable**: rol, alcance (mediciones/presupuestos/certificaciones FIEBDC y uso de la app;
declina lo demás), contrato `{reply, ops}`, catálogo de ops, y las reglas de dominio — regla
de fórmula `parcial = uds·largo·ancho·alto`, dimensión vacía = 1, un 0 explícito anula
(`src/core/medicion.ts:15-24`). Más el bloque «SOBRE LA APLICACIÓN» para las dudas,
reutilizando como fuente los textos del `AyudaCenter` (`src/layout/AyudaCenter.tsx`).

**Volátil**, con **presupuesto duro de ~8k tokens**:

```
si la obra cabe  → árbol completo + partidas en resumen
                   (pos, code, título, ud, precio, cantidad, % cert)
                   + detalle del capítulo activo / partida abierta / cert actual
si NO cabe       → árbol de capítulos con totales
                   + detalle solo del contexto activo
                   + el prompt DECLARA que la lista está recortada y cómo pedir más
```

Sin techo, una obra de 500 partidas son ~10-13k tokens **en cada turno**, incluidos los
mensajes conversacionales: multiplica latencia, se come el cupo compartido y acaba
desbordando sin avisar. Como el objetivo son obras pequeñas y medianas, el caso normal cabe
entero y el recorte solo aparece cuando estorba — y cuando aparece, se anuncia.

**Los datos de obra van dentro de un bloque delimitado**, con una línea del prompt estable
declarando que ahí dentro todo son datos y nunca instrucciones. Los títulos y descripciones
vienen de .bc3 de terceros (CYPE, el proyectista) y las ops aditivas se aplican solas; el
delimitador cubre además el caso sin malicia, que es el probable: descripciones largas con
frases imperativas despistando a un modelo pequeño. La defensa real, en todo caso, es que el
informe **enumera siempre cada op aplicada con su destino** — nunca un «hecho» ni un recuento.

Totales de lectura vía selectores existentes (`selectPem`, `selectCertTotals`,
`src/store/selectors.ts`).

### Diseño y UI — `src/features/asistente/`

> Revisado en `/plan-design-review` (2026-07-23) con wireframes de los tokens reales.
> Completitud de diseño 4/10 → 10/10. Toda superficie calibra contra `docs/DESIGN.md` y
> `src/styles/tokens.css`; las 7 capturas de `design_handoff_.../screenshots/` son la
> referencia hi-fi. Nada de grises fuera de paleta ni componentes de chat genéricos.

**Dónde vive el panel (decisión de layout).** El borde derecho ya lo ocupa `ReferenciaPanel`
(`App.tsx:318-339`) con tres modos (split ≥1100 px, overlay, full) y se mantiene montado para
no perder su estado. El asistente **se turna con Referencia en ese mismo hueco**: abrir uno
pliega el otro, con **una regla única en todas las pantallas** (no «compartir si cabe»), y el
plegado conserva el estado montado igual que hoy. Un indicador en `TopBar` recuerda cuál está
plegado para volver de un clic. Reutiliza el `<aside>` redimensionable, sus tres modos y su
comportamiento móvil (full sobre el documento). Protege el ancho del presupuesto, que es lo
que el usuario lee para verificar lo que el asistente escribe. Trade-off aceptado: no se puede
copiar de Referencia y dictar a la vez.

- `AsistenteChat.tsx`: panel lateral (molde de `ReferenciaPanel`), `Drawer` a pantalla
  completa en móvil con la tarjeta de propuesta fijada abajo. Historial solo en memoria. Sin
  streaming.
- **Historial en filas de log compactas, no burbujas de chat** (voz externa). Es una
  herramienta densa tipo Presto, no una app de mensajería: el historial son filas densas
  (fila de orden del usuario, fila de resultado del asistente, recibo de operación),
  coherentes con la estética tabular del resto de la app y mejor aprovechadas en el ancho
  estrecho del panel. **La tarjeta de propuesta es el único elemento con forma de tarjeta**;
  todo lo demás son filas. Construido contra los tokens; nada dibujado como componente de chat
  genérico.
- **Cabecera de contexto fija** (voz externa): franja arriba del panel con
  `obra · capítulo/partida · certificación · estado` (readonly/offline), con afordancias «ver»
  donde ayuden. Hace visible el sello de contexto que la revisión técnica ya decidió capturar,
  y es crítica en móvil, donde el panel tapa el documento y el usuario no ve contra qué objetivo
  da la orden.
- **Composer**: `Enter` hace salto de línea, `Ctrl/Cmd+Enter` envía, con un botón de envío
  siempre visible. El caso central es dictar varias líneas (descripción + mediciones), y
  Enter-para-enviar las mandaría a medias. El borrador se conserva al cerrar, cancelar o
  fallar (mismo texto que restaura el Cancelar del estado de espera).

**Estado de espera** (sin streaming, la respuesta llega entera; en obra la red puede tardar
10-15 s). No un spinner mudo: la burbuja del usuario queda fijada arriba (confirma que se
recibió), un indicador «consultando al asistente…» con el nombre del proveedor, y Cancelar
que **restaura el texto al composer** para reintentar sin reescribir. Pasados ~8 s el texto
cambia a «la red va lenta, sigo esperando…». Cierra el fallo de «parece colgado → recargo o
redicto → petición doble».

**Estado vacío = onboarding** (dibujado en el tablero). `.dot-grid` de fondo (firma de
Concreta), título «¿Qué necesitas de esta obra?», una línea que explica que los cambios sobre
datos existentes se muestran antes de aplicar, y 4 chips de acción contextuales:
«Crear una partida dictándola», «Añadir mediciones a la partida abierta», «¿Cuánto llevo
certificado?», «Redactar la descripción de esta partida». Los chips cambian con el contexto
(en Certificaciones, «Certificar al 100 % el capítulo abierto»); los que necesitan partida
abierta no se muestran si no la hay, en vez de fallar al pulsarlos.

**`PropuestaCard.tsx` — orden de lectura** (dibujado en el tablero). De arriba abajo:
1. **Destino primero**: «Certificación nº 3 · junio 2026» / «Capítulo 2 · Albañilería». Ataca
   el riesgo del Issue 4 (caer en la cert equivocada por tenerla seleccionada).
2. **Recuento en el encabezado**: «14 partidas afectadas» — decide si se revisa fila a fila o
   se aplica de un vistazo.
3. **Aviso si procede**: franja `--state-warn` (ámbar = atención) si la cert ya tiene
   `firmadoAt`. **Nunca rojo**: el rojo (`--state-danger`) es solo error/destrucción, y esto
   está permitido. Regla del sistema, no mezclar.
4. **Detalle**: valor anterior en `--text-secondary` **tachado** (neutro, no rojo) → propuesto
   en `--accent`/`--state-ok`, ambos en `.mono` con `tabular-nums` alineados a la derecha. El
   **rojo (`--state-danger`) queda reservado** para fallo de aplicación, borrado y error real:
   un valor que va a cambiar no es un error, y gastar el rojo aquí lo desgasta para cuando algo
   falle de verdad (corrección de la voz externa contra la regla de `DESIGN.md`).
5. **No aplicadas**: nunca calladas, cada una con motivo en lenguaje llano.
6. **Acción con número**: «Aplicar 14 cambios», no «Aplicar» — última señal antes de tocar el
   documento.

**Diff denso** (umbral, dibujado en el tablero). Hasta ~8 filas, se muestran todas. Por encima
(p. ej. «certifica el capítulo 2» = decenas de partidas), el cuerpo pasa a **resumen agregado**
— «certificará al 100 % 74 partidas del capítulo 2 · importe afectado 128.400 €» — con las
omitidas siempre visibles y el listado completo en un desplegable «ver las 74». El botón de
aplicar **nunca se hunde** bajo un muro de filas. Respeta las dos necesidades: decidir rápido
en el caso normal, auditar si algo huele raro.

**Informe de ejecución** (dibujado en el tablero). Punto de color + qué + motivo a la derecha:
verde `--state-ok` lo hecho, ámbar `--state-warn` lo omitido con motivo, rojo `--state-danger`
lo no encontrado. Colapsado a una línea resumen cuando todo sale bien y hay >5 operaciones;
desplegado siempre que algo se omita. El motivo va a la derecha porque solo se lee cuando el
punto de color ya avisó de que hay algo que mirar.

**Accesibilidad (contrato en el plan, coherente con el AA que la app ya cumple).**
- La respuesta llega en una región `aria-live="polite"` para que el lector la anuncie (sin
  esto, quien use lector se queda en silencio esperando).
- El foco entra al composer al abrir y vuelve al disparador (`TopBar`) al cerrar.
- La `PropuestaCard` es recorrible con Tab y aplicable con Enter — aplicar sin ir al ratón es
  lo rápido a pie de obra.
- Animaciones de entrada de mensaje gated en `prefers-reduced-motion: no-preference`, con el
  estado final visible como base (igual que `.fadeUp`/drawer del sistema).
- Área táctil 44 px vía `.tap-target` en los controles pequeños (chips, kebab, checkbox).

**`AjustesIA.tsx`**: modal (molde `src/components/Modal.tsx`) con la key propia, el aviso de
clave compartida gratuita con límite, y la nota de privacidad (qué datos salen y hacia dónde).

**Atajos**: `useAppHotkeys` ya ocupa Ctrl/Cmd+K, Ctrl/Cmd+Z/Y, `?`, Supr y Escape
(`src/hooks/useAppHotkeys.ts:32-79`). El atajo del asistente se elige fuera de esos; dentro del
composer se deja pasar el undo nativo del textarea; Escape cancela la petición en vuelo y, si
no la hay, cierra el panel.

**El panel no se suscribe al store con un selector amplio**: lee el estado con `getState()` al
enviar. Suscribirse a dominio lo re-renderizaría con cada pulsación y tiraría por tierra la
memoización de filas del `PERFORMANCE_AUDIT.md`.

---

## Fases

### F-A1 · Núcleo Gemini (sin UI)
`types`, `models`, `sharedKey`, `providers/gemini`, `chatHistory`, `settingsStore`.
`.env.local` con la clave nueva; `.env.test` para vitest.
**Tests**: resolución BYOK > compartida, normalización de errores, scrubbing de la key.

### F-A2 · Chat de dudas (solo lectura)
`AsistenteChat` + botón en `TopBar` + `AjustesIA` (con la nota de privacidad) + prompt
estable/volátil con presupuesto de tokens. Responde dudas de la app y de la obra con
`ops: null`. Entrega valor ya y valida proveedor, UI, errores y cancelación en real.

### F-A3 · Ops de presupuesto
Envelope con ops + `validate` + `executor` (dos fases, sello de contexto, gate de readonly,
postcondiciones) + `resolvePartidaRef` compartido + `createPartida` en el store +
`PropuestaCard` + informe enumerado + toast «Deshacer».
Ops: `crear_capitulo`, `crear_subcapitulo`, `crear_partida` (con descripción redactada por IA
y `lineas` inline), `agregar_lineas`, `editar_partida`, `editar_linea`, `borrar_linea`,
`set_precio`, `set_cantidad`.

### F-A4 · Ops de certificación
`certificar`, `certificar_100` (por ámbito), `crear_certificacion` — siempre tarjeta, con la
cert destino nombrada. Clasificación de `agregar_lineas` sobre partidas certificadas.
Snapshot volátil enriquecido con la cert actual.

### F-A5 · Proveedores adicionales, modos de ventana y visión
`providers/{openai,anthropic}` + `schemaConvert` + dispatcher (verificando entonces los IDs
de modelo contra la documentación viva), modos flotante/píldora del chat, y `imagePrep` para
adjuntar fotos de hojas de medición manuscritas.

### F-A6 · Voz
Botón de micrófono con Web Speech API (`es-ES`, resultados intermedios en el input).
Degradación limpia si el navegador no la soporta.

---

## Cobertura de tests

Todo es hueco porque el código no existe aún. Framework: **Vitest** con tests colocados
(`*.test.ts` junto al código), `jsdom`, `fake-indexeddb`; la cobertura ya incluye todo
`src/**` (`vite.config.ts:22`).

```
CAMINOS DE CÓDIGO                                  FLUJOS DE USUARIO
[+] src/ai/settingsStore.ts                        [+] Dictado de presupuesto
  ├── [GAP] key propia gana a la compartida          ├── [GAP] [→E2E] dictar 3 partidas → pos correlativas
  ├── [GAP] sin propia → compartida (usingShared)    ├── [GAP] [→E2E] partida creada en otro cap → revealPartida
  ├── [GAP] sin ninguna → asistente deshabilitado    └── [GAP] Ctrl+Z revierte el turno entero
  └── [GAP] localStorage corrupto → defaults       [+] Certificación
[+] src/ai/providers/gemini.ts                       ├── [GAP] [→E2E] propuesta → diff → Aplicar → totales
  ├── [GAP] respuesta OK → envelope                  ├── [GAP] la tarjeta nombra la cert destino
  ├── [GAP] 401/403 → AiError('invalid-key')         └── [GAP] aviso si la cert ya tiene firmadoAt
  ├── [GAP] 429 → AiError('rate-limit') + CTA      [+] Estados de error
  ├── [GAP] abort → AiError('aborted')               ├── [GAP] 429 → mensaje + «usa tu clave»
  └── [GAP] la key NUNCA aparece en el mensaje       ├── [GAP] sin red → reintentar
[+] src/ai/validate.ts                                ├── [GAP] cambiar de obra en vuelo → no aplica
  ├── [GAP] envelope válido                          └── [GAP] pestaña readonly → no aplica + explica
  ├── [GAP] ops: null (turno conversacional)       [+] Límites
  ├── [GAP] op desconocida → descartada c/ motivo     ├── [GAP] obra vacía → crea capítulo y lo dice
  ├── [GAP] faltan campos del tipo → descartada      ├── [GAP] >40 ops → aplica 40 y anuncia el resto
  └── [GAP] JSON no-objeto / ops no-array            └── [GAP] obra grande → snapshot recortado y anunciado
[+] src/ai/executor.ts        ◀── EL CRÍTICO
  ├── fase 1 resolver
  │   ├── [GAP] ref por pos resuelve
  │   ├── [GAP] ref inexistente → noEncontradas
  │   ├── [GAP] índice fuera de rango → omitida
  │   ├── [GAP] ámbito capítulo → expande a N ids
  │   └── [GAP] **REGRESIÓN** borrar+editar en el mismo
  │             turno NO se pisan (Issue 2)
  ├── clasificación
  │   ├── [GAP] aditivas → aplicadas
  │   ├── [GAP] sobrescritura/cert → propuesta
  │   └── [GAP] agregar_lineas en partida certificada → propuesta
  ├── aplicación
  │   ├── [GAP] crear_partida con líneas inline
  │   ├── [GAP] parcial = uds·largo·ancho·alto; vacío=1; 0 anula
  │   ├── [GAP] set_cantidad con medición → rechazada c/ motivo
  │   ├── [GAP] certificar origen / esta
  │   ├── [GAP] certificar_100 por ámbito → un solo set
  │   └── [GAP] readonly → no muta NADA
  ├── postcondiciones
  │   ├── [GAP] acción que no tuvo efecto → «omitida»
  │   └── [GAP] createPartida devuelve el id creado
  └── historial
      └── [GAP] un turno = UNA entrada de undo
[+] src/features/asistente/AsistenteChat.tsx
  ├── [GAP] enviar → spinner → respuesta
  ├── [GAP] cancelar en vuelo → restaura el texto
  ├── [GAP] error → mensaje + Reintentar
  └── [GAP] sin key → deshabilitado con CTA a ajustes

LLM: [GAP] [→EVAL] frase en castellano → ops esperadas

COBERTURA: 0/46 (código nuevo)  |  3 [→E2E]  |  1 [→EVAL]  |  1 REGRESIÓN (crítica)
```

**Eval del prompt (`npm run eval:ia`).** Un fichero de casos-oro (frase real de obra → ops
esperadas) y un runner que las lanza contra la API y reporta aciertos. Se ejecuta **a mano
cuando se toca el prompt o se cambia de modelo, NO en CI**: el modelo no es determinista, un
job intermitente se acaba ignorando, y gastaría cupo compartido en cada push. El fichero
crece con lo que falle en dogfood. Sin esto, cada ajuste del prompt es a ciegas: arreglar
«certifica el capítulo entero» puede romper «mete una línea de 3 por 2» sin que nadie se
entere hasta ver una medición a la mitad en una certificación.

**Reset entre tests**: `__resetHistoryForTests()` para los tests de undo del executor,
`__resetSyncForTests()` para los de persistencia.

---

## Modos de fallo

| Camino nuevo | Fallo realista | ¿Test? | ¿Manejo? | ¿Lo ve el usuario? |
|---|---|---|---|---|
| `providers/gemini` | 429 por cupo compartido agotado | sí | sí | mensaje + CTA a su clave |
| `providers/gemini` | red caída a mitad de petición | sí | sí | error + Reintentar |
| `validate` | el modelo devuelve JSON que no encaja | sí | sí | «no he entendido», sin mutar |
| `executor` fase 1 | ref a partida inexistente | sí | sí | «no encontrada» + motivo |
| `executor` fase 1 | borrado + edición por índice | sí (regresión) | sí (dos fases) | n/a: imposible |
| `executor` | respuesta llega tras cambiar de obra | sí | sí | «el contexto ha cambiado» |
| `executor` | pestaña readonly | sí | sí | explicación + no aplica |
| `executor` | acción del store que no tuvo efecto | sí | sí | «omitida» + motivo |
| `executor` | obra sin capítulos | sí | sí | crea capítulo y lo declara |
| `PropuestaCard` | la obra cambió antes de «Aplicar» | sí | sí | tarjeta invalidada |
| prompt volátil | obra que no cabe en el presupuesto | sí | sí | el modelo declara el recorte |

**Ningún hueco crítico** (sin test + sin manejo + silencioso): los once caminos tienen
test y manejo, y ninguno falla en silencio.

---

## NO está en el alcance

- **OpenAI y Anthropic** (F-A5): el primer incremento concentra el esfuerzo en el executor;
  el BYOK sigue disponible con clave Gemini propia.
- **Modos flotante/píldora del chat** (F-A5): un panel acoplado da el 100 % de la capacidad;
  reproducir las 1279 líneas de `AiChatModal` en otro sistema de diseño no añade ninguna.
- **Visión** (F-A5) y **voz** (F-A6).
- **Proxy serverless para la clave**: rompería la premisa de app estática sin backend; el
  peor caso hoy es un 429 sin cargo. Reversible: se puede añadir después sin tocar el cliente.
- **Consentimiento de privacidad bloqueante**: decisión explícita de uso personal; la nota
  vive en `AjustesIA`. Revisar si la app se abre a más usuarios.
- **Arreglo global del modo solo-lectura** (`TODOS.md`): el executor se gatea, pero el
  refactor transversal de todas las acciones del store sigue fuera, como decidió su TODO.
- **Certificación por líneas desde el asistente** (`setCertLine`): los `lineId` son uuids;
  se abordará cuando el catálogo de ops soporte referencias a línea por índice estable.
- **Chunk `ai-vendor`**: innecesario con un solo proveedor.
- **Trazabilidad clicable «ir a» en el informe** (voz externa de diseño, hallazgo 10):
  considerada, no incluida por decisión del usuario. `revealPartida` ya existe si se retoma.
- **«Deshacer este turno» persistente en el recibo** (hallazgo 3): considerada, no incluida;
  el toast «Deshacer» + el undo global (Ctrl+Z) quedan como red.
- **Resumen de consecuencia económica siempre visible + preflight offline** (hallazgos 5 y 9):
  considerados, no incluidos; el importe agregado aparece en los diffs densos y el estado de
  red se cubre con el mensaje de 429 y el umbral de red lenta del estado de espera.

## Lo que ya existe y se reutiliza

| Necesidad del asistente | Ya existe | ¿Se reutiliza? |
|---|---|---|
| Mutar el dominio sin tocar el DOM | acciones de `useObraStore` | sí, es la base entera |
| Undo de lo que hace el asistente | `src/store/temporal.ts` (ventana deslizante) | sí, gratis |
| Persistir lo aplicado | autosave de `src/persist/sync.ts` | sí, gratis |
| Llamador headless de acciones | `src/features/importar/importPartida.ts` | sí, como patrón |
| Resolver el capítulo/sub destino | `copyTargetOf` (`copySlice.ts:41`) | sí (el plan original lo ignoraba) |
| Llevar al usuario a lo creado | `revealPartida` (`obraStore.ts:118`) | sí (idem) |
| Buscar una partida | `findPartida` privada en `certSlice.ts:53` | se **extrae y comparte** |
| Certificar en lote con un solo `set` | `completePartidas` (`obraStore.ts:166`) | sí, alimentada por el ámbito |
| Panel lateral redimensionable | `ReferenciaPanel` + `App.tsx:318-339` | sí, como molde |
| Modal con focus-trap | `src/components/Modal.tsx` | sí, para `AjustesIA` |
| Toasts con acción | `useToastStore` + `src/layout/Toast.tsx` | sí, para «Deshacer» |
| Textos de ayuda para las dudas | `src/layout/AyudaCenter.tsx` | sí, como fuente del prompt |
| Totales de lectura | `src/store/selectors.ts` | sí |
| Patrón de persistencia en localStorage | `src/hooks/useTheme.ts` | sí, para los ajustes de IA |

---

## Paralelización

| Paso | Módulos | Depende de |
|---|---|---|
| Núcleo Gemini (F-A1) | `src/ai/` (proveedor, settings, tipos) | — |
| Resolver compartido + `createPartida` | `src/store/`, `src/core/` | — |
| Chat de dudas (F-A2) | `src/features/asistente/`, `src/layout/` | Núcleo Gemini |
| Executor (F-A3) | `src/ai/executor.ts` | Núcleo + resolver |
| Ops de cert (F-A4) | `src/ai/`, `src/features/asistente/` | Executor |

```
Lane A: Núcleo Gemini → Chat de dudas → Executor → Ops de cert   (secuencial)
Lane B: Resolver compartido + createPartida en el store          (independiente)

Lanzar A y B en paralelo. B toca src/store y src/core, que A no toca hasta el
Executor: fusionar B antes de empezar el Executor.
```

Conflicto a vigilar: el Executor consume lo que produce B, así que B debe estar fusionado
antes de F-A3. El resto de F-A1/F-A2 no lo necesita.

---

## Implementation Tasks

Sintetizadas de los hallazgos de la revisión. Cada tarea deriva de un hallazgo concreto.

- [ ] **T1 (P1, humano: ~3h / CC: ~20min)** — executor — Resolución en dos fases (refs e índices → ids estables antes de mutar)
  - Surgió en: Arquitectura, Issue 2 — `deleteMedLine` hace `splice`, `editMedLine` lee por índice
  - Ficheros: `src/ai/executor.ts`
  - Verificar: test de regresión «borrar línea 2 + editar línea 3 en el mismo turno»
- [ ] **T2 (P1, humano: ~3h / CC: ~20min)** — executor/UI — Sello de contexto (obraId + curCert) en petición y en tarjeta
  - Surgió en: Voz externa, Issue 10 — `reqId` no cubre el cambio de obra
  - Ficheros: `src/ai/executor.ts`, `src/features/asistente/AsistenteChat.tsx`, `PropuestaCard.tsx`
  - Verificar: test «cambiar de obra en vuelo → no se aplica nada»
- [ ] **T3 (P1, humano: ~4h / CC: ~30min)** — executor/store — Verificar postcondiciones + `createPartida` que devuelve id
  - Surgió en: Voz externa, Issue 13 — las acciones del store son no-ops silenciosos
  - Ficheros: `src/ai/executor.ts`, `src/store/slices/estructuraSlice.ts`, `src/store/obraStore.ts`
  - Verificar: `npm test` — test «acción sin efecto → aparece en omitidas»
- [ ] **T4 (P1, humano: ~4h / CC: ~30min)** — eval — Casos-oro `npm run eval:ia` (frase → ops), fuera de CI
  - Surgió en: Tests, Issue 7 — nadie prueba «castellano → ops»
  - Ficheros: `src/ai/eval/casos.json`, `scripts/eval-ia.ts`, `package.json`
  - Verificar: `npm run eval:ia` con la clave de `.env.local`
- [ ] **T5 (P1, humano: ~1h / CC: ~10min)** — executor — Gate de solo-lectura antes de aplicar
  - Surgió en: Arquitectura, Issue 3 — `readonly` solo inhibe el autosave
  - Ficheros: `src/ai/executor.ts`
  - Verificar: test «readonly → cero mutaciones + mensaje»
- [ ] **T6 (P2, humano: ~2h / CC: ~15min)** — store/core — Extraer `resolvePartidaRef` y refactorizar `findPartida`
  - Surgió en: Calidad, Issue 5 — tres copias de «encontrar una partida»
  - Ficheros: `src/store/selectors.ts` (o `src/core/tree.ts`), `src/store/slices/certSlice.ts`
  - Verificar: `npm test` (los tests de cert deben seguir verdes)
- [ ] **T7 (P2, humano: ~3h / CC: ~20min)** — prompt — Presupuesto de ~8k tokens con degradación anunciada
  - Surgió en: Rendimiento, Issue 8 — snapshot sin techo
  - Ficheros: `src/ai/prompt.ts`
  - Verificar: test con obra grande sintética → el bloque declara el recorte
- [ ] **T8 (P2, humano: ~2h / CC: ~15min)** — UI — Nombrar la cert destino y avisar si tiene `firmadoAt`
  - Surgió en: Arquitectura, Issue 4 — candado inventado, riesgo real sin cubrir
  - Ficheros: `src/features/asistente/PropuestaCard.tsx`, `src/ai/executor.ts`
  - Verificar: test de render «Certificación nº N · periodo»
- [ ] **T9 (P2, humano: ~2h / CC: ~15min)** — executor — `agregar_lineas` pasa a tarjeta si la partida está certificada
  - Surgió en: Tensión entre modelos 1 — cambia el % certificado en silencio
  - Ficheros: `src/ai/executor.ts`
  - Verificar: test «partida en cert + agregar_lineas → propuesta, no directa»
- [ ] **T10 (P2, humano: ~2h / CC: ~15min)** — catálogo — `certificar_100` por ámbito, expandido por el executor
  - Surgió en: Tensión entre modelos 2 — enumerar cientos de refs no escala
  - Ficheros: `src/ai/validate.ts`, `src/ai/executor.ts`, `src/ai/prompt.ts`
  - Verificar: test «ámbito capítulo → N ids → un solo set»
- [ ] **T11 (P2, humano: ~1h / CC: ~10min)** — catálogo — Rechazar `set_cantidad` con medición; separar `crear_subcapitulo`
  - Surgió en: Voz externa, Issue 14 — el catálogo no encaja con la API del store
  - Ficheros: `src/ai/validate.ts`, `src/ai/executor.ts`, `src/ai/prompt.ts`
  - Verificar: test «set_cantidad con med.length>0 → omitida con motivo»
- [ ] **T12 (P2, humano: ~1h / CC: ~10min)** — executor — Obra vacía: crear el capítulo que falta y declararlo
  - Surgió en: Voz externa, Issue 12 — `copyTargetOf` devuelve `chId: ''`
  - Ficheros: `src/ai/executor.ts`
  - Verificar: test «obra sin capítulos + crear_partida → capítulo + partida»
- [ ] **T13 (P2, humano: ~1h / CC: ~10min)** — prompt/UI — Delimitar datos de obra e informe enumerado
  - Surgió en: Calidad, Issue 6 — texto de .bc3 de terceros en el prompt
  - Ficheros: `src/ai/prompt.ts`, `src/features/asistente/AsistenteChat.tsx`
  - Verificar: revisión visual del informe + test de que enumera cada op
- [ ] **T14 (P2, humano: ~2h / CC: ~15min)** — UI/docs — Mensaje de 429 con CTA + rotación de clave en README + nota de privacidad
  - Surgió en: Arquitectura, Issue 1 — la clave es pública y la cuota es un pool
  - Ficheros: `src/features/asistente/AjustesIA.tsx`, `src/ai/errors.ts`, `README.md`
  - Verificar: forzar 429 con clave agotada → mensaje explicativo
- [ ] **T15 (P3, humano: ~30min / CC: ~5min)** — executor — Tope de ~40 ops por turno, anunciando lo descartado
  - Surgió en: Rendimiento, Issue 9 — lista de ops sin límite
  - Ficheros: `src/ai/executor.ts`
  - Verificar: test «50 ops → 40 aplicadas + 10 anunciadas»
- [ ] **T16 (P3, humano: ~1h / CC: ~10min)** — UI — Atajo del asistente sin chocar con `useAppHotkeys`; Escape y undo del textarea
  - Surgió en: Voz externa — Ctrl/Cmd+K, Ctrl/Cmd+Z/Y, `?`, Supr y Escape ya están ocupados
  - Ficheros: `src/hooks/useAppHotkeys.ts`, `src/features/asistente/AsistenteChat.tsx`
  - Verificar: test de teclado «Escape cancela en vuelo, si no cierra»
- [ ] **T17 (P1, humano: ~1d / CC: ~40min)** — layout — El asistente se turna con Referencia en el hueco lateral (regla única: abrir uno pliega el otro)
  - Surgió en: Diseño D3/D4 — dos paneles peleando por el borde derecho ahogan el presupuesto
  - Ficheros: `src/App.tsx`, `src/features/asistente/AsistenteChat.tsx`, `src/layout/TopBar.tsx`, store (flag de panel activo)
  - Verificar: a 1100 px, abrir el asistente pliega Referencia y conserva su estado; el presupuesto mantiene ancho
- [ ] **T18 (P2, humano: ~2h / CC: ~15min)** — UI — Tarjeta de propuesta: orden de lectura (destino → recuento → aviso → diff → omitidas → botón con número)
  - Surgió en: Diseño D5 — «diff por filas» describe datos, no jerarquía
  - Ficheros: `src/features/asistente/PropuestaCard.tsx`
  - Verificar: test de render del encabezado con cert nombrada y del botón con recuento
- [ ] **T19 (P2, humano: ~3h / CC: ~20min)** — UI — Diff denso: resumen agregado + detalle plegable por encima de ~8 filas
  - Surgió en: Diseño D5 — «certifica el capítulo 2» = decenas de filas, botón hundido
  - Ficheros: `src/features/asistente/PropuestaCard.tsx`
  - Verificar: test «>8 cambios → resumen con importe afectado + desplegable; botón visible sin scroll»
- [ ] **T20 (P2, humano: ~3h / CC: ~20min)** — UI — Estado de espera con progreso, umbral de red lenta y Cancelar que restaura el texto
  - Surgió en: Diseño D8 — spinner mudo = «parece colgado» en red de obra
  - Ficheros: `src/features/asistente/AsistenteChat.tsx`
  - Verificar: test «cancelar restaura el composer»; simular espera >8s → texto de red lenta
- [ ] **T21 (P2, humano: ~2h / CC: ~15min)** — UI — Estado vacío como onboarding: `.dot-grid` + 4 chips de acción contextuales
  - Surgió en: Diseño (empty states son features) — una caja vacía no enseña qué se puede dictar
  - Ficheros: `src/features/asistente/AsistenteChat.tsx`
  - Verificar: test «sin partida abierta, los chips que la requieren no se muestran»
- [ ] **T22 (P2, humano: ~4h / CC: ~30min)** — a11y — Contrato de accesibilidad del chat: `aria-live`, patrón de foco, tarjeta por teclado, reduce-motion
  - Surgió en: Diseño D7 — el chat trae región viva y foco entre mensajes que las otras pantallas no tenían
  - Ficheros: `src/features/asistente/AsistenteChat.tsx`, `src/features/asistente/PropuestaCard.tsx`
  - Verificar: test «respuesta anunciada en aria-live»; «Tab llega al botón Aplicar, Enter aplica»
- [ ] **T23 (P3, humano: ~2h / CC: ~15min)** — style — Calibrar toda superficie del asistente contra `tokens.css` (colores, escala, ámbar=atención/rojo=error, `.tap-target`)
  - Surgió en: Diseño D6 — el plan no nombraba el sistema de diseño; riesgo de chat genérico
  - Ficheros: `src/features/asistente/*.module.css`
  - Verificar: revisión visual contra las capturas hi-fi; ningún color fuera de paleta
- [ ] **T24 (P2, humano: ~3h / CC: ~20min)** — UI — Historial en filas de log compactas (no burbujas); la tarjeta es el único elemento con forma de tarjeta
  - Surgió en: Voz externa de diseño (hallazgo 2) — las burbujas son el default equivocado para una herramienta densa
  - Ficheros: `src/features/asistente/AsistenteChat.tsx`, `*.module.css`
  - Verificar: revisión visual; el historial se lee como log de operaciones, no como chat
- [ ] **T25 (P2, humano: ~2h / CC: ~15min)** — UI — Cabecera de contexto fija: obra · capítulo/partida · certificación · estado (readonly/offline)
  - Surgió en: Voz externa de diseño (hallazgo 1) — sin ella se dan órdenes contra el objetivo equivocado, sobre todo en móvil
  - Ficheros: `src/features/asistente/AsistenteChat.tsx`
  - Verificar: la cabecera refleja el sello de contexto de cada petición; test de render con obra/cert
- [ ] **T26 (P2, humano: ~1h / CC: ~10min)** — UI — Composer: Enter=salto, Ctrl/Cmd+Enter=enviar, botón de envío visible, borrador conservado
  - Surgió en: Voz externa de diseño (hallazgo 7) — Enter-para-enviar corta el dictado de varias líneas
  - Ficheros: `src/features/asistente/AsistenteChat.tsx`
  - Verificar: test «Enter inserta salto, Ctrl+Enter envía»; «cancelar/cerrar conserva el borrador»
- [ ] **T27 (P2, humano: ~30min / CC: ~5min)** — style — Diff: valor anterior en `--text-secondary` tachado (neutro), propuesto en accent; rojo solo para error/borrado
  - Surgió en: Voz externa de diseño (hallazgo 4) — el rojo en valores viejos rompe la regla de `DESIGN.md`
  - Ficheros: `src/features/asistente/PropuestaCard.tsx`, `*.module.css`
  - Verificar: revisión visual; el rojo no aparece en ningún valor de diff, solo en fallos

---

## Verificación

- `npm test` — tests colocados nuevos (`src/ai/*.test.ts`,
  `src/features/asistente/*.test.tsx`) con el setup existente (`src/test/setup.ts`,
  `fake-indexeddb`). El test de regresión de T1 es obligatorio antes de dar F-A3 por hecho.
- `npm run eval:ia` — casos-oro contra la API, cuando se toque el prompt.
- Manual con la clave real (`npm run dev`):
  1. Dictar tres partidas con mediciones → aparecen con pos correlativas, `revealPartida`
     lleva hasta ellas, un Ctrl+Z por turno las revierte, y persisten tras recargar.
  2. «Certifica al 100 % el capítulo 2» → tarjeta que nombra la cert destino y el recuento
     de partidas; Aplicar; comprobar totales en Certificaciones.
  3. Abrir la obra en dos pestañas → en la de solo-lectura, el asistente se niega y explica.
  4. Cambiar de obra mientras responde → no se aplica nada y lo dice.
  5. Forzar errores (key inválida, sin red, 429) → mensajes correctos + Reintentar.
- Comprobar en la pestaña Network que `@google/genai` solo se carga al abrir el asistente.

## Riesgos

- **Cupo compartido**: 1.000 peticiones/día para todos los usuarios de la clave. Se acepta;
  la salida es el mensaje de 429 con CTA a clave propia y la rotación documentada.
- **Calidad del modelo pequeño**: `gemini-3.1-flash-lite` es barato y rápido, pero es el
  eslabón débil para castellano de obra. Los casos-oro existen justamente para medirlo; si no
  da la talla, subir a `flash` es cambiar una constante (a costa de cupo).
- **Refactor de `certSlice`** (T6) toca código estable y probado: se hace primero, en su
  propia rama, con los tests de certificación verdes antes de seguir.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 2 | ISSUES FOUND | eng: 14+3 tensiones · diseño: 10 hallazgos, 2 tensiones — todos resueltos |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 14 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (PLAN) | 4/10 → 10/10, 10 decisiones |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CODEX:** dos pasadas de voz externa. Ingeniería: 6 hallazgos que la revisión no vio +
  2 tensiones. Diseño: 10 hallazgos (cabecera de contexto, undo persistente, red del diff,
  resumen de consecuencia, ergonomía móvil, envío del textarea, offline, trazabilidad) +
  2 tensiones con decisiones de diseño ya tomadas.
- **CROSS-MODEL:** ingeniería, 3 tensiones resueltas a favor de la voz externa. Diseño,
  2 tensiones: el valor viejo del diff pasa de rojo a neutro (corrección de la regla de
  tokens de `DESIGN.md`) y las burbujas de chat pasan a filas de log compactas. De los
  5 añadidos de diseño, el usuario incorporó la cabecera de contexto; los otros 4 quedan
  como considerados-no-incluidos en «NO está en el alcance».
- **VERDICT:** ENG + DESIGN CLEARED — listo para implementar. Alcance reducido: un panel
  lateral que se turna con Referencia + solo Gemini en el primer incremento.

NO UNRESOLVED DECISIONS
