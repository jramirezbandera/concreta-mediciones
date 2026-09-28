/* ===========================================================================
   Precisión con planos REALES (§11: sustituye a la puerta cronometrada).

   En cada página con cotas se emparejan los textos de cota («3,45») con su
   línea de cota del dibujo: sus extremos son justo donde un usuario haría
   clic. Como en el visor, se calibra con la cota más larga, se comprueba con
   otra (a más de 45° si la hay) y se miden las demás con `prepararMedida`
   (Longitud en una partida por metros). Cada medida tiene que caer dentro de
   la tolerancia de longitudes: |Δ| ≤ 2 cm + 0,5 %.

   La app no puede ser más precisa que el dibujo: en un plano real hay cotas
   cuyo texto se escribió a mano y no cuadra con su propia línea (en el básico,
   pág. 10, «6,65» sobre una línea que mide 6,59 m a 1:100). Se admite hasta un
   5 % de esas y se nombran en el informe; más serían un error sistemático
   (escala, rotación, `userUnit`, redondeo) y la prueba falla.

   Una página puede tener detalles a otra escala: solo cuentan las cotas del
   grupo de escala dominante (a menos de un 3 % de su mediana); las demás son
   otra escala o un emparejado dudoso, y se informan sin fallar.

   Los PDF son de obras reales (datos de cliente): viven en `ejemplos pdf/`,
   fuera de git. Sin esa carpeta la prueba se salta.
   =========================================================================== */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { desviacion, dist, escalaN, mPorUnidadDeCota, redondearPunto } from '../../core/planoGeom';
import { prepararMedida } from '../../core/planoMedida';
import { comentarioPropuesto, escalaDeclarada, etiquetaPropuesta } from '../../core/planoTexto';
import type { Escala, Partida, Punto } from '../../core/types';
import { crearAdapterPdfjs } from './pdfAdapter';

const raiz = resolve(__dirname, '../../..');
const CARPETA = resolve(raiz, 'ejemplos pdf');
const pdfjsDir = resolve(raiz, 'node_modules/pdfjs-dist');

const PAGINAS: { fichero: string; paginas: number[] }[] = [
  { fichero: 'PROYECTO BASICO.pdf', paginas: [9, 10, 11, 13, 15] },
];

/** Tolerancia de longitudes (§11). */
const tolerancia = (metros: number) => 0.02 + 0.005 * metros;
/** Cotas del plano que pueden no cuadrar con su dibujo (texto escrito a mano). */
const CUOTA_DEL_PLANO = 0.05;

interface Cota {
  metros: number;
  a: Punto;
  b: Punto;
  /** Metros por unidad que da esta cota sola. */
  k: number;
}

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const aplicar = (m: M, x: number, y: number): Punto => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

async function cotasDePagina(fichero: string, n: number): Promise<{ cotas: Cota[]; userUnit: number }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve(pdfjsDir, 'legacy/build/pdf.worker.mjs')).href;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(resolve(CARPETA, fichero))),
    cMapUrl: `${resolve(pdfjsDir, 'cmaps')}/`,
    cMapPacked: true,
    standardFontDataUrl: `${resolve(pdfjsDir, 'standard_fonts')}/`,
    verbosity: 0,
  }).promise;
  try {
    const p = await doc.getPage(n);
    const { OPS } = pdfjs;

    // Tramos rectos trazados, en coordenadas de página (espacio de usuario sin rotar).
    const ol = await p.getOperatorList();
    const tramos: [Punto, Punto][] = [];
    let ctm: M = [1, 0, 0, 1, 0, 0];
    const pila: M[] = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i];
      const args = ol.argsArray[i] as unknown[];
      if (fn === OPS.save) pila.push(ctm);
      else if (fn === OPS.restore) ctm = pila.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args as M);
      else if (fn === OPS.paintFormXObjectBegin) {
        pila.push(ctm);
        if (args[0]) ctm = mul(ctm, args[0] as M);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = pila.pop() ?? ctm;
      else if (fn === OPS.constructPath) {
        const [pintura, datos] = args as [number, [Float32Array | null]];
        const d = datos[0];
        if (!d || (pintura !== OPS.stroke && pintura !== OPS.closeStroke)) continue;
        let k = 0;
        let cur: Punto | null = null;
        let ini: Punto | null = null;
        while (k < d.length) {
          const op = d[k++];
          if (op === 0) {
            cur = ini = aplicar(ctm, d[k]!, d[k + 1]!);
            k += 2;
          } else if (op === 1) {
            const q = aplicar(ctm, d[k]!, d[k + 1]!);
            k += 2;
            if (cur) tramos.push([cur, q]);
            cur = q;
          } else if (op === 2) {
            cur = aplicar(ctm, d[k + 4]!, d[k + 5]!);
            k += 6;
          } else if (op === 3) {
            cur = aplicar(ctm, d[k + 2]!, d[k + 3]!);
            k += 4;
          } else if (op === 4) {
            if (cur && ini) tramos.push([cur, ini]);
            cur = ini;
          } else break;
        }
      }
    }

    // Textos de cota («3,45»), con su dirección y su centro.
    const tc = await p.getTextContent();
    const cotas: Cota[] = [];
    for (const it of tc.items) {
      if (!('str' in it) || !/^\s*\d+[.,]\d{2}\s*$/.test(it.str)) continue;
      const metros = Number(it.str.trim().replace(',', '.'));
      if (metros < 0.3) continue; // espesores y holguras: se confunden con otros trazos
      const [a, b, c, d, e, f] = it.transform as number[];
      const largo = Math.hypot(a!, b!);
      const alto = Math.hypot(c!, d!);
      const dir: Punto = [a! / largo, b! / largo];
      const centro: Punto = [e! + (dir[0] * it.width) / 2, f! + (dir[1] * it.width) / 2];
      // La línea de cota: paralela al texto, a menos de dos alturas de letra,
      // más larga que el texto y con el centro del texto dentro del tramo.
      let mejor: { perp: number; a: Punto; b: Punto } | null = null;
      for (const [p0, p1] of tramos) {
        const L = dist(p0, p1);
        if (L < it.width) continue;
        const u: Punto = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
        if (Math.abs(u[0] * dir[0] + u[1] * dir[1]) < 0.999) continue;
        const t = ((centro[0] - p0[0]) * u[0] + (centro[1] - p0[1]) * u[1]) / L;
        if (t < 0.05 || t > 0.95) continue;
        const perp = Math.abs((centro[0] - p0[0]) * -u[1] + (centro[1] - p0[1]) * u[0]);
        if (perp > 2 * alto) continue;
        if (!mejor || perp < mejor.perp) mejor = { perp, a: p0, b: p1 };
      }
      if (mejor) cotas.push({ metros, a: mejor.a, b: mejor.b, k: metros / dist(mejor.a, mejor.b) });
    }
    return { cotas, userUnit: p.userUnit || 1 };
  } finally {
    await doc.loadingTask.destroy();
  }
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
};
/** Ángulo entre dos cotas, en grados de 0 a 90. */
const angulo = (x: Cota, y: Cota) => {
  const u = [x.b[0] - x.a[0], x.b[1] - x.a[1]];
  const v = [y.b[0] - y.a[0], y.b[1] - y.a[1]];
  const c = Math.abs(u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!));
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
};

const partida = { id: 'p', pos: '1', code: 'X', title: 'X', ud: 'm', precio: 1, desc: '', med: [], items: [] } as unknown as Partida;

describe.skipIf(!existsSync(CARPETA))('precisión con planos reales (ejemplos pdf/)', () => {
  for (const { fichero, paginas } of PAGINAS)
    for (const n of paginas)
      it(`${fichero} · pág. ${n}: calibrar con una cota y medir las demás, dentro de tolerancia`, async () => {
        const { cotas, userUnit } = await cotasDePagina(fichero, n);
        const km = mediana(cotas.map((c) => c.k));
        const grupo = cotas.filter((c) => Math.abs(c.k / km - 1) < 0.03);
        expect(grupo.length, 'cotas del grupo de escala dominante').toBeGreaterThanOrEqual(3);

        // Calibrar con la más larga y comprobar con otra, como en el visor.
        const [cal, ...resto] = [...grupo].sort((x, y) => y.metros - x.metros);
        const a = redondearPunto(cal!.a);
        const b = redondearPunto(cal!.b);
        const mPorUnidad = mPorUnidadDeCota(a, b, cal!.metros);
        const comp = resto.find((c) => angulo(cal!, c) > 45) ?? resto[0]!;
        const medidos = dist(redondearPunto(comp.a), redondearPunto(comp.b)) * mPorUnidad;
        const dev = desviacion(medidos, comp.metros);
        expect(dev, 'desviación de la comprobación').toBeLessThanOrEqual(0.01);
        const escala: Escala = {
          rev: 'cal-real',
          mPorUnidad,
          n: escalaN(mPorUnidad, userUnit),
          ref: { a, b, metros: cal!.metros },
          comprobacion: { fuente: 'cota', a: comp.a, b: comp.b, metros: comp.metros, medidos, desviacion: dev },
          at: '2026-09-28T00:00:00.000Z',
        };

        // Medir cada cota con la cadena de la app y comparar con lo que pone el plano.
        const fuera: string[] = [];
        let peor = 0;
        for (const c of resto) {
          const r = prepararMedida({
            herramienta: 'longitud',
            puntos: [c.a, c.b],
            plano: { id: 'pl', huella: 'h' },
            pagina: n,
            escala,
            partida,
            fijas: {},
            restar: false,
            comentario: '',
            formaId: 'f',
            at: escala.at,
          });
          expect(r.ok).toBe(true);
          if (!r.ok) continue;
          const largo = r.lineas[0]!.largo as number;
          const delta = Math.abs(largo - c.metros);
          if (delta > tolerancia(c.metros)) fuera.push(`${c.metros} m → ${largo} m`);
          else peor = Math.max(peor, delta / tolerancia(c.metros));
        }
        console.info(
          `${fichero} · pág. ${n}: 1:${escala.n}, calibrada con ${cal!.metros} m, comprobada ${(dev * 100).toFixed(2)} %; ` +
            `${resto.length - fuera.length} de ${resto.length} cotas dentro de tolerancia, la peor al ${(peor * 100).toFixed(0)} %` +
            (fuera.length ? `; no cuadran con su dibujo: ${fuera.join(', ')}` : '') +
            (cotas.length > grupo.length ? `; ${cotas.length - grupo.length} fuera del grupo (otra escala o emparejado dudoso)` : ''),
        );
        expect(fuera.length, `cotas que no cuadran: ${fuera.join(', ')}`).toBeLessThanOrEqual(Math.floor(resto.length * CUOTA_DEL_PLANO));
      });
});

describe.skipIf(!existsSync(CARPETA))('texto de planos reales (ejemplos pdf/)', () => {
  const motor = crearAdapterPdfjs(
    async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(resolve(pdfjsDir, 'legacy/build/pdf.worker.mjs')).href;
      return pdfjs;
    },
    () => ({
      cMapUrl: `${resolve(pdfjsDir, 'cmaps')}/`,
      cMapPacked: true,
      standardFontDataUrl: `${resolve(pdfjsDir, 'standard_fonts')}/`,
      wasmUrl: `${resolve(pdfjsDir, 'wasm')}/`,
      iccUrl: `${resolve(pdfjsDir, 'iccs')}/`,
    }),
  );
  const abrir = (fichero: string) =>
    motor.abrir(new Uint8Array(readFileSync(resolve(CARPETA, fichero))).buffer as ArrayBuffer, { signal: new AbortController().signal });

  it('etiqueta propuesta desde el título de la planta', async () => {
    const basico = await abrir('PROYECTO BASICO.pdf');
    expect(etiquetaPropuesta(await basico.textos(9))).toBe('CUB');
    expect(etiquetaPropuesta(await basico.textos(10))).toBe('PS');
    expect(etiquetaPropuesta(await basico.textos(11))).toBe('PB');
    expect(etiquetaPropuesta(await basico.textos(13))).toBeNull(); // alzados
    basico.cerrar();
    const inst = await abrir('202_PL_INSTALACIONES.pdf'); // páginas giradas 270°
    expect(etiquetaPropuesta(await inst.textos(24))).toBe('PB');
    inst.cerrar();
  });

  it('comentario propuesto: el nombre de la estancia dentro del polígono, sin su superficie', async () => {
    const basico = await abrir('PROYECTO BASICO.pdf');
    const textos = await basico.textos(11);
    const dorm = textos.find((t) => t.texto === 'DORMITORIO 2')!;
    const [cx, cy] = [(dorm.caja[0] + dorm.caja[2]) / 2, (dorm.caja[1] + dorm.caja[3]) / 2];
    const estancia: Punto[] = [
      [cx - 25, cy - 20],
      [cx + 25, cy - 20],
      [cx + 25, cy + 20],
      [cx - 25, cy + 20],
    ];
    expect(comentarioPropuesto(textos, estancia)).toBe('Dormitorio 2');
    basico.cerrar();
  });

  it('estos planos llevan el cajetín dibujado, sin texto: no se lee ninguna escala (y no pasa nada)', async () => {
    const basico = await abrir('PROYECTO BASICO.pdf');
    for (const n of [9, 10, 11]) expect(escalaDeclarada(await basico.textos(n))).toEqual({ tipo: 'ninguna' });
    basico.cerrar();
  });
});
