/* ===========================================================================
   TrabajarConClaude — cómo poner a Claude a trabajar en la obra
   (docs/plan-agente-carpeta.md D5, F3): la obra en una carpeta, el conector
   (MCP) para Claude Desktop o Claude Code, y qué pedirle. Las descargas son las
   que publica el build junto a la app (`dist/mcp/`, scripts/mcp/empaquetar.mjs).
   =========================================================================== */
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { hayCarpetas, pasarACarpeta, useCarpetaStore } from '../../persist/carpeta';
import { useSessionStore } from '../../persist';
import { useToastStore } from '../../store';
import styles from './TrabajarConClaude.module.css';

const base = () => new URL(`${import.meta.env.BASE_URL}mcp/`, window.location.href).toString();

interface VersionMcp {
  version: string;
}

function Copiable({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className={styles.orden}>
      <code>{texto}</code>
      <button
        type="button"
        className={`tcol ${styles.copiar}`}
        aria-label="Copiar"
        title="Copiar"
        onClick={() => {
          void navigator.clipboard?.writeText(texto).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          });
        }}
      >
        <Icon name={copiado ? 'check' : 'copy'} size={13} />
      </button>
    </div>
  );
}

export function TrabajarConClaude({ onClose, compact }: { onClose: () => void; compact: boolean }) {
  const activeId = useSessionStore((s) => s.activeId);
  const carpeta = useCarpetaStore((s) => (activeId ? s.carpetas[activeId] : undefined));
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`${base()}version.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<VersionMcp>) : null))
      .then((v) => vivo && setVersion(v?.version ?? null))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const url = base();

  return (
    <Modal
      open
      onClose={onClose}
      compact={compact}
      icon="assistant"
      title="Trabajar con Claude"
      subtitle="Que Claude monte y revise el presupuesto de esta obra mientras lo ves aquí"
    >
      <div className={styles.cuerpo}>
        <p className={styles.intro}>
          Claude puede crear capítulos, partidas y líneas de medición, leer el resumen y decirte qué
          le falta al presupuesto. Trabaja sobre el fichero de la obra en su carpeta, y lo que
          cambia aparece aquí al momento: cada cambio suyo se deshace con Ctrl+Z. Los precios y las
          mediciones no se los inventa: se los das tú, o salen de los documentos que le pases.
        </p>

        <section className={styles.paso}>
          <h3>
            <span className={styles.num}>1</span> La obra, en una carpeta
          </h3>
          {carpeta ? (
            <p>
              <Icon name="check" size={13} /> Esta obra está en la carpeta{' '}
              <strong>{carpeta.carpeta}</strong> (<code>{carpeta.fichero}</code>).
            </p>
          ) : hayCarpetas() ? (
            <>
              <p>
                Claude trabaja sobre un fichero de tu ordenador. Pasa la obra a la carpeta del
                proyecto:
              </p>
              <button
                type="button"
                className={styles.boton}
                onClick={() =>
                  void pasarACarpeta().then((r) => {
                    if (r.mensaje)
                      useToastStore
                        .getState()
                        .show(r.mensaje, undefined, { tone: r.ok ? 'ok' : 'warn' });
                  })
                }
              >
                <Icon name="folder" size={14} /> Pasar a una carpeta…
              </button>
            </>
          ) : (
            <p className={styles.nota}>
              Este navegador no abre carpetas del ordenador: usa Chrome o Edge para trabajar con
              Claude.
            </p>
          )}
        </section>

        <section className={styles.paso}>
          <h3>
            <span className={styles.num}>2</span> El conector de Concreta Mediciones
          </h3>
          <p>
            <strong>Claude Desktop</strong>: descárgalo y ábrelo con doble clic (o arrástralo a la
            ventana de Claude).
          </p>
          <a className={styles.boton} href={`${url}concreta-mediciones.mcpb`} download>
            <Icon name="download" size={14} /> concreta-mediciones.mcpb
          </a>
          <p>
            <strong>Claude Code</strong>: en una terminal (necesita Node.js):
          </p>
          <Copiable texto={`claude plugin marketplace add ${url}marketplace.json`} />
          <Copiable texto="claude plugin install concreta-mediciones@concreta" />
          <p className={styles.nota}>
            Para actualizarlo: <code>claude plugin update concreta-mediciones@concreta</code>.
            {version ? ` Versión publicada: ${version}.` : ''}
          </p>
        </section>

        <section className={styles.paso}>
          <h3>
            <span className={styles.num}>3</span> Pídeselo
          </h3>
          <p>
            Dile la ruta de la carpeta de la obra (el navegador no la conoce) y lo que quieres, por
            ejemplo:
          </p>
          <blockquote className={styles.ejemplo}>
            En la obra de la carpeta D:\Obras\Calle Mayor 12, crea el capítulo de cimentación con la
            excavación de zanjas y el hormigón de limpieza. Las zanjas son de 0,60 × 0,80 m: 12 m en
            el eje A y 2 × 8 m en el eje B.
          </blockquote>
          <p>
            Claude ve qué partida tienes abierta: con la obra abierta aquí, basta con «ponle a esta
            partida la medición del plano A-02». Puedes seguir trabajando mientras tanto: lo suyo y
            lo tuyo se juntan sin preguntarte.
          </p>
        </section>
      </div>
    </Modal>
  );
}
