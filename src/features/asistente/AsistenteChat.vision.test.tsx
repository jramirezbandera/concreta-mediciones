import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AsistenteChat } from './AsistenteChat';
import { __resetAiSettingsForTests } from '../../ai';
import { useObraStore } from '../../store';

/* Adjuntar imágenes pasa por prepareImage (Image/canvas/URL), que jsdom no
   implementa: stubs mínimos para que el composer procese la foto (rama directa
   por FileReader, sin canvas). Ver imagePrep.test.ts. */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 100;
  naturalHeight = 100;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  __resetAiSettingsForTests();
  useObraStore.getState().reset();
  vi.stubGlobal('Image', MockImage);
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function pngFile(name = 'medicion.png'): File {
  return new File([new Uint8Array(8)], name, { type: 'image/png' });
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('no hay input de fichero');
  return input as HTMLInputElement;
}

describe('AsistenteChat · adjuntar fotos (visión F-A5)', () => {
  it('adjuntar una foto muestra su miniatura y habilita enviar sin texto', async () => {
    const { container } = render(<AsistenteChat />);
    const send = screen.getByRole('button', { name: 'Enviar' });
    expect(send).toBeDisabled(); // sin texto ni imagen

    fireEvent.change(fileInput(container), { target: { files: [pngFile()] } });

    expect(await screen.findByAltText('Imagen adjunta')).toBeInTheDocument();
    expect(send).toBeEnabled(); // solo con la imagen, aunque el texto esté vacío
  });

  it('quitar la miniatura la elimina y vuelve a deshabilitar enviar', async () => {
    const { container } = render(<AsistenteChat />);
    fireEvent.change(fileInput(container), { target: { files: [pngFile()] } });
    expect(await screen.findByAltText('Imagen adjunta')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Quitar imagen' }));

    expect(screen.queryByAltText('Imagen adjunta')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('al llegar al cupo de 3 imágenes, el botón de adjuntar se deshabilita', async () => {
    const { container } = render(<AsistenteChat />);
    fireEvent.change(fileInput(container), {
      target: { files: [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')] },
    });

    await waitFor(() => expect(screen.getAllByAltText('Imagen adjunta')).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Adjuntar foto' })).toBeDisabled();
  });

  it('la foto adjunta aparece en la fila del usuario tras enviar', async () => {
    const { container } = render(<AsistenteChat />);
    fireEvent.change(fileInput(container), { target: { files: [pngFile()] } });
    await screen.findByAltText('Imagen adjunta');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    // Sin clave configurada el turno acaba en error, pero la fila del usuario
    // (con su miniatura) ya se registró en el log.
    const userRow = await screen.findByText('Tú');
    expect(within(userRow.parentElement as HTMLElement).getByAltText('Imagen adjunta')).toBeInTheDocument();
  });
});
