/* Líneas de medición: seleccionar, reordenar, copiar, pegar, duplicar y borrar
   (plan «reordenar, copiar y duplicar líneas de medición», Etapa A).
   ---------------------------------------------------------------------------
   Se monta la vista real del presupuesto con los tres manejadores globales de
   teclado de App (líneas, partidas y atajos generales) y el aviso. p111 y p112
   (capítulo 01) traen dos líneas cada una en el seed y se miden por volumen. */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppHotkeys } from '../../hooks/useAppHotkeys';
import { useMedClipboard } from '../../hooks/useMedClipboard';
import { useClipboardHotkeys } from '../../hooks/usePartidaClipboard';
import { ClipboardToast } from '../../layout/ClipboardToast';
import { Toast } from '../../layout/Toast';
import { useClipboardStore, useObraStore, useToastStore } from '../../store';
import { useMedUiStore } from '../../store/medUiStore';
import { __resetHistoryForTests, initHistory } from '../../store/temporal';
import { CertDetail } from '../certificaciones/CertTable';
import { PresupuestoView } from './PresupuestoView';

const st = () => useObraStore.getState();
const P = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)!;
const ids = (id: string) => P(id).med.map((l) => l.id);

function Harness({ compact = false }: { compact?: boolean }) {
  useClipboardHotkeys();
  useMedClipboard();
  useAppHotkeys({ onHelp: () => {} });
  return (
    <>
      <PresupuestoView compact={compact} />
      <ClipboardToast />
      <Toast />
    </>
  );
}

const open = (id: string) => act(() => st().togglePartida(id));
/** Fila (tabla) o tarjeta de una línea. */
const lineEl = (lineId: string) => document.querySelector<HTMLElement>(`[data-lineid="${lineId}"]`)!;
const check = (lineId: string) => within(lineEl(lineId)).getByRole('checkbox');
const comment = (lineId: string) => within(lineEl(lineId)).getByLabelText('Comentario de la línea');
const bar = () => screen.queryByRole('toolbar', { name: 'Líneas seleccionadas' });
const ctrl = (el: Element | Document, key: string) => fireEvent.keyDown(el, { key, ctrlKey: true });

function stubTouch(touch: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('pointer: coarse') ? touch : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  __resetHistoryForTests();
  st().reset();
  useClipboardStore.getState().clear();
  useMedUiStore.getState().reset();
  useToastStore.getState().clear();
  initHistory(useObraStore); // el «Deshacer» de los avisos usa el historial real
});
afterEach(() => {
  __resetHistoryForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('selección de líneas', () => {
  it('la casilla alterna la línea; Shift+click amplía el rango; ✕ quita la selección', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(check(a!));
    expect(lineEl(a!)).toHaveAttribute('aria-selected', 'true');
    expect(within(bar()!).getByText('1 línea')).toBeInTheDocument();
    expect(within(bar()!).getByText(/^Σ /)).toBeInTheDocument();

    fireEvent.click(check(a!)); // alterna
    expect(bar()).toBeNull();

    fireEvent.click(check(b!));
    fireEvent.click(check(a!), { shiftKey: true });
    expect(useMedUiStore.getState().selected.sort()).toEqual([a, b].sort());
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Quitar la selección' }));
    expect(bar()).toBeNull();
  });

  it('Subir queda deshabilitado con la primera línea seleccionada, Bajar con la última', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    expect(within(bar()!).getByRole('button', { name: 'Subir' })).toBeDisabled();
    expect(within(bar()!).getByRole('button', { name: 'Bajar' })).toBeEnabled();
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Bajar' }));
    expect(ids('p111')[1]).toBe(a);
    expect(within(bar()!).getByRole('button', { name: 'Bajar' })).toBeDisabled();
    expect(bar()).not.toBeNull(); // la barra sigue abierta para repetir
  });

  it('cruzar el punto de corte tabla ↔ tarjetas conserva la selección y la pestaña', () => {
    const { rerender } = render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    rerender(<Harness compact />);
    expect(check(a!)).toHaveAttribute('aria-checked', 'true');
    expect(bar()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Descripción/ }));
    rerender(<Harness />);
    expect(screen.getByLabelText('Descripción de la partida')).toBeInTheDocument();
  });

  it('en táctil la casilla y la X se ven siempre y no hay asa de arrastre', () => {
    stubTouch(true);
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    const grid = lineEl(a!).closest('[data-medgrid]')!.parentElement!;
    expect(grid.className).toMatch(/medTouch/);
    expect(within(lineEl(a!)).queryByTitle(/Arrastra para cambiar el orden/)).toBeNull();
  });

  it('con ratón hay asa de arrastre, con su atajo en el tooltip', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    expect(within(lineEl(a!)).getByTitle('Arrastra para cambiar el orden · Alt+↑/↓')).toBeInTheDocument();
  });
});

describe('copiar y pegar con botones', () => {
  it('copiar en una partida y «Pegar» en otra: líneas nuevas seleccionadas, aviso y Deshacer', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Copiar' }));
    expect(useClipboardStore.getState().medLines?.lines).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('1 línea copiada · E02EM030');

    open('p112');
    const paste = screen.getByRole('button', { name: /^Pegar línea/ });
    fireEvent.pointerDown(paste);
    fireEvent.click(paste);
    expect(P('p112').med).toHaveLength(3);
    const nueva = ids('p112')[2]!;
    expect(lineEl(nueva)).toHaveAttribute('aria-selected', 'true');
    expect(comment(nueva)).toHaveFocus();
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(/1 línea pegada en E02SZ070 · .+ → .+ m³/);

    fireEvent.click(within(toast).getByRole('button', { name: 'Deshacer' }));
    expect(P('p112').med).toHaveLength(2);
    // Tras deshacer, el foco no se pierde en el body: primera fila.
    expect(comment(ids('p112')[0]!)).toHaveFocus();
  });

  it('en móvil la barra lleva Copiar y el resto en «Más»', () => {
    render(<Harness compact />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(check(a!));
    const tb = bar()!;
    expect(within(tb).getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(within(tb).queryByRole('button', { name: 'Duplicar' })).toBeNull();
    fireEvent.click(within(tb).getByRole('button', { name: 'Más acciones de las líneas' }));
    const menu = within(tb).getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Subir' })).toBeDisabled();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Bajar' }));
    expect(ids('p111')).toEqual([b, a]);
    expect(within(tb).queryByRole('menu')).toBeNull();
  });

  it('el botón dice tras qué línea pegará cuando hay destino', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(check(b!));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Copiar' }));
    fireEvent.click(check(b!)); // quita la selección
    fireEvent.click(check(a!));
    const btn = screen.getByRole('button', { name: /^Pegar línea/ });
    expect(btn).toHaveTextContent('tras «Zanjas de saneamiento»');
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    expect(P('p111').med.map((l) => l.comment)).toEqual([
      'Zanjas de saneamiento',
      'Zanjas de instalaciones',
      'Zanjas de instalaciones',
    ]);
  });

  it('sin líneas y con cantidad fija, el pie dice «Cantidad fija»', () => {
    act(() => {
      st().deleteMedLines('01', 'p112', ids('p112'));
      st().setCantidad('01', 'p112', 7);
    });
    render(<Harness />);
    open('p112');
    const qty = screen.getByText('Cantidad fija').parentElement!;
    expect(qty).toHaveTextContent('Cantidad fija7,00m³');
  });
});

describe('teclado: copiar, pegar, duplicar', () => {
  it('Ctrl+C en una celda en reposo copia la LÍNEA, no la partida', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'c');
    expect(useClipboardStore.getState().items).toBeNull();
    expect(useClipboardStore.getState().medLines?.lines.map((l) => l.id)).toEqual([a]);
  });

  it('Ctrl+V (evento paste) pega detrás de la línea con el foco', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    act(() => comment(b!).focus());
    ctrl(comment(b!), 'c');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'v');
    fireEvent.paste(comment(a!));
    expect(P('p111').med.map((l) => l.comment)).toEqual([
      'Zanjas de saneamiento',
      'Zanjas de instalaciones',
      'Zanjas de instalaciones',
    ]);
    expect(ids('p111')[1]).not.toBe(b); // id nuevo
  });

  it('Ctrl+V con el foco fuera de la tabla pega al final de la partida abierta y cambia a Medición', () => {
    render(<Harness />);
    open('p111');
    act(() => {
      useClipboardStore.getState().setMedClip({
        lines: [{ id: 'x', comment: 'Copiada', uds: 1, largo: 2, ancho: 3, alto: 4 }],
        source: { chapterId: '01', partidaId: 'p112', code: 'E02SZ070', title: '', forma: 'vol', ud: 'm³', obraName: 'Obra' },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /^Descripción/ }));
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.paste(document.body);
    expect(P('p111').med.at(-1)!.comment).toBe('Copiada');
    expect(screen.getByText('Copiada')).toBeInTheDocument(); // pestaña Medición
  });

  it('Ctrl+V con partidas en el portapapeles, fuera de la tabla, sigue pegando PARTIDAS', () => {
    render(<Harness />);
    const n = st().partidas['01']!.length;
    ctrl(document.body, 'v'); // vacío: nada
    act(() => st().togglePartida('p111'));
    ctrl(document.body, 'c'); // copia la partida (sin contexto de medición)
    expect(useClipboardStore.getState().items).toHaveLength(1);
    ctrl(document.body, 'v');
    expect(st().partidas['01']!.length).toBe(n + 1);
  });

  it('sin evento paste en 500 ms, pista hacia el botón (y ningún cambio)', () => {
    vi.useFakeTimers();
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'c');
    ctrl(comment(a!), 'v');
    act(() => vi.advanceTimersByTime(499));
    expect(screen.getByRole('status')).not.toHaveTextContent(/Pulsa/);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status')).toHaveTextContent('Pulsa «Pegar línea» para pegar lo copiado en Concreta');
    expect(P('p111').med).toHaveLength(2);
  });

  it('un paste que llega tarde pega UNA vez y no deja pista', () => {
    vi.useFakeTimers();
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'c');
    ctrl(comment(a!), 'v');
    act(() => vi.advanceTimersByTime(300));
    fireEvent.paste(comment(a!));
    act(() => vi.advanceTimersByTime(1000));
    expect(P('p111').med).toHaveLength(3);
    expect(screen.queryByText(/Pulsa/)).toBeNull();
  });

  it('Ctrl+D duplica la línea con el foco, justo debajo', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'd');
    expect(ids('p111')[0]).toBe(a);
    expect(ids('p111')[2]).toBe(b);
    expect(P('p111').med[1]!.comment).toBe('Zanjas de saneamiento');
  });

  it('copiar y enseguida pegar deja UN solo aviso a la vista', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'c');
    fireEvent.paste(comment(a!));
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

describe('teclado: reordenar y seleccionar', () => {
  it('Alt+↓ baja la línea, el foco la sigue y se anuncia', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    act(() => comment(a!).focus());
    fireEvent.keyDown(comment(a!), { key: 'ArrowDown', altKey: true });
    expect(ids('p111')).toEqual([b, a]);
    expect(comment(a!)).toHaveFocus();
    expect(screen.getByText(/Línea movida a la posición 2 de 2/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull(); // reordenar no muestra aviso
  });

  it('Shift+Espacio selecciona sin abrir el editor (comentario y celda numérica)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    act(() => comment(a!).focus());
    await user.keyboard('{Shift>} {/Shift}');
    expect(useMedUiStore.getState().selected).toEqual([a]);
    expect(comment(a!).tagName).toBe('SPAN'); // no se abrió el editor

    const uds = within(lineEl(b!)).getByLabelText('Unidades');
    act(() => uds.focus());
    await user.keyboard('{Shift>} {/Shift}');
    expect(useMedUiStore.getState().selected.sort()).toEqual([a, b].sort());
    expect(within(lineEl(b!)).getByLabelText('Unidades').tagName).toBe('BUTTON');
  });

  it('Shift+↓ amplía la selección y mueve el foco UNA fila', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    act(() => comment(a!).focus());
    fireEvent.keyDown(comment(a!), { key: 'ArrowDown', shiftKey: true });
    expect(useMedUiStore.getState().selected).toEqual([a, b]);
    expect(comment(b!)).toHaveFocus(); // no salta a la partida siguiente
  });

  it('las flechas sin modificador siguen navegando entre celdas', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    act(() => comment(a!).focus());
    fireEvent.keyDown(comment(a!), { key: 'ArrowDown' });
    expect(comment(b!)).toHaveFocus();
    fireEvent.keyDown(comment(b!), { key: 'ArrowRight' });
    expect(within(lineEl(b!)).getByLabelText('Unidades')).toHaveFocus();
  });

  it('Esc: primero vacía la selección y después cierra la partida', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useMedUiStore.getState().selected).toEqual([]);
    expect(st().openPartidaId).toBe('p111');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(st().openPartidaId).toBeNull();
  });
});

describe('arrastrar una línea', () => {
  /** Arrastre con coordenadas: jsdom no trae DragEvent (ver PartidaReorder.test). */
  function drag(el: Element, type: string, clientY = 0) {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
    Object.defineProperty(ev, 'dataTransfer', {
      value: { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' },
    });
    fireEvent(el, ev);
  }

  it('soltar en la mitad de arriba de otra línea la coloca delante (ids intactos)', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    drag(lineEl(b!), 'dragstart');
    drag(lineEl(a!), 'dragover', -5);
    drag(lineEl(a!), 'drop', -5);
    expect(ids('p111')).toEqual([b, a]);
  });

  it('empezar a arrastrar quita la selección (se mueve UNA línea)', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(check(a!));
    drag(lineEl(b!), 'dragstart');
    expect(useMedUiStore.getState().selected).toEqual([]);
  });
});

describe('borrar líneas', () => {
  it('la X de una línea SIN certificar borra sin diálogo y el foco pasa a la siguiente', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(within(lineEl(a!)).getByRole('button', { name: /^Eliminar línea/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ids('p111')).toEqual([b]);
    expect(within(lineEl(b!)).getByRole('button', { name: /^Eliminar línea/ })).toHaveFocus();
  });

  it('una línea CERTIFICADA pide confirmación; Cancelar no cambia nada', () => {
    act(() => st().setCertLine('p111', ids('p111')[0]!, 3));
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(within(lineEl(a!)).getByRole('button', { name: /^Eliminar línea/ }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveTextContent(/Esta línea está certificada en la certificación nº \d/);
    expect(dlg).toHaveTextContent('se pierden su comentario y sus dimensiones');
    expect(within(dlg).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    expect(ids('p111')).toHaveLength(2);
  });

  it('confirmar la borra y la certificación la sigue enseñando como «línea eliminada»', () => {
    const lineId = ids('p111')[0]!;
    act(() => st().setCertLine('p111', lineId, 3));
    render(<Harness />);
    open('p111');
    fireEvent.click(within(lineEl(lineId)).getByRole('button', { name: /^Eliminar línea/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar la línea' }));
    expect(ids('p111')).not.toContain(lineId);
    // Al cerrar el diálogo manda la regla de foco de borrar, no el foco que
    // el Modal devuelve a donde estaba (la X ya desaparecida).
    const next = ids('p111')[0]!;
    expect(within(lineEl(next)).getByRole('button', { name: /^Eliminar línea/ })).toHaveFocus();

    document.body.innerHTML = '';
    render(<CertDetail p={P('p111')} />);
    expect(screen.getByText('Línea eliminada de la medición (certificada en su día)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Desmarcar línea eliminada de la medición' })).toBeInTheDocument();
  });

  it('Eliminar de la barra borra el bloque y ofrece Deshacer', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(check(b!));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Eliminar' }));
    expect(P('p111').med).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('2 líneas eliminadas');
    expect(screen.getByRole('button', { name: /^Añadir línea/ })).toHaveFocus();
  });
});

describe('pegar entre formas de medir incompatibles', () => {
  it('Peso → Volumen abre el diálogo con lo que cambia; Cancelar no pega', () => {
    act(() => st().setMedForma('01', 'p111', 'peso'));
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Copiar' }));
    open('p112');
    fireEvent.click(screen.getByRole('button', { name: /^Pegar línea/ }));
    const dlg = screen.getByRole('dialog', { name: 'Esta partida se mide de otra forma' });
    expect(dlg).toHaveTextContent('kg/m → Anchura');
    expect(dlg).toHaveTextContent('Se reinterpretan las cifras; no se convierten unidades.');
    expect(dlg).toHaveTextContent(/Importe/);
    expect(within(dlg).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancelar' }));
    expect(P('p112').med).toHaveLength(2);
  });

  it('«Pegar tal cual» pega', () => {
    act(() => st().setMedForma('01', 'p111', 'peso'));
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Copiar' }));
    open('p112');
    fireEvent.click(screen.getByRole('button', { name: /^Pegar línea/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pegar tal cual' }));
    expect(P('p112').med).toHaveLength(3);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('misma forma y misma unidad: pega sin diálogo', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Copiar' }));
    open('p112');
    fireEvent.click(screen.getByRole('button', { name: /^Pegar línea/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(P('p112').med).toHaveLength(3);
  });
});
