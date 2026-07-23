/* ===========================================================================
   features/asistente/AjustesIA — ajustes del asistente (proveedor + clave + privacidad).
   ---------------------------------------------------------------------------
   F-A5: selector de proveedor (Google Gemini · OpenAI GPT). Gemini trae clave
   compartida gratuita (con límite) + BYOK; OpenAI es BYOK puro (sin clave
   compartida). Deja poner la clave propia por proveedor, avisa cuando se usa la
   compartida, y muestra la NOTA DE PRIVACIDAD (qué datos salen y hacia dónde) —
   decisión de diseño (D15): nota en ajustes, sin consentimiento bloqueante.

   Anthropic NO se ofrece: el envelope excede su tope de 16 uniones (ver
   providers/schemaConvert). La unión de tipos lo conserva por contrato.
   =========================================================================== */
import { Modal } from '../../components/Modal';
import {
  AI_PROVIDER_KEY_URLS,
  AI_PROVIDER_LABELS,
  selectActiveKey,
  useAiSettings,
  type AiProviderId,
} from '../../ai';
import styles from './AjustesIA.module.css';

export interface AjustesIAProps {
  open: boolean;
  onClose: () => void;
  compact?: boolean;
}

/** Proveedores ofrecidos en la UI (Anthropic queda fuera; ver cabecera). */
const OFFERED: readonly Extract<AiProviderId, 'gemini' | 'openai'>[] = ['gemini', 'openai'];

const KEY_PLACEHOLDER: Record<AiProviderId, string> = {
  gemini: 'AIza… o AQ.…',
  openai: 'sk-…',
  anthropic: 'sk-ant-…',
};
const KEY_COMPANY: Record<AiProviderId, string> = {
  gemini: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

export function AjustesIA({ open, onClose, compact }: AjustesIAProps) {
  const provider = useAiSettings((s) => s.provider);
  const setProvider = useAiSettings((s) => s.setProvider);
  const key = useAiSettings((s) => s.keys[provider]) ?? '';
  const setKey = useAiSettings((s) => s.setKey);
  const { usingSharedKey } = selectActiveKey();

  const company = KEY_COMPANY[provider];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asistente de IA"
      subtitle={AI_PROVIDER_LABELS[provider]}
      icon="assistant"
      compact={compact}
      closeOnOverlay={false}
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.label}>Proveedor</span>
          <div className={styles.providers} role="group" aria-label="Proveedor de IA">
            {OFFERED.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.provider} ${provider === p ? styles.providerActive : ''}`}
                aria-pressed={provider === p}
                onClick={() => setProvider(p)}
              >
                {AI_PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            Tu clave de API{provider === 'gemini' ? ' (opcional)' : ''}
          </span>
          <input
            type="password"
            className={styles.input}
            value={key}
            onChange={(e) => setKey(provider, e.target.value)}
            placeholder={KEY_PLACEHOLDER[provider]}
            autoComplete="off"
            spellCheck={false}
          />
          <a
            className={styles.getKey}
            href={AI_PROVIDER_KEY_URLS[provider]}
            target="_blank"
            rel="noopener noreferrer"
          >
            Obtener una clave de {company} →
          </a>
        </label>

        {usingSharedKey ? (
          <p className={styles.shared}>
            Estás usando la clave compartida de Concreta: gratis, con un límite de uso diario
            entre todos. Si se agota, añade tu propia clave (arriba) para tener tu cupo.
          </p>
        ) : key ? (
          <p className={styles.note}>Usando tu clave. Tu cupo es solo tuyo.</p>
        ) : provider === 'openai' ? (
          <p className={styles.warn}>
            OpenAI necesita tu propia clave: no hay clave compartida gratuita. Añádela arriba
            para usar el asistente con GPT (mejor lectura de fotos manuscritas).
          </p>
        ) : (
          <p className={styles.warn}>
            No hay clave configurada ni compartida disponible: el asistente no podrá responder
            hasta que añadas una.
          </p>
        )}

        <div className={styles.privacy}>
          <span className={styles.privacyTitle}>Privacidad</span>
          <p>
            Tus consultas, las fotos que adjuntes y un resumen de la obra (capítulos, partidas,
            precios y certificaciones) se envían a {company} para poder responderte. Hasta ahora
            la app funciona 100 % en tu navegador; el asistente es la única parte que sale a la red.
          </p>
        </div>
      </div>
    </Modal>
  );
}
