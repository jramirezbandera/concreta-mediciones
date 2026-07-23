/* ===========================================================================
   features/asistente/AjustesIA — ajustes del asistente (clave + privacidad).
   ---------------------------------------------------------------------------
   F-A2: solo Google Gemini (OpenAI/Anthropic llegan en F-A5). Deja poner la clave
   propia (BYOK), avisa cuando se usa la clave compartida gratuita, y muestra la
   NOTA DE PRIVACIDAD (qué datos salen del navegador y hacia dónde) — decisión de
   la revisión de diseño (D15): nota en ajustes, sin consentimiento bloqueante.
   =========================================================================== */
import { Modal } from '../../components/Modal';
import { AI_PROVIDER_KEY_URLS, selectActiveKey, useAiSettings } from '../../ai';
import styles from './AjustesIA.module.css';

export interface AjustesIAProps {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
}

export function AjustesIA({ open, onClose, compact }: AjustesIAProps) {
  const geminiKey = useAiSettings((s) => s.keys.gemini) ?? '';
  const setKey = useAiSettings((s) => s.setKey);
  const { usingSharedKey } = selectActiveKey();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asistente de IA"
      subtitle="Google Gemini"
      icon="assistant"
      compact={compact}
      closeOnOverlay={false}
    >
      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>Tu clave de API (opcional)</span>
          <input
            type="password"
            className={styles.input}
            value={geminiKey}
            onChange={(e) => setKey('gemini', e.target.value)}
            placeholder="AIza… o AQ.…"
            autoComplete="off"
            spellCheck={false}
          />
          <a
            className={styles.getKey}
            href={AI_PROVIDER_KEY_URLS.gemini}
            target="_blank"
            rel="noopener noreferrer"
          >
            Obtener una clave de Google →
          </a>
        </label>

        {usingSharedKey ? (
          <p className={styles.shared}>
            Estás usando la clave compartida de Concreta: gratis, con un límite de uso diario
            entre todos. Si se agota, añade tu propia clave (arriba) para tener tu cupo.
          </p>
        ) : geminiKey ? (
          <p className={styles.note}>Usando tu clave. Tu cupo es solo tuyo.</p>
        ) : (
          <p className={styles.warn}>
            No hay clave configurada ni compartida disponible: el asistente no podrá responder
            hasta que añadas una.
          </p>
        )}

        <div className={styles.privacy}>
          <span className={styles.privacyTitle}>Privacidad</span>
          <p>
            Tus consultas y un resumen de la obra (capítulos, partidas, precios y
            certificaciones) se envían a Google para poder responderte. Hasta ahora la app
            funciona 100 % en tu navegador; el asistente es la única parte que sale a la red.
          </p>
        </div>
      </div>
    </Modal>
  );
}
