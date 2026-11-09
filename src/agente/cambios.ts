/* ===========================================================================
   agente/cambios — qué cambió entre dos versiones de una obra.
   ---------------------------------------------------------------------------
   Para el aviso de la app cuando la obra cambia en su carpeta (lo cambió el
   agente u otra app): «+2 partidas · +14 líneas · 1 partida cambiada», y las
   partidas que resaltar (docs/plan-agente-carpeta.md D3). Puro, sin store.
   =========================================================================== */
import type { Chapter, Partida, PartidasMap } from '../core/types';
import { flattenContainers } from '../core/tree';
import type { ObraData } from '../store';

type Datos = Pick<ObraData, 'chapters' | 'partidas'> & Partial<ObraData>;

export interface Cambios {
  hayCambios: boolean;
  /** Ids de las partidas nuevas o cambiadas (para resaltarlas). */
  partidasTocadas: string[];
  partidasNuevas: number;
  partidasBorradas: number;
  partidasCambiadas: number;
  lineasNuevas: number;
  lineasBorradas: number;
  contenedoresNuevos: number;
  contenedoresBorrados: number;
  /** Otras partes que cambiaron (porcentajes, ficha, certificaciones…). */
  otros: string[];
  /** «+2 partidas · +14 líneas · 1 partida cambiada». */
  texto: string;
}

function porId(partidas: PartidasMap): Map<string, Partida> {
  const m = new Map<string, Partida>();
  for (const lista of Object.values(partidas)) for (const p of lista ?? []) m.set(p.id, p);
  return m;
}

function idsContenedores(chapters: Chapter[]): Set<string> {
  const s = new Set<string>();
  for (const ch of chapters) {
    s.add(ch.id);
    for (const f of flattenContainers(ch)) s.add(f.sub.id);
  }
  return s;
}

const igual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

const OTROS: [keyof ObraData, string][] = [
  ['rates', 'porcentajes'],
  ['obra', 'ficha de la obra'],
  ['certs', 'certificaciones'],
  ['planos', 'planos'],
  ['recursos', 'banco de recursos'],
  ['estudioRcd', 'estudio de residuos'],
  ['planCalidad', 'plan de calidad'],
  ['seguridadSalud', 'seguridad y salud'],
  ['ofertas', 'ofertas'],
];

const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;

export function compararObras(antes: Datos, despues: Datos): Cambios {
  const a = porId(antes.partidas);
  const d = porId(despues.partidas);
  const tocadas: string[] = [];
  let nuevas = 0;
  let cambiadas = 0;
  let lineasNuevas = 0;
  let lineasBorradas = 0;
  for (const [id, p] of d) {
    const q = a.get(id);
    if (!q) {
      nuevas++;
      lineasNuevas += p.med.length;
      tocadas.push(id);
      continue;
    }
    if (q === p || igual(q, p)) continue;
    const idsAntes = new Set(q.med.map((l) => l.id));
    const idsDespues = new Set(p.med.map((l) => l.id));
    const mas = p.med.filter((l) => !idsAntes.has(l.id)).length;
    const menos = q.med.filter((l) => !idsDespues.has(l.id)).length;
    lineasNuevas += mas;
    lineasBorradas += menos;
    // Solo líneas añadidas o quitadas no cuenta como «partida cambiada» en el texto.
    const sinMed = (x: Partida) => ({ ...x, med: undefined });
    const lineasIguales = q.med
      .filter((l) => idsDespues.has(l.id))
      .every((l) =>
        igual(
          l,
          p.med.find((x) => x.id === l.id),
        ),
      );
    if (!igual(sinMed(q), sinMed(p)) || !lineasIguales) cambiadas++;
    tocadas.push(id);
  }
  let borradas = 0;
  for (const [id, q] of a) {
    if (!d.has(id)) {
      borradas++;
      lineasBorradas += q.med.length;
    }
  }
  const ca = idsContenedores(antes.chapters);
  const cd = idsContenedores(despues.chapters);
  const contNuevos = [...cd].filter((id) => !ca.has(id)).length;
  const contBorrados = [...ca].filter((id) => !cd.has(id)).length;
  const otros = OTROS.filter(([k]) => !igual(antes[k], despues[k])).map(([, t]) => t);
  // Renombrar o reordenar capítulos, sin crear ni borrar, también es un cambio.
  const estructura =
    !igual(antes.chapters, despues.chapters) && contNuevos === 0 && contBorrados === 0;
  if (estructura) otros.unshift('capítulos');

  const trozos = [
    contNuevos && `+${n(contNuevos, 'capítulo', 'capítulos')}`,
    nuevas && `+${n(nuevas, 'partida', 'partidas')}`,
    lineasNuevas && `+${n(lineasNuevas, 'línea', 'líneas')}`,
    cambiadas && n(cambiadas, 'partida cambiada', 'partidas cambiadas'),
    lineasBorradas && `−${n(lineasBorradas, 'línea', 'líneas')}`,
    borradas && `−${n(borradas, 'partida', 'partidas')}`,
    contBorrados && `−${n(contBorrados, 'capítulo', 'capítulos')}`,
    otros.length && otros.join(', '),
  ].filter((x): x is string => !!x);

  return {
    hayCambios: trozos.length > 0,
    partidasTocadas: tocadas,
    partidasNuevas: nuevas,
    partidasBorradas: borradas,
    partidasCambiadas: cambiadas,
    lineasNuevas,
    lineasBorradas,
    contenedoresNuevos: contNuevos,
    contenedoresBorrados: contBorrados,
    otros,
    texto: trozos.join(' · '),
  };
}
