import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    // El título del capítulo es editable inline (role textbox, no heading).
    expect(screen.getByRole('textbox', { name: 'Título del capítulo' })).toHaveTextContent(
      'Movimiento de tierras',
    );
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
    // (El pie del panel, no la etiqueta de lector de pantalla de la fila.)
    expect(screen.getByText(/no se recalcula de estos descompuestos/)).toBeInTheDocument();
  });

  it('marca el precio override en la propia fila (señal sutil + tooltip con el descompuesto)', () => {
    render(<PresupuestoView compact={false} />);
    // p111 es override en el seed (precio 18,42 ≠ descompuesto 9,27): la celda
    // de precio lleva el aviso con el valor del descompuesto, sin desplegar nada.
    const marks = screen.getAllByTitle(/fijado a mano/);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.some((el) => /9,27/.test(el.getAttribute('title') ?? ''))).toBe(true);
  });

  it('distingue los TRES orígenes del precio: descompuesto, a mano y directo', () => {
    // p111 nace override en el seed (18,42 ≠ 9,27). Al ponerle su descompuesto,
    // el precio pasa a ir LIGADO a la justificación (la señal es del dato, no de
    // la marca `precioManual`) → la fila lo pinta en accent.
    useObraStore.getState().setPrecio('01', 'p111', 9.27);
    render(<PresupuestoView compact={false} />);
    const row = (id: string) => document.getElementById(`partida-${id}`)!;
    const priceTitle = (id: string) =>
      Array.from(row(id).querySelectorAll('td'))
        .map((td) => td.getAttribute('title') ?? '')
        .find((t) => /Precio/.test(t)) ?? '';

    expect(priceTitle('p111')).toMatch(/calculado desde su justificación/);
    expect(priceTitle('p112')).toMatch(/fijado a mano/); // sigue override (24,18 ≠ 11,83…)
    expect(priceTitle('p122')).toMatch(/no tiene justificación/); // sin descomposición
    // El color no es la única señal: cada estado deja su etiqueta accesible.
    expect(row('p111').textContent).toContain('precio calculado del descompuesto');
    expect(row('p122').textContent).toContain('precio directo, sin justificación');
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

  it('la unidad de la partida se elige de un desplegable en la fila (F8.0 + UdSelect)', () => {
    render(<PresupuestoView compact={false} />);
    // p111 (E02EM030) mide en m³; cámbiala a m² desde el desplegable.
    fireEvent.click(screen.getAllByRole('button', { name: 'Unidad de medida de la partida' })[0]!);
    fireEvent.click(screen.getByRole('option', { name: /m² superficie/ }));
    const p111 = useObraStore.getState().partidas['01']!.find((p) => p.id === 'p111')!;
    expect(p111.ud).toBe('m²');
    expect(p111.fromBase).toBe(false); // editar confirma la partida
  });

  it('la unidad también se elige en la tarjeta compacta (F8.0 + UdSelect)', () => {
    render(<PresupuestoView compact={true} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Unidad de medida de la partida' })[0]!);
    fireEvent.click(screen.getByRole('option', { name: /ud unidad/ }));
    expect(useObraStore.getState().partidas['01']![0]!.ud).toBe('ud');
  });

  it('la unidad del RECURSO admite una unidad libre («Otra…», banco compartido)', () => {
    render(<PresupuestoView compact={true} />);
    fireEvent.click(screen.getByText('E02EM030')); // despliega p111 (tarjeta)
    fireEvent.click(screen.getByText('Justificación')); // en tarjetas, etiqueta corta
    fireEvent.click(screen.getAllByRole('button', { name: 'Unidad del recurso' })[0]!); // mo001
    const otra = screen.getByRole('textbox', { name: 'Otra unidad' });
    fireEvent.change(otra, { target: { value: 'jornada' } });
    fireEvent.keyDown(otra, { key: 'Enter' });
    // mo001 es compartido (≥4 partidas) → el copy-on-write pregunta; "Editar en
    // todas" aplica al banco compartido (intención original del test).
    fireEvent.click(screen.getByText('Editar en todas'));
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

  it('obra SIN capítulos → estado vacío "Empieza tu primera obra" con CTAs (F8.3)', () => {
    useObraStore.setState({ chapters: [], partidas: {} });
    const onImport = vi.fn();
    render(<PresupuestoView compact={false} onImport={onImport} />);
    expect(screen.getByText('Empieza tu primera obra')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Importar .bc3'));
    expect(onImport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Añadir capítulo'));
    expect(useObraStore.getState().chapters).toHaveLength(1); // obra en blanco arranca
  });
});
