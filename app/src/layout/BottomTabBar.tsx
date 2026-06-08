import { Icon } from '../components/Icon';
import { TABS, type View } from './types';
import styles from './BottomTabBar.module.css';

export interface BottomTabBarProps {
  view: View;
  onView: (v: View) => void;
}

/** Barra de pestañas inferior (móvil). */
export function BottomTabBar({ view, onView }: BottomTabBarProps) {
  return (
    <nav className={`no-print ${styles.bar}`} aria-label="Vistas">
      {TABS.map((t) => {
        const active = view === t.k;
        return (
          <button
            key={t.k}
            type="button"
            onClick={() => onView(t.k)}
            aria-current={active ? 'page' : undefined}
            className={`${styles.tab} ${active ? styles.active : ''}`}
          >
            <Icon name={t.icon} size={19} sw={active ? 2 : 1.7} />
            <span className={styles.label}>{t.short}</span>
          </button>
        );
      })}
    </nav>
  );
}
