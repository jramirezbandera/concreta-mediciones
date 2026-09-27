/* ===========================================================================
   features/planos/ejemplo — «Planos (ejemplo)» del sandbox (§10): una obra con
   un plano A3 a 1:50 ya calibrado y comprobado (un tabique de 5,00 m y una
   estancia de 20,00 m²) y dos partidas, por metros y por m². No toca las obras
   guardadas: la pestaña deja de guardar y el PDF vive solo en memoria.
   Objetivo: medir algo en menos de 3 minutos desde `npm run dev`.
   =========================================================================== */
import { escalaN, mPorUnidadDeCota } from '../../core/planoGeom';
import { huellaDe } from '../../core/sha256';
import type { Partida, PlanoMeta } from '../../core/types';
import { aislarPestana } from '../../persist';
import { registrarBytesEnMemoria } from '../../persist/planos';
import { blankObraData, useObraStore } from '../../store';
import { usePlanoUiStore } from '../../store/planoUiStore';
import { METRO_1_50, planoEjemplo } from '../../test/pdfMinimo';

export const EJEMPLO = {
  planoId: 'pl-ejemplo',
  capitulo: 'ch-ejemplo',
  tabique: 'p-ej-tabique',
  solado: 'p-ej-solado',
  /** El tabique del PDF, en coordenadas de página (5,00 m). */
  tabiqueDe: [150, 200 + 6 * METRO_1_50] as [number, number],
  tabiqueA: [150 + 5 * METRO_1_50, 200 + 6 * METRO_1_50] as [number, number],
};

function partida(id: string, pos: string, code: string, title: string, ud: string, medForma?: Partida['medForma']): Partida {
  return { id, pos, code, title, ud, precio: 20, desc: '', med: [], items: [], ...(medForma ? { medForma } : {}) };
}

/** Carga la obra de ejemplo en el store y abre el visor sobre su plano. */
export async function abrirEjemploPlanos(): Promise<void> {
  aislarPestana();
  const bytes = planoEjemplo();
  const buf = bytes.buffer as ArrayBuffer;
  const huella = await huellaDe(buf);
  registrarBytesEnMemoria(huella, buf);
  const m = METRO_1_50;
  const ref = { a: [100, 120] as [number, number], b: [100 + 10 * m, 120] as [number, number], metros: 10 };
  const mPorUnidad = mPorUnidadDeCota(ref.a, ref.b, ref.metros);
  const plano: PlanoMeta = {
    id: EJEMPLO.planoId,
    tipo: 'pdf',
    nombre: 'Planta baja (ejemplo)',
    archivo: 'planta-baja-ejemplo.pdf',
    tamano: bytes.byteLength,
    huella,
    paginas: 1,
    etiquetas: { 1: 'PB' },
    escalas: {
      1: {
        rev: 'cal-ejemplo',
        mPorUnidad,
        n: escalaN(mPorUnidad),
        ref,
        comprobacion: {
          fuente: 'cota',
          a: [1000, 100],
          b: [1000, 100 + 6 * m],
          metros: 6,
          medidos: Math.round(6 * m * mPorUnidad * 1e6) / 1e6,
          desviacion: 0,
        },
        at: new Date().toISOString(),
      },
    },
  };
  const data = blankObraData('Planos (ejemplo)');
  data.chapters = [{ id: EJEMPLO.capitulo, code: '1', title: 'Albañilería y acabados', children: [] }];
  data.partidas = {
    [EJEMPLO.capitulo]: [
      partida(EJEMPLO.tabique, '1.1', 'FFR010', 'Tabique de ladrillo hueco doble', 'm'),
      partida(EJEMPLO.solado, '1.2', 'RSG010', 'Solado de baldosa cerámica', 'm²', 'area'),
    ],
  };
  data.planos = [plano];
  const store = useObraStore.getState();
  store.loadObra(data);
  store.revealPartida(EJEMPLO.tabique, EJEMPLO.capitulo, null);
  usePlanoUiStore.getState().reset();
  usePlanoUiStore.setState({ docToken: useObraStore.getState().docToken });
  usePlanoUiStore.getState().setDisponible(huella, true);
  usePlanoUiStore.getState().abrirPlano(EJEMPLO.planoId, 1);
  store.setPlanosOpen(true);
}
