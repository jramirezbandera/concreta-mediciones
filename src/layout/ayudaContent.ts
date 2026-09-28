/* ===========================================================================
   ayudaContent — contenido del Centro de Ayuda como DATOS (no JSX disperso), para
   mantenerlo editable y testeable y evitar duplicar copy. El centro ENLAZA las
   acciones (no re-explica el paso 1 con texto propio); los `go`/`done` los resuelve
   `AyudaCenter`.
   =========================================================================== */
import type { IconName } from '../components';
import { planosActivos } from '../features/planos/flag';

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

/** «Medir sobre planos» (§10 de la especificación): qué herramienta para qué
 *  partida, el ciclo, calibrar, una escala por página y las líneas retocadas. */
const MEDIR_SOBRE_PLANOS: Feature = {
  icon: 'plano',
  title: 'Medir sobre planos',
  desc: 'Botón «Planos»: adjunta el PDF, calibra cada página con una cota conocida y compruébala con otra (a más de 45° si se puede; si el texto del plano trae su escala, «E 1:50», y la cota cuadra con ella, esa es la comprobación y la escala se ajusta a la exacta), y mide con clic… Enter para cerrar la forma y Enter para aceptar el comentario: cada medida entra como línea de la partida abierta, con su «P1 · Salón» y de dónde sale. Qué herramienta para qué partida: por Unidades, Recuento; por Longitud, Longitud (o el perímetro de una Superficie o un Rectángulo); por Longitud × Anchura, Rectángulo (largo y ancho) o Longitud con la altura del paramento fija; por Superficie directa, Superficie o Rectángulo, o Longitud × altura para paramentos; por Peso, Longitud con el kg/m fijo o el perfil del comentario. Restar (D) mide huecos que descuentan. En Superficie y Rectángulo, el comentario propone el nombre de la estancia que lee dentro de la forma (escribe encima para cambiarlo); al calibrar, la etiqueta de la página («PB») sale del título del plano. Cada página tiene UNA escala: si la recalibras, Concreta pregunta si la anterior estaba mal y recalcula sus líneas en un paso de Deshacer (las retocadas a mano y las certificadas conservan su escala); para un detalle a otra escala, adjunta el PDF otra vez. «Añadir también a…» lleva la misma forma a otras partidas: el suelo de una estancia como su área en Solado, su perímetro en Rodapié o su perímetro × altura en Pintura. Una línea retocada a mano lleva «✎» en su marcador y en el plano; su marcador ofrece «Aceptar valores actuales» (ya no se recalcula) o «Desvincular del plano» (conserva los números); su número de la izquierda es «Ver en plano». El PDF se queda en este navegador. Para no perderlo, «Datos de la obra» → «Copia completa con planos (.zip)» guarda la obra con sus PDF y se restaura con «Importar copia»; la copia .json solo lleva el presupuesto (tus líneas sobreviven aunque se pierda el PDF: al volver a adjuntar el mismo PDF vuelven su escala y su capa).',
};

export const FEATURES: Feature[] = [
  {
    icon: 'ruler',
    title: 'Medición por líneas',
    desc: 'Líneas uds × largo × ancho × alto con parciales; el total alimenta la cantidad de la partida en vivo. «Medir por» cambia las columnas de cada partida (superficie directa, superficie × espesor, peso…). Las celdas admiten operaciones (5,57+3, 2×4,5, (12−0,3)/2) y perfiles, que valen su kg/m (IPE 300, HEB 200, UPN 120, Ø12; también IPE300*1,05): se ve el resultado y se guarda lo escrito. Midiendo por Peso, basta con nombrar el perfil en el comentario («Vigas IPE300») y el kg/m se rellena solo. Marca líneas con su casilla para copiarlas o cortarlas a otra partida, duplicarlas, subirlas o bajarlas y borrarlas en bloque; «Pegar N líneas», en el pie, las deja en la partida abierta. Lo copiado se pega también en Excel o Google Sheets, y un bloque copiado de una hoja de cálculo (comentario y casillas) se pega como líneas nuevas.',
  },
  {
    icon: 'split',
    title: 'Referencia',
    desc: 'Abre una base de precios u otra obra en paralelo y copia partidas (o capítulos enteros) a la tuya.',
  },
  {
    icon: 'grip',
    title: 'Ordenar a mano',
    desc: 'Arrastra una partida por su asa (o un capítulo/subcapítulo del árbol) para cambiar el orden; en el menú ⋮ tienes Subir y Bajar. La numeración se rehace sola. Las líneas de medición se ordenan igual: por su asa, con Alt+↑/↓ o con Subir y Bajar de la barra de selección.',
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
  // Medir sobre planos PDF: detrás de su interruptor hasta la puerta cronometrada.
  ...(planosActivos() ? [MEDIR_SOBRE_PLANOS] : []),
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
    ...(planosActivos()
      ? [
          {
            title: 'Visor de planos',
            rows: [
              { keys: ['M'], label: 'Mano: mover y seleccionar' },
              { keys: ['L'], label: 'Longitud' },
              { keys: ['S'], label: 'Superficie' },
              { keys: ['R'], label: 'Rectángulo (tres clics)' },
              { keys: ['N'], label: 'Recuento' },
              { keys: ['D'], label: 'Restar (descontar), conmutador' },
              { keys: ['C'], label: 'Calibrar la página' },
              { keys: ['F'], label: 'Ajustar a la ventana' },
              { keys: ['+', '−'], label: 'Acercar y alejar (también Ctrl + rueda, al cursor)' },
              { keys: ['Espacio'], label: 'Mantener y arrastrar para desplazar (también botón central)' },
              { keys: ['Enter'], label: 'Cerrar la forma; en el comentario, crear la línea' },
              { keys: ['Retroceso'], label: 'Quitar el último punto (no toca el historial)' },
              { keys: ['Mayús'], label: 'Forzar 0/45/90°' },
              { keys: ['Supr'], label: 'Con Mano, borrar la línea de la forma seleccionada' },
              { keys: ['Esc'], label: 'Descartar la forma; en reposo, cerrar el visor' },
            ],
          },
        ]
      : []),
    {
      title: 'Líneas de medición',
      rows: [
        { keys: ['Tab'], label: 'Ir a la celda siguiente y editarla' },
        { keys: ['Shift', 'Tab'], label: 'Ir a la celda anterior' },
        { keys: ['Enter'], label: 'Bajar en la misma columna' },
        { keys: [mod, 'Enter'], label: 'Añadir línea nueva' },
        { keys: ['Esc'], label: 'Cancelar la edición de la celda; después, quitar la selección o el corte' },
        { keys: ['Shift', 'Espacio'], label: 'Seleccionar o quitar la línea' },
        { keys: ['Shift', '↑ ↓'], label: 'Ampliar la selección' },
        { keys: ['Alt', '↑ ↓'], label: 'Subir o bajar la línea (o la selección)' },
        { keys: [mod, 'C'], label: 'Copiar la línea (o la selección), también para Excel' },
        { keys: [mod, 'X'], label: 'Cortar la línea (o la selección) para moverla al pegar' },
        { keys: [mod, 'V'], label: 'Pegar detrás de la línea (líneas de Concreta o filas de Excel)' },
        { keys: [mod, 'D'], label: 'Duplicar la línea (no rellena hacia abajo)' },
      ],
    },
  ];
}
