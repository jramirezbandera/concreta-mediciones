/* ===========================================================================
   CopiarEscala — «Usar 1:50 en otras páginas» (§2, A1): las páginas sin
   escala del mismo tamaño que la calibrada. Las que dicen la misma escala en
   su texto salen marcadas; las que no dicen ninguna, sin marcar; las que
   dicen otra no se ofrecen. Se ofrece al terminar de calibrar (toast) y desde
   el menú ⋯.
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components';
import { escalaDe, etiquetaDe } from '../../core/planoDatos';
import { escalaDeclarada, etiquetaPropuesta } from '../../core/planoTexto';
import type { PlanoMeta } from '../../core/types';
import { useObraStore, useToastStore } from '../../store';
import { textoResultado } from '../../store/motivos';
import { paginasDelMismoTamano } from './paginasIguales';
import type { DocPdf } from './pdfTipos';
import { textoEscala } from './textos';
import styles from './Planos.module.css';

interface Candidata {
  n: number;
  etiqueta: string;
  /** Su texto dice la misma escala: sale marcada. */
  dice: boolean;
}

export function DialogoCopiarEscala({
  doc,
  plano,
  pagina,
  onCerrar,
}: {
  doc: DocPdf;
  plano: PlanoMeta;
  pagina: number;
  onCerrar: () => void;
}) {
  const escala = escalaDe(plano, pagina);
  const n = escala?.n ?? null;
  const [progreso, setProgreso] = useState(0);
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!n) {
      setCandidatas([]);
      return;
    }
    let vivo = true;
    void (async () => {
      const iguales = await paginasDelMismoTamano(doc, plano, pagina, () => vivo, setProgreso);
      const out: Candidata[] = [];
      for (const k of iguales) {
        if (!vivo) return;
        let dice: number | null = null;
        let propuesta: string | null = null;
        try {
          const textos = await doc.textos(k);
          const e = escalaDeclarada(textos);
          if (e.tipo === 'una') dice = e.n;
          // varias escalas en el texto (un detalle dentro): sin marcar
          propuesta = etiquetaPropuesta(textos);
        } catch {
          // sin texto legible: sin marcar
        }
        if (dice !== null && dice !== n) continue; // dice otra escala
        out.push({ n: k, etiqueta: etiquetaDe(plano, k) ?? propuesta ?? `Pág. ${k}`, dice: dice === n });
      }
      if (!vivo) return;
      setCandidatas(out);
      setMarcadas(new Set(out.filter((c) => c.dice).map((c) => c.n)));
    })();
    return () => {
      vivo = false;
    };
  }, [doc, plano, pagina, n]);

  const copiar = () => {
    if (!escala) return;
    const s = useObraStore.getState();
    const paginas = [...marcadas];
    const r = s.copyPlanoPageScale({ planoId: plano.id, desde: pagina, paginas, expect: { docToken: s.docToken, calRev: escala.rev } });
    onCerrar();
    if (!r.ids.length) {
      useToastStore.getState().show(textoResultado(r), undefined, { tone: 'error' });
      return;
    }
    useToastStore.getState().show(`Escala ${textoEscala(escala.n)} en ${paginas.length} ${paginas.length === 1 ? 'página más' : 'páginas más'}.`);
  };

  return (
    <Modal
      open
      onClose={onCerrar}
      title={`Usar ${n ? textoEscala(n) : 'esta escala'} en otras páginas`}
      icon="ruler"
      initialFocus={cancelar}
      footer={
        <>
          <button ref={cancelar} type="button" className={styles.btn} onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimario}`}
            disabled={!candidatas || marcadas.size === 0}
            onClick={copiar}
          >
            {`Usar en ${marcadas.size} ${marcadas.size === 1 ? 'página' : 'páginas'}`}
          </button>
        </>
      }
    >
      <div className={styles.recalculo}>
        <p>
          Páginas sin calibrar del mismo tamaño. Salen marcadas las que dicen {n ? textoEscala(n) : 'la misma escala'} en su texto;
          las que no dicen ninguna, márcalas si sabes que van a la misma escala.
        </p>
        {!candidatas && (
          <p className={styles.franjaTexto} role="status">
            Buscando páginas iguales… {progreso}/{plano.paginas}
          </p>
        )}
        {candidatas && candidatas.length === 0 && (
          <p className={styles.franjaTexto}>Ninguna otra página sin calibrar tiene el mismo tamaño y esta escala.</p>
        )}
        {candidatas && candidatas.length > 1 && (
          <button
            type="button"
            className={`${styles.btn} ${styles.marcarTodas}`}
            onClick={() => setMarcadas(marcadas.size === candidatas.length ? new Set() : new Set(candidatas.map((c) => c.n)))}
          >
            {marcadas.size === candidatas.length ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
        )}
        {candidatas && candidatas.length > 0 && (
          <ul className={styles.recalculoPartidas}>
            {candidatas.map((c) => (
              <li key={c.n}>
                <label className={styles.checkLinea}>
                  <input
                    type="checkbox"
                    checked={marcadas.has(c.n)}
                    onChange={(e) =>
                      setMarcadas((m) => {
                        const x = new Set(m);
                        if (e.target.checked) x.add(c.n);
                        else x.delete(c.n);
                        return x;
                      })
                    }
                  />
                  {c.etiqueta === `Pág. ${c.n}` ? c.etiqueta : `Pág. ${c.n} · ${c.etiqueta}`}
                  {!c.dice && candidatas.some((x) => x.dice) && <span className={styles.franjaTexto}> · sin escala en el texto</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
