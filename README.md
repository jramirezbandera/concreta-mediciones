# Concreta · Mediciones

[![Deploy](https://github.com/jramirezbandera/concreta-mediciones/actions/workflows/deploy.yml/badge.svg)](https://github.com/jramirezbandera/concreta-mediciones/actions/workflows/deploy.yml)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-149eca.svg?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 7](https://img.shields.io/badge/Vite-7-646cff.svg?logo=vite&logoColor=white)](https://vite.dev)

Aplicación web para **mediciones, presupuesto y certificación de obra**. Organiza el
trabajo en un árbol de capítulos y partidas con líneas de medición, justificación de
precios, resumen económico y certificaciones por periodos, con exportación de listados
e intercambio estándar **FIEBDC-3 (.bc3)**.

Funciona **100 % en el navegador**: sin servidor ni cuenta. La obra se guarda en local
(IndexedDB) y se exporta/importa como fichero.

## Características

- **Presupuesto en árbol** — capítulos y subcapítulos a N niveles, partidas con
  unidad, rendimiento y precio; numeración automática estilo Arquimedes/CYPE.
- **Mediciones detalladas** — líneas con comentario, unidades, dimensiones (largo ×
  ancho × alto) y fórmulas; el total se propaga al presupuesto.
- **Justificación de precios** — descomposición de partidas (mano de obra, materiales,
  maquinaria) con edición *copy-on-write* sobre el banco de precios.
- **Coeficiente K** — escala global de precios unitarios para cuadrar el PEM a una
  cifra objetivo.
- **Resumen económico** — PEM, gastos generales, beneficio industrial, IVA y PEC.
- **Certificaciones** — certificación por periodos marcando líneas o introduciendo el
  porcentaje ejecutado, con desglose por capítulo.
- **Referencia / bancos de precios** — panel para navegar bancos `.bc3` y copiar
  partidas (o partidas sueltas del Generador de Precios de CYPE) al presupuesto,
  arrastrando o con preflight de colisiones.
- **Importar / Exportar** — importación y exportación FIEBDC-3 (`.bc3`) compatible con
  Presto, CYPE/Arquimedes y similares; exportación de listados a **PDF**, **Excel
  (.xlsx)** y **Word (.docx)**.
- **Multi-obra y copia de seguridad** — cambio entre obras y backup/restauración del
  proyecto completo.
- **UI adaptable** — escritorio y móvil, tema claro/oscuro, atajos de teclado y centro
  de ayuda integrado.

## Stack

Vite 7 · React 19 · TypeScript · Zustand · Immer · CSS Modules · IndexedDB
(`idb-keyval`) · Vitest. Exportación con `write-excel-file` (XLSX) y `docx` (DOCX); el
intercambio FIEBDC-3 usa un parser forkado en `src/vendor/bc3` y un writer propio.

## Estructura

```text
src/
  core/         Dominio puro: medición, precios, certificación, FIEBDC-3 (.bc3)
  store/        Estado de la obra (Zustand + Immer) y selectores
  persist/      Persistencia en IndexedDB, hidratación y transferencia
  features/     presupuesto · certificaciones · resumen · referencia ·
                importar · exportar · obra · print
  layout/       TopBar, sidebar, drawer, barras de estado
  components/   Primitivas de UI
  hooks/        Hooks compartidos (atajos, breakpoints, tema…)
  vendor/bc3/   Parser FIEBDC-3 forkado
public/         Assets estáticos
docs/           Documentación, diseño y planes
.github/        Workflow de deploy a GitHub Pages
```

## Desarrollo

Requiere **Node 22+**.

```bash
npm install
npm run dev      # servidor de desarrollo (Vite)
npm run build    # typecheck (tsc -b) + build de producción
npm run preview  # servir el build localmente
npm test         # tests (Vitest)
npm run lint     # ESLint
npm run format   # Prettier
```

La galería de primitivas de UI está en `/#sandbox`.

## Deploy en GitHub Pages

El workflow de GitHub Actions (`.github/workflows/deploy.yml`) construye la app y
publica `dist/` en GitHub Pages al hacer push a `main`. En el repositorio, configura
**Settings → Pages → Source: GitHub Actions**. El `base` de Vite se ajusta solo al
nombre del repositorio durante el build de Pages.

## Licencia

Distribuido bajo la **[PolyForm Noncommercial License 1.0.0](LICENSE)**. Se permite
usar, copiar, modificar y distribuir el software para **cualquier fin no comercial**
(uso personal, investigación, educación, organizaciones sin ánimo de lucro…). El **uso
comercial no está permitido** sin una licencia aparte del autor.

Copyright © Javier Ramírez Bandera.
