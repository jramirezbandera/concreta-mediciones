/* ===========================================================================
   features/planos/adjuntar — coordinador de «Adjuntar plano» (§1.5 y §7).
   Sin transacción común entre la obra y el almacén de PDF, así que el orden
   importa:

     1. captura el `docToken` (la obra a la que va el plano);
     2. lee el fichero (FileReader: jsdom no tiene `Blob.arrayBuffer`);
     3. calcula la huella en un worker (o en el hilo si no hay workers);
     4. lo abre con el motor de PDF para contar páginas y cazar contraseñas y
        ficheros dañados ANTES de guardar nada;
     5. guarda los bytes (idempotente por huella);
     6. SOLO después publica el metadato con `attachPlano`.

   Si el `docToken` cambió entretanto (otra obra), descarta el resultado: los
   bytes se quedan. Nunca queda un metadato que apunte a bytes sin guardar.

   [A1] Con el mismo orden: «Adjuntar revisión» (`adjuntarRevision`, plano
   nuevo que sustituye al anterior) y «Usar este PDF para este plano»
   (`usarPdfParaPlano`, otra huella para el mismo plano, §9.3).
   =========================================================================== */
import { fmtNum } from '../../core/money';
import type { Caja } from '../../core/planoGeom';
import { escalaDe, origenLegible, planoLegible } from '../../core/planoDatos';
import { encajaEnPaginas, nombreConRevision, paginasConGeometria } from '../../core/planoRevision';
import type { PlanoMeta } from '../../core/types';
import { calcularHuella } from '../../persist/huella';
import { esCuotaLlena, espacioNavegador, guardarPlano, tienePlano } from '../../persist/planos';
import { TOPES_ZIP } from '../../persist/transfer';
import { useObraStore } from '../../store';
import { nextPlanoId } from '../../store/base';
import { textoResultado } from '../../store/motivos';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { motorPdf } from './motor';
import { ErrorPdf, type DocPdf } from './pdfTipos';

export type FaseAdjuntar = 'leyendo' | 'huella' | 'abriendo' | 'guardando';

export const TEXTO_FASE: Record<FaseAdjuntar, string> = {
  leyendo: 'Leyendo…',
  huella: 'Calculando huella…',
  abriendo: 'Abriendo…',
  guardando: 'Guardando…',
};

export const MB = 1024 * 1024;
/** Más de esto avisa (la copia de la obra será grande) y deja seguir. */
export const AVISO_BYTES = 50 * MB;
/** Más de esto se rechaza. */
export const MAX_BYTES = 500 * MB;
const MAX_PAGINAS = 2000;

export type ResultadoAdjuntar =
  | { kind: 'ok'; planoId: string; revivido: boolean; aviso?: string }
  /** La misma huella ya está en la obra: «Ya está adjunto como Planta 1». */
  | { kind: 'duplicado'; planoId: string; nombre: string }
  /** Eran los bytes de un plano «no disponible»: vuelve solo. */
  | { kind: 'reenlazado'; planoId: string }
  /** Se quería reenlazar un plano concreto y este PDF no es el mismo. [A1]
   *  `encaja`: tiene sus páginas y lo guardado cabe en ellas, así que se puede
   *  «Usar este PDF para este plano»; si no, solo como revisión nueva. */
  | { kind: 'no-identico'; encaja: boolean }
  | { kind: 'error'; texto: string }
  /** Cambió la obra mientras se adjuntaba: no se publica nada. */
  | { kind: 'cancelado' };

export type ResultadoRevision =
  | { kind: 'ok'; planoId: string; revision: string; aviso?: string }
  | { kind: 'error'; texto: string }
  | { kind: 'cancelado' };

export type ResultadoReenlace =
  /** El plano usa ya el PDF nuevo; `lineas`: las suyas (conservan números);
   *  `calibradas`: las páginas que ahora piden comprobar su escala. */
  | { kind: 'ok'; planoId: string; lineas: number; calibradas: number }
  /** Otro número de páginas, o lo guardado no cabe en ellas. */
  | { kind: 'no-encaja' }
  | { kind: 'error'; texto: string }
  | { kind: 'cancelado' };

type Fase = ((f: FaseAdjuntar) => void) | undefined;
type Fallo = { kind: 'error'; texto: string };

const mb = (n: number) => `${fmtNum(n / MB, 0)} MB`;
const gb = (n: number) => (n >= 1024 * MB ? `${fmtNum(n / (1024 * MB), 1)} GB` : mb(n));

/** «Planta primera.pdf» → «Planta primera». */
export function nombreDeArchivo(archivo: string): string {
  return archivo.replace(/\.pdf$/i, '').trim() || 'Plano';
}

function leerArchivo(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error ?? new Error('No se pudo leer el archivo'));
    fr.readAsArrayBuffer(file);
  });
}

const planosVivos = () => useObraStore.getState().planos.filter((p): p is PlanoMeta => planoLegible(p));

/* ---- piezas comunes ------------------------------------------------------------- */

/** Vacío o de más de 500 MB: el motivo; si no, `null`. */
function tamanoNoValido(file: File, nombre: string): Fallo | null {
  if (file.size === 0) return { kind: 'error', texto: 'El archivo está vacío.' };
  if (file.size > MAX_BYTES)
    return {
      kind: 'error',
      texto: `«${nombre}» pesa ${mb(file.size)}: el máximo es 500 MB. Divide el plano o expórtalo con menos resolución.`,
    };
  return null;
}

/** [A1] Un solo contrato con la copia .zip (§9.2): si con este PDF los planos
 *  pasan de sus topes, se avisa ya. Si no, el aviso de un PDF grande. */
function avisoTamano(file: File, nombre: string): string | undefined {
  const enObra = new Map(planosVivos().filter((p) => !p.quitado).map((p) => [p.huella, p.tamano]));
  const conEste = [...enObra.values()].reduce((s, n) => s + n, 0) + file.size;
  if (conEste > TOPES_ZIP.total)
    return `Con «${nombre}», los planos de la obra pasan de 2 GB: la copia completa (.zip) no cabrá y tendrás que guardar los PDF por separado.`;
  if (file.size > AVISO_BYTES) return `«${nombre}» pesa ${mb(file.size)}: la copia de la obra será grande.`;
  return undefined;
}

async function leerYHuella(file: File, onFase: Fase): Promise<{ bytes: ArrayBuffer; huella: string } | Fallo> {
  onFase?.('leyendo');
  let bytes: ArrayBuffer;
  try {
    bytes = await leerArchivo(file);
  } catch {
    return { kind: 'error', texto: 'No se pudo leer el archivo.' };
  }
  if (bytes.byteLength === 0) return { kind: 'error', texto: 'El archivo está vacío.' };
  onFase?.('huella');
  return { bytes, huella: await calcularHuella(bytes) };
}

/** Abre el PDF (copia de los bytes: pdf.js se queda con el buffer), le pasa el
 *  documento a `usar` y lo cierra. Contraseña, dañado o demasiadas páginas: el
 *  motivo, antes de guardar nada. */
async function abrirPdf<T>(
  bytes: ArrayBuffer,
  nombre: string,
  onFase: Fase,
  usar: (doc: DocPdf) => Promise<T>,
): Promise<{ paginas: number; valor: T } | Fallo> {
  onFase?.('abriendo');
  let doc: DocPdf;
  try {
    doc = await motorPdf().abrir(bytes.slice(0), { signal: new AbortController().signal });
  } catch (e) {
    const tipo = e instanceof ErrorPdf ? e.tipo : 'danado';
    if (tipo === 'contrasena') return { kind: 'error', texto: 'Este PDF tiene contraseña: quítala y vuelve a adjuntarlo.' };
    if (tipo === 'vacio') return { kind: 'error', texto: 'El archivo está vacío.' };
    if (tipo === 'worker')
      return { kind: 'error', texto: `No se pudo abrir «${nombre}»: ${(e as ErrorPdf).causa ?? 'el motor de PDF no responde'}.` };
    return {
      kind: 'error',
      texto: `No se pudo leer «${nombre}» (dañado o no es un PDF). Ábrelo en otro visor y vuelve a guardarlo.`,
    };
  }
  try {
    if (doc.paginas > MAX_PAGINAS) return { kind: 'error', texto: `«${nombre}» tiene ${doc.paginas} páginas: el máximo es 2 000.` };
    return { paginas: doc.paginas, valor: await usar(doc) };
  } catch {
    return { kind: 'error', texto: `No se pudo leer «${nombre}» (dañado o no es un PDF). Ábrelo en otro visor y vuelve a guardarlo.` };
  } finally {
    doc.cerrar();
  }
}

/** [A1] ¿Cabe lo guardado de `plano` en las páginas de `doc`? (§9.3) */
async function encajaEn(doc: DocPdf, plano: PlanoMeta): Promise<boolean> {
  if (doc.paginas !== plano.paginas) return false;
  const partidas = useObraStore.getState().partidas;
  const cajas = new Map<number, Caja>();
  for (const n of paginasConGeometria(plano, partidas)) cajas.set(n, (await doc.pagina(n)).vista);
  return encajaEnPaginas(plano, partidas, doc.paginas, cajas);
}

async function guardarBytes(huella: string, bytes: ArrayBuffer, onFase: Fase): Promise<Fallo | null> {
  onFase?.('guardando');
  try {
    await guardarPlano(huella, bytes, 'application/pdf');
  } catch (e) {
    if (esCuotaLlena(e)) {
      const esp = await espacioNavegador();
      return { kind: 'error', texto: `No queda espacio en el navegador${esp ? ` (usados ${gb(esp.usado)})` : ''}. Quita planos que no uses.` };
    }
    return { kind: 'error', texto: 'No se pudo guardar el PDF en este navegador.' };
  }
  usePlanoUiStore.getState().setDisponible(huella, true);
  return null;
}

const esFallo = (x: object): x is Fallo => 'kind' in x && x.kind === 'error';

/* ---- adjuntar ------------------------------------------------------------------- */

/**
 * Adjunta un PDF a la obra en pantalla. `destino`: se está reenlazando ESE
 * plano («Vuelve a adjuntar el PDF»). `nuevo`: «Adjuntar otra vez (para otra
 * escala)», otro plano con los mismos bytes aunque la huella ya esté.
 */
export async function adjuntarPlano(
  file: File,
  opts: { onFase?: (f: FaseAdjuntar) => void; destino?: string; nuevo?: boolean } = {},
): Promise<ResultadoAdjuntar> {
  const docToken = useObraStore.getState().docToken;
  const nombre = file.name || 'plano.pdf';
  const malo = tamanoNoValido(file, nombre);
  if (malo) return malo;
  const aviso = avisoTamano(file, nombre);

  const leido = await leerYHuella(file, opts.onFase);
  if (esFallo(leido)) return leido;
  const { bytes, huella } = leido;

  // ¿Ya conocemos estos bytes en esta obra?
  const vivos = planosVivos();
  if (opts.destino) {
    const d = vivos.find((p) => p.id === opts.destino);
    if (!d) return { kind: 'no-identico', encaja: false };
    if (d.huella !== huella) {
      // [A1] Otro PDF: ¿se puede usar para este plano? (se decide en la interfaz)
      const a = await abrirPdf(bytes, nombre, opts.onFase, (doc) => encajaEn(doc, d));
      return esFallo(a) ? a : { kind: 'no-identico', encaja: a.valor };
    }
  }
  const mismo = opts.destino ? vivos.find((p) => p.id === opts.destino) : vivos.find((p) => !p.quitado && p.huella === huella);
  if (mismo && !opts.nuevo) {
    const disponible = await tienePlano(huella).catch(() => false);
    if (disponible && !opts.destino) return { kind: 'duplicado', planoId: mismo.id, nombre: mismo.nombre };
  }

  const abierto = await abrirPdf(bytes, nombre, opts.onFase, async () => undefined);
  if (esFallo(abierto)) return abierto;
  const guardado = await guardarBytes(huella, bytes, opts.onFase);
  if (guardado) return guardado;

  // Los bytes ya están: si la obra cambió, no se publica nada (se quedan guardados).
  const obra = useObraStore.getState();
  if (obra.docToken !== docToken) return { kind: 'cancelado' };
  const ui = usePlanoUiStore.getState();
  if (mismo && !opts.nuevo) {
    ui.abrirPlano(mismo.id, 1);
    return { kind: 'reenlazado', planoId: mismo.id };
  }
  const meta: PlanoMeta = {
    id: nextPlanoId(),
    tipo: 'pdf',
    nombre: nombreDeArchivo(nombre),
    archivo: nombre,
    tamano: bytes.byteLength,
    huella,
    paginas: abierto.paginas,
    escalas: {},
  };
  const res = obra.attachPlano({ meta, expect: { docToken }, nuevo: opts.nuevo });
  const planoId = res.ids[0];
  if (!planoId) return { kind: 'error', texto: 'No se pudo añadir el plano a la obra (máximo 200 planos).' };
  ui.abrirPlano(planoId, 1);
  return { kind: 'ok', planoId, revivido: planoId !== meta.id, ...(aviso ? { aviso } : {}) };
}

/**
 * [A1] «Adjuntar revisión» (y «Adjuntar como revisión nueva» al reenlazar con
 * otro PDF): un plano NUEVO que sustituye a `sustituye`, con su nombre y la
 * revisión siguiente. El anterior, sus escalas y sus líneas no se tocan.
 */
export async function adjuntarRevision(
  file: File,
  opts: { sustituye: string; onFase?: (f: FaseAdjuntar) => void },
): Promise<ResultadoRevision> {
  const docToken = useObraStore.getState().docToken;
  const nombre = file.name || 'plano.pdf';
  const malo = tamanoNoValido(file, nombre);
  if (malo) return malo;
  const aviso = avisoTamano(file, nombre);
  const viejo = planosVivos().find((p) => p.id === opts.sustituye && !p.quitado);
  if (!viejo) return { kind: 'error', texto: 'Ese plano ya no está en la obra.' };

  const leido = await leerYHuella(file, opts.onFase);
  if (esFallo(leido)) return leido;
  if (leido.huella === viejo.huella)
    return { kind: 'error', texto: `Es el mismo PDF que «${nombreConRevision(viejo)}»: una revisión es otro PDF.` };
  const abierto = await abrirPdf(leido.bytes, nombre, opts.onFase, async () => undefined);
  if (esFallo(abierto)) return abierto;
  const guardado = await guardarBytes(leido.huella, leido.bytes, opts.onFase);
  if (guardado) return guardado;

  const obra = useObraStore.getState();
  if (obra.docToken !== docToken) return { kind: 'cancelado' };
  const meta: PlanoMeta = {
    id: nextPlanoId(),
    tipo: 'pdf',
    nombre: viejo.nombre,
    archivo: nombre,
    tamano: leido.bytes.byteLength,
    huella: leido.huella,
    paginas: abierto.paginas,
    escalas: {},
  };
  const res = obra.attachPlanoRevision({ meta, sustituye: viejo.id, expect: { docToken } });
  const planoId = res.ids[0];
  if (!planoId) return { kind: 'error', texto: res.reason === 'noop' ? 'No se pudo añadir la revisión (máximo 200 planos).' : textoResultado(res) };
  const nuevo = useObraStore.getState().planos.find((p): p is PlanoMeta => planoLegible(p) && p.id === planoId)!;
  const ui = usePlanoUiStore.getState();
  ui.abrirPlano(planoId, Math.min(ui.planoId === viejo.id ? ui.pagina : 1, abierto.paginas));
  return { kind: 'ok', planoId, revision: nuevo.revision ?? '', ...(aviso ? { aviso } : {}) };
}

/**
 * [A1] «Usar este PDF para este plano» (§9.3): el plano pasa a este PDF (otra
 * huella) si tiene sus páginas y lo guardado cabe en ellas. Conserva escalas y
 * líneas; cada página calibrada pide una comprobación nueva.
 */
export async function usarPdfParaPlano(
  file: File,
  opts: { planoId: string; onFase?: (f: FaseAdjuntar) => void },
): Promise<ResultadoReenlace> {
  const docToken = useObraStore.getState().docToken;
  const nombre = file.name || 'plano.pdf';
  const malo = tamanoNoValido(file, nombre);
  if (malo) return malo;
  const plano = planosVivos().find((p) => p.id === opts.planoId && !p.quitado);
  if (!plano) return { kind: 'error', texto: 'Ese plano ya no está en la obra.' };

  const leido = await leerYHuella(file, opts.onFase);
  if (esFallo(leido)) return leido;
  const abierto = await abrirPdf(leido.bytes, nombre, opts.onFase, (doc) => encajaEn(doc, plano));
  if (esFallo(abierto)) return abierto;
  if (leido.huella !== plano.huella && !abierto.valor) return { kind: 'no-encaja' };
  const guardado = await guardarBytes(leido.huella, leido.bytes, opts.onFase);
  if (guardado) return guardado;

  const obra = useObraStore.getState();
  if (obra.docToken !== docToken) return { kind: 'cancelado' };
  if (leido.huella !== plano.huella) {
    const res = obra.relinkPlano({
      planoId: plano.id,
      huella: leido.huella,
      tamano: leido.bytes.byteLength,
      archivo: nombre,
      paginas: abierto.paginas,
      expect: { docToken, huella: plano.huella },
    });
    if (!res.ids.length) return { kind: 'error', texto: textoResultado(res) };
  }
  let lineas = 0;
  for (const ps of Object.values(useObraStore.getState().partidas))
    for (const p of ps) for (const l of p.med) if (origenLegible(l.origen) && l.origen.planoId === plano.id) lineas++;
  const calibradas = Object.keys(plano.escalas).filter((k) => escalaDe(plano, Number(k))).length;
  return { kind: 'ok', planoId: plano.id, lineas, calibradas };
}
