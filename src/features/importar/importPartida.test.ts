import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rec010File } from '../../core/__fixtures__/rec010Bc3';
import { useObraStore, useToastStore } from '../../store';
import {
  importPartidaFromFile,
  importPartidasFromFiles,
  isBc3File,
  processBudgetDrop,
} from './importPartida';

const obra = () => useObraStore.getState();
const lastToast = () => useToastStore.getState().msg;

const sampleFile = rec010File;

beforeEach(() => {
  obra().reset();
  useToastStore.setState({ msg: '', action: null, tick: 0 });
});

describe('isBc3File', () => {
  it('reconoce .bc3 (mayúsculas incluidas) y rechaza el resto', () => {
    expect(isBc3File(new File([], 'x.bc3'))).toBe(true);
    expect(isBc3File(new File([], 'X.BC3'))).toBe(true);
    expect(isBc3File(new File([], 'x.pdf'))).toBe(false);
    expect(isBc3File(undefined)).toBe(false);
  });
});

describe('processBudgetDrop', () => {
  it('un drop de ENLACE (sin fichero) avisa de que no funciona en web', () => {
    processBudgetDrop([], ['text/uri-list', 'text/plain']);
    expect(lastToast()).toMatch(/enlace/i);
  });

  it('un fichero que no es .bc3 avisa', () => {
    processBudgetDrop([new File([], 'foto.png')], ['Files']);
    expect(lastToast()).toMatch(/\.bc3/i);
  });
});

describe('importPartidaFromFile (ruta inline en jsdom)', () => {
  it('inserta la partida REC010 en el capítulo activo (sin refDrag)', async () => {
    const before = obra().partidas['01']!.length;
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    // Sin colisión con el banco demo → inserción directa; si hubiera, se resolvería aparte.
    if (obra().pendingCopy) {
      const res: Record<string, 'merge'> = {};
      for (const c of obra().pendingCopy!.collisions) res[c.code] = 'merge';
      obra().resolveCopyRefPartidas(res);
    }
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010');
    expect(obra().partidas['01']!.length).toBeGreaterThan(before);
    expect(p).toBeDefined();
    expect(p!.precio).toBeCloseTo(902.5, 1);
    expect(p!.ciPct).toBe(3);
    expect(lastToast()).toMatch(/REC010|colisiones/);
  });

  it('sin colisión, salta a la partida recién importada (reveal + pulso)', async () => {
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    if (obra().pendingCopy) return; // con colisión la inserción la confirma el modal
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010')!;
    expect(obra().openPartidaId).toBe(p.id);
    expect(obra().revealNonce).toBeGreaterThan(0);
    expect(obra().view).toBe('presupuesto');
  });

  it('en Presupuesto entra como partida normal (BASE, no contradictorio)', async () => {
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    if (obra().pendingCopy) {
      const res: Record<string, 'merge'> = {};
      for (const c of obra().pendingCopy!.collisions) res[c.code] = 'merge';
      obra().resolveCopyRefPartidas(res);
    }
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010')!;
    expect(p.fromBase).toBe(true);
    expect(p.contradictorio).toBeUndefined();
  });

  it('en Certificaciones entra como precio contradictorio (P.C., sin chip BASE)', async () => {
    obra().setView('certificaciones'); // la vista manda: el .bc3 importa como contradictorio
    await importPartidaFromFile(sampleFile(), { chId: '01', subId: null });
    if (obra().pendingCopy) {
      const res: Record<string, 'merge'> = {};
      for (const c of obra().pendingCopy!.collisions) res[c.code] = 'merge';
      obra().resolveCopyRefPartidas(res);
    }
    const p = obra().partidas['01']!.find((x) => x.code === 'REC010')!;
    expect(p.contradictorio).toBe(true);
    expect(p.fromBase).toBeFalsy();
  });
});

/* ---- varios .bc3 de una vez (CYPE baja una partida por archivo) ------------ */

/** Un .bc3 mínimo con UNA partida cuyo descompuesto usa `mo001` (código del banco
 *  demo): con `precio` 17.52 fusiona sin colisión; con otro precio, colisiona. */
function cypeLikeFile(code: string, precioMo = 17.52): File {
  const recs = [
    '~V|prog|FIEBDC-3/2016|prog|||ANSI||2|||',
    '~C|R##||Obra|100|010101|0|',
    '~C|C1#||Cap|100|010101|0|',
    String.raw`~D|R##|C1\1\1|`,
    `~C|${code}|m2|Partida ${code}|10|010101|0|`,
    String.raw`~D|C1#|` + code + String.raw`\1\1|`,
    String.raw`~D|` + code + String.raw`|mo001\1\0.5|`,
    `~C|mo001|h|Peon ordinario construccion|${precioMo}|010101|1|`,
  ];
  return new File([new TextEncoder().encode(recs.join('\r\n') + '\r\n')], `${code}.bc3`);
}

const codesIn = (chId: string) => obra().partidas[chId]!.map((p) => p.code);

describe('importPartidasFromFiles (varios .bc3 en un gesto)', () => {
  const target = { chId: '01', subId: null };

  it('importa los 3 archivos en UNA sola operación', async () => {
    const n0 = obra().partidas['01']!.length;
    await importPartidasFromFiles(
      [cypeLikeFile('AAA010'), cypeLikeFile('BBB020'), cypeLikeFile('CCC030')],
      target,
    );
    expect(obra().pendingCopy).toBeNull(); // mismo precio → sin colisión
    expect(obra().partidas['01']!).toHaveLength(n0 + 3);
    expect(codesIn('01')).toEqual(expect.arrayContaining(['AAA010', 'BBB020', 'CCC030']));
    expect(lastToast()).toMatch(/3 partidas importadas de 3 archivos/);
  });

  it('un recurso que choca abre UN solo modal con el lote entero (no uno por archivo)', async () => {
    await importPartidasFromFiles(
      [cypeLikeFile('AAA010', 25), cypeLikeFile('BBB020', 25), cypeLikeFile('CCC030', 25)],
      target,
    );
    const pc = obra().pendingCopy;
    expect(pc).not.toBeNull();
    expect(pc!.items).toHaveLength(3); // las 3 partidas viajan juntas
    expect(pc!.collisions.map((c) => c.code)).toEqual(['mo001']); // deduplicado
    expect(lastToast()).toMatch(/colisiones/);
  });

  it('un archivo roto no aborta el lote: entran los buenos y el aviso lo nombra', async () => {
    const n0 = obra().partidas['01']!.length;
    const roto = new File([new Uint8Array([0, 1, 2, 3])], 'roto.bc3');
    await importPartidasFromFiles([cypeLikeFile('AAA010'), roto, cypeLikeFile('BBB020')], target);
    expect(obra().partidas['01']!).toHaveLength(n0 + 2);
    expect(codesIn('01')).toEqual(expect.arrayContaining(['AAA010', 'BBB020']));
    expect(lastToast()).toMatch(/roto\.bc3/);
  });

  it('ignora lo que no es .bc3 e importa el resto', async () => {
    const n0 = obra().partidas['01']!.length;
    await importPartidasFromFiles(
      [new File([], 'foto.png'), cypeLikeFile('AAA010'), new File([], 'notas.pdf')],
      target,
    );
    expect(obra().partidas['01']!).toHaveLength(n0 + 1);
    // Un solo .bc3 → conserva el mensaje de siempre (no el de lote).
    expect(lastToast()).toMatch(/Partida importada: AAA010/);
  });

  it('si NINGÚN archivo aporta partidas, lo dice y no toca el presupuesto', async () => {
    const n0 = obra().partidas['01']!.length;
    const roto = () => new File([new Uint8Array([0, 1, 2, 3])], 'x.bc3');
    await importPartidasFromFiles([roto(), roto()], target);
    expect(obra().partidas['01']!).toHaveLength(n0);
    expect(lastToast()).toMatch(/Ninguno de los 2 archivos/);
  });

  it('un drop con varios .bc3 los importa todos', async () => {
    const n0 = obra().partidas['01']!.length;
    processBudgetDrop([cypeLikeFile('AAA010'), cypeLikeFile('BBB020')], ['Files'], target);
    await vi.waitFor(() => expect(obra().partidas['01']!).toHaveLength(n0 + 2));
  });
});
