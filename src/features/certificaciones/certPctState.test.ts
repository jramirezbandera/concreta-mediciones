import { describe, expect, it } from 'vitest';
import { certPctState } from './certPctState';

describe('certPctState — color semántico del avance certificado', () => {
  it('en curso (acento) por debajo del 100 %', () => {
    expect(certPctState(0)).toBe('progress');
    expect(certPctState(50)).toBe('progress');
    expect(certPctState(99.4)).toBe('progress');
  });

  it('completo (verde) en la banda ~100 % (tolera el redondeo)', () => {
    expect(certPctState(99.5)).toBe('full');
    expect(certPctState(100)).toBe('full');
    expect(certPctState(100.5)).toBe('full');
  });

  it('exceso (ámbar) al superar el 100 % real: sobre-certificación', () => {
    expect(certPctState(100.6)).toBe('over');
    expect(certPctState(110)).toBe('over');
    expect(certPctState(250)).toBe('over');
  });
});
