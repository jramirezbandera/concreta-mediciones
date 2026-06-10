import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportDocx } from './docx';
import { useObraStore } from '../../store';

const { docxFor, downloadBlob } = vi.hoisted(() => ({
  docxFor: vi.fn(async () => ({ blob: new Blob(['x']), fileName: 'doc.docx' })),
  downloadBlob: vi.fn(),
}));
vi.mock('./docxRender', () => ({ docxFor }));
vi.mock('./download', () => ({ downloadBlob }));

beforeEach(() => {
  useObraStore.getState().reset();
  vi.clearAllMocks();
});

describe('exportDocx (import dinámico + descarga, F7.3)', () => {
  it('renderiza desde el estado de la obra y descarga con su nombre', async () => {
    await exportDocx({ kind: 'resumen' });
    expect(docxFor).toHaveBeenCalledWith(
      { kind: 'resumen' },
      expect.objectContaining({ chapters: expect.anything(), certs: expect.anything() }),
    );
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'doc.docx');
  });

  it('si el render devuelve null (cert inexistente), no descarga nada', async () => {
    docxFor.mockResolvedValueOnce(null as never);
    await exportDocx({ kind: 'cert', index: 99 });
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
