/* ===========================================================================
   useRefIndex — indexación y búsqueda de una fuente de Referencia (F-06).
   ---------------------------------------------------------------------------
   Extraído de `ReferenciaPanel` (F-06): las derivaciones PURAS (agrupado por
   contenedor, recuento de subárbol, índice de búsqueda, etiquetas de ruta y la
   lista plana de coincidencias) que antes vivían como 5 `useMemo` encadenados
   en el componente. Aislarlas las hace testeables sin montar el panel (ver
   `useRefIndex.test.ts`) sin cambiar comportamiento. Los `useEffect` de UI
   (auto-apertura, reset de selección, invalidación de caché) se quedan en el
   panel: aquí solo hay lógica derivada.
   =========================================================================== */
import { useDeferredValue, useMemo } from 'react';
import { MIN_QUERY } from '../../core/buscar';
import type { RefPartida, RefSource } from '../../core/refdata';

/** Tope de resultados de la búsqueda en una base (no montar miles de filas). */
export const REF_SEARCH_CAP = 100;

/** Contenedor del árbol de referencia (capítulo o subcapítulo, N niveles). */
export type RefContainer = { id: string; code: string; title: string; children?: RefContainer[] };

/** Resultado del índice: agrupado por contenedor, recuentos, y búsqueda diferida. */
export interface RefIndex {
  /** Partidas por su contenedor INMEDIATO (clave = `sub` o id de capítulo). */
  bySub: Map<string, RefPartida[]>;
  /** Nº de partidas del subárbol de cada contenedor. */
  subtreeCount: Map<string, number>;
  /** Hay una búsqueda activa (query ≥ MIN_QUERY). */
  searching: boolean;
  /** Coincidencias planas (topadas) con la ruta de su subcapítulo. */
  search: { matches: { p: RefPartida; path: string }[]; truncated: boolean };
}

export function useRefIndex(source: RefSource | undefined, q: string): RefIndex {
  // Partidas agrupadas por su contenedor INMEDIATO: clave = `sub` de la partida, o
  // el id del capítulo para las que cuelgan directas de él. Es la base del árbol
  // recursivo (el .bc3 ya trae la jerarquía en `chapters[].children` + `sub`).
  const bySub = useMemo(() => {
    const m = new Map<string, RefPartida[]>();
    if (!source) return m;
    for (const ch of source.chapters)
      for (const p of source.partidas[ch.id] ?? []) {
        const key = p.sub ?? ch.id;
        const arr = m.get(key);
        if (arr) arr.push(p);
        else m.set(key, [p]);
      }
    return m;
  }, [source]);

  // Nº de partidas del subárbol de cada contenedor (recuento que se muestra y
  // umbral de auto-apertura). Una pasada por fuente.
  const subtreeCount = useMemo(() => {
    const m = new Map<string, number>();
    if (!source) return m;
    const walk = (node: RefContainer): number => {
      let n = (bySub.get(node.id) ?? []).length;
      for (const c of node.children ?? []) n += walk(c);
      m.set(node.id, n);
      return n;
    };
    for (const ch of source.chapters) walk(ch);
    return m;
  }, [source, bySub]);

  // Búsqueda diferida: teclear no bloquea por re-filtrar la base (CR-6). El índice
  // `haystack` se precomputa UNA vez por fuente (no se reconstruyen strings por
  // tecla) y los resultados se topan para no montar miles de filas.
  const dq = useDeferredValue(q);
  const query = dq.trim().toLowerCase();
  const searching = query.length >= MIN_QUERY;

  const chapterData = useMemo(
    () => (source ? source.chapters.map((ch) => ({ ch, ps: source.partidas[ch.id] ?? [] })) : []),
    [source],
  );

  // Índice `${code} ${title}` por partida. Se construye SOLO cuando hay búsqueda activa
  // (no recorrer 70k partidas al abrir la fuente si el usuario aún no busca — 2A/Codex).
  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    if (!searching) return m;
    for (const { ps } of chapterData)
      for (const p of ps) m.set(p.id, `${p.code} ${p.title}`.toLowerCase());
    return m;
  }, [searching, chapterData]);

  // Etiqueta de ruta por contenedor ("3 PRECIOS UNITARIOS ▸ 01 DEMOLICIONES"),
  // solo en búsqueda: ubica cada resultado en la jerarquía del banco.
  const pathLabels = useMemo(() => {
    const m = new Map<string, string>();
    if (!source || !searching) return m;
    const walk = (node: RefContainer, prefix: string) => {
      const label = prefix ? `${prefix} ▸ ${node.code} ${node.title}` : `${node.code} ${node.title}`;
      m.set(node.id, label);
      (node.children ?? []).forEach((c) => walk(c, label));
    };
    for (const ch of source.chapters) walk(ch, '');
    return m;
  }, [source, searching]);

  // Resultados de búsqueda: lista PLANA de coincidencias (tope global), cada una
  // con la ruta de su subcapítulo. Recorre todo el árbol vía `bySub` (clave por
  // contenedor) para no perder las partidas de subcapítulos profundos.
  const search = useMemo(() => {
    const matches: { p: RefPartida; path: string }[] = [];
    if (!searching || !source) return { matches, truncated: false };
    let truncated = false;
    outer: for (const ch of source.chapters)
      for (const p of source.partidas[ch.id] ?? []) {
        if (!(haystacks.get(p.id) ?? '').includes(query)) continue;
        if (matches.length >= REF_SEARCH_CAP) {
          truncated = true;
          break outer;
        }
        matches.push({ p, path: pathLabels.get(p.sub ?? ch.id) ?? '' });
      }
    return { matches, truncated };
  }, [searching, query, source, haystacks, pathLabels]);

  return { bySub, subtreeCount, searching, search };
}
