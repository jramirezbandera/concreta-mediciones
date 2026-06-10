import type { IconName } from '../components/Icon';

/** Las cuatro vistas principales de la app. */
export type View = 'import' | 'presupuesto' | 'resumen' | 'certificaciones';

export interface TabDef {
  k: View;
  /** Etiqueta en la barra superior (desktop). */
  label: string;
  /** Etiqueta corta para la barra inferior (móvil). */
  short: string;
  icon: IconName;
}

export const TABS: TabDef[] = [
  { k: 'import', label: 'Importar', short: 'Importar', icon: 'upload' },
  { k: 'presupuesto', label: 'Presupuesto', short: 'Presup.', icon: 'list' },
  { k: 'resumen', label: 'Resumen', short: 'Resumen', icon: 'grid' },
  { k: 'certificaciones', label: 'Certificaciones', short: 'Certif.', icon: 'clipboardCheck' },
];

/** Etiqueta humana de una vista (para el breadcrumb). */
export const VIEW_LABEL: Record<View, string> = {
  import: 'Importar',
  presupuesto: 'Presupuesto',
  resumen: 'Resumen',
  certificaciones: 'Certificaciones',
};
