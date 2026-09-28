/* ===========================================================================
   core/planoDatos — validar sin destruir los datos de planos (schema v6).
   Especificación · Etapa A, §1.3 y §1.4 (docs/plan-medir-planos-pdf.md).

   Una obra NUNCA va a recuperación por un plano mal formado:
   · lo que rompería el render (un elemento de `planos` que no es un objeto, un
     `origen` que no es un objeto, `escalas` o `etiquetas` que no son un objeto)
     se aparta a `_ilegible` con su valor crudo y su ruta;
   · lo demás que no se entiende (un `PlanoMeta`, una `Escala` o un `origen` con
     campos raros) se queda OPACO en su sitio: no se pinta, se escribe de vuelta
     sin cambios y la línea conserva sus números. Lo deciden las guardas puras de
     aquí (`planoLegible`, `escalaLegible`, `origenLegible`) en cada uso.
   Apartar no guarda: lo apartado se escribe con el siguiente guardado real.
   =========================================================================== */
import type {
  Escala,
  Herramienta,
  Ilegible,
  Magnitud,
  MedDim,
  MedLine,
  OrigenPlano,
  PartidasMap,
  PlanoMeta,
  Punto,
} from './types';

export const HERRAMIENTAS: readonly Herramienta[] = ['longitud', 'superficie', 'rectangulo', 'recuento'];
export const MAGNITUDES: readonly Magnitud[] = [
  'recuento',
  'longitud',
  'perimetro',
  'area',
  'lados',
  'longitudPorFactor',
];
const SLOTS: readonly MedDim[] = ['uds', 'largo', 'ancho', 'alto'];

/** Topes de un .json importado (y de lo que se crea): protegen el validador y
 *  la capa de un fichero manipulado. */
export const TOPES = {
  puntosPorOrigen: 2000,
  planos: 200,
  paginasPorPlano: 2000,
  lineasConOrigen: 50000,
} as const;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const texto = (x: unknown): x is string => typeof x === 'string';

export function puntoLegible(x: unknown): x is Punto {
  return Array.isArray(x) && x.length === 2 && finito(x[0]) && finito(x[1]);
}

/** ¿`k` es una clave de página válida (entero de 1 a `paginas`)? Las claves de
 *  `escalas`/`etiquetas` llegan como texto en JSON. */
export function paginaValida(k: string | number, paginas: number): boolean {
  const n = typeof k === 'number' ? k : Number(k);
  return Number.isInteger(n) && n >= 1 && n <= paginas && String(n) === String(k);
}

export function escalaLegible(x: unknown): x is Escala {
  if (!isRecord(x)) return false;
  if (!texto(x.rev) || !finito(x.mPorUnidad) || !(x.mPorUnidad > 0) || !finito(x.n)) return false;
  const r = x.ref;
  if (!isRecord(r) || !puntoLegible(r.a) || !puntoLegible(r.b) || !finito(r.metros) || !(r.metros > 0))
    return false;
  if (x.comprobacion !== undefined) {
    const c = x.comprobacion;
    if (!isRecord(c) || !finito(c.desviacion)) return false;
    if (c.fuente === 'cota') {
      if (!puntoLegible(c.a) || !puntoLegible(c.b) || !finito(c.metros) || !finito(c.medidos)) return false;
    } else if (c.fuente === 'cajetin') {
      if (!finito(c.escalaDeclarada)) return false;
    } else return false;
  }
  return texto(x.at);
}

export function planoLegible(x: unknown): x is PlanoMeta {
  if (!isRecord(x)) return false;
  return (
    texto(x.id) &&
    (x.tipo === 'pdf' || x.tipo === 'imagen') &&
    texto(x.nombre) &&
    texto(x.archivo) &&
    finito(x.tamano) &&
    texto(x.huella) &&
    Number.isInteger(x.paginas) &&
    (x.paginas as number) >= 1 &&
    isRecord(x.escalas) &&
    (x.etiquetas === undefined || isRecord(x.etiquetas)) &&
    (x.quitado === undefined || texto(x.quitado))
  );
}

/** Escala activa y legible de una página, o `null` («sin calibrar»). */
export function escalaDe(p: PlanoMeta, pagina: number): Escala | null {
  if (!paginaValida(pagina, p.paginas)) return null;
  const e = (p.escalas as Record<string, unknown>)[String(pagina)];
  return escalaLegible(e) ? e : null;
}

/** Etiqueta de una página («P1»), o `null`. */
export function etiquetaDe(p: PlanoMeta, pagina: number): string | null {
  const e = (p.etiquetas as Record<string, unknown> | undefined)?.[String(pagina)];
  return typeof e === 'string' && e.trim() ? e.trim() : null;
}

function numerosLegibles(x: unknown): boolean {
  if (!isRecord(x)) return false;
  return Object.entries(x).every(([k, v]) => SLOTS.includes(k as MedDim) && finito(v));
}

/** ¿Se entiende este `origen`? Si no, se conserva tal cual y el marcador dice
 *  «procedencia ilegible». */
export function origenLegible(x: unknown): x is OrigenPlano {
  if (!isRecord(x)) return false;
  if (!texto(x.planoId) || !texto(x.huella) || !texto(x.formaId) || !texto(x.at)) return false;
  if (!Number.isInteger(x.pagina) || (x.pagina as number) < 1) return false;
  if (!HERRAMIENTAS.includes(x.herramienta as Herramienta)) return false;
  if (!MAGNITUDES.includes(x.magnitud as Magnitud)) return false;
  if (!Array.isArray(x.slots) || !x.slots.every((s) => SLOTS.includes(s as MedDim))) return false;
  if (!numerosLegibles(x.valores)) return false;
  if (x.fijas !== undefined && !numerosLegibles(x.fijas)) return false;
  if (x.factor !== undefined && !finito(x.factor)) return false;
  const pts = x.puntos;
  if (!Array.isArray(pts) || pts.length > TOPES.puntosPorOrigen || !pts.every(puntoLegible)) return false;
  switch (x.herramienta) {
    case 'recuento':
      return pts.length >= 1 && x.mPorUnidad === 1;
    case 'rectangulo':
      if (pts.length !== 4) return false;
      break;
    case 'superficie':
      if (pts.length < 3) return false;
      break;
    case 'longitud':
      if (pts.length < 2) return false;
      break;
  }
  return texto(x.calRev) && finito(x.mPorUnidad) && x.mPorUnidad > 0 && finito(x.n);
}

/** Líneas de la obra con su ruta (capítulo, partida). */
function* lineasDe(partidas: PartidasMap): Generator<{ chId: string; partidaId: string; line: MedLine }> {
  for (const [chId, ps] of Object.entries(partidas))
    for (const p of ps ?? []) for (const line of p.med ?? []) yield { chId, partidaId: p.id, line };
}

/**
 * Aparta a `_ilegible` lo que rompería el render (ver cabecera). Devuelve el
 * mismo objeto si no hay nada que apartar; si lo hay, una copia con lo
 * apartado quitado de su sitio. Avisa por consola (la lista de planos lo dice).
 */
export function apartarIlegibles<T extends { planos: unknown; partidas: PartidasMap; _ilegible?: unknown }>(
  d: T,
): T {
  const fuera: Ilegible[] = [];
  let planos = d.planos as unknown[];
  if (!Array.isArray(planos)) {
    fuera.push({ donde: 'planos', valor: planos });
    planos = [];
  } else if (planos.some((p) => !isRecord(p) || !isRecord(p.escalas) || (p.etiquetas !== undefined && !isRecord(p.etiquetas)))) {
    planos = planos.flatMap((p, i) => {
      if (!isRecord(p)) {
        fuera.push({ donde: `planos/${i}`, valor: p });
        return [];
      }
      let q = p;
      if (!isRecord(p.escalas)) {
        fuera.push({ donde: `planos/${i}/escalas`, valor: p.escalas });
        q = { ...q, escalas: {} };
      }
      if (p.etiquetas !== undefined && !isRecord(p.etiquetas)) {
        fuera.push({ donde: `planos/${i}/etiquetas`, valor: p.etiquetas });
        q = { ...q };
        delete q.etiquetas;
      }
      return [q];
    });
  }
  let partidas = d.partidas;
  const malos: { chId: string; partidaId: string; lineId: string }[] = [];
  for (const { chId, partidaId, line } of lineasDe(d.partidas)) {
    if (line.origen !== undefined && !isRecord(line.origen)) {
      fuera.push({ donde: `partidas/${chId}/${partidaId}/med/${line.id}/origen`, valor: line.origen });
      malos.push({ chId, partidaId, lineId: line.id });
    }
  }
  if (malos.length) {
    const quitar = new Set(malos.map((m) => `${m.partidaId}/${m.lineId}`));
    partidas = Object.fromEntries(
      Object.entries(d.partidas).map(([chId, ps]) => [
        chId,
        (ps ?? []).map((p) =>
          p.med?.some((l) => quitar.has(`${p.id}/${l.id}`))
            ? {
                ...p,
                med: p.med.map((l) => {
                  if (!quitar.has(`${p.id}/${l.id}`)) return l;
                  const c = { ...l };
                  delete c.origen;
                  return c;
                }),
              }
            : p,
        ),
      ]),
    );
  }
  const previo = d._ilegible;
  const previos: Ilegible[] = Array.isArray(previo)
    ? (previo as Ilegible[])
    : previo === undefined
      ? []
      : [{ donde: '_ilegible', valor: previo }];
  if (!fuera.length && (previo === undefined || Array.isArray(previo))) return d;
  if (fuera.length) console.warn(`Concreta: ${fuera.length} datos de planos no se pueden leer; se apartan.`, fuera);
  return { ...d, planos, partidas, _ilegible: [...previos, ...fuera] };
}

/** ¿El `ObraData` pasa de los topes de §1.4? Devuelve qué tope, o `null`. */
export function excedeTopes(d: { planos: unknown; partidas: PartidasMap }): keyof typeof TOPES | null {
  const planos = Array.isArray(d.planos) ? d.planos : [];
  if (planos.length > TOPES.planos) return 'planos';
  for (const p of planos)
    if (isRecord(p) && finito(p.paginas) && p.paginas > TOPES.paginasPorPlano) return 'paginasPorPlano';
  let n = 0;
  for (const { line } of lineasDe(d.partidas)) {
    const o = line.origen as unknown;
    if (!isRecord(o)) continue;
    if (++n > TOPES.lineasConOrigen) return 'lineasConOrigen';
    if (Array.isArray(o.puntos) && o.puntos.length > TOPES.puntosPorOrigen) return 'puntosPorOrigen';
  }
  return null;
}

/**
 * [A1] Las huellas cuyos PDF necesita una copia completa de la obra (§9.2): la
 * de cada plano que no está quitado y la de cada línea medida sobre él (una
 * línea medida con un PDF anterior conserva su `origen.huella`, que manda en
 * «Ver en plano»). Primero las de los planos, en su orden.
 */
export function huellasParaCopia(d: { planos: unknown; partidas: PartidasMap }): string[] {
  const vivos = (Array.isArray(d.planos) ? d.planos : []).filter((p): p is PlanoMeta => planoLegible(p) && !p.quitado);
  const ids = new Set(vivos.map((p) => p.id));
  const out = new Set(vivos.map((p) => p.huella));
  for (const { line } of lineasDe(d.partidas)) {
    const o = line.origen;
    if (origenLegible(o) && ids.has(o.planoId)) out.add(o.huella);
  }
  return [...out];
}
