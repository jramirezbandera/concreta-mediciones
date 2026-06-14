import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusBar } from './StatusBar';

const counts = { chapters: 2, partidas: 5, lineas: 9 };

describe('StatusBar', () => {
  it('muestra el botón Ayuda y NO el de Sandbox', () => {
    render(<StatusBar counts={counts} pem={1000} pec={1100} onHelp={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ayuda' })).toBeInTheDocument();
    expect(screen.queryByText('Sandbox')).toBeNull();
  });

  it('Ayuda dispara onHelp', () => {
    const onHelp = vi.fn();
    render(<StatusBar counts={counts} pem={1000} pec={1100} onHelp={onHelp} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda' }));
    expect(onHelp).toHaveBeenCalledTimes(1);
  });
});
