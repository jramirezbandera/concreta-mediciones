import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AsistenteChat } from './AsistenteChat';
import { __resetAiSettingsForTests } from '../../ai';
import { useObraStore } from '../../store';

/* jsdom NO implementa SpeechRecognition:
   · sin mock → el micro NO se pinta (degradación limpia);
   · con un reconocedor simulado en window → el micro aparece, alterna la escucha
     y vuelca `base + final + interim` en el composer. */

interface SpeechEntry {
  transcript: string;
  isFinal: boolean;
}
class MockRecognition {
  static instances: MockRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    MockRecognition.instances.push(this);
  }
  /** Simula un evento onresult con la lista de resultados dada. */
  emit(entries: SpeechEntry[], resultIndex = 0) {
    const results = entries.map((e) => ({
      0: { transcript: e.transcript },
      isFinal: e.isFinal,
      length: 1,
    }));
    (results as unknown as { length: number }).length = entries.length;
    act(() => {
      this.onresult?.({ resultIndex, results });
    });
  }
}

const composer = () =>
  screen.getByLabelText('Escribe tu consulta o una orden') as HTMLTextAreaElement;

/** El reconocedor recién creado (guarda tipada: noUncheckedIndexedAccess). */
function lastRec(): MockRecognition {
  const rec = MockRecognition.instances.at(-1);
  if (!rec) throw new Error('no se registró ningún reconocedor');
  return rec;
}

beforeEach(() => {
  __resetAiSettingsForTests();
  useObraStore.getState().reset();
  MockRecognition.instances = [];
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe('AsistenteChat · dictado por voz (F-A6)', () => {
  it('sin soporte del navegador (jsdom): el micro NO se renderiza', () => {
    render(<AsistenteChat />);
    expect(screen.queryByRole('button', { name: /dictar por voz/i })).not.toBeInTheDocument();
  });

  it('con SpeechRecognition: aparece el micro y al pulsarlo arranca (es-ES, continuo)', () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockRecognition;
    render(<AsistenteChat />);

    const mic = screen.getByRole('button', { name: 'Dictar por voz' });
    expect(mic).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(mic);

    expect(MockRecognition.instances).toHaveLength(1);
    const rec = lastRec();
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(rec.lang).toBe('es-ES');
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(screen.getByRole('button', { name: 'Detener dictado' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Escuchando…/)).toBeInTheDocument();
  });

  it('interino + final: el composer refleja el transcrito en vivo', () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockRecognition;
    render(<AsistenteChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar por voz' }));
    const rec = lastRec();

    rec.emit([{ transcript: 'tres por dos', isFinal: false }]);
    expect(composer().value).toBe('tres por dos');

    rec.emit([{ transcript: 'tres por dos coma cinco', isFinal: true }]);
    expect(composer().value).toBe('tres por dos coma cinco');
  });

  it('lo dictado se AÑADE a lo ya escrito (con separador), no lo sustituye', () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockRecognition;
    render(<AsistenteChat />);

    fireEvent.change(composer(), { target: { value: 'excavación' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dictar por voz' }));
    const rec = lastRec();

    rec.emit([{ transcript: 'de 3 metros', isFinal: true }]);
    expect(composer().value).toBe('excavación de 3 metros');
  });

  it('pulsar de nuevo detiene la escucha (stop del reconocedor y botón en reposo)', () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockRecognition;
    render(<AsistenteChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictar por voz' }));
    const rec = lastRec();

    fireEvent.click(screen.getByRole('button', { name: 'Detener dictado' }));
    expect(rec.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Dictar por voz' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
