/* La tabla de §5.3 de la especificación, fila a fila. */
import { describe, expect, it } from 'vitest';
import {
  REPOSO,
  cicloReducer,
  leerCota,
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

describe('calibrar (un solo paso)', () => {
  const cal = () => correr(REPOSO, { tipo: 'calibrar' }).estado;
  const confirmar = (declarada: number | null = null): EventoCiclo => ({ tipo: 'confirmar', px: PX, userUnit: 1, declarada });
  /** Una cota horizontal de 283,46 unidades (5 m a 1:50) con los metros tecleados. */
  const conCota = (metros: string, b: Punto = [283.46, 0]) => correr(cal(), clic([0, 0]), clic(b), { tipo: 'metros', texto: metros }).estado;
  const datosDe = (r: Paso) => {
    const c = r.efectos.find((x) => x.tipo === 'calibrada');
    if (c?.tipo !== 'calibrada') throw new Error('sin calibrada');
    return c.datos;
  };

  it('reposo · Calibrar → calibrando, sin cota', () => {
    expect(cal()).toMatchObject({ fase: 'calibrando', cota: { a: null, b: null }, aviso: null });
  });

  it('con la escala del plano y sin cota → calibrada a esa escala, sin cota', () => {
    const r = correr(cal(), confirmar(50));
    expect(r.estado).toEqual(REPOSO);
    const d = datosDe(r);
    expect(d).toEqual({ mPorUnidad: (50 * 0.0254) / 72, n: 50, escalaDeclarada: 50 });
  });

  it('sin escala ni cota → aviso «nada»', () => {
    expect(correr(cal(), confirmar()).estado).toMatchObject({ aviso: { tipo: 'nada' } });
  });

  it('una cota a medias → «faltan-puntos»; sin metros → «metros»', () => {
    expect(correr(cal(), clic([0, 0]), confirmar(50)).estado).toMatchObject({ aviso: { tipo: 'faltan-puntos' } });
    expect(correr(conCota('diez'), confirmar()).estado).toMatchObject({ aviso: { tipo: 'metros' } });
  });

  it('una cota con precisión peor que ±5 % → aviso «corta»', () => {
    const corta = correr(cal(), clic([0, 0]), clic([15, 0]), { tipo: 'metros', texto: '0,3' }, confirmar()).estado;
    if (corta.fase !== 'calibrando' || corta.aviso?.tipo !== 'corta') throw new Error('sin aviso');
    expect(corta.aviso.precision).toBeCloseTo(2 / 30, 6); // 30 px en pantalla
  });

  it('la precisión es la del zoom con que se marcaron los extremos, no la del zoom al confirmar', () => {
    // 15 unidades marcadas a 10 px/unidad (150 px); se confirma alejado (2 px/unidad).
    const r = correr(cal(), clic([0, 0], { px: 10 }), clic([15, 0], { px: 10 }), { tipo: 'metros', texto: '0,265' }, confirmar());
    expect(r.estado).toEqual(REPOSO);
    // Arrastrar un extremo con más zoom lo afina.
    const m = correr(cal(), clic([0, 0]), clic([15, 0]), { tipo: 'moverPunto', cual: 'b', p: [15, 0], px: 10 }).estado;
    expect(m).toMatchObject({ cota: { pxA: PX, pxB: 10 } });
  });

  it('solo la cota → calibrada con ella; se ajusta a la escala habitual que cae en su precisión', () => {
    const exacta = datosDe(correr(conCota('5'), confirmar()));
    expect(exacta).toMatchObject({ n: 50, ref: { a: [0, 0], b: [283.46, 0], metros: 5 } });
    expect(exacta.comprobacion).toBeUndefined();
    expect(exacta.escalaDeclarada).toBeUndefined();
    // 34 unidades a 2 px/unidad = 68 px (±2,9 %): 0,61 m da 1:50,9 → 1:50.
    const corta = datosDe(correr(cal(), clic([0, 0]), clic([34, 0]), { tipo: 'metros', texto: '0,61' }, confirmar()));
    expect(corta.n).toBe(50);
    expect(corta.mPorUnidad).toBeCloseTo((50 * 0.0254) / 72, 12);
    expect(corta.nMedida).toBeCloseTo(50.9, 1);
    expect(corta.ajustada).toBeUndefined(); // sin escala del plano no es «ajustada al plano»
  });

  it('escala poco plausible → pide confirmación; «Sí, es correcta» la guarda', () => {
    // un «cm» tecleado como «m»
    const r = correr(conCota('1000'), confirmar());
    expect(r.estado).toMatchObject({ aviso: { tipo: 'plausibilidad', clase: 'fuera' } });
    const ok = correr(r.estado, { tipo: 'esCorrecta', px: PX, userUnit: 1 });
    expect(ok.estado).toEqual(REPOSO);
    expect(ok.efectos[0]?.tipo).toBe('calibrada');
  });

  it('cota y escala del plano que cuadran → la exacta del plano; la cota hace de comprobación', () => {
    const d = datosDe(correr(conCota('4,98'), confirmar(50))); // 1:49,8
    expect(d).toMatchObject({ n: 50, ajustada: true, escalaDeclarada: 50, comprobacion: { fuente: 'cajetin', escalaDeclarada: 50 } });
    expect(d.mPorUnidad).toBeCloseTo((50 * 0.0254) / 72, 12);
    expect(d.comprobacion!.desviacion).toBeCloseTo(0.004, 3);
  });

  it('cota y escala del plano que no cuadran → el usuario elige con cuál sigue', () => {
    const r = correr(conCota('4,7'), confirmar(50)); // 1:47
    expect(r.estado).toMatchObject({ fase: 'calibrando', aviso: { tipo: 'no-cuadra-plano', nCota: 47, declarada: 50 } });
    const conCotaElegida = datosDe(correr(r.estado, { tipo: 'usar', cual: 'cota', px: PX, userUnit: 1, declarada: 50 }));
    expect(conCotaElegida).toMatchObject({ n: 47, ref: { metros: 4.7 } });
    expect(conCotaElegida.escalaDeclarada).toBeUndefined(); // no se queda avisando de que no cuadra
    const conPlano = datosDe(correr(r.estado, { tipo: 'usar', cual: 'plano', px: PX, userUnit: 1, declarada: 50 }));
    expect(conPlano).toEqual({ mPorUnidad: (50 * 0.0254) / 72, n: 50, escalaDeclarada: 50 });
  });

  it('«Quitar cota» la borra y deja la escala del plano sola', () => {
    const r = correr(conCota('4,7'), confirmar(50), { tipo: 'rehacerCota' });
    expect(r.estado).toMatchObject({ cota: { a: null, b: null, metros: '' }, aviso: null });
    expect(datosDe(correr(r.estado, confirmar(50))).n).toBe(50);
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

describe('leerCota', () => {
  const t = { a: [0, 0] as Punto, b: [283.46, 0] as Punto, metros: '4,98' };
  it('da la «1:N» de la cota, su precisión y si cuadra con la escala del plano', () => {
    expect(leerCota(t, PX, 1, null)).toMatchObject({ n: 49.8, cuadra: null, desviacion: null });
    expect(leerCota(t, PX, 1, 50)).toMatchObject({ n: 49.8, cuadra: true });
    expect(leerCota({ ...t, metros: '4,7' }, PX, 1, 50)).toMatchObject({ cuadra: false });
    expect(leerCota({ ...t, b: null }, PX, 1, 50)).toBeNull();
  });
});
