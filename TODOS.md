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

_Backlog: 1 TODO (mutaciones en pestaña readonly) + 5 aplazados del plan de líneas de medición. El pase de diseño móvil y la navegación de teclado en certificaciones están hechos._
