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
   =========================================================================== */
import { fmtNum } from '../../core/money';
import { planoLegible } from '../../core/planoDatos';
import type { PlanoMeta } from '../../core/types';
import { calcularHuella } from '../../persist/huella';
import { esCuotaLlena, espacioNavegador, guardarPlano, tienePlano } from '../../persist/planos';
import { TOPES_ZIP } from '../../persist/transfer';
import { useObraStore } from '../../store';
import { nextPlanoId } from '../../store/base';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { motorPdf } from './motor';
import { ErrorPdf } from './pdfTipos';

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
  /** Se quería reenlazar un plano concreto y este PDF no es el mismo (A0). */
  | { kind: 'no-identico' }
  | { kind: 'error'; texto: string }
  /** Cambió la obra mientras se adjuntaba: no se publica nada. */
  | { kind: 'cancelado' };

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
  if (file.size === 0) return { kind: 'error', texto: 'El archivo está vacío.' };
  if (file.size > MAX_BYTES)
    return {
      kind: 'error',
      texto: `«${nombre}» pesa ${mb(file.size)}: el máximo es 500 MB. Divide el plano o expórtalo con menos resolución.`,
    };
  // [A1] Un solo contrato con la copia .zip (§9.2): si con este plano la obra
  // pasa de sus topes, se avisa ya (la copia se hará como .json y PDF sueltos).
  const enObra = new Map(planosVivos().filter((p) => !p.quitado).map((p) => [p.huella, p.tamano]));
  const conEste = [...enObra.values()].reduce((s, n) => s + n, 0) + file.size;
  const aviso =
    conEste > TOPES_ZIP.total
      ? `Con «${nombre}», los planos de la obra pasan de 2 GB: la copia completa (.zip) no cabrá y tendrás que guardar los PDF por separado.`
      : file.size > AVISO_BYTES
        ? `«${nombre}» pesa ${mb(file.size)}: la copia de la obra será grande.`
        : undefined;

  opts.onFase?.('leyendo');
  let bytes: ArrayBuffer;
  try {
    bytes = await leerArchivo(file);
  } catch {
    return { kind: 'error', texto: 'No se pudo leer el archivo.' };
  }
  if (bytes.byteLength === 0) return { kind: 'error', texto: 'El archivo está vacío.' };

  opts.onFase?.('huella');
  const huella = await calcularHuella(bytes);

  // ¿Ya conocemos estos bytes en esta obra?
  const vivos = planosVivos();
  if (opts.destino) {
    const d = vivos.find((p) => p.id === opts.destino);
    if (!d || d.huella !== huella) return { kind: 'no-identico' };
  }
  const mismo = opts.destino ? vivos.find((p) => p.id === opts.destino) : vivos.find((p) => !p.quitado && p.huella === huella);
  if (mismo && !opts.nuevo) {
    const disponible = await tienePlano(huella).catch(() => false);
    if (disponible && !opts.destino) return { kind: 'duplicado', planoId: mismo.id, nombre: mismo.nombre };
  }

  opts.onFase?.('abriendo');
  let paginas: number;
  try {
    const doc = await motorPdf().abrir(bytes.slice(0), { signal: new AbortController().signal });
    paginas = doc.paginas;
    doc.cerrar();
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
  if (paginas > MAX_PAGINAS) return { kind: 'error', texto: `«${nombre}» tiene ${paginas} páginas: el máximo es 2 000.` };

  opts.onFase?.('guardando');
  try {
    await guardarPlano(huella, bytes, 'application/pdf');
  } catch (e) {
    if (esCuotaLlena(e)) {
      const esp = await espacioNavegador();
      return {
        kind: 'error',
        texto: `No queda espacio en el navegador${esp ? ` (usados ${gb(esp.usado)})` : ''}. Quita planos que no uses.`,
      };
    }
    return { kind: 'error', texto: 'No se pudo guardar el PDF en este navegador.' };
  }
  const ui = usePlanoUiStore.getState();
  ui.setDisponible(huella, true);

  // Los bytes ya están: si la obra cambió, no se publica nada (se quedan guardados).
  const obra = useObraStore.getState();
  if (obra.docToken !== docToken) return { kind: 'cancelado' };

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
    paginas,
    escalas: {},
  };
  const res = obra.attachPlano({ meta, expect: { docToken }, nuevo: opts.nuevo });
  const planoId = res.ids[0];
  if (!planoId) return { kind: 'error', texto: 'No se pudo añadir el plano a la obra (máximo 200 planos).' };
  ui.abrirPlano(planoId, 1);
  return { kind: 'ok', planoId, revivido: planoId !== meta.id, ...(aviso ? { aviso } : {}) };
}
