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

## Pase de diseño móvil — pendientes (design-review 2026-09-24)

El pase arregló la cabecera móvil (menú «Más»), el menú ⋮ recortado, Resumen,
Certificaciones, Exportar, contraste y deshacer en móvil (commits `style(design):
FINDING-001…009`), y en una segunda tanda las pistas de teclado en táctil
(`isTouchOnly()`, FINDING-010), las ⓘ al tacto (FINDING-011) y el botón accesible
para desplegar partida (FINDING-014). Quedan, por impacto:

- **[Medio · color] Blanco sobre `--accent` claro (#0284c7) = 4,1:1** (Exportar, «Ajusta»,
  «Aplicar»). Token de DESIGN.md: decidir si los rellenos primarios usan `--accent-hover`
  (#0369a1, 5,9:1) en tema claro.
- **[Medio · jerarquía] Cromo fijo ≈31% de un 375×667** (TopBar + cabecera de página +
  barra PEM/TOTAL + pestañas). La barra de resumen repite el total de la cabecera.
- **[Medio · responsive] Tablet 768:** el selector de obra queda en un icono sin nombre.
- **[Medio · interacción] Cajón de capítulos en táctil:** acciones de 18px con `opacity:0`
  hasta hover; `span role=button` anidado en `<button>` (`ChapterCard`, `SubRow`).
- **[Pulido]** tocar PEM/TOTAL abre el cajón de capítulos, no un resumen; pestaña
  «Justificación del precio» en dos líneas; márgenes laterales móviles 10/12/14/16px.

Informe completo: `~/.gstack/projects/jramirezbandera-concreta-mediciones/designs/design-audit-20260924/`.

---

_Backlog: 1 TODO (mutaciones en pestaña readonly) + pendientes del pase de diseño móvil. Los de navegación de teclado en certificaciones están hechos._
