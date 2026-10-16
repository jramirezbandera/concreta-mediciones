/* ===========================================================================
   core/rcd/documento — el texto del estudio de gestión de residuos, en una
   estructura neutra (secciones, párrafos y tablas) que pinta el Word
   (`features/exportar/docxRcd`) y que se puede probar sin abrir un .docx.

   Redacción propia con las citas de la verificación K-RCD.1–17 de
   Instalaciones. Nada sale de la memoria de referencia ni de los modelos del
   COA (normativa derogada y de otra comunidad). Lo que falta se escribe como
   «Pendiente: …» (D5), nunca supuesto.
   =========================================================================== */
import { fmtCents, fmtNum } from '../money';
import { ECO_CITA_CORTA } from './ecoeficiencia';
import { citaLer, lerConAsterisco } from './ler';
import type { EstudioRcd, EstudioRcdDatos } from './tipos';

export interface Trozo {
  texto: string;
  pendiente?: boolean;
  negrita?: boolean;
}
export type Parrafo = Trozo[];

export interface TablaDoc {
  columnas: Array<{ titulo: string; ancho: number; derecha?: boolean }>;
  filas: Array<Array<string | Trozo>>;
  pie?: Array<string | Trozo>;
}

export type BloqueDoc = { kind: 'p'; p: Parrafo } | { kind: 'lista'; items: Parrafo[] } | { kind: 'tabla'; t: TablaDoc };

export interface SeccionDoc {
  id: string;
  titulo: string;
  cita?: string;
  bloques: BloqueDoc[];
}

export interface DocumentoRcd {
  titulo: string;
  secciones: SeccionDoc[];
  /** Firmante (D14): el técnico redactor, o pendiente. */
  firma: { nombre: string; sub: string } | null;
}

export interface MetaObraRcd {
  denominacion: string;
  localidad: string;
  promotor: string;
  constructora: string;
}

const P = (...t: Array<string | Trozo>): BloqueDoc => ({ kind: 'p', p: t.map((x) => (typeof x === 'string' ? { texto: x } : x)) });
const pend = (texto: string): Trozo => ({ texto: `Pendiente: ${texto}`, pendiente: true });
const neg = (texto: string): Trozo => ({ texto, negrita: true });
const lista = (...items: Array<string | Parrafo>): BloqueDoc => ({
  kind: 'lista',
  items: items.map((i) => (typeof i === 'string' ? [{ texto: i }] : i)),
});
const t3 = (n: number) => fmtNum(n, 3);
const m3 = (n: number | null) => (n == null ? '—' : fmtNum(n, 3));

export function documentoRcd(r: EstudioRcd, d: EstudioRcdDatos, obra: MetaObraRcd): DocumentoRcd {
  const andalucia = r.comunidad === 'andalucia';
  const existente = r.alcance.inventario;
  const demolicion = d.tipos.includes('demolicion') || r.hayDemolicion;
  const amianto = d.amianto === 'posible' || d.amianto === 'identificado' || r.porCodigo.some((f) => f.ler === '17 06 05' || f.ler === '17 06 01');
  const usados = r.porCodigo.map((f) => f.ler);
  const s: SeccionDoc[] = [];
  const conApartado = (a: string) => r.alcance.apartados.includes(a as never);

  /* ---- objeto y normativa ---- */
  s.push({
    id: 'objeto',
    titulo: 'Objeto y normativa',
    bloques: [
      P(
        `Estudio de gestión de los residuos de construcción y demolición del proyecto ${d.fase === 'basico' ? 'básico' : 'de ejecución'} «${obra.denominacion || 'sin denominación'}», `,
        'redactado conforme al artículo 4.1 a) del Real Decreto 105/2008, de 1 de febrero, por el que se regula la producción y gestión de los residuos de construcción y demolición, ',
        'y a la Ley 7/2022, de 8 de abril, de residuos y suelos contaminados para una economía circular. ',
        r.alcance.motivo,
      ),
      P('Normativa aplicada:'),
      lista(
        'Real Decreto 105/2008, de 1 de febrero, por el que se regula la producción y gestión de los residuos de construcción y demolición.',
        'Ley 7/2022, de 8 de abril, de residuos y suelos contaminados para una economía circular (texto consolidado).',
        `${citaLer(r.fecha, usados)}.`,
        ...(andalucia
          ? [
              'Ley 3/2023, de 30 de marzo, de Economía Circular de Andalucía.',
              'Decreto 73/2012, de 20 de marzo, por el que se aprueba el Reglamento de Residuos de Andalucía.',
            ]
          : [[pend('normativa autonómica de residuos de la comunidad de la obra.')]]),
        d.ordenanza?.nombre ? `${d.ordenanza.nombre}.` : [pend('ordenanza municipal de residuos de construcción y demolición.')],
        ...(amianto ? ['Real Decreto 396/2006, de 31 de marzo, sobre trabajos con riesgo de exposición al amianto.'] : []),
      ),
    ],
  });

  /* ---- agentes ---- */
  s.push({
    id: 'agentes',
    titulo: 'Agentes',
    cita: 'RD 105/2008, art. 2 e) y f)',
    bloques: [
      P(neg('Productor de los residuos: '), obra.promotor ? `${obra.promotor}, titular de la licencia de la obra.` : pend('promotor de la obra.')),
      P(
        neg('Poseedor de los residuos: '),
        obra.constructora ? `${obra.constructora}, que ejecuta la obra.` : 'la empresa constructora que ejecute la obra.',
      ),
      P(
        'El poseedor presentará a la propiedad un plan que refleje cómo cumplirá las obligaciones de este estudio; aprobado por la dirección facultativa y aceptado por la propiedad, pasa a formar parte de los documentos contractuales de la obra (RD 105/2008, art. 5.1).',
      ),
    ],
  });

  /* ---- 1.º estimación ---- */
  const metodo: Array<string | Trozo> = [];
  if (r.porCodigo.some((f) => f.origen.some((o) => o.kind === 'partida')))
    metodo.push(
      'Las cantidades salen de las partidas del presupuesto: la medición de cada partida de demolición o de excavación por su espesor, su sección o su peso por unidad, con los pesos del material colocado del CTE DB SE-AE, anejo C (1 kN/m³ ≈ 0,1 t/m³); y, en las partidas que traen sus residuos del banco de precios, sus mermas y embalajes. ',
    );
  if (r.version.ratios === 'ecoeficiencia-2013')
    metodo.push(`Los residuos de la construcción de la obra nueva se estiman por superficie construida con la ${ECO_CITA_CORTA}. `);
  if (r.version.ratios === 'manual') metodo.push('Los residuos de la construcción de la obra nueva se estiman con los ratios por m² indicados en cada código, con su fuente. ');
  metodo.push(
    'Los m³ aparentes son el volumen del residuo suelto (de contenedor); los m³ en obra, el del material colocado. El detalle de cada partida figura en el anejo.',
  );
  if (r.porCodigo.some((f) => f.m3Aparente == null && !f.incompleta))
    metodo.push(' ', pend('un guion (—) en los m³ aparentes indica que falta la densidad aparente de ese residuo.'));
  const filas1 = r.porCodigo.map((f) => [
    lerConAsterisco({ codigo: f.ler, peligroso: f.peligroso }),
    f.descripcion,
    f.incompleta ? { texto: `${t3(f.t)} (incompleta)`, pendiente: true } : t3(f.t),
    m3(f.m3Aparente),
    m3(f.m3EnObra),
  ]);
  s.push({
    id: '1',
    titulo: '1.º Estimación de la cantidad de residuos',
    cita: 'RD 105/2008, art. 4.1 a) 1.º',
    bloques: [
      P(`Códigos de la ${citaLer(r.fecha, usados).replace(/^Lista europea de residuos/, 'lista europea de residuos')}. Los marcados con asterisco (*) son peligrosos.`),
      r.porCodigo.length
        ? {
            kind: 'tabla',
            t: {
              columnas: [
                { titulo: 'Código', ancho: 1100 },
                { titulo: 'Residuo', ancho: 5446 },
                { titulo: 't', ancho: 1300, derecha: true },
                { titulo: 'm³ aparentes', ancho: 1350, derecha: true },
                { titulo: 'm³ en obra', ancho: 1350, derecha: true },
              ],
              filas: filas1,
              pie: ['Total', '', t3(r.totales.t), m3(r.totales.m3Aparente), m3(r.totales.m3EnObra)],
            },
          }
        : P(pend('no hay residuos estimados: confirma las partidas o indica los ratios de obra nueva.')),
      P(...metodo),
    ],
  });

  /* ---- 2.º prevención ---- */
  s.push({
    id: '2',
    titulo: '2.º Medidas para la prevención de residuos en la obra',
    cita: 'RD 105/2008, art. 4.1 a) 2.º · Ley 7/2022, arts. 8 y 30.3',
    bloques: [
      P('Se sigue la jerarquía de residuos de la Ley 7/2022 (art. 8): prevención, preparación para la reutilización, reciclado, otro tipo de valorización y, por último, eliminación.'),
      lista(
        ...(demolicion || existente
          ? [
              [
                neg('Demolición selectiva. '),
                {
                  texto: `La demolición se hace de forma selectiva, obligatoria desde el 1 de enero de 2024 (Ley 7/2022, art. 30.3): primero se retiran los residuos peligrosos${amianto ? ', en particular el amianto' : ''} y los elementos que se pueden reutilizar; después las instalaciones, carpinterías y demás elementos desmontables; y por último el resto, de modo que cada fracción se recoja por separado.`,
                },
              ] as Parrafo,
            ]
          : []),
        'Los pedidos se ajustan a la medición del proyecto, y se emplean piezas a medida o prefabricadas donde es posible, para reducir recortes y sobrantes.',
        'Los materiales se acopian ordenados en zonas delimitadas, protegidos de la intemperie y de los golpes, y se conservan en su embalaje hasta su puesta en obra.',
        'Los embalajes se devuelven al proveedor cuando es posible, y los demás se separan por material.',
        'Los productos con sustancias peligrosas (pinturas, disolventes, desencofrantes, aceites) se guardan cerrados, en una zona señalizada y con recogida de derrames.',
        ...(d.tierrasReutilizadas
          ? [`Se reutilizan en la propia obra ${fmtNum(d.tierrasReutilizadas.m3, 2)} m³ de tierras de la excavación${d.tierrasReutilizadas.destino ? ` (${d.tierrasReutilizadas.destino})` : ''}.`]
          : []),
        ...(r.porCodigo.some((f) => f.origen.some((o) => o.kind === 'partida')) ? ['Los elementos que se pueden reutilizar (tejas, sanitarios, elementos estructurales, carpinterías y barandillas en buen estado) se clasifican aparte (Ley 7/2022, art. 30.2).'] : []),
      ),
    ],
  });

  /* ---- 3.º destino ---- */
  s.push({
    id: '3',
    titulo: '3.º Operaciones de reutilización, valorización o eliminación',
    cita: 'RD 105/2008, art. 4.1 a) 3.º · Ley 7/2022, anexos II y III',
    bloques: [
      P(
        'Los residuos se entregan a gestores autorizados. El destino por defecto es una planta de valorización',
        andalucia
          ? '; solo se depositan en vertedero los rechazos de las operaciones de valorización, o los residuos cuyo tratamiento sea inviable, con su justificación (Decreto 73/2012, art. 86).'
          : '.',
      ),
      r.destinos.length
        ? {
            kind: 'tabla',
            t: {
              columnas: [
                { titulo: 'Código', ancho: 1000 },
                { titulo: 'Operación', ancho: 3600 },
                { titulo: 'Destino', ancho: 3146 },
                { titulo: 'Gestor', ancho: 2800 },
              ],
              filas: r.destinos.map((x) => [
                lerConAsterisco({ codigo: x.ler, peligroso: x.peligroso }),
                x.operacion ? `${x.operacion} · ${x.operacionNombre ?? ''}` : pend('la indica el gestor'),
                x.destino,
                x.gestor?.nombre ? `${x.gestor.nombre}${x.gestor.autorizacion ? ` (${x.gestor.autorizacion})` : ''}` : pend('gestor autorizado'),
              ]),
            },
          }
        : P(pend('destino de los residuos.')),
    ],
  });

  /* ---- 4.º separación ---- */
  s.push({
    id: '4',
    titulo: '4.º Medidas para la separación de los residuos en obra',
    cita: 'RD 105/2008, art. 4.1 a) 4.º y art. 5.5 · Ley 7/2022, art. 30',
    bloques: [
      P(
        'Desde el 1 de julio de 2022 los residuos de construcción y demolición no peligrosos se clasifican, al menos, en madera, fracciones minerales (hormigón, ladrillos, azulejos, cerámica y piedra), metales, vidrio, plástico y yeso, sin umbral de cantidad (Ley 7/2022, art. 30.2); el papel y el cartón, cuando superan 0,5 t (RD 105/2008, art. 5.5). ',
        'La clasificación se hace preferentemente en la propia obra, en contenedores o acopios señalizados por fracción.',
        d.separacion === 'gestorExterno'
          ? ' Por falta de espacio, la separación se encomienda a un gestor en una instalación externa, que acreditará al poseedor haberla hecho en su nombre (RD 105/2008, art. 5.5).'
          : '',
      ),
      ...(r.separacion.length
        ? [
            {
              kind: 'tabla' as const,
              t: {
                columnas: [
                  { titulo: 'Fracción', ancho: 3600 },
                  { titulo: 't', ancho: 1200, derecha: true },
                  { titulo: 'Separación', ancho: 1600 },
                  { titulo: 'Motivo', ancho: 4146 },
                ],
                filas: r.separacion.map((x) => [x.nombre, t3(x.t), x.obligatoria ? 'Obligatoria' : 'No obligatoria', `${x.motivo} (${x.cita})`]),
              },
            },
          ]
        : []),
    ],
  });

  /* ---- 5.º planos ---- */
  if (conApartado('5'))
    s.push({
      id: '5',
      titulo: '5.º Planos de las instalaciones de almacenamiento, manejo y separación',
      cita: 'RD 105/2008, art. 4.1 a) 5.º',
      bloques: [
        P(
          'Las instalaciones previstas para el almacenamiento, el manejo, la separación y, en su caso, otras operaciones de gestión de los residuos dentro de la obra se recogen en ',
          d.plano ? `el ${d.plano}` : pend('el plano de las instalaciones'),
          '. Podrán adaptarse a las características de la obra y a sus sistemas de ejecución, previo acuerdo de la dirección facultativa.',
        ),
        ...(d.plantaMovil ? [P('Se prevé una planta móvil de tratamiento en la obra, que consta en este proyecto (Decreto 73/2012, art. 85.1).')] : []),
      ],
    });

  /* ---- 6.º pliego ---- */
  if (conApartado('6'))
    s.push({
      id: '6',
      titulo: '6.º Prescripciones del pliego en relación con los residuos',
      cita: 'RD 105/2008, art. 4.1 a) 6.º',
      bloques: [
        lista(
          'Los residuos se separan desde que se generan en las fracciones del apartado 4.º, en contenedores o acopios señalizados por fracción, y no se mezclan entre sí ni con otros residuos.',
          andalucia
            ? 'Los residuos peligrosos se separan de los no peligrosos con cualquier cantidad, siempre que sea técnicamente viable; si no pudieran separarse, todos tendrán la consideración de peligrosos (Decreto 73/2012, art. 88.1 a). Se guardan cerrados, etiquetados y a cubierto, y se entregan a un gestor autorizado de residuos peligrosos.'
            : 'Los residuos peligrosos se retiran y manejan aparte, sin mezclarlos con otros residuos (Ley 7/2022, art. 30.1), y se entregan a un gestor autorizado de residuos peligrosos.',
          ...(amianto
            ? ['Los materiales con amianto se retiran antes que el resto, por una empresa inscrita en el Registro de Empresas con Riesgo por Amianto y con el plan de trabajo aprobado por la autoridad laboral antes de empezar (Real Decreto 396/2006).']
            : []),
          'Cada entrega a un gestor se documenta con la identificación del poseedor y del productor, la obra, la cantidad en t o m³, el tipo de residuo codificado con la lista europea de residuos y la identificación del gestor (RD 105/2008, art. 5.3). El productor conserva esa documentación durante cinco años (art. 4.1 c).',
          'Los contenedores se identifican con los datos de su titular según la ordenanza municipal y se cubren fuera del horario de trabajo para que no reciban residuos ajenos a la obra.',
          'Los restos del lavado de canaletas y cubas de hormigón se recogen en una zona acotada y se gestionan como residuo.',
          'Las tierras y piedras no contaminadas que se reutilicen en la obra o en otra quedan fuera de este estudio si se acredita su destino (RD 105/2008, art. 3.1 a).',
          ...(andalucia ? ['Solo se depositan en vertedero los residuos resultantes de las operaciones de valorización; el depósito directo exige justificar que el tratamiento es inviable (Decreto 73/2012, art. 86).'] : []),
        ),
      ],
    });

  /* ---- 7.º coste ---- */
  const c = r.coste;
  s.push({
    id: '7',
    titulo: '7.º Valoración del coste de la gestión de los residuos',
    cita: 'RD 105/2008, art. 4.1 a) 7.º',
    bloques:
      c.modo === 'capitulo'
        ? [
            P(`El coste de la gestión es el del capítulo ${c.capitulo!.code} «${c.capitulo!.title}» del presupuesto, independiente de los demás.`),
            {
              kind: 'tabla',
              t: {
                columnas: [
                  { titulo: 'Código', ancho: 1300 },
                  { titulo: 'Partida', ancho: 5246 },
                  { titulo: 'Cantidad', ancho: 2000, derecha: true },
                  { titulo: 'Importe', ancho: 2000, derecha: true },
                ],
                filas: c.partidas.map((x) => [x.code, x.title, `${fmtNum(x.cantidad, 2)} ${x.ud}`, fmtCents(x.importe)]),
                pie: ['Total', c.pctPem != null ? `${fmtNum(c.pctPem, 2)} % del PEM` : '', '', fmtCents(c.importe ?? 0)],
              },
            },
          ]
        : c.modo === 'precios'
          ? [P(`El coste de la gestión, a los precios indicados por código, es de ${fmtCents(c.importe ?? 0)}${c.pctPem != null ? ` (${fmtNum(c.pctPem, 2)} % del PEM)` : ''}, y forma parte del presupuesto del proyecto en capítulo independiente.`)]
          : [P(pend('valoración del coste de la gestión (capítulo independiente del presupuesto).'))],
  });

  /* ---- inventario ---- */
  if (existente)
    s.push({
      id: 'inventario',
      titulo: 'Inventario de residuos peligrosos',
      cita: 'RD 105/2008, art. 4.1 b)',
      bloques: [
        ...(r.inventario.length
          ? [
              P('Se prevé su retirada selectiva, sin mezclarlos entre sí ni con otros residuos, y su entrega a gestores autorizados de residuos peligrosos.'),
              {
                kind: 'tabla' as const,
                t: {
                  columnas: [
                    { titulo: 'Código', ancho: 1100 },
                    { titulo: 'Residuo', ancho: 3600 },
                    { titulo: 'Elemento de origen', ancho: 4446 },
                    { titulo: 't', ancho: 1400, derecha: true },
                  ],
                  filas: r.inventario.map((x) => [`${x.ler}*`, x.descripcion, x.elemento, t3(x.t)]),
                },
              },
            ]
          : [P(d.amianto ? 'No se prevén residuos peligrosos en los elementos que se intervienen.' : pend('indicar si hay amianto y los residuos peligrosos de los elementos que se intervienen.'))]),
        ...(d.amianto === 'posible' ? [P(pend('identificar el amianto antes de empezar la obra.'))] : []),
        ...(d.amianto && d.amianto !== 'no' && d.amiantoElementos ? [P(`Elementos con amianto: ${d.amiantoElementos}.`)] : []),
      ],
    });

  /* ---- fianza ---- */
  const f = r.fianza;
  s.push({
    id: 'fianza',
    titulo: 'Fianza',
    cita: andalucia ? 'RD 105/2008, art. 6.3 · Decreto 73/2012, arts. 80, 81 y 89' : 'RD 105/2008, arts. 4.1 d) y 6.3',
    bloques: [
      P(
        andalucia
          ? 'Para obtener la licencia, el productor constituye una fianza a favor del Ayuntamiento (Decreto 73/2012, art. 80). La fija la ordenanza municipal sobre el presupuesto de ejecución material, con los mínimos del art. 81.1 del Decreto 73/2012 (2 % en derribos, 1 % en obra nueva, 2 % en excavación); el RD 105/2008 (art. 6.3) la basa en el presupuesto de este estudio.'
          : 'El productor constituye la fianza que exija la normativa autonómica y municipal; cuando el proyecto incluye este estudio, se basa en su presupuesto (RD 105/2008, art. 6.3).',
      ),
      P(
        neg('Fianza: '),
        f.declarada?.importe != null
          ? `${fmtCents(Math.round(f.declarada.importe * 100))}${f.declarada.criterio ? ` (${f.declarada.criterio})` : ''}.`
          : pend('importe de la fianza según la ordenanza municipal.'),
        ...(f.minimoAndalucia ? [` Mínimo del art. 81.1: ${fmtCents(f.minimoAndalucia.importe)}.`] : []),
      ),
    ],
  });

  /* ---- anejo: detalle por partida ---- */
  const det = r.porCodigo.flatMap((x) =>
    x.origen.map((o) => [
      lerConAsterisco({ codigo: x.ler, peligroso: x.peligroso }),
      o.kind === 'partida' ? `${o.code} ${o.title}` : o.fuente,
      o.formula,
      t3(o.t),
    ]),
  );
  if (det.length)
    s.push({
      id: 'anejo',
      titulo: 'Anejo. Detalle de la estimación',
      bloques: [
        {
          kind: 'tabla',
          t: {
            columnas: [
              { titulo: 'Código', ancho: 1000 },
              { titulo: 'Partida o ratio', ancho: 3700 },
              { titulo: 'Cuenta', ancho: 4646 },
              { titulo: 't', ancho: 1200, derecha: true },
            ],
            filas: det,
          },
        },
      ],
    });

  const red = d.redactor;
  return {
    titulo: 'Estudio de gestión de residuos de construcción y demolición',
    secciones: s,
    firma: red?.nombre
      ? { nombre: red.nombre, sub: [red.titulacion, red.colegiado ? `Col. ${red.colegiado}` : ''].filter(Boolean).join(' · ') }
      : null,
  };
}

/** Todo el texto del documento, para buscar en él (test de citas prohibidas). */
export function textoPlano(doc: DocumentoRcd): string {
  const t = (x: string | Trozo) => (typeof x === 'string' ? x : x.texto);
  const out: string[] = [doc.titulo];
  for (const sec of doc.secciones) {
    out.push(sec.titulo, sec.cita ?? '');
    for (const b of sec.bloques) {
      if (b.kind === 'p') out.push(b.p.map(t).join(''));
      else if (b.kind === 'lista') for (const i of b.items) out.push(i.map(t).join(''));
      else {
        out.push(b.t.columnas.map((c) => c.titulo).join(' | '));
        for (const f of b.t.filas) out.push(f.map(t).join(' | '));
        if (b.t.pie) out.push(b.t.pie.map(t).join(' | '));
      }
    }
  }
  return out.join('\n');
}
