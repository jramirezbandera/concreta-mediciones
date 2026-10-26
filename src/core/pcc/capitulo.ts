/* ===========================================================================
   core/pcc/capitulo — el capítulo de control de calidad que se propone desde
   la valoración, cuando el presupuesto no lo tiene (§9 del plan, A2).

   Una partida propia por fila de la valoración, sin descomposición: cantidad =
   los precios que pide la fila (O4), precio = el de la fila, texto = el `~T`
   copiado del banco con «Tomar precios» si pasa la lista de citas vetadas
   (K-PCC.68), y si no, el texto propio del ensayo. El código del banco va
   aparte (`codigoBanco`): el store lo usa si la obra no lo tiene ya. No carga
   el banco ni abre el diálogo de colisiones; quien quiera la descomposición la
   copia luego desde Referencia.
   =========================================================================== */
import { citasVetadasEn } from './citas';
import type { FilaValoracion, PlanCalidadDatos } from './tipos';

export interface PartidaControlPropuesta {
  ensayo: string;
  /** El código del banco, si el precio es una sola partida suya. */
  codigoBanco: string | null;
  title: string;
  ud: string;
  cantidad: number;
  /** € (0 si la fila no tiene precio). */
  precio: number;
  desc: string;
}

export interface CapituloControlPropuesto {
  partidas: PartidaControlPropuesta[];
  /** Ensayos sin precio: sus partidas van a 0 €. */
  sinPrecio: string[];
  /** Ensayos cuyo texto del banco cita normas vetadas: llevan el texto propio. */
  textoPropio: string[];
}

/** Texto propio del ensayo: lo que es, su norma y de dónde sale la cantidad. */
function textoDe(v: FilaValoracion): string {
  return `${v.descripcion}${v.norma ? `, según ${v.norma}` : ''}. Cantidad del plan de control de calidad: ${v.regla}.`;
}

export function partidasControl(valoracion: readonly FilaValoracion[], plan: Pick<PlanCalidadDatos, 'precios'>): CapituloControlPropuesto {
  const partidas: PartidaControlPropuesta[] = [];
  const sinPrecio: string[] = [];
  const textoPropio: string[] = [];
  for (const v of valoracion) {
    if (!(v.precios > 0)) continue;
    const copia = plan.precios?.[v.ensayo];
    const bancoOk = v.precio.fuente === 'banco' && !!copia?.texto && citasVetadasEn(copia.texto).length === 0;
    if (v.precio.fuente === 'banco' && copia?.texto && !bancoOk) textoPropio.push(v.ensayo);
    if (v.precio.valor == null) sinPrecio.push(v.ensayo);
    const codigo = v.precio.fuente === 'banco' ? (v.precio.codigo ?? null) : null;
    partidas.push({
      ensayo: v.ensayo,
      codigoBanco: codigo && !codigo.includes('+') ? codigo : null,
      title: v.descripcion,
      ud: v.unidad,
      cantidad: v.precios,
      precio: v.precio.valor ?? 0,
      desc: bancoOk ? copia!.texto! : textoDe(v),
    });
  }
  return { partidas, sinPrecio, textoPropio };
}
