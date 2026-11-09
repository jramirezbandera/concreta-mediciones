/* ===========================================================================
   agente/validar — la red de seguridad de una obra (MCP `validar`).
   ---------------------------------------------------------------------------
   · ERRORES: lo que deja la obra incoherente (referencias rotas, ids repetidos,
     números que no son números). Con el motor no deberían salir nunca; si salen,
     el fichero se tocó a mano o hay un fallo que arreglar.
   · AVISOS: lo que falta para que el presupuesto esté completo (partidas sin
     precio, sin cantidad o sin unidad, capítulos vacíos, partidas distintas con
     el mismo código). Son
     el «qué queda por hacer» del agente.
   Cada código sale como mucho `TOPE` veces, con el total en `cuantos`.
   =========================================================================== */
import { flattenContainers } from '../core/tree';
import type { Chapter, Partida } from '../core/types';
import type { ObraState } from '../store';

export interface Diagnostico {
  codigo: string;
  mensaje: string;
  /** Número de la partida en el árbol o código del contenedor. */
  ref?: string;
}

export interface ResultadoValidar {
  ok: boolean;
  errores: Diagnostico[];
  avisos: Diagnostico[];
  /** Cuántas veces salió cada código (también las que no se listan por el tope). */
  cuantos: Record<string, number>;
}

/** Diagnósticos por código que se listan como mucho. */
export const TOPE = 25;

const finito = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

export function validarObra(st: ObraState): ResultadoValidar {
  const errores: Diagnostico[] = [];
  const avisos: Diagnostico[] = [];
  const cuantos: Record<string, number> = {};
  const anota = (lista: Diagnostico[], d: Diagnostico) => {
    cuantos[d.codigo] = (cuantos[d.codigo] ?? 0) + 1;
    if (cuantos[d.codigo]! <= TOPE) lista.push(d);
  };
  const error = (d: Diagnostico) => anota(errores, d);
  const aviso = (d: Diagnostico) => anota(avisos, d);

  // Contenedores: ids únicos.
  const idsCont = new Set<string>();
  const contenedoresDe = new Map<string, Set<string>>();
  for (const ch of st.chapters as Chapter[]) {
    const subs = new Set<string>();
    for (const id of [ch.id, ...flattenContainers(ch).map((f) => f.sub.id)]) {
      if (idsCont.has(id))
        error({
          codigo: 'contenedor/id-repetido',
          mensaje: `hay dos contenedores con el id ${id}`,
          ref: ch.code,
        });
      idsCont.add(id);
      if (id !== ch.id) subs.add(id);
    }
    contenedoresDe.set(ch.id, subs);
  }

  // Partidas huérfanas: una lista sin capítulo no la pinta nadie, pero sumaría.
  for (const chId of Object.keys(st.partidas)) {
    if (!contenedoresDe.has(chId) && (st.partidas[chId]?.length ?? 0) > 0) {
      error({
        codigo: 'partidas/capitulo-inexistente',
        mensaje: `hay ${st.partidas[chId]!.length} partida(s) de un capítulo que no existe (${chId})`,
      });
    }
  }

  const idsPartida = new Set<string>();
  const idsLinea = new Set<string>();
  const codigos = new Map<string, Partida[]>();
  for (const ch of st.chapters) {
    const lista: Partida[] = st.partidas[ch.id] ?? [];
    if (lista.length === 0 && !ch.children?.length)
      aviso({
        codigo: 'capitulo/vacio',
        mensaje: `el capítulo ${ch.code} ${ch.title} no tiene partidas`,
        ref: ch.code,
      });
    for (const p of lista) {
      const ref = p.pos;
      if (idsPartida.has(p.id))
        error({
          codigo: 'partida/id-repetido',
          mensaje: `hay dos partidas con el id ${p.id}`,
          ref,
        });
      idsPartida.add(p.id);
      if (p.sub != null && !contenedoresDe.get(ch.id)!.has(p.sub)) {
        error({
          codigo: 'partida/sub-inexistente',
          mensaje: `la partida ${ref} cuelga de un subcapítulo que no está en su capítulo`,
          ref,
        });
      }
      if (!finito(p.precio) || p.precio < 0)
        error({
          codigo: 'partida/precio-invalido',
          mensaje: `el precio de la partida ${ref} no es un número válido`,
          ref,
        });
      if (p.cantidad !== undefined && (!finito(p.cantidad) || p.cantidad < 0)) {
        error({
          codigo: 'partida/cantidad-invalida',
          mensaje: `la cantidad fija de la partida ${ref} no es un número válido`,
          ref,
        });
      }
      p.med.forEach((l, i) => {
        if (idsLinea.has(l.id))
          error({
            codigo: 'linea/id-repetido',
            mensaje: `la línea ${i + 1} de la partida ${ref} repite un id`,
            ref,
          });
        idsLinea.add(l.id);
        for (const d of ['uds', 'largo', 'ancho', 'alto'] as const) {
          const v = l[d];
          if (v !== '' && !finito(v))
            error({
              codigo: 'linea/numero-invalido',
              mensaje: `la línea ${i + 1} de la partida ${ref} tiene «${d}» que no es un número`,
              ref,
            });
        }
      });
      for (const it of p.items) {
        if (!st.recursos[it.code])
          error({
            codigo: 'partida/recurso-inexistente',
            mensaje: `el descompuesto de la partida ${ref} usa el recurso ${it.code}, que no está en el banco`,
            ref,
          });
      }

      if (!p.ud.trim())
        aviso({ codigo: 'partida/sin-unidad', mensaje: `la partida ${ref} no tiene unidad`, ref });
      if (!(p.precio > 0))
        aviso({
          codigo: 'partida/sin-precio',
          mensaje: `la partida ${ref} ${p.title} no tiene precio`,
          ref,
        });
      if (p.med.length === 0 && !((p.cantidad ?? 0) > 0)) {
        aviso({
          codigo: 'partida/sin-cantidad',
          mensaje: `la partida ${ref} ${p.title} no tiene medición ni cantidad`,
          ref,
        });
      }
      const code = p.code.trim();
      if (code && code !== '——') codigos.set(code, [...(codigos.get(code) ?? []), p]);
    }
  }
  // Homónimas DISTINTAS: el .bc3 las exporta renombradas (`core/bc3export`, D2).
  // Las idénticas (la misma partida en dos sitios) comparten concepto: no se avisa.
  const firma = (p: Partida) =>
    JSON.stringify([
      p.title,
      p.ud,
      p.precio,
      p.desc,
      p.items.map((it) => [it.code, it.type, it.cantidad]),
    ]);
  for (const [code, ps] of codigos) {
    if (ps.length > 1 && new Set(ps.map(firma)).size > 1) {
      const refs = ps.map((p) => p.pos);
      aviso({
        codigo: 'partida/codigo-repetido',
        mensaje: `el código ${code} lo llevan ${ps.length} partidas distintas (${refs.join(', ')}): al exportar a .bc3 se renombran ${code}.2, ${code}.3…`,
        ref: refs[0],
      });
    }
  }

  return { ok: errores.length === 0, errores, avisos, cuantos };
}
