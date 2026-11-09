/* Una File System Access API en memoria, para probar la obra en carpeta
   (`persist/carpeta`) sin navegador: carpetas, ficheros con fecha y tamaño,
   escritura que se cambia al cerrar, permisos y `isSameEntry`. Como el
   `aCarpeta.test.tsx` de Concreta FEM. */
import type { Directorio, Escritor, Fichero } from '../persist/carpeta';

let reloj = 1_700_000_000_000;
/** Fecha nueva y siempre mayor: cada escritura cambia la marca del fichero. */
const ahora = () => (reloj += 1000);

const aBytes = async (d: string | BufferSource | Blob): Promise<Uint8Array> => {
  if (typeof d === 'string') return new TextEncoder().encode(d);
  if (d instanceof Blob) return new Uint8Array(await new Response(d).arrayBuffer());
  if (d instanceof ArrayBuffer) return new Uint8Array(d.slice(0));
  return new Uint8Array((d as ArrayBufferView).buffer.slice(0));
};

/** Un `File` mínimo: jsdom no implementa `text()` ni `arrayBuffer()` en todos sus Blob. */
function fichero(nombre: string, bytes: Uint8Array, lastModified: number): File {
  return {
    name: nombre,
    size: bytes.length,
    lastModified,
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => bytes.slice(0).buffer,
  } as unknown as File;
}

export class FicheroMem implements Fichero {
  kind = 'file' as const;
  bytes = new Uint8Array();
  modificado = ahora();
  constructor(public name: string) {}
  async getFile(): Promise<File> {
    return fichero(this.name, this.bytes, this.modificado);
  }
  async createWritable(): Promise<Escritor> {
    const trozos: Uint8Array[] = [];
    return {
      write: async (d) => {
        trozos.push(await aBytes(d));
      },
      close: async () => {
        const n = trozos.reduce((s, t) => s + t.length, 0);
        const out = new Uint8Array(n);
        let i = 0;
        for (const t of trozos) {
          out.set(t, i);
          i += t.length;
        }
        this.bytes = out;
        this.modificado = ahora();
      },
      abort: async () => undefined,
    };
  }
  texto(): string {
    return new TextDecoder().decode(this.bytes);
  }
}

export class CarpetaMem implements Directorio {
  kind = 'directory' as const;
  ficheros = new Map<string, FicheroMem>();
  carpetas = new Map<string, CarpetaMem>();
  /** Lo que contesta `queryPermission`. */
  permiso: PermissionState = 'granted';
  /** Lo que contesta `requestPermission` (y en qué se queda el permiso). */
  alPedir: PermissionState = 'granted';
  constructor(public name: string) {}

  async getFileHandle(nombre: string, o?: { create?: boolean }): Promise<FicheroMem> {
    let f = this.ficheros.get(nombre);
    if (!f) {
      if (!o?.create) throw new DOMException(`no existe ${nombre}`, 'NotFoundError');
      f = new FicheroMem(nombre);
      this.ficheros.set(nombre, f);
    }
    return f;
  }
  async getDirectoryHandle(nombre: string, o?: { create?: boolean }): Promise<CarpetaMem> {
    let d = this.carpetas.get(nombre);
    if (!d) {
      if (!o?.create) throw new DOMException(`no existe ${nombre}`, 'NotFoundError');
      d = new CarpetaMem(nombre);
      this.carpetas.set(nombre, d);
    }
    return d;
  }
  async *values() {
    for (const f of this.ficheros.values()) yield { kind: 'file' as const, name: f.name };
    for (const d of this.carpetas.values()) yield { kind: 'directory' as const, name: d.name };
  }
  async queryPermission(): Promise<PermissionState> {
    return this.permiso;
  }
  async requestPermission(): Promise<PermissionState> {
    this.permiso = this.alPedir;
    return this.permiso;
  }
  async isSameEntry(otro: Directorio): Promise<boolean> {
    return otro === this;
  }

  /** Lo que haría el agente desde fuera: escribir el fichero entero. */
  escribirFuera(nombre: string, texto: string): void {
    const f = this.ficheros.get(nombre) ?? new FicheroMem(nombre);
    f.bytes = new TextEncoder().encode(texto);
    f.modificado = ahora();
    this.ficheros.set(nombre, f);
  }
  leer(nombre: string): string | undefined {
    return this.ficheros.get(nombre)?.texto();
  }
}
