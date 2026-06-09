import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { CertificacionesView } from './CertificacionesView';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('CertificacionesView (F4.1)', () => {
  it('muestra la cert en curso, partidas y el % global', () => {
    render(<CertificacionesView />);
    expect(screen.getByText(/Certificación nº/)).toBeInTheDocument();
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // p111 en la tabla
    expect(screen.getByText('Ejecución global')).toBeInTheDocument();
  });

  it('el toggle cambia la cabecera de columna (a origen / esta cert)', () => {
    render(<CertificacionesView />);
    expect(screen.getByText('Ejec. a origen')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Esta certificación'));
    expect(screen.getByText('Ejec. esta cert.')).toBeInTheDocument();
  });

  it('"Nueva certificación" añade una cert al histórico', () => {
    render(<CertificacionesView />);
    const n0 = useObraStore.getState().certs.length;
    fireEvent.click(screen.getByText(/Certificación nº/)); // abre el selector
    fireEvent.click(screen.getByText('Nueva certificación'));
    expect(useObraStore.getState().certs).toHaveLength(n0 + 1);
  });
});
