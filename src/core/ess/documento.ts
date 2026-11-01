/* ===========================================================================
   core/ess/documento — el estudio básico de seguridad y salud (art. 6 del RD
   1627/1997) en la estructura neutra de `core/documento`, que pinta el Word
   (`features/exportar/docxEss`). docs/plan-seguridad-salud.md, E3. PURO.

   Los 14 apartados del de concreta-instalaciones (feature-35, paso 5), con el
   mismo texto: abre con la justificación del art. 4, solo lleva las fichas que
   el técnico deja marcadas y trae lo que la norma exige y los ejemplos no
   traen (amianto, anexo II, servicios higiénicos del convenio, otras
   actividades y trabajos posteriores). Aquí los datos de la obra salen del
   presupuesto y de la ficha de la obra (`core/ess/obra`). Lo que falta se
   escribe «Pendiente: …», nunca supuesto. Si se da un supuesto del art. 4.1,
   el básico no se redacta: el documento solo dice que hace falta el completo
   (fase 2 del plan).
   =========================================================================== */
import type { BloqueDoc, Documento, Parrafo, SeccionDoc, Trozo } from '../documento/tipos';
import { edificioDe } from '../edificio';
import { obraMeta, type ObraMeta } from '../listado';
import {
  art4,
  coordinadores,
  dotacionHigienica,
  type Art4,
  type Coordinador,
  type LetraSupuesto,
} from './art4';
import { ANEXO_II, nombreRiesgo, riesgosDeFicha } from './catalogo';
import { distanciasLineas } from './cifras';
import type { PendienteDato } from './datos';
import { estudioDe, pendientesDatosEss, sobreExistente, tiposDe, type EntradaEss } from './obra';
import { fichasPropuestas, type EntradaPropuesta, type FichaPropuesta } from './reglas';
import { fichasDelEstudio, fichasSinRevisar } from './seleccion';
import {
  AMIANTO_BASE,
  AMIANTO_MEDIDAS,
  AMIANTO_NORMA,
  BOTIQUIN_GUIA,
  CABEZA_FAMILIA,
  LOCAL_PRIMEROS_AUXILIOS,
  NORMAS_EBSS,
  OBJETO_EBSS,
  OBLIGACIONES_EBSS,
  POSTERIORES_DESTINO,
  POSTERIORES_INTRO,
  PRIMEROS_AUXILIOS_CONVENIO,
  PRIMEROS_AUXILIOS_RD1627,
} from './textos';
import {
  NOMBRE_ESTADO_AMIANTO,
  NOMBRE_FRECUENCIA,
  NOMBRE_SERVICIO,
  SERVICIOS_AFECTADOS,
  type ApartadoAnexoII,
  type ClaveRiesgo,
  type EstudioSeguridadSalud,
  type FichaCatalogo,
  type ItemFicha,
  type RiesgoFicha,
  type TipoObraEss,
} from './tipos';

export const TITULO_ESTUDIO_BASICO = 'Estudio básico de seguridad y salud';

export type EntradaDocumentoEss = EntradaEss & Pick<EntradaPropuesta, 'excluidos'>;

export interface EstudioSs {
  doc: Documento;
  art4: Art4;
  /** Lo que falta para entregarlo, en el orden del documento («Antes de entregar»). */
  pendientes: PendienteDato[];
  propuestas: FichaPropuesta[];
}

// ── Formatos ─────────────────────────────────────────────────────────────────

const euros = (v: number): string =>
  `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const entero = (v: number): string => v.toLocaleString('es-ES', { maximumFractionDigits: 0 });
const decimal = (v: number): string => v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const pct = (v: number): string => `${decimal(v)} %`;
const metros = (cm: number): string =>
  `${(cm / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
const frase = (t: string): string => {
  const s = t.trim();
  return /[.!?]$/.test(s) ? s : `${s}.`;
};
const mayuscula = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const listaY = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
const LETRAS_M = [
  'cero',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
];
const LETRAS_F = [
  'cero',
  'una',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
];
const cuantos = (n: number, sing: string, pl: string, g: 'm' | 'f' = 'm'): string =>
  `${n >= 0 && n <= 10 ? (g === 'f' ? LETRAS_F : LETRAS_M)[n] : String(n)} ${n === 1 ? sing : pl}`;

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
function fechaLarga(iso: string | null | undefined): string | undefined {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : undefined;
}

// ── Bloques ──────────────────────────────────────────────────────────────────

const t = (x: string | Trozo): Trozo => (typeof x === 'string' ? { texto: x } : x);
const P = (...xs: Array<string | Trozo>): BloqueDoc => ({ kind: 'p', p: xs.map(t) });
const pendiente = (texto: string): BloqueDoc =>
  P({ texto: texto.startsWith('Pendiente') ? texto : `Pendiente: ${texto}`, pendiente: true });
const lista = (items: readonly string[]): BloqueDoc => ({
  kind: 'lista',
  items: items.map((i): Parrafo => [{ texto: i }]),
});
const sub = (texto: string): BloqueDoc => ({ kind: 'sub', texto });

/** Ancho útil de la página A4 del Word (dxa). */
const ANCHO = 10546;

/** Una tabla con su rótulo encima y sus llamadas debajo. `pesos` reparte el ancho. */
function tablaB(o: {
  rotulo?: string;
  cabecera: string[];
  filas: Array<Array<string | Trozo>>;
  pesos: number[];
  derecha?: number[];
  notas?: string[];
}): BloqueDoc[] {
  const total = o.pesos.reduce((a, b) => a + b, 0);
  const anchos = o.pesos.map((w) => Math.floor((w / total) * ANCHO));
  anchos[anchos.length - 1]! += ANCHO - anchos.reduce((a, b) => a + b, 0);
  const out: BloqueDoc[] = [];
  if (o.rotulo) out.push(P({ texto: o.rotulo, negrita: true }));
  out.push({
    kind: 'tabla',
    t: {
      columnas: o.cabecera.map((titulo, i) => ({
        titulo,
        ancho: anchos[i]!,
        ...(o.derecha?.includes(i) ? { derecha: true } : {}),
      })),
      filas: o.filas,
    },
  });
  for (const [i, n] of (o.notas ?? []).entries()) out.push(P(`(${i + 1}) ${n}`));
  return out;
}

// ── Lo que el documento sabe de la obra ──────────────────────────────────────

interface Contexto {
  e: EntradaDocumentoEss;
  meta: ObraMeta;
  ss: EstudioSeguridadSalud;
  a4: Art4;
  tipos: TipoObraEss[];
  existente: boolean;
  fichas: FichaCatalogo[];
  marcadas: Set<string>;
  faltan: Map<string, string>;
}

function pendientesDe(c: Contexto, ids: readonly string[]): BloqueDoc[] {
  return ids.flatMap((id) => {
    const x = c.faltan.get(id);
    return x ? [pendiente(x)] : [];
  });
}

const deGrupo = (c: Contexto, g: FichaCatalogo['grupo']): FichaCatalogo[] =>
  c.fichas.filter((f) => f.grupo === g);

/** Las unidades de obra en el orden de ejecución. */
const ORDEN_FASES = [
  'F1', 'F2', 'F3', 'F40', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F41',
  'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24', 'F25', 'F42', 'F26', 'F27', 'F28',
  'F29', 'F30', 'F31', 'F32', 'F33', 'F34', 'F35', 'F39',
]; // prettier-ignore
/** Trabajos que se dan en varias fases: van detrás de las unidades. */
const TRANSVERSALES = new Set(['F36', 'F37', 'F38']);

function fasesEnOrden(c: Contexto): { unidades: FichaCatalogo[]; transversales: FichaCatalogo[] } {
  const f = deGrupo(c, 'F').filter((x) => x.id !== 'F0');
  const pos = (id: string): number => {
    const i = ORDEN_FASES.indexOf(id);
    return i < 0 ? ORDEN_FASES.length : i;
  };
  return {
    unidades: f.filter((x) => !TRANSVERSALES.has(x.id)).sort((a, b) => pos(a.id) - pos(b.id)),
    transversales: f.filter((x) => TRANSVERSALES.has(x.id)),
  };
}

const lineaAerea = (c: Contexto): boolean | undefined => c.ss.entorno?.servicios?.linea_aerea;
/** Alta tensión: más de 1 kV (primera fila de la tabla 1 del RD 614/2001). Sin tensión declarada, no se sabe. */
function altaTension(c: Contexto): boolean | undefined {
  if (lineaAerea(c) !== true) return lineaAerea(c) === false ? false : undefined;
  const kV = c.ss.entorno?.tensionLineas_kV;
  return kV === undefined ? undefined : kV > 1;
}
const hayAmianto = (c: Contexto): boolean =>
  c.ss.amianto?.estado === 'posible' || c.ss.amianto?.estado === 'identificado';

const NOMBRE_TIPO: Record<TipoObraEss, string> = {
  nueva: 'obra nueva',
  reforma: 'reforma',
  demolicion: 'demolición',
};
const tipoObras = (c: Contexto): string =>
  c.tipos.length ? mayuscula(listaY(c.tipos.map((x) => NOMBRE_TIPO[x]))) : 'Sin declarar';

function descripcionEdificio(c: Contexto): string | null {
  const ed = edificioDe(c.e.obra);
  const partes: string[] = [];
  if (ed.plantasSobreRasante != null) {
    const bajo = ed.plantasBajoRasante
      ? ` y ${cuantos(ed.plantasBajoRasante, 'planta', 'plantas', 'f')} bajo rasante`
      : '';
    partes.push(
      `${cuantos(ed.plantasSobreRasante, 'planta', 'plantas', 'f')} sobre rasante${bajo}`,
    );
  }
  if (ed.superficieConstruida != null)
    partes.push(`${decimal(ed.superficieConstruida)} m² construidos`);
  return partes.length ? partes.join(', ') : null;
}

function emplazamiento(c: Contexto): string {
  const m = c.meta;
  const lugar = [m.localidad, m.provincia && m.provincia !== m.localidad ? `(${m.provincia})` : '']
    .filter(Boolean)
    .join(' ');
  return [m.direccion.trim(), lugar].filter(Boolean).join(', ') || 'Sin declarar';
}

const redactorTexto = (c: Contexto): string | null => {
  const r = c.e.datos.redactor;
  return r?.nombre.trim()
    ? [r.nombre.trim(), r.titulacion.trim()].filter(Boolean).join(', ')
    : null;
};

// ── Las fichas impresas ──────────────────────────────────────────────────────

/** «(ver MA10)», «(ver F4 y F5)», «(F14)»: las remisiones del catálogo, que nombran fichas por su id. */
const REMISION = /\s?\((ver )?((?:IP|MA|TP|F|M)\d+(?:(?:, | y )(?:IP|MA|TP|F|M)\d+)*)\)/g;

/** Los ids no se imprimen: la remisión nombra la ficha por su título, y desaparece si no está en este estudio. */
function conTitulos(x: string, titulos: ReadonlyMap<string, string>): string {
  return x.replace(REMISION, (_m, ver: string | undefined, ids: string) => {
    const de = ids
      .split(/, | y /)
      .flatMap((id) => (titulos.has(id) ? [`«${titulos.get(id)}»`] : []));
    return de.length === 0 ? '' : ` (${ver ?? ''}${listaY(de)})`;
  });
}

function fichaConTitulos(f: FichaCatalogo, titulos: ReadonlyMap<string, string>): FichaCatalogo {
  const tt = (x: string) => conTitulos(x, titulos);
  const item = (i: ItemFicha): ItemFicha =>
    typeof i === 'string' ? tt(i) : { ...i, texto: tt(i.texto) };
  return {
    ...f,
    descripcion: tt(f.descripcion),
    medidas: f.medidas.map(item),
    protecciones: f.protecciones.map(item),
    epi: f.epi.map(item),
    eficacia: tt(f.eficacia),
    ...(f.notas ? { notas: f.notas.map(tt) } : {}),
    ...(f.previsiones ? { previsiones: f.previsiones.map(tt) } : {}),
    ...(f.informaciones ? { informaciones: f.informaciones.map(tt) } : {}),
  };
}

const textoRiesgo = (r: RiesgoFicha): string =>
  r.causa ? `${nombreRiesgo(r.clave)} (${r.causa})` : nombreRiesgo(r.clave);
const celdaItem = (i: ItemFicha): string =>
  typeof i === 'string'
    ? i
    : i.frecuencia
      ? `${i.texto} (${NOMBRE_FRECUENCIA[i.frecuencia].toLowerCase()})`
      : i.texto;
/** En la tabla de la ficha: ni lo que va al apartado 7 ni lo que ya dice el texto fijo de su apartado. */
const enTabla = (i: ItemFicha): boolean =>
  typeof i === 'string' || (i.evitable === undefined && !i.enTexto);

/** La ficha a cuatro columnas: listas independientes, una entrada por fila. */
function tablaFicha(f: FichaCatalogo, rotulo?: string): BloqueDoc[] {
  const cols = [
    riesgosDeFicha(f).map(textoRiesgo),
    f.medidas.filter(enTabla).map(celdaItem),
    f.protecciones.filter(enTabla).map(celdaItem),
    f.epi.filter(enTabla).map(celdaItem),
  ];
  const n = Math.max(1, ...cols.map((x) => x.length));
  return tablaB({
    rotulo,
    cabecera: ['Riesgo', 'Medidas preventivas', 'Protecciones colectivas', 'EPI'],
    filas: Array.from({ length: n }, (_, i) => cols.map((x) => x[i] ?? (i === 0 ? '—' : ''))),
    pesos: [26, 30, 24, 20],
  });
}

function bloquesFicha(f: FichaCatalogo): BloqueDoc[] {
  return [
    sub(f.titulo),
    ...tablaFicha(f),
    P(`Eficacia: ${frase(f.eficacia)}`),
    ...(f.notas ?? []).map((n) => P(frase(n))),
  ];
}

// ── Datos generales ──────────────────────────────────────────────────────────

const ESTADO_COORDINADOR: Record<Coordinador['estado'], string> = {
  procede: 'Procede',
  no_procede: 'No procede',
  sin_datos: 'Sin declarar',
};

function datosGenerales(c: Contexto, anexoII: CasoAnexoII[]): SeccionDoc {
  const m = c.ss.manoDeObra;
  const co = coordinadores(c.ss.coordinacion);
  const autor = redactorTexto(c);
  const edificio = descripcionEdificio(c);
  const filas: string[][] = [
    ['Obra', c.meta.denominacion || 'Sin declarar'],
    ['Tipo de obra', tipoObras(c)],
    ...(edificio ? [['Edificio', mayuscula(edificio)]] : []),
    ['Emplazamiento', emplazamiento(c)],
    [
      'Duración prevista',
      m?.plazoDias !== undefined ? `${entero(m.plazoDias)} días laborables` : 'Sin declarar',
    ],
    [
      'Máximo de trabajadores a la vez',
      m?.maxTrabajadores !== undefined ? entero(m.maxTrabajadores) : 'Sin declarar',
    ],
    [
      'Trabajos del anexo II',
      anexoII.length > 0
        ? `${anexoII.length === 1 ? 'Apartado' : 'Apartados'} ${listaY(anexoII.map((x) => String(x.apartado)))} (ver apartado 10)`
        : 'No se prevén (ver apartado 10)',
    ],
    ['Promotor', c.meta.promotor.trim() || 'Sin declarar'],
    [
      'Autor del estudio básico',
      co.proyecto.estado === 'procede'
        ? 'El coordinador en materia de seguridad y salud durante la elaboración del proyecto (art. 6.1)'
        : autor
          ? `${autor}, técnico competente designado por el promotor (art. 6.1)`
          : 'Sin declarar',
    ],
    ['Coordinador durante la elaboración del proyecto', ESTADO_COORDINADOR[co.proyecto.estado]],
    ['Coordinador durante la ejecución de la obra', ESTADO_COORDINADOR[co.ejecucion.estado]],
    ['Presupuesto de ejecución material', c.a4.pec ? euros(c.a4.pec.pem) : 'Sin declarar'],
    ['Presupuesto de ejecución por contrata', c.a4.pec ? euros(c.a4.pec.pec) : 'Sin calcular'],
  ];
  const bloques: BloqueDoc[] = [
    P(
      'Los datos de la obra, en el orden de los que el promotor facilita a los contratistas para la comunicación de apertura del centro de trabajo (Orden TIN/1071/2010, art. 2.2):',
    ),
    ...tablaB({ cabecera: ['Dato', 'Obra'], filas, pesos: [40, 60] }),
  ];
  for (const x of [co.proyecto, co.ejecucion])
    if (x.estado !== 'sin_datos') bloques.push(P(x.motivo));
  bloques.push(...pendientesDe(c, ['tipos', 'varios-proyectistas', 'varias-empresas']));
  if (!c.meta.promotor.trim()) bloques.push(pendiente('Falta el promotor (datos de la obra).'));
  return { id: 'datos', titulo: 'Datos generales', bloques };
}

// ── 1. Justificación del estudio básico ──────────────────────────────────────

const SUPUESTO_CORTO: Record<LetraSupuesto, string> = {
  a: 'a) Presupuesto de ejecución por contrata',
  b: 'b) Duración y trabajadores a la vez',
  c: 'c) Volumen de mano de obra',
  d: 'd) Túneles, galerías, conducciones subterráneas o presas',
};
const SE_SUPERA = { supera: 'Sí', no_supera: 'No', sin_datos: 'Sin datos' } as const;
const COMPROMISO =
  'El promotor se compromete a que se elabore el estudio de seguridad y salud si, al contratar la obra o durante su ejecución, se diera alguno de los supuestos del art. 4.1.';
const TITULO_1 = '1. Justificación del estudio básico';

function justificacion(c: Contexto): SeccionDoc {
  const a = c.a4;
  const b: BloqueDoc[] = [
    P(
      'El RD 1627/1997 obliga al promotor a que se elabore un estudio de seguridad y salud cuando se da alguno de los cuatro supuestos de su art. 4.1, y un estudio básico en los demás casos (art. 4.2). Con los datos del proyecto:',
    ),
  ];
  if (a.pec) {
    const x = a.pec;
    b.push(
      ...tablaB({
        rotulo: 'Presupuesto de ejecución por contrata',
        cabecera: ['Concepto', 'Importe'],
        filas: [
          ['Presupuesto de ejecución material (PEM)', euros(x.pem)],
          [`Gastos generales (${pct(x.gg_pct)} del PEM)`, euros(x.gg)],
          [`Beneficio industrial (${pct(x.bi_pct)} del PEM)`, euros(x.bi)],
          ['Total', euros(x.base)],
          [`IVA (${pct(x.iva_pct)})`, euros(x.iva)],
          [
            { texto: 'Presupuesto de ejecución por contrata (PEC)', negrita: true },
            { texto: euros(x.pec), negrita: true },
          ],
        ],
        pesos: [70, 30],
        derecha: [1],
      }),
    );
  }
  const notas: string[] = [];
  b.push(
    ...tablaB({
      rotulo: 'Supuestos del art. 4.1 del RD 1627/1997',
      cabecera: ['Supuesto', 'Umbral', 'Proyecto', '¿Se supera?'],
      filas: a.supuestos.map((s) => {
        const llamada = s.nota ? ` (${notas.push(s.nota)})` : '';
        return [SUPUESTO_CORTO[s.letra], s.umbral, `${s.proyecto}${llamada}`, SE_SUPERA[s.estado]];
      }),
      pesos: [30, 24, 32, 14],
      notas,
    }),
  );
  const letras = (ls: readonly LetraSupuesto[]): string => listaY(ls.map((l) => `${l})`));
  switch (a.resultado) {
    case 'completo':
      b.push(
        P(
          `Se da ${a.superados.length > 1 ? 'los supuestos' : 'el supuesto'} ${letras(a.superados)} del art. 4.1: el promotor está obligado a que se elabore un estudio de seguridad y salud (arts. 4.1 y 5), que este estudio básico no sustituye.`,
        ),
        pendiente(
          'hace falta el estudio de seguridad y salud del art. 5 del RD 1627/1997; este documento no lo redacta.',
        ),
      );
      return { id: 'justificacion', titulo: TITULO_1, bloques: b };
    case 'basico':
      b.push(
        P(
          'No se da ninguno de los cuatro supuestos del art. 4.1: el promotor está obligado a que se elabore un estudio básico de seguridad y salud (art. 4.2), que es este documento.',
        ),
      );
      break;
    case 'pendiente':
      b.push(
        P(
          `Con los datos declarados no se supera ningún supuesto, pero faltan datos para decidir ${a.sinDatos.length > 1 ? 'los supuestos' : 'el supuesto'} ${letras(a.sinDatos)}.`,
        ),
        ...pendientesDe(c, ['pem', 'plazo', 'trabajadores', 'jornadas', 'subterraneas']),
      );
      break;
  }
  if (a.avisoPec)
    b.push(
      P(
        `El presupuesto de ejecución por contrata queda a ${euros(a.avisoPec.diferencia)} del umbral del supuesto a), un ${pct(a.avisoPec.pct)}: un aumento en la contratación puede superarlo.`,
      ),
    );
  b.push(P(COMPROMISO));
  return { id: 'justificacion', titulo: TITULO_1, bloques: b };
}

// ── 3. Emplazamiento, entorno y servicios afectados ──────────────────────────

const SI_NO = (v: boolean | undefined): string =>
  v === undefined ? 'Sin declarar' : v ? 'Existe' : 'No existe';

function entorno(c: Contexto): SeccionDoc {
  const en = c.ss.entorno;
  const b: BloqueDoc[] = [P(`La obra está en ${emplazamiento(c)}.`)];
  if (en?.viaPublica === true)
    b.push(
      P(
        'La obra ocupa la vía pública (vallado, acopios o andamio sobre la acera): se delimita la zona y se protege el paso de peatones y vehículos, como dice la ficha de trabajos junto a la vía pública (apartado 6).',
      ),
    );
  else if (en?.viaPublica === false)
    b.push(
      P(
        'La obra no ocupa la vía pública: la carga y descarga se hace dentro de la parcela o con la autorización municipal que corresponda.',
      ),
    );
  if (c.existente && en?.edificioEnUso !== undefined)
    b.push(
      P(
        en.edificioEnUso
          ? 'El edificio o el local sigue en uso durante la obra (apartado 9).'
          : 'El edificio o el local no está en uso durante la obra.',
      ),
    );
  b.push(
    ...tablaB({
      rotulo: 'Servicios afectados',
      cabecera: ['Servicio', 'En la zona de la obra'],
      filas: SERVICIOS_AFECTADOS.map((s) => [NOMBRE_SERVICIO[s], SI_NO(en?.servicios?.[s])]),
      pesos: [60, 40],
    }),
  );
  if (en?.servicios?.linea_aerea === true && en.tensionLineas_kV !== undefined) {
    const d = distanciasLineas(en.tensionLineas_kV);
    b.push(
      P(
        d
          ? `La línea aérea próxima es de ${decimal(en.tensionLineas_kV)} kV. Por la tabla 1 del anexo I del RD 614/2001, la zona de peligro llega a ${metros(d.dpel1_cm)} de los conductores con riesgo de sobretensión por rayo (${metros(d.dpel2_cm)} sin él), y la de proximidad, a ${metros(d.dprox2_cm)} donde no se puede delimitar con precisión la zona de trabajo, que es lo habitual en la obra. Nadie invade la zona de peligro, ni con herramientas, materiales o máquinas.`
          : `La línea aérea próxima es de ${decimal(en.tensionLineas_kV)} kV, más de lo que recoge la tabla 1 del anexo I del RD 614/2001: las distancias las fija la compañía.`,
      ),
    );
  }
  b.push(
    P(
      'Antes de empezar se piden a las compañías los planos de sus servicios y se confirma el trazado de los enterrados; las acometidas provisionales de obra se piden a las compañías suministradoras.',
    ),
  );
  const ca = en?.centroAsistencial;
  if (ca) {
    b.push(
      ...tablaB({
        rotulo: 'Centro asistencial más próximo',
        cabecera: ['Dato', 'Centro'],
        filas: [
          ['Nombre', ca.nombre],
          ...(ca.direccion ? [['Dirección', ca.direccion]] : []),
          ...(ca.distancia_km !== undefined
            ? [['Distancia', `${decimal(ca.distancia_km)} km`]]
            : []),
          ...(ca.tiempo_min !== undefined
            ? [['Tiempo de llegada', `${entero(ca.tiempo_min)} min`]]
            : []),
        ],
        pesos: [35, 65],
      }),
      P(
        'Esta información, el recorrido más recomendable y los teléfonos de urgencia se exponen en un lugar visible de la obra (VII Convenio, art. 234.7).',
      ),
    );
  }
  b.push(...pendientesDe(c, ['centro', 'servicios', 'tension']));
  return { id: 'entorno', titulo: '3. Emplazamiento, entorno y servicios afectados', bloques: b };
}

// ── 4. Descripción de la obra y organización ─────────────────────────────────

const tablaDeFichas = (
  rotulo: string,
  cabecera: string,
  fichas: readonly FichaCatalogo[],
): BloqueDoc[] =>
  tablaB({
    rotulo,
    cabecera: [cabecera, 'Descripción'],
    filas: fichas.map((f) => [f.titulo, frase(f.descripcion)]),
    pesos: [35, 65],
  });

function descripcion(c: Contexto): SeccionDoc {
  const m = c.ss.manoDeObra;
  const ed = descripcionEdificio(c);
  const b: BloqueDoc[] = [
    P(
      `${tipoObras(c)}${c.meta.denominacion ? `: ${c.meta.denominacion}` : ''}${ed ? `, ${ed}` : ''}.`,
    ),
  ];
  if (m?.plazoDias !== undefined && m.maxTrabajadores !== undefined)
    b.push(
      P(
        `El plazo previsto es de ${entero(m.plazoDias)} días laborables, con ${cuantos(m.maxTrabajadores, 'trabajador', 'trabajadores')} a la vez como máximo.`,
      ),
    );
  const { unidades, transversales } = fasesEnOrden(c);
  if (unidades.length > 0)
    b.push(
      P('La obra tiene las unidades siguientes, en el orden en que se ejecutan:'),
      ...tablaDeFichas('Unidades de obra', 'Unidad de obra', unidades),
    );
  else b.push(pendiente('no hay ninguna unidad de obra marcada en la selección de fichas.'));
  if (transversales.length > 0)
    b.push(...tablaDeFichas('Trabajos que se dan en varias fases', 'Trabajo', transversales));
  const ma = deGrupo(c, 'MA');
  if (ma.length > 0)
    b.push(...tablaDeFichas('Medios auxiliares y protecciones colectivas previstos', 'Medio', ma));
  const maq = deGrupo(c, 'M');
  if (maq.length > 0) b.push(...tablaDeFichas('Maquinaria prevista', 'Máquina', maq));
  b.push(
    P(
      c.ss.planos?.trim()
        ? `La documentación gráfica de este estudio (planos ${c.ss.planos.trim()}) completa esta descripción.`
        : 'Este estudio no lleva documentación gráfica propia: la obra se describe en los planos del proyecto.',
    ),
  );
  return { id: 'descripcion', titulo: '4. Descripción de la obra y organización', bloques: b };
}

// ── 5. Normas aplicables ─────────────────────────────────────────────────────

function normas(c: Contexto): SeccionDoc {
  const torre = c.ss.medios?.gruaTorre === true || c.marcadas.has('M7');
  const movil = c.ss.medios?.gruaMovil === true || c.marcadas.has('M6');
  const l = NORMAS_EBSS.datos.filter((n) =>
    n.solo === 'grua_torre' ? torre : n.solo === 'grua_movil' ? movil : true,
  );
  return {
    id: 'normas',
    titulo: '5. Normas de seguridad y salud aplicables',
    bloques: [
      P('Se aplican a la obra, en su redacción vigente:'),
      lista(l.map((n) => `${n.titulo}.`)),
    ],
  };
}

// ── 6. Implantación, instalaciones provisionales y servicios higiénicos ──────

function implantacion(c: Contexto): SeccionDoc {
  const b: BloqueDoc[] = [];
  const ip = deGrupo(c, 'IP').filter((f) => f.id !== 'IP6');
  if (ip.length > 0) {
    b.push(sub('6.1. Implantación e instalaciones provisionales'));
    for (const f of ip) b.push(...bloquesFicha(f));
  }
  b.push(sub(`6.${ip.length > 0 ? 2 : 1}. Servicios higiénicos y primeros auxilios`));
  const sh = c.ss.serviciosHigienicos;
  const d = dotacionHigienica(c.ss.manoDeObra?.maxTrabajadores, sh);
  if (d) {
    b.push(
      P(
        `La dotación se calcula con ${cuantos(d.trabajadores, 'trabajador', 'trabajadores')} a la vez, contando las subcontratas y los autónomos, y se adapta a medida que se incorporan (VII Convenio, art. 231.1):`,
      ),
      ...tablaB({
        rotulo: 'Dotación mínima del VII Convenio, art. 232.2',
        cabecera: ['Elemento', 'Por cada', 'Dotación'],
        filas: [
          ['Lavabos', '10 trabajadores o fracción', entero(d.convenio.lavabos)],
          ['Duchas (1)', '10 trabajadores o fracción', entero(d.convenio.duchas)],
          ['Retretes', '25 trabajadores o fracción', entero(d.convenio.retretes)],
        ],
        pesos: [30, 50, 20],
        derecha: [2],
        notas: [
          'Cuando el tipo de actividad o la salubridad lo requieran; la Guía técnica del INSST las recomienda en todas las obras.',
        ],
      }),
      P(
        'Vestuario climatizado, con taquilla de doble compartimento, si hay ropa especial de trabajo o trabajos sucios, y en todo caso un espacio con llave para la ropa y los objetos de cada trabajador (VII Convenio, art. 232.1); la Guía técnica del INSST recomienda vestuarios en todas las obras.',
      ),
    );
    if (d.guia)
      b.push(
        P(
          `Con ${cuantos(d.guia.hombres, 'hombre', 'hombres')} y ${cuantos(d.guia.mujeres, 'mujer', 'mujeres', 'f')}, la Guía técnica del INSST recomienda ${cuantos(d.guia.retretes, 'retrete', 'retretes')} (uno por cada 25 hombres y uno por cada 15 mujeres, o fracción) y ${cuantos(d.guia.urinarios, 'urinario', 'urinarios')} (uno por cada 25 hombres o fracción).`,
        ),
      );
    if (d.admiteAlternativa)
      b.push(
        d.alternativa
          ? P(
              `Es una obra de corta duración o de escasa importancia, que admite una solución alternativa (VII Convenio, art. 231.4): ${frase(d.alternativa)}`,
            )
          : pendiente(
              'la obra se declara de corta duración, pero falta describir la solución alternativa.',
            ),
      );
  } else
    b.push(
      pendiente('la dotación de servicios higiénicos sale con el máximo de trabajadores a la vez.'),
    );
  b.push(
    P(
      'Los trabajadores disponen de agua potable y de instalaciones para comer y, en su caso, para preparar sus comidas (anexo IV, parte A, apartado 19 del RD 1627/1997).',
    ),
    P(PRIMEROS_AUXILIOS_RD1627),
    P(PRIMEROS_AUXILIOS_CONVENIO),
  );
  if (d?.localPrimerosAuxilios) b.push(P(LOCAL_PRIMEROS_AUXILIOS));
  b.push(P(BOTIQUIN_GUIA));
  if (c.ss.entorno?.centroAsistencial)
    b.push(P('El centro asistencial más próximo es el del apartado 3.'));
  const ip6 = c.fichas.find((f) => f.id === 'IP6');
  if (ip6) b.push(...bloquesFicha(ip6));
  return {
    id: 'implantacion',
    titulo: '6. Implantación, instalaciones provisionales y servicios higiénicos',
    bloques: b,
  };
}

// ── 7. Riesgos evitables ─────────────────────────────────────────────────────

function evitables(c: Contexto): SeccionDoc {
  const filas: string[][] = [];
  const fila = (clave: ClaveRiesgo, medida: string, donde: string) =>
    filas.push([nombreRiesgo(clave), medida, donde]);
  for (const f of c.fichas) {
    if (f.grupo === 'TP') continue;
    for (const i of [...f.medidas, ...f.protecciones, ...f.epi])
      if (typeof i === 'object' && i.evitable) fila(i.evitable, i.texto, f.titulo);
  }
  if (lineaAerea(c) === true)
    fila(
      'electrico',
      'Desviar la línea aérea fuera de la zona de la obra o dejarla sin tensión, de acuerdo con la compañía (RD 1627/1997, anexo IV, parte C, apartado 10 c)',
      'Servicios afectados',
    );
  if (hayAmianto(c))
    fila(
      'amianto',
      'Retirar los materiales con amianto antes de demoler, con el plan de trabajo aprobado (apartado 11)',
      'Demolición',
    );
  const b: BloqueDoc[] =
    filas.length > 0
      ? [
          P(
            'Los riesgos que esta obra evita con una decisión concreta, y la medida técnica para ello (art. 6.2):',
          ),
          ...tablaB({
            cabecera: ['Riesgo que se evita', 'Medida que lo evita', 'Unidad de obra'],
            filas,
            pesos: [28, 47, 25],
          }),
          P(
            'No se relacionan los riesgos que el proyecto ya ha evitado en su concepción, ni los que solo pueden reducirse, que van en el apartado 8.',
          ),
        ]
      : [
          P(
            'No se identifican riesgos que esta obra pueda evitar del todo con una decisión concreta: los de cada unidad se controlan y reducen con las medidas del apartado 8.',
          ),
        ];
  return { id: 'evitables', titulo: '7. Riesgos evitables y medidas para evitarlos', bloques: b };
}

// ── 8. Riesgos no eliminables ────────────────────────────────────────────────

function noEliminables(c: Contexto): SeccionDoc {
  let k = 0;
  const num = (x: string) => sub(`8.${++k}. ${x}`);
  const b: BloqueDoc[] = [
    P(
      'Para cada unidad de obra, medio auxiliar y máquina que tiene esta obra, los riesgos que no pueden eliminarse, con las medidas preventivas, las protecciones colectivas y los equipos de protección individual (EPI) que los controlan y reducen, y la valoración de su eficacia (art. 6.2). Las columnas son listas independientes: las medidas de una ficha se aplican a todos sus riesgos.',
    ),
  ];
  const inicial = b.length;
  const f0 = c.fichas.find((f) => f.id === 'F0');
  if (f0) {
    b.push(
      num('Riesgos comunes a toda la obra'),
      P(
        'Rigen en todos los tajos durante toda la obra. Entre paréntesis, la frecuencia de uso de cada medida y equipo.',
      ),
    );
    b.push(
      ...tablaFicha(f0),
      P(`Eficacia: ${frase(f0.eficacia)}`),
      ...(f0.notas ?? []).map((n) => P(frase(n))),
    );
  }
  const { unidades, transversales } = fasesEnOrden(c);
  if (unidades.length + transversales.length > 0) {
    b.push(num('Fases de obra'));
    for (const f of [...unidades, ...transversales]) b.push(...bloquesFicha(f));
  }
  for (const [g, x] of [
    ['MA', 'Medios auxiliares y protecciones colectivas'],
    ['M', 'Maquinaria'],
  ] as const) {
    const fs = deGrupo(c, g);
    if (fs.length === 0) continue;
    b.push(num(x));
    for (const f of fs) b.push(...bloquesFicha(f));
  }
  if (b.length === inicial)
    b.push(pendiente('no hay ninguna ficha de fases, medios o maquinaria marcada.'));
  return {
    id: 'no-eliminables',
    titulo: '8. Riesgos no eliminables: medidas, protecciones y eficacia',
    bloques: b,
  };
}

// ── 9. Otras actividades en el lugar ─────────────────────────────────────────

function otrasActividades(c: Contexto): SeccionDoc {
  const en = c.ss.entorno;
  const b: BloqueDoc[] = [];
  if (en?.edificioEnUso === true && c.existente)
    b.push(
      P(
        `El edificio o el local sigue en uso durante la obra. La zona de obra se separa físicamente de la zona en uso, con un acceso distinto siempre que sea posible; los horarios de los trabajos ruidosos y los cortes de servicios se pactan con los ocupantes y se avisan con antelación, y ningún hueco ni material queda a su alcance${c.marcadas.has('IP9') ? ' (ficha «Obra con el edificio habitado o el local en uso», apartado 6)' : ''}.`,
      ),
    );
  if (en?.viaPublica === true)
    b.push(
      P(
        'La obra ocupa la vía pública: el tránsito de peatones y vehículos sigue junto a ella. Se mantiene un paso protegido y señalizado, las maniobras de carga y descarga se dirigen y nada se iza sobre los viandantes.',
      ),
    );
  if (c.ss.coordinacion?.variasEmpresas === true)
    b.push(
      P(
        'En la obra concurren varias empresas, o empresas y trabajadores autónomos: el coordinador durante la ejecución organiza la coordinación de sus actividades, para que no coincidan tajos incompatibles en la misma zona ni en la misma vertical (RD 171/2004).',
      ),
    );
  if (b.length === 0 && en?.viaPublica === false && (!c.existente || en?.edificioEnUso === false))
    b.push(
      P(
        `No se prevén otras actividades en el lugar: ${c.existente ? 'el edificio no está en uso durante la obra' : 'es una obra nueva'} y no se ocupa la vía pública. Si apareciera alguna, el plan de seguridad y salud la tendrá en cuenta.`,
      ),
    );
  b.push(...pendientesDe(c, ['en-uso', 'via-publica']));
  return { id: 'otras', titulo: '9. Otras actividades en el lugar', bloques: b };
}

// ── 10. Anexo II y recurso preventivo ────────────────────────────────────────

interface CasoAnexoII {
  apartado: ApartadoAnexoII;
  donde: string[];
}

const MEDIDA_ANEXO_II: Partial<Record<ApartadoAnexoII, string>> = {
  1: 'Protección colectiva en todo borde o hueco con caída de más de 2 m (RD 1627/1997, anexo IV, parte C, apartado 3); taludes o entibación en las excavaciones y apeos antes de demoler o de abrir huecos, según la ficha de cada unidad',
  2: 'Plan de trabajo aprobado por la autoridad laboral antes de empezar y empresa inscrita en el RERA (apartado 11)',
  4: 'Desvío o corte de la línea; si no es posible, nadie invade la zona de peligro, con barreras, avisos y gálibos y las distancias de la tabla 1 del anexo I del RD 614/2001 (apartado 3)',
  6: 'Entibación, ventilación forzada y control de la atmósfera antes de entrar y durante el trabajo, según la ficha',
  10: 'Izado y montaje según un procedimiento previo, con la zona de maniobra acotada, las piezas guiadas con cabos y la recepción desde plataforma con barandilla',
};

function casosAnexoII(c: Contexto): CasoAnexoII[] {
  const por = new Map<ApartadoAnexoII, string[]>();
  const anota = (ap: ApartadoAnexoII, donde: string) => {
    const l = por.get(ap) ?? [];
    if (!l.includes(donde)) l.push(donde);
    por.set(ap, l);
  };
  for (const f of c.fichas) {
    if (f.grupo === 'TP') continue;
    for (const x of f.anexoII ?? []) {
      let cuando = x.cuando;
      if (x.apartado === 4) {
        const at = altaTension(c);
        if (at === false) continue;
        if (at === true) cuando = undefined;
      }
      if (x.apartado === 2) {
        if (c.ss.amianto?.estado === 'no_identificado') continue;
        if (hayAmianto(c)) cuando = undefined;
      }
      anota(x.apartado, cuando ? `${f.titulo} (${cuando})` : f.titulo);
    }
  }
  if (hayAmianto(c)) anota(2, 'Materiales con amianto (apartado 11)');
  if (altaTension(c) === true)
    anota(
      4,
      `Línea eléctrica aérea de ${decimal(c.ss.entorno!.tensionLineas_kV!)} kV próxima a la obra`,
    );
  return [...por.entries()]
    .sort(([a], [b]) => a - b)
    .map(([apartado, donde]) => ({ apartado, donde }));
}

function anexoII(casos: CasoAnexoII[]): SeccionDoc {
  const b: BloqueDoc[] =
    casos.length > 0
      ? [
          P(
            'Los trabajos de esta obra que figuran en el anexo II del RD 1627/1997, y su medida específica (art. 6.2):',
          ),
          ...tablaB({
            cabecera: ['Apartado del anexo II', 'Dónde se da', 'Medida específica'],
            filas: casos.map((x) => [
              `${x.apartado}. ${ANEXO_II.datos[x.apartado]}`,
              frase(x.donde.join('; ')),
              frase(MEDIDA_ANEXO_II[x.apartado] ?? 'Las medidas de la ficha de la unidad'),
            ]),
            pesos: [30, 30, 40],
          }),
          P(
            'En estos trabajos es preceptiva la presencia de un recurso preventivo de cada contratista (Ley 31/1995, art. 32 bis y disposición adicional decimocuarta; la Guía técnica del INSST lo pide para los trabajos del anexo II); el plan de seguridad y salud fija la forma de esa presencia (RD 1627/1997, disposición adicional única).',
          ),
        ]
      : [
          P(
            'No se prevén trabajos del anexo II del RD 1627/1997: ninguna de las unidades de esta obra implica los riesgos especiales que relaciona. Si durante la obra se diera alguno, el plan de seguridad y salud recogerá sus medidas específicas y la presencia del recurso preventivo.',
          ),
        ];
  return {
    id: 'anexo-ii',
    titulo: '10. Trabajos con riesgos especiales (anexo II) y recurso preventivo',
    bloques: b,
  };
}

// ── 11. Amianto ──────────────────────────────────────────────────────────────

const TITULO_11 = '11. Identificación de materiales con amianto';

function amianto(c: Contexto): SeccionDoc {
  const am = c.ss.amianto;
  const b: BloqueDoc[] = [];
  if (!am) {
    if (c.existente) b.push(P(AMIANTO_BASE), ...pendientesDe(c, ['amianto']));
    else if (c.tipos.length)
      b.push(
        P(
          `Es una obra nueva en la que no se derriba ni se interviene ninguna construcción existente: no procede la identificación de materiales con amianto (${AMIANTO_NORMA}, art. 10.2).`,
        ),
      );
    else
      b.push(
        P(AMIANTO_BASE),
        pendiente(
          'falta el tipo de obra para saber si procede la identificación de materiales con amianto.',
        ),
      );
    return { id: 'amianto', titulo: TITULO_11, bloques: b };
  }
  b.push(P(AMIANTO_BASE));
  const tipo =
    am.friable === undefined ? '' : am.friable ? ', de tipo friable' : ', de tipo no friable';
  b.push(
    P(
      `${NOMBRE_ESTADO_AMIANTO[am.estado]}${am.ubicacion?.trim() ? `: ${am.ubicacion.trim()}` : ''}${am.estado !== 'no_identificado' ? tipo : ''}.`,
    ),
  );
  if (am.estado === 'no_identificado')
    b.push(
      P(
        'Si durante la obra apareciera algún material sospechoso de contener amianto, se paran los trabajos en esa zona y no se reanudan hasta identificarlo y, si lo contiene, actuar como dice el real decreto.',
      ),
    );
  else {
    if (am.estado === 'posible')
      b.push(
        P(
          'Mientras no se descarte con la identificación del material, se trata como si contuviera amianto.',
        ),
      );
    b.push(lista(AMIANTO_MEDIDAS), P(`Artículos del ${AMIANTO_NORMA}.`));
  }
  return { id: 'amianto', titulo: TITULO_11, bloques: b };
}

// ── 12. Trabajos posteriores ─────────────────────────────────────────────────

const TITULO_12 = '12. Trabajos posteriores: previsiones e informaciones útiles';

function posteriores(c: Contexto): SeccionDoc {
  const tp = deGrupo(c, 'TP');
  const b: BloqueDoc[] = [P(POSTERIORES_INTRO)];
  if (tp.length === 0) {
    b.push(pendiente('no hay ninguna ficha de trabajos posteriores marcada (art. 6.3).'));
    return { id: 'posteriores', titulo: TITULO_12, bloques: b };
  }
  for (const [i, f] of tp.entries()) {
    b.push(sub(`12.${i + 1}. ${f.titulo}`));
    const prev = f.previsiones ?? [];
    const info = f.informaciones ?? [];
    const n = Math.max(1, prev.length, info.length);
    b.push(
      ...tablaB({
        rotulo: 'Previsiones e informaciones útiles',
        cabecera: ['Previsiones', 'Informaciones útiles'],
        filas: Array.from({ length: n }, (_, j) => [
          prev[j] ?? (j === 0 ? '—' : ''),
          info[j] ?? (j === 0 ? '—' : ''),
        ]),
        pesos: [50, 50],
      }),
      ...tablaFicha(f, 'Riesgos y medidas'),
      P(`Eficacia: ${frase(f.eficacia)}`),
    );
  }
  b.push(P(POSTERIORES_DESTINO));
  return { id: 'posteriores', titulo: TITULO_12, bloques: b };
}

// ── 13. Obligaciones y 14. Firma ─────────────────────────────────────────────

function obligaciones(c: Contexto): SeccionDoc {
  const b = OBLIGACIONES_EBSS.map((x) => P(x));
  if (c.ss.coordinacion?.cabezaFamilia === true) b.push(P(CABEZA_FAMILIA));
  return { id: 'obligaciones', titulo: '13. Obligaciones durante la obra', bloques: b };
}

function firma(c: Contexto): SeccionDoc {
  const lugar = c.meta.localidad || '—';
  const fecha = fechaLarga(c.e.datos.fecha);
  const promotor = c.meta.promotor.trim();
  return {
    id: 'firma',
    titulo: '14. Firma',
    bloques: [
      P(fecha ? `En ${lugar}, a ${fecha}.` : `En ${lugar}, en la fecha de la firma.`),
      P(
        `Conforme con el compromiso del apartado 1, el promotor${promotor ? `: ${promotor}` : '.'}`,
      ),
    ],
  };
}

// ── El documento ─────────────────────────────────────────────────────────────

function contextoDe(e: EntradaDocumentoEss, propuestas: FichaPropuesta[]): Contexto {
  const ss = estudioDe(e);
  const editadas = fichasDelEstudio(propuestas, e.datos.seleccion);
  const titulos = new Map(editadas.map((f) => [f.id, f.titulo]));
  const fichas = editadas.map((f) => fichaConTitulos(f, titulos));
  const tipos = tiposDe(e);
  return {
    e,
    meta: obraMeta(e.obra),
    ss,
    a4: art4(ss),
    tipos,
    existente: sobreExistente(tipos),
    fichas,
    marcadas: new Set(fichas.map((f) => f.id)),
    faltan: new Map(pendientesDatosEss(e).map((d) => [d.id, d.texto])),
  };
}

function pendientesDeContexto(c: Contexto, propuestas: FichaPropuesta[]): PendienteDato[] {
  if (c.a4.resultado === 'completo')
    return [
      {
        id: 'completo',
        texto: `Se da el supuesto ${listaY(c.a4.superados.map((l) => `${l})`))} del art. 4.1 del RD 1627/1997: hace falta el estudio de seguridad y salud completo, que la app aún no redacta.`,
      },
    ];
  const out: PendienteDato[] = [...pendientesDatosEss(c.e)];
  for (const f of fichasSinRevisar(propuestas, c.e.datos.seleccion))
    out.push({
      id: `ficha:${f.id}`,
      texto: `La ficha «${f.titulo}», redactada por la app, está sin revisar.`,
    });
  if (!c.meta.promotor.trim())
    out.push({ id: 'promotor', texto: 'Falta el promotor (datos de la obra).' });
  if (fasesEnOrden(c).unidades.length === 0)
    out.push({
      id: 'unidades',
      texto: 'No hay ninguna unidad de obra marcada en la selección de fichas.',
    });
  if (deGrupo(c, 'TP').length === 0)
    out.push({
      id: 'posteriores',
      texto: 'No hay ninguna ficha de trabajos posteriores marcada (art. 6.3).',
    });
  return out;
}

/**
 * El estudio básico de la obra, apartado a apartado, con el resultado del
 * art. 4 y lo que falta. Con `completo`, solo la justificación.
 */
export function estudioSs(e: EntradaDocumentoEss): EstudioSs {
  const propuestas = fichasPropuestas(e);
  const c = contextoDe(e, propuestas);
  const r = e.datos.redactor;
  const doc: Documento = {
    titulo: TITULO_ESTUDIO_BASICO,
    secciones: [],
    firma: r?.nombre.trim()
      ? {
          nombre: r.nombre.trim(),
          sub: [r.titulacion.trim(), r.colegiado.trim() ? `Col. ${r.colegiado.trim()}` : '']
            .filter(Boolean)
            .join(' · '),
        }
      : null,
  };
  const pendientes = pendientesDeContexto(c, propuestas);
  if (c.a4.resultado === 'completo') {
    doc.secciones = [justificacion(c)];
    return { doc, art4: c.a4, pendientes, propuestas };
  }
  const casos = casosAnexoII(c);
  doc.secciones = [
    datosGenerales(c, casos),
    justificacion(c),
    { id: 'objeto', titulo: '2. Objeto', bloques: OBJETO_EBSS.map((x) => P(x)) },
    entorno(c),
    descripcion(c),
    normas(c),
    implantacion(c),
    evitables(c),
    noEliminables(c),
    otrasActividades(c),
    anexoII(casos),
    amianto(c),
    posteriores(c),
    obligaciones(c),
    firma(c),
  ];
  return { doc, art4: c.a4, pendientes, propuestas };
}
