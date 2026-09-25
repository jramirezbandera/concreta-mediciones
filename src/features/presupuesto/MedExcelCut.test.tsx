/* Líneas de medición, Etapa B: intercambio con hojas de cálculo (TSV en el
   portapapeles del sistema) y Cortar → Pegar = mover.
   ---------------------------------------------------------------------------
   El portapapeles del sistema es un doble (`test/sysClipboard`): Ctrl+C/X y
   Ctrl+V se simulan como el navegador —keydown y luego el evento copy/cut/
   paste con su `clipboardData`—. p111 y p112 (capítulo 01) traen dos líneas
   cada una en el seed y se miden por volumen (m³). */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppHotkeys } from '../../hooks/useAppHotkeys';
import { useMedClipboard } from '../../hooks/useMedClipboard';
import { useClipboardHotkeys } from '../../hooks/usePartidaClipboard';
import { ClipboardToast } from '../../layout/ClipboardToast';
import { StatusBar } from '../../layout/StatusBar';
import { Toast } from '../../layout/Toast';
import { useSessionStore } from '../../persist/sessionStore';
import { MEDLINES_MIME } from '../../store/clipboardStore';
import { useClipboardStore, useObraStore, useToastStore } from '../../store';
import { takeStagedCopy } from '../../store/medLineOps';
import { useMedUiStore } from '../../store/medUiStore';
import { __resetHistoryForTests, initHistory } from '../../store/temporal';
import { fakeSystemClipboard, restoreSystemClipboard, type FakeSystemClipboard } from '../../test/sysClipboard';
import { PresupuestoView } from './PresupuestoView';

const st = () => useObraStore.getState();
const P = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)!;
const ids = (id: string) => P(id).med.map((l) => l.id);
const comments = (id: string) => P(id).med.map((l) => l.comment);

function Harness({ compact = false }: { compact?: boolean }) {
  useClipboardHotkeys();
  useMedClipboard();
  useAppHotkeys({ onHelp: () => {} });
  return (
    <>
      <PresupuestoView compact={compact} />
      <StatusBar counts={{ chapters: 0, partidas: 0, lineas: 0 }} pem={0} pec={0} />
      <ClipboardToast />
      <Toast />
    </>
  );
}

const open = (id: string) => act(() => st().togglePartida(id));
const lineEl = (lineId: string) => document.querySelector<HTMLElement>(`[data-lineid="${lineId}"]`)!;
const comment = (lineId: string) => within(lineEl(lineId)).getByLabelText('Comentario de la línea');
const check = (lineId: string) => within(lineEl(lineId)).getByRole('checkbox');
const ctrl = (el: Element | Document, key: string) => fireEvent.keyDown(el, { key, ctrlKey: true });
const status = () => screen.getByRole('status');

let sys: FakeSystemClipboard;

/** Ctrl+C o Ctrl+X sobre la celda, como el navegador (keydown + evento). */
function copyKeys(el: HTMLElement, cut = false) {
  act(() => el.focus());
  ctrl(el, cut ? 'x' : 'c');
  if (cut) sys.cut(el);
  else sys.copy(el);
}
/** Ctrl+V sobre `el`, como el navegador (keydown + evento paste). */
function pasteKeys(el: HTMLElement | Document) {
  if (el instanceof HTMLElement) act(() => el.focus());
  ctrl(el, 'v');
  sys.paste(el);
}

beforeEach(() => {
  __resetHistoryForTests();
  sys = fakeSystemClipboard();
  takeStagedCopy();
  st().reset();
  useClipboardStore.getState().clear();
  useMedUiStore.getState().reset();
  useToastStore.getState().clear();
  initHistory(useObraStore);
});
afterEach(() => {
  __resetHistoryForTests();
  restoreSystemClipboard();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Concreta → hoja de cálculo', () => {
  it('Ctrl+C escribe el TSV y el tipo propio con el id en el portapapeles del sistema', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    copyKeys(comment(a!));
    const clip = useClipboardStore.getState().medLines!;
    expect(sys.data.get('text/plain')).toBe('Zanjas de saneamiento\t1\t85\t0,6\t1,2');
    expect(sys.data.get(MEDLINES_MIME)).toBe(clip.id);
    expect(clip.sysOk).toBe(true);
  });
});

describe('hoja de cálculo → Concreta', () => {
  it('un bloque «perfil ⇥ uds ⇥ longitud» en una partida por Peso rellena el kg/m', () => {
    act(() => st().setMedForma('01', 'p112', 'peso'));
    render(<Harness />);
    open('p112');
    const [a] = ids('p112');
    sys.setText('IPE300\t2\t9,50\r\nIPE240\t1\t6\r\n'); // lo que copia Excel
    pasteKeys(comment(a!));
    expect(comments('p112')).toEqual(['Pozos de zapatas aisladas', 'IPE300', 'IPE240', 'Pozo del ascensor']);
    expect(P('p112').med[1]!.ancho).toBeCloseTo(42.2, 1);
    expect(status()).toHaveTextContent('2 líneas pegadas en E02SZ070');
  });

  it('una cifra ambigua rechaza el pegado entero con fila y columna; ✕ o un pegado bueno quitan la franja', () => {
    render(<Harness />);
    open('p112');
    const [a] = ids('p112');
    sys.setText('Muro\t2\t3\nLosa\t1\t1.234\n');
    pasteKeys(comment(a!));
    expect(P('p112').med).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo pegar: fila 2, Longitud «1.234» es ambiguo. Pégalo sin separador de miles',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso de error' }));
    expect(screen.queryByRole('alert')).toBeNull();

    pasteKeys(comment(a!)); // otra vez mal
    expect(screen.getByRole('alert')).toBeInTheDocument();
    sys.setText('Losa\t1\t1,234\n');
    pasteKeys(comment(a!));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(P('p112').med).toHaveLength(3);
  });

  it('un texto suelto (sin tabuladores ni saltos) con el foco en la página no crea líneas', () => {
    render(<Harness />);
    open('p112');
    sys.setText('Hola');
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    pasteKeys(document.body);
    expect(P('p112').med).toHaveLength(2);
    // Con el foco en la medición, sí: es una línea de comentario.
    pasteKeys(comment(ids('p112')[0]!));
    expect(comments('p112')[1]).toBe('Hola');
  });

  it('pegar texto ajeno cancela un cortado pendiente', () => {
    render(<Harness />);
    open('p111');
    copyKeys(comment(ids('p111')[0]!), true);
    expect(useClipboardStore.getState().medLines?.cut).toBe(true);
    sys.setText('Otra\t1\n');
    pasteKeys(comment(ids('p111')[1]!));
    expect(useClipboardStore.getState().medLines).toBeNull();
    expect(comments('p111')).toHaveLength(3); // se pegó como texto ajeno
  });
});

describe('cuando el TSV no llega al sistema', () => {
  it.each([
    ['en http no existe writeText', 'none' as const],
    ['writeText rechazado', 'reject' as const],
  ])('%s: aviso de advertencia y Ctrl+V pega lo interno aunque el sistema tenga otro texto', async (_n, mode) => {
    sys = fakeSystemClipboard(mode);
    vi.useFakeTimers();
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    act(() => comment(a!).focus());
    ctrl(comment(a!), 'c'); // este navegador no dispara el evento copy
    await act(async () => {
      vi.advanceTimersByTime(1); // respaldo writeText
      await Promise.resolve();
    });
    expect(useClipboardStore.getState().medLines?.sysOk).toBe(false);
    expect(status()).toHaveTextContent('Copiado en Concreta; no disponible para Excel');

    sys.setText('Algo de otra aplicación');
    open('p112');
    pasteKeys(comment(ids('p112')[0]!));
    expect(comments('p112')[1]).toBe('Zanjas de saneamiento');
  });
});

describe('Cortar → Pegar = mover', () => {
  it('Ctrl+X marca la línea; Ctrl+V en otra partida la MUEVE y un Deshacer restaura las dos', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    copyKeys(comment(a!), true);
    expect(lineEl(a!)).toHaveTextContent('cortada');
    expect(lineEl(a!).className).toMatch(/lineCut/);
    expect(screen.getByRole('button', { name: 'Cancelar el corte' })).toBeInTheDocument(); // chip
    expect(sys.data.get(MEDLINES_MIME)).toBe(useClipboardStore.getState().medLines!.id);

    open('p112');
    expect(screen.getByRole('button', { name: /^Mover línea aquí/ })).toBeInTheDocument();
    const destino = ids('p112');
    pasteKeys(comment(destino[1]!));
    expect(ids('p111')).toEqual([b]);
    expect(comments('p112')).toEqual(['Pozos de zapatas aisladas', 'Pozo del ascensor', 'Zanjas de saneamiento']);
    expect(ids('p112')[2]).not.toBe(a); // id nuevo en otra partida
    expect(useClipboardStore.getState().medLines).toBeNull(); // consumido
    expect(status()).toHaveTextContent(/^1 línea movida · E02EM030 .+ → .+ m³ · E02SZ070 .+ → .+ m³/);

    fireEvent.click(within(status()).getByRole('button', { name: 'Deshacer' }));
    expect(ids('p111')).toEqual([a, b]);
    expect(ids('p112')).toEqual(destino);
  });

  it('volver a pegar un corte ya movido (misma marca) no duplica: «Esas líneas ya se movieron»', () => {
    render(<Harness />);
    open('p111');
    copyKeys(comment(ids('p111')[0]!), true);
    open('p112');
    pasteKeys(comment(ids('p112')[0]!));
    expect(P('p112').med).toHaveLength(3);
    pasteKeys(comment(ids('p112')[0]!));
    expect(P('p112').med).toHaveLength(3);
    expect(status()).toHaveTextContent('Esas líneas ya se movieron');
  });

  it('si solo coincide el texto (sin la marca del corte), pregunta mover o copiar', () => {
    render(<Harness />);
    open('p111');
    copyKeys(comment(ids('p111')[0]!), true);
    sys.data.delete(MEDLINES_MIME); // llegó por writeText: solo texto
    open('p112');
    pasteKeys(comment(ids('p112')[0]!));
    const dlg = screen.getByRole('dialog', { name: '¿Mover las líneas cortadas o pegar una copia?' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Pegar una copia' }));
    expect(P('p112').med).toHaveLength(3);
    expect(P('p111').med).toHaveLength(2); // el origen sigue intacto
  });

  it('el botón del pie mueve sin preguntar (es de Concreta)', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Cortar' }));
    open('p112');
    const btn = screen.getByRole('button', { name: /^Mover línea aquí/ });
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    expect(P('p111').med).toHaveLength(1);
    expect(P('p112').med).toHaveLength(3);
  });

  it('en la misma partida con el ancla dentro de lo cortado: no-op, el corte sigue', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    copyKeys(comment(b!), true);
    pasteKeys(comment(b!)); // detrás de sí misma → detrás de «a»: mismo orden
    expect(ids('p111')).toEqual([a, b]);
    expect(useClipboardStore.getState().medLines?.cut).toBe(true);
    pasteKeys(comment(a!).closest('[data-medgrid]')!.querySelector<HTMLElement>(`[data-lineid="${a}"] [data-editcell]`)!);
    expect(ids('p111')).toEqual([a, b]); // «a» ya va delante: tampoco cambia
  });

  it('en la misma partida mueve conservando el id', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    copyKeys(comment(a!), true);
    pasteKeys(comment(b!));
    expect(ids('p111')).toEqual([b, a]);
  });

  it('Esc: primero la selección, luego el corte («Corte cancelado»), luego cierra la partida', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Cortar' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useMedUiStore.getState().selected).toEqual([]);
    expect(useClipboardStore.getState().medLines?.cut).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(useClipboardStore.getState().medLines).toBeNull();
    expect(status()).toHaveTextContent('Corte cancelado');
    expect(st().openPartidaId).toBe('p111');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(st().openPartidaId).toBeNull();
  });

  it('mover una línea certificada a una partida medida de otra forma: UN diálogo con las dos cosas', () => {
    act(() => {
      st().setCertLine('p111', ids('p111')[0]!, 3);
      st().setMedForma('01', 'p112', 'sup');
    });
    render(<Harness />);
    open('p111');
    copyKeys(comment(ids('p111')[0]!), true);
    open('p112');
    pasteKeys(comment(ids('p112')[0]!));
    const dlg = screen.getByRole('dialog', { name: 'Esta partida se mide de otra forma' });
    expect(dlg).toHaveTextContent('Altura → fuera de «Superficie»');
    expect(dlg).toHaveTextContent('Esta línea está certificada en la certificación');
    expect(dlg).toHaveTextContent('Lo ya certificado se queda en E02EM030; las líneas en destino empiezan sin certificar.');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Mover la línea' }));
    expect(P('p111').med).toHaveLength(1);
    expect(P('p112').med).toHaveLength(3);
  });

  it('si las líneas cortadas ya no existen, ofrece pegar la copia guardada', () => {
    render(<Harness />);
    open('p111');
    const [a] = ids('p111');
    copyKeys(comment(a!), true);
    act(() => void st().deleteMedLines('01', 'p111', [a!]));
    open('p112');
    pasteKeys(comment(ids('p112')[0]!));
    const dlg = screen.getByRole('dialog', { name: 'Las líneas cortadas ya no existen' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Pegar la copia guardada' }));
    expect(comments('p112')).toContain('Zanjas de saneamiento');
  });

  it('si falta alguna, mueve las restantes', () => {
    render(<Harness />);
    open('p111');
    const [a, b] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(check(b!));
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Cortar' }));
    act(() => void st().deleteMedLines('01', 'p111', [a!]));
    open('p112');
    fireEvent.click(screen.getByRole('button', { name: /^Mover 2 líneas aquí/ }));
    const dlg = screen.getByRole('dialog', { name: 'Algunas líneas cortadas ya no existen' });
    expect(dlg).toHaveTextContent('1 de 2 líneas cortadas ya no existen en E02EM030');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Mover la restante' }));
    expect(P('p111').med).toHaveLength(0);
    expect(comments('p112').at(-1)).toBe('Zanjas de instalaciones');
  });

  it('un corte de OTRA obra se pega como copia, sin tocar el origen', () => {
    render(<Harness />);
    open('p111');
    copyKeys(comment(ids('p111')[0]!), true);
    act(() => st().reset()); // otra obra (misma semilla, documento nuevo)
    open('p112');
    expect(screen.getByRole('button', { name: /^Pegar línea como copia/ })).toBeInTheDocument();
    pasteKeys(comment(ids('p112')[0]!));
    expect(P('p112').med).toHaveLength(3);
    expect(P('p111').med).toHaveLength(2);
    expect(useClipboardStore.getState().medLines?.cut).toBe(false);
    expect(status()).toHaveTextContent('como copia: el corte era de otra obra');
  });

  it('la identidad de obra no depende del id de guardado (demo guardada por primera vez)', () => {
    render(<Harness />);
    open('p111');
    copyKeys(comment(ids('p111')[0]!), true);
    act(() => useSessionStore.setState({ activeId: 'recien-guardada' }));
    open('p112');
    pasteKeys(comment(ids('p112')[0]!));
    expect(P('p111').med).toHaveLength(1); // se movió, no se copió
  });

  it('en móvil el pie ofrece «Cancelar corte»', () => {
    render(<Harness compact />);
    open('p111');
    const [a] = ids('p111');
    fireEvent.click(check(a!));
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Más acciones de las líneas' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cortar' }));
    expect(lineEl(a!)).toHaveTextContent('cortada');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar corte' }));
    expect(useClipboardStore.getState().medLines).toBeNull();
  });
});
