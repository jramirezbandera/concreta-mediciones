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
app/                                   Aplicación Vite (próximamente)
```
