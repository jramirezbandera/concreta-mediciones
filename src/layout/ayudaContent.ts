/* ===========================================================================
   ayudaContent — contenido del Centro de Ayuda como DATOS (no JSX disperso), para
   mantenerlo editable y testeable y evitar duplicar copy. El centro ENLAZA las
   acciones (no re-explica el paso 1 con texto propio); los `go`/`done` los resuelve
   `AyudaCenter`.
   =========================================================================== */
import type { IconName } from '../components';

export type HelpTab = 'inicio' | 'funcionalidades' | 'atajos';
export type GoView = 'import' | 'presupuesto' | 'certificaciones' | 'resumen';

/** Paso de los "Primeros pasos". `done` = clave de progreso (se marca hecha según
 *  el estado real de la obra); `go` = vista a la que lleva el botón. */
export interface OnboardingStep {
  title: string;
  desc: string;
  done?: 'obra' | 'partidas' | 'medicion' | 'coefK' | 'cert';
  go?: GoView;
  goLabel?: string;
}

export const STEPS: OnboardingStep[] = [
  {
    title: 'Crea o importa una obra',
    desc: 'Importa un presupuesto .bc3 (Presto, Arquímedes, CYPE…) o crea la estructura de capítulos en blanco.',
    done: 'obra',
    go: 'import',
    goLabel: 'Importar',
  },
  {
    title: 'Añade capítulos y partidas',
    desc: 'Organiza la obra en capítulos y subcapítulos. Añade partidas de cero o cópialas desde Referencia.',
    done: 'partidas',
    go: 'presupuesto',
    goLabel: 'Ir al presupuesto',
  },
  {
    title: 'Mide cada partida',
    desc: 'Abre una partida y añade líneas de medición (uds × largo × ancho × alto). Encadena celdas con Tab y baja con Enter.',
    done: 'medicion',
  },
  {
    title: 'Ajusta el presupuesto',
    desc: 'Cuadra el PEM a tu cifra objetivo con el coeficiente K (rebaja o alza de adjudicación).',
    done: 'coefK',
  },
  {
    title: 'Certifica por periodos',
    desc: 'Crea certificaciones y marca lo ejecutado a origen, por líneas, con precios contradictorios.',
    done: 'cert',
    go: 'certificaciones',
    goLabel: 'Ir a certificaciones',
  },
  {
    title: 'Exporta',
    desc: 'Genera .bc3 (FIEBDC-3), PDF, Excel o Word desde el botón Exportar de la barra superior.',
  },
];

export interface Feature {
  icon: IconName;
  title: string;
  desc: string;
}

export const FEATURES: Feature[] = [
  {
    icon: 'ruler',
    title: 'Medición por líneas',
    desc: 'Líneas uds × largo × ancho × alto con parciales; el total alimenta la cantidad de la partida en vivo.',
  },
  {
    icon: 'split',
    title: 'Referencia',
    desc: 'Abre una base de precios u otra obra en paralelo y copia partidas (o capítulos enteros) a la tuya.',
  },
  {
    icon: 'clipboardCheck',
    title: 'Certificaciones',
    desc: 'Certifica por periodos y por líneas, con retención y precios contradictorios; documento reproducible.',
  },
  {
    icon: 'download',
    title: 'Exportar',
    desc: '.bc3 FIEBDC-3 para Presto/Arquímedes, además de PDF, Excel y Word.',
  },
];

export interface ShortcutRow {
  keys: string[];
  label: string;
}
export interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

/** Grupos de atajos. `mod` = "Ctrl" o "⌘" según la plataforma. */
export function shortcutGroups(mod: string): ShortcutGroup[] {
  return [
    {
      title: 'General',
      rows: [
        { keys: [mod, 'K'], label: 'Buscar partida en la obra' },
        { keys: ['Supr'], label: 'Eliminar la partida seleccionada (con deshacer)' },
        { keys: ['Esc'], label: 'Cerrar referencia / deseleccionar partida' },
        { keys: [mod, 'C'], label: 'Copiar la partida seleccionada' },
        { keys: [mod, 'V'], label: 'Pegar en el capítulo/subcapítulo activo' },
        { keys: ['?'], label: 'Abrir esta ayuda' },
      ],
    },
    {
      title: 'Líneas de medición',
      rows: [
        { keys: ['Tab'], label: 'Ir a la celda siguiente y editarla' },
        { keys: ['Shift', 'Tab'], label: 'Ir a la celda anterior' },
        { keys: ['Enter'], label: 'Bajar en la misma columna' },
        { keys: [mod, 'Enter'], label: 'Añadir línea nueva' },
        { keys: ['Esc'], label: 'Cancelar la edición de la celda' },
      ],
    },
  ];
}
