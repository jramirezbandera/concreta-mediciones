import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../store';
import { Sidebar } from './Sidebar';

beforeEach(() => {
  useObraStore.getState().reset();
});

/** Las acciones del árbol eran `span role=button` DENTRO del <button> de la fila:
 *  HTML inválido, sin foco de teclado (tabIndex -1) y aplanadas por los lectores
 *  de pantalla. Ahora son botones reales, hermanos del botón principal. */
describe('Sidebar — controles del árbol accesibles', () => {
  it('ningún botón queda anidado dentro de otro', () => {
    useObraStore.getState().toggleExpanded('01', true);
    const { container } = render(<Sidebar />);
    expect(container.querySelector('button button, button [role="button"]')).toBeNull();
  });

  it('«+» y ⋮ del capítulo son botones enfocables; el ⋮ anuncia su menú', () => {
    render(<Sidebar />);
    const add = screen.getAllByRole('button', { name: 'Añadir subcapítulo' })[0]!;
    const more = screen.getAllByRole('button', { name: 'Acciones del capítulo' })[0]!;
    expect(add).not.toHaveAttribute('tabindex', '-1');
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Subir')).toBeInTheDocument();
  });

  it('el chevron despliega con aria-expanded y el botón principal selecciona', () => {
    render(<Sidebar />);
    const chev = screen.getAllByRole('button', { name: 'Desplegar' })[0]!;
    expect(chev).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chev);
    expect(screen.getAllByRole('button', { name: 'Colapsar' })[0]).toHaveAttribute('aria-expanded', 'true');

    // El nombre del botón principal es código + título (sin las acciones pegadas).
    const main = screen.getByRole('button', { name: /^2\s+Cimentación$/ });
    fireEvent.click(main);
    expect(useObraStore.getState().active).toBe('02');
    expect(main).toHaveAttribute('aria-current', 'true');
  });
});
