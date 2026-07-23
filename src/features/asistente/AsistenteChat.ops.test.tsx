/* Integración del panel (F-A3): mockeamos el proveedor Gemini para inyectar un
   envelope canónico y verificamos el flujo completo — enviar → informe enumerado +
   mutación de la obra (directa), y propuesta → tarjeta → Aplicar. */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../ai/providers/gemini', () => ({ chatRaw: vi.fn() }));

import { chatRaw } from '../../ai/providers/gemini';
import { AsistenteChat } from './AsistenteChat';
import { __resetAiSettingsForTests, useAiSettings } from '../../ai';
import { blankObraData, useObraStore } from '../../store';
import { useSessionStore } from '../../persist';
import type { Chapter, Partida } from '../../core/types';

const mockChat = chatRaw as unknown as Mock;

const partida = (o: Partial<Partida> & Pick<Partida, 'id' | 'pos'>): Partida => ({
  code: '——', title: 'P', ud: 'ud', precio: 0, desc: '', med: [], items: [], ...o,
});
const CH: Chapter[] = [{ id: 'c1', code: '1', title: 'Cap uno', children: [] }];

beforeEach(() => {
  __resetAiSettingsForTests();
  useAiSettings.getState().setKey('gemini', 'k'); // BYOK: hay clave activa
  useSessionStore.getState().setReadonly(false);
  useObraStore.setState({ ...blankObraData(), chapters: structuredClone(CH), partidas: { c1: [] }, active: 'c1' });
  mockChat.mockReset();
});

async function send(text: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Escribe tu consulta o una orden'), text);
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
}

describe('AsistenteChat · ops (integración)', () => {
  it('op directa (crear_partida) → informe enumerado + partida creada', async () => {
    mockChat.mockResolvedValue({ reply: 'Creada.', ops: [{ op: 'crear_partida', capitulo: '1', titulo: 'Excavación', ud: 'm³', precio: 12 }] });
    render(<AsistenteChat />);
    await send('crea una partida de excavación');
    expect(await screen.findByText(/Partida 1\.1 · Excavación/)).toBeInTheDocument();
    const list = useObraStore.getState().partidas.c1!;
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('Excavación');
    expect(list[0]!.precio).toBe(12);
  });

  it('op de consecuencia (set_precio) → tarjeta → Aplicar muta la obra', async () => {
    useObraStore.setState({ partidas: { c1: [partida({ id: 'p1', pos: '1.1', title: 'Excavación', precio: 10 })] } });
    mockChat.mockResolvedValue({ reply: 'Te lo propongo.', ops: [{ op: 'set_precio', ref: '1.1', valor: 99 }] });
    render(<AsistenteChat />);
    await send('sube el precio de la 1.1 a 99');

    const apply = await screen.findByRole('button', { name: /Aplicar 1 cambio/ });
    expect(useObraStore.getState().partidas.c1![0]!.precio).toBe(10); // aún sin aplicar
    await userEvent.setup().click(apply);
    expect(useObraStore.getState().partidas.c1![0]!.precio).toBe(99);
  });

  it('op mal formada del modelo → se descarta con motivo en el informe (no muta)', async () => {
    mockChat.mockResolvedValue({ reply: 'Ok', ops: [{ op: 'crear_partida', titulo: 'Sin unidad' }] });
    render(<AsistenteChat />);
    await send('crea algo raro');
    expect(await screen.findByText(/no aplicada/)).toBeInTheDocument();
    expect(useObraStore.getState().partidas.c1).toHaveLength(0);
  });
});
