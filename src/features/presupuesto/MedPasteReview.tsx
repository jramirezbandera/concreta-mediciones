import { useRef, type ReactNode } from 'react';
import { Modal } from '../../components';
import { medFormaDef } from '../../core/medForma';
import type { PegadoPreparado } from '../../core/medPaste';
import { fmtCents, fmtNum } from '../../core/money';
import type { MedForma } from '../../core/types';
import { useClipboardStore, useObraStore } from '../../store';
import { applyPaste, deleteLines, locatePartida, pasteLines, pasteText } from '../../store/medLineOps';
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

const lineas = (n: number) => (n === 1 ? 'la línea' : `${n} líneas`);

/** Formas incompatibles: qué se reinterpreta y cuánto cambia el dinero. */
function FormasSection({ prep }: { prep: PegadoPreparado }) {
  const { origen, destino, compat, antes, despues } = prep;
  return (
    <section className={styles.section}>
      <div className={styles.sides}>
        <div>
          <div className={`caps ${styles.label}`}>Origen</div>
          <div className={styles.side}>
            {origen ? lado(origen.code, origen.forma, origen.ud) : 'Texto pegado (hoja de cálculo)'}
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
      <Dinero prep={prep} antes={antes} despues={despues} />
    </section>
  );
}

/** Cantidad e importe del destino antes → después. */
function Dinero({
  prep,
  antes,
  despues,
}: {
  prep: PegadoPreparado;
  antes: PegadoPreparado['antes'];
  despues: PegadoPreparado['despues'];
}) {
  const { destino } = prep;
  return (
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
  );
}

/** Líneas certificadas afectadas: cuáles (hasta 5), dónde y qué pasa. */
function CertSection({
  partidaId,
  total,
  certLineIds,
  certNums,
  note,
}: {
  partidaId: string;
  total: number;
  certLineIds: string[];
  certNums: number[];
  note: string;
}) {
  const p = locatePartida(partidaId)?.partida;
  const names = certLineIds.map((id) => {
    const i = p?.med.findIndex((l) => l.id === id) ?? -1;
    const l = i >= 0 ? p!.med[i] : undefined;
    return l?.comment.trim() || `Línea ${i + 1}`;
  });
  const shown = names.slice(0, 5);
  const more = names.length - shown.length;
  return (
    <section className={styles.section}>
      <p className={styles.lead}>
        {total > 1 ? `${certLineIds.length} de ${total} líneas están certificadas` : 'Esta línea está certificada'} en{' '}
        {certNums.length > 1 ? 'las certificaciones' : 'la certificación'} {certList(certNums)}.
      </p>
      <ul className={styles.lines}>
        {shown.map((name, i) => (
          <li key={certLineIds[i]}>{name}</li>
        ))}
        {more > 0 && <li className={styles.more}>y {more} más</li>}
      </ul>
      <p className={styles.note}>{note}</p>
    </section>
  );
}

/** Contenido, título y acciones de cada caso. */
function contenido(review: MedReview): {
  title: string;
  body: ReactNode;
  primary: string;
  danger?: boolean;
  secondary?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
} {
  if (review.kind === 'delete') {
    const n = review.lineIds.length;
    return {
      title: n === 1 ? 'Eliminar una línea certificada' : 'Eliminar líneas certificadas',
      body: (
        <CertSection
          partidaId={review.partidaId}
          total={n}
          certLineIds={review.certLineIds}
          certNums={review.certNums}
          note="La certificación conserva la cantidad (aparece como «línea eliminada»), pero se pierden su comentario y sus dimensiones."
        />
      ),
      primary: `Eliminar ${lineas(n)}`,
      danger: true,
      onPrimary: () =>
        deleteLines(review.partidaId, review.lineIds, { confirmed: true, toast: review.toast, col: review.col }),
    };
  }

  if (review.kind === 'choose') {
    const { partidaId, afterId, text, srcCode, n } = review;
    if (review.reason === 'cut-text')
      return {
        title: '¿Mover las líneas cortadas o pegar una copia?',
        body: (
          <p className={styles.lead}>
            Lo que pegas coincide con {n === 1 ? 'la línea cortada' : `las ${n} líneas cortadas`} de{' '}
            {srcCode || 'otra partida'}, pero llega sin la marca del corte (se copió por otra vía). Elige qué hacer.
          </p>
        ),
        primary: `Mover las líneas cortadas de ${srcCode || 'la partida'}`,
        secondary: 'Pegar una copia',
        onPrimary: () => pasteLines(partidaId, afterId, { authority: true }),
        onSecondary: () => {
          useClipboardStore.getState().uncutMedClip();
          pasteLines(partidaId, afterId);
        },
      };
    return {
      title: 'Esas líneas ya se movieron',
      body: (
        <p className={styles.lead}>
          Lo que pegas es un corte que ya se movió. Se puede pegar como copia nueva, con líneas nuevas.
        </p>
      ),
      primary: 'Pegar una copia',
      onPrimary: () => pasteText(partidaId, afterId, text),
    };
  }

  const { prep } = review;
  const m = prep.mover;
  const sections: ReactNode[] = [];
  let title = 'Esta partida se mide de otra forma';
  let primary = 'Pegar tal cual';
  if (prep.copiaGuardada) {
    title = 'Las líneas cortadas ya no existen';
    primary = 'Pegar la copia guardada';
    sections.push(
      <section key="copia" className={styles.section}>
        <p className={styles.lead}>
          Las líneas cortadas ya no están en {prep.origen?.code || 'su partida'}. Se puede pegar la copia que se
          guardó al cortar, como líneas nuevas.
        </p>
      </section>,
    );
  }
  if (m) {
    const total = m.lineIds.length + m.faltan;
    primary = m.faltan > 0 ? `Mover ${m.lineIds.length === 1 ? 'la restante' : `las ${m.lineIds.length} restantes`}` : `Mover ${lineas(m.lineIds.length)}`;
    if (m.faltan > 0) {
      title = 'Algunas líneas cortadas ya no existen';
      sections.push(
        <section key="faltan" className={styles.section}>
          <p className={styles.lead}>
            {m.faltan} de {total} líneas cortadas ya no existen en {m.srcCode || 'su partida'}. Se moverán las que
            quedan.
          </p>
        </section>,
      );
    } else if (prep.compat.compatible) {
      title = 'Mover líneas certificadas';
    }
  }
  if (!prep.compat.compatible) {
    title = 'Esta partida se mide de otra forma';
    sections.push(<FormasSection key="formas" prep={prep} />);
  }
  if (m && !m.mismaPartida && m.certLineIds.length) {
    sections.push(
      <CertSection
        key="cert"
        partidaId={m.srcPartidaId}
        total={m.lineIds.length}
        certLineIds={m.certLineIds}
        certNums={m.certNums}
        note={`Lo ya certificado se queda en ${m.srcCode || 'la partida de origen'}; las líneas en destino empiezan sin certificar.`}
      />,
    );
  }
  if (prep.compat.compatible && !m?.mismaPartida && (m || prep.copiaGuardada))
    sections.push(<Dinero key="dinero" prep={prep} antes={prep.antes} despues={prep.despues} />);
  return {
    title,
    body: <div className={styles.stack}>{sections}</div>,
    primary,
    onPrimary: () => applyPaste(prep, review.nota),
  };
}

/**
 * Diálogo ÚNICO de revisión de las acciones sobre líneas que pueden cambiar
 * dinero o historia: pegar o mover entre formas de medir incompatibles, mover
 * o borrar líneas certificadas, un corte cuyas líneas ya no existen, y un
 * pegado que no trae la marca del corte. Reúne en UNA confirmación cada
 * problema que haya, con una acción principal específica; el foco inicial va a
 * «Cancelar», y cancelar no cambia nada. En compacto entra como hoja inferior.
 */
export function MedPasteReview({ compact = false }: { compact?: boolean }) {
  const review = useMedUiStore((s) => s.review);
  const closeReview = useMedUiStore((s) => s.closeReview);
  // Se lee para re-renderizar si la partida cambia con el diálogo abierto.
  useObraStore((s) => s.partidas);
  const cancelRef = useRef<HTMLButtonElement>(null);
  if (!review) return null;

  const c = contenido(review);
  const run = (fn: () => void) => () => {
    closeReview();
    fn();
  };

  return (
    <Modal
      open
      onClose={closeReview}
      title={c.title}
      icon="alert"
      compact={compact}
      closeOnOverlay={false}
      initialFocus={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={closeReview}>
            Cancelar
          </button>
          {c.secondary && c.onSecondary && (
            <button type="button" className={styles.cancel} onClick={run(c.onSecondary)}>
              {c.secondary}
            </button>
          )}
          <button type="button" className={c.danger ? styles.danger : styles.confirm} onClick={run(c.onPrimary)}>
            {c.primary}
          </button>
        </>
      }
    >
      {c.body}
    </Modal>
  );
}
