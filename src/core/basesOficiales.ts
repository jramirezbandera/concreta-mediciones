/* ===========================================================================
   core/basesOficiales — catálogo de bases de precios oficiales y gratuitas que
   el modal «Añadir base de referencia» ofrece con un botón
   (docs/plan-bases-oficiales.md).

   No se precarga ninguna: el navegador del usuario las descarga de la web del
   organismo (redistribuirlas exige permiso). Cada entrada la mantenemos a mano:
   al salir una edición nueva se cambian `edicion`, `actualizada`, la URL y
   `bytes`, y `scripts/bases/comprobar.mjs` avisa si algo deja de cuadrar.
   =========================================================================== */
import type { FuenteOficial } from './types';

export interface BaseOficial {
  id: string;
  nombre: string;
  /** Con edición y organismo forma el nombre de la referencia, que es el que
   *  viaja en `baseSource` de cada partida copiada (D15). */
  nombreCorto: string;
  organismo: string;
  edicion: string;
  /** Fecha ISO de la edición publicada por el organismo (D16); `null` si no la da. */
  actualizada: string | null;
  /** Página oficial: siempre; es el plan B si la descarga falla. */
  pagina: string;
  /** Solo si el servidor deja descargarla desde la app (CORS comprobada). */
  descarga?: {
    url: string;
    formato: 'bc3' | 'zip';
    /** Tamaño del cuerpo ya descomprimido: el total de la barra de progreso (D5). */
    bytes: number;
    /** Lo que ocupa ya importada en el navegador (medido, redondeado arriba):
     *  el aviso de espacio de antes de descargar (D8). No sale de `bytes` con un
     *  factor común: un ZIP comprimido ocupa 12 veces más al importarlo. */
    ocupa: number;
  };
  /** Una línea sobre las condiciones de uso. */
  condiciones: string;
  /** Fecha ISO de la última comprobación del enlace. */
  comprobada: string;
}

export const BASES_OFICIALES: readonly BaseOficial[] = [
  {
    id: 'bcca',
    nombre: 'Base de Costes de la Construcción de Andalucía',
    nombreCorto: 'BCCA',
    organismo: 'Junta de Andalucía',
    edicion: 'V02 · enero 2024',
    actualizada: '2024-01-09',
    pagina:
      'https://www.juntadeandalucia.es/organismos/fomentoarticulaciondelterritorioyvivienda/areas/vivienda-rehabilitacion/planes-instrumentos/paginas/bcca-ene-2024.html',
    descarga: {
      url: 'https://www.juntadeandalucia.es/sites/default/files/inline-files/2024/01/BCCA2023_V02.zip',
      formato: 'zip',
      bytes: 624_785,
      ocupa: 8_000_000, // 7,9 MB (11.798 partidas), medido el 2026-10-24
    },
    condiciones: 'Gratuita. Sin permiso para redistribuirla: se descarga de la web oficial.',
    comprobada: '2026-10-24',
  },
  {
    id: 'extremadura',
    nombre: 'Base de Precios de la Construcción de Extremadura',
    nombreCorto: 'BPC Extremadura',
    organismo: 'Junta de Extremadura',
    edicion: '2026',
    actualizada: '2026-06-23',
    pagina: 'https://www.juntaex.es/w/base-precios-construccion-2026',
    descarga: {
      // Sin el `?t=` de caché del portal: responde igual (curl, 2026-10-24).
      url: 'https://www.juntaex.es/documents/77055/621768/BCEXTGREM_26_v1.bc3/8066c810-a694-eeed-c456-a64abca3cc2e',
      formato: 'bc3',
      bytes: 18_708_326,
      ocupa: 34_000_000, // 33,8 MB (54.674 partidas), medido el 2026-10-24
    },
    condiciones:
      'Publicada para redactores de proyectos y constructoras. Sin permiso para redistribuirla: se descarga de la web oficial.',
    comprobada: '2026-10-24',
  },
  {
    id: 'madrid',
    nombre: 'Base de Precios de la Construcción de la Comunidad de Madrid',
    nombreCorto: 'BPC Madrid',
    organismo: 'Comunidad de Madrid',
    edicion: '2024',
    actualizada: null,
    // Se descarga desde su aplicación (formularios, sin enlace fijo): solo página.
    pagina: 'https://www.comunidad.madrid/servicios/vivienda/base-datos-construccion',
    condiciones:
      'Gratuita, para hacer presupuestos. Se descarga desde la aplicación de la Comunidad; condiciones en su web.',
    comprobada: '2026-10-24',
  },
];

export function baseOficial(id: string): BaseOficial | undefined {
  return BASES_OFICIALES.find((b) => b.id === id);
}

/** «BCCA · V02 · enero 2024 (Junta de Andalucía)»: nombre de la referencia. */
export function nombreReferencia(b: BaseOficial): string {
  return `${b.nombreCorto} · ${b.edicion} (${b.organismo})`;
}

/** Fecha ISO local (`aaaa-mm-dd`) de `d`. */
export function fechaIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `aaaa-mm-dd` → `dd/mm/aaaa`. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** La fuente que se guarda con la referencia al descargarla (o soltarla a mano
 *  con la base asociada) el día `hoy`. */
export function fuenteDe(b: BaseOficial, hoy: Date): FuenteOficial {
  return {
    baseId: b.id,
    organismo: b.organismo,
    edicion: b.edicion,
    actualizada: b.actualizada,
    pagina: b.pagina,
    descargadaEl: fechaIso(hoy),
  };
}

/** «Junta de Extremadura · 2026 · actualizada el 23/06/2026 · descargada el 24/10/2026». */
export function textoFuente(f: FuenteOficial): string {
  const partes = [f.organismo, f.edicion];
  if (f.actualizada) partes.push(`actualizada el ${fechaCorta(f.actualizada)}`);
  partes.push(`descargada el ${fechaCorta(f.descargadaEl)}`);
  return partes.join(' · ');
}

/** ¿Hay en el catálogo una edición distinta de la guardada? Nunca se sustituye
 *  sola: la marca solo ofrece bajar la nueva como referencia aparte. */
export function edicionNueva(f: FuenteOficial): BaseOficial | null {
  const b = baseOficial(f.baseId);
  return b && b.edicion !== f.edicion ? b : null;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Validación de una `FuenteOficial` leída de disco (meta o datos): con un
 *  campo mal, se descarta entera en vez de pintar basura. */
export function esFuenteOficial(x: unknown): x is FuenteOficial {
  if (typeof x !== 'object' || x === null) return false;
  const f = x as Record<string, unknown>;
  return (
    typeof f.baseId === 'string' &&
    typeof f.organismo === 'string' &&
    typeof f.edicion === 'string' &&
    (f.actualizada === null || (typeof f.actualizada === 'string' && FECHA.test(f.actualizada))) &&
    typeof f.pagina === 'string' &&
    typeof f.descargadaEl === 'string' &&
    FECHA.test(f.descargadaEl)
  );
}
