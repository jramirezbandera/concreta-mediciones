import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintDoc } from './PrintDoc';
import { useObraStore } from '../../store';

beforeEach(() => {
  useObraStore.getState().reset();
  window.print = vi.fn();
});
afterEach(() => {
  document.body.classList.remove('printing');
});

describe('PrintDoc (F7.1) — doc de impresión bajo demanda', () => {
  it('monta el doc en el body (tema claro), imprime UNA vez y oculta la app', async () => {
    const onDone = vi.fn();
    const { unmount } = render(
      <StrictMode>
        <PrintDoc target={{ kind: 'resumen' }} onDone={onDone} />
      </StrictMode>,
    );
    expect(document.body.classList.contains('printing')).toBe(true);
    const doc = document.body.querySelector('.print-doc')!;
    expect(doc).toBeTruthy();
    expect(doc.getAttribute('data-theme')).toBe('light');
    // espera fuentes + doble rAF; la guarda evita el doble print de StrictMode
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
    unmount();
    expect(document.body.classList.contains('printing')).toBe(false);
    expect(document.body.querySelector('.print-doc')).toBeNull();
  });

  it('cierra con afterprint (y el doc no lleva inputs)', async () => {
    const onDone = vi.fn();
    render(<PrintDoc target={{ kind: 'presupuesto' }} onDone={onDone} />);
    await waitFor(() => expect(window.print).toHaveBeenCalled());
    expect(document.body.querySelector('.print-doc input, .print-doc textarea')).toBeNull();
    window.dispatchEvent(new Event('afterprint'));
    expect(onDone).toHaveBeenCalled();
  });

  it('el doc de presupuesto lleva mediciones embebidas y el PEM del motor', async () => {
    render(<PrintDoc target={{ kind: 'presupuesto' }} onDone={() => {}} />);
    expect(screen.getByText('Presupuesto y mediciones')).toBeInTheDocument();
    expect(screen.getByText('Presupuesto de Ejecución Material (PEM)')).toBeInTheDocument();
    expect(screen.getByText('26.291,91 €')).toBeInTheDocument(); // PEM seed
    expect(screen.getAllByText('Mediciones').length).toBeGreaterThan(0);
    await waitFor(() => expect(window.print).toHaveBeenCalled());
  });

  it('el doc de resumen usa la maqueta de papel (tabla + bloque económico + pie legal)', async () => {
    render(<PrintDoc target={{ kind: 'resumen' }} onDone={() => {}} />);
    const doc = document.body.querySelector('.print-doc')!;
    // Mismo vocabulario que presupuesto/cert: tabla del documento, no la
    // tarjeta de pantalla; y el total en el bloque económico, no en titular.
    expect(doc.querySelector('.pd-table')).toBeTruthy();
    expect(doc.querySelector('.pd-summary-big')).toBeTruthy();
    expect(screen.getByText('Presupuesto de Ejecución Material (PEM)')).toBeInTheDocument();
    expect(screen.getByText('26.291,91 €')).toBeInTheDocument(); // PEM seed
    expect(screen.getByText('34.416,11 €')).toBeInTheDocument(); // base de licitación
    expect(
      screen.getByText(/TREINTA Y CUATRO MIL CUATROCIENTOS DIECISÉIS EUROS con ONCE CÉNTIMOS/),
    ).toBeInTheDocument();
    await waitFor(() => expect(window.print).toHaveBeenCalled());
  });

  it('el doc de certificación llega al líquido y estampa el periodo', async () => {
    render(<PrintDoc target={{ kind: 'cert', index: 2 }} onDone={() => {}} />);
    expect(screen.getByText('Certificación de obra nº 3')).toBeInTheDocument();
    expect(screen.getByText('Líquido a abonar')).toBeInTheDocument();
    expect(screen.getByText('Certificado anterior')).toBeInTheDocument();
    await waitFor(() => expect(window.print).toHaveBeenCalled());
  });
});
