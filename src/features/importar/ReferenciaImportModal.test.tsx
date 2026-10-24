import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BASES_OFICIALES, fechaIso, fuenteDe, nombreReferencia } from '../../core/basesOficiales';
import { useObraStore, useToastStore } from '../../store';
import { importObraAsReference, newObra, useSessionStore } from '../../persist';
import { EscritorZip } from '../../persist/zip';
import { ReferenciaImportModal } from './ReferenciaImportModal';

// Solo se sustituyen el guardado como referencia y la obra en blanco
// (IndexedDB): el resto de la persistencia (sessionStore) es el real.
vi.mock('../../persist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../persist')>()),
  importObraAsReference: vi.fn(),
  newObra: vi.fn(),
}));
const importRef = vi.mocked(importObraAsReference);
const nuevaObra = vi.mocked(newObra);

/** .bc3 mínimo y válido (un capítulo, una partida de 5 € × 10): docs/spike/samples
 *  no viaja en git, así que los tests de E0 no dependen de él. */
function bc3File(name = 'base mini.bc3'): File {
  const recs = [
    '~V|prog|FIEBDC-3/2016|prog|||ANSI||2|||',
    '~C|R##||Base mini|50|010101|0|',
    '~C|C1#||Cap uno|50|010101|0|',
    '~C|P1|m2|Partida uno|5|010101|0|',
    '~D|R##|C1\\1\\1|',
    '~D|C1#|P1\\1\\10|',
  ];
  return new File([new TextEncoder().encode(recs.join('\r\n') + '\r\n')], name);
}

/** Bytes de un Blob con FileReader (el Blob de jsdom no tiene `arrayBuffer()`). */
function leer(b: Blob): Promise<Uint8Array> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => rej(fr.error);
    fr.readAsArrayBuffer(b);
  });
}

function soltar(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const confirmar = () => screen.getByRole('button', { name: 'Añadir como referencia' });

beforeEach(() => {
  useObraStore.getState().reset();
  useSessionStore.setState({ obras: [], activeId: null, switching: false });
  useToastStore.setState({ msg: null });
  importRef.mockReset();
  nuevaObra.mockReset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReferenciaImportModal', () => {
  it('abre como diálogo NO destructivo (añade, no reemplaza) con el confirmar deshabilitado sin archivo', () => {
    render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Añadir base de referencia');
    expect(dialog).toHaveTextContent('no reemplaza la actual');
    // Nada que reemplazar: no debe haber copy de "Reemplazar".
    expect(dialog).not.toHaveTextContent('Reemplazar');
    // Sin .bc3 parseado todavía → confirmar deshabilitado (no crea obras vacías).
    expect(confirmar()).toBeDisabled();
  });

  it('no renderiza nada cuando está cerrado', () => {
    render(<ReferenciaImportModal open={false} onClose={() => {}} compact={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/* Contrato de regresión E0 (docs/plan-bases-oficiales.md, R7/D11): lo que hace
   hoy el modal y las bases oficiales no pueden cambiar. */
describe('ReferenciaImportModal — contrato de regresión (E0)', () => {
  it('(1) con obra activa, soltar un .bc3 y confirmar lo guarda como referencia, lo selecciona y cierra', async () => {
    useSessionStore.setState({ activeId: 'obra-activa' });
    importRef.mockResolvedValue('ref-1');
    const onClose = vi.fn();
    const capitulosAntes = useObraStore.getState().chapters.length;
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(importRef).toHaveBeenCalledTimes(1);
    expect(importRef.mock.calls[0]?.[0].obra.denominacion).toBe('Base mini');
    const s = useObraStore.getState();
    expect(s.refSourceId).toBe('obra:ref-1');
    expect(s.lateral).toBe('ref'); // panel Referencia abierto
    expect(s.chapters).toHaveLength(capitulosAntes); // la obra activa no se toca
    expect(useToastStore.getState().msg).toBe('«Base mini» añadida como referencia');
  });

  it('(2) con la app vacía, el .bc3 soltado se carga como presupuesto (loadObra)', async () => {
    const onClose = vi.fn();
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(importRef).not.toHaveBeenCalled();
    const s = useObraStore.getState();
    expect(s.chapters).toHaveLength(1);
    expect(s.obra.denominacion).toBe('Base mini');
    expect(useToastStore.getState().msg).toBe('«Base mini» cargada');
  });

  it('(3) si falla el guardado, enseña el error genérico y deja reintentar', async () => {
    useSessionStore.setState({ activeId: 'obra-activa' });
    importRef.mockRejectedValueOnce(new Error('IDB caído')).mockResolvedValueOnce('ref-2');
    const onClose = vi.fn();
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    expect(
      await screen.findByText('No se pudo guardar la obra de referencia. Inténtalo de nuevo.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmar()).toBeEnabled();

    fireEvent.click(confirmar());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(importRef).toHaveBeenCalledTimes(2);
    expect(useObraStore.getState().refSourceId).toBe('obra:ref-2');
  });

  it('(4) cerrar y reabrir empieza en blanco', async () => {
    const { container, rerender } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();

    rerender(<ReferenciaImportModal open={false} onClose={() => {}} compact={false} />);
    rerender(<ReferenciaImportModal open onClose={() => {}} compact={false} />);

    expect(screen.queryByText('base mini.bc3')).toBeNull();
    expect(confirmar()).toBeDisabled();
  });
});

/* Bases oficiales (docs/plan-bases-oficiales.md). La red va simulada: `fetch`
   devuelve el .bc3 mínimo de arriba, falla, o se queda colgado hasta abortar. */
describe('ReferenciaImportModal — bases oficiales', () => {
  const ex = BASES_OFICIALES.find((b) => b.id === 'extremadura')!;
  const bcca = BASES_OFICIALES.find((b) => b.id === 'bcca')!;
  const madrid = BASES_OFICIALES.find((b) => b.id === 'madrid')!;

  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  const responderBc3 = async () => {
    const b = await leer(bc3File());
    fetchMock.mockImplementation(() => Promise.resolve(new Response(b as BlobPart)));
  };
  const fallar = () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
  /** fetch que no acaba hasta que se aborta; guarda las señales. */
  const colgado = () => {
    const senales: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (_u, init) =>
        new Promise((_res, rej) => {
          senales.push(init!.signal!);
          init!.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
        }),
    );
    return senales;
  };
  const fila = (id: string) => document.querySelector(`[data-base="${id}"]`) as HTMLElement;
  const botonDe = (id: string, nombre: string) => within(fila(id)).getByRole('button', { name: nombre });
  const zona = (container: HTMLElement) =>
    (container.querySelector('input[type="file"]') as HTMLElement).parentElement as HTMLElement;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('open', vi.fn());
    useSessionStore.setState({ activeId: 'obra-activa' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lista la BCCA y Extremadura para descargar, y Madrid solo con su página', () => {
    render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    expect(botonDe('bcca', 'Descargar y añadir')).toBeEnabled();
    expect(botonDe('extremadura', 'Descargar y añadir')).toBeEnabled();
    expect(botonDe('madrid', 'Abrir página oficial')).toBeEnabled();
    expect(fila('extremadura')).toHaveTextContent('Publicada para redactores de proyectos');
  });

  it('descarga Extremadura y la guarda con el nombre y la fuente del catálogo (D15, D6)', async () => {
    await responderBc3();
    importRef.mockResolvedValue('ref-ex');
    const onClose = vi.fn();
    render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
    expect(await screen.findByText('BCEXTGREM_26_v1.bc3')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(ex.descarga!.url, expect.objectContaining({ credentials: 'omit' }));
    fireEvent.click(confirmar());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const [data, fuente] = importRef.mock.calls[0]!;
    expect(data.obra.denominacion).toBe(nombreReferencia(ex));
    expect(fuente).toEqual(fuenteDe(ex, new Date()));
    expect(fuente?.descargadaEl).toBe(fechaIso(new Date()));
    expect(useObraStore.getState().refSourceId).toBe('obra:ref-ex');
  });

  it('una descarga cada vez: filas, zona de soltar y «Añadir» se apagan (D7)', async () => {
    colgado();
    const { container } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(botonDe('extremadura', 'Descargar y añadir')).toBeDisabled();
    expect(botonDe('bcca', 'Descargar y añadir')).toBeDisabled();
    expect(botonDe('madrid', 'Abrir página oficial')).toBeDisabled();
    expect(confirmar()).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Descargando BPC Extremadura' })).toBeInTheDocument();
    expect(zona(container)).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(botonDe('bcca', 'Descargar y añadir'));
    soltar(container, bc3File()); // soltar durante la descarga no hace nada
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('base mini.bc3')).toBeNull();
  });

  it('un resumen viejo se borra al empezar otra descarga: no se guarda con la fuente nueva (D13)', async () => {
    colgado();
    const { container } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    expect(confirmar()).toBeEnabled();

    fireEvent.click(botonDe('bcca', 'Descargar y añadir'));
    expect(screen.queryByText('base mini.bc3')).toBeNull();
    expect(confirmar()).toBeDisabled();
  });

  it('Cancelar descarga y desmontar el modal abortan el fetch', async () => {
    const senales = colgado();
    const { unmount } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);

    fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
    await vi.waitFor(() => expect(senales).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar descarga' }));
    await vi.waitFor(() => expect(botonDe('extremadura', 'Descargar y añadir')).toBeEnabled());
    expect(senales[0]!.aborted).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull(); // cancelar no es un error

    fireEvent.click(botonDe('bcca', 'Descargar y añadir'));
    await vi.waitFor(() => expect(senales).toHaveLength(2));
    unmount(); // cerrar el modal lo desmonta (App)
    expect(senales[1]!.aborted).toBe(true);
  });

  it('si la descarga falla, la zona de soltar queda asociada a esa base y lo soltado lleva su fuente (D14)', async () => {
    fallar();
    importRef.mockResolvedValue('ref-b');
    const { container } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);

    fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo descargar desde la web oficial');
    expect(screen.getByText('Suelta aquí el fichero de BPC Extremadura')).toBeInTheDocument();

    soltar(container, bc3File('BCEXTGREM_26_v1.bc3'));
    expect(await screen.findByText('BCEXTGREM_26_v1.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());
    await vi.waitFor(() => expect(importRef).toHaveBeenCalled());
    expect(importRef.mock.calls[0]![1]?.baseId).toBe('extremadura');
    expect(importRef.mock.calls[0]![0].obra.denominacion).toBe(nombreReferencia(ex));
  });

  it('Madrid con la app vacía: abre su página y lo soltado entra como referencia, no como presupuesto (D3, D9)', async () => {
    useSessionStore.setState({ activeId: null });
    nuevaObra.mockImplementation(async () => {
      useSessionStore.setState({ activeId: 'en-blanco' });
      return 'en-blanco';
    });
    importRef.mockResolvedValue('ref-m');
    const capitulosAntes = useObraStore.getState().chapters.length;
    const onClose = vi.fn();
    const { container } = render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    fireEvent.click(botonDe('madrid', 'Abrir página oficial'));
    expect(window.open).toHaveBeenCalledWith(madrid.pagina, '_blank', 'noopener');
    soltar(container, bc3File('madrid.bc3'));
    expect(await screen.findByText('madrid.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(nuevaObra).toHaveBeenCalledTimes(1);
    expect(importRef.mock.calls[0]![1]).toEqual(fuenteDe(madrid, new Date()));
    expect(useObraStore.getState().chapters).toHaveLength(capitulosAntes); // no se cargó como presupuesto
  });

  it('sin obra activa, si no se puede crear la obra en blanco no se guarda nada', async () => {
    useSessionStore.setState({ activeId: null });
    nuevaObra.mockResolvedValue(null);
    await responderBc3();
    const onClose = vi.fn();
    render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
    expect(await screen.findByText('BCEXTGREM_26_v1.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());
    await vi.waitFor(() => expect(nuevaObra).toHaveBeenCalled());
    await vi.waitFor(() => expect(confirmar()).toBeEnabled());
    expect(importRef).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el ZIP de la BCCA soltado a mano con la base asociada se abre', async () => {
    fallar();
    importRef.mockResolvedValue('ref-z');
    const z = new EscritorZip();
    await z.anadir('BCCA2023_V02.bc3', await leer(bc3File()), true);
    const zip = new File([z.cerrar()], 'BCCA2023_V02.zip');
    const { container } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);

    fireEvent.click(botonDe('bcca', 'Descargar y añadir'));
    await screen.findByText('Suelta aquí el fichero de BCCA');
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', '.bc3,.zip');
    soltar(container, zip);
    expect(await screen.findByText('BCCA2023_V02.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());
    await vi.waitFor(() => expect(importRef).toHaveBeenCalledTimes(1));
    expect(importRef.mock.calls[0]![1]?.baseId).toBe('bcca');
  });

  it('«No es esta base» vuelve a la zona normal: lo soltado va sin fuente', async () => {
    fallar();
    importRef.mockResolvedValue('ref-n');
    const { container } = render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    fireEvent.click(botonDe('bcca', 'Descargar y añadir'));
    await screen.findByText('Suelta aquí el fichero de BCCA');
    fireEvent.click(screen.getByRole('button', { name: 'No es esta base' }));
    expect(screen.queryByText('Suelta aquí el fichero de BCCA')).toBeNull();

    soltar(container, bc3File());
    expect(await screen.findByText('base mini.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());
    await vi.waitFor(() => expect(importRef).toHaveBeenCalled());
    expect(importRef.mock.calls[0]![1]).toBeUndefined();
    expect(importRef.mock.calls[0]![0].obra.denominacion).toBe('Base mini');
  });

  it('avisa antes de descargar si no cabe, y deja descargar igualmente (D8)', async () => {
    const estimate = vi.fn(() => Promise.resolve({ usage: 0, quota: 10_000_000 }));
    Object.defineProperty(navigator, 'storage', { value: { estimate }, configurable: true });
    try {
      await responderBc3();
      render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);

      fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Puede que no quepa');
      expect(fetchMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Descargar igualmente' }));
      expect(await screen.findByText('BCEXTGREM_26_v1.bc3')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(navigator, 'storage');
    }
  });

  it('con la cuota llena al guardar dice qué hacer, sin «Inténtalo de nuevo» (D8)', async () => {
    await responderBc3();
    importRef.mockRejectedValue(new DOMException('lleno', 'QuotaExceededError'));
    render(<ReferenciaImportModal open onClose={() => {}} compact={false} />);
    fireEvent.click(botonDe('extremadura', 'Descargar y añadir'));
    expect(await screen.findByText('BCEXTGREM_26_v1.bc3')).toBeInTheDocument();
    fireEvent.click(confirmar());
    expect(
      await screen.findByText('No cabe en el navegador: borra alguna referencia o libera espacio de planos.'),
    ).toBeInTheDocument();
  });

  it('si ya la tienes, «Usar» la selecciona sin descargar; otra edición se avisa', async () => {
    const meta = (id: string, fuente: ReturnType<typeof fuenteDe>) => ({
      id,
      name: id,
      savedAt: '2026-10-24T00:00:00Z',
      schemaVersion: 1,
      kind: 'reference' as const,
      fuente,
    });
    useSessionStore.setState({
      obras: [
        meta('ya-bcca', fuenteDe(bcca, new Date())),
        meta('ex-vieja', { ...fuenteDe(ex, new Date()), edicion: '2025' }),
      ],
    });
    const onClose = vi.fn();
    render(<ReferenciaImportModal open onClose={onClose} compact={false} />);

    expect(fila('extremadura')).toHaveTextContent('Tienes la edición 2025: esta se añade aparte.');
    expect(fila('bcca')).toHaveTextContent('Ya la tienes como referencia.');
    fireEvent.click(botonDe('bcca', 'Usar'));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useObraStore.getState().refSourceId).toBe('obra:ya-bcca');
  });
});
