import { describe, expect, it } from 'vitest';
import { buildChatSystem, CHAT_SYSTEM_STABLE } from './prompt';
import { chatSystemText } from './types';

describe('buildChatSystem', () => {
  const snap = { text: 'OBRA: Casa X\nPEM 100,00 €', truncated: false };

  it('el bloque estable define rol, alcance, catálogo de ops y el contexto de la app', () => {
    expect(CHAT_SYSTEM_STABLE).toContain('asistente de IA de Concreta');
    expect(CHAT_SYSTEM_STABLE).toContain('OPERACIONES');
    expect(CHAT_SYSTEM_STABLE).toContain('crear_partida');
    expect(CHAT_SYSTEM_STABLE).toContain('POSICIÓN'); // regla de referencia de partidas
    expect(CHAT_SYSTEM_STABLE).toContain('SOBRE LA APLICACIÓN');
    expect(CHAT_SYSTEM_STABLE).toContain('FIEBDC');
  });

  it('el estable NO lleva el snapshot (para no invalidar la caché de prompt)', () => {
    const sys = buildChatSystem(snap);
    expect(sys.stable).toBe(CHAT_SYSTEM_STABLE);
    expect(sys.stable).not.toContain('Casa X');
  });

  it('el volátil envuelve el snapshot en el bloque de datos delimitado', () => {
    const sys = buildChatSystem(snap);
    expect(sys.volatile).toContain('<<<DATOS_OBRA>>>');
    expect(sys.volatile).toContain('<<<FIN_DATOS_OBRA>>>');
    expect(sys.volatile).toContain('Casa X');
  });

  it('el system completo pone lo estable ANTES que lo volátil (orden de caché)', () => {
    const sys = buildChatSystem(snap);
    const full = chatSystemText(sys);
    expect(full.indexOf('SOBRE LA APLICACIÓN')).toBeLessThan(full.indexOf('<<<DATOS_OBRA>>>'));
  });
});
