import { useObraStore, useToastStore } from '../store';

/**
 * Borra una partida mostrando un toast «Deshacer» (~6 s) que la restaura con su
 * identidad y posición intactas. Único punto de borrado de partidas (menú ⋮ y
 * atajo Supr) para que el modelo de seguridad sea coherente. No es un hook:
 * lee el estado por `getState`, así sirve tanto en componentes como en el
 * listener global de teclado.
 */
export function deletePartidaWithUndo(chapterId: string, partidaId: string): void {
  const st = useObraStore.getState();
  const list = st.partidas[chapterId] ?? [];
  const index = list.findIndex((p) => p.id === partidaId);
  if (index < 0) return;
  const snapshot = structuredClone(list[index]!);
  const title = snapshot.title?.trim() || snapshot.code || 'Partida';
  st.deletePartida(chapterId, partidaId);
  useToastStore.getState().show(`«${title}» eliminada`, {
    label: 'Deshacer',
    run: () => useObraStore.getState().restorePartida(chapterId, snapshot, index),
  });
}

/** Capítulo (clave del `PartidasMap`) que contiene una partida, o `null`. */
export function chapterIdOfPartida(partidaId: string): string | null {
  const { partidas } = useObraStore.getState();
  for (const [chId, list] of Object.entries(partidas)) {
    if (list?.some((p) => p.id === partidaId)) return chId;
  }
  return null;
}
