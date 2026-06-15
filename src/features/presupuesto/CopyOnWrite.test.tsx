/* Copy-on-write (estilo Arquímedes/CYPE) en la justificación: tipo/código
   editables, y el cuadro que protege conceptos de base y recursos compartidos. */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { PresupuestoView } from './PresupuestoView';

const p111 = () => useObraStore.getState().partidas['01']!.find((p) => p.id === 'p111')!;
const p112 = () => useObraStore.getState().partidas['01']!.find((p) => p.id === 'p112')!;

/** Abre p111 y entra en la pestaña de justificación del precio. */
function openJustif(compact = false) {
  render(<PresupuestoView compact={compact} />);
  fireEvent.click(screen.getByText('E02EM030')); // despliega p111
  fireEvent.click(screen.getByText('Justificación del precio'));
}

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('justificación: tipo y código editables', () => {
  it('cada recurso (no-CI) tiene tipo y código editables; el %CI no', () => {
    openJustif();
    // p111: 2 líneas de recurso (mo001 + maquinaria) y 1 línea %CI.
    const noCI = p111().items.filter((it) => it.type !== '%CI').length;
    expect(screen.getAllByRole('button', { name: 'Tipo de recurso' })).toHaveLength(noCI);
    expect(screen.getAllByRole('textbox', { name: 'Código del recurso' })).toHaveLength(noCI);
  });

  it('editar el código re-apunta la línea (partida no-base, edición local → directa)', () => {
    openJustif();
    const cells = screen.getAllByRole('textbox', { name: 'Código del recurso' });
    fireEvent.click(cells[0]!); // mo001 → entra en edición
    const editor = screen.getAllByRole('textbox', { name: 'Código del recurso' })[0]!;
    fireEvent.change(editor, { target: { value: 'X9' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(p111().items[0]!.code).toBe('X9'); // re-apuntada, sin cuadro
    expect(useObraStore.getState().recursos['X9']).toBeDefined(); // creada en el banco
  });
});

describe('justificación: copy-on-write de recurso compartido', () => {
  it('editar el tipo de un recurso compartido pregunta; "Crear copia" forka y deja las demás intactas', () => {
    openJustif();
    expect(p112().items.some((it) => it.code === 'mo001')).toBe(true); // mo001 compartido
    fireEvent.click(screen.getAllByRole('button', { name: 'Tipo de recurso' })[0]!); // mo001
    fireEvent.click(screen.getByRole('option', { name: /Materiales/ })); // → MAT abre el cuadro
    fireEvent.click(screen.getByText('Crear copia'));

    expect(useObraStore.getState().recursos['mo001']!.type).toBe('MO'); // el compartido NO cambia
    const newCode = p111().items[0]!.code;
    expect(newCode).not.toBe('mo001'); // p111 re-apuntada a un privado
    expect(useObraStore.getState().recursos[newCode]!.type).toBe('MAT');
    expect(p112().items.some((it) => it.code === 'mo001')).toBe(true); // p112 intacta
  });

  it('"Editar en todas" aplica el cambio al banco compartido', () => {
    openJustif();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tipo de recurso' })[0]!);
    fireEvent.click(screen.getByRole('option', { name: /Materiales/ }));
    fireEvent.click(screen.getByText('Editar en todas'));
    expect(useObraStore.getState().recursos['mo001']!.type).toBe('MAT'); // afecta a todas
    expect(p111().items[0]!.code).toBe('mo001'); // sin forkar
  });

  it('la casilla "no volver a preguntar" recuerda la elección y evita el segundo cuadro', () => {
    openJustif();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tipo de recurso' })[0]!);
    fireEvent.click(screen.getByRole('option', { name: /Materiales/ }));
    fireEvent.click(screen.getByLabelText('No volver a preguntar en esta partida'));
    fireEvent.click(screen.getByText('Editar en todas'));
    expect(useObraStore.getState().recursos['mo001']!.type).toBe('MAT');

    // Segunda edición del mismo recurso compartido: ya no debe salir el cuadro.
    fireEvent.click(screen.getAllByRole('button', { name: 'Tipo de recurso' })[0]!);
    fireEvent.click(screen.getByRole('option', { name: /Maquinaria/ }));
    expect(screen.queryByText('Editar en todas')).toBeNull(); // sin cuadro
    expect(useObraStore.getState().recursos['mo001']!.type).toBe('MQ'); // aplicado directo
  });
});

describe('justificación: copy-on-write de partida base', () => {
  it('editar una partida fromBase pregunta antes (sin "Editar en todas") y al copiar quita el chip BASE', () => {
    useObraStore.setState((s) => {
      s.partidas['01']!.find((p) => p.id === 'p111')!.fromBase = true;
    });
    openJustif();
    const cells = screen.getAllByRole('textbox', { name: 'Código del recurso' });
    fireEvent.click(cells[0]!);
    const editor = screen.getAllByRole('textbox', { name: 'Código del recurso' })[0]!;
    fireEvent.change(editor, { target: { value: 'BASE9' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    // Edición LOCAL en partida base: cuadro de copia, sin opción "Editar en todas".
    expect(screen.getByText('Crear copia')).toBeInTheDocument();
    expect(screen.queryByText('Editar en todas')).toBeNull();
    fireEvent.click(screen.getByText('Crear copia'));
    expect(p111().items[0]!.code).toBe('BASE9');
    expect(p111().fromBase).toBe(false); // copia en sitio: se va el chip BASE
  });

  it('Cancelar no aplica la edición', () => {
    useObraStore.setState((s) => {
      s.partidas['01']!.find((p) => p.id === 'p111')!.fromBase = true;
    });
    openJustif();
    const cells = screen.getAllByRole('textbox', { name: 'Código del recurso' });
    fireEvent.click(cells[0]!);
    const editor = screen.getAllByRole('textbox', { name: 'Código del recurso' })[0]!;
    fireEvent.change(editor, { target: { value: 'NOPE' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    fireEvent.click(screen.getByText('Cancelar'));
    expect(p111().items[0]!.code).toBe('mo001'); // sin cambios
    expect(p111().fromBase).toBe(true); // sigue siendo base
  });
});
