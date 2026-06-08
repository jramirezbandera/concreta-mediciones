# Concreta · Mediciones

Aplicación web para **mediciones, presupuestos y certificaciones de obra**: árbol de
capítulos y partidas con medición (largo × ancho × alto), justificación de precios con
banco de recursos compartido, resumen económico (PEM / GG+BI / IVA), certificaciones de
obra por periodos (a origen / esta certificación, precios contradictorios, retención) y
exportación de listados (PDF / Word / Excel) e intercambio **FIEBDC-3 (.bc3)**.

Parte de la marca **Concreta**: tema oscuro/claro, tipografía Geist y números monoespaciados.

## Estado

Reconstrucción de un prototipo de diseño de alta fidelidad
([`design_handoff_concreta_mediciones/`](design_handoff_concreta_mediciones/)) como
aplicación de producción en **Vite + React + TypeScript**.

- 📄 Plan de implementación por fases: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
- 🎨 Referencia de diseño y tokens: `design_handoff_concreta_mediciones/`

## Stack

Vite · React 18 · TypeScript · Zustand · CSS Modules · IndexedDB (Dexie) · lucide-react

## Estructura

```
design_handoff_concreta_mediciones/   Prototipo de diseño (referencia, no producción)
IMPLEMENTATION_PLAN.md                 Plan de implementación por fases
app/                                   Aplicación Vite + React + TS (F0 en marcha)
```

## Desarrollo

```bash
cd app
npm install
npm run dev      # servidor de desarrollo
npm run build    # typecheck (tsc) + build de producción
npm test         # Vitest
npm run lint     # ESLint
```

La página sandbox de primitivas está en `/#sandbox`.

**Estado:** F0 (cimientos y shell) completada — scaffolding, sistema visual
portado (tokens/fuentes), tema claro/oscuro, chrome responsive (TopBar/Sidebar/
StatusBar/BottomTabBar/Drawer), primitivas de UI y `core/money`. Siguiente: F1
(núcleo de dominio tipado y testeado).
