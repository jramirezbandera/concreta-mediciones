import { useRef } from 'react';
import { Icon } from '../../components';
import { useToastStore } from '../../store';
import styles from './ImportPartidaButton.module.css';

/**
 * Botón «Importar partidas» (.bc3): camino accesible y descubrible para traer
 * partidas del Generador de Precios CYPE al capítulo activo (alternativa al
 * arrastrar los ficheros). Autocontenido: abre un selector MÚLTIPLE (CYPE baja
 * una partida por archivo, así que un capítulo son 10-15 descargas) y delega en
 * `importPartidasFromFiles` (toast + colisiones por el ConflictModal).
 */
export function ImportPartidaButton({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        title="Importar partidas desde .bc3 (Generador de Precios CYPE, icono FIE BDC). Puedes elegir varios archivos a la vez."
        aria-label="Importar partidas desde .bc3"
        onClick={() => inputRef.current?.click()}
        className={`t150 tcol ${styles.btn}`}
      >
        <Icon name="plus" size={compact ? 16 : 14} />
        {!compact && 'Importar partidas'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".bc3"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Import dinámico: el parser FIEBDC (~117 KB) NO entra en el bundle
          // inicial; se carga solo al importar (igual que ImportarView). El
          // .catch (E-05): si el chunk no carga (offline, deploy que purgó los
          // assets de la sesión), el clic dejaba de hacer nada sin rastro.
          if (files.length > 0)
            void import('./importPartida')
              .then((m) => m.importPartidasFromFiles(files))
              .catch(() =>
                useToastStore.getState().show('No se pudo cargar el importador. Recarga la página.'),
              );
          e.target.value = ''; // permite reimportar los mismos ficheros
        }}
      />
    </>
  );
}
