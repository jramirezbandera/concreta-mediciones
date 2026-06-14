import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import { flattenContainers } from '../../core/tree';
import type { Partida } from '../../core/types';
import { usePartidaClipboard } from '../../hooks/usePartidaClipboard';
import { deletePartidaWithUndo } from '../../hooks/usePartidaDelete';
import { useObraStore } from '../../store';
import styles from './Presupuesto.module.css';

/** Menú ⋮ de una partida (F2.4): copiar, mover a otro capítulo/subcapítulo o eliminar. */
export function PartidaMenu({ p, chapterId }: { p: Partida; chapterId: string }) {
  const chapters = useObraStore((s) => s.chapters);
  const movePartida = useObraStore((s) => s.movePartida);
  const { copy } = usePartidaClipboard();
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

  const target = (chId: string, subId: string | null, code: string, label: string, depth: number) => {
    const cur = isCur(chId, subId);
    return (
      <button
        key={`${chId}/${subId ?? ''}`}
        type="button"
        disabled={cur}
        className={`tcol ${styles.menuTarget} ${depth >= 1 ? styles.menuSub : ''}`}
        style={depth > 1 ? { paddingLeft: 24 + (depth - 1) * 14 } : undefined}
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
          <button
            type="button"
            title="Copiar partida (Ctrl+C)"
            className={`tcol ${styles.menuCopy}`}
            onClick={() => {
              copy(p);
              setOpen(false);
            }}
          >
            <Icon name="copy" size={15} /> Copiar partida
          </button>
          <div className={styles.menuDivider} />
          <div className={`sec-head ${styles.menuHead}`}>Mover a</div>
          <div className={`scroll-thin ${styles.menuList}`}>
            {/* Destinos a CUALQUIER profundidad (T-17), sangrados por nivel. */}
            {chapters.map((ch) => (
              <div key={ch.id}>
                {target(ch.id, null, ch.code, ch.title, 0)}
                {flattenContainers(ch).map((f) =>
                  target(ch.id, f.sub.id, f.sub.code, f.sub.title, f.depth),
                )}
              </div>
            ))}
          </div>
          <div className={styles.menuDivider} />
          <button
            type="button"
            title="Eliminar partida (Supr)"
            className={`tcol ${styles.menuDelete}`}
            onClick={() => {
              deletePartidaWithUndo(chapterId, p.id);
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
