# DESIGN.md — Sistema de diseño Concreta · Mediciones

Fuente de verdad visual. Portado verbatim de `design_handoff_concreta_mediciones/concreta/tokens.css` + README del handoff. Todo el trabajo de UI calibra contra esto. Las 7 capturas en `design_handoff_concreta_mediciones/screenshots/` son la referencia hi-fi.

## Identidad
Marca **Concreta** (mismo sistema que "Concreta FEM3D"). Tema **oscuro por defecto** + claro. Tipografía **Geist Sans** (400/500/600) para UI, **Geist Mono** (400/500) para números/códigos, siempre con `font-variant-numeric: tabular-nums`. Acento sky-blue. Estética de herramienta profesional densa pero legible, no SaaS genérico.

## Tokens — DARK (defecto)
`--bg-primary #0b1220` · `--bg-surface #111a2d` · `--bg-elevated #1a2540` · `--border-main #22304d` · `--border-sub #1a2540` · `--text-primary #f8fafc` · `--text-secondary #94a3b8` · `--text-disabled #475569` · `--accent #38bdf8` · `--accent-hover #0ea5e9` · `--on-accent #04121f` · `--state-ok #22c55e` · `--state-warn #f59e0b` (retención, P.C.) · `--state-danger #ef4444` (error/destructivo: fallo de guardado, error de import, confirmaciones de borrado) · `--state-mat #2dd4bf` (MAT) · `--state-mq #a78bfa` (MQ, BC3, BASE) · `--state-neutral #64748b` · `--dot #22304d`.

## Tokens — LIGHT
`--bg-primary #f8fafc` · `--bg-surface #ffffff` · `--bg-elevated #f1f5f9` · `--border-main #cbd5e1` · `--border-sub #e2e8f0` · `--text-primary #0f172a` · `--text-secondary #475569` · `--text-disabled #94a3b8` · `--accent #0284c7` · `--accent-hover #0369a1` · `--on-accent #ffffff` · `--state-ok #16a34a` · `--state-warn #d97706` · `--state-danger #dc2626` · `--state-mat #0d9488` · `--state-mq #7c3aed`.

> **Ramo de estados** = escala Tailwind 500/600 (dark/light): ok=green, warn=amber, danger=red. `warn` (ámbar) es informativo/atención (retención, P.C.); `danger` (rojo) es error/destructivo. No mezclar.

## Tokens — compuestos (un solo origen)
`--scrim rgba(3,8,20,.5)` (velo de modal/drawer) · `--ring-accent 0 0 0 2px color-mix(accent 28%)` (anillo de foco de edición inline) · `--accent-soft` = accent 8–10%. Utilidad `.tap-target`: en `pointer: coarse` expande el área táctil a 44px con un `::before` invisible, sin agrandar el control (checkbox de certificar, kebab ⋮).

- `--accent-soft` = accent al 8–10% (fondos de selección/hover).
- Badges de recurso: fondo `color-mix(tipo 13%, transparent)` + color del tipo + punto 5px. MO=warn, MQ=mq, MAT=mat, %CI=neutral.
- Tema vía `data-theme="dark|light"` en `<html>`. Acento configurable vía `--accent`.

## Escala y forma
- Tipografía: H1 23–25/600 (−0.02em) · `.sec-head` 10/600 caps (ls .11em) · cuerpo 12.5–13 · tabla 12–13 · badges 9.5–11 · barra estado 11 mono. `.caps` = uppercase + ls .09em.
- Radios: botones/inputs 6 · chips 4–5 · tarjetas/paneles 9–12 · píldoras 20 · iconos 6–8.
- Sombras: `--shadow-panel` (sutil) · `--shadow-float` (popovers/modales/drawer).
- Alturas fijas: TopBar 48 · StatusBar 24 · BottomTabBar 54 · botones 30–34 · inputs 34 · icon-btn 30 · Sidebar 286 · panel Referencia 320–640.
- Transiciones: `.t150` 150ms ease-in-out · `.tcol` 150ms. Entrada `cubic-bezier(.22,1,.36,1)`.
- `.dot-grid`: `radial-gradient(circle, var(--dot) 1px, transparent 1px)` size 24px. Firma visual de Concreta.

## Reglas de interacción
- Edición inline: click sobre valor → input/textarea con anillo accent. Enter confirma, Esc cancela. Números formato español (miles punto, decimales coma).
- Animaciones gated en `prefers-reduced-motion: no-preference`, con el estado final visible como base (no romper PDF/print).
- `.no-print` se oculta al imprimir.

## Breakpoints
móvil <760 · tablet 760–1023 · desktop ≥1024 · split Referencia ≥1100 · tabla→tarjetas si ancho útil <780. Clases `.hide-lg`(<1320) `.hide-md`(<1180) `.hide-sm`(<1080) `.hide-xs`(<480).

## Iconos
Set tipo lucide (stroke 1.7). En producción: **lucide-react**.

## Principios de estados (añadidos en revisión de diseño)
Empty/error/loading no son afterthoughts: ver `IMPLEMENTATION_PLAN.md` → "Estados de UI de M1". Todo estado nuevo usa estos tokens; nada de gris genérico fuera de la paleta.
