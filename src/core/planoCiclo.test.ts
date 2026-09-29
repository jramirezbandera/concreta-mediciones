/* La tabla de §5.3 de la especificación, fila a fila. */
import { describe, expect, it } from 'vitest';
import {
  REPOSO,
  cicloReducer,
  reposo,
  type EstadoCiclo,
  type EventoCiclo,
  type Paso,
} from './planoCiclo';
import type { MotivoMedida } from './planoMedida';
import type { Punto } from './types';

const PX = 2; // píxeles por unidad de página
const clic = (p: Punto, extra: Partial<Extract<EventoCiclo, { tipo: 'clic' }>> = {}): EventoCiclo => ({
  tipo: 'clic',
  p,
  px: PX,
  ...extra,
});
/** Aplica una serie de eventos y devuelve el último paso (con los efectos de TODOS). */
function correr(e: EstadoCiclo, ...evs: EventoCiclo[]): Paso {
  let paso: Paso = { estado: e, efectos: [] };
  const efectos: Paso['efectos'] = [];
  for (const ev of evs) {
    paso = cicloReducer(paso.estado, ev);
    efectos.push(...paso.efectos);
  }
  return { estado: paso.estado, efectos };
}
const dibujando = (armada: 'longitud' | 'superficie' | 'rectangulo' | 'recuento', puntos: Punto[]): EstadoCiclo => ({
  fase: 'dibujando',
  armada,
  puntos,
  sustituye: null,
  cruce: false,
});
const NO_ENCAJA: MotivoMedida = { motivo: 'no-encaja', forma: 'ud', usa: 'recuento' };

describe('reposo', () => {
  it('Mano · clic sobre una forma → la selecciona (popover)', () => {
    const r = correr(REPOSO, clic([1, 1], { forma: 'f-1' }));
    expect(r.estado).toMatchObject({ fase: 'reposo', seleccion: 'f-1' });
    expect(r.efectos).toEqual([{ tipo: 'seleccionar', forma: 'f-1' }]);
  });

  it('Mano · Supr con una forma seleccionada → borra su línea; sin selección, nada', () => {
    expect(correr({ ...REPOSO, seleccion: 'f-1' } as EstadoCiclo, { tipo: 'supr' }).efectos).toEqual([
      { tipo: 'borrar', forma: 'f-1' },
    ]);
    expect(correr(REPOSO, { tipo: 'supr' }).efectos).toEqual([]);
  });

  it('medir · clic con la herramienta habilitada → dibujando [p]', () => {
    const r = correr(reposo('longitud'), clic([1, 1]));
    expect(r.estado).toEqual(dibujando('longitud', [[1, 1]]));
  });

  it('medir · clic con la herramienta deshabilitada → motivo, sigue en reposo', () => {
    const r = correr(reposo('longitud'), clic([1, 1], { motivo: NO_ENCAJA }));
    expect(r.estado).toEqual(reposo('longitud'));
    expect(r.efectos).toEqual([{ tipo: 'motivo', motivo: NO_ENCAJA }]);
  });

  it('Esc → salir de pantalla completa o cerrar el visor (lo decide el visor)', () => {
    expect(correr(REPOSO, { tipo: 'esc' }).efectos).toEqual([{ tipo: 'escReposo' }]);
  });

  it('Esc con una forma seleccionada primero la deselecciona', () => {
    const r = correr({ ...REPOSO, seleccion: 'f-1' } as EstadoCiclo, { tipo: 'esc' });
    expect(r.estado).toMatchObject({ seleccion: null });
    expect(r.efectos).toEqual([{ tipo: 'seleccionar', forma: null }]);
  });
});

describe('dibujando', () => {
  it('clic a menos de 4 px del anterior → ninguno', () => {
    const e = dibujando('longitud', [[0, 0]]);
    expect(correr(e, clic([1.5, 0])).estado).toEqual(e); // 3 px
  });

  it('Superficie y el tramo cruza → rechazo, tramo en danger', () => {
    const e = dibujando('superficie', [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]);
    const r = correr(e, clic([50, -50]));
    expect(r.estado).toMatchObject({ fase: 'dibujando', cruce: true, puntos: e.fase === 'dibujando' ? e.puntos : [] });
    expect(r.efectos).toEqual([{ tipo: 'rechazo', razon: 'cruce' }]);
  });

  it('Superficie sobre el primer vértice con ≥ 3 vértices → nombrando (preparar)', () => {
    const r = correr(
      dibujando('superficie', [
        [0, 0],
        [100, 0],
        [100, 100],
      ]),
      clic([2, 2]),
    );
    expect(r.estado).toMatchObject({ fase: 'nombrando', puntos: [[0, 0], [100, 0], [100, 100]] });
    expect(r.efectos).toEqual([{ tipo: 'preparar' }]);
  });

  it('Rectángulo · tercer clic → nombrando con 4 esquinas', () => {
    const r = correr(reposo('rectangulo'), clic([0, 0]), clic([100, 0]), clic([60, 40]));
    expect(r.estado.fase).toBe('nombrando');
    expect(r.estado.fase === 'nombrando' && r.estado.puntos).toEqual([
      [0, 0],
      [100, 0],
      [100, 40],
      [0, 40],
    ]);
  });

  it('resto · clic → añade el punto (en Recuento, cuenta)', () => {
    expect(correr(dibujando('recuento', [[0, 0]]), clic([0.5, 0])).estado).toEqual(
      dibujando('recuento', [
        [0, 0],
        [0.5, 0],
      ]),
    ); // Recuento no descarta por cercanía: dos símbolos juntos cuentan
    expect(correr(dibujando('longitud', [[0, 0]]), clic([50, 0])).estado).toEqual(
      dibujando('longitud', [
        [0, 0],
        [50, 0],
      ]),
    );
  });

  it('doble clic con Longitud ≥ 2 o Superficie ≥ 3 → nombrando, sin vértice extra', () => {
    // un doble clic real: clic (detalle 1), clic (detalle 2), dblclick
    const r = correr(
      dibujando('longitud', [[0, 0]]),
      clic([50, 0]),
      clic([50, 0], { detalle: 2 }),
      { tipo: 'dobleClic' },
    );
    expect(r.estado).toMatchObject({ fase: 'nombrando', puntos: [[0, 0], [50, 0]] });
  });

  it('doble clic en Recuento → ninguno (Recuento solo termina con Enter o [Terminar])', () => {
    const e = dibujando('recuento', [[0, 0]]);
    expect(correr(e, { tipo: 'dobleClic' }).estado).toEqual(e);
    expect(correr(e, clic([9, 9], { detalle: 2 })).estado).toEqual(e);
  });

  it('Enter o [Terminar] con forma válida → nombrando; con Recuento ≥ 1', () => {
    expect(correr(dibujando('recuento', [[0, 0]]), { tipo: 'enter' }).estado.fase).toBe('nombrando');
    expect(correr(dibujando('longitud', [[0, 0], [9, 0]]), { tipo: 'terminar' }).estado.fase).toBe('nombrando');
  });

  it('Enter con forma inválida → motivo (longitud 0, < 3 vértices, área 0)', () => {
    expect(correr(dibujando('longitud', [[0, 0]]), { tipo: 'enter' }).efectos).toEqual([
      { tipo: 'rechazo', razon: 'longitud-cero' },
    ]);
    expect(correr(dibujando('superficie', [[0, 0], [9, 0]]), { tipo: 'enter' }).efectos).toEqual([
      { tipo: 'rechazo', razon: 'pocos-vertices' },
    ]);
    expect(correr(dibujando('superficie', [[0, 0], [9, 0], [18, 0]]), { tipo: 'enter' }).efectos).toEqual([
      { tipo: 'rechazo', razon: 'area-cero' },
    ]);
    expect(correr(dibujando('rectangulo', [[0, 0], [9, 0]]), { tipo: 'enter' }).efectos).toEqual([
      { tipo: 'rechazo', razon: 'pocos-vertices' },
    ]);
  });

  it('Retroceso con ≥ 2 puntos → quita el último (no toca el historial); con 1 → reposo', () => {
    expect(correr(dibujando('longitud', [[0, 0], [9, 0]]), { tipo: 'retroceso' }).estado).toEqual(
      dibujando('longitud', [[0, 0]]),
    );
    expect(correr(dibujando('longitud', [[0, 0]]), { tipo: 'retroceso' }).estado).toEqual(reposo('longitud'));
  });

  it('Esc o [Cancelar] → reposo, descartando la forma', () => {
    const r = correr(dibujando('longitud', [[0, 0], [9, 0]]), { tipo: 'esc' });
    expect(r.estado).toEqual(reposo('longitud'));
    expect(r.efectos).toEqual([]);
  });
});

describe('cambios bajo una forma a medio dibujar', () => {
  const aMedio: EstadoCiclo[] = [
    dibujando('longitud', [[0, 0]]),
    { fase: 'nombrando', armada: 'longitud', puntos: [[0, 0], [9, 0]], sustituye: null, texto: 'x' } as EstadoCiclo,
  ];

  it.each(['partida', 'pagina', 'plano', 'ocupante', 'vista'] as const)(
    '[A1] cambio de %s → reposo y la forma sale como borrador (§5.8)',
    (que) => {
      for (const e of aMedio) {
        const r = correr(e, { tipo: 'contexto', que });
        expect(r.estado).toEqual(reposo('longitud'));
        expect(r.efectos).toEqual([{ tipo: 'borrador', que, forma: e }]);
      }
    },
  );

  it('[A1] cambio de partida en la que la herramienta encaja → la forma sigue, sin efectos', () => {
    for (const e of aMedio) expect(correr(e, { tipo: 'contexto', que: 'partida', encaja: true })).toEqual({ estado: e, efectos: [] });
  });

  it('cambio de escala → reposo y aviso «Forma descartada»', () => {
    for (const e of aMedio) {
      const r = correr(e, { tipo: 'contexto', que: 'escala' });
      expect(r.estado).toEqual(reposo('longitud'));
      expect(r.efectos).toEqual([{ tipo: 'descartada', que: 'escala' }]);
    }
  });

  it('[A1] seguir retoma el borrador desde reposo o creada; nunca pisa otra forma ni una calibración', () => {
    const [forma] = aMedio as [Extract<EstadoCiclo, { fase: 'dibujando' }>];
    expect(correr(reposo('recuento'), { tipo: 'seguir', forma }).estado).toEqual(forma);
    expect(correr({ fase: 'creada', armada: 'longitud', lineId: 'l-1' }, { tipo: 'seguir', forma }).estado).toEqual(forma);
    const otra = dibujando('superficie', [[5, 5]]);
    expect(correr(otra, { tipo: 'seguir', forma }).estado).toEqual(otra);
    const cal = correr(REPOSO, { tipo: 'calibrar' }).estado;
    expect(correr(cal, { tipo: 'seguir', forma }).estado).toEqual(cal);
  });

  it('cambio de herramienta: reposo con la nueva armada; si se dibujaba, como un cambio de partida', () => {
    expect(correr(dibujando('longitud', [[0, 0]]), { tipo: 'herramienta', armada: 'recuento' })).toEqual({
      estado: reposo('recuento'),
      efectos: [{ tipo: 'descartada', que: 'herramienta' }],
    });
    expect(correr(REPOSO, { tipo: 'herramienta', armada: 'superficie' })).toEqual({
      estado: reposo('superficie'),
      efectos: [],
    });
  });
});

describe('nombrando', () => {
  const nombrando: EstadoCiclo = {
    fase: 'nombrando',
    armada: 'longitud',
    puntos: [
      [0, 0],
      [9, 0],
    ],
    sustituye: null,
    texto: '',
  };

  it('las teclas de edición son del campo: el texto se guarda tal cual', () => {
    expect(correr(nombrando, { tipo: 'texto', texto: 'Salón' }).estado).toMatchObject({ texto: 'Salón' });
    // Retroceso y Ctrl+Z dentro del comentario NO llegan al ciclo como «retroceso»
    // (el visor solo corta su propagación); si llegaran, no quitan puntos:
    expect(correr(nombrando, { tipo: 'retroceso' }).estado).toEqual(nombrando);
  });

  it('Enter con `isComposing` → ninguno', () => {
    expect(correr(nombrando, { tipo: 'enter', componiendo: true })).toEqual({ estado: nombrando, efectos: [] });
  });

  it('Enter con la medida preparada sin motivo → crear; al crearla, CREADA', () => {
    expect(correr(nombrando, { tipo: 'enter' }).efectos).toEqual([{ tipo: 'crear' }]);
    expect(correr(nombrando, { tipo: 'creada', lineId: 'l-7' }).estado).toEqual({
      fase: 'creada',
      armada: 'longitud',
      lineId: 'l-7',
    });
  });

  it('Enter con motivo (kg/m sin resolver…) → sigue nombrando, motivo en la franja', () => {
    const m: MotivoMedida = { motivo: 'kgm-sin-resolver' };
    expect(correr(nombrando, { tipo: 'enter', motivo: m })).toEqual({ estado: nombrando, efectos: [{ tipo: 'motivo', motivo: m }] });
  });

  it('resultado `stale` → vuelve a preparar', () => {
    expect(correr(nombrando, { tipo: 'stale' })).toEqual({ estado: nombrando, efectos: [{ tipo: 'preparar' }] });
  });

  it('Esc → reposo (un solo Esc descarta la forma)', () => {
    expect(correr(nombrando, { tipo: 'esc' }).estado).toEqual(reposo('longitud'));
  });
});

describe('creada', () => {
  const creada: EstadoCiclo = { fase: 'creada', armada: 'longitud', lineId: 'l-7' };
  it('clic con la herramienta habilitada → otra forma; Esc → reposo', () => {
    expect(correr(creada, clic([5, 5])).estado).toEqual(dibujando('longitud', [[5, 5]]));
    expect(correr(creada, { tipo: 'esc' }).estado).toEqual(reposo('longitud'));
  });

  it('tres medidas seguidas con la misma herramienta armada', () => {
    let e: EstadoCiclo = reposo('longitud');
    for (let i = 0; i < 3; i++) {
      e = correr(e, clic([0, i * 10]), clic([50, i * 10]), { tipo: 'enter' }).estado;
      expect(e.fase).toBe('nombrando');
      e = correr(e, { tipo: 'enter' }, { tipo: 'creada', lineId: `l-${i}` }).estado;
      expect(e).toEqual({ fase: 'creada', armada: 'longitud', lineId: `l-${i}` });
    }
  });
});

describe('«Volver a medir»', () => {
  it('arma la misma herramienta; Esc restaura la forma vieja; el primer clic empieza', () => {
    const armado = correr(REPOSO, { tipo: 'volverAMedir', lineId: 'l-3', herramienta: 'superficie' }).estado;
    expect(armado).toEqual({ fase: 'reposo', armada: 'superficie', seleccion: null, sustituye: 'l-3' });
    expect(correr(armado, { tipo: 'esc' }).efectos).toEqual([{ tipo: 'restaurar', lineId: 'l-3' }]);
    const r = correr(armado, clic([0, 0]), clic([50, 0]), { tipo: 'esc' });
    expect(r.efectos).toEqual([{ tipo: 'restaurar', lineId: 'l-3' }]);
    const n = correr(armado, clic([0, 0]), clic([50, 0]), clic([50, 50]), { tipo: 'enter' }).estado;
    expect(n).toMatchObject({ fase: 'nombrando', sustituye: 'l-3' });
  });
});

describe('calibrar', () => {
  const cal = () => correr(REPOSO, { tipo: 'calibrar' }).estado;

  it('reposo · Calibrar → calibrando.cota', () => {
    expect(cal()).toMatchObject({ fase: 'calibrando', paso: 'cota' });
  });

  it('una cota con precisión peor que ±5 % → aviso; mejor → comprobación', () => {
    const corta = correr(cal(), clic([0, 0]), clic([15, 0]), { tipo: 'metros', cual: 'cota', texto: '0,3' }, {
      tipo: 'confirmar',
      px: PX,
      userUnit: 1,
    }).estado;
    expect(corta).toMatchObject({ paso: 'cota', aviso: { tipo: 'corta', cual: 'cota' } });
    if (corta.fase !== 'calibrando' || corta.aviso?.tipo !== 'corta') throw new Error('sin aviso');
    expect(corta.aviso.precision).toBeCloseTo(2 / 30, 6); // 30 px en pantalla
    const ok = correr(cal(), clic([0, 0]), clic([90, 0]), { tipo: 'metros', cual: 'cota', texto: '1,6' }, {
      tipo: 'confirmar',
      px: PX,
      userUnit: 1,
    }).estado;
    expect(ok).toMatchObject({ paso: 'comprobacion', aviso: null });
  });

  it('la precisión es la del zoom con que se marcaron los extremos, no la del zoom al confirmar', () => {
    // 15 unidades marcadas a 10 px/unidad (150 px); se confirma alejado (2 px/unidad).
    const e = correr(cal(), clic([0, 0], { px: 10 }), clic([15, 0], { px: 10 }), { tipo: 'metros', cual: 'cota', texto: '0,3' }, {
      tipo: 'confirmar',
      px: PX,
      userUnit: 1,
    }).estado;
    expect(e).toMatchObject({ paso: 'comprobacion', aviso: null });
    // Arrastrar un extremo con más zoom lo afina.
    const m = correr(cal(), clic([0, 0]), clic([15, 0]), { tipo: 'moverPunto', cual: 'b', p: [15, 0], px: 10 }).estado;
    expect(m).toMatchObject({ cota: { pxA: PX, pxB: 10 } });
  });

  it('distancia no válida → «Escribe la distancia real en metros»', () => {
    const r = correr(cal(), clic([0, 0]), clic([283.46, 0]), { tipo: 'metros', cual: 'cota', texto: 'diez' }, {
      tipo: 'confirmar',
      px: PX,
      userUnit: 1,
    });
    expect(r.estado).toMatchObject({ aviso: { tipo: 'metros' } });
  });

  const hastaComprobacion = (metrosComp: string, metrosCota = '5') =>
    correr(
      cal(),
      clic([0, 0]),
      clic([283.46, 0]),
      { tipo: 'metros', cual: 'cota', texto: metrosCota },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
      clic([0, 0]),
      clic([0, 170.08]),
      { tipo: 'metros', cual: 'comprobacion', texto: metrosComp },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
    );

  it('desviación ≤ 1 % y escala plausible → reposo y calibrada (1:50)', () => {
    const r = hastaComprobacion('3');
    expect(r.estado).toEqual(REPOSO);
    const cal = r.efectos.find((x) => x.tipo === 'calibrada');
    expect(cal).toBeTruthy();
    if (cal?.tipo !== 'calibrada') return;
    expect(cal.datos.n).toBe(50);
    expect(cal.datos.ref).toEqual({ a: [0, 0], b: [283.46, 0], metros: 5 });
    expect(cal.datos.comprobacion).toMatchObject({ fuente: 'cota', metros: 3 });
    expect(cal.datos.comprobacion.desviacion).toBeLessThan(0.001);
  });

  it('desviación > 1 % → aviso con [Rehacer cota] [Rehacer comprobación]; rehacer la comprobación conserva la cota', () => {
    const r = hastaComprobacion('3,1');
    expect(r.estado).toMatchObject({ paso: 'comprobacion', aviso: { tipo: 'desviacion', nCota: 50, tolerancia: 0.01 } });
    const rehecha = correr(r.estado, { tipo: 'rehacerComprobacion' }).estado;
    expect(rehecha).toMatchObject({
      paso: 'comprobacion',
      cota: { a: [0, 0], b: [283.46, 0], metros: '5' },
      comprobacion: { a: null, b: null, metros: '' },
    });
    expect(correr(r.estado, { tipo: 'rehacerCota' }).estado).toMatchObject({ paso: 'cota', cota: { a: null } });
  });

  it('dos cotas cortas: se admite su imprecisión y la escala se ajusta a la habitual que cae dentro', () => {
    // 34 unidades a 2 px/unidad = 68 px (±2,9 %); a 1:50, 0,5997 m.
    const r = correr(
      cal(),
      clic([0, 0]),
      clic([34, 0]),
      { tipo: 'metros', cual: 'cota', texto: '0,6' },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
      clic([0, 0]),
      clic([0, 34]),
      { tipo: 'metros', cual: 'comprobacion', texto: '0,61' }, // 1,7 % de diferencia
      { tipo: 'confirmar', px: PX, userUnit: 1 },
    );
    expect(r.estado).toEqual(REPOSO);
    const c = r.efectos.find((x) => x.tipo === 'calibrada');
    if (c?.tipo !== 'calibrada') throw new Error('sin calibrada');
    expect(c.datos.n).toBe(50);
    expect(c.datos.mPorUnidad).toBeCloseTo((50 * 0.0254) / 72, 12);
    expect(c.datos.nMedida).toBeCloseTo(50.4, 1);
    expect(c.datos.ajustada).toBeUndefined(); // sin cajetín no es «ajustada al plano»
  });

  it('dos cotas cortas que no cuadran ni con su imprecisión → aviso con la escala de cada una', () => {
    const r = correr(
      cal(),
      clic([0, 0]),
      clic([34, 0]),
      { tipo: 'metros', cual: 'cota', texto: '0,6' },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
      clic([0, 0]),
      clic([0, 34]),
      { tipo: 'metros', cual: 'comprobacion', texto: '0,65' },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
    );
    expect(r.estado).toMatchObject({ aviso: { tipo: 'desviacion', tolerancia: 0.05, nCota: 50, nComp: 54.2 } });
  });

  it('escala poco plausible → pide confirmación; «Sí, es correcta» la guarda', () => {
    // un «cm» tecleado como «m»: 1000 y 600 dan 1:5000·… fuera de rango
    const r = hastaComprobacion('600', '1000');
    expect(r.estado).toMatchObject({ aviso: { tipo: 'plausibilidad', clase: 'fuera' } });
    const ok = correr(r.estado, { tipo: 'esCorrecta', px: PX, userUnit: 1 });
    expect(ok.estado).toEqual(REPOSO);
    expect(ok.efectos[0]?.tipo).toBe('calibrada');
  });

  it('arrastrar un punto lo recoloca antes de confirmar', () => {
    const e = correr(cal(), clic([0, 0]), clic([100, 0]), { tipo: 'moverPunto', cual: 'b', p: [283.46, 0] }).estado;
    expect(e).toMatchObject({ cota: { b: [283.46, 0] } });
  });

  it('Esc → reposo; la página se queda como estaba', () => {
    const r = correr(cal(), clic([0, 0]), { tipo: 'esc' });
    expect(r).toEqual({ estado: REPOSO, efectos: [] });
  });
});

describe('[A1] cajetín al calibrar (T9)', () => {
  const cota = (metros: string, cajetin: number | null) =>
    correr(
      correr(REPOSO, { tipo: 'calibrar' }).estado,
      clic([0, 0]),
      clic([283.46, 0]), // 5 m a 1:50
      { tipo: 'metros', cual: 'cota', texto: metros },
      { tipo: 'confirmar', px: PX, userUnit: 1, cajetin },
    );

  it('una cota que cuadra con «E 1:50» (< 1 %) termina: ajustada a la exacta, el cajetín hace de comprobación', () => {
    const r = cota('4,98', 50); // 1:49,8
    expect(r.estado).toEqual(REPOSO);
    const c = r.efectos.find((x) => x.tipo === 'calibrada');
    if (c?.tipo !== 'calibrada') throw new Error('sin calibrada');
    expect(c.datos).toMatchObject({ n: 50, ajustada: true, escalaDeclarada: 50, comprobacion: { fuente: 'cajetin', escalaDeclarada: 50 } });
    expect(c.datos.mPorUnidad).toBeCloseTo((50 * 0.0254) / 72, 12);
    expect(c.datos.comprobacion.desviacion).toBeCloseTo(0.004, 3);
  });

  it('una cota que no cuadra (1:47) pasa a la comprobación; al terminar guarda la declarada sin ajustar', () => {
    const r = cota('4,7', 50);
    expect(r.estado).toMatchObject({ paso: 'comprobacion' });
    const fin = correr(
      r.estado,
      clic([0, 0]),
      clic([0, 170.08]),
      { tipo: 'metros', cual: 'comprobacion', texto: '2,82' },
      { tipo: 'confirmar', px: PX, userUnit: 1, cajetin: 50 },
      { tipo: 'esCorrecta', px: PX, userUnit: 1, cajetin: 50 },
    );
    const c = fin.efectos.find((x) => x.tipo === 'calibrada');
    if (c?.tipo !== 'calibrada') throw new Error('sin calibrada');
    expect(c.datos).toMatchObject({ escalaDeclarada: 50, comprobacion: { fuente: 'cota' } });
    expect(c.datos.ajustada).toBeUndefined();
    expect(c.datos.n).toBeCloseTo(47, 0);
  });

  it('una cota que no cuadra con la escala del plano lo avisa al pasar a la comprobación', () => {
    expect(cota('4,7', 50).estado).toMatchObject({ paso: 'comprobacion', aviso: { tipo: 'no-cuadra-plano', nCota: 47, declarada: 50 } });
  });

  it('sin cajetín, lo de siempre: a la comprobación', () => {
    expect(cota('5', null).estado).toMatchObject({ paso: 'comprobacion' });
  });
});

describe('[A1] comprobar una escala sin comprobación', () => {
  // 1:50: 283,46 unidades = 5 m
  const M = 5 / 283.46;
  const comprobar = () =>
    correr(REPOSO, { tipo: 'comprobar', mPorUnidad: M, ref: { a: [0, 0], b: [283.46, 0], metros: 5 } }).estado;

  it('empieza en el paso 2 con la cota de la escala ya puesta', () => {
    expect(comprobar()).toMatchObject({
      fase: 'calibrando',
      paso: 'comprobacion',
      cota: { a: [0, 0], b: [283.46, 0], metros: '5' },
      soloComprobar: { mPorUnidad: M },
    });
  });

  it('desviación ≤ 1 % → reposo y `comprobada` (la escala no cambia: no hay `calibrada`)', () => {
    const r = correr(
      comprobar(),
      clic([0, 0]),
      clic([0, 170.08]),
      { tipo: 'metros', cual: 'comprobacion', texto: '3' },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
    );
    expect(r.estado).toEqual(REPOSO);
    expect(r.efectos.map((x) => x.tipo)).toEqual(['comprobada']);
    const c = r.efectos[0];
    if (c?.tipo !== 'comprobada') return;
    expect(c.comprobacion).toMatchObject({ fuente: 'cota', a: [0, 0], b: [0, 170.08], metros: 3 });
    expect(c.comprobacion.desviacion).toBeLessThan(0.001);
  });

  it('desviación > 1 % → aviso; [Rehacer cota] pasa a calibrar de nuevo', () => {
    const r = correr(
      comprobar(),
      clic([0, 0]),
      clic([0, 170.08]),
      { tipo: 'metros', cual: 'comprobacion', texto: '3,2' },
      { tipo: 'confirmar', px: PX, userUnit: 1 },
    );
    expect(r.estado).toMatchObject({ paso: 'comprobacion', aviso: { tipo: 'desviacion' } });
    const cota = correr(r.estado, { tipo: 'rehacerCota' }).estado;
    expect(cota).toMatchObject({ paso: 'cota', cota: { a: null } });
    expect(cota).not.toHaveProperty('soloComprobar');
  });
});
