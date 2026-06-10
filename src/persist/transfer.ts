/* ===========================================================================
   transfer — export/import del proyecto como .json (F6.3). Portabilidad y copia
   de seguridad del único proyecto (multi-proyecto = T-10). Separado de `persist`
   (que habla con IndexedDB): aquí solo se serializa a/desde texto y se valida.

   · Export: `toSerializable` → sobre con metadatos → blob .json descargable.
   · Import: texto → parse → validación ESTRUCTURAL → `fromSerializable` (gate de
     schemaVersion) → `ObraData`. Errores LEGIBLES (`malformado` / versión
     desconocida). La operación es DESTRUCTIVA (reemplaza el proyecto), así que la
     confirmación + el backup previo viven en la UI (ProjectBackup).
   =========================================================================== */
import { fromSerializable, toSerializable, useObraStore, type ObraData } from '../store';
import { isObraData } from './persist';

const EXPORT_KIND = 'concreta-obra';
const APP_VERSION = '0.6';

/** Sobre de exportación: el dominio + metadatos de diagnóstico, autodescriptivo. */
export interface ObraExport {
  kind: typeof EXPORT_KIND;
  schemaVersion: number;
  exportedAt: string; // ISO 8601
  appVersion: string;
  data: ObraData;
}

/** Serializa el estado actual del dominio a texto JSON (sobre con metadatos). */
export function buildExportText(): string {
  const data = toSerializable(useObraStore.getState());
  const env: ObraExport = {
    kind: EXPORT_KIND,
    schemaVersion: data.schemaVersion,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    data,
  };
  return JSON.stringify(env, null, 2);
}

/** Descarga el proyecto como .json (copia portable). */
export function exportObraJson(filename = 'concreta-obra.json'): void {
  triggerDownload(buildExportText(), filename);
}

function triggerDownload(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Motivo de un import fallido, en mensaje legible. */
export type ImportErrorKind = 'malformado' | 'version-desconocida';

export class ImportError extends Error {
  constructor(public kind: ImportErrorKind) {
    super(kind);
    this.name = 'ImportError';
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Extrae el `ObraData` de lo parseado: acepta el sobre de export/guardado
 *  (`.data`) o un `ObraData` plano. `null` si no hay forma reconocible. */
function pickObraData(x: unknown): ObraData | null {
  if (isObraData(x)) return x;
  if (isRecord(x) && isObraData(x.data)) return x.data;
  return null;
}

/**
 * Parsea y valida un texto JSON de proyecto. Lanza `ImportError`:
 *   · `malformado`: no es JSON, o no contiene un `ObraData` estructuralmente sano.
 *   · `version-desconocida`: es un `ObraData` pero de un `schemaVersion` sin migración.
 * No toca el store: el llamador decide confirmar/cargar.
 */
export function parseObraJson(text: string): ObraData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('malformado');
  }
  const candidate = pickObraData(parsed);
  if (!candidate) throw new ImportError('malformado');
  try {
    return fromSerializable(candidate); // gate de schemaVersion
  } catch {
    throw new ImportError('version-desconocida');
  }
}

/**
 * Lee un `File` como texto. Usa `FileReader` (no `Blob.text()`): jsdom no
 * implementa `Blob.text`/`arrayBuffer` pero sí FileReader (igual que el import
 * .bc3 de F5.3).
 */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error ?? new Error('No se pudo leer el archivo'));
    fr.readAsText(file);
  });
}
