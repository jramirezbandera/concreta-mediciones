import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObraModal } from './ObraModal';
import { useObraStore } from '../../store';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('ObraModal (F6.2)', () => {
  it('precarga la denominación de la obra en su campo', () => {
    render(<ObraModal open onClose={() => {}} />);
    expect(screen.getByDisplayValue('Reforma vivienda C/ Mayor 14')).toBeInTheDocument();
  });

  it('editar un campo plano actualiza el store', () => {
    render(<ObraModal open onClose={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('Reforma vivienda C/ Mayor 14'), {
      target: { value: 'Nueva obra' },
    });
    expect(useObraStore.getState().obra.denominacion).toBe('Nueva obra');
  });

  it('editar un campo anidado (promotor) crea la rama en el store', () => {
    render(<ObraModal open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('NIF / CIF'), { target: { value: 'B99' } });
    expect((useObraStore.getState().obra.promotor as { nif: string }).nif).toBe('B99');
  });

  it('el botón Hecho cierra', () => {
    const onClose = vi.fn();
    render(<ObraModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hecho' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
