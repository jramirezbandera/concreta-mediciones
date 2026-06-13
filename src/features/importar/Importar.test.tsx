import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useObraStore } from '../../store';
import { ImportarView } from './ImportarView';

beforeEach(() => {
  useObraStore.getState().reset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

function sampleFile(name: string): File {
  // Copia a un Uint8Array fresco: el Buffer de readFileSync puede ser una vista
  // sobre un pool compartido y jsdom leería bytes de más al construir el File.
  const bytes = new Uint8Array(readFileSync(resolve(process.cwd(), 'docs', 'spike', 'samples', name)));
  return new File([bytes], name, { type: 'application/octet-stream' });
}

describe('ImportarView (F5.3)', () => {
  it('parsea un .bc3 real, pide confirmación y al confirmar reemplaza la obra', async () => {
    const { container } = render(<ImportarView compact={false} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [sampleFile('obra ejemplo.bc3')] } });

    // El parseo es asíncrono (File.arrayBuffer): esperamos al resumen.
    expect(await screen.findByText('Cargar al presupuesto')).toBeInTheDocument();
    expect(screen.getByText('obra ejemplo.bc3')).toBeInTheDocument();
    // El ~K (13 % CI) se muestra como costes indirectos (ya no como coef K).
    expect(screen.getByText('13,00 %')).toBeInTheDocument();

    // El botón NO reemplaza directamente: abre el modal de confirmación, que
    // enseña qué se pierde (obra actual) y qué entra (la del .bc3).
    fireEvent.click(screen.getByText('Cargar al presupuesto'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Reemplazar la obra actual');
    expect(dialog).toHaveTextContent('VIVIENDA UNIFAMILIAR ESPIGA');

    fireEvent.click(screen.getByText('Reemplazar y cargar'));
    const s = useObraStore.getState();
    expect(s.chapters).toHaveLength(19);
    expect(Object.values(s.partidas).reduce((a, ps) => a + ps.length, 0)).toBe(167);
    expect(s.view).toBe('presupuesto');
    expect(s.rates.coefK).toBe(1); // K en 1; el CI (13 %) va como línea %CI
  });

  it('cancelar el modal no toca la obra actual', async () => {
    const { container } = render(<ImportarView compact={false} />);
    const seedChapters = useObraStore.getState().chapters.length;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [sampleFile('obra ejemplo.bc3')] } });

    fireEvent.click(await screen.findByText('Cargar al presupuesto'));
    fireEvent.click(await screen.findByText('Cancelar'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useObraStore.getState().chapters).toHaveLength(seedChapters); // intacta
  });

  it('muestra un error legible ante un archivo que no es .bc3', async () => {
    const { container } = render(<ImportarView compact={false} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bad = new File([new TextEncoder().encode('no soy fiebdc')], 'x.bc3');
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByText('No se pudo importar')).toBeInTheDocument();
    expect(useObraStore.getState().chapters).toHaveLength(8); // obra seed intacta
  });
});
