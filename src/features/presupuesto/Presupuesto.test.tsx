import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { PresupuestoView } from './PresupuestoView';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('PresupuestoView (F2.1 lectura + F2.2 detalle)', () => {
  it('muestra el capítulo activo (01) con sus partidas', () => {
    render(<PresupuestoView compact={false} />);
    expect(screen.getByRole('heading', { name: 'Movimiento de tierras' })).toBeInTheDocument();
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // código de p111
  });

  it('desplegar una partida abre el panel de detalle (medición)', () => {
    render(<PresupuestoView compact={false} />);
    expect(screen.queryByText('Añadir línea de medición')).toBeNull();
    // La celda Nº·Código no para la propagación → click despliega la fila.
    fireEvent.click(screen.getByText('E02EM030'));
    expect(screen.getByText('Añadir línea de medición')).toBeInTheDocument();
    // Las líneas de medición de p111 quedan visibles dentro del panel.
    expect(screen.getByText('Zanjas de saneamiento')).toBeInTheDocument();
  });

  it('el capítulo vacío (05) muestra el estado sin partidas', () => {
    useObraStore.getState().setActive('05'); // Cerramientos: 0 partidas en el seed
    render(<PresupuestoView compact={false} />);
    expect(screen.getByText('Capítulo sin partidas')).toBeInTheDocument();
  });

  it('la pestaña Justificación muestra el banco compartido y la señal de override', () => {
    render(<PresupuestoView compact={false} />);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111
    fireEvent.click(screen.getByText('Justificación del precio'));
    // conceptos del banco visibles (mo001 lo comparten ≥4 partidas → SharedChip).
    expect(screen.getByText('mo001')).toBeInTheDocument();
    // p111 es override en el seed (precio 18,42 ≠ descompuesto 9,27) → señal.
    expect(screen.getByText(/fijado a mano/)).toBeInTheDocument();
  });

  it('"Añadir partida" inserta una fila en el subcapítulo (F2.4)', () => {
    render(<PresupuestoView compact={false} />);
    const before = useObraStore.getState().partidas['01']!.length;
    fireEvent.click(screen.getAllByText(/Añadir partida/)[0]!);
    expect(useObraStore.getState().partidas['01']!).toHaveLength(before + 1);
  });

  it('el menú ⋮ mueve la partida a otro capítulo (F2.4)', () => {
    render(<PresupuestoView compact={false} />);
    fireEvent.click(screen.getAllByTitle('Más acciones')[0]!); // menú de p111
    fireEvent.click(screen.getByText('Cimentación')); // capítulo 02
    const s = useObraStore.getState();
    expect(s.partidas['01']!.some((p) => p.id === 'p111')).toBe(false);
    expect(s.partidas['02']!.some((p) => p.id === 'p111')).toBe(true);
  });

  it('la unidad de medida de la partida es editable en la fila (F8.0)', () => {
    render(<PresupuestoView compact={false} />);
    // p111 (E02EM030) mide en m³; cámbiala a m². Al editar, el span pasa a
    // textarea (único en el DOM: el resto de filas siguen siendo spans).
    fireEvent.click(screen.getAllByRole('textbox', { name: 'Unidad de medida de la partida' })[0]!);
    const input = document.querySelector('textarea')!;
    fireEvent.change(input, { target: { value: 'm²' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const p111 = useObraStore.getState().partidas['01']!.find((p) => p.id === 'p111')!;
    expect(p111.ud).toBe('m²');
    expect(p111.fromBase).toBe(false); // editar confirma la partida
  });

  it('la unidad de medida también se edita en la tarjeta compacta (F8.0)', () => {
    render(<PresupuestoView compact={true} />);
    fireEvent.click(screen.getAllByRole('textbox', { name: 'Unidad de medida de la partida' })[0]!);
    const input = document.querySelector('textarea')!;
    fireEvent.change(input, { target: { value: 'ud' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useObraStore.getState().partidas['01']![0]!.ud).toBe('ud');
  });

  it('la unidad del RECURSO se edita en las tarjetas de justificación (banco compartido, F8.0)', () => {
    render(<PresupuestoView compact={true} />);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111 (tarjeta)
    fireEvent.click(screen.getByText('Justificación del precio'));
    fireEvent.click(screen.getAllByRole('textbox', { name: 'Unidad del recurso' })[0]!); // mo001
    const input = document.querySelector('textarea')!;
    fireEvent.change(input, { target: { value: 'jornada' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useObraStore.getState().recursos['mo001']!.ud).toBe('jornada'); // afecta a TODAS las partidas que lo usan
  });

  it('las flechas mueven el foco entre celdas editables de la medición (F8.2 a11y)', () => {
    render(<PresupuestoView compact={false} />);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111 → tab Medición
    const uds = screen.getAllByRole('button', { name: 'Unidades' })[0]!;
    uds.focus();
    // → Longitud (misma fila), ↓ Longitud de la 2ª línea, ← Uds de esa línea
    fireEvent.keyDown(uds, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Longitud' })[0]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Longitud' })[1]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Unidades' })[1]);
  });

  it('las flechas no interfieren mientras se EDITA (el caret manda)', () => {
    render(<PresupuestoView compact={false} />);
    fireEvent.click(screen.getByText('E02EM030'));
    const uds = screen.getAllByRole('button', { name: 'Unidades' })[0]!;
    fireEvent.click(uds); // entra en edición → input
    const input = document.querySelector('input')!;
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(input); // el foco no se mueve de celda
  });

  it('en compacto (<780) la tabla conmuta a tarjetas (F2.5)', () => {
    render(<PresupuestoView compact={true} />);
    expect(screen.queryByText('Nº · Código')).toBeNull(); // sin cabecera de tabla
    expect(screen.getByText('E02EM030')).toBeInTheDocument(); // la partida sigue ahí
    expect(screen.getAllByText('Cantidad').length).toBeGreaterThan(0); // tarjetas con stats
  });

  it('escritorio mantiene la tabla (cabecera de columnas presente)', () => {
    render(<PresupuestoView compact={false} />);
    expect(screen.getByText('Nº · Código')).toBeInTheDocument();
  });
});
