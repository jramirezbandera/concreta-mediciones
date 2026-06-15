# Plan — Edición de partidas estilo Arquímedes/CYPE (copy-on-write)

Estado: plan revisado (eng-review). Pendiente de implementar.
Origen: "en la justificación de precio, el tipo y el código no son editables" → reencuadrado
a copy-on-write a nivel de partida y de recurso.

## Objetivo

Permitir editar **tipo** y **código** del descompuesto (hoy de solo lectura) y, sobre todo,
hacerlo con la semántica de Arquímedes/CYPE: **editar un concepto referenciado (de base o
compartido) no pisa el original — crea una copia**.

## Decisiones cerradas (con el usuario)

| # | Decisión | Elegido |
|---|----------|---------|
| D1 | Editar **código** de una línea | Re-apuntar: adoptar si el código existe en el banco / crear si no (estilo Presto) |
| D2 | Editar **tipo** | Desplegable MO/MQ/MAT (sin %CI). **Banco = fuente de verdad**: el badge no-CI lee `recursos[code].type`; la edición escribe al banco |
| C1 | Partida "protegida" (dispara copia) | Las marcadas `fromBase` (vienen de `.bc3` o copiadas de Referencia/otra obra) |
| C2 | Editar un **recurso compartido** (usage≥2) | **Preguntar**: copiar / editar en todas / cancelar |
| C3 | Alcance del aviso en partida base | **Todas** las ediciones (precio, desc, ud, rendimiento, tipo, código, alta/baja de línea) |
| C4 | Qué pasa con la partida al "crear copia" | Se convierte en **tu copia en el sitio** (se quita la marca BASE; la base sigue en Referencia) |
| C5 | Doble condición (partida base + recurso compartido) | **Un solo cuadro combinado**, consciente del contexto |
| C6 | Fricción de "preguntar cada vez" | Casilla **"no volver a preguntar en esta partida"** (recuerda la elección mientras estés en esa partida) |

## Modelo conceptual: el "COW gate"

Toda intención de editar el descompuesto/precio pasa por una puerta que clasifica el cambio
según **a quién afecta**, no según el campo:

```
  EDICIÓN sobre una partida P, recurso R (code)
        │
        ▼
  ¿La edición MUTA el banco compartido?           ¿Es local a la partida?
  precio / desc / ud / tipo                        rendimiento (Item.cantidad)
  (R con usage ≥ 2)                                código re-apuntar
        │                                          alta/baja de línea
        ▼                                                │
  [protección RECURSO]                             [no toca a nadie más]
        │                                                │
        ├───────────────┬────────────────────────────────┘
        ▼               ▼
  ¿P.fromBase?     ¿P.fromBase?
   sí → combina     sí → aviso simple "crear copia"
   con aviso        no → aplicar directo
   de partida
        │
        ▼
  ┌──────────────────────── CUADRO ÚNICO (contextual) ────────────────────────┐
  │  Copiar   → si fromBase: quitar BASE (copia en sitio)                       │
  │             si recurso compartido: forkResource → code privado clonado     │
  │             aplicar la edición sobre lo privado                             │
  │  Editar todas → quitar BASE; aplicar la edición sobre el banco compartido  │
  │  Cancelar → abortar                                                         │
  │  [ ] no volver a preguntar en esta partida  (recuerda copiar|todas)        │
  └────────────────────────────────────────────────────────────────────────────┘
```

Reglas derivadas:
- **Partida tuya (no fromBase) + recurso privado (usage 1):** edición directa, sin cuadro (igual que hoy).
- **rendimiento** y **código re-apuntar** nunca mutan el banco → solo pueden disparar el aviso *de partida base*, nunca el de recurso compartido.
- **`forkResource`** clona `recursos[oldCode]` bajo un código nuevo (`uid('r')`) y re-apunta **solo** la línea de esta partida; las demás quedan intactas.
- "Editar todas" sobre `fromBase` también quita la marca BASE (la partida ha sido tocada).

## Cambios de modelo (datos)

- **Nada nuevo serializado.** Se reutiliza `Partida.fromBase`.
- **Estado transitorio de UI** (no entra en `toSerializable`): `cowChoice: Record<partidaId, 'copy' | 'all'>` para la casilla "no volver a preguntar". Se limpia al cerrar la partida / cambiar de obra.
- `Item.type` deja de ser fuente de verdad del tipo no-CI (pasa a vestigial; lo sigue usando el check `isCI` y la semilla/export). El render no-CI leerá `recursos[code]?.type ?? it.type`.

## Acciones de store (nuevas / tocadas)

```
forkResource(chapterId, partidaId, itemIndex): string   // clona recurso → code privado, re-apunta la línea, devuelve el nuevo code
editItemCode(chapterId, partidaId, itemIndex, newCode)   // D1 adoptar-o-crear; recalcula precio
editItemType(chapterId, partidaId, itemIndex, newType)   // D2 escribe recursos[code].type (MO|MQ|MAT)
clearFromBase(chapterId, partidaId)                       // "copia en sitio" = fromBase=false (helper explícito)
setCowChoice(partidaId, choice) / clearCowChoice()        // memoria de la casilla C6
```
Las existentes (`editRecurso`, `editItemCantidad`, `addItem`, `deleteItem`) NO cambian su
lógica de datos; se enrutan a través del gate en la capa UI (siguen poniendo `fromBase=false`).

## Capa UI

- **Hook `useCowGuard()`** — recibe la intención de edición + metadatos (partida, itemIndex, si muta banco). Decide: directo, aviso simple, o cuadro combinado. Ejecuta la salida (copiar/forkResource/editar-todas) y luego aplica la edición. Centraliza la regla para que `PriceJustif` y `PriceJustifCards` no la dupliquen.
- **`CowDialog`** — modal combinado con las 3 salidas + casilla recordar. Reutiliza `components/Modal`.
- **`TypeSelect`** — desplegable MO/MQ/MAT análogo a `UdSelect`.
- **`PriceJustif.tsx` / `PriceJustifCards.tsx`:**
  - Celda **Tipo** (no-CI): `<Badge>` → `<TypeSelect>`; badge lee `recursos[code]?.type`.
  - Celda **Código** (no-CI): `<span>` → `<EditableText>` → `editItemCode` vía gate.
  - precio/desc/ud/rendimiento/alta/baja: pasan por `useCowGuard`.
  - **%CI** sigue siendo de solo lectura en tipo y código (no se toca su semántica).

## What already exists (reusar, no reconstruir)

- `Partida.fromBase` / `baseSource` + chip "BASE" — ya marcan el origen; hoy se borran en silencio al editar ([obraStore.ts:1010](../src/store/obraStore.ts#L1010), [1021](../src/store/obraStore.ts#L1021)). Reusar como disparador.
- `selectRecursoUsage` + `SharedChip` — ya calculan/avisan de compartidos. Reusar para decidir la protección de recurso.
- `editRecurso` ya propaga a todas las partidas ([obraStore.ts:994-995](../src/store/obraStore.ts#L994-L995)) → es exactamente la rama "editar en todas".
- `components/Modal`, `UdSelect`, `EditableText`, `EditableNum` — base de los controles nuevos.
- `precioSegunModo` — recálculo de precio tras editar; reusar en las acciones nuevas.

## NOT in scope (diferido, con motivo)

- **Recolección de conceptos huérfanos** del banco tras re-apuntar/forkar. Hoy `deleteItem` YA deja huérfanos ([obraStore.ts:1025-1032](../src/store/obraStore.ts#L1025-L1032)); un concepto sin uso es invisible y solo engorda el JSON. Se deja fuera para no ampliar el diff → **TODO** "limpiar conceptos sin uso".
- **%CI editable** (convertir líneas a/desde % sobre base). Caso de cálculo más delicado; fuera por decisión D2.
- **Editar tipo/código de la propia partida** (su `code`/`pos`), no del descompuesto. No es lo pedido.
- **Vínculo vivo con la base** (re-sincronizar si la base cambia). La base no es un enlace vivo en esta app.

## Failure modes (por codepath nuevo)

| Codepath | Fallo realista | ¿Test? | ¿Error handling? | ¿Visible? |
|----------|----------------|--------|------------------|-----------|
| `editItemCode` adopta código existente | la fila cambia de desc/ud/precio "de golpe" y sorprende | sí (unit) | el SharedChip + recálculo reflejan el cambio | visible |
| `editItemCode` crea código nuevo | colisión con `uid` (improbable) / code vacío | sí | rechazo si vacío | n/a |
| `forkResource` | clonar y NO re-apuntar → la edición pisa el compartido igual | sí (unit, **regresión clave**) | — | sería silencioso → **cubrir con test** |
| `editItemType` compartido | escribir solo una copia → badge/export divergen (Issue 1) | sí | banco = fuente de verdad lo evita | visible |
| `useCowGuard` "no preguntar" | recordar la elección equivocada toda la sesión | sí | scope por partida + reset al salir | visible |
| Cancelar en el cuadro | la edición se aplica a medias | sí | abortar antes de mutar | n/a |

Crítico: `forkResource` que no re-apunta es un fallo **silencioso** (parece que copiaste pero
editaste el compartido) → test de regresión obligatorio.

## Cobertura de tests (objetivo 100% de ramas nuevas)

```
[+] store/obraStore.ts
  ├── forkResource()
  │   ├── [GAP] clona recurso bajo code nuevo y re-apunta SOLO esta línea
  │   ├── [GAP] otras partidas con el code viejo quedan intactas   (REGRESIÓN)
  │   └── [GAP] recalcula precio (precioSegunModo)
  ├── editItemCode()
  │   ├── [GAP] adopta concepto existente (desc/ud/precio/tipo siguen)
  │   ├── [GAP] crea concepto nuevo arrastrando valores
  │   ├── [GAP] code vacío/igual → no-op
  │   └── [GAP] línea %CI → bloqueado
  ├── editItemType()
  │   ├── [GAP] escribe recursos[code].type (MO/MQ/MAT)
  │   └── [GAP] compartido: render de TODAS lee el nuevo tipo del banco
  └── clearFromBase() → [GAP] quita marca, no toca recursos

[+] hooks/useCowGuard.ts
  ├── [GAP] partida tuya + recurso privado → edición directa, sin cuadro
  ├── [GAP] partida fromBase → aviso; "copiar" quita BASE; "todas" quita BASE + muta banco
  ├── [GAP] recurso compartido → cuadro; "copiar" forka; "todas" editRecurso
  ├── [GAP] doble condición → UN cuadro combinado (C5)
  ├── [GAP] "no preguntar en esta partida" recuerda y omite el cuadro (C6)
  └── [GAP] cancelar → no muta nada

[+] features/presupuesto (render + interacción)
  ├── [GAP] celda Tipo es un desplegable (no-CI); %CI sigue badge
  ├── [GAP] celda Código es editable (no-CI); %CI sigue solo-lectura
  ├── [GAP] [→E2E ligero] editar precio en partida base abre el cuadro
  └── [GAP] badge no-CI lee recursos[code].type (fuente de verdad)

COVERAGE objetivo: 0/19 → 19/19 antes de cerrar
```

## Implementation Tasks

- [ ] **T1 (P1)** — store — `forkResource` + test de regresión "no pisa otras partidas".
  - Files: src/store/obraStore.ts, src/store/obraStore.test.ts
- [ ] **T2 (P1)** — store — `editItemCode` (adoptar/crear) + `editItemType` (banco fuente de verdad).
  - Files: src/store/obraStore.ts, src/store/obraStore.test.ts
- [ ] **T3 (P1)** — hook — `useCowGuard` (decisión directo/aviso/combinado + memoria por partida).
  - Files: src/hooks/useCowGuard.ts (+ test)
- [ ] **T4 (P1)** — UI — `CowDialog` (3 salidas + casilla recordar) sobre `components/Modal`.
  - Files: src/features/presupuesto/CowDialog.tsx
- [ ] **T5 (P2)** — UI — `TypeSelect` + celdas Tipo/Código editables en `PriceJustif` y `PriceJustifCards`, enrutando por el gate; badge lee del banco.
  - Files: src/features/presupuesto/PriceJustif.tsx, PriceJustifCards.tsx, src/components/
- [ ] **T6 (P2)** — tests de render/interacción (celdas editables, cuadro en base, %CI intacto).
- [ ] **T7 (P3, TODO)** — GC de conceptos sin uso del banco (cubre también el `deleteItem` actual).

## Punto abierto (recomendación, no bloqueante)

**DRY entre `PriceJustif.tsx` y `PriceJustifCards.tsx`.** Ya duplican el render de cada línea
(desc/ud/precio/rendimiento); este cambio ensancha el duplicado (tipo, código, cableado del
gate). Recomiendo que **toda** la lógica de edición viva en `useCowGuard` y que ambas vistas
solo difieran en la maquetación (tabla vs tarjeta). Encaja con tu preferencia DRY y con
"hacer fácil el cambio antes de hacer el cambio". Alternativa: duplicar de forma consistente
y dejar la extracción como TODO. Mi voto: extraer ahora el hook (el coste con CC es bajo).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 3 issues (2 arch, 1 DRY), 1 critical gap (forkResource silencioso) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG reviewed — diseño acordado vía 10 decisiones (D1–D2, C1–C6). Listo para implementar tras confirmar el punto DRY abierto. Pendiente opcional: design-review de `CowDialog`.

**UNRESOLVED DECISIONS:**
- DRY: extraer `useCowGuard` ahora vs duplicar en las dos vistas y dejar TODO (recomendado: extraer).
