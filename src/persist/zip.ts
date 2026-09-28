/* ===========================================================================
   persist/zip — el formato .zip de la copia de la obra con planos (§9.2),
   escrito y leído a mano sobre el ZIP clásico (sin ZIP64: la copia no pasa de
   2 GB). fflate solo comprime y descomprime (DEFLATE).

   Por qué no el `Zip`/`Unzip` en flujo de fflate: su `Zip` escribe siempre
   descriptores de datos (los tamaños DESPUÉS de los datos) y su `Unzip` los
   busca escaneando los bytes, así que un PDF guardado sin comprimir que
   contenga por azar la firma `PK\x07\x08` se partiría mal. Aquí:

     · escribir: cada entrada lleva su CRC y sus tamaños en la cabecera local
       (los bytes ya están en memoria), por partes en un Blob;
     · leer: por el directorio central, con lectura aleatoria del fichero
       (`slice`), una entrada cada vez. Lo descomprimido se CUENTA al
       descomprimir en flujo y se corta al pasarse de su tope: nunca se confía
       en los tamaños declarados.
   =========================================================================== */
import { Deflate, Inflate, strToU8 } from 'fflate';

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FIN = 0x06054b50;
/** Nombres en UTF-8 (bit 11). */
const FLAG_UTF8 = 0x0800;
/** Lectura del fichero y CRC, por trozos de 4 MB. */
const TROZO = 4 * 1024 * 1024;
/** DEFLATE en trozos de 64 KB: como mucho ~66 MB de salida por trozo (razón
 *  máxima ~1032:1), así una bomba no reserva gigas antes de poder cortarla. */
const TROZO_INFLAR = 64 * 1024;

export type MotivoZip = 'danado' | 'cifrado' | 'metodo' | 'grande' | 'entradas';

export class ErrorZip extends Error {
  constructor(
    public motivo: MotivoZip,
    public entrada?: string,
  ) {
    super(entrada ? `${motivo}: ${entrada}` : motivo);
    this.name = 'ErrorZip';
  }
}

/** Una entrada del directorio central. `declarado` es el tamaño que DICE el
 *  zip: solo sirve de pista, nunca de tope. */
export interface EntradaZip {
  nombre: string;
  flags: number;
  metodo: number;
  crc: number;
  comprimido: number;
  declarado: number;
  offsetLocal: number;
}

/* ---- CRC-32 ------------------------------------------------------------------ */
const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

/** CRC-32 de `datos`, siguiendo a `previo` (para ir por trozos). */
export function crc32(datos: Uint8Array, previo = 0): number {
  let c = ~previo;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

/** Cede el hilo entre trozos: exportar o restaurar cientos de MB no congela la
 *  interfaz. */
const ceder = () => new Promise<void>((r) => setTimeout(r, 0));

const vista = (u: Uint8Array) => new DataView(u.buffer, u.byteOffset, u.byteLength);

/** Lee `[desde, hasta)` del fichero. `Blob.arrayBuffer` si existe; si no
 *  (jsdom), `FileReader`. */
function leerTrozo(archivo: Blob, desde: number, hasta: number): Promise<Uint8Array> {
  const b = archivo.slice(desde, hasta);
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer().then((x) => new Uint8Array(x));
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error ?? new Error('No se pudo leer el archivo'));
    fr.readAsArrayBuffer(b);
  });
}

/* ---- escribir ---------------------------------------------------------------- */
function fechaDos(d: Date): { hora: number; dia: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    dia: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

interface Central {
  nombre: Uint8Array;
  metodo: 0 | 8;
  crc: number;
  comprimido: number;
  tamano: number;
  offset: number;
}

/**
 * Escribe un .zip por partes: cada `anadir` deja su cabecera y sus datos en
 * un Blob propio (el navegador puede llevarlo a disco y soltar el buffer), y
 * `cerrar` pone el directorio central.
 */
export class EscritorZip {
  private partes: Blob[] = [];
  private central: Central[] = [];
  private offset = 0;
  private fecha = fechaDos(new Date());

  /** Añade un fichero. `comprimir`: DEFLATE (el `obra.json`); sin comprimir
   *  para los PDF, que ya van comprimidos por dentro. */
  async anadir(nombre: string, datos: Uint8Array, comprimir: boolean): Promise<void> {
    const n = strToU8(nombre);
    let crc = 0;
    for (let p = 0; p < datos.length; p += TROZO) {
      crc = crc32(datos.subarray(p, p + TROZO), crc);
      if (p + TROZO < datos.length) await ceder();
    }
    const cuerpo = comprimir ? await desinflar(datos) : [datos];
    const comprimido = cuerpo.reduce((s, c) => s + c.length, 0);
    const metodo = comprimir ? 8 : 0;
    const cab = new Uint8Array(30 + n.length);
    const v = vista(cab);
    v.setUint32(0, FIRMA_LOCAL, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, FLAG_UTF8, true);
    v.setUint16(8, metodo, true);
    v.setUint16(10, this.fecha.hora, true);
    v.setUint16(12, this.fecha.dia, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, comprimido, true);
    v.setUint32(22, datos.length, true);
    v.setUint16(26, n.length, true);
    cab.set(n, 30);
    this.partes.push(new Blob([cab, ...cuerpo] as BlobPart[]));
    this.central.push({ nombre: n, metodo, crc, comprimido, tamano: datos.length, offset: this.offset });
    this.offset += cab.length + comprimido;
    if (this.offset > 0xffffffff) throw new ErrorZip('grande', nombre);
  }

  /** Directorio central y fin: el .zip entero. */
  cerrar(): Blob {
    const trozos: Uint8Array[] = [];
    let tam = 0;
    for (const c of this.central) {
      const e = new Uint8Array(46 + c.nombre.length);
      const v = vista(e);
      v.setUint32(0, FIRMA_CENTRAL, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 20, true);
      v.setUint16(8, FLAG_UTF8, true);
      v.setUint16(10, c.metodo, true);
      v.setUint16(12, this.fecha.hora, true);
      v.setUint16(14, this.fecha.dia, true);
      v.setUint32(16, c.crc, true);
      v.setUint32(20, c.comprimido, true);
      v.setUint32(24, c.tamano, true);
      v.setUint16(28, c.nombre.length, true);
      v.setUint32(42, c.offset, true);
      e.set(c.nombre, 46);
      trozos.push(e);
      tam += e.length;
    }
    const fin = new Uint8Array(22);
    const v = vista(fin);
    v.setUint32(0, FIRMA_FIN, true);
    v.setUint16(8, this.central.length, true);
    v.setUint16(10, this.central.length, true);
    v.setUint32(12, tam, true);
    v.setUint32(16, this.offset, true);
    return new Blob([...this.partes, ...trozos, fin] as BlobPart[], { type: 'application/zip' });
  }
}

async function desinflar(datos: Uint8Array): Promise<Uint8Array[]> {
  const partes: Uint8Array[] = [];
  const d = new Deflate({ level: 6 }, (trozo) => partes.push(trozo));
  if (!datos.length) d.push(new Uint8Array(0), true);
  for (let p = 0; p < datos.length; p += TROZO) {
    const fin = p + TROZO >= datos.length;
    d.push(datos.subarray(p, p + TROZO), fin);
    if (!fin) await ceder();
  }
  return partes;
}

/* ---- leer -------------------------------------------------------------------- */
/** ¿Empieza como un .zip? (cabecera local, o el fin de un zip vacío). */
export async function empiezaComoZip(archivo: Blob): Promise<boolean> {
  if (archivo.size < 4) return false;
  const f = vista(await leerTrozo(archivo, 0, 4)).getUint32(0, true);
  return f === FIRMA_LOCAL || f === FIRMA_FIN;
}

/**
 * El directorio central del .zip. Rechaza (sin leer nada más) un zip con más
 * de `maxEntradas` entradas, uno ZIP64 (una copia de Concreta nunca lo es) y
 * uno cuyo directorio no cuadra con el fichero.
 */
export async function leerDirectorio(archivo: Blob, maxEntradas: number): Promise<EntradaZip[]> {
  const n = archivo.size;
  if (n < 22) throw new ErrorZip('danado');
  const desde = Math.max(0, n - 22 - 0xffff);
  const cola = await leerTrozo(archivo, desde, n);
  const v = vista(cola);
  let fin = -1;
  for (let i = cola.length - 22; i >= 0; i--)
    if (v.getUint32(i, true) === FIRMA_FIN) {
      fin = i;
      break;
    }
  if (fin < 0) throw new ErrorZip('danado');
  const total = v.getUint16(fin + 10, true);
  const tamCentral = v.getUint32(fin + 12, true);
  const offCentral = v.getUint32(fin + 16, true);
  if (total === 0xffff || tamCentral === 0xffffffff || offCentral === 0xffffffff) throw new ErrorZip('danado');
  if (total > maxEntradas) throw new ErrorZip('entradas');
  if (offCentral + tamCentral > desde + fin) throw new ErrorZip('danado');
  const central = await leerTrozo(archivo, offCentral, offCentral + tamCentral);
  const cv = vista(central);
  const dec = new TextDecoder();
  const out: EntradaZip[] = [];
  let p = 0;
  for (let k = 0; k < total; k++) {
    if (p + 46 > central.length || cv.getUint32(p, true) !== FIRMA_CENTRAL) throw new ErrorZip('danado');
    const ln = cv.getUint16(p + 28, true);
    const lx = cv.getUint16(p + 30, true);
    const lc = cv.getUint16(p + 32, true);
    if (p + 46 + ln > central.length) throw new ErrorZip('danado');
    const e: EntradaZip = {
      nombre: dec.decode(central.subarray(p + 46, p + 46 + ln)),
      flags: cv.getUint16(p + 8, true),
      metodo: cv.getUint16(p + 10, true),
      crc: cv.getUint32(p + 16, true),
      comprimido: cv.getUint32(p + 20, true),
      declarado: cv.getUint32(p + 24, true),
      offsetLocal: cv.getUint32(p + 42, true),
    };
    if (e.comprimido === 0xffffffff || e.declarado === 0xffffffff || e.offsetLocal === 0xffffffff)
      throw new ErrorZip('danado', e.nombre);
    out.push(e);
    p += 46 + ln + lx + lc;
  }
  return out;
}

/**
 * Lee una entrada contando lo descomprimido, y corta en cuanto pasa de `max`
 * (`ErrorZip('grande')`). `guardar: false` solo cuenta (no guarda nada en
 * memoria); `crc`: comprueba el CRC-32 de lo leído.
 */
export async function leerEntrada(
  archivo: Blob,
  e: EntradaZip,
  opts: { max: number; guardar: boolean; crc?: boolean },
): Promise<{ datos: Uint8Array | null; tamano: number }> {
  if (e.flags & 1) throw new ErrorZip('cifrado', e.nombre);
  if (e.metodo !== 0 && e.metodo !== 8) throw new ErrorZip('metodo', e.nombre);
  const cab = await leerTrozo(archivo, e.offsetLocal, e.offsetLocal + 30);
  if (cab.length < 30 || vista(cab).getUint32(0, true) !== FIRMA_LOCAL) throw new ErrorZip('danado', e.nombre);
  const inicio = e.offsetLocal + 30 + vista(cab).getUint16(26, true) + vista(cab).getUint16(28, true);
  const fin = inicio + e.comprimido;
  if (fin > archivo.size) throw new ErrorZip('danado', e.nombre);

  if (e.metodo === 0) {
    // Sin comprimir: lo que ocupa en el fichero es lo que hay.
    if (e.comprimido > opts.max) throw new ErrorZip('grande', e.nombre);
    if (!opts.guardar && !opts.crc) return { datos: null, tamano: e.comprimido };
    const datos = opts.guardar ? new Uint8Array(e.comprimido) : null;
    let crc = 0;
    for (let p = inicio; p < fin; p += TROZO) {
      const t = await leerTrozo(archivo, p, Math.min(fin, p + TROZO));
      datos?.set(t, p - inicio);
      if (opts.crc) crc = crc32(t, crc);
    }
    if (opts.crc && crc !== e.crc) throw new ErrorZip('danado', e.nombre);
    return { datos, tamano: e.comprimido };
  }

  // DEFLATE: se cuenta lo que sale, trozo a trozo, y se corta al pasarse.
  let tamano = 0;
  let crc = 0;
  const partes: Uint8Array[] = [];
  const inf = new Inflate((trozo) => {
    tamano += trozo.length;
    if (tamano > opts.max) throw new ErrorZip('grande', e.nombre);
    if (opts.crc) crc = crc32(trozo, crc);
    if (opts.guardar) partes.push(trozo);
  });
  try {
    if (inicio === fin) inf.push(new Uint8Array(0), true);
    for (let p = inicio; p < fin; p += TROZO) {
      const t = await leerTrozo(archivo, p, Math.min(fin, p + TROZO));
      for (let q = 0; q < t.length; q += TROZO_INFLAR) inf.push(t.subarray(q, q + TROZO_INFLAR), p + q + TROZO_INFLAR >= fin);
    }
  } catch (err) {
    if (err instanceof ErrorZip) throw err;
    throw new ErrorZip('danado', e.nombre); // DEFLATE roto o cortado
  }
  if (opts.crc && crc !== e.crc) throw new ErrorZip('danado', e.nombre);
  if (!opts.guardar) return { datos: null, tamano };
  const datos = new Uint8Array(tamano);
  let o = 0;
  for (const t of partes) {
    datos.set(t, o);
    o += t.length;
  }
  return { datos, tamano };
}
