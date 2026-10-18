/* ===========================================================================
   core/rcd/capitulo — el capítulo de gestión (7.º) que se propone desde la
   estimación, cuando el presupuesto no lo tiene.

   Por fracción, como se trabaja en obra:
     · cada fracción que se separa (4.º) va en sus contenedores: unidades =
       m³ aparentes ÷ capacidad, redondeado por arriba; lo que no hay que
       separar va junto en otro contenedor (y todo lo no peligroso en uno si
       la separación la hace un gestor externo);
     · la entrega al gestor va por código, en t, al precio del estudio;
     · las tierras, transporte en m³ y entrega en t;
     · cada peligroso, en una partida que lo recoge todo (el amianto, por
       empresa inscrita en el RERA).
   El transporte va a 0 €: el precio lo pone el técnico (D5); sin m³ de una
   fracción, sus contenedores quedan a 0 y se dice.
   =========================================================================== */
import { NOMBRE_FRACCION, tieneAmianto } from './fracciones';
import { lerConAsterisco } from './ler';
import type { CodigoLer, EstudioRcd, EstudioRcdDatos, FilaCodigo, Fraccion, ResiduoPartida } from './tipos';

/** Capacidades de contenedor que se ofrecen (m³). */
export const CAPACIDADES_CONTENEDOR = [3, 5, 7, 9, 12] as const;

export interface PartidaGestionRcd {
  title: string;
  ud: string;
  cantidad: number;
  precio: number;
  desc: string;
  gestiona: NonNullable<ResiduoPartida['gestiona']>;
}

export interface CapituloGestionPropuesto {
  partidas: PartidaGestionRcd[];
  /** Grupos a los que les faltan los m³ aparentes: sus contenedores van a 0. */
  sinM3: string[];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const corta = (s: string) => (s.length > 70 ? `${s.slice(0, 68)}…` : s);
const num = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 3 });
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

interface Grupo {
  nombre: string;
  filas: FilaCodigo[];
}

/** m³ aparentes del grupo, o `null` si a algún código le faltan. */
function m3De(filas: FilaCodigo[]): number | null {
  return filas.every((f) => f.m3Aparente != null) ? r3(filas.reduce((s, f) => s + (f.m3Aparente ?? 0), 0)) : null;
}

export function partidasGestion(
  r: Pick<EstudioRcd, 'porCodigo' | 'separacion'>,
  d: Pick<EstudioRcdDatos, 'precios' | 'separacion'>,
  capacidadM3: number,
): CapituloGestionPropuesto {
  const filas = r.porCodigo.filter((f) => f.t > 0);
  const partidas: PartidaGestionRcd[] = [];
  const sinM3: string[] = [];
  const codigos = (fs: FilaCodigo[]): CodigoLer[] => fs.map((f) => f.ler);

  const entrega = (f: FilaCodigo): PartidaGestionRcd => ({
    title: `Entrega a gestor autorizado: ${corta(f.descripcion)} (${f.ler})`,
    ud: 't',
    cantidad: r3(f.t),
    precio: d.precios[f.ler]?.eurPorT ?? 0,
    desc: `Canon de entrega y tratamiento en gestor autorizado del residuo ${f.ler} estimado en el estudio de gestión de residuos, incluso documentación de entrega. Sin incluir el transporte.`,
    gestiona: { codigos: [f.ler] },
  });

  /* ---- no peligrosos, salvo tierras: contenedores por grupo ---- */
  const resto = filas.filter((f) => !f.peligroso && f.fraccion !== 'tierras');
  const grupos: Grupo[] = [];
  if (d.separacion === 'gestorExterno') {
    if (resto.length) grupos.push({ nombre: 'residuos no peligrosos mezclados, para su separación por el gestor', filas: resto });
  } else {
    const separadas = new Set<Fraccion>(r.separacion.filter((s) => s.obligatoria).map((s) => s.fraccion));
    const porFraccion = new Map<Fraccion, FilaCodigo[]>();
    const juntas: FilaCodigo[] = [];
    for (const f of resto) {
      if (!separadas.has(f.fraccion)) juntas.push(f);
      else porFraccion.set(f.fraccion, [...(porFraccion.get(f.fraccion) ?? []), f]);
    }
    for (const [fr, fs] of porFraccion) grupos.push({ nombre: minuscula(NOMBRE_FRACCION[fr]), filas: fs });
    if (juntas.length) grupos.push({ nombre: 'resto de residuos no peligrosos (sin obligación de separarlos)', filas: juntas });
  }
  for (const g of grupos) {
    const m3 = m3De(g.filas);
    if (m3 == null) sinM3.push(g.nombre);
    const n = m3 == null ? 0 : Math.max(1, Math.ceil(m3 / capacidadM3 - 1e-9));
    partidas.push({
      title: `Transporte de ${g.nombre} a gestor autorizado, con contenedor de ${capacidadM3} m³`,
      ud: 'Ud',
      cantidad: n,
      precio: 0,
      desc:
        `Alquiler, colocación en obra, retirada y transporte a gestor autorizado de contenedor de ${capacidadM3} m³ para ${g.nombre} (${codigos(g.filas).join(', ')}). ` +
        (m3 == null
          ? 'Número de contenedores pendiente: falta la densidad aparente de algún residuo.'
          : `Número de contenedores: ${num(m3)} m³ aparentes estimados en el estudio entre ${capacidadM3} m³, redondeado por arriba.`),
      gestiona: { codigos: codigos(g.filas), capacidadContenedorM3: capacidadM3 },
    });
    for (const f of g.filas) partidas.push(entrega(f));
  }

  /* ---- tierras: transporte en m³ ---- */
  const tierras = filas.filter((f) => !f.peligroso && f.fraccion === 'tierras');
  if (tierras.length) {
    const m3 = m3De(tierras);
    if (m3 == null) sinM3.push('tierras');
    partidas.push({
      title: 'Transporte de tierras a gestor autorizado, con camión',
      ud: 'm3',
      cantidad: m3 ?? 0,
      precio: 0,
      desc: `Carga y transporte con camión a gestor autorizado de las tierras de la excavación (${codigos(tierras).join(', ')}), medidas en m³ aparentes (esponjadas) según el estudio de gestión de residuos.`,
      gestiona: { codigos: codigos(tierras) },
    });
    for (const f of tierras) partidas.push(entrega(f));
  }

  /* ---- peligrosos: una partida por código, todo incluido ---- */
  for (const f of filas.filter((x) => x.peligroso)) {
    const ler = lerConAsterisco({ codigo: f.ler, peligroso: true });
    const amianto = tieneAmianto(f.ler);
    partidas.push({
      title: amianto
        ? `Retirada, transporte y entrega a gestor autorizado de residuos con amianto (${ler}), por empresa inscrita en el RERA`
        : `Recogida en envase homologado, transporte y entrega a gestor autorizado: ${corta(f.descripcion)} (${ler})`,
      ud: 't',
      cantidad: r3(f.t),
      precio: d.precios[f.ler]?.eurPorT ?? 0,
      desc: amianto
        ? `Retirada, embalaje, transporte y entrega a gestor autorizado del residuo peligroso ${ler} por empresa inscrita en el Registro de Empresas con Riesgo de Amianto (RERA), según el plan de trabajo aprobado, incluso documentación de entrega.`
        : `Recogida separada en envase homologado y etiquetado, transporte y entrega a gestor autorizado del residuo peligroso ${ler}, sin mezclarlo con otros residuos, incluso documentación de entrega.`,
      gestiona: { codigos: [f.ler] },
    });
  }

  return { partidas, sinM3 };
}
