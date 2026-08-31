import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefSource } from '../../core/refdata';

// Base sintética GRANDE para ejercitar el tope de render (PLAN_REFERENCIA_LAZY §3):
// un capítulo con 450 partidas directas (> 2 × REF_BROWSE_CAP). Las bases demo son
// pequeñas a propósito; esta se inyecta como fuente estática solo en este spec.
vi.mock('../../core/refdata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/refdata')>();
  const partidas = Array.from({ length: 450 }, (_, i) => ({
    id: `bigp${i + 1}`,
    pos: `G.${i + 1}`,
    code: `BIG${String(i + 1).padStart(3, '0')}`,
    title: `Partida sintética ${i + 1}`,
    ud: 'u',
    precio: 1,
    items: [],
  }));
  const BIG = {
    id: 'base-big',
    kind: 'base',
    name: 'Base sintética grande',
    org: 'Test',
    chapters: [{ id: 'G', code: 'G', title: 'Gigante' }],
    partidas: { G: partidas },
  };
  return { ...actual, REF_SOURCES: [BIG] };
});

import { useObraStore } from '../../store';
import { ReferenciaPanel } from './ReferenciaPanel';
import { lruPut } from './obraSource';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

const rows = () => screen.queryAllByLabelText(/^Seleccionar BIG/).length;

describe('tope de render por contenedor (REF_BROWSE_CAP)', () => {
  // Un solo render (montar 450 filas en jsdom es caro): pinta topado, sube el
  // tope en tramos y agota el contenedor. Timeout holgado: bajo la suite entera
  // en paralelo este spec ha llegado a ~7,5 s (en aislamiento, <2 s).
  it('pinta 200 filas + «Mostrar más», que sube el tope en tramos hasta agotar', { timeout: 20_000 }, () => {
    render(<ReferenciaPanel onImport={() => {}} />);
    // 450 > REF_AUTOOPEN_MAX → arranca colapsado; se abre a mano.
    fireEvent.click(screen.getByLabelText('Desplegar Gigante'));
    expect(rows()).toBe(200);
    expect(screen.getByRole('button', { name: /250 ocultas/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar 200 más/ }));
    expect(rows()).toBe(400);
    fireEvent.click(screen.getByRole('button', { name: /Mostrar 50 más/ }));
    expect(rows()).toBe(450);
    expect(screen.queryByRole('button', { name: /Mostrar/ })).toBeNull();
  });

  it('copiar el contenedor entero copia las 450, no solo las pintadas', () => {
    render(<ReferenciaPanel onImport={() => {}} />);
    const n0 = useObraStore.getState().partidas['01']!.length;
    fireEvent.click(screen.getByLabelText('Copiar G entero'));
    expect(useObraStore.getState().partidas['01']!).toHaveLength(n0 + 450);
  });
});

describe('lruPut (tope LRU del caché de fuentes-obra, REF_CACHE_MAX=2)', () => {
  const src = (id: string): RefSource =>
    ({ id, kind: 'base', name: id, org: '', chapters: [], partidas: {} }) as RefSource;

  it('insertar una 3ª fuente desaloja la más antigua', () => {
    let c: Record<string, RefSource> = {};
    c = lruPut(c, 'a', src('a'));
    c = lruPut(c, 'b', src('b'));
    expect(Object.keys(c)).toEqual(['a', 'b']);
    c = lruPut(c, 'c', src('c'));
    expect(Object.keys(c)).toEqual(['b', 'c']);
  });

  it('re-visitar refresca la recencia: A→B→A y una 3ª desaloja B, no A', () => {
    let c: Record<string, RefSource> = {};
    c = lruPut(c, 'a', src('a'));
    c = lruPut(c, 'b', src('b'));
    c = lruPut(c, 'a', c.a!); // volver a A (el efecto del panel hace esto)
    expect(Object.keys(c)).toEqual(['b', 'a']);
    c = lruPut(c, 'c', src('c'));
    expect(Object.keys(c)).toEqual(['a', 'c']);
  });
});
