// =============================================================================
// La lista de prohibidos del estudio básico (feature-35, principios). PURO.
//
// Lo derogado, lo mal atribuido y lo sin base que traen los ejemplos y que no
// puede aparecer ni en el catálogo ni en el documento generado: K-SYS «Para la
// app», analisis §5.1–5.4 y el paso 0 (K-SYS.16 y K-SYS.19). Un test recorre
// el catálogo con `buscarProhibidos`; el paso 5 hará lo mismo con el documento.
// =============================================================================

export interface Prohibido {
  patron: RegExp;
  motivo: string;
}

export const PROHIBIDOS: readonly Prohibido[] = [
  {
    patron: /aviso previo/i,
    motivo: 'Art. 18 del RD 1627/1997 derogado: hoy es la comunicación de apertura (K-SYS.6)',
  },
  { patron: /anexo III\b/i, motivo: 'El anexo III (aviso previo) ya no existe (K-SYS.6)' },
  {
    patron: /Ordenanza General de Seguridad e Higiene/i,
    motivo: 'Ordenanza de 1971, no citable para obras',
  },
  {
    patron: /Ordenanza[^.]{0,40}Vidrio y Cer[aá]mica/i,
    motivo: 'Ordenanza de 1970, no citable para obras',
  },
  { patron: /486\/1997/, motivo: 'El RD 486/1997 excluye las obras (art. 1.2 b); K-SYS.5' },
  {
    patron: /(retrete|lavabo|ducha)s?[^.]{0,120}(RD|R\.D\.|Real Decreto) ?1627/i,
    motivo: 'Las ratios de servicios no son del RD 1627/1997, son del VII Convenio (K-SYS.5)',
  },
  {
    patron: /1627[^.]{0,120}(retrete|lavabo|ducha)s?\b/i,
    motivo: 'Las ratios de servicios no son del RD 1627/1997, son del VII Convenio (K-SYS.5)',
  },
  {
    patron: /copia a la Inspecci[oó]n/i,
    motivo: 'El art. 13.4 solo lo exige con incumplimientos o paralización (K-SYS.6)',
  },
  {
    patron: /0,1 fibras/i,
    motivo: 'Valores límite de amianto: van a cambiar y no se imprimen (K-SYS.9)',
  },
  {
    patron: /fibras\s*(por|\/)\s*(cm|cent[ií]metro)/i,
    motivo: 'Valores límite de amianto: no se imprimen (K-SYS.9)',
  },
  {
    patron: /cintur[oó]n de seguridad/i,
    motivo: 'Hoy es arnés anticaídas; el literal del anexo IV C.3 b) se parafrasea',
  },
  {
    patron: /\b(2|20|37)\s*(Ω|ohm)/i,
    motivo: 'Resistencia de tierra fija sin base: rige RA × Ia ≤ 24 V (K-SYS.16)',
  },
  {
    patron: /300 mA en fuerza/i,
    motivo: 'Toda base de toma de corriente va con 30 mA como máximo (ITC-BT-33; K-SYS.16)',
  },
  { patron: /25 kg[^.]{0,80}487\/1997/i, motivo: 'El RD 487/1997 no fija 25 kg (K-SYS.16)' },
  { patron: /487\/1997[^.]{0,80}25 kg/i, motivo: 'El RD 487/1997 no fija 25 kg (K-SYS.16)' },
  { patron: /TAS\/2947\/2007/, motivo: 'La Orden TAS/2947/2007 no es norma de la obra (K-SYS.19)' },
  {
    patron: /corte en 50 kV/i,
    motivo: 'Distancia a líneas sin base: rige la tabla 1 del RD 614/2001 (K-SYS.16)',
  },
  {
    patron: /\b3, 5 y 6 m\b/,
    motivo: 'Distancias a líneas sin base: 3, 5 y 7 m de la tabla 1 del RD 614/2001 (K-SYS.16)',
  },
  {
    patron: /escaleras? de (m[aá]s de )?5 m como m[aá]ximo/i,
    motivo: 'El RD 1215/1997 no fija un máximo de 5 m (K-SYS.16)',
  },
  { patron: /\bhal[oó]n\b/i, motivo: 'Agente extintor prohibido (analisis §5.2)' },
  { patron: /mercurocromo|mercromina/i, motivo: 'Botiquín desfasado (analisis §5.2)' },
  { patron: /\bamon[ií]aco\b/i, motivo: 'Botiquín desfasado (analisis §5.2)' },
  { patron: /\bIP ?447\b/, motivo: 'Código inexistente (analisis §5.4)' },
  { patron: /tubo de fibrocemento/i, motivo: 'Material con amianto, prohibido (analisis §5.2)' },
  {
    patron: /Estudio de Seguridad e Higiene/i,
    motivo: 'Terminología del RD 555/1986, derogado (analisis §5.2)',
  },
  { patron: /\bclase B2\b/i, motivo: 'Categoría de permiso que ya no existe (analisis §5.4)' },
];

export interface CoincidenciaProhibida {
  motivo: string;
  coincidencia: string;
}

/** Las apariciones de la lista de prohibidos en un texto; vacío si está limpio. */
export function buscarProhibidos(texto: string): CoincidenciaProhibida[] {
  const out: CoincidenciaProhibida[] = [];
  for (const p of PROHIBIDOS) {
    const m = p.patron.exec(texto);
    if (m) out.push({ motivo: p.motivo, coincidencia: m[0] });
  }
  return out;
}
