/* ===========================================================================
   DialogoRecalcular — la pregunta al calibrar una página que ya tiene líneas
   medidas (§2, §4.4, A1): «¿La escala anterior estaba mal?».

   · Cancelar es la opción por defecto: tiene el foco, así Enter cancela, y la
     página se queda como estaba.
   · El plan (`planRecalculo`) sale del estado vivo en cada render: lo que se
     ve es lo que se aplica. Si aun así algo cambió al confirmar (`stale`), se
     dice y la pregunta sigue abierta con el plan nuevo.
   · Recalcular cambia la escala y las líneas en UN paso de Deshacer.
   =========================================================================== */
import { useMemo, useRef, useState } from 'react';
import { Modal } from '../../components';
import { fmtNum } from '../../core/money';
import { escalaDe } from '../../core/planoDatos';
import { planRecalculo, type ApartePlano } from '../../core/planoRecalculo';
import type { Escala, MedLine, PlanoMeta } from '../../core/types';
import { useObraStore } from '../../store';
import { textoResultado } from '../../store/motivos';
import { textoEscala } from './textos';
import styles from './Planos.module.css';

const plural = (n: number, uno: string, varios: string) => `${fmtNum(n, 0)} ${n === 1 ? uno : varios}`;

/** «2 líneas certificadas en C1: revísalas a mano», por certificación. */
function textoAparte(aparte: ApartePlano[]): string[] {
  const out: string[] = [];
  const retocadas = aparte.filter((a) => a.motivo === 'retocada').length;
  const aceptadas = aparte.filter((a) => a.motivo === 'aceptada').length;
  if (retocadas) out.push(`${plural(retocadas, 'línea retocada a mano', 'líneas retocadas a mano')}: conserva${retocadas === 1 ? '' : 'n'} su escala.`);
  if (aceptadas) out.push(`${plural(aceptadas, 'línea con los valores aceptados', 'líneas con los valores aceptados')}: conserva${aceptadas === 1 ? '' : 'n'} su escala.`);
  const porCert = new Map<string, number>();
  for (const a of aparte)
    if (a.motivo === 'certificada') {
      const k = (a.certNums ?? []).map((n) => `C${n}`).join(', ');
      porCert.set(k, (porCert.get(k) ?? 0) + 1);
    }
  for (const [k, n] of porCert)
    out.push(`${plural(n, 'línea certificada', 'líneas certificadas')}${k ? ` en ${k}` : ''}: revísala${n === 1 ? '' : 's'} a mano.`);
  return out;
}

export function DialogoRecalcular({
  plano,
  pagina,
  nombrePagina,
  escala,
  onCancelar,
  onHecho,
}: {
  plano: PlanoMeta;
  pagina: number;
  /** «P1» o «Pág. 3». */
  nombrePagina: string;
  escala: Escala;
  onCancelar: () => void;
  /** Tras recalcular, con cuántas líneas. */
  onHecho: (lineas: number) => void;
}) {
  const partidas = useObraStore((s) => s.partidas);
  const certs = useObraStore((s) => s.certs);
  const plan = useMemo(() => planRecalculo({ partidas, certs }, plano.id, pagina, escala), [partidas, certs, plano.id, pagina, escala]);
  const anterior = escalaDe(plano, pagina);
  const [error, setError] = useState<string | null>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const n = plan.candidatas.length;

  const recalcular = () => {
    const s = useObraStore.getState();
    const valores: Record<string, Pick<MedLine, 'uds' | 'largo' | 'ancho' | 'alto'>> = {};
    for (const c of plan.candidatas) {
      const l = s.partidas[c.chapterId]?.find((p) => p.id === c.partidaId)?.med.find((x) => x.id === c.lineId);
      if (l) valores[c.lineId] = { uds: l.uds, largo: l.largo, ancho: l.ancho, alto: l.alto };
    }
    const r = s.rescalePlanoPage({
      planoId: plano.id,
      pagina,
      escala,
      lineIds: plan.candidatas.map((c) => c.lineId),
      expect: { docToken: s.docToken, huella: plano.huella, calRev: anterior?.rev ?? null, valores },
    });
    if (!r.ids.length) {
      setError(textoResultado(r));
      return;
    }
    onHecho(n);
  };

  const aparte = textoAparte(plan.aparte);
  return (
    <Modal
      open
      onClose={onCancelar}
      title="¿La escala anterior estaba mal?"
      icon="ruler"
      initialFocus={cancelar}
      closeOnOverlay={false}
      footer={
        <>
          <button ref={cancelar} type="button" className={styles.btn} onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={recalcular}>
            {n ? `Recalcular ${plural(n, 'línea', 'líneas')}` : 'Cambiar la escala'}
          </button>
        </>
      }
    >
      <div className={styles.recalculo}>
        <p>
          {nombrePagina} pasa de <b className="mono">{anterior ? textoEscala(anterior.n) : 'sin calibrar'}</b> a{' '}
          <b className="mono">{textoEscala(escala.n)}</b>.
          {n
            ? ` Se recalcula${n === 1 ? '' : 'n'} ${plural(n, 'línea', 'líneas')} (${plan.porEscala
                .map((g) => `${fmtNum(g.lineas, 0)} a ${textoEscala(g.n)}`)
                .join(' · ')}).`
            : ' Ninguna línea se recalcula sola.'}
        </p>
        {plan.porPartida.length > 0 && (
          <ul className={styles.recalculoPartidas}>
            {plan.porPartida.map((p) => (
              <li key={p.partidaId}>
                <span className="mono">{p.pos}</span> {p.title}
                <span className={`mono ${styles.recalculoCantidad}`}>
                  {plural(p.lineas, 'línea', 'líneas')} · {fmtNum(p.antes, 2)} → {fmtNum(p.despues, 2)} {p.ud}
                </span>
                {p.porDebajoDe && (
                  <span className={styles.recalculoAviso}>
                    C{p.porDebajoDe.certNum} certificó {fmtNum(p.porDebajoDe.cantidad, 2)} {p.ud}; la medición pasa a{' '}
                    {fmtNum(p.despues, 2)} {p.ud}.
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {aparte.map((t) => (
          <p key={t} className={styles.franjaTexto}>
            {t}
          </p>
        ))}
        <p className={styles.franjaTexto}>Si la escala anterior era buena y quieres medir un detalle a otra escala, cancela y adjunta el PDF otra vez.</p>
        {error && (
          <p className={styles.recalculoAviso} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
