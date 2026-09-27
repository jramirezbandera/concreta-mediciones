/* ===========================================================================
   store/motivos — un texto por motivo (§4.3 y §7.2 de la especificación de
   planos). Cada texto dice el problema, la causa y, si lo hay, el arreglo; la
   acción que lo acompaña (un botón) la pone la interfaz.

   Dos familias:
   · `textoResultado`: por qué una acción del store no hizo nada (`MedResult`).
   · `textoMotivoMedida`: por qué no se puede medir o crear la línea en el
     visor (`core/planoMedida`).
   =========================================================================== */
import { medFormaDef } from '../core/medForma';
import { fmtNum } from '../core/money';
import { NOMBRE_HERRAMIENTA, type MotivoMedida } from '../core/planoMedida';
import type { MedResult } from './obraStore';

const plural = (n: number, uno: string, varios: string) => `${fmtNum(n, 0)} ${n === 1 ? uno : varios}`;
const certs = (nums: number[] | undefined) =>
  nums?.length ? ` en ${nums.map((n) => `C${n}`).join(', ')}` : '';

/** Texto de un `MedResult` sin éxito. `pegar` conserva los textos del pegado
 *  de líneas («No se pudo pegar: …»). */
export function textoResultado(r: Pick<MedResult, 'reason' | 'detalle'>, contexto: 'pegar' | 'planos' = 'planos'): string {
  const d = r.detalle ?? {};
  if (contexto === 'pegar') {
    return r.reason === 'no-partida'
      ? 'No se pudo pegar: la partida ya no existe'
      : 'No se pudo pegar: la medición cambió mientras tanto. Vuelve a intentarlo';
  }
  switch (r.reason) {
    case 'no-partida':
      return 'La partida ya no existe.';
    case 'no-plano':
      return 'Ese plano ya no está en la obra.';
    case 'no-lines':
      return 'La línea ya no existe.';
    case 'sin-calibrar':
      return 'Calibra esta página para medir longitudes y superficies. Recuento funciona sin escala.';
    case 'has-lines':
      return `Esta página ya tiene ${plural(d.n ?? 0, 'línea medida', 'líneas medidas')} con esta escala. Recalcularlas llega más adelante; para medir a otra escala, adjunta el PDF otra vez.`;
    case 'certificada':
      return `La línea ${d.linea ?? ''} está certificada${certs(d.certNums)}: revísala a mano.`.replace('línea  ', 'línea ');
    case 'stale':
      switch (d.cambio) {
        case 'escala':
          return 'La escala de esta página cambió mientras confirmabas: vuelve a medir.';
        case 'forma':
          return 'La partida cambió de forma de medir mientras confirmabas.';
        case 'linea':
          return `La línea ${d.linea ?? ''} cambió mientras confirmabas.`.replace('línea  ', 'línea ');
        case 'plano':
          return 'El plano cambió mientras confirmabas.';
        case 'obra':
          return 'Cambiaste de obra mientras confirmabas.';
        default:
          return 'Algo cambió mientras confirmabas: vuelve a intentarlo.';
      }
    case 'noop':
      return 'No había nada que cambiar.';
    default:
      return 'No se pudo hacer: vuelve a intentarlo.';
  }
}

const NOMBRE_FORMA_MIN: Record<string, string> = {
  ud: 'Unidades',
  lin: 'Longitud',
  sup: 'Superficie',
  area: 'Superficie directa',
  vol: 'Volumen',
  areaEsp: 'Superficie × espesor',
  peso: 'Peso',
};

/** Qué se mide con una fija que falta, en lenguaje de obra. */
function queMide(rotulo: string): string {
  if (/altura del paramento|multiplica/i.test(rotulo)) return 'paramentos';
  if (/espesor/i.test(rotulo)) return 'con espesor';
  if (/kg\/m/i.test(rotulo)) return 'el peso';
  return 'con esta herramienta';
}

/** Texto de un motivo del visor (medir o crear la línea). */
export function textoMotivoMedida(m: MotivoMedida): string {
  switch (m.motivo) {
    case 'sin-calibrar':
      return 'Calibra esta página para medir longitudes y superficies. Recuento funciona sin escala.';
    case 'no-encaja':
      return `Esta partida se mide por ${NOMBRE_FORMA_MIN[m.forma] ?? medFormaDef(m.forma).nombre}: usa ${NOMBRE_HERRAMIENTA[m.usa]}.`;
    case 'superficie-en-sup':
      return 'Esta partida se mide por Longitud × Anchura: ¿medirla por Superficie directa o usar Rectángulo?';
    case 'falta-dimension': {
      const r = m.rotulo.replace(/\s*\(.*\)$/, '');
      return `Indica la ${r} fija para medir ${queMide(m.rotulo)}.`;
    }
    case 'kgm-sin-resolver':
      return 'Indica el kg/m o nombra el perfil en el comentario (p. ej. IPE 300).';
    case 'perfiles-en-conflicto':
      return `El comentario dice ${m.comentario} y el kg/m fijo es ${m.campo}.`;
    case 'forma-invalida':
      return m.cual === 'longitud-cero'
        ? 'La forma no tiene longitud.'
        : m.cual === 'pocos-vertices'
          ? 'Hace falta al menos 3 puntos.'
          : 'La superficie es 0.';
    case 'forma-cruzada':
      return 'La forma se cruza: rehazla en orden.';
    case 'demasiados-puntos':
      return 'Esta forma ya tiene 2 000 puntos: termínala.';
  }
}
