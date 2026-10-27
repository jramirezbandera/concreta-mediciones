/* core/rcd — estudio de gestión de residuos de construcción y demolición.
   Plan: docs/plan-estudio-residuos.md. */
export * from './tipos';
export { calcularEstudioRcd, comunidadDeProvincia, resultadoPartida, type EntradaRcd, type ResultadoPartidaRcd } from './calculo';
export { convertir, fmtCuenta, MODOS_POR_UNIDAD, modoAdmitido, unidadRcd, type UnidadRcd } from './conversion';
export { densidadAparente } from './aparente';
export { materialesSeAe, pesosSuperficieSeAe, refSeAe, SE_AE_CITA } from './densidades';
export { estudioVacio, PLANO_POR_DEFECTO } from './datos';
export { ECO_CITA_CORTA, ECO_FUENTE, GRUPOS_ECO, opcionesEco, opcionPorDefecto, plantasEco, plantasEcoBasico, OPCIONES_PLANTAS_BASICO } from './ecoeficiencia';
export { destinoPorDefecto, fraccionDe, NOMBRE_FRACCION, operacion, OPERACIONES_CITA, todasLasOperaciones } from './fracciones';
export { citaLer, lerConAsterisco, lerVigente, normalizarLer, type CodigoLerInfo } from './ler';
export { estadoTrasConfirmar, huellaDe, necesitaRevision, proponerResiduo } from './reglas';
