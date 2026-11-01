import { useState } from 'react';
import { Icon } from '../../components';
import { AiError } from '../../ai/types';
import { useObraStore, useToastStore } from '../../store';
import { getDomainRevision, undo } from '../../store/temporal';
import { SinClaveIa, sugerirResiduosIa } from './sugerirIa';
import styles from './Residuos.module.css';

const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;

/**
 * «Sugerir con IA» (E6, D15): pregunta por las partidas que las reglas no
 * reconocieron y las deja como propuestas para revisar. Nada se confirma solo.
 */
export function BotonSugerirIa() {
  const sinAsignar = useObraStore((s) => Object.values(s.partidas).some((ps) => (ps ?? []).some((p) => !p.rcd)));
  const abrirAsistente = useObraStore((s) => s.setAsistenteOpen);
  const [pensando, setPensando] = useState(false);
  if (!sinAsignar) return null;

  const sugerir = async () => {
    setPensando(true);
    const toast = useToastStore.getState();
    try {
      const r = await sugerirResiduosIa();
      const partes = [
        r.propuestas
          ? `${plural(r.propuestas, 'propuesta', 'propuestas')} para revisar${r.noGenera ? ` (${r.noGenera} «no genera»)` : ''}`
          : 'Ninguna propuesta nueva',
        r.noSe ? `${plural(r.noSe, 'partida', 'partidas')} que no supo clasificar` : '',
        r.fallos ? `falló una parte: ${r.error}` : '',
      ].filter(Boolean);
      toast.show(
        `IA: ${partes.join(' · ')}`,
        r.propuestas ? { label: 'Deshacer', run: () => undo() } : undefined,
        { rev: getDomainRevision(), tone: r.fallos ? 'warn' : 'ok' },
      );
    } catch (e) {
      if (e instanceof SinClaveIa) {
        toast.show(e.message, { label: 'Abrir ajustes', run: () => abrirAsistente(true) }, { tone: 'warn' });
      } else if (!(e instanceof AiError && e.kind === 'aborted')) {
        toast.show('No se pudo consultar a la IA. Reintenta en un momento.', undefined, { tone: 'error' });
      }
    } finally {
      setPensando(false);
    }
  };

  return (
    <button
      type="button"
      className={`tcol ${styles.btn}`}
      title="Pregunta a la IA por las partidas que las reglas no reconocen; lo que sugiera queda como propuesta para revisar"
      disabled={pensando}
      onClick={() => void sugerir()}
    >
      <Icon name="assistant" size={14} /> {pensando ? 'Consultando…' : 'Sugerir con IA'}
    </button>
  );
}
