/* ===========================================================================
   features/asistente/AsistenteChat — panel del asistente de IA.
   ---------------------------------------------------------------------------
   Contenido del panel lateral (el <aside> lo monta App, compartiendo el hueco con
   Referencia). F-A3: el asistente ACTÚA sobre el presupuesto. El flujo de un turno:
     1. sella el contexto (obraId + curCert) al enviar.
     2. el modelo responde `{reply, ops}`.
     3. `planTurn` aplica las DIRECTAS (crear/agregar) ya y deja las de consecuencia
        (editar/borrar/set) como PROPUESTAS.
     4. el INFORME enumera cada op con su destino (defensa anti-alucinación); la
        PropuestaCard confirma las propuestas, que `applyProposals` aplica revalidando
        el sello. Todo lo aplicado ofrece «Deshacer» (undo global, un Ctrl+Z por lote).
   Decisiones de diseño F-A2 conservadas: filas de log compactas (la tarjeta es el
   único elemento con forma de tarjeta), cabecera de contexto, composer (Enter salto,
   Ctrl/⌘+Enter envía), estado vacío = onboarding, espera con umbral de red lenta,
   a11y (aria-live, foco). El panel lee la obra con getState() al enviar.
   =========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components';
import { findNode } from '../../core/tree';
import { useSessionStore } from '../../persist';
import {
  AI_ERROR_MESSAGES,
  AiError,
  buildChatSystem,
  buildChatTurns,
  buildObraSnapshot,
  CHAT_ENVELOPE_SCHEMA,
  currentSeal,
  planTurn,
  applyProposals,
  runChatTurn,
  selectActiveKey,
  type ApplyResult,
  type DiscardedOp,
  type PlanResult,
  type Proposal,
  type Seal,
} from '../../ai';
import { selectTotalConIva, useObraStore, useToastStore } from '../../store';
import { undo } from '../../store/temporal';
import { AjustesIA } from './AjustesIA';
import { PropuestaCard } from './PropuestaCard';
import styles from './AsistenteChat.module.css';

/** Tono de una línea del informe: verde hecho, ámbar atención, rojo no encontrado. */
type Tone = 'ok' | 'warn' | 'danger';
interface ReportRow {
  tone: Tone;
  text: string;
  reason?: string;
}
interface Report {
  rows: ReportRow[];
}

type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; reply: string; rawEnvelope: string }
  | { kind: 'report'; report: Report }
  | { kind: 'error'; message: string };

/** Propuestas pendientes de confirmar en la tarjeta, con el sello de su turno. */
interface Pending {
  proposals: Proposal[];
  seal: Seal;
}

/** Umbral (ms) tras el cual la espera avisa de red lenta. */
const SLOW_MS = 8000;

/** Sugerencias del estado vacío (F-A3: mezcla de consulta y acción contextual). */
interface Chip {
  label: string;
  when?: (s: ReturnType<typeof useObraStore.getState>) => boolean;
}
const CHIPS: Chip[] = [
  { label: 'Crea una partida de excavación en m³, precio 12,50' },
  {
    label: 'Añade una línea de 3×2 a la partida abierta',
    when: (s) => s.openPartidaId != null,
  },
  { label: '¿Cuánto suma la obra?' },
  { label: '¿Cuánto llevo certificado?', when: (s) => s.certs.length > 0 },
];

/* ---- construcción del informe enumerado ------------------------------------ */

function planReport(plan: PlanResult, discarded: DiscardedOp[]): Report {
  const rows: ReportRow[] = [];
  if (plan.readonlyBlocked) {
    rows.push({ tone: 'warn', text: 'La pestaña es de solo lectura: no he aplicado nada. Abre la obra en modo edición.' });
    return { rows };
  }
  if (plan.sealChanged) {
    rows.push({ tone: 'warn', text: 'El contexto cambió (otra obra o certificación): no he aplicado nada para no equivocarme.' });
    return { rows };
  }
  if (plan.createdChapter) {
    rows.push({ tone: 'ok', text: `Creé el capítulo «${plan.createdChapter}» (la obra estaba vacía).` });
  }
  for (const r of plan.applied) rows.push({ tone: 'ok', text: `${r.label} — ${r.detail}` });
  for (const r of plan.skipped) rows.push({ tone: 'warn', text: `${r.label} — ${r.detail}`, reason: r.reason });
  for (const r of plan.notFound) rows.push({ tone: 'danger', text: `${r.detail}`, reason: r.reason });
  for (const d of discarded) rows.push({ tone: 'warn', text: `Operación «${d.op}» no aplicada`, reason: d.reason });
  if (plan.overflow > 0) {
    rows.push({ tone: 'warn', text: `${plan.overflow} operación(es) por encima del tope de 40 no se aplicaron; dímelas en dos veces.` });
  }
  return { rows };
}

function applyReport(apply: ApplyResult): Report {
  const rows: ReportRow[] = [];
  if (apply.readonlyBlocked) {
    rows.push({ tone: 'warn', text: 'La pestaña es de solo lectura: no he aplicado los cambios.' });
    return { rows };
  }
  if (apply.sealChanged) {
    rows.push({ tone: 'warn', text: 'El contexto cambió antes de aplicar: descarté los cambios para no equivocarme.' });
    return { rows };
  }
  for (const r of apply.applied) rows.push({ tone: 'ok', text: `${r.label} — ${r.detail}` });
  for (const r of apply.skipped) rows.push({ tone: 'warn', text: `${r.label} — ${r.detail}`, reason: r.reason });
  for (const r of apply.notFound) rows.push({ tone: 'danger', text: `${r.label} — ${r.detail}`, reason: r.reason });
  return { rows };
}

/** Toast «Deshacer» cuando un lote mutó la obra (undo global lo revierte). */
function offerUndo(appliedCount: number): void {
  if (appliedCount <= 0) return;
  useToastStore
    .getState()
    .show(`${appliedCount} cambio${appliedCount === 1 ? '' : 's'} aplicado${appliedCount === 1 ? '' : 's'}`, {
      label: 'Deshacer',
      run: () => undo(),
    });
}

/* ---- fila de informe (colapsable cuando todo sale bien) --------------------- */

function InformeRows({ report }: { report: Report }) {
  const rows = report.rows;
  const allOk = rows.every((r) => r.tone === 'ok');
  const [expanded, setExpanded] = useState(!(allOk && rows.length > 5));

  if (allOk && rows.length > 5 && !expanded) {
    return (
      <button type="button" className={styles.linkBtn} onClick={() => setExpanded(true)}>
        {rows.length} operaciones aplicadas — ver detalle
      </button>
    );
  }
  return (
    <div className={styles.informe}>
      {rows.map((r, i) => (
        <div key={i} className={styles.repRow}>
          <span className={`${styles.dot} ${styles[`dot_${r.tone}`]}`} aria-hidden="true" />
          <span className={styles.repText}>
            {r.text}
            {r.reason && <span className={styles.repReason}> — {r.reason}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AsistenteChat() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const slowTimerRef = useRef<number | undefined>(undefined);
  const pendingTextRef = useRef('');
  const lastUserTextRef = useRef('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const setAsistenteOpen = useObraStore((s) => s.setAsistenteOpen);

  // Cabecera de contexto: solo campos de UI ligeros (no el dominio pesado).
  const obraName = useObraStore((s) => s.obra.denominacion);
  const active = useObraStore((s) => s.active);
  const openPartidaId = useObraStore((s) => s.openPartidaId);
  const curCert = useObraStore((s) => s.curCert);
  const certCount = useObraStore((s) => s.certs.length);
  const readonly = useSessionStore((s) => s.readonly);

  // Foco al abrir; devuelto al disparador (TopBar) al cerrar (patrón del Modal).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      window.clearTimeout(slowTimerRef.current);
      abortRef.current?.abort();
      prev?.focus?.();
    };
  }, []);

  // Auto-scroll al pie cuando llega contenido nuevo.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, busy, pending]);

  const runRequest = useCallback((turnItems: ChatItem[], userText: string) => {
    lastUserTextRef.current = userText;
    const { activeKey } = selectActiveKey();
    if (!activeKey) {
      setItems([
        ...turnItems,
        { kind: 'error', message: 'No hay clave de IA configurada. Ábrela en ajustes (⚙).' },
      ]);
      return;
    }

    // Sella el contexto AL ENVIAR: si al llegar la respuesta la obra/cert cambió,
    // el executor no aplicará nada (una respuesta vieja no describe el estado de ahora).
    const seal = currentSeal();
    const state = useObraStore.getState();
    const snapshot = buildObraSnapshot(state, selectTotalConIva(state));
    const system = buildChatSystem(snapshot);
    // Los informes de ejecución no viajan como turnos (no son del hilo user/assistant).
    const turns = buildChatTurns(turnItems.filter((it) => it.kind !== 'report'));

    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++reqIdRef.current;
    setBusy(true);
    setSlow(false);
    slowTimerRef.current = window.setTimeout(() => {
      if (reqIdRef.current === reqId) setSlow(true);
    }, SLOW_MS);

    runChatTurn(activeKey, {
      system,
      schema: CHAT_ENVELOPE_SCHEMA,
      turns,
      signal: controller.signal,
    })
      .then((env) => {
        if (reqIdRef.current !== reqId) return; // obsoleta (cancelada/superada)
        const next: ChatItem[] = [
          ...turnItems,
          {
            kind: 'assistant',
            reply: env.reply,
            rawEnvelope: JSON.stringify({ reply: env.reply, ops: env.ops }),
          },
        ];
        const hasOps = (env.ops && env.ops.length > 0) || env.discarded.length > 0;
        if (hasOps) {
          const plan = planTurn(env.ops ?? [], seal);
          next.push({ kind: 'report', report: planReport(plan, env.discarded) });
          offerUndo(plan.applied.length);
          setPending(plan.proposals.length > 0 ? { proposals: plan.proposals, seal } : null);
        }
        setItems(next);
      })
      .catch((err: unknown) => {
        if (reqIdRef.current !== reqId) return;
        if (err instanceof AiError && err.kind === 'aborted') return; // lo gestiona cancel()
        const kind = err instanceof AiError ? err.kind : 'unknown';
        setItems([...turnItems, { kind: 'error', message: AI_ERROR_MESSAGES[kind] }]);
      })
      .finally(() => {
        if (reqIdRef.current === reqId) {
          setBusy(false);
          setSlow(false);
          window.clearTimeout(slowTimerRef.current);
        }
      });
  }, []);

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      pendingTextRef.current = t;
      setPending(null); // un turno nuevo descarta una propuesta sin confirmar
      const next: ChatItem[] = [...itemsRef.current, { kind: 'user', text: t }];
      setItems(next);
      setDraft('');
      runRequest(next, t);
    },
    [busy, runRequest],
  );

  // Los handlers mutan el store (applyProposals): corren en el cuerpo del handler,
  // NUNCA dentro de un updater de setState (en StrictMode se ejecutaría dos veces).
  const applyPending = useCallback(() => {
    if (!pending) return;
    const res = applyProposals(pending.proposals, pending.seal);
    setItems((prev) => [...prev, { kind: 'report', report: applyReport(res) }]);
    offerUndo(res.applied.length);
    setPending(null);
  }, [pending]);

  const discardPending = useCallback(() => {
    if (!pending) return;
    setItems((prev) => [
      ...prev,
      { kind: 'report', report: { rows: [{ tone: 'warn', text: `Descarté ${pending.proposals.length} propuesta(s).` }] } },
    ]);
    setPending(null);
  }, [pending]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    reqIdRef.current++; // invalida la petición en vuelo
    window.clearTimeout(slowTimerRef.current);
    setBusy(false);
    setSlow(false);
    // Devuelve el texto del turno en vuelo al composer y quita ese turno del log.
    setItems((prev) => (prev[prev.length - 1]?.kind === 'user' ? prev.slice(0, -1) : prev));
    setDraft(pendingTextRef.current);
    inputRef.current?.focus();
  }, []);

  const retry = useCallback(() => {
    const cleaned = itemsRef.current.filter((it) => it.kind !== 'error');
    setItems(cleaned);
    runRequest(cleaned, lastUserTextRef.current);
  }, [runRequest]);

  const onComposerKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendText(draft);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (busy) cancel();
        else setAsistenteOpen(false);
      }
      // Enter sin modificador → salto de línea (comportamiento nativo).
    },
    [draft, busy, cancel, sendText, setAsistenteOpen],
  );

  // --- cabecera de contexto ---
  const found = findNode(useObraStore.getState().chapters, active);
  const ctxParts: string[] = [];
  if (found) ctxParts.push(`${found.node.code} ${found.node.title}`);
  if (openPartidaId) {
    const st = useObraStore.getState();
    const p = st.chapters.flatMap((c) => st.partidas[c.id] ?? []).find((x) => x.id === openPartidaId);
    if (p) ctxParts.push(`partida ${p.pos}`);
  }
  if (certCount > 0) ctxParts.push(`cert. nº ${curCert + 1}`);

  const empty = items.length === 0;

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <span className={styles.title}>
            <Icon name="assistant" size={15} /> Asistente
          </span>
          <div className={styles.headActions}>
            <button
              type="button"
              className="tcol icon-btn"
              title="Ajustes del asistente"
              aria-label="Ajustes del asistente"
              onClick={() => setSettingsOpen(true)}
            >
              <Icon name="command" size={15} />
            </button>
            <button
              type="button"
              className="tcol icon-btn"
              title="Cerrar asistente"
              aria-label="Cerrar asistente"
              onClick={() => setAsistenteOpen(false)}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        <div className={styles.ctx} title="Contexto actual">
          <span className={styles.ctxObra}>{obraName || 'Obra sin nombre'}</span>
          {ctxParts.length > 0 && <span className={styles.ctxRest}>· {ctxParts.join(' · ')}</span>}
          {readonly && <span className={styles.ro}>solo lectura</span>}
        </div>
      </header>

      <div ref={logRef} className={`scroll-thin ${styles.log}`} role="log" aria-live="polite">
        {empty ? (
          <div className={`dot-grid ${styles.empty}`}>
            <h3 className={styles.emptyTitle}>¿Qué necesitas de esta obra?</h3>
            <p className={styles.emptyDesc}>
              Puedo resolver dudas y actuar sobre tu presupuesto: crear partidas, dictar mediciones,
              editar precios… Los cambios sobre datos existentes te los muestro antes de aplicar.
            </p>
            <div className={styles.chips}>
              {CHIPS.filter((c) => !c.when || c.when(useObraStore.getState())).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={styles.chip}
                  onClick={() => sendText(c.label)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          items.map((it, i) => {
            if (it.kind === 'user') {
              return (
                <div key={i} className={`${styles.row} ${styles.rowUser}`}>
                  <span className={styles.role}>Tú</span>
                  <span className={styles.msg}>{it.text}</span>
                </div>
              );
            }
            if (it.kind === 'assistant') {
              return (
                <div key={i} className={`${styles.row} ${styles.rowAssistant}`}>
                  <span className={styles.role}>Asistente</span>
                  <span className={styles.msg}>{it.reply}</span>
                </div>
              );
            }
            if (it.kind === 'report') {
              return (
                <div key={i} className={`${styles.row} ${styles.rowReport}`}>
                  <InformeRows report={it.report} />
                </div>
              );
            }
            return (
              <div key={i} className={`${styles.row} ${styles.rowError}`}>
                <span className={styles.role}>
                  <Icon name="alert" size={13} /> Error
                </span>
                <span className={styles.msg}>
                  {it.message}
                  <button type="button" className={styles.linkBtn} onClick={retry}>
                    Reintentar
                  </button>
                </span>
              </div>
            );
          })
        )}

        {pending && (
          <PropuestaCard proposals={pending.proposals} onApply={applyPending} onDiscard={discardPending} />
        )}

        {busy && (
          <div className={styles.waiting} role="status">
            <Icon name="loader" size={14} className={styles.spin} />
            <span>{slow ? 'La red va lenta, sigo esperando…' : 'Consultando al asistente…'}</span>
            <button type="button" className={styles.linkBtn} onClick={cancel}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className={styles.composer}>
        <textarea
          ref={inputRef}
          className={`scroll-thin ${styles.textarea}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onComposerKey}
          placeholder="Pide algo…  (Enter = salto de línea, Ctrl+Enter = enviar)"
          rows={2}
          aria-label="Escribe tu consulta o una orden"
        />
        <button
          type="button"
          className={styles.send}
          onClick={() => sendText(draft)}
          disabled={busy || draft.trim() === ''}
          title="Enviar (Ctrl+Enter)"
          aria-label="Enviar"
        >
          <Icon name="send" size={16} />
        </button>
      </div>

      <AjustesIA open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
