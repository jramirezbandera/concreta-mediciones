/* [A1] Borradores (§5.8) y cursor de teclado (§5.10) con el motor doble (§12):
   las rutas de cambio de contexto (partida que encaja o no, página y plano,
   ocupante, ventana estrecha) y las de descarte (obra, recalibrar, deshacer un
   cambio de escala, partida que no encaja → [Descartar]). */
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lineParcial } from '../../core/medicion';
import { escalaDe } from '../../core/planoDatos';
import { huellaDe } from '../../core/sha256';
import type { Escala, Punto } from '../../core/types';
import { useAppHotkeys } from '../../hooks/useAppHotkeys';
import { useSessionStore } from '../../persist';
import { __resetPlanosForTests, registrarBytesEnMemoria } from '../../persist/planos';
import { blankObraData, useObraStore, useToastStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { __resetHistoryForTests, initHistory, undo } from '../../store/temporal';
import { A3, pdfMinimo } from '../../test/pdfMinimo';
import { EJEMPLO, abrirEjemploPlanos } from './ejemplo';
import { __setMotorPdfForTests } from './motor';
import { crearAdapterFake } from './pdfAdapter.fake';
import { PlanosPanel } from './PlanosPanel';

const st = () => useObraStore.getState();
const P = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)!;
const A3_Y1 = 841.89;
const EN_ESTA_PAGINA = 'Forma a medio medir: Longitud, 2 puntos.';
const PARA_TABIQUE = 'Borrador para 1.1 Tabique de ladrillo hueco doble: Longitud, 2 puntos.';

function Harness({ estrecha = false }: { estrecha?: boolean }) {
  useAppHotkeys({ onHelp: () => undefined });
  return <PlanosPanel estrecha={estrecha} onCerrar={() => st().setPlanosOpen(false)} />;
}

/** Espera al lienzo con su página pintada (un plano recién abierto pasa antes por «Abriendo…»). */
async function pintado() {
  await waitFor(() => {
    expect(screen.queryByText('Abriendo el plano…')).toBeNull();
    expect(screen.getByRole('application')).toBeInTheDocument();
    expect(screen.queryByText('Pintando…')).toBeNull();
  });
  return { lienzo: screen.getByRole('application'), visor: document.querySelector<HTMLElement>('[data-planos-viewer]')! };
}

async function montar() {
  __setMotorPdfForTests(crearAdapterFake());
  await abrirEjemploPlanos();
  __resetHistoryForTests();
  initHistory(useObraStore);
  const utils = render(<Harness />);
  return { ...utils, ...(await pintado()) };
}

/** Clic sobre un punto de la página (jsdom: el lienzo empieza en 0,0). */
function clic(lienzo: HTMLElement, [x, y]: Punto) {
  const v = JSON.parse(lienzo.dataset.vista!) as { s: number; tx: number; ty: number };
  fireEvent.click(lienzo, { clientX: v.tx + v.s * x, clientY: v.ty + v.s * (A3_Y1 - y), detail: 1, button: 0 });
}
const tecla = (el: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(el, { key, ...extra });
const herramienta = (nombre: string) => fireEvent.click(screen.getByRole('radio', { name: nombre }));
const abrirPartida = (id: string) => act(() => st().revealPartida(id, EJEMPLO.capitulo, null));
const terminar = (n: number) => screen.queryByRole('button', { name: `Terminar (${n})` });
const escalaNueva = (): Escala => ({ ...structuredClone(escalaDe(st().planos[0]! as never, 1)!), rev: 'cal-nueva' });

/** El tabique a medio medir con Longitud: sus dos extremos, sin cerrar. */
function medioTabique(lienzo: HTMLElement) {
  herramienta('Longitud');
  clic(lienzo, EJEMPLO.tabiqueDe);
  clic(lienzo, EJEMPLO.tabiqueA);
  expect(terminar(2)).toBeInTheDocument();
}

/** Cierra la forma y crea la línea con el comentario vacío. */
function crearLinea(visor: HTMLElement) {
  tecla(visor, 'Enter');
  tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
}

beforeEach(async () => {
  await __resetPlanosForTests();
  usePlanoUiStore.getState().reset();
  useSessionStore.setState({ readonly: false, readonlyMotivo: null });
  useToastStore.getState().clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined); // jsdom: sin canvas
});
afterEach(() => {
  __setMotorPdfForTests(null);
  __resetHistoryForTests();
  vi.restoreAllMocks();
});

describe('[A1] borradores: al cambiar de contexto la forma no se pierde', () => {
  it('a una partida en la que la herramienta encaja, la forma pasa a ella y pide lo que le falte', async () => {
    const { lienzo, visor } = await montar();
    medioTabique(lienzo);
    abrirPartida(EJEMPLO.solado); // Superficie directa: Longitud × altura
    // en el aviso y en el aria-live
    expect(await screen.findAllByText(/^La forma pasa a 1\.2 Solado de baldosa cerámica\. Indica la Altura/)).toHaveLength(2);
    expect(terminar(2)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Altura (multiplica)' }), { target: { value: '2,5' } });
    crearLinea(visor);
    expect(P(EJEMPLO.tabique).med).toHaveLength(0);
    expect(P(EJEMPLO.solado).med).toHaveLength(1);
    expect(lineParcial(P(EJEMPLO.solado).med[0]!)).toBeCloseTo(12.5, 2);
  });

  it('a una partida en la que no encaja, queda como «Borrador para …» y [Volver] la retoma en la suya', async () => {
    const { lienzo, visor } = await montar();
    act(() => st().setMedForma(EJEMPLO.capitulo, EJEMPLO.solado, 'ud'));
    medioTabique(lienzo);
    abrirPartida(EJEMPLO.solado);
    expect(await screen.findByText(PARA_TABIQUE)).toBeInTheDocument();
    expect(terminar(2)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(st().openPartidaId).toBe(EJEMPLO.tabique);
    expect(await screen.findByRole('button', { name: 'Terminar (2)' })).toBeInTheDocument();
    expect(screen.queryByText(PARA_TABIQUE)).toBeNull();
    crearLinea(visor);
    expect(P(EJEMPLO.tabique).med[0]).toMatchObject({ largo: 5 });
  });

  it('volver a su partida por otro camino también la retoma', async () => {
    const { lienzo } = await montar();
    act(() => st().setMedForma(EJEMPLO.capitulo, EJEMPLO.solado, 'ud'));
    medioTabique(lienzo);
    abrirPartida(EJEMPLO.solado);
    await screen.findByText(PARA_TABIQUE);
    abrirPartida(EJEMPLO.tabique);
    expect(await screen.findByRole('button', { name: 'Terminar (2)' })).toBeInTheDocument();
  });

  it('cambiar de página o de plano y volver: se ofrece [Seguir]', async () => {
    await montar();
    const buf = pdfMinimo([{ mediaBox: A3 }, { mediaBox: A3 }]).buffer as ArrayBuffer;
    const huella = await huellaDe(buf);
    registrarBytesEnMemoria(huella, buf);
    const escala = escalaDe(st().planos[0]! as never, 1)!;
    act(() => {
      st().attachPlano({
        meta: { id: 'pl-dos', tipo: 'pdf', nombre: 'Dos', archivo: 'dos.pdf', tamano: buf.byteLength, huella, paginas: 2, escalas: { 1: escala, 2: escala } },
        expect: { docToken: st().docToken },
      });
      usePlanoUiStore.getState().abrirPlano('pl-dos', 1);
    });
    const { lienzo } = await pintado();
    medioTabique(lienzo);
    act(() => usePlanoUiStore.getState().setPagina(2));
    await pintado();
    expect(terminar(2)).toBeNull();
    expect(screen.queryByText(EN_ESTA_PAGINA)).toBeNull(); // es de la página 1
    act(() => usePlanoUiStore.getState().abrirPlano(EJEMPLO.planoId, 1));
    await pintado();
    expect(screen.queryByText(EN_ESTA_PAGINA)).toBeNull(); // ni de este plano
    act(() => usePlanoUiStore.getState().abrirPlano('pl-dos', 1));
    await pintado();
    expect(await screen.findByText(EN_ESTA_PAGINA)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(terminar(2)).toBeInTheDocument();
    expect(usePlanoUiStore.getState().borrador).toBeNull();
  });

  it('cerrar el visor y volver a abrirlo: se ofrece [Seguir]', async () => {
    const { lienzo, unmount } = await montar();
    medioTabique(lienzo);
    unmount();
    render(<Harness />);
    await pintado();
    expect(await screen.findByText(EN_ESTA_PAGINA)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(terminar(2)).toBeInTheDocument();
  });

  it('la ventana pasa a estrecha: queda guardada; al ensanchar, [Seguir]', async () => {
    const { lienzo, rerender } = await montar();
    medioTabique(lienzo);
    rerender(<Harness estrecha />);
    expect(terminar(2)).toBeNull();
    expect(screen.getByText(EN_ESTA_PAGINA)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seguir' })).toBeNull(); // estrecha: no se mide
    // el borrador se ve atenuado en el lienzo: es lo que ofrece el aviso
    expect(document.querySelector('[data-borrador]')).not.toBeNull();
    rerender(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(terminar(2)).toBeInTheDocument();
  });

  it('en NOMBRANDO se retoma con su comentario', async () => {
    const { lienzo, visor, unmount } = await montar();
    medioTabique(lienzo);
    tecla(visor, 'Enter');
    fireEvent.change(screen.getByRole('textbox', { name: 'Comentario de la línea' }), { target: { value: 'Tabique baño' } });
    unmount();
    render(<Harness />);
    await pintado();
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));
    const comentario = screen.getByRole('textbox', { name: 'Comentario de la línea' });
    expect(comentario).toHaveValue('Tabique baño');
    tecla(comentario, 'Enter');
    expect(P(EJEMPLO.tabique).med[0]).toMatchObject({ comment: 'PB · Tabique baño', largo: 5 });
  });
});

describe('[A1] borradores: se descartan con aviso', () => {
  /** Un borrador de Tabique en espera (Solado por Unidades no admite Longitud). */
  async function enEspera() {
    const utils = await montar();
    act(() => st().setMedForma(EJEMPLO.capitulo, EJEMPLO.solado, 'ud'));
    return utils;
  }
  async function dejarEnEspera(lienzo: HTMLElement) {
    medioTabique(lienzo);
    abrirPartida(EJEMPLO.solado);
    await screen.findByText(PARA_TABIQUE);
  }

  it('[Descartar] en «Borrador para …»', async () => {
    const { lienzo } = await enEspera();
    await dejarEnEspera(lienzo);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(usePlanoUiStore.getState().borrador).toBeNull();
    expect(screen.queryByText(PARA_TABIQUE)).toBeNull();
    abrirPartida(EJEMPLO.tabique);
    expect(terminar(2)).toBeNull();
  });

  it('empezar otra forma descarta el borrador guardado', async () => {
    const { lienzo } = await enEspera();
    await dejarEnEspera(lienzo);
    herramienta('Recuento');
    clic(lienzo, [300, 300]);
    expect(terminar(1)).toBeInTheDocument();
    expect(usePlanoUiStore.getState().borrador).toBeNull();
    expect(await screen.findAllByText('Borrador descartado: empezaste otra forma.')).toHaveLength(2); // aviso y aria-live
  });

  it('cambiar de obra', async () => {
    const { lienzo } = await montar();
    medioTabique(lienzo);
    act(() => st().loadObra(blankObraData('Otra')));
    await waitFor(() => expect(useToastStore.getState().msg).toBe('Forma descartada: cambiaste de obra.'));
    expect(usePlanoUiStore.getState().borrador).toBeNull();
  });

  it('recalibrar su página', async () => {
    const { lienzo } = await enEspera();
    await dejarEnEspera(lienzo);
    act(() => {
      st().setPlanoPageScale({ planoId: EJEMPLO.planoId, pagina: 1, escala: escalaNueva(), expect: { docToken: st().docToken } });
    });
    await waitFor(() => expect(useToastStore.getState().msg).toBe('Forma descartada: cambió la escala de su página.'));
    expect(usePlanoUiStore.getState().borrador).toBeNull();
    expect(screen.queryByText(PARA_TABIQUE)).toBeNull();
  });

  it('deshacer un cambio de escala de su página', async () => {
    const { lienzo } = await enEspera();
    act(() => {
      st().setPlanoPageScale({ planoId: EJEMPLO.planoId, pagina: 1, escala: escalaNueva(), expect: { docToken: st().docToken } });
    });
    await dejarEnEspera(lienzo);
    act(() => undo());
    await waitFor(() => expect(useToastStore.getState().msg).toBe('Forma descartada: cambió la escala de su página.'));
    expect(usePlanoUiStore.getState().borrador).toBeNull();
  });
});

describe('[A1] cursor de teclado', () => {
  it('las flechas lo encienden y lo mueven; Intro pone un punto y Mayús+Intro cierra; con Mano, Intro selecciona; el ratón lo apaga', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    const cursor = () => lienzo.querySelector('[data-cursor-teclado]');
    expect(cursor()).toBeNull();
    tecla(visor, 'ArrowRight');
    expect(cursor()).not.toBeNull();
    tecla(visor, 'Enter');
    expect(terminar(1)).toBeInTheDocument();
    for (let i = 0; i < 10; i++) tecla(visor, 'ArrowRight', { shiftKey: true }); // 100 px
    expect(screen.getByText(/Intro pone un punto · Mayús\+Intro cierra/)).toBeInTheDocument();
    tecla(visor, 'Enter');
    expect(terminar(2)).toBeInTheDocument();
    tecla(visor, 'Enter', { shiftKey: true });
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    const { s } = JSON.parse(lienzo.dataset.vista!) as { s: number };
    const mPorUnidad = escalaDe(st().planos[0]! as never, 1)!.mPorUnidad;
    expect(Number(P(EJEMPLO.tabique).med[0]!.largo)).toBeCloseTo((100 / s) * mPorUnidad, 1);
    // con Mano, Intro es un clic donde está el cursor: selecciona la forma
    tecla(visor, 'Escape');
    herramienta('Mano');
    tecla(visor, 'Enter');
    expect(screen.getByText('Volver a medir')).toBeInTheDocument();
    // mover el ratón lo apaga
    fireEvent.pointerMove(lienzo, { clientX: 10, clientY: 10 });
    expect(cursor()).toBeNull();
  });

  it('las flechas no se escapan a la página ni actúan dentro del comentario', async () => {
    const { lienzo, visor } = await montar();
    medioTabique(lienzo);
    tecla(visor, 'Enter');
    const comentario = screen.getByRole('textbox', { name: 'Comentario de la línea' });
    const ev = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    act(() => {
      comentario.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false); // el texto se edita como siempre
    expect(lienzo.querySelector('[data-cursor-teclado]')).toBeNull();
    const fuera = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    act(() => {
      visor.dispatchEvent(fuera);
    });
    expect(fuera.defaultPrevented).toBe(true); // en el visor, no desplaza la página
  });
});
