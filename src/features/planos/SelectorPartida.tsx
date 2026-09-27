/* ===========================================================================
   SelectorPartida — «Midiendo en ▾» (§5.4): la partida abierta es la única
   fuente del destino. Un buscador más las 5 partidas usadas hace poco en este
   plano; elegir una la abre en el presupuesto.
   =========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components';
import { medFormaDe, medFormaDef } from '../../core/medForma';
import type { Partida } from '../../core/types';
import { useObraStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import styles from './Planos.module.css';

interface Opcion {
  p: Partida;
  chapterId: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

export function SelectorPartida({
  planoId,
  partida,
  abierto,
  onAbierto,
}: {
  planoId: string;
  partida: Partida | null;
  abierto: boolean;
  onAbierto: (v: boolean) => void;
}) {
  const partidas = useObraStore((s) => s.partidas);
  const revealPartida = useObraStore((s) => s.revealPartida);
  const recientesIds = usePlanoUiStore((s) => s.recientes[planoId]);
  const usarPartida = usePlanoUiStore((s) => s.usarPartida);
  const [q, setQ] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);

  const todas = useMemo<Opcion[]>(
    () => Object.entries(partidas).flatMap(([chapterId, ps]) => ps.map((p) => ({ p, chapterId }))),
    [partidas],
  );
  const recientes = useMemo(
    () => (recientesIds ?? []).map((id) => todas.find((o) => o.p.id === id)).filter((o): o is Opcion => !!o),
    [recientesIds, todas],
  );
  const resultados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return todas.filter((o) => norm(`${o.p.pos} ${o.p.code} ${o.p.title}`).includes(t)).slice(0, 30);
  }, [q, todas]);

  useEffect(() => {
    if (abierto) {
      setQ('');
      buscaRef.current?.focus();
    }
  }, [abierto]);

  function elegir(o: Opcion) {
    revealPartida(o.p.id, o.chapterId, o.p.sub ?? null);
    usarPartida(planoId, o.p.id);
    onAbierto(false);
  }

  const fila = (o: Opcion) => (
    <button key={o.p.id} type="button" className={`tcol ${styles.opcion}`} onClick={() => elegir(o)}>
      <span className={`mono ${styles.opcionPos}`}>{o.p.pos}</span>
      <span className={`mono ${styles.opcionCode}`}>{o.p.code}</span>
      <span className={styles.opcionTitulo}>{o.p.title || 'Sin título'}</span>
      <span className={styles.opcionForma}>{medFormaDef(medFormaDe(o.p)).nombre}</span>
    </button>
  );

  return (
    <div className={styles.selectorWrap}>
      <button
        type="button"
        className={`tcol ${styles.selector}`}
        aria-expanded={abierto}
        onClick={() => onAbierto(!abierto)}
      >
        <span className={styles.selectorRot}>Midiendo en:</span>
        {partida ? (
          <>
            <span className="mono">{partida.pos}</span>
            <span className="mono">{partida.code}</span>
            <span className={styles.selectorTitulo}>{partida.title || 'Sin título'}</span>
            <span className={styles.selectorForma}>· {medFormaDef(medFormaDe(partida)).nombre}</span>
          </>
        ) : (
          <span className={styles.selectorVacio}>ninguna partida abierta</span>
        )}
        <Icon name="chevronDown" size={13} />
      </button>
      {abierto && (
        <div
          className={styles.popover}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onAbierto(false);
            }
          }}
        >
          <div className={styles.buscador}>
            <Icon name="search" size={14} />
            <input
              ref={buscaRef}
              value={q}
              placeholder="Buscar partida por código o título"
              aria-label="Buscar partida"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && resultados[0]) {
                  e.preventDefault();
                  elegir(resultados[0]);
                }
              }}
            />
          </div>
          {q.trim() ? (
            resultados.length ? (
              <div className={styles.opciones}>{resultados.map(fila)}</div>
            ) : (
              <p className={styles.popVacio}>Ninguna partida con «{q.trim()}».</p>
            )
          ) : recientes.length ? (
            <>
              <div className={`sec-head ${styles.popTitulo}`}>Usadas hace poco en este plano</div>
              <div className={styles.opciones}>{recientes.map(fila)}</div>
            </>
          ) : (
            <p className={styles.popVacio}>Escribe para buscar la partida que vas a medir.</p>
          )}
        </div>
      )}
    </div>
  );
}
