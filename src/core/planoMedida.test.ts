import { describe, expect, it } from 'vitest';
import { MED_SLOTS, medFormaDe, medFormaDef } from './medForma';
import { escalaDe } from './planoDatos';
import {
  NOMBRE_HERRAMIENTA,
  TABLA_MEDIDA,
  lineaRetocada,
  motivoHerramienta,
  prepararMedida,
  prefijoComentario,
  valoresDesdeOrigen,
  filaDe,
  interpretacionesPara,
  textoInterpretacion,
  type EntradaMedida,
} from './planoMedida';
import type { Herramienta, MedForma, MedLine, OrigenPlano, Partida, PlanoMeta, Punto } from './types';
import a0 from '../test/fixtures/planos/obra-v6-a0.json';
import a1 from '../test/fixtures/planos/obra-v6-a1.json';

type Obra = { partidas: Record<string, Partida[]>; planos: PlanoMeta[] };
const A0 = a0 as unknown as Obra;
const A1 = a1 as unknown as Obra;

/** La tabla de §3.1 tal como está escrita en la especificación: celda →
 *  «slots / fijas / magnitud» o «→ herramienta que sí encaja». */
const ESPERADA: Record<Herramienta, Record<MedForma, string>> = {
  recuento: {
    ud: 'uds / - / recuento',
    lin: 'uds / largo / recuento',
    sup: 'uds / largo,ancho / recuento',
    area: 'uds / largo / recuento',
    vol: 'uds / largo,ancho,alto / recuento',
    areaEsp: 'uds / largo,ancho / recuento',
    peso: 'uds / largo,ancho / recuento',
  },
  longitud: {
    ud: '→ recuento',
    lin: 'largo / - / longitud',
    sup: 'largo / ancho / longitud',
    area: 'largo / - / longitudPorFactor ×h',
    vol: 'largo / ancho,alto / longitud',
    areaEsp: 'largo / ancho / longitudPorFactor ×h',
    peso: 'largo / ancho / longitud',
  },
  superficie: {
    ud: '→ recuento',
    lin: 'largo / - / perimetro',
    sup: 'pasa a Superficie directa',
    area: 'largo / - / area',
    vol: '→ rectangulo',
    areaEsp: 'largo / ancho / area',
    peso: '→ longitud',
  },
  rectangulo: {
    ud: '→ recuento',
    lin: 'largo / - / perimetro',
    sup: 'largo,ancho / - / lados',
    area: 'largo / - / area',
    vol: 'largo,ancho / alto / lados',
    areaEsp: 'largo / ancho / area',
    peso: '→ longitud',
  },
};

describe('tabla herramienta × forma (§3.1)', () => {
  const celdas = (Object.keys(TABLA_MEDIDA) as Herramienta[]).flatMap((h) =>
    (Object.keys(TABLA_MEDIDA[h]) as MedForma[]).map((f) => [h, f] as const),
  );

  it.each(celdas)('%s en %s', (h, f) => {
    const c = TABLA_MEDIDA[h][f];
    const texto =
      c.encaja === 'pasa-a-area'
        ? 'pasa a Superficie directa'
        : c.encaja === false
          ? `→ ${c.usa}`
          : `${c.slots.join(',')} / ${c.fijas.join(',') || '-'} / ${c.magnitud}${c.factor ? ' ×h' : ''}`;
    expect(texto).toBe(ESPERADA[h][f]);
  });

  it.each(celdas)('%s en %s: toda casilla visible sale del plano o de una fija obligatoria', (h, f) => {
    const c = TABLA_MEDIDA[h][f];
    if (c.encaja !== true) return;
    const visibles = MED_SLOTS.slice(0, medFormaDef(f).cols.length).filter((s) => s !== 'uds');
    expect([...c.slots.filter((s) => s !== 'uds'), ...c.fijas].sort()).toEqual([...visibles].sort());
  });

  it('«no encaja» nombra una herramienta que sí encaja en esa forma', () => {
    for (const h of Object.keys(TABLA_MEDIDA) as Herramienta[])
      for (const [f, c] of Object.entries(TABLA_MEDIDA[h]) as [MedForma, (typeof TABLA_MEDIDA)[Herramienta][MedForma]][])
        if (c.encaja === false) expect(TABLA_MEDIDA[c.usa][f].encaja).toBe(true);
  });
});

/* ---- entradas de prueba ----------------------------------------------------- */
const plano = A0.planos[0]!;
const escala = escalaDe(plano, 1)!;
const partida = (ud: string, medForma?: MedForma, med: MedLine[] = []): Partida =>
  ({ id: 'p', pos: '1', code: 'X', title: 'X', ud, precio: 10, desc: '', med, items: [], ...(medForma ? { medForma } : {}) }) as Partida;
const entrada = (over: Partial<EntradaMedida>): EntradaMedida => ({
  herramienta: 'longitud',
  puntos: [
    [0, 0],
    [283.46, 0],
  ], // 5,00 m a 1:50
  plano,
  pagina: 1,
  escala,
  partida: partida('m'),
  fijas: {},
  restar: false,
  comentario: 'P1 · Tabique',
  formaId: 'f-1',
  at: '2026-09-26T10:00:00.000Z',
  ...over,
});

describe('prepararMedida', () => {
  it('Longitud en una partida por Longitud: largo = «t1+…» con `expr` y `origen` completo', () => {
    const r = prepararMedida(entrada({}));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = r.lineas[0]!;
    expect(l).toMatchObject({ comment: 'P1 · Tabique', uds: 1, largo: 5, ancho: '', alto: '', expr: { largo: '5' } });
    expect(l.origen).toMatchObject({
      planoId: plano.id,
      huella: plano.huella,
      pagina: 1,
      formaId: 'f-1',
      herramienta: 'longitud',
      calRev: escala.rev,
      mPorUnidad: escala.mPorUnidad,
      n: 50,
      magnitud: 'longitud',
      slots: ['largo'],
      valores: { largo: 5 },
    });
    expect(r.resumen.parcial).toBe(5);
  });

  it('sin calibrar: solo Recuento funciona', () => {
    expect(prepararMedida(entrada({ escala: null }))).toMatchObject({ ok: false, motivo: 'sin-calibrar' });
    const r = prepararMedida(entrada({ escala: null, herramienta: 'recuento', partida: partida('ud'), puntos: [[1, 1], [2, 2]] }));
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.lineas[0]!.origen).toMatchObject({ herramienta: 'recuento', mPorUnidad: 1, valores: { uds: 2 } });
    if (r.ok) expect('calRev' in r.lineas[0]!.origen).toBe(false);
  });

  it('no encaja: el motivo nombra la herramienta que sí encaja', () => {
    expect(prepararMedida(entrada({ partida: partida('ud') }))).toMatchObject({
      ok: false,
      motivo: 'no-encaja',
      forma: 'ud',
      usa: 'recuento',
    });
    expect(motivoHerramienta('superficie', { partida: partida('kg'), escala, fijas: {} })).toEqual({
      motivo: 'no-encaja',
      forma: 'peso',
      usa: 'longitud',
    });
  });

  it('Recuento en formas con más columnas: exige y escribe las fijas', () => {
    const e = entrada({ herramienta: 'recuento', partida: partida('m'), puntos: [[1, 1], [5, 5], [9, 9]] });
    expect(prepararMedida(e)).toMatchObject({ ok: false, motivo: 'falta-dimension', slot: 'largo', rotulo: 'Longitud' });
    const r = prepararMedida({ ...e, fijas: { largo: { value: 2.5 } } });
    expect(r.ok && r.lineas[0]).toMatchObject({ uds: 3, largo: 2.5 });
    expect(r.ok && r.lineas[0]!.origen).toMatchObject({ slots: ['uds'], valores: { uds: 3 }, fijas: { largo: 2.5 } });
    expect(r.ok && r.resumen.parcial).toBe(7.5);
  });

  it('una fija con el sentido del paramento en una partida L×A', () => {
    const m = motivoHerramienta('longitud', { partida: partida('m²'), escala, fijas: {} });
    expect(m).toEqual({ motivo: 'falta-dimension', slot: 'ancho', rotulo: 'Anchura (altura del paramento)' });
  });

  it('Longitud × h en Superficie directa: «(t…)×h» y el factor es obligatorio', () => {
    const e = entrada({
      partida: partida('m²', 'area'),
      puntos: [
        [0, 0],
        [283.46, 0],
        [283.46, 170.08],
      ],
    });
    expect(prepararMedida(e)).toMatchObject({ ok: false, motivo: 'falta-dimension', slot: 'factor' });
    const r = prepararMedida({ ...e, factor: 2.7 });
    expect(r.ok && r.lineas[0]).toMatchObject({ largo: 21.6, expr: { largo: '(5+3)×2,7' } });
    expect(r.ok && r.lineas[0]!.origen).toMatchObject({ magnitud: 'longitudPorFactor', factor: 2.7 });
    // con un solo tramo, sin paréntesis
    const u = prepararMedida({ ...e, puntos: e.puntos.slice(0, 2), factor: 2.7 });
    expect(u.ok && u.lineas[0]!.expr).toEqual({ largo: '5×2,7' });
  });

  describe('Superficie en una partida L×A (§3.2)', () => {
    const cuadro: Punto[] = [
      [0, 0],
      [283.46, 0],
      [283.46, 226.77],
      [0, 226.77],
    ]; // 5 × 4
    it('sin líneas: el cambio a Superficie directa es automático, en la misma medida', () => {
      const r = prepararMedida(entrada({ herramienta: 'superficie', partida: partida('m²'), puntos: cuadro }));
      expect(r).toMatchObject({ ok: true, cambioForma: 'area' });
      expect(r.ok && r.lineas[0]).toMatchObject({ largo: 20 });
    });
    it('con líneas L×A: pregunta; aceptar cambia la forma, rechazar deshabilita Superficie', () => {
      const con = partida('m²', undefined, [{ id: 'x', comment: '', uds: 1, largo: 2, ancho: 3, alto: '' }]);
      expect(prepararMedida(entrada({ herramienta: 'superficie', partida: con, puntos: cuadro }))).toMatchObject({
        ok: false,
        motivo: 'superficie-en-sup',
      });
      const si = prepararMedida(entrada({ herramienta: 'superficie', partida: con, puntos: cuadro, aceptaSupDirecta: true }));
      expect(si).toMatchObject({ ok: true, cambioForma: 'area' });
      expect(motivoHerramienta('superficie', { partida: con, escala, fijas: {}, aceptaSupDirecta: false })).toMatchObject({
        motivo: 'no-encaja',
        usa: 'rectangulo',
      });
    });
  });

  describe('Peso', () => {
    const viga = (comentario: string, fijas = {}) =>
      prepararMedida(entrada({ partida: partida('kg'), comentario, fijas }));
    it('sin kg/m ni perfil en el comentario: no crea la línea', () => {
      expect(viga('P1 · Viga')).toMatchObject({ ok: false, motivo: 'kgm-sin-resolver' });
    });
    it('el perfil del comentario da el kg/m, con su nombre como `expr`', () => {
      const r = viga('P1 · Viga IPE 300');
      expect(r.ok && r.lineas[0]).toMatchObject({ ancho: 42.2, expr: { largo: '5', ancho: 'IPE 300' } });
      expect(r.ok && r.lineas[0]!.origen.fijas).toEqual({ ancho: 42.2 });
    });
    it('perfiles distintos en el campo y en el comentario: bloquea con los dos', () => {
      expect(viga('Viga HEB 200', { ancho: { value: 42.2, expr: 'IPE 300' } })).toEqual({
        ok: false,
        motivo: 'perfiles-en-conflicto',
        comentario: 'HEB 200',
        campo: 'IPE 300',
      });
    });
    it('un kg/m numérico se escribe sin `expr` (el comentario no lo pisa)', () => {
      const r = viga('Viga HEB 200', { ancho: { value: 30 } });
      expect(r.ok && r.lineas[0]).toMatchObject({ ancho: 30, expr: { largo: '5' } });
    });
  });

  it('Restar: uds −1 fuera de Recuento y −N en Recuento', () => {
    const r = prepararMedida(entrada({ restar: true }));
    expect(r.ok && r.lineas[0]!.uds).toBe(-1);
    expect(r.ok && r.lineas[0]!.origen.valores).toEqual({ largo: 5 }); // uds no entra en valores
    const c = prepararMedida(entrada({ herramienta: 'recuento', partida: partida('ud'), restar: true, puntos: [[1, 1], [2, 2]] }));
    expect(c.ok && c.lineas[0]!.uds).toBe(-2);
    expect(c.ok && c.lineas[0]!.origen.valores).toEqual({ uds: -2 });
  });

  it('«fija → medida»: la partida con cantidad fija y sin líneas pasa a medirse', () => {
    const p = { ...partida('m'), cantidad: 100 };
    const r = prepararMedida(entrada({ partida: p }));
    expect(r.ok && r.resumen.antes).toMatchObject({ fija: true, cantidad: 100 });
    expect(r.ok && r.resumen.despues).toMatchObject({ fija: false, cantidad: 5 });
  });

  it('formas inválidas y cruzadas', () => {
    expect(prepararMedida(entrada({ puntos: [[1, 1], [1, 1]] }))).toMatchObject({ ok: false, motivo: 'forma-invalida', cual: 'longitud-cero' });
    const lazo: Punto[] = [
      [0, 1],
      [4, 0],
      [4, 10],
      [8, 10],
      [8, 0],
    ];
    expect(prepararMedida(entrada({ herramienta: 'superficie', partida: partida('m²', 'area'), puntos: lazo }))).toMatchObject({
      ok: false,
      motivo: 'forma-cruzada',
    });
  });

  it('los puntos se guardan redondeados a 0,01', () => {
    const r = prepararMedida(entrada({ puntos: [[0.004, 0], [283.456, 0.0049]] }));
    expect(r.ok && r.lineas[0]!.origen.puntos).toEqual([
      [0, 0],
      [283.46, 0],
    ]);
  });

  it('prefijo del comentario: la etiqueta de la página o «Pág. N»', () => {
    expect(prefijoComentario(plano, 1)).toBe('P1 · ');
    expect(prefijoComentario({ ...plano, etiquetas: {} }, 1)).toBe('Pág. 1 · ');
  });
});

describe('los fixtures salen de las mismas reglas', () => {
  const lineas = (o: Obra) =>
    Object.values(o.partidas).flatMap((ps) => ps.flatMap((p) => p.med.map((l) => ({ l, p }))));

  it.each([
    ['A0', A0],
    ['A1', A1],
  ] as const)('valoresDesdeOrigen = fixture %s y solo escribe en `slots`', (_n, obra) => {
    for (const { l } of lineas(obra)) {
      const o = l.origen!;
      const { valores, expr } = valoresDesdeOrigen(o, { mPorUnidad: o.mPorUnidad, signo: (Math.sign(l.uds as number) || 1) as 1 | -1 });
      expect(valores).toEqual(o.valores);
      expect(Object.keys(valores).every((k) => o.slots.includes(k as never))).toBe(true);
      for (const [k, v] of Object.entries(expr)) expect(l.expr?.[k as 'largo']).toBe(v);
    }
  });

  it('prepararMedida reconstruye cada línea del fixture A0 desde su geometría', () => {
    for (const { l, p } of lineas(A0)) {
      const o = l.origen!;
      const pl = A0.planos.find((x) => x.id === o.planoId)!;
      const fijaAncho = medFormaDe(p) === 'peso' ? {} : o.fijas?.ancho ? { ancho: { value: o.fijas.ancho } } : {};
      const r = prepararMedida({
        herramienta: o.herramienta,
        puntos: o.puntos as Punto[],
        plano: pl,
        pagina: o.pagina,
        escala: escalaDe(pl, o.pagina),
        partida: { ...p, med: [] },
        fijas: fijaAncho,
        ...(o.factor ? { factor: o.factor } : {}),
        restar: (l.uds as number) < 0,
        comentario: l.comment,
        formaId: o.formaId,
        at: o.at,
      });
      expect(r.ok, `${l.id}: ${JSON.stringify(r)}`).toBe(true);
      if (!r.ok) continue;
      const { id: _id, ...sinId } = l;
      void _id;
      expect(r.lineas[0], l.id).toEqual(sinId);
    }
  });

  it('A0 no crea ninguna línea retocada; la aceptada de A1 lo estaría sin su marca', () => {
    for (const { l } of lineas(A0)) expect(lineaRetocada(l)).toBe(false);
    const acep = lineas(A1).find(({ l }) => (l.origen as OrigenPlano).aceptada)!.l;
    expect(lineaRetocada(acep)).toBe(true);
    expect(NOMBRE_HERRAMIENTA.rectangulo).toBe('Rectángulo');
  });
});

describe('[A1] «Añadir también a…»: la misma forma por otra fila (§5.7)', () => {
  const M = 283.46 / 5; // 1 m a 1:50
  const salon: Punto[] = [
    [0, 0],
    [5 * M, 0],
    [5 * M, 4 * M],
    [0, 4 * M],
  ];
  const otra = (partidaDestino: Partida, i: 'area' | 'perimetro', extra: Partial<EntradaMedida> = {}) =>
    prepararMedida(
      entrada({
        herramienta: 'superficie',
        fila: filaDe('superficie', i),
        puntos: salon,
        partida: partidaDestino,
        comentario: 'P1 · Salón',
        formaId: 'f-salon',
        ...extra,
      }),
    );

  it('el polígono del solado entra como perímetro en Rodapié y como perímetro × 2,70 en Pintura', () => {
    const rodapie = otra(partida('m'), 'perimetro');
    if (!rodapie.ok) throw new Error(JSON.stringify(rodapie));
    expect(rodapie.lineas[0]).toMatchObject({ largo: 18, expr: { largo: '5+4+5+4' } });
    expect(rodapie.lineas[0]!.origen).toMatchObject({ herramienta: 'superficie', magnitud: 'perimetro', formaId: 'f-salon' });
    const pintura = otra(partida('m²', 'area'), 'perimetro', { factor: 2.7 });
    if (!pintura.ok) throw new Error(JSON.stringify(pintura));
    expect(pintura.lineas[0]).toMatchObject({ largo: 48.6, expr: { largo: '(5+4+5+4)×2,7' } });
    expect(pintura.lineas[0]!.origen).toMatchObject({ magnitud: 'longitudPorFactor', factor: 2.7 });
    // su área, en Sup. directa
    const solado = otra(partida('m²', 'area'), 'area');
    expect(solado.ok && solado.lineas[0]!.largo).toBe(20);
  });

  it('perímetro en L×A: con la Anchura fija como altura del paramento', () => {
    const r = otra(partida('m²', 'sup'), 'perimetro', { fijas: { ancho: { value: 2.7 } } });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.lineas[0]).toMatchObject({ largo: 18, ancho: 2.7 });
    expect(textoInterpretacion('superficie', 'perimetro', partida('m²', 'sup'))).toBe('perímetro × Anchura (altura del paramento)');
  });

  it('Restar se conserva: un hueco entra como hueco', () => {
    const r = otra(partida('m'), 'perimetro', { restar: true });
    expect(r.ok && r.lineas[0]!.uds).toBe(-1);
  });

  it('qué se ofrece en cada partida; por Unidades, nada', () => {
    expect(interpretacionesPara('superficie', partida('ud'))).toEqual([]);
    expect(interpretacionesPara('superficie', partida('m'))).toEqual(['perimetro']); // por metros, el área no es un área
    expect(interpretacionesPara('superficie', partida('m²', 'area'))).toEqual(['area', 'perimetro']);
    expect(interpretacionesPara('superficie', partida('m²', 'sup'))).toEqual(['area', 'perimetro']); // pasa a Sup. directa
    expect(interpretacionesPara('superficie', partida('kg', 'peso'))).toEqual(['perimetro']);
    expect(interpretacionesPara('rectangulo', partida('m³', 'vol'))).toEqual(['area', 'perimetro']);
    expect(interpretacionesPara('longitud', partida('m²', 'area'))).toEqual(['longitud']);
    expect(interpretacionesPara('recuento', partida('ud'))).toEqual(['recuento']);
    expect(textoInterpretacion('superficie', 'perimetro', partida('m²', 'area'), 2.7)).toBe('perímetro × 2,7');
    expect(textoInterpretacion('rectangulo', 'area', partida('m²', 'sup'))).toBe('largo y ancho');
    expect(textoInterpretacion('superficie', 'area', partida('m²', 'area'))).toBe('área');
  });
});
