import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectBackup } from './ProjectBackup';
import { huellaDe } from '../../core/sha256';
import { toSerializable, useObraStore, useToastStore } from '../../store';
import { parseObraJson, usePersistStore, useSessionStore, type ImportarResult } from '../../persist';
import { __resetPlanosForTests, guardarPlano } from '../../persist/planos';
import { EscritorZip } from '../../persist/zip';
import a0 from '../../test/fixtures/planos/obra-v6-a0.json';

// Por defecto, la implementación real; cada test puede forzar un resultado.
const importarSobreActiva = vi.hoisted(() => vi.fn());
const volverAObraGuardada = vi.hoisted(() => vi.fn());
vi.mock('../../persist', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../persist')>();
  importarSobreActiva.mockImplementation(real.importarSobreActiva);
  volverAObraGuardada.mockImplementation(real.volverAObraGuardada);
  return { ...real, importarSobreActiva, volverAObraGuardada };
});

const state = () => useObraStore.getState();

function importableJson(denominacion: string): File {
  const data = {
    ...toSerializable(state()),
    obra: { denominacion, direccion: '', localidad: '' },
  };
  return new File([JSON.stringify(data)], 'obra.json', { type: 'application/json' });
}

beforeEach(() => {
  state().reset();
  usePersistStore.setState({ durability: 'unknown' });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ProjectBackup (F6.3)', () => {
  it('Exportar dispara la descarga del .json', () => {
    render(<ProjectBackup />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('importar un archivo válido y confirmar reemplaza la obra y cierra', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);

    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), {
      target: { files: [importableJson('Obra Importada')] },
    });

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(confirm).toHaveBeenCalled();
    expect(state().obra.denominacion).toBe('Obra Importada');
    // backup previo + (export no): al menos una descarga (el backup antes de pisar)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('si el usuario cancela la confirmación no se reemplaza nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);

    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), {
      target: { files: [importableJson('No debería entrar')] },
    });

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(onImported).not.toHaveBeenCalled();
    expect(state().obra.denominacion).toContain('C/ Mayor 14'); // intacta
  });

  it('un archivo malformado muestra error y no toca la obra', async () => {
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);

    const bad = new File(['{ esto no es json'], 'x.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), {
      target: { files: [bad] },
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onImported).not.toHaveBeenCalled();
    expect(state().obra.denominacion).toContain('C/ Mayor 14');
  });

  it('una versión futura muestra error legible', async () => {
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);

    const future = { ...toSerializable(state()), schemaVersion: 99 };
    const file = new File([JSON.stringify(future)], 'f.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/versión más nueva/i));
    expect(onImported).not.toHaveBeenCalled();
  });

  it('sin saber aún si el navegador protege las obras, no dice nada', () => {
    render(<ProjectBackup />);
    expect(screen.queryByText(/borrar(á)? tus obras/)).not.toBeInTheDocument();
  });

  it('avisa si el navegador puede borrar las obras', () => {
    usePersistStore.setState({ durability: 'best-effort' });
    render(<ProjectBackup />);
    expect(screen.getByText(/puede borrar tus obras/)).toHaveTextContent(/marcadores/);
  });

  it('dice que están protegidas cuando el navegador lo concede', () => {
    usePersistStore.setState({ durability: 'persisted' });
    render(<ProjectBackup />);
    expect(screen.getByText(/no borrará tus obras/)).toBeInTheDocument();
  });

  it('enseña cuándo se descargó la última copia de la obra', () => {
    useSessionStore.setState({
      activeId: 'o1',
      obras: [{ id: 'o1', name: 'O', savedAt: 'x', schemaVersion: 5 }],
    });
    const { rerender } = render(<ProjectBackup />);
    expect(screen.getByText('Aún no has hecho ninguna copia')).toBeInTheDocument();
    useSessionStore.setState({
      obras: [{ id: 'o1', name: 'O', savedAt: 'x', schemaVersion: 5, ultimaCopia: new Date().toISOString() }],
    });
    rerender(<ProjectBackup />);
    expect(screen.getByText('Última copia descargada: hoy')).toBeInTheDocument();
    useSessionStore.setState({ obras: [], activeId: null });
  });

  it('si la importada no se guarda: no cierra, lo dice y deja volver a la anterior', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fallo: ImportarResult = { kind: 'sin-guardar', puedeVolver: true };
    importarSobreActiva.mockResolvedValueOnce(fallo);
    volverAObraGuardada.mockResolvedValueOnce(true);
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);

    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), {
      target: { files: [importableJson('Obra Importada')] },
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/NO se ha podido guardar/));
    expect(onImported).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la obra anterior' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(volverAObraGuardada).toHaveBeenCalledTimes(1);
  });

  it('si la actual no se pudo guardar: no importa y lo dice (sin opción de volver)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    importarSobreActiva.mockResolvedValueOnce({ kind: 'sin-guardar-actual' });
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), {
      target: { files: [importableJson('Obra Importada')] },
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no se ha importado nada/),
    );
    expect(screen.queryByRole('button', { name: 'Volver a la obra anterior' })).toBeNull();
    expect(onImported).not.toHaveBeenCalled();
  });
});

describe('ProjectBackup · copia .zip con planos [A1]', () => {
  const pdf = (t: string) => new TextEncoder().encode(`%PDF-1.4\n${t}\n%%EOF`).buffer;
  /** La obra A0 con la huella de `bytes`; con `guardar`, esos bytes en el almacén. */
  async function obraConPlano(bytes: ArrayBuffer, guardar = true): Promise<string> {
    const h = await huellaDe(bytes);
    const huellaA0 = (a0 as { planos: { huella: string }[] }).planos[0]!.huella;
    state().loadObra(parseObraJson(JSON.stringify(a0).split(huellaA0).join(h)));
    if (guardar) await guardarPlano(h, bytes, 'application/pdf');
    return h;
  }
  async function zipDe(entradas: [string, Uint8Array][]): Promise<File> {
    const z = new EscritorZip();
    for (const [n, d] of entradas) await z.anadir(n, d, n === 'obra.json');
    return new File([z.cerrar()], 'copia.zip', { type: 'application/zip' });
  }

  beforeEach(async () => {
    await __resetPlanosForTests();
    useToastStore.setState({ msg: null, action: null, tick: 0 });
  });

  it('con planos, la copia completa (.zip) es la principal y dice su tamaño', async () => {
    await obraConPlano(pdf('planta'));
    render(<ProjectBackup />);
    expect(screen.getByText('Calculando…')).toBeInTheDocument();
    expect(await screen.findByText(/MB · 1 plano$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solo presupuesto (.json)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copia completa con planos (.zip)' }));
    await waitFor(() => expect(useToastStore.getState().msg).toMatch(/^Copia completa \(.* MB\)$/));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('un plano sin su PDF en este navegador: avisa de que saldrá incompleta', async () => {
    await obraConPlano(pdf('no está'), false);
    render(<ProjectBackup />);
    expect(await screen.findByText(/Saldrá incompleta: falta Planta primera/)).toBeInTheDocument();
  });

  it('un .zip con un nombre desconocido se rechaza con su causa', async () => {
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);
    const file = await zipDe([
      ['obra.json', new TextEncoder().encode(JSON.stringify(toSerializable(state())))],
      ['notas.txt', new Uint8Array([1])],
    ]);
    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se puede restaurar esta copia. Nombre desconocido en la copia: notas.txt',
      ),
    );
    expect(onImported).not.toHaveBeenCalled();
  });

  it('restauración parcial: no cierra y enseña el resumen plano a plano, con [Adjuntar PDF]', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const h = await obraConPlano(pdf('buena'), false);
    const file = await zipDe([
      ['obra.json', new TextEncoder().encode(JSON.stringify(toSerializable(state())))],
      [`planos/${h}.pdf`, new Uint8Array(pdf('manipulada'))], // otros bytes con ese nombre
    ]);
    state().reset();
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), { target: { files: [file] } });

    expect(await screen.findByText('Obra restaurada · planos disponibles: 0 de 1')).toBeInTheDocument();
    expect(screen.getByText(/el PDF no cuadra con su huella: vuelve a adjuntarlo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjuntar PDF' })).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
    expect(state().planos).toHaveLength(1); // la obra sí está restaurada
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/^Restaurar esta copia \(con 1 plano\)/));
  });

  it('una restauración completa cierra y lo dice', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const bytes = pdf('completa');
    const h = await obraConPlano(bytes, false);
    const file = await zipDe([
      ['obra.json', new TextEncoder().encode(JSON.stringify(toSerializable(state())))],
      [`planos/${h}.pdf`, new Uint8Array(bytes)],
    ]);
    state().reset();
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Importar copia (.zip o .json)'), { target: { files: [file] } });
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(useToastStore.getState().msg).toBe('Copia restaurada: la obra y 1 plano');
  });
});
