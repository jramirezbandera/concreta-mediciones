# TODOS

Deuda técnica y trabajo diferido, con contexto suficiente para retomarlo dentro de meses.

## ~~Unificar el ciclo de vida de las celdas editables~~ — HECHO (2026-07-04)

Resuelto con el hook `src/hooks/useInlineEdit.ts`: `EditableNum`, `MedNum` y `MedComment`
comparten ahora el ciclo de vida (editing/draft, foco+select al editar, refoco en Esc,
arm-open onFocus). Refactor puro, sin cambio de comportamiento. `EditableText` (multilínea,
textarea con autosize) se dejó fuera a propósito: su ciclo difiere (caret al final, sin
arm-open). Folding de `EditableText` al hook = trabajo opcional de bajo valor; solo tendría
sentido si se aborda la navegación de P.C. (abajo), que sí necesita arm-open en EditableText.

## ~~Navegación de contradictorios (P.C.) en certificaciones~~ — HECHO (2026-07-04)

`EditableText` se migró a `useInlineEdit` (variante multilínea: `onEnterEdit` con caret al
final + autosize) → gana arm-open + refoco en Esc, inerte fuera de un grid. `CertExtraRow`
lleva `data-editrow` y `data-editfield` en sus 4 campos; `cantidad = data-col 0` (enlaza con
la columna Ejec), título/ud/precio navegables por Tab sin `data-col` (Enter solo fluye por
cantidad). Tab encadena título → ud → cantidad → precio.

## ~~Flechas en la tabla de certificaciones~~ — HECHO (2026-07-04)

`useGridNav` colgado del `data-editgrid` de cert, compuesto con `useMedGridTab`
(`onKeyDown={(e) => { gridNav(e); editTab.onKeyDown(e); }}`). Las flechas mueven el foco
entre celdas en reposo (sin abrir); Tab/Enter siguen encadenando edición. Paridad completa
con el grid de medición de presupuesto.

---

## Pestaña de solo-lectura (T-19): las ediciones no se bloquean

**Qué:** en una pestaña marcada solo-lectura (otra pestaña es dueña de la obra, Web
Locks / T-19), hoy solo se inhibe el autosave (`isOwner`) y se muestra un banner
([PersistUI.tsx](src/persist/PersistUI.tsx)); las acciones del store **sí** mutan el
estado en memoria. Un usuario puede teclear cambios que no se persisten y se pierden
en el próximo handoff/recarga, sin más aviso que el banner.

**Por qué:** divergencia silenciosa de datos entre pestañas. Bloquear (o avisar
explícitamente al intentar editar) todas las mutaciones cuando `readonly` cierra el
agujero de raíz.

**Contexto:** `readonly` vive en `sessionStore` y solo se consume en `PersistUI`
(banner) y `sync.ts` (gate del autosave). Para arreglarlo habría que gatear las
acciones del store (transversal, todas las acciones) o interceptar en la capa de UI.
Fuera del alcance del PR de Deshacer/Rehacer (que decidió PERMITIR undo/redo en
readonly por coherencia con este comportamiento actual). Lo confirmó también la voz
externa (Codex) en la revisión de ingeniería de undo/redo (2026-07-05).

**Depende de:** nada; latente hoy, independiente de undo/redo.

---

## ~~Pase de diseño móvil~~ — HECHO (design-review 2026-09-24)

Commits `style(design): FINDING-001…018` y tres pulidos: cabecera móvil y de
tablet con menú «Más», menú ⋮ recortado, Resumen, Certificaciones, Exportar,
contraste (`--text-disabled` fuera del texto legible, acento claro #0369a1),
deshacer en móvil, pistas de teclado fuera del táctil (`isTouchOnly()`), ⓘ al
tacto, botón accesible para desplegar partida, cabecera compacta al hacer scroll
(`CompactHeaderBar`), nombre de obra visible en tablet y escritorio estrecho,
árbol de capítulos usable al tacto/teclado, borrar en rojo, pestaña
«Justificación» corta en móvil, margen lateral único (`--gutter-compact`) y
barras que animan transform en vez de width.

Decisión que se queda así: la franja PEM/TOTAL abre el cajón de capítulos (con
la tarjeta Resumen al pie), porque ahí viven el coeficiente K y «Ajusta».

Informe completo: `~/.gstack/projects/jramirezbandera-concreta-mediciones/designs/design-audit-20260924/`.

---

## Aplazados del plan «reordenar, copiar y duplicar líneas de medición» (autoplan 2026-09-24)

Contexto común: plan `docs/plan-lineas-medicion-orden-copiar.md`. Son las
expansiones que las revisiones CEO, diseño e ingeniería dejaron fuera a propósito.

### Copiar o duplicar una partida CON su medición (P2)

- **Qué:** decidir el contrato de «Copiar partida». Hoy copia la definición de
  precio con `med: []` (`copySlice.ts`, `applyCopy`); `RefPartida` no lleva medición.
  Opción recomendada: una acción aparte, «Duplicar con medición», con ids de línea
  nuevos y sin arrastrar nada de certificación.
- **Por qué:** para reutilizar una partida medida (misma perfilería, otro acabado)
  hoy hay que copiar la partida y después sus líneas: dos portapapeles distintos, y
  la última copia pisa a la primera.
- **Depende de:** el portapapeles de líneas del plan citado.

### Guardar comentario y dimensiones al certificar por líneas (P2)

- **Qué:** al marcar una línea en la certificación (`setCertLine`), congelar también
  su comentario y sus dimensiones, no solo la cantidad (`Cert.lineQty`).
- **Por qué:** si luego se borra o se mueve la línea, `CertDetail` enseña «Línea
  eliminada de la medición» con la cantidad, pero sin decir qué era. La cert es un
  documento de cobro (T-2).
- **Contexto:** cambia el modelo de certificación, así que necesita migración de
  esquema. D-09 ya pinta las líneas certificadas que han desaparecido.

### Mediciones vinculadas entre partidas (P3)

- **Qué:** una línea o una medición que referencia otra partida (p. ej. «Pintura
  intumescente» mide lo mismo que «Acero en vigas») y se actualiza sola.
- **Por qué:** las copias se desincronizan tras la primera revisión estructural.
- **Contexto:** sin evidencia de uso todavía. El portapapeles de líneas ya guarda la
  procedencia (obra, partida y forma), que es el punto de partida.

### Conservar la cantidad fija como primera línea al empezar a medir (P3)

- **Qué:** al añadir o pegar la primera línea en una partida con cantidad fija,
  ofrecer convertir esa cantidad en una línea en vez de sustituirla.
- **Por qué:** hoy `partidaCantidad` pasa de la cantidad fija a la suma de las
  líneas; el plan solo lo hace visible (aviso «fija A → medida B»).
- **Contexto:** cambia también «Añadir línea», que es comportamiento existente.

### Pegar desde Excel sobrescribiendo celdas (P3)

- **Qué:** pegar un rango sobre las celdas desde la que tiene el foco, como una hoja
  de cálculo, en vez de insertar líneas nuevas.
- **Por qué:** es lo siguiente que pedirá quien use el intercambio TSV con Excel.
- **Depende de:** la Etapa B del plan citado (TSV del sistema).

---

## Mejoras de producto (revisión de la app, 2026-09-25)

Salen de repasar qué le cambiaría más la vida al usuario, más allá de pulir la
tabla de medición. Descartadas en la misma revisión: versiones del presupuesto con
diferencias y «Emitir» certificación (T-2 sigue aplazado).

### Que la obra no pueda perderse

Todo vive en IndexedDB del navegador; la única red era acordarse de exportar el .json.

- ~~**Almacenamiento persistente**~~ — HECHO (2026-09-25). `persist/durability.ts`:
  se pide `navigator.storage.persist()` con el primer guardado de la sesión (nunca
  al cargar: Firefox pregunta) y no se insiste tras un «No permitir». El estado se
  ve en la tarjeta de copia de seguridad (`ProjectBackup`). Chrome lo concede por
  uso (marcadores, instalada) y Safari casi solo a la app de pantalla de inicio, así
  que lo normal en una web nueva es seguir en `best-effort`.

- **Recordatorio de copia (P1).**
  - **Qué:** «Última copia: hace 12 días» con botón para hacerla. Más visible
    (no solo en el modal de obra) cuando `durability` no es `persisted`.
  - **Por qué:** con `best-effort`, el navegador puede borrar las obras; y ni con
    `persisted` se salvan de un equipo roto o perdido.
  - **Contexto:** hay que guardar la fecha del último `exportObraJson` por obra (la
    meta del registro es el sitio natural). Decidir cada cuántos días avisar.

- **Guardar la obra en una carpeta elegida (P2).**
  - **Qué:** autoguardar la obra como fichero en una carpeta (File System Access
    API), p. ej. la de la obra dentro de OneDrive, Drive o Dropbox.
  - **Por qué:** copia, historial de versiones y la obra en otro ordenador, sin
    servidor.
  - **Contexto:** solo Chrome y Edge de escritorio; el resto sigue con el .json.
    Pensar qué pasa si dos equipos editan el mismo fichero (hoy el candado
    multi-pestaña, T-19, solo cubre un navegador).

- **Obra en el móvil (P3, decisión de producto).**
  - **Qué:** que la obra llegue al móvil (sincronización) y que la app abra sin
    cobertura (PWA; hoy no hay service worker ni manifest).
  - **Por qué:** el pase de diseño móvil está hecho, pero la obra solo vive en el
    navegador del ordenador; pasarla es exportar e importar el .json a mano.
  - **Contexto:** sincronizar exige servidor y cuentas (p. ej. Supabase): cambia
    privacidad, coste y el «100 % en el navegador» del README.

### Medir sobre planos PDF (P2, grande)

- **Qué:** visor de PDF con escala calibrada; clic en longitudes, superficies o
  recuentos y cada medida entra como línea con su comentario («P1 · Salón») y sus
  dimensiones. Desde una línea, volver a la zona del plano de donde salió.
- **Por qué:** donde se va el tiempo al medir es en leer el plano y teclear cifras.
- **Contexto:** encaja con `expr` (de dónde sale cada número) y con «Medir por»
  (qué columnas). Plan revisado con `/autoplan` (2026-09-25):
  `docs/plan-medir-planos-pdf.md`. Los PDF van en un almacén de IndexedDB aparte,
  por huella; la obra solo guarda sus metadatos (esquema v6).

#### Aplazados del plan «Medir sobre planos PDF» (autoplan 2026-09-25)

Son lo que las revisiones CEO, diseño, DX e ingeniería dejaron fuera a propósito. Todo
depende de que la Etapa A supere su puerta cronometrada.

- **Exportar el plano marcado para la DF (P2).** Las páginas con las formas medidas,
  numeradas como sus líneas, en PDF para adjuntar a la medición. Es otra superficie de
  salida (tamaño L).
- **Comparar revisiones de un plano (P2).** Poner la Rev. B sobre la Rev. A y ver qué
  líneas caen en zonas que cambiaron. La Etapa A solo guarda `sustituye` y avisa de que
  hay una revisión más nueva.
- **Varias escalas por página (P3).** Ventanas de detalle a otra escala dentro de la
  misma hoja. En la Etapa A cada página tiene una sola calibración; el detalle se mide
  adjuntando otra vez el PDF.
- **Certificar sobre el plano (P3).** Marcar en el plano lo ejecutado y que cuente en
  la certificación por líneas.
- **Contar símbolos iguales automáticamente (P3).** Recuento de un símbolo repetido
  (enchufes, luminarias) buscando sus copias en el PDF vectorial.
- **Probar con un plano de ejemplo (P3).** En el estado vacío del visor, para el
  usuario final. El sandbox «Planos (ejemplo)» ya cubre al desarrollador.
- **Borrado automático de PDF sin referencia entre pestañas (P3).** En la Etapa A se
  marcan y se borran a mano con «Liberar espacio». Hacerlo solo exige un protocolo
  entre pestañas: publicación de bytes, referencias sin guardar y las dos pilas del
  historial de cada pestaña.

### Documentos que aún obligan a volver a Presto o a Excel (P2)

Hoy se exportan presupuesto, resumen y certificaciones (`ExportModal`). Los datos de
estos ya están calculados:

- **Mediciones sin precios** para pedir ofertas, y **comparativo de ofertas** por
  partida: importar el .bc3 o el Excel de cada constructora y ver dónde se desvía.
- **Cuadro de precios nº 1 (en letra) y nº 2 (descompuestos).** La letra ya existe
  (`core/numeroALetras`).
- **Liquidación final:** presupuestado frente a ejecutado a origen, con exceso o
  defecto por partida. El exceso ya lo detecta `certPctState`.

---

_Backlog: 1 TODO (mutaciones en pestaña readonly) + 5 aplazados del plan de líneas de medición + mejoras de producto (recordatorio de copia, guardar en carpeta, obra en el móvil, medir sobre planos con 7 aplazados, documentos). El pase de diseño móvil y la navegación de teclado en certificaciones están hechos._
