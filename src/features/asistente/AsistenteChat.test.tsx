import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AsistenteChat } from './AsistenteChat';
import { __resetAiSettingsForTests } from '../../ai';
import { useObraStore } from '../../store';

beforeEach(() => {
  __resetAiSettingsForTests(); // sin clave propia ni compartida (no hay env en tests)
  useObraStore.getState().reset();
});

describe('AsistenteChat (smoke)', () => {
  it('muestra el estado vacío de onboarding con chips de sugerencia', () => {
    render(<AsistenteChat />);
    expect(screen.getByText('¿Qué necesitas de esta obra?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '¿Cuánto suma la obra?' })).toBeInTheDocument();
  });

  it('el botón de enviar está deshabilitado sin texto y se habilita al escribir', async () => {
    const user = userEvent.setup();
    render(<AsistenteChat />);
    const send = screen.getByRole('button', { name: 'Enviar' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText('Escribe tu consulta o una orden'), 'hola');
    expect(send).toBeEnabled();
  });

  it('sin clave configurada, enviar muestra un error accionable (no llama a la red)', async () => {
    const user = userEvent.setup();
    render(<AsistenteChat />);
    await user.click(screen.getByRole('button', { name: '¿Cuánto suma la obra?' }));
    expect(await screen.findByText(/No hay clave de IA configurada/)).toBeInTheDocument();
  });
});
