import { useRef } from 'react';
import { Icon } from '../../components';
import styles from './ImportPartidaButton.module.css';

/**
 * Botón «Importar partida» (.bc3): camino accesible y descubrible para traer una
 * partida del Generador de Precios CYPE al capítulo activo (alternativa al
 * arrastrar el fichero). Autocontenido: abre un selector y delega en
 * `importPartidaFromFile` (toast + colisiones por el ConflictModal).
 */
export function ImportPartidaButton({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        title="Importar una partida desde un .bc3 (Generador de Precios CYPE, icono FIE BDC)"
        aria-label="Importar partida desde .bc3"
        onClick={() => inputRef.current?.click()}
        className={`t150 tcol ${styles.btn}`}
      >
        <Icon name="plus" size={compact ? 16 : 14} />
        {!compact && 'Importar partida'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".bc3"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Import dinámico: el parser FIEBDC (~117 KB) NO entra en el bundle
          // inicial; se carga solo al importar (igual que ImportarView).
          if (f) void import('./importPartida').then((m) => m.importPartidaFromFile(f));
          e.target.value = ''; // permite reimportar el mismo fichero
        }}
      />
    </>
  );
}
