import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components';
import { buildSearchIndex, searchPartidas, type HitPartida } from '../../core/buscar';
import { useObraStore } from '../../store';
import styles from './BuscarPartidas.module.css';

/** Posición del dropdown (portal) anclada bajo el input. */
interface Anchor {
  top: number;
  left: number;
  width: number;
}

/**
 * Buscador de partidas de la obra ACTIVA (T-20), montado arriba del Sidebar.
 * Espeja el buscador del panel Referencia, pero en vez de copiar SALTA a la
 * partida (`revealPartida`): marca su subcapítulo y la abre lista para editar.
 *
 * Decisiones de diseño (autoplan):
 *  - Dropdown en PORTAL: el `.sidebar` tiene `overflow:hidden` y ~286px, un
 *    absoluto se recortaría.
 *  - Índice memoizado SÓLO con búsqueda activa (≥2 chars, vía `useDeferredValue`)
 *    para no reconstruir 70k partidas en cada tecla ni en ediciones ajenas.
 *  - Patrón combobox (aria-expanded/-controls/-activedescendant) + teclado.
 */
export function BuscarPartidas({ onAfterSelect }: { onAfterSelect?: () => void }) {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const revealPartida = useObraStore((s) => s.revealPartida);
  const searchFocusNonce = useObraStore((s) => s.searchFocusNonce);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Búsqueda diferida: teclear no bloquea por reconstruir/filtrar el índice.
  const dq = useDeferredValue(q);
  const isActive = dq.trim().length >= 2;
  const index = useMemo(
    () => (isActive ? buildSearchIndex(chapters, partidas) : []),
    [isActive, chapters, partidas],
  );
  const { hits, truncated } = useMemo(() => searchPartidas(index, dq), [index, dq]);

  const showDropdown = open && q.trim().length >= 2;

  // La opción resaltada vuelve a la primera cuando cambian los resultados.
  useEffect(() => {
    setActiveIdx(0);
  }, [dq]);

  // Foco al buscador desde el atajo Ctrl/⌘+K (ignora el valor inicial de montaje).
  const lastFocusNonce = useRef(searchFocusNonce);
  useEffect(() => {
    if (searchFocusNonce === lastFocusNonce.current) return;
    lastFocusNonce.current = searchFocusNonce;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [searchFocusNonce]);

  // Posicionar el portal bajo el input (y re-medir en resize/scroll).
  useLayoutEffect(() => {
    if (!showDropdown) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchor({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [showDropdown]);

  // Cerrar al hacer click fuera (input o dropdown del portal).
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Auto-scroll de la opción resaltada dentro del dropdown.
  useEffect(() => {
    if (!showDropdown) return;
    document
      .getElementById(`${listId}-opt-${activeIdx}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, showDropdown, listId]);

  function select(hit: HitPartida) {
    revealPartida(hit.p.id, hit.chapterId, hit.subId);
    // El salto es la finalización: limpiar y cerrar (un dropdown sobre una vista
    // ya navegada confunde). En móvil, cerrar el drawer.
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    onAfterSelect?.();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIdx((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = hits[activeIdx];
      if (hit) {
        e.preventDefault();
        select(hit);
      }
    } else if (e.key === 'Escape') {
      // Dos fases: 1ª cierra el dropdown conservando texto; 2ª limpia.
      if (showDropdown) setOpen(false);
      else setQ('');
    }
  }

  const dropdown =
    showDropdown && anchor
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label="Resultados de la búsqueda"
            className={`scroll-thin ${styles.menu}`}
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
          >
            {hits.length === 0 ? (
              <div className={styles.empty}>Sin coincidencias en esta obra</div>
            ) : (
              <>
                {hits.map((h, i) => {
                  const cur = h.path[h.path.length - 1]!;
                  return (
                    <button
                      key={h.p.id}
                      type="button"
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={i === activeIdx}
                      className={`tcol ${styles.opt} ${i === activeIdx ? styles.active : ''}`}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => select(h)}
                    >
                      <span className={styles.optTop}>
                        <span className={`mono ${styles.optCode}`}>{h.p.code || h.p.pos}</span>
                        <span className={styles.optTitle}>{h.p.title || 'Sin título'}</span>
                      </span>
                      <span className={styles.optLoc}>
                        <span className="mono">{h.path.map((n) => n.code).join(' › ')}</span>
                        {' · '}
                        {cur.title}
                      </span>
                    </button>
                  );
                })}
                {truncated && (
                  <div className={styles.more} aria-hidden="true">
                    Afina la búsqueda (50+ resultados)
                  </div>
                )}
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.search}>
        <Icon name="search" size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && hits[activeIdx] ? `${listId}-opt-${activeIdx}` : undefined
          }
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Buscar partida en la obra… (Ctrl K)"
          aria-label="Buscar partida en la obra"
          className={styles.input}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            className={`tcol ${styles.clear}`}
            aria-label="Limpiar búsqueda"
          >
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
