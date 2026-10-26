/* ===========================================================================
   core/pcc/estructura — lo que el plan calcula de verdad: el control de la
   estructura de hormigón según el Código Estructural (§5 del plan; B «Para la
   app» A2–A5).

     · lotes de hormigón por grupo (fila de la tabla 57.5.4.1, dosificación),
       con amasadas, tomas y probetas;
     · durabilidad por dosificación (57.5.7);
     · armaduras: ferralla de taller (59.2), barras elaboradas en obra (58) y
       mallas (59.1.4.2);
     · lotes de ejecución (tabla 63.1).

   Función pura: recibe las partidas ya confirmadas, con su medición, y los
   datos del plan. Lo que falta no se supone salvo que el plan diga su valor
   por defecto (§6): la cuenta sale parcial y el dato va a `pendientes`. Los
   números se calculan sin redondear y se redondean hacia arriba al final
   (K-PCC.57). Lo que es interpretación va en `notas`, para que el plan lo diga.
   =========================================================================== */
import { fmtNum } from '../money';
import armaduras from './tablas/armaduras.json';
import durabilidad from './tablas/durabilidad.json';
import ejecucion from './tablas/ejecucion.json';
import lotesHormigon from './tablas/lotes-hormigon.json';
import { avisosDesignacion, pideAireOcluido, pidePenetracion } from './hormigon';
import { unidadPcc } from './unidades';
import type {
  AporteHormigon,
  Aviso,
  ControlPartida,
  DesignacionHormigon,
  Distintivo,
  Durabilidad,
  EnsayoArmadura,
  FilaEjecucion,
  FilaLote,
  GrupoHormigon,
  LoteArmaduras,
  LoteEjecucion,
  OrigenDato,
  Pendiente,
  PlanCalidadDatos,
  ResultadoEstructura,
  SerieDiametro,
} from './tipos';

/** Partida confirmada que entra en el cálculo, con su medición. */
export interface PartidaEstructura {
  id: string;
  code: string;
  title: string;
  ud: string;
  cantidad: number;
  control: ControlPartida;
}

export interface EntradaEstructura {
  partidas: PartidaEstructura[];
  plan: PlanCalidadDatos;
}

/* ---- utilidades ----------------------------------------------------------- */

export { unidadPcc } from './unidades';

/** Redondeo hacia arriba que no sube un cociente exacto por el error de coma flotante. */
const techo = (x: number): number => Math.ceil(x - 1e-9);

/** «45,00» para volúmenes; «300» o «312,50» para superficies y cuentas. */
const m3 = (n: number): string => fmtNum(n, 2);
const num = (n: number): string => (Number.isInteger(n) ? fmtNum(n, 0) : fmtNum(n, 2));
const plural = (n: number, uno: string, varios: string): string => `${num(n)} ${n === 1 ? uno : varios}`;

const ETIQUETA_FILA: Record<FilaLote, string> = {
  cim_superficial: 'Cimentación superficial',
  cim_mayor_200: 'Cimentación de elementos de más de 200 m³',
  flexion: 'Elementos a flexión',
  pilares_muros: 'Pilares y muros',
  otros_compresion: 'Otros elementos a compresión',
};

const SERIES: SerieDiametro[] = ['fina', 'media', 'gruesa', 'muyGruesa'];

export function serieDe(diametro: number): SerieDiametro {
  const s = armaduras.series;
  if (diametro <= s.fina.hasta) return 'fina';
  if (diametro <= s.media.hasta) return 'media';
  if (diametro <= s.gruesa.hasta) return 'gruesa';
  return 'muyGruesa';
}

/** fcd = αcc·fck/γc (anejo 19, 3.1.6 y tabla A19.2.1). */
export function fcd(fck: number, alphaCC = lotesHormigon.indirecto.alphaCC): number {
  return (alphaCC * fck) / lotesHormigon.indirecto.gammaC;
}

/**
 * Por qué no se ofrece el control indirecto (§5.3). Con γc = 1,5 y αcc = 1
 * ningún armado lo admite: su fck no baja de 25 (art. 33.4) y da fcd > 15.
 */
export function motivoSinIndirecto(designaciones: DesignacionHormigon[]): string {
  const armado = designaciones.filter((d) => d.tipo !== 'HM').sort((a, b) => a.fck - b.fck)[0];
  const { fcdMax, gammaC, alphaCC } = lotesHormigon.indirecto;
  if (armado)
    return (
      `El control indirecto de la resistencia (art. 57.5.6) exige fcd ≤ ${fcdMax} N/mm²; con γc = ${fmtNum(gammaC, 1)} y ` +
      `αcc = ${fmtNum(alphaCC, 2)}, el ${armado.texto} da fcd = ${fmtNum(fcd(armado.fck), 1)} N/mm² > ${fcdMax}: no lo admite.`
    );
  return 'El control indirecto de la resistencia (art. 57.5.6) no se ofrece en esta versión del plan.';
}

/* ---- hormigón ------------------------------------------------------------- */

interface GrupoAcum {
  clave: string;
  fila: FilaLote;
  dosificacion: string;
  designacion: DesignacionHormigon;
  partidas: AporteHormigon[];
  volumen: number;
  /** Solo `cim_mayor_200`: volumen de cada elemento. */
  elementos: number[];
  /** Partidas medidas en ud (nº de zapatas, para la ejecución). */
  unidades: number;
}

type FilaNormal = Exclude<FilaLote, 'cim_mayor_200'>;
interface DefFila {
  vol: number;
  semanas: number;
  sup?: number;
  plantas?: number;
  supSiPocasAmasadas?: { maxAmasadas: number; sup: number };
}

function lotesFila(
  fila: FilaNormal,
  V: number,
  S: number | null,
  P: number | null,
  T: number | null,
  k: number,
  supEf?: number,
): { lotes: number; criterios: string[]; vLoteMax: number } {
  const f = lotesHormigon.filas[fila] as DefFila;
  const sup = supEf ?? f.sup;
  const semanas = Math.min(f.semanas * k, lotesHormigon.semanasMax);
  const criterios: string[] = [];
  const porVol = techo(V / (f.vol * k));
  criterios.push(`${m3(V)} m³ / ${num(f.vol * k)} → ${porVol}`);
  let lotes = Math.max(1, porVol);
  let vLoteMax = Math.min(V, f.vol * k);
  if (sup && S != null) {
    const n = techo(S / (sup * k));
    criterios.push(`${num(S)} m² / ${num(sup * k)} → ${n}`);
    lotes = Math.max(lotes, n);
    vLoteMax = Math.min(vLoteMax, (V * sup * k) / S);
  }
  if (f.plantas && P != null) {
    const n = techo(P / (f.plantas * k));
    criterios.push(`${plural(P, 'planta', 'plantas')} / ${num(f.plantas * k)} → ${n}`);
    lotes = Math.max(lotes, n);
    vLoteMax = Math.min(vLoteMax, (V * f.plantas * k) / P);
  }
  if (T != null) {
    const n = techo(T / semanas);
    criterios.push(`${plural(T, 'semana', 'semanas')} / ${num(semanas)} → ${n}`);
    lotes = Math.max(lotes, n);
    vLoteMax = Math.min(vLoteMax, (V * semanas) / T);
  }
  return { lotes, criterios, vLoteMax: Math.max(vLoteMax, V / lotes) };
}

function nBase(distintivo: Distintivo, fck: number): number {
  const n = distintivo === 'con' ? lotesHormigon.filas.flexion.nDistintivo.min : lotesHormigon.filas.flexion.nSin.min;
  return fck >= lotesHormigon.fckAlto.fck ? Math.max(n, lotesHormigon.fckAlto.nMin) : n;
}

/* ---- cálculo -------------------------------------------------------------- */

export function calcularEstructura(e: EntradaEstructura): ResultadoEstructura {
  const { plan } = e;
  const pendientes: Pendiente[] = [];
  const avisos: Aviso[] = [];
  const pend = (p: Pendiente) => {
    if (!pendientes.some((x) => x.id === p.id)) pendientes.push(p);
  };
  const avisa = (a: Aviso) => {
    if (!avisos.some((x) => x.id === a.id)) avisos.push(a);
  };

  const distintivo: Distintivo = plan.hormigon?.distintivo ?? 'sin';
  const modalidad = plan.hormigon?.modalidad ?? 'estadistico';
  const cuba = plan.hormigon?.cubaM3 ?? null;
  const k: 1 | 2 | 5 =
    distintivo === 'con' ? 5 : distintivo === 'dispersion' ? 2 : 1;

  /* 1. Grupos por (fila, dosificación) ------------------------------------- */
  const grupos = new Map<string, GrupoAcum>();
  for (const p of e.partidas) {
    const h = p.control.hormigon;
    if (!h) continue;
    const etiqueta = `${p.code} ${p.title}`.trim();
    for (const [i, texto] of avisosDesignacion(h.designacion).entries())
      avisa({ id: `designacion:${p.id}:${i}`, texto: `${etiqueta}: ${texto}`, partidaId: p.id });
    if (!h.fila) {
      pend({
        id: `fila:${p.id}`,
        texto: `${etiqueta}: falta el tipo de elemento (fila de la tabla 57.5.4.1); no entra en ningún lote.`,
        partidaId: p.id,
      });
      continue;
    }
    let vol: number;
    let formula: string;
    if (unidadPcc(p.ud) === 'm3') {
      vol = p.cantidad;
      formula = `${m3(vol)} m³`;
    } else if (h.m3PorUd != null && h.m3PorUd > 0) {
      vol = p.cantidad * h.m3PorUd;
      formula = `${num(p.cantidad)} ${p.ud} × ${fmtNum(h.m3PorUd, 3)} m³/${p.ud}`;
    } else {
      pend({
        id: `m3PorUd:${p.id}`,
        texto: `${etiqueta}: se mide en ${p.ud}; falta el volumen de hormigón por ${p.ud} para contarla en los lotes.`,
        partidaId: p.id,
      });
      continue;
    }

    let fila = h.fila;
    const mayor = h.elementoMayorM3 ?? null;
    const esCim = fila === 'cim_superficial' || fila === 'cim_mayor_200';
    if (esCim && mayor != null && mayor > 200) fila = 'cim_mayor_200';
    if (fila === 'cim_mayor_200' && (mayor == null || mayor <= 0)) {
      pend({
        id: `elementoMayor:${p.id}`,
        texto: `${etiqueta}: falta el volumen del mayor elemento de cimentación (tabla 57.5.4.1, elementos de más de 200 m³).`,
        partidaId: p.id,
      });
      continue;
    }
    if (fila === 'cim_superficial' && mayor == null && vol > 200)
      avisa({
        id: `elementoMayor:${p.id}`,
        texto: `${etiqueta}: más de 200 m³; se supone que ningún elemento de la cimentación pasa de 200 m³. Si alguno pasa, dilo en la partida.`,
        partidaId: p.id,
      });

    const dosificacion = h.dosificacion?.trim() || h.designacion.texto;
    const clave = `${fila}|${dosificacion}`;
    let g = grupos.get(clave);
    if (!g) {
      g = { clave, fila, dosificacion, designacion: h.designacion, partidas: [], volumen: 0, elementos: [], unidades: 0 };
      grupos.set(clave, g);
    }
    g.partidas.push({ partidaId: p.id, code: p.code, title: p.title, m3: vol, formula });
    g.volumen += vol;
    if (fila === 'cim_mayor_200') {
      const n = techo(vol / mayor!);
      for (let i = 0; i < n; i++) g.elementos.push(mayor!);
    }
    if (unidadPcc(p.ud) === 'ud') g.unidades += p.cantidad;
  }

  /* 2. Lotes y amasadas por grupo ------------------------------------------ */
  const resultado: GrupoHormigon[] = [];
  /** Cuenta del grupo con otro número de lotes (para el mínimo de tres). */
  const rehacer = new Map<string, (lotes: number) => string>();
  for (const g of grupos.values()) {
    const datos = plan.grupos?.[g.clave] ?? {};
    const deObra = g.fila === 'flexion' || g.fila === 'pilares_muros' || g.fila === 'otros_compresion';
    const valor = (
      propio: number | null | undefined,
      obra: number | null | undefined,
    ): { valor: number | null; origen: OrigenDato } =>
      propio != null ? { valor: propio, origen: 'grupo' } : deObra && obra != null ? { valor: obra, origen: 'obra' } : { valor: null, origen: null };
    const superficie = valor(datos.superficie, plan.superficieConstruida);
    const plantas = valor(datos.plantas, plan.plantas);
    const semanas = datos.semanas ?? null;
    const etiqueta = `${ETIQUETA_FILA[g.fila]} ${g.designacion.texto}`;
    const notas: string[] = [];
    const ac = g.designacion.consistencia === 'AC';

    let lotes: number | null;
    let n: number;
    let amasadas: number;
    let cuenta: string;

    if (modalidad === 'cien') {
      lotes = null;
      if (cuba != null && cuba > 0) {
        amasadas = techo(g.volumen / cuba);
        cuenta = `${etiqueta}: ${m3(g.volumen)} m³ / ${num(cuba)} m³ por amasada → ${amasadas} amasadas, todas controladas (57.5.5)`;
      } else {
        amasadas = 0;
        cuenta = `${etiqueta}: control al 100 % (57.5.5), falta el volumen de cuba`;
        pend({ id: 'cubaM3', texto: 'Control al 100 %: falta el volumen medio por amasada (cuba) para contar las amasadas.' });
      }
      n = amasadas;
    } else if (g.fila === 'cim_mayor_200') {
      const f = lotesHormigon.filas.cim_mayor_200;
      const reglaN = distintivo === 'con' ? f.nDistintivo : f.nSin;
      const ns = g.elementos.map((v) => {
        const ni = Math.max(reglaN.min, techo(v / reglaN.porVolumen));
        return g.designacion.fck >= lotesHormigon.fckAlto.fck ? Math.max(ni, lotesHormigon.fckAlto.nMin) : ni;
      });
      lotes = g.elementos.length;
      n = Math.max(...ns);
      amasadas = ns.reduce((s, x) => s + x, 0);
      const mayor = Math.max(...g.elementos);
      cuenta =
        `${etiqueta}: ${m3(g.volumen)} m³ en ${plural(lotes, 'elemento', 'elementos')} de hasta ${m3(mayor)} m³ → ` +
        `${plural(lotes, 'lote', 'lotes')} (1 por elemento, tabla 57.5.4.1) × N = max(${reglaN.min}, ⌈${m3(mayor)}/${reglaN.porVolumen}⌉) = ${n} → ${amasadas} amasadas`;
      if (g.elementos.length > 1)
        notas.push('Cada elemento cuenta con el volumen del mayor (lo más exigente): si son muy distintos, una partida por elemento.');
      if (distintivo === 'dispersion')
        notas.push('Con dispersión certificada, el lote sigue siendo un elemento y N se cuenta como sin distintivo.');
    } else {
      const fila = g.fila;
      const def = lotesHormigon.filas[fila] as DefFila;
      if (def.sup && superficie.valor == null)
        avisa({
          id: `superficie:${g.clave}`,
          texto: `${etiqueta}: sin superficie construida; no se aplica ese límite del lote (tabla 57.5.4.1).`,
          grupo: g.clave,
        });
      if (def.plantas && plantas.valor == null)
        avisa({
          id: `plantas:${g.clave}`,
          texto: `${etiqueta}: sin número de plantas; no se aplica el límite de ${def.plantas} plantas por lote (tabla 57.5.4.1).`,
          grupo: g.clave,
        });
      if (semanas == null)
        avisa({
          id: `semanas:${g.clave}`,
          texto: `${etiqueta}: sin semanas de hormigonado; se supone que se hormigona dentro del plazo de un lote (K-PCC.29).`,
          grupo: g.clave,
        });

      let r = lotesFila(fila, g.volumen, superficie.valor, plantas.valor, semanas, k);
      n = nBase(distintivo, g.designacion.fck);
      if (cuba != null && cuba > 0) {
        let reales = techo(r.vLoteMax / cuba);
        const nota = def.supSiPocasAmasadas;
        if (nota && superficie.valor != null && reales <= nota.maxAmasadas) {
          const r2 = lotesFila(fila, g.volumen, superficie.valor, plantas.valor, semanas, k, nota.sup);
          const reales2 = techo(r2.vLoteMax / cuba);
          if (reales2 <= nota.maxAmasadas) {
            notas.push(
              `Nota (*) de la tabla 57.5.4.1: con ${reales2} amasadas por lote (cubas de ${num(cuba)} m³), el límite de superficie de los pilares sube a ${num(nota.sup)} m² (INTERPRETACIÓN: depende del volumen de cuba declarado).`,
            );
            r = r2;
            reales = reales2;
          }
        }
        if (reales < n) {
          notas.push(
            `Con cubas de ${num(cuba)} m³, un lote de hasta ${m3(r.vLoteMax)} m³ tiene ${reales} amasadas: se controlan todas (INTERPRETACIÓN: el Código no dice qué hacer con menos amasadas que N).`,
          );
          n = Math.max(1, reales);
        }
      }
      lotes = r.lotes;
      amasadas = lotes * n;
      const criterios = r.criterios;
      const nAm = n;
      rehacer.set(g.clave, (l) =>
        `${etiqueta}: max(${criterios.join('; ')}) = ${plural(l, 'lote', 'lotes')} (tabla 57.5.4.1${k > 1 ? `, × ${k}` : ''}) × ${plural(nAm, 'amasada', 'amasadas')} = ${plural(l * nAm, 'toma', 'tomas')}`);
      cuenta = rehacer.get(g.clave)!(lotes);
      if (k > 1)
        notas.push(
          `Tamaño del lote × ${k} (${distintivo === 'con' ? 'distintivo de calidad oficialmente reconocido' : 'dispersión certificada'}), aplicado a todos los valores de la tabla, también plantas y semanas, como dice el literal («los valores de la tabla 57.5.4.1»); que alcance a plantas y semanas no está escrito expresamente. Nunca más de ${lotesHormigon.semanasMax} semanas.`,
        );
    }

    if (g.designacion.consistencia == null)
      avisa({
        id: `convencional:${g.clave}`,
        texto: `${etiqueta}: sin tipo de consistencia; se cuenta como hormigón convencional (K-PCC.56).`,
        grupo: g.clave,
      });

    resultado.push({
      clave: g.clave,
      fila: g.fila,
      dosificacion: g.dosificacion,
      designacion: g.designacion,
      partidas: g.partidas,
      volumen: g.volumen,
      superficie,
      plantas,
      semanas,
      ampliacion: k,
      lotes,
      n,
      amasadas,
      ensayos: ensayosDe(amasadas, ac),
      cuenta,
      notas,
    });
  }

  /* 3. Mínimo de tres lotes con tamaño ampliado ---------------------------- */
  if (k > 1 && modalidad === 'estadistico') {
    const total = resultado.reduce((s, g) => s + (g.lotes ?? 0), 0);
    const candidatos = resultado.filter((g) => g.fila !== 'cim_mayor_200' && g.lotes != null);
    if (resultado.length && total < lotesHormigon.ampliacion.minimoLotes) {
      if (!candidatos.length)
        avisa({ id: 'minimoLotes', texto: 'Con tamaño de lote ampliado hacen falta al menos 3 lotes en la obra (57.5.4.1); repártelos a mano.' });
      for (let falta = lotesHormigon.ampliacion.minimoLotes - total; falta > 0 && candidatos.length; falta--) {
        const g = candidatos.reduce((a, b) => (b.volumen / b.lotes! > a.volumen / a.lotes! ? b : a));
        g.lotes! += 1;
        g.amasadas = g.lotes! * g.n;
        g.ensayos = ensayosDe(g.amasadas, g.designacion.consistencia === 'AC');
        g.cuenta = rehacer.get(g.clave)?.(g.lotes!) ?? g.cuenta;
        if (!g.notas.some((x) => x.startsWith('Mínimo de 3 lotes')))
          g.notas.push(
            'Mínimo de 3 lotes en la obra con tamaño de lote ampliado (57.5.4.1): si es posible, uno de cimentación, uno de elementos a compresión y uno a flexión.',
          );
      }
    }
  }

  /* 4. Durabilidad por dosificación --------------------------------------- */
  const durab: Durabilidad[] = [];
  if (distintivo !== 'con') {
    const porDosif = new Map<string, DesignacionHormigon[]>();
    for (const g of resultado) porDosif.set(g.dosificacion, [...(porDosif.get(g.dosificacion) ?? []), g.designacion]);
    for (const [dosificacion, ds] of porDosif) {
      const pen = ds.some(pidePenetracion);
      const aire = ds.some(pideAireOcluido);
      if (!pen && !aire) continue;
      const clases = [...new Set(ds.flatMap((d) => d.clases))];
      const meses = plan.dosificaciones?.[dosificacion]?.meses ?? null;
      const veces = meses != null && meses > 0 ? Math.max(1, techo(meses / durabilidad.penetracion.cadaMeses)) : 1;
      if (meses == null)
        pend({
          id: `meses:${dosificacion}`,
          texto: `${dosificacion}: faltan los meses de suministro; la durabilidad se cuenta solo con el ensayo inicial (57.5.7).`,
          grupo: dosificacion,
        });
      const que = [pen ? `${veces} penetración${veces > 1 ? 'es' : ''} de agua (${durabilidad.penetracion.probetas} probetas cada una)` : null, aire ? `${veces} de aire ocluido` : null]
        .filter(Boolean)
        .join(' y ');
      durab.push({
        dosificacion,
        designacion: ds[0]!.texto,
        clases,
        meses,
        penetracion: pen ? veces : 0,
        aireOcluido: aire ? veces : 0,
        cuenta: `${ds[0]!.texto} (${clases.join(', ')}): al inicio y cada ${durabilidad.penetracion.cadaMeses} meses${meses != null ? ` de ${plural(meses, 'mes', 'meses')} de suministro` : ''} → ${que} (57.5.7)`,
      });
    }
  }

  /* 5. Armaduras ---------------------------------------------------------- */
  const arm = calcularArmaduras(e, pend, avisa);

  /* 6. Lotes de ejecución -------------------------------------------------- */
  const nivel = plan.ejecucion?.nivel ?? 'normal';
  const lotesEje = calcularEjecucion(resultado, grupos, plan, avisa);

  const designaciones = resultado.map((g) => g.designacion);
  return {
    version: {
      lotes: lotesHormigon.version,
      durabilidad: durabilidad.version,
      armaduras: armaduras.version,
      ejecucion: ejecucion.version,
    },
    distintivo,
    modalidad,
    grupos: resultado,
    totales: {
      lotes: resultado.reduce((s, g) => s + (g.lotes ?? 0), 0),
      amasadas: resultado.reduce((s, g) => s + g.amasadas, 0),
      probetas: resultado.reduce((s, g) => s + g.ensayos.probetas, 0),
    },
    durabilidad: durab,
    armaduras: arm,
    ejecucion: { nivel, lotes: lotesEje },
    indirecto: { ofrecido: false, motivo: motivoSinIndirecto(designaciones) },
    pendientes,
    avisos: [
      ...(plan.hormigon?.distintivo == null && resultado.length
        ? [{ id: 'distintivo', texto: 'Hormigón sin distintivo de calidad (por defecto, lo más exigente): dilo si lo tiene.' }]
        : []),
      ...avisos,
    ],
  };
}

function ensayosDe(amasadas: number, ac: boolean): GrupoHormigon['ensayos'] {
  return {
    resistencia: amasadas,
    consistencia: ac ? 0 : amasadas,
    escurrimiento: ac ? amasadas : 0,
    anilloJapones: ac ? techo(amasadas / lotesHormigon.anilloJaponesCada) : 0,
    probetas: amasadas * lotesHormigon.probetasPorAmasada.n,
  };
}

/* ---- armaduras ------------------------------------------------------------ */

function calcularArmaduras(
  e: EntradaEstructura,
  pend: (p: Pendiente) => void,
  avisa: (a: Aviso) => void,
): LoteArmaduras[] {
  const plan = e.plan.acero ?? {};
  interface Acum {
    kg: number;
    partidas: LoteArmaduras['partidas'];
    /** kg por serie, mientras todas las partidas la den. */
    series: Partial<Record<SerieDiametro, number>> | null;
    presentes: Set<SerieDiametro>;
    diametros: Set<number>;
    /** Alguna partida no dice sus diámetros. */
    sinDiametros: boolean;
  }
  const acum = new Map<LoteArmaduras['control'], Acum>();
  let procedenciaSupuesta = false;

  for (const p of e.partidas) {
    const a = p.control.acero;
    if (!a) continue;
    const etiqueta = `${p.code} ${p.title}`.trim();
    const u = unidadPcc(p.ud);
    let kg: number;
    let formula: string;
    if (u === 'kg') {
      kg = p.cantidad;
      formula = `${num(kg)} kg`;
    } else if (u === 't') {
      kg = p.cantidad * 1000;
      formula = `${num(p.cantidad)} t`;
    } else if (a.kgPorUd != null && a.kgPorUd > 0) {
      kg = p.cantidad * a.kgPorUd;
      formula = `${num(p.cantidad)} ${p.ud} × ${num(a.kgPorUd)} kg/${p.ud}`;
    } else {
      pend({ id: `kgPorUd:${p.id}`, texto: `${etiqueta}: se mide en ${p.ud}; faltan los kg de acero por ${p.ud}.`, partidaId: p.id });
      continue;
    }
    let control: LoteArmaduras['control'];
    if (a.tipo === 'mallas') control = 'mallas';
    else {
      const procedencia = a.procedencia ?? plan.procedencia ?? (a.tipo === 'ferralla' ? 'taller' : null);
      if (procedencia == null) procedenciaSupuesta = true;
      control = (procedencia ?? 'taller') === 'obra' ? 'barras' : 'ferralla';
    }
    let x = acum.get(control);
    if (!x) {
      x = { kg: 0, partidas: [], series: {}, presentes: new Set(), diametros: new Set(), sinDiametros: false };
      acum.set(control, x);
    }
    x.kg += kg;
    x.partidas.push({ partidaId: p.id, code: p.code, title: p.title, kg, formula });
    if (a.series && x.series) {
      for (const s of SERIES) {
        const v = a.series[s];
        if (v != null && v > 0) {
          x.series[s] = (x.series[s] ?? 0) + p.cantidad * v * (u === 't' ? 1000 : 1);
          x.presentes.add(s);
        }
      }
    } else x.series = null;
    if (a.diametros?.length)
      for (const d of a.diametros) {
        x.diametros.add(d);
        x.presentes.add(serieDe(d));
      }
    else x.sinDiametros = true;
  }

  if (procedenciaSupuesta)
    avisa({
      id: 'procedencia',
      texto: 'Ferralla de taller por defecto (se controla la ferralla, art. 59.2): si las armaduras se elaboran en la obra, dilo (art. 58).',
    });

  const lotes: LoteArmaduras[] = [];
  const distintivos = plan.distintivos ?? {};
  for (const [control, x] of acum) {
    const t = x.kg / 1000;
    const notas: string[] = [];
    const ensayos: Partial<Record<EnsayoArmadura, number>> = {};
    let n: number;
    let cuenta: string;

    if (control === 'ferralla') {
      const f = armaduras.ferralla;
      n = Math.max(1, techo(t / f.loteT));
      const lotesTxt = `${num(t)} t / ${f.loteT} → ${plural(n, 'lote', 'lotes')} (59.2.4.2)`;
      if (distintivos.ferralla) {
        cuenta = `Ferralla: ${lotesTxt}; con distintivo de calidad, sin ensayos (59.2): solo documentación`;
      } else {
        const enderezado = plan.enderezado ?? false;
        const soldadura = plan.soldadura ?? 'no';
        if (plan.enderezado == null || plan.soldadura == null)
          avisa({
            id: 'enderezadoSoldadura',
            texto: 'Ferralla sin enderezado ni soldadura por defecto (tabla 59.2.4.3): dilo si se endereza el acero de rollo o lleva soldadura.',
          });
        const fila = soldadura === 'no' ? f.tabla.sinSoldadura : f.tabla.soldaduraNoResistente;
        const lista = enderezado ? fila.conEnderezado : fila.sinEnderezado;
        const factor = distintivos.barras ? f.conDistintivoDelAcero : 1;
        const partes: string[] = [];
        if (lista.includes('traccion')) {
          ensayos.traccion = n * f.porLote.traccion * factor;
          partes.push(`${ensayos.traccion} tracciones`);
        }
        if (lista.includes('doblado')) {
          ensayos.doblado = n * f.porLote.doblado * factor;
          partes.push(`${ensayos.doblado} doblados`);
        }
        if (lista.includes('geometria')) {
          const finos = [...x.diametros].filter((d) => serieDe(d) === 'fina' || serieDe(d) === 'media');
          if (x.sinDiametros && !finos.length) {
            pend({ id: 'diametros:ferralla', texto: 'Ferralla con enderezado: faltan los diámetros para contar las geometrías (2 por diámetro de las series fina y media).' });
            ensayos.geometria = 0;
          } else {
            ensayos.geometria = n * f.porLote.geometriaPorDiametro * finos.length;
            partes.push(`${ensayos.geometria} geometrías (${f.porLote.geometriaPorDiametro} × ${finos.length} Ø)`);
            if (x.sinDiametros)
              pend({ id: 'diametros:ferralla', texto: 'Alguna partida de ferralla no dice sus diámetros: las geometrías cuentan solo los que se conocen.' });
          }
        }
        ensayos.dimensiones = n * f.porLote.dimensiones;
        partes.push(`${ensayos.dimensiones} unidades medidas (59.2.4.4)`);
        cuenta = `Ferralla: ${lotesTxt} → ${partes.join(' + ')}`;
        if (factor < 1) notas.push('Acero con distintivo: la DF reduce a la mitad las tracciones y los doblados (59.2.4.3).');
        if (!enderezado && soldadura === 'no') notas.push(`${f.tabla.eximible} ${f.tabla.eximibleInterpretacion}`);
        if (soldadura === 'resistente') {
          notas.push('Soldadura resistente: se cuenta con los ensayos de la soldadura no resistente (INTERPRETACIÓN).');
          if ((e.plan.ejecucion?.nivel ?? 'normal') !== 'intenso')
            avisa({ id: 'soldaduraResistente', texto: `La soldadura resistente de la ferralla en obra exige control de ejecución intenso (59.2.4.5).` });
        }
      }
    } else if (control === 'barras') {
      const b = armaduras.barras;
      const porSerie: Array<[SerieDiametro, number]> = x.series
        ? SERIES.filter((s) => x.series![s] != null).map((s) => [s, techo(x.series![s]! / 1000 / b.loteT)])
        : [];
      if (porSerie.length) n = porSerie.reduce((s, [, v]) => s + v, 0);
      else if (x.presentes.size && t <= b.loteT) n = x.presentes.size;
      else {
        n = Math.max(x.presentes.size, techo(t / b.loteT));
        pend({
          id: 'series:barras',
          texto: `Acero en barras elaborado en obra: faltan los kg por serie de diámetros (art. 58: lotes de ${b.loteT} t por serie); se cuenta el mínimo.`,
        });
      }
      const series = porSerie.length ? porSerie.map(([s]) => s) : [...x.presentes];
      const lotesTxt = `${num(t)} t${series.length ? `, series ${series.join(', ')}` : ''} → ${plural(n, 'lote', 'lotes')} (art. 58, ${b.loteT} t por serie)`;
      if (distintivos.barras) cuenta = `Barras elaboradas en obra: ${lotesTxt}; con distintivo de calidad, solo documentación`;
      else {
        ensayos.traccion = n * b.porLote.traccion;
        ensayos.doblado = n * b.porLote.doblado;
        ensayos.masaMetro = n * b.porLote.masaMetro;
        ensayos.geometria = n * b.porLote.geometria;
        if (t > b.quimica.siMasDeT) ensayos.quimica = Math.max(b.quimica.min, techo(n / b.quimica.cadaLotes));
        cuenta = `Barras elaboradas en obra: ${lotesTxt} × ${b.porLote.traccion} barras → ${ensayos.traccion} tracciones, ${ensayos.doblado} doblados, ${ensayos.masaMetro} masas por metro y ${ensayos.geometria} geometrías${ensayos.quimica ? ` + ${ensayos.quimica} químicos` : ''}`;
      }
    } else {
      const m = armaduras.mallas;
      n = Math.max(1, techo(t / m.loteT));
      const lotesTxt = `${num(t)} t / ${m.loteT} → ${plural(n, 'lote', 'lotes')} (59.1.4.2)`;
      if (distintivos.mallas) cuenta = `Mallas: ${lotesTxt}; con distintivo de calidad, solo documentación`;
      else {
        for (const [ensayo, v] of Object.entries(m.porLote)) ensayos[ensayo as EnsayoArmadura] = n * v;
        cuenta = `Mallas: ${lotesTxt} × 2 paneles → tracción, doblado, masa por metro, geometría, despegue de nudo y dimensiones`;
        notas.push('Un lote por serie de diámetros: con mallas de varias series, un lote más por serie.');
      }
    }
    lotes.push({
      control,
      kg: x.kg,
      distintivo: !!(control === 'ferralla' ? distintivos.ferralla : control === 'barras' ? distintivos.barras : distintivos.mallas),
      lotes: n,
      ensayos,
      partidas: x.partidas,
      cuenta,
      notas,
    });
  }
  return lotes;
}

/* ---- ejecución ------------------------------------------------------------ */

function calcularEjecucion(
  resultado: GrupoHormigon[],
  acum: Map<string, GrupoAcum>,
  plan: PlanCalidadDatos,
  avisa: (a: Aviso) => void,
): LoteEjecucion[] {
  const filaDe = (f: FilaLote): FilaEjecucion | null =>
    f === 'cim_superficial' || f === 'cim_mayor_200' ? 'cimentacion' : f === 'flexion' ? 'flexion' : f === 'pilares_muros' ? 'pilares_muros' : null;
  const porFila = new Map<FilaEjecucion, GrupoHormigon[]>();
  for (const g of resultado) {
    const f = filaDe(g.fila);
    if (!f) {
      avisa({
        id: `ejecucion:${g.fila}`,
        texto: `${ETIQUETA_FILA[g.fila]}: no están en la tabla 63.1; el pliego fija su lote de ejecución.`,
        grupo: g.clave,
      });
      continue;
    }
    porFila.set(f, [...(porFila.get(f) ?? []), g]);
  }

  const max = (xs: Array<number | null | undefined>): number | null => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.max(...v) : null;
  };
  const lotes: LoteEjecucion[] = [];
  for (const fila of ['cimentacion', 'flexion', 'pilares_muros'] as const) {
    const gs = porFila.get(fila);
    if (!gs) continue;
    const def = ejecucion.lotes.filas[fila] as { titulo: string; sup: number; plantas?: number; elementos?: number; muroM?: number };
    const datos = gs.map((g) => plan.grupos?.[g.clave] ?? {});
    // En cimentación cuenta su propia superficie, no la construida de la obra.
    const S = fila === 'cimentacion' ? max(datos.map((d) => d.superficie)) : max(gs.map((g) => g.superficie.valor));
    const P = fila === 'cimentacion' ? null : max(gs.map((g) => g.plantas.valor));
    const criterios: string[] = [];
    let n = 1;
    if (S != null) {
      const v = techo(S / def.sup);
      criterios.push(`${num(S)} m² / ${def.sup} → ${v}`);
      n = Math.max(n, v);
    }
    if (def.plantas && P != null) {
      const v = techo(P / def.plantas);
      criterios.push(`${plural(P, 'planta', 'plantas')} / ${def.plantas} → ${v}`);
      n = Math.max(n, v);
    }
    if (def.elementos) {
      const dato = datos.reduce<number | null>((s, d) => (d.elementos != null ? (s ?? 0) + d.elementos : s), null);
      const uds = gs.reduce((s, g) => s + (acum.get(g.clave)?.unidades ?? 0), 0);
      const E = dato ?? (uds > 0 ? uds : null);
      if (E != null) {
        const v = techo(E / def.elementos);
        criterios.push(`${plural(E, 'elemento', 'elementos')} / ${def.elementos} → ${v}`);
        n = Math.max(n, v);
      } else
        avisa({ id: 'ejecucion:elementos', texto: 'Cimentación: sin número de elementos (zapatas); no se aplica el límite de 10 por lote de ejecución (tabla 63.1).' });
    }
    if (def.muroM) {
      const L = max(datos.map((d) => d.muroM));
      if (L != null) {
        const v = techo(L / def.muroM);
        criterios.push(`${num(L)} m de muro / ${def.muroM} → ${v}`);
        n = Math.max(n, v);
      }
    }
    if (S == null)
      avisa({
        id: `ejecucion:superficie:${fila}`,
        texto: `${def.titulo}: sin superficie; no se aplica el límite de ${def.sup} m² por lote de ejecución (tabla 63.1).`,
      });
    lotes.push({
      fila,
      lotes: n,
      cuenta: `${def.titulo}: ${criterios.length ? `max(${criterios.join('; ')})` : 'sin datos'} = ${plural(n, 'lote', 'lotes')} de ejecución (tabla 63.1)`,
    });
  }
  return lotes;
}
