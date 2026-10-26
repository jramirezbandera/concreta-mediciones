/* ===========================================================================
   core/pcc/hormigon — la designación del hormigón (T-R/C/TM/A, Código
   Estructural art. 33.6) leída del texto de la partida y validada.

   De la clase de exposición dependen los ensayos de durabilidad, y en los
   presupuestos salen clases EHE (`IIa`) y erratas (`CX1`, `XC2a`) (K-PCC.52).
   Una clase que no es de la tabla 27.1.a no se adivina: queda en
   `clasesNoValidas`, con aviso, y no dispara durabilidad; la partida cuenta
   igual para los lotes si se leen el tipo y el fck (Q2). Sin tipo o fck, no
   hay designación.
   =========================================================================== */
import durabilidad from './tablas/durabilidad.json';
import type { Consistencia, DesignacionHormigon, TipoHormigon } from './tipos';

const CLASES = new Set(durabilidad.clases.validas);

export interface LecturaDesignacion {
  designacion: DesignacionHormigon;
  avisos: string[];
}

// «HA-25», «HA 25/…», «HRA-30»: el tipo y el fck, con guion o seguidos de «/».
const RE_INICIO = /\b(HRM|HRA|HM|HA|HP)(?:\s*[-–]\s*|\s+(?=\d{2,3}\s*\/))(\d{2,3})(?!\d)/i;
// Lo que sigue: «/B/20/XC2+XF1», con espacios alrededor de «/» y «+».
const RE_RESTO = /^((?:\s*\/\s*(?:\([^)]*\)|[^\s/,;()]+)(?:\s*\+\s*[^\s/,;()]+)*)*)/;

/** Lee la primera designación del texto; `null` si no hay tipo y fck. */
export function leerDesignacion(texto: string): LecturaDesignacion | null {
  const m = RE_INICIO.exec(texto);
  if (!m) return null;
  const sigla = m[1]!.toUpperCase();
  const fck = Number(m[2]);
  const resto = RE_RESTO.exec(texto.slice(m.index + m[0].length))?.[1] ?? '';
  const partes = resto
    .split('/')
    .map((s) => s.trim().replace(/[.:]+$/, ''))
    .filter(Boolean);

  let consistencia: Consistencia | null = null;
  let arido: number | null = null;
  const tokens: string[] = [];
  for (const p of partes) {
    if (consistencia == null && arido == null && !tokens.length && /^\(?AC\b/i.test(p)) consistencia = 'AC';
    else if (consistencia == null && arido == null && !tokens.length && /^[SPBFL]$/i.test(p))
      consistencia = p.toUpperCase() as Consistencia;
    else if (arido == null && !tokens.length && /^\d{1,3}$/.test(p)) arido = Number(p);
    else tokens.push(...p.split(/\s*\+\s*/).filter(Boolean));
  }

  const reciclado = sigla === 'HRM' || sigla === 'HRA';
  const tipo: TipoHormigon = sigla === 'HRM' ? 'HM' : sigla === 'HRA' ? 'HA' : (sigla as TipoHormigon);
  const clases: string[] = [];
  const clasesNoValidas: string[] = [];
  for (const t of tokens) {
    const u = t.toUpperCase();
    if (CLASES.has(u)) {
      if (!clases.includes(u)) clases.push(u);
    } else clasesNoValidas.push(t);
  }

  const ambiente = tokens.length ? [...clases, ...clasesNoValidas].join('+') : null;
  const normalizada = [`${sigla}-${fck}`, consistencia, arido, ambiente].filter((x) => x != null).join('/');
  const designacion: DesignacionHormigon = {
    texto: normalizada,
    tipo,
    fck,
    consistencia,
    arido,
    clases,
    clasesNoValidas,
    reciclado,
  };
  return { designacion, avisos: avisosDesignacion(designacion) };
}

/** Avisos de una designación ya leída (también de una guardada en la partida). */
export function avisosDesignacion(d: DesignacionHormigon): string[] {
  const avisos: string[] = [];
  if (d.clasesNoValidas.length)
    avisos.push(
      `${d.texto}: ${d.clasesNoValidas.map((c) => `«${c}»`).join(', ')} no es una clase de exposición de la tabla 27.1.a del Código Estructural; corrígela (no se calcula la durabilidad hasta entonces).`,
    );
  else if (!d.clases.length)
    avisos.push(`${d.texto}: la designación no dice la clase de exposición (tabla 27.1.a).`);
  if (d.consistencia == null)
    avisos.push(`${d.texto}: sin consistencia; se cuenta como hormigón convencional, no autocompactante.`);
  if (d.tipo !== 'HM' && d.clases.includes('X0'))
    avisos.push(`${d.texto}: X0 en hormigón con armaduras solo vale en ambiente muy seco (HR < 45 %, tabla 27.1.a); compruébalo.`);
  const min = d.tipo === 'HM' ? 20 : 25;
  if (d.fck < min)
    avisos.push(`${d.texto}: el fck de un hormigón ${d.tipo === 'HM' ? 'en masa' : 'armado o pretensado'} no puede ser inferior a ${min} N/mm² (art. 33.4).`);
  return avisos;
}

/** Clases válidas de la designación que piden penetración de agua (57.5.7). */
export function pidePenetracion(d: DesignacionHormigon): boolean {
  return d.clases.some((c) => durabilidad.penetracion.familias.some((f) => c.startsWith(f)));
}

/** Clases válidas de la designación que piden aire ocluido (57.5.7: XF2 o XF4). */
export function pideAireOcluido(d: DesignacionHormigon): boolean {
  return d.clases.some((c) => durabilidad.aireOcluido.clases.includes(c));
}
