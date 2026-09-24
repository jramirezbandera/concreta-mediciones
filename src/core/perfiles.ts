/* ===========================================================================
   core/perfiles — peso por metro (kg/m) de perfiles laminados y de barras
   corrugadas, para escribir «IPE 300» o «Ø12» en una celda de medición (la
   columna kg/m de la forma «Peso») en vez de ir a buscarlo al prontuario.

   Cada fila lleva el PESO publicado en el prontuario (lo que el usuario
   contrasta) y el ÁREA del catálogo de Concreta EST (`src/data/
   steelProfiles.ts`, verificado contra prontuario). El test exige que
   A · 0,785 (acero 7850 kg/m³) cuadre con el peso: dos fuentes que tienen
   que coincidir, así una errata al copiar no pasa.

   Solo entran las series y tallas que están en AMBAS fuentes. Fuera a
   propósito los UPN 320, 350 y 380: en el catálogo de Concreta EST su área
   no cuadra con la geometría (UPN 320: 65,2 cm² y alma de 10,5 mm; el
   prontuario da 75,8 cm² y 14 mm). Mejor sin dato que con uno dudoso.
   =========================================================================== */

export type SeriePerfil = 'IPE' | 'IPN' | 'HEA' | 'HEB' | 'UPN';

/** [talla, A (cm²) de Concreta EST, peso (kg/m) del prontuario]. */
export const PERFILES: Record<SeriePerfil, readonly (readonly [number, number, number])[]> = {
  IPE: [
    [80, 7.64, 6.0], [100, 10.3, 8.1], [120, 13.2, 10.4], [140, 16.4, 12.9],
    [160, 20.1, 15.8], [180, 23.95, 18.8], [200, 28.5, 22.4], [220, 33.37, 26.2],
    [240, 39.1, 30.7], [270, 45.9, 36.1], [300, 53.8, 42.2], [330, 62.6, 49.1],
    [360, 72.7, 57.1], [400, 84.5, 66.3], [450, 98.8, 77.6], [500, 116, 90.7],
    [550, 134, 106], [600, 156, 122],
  ],
  IPN: [
    [80, 7.58, 5.94], [100, 10.6, 8.34], [120, 14.2, 11.1], [140, 18.3, 14.3],
    [160, 22.8, 17.9], [180, 27.9, 21.9], [200, 33.4, 26.2], [220, 39.5, 31.1],
    [240, 46.1, 36.2], [260, 53.3, 41.9], [280, 61.0, 47.9], [300, 69.0, 54.2],
    [320, 77.7, 61.0], [340, 86.7, 68.0], [360, 97.0, 76.1], [380, 107, 84.0],
    [400, 118, 92.4], [450, 147, 115], [500, 179, 141], [550, 212, 166],
    [600, 254, 199],
  ],
  HEA: [
    [100, 21.2, 16.7], [120, 25.3, 19.9], [140, 31.4, 24.7], [160, 38.8, 30.4],
    [180, 45.25, 35.5], [200, 53.8, 42.3], [220, 64.34, 50.5], [240, 76.8, 60.3],
    [260, 86.82, 68.2], [280, 97.3, 76.4], [300, 112, 88.3], [320, 124, 97.6],
    [340, 133.5, 105], [360, 143, 112], [400, 159, 125],
  ],
  HEB: [
    [100, 26.0, 20.4], [120, 34.0, 26.7], [140, 43.0, 33.7], [160, 54.3, 42.6],
    [180, 65.25, 51.2], [200, 78.1, 61.3], [220, 91.04, 71.5], [240, 106, 83.2],
    [260, 118.4, 93.0], [280, 131, 103], [300, 149, 117], [320, 161, 127],
    [340, 170.9, 134], [360, 181, 142], [400, 197, 155],
  ],
  UPN: [
    [80, 11.0, 8.64], [100, 13.5, 10.6], [120, 17.0, 13.4], [140, 20.4, 16.0],
    [160, 24.0, 18.8], [180, 28.0, 22.0], [200, 32.2, 25.3], [220, 37.4, 29.4],
    [240, 42.3, 33.2], [260, 48.3, 37.9], [280, 53.3, 41.8], [300, 58.8, 46.2],
    [400, 91.5, 71.8],
  ],
};

/** [Ø (mm), peso (kg/m)] de barras corrugadas (masa nominal, UNE-EN 10080). */
export const BARRAS: readonly (readonly [number, number])[] = [
  [6, 0.222], [8, 0.395], [10, 0.617], [12, 0.888], [14, 1.21], [16, 1.58],
  [20, 2.47], [25, 3.85], [32, 6.31], [40, 9.87],
];

const PESO = new Map<string, number>();
for (const [serie, filas] of Object.entries(PERFILES)) {
  for (const [talla, , kgm] of filas) PESO.set(`${serie} ${talla}`, kgm);
}
for (const [d, kgm] of BARRAS) PESO.set(`Ø${d}`, kgm);

// Serie + talla ("IPE 300", "heb200") o barra ("Ø12"; también ø ∅ φ Φ, y D/d
// porque la Ø no está en el teclado español).
const RE_PERFIL = /^(IPE|IPN|HEA|HEB|UPN)\s*(\d+)/i;
const RE_BARRA = /^[Øø∅φΦDd]\s*(\d+)/;

/**
 * Lee una referencia de perfil o barra AL PRINCIPIO de `s`. Devuelve su peso
 * (kg/m), su nombre canónico ("IPE 300", "Ø12") y cuántos caracteres ocupa;
 * `null` si no empieza por una, o si la talla no está en el catálogo.
 */
export function leerPerfil(s: string): { kgm: number; nombre: string; len: number } | null {
  const p = RE_PERFIL.exec(s);
  const b = p ? null : RE_BARRA.exec(s);
  const m = p ?? b;
  if (!m) return null;
  const nombre = p ? `${p[1]!.toUpperCase()} ${Number(p[2])}` : `Ø${Number(b![1])}`;
  const kgm = PESO.get(nombre);
  return kgm === undefined ? null : { kgm, nombre, len: m[0].length };
}

/** Si TODO `s` es un perfil o una barra, su nombre canónico; si no, null. */
export function nombrePerfil(s: string): string | null {
  const t = s.trim();
  const r = leerPerfil(t);
  return r && r.len === t.length ? r.nombre : null;
}
