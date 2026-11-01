import type { IconName } from '../components/Icon';

/** Las vistas principales de la app. */
export type View = 'import' | 'presupuesto' | 'resumen' | 'ofertas' | 'certificaciones' | 'anejos';

export interface TabDef {
  k: View;
  /** Etiqueta en la barra superior (desktop). */
  label: string;
  /** Etiqueta corta para la barra inferior (móvil). */
  short: string;
  icon: IconName;
  /** `false`: no cabe en la barra inferior del móvil; va al menú «Más». */
  enBarraInferior?: boolean;
}

export const TABS: TabDef[] = [
  { k: 'import', label: 'Importar', short: 'Importar', icon: 'upload' },
  { k: 'presupuesto', label: 'Presupuesto', short: 'Presup.', icon: 'list' },
  { k: 'resumen', label: 'Resumen', short: 'Resumen', icon: 'grid' },
  // Comparativo de las ofertas de las constructoras (docs/plan-ofertas.md); en el
  // móvil va al menú «Más», como Anejos.
  { k: 'ofertas', label: 'Ofertas', short: 'Ofertas', icon: 'send', enBarraInferior: false },
  { k: 'certificaciones', label: 'Certificaciones', short: 'Certif.', icon: 'clipboardCheck' },
  // Anejos de la memoria (estudio de residuos y plan de control de calidad), con
  // sus pestañas dentro: una sola pestaña en la barra para no apretar la obra (D6).
  { k: 'anejos', label: 'Anejos', short: 'Anejos', icon: 'anejos', enBarraInferior: false },
];

/** Etiqueta humana de una vista (para el breadcrumb). */
export const VIEW_LABEL: Record<View, string> = {
  import: 'Importar',
  presupuesto: 'Presupuesto',
  resumen: 'Resumen',
  ofertas: 'Ofertas',
  certificaciones: 'Certificaciones',
  anejos: 'Anejos',
};
