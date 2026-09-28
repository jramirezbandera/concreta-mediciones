/* ===========================================================================
   EscalaCajetin — la escala del cajetín frente a la calibración (§2, A1):

   · `PopoverAjuste` (desde el chip de escala): «calibrada 1:49,7 · el plano
     dice 1:50», con [Ajustar al plano] / [Usar la calibrada] o, si no
     cuadran, el aviso y [Rehacer cota]. Con líneas medidas, el cambio pasa por
     la pregunta de recalcular.
   · `DialogoCopiarEscala` («Usar esta calibración en otras páginas»): busca
     las páginas del mismo tamaño y con la misma escala en el cajetín, y copia
     la escala «sin comprobar»: cada página pide su comprobación.
   =========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components';
import { fmtNum } from '../../core/money';
import { escalaDe, etiquetaDe } from '../../core/planoDatos';
import { DESVIACION_MAX } from '../../core/planoGeom';
import { desviacionCajetin, escalaCalibrada, escalaConAjuste, escalaDeclarada } from '../../core/planoTexto';
import type { Escala, PlanoMeta } from '../../core/types';
import { useObraStore, useToastStore } from '../../store';
import { nextCalRev } from '../../store/base';
import { textoResultado } from '../../store/motivos';
import type { DocPdf } from './pdfTipos';
import { textoEscala } from './textos';
import styles from './Planos.module.css';

export function PopoverAjuste({
  plano,
  pagina,
  escala,
  userUnit,
  readonly,
  onCerrar,
  onRecalcular,
  onRehacerCota,
  onHecho,
}: {
  plano: PlanoMeta;
  pagina: number;
  escala: Escala;
  userUnit: number;
  readonly: boolean;
  onCerrar: () => void;
  /** La página tiene líneas: pasar por la pregunta de recalcular con esta escala. */
  onRecalcular: (nueva: Escala, detalle: string) => void;
  onRehacerCota: () => void;
  onHecho: (texto: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  // Al abrir: foco en la primera acción; un clic fuera lo cierra.
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const fuera = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) cerrarRef.current();
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, []);

  const declarada = escala.escalaDeclarada!;
  const cal = escalaCalibrada(escala, userUnit);
  const cuadra = desviacionCajetin(cal.n, declarada) <= DESVIACION_MAX;
  const cambiar = (ajustada: boolean) => {
    const s = useObraStore.getState();
    const detalle = ajustada ? `ajustada al plano ${textoEscala(declarada)}` : `con la calibrada ${textoEscala(cal.n)}`;
    const r = s.setPlanoScaleAdjusted({
      planoId: plano.id,
      pagina,
      ajustada,
      userUnit,
      expect: { docToken: s.docToken, calRev: escala.rev },
    });
    onCerrar();
    if (r.reason === 'has-lines') {
      const nueva = escalaConAjuste(escala, ajustada, userUnit, nextCalRev(), new Date().toISOString());
      if (nueva) onRecalcular(nueva, detalle);
      return;
    }
    if (!r.ids.length) {
      useToastStore.getState().show(textoResultado(r), undefined, { tone: 'error' });
      return;
    }
    onHecho(`${etiquetaDe(plano, pagina) ?? `Pág. ${pagina}`} ${detalle}`);
  };

  return (
    <div
      ref={ref}
      className={styles.popoverAjuste}
      role="group"
      aria-label="Escala del cajetín"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCerrar();
        }
      }}
    >
      <p className="mono">
        calibrada {textoEscala(cal.n)} · el plano dice {textoEscala(declarada)}
      </p>
      {cuadra ? (
        <p className={styles.franjaTexto}>
          {escala.ajustada
            ? `Ajustada a la escala del plano: quita el error del clic (${fmtNum(desviacionCajetin(cal.n, declarada) * 100, 1)} %).`
            : 'Cuadran a menos del 1 %: se puede ajustar a la escala exacta del plano.'}
        </p>
      ) : (
        <p className={styles.recalculoAviso}>La calibración no cuadra con la escala del plano: ¿el PDF está a otro tamaño?</p>
      )}
      <div className={styles.popoverAcciones}>
        {cuadra && escala.ajustada && (
          <button type="button" className={styles.btn} disabled={readonly} onClick={() => cambiar(false)}>
            Usar la calibrada ({textoEscala(cal.n)})
          </button>
        )}
        {cuadra && !escala.ajustada && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} disabled={readonly} onClick={() => cambiar(true)}>
            Ajustar al plano ({textoEscala(declarada)})
          </button>
        )}
        {!cuadra && (
          <button
            type="button"
            className={styles.btn}
            disabled={readonly}
            onClick={() => {
              onCerrar();
              onRehacerCota();
            }}
          >
            Rehacer cota
          </button>
        )}
        <button type="button" className={styles.btn} onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

interface Candidata {
  n: number;
  etiqueta: string;
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
  const declarada = escala?.escalaDeclarada;
  const [progreso, setProgreso] = useState(0);
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const cancelar = useRef<HTMLButtonElement>(null);

  // Páginas del mismo tamaño, sin escala y con la misma escala en el cajetín.
  useEffect(() => {
    if (!declarada) {
      setCandidatas([]);
      return;
    }
    let vivo = true;
    void (async () => {
      const base = await doc.pagina(pagina);
      const w0 = base.vista[2] - base.vista[0];
      const h0 = base.vista[3] - base.vista[1];
      const out: Candidata[] = [];
      for (let n = 1; n <= plano.paginas; n++) {
        if (!vivo) return;
        setProgreso(n);
        if (n === pagina || escalaDe(plano, n)) continue;
        try {
          const i = await doc.pagina(n);
          const igual =
            Math.abs(i.vista[2] - i.vista[0] - w0) < 1 &&
            Math.abs(i.vista[3] - i.vista[1] - h0) < 1 &&
            i.rotacion === base.rotacion &&
            i.userUnit === base.userUnit;
          if (!igual) continue;
          const e = escalaDeclarada(await doc.textos(n));
          if (e.tipo === 'una' && e.n === declarada) out.push({ n, etiqueta: etiquetaDe(plano, n) ?? `Pág. ${n}` });
        } catch {
          // una página que no se puede leer no se ofrece
        }
      }
      if (!vivo) return;
      setCandidatas(out);
      setMarcadas(new Set(out.map((c) => c.n)));
    })();
    return () => {
      vivo = false;
    };
  }, [doc, plano, pagina, declarada]);

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
    useToastStore
      .getState()
      .show(
        `Escala ${textoEscala(escala.n)} copiada a ${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}: compruébala${paginas.length === 1 ? '' : 's'} con otra cota antes de medir.`,
      );
  };

  return (
    <Modal
      open
      onClose={onCerrar}
      title="Usar esta calibración en otras páginas"
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
            {`Copiar a ${marcadas.size} ${marcadas.size === 1 ? 'página' : 'páginas'}`}
          </button>
        </>
      }
    >
      <div className={styles.recalculo}>
        <p>
          Páginas del mismo tamaño, sin calibrar y con {declarada ? textoEscala(declarada) : 'la misma escala'} en el cajetín. Cada una
          pedirá su comprobación con otra cota antes de medir.
        </p>
        {!candidatas && (
          <p className={styles.franjaTexto} role="status">
            Buscando páginas iguales… {progreso}/{plano.paginas}
          </p>
        )}
        {candidatas && candidatas.length === 0 && (
          <p className={styles.franjaTexto}>Ninguna otra página tiene el mismo tamaño y la misma escala en el cajetín.</p>
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
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
