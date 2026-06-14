# Plan · Quitar Sandbox + Centro de Ayuda / Onboarding

> Estado: REVISADO + **IMPLEMENTADO** (autoplan, 2026-06-14 · voces: subagente
> design + Codex). Decisiones de usuario: quitar solo el enlace Sandbox (ruta
> `#sandbox` oculta para dev) · onboarding a demanda (sin auto-abrir modal).
> Verificado: tsc + 576 tests (8 nuevos) + eslint + build en verde.
>
> Implementado: `layout/AyudaCenter.tsx` (+ `.module.css`, + test) reemplaza a
> `ShortcutsHelp`; contenido como datos en `layout/ayudaContent.ts`; entrada en
> `TopBar` (botón `?`, también móvil) + StatusBar ("Ayuda"); `?`→Atajos /
> botón→Primeros pasos; enlace "¿Primera vez?" en el estado vacío de obra; pista
> Tab/Enter en el vacío de medición; icono `help`. Sandbox: quitado el enlace,
> ruta `#sandbox` intacta.

## Premisa / problema

La StatusBar muestra un enlace **"Sandbox"** (`onSandbox` → `#sandbox` →
`features/sandbox/Sandbox.tsx`, galería de primitivas de UI para pruebas de dev).
Ya no aporta al usuario final y ocupa un sitio visible. A la vez, la app NO tiene
ayuda ni onboarding: un primerizo aterriza en estados vacíos ("Empieza tu primera
obra") sin una explicación de qué es la herramienta ni cómo se usa. La única ayuda
es la chuleta de **atajos** (`ShortcutsHelp`, recién añadida).

**Problema:** dar a un usuario nuevo un punto único de ayuda — qué es Concreta,
cómo empezar, qué puede hacer y qué atajos hay — sin un enlace dev que sobra.

## Qué ya existe (reuso)
- `ShortcutsHelp` (`layout/ShortcutsHelp.tsx`) — modal con la chuleta de atajos
  (usa `components/Modal`, secciones General + Medición). Se **amplía**, no se duplica.
- `Modal` (`components/Modal.tsx`) — focus-trap, Esc, role=dialog. Base del centro.
- Estados vacíos (`EmptyState`) en `PresupuestoView`/`CertificacionesView` — ya
  onboardean en contexto; el centro de ayuda los complementa, no los sustituye.
- Botón "Atajos" en `StatusBar` (`onHelp`) y tecla `?` (en `useAppHotkeys`) — pasan
  a abrir el **Centro de Ayuda** (la chuleta queda como una sección dentro).
- Cableado Sandbox: `App.tsx` (`isSandboxHash`/`goSandbox`/`leaveSandbox`/
  `setSandbox`/`hashchange`/`if (sandbox) return <Sandbox/>`), `StatusBar` (`onSandbox`).

## Diseño

### 1. Quitar el enlace Sandbox
- `StatusBar`: eliminar el bloque `onSandbox` (el devLink "Sandbox").
- `App`: quitar el paso de `onSandbox={goSandbox}` a la StatusBar. **La ruta dev
  `#sandbox` se mantiene oculta** (escribir el hash sigue abriendo el Sandbox para
  dev) → `goSandbox`/`isSandboxHash`/`Sandbox.tsx`/`useTweaks` se conservan, solo
  se retira el punto de entrada visible. (Alternativa borrado total → gate D1.)

### 2. Centro de Ayuda — `layout/AyudaCenter.tsx` (renombra/expande `ShortcutsHelp`)
Modal (reusa `components/Modal`) con navegación por **pestañas** (segmented, como
`DetailPanel`) y 4 secciones:
1. **Bienvenida** — qué es Concreta Mediciones (presupuestos, mediciones y
   certificaciones de obra; .bc3 FIEBDC para Presto/Arquímedes/CYPE). 2-3 frases +
   3 "tarjetas" de valor.
2. **Primeros pasos** — lista numerada de onboarding: (1) crea o importa una obra
   (.bc3 o capítulos en blanco), (2) añade capítulos/partidas, (3) mide con líneas
   (Tab/Enter encadenan), (4) ajusta el coeficiente K al PEM objetivo, (5) certifica
   por periodos, (6) exporta (.bc3/PDF/Excel/Word). Cada paso enlaza la vista
   correspondiente cuando aplica (botón "ir").
3. **Funcionalidades** — tarjetas breves con icono: Presupuesto, Medición,
   Referencia (copiar partidas de bases/otras obras), Certificaciones, Resumen,
   Exportar, Buscador (Ctrl+K), Multi-obra.
4. **Atajos de teclado** — el contenido actual de `ShortcutsHelp` (General + Medición).

- Estado local `tab`; arranca en **Bienvenida** (onboarding) si se abre "en frío",
  o en **Atajos** si se abrió con `?` desde un contexto de teclado. (Decisión de
  pestaña inicial → simple: siempre Bienvenida; `?` puede saltar a Atajos.)
- Contenido en una estructura de datos (array de secciones) para mantenerlo
  editable y testeable, no hard-coded en JSX disperso.

### 3. Punto de entrada
- StatusBar: el botón pasa de "Atajos" a **"Ayuda"** (icono `command`/`info`),
  `title="Ayuda y atajos (?)"`.
- Tecla `?` abre el centro (en Atajos). 
- (Opcional, gate D3) primer uso: abrir el centro automáticamente la primera vez
  (persistido en localStorage), o un "tip" sutil hacia el botón Ayuda.

## Estados y casos límite
- Móvil: el centro entra como bottom-sheet (`Modal compact`); las pestañas deben
  caber (scroll horizontal si hace falta). El botón Ayuda no está en la StatusBar
  en móvil (no se pinta) → punto de entrada móvil: tecla `?` no aplica sin teclado,
  así que hace falta un acceso táctil (p.ej. en el menú/drawer o en TopBar). → gate
  o auto-decidir: añadir acceso en el TopBar (icono ayuda) para móvil.
- Enlaces "ir a la vista" desde Primeros pasos: cierran el modal y cambian de vista.
- Sin obra (primerizo real): el centro funciona igual; Primeros pasos es justo lo
  que necesita.

## Plan de test
- `AyudaCenter`: render con las 4 pestañas; cambiar de pestaña muestra su contenido;
  la sección Atajos sigue mostrando los atajos (no se pierde cobertura del cheatsheet);
  Esc/cierre; `compact` (bottom-sheet).
- `useAppHotkeys`: `?` abre el centro (ya cubierto, ajustar al nuevo componente).
- `StatusBar`: ya NO renderiza "Sandbox"; renderiza "Ayuda".
- App: `#sandbox` sigue abriendo el Sandbox (ruta dev intacta) — o, si D1=borrado,
  que no rompa (sin referencias colgando).
- No romper los tests existentes de StatusBar/App.

## Archivos
- Nuevos: `layout/AyudaCenter.tsx` (+ `.module.css`, + test). Posible
  `core/ayuda.ts` (contenido como datos).
- Editados: `layout/StatusBar.tsx` (quitar Sandbox, renombrar botón a Ayuda),
  `App.tsx` (no pasar onSandbox; montar AyudaCenter en vez de ShortcutsHelp;
  acceso móvil en TopBar si se decide), `hooks/useAppHotkeys.ts` (`?` → centro),
  `TopBar.tsx` (acceso ayuda móvil, si aplica). Borra/renombra `ShortcutsHelp.tsx`.
- Si D1=borrado total: borrar `features/sandbox/`, `useTweaks`, y el cableado de
  `App.tsx` (`isSandboxHash`/`goSandbox`/`leaveSandbox`/`setSandbox`/hashchange).

## NO en alcance (a TODOS.md)
- Tour guiado interactivo (tooltips paso a paso sobre la UI real).
- Vídeos / GIFs incrustados.
- Ayuda contextual por vista (botón "?" por pantalla).
- i18n (la app es solo español por ahora).

---

## GSTACK REVIEW REPORT (autoplan · UI scope sí · DX no)
Voces: subagente design + Codex (design+eng). CEO/DX N/A (feature de usuario final).

### Consenso (CONFIRMED = ambas voces) → AUTO-DECIDIDO
| Hallazgo | Sev | Acción |
|---|---|---|
| Punto de entrada en la **StatusBar es invisible en móvil** (no se pinta) | CRÍTICO | AUTO-FIX: botón `?` "Ayuda" en `TopBar.actions` (todos los breakpoints). StatusBar mantiene acceso secundario en escritorio |
| **No auto-abrir** modal de bienvenida (el `EmptyState` ya onboardea; dos onboardings se taparían) | CRÍTICO | AUTO-DECIDE: solo a demanda; sin modal proactivo |
| Un modal a demanda **no onboardea solo**; el segundo paso (medir) es donde se pierde | CRÍTICO | AUTO-FIX (contextual, en radio): hint de teclado en `EmptyChapter` ("añade líneas y encadénalas con Tab/Enter") + enlace "¿Primera vez?" en el `EmptyState` de obra → abre el centro en Inicio |
| **3 pestañas, no 4** (Bienvenida se funde en Inicio) | ALTO | AUTO-DECIDE: Inicio (bienvenida breve + primeros pasos) · Funcionalidades · Atajos |
| Móvil: pestañas con scroll-x son poco descubribles | ALTO | AUTO-DECIDE: segmented en escritorio; en `compact` (bottom-sheet) secciones apiladas con scroll |
| **noUnusedLocals**: quitar `onSandbox={goSandbox}` deja `goSandbox` sin usar → rompe el build | ALTO | AUTO-FIX: quitar también `goSandbox` + la prop `onSandbox` |
| `?` debe abrir en **Atajos**; el botón en **Inicio** → estado `helpTab` en App | MEDIO | AUTO-FIX: `openHelp('inicio'|'atajos')`; sin persistir pestaña |
| Conectar con `EmptyState` y **no duplicar copy** | MEDIO | AUTO-FIX: contenido como datos en `layout/ayudaContent.ts` (no `core/`), action-ids no callbacks; el centro enlaza la acción, no la re-explica |
| Recortar Funcionalidades (8 tarjetas nadie las lee → 4 clave) | MEDIO | AUTO-DECIDE: Medición, Referencia, Certificaciones, Exportar |
| Icono: `info` no existe en el registro | BAJO | AUTO-DECIDE: añadir `help` (HelpCircle) al registro o reusar `command` |
| Tests al nivel de riesgo real (StatusBar, TopBar móvil, 3 pestañas, `?`→Atajos, EmptyState→Inicio) | MEDIO | AUTO-DECIDE plan de test |

### Bonus alto valor (auto-incluido, P1/P2, en radio)
- **Primeros pasos como checklist con estado**: marcar pasos hechos según la obra real
  (¿tiene capítulos? ¿líneas? ¿cert?) — onboarding de verdad, no un índice.

### Decisiones que quedan para ti (GATE)
- **D1 Sandbox**: borrar del todo (código + ruta `#sandbox` + `useTweaks`) vs solo
  quitar el enlace visible y mantener la ruta `#sandbox` oculta para dev. (Solo tú
  sabes si aún usas la galería de primitivas.)
- **D2 Onboarding proactivo la 1ª vez**: nada extra (botón siempre visible + enlace
  en el estado vacío) vs un "pulso" sutil one-time sobre el botón Ayuda (localStorage).
  *(El auto-abrir modal queda descartado por ambas voces.)*
