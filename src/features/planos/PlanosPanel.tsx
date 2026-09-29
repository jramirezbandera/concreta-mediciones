/* ===========================================================================
   PlanosPanel — el visor de planos en el hueco lateral (§5.1, §5.2). Es el
   chunk diferido de Planos: pdf.js ni siquiera se pide hasta abrir un plano.

     cabecera (40 px): plano ▾ · página ▾ · chip de escala · pantalla completa · ⋯ · ✕
     cuerpo: la lista de planos (sin plano abierto) o el plano abierto
   =========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Modal } from '../../components';
import { fmtNum } from '../../core/money';
import { escalaDe, etiquetaDe, origenLegible, planoLegible } from '../../core/planoDatos';
import { DESVIACION_MAX } from '../../core/planoGeom';
import { lineasConOtraEscala } from '../../core/planoRecalculo';
import { nombreConRevision, revisionMasNueva } from '../../core/planoRevision';
import { desviacionCajetin } from '../../core/planoTexto';
import type { PlanoMeta } from '../../core/types';
import { useSessionStore } from '../../persist';
import { espacioNavegador } from '../../persist/planos';
import { useObraStore, useToastStore } from '../../store';
import { textoResultado } from '../../store/motivos';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { TEXTO_FASE, adjuntarPlano, adjuntarRevision, type FaseAdjuntar, type ResultadoAdjuntar } from './adjuntar';
import { DialogoLiberar } from './LiberarEspacio';
import { TEXTO_DESCARTE_BORRADOR, textoEscala, textoRevisionAdjunta } from './textos';
import { PlanoViewer } from './PlanoViewer';
import styles from './Planos.module.css';

/** Medidas por plano y página (líneas con `origen` legible). */
function useMedidas(): Map<string, Map<number, number>> {
  const partidas = useObraStore((s) => s.partidas);
  return useMemo(() => {
    const out = new Map<string, Map<number, number>>();
    for (const ps of Object.values(partidas))
      for (const p of ps)
        for (const l of p.med) {
          const o = l.origen;
          if (!origenLegible(o)) continue;
          const pp = out.get(o.planoId) ?? new Map<number, number>();
          pp.set(o.pagina, (pp.get(o.pagina) ?? 0) + 1);
          out.set(o.planoId, pp);
        }
    return out;
  }, [partidas]);
}

const total = (m: Map<number, number> | undefined) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);
const mb = (bytes: number) => `${fmtNum(bytes / 1048576, 1)} MB`;

/** Chip de escala (§5.2): «Sin calibrar» o «1:50 · ±0,3 %». */
function ChipEscala({ plano, pagina }: { plano: PlanoMeta; pagina: number }) {
  const e = escalaDe(plano, pagina);
  if (!e) return <span className={`${styles.chip} ${styles.chipNeutro}`}>Sin calibrar</span>;
  if (!e.comprobacion)
    return (
      <span className={`mono ${styles.chip} ${styles.chipAviso}`} title="Comprueba la escala con otra cota antes de medir">
        {textoEscala(e.n)} · sin comprobar
      </span>
    );
  // [A1] Con escala en el cajetín, el chip abre la comparación (lo pinta el visor).
  if (e.escalaDeclarada) {
    const noCuadra = !e.ajustada && desviacionCajetin(e.n, e.escalaDeclarada) > DESVIACION_MAX;
    return (
      <button
        type="button"
        className={`mono ${styles.chip} ${noCuadra ? styles.chipAviso : styles.chipAccent}`}
        title={`El plano dice ${textoEscala(e.escalaDeclarada)}`}
        onClick={() => usePlanoUiStore.getState().pedirAlVisor('ajuste')}
      >
        {textoEscala(e.n)}
        {e.ajustada ? ' ajustada' : noCuadra ? ' · no cuadra con el cajetín' : ` · ±${fmtNum(e.comprobacion.desviacion * 100, 1)} %`}
      </button>
    );
  }
  const d = e.comprobacion.desviacion;
  return (
    <span className={`mono ${styles.chip} ${styles.chipAccent}`} title="Escala calibrada y comprobada">
      {textoEscala(e.n)}
      {d !== undefined && ` · ±${fmtNum(d * 100, 1)} %`}
    </span>
  );
}

export function PlanosPanel({
  estrecha,
  onCerrar,
}: {
  /** Por debajo de 1024 px: solo ver. */
  estrecha: boolean;
  onCerrar: () => void;
}) {
  const planosRaw = useObraStore((s) => s.planos);
  const docToken = useObraStore((s) => s.docToken);
  const planoId = usePlanoUiStore((s) => s.planoId);
  const pagina = usePlanoUiStore((s) => s.pagina);
  const pantallaCompleta = usePlanoUiStore((s) => s.pantallaCompleta);
  const readonly = useSessionStore((s) => s.readonly);

  const planos = useMemo(() => planosRaw.filter((p): p is PlanoMeta => planoLegible(p) && !p.quitado), [planosRaw]);
  const plano = planos.find((p) => p.id === planoId) ?? null;

  // Tras Deshacer (o al cambiar de obra) el plano que se ve sigue existiendo y
  // el borrador sigue valiendo; si no, se descarta con aviso (§5.8).
  useEffect(() => {
    const descarte = usePlanoUiStore.getState().reconciliar(planosRaw, docToken);
    if (descarte) useToastStore.getState().show(`Forma descartada: ${TEXTO_DESCARTE_BORRADOR[descarte]}.`);
  }, [planosRaw, docToken]);

  const [menu, setMenu] = useState<'plano' | 'pagina' | 'mas' | null>(null);
  const [dialogo, setDialogo] = useState<'renombrar' | 'etiquetas' | 'quitar' | null>(null);
  const cabeceraRef = useRef<HTMLDivElement>(null);
  // Un menú abierto se cierra al pulsar fuera de la cabecera o con Esc.
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => {
      if (!cabeceraRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setMenu(null);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc, true);
    };
  }, [menu]);
  const adjuntar = useAdjuntar();
  const medidas = useMedidas();
  const medidasPlano = plano ? medidas.get(plano.id) : undefined;
  const paginasConMedidas = useMemo(() => [...(medidasPlano?.keys() ?? [])], [medidasPlano]);

  return (
    <div className={styles.panel}>
      <div ref={cabeceraRef} className={styles.cabecera}>
        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`tcol ${styles.cabBtn}`}
            aria-expanded={menu === 'plano'}
            onClick={() => setMenu(menu === 'plano' ? null : 'plano')}
          >
            <Icon name="plano" size={15} />
            <span className={styles.cabNombre}>{plano ? nombreConRevision(plano) : 'Planos'}</span>
            <Icon name="chevronDown" size={13} />
          </button>
          {menu === 'plano' && (
            <div className={styles.menu} role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(null)}>
              {planos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  className={`${styles.menuItem} ${p.id === planoId ? styles.menuItemOn : ''}`}
                  onClick={() => {
                    usePlanoUiStore.getState().abrirPlano(p.id, 1);
                    setMenu(null);
                  }}
                >
                  {nombreConRevision(p)}
                  <span className={styles.menuMeta}>
                    {revisionMasNueva(planosRaw, p.id) ? 'sustituida · ' : ''}
                    {total(medidas.get(p.id))} medidas
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  usePlanoUiStore.getState().abrirPlano(null);
                  setMenu(null);
                }}
              >
                <Icon name="list" size={14} /> Lista de planos
              </button>
            </div>
          )}
        </div>
        {plano && (
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={`tcol ${styles.cabBtn}`}
              aria-expanded={menu === 'pagina'}
              aria-label="Página"
              onClick={() => setMenu(menu === 'pagina' ? null : 'pagina')}
            >
              <span>{etiquetaDe(plano, pagina) ?? `Pág. ${pagina}`}</span>
              <Icon name="chevronDown" size={13} />
            </button>
            {menu === 'pagina' && (
              <div className={styles.menu} role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(null)}>
                {Array.from({ length: Math.min(plano.paginas, 500) }, (_, i) => i + 1).map((n) => {
                  const e = escalaDe(plano, n);
                  const med = medidas.get(plano.id)?.get(n) ?? 0;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="menuitem"
                      className={`${styles.menuItem} ${n === pagina ? styles.menuItemOn : ''}`}
                      onClick={() => {
                        usePlanoUiStore.getState().setPagina(n);
                        setMenu(null);
                      }}
                    >
                      {[etiquetaDe(plano, n) ?? `Pág. ${n}`, e ? `${textoEscala(e.n)} ✓` : 'sin calibrar', med ? `${med} ${med === 1 ? 'medida' : 'medidas'}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {plano && <ChipEscala plano={plano} pagina={pagina} />}
        <span className={styles.toolFill} />
        {adjuntar.fase && <span className={styles.fase}>{TEXTO_FASE[adjuntar.fase]}</span>}
        {plano && (
          <button
            type="button"
            className={`tcol icon-btn ${styles.cabIcono}`}
            aria-pressed={pantallaCompleta}
            title={pantallaCompleta ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={() => usePlanoUiStore.getState().setPantallaCompleta(!pantallaCompleta)}
          >
            <Icon name={pantallaCompleta ? 'shrink' : 'expand'} size={15} />
          </button>
        )}
        <div className={styles.menuWrap}>
          <button
            type="button"
            className={`tcol icon-btn ${styles.cabIcono}`}
            aria-label="Más acciones de planos"
            aria-expanded={menu === 'mas'}
            onClick={() => setMenu(menu === 'mas' ? null : 'mas')}
          >
            <Icon name="dots" size={15} />
          </button>
          {menu === 'mas' && (
            <div className={`${styles.menu} ${styles.menuDer}`} role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(null)}>
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={readonly}
                onClick={() => {
                  setMenu(null);
                  adjuntar.elegir();
                }}
              >
                <Icon name="upload" size={14} /> Adjuntar plano
              </button>
              {plano && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    disabled={readonly || estrecha}
                    onClick={() => (setMenu(null), adjuntar.elegirRevision())}
                  >
                    <Icon name="layers" size={14} /> Adjuntar revisión…
                  </button>
                  <button type="button" role="menuitem" className={styles.menuItem} disabled={readonly} onClick={() => (setMenu(null), setDialogo('renombrar'))}>
                    <Icon name="pencil" size={14} /> Renombrar
                  </button>
                  <button type="button" role="menuitem" className={styles.menuItem} disabled={readonly} onClick={() => (setMenu(null), setDialogo('etiquetas'))}>
                    <Icon name="list" size={14} /> Etiquetas de página
                  </button>
                  {escalaDe(plano, pagina)?.escalaDeclarada && (
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      disabled={readonly}
                      onClick={() => (setMenu(null), usePlanoUiStore.getState().pedirAlVisor('copiarEscala'))}
                    >
                      <Icon name="ruler" size={14} /> Usar esta calibración en otras páginas…
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuPeligro}`}
                    disabled={readonly}
                    onClick={() => (setMenu(null), setDialogo('quitar'))}
                  >
                    <Icon name="trash" size={14} /> Quitar plano
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button type="button" className={`tcol icon-btn ${styles.cabIcono}`} aria-label="Cerrar planos" title="Cerrar (Esc)" onClick={onCerrar}>
          <Icon name="x" size={15} />
        </button>
      </div>

      {adjuntar.resultado && <ResultadoBanda r={adjuntar.resultado} onCerrar={adjuntar.limpiar} onOtraVez={adjuntar.otraVez} />}

      {plano ? (
        <PlanoViewer
          key={plano.id}
          plano={plano}
          estrecha={estrecha}
          onCerrarVisor={onCerrar}
          paginasConMedidas={paginasConMedidas}
        />
      ) : (
        <PlanosLista planos={planos} medidas={medidas} onAdjuntar={adjuntar.elegir} onSoltar={adjuntar.soltar} readonly={readonly} />
      )}

      <input
        ref={adjuntar.inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="Adjuntar plano PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void adjuntar.adjuntar(f);
        }}
      />
      <input
        ref={adjuntar.revisionRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="Adjuntar revisión PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && plano) void adjuntar.revision(f, plano);
        }}
      />

      {plano && dialogo === 'renombrar' && <DialogoRenombrar plano={plano} onClose={() => setDialogo(null)} />}
      {plano && dialogo === 'etiquetas' && <DialogoEtiquetas plano={plano} onClose={() => setDialogo(null)} />}
      {plano && dialogo === 'quitar' && (
        <DialogoQuitar plano={plano} lineas={total(medidas.get(plano.id))} onClose={() => setDialogo(null)} />
      )}
    </div>
  );
}

/* ---- adjuntar -------------------------------------------------------------------- */

function useAdjuntar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const revisionRef = useRef<HTMLInputElement>(null);
  const [fase, setFase] = useState<FaseAdjuntar | null>(null);
  const [resultado, setResultado] = useState<{ r: ResultadoAdjuntar; file: File } | null>(null);
  async function adjuntar(file: File, nuevo = false) {
    setResultado(null);
    const r = await adjuntarPlano(file, { onFase: setFase, nuevo });
    setFase(null);
    if (r.kind === 'ok') {
      useToastStore.getState().show(r.revivido ? 'Plano recuperado con sus escalas y líneas' : 'Plano adjunto: calibra esta página para medir');
      if (r.aviso) setResultado({ r: { kind: 'error', texto: r.aviso }, file });
    } else if (r.kind === 'reenlazado') useToastStore.getState().show('Plano reenlazado: sus líneas se ven otra vez');
    else if (r.kind !== 'cancelado') setResultado({ r, file });
  }
  /** [A1] «Adjuntar revisión»: plano nuevo que sustituye al abierto. */
  async function revision(file: File, viejo: PlanoMeta) {
    setResultado(null);
    const r = await adjuntarRevision(file, { sustituye: viejo.id, onFase: setFase });
    setFase(null);
    if (r.kind === 'ok') {
      useToastStore.getState().show(textoRevisionAdjunta(r.revision, viejo));
      if (r.aviso) setResultado({ r: { kind: 'error', texto: r.aviso }, file });
    } else if (r.kind === 'error') setResultado({ r, file });
  }
  return {
    inputRef,
    revisionRef,
    fase,
    resultado: resultado?.r ?? null,
    elegir: () => inputRef.current?.click(),
    elegirRevision: () => revisionRef.current?.click(),
    revision,
    soltar: (f: File) => void adjuntar(f),
    adjuntar: (f: File) => adjuntar(f),
    otraVez: () => resultado && void adjuntar(resultado.file, true),
    limpiar: () => setResultado(null),
  };
}

function ResultadoBanda({ r, onCerrar, onOtraVez }: { r: ResultadoAdjuntar; onCerrar: () => void; onOtraVez: () => void }) {
  if (r.kind === 'duplicado')
    return (
      <div className={`${styles.banda} ${styles.aviso_info}`} role="status">
        <span>Ya está adjunto como «{r.nombre}».</span>
        <button type="button" className={styles.btn} onClick={() => (usePlanoUiStore.getState().abrirPlano(r.planoId, 1), onCerrar())}>
          Abrirlo
        </button>
        <button type="button" className={styles.btn} onClick={onOtraVez}>
          Adjuntar otra vez (para otra escala)
        </button>
      </div>
    );
  const texto = r.kind === 'error' ? r.texto : r.kind === 'no-identico' ? 'Este PDF no es idéntico al original.' : '';
  if (!texto) return null;
  return (
    <div className={`${styles.banda} ${styles.aviso_error}`} role="alert">
      <Icon name="alert" size={14} />
      <span>{texto}</span>
      <button type="button" className={styles.btn} onClick={onCerrar}>
        Cerrar
      </button>
    </div>
  );
}

/* ---- lista de planos (§5.2, §7.1) -------------------------------------------------- */

function PlanosLista({
  planos,
  medidas,
  onAdjuntar,
  onSoltar,
  readonly,
}: {
  planos: PlanoMeta[];
  medidas: Map<string, Map<number, number>>;
  onAdjuntar: () => void;
  onSoltar: (f: File) => void;
  readonly: boolean;
}) {
  const disponibles = usePlanoUiStore((s) => s.disponibles);
  const planosTodos = useObraStore((s) => s.planos);
  const ilegibles = useObraStore((s) => s._ilegible?.length ?? 0);
  const partidas = useObraStore((s) => s.partidas);
  const [espacio, setEspacio] = useState<{ usado: number; cuota: number } | null>(null);
  const [encima, setEncima] = useState(false);
  const [liberar, setLiberar] = useState(false);
  /** Sube al liberar: el espacio usado se vuelve a medir. */
  const [medir, setMedir] = useState(0);
  useEffect(() => {
    void espacioNavegador().then(setEspacio);
  }, [planos.length, medir]);

  const zona = (
    <div
      className={`${styles.soltar} ${encima ? styles.soltarEncima : ''}`}
      onDragOver={(e) => {
        if (readonly || !Array.from(e.dataTransfer.types).includes('Files')) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        const f = Array.from(e.dataTransfer.files).find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name));
        setEncima(false);
        if (!f || readonly) return;
        e.preventDefault();
        onSoltar(f);
      }}
    >
      <Icon name="plano" size={22} />
      <p className={styles.soltarTitulo}>Adjunta el PDF · Calibra con una cota · Mide</p>
      <p className={styles.franjaTexto}>Suelta aquí el plano o elígelo. El PDF se queda en este navegador; en la obra solo va su huella.</p>
      <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} disabled={readonly} onClick={onAdjuntar}>
        <Icon name="upload" size={14} /> Adjuntar plano
      </button>
    </div>
  );

  return (
    <div className={styles.lista}>
      {ilegibles > 0 && (
        <div className={`${styles.banda} ${styles.aviso_warn}`} role="status">
          {ilegibles} datos de planos no se pueden leer; las líneas conservan sus números.
        </div>
      )}
      {planos.map((p) => {
        const med = medidas.get(p.id);
        const noDisp = disponibles[p.huella] === false;
        const calibradas = Object.keys(p.escalas).filter((k) => escalaDe(p, Number(k))).length;
        const otraEscala = lineasConOtraEscala(partidas, p);
        const nueva = revisionMasNueva(planosTodos, p.id);
        return (
          <button
            key={p.id}
            type="button"
            className={`tcol ${styles.fichaPlano} ${noDisp ? styles.fichaNoDisp : ''}`}
            onClick={() => usePlanoUiStore.getState().abrirPlano(p.id, 1)}
          >
            <Icon name="plano" size={18} />
            <span className={styles.fichaTexto}>
              <span className={styles.fichaNombre}>{nombreConRevision(p)}</span>
              <span className={styles.fichaMeta}>
                {p.paginas} {p.paginas === 1 ? 'página' : 'páginas'} · {calibradas ? `${calibradas} calibrada${calibradas === 1 ? '' : 's'}` : 'sin calibrar'} ·{' '}
                {total(med)} medidas · {mb(p.tamano)}
                {noDisp && ' · no disponible en este navegador'}
                {nueva && ` · sustituida por ${nueva.revision ?? nueva.nombre}`}
              </span>
              {otraEscala > 0 && (
                <span className={`${styles.fichaPaginas} ${styles.recalculoAviso}`}>
                  {otraEscala} {otraEscala === 1 ? 'línea con otra escala' : 'líneas con otra escala'} (retocadas, aceptadas o certificadas al
                  recalibrar)
                </span>
              )}
              {med && med.size > 0 && (
                <span className={styles.fichaPaginas}>
                  {[...med.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([n, c]) => `${etiquetaDe(p, n) ?? `Pág. ${n}`}: ${c}`)
                    .join(' · ')}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {zona}
      <div className={styles.espacioFila}>
        {espacio && (
          <p className={styles.espacio}>
            Espacio del navegador: usados {mb(espacio.usado)} de {mb(espacio.cuota)}.
          </p>
        )}
        <button type="button" className={styles.btn} onClick={() => setLiberar(true)}>
          <Icon name="trash" size={14} /> Liberar espacio
        </button>
      </div>
      {liberar && (
        <DialogoLiberar
          onCerrar={(liberado) => {
            setLiberar(false);
            if (liberado) setMedir((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ---- diálogos ---------------------------------------------------------------------- */

const doc = () => ({ docToken: useObraStore.getState().docToken });

function DialogoRenombrar({ plano, onClose }: { plano: PlanoMeta; onClose: () => void }) {
  const [nombre, setNombre] = useState(plano.nombre);
  const [revision, setRevision] = useState(plano.revision ?? '');
  const guardar = () => {
    useObraStore.getState().renamePlano({ planoId: plano.id, nombre, revision, expect: doc() });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Renombrar plano"
      icon="pencil"
      closeOnOverlay={false}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={guardar}>
            Guardar
          </button>
        </>
      }
    >
      <label className={styles.campoDialogo}>
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardar()} />
      </label>
      <label className={styles.campoDialogo}>
        Revisión (opcional)
        <input
          value={revision}
          maxLength={24}
          placeholder="Rev. A"
          onChange={(e) => setRevision(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
        />
      </label>
      <p className={styles.franjaTexto}>Fichero original: {plano.archivo}</p>
    </Modal>
  );
}

function DialogoEtiquetas({ plano, onClose }: { plano: PlanoMeta; onClose: () => void }) {
  const n = Math.min(plano.paginas, 200);
  const [valores, setValores] = useState(() => Array.from({ length: n }, (_, i) => etiquetaDe(plano, i + 1) ?? ''));
  const guardar = () => {
    const s = useObraStore.getState();
    valores.forEach((v, i) => s.setPlanoPageLabel({ planoId: plano.id, pagina: i + 1, etiqueta: v, expect: doc() }));
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Etiquetas de página"
      subtitle="El rótulo corto de cada página («P1») va delante del comentario de sus líneas."
      icon="list"
      closeOnOverlay={false}
      footer={
        <>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimario}`} onClick={guardar}>
            Guardar
          </button>
        </>
      }
    >
      <div className={styles.etiquetas}>
        {valores.map((v, i) => (
          <label key={i} className={styles.campoDialogo}>
            Página {i + 1}
            <input
              value={v}
              maxLength={24}
              placeholder={`P${i + 1}`}
              onChange={(e) => setValores((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </label>
        ))}
      </div>
    </Modal>
  );
}

function DialogoQuitar({ plano, lineas, onClose }: { plano: PlanoMeta; lineas: number; onClose: () => void }) {
  const cancelar = useRef<HTMLButtonElement>(null);
  const quitar = () => {
    const r = useObraStore.getState().removePlano({ planoId: plano.id, expect: doc() });
    onClose();
    if (!r.ids.length) {
      useToastStore.getState().show(textoResultado(r), undefined, { tone: 'error' });
      return;
    }
    usePlanoUiStore.getState().abrirPlano(null);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Quitar plano"
      icon="trash"
      initialFocus={cancelar}
      footer={
        <>
          <button ref={cancelar} type="button" className={styles.btn} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPeligro}`} onClick={quitar}>
            Quitar
          </button>
        </>
      }
    >
      <p>
        Quitar «{plano.nombre}»: {lineas} {lineas === 1 ? 'línea conserva sus números' : 'líneas conservan sus números'}, pero
        dejan de verse en el plano.
      </p>
      <p className={styles.franjaTexto}>El PDF no se borra: Deshacer lo recupera, y volver a adjuntarlo lo revive.</p>
    </Modal>
  );
}

export default PlanosPanel;
