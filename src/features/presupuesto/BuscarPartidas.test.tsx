import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useObraStore } from '../../store';
import { BuscarPartidas } from './BuscarPartidas';

// El dropdown vive en un PORTAL (document.body); no limpiamos el body a mano
// (chocaría con el desmontaje de RTL) — el auto-cleanup de testing-library
// (globals:true) desmonta React y retira el portal correctamente.
beforeEach(() => {
  useObraStore.getState().reset();
});

const input = () => screen.getByLabelText('Buscar partida en la obra') as HTMLInputElement;

describe('BuscarPartidas (T-20)', () => {
  it('menos de 2 caracteres no abre resultados', () => {
    render(<BuscarPartidas />);
    fireEvent.change(input(), { target: { value: 'e' } });
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('busca por título y muestra la ubicación (miga del subcapítulo)', async () => {
    render(<BuscarPartidas />);
    fireEvent.change(input(), { target: { value: 'zanjas' } });
    const opt = await screen.findByRole('option', { name: /Excavación en zanjas a máquina/i });
    expect(opt).toHaveTextContent('1.1'); // sub 01.01 → código 1.1
  });

  it('busca por código', async () => {
    render(<BuscarPartidas />);
    fireEvent.change(input(), { target: { value: 'E02EM030' } });
    expect(await screen.findByRole('option', { name: /E02EM030/i })).toBeInTheDocument();
  });

  it('click en un resultado revela la partida y cierra/limpia el buscador', async () => {
    const onAfterSelect = vi.fn();
    useObraStore.getState().setView('resumen'); // partir de otra vista
    render(<BuscarPartidas onAfterSelect={onAfterSelect} />);
    fireEvent.change(input(), { target: { value: 'zanjas' } });
    fireEvent.click(await screen.findByRole('option', { name: /zanjas/i }));

    const s = useObraStore.getState();
    expect(s.openPartidaId).toBe('p111');
    expect(s.active).toBe('01.01'); // sub aislado
    expect(s.view).toBe('presupuesto');
    expect(onAfterSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('option')).toBeNull(); // dropdown cerrado
    expect(input().value).toBe(''); // texto limpiado
  });

  it('Enter selecciona el primer resultado', async () => {
    render(<BuscarPartidas />);
    fireEvent.change(input(), { target: { value: 'excav' } });
    await screen.findAllByRole('option');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(useObraStore.getState().openPartidaId).toBe('p111');
  });

  it('Escape en dos fases: primero cierra, luego limpia', async () => {
    render(<BuscarPartidas />);
    fireEvent.change(input(), { target: { value: 'zanjas' } });
    await screen.findByRole('option', { name: /zanjas/i });
    fireEvent.keyDown(input(), { key: 'Escape' }); // 1ª: cierra
    expect(screen.queryByRole('option')).toBeNull();
    expect(input().value).toBe('zanjas');
    fireEvent.keyDown(input(), { key: 'Escape' }); // 2ª: limpia
    expect(input().value).toBe('');
  });

  it('sin coincidencias muestra el estado vacío', async () => {
    render(<BuscarPartidas />);
    fireEvent.change(input(), { target: { value: 'zzznada' } });
    expect(await screen.findByText('Sin coincidencias en esta obra')).toBeInTheDocument();
  });
});
