import { Fragment, useState, type MouseEvent } from 'react';
import { Badge, EditableNum, EditableText, Icon, UdSelect } from '../../components';
import {
  cantidadToPct,
  cerradaLabel,
  certBaja,
  certCalc,
  certPrecioK,
  estaCertDisplay,
  extraCalc,
  extrasCantidad,
  pctToCantidad,
  type CertDeletedRow,
  type CertSnapshot,
} from '../../core/certificacion';
import { groupsForFocus } from '../../core/grouping';
import { rollupByDepth } from '../../core/tree';
import { lineParcial } from '../../core/medicion';
import { fmtNum, round2, sumCents, toEur, type Cents } from '../../core/money';
import type { CertExtra, MedLine, Partida, Chapter } from '../../core/types';
import { useObraStore, type CertMode } from '../../store';
import { PctBar } from './PctBar';
import check from '../../styles/lineCheck.module.css';
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
 *  líneas de medición, cada una con casilla para certificarla "por trozos".
 *  Reutilizado por la fila (desktop) y la tarjeta (compacto). */
export function CertDetail({ p }: { p: Partida }) {
  const med = p.med ?? [];
  const lineQty = useObraStore((s) => s.certs[s.curCert]?.lineQty?.[p.id]);
  const setCertLine = useObraStore((s) => s.setCertLine);
  // Cerrada: las líneas quedan bloqueadas como la cantidad (hasta reabrirla).
  const cerrada = useObraStore((s) => Boolean(s.certs[s.curCert]?.cerradas?.[p.id]));
  // D-09: una línea MARCADA cuyo id ya no existe en la medición (se borró la
  // línea después de certificarla). El importe es correcto como histórico
  // (snapshot), pero sin fila no había checkbox con el que desmarcarla — el
  // único escape era el override manual, que arrasa TODO el lineQty.
  const deletedMarked = Object.entries(lineQty ?? {}).filter(
    ([id, qty]) => qty !== 0 && !med.some((l) => l.id === id),
  );
  return (
    <div className={styles.detail}>
      <div className={styles.detailLabel}>Descripción</div>
      <p className={styles.detailDesc}>{p.desc || '—'}</p>
      <div className={styles.detailLabel}>
        {cerrada ? 'Mediciones · partida cerrada' : 'Mediciones · marca las líneas ejecutadas'}
      </div>
      {med.length > 0 || deletedMarked.length > 0 ? (
        <div className={styles.detailMed}>
          {med.map((l) => {
            const parcial = lineParcial(l);
            const marked = (lineQty?.[l.id] ?? 0) !== 0; // E12: las de Restar, negativas
            return (
              <div key={l.id} className={`${styles.detailMedRow} ${marked ? styles.lineOn : ''}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marked}
                  aria-label={`Marcar línea ejecutada: ${l.comment || 'sin comentario'}`}
                  disabled={cerrada}
                  className={`tap-target ${check.lineCheck} ${marked ? check.on : ''}`}
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
          {deletedMarked.map(([id, qty]) => (
            <div key={id} className={`${styles.detailMedRow} ${styles.lineOn}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked
                aria-label="Desmarcar línea eliminada de la medición"
                disabled={cerrada}
                className={`tap-target ${check.lineCheck} ${check.on}`}
                onClick={() => setCertLine(p.id, id, null)}
              >
                <Icon name="check" size={12} />
              </button>
              <span className={`${styles.detailMedComment} ${styles.empty}`}>
                Línea eliminada de la medición (certificada en su día)
              </span>
              <span className={`mono ${styles.detailMedDims}`}>—</span>
              <span className={`mono ${styles.detailMedParcial}`}>{fmtNum(qty)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.detailEmpty}>Sin líneas de medición.</p>
      )}
      <CerrarPartida p={p} />
    </div>
  );
}

/** Cerrar / reabrir la partida (la contraparte de los contradictorios): lo que
 *  falta por ejecutar sale del presupuesto vigente. Sin nada ejecutado es «No se
 *  ejecuta»; con algo, se cierra con lo hecho. Va en el desplegable (fila y
 *  tarjeta); la fila tiene además el atajo al pasar el ratón. */
function CerrarPartida({ p }: { p: Partida }) {
  const cerrada = useObraStore((s) => Boolean(s.certs[s.curCert]?.cerradas?.[p.id]));
  const ejecutada = useObraStore((s) => s.certs[s.curCert]?.data[p.id] ?? 0);
  const coefK = useObraStore((s) => s.rates.coefK);
  const toggleCerrada = useObraStore((s) => s.toggleCerrada);
  const { bajaCant, baja } = certBaja(p, ejecutada, coefK);
  // Ya ejecutada entera: no queda nada que dar de baja → sin acción.
  if (!cerrada && bajaCant <= 0) return null;
  const hecha = ejecutada > 0;
  const falta = `${fmtNum(bajaCant)} ${p.ud}`.trim();
  return (
    <div className={`${styles.cerrarBox} ${cerrada ? styles.on : ''}`}>
      <p className={styles.cerrarText}>
        {cerrada ? (
          <>
            <b>{cerradaLabel(ejecutada)}.</b> No se ejecutan {falta}: {fmtNum(toEur(baja))} € dados
            de baja del presupuesto vigente.
          </>
        ) : hecha ? (
          <>
            ¿No se va a ejecutar el resto? Ciérrala con lo ejecutado: lo que falta ({falta}) sale del
            presupuesto vigente y no cuenta para la ejecución global.
          </>
        ) : (
          <>
            ¿No se va a ejecutar? Márcala: sale del presupuesto vigente y no cuenta para la ejecución
            global.
          </>
        )}
      </p>
      <button type="button" className={`tcol ${styles.cerrarBtn}`} onClick={() => toggleCerrada(p.id)}>
        <Icon name={cerrada ? 'undo' : 'ban'} size={13} />
        {cerrada ? 'Reabrir partida' : hecha ? 'Cerrar con lo ejecutado' : 'No se ejecuta'}
      </button>
    </div>
  );
}

/** Indicador de partida cerrada en la celda del % (fila y tarjeta) + reabrir. */
export function CerradaTag({ p, ejecutada, pct }: { p: Partida; ejecutada: number; pct: number }) {
  const toggleCerrada = useObraStore((s) => s.toggleCerrada);
  return (
    <div className={styles.pctCellInner}>
      <span
        className={styles.cerradaTag}
        title={`${cerradaLabel(ejecutada)}: lo que falta sale del presupuesto vigente`}
      >
        <Icon name="ban" size={11} />
        {ejecutada > 0 ? `Cerrada · ${fmtNum(pct, 0)} %` : 'No se ejecuta'}
      </span>
      <button
        type="button"
        className={`tap-target ${styles.reabrirBtn}`}
        aria-label={`Reabrir partida ${p.title}`}
        title="Reabrir partida"
        onClick={() => toggleCerrada(p.id)}
      >
        <Icon name="undo" size={12} />
      </button>
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
          <th className={styles.thRight} style={{ width: 150, paddingRight: 12 }}>
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
  snap,
}: {
  p: Partida;
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
  snap?: CertSnapshot;
}) {
  const onCertEdit = useObraStore((s) => s.onCertEdit);
  const completePartida = useObraStore((s) => s.completePartida);
  const uncompletePartida = useObraStore((s) => s.uncompletePartida);
  const toggleCerrada = useObraStore((s) => s.toggleCerrada);
  const cerrada = useObraStore((s) => Boolean(s.certs[s.curCert]?.cerradas?.[p.id]));
  const [expanded, setExpanded] = useState(false);
  const k = certCalc(p, curData, prevData, coefK, snap);
  const abono = mode === 'origen' ? k.aOrigen : k.estaCert;
  // Se puede cerrar si aún falta algo por ejecutar (si no, no hay baja).
  const cerrable = !cerrada && k.ofertada > 0 && k.ejecutada < k.ofertada;
  // «Completada» = ejecutada a origen ≥ ofertada (derivado; sin flag persistido).
  const complete = k.ofertada > 0 && k.ejecutada >= k.ofertada;
  // La cantidad editable (y su %) son las del MODO en curso (a origen / esta cert).
  const execValue = mode === 'origen' ? k.ejecutada : estaCertDisplay(k.ejecutada, k.prev);
  const execPct = cantidadToPct(k.ofertada, execValue);
  // Precio mostrado = el de la valoración (congelado si la cert lo tiene, F7.0).
  const precioK = round2(certPrecioK(p, coefK, snap));
  return (
    <>
      <tr
        data-editrow=""
        className={`tcol ${styles.row} ${expanded ? styles.expanded : ''} ${cerrada ? styles.rowCerrada : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className={`${styles.cell} ${styles.cNum}`}>
          <div className={styles.numFlex}>
            <button
              type="button"
              className={`tap-target ${styles.chevBtn}`}
              aria-expanded={expanded}
              aria-label={expanded ? `Contraer ${p.title}` : `Desplegar ${p.title}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              <Icon
                name={expanded ? 'chevronDown' : 'chevron'}
                size={13}
                className={`${styles.chev} ${expanded ? styles.open : ''}`}
              />
            </button>
            <div>
              <div className={`mono ${styles.pos}`}>{p.pos}</div>
              <div className={`mono ${styles.code}`}>{p.code}</div>
            </div>
          </div>
        </td>
        <td className={`${styles.cell} ${styles.cDesc}`}>
          <div className={styles.descInner}>
            {p.mainType && <Badge type={p.mainType} />}
            {p.contradictorio && (
              <span className={styles.pcBadge}>
                <span className="dot" style={{ background: 'var(--state-warn)' }} />
                P.C.
              </span>
            )}
            <span className={styles.title}>{p.title}</span>
          </div>
        </td>
        <td className={`mono ${styles.cell} ${styles.cUd}`}>{p.ud}</td>
        <td className={`mono ${styles.cell} ${styles.cNum2}`}>{fmtNum(k.ofertada)}</td>
        {cerrada ? (
          // Cerrada: la cantidad se ve pero no se edita (fuera del grid de Tab).
          <td className={`mono ${styles.cell} ${styles.cExec} ${styles.execLocked}`}>
            {fmtNum(execValue)}
          </td>
        ) : (
          <td className={`${styles.cell} ${styles.cExec}`} onClick={stop} data-editfield="" data-col="0">
            <EditableNum
              value={execValue}
              dec={2}
              accent
              field
              ariaLabel="Cantidad ejecutada"
              onCommit={(v) => onCertEdit(p.id, v, mode)}
            />
          </td>
        )}
        <td
          className={`${styles.cell} ${styles.cPct}`}
          onClick={stop}
          {...(k.ofertada > 0 && !cerrada ? { 'data-editfield': '', 'data-col': '1' } : {})}
        >
          {cerrada ? (
            <CerradaTag p={p} ejecutada={k.ejecutada} pct={k.pct} />
          ) : k.ofertada > 0 ? (
            <div className={styles.pctCellInner}>
              <div className={styles.pctBarWrap}>
                <PctBar
                  pct={execPct}
                  onCommitPct={(pct) => onCertEdit(p.id, pctToCantidad(k.ofertada, pct), mode)}
                />
              </div>
              <button
                type="button"
                role="checkbox"
                aria-checked={complete}
                aria-label={complete ? 'Quitar completado de la partida' : 'Completar partida al 100%'}
                title={
                  complete
                    ? `Completada al 100% a origen. Pulsa para deshacer${mode === 'esta' ? ' (esta certificación puede no sumar)' : ''}`
                    : 'Completar: 100% a origen'
                }
                className={`tap-target ${styles.completeCheck} ${complete ? styles.on : ''}`}
                onClick={() => (complete ? uncompletePartida(p.id) : completePartida(p.id))}
              >
                {complete && <Icon name="check" size={12} />}
              </button>
            </div>
          ) : (
            <span className={styles.pctDash}>—</span>
          )}
        </td>
        <td className={`mono ${styles.cell} ${styles.cPrice}`}>{fmtNum(precioK)}</td>
        <td className={`mono ${styles.cell} ${styles.cAbono}`}>
          {cerrable ? (
            <span className={styles.extraAbono}>
              <button
                type="button"
                className={`tap-target ${styles.cerrarRowBtn}`}
                aria-label={k.ejecutada > 0 ? `Cerrar con lo ejecutado: ${p.title}` : `No se ejecuta: ${p.title}`}
                title={
                  k.ejecutada > 0
                    ? 'Cerrar con lo ejecutado: el resto no se hará y sale del presupuesto vigente'
                    : 'No se ejecuta: sale del presupuesto vigente y no cuenta para la ejecución global'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCerrada(p.id);
                }}
              >
                <Icon name="ban" size={13} />
              </button>
              {fmtNum(toEur(abono))}
            </span>
          ) : (
            fmtNum(toEur(abono))
          )}
        </td>
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
    <tr data-editrow="" className={`tcol ${styles.row} ${styles.extraRow}`}>
      <td className={`${styles.cell} ${styles.cNum}`}>
        <div className={styles.numFlex}>
          <div>
            <div className={`mono ${styles.pos}`}>{e.pos}</div>
            <div className={`mono ${styles.code}`}>P.C.</div>
          </div>
        </div>
      </td>
      <td className={`${styles.cell} ${styles.cDesc}`} data-editfield="">
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
      <td className={`mono ${styles.cell} ${styles.cUd}`} onClick={stop} data-editfield="">
        <UdSelect
          value={e.ud}
          ariaLabel="Unidad"
          onCommit={(v) => editContradictorio(e.id, 'ud', v)}
        />
      </td>
      <td className={`mono ${styles.cell} ${styles.cNum2}`}>—</td>
      <td className={`${styles.cell} ${styles.cExec}`} onClick={stop} data-editfield="" data-col="0">
        <EditableNum
          value={e.cantidad}
          dec={2}
          accent
          field
          ariaLabel="Cantidad ejecutada"
          onCommit={(v) => editContradictorio(e.id, 'cantidad', v)}
        />
      </td>
      <td className={`${styles.cell} ${styles.cPct}`}>
        <span className={styles.pctDash}>—</span>
      </td>
      <td className={`${styles.cell} ${styles.cPrice}`} onClick={stop} data-editfield="">
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
            className={`tap-target ${styles.extraDel}`}
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

/** Sección «Eliminado del presupuesto» (auditoría D-01/D-02): rastro certificado
 *  de partidas borradas (filas de SOLO LECTURA — con nombre si dejaron tombstone
 *  v3; la valoración sale del precio congelado del snapshot) y contradictorios
 *  de capítulos borrados (siguen editables/borrables, para poder corregirlos o
 *  retirarlos). El documento se preserva: lo certificado no desaparece al borrar. */
export function CertDeletedTable({
  rows,
  extras,
  prevExtras,
  mode,
}: {
  rows: CertDeletedRow[];
  extras: CertExtra[];
  prevExtras: CertExtra[];
  mode: CertMode;
}) {
  const prevCant = extrasCantidad(prevExtras);
  return (
    <table className={`ctable ${styles.table}`}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={`tcol ${styles.row}`}>
            <td className={`${styles.cell} ${styles.cNum}`}>
              <div className={styles.numFlex}>
                <div>
                  <div className={`mono ${styles.code}`}>{r.code}</div>
                </div>
              </div>
            </td>
            <td className={`${styles.cell} ${styles.cDesc}`}>
              <div className={styles.descInner}>{r.title}</div>
            </td>
            <td className={`mono ${styles.cell} ${styles.cUd}`}>{r.ud || '—'}</td>
            <td className={`mono ${styles.cell} ${styles.cNum2}`}>—</td>
            <td className={`mono ${styles.cell} ${styles.cExec}`}>
              {fmtNum(mode === 'origen' ? r.ejecutada : round2(r.ejecutada - r.prev))}
            </td>
            <td className={`${styles.cell} ${styles.cPct}`}>
              <span className={styles.pctDash}>—</span>
            </td>
            <td className={`mono ${styles.cell} ${styles.cPrice}`}>{fmtNum(r.precio)}</td>
            <td className={`mono ${styles.cell} ${styles.cAbono}`}>
              {fmtNum(toEur(mode === 'origen' ? r.aOrigen : r.estaCert))}
            </td>
          </tr>
        ))}
        {extras.map((e) => (
          <CertExtraRow key={e.id} e={e} prevCantidad={prevCant[e.id] ?? 0} mode={mode} />
        ))}
      </tbody>
    </table>
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
  snap,
  extras,
  prevExtras,
  focus,
}: {
  chapter: Chapter;
  partidas: Partida[];
  curData: Data;
  prevData: Data;
  mode: CertMode;
  coefK: number;
  snap?: CertSnapshot;
  extras: CertExtra[];
  prevExtras: CertExtra[];
  /** Id de sub activo: aísla su subárbol (navegación de obras grandes). */
  focus?: string | null;
}) {
  const addContradictorio = useObraStore((s) => s.addContradictorio);
  // Grupos en pre-orden (N niveles): se conservan los contenedores intermedios
  // con descendientes certificables; el subtotal de cabecera es el ACUMULADO.
  const allGroups = groupsForFocus(chapter, partidas, focus);
  // Aislado a un sub: los contradictorios son del CAPÍTULO → ni filas ni alta.
  const subFocused = focus != null && focus !== chapter.id;
  const certImporte = (p: Partida): Cents => {
    const k = certCalc(p, curData, prevData, coefK, snap);
    return mode === 'origen' ? k.aOrigen : k.estaCert;
  };
  const rollups = rollupByDepth(
    allGroups,
    allGroups.map((g) => sumCents(g.items.map(certImporte))),
  );
  const counts = rollupByDepth(
    allGroups,
    allGroups.map((g) => g.items.length),
  );
  const groups = allGroups
    .map((g, i) => ({ ...g, rollup: rollups[i] ?? 0, n: counts[i] ?? 0 }))
    .filter((g) => g.n > 0);
  const chapExtras = subFocused ? [] : extras.filter((e) => e.chapterId === chapter.id);
  const prevCant = extrasCantidad(prevExtras);

  return (
    <table className={`ctable ${styles.table}`}>
      <tbody>
        {groups.map((g, gi) => (
          <Fragment key={g.sub?.id ?? `orphan-${gi}`}>
            {g.sub && (
              <tr className={styles.subRow}>
                <td colSpan={7}>
                  <div className={styles.subLabel} style={{ paddingLeft: (g.depth - 1) * 16 }}>
                    <span className={`mono ${styles.subCode}`}>{g.sub.code}</span>
                    <span className={`caps ${styles.subTitle}`}>{g.sub.title}</span>
                  </div>
                </td>
                <td className={`mono ${styles.subImporte}`}>{fmtNum(toEur(g.rollup))}</td>
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
                snap={snap}
              />
            ))}
          </Fragment>
        ))}
        {chapExtras.map((e) => (
          <CertExtraRow key={e.id} e={e} prevCantidad={prevCant[e.id] ?? 0} mode={mode} />
        ))}
        {!subFocused && (
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
        )}
      </tbody>
    </table>
  );
}
