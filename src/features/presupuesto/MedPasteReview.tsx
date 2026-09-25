import { useRef } from 'react';
import { Modal } from '../../components';
import { medFormaDef } from '../../core/medForma';
import type { PegadoPreparado } from '../../core/medPaste';
import { fmtCents, fmtNum } from '../../core/money';
import type { MedForma } from '../../core/types';
import { useObraStore } from '../../store';
import { applyPaste, deleteLines, locatePartida } from '../../store/medLineOps';
import { useMedUiStore, type MedReview } from '../../store/medUiStore';
import styles from './MedPasteReview.module.css';

/** «<código> · <forma> · <columnas> · <ud>», como se enseña origen y destino. */
function lado(code: string, forma: MedForma, ud: string): string {
  const def = medFormaDef(forma);
  return [code || '—', def.nombre, def.cols.join(' · '), ud].join(' · ');
}

/** «nº 1», «nº 1 y nº 3», «nº 1, nº 2 y nº 4». */
function certList(nums: number[]): string {
  const xs = nums.map((n) => `nº ${n}`);
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

/** Formas incompatibles: qué se reinterpreta y cuánto cambia el dinero. */
function FormasSection({ prep }: { prep: PegadoPreparado }) {
  const { origen, destino, compat, antes, despues } = prep;
  return (
    <section className={styles.section}>
      <div className={styles.sides}>
        <div>
          <div className={`caps ${styles.label}`}>Origen</div>
          <div className={styles.side}>
            {origen ? lado(origen.code, origen.forma, origen.ud) : 'Texto pegado'}
          </div>
        </div>
        <div>
          <div className={`caps ${styles.label}`}>Destino</div>
          <div className={styles.side}>{lado(destino.code, destino.forma, destino.ud)}</div>
        </div>
      </div>
      {(compat.cambios.length > 0 || compat.udCambia) && (
        <ul className={styles.changes}>
          {compat.cambios.map((c) => (
            <li key={c.slot} className={styles.warn}>
              {c.fuera
                ? `${c.de} → fuera de «${medFormaDef(destino.forma).nombre}» (columna ${c.a})`
                : `${c.de} → ${c.a}`}
            </li>
          ))}
          {compat.udCambia && origen && (
            <li className={styles.warn}>
              Unidad {origen.ud} → {destino.ud}
            </li>
          )}
        </ul>
      )}
      <p className={styles.note}>Se reinterpretan las cifras; no se convierten unidades.</p>
      <dl className={styles.money}>
        <dt>Cantidad de {destino.code || 'la partida'}</dt>
        <dd className="mono">
          {fmtNum(antes.cantidad)} → {fmtNum(despues.cantidad)} {destino.ud}
        </dd>
        <dt>Importe</dt>
        <dd className="mono">
          {fmtCents(antes.importe)} → {fmtCents(despues.importe)}
        </dd>
      </dl>
    </section>
  );
}

/** Borrar líneas certificadas: cuáles, en qué certificaciones y qué se pierde. */
function CertSection({ review }: { review: Extract<MedReview, { kind: 'delete' }> }) {
  const p = locatePartida(review.partidaId)?.partida;
  const names = review.certLineIds.map((id) => {
    const i = p?.med.findIndex((l) => l.id === id) ?? -1;
    const l = i >= 0 ? p!.med[i] : undefined;
    return l?.comment.trim() || `Línea ${i + 1}`;
  });
  const shown = names.slice(0, 5);
  const more = names.length - shown.length;
  const nCert = review.certLineIds.length;
  const nAll = review.lineIds.length;
  return (
    <section className={styles.section}>
      <p className={styles.lead}>
        {nAll > 1 ? `${nCert} de ${nAll} líneas están certificadas` : 'Esta línea está certificada'} en{' '}
        {review.certNums.length > 1 ? 'las certificaciones' : 'la certificación'} {certList(review.certNums)}.
      </p>
      <ul className={styles.lines}>
        {shown.map((name, i) => (
          <li key={review.certLineIds[i]}>{name}</li>
        ))}
        {more > 0 && <li className={styles.more}>y {more} más</li>}
      </ul>
      <p className={styles.note}>
        La certificación conserva la cantidad (aparece como «línea eliminada»), pero se pierden su
        comentario y sus dimensiones.
      </p>
    </section>
  );
}

/**
 * Diálogo ÚNICO de revisión de las acciones sobre líneas que pueden cambiar
 * dinero o historia: pegar entre formas de medir incompatibles y borrar líneas
 * certificadas. Una sola confirmación con una acción principal específica
 * («Pegar tal cual», «Eliminar N líneas»); el foco inicial va a «Cancelar», y
 * cancelar no cambia nada. En compacto entra como hoja inferior.
 */
export function MedPasteReview({ compact = false }: { compact?: boolean }) {
  const review = useMedUiStore((s) => s.review);
  const closeReview = useMedUiStore((s) => s.closeReview);
  // Se lee para re-renderizar si la partida cambia con el diálogo abierto.
  useObraStore((s) => s.partidas);
  const cancelRef = useRef<HTMLButtonElement>(null);
  if (!review) return null;

  const isDelete = review.kind === 'delete';
  const n = isDelete ? review.lineIds.length : review.prep.lines.length;
  const primary = isDelete ? `Eliminar ${n === 1 ? 'la línea' : `${n} líneas`}` : 'Pegar tal cual';
  const title = isDelete
    ? n === 1
      ? 'Eliminar una línea certificada'
      : 'Eliminar líneas certificadas'
    : 'Esta partida se mide de otra forma';

  const confirm = () => {
    closeReview();
    if (review.kind === 'paste') applyPaste(review.prep);
    else
      deleteLines(review.partidaId, review.lineIds, { confirmed: true, toast: review.toast, col: review.col });
  };

  return (
    <Modal
      open
      onClose={closeReview}
      title={title}
      icon="alert"
      compact={compact}
      closeOnOverlay={false}
      initialFocus={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={closeReview}>
            Cancelar
          </button>
          <button
            type="button"
            className={isDelete ? styles.danger : styles.confirm}
            onClick={confirm}
          >
            {primary}
          </button>
        </>
      }
    >
      {review.kind === 'paste' ? <FormasSection prep={review.prep} /> : <CertSection review={review} />}
    </Modal>
  );
}
