import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useObraStore } from '../../store';
import { ReferenciaImportModal } from './ReferenciaImportModal';

beforeEach(() => {
  useObraStore.getState().reset();
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
    expect(screen.getByRole('button', { name: 'Añadir como referencia' })).toBeDisabled();
  });

  it('no renderiza nada cuando está cerrado', () => {
    render(<ReferenciaImportModal open={false} onClose={() => {}} compact={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
