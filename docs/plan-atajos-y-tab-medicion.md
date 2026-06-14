# Plan · Atajos de teclado + Tab editable en líneas de medición

> Estado: REVISADO + **IMPLEMENTADO** (autoplan, 2026-06-14 · 3 voces: subagente
> eng + subagente design + Codex eng). Decisiones de usuario: Enter baja en
> columna · borrado con Deshacer (toast) · tooltips + chuleta `?`.
> Verificado: tsc + 568 tests (19 nuevos) + eslint + build en verde.
>
> (A) BUG Tab→edición arreglado de raíz (incluía el `focus()` que faltaba en
> MedNum/MedComment, que las 3 voces marcaron como bloqueante). (B) atajos
> globales con red de seguridad. Núcleo: `hooks/editGridNav.ts`,
> `hooks/useMedGridTab.ts`, `hooks/useAppHotkeys.ts`, `hooks/hotkeyGuards.ts`,
> `hooks/usePartidaDelete.ts`, `layout/ShortcutsHelp.tsx`, undo en `toastStore`/
> `Toast`, `restorePartida`/`focusSearch`/`searchFocusNonce` en el store.

## Premisa / problema

Editar mediciones es lo que más se repite en la herramienta. Hoy:
1. **Tab no encadena edición.** `MedNum`/`MedComment` (`MedCells.tsx`) son
   `<button>`/`<span>` en reposo (con `data-editcell`) que pasan a `<input>` al
   activarse (click/Enter/Space). Al pulsar Tab dentro de un input, `onBlur`
   confirma y el foco cae en el `<button>` de la siguiente celda **en reposo** —
   hay que volver a activarla a mano. Se quiere el comportamiento de hoja de
   cálculo: Tab confirma y abre la siguiente celda lista para escribir.
2. **No hay atajos.** Existe `useClipboardHotkeys` (Ctrl/⌘+C/V de partidas en
   `usePartidaClipboard.ts`) con buenas guardas, pero no hay foco-al-buscador ni
   borrado por teclado. El usuario pide «buscar, borrar con Supr, etc.».

## Qué ya existe (reuso)
- **Navegación con flechas** entre celdas en reposo: `useGridNav` (`hooks/useGridNav.ts`),
  colgado del contenedor; actúa solo sobre `[data-editcell]`. **Hay que NO romperlo.**
- **Patrón de hotkeys global** con guardas (`inEditableField`, modal abierto, vista,
  selección de texto): `useClipboardHotkeys`. Mismo molde para los nuevos atajos.
- **Borrado de partida**: `deletePartida(chapterId, id)` (sin confirmación; el store
  limpia `openPartidaId` al borrar). Menú ⋮ borra directo.
- **Buscador**: `BuscarPartidas` con input `aria-label="Buscar partida en la obra"`.
- **Edición de campos**: `EditableNum`/`EditableText` comparten el mismo patrón
  display→input que `MedNum`/`MedComment`.

## A. Bug Tab→edición (núcleo)

### Diseño: «armar al Tab, abrir al foco» + vecino explícito
No se puede usar «abrir al recibir foco» a secas: rompería `useGridNav` (las flechas
mueven el foco entre celdas en reposo; si abrieran al enfocar, no se podría encadenar
flechas y dentro del input las flechas mueven el cursor). Por eso el abrir-al-foco se
**arma solo durante un Tab**.

Nuevo `src/hooks/editGridNav.ts` (puro, testeable):
```ts
let armed = false;
export const armNextEdit = () => { armed = true; };
export const consumeArmNextEdit = () => { const a = armed; armed = false; return a; };
/** Vecino editable (display [data-editcell]) en orden de campos del grid. */
export function neighborEditCell(from: HTMLElement, dir: 1 | -1): HTMLElement | null;
```
`neighborEditCell`: sube a `from.closest('[data-editgrid]')`, lista
`[data-editfield]` en orden DOM (= orden de tabulación deseado), localiza el campo
actual (`from.closest('[data-editfield]')`), y devuelve el `[data-editcell]` del
campo vecino (o `null` en los bordes).

En `MedNum`/`MedComment`:
- **input en edición** `onKeyDown`: añadir `Tab`/`Shift+Tab` → si hay vecino:
  `e.preventDefault(); armNextEdit(); target.focus();` (el `onBlur` actual confirma al
  moverse el foco; sin vecino, Tab nativo = sale del grid).
- **display en reposo** (`<button>`/`<span>`): añadir `onFocus={() => { if
  (consumeArmNextEdit()) start(); }}`. Las flechas (`useGridNav`) enfocan SIN armar →
  no abren. Solo el Tab arma → el vecino abre.

Marcadores (sin lógica nueva en el contenedor):
- Tabla (`DetailPanel.tsx`): `data-editgrid` en `div.medWrap`; `data-editfield` en
  cada `<td>` de campo (comentario + uds/largo/ancho/alto). `parcial` y la `X` de
  borrar NO se marcan → Tab los salta; al final de fila salta a la fila siguiente.
- Tarjetas (`MedCards.tsx`): `data-editgrid` en `medCardList`; `data-editfield` en el
  wrapper del comentario y en cada `MedField`.

### Extensión gateada a `EditableNum`/`EditableText`
Mismo patrón display→input. Se les añade la MISMA lógica (Tab + onFocus), pero
`neighborEditCell` devuelve `null` si el control no está dentro de un `[data-editgrid]`
→ **no cambia el comportamiento fuera de los grids marcados** (precio en fila, título,
etc. siguen igual). Así las rejillas de Justificación de precio y Certificación pueden
sumarse luego SOLO añadiendo marcadores (sin tocar componentes). En este plan se
**cablea solo la medición**; las otras quedan listas para opt-in.

### Casos límite
- Primer/último campo: sin vecino → Tab/Shift+Tab nativo (sale del grid).
- Fila única / grid vacío: sin `[data-editfield]` → no-op.
- Foco perdido al recrear el nodo (button→input): igual que el flujo de click actual
  (el `useEffect` con `select()` reenfoca el input); por eso reusa `start()`.
- `prefers-reduced-motion`: no aplica (sin animación).

## B. Atajos de teclado globales

Nuevo `src/hooks/useAppHotkeys.ts` (molde de `useClipboardHotkeys`: `window`
keydown, guardas `inEditableField`/modal/vista), montado UNA vez en `App`.

Conjunto propuesto (a confirmar en el gate):
1. **Foco al buscador** — `Ctrl/⌘+K` y `/` (este último solo si `!inEditableField()`).
   Señal vía store: nueva acción `focusSearch()` + `searchFocusNonce`; `BuscarPartidas`
   enfoca su input al cambiar el nonce (como `revealNonce`). Desacopla del selector.
   *(Móvil: el sidebar va en drawer cerrado → el input no está montado; Ctrl+K es de
   escritorio. Limitación anotada, no bloqueante.)*
2. **Borrar partida seleccionada** — `Supr`/`Delete` cuando hay `openPartidaId`, vista
   presupuesto, sin modal y foco fuera de campo. **Con confirmación** (`window.confirm`):
   una tecla fácil de pulsar sin querer y SIN deshacer en una herramienta de dinero.
   *(Decisión de seguridad → gate.)* Necesita el `chapterId` de la partida abierta:
   helper que escanee el `PartidasMap` (la clave es el capítulo).
3. **Esc** — si hay `openPartidaId` y el foco NO está en un campo: cerrar/deseleccionar
   la partida (los inputs/buscador ya gestionan su propio Esc; este es el global).
4. *(Extra, a confirmar)* **Ctrl/⌘+Enter** con partida abierta y pestaña Medición:
   añadir línea de medición. Si no entra, va a TODOS.md.

Descubribilidad (design): pista en el placeholder del buscador
(«Buscar partida… (Ctrl K)»), y sufijo «(Supr)» en el ítem «Eliminar partida» del
menú ⋮. Sin un overlay de ayuda por ahora (deferido).

## Plan de test
- `editGridNav`: `neighborEditCell` con DOM montado (tabla mock con `data-editgrid`/
  `data-editfield`): siguiente/anterior/borde; `armNextEdit`/`consume` (consume una vez).
- Componente medición (`DetailPanel` tabla): entrar en una celda, `Tab` → la siguiente
  celda pasa a `<input>` (editing) y NO la `parcial`/borrar; `Shift+Tab` vuelve; en el
  borde, Tab no preventDefault (queda en display). Repetir en `MedCards`.
- `useGridNav` sigue verde (flechas no abren edición: foco sin armar).
- `useAppHotkeys`: Ctrl+K/`/` enfocan buscador (nonce); Supr borra con confirm
  (mock `window.confirm`), respeta guardas (en campo/modal/otra vista → no borra);
  Esc deselecciona. Guard: `/` dentro de un input no se captura.

## Archivos
- Nuevos: `src/hooks/editGridNav.ts` (+test), `src/hooks/useAppHotkeys.ts` (+test).
- Editados: `MedCells.tsx` (Tab+onFocus en `MedNum`/`MedComment`), `DetailPanel.tsx`
  (marcadores tabla), `MedCards.tsx` (marcadores tarjetas), `EditableNum.tsx`/
  `EditableText.tsx` (Tab+onFocus gateado), `store/obraStore.ts`
  (`focusSearch`/`searchFocusNonce` + helper chapterId-de-partida),
  `BuscarPartidas.tsx` (foco por nonce + placeholder), `App.tsx` (montar hook),
  `PartidaMenu.tsx` (pista «Supr»). ~12 archivos, sin infraestructura nueva.

## NO en alcance (a TODOS.md)
- Tab→edición en las rejillas de Justificación de precio y Certificación. **NO es
  «solo marcadores»** (Codex): `PriceJustif` usa `UdSelect`, que ya lleva
  `data-editcell` pero no participaría del flujo. Requiere un contrato de celda
  editable común → diseño aparte.
- Deshacer/rehacer global. (El borrado seguro se resuelve en el gate, ver abajo.)
- Reordenar líneas de medición por teclado.

---

## GSTACK REVIEW REPORT (autoplan · UI scope sí · DX no)

Voces: subagente eng + subagente design + Codex eng (3/3 ejecutadas, read-only).
CEO/DX: N/A (feature de usuario final, pedido explícito).

### Consenso ENG (CONFIRMED = ≥2 voces)
| Hallazgo | Sev | Consenso | Acción |
|---|---|---|---|
| `MedNum`/`MedComment` hacen `select()` pero NO `focus()` → Tab abriría el input SIN foco (el bug original disfrazado) | CRÍTICO | subagente+Codex | AUTO-FIX: efecto `focus()+select()` (como `EditableText`) |
| Flag `armed` module-level se queda colgado → aperturas espurias en cualquier celda | CRÍTICO | subagente+Codex | AUTO-FIX: token con caducidad (~150ms) + nodo-destino esperado + **scope por root** (WeakMap), reset en focusout |
| `findPartidaById` descarta la clave → no da `chapterId` para `deletePartida` | ALTO | subagente+Codex | AUTO-FIX: helper nuevo `Object.entries` → `{chapterId, p}` |
| Supr «fuera de campo» sigue incluyendo celdas `[data-editcell]`, botones, menús → borra la partida con el foco en una celda de medición | CRÍTICO | design+Codex | AUTO-FIX: exigir foco en superficie segura (no `[data-editgrid]`, no interactivo vía `composedPath`), `e.repeat` guard |
| Esc global doble-maneja (cierra dropdown/drawer Y deselecciona en un golpe) | ALTO | design+Codex | AUTO-FIX: Esc en pila — no-op si hay UI transitoria abierta (`[role=listbox]`/dialog/drawer); orden referencia→partida |
| Generalizar a `EditableNum`/`EditableText` por atributo DOM es «spooky» e incompleto (`UdSelect`) | MEDIO | subagente+Codex | AUTO-DECIDE: **acotar a la medición** (MedNum/MedComment), helper root-scoped; quitar la promesa de opt-in por marcadores |
| Tests jsdom con `fireEvent` no prueban foco real | MEDIO | subagente+Codex | AUTO-DECIDE: `@testing-library/user-event` (`user.tab()` + `toHaveFocus()`) |
| Filas de medición keyed por índice; commit por índice | MEDIO | Codex | AUTO-FIX parcial: `key={l.id}` en los map (reconciliación estable). Commit por índice se mantiene (no hay reorden durante la edición; `addMedLine` añade al final) |
| `Ctrl+Enter` añadir-línea no cabe en hook global (estado de pestaña local) | BAJO | Codex | AUTO-DECIDE: ese atajo vive en `DetailPanel`, no en el hook global |
| Guardas de hotkey duplicadas | BAJO | Codex | AUTO-DECIDE: extraer `hooks/hotkeyGuards.ts` compartido |

### Consenso DESIGN — la promesa «hoja de cálculo» está a medias
| Hallazgo | Sev | Acción |
|---|---|---|
| Falta **Enter** (debería bajar a la misma columna, fila siguiente) | CRÍTICO | → GATE (semántica de Enter es decisión de gusto) |
| **Tab/Enter en la última celda no crea fila nueva** (rompe el bucle de entrada rápida) | CRÍTICO | EXPANSIÓN en radio <1d (P1/P2) → incluir; autofocus a la fila nueva (nonce/efecto) |
| Borrado con `window.confirm`: seguro pero rompe el flujo de teclado e incoherente con el menú ⋮ (que borra sin confirmar) | ALTO | → GATE (modelo de seguridad de borrado) |
| Descubribilidad: placeholder+sufijo no bastan; tooltips sistemáticos + cheatsheet `?` | ALTO | tooltips AUTO-INCLUIDOS; cheatsheet `?` → GATE (alcance) |
| Foco visible fuerte en celda en reposo; Esc devuelve foco a la celda; autofocus al añadir línea | MEDIO | AUTO-INCLUIR (barato) |
| `/` ambiguo en teclado español; `Ctrl+K` solo basta | MEDIO | AUTO-DECIDE: **quitar `/`**, dejar `Ctrl/⌘+K` |
| Tarjetas (móvil): Enter = siguiente campo (no hay columnas) | MEDIO | AUTO-NOTA |

### Temas cross-fase
- **Identidad por índice en mediciones** (eng) ↔ **estados de foco al añadir/borrar filas** (design): ambos apuntan a que los flujos de teclado que insertan/borran filas son el terreno frágil. Mitigado acotando el reorden (añadir al final) + `key={l.id}`.
- **Seguridad del borrado** sale en design (UX) y Codex (scope del atajo): el atajo Supr es a la vez un problema de alcance de foco (AUTO-FIX) y de modelo de confirmación (GATE).

### Decision Audit Trail (auto-decididas)
| # | Fase | Decisión | Clase | Principio |
|---|---|---|---|---|
| 1 | Eng | `focus()+select()` en MedNum/MedComment | Mech | P1 correctud |
| 2 | Eng | Arm-flag con token+caducidad+nodo+root-scope, reset en focusout | Mech | P1 |
| 3 | Eng | Helper `findPartidaWithChapter` (Object.entries) | Mech | P1 |
| 4 | Eng | Supr: superficie segura (no editgrid/interactivo) + e.repeat | Mech | P1 seguridad |
| 5 | Eng | Esc en pila, no-op con UI transitoria | Mech | P1 |
| 6 | Eng | Acotar a medición; sin generalizar a Editable* | Scope− | P3/P5 (Codex «simpler») |
| 7 | Eng | `user-event` para tests de foco | Mech | P1 |
| 8 | Eng | `key={l.id}` en mediciones | Mech | P5 |
| 9 | Eng | Ctrl+Enter en DetailPanel; guardas en `hotkeyGuards.ts` | Mech | P4 DRY |
| 10 | Design | Tab/Enter en última celda → crea fila + autofocus | Scope+ | P1/P2 (core del caso de uso) |
| 11 | Design | Quitar `/`, dejar Ctrl/⌘+K | Mech | P5 |
| 12 | Design | Foco visible fuerte + Esc reenfoca celda + autofocus al añadir | Scope+ | P1 (<1d, en radio) |

### A decidir (GATE — tuyas, no auto-decididas)
- **D1 Semántica de Enter** en celda de medición.
- **D2 Modelo de borrado con Supr** (confirm / deshacer / sin red).
- **D3 Cheatsheet de atajos `?`** (incluir ahora vs solo tooltips).
