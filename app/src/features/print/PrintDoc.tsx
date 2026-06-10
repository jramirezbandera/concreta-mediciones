import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  buildCertListado,
  buildPresupuestoListado,
  obraMeta,
} from '../../core/listado';
import { fmtNum } from '../../core/money';
import { selectResumen, useObraStore } from '../../store';
import { ResumenSheet } from '../resumen';
import { PrintCert } from './PrintCert';
import { PrintPresupuesto } from './PrintPresupuesto';
import './print.css';

/** Qué documento se imprime (chooser del ExportModal). */
export type PrintTarget =
  | { kind: 'presupuesto' }
  | { kind: 'resumen' }
  | { kind: 'cert'; index: number };

/** Fecha ISO → "11 de junio de 2026" ('' si falta). */
function fmtFecha(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Documento de impresión dedicado (F7.1): portal a nivel de <body>, montado
 * BAJO DEMANDA por la acción Exportar y desmontado al terminar (eng-review F7
 * §3). Solo lectura (sin inputs) y SIEMPRE en tema claro (papel). Orquestación
 * endurecida: espera a las fuentes + doble rAF antes de `window.print()`,
 * cierra por `afterprint` con fallback por timeout, y una guarda evita el
 * doble print de StrictMode.
 */
export function PrintDoc({ target, onDone }: { target: PrintTarget; onDone: () => void }) {
  const chapters = useObraStore((s) => s.chapters);
  const partidas = useObraStore((s) => s.partidas);
  const certs = useObraStore((s) => s.certs);
  const rates = useObraStore((s) => s.rates);
  const obra = useObraStore((s) => s.obra);
  const resumen = useObraStore(selectResumen);
  const meta = obraMeta(obra);

  // Mientras el doc está montado, al imprimir se oculta la app (print.css).
  useEffect(() => {
    document.body.classList.add('printing');
    return () => document.body.classList.remove('printing');
  }, []);

  const started = useRef(false);
  useEffect(() => {
    const finish = () => onDone();
    window.addEventListener('afterprint', finish);
    let timer = 0;
    if (!started.current) {
      started.current = true; // guarda anti-doble-print (StrictMode)
      const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
      void (fonts?.ready ?? Promise.resolve()).then(() => {
        // Doble rAF: el portal ya está pintado antes de abrir el diálogo.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.print();
            // Fallback: si el navegador no emite `afterprint`, desmonta igual.
            timer = window.setTimeout(finish, 500);
          });
        });
      });
    }
    return () => {
      window.removeEventListener('afterprint', finish);
      if (timer) window.clearTimeout(timer);
    };
  }, [onDone]);

  let titulo: string;
  let extraMeta: ReactNode = null;
  let body: ReactNode;
  if (target.kind === 'presupuesto') {
    titulo = 'Presupuesto y mediciones';
    body = <PrintPresupuesto data={buildPresupuestoListado(chapters, partidas, rates.coefK)} />;
  } else if (target.kind === 'resumen') {
    titulo = 'Resumen de presupuesto';
    body = <ResumenSheet data={resumen} readOnly />;
  } else {
    const cl = buildCertListado(chapters, partidas, certs, target.index, rates);
    titulo = cl ? `Certificación de obra nº ${cl.num}` : 'Certificación de obra';
    if (cl) {
      const congelados = fmtFecha(cl.snapshotAt);
      extraMeta = (
        <>
          {cl.period && (
            <span>
              <b>Periodo</b> {cl.period}
            </span>
          )}
          <span>
            <b>Ejecución global</b> {fmtNum(cl.totals.pctGlobal, 1)}%
          </span>
          {congelados && (
            <span>
              <b>Precios congelados</b> {congelados}
            </span>
          )}
        </>
      );
      body = <PrintCert data={cl} />;
    } else {
      body = null;
    }
  }

  return createPortal(
    <div className="print-doc" data-theme="light">
      <header className="pd-head">
        <div className="caps pd-kicker">{titulo}</div>
        <h1 className="pd-obra">{meta.denominacion || 'Obra sin denominación'}</h1>
        {(meta.direccion || meta.localidad) && (
          <div className="pd-dir">
            {[meta.direccion, [meta.localidad, meta.provincia].filter(Boolean).join(' · ')]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
        <div className="pd-meta">
          {meta.expediente && (
            <span>
              <b>Expediente</b> {meta.expediente}
            </span>
          )}
          {meta.promotor && (
            <span>
              <b>Promotor</b> {meta.promotor}
            </span>
          )}
          {meta.constructora && (
            <span>
              <b>Constructora</b> {meta.constructora}
            </span>
          )}
          {meta.redactor && (
            <span>
              <b>Técnico</b> {meta.redactor}
            </span>
          )}
          {extraMeta}
        </div>
      </header>
      {body}
      {(meta.lugarFecha || meta.redactor) && (
        <footer className="pd-sign">
          {meta.lugarFecha && <div>{meta.lugarFecha}</div>}
          {meta.redactor && <div className="pd-sign-name">{meta.redactor}</div>}
        </footer>
      )}
    </div>,
    document.body,
  );
}
