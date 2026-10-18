/* ===========================================================================
   core/rcd/coherencia — ¿dicen lo mismo el estudio y el presupuesto? (7.º)

   Compara la estimación por código con las partidas del capítulo de gestión
   enlazado, por lo que gestiona cada una (sus códigos o su grupo, de su
   `rcd.gestiona` o de su título) y en su unidad: t, m³ aparentes, o
   contenedores × la capacidad que diga el texto. Avisa (nunca corrige):
     · diferencia de más de un 10 % entre lo estimado y lo presupuestado;
     · contenedores sin capacidad en el texto;
     · demoliciones «sin transporte» sin capítulo de gestión que las recoja;
     · demoliciones que ya incluyen el transporte cuyos residuos también
       gestiona el capítulo (posible doble cobro);
     · partidas que dicen «a vertedero» (en Andalucía, Decreto 73/2012 art. 86).
   Plan §6 y hallazgos 4–6.
   =========================================================================== */
import { partidaCantidad } from '../medicion';
import type { Partida } from '../types';
import { unidadRcd } from './conversion';
import { grupoDe } from './fracciones';
import { textoDe, transporteDe } from './reglas';
import type { Aviso, CodigoLer, FilaCodigo, GrupoRcd } from './tipos';

export const TOLERANCIA = 0.1;

interface Gestiona {
  codigos?: CodigoLer[];
  grupos?: GrupoRcd[];
  /** Todo lo no peligroso salvo tierras («mixtos», «inertes», «sin clasificar»). */
  mixtos?: boolean;
}

/** Qué gestiona una partida del capítulo, de su `rcd.gestiona` o de su título. */
export function queGestiona(p: Pick<Partida, 'title' | 'desc' | 'rcd'>): Gestiona | null {
  const g = p.rcd?.gestiona;
  if (g?.codigos?.length) return { codigos: g.codigos };
  if (g?.grupo) return { grupos: [g.grupo] };
  const t = textoDe(p);
  if (/\btierras?\b/.test(t)) return { grupos: ['tierras'] };
  if (/\b(peligros|amianto|fibrocemento)/.test(t)) return { grupos: ['peligrosos'] };
  if (/\bno petre/.test(t)) return { grupos: ['noPetrea'] };
  if (/\bpetre/.test(t)) return { grupos: ['petrea'] };
  if (/\b(mixtos?|mezcla|mezclados?|inertes|sin clasificar|rcds?|escombros?)\b/.test(t)) return { mixtos: true };
  const codigos: CodigoLer[] = [];
  if (/\bhormig/.test(t)) codigos.push('17 01 01');
  if (/\b(metal|metalicos|acero|hierro|chatarra)/.test(t)) codigos.push('17 04 05', '17 04 07', '17 04 02', '17 04 01');
  if (/\bmadera\b/.test(t)) codigos.push('17 02 01', '15 01 03');
  if (/\bplastic/.test(t)) codigos.push('17 02 03', '15 01 02');
  if (/\b(papel|carton)\b/.test(t)) codigos.push('15 01 01', '20 01 01');
  if (/\bvidrio\b/.test(t)) codigos.push('17 02 02');
  if (/\byeso\b/.test(t)) codigos.push('17 08 02');
  return codigos.length ? { codigos } : null;
}

/** Capacidad del contenedor en m³ del texto («contenedor de 7 m³»). */
export function capacidadContenedor(texto: string): number | null {
  const m = texto.match(/contenedor(?:es)?\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*m(?:3|³)(?![a-z0-9])/);
  return m ? Number(m[1]!.replace(',', '.')) : null;
}

function casa(g: Gestiona, f: FilaCodigo): boolean {
  if (g.codigos) return g.codigos.includes(f.ler);
  if (g.grupos) return g.grupos.includes(grupoDe(f.fraccion));
  if (g.mixtos) return f.fraccion !== 'tierras' && f.fraccion !== 'peligrosos';
  return false;
}

const fmt = (n: number, ud: string) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${ud}`;

export interface EntradaCoherencia {
  /** Partidas del capítulo de gestión enlazado. */
  gestion: Partida[];
  /** Todas las partidas que generan (fuera del capítulo de gestión). */
  generan: Partida[];
  porCodigo: FilaCodigo[];
  andalucia: boolean;
  hayCapitulo: boolean;
}

export function coherencia(e: EntradaCoherencia): Aviso[] {
  const avisos: Aviso[] = [];
  /* ---- capítulo de gestión frente a la estimación ---- */
  if (e.hayCapitulo) {
    // `cap`: el mayor contenedor que cuenta el grupo; contar contenedores redondea
    // por arriba, así que un exceso de menos de un contenedor no es descuadre.
    const grupos = new Map<string, { gestiona: Gestiona; t: number; m3: number; pt: number; pm3: number; cap: number; titulo: string }>();
    for (const p of e.gestion) {
      const g = queGestiona(p);
      if (!g) continue;
      const clave = JSON.stringify(g);
      const acc = grupos.get(clave) ?? { gestiona: g, t: 0, m3: 0, pt: 0, pm3: 0, cap: 0, titulo: p.title };
      const q = partidaCantidad(p);
      const u = unidadRcd(p.ud);
      if (u === 't') acc.pt += q;
      else if (u === 'kg') acc.pt += q / 1000;
      else if (u === 'm3') acc.pm3 += q;
      else if (u === 'ud') {
        const cap = p.rcd?.gestiona?.capacidadContenedorM3 ?? capacidadContenedor(textoDe(p));
        if (cap) {
          acc.pm3 += q * cap;
          acc.cap = Math.max(acc.cap, cap);
        }
        else avisos.push({ id: `contenedor:${p.id}`, partidaId: p.id, texto: `La partida ${p.code} cuenta contenedores, pero no dice su capacidad («contenedor de 7 m³»): no se puede comparar con la estimación.` });
      }
      grupos.set(clave, acc);
    }
    for (const [clave, g] of grupos) {
      const filas = e.porCodigo.filter((f) => casa(g.gestiona, f));
      g.t = filas.reduce((s, f) => s + f.t, 0);
      g.m3 = filas.reduce((s, f) => s + (f.m3Aparente ?? 0), 0);
      const dif = (a: number, b: number) => (Math.max(a, b) > 0 ? Math.abs(a - b) / Math.max(a, b) : 0);
      if (g.pt > 0 && dif(g.pt, g.t) > TOLERANCIA)
        avisos.push({ id: `cuadre-t:${clave}`, texto: `«${g.titulo}»: el presupuesto gestiona ${fmt(g.pt, 't')} y el estudio estima ${fmt(g.t, 't')}.` });
      const redondeo = g.cap > 0 && g.pm3 >= g.m3 && g.pm3 - g.m3 < g.cap;
      if (g.pm3 > 0 && !redondeo && dif(g.pm3, g.m3) > TOLERANCIA)
        avisos.push({ id: `cuadre-m3:${clave}`, texto: `«${g.titulo}»: el presupuesto gestiona ${fmt(g.pm3, 'm³')} y el estudio estima ${fmt(g.m3, 'm³')} aparentes.` });
    }
    const sinGestion = e.porCodigo.filter((f) => f.t > 0 && ![...grupos.values()].some((g) => casa(g.gestiona, f)));
    if (sinGestion.length && grupos.size)
      avisos.push({ id: 'sin-gestion', texto: `Ninguna partida del capítulo de gestión recoge ${sinGestion.map((f) => f.ler).join(', ')}.` });
  }

  /* ---- transporte de las demoliciones ---- */
  const excluido: Partida[] = [];
  const incluido: Partida[] = [];
  for (const p of e.generan) {
    if (p.rcd?.estado !== 'confirmada' || !p.rcd.componentes.some((c) => c.tipo === 'demolicion')) continue;
    const tr = p.rcd.transporte ?? transporteDe(textoDe(p));
    if (tr === 'excluido') excluido.push(p);
    else if (tr === 'incluido') incluido.push(p);
  }
  if (excluido.length && !e.hayCapitulo)
    avisos.push({ id: 'sin-transporte', texto: `${excluido.length} demolición${excluido.length === 1 ? '' : 'es'} no incluye${excluido.length === 1 ? '' : 'n'} el transporte y no hay capítulo de gestión enlazado que lo recoja.` });
  if (incluido.length && e.hayCapitulo && e.gestion.some((p) => queGestiona(p)))
    avisos.push({
      id: 'doble-cobro',
      texto: `${incluido.length} demolición${incluido.length === 1 ? '' : 'es'} ya incluye${incluido.length === 1 ? '' : 'n'} carga y transporte (${incluido.map((p) => p.code).slice(0, 4).join(', ')}${incluido.length > 4 ? '…' : ''}): revisa que el capítulo de gestión no los cobre otra vez.`,
    });

  /* ---- «a vertedero» en el texto de las partidas ---- */
  if (e.andalucia) {
    const vert = [...e.generan, ...e.gestion].filter((p) => p.rcd?.estado !== 'noGenera' && /\b(vertedero|t\. ?vert)/.test(textoDe(p)));
    if (vert.length)
      avisos.push({
        id: 'texto-vertedero',
        texto: `${vert.length} partida${vert.length === 1 ? '' : 's'} del presupuesto dice${vert.length === 1 ? '' : 'n'} «a vertedero» (${vert.map((p) => p.code).slice(0, 4).join(', ')}${vert.length > 4 ? '…' : ''}); el estudio lleva los residuos a planta de valorización. En Andalucía el vertedero directo exige justificación (Decreto 73/2012, art. 86).`,
      });
  }
  return avisos;
}
