import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Breakpoint } from '../hooks/useBreakpoint';
import { TopBar } from './TopBar';

const phone: Breakpoint = { w: 375, isMobile: true, isTablet: false, isDesktop: false, isCompact: true };
const desktop: Breakpoint = { w: 1280, isMobile: false, isTablet: false, isDesktop: true, isCompact: false };

function renderBar(bp: Breakpoint) {
  const handlers = {
    onObra: vi.fn(),
    onHelp: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleRef: vi.fn(),
  };
  render(
    <TopBar
      view="presupuesto"
      onView={() => {}}
      theme="light"
      bp={bp}
      onMenu={() => {}}
      obraName="Reforma vivienda C/ Mayor 14"
      onToggleAsistente={() => {}}
      onExport={() => {}}
      importAction={<button type="button">Importar partidas</button>}
      {...handlers}
    />,
  );
  return handlers;
}

describe('TopBar — menú «Más» en móvil (la fila de acciones pisaba la marca)', () => {
  it('en móvil las acciones secundarias no están en la barra, sino en el menú cerrado', () => {
    renderBar(phone);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Datos de la obra' })).toBeNull();
    // Siguen visibles: asistente y exportar (acción primaria).
    expect(screen.getByRole('button', { name: 'Asistente de IA' })).toBeInTheDocument();
    expect(screen.getByTitle('Exportar listados')).toBeInTheDocument();
  });

  it('abrir el menú muestra las acciones; elegir una la ejecuta y cierra el menú', () => {
    const h = renderBar(phone);
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /Referencia/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Modo oscuro' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ayuda' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Datos de la obra' }));
    expect(h.onObra).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('la acción externa (Importar partidas) sigue montada con el menú cerrado', () => {
    // Su <input type=file> vive dentro: si el menú se desmontara al cerrarse, el
    // onChange del selector de ficheros no llegaría nunca.
    renderBar(phone);
    expect(screen.getByText('Importar partidas')).toBeInTheDocument();
    expect(screen.getByText('Importar partidas')).not.toBeVisible();
  });

  it('Escape cierra el menú y devuelve el foco al disparador', () => {
    renderBar(phone);
    const trigger = screen.getByRole('button', { name: 'Más acciones' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('en escritorio no hay menú «Más»: las acciones van en la barra', () => {
    renderBar(desktop);
    expect(screen.queryByRole('button', { name: 'Más acciones' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Datos de la obra' })).toBeInTheDocument();
  });
});
