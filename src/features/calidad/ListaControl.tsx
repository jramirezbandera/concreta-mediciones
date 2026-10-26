import { useMemo, useState } from 'react';
import { Icon } from '../../components';
import { fmtNum } from '../../core/money';
import { partidaCantidad } from '../../core/medicion';
import { familiaDef, necesitaRevision } from '../../core/pcc/reglas';
import type { Chapter, Partida } from '../../core/types';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import { ChipControl } from './ChipControl';
import { EditorControl } from './EditorControl';
import type { EstadoChipPcc } from './PccChip';
import styles from '../residuos/Residuos.module.css';

type Filtro = 'revisar' | 'sinAsignar' | 'confirmadas' | 'sinControl' | 'todas';

const FILTROS: Array<[Filtro, string]> = [
  ['revisar', 'Por revisar'],
  ['sinAsignar', 'Sin familia'],
  ['confirmadas', 'Confirmadas'],
  ['sinControl', 'Sin control'],
  ['todas', 'Todas'],
];

/** Estado que se ve: «revisar» si la partida cambió después de confirmarla (O6). */
function estadoVisible(p: Partida): EstadoChipPcc | null {
  if (!p.pcc) return null;
  return necesitaRevision(p.pcc, p) ? 'revisar' : p.pcc.estado;
}

function casa(f: Filtro, e: EstadoChipPcc | null): boolean {
  switch (f) {
    case 'revisar':
      return e === 'propuesta' || e === 'revisar';
    case 'sinAsignar':
      return e === null;
    case 'confirmadas':
      return e === 'confirmada';
    case 'sinControl':
      return e === 'sinControl' || e === 'capituloControl';
    case 'todas':
      return true;
  }
}

/** Resumen de una fila: familia y hormigón, o lo que es. */
function Resumen({ p }: { p: Partida }) {
  const c = p.pcc;
  if (!c) return <span className={styles.rowSum}>—</span>;
  if (c.estado === 'capituloControl') return <span className={styles.rowSum}>Capítulo de control</span>;
  if (!c.familia && !c.hormigon && !c.acero) return <span className={styles.rowSum}>Sin control</span>;
  const partes = [c.familia ? (familiaDef(c.familia)?.nombre ?? c.familia) : null, c.hormigon?.designacion.texto].filter(Boolean);
  return <span className={styles.rowSum}>{partes.join(' · ')}</span>;
}

/** Partidas de la obra con el control que disparan. */
export function ListaControl({ abrir, onAbrir }: { abrir: string | null; onAbrir: (id: string | null) => void }) {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const confirmar = useObraStore((s) => s.confirmarControles);
  const proponer = useObraStore((s) => s.proponerControles);

  const filas = useMemo(
    () => chapters.flatMap((ch) => (partidas[ch.id] ?? []).map((p) => ({ ch, p, e: estadoVisible(p) }))),
    [chapters, partidas],
  );
  const cuenta = (f: Filtro) => filas.filter((x) => casa(f, x.e)).length;
  const [filtro, setFiltro] = useState<Filtro>(() => (filas.some((x) => casa('revisar', x.e)) ? 'revisar' : 'todas'));
  const visibles = filas.filter((x) => casa(filtro, x.e) || x.p.id === abrir);
  const porConfirmar = visibles.filter((x) => casa('revisar', x.e));

  const porCapitulo = new Map<Chapter, Array<(typeof filas)[number]>>();
  for (const x of visibles) porCapitulo.set(x.ch, [...(porCapitulo.get(x.ch) ?? []), x]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Partidas</div>
        <div className={styles.btnRow}>
          {porConfirmar.length > 0 && (
            <button
              type="button"
              className={`tcol ${styles.btnPrimary}`}
              onClick={() => {
                const n = confirmar(porConfirmar.map((x) => ({ chapterId: x.ch.id, partidaId: x.p.id })));
                useToastStore
                  .getState()
                  .show(`${n} partida${n === 1 ? '' : 's'} confirmada${n === 1 ? '' : 's'}`, { label: 'Deshacer', run: () => undo() }, { rev: getDomainRevision() });
              }}
            >
              <Icon name="check" size={14} /> Confirmar {porConfirmar.length === 1 ? 'la partida' : `las ${porConfirmar.length}`}
            </button>
          )}
          <button
            type="button"
            className={`tcol ${styles.btn}`}
            title="Aplica las reglas a las partidas sin asignar"
            onClick={() => {
              const n = proponer();
              useToastStore.getState().show(n ? `${n} partida${n === 1 ? '' : 's'} con propuesta nueva` : 'Ninguna partida sin asignar reconocida por las reglas');
            }}
          >
            <Icon name="target" size={14} /> Proponer en las sin asignar
          </button>
        </div>
      </div>
      <div className={styles.filters} role="group" aria-label="Filtrar partidas">
        {FILTROS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            className={`tcol ${styles.filter} ${filtro === f ? styles.on : ''}`}
            onClick={() => setFiltro(f)}
          >
            {label} <span className="mono">{cuenta(f)}</span>
          </button>
        ))}
      </div>
      {visibles.length === 0 && <p className={styles.nota}>Ninguna partida en este filtro.</p>}
      {[...porCapitulo.entries()].map(([ch, xs]) => (
        <div key={ch.id}>
          <div className={styles.chapHead}>
            {ch.code} · {ch.title}
          </div>
          {xs.map(({ p, e }) => {
            const abierta = abrir === p.id;
            return (
              <div key={p.id} className={styles.row} data-partida-pcc={p.id}>
                <button
                  type="button"
                  className={`tcol ${styles.rowMain}`}
                  aria-expanded={abierta}
                  onClick={() => onAbrir(abierta ? null : p.id)}
                >
                  <ChipControl estado={e} />
                  <span className={styles.rowTitle}>
                    <span className={`mono ${styles.rowCode}`}>{p.code}</span>
                    {p.title}
                  </span>
                  <span className={`${styles.rowQty} mono`}>
                    {fmtNum(partidaCantidad(p), 2)} {p.ud}
                  </span>
                  <Resumen p={p} />
                </button>
                {abierta && (
                  <div className={styles.rowEditor}>
                    <EditorControl chapterId={ch.id} p={p} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
