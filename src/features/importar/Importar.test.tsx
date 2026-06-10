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
  it('parsea un .bc3 real, muestra el resumen y al confirmar reemplaza la obra', async () => {
    const { container } = render(<ImportarView compact={false} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [sampleFile('obra ejemplo.bc3')] } });

    // El parseo es asíncrono (File.arrayBuffer): esperamos al resumen.
    expect(await screen.findByText('Cargar al presupuesto')).toBeInTheDocument();
    expect(screen.getByText('obra ejemplo.bc3')).toBeInTheDocument();
    expect(screen.getByText('×1,1300')).toBeInTheDocument(); // coef K

    fireEvent.click(screen.getByText('Cargar al presupuesto'));
    const s = useObraStore.getState();
    expect(s.chapters).toHaveLength(19);
    expect(Object.values(s.partidas).reduce((a, ps) => a + ps.length, 0)).toBe(167);
    expect(s.view).toBe('presupuesto');
    expect(s.rates.coefK).toBe(1.13);
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
