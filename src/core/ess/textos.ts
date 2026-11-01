// =============================================================================
// Los textos fijos del estudio básico de seguridad y salud (feature-35, paso 5).
// DATOS, con su cita.
//
// Lo que no depende de la obra: la lista corta de normas (K-SYS.17), el objeto
// (art. 6 y 7 del RD 1627/1997; RD 171/2004), los primeros auxilios (K-SYS.19),
// el amianto (K-SYS.9) y las obligaciones durante la obra (K-SYS.6, K-SYS.20).
// Los literales solo de lo VERIFICADO (texto); lo demás, parafraseado y sin
// comillas. Base: research/verificacion-seguridad-salud.md.
// =============================================================================

import { tabla } from './tabla';

// ── Normas aplicables (K-SYS.17) ─────────────────────────────────────────────

/** Una norma de la lista corta, con el título exacto del BOE. */
export interface NormaEbss {
  titulo: string;
  /** Solo si la obra tiene ese medio: las de grúas. */
  solo?: 'grua_torre' | 'grua_movil';
}

/**
 * La lista corta y cerrada del apartado 5: título exacto de la cabecera del
 * consolidado del BOE, todas vigentes a 2026-10-16. Fuera, a propósito: el
 * RD 486/1997 (excluye las obras), la Orden TAS/2947/2007 y la Orden
 * TAS/2926/2002. El RD 665/1997 y el RD 664/1997, sin leer: no entran.
 */
export const NORMAS_EBSS = tabla(
  {
    db: 'Lista corta de normas del estudio básico',
    edicion: 'K-SYS.17, cabeceras de los consolidados del BOE',
    fecha: '2026-10-16',
    fuente: 'research/verificacion-seguridad-salud.md (K-SYS.17)',
  },
  [
    {
      titulo:
        'Real Decreto 1627/1997, de 24 de octubre, por el que se establecen disposiciones mínimas de seguridad y de salud en las obras de construcción, en su redacción vigente',
    },
    { titulo: 'Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales' },
    {
      titulo:
        'Real Decreto 39/1997, de 17 de enero, por el que se aprueba el Reglamento de los Servicios de Prevención',
    },
    {
      titulo:
        'Real Decreto 171/2004, de 30 de enero, por el que se desarrolla el artículo 24 de la Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales, en materia de coordinación de actividades empresariales',
    },
    {
      titulo:
        'Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el Sector de la Construcción',
    },
    {
      titulo:
        'Real Decreto 1109/2007, de 24 de agosto, por el que se desarrolla la Ley 32/2006, de 18 de octubre, reguladora de la subcontratación en el Sector de la Construcción',
    },
    {
      titulo:
        'Real Decreto 485/1997, de 14 de abril, sobre disposiciones mínimas en materia de señalización de seguridad y salud en el trabajo',
    },
    {
      titulo:
        'Real Decreto 487/1997, de 14 de abril, sobre disposiciones mínimas de seguridad y salud relativas a la manipulación manual de cargas que entrañe riesgos, en particular dorsolumbares, para los trabajadores',
    },
    {
      titulo:
        'Real Decreto 773/1997, de 30 de mayo, sobre disposiciones mínimas de seguridad y salud relativas a la utilización por los trabajadores de equipos de protección individual',
    },
    {
      titulo:
        'Real Decreto 1215/1997, de 18 de julio, por el que se establecen las disposiciones mínimas de seguridad y salud para la utilización por los trabajadores de los equipos de trabajo',
    },
    {
      titulo:
        'Real Decreto 614/2001, de 8 de junio, sobre disposiciones mínimas para la protección de la salud y seguridad de los trabajadores frente al riesgo eléctrico',
    },
    {
      titulo:
        'Real Decreto 286/2006, de 10 de marzo, sobre la protección de la salud y la seguridad de los trabajadores contra los riesgos relacionados con la exposición al ruido',
    },
    {
      titulo:
        'Real Decreto 1311/2005, de 4 de noviembre, sobre la protección de la salud y la seguridad de los trabajadores frente a los riesgos derivados o que puedan derivarse de la exposición a vibraciones mecánicas',
    },
    {
      titulo:
        'Real Decreto 374/2001, de 6 de abril, sobre la protección de la salud y seguridad de los trabajadores contra los riesgos relacionados con los agentes químicos durante el trabajo',
    },
    {
      titulo:
        'Real Decreto 396/2006, de 31 de marzo, por el que se establecen las disposiciones mínimas de seguridad y salud aplicables a los trabajos con riesgo de exposición al amianto, o la norma que lo sustituya en transposición de la Directiva (UE) 2023/2668',
    },
    {
      titulo:
        'Real Decreto 842/2002, de 2 de agosto, por el que se aprueba el Reglamento electrotécnico para baja tensión (ITC-BT-33)',
    },
    {
      titulo:
        'Real Decreto 836/2003, de 27 de junio, por el que se aprueba una nueva Instrucción técnica complementaria «MIE-AEM-2» del Reglamento de aparatos de elevación y manutención, referente a grúas torre para obras u otras aplicaciones',
      solo: 'grua_torre',
    },
    {
      titulo:
        'Real Decreto 837/2003, de 27 de junio, por el que se aprueba el nuevo texto modificado y refundido de la Instrucción técnica complementaria «MIE-AEM-4» del Reglamento de aparatos de elevación y manutención, referente a grúas móviles autopropulsadas',
      solo: 'grua_movil',
    },
    {
      titulo:
        'Resolución de 6 de septiembre de 2023, de la Dirección General de Trabajo, por la que se registra y publica el VII Convenio colectivo general del sector de la construcción',
    },
    {
      titulo:
        'Orden TIN/1071/2010, de 27 de abril, sobre los requisitos y datos que deben reunir las comunicaciones de apertura o de reanudación de actividades en los centros de trabajo',
    },
  ] as readonly NormaEbss[],
);

// ── Objeto (apartado 2) ──────────────────────────────────────────────────────

/** RD 1627/1997 art. 6.2 y 6.3 (VERIFICADO), en resumen; RD 171/2004 DA 1.ª (Guía folio 24); art. 7.1. */
export const OBJETO_EBSS: readonly string[] = [
  'Este estudio básico precisa las normas de seguridad y salud aplicables a la obra. Identifica los riesgos laborales que pueden evitarse, con las medidas técnicas para ello, y relaciona los que no pueden eliminarse, con las medidas preventivas y las protecciones técnicas que los controlan y reducen y la valoración de su eficacia. Tiene en cuenta las otras actividades que se realizan en el lugar, contiene las medidas específicas de los trabajos del anexo II y las previsiones e informaciones útiles para los previsibles trabajos posteriores (RD 1627/1997, art. 6.2 y 6.3).',
  'Con este estudio el promotor informa al contratista de los riesgos de la obra y de las medidas para prevenirlos: así se cumple en las obras de construcción el deber de información del empresario titular (RD 171/2004, disposición adicional primera).',
  'Cada contratista elabora, a partir de él, su plan de seguridad y salud en el trabajo, en el que analiza, estudia, desarrolla y complementa sus previsiones en función de su propio sistema de ejecución de la obra (RD 1627/1997, art. 7.1).',
];

// ── Primeros auxilios (apartado 6; K-SYS.19) ─────────────────────────────────

/** RD 1627/1997, anexo IV, parte A, apartado 14 a) y d): VERIFICADO (texto), literal. */
export const PRIMEROS_AUXILIOS_RD1627 =
  '«Será responsabilidad del empresario garantizar que los primeros auxilios puedan prestarse en todo momento por personal con la suficiente formación para ello. Asimismo, deberán adoptarse medidas para garantizar la evacuación, a fin de recibir cuidados médicos, de los trabajadores accidentados o afectados por una indisposición repentina.» «En todos los lugares en los que las condiciones de trabajo lo requieran se deberá disponer también de material de primeros auxilios, debidamente señalizado y de fácil acceso. Una señalización claramente visible deberá indicar la dirección y el número de teléfono del servicio local de urgencia.» (RD 1627/1997, anexo IV, parte A, apartado 14 a y d).';

/** VII Convenio, art. 234.6 y 234.7: VERIFICADO (texto), en resumen. */
export const PRIMEROS_AUXILIOS_CONVENIO =
  'En la obra hay personal con conocimientos en primeros auxilios y, en lugar visible, la información del centro sanitario más próximo, el recorrido más recomendable para llegar a él y los teléfonos de urgencia (VII Convenio general del sector de la construcción, art. 234.6 y 234.7).';

/** VII Convenio, art. 234.3 y 234.4, con más de 50 trabajadores. */
export const LOCAL_PRIMEROS_AUXILIOS =
  'Con más de 50 trabajadores, la obra dispone de un local de primeros auxilios con botiquín, camilla y agua potable, como mínimo (VII Convenio, art. 234.3 y 234.4).';

/** Guía técnica del INSST, folio 78: buena práctica, sin cita reglamentaria (decisión 15). */
export const BOTIQUIN_GUIA =
  'El botiquín portátil contiene desinfectantes y antisépticos, gasas estériles, algodón, vendas, esparadrapo, apósitos, tijeras, pinzas y guantes desechables; se revisa periódicamente y se repone en cuanto caduca o se usa (Guía técnica del INSST para las obras de construcción).';

// ── Amianto (apartado 11; K-SYS.9 y K-SYS.18) ────────────────────────────────

export const AMIANTO_NORMA =
  'RD 396/2006, o la norma que lo sustituya en transposición de la Directiva (UE) 2023/2668';

/** Art. 10.2 del RD 396/2006 (VERIFICADO), parafraseado. */
export const AMIANTO_BASE = `Antes de empezar una obra de demolición o de mantenimiento, el empresario identifica los materiales que puedan contener amianto, y esa identificación queda reflejada en el estudio básico de seguridad y salud (${AMIANTO_NORMA}, art. 10.2).`;

/** Con «posible» o «identificado»: arts. 3.2, 11, 12 y 17 (VERIFICADO); anexo II.2 del RD 1627/1997 (INTERPRETACIÓN). */
export const AMIANTO_MEDIDAS: readonly string[] = [
  'Los trabajos con amianto los hace una empresa inscrita en el Registro de Empresas con Riesgo por Amianto (RERA) (art. 17.1).',
  'Antes de empezar, esa empresa elabora un plan de trabajo y lo presenta a la autoridad laboral, que lo resuelve en cuarenta y cinco días; si en ese plazo no se notifica la resolución, el plan se entiende aprobado (arts. 11 y 12).',
  'Los materiales con amianto se retiran antes de demoler (art. 11.1 a).',
  'Quien contrate estos trabajos comprueba que el contratista o el subcontratista tiene su plan de trabajo aprobado (art. 11.5).',
  'Es un trabajo del anexo II, apartado 2, del RD 1627/1997, con la presencia del recurso preventivo (apartado 10).',
  'Los residuos con amianto son residuos peligrosos: su gestión va en el estudio de gestión de residuos.',
  'Las excepciones del art. 3.2 (exposiciones esporádicas y de baja intensidad) solo se aplican cuando la evaluación del art. 5 lo acredite.',
];

// ── Obligaciones durante la obra (apartado 13; K-SYS.6, K-SYS.20 y K-SYS.21) ─

/** El texto fijo, corregido: sin aviso previo ni copia de toda anotación a la Inspección. */
export const OBLIGACIONES_EBSS: readonly string[] = [
  'Cada contratista elabora su plan de seguridad y salud en el trabajo a partir de este estudio básico (art. 7.1). El plan se aprueba antes del inicio de la obra por el coordinador en materia de seguridad y salud durante la ejecución o, cuando no sea necesario designarlo, por la dirección facultativa (art. 7.2), y está en la obra a disposición permanente de la Inspección de Trabajo y Seguridad Social y de los técnicos de las administraciones públicas competentes (art. 19.2).',
  'Cada contratista presentará ante la autoridad laboral la comunicación de apertura del centro de trabajo antes del comienzo de los trabajos, acompañada del plan de seguridad y salud en el trabajo y de su aprobación (art. 7 del RD 1627/1997). La comunicación se expondrá en la obra en lugar visible y se actualizará en el plazo de 10 días cuando se produzcan cambios no identificados inicialmente. El promotor facilitará a los contratistas los datos necesarios (Orden TIN/1071/2010, arts. 2.2 y 3.5).',
  'En la obra hay un libro de incidencias, con hojas por duplicado, para el control y seguimiento del plan. Lo facilita el colegio profesional del técnico que aprueba el plan o, en obras de las Administraciones públicas, la oficina de supervisión de proyectos u órgano equivalente (art. 13.2), y está siempre en la obra, en poder del coordinador durante la ejecución o, si no es necesario designarlo, de la dirección facultativa (art. 13.3). Quien lo tiene notifica cada anotación al contratista afectado y a los representantes de sus trabajadores; solo cuando una anotación se refiere a un incumplimiento de advertencias u observaciones anteriores, o a una paralización (art. 14), se remite además una copia de la anotación a la Inspección de Trabajo y Seguridad Social en el plazo de veinticuatro horas (art. 13.4).',
  'Cada contratista tiene en la obra su libro de subcontratación (Ley 32/2006, art. 8).',
  'Las empresas que concurren en la obra coordinan sus actividades según el RD 171/2004; la presencia de los recursos preventivos de cada contratista se rige por la disposición adicional única del RD 1627/1997, y el plan fija su forma.',
  'Si el coordinador durante la ejecución o cualquier persona de la dirección facultativa observa que no se cumplen las medidas de seguridad y salud, lo advierte al contratista y lo anota en el libro de incidencias; ante un riesgo grave e inminente, puede paralizar los tajos o la obra entera, y da cuenta a la Inspección de Trabajo y Seguridad Social, a los contratistas y subcontratistas afectados y a los representantes de sus trabajadores (art. 14).',
];

/** RD 1627/1997 art. 2.3 (VERIFICADO); Guía folio 22; Orden TIN/1071/2010 art. 2.2 (K-SYS.11 y K-SYS.20). */
export const CABEZA_FAMILIA =
  'El promotor construye o reforma su propia vivienda y contrata directamente a trabajadores autónomos: respecto de ellos no tiene la consideración de contratista (RD 1627/1997, art. 2.3) y, según la Guía técnica del INSST, no hace falta plan de seguridad y salud para las partes de la obra que ejecuten esos autónomos. En esas partes, la comunicación de apertura se acompaña de la evaluación de riesgos (Orden TIN/1071/2010, art. 2.2). Este estudio básico se exige igual.';

// ── Trabajos posteriores (apartado 12; K-SYS.14) ─────────────────────────────

/** Las definiciones de la Guía (folios 32–33), parafraseadas; RD 1627/1997 art. 6.3. */
export const POSTERIORES_INTRO =
  'Los trabajos posteriores son los de reparación, conservación y mantenimiento de la obra y de sus instalaciones una vez entregada. Las previsiones son los elementos de seguridad que deja la obra para hacerlos (pasarelas, plataformas, barandillas, puntos de anclaje); las informaciones útiles, los datos de la construcción que importan para hacerlos en condiciones de seguridad (RD 1627/1997, art. 6.3; Guía técnica del INSST).';

export const POSTERIORES_DESTINO =
  'Estas previsiones e informaciones quedan en poder del promotor, que las traslada a los usuarios con el Libro del Edificio (Ley 38/1999, de Ordenación de la Edificación, art. 7).';
