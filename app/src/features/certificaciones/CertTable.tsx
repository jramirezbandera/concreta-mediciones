import { Fragment } from 'react';
import { Badge, EditableNum } from '../../components';
import { certCalc, estaCertDisplay } from '../../core/certificacion';
import { groupBySub } from '../../core/grouping';
import { fmtNum, round2, sumCents, toEur, type Cents } from '../../core/money';
import type { Chapter, Partida } from '../../core/types';
import { useObraStore, type CertMode } from '../../store';
import { PctBar } from './PctBar';
import styles from './Certificaciones.module.css';

type Data = Record<string, number>;

/** Cabecera de columnas (tabla aparte, ancho fijo → alinea con las del cuerpo). */
export function CertHead({ mode }: { mode: CertMode }) {
  return (
    <table className={`ctable ${styles.table}`}>
      <thead>
        <tr>
          <th className={styles.thNum}>Nº · Código</th>
          <th style={{ textAlign: 'left' }}>Descripción</th>
          <th className={styles.cUd}>Ud.</th>
          <th className={styles.thRight} style={{ width: 92 }}>
            Ofertada
          </th>
          <th className={styles.thRight} style={{ width: 96 }}>
            {mode === 'origen' ? 'Ejec. a origen' : 'Ejec. esta cert.'}
          </th>
          <th className={styles.thRight} style={{ width: 116, paddingRight: 12 }}>
            % avance
          </th>
          <th className={styles.thRight} style={{ width: 84 }}>
            Precio
          </th>
          <th className={styles.thRight} style={{ width: 116, paddingRight: 20 }}>
            {mode === 'origen' ? 'A origen' : 'Esta cert.'}
          </th>
        </tr>
      </thead>
    </table>
  );
}

function CertRow({
  p,
  curData,
  prevData,
  mode,
  coefK,
}: {
  p: Partida;
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
}) {
  const onCertEdit = useObraStore((s) => s.onCertEdit);
  const k = certCalc(p, curData, prevData, coefK);
  const abono = mode === 'origen' ? k.aOrigen : k.estaCert;
  const execValue = mode === 'origen' ? k.ejecutada : estaCertDisplay(k.ejecutada, k.prev);
  const precioK = round2((p.precio ?? 0) * coefK);
  return (
    <tr>
      <td className={`${styles.cell} ${styles.cNum}`}>
        <div className={`mono ${styles.pos}`}>{p.pos}</div>
        <div className={`mono ${styles.code}`}>{p.code}</div>
      </td>
      <td className={`${styles.cell} ${styles.cDesc}`}>
        <div className={styles.descInner}>
          {p.mainType && <Badge type={p.mainType} />}
          <span className={styles.title}>{p.title}</span>
        </div>
      </td>
      <td className={`mono ${styles.cell} ${styles.cUd}`}>{p.ud}</td>
      <td className={`mono ${styles.cell} ${styles.cNum2}`}>{fmtNum(k.ofertada)}</td>
      <td className={`${styles.cell} ${styles.cExec}`}>
        <EditableNum
          value={execValue}
          dec={2}
          accent
          ariaLabel="Cantidad ejecutada"
          onCommit={(v) => onCertEdit(p.id, v, mode)}
        />
      </td>
      <td className={`${styles.cell} ${styles.cPct}`}>
        {k.ofertada > 0 ? <PctBar pct={k.pct} /> : <span className={styles.pctDash}>—</span>}
      </td>
      <td className={`mono ${styles.cell} ${styles.cPrice}`}>{fmtNum(precioK)}</td>
      <td className={`mono ${styles.cell} ${styles.cAbono}`}>{fmtNum(toEur(abono))}</td>
    </tr>
  );
}

/** Tabla (cuerpo) de un capítulo: grupos por subcapítulo + subtotales por modo. */
export function CertChapterTable({
  chapter,
  partidas,
  curData,
  prevData,
  mode,
  coefK,
}: {
  chapter: Chapter;
  partidas: Partida[];
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
}) {
  const groups = groupBySub(chapter, partidas).filter((g) => g.items.length > 0);
  const subTotal = (items: Partida[]): Cents =>
    sumCents(
      items.map((p) => {
        const k = certCalc(p, curData, prevData, coefK);
        return mode === 'origen' ? k.aOrigen : k.estaCert;
      }),
    );

  return (
    <table className={`ctable ${styles.table}`}>
      <tbody>
        {groups.map((g, gi) => (
          <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
            {g.sub && (
              <tr className={styles.subRow}>
                <td colSpan={7}>
                  <div className={styles.subLabel}>
                    <span className={`mono ${styles.subCode}`}>{g.sub.code}</span>
                    <span className={`caps ${styles.subTitle}`}>{g.sub.title}</span>
                  </div>
                </td>
                <td className={`mono ${styles.subImporte}`}>{fmtNum(toEur(subTotal(g.items)))}</td>
              </tr>
            )}
            {g.items.map((p) => (
              <CertRow
                key={p.id}
                p={p}
                curData={curData}
                prevData={prevData}
                mode={mode}
                coefK={coefK}
              />
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
