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
import { A3, METRO_1_50, pdfMinimo } from '../../test/pdfMinimo';
import { huellaDe } from '../../core/sha256';
import { registrarBytesEnMemoria } from '../../persist/planos';
import { EJEMPLO, abrirEjemploPlanos } from './ejemplo';
import { __setMotorPdfForTests } from './motor';
import { crearAdapterFake, registroFake } from './pdfAdapter.fake';
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
    // [A1] su «?» lleva a la sección de la ayuda que lo explica
    const pedida = vi.fn();
    window.addEventListener('concreta:ayuda', pedida);
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda: Qué herramienta para cada partida' }));
    window.removeEventListener('concreta:ayuda', pedida);
    expect((pedida.mock.calls[0]![0] as CustomEvent).detail).toEqual({ tab: 'funcionalidades', ancla: 'planos-herramientas' });
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
  /** Otra página sin calibrar (el mismo PDF adjunto otra vez), con zoom y en el paso 1 de calibrar. */
  async function calibrarOtraPagina() {
    await montar();
    const pl = st().planos[0]! as PlanoMeta;
    act(() => {
      st().attachPlano({ meta: { ...structuredClone(pl), id: 'pl-2', escalas: {}, etiquetas: {} }, expect: { docToken: st().docToken }, nuevo: true });
      usePlanoUiStore.getState().abrirPlano('pl-2', 1);
    });
    const l2 = await screen.findByRole('application');
    await waitFor(() => expect(screen.queryByText('Pintando…')).toBeNull());
    const visor2 = document.querySelector<HTMLElement>('[data-planos-viewer]')!;
    tecla(visor2, '+');
    tecla(visor2, '+');
    tecla(visor2, 'c');
    expect(screen.getByText('1 Cota')).toBeInTheDocument();
    // la etiqueta propuesta desde el texto («PLANTA BAJA E 1:50»)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Etiqueta de la página' })).toHaveValue('PB'));
    clic(l2, [100, 120]);
    clic(l2, [100 + 10 * m, 120]);
    return { l2, plano2: () => st().planos.find((p) => planoLegible(p) && p.id === 'pl-2') as PlanoMeta };
  }

  it('[A1] cajetín «E 1:50» y una cota que cuadra: termina ajustada, sin segunda cota, con la etiqueta propuesta', async () => {
    const { plano2 } = await calibrarOtraPagina();
    const metros = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros, { target: { value: '10' } });
    expect(screen.getByText(/calibrada 1:50 · el plano dice 1:50/)).toBeInTheDocument();
    tecla(metros, 'Enter');
    expect(screen.queryByText('2 Comprobación')).toBeNull();
    const e = escalaDe(plano2(), 1)!;
    expect(e).toMatchObject({ n: 50, ajustada: true, escalaDeclarada: 50, comprobacion: { fuente: 'cajetin', escalaDeclarada: 50 } });
    expect(e.mPorUnidad).toBeCloseTo((50 * 0.0254) / 72, 12); // la exacta: sin el error del clic
    expect(plano2().etiquetas).toEqual({ 1: 'PB' });
    expect(screen.getByRole('button', { name: /1:50 ajustada/ })).toBeInTheDocument();
  });

  it('una cota que no cuadra con el cajetín pide la comprobación; se guarda con la escala declarada y avisa', async () => {
    const { l2, plano2 } = await calibrarOtraPagina();
    const metros = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros, { target: { value: '10,5' } }); // 1:52,5 frente a «E 1:50»
    tecla(metros, 'Enter');
    expect(screen.getByText('2 Comprobación')).toBeInTheDocument();
    clic(l2, [1000, 100]);
    clic(l2, [1000, 100 + 6 * m]);
    const metros2 = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros2, { target: { value: '6,3' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta de la página' }), { target: { value: 'P1' } });
    tecla(metros2, 'Enter');
    // 1:52,5 no es una escala habitual: la plausibilidad pide confirmarla
    fireEvent.click(screen.getByRole('button', { name: 'Sí, es correcta' }));
    const e = escalaDe(plano2(), 1)!;
    expect(e.n).toBeCloseTo(52.5, 0);
    expect(e).toMatchObject({ escalaDeclarada: 50, comprobacion: { fuente: 'cota' } });
    expect(e.ajustada).toBeUndefined();
    expect(plano2().etiquetas).toEqual({ 1: 'P1' });
    expect(e.ref.a).toEqual(e.ref.a.map((x) => Math.round(x * 100) / 100)); // puntos a 0,01
    expect(screen.getByRole('button', { name: /no cuadra con el cajetín/ })).toBeInTheDocument();
    expect(
      screen.getAllByText('La calibración no cuadra con la escala del plano: ¿el PDF está a otro tamaño?').length,
    ).toBeGreaterThan(0);
  });

  /** Mide el tabique de 5 m y recalibra la página a 1:100 (la cota de 10 m del dibujo, tecleada como 20). */
  async function recalibrarConLinea() {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    tecla(visor, 'Escape');
    tecla(visor, '+');
    tecla(visor, '+');
    tecla(visor, 'c');
    expect(screen.getByText('1 Cota')).toBeInTheDocument();
    clic(lienzo, [100, 120]);
    clic(lienzo, [100 + 10 * m, 120]);
    const metros = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros, { target: { value: '20' } });
    tecla(metros, 'Enter');
    clic(lienzo, [1000, 100]);
    clic(lienzo, [1000, 100 + 6 * m]);
    const metros2 = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros2, { target: { value: '12' } });
    tecla(metros2, 'Enter');
    return screen.findByRole('dialog', { name: '¿La escala anterior estaba mal?' });
  }
  const tabique = () => st().partidas[EJEMPLO.capitulo]!.find((p) => p.id === EJEMPLO.tabique)!.med[0]!;

  it('[A1] recalibrar una página con líneas pregunta; Cancelar (el foco por defecto) la deja como estaba', async () => {
    const dialogo = await recalibrarConLinea();
    expect(within(dialogo).getByText(/pasa de/)).toHaveTextContent('pasa de 1:50 a 1:100');
    expect(within(dialogo).getByText(/Se recalcula/)).toHaveTextContent('Se recalcula 1 línea (1 a 1:50).');
    expect(within(dialogo).getByText(/1 línea · 5,00 → 10,00 m/)).toBeInTheDocument();
    const cancelar = within(dialogo).getByRole('button', { name: 'Cancelar' });
    expect(cancelar).toHaveFocus(); // Enter cancela
    fireEvent.click(cancelar);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(escalaDe(st().planos[0]!, 1)!.n).toBe(50);
    expect(tabique().largo).toBe(5);
  });

  it('[A1] «Recalcular 1 línea»: escala y línea en UN paso de Deshacer', async () => {
    const dialogo = await recalibrarConLinea();
    const pasado = __historyState().past;
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Recalcular 1 línea' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(escalaDe(st().planos[0]!, 1)!.n).toBeCloseTo(100, 0);
    expect(tabique()).toMatchObject({ largo: 10, expr: { largo: '10' } });
    expect((await screen.findAllByText(/recalibrada 1:100 · comprobada .* · 1 línea recalculada/)).length).toBeGreaterThan(0);
    expect(__historyState().past).toBe(pasado + 1);
    act(() => undo());
    expect(escalaDe(st().planos[0]!, 1)!.n).toBe(50);
    expect(tabique().largo).toBe(5);
  });

  it('[A1] página sin comprobar: chip, aviso con [Comprobar] y medir bloqueado hasta comprobar', async () => {
    await montar();
    act(() => {
      useObraStore.setState((s) => {
        delete (s.planos[0] as PlanoMeta).escalas[1]!.comprobacion;
      });
    });
    expect(await screen.findByText(/sin comprobar/)).toBeInTheDocument();
    expect(screen.getAllByText('Comprueba la escala de esta página con otra cota antes de medir.').length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: 'Longitud' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByText(/Esta escala no está comprobada/)).toBeInTheDocument();
    const lienzo = screen.getByRole('application');
    const visor = document.querySelector<HTMLElement>('[data-planos-viewer]')!;
    tecla(visor, '+');
    tecla(visor, '+');
    clic(lienzo, [1000, 100]);
    clic(lienzo, [1000, 100 + 6 * m]);
    const metros = screen.getByRole('textbox', { name: 'Distancia real en metros' });
    fireEvent.change(metros, { target: { value: '6' } });
    const rev = escalaDe(st().planos[0]!, 1)!.rev;
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    const e = escalaDe(st().planos[0]!, 1)!;
    expect(e.rev).toBe(rev); // la misma escala
    expect(e.comprobacion).toMatchObject({ fuente: 'cota', metros: 6 });
    expect(screen.getByRole('radio', { name: 'Longitud' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('[A1] texto de la página', () => {
  it('Superficie sobre la estancia: el comentario propone «Salon» (el texto dentro), seleccionado', async () => {
    const { lienzo, visor } = await montar();
    act(() => {
      useObraStore.setState({ openPartidaId: EJEMPLO.solado });
    });
    herramienta('Superficie');
    const [x0, y0] = [150, 200];
    for (const p of [
      [x0, y0],
      [x0 + 5 * m, y0],
      [x0 + 5 * m, y0 + 4 * m],
      [x0, y0 + 4 * m],
    ] as Punto[])
      clic(lienzo, p);
    tecla(visor, 'Enter');
    const comentario = screen.getByRole('textbox', { name: 'Comentario de la línea' }) as HTMLInputElement;
    expect(comentario).toHaveValue('Salon');
    expect(comentario.selectionStart).toBe(0);
    expect(comentario.selectionEnd).toBe('Salon'.length);
  });

  it('«Usar esta calibración en otras páginas»: las del mismo tamaño y la misma escala en el cajetín, «sin comprobar»', async () => {
    await montar();
    const pag = (texto: string, caja = A3) => ({ mediaBox: caja, textos: [{ x: 980, y: 60, tamano: 10, texto }] });
    const buf = pdfMinimo([pag('PLANTA BAJA  E 1:50'), pag('PLANTA PRIMERA  E 1:50'), pag('DETALLE  E 1:20'), pag('E 1:50', [0, 0, 841.89, 594.96])])
      .buffer as ArrayBuffer;
    const huella = await huellaDe(buf);
    registrarBytesEnMemoria(huella, buf);
    const escala = { ...structuredClone(escalaDe(st().planos[0]!, 1)!), escalaDeclarada: 50 };
    act(() => {
      st().attachPlano({
        meta: { id: 'pl-4', tipo: 'pdf', nombre: 'Cuatro', archivo: 'cuatro.pdf', tamano: buf.byteLength, huella, paginas: 4, escalas: { 1: escala } },
        expect: { docToken: st().docToken },
      });
      usePlanoUiStore.getState().abrirPlano('pl-4', 1);
    });
    await screen.findByRole('application');
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de planos' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Usar esta calibración en otras páginas/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Usar esta calibración en otras páginas' });
    // solo la pág. 2: la 3 dice 1:20 y la 4 es A4
    expect(await within(dialogo).findByRole('checkbox', { name: 'Pág. 2' })).toBeChecked();
    expect(within(dialogo).getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Copiar a 1 página' }));
    const p4 = st().planos.find((p) => planoLegible(p) && p.id === 'pl-4') as PlanoMeta;
    expect(escalaDe(p4, 2)).toMatchObject({ n: escala.n, escalaDeclarada: 50 });
    expect(escalaDe(p4, 2)!.comprobacion).toBeUndefined();
    expect(escalaDe(p4, 3)).toBeNull();
  });
});

describe('[A1] «Añadir también a…»', () => {
  it('el solado del salón entra en Tabique como su perímetro: misma forma, un paso de Deshacer, «También en»', async () => {
    const { lienzo, visor } = await montar();
    act(() => {
      useObraStore.setState({ openPartidaId: EJEMPLO.solado });
    });
    herramienta('Superficie');
    for (const p of [
      [150, 200],
      [150 + 5 * m, 200],
      [150 + 5 * m, 200 + 4 * m],
      [150, 200 + 4 * m],
    ] as Punto[])
      clic(lienzo, p);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir también a…' }));
    const hoja = await screen.findByRole('dialog', { name: /Añadir también a/ });
    fireEvent.click(within(hoja).getByRole('button', { name: /Tabique de ladrillo hueco doble/ }));
    const fila = within(hoja).getByRole('list', { name: 'Partidas elegidas' });
    expect(within(fila).getByText('Perímetro')).toBeInTheDocument(); // por metros, solo el perímetro
    expect(within(fila).getByText(/18,00 m · cantidad 0,00 → 18,00 m/)).toBeInTheDocument();
    const pasado = __historyState().past;
    fireEvent.click(within(hoja).getByRole('button', { name: 'Añadir a 1 partida' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const tabique = st().partidas[EJEMPLO.capitulo]!.find((p) => p.id === EJEMPLO.tabique)!;
    const solado = st().partidas[EJEMPLO.capitulo]!.find((p) => p.id === EJEMPLO.solado)!;
    expect(tabique.med).toHaveLength(1);
    expect(tabique.med[0]).toMatchObject({ comment: 'PB · Salon', largo: 18, expr: { largo: '5+4+5+4' } });
    expect((tabique.med[0]!.origen as OrigenPlano).formaId).toBe((solado.med[0]!.origen as OrigenPlano).formaId);
    expect((tabique.med[0]!.origen as OrigenPlano).magnitud).toBe('perimetro');
    expect(__historyState().past).toBe(pasado + 1);
    // con Mano, el popover de la forma dice dónde más está
    tecla(visor, 'Escape');
    herramienta('Mano');
    clic(lienzo, [150 + 2.5 * m, 200 + 2 * m]);
    expect(await screen.findByText(/También en: 1\.1 Tabique de ladrillo hueco doble/)).toBeInTheDocument();
    act(() => undo());
    expect(st().partidas[EJEMPLO.capitulo]!.find((p) => p.id === EJEMPLO.tabique)!.med).toHaveLength(0);
  });
});

describe('precarga de páginas', () => {
  it('con la página pintada, en reposo, precarga la vecina y las que tienen escala', async () => {
    await montar();
    const buf = pdfMinimo([1, 2, 3, 4, 5, 6].map(() => ({ mediaBox: A3 }))).buffer as ArrayBuffer;
    const huella = await huellaDe(buf);
    registrarBytesEnMemoria(huella, buf);
    const escala = escalaDe(st().planos[0]!, 1)!;
    const meta: PlanoMeta = {
      id: 'pl-seis',
      tipo: 'pdf',
      nombre: 'Seis páginas',
      archivo: 'seis.pdf',
      tamano: buf.byteLength,
      huella,
      paginas: 6,
      escalas: { 6: escala },
    };
    registroFake.precargas.length = 0;
    act(() => {
      st().attachPlano({ meta, expect: { docToken: st().docToken } });
      usePlanoUiStore.getState().abrirPlano('pl-seis', 2);
    });
    await waitFor(() => expect(registroFake.precargas).toEqual([3, 1, 6]), { timeout: 3000 });
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

  it('[A1] PDF no disponible + otro PDF con sus páginas: «Usar este PDF para este plano»', async () => {
    await montar();
    const antes = structuredClone(st().planos[0] as PlanoMeta);
    await __resetPlanosForTests();
    act(() => usePlanoUiStore.getState().abrirPlano(null));
    act(() => usePlanoUiStore.getState().abrirPlano(EJEMPLO.planoId, 1));
    await screen.findByText(/No está el PDF de «planta-baja-ejemplo\.pdf»/);
    const otro = new File([pdfMinimo([{ mediaBox: A3, textos: [{ x: 60, y: 60, tamano: 10, texto: 'Otra exportación' }] }])], 'reexportado.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText('Adjuntar el PDF de este plano'), { target: { files: [otro] } });
    expect(await screen.findByText(/Este PDF no es idéntico al original\. Tiene sus mismas páginas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este PDF para este plano' }));
    await waitFor(() => expect((st().planos[0] as PlanoMeta).huellasAnteriores).toEqual([antes.huella]));
    const p = st().planos[0] as PlanoMeta;
    expect(p).toMatchObject({ archivo: 'reexportado.pdf', escalas: { 1: { rev: escalaDe(antes, 1)!.rev } } });
    expect(escalaDe(p, 1)!.comprobacion).toBeUndefined();
    expect(useToastStore.getState().msg).toMatch(/^Plano reenlazado(: .*)?\. Comprueba la escala de su página calibrada con otra cota antes de medir\.$/);
    expect(await screen.findByText(/sin comprobar/)).toBeInTheDocument(); // el chip de escala
    expect(await screen.findByText('Comprueba la escala de esta página con otra cota antes de medir.')).toBeInTheDocument();
  });

  it('[A1] otro PDF con otras páginas: solo como revisión nueva; la vieja avisa de la revisión más nueva', async () => {
    await montar();
    await __resetPlanosForTests();
    act(() => usePlanoUiStore.getState().abrirPlano(null));
    act(() => usePlanoUiStore.getState().abrirPlano(EJEMPLO.planoId, 1));
    await screen.findByText(/No está el PDF/);
    const dos = new File([pdfMinimo([{ mediaBox: A3 }, { mediaBox: A3 }])], 'rev-b.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Adjuntar el PDF de este plano'), { target: { files: [dos] } });
    expect(await screen.findByText(/No tiene sus mismas páginas: solo puede entrar como revisión nueva/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar este PDF para este plano' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar como revisión nueva' }));
    await waitFor(() => expect(st().planos).toHaveLength(2));
    const nueva = st().planos[1] as PlanoMeta;
    expect(nueva).toMatchObject({ sustituye: EJEMPLO.planoId, revision: 'Rev. B', paginas: 2 });
    expect(usePlanoUiStore.getState().planoId).toBe(nueva.id);
    expect(useToastStore.getState().msg).toBe('Rev. B adjunta: calibra sus páginas para medir. «Planta baja (ejemplo)» conserva sus líneas.');
    // la vieja: aviso con [Abrir]
    act(() => usePlanoUiStore.getState().abrirPlano(EJEMPLO.planoId, 1));
    expect(await screen.findByText('Hay una revisión más nueva: Rev. B.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(usePlanoUiStore.getState().planoId).toBe(nueva.id);
    expect(await screen.findByRole('button', { name: /Planta baja \(ejemplo\) · Rev\. B/ })).toBeInTheDocument();
  });

  it('[A1] menú ⋯ «Adjuntar revisión…»: plano nuevo con la revisión siguiente; el viejo, sus escalas y líneas, intactos', async () => {
    const { lienzo, visor } = await montar();
    herramienta('Longitud');
    clic(lienzo, EJEMPLO.tabiqueDe);
    clic(lienzo, EJEMPLO.tabiqueA);
    tecla(visor, 'Enter');
    tecla(screen.getByRole('textbox', { name: 'Comentario de la línea' }), 'Enter');
    await screen.findByText(/Línea 1 ·/);
    const viejo = structuredClone(st().planos[0] as PlanoMeta);
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de planos' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Adjuntar revisión/ }));
    const revB = new File([pdfMinimo([{ mediaBox: A3, textos: [{ x: 60, y: 60, tamano: 10, texto: 'Rev B' }] }])], 'rev-b.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Adjuntar revisión PDF'), { target: { files: [revB] } });
    await waitFor(() => expect(st().planos).toHaveLength(2));
    expect(st().planos[0]).toEqual(viejo);
    expect((P(EJEMPLO.tabique).med[0]!.origen as OrigenPlano).planoId).toBe(EJEMPLO.planoId);
    expect(st().planos[1]).toMatchObject({ sustituye: EJEMPLO.planoId, revision: 'Rev. B', escalas: {} });
    expect(await screen.findByText('Calibra esta página para medir longitudes y superficies. Recuento funciona sin escala.')).toBeInTheDocument();
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
