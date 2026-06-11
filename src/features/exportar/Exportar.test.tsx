import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { useObraStore } from '../../store';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('ExportModal (F7.1–F7.4) — "mostrar solo lo que funciona"', () => {
  const noop = () => {};
  const abierto = (over: Partial<Parameters<typeof ExportModal>[0]> = {}) => (
    <ExportModal
      open
      onClose={noop}
      onExportPdf={noop}
      onExportXlsx={noop}
      onExportDocx={noop}
      onExportBc3={noop}
      {...over}
    />
  );

  it('lista la obra completa (BC3) + los docs construidos + una fila por certificación', () => {
    render(abierto());
    expect(screen.getByText('Obra completa')).toBeInTheDocument();
    expect(screen.getByText('Presupuesto y mediciones')).toBeInTheDocument();
    expect(screen.getByText('Resumen de presupuesto')).toBeInTheDocument();
    expect(screen.getByText('Certificaciones de obra')).toBeInTheDocument();
    expect(screen.getByText('Certificación nº 1')).toBeInTheDocument();
    expect(screen.getByText('Certificación nº 3')).toBeInTheDocument();
  });

  it('chips PDF + Word + Excel por fila y UN chip BC3 de cabecera (F7.4)', () => {
    render(abierto());
    // 2 docs + 3 certs del seed = 5 chips de cada formato por-listado.
    expect(screen.getAllByRole('button', { name: /a PDF$/ })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /a Word$/ })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /a Excel$/ })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /BC3/ })).toHaveLength(1);
  });

  it('el chip BC3 dispara onExportBc3 y cierra el modal (F7.4)', () => {
    const onClose = vi.fn();
    const onExportBc3 = vi.fn();
    render(abierto({ onClose, onExportBc3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Obra completa» a BC3 (FIEBDC-3)' }));
    expect(onExportBc3).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('el chip PDF dispara onExportPdf con su target y cierra el modal', () => {
    const onClose = vi.fn();
    const onExportPdf = vi.fn();
    render(abierto({ onClose, onExportPdf }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Resumen de presupuesto» a PDF' }));
    expect(onExportPdf).toHaveBeenCalledWith({ kind: 'resumen' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Certificación nº 2» a PDF' }));
    expect(onExportPdf).toHaveBeenCalledWith({ kind: 'cert', index: 1 });
  });

  it('el chip Excel dispara onExportXlsx con su target y cierra el modal (F7.2)', () => {
    const onClose = vi.fn();
    const onExportXlsx = vi.fn();
    render(abierto({ onClose, onExportXlsx }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Exportar «Presupuesto y mediciones» a Excel' }),
    );
    expect(onExportXlsx).toHaveBeenCalledWith({ kind: 'presupuesto' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Certificación nº 1» a Excel' }));
    expect(onExportXlsx).toHaveBeenCalledWith({ kind: 'cert', index: 0 });
  });

  it('el chip Word dispara onExportDocx con su target y cierra el modal (F7.3)', () => {
    const onClose = vi.fn();
    const onExportDocx = vi.fn();
    render(abierto({ onClose, onExportDocx }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Resumen de presupuesto» a Word' }));
    expect(onExportDocx).toHaveBeenCalledWith({ kind: 'resumen' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar «Certificación nº 3» a Word' }));
    expect(onExportDocx).toHaveBeenCalledWith({ kind: 'cert', index: 2 });
  });

  it('la fila de cert estampa la fecha del snapshot de precios (F7.0)', () => {
    useObraStore.getState().addCert(); // nace congelada, con snapshotAt
    render(abierto());
    expect(screen.getByText(/precios congelados/)).toBeInTheDocument();
  });
});
