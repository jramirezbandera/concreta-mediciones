import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useObraStore, useToastStore } from '../../store';
import { importObraAsReference, useSessionStore } from '../../persist';
import { ReferenciaImportModal } from './ReferenciaImportModal';

// Solo se sustituye el guardado como referencia (IndexedDB): el resto de la
// persistencia (sessionStore) es el real.
vi.mock('../../persist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../persist')>()),
  importObraAsReference: vi.fn(),
}));
const importRef = vi.mocked(importObraAsReference);

/** .bc3 mínimo y válido (un capítulo, una partida de 5 € × 10): docs/spike/samples
 *  no viaja en git, así que los tests de E0 no dependen de él. */
function bc3File(name = 'base mini.bc3'): File {
  const recs = [
    '~V|prog|FIEBDC-3/2016|prog|||ANSI||2|||',
    '~C|R##||Base mini|50|010101|0|',
    '~C|C1#||Cap uno|50|010101|0|',
    '~C|P1|m2|Partida uno|5|010101|0|',
    '~D|R##|C1\\1\\1|',
    '~D|C1#|P1\\1\\10|',
  ];
  return new File([new TextEncoder().encode(recs.join('\r\n') + '\r\n')], name);
}

function soltar(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const confirmar = () => screen.getByRole('button', { name: 'Añadir como referencia' });

beforeEach(() => {
  useObraStore.getState().reset();
  useSessionStore.setState({ obras: [], activeId: null, switching: false });
  useToastStore.setState({ msg: null });
  importRef.mockReset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReferenciaImportModal', () => {
  it('abre como diálogo NO destructivo (añade, no reemplaza) con el confirmar deshabilitado sin archivo', () => {
    render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Añadir base de referencia');
    expect(dialog).toHaveTextContent('no reemplaza la actual');
    // Nada que reemplazar: no debe haber copy de "Reemplazar".
    expect(dialog).not.toHaveTextContent('Reemplazar');
    // Sin .bc3 parseado todavía → confirmar deshabilitado (no crea obras vacías).
    expect(confirmar()).toBeDisabled();
  });

  it('no renderiza nada cuando está cerrado', () => {
    render(<ReferenciaImportModal open={false} onClose={() => {}} compact={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/* Contrato de regresión E0 (docs/plan-bases-oficiales.md, R7/D11): lo que hace
   hoy el modal y las bases oficiales no pueden cambiar. */
describe('ReferenciaImportModal — contrato de regresión (E0)', () => {
  it('(1) con obra activa, soltar un .bc3 y confirmar lo guarda como referencia, lo selecciona y cierra', async () => {
    useSessionStore.setState({ activeId: 'obra-activa' });
    importRef.mockResolvedValue('ref-1');
    const onClose = vi.fn();
    const capitulosAntes = useObraStore.getState().chapters.length;
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(importRef).toHaveBeenCalledTimes(1);
    expect(importRef.mock.calls[0]?.[0].obra.denominacion).toBe('Base mini');
    const s = useObraStore.getState();
    expect(s.refSourceId).toBe('obra:ref-1');
    expect(s.lateral).toBe('ref'); // panel Referencia abierto
    expect(s.chapters).toHaveLength(capitulosAntes); // la obra activa no se toca
    expect(useToastStore.getState().msg).toBe('«Base mini» añadida como referencia');
  });

  it('(2) con la app vacía, el .bc3 soltado se carga como presupuesto (loadObra)', async () => {
    const onClose = vi.fn();
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(importRef).not.toHaveBeenCalled();
    const s = useObraStore.getState();
    expect(s.chapters).toHaveLength(1);
    expect(s.obra.denominacion).toBe('Base mini');
    expect(useToastStore.getState().msg).toBe('«Base mini» cargada');
  });

  it('(3) si falla el guardado, enseña el error genérico y deja reintentar', async () => {
    useSessionStore.setState({ activeId: 'obra-activa' });
    importRef.mockRejectedValueOnce(new Error('IDB caído')).mockResolvedValueOnce('ref-2');
    const onClose = vi.fn();
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    expect(
      await screen.findByText('No se pudo guardar la obra de referencia. Inténtalo de nuevo.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmar()).toBeEnabled();

    fireEvent.click(confirmar());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(importRef).toHaveBeenCalledTimes(2);
    expect(useObraStore.getState().refSourceId).toBe('obra:ref-2');
  });

  it('(4) cerrar y reabrir empieza en blanco', async () => {
    const { container, rerender } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();

    rerender(<ReferenciaImportModal open={false} onClose={() => {}} compact={false} />);
    rerender(<ReferenciaImportModal open onClose={() => {}} compact={false} />);

    expect(screen.queryByText('base mini.bc3')).toBeNull();
    expect(confirmar()).toBeDisabled();
  });
});
