/* Coordinador de «Adjuntar plano» (§1.5, §7): bytes antes que metadato,
   duplicados, revivir un quitado, errores y cambio de obra a mitad. */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planoLegible } from '../../core/planoDatos';
import { sha256Hex } from '../../core/sha256';
import type { Escala, PlanoMeta } from '../../core/types';
import { CANDADO_PLANOS, __resetPlanosForTests, leerBytes, tienePlano } from '../../persist/planos';
import { __setLockManagerForTests, conCandado } from '../../persist/tabLock';
import { FakeLockManager } from '../../test/fakeLocks';
import { blankObraData, useObraStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { pdfMinimo } from '../../test/pdfMinimo';
import { MB, adjuntarPlano, adjuntarRevision, nombreDeArchivo, usarPdfParaPlano, type FaseAdjuntar } from './adjuntar';
import { __setMotorPdfForTests } from './motor';
import { crearAdapterFake } from './pdfAdapter.fake';
import { ErrorPdf, type PdfAdapter } from './pdfTipos';

const st = () => useObraStore.getState();
const planos = () => st().planos.filter((p): p is PlanoMeta => planoLegible(p));
const pdf = (n = 1) => pdfMinimo(Array.from({ length: n }, () => ({ mediaBox: [0, 0, 842, 595] as [number, number, number, number] })));
const archivo = (bytes: Uint8Array, nombre = 'Planta primera.pdf') => new File([bytes], nombre, { type: 'application/pdf' });
/** Una página como `pdf(1)` pero con otros bytes (otra huella). */
const conTexto = (texto: string, mediaBox: [number, number, number, number] = [0, 0, 842, 595]) =>
  pdfMinimo([{ mediaBox, textos: [{ x: 50, y: 50, tamano: 10, texto }] }]);

beforeEach(async () => {
  await __resetPlanosForTests();
  usePlanoUiStore.getState().reset();
  st().loadObra(blankObraData('Obra'));
  __setMotorPdfForTests(crearAdapterFake());
});
afterEach(() => {
  __setMotorPdfForTests(null);
  vi.restoreAllMocks();
});

describe('adjuntar un plano', () => {
  it('lee, calcula la huella, abre, guarda los bytes y SOLO después publica el metadato', async () => {
    const fases: FaseAdjuntar[] = [];
    const bytes = pdf(3);
    const r = await adjuntarPlano(archivo(bytes), { onFase: (f) => fases.push(f) });
    expect(r).toMatchObject({ kind: 'ok', revivido: false });
    expect(fases).toEqual(['leyendo', 'huella', 'abriendo', 'guardando']);
    const p = planos()[0]!;
    expect(p).toMatchObject({ nombre: 'Planta primera', archivo: 'Planta primera.pdf', paginas: 3, tipo: 'pdf', escalas: {} });
    expect(p.huella).toBe(sha256Hex(bytes));
    expect(await tienePlano(p.huella)).toBe(true);
    expect(new Uint8Array((await leerBytes(p.huella))!)).toEqual(bytes);
    expect(usePlanoUiStore.getState()).toMatchObject({ planoId: p.id, pagina: 1 });
  });

  it('la misma huella ya en la obra: «Ya está adjunto»; «Adjuntar otra vez» crea otro plano con los mismos bytes', async () => {
    const bytes = pdf();
    await adjuntarPlano(archivo(bytes));
    const r = await adjuntarPlano(archivo(bytes, 'copia.pdf'));
    expect(r).toMatchObject({ kind: 'duplicado', nombre: 'Planta primera' });
    expect(planos()).toHaveLength(1);
    const otra = await adjuntarPlano(archivo(bytes, 'copia.pdf'), { nuevo: true });
    expect(otra.kind).toBe('ok');
    expect(planos().map((p) => p.huella)).toEqual([planos()[0]!.huella, planos()[0]!.huella]);
  });

  it('volver a adjuntar el PDF de un plano quitado lo revive con sus escalas', async () => {
    const bytes = pdf();
    await adjuntarPlano(archivo(bytes));
    const id = planos()[0]!.id;
    st().removePlano({ planoId: id, expect: { docToken: st().docToken } });
    const r = await adjuntarPlano(archivo(bytes));
    expect(r).toEqual({ kind: 'ok', planoId: id, revivido: true });
    expect(planos()[0]!.quitado).toBeUndefined();
  });

  it('los bytes de un plano «no disponible»: vuelve solo, sin tocar la obra', async () => {
    const bytes = pdf();
    await adjuntarPlano(archivo(bytes));
    const antes = JSON.stringify(st().planos);
    await __resetPlanosForTests(); // el PDF se perdió en este navegador
    const r = await adjuntarPlano(archivo(bytes));
    expect(r.kind).toBe('reenlazado');
    expect(JSON.stringify(st().planos)).toBe(antes);
    expect(await tienePlano(planos()[0]!.huella)).toBe(true);
  });

  it('reenlazar un plano concreto con otro PDF: «no idéntico», y [A1] si encaja en sus páginas', async () => {
    await adjuntarPlano(archivo(pdf(1)));
    const r = await adjuntarPlano(archivo(pdf(2), 'otro.pdf'), { destino: planos()[0]!.id });
    expect(r).toEqual({ kind: 'no-identico', encaja: false });
    expect(planos()).toHaveLength(1); // nada publicado
    const igual = await adjuntarPlano(archivo(conTexto('otra exportación'), 'otro.pdf'), { destino: planos()[0]!.id });
    expect(igual).toEqual({ kind: 'no-identico', encaja: true });
  });

  it('errores con su texto: vacío, contraseña, dañado y > 500 MB; > 50 MB avisa y deja seguir', async () => {
    expect(await adjuntarPlano(archivo(new Uint8Array(0)))).toEqual({ kind: 'error', texto: 'El archivo está vacío.' });
    const conClave: PdfAdapter = { abrir: async () => Promise.reject(new ErrorPdf('contrasena')) };
    __setMotorPdfForTests(conClave);
    expect(await adjuntarPlano(archivo(pdf()))).toEqual({
      kind: 'error',
      texto: 'Este PDF tiene contraseña: quítala y vuelve a adjuntarlo.',
    });
    __setMotorPdfForTests(crearAdapterFake());
    const basura = await adjuntarPlano(archivo(new TextEncoder().encode('hola'), 'X.pdf'));
    expect(basura).toEqual({
      kind: 'error',
      texto: 'No se pudo leer «X.pdf» (dañado o no es un PDF). Ábrelo en otro visor y vuelve a guardarlo.',
    });
    const enorme = archivo(pdf(), 'enorme.pdf');
    Object.defineProperty(enorme, 'size', { value: 612 * MB });
    expect(await adjuntarPlano(enorme)).toEqual({
      kind: 'error',
      texto: '«enorme.pdf» pesa 612 MB: el máximo es 500 MB. Divide el plano o expórtalo con menos resolución.',
    });
    const grande = archivo(pdf(), 'grande.pdf');
    Object.defineProperty(grande, 'size', { value: 84 * MB });
    const r = await adjuntarPlano(grande);
    expect(r).toMatchObject({ kind: 'ok', aviso: '«grande.pdf» pesa 84 MB: la copia de la obra será grande.' });
    expect(planos()).toHaveLength(1); // no se publica nada con los errores
  });

  it('cambio de obra a mitad: no se publica nada, pero los bytes se quedan', async () => {
    const bytes = pdf();
    const lento: PdfAdapter = {
      async abrir(d, o) {
        st().loadObra(blankObraData('Otra')); // el usuario cambia de obra mientras se abre
        return crearAdapterFake().abrir(d, o);
      },
    };
    __setMotorPdfForTests(lento);
    expect(await adjuntarPlano(archivo(bytes))).toEqual({ kind: 'cancelado' });
    expect(planos()).toHaveLength(0);
    expect(await tienePlano(sha256Hex(bytes))).toBe(true);
  });

  it('nombre del plano: el del fichero sin «.pdf»', () => {
    expect(nombreDeArchivo('Planta primera.PDF')).toBe('Planta primera');
    expect(nombreDeArchivo('.pdf')).toBe('Plano');
  });
});

describe('[A1] revisión de un plano y «Usar este PDF para este plano» (§9.3)', () => {
  it('adjuntar revisión: plano NUEVO con `sustituye` y la revisión siguiente; el viejo no cambia', async () => {
    await adjuntarPlano(archivo(pdf(1)));
    const viejo = structuredClone(planos()[0]!);
    const fases: FaseAdjuntar[] = [];
    const r = await adjuntarRevision(archivo(conTexto('rev b'), 'planta-revB.pdf'), { sustituye: viejo.id, onFase: (f) => fases.push(f) });
    expect(r).toMatchObject({ kind: 'ok', revision: 'Rev. B' });
    expect(fases).toEqual(['leyendo', 'huella', 'abriendo', 'guardando']);
    const nuevo = planos()[1]!;
    expect(nuevo).toMatchObject({ nombre: 'Planta primera', archivo: 'planta-revB.pdf', sustituye: viejo.id, revision: 'Rev. B', escalas: {} });
    expect(planos()[0]).toEqual(viejo);
    expect(await tienePlano(nuevo.huella)).toBe(true);
    expect(usePlanoUiStore.getState().planoId).toBe(nuevo.id);
  });

  it('el mismo PDF no es una revisión', async () => {
    await adjuntarPlano(archivo(pdf(1)));
    const r = await adjuntarRevision(archivo(pdf(1)), { sustituye: planos()[0]!.id });
    expect(r).toEqual({ kind: 'error', texto: 'Es el mismo PDF que «Planta primera»: una revisión es otro PDF.' });
    expect(planos()).toHaveLength(1);
  });

  it('usar otro PDF para el plano: misma escala sin comprobación, la huella anterior al historial', async () => {
    await adjuntarPlano(archivo(pdf(1)));
    const p0 = planos()[0]!;
    const escala = {
      rev: 'cal-1',
      mPorUnidad: 0.0176,
      n: 50,
      ref: { a: [100, 100], b: [400, 100], metros: 5.28 },
      comprobacion: { fuente: 'cota', a: [100, 100], b: [100, 300], metros: 3.52, medidos: 3.52, desviacion: 0 },
      at: 'x',
    } as unknown as Escala;
    st().setPlanoPageScale({ planoId: p0.id, pagina: 1, escala, expect: { docToken: st().docToken } });
    const r = await usarPdfParaPlano(archivo(conTexto('reexportado'), 'reexportado.pdf'), { planoId: p0.id });
    expect(r).toEqual({ kind: 'ok', planoId: p0.id, lineas: 0, calibradas: 1 });
    const p = planos()[0]!;
    expect(p).toMatchObject({ huellasAnteriores: [p0.huella], archivo: 'reexportado.pdf' });
    expect(p.huella).not.toBe(p0.huella);
    expect(p.escalas[1]).toMatchObject({ rev: 'cal-1', mPorUnidad: 0.0176 });
    expect(p.escalas[1]!.comprobacion).toBeUndefined();
    expect(await tienePlano(p.huella)).toBe(true);
  });

  it('un PDF donde no cabe lo guardado no se usa (otras páginas o más pequeñas)', async () => {
    await adjuntarPlano(archivo(pdf(1)));
    const p0 = planos()[0]!;
    const escala = { rev: 'c', mPorUnidad: 0.01, n: 50, ref: { a: [700, 500], b: [800, 500], metros: 1 }, at: 'x' } as unknown as Escala;
    st().setPlanoPageScale({ planoId: p0.id, pagina: 1, escala, expect: { docToken: st().docToken } });
    expect(await usarPdfParaPlano(archivo(pdf(2), 'dos.pdf'), { planoId: p0.id })).toEqual({ kind: 'no-encaja' });
    const pequeno = conTexto('A4', [0, 0, 595, 421]);
    expect(await usarPdfParaPlano(archivo(pequeno, 'a4.pdf'), { planoId: p0.id })).toEqual({ kind: 'no-encaja' });
    expect(planos()[0]!.huella).toBe(p0.huella);
  });
});

describe('[A1] candado de los PDF (§9.4)', () => {
  afterEach(() => __setLockManagerForTests(null));

  it('con «Liberar espacio» en marcha (exclusivo), adjuntar espera para guardar y publicar', async () => {
    __setLockManagerForTests(new FakeLockManager());
    let soltar!: () => void;
    const liberando = conCandado(CANDADO_PLANOS, 'exclusive', () => new Promise<void>((r) => (soltar = r)));
    const r = adjuntarPlano(archivo(pdf(1)));
    await new Promise((res) => setTimeout(res, 30));
    expect(planos()).toHaveLength(0); // ni bytes ni metadato mientras tanto
    soltar();
    await liberando;
    expect(await r).toMatchObject({ kind: 'ok' });
    expect(planos()).toHaveLength(1);
  });
});
