/* ===========================================================================
   agente/motor — aplica OPERACIONES sobre la obra cargada en un store.
   ---------------------------------------------------------------------------
   Un solo motor para el asistente de la app (`ai/executor`) y para el agente de
   fuera (MCP, CLI; docs/plan-agente-carpeta.md D2). Muta SOLO llamando a las
   acciones del store, así que hace lo mismo que la interfaz: la numeración, el
   precio del descompuesto, las bajas de lo certificado, el deshacer.

   No importa nada de `persist/` ni del navegador: corre igual en la app que en
   Node, con el store que se le pase (`Tienda`). El sello de la obra y la solo
   lectura los comprueba quien llama.

   Dos capas:
     · APLICADORES (`crearCapitulo`, `agregarLineas`, `editarLineaPorId`…): una
       acción sobre un destino ya resuelto, con su POSTCONDICIÓN (se relee el
       estado: las acciones del store son no-ops silenciosos ante un destino que
       no vale) y su recibo. Los comparte el ejecutor de la app.
     · `aplicarLote`: el lote del agente, en orden. Para en la primera op que no
       se aplica, y entonces el llamador NO debe guardar nada (todo o nada).
   =========================================================================== */
import { estaCertToOrigen, prevDataOf } from '../core/certificacion';
import type { Edificio } from '../core/edificio';
import { fmtEur, fmtNum, round2 } from '../core/money';
import { partidaCantidad } from '../core/medicion';
import {
  findNode,
  findPartidaById,
  nextPartidaCode,
  resolveContainerRef,
  resolvePartidaRef,
  subtreeIds,
  type FoundNode,
  type PartidaHit,
} from '../core/tree';
import type { MedLine, Partida, Rates, SubChapter } from '../core/types';
import type { NewMedLine, ObraState } from '../store';
import type { CertModo, LineaField, OpLinea, PartidaField } from '../ai/ops';
import { conIds } from '../core/id';
import { anclar, type Ancla } from './anclas';
import { CAMPOS_OBRA_NUMERO, type OperacionAgente } from './operaciones';

/** El store sobre el que se opera (`useObraStore` en la app y en Node). */
export interface Tienda {
  getState(): ObraState;
}

/** Recibo de una op ya procesada: qué pasó, con qué destino, y por qué si falló. */
export interface OpReceipt {
  status: 'aplicada' | 'omitida' | 'no-encontrada';
  /** Destino/etiqueta ("Partida 1.2 · Excavación", "Capítulo «Albañilería»"). */
  label: string;
  /** Qué se hizo o se pretendía (lenguaje llano). */
  detail: string;
  /** Motivo, solo para omitida/no-encontrada. */
  reason?: string;
}

/** Recibo de un aplicador; `id` es el de lo que creó, si creó algo. */
export type Recibo = OpReceipt & { id?: string };

/* ---- mapas op → store ------------------------------------------------------- */

export const PARTIDA_FIELD: Record<PartidaField, 'title' | 'ud' | 'code' | 'desc'> = {
  titulo: 'title',
  ud: 'ud',
  codigo: 'code',
  descripcion: 'desc',
};
export const PARTIDA_FIELD_LABEL: Record<PartidaField, string> = {
  titulo: 'Título',
  ud: 'Unidad',
  codigo: 'Código',
  descripcion: 'Descripción',
};
export const LINEA_FIELD: Record<LineaField, keyof MedLine> = {
  comentario: 'comment',
  uds: 'uds',
  largo: 'largo',
  ancho: 'ancho',
  alto: 'alto',
};

/* ---- helpers ---------------------------------------------------------------- */

export function toNewMedLine(l: OpLinea): NewMedLine {
  const out: NewMedLine = {};
  if (typeof l.comentario === 'string') out.comment = l.comentario;
  if (typeof l.uds === 'number') out.uds = l.uds;
  if (typeof l.largo === 'number') out.largo = l.largo;
  if (typeof l.ancho === 'number') out.ancho = l.ancho;
  if (typeof l.alto === 'number') out.alto = l.alto;
  return out;
}

export function partidaLabel(pos: string, title: string): string {
  return `Partida ${pos} · ${title || '(sin título)'}`;
}

/** ¿La partida aparece certificada (con cantidad > 0) en ALGUNA cert? */
export function partidaCertificada(st: ObraState, id: string): boolean {
  return st.certs.some((c) => (c.data[id] ?? 0) > 0);
}

/** Cantidad a-origen que dejaría `certificar` en la cert en curso. */
export function certResultOrigen(
  st: ObraState,
  op: { valor: number; modo: CertModo },
  partidaId: string,
): number {
  if (op.modo === 'esta') {
    const prev = prevDataOf(st.certs, st.curCert)[partidaId] ?? 0;
    return estaCertToOrigen(prev, op.valor);
  }
  return round2(Math.max(0, op.valor));
}

const aplicada = (label: string, detail: string, id?: string): Recibo => ({
  status: 'aplicada',
  label,
  detail,
  ...(id ? { id } : {}),
});
const omitida = (label: string, detail: string, reason: string): Recibo => ({
  status: 'omitida',
  label,
  detail,
  reason,
});
const noEncontrada = (label: string, detail: string, reason: string): Recibo => ({
  status: 'no-encontrada',
  label,
  detail,
  reason,
});

/** Nº de hijos directos de un contenedor (postcondición de crear_subcapitulo). */
function countChildren(t: Tienda, containerId: string): number {
  return findNode(t.getState().chapters, containerId)?.node.children?.length ?? 0;
}

/* ---- aplicadores (destino ya resuelto; postcondición; recibo) --------------- */

export function crearCapitulo(t: Tienda, titulo: string): Recibo {
  const before = t.getState().chapters.length;
  t.getState().addChapter(titulo);
  const chapters = t.getState().chapters;
  if (chapters.length > before)
    return aplicada(`Capítulo «${titulo}»`, 'capítulo creado', chapters.at(-1)?.id);
  return omitida(`Capítulo «${titulo}»`, 'crear capítulo', 'no se pudo crear');
}

export function crearSubcapitulo(t: Tienda, padre: FoundNode, titulo: string): Recibo {
  const parentId = padre.node.id;
  const before = countChildren(t, parentId);
  t.getState().addSubchapter(parentId, titulo);
  const hijos = findNode(t.getState().chapters, parentId)?.node.children ?? [];
  if (hijos.length > before) {
    return aplicada(
      `Subcapítulo «${titulo}»`,
      `bajo ${padre.node.code} ${padre.node.title}`,
      hijos.at(-1)?.id,
    );
  }
  return omitida(`Subcapítulo «${titulo}»`, 'crear subcapítulo', 'no se pudo crear');
}

/** Datos de una partida nueva (los de `crear_partida`, sin el destino). */
export interface DatosPartida {
  codigo?: string;
  titulo: string;
  ud: string;
  precio?: number;
  descripcion?: string;
  lineas?: OpLinea[];
}

/** Crea una partida en `chId`/`subId` y le pone sus datos. `contLabel` nombra el destino. */
export function crearPartidaEn(
  t: Tienda,
  chId: string,
  subId: string | null,
  contLabel: string,
  d: DatosPartida,
): Recibo {
  const id = t.getState().createPartida(chId, subId);
  if (!id)
    return omitida(`Partida «${d.titulo}»`, 'crear partida', 'el destino no admite partidas');
  const store = t.getState();
  // Sin código dictado, uno propio libre (P001…): no se inventa (ver nextPartidaCode).
  store.editPartidaField(chId, id, 'code', d.codigo ?? nextPartidaCode(store.partidas));
  store.editPartidaField(chId, id, 'title', d.titulo);
  store.editPartidaField(chId, id, 'ud', d.ud);
  if (d.descripcion) store.editPartidaField(chId, id, 'desc', d.descripcion);
  if (d.precio !== undefined) store.setPrecio(chId, id, d.precio);
  if (d.lineas?.length) store.addMedLines(chId, id, d.lineas.map(toNewMedLine));

  const created = findPartidaById(t.getState().partidas, id)?.partida;
  const pos = created?.pos ?? '?';
  const bits = [`en ${contLabel}`];
  if (d.lineas?.length) bits.push(`${d.lineas.length} línea(s)`);
  if (d.precio !== undefined) bits.push(`${fmtEur(d.precio)}/${d.ud}`);
  return aplicada(partidaLabel(pos, d.titulo), bits.join(' · '), id);
}

export function agregarLineas(
  t: Tienda,
  chapterId: string,
  partidaId: string,
  pos: string,
  title: string,
  lineas: OpLinea[],
): Recibo {
  const before = findPartidaById(t.getState().partidas, partidaId)?.partida.med.length ?? 0;
  t.getState().addMedLines(chapterId, partidaId, lineas.map(toNewMedLine));
  const after = findPartidaById(t.getState().partidas, partidaId)?.partida.med.length ?? before;
  const label = partidaLabel(pos, title);
  if (after > before) return aplicada(label, `+${after - before} línea(s) de medición`);
  return omitida(label, 'añadir mediciones', 'no se añadió ninguna línea');
}

export function editarCampoPartida(
  t: Tienda,
  hit: PartidaHit,
  campo: PartidaField,
  valor: string,
  label: string,
): Recibo {
  const field = PARTIDA_FIELD[campo];
  t.getState().editPartidaField(hit.chapterId, hit.partida.id, field, valor);
  const after = findPartidaById(t.getState().partidas, hit.partida.id)?.partida;
  if (after && String(after[field] ?? '') === valor)
    return aplicada(label, `${PARTIDA_FIELD_LABEL[campo]} → ${valor}`);
  return omitida(label, `editar ${campo}`, 'no cambió');
}

export function fijarPrecio(t: Tienda, hit: PartidaHit, valor: number, label: string): Recibo {
  t.getState().setPrecio(hit.chapterId, hit.partida.id, valor);
  const after = findPartidaById(t.getState().partidas, hit.partida.id)?.partida.precio;
  if (after === valor) return aplicada(label, `precio → ${fmtEur(valor)}`);
  return omitida(label, 'fijar precio', 'el precio no era aplicable');
}

export function fijarCantidad(t: Tienda, hit: PartidaHit, valor: number, label: string): Recibo {
  if (hit.partida.med.length > 0)
    return omitida(label, 'fijar cantidad', 'la partida tiene medición');
  t.getState().setCantidad(hit.chapterId, hit.partida.id, valor);
  const after = findPartidaById(t.getState().partidas, hit.partida.id)?.partida.cantidad;
  if (after === round2(valor)) return aplicada(label, `cantidad → ${fmtNum(valor)}`);
  return omitida(label, 'fijar cantidad', 'no cambió');
}

export function editarLineaPorId(
  t: Tienda,
  hit: PartidaHit,
  lineId: string | undefined,
  campo: LineaField,
  valor: string | number,
  label: string,
): Recibo {
  const index = hit.partida.med.findIndex((l) => l.id === lineId);
  if (index < 0) return omitida(label, `editar línea`, 'la línea ya no existe');
  const value = campo === 'comentario' ? valor : (valor as number);
  t.getState().editMedLine(
    hit.chapterId,
    hit.partida.id,
    index,
    LINEA_FIELD[campo],
    value as never,
  );
  return aplicada(label, `línea ${index + 1} · ${campo} → ${valor}`);
}

export function borrarLineaPorId(
  t: Tienda,
  hit: PartidaHit,
  lineId: string | undefined,
  label: string,
): Recibo {
  const index = hit.partida.med.findIndex((l) => l.id === lineId);
  if (index < 0) return omitida(label, 'borrar línea', 'la línea ya no existe');
  // Sin la guarda de líneas certificadas de la UI: aquí la confirmación es la del
  // llamador (la tarjeta en la app, `forzar` en el agente).
  t.getState().deleteMedLine(hit.chapterId, hit.partida.id, index);
  const gone = !findPartidaById(t.getState().partidas, hit.partida.id)?.partida.med.some(
    (l) => l.id === lineId,
  );
  if (gone) return aplicada(label, `línea eliminada`);
  return omitida(label, 'borrar línea', 'no se eliminó');
}

export function certificarPartida(
  t: Tienda,
  hit: PartidaHit,
  op: { valor: number; modo: CertModo },
  label: string,
): Recibo {
  const st = t.getState();
  const cur = st.certs[st.curCert];
  if (!cur) return omitida(label, 'certificar', 'no hay certificación en curso');
  const esperado = certResultOrigen(st, op, hit.partida.id);
  st.onCertEdit(hit.partida.id, op.valor, op.modo);
  const after = t.getState().certs[st.curCert]?.data[hit.partida.id] ?? 0;
  if (Math.abs(after - esperado) < 0.005) {
    return aplicada(label, `certificado a origen → ${fmtNum(after)} ${hit.partida.ud}`);
  }
  return omitida(label, 'certificar', 'no se registró la cantidad');
}

/** Completa al 100 % las partidas `ids` en UN solo `set`; `importe` va al recibo. */
export function completarAl100(t: Tienda, ids: string[], label: string, importe: string): Recibo {
  if (ids.length === 0)
    return omitida(label, 'certificar al 100%', 'no había partidas que completar');
  const st = t.getState();
  if (!st.certs[st.curCert])
    return omitida(label, 'certificar al 100%', 'no hay certificación en curso');
  st.completePartidas(ids);
  const after = t.getState().certs[st.curCert]?.data ?? {};
  const done = ids.filter((id) => (after[id] ?? 0) > 0).length;
  if (done > 0) return aplicada(label, `${done} partida(s) al 100% · ${importe}`);
  return omitida(label, 'certificar al 100%', 'no se certificó ninguna');
}

export function crearCertificacion(t: Tienda, periodo?: string): Recibo {
  const before = t.getState().certs.length;
  t.getState().addCert();
  const st = t.getState();
  if (st.certs.length > before) {
    if (periodo) st.setCertField('period', periodo);
    const nueva = st.certs.at(-1);
    return aplicada(
      'Nueva certificación',
      `certificación nº ${nueva?.num}${periodo ? ` · ${periodo}` : ''} creada`,
    );
  }
  return omitida('Nueva certificación', 'crear certificación', 'no se pudo crear');
}

/* ---- ámbitos de certificación ----------------------------------------------- */

/** Partidas de un ámbito + su etiqueta. `found:false` = el contenedor no existe. */
export function scopePartidas(
  st: ObraState,
  ambito: 'obra' | 'capitulo' | 'subarbol',
  hit: FoundNode | null,
): { ps: Partida[]; label: string; found: boolean } {
  const all = (): Partida[] => st.chapters.flatMap((ch) => st.partidas[ch.id] ?? []);
  if (ambito === 'obra') return { ps: all(), label: 'Toda la obra', found: true };
  if (!hit) return { ps: [], label: '', found: false };
  const ch = hit.chapter;
  const chPs = st.partidas[ch.id] ?? [];
  if (ambito === 'capitulo' || hit.node === ch)
    return { ps: chPs, label: `${ch.code} ${ch.title}`, found: true };
  const ids = subtreeIds(hit.node as SubChapter);
  return {
    ps: chPs.filter((p) => p.sub != null && ids.has(p.sub)),
    label: `${hit.node.code} ${hit.node.title}`,
    found: true,
  };
}

/** Ids de las partidas de `ps` que CAMBIAN al completar al 100% (ofertada>0 y aún no al 100%). */
export function completableIds(ps: Partida[], curData: Record<string, number>): string[] {
  const ids: string[] = [];
  for (const p of ps) {
    const ofertada = partidaCantidad(p);
    if (ofertada <= 0) continue;
    if ((curData[p.id] ?? 0) >= ofertada) continue;
    ids.push(p.id);
  }
  return ids;
}

/* ---- el lote del agente ------------------------------------------------------ */

/** Recibo de una op del lote: el recibo, su posición, su tipo y lo que creó. */
export interface ReciboLote extends OpReceipt {
  indice: number;
  op: OperacionAgente['op'];
  /** Id de lo que creó (capítulo, subcapítulo, partida). */
  id?: string;
  /** Número en el árbol (`pos`) o código de lo que creó o tocó, para citarlo. */
  ref?: string;
}

/** Lo que hace falta para repetir una op aplicada sobre otra versión de la obra (F4). */
export interface PasoLote extends Ancla {
  /** Los ids que salieron al aplicarla, en orden: al repetirla salen los mismos. */
  ids: string[];
}

export interface ResultadoLote {
  /** true si se aplicaron todas. Si no, el llamador no guarda nada. */
  ok: boolean;
  recibos: ReciboLote[];
  /** Ops que no se intentaron porque el lote se paró antes. */
  sinIntentar: number;
  /** Cada op aplicada, anclada y con sus ids: lo que va al diario. */
  pasos: PasoLote[];
}

export interface OpcionesLote {
  /** Los ids que tiene que sacar cada op (por su posición en el lote). */
  ids?: readonly (readonly string[] | undefined)[];
}

/** Contenedor por código, título exacto o id. */
function contenedor(st: ObraState, ref: string): FoundNode | null {
  return resolveContainerRef(st.chapters, ref) ?? findNode(st.chapters, ref.trim());
}

const pctTxt = (n: number) => `${fmtNum(n)} %`;

/** La cert en curso, si se puede cambiar: si no, el motivo. */
function certEditable(st: ObraState): { ok: true } | { ok: false; reason: string } {
  const cur = st.certs[st.curCert];
  if (!cur)
    return {
      ok: false,
      reason: 'no hay ninguna certificación en curso (créala con crear_certificacion)',
    };
  if (cur.emitidaAt)
    return {
      ok: false,
      reason: `la certificación nº ${cur.num} está emitida: solo el técnico puede reabrirla`,
    };
  return { ok: true };
}

/** Motivo para no tocar una partida certificada sin `forzar`, o null si se puede. */
function guardaCertificada(st: ObraState, p: Partida, forzar: boolean | undefined): string | null {
  if (forzar || !partidaCertificada(st, p.id)) return null;
  const nums = st.certs.filter((c) => (c.data[p.id] ?? 0) > 0).map((c) => `nº ${c.num}`);
  return `la partida ${p.pos} está certificada (certificación ${nums.join(', ')}): repite con forzar: true solo si el técnico lo ha pedido`;
}

/** Aplica una op del agente. Devuelve su recibo (sin índice). */
function aplicarUna(t: Tienda, op: OperacionAgente): Omit<ReciboLote, 'indice' | 'op'> {
  const st = t.getState();

  // Las que cuelgan de una partida: se resuelve antes, y la guarda de certificadas.
  const partida = (ref: string, que: string): { hit: PartidaHit; label: string } | Recibo => {
    const hit = resolvePartidaRef(st.partidas, ref);
    if (!hit)
      return noEncontrada(
        `Partida ${ref}`,
        que,
        `no encuentro la partida ${ref} (usa su número en el árbol, «1.2.3», o su id)`,
      );
    return { hit, label: partidaLabel(hit.partida.pos, hit.partida.title) };
  };
  const conRef = (r: Recibo, p?: Partida): Omit<ReciboLote, 'indice' | 'op'> => {
    const pos = p ? findPartidaById(t.getState().partidas, p.id)?.partida.pos : undefined;
    return { ...r, ...(pos ? { ref: pos } : {}) };
  };

  switch (op.op) {
    case 'crear_capitulo': {
      const r = crearCapitulo(t, op.titulo);
      const ch = r.id ? t.getState().chapters.find((c) => c.id === r.id) : undefined;
      return { ...r, ...(ch ? { ref: ch.code } : {}) };
    }
    case 'crear_subcapitulo': {
      const padre = contenedor(st, op.padre);
      if (!padre)
        return noEncontrada(
          `Subcapítulo «${op.titulo}»`,
          'crear subcapítulo',
          `no encuentro el contenedor «${op.padre}»`,
        );
      const r = crearSubcapitulo(t, padre, op.titulo);
      const node = r.id ? findNode(t.getState().chapters, r.id)?.node : undefined;
      return { ...r, ...(node ? { ref: node.code } : {}) };
    }
    case 'crear_partida': {
      const hit = contenedor(st, op.capitulo);
      if (!hit)
        return noEncontrada(
          `Partida «${op.titulo}»`,
          'crear partida',
          `no encuentro el capítulo «${op.capitulo}»`,
        );
      const subId = hit.node === hit.chapter ? null : hit.node.id;
      const r = crearPartidaEn(t, hit.chapter.id, subId, `${hit.node.code} ${hit.node.title}`, op);
      const pos = r.id ? findPartidaById(t.getState().partidas, r.id)?.partida.pos : undefined;
      return { ...r, ...(pos ? { ref: pos } : {}) };
    }
    case 'agregar_lineas': {
      const x = partida(op.ref, 'añadir mediciones');
      if ('status' in x) return x;
      const guarda = guardaCertificada(st, x.hit.partida, op.forzar);
      if (guarda) return omitida(x.label, 'añadir mediciones', guarda);
      const p = x.hit.partida;
      return conRef(agregarLineas(t, x.hit.chapterId, p.id, p.pos, p.title, op.lineas), p);
    }
    case 'editar_partida': {
      const x = partida(op.ref, `editar ${op.campo}`);
      if ('status' in x) return x;
      return conRef(editarCampoPartida(t, x.hit, op.campo, op.valor, x.label), x.hit.partida);
    }
    case 'editar_linea':
    case 'borrar_linea': {
      const que = `${op.op === 'editar_linea' ? 'editar' : 'borrar'} línea ${op.indice}`;
      const x = partida(op.ref, que);
      if ('status' in x) return x;
      const p = x.hit.partida;
      const guarda = guardaCertificada(st, p, op.forzar);
      if (guarda) return omitida(x.label, que, guarda);
      const line = p.med[op.indice - 1];
      if (!line) return omitida(x.label, que, `la partida solo tiene ${p.med.length} línea(s)`);
      const r =
        op.op === 'editar_linea'
          ? editarLineaPorId(t, x.hit, line.id, op.campo, op.valor, x.label)
          : borrarLineaPorId(t, x.hit, line.id, x.label);
      return conRef(r, p);
    }
    case 'borrar_lineas': {
      const que = `borrar ${op.indices.length} línea(s)`;
      const x = partida(op.ref, que);
      if ('status' in x) return x;
      const p = x.hit.partida;
      const guarda = guardaCertificada(st, p, op.forzar);
      if (guarda) return omitida(x.label, que, guarda);
      const fuera = op.indices.filter((i) => !p.med[i - 1]);
      if (fuera.length)
        return omitida(
          x.label,
          que,
          `la partida solo tiene ${p.med.length} línea(s); no existe la ${fuera.join(', ')}`,
        );
      const ids = op.indices.map((i) => p.med[i - 1]!.id);
      t.getState().deleteMedLines(x.hit.chapterId, p.id, ids);
      const quedan = findPartidaById(t.getState().partidas, p.id)?.partida.med ?? [];
      if (ids.some((id) => quedan.some((l) => l.id === id)))
        return omitida(x.label, que, 'no se eliminaron');
      return conRef(aplicada(x.label, `${ids.length} línea(s) eliminada(s)`), p);
    }
    case 'set_precio': {
      const x = partida(op.ref, 'fijar precio');
      if ('status' in x) return x;
      return conRef(fijarPrecio(t, x.hit, op.valor, x.label), x.hit.partida);
    }
    case 'set_cantidad': {
      const x = partida(op.ref, 'fijar cantidad');
      if ('status' in x) return x;
      const guarda = guardaCertificada(st, x.hit.partida, op.forzar);
      if (guarda) return omitida(x.label, 'fijar cantidad', guarda);
      if (x.hit.partida.med.length > 0) {
        return omitida(
          x.label,
          'fijar cantidad',
          'la partida tiene medición; su cantidad sale de las líneas',
        );
      }
      return conRef(fijarCantidad(t, x.hit, op.valor, x.label), x.hit.partida);
    }
    case 'certificar': {
      const x = partida(op.ref, 'certificar');
      if ('status' in x) return x;
      const ed = certEditable(st);
      if (!ed.ok) return omitida(x.label, 'certificar', ed.reason);
      return conRef(certificarPartida(t, x.hit, op, x.label), x.hit.partida);
    }
    case 'certificar_100': {
      const ed = certEditable(st);
      if (!ed.ok) return omitida('Certificar al 100%', 'certificar', ed.reason);
      const hit = op.ref ? contenedor(st, op.ref) : null;
      const { ps, label, found } = scopePartidas(st, op.ambito, hit);
      if (!found)
        return noEncontrada(
          'Certificar al 100%',
          'certificar',
          `no encuentro el contenedor «${op.ref ?? ''}»`,
        );
      const ids = completableIds(ps, st.certs[st.curCert]!.data);
      if (ids.length === 0)
        return omitida(
          label,
          'certificar al 100%',
          'ya está todo certificado al 100% (o sin partidas)',
        );
      return completarAl100(t, ids, label, `${ids.length} partida(s)`);
    }
    case 'crear_certificacion':
      return crearCertificacion(t, op.periodo);
    case 'renombrar': {
      const hit = contenedor(st, op.ref);
      if (!hit)
        return noEncontrada(
          `Contenedor ${op.ref}`,
          'renombrar',
          `no encuentro el capítulo o subcapítulo «${op.ref}»`,
        );
      const label = `${hit.node === hit.chapter ? 'Capítulo' : 'Subcapítulo'} ${hit.node.code}`;
      t.getState().editChapterTitle(hit.node.id, op.titulo);
      const after = findNode(t.getState().chapters, hit.node.id)?.node.title;
      if (after === op.titulo.trim())
        return { ...aplicada(label, `título → ${after}`), ref: hit.node.code };
      return omitida(label, 'renombrar', 'no cambió');
    }
    case 'borrar_contenedor': {
      const hit = contenedor(st, op.ref);
      if (!hit)
        return noEncontrada(
          `Contenedor ${op.ref}`,
          'borrar',
          `no encuentro el capítulo o subcapítulo «${op.ref}»`,
        );
      const esCapitulo = hit.node === hit.chapter;
      const label = `${esCapitulo ? 'Capítulo' : 'Subcapítulo'} ${hit.node.code} · ${hit.node.title}`;
      const chPs = st.partidas[hit.chapter.id] ?? [];
      const dentro = esCapitulo
        ? chPs
        : chPs.filter((p) => p.sub != null && subtreeIds(hit.node as SubChapter).has(p.sub));
      if (dentro.length > 0) {
        return omitida(
          label,
          'borrar',
          `tiene ${dentro.length} partida(s): bórralas o muévelas antes (borrar_partida, mover_partida)`,
        );
      }
      if ((hit.node.children?.length ?? 0) > 0)
        return omitida(label, 'borrar', 'tiene subcapítulos: bórralos antes');
      if (esCapitulo) t.getState().deleteChapter(hit.chapter.id);
      else t.getState().deleteSubchapter(hit.chapter.id, hit.node.id);
      if (findNode(t.getState().chapters, hit.node.id))
        return omitida(label, 'borrar', 'no se borró');
      return aplicada(label, 'borrado');
    }
    case 'borrar_partida': {
      const x = partida(op.ref, 'borrar partida');
      if ('status' in x) return x;
      const guarda = guardaCertificada(st, x.hit.partida, op.forzar);
      if (guarda) return omitida(x.label, 'borrar partida', guarda);
      t.getState().deletePartida(x.hit.chapterId, x.hit.partida.id);
      if (findPartidaById(t.getState().partidas, x.hit.partida.id))
        return omitida(x.label, 'borrar partida', 'no se borró');
      return aplicada(x.label, 'partida borrada');
    }
    case 'duplicar_partida': {
      const x = partida(op.ref, 'duplicar partida');
      if ('status' in x) return x;
      const id = t.getState().duplicarPartida(x.hit.chapterId, x.hit.partida.id);
      const copia = id ? findPartidaById(t.getState().partidas, id)?.partida : undefined;
      if (!copia) return omitida(x.label, 'duplicar partida', 'no se duplicó');
      return { ...aplicada(x.label, `duplicada como ${copia.pos}`, id), ref: copia.pos };
    }
    case 'mover_partida': {
      const x = partida(op.ref, 'mover partida');
      if ('status' in x) return x;
      const dest = contenedor(st, op.destino);
      if (!dest)
        return noEncontrada(x.label, 'mover partida', `no encuentro el capítulo «${op.destino}»`);
      const toSub = dest.node === dest.chapter ? null : dest.node.id;
      t.getState().movePartida(x.hit.chapterId, x.hit.partida.id, dest.chapter.id, toSub);
      const after = findPartidaById(t.getState().partidas, x.hit.partida.id);
      if (!after || after.chapterId !== dest.chapter.id || (after.partida.sub ?? null) !== toSub) {
        return omitida(x.label, 'mover partida', 'no se movió');
      }
      return {
        ...aplicada(
          x.label,
          `movida a ${dest.node.code} ${dest.node.title} como ${after.partida.pos}`,
        ),
        ref: after.partida.pos,
      };
    }
    case 'set_porcentajes': {
      const patch: Partial<Rates> = {};
      const bits: string[] = [];
      for (const k of ['gg', 'bi', 'iva', 'ci'] as const) {
        const v = op[k];
        if (v === undefined) continue;
        patch[k] = round2(v) / 100;
        bits.push(`${k.toUpperCase()} → ${pctTxt(v)}`);
      }
      t.getState().setRates(patch);
      const r = t.getState().rates;
      const mal = (Object.keys(patch) as (keyof Rates)[]).filter(
        (k) => Math.abs(r[k] - patch[k]!) > 1e-9,
      );
      if (mal.length)
        return omitida('Porcentajes', 'fijar porcentajes', `no cambió: ${mal.join(', ')}`);
      return aplicada('Porcentajes', bits.join(' · '));
    }
    case 'set_coef_k': {
      t.getState().setRates({ coefK: op.valor });
      if (Math.abs(t.getState().rates.coefK - op.valor) > 1e-9)
        return omitida('Coeficiente K', 'fijar K', 'no cambió');
      return aplicada('Coeficiente K', `K → ${fmtNum(op.valor)}`);
    }
    case 'editar_obra': {
      const label = `Ficha · ${op.campo}`;
      if ((CAMPOS_OBRA_NUMERO as readonly string[]).includes(op.campo)) {
        const campo = op.campo as (typeof CAMPOS_OBRA_NUMERO)[number];
        const patch: Partial<Edificio> = { [campo]: op.valor };
        t.getState().setEdificio(patch);
        const after = t.getState().obra[campo];
        const esperado = op.valor === null ? undefined : op.valor;
        if (op.valor !== null && after == null)
          return omitida(label, 'editar ficha', 'el valor no vale para ese campo');
        return aplicada(label, `→ ${esperado ?? '(vacío)'}`);
      }
      t.getState().setObraPath(op.campo, String(op.valor ?? ''));
      return aplicada(label, `→ ${op.valor || '(vacío)'}`);
    }
  }
}

/**
 * Aplica un lote del agente, en orden. Para en la primera op que no se aplica
 * (todo o nada: el llamador no guarda si `ok` es false). Las siguientes no se
 * intentan, porque podían depender de ella.
 */
export function aplicarLote(
  t: Tienda,
  ops: OperacionAgente[],
  opciones: OpcionesLote = {},
): ResultadoLote {
  const recibos: ReciboLote[] = [];
  const pasos: PasoLote[] = [];
  for (let indice = 0; indice < ops.length; indice++) {
    const op = ops[indice]!;
    const ancla = anclar(t.getState(), op);
    const { valor: r, ids } = conIds(opciones.ids?.[indice], () => aplicarUna(t, op));
    recibos.push({ ...r, indice, op: op.op });
    if (r.status !== 'aplicada')
      return { ok: false, recibos, sinIntentar: ops.length - indice - 1, pasos };
    pasos.push({ ...ancla, ids });
  }
  return { ok: true, recibos, sinIntentar: 0, pasos };
}
