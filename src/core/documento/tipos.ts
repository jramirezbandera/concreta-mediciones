/* ===========================================================================
   core/documento — un documento en una estructura neutra (secciones,
   párrafos, listas y tablas) que pinta el Word (`features/exportar/
   docxBloques`) y que se puede probar sin abrir un .docx. Lo comparten el
   estudio de residuos (`core/rcd/documento`) y el plan de control de calidad
   (`core/pcc/documento`). Plan: docs/plan-control-calidad.md, §12 y D12.
   =========================================================================== */

export interface Trozo {
  texto: string;
  pendiente?: boolean;
  negrita?: boolean;
}
export type Parrafo = Trozo[];

export interface TablaDoc {
  columnas: Array<{ titulo: string; ancho: number; derecha?: boolean }>;
  filas: Array<Array<string | Trozo>>;
  pie?: Array<string | Trozo>;
}

export type BloqueDoc = { kind: 'p'; p: Parrafo } | { kind: 'lista'; items: Parrafo[] } | { kind: 'tabla'; t: TablaDoc };

export interface SeccionDoc {
  id: string;
  titulo: string;
  cita?: string;
  bloques: BloqueDoc[];
}

export interface Documento {
  titulo: string;
  secciones: SeccionDoc[];
  /** Firmante: el técnico redactor, o pendiente. */
  firma: { nombre: string; sub: string } | null;
}

/** Todo el texto del documento, para buscar en él (test de citas prohibidas). */
export function textoPlano(doc: Pick<Documento, 'titulo' | 'secciones'>): string {
  const t = (x: string | Trozo) => (typeof x === 'string' ? x : x.texto);
  const out: string[] = [doc.titulo];
  for (const sec of doc.secciones) {
    out.push(sec.titulo, sec.cita ?? '');
    for (const b of sec.bloques) {
      if (b.kind === 'p') out.push(b.p.map(t).join(''));
      else if (b.kind === 'lista') for (const i of b.items) out.push(i.map(t).join(''));
      else {
        out.push(b.t.columnas.map((c) => c.titulo).join(' | '));
        for (const f of b.t.filas) out.push(f.map(t).join(' | '));
        if (b.t.pie) out.push(b.t.pie.map(t).join(' | '));
      }
    }
  }
  return out.join('\n');
}
