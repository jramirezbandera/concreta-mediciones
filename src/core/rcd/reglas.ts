/* ===========================================================================
   core/rcd/reglas — propuesta automática del residuo de una partida.

   Nada se confirma solo (D5): las reglas dejan `estado: 'propuesta'` con su
   motivo. Leen el título y la descripción, la unidad y el código:
     · exclusiones: capítulo de gestión, transporte o carga de escombros
       (no generan: mueven lo que ya generó la demolición; contarlo sería
       doble cómputo), «desmontaje y reposición» (vuelve a montarse);
     · demolición: un verbo («demolición», «levantado», «desmontaje», «picado»…)
       o un código de demoliciones de un banco conocido (BCCA 01…, Precio
       Centro E01D…, CYPE D…) y un material;
     · excavación: «excavación», «vaciado», «zanja», «pozo» en m³.
   Solo se rellena un espesor si la descripción lo dice («de 7 cm») o si una
   fila del SE-AE es exactamente ese elemento (tabla C.4: tabique de ladrillo
   hueco de 45 o 90 mm, rasilla de 30 mm; C.5: solado sobre plastón). Lo demás
   queda `null` y la propuesta lo pide. Los bancos con `~R` (CYPE) no pasan
   por aquí: traen su residuo (`core/rcd/bc3`).
   =========================================================================== */
import type { Partida } from '../types';
import { unidadRcd, type UnidadRcd } from './conversion';
import { materialSeAe, pesoSuperficieSeAe, refSeAe } from './densidades';
import type { ComponenteRcd, Conversion, ResiduoPartida, Transporte } from './tipos';

/** Texto de la partida en minúsculas y sin tildes, para las reglas. */
export function textoDe(p: Pick<Partida, 'title' | 'desc'>): string {
  return `${p.title} ${p.desc ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

const VERBO_DEMOLICION =
  /\b(demolicion|demoler|derribo|levantad[oa]|levantamiento|desmontaje|desmontad[oa]|desmontar|arranque|arrancad[oa]|picad[oa]|eliminacion de|retirada de (?!residuos|escombros|tierras)|desescombro|apertura de huecos?)\b/;
/** Capítulos de demoliciones de los bancos conocidos (D2): BCCA `01X`, Precio
 *  Centro `E01D`, CYPE `DXX000` y Extremadura: E01E demoliciones, R01D
 *  rehabilitación salvo R01DV (evacuación: transporte y protecciones), Q01D/Q01P
 *  demoliciones y picados, y de la obra civil solo U01CRE/U01CRF (escarificados
 *  y fresados de firme: el resto de U01C ya lo cazan los verbos, y U01CRL005 es
 *  un corte con disco). La regla no sabe de qué banco es la partida: cada
 *  prefijo va lo bastante cerrado para no casar con otro (en Precio Centro,
 *  U01C010 son escarificados del terreno). Lo vigila `reglas.bancos.test.ts`. */
const CODIGO_DEMOLICION = /^(01[A-Z]|E01D|D[A-Z]{2}\d{3}|E01E[A-Z]|R01D[A-UW-Z]|Q01[DP]\d|U01CR[EF])/;
const EXCAVACION = /\b(excavacion|vaciado|desmonte|zanjas?|pozos?)\b/;
const TRANSPORTE_ESCOMBRO = /\b(transporte|carga)\b.*\b(escombros?|tierras?|residuos?|rcd)\b/;
const GESTION = /\b(gestion de residuos|canon de (vertido|gestion)|clasificacion de residuos|alquiler de contenedor(es)?|retirada de (residuos|escombros)|transporte de residuos)\b/;
const REPOSICION = /\b(desmontaje|levantad[oa]|desmontad[oa]) y (posterior )?(reposicion|recolocacion|montaje)\b|\b(para su|y) (reposicion|recolocacion)\b/;

/** ¿El precio de la partida lleva la carga y el transporte del residuo? */
export function transporteDe(texto: string): Transporte {
  if (/\bsin (incluir )?(el )?transporte\b|\bno incluye (la carga|el transporte)\b|\bcarga (manual |mecanica )?(sobre|a) (camion|contenedor)\b(?!.*transporte)/.test(texto))
    return 'excluido';
  if (/\b(incluso|incluida|incluido|con) (la )?(carga y )?transporte\b|\btransporte (a|al|hasta) (vertedero|planta|gestor)\b|\bt\. ?vert|\bcanon\b/.test(texto))
    return 'incluido';
  return 'noDice';
}

/** Primer espesor de la descripción en metros («7 cm», «45 mm», «e=15 cm»). */
export function espesorDe(texto: string): number | null {
  const m = texto.match(/(?:\be\s*=\s*|\bespesor\s*(?:de\s*)?|\bde\s+|<\s*|hasta\s+)(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/);
  if (!m) return null;
  const v = Number(m[1]!.replace(',', '.'));
  if (!(v > 0)) return null;
  const metros = m[2] === 'mm' ? v / 1000 : v / 100;
  return metros >= 0.005 && metros <= 1 ? Math.round(metros * 10000) / 10000 : null;
}

const reutilizable = (t: string): boolean => /\b(reutiliz|recuperacion|recuperar|aprovechamiento|para su posterior uso)/.test(t);

interface Ctx {
  t: string;
  u: UnidadRcd;
  tipo: ComponenteRcd['tipo'];
}

/** Componente con densidad del SE-AE (material) y la conversión que casa con la unidad. */
function porDensidad(ctx: Ctx, ler: string, materialId: string | null): ComponenteRcd {
  const m = materialId ? materialSeAe(materialId) : undefined;
  const densidad = { tPorM3: m?.tPorM3 ?? null, ...(m ? { ref: refSeAe(m.id) } : {}) };
  let conversion: Conversion;
  if (ctx.u === 'm3') conversion = { modo: 'volumen' };
  else if (ctx.u === 'm2') conversion = { modo: 'espesor', espesor: espesorDe(ctx.t) };
  else if (ctx.u === 'kg' || ctx.u === 't') conversion = { modo: 'masa' };
  else conversion = { modo: 'pesoUnidad', kgPorUd: null, m3PorUd: null };
  return { ler, tipo: ctx.tipo, conversion, densidad };
}

/** Componente por peso (unidades, metros, alzadas). */
function porPeso(ctx: Ctx, ler: string, extra: Partial<ComponenteRcd> = {}): ComponenteRcd {
  const conversion: Conversion =
    ctx.u === 'kg' || ctx.u === 't'
      ? { modo: 'masa' }
      : ctx.u === 'm2'
        ? { modo: 'pesoSuperficie', tPorM2: null, espesor: null }
        : ctx.u === 'm3'
          ? { modo: 'volumen' }
          : { modo: 'pesoUnidad', kgPorUd: null, m3PorUd: null };
  return { ler, tipo: ctx.tipo, conversion, ...(ctx.u === 'm3' ? { densidad: { tPorM3: null } } : {}), ...extra };
}

/** Tabique de la tabla C.4 del SE-AE, si la descripción es exactamente ese. */
function tabiqueC4(t: string): string | null {
  if (/\brasilla\b/.test(t)) return 'tabique-rasilla-30';
  if (/\b(hueco sencillo|l\/? ?hueco sencillo|ladrillo hueco simple|lhs|45 ?mm|4,5 ?cm)\b/.test(t)) return 'tabique-ladrillo-hueco-45';
  if (/\b(hueco doble|l\/? ?hueco doble|lhd|tabicon|90 ?mm|9 ?cm)\b/.test(t)) return 'tabique-ladrillo-hueco-90';
  return null;
}

interface Regla {
  id: string;
  material: RegExp;
  motivo: string;
  propone: (ctx: Ctx) => ComponenteRcd[];
}

/** Reglas de material, de la más concreta a la más general. */
const REGLAS: Regla[] = [
  {
    id: 'amianto',
    material: /\b(fibrocemento|uralita|amianto|asbesto)\b/,
    motivo: 'Contiene amianto: residuo peligroso (17 06 05*), al inventario',
    propone: (c) => [porPeso(c, '17 06 05')],
  },
  {
    id: 'tabique-ladrillo',
    material: /\b(tabique|tabicon|tabiqueria|particion|citara|fabrica|muro|pared|hoja exterior|cerramiento|boveda|peldan)\w*\b.*\b(ladrillo|rasilla|ceramic|lh[sd]|l\/ ?h|l\/ ?m)|\b(ladrillo|rasilla)\b/,
    motivo: 'Fábrica de ladrillo (17 01 02)',
    propone: (c) => {
      const id = c.u === 'm2' ? tabiqueC4(c.t) : null;
      if (id) {
        const ps = pesoSuperficieSeAe(id)!;
        return [{ ler: '17 01 02', tipo: c.tipo, conversion: { modo: 'pesoSuperficie', tPorM2: ps.tPorM2, espesor: ps.espesor }, densidad: { tPorM3: null, ref: refSeAe(id) } }];
      }
      const mat = /\bmacizo\b|\bl\/? ?m\b/.test(c.t) ? 'ladrillo-macizo' : /\bperforado\b|\bl\/? ?p\b/.test(c.t) ? 'ladrillo-perforado' : 'ladrillo-hueco';
      return [porDensidad(c, '17 01 02', mat)];
    },
  },
  {
    id: 'bloque',
    material: /\bbloques? (de )?(hormigon|cemento|mortero)\b/,
    motivo: 'Fábrica de bloque de hormigón (17 01 07)',
    propone: (c) => [porDensidad(c, '17 01 07', 'bloque-cemento')],
  },
  {
    id: 'yeso',
    material: /\b(escayola|placa de yeso|yeso laminado|pladur|carton yeso|enlucido|guarnecido|yeso)\b/,
    motivo: 'Material a base de yeso (17 08 02)',
    propone: (c) => [porDensidad(c, '17 08 02', /\b(enlucido|guarnecido|yeso proyectado)\b/.test(c.t) ? 'mortero-yeso' : null)],
  },
  {
    id: 'solado',
    material: /\b(solado|pavimento|suelo|baldosas?|terrazo|gres|azulejos?|alicatado|aplacado|chapado|rodapie|peldano|zocalo)\b/,
    motivo: 'Revestimiento cerámico o pétreo',
    propone: (c) => {
      if (/\b(alicatado|azulejo|aplacado ceramico)\b/.test(c.t)) return [porDensidad(c, '17 01 03', 'baldosa-ceramica')];
      if (c.u === 'm2' && /\b(solado|pavimento|suelo)\b/.test(c.t) && /\b(plaston|mortero|agarre)\b/.test(c.t) && !/\b(piedra|marmol|granito)\b/.test(c.t)) {
        const ps = pesoSuperficieSeAe('solado-plaston-8')!;
        return [{ ler: '17 01 07', tipo: c.tipo, conversion: { modo: 'pesoSuperficie', tPorM2: ps.tPorM2, espesor: espesorDe(c.t) }, densidad: { tPorM3: null, ref: refSeAe(ps.id) } }];
      }
      if (/\b(marmol|caliza)\b/.test(c.t)) return [porDensidad(c, '17 01 07', 'caliza-marmol')];
      if (/\bgranito\b/.test(c.t)) return [porDensidad(c, '17 01 07', 'granito')];
      if (/\bgres\b/.test(c.t)) return [porDensidad(c, '17 01 03', 'baldosa-gres')];
      if (/\b(terrazo|hidraulic)/.test(c.t)) return [porDensidad(c, '17 01 07', 'mortero-cemento')];
      return [porDensidad(c, '17 01 03', 'baldosa-ceramica')];
    },
  },
  {
    id: 'teja',
    material: /\b(teja|tejado|cobertura)\b/,
    motivo: 'Tejas y materiales cerámicos (17 01 03)',
    propone: (c) => [porPeso(c, '17 01 03', reutilizable(c.t) ? { reutilizable: true } : {})],
  },
  {
    id: 'hormigon',
    material: /\b(hormigon|solera|losa|forjado|zapata|cimentacion|viga|pilar|zuncho|muro de contencion|bordillo)\b/,
    motivo: 'Hormigón (17 01 01)',
    propone: (c) => [porDensidad(c, '17 01 01', /\b(armad|ha\b|h\.a\.|forjado|pilar|viga|losa)/.test(c.t) ? 'hormigon-armado' : 'hormigon')],
  },
  {
    id: 'aluminio',
    material: /\baluminio\b/,
    motivo: 'Carpintería o elemento de aluminio (17 04 02)',
    propone: (c) => [porPeso(c, '17 04 02', reutilizable(c.t) ? { reutilizable: true } : {}), ...(/\b(vidrio|acristal|cristal)/.test(c.t) ? [porPeso(c, '17 02 02')] : [])],
  },
  {
    id: 'pvc',
    material: /\b(pvc|polietileno|polipropileno|plastic[oa])\b/,
    motivo: 'Plástico (17 02 03)',
    propone: (c) => [porPeso(c, '17 02 03'), ...(/\b(vidrio|acristal|cristal)/.test(c.t) ? [porPeso(c, '17 02 02')] : [])],
  },
  {
    id: 'madera',
    material: /\b(madera|tarima|parquet|entarimado|puerta de paso|carpinteria interior)\b/,
    motivo: 'Madera (17 02 01)',
    propone: (c) => [porPeso(c, '17 02 01', reutilizable(c.t) ? { reutilizable: true } : {}), ...(/\b(vidrio|acristal|cristal)/.test(c.t) ? [porPeso(c, '17 02 02')] : [])],
  },
  {
    id: 'cobre',
    material: /\b(cobre|laton|bronce)\b/,
    motivo: 'Cobre, bronce, latón (17 04 01)',
    propone: (c) => [porPeso(c, '17 04 01')],
  },
  {
    id: 'cables',
    material: /\b(cable|cableado|instalacion electrica|electricidad|mecanismos electricos|cuadro electrico)\b/,
    motivo: 'Cables (17 04 11)',
    propone: (c) => [porPeso(c, '17 04 11')],
  },
  {
    id: 'acero',
    material: /\b(acero|hierro|fundicion|metalic[oa]|cerrajeria|barandilla|reja|verja|valla|chapa|perfil|bano de acero|banera)\b/,
    motivo: 'Hierro y acero (17 04 05)',
    propone: (c) => [porPeso(c, '17 04 05', reutilizable(c.t) ? { reutilizable: true } : {}), ...(/\b(vidrio|acristal|cristal)/.test(c.t) ? [porPeso(c, '17 02 02')] : [])],
  },
  {
    id: 'vidrio',
    material: /\b(vidrio|acristalamiento|cristal|luna)\b/,
    motivo: 'Vidrio (17 02 02)',
    propone: (c) => [porDensidad(c, '17 02 02', 'vidrio')],
  },
  {
    id: 'sanitarios',
    material: /\b(sanitarios?|inodoro|lavabo|bide|plato de ducha|fregadero|vertedero de)\b/,
    motivo: 'Aparatos sanitarios cerámicos (17 01 03), reutilizables según la Ley 7/2022 art. 30.2',
    propone: (c) => [porPeso(c, '17 01 03', { reutilizable: true })],
  },
  {
    id: 'aislamiento',
    material: /\b(aislamiento|lana mineral|lana de roca|fibra de vidrio|poliestireno|poliuretano|xps|eps)\b/,
    motivo: 'Materiales de aislamiento (17 06 04)',
    propone: (c) => [porDensidad(c, '17 06 04', /poliestireno|eps|xps/.test(c.t) ? 'poliestireno-expandido' : null)],
  },
  {
    id: 'bituminoso',
    material: /\b(asfalt|betun|bituminos|tela asfaltica|lamina asfaltica|impermeabilizacion)\w*\b/,
    motivo: 'Mezclas bituminosas sin alquitrán (17 03 02)',
    propone: (c) => [porDensidad(c, '17 03 02', 'asfalto')],
  },
];

/**
 * Propuesta para una partida, o `null` si ninguna regla la reconoce (la IA
 * puede sugerir después). `enGestion`: la partida está en el capítulo de
 * gestión enlazado (7.º).
 */
export function proponerResiduo(p: Pick<Partida, 'code' | 'title' | 'desc' | 'ud'>, enGestion = false): ResiduoPartida | null {
  const t = textoDe(p);
  const u = unidadRcd(p.ud);
  const transporte = transporteDe(t);
  if (enGestion || GESTION.test(t))
    return enGestion
      ? { estado: 'gestion', origen: { tipo: 'regla', ref: 'gestion', motivo: 'Partida del capítulo de gestión de residuos (7.º)' }, componentes: [] }
      : null;
  const demolicion = VERBO_DEMOLICION.test(t) || CODIGO_DEMOLICION.test(p.code.toUpperCase());
  if (TRANSPORTE_ESCOMBRO.test(t) && !demolicion)
    return {
      estado: 'propuesta',
      origen: { tipo: 'regla', ref: 'transporte', motivo: 'Transporte o carga de residuos: no genera; mueve lo que ya generan las demoliciones (contarlo sería doble cómputo)' },
      componentes: [],
      transporte: 'incluido',
    };
  if (demolicion && REPOSICION.test(t))
    return {
      estado: 'propuesta',
      origen: { tipo: 'regla', ref: 'reposicion', motivo: 'Se desmonta y se vuelve a montar: no genera residuo' },
      componentes: [],
    };
  if (!demolicion && u === 'm3' && EXCAVACION.test(t))
    return {
      estado: 'propuesta',
      origen: { tipo: 'regla', ref: 'excavacion', motivo: 'Excavación: tierras y piedras (17 05 04); indica la densidad de la tierra' },
      componentes: [{ ler: '17 05 04', tipo: 'excavacion', conversion: { modo: 'volumen' }, densidad: { tPorM3: null } }],
      transporte,
    };
  if (!demolicion) return null;
  const regla = REGLAS.find((r) => r.material.test(t));
  if (!regla) return null;
  const componentes = regla.propone({ t, u, tipo: 'demolicion' });
  return {
    estado: 'propuesta',
    origen: { tipo: 'regla', ref: regla.id, motivo: regla.motivo },
    componentes,
    transporte,
  };
}

/** Estado legible de la propuesta: «noGenera» cuando no trae componentes. */
export function estadoTrasConfirmar(r: ResiduoPartida): ResiduoPartida['estado'] {
  return r.componentes.length ? 'confirmada' : 'noGenera';
}
