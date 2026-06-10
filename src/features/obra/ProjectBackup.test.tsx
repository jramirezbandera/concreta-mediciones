import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectBackup } from './ProjectBackup';
import { toSerializable, useObraStore } from '../../store';

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

    fireEvent.change(screen.getByLabelText('Importar proyecto .json'), {
      target: { files: [importableJson('Obra Importada')] },
    });

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalled();
    expect(state().obra.denominacion).toBe('Obra Importada');
    // backup previo + (export no): al menos una descarga (el backup antes de pisar)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('si el usuario cancela la confirmación no se reemplaza nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onImported = vi.fn();
    render(<ProjectBackup onImported={onImported} />);

    fireEvent.change(screen.getByLabelText('Importar proyecto .json'), {
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
    fireEvent.change(screen.getByLabelText('Importar proyecto .json'), {
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
    fireEvent.change(screen.getByLabelText('Importar proyecto .json'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/versión más nueva/i));
    expect(onImported).not.toHaveBeenCalled();
  });
});
