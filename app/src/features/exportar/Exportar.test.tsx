import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { useObraStore } from '../../store';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('ExportModal (F7.1/F7.2) — "mostrar solo lo que funciona"', () => {
  const noop = () => {};

  it('lista los docs construidos + una fila por certificación', () => {
    render(<ExportModal open onClose={noop} onExportPdf={noop} onExportXlsx={noop} />);
    expect(screen.getByText('Presupuesto y mediciones')).toBeInTheDocument();
    expect(screen.getByText('Resumen de presupuesto')).toBeInTheDocument();
    expect(screen.getByText('Certificaciones de obra')).toBeInTheDocument();
    expect(screen.getByText('Certificación nº 1')).toBeInTheDocument();
    expect(screen.getByText('Certificación nº 3')).toBeInTheDocument();
  });

  it('chips PDF + Excel por fila; DOCX/BC3 aún no (llegan al shipear su slice)', () => {
    render(<ExportModal open onClose={noop} onExportPdf={noop} onExportXlsx={noop} />);
    // 2 docs + 3 certs del seed = 5 chips de cada formato construido.
    expect(screen.getAllByRole('button', { name: /a PDF$/ })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /a Excel$/ })).toHaveLength(5);
    expect(screen.queryByText('Word')).not.toBeInTheDocument();
    expect(screen.queryByText('BC3')).not.toBeInTheDocument();
  });

  it('el chip PDF dispara onExportPdf con su target y cierra el modal', () => {
    const onClose = vi.fn();
    const onExportPdf = vi.fn();
    render(<ExportModal open onClose={onClose} onExportPdf={onExportPdf} onExportXlsx={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Resumen de presupuesto» a PDF' }));
    expect(onExportPdf).toHaveBeenCalledWith({ kind: 'resumen' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Certificación nº 2» a PDF' }));
    expect(onExportPdf).toHaveBeenCalledWith({ kind: 'cert', index: 1 });
  });

  it('el chip Excel dispara onExportXlsx con su target y cierra el modal (F7.2)', () => {
    const onClose = vi.fn();
    const onExportXlsx = vi.fn();
    render(<ExportModal open onClose={onClose} onExportPdf={noop} onExportXlsx={onExportXlsx} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Exportar «Presupuesto y mediciones» a Excel' }),
    );
    expect(onExportXlsx).toHaveBeenCalledWith({ kind: 'presupuesto' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Certificación nº 1» a Excel' }));
    expect(onExportXlsx).toHaveBeenCalledWith({ kind: 'cert', index: 0 });
  });

  it('la fila de cert estampa la fecha del snapshot de precios (F7.0)', () => {
    useObraStore.getState().addCert(); // nace congelada, con snapshotAt
    render(<ExportModal open onClose={noop} onExportPdf={noop} onExportXlsx={noop} />);
    expect(screen.getByText(/precios congelados/)).toBeInTheDocument();
  });
});
