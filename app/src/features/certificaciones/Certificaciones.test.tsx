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
    render(<CertificacionesView compact={false} />);
    expect(screen.getByText(/Certificación nº/)).toBeInTheDocument();
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // p111 en la tabla
    expect(screen.getByText('Ejecución global')).toBeInTheDocument();
  });

  it('el toggle cambia la cabecera de columna (a origen / esta cert)', () => {
    render(<CertificacionesView compact={false} />);
    expect(screen.getByText('Ejec. a origen')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Esta certificación'));
    expect(screen.getByText('Ejec. esta cert.')).toBeInTheDocument();
  });

  it('"Nueva certificación" añade una cert al histórico', () => {
    render(<CertificacionesView compact={false} />);
    const n0 = useObraStore.getState().certs.length;
    fireEvent.click(screen.getByText(/Certificación nº/)); // abre el selector
    fireEvent.click(screen.getByText('Nueva certificación'));
    expect(useObraStore.getState().certs).toHaveLength(n0 + 1);
  });

  it('el desplegable por partida muestra descripción y líneas (F4.2 #2)', () => {
    render(<CertificacionesView compact={false} />);
    expect(screen.queryByText('Zanjas de saneamiento')).toBeNull();
    fireEvent.click(screen.getByText('E02EM030')); // celda Nº de p111 → despliega
    expect(screen.getByText(/Mediciones/)).toBeInTheDocument();
    expect(screen.getByText('Zanjas de saneamiento')).toBeInTheDocument(); // línea de p111
  });

  it('marcar una línea suma su parcial a la cantidad ejecutada (F4.3 #3)', () => {
    render(<CertificacionesView compact={false} />);
    useObraStore.getState().setCurCert(0);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111
    const check = screen.getByLabelText(/Marcar línea ejecutada: Zanjas de saneamiento/);
    fireEvent.click(check);
    const s = useObraStore.getState();
    expect(s.certs[0]!.lineQty!.p111!['p111-m1']).toBe(61.2); // 1×85×0,6×1,2
    expect(s.certs[0]!.data.p111).toBe(61.2);
    fireEvent.click(check); // desmarca
    expect(useObraStore.getState().certs[0]!.lineQty?.p111).toBeUndefined();
  });

  it('teclear un % rellena la cantidad ejecutada a origen (F4.2 #1)', () => {
    render(<CertificacionesView compact={false} />);
    // p111: ofertada 124,65; su % es el primero de la tabla.
    fireEvent.click(screen.getAllByLabelText('% de ejecución')[0]!);
    const input = screen.getAllByLabelText('% de ejecución')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const s = useObraStore.getState();
    expect(s.certs[s.curCert]!.data.p111).toBe(124.65); // 100% de la ofertada
  });

  it('añadir un precio contradictorio crea una línea P.C. editable (F4.4)', () => {
    render(<CertificacionesView compact={false} />);
    useObraStore.getState().setCurCert(0);
    fireEvent.click(screen.getAllByText('Añadir precio contradictorio')[0]!);
    expect(useObraStore.getState().certs[0]!.extras).toHaveLength(1);
    expect(screen.getByLabelText('Título del contradictorio')).toBeInTheDocument();
    expect(screen.getAllByText('P.C.').length).toBeGreaterThan(0);
  });

  it('en compacto rinde tarjetas (sin cabecera de tabla) y permite editar/marcar (F4.5)', () => {
    render(<CertificacionesView compact />);
    useObraStore.getState().setCurCert(0);
    // no hay cabecera de columnas de tabla en modo tarjetas (sí el label de tarjeta)
    expect(screen.queryByText('Nº · Código')).toBeNull();
    // la partida sigue presente y su % editable funciona
    expect(screen.getByText('E02EM030')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('% de ejecución')[0]!);
    const input = screen.getAllByLabelText('% de ejecución')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useObraStore.getState().certs[0]!.data.p111).toBe(124.65);
    // alta de contradictorio también desde tarjetas
    fireEvent.click(screen.getAllByText('Añadir precio contradictorio')[0]!);
    expect(useObraStore.getState().certs[0]!.extras).toHaveLength(1);
  });
});
