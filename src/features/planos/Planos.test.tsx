/* Visor de planos con el motor doble (§12): medir, Esc por estado, teclas en
   el comentario, solo lectura, plano no disponible, quitar con confirmación,
   fijas por partida, calibrar desde la interfaz y la frontera de errores. */
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escalaDe, planoLegible } from '../../core/planoDatos';
import type { OrigenPlano, PlanoMeta, Punto } from '../../core/types';
import { useAppHotkeys } from '../../hooks/useAppHotkeys';
import { disposicionPlanos } from '../../layout/disposicionPlanos';
import { useSessionStore } from '../../persist';
import { __resetPlanosForTests } from '../../persist/planos';
import { useObraStore, useToastStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { __historyState, __resetHistoryForTests, initHistory, undo } from '../../store/temporal';
import { METRO_1_50 } from '../../test/pdfMinimo';
import { EJEMPLO, abrirEjemploPlanos } from './ejemplo';
import { __setMotorPdfForTests } from './motor';
import { crearAdapterFake } from './pdfAdapter.fake';
import { PlanosPanel } from './PlanosPanel';
import { FronteraPlanos } from './PlanosLateral';
import { esFalloDeChunk } from './textos';

const st = () => useObraStore.getState();
const P = (id: string) => Object.values(st().partidas).flat().find((p) => p.id === id)!;
const A3_Y1 = 841.89;
const m = METRO_1_50;

/** El panel con los atajos globales montados (para ver que Esc no se escapa). */
function Harness() {
  useAppHotkeys({ onHelp: () => undefined });
  return <PlanosPanel estrecha={false} onCerrar={() => st().setPlanosOpen(false)} />;
}

async function montar() {
  __setMotorPdfForTests(crearAdapterFake());
  await abrirEjemploPlanos();
  __resetHistoryForTests();
  initHistory(useObraStore);
  const utils = render(<Harness />);
  const lienzo = await screen.findByRole('application');
  await waitFor(() => expect(screen.queryByText('Pintando…')).toBeNull());
  const visor = utils.container.querySelector<HTMLElement>('[data-planos-viewer]')!;
  return { ...utils, lienzo, visor };
}

/** Clic sobre un punto de la página (jsdom: el lienzo empieza en 0,0). */
function clic(lienzo: HTMLElement, [x, y]: Punto, extra: Partial<MouseEventInit> = {}) {
  const v = JSON.parse(lienzo.dataset.vista!) as { s: number; tx: number; ty: number };
  fireEvent.click(lienzo, { clientX: v.tx + v.s * x, clientY: v.ty + v.s * (A3_Y1 - y), detail: 1, button: 0, ...extra });
}
const tecla = (el: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(el, { key, ...extra });
const herramienta = (nombre: string) => fireEvent.click(screen.getByRole('radio', { name: nombre }));

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

describe('medir desde el visor', () => {
  it('Longitud → línea con `expr` y `origen`; un paso de Deshacer', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    const comentario = screen.getByRole('textbox', { name: 'Comentario de la línea' });
    fireEvent.change(comentario, { target: { value: 'Tabique cocina' } });
    tecla(comentario, 'Enter');
    const l = P(EJEMPLO.tabique).med[0]!;
    expect(l).toMatchObject({ comment: 'PB · Tabique cocina', uds: 1, largo: 5, expr: { largo: '5' } });
    expect(l.origen).toMatchObject({ planoId: EJEMPLO.planoId, herramienta: 'longitud', calRev: 'cal-ejemplo', magnitud: 'longitud' });
    expect(__historyState().past).toBe(1);
    // el foco sigue en el visor
    expect(visor.contains(document.activeElement)).toBe(true);
    act(() => undo());
    expect(P(EJEMPLO.tabique).med).toHaveLength(0);
  });

  it('la herramienta que no encaja dice su motivo y arma la que sí', async () => {
    const { lienzo } = await montar();
    act(() => st().setMedForma(EJEMPLO.capitulo, EJEMPLO.tabique, 'ud'));
    herramienta('Longitud');
    expect((await screen.findAllByText('Esta partida se mide por Unidades: usa Recuento.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: 'Recuento' })).toHaveAttribute('aria-checked', 'true');
    clic(lienzo, [300, 300]);
    clic(lienzo, [400, 300]);
    expect(P(EJEMPLO.tabique).med).toHaveLength(0);
  });

  it('Esc a medio dibujo descarta la forma sin cerrar el visor ni la partida', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Escape');
    expect(st().lateral).toBe('planos');
    expect(st().openPartidaId).toBe(EJEMPLO.tabique);
    expect(screen.queryByRole('button', { name: /Terminar/ })).toBeNull();
  });

  it('Esc en reposo cierra el visor y deja la partida abierta; en pantalla completa, primero sale de ella', async () => {
    const { visor } = await montar();
    act(() => usePlanoUiStore.getState().setPantallaCompleta(true));
    tecla(visor, 'Escape');
    expect(usePlanoUiStore.getState().pantallaCompleta).toBe(false);
    expect(st().lateral).toBe('planos');
    tecla(visor, 'Escape');
    expect(st().lateral).toBeNull();
    expect(st().openPartidaId).toBe(EJEMPLO.tabique);
  });

  it('Esc en CREADA no cierra la partida', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    expect(await screen.findByText(/Línea 1 ·/)).toBeInTheDocument();
    tecla(visor, 'Escape');
    expect(st().openPartidaId).toBe(EJEMPLO.tabique);
    expect(st().lateral).toBe('planos');
  });

  it('Ctrl+Z a medio dibujo quita un vértice sin deshacer la última línea', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    clic(lienzo, [150, 300]);
    clic(lienzo, [300, 300]);
    expect(screen.getByRole('button', { name: 'Terminar (2)' })).toBeInTheDocument();
    tecla(visor, 'z', { ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Terminar (1)' })).toBeInTheDocument();
    expect(P(EJEMPLO.tabique).med).toHaveLength(1); // la línea sigue
  });

  it('en el comentario, Retroceso y Ctrl+Z son del texto y la C no arma Calibrar', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    const c = screen.getByRole('textbox', { name: 'Comentario de la línea' });
    const retroceso = createEventSpy(c, 'Backspace');
    const deshacer = createEventSpy(c, 'z', { ctrlKey: true });
    const letraC = createEventSpy(c, 'c');
    expect(retroceso.defaultPrevented).toBe(false); // edición nativa
    expect(deshacer.defaultPrevented).toBe(false);
    expect(letraC.defaultPrevented).toBe(false);
    expect(screen.queryByText('1 Cota')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Comentario de la línea' })).toBeInTheDocument();
  });

  it('Enter mientras se compone texto (IME) no crea la línea', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter', { isComposing: true });
    expect(P(EJEMPLO.tabique).med).toHaveLength(0);
  });

  it('Supr con una forma seleccionada (Mano) borra su línea', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    tecla(visor, 'Escape');
    herramienta('Mano');
    clic(lienzo, [150 + 2.5 * m, 200 + 6 * m]); // sobre el tabique medido
    expect(screen.getByText('Volver a medir')).toBeInTheDocument();
    tecla(visor, 'Delete');
    expect(P(EJEMPLO.tabique).med).toHaveLength(0);
    expect(st().chapters).toHaveLength(1); // la partida no se borra
  });

  it('dimensiones fijas por partida: la Altura de una no aparece en la otra', async () => {
    await montar();
    act(() => {
      st().revealPartida(EJEMPLO.solado, EJEMPLO.capitulo, null);
    });
    herramienta('Longitud'); // Longitud × h en Superficie directa: pide la altura
    const h = await screen.findByRole('textbox', { name: 'Altura (multiplica)' });
    fireEvent.change(h, { target: { value: '2,7' } });
    act(() => st().revealPartida(EJEMPLO.tabique, EJEMPLO.capitulo, null));
    expect(screen.queryByRole('textbox', { name: 'Altura (multiplica)' })).toBeNull();
    act(() => st().revealPartida(EJEMPLO.solado, EJEMPLO.capitulo, null));
    expect(screen.getByRole('textbox', { name: 'Altura (multiplica)' })).toHaveValue('2,7');
  });
});

/** keyDown que devuelve el evento (para mirar `defaultPrevented`). */
function createEventSpy(el: HTMLElement, key: string, extra: Partial<KeyboardEventInit> = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
}

describe('calibrar desde la interfaz', () => {
  it('cota, comprobación y etiqueta → escala nueva en un paso de Deshacer', async () => {
    const { lienzo, visor } = await montar();
    // otra página sin calibrar: el mismo PDF adjunto otra vez
    const pl = st().planos[0]! as PlanoMeta;
    act(() => {
      st().attachPlano({ meta: { ...structuredClone(pl), id: 'pl-2', escalas: {}, etiquetas: {} }, expect: { docToken: st().docToken }, nuevo: true });
      usePlanoUiStore.getState().abrirPlano('pl-2', 1);
    });
    const l2 = await screen.findByRole('application');
    await waitFor(() => expect(screen.queryByText('Pintando…')).toBeNull());
    void lienzo;
    void visor;
    const visor2 = document.querySelector<HTMLElement>('[data-planos-viewer]')!;
    // zoom para que la cota pase de 300 px
    tecla(visor2, '+');
    tecla(visor2, '+');
    tecla(visor2, 'c');
    expect(screen.getByText('1 Cota')).toBeInTheDocument();
    clic(l2, [100, 120]);
    clic(l2, [100 + 10 * m, 120]);
    const metros = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros, { target: { value: '10' } });
    tecla(metros, 'Enter');
    expect(screen.getByText('2 Comprobación')).toBeInTheDocument();
    clic(l2, [1000, 100]);
    clic(l2, [1000, 100 + 6 * m]);
    const metros2 = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros2, { target: { value: '6' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta de la página' }), { target: { value: 'P1' } });
    tecla(metros2, 'Enter');
    const p2 = st().planos.find((p) => planoLegible(p) && p.id === 'pl-2') as PlanoMeta;
    const e = escalaDe(p2, 1)!;
    expect(e.n).toBeCloseTo(50, 0);
    expect(e.comprobacion?.fuente).toBe('cota');
    expect(p2.etiquetas).toEqual({ 1: 'P1' });
    expect(e.ref.a).toEqual(e.ref.a.map((x) => Math.round(x * 100) / 100)); // puntos a 0,01
  });

  it('Calibrar en una página con líneas medidas: no calibra y lo dice', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    tecla(visor, 'Escape');
    tecla(visor, 'c');
    expect((await screen.findAllByText(/Esta página ya tiene 1 línea medida con esta escala/)).length).toBeGreaterThan(0);
    expect(screen.queryByText('1 Cota')).toBeNull();
  });
});

describe('estados del visor', () => {
  it('pestaña de solo lectura: solo se ve', async () => {
    useSessionStore.setState({ readonly: true, readonlyMotivo: 'otra-pestana' });
    const { lienzo } = await montar();
    const longitud = screen.getByRole('radio', { name: 'Longitud' });
    expect(longitud).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(longitud);
    expect((await screen.findAllByText('Esta obra está abierta en otra pestaña: aquí solo se puede ver.')).length).toBeGreaterThan(0);
    clic(lienzo, EJEMPLO.tabiqueDe);
    expect(screen.queryByRole('button', { name: /Terminar/ })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Calibrar' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('plano no disponible: lo explica con el nombre y el tamaño del fichero', async () => {
    await montar();
    await __resetPlanosForTests(); // el PDF ya no está en este navegador
    act(() => {
      usePlanoUiStore.getState().abrirPlano(null);
    });
    act(() => {
      usePlanoUiStore.getState().abrirPlano(EJEMPLO.planoId, 1);
    });
    expect(await screen.findByText(/No está el PDF de «planta-baja-ejemplo\.pdf»/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjuntar PDF' })).toBeInTheDocument();
  });

  it('quitar un plano pide confirmación con su número de líneas', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de planos' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Quitar plano/ }));
    const d = screen.getByRole('dialog');
    expect(within(d).getByText(/Quitar «Planta baja \(ejemplo\)»: 1 línea conserva sus números, pero\s+dejan de verse en el plano/)).toBeInTheDocument();
    fireEvent.click(within(d).getByRole('button', { name: 'Quitar' }));
    expect((st().planos[0] as PlanoMeta).quitado).toBeTruthy();
    expect((P(EJEMPLO.tabique).med[0]!.origen as OrigenPlano).planoId).toBe(EJEMPLO.planoId);
  });

  it('abrir el visor cierra Referencia (y el asistente)', () => {
    st().setRefOpen(true);
    st().setPlanosOpen(true);
    expect(st().lateral).toBe('planos');
    st().setAsistenteOpen(true);
    expect(st().lateral).toBe('asistente');
  });

  it('adjuntar → Deshacer → vuelve a la lista sin errores', async () => {
    await montar();
    const pl = st().planos[0]! as PlanoMeta;
    act(() => {
      st().attachPlano({ meta: { ...structuredClone(pl), id: 'pl-3', escalas: {} }, expect: { docToken: st().docToken }, nuevo: true });
      usePlanoUiStore.getState().abrirPlano('pl-3', 1);
    });
    await screen.findByRole('application');
    act(() => undo());
    expect(await screen.findByText('Adjunta el PDF · Calibra con una cota · Mide')).toBeInTheDocument();
  });
});

describe('frontera de errores y disposición', () => {
  it('un chunk que no carga: el visor pide recargar (el presupuesto sigue)', () => {
    const Rompe = () => {
      throw new Error('Failed to fetch dynamically imported module: /assets/PlanosPanel-x.js');
    };
    render(
      <FronteraPlanos onCerrar={() => undefined}>
        <Rompe />
      </FronteraPlanos>,
    );
    expect(screen.getByText('Hay una versión nueva de Concreta: recarga la página.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
    expect(esFalloDeChunk(new Error('boom'))).toBe(false);
  });

  it('split a 1366 y a 1024 si caben lienzo y presupuesto; si no, overlay', () => {
    expect(disposicionPlanos(1366, true, null)).toMatchObject({ split: true });
    // el 55 % dejaría el presupuesto por debajo de 520: se queda en «útil − 520»
    expect(disposicionPlanos(1366, true, null).width).toBe(1366 - 286 - 520);
    expect(disposicionPlanos(1920, true, null).width).toBe(Math.round((1920 - 286) * 0.55));
    expect(disposicionPlanos(1300, true, null)).toMatchObject({ split: true }); // 1014 ≥ 1000
    expect(disposicionPlanos(1100, true, null)).toMatchObject({ split: false }); // 814 < 1000
    expect(disposicionPlanos(900, false, null)).toMatchObject({ split: false });
    expect(disposicionPlanos(1920, true, 5000).width).toBe(1920 - 286 - 520); // tope: presupuesto ≥ 520
    expect(disposicionPlanos(1920, true, 100).width).toBe(480);
  });
});
