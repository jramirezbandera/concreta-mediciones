# Concreta - Mediciones

Aplicación web para **mediciones, presupuestos y certificaciones de obra**: árbol de
capítulos y partidas con medición, justificación de precios, resumen económico,
certificaciones por periodos y exportación de listados. También permite intercambio
**FIEBDC-3 (.bc3)**.

## Estado

Aplicación de producción en **Vite + React + TypeScript**, reconstruida desde un
prototipo de diseño de alta fidelidad.

- Plan de implementación: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- Referencia de diseño: [`docs/design_handoff_concreta_mediciones/`](docs/design_handoff_concreta_mediciones/)
- Spikes y validaciones: [`docs/spike/`](docs/spike/)

## Stack

Vite, React 19, TypeScript, Zustand, CSS Modules, IndexedDB (`idb-keyval`), Vitest y
lucide-react.

## Estructura

```text
src/                         Código fuente de la aplicación
public/                      Assets estáticos
.github/workflows/deploy.yml Deploy automático a GitHub Pages
docs/                        Documentación, diseño y spikes
```

La aplicación vive ahora en la raíz del repositorio. El material auxiliar queda en
`docs/` y no forma parte del build publicado.

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # typecheck + build de producción
npm test         # Vitest
npm run lint     # ESLint
```

La página sandbox de primitivas está en `/#sandbox`.

## Deploy en GitHub Pages

El workflow de GitHub Actions construye la app y publica `dist/` en GitHub Pages al
hacer push a `main`. En el repositorio de GitHub, configura **Settings > Pages >
Source: GitHub Actions**.
