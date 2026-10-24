/* ===========================================================================
   descargaBase — bajar una base oficial (`core/basesOficiales`) desde la web
   del organismo y dejarla como un `File` .bc3 listo para `useBc3Parse`.

   Sin React (se prueba con un `fetch` simulado). Reglas del plan
   (docs/plan-bases-oficiales.md):
     · progreso sobre `descarga.bytes` del catálogo, no sobre Content-Length
       (Extremadura lo sirve con gzip y sin esa cabecera); se para en 99 %
       hasta terminar (D5);
     · el cuerpo se lee como bytes, nunca con `text()` (el .bc3 trae su propia
       codificación) (D7);
     · el ZIP (BCCA) se abre con el lector de `persist/zip`, que corta lo
       descomprimido en un tope; tiene que traer un único .bc3.
   =========================================================================== */
import type { BaseOficial } from '../../core/basesOficiales';
import { ErrorZip, empiezaComoZip, leerDirectorio, leerEntrada } from '../../persist/zip';

export type MotivoDescarga = 'red' | 'http' | 'zip' | 'abortada';

export class ErrorDescarga extends Error {
  constructor(
    public motivo: MotivoDescarga,
    message: string,
  ) {
    super(message);
    this.name = 'ErrorDescarga';
  }
}

/** `fraccion` entre 0 y 1; `null` si no hay total con el que calcularla. */
export interface ProgresoDescarga {
  leidos: number;
  fraccion: number | null;
}

/** Tope de lo descomprimido de un .bc3 dentro de un ZIP (el mayor que
 *  conocemos, Precio Centro, ronda los 34 MB). */
const MAX_BC3 = 200 * 1024 * 1024;
/** Un ZIP de base trae un .bc3 y, como mucho, algún leame. */
const MAX_ENTRADAS = 50;

/** El nombre del fichero: el último tramo de la ruta que parece uno. La URL de
 *  Extremadura (Liferay) acaba en un identificador: `…/BCEXTGREM_26_v1.bc3/8066c810-…`. */
function nombreDeUrl(url: string): string {
  const tramos = new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  return [...tramos].reverse().find((t) => /\.(bc3|zip)$/i.test(t)) ?? tramos.at(-1) ?? 'base';
}

function esAbort(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'AbortError';
}

/**
 * Descarga la base y devuelve su .bc3 como `File`. Lanza `ErrorDescarga`:
 * `red` (sin red o CORS bloqueada: el navegador no distingue), `http` (404…),
 * `zip` (dañado o sin un único .bc3) o `abortada`.
 */
export async function descargarBase(
  base: BaseOficial,
  opts: { signal: AbortSignal; onProgreso?: (p: ProgresoDescarga) => void; fetchFn?: typeof fetch },
): Promise<File> {
  const d = base.descarga;
  if (!d) throw new ErrorDescarga('http', `${base.nombreCorto} no se puede descargar desde la app.`);
  const fetchFn = opts.fetchFn ?? fetch;

  let res: Response;
  try {
    res = await fetchFn(d.url, { signal: opts.signal, credentials: 'omit' });
  } catch (e) {
    if (esAbort(e)) throw new ErrorDescarga('abortada', 'Descarga cancelada.');
    throw new ErrorDescarga('red', 'No se pudo conectar con la web oficial.');
  }
  if (!res.ok) throw new ErrorDescarga('http', `La web oficial respondió ${res.status}.`);

  let bytes: Uint8Array;
  try {
    bytes = await leerCuerpo(res, d.bytes, opts.onProgreso);
  } catch (e) {
    if (esAbort(e) || opts.signal.aborted) throw new ErrorDescarga('abortada', 'Descarga cancelada.');
    throw new ErrorDescarga('red', 'La descarga se cortó a medias.');
  }
  if (opts.signal.aborted) throw new ErrorDescarga('abortada', 'Descarga cancelada.');
  opts.onProgreso?.({ leidos: bytes.length, fraccion: 1 });

  const fichero = new File([bytes as BlobPart], nombreDeUrl(d.url));
  return d.formato === 'zip' ? bc3DeZip(fichero) : fichero;
}

/** Lee el cuerpo por trozos y avisa del progreso. Sin `body` legible (algún
 *  entorno de pruebas), cae a `arrayBuffer()` sin progreso intermedio. */
async function leerCuerpo(
  res: Response,
  total: number,
  onProgreso?: (p: ProgresoDescarga) => void,
): Promise<Uint8Array> {
  const lector = res.body?.getReader();
  if (!lector) return new Uint8Array(await res.arrayBuffer());
  const trozos: Uint8Array[] = [];
  let leidos = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    leidos += value.length;
    onProgreso?.({ leidos, fraccion: total > 0 ? Math.min(leidos / total, 0.99) : null });
  }
  const out = new Uint8Array(leidos);
  let p = 0;
  for (const t of trozos) {
    out.set(t, p);
    p += t.length;
  }
  return out;
}

/** El único .bc3 de un ZIP, como `File`. */
export async function bc3DeZip(zip: Blob): Promise<File> {
  try {
    const bc3s = (await leerDirectorio(zip, MAX_ENTRADAS)).filter((e) => /\.bc3$/i.test(e.nombre));
    if (bc3s.length !== 1)
      throw new ErrorDescarga(
        'zip',
        bc3s.length === 0 ? 'El ZIP no trae ningún .bc3.' : 'El ZIP trae más de un .bc3: suelta el que quieras.',
      );
    const entrada = bc3s[0]!;
    const { datos } = await leerEntrada(zip, entrada, { max: MAX_BC3, guardar: true, crc: true });
    const nombre = entrada.nombre.split('/').at(-1) ?? entrada.nombre;
    return new File([datos as BlobPart], nombre);
  } catch (e) {
    if (e instanceof ErrorDescarga) throw e;
    if (e instanceof ErrorZip) throw new ErrorDescarga('zip', 'El ZIP está dañado o no se puede abrir.');
    throw e;
  }
}

/** Lo que se suelta a mano con una base asociada (D14): un .zip se abre y se
 *  saca su .bc3; cualquier otra cosa pasa tal cual al parser. */
export async function bc3DeFichero(f: File): Promise<File> {
  return (await empiezaComoZip(f)) ? bc3DeZip(f) : f;
}
