import { beforeEach, describe, expect, it } from 'vitest';
import { bc3FileFor } from './bc3';
import { useObraStore } from '../../store';

beforeEach(() => {
  useObraStore.getState().reset();
});

describe('bc3FileFor (estado → .bc3, F7.4)', () => {
  it('serializa la obra del estado con la cabecera FIEBDC-3 y el nombre con la denominación', () => {
    const { bytes, fileName } = bc3FileFor();
    expect(fileName).toBe('Obra completa - Reforma vivienda C Mayor 14.bc3');
    const text = new TextDecoder('windows-1252').decode(bytes);
    expect(text.startsWith('~V|Concreta|FIEBDC-3/2016|Concreta Mediciones||ANSI|\r\n')).toBe(true);
    expect(text).toContain('~C|OBRA##||Reforma vivienda C/ Mayor 14|');
  });

  it('refleja las ediciones: renombrar la obra cambia raíz y nombre de archivo', () => {
    useObraStore.getState().setObraPath('denominacion', 'Obra nueva: fase 2');
    const { bytes, fileName } = bc3FileFor();
    expect(fileName).toBe('Obra completa - Obra nueva fase 2.bc3'); // ':' saneado del nombre
    expect(new TextDecoder('windows-1252').decode(bytes)).toContain('|Obra nueva: fase 2|');
  });
});
