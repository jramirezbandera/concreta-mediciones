/* ===========================================================================
   PlanoLienzo — la página del PDF con su capa (§5.5) y la entrada de ratón.

   · Pintado (§8.2): la página entera a la resolución de «ajustar» y, al hacer
     zoom, solo la zona visible a la resolución del zoom (con retardo),
     enseñando mientras la imagen escalada. Nunca un lienzo de más de 16 MP.
     Los lienzos se liberan al cambiar de página. Con la página pintada, en
     reposo, se precargan una a una las páginas de `precargar`.
   · Vista: escala (px por unidad de página) y desplazamiento propios; rueda
     = desplazar, Ctrl + rueda = zoom al cursor (listener nativo, no pasivo),
     arrastrar con Mano, con el botón central o con Espacio = desplazar.
   · Capa SVG: formas de la partida abierta, dibujo en curso, cota de
     calibración, guías del cursor en cruz y lupa ×4. [A1] Con el cursor de
     teclado encendido (§5.10), las guías, la lupa y el tramo en curso lo
     siguen a él, y la vista se desplaza para que no se salga.
   Lo que es un clic sobre la página lo decide el ciclo (`core/planoCiclo`):
   aquí solo se traduce a coordenadas de página y se entrega.
   =========================================================================== */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { TramoCota } from '../../core/planoCiclo';
import { lienzoAPagina, paginaALienzo, regionDeLienzo, tamanoLienzo, type Caja } from '../../core/planoGeom';
import type { Herramienta, Punto } from '../../core/types';
import { anclaInsignia, formaEn, type FormaCapa } from './capa';
import type { DocPdf, PaginaPdf } from './pdfTipos';
import styles from './Planos.module.css';

/** Nunca un lienzo de más de 16 MP. */
const MAX_PX = 16_000_000;
const MARGEN = 16;
/** Tamaño de reserva cuando el contenedor aún no tiene tamaño (jsdom, primer render). */
const TAM_RESERVA: [number, number] = [800, 600];
/** Espera tras pintar antes de precargar otras páginas (que no compita con
 *  el zoom o el desplazamiento que suelen seguir a un cambio de página). */
const PRECARGA_TRAS_MS = 400;

export interface LienzoApi {
  ajustar(): void;
  zoom(factor: number): void;
  encuadrar(caja: Caja): void;
  /** Píxeles de pantalla por unidad de página. */
  escala(): number;
  /** [Reintentar] tras «No se pudo pintar esta página». */
  reintentar(): void;
  /** [A1] El centro de la vista, en coordenadas de página. */
  centro(): Punto;
  /** [A1] `p` movido `dx`, `dy` px de pantalla; si se sale de la vista, la
   *  vista se desplaza para que siga dentro. */
  moverCursor(p: Punto, dx: number, dy: number): Punto;
}

/** Margen que el cursor de teclado deja hasta el borde de la vista. */
const MARGEN_CURSOR = 24;

export interface DibujoCapa {
  herramienta: Herramienta;
  puntos: Punto[];
  cruce: boolean;
  resta: boolean;
  /** La forma ya está cerrada (NOMBRANDO). */
  cerrada: boolean;
}

export interface Ancla {
  key: string;
  p: Punto;
  nodo: ReactNode;
}

export interface MetaClic {
  px: number;
  mayus: boolean;
  detalle: number;
  forma: string | null;
}

interface Vista {
  s: number;
  tx: number;
  ty: number;
}

export function PlanoLienzo({
  apiRef,
  doc,
  n,
  info,
  formas,
  seleccion,
  destacada,
  atenuada,
  dibujo,
  calibrar,
  anclas = [],
  modo,
  espacio,
  ariaLabel,
  onClic,
  onDobleClic,
  onMoverVertice,
  onMoverCota,
  onCursor,
  onPintado,
  precargar = [],
  cursorTeclado = null,
  borrador = null,
}: {
  apiRef: Ref<LienzoApi>;
  doc: DocPdf;
  n: number;
  info: PaginaPdf;
  formas: FormaCapa[];
  seleccion: string | null;
  destacada: string | null;
  /** «Volver a medir»: la forma vieja se atenúa. */
  atenuada: string | null;
  dibujo: DibujoCapa | null;
  calibrar: { paso: 'cota' | 'comprobacion'; cota: TramoCota; comprobacion: TramoCota } | null;
  anclas?: Ancla[];
  modo: 'mano' | 'medir';
  espacio: boolean;
  ariaLabel: string;
  onClic: (p: Punto, meta: MetaClic) => void;
  onDobleClic: () => void;
  onMoverVertice: (i: number, p: Punto) => void;
  onMoverCota: (cual: 'a' | 'b', p: Punto) => void;
  onCursor: (p: Punto | null, px: number) => void;
  onPintado: (estado: 'pintando' | 'listo' | 'error', causa?: string) => void;
  /** Páginas que precargar en reposo tras pintar esta, por orden. */
  precargar?: number[];
  /** [A1] Cursor de teclado, en coordenadas de página; `null` = apagado. */
  cursorTeclado?: Punto | null;
  /** [A1] El borrador de esta página (§5.8), atenuado: lo que ofrece el aviso. */
  borrador?: Omit<DibujoCapa, 'cruce' | 'resta'> | null;
}) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const detalleRef = useRef<HTMLCanvasElement>(null);
  const lupaRef = useRef<HTMLCanvasElement>(null);
  const [tam, setTam] = useState<[number, number]>(TAM_RESERVA);
  const [vista, setVista] = useState<Vista | null>(null);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [detalle, setDetalle] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [intento, setIntento] = useState(0);
  const movidoPorUsuario = useRef(false);
  const vistaRef = useRef<Vista | null>(null);
  vistaRef.current = vista;

  // Tamaño de la página en unidades, ya girada.
  const [W, H] = tamanoLienzo({ caja: info.vista, rotacion: info.rotacion, pxPorUnidad: 1 });
  const ajustada = useCallback(
    (t: [number, number] = tam): Vista => {
      const s = Math.max(1e-3, Math.min((t[0] - 2 * MARGEN) / W, (t[1] - 2 * MARGEN) / H));
      return { s, tx: (t[0] - W * s) / 2, ty: (t[1] - H * s) / 2 };
    },
    [W, H, tam],
  );
  const v = vista ?? ajustada();
  const vp = { caja: info.vista, rotacion: info.rotacion, pxPorUnidad: v.s };
  const aPantalla = (p: Punto): [number, number] => {
    const [x, y] = paginaALienzo(p, vp);
    return [x + v.tx, y + v.ty];
  };
  const aPagina = (sx: number, sy: number): Punto => lienzoAPagina([sx - v.tx, sy - v.ty], vp);

  // Tamaño del contenedor.
  useLayoutEffect(() => {
    const el = cajaRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const t: [number, number] = r.width > 0 && r.height > 0 ? [r.width, r.height] : TAM_RESERVA;
      setTam((prev) => (prev[0] === t[0] && prev[1] === t[1] ? prev : t));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Página nueva o contenedor redimensionado sin zoom del usuario: ajustar.
  useEffect(() => {
    movidoPorUsuario.current = false;
    setVista(null);
  }, [doc, n]);
  useEffect(() => {
    if (!movidoPorUsuario.current) setVista(null);
  }, [tam]);

  const zoomEn = useCallback(
    (factor: number, sx: number, sy: number) => {
      const cur = vistaRef.current ?? ajustada();
      const fit = ajustada().s;
      const s = Math.min(Math.max(cur.s * factor, fit * 0.5), Math.max(fit * 40, 30));
      const k = s / cur.s;
      movidoPorUsuario.current = true;
      setVista({ s, tx: sx - (sx - cur.tx) * k, ty: sy - (sy - cur.ty) * k });
    },
    [ajustada],
  );

  useImperativeHandle(
    apiRef,
    (): LienzoApi => ({
      ajustar() {
        movidoPorUsuario.current = false;
        setVista(null);
      },
      zoom(f) {
        zoomEn(f, tam[0] / 2, tam[1] / 2);
      },
      encuadrar(caja) {
        const vpu = { caja: info.vista, rotacion: info.rotacion, pxPorUnidad: 1 };
        const a = paginaALienzo([caja[0], caja[1]], vpu);
        const b = paginaALienzo([caja[2], caja[3]], vpu);
        const w = Math.max(Math.abs(b[0] - a[0]), 1);
        const h = Math.max(Math.abs(b[1] - a[1]), 1);
        const fit = ajustada().s;
        const s = Math.min(Math.max(Math.min((tam[0] * 0.6) / w, (tam[1] * 0.6) / h), fit), Math.max(fit * 40, 30));
        const cx = (Math.min(a[0], b[0]) + w / 2) * s;
        const cy = (Math.min(a[1], b[1]) + h / 2) * s;
        movidoPorUsuario.current = true;
        setVista({ s, tx: tam[0] / 2 - cx, ty: tam[1] / 2 - cy });
      },
      escala: () => (vistaRef.current ?? ajustada()).s,
      reintentar: () => setIntento((x) => x + 1),
      centro() {
        const cur = vistaRef.current ?? ajustada();
        return lienzoAPagina([tam[0] / 2 - cur.tx, tam[1] / 2 - cur.ty], { caja: info.vista, rotacion: info.rotacion, pxPorUnidad: cur.s });
      },
      moverCursor(p, dx, dy) {
        const cur = vistaRef.current ?? ajustada();
        const vpc = { caja: info.vista, rotacion: info.rotacion, pxPorUnidad: cur.s };
        const [x, y] = paginaALienzo(p, vpc);
        const nuevo = lienzoAPagina([x + dx, y + dy], vpc);
        const sx = x + dx + cur.tx;
        const sy = y + dy + cur.ty;
        const fuera = (v: number, max: number) =>
          v < MARGEN_CURSOR ? MARGEN_CURSOR - v : v > max - MARGEN_CURSOR ? max - MARGEN_CURSOR - v : 0;
        const [ox, oy] = [fuera(sx, tam[0]), fuera(sy, tam[1])];
        if (ox || oy) {
          movidoPorUsuario.current = true;
          setVista({ s: cur.s, tx: cur.tx + ox, ty: cur.ty + oy });
        }
        return nuevo;
      },
    }),
    [ajustada, info, tam, zoomEn],
  );

  /* ---- pintado de la página entera (resolución de «ajustar») ---------------- */
  const sBase = useRef(1);
  const onPintadoRef = useRef(onPintado);
  onPintadoRef.current = onPintado;
  // Solo la escala de «ajustar» cuenta (redondeada): un cambio de tamaño que no
  // la mueve no vuelve a pintar.
  const sAjuste = Math.round(ajustada().s * 1000) / 1000;
  const [pintada, setPintada] = useState<{ doc: DocPdf; n: number } | null>(null);
  useEffect(() => {
    const lienzo = baseRef.current;
    if (!lienzo) return;
    const ac = new AbortController();
    const dpr = globalThis.devicePixelRatio || 1;
    let s = sAjuste * dpr;
    if (W * H * s * s > MAX_PX) s = Math.sqrt(MAX_PX / (W * H));
    sBase.current = s;
    onPintadoRef.current('pintando');
    let reintentado = false;
    const pintar = (): Promise<void> =>
      doc.pintar(n, lienzo, info.vista, s, ac.signal).then(
        () => {
          if (ac.signal.aborted) return;
          onPintadoRef.current('listo');
          setPintada({ doc, n });
        },
        (e: unknown) => {
          if (ac.signal.aborted || (e as { tipo?: string })?.tipo === 'cancelado') return;
          if (!reintentado) {
            reintentado = true; // un reintento automático
            return pintar();
          }
          onPintadoRef.current('error', (e as Error)?.message);
        },
      );
    void pintar();
    return () => {
      ac.abort();
    };
  }, [doc, n, info, W, H, intento, sAjuste]);

  // Liberar los lienzos al cambiar de página (o desmontar).
  useEffect(() => {
    const base = baseRef.current;
    const det = detalleRef.current;
    return () => {
      for (const c of [base, det]) {
        if (c) {
          c.width = 0;
          c.height = 0;
        }
      }
    };
  }, [doc, n]);

  /* ---- precarga de otras páginas, en reposo y de una en una ---------------- */
  const clavePrecarga = precargar.join(',');
  const listo = pintada?.doc === doc && pintada.n === n;
  useEffect(() => {
    if (!listo || !clavePrecarga) return;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      for (const m of clavePrecarga.split(',').map(Number)) {
        if (ac.signal.aborted) return;
        await doc.precargar(m, ac.signal);
      }
    }, PRECARGA_TRAS_MS);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [doc, listo, clavePrecarga]);

  /* ---- pintado de la zona visible a la resolución del zoom ------------------ */
  useEffect(() => {
    setDetalle(null);
    const det = detalleRef.current;
    if (!det || !vista) return;
    const dpr = globalThis.devicePixelRatio || 1;
    if (vista.s * dpr <= sBase.current * 1.2) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      const x0 = Math.max(0, vista.tx);
      const y0 = Math.max(0, vista.ty);
      const x1 = Math.min(tam[0], vista.tx + W * vista.s);
      const y1 = Math.min(tam[1], vista.ty + H * vista.s);
      if (x1 - x0 < 1 || y1 - y0 < 1) return;
      const vpz = { caja: info.vista, rotacion: info.rotacion, pxPorUnidad: vista.s };
      const region = regionDeLienzo({ x: x0 - vista.tx, y: y0 - vista.ty, w: x1 - x0, h: y1 - y0 }, vpz);
      let s = vista.s * dpr;
      const area = (region[2] - region[0]) * (region[3] - region[1]);
      if (area * s * s > MAX_PX) s = Math.sqrt(MAX_PX / area);
      doc.pintar(n, det, region, s, ac.signal).then(
        () => {
          if (!ac.signal.aborted) setDetalle({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        },
        () => undefined, // la imagen escalada sigue valiendo
      );
    }, 180);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [vista, tam, doc, n, info, W, H]);

  /* ---- rueda: desplazar o zoom al cursor (listener nativo, no pasivo) ------- */
  useEffect(() => {
    const el = cajaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomEn(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        return;
      }
      const cur = vistaRef.current ?? ajustada();
      movidoPorUsuario.current = true;
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      setVista({ ...cur, tx: cur.tx - dx, ty: cur.ty - dy });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ajustada, zoomEn]);

  /* ---- ratón ----------------------------------------------------------------- */
  const gesto = useRef<
    | { tipo: 'desplazar'; x: number; y: number; tx: number; ty: number; movido: boolean }
    | { tipo: 'vertice'; i: number; movido: boolean }
    | { tipo: 'cota'; cual: 'a' | 'b'; movido: boolean }
    | null
  >(null);
  const ignorarClic = useRef(false);

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = cajaRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const cerca = (a: [number, number], p: Punto | null) => {
    if (!p) return false;
    const [x, y] = aPantalla(p);
    return Math.hypot(x - a[0], y - a[1]) <= 8;
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const pos = local(e);
    ignorarClic.current = false;
    if (e.button === 1 || espacio || (modo === 'mano' && e.button === 0)) {
      if (e.button === 1) e.preventDefault();
      gesto.current = { tipo: 'desplazar', x: pos[0], y: pos[1], tx: v.tx, ty: v.ty, movido: false };
    } else if (e.button === 0 && calibrar) {
      const t = calibrar[calibrar.paso];
      if (cerca(pos, t.a)) gesto.current = { tipo: 'cota', cual: 'a', movido: false };
      else if (cerca(pos, t.b)) gesto.current = { tipo: 'cota', cual: 'b', movido: false };
    } else if (e.button === 0 && dibujo && !dibujo.cerrada) {
      const i = dibujo.puntos.findIndex((q) => cerca(pos, q));
      if (i >= 0) gesto.current = { tipo: 'vertice', i, movido: false };
    }
    if (gesto.current) e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pos = local(e);
    setHover(pos);
    const g = gesto.current;
    const p = aPagina(pos[0], pos[1]);
    onCursor(p, v.s);
    if (!g) return;
    if (g.tipo === 'desplazar') {
      const dx = pos[0] - g.x;
      const dy = pos[1] - g.y;
      if (!g.movido && Math.hypot(dx, dy) < 4) return;
      g.movido = true;
      movidoPorUsuario.current = true;
      setVista({ s: v.s, tx: g.tx + dx, ty: g.ty + dy });
    } else if (g.tipo === 'vertice') {
      g.movido = true;
      onMoverVertice(g.i, p);
    } else {
      g.movido = true;
      onMoverCota(g.cual, p);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesto.current;
    gesto.current = null;
    if (g?.movido) ignorarClic.current = true;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (ignorarClic.current) {
      ignorarClic.current = false;
      return;
    }
    if (e.button !== 0) return;
    const pos = local(e);
    const p = aPagina(pos[0], pos[1]);
    const f = modo === 'mano' ? formaEn(formas, p, v.s) : null;
    onClic(p, { px: v.s, mayus: e.shiftKey, detalle: e.detail || 1, forma: f?.lineId ?? null });
  }

  /* ---- lupa ×4 (esquina opuesta al cursor) -------------------------------------- */
  // El puntero: el cursor de teclado si está encendido [A1]; si no, el ratón.
  const puntero: [number, number] | null = cursorTeclado ? aPantalla(cursorTeclado) : hover;
  const [px0, py0] = puntero ?? [NaN, NaN];
  // Con la forma cerrada (NOMBRANDO) un clic no pone puntos: ni guías ni lupa.
  const apuntando = modo === 'medir' && puntero !== null && !dibujo?.cerrada;
  const lupaVisible = apuntando;
  const lupaIzquierda = puntero ? puntero[0] > tam[0] / 2 : false;
  const lupaArriba = puntero ? puntero[1] > tam[1] / 2 : false;
  useEffect(() => {
    const lupa = lupaRef.current;
    const base = baseRef.current;
    if (!lupaVisible || !lupa || !base || Number.isNaN(px0) || base.width === 0) return;
    const ctx = lupa.getContext?.('2d');
    if (!ctx) return;
    const L = 120;
    const ladoPantalla = L / 4;
    const k = base.width / (W * v.s); // px de lienzo base por px de pantalla
    const sx = (px0 - v.tx - ladoPantalla / 2) * k;
    const sy = (py0 - v.ty - ladoPantalla / 2) * k;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, L, L);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, sx, sy, ladoPantalla * k, ladoPantalla * k, 0, 0, L, L);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L / 2, 0);
    ctx.lineTo(L / 2, L);
    ctx.moveTo(0, L / 2);
    ctx.lineTo(L, L / 2);
    ctx.stroke();
  }, [lupaVisible, px0, py0, v.s, v.tx, v.ty, W]);

  /* ---- capa SVG ------------------------------------------------------------------ */
  const ruta = (pts: Punto[], cerrada: boolean) =>
    pts.length ? `M${pts.map((p) => aPantalla(p).map((x) => x.toFixed(1)).join(' ')).join(' L')}${cerrada ? ' Z' : ''}` : '';

  const pintarForma = (f: FormaCapa) => {
    const cerrada = f.herramienta === 'superficie' || f.herramienta === 'rectangulo';
    const d = ruta(f.puntos, cerrada);
    const clases = [
      styles.forma,
      f.lineId === seleccion ? styles.formaSel : '',
      f.lineId === destacada ? styles.formaDestacada : '',
      f.lineId === atenuada ? styles.formaAtenuada : '',
      f.retocada ? styles.formaRetocada : '',
    ].join(' ');
    const [bx, by] = aPantalla(anclaInsignia(f));
    return (
      <g key={f.lineId} className={clases} data-forma={f.lineId}>
        {f.herramienta === 'recuento' ? (
          f.puntos.map((p, i) => {
            const [x, y] = aPantalla(p);
            return <circle key={i} cx={x} cy={y} r={5} className={styles.puntoRecuento} />;
          })
        ) : (
          <>
            <path d={d} className={styles.halo} />
            <path d={d} className={cerrada ? styles.trazoArea : styles.trazo} />
            {f.resta && cerrada && <path d={d} className={styles.rayado} />}
          </>
        )}
        <g transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)})`} className={styles.insignia}>
          <rect x={-9} y={-9} width={18 + (f.resta || f.retocada ? 12 : 0)} height={18} rx={4} />
          <text x={0} y={4} textAnchor="middle">
            {f.numero}
          </text>
          {(f.resta || f.retocada) && (
            <text x={13} y={4} textAnchor="middle" className={f.retocada ? styles.insigniaWarn : ''}>
              {f.retocada ? '✎' : '−'}
            </text>
          )}
        </g>
      </g>
    );
  };

  const cotaCapa = (t: TramoCota, clase: string | undefined) =>
    t.a ? (
      <g className={clase}>
        {t.b && <path d={ruta([t.a, t.b], false)} className={styles.cotaTrazo} />}
        {[t.a, t.b].map((p, i) => {
          if (!p) return null;
          const [x, y] = aPantalla(p);
          return <circle key={i} cx={x} cy={y} r={5} className={styles.cotaPunto} />;
        })}
      </g>
    ) : null;

  const cursorClase = modo === 'mano' || espacio ? (gesto.current?.tipo === 'desplazar' ? styles.agarrando : styles.agarrar) : styles.cruz;

  return (
    <div
      ref={cajaRef}
      className={`${styles.lienzo} ${cursorClase}`}
      role="application"
      aria-label={ariaLabel}
      data-vista={JSON.stringify({ s: v.s, tx: v.tx, ty: v.ty })}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        setHover(null);
        onCursor(null, v.s);
      }}
      onClick={onClick}
      onDoubleClick={() => onDobleClic()}
      onAuxClick={(e) => e.preventDefault()}
    >
      <canvas
        ref={baseRef}
        className={styles.pagina}
        style={{ left: v.tx, top: v.ty, width: W * v.s, height: H * v.s }}
        aria-hidden="true"
      />
      <canvas
        ref={detalleRef}
        className={styles.pagina}
        style={
          detalle
            ? { left: detalle.x, top: detalle.y, width: detalle.w, height: detalle.h }
            : { display: 'none' }
        }
        aria-hidden="true"
      />
      <svg className={styles.capa} width={tam[0]} height={tam[1]} aria-hidden="true">
        <defs>
          <pattern id="rayado-restar" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className={styles.rayadoLinea} />
          </pattern>
        </defs>
        {formas.map(pintarForma)}
        {calibrar && cotaCapa(calibrar.cota, styles.cota)}
        {calibrar && calibrar.paso === 'comprobacion' && cotaCapa(calibrar.comprobacion, styles.comprobacion)}
        {borrador && borrador.puntos.length > 0 && (
          <g className={`${styles.dibujo} ${styles.dibujoBorrador} ${borrador.herramienta === 'longitud' ? styles.dibujoAbierto : ''}`} data-borrador="">
            {borrador.herramienta !== 'recuento' && (
              <path d={ruta(borrador.puntos, borrador.cerrada && borrador.herramienta !== 'longitud')} />
            )}
            {borrador.puntos.map((p, i) => {
              const [x, y] = aPantalla(p);
              return <rect key={i} x={x - 3} y={y - 3} width={6} height={6} />;
            })}
          </g>
        )}
        {dibujo && dibujo.puntos.length > 0 && (
          <g
            className={`${styles.dibujo} ${dibujo.cruce ? styles.dibujoCruce : ''} ${dibujo.herramienta === 'longitud' ? styles.dibujoAbierto : ''}`}
          >
            {dibujo.herramienta !== 'recuento' && (
              <path
                d={ruta(
                  !dibujo.cerrada && puntero && modo === 'medir' ? [...dibujo.puntos, aPagina(puntero[0], puntero[1])] : dibujo.puntos,
                  dibujo.cerrada && dibujo.herramienta !== 'longitud',
                )}
              />
            )}
            {dibujo.puntos.map((p, i) => {
              const [x, y] = aPantalla(p);
              return <rect key={i} x={x - 3} y={y - 3} width={6} height={6} />;
            })}
          </g>
        )}
        {apuntando && puntero && (
          <g className={styles.guias}>
            <line x1={0} y1={puntero[1]} x2={tam[0]} y2={puntero[1]} />
            <line x1={puntero[0]} y1={0} x2={puntero[0]} y2={tam[1]} />
          </g>
        )}
        {cursorTeclado && puntero && <circle cx={puntero[0]} cy={puntero[1]} r={7} className={styles.cursorTeclado} data-cursor-teclado="" />}
      </svg>
      {anclas.map((a) => {
        const [x, y] = aPantalla(a.p);
        return (
          <div key={a.key} className={styles.ancla} style={{ left: x, top: y }}>
            {a.nodo}
          </div>
        );
      })}
      <canvas
        ref={lupaRef}
        width={120}
        height={120}
        className={`${styles.lupa} ${lupaIzquierda ? styles.lupaIzq : styles.lupaDer} ${lupaArriba ? styles.lupaArriba : styles.lupaAbajo}`}
        style={lupaVisible ? undefined : { display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}
