import { describe, expect, it } from 'vitest';
import catalogo from './tablas/catalogo.json';
import enlaceBcca from './tablas/enlace-bcca.json';
import armaduras from './tablas/armaduras.json';
import durabilidad from './tablas/durabilidad.json';
import ejecucion from './tablas/ejecucion.json';
import lotesHormigon from './tablas/lotes-hormigon.json';

/* Catálogo de ensayos de la hoja de la Junta (V04), generado por
   scripts/pcc/extraer_junta.py con scripts/pcc/correcciones_junta.json, y su enlace con el
   capítulo 18 de la BCCA 2023, generado por scripts/pcc/enlazar_bcca.py con la tabla curada
   scripts/pcc/enlace_bcca.json (docs/plan-control-calidad.md, §3, §3 bis y §8). */

interface Cubre {
  por?: string;
  porEnsayo?: number;
  probetas?: number;
  determinaciones?: number;
  puntos?: number;
  incluye?: string[];
  nota?: string;
  segun?: string;
}
type Fila = (typeof catalogo.ensayos)[number] & {
  lote: { tipo: string; n: number | null; tamano?: number | null; ud?: string | null; calculo?: string };
  correcciones?: Array<{ original: object; motivo: string; cita: string }>;
  alternativaDe?: string;
  cubre?: Cubre;
};
const ensayos = catalogo.ensayos as Fila[];
const porId = new Map(ensayos.map((e) => [e.id, e]));

// Citas derogadas (K-PCC.50) y normas de ensayo sustituidas (K-PCC.51) que no pueden llegar a
// ningún texto del catálogo. Escrita aquí aparte de la del script, para que una no tape a la otra.
const VETADAS = [
  /\bEHE\b/, /EHE-0?8/, /EFHE/, /\bEAE\b/, /RC-0[38]/, /1630\/1992/, /89\/106/, /\bDITE\b/, /\bNBE\b/,
  /clases? generales/i, /MOPU/, /UNE[- ]EN 13829/, /UNE 833\d\d/, /UNE 70\d\d:19/, /UNE 670[23]\d/,
  /UNE 104281/, /art[íi]culo 37/i, /m[íi]nimo 5 ensayos por desplazamiento/i, /6\/2012/, /……/,
];

describe('catálogo de ensayos de la Junta', () => {
  it('es la V04 sin el capítulo 15 (urbanización, fuera de alcance)', () => {
    expect(catalogo.version).toBe('junta-PCC-V04-2023');
    expect(ensayos.length).toBe(540);
    expect(new Set(ensayos.map((e) => e.capitulo))).toEqual(
      new Set(['02', '03', '06', '07', '08', '09', '10', '11', '13']),
    );
    expect(porId.size).toBe(ensayos.length);
  });

  it('cada fila tiene tipo de lote, nivel y unidad de precio', () => {
    for (const e of ensayos) {
      expect(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], e.id).toContain(e.lote.tipo);
      expect([1, 2, 3], e.id).toContain(e.nivel);
      expect(['ensayo', 'visita', 'amasada', 'm'], e.id).toContain(e.unidad);
      if (['A', 'B', 'C'].includes(e.lote.tipo)) {
        expect(e.lote.tamano, e.id).toBeGreaterThan(0);
        expect(e.lote.ud, e.id).toBeTruthy();
      }
      if (e.lote.tipo === 'G') expect(e.lote.calculo, e.id).toBeTruthy();
      if (e.lote.tipo !== 'I') expect(e.precio, e.id).toBeGreaterThan(0);
    }
  });

  it('las inspecciones de ½ jornada se pagan por visita', () => {
    expect(porId.get('j03-125')?.unidad).toBe('visita');
    expect(porId.get('j08-047')?.unidad).toBe('visita');
    expect(porId.get('j08-047')?.lote).toMatchObject({ tipo: 'B', tamano: 0.2, porVisita: 5 });
  });

  it('los precios de referencia de la verificación (B (b) 10, D §3.3)', () => {
    expect(porId.get('j03-008')).toMatchObject({ precio: 59.28, lote: { calculo: 'resistencia' } });
    expect(porId.get('j03-009')).toMatchObject({ precio: 17.26, lote: { calculo: 'consistencia' } });
    expect(porId.get('j03-029')).toMatchObject({ precio: 151.45, lote: { calculo: 'penetracion' } });
    expect(porId.get('j03-085')?.precio).toBe(60.66);
    expect(porId.get('j03-084')?.precio).toBe(35.09);
  });

  it('ningún texto lleva una cita vetada', () => {
    for (const e of ensayos)
      for (const t of [e.ensayo, e.norma, e.obs])
        for (const re of VETADAS) expect(t ?? '', `${e.id}: ${re}`).not.toMatch(re);
  });

  it('cada corrección guarda lo que decía la hoja, el motivo y la cita', () => {
    const corregidas = ensayos.filter((e) => e.correcciones);
    expect(corregidas.length).toBeGreaterThan(40);
    for (const e of corregidas)
      for (const c of e.correcciones!) {
        expect(Object.keys(c.original).length, e.id).toBeGreaterThan(0);
        expect(c.motivo, e.id).toBeTruthy();
        expect(c.cita, e.id).toMatch(/K-PCC|CodE|D-ejemplos/);
      }
  });

  it('armaduras y mallas las calcula la app con el Código, no con «2 / 30 t»', () => {
    for (const id of ['j03-083', 'j03-084', 'j03-085'])
      expect(porId.get(id)?.lote, id).toMatchObject({ tipo: 'G', calculo: 'armaduras' });
    for (const id of ['j03-087', 'j03-088', 'j03-089'])
      expect(porId.get(id)?.lote, id).toMatchObject({ tipo: 'G', calculo: 'mallas' });
    expect(porId.get('j03-085')?.correcciones?.[0]?.original).toMatchObject({ lote: { tipo: 'A', tamano: 30 } });
  });

  it('una norma sustituida sin la vigente verificada queda sin norma y con el motivo', () => {
    const e = porId.get('j03-110') as Fila & { normaPendiente?: string };
    expect(e.norma).toBeNull();
    expect(e.normaPendiente).toMatch(/sustituida/);
    expect(porId.get('j08-138')?.norma).toBe('UNE-EN ISO 9972:2019');
  });

  it('las alternativas apuntan a una fila del catálogo con el mismo lote', () => {
    const alt = ensayos.filter((e) => e.alternativaDe);
    expect(alt.map((e) => e.id)).toEqual(['j03-132', 'j03-140', 'j03-141']);
    for (const e of alt) expect(e.lote).toEqual(porId.get(e.alternativaDe!)?.lote);
  });

  it('lo que cubre el precio de la hoja dice de dónde sale (O4)', () => {
    const conCubre = ensayos.filter((e) => e.cubre);
    expect(conCubre.length).toBeGreaterThan(50);
    for (const e of conCubre) {
      expect(e.cubre!.segun, e.id).toBeTruthy();
      for (const k of ['porEnsayo', 'probetas', 'determinaciones', 'puntos'] as const)
        if (e.cubre![k] !== undefined) expect(Number.isInteger(e.cubre![k]) && e.cubre![k]! > 0, `${e.id} ${k}`).toBe(true);
    }
    // Compresión y consistencia: un precio por amasada controlada, sin inventar probetas.
    expect(porId.get('j03-008')).toMatchObject({ unidad: 'amasada', cubre: { por: 'amasada' } });
    expect(porId.get('j03-008')?.cubre?.probetas).toBeUndefined();
    expect(porId.get('j03-009')?.unidad).toBe('amasada');
    expect(porId.get('j03-029')?.cubre?.probetas).toBe(3);
    // «Precio por testigo (la norma pide 10)» y «precio por punto, mínimo 10 puntos».
    expect(porId.get('j02-101')?.cubre).toMatchObject({ por: 'testigo', porEnsayo: 10 });
    expect(porId.get('j10-070')?.cubre).toMatchObject({ por: 'punto', porEnsayo: 10 });
    expect(porId.get('j10-080')?.cubre?.determinaciones).toBe(5);
    expect(porId.get('j08-008')).toMatchObject({ unidad: 'm', precio: 2 });
    expect(porId.get('j10-084')?.unidad).toBe('visita');
  });
});

type Enlace = (typeof enlaceBcca.enlaces)[number] & {
  motivo?: string;
  cubre?: Cubre;
  citasVetadas?: string[];
  precioComoLaHoja?: boolean;
};
const enlaces = enlaceBcca.enlaces as Enlace[];
const enlace = new Map(enlaces.map((f) => [f.ensayo, f]));
const codigos = (id: string) => enlace.get(id)?.partidas.map((p) => p.codigo);

describe('enlace del catálogo con la BCCA 2023', () => {
  it('cada ensayo del catálogo está una vez, en el mismo orden', () => {
    expect(enlaceBcca.version).toBe('bcca-2023-V02');
    expect(enlaceBcca.catalogo).toBe(catalogo.version);
    expect(enlaces.map((f) => f.ensayo)).toEqual(ensayos.map((e) => e.id));
  });

  it('cada fila dice cómo casa, en qué unidad y, si no es una partida con el precio de la hoja, por qué', () => {
    for (const f of enlaces) {
      const n = f.partidas.length;
      expect(f.como, f.ensayo).toBe(n === 0 ? 'sinCodigo' : n === 1 ? 'partida' : 'compuesto');
      for (const p of f.partidas) expect(p.codigo, f.ensayo).toMatch(/^18[A-Z]{2,5}\d{5}$/);
      expect(f.unidad, f.ensayo).toBe(porId.get(f.ensayo)?.unidad);
      if (f.como !== 'partida' || f.precioComoLaHoja === false) expect(f.motivo, f.ensayo).toBeTruthy();
      if (f.como === 'sinCodigo') expect(f.cubre, f.ensayo).toBeUndefined();
    }
    expect(enlaceBcca.cuenta).toEqual({ partida: 478, compuesto: 4, sinCodigo: 58 });
  });

  it('las parejas de referencia de la verificación (D §4.2)', () => {
    expect(codigos('j03-008')).toEqual(['18HHL00010']);
    expect(codigos('j03-009')).toEqual(['18HHL00020']);
    expect(codigos('j03-029')).toEqual(['18HHL00030']);
    expect(codigos('j03-011')).toEqual(['18HHI00040']);
    expect(codigos('j03-014')).toEqual(['18HHI00010']);
    expect(codigos('j02-017')).toEqual(['18ALF00070']);
    expect(codigos('j02-018')).toEqual(['18ASS00010']);
    expect(codigos('j03-060')).toEqual(['18CPI00010']);
    expect(codigos('j08-130')).toEqual(['18UBB00010']);
    expect(codigos('j08-138')).toEqual(['18UDA00010']);
    // El pavimento de hormigón continuo tiene sus propias partidas.
    expect(codigos('j10-064')).toEqual(['18BSH00010']);
  });

  it('el acero para armar y el aire ocluido no tienen código', () => {
    for (const id of ['j03-083', 'j03-084', 'j03-085', 'j03-087', 'j03-088', 'j03-089', 'j03-027', 'j03-028'])
      expect(enlace.get(id)?.como, id).toBe('sinCodigo');
  });

  it('los «solo precio» falsos no se enlazan (nunca por importe)', () => {
    // 210 € = química del acero y compresión de suelo-cemento; 95 € = bovedillas y baldosas;
    // 500 € = anclaje y compresión de muros de fábrica.
    for (const id of ['j03-039', 'j03-196', 'j03-107', 'j03-034'])
      expect(enlace.get(id)?.como, id).toBe('sinCodigo');
    expect(codigos('j02-082')).toEqual(['18ALF00090']);
  });

  it('un precio de la hoja que es la suma de varios ensayos casa con varias partidas', () => {
    expect(enlace.get('j03-162')).toMatchObject({ como: 'compuesto', precioComoLaHoja: true });
    expect(codigos('j03-162')).toHaveLength(4);
    expect(enlace.get('j03-174')).toMatchObject({ como: 'compuesto', precioComoLaHoja: false });
  });

  it('lo que cubre el precio de la BCCA cuando no es lo de la hoja (O4)', () => {
    // La hoja: 125 € por punto, mínimo 10; la BCCA: 125 € por ensayo.
    expect(porId.get('j10-070')?.cubre?.porEnsayo).toBe(10);
    expect(enlace.get('j10-070')?.cubre).toMatchObject({ porEnsayo: 1 });
    expect(enlace.get('j03-076')?.cubre?.determinaciones).toBe(2);
    for (const f of enlaces.filter((x) => x.cubre)) expect(f.cubre!.segun, f.ensayo).toMatch(/^Texto de 18/);
  });

  it('el texto de banco con citas vetadas queda señalado (K-PCC.68)', () => {
    expect(enlace.get('j03-029')?.citasVetadas).toEqual(['18HHL00030: clases generales']);
    expect(enlace.get('j03-150')?.citasVetadas?.[0]).toMatch(/^18SCA00010: m[íi]nimo 5 ensayos por desplazamiento/i);
    expect(enlace.get('j08-009')?.citasVetadas).toEqual(['18IAAA00020: MOPU']);
  });
});

/** Todos los veredictos de una tabla, en cualquier nivel. */
function veredictos(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) for (const v of x) veredictos(v, out);
  else if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) {
      if (k === 'veredicto' && typeof v === 'string') out.push(v);
      else veredictos(v, out);
    }
  return out;
}

describe('tablas del Código Estructural', () => {
  const tablas = { lotesHormigon, durabilidad, armaduras, ejecucion };

  it('llevan cabecera con norma, edición, página, verificación y veredicto', () => {
    for (const [nombre, t] of Object.entries(tablas)) {
      for (const k of ['id', 'norma', 'edicion', 'tabla', 'pagina', 'verificacion', 'veredicto'] as const)
        expect((t as Record<string, unknown>)[k], `${nombre}.${k}`).toBeTruthy();
      expect(t.version, nombre).toBe('CodE-2021+CE-2024');
    }
  });

  it('ninguna fila SIN CONFIRMAR: solo veredictos de la verificación', () => {
    for (const [nombre, t] of Object.entries(tablas))
      for (const v of veredictos(t)) expect(v, nombre).toMatch(/^(VERIFICADO \((texto|imagen)\)|CORREGIDO)$/);
  });

  it('las filas de edificación de la tabla 57.5.4.1 son las de B A1', () => {
    const f = lotesHormigon.filas;
    expect(Object.keys(f)).toEqual(['cim_mayor_200', 'cim_superficial', 'flexion', 'pilares_muros', 'otros_compresion']);
    expect(f.cim_mayor_200).toMatchObject({ loteEsElemento: true, semanas: 1, nSin: { porVolumen: 35, min: 3 }, nDistintivo: { porVolumen: 105, min: 1 } });
    expect(f.cim_superficial).toMatchObject({ vol: 100, semanas: 1, nSin: { min: 3 }, nDistintivo: { min: 1 } });
    expect(f.flexion).toMatchObject({ vol: 100, semanas: 2, sup: 1000, plantas: 2 });
    expect(f.pilares_muros).toMatchObject({ vol: 100, semanas: 2, sup: 500, plantas: 2, supSiPocasAmasadas: { maxAmasadas: 3, sup: 1000 } });
    expect(f.otros_compresion).toMatchObject({ vol: 100, semanas: 2, sup: 500, plantas: 2 });
    expect(lotesHormigon.ampliacion).toMatchObject({ distintivo: 5, dispersion: 2, minimoLotes: 3 });
    expect(lotesHormigon.semanasMax).toBe(6);
    expect(lotesHormigon.fckAlto).toEqual({ fck: 50, nMin: 6 });
  });

  it('Kₙ de la tabla 57.5.4.3.b', () => {
    expect(lotesHormigon.kn).toEqual({ '3': 0.89, '4': 0.91, '5': 0.93, '6': 0.94, '7': 0.95, '8': 0.96, '9': 0.97, '10': 0.98, mas10: 1 });
  });

  it('γc = 1,5 del anejo 19 (tabla A19.2.1) y fcd ≤ 15 del control indirecto', () => {
    expect(lotesHormigon.indirecto).toMatchObject({ fcdMax: 15, gammaC: 1.5, alphaCC: 1, fckMinArmado: 25, veredicto: 'VERIFICADO (texto)' });
  });

  it('clases de exposición de la tabla 27.1.a y las que piden durabilidad', () => {
    expect(durabilidad.clases.validas).toHaveLength(21);
    expect(durabilidad.clases.validas).not.toContain('IIa');
    expect(durabilidad.penetracion).toMatchObject({ familias: ['XA', 'XS', 'XD', 'XF', 'XM'], cadaMeses: 6, probetas: 3 });
    expect(durabilidad.aireOcluido.clases).toEqual(['XF2', 'XF4']);
  });

  it('series de diámetros y lotes de armaduras (arts. 58 y 59)', () => {
    expect(armaduras.series).toMatchObject({ fina: { hasta: 10 }, media: { desde: 12, hasta: 20 }, gruesa: { desde: 25, hasta: 32 }, muyGruesa: { desde: 40 } });
    expect(armaduras.barras.loteT).toBe(30);
    expect(armaduras.mallas.loteT).toBe(30);
    expect(armaduras.ferralla).toMatchObject({ loteT: 25, porLote: { traccion: 4, doblado: 4, geometriaPorDiametro: 2, dimensiones: 15 } });
  });

  it('lotes de ejecución de la tabla 63.1, sin los 50 m de muro de la fila de forjados', () => {
    expect(ejecucion.lotes.filas).toEqual({
      cimentacion: expect.objectContaining({ sup: 250, elementos: 10 }),
      flexion: expect.objectContaining({ sup: 250, plantas: 2 }),
      pilares_muros: expect.objectContaining({ sup: 250, plantas: 2, muroM: 50 }),
    });
    expect(ejecucion.lotes.filas.flexion).not.toHaveProperty('muroM');
  });
});
