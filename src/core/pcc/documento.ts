/* ===========================================================================
   core/pcc/documento — el texto del plan de control de calidad, en la
   estructura neutra de `core/documento` que pinta el Word
   (`features/exportar/docxPcc`) y que se puede probar sin abrir un .docx.
   Plan: docs/plan-control-calidad.md §12.

   Redacción propia con las citas de la verificación K-PCC (docs/research/
   control-calidad/). Nada sale de las plantillas del estudio ni de los `~T`
   de banco sin pasar por la lista de citas vetadas. Tres partes siempre
   (K-PCC.69): recepción, ejecución y obra terminada; y la valoración, que el
   presupuesto incluirá. Lo que falta se escribe como «Pendiente: …», nunca
   supuesto.
   =========================================================================== */
import type { BloqueDoc, Documento, Parrafo, SeccionDoc, TablaDoc, Trozo } from '../documento/tipos';
import { fmtCents, fmtNum } from '../money';
import { citasVetadasEn } from './citas';
import { designacionImprimible } from './hormigon';
import { NOMBRE_FILA, QUIEN } from './nombres';
import type { FilaControl, FilaValoracion, GrupoHormigon, PlanCalidad, PlanCalidadDatos } from './tipos';

export interface MetaObraPcc {
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
const tabla = (t: TablaDoc): BloqueDoc => ({ kind: 'tabla', t });
const num = (n: number) => (Number.isInteger(n) ? fmtNum(n, 0) : fmtNum(n, 2));

const QUIEN_TXT = QUIEN;
const nombreGrupo = (g: GrupoHormigon) => `${NOMBRE_FILA[g.fila]} · ${designacionImprimible(g.designacion)}`;

/** Fuente del precio, sin coeficientes ocultos (K-PCC.67). */
function fuenteDe(v: FilaValoracion): string | Trozo {
  const p = v.precio;
  if (p.fuente === 'banco') return `${p.banco ?? 'Banco de precios'}${p.codigo ? `, ${p.codigo}` : ''}${p.fecha ? ` (${p.fecha})` : ''}`;
  if (p.fuente === 'junta') return `Hoja de la Junta de Andalucía${p.fecha ? `, ${p.fecha}` : ''}`;
  if (p.fuente === 'manual') return 'Precio del proyecto';
  return pend('precio');
}

/** Criterio de aceptación del hormigón (K-PCC.28): la frase que corresponde, sin evaluar resultados. */
function criterioHormigon(r: PlanCalidad): string {
  const e = r.estructura;
  if (e.modalidad === 'cien')
    return 'Control al 100 %: se acepta la parte de obra si fc,real ≥ fck y f₁ ≥ 0,9·fck, con fc,real la amasada más baja si N ≤ 20, o la que ocupa el lugar 0,05·N si N > 20 (Código Estructural, 57.5.5.2).';
  if (e.distintivo === 'con') return 'Hormigón con distintivo de calidad oficialmente reconocido, control de identificación: se acepta el lote si cada resultado cumple xᵢ ≥ fck (Código Estructural, 57.5.4.2).';
  if (e.distintivo === 'dispersion')
    return 'Hormigón con dispersión certificada (caso 1 de la tabla 57.5.4.3.a): se acepta el lote si f(x̄) = x̄·(1 − 1,66·δ*) ≥ fck (Código Estructural, 57.5.4.3).';
  return 'Hormigón sin distintivo: hasta la 36.ª amasada controlada, se acepta el lote si f(x₁) = x₁·Kₙ ≥ fck, con x₁ el menor resultado de las N amasadas del lote y Kₙ de la tabla 57.5.4.3.b (caso 3); a partir de ahí, si f(x̄) = x̄ − 1,66·s*₃₅ ≥ fck (caso 2) (Código Estructural, 57.5.4.3).';
}

/** Las filas de ensayo de un bloque de recepción que van al plan. */
function filasEnsayo(fs: FilaControl[]): Array<Array<string | Trozo>> {
  return fs.map((f) => [f.descripcion, f.norma ?? '—', f.regla.startsWith('pendiente') ? pend(f.regla.replace(/^pendiente: /, '')) : f.regla, `${num(f.cantidad)} ${f.unidad}`]);
}

export function documentoPcc(r: PlanCalidad, d: PlanCalidadDatos, obra: MetaObraPcc): DocumentoPcc {
  const andalucia = r.comunidad === 'andalucia';
  const vivienda = d.uso !== 'otro';
  const s: SeccionDoc[] = [];

  /* ---- objeto y alcance ---- */
  s.push({
    id: 'objeto',
    titulo: 'Objeto y alcance',
    cita: andalucia ? 'CTE parte I, art. 6.1 y anejo I · Decreto 67/2011, art. 3.1' : 'CTE parte I, art. 6.1 y anejo I',
    bloques: [
      P(
        `Plan de control de calidad del proyecto de ejecución «${obra.denominacion || 'sin denominación'}»${obra.localidad ? `, en ${obra.localidad}` : ''}. `,
        'Define el control de recepción de los productos, equipos y sistemas, el control de ejecución de la obra y el control de la obra terminada (CTE parte I, art. 7), y su valoración económica, que forma parte del presupuesto del proyecto.',
      ),
      ...(andalucia
        ? [P('El proyecto incluye este plan de control de calidad sobre los productos y unidades de obra con su correspondiente presupuesto (Decreto 67/2011, art. 3.1).')]
        : []),
      P(
        'Las cantidades salen de las mediciones del presupuesto y de los datos de la obra indicados en el plan; cada número lleva la regla de la que sale. ',
        'La dirección facultativa puede ampliar los controles durante la obra, y la dirección de la ejecución recoge los resultados en la documentación del seguimiento de la obra (CTE parte I, art. 7 y anejo II).',
      ),
    ],
  });

  /* ---- agentes ---- */
  s.push({
    id: 'agentes',
    titulo: 'Agentes del control',
    cita: andalucia && vivienda ? 'CTE parte I, art. 7 · Decreto 67/2011, arts. 4 y 7 · Ley 5/2025, art. 29' : 'CTE parte I, art. 7 · RD 410/2010',
    bloques: [
      P(neg('Promotor: '), obra.promotor ? `${obra.promotor}, que encarga y paga los ensayos del laboratorio.` : pend('promotor de la obra.')),
      P(neg('Constructor: '), obra.constructora ? `${obra.constructora}, ` : 'la empresa constructora, ', 'que facilita la documentación de los suministros y la toma de muestras.'),
      P(neg('Dirección de la ejecución de la obra: '), 'dirige el control de recepción y el de ejecución, y recibe los resultados de los ensayos.'),
      P(
        neg('Laboratorio de ensayos y entidad de control: '),
        andalucia
          ? 'a designar por la propiedad. Los ensayos los realiza un laboratorio de ensayos para el control de calidad de la construcción con declaración responsable presentada e inscrito en el Registro de laboratorios de ensayos y de entidades de control de calidad de la construcción y obra pública de Andalucía (Decreto 67/2011, arts. 4, 9 a 11), sin incurrir en las incompatibilidades del art. 7.'
          : 'a designar por la propiedad, entre los que cumplan el RD 410/2010, de entidades de control de calidad de la edificación y laboratorios de ensayos.',
      ),
      ...(andalucia && vivienda
        ? [
            P(
              'Promotor y constructor acreditan documentalmente la implantación de los sistemas de control de este plan y su resultado satisfactorio, explicitando los agentes que han participado en ellos (Ley 5/2025, de Vivienda de Andalucía, art. 29).',
            ),
          ]
        : []),
    ],
  });

  /* ---- normativa ---- */
  s.push({
    id: 'normativa',
    titulo: 'Normativa',
    bloques: [lista(...r.marco.map((m) => `${m}.`)), ...(andalucia ? [] : [P(pend('normativa autonómica de control de calidad de la comunidad de la obra.'))])],
  });

  /* ---- 1. recepción ---- */
  const recepcion: BloqueDoc[] = [
    P(
      'El control de recepción comprende el control de la documentación de los suministros, el de los distintivos de calidad y evaluaciones técnicas de idoneidad, y el control mediante ensayos (CTE parte I, arts. 7.2.1, 7.2.2 y 7.2.3)',
      andalucia ? ', con el muestreo, el ensayo, el criterio de aceptación y rechazo y la acción para cada ensayo (Decreto 67/2011, art. 3.2 a).' : '.',
    ),
  ];
  for (const b of r.recepcion) {
    const incluidos = b.ensayos.filter((f) => f.estado === 'incluido' && f.cantidad > 0);
    const aCriterio = b.ensayos.filter((f) => f.estado === 'aCriterio');
    recepcion.push(P(neg(b.nombre)));
    recepcion.push(lista(...b.documental.map((x) => `${x.texto} (${x.cita}).`)));
    if (incluidos.length) {
      recepcion.push(
        tabla({
          columnas: [
            { titulo: 'Ensayo', ancho: 3600 },
            { titulo: 'Norma', ancho: 1900 },
            { titulo: 'Muestreo', ancho: 3846 },
            { titulo: 'Nº', ancho: 1200, derecha: true },
          ],
          filas: filasEnsayo(incluidos),
        }),
      );
      recepcion.push(
        P(
          neg('Aceptación y rechazo: '),
          b.familia === 'hormigon-estructural'
            ? `${criterioHormigon(r)} Ante un lote no conforme: rotura de las probetas de reserva, ensayos de información (57.8), estudio de seguridad o prueba de carga, en ese orden (Código Estructural, 57.7.3.2).`
            : 'cada resultado se compara con el valor que exigen el proyecto y la norma del producto. Si un resultado no cumple, la dirección de la ejecución lo comunica a la dirección facultativa, que decide entre ensayos de contraste sobre el mismo lote, la aceptación con las medidas que fije o el rechazo del lote (CTE parte I, art. 7.2.3).',
        ),
      );
    } else recepcion.push(P('Sin ensayos de recepción: el control es documental.'));
    if (aCriterio.length) recepcion.push(P(`A criterio de la dirección facultativa, si hay dudas sobre lo suministrado: ${aCriterio.map((f) => f.descripcion).join('; ')}.`));
  }
  if (!r.recepcion.length) recepcion.push(P(pend('ninguna partida tiene el control confirmado.')));
  s.push({ id: 'recepcion', titulo: '1. Control de recepción', cita: andalucia ? 'CTE parte I, art. 7.2 · Decreto 67/2011, art. 3.2 a)' : 'CTE parte I, art. 7.2', bloques: recepcion });

  /* ---- 2. estructura ---- */
  const e = r.estructura;
  if (e.grupos.length || e.armaduras.length || e.ejecucion.lotes.length) {
    const bloques: BloqueDoc[] = [];
    if (e.grupos.length) {
      bloques.push(
        P(
          neg('Hormigón. '),
          e.distintivo === 'sin'
            ? 'Sin distintivo de calidad oficialmente reconocido. '
            : e.distintivo === 'con'
              ? 'Con distintivo de calidad oficialmente reconocido: el tamaño de los lotes se multiplica por cinco, con un mínimo de tres lotes, y se controla una amasada por lote. '
              : 'Con dispersión certificada: el tamaño de los lotes se multiplica por dos. ',
          e.modalidad === 'cien'
            ? 'Control de la resistencia al 100 % (Código Estructural, 57.5.5).'
            : `Control estadístico de la resistencia por lotes de la tabla 57.5.4.1 (Código Estructural, 57.5.4). ${e.indirecto.motivo}`,
        ),
        tabla({
          columnas: [
            { titulo: 'Grupo', ancho: 3000 },
            { titulo: 'm³', ancho: 1000, derecha: true },
            { titulo: 'Lotes', ancho: 900, derecha: true },
            { titulo: 'Amasadas', ancho: 1100, derecha: true },
            { titulo: 'Cuenta', ancho: 4546 },
          ],
          filas: e.grupos.map((g) => [nombreGrupo(g), fmtNum(g.volumen, 2), g.lotes == null ? '—' : num(g.lotes), num(g.amasadas), g.cuenta]),
          pie: ['Total', '', num(e.totales.lotes), num(e.totales.amasadas), `${num(e.totales.probetas)} probetas`],
        }),
      );
      const notas = [...new Set(e.grupos.flatMap((g) => g.notas))];
      if (notas.length) bloques.push(lista(...notas));
      if (e.durabilidad.length) {
        bloques.push(P(neg('Durabilidad. '), 'Ensayos de profundidad de penetración de agua y, en su caso, de aire ocluido por tipo de hormigón, al inicio y durante el suministro (Código Estructural, 57.5.7):'));
        bloques.push(lista(...e.durabilidad.map((x) => (x.meses == null ? [{ texto: `${x.designacion}: ` }, pend('meses de suministro.')] : `${x.designacion}: ${x.cuenta}.`))));
      }
    }
    if (e.armaduras.length) {
      bloques.push(P(neg('Armaduras. ')));
      bloques.push(
        tabla({
          columnas: [
            { titulo: 'Control', ancho: 2400 },
            { titulo: 'kg', ancho: 1300, derecha: true },
            { titulo: 'Lotes', ancho: 900, derecha: true },
            { titulo: 'Cuenta', ancho: 5946 },
          ],
          filas: e.armaduras.map((a) => [
            a.control === 'ferralla' ? 'Ferralla armada (art. 59.2)' : a.control === 'barras' ? 'Barras elaboradas en obra (art. 58)' : 'Mallas electrosoldadas (art. 59.1)',
            fmtNum(a.kg, 0),
            num(a.lotes),
            a.cuenta,
          ]),
        }),
      );
      const notas = [...new Set(e.armaduras.flatMap((a) => a.notas))];
      if (notas.length) bloques.push(lista(...notas));
    }
    if (e.ejecucion.lotes.length)
      bloques.push(
        P(
          neg('Ejecución. '),
          `Nivel de control de la ejecución ${e.ejecucion.nivel} (Código Estructural, art. 17 y tabla 63.1). Lotes de ejecución: `,
          e.ejecucion.lotes.map((l) => l.cuenta).join('; '),
          '.',
        ),
      );
    s.push({ id: 'estructura', titulo: '2. Control de la estructura', cita: 'Código Estructural, arts. 14, 17, 19, 57 a 59 y 63', bloques });
  }

  /* ---- 3. ejecución ---- */
  const ejec: BloqueDoc[] = [
    P('La dirección de la ejecución comprueba en cada fase la conformidad de lo ejecutado con el proyecto, la normativa y las indicaciones de la dirección facultativa (CTE parte I, art. 7.3).'),
  ];
  for (const b of r.ejecucion) {
    ejec.push(P(neg(b.nombre)));
    ejec.push(
      tabla({
        columnas: [
          { titulo: 'Fase', ancho: 1600 },
          { titulo: 'Comprobación', ancho: 3400 },
          { titulo: 'Número', ancho: 2700 },
          { titulo: 'Rechazo', ancho: 2846 },
        ],
        filas: b.inspecciones.map((i) => [i.fase, `${i.comprobacion} (${i.cita})`, i.cantidad == null ? pend(i.cuenta) : `${num(i.cantidad)}: ${i.cuenta}`, i.rechazo]),
      }),
    );
  }
  if (!r.ejecucion.length) ejec.push(P(pend('ninguna partida confirmada tiene control de ejecución.')));
  s.push({ id: 'ejecucion', titulo: '3. Control de ejecución', cita: andalucia ? 'CTE parte I, art. 7.3 · Decreto 67/2011, art. 3.2 b)' : 'CTE parte I, art. 7.3', bloques: ejec });

  /* ---- 4. obra terminada ---- */
  const incluidas = r.obraTerminada.filter((o) => o.incluida);
  const fuera = r.obraTerminada.filter((o) => !o.incluida && o.oblig === 'P');
  const obraT: BloqueDoc[] = [P('Se comprueban las prestaciones finales del edificio con las pruebas de servicio que exigen el proyecto y la normativa (CTE parte I, art. 7.4).')];
  if (incluidas.length)
    obraT.push(
      tabla({
        columnas: [
          { titulo: 'Prueba', ancho: 4000 },
          { titulo: 'Quién la hace', ancho: 2200 },
          { titulo: 'Cita', ancho: 2546 },
          { titulo: 'Nº', ancho: 1800, derecha: true },
        ],
        filas: incluidas.flatMap((o) =>
          o.filas.map((f) => [f.descripcion === o.nombre ? o.nombre : `${o.nombre}: ${f.descripcion}`, QUIEN_TXT[f.quien], o.cita, f.cantidad > 0 ? `${num(f.cantidad)} ${f.unidad}` : pend(f.regla)]),
        ),
      }),
    );
  else obraT.push(P('Sin pruebas de servicio para las familias de esta obra.'));
  if (r.aCargoDeOtros.length)
    obraT.push(P('Las pruebas a cargo de la empresa instaladora o del organismo de control las exigen sus reglamentos y no forman parte de la valoración de este plan; la dirección de la ejecución recoge sus certificados.'));
  if (fuera.length) obraT.push(P(`No se incluyen, por ser a criterio del proyecto: ${fuera.map((o) => o.nombre.charAt(0).toLowerCase() + o.nombre.slice(1)).join('; ')}.`));
  s.push({ id: 'obraTerminada', titulo: '4. Control de la obra terminada', cita: andalucia ? 'CTE parte I, art. 7.4 · Decreto 67/2011, art. 3.2 c)' : 'CTE parte I, art. 7.4', bloques: obraT });

  /* ---- 5. valoración ---- */
  const val: BloqueDoc[] = [];
  if (r.valoracion.length) {
    val.push(P('Ensayos y pruebas a cargo de la propiedad, a precios de laboratorio, con la fuente de cada precio.'));
    val.push(
      tabla({
        columnas: [
          { titulo: 'Ensayo', ancho: 3200 },
          { titulo: 'Norma', ancho: 1500 },
          { titulo: 'Ud', ancho: 900 },
          { titulo: 'Cantidad', ancho: 900, derecha: true },
          { titulo: 'Precio', ancho: 1000, derecha: true },
          { titulo: 'Fuente', ancho: 1846 },
          { titulo: 'Importe', ancho: 1200, derecha: true },
        ],
        filas: r.valoracion.map((v) => [
          v.descripcion,
          v.norma ?? '—',
          v.unidad,
          num(v.precios),
          v.precio.valor == null ? pend('precio') : fmtNum(v.precio.valor, 2),
          fuenteDe(v),
          v.importe == null ? '—' : fmtCents(v.importe),
        ]),
        pie: ['Total', '', '', '', '', '', r.totalCompleto ? fmtCents(r.total) : { texto: `${fmtCents(r.total)} (faltan precios)`, pendiente: true }],
      }),
    );
    if (r.porcentaje)
      val.push(P(`El control supone el ${fmtNum(r.porcentaje.valor, 2)} % del presupuesto de ejecución material sin el capítulo de control (${fmtCents(r.porcentaje.basePem)}). Es un dato: ninguna norma fija un porcentaje.`));
  } else val.push(P('Ningún ensayo a cargo de la propiedad.'));
  const cap = r.capitulo;
  if (cap) {
    val.push(P(`El presupuesto recoge el control en el capítulo ${cap.code} «${cap.title}», por ${fmtCents(cap.importe)}.`));
    if (cap.kci)
      val.push(P(`Con el coeficiente K y los costes indirectos de la obra, el capítulo aporta ${fmtCents(cap.aportePem)} al presupuesto de ejecución material; la valoración anterior son precios de laboratorio, sin K ni costes indirectos.`));
  } else if (r.valoracion.length) val.push(P(pend('capítulo del presupuesto que recoge la valoración del control.')));
  if (r.aCargoDeOtros.length) {
    val.push(P('Sin coste en esta valoración, por ser a cargo de otros agentes:'));
    val.push(lista(...r.aCargoDeOtros.map((f) => `${f.descripcion}: ${QUIEN_TXT[f.quien].toLowerCase()}${f.cita ? ` (${f.cita})` : ''}.`)));
  }
  s.push({ id: 'valoracion', titulo: '5. Valoración económica', cita: andalucia ? 'CTE parte I, anejo I · Decreto 67/2011, art. 3.1' : 'CTE parte I, anejo I', bloques: val });

  /* ---- anejo: asignación por partida ---- */
  const grupoDe = new Map(e.grupos.flatMap((g) => g.partidas.map((p) => [p.partidaId, nombreGrupo(g)] as const)));
  // El título es del presupuesto: si cita algo no vigente («IIa», EHE-08), no se copia (K-PCC.52, K-PCC.68).
  const titulo = (t: string): string | Trozo => (citasVetadasEn(t).length ? pend('el título de la partida cita una clase o una norma no vigente; corrígelo en el presupuesto.') : t);
  const det = r.recepcion.flatMap((b) => b.partidas.map((p) => [p.code, titulo(p.title), `${fmtNum(p.cantidad, 2)} ${p.ud}`, b.nombre, grupoDe.get(p.partidaId) ?? '—']));
  if (det.length)
    s.push({
      id: 'anejo',
      titulo: 'Anejo. Partidas del presupuesto con control',
      bloques: [
        tabla({
          columnas: [
            { titulo: 'Código', ancho: 1300 },
            { titulo: 'Partida', ancho: 3846 },
            { titulo: 'Medición', ancho: 1400, derecha: true },
            { titulo: 'Familia', ancho: 2000 },
            { titulo: 'Grupo', ancho: 2000 },
          ],
          filas: det,
        }),
      ],
    });

  /* ---- lo que falta ---- */
  if (r.pendientes.length)
    s.push({ id: 'pendiente', titulo: 'Pendiente antes de entregar', bloques: [lista(...r.pendientes.map((x) => [pend(x.texto)]))] });

  const red = d.redactor;
  return {
    titulo: 'Plan de control de calidad',
    secciones: s,
    firma: red?.nombre ? { nombre: red.nombre, sub: [red.titulacion, red.colegiado ? `Col. ${red.colegiado}` : ''].filter(Boolean).join(' · ') } : null,
  };
}

export type DocumentoPcc = Documento;
