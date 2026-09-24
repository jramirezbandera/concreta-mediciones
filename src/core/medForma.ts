/* ===========================================================================
   core/medForma — forma de medir de una partida: qué columnas enseña la tabla
   de medición y cómo se llaman. Es PRESENTACIÓN: el dato vive siempre en las
   cuatro casillas de FIEBDC (uds · largo · ancho · alto), así que el parcial,
   el ~M del .bc3, la certificación por líneas y la impresión no cambian.

   Cada forma rotula un PREFIJO de esas casillas. Una «Superficie» se guarda en
   `largo` con ancho y alto vacíos (factor 1): es lo que Presto enseña al abrir
   el .bc3 y lo que ya se hacía a mano, pero ahora la cabecera lo dice.
   =========================================================================== */
import { blank } from './medicion';
import { nombrePerfil, perfilEnTexto } from './perfiles';
import type { MedDim, MedForma, MedLine, Partida } from './types';

/** Casillas de una línea, en el orden del ~M de FIEBDC. */
export const MED_SLOTS: readonly MedDim[] = ['uds', 'largo', 'ancho', 'alto'];

export interface MedFormaDef {
  id: MedForma;
  nombre: string;
  /** Rótulo de cada casilla visible, en orden: uds, largo, ancho, alto. */
  cols: readonly string[];
}

export const MED_FORMAS: readonly MedFormaDef[] = [
  { id: 'ud', nombre: 'Unidades', cols: ['Uds'] },
  { id: 'lin', nombre: 'Longitud', cols: ['Uds', 'Longitud'] },
  { id: 'sup', nombre: 'Superficie', cols: ['Uds', 'Longitud', 'Anchura'] },
  { id: 'area', nombre: 'Superficie directa', cols: ['Uds', 'Superficie'] },
  { id: 'vol', nombre: 'Volumen', cols: ['Uds', 'Longitud', 'Anchura', 'Altura'] },
  { id: 'areaEsp', nombre: 'Superficie × espesor', cols: ['Uds', 'Superficie', 'Espesor'] },
  { id: 'peso', nombre: 'Peso', cols: ['Uds', 'Longitud', 'kg/m'] },
];

const POR_ID = new Map(MED_FORMAS.map((f) => [f.id, f]));

/** Rótulos de siempre, para una casilla con datos que la forma no usa. */
const GENERICOS = ['Uds', 'Longitud', 'Anchura', 'Altura'];

export function medFormaDef(id: MedForma): MedFormaDef {
  return POR_ID.get(id) ?? POR_ID.get('vol')!;
}

/**
 * Forma por defecto según la unidad de la partida. Lo que no se reconoce
 * (m³, h, t…) enseña las cuatro columnas, como hasta ahora.
 */
export function formaDeUd(ud: string): MedForma {
  const u = ud.trim().toLowerCase().replace(/\.$/, '');
  if (u === 'ud' || u === 'u' || u === 'uds' || u === 'pa' || u === 'p.a') return 'ud';
  if (u === 'm' || u === 'ml') return 'lin';
  if (u === 'm²' || u === 'm2') return 'sup';
  if (u === 'kg') return 'peso';
  return 'vol';
}

/** Forma efectiva: la elegida a mano o, si no hay, la de la unidad. */
export function medFormaDe(p: Pick<Partida, 'medForma' | 'ud'>): MedForma {
  return p.medForma ?? formaDeUd(p.ud);
}

export interface MedCol {
  slot: MedDim;
  label: string;
  /** La forma no usa esta casilla, pero alguna línea tiene un dato en ella. */
  fuera: boolean;
}

/**
 * Columnas que se pintan: las de la forma y, además, cualquier casilla que la
 * forma no use pero que tenga un dato en alguna línea (un .bc3 importado, o un
 * cambio de forma después de medir). Ocultarla dejaría un factor multiplicando
 * el parcial sin que se viera de dónde sale.
 */
export function medColumnas(forma: MedForma, med: readonly MedLine[]): MedCol[] {
  const { cols } = medFormaDef(forma);
  let n = cols.length;
  for (const l of med) {
    for (let i = MED_SLOTS.length - 1; i >= n; i--) {
      if (!blank(l[MED_SLOTS[i]!])) {
        n = i + 1;
        break;
      }
    }
  }
  return MED_SLOTS.slice(0, n).map((slot, i) => ({
    slot,
    label: cols[i] ?? GENERICOS[i]!,
    fuera: i >= cols.length,
  }));
}

/**
 * En una forma con columna kg/m («Peso»), el perfil que nombra el COMENTARIO
 * de la línea ("Vigas planta 1 IPE300") rellena el kg/m: es donde se escribe
 * de siempre, y así no hay que repetirlo en la celda. Devuelve lo que hay que
 * escribir en la línea, o null si no toca nada:
 *  - la forma no tiene kg/m, o el comentario no nombra un perfil (o nombra varios);
 *  - el kg/m lo tecleó el usuario (un número o una operación): manda lo suyo;
 *  - ya está puesto.
 * Si el kg/m salió de un perfil, sigue al comentario: cambiar IPE 300 por
 * IPE 330 en el texto cambia el peso. Quitar el perfil del texto no lo borra.
 */
export function pesoDesdeComentario(
  forma: MedForma,
  line: MedLine,
): { slot: MedDim; value: number; expr: string } | null {
  const i = medFormaDef(forma).cols.indexOf('kg/m');
  if (i < 0) return null;
  const slot = MED_SLOTS[i]!;
  const perfil = perfilEnTexto(line.comment);
  if (!perfil) return null;
  const expr = line.expr?.[slot];
  const aMano = !blank(line[slot]) && !(expr && nombrePerfil(expr));
  if (aMano || (line[slot] === perfil.kgm && expr === perfil.nombre)) return null;
  return { slot, value: perfil.kgm, expr: perfil.nombre };
}
