/* ===========================================================================
   core/ess/reglas — qué fichas del catálogo propone el presupuesto
   (docs/plan-seguridad-salud.md, §Reglas y E2). PURO.

   En concreta-instalaciones la propuesta salía de las justificaciones del CTE
   y de El edificio; aquí sale de lo que se ejecuta: las partidas. Cuatro
   capas, en este orden:
     1. lo común a toda obra (la misma lista que instalaciones);
     2. por partida: el título (y, para la maquinaria y los medios, también la
        descripción) en minúsculas y sin tildes, como `rcd/reglas` y
        `pcc/reglas`. Las reglas de construir no leen una partida de
        demolición («Demolición de forjado» no es un forjado);
     3. por ficha: lo que trae consigo una fase (el forjado, sus puntales y
        su vibrador);
     4. por los datos del estudio y de la obra (vía pública, edificio en uso,
        grúa torre, plantas).
   No se leen los capítulos de seguridad y salud, de gestión de residuos ni de
   control de calidad: son medios de la obra, no unidades que se ejecuten.
   INTERPRETACIÓN: la app propone y el técnico marca o quita (K-SYS.12).
   =========================================================================== */
import { subtreeIds } from '../tree';
import type { Chapter, Partida, PartidasMap } from '../types';
import { FICHAS_EBSS } from './catalogo';
import { tiposDe, type EntradaEss } from './obra';

/** Una partida que motiva una ficha (para enlazarla desde la pantalla). */
export interface PartidaMotivo {
  chapterId: string;
  partidaId: string;
  code: string;
  title: string;
}

/** Una ficha que propone la app, con sus motivos y las partidas que la piden. */
export interface FichaPropuesta {
  id: string;
  motivos: string[];
  partidas: PartidaMotivo[];
}

export type EntradaPropuesta = Pick<
  EntradaEss,
  'chapters' | 'partidas' | 'obra' | 'estudioRcd' | 'datos'
> & {
  /** Otros capítulos que no se leen (el de control de calidad enlazado). */
  excluidos?: ReadonlyArray<string | null | undefined>;
};

/** Texto en minúsculas y sin tildes, para las reglas. */
export function normaliza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

// ── Lo que no se lee ─────────────────────────────────────────────────────────

const RE_NO_EJECUCION =
  /seguridad y salud|seguridad e higiene|gestion de residuos|residuos|control de calidad|\bensayos\b/;

/** Contenedores (capítulo o sub) cuyo contenido no se lee. */
function contenedoresExcluidos(
  chapters: Chapter[],
  ids: ReadonlyArray<string | null | undefined>,
): Set<string> {
  const fuera = new Set<string>();
  const quitar = new Set(ids.filter((x): x is string => !!x));
  const walk = (n: Chapter | NonNullable<Chapter['children']>[number]) => {
    if (RE_NO_EJECUCION.test(normaliza(n.title)) || quitar.has(n.id)) {
      for (const id of subtreeIds(n)) fuera.add(id);
      return;
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const ch of chapters) walk(ch);
  return fuera;
}

// ── Capa 2: por partida ──────────────────────────────────────────────────────

const VERBO_DEMOLICION =
  /\b(demolicion|demoler|derribo|levantad[oa]|levantamiento|desmontaje|desmontad[oa]|arranque|arrancad[oa]|picad[oa]|eliminacion de|retirada de (?!residuos|escombros|tierras|enseres|mobiliario)|desescombro|apertura de huecos?)\b/;

interface ReglaPartida {
  fichas: readonly string[];
  /** Sobre el título. */
  titulo?: RegExp;
  /** Sobre el título y la descripción (maquinaria y medios). */
  texto?: RegExp;
  /** Si el título casa con esto, la regla no se aplica. */
  no?: RegExp;
  /** Unidad de obra que se construye: no se aplica a una partida de demolición. */
  construye?: true;
  /** Solo en obra sobre edificio existente / solo con demolición del edificio. */
  si?: 'reforma' | 'demolicion';
}

/** La correspondencia partida → ficha, ordenada como el catálogo. */
export const REGLAS_PARTIDA: readonly ReglaPartida[] = [
  // Demoliciones y trabajos previos.
  {
    fichas: ['F1'],
    titulo: VERBO_DEMOLICION,
    no: /apertura de huecos?|picado|revestimiento|pavimento|solado|alicatado|rodapie|enfoscado|guarnecido|yeso|solera/,
    si: 'reforma',
  },
  {
    fichas: ['F2', 'M1', 'M15'],
    titulo:
      /\b(demolicion|derribo)\b.*(edificio|edificacion|nave|construccion|vivienda)|demolicion (completa|integral|total)|medios mecanicos|retroexcavadora|maquina/,
    si: 'demolicion',
  },
  {
    fichas: ['F2', 'M1'],
    titulo:
      /\b(demolicion|derribo)\b.*(retroexcavadora|medios mecanicos|martillo hidraulico|por empuje)/,
  },
  {
    fichas: ['F3'],
    titulo:
      /\b(demolicion|levantad[oa]|picad[oa]|eliminacion|arranque|picado)\b.*\b(revestimiento|alicatado|aplacado|pavimento|solado|solera|rodapie|enfoscado|guarnecido|yeso|enlucido|falso techo)/,
  },
  {
    fichas: ['F40', 'MA6', 'M14'],
    titulo:
      /apertura de huecos?|recalce|refuerzo de (la )?(cimentacion|forjado|viga|pilar|muro)|micropilote|zuncho de refuerzo|apeo|cosido de grietas/,
  },

  // Movimiento de tierras y cimentación.
  {
    fichas: ['F4', 'M1', 'M2'],
    titulo:
      /excavacion|vaciado (de|del) (terreno|tierras|solar)|desmonte|explanacion|desbroce|terraplenado/,
    no: /zanja|pozo/,
    construye: true,
  },
  { fichas: ['F5'], titulo: /zanjas?\b/, construye: true },
  {
    fichas: ['F6'],
    titulo: /excavacion .*pozos?\b|pozos? de cimentacion|poceria/,
    construye: true,
  },
  {
    fichas: ['F7', 'M20'],
    titulo: /relleno|terraplen|compactacion|encachado|zahorra|sub-?base granular/,
    construye: true,
  },
  {
    fichas: ['F8'],
    titulo:
      /zapata|losa de cimentacion|cimentacion|muro de sotano|foso de ascensor|viga (de atado|riostra|centradora)|hormigon de limpieza|encepado|micropilote|pilote/,
    construye: true,
  },
  {
    fichas: ['F9', 'F10'],
    titulo: /muro (de contencion|de hormigon|de sotano)|muro .*dos caras/,
    construye: true,
  },

  // Estructura.
  {
    fichas: ['F10'],
    titulo:
      /encofrado|forjado|losa (maciza|de escalera|de hormigon)|pilar(es)? de hormigon|vigas? de hormigon|zuncho/,
    construye: true,
  },
  {
    fichas: ['F11'],
    titulo:
      /forjado|losa (maciza|de escalera|de hormigon)|pilar(es)? de hormigon|vigas? de hormigon|zuncho|ferralla|hormigon armado|muro de hormigon|escalera de hormigon|capa de compresion/,
    no: /viguetas? metalic|cimentacion|zapata|limpieza/,
    construye: true,
  },
  {
    fichas: ['F12', 'M17'],
    titulo:
      /estructura metalica|acero (laminado|s ?275|s ?355)|perfil(es)? laminado|viguetas? metalic|pilar(es)? metalic|vigas? metalic|dintel de perfil|cercha metalica|placa de anclaje/,
    construye: true,
  },
  {
    fichas: ['F13', 'M6'],
    titulo:
      /placa alveolar|paneles? prefabricad|prefabricado de hormigon|escalera prefabricada|(elementos?|piezas?) prefabricad/,
    no: /arqueta/,
    construye: true,
  },

  // Envolvente y particiones.
  {
    fichas: ['F14'],
    titulo:
      /fachada|cerramiento|hoja exterior|aplacado|cara vista|muro de fabrica|fabrica de (ladrillo|bloque)|recrecido de fabrica/,
    no: /particion|tabique|interior|limpieza|pintura|reparacion|carpinteria/,
    construye: true,
  },
  {
    fichas: ['F15'],
    titulo: /tabique|particion|trasdosado|yeso laminado|pladur|tabiqueria|fabrica .*interior/,
    no: /techo/,
    construye: true,
  },
  {
    fichas: ['F16'],
    titulo: /cubierta plana|azotea|cubierta (no )?transitable|cubierta invertida/,
    construye: true,
  },
  {
    fichas: ['F17'],
    titulo:
      /cubierta inclinada|\bteja|panel sandwich|cobertura|faldon|cumbrera|canalon|(cubierta|cobertura) .*chapa|chapa .*(cubierta|cobertura)/,
    construye: true,
  },
  {
    fichas: ['F18'],
    titulo:
      /impermeabilizacion|lamina (asfaltica|bituminosa|impermeabilizante|de betun)|tela asfaltica/,
    construye: true,
  },
  {
    fichas: ['M18', 'IP8'],
    titulo: /asfaltic|bituminos|oxiasfalto|soplete|lamina de betun/,
    construye: true,
  },
  {
    fichas: ['F19'],
    titulo: /carpinteria|\bpuertas?\b|ventana|premarco|persiana|armario|mampara|cancela/,
    construye: true,
  },
  { fichas: ['F20'], titulo: /vidrio|acristalamiento|\blunas?\b|vidriera/, construye: true },
  {
    fichas: ['F21', 'M17'],
    titulo: /barandilla|\brejas?\b|cerrajeria|pasamanos|cancela|verja|celosia metalica|baranda/,
    construye: true,
  },

  // Instalaciones.
  {
    fichas: ['F22'],
    titulo:
      /electric|cuadro (general|de mando|de proteccion)|mecanismos?|luminaria|alumbrado|toma de corriente|cableado|derivacion individual|baja tension|puesta a tierra|interruptor|fotovoltaic|caja general de proteccion/,
    no: /termo electrico/,
    construye: true,
  },
  {
    fichas: ['F23'],
    titulo:
      /fontaneria|tuberia (de|para) (agua|distribucion|abastecimiento|a\.?c\.?s)|aparatos? sanitario|inodoro|lavabo|plato de ducha|banera|griferi|fregadero|\btermo\b|contador de agua|acometida de (agua|abastecimiento)|llave de paso|montante/,
    construye: true,
  },
  {
    fichas: ['F24'],
    titulo:
      /saneamiento|colector|bajante|arqueta|sumidero|canaleta de drenaje|pozo de registro|desague|red de evacuacion|drenaje|separador de grasas/,
    no: /impermeabilizacion|encuentro/,
    construye: true,
  },
  {
    fichas: ['F25'],
    titulo:
      /climatizacion|aire acondicionado|bomba de calor|aerotermia|calefaccion|caldera|radiador|\bsplit\b|conducto (de|para) (ventilacion|extraccion|aire)|ventilacion|captador solar|energia solar termica|recuperador de calor|unidad (exterior|interior)|suelo radiante/,
    construye: true,
  },
  {
    fichas: ['F26'],
    titulo:
      /telecomunicacion|antena|\bict\b|fibra optica|cable coaxial|toma de usuario|pararrayos|registro de terminacion|videoportero|portero electronico|voz y datos|cable de pares|equipo de cabecera|repartidor|derivador/,
    construye: true,
  },
  {
    fichas: ['F27', 'TP3'],
    titulo:
      /ascensor|plataforma salvaescaleras|plataforma elevadora (vertical|para personas con movilidad)/,
    no: /foso|obra/,
    construye: true,
  },

  // Acabados.
  {
    fichas: ['F28'],
    titulo: /enfoscado|revoco|monocapa|raseo|enlucido de mortero/,
    no: /^cubierta|base de alicatado/,
    construye: true,
  },
  {
    fichas: ['F29'],
    titulo: /guarnecido|enlucido|tendido de yeso|yeso (proyectado|maestreado)/,
    no: /reparacion de grieta|pintura/,
    construye: true,
  },
  {
    fichas: ['F30', 'MA3'],
    titulo: /falso techo|techo (registrable|suspendido|continuo)|escayola/,
    no: /pintura|paramento/,
    construye: true,
  },
  {
    fichas: ['F31', 'M12'],
    titulo:
      /alicatado|azulejo|revestimiento (interior |exterior )?(con|de) (piezas|placas|baldosas)|aplacado/,
    no: /base de alicatado|enfoscado/,
    construye: true,
  },
  {
    fichas: ['F32', 'M12'],
    titulo:
      /solado|pavimento (interior |exterior )?(de|con) (piezas|baldosas|gres|terrazo|marmol|granito|piedra|ceramic|adoquin)|terrazo|baldosa|rodapie|peldan|adoquin/,
    no: /reparacion|limpieza|^cubierta|chapa|lucernario/,
    construye: true,
  },
  {
    fichas: ['F33'],
    titulo:
      /tarima|parquet|pavimento (laminado|vinilico|de madera|de pvc|flexible)|linoleo|moqueta|vinilic/,
    construye: true,
  },
  {
    fichas: ['F34', 'M4'],
    titulo:
      /solera|pavimento continuo de hormigon|pavimento (industrial|de hormigon)|hormigon impreso|hormigon pulido/,
    no: /encachado/,
    construye: true,
  },
  {
    fichas: ['F35', 'IP8'],
    titulo:
      /pintura|barniz|esmalte|imprimacion|lacado|lasur|tratamiento (protector|ignifugo|antioxidante|hidrofugo)/,
    no: /impermeabilizacion/,
    construye: true,
  },
  {
    fichas: ['F37'],
    texto: /trabajos verticales|acceso (y posicionamiento )?(mediante|con) cuerdas|descuelgue/,
  },
  {
    fichas: ['F39', 'M20'],
    titulo:
      /urbanizacion|\bfirme\b|aglomerado asfaltico|mezcla bituminosa|riego de (imprimacion|adherencia)|bordillo|acerado|\bjardin(?!era)|ajardinad|cesped|\bplantacion|\barbol|pista deportiva|pavimento exterior|senalizacion vial/,
    no: /impermeabilizacion|encuentro/,
    construye: true,
  },

  // Medios auxiliares y maquinaria (también en la descripción).
  {
    fichas: ['MA1'],
    texto: /andamio (tubular|modular|de fachada|multidireccional|europeo|metalico)|andamiaje/,
  },
  { fichas: ['MA3'], texto: /torre (de trabajo|movil)|andamio (movil|sobre ruedas)/ },
  { fichas: ['MA4'], texto: /andamio colgado|guindola|plataforma suspendida|gondola/ },
  { fichas: ['MA6'], texto: /\bpuntal(es|ado)?\b|apuntalamiento|\bapeos?\b|cimbra/ },
  {
    fichas: ['MA7'],
    texto: /barandilla (provisional|de proteccion|de seguridad)|proteccion de huecos/,
  },
  {
    fichas: ['MA8'],
    texto: /redes? (de seguridad|horca|horizontal|bajo forjado)|red tipo [ust]\b/,
  },
  { fichas: ['MA9'], texto: /linea de vida|cable fiador|dispositivo de anclaje/ },
  { fichas: ['MA10'], texto: /bajante de escombros|conducto de evacuacion de escombros/ },
  { fichas: ['MA11'], texto: /visera|marquesina de proteccion/ },
  { fichas: ['MA12'], texto: /plataforma de (carga|descarga)/ },
  {
    fichas: ['MA14'],
    texto:
      /plataforma (elevadora|de trabajo) (movil|articulada|de tijera|telescopica|autopropulsada)|plataforma elevadora\b(?! vertical| para personas con movilidad)|camion cesta|brazo articulado/,
  },
  { fichas: ['MA16'], texto: /\bsilo\b/ },
  {
    fichas: ['M1'],
    texto: /retroexcavadora|miniexcavadora|pala cargadora|\bexcavadora|bulldozer|medios mecanicos/,
  },
  { fichas: ['M2'], texto: /\bcamion\b(?! grua| hormigonera| cesta| bomba)/ },
  { fichas: ['M3'], texto: /dumper|motovolquete/ },
  {
    fichas: ['M4'],
    texto: /camion hormigonera|hormigon (preparado|premezclado|fabricado en central)/,
  },
  {
    fichas: ['M5'],
    texto: /bomba (de hormigon|autopropulsada)|hormigon bombeado|vertido con bomba|mediante bombeo/,
  },
  {
    fichas: ['M6', 'F36', 'MA15'],
    texto: /camion grua|camion con grua|grua (autopropulsada|movil)/,
  },
  { fichas: ['M7', 'F36', 'MA15'], texto: /grua torre/ },
  {
    fichas: ['M8'],
    texto: /montacargas|elevador de materiales|maquinillo|cabrestante|ascensor de obra/,
  },
  { fichas: ['M9', 'MA15'], texto: /carretilla elevadora|manipulador telescopico/ },
  {
    fichas: ['M10'],
    texto:
      /hormigonera\b(?! autopropulsada)|amasadora|mortero (de cemento )?(hecho|elaborado|confeccionado) en obra/,
    no: /camion hormigonera/,
  },
  { fichas: ['M11'], texto: /sierra circular/ },
  {
    fichas: ['M12'],
    texto:
      /\bradial\b|rozadora|\brozas?\b|disco de diamante|corte (con disco|de pavimento)|cortadora/,
  },
  { fichas: ['M14'], texto: /martillo (rompedor|percutor|electrico)/ },
  { fichas: ['M15'], texto: /martillo neumatico|compresor/ },
  { fichas: ['M17'], texto: /soldadura (electrica|por arco)|soldad[oa]s? en obra|electrodo/ },
  {
    fichas: ['M18', 'IP8'],
    texto: /soplete|oxicorte|oxiacetilen|soldadura (con|por|a) gas|termofusion/,
  },
  { fichas: ['M19'], texto: /grupo electrogeno/ },
  { fichas: ['M20'], texto: /\bpison|bandeja vibrante|rodillo (vibrante|compactador)|compactador/ },
  {
    fichas: ['M21'],
    texto: /dobladora|cortadora de ferralla|ferralla (elaborada|cortada y doblada) en obra/,
  },
];

// ── Capa 3: lo que trae consigo una ficha ────────────────────────────────────

/** `de` propuesta → `a` propuestas, con el motivo «con «<título de `de`>»». */
const DERIVADAS: ReadonlyArray<{ de: readonly string[]; a: readonly string[] }> = [
  { de: ['F1', 'F2', 'F3'], a: ['MA10', 'M2', 'M14'] },
  { de: ['F8', 'F9', 'F11', 'F34'], a: ['M4'] },
  { de: ['F8', 'F9', 'F11'], a: ['M16'] },
  { de: ['F10'], a: ['M11'] },
  { de: ['F11'], a: ['MA6', 'MA7'] },
  { de: ['F14', 'F15', 'F28'], a: ['M10'] },
  { de: ['F16', 'F17'], a: ['MA7', 'MA9', 'TP1'] },
  { de: ['F14', 'F20'], a: ['TP2'] },
  { de: ['F22', 'F23', 'F24', 'F25', 'F26'], a: ['M12', 'TP3'] },
  { de: ['F27'], a: ['MA7'] },
  { de: ['F4', 'F5', 'F6'], a: ['M1', 'M2'] },
  { de: ['F5'], a: ['MA13'] },
  { de: ['M6', 'M7', 'M9'], a: ['F36', 'MA15'] },
  { de: ['F35', 'F18', 'M18'], a: ['IP8'] },
];

// ── Capa 1 y 4 ───────────────────────────────────────────────────────────────

/** Lo que tiene toda obra (la lista de concreta-instalaciones, feature-35 paso 4). */
export const COMUNES = [
  'F0',
  'IP1',
  'IP3',
  'IP4',
  'IP5',
  'IP6',
  'IP7',
  'MA2',
  'MA5',
  'M13',
  'M22',
] as const;

/** Orden del catálogo, para que la propuesta salga como el estudio. */
const ORDEN = new Map(FICHAS_EBSS.map((f, i) => [f.id, i]));
const TITULO = new Map(FICHAS_EBSS.map((f) => [f.id, f.titulo]));

/**
 * Las fichas que propone la app para esta obra, con sus motivos y las
 * partidas que las piden, en el orden del catálogo.
 */
export function fichasPropuestas(e: EntradaPropuesta): FichaPropuesta[] {
  const props = new Map<string, FichaPropuesta>();
  const anota = (id: string, motivo: string | null, p?: PartidaMotivo) => {
    if (!ORDEN.has(id)) return;
    let f = props.get(id);
    if (!f) props.set(id, (f = { id, motivos: [], partidas: [] }));
    if (motivo && !f.motivos.includes(motivo)) f.motivos.push(motivo);
    if (p && !f.partidas.some((x) => x.partidaId === p.partidaId)) f.partidas.push(p);
  };

  // 1. Común.
  for (const id of COMUNES) anota(id, 'común a toda obra');

  // 2. Por partida.
  const tipos = tiposDe(e);
  // Sin tipo declarado, una partida de demolición se lee como reforma (sale pendiente el tipo).
  const reforma = tipos.includes('reforma') || tipos.length === 0;
  const demolicion = tipos.includes('demolicion');
  const fuera = contenedoresExcluidos(e.chapters, [
    e.datos.capituloSs,
    e.estudioRcd?.capituloGestion,
    ...(e.excluidos ?? []),
  ]);
  for (const ch of e.chapters)
    for (const p of e.partidas[ch.id] ?? []) {
      if (fuera.has(p.sub ?? ch.id) || fuera.has(ch.id)) continue;
      const titulo = normaliza(p.title);
      const texto = `${titulo} ${normaliza(p.desc ?? '')}`;
      const demuele = VERBO_DEMOLICION.test(titulo);
      const ref: PartidaMotivo = {
        chapterId: ch.id,
        partidaId: p.id,
        code: p.code,
        title: p.title,
      };
      for (const r of REGLAS_PARTIDA) {
        if (r.si === 'reforma' && !reforma) continue;
        if (r.si === 'demolicion' && !demolicion) continue;
        if (r.construye && demuele) continue;
        if (r.no?.test(titulo)) continue;
        const casa = (r.titulo?.test(titulo) ?? false) || (r.texto?.test(texto) ?? false);
        if (!casa) continue;
        for (const id of r.fichas) anota(id, null, ref);
      }
    }
  for (const f of props.values())
    if (f.partidas.length && !f.motivos.length) f.motivos.push(motivoPartidas(f.partidas));

  // 3. Lo que trae consigo una ficha (dos pasadas: una derivada puede derivar).
  for (let pasada = 0; pasada < 2; pasada++)
    for (const d of DERIVADAS) {
      const de = d.de.filter((id) => props.get(id)?.partidas.length);
      if (!de.length) continue;
      const motivo = `con ${de.map((id) => `«${TITULO.get(id)}»`).join(', ')}`;
      for (const id of d.a) anota(id, motivo);
    }

  // 4. Por los datos del estudio y de la obra.
  const en = e.datos.entorno;
  const plantas = e.obra.plantasSobreRasante ?? null;
  if (en?.viaPublica) anota('IP2', 'se ocupa la vía pública');
  if (en?.edificioEnUso) anota('IP9', 'el edificio o el local sigue en uso');
  if (e.datos.medios?.gruaTorre)
    for (const id of ['M7', 'F36', 'MA15', 'MA12']) anota(id, 'hay grúa torre');
  if (e.datos.medios?.gruaMovil)
    for (const id of ['M6', 'F36', 'MA15']) anota(id, 'hay grúa móvil');
  const fachada = ['F14', 'F28'].some((id) => props.get(id)?.partidas.length);
  if (fachada && plantas != null && plantas >= 2)
    anota('MA1', `trabajos de fachada en un edificio de ${plantas} plantas`);
  if (props.get('F11')?.partidas.length && plantas != null && plantas >= 2)
    anota('MA8', `forjados en un edificio de ${plantas} plantas`);
  if (en?.viaPublica && props.has('MA1')) anota('MA11', 'andamio de fachada sobre la vía pública');
  if (
    en?.viaPublica &&
    props
      .get('F25')
      ?.partidas.some((p) =>
        /captador|unidad exterior|bomba de calor|aerotermia|enfriadora|fotovoltaic/.test(
          normaliza(p.title),
        ),
      )
  )
    anota('F42', 'equipos a cubierta con la vía pública ocupada');
  if (
    en?.viaPublica &&
    (plantas ?? 0) >= 1 &&
    props
      .get('F14')
      ?.partidas.some((p) => /mirador|balcon|cornisa|alero|vuelo/.test(normaliza(p.title)))
  )
    anota('F41', 'trabajos en vuelo sobre la vía pública');

  return [...props.values()].sort((a, b) => (ORDEN.get(a.id) ?? 0) - (ORDEN.get(b.id) ?? 0));
}

/** «por 02.03 Excavación en zanja…» o «por 5 partidas (02.03 Excavación…, …)». */
function motivoPartidas(ps: readonly PartidaMotivo[]): string {
  const una = (p: PartidaMotivo) =>
    `${p.code} ${p.title.length > 60 ? `${p.title.slice(0, 58)}…` : p.title}`.trim();
  if (ps.length === 1) return `por ${una(ps[0]!)}`;
  return `por ${ps.length} partidas (${una(ps[0]!)}, …)`;
}

/** Para los tests y la pantalla: el texto con el que leen las reglas. */
export function textoDe(p: Pick<Partida, 'title' | 'desc'>): string {
  return `${normaliza(p.title)} ${normaliza(p.desc ?? '')}`;
}

/** Partidas que lee la propuesta (sin los capítulos excluidos). */
export function partidasLeidas(
  chapters: Chapter[],
  partidas: PartidasMap,
  excluidos: ReadonlyArray<string | null | undefined> = [],
): number {
  const fuera = contenedoresExcluidos(chapters, excluidos);
  let n = 0;
  for (const ch of chapters)
    for (const p of partidas[ch.id] ?? [])
      if (!fuera.has(p.sub ?? ch.id) && !fuera.has(ch.id)) n += 1;
  return n;
}
