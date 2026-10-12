/* Páginas del mismo tamaño que una calibrada: a las que se ofrece su escala (§2). */
import { escalaDe } from '../../core/planoDatos';
import type { PlanoMeta } from '../../core/types';
import type { DocPdf, PaginaPdf } from './pdfTipos';

const mismaHoja = (a: PaginaPdf, b: PaginaPdf) =>
  Math.abs(a.vista[2] - a.vista[0] - (b.vista[2] - b.vista[0])) < 1 &&
  Math.abs(a.vista[3] - a.vista[1] - (b.vista[3] - b.vista[1])) < 1 &&
  a.rotacion === b.rotacion &&
  a.userUnit === b.userUnit;

/** Las páginas sin escala del mismo tamaño, rotación y `userUnit` que `desde`.
 *  `seguir` corta la búsqueda (el componente se desmontó); `progreso` cuenta. */
export async function paginasDelMismoTamano(
  doc: DocPdf,
  plano: PlanoMeta,
  desde: number,
  seguir: () => boolean = () => true,
  progreso?: (n: number) => void,
): Promise<number[]> {
  const base = await doc.pagina(desde);
  const out: number[] = [];
  for (let n = 1; n <= plano.paginas; n++) {
    if (!seguir()) return out;
    progreso?.(n);
    if (n === desde || escalaDe(plano, n)) continue;
    try {
      if (mismaHoja(await doc.pagina(n), base)) out.push(n);
    } catch {
      // una página que no se puede leer no se ofrece
    }
  }
  return out;
}
