import { Icon, type IconName } from '../components/Icon';
import type { View } from '../layout/types';
import styles from './PlaceholderView.module.css';

interface PlaceholderMeta {
  icon: IconName;
  title: string;
  desc: string;
  phase: string;
}

const META: Record<View, PlaceholderMeta> = {
  import: {
    icon: 'upload',
    title: 'Importar',
    desc: 'Arrastra un .bc3 (FIEBDC-3) para cargar capítulos, partidas y recursos desde Presto, Arquímedes o CYPE.',
    phase: 'Fase F5 · Importar',
  },
  presupuesto: {
    icon: 'list',
    title: 'Presupuesto',
    desc: 'Árbol de capítulos, tabla de partidas con medición y justificación de precios sobre el banco de recursos compartido.',
    phase: 'Fase F2 · Presupuesto',
  },
  resumen: {
    icon: 'grid',
    title: 'Resumen',
    desc: 'Desglose económico por capítulos: PEM, gastos generales, beneficio industrial e IVA.',
    phase: 'Fase F3 · Resumen',
  },
  certificaciones: {
    icon: 'clipboardCheck',
    title: 'Certificaciones',
    desc: 'Certificación de obra por periodos: a origen / esta certificación, precios contradictorios y retención.',
    phase: 'Fase F4 · Certificaciones',
  },
};

/**
 * Vista placeholder de F0: el chrome (tabs, tema, responsive) ya funciona; el
 * contenido de cada vista llega en su fase. Calidez Concreta, nada de gris.
 */
export function PlaceholderView({ view, compact }: { view: View; compact: boolean }) {
  const m = META[view];
  return (
    <div className={`dot-grid ${styles.wrap}`}>
      <div className={`fadeUp ${styles.card}`}>
        <div className={styles.icon}>
          <Icon name={m.icon} size={compact ? 24 : 26} />
        </div>
        <h1 className={styles.title} style={compact ? { fontSize: 19 } : undefined}>
          {m.title}
        </h1>
        <p className={styles.desc}>{m.desc}</p>
        <span className={styles.phase}>{m.phase}</span>
      </div>
    </div>
  );
}
