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
  done?: 'obra' | 'partidas' | 'medicion' | 'plano' | 'coefK' | 'cert';
  go?: GoView;
  goLabel?: string;
  /** Abre un panel en vez de ir a una vista («Planos»). */
  abre?: 'planos';
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
  // Medir sobre planos PDF: detrás de su interruptor (§5.9).
  ...(planosActivos()
    ? [
        {
          title: 'Mide sobre los planos',
          desc: 'Con el botón Planos, adjunta el PDF del proyecto, calibra cada página con una cota y mide con clic… Enter, Enter: cada medida entra como línea de la partida abierta, con su origen en el plano.',
          done: 'plano',
          abre: 'planos',
          goLabel: 'Abrir Planos',
        } satisfies OnboardingStep,
      ]
    : []),
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

/** «Medir sobre planos» (§10 de la especificación): el resumen; el detalle va
 *  en `AYUDA_PLANOS`, por secciones. */
const MEDIR_SOBRE_PLANOS: Feature = {
  icon: 'plano',
  title: 'Medir sobre planos',
  desc: 'Botón «Planos»: adjunta el PDF del proyecto, calibra cada página con una cota conocida y mide con clic… Enter, Enter. Cada medida entra como línea de la partida abierta, con su «P1 · Salón» y de dónde sale, y su número lleva de vuelta al plano. Más abajo, paso a paso.',
};

/** Secciones de la ayuda de planos: el «?» de cada mensaje del visor lleva a la suya. */
export type AnclaAyuda =
  | 'planos-herramientas'
  | 'planos-medir'
  | 'planos-calibrar'
  | 'planos-escala'
  | 'planos-retocadas'
  | 'planos-revisiones'
  | 'planos-copia';

export interface SeccionAyuda {
  id: AnclaAyuda;
  titulo: string;
  puntos: string[];
}

/** «Medir sobre planos», paso a paso (§10): en lenguaje de obra. */
export const AYUDA_PLANOS: SeccionAyuda[] = [
  {
    id: 'planos-herramientas',
    titulo: 'Qué herramienta para cada partida',
    puntos: [
      'Por unidades (puertas, enchufes, luminarias): Recuento.',
      'Por longitud (rodapié, bajantes, cornisas): Longitud, o el perímetro de una Superficie o un Rectángulo.',
      'Por longitud × anchura: Rectángulo, que da el largo y el ancho, o Longitud con la anchura fija (la altura del paramento). Una Superficie propone pasar la partida a superficie directa.',
      'Por superficie directa (solados, falsos techos): Superficie o Rectángulo. Para paramentos (pintura, alicatado), Longitud × la altura.',
      'Por volumen: Rectángulo con la altura fija, o Longitud con la anchura y la altura fijas.',
      'Por superficie × espesor: Superficie o Rectángulo con el espesor fijo, o Longitud × la altura con el espesor.',
      'Por peso (acero): Longitud con el kg/m fijo o con el perfil en el comentario («Vigas IPE 300»).',
      'Recuento sirve en todas: cuenta las unidades y pide fijas las demás casillas. Si eliges una herramienta que no encaja, el visor dice cuál usar y la arma.',
    ],
  },
  {
    id: 'planos-medir',
    titulo: 'Medir: clic… Enter, Enter',
    puntos: [
      'Abre la partida, elige la herramienta y haz clic en cada punto. Enter (o doble clic) cierra la forma; escribe el comentario y Enter crea la línea, con «P1 · …» delante y de dónde sale. Retroceso quita el último punto, Esc descarta y Mayús fuerza 0/45/90°.',
      'Restar (D) mide huecos que descuentan. En Superficie y Rectángulo, el comentario propone el nombre de la estancia que lee dentro de la forma: escribe encima para cambiarlo.',
      '«Añadir también a…» lleva la misma forma a otras partidas: el suelo de una estancia como su área en Solado, su perímetro en Rodapié o su perímetro × la altura en Pintura.',
      'Una forma a medio dibujar no se pierde al cambiar de página, de plano o de partida, ni al cerrar el visor: al volver, «Seguir» la retoma. Si su herramienta no sirve para la partida abierta, queda como «Borrador para …» y «Volver» abre la suya.',
      'Sin ratón: las flechas mueven un cursor (con Mayús, de 10 en 10), Intro pone un punto donde está y Mayús+Intro cierra la forma.',
    ],
  },
  {
    id: 'planos-calibrar',
    titulo: 'Calibrar y comprobar',
    puntos: [
      'Cada página se calibra con una cota conocida: clic en sus dos extremos y su distancia real en metros. Cuanto más larga en pantalla, más precisa: acerca el zoom si hace falta.',
      'Después, otra cota para comprobar, mejor a más de 45° de la primera. Si no cuadra a menos del 1 %, algo falla: un clic desviado o el PDF impreso a otro tamaño.',
      'Si el texto del plano trae su escala («E 1:50») y la cota cuadra con ella, esa es la comprobación y la escala se ajusta a la exacta («1:50 ajustada»). Si no cuadra, el visor lo avisa.',
      'Una escala «sin comprobar» (copiada con «Usar esta calibración en otras páginas» o tras usar otro PDF) no mide hasta comprobarla con otra cota. Recuento funciona sin escala.',
    ],
  },
  {
    id: 'planos-escala',
    titulo: 'Una escala por página',
    puntos: [
      'Cada página tiene UNA escala. Si recalibras una página con líneas, Concreta pregunta si la anterior estaba mal y recalcula sus líneas en un paso de Deshacer; las retocadas a mano y las certificadas conservan la suya.',
      'Para un detalle a otra escala dentro de la misma hoja, adjunta el PDF otra vez y calibra esa copia a la escala del detalle.',
    ],
  },
  {
    id: 'planos-retocadas',
    titulo: 'Líneas retocadas',
    puntos: [
      'Si cambias a mano un número que vino del plano, la línea queda retocada: «✎» en su marcador y en el plano, y ya no se recalcula.',
      'Su marcador ofrece «Aceptar valores actuales» (mandan tus números: al recalibrar no se recalcula, y «Volver a medir» devuelve el mando al plano) o «Desvincular del plano» (conserva los números y deja de ser una medida del plano: sale de la capa).',
      'El número de la izquierda de cada línea medida es «Ver en plano»: abre el plano en su página y la destaca.',
    ],
  },
  {
    id: 'planos-revisiones',
    titulo: 'Revisiones y otro PDF',
    puntos: [
      'Si llega una versión nueva del plano, «Adjuntar revisión…» (menú ⋯) la añade como plano nuevo («Rev. B»): la anterior conserva sus escalas y sus líneas y avisa de que hay una más nueva.',
      'Al volver a adjuntar un PDF que no está y elegir otro fichero: si tiene las mismas páginas, puedes «Usar este PDF para este plano» (conserva escalas y líneas; cada página pide comprobar su escala con otra cota); si no, entra como revisión nueva.',
    ],
  },
  {
    id: 'planos-copia',
    titulo: 'Copia .zip frente a .json',
    puntos: [
      'El PDF se queda en este navegador, no en la obra. «Datos de la obra» → «Copia completa con planos (.zip)» guarda la obra con sus PDF, y «Importar copia» la restaura.',
      'La copia .json solo lleva el presupuesto, pero tus líneas sobreviven aunque se pierda el PDF: al volver a adjuntar el mismo PDF vuelven su escala y su capa.',
      'Si el navegador se queda sin espacio, «Liberar espacio» (en la lista de planos) borra, tras confirmar, los PDF que no usa ninguna obra; nunca los adjuntados en las últimas 24 h.',
    ],
  },
];

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
              { keys: ['← → ↑ ↓'], label: 'Cursor de teclado: moverlo 1 px (con Mayús, 10)' },
              { keys: ['Enter'], label: 'Con el cursor de teclado, poner un punto donde está' },
              { keys: ['Mayús', 'Enter'], label: 'Con el cursor de teclado, cerrar la forma' },
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
