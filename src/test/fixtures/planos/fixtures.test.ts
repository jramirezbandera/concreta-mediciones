/* ===========================================================================
   Fixtures de la «Especificación · Etapa A» (docs/plan-medir-planos-pdf.md,
   §1). Son el contrato de lo que se guarda en v6: el lector y el escritor v6
   (A0) tienen que leerlos y devolverlos iguales. Este test comprueba que los
   propios fixtures cumplen las reglas de la especificación, recalculando cada
   valor desde los puntos con una implementación de referencia mínima (la de A0,
   `valoresDesdeOrigen`, tendrá que dar lo mismo) y cada `expr` con el
   evaluador real.
   =========================================================================== */
import { describe, expect, it } from 'vitest';
import { evalEsExpr } from '../../../core/expresion';
import { round2 } from '../../../core/money';
import { isObraData, newerVersionOf } from '../../../persist/persist';
import a0 from './obra-v6-a0.json';
import a1 from './obra-v6-a1.json';

type Punto = [number, number];
type Slot = 'uds' | 'largo' | 'ancho' | 'alto';
interface Origen {
  planoId: string;
  huella: string;
  pagina: number;
  formaId: string;
  herramienta: 'longitud' | 'superficie' | 'rectangulo' | 'recuento';
  puntos: Punto[];
  calRev?: string;
  mPorUnidad: number;
  magnitud: 'recuento' | 'longitud' | 'perimetro' | 'area' | 'lados' | 'longitudPorFactor';
  slots: Slot[];
  valores: Partial<Record<Slot, number>>;
  fijas?: Partial<Record<Slot, number>>;
  factor?: number;
  aceptada?: boolean;
  at: string;
}
interface Linea {
  id: string;
  comment: string;
  uds: number | '';
  largo: number | '';
  ancho: number | '';
  alto: number | '';
  expr?: Partial<Record<Slot, string>>;
  origen?: Origen;
}
interface Plano {
  id: string;
  huella: string;
  huellasAnteriores?: string[];
  revision?: string;
  sustituye?: string;
  quitado?: string;
  paginas: number;
  etiquetas?: Record<string, string>;
  escalas: Record<string, { rev: string; mPorUnidad: number }>;
}
interface Obra {
  schemaVersion: number;
  partidas: Record<string, { id: string; med: Linea[] }[]>;
  planos: Plano[];
}

/* ---- referencia mínima de las reglas de §3 (formateador y valores) ---------- */
/** Cifra de `expr`: coma decimal, sin miles ni exponente, sin ceros de cola. */
const cifra = (n: number): string => String(+n.toFixed(6)).replace('.', ',');
const dist = (a: Punto, b: Punto) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const tramos = (p: Punto[], m: number, cerrado: boolean): number[] => {
  const t = p.slice(1).map((q, i) => round2(dist(p[i]!, q) * m));
  if (cerrado) t.push(round2(dist(p[p.length - 1]!, p[0]!) * m));
  return t;
};
const lazo = (p: Punto[], m: number): number => {
  let s = 0;
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  });
  return round2((Math.abs(s) / 2) * m * m);
};

/** Lo que el plano escribe en cada casilla de `slots`, con su `expr`. */
function referencia(o: Origen, uds: number): { valores: Partial<Record<Slot, number>>; expr: Partial<Record<Slot, string>> } {
  const m = o.mPorUnidad;
  const cerrado = o.herramienta !== 'longitud';
  const suma = (t: number[]) => t.map(cifra).join('+');
  switch (o.magnitud) {
    case 'recuento':
      return { valores: { uds: Math.sign(uds) * o.puntos.length }, expr: {} };
    case 'longitud':
    case 'perimetro': {
      const t = tramos(o.puntos, m, cerrado);
      const e = suma(t);
      return { valores: { largo: evalEsExpr(e)! }, expr: { largo: e } };
    }
    case 'longitudPorFactor': {
      const t = tramos(o.puntos, m, cerrado);
      const e = `${t.length > 1 ? `(${suma(t)})` : suma(t)}×${cifra(o.factor!)}`;
      return { valores: { largo: evalEsExpr(e)! }, expr: { largo: e } };
    }
    case 'lados': {
      const [l, w] = tramos(o.puntos.slice(0, 3), m, false);
      return { valores: { largo: l!, ancho: w! }, expr: {} };
    }
    case 'area': {
      if (o.herramienta === 'rectangulo') {
        const [l, w] = tramos(o.puntos.slice(0, 3), m, false);
        const e = `${cifra(l!)}×${cifra(w!)}`;
        return { valores: { largo: evalEsExpr(e)! }, expr: { largo: e } };
      }
      return { valores: { largo: lazo(o.puntos, m) }, expr: {} };
    }
  }
}

const FIXTURES: [string, Obra][] = [
  ['obra-v6-a0.json', a0 as unknown as Obra],
  ['obra-v6-a1.json', a1 as unknown as Obra],
];

describe.each(FIXTURES)('%s cumple el contrato v6', (_n, obra) => {
  const lineas = Object.values(obra.partidas).flatMap((ps) => ps.flatMap((p) => p.med));
  const medidas = lineas.filter((l): l is Linea & { origen: Origen } => !!l.origen);
  const plano = (id: string) => obra.planos.find((p) => p.id === id)!;

  it('es v6 y la app v5 (Etapa 0) la reconoce como «más nueva», no como dañada', () => {
    expect(obra.schemaVersion).toBe(6);
    expect(newerVersionOf({ schemaVersion: 6, savedAt: 'x', appVersion: 'x', data: obra })).toBe(6);
    expect(isObraData(obra)).toBe(true); // forma v5 intacta: v6 solo añade campos
  });

  it('claves de página enteras de 1 a `paginas`', () => {
    for (const p of obra.planos)
      for (const k of [...Object.keys(p.escalas), ...Object.keys(p.etiquetas ?? {})]) {
        expect(Number.isInteger(Number(k))).toBe(true);
        expect(Number(k)).toBeGreaterThanOrEqual(1);
        expect(Number(k)).toBeLessThanOrEqual(p.paginas);
      }
  });

  it('cada `origen` apunta a su plano, con la huella del plano o una anterior', () => {
    for (const { origen: o } of medidas) {
      const p = plano(o.planoId);
      expect(p).toBeTruthy();
      expect([p.huella, ...(p.huellasAnteriores ?? [])]).toContain(o.huella);
      expect(o.pagina).toBeGreaterThanOrEqual(1);
      expect(o.pagina).toBeLessThanOrEqual(p.paginas);
      if (o.herramienta === 'recuento') expect(o.mPorUnidad).toBe(1);
      else expect(o.calRev).toBeTruthy();
    }
  });

  it('puntos redondeados a 0,01 y número de puntos por herramienta', () => {
    for (const { origen: o } of medidas) {
      for (const [x, y] of o.puntos) {
        expect(Math.round(x * 100) / 100).toBe(x);
        expect(Math.round(y * 100) / 100).toBe(y);
      }
      const n = o.puntos.length;
      if (o.herramienta === 'rectangulo') expect(n).toBe(4);
      else if (o.herramienta === 'superficie') expect(n).toBeGreaterThanOrEqual(3);
      else if (o.herramienta === 'longitud') expect(n).toBeGreaterThanOrEqual(2);
      else expect(n).toBeGreaterThanOrEqual(1);
    }
  });

  it('valores y `expr` salen de la geometría con las reglas de §3', () => {
    for (const l of medidas) {
      const o = l.origen;
      const ref = referencia(o, l.uds as number);
      expect(Object.keys(o.valores).sort()).toEqual([...o.slots].sort());
      expect(o.valores).toEqual(ref.valores);
      for (const s of o.slots) {
        if (!o.aceptada) expect(l[s]).toBe(o.valores[s]); // retocada = alguna casilla distinta
        if (ref.expr[s]) expect(l.expr?.[s]).toBe(ref.expr[s]);
        if (l.expr?.[s]) expect(evalEsExpr(l.expr[s]!)).toBe(l[s]);
      }
    }
  });

  it('fijas escritas en su casilla; `uds` 1 o −1 fuera de Recuento', () => {
    for (const l of medidas) {
      for (const [s, v] of Object.entries(l.origen.fijas ?? {})) expect(l[s as Slot]).toBe(v);
      if (l.origen.herramienta !== 'recuento') expect([1, -1]).toContain(l.uds);
    }
  });

  it('misma `formaId` ⇒ mismos puntos (una forma es una geometría inmutable)', () => {
    const porForma = new Map<string, string>();
    for (const { origen: o } of medidas) {
      const clave = JSON.stringify([o.planoId, o.pagina, o.herramienta, o.puntos]);
      expect(porForma.get(o.formaId) ?? clave).toBe(clave);
      porForma.set(o.formaId, clave);
    }
  });
});

describe('fixtures: cobertura de la especificación', () => {
  const lineasDe = (o: Obra) => Object.values(o.partidas).flatMap((ps) => ps.flatMap((p) => p.med));
  it('A0 trae un ejemplo por herramienta y por magnitud que A0 puede crear', () => {
    const os = lineasDe(a0 as unknown as Obra).map((l) => l.origen!);
    expect(new Set(os.map((o) => o.herramienta))).toEqual(new Set(['longitud', 'superficie', 'rectangulo', 'recuento']));
    expect(new Set(os.map((o) => o.magnitud))).toEqual(
      new Set(['recuento', 'longitud', 'area', 'lados', 'longitudPorFactor']),
    );
    expect(lineasDe(a0 as unknown as Obra).some((l) => typeof l.uds === 'number' && l.uds < 0)).toBe(true); // Restar
  });
  it('A1 trae lo que A0 no crea pero tiene que conservar', () => {
    const o = a1 as unknown as Obra;
    const os = lineasDe(o).map((l) => l.origen!);
    expect(o.planos.some((p) => p.sustituye && p.revision)).toBe(true);
    expect(o.planos.some((p) => p.quitado)).toBe(true);
    expect(o.planos.some((p) => (p.huellasAnteriores?.length ?? 0) > 0)).toBe(true);
    expect(o.planos.some((p) => Object.values(p.escalas).some((e) => (e as Record<string, unknown>).ajustada))).toBe(true);
    expect(os.some((x) => x.aceptada)).toBe(true);
    expect(os.some((x) => x.magnitud === 'perimetro')).toBe(true);
    const n = new Map<string, number>();
    for (const x of os) n.set(x.formaId, (n.get(x.formaId) ?? 0) + 1);
    expect([...n.values()].some((c) => c > 1)).toBe(true); // «Añadir también a…»
  });
});
