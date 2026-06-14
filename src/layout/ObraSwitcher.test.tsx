import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ObraMeta } from '../persist';
import { useSessionStore } from '../persist';
import { SCHEMA_VERSION, useObraStore } from '../store';
import { ObraSwitcher } from './ObraSwitcher';

const meta = (id: string, name: string, kind?: ObraMeta['kind']): ObraMeta => ({
  id,
  name,
  savedAt: '2026-06-14T00:00:00.000Z',
  schemaVersion: SCHEMA_VERSION,
  ...(kind ? { kind } : {}),
});

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('ObraSwitcher (separación obra/referencia)', () => {
  it('lista obras de trabajo pero NO las de solo-referencia', () => {
    useSessionStore.setState({
      obras: [meta('a', 'Obra A'), meta('r', 'Base ITeC', 'reference')],
      activeId: 'a',
      switching: false,
    });
    render(<ObraSwitcher />);
    fireEvent.click(screen.getByTitle('Cambiar de obra'));

    // El nombre de la activa aparece también en el disparador; acotamos al menú.
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Obra A')).toBeInTheDocument();
    expect(within(menu).queryByText('Base ITeC')).toBeNull(); // la referencia no contamina el selector
  });
});
