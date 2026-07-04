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

_Backlog vacío. Los tres TODOs de la navegación de teclado en certificaciones están hechos._
