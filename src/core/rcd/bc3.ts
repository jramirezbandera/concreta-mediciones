/* ===========================================================================
   core/rcd/bc3 — residuos de un .bc3: el registro `~R` (descomposición de
   residuos) y la información técnica `~X` (ler, m, v) de FIEBDC-3/2016.

   Lo trae el Generador de precios de CYPE (y el BEDEC). Por cada partida, en
   kg por unidad de medición (especificación FIEBDC-3/2016 y 3/2024, «Cálculo
   de residuos»):
     · tipos 1, 2 y 3 (demolición, excavación, embalaje): hijo de tipo 4 del
       `~C`, con r = rendimiento → r × m(hijo) kg y r × v(hijo) m³;
     · tipo 0 (colocación): material del `~D` de la partida, con rp = factor de
       residuo → cantidad × rp × m(material);
     · el embalaje de los propios materiales (su `~R` de tipo 3) × su cantidad
       en la partida. Comprobado: así sale exactamente la tabla por código del
       estudio que imprime CYPE para la misma obra (plan, hallazgo 1).
   El `ler` llega como «17 02 01», «170201» o como código de un concepto de
   tipo 5 cuyo resumen empieza por el código («170102 (ladrillos)», BEDEC).
   Los m³ de CYPE son aparentes (v = 1 / densidad del escombro).

   Lee el texto del fichero directamente (el parser del vendor no conoce el
   `~R`). Todo lo que sale es una PROPUESTA (D5): `estado: 'propuesta'`.
   =========================================================================== */
import { normalizarLer } from './ler';
import type { ComponenteRcd, TipoComponente } from './tipos';

const TIPO: Record<string, TipoComponente> = { '0': 'colocacion', '1': 'demolicion', '2': 'excavacion', '3': 'embalaje' };

interface Concepto {
  code: string;
  summary: string;
  type: string;
}
interface CompR {
  tipo: string;
  hijo: string;
  props: Record<string, number>;
}

const limpia = (s: string): string => s.replace(/\r|\n/g, '');
const num = (s: string | undefined, def: number): number => {
  const t = (s ?? '').trim();
  if (!t) return def;
  const v = Number(t.replace(',', '.'));
  return Number.isFinite(v) ? v : def;
};
const sinMarca = (c: string): string => limpia(c).trim().replace(/#+$/, '');

export interface ResiduosBc3 {
  /** Componentes por código de concepto (partida), ya por unidad de medición. */
  porCodigo: Map<string, ComponenteRcd[]>;
  /** Partidas con `~R` cuyo `ler` no se pudo leer. */
  avisos: string[];
}

/** Lee los residuos de todas las partidas del fichero. Vacío si no hay `~R`. */
export function leerResiduosBc3(text: string): ResiduosBc3 {
  const out: ResiduosBc3 = { porCodigo: new Map(), avisos: [] };
  if (!/(^|\n)~R\|/.test(text)) return out;
  const C = new Map<string, Concepto>();
  const D = new Map<string, Array<{ hijo: string; q: number }>>();
  const R = new Map<string, CompR[]>();
  const X = new Map<string, Record<string, string>>();
  for (const rec of text.split(/(?:^|\r?\n)~/)) {
    if (rec.length < 2 || rec[1] !== '|') continue;
    const t = rec[0];
    const f = rec.slice(2).split('|');
    if (t === 'C') {
      const code = sinMarca(f[0]!.split('\\')[0]!);
      C.set(code, { code, summary: limpia(f[2] ?? '').trim(), type: (f[5] ?? '').trim() });
    } else if (t === 'D') {
      const s = limpia(f[1] ?? '').split('\\');
      const kids: Array<{ hijo: string; q: number }> = [];
      for (let i = 0; i + 2 < s.length; i += 3) {
        const hijo = sinMarca(s[i]!);
        if (hijo) kids.push({ hijo, q: num(s[i + 1], 1) * num(s[i + 2], 1) });
      }
      D.set(sinMarca(f[0]!), kids);
    } else if (t === 'R') {
      const comps: CompR[] = [];
      for (const campo of f.slice(1)) {
        const s = limpia(campo).split('\\');
        if (s.length < 4 || !s[1]!.trim()) continue;
        const props: Record<string, number> = {};
        for (let i = 2; i + 1 < s.length; i += 3) if (s[i]!.trim()) props[s[i]!.trim()] = num(s[i + 1], 0);
        comps.push({ tipo: s[0]!.trim(), hijo: sinMarca(s[1]!), props });
      }
      R.set(sinMarca(f[0]!), comps);
    } else if (t === 'X') {
      const code = sinMarca(f[0] ?? '');
      if (!code) continue;
      const s = limpia(f[1] ?? '').split('\\');
      const d: Record<string, string> = {};
      for (let i = 0; i + 1 < s.length; i += 2) if (s[i]!.trim()) d[s[i]!.trim()] = s[i + 1]!.trim();
      X.set(code, d);
    }
  }

  /** LER de un concepto: directo o por un concepto de clasificación (tipo 5). */
  const lerDe = (code: string): string | null => {
    const raw = X.get(code)?.ler;
    if (!raw) return null;
    const directo = normalizarLer(raw);
    if (directo) return directo;
    const cls = C.get(sinMarca(raw));
    const m = cls?.summary.match(/^\s*(\d{2}\s?\d{2}\s?\d{2})/);
    return m ? normalizarLer(m[1]!) : null;
  };
  const mv = (code: string): { m: number; v: number } | null => {
    const x = X.get(code);
    if (!x?.m) return null;
    return { m: num(x.m, 0), v: num(x.v, 0) };
  };

  for (const [padre, comps] of R) {
    const c = C.get(padre);
    // Solo partidas: fuera los recursos (1–3: su ~R es su embalaje, que se suma
    // por su cantidad en cada partida) y los propios residuos (4, 5).
    if (!c || ['1', '2', '3', '4', '5'].includes(c.type)) continue;
    const kids = D.get(padre) ?? [];
    if (!kids.length && comps.every((x) => x.tipo === '0')) continue;
    const acc = new Map<string, { ler: string; tipo: TipoComponente; kg: number; m3: number }>();
    const suma = (ler: string, tipo: TipoComponente, kg: number, m3: number) => {
      const k = `${ler}|${tipo}`;
      const a = acc.get(k) ?? { ler, tipo, kg: 0, m3: 0 };
      a.kg += kg;
      a.m3 += m3;
      acc.set(k, a);
    };
    let ilegibles = 0;
    for (const comp of comps) {
      const tipo = TIPO[comp.tipo];
      if (!tipo) continue;
      const ler = lerDe(comp.hijo);
      const p = mv(comp.hijo);
      if (!ler || !p) {
        if ((comp.props.r ?? comp.props.rp ?? 0) > 0) ilegibles += 1;
        continue;
      }
      if (tipo === 'colocacion') {
        const q = kids.filter((k) => k.hijo === comp.hijo).reduce((s, k) => s + k.q, 0);
        const rp = comp.props.rp ?? 0;
        if (q * rp > 0) suma(ler, tipo, q * rp * p.m, q * rp * p.v);
      } else {
        const r = comp.props.r ?? 0;
        if (r > 0) suma(ler, tipo, r * p.m, r * p.v);
      }
    }
    // embalaje de los materiales de la partida (su propio ~R de tipo 3)
    for (const k of kids) {
      for (const comp of R.get(k.hijo) ?? []) {
        if (comp.tipo !== '3') continue;
        const ler = lerDe(comp.hijo);
        const p = mv(comp.hijo);
        const r = comp.props.r ?? 0;
        if (ler && p && r > 0) suma(ler, 'embalaje', k.q * r * p.m, k.q * r * p.v);
      }
    }
    if (ilegibles) out.avisos.push(`${padre}: ${ilegibles} residuo${ilegibles === 1 ? '' : 's'} sin código LER o sin masa legible.`);
    const componentes: ComponenteRcd[] = [...acc.values()]
      .filter((a) => a.kg > 0)
      .sort((a, b) => a.ler.localeCompare(b.ler) || a.tipo.localeCompare(b.tipo))
      .map((a) => ({
        ler: a.ler,
        tipo: a.tipo,
        conversion: { modo: 'directo', tPorUd: a.kg / 1000, m3PorUd: a.m3, m3Base: 'aparente' },
      }));
    if (componentes.length) out.porCodigo.set(padre, componentes);
  }
  return out;
}
