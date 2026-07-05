import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { clearArmedEdit } from '../../hooks/editGridNav';
import { CertificacionesView } from './CertificacionesView';

// Navegación tipo hoja de cálculo en la tabla de certificación (paridad con la
// medición de presupuesto): Enter baja por la columna, Tab va a la derecha, y la
// celda destino queda EN EDICIÓN con foco. Reusa el motor useMedGridTab/editGridNav.
beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
  clearArmedEdit();
});

const ejecs = () => screen.getAllByLabelText('Cantidad ejecutada');
const pcts = () => screen.getAllByLabelText('% de ejecución');

describe('Tab/Enter editable en la tabla de certificación', () => {
  it('Tab pasa de «Ejec.» al % de la MISMA fila y lo deja en edición con foco', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(ejecs()[0]!); // abre la ejecutada de la 1ª partida
    expect(ejecs()[0]!.tagName).toBe('INPUT');
    fireEvent.keyDown(ejecs()[0]!, { key: 'Tab' });
    const pct = pcts()[0]!;
    expect(pct.tagName).toBe('INPUT'); // editable, no en reposo
    expect(pct).toHaveFocus();
  });

  it('Shift+Tab vuelve del % a «Ejec.» de la misma fila', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(pcts()[0]!);
    fireEvent.keyDown(pcts()[0]!, { key: 'Tab', shiftKey: true });
    const ejec = ejecs()[0]!;
    expect(ejec.tagName).toBe('INPUT');
    expect(ejec).toHaveFocus();
  });

  it('Enter baja por la columna «Ejec.» a la fila siguiente, en edición con foco', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(ejecs()[0]!);
    fireEvent.keyDown(ejecs()[0]!, { key: 'Enter' });
    const ejec2 = ejecs()[1]!;
    expect(ejec2.tagName).toBe('INPUT');
    expect(ejec2).toHaveFocus();
  });

  it('Enter con número inválido NO baja y mantiene la celda abierta (D7)', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(ejecs()[0]!);
    const first = ejecs()[0] as HTMLInputElement;
    fireEvent.change(first, { target: { value: '1,5,0' } }); // no es un número
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(ejecs()[0]!.tagName).toBe('INPUT'); // sigue abierta
    expect(ejecs()[0]!).toHaveAttribute('aria-invalid', 'true');
    expect(ejecs()[1]!.tagName).toBe('BUTTON'); // la de abajo NO se abrió
  });

  it('Enter en la ÚLTIMA fila del grid no crea fila ni rompe (cert sin «alta al final»)', () => {
    render(<CertificacionesView compact={false} />);
    const all = ejecs();
    const last = all[all.length - 1]!;
    fireEvent.click(last);
    const n = ejecs().length;
    expect(() =>
      fireEvent.keyDown(ejecs()[ejecs().length - 1]!, { key: 'Enter' }),
    ).not.toThrow();
    expect(ejecs()).toHaveLength(n); // no se añadió ninguna fila
  });

  it('Escape cierra la celda y devuelve el foco a su display (no se pierde la posición)', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(ejecs()[0]!);
    expect(ejecs()[0]!.tagName).toBe('INPUT');
    fireEvent.keyDown(ejecs()[0]!, { key: 'Escape' });
    const back = ejecs()[0]!;
    expect(back.tagName).toBe('BUTTON');
    expect(back).toHaveFocus();
  });
});

// Flechas: mueven el foco entre celdas EN REPOSO (useGridNav), sin abrirlas —
// a diferencia de Tab/Enter, que abren. Paridad con el grid de medición.
describe('Flechas mueven el foco entre celdas en reposo (sin abrir)', () => {
  it('ArrowDown baja a la celda Ejec de la fila siguiente, en reposo', () => {
    render(<CertificacionesView compact={false} />);
    const first = ejecs()[0]!;
    first.focus();
    expect(first.tagName).toBe('BUTTON');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    const second = ejecs()[1]!;
    expect(second).toHaveFocus();
    expect(second.tagName).toBe('BUTTON'); // movió el foco, NO abrió en edición
  });

  it('ArrowRight pasa de Ejec al % de la misma fila, en reposo', () => {
    render(<CertificacionesView compact={false} />);
    const first = ejecs()[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const pct = pcts()[0]!;
    expect(pct).toHaveFocus();
    expect(pct.tagName).toBe('BUTTON');
  });
});

// Precios contradictorios (P.C.): las filas CertExtraRow. La unidad usa ahora el
// selector `UdSelect` (botón disparador de un popover), igual que el presupuesto,
// en lugar de texto libre. Tab lleva del título al selector; el par numérico
// (cantidad↔precio, `EditableNum`) sigue encadenándose con apertura en edición.
describe('Precios contradictorios (P.C.): unidad y navegación', () => {
  const pcRow = () => screen.getByLabelText('Título del contradictorio').closest('tr')!;

  it('Tab lleva del título al selector de unidad (UdSelect), con foco', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(screen.getAllByText('Añadir precio contradictorio')[0]!);

    // Título (EditableText → textarea) abierto por click.
    fireEvent.click(within(pcRow()).getByLabelText('Título del contradictorio'));
    expect(within(pcRow()).getByLabelText('Título del contradictorio').tagName).toBe('TEXTAREA');

    // Tab → Ud es ahora un selector: botón disparador con foco, NO un textarea.
    fireEvent.keyDown(within(pcRow()).getByLabelText('Título del contradictorio'), { key: 'Tab' });
    const ud = within(pcRow()).getByLabelText('Unidad');
    expect(ud.tagName).toBe('BUTTON');
    expect(ud).toHaveFocus();
  });

  it('el selector de unidad abre el listado y fija la unidad elegida', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(screen.getAllByText('Añadir precio contradictorio')[0]!);

    fireEvent.click(within(pcRow()).getByLabelText('Unidad'));
    fireEvent.click(screen.getByRole('option', { name: /superficie/i })); // «m²»
    expect(within(pcRow()).getByLabelText('Unidad')).toHaveTextContent('m²');
  });

  it('Tab encadena cantidad → precio, abriendo cada campo en edición con foco', () => {
    render(<CertificacionesView compact={false} />);
    fireEvent.click(screen.getAllByText('Añadir precio contradictorio')[0]!);

    fireEvent.click(within(pcRow()).getByLabelText('Cantidad ejecutada'));
    expect(within(pcRow()).getByLabelText('Cantidad ejecutada').tagName).toBe('INPUT');

    fireEvent.keyDown(within(pcRow()).getByLabelText('Cantidad ejecutada'), { key: 'Tab' });
    const precio = within(pcRow()).getByLabelText('Precio');
    expect(precio.tagName).toBe('INPUT');
    expect(precio).toHaveFocus();
  });
});
