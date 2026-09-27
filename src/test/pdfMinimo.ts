/* ===========================================================================
   test/pdfMinimo — PDF escritos a mano para los tests y el sandbox de planos
   (§8.2 de la especificación): sin binarios en el repositorio. Cada página
   admite MediaBox o CropBox con origen ≠ 0, /Rotate, /UserUnit, líneas y
   textos en Helvetica (WinAnsi).

   Es un PDF 1.7 válido y mínimo: catálogo, árbol de páginas, una fuente
   estándar y un flujo de contenido por página, con su tabla xref exacta. Lo
   leen pdf.js (tests de contrato, entorno node) y el doble `pdfAdapter.fake`.
   =========================================================================== */

export type PuntoPdf = [number, number];

export interface PaginaMinima {
  /** MediaBox [x0 y0 x1 y1]. */
  mediaBox: [number, number, number, number];
  cropBox?: [number, number, number, number];
  rotate?: 0 | 90 | 180 | 270;
  userUnit?: number;
  lineas?: [PuntoPdf, PuntoPdf][];
  textos?: { x: number; y: number; tamano: number; texto: string }[];
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);
const caja = (c: readonly number[]) => `[${c.map(num).join(' ')}]`;
const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function contenido(p: PaginaMinima): string {
  const partes: string[] = [];
  if (p.lineas?.length) {
    partes.push('0.8 w 0 0 0 RG');
    for (const [a, b] of p.lineas) partes.push(`${num(a[0])} ${num(a[1])} m ${num(b[0])} ${num(b[1])} l S`);
  }
  for (const t of p.textos ?? []) partes.push(`BT /F1 ${num(t.tamano)} Tf ${num(t.x)} ${num(t.y)} Td (${escapar(t.texto)}) Tj ET`);
  return partes.join('\n');
}

/** Bytes de un PDF con estas páginas (latin1: los textos, en ASCII/WinAnsi). */
export function pdfMinimo(paginas: PaginaMinima[]): Uint8Array {
  const objetos: string[] = [];
  const nPag = paginas.length;
  // 1 catálogo, 2 páginas, 3 fuente, luego (página, contenido) por página
  const idPagina = (i: number) => 4 + i * 2;
  const idContenido = (i: number) => 5 + i * 2;
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[2] = `<< /Type /Pages /Count ${nPag} /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] >>`;
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  paginas.forEach((p, i) => {
    const extra = [
      p.cropBox ? `/CropBox ${caja(p.cropBox)}` : '',
      p.rotate ? `/Rotate ${p.rotate}` : '',
      p.userUnit ? `/UserUnit ${num(p.userUnit)}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    objetos[idPagina(i)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox ${caja(p.mediaBox)} ${extra} /Resources << /Font << /F1 3 0 R >> >> /Contents ${idContenido(i)} 0 R >>`;
    const c = contenido(p);
    objetos[idContenido(i)] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
  });

  let out = '%PDF-1.7\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/* ---- el plano de ejemplo (sandbox y tests) ------------------------------------ */

/** A3 apaisado en puntos. */
export const A3: [number, number, number, number] = [0, 0, 1190.55, 841.89];
/** Un metro real a 1:50, en puntos de página (20 mm). */
export const METRO_1_50 = 72 / 25.4 * 20;

/**
 * Planta de ejemplo A3 a 1:50: un tabique de 5,00 m, una estancia de 5,00 ×
 * 4,00 m (20,00 m²), una cota de 10,00 m y otra vertical de 6,00 m para
 * calibrar, y el cajetín «E 1:50».
 */
export function planoEjemplo(): Uint8Array {
  const m = METRO_1_50;
  const x0 = 150;
  const y0 = 200;
  const tabique: [PuntoPdf, PuntoPdf] = [
    [x0, y0 + 6 * m],
    [x0 + 5 * m, y0 + 6 * m],
  ];
  const estancia: PuntoPdf[] = [
    [x0, y0],
    [x0 + 5 * m, y0],
    [x0 + 5 * m, y0 + 4 * m],
    [x0, y0 + 4 * m],
  ];
  const lineas: [PuntoPdf, PuntoPdf][] = [
    tabique,
    ...estancia.map((p, i): [PuntoPdf, PuntoPdf] => [p, estancia[(i + 1) % 4]!]),
    // cota horizontal de 10,00 m y vertical de 6,00 m
    [
      [100, 120],
      [100 + 10 * m, 120],
    ],
    [
      [1000, 100],
      [1000, 100 + 6 * m],
    ],
  ];
  return pdfMinimo([
    {
      mediaBox: A3,
      lineas,
      textos: [
        { x: x0 + 2 * m, y: y0 + 2 * m, tamano: 14, texto: 'SALON' },
        { x: 100, y: 128, tamano: 9, texto: '10,00' },
        { x: 1008, y: 100 + 3 * m, tamano: 9, texto: '6,00' },
        { x: 980, y: 60, tamano: 10, texto: 'PLANTA BAJA  E 1:50' },
      ],
    },
  ]);
}
