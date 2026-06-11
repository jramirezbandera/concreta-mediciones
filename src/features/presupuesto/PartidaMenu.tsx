import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import type { Partida } from '../../core/types';
import { useObraStore } from '../../store';
import styles from './Presupuesto.module.css';

/** Menú ⋮ de una partida (F2.4): mover a otro capítulo/subcapítulo o eliminar. */
export function PartidaMenu({ p, chapterId }: { p: Partida; chapterId: string }) {
  const chapters = useObraStore((s) => s.chapters);
  const movePartida = useObraStore((s) => s.movePartida);
  const deletePartida = useObraStore((s) => s.deletePartida);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const isCur = (chId: string, subId: string | null) =>
    chId === chapterId && (subId ?? null) === (p.sub ?? null);

  const target = (chId: string, subId: string | null, code: string, label: string, sub: boolean) => {
    const cur = isCur(chId, subId);
    return (
      <button
        key={`${chId}/${subId ?? ''}`}
        type="button"
        disabled={cur}
        className={`tcol ${styles.menuTarget} ${sub ? styles.menuSub : ''}`}
        onClick={() => {
          if (!cur) {
            movePartida(chapterId, p.id, chId, subId);
            setOpen(false);
          }
        }}
      >
        <span className={`mono ${styles.menuCode}`}>{code}</span>
        <span className={styles.menuLabel}>{label}</span>
        {cur && <span className={styles.menuActual}>actual</span>}
      </button>
    );
  };

  return (
    <div ref={ref} className={styles.menuWrap}>
      <button
        type="button"
        title="Más acciones"
        className={`tcol tap-target ${styles.menuBtn} ${open ? styles.open : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name="dots" size={16} />
      </button>
      {open && (
        <div className={styles.menuPop} onClick={(e) => e.stopPropagation()}>
          <div className={`sec-head ${styles.menuHead}`}>Mover a</div>
          <div className={`scroll-thin ${styles.menuList}`}>
            {chapters.map((ch) => (
              <div key={ch.id}>
                {target(ch.id, null, ch.code, ch.title, false)}
                {(ch.children ?? []).map((sc) => target(ch.id, sc.id, sc.code, sc.title, true))}
              </div>
            ))}
          </div>
          <div className={styles.menuDivider} />
          <button
            type="button"
            className={`tcol ${styles.menuDelete}`}
            onClick={() => {
              deletePartida(chapterId, p.id);
              setOpen(false);
            }}
          >
            <Icon name="trash" size={15} /> Eliminar partida
          </button>
        </div>
      )}
    </div>
  );
}
