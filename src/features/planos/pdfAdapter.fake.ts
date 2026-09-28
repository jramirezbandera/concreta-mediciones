/* ===========================================================================
   features/planos/pdfAdapter.fake — doble del motor de PDF para los tests de
   la interfaz (jsdom no tiene canvas ni worker). Lee los PDF que escribe
   `src/test/pdfMinimo` (cajas, /Rotate, /UserUnit y textos) y cumple el mismo
   contrato que el real: los dos pasan `pdfAdapter.contrato`.
   =========================================================================== */
import type { Caja, Rotacion } from '../../core/planoGeom';
import { ErrorPdf, type DocPdf, type PaginaPdf, type PdfAdapter, type TextoPdf } from './pdfTipos';

interface PaginaFake extends PaginaPdf {
  textos: TextoPdf[];
}

const numeros = (s: string | undefined): number[] =>
  (s ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);

function leerPdf(bytes: Uint8Array): PaginaFake[] {
  let txt = '';
  for (const b of bytes) txt += String.fromCharCode(b);
  if (!txt.startsWith('%PDF-')) throw new ErrorPdf('danado', 'no es un PDF');
  if (txt.includes('/Encrypt')) throw new ErrorPdf('contrasena');
  const objs = new Map<number, string>();
  for (const m of txt.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) objs.set(Number(m[1]), m[2]!);
  const raiz = [...objs.values()].find((o) => o.includes('/Type /Pages'));
  const kids = raiz?.match(/\/Kids \[([^\]]*)\]/)?.[1];
  if (!kids) throw new ErrorPdf('danado', 'sin páginas');
  return [...kids.matchAll(/(\d+) 0 R/g)].map((k) => {
    const o = objs.get(Number(k[1]))!;
    const media = numeros(o.match(/\/MediaBox \[([^\]]*)\]/)?.[1]);
    const crop = numeros(o.match(/\/CropBox \[([^\]]*)\]/)?.[1]);
    const norm = (c: number[]): Caja => [Math.min(c[0]!, c[2]!), Math.min(c[1]!, c[3]!), Math.max(c[0]!, c[2]!), Math.max(c[1]!, c[3]!)];
    const m = norm(media);
    const c = crop.length === 4 ? norm(crop) : m;
    const vista: Caja = [Math.max(m[0], c[0]), Math.max(m[1], c[1]), Math.min(m[2], c[2]), Math.min(m[3], c[3])];
    const rot = Number(o.match(/\/Rotate (-?\d+)/)?.[1] ?? 0);
    const userUnit = Number(o.match(/\/UserUnit ([\d.]+)/)?.[1] ?? 1);
    const cont = objs.get(Number(o.match(/\/Contents (\d+) 0 R/)?.[1])) ?? '';
    const flujo = cont.split('\nstream\n')[1]?.split('\nendstream')[0] ?? '';
    const textos: TextoPdf[] = [...flujo.matchAll(/BT \/F1 (\S+) Tf (\S+) (\S+) Td \(((?:\\.|[^\\)])*)\) Tj ET/g)].map((t) => {
      const tamano = Number(t[1]);
      const x = Number(t[2]);
      const y = Number(t[3]);
      const texto = t[4]!.replace(/\\(.)/g, '$1');
      return { texto, caja: [x, y, x + 0.5 * tamano * texto.length, y + tamano], tamano, dir: [1, 0] };
    });
    return { vista, rotacion: ((((rot % 360) + 360) % 360) as Rotacion), userUnit, textos };
  });
}

export interface OpcionesFake {
  /** Milisegundos que tarda en abrir (para probar respuestas que llegan tarde). */
  retardo?: number;
  /** Falla al pintar (worker caído, página rota). */
  fallarAlPintar?: boolean;
}

/** Documentos abiertos y cerrados por el doble (para los tests). */
export const registroFake = { abiertos: 0, cerrados: 0, pintados: 0, precargas: [] as number[] };

export function crearAdapterFake(opts: OpcionesFake = {}): PdfAdapter {
  return {
    async abrir(datos, { signal }) {
      if (datos.byteLength === 0) throw new ErrorPdf('vacio');
      if (opts.retardo)
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, opts.retardo);
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new ErrorPdf('cancelado'));
          });
        });
      if (signal.aborted) throw new ErrorPdf('cancelado');
      const paginas = leerPdf(new Uint8Array(datos));
      registroFake.abiertos++;
      let cerrado = false;
      const pagina = (n: number): PaginaFake => {
        const p = paginas[n - 1];
        if (!p || cerrado) throw new ErrorPdf(cerrado ? 'cancelado' : 'danado', `página ${n}`);
        return p;
      };
      const doc: DocPdf = {
        paginas: paginas.length,
        async pagina(n) {
          const { vista, rotacion, userUnit } = pagina(n);
          return { vista, rotacion, userUnit };
        },
        async pintar(n, lienzo, region, escala, signal) {
          if (signal.aborted) throw new ErrorPdf('cancelado');
          pagina(n);
          if (opts.fallarAlPintar) throw new ErrorPdf('worker', 'el worker no responde');
          const w = Math.abs(region[2] - region[0]) * escala;
          const h = Math.abs(region[3] - region[1]) * escala;
          lienzo.width = Math.max(1, Math.ceil(w));
          lienzo.height = Math.max(1, Math.ceil(h));
          await Promise.resolve();
          if (signal.aborted) throw new ErrorPdf('cancelado');
          registroFake.pintados++;
        },
        async precargar(n, signal) {
          if (cerrado || signal.aborted || !paginas[n - 1]) return;
          await Promise.resolve();
          if (!signal.aborted) registroFake.precargas.push(n);
        },
        async textos(n) {
          return pagina(n).textos.map((t) => ({ ...t, caja: [...t.caja] as Caja, dir: [...t.dir] as [number, number] }));
        },
        cerrar() {
          if (cerrado) return;
          cerrado = true;
          registroFake.cerrados++;
        },
      };
      return doc;
    },
  };
}

export const pdfAdapterFake: PdfAdapter = crearAdapterFake();
