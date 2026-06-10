import { Fragment, useState, type MouseEvent } from 'react';
import { Badge, EditableNum, EditableText, Icon } from '../../components';
import {
  cantidadToPct,
  certCalc,
  estaCertDisplay,
  extraCalc,
  extrasCantidad,
  pctToCantidad,
} from '../../core/certificacion';
import { groupBySub } from '../../core/grouping';
import { lineParcial } from '../../core/medicion';
import { fmtNum, round2, sumCents, toEur, type Cents } from '../../core/money';
import type { CertExtra, MedLine, Partida, Chapter } from '../../core/types';
import { useObraStore, type CertMode } from '../../store';
import { PctBar } from './PctBar';
import styles from './Certificaciones.module.css';

/** No propagar el click al `<tr>` (que despliega) desde las celdas editables. */
function stop(e: MouseEvent) {
  e.stopPropagation();
}

/** Factores no vacíos de una línea, en formato "1 × 85,00 × 0,60". */
function dimsOf(l: MedLine): string {
  return [l.uds, l.largo, l.ancho, l.alto]
    .filter((v) => v !== '' && v != null)
    .map((v) => fmtNum(Number(v)))
    .join(' × ');
}

/** Desplegable por partida (F4.2 lectura + F4.3 marcar líneas): descripción +
 *  líneas de medición, cada una con casilla para certificarla "por trozos". */
function CertDetail({ p }: { p: Partida }) {
  const med = p.med ?? [];
  const lineQty = useObraStore((s) => s.certs[s.curCert]?.lineQty?.[p.id]);
  const setCertLine = useObraStore((s) => s.setCertLine);
  return (
    <div className={styles.detail}>
      <div className={styles.detailLabel}>Descripción</div>
      <p className={styles.detailDesc}>{p.desc || '—'}</p>
      <div className={styles.detailLabel}>Mediciones · marca las líneas ejecutadas</div>
      {med.length > 0 ? (
        <div className={styles.detailMed}>
          {med.map((l) => {
            const parcial = lineParcial(l);
            const marked = (lineQty?.[l.id] ?? 0) > 0;
            return (
              <div key={l.id} className={`${styles.detailMedRow} ${marked ? styles.lineOn : ''}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marked}
                  aria-label={`Marcar línea ejecutada: ${l.comment || 'sin comentario'}`}
                  className={`${styles.lineCheck} ${marked ? styles.on : ''}`}
                  onClick={() => setCertLine(p.id, l.id, marked ? null : parcial)}
                >
                  {marked && <Icon name="check" size={12} />}
                </button>
                <span className={`${styles.detailMedComment} ${l.comment ? '' : styles.empty}`}>
                  {l.comment || 'Sin comentario'}
                </span>
                <span className={`mono ${styles.detailMedDims}`}>{dimsOf(l) || '—'}</span>
                <span className={`mono ${styles.detailMedParcial}`}>{fmtNum(parcial)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.detailEmpty}>Sin líneas de medición.</p>
      )}
    </div>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const k = certCalc(p, curData, prevData, coefK);
  const abono = mode === 'origen' ? k.aOrigen : k.estaCert;
  // La cantidad editable (y su %) son las del MODO en curso (a origen / esta cert).
  const execValue = mode === 'origen' ? k.ejecutada : estaCertDisplay(k.ejecutada, k.prev);
  const execPct = cantidadToPct(k.ofertada, execValue);
  const precioK = round2((p.precio ?? 0) * coefK);
  return (
    <>
      <tr
        className={`tcol ${styles.row} ${expanded ? styles.expanded : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className={`${styles.cell} ${styles.cNum}`}>
          <div className={styles.numFlex}>
            <Icon
              name={expanded ? 'chevronDown' : 'chevron'}
              size={13}
              className={`${styles.chev} ${expanded ? styles.open : ''}`}
            />
            <div>
              <div className={`mono ${styles.pos}`}>{p.pos}</div>
              <div className={`mono ${styles.code}`}>{p.code}</div>
            </div>
          </div>
        </td>
        <td className={`${styles.cell} ${styles.cDesc}`}>
          <div className={styles.descInner}>
            {p.mainType && <Badge type={p.mainType} />}
            <span className={styles.title}>{p.title}</span>
          </div>
        </td>
        <td className={`mono ${styles.cell} ${styles.cUd}`}>{p.ud}</td>
        <td className={`mono ${styles.cell} ${styles.cNum2}`}>{fmtNum(k.ofertada)}</td>
        <td className={`${styles.cell} ${styles.cExec}`} onClick={stop}>
          <EditableNum
            value={execValue}
            dec={2}
            accent
            ariaLabel="Cantidad ejecutada"
            onCommit={(v) => onCertEdit(p.id, v, mode)}
          />
        </td>
        <td className={`${styles.cell} ${styles.cPct}`} onClick={stop}>
          {k.ofertada > 0 ? (
            <PctBar
              pct={execPct}
              onCommitPct={(pct) => onCertEdit(p.id, pctToCantidad(k.ofertada, pct), mode)}
            />
          ) : (
            <span className={styles.pctDash}>—</span>
          )}
        </td>
        <td className={`mono ${styles.cell} ${styles.cPrice}`}>{fmtNum(precioK)}</td>
        <td className={`mono ${styles.cell} ${styles.cAbono}`}>{fmtNum(toEur(abono))}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className={styles.detailCell}>
            <CertDetail p={p} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Fila de un precio contradictorio (F4.4): campos editables, vive en la cert. */
function CertExtraRow({
  e,
  prevCantidad,
  mode,
}: {
  e: CertExtra;
  prevCantidad: number;
  mode: CertMode;
}) {
  const editContradictorio = useObraStore((s) => s.editContradictorio);
  const deleteContradictorio = useObraStore((s) => s.deleteContradictorio);
  const k = extraCalc(e, prevCantidad);
  const abono = mode === 'origen' ? k.aOrigen : k.estaCert;
  return (
    <tr className={`tcol ${styles.row} ${styles.extraRow}`}>
      <td className={`${styles.cell} ${styles.cNum}`}>
        <div className={styles.numFlex}>
          <div>
            <div className={`mono ${styles.pos}`}>{e.pos}</div>
            <div className={`mono ${styles.code}`}>P.C.</div>
          </div>
        </div>
      </td>
      <td className={`${styles.cell} ${styles.cDesc}`}>
        <div className={styles.descInner}>
          <span className={styles.pcBadge}>
            <span className="dot" style={{ background: 'var(--state-warn)' }} />
            P.C.
          </span>
          <EditableText
            value={e.title}
            ariaLabel="Título del contradictorio"
            placeholder="Descripción del precio contradictorio…"
            style={{ fontSize: 13 }}
            onCommit={(v) => editContradictorio(e.id, 'title', v)}
          />
        </div>
      </td>
      <td className={`mono ${styles.cell} ${styles.cUd}`} onClick={stop}>
        <EditableText
          value={e.ud}
          ariaLabel="Unidad"
          placeholder="ud"
          style={{ fontSize: 12.5, textAlign: 'center' }}
          onCommit={(v) => editContradictorio(e.id, 'ud', v)}
        />
      </td>
      <td className={`mono ${styles.cell} ${styles.cNum2}`}>—</td>
      <td className={`${styles.cell} ${styles.cExec}`} onClick={stop}>
        <EditableNum
          value={e.cantidad}
          dec={2}
          accent
          ariaLabel="Cantidad ejecutada"
          onCommit={(v) => editContradictorio(e.id, 'cantidad', v)}
        />
      </td>
      <td className={`${styles.cell} ${styles.cPct}`}>
        <span className={styles.pctDash}>—</span>
      </td>
      <td className={`${styles.cell} ${styles.cPrice}`} onClick={stop}>
        <EditableNum
          value={e.precio}
          dec={2}
          ariaLabel="Precio"
          onCommit={(v) => editContradictorio(e.id, 'precio', v)}
        />
      </td>
      <td className={`mono ${styles.cell} ${styles.cAbono}`}>
        <span className={styles.extraAbono}>
          {fmtNum(toEur(abono))}
          <button
            type="button"
            className={styles.extraDel}
            aria-label="Eliminar contradictorio"
            onClick={() => deleteContradictorio(e.id)}
          >
            <Icon name="trash" size={13} />
          </button>
        </span>
      </td>
    </tr>
  );
}

/** Tabla (cuerpo) de un capítulo: grupos por subcapítulo + subtotales por modo,
 *  seguidos de los precios contradictorios (F4.4) y el botón de alta. */
export function CertChapterTable({
  chapter,
  partidas,
  curData,
  prevData,
  mode,
  coefK,
  extras,
  prevExtras,
}: {
  chapter: Chapter;
  partidas: Partida[];
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
  extras: CertExtra[];
  prevExtras: CertExtra[];
}) {
  const addContradictorio = useObraStore((s) => s.addContradictorio);
  const groups = groupBySub(chapter, partidas).filter((g) => g.items.length > 0);
  const chapExtras = extras.filter((e) => e.chapterId === chapter.id);
  const prevCant = extrasCantidad(prevExtras);
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
        {chapExtras.map((e) => (
          <CertExtraRow key={e.id} e={e} prevCantidad={prevCant[e.id] ?? 0} mode={mode} />
        ))}
        <tr className={styles.addRow}>
          <td colSpan={8}>
            <button
              type="button"
              className={`tcol ${styles.addBtn}`}
              onClick={() => addContradictorio(chapter.id)}
            >
              <Icon name="plus" size={13} /> Añadir precio contradictorio
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
