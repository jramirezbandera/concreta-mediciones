import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL, useObraStore } from '../../store';
import { CertificacionesView } from './CertificacionesView';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('CertSummary — % con decimales (auditoría B-01/B-02)', () => {
  it('B-01: teclear una retención con décimas la guarda exacta (2,5 % → 0,025)', () => {
    render(<CertificacionesView compact={false} />);
    useObraStore.getState().setCurCert(0);
    fireEvent.click(screen.getByLabelText('Retención %')); // abre el editor
    const input = screen.getByLabelText('Retención %');
    fireEvent.change(input, { target: { value: '2,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // round2(v/100) cuantizaba la fracción a 2 dec → guardaba 0.03 (¡3 %!)
    expect(useObraStore.getState().certs[0]!.retencion).toBe(0.025);
  });

  it('B-02: un ajuste porcentual admite milésimas de % (10,197 % → 0,10197)', () => {
    render(<CertificacionesView compact={false} />);
    useObraStore.getState().setCurCert(0);
    fireEvent.click(screen.getByText('Añadir ajuste'));
    fireEvent.click(screen.getByTitle('Porcentaje sobre la base')); // conmuta a %
    fireEvent.click(screen.getByLabelText('Porcentaje del ajuste')); // abre el editor
    const input = screen.getByLabelText('Porcentaje del ajuste');
    fireEvent.change(input, { target: { value: '10,197' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const a = useObraStore.getState().certs[0]!.ajustes![0]!;
    expect(a.tipo).toBe('pct');
    expect(a.valor).toBe(0.10197); // round2(v/100) lo dejaba en 0.1 (10 %)
  });
});

describe('aislamiento por selección del árbol (paridad con Presupuesto)', () => {
  it('con «Toda la obra» pinta todas las secciones de capítulo', () => {
    useObraStore.getState().setActive(ALL);
    render(<CertificacionesView compact={false} />);
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // cap 01
    expect(screen.getByText('E04CM040')).toBeInTheDocument(); // cap 02
  });

  it('un capítulo activo aísla su sección (las demás no se pintan)', () => {
    useObraStore.getState().setActive('02');
    render(<CertificacionesView compact={false} />);
    expect(screen.getByText('E04CM040')).toBeInTheDocument();
    expect(screen.queryByText('E02EM030')).toBeNull(); // cap 01 fuera
  });

  it('un sub activo aísla su subárbol; sin alta de P.C. (es del capítulo)', () => {
    useObraStore.getState().setActive('01.01');
    render(<CertificacionesView compact={false} />);
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // 1.1 dentro
    expect(screen.queryByText('E02RW040')).toBeNull(); // 1.2 fuera
    expect(screen.queryByText('Añadir precio contradictorio')).toBeNull();
  });

  it('un capítulo VACÍO aislado permite añadir precios contradictorios', () => {
    useObraStore.getState().addChapter('Capítulo sin partidas');
    const empty = useObraStore.getState().chapters.at(-1)!;
    useObraStore.getState().setActive(empty.id);
    render(<CertificacionesView compact={false} />);
    // Estado vacío + afordancia de alta conviven (antes era un callejón sin salida).
    expect(screen.getByText(/no tiene partidas/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Añadir precio contradictorio'));
    const s = useObraStore.getState();
    const extras = s.certs[s.curCert]!.extras!;
    expect(extras).toHaveLength(1);
    expect(extras[0]!.chapterId).toBe(empty.id); // cuelga del capítulo vacío
  });

  it('un capítulo VACÍO se mantiene oculto en «Toda la obra» (hasta tener un P.C.)', () => {
    useObraStore.getState().addChapter('Capítulo sin partidas');
    useObraStore.getState().setActive(ALL);
    render(<CertificacionesView compact={false} />);
    expect(screen.queryByText('Capítulo sin partidas')).toBeNull(); // no ensucia la vista global
  });
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

  it('obra SIN partidas → "Nada que certificar todavía" + CTA al presupuesto (F8.3)', () => {
    useObraStore.setState({ partidas: {} });
    const onGoPresupuesto = vi.fn();
    render(<CertificacionesView compact={false} onGoPresupuesto={onGoPresupuesto} />);
    expect(screen.getByText('Nada que certificar todavía')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ir al presupuesto'));
    expect(onGoPresupuesto).toHaveBeenCalledTimes(1);
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

  it('D-09: una línea certificada y luego BORRADA de la medición sigue visible y desmarcable', () => {
    useObraStore.getState().setCurCert(0);
    useObraStore.getState().setCertLine('p111', 'p111-m1', 61.2); // certifica la línea
    useObraStore.getState().deleteMedLine('01', 'p111', 0); // …y se borra de la medición
    render(<CertificacionesView compact={false} />);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111
    // Antes no había fila: el importe quedaba sostenido por una línea invisible
    // y la única salida era el override manual (que arrasa todo el lineQty).
    expect(screen.getByText(/Línea eliminada de la medición/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Desmarcar línea eliminada de la medición'));
    expect(useObraStore.getState().certs[0]!.lineQty?.p111).toBeUndefined();
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
