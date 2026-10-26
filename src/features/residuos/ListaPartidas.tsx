import { useMemo, useState } from 'react';
import { Icon } from '../../components';
import { fmtNum } from '../../core/money';
import { partidaCantidad } from '../../core/medicion';
import { necesitaRevision, resultadoPartida } from '../../core/rcd';
import type { Chapter, Partida } from '../../core/types';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import { ChipEstado, type EstadoVisibleRcd } from './ChipEstado';
import { EditorResiduo } from './EditorResiduo';
import styles from './Residuos.module.css';

type Filtro = 'revisar' | 'sinAsignar' | 'confirmadas' | 'noGeneran' | 'todas';

const FILTROS: Array<[Filtro, string]> = [
  ['revisar', 'Por revisar'],
  ['sinAsignar', 'Sin asignar'],
  ['confirmadas', 'Confirmadas'],
  ['noGeneran', 'No generan'],
  ['todas', 'Todas'],
];

/** Estado que se ve: «revisar» si la partida cambió después de confirmarla (TD1). */
function estadoDe(p: Partida): EstadoVisibleRcd | undefined {
  if (!p.rcd) return undefined;
  return necesitaRevision(p.rcd, p) ? 'revisar' : p.rcd.estado;
}

function casa(f: Filtro, e: EstadoVisibleRcd | undefined): boolean {
  switch (f) {
    case 'revisar':
      return e === 'propuesta' || e === 'revisar';
    case 'sinAsignar':
      return e === undefined;
    case 'confirmadas':
      return e === 'confirmada';
    case 'noGeneran':
      return e === 'noGenera' || e === 'gestion';
    case 'todas':
      return true;
  }
}

/** Resumen de una fila: códigos y toneladas, o lo que falta. */
function Resumen({ p }: { p: Partida }) {
  const estudio = useObraStore((s) => s.estudioRcd);
  const r = p.rcd;
  const res = useMemo(() => resultadoPartida(p, estudio), [p, estudio]);
  if (!r) return <span className={styles.rowSum}>—</span>;
  if (r.estado === 'gestion') return <span className={styles.rowSum}>Gestión (7.º)</span>;
  if (!r.componentes.length) return <span className={styles.rowSum}>Sin residuo</span>;
  const codigos = [...new Set(r.componentes.map((c) => c.ler || '?'))].join(' · ');
  return (
    <span className={`${styles.rowSum} mono ${res.incompleta ? styles.rowSumWarn : ''}`} title={res.incompleta ? 'Falta algún dato' : undefined}>
      {codigos} · {fmtNum(res.t, 3)} t{res.incompleta ? ' · falta' : ''}
    </span>
  );
}

/** Partidas de la obra con su asignación de residuo. */
export function ListaPartidas({ abrir, onAbrir }: { abrir: string | null; onAbrir: (id: string | null) => void }) {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const confirmar = useObraStore((s) => s.confirmarResiduos);
  const proponer = useObraStore((s) => s.proponerResiduos);

  const filas = useMemo(
    () => chapters.flatMap((ch) => (partidas[ch.id] ?? []).map((p) => ({ ch, p, e: estadoDe(p) }))),
    [chapters, partidas],
  );
  const cuenta = (f: Filtro) => filas.filter((x) => casa(f, x.e)).length;
  const [filtro, setFiltro] = useState<Filtro>(() => (filas.some((x) => casa('revisar', x.e)) ? 'revisar' : 'todas'));
  const visibles = filas.filter((x) => casa(filtro, x.e) || x.p.id === abrir);
  const propuestasVisibles = visibles.filter((x) => casa('revisar', x.e));

  const porCapitulo = new Map<Chapter, Partida[]>();
  for (const { ch, p } of visibles) porCapitulo.set(ch, [...(porCapitulo.get(ch) ?? []), p]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>Partidas</div>
        <div className={styles.btnRow}>
          {propuestasVisibles.length > 0 && (
            <button
              type="button"
              className={`tcol ${styles.btnPrimary}`}
              onClick={() => {
                const n = confirmar(propuestasVisibles.map((x) => ({ chapterId: x.ch.id, partidaId: x.p.id })));
                useToastStore
                  .getState()
                  .show(`${n} propuesta${n === 1 ? '' : 's'} confirmada${n === 1 ? '' : 's'}`, { label: 'Deshacer', run: () => undo() }, { rev: getDomainRevision() });
              }}
            >
              <Icon name="check" size={14} /> Confirmar {propuestasVisibles.length === 1 ? 'la propuesta' : `las ${propuestasVisibles.length} propuestas`}
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
      {[...porCapitulo.entries()].map(([ch, ps]) => (
        <div key={ch.id}>
          <div className={styles.chapHead}>
            {ch.code} · {ch.title}
          </div>
          {ps.map((p) => {
            const abierta = abrir === p.id;
            return (
              <div key={p.id} className={styles.row} data-partida-rcd={p.id}>
                <button
                  type="button"
                  className={`tcol ${styles.rowMain}`}
                  aria-expanded={abierta}
                  onClick={() => onAbrir(abierta ? null : p.id)}
                >
                  <ChipEstado estado={estadoDe(p) ?? null} />
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
                    <EditorResiduo chapterId={ch.id} p={p} />
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
