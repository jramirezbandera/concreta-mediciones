/* ===========================================================================
   core/rcd/calculo — el estudio de gestión de residuos de una obra.

   `calcularEstudioRcd` es PURA: toma el presupuesto (capítulos, partidas con
   su `rcd`, tasas) y los datos del estudio, y devuelve `EstudioRcd`. No
   rellena nada que falte: lo que no sabe va a `pendientes`, y lo que no
   cuadra, a `avisos`. Normativa: verificación K-RCD.1–17 de Instalaciones.

   De dónde sale cada tonelada del 1.º:
     · de las partidas CONFIRMADAS (las propuestas no suman, D5): demolición y
       excavación por su medición (SE-AE), o lo que traiga el banco (`~R`);
     · en obra nueva, de los ratios por m² (ECO-eficiencia o tecleados),
       solo para lo que las partidas no traen (D9): un código con residuos de
       colocación o embalaje por partidas no recibe ratio, y las tierras del
       ratio no se suman si hay partidas de excavación.
   =========================================================================== */
import { partidaCantidad, partidaImporte } from '../medicion';
import { pem as pemDe, costesDirectos } from '../totales';
import { findNode, subtreeIds } from '../tree';
import type { Chapter, Obra, Partida, PartidasMap, Rates } from '../types';
import { coherencia } from './coherencia';
import { convertir } from './conversion';
import { densidadAparente } from './aparente';
import { SE_AE_ID } from './densidades';
import { ECO_CITA_CORTA, ECO_ID, estimarEcoBasico, estimarEcoDetallado, type FilaEco } from './ecoeficiencia';
import {
  destinoPorDefecto,
  esVertedero,
  FRACCIONES_SIN_UMBRAL,
  fraccionDe,
  NOMBRE_FRACCION,
  operacion,
  tieneAmianto,
  UMBRAL_PAPEL_T,
} from './fracciones';
import { cambiosEntre, LER_ID, lerVigente } from './ler';
import type {
  Apartado,
  Aviso,
  CodigoLer,
  CosteRcd,
  EstudioRcd,
  EstudioRcdDatos,
  FianzaRcd,
  FilaCodigo,
  FilaDestino,
  FilaFraccion,
  FilaPeligroso,
  OrigenCantidad,
  Pendiente,
  TipoComponente,
} from './tipos';

export interface EntradaRcd {
  chapters: Chapter[];
  partidas: PartidasMap;
  rates: Rates;
  obra: Obra;
  estudio: EstudioRcdDatos;
  /** Hoy (ISO aaaa-mm-dd): la fecha del estudio si no tiene una. */
  hoy: string;
}

const PROVINCIAS_ANDALUCIA = ['almeria', 'cadiz', 'cordoba', 'granada', 'huelva', 'jaen', 'malaga', 'sevilla'];

/** Comunidad deducida de la provincia de la obra (D11); `null` si no hay. */
export function comunidadDeProvincia(provincia: string | undefined): 'andalucia' | 'otra' | null {
  const p = (provincia ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!p) return null;
  return PROVINCIAS_ANDALUCIA.some((x) => p.includes(x)) ? 'andalucia' : 'otra';
}

/** Ids de los contenedores del capítulo de gestión (el propio y sus subs). */
function contenedoresGestion(chapters: Chapter[], id: string | null): { chapterId: string; ids: Set<string>; todo: boolean } | null {
  if (!id) return null;
  const f = findNode(chapters, id);
  if (!f) return null;
  if (f.depth === 0) return { chapterId: f.chapter.id, ids: new Set([f.chapter.id]), todo: true };
  return { chapterId: f.chapter.id, ids: subtreeIds(f.node as Parameters<typeof subtreeIds>[0]), todo: false };
}

interface Acum {
  t: number;
  m3Aparente: number;
  aparenteCompleto: boolean;
  m3EnObra: number;
  enObraCompleto: boolean;
  origen: OrigenCantidad[];
  incompleta: boolean;
  /** Tipos de componente de partida que aportan (para D9). */
  tipos: Set<TipoComponente>;
  nombreAlt?: string;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export function calcularEstudioRcd(e: EntradaRcd): EstudioRcd {
  const { chapters, partidas, rates, obra, estudio } = e;
  const fecha = estudio.fecha ?? e.hoy;
  const ler = lerVigente(fecha);
  const pendientes: Pendiente[] = [];
  const avisos: Aviso[] = [];
  const pend = (p: Pendiente) => {
    if (!pendientes.some((x) => x.id === p.id)) pendientes.push(p);
  };
  const avisa = (a: Aviso) => {
    if (!avisos.some((x) => x.id === a.id)) avisos.push(a);
  };
  const comunidad = estudio.comunidad ?? comunidadDeProvincia(typeof obra.provincia === 'string' ? obra.provincia : undefined);
  const andalucia = comunidad === 'andalucia';
  const existente = estudio.tipos.includes('reforma') || estudio.tipos.includes('demolicion');
  const gestion = contenedoresGestion(chapters, estudio.capituloGestion);
  const enGestion = (chapterId: string, p: Partida): boolean =>
    !!gestion && chapterId === gestion.chapterId && (gestion.todo || gestion.ids.has(p.sub ?? chapterId));

  const acc = new Map<CodigoLer, Acum>();
  const acum = (codigo: CodigoLer): Acum => {
    let a = acc.get(codigo);
    if (!a) {
      a = { t: 0, m3Aparente: 0, aparenteCompleto: true, m3EnObra: 0, enObraCompleto: true, origen: [], incompleta: false, tipos: new Set() };
      acc.set(codigo, a);
    }
    return a;
  };

  /* ---- 1. partidas ------------------------------------------------------- */
  const pemPorTipo = { derribo: 0, excavacion: 0 };
  let sinRevisar = 0;
  for (const ch of chapters) {
    for (const p of partidas[ch.id] ?? []) {
      if (enGestion(ch.id, p)) continue;
      const r = p.rcd;
      if (!r) continue;
      if (r.estado === 'propuesta') {
        sinRevisar += 1;
        continue;
      }
      if (r.estado !== 'confirmada') continue;
      const cantidad = partidaCantidad(p);
      const tiposPartida = new Set(r.componentes.map((c) => c.tipo));
      const pemP = pemDe(partidaImporte(p, rates.coefK), rates);
      if (tiposPartida.has('demolicion')) pemPorTipo.derribo += pemP;
      else if (tiposPartida.has('excavacion')) pemPorTipo.excavacion += pemP;
      r.componentes.forEach((c, i) => {
        const info = ler.get(c.ler);
        if (!info) {
          avisa({ id: `ler-no-vigente:${p.id}:${c.ler}`, partidaId: p.id, ler: c.ler,
            texto: `La partida ${p.code} usa el código ${c.ler}, que no está en la lista vigente el ${fechaEs(fecha)}.` });
          pend({ id: `ler:${p.id}:${i}`, apartado: '1', partidaId: p.id, texto: `Corrige el código ${c.ler} de la partida ${p.code}.` });
          return;
        }
        const res = convertir(c, cantidad, p.ud);
        if ('error' in res) {
          pend({ id: `conv:${p.id}:${i}`, apartado: '1', partidaId: p.id, texto: `Partida ${p.code}: ${res.error}` });
          return;
        }
        const a = acum(c.ler);
        a.tipos.add(c.tipo);
        if (res.faltan.length) {
          a.incompleta = true;
          pend({ id: `falta:${p.id}:${i}`, apartado: '1', partidaId: p.id, ler: c.ler,
            texto: `Partida ${p.code} «${corta(p.title)}», ${c.ler}: falta ${res.faltan.join(' y ')}.` });
        }
        let ap = res.m3Aparente;
        if (ap == null && res.t != null) {
          const d = densidadAparente(c.ler, estudio);
          ap = d ? res.t / d.tPorM3 : null;
        }
        if (res.t != null) a.t += res.t;
        if (ap != null) a.m3Aparente += ap;
        else a.aparenteCompleto = false;
        if (res.m3EnObra != null) a.m3EnObra += res.m3EnObra;
        else a.enObraCompleto = false;
        a.origen.push({
          kind: 'partida',
          partidaId: p.id,
          chapterId: ch.id,
          code: p.code,
          title: p.title,
          cantidad,
          ud: p.ud,
          t: res.t ?? 0,
          m3EnObra: res.m3EnObra,
          m3Aparente: ap,
          formula: res.formula,
        });
      });
    }
  }
  if (sinRevisar > 0)
    pend({ id: 'sin-revisar', apartado: '1',
      texto: `${sinRevisar} partida${sinRevisar === 1 ? '' : 's'} con residuo propuesto sin revisar: no suma${sinRevisar === 1 ? '' : 'n'} hasta confirmarla${sinRevisar === 1 ? '' : 's'}.` });

  /* ---- 2. ratios de obra nueva ------------------------------------------ */
  let ratiosId: string | null = null;
  const rat = estudio.ratios;
  if (estudio.tipos.includes('nueva')) {
    if (!rat) {
      const conConstruccion = [...acc.values()].some((a) => a.tipos.has('colocacion') || a.tipos.has('embalaje'));
      if (!conConstruccion)
        pend({ id: 'ratios', apartado: '1', texto: 'Obra nueva sin estimación de los residuos de construcción: elige los ratios por m² o importa el presupuesto con sus residuos (~R).' });
    } else if (!(rat.superficieConstruida && rat.superficieConstruida > 0)) {
      pend({ id: 'superficie', apartado: '1', texto: 'Falta la superficie construida de la obra nueva para aplicar los ratios.' });
    } else {
      const hayExcavacion = [...acc.values()].some((a) => a.tipos.has('excavacion'));
      const incluirTierras = rat.incluirTierras && !hayExcavacion;
      if (rat.incluirTierras && hayExcavacion)
        avisa({ id: 'ratios-tierras', texto: 'Las tierras salen de las partidas de excavación; las de los ratios no se suman.' });
      let filas: Array<FilaEco | { ler: CodigoLer; nombre: string; t: number; m3Aparente: number | null; formula: string }> = [];
      let fuente = '';
      if (rat.metodo === 'ecoeficiencia') {
        ratiosId = ECO_ID;
        fuente = ECO_CITA_CORTA;
        filas =
          rat.nivel === 'basico'
            ? estimarEcoBasico(rat.tipoBasico ?? 'nuevaNoResidencial', rat.superficieConstruida, rat.plantasBasico ?? '1', false, {
                superficieSolar: rat.superficieSolar,
                incluirTierras,
              })
            : estimarEcoDetallado({
                superficieConstruida: rat.superficieConstruida,
                opciones: rat.opciones,
                superficies: rat.superficies,
                superficieSolar: rat.superficieSolar,
                superficieOcupacion: rat.superficieOcupacion,
                plantasBajoRasante: rat.plantasBajoRasante,
                incluirTierras,
              });
      } else {
        ratiosId = 'manual';
        const S = rat.superficieConstruida;
        const validos = (rat.manual ?? []).filter((m) => {
          if (ler.has(m.ler)) return true;
          pend({ id: `ratio-ler:${m.ler}`, apartado: '1', texto: `Un ratio tecleado tiene un código que no está en la lista vigente («${m.ler || 'vacío'}»).` });
          return false;
        });
        for (const m of validos)
          if (!m.fuente.trim()) pend({ id: `ratio-fuente:${m.ler}`, apartado: '1', ler: m.ler, texto: `El ratio de ${m.ler} no dice de qué fuente sale.` });
        filas = validos.map((m) => {
          const t = S * m.tPorM2;
          const d = densidadAparente(m.ler, estudio);
          const ap = m.m3PorM2 != null ? S * m.m3PorM2 : d ? t / d.tPorM3 : null;
          return { ler: m.ler, nombre: m.fuente, t, m3Aparente: ap, formula: `${S} m² × ${m.tPorM2} t/m² (${m.fuente})` };
        });
      }
      const bloqueados = new Set<CodigoLer>();
      for (const f of filas) {
        const prev = acc.get(f.ler);
        if (prev && (prev.tipos.has('colocacion') || prev.tipos.has('embalaje'))) {
          bloqueados.add(f.ler);
          continue;
        }
        const a = acum(f.ler);
        a.t += f.t;
        if (f.m3Aparente != null) a.m3Aparente += f.m3Aparente;
        else a.aparenteCompleto = false;
        a.enObraCompleto = false;
        a.nombreAlt ??= f.nombre;
        a.origen.push({ kind: 'ratio', fuente: rat.metodo === 'ecoeficiencia' ? fuente : f.nombre, base: f.nombre, t: f.t, m3Aparente: f.m3Aparente, formula: f.formula });
      }
      if (bloqueados.size)
        avisa({ id: 'ratios-bloqueados', texto: `Los ratios no se aplican a ${[...bloqueados].join(', ')}: ya los traen las partidas (D9).` });
    }
  }

  /* ---- 3. tierras reutilizadas en la propia obra (RD 105/2008 art. 3.1 a) */
  const reut = estudio.tierrasReutilizadas;
  const tierras = acc.get('17 05 04');
  if (reut && reut.m3 > 0 && tierras) {
    const base = tierras.enObraCompleto && tierras.m3EnObra > 0 ? tierras.m3EnObra : tierras.m3Aparente;
    const k = base > 0 ? Math.min(1, reut.m3 / base) : 0;
    const dt = tierras.t * k;
    tierras.origen.push({ kind: 'ratio', fuente: 'Tierras reutilizadas en la propia obra (RD 105/2008, art. 3.1 a)', base: reut.destino,
      t: -dt, m3Aparente: -tierras.m3Aparente * k, formula: `− ${r3(reut.m3)} m³ reutilizados (${reut.destino || 'sin destino'})` });
    tierras.t -= dt;
    tierras.m3Aparente -= tierras.m3Aparente * k;
    tierras.m3EnObra -= tierras.m3EnObra * k;
    if (!reut.destino) pend({ id: 'tierras-destino', apartado: '3', texto: 'Indica el destino de las tierras reutilizadas: el art. 3.1 a) exige acreditarlo.' });
  }

  /* ---- 4. filas por código ----------------------------------------------- */
  const porCodigo: FilaCodigo[] = [...acc.entries()]
    // Una fila que redondea a 0,000 t no se imprime (como CYPE), salvo si le falta un dato.
    .filter(([, a]) => r3(a.t) > 0 || a.incompleta)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([codigo, a]) => {
      const info = ler.get(codigo);
      if (info && !info.rcd)
        avisa({ id: `fuera-rcd:${codigo}`, ler: codigo, texto: `${codigo}: ${info.aviso ?? 'no es un código de residuos de construcción y demolición.'} Revisa de dónde sale.` });
      const peligroso = info?.peligroso ?? false;
      return {
        ler: codigo,
        descripcion: info?.descripcion ?? a.nombreAlt ?? '',
        peligroso,
        fraccion: fraccionDe(codigo, peligroso),
        t: r3(a.t),
        m3Aparente: a.aparenteCompleto ? r3(a.m3Aparente) : null,
        m3EnObra: a.enObraCompleto ? r3(a.m3EnObra) : null,
        origen: a.origen,
        incompleta: a.incompleta,
      };
    });
  for (const f of porCodigo) {
    // A una fila incompleta le falta antes el dato de la partida (ya pendiente).
    if (f.m3Aparente == null && !f.incompleta)
      pend({ id: `aparente:${f.ler}`, apartado: '1', ler: f.ler,
        texto: `${f.ler}: falta la densidad aparente del residuo para dar sus m³ de contenedor; se imprimen los m³ en obra.` });
  }
  const mezcla = porCodigo.find((f) => f.ler === '17 09 04');
  if (mezcla && mezcla.t > 0)
    avisa({ id: 'mezcla', ler: '17 09 04',
      texto: `${r3(mezcla.t)} t de residuos mezclados (17 09 04): la Ley 7/2022 (art. 30.2) obliga a clasificar madera, minerales, metales, vidrio, plástico y yeso; el mezclado solo cabe para el rechazo.` });

  const totales = {
    t: r3(porCodigo.reduce((s, f) => s + f.t, 0)),
    m3Aparente: porCodigo.every((f) => f.m3Aparente != null) ? r3(porCodigo.reduce((s, f) => s + (f.m3Aparente ?? 0), 0)) : null,
    m3EnObra: porCodigo.every((f) => f.m3EnObra != null) ? r3(porCodigo.reduce((s, f) => s + (f.m3EnObra ?? 0), 0)) : null,
    peligrososT: r3(porCodigo.filter((f) => f.peligroso).reduce((s, f) => s + f.t, 0)),
  };

  /* ---- 5. alcance (art. 4.1 y 4.2) --------------------------------------- */
  const apartados: Apartado[] = estudio.fase === 'basico' ? ['1', '2', '3', '4', '7'] : ['1', '2', '3', '4', '5', '6', '7'];
  const alcance = {
    apartados,
    inventario: existente,
    motivo:
      (estudio.fase === 'basico'
        ? 'Proyecto básico: apartados 1.º a 4.º y 7.º del art. 4.1 a) (RD 105/2008, art. 4.2)'
        : 'Proyecto de ejecución: apartados 1.º a 7.º del art. 4.1 a) del RD 105/2008') +
      (existente ? ', e inventario de residuos peligrosos (art. 4.1 b).' : '.'),
  };

  /* ---- 6. destino por código (3.º) --------------------------------------- */
  const destinos: FilaDestino[] = porCodigo.map((f) => {
    const decl = estudio.destinos[f.ler];
    const def = destinoPorDefecto(f.ler, f.fraccion);
    const op = decl?.operacion !== undefined ? decl.operacion : def.operacion;
    // El gestor es opcional: el art. 4.1 a) 3.º pide la operación, no quién la hace; lo
    // designa el poseedor en su plan de gestión y lo acredita en cada entrega (art. 5).
    const gestor = decl?.gestor && (decl.gestor.nombre.trim() || decl.gestor.autorizacion.trim()) ? decl.gestor : null;
    if (!op) pend({ id: `op:${f.ler}`, apartado: '3', ler: f.ler, texto: `${f.ler}: falta la operación de tratamiento (la indica el gestor autorizado).` });
    if (andalucia && esVertedero(op) && !tieneAmianto(f.ler) && !decl?.justificacionVertedero)
      avisa({ id: `vertedero:${f.ler}`, ler: f.ler,
        texto: `${f.ler} va a vertedero: en Andalucía solo cabe si el tratamiento es inviable y se justifica (Decreto 73/2012, art. 86.2).` });
    return {
      ler: f.ler,
      descripcion: f.descripcion,
      peligroso: f.peligroso,
      operacion: op,
      operacionNombre: op ? operacion(op)?.nombre ?? null : null,
      destino: decl?.destino || def.destino,
      gestor,
      porDefecto: decl?.operacion === undefined,
    };
  });

  /* ---- 7. separación (4.º) ----------------------------------------------- */
  const tPorFraccion = new Map<string, number>();
  for (const f of porCodigo) tPorFraccion.set(f.fraccion, (tPorFraccion.get(f.fraccion) ?? 0) + f.t);
  const separacion: FilaFraccion[] = [...tPorFraccion.entries()].map(([fr, t]) => {
    const fraccion = fr as FilaFraccion['fraccion'];
    const base = { fraccion, nombre: NOMBRE_FRACCION[fraccion], t: r3(t) };
    if (FRACCIONES_SIN_UMBRAL.includes(fraccion))
      return { ...base, obligatoria: true, motivo: 'Se clasifica siempre, sin umbral, desde el 01-07-2022.', cita: 'Ley 7/2022, art. 30.2' };
    if (fraccion === 'papelCarton')
      return t > UMBRAL_PAPEL_T
        ? { ...base, obligatoria: true, motivo: 'Supera 0,5 t.', cita: 'RD 105/2008, art. 5.5' }
        : { ...base, obligatoria: false, motivo: 'No supera 0,5 t.', cita: 'RD 105/2008, art. 5.5' };
    if (fraccion === 'peligrosos')
      return {
        ...base,
        obligatoria: true,
        motivo: andalucia
          ? 'Se separan de los no peligrosos con cualquier cantidad; sin separar, toda la mezcla sería peligrosa.'
          : 'Se retiran y manejan aparte, sin mezclarlos con otros residuos.',
        cita: andalucia ? 'Decreto 73/2012, art. 88.1 a)' : 'Ley 7/2022, art. 30.1',
      };
    return { ...base, obligatoria: false, motivo: 'No es una de las fracciones del art. 30.2 de la Ley 7/2022.', cita: 'Ley 7/2022, art. 30.2' };
  });

  /* ---- 8. inventario de peligrosos (art. 4.1 b) -------------------------- */
  const inventario: FilaPeligroso[] = existente
    ? porCodigo
        .filter((f) => f.peligroso)
        .map((f) => ({
          ler: f.ler,
          descripcion: f.descripcion,
          elemento: f.origen.map((o) => (o.kind === 'partida' ? `${o.code} ${o.title}` : o.base)).join('; '),
          t: f.t,
          m3Aparente: f.m3Aparente,
        }))
    : [];
  if (existente) {
    if (!estudio.amianto)
      pend({ id: 'amianto', apartado: 'inventario', texto: 'Indica si hay amianto (no, posible o identificado): es obligatorio en obra existente.' });
    else if (estudio.amianto !== 'no' && !porCodigo.some((f) => tieneAmianto(f.ler)))
      pend({ id: 'amianto-partidas', apartado: 'inventario',
        texto: `El amianto está ${estudio.amianto === 'posible' ? 'como posible' : 'identificado'}, pero ninguna partida confirmada lo retira (17 06 01* o 17 06 05*).` });
  }

  /* ---- 9. coste (7.º) ----------------------------------------------------- */
  const pemObra = pemDe(costesDirectos(partidas, rates.coefK), rates);
  const coste = costeDe(e, gestion, porCodigo, pemObra, pend);

  /* ---- 10. fianza ---------------------------------------------------------- */
  const fianza: FianzaRcd = { baseEstudio: coste.importe, minimoAndalucia: null, declarada: estudio.fianza };
  if (andalucia) {
    const nueva = estudio.tipos.includes('nueva') ? Math.max(0, pemObra - pemPorTipo.derribo - pemPorTipo.excavacion) : 0;
    const reparto = [
      { supuesto: 'derribo' as const, base: pemPorTipo.derribo, pct: 2 },
      { supuesto: 'excavacion' as const, base: pemPorTipo.excavacion, pct: 2 },
      { supuesto: 'nueva' as const, base: nueva, pct: 1 },
    ].filter((x) => x.base > 0);
    fianza.minimoAndalucia = { importe: reparto.reduce((s, x) => s + Math.round((x.base * x.pct) / 100), 0), reparto };
    if (!estudio.repartoFianza?.confirmado && reparto.length)
      pend({ id: 'fianza-reparto', apartado: 'fianza', texto: 'Confirma el reparto de la fianza mínima por supuestos (Decreto 73/2012, art. 81.1).' });
    if (!estudio.ordenanza) pend({ id: 'ordenanza', apartado: 'fianza', texto: 'Indica la ordenanza municipal de residuos y su artículo de fianza.' });
  }
  if (!estudio.fianza || estudio.fianza.importe == null)
    pend({ id: 'fianza', apartado: 'fianza', texto: 'Falta el importe de la fianza y su criterio (lo fija la ordenanza municipal).' });

  /* ---- 11. datos generales ----------------------------------------------- */
  if (!estudio.tipos.length) pend({ id: 'tipos', apartado: 'datos', texto: 'Indica el tipo de obra (nueva, reforma o demolición).' });
  if (!comunidad) pend({ id: 'comunidad', apartado: 'datos', texto: 'Indica la provincia de la obra: decide la normativa autonómica.' });
  else if (!andalucia)
    pend({ id: 'autonomica', apartado: 'datos', texto: 'Normativa autonómica de residuos: pendiente (la app solo trae la de Andalucía).' });
  if (!estudio.redactor?.nombre) pend({ id: 'redactor', apartado: 'firma', texto: 'Indica el técnico que redacta y firma el estudio.' });
  if (estudio.inicioPrevisto && estudio.inicioPrevisto > fecha) {
    const usados = porCodigo.map((f) => f.ler);
    for (const v of cambiosEntre(fecha, estudio.inicioPrevisto, usados))
      avisa({ id: `ler-cambio:${v.desde}`, texto: `La obra empieza después del ${fechaEs(v.desde)}, cuando cambia la lista de residuos (${v.norma}): revisa los códigos afectados.` });
  }

  /* ---- 12. coherencia con el presupuesto (7.º) ---------------------------- */
  const enG: Partida[] = [];
  const generan: Partida[] = [];
  for (const ch of chapters) for (const p of partidas[ch.id] ?? []) (enGestion(ch.id, p) ? enG : generan).push(p);
  for (const a of coherencia({ gestion: enG, generan, porCodigo, andalucia, hayCapitulo: !!gestion })) avisa(a);

  return {
    version: { motor: 1, ler: LER_ID, densidades: SE_AE_ID, ratios: ratiosId },
    fecha,
    comunidad,
    hayDemolicion: [...acc.values()].some((a) => a.tipos.has('demolicion')),
    alcance,
    porCodigo,
    totales,
    destinos,
    separacion,
    inventario,
    coste,
    fianza,
    pendientes,
    avisos,
  };
}

export interface ResultadoPartidaRcd {
  /** t sumando lo que se sabe. */
  t: number;
  /** Algún componente sin un dato o con error. */
  incompleta: boolean;
  componentes: Array<{
    ler: CodigoLer;
    res: ReturnType<typeof convertir>;
    m3Aparente: number | null;
  }>;
}

/** El residuo de UNA partida con su cuenta (lista y editor de la vista). */
export function resultadoPartida(p: Partida, estudio?: EstudioRcdDatos | null): ResultadoPartidaRcd {
  const cantidad = partidaCantidad(p);
  let t = 0;
  let incompleta = false;
  const componentes = (p.rcd?.componentes ?? []).map((c) => {
    const res = convertir(c, cantidad, p.ud);
    let m3Aparente: number | null = null;
    if ('error' in res) incompleta = true;
    else {
      if (res.faltan.length) incompleta = true;
      if (res.t != null) t += res.t;
      m3Aparente = res.m3Aparente;
      if (m3Aparente == null && res.t != null) {
        const d = densidadAparente(c.ler, estudio);
        m3Aparente = d ? res.t / d.tPorM3 : null;
      }
    }
    return { ler: c.ler, res, m3Aparente };
  });
  return { t, incompleta, componentes };
}

function costeDe(
  e: EntradaRcd,
  gestion: ReturnType<typeof contenedoresGestion>,
  porCodigo: FilaCodigo[],
  pemObra: number,
  pend: (p: Pendiente) => void,
): CosteRcd {
  const { chapters, partidas, rates, estudio } = e;
  const pct = (c: number) => (pemObra > 0 ? Math.round((c / pemObra) * 1e5) / 1e3 : null);
  if (gestion) {
    const f = findNode(chapters, estudio.capituloGestion!)!;
    const ps = (partidas[gestion.chapterId] ?? []).filter((p) => gestion.todo || gestion.ids.has(p.sub ?? gestion.chapterId));
    const filas = ps.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      ud: p.ud,
      cantidad: partidaCantidad(p),
      precio: Math.round(p.precio * rates.coefK * 100) / 100,
      importe: partidaImporte(p, rates.coefK),
    }));
    const importe = filas.reduce((s, x) => s + x.importe, 0);
    // Una partida a 0 € (las creadas desde la estimación salen así) no es un coste.
    for (const x of filas)
      if (x.precio === 0 && x.cantidad > 0)
        pend({ id: `precio-partida:${x.id}`, apartado: '7', partidaId: x.id, texto: `La partida ${x.code} «${corta(x.title)}» del capítulo de gestión no tiene precio.` });
    return { modo: 'capitulo', importe, pctPem: pct(importe), capitulo: { id: f.node.id, code: f.node.code, title: f.node.title }, partidas: filas };
  }
  let importe = 0;
  let completo = porCodigo.length > 0;
  for (const fila of porCodigo) {
    const pr = estudio.precios[fila.ler];
    if (pr?.eurPorT != null) importe += Math.round(fila.t * pr.eurPorT * 100);
    else if (pr?.eurPorM3 != null && fila.m3Aparente != null) importe += Math.round(fila.m3Aparente * pr.eurPorM3 * 100);
    else {
      completo = false;
      pend({ id: `precio:${fila.ler}`, apartado: '7', ler: fila.ler, texto: `${fila.ler}: falta el precio de gestión, o enlaza el capítulo de gestión de residuos del presupuesto.` });
    }
  }
  if (!porCodigo.length) pend({ id: 'coste', apartado: '7', texto: 'Falta la valoración del coste de la gestión: enlaza el capítulo de gestión de residuos.' });
  return completo ? { modo: 'precios', importe, pctPem: pct(importe), partidas: [] } : { modo: 'pendiente', importe: null, pctPem: null, partidas: [] };
}

function fechaEs(iso: string): string {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

function corta(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}
